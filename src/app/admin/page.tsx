import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  adminAddGalleryPhoto, adminReplaceGalleryPhoto, adminCreateCategory, adminCreateEvent, adminDelete, adminGrantAccess, adminRevokeAccess, adminSaveBlog, adminSaveTestimonial,
  adminDeleteWhatsAppImport, adminImportWhatsAppExport, adminLinkWhatsAppMember, adminSaveSettings, adminUpdateProduct, adminUpdateUser,
} from "@/app/actions";
import { auth } from "@/auth";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { CroppableImageInput } from "@/components/croppable-image-input";
import { SubmitButton } from "@/components/submit-button";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Club admin" };
export const dynamic = "force-dynamic";

const views = ["overview", "users", "products", "blogs", "testimonials", "engagement", "member-activity", "invitations", "categories", "events", "gallery", "newsletter", "settings", "admins", "audit"] as const;
type View = typeof views[number];
type AdminSearch = { view?: string; period?: string; group?: string; error?: string; imported?: string; skipped?: string; edit?: string; saved?: string };

export default async function AdminPage({ searchParams }: { searchParams: Promise<AdminSearch> }) {
  const session = await auth();
  if (!session?.user) redirect("/join?next=/admin");
  if (session.user.status !== "ACTIVE" || !session.user.isAdmin) notFound();
  const search = await searchParams;
  const requested = search.view;
  const view: View = views.includes(requested as View) ? requested as View : "overview";
  return (
    <section className="admin-shell section-shell">
      <aside className="admin-sidebar"><div><h1>Admin panel.</h1><span>{session.user.fullName || session.user.name}</span></div><nav>{views.filter((item) => item !== "admins" || session.user.isSuperAdmin).map((item) => <Link className={view === item ? "active" : ""} href={`/admin?view=${item}`} key={item}>{item.replaceAll("-", " ")}</Link>)}</nav></aside>
      <div className="admin-main">
        {view === "overview" && <AdminOverview />}
        {view === "users" && <AdminUsers actorId={session.user.id} />}
        {view === "products" && <AdminProducts />}
        {view === "blogs" && <AdminBlogs search={search} />}
        {view === "testimonials" && <AdminTestimonials search={search} />}
        {view === "engagement" && <AdminEngagement />}
        {view === "member-activity" && <AdminMemberActivity search={search} />}
        {view === "invitations" && <AdminInvitations />}
        {view === "categories" && <AdminCategories />}
        {view === "events" && <AdminEvents />}
        {view === "gallery" && <AdminGallery search={search} />}
        {view === "newsletter" && <AdminNewsletter />}
        {view === "settings" && <AdminSettings />}
        {view === "admins" && session.user.isSuperAdmin && <AdminAdmins />}
        {view === "audit" && <AdminAudit />}
      </div>
    </section>
  );
}

async function AdminMemberActivity({ search }: { search: AdminSearch }) {
  const period = search.period === "7d" || search.period === "30d" ? search.period : "all";
  const [clock] = await prisma.$queryRaw<Array<{ now: Date }>>`SELECT NOW() AS now`;
  const since = period === "7d" ? new Date(clock.now.getTime() - 7 * 86_400_000) : period === "30d" ? new Date(clock.now.getTime() - 30 * 86_400_000) : undefined;
  const groups = await prisma.whatsAppGroup.findMany({ orderBy: { name: "asc" } });
  const selectedGroup = groups.some((group) => group.id === search.group) ? search.group : undefined;
  const messageWhere = { deletedAt: null, ...(since ? { sentAt: { gte: since } } : {}), ...(selectedGroup ? { groupId: selectedGroup } : {}) };
  const reactionWhere = { removedAt: null, ...(since ? { reactedAt: { gte: since } } : {}), ...(selectedGroup ? { message: { groupId: selectedGroup } } : {}) };
  const [members, users, messageCounts, earnedCounts, givenCounts, connection, batches] = await Promise.all([
    prisma.whatsAppMember.findMany({ include: { linkedUser: { select: { id: true, fullName: true, name: true, email: true, profilePicture: true, image: true } } }, orderBy: [{ displayName: "asc" }, { createdAt: "asc" }] }),
    prisma.user.findMany({ where: { status: "ACTIVE" }, select: { id: true, fullName: true, name: true, email: true }, orderBy: [{ fullName: "asc" }, { email: "asc" }] }),
    prisma.whatsAppMessage.groupBy({ by: ["authorId"], where: messageWhere, _count: { _all: true }, _max: { sentAt: true } }),
    prisma.whatsAppReaction.groupBy({ by: ["recipientId"], where: reactionWhere, _count: { _all: true } }),
    prisma.whatsAppReaction.groupBy({ by: ["reactorId"], where: reactionWhere, _count: { _all: true } }),
    prisma.whatsAppConnectionState.findUnique({ where: { id: 1 } }),
    prisma.whatsAppImportBatch.findMany({ take: 8, include: { group: { select: { name: true } } }, orderBy: { createdAt: "desc" } }),
  ]);
  const messageMap = new Map(messageCounts.map((item) => [item.authorId, { count: item._count._all, lastActive: item._max.sentAt }]));
  const earnedMap = new Map(earnedCounts.map((item) => [item.recipientId, item._count._all]));
  const givenMap = new Map(givenCounts.map((item) => [item.reactorId, item._count._all]));
  const rows = members.map((member) => ({
    ...member,
    messages: messageMap.get(member.id)?.count || 0,
    lastActive: messageMap.get(member.id)?.lastActive || member.lastSeenAt,
    reactionsEarned: earnedMap.get(member.id) || 0,
    reactionsGiven: givenMap.get(member.id) || 0,
  })).sort((a, b) => b.messages - a.messages || b.reactionsEarned - a.reactionsEarned || (a.displayName || "").localeCompare(b.displayName || ""));
  const totalMessages = rows.reduce((sum, member) => sum + member.messages, 0);
  const totalReactions = rows.reduce((sum, member) => sum + member.reactionsEarned, 0);
  const activeMembers = rows.filter((member) => member.messages > 0).length;
  const unmatchedMembers = rows.filter((member) => !member.linkedUserId).length;
  const filterHref = (nextPeriod: string, group = selectedGroup) => `/admin?view=member-activity&period=${nextPeriod}${group ? `&group=${encodeURIComponent(group)}` : ""}`;
  const state = connection?.status || "NOT_CONFIGURED";

  return <>
    <AdminTitle title="Member activity." subtitle="Message participation and reactions earned in the club WhatsApp group." />
    {search.error && <div className="admin-notice admin-notice-error">{search.error}</div>}
    {search.imported && <div className="admin-notice">Imported {search.imported} new messages{Number(search.skipped || 0) ? ` and skipped ${search.skipped} duplicates` : ""}. Message contents were not stored.</div>}
    <section className="whatsapp-health admin-card">
      <div><span className={`connection-dot connection-${state.toLowerCase()}`} /><div><strong>{state.replaceAll("_", " ")}</strong><small>{connection?.lastEventAt ? `Last activity ${formatAdminDate(connection.lastEventAt)}` : "The live collector has not connected yet."}</small></div></div>
      <div className="privacy-note"><strong>Metadata only</strong><small>Messages, photos, documents and call content are never stored.</small></div>
    </section>
    <div className="stat-grid whatsapp-stats"><article className="stat-hero"><span>Messages</span><strong>{totalMessages}</strong></article><article><span>Reactions earned</span><strong>{totalReactions}</strong></article><article><span>Active members</span><strong>{activeMembers}</strong></article><article><span>Unmatched identities</span><strong>{unmatchedMembers}</strong></article></div>
    <section className="activity-toolbar">
      <nav aria-label="Activity period">{["7d", "30d", "all"].map((item) => <Link className={period === item ? "active" : ""} href={filterHref(item)} key={item}>{item === "all" ? "All time" : item}</Link>)}</nav>
      <form method="get"><input type="hidden" name="view" value="member-activity" /><input type="hidden" name="period" value={period} /><select className="field-input compact" name="group" defaultValue={selectedGroup || ""}><option value="">All groups</option>{groups.map((group) => <option value={group.id} key={group.id}>{group.name}</option>)}</select><button className="btn btn-dark btn-small" type="submit">Filter</button></form>
    </section>
    <section className="admin-card activity-table-card">
      <div className="table-wrap"><table><thead><tr><th>WhatsApp member</th><th>Portal profile</th><th>Messages</th><th>Earned</th><th>Given</th><th>Last active</th></tr></thead><tbody>{rows.length ? rows.map((member) => <tr key={member.id}><td><div className="activity-person"><span>{initials(member.displayName || member.phone || "?")}</span><div><strong>{member.displayName || member.phone || "Unknown member"}</strong><small>{member.phone || member.externalId.replace(/^import:/, "Imported · ").slice(0, 38)}</small></div></div></td><td><form className="member-link-form" action={adminLinkWhatsAppMember.bind(null, member.id)}><select className="field-input compact" name="linkedUserId" defaultValue={member.linkedUserId || ""}><option value="">Not matched</option>{users.map((user) => <option value={user.id} key={user.id}>{user.fullName || user.name || user.email || "Unnamed member"}</option>)}</select><button className="text-button" type="submit">Save</button></form></td><td><strong>{member.messages}</strong></td><td><strong>{member.reactionsEarned}</strong></td><td>{member.reactionsGiven}</td><td>{member.lastActive ? formatAdminDate(member.lastActive) : "—"}</td></tr>) : <tr><td colSpan={6}>No WhatsApp activity yet. Import an export below to begin.</td></tr>}</tbody></table></div>
    </section>
    <section className="whatsapp-setup-grid">
      <form className="admin-card whatsapp-import-form" action={adminImportWhatsAppExport}>
        <div><h2>Import existing activity</h2><p>In WhatsApp choose Export chat → Without media, unzip it, then upload the TXT file. Historical exports usually do not contain reliable reaction data.</p></div>
        <label className="form-field full">Group name<input className="field-input" name="groupName" defaultValue="Misfit Founders Club" required maxLength={120} /></label>
        <label className="form-field">Date order<select className="field-input" name="dateOrder" defaultValue="DMY"><option value="DMY">Day / month / year</option><option value="MDY">Month / day / year</option></select></label>
        <label className="form-field full">Chat TXT file<input className="field-input" name="chatExport" type="file" accept=".txt,text/plain" required /></label>
        <button className="btn btn-lime" type="submit">Import metadata</button>
      </form>
      <section className="admin-card import-history"><h2>Recent imports</h2>{batches.length ? batches.map((batch) => <div className="metric-row" key={batch.id}><div><strong>{batch.group.name}</strong><small>{batch.fileName || "WhatsApp export"} · {batch.importedMessages} new · {batch.skippedMessages} skipped</small></div><form action={adminDeleteWhatsAppImport.bind(null, batch.id)}><ConfirmSubmitButton className="text-button danger-button" message="Remove the activity added by this import? Live-collected data will stay intact.">Remove</ConfirmSubmitButton></form></div>) : <p>No imports yet.</p>}</section>
    </section>
  </>;
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

async function AdminBlogs({ search }: { search: AdminSearch }) {
  const posts = await prisma.blogPost.findMany({ orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }] });
  const editing = posts.find((post) => post.id === search.edit);
  return <>
    <AdminTitle title="Blogs." subtitle="Write field notes, save drafts, publish, edit, or remove articles." />
    {search.error && <p className="admin-notice admin-notice-error">{search.error}</p>}
    {search.saved && <p className="admin-notice">Blog post saved.</p>}
    <form className="panel-form blog-admin-form" action={adminSaveBlog} key={editing?.id || "new"}>
      <input type="hidden" name="id" value={editing?.id || ""} />
      <label className="form-field full">Title<input className="field-input" name="title" defaultValue={editing?.title || ""} required minLength={4} maxLength={160} /></label>
      <label className="form-field">Kicker (optional)<input className="field-input" name="kicker" defaultValue={editing?.kicker || ""} maxLength={80} placeholder="Field notes · 01" /></label>
      <label className="form-field">Author name<input className="field-input" name="authorName" defaultValue={editing?.authorName || ""} required minLength={2} maxLength={100} /></label>
      <label className="form-field full">Excerpt<textarea className="field-input" name="excerpt" defaultValue={editing?.excerpt || ""} required minLength={20} maxLength={320} rows={3} /></label>
      <CroppableImageInput name="coverImage" label="Cover image" kind="gallery" existingUrl={editing?.coverImageUrl || undefined} allowReplacement saveCropSeparately={false} compact="cover" />
      <label className="form-field full">Article body<textarea className="field-input blog-admin-body" name="body" defaultValue={editing?.body || ""} required minLength={100} maxLength={50000} rows={16} /><small>Separate paragraphs with a blank line. Use ## for headings, &gt; for quotes, and - for list items.</small></label>
      <label className="blog-publish-field"><input name="published" type="checkbox" defaultChecked={editing?.status === "PUBLISHED"} /> Publish on the public blog</label>
      <div className="blog-admin-actions"><SubmitButton className="btn btn-lime" pendingLabel="Saving article…">{editing ? "Save article" : "Create article"}</SubmitButton>{editing && <Link className="btn btn-outline" href="/admin?view=blogs">Cancel edit</Link>}</div>
    </form>
    <div className="admin-list">{posts.length ? posts.map((post) => <article className="admin-row blog-admin-row" key={post.id}>
      <div><strong>{post.title}</strong><small>{post.authorName} · {post.status === "PUBLISHED" ? "Published" : "Draft"} · Updated {formatAdminDate(post.updatedAt)}</small><p>{post.excerpt}</p></div>
      {post.status === "PUBLISHED" && <Link className="text-button" href={`/blog/${post.slug}`} target="_blank">View ↗</Link>}
      <Link className="text-button" href={`/admin?view=blogs&edit=${encodeURIComponent(post.id)}`}>Edit</Link>
      <form action={adminDelete.bind(null, "blog", post.id)}><ConfirmSubmitButton className="text-button danger-button" message={`Delete ${post.title}? This cannot be undone.`}>Delete</ConfirmSubmitButton></form>
    </article>) : <p className="comments-empty">No blog posts yet. Create the first article above.</p>}</div>
  </>;
}

async function AdminTestimonials({ search }: { search: AdminSearch }) {
  const testimonials = await prisma.testimonial.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  const editing = testimonials.find((testimonial) => testimonial.id === search.edit);
  return <>
    <AdminTitle title="Testimonials." subtitle="Add, edit, arrange, hide, or remove stories shown on the homepage." />
    {search.error && <p className="admin-notice admin-notice-error">{search.error}</p>}
    {search.saved && <p className="admin-notice">Testimonial saved.</p>}
    <form className="panel-form testimonial-admin-form" action={adminSaveTestimonial} key={editing?.id || "new"}>
      <input type="hidden" name="id" value={editing?.id || ""} />
      <label className="form-field">Name<input className="field-input" name="name" defaultValue={editing?.name || ""} required maxLength={100} /></label>
      <label className="form-field">Company<input className="field-input" name="company" defaultValue={editing?.company || ""} required maxLength={120} /></label>
      <label className="form-field">Role<input className="field-input" name="role" defaultValue={editing?.role || ""} required maxLength={160} /></label>
      <label className="form-field">Display order<input className="field-input" name="sortOrder" type="number" min="0" max="10000" defaultValue={editing?.sortOrder ?? testimonials.length + 1} required /></label>
      <label className="form-field full">Message<textarea className="field-input" name="quote" defaultValue={editing?.quote || ""} required minLength={40} maxLength={2000} rows={5} /></label>
      <CroppableImageInput name="photo" label="Photo" kind="gallery" existingUrl={editing?.photoUrl || undefined} allowReplacement saveCropSeparately={false} compact="avatar" required={!editing?.photoUrl} />
      <label className="testimonial-active-field"><input name="active" type="checkbox" defaultChecked={editing?.active ?? true} /> Show on homepage</label>
      <div className="testimonial-admin-actions"><SubmitButton className="btn btn-lime" pendingLabel="Saving testimonial…">{editing ? "Save testimonial" : "Add testimonial"}</SubmitButton>{editing && <Link className="btn btn-outline" href="/admin?view=testimonials">Cancel edit</Link>}</div>
    </form>
    <div className="admin-list">{testimonials.map((testimonial) => <article className="admin-row testimonial-admin-row" key={testimonial.id}>
      <div className="testimonial-admin-person">{testimonial.photoUrl ? <Image src={testimonial.photoUrl} alt="" width={54} height={54} unoptimized /> : <span>{initials(testimonial.name)}</span>}<div><strong>{testimonial.name} {testimonial.id.startsWith("preview-") && <span className="tag admin-test-tag">Sample</span>}</strong><small>{testimonial.role} · {testimonial.company || "Company not set"} · Order {testimonial.sortOrder} · {testimonial.active ? "Visible" : "Hidden"}</small><p>{testimonial.quote}</p></div></div>
      <Link className="text-button" href={`/admin?view=testimonials&edit=${encodeURIComponent(testimonial.id)}`}>Edit</Link>
      <form action={adminDelete.bind(null, "testimonial", testimonial.id)}><ConfirmSubmitButton className="text-button danger-button" message={`Delete the testimonial by ${testimonial.name}?`}>Delete</ConfirmSubmitButton></form>
    </article>)}</div>
  </>;
}

async function AdminGallery({ search }: { search: AdminSearch }) {
  const photos = await prisma.galleryPhoto.findMany({ orderBy: { createdAt: "desc" } });
  return <><AdminTitle title="Gallery." subtitle="Click an existing photo to crop it, or add a new one." />{search.error && <p className="admin-notice admin-notice-error" role="alert">{search.error}</p>}{search.saved && <p className="admin-notice" role="status">Gallery photo saved.</p>}<form className="admin-card inline-form" action={adminAddGalleryPhoto}><CroppableImageInput name="image" label="Photo" kind="gallery" required /><SubmitButton className="btn btn-lime" pendingLabel="Uploading…">Add photo</SubmitButton></form><div className="admin-gallery-grid">{photos.map((photo, index) => <figure key={photo.id}>
    <form action={adminReplaceGalleryPhoto.bind(null, photo.id)}><CroppableImageInput name="image" label={`Crop gallery photo ${index + 1}`} kind="gallery" existingUrl={photo.imageUrl} displayUrl={photo.thumbnailUrl || photo.imageUrl} /></form>
    <div className="admin-gallery-actions"><span>{photo.id.startsWith("test-") && <span className="tag admin-test-tag">Test data</span>}</span><form action={adminDelete.bind(null, "photo", photo.id)}><ConfirmSubmitButton className="text-button danger-button" message="Delete this gallery photo?">Delete</ConfirmSubmitButton></form></div>
  </figure>)}</div></>;
}

async function AdminNewsletter() {
  const subscribers = await prisma.newsletterSubscriber.findMany({ orderBy: { createdAt: "desc" } });
  return <><AdminTitle title="Newsletter." subtitle="The opted-in club list." /><div className="admin-list">{subscribers.map((subscriber) => <div className="admin-row" key={subscriber.id}><div><strong>{subscriber.email} {isTestRecord(subscriber.email) && <span className="tag admin-test-tag">Test data</span>}</strong><small>{new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(subscriber.createdAt)}</small></div><span className={`status ${subscriber.active ? "status-active" : ""}`}>{subscriber.active ? "Active" : "Unsubscribed"}</span><form action={adminDelete.bind(null, "subscriber", subscriber.id)}><ConfirmSubmitButton className="text-button danger-button" message={`Remove ${subscriber.email} from the newsletter list?`}>Remove</ConfirmSubmitButton></form></div>)}</div></>;
}

async function AdminSettings() {
  const settings = await prisma.siteSettings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
  return <><AdminTitle title="Site settings." subtitle="Links shared across the public experience." /><form className="panel-form" action={adminSaveSettings}><label className="form-field full">Application form URL<input className="field-input" name="applyFormUrl" type="url" defaultValue={settings.applyFormUrl || ""} /></label><label className="form-field">Instagram URL<input className="field-input" name="instagramUrl" type="url" defaultValue={settings.instagramUrl || ""} /></label><label className="form-field">LinkedIn URL<input className="field-input" name="linkedinUrl" type="url" defaultValue={settings.linkedinUrl || ""} /></label><label className="form-field full">Contact email<input className="field-input" name="contactEmail" type="email" defaultValue={settings.contactEmail || ""} /></label><SubmitButton className="btn btn-lime" pendingLabel="Saving…">Save settings</SubmitButton></form></>;
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

function initials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts.at(-1)![0]}` : parts[0]?.slice(0, 2) || "?").toUpperCase();
}

function formatAdminDate(value: Date) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(value);
}
