import { PrismaClient } from "@prisma/client";

import { databaseUrl } from "../src/lib/database-url";
import { profileCompletion } from "../src/lib/profile";
import { displayName, founderSlug } from "../src/lib/utils";

const origin = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const prisma = new PrismaClient({ datasourceUrl: databaseUrl() });

type CheckResult = { route: string; status: number; passed: boolean; detail?: string };

async function request(route: string, cookie?: string) {
  return fetch(new URL(route, origin), {
    redirect: "manual",
    headers: cookie ? { cookie } : undefined,
  });
}

async function main() {
  const results: CheckResult[] = [];
  const publicRoutes = ["/", "/products", "/events", "/gallery", "/join", "/api/health"];
  const publicResponses = await Promise.all(publicRoutes.map((route) => request(route)));
  for (const [index, route] of publicRoutes.entries()) {
    const response = publicResponses[index];
    results.push({ route, status: response.status, passed: response.status === 200 });
  }

  const product = await prisma.product.findFirst({
    where: { status: "LIVE", owner: { status: "ACTIVE" } },
    include: { owner: true, coFounders: { where: { status: "ACTIVE" } } },
    orderBy: { createdAt: "desc" },
  });
  if (product) {
    const ownerName = displayName(product.owner);
    const ownerSlug = founderSlug(ownerName, product.owner.id);
    const [productPage, founderPage] = await Promise.all([
      request(`/products/${product.slug}`),
      request(`/founders/${ownerSlug}`),
    ]);
    const productHtml = await productPage.text();
    const allFounderNamesVisible = [product.owner, ...product.coFounders]
      .every((founder) => productHtml.includes(displayName(founder)));
    results.push({
      route: `/products/${product.slug} (founders)` ,
      status: productPage.status,
      passed: productPage.status === 200 && productHtml.includes("Show founders") && allFounderNamesVisible,
      detail: `${1 + product.coFounders.length} founder profile link(s) rendered`,
    });

    results.push({
      route: `/founders/${ownerSlug}`,
      status: founderPage.status,
      passed: founderPage.status === 200,
      detail: "founder detail route",
    });
  }

  const authRunId = `http-check-${crypto.randomUUID()}`;
  await prisma.user.deleteMany({
    where: { email: { startsWith: "http-check-", endsWith: "@example.invalid" } },
  });
  const completeUser = {
      id: `${authRunId}-complete`,
      email: `${authRunId}-complete@example.invalid`,
      fullName: "Complete Route Check",
      phone: "+9779800000000",
      linkedinUrl: "https://linkedin.com/in/complete-route-check",
      instagramHandle: "complete.route.check",
      profilePicture: "/img/misfit-mark.png",
      profileCompleted: false,
    };
  const incompleteUser = {
      id: `${authRunId}-incomplete`,
      email: `${authRunId}-incomplete@example.invalid`,
      fullName: "Incomplete Route Check",
      profileCompleted: true,
    };
  await prisma.user.createMany({ data: [completeUser, incompleteUser] });
  const completeToken = `${authRunId}-complete-session`;
  const incompleteToken = `${authRunId}-incomplete-session`;
  await prisma.session.createMany({ data: [
    { sessionToken: completeToken, userId: completeUser.id, expires: new Date(Date.now() + 300_000) },
    { sessionToken: incompleteToken, userId: incompleteUser.id, expires: new Date(Date.now() + 300_000) },
  ] });

  try {
    const completeCookie = `authjs.session-token=${encodeURIComponent(completeToken)}`;
    const incompleteCookie = `authjs.session-token=${encodeURIComponent(incompleteToken)}`;

    const [join, completeProfile, incompleteProfile, completeProduct, incompleteProduct] = await Promise.all([
      request("/join", completeCookie),
      request("/profile", completeCookie),
      request("/profile", incompleteCookie),
      request("/products/new", completeCookie),
      request("/products/new", incompleteCookie),
    ]);
    results.push({
      route: "/join (authenticated)",
      status: join.status,
      passed: join.status === 307 && join.headers.get("location") === "/",
      detail: `redirected to ${join.headers.get("location") || "missing location"}`,
    });

    const completeProfileHtml = await completeProfile.text();
    const fieldsAreOptional = !/<input[^>]+name="(?:fullName|phone|linkedinUrl|instagramHandle)"[^>]+required/i.test(completeProfileHtml);
    results.push({
      route: "/profile (complete member)",
      status: completeProfile.status,
      passed: completeProfile.status === 200 && fieldsAreOptional && completeProfileHtml.includes("Edit your profile."),
      detail: fieldsAreOptional ? "optional edit form rendered" : "a profile field is still required",
    });

    const incompleteProfileHtml = await incompleteProfile.text();
    results.push({
      route: "/profile (incomplete member)",
      status: incompleteProfile.status,
      passed: incompleteProfile.status === 200 && incompleteProfileHtml.includes("Complete your profile."),
      detail: "completion prompt rendered only for incomplete member",
    });

    results.push({
      route: "/products/new (complete member)",
      status: completeProduct.status,
      passed: profileCompletion(completeUser).complete && completeProduct.status === 200,
      detail: "live profile data allowed product submission despite a stale false flag",
    });

    const incompleteLocation = incompleteProduct.headers.get("location") || "";
    results.push({
      route: "/products/new (incomplete member)",
      status: incompleteProduct.status,
      passed: !profileCompletion(incompleteUser).complete && incompleteProduct.status === 307 && incompleteLocation.startsWith("/profile?error="),
      detail: `redirected to ${incompleteLocation || "missing location"} despite a stale true flag`,
    });
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: [completeUser.id, incompleteUser.id] } } });
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
