/*
 * Seat replacement suggestions for conflict recovery (plan §5, design §10.8).
 *
 * When a selected seat is taken by another user, suggest up to 3 replacements:
 *   - same category, status available, not already in the selection
 *   - ranked by distance: |row index diff| × 2 + |seat number diff|
 *   - prefer adjacent runs of the same size when multiple seats are lost
 *
 * Pure function — no side effects, easily unit-tested.
 */

import type { MapSeat } from '../../types/buyer.types';
import type { SeatMapRow } from './layout';
import type { SeatCategory } from '../../types/catalog.types';

const distance = (
  rows: SeatMapRow[],
  a: MapSeat,
  b: MapSeat,
): number => {
  const rowA = rows.findIndex((r) => r.label === a.rowLabel);
  const rowB = rows.findIndex((r) => r.label === b.rowLabel);
  return Math.abs(rowA - rowB) * 2 + Math.abs(a.seatNumber - b.seatNumber);
};

/**
 * Suggests up to `maxSuggestions` replacement seats for the lost seat,
 * ranked by distance from the lost seat's original position.
 */
export const suggestReplacements = (
  lost: MapSeat,
  rows: SeatMapRow[],
  alreadySelected: Set<number>,
  maxSuggestions = 3,
): MapSeat[] => {
  const candidates: MapSeat[] = [];
  for (const row of rows) {
    for (const seat of row.seats) {
      if (
        seat.status === 'available' &&
        seat.category === lost.category &&
        !alreadySelected.has(seat.id) &&
        seat.id !== lost.id
      ) {
        candidates.push(seat);
      }
    }
  }

  return candidates
    .sort((a, b) => distance(rows, a, lost) - distance(rows, b, lost))
    .slice(0, maxSuggestions);
};

/**
 * Suggests an adjacent group of `groupSize` seats in the same category for
 * when multiple seats were lost simultaneously. Falls back to individual
 * suggestions when no run of that length exists.
 */
export const suggestAdjacentGroup = (
  category: SeatCategory,
  rows: SeatMapRow[],
  nearSeat: MapSeat,
  groupSize: number,
  alreadySelected: Set<number>,
): MapSeat[] => {
  // Try to find a consecutive run of `groupSize` available seats.
  for (const row of rows.slice().sort((a, b) => {
    const ai = rows.findIndex((r) => r.label === a.label);
    const bi = rows.findIndex((r) => r.label === b.label);
    const refIdx = rows.findIndex((r) => r.label === nearSeat.rowLabel);
    return Math.abs(ai - refIdx) - Math.abs(bi - refIdx);
  })) {
    const available = row.seats.filter(
      (s) =>
        s.status === 'available' &&
        s.category === category &&
        !alreadySelected.has(s.id),
    );
    // Slide a window of `groupSize` across the available seats.
    for (let i = 0; i <= available.length - groupSize; i++) {
      const run = available.slice(i, i + groupSize);
      // Check they are consecutive by seat number.
      const isConsecutive = run.every((s, j) =>
        j === 0 || s.seatNumber === run[j - 1].seatNumber + 1,
      );
      if (isConsecutive) return run;
    }
  }
  // Fall back: just the closest individual replacements.
  return suggestReplacements(
    nearSeat,
    rows,
    alreadySelected,
    groupSize,
  );
};
