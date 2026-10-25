import { PrismaClient } from "@prisma/client";

import { directDatabaseUrl } from "../src/lib/database-url";
import { profileCompletion } from "../src/lib/profile";

const databaseUrl = directDatabaseUrl();
if (!databaseUrl) throw new Error("Database connection is not configured.");

const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
const smokeId = `backend-check-${crypto.randomUUID()}`;
const smokeEmail = `${smokeId}@example.invalid`;

async function scalarCount(query: TemplateStringsArray) {
  const rows = await prisma.$queryRaw<Array<{ count: bigint }>>(query);
  return Number(rows[0]?.count || 0);
}

async function main() {
  await prisma.$queryRaw`SELECT 1`;

  const [
    users, accounts, sessions, categories, products, votes, comments, events, photos,
    subscribers, auditLogs, mediaAssets, migrations, failedMigrations, userRows, seededAdmin,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.account.count(),
    prisma.session.count(),
    prisma.category.count(),
    prisma.product.count(),
    prisma.productVote.count(),
    prisma.productComment.count(),
    prisma.event.count(),
    prisma.galleryPhoto.count(),
    prisma.newsletterSubscriber.count(),
    prisma.auditLog.count(),
    prisma.mediaAsset.count(),
    prisma.$queryRaw<Array<{ migration_name: string }>>`
      SELECT migration_name FROM "_prisma_migrations"
      WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
      ORDER BY finished_at
    `,
    prisma.$queryRaw<Array<{ migration_name: string }>>`
      SELECT migration_name FROM "_prisma_migrations"
      WHERE finished_at IS NULL AND rolled_back_at IS NULL
    `,
    prisma.user.findMany({
      where: { email: { not: { startsWith: "preview+" } } },
      select: {
        id: true, fullName: true, phone: true, linkedinUrl: true, instagramHandle: true,
        profilePicture: true, image: true, profileCompleted: true,
      },
    }),
    prisma.user.findUnique({
      where: { email: (process.env.SEED_ADMIN_EMAIL || "9165prashant@gmail.com").toLowerCase() },
      select: { isAdmin: true, isSuperAdmin: true },
    }),
  ]);

  const profileFlagMismatches = userRows.filter((user) => profileCompletion(user).complete !== user.profileCompleted).length;
  const orphanChecks = {
    productsWithoutOwner: await scalarCount`SELECT COUNT(*) AS count FROM "Product" p LEFT JOIN "User" u ON u.id = p."ownerId" WHERE u.id IS NULL`,
    productsWithoutCategory: await scalarCount`SELECT COUNT(*) AS count FROM "Product" p LEFT JOIN "Category" c ON c.id = p."categoryId" WHERE c.id IS NULL`,
    votesWithoutRelations: await scalarCount`SELECT COUNT(*) AS count FROM "ProductVote" v LEFT JOIN "Product" p ON p.id = v."productId" LEFT JOIN "User" u ON u.id = v."userId" WHERE p.id IS NULL OR u.id IS NULL`,
    commentsWithoutRelations: await scalarCount`SELECT COUNT(*) AS count FROM "ProductComment" c LEFT JOIN "Product" p ON p.id = c."productId" LEFT JOIN "User" u ON u.id = c."authorId" WHERE p.id IS NULL OR u.id IS NULL`,
  };

  let transactionRolledBack = false;
  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { id: smokeId, email: smokeEmail } });
      const coFounder = await tx.user.create({ data: { id: `${smokeId}-cofounder`, email: `cofounder-${smokeEmail}` } });
      const category = await tx.category.create({ data: { id: smokeId, name: smokeId, slug: smokeId } });
      const product = await tx.product.create({
        data: {
          id: smokeId,
          ownerId: user.id,
          categoryId: category.id,
          name: "Backend check",
          slug: smokeId,
          websiteUrl: "https://example.com",
          tagline: "A reversible backend check.",
          description: "This record exists only inside a transaction that must roll back.",
        },
      });
      await tx.product.update({ where: { id: product.id }, data: { coFounders: { connect: { id: coFounder.id } } } });
      await tx.productVote.create({ data: { productId: product.id, userId: user.id } });
      await tx.productComment.create({ data: { productId: product.id, authorId: user.id, body: "Rollback check" } });
      const loaded = await tx.product.findUnique({
        where: { id: product.id },
        include: { owner: true, category: true, coFounders: true, votes: true, comments: true },
      });
      if (!loaded || loaded.coFounders.length !== 1 || loaded.votes.length !== 1 || loaded.comments.length !== 1) {
        throw new Error("Relational CRUD smoke test failed.");
      }
      throw new Error("ROLLBACK_BACKEND_CHECK");
    }, { maxWait: 10_000, timeout: 30_000 });
  } catch (error) {
    if (error instanceof Error && error.message === "ROLLBACK_BACKEND_CHECK") transactionRolledBack = true;
    else throw error;
  }

  const rollbackClean = (await prisma.user.count({ where: { id: smokeId } })) === 0
    && (await prisma.user.count({ where: { id: `${smokeId}-cofounder` } })) === 0
    && (await prisma.product.count({ where: { id: smokeId } })) === 0;
  const failures = [
    failedMigrations.length > 0,
    Object.values(orphanChecks).some(Boolean),
    profileFlagMismatches > 0,
    !seededAdmin?.isAdmin,
    !seededAdmin?.isSuperAdmin,
    !transactionRolledBack,
    !rollbackClean,
  ].filter(Boolean).length;

  console.log(JSON.stringify({
    status: failures ? "failed" : "passed",
    migrations: migrations.map((row) => row.migration_name),
    failedMigrations: failedMigrations.length,
    counts: { users, accounts, sessions, categories, products, votes, comments, events, photos, subscribers, auditLogs, mediaAssets },
    orphanChecks,
    profileFlagMismatches,
    seededAdminReady: Boolean(seededAdmin?.isAdmin && seededAdmin?.isSuperAdmin),
    relationalCrudSmokeTest: transactionRolledBack && rollbackClean ? "passed (rolled back)" : "failed",
  }, null, 2));

  if (failures) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
