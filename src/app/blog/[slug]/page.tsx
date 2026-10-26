import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getBlogNavigation, getPublishedBlog } from "@/lib/blog";

type PageProps = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedBlog(slug);
  if (!post) return { title: "Article not found" };
  return { title: post.title, description: post.excerpt, openGraph: { title: post.title, description: post.excerpt, images: post.coverImageUrl ? [post.coverImageUrl] : undefined } };
}

export default async function BlogDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const [post, navigation] = await Promise.all([getPublishedBlog(slug), getBlogNavigation(slug)]);
  if (!post) notFound();

  return (
    <article className="blog-article section-shell">
      <div className="blog-reading-column">
        <Link className="blog-all-link" href="/blog">← All stories</Link>
        <header className="blog-article-head">
          <h1>{post.title}</h1>
          <p className="blog-article-deck">{post.excerpt}</p>
          <div className="blog-author-row">
            <span className="blog-author-avatar" aria-hidden="true">{post.authorName.slice(0, 1)}</span>
            <div><strong>{post.authorName}</strong><span>{formatDate(post.publishedAt)} · {post.readingMinutes} min read</span></div>
          </div>
        </header>
        {post.coverImageUrl && <figure className="blog-cover">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={post.coverImageUrl} alt="" />
        </figure>}
        <div className="blog-article-body"><BlogBody value={post.body} /></div>
        <footer className="blog-article-footer"><span>Misfit Founders Club</span><Link href="/blog">Read all field notes ↗</Link></footer>
      </div>
      <aside className="blog-more" aria-labelledby="blog-more-title">
        <div className="blog-more-heading"><h2 id="blog-more-title">Keep reading.</h2><Link href="/blog">All stories ↗</Link></div>
        {navigation.other.length > 0 ? <div className="blog-more-grid">{navigation.other.map((other) => (
          <Link href={`/blog/${other.slug}`} key={other.slug}>
            <span>{formatDate(other.publishedAt)} · {other.readingMinutes} min read</span>
            <h3>{other.title}</h3>
            <p>{other.excerpt}</p>
            <b>Read story ↗</b>
          </Link>
        ))}</div> : <p className="blog-more-empty">More stories are on the way.</p>}
        <nav className="blog-post-nav" aria-label="Adjacent articles">
          {navigation.previous ? <Link href={`/blog/${navigation.previous.slug}`} rel="prev"><span>← Previous story</span><strong>{navigation.previous.title}</strong></Link> : <span className="blog-post-nav-empty">← Previous story</span>}
          {navigation.next ? <Link href={`/blog/${navigation.next.slug}`} rel="next"><span>Next story →</span><strong>{navigation.next.title}</strong></Link> : <span className="blog-post-nav-empty">Next story →</span>}
        </nav>
      </aside>
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
    if (trimmed.split("\n").every((line) => line.startsWith("- "))) {
      return <ul key={index}>{trimmed.split("\n").map((line) => <li key={line}>{line.slice(2)}</li>)}</ul>;
    }
    return <p key={index}>{trimmed}</p>;
  });
}

function formatDate(value: Date | null) {
  return value ? new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" }).format(value) : "Draft";
}
