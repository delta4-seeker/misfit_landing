"use client";

import { useState } from "react";

type Props = {
  src?: string | null;
  alt: string;
  className?: string;
};

export function ProfileAvatar({ src, alt, className = "" }: Props) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  return (
    <span className={`avatar-media ${className}`.trim()} role="img" aria-label={alt}>
      {src && failedSrc !== src ? (
        // A plain img lets local uploads and Google/Supabase URLs share one resilient fallback.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" onError={() => setFailedSrc(src)} />
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="8" r="4" />
          <path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
        </svg>
      )}
    </span>
  );
}
