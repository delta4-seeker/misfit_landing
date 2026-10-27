import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { createProductComment, deleteProductComment, toggleProductVote } from "@/app/actions";
import { auth } from "@/auth";
import { ProfileAvatar } from "@/components/profile-avatar";
import { SubmitButton } from "@/components/submit-button";
import { getProduct, getProductEngagement } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const product = await getProduct((await params).slug);
  return product ? { title: product.name, description: product.tagline } : {};
}

export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ commentError?: string; commentPosted?: string }>;
}) {
  const { slug } = await params;
  const [product, session, query] = await Promise.all([getProduct(slug), auth(), searchParams]);
  if (!product) notFound();
  const engagement = await getProductEngagement(product.id, session?.user.id);
  const canInteract = session?.user.status === "ACTIVE";
  const joinHref = `/join?next=${encodeURIComponent(`/products/${product.slug}`)}`;
  const founders = [product.founder, ...product.coFounders];
  return (
    <article className="detail-shell section-shell">
      <Link className="back-link" href="/products">← All products</Link>
      <div className="product-detail-grid">
        <div className="product-detail-logo">
          {product.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.logoUrl} alt={`${product.name} logo`} />
          ) : <span>{product.name.slice(0, 1)}</span>}
        </div>
        <div className="product-detail-copy">
          <div className="product-card-meta"><span className="tag">{product.category.name}</span></div>
          <h1><a className="product-name-link" href={product.websiteUrl} target="_blank" rel="noopener noreferrer" aria-label={`${product.name} website (opens in a new tab)`}>{product.name}</a></h1>
          <p className="lead">{product.tagline}</p>
          <p>{product.description}</p>
          <div className="product-signal-row">
            {canInteract ? (
              <form action={toggleProductVote.bind(null, product.slug)}>
                <SubmitButton className={`vote-button ${engagement.viewerHasUpvoted ? "active" : ""}`} pendingLabel="Updating…" aria-pressed={engagement.viewerHasUpvoted}>
                  <span aria-hidden="true">▲</span>
                  {engagement.viewerHasUpvoted ? "Upvoted" : "Upvote"}
                </SubmitButton>
              </form>
            ) : <Link className="vote-button" href={joinHref}><span aria-hidden="true">▲</span> Upvote</Link>}
            <strong>{engagement.upvoteCount} {engagement.upvoteCount === 1 ? "upvote" : "upvotes"}</strong>
            <span>{engagement.comments.length} {engagement.comments.length === 1 ? "comment" : "comments"}</span>
          </div>
          {session?.user.id === product.founder.id && <div className="button-row left"><Link className="btn btn-outline" href={`/products/${product.slug}/manage`}>Manage listing</Link></div>}
        </div>
      </div>
      <section className="product-founders" id="founders" aria-labelledby="product-founders-title">
        <div className="product-founders-heading">
          <div><h2 id="product-founders-title">Founders.</h2><p>Meet the people building {product.name}.</p></div>
          <span>{product.coFounders.length === 0 ? "Solo founder" : `${product.coFounders.length} ${product.coFounders.length === 1 ? "co-founder" : "co-founders"}`}</span>
        </div>
        <div className="product-founder-list">
          {founders.map((founder, index) => (
            <Link className="product-founder-card" href={`/founders/${founder.slug}`} key={founder.id}>
              <ProfileAvatar className="product-founder-avatar" src={founder.image} alt={`${founder.name} profile picture`} />
              <span className="product-founder-copy"><small>{index === 0 ? "Founder" : "Co-founder"}</small><strong>{founder.name}</strong></span>
              <span className="product-founder-arrow" aria-hidden="true">↗</span>
            </Link>
          ))}
        </div>
      </section>
      <section className="comments-section" id="comments">
        <div className="comments-heading">
          <div><h2>Community feedback.</h2><p>Questions, useful context, and honest reactions from the club.</p></div>
          <span>{engagement.comments.length.toString().padStart(2, "0")}</span>
        </div>
        {canInteract ? (
          <form className="comment-form" action={createProductComment.bind(null, product.slug)}>
            <label htmlFor="comment-body">Add feedback</label>
            <textarea id="comment-body" name="body" maxLength={500} minLength={2} rows={4} placeholder="Share a useful question or perspective about this product." required />
            {query.commentError && <p className="form-error" role="alert">{query.commentError}</p>}
            {query.commentPosted && <p className="success-note" role="status">Your feedback has been posted.</p>}
            <SubmitButton className="btn btn-dark" pendingLabel="Posting…">Post feedback ↗</SubmitButton>
          </form>
        ) : (
          <div className="comment-signin"><p>Join the club to upvote and join the conversation.</p><Link className="btn btn-lime" href={joinHref}>Join Club</Link></div>
        )}
        {engagement.comments.length > 0 ? (
          <div className="comment-list">
            {engagement.comments.map((comment) => (
              <article className="comment" key={comment.id}>
                <div className="comment-avatar">
                  <ProfileAvatar src={comment.author.image} alt={`${comment.author.name} profile picture`} />
                </div>
                <div className="comment-copy">
                  <div><strong>{comment.author.name}</strong><time dateTime={comment.createdAt.toISOString()}>{new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(comment.createdAt)}</time></div>
                  <p>{comment.body}</p>
                </div>
                {canInteract && (session.user.id === comment.author.id || session.user.isAdmin) && (
                  <form action={deleteProductComment.bind(null, product.slug, comment.id)}><button className="text-button" type="submit">Delete</button></form>
                )}
              </article>
            ))}
          </div>
        ) : <p className="comments-empty">No feedback yet. Start with a useful question.</p>}
      </section>
    </article>
  );
}
