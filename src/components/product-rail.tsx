"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

import { ProductCard } from "@/components/product-card";
import type { ProductSummary } from "@/lib/types";

const SCROLL_SPEED = 32;

export function ProductRail({ products }: { products: ProductSummary[] }) {
  const railRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  const focusedRef = useRef(false);
  const manualPauseUntilRef = useRef(0);
  const directionRef = useRef<1 | -1>(1);
  const hasMultipleProducts = products.length > 1;

  useEffect(() => {
    const rail = railRef.current;
    if (!rail || !hasMultipleProducts) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let previousTime = 0;

    function animate(time: number) {
      if (!rail) return;
      const elapsed = previousTime ? Math.min(time - previousTime, 50) : 0;
      previousTime = time;

      if (!pausedRef.current && !focusedRef.current && time >= manualPauseUntilRef.current && !document.hidden && !reducedMotion.matches) {
        const maxScroll = rail.scrollWidth - rail.clientWidth;
        if (maxScroll > 0) {
          const next = rail.scrollLeft + (directionRef.current * elapsed * SCROLL_SPEED) / 1000;
          if (next >= maxScroll) {
            rail.scrollLeft = maxScroll;
            directionRef.current = -1;
          } else if (next <= 0) {
            rail.scrollLeft = 0;
            directionRef.current = 1;
          } else {
            rail.scrollLeft = next;
          }
        }
      }

      frame = window.requestAnimationFrame(animate);
    }

    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, [hasMultipleProducts]);

  function move(direction: -1 | 1) {
    const rail = railRef.current;
    if (!rail) return;

    const first = rail.children[0] as HTMLElement | undefined;
    const second = rail.children[1] as HTMLElement | undefined;
    const distance = first && second ? second.offsetLeft - first.offsetLeft : first?.offsetWidth || rail.clientWidth;
    directionRef.current = direction;
    manualPauseUntilRef.current = performance.now() + 1100;
    rail.scrollBy({
      left: direction * distance,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
    });
  }

  return (
    <section
      className="products-section section-shell"
      aria-labelledby="homepage-products-title"
    >
      <div className="section-head product-rail-heading">
        <h2 id="homepage-products-title">Proof that different works.</h2>
        <div className="product-rail-actions">
          {hasMultipleProducts && <div className="testimonial-controls" aria-label="Scroll products">
            <button type="button" onClick={() => move(-1)} aria-label="Previous products">←</button>
            <button type="button" onClick={() => move(1)} aria-label="Next products">→</button>
          </div>}
          <Link className="btn btn-outline" href="/products">View all products</Link>
        </div>
      </div>
      <div
        className="product-rail"
        ref={railRef}
        tabIndex={0}
        aria-label="Products, scroll horizontally"
        onFocusCapture={() => { focusedRef.current = true; }}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) focusedRef.current = false;
        }}
        onTouchStart={() => { manualPauseUntilRef.current = performance.now() + 3000; }}
      >
        {products.map((product) => (
          <div
            className="product-rail-item"
            key={product.id}
            onMouseEnter={() => { pausedRef.current = true; }}
            onMouseLeave={() => { pausedRef.current = false; }}
          >
            <ProductCard product={product} />
          </div>
        ))}
      </div>
    </section>
  );
}
