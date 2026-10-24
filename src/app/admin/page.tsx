import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  adminAddGalleryPhoto, adminCreateCategory, adminCreateEvent, adminDelete, adminGrantAccess, adminRevokeAccess,
  adminSaveSettings, adminUpdateProduct, adminUpdateUser,
} from "@/app/actions";
import { auth } from "@/auth";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Club admin" };
export const dynamic = "force-dynamic";

const views = ["overview", "users", "products", "engagement", "invitations", "categories", "events", "gallery", "newsletter", "settings", "admins", "audit"] as const;
type View = typeof views[number];

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/join?next=/admin");
  if (session.user.status !== "ACTIVE" || !session.user.isAdmin) notFound();
  const requested = (await searchParams).view;
  const view: View = views.includes(requested as View) ? requested as View : "overview";
  return (
    <section className="admin-shell section-shell">
      <aside className="admin-sidebar"><div><h1>Admin panel.</h1><span>{session.user.fullName || session.user.name}</span></div><nav>{views.filter((item) => item !== "admins" || session.user.isSuperAdmin).map((item) => <Link className={view === item ? "active" : ""} href={`/admin?view=${item}`} key={item}>{item}</Link>)}</nav></aside>
      <div className="admin-main">
        {view === "overview" && <AdminOverview />}
        {view === "users" && <AdminUsers actorId={session.user.id} />}
        {view === "products" && <AdminProducts />}
        {view === "engagement" && <AdminEngagement />}
        {view === "invitations" && <AdminInvitations />}
        {view === "categories" && <AdminCategories />}
        {view === "events" && <AdminEvents />}
        {view === "gallery" && <AdminGallery />}
        {view === "newsletter" && <AdminNewsletter />}
        {view === "settings" && <AdminSettings />}
        {view === "admins" && session.user.isSuperAdmin && <AdminAdmins />}
        {view === "audit" && <AdminAudit />}
      </div>
    </section>
  );
}

async function AdminOverview() {
  const [users, products, events, photos, subscribers, upvotes, comments, categories] = await Promise.all([
    prisma.user.count(), prisma.product.count(), prisma.event.count({ where: { startsAt: { gte: new Date() } } }),
    prisma.galleryPhoto.count(), prisma.newsletterSubscriber.count({ where: { active: true } }),
    prisma.productVote.count(), prisma.productComment.count(),
    prisma.category.findMany({ include: { _count: { select: { products: true } } }, orderBy: { sortOrder: "asc" } }),
  ]);
  return <><AdminTitle title="Community pulse." subtitle="The live state of the club." /><div className="stat-grid"><article className="stat-hero"><span>Founders</span><strong>{users}</strong></article><article><span>Products</span><strong>{products}</strong></article><article><span>Upvotes</span><strong>{upvotes}</strong></article><article><span>Comments</span><strong>{comments}</strong></article><article><span>Upcoming events</span><strong>{events}</strong></article><article><span>Photos</span><strong>{photos}</strong></article><article><span>Subscribers</span><strong>{subscribers}</strong></article></div><section className="admin-card"><h2>Products by category</h2>{categories.map((category) => <div className="metric-row" key={category.id}><span>{category.name}</span><b>{category._count.products}</b></div>)}</section></>;
}

async function AdminUsers({ actorId }: { actorId: string }) {
  const users = await prisma.user.findMany({ orderBy: { createdAt: "desc" } });
  return <><AdminTitle title="Users." subtitle="Suspend, restore, or remove member access." /><div className="admin-list">{users.map((user) => <form className="admin-row user-admin-row" action={adminUpdateUser} key={user.id}><input type="hidden" name="id" value={user.id} /><div><strong>{user.fullName || user.name || "Incomplete profile"} {isTestRecord(user.email) && <span className="tag admin-test-tag">Test data</span>}</strong><small>{user.email} · {user.profileCompleted ? "Complete profile" : "Incomplete profile"}{user.isAdmin ? " · Admin" : ""}</small></div><select className="field-input compact" name="status" defaultValue={user.status}><option>ACTIVE</option><option>SUSPENDED</option><option>BANNED</option></select><button className="btn btn-dark btn-small" type="submit">Save</button>{user.id !== actorId && !user.isSuperAdmin && <ConfirmSubmitButton className="text-button danger-button" formAction={adminDelete.bind(null, "user", user.id)} message={`Delete ${user.email || "this member"}? Their products, votes, comments, sessions, and connected records will also be removed.`}>Delete</ConfirmSubmitButton>}</form>)}</div></>;
}

async function AdminProducts() {
  const products = await prisma.product.findMany({ include: { owner: true, category: true }, orderBy: { createdAt: "desc" } });
  return <><AdminTitle title="Products." subtitle="Control visibility and club signals." /><div className="admin-list">{products.map((product) => <form className="admin-row product-admin-row" action={adminUpdateProduct} key={product.id}><input type="hidden" name="id" value={product.id} /><div><strong>{product.name} {isTestRecord(product.owner.email) && <span className="tag admin-test-tag">Test data</span>}</strong><small>{product.owner.fullName || product.owner.email} · {product.category.name}</small></div><select className="field-input compact" name="status" defaultValue={product.status}><option>DRAFT</option><option>LIVE</option><option>HIDDEN</option></select><label><input type="checkbox" name="exclusive" defaultChecked={product.exclusive} /> Exclusive</label><label><input type="checkbox" name="featured" defaultChecked={product.featured} /> Featured</label><input className="field-input compact number-input" name="featuredOrder" type="number" defaultValue={product.featuredOrder} /><button className="btn btn-dark btn-small" type="submit">Save</button><ConfirmSubmitButton className="text-button danger-button" formAction={adminDelete.bind(null, "product", product.id)} message={`Delete ${product.name} and all of its votes, comments, and invitations?`}>Delete</ConfirmSubmitButton></form>)}</div></>;
}

async function AdminEngagement() {
  const [products, comments] = await Promise.all([
    prisma.product.findMany({ include: { _count: { select: { votes: true, comments: true } } }, orderBy: [{ featured: "desc" }, { name: "asc" }] }),
    prisma.productComment.findMany({ take: 100, include: { author: true, product: true }, orderBy: { createdAt: "desc" } }),
  ]);
  return <><AdminTitle title="Engagement." subtitle="Review product signals and moderate the latest comments." /><section className="admin-card engagement-metrics"><h2>Product signals</h2>{products.map((product) => <div className="metric-row" key={product.id}><span>{product.name}</span><b>▲ {product._count.votes} · ● {product._count.comments}</b></div>)}</section><div className="admin-list"><h2>Latest comments</h2>{comments.length ? comments.map((comment) => <div className="admin-row engagement-admin-row" key={comment.id}><div><strong>{comment.author.fullName || comment.author.name || comment.author.email} {isTestRecord(comment.author.email) && <span className="tag admin-test-tag">Test data</span>}</strong><small>{comment.product.name} · {new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(comment.createdAt)}</small><p>{comment.body}</p></div><form action={adminDelete.bind(null, "comment", comment.id)}><ConfirmSubmitButton className="text-button danger-button" message="Delete this comment?">Delete</ConfirmSubmitButton></form></div>) : <p className="comments-empty">No comments yet.</p>}</div></>;
}

async function AdminInvitations() {
  const invitations = await prisma.coFounderInvite.findMany({ include: { product: true, acceptedUser: true }, orderBy: { createdAt: "desc" } });
  return <><AdminTitle title="Invitations." subtitle="Inspect and clean up every co-founder invitation state." /><div className="admin-list">{invitations.length ? invitations.map((invite) => <div className="admin-row invitation-admin-row" key={invite.id}><div><strong>{invite.email} {isTestRecord(invite.email) && <span className="tag admin-test-tag">Test data</span>}</strong><small>{invite.product.name}{invite.acceptedUser ? ` · ${invite.acceptedUser.fullName || invite.acceptedUser.email}` : ""} · Expires {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(invite.expiresAt)}</small></div><span className={`status ${invite.status === "ACCEPTED" ? "status-active" : ""}`}>{invite.status}</span><form action={adminDelete.bind(null, "invitation", invite.id)}><ConfirmSubmitButton className="text-button danger-button" message={`Delete the ${invite.status.toLowerCase()} invitation for ${invite.email}?`}>Delete</ConfirmSubmitButton></form></div>) : <p className="comments-empty">No co-founder invitations.</p>}</div></>;
}

async function AdminCategories() {
  const categories = await prisma.category.findMany({ include: { _count: { select: { products: true } } }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  return <><AdminTitle title="Categories." subtitle="Keep the product taxonomy useful." /><form className="admin-card inline-form" action={adminCreateCategory}><input className="field-input" name="name" placeholder="Category name" required /><input className="field-input number-input" name="sortOrder" type="number" defaultValue="0" /><button className="btn btn-lime" type="submit">Add category</button></form><div className="admin-list">{categories.map((category) => <div className="admin-row" key={category.id}><div><strong>{category.name}</strong><small>{category._count.products} products</small></div><span>{category.sortOrder}</span><form action={adminDelete.bind(null, "category", category.id)}><ConfirmSubmitButton className="text-button danger-button" disabled={category._count.products > 0} message={`Delete the ${category.name} category?`}>Delete</ConfirmSubmitButton></form></div>)}</div></>;
}

async function AdminEvents() {
  const events = await prisma.event.findMany({ orderBy: { startsAt: "asc" } });
  return <><AdminTitle title="Events." subtitle="Create a registration-first Luma listing." /><form className="panel-form admin-card" action={adminCreateEvent}><label className="form-field">Title<input className="field-input" name="title" required /></label><label className="form-field">Starts<input className="field-input" name="startsAt" type="datetime-local" required /></label><label className="form-field">Venue<input className="field-input" name="venue" required /></label><label className="form-field">Luma URL<input className="field-input" name="lumaUrl" type="url" required /></label><label className="form-field full">Description<textarea className="field-input" name="description" required rows={3} /></label><label className="form-field">Capacity<input className="field-input" name="capacity" type="number" min="0" /></label><label className="form-field">Price NPR<input className="field-input" name="priceNpr" type="number" min="0" step="0.01" /></label><label className="form-field full">Cover image<input className="field-input" name="coverImage" type="file" accept="image/jpeg,image/png,image/webp" /></label><button className="btn btn-lime" type="submit">Create event</button></form><div className="admin-list">{events.map((event) => <div className="admin-row" key={event.id}><div><strong>{event.title} {event.slug.startsWith("test-") && <span className="tag admin-test-tag">Test data</span>}</strong><small>{new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(event.startsAt)} · {event.venue}</small></div><a href={event.lumaUrl} target="_blank" rel="noreferrer">Registration ↗</a><form action={adminDelete.bind(null, "event", event.id)}><ConfirmSubmitButton className="text-button danger-button" message={`Delete ${event.title}?`}>Delete</ConfirmSubmitButton></form></div>)}</div></>;
}

async function AdminGallery() {
  const photos = await prisma.galleryPhoto.findMany({ orderBy: { createdAt: "desc" } });
  return <><AdminTitle title="Gallery." subtitle="Keep the camera roll human and current." /><form className="admin-card inline-form" action={adminAddGalleryPhoto}><input className="field-input" name="image" type="file" accept="image/jpeg,image/png,image/webp" required /><input className="field-input" name="caption" placeholder="Caption" maxLength={180} /><button className="btn btn-lime" type="submit">Add photo</button></form><div className="admin-gallery-grid">{photos.map((photo) => <figure key={photo.id}>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={photo.thumbnailUrl || photo.imageUrl} alt="" />
    <figcaption><span>{photo.caption || "Untitled"} {photo.id.startsWith("test-") && <span className="tag admin-test-tag">Test data</span>}</span><form action={adminDelete.bind(null, "photo", photo.id)}><ConfirmSubmitButton className="text-button danger-button" message="Delete this gallery photo?">Delete</ConfirmSubmitButton></form></figcaption>
  </figure>)}</div></>;
}

async function AdminNewsletter() {
  const subscribers = await prisma.newsletterSubscriber.findMany({ orderBy: { createdAt: "desc" } });
  return <><AdminTitle title="Newsletter." subtitle="The opted-in club list." /><div className="admin-list">{subscribers.map((subscriber) => <div className="admin-row" key={subscriber.id}><div><strong>{subscriber.email} {isTestRecord(subscriber.email) && <span className="tag admin-test-tag">Test data</span>}</strong><small>{new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(subscriber.createdAt)}</small></div><span className={`status ${subscriber.active ? "status-active" : ""}`}>{subscriber.active ? "Active" : "Unsubscribed"}</span><form action={adminDelete.bind(null, "subscriber", subscriber.id)}><ConfirmSubmitButton className="text-button danger-button" message={`Remove ${subscriber.email} from the newsletter list?`}>Remove</ConfirmSubmitButton></form></div>)}</div></>;
}

async function AdminSettings() {
  const settings = await prisma.siteSettings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
  return <><AdminTitle title="Site settings." subtitle="Links shared across the public experience." /><form className="panel-form" action={adminSaveSettings}><label className="form-field full">Application form URL<input className="field-input" name="applyFormUrl" type="url" defaultValue={settings.applyFormUrl || ""} /></label><label className="form-field">Instagram URL<input className="field-input" name="instagramUrl" type="url" defaultValue={settings.instagramUrl || ""} /></label><label className="form-field">LinkedIn URL<input className="field-input" name="linkedinUrl" type="url" defaultValue={settings.linkedinUrl || ""} /></label><label className="form-field full">Contact email<input className="field-input" name="contactEmail" type="email" defaultValue={settings.contactEmail || ""} /></label><button className="btn btn-lime" type="submit">Save settings</button></form></>;
}

async function AdminAdmins() {
  const admins = await prisma.user.findMany({ where: { OR: [{ isAdmin: true }, { isSuperAdmin: true }] }, orderBy: { email: "asc" } });
  return <><AdminTitle title="Admins." subtitle="Grant or revoke access by verified Google email." /><form className="admin-card inline-form" action={adminGrantAccess}><input className="field-input" name="email" type="email" placeholder="founder@example.com" required /><button className="btn btn-lime" type="submit">Grant access</button></form><div className="admin-list">{admins.map((person) => <div className="admin-row" key={person.id}><div><strong>{person.fullName || person.name || person.email}</strong><small>{person.email}</small></div><span className="tag">{person.isSuperAdmin ? "Super admin" : "Admin"}</span>{!person.isSuperAdmin && <form action={adminRevokeAccess.bind(null, person.id)}><ConfirmSubmitButton className="text-button danger-button" message={`Revoke admin access for ${person.email}?`}>Revoke</ConfirmSubmitButton></form>}</div>)}</div></>;
}

async function AdminAudit() {
  const logs = await prisma.auditLog.findMany({ take: 100, include: { actor: true }, orderBy: { createdAt: "desc" } });
  return <><AdminTitle title="Audit log." subtitle="The latest 100 administrative changes." /><div className="admin-list">{logs.map((log) => <div className="admin-row audit-row" key={log.id}><div><strong>{log.action.replaceAll("_", " ")}</strong><small>{log.targetType} · {log.targetId} · {log.actor?.email || "System"}</small></div><time>{new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(log.createdAt)}</time></div>)}</div></>;
}

function AdminTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return <div className="admin-title"><div><h1>{title}</h1><p>{subtitle}</p></div></div>;
}

function isTestRecord(email?: string | null) {
  return email?.toLowerCase().startsWith("test+") ?? false;
}
