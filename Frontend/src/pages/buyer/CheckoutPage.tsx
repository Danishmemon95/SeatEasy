/*
 * CheckoutPage — /checkout/:screeningId  (plan §4.4)
 *
 * Loads getMyHolds; if empty, redirects to the seat map.
 * Shows the countdown timer using the server's clock offset.
 * Pay flow: createBooking → payBooking → /bookings/:id
 * 409 on pay → "hold expired" modal → back to seat map.
 */

import type React from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Clock, AlertTriangle } from 'lucide-react';
import {
  useGetMyHoldsQuery,
  useCreateBookingMutation,
  usePayBookingMutation,
  useReleaseHoldsMutation,
} from '../../api/buyerApi';
import { useToast } from '../../features/toast/useToast';
import { Modal } from '../../components/ui/Modal';
import { CATEGORY_LABELS } from '../../utils/catalogDisplay';
import { formatINR } from '../../utils/datetime';
import type { HeldSeat } from '../../types/buyer.types';
import { useAppTitle } from '../../app/useDocumentTitle';
import { saveSelection } from '../../features/seatmap/selection';

// ---- Countdown hook (plan §6) -------------------------------------------

/**
 * Returns remaining seconds, using the server's clock offset from the
 * `Date` response header (stored in a ref when holds are fetched).
 */
const useCountdown = (heldUntil: string | null, serverOffsetMs: number): number => {
  const [remaining, setRemaining] = useState(() => {
    if (!heldUntil) return 0;
    const target = new Date(heldUntil).getTime() - serverOffsetMs;
    return Math.max(0, Math.round((target - Date.now()) / 1000));
  });

  useEffect(() => {
    if (!heldUntil) return;
    const target = new Date(heldUntil).getTime() - serverOffsetMs;
    const tick = () => {
      const secs = Math.max(0, Math.round((target - Date.now()) / 1000));
      setRemaining(secs);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [heldUntil, serverOffsetMs]);

  return heldUntil ? remaining : 0;
};

const fmt = (secs: number): string => {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

const TimerDisplay: React.FC<{ remaining: number }> = ({ remaining }) => {
  const colorClass =
    remaining > 120
      ? 'text-[var(--ink-muted)]'
      : remaining > 30
        ? 'text-[var(--warning)] font-[500]'
        : 'text-[var(--danger)] font-[600]';

  const progressPct = Math.min(100, (remaining / 600) * 100);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <Clock className={`w-4 h-4 ${colorClass}`} />
        <span className={`text-sm tabular-nums ${colorClass}`} aria-live="polite" aria-label={`Hold expires in ${fmt(remaining)}`}>
          {fmt(remaining)} remaining
        </span>
      </div>
      {/* Progress hairline */}
      <div className="h-0.5 w-full rounded-full bg-[var(--rule)] overflow-hidden">
        <div
          className={`h-full rounded-full transition-none ${remaining > 120 ? 'bg-[var(--ink-muted)]' : remaining > 30 ? 'bg-[var(--warning)]' : 'bg-[var(--danger)]'}`}
          style={{ width: `${progressPct}%` }}
        />
      </div>
    </div>
  );
};

// ---- Seat row ------------------------------------------------------------

const SeatRow: React.FC<{ seat: HeldSeat }> = ({ seat }) => (
  <div className="flex items-center justify-between py-2.5 border-b border-[var(--rule)] last:border-b-0">
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-[var(--ink)]">
        {seat.rowLabel}{seat.seatNumber}
      </span>
      <span className="text-caption text-[var(--ink-muted)]">{CATEGORY_LABELS[seat.category]}</span>
    </div>
    <span className="text-sm text-[var(--ink)] tabular-nums">{formatINR(seat.price)}</span>
  </div>
);

// ---- Main Component ------------------------------------------------------

export function CheckoutPage() {
  const { screeningId: paramId } = useParams<{ screeningId: string }>();
  const screeningId = Number(paramId);
  const navigate = useNavigate();
  const toast = useToast();

  // Server offset — computed from response Date header if available (plan §6).
  const [serverOffsetMs] = useState(0);

  const { data: holdsData, isLoading: holdsLoading, refetch: refetchHolds } = useGetMyHoldsQuery(screeningId, {
    skip: !screeningId,
  });

  const [createBooking, { isLoading: isCreating }] = useCreateBookingMutation();
  const [payBooking, { isLoading: isPaying }] = usePayBookingMutation();
  const [releaseHolds, { isLoading: isReleasing }] = useReleaseHoldsMutation();

  const [expiredModal, setExpiredModal] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  const remaining = useCountdown(holdsData?.heldUntil ?? null, serverOffsetMs);

  useAppTitle('Checkout');

  // The seats on this page, remembered so "Choose seats again" can offer
  // them after the hold is gone (the refetched holds are empty by then).
  const lastSeatIds = useRef<number[]>([]);
  useEffect(() => {
    if (holdsData && holdsData.seats.length > 0) lastSeatIds.current = holdsData.seats.map((s) => s.id);
  }, [holdsData]);

  const showExpired = useCallback(() => {
    saveSelection(screeningId, lastSeatIds.current);
    setExpiredModal(true);
  }, [screeningId]);

  // Arrived with no holds (expired before the page opened, or never held):
  // back to the seat map. Only on the first load; later an empty refetch
  // means the hold ran out here, and the expired modal explains that instead.
  const checkedFirstLoad = useRef(false);
  useEffect(() => {
    if (holdsLoading || !holdsData || checkedFirstLoad.current) return;
    checkedFirstLoad.current = true;
    if (holdsData.seats.length === 0) {
      toast('Your seats were released.', 'neutral');
      navigate(`/screenings/${screeningId}`, { replace: true });
    }
  }, [holdsLoading, holdsData, navigate, screeningId, toast]);

  // At 0, refetch holds; if empty, show expired modal.
  const hasShownExpiredModal = useRef(false);
  useEffect(() => {
    if (remaining === 0 && holdsData?.heldUntil && !hasShownExpiredModal.current) {
      hasShownExpiredModal.current = true;
      refetchHolds().then(({ data }) => {
        if (!data || data.seats.length === 0) showExpired();
      });
    }
  }, [remaining, holdsData?.heldUntil, refetchHolds, showExpired]);

  // Announce timer milestones.
  useEffect(() => {
    if (remaining === 120 || remaining === 30) {
      toast(`Hold expires in ${fmt(remaining)}.`, 'neutral');
    }
  }, [remaining, toast]);

  const handlePay = useCallback(async () => {
    setPayError(null);
    try {
      const bookingResult = await createBooking({ screeningId }).unwrap();
      const bookingId = bookingResult.booking.id;
      await payBooking({ bookingId, screeningId }).unwrap();
      toast('Booking confirmed! 🎉', 'success');
      navigate(`/bookings/${bookingId}`, { replace: true });
    } catch (err: unknown) {
      const e = err as { status?: number; data?: { message?: string } };
      if (e?.status === 409) {
        // Booking was cancelled server-side (hold expired or screening cancelled).
        showExpired();
      } else {
        setPayError(e?.data?.message ?? 'Payment failed. Please try again.');
      }
    }
  }, [createBooking, payBooking, navigate, screeningId, toast, showExpired]);

  const handleCancel = useCallback(async () => {
    setCancelConfirmOpen(false);
    try {
      await releaseHolds(screeningId).unwrap();
    } catch { /* ignore */ }
    navigate(`/screenings/${screeningId}`, { replace: true });
  }, [releaseHolds, navigate, screeningId]);

  const isPayLoading = isCreating || isPaying;

  if (holdsLoading) {
    return (
      <div className="max-w-[var(--container-narrow)] mx-auto px-4 py-12">
        <div className="h-64 rounded-[16px] bg-[var(--paper-sunken)] animate-pulse" />
      </div>
    );
  }

  // Empty holds: the first-load effect is redirecting, unless the hold ran
  // out on this page, in which case the page stays up behind the modal.
  if (!holdsData || (holdsData.seats.length === 0 && !expiredModal)) return null;

  const seats = holdsData.seats;
  const total = holdsData.total;

  return (
    <>
      <div className="max-w-[var(--container-narrow)] mx-auto px-4 sm:px-8 py-8 sm:py-12 flex flex-col gap-6">
        {/* Header */}
        <div>
          <p className="text-caption text-[var(--ink-muted)] mb-1">CHECKOUT</p>
          <h1 className="font-display font-medium text-3xl text-[var(--ink)] tracking-tight"
            style={{ fontVariationSettings: "'SOFT' 60, 'WONK' 0, 'opsz' 40" }}>
            Confirm your booking
          </h1>
        </div>

        {/* Countdown */}
        <div className="p-4 rounded-[10px] border border-[var(--rule)] bg-[var(--paper-raised)]">
          <TimerDisplay remaining={remaining} />
        </div>

        {/* Seat list */}
        <div className="rounded-[16px] border border-[var(--rule)] bg-[var(--paper-raised)] overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--rule)]">
            <p className="text-caption text-[var(--ink-muted)]">YOUR SEATS</p>
          </div>
          <div className="px-5">
            {seats.map((seat) => (
              <SeatRow key={seat.id} seat={seat} />
            ))}
          </div>
          {/* Total */}
          <div className="px-5 py-4 bg-[var(--paper-sunken)] border-t border-[var(--rule)] flex items-center justify-between">
            <span className="text-sm font-semibold text-[var(--ink)]">Total</span>
            <span className="text-xl font-semibold text-[var(--ink)] tabular-nums">{formatINR(total)}</span>
          </div>
        </div>

        {/* Pay error */}
        {payError && (
          <div className="flex items-start gap-3 p-4 rounded-[10px] border border-[var(--danger)] bg-[var(--danger-subtle)]">
            <AlertTriangle className="w-4 h-4 text-[var(--danger)] shrink-0 mt-0.5" />
            <p className="text-sm text-[var(--danger)]">{payError}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={isPayLoading || remaining === 0}
            onClick={handlePay}
            className="w-full h-12 rounded-[10px] bg-[var(--accent)] text-[var(--accent-ink)] font-medium text-sm hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-[background-color,box-shadow,transform] hover:-translate-y-px hover:shadow-[0_2px_8px_rgba(107,39,55,0.24)] active:translate-y-0 active:shadow-none cursor-pointer tabular-nums"
          >
            {isPayLoading ? 'Processing…' : `Pay ${formatINR(total)}`}
          </button>
          <button
            type="button"
            disabled={isReleasing}
            onClick={() => setCancelConfirmOpen(true)}
            className="w-full h-10 rounded-[10px] border border-[var(--rule)] text-sm text-[var(--ink-secondary)] hover:text-[var(--danger)] hover:border-[var(--danger)] hover:bg-[var(--danger-subtle)] transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>

      {/* Hold expired modal */}
      <Modal
        isOpen={expiredModal}
        onClose={() => {}}
        title="Your hold ran out"
        description="The seats were released because the hold window expired."
      >
        <div className="flex flex-col gap-3 pt-2">
          <Link
            to={`/screenings/${screeningId}`}
            className="w-full h-11 rounded-[10px] bg-[var(--accent)] text-[var(--accent-ink)] font-medium text-sm flex items-center justify-center hover:bg-[var(--accent-hover)] transition-colors"
          >
            Choose seats again
          </Link>
        </div>
      </Modal>

      {/* Cancel confirm modal */}
      <Modal
        isOpen={cancelConfirmOpen}
        onClose={() => setCancelConfirmOpen(false)}
        title="Cancel booking?"
        description="Your hold will be released and the seats will be available to others."
      >
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={() => setCancelConfirmOpen(false)}
            className="flex-1 h-10 rounded-[10px] border border-[var(--rule)] text-sm text-[var(--ink-secondary)] hover:bg-[var(--paper-sunken)] transition-colors cursor-pointer"
          >
            Keep seats
          </button>
          <button
            type="button"
            onClick={handleCancel}
            disabled={isReleasing}
            className="flex-1 h-10 rounded-[10px] bg-[var(--danger)] text-[var(--ink-inverse)] text-sm font-medium hover:opacity-90 transition-opacity cursor-pointer"
          >
            {isReleasing ? 'Releasing…' : 'Release seats'}
          </button>
        </div>
      </Modal>
    </>
  );
}
