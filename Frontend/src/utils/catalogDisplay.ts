/*
 * Display helpers shared by the catalog components: category names and
 * seat-colour classes, event type and age-rating labels, and the
 * organizer-facing screening status.
 */
import type { AgeRating, ScreeningStatus, SeatCategory, ShowStatus, ShowType } from '../types/catalog.types';

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

export const SHOW_TYPE_LABELS: Record<ShowType, string> = {
  movie: 'Movie',
  concert: 'Concert',
  play: 'Play',
  comedy: 'Comedy',
  sports: 'Sports',
  other: 'Other',
};

/** CBFC certificate meanings, shown beside the rating picker. */
export const AGE_RATING_MEANINGS: Record<AgeRating, string> = {
  U: 'Universal: suitable for all ages',
  UA: 'Parental guidance for children under 12',
  A: 'Adults only (18+)',
};

/** `past` is derived on the client: a scheduled screening whose start time has gone by. */
export type DisplayStatus = ShowStatus | ScreeningStatus | 'past';

/** The status of a screening as the organizer thinks of it. */
export const screeningDisplayStatus = (
  screening: { status: ScreeningStatus; startsAt: string },
  now = Date.now(),
): DisplayStatus =>
  screening.status === 'scheduled' && new Date(screening.startsAt).getTime() <= now ? 'past' : screening.status;

/**
 * Why a screening can no longer be edited, or null if it can. Mirrors the
 * checks in the API's updateScreening; cancelling stays possible in the last case.
 */
export const screeningLockReason = (
  screening: { status: ScreeningStatus; startsAt: string; seats: { held: number; booked: number } },
  now = Date.now(),
): string | null => {
  if (screening.status === 'cancelled') return "Cancelled screenings can't be changed.";
  if (new Date(screening.startsAt).getTime() <= now) return 'This screening has started.';
  if (screening.seats.held + screening.seats.booked > 0) {
    return 'Seats are held or booked, so venue, time and prices are locked. You can still cancel it.';
  }
  return null;
};
