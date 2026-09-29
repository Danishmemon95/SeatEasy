/*
 * Display helpers shared by the catalog components: category names and
 * seat-colour classes, and the organizer-facing screening status.
 */
import type { ScreeningStatus, SeatCategory, ShowStatus } from '../types/catalog.types';

export const CATEGORY_LABELS: Record<SeatCategory, string> = {
  gold: 'Gold',
  platinum: 'Platinum',
  sofa: 'Sofa',
};

/** Tailwind classes for a seat of each category: border hue plus subtle fill (§3.5). */
export const categoryBorderClass: Record<SeatCategory, string> = {
  gold: 'border-[var(--seat-gold)]',
  platinum: 'border-[var(--seat-platinum)]',
  sofa: 'border-[var(--seat-sofa)]',
};

export const categoryFillClass: Record<SeatCategory, string> = {
  gold: 'bg-[var(--seat-gold-fill)]',
  platinum: 'bg-[var(--seat-platinum-fill)]',
  sofa: 'bg-[var(--seat-sofa-fill)]',
};

/** `past` is derived on the client: a scheduled screening whose start time has gone by. */
export type DisplayStatus = ShowStatus | ScreeningStatus | 'past';

/** The status of a screening as the organizer thinks of it. */
export const screeningDisplayStatus = (
  screening: { status: ScreeningStatus; startsAt: string },
  now = Date.now(),
): DisplayStatus =>
  screening.status === 'scheduled' && new Date(screening.startsAt).getTime() <= now ? 'past' : screening.status;
