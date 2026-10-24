import { PrismaClient } from "@prisma/client";

import { directDatabaseUrl } from "../src/lib/database-url";
import { displayName, founderSlug } from "../src/lib/utils";

const origin = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const prisma = new PrismaClient({ datasourceUrl: directDatabaseUrl() });

type CheckResult = { route: string; status: number; passed: boolean; detail?: string };

async function request(route: string, cookie?: string) {
  return fetch(new URL(route, origin), {
    redirect: "manual",
    headers: cookie ? { cookie } : undefined,
  });
}

async function main() {
  const results: CheckResult[] = [];
  for (const route of ["/", "/products", "/events", "/gallery", "/join", "/api/health"]) {
    const response = await request(route);
    results.push({ route, status: response.status, passed: response.status === 200 });
  }

  const product = await prisma.product.findFirst({
    where: { status: "LIVE", owner: { status: "ACTIVE" } },
    include: { owner: true, coFounders: { where: { status: "ACTIVE" } } },
    orderBy: { createdAt: "desc" },
  });
  if (product) {
    const productPage = await request(`/products/${product.slug}`);
    const productHtml = await productPage.text();
    const allFounderNamesVisible = [product.owner, ...product.coFounders]
      .every((founder) => productHtml.includes(displayName(founder)));
    results.push({
      route: `/products/${product.slug} (founders)` ,
      status: productPage.status,
      passed: productPage.status === 200 && productHtml.includes("Show founders") && allFounderNamesVisible,
      detail: `${1 + product.coFounders.length} founder profile link(s) rendered`,
    });

    const ownerName = displayName(product.owner);
    const founderPage = await request(`/founders/${founderSlug(ownerName, product.owner.id)}`);
    results.push({
      route: `/founders/${founderSlug(ownerName, product.owner.id)}`,
      status: founderPage.status,
      passed: founderPage.status === 200,
      detail: "founder detail route",
    });
  }

  const session = await prisma.session.findFirst({
    where: { expires: { gt: new Date() } },
    include: { user: true },
    orderBy: { expires: "desc" },
  });

  if (session) {
    const cookie = `authjs.session-token=${encodeURIComponent(session.sessionToken)}`;
    const profile = await request("/profile", cookie);
    const profileHtml = await profile.text();
    const fieldsAreOptional = !/<input[^>]+name="(?:fullName|phone|linkedinUrl|instagramHandle)"[^>]+required/i.test(profileHtml);
    results.push({
      route: "/profile (authenticated)",
      status: profile.status,
      passed: profile.status === 200 && fieldsAreOptional && profileHtml.includes("Everything is optional to save"),
      detail: fieldsAreOptional ? "profile fields are optional" : "a profile field is still required",
    });

    const newProduct = await request("/products/new", cookie);
    const location = newProduct.headers.get("location") || "";
    const userIsComplete = session.user.profileCompleted;
    results.push({
      route: "/products/new (completion gate)",
      status: newProduct.status,
      passed: userIsComplete ? newProduct.status === 200 : newProduct.status === 307 && location.startsWith("/profile"),
      detail: userIsComplete ? "complete member allowed" : `incomplete member redirected to ${location || "missing location"}`,
    });

    if (session.user.isAdmin) {
      const admin = await request("/admin", cookie);
      const adminHtml = await admin.text();
      results.push({
        route: "/admin (authenticated)",
        status: admin.status,
        passed: admin.status === 200 && adminHtml.includes("Admin panel"),
      });
    }
  } else {
    results.push({ route: "authenticated routes", status: 0, passed: false, detail: "no active database session" });
  }

  const passed = results.every((result) => result.passed);
  console.log(JSON.stringify({ status: passed ? "passed" : "failed", results }, null, 2));
  if (!passed) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
