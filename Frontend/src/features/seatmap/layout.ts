/*
 * Shared seat-layout helpers used by both the organizer's SeatLayoutMap and
 * the buyer's seat-map canvas.
 *
 * Moved here from features/venues/SeatLayoutMap.tsx (plan §2.3) so both
 * surfaces can import it without creating a circular dependency.
 */

import type { MapSeat } from '../../types/buyer.types';
import { compareRowLabels } from '../../utils/catalogValidation';

export interface SeatMapRow {
  label: string;
  /** Seats sorted ascending by seatNumber. Missing numbers are rendered as gaps. */
  seats: MapSeat[];
}

/**
 * Groups a flat seat array into sorted rows for rendering.
 * Gaps in seat numbers become visual aisles (rendered as empty space).
 */
export const buildSeatMapRows = (seats: MapSeat[]): SeatMapRow[] => {
  const byLabel = new Map<string, MapSeat[]>();
  for (const seat of seats) {
    const list = byLabel.get(seat.rowLabel);
    if (list) list.push(seat);
    else byLabel.set(seat.rowLabel, [seat]);
  }
  return [...byLabel]
    .map(([label, list]) => ({
      label,
      seats: [...list].sort((a, b) => a.seatNumber - b.seatNumber),
    }))
    .sort((a, b) => compareRowLabels(a.label, b.label));
};
