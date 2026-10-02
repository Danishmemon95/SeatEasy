import type React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { SEAT_CATEGORIES, type Screening } from '../../types/catalog.types';
import { CATEGORY_LABELS, screeningDisplayStatus } from '../../utils/catalogDisplay';
import { formatDay, formatINR, formatTime } from '../../utils/datetime';
import { SeatSwatch } from '../../components/ui/SeatSwatch';
import { StatusBadge } from '../../components/ui/StatusBadge';
import type { ScreeningDay } from './groupByDay';

/** booked / total as a hairline bar plus text; held seats get their own count (§6.7). */
export const SoldMeter: React.FC<{ seats: Screening['seats']; className?: string }> = ({ seats, className = '' }) => {
  const pct = seats.total > 0 ? (seats.booked / seats.total) * 100 : 0;
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <span className="text-[13px] tabular-nums text-[var(--ink-secondary)]">
        {seats.booked} / {seats.total} sold
        {seats.held > 0 && <span className="text-[var(--ink-muted)]"> · {seats.held} held</span>}
      </span>
      <div className="h-[3px] w-full rounded-full bg-[var(--paper-sunken)] overflow-hidden" aria-hidden="true">
        <div className="h-full bg-[var(--ink-secondary)]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

const ScreeningRow: React.FC<{ screening: Screening }> = ({ screening: s }) => {
  const priced = SEAT_CATEGORIES.filter((c) => s.prices[c] !== undefined);
  return (
    <li>
      <Link
        to={`/organizer/screenings/${s.id}`}
        className="grid grid-cols-[1fr_auto] md:grid-cols-[11rem_minmax(0,1fr)_minmax(0,1.2fr)_9rem_6.5rem_1rem] items-center gap-x-4 gap-y-2 px-4 py-3 transition-colors duration-[150ms] hover:bg-[var(--paper-sunken)] focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:-outline-offset-2"
      >
        <span className="text-[15px] text-[var(--ink)] tabular-nums">
          {formatTime(s.startsAt)} – {formatTime(s.endsAt)}
        </span>
        <span className="text-sm text-[var(--ink-secondary)] truncate col-span-2 md:col-span-1">
          {s.venue.name} · {s.venue.city}
        </span>
        <ul className="flex flex-wrap gap-x-3 gap-y-1 col-span-2 md:col-span-1" aria-label="Prices">
          {priced.map((c) => (
            <li key={c} className="flex items-center gap-1.5 text-[12px] text-[var(--ink-secondary)]">
              <SeatSwatch category={c} className="w-3 h-3" />
              <span className="text-caption">{CATEGORY_LABELS[c]}</span>
              <span className="tabular-nums">{formatINR(s.prices[c]!)}</span>
            </li>
          ))}
        </ul>
        <SoldMeter seats={s.seats} className="col-span-2 md:col-span-1" />
        {/* Beside the time on mobile; its own column on desktop. */}
        <span className="row-start-1 col-start-2 md:row-auto md:col-auto justify-self-end">
          <StatusBadge status={screeningDisplayStatus(s)} />
        </span>
        <ChevronRight className="hidden md:block w-4 h-4 text-[var(--ink-muted)]" aria-hidden="true" />
      </Link>
    </li>
  );
};

/** One day's screenings under a sticky caption date header (`SAT, 12 OCT`). */
export const ScreeningDateGroup: React.FC<{ day: ScreeningDay }> = ({ day }) => (
  <section aria-label={formatDay(day.screenings[0].startsAt)} className="group">
    <h3 className="sticky top-14 z-10 group-first:rounded-t-[9px] px-4 py-2 text-caption text-[var(--ink-muted)] bg-[var(--paper-sunken)] border-b border-[var(--rule)]">
      {formatDay(day.screenings[0].startsAt).toUpperCase()}
    </h3>
    <ul className="divide-y divide-[var(--rule)]">
      {day.screenings.map((s) => (
        <ScreeningRow key={s.id} screening={s} />
      ))}
    </ul>
  </section>
);
