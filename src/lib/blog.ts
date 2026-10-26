import "server-only";

import { unstable_cache } from "next/cache";

import { pageBounds } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";

const publishedWhere = () => ({
  status: "PUBLISHED" as const,
  publishedAt: { lte: new Date() },
});

export async function getPublishedBlogs() {
  return unstable_cache(() => prisma.blogPost.findMany({
    where: publishedWhere(),
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
  }), ["published-blogs"], { tags: ["blogs"], revalidate: 300 })();
}

export async function getPublishedBlogsPage(requestedPage: number, pageSize = 6) {
  return unstable_cache(async () => {
    const totalCount = await prisma.blogPost.count({ where: publishedWhere() });
    const bounds = pageBounds(totalCount, requestedPage, pageSize);
    const posts = await prisma.blogPost.findMany({
      where: publishedWhere(),
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      skip: bounds.skip,
      take: pageSize,
    });
    return { posts, page: bounds.page, totalPages: bounds.totalPages };
  }, ["published-blogs-page", String(requestedPage), String(pageSize)], { tags: ["blogs"], revalidate: 300 })();
}

export async function getPublishedBlog(slug: string) {
  return unstable_cache(() => prisma.blogPost.findFirst({ where: { slug, ...publishedWhere() } }),
    ["published-blog", slug], { tags: ["blogs"], revalidate: 300 })();
}

export async function getBlogNavigation(slug: string) {
  return unstable_cache(async () => {
    const posts = await prisma.blogPost.findMany({
      where: publishedWhere(),
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      select: { slug: true, title: true, excerpt: true, publishedAt: true, readingMinutes: true },
    });
    const index = posts.findIndex((post) => post.slug === slug);
    return {
      previous: index >= 0 ? posts[index + 1] ?? null : null,
      next: index > 0 ? posts[index - 1] : null,
      other: posts.filter((post) => post.slug !== slug).slice(0, 3),
    };
  }, ["blog-navigation", slug], { tags: ["blogs"], revalidate: 300 })();
}
