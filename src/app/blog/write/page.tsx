import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { deleteMemberBlog, saveMemberBlog } from "@/app/actions";
import { auth } from "@/auth";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { CroppableImageInput } from "@/components/croppable-image-input";
import { SubmitButton } from "@/components/submit-button";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Write a story", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function WriteBlogPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; error?: string; saved?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect(`/join?next=${encodeURIComponent("/blog/write")}`);
  if (session.user.status !== "ACTIVE") redirect("/profile");
  const { edit, error, saved } = await searchParams;
  const posts = await prisma.blogPost.findMany({
    where: { authorId: session.user.id },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    include: { _count: { select: { likes: true, comments: true } } },
  });
  const post = edit ? posts.find((candidate) => candidate.id === edit) : null;
  if (edit && !post) notFound();

  return (
    <section className="blog-editor section-shell">
      <header className="blog-editor-head">
        <span>Community publishing</span>
        <h1>{post ? "Edit your story." : "Share what you learned."}</h1>
        <p>Keep it useful, honest, and easy to read. Draft privately or publish when it is ready.</p>
      </header>
      {error && <p className="form-error" role="alert">{error}</p>}
      {saved && <p className="success-note" role="status">Draft saved. Only you can see it until you publish it.</p>}
      <form className="panel-form blog-member-form" action={saveMemberBlog}>
        <input type="hidden" name="id" value={post?.id || ""} />
        <label className="form-field full">Title
          <input className="field-input" name="title" defaultValue={post?.title || ""} minLength={4} maxLength={160} required placeholder="A clear title that says what the reader will learn" />
        </label>
        <label className="form-field full">Short summary
          <textarea className="field-input" name="excerpt" defaultValue={post?.excerpt || ""} minLength={20} maxLength={320} rows={3} required placeholder="Two or three sentences for the blog listing." />
        </label>
        <CroppableImageInput name="coverImage" label="Banner image" kind="gallery" fixedAspect="landscape" existingUrl={post?.coverImageUrl || undefined} allowReplacement saveCropSeparately={false} compact="cover" required={!post?.coverImageUrl} />
        <label className="form-field full">Story
          <textarea className="field-input blog-admin-body" name="body" defaultValue={post?.body || ""} minLength={100} maxLength={50000} rows={18} required placeholder="Write the story here…" />
          <small>Separate paragraphs with a blank line. Use ## for headings, &gt; for quotes, and - for list items.</small>
        </label>
        <label className="blog-publish-field"><input name="published" type="checkbox" defaultChecked={post?.status === "PUBLISHED"} /> Publish this story for the community</label>
        <div className="blog-editor-actions">
          <SubmitButton className="btn btn-lime" pendingLabel="Saving story…">{post ? "Save changes" : "Save story"}</SubmitButton>
          <Link className="btn btn-outline" href="/blog/write#your-writing">Cancel</Link>
        </div>
      </form>
      <section className="profile-writing" id="your-writing" aria-labelledby="your-writing-title">
        <div className="profile-writing-head"><div><span>Community blog</span><h2 id="your-writing-title">Your writing.</h2></div>{post && <Link className="btn btn-lime" href="/blog/write">New story ↗</Link>}</div>
        {posts.length ? <div className="profile-writing-list">{posts.map((story) => (
          <article className="profile-writing-row" key={story.id}>
            <div><span className={`status${story.status === "PUBLISHED" ? " status-active" : ""}`}>{story.status === "PUBLISHED" ? "Published" : "Draft"}</span><h3>{story.title}</h3><p>Updated {formatWritingDate(story.updatedAt)} · {story._count.likes} likes · {story._count.comments} comments</p></div>
            <div className="profile-writing-actions">{story.status === "PUBLISHED" && <Link className="text-button" href={`/blog/${story.slug}`}>View</Link>}<Link className="text-button" href={`/blog/write?edit=${encodeURIComponent(story.id)}`}>Edit</Link><form action={deleteMemberBlog.bind(null, story.id)}><ConfirmSubmitButton className="text-button danger-button" message={`Delete “${story.title}”? This cannot be undone.`}>Delete</ConfirmSubmitButton></form></div>
          </article>
        ))}</div> : <div className="comments-empty">You have not written a story yet. Share a lesson, decision, or hard-earned insight with the community.</div>}
      </section>
    </section>
  );
}

function formatWritingDate(value: Date) {
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" }).format(value);
}
