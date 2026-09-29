import type { SeatCategory, SeatRowInput } from '../../types/catalog.types';
import { compareRowLabels, nextRowLabel, validateRowLabel, validateSeatCount } from '../../utils/catalogValidation';

/** One editable line: `Row [A] · Seats [12] · Category [Gold]`. Seats stay a string while typing. */
export interface DraftRowLine {
  key: number;
  row: string;
  seats: string;
  category: SeatCategory;
}

let nextKey = 1;
export const makeLine = (row: string, seats = '10', category: SeatCategory = 'gold'): DraftRowLine => ({
  key: nextKey++,
  row,
  seats,
  category,
});

/**
 * The lines that are complete and valid on their own, as rows to preview on
 * the map. A repeated label previews once; the panel flags the duplicate.
 */
export const previewRows = (lines: DraftRowLine[]): SeatRowInput[] => {
  const seen = new Set<string>();
  const rows: SeatRowInput[] = [];
  for (const l of lines) {
    const row = l.row.trim().toUpperCase();
    if (validateRowLabel(row) || validateSeatCount(l.seats) || seen.has(row)) continue;
    seen.add(row);
    rows.push({ row, seats: Number(l.seats), category: l.category });
  }
  return rows;
};

/** The label after the highest valid one in use, or "A" when there are none. */
export const suggestLabel = (labels: Iterable<string>): string => {
  const valid = [...labels].map((l) => l.trim().toUpperCase()).filter((l) => !validateRowLabel(l));
  if (valid.length === 0) return 'A';
  const highest = valid.sort(compareRowLabels).at(-1)!;
  return nextRowLabel(highest) ?? '';
};
