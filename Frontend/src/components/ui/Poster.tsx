/*
 * Poster — a framed 2:3 event image (design §3.6).
 * 1px rule border, 6px radius, object-fit: cover.
 * Shows a sunken skeleton while loading, no spinners.
 */

import type React from 'react';

interface PosterProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  /** Overrides the default aspect ratio (default: 2/3). */
  aspectRatio?: string;
}

export const Poster: React.FC<PosterProps> = ({
  src,
  alt,
  className = '',
  aspectRatio = '2/3',
}) => {
  if (!src) {
    return (
      <div
        className={`bg-[var(--paper-sunken)] border border-[var(--rule)] rounded-[6px] overflow-hidden ${className}`}
        style={{ aspectRatio }}
        aria-hidden="true"
      />
    );
  }

  return (
    <div
      className={`border border-[var(--rule)] rounded-[6px] overflow-hidden ${className}`}
      style={{ aspectRatio }}
    >
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className="w-full h-full object-cover"
      />
    </div>
  );
};
