import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { googleSignIn } from "@/app/actions";

export const metadata: Metadata = { title: "Join Club" };
export const dynamic = "force-dynamic";

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect("/");
  const { error } = await searchParams;
  return (
    <section className="auth-layout section-shell">
      <div className="auth-art"><strong>M</strong><p>One honest room can change the trajectory of the work.</p></div>
      <div className="auth-card">
        <h1>Join Club.</h1>
        <p>Use Google to join or return to the club.</p>
        {error === "database" && (
          <p className="form-error" role="alert">
            Supabase is not connected yet. Add DATABASE_URL and DIRECT_URL to .env.local, then restart the app.
          </p>
        )}
        <form action={googleSignIn}><button className="google-button" type="submit"><span className="google-g">G</span>Continue with Google <b>↗</b></button></form>
        <small>By continuing, you agree to the <a href="/terms">Terms</a> and <a href="/privacy">Privacy Policy</a>.</small>
      </div>
    </section>
  );
}
