"use client";

import type { EventSummary } from "@/lib/types";
import { useEffect, useState } from "react";

function remaining(date: Date) {
  const milliseconds = Math.max(0, new Date(date).getTime() - Date.now());
  return {
    days: Math.floor(milliseconds / 86_400_000),
    hours: Math.floor(milliseconds / 3_600_000) % 24,
    minutes: Math.floor(milliseconds / 60_000) % 60,
  };
}

export function EventRow({ event }: { event: EventSummary }) {
  const [countdown, setCountdown] = useState(() => remaining(event.startsAt));
  useEffect(() => {
    const timer = window.setInterval(() => setCountdown(remaining(event.startsAt)), 60_000);
    return () => window.clearInterval(timer);
  }, [event.startsAt]);

  const date = new Date(event.startsAt);
  return (
    <article className="event-row">
      <a className="event-art" href={event.lumaUrl} target="_blank" rel="noreferrer" aria-label={`Register for ${event.title}`}>
        {event.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={event.coverImageUrl} alt="" />
        ) : <span className="event-mark">M</span>}
        <strong>{new Intl.DateTimeFormat("en", { day: "2-digit", month: "short" }).format(date)}</strong>
      </a>
      <div className="event-copy">
        <div className="event-topline"><span>{new Intl.DateTimeFormat("en", { weekday: "long", hour: "numeric", minute: "2-digit" }).format(date)}</span><span>{event.priceNpr ? `NPR ${event.priceNpr}` : "Free"}</span></div>
        <div>
          <h3><a href={event.lumaUrl} target="_blank" rel="noreferrer">{event.title}</a></h3>
          <p>{event.description}</p>
        </div>
        <div className="event-row-bottom">
          <span>{event.venue}</span>
          <div className="compact-countdown" aria-label={`${countdown.days} days, ${countdown.hours} hours and ${countdown.minutes} minutes remaining`}>
            <b>{countdown.days}d</b><b>{countdown.hours}h</b><b>{countdown.minutes}m</b>
          </div>
          <a className="btn btn-dark btn-small" href={event.lumaUrl} target="_blank" rel="noreferrer">Register ↗</a>
        </div>
      </div>
    </article>
  );
}
