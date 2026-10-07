/*
 * SeatMapPage — /screenings/:screeningId  (plan §4.3, design §10)
 *
 * The core product screen. Handles:
 *   - Seat states (available/selected/yours/held/booked)
 *   - Local selection + sessionStorage persistence
 *   - Live polling (8 s normal, 3 s when >80% sold)
 *   - Continue → holdSeats → navigate to /checkout
 *   - Conflict recovery on 409 and on poll updates
 *   - Signed-out → /login with state.from handoff
 *   - Read-only banner when screening not bookable
 */

import type React from 'react';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { MapPin, Clock, Info, AlertTriangle, Check } from 'lucide-react';
import { buyerApi, useGetSeatMapQuery, useGetMyHoldsQuery, useHoldSeatsMutation } from '../../api/buyerApi';
import { useAuth } from '../../features/auth/useAuth';
import { useToast } from '../../features/toast/useToast';
import { buildSeatMapRows } from '../../features/seatmap/layout';
import { suggestReplacements } from '../../features/seatmap/suggest';
import { clearSelection, loadSelection, saveSelection } from '../../features/seatmap/selection';
import { Poster } from '../../components/ui/Poster';
import { EmptyState } from '../../components/ui/EmptyState';
import { SHOW_TYPE_LABELS, categoryBorderClass, CATEGORY_LABELS } from '../../utils/catalogDisplay';
import { formatShowtime, formatTime, formatINR } from '../../utils/datetime';
import type { MapSeat } from '../../types/buyer.types';
import type { SeatCategory } from '../../types/catalog.types';
import { useAppTitle } from '../../app/useDocumentTitle';

const MAX_SEATS = 10;


// ---- Legend --------------------------------------------------------------
const CATEGORY_COLORS: Record<SeatCategory, string> = {
  gold: 'var(--seat-gold)',
  platinum: 'var(--seat-platinum)',
  sofa: 'var(--seat-sofa)',
};

const SeatLegend: React.FC<{ prices: Partial<Record<SeatCategory, string>> }> = ({ prices }) => (
  <div className="flex flex-wrap items-start gap-4 p-4 border-t border-[var(--rule)] bg-[var(--paper)]">
    {/* Categories */}
    {(['gold', 'platinum', 'sofa'] as SeatCategory[]).map((cat) => (
      prices[cat] ? (
        <div key={cat} className="flex items-center gap-1.5">
          <span
            className="w-5 h-5 rounded-[4px] border-[1.5px] bg-[var(--paper-raised)] shrink-0"
            style={{ borderColor: CATEGORY_COLORS[cat] }}
          />
          <div>
            <p className="text-caption text-[var(--ink)]">{CATEGORY_LABELS[cat]}</p>
            <p className="text-xs text-[var(--ink-muted)] tabular-nums">{formatINR(prices[cat]!)}</p>
          </div>
        </div>
      ) : null
    ))}

    {/* State swatches */}
    <div className="ml-auto flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-1.5">
        <span className="w-5 h-5 rounded-[4px] border-[1.5px] border-dashed border-[var(--rule-strong)] bg-[var(--paper-sunken)] shrink-0" />
        <span className="text-caption text-[var(--ink-muted)]">HELD</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="w-5 h-5 rounded-[4px] bg-[var(--paper-sunken)] opacity-40 shrink-0" />
        <span className="text-caption text-[var(--ink-muted)]">BOOKED</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="w-5 h-5 rounded-[4px] bg-[var(--accent)] shrink-0" />
        <span className="text-caption text-[var(--ink-muted)]">SELECTED</span>
      </div>
    </div>
  </div>
);

// ---- Individual Seat Button ----------------------------------------------
interface SeatButtonProps {
  seat: MapSeat;
  isSelected: boolean;
  isYours: boolean;
  onToggle: (seat: MapSeat) => void;
  tabIndex: number;
  seatRef: (el: HTMLButtonElement | null) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}

const SeatButton: React.FC<SeatButtonProps> = ({
  seat,
  isSelected,
  isYours,
  onToggle,
  tabIndex,
  seatRef,
  onKeyDown,
}) => {
  const isHeld = seat.status === 'held';
  const isBooked = seat.status === 'booked';
  const isInteractive = seat.status === 'available';

  const ariaLabel = [
    `Row ${seat.rowLabel}, seat ${seat.seatNumber}`,
    CATEGORY_LABELS[seat.category],
    formatINR(seat.price),
    isSelected || isYours ? 'selected' : isHeld ? 'held' : isBooked ? 'booked' : 'available',
  ].join(', ');

  if (!isInteractive) {
    return (
      <span
        aria-label={ariaLabel}
        role="img"
        className={[
          'w-8 h-8 md:w-7 md:h-7 shrink-0 relative inline-flex items-center justify-center rounded-[4px] text-[10px] md:text-[11px] tabular-nums select-none',
          isHeld
            ? 'border-[1.5px] border-dashed border-[var(--rule-strong)] bg-[var(--paper-sunken)] text-[var(--ink-faint)]'
            : 'border-none bg-[var(--paper-sunken)] opacity-40 text-[var(--ink-faint)]',
        ].join(' ')}
      >
        {seat.seatNumber}
      </span>
    );
  }

  const active = isSelected || isYours;
  return (
    <button
      type="button"
      ref={seatRef}
      aria-label={ariaLabel}
      aria-pressed={active}
      tabIndex={tabIndex}
      onClick={() => onToggle(seat)}
      onKeyDown={onKeyDown}
      className={[
        'w-8 h-8 md:w-7 md:h-7 shrink-0 relative inline-flex items-center justify-center rounded-[4px] border-[1.5px] text-[10px] md:text-[11px] tabular-nums select-none cursor-pointer',
        'transition-[background-color,box-shadow,transform] duration-[150ms] ease-[cubic-bezier(0.25,0.1,0.25,1)]',
        'focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-2',
        // 44px touch target
        "before:content-[''] before:absolute before:-inset-1.5 before:pointer-events-none",
        active
          ? 'bg-[var(--accent)] border-[var(--accent)] text-[var(--accent-ink)] hover:bg-[var(--accent-hover)]'
          : `bg-[var(--paper-raised)] ${categoryBorderClass[seat.category]} text-[var(--ink-secondary)] hover:bg-[var(--paper-sunken)] hover:-translate-y-px`,
      ].join(' ')}
    >
      {seat.seatNumber}
      {isYours && (
        <Check className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[var(--accent)] rounded-full text-[var(--accent-ink)] p-0.5" />
      )}
    </button>
  );
};

// ---- Main Component ------------------------------------------------------

export function SeatMapPage() {
  const { screeningId: paramId } = useParams<{ screeningId: string }>();
  const screeningId = Number(paramId);
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const toast = useToast();

  // Demand-scaled polling (design §10.9): 8 s normally, 3 s when more than
  // 80% is taken. Derived from the cached map (read without subscribing), so
  // the interval is known before the subscribing query below runs.
  const { data: cachedMap } = buyerApi.endpoints.getSeatMap.useQueryState(screeningId);
  const cachedSummary = cachedMap?.summary;
  const saturation = cachedSummary && cachedSummary.total > 0
    ? (cachedSummary.booked + cachedSummary.held) / cachedSummary.total
    : 0;
  const pollInterval = saturation > 0.8 ? 3000 : 8000;

  const { data: mapData, isLoading, isError, refetch: refetchMap } = useGetSeatMapQuery(
    screeningId,
    {
      skip: !screeningId || isNaN(screeningId),
      pollingInterval: pollInterval,
      skipPollingIfUnfocused: true,
    },
  );

  const { data: holdsData } = useGetMyHoldsQuery(screeningId, {
    skip: !isAuthenticated || !screeningId,
  });

  const [holdSeats, { isLoading: isHolding }] = useHoldSeatsMutation();

  // Local selection state.
  const [selectedIds, setSelectedIds] = useState<number[]>(() => loadSelection(screeningId));
  // Suggestion state (conflict recovery).
  const [suggestions, setSuggestions] = useState<MapSeat[]>([]);

  // Persist selection to sessionStorage.
  useEffect(() => {
    saveSelection(screeningId, selectedIds);
  }, [screeningId, selectedIds]);


  // On each poll, check if any selected seat is now held/booked → conflict recovery.
  const myHeldIds = useMemo(
    () => new Set(holdsData?.seats?.map((s) => s.id) ?? []),
    [holdsData],
  );

  useEffect(() => {
    if (!mapData?.seats) return;
    const statusMap = new Map(mapData.seats.map((s) => [s.id, s.status]));
    // A seat I hold myself also reads as "held" on the public map; that's not a conflict.
    const stolen = selectedIds.filter((id) => {
      if (myHeldIds.has(id)) return false;
      const status = statusMap.get(id);
      return status === 'held' || status === 'booked';
    });
    if (stolen.length === 0) return;

    // Remove stolen seats from selection.
    setSelectedIds((prev) => prev.filter((id) => !stolen.includes(id)));

    // Toast for each stolen seat.
    for (const id of stolen) {
      const seat = mapData.seats.find((s) => s.id === id);
      if (seat) toast(`${seat.rowLabel}${seat.seatNumber} was just taken.`, 'neutral');
    }

    // Suggest replacements.
    const rows = buildSeatMapRows(mapData.seats);
    const selectedSet = new Set(selectedIds.filter((id) => !stolen.includes(id)));
    const lostSeat = mapData.seats.find((s) => s.id === stolen[0]);
    if (lostSeat) {
      const sug = suggestReplacements(lostSeat, rows, selectedSet);
      setSuggestions(sug);
    }
    // selectedIds is a dependency: after this removes the stolen seats it runs
    // once more, finds nothing, and returns early.
  }, [mapData?.seats, myHeldIds, selectedIds, toast]);

  // Keyboard navigation (roving tabindex).
  const rows = useMemo(
    () => (mapData?.seats ? buildSeatMapRows(mapData.seats) : []),
    [mapData],
  );
  const seatRefs = useRef(new Map<number, HTMLButtonElement>());
  const [focusId, setFocusId] = useState<number | null>(null);
  const allSeats = rows.flatMap((r) => r.seats.filter((s) => s.status === 'available'));
  const tabStopId = allSeats.some((s) => s.id === focusId)
    ? focusId
    : (allSeats[0]?.id ?? null);

  const handleKeyDown = useCallback(
    (seat: MapSeat, e: React.KeyboardEvent) => {
      const rowIndex = rows.findIndex((r) => r.label === seat.rowLabel);
      const row = rows[rowIndex];
      const seatIndex = row.seats.findIndex((s) => s.id === seat.id);
      let next: MapSeat | undefined;
      switch (e.key) {
        case 'ArrowLeft':
          next = row.seats[seatIndex - 1];
          break;
        case 'ArrowRight':
          next = row.seats[seatIndex + 1];
          break;
        case 'ArrowUp':
          if (rows[rowIndex - 1]) {
            const target = rows[rowIndex - 1];
            next = target.seats.reduce((best, s) =>
              Math.abs(s.seatNumber - seat.seatNumber) < Math.abs(best.seatNumber - seat.seatNumber) ? s : best,
            );
          }
          break;
        case 'ArrowDown':
          if (rows[rowIndex + 1]) {
            const target = rows[rowIndex + 1];
            next = target.seats.reduce((best, s) =>
              Math.abs(s.seatNumber - seat.seatNumber) < Math.abs(best.seatNumber - seat.seatNumber) ? s : best,
            );
          }
          break;
        case 'Home':
          next = row.seats[0];
          break;
        case 'End':
          next = row.seats[row.seats.length - 1];
          break;
        default:
          return;
      }
      e.preventDefault();
      if (next) {
        setFocusId(next.id);
        seatRefs.current.get(next.id)?.focus();
      }
    },
    [rows],
  );

  const toggleSeat = useCallback(
    (seat: MapSeat) => {
      setSelectedIds((prev) => {
        if (prev.includes(seat.id)) {
          return prev.filter((id) => id !== seat.id);
        }
        const alreadyHeld = myHeldIds.has(seat.id) ? 0 : 0;
        const maxSelectable = MAX_SEATS - myHeldIds.size + alreadyHeld;
        if (prev.length >= maxSelectable) {
          toast(`You can choose up to ${MAX_SEATS} seats.`);
          return prev;
        }
        return [...prev, seat.id];
      });
    },
    [myHeldIds, toast],
  );

  const handleContinue = async () => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: location }, replace: false });
      return;
    }

    const allToHold = [...new Set([...selectedIds, ...myHeldIds])];
    if (allToHold.length === 0) {
      toast('Select at least one seat first.');
      return;
    }

    try {
      await holdSeats({ screeningId, seatIds: allToHold }).unwrap();
      clearSelection(screeningId);
      navigate(`/checkout/${screeningId}`);
    } catch (err: unknown) {
      const e = err as { data?: { unavailable?: number[]; message?: string } };
      if (e?.data?.unavailable) {
        // Conflict recovery
        const unavailableIds = e.data.unavailable;
        setSelectedIds((prev) => prev.filter((id) => !unavailableIds.includes(id)));
        for (const id of unavailableIds) {
          const seat = mapData?.seats?.find((s) => s.id === id);
          if (seat) toast(`${seat.rowLabel}${seat.seatNumber} was just taken.`, 'neutral');
        }
        // Suggest replacements
        if (mapData?.seats) {
          const seatRows = buildSeatMapRows(mapData.seats);
          const lostSeat = mapData.seats.find((s) => s.id === unavailableIds[0]);
          if (lostSeat) {
            const remaining = new Set(selectedIds.filter((id) => !unavailableIds.includes(id)));
            setSuggestions(suggestReplacements(lostSeat, seatRows, remaining));
          }
        }
        refetchMap();
      } else {
        toast(e?.data?.message ?? 'Something went wrong. Please try again.', 'danger');
      }
    }
  };

  useAppTitle(mapData?.event?.title ? `Seat map — ${mapData.event.title}` : 'Seat map');

  if (isLoading) {
    return (
      <div className="max-w-[var(--container-wide)] mx-auto px-4 py-8">
        <div className="h-96 rounded-[10px] bg-[var(--paper-sunken)] animate-pulse" />
      </div>
    );
  }

  if (isError || !mapData) {
    return (
      <div className="max-w-[var(--container-default)] mx-auto px-4 py-16">
        <EmptyState
          heading="Couldn't load the seat map"
          action={{ label: 'Retry', onClick: refetchMap }}
        />
      </div>
    );
  }

  const { screening, event, venue, prices, seats, summary } = mapData;
  const isBookable = screening.bookable;
  const isCancelled = screening.status === 'cancelled';

  const totalSelected = selectedIds.length + myHeldIds.size;
  const totalAmount = seats
    .filter((s) => selectedIds.includes(s.id) || myHeldIds.has(s.id))
    .reduce((sum, s) => sum + Number(s.price), 0);

  return (
    <div className="max-w-[var(--container-wide)] mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col gap-6">
      {/* Event info */}
      <div className="flex items-start gap-4">
        <Poster src={event.posterUrl} alt={event.title} className="w-14 shrink-0" />
        <div>
          <p className="text-caption text-[var(--ink-muted)]">
            {SHOW_TYPE_LABELS[event.type]} · {event.ageRating}
          </p>
          <h1 className="font-display font-medium text-xl sm:text-2xl text-[var(--ink)] tracking-tight"
            style={{ fontVariationSettings: "'SOFT' 60, 'WONK' 0, 'opsz' 24" }}>
            {event.title}
          </h1>
          <p className="text-sm text-[var(--ink-secondary)] flex items-center gap-1 mt-0.5">
            <Clock className="w-3.5 h-3.5 text-[var(--ink-muted)]" />
            {formatShowtime(screening.startsAt)} – {formatTime(screening.endsAt)}
          </p>
          <p className="text-sm text-[var(--ink-secondary)] flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-[var(--ink-muted)]" />
            {venue.name} · {venue.city}
          </p>
        </div>
      </div>

      {/* Non-bookable banner */}
      {!isBookable && (
        <div className="flex items-start gap-3 p-4 rounded-[10px] border border-[var(--warning)] bg-[var(--warning-subtle)] text-[var(--warning)]">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-sm">
              {isCancelled ? 'This screening has been cancelled.' : 'This screening has started.'}
            </p>
            <p className="text-xs mt-0.5 opacity-80">
              Seat selection is not available.
            </p>
          </div>
        </div>
      )}

      {/* Conflict recovery suggestions */}
      {suggestions.length > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-[10px] border border-[var(--info)] bg-[var(--info-subtle)]">
          <Info className="w-5 h-5 text-[var(--info)] shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-[var(--ink)] mb-2">Suggested alternatives:</p>
            <div className="flex gap-2 flex-wrap">
              {suggestions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    toggleSeat(s);
                    setSuggestions([]);
                  }}
                  className="px-3 py-1.5 rounded-[6px] border border-[var(--rule)] bg-[var(--paper-raised)] text-xs font-medium text-[var(--ink)] hover:border-[var(--rule-strong)] hover:bg-[var(--paper-sunken)] transition-colors cursor-pointer"
                >
                  {s.rowLabel}{s.seatNumber} · {CATEGORY_LABELS[s.category]} · {formatINR(s.price)}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSuggestions([])}
            className="text-xs text-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors cursor-pointer"
            aria-label="Dismiss suggestions"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Map canvas + summary: flex row on desktop, column on mobile */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Seat canvas */}
        <div className="flex-1 min-w-0 flex flex-col rounded-[10px] border border-[var(--rule)] overflow-hidden">
          {/* Screen / Stage indicator */}
          <div className="bg-[var(--paper-sunken)] px-6 pt-6 pb-4 flex flex-col items-center" aria-hidden="true">
            <svg viewBox="0 0 400 24" preserveAspectRatio="none" className="w-full max-w-md h-6 text-[var(--rule-strong)]">
              <path d="M4 20 Q200 -4 396 20" fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
            </svg>
            <div className="w-3/4 max-w-xs h-6 -mt-3 bg-gradient-to-b from-[var(--rule)] to-transparent opacity-50 rounded-t-full" />
            <span className="text-caption text-[var(--ink-muted)] -mt-2">
              {event.type === 'movie' ? 'SCREEN' : 'STAGE'}
            </span>
          </div>

          {/* Rows */}
          <div className="bg-[var(--paper-sunken)] overflow-x-auto flex-1">
            <div
              role="grid"
              aria-label="Seat map"
              className="w-max mx-auto px-6 pb-6 flex flex-col gap-1.5"
            >
              {rows.map((row) => {
                const last = row.seats[row.seats.length - 1]?.seatNumber ?? 0;
                const byNumber = new Map(row.seats.map((s) => [s.seatNumber, s]));
                return (
                  <div key={row.label} role="row" className="flex items-center gap-1.5">
                    <span className="w-8 shrink-0 text-caption text-[var(--ink-muted)] text-center">
                      {row.label}
                    </span>
                    {Array.from({ length: last }, (_, i) => {
                      const seat = byNumber.get(i + 1);
                      if (!seat)
                        return <span key={`gap-${i}`} className="w-8 h-8 md:w-7 md:h-7 shrink-0" aria-hidden="true" />;
                      const isSelected = selectedIds.includes(seat.id);
                      const isYours = myHeldIds.has(seat.id);
                      return (
                        <SeatButton
                          key={seat.id}
                          seat={seat}
                          isSelected={isSelected}
                          isYours={isYours}
                          onToggle={toggleSeat}
                          tabIndex={seat.id === tabStopId ? 0 : -1}
                          seatRef={(el) => {
                            if (el) seatRefs.current.set(seat.id, el);
                            else seatRefs.current.delete(seat.id);
                          }}
                          onKeyDown={(e) => handleKeyDown(seat, e)}
                        />
                      );
                    })}
                    <span className="w-8 shrink-0 text-caption text-[var(--ink-muted)] text-center" aria-hidden="true">
                      {row.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Legend */}
          <SeatLegend prices={prices} />
        </div>

        {/* Summary bar */}
        <div className="lg:w-72 shrink-0 lg:sticky lg:top-[72px] lg:self-start">
          <div className="rounded-[16px] border border-[var(--rule)] bg-[var(--paper-raised)] overflow-hidden shadow-[var(--elev-1)]">
            <div className="p-5 flex flex-col gap-4">
              <div>
                <p className="text-caption text-[var(--ink-muted)]">SELECTED SEATS</p>
                {totalSelected === 0 ? (
                  <p className="text-sm text-[var(--ink-muted)] mt-1">No seats selected</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {[...myHeldIds, ...selectedIds].map((id) => {
                      const seat = seats.find((s) => s.id === id);
                      if (!seat) return null;
                      return (
                        <span
                          key={id}
                          className="px-2 py-0.5 rounded-[4px] text-xs font-medium bg-[var(--accent-subtle)] text-[var(--accent)] border border-[var(--accent-border)]"
                        >
                          {seat.rowLabel}{seat.seatNumber}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>

              {totalSelected > 0 && (
                <div className="border-t border-[var(--rule)] pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[var(--ink-secondary)]">Total</span>
                    <span className="text-lg font-semibold text-[var(--ink)] tabular-nums">
                      {formatINR(totalAmount)}
                    </span>
                  </div>
                </div>
              )}

              <button
                type="button"
                disabled={!isBookable || (totalSelected === 0) || isHolding}
                onClick={handleContinue}
                className="w-full h-12 rounded-[10px] bg-[var(--accent)] text-[var(--accent-ink)] font-medium text-sm hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-[background-color,box-shadow,transform] hover:-translate-y-px hover:shadow-[0_2px_8px_rgba(107,39,55,0.24)] active:translate-y-0 active:shadow-none cursor-pointer"
              >
                {isHolding ? 'Reserving…' : !isBookable ? (isCancelled ? 'Cancelled' : 'Started') : 'Continue'}
              </button>

              {isBookable && !isAuthenticated && totalSelected > 0 && (
                <p className="text-xs text-[var(--ink-muted)] text-center">
                  You'll be asked to sign in.
                </p>
              )}
            </div>

            {/* Availability summary */}
            <div className="border-t border-[var(--rule)] px-5 py-3 flex items-center justify-between">
              <span className="text-caption text-[var(--ink-muted)]">AVAILABLE</span>
              <span className="text-sm font-medium text-[var(--ink)] tabular-nums">
                {summary.available} / {summary.total}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
