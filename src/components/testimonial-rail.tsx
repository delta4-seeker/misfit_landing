"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";

import type { TestimonialSummary } from "@/lib/types";

const LOOP_COPIES = 4;
const SCROLL_SPEED = 32;

export function TestimonialRail({ testimonials }: { testimonials: TestimonialSummary[] }) {
  const railRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  const focusedRef = useRef(false);
  const manualPauseUntilRef = useRef(0);
  const looping = testimonials.length > 1;

  useEffect(() => {
    const rail = railRef.current;
    if (!rail || !looping) return;

    const cycleWidth = getCycleWidth(rail, testimonials.length);
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
  }, [looping, testimonials.length]);

  function move(direction: -1 | 1) {
    const rail = railRef.current;
    if (!rail) return;

    const card = rail.querySelector<HTMLElement>(".testimonial-card");
    const distance = card ? card.offsetWidth + 16 : rail.clientWidth;
    const cycleWidth = looping ? getCycleWidth(rail, testimonials.length) : 0;
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
      className="testimonial-section section-shell"
      id="testimonials"
      aria-labelledby="testimonials-title"
      onMouseEnter={() => { pausedRef.current = true; }}
      onMouseLeave={() => { pausedRef.current = false; }}
      onFocusCapture={() => { focusedRef.current = true; }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) focusedRef.current = false;
      }}
      onPointerUpCapture={() => { focusedRef.current = false; }}
      onTouchStart={() => { manualPauseUntilRef.current = performance.now() + 3000; }}
    >
      <div className="section-head testimonial-heading">
        <div>
          <p className="testimonial-eyebrow">From the room</p>
          <h2 id="testimonials-title">Good company. Better momentum.</h2>
        </div>
        <div className="testimonial-controls" aria-label="Scroll testimonials">
          <button type="button" onClick={() => move(-1)} aria-label="Previous testimonials">←</button>
          <button type="button" onClick={() => move(1)} aria-label="Next testimonials">→</button>
        </div>
      </div>
      <div className="testimonial-rail" ref={railRef} tabIndex={0} aria-label="Testimonials, scroll horizontally">
        {Array.from({ length: looping ? LOOP_COPIES : 1 }, (_, copy) =>
          testimonials.map((testimonial, index) => (
            <article
              className={`testimonial-card${index % 2 ? " testimonial-card-accent" : ""}`}
              key={`${copy}-${testimonial.id}`}
              aria-hidden={looping && copy !== 1}
            >
              <div className="testimonial-person">
                {testimonial.photoUrl ? <Image src={testimonial.photoUrl} alt="" width={50} height={50} unoptimized /> : <span className="testimonial-initials" aria-hidden="true">{testimonial.name.slice(0, 1)}</span>}
                <div><strong>{testimonial.name}</strong><span>{testimonial.role} · {testimonial.company}</span></div>
              </div>
              <blockquote><span className="testimonial-mark" aria-hidden="true">“</span><p>{testimonial.quote}</p></blockquote>
            </article>
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
