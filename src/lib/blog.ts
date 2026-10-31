import "server-only";

import type { Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";

import { pageBounds } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";

const cardAuthorSelect = {
  id: true,
  fullName: true,
  name: true,
  email: true,
  profilePicture: true,
  image: true,
} satisfies Prisma.UserSelect;

const detailAuthorSelect = {
  ...cardAuthorSelect,
  products: {
    where: { status: "LIVE" as const },
    orderBy: { createdAt: "asc" as const },
    take: 1,
    select: { name: true, slug: true },
  },
  coFoundedProducts: {
    where: { status: "LIVE" as const },
    orderBy: { createdAt: "asc" as const },
    take: 1,
    select: { name: true, slug: true },
  },
} satisfies Prisma.UserSelect;

const cardInclude = {
  author: { select: cardAuthorSelect },
  _count: { select: { likes: true, comments: true } },
} satisfies Prisma.BlogPostInclude;

function publishedWhere(): Prisma.BlogPostWhereInput {
  return {
    status: "PUBLISHED",
    publishedAt: { lte: new Date() },
    OR: [{ authorId: null }, { author: { status: "ACTIVE" } }],
  };
}

function reviveDate(value: Date | string) {
  return value instanceof Date ? value : new Date(value);
}

export async function getPublishedBlogs() {
  return unstable_cache(() => prisma.blogPost.findMany({
    where: publishedWhere(),
    include: cardInclude,
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
  }), ["published-blogs"], { tags: ["blogs"], revalidate: 300 })();
}

export async function getBlogIndexPage(requestedPage: number, pageSize = 9) {
  return unstable_cache(async () => {
    const where = publishedWhere();
    const totalCount = await prisma.blogPost.count({ where });
    const bounds = pageBounds(totalCount, requestedPage, pageSize);
    const [mostLiked, posts] = await Promise.all([
      prisma.blogPost.findMany({
        where: { ...where, likes: { some: {} } },
        include: cardInclude,
        orderBy: [{ likes: { _count: "desc" } }, { publishedAt: "desc" }, { id: "desc" }],
        take: 5,
      }),
      prisma.blogPost.findMany({
        where,
        include: cardInclude,
        orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
        skip: bounds.skip,
        take: pageSize,
      }),
    ]);
    return {
      mostLiked,
      posts,
      page: bounds.page,
      totalPages: bounds.totalPages,
    };
  }, ["blog-index", String(requestedPage), String(pageSize)], { tags: ["blogs"], revalidate: 300 })();
}

export async function getPublishedBlog(slug: string) {
  const post = await unstable_cache(() => prisma.blogPost.findFirst({
    where: { slug, ...publishedWhere() },
    include: {
      author: { select: detailAuthorSelect },
      _count: { select: { likes: true, comments: true } },
    },
  }), ["published-blog", slug], { tags: ["blogs"], revalidate: 300 })();
  return post ? {
    ...post,
    publishedAt: post.publishedAt ? reviveDate(post.publishedAt) : null,
    createdAt: reviveDate(post.createdAt),
    updatedAt: reviveDate(post.updatedAt),
  } : null;
}

export async function getBlogEngagement(postId: string, viewerId?: string) {
  const [likeCount, commentCount, viewerLike, newestComments] = await Promise.all([
    prisma.blogLike.count({ where: { postId } }),
    prisma.blogComment.count({ where: { postId, author: { status: "ACTIVE" } } }),
    viewerId ? prisma.blogLike.findUnique({ where: { postId_userId: { postId, userId: viewerId } }, select: { userId: true } }) : null,
    prisma.blogComment.findMany({
      where: { postId, author: { status: "ACTIVE" } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 100,
      include: { author: { select: cardAuthorSelect } },
    }),
  ]);
  return { likeCount, commentCount, viewerHasLiked: Boolean(viewerLike), comments: newestComments.reverse() };
}

export async function getNextAuthorBlog(post: { id: string; authorId: string | null; authorName: string; publishedAt: Date | null }) {
  return unstable_cache(async () => {
    const authorWhere: Prisma.BlogPostWhereInput = post.authorId
      ? { authorId: post.authorId }
      : { authorId: null, authorName: post.authorName };
    const commonWhere: Prisma.BlogPostWhereInput = { ...publishedWhere(), ...authorWhere, id: { not: post.id } };
    const older = post.publishedAt ? await prisma.blogPost.findFirst({
      where: { ...commonWhere, publishedAt: { lt: post.publishedAt } },
      select: { slug: true, title: true },
      orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    }) : null;
    return older ?? prisma.blogPost.findFirst({
      where: commonWhere,
      select: { slug: true, title: true },
      orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    });
  }, ["next-author-blog", post.id, post.authorId || post.authorName], { tags: ["blogs"], revalidate: 300 })();
}
