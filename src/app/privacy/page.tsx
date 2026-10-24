import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return <article className="legal-page section-shell"><h1>Privacy.</h1><h2>What we collect</h2><p>We collect the profile information you choose to share, the Google account identity used to sign in, product listings, event and newsletter interactions, and basic service logs.</p><h2>How we use it</h2><p>We use this information to operate Misfit Founders Club, display founder and product profiles, secure the service, and communicate club updates you request.</p><h2>Your choices</h2><p>You may update your profile or ask us to remove your account and associated content by contacting the club administrator.</p></article>;
}
