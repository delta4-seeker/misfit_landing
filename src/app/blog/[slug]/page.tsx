import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { createBlogComment, deleteBlogComment, toggleBlogLike } from "@/app/actions";
import { auth } from "@/auth";
import { ProfileAvatar } from "@/components/profile-avatar";
import { SubmitButton } from "@/components/submit-button";
import { getBlogEngagement, getNextAuthorBlog, getPublishedBlog } from "@/lib/blog";
import { displayName, founderSlug, profileImage } from "@/lib/utils";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ commentError?: string; commentPosted?: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const post = await getPublishedBlog((await params).slug);
  if (!post) return { title: "Article not found" };
  const author = post.author ? displayName(post.author) : post.authorName;
  return {
    title: post.title,
    description: post.excerpt,
    authors: [{ name: author }],
    openGraph: {
      type: "article",
      title: post.title,
      description: post.excerpt,
      publishedTime: post.publishedAt?.toISOString(),
      authors: [author],
      images: post.coverImageUrl ? [post.coverImageUrl] : undefined,
    },
  };
}

export default async function BlogDetailPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const [post, session, query] = await Promise.all([getPublishedBlog(slug), auth(), searchParams]);
  if (!post) notFound();
  const [engagement, nextPost] = await Promise.all([getBlogEngagement(post.id, session?.user.id), getNextAuthorBlog(post)]);
  const authorName = post.author ? displayName(post.author) : post.authorName;
  const authorImage = post.author ? profileImage(post.author) : null;
  const authorHref = post.author ? `/founders/${founderSlug(authorName, post.author.id)}` : null;
  const product = post.author?.products[0] ?? post.author?.coFoundedProducts[0] ?? null;
  const canInteract = session?.user.status === "ACTIVE";
  const joinHref = `/join?next=${encodeURIComponent(`/blog/${post.slug}#discussion`)}`;

  return (
    <article className="blog-article-minimal section-shell">
      <div className="blog-reading-column">
        <Link className="blog-all-link" href="/blog">← Community blog</Link>
        <header className="blog-minimal-head">
          <h1>{post.title}</h1>
          <p>{post.excerpt}</p>
          <div className="blog-author-row">
            {authorHref ? <Link href={authorHref}><ProfileAvatar className="blog-author-avatar" src={authorImage} alt={`${authorName} profile picture`} /></Link> : <ProfileAvatar className="blog-author-avatar" src={authorImage} alt="" />}
            <div><strong>{authorHref ? <Link href={authorHref}>{authorName}</Link> : authorName}</strong><span>{product ? <>Founder of <Link href={`/products/${product.slug}`}>{product.name}</Link> · </> : null}{formatDate(post.publishedAt)} · {post.readingMinutes} min read</span></div>
          </div>
        </header>
        {post.coverImageUrl && <figure className="blog-cover-minimal"><Image src={post.coverImageUrl} alt="" width={1200} height={750} sizes="(max-width: 760px) 90vw, 900px" priority /></figure>}
        <div className="blog-article-body"><BlogBody value={post.body} /></div>

        <section className="blog-discussion" id="discussion" aria-label="Story discussion">
          <div className="blog-discussion-head"><div className="blog-discussion-counts"><span>{engagement.likeCount} likes</span><span>{engagement.commentCount} comments</span></div></div>
          {canInteract ? <form action={toggleBlogLike.bind(null, post.slug)}><SubmitButton className={`blog-like-button${engagement.viewerHasLiked ? " active" : ""}`} pendingLabel="Updating…" aria-pressed={engagement.viewerHasLiked}><span aria-hidden="true">♥</span>{engagement.viewerHasLiked ? "Liked" : "Like this story"}</SubmitButton></form> : <Link className="blog-like-button" href={joinHref}><span aria-hidden="true">♥</span>Join to like</Link>}
          {canInteract ? <form className="comment-form blog-comment-form" action={createBlogComment.bind(null, post.slug)}><label htmlFor="blog-comment-body">Join the conversation</label><textarea id="blog-comment-body" name="body" minLength={2} maxLength={1000} rows={4} required placeholder="Add a useful thought, question, or perspective." />{query.commentError && <p className="form-error" role="alert">{query.commentError}</p>}{query.commentPosted && <p className="success-note" role="status">Your comment has been posted.</p>}<SubmitButton className="btn btn-dark" pendingLabel="Posting…">Post comment ↗</SubmitButton></form> : <div className="comment-signin"><p>Join the club to like stories and take part in the discussion.</p><Link className="btn btn-lime" href={joinHref}>Join Club</Link></div>}
          {engagement.comments.length ? <div className="comment-list">{engagement.commentCount > engagement.comments.length && <p className="comments-empty">Showing the latest {engagement.comments.length} comments.</p>}{engagement.comments.map((comment) => {
            const commentAuthor = displayName(comment.author);
            const commentAuthorHref = `/founders/${founderSlug(commentAuthor, comment.author.id)}`;
            return <article className="comment" key={comment.id}><div className="comment-avatar"><Link href={commentAuthorHref}><ProfileAvatar src={profileImage(comment.author)} alt={`${commentAuthor} profile picture`} /></Link></div><div className="comment-copy"><div><strong><Link href={commentAuthorHref}>{commentAuthor}</Link></strong><time dateTime={comment.createdAt.toISOString()}>{formatDateTime(comment.createdAt)}</time></div><p>{comment.body}</p></div>{canInteract && (session.user.id === comment.author.id || session.user.isAdmin) && <form action={deleteBlogComment.bind(null, post.slug, comment.id)}><button className="text-button" type="submit">Delete</button></form>}</article>;
          })}</div> : <p className="comments-empty">No comments yet. Add the first useful response.</p>}
        </section>

        {nextPost && <Link className="blog-next-author" href={`/blog/${nextPost.slug}`}><span>Next from {authorName}</span><strong>{nextPost.title}</strong><b>Read next →</b></Link>}
      </div>
    </article>
  );
}

function BlogBody({ value }: { value: string }) {
  const blocks = value.trim().split(/\n{2,}/);
  return blocks.map((block, index) => {
    const trimmed = block.trim();
    if (trimmed.startsWith("### ")) return <h3 key={index}>{trimmed.slice(4)}</h3>;
    if (trimmed.startsWith("## ")) return <h2 key={index}>{trimmed.slice(3)}</h2>;
    if (trimmed.startsWith("> ")) return <blockquote key={index}>{trimmed.slice(2)}</blockquote>;
    if (trimmed.split("\n").every((line) => line.startsWith("- "))) return <ul key={index}>{trimmed.split("\n").map((line) => <li key={line}>{line.slice(2)}</li>)}</ul>;
    return <p key={index}>{trimmed}</p>;
  });
}

function formatDate(value: Date | string | null) {
  return value ? new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" }).format(value instanceof Date ? value : new Date(value)) : "Draft";
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(value);
}
