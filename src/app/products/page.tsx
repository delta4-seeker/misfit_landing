import type { Metadata } from "next";
import Link from "next/link";

import { ProductCard } from "@/components/product-card";
import { Pagination } from "@/components/pagination";
import { getCategories, getProductsPage } from "@/lib/data";
import { parsePage } from "@/lib/pagination";

export const metadata: Metadata = { title: "Nepal-built products" };
export const dynamic = "force-dynamic";

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ category?: string; page?: string }> }) {
  const { category, page: pageParam } = await searchParams;
  const [categories, listing] = await Promise.all([getCategories(), getProductsPage(category, parsePage(pageParam))]);
  return (
    <>
      <header className="page-heading section-shell">
        <h1>Built here. Used everywhere.</h1>
        <p>Discover technology and SaaS products made by founders who call Nepal home.</p>
        <Link className="btn btn-lime" href="/products/new">List your product ↗</Link>
      </header>
      <section className="listing-section section-shell">
        <div className="filter-row" aria-label="Product categories">
          <Link className={!category ? "active" : ""} href="/products">All</Link>
          {categories.map((item) => <Link className={category === item.slug ? "active" : ""} href={`/products?category=${item.slug}`} key={item.id}>{item.name}</Link>)}
        </div>
        {listing.products.length ? <div className="product-grid">{listing.products.map((product) => <ProductCard product={product} key={product.id} />)}</div> : <p className="empty-state">No products in this category yet.</p>}
        <Pagination page={listing.page} totalPages={listing.totalPages} basePath="/products" query={{ category }} />
      </section>
    </>
  );
}
