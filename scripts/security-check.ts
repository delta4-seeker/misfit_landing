import { readFile } from "node:fs/promises";

import { PrismaClient } from "@prisma/client";

import { directDatabaseUrl } from "../src/lib/database-url";
import { consumeRateLimit } from "../src/lib/rate-limit";
import { isSecureExternalUrl } from "../src/lib/validation";

const prisma = new PrismaClient({ datasourceUrl: directDatabaseUrl() });
const origin = process.env.SECURITY_CHECK_ORIGIN || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
type Check = { name: string; passed: boolean; detail?: string; warning?: boolean };

function check(name: string, passed: boolean, detail?: string, warning = false): Check {
  return { name, passed, detail, ...(warning ? { warning: true } : {}) };
}

async function main() {
  const checks: Check[] = [];
  const acceptedUrls = ["https://example.com", "https://sub.example.com/path?q=1"];
  const rejectedUrls = ["javascript:alert(1)", "data:text/html,test", "http://example.com", "https://user:password@example.com", "//example.com"];
  checks.push(check(
    "external URL allowlist",
    acceptedUrls.every(isSecureExternalUrl) && rejectedUrls.every((value) => !isSecureExternalUrl(value)),
    "https only; credentials and active-content schemes rejected",
  ));

  const [products, events, users, settings] = await Promise.all([
    prisma.product.findMany({ select: { slug: true, websiteUrl: true, linkedinUrl: true } }),
    prisma.event.findMany({ select: { slug: true, lumaUrl: true } }),
    prisma.user.findMany({ where: { linkedinUrl: { not: null } }, select: { id: true, linkedinUrl: true } }),
    prisma.siteSettings.findUnique({ where: { id: 1 } }),
  ]);
  const storedUrls = [
    ...products.flatMap((item) => [item.websiteUrl, item.linkedinUrl]),
    ...events.map((item) => item.lumaUrl),
    ...users.map((item) => item.linkedinUrl),
    settings?.applyFormUrl,
    settings?.instagramUrl,
    settings?.linkedinUrl,
  ].filter((value): value is string => Boolean(value));
  const unsafeStoredUrls = storedUrls.filter((value) => !isSecureExternalUrl(value));
  checks.push(check("stored external URLs", unsafeStoredUrls.length === 0, `${storedUrls.length} checked; ${unsafeStoredUrls.length} unsafe`));

  const authSecret = process.env.AUTH_SECRET || process.env.SECRET_KEY || "";
  checks.push(check("authentication secret", authSecret.length >= 32, authSecret ? "configured and at least 32 characters" : "missing"));
  checks.push(check("Google OAuth credentials", Boolean((process.env.AUTH_GOOGLE_ID || process.env.GOOGLE_CLIENT_ID) && (process.env.AUTH_GOOGLE_SECRET || process.env.GOOGLE_CLIENT_SECRET)), "client ID and secret present"));
  checks.push(check("database TLS configuration", Boolean(directDatabaseUrl()?.includes("sslmode=require")), "sslmode=require"));

  const ignoreFile = await readFile(".gitignore", "utf8");
  checks.push(check("secret files ignored", [".env", ".env.local"].every((entry) => ignoreFile.split(/\r?\n/).includes(entry)), ".env and .env.local"));

  const [mediaTable] = await prisma.$queryRaw<Array<{ table_name: string | null }>>`
    SELECT to_regclass('public."MediaAsset"')::text AS table_name
  `;
  const localUploadReferences = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT (
      (SELECT COUNT(*) FROM "User" WHERE "profilePicture" LIKE '/uploads/%') +
      (SELECT COUNT(*) FROM "Product" WHERE "logoUrl" LIKE '/uploads/%') +
      (SELECT COUNT(*) FROM "Event" WHERE "coverImageUrl" LIKE '/uploads/%') +
      (SELECT COUNT(*) FROM "GalleryPhoto" WHERE "imageUrl" LIKE '/uploads/%')
    ) AS count
  `;
  const storageReady = Boolean(mediaTable?.table_name) && Number(localUploadReferences[0]?.count || 0) === 0;
  checks.push(check(
    "durable production media storage",
    storageReady,
    storageReady ? "database media table present; no local upload references" : `${Number(localUploadReferences[0]?.count || 0)} local upload reference(s) remain`,
  ));

  const action = `security-check-${crypto.randomUUID()}`;
  const rateResults = [
    await consumeRateLimit(action, "same-subject", 3, 60_000),
    await consumeRateLimit(action, "same-subject", 3, 60_000),
    await consumeRateLimit(action, "same-subject", 3, 60_000),
  ];
  const fourth = await consumeRateLimit(action, "same-subject", 3, 60_000);
  await prisma.actionRateLimit.deleteMany({ where: { action } });
  checks.push(check("durable mutation throttling", rateResults.every(Boolean) && !fourth, "fourth request rejected at a limit of three"));

  const response = await fetch(new URL("/products/test-adversarial-live", origin), { redirect: "manual" });
  const html = await response.text();
  const rawScript = '<script>alert("escaped")</script>';
  checks.push(check("stored XSS escaping", response.status === 200 && !html.includes(rawScript), `status ${response.status}; raw script absent`));
  checks.push(check("anti-sniff header", response.headers.get("x-content-type-options") === "nosniff", response.headers.get("x-content-type-options") || "missing"));
  checks.push(check("frame protection", response.headers.get("x-frame-options") === "DENY", response.headers.get("x-frame-options") || "missing"));
  checks.push(check("permissions policy", Boolean(response.headers.get("permissions-policy")?.includes("camera=()")), response.headers.get("permissions-policy") || "missing"));
  const contentSecurityPolicy = response.headers.get("content-security-policy");
  checks.push(check(
    "content security policy",
    Boolean(contentSecurityPolicy?.includes("default-src 'self'") && contentSecurityPolicy.includes("frame-ancestors 'none'")),
    contentSecurityPolicy ? "default source and frame ancestry restricted" : "missing",
  ));
  const strictTransportSecurity = response.headers.get("strict-transport-security");
  checks.push(check(
    "strict transport security",
    Boolean(strictTransportSecurity?.includes("max-age=63072000") && strictTransportSecurity.includes("includeSubDomains")),
    strictTransportSecurity || "missing",
  ));

  const wrongFounder = await fetch(new URL("/founders/not-the-canonical-name-dc70zz", origin), { redirect: "manual" });
  checks.push(check("canonical founder lookup", wrongFounder.status === 404, `status ${wrongFounder.status}`));

  const failures = checks.filter((entry) => !entry.passed && !entry.warning);
  console.log(JSON.stringify({ status: failures.length ? "failed" : "passed-with-warnings", checks }, null, 2));
  if (failures.length) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.stack || error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
