import Link from "next/link";

export default function UnsubscribedPage() {
  return <section className="confirm-card section-shell"><span className="warning-mark">✓</span><h1>You’re unsubscribed.</h1><p>No noise. You can join the list again from the homepage whenever you want.</p><Link className="btn btn-lime" href="/">Back home</Link></section>;
}
