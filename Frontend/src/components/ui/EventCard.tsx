/*
 * EventCard — buyer-facing event card for the explore grid and home sections.
 * 2:3 framed poster, title, type·age caption, language·duration, next showtime, price.
 * The whole card links to /events/:id.
 */

import type React from 'react';
import { Link } from 'react-router-dom';
import { Poster } from './Poster';
import { SHOW_TYPE_LABELS } from '../../utils/catalogDisplay';
import { formatDuration, formatShowtime, formatINR } from '../../utils/datetime';
import type { CatalogEvent, CatalogCard } from '../../types/buyer.types';

type CardData = CatalogEvent | CatalogCard;

interface EventCardProps {
  event: CardData;
}

export const EventCard: React.FC<EventCardProps> = ({ event }) => {
  const minPrice = event.minPrice ? formatINR(event.minPrice) : null;

  return (
    <Link
      to={`/events/${event.id}`}
      className="group flex flex-col gap-2 text-left no-underline"
    >
      {/* Poster */}
      <div className="relative overflow-hidden rounded-[6px]">
        <Poster
          src={event.posterUrl}
          alt={event.title}
          className="w-full transition-transform duration-[400ms] ease-[var(--ease)] group-hover:scale-[1.01]"
          aspectRatio="2/3"
        />
        {/* Subtle overlay on hover */}
        <div className="absolute inset-0 bg-[var(--ink)] opacity-0 group-hover:opacity-[0.04] transition-opacity duration-[200ms]" />
      </div>

      {/* Caption */}
      <div className="flex flex-col gap-1">
        <span className="text-caption text-[var(--ink-muted)]">
          {SHOW_TYPE_LABELS[event.type]} · {event.ageRating}
        </span>
        <h3 className="text-sm font-semibold text-[var(--ink)] leading-snug line-clamp-2 group-hover:text-[var(--accent)] transition-colors">
          {event.title}
        </h3>
        <p className="text-xs text-[var(--ink-muted)]">
          {event.language} · {formatDuration(event.durationMinutes)}
        </p>
        {event.nextScreeningAt && (
          <p className="text-xs text-[var(--ink-secondary)]">
            Next: {formatShowtime(event.nextScreeningAt)}
          </p>
        )}
        {minPrice && (
          <p className="text-xs font-medium text-[var(--ink)] tabular-nums">
            From {minPrice}
          </p>
        )}
      </div>
    </Link>
  );
};
