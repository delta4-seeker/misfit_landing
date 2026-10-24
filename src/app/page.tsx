import Link from "next/link";

import { EventRow } from "@/components/event-row";
import { GalleryGrid } from "@/components/gallery-grid";
import { ProductCard } from "@/components/product-card";
import { subscribeNewsletter } from "@/app/actions";
import { getFeaturedProducts, getGallery, getNextEvent, getSiteSettings } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [products, event, photos, settings] = await Promise.all([
    getFeaturedProducts(), getNextEvent(), getGallery(6), getSiteSettings(),
  ]);
  return (
    <>
      <section className="hero section-shell">
        <div className="hero-copy">
          <h1>Built by misfits.</h1>
          <p>A high-trust club for founders who choose the harder path, build from Nepal, and think beyond every border.</p>
          <div className="button-row">
            <a className="btn btn-lime" href={settings.applyFormUrl || "/join"}>Apply to join <span>↗</span></a>
            <Link className="btn btn-outline" href="/products/new">List your product</Link>
          </div>
        </div>
      </section>

      <section className="about-section section-shell">
        <h2 className="section-title">Not a network. A room that gets it.</h2>
        <div className="principles-grid">
          <article><span>01</span><h3>Founder-first</h3><p>The room exists for the person carrying the weight, not the optics around them.</p></article>
          <article className="principle-lime"><span>02</span><h3>Nepal-rooted</h3><p>Local context is an advantage. Global ambition is the baseline.</p></article>
          <article><span>03</span><h3>Action-biased</h3><p>Generosity becomes useful introductions, sharp feedback, and momentum.</p></article>
        </div>
      </section>

      {products.length > 0 && (
        <section className="products-section section-shell">
          <div className="section-head"><h2>Proof that different works.</h2><Link className="btn btn-outline" href="/products">View all products</Link></div>
          <div className="product-grid">{products.map((product) => <ProductCard product={product} key={product.id} />)}</div>
        </section>
      )}

      {event && (
        <section className="home-events section-shell">
          <div className="section-head"><h2>What’s coming next.</h2></div>
          <EventRow event={event} />
        </section>
      )}

      {photos.length > 0 && (
        <section className="gallery-preview section-shell">
          <div className="section-head"><h2>The good stuff happens offline.</h2><Link className="text-link" href="/gallery">See the full gallery ↗</Link></div>
          <GalleryGrid photos={photos.slice(0, 4)} preview />
        </section>
      )}

      <section className="newsletter section-shell" id="newsletter">
        <h2>One good email. No noise.</h2>
        <form action={subscribeNewsletter}>
          <label className="sr-only" htmlFor="newsletter-email">Email address</label>
          <input id="newsletter-email" name="email" type="email" placeholder="you@example.com" required />
          <input className="hp-field" name="website" tabIndex={-1} autoComplete="off" />
          <button className="btn btn-dark" type="submit">Subscribe ↗</button>
        </form>
      </section>
    </>
  );
}
