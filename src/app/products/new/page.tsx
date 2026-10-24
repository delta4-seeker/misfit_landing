import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { createProduct } from "@/app/actions";
import { getCategories } from "@/lib/data";
import { incompleteProfileMessage, profileCompletion } from "@/lib/profile";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "List a product" };
export const dynamic = "force-dynamic";

export default async function NewProductPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/join?next=/products/new");
  const currentUser = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!currentUser) redirect("/join");
  if (currentUser.status !== "ACTIVE") redirect("/profile");
  const completion = profileCompletion(currentUser);
  if (!completion.complete) redirect(`/profile?error=${encodeURIComponent(incompleteProfileMessage(completion.missing))}`);
  const [categories, { error }] = await Promise.all([getCategories(), searchParams]);
  return (
    <section className="form-layout section-shell">
      <div className="form-intro"><h1>List your product.</h1><p>Show the club what you’re building. Keep the writing specific and useful.</p></div>
      <form className="panel-form" action={createProduct}>
        {error && <p className="form-error" role="alert">{error}</p>}
        <label className="form-field">Product name<input className="field-input" name="name" required maxLength={80} /></label>
        <label className="form-field">Company name<input className="field-input" name="companyName" maxLength={80} /></label>
        <label className="form-field">Website URL<input className="field-input" name="websiteUrl" type="url" required placeholder="https://" /></label>
        <label className="form-field">Category<select className="field-input" name="categoryId" required><option value="">Choose one</option>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label>
        <label className="form-field full">Tagline<input className="field-input" name="tagline" required maxLength={100} /></label>
        <label className="form-field full">Description<textarea className="field-input" name="description" required maxLength={300} rows={5} /></label>
        <label className="form-field full">Co-founder emails<textarea className="field-input" name="cofounderEmails" rows={2} placeholder="name@example.com, another@example.com" /><small>Optional. We’ll create private invitation links you can share.</small></label>
        <label className="form-field">LinkedIn URL<input className="field-input" name="linkedinUrl" type="url" placeholder="https://linkedin.com/company/..." /></label>
        <label className="form-field">Instagram handle<input className="field-input" name="instagramHandle" placeholder="yourproduct" /></label>
        <label className="form-field">Founder type<input className="field-input" name="founderType" placeholder="Solo founder, co-founders…" /></label>
        <label className="form-field">Logo<input className="field-input" name="logo" type="file" accept="image/jpeg,image/png,image/webp" /><small>Square, at least 256px · max 2 MB</small></label>
        <label className="form-field">Founded month<input className="field-input" name="foundedMonth" type="number" min="1" max="12" /></label>
        <label className="form-field">Founded year<input className="field-input" name="foundedYear" type="number" min="1900" max={new Date().getFullYear()} /></label>
        <label className="form-field-check"><input type="checkbox" name="builtInNepal" defaultChecked /> Built in Nepal</label>
        <div className="form-actions"><button className="btn btn-lime" type="submit">Publish product ↗</button></div>
      </form>
    </section>
  );
}
