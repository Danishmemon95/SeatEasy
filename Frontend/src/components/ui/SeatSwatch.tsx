import type React from 'react';
import { SEAT_CATEGORIES, type SeatCategory } from '../../types/catalog.types';
import { CATEGORY_LABELS, categoryBorderClass } from '../../utils/catalogDisplay';
import { formatINR } from '../../utils/datetime';

/** A small seat-shaped swatch in the category's border hue. Decorative: always paired with the name. */
export const SeatSwatch: React.FC<{ category: SeatCategory; className?: string }> = ({ category, className = '' }) => (
  <span
    aria-hidden="true"
    className={`inline-block w-3.5 h-3.5 rounded-[4px] border-[1.5px] bg-[var(--paper-raised)] shrink-0 ${categoryBorderClass[category]} ${className}`}
  />
);

export interface CategoryLegendProps {
  /** Seats per category; categories with 0 are left out unless `showEmpty`. */
  counts?: Partial<Record<SeatCategory, number>>;
  /** Price per category (server strings like "250.00" or numbers). */
  prices?: Partial<Record<SeatCategory, string | number>>;
  showEmpty?: boolean;
  className?: string;
}

/** The always-visible legend (§10.4): swatch, name, and count and/or price, in ladder order. */
export const CategoryLegend: React.FC<CategoryLegendProps> = ({ counts, prices, showEmpty = false, className = '' }) => {
  const categories = SEAT_CATEGORIES.filter(
    (c) => showEmpty || (counts ? (counts[c] ?? 0) > 0 : prices?.[c] !== undefined),
  );
  if (categories.length === 0) return null;

  return (
    <ul className={`flex flex-wrap items-center gap-x-5 gap-y-2 ${className}`}>
      {categories.map((c) => (
        <li key={c} className="flex items-center gap-2 text-[13px] text-[var(--ink-secondary)]">
          <SeatSwatch category={c} />
          <span className="text-caption text-[var(--ink)]">{CATEGORY_LABELS[c]}</span>
          {counts && <span className="tabular-nums text-[var(--ink-muted)]">{counts[c] ?? 0}</span>}
          {prices?.[c] !== undefined && <span className="tabular-nums">{formatINR(prices[c]!)}</span>}
        </li>
      ))}
    </ul>
  );
};
