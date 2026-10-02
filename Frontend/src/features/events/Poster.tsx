import type React from 'react';
import { useState } from 'react';

type PosterSize = 'sm' | 'md' | 'lg';

const sizeClass: Record<PosterSize, string> = {
  sm: 'w-10',
  md: 'w-[120px]',
  lg: 'w-[160px]',
};

const initialsClass: Record<PosterSize, string> = {
  sm: 'text-[11px]',
  md: 'text-[22px]',
  lg: 'text-[28px]',
};

const initials = (title: string) =>
  title
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

export interface PosterProps {
  url: string | null;
  /** The event title; its initials stand in when there is no image. */
  title: string;
  size?: PosterSize;
  /** Empty when the title is already next to the poster (lists), so it isn't read twice. */
  alt?: string;
  className?: string;
}

/**
 * A framed 2:3 event poster (design.md §3.6): 1px rule border, 6px radius,
 * object-fit cover. A paper-sunken skeleton shows while the image loads; a
 * missing or broken URL falls back to the title's initials.
 */
export const Poster: React.FC<PosterProps> = ({ url, title, size = 'md', alt = '', className = '' }) => {
  // Keyed by URL so typing a new URL in the form retries without an effect.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);

  const showImage = Boolean(url) && failedUrl !== url;
  const loaded = showImage && loadedUrl === url;

  return (
    <div
      className={`relative shrink-0 aspect-[2/3] overflow-hidden rounded-[6px] border border-[var(--rule)] bg-[var(--paper-sunken)] ${sizeClass[size]} ${className}`}
    >
      {showImage ? (
        <>
          {!loaded && <div aria-hidden="true" className="absolute inset-0 animate-pulse bg-[var(--paper-sunken)]" />}
          <img
            src={url!}
            alt={alt}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onLoad={() => setLoadedUrl(url)}
            onError={() => setFailedUrl(url)}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-[200ms] ${loaded ? 'opacity-100' : 'opacity-0'}`}
          />
        </>
      ) : (
        <div
          aria-hidden={alt === '' ? true : undefined}
          role={alt === '' ? undefined : 'img'}
          aria-label={alt === '' ? undefined : alt}
          className={`absolute inset-0 flex items-center justify-center font-display text-[var(--ink-faint)] select-none ${initialsClass[size]}`}
        >
          {initials(title) || '—'}
        </div>
      )}
    </div>
  );
};
