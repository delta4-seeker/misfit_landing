"use client";

import Image from "next/image";
import type { GalleryItem } from "@/lib/types";
import { useState } from "react";

export function GalleryGrid({ photos, preview = false }: { photos: GalleryItem[]; preview?: boolean }) {
  const [active, setActive] = useState<GalleryItem | null>(null);
  return (
    <>
      <div className={preview ? "preview-strip" : "gallery-grid"}>
        {photos.map((photo) => (
          <figure key={photo.id} className="gallery-item">
            <button type="button" onClick={() => setActive(photo)} aria-label="Open gallery photo">
              <Image src={photo.thumbnailUrl || photo.imageUrl} alt="Misfit Founders Club gathering" width={800} height={800} sizes={preview ? "(max-width: 760px) 65vw, 22vw" : "(max-width: 760px) 45vw, 30vw"} quality={72} onLoad={preview ? undefined : (event) => {
                const image = event.currentTarget;
                if (image.naturalWidth && image.naturalHeight && image.parentElement) {
                  image.parentElement.style.aspectRatio = String(Math.max(0.72, Math.min(2.2, image.naturalWidth / image.naturalHeight)));
                }
              }} />
            </button>
          </figure>
        ))}
      </div>
      {active && (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label="Gallery photo" onClick={() => setActive(null)}>
          <button type="button" aria-label="Close" onClick={() => setActive(null)}>×</button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={active.imageUrl} alt="Misfit Founders Club gathering" />
        </div>
      )}
    </>
  );
}
