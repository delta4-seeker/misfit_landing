import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { logOut } from "@/app/actions";
import { ProductCard } from "@/components/product-card";
import { ProfileAvatar } from "@/components/profile-avatar";
import { getFounder } from "@/lib/data";
import { instagramUrl } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const result = await getFounder((await params).slug);
  return result ? { title: result.founder.name } : {};
}

export default async function FounderPage({ params }: { params: Promise<{ slug: string }> }) {
  const [result, session] = await Promise.all([getFounder((await params).slug), auth()]);
  if (!result) notFound();
  const { founder, products } = result;
  const ownProfile = session?.user.id === founder.id;
  return (
    <>
      <header className="founder-hero section-shell">
        <div className="founder-portrait">
          <ProfileAvatar className="founder-avatar" src={founder.image} alt={`${founder.name} profile picture`} />
        </div>
        <div className="founder-copy">
          <h1>{founder.name}</h1>
          <div className="founder-socials" aria-label={`${founder.name} social links`}>
            {founder.linkedinUrl && <a href={founder.linkedinUrl} target="_blank" rel="noreferrer" aria-label={`View ${founder.name} on LinkedIn`}><span className="social-icon">in</span><strong>View profile</strong><span>↗</span></a>}
            {founder.instagramHandle && <a href={instagramUrl(founder.instagramHandle)} target="_blank" rel="noreferrer" aria-label={`View @${founder.instagramHandle} on Instagram`}><span className="social-icon instagram-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.25" y="3.25" width="17.5" height="17.5" rx="5" /><circle cx="12" cy="12" r="4" /><circle className="instagram-dot" cx="17.4" cy="6.7" r="1" /></svg></span><strong>@{founder.instagramHandle}</strong><span>↗</span></a>}
          </div>
          {ownProfile && <div className="profile-actions">{session.user.isAdmin && <Link className="btn btn-dark" href="/admin">Admin panel</Link>}<Link className="btn btn-outline" href="/profile">Edit profile</Link><Link className="btn btn-lime" href="/products/new">List a product</Link><form action={logOut}><button className="text-button" type="submit">Log out</button></form></div>}
        </div>
      </header>
      {products.length > 0 && <section className="founder-products section-shell"><div className="section-head"><h2>Products they’re building.</h2></div><div className="product-grid">{products.map((product) => <ProductCard product={product} key={product.id} />)}</div></section>}
    </>
  );
}
