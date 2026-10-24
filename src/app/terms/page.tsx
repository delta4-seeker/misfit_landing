import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms" };

export default function TermsPage() {
  return <article className="legal-page section-shell"><h1>Terms.</h1><h2>Keep it honest</h2><p>Submit only information and media you have the right to share. Product listings should accurately represent what is being built and who is building it.</p><h2>Respect the room</h2><p>Harassment, impersonation, spam, and misuse of founder information are not welcome. Accounts or listings may be suspended when they put the community at risk.</p><h2>Service changes</h2><p>The club may update, pause, or change parts of this service as the community evolves.</p></article>;
}
