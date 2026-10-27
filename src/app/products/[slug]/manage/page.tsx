import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { deleteProduct, inviteCofounder, revokeCofounderInvite, updateProduct } from "@/app/actions";
import { CroppableImageInput } from "@/components/croppable-image-input";
import { SubmitButton } from "@/components/submit-button";
import { getCategories } from "@/lib/data";
import { prisma } from "@/lib/prisma";
import { absoluteUrl } from "@/lib/utils";

export const metadata: Metadata = { title: "Manage product" };
export const dynamic = "force-dynamic";

export default async function ManageProductPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ error?: string; invited?: string }> }) {
  const { slug } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/join?next=/products/${slug}/manage`);
  if (session.user.status !== "ACTIVE") notFound();
  const [product, categories, query] = await Promise.all([
    prisma.product.findUnique({ where: { slug }, include: { invites: { orderBy: { createdAt: "desc" } } } }),
    getCategories(), searchParams,
  ]);
  if (!product) notFound();
  if (product.ownerId !== session.user.id) notFound();
  return (
    <section className="manage-layout section-shell">
      <div className="section-head"><div><Link className="back-link" href={`/products/${slug}`}>← Product page</Link><h1>Manage {product.name}.</h1></div></div>
      {query.error && <p className="form-error" role="alert">{query.error}</p>}
      {query.invited && <p className="success-note">Invitation created. Copy its private link below.</p>}
      <div className="manage-grid">
        <form className="panel-form" action={updateProduct.bind(null, slug)}>
          <label className="form-field">Product name<input className="field-input" name="name" required maxLength={80} defaultValue={product.name} /></label>
          <label className="form-field">Company name<input className="field-input" name="companyName" maxLength={80} defaultValue={product.companyName || ""} /></label>
          <label className="form-field">Website URL<input className="field-input" name="websiteUrl" type="url" required defaultValue={product.websiteUrl} /></label>
          <label className="form-field">Category<select className="field-input" name="categoryId" required defaultValue={product.categoryId}>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label>
          <label className="form-field full">Tagline<input className="field-input" name="tagline" required maxLength={100} defaultValue={product.tagline} /></label>
          <label className="form-field full">Description<textarea className="field-input" name="description" required maxLength={300} rows={5} defaultValue={product.description} /></label>
          <label className="form-field">LinkedIn URL<input className="field-input" name="linkedinUrl" type="url" defaultValue={product.linkedinUrl || ""} /></label>
          <label className="form-field">Instagram handle<input className="field-input" name="instagramHandle" defaultValue={product.instagramHandle || ""} /></label>
          <label className="form-field">Founder type<select className="field-input" name="founderType" defaultValue={product.founderType || ""}><option value="">Choose one</option>{product.founderType && !["Solo founder", "Co-founders", "Founding team"].includes(product.founderType) && <option value={product.founderType}>{product.founderType}</option>}<option value="Solo founder">Solo founder</option><option value="Co-founders">Co-founders</option><option value="Founding team">Founding team</option></select></label>
          <CroppableImageInput name="logo" label="Logo" kind="logo" existingUrl={product.logoUrl || undefined} allowReplacement saveCropSeparately={false} compact="logo" />
          <label className="form-field">Founded month<input className="field-input" name="foundedMonth" type="number" min="1" max="12" defaultValue={product.foundedMonth || ""} /></label>
          <label className="form-field">Founded year<input className="field-input" name="foundedYear" type="number" min="1900" max={new Date().getFullYear()} defaultValue={product.foundedYear || ""} /></label>
          <div className="form-actions"><SubmitButton className="btn btn-lime" pendingLabel="Saving…">Save changes ↗</SubmitButton></div>
        </form>
        <aside className="manage-side">
          <section className="admin-card"><h2>Co-founders</h2><form className="stack-form" action={inviteCofounder.bind(null, slug)}><label>Email<input className="field-input" type="email" name="email" required /></label><button className="btn btn-dark btn-small" type="submit">Create invite ↗</button></form>{product.invites.map((invite) => <article className="invite-row" key={invite.id}><div><strong>{invite.email}</strong><small>{invite.status.toLowerCase()} · expires {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(invite.expiresAt)}</small>{invite.status === "PENDING" && <code>{absoluteUrl(`/invites/${invite.token}`)}</code>}</div>{invite.status !== "REVOKED" && <form action={revokeCofounderInvite.bind(null, slug, invite.id)}><button className="text-button" type="submit">Revoke</button></form>}</article>)}</section>
          <section className="danger-card"><h2>Remove listing</h2><p>This permanently removes the product and its invitations.</p><form action={deleteProduct.bind(null, slug)}><button className="btn btn-dark" type="submit">Delete product</button></form></section>
        </aside>
      </div>
    </section>
  );
}
