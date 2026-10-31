import type { MetadataRoute } from "next";

import { getPublishedBlogs } from "@/lib/blog";
import { getProducts } from "@/lib/data";
import { absoluteUrl } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, blogs] = await Promise.all([getProducts(), getPublishedBlogs()]);
  const staticPages = ["", "/products", "/events", "/gallery", "/blog", "/join", "/privacy", "/terms"];
  return [
    ...staticPages.map((path) => ({ url: absoluteUrl(path), lastModified: new Date() })),
    ...products.map((product) => ({ url: absoluteUrl(`/products/${product.slug}`), lastModified: new Date() })),
    ...blogs.map((post) => ({ url: absoluteUrl(`/blog/${post.slug}`), lastModified: post.updatedAt })),
  ];
}
