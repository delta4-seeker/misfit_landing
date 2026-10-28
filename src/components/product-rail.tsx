"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

import { ProductCard } from "@/components/product-card";
import type { ProductSummary } from "@/lib/types";

const LOOP_COPIES = 4;
const SCROLL_SPEED = 32;

export function ProductRail({ products }: { products: ProductSummary[] }) {
  const railRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  const focusedRef = useRef(false);
  const manualPauseUntilRef = useRef(0);
  const looping = products.length > 1;

  useEffect(() => {
    const rail = railRef.current;
    if (!rail || !looping) return;

    const cycleWidth = getCycleWidth(rail, products.length);
    if (!cycleWidth) return;
    rail.scrollLeft = cycleWidth;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let previousTime = 0;

    function animate(time: number) {
      if (!rail) return;
      const elapsed = previousTime ? Math.min(time - previousTime, 50) : 0;
      previousTime = time;

      if (!pausedRef.current && !focusedRef.current && time >= manualPauseUntilRef.current && !document.hidden && !reducedMotion.matches) {
        let next = rail.scrollLeft + (elapsed * SCROLL_SPEED) / 1000;
        if (next >= cycleWidth * 2) next -= cycleWidth;
        if (next < cycleWidth) next += cycleWidth;
        rail.scrollLeft = next;
      }

      frame = window.requestAnimationFrame(animate);
    }

    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, [looping, products.length]);

  function move(direction: -1 | 1) {
    const rail = railRef.current;
    if (!rail) return;

    const first = rail.children[0] as HTMLElement | undefined;
    const second = rail.children[1] as HTMLElement | undefined;
    const distance = first && second ? second.offsetLeft - first.offsetLeft : first?.offsetWidth || rail.clientWidth;
    const cycleWidth = looping ? getCycleWidth(rail, products.length) : 0;
    if (cycleWidth) {
      if (direction < 0 && rail.scrollLeft < cycleWidth) rail.scrollLeft += cycleWidth;
      if (direction > 0 && rail.scrollLeft >= cycleWidth * 2) rail.scrollLeft -= cycleWidth;
    }

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
      onMouseEnter={() => { pausedRef.current = true; }}
      onMouseLeave={() => { pausedRef.current = false; }}
      onFocusCapture={() => { focusedRef.current = true; }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) focusedRef.current = false;
      }}
      onTouchStart={() => { manualPauseUntilRef.current = performance.now() + 3000; }}
    >
      <div className="section-head product-rail-heading">
        <h2 id="homepage-products-title">Proof that different works.</h2>
        <div className="product-rail-actions">
          {looping && <div className="testimonial-controls" aria-label="Scroll products">
            <button type="button" onClick={() => move(-1)} aria-label="Previous products">←</button>
            <button type="button" onClick={() => move(1)} aria-label="Next products">→</button>
          </div>}
          <Link className="btn btn-outline" href="/products">View all products</Link>
        </div>
      </div>
      <div className="product-rail" ref={railRef} tabIndex={0} aria-label="Products, scroll horizontally">
        {Array.from({ length: looping ? LOOP_COPIES : 1 }, (_, copy) =>
          products.map((product) => (
            <div className="product-rail-item" key={`${copy}-${product.id}`} aria-hidden={looping && copy !== 1}>
              <ProductCard product={product} linkTabIndex={looping && copy !== 1 ? -1 : undefined} />
            </div>
          )),
        )}
      </div>
    </section>
  );
}

function getCycleWidth(rail: HTMLDivElement, count: number) {
  const first = rail.children[0] as HTMLElement | undefined;
  const secondCopy = rail.children[count] as HTMLElement | undefined;
  return first && secondCopy ? secondCopy.offsetLeft - first.offsetLeft : 0;
}
