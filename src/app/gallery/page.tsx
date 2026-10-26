import type { Metadata } from "next";

import { GalleryGrid } from "@/components/gallery-grid";
import { Pagination } from "@/components/pagination";
import { getGalleryPage } from "@/lib/data";
import { parsePage } from "@/lib/pagination";

export const metadata: Metadata = { title: "Gallery" };
export const dynamic = "force-dynamic";

export default async function GalleryPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page: pageParam } = await searchParams;
  const { photos, page, totalPages } = await getGalleryPage(parsePage(pageParam));
  return (
    <section className="gallery-page section-shell">
      {photos.length ? <GalleryGrid photos={photos} /> : <div className="empty-state">The camera roll is loading.</div>}
      <Pagination page={page} totalPages={totalPages} basePath="/gallery" />
    </section>
  );
}
