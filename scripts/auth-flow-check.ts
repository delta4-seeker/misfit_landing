import { PrismaClient } from "@prisma/client";

import { databaseUrl } from "../src/lib/database-url";

const origin = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const prisma = new PrismaClient({ datasourceUrl: databaseUrl() });
const runId = `auth-flow-check-${crypto.randomUUID()}`;

type Result = { check: string; passed: boolean; detail: string };

async function request(route: string, token: string) {
  return fetch(new URL(route, origin), {
    redirect: "manual",
    headers: { cookie: `authjs.session-token=${encodeURIComponent(token)}` },
  });
}

async function main() {
  await prisma.user.deleteMany({
    where: {
      OR: [
        { email: { startsWith: "auth-flow-check-", endsWith: "@example.invalid" } },
        { email: { startsWith: "http-check-", endsWith: "@example.invalid" } },
      ],
    },
  });

  const completeId = `${runId}-complete`;
  const incompleteId = `${runId}-incomplete`;
  const completeToken = `${runId}-complete-session`;
  const incompleteToken = `${runId}-incomplete-session`;

  await prisma.user.createMany({ data: [
    {
      id: completeId,
      email: `${runId}-complete@example.invalid`,
      fullName: "Complete Auth Flow Check",
      phone: "+9779800000000",
      linkedinUrl: "https://linkedin.com/in/complete-auth-flow-check",
      instagramHandle: "complete.auth.flow",
      profilePicture: "/img/misfit-mark.png",
      profileCompleted: false,
    },
    {
      id: incompleteId,
      email: `${runId}-incomplete@example.invalid`,
      fullName: "Incomplete Auth Flow Check",
      profileCompleted: true,
    },
  ] });
  await prisma.session.createMany({ data: [
    { sessionToken: completeToken, userId: completeId, expires: new Date(Date.now() + 300_000) },
    { sessionToken: incompleteToken, userId: incompleteId, expires: new Date(Date.now() + 300_000) },
  ] });

  try {
    const [join, completeProfile, incompleteProfile, completeProduct, incompleteProduct] = await Promise.all([
      request("/join", completeToken),
      request("/profile", completeToken),
      request("/profile", incompleteToken),
      request("/products/new", completeToken),
      request("/products/new", incompleteToken),
    ]);
    const [completeProfileHtml, incompleteProfileHtml] = await Promise.all([
      completeProfile.text(),
      incompleteProfile.text(),
    ]);
    const incompleteLocation = incompleteProduct.headers.get("location") || "";
    const results: Result[] = [
      {
        check: "authenticated join redirects home",
        passed: join.status === 307 && join.headers.get("location") === "/",
        detail: `${join.status} ${join.headers.get("location") || "missing location"}`,
      },
      {
        check: "complete profile uses edit state",
        passed: completeProfile.status === 200 && completeProfileHtml.includes("Edit your profile."),
        detail: `status ${completeProfile.status}`,
      },
      {
        check: "incomplete profile uses completion state",
        passed: incompleteProfile.status === 200 && incompleteProfileHtml.includes("Complete your profile."),
        detail: `status ${incompleteProfile.status}`,
      },
      {
        check: "complete member can list product",
        passed: completeProduct.status === 200,
        detail: `status ${completeProduct.status}; stale stored flag was false`,
      },
      {
        check: "incomplete member is gated at product listing",
        passed: incompleteProduct.status === 307 && incompleteLocation.startsWith("/profile?error="),
        detail: `${incompleteProduct.status} ${incompleteLocation || "missing location"}; stale stored flag was true`,
      },
    ];
    const passed = results.every((result) => result.passed);
    console.log(JSON.stringify({ status: passed ? "passed" : "failed", results }, null, 2));
    if (!passed) process.exitCode = 1;
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: [completeId, incompleteId] } } });
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.stack || error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
