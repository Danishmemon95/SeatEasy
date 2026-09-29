import type React from 'react';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { getRtkErrorMessage } from '../../api/errors';
import { useDeleteSeatMutation, useUpdateSeatMutation } from '../../api/catalog/seatEndpoints';
import { useToast } from '../toast/useToast';
import { SEAT_CATEGORIES, type Seat, type SeatCategory } from '../../types/catalog.types';
import { CATEGORY_LABELS } from '../../utils/catalogDisplay';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { SeatSwatch } from '../../components/ui/SeatSwatch';

const WIDTH = 272;
const MARGIN = 8;

interface AnchoredPopoverProps {
  anchor: HTMLElement;
  title: string;
  onClose: () => void;
  /** While true, outside clicks and Esc don't close (a request is in flight). */
  busy?: boolean;
  children: React.ReactNode;
}

/**
 * A small dialog pinned below (or above, near the bottom edge) its anchor,
 * kept inside the viewport. Closes on Esc, outside click, resize or scroll —
 * the seat it points at would move — and returns focus to the anchor.
 */
const AnchoredPopover: React.FC<AnchoredPopoverProps> = ({ anchor, title, onClose, busy = false, children }) => {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const busyRef = useRef(busy);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    busyRef.current = busy;
    onCloseRef.current = onClose;
  });

  useLayoutEffect(() => {
    const rect = anchor.getBoundingClientRect();
    const height = ref.current?.offsetHeight ?? 0;
    const left = Math.min(
      Math.max(MARGIN, rect.left + rect.width / 2 - WIDTH / 2),
      window.innerWidth - WIDTH - MARGIN,
    );
    const below = rect.bottom + MARGIN;
    const top = below + height > window.innerHeight - MARGIN ? Math.max(MARGIN, rect.top - MARGIN - height) : below;
    setPos({ top, left });
  }, [anchor]);

  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('button:not([disabled])')?.focus();

    const close = () => {
      if (!busyRef.current) onCloseRef.current();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
      }
    };
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!ref.current?.contains(target) && !anchor.contains(target)) close();
    };
    const onScroll = (e: Event) => {
      if (!ref.current?.contains(e.target as Node)) close();
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', onScroll, true);
      // The anchor may be gone (seat removed); focus() on a detached node is a no-op.
      if (anchor.isConnected) anchor.focus();
    };
  }, [anchor]);

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-labelledby={titleId}
      style={{ width: WIDTH, top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}
      className="fixed z-30 bg-[var(--paper-raised)] border border-[var(--rule)] rounded-[10px] shadow-[var(--elev-2)] p-4 flex flex-col gap-3 animate-[toast-in_var(--motion-base)_var(--ease)]"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 id={titleId} className="text-[15px] font-semibold text-[var(--ink)]">
          {title}
        </h3>
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          aria-label="Close"
          className="w-7 h-7 -mr-1.5 inline-flex items-center justify-center rounded-full text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--paper-sunken)] transition-colors cursor-pointer disabled:opacity-40"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      {children}
    </div>,
    document.body,
  );
};

export interface SeatPopoverProps {
  venueId: number;
  seat: Seat;
  anchor: HTMLElement;
  /** How many seats the seat's row has, for the "Delete row" label. */
  rowSeatCount: number;
  onClose: () => void;
  /** Hands off to the editor's confirm dialog. */
  onDeleteRow: (rowLabel: string) => void;
}

/** Edit one seat: change its category, remove it (leaving a gap), or go to deleting its row. */
export const SeatPopover: React.FC<SeatPopoverProps> = ({ venueId, seat, anchor, rowSeatCount, onClose, onDeleteRow }) => {
  const toast = useToast();
  const [updateSeat, { isLoading: isUpdating }] = useUpdateSeatMutation();
  const [deleteSeat, { isLoading: isDeleting }] = useDeleteSeatMutation();
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = isUpdating || isDeleting;
  const name = `${seat.rowLabel}${seat.seatNumber}`;

  const changeCategory = async (category: SeatCategory) => {
    setError(null);
    try {
      await updateSeat({ venueId, seatId: seat.id, category }).unwrap();
      toast(`${name} is now ${CATEGORY_LABELS[category]}`, 'success');
      onClose();
    } catch (err) {
      setError(getRtkErrorMessage(err));
    }
  };

  const removeSeat = async () => {
    setError(null);
    try {
      await deleteSeat({ venueId, seatId: seat.id }).unwrap();
      toast(`Seat ${name} removed`, 'success');
      onClose();
    } catch (err) {
      setError(getRtkErrorMessage(err));
      setConfirmRemove(false);
    }
  };

  return (
    <AnchoredPopover anchor={anchor} title={`Row ${seat.rowLabel} · Seat ${seat.seatNumber}`} onClose={onClose} busy={busy}>
      <div className="flex flex-col gap-2">
        <span className="text-caption text-[var(--ink-muted)]">Category</span>
        <div role="radiogroup" aria-label="Seat category" className="grid grid-cols-3 gap-1 p-1 bg-[var(--paper-sunken)] rounded-[8px] border border-[var(--rule)]">
          {SEAT_CATEGORIES.map((c) => {
            const current = c === seat.category;
            return (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={current}
                disabled={busy}
                onClick={() => !current && changeCategory(c)}
                className={`flex items-center justify-center gap-1.5 h-8 rounded-[6px] text-xs font-medium transition-colors cursor-pointer disabled:cursor-not-allowed ${
                  current
                    ? 'bg-[var(--paper-raised)] text-[var(--ink)] border border-[var(--rule)] shadow-[var(--elev-1)]'
                    : 'text-[var(--ink-secondary)] hover:text-[var(--ink)] hover:bg-[var(--paper-raised)]/60'
                }`}
              >
                <SeatSwatch category={c} className="w-3 h-3" />
                {CATEGORY_LABELS[c]}
              </button>
            );
          })}
        </div>
      </div>

      {error && <Alert variant="warning">{error}</Alert>}

      <div className="flex flex-col gap-1 pt-2 border-t border-[var(--rule)]">
        {confirmRemove ? (
          <div className="flex flex-col gap-2">
            <p className="text-[13px] text-[var(--ink-secondary)]">
              Remove {name}? Its spot becomes a gap in the row.
            </p>
            <div className="flex gap-2">
              <Button variant="danger" size="sm" onClick={removeSeat} isLoading={isDeleting}>
                Remove {name}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmRemove(false)} disabled={isDeleting}>
                Keep
              </Button>
            </div>
          </div>
        ) : (
          <>
            <Button variant="danger-ghost" size="sm" onClick={() => setConfirmRemove(true)} disabled={busy}>
              Remove seat
            </Button>
            <Button
              variant="danger-ghost"
              size="sm"
             
              onClick={() => onDeleteRow(seat.rowLabel)}
              disabled={busy}
            >
              Delete row {seat.rowLabel} ({rowSeatCount} {rowSeatCount === 1 ? 'seat' : 'seats'})
            </Button>
          </>
        )}
      </div>
    </AnchoredPopover>
  );
};

export interface RowPopoverProps {
  rowLabel: string;
  seatCount: number;
  anchor: HTMLElement;
  onClose: () => void;
  onDeleteRow: (rowLabel: string) => void;
}

/** The row-label menu: currently just "Delete row", confirmed by the editor's dialog. */
export const RowPopover: React.FC<RowPopoverProps> = ({ rowLabel, seatCount, anchor, onClose, onDeleteRow }) => (
  <AnchoredPopover anchor={anchor} title={`Row ${rowLabel}`} onClose={onClose}>
    <p className="text-[13px] text-[var(--ink-secondary)] tabular-nums">
      {seatCount} {seatCount === 1 ? 'seat' : 'seats'}
    </p>
    <Button variant="danger-ghost" size="sm" onClick={() => onDeleteRow(rowLabel)}>
      Delete row {rowLabel}
    </Button>
  </AnchoredPopover>
);
