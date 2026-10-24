"use client";

import type { GalleryItem } from "@/lib/types";
import { useState } from "react";

export function GalleryGrid({ photos, preview = false }: { photos: GalleryItem[]; preview?: boolean }) {
  const [active, setActive] = useState<GalleryItem | null>(null);
  return (
    <>
      <div className={preview ? "preview-strip" : "gallery-grid"}>
        {photos.map((photo) => (
          <figure key={photo.id} className="gallery-item">
            <button type="button" onClick={() => setActive(photo)} aria-label={`Open ${photo.caption || "gallery photo"}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.thumbnailUrl || photo.imageUrl} alt={photo.caption || "Misfit Founders Club gathering"} loading="lazy" />
            </button>
            {photo.caption && <figcaption>{photo.caption}</figcaption>}
          </figure>
        ))}
      </div>
      {active && (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label={active.caption || "Gallery photo"} onClick={() => setActive(null)}>
          <button type="button" aria-label="Close" onClick={() => setActive(null)}>×</button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={active.imageUrl} alt={active.caption || "Misfit Founders Club gathering"} />
        </div>
      )}
    </>
  );
}
