import Link from "next/link";
import Image from "next/image";

import type { ProductSummary } from "@/lib/types";
import { truncate } from "@/lib/utils";

export function ProductCard({ product, linkTabIndex }: { product: ProductSummary; linkTabIndex?: number }) {
  return (
    <article className="product-card">
      <Link className="product-card-link" href={`/products/${product.slug}`} tabIndex={linkTabIndex}>
        <div className="product-logo-wrap">
          {product.logoUrl ? (
            <Image src={product.logoUrl} alt={`${product.name} logo`} width={320} height={320} sizes="(max-width: 760px) 45vw, 25vw" />
          ) : <span aria-hidden="true">{product.name.slice(0, 1)}</span>}
          <span className="card-arrow" aria-hidden="true">↗</span>
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
