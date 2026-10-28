import Link from "next/link";
import { connection } from "next/server";

import { getSiteSettings } from "@/lib/data";
import { DEFAULT_LUMA_CALENDAR_URL } from "@/lib/luma";

export async function Footer() {
  // Site settings are request-time data. Static pages must build without querying production.
  await connection();
  const settings = await getSiteSettings();
  const { instagramUrl, linkedinUrl } = settings ?? {};
  const lumaCalendarUrl = settings?.lumaCalendarUrl || DEFAULT_LUMA_CALENDAR_URL;
  return (
    <footer className="site-footer">
      <div className="footer-grid">
        <div className="footer-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/img/misfit-mark.png" alt="Misfit" width="64" height="64" />
          <p>Built in Nepal.<br />Thinking without borders.</p>
        </div>
        <div><span className="footer-label">Explore</span><Link href="/products">Products</Link><a href={lumaCalendarUrl} target="_blank" rel="noopener noreferrer">Events ↗</a><Link href="/gallery">Gallery</Link><Link href="/blog">Blog</Link></div>
        <div><span className="footer-label">Club</span><Link href="/join">Join Club</Link><Link href="/#newsletter">Newsletter</Link></div>
        <div><span className="footer-label">Social links</span>{instagramUrl && <a href={instagramUrl} target="_blank" rel="noopener noreferrer">Instagram ↗</a>}{linkedinUrl && <a href={linkedinUrl} target="_blank" rel="noopener noreferrer">LinkedIn ↗</a>}</div>
        <div><span className="footer-label">Legal</span><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></div>
      </div>
      <div className="footer-bottom"><span>© {new Date().getFullYear()} Misfit Founders Club</span><span>For founders who refuse the default.</span></div>
    </footer>
  );
}
