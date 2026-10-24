import Link from "next/link";

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-grid">
        <div className="footer-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/img/misfit-mark.png" alt="Misfit" width="64" height="64" />
          <p>Built in Nepal.<br />Thinking without borders.</p>
        </div>
        <div><span className="footer-label">Explore</span><Link href="/products">Products</Link><Link href="/events">Events</Link><Link href="/gallery">Gallery</Link></div>
        <div><span className="footer-label">Club</span><Link href="/join">Join Club</Link><Link href="/#newsletter">Newsletter</Link></div>
        <div><span className="footer-label">Legal</span><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></div>
      </div>
      <div className="footer-bottom"><span>© {new Date().getFullYear()} Misfit Founders Club</span><span>For founders who refuse the default.</span></div>
    </footer>
  );
}
