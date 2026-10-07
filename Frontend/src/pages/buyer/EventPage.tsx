/*
 * EventPage — /events/:showId  (plan §4.2)
 *
 * Hero poster + serif title, metadata, description.
 * Showtimes grouped by IST day, with optional city filter chip row.
 */

import type React from 'react';
import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MapPin, Clock, Calendar, ChevronRight } from 'lucide-react';
import { useGetCatalogEventQuery } from '../../api/buyerApi';
import { Poster } from '../../components/ui/Poster';
import { EmptyState } from '../../components/ui/EmptyState';
import { Badge } from '../../components/ui/Badge';
import { SHOW_TYPE_LABELS } from '../../utils/catalogDisplay';
import {
  formatDay,
  formatTime,
  formatDuration,
  formatINR,
  istDateKey,
} from '../../utils/datetime';
import type { Showtime } from '../../types/buyer.types';
import { useAppTitle } from '../../app/useDocumentTitle';

type DayGroup = { dateKey: string; label: string; showtimes: Showtime[] };

const groupByDay = (showtimes: Showtime[]): DayGroup[] => {
  const map = new Map<string, Showtime[]>();
  for (const s of showtimes) {
    const key = istDateKey(s.startsAt);
    const list = map.get(key);
    if (list) list.push(s);
    else map.set(key, [s]);
  }
  return [...map.entries()].map(([key, list]) => ({
    dateKey: key,
    label: formatDay(list[0].startsAt),
    showtimes: list,
  }));
};

const AvailabilityLabel: React.FC<{ available: number; total: number }> = ({
  available,
  total,
}) => {
  if (available === 0) {
    return (
      <span className="text-caption text-[var(--danger)]">SOLD OUT</span>
    );
  }
  if (available / total < 0.1) {
    return (
      <span className="text-caption text-[var(--warning)]">ALMOST FULL</span>
    );
  }
  return null;
};

export function EventPage() {
  const { showId } = useParams<{ showId: string }>();
  const id = Number(showId);

  const { data, isLoading, isError } = useGetCatalogEventQuery(id, { skip: !id || isNaN(id) });
  const event = data?.event;

  useAppTitle(event?.title ?? 'Event');

  // City filter state
  const [cityFilter, setCityFilter] = useState<string | null>(null);

  const allCities = useMemo(() => {
    const screenings = event?.screenings;
    if (!screenings) return [];
    const cities = new Set(screenings.map((s) => s.venue.city));
    return [...cities];
  }, [event]);

  const filteredScreenings = useMemo(() => {
    const screenings = event?.screenings;
    if (!screenings) return [];
    return cityFilter
      ? screenings.filter((s) => s.venue.city === cityFilter)
      : screenings;
  }, [event, cityFilter]);

  const days = useMemo(() => groupByDay(filteredScreenings), [filteredScreenings]);

  if (isLoading) {
    return (
      <div className="max-w-[var(--container-default)] mx-auto px-4 sm:px-8 py-12">
        <div className="flex gap-8">
          <div className="w-48 shrink-0 aspect-[2/3] rounded-[6px] bg-[var(--paper-sunken)] animate-pulse" />
          <div className="flex-1 flex flex-col gap-4">
            <div className="h-4 w-24 rounded bg-[var(--paper-sunken)] animate-pulse" />
            <div className="h-8 w-3/4 rounded bg-[var(--paper-sunken)] animate-pulse" />
            <div className="h-4 w-1/2 rounded bg-[var(--paper-sunken)] animate-pulse" />
            <div className="h-4 w-1/3 rounded bg-[var(--paper-sunken)] animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !event) {
    return (
      <div className="max-w-[var(--container-default)] mx-auto px-4 sm:px-8 py-16">
        <EmptyState
          heading="This event doesn't exist"
          description="It may have been removed or the link is incorrect."
          action={{ label: 'Browse events', href: '/explore' }}
        />
      </div>
    );
  }

  return (
    <div className="max-w-[var(--container-default)] mx-auto px-4 sm:px-8 py-8 sm:py-12 flex flex-col gap-12">
      {/* Hero section */}
      <div className="flex flex-col sm:flex-row gap-6 sm:gap-10">
        <div className="w-full sm:w-48 shrink-0">
          <Poster src={event.posterUrl} alt={event.title} className="w-full" />
        </div>

        <div className="flex flex-col gap-4 min-w-0">
          <div>
            <span className="text-caption text-[var(--ink-muted)]">
              {SHOW_TYPE_LABELS[event.type]} · {event.ageRating}
            </span>
            <h1
              className="font-display font-medium text-3xl sm:text-4xl text-[var(--ink)] tracking-tight mt-2 leading-tight"
              style={{ fontVariationSettings: "'SOFT' 60, 'WONK' 0, 'opsz' 40" }}
            >
              {event.title}
            </h1>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--ink-secondary)]">
            {event.language && (
              <span className="flex items-center gap-1">
                <span className="text-caption text-[var(--ink-muted)]">LANG</span>
                {event.language}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-[var(--ink-muted)]" />
              {formatDuration(event.durationMinutes)}
            </span>
            {event.genre && (
              <Badge variant="neutral">{event.genre}</Badge>
            )}
          </div>

          {event.description && (
            <p className="text-sm text-[var(--ink-secondary)] leading-relaxed max-w-prose">
              {event.description}
            </p>
          )}
        </div>
      </div>

      {/* Showtimes */}
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-medium text-2xl text-[var(--ink)] tracking-tight"
            style={{ fontVariationSettings: "'SOFT' 60, 'WONK' 0, 'opsz' 24" }}>
            Showtimes
          </h2>
        </div>

        {/* City filter chips (only when multiple cities) */}
        {allCities.length > 1 && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setCityFilter(null)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                cityFilter === null
                  ? 'bg-[var(--accent)] text-[var(--accent-ink)] border-[var(--accent)]'
                  : 'bg-[var(--paper-raised)] text-[var(--ink-secondary)] border-[var(--rule)] hover:border-[var(--rule-strong)]'
              }`}
            >
              All cities
            </button>
            {allCities.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCityFilter(c)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                  cityFilter === c
                    ? 'bg-[var(--accent)] text-[var(--accent-ink)] border-[var(--accent)]'
                    : 'bg-[var(--paper-raised)] text-[var(--ink-secondary)] border-[var(--rule)] hover:border-[var(--rule-strong)]'
                }`}
              >
                <MapPin className="w-3 h-3" />
                {c}
              </button>
            ))}
          </div>
        )}

        {/* Day groups */}
        {days.length === 0 ? (
          <EmptyState
            heading="No upcoming showtimes"
            description={cityFilter ? 'Try another city.' : 'Check back later.'}
            action={cityFilter ? { label: 'Clear city filter', onClick: () => setCityFilter(null) } : undefined}
          />
        ) : (
          <div className="flex flex-col gap-8">
            {days.map((day) => (
              <div key={day.dateKey}>
                {/* Sticky day header */}
                <div className="sticky top-14 z-10 bg-[var(--paper)] border-b border-[var(--rule)] py-2 mb-3">
                  <p className="text-caption text-[var(--ink-muted)] flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    {day.label}
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  {day.showtimes.map((s) => {
                    const isSoldOut = s.seatsAvailable === 0;

                    return (
                      <Link
                        key={s.id}
                        to={isSoldOut ? '#' : `/screenings/${s.id}`}
                        aria-disabled={isSoldOut}
                        className={`flex items-center justify-between p-4 rounded-[10px] border border-[var(--rule)] bg-[var(--paper-raised)] transition-all ${
                          isSoldOut
                            ? 'opacity-50 cursor-not-allowed'
                            : 'hover:border-[var(--rule-strong)] hover:shadow-[var(--elev-1)] cursor-pointer'
                        }`}
                      >
                        <div className="flex flex-col gap-0.5">
                          <p className="text-sm font-medium text-[var(--ink)] tabular-nums">
                            {formatTime(s.startsAt)} – {formatTime(s.endsAt)}
                          </p>
                          <p className="text-xs text-[var(--ink-secondary)] flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-[var(--ink-muted)]" />
                            {s.venue.name} · {s.venue.city}
                          </p>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            {s.minPrice && (
                              <p className="text-sm font-medium text-[var(--ink)] tabular-nums">
                                From {formatINR(s.minPrice)}
                              </p>
                            )}
                            <AvailabilityLabel
                              available={s.seatsAvailable}
                              total={s.seatsTotal}
                            />
                          </div>
                          {!isSoldOut && (
                            <ChevronRight className="w-4 h-4 text-[var(--ink-muted)] shrink-0" />
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
