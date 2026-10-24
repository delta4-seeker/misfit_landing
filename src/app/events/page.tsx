import type { Metadata } from "next";

import { EventRow } from "@/components/event-row";
import { getEvents } from "@/lib/data";

export const metadata: Metadata = { title: "Events" };
export const dynamic = "force-dynamic";

export default async function EventsPage() {
  const events = await getEvents();
  const now = new Date();
  const upcoming = events.filter((event) => event.startsAt >= now);
  const past = events.filter((event) => event.startsAt < now).reverse();
  return (
    <div className="events-page section-shell">
      <h1 className="page-title">What’s next.</h1>
      <section className="events-list">
        {upcoming.length ? upcoming.map((event) => <EventRow event={event} key={event.id} />) : <p className="empty-state">The next room is being planned.</p>}
      </section>
      {past.length > 0 && <section className="past-events"><h2>Already happened.</h2><div className="past-grid">{past.map((event) => <a href={event.lumaUrl} target="_blank" rel="noreferrer" key={event.id}><span>{new Intl.DateTimeFormat("en", { day: "2-digit", month: "short", year: "numeric" }).format(event.startsAt)}</span><h3>{event.title}</h3><p>{event.venue}</p></a>)}</div></section>}
    </div>
  );
}
