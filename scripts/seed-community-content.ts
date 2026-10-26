import { PrismaClient } from "@prisma/client";

import { directDatabaseUrl } from "../src/lib/database-url";

const prisma = new PrismaClient({ datasourceUrl: directDatabaseUrl() });

const feedback = [
  {
    id: "sample-feedback-khalti",
    slug: "khalti",
    body: "Sample feedback: A visible transaction-status page could help small merchants answer customers quickly when a payment takes longer than expected.",
  },
  {
    id: "sample-feedback-foodmandu",
    slug: "foodmandu",
    body: "Sample feedback: Filtering by estimated delivery time before choosing a restaurant would make a quick lunch order easier to plan.",
  },
  {
    id: "sample-feedback-hamro-patro",
    slug: "hamro-patro",
    body: "Sample feedback: A simpler way to share and sync reminders across devices would be useful for families living in different time zones.",
  },
] as const;

const blog = {
  slug: "sample-what-useful-feedback-sounds-like",
  kicker: "Sample field note",
  title: "What useful product feedback sounds like",
  excerpt: "A fictional example of how a founder community can turn a reaction into a question worth acting on.",
  body: `This is a sample field note, written to demonstrate the blog while the club gathers its own stories. The examples below are fictional.

## Start with what happened

"I could not find the delivery estimate until after I chose a restaurant" gives a team more to work with than "the app is confusing." It names a moment, an expectation, and a point of friction.

## Ask before prescribing

A useful follow-up might be: "How do people decide whether an order will arrive in time for lunch?" That question keeps the founder close to the problem without assuming the first suggested feature is the right answer.

## Close the loop

Feedback becomes valuable when someone tests the assumption, shares what they learned, and tells the person who raised it. The goal is not to collect more opinions. It is to make the next decision clearer.

> The most generous feedback is specific enough to investigate and humble enough to be wrong.`,
  tags: ["Feedback", "Community"],
  coverImageUrl: null,
  authorName: "Misfit Founders Club",
  status: "PUBLISHED" as const,
  readingMinutes: 2,
};

async function main() {
  const products = await prisma.product.findMany({
    where: { slug: { in: feedback.map((item) => item.slug) }, status: "LIVE" },
    select: { id: true, slug: true },
  });
  if (products.length !== feedback.length) throw new Error("A sample feedback product is missing or not live.");
  const productBySlug = new Map(products.map((product) => [product.slug, product.id]));

  await prisma.$transaction(async (tx) => {
    const author = await tx.user.upsert({
      where: { email: "sample-feedback@misfitfoundersclub.invalid" },
      create: { name: "Sample community member", fullName: "Sample community member", email: "sample-feedback@misfitfoundersclub.invalid" },
      update: {},
    });

    for (const item of feedback) {
      await tx.productComment.upsert({
        where: { id: item.id },
        create: { id: item.id, productId: productBySlug.get(item.slug)!, authorId: author.id, body: item.body },
        update: {},
      });
    }

    await tx.blogPost.upsert({
      where: { slug: blog.slug },
      create: { ...blog, publishedAt: new Date() },
      update: {},
    });
  });

  const [savedFeedback, savedBlog] = await Promise.all([
    prisma.productComment.findMany({ where: { id: { in: feedback.map((item) => item.id) } }, select: { id: true, product: { select: { slug: true } } } }),
    prisma.blogPost.findUnique({ where: { slug: blog.slug }, select: { slug: true, status: true } }),
  ]);
  if (savedFeedback.length !== feedback.length || savedBlog?.status !== "PUBLISHED") throw new Error("Sample content did not persist.");
  console.log(JSON.stringify({ feedbackProducts: savedFeedback.map((item) => item.product.slug).sort(), blog: savedBlog.slug }));
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
