import type React from 'react';
import { useMemo, useRef, useState } from 'react';
import type { Seat, SeatRowInput } from '../../types/catalog.types';
import { CATEGORY_LABELS, categoryBorderClass } from '../../utils/catalogDisplay';
import { compareRowLabels } from '../../utils/catalogValidation';

interface LayoutRow {
  label: string;
  /** Saved seats, ascending by number. Missing numbers are gaps. */
  seats: Seat[];
  /** Set for a row that is only a pending preview from the add-rows panel. */
  draft?: Pick<SeatRowInput, 'seats' | 'category'>;
}

export interface SeatLayoutMapProps {
  seats: Seat[];
  /** Valid, unsaved rows from the add-rows panel, drawn dashed. */
  draftRows?: SeatRowInput[];
  /** False in read-only (locked) mode: seats are shown but can't be opened. */
  interactive: boolean;
  /** The seat whose popover is open, highlighted on the map. */
  activeSeatId?: number | null;
  onSeatActivate?: (seat: Seat, anchor: HTMLElement) => void;
  onRowActivate?: (rowLabel: string, anchor: HTMLElement) => void;
}

const buildRows = (seats: Seat[], draftRows: SeatRowInput[]): LayoutRow[] => {
  const byLabel = new Map<string, Seat[]>();
  for (const seat of seats) {
    const list = byLabel.get(seat.rowLabel);
    if (list) list.push(seat);
    else byLabel.set(seat.rowLabel, [seat]);
  }
  const rows: LayoutRow[] = [...byLabel].map(([label, list]) => ({
    label,
    seats: [...list].sort((a, b) => a.seatNumber - b.seatNumber),
  }));
  for (const d of draftRows) {
    if (!byLabel.has(d.row)) rows.push({ label: d.row, seats: [], draft: { seats: d.seats, category: d.category } });
  }
  return rows.sort((a, b) => compareRowLabels(a.label, b.label));
};

// 32px seats on mobile, 28px from md (design §10.3), with a 6px gap.
const CELL = 'w-8 h-8 md:w-7 md:h-7 shrink-0';

/**
 * The venue's seat layout on a sunken canvas, stage at the top. Rows run in
 * API order; each seat sits at its number's position, so a deleted seat leaves
 * a real gap — the only aisle mechanism the schema has.
 *
 * Keyboard: one seat is in the tab order (roving tabindex); arrow keys move
 * between seats, Home/End jump to a row's ends, Enter opens the seat.
 */
export const SeatLayoutMap: React.FC<SeatLayoutMapProps> = ({
  seats,
  draftRows = [],
  interactive,
  activeSeatId,
  onSeatActivate,
  onRowActivate,
}) => {
  const rows = useMemo(() => buildRows(seats, draftRows), [seats, draftRows]);
  const savedRows = useMemo(() => rows.filter((r) => r.seats.length > 0), [rows]);

  const seatRefs = useRef(new Map<number, HTMLButtonElement>());
  const [focusId, setFocusId] = useState<number | null>(null);
  // Fall back to the first seat when nothing (or a since-deleted seat) holds focus.
  const tabStopId = seats.some((s) => s.id === focusId) ? focusId : (savedRows[0]?.seats[0]?.id ?? null);

  const moveFocus = (seat: Seat, e: React.KeyboardEvent) => {
    const rowIndex = savedRows.findIndex((r) => r.label === seat.rowLabel);
    const row = savedRows[rowIndex];
    const i = row.seats.findIndex((s) => s.id === seat.id);
    const nearestIn = (target: LayoutRow) =>
      target.seats.reduce((best, s) =>
        Math.abs(s.seatNumber - seat.seatNumber) < Math.abs(best.seatNumber - seat.seatNumber) ? s : best,
      );

    let next: Seat | undefined;
    switch (e.key) {
      case 'ArrowLeft':
        next = row.seats[i - 1];
        break;
      case 'ArrowRight':
        next = row.seats[i + 1];
        break;
      case 'ArrowUp':
        next = savedRows[rowIndex - 1] && nearestIn(savedRows[rowIndex - 1]);
        break;
      case 'ArrowDown':
        next = savedRows[rowIndex + 1] && nearestIn(savedRows[rowIndex + 1]);
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
  };

  const renderSeat = (seat: Seat) => {
    const label = `Row ${seat.rowLabel}, seat ${seat.seatNumber}, ${CATEGORY_LABELS[seat.category]}`;
    const base = `${CELL} relative inline-flex items-center justify-center rounded-[4px] border-[1.5px] bg-[var(--paper-raised)] text-[10px] md:text-[11px] tabular-nums text-[var(--ink-secondary)] select-none ${categoryBorderClass[seat.category]}`;

    if (!interactive) {
      return (
        <span key={seat.id} role="img" aria-label={label} title={label} className={base}>
          {seat.seatNumber}
        </span>
      );
    }

    const active = seat.id === activeSeatId;
    return (
      <button
        key={seat.id}
        ref={(el) => {
          if (el) seatRefs.current.set(seat.id, el);
          else seatRefs.current.delete(seat.id);
        }}
        type="button"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={active}
        tabIndex={seat.id === tabStopId ? 0 : -1}
        onClick={(e) => {
          setFocusId(seat.id);
          onSeatActivate?.(seat, e.currentTarget);
        }}
        onKeyDown={(e) => moveFocus(seat, e)}
        className={[
          base,
          'cursor-pointer transition-[background-color,box-shadow,transform] duration-[150ms] ease-[cubic-bezier(0.25,0.1,0.25,1)]',
          'hover:bg-[var(--paper-sunken)] hover:-translate-y-px',
          'focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-2',
          // 44px touch target without changing the visual size (§5.4).
          "pointer-coarse:before:content-[''] pointer-coarse:before:absolute pointer-coarse:before:-inset-1.5",
          active ? 'shadow-[0_0_0_2px_var(--paper-sunken),0_0_0_4px_var(--accent)]' : '',
        ].join(' ')}
      >
        {seat.seatNumber}
      </button>
    );
  };

  const renderRow = (row: LayoutRow) => {
    const labelClass = 'w-8 shrink-0 text-caption text-[var(--ink-muted)] text-center';

    if (row.draft) {
      const { seats: count, category } = row.draft;
      return (
        <div key={row.label} className="flex items-center gap-1.5" aria-hidden="true">
          <span className={`${labelClass} text-[var(--ink-faint)]`}>{row.label}</span>
          {Array.from({ length: count }, (_, i) => (
            <span
              key={i}
              className={`${CELL} inline-flex items-center justify-center rounded-[4px] border-[1.5px] border-dashed opacity-70 text-[10px] md:text-[11px] tabular-nums text-[var(--ink-muted)] ${categoryBorderClass[category]}`}
            >
              {i + 1}
            </span>
          ))}
          <span className={`${labelClass} text-[var(--ink-faint)]`}>{row.label}</span>
        </div>
      );
    }

    // Cells 1..highest seat number; numbers with no seat render as empty space.
    const byNumber = new Map(row.seats.map((s) => [s.seatNumber, s]));
    const last = row.seats[row.seats.length - 1].seatNumber;

    return (
      <div key={row.label} className="flex items-center gap-1.5">
        {interactive && onRowActivate ? (
          <button
            type="button"
            // Mouse shortcut to the row menu; keyboard users reach the same
            // actions from any seat's popover, so this stays out of the tab order.
            tabIndex={-1}
            onClick={(e) => onRowActivate(row.label, e.currentTarget)}
            aria-label={`Row ${row.label} options`}
            className={`${labelClass} h-7 rounded-[4px] cursor-pointer hover:text-[var(--ink)] hover:bg-[var(--paper-raised)] transition-colors`}
          >
            {row.label}
          </button>
        ) : (
          <span className={labelClass}>{row.label}</span>
        )}
        {Array.from({ length: last }, (_, i) => {
          const seat = byNumber.get(i + 1);
          return seat ? renderSeat(seat) : <span key={`gap-${i + 1}`} className={CELL} aria-hidden="true" />;
        })}
        <span className={labelClass} aria-hidden="true">
          {row.label}
        </span>
      </div>
    );
  };

  return (
    <div className="bg-[var(--paper-sunken)] border border-[var(--rule)] rounded-[10px] overflow-x-auto">
      {/* w-max + mx-auto: centred when it fits, scrolls inside the canvas when it doesn't. */}
      <div className="w-max mx-auto px-6 py-8 flex flex-col items-start gap-1.5">
        <div className="self-stretch flex flex-col items-center mb-6" aria-hidden="true">
          <svg viewBox="0 0 400 24" preserveAspectRatio="none" className="w-full min-w-[240px] h-6 text-[var(--rule-strong)]">
            <path d="M4 20 Q200 -4 396 20" fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
          </svg>
          <div className="w-3/4 h-6 -mt-3 bg-linear-to-b from-[var(--rule)] to-transparent opacity-50 rounded-t-full" />
          <span className="text-caption text-[var(--ink-muted)] -mt-3">Stage / Screen</span>
        </div>
        {rows.map(renderRow)}
      </div>
    </div>
  );
};
