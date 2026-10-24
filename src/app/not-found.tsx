import Link from "next/link";

export default function NotFound() {
  return <section className="error-page section-shell"><strong>404</strong><h1>That room isn’t here.</h1><p>The page may have moved, or it never made it out of the notebook.</p><Link className="btn btn-lime" href="/">Go home ↗</Link></section>;
}
