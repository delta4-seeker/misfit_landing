import type { Metadata } from "next";
import Link from "next/link";

import { Pagination } from "@/components/pagination";
import { getPublishedBlogsPage } from "@/lib/blog";
import { parsePage } from "@/lib/pagination";

export const metadata: Metadata = {
  title: "Blog",
  description: "Field notes, hard-earned lessons, and useful ideas from Misfit Founders Club.",
};
export const dynamic = "force-dynamic";

export default async function BlogPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page: pageParam } = await searchParams;
  const { posts, page, totalPages } = await getPublishedBlogsPage(parsePage(pageParam));
  const [featured, ...rest] = posts;

  return (
    <div className="blog-index section-shell">
      <header className="blog-index-head">
        <span>Misfit field notes</span>
        <h1>Ideas for people building the uncommon.</h1>
        <p>Founder stories, operating lessons, and useful truths from the room.</p>
      </header>

      {featured ? (
        <>
          <Link className="blog-featured" href={`/blog/${featured.slug}`}>
            <BlogVisual image={featured.coverImageUrl} title={featured.title} />
            <div className="blog-featured-copy">
              <BlogKicker value={featured.kicker} />
              <h2>{featured.title}</h2>
              <p>{featured.excerpt}</p>
              <BlogMeta post={featured} />
              <span className="blog-read-link">Read article ↗</span>
            </div>
          </Link>

          {rest.length > 0 && (
            <section className="blog-list" aria-label="More articles">
              {rest.map((post, index) => (
                <Link className="blog-list-item" href={`/blog/${post.slug}`} key={post.id}>
                  <span className="blog-index-number">{String((page - 1) * 6 + index + 2).padStart(2, "0")}</span>
                  <div>
                    <BlogKicker value={post.kicker} />
                    <h2>{post.title}</h2>
                    <p>{post.excerpt}</p>
                    <BlogMeta post={post} />
                  </div>
                  <span className="blog-list-arrow" aria-hidden="true">↗</span>
                </Link>
              ))}
            </section>
          )}
        </>
      ) : <div className="empty-state">The first field note is being written.</div>}
      <Pagination page={page} totalPages={totalPages} basePath="/blog" />
    </div>
  );
}

function BlogVisual({ image, title }: { image: string | null; title: string }) {
  return <div className="blog-visual">{image ? <>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={image} alt="" />
  </> : <span>{title.slice(0, 1)}</span>}</div>;
}

function BlogKicker({ value }: { value: string | null }) {
  return value ? <span className="blog-kicker">{value}</span> : null;
}

function BlogMeta({ post }: { post: { authorName: string; publishedAt: Date | null; readingMinutes: number } }) {
  return <div className="blog-meta"><span>By {post.authorName}</span><span>{formatDate(post.publishedAt)}</span><span>{post.readingMinutes} min read</span></div>;
}

function formatDate(value: Date | null) {
  return value ? new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" }).format(value) : "Draft";
}
