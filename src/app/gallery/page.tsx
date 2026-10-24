import type { Metadata } from "next";

import { GalleryGrid } from "@/components/gallery-grid";
import { getGallery } from "@/lib/data";

export const metadata: Metadata = { title: "Gallery" };
export const dynamic = "force-dynamic";

export default async function GalleryPage() {
  const photos = await getGallery();
  return (
    <section className="gallery-page section-shell">
      {photos.length ? <GalleryGrid photos={photos} /> : <div className="empty-state">The camera roll is loading.</div>}
    </section>
  );
}
