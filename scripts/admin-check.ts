import { PrismaClient } from "@prisma/client";

import { directDatabaseUrl } from "../src/lib/database-url";

const origin = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const prisma = new PrismaClient({ datasourceUrl: directDatabaseUrl() });
const runId = `admin-check-${crypto.randomUUID()}`;

const adminViews = [
  "overview", "users", "products", "engagement", "invitations", "categories",
  "events", "gallery", "newsletter", "settings", "admins", "audit",
] as const;

type Result = { check: string; passed: boolean; detail?: string };

function result(check: string, passed: boolean, detail?: string): Result {
  return { check, passed, detail };
}

async function request(route: string, token?: string) {
  return fetch(new URL(route, origin), {
    redirect: "manual",
    headers: token ? { cookie: `authjs.session-token=${encodeURIComponent(token)}` } : undefined,
  });
}

async function databaseControlCheck() {
  let rolledBack = false;
  try {
    await prisma.$transaction(async (tx) => {
      const owner = await tx.user.create({ data: { id: `${runId}-owner`, email: `${runId}-owner@example.invalid` } });
      const cofounder = await tx.user.create({ data: { id: `${runId}-cofounder`, email: `${runId}-cofounder@example.invalid` } });
      await tx.user.update({ where: { id: owner.id }, data: { status: "SUSPENDED" } });
      await tx.user.update({ where: { id: owner.id }, data: { status: "ACTIVE" } });
      const category = await tx.category.create({ data: { id: runId, name: runId, slug: runId, sortOrder: 9999 } });
      const product = await tx.product.create({
        data: {
          id: runId,
          ownerId: owner.id,
          categoryId: category.id,
          name: "Admin control check",
          slug: runId,
          websiteUrl: "https://example.com/admin-check",
          tagline: "A reversible admin test.",
          description: "Created, updated, related, and deleted entirely inside a rollback-only transaction.",
          coFounders: { connect: { id: cofounder.id } },
        },
      });
      await tx.product.update({ where: { id: product.id }, data: { status: "LIVE", exclusive: true, featured: true, featuredOrder: 999 } });
      await tx.productVote.create({ data: { productId: product.id, userId: cofounder.id } });
      await tx.productComment.create({ data: { id: runId, productId: product.id, authorId: cofounder.id, body: "Moderation control check" } });
      await tx.coFounderInvite.create({ data: { id: runId, productId: product.id, email: `${runId}-invite@example.invalid`, expiresAt: new Date(Date.now() + 86_400_000) } });
      await tx.event.create({
        data: { id: runId, slug: runId, title: "Admin event check", startsAt: new Date(Date.now() + 86_400_000), venue: "Online", description: "A reversible event control check.", lumaUrl: "https://lu.ma/example" },
      });
      await tx.galleryPhoto.create({ data: { id: runId, imageUrl: "/demo/production/gallery/build-night.jpg", caption: "Rollback-only photo" } });
      await tx.newsletterSubscriber.create({ data: { id: runId, email: `${runId}@example.invalid`, unsubscribeToken: runId } });
      await tx.auditLog.create({ data: { id: runId, action: "ADMIN_CONTROL_CHECK", targetType: "Product", targetId: product.id } });

      const loaded = await tx.product.findUnique({
        where: { id: product.id },
        include: { coFounders: true, votes: true, comments: true, invites: true },
      });
      if (!loaded || loaded.status !== "LIVE" || loaded.coFounders.length !== 1 || loaded.votes.length !== 1 || loaded.comments.length !== 1 || loaded.invites.length !== 1) {
        throw new Error("Admin relational controls did not persist inside the test transaction.");
      }

      await tx.productComment.delete({ where: { id: runId } });
      await tx.coFounderInvite.delete({ where: { id: runId } });
      await tx.product.delete({ where: { id: product.id } });
      await tx.event.delete({ where: { id: runId } });
      await tx.galleryPhoto.delete({ where: { id: runId } });
      await tx.newsletterSubscriber.delete({ where: { id: runId } });
      await tx.category.delete({ where: { id: runId } });
      if (await tx.product.count({ where: { id: product.id } })) throw new Error("Admin delete control failed.");
      throw new Error("ROLLBACK_ADMIN_CHECK");
    }, { maxWait: 10_000, timeout: 30_000 });
  } catch (error) {
    if (error instanceof Error && error.message === "ROLLBACK_ADMIN_CHECK") rolledBack = true;
    else throw error;
  }
  const clean = await prisma.user.count({ where: { id: { startsWith: runId } } }) === 0
    && await prisma.auditLog.count({ where: { id: runId } }) === 0;
  return rolledBack && clean;
}

async function main() {
  const results: Result[] = [];
  const adminEmail = (process.env.SEED_ADMIN_EMAIL || "9165prashant@gmail.com").toLowerCase();
  const admin = await prisma.user.findUnique({ where: { email: adminEmail } });
  results.push(result("seeded super-admin", Boolean(admin?.isAdmin && admin?.isSuperAdmin), admin?.email || "missing"));
  if (!admin) throw new Error(`Seeded admin ${adminEmail} is missing.`);

  const [testUsers, testProducts, testEvents, testPhotos, testSubscribers, testComments, testVotes, testInvitations] = await Promise.all([
    prisma.user.count({ where: { email: { startsWith: "test+" } } }),
    prisma.product.count({ where: { slug: { startsWith: "test-" } } }),
    prisma.event.count({ where: { slug: { startsWith: "test-" } } }),
    prisma.galleryPhoto.count({ where: { id: { startsWith: "test-" } } }),
    prisma.newsletterSubscriber.count({ where: { email: { startsWith: "test+" } } }),
    prisma.productComment.count({ where: { id: { startsWith: "test-" } } }),
    prisma.productVote.count({ where: { product: { slug: "test-adversarial-live" } } }),
    prisma.coFounderInvite.count({ where: { product: { slug: "test-adversarial-live" } } }),
  ]);
  const seededCounts = { testUsers, testProducts, testEvents, testPhotos, testSubscribers, testComments, testVotes, testInvitations };
  results.push(result(
    "adversarial production-like fixtures",
    testUsers >= 5 && testProducts >= 3 && testEvents >= 3 && testPhotos >= 3 && testSubscribers >= 2 && testComments >= 3 && testVotes >= 3 && testInvitations >= 4,
    JSON.stringify(seededCounts),
  ));

  const statuses = await prisma.user.groupBy({ by: ["status"], where: { email: { startsWith: "test+" } }, _count: true });
  const statusSet = new Set(statuses.map((entry) => entry.status));
  results.push(result("member status edge cases", ["ACTIVE", "SUSPENDED", "BANNED"].every((status) => statusSet.has(status as "ACTIVE" | "SUSPENDED" | "BANNED")), statuses.map((entry) => `${entry.status}:${entry._count}`).join(", ")));

  const listingStatuses = await prisma.product.groupBy({ by: ["status"], where: { slug: { startsWith: "test-" } }, _count: true });
  const listingSet = new Set(listingStatuses.map((entry) => entry.status));
  results.push(result("listing visibility edge cases", ["LIVE", "DRAFT", "HIDDEN"].every((status) => listingSet.has(status as "LIVE" | "DRAFT" | "HIDDEN")), listingStatuses.map((entry) => `${entry.status}:${entry._count}`).join(", ")));

  const inviteStatuses = await prisma.coFounderInvite.groupBy({ by: ["status"], where: { product: { slug: "test-adversarial-live" } }, _count: true });
  const inviteSet = new Set(inviteStatuses.map((entry) => entry.status));
  results.push(result("invitation lifecycle edge cases", ["PENDING", "ACCEPTED", "REVOKED", "EXPIRED"].every((status) => inviteSet.has(status as "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED")), inviteStatuses.map((entry) => entry.status).join(", ")));

  results.push(result("admin database controls", await databaseControlCheck(), "create/update/relate/delete passed and rolled back"));

  const anonymousAdmin = await request("/admin");
  const anonymousLocation = anonymousAdmin.headers.get("location") || "";
  results.push(result("anonymous admin gate", anonymousAdmin.status === 307 && anonymousLocation.includes("/join?next=/admin"), `${anonymousAdmin.status} ${anonymousLocation}`));

  const adminToken = `${runId}-admin-session`;
  const memberToken = `${runId}-member-session`;
  const suspendedAdminToken = `${runId}-suspended-admin-session`;
  const member = await prisma.user.upsert({
    where: { email: `${runId}@example.invalid` },
    create: { email: `${runId}@example.invalid`, name: "Temporary admin gate check" },
    update: {},
  });
  const suspendedAdmin = await prisma.user.create({
    data: { email: `${runId}-suspended-admin@example.invalid`, name: "Temporary suspended admin check", isAdmin: true, status: "SUSPENDED" },
  });
  await prisma.session.createMany({ data: [
    { sessionToken: adminToken, userId: admin.id, expires: new Date(Date.now() + 300_000) },
    { sessionToken: memberToken, userId: member.id, expires: new Date(Date.now() + 300_000) },
    { sessionToken: suspendedAdminToken, userId: suspendedAdmin.id, expires: new Date(Date.now() + 300_000) },
  ] });
  try {
    const home = await request("/", adminToken);
    const homeHtml = await home.text();
    results.push(result("admin navigation visibility", home.status === 200 && /href="\/admin"[^>]*>Admin</.test(homeHtml), `status ${home.status}`));

    for (const view of adminViews) {
      const response = await request(`/admin?view=${view}`, adminToken);
      const html = await response.text();
      results.push(result(`admin view: ${view}`, response.status === 200 && html.includes("Admin panel"), `status ${response.status}`));
    }

    const memberAdmin = await request("/admin", memberToken);
    results.push(result("non-admin gate", memberAdmin.status === 404, `status ${memberAdmin.status}`));

    const suspendedAdminResponse = await request("/admin", suspendedAdminToken);
    results.push(result("suspended admin gate", suspendedAdminResponse.status === 404, `status ${suspendedAdminResponse.status}`));

    const products = await request("/products");
    const productsHtml = await products.text();
    results.push(result(
      "public listing filters",
      products.status === 200 && productsHtml.includes("test-adversarial-live") && !productsHtml.includes("test-draft-minimum-fields") && !productsHtml.includes("test-hidden-boundary-copy"),
      `status ${products.status}`,
    ));
  } finally {
    await prisma.session.deleteMany({ where: { sessionToken: { in: [adminToken, memberToken, suspendedAdminToken] } } });
    await prisma.user.deleteMany({ where: { id: { in: [member.id, suspendedAdmin.id] } } });
  }

  const passed = results.every((entry) => entry.passed);
  console.log(JSON.stringify({ status: passed ? "passed" : "failed", results }, null, 2));
  if (!passed) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.stack || error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
