/*
 * MyBookingsPage — /bookings  (plan §4.5)
 *
 * Filter pills: Upcoming · Past · Cancelled (client-side categorisation).
 * Each row: small poster, title, showtime, venue, seats, total, StatusBadge.
 */

import type React from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, MapPin, ChevronRight } from 'lucide-react';
import { useGetMyBookingsQuery } from '../../api/buyerApi';
import { useChoiceParam, usePageParam } from '../../app/urlState';
import { Poster } from '../../components/ui/Poster';
import { Pagination } from '../../components/ui/Pagination';
import { EmptyState } from '../../components/ui/EmptyState';
import { QueryErrorState } from '../../components/ui/QueryErrorState';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { formatShowtime, formatINR } from '../../utils/datetime';
import type { Booking } from '../../types/buyer.types';
import { useAppTitle } from '../../app/useDocumentTitle';

const STATUS_CHOICES = ['upcoming', 'past', 'cancelled', 'all'] as const;
type StatusChoice = (typeof STATUS_CHOICES)[number];

const STATUS_LABELS: Record<StatusChoice, string> = {
  upcoming: 'Upcoming',
  past: 'Past',
  cancelled: 'Cancelled',
  all: 'All',
};

const isUpcoming = (b: Booking) =>
  b.status === 'confirmed' && new Date(b.screening.startsAt) > new Date();

const isPast = (b: Booking) =>
  b.status === 'confirmed' && new Date(b.screening.startsAt) <= new Date();

export function MyBookingsPage() {
  useAppTitle('My Bookings');
  const [statusChoice, setStatusChoice] = useChoiceParam('status', STATUS_CHOICES);
  const [page, setPage] = usePageParam();

  const { data, isLoading, isError, error, refetch } = useGetMyBookingsQuery({
    page,
    pageSize: 20,
  });

  const bookings = data?.bookings ?? [];
  const pagination = data?.pagination;

  // Client-side categorisation.
  const filtered = bookings.filter((b) => {
    if (statusChoice === 'upcoming') return isUpcoming(b);
    if (statusChoice === 'past') return isPast(b);
    if (statusChoice === 'cancelled') return b.status === 'cancelled';
    return true; // 'all'
  });

  return (
    <div className="max-w-[var(--container-default)] mx-auto px-4 sm:px-8 py-8 sm:py-12 flex flex-col gap-8">
      {/* Header */}
      <div>
        <p className="text-caption text-[var(--ink-muted)] mb-1">ACCOUNT</p>
        <h1 className="font-display font-medium text-3xl sm:text-4xl text-[var(--ink)] tracking-tight"
          style={{ fontVariationSettings: "'SOFT' 60, 'WONK' 0, 'opsz' 40" }}>
          My bookings
        </h1>
      </div>

      {/* Filter pills */}
      <div className="flex items-center gap-2 flex-wrap border-b border-[var(--rule)] pb-4">
        {STATUS_CHOICES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => { setStatusChoice(s); setPage(1); }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
              statusChoice === s
                ? 'bg-[var(--accent)] text-[var(--accent-ink)] border-[var(--accent)]'
                : 'bg-[var(--paper-raised)] text-[var(--ink-secondary)] border-[var(--rule)] hover:border-[var(--rule-strong)] hover:text-[var(--ink)]'
            }`}
          >
            {STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-[10px] bg-[var(--paper-sunken)] animate-pulse" />
          ))}
        </div>
      ) : isError ? (
        <QueryErrorState error={error} onRetry={refetch} noun="bookings" />
      ) : filtered.length === 0 ? (
        <EmptyState
          heading="No bookings yet"
          description={statusChoice === 'all' ? "When you book tickets, they'll appear here." : `No ${STATUS_LABELS[statusChoice].toLowerCase()} bookings.`}
          action={{ label: 'Browse events', href: '/explore' }}
          icon={<CalendarDays className="w-8 h-8" />}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((booking) => (
            <BookingRow key={booking.id} booking={booking} />
          ))}
        </div>
      )}

      {pagination && pagination.totalPages > 1 && (
        <Pagination pagination={pagination} noun="bookings" onPageChange={setPage} />
      )}
    </div>
  );
}

const BookingRow: React.FC<{ booking: Booking }> = ({ booking }) => {
  const seatLabels = booking.seats.map((s) => `${s.rowLabel}${s.seatNumber}`).join(', ');
  const isCancelledScreening = booking.screening.status === 'cancelled';

  return (
    <Link
      to={`/bookings/${booking.id}`}
      className="flex items-center gap-4 p-4 rounded-[10px] border border-[var(--rule)] bg-[var(--paper-raised)] hover:border-[var(--rule-strong)] hover:shadow-[var(--elev-1)] transition-all cursor-pointer"
    >
      {/* Poster */}
      <Poster
        src={booking.event.posterUrl}
        alt={booking.event.title}
        className="w-14 shrink-0"
      />

      {/* Content */}
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-[var(--ink)] truncate">{booking.event.title}</h3>
          <StatusBadge status={booking.status} />
        </div>
        <p className="text-xs text-[var(--ink-secondary)] flex items-center gap-1">
          <CalendarDays className="w-3 h-3 text-[var(--ink-muted)] shrink-0" />
          {formatShowtime(booking.screening.startsAt)}
        </p>
        <p className="text-xs text-[var(--ink-secondary)] flex items-center gap-1">
          <MapPin className="w-3 h-3 text-[var(--ink-muted)] shrink-0" />
          {booking.venue.name} · {booking.venue.city}
        </p>
        {seatLabels && (
          <p className="text-xs text-[var(--ink-muted)] truncate">Seats: {seatLabels}</p>
        )}
        {isCancelledScreening && (
          <p className="text-xs text-[var(--danger)]">Screening cancelled</p>
        )}
      </div>

      {/* Total + arrow */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-sm font-semibold text-[var(--ink)] tabular-nums">
          {formatINR(booking.totalAmount)}
        </span>
        <ChevronRight className="w-4 h-4 text-[var(--ink-muted)]" />
      </div>
    </Link>
  );
};
