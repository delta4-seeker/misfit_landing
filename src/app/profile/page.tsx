import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { logOut, saveProfile } from "@/app/actions";
import { ProfileAvatar } from "@/components/profile-avatar";
import { SubmitButton } from "@/components/submit-button";
import { profileCompletion } from "@/lib/profile";
import { prisma } from "@/lib/prisma";
import { displayName, founderSlug } from "@/lib/utils";

export const metadata: Metadata = { title: "Your profile" };
export const dynamic = "force-dynamic";

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/join?next=/profile");
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) redirect("/join");
  const { error, saved } = await searchParams;
  if (user.status !== "ACTIVE") {
    return (
      <section className="profile-form-layout section-shell account-status-card">
        <h1>Account unavailable.</h1>
        <p className="form-error" role="alert">This account is {user.status.toLowerCase()}. Profile and community changes are disabled.</p>
        <form action={logOut}><button className="btn btn-dark" type="submit">Log out</button></form>
      </section>
    );
  }
  const image = user.profilePicture || user.image;
  const completion = profileCompletion(user);
  return (
    <section className="profile-form-layout section-shell">
      <h1>{completion.complete ? "Edit your profile." : "Complete your profile."}</h1>
      {completion.complete && <Link className="text-link" href={`/founders/${founderSlug(displayName(user), user.id)}`}>View your public profile ↗</Link>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {saved && <p className="success-note" role="status">Your profile changes have been saved.</p>}
      <p className="profile-form-note">{completion.complete
        ? "Update any detail you want to change."
        : "Everything is optional to save. Complete every detail and add a profile picture before listing a product."}</p>
      <form className="panel-form" action={saveProfile}>
        <div className="profile-photo-field">
          <label className="profile-photo-picker">
            <ProfileAvatar className="profile-photo-preview" src={image} alt="Current profile picture" />
            <span className="profile-photo-add" aria-hidden="true">+</span>
            <span className="sr-only">Upload profile picture</span>
            <input className="profile-photo-input" type="file" name="profilePicture" accept="image/jpeg,image/png,image/webp" />
          </label>
          <small>JPG, PNG or WebP · max 5 MB</small>
        </div>
        <label className="form-field">Full name<input className="field-input" name="fullName" defaultValue={user.fullName || user.name || ""} maxLength={100} /></label>
        <label className="form-field">Phone<input className="field-input" name="phone" defaultValue={user.phone || ""} inputMode="tel" /></label>
        <label className="form-field">LinkedIn URL<input className="field-input" name="linkedinUrl" type="url" defaultValue={user.linkedinUrl || ""} placeholder="https://linkedin.com/in/you" /></label>
        <label className="form-field">Instagram handle<input className="field-input" name="instagramHandle" defaultValue={user.instagramHandle || ""} placeholder="yourhandle" /></label>
        {!completion.complete && <p className="profile-completion-note"><strong>Required before listing a product:</strong> {completion.missing.join(", ")}.</p>}
        <label className="form-field full">Email<input className="field-input" type="email" value={user.email ?? ""} readOnly autoComplete="email" /></label>
        <div className="form-actions"><SubmitButton className="btn btn-lime" pendingLabel="Saving…">Save profile ↗</SubmitButton></div>
      </form>
    </section>
  );
}
