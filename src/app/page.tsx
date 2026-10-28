import Link from "next/link";

import { GalleryGrid } from "@/components/gallery-grid";
import { ProductRail } from "@/components/product-rail";
import { TestimonialRail } from "@/components/testimonial-rail";
import { SubmitButton } from "@/components/submit-button";
import { subscribeNewsletter } from "@/app/actions";
import { getGallery, getHomepageProducts, getSiteSettings, getTestimonials } from "@/lib/data";
import { DEFAULT_LUMA_CALENDAR_URL } from "@/lib/luma";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [products, photos, testimonials, settings] = await Promise.all([
    getHomepageProducts(), getGallery(6), getTestimonials(), getSiteSettings(),
  ]);
  const lumaEventId = settings?.homepageLumaEventId;
  const lumaEventUrl = settings?.homepageLumaEventUrl;
  const featuredEvent = lumaEventUrl && lumaEventId && /^evt-[A-Za-z0-9_-]+$/.test(lumaEventId)
    ? { url: lumaEventUrl, id: lumaEventId }
    : null;
  const lumaCalendarUrl = settings?.lumaCalendarUrl || DEFAULT_LUMA_CALENDAR_URL;
  return (
    <>
      <section className="hero section-shell">
        <div className="hero-copy">
          <h1>Built by misfits.</h1>
          <p>A high-trust club for founders who choose the harder path, build from Nepal, and think beyond every border.</p>
          <div className="button-row">
            <Link className="btn btn-outline" href="/products/new">List your product</Link>
          </div>
        </div>
      </section>

      <section className="think-different-section section-shell" id="think-different" aria-label="Think Different campaign quote">
        <div className="think-different-card">
          <div className="think-different-symbol" aria-hidden="true">“</div>
          <div className="think-different-copy">
            <blockquote>
              <p>“Here’s to the crazy ones. The misfits. The rebels. The troublemakers. The round pegs in the square holes. The ones who see things differently. They’re not fond of rules. And they have no respect for the status quo. You can quote them, disagree with them, glorify or vilify them. About the only thing you can’t do is ignore them. Because they change things. They push the human race forward. And while some may see them as the crazy ones, we see genius. Because the people who are crazy enough to think they can change the world, are the ones who do.”</p>
            </blockquote>
            <p className="think-different-credit">Apple · Think Different campaign (1997)</p>
          </div>
        </div>
      </section>

      {products.length > 0 && <ProductRail products={products} />}

      {testimonials.length > 0 && <TestimonialRail testimonials={testimonials} />}

      <section className="luma-event-section section-shell" id="upcoming-event" aria-labelledby="upcoming-event-title">
        <div className="section-head">
          <h2 id="upcoming-event-title">See you in the room.</h2>
          <a className="text-link" href={lumaCalendarUrl} target="_blank" rel="noopener noreferrer">All events ↗</a>
        </div>
        {featuredEvent ? <>
          <div className="luma-event-frame">
            <iframe src={`https://luma.com/embed/event/${featuredEvent.id}/simple`} title="Upcoming Misfit Founders Club event on Luma" loading="lazy" referrerPolicy="strict-origin-when-cross-origin" />
          </div>
          <a className="btn btn-outline" href={featuredEvent.url} target="_blank" rel="noopener noreferrer">Full event details on Luma ↗</a>
        </> : <div className="luma-event-empty">
          <p>Our next gathering is on its way.</p>
          <a className="btn btn-outline" href={lumaCalendarUrl} target="_blank" rel="noopener noreferrer">View the Luma calendar ↗</a>
        </div>}
      </section>

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
          <SubmitButton className="btn btn-dark" pendingLabel="Subscribing…">Subscribe ↗</SubmitButton>
        </form>
      </section>
    </>
  );
}
