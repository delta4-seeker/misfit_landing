import Link from "next/link";

import type { ProductSummary } from "@/lib/types";
import { truncate } from "@/lib/utils";

export function ProductCard({ product }: { product: ProductSummary }) {
  return (
    <article className="product-card">
      <Link className="product-card-link" href={`/products/${product.slug}`}>
        <div className="product-logo-wrap">
          {product.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.logoUrl} alt={`${product.name} logo`} loading="lazy" />
          ) : <span aria-hidden="true">{product.name.slice(0, 1)}</span>}
          <span className="card-arrow" aria-hidden="true">↗</span>
        </div>
        <div className="product-card-meta">
          <span className="tag">{product.category.name}</span>
        </div>
        <h3 title={product.name}>{product.name}</h3>
        <p title={product.tagline}>{truncate(product.tagline, 50)}</p>
        <div className="product-card-stats" aria-label={`${product.upvoteCount} upvotes and ${product.commentCount} comments`}>
          <span>▲ {product.upvoteCount}</span><span>● {product.commentCount}</span>
        </div>
      </Link>
    </article>
  );
}
