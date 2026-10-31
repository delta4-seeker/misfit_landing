import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { auth } from "@/auth";
import { Pagination } from "@/components/pagination";
import { getBlogIndexPage } from "@/lib/blog";
import { parsePage } from "@/lib/pagination";
import { displayName } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Blog",
  description: "Founder stories, hard-earned lessons, and useful ideas from the Misfit Founders Club community.",
};
export const dynamic = "force-dynamic";

type BlogCard = Awaited<ReturnType<typeof getBlogIndexPage>>["posts"][number];

export default async function BlogPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const [{ page: pageParam }, session] = await Promise.all([searchParams, auth()]);
  const { mostLiked, posts, page, totalPages } = await getBlogIndexPage(parsePage(pageParam));
  const writeHref = session?.user.status === "ACTIVE" ? "/blog/write" : `/join?next=${encodeURIComponent("/blog/write")}`;

  return (
    <div className="blog-index section-shell">
      <header className="blog-index-head">
        <div><h1>Founder stories, operating lessons, and honest notes from the work.</h1></div>
        <Link className="btn btn-lime blog-write-cta" href={writeHref}><span>{session?.user.status === "ACTIVE" ? "Write a story" : "Join to write"}</span><span aria-hidden="true">↗</span></Link>
      </header>

      {mostLiked.length ? <section className="blog-most-liked" aria-labelledby="most-liked-title">
        <div className="blog-most-liked-head"><span>Community favorites</span><h2 id="most-liked-title">Most liked stories.</h2><p>Ranked by real member likes.</p></div>
        <div className="blog-most-liked-grid">{mostLiked.map((post, index) => <Link className="blog-ranked-card" href={`/blog/${post.slug}`} key={post.id}>
          <BlogVisual image={post.coverImageUrl} title={post.title} priority={index === 0} />
          <div className="blog-ranked-copy"><span className="blog-kicker">#{index + 1} most liked</span><h3>{post.title}</h3><p>{post.excerpt}</p><BlogMeta post={post} /><span className="blog-card-signals">♥ {post._count.likes} · {post._count.comments} comments</span><span className="blog-read-link">Read story ↗</span></div>
        </Link>)}</div>
      </section> : posts.length ? <div className="empty-state blog-empty-state"><h2>Most liked stories will appear after members start liking posts.</h2></div> : <div className="empty-state blog-empty-state"><h2>The first community story is waiting to be written.</h2><Link className="btn btn-lime" href={writeHref}>Write it ↗</Link></div>}

      {posts.length > 0 && <section className="blog-community" aria-labelledby="community-stories-title">
        <div className="blog-community-head"><span>Fresh perspectives</span><h2 id="community-stories-title">Latest from the community.</h2></div>
        <div className="blog-community-grid">{posts.map((post) => <Link className="blog-community-card" href={`/blog/${post.slug}`} key={post.id}><BlogVisual image={post.coverImageUrl} title={post.title} /><div><BlogMeta post={post} /><h3>{post.title}</h3><p>{post.excerpt}</p><span className="blog-card-signals">♥ {post._count.likes} · {post._count.comments} comments</span></div></Link>)}</div>
      </section>}
      <Pagination page={page} totalPages={totalPages} basePath="/blog" />
    </div>
  );
}

function BlogVisual({ image, title, priority = false }: { image: string | null; title: string; priority?: boolean }) {
  return <span className="blog-visual">{image ? <Image src={image} alt="" width={960} height={640} sizes="(max-width: 760px) 90vw, 50vw" priority={priority} /> : <span>{title.slice(0, 1)}</span>}</span>;
}

function BlogMeta({ post }: { post: BlogCard }) {
  return <span className="blog-meta"><span>By {post.author ? displayName(post.author) : post.authorName}</span><span>{formatDate(post.publishedAt)}</span><span>{post.readingMinutes} min read</span></span>;
}

function formatDate(value: Date | null) {
  return value ? new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value)) : "Draft";
}
