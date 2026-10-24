import type { Metadata } from "next";
import Link from "next/link";

import { ProductCard } from "@/components/product-card";
import { getCategories, getProducts } from "@/lib/data";

export const metadata: Metadata = { title: "Nepal-built products" };
export const dynamic = "force-dynamic";

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const { category } = await searchParams;
  const [categories, products] = await Promise.all([getCategories(), getProducts(category)]);
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
        {products.length ? <div className="product-grid">{products.map((product) => <ProductCard product={product} key={product.id} />)}</div> : <p className="empty-state">No products in this category yet.</p>}
      </section>
    </>
  );
}
