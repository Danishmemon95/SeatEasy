/*
 * TicketPage — /bookings/:bookingId  (plan §4.6)
 *
 * Big serif showtime, event + venue details, seats with category swatches,
 * total, booking reference in mono. Status-aware messaging.
 */

import { useParams, Link } from 'react-router-dom';
import { MapPin, CalendarDays, Clock, AlertTriangle, CreditCard } from 'lucide-react';
import { useGetBookingQuery } from '../../api/buyerApi';
import { Poster } from '../../components/ui/Poster';
import { EmptyState } from '../../components/ui/EmptyState';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { SHOW_TYPE_LABELS, CATEGORY_LABELS, categoryBorderClass } from '../../utils/catalogDisplay';
import { formatShowtime, formatTime, formatDate, formatINR } from '../../utils/datetime';
import { useAppTitle } from '../../app/useDocumentTitle';

const CATEGORY_COLORS: Record<string, string> = {
  gold: 'var(--seat-gold)',
  platinum: 'var(--seat-platinum)',
  sofa: 'var(--seat-sofa)',
};

export function TicketPage() {
  const { bookingId: paramId } = useParams<{ bookingId: string }>();
  const id = Number(paramId);

  const { data, isLoading, isError } = useGetBookingQuery(id, {
    skip: !id || isNaN(id),
  });
  const booking = data?.booking;

  useAppTitle(booking ? `Booking #${String(booking.id).padStart(6, '0')}` : 'Ticket');

  if (isLoading) {
    return (
      <div className="max-w-[var(--container-narrow)] mx-auto px-4 py-12">
        <div className="h-80 rounded-[16px] bg-[var(--paper-sunken)] animate-pulse" />
      </div>
    );
  }

  if (isError || !booking) {
    return (
      <div className="max-w-[var(--container-default)] mx-auto px-4 py-16">
        <EmptyState
          heading="Booking not found"
          description="This booking doesn't exist or belongs to another account."
          action={{ label: 'My bookings', href: '/bookings' }}
        />
      </div>
    );
  }

  const ref = `#${String(booking.id).padStart(6, '0')}`;
  const isCancelled = booking.status === 'cancelled';
  const isPending = booking.status === 'pending';
  const isCancelledScreening = booking.screening.status === 'cancelled';

  return (
    <div className="max-w-[var(--container-narrow)] mx-auto px-4 sm:px-8 py-8 sm:py-12 flex flex-col gap-6">
      {/* Status messaging */}
      {isCancelled && (
        <div className="flex items-start gap-3 p-4 rounded-[10px] border border-[var(--danger)] bg-[var(--danger-subtle)]">
          <AlertTriangle className="w-4 h-4 text-[var(--danger)] shrink-0 mt-0.5" />
          <p className="text-sm text-[var(--danger)]">
            This booking was cancelled and the seats have been released.
          </p>
        </div>
      )}

      {isPending && (
        <div className="flex items-start gap-3 p-4 rounded-[10px] border border-[var(--warning)] bg-[var(--warning-subtle)]">
          <CreditCard className="w-4 h-4 text-[var(--warning)] shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-[var(--warning)]">Payment not completed</p>
            <Link
              to={`/events/${booking.event.id}`}
              className="text-xs text-[var(--accent)] hover:underline"
            >
              View event →
            </Link>
          </div>
        </div>
      )}

      {isCancelledScreening && !isCancelled && (
        <div className="flex items-start gap-3 p-4 rounded-[10px] border border-[var(--warning)] bg-[var(--warning-subtle)]">
          <AlertTriangle className="w-4 h-4 text-[var(--warning)] shrink-0 mt-0.5" />
          <p className="text-sm text-[var(--warning)]">This screening has been cancelled.</p>
        </div>
      )}

      {/* Ticket card */}
      <div className="rounded-[16px] border border-[var(--rule)] bg-[var(--paper-raised)] overflow-hidden shadow-[var(--elev-1)]">
        {/* Hero: big showtime */}
        <div className="p-6 sm:p-8 border-b border-[var(--rule)] bg-[var(--paper-sunken)]">
          <div className="flex items-start gap-4 sm:gap-6">
            <Poster
              src={booking.event.posterUrl}
              alt={booking.event.title}
              className="w-20 sm:w-28 shrink-0"
            />
            <div className="flex flex-col gap-2 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-caption text-[var(--ink-muted)]">
                  {SHOW_TYPE_LABELS[booking.event.type]} · {booking.event.ageRating}
                </span>
                <StatusBadge status={booking.status} />
              </div>
              <h1
                className="font-display font-medium text-2xl sm:text-3xl text-[var(--ink)] tracking-tight leading-tight"
                style={{ fontVariationSettings: "'SOFT' 60, 'WONK' 0, 'opsz' 36" }}
              >
                {booking.event.title}
              </h1>
              {/* Big showtime */}
              <p className="font-display text-xl text-[var(--ink-secondary)] tabular-nums"
                style={{ fontVariationSettings: "'SOFT' 60, 'WONK' 0, 'opsz' 20" }}>
                {formatShowtime(booking.screening.startsAt)}
              </p>
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="p-6 sm:p-8 flex flex-col gap-6">
          {/* Venue */}
          <div className="flex flex-col gap-1">
            <p className="text-caption text-[var(--ink-muted)]">VENUE</p>
            <p className="text-sm font-medium text-[var(--ink)] flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[var(--ink-muted)]" />
              {booking.venue.name}
            </p>
            <p className="text-sm text-[var(--ink-secondary)]">{booking.venue.address}, {booking.venue.city}</p>
          </div>

          {/* Time */}
          <div className="flex gap-6">
            <div className="flex flex-col gap-1">
              <p className="text-caption text-[var(--ink-muted)]">DATE</p>
              <p className="text-sm text-[var(--ink)] flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5 text-[var(--ink-muted)]" />
                {formatDate(booking.screening.startsAt)}
              </p>
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-caption text-[var(--ink-muted)]">TIME</p>
              <p className="text-sm text-[var(--ink)] flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[var(--ink-muted)]" />
                {formatTime(booking.screening.startsAt)} – {formatTime(booking.screening.endsAt)}
              </p>
            </div>
          </div>

          {/* Seats */}
          {booking.seats.length > 0 && (
            <div className="flex flex-col gap-3">
              <p className="text-caption text-[var(--ink-muted)]">SEATS</p>
              <div className="flex flex-wrap gap-2">
                {booking.seats.map((seat) => (
                  <div
                    key={seat.id}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] border-[1.5px] bg-[var(--paper-raised)] ${categoryBorderClass[seat.category]}`}
                    title={CATEGORY_LABELS[seat.category]}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: CATEGORY_COLORS[seat.category] }}
                    />
                    <span className="text-sm font-medium text-[var(--ink)] tabular-nums">
                      {seat.rowLabel}{seat.seatNumber}
                    </span>
                    <span className="text-caption text-[var(--ink-muted)]">
                      {CATEGORY_LABELS[seat.category]}
                    </span>
                    <span className="text-xs text-[var(--ink-muted)] tabular-nums">
                      {formatINR(seat.price)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Divider */}
          <div className="border-t border-dashed border-[var(--rule)] my-2" />

          {/* Total + reference */}
          <div className="flex items-end justify-between">
            <div className="flex flex-col gap-1">
              <p className="text-caption text-[var(--ink-muted)]">BOOKING REF</p>
              <p className="font-mono text-lg text-[var(--ink)]">{ref}</p>
              {booking.confirmedAt && (
                <p className="text-xs text-[var(--ink-muted)]">
                  Confirmed {formatDate(booking.confirmedAt)}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-caption text-[var(--ink-muted)]">TOTAL PAID</p>
              <p className="font-display text-2xl text-[var(--ink)] tabular-nums"
                style={{ fontVariationSettings: "'SOFT' 60, 'WONK' 0, 'opsz' 24" }}>
                {formatINR(booking.totalAmount)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Back link */}
      <Link
        to="/bookings"
        className="text-sm text-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors link-underline self-start"
      >
        ← All bookings
      </Link>
    </div>
  );
}
