import type { MetadataRoute } from "next";

import { getProducts } from "@/lib/data";
import { absoluteUrl } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await getProducts();
  const staticPages = ["", "/products", "/events", "/gallery", "/join", "/privacy", "/terms"];
  return [
    ...staticPages.map((path) => ({ url: absoluteUrl(path), lastModified: new Date() })),
    ...products.map((product) => ({ url: absoluteUrl(`/products/${product.slug}`), lastModified: new Date() })),
  ];
}
