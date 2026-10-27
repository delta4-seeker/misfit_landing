export default function Loading() {
  return <section className="route-loading section-shell" role="status" aria-live="polite">
    <span className="route-loading-spinner" aria-hidden="true" />
    <span>Loading page…</span>
  </section>;
}
