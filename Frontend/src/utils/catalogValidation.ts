/**
 * Client-side validation for the catalog forms.
 *
 * Each rule and message mirrors the backend zod schemas (venueSchemas,
 * seatSchemas, showSchemas, screeningSchemas) so the inline error matches what
 * the server would say. The server stays the authority: on a 400, its
 * `errors[]` are mapped onto the form with getFieldErrors.
 *
 * Every validator returns null when valid, or the error message.
 */
import type { SeatCategory, SeatRowInput } from '../types/catalog.types';
import { MAX_DAYS_AHEAD, MIN_LEAD_HOURS } from './datetime';

type Rule = string | null;

const lengthRule = (value: string, label: string, min: number, max: number): Rule => {
  const trimmed = value.trim();
  if (trimmed.length < min) return `${label} must be at least ${min} characters`;
  if (trimmed.length > max) return `${label} cannot exceed ${max} characters`;
  return null;
};

// ---- Venue ---------------------------------------------------------------

export const validateVenueName = (v: string): Rule => lengthRule(v, 'Venue name', 2, 100);
export const validateVenueCity = (v: string): Rule => lengthRule(v, 'Venue city', 2, 100);
export const validateVenueAddress = (v: string): Rule => lengthRule(v, 'Venue address', 5, 300);

// ---- Seat rows -----------------------------------------------------------

export const ROW_LABEL_REGEX = /^[A-Z]{1,3}$/;
export const MAX_ROWS_PER_REQUEST = 100;
export const MAX_SEATS_PER_ROW = 100;

export const validateRowLabel = (label: string): Rule =>
  ROW_LABEL_REGEX.test(label.trim().toUpperCase()) ? null : 'Row label must be 1 to 3 letters, e.g. A or AA';

export const validateSeatCount = (value: number | string): Rule => {
  const n = typeof value === 'number' ? value : Number(value);
  if (value === '' || !Number.isFinite(n)) return 'A row needs at least 1 seat';
  if (!Number.isInteger(n)) return 'Seat count must be a whole number';
  if (n < 1) return 'A row needs at least 1 seat';
  if (n > MAX_SEATS_PER_ROW) return `A row cannot have more than ${MAX_SEATS_PER_ROW} seats`;
  return null;
};

export interface SeatRowErrors {
  row?: string;
  seats?: string;
}

/**
 * Validates a batch of rows before POST /seats. Besides the per-row rules, a
 * label may appear once in the batch and must not already exist in the venue
 * (the server answers that with a 409; catching it here names the row).
 */
export const validateSeatRows = (
  rows: Array<Pick<SeatRowInput, 'row' | 'category'> & { seats: number | string }>,
  existingLabels: ReadonlySet<string>,
): { rowErrors: SeatRowErrors[]; formError: string | null } => {
  const seen = new Map<string, number>();
  for (const r of rows) {
    const label = r.row.trim().toUpperCase();
    seen.set(label, (seen.get(label) ?? 0) + 1);
  }

  const rowErrors = rows.map((r): SeatRowErrors => {
    const label = r.row.trim().toUpperCase();
    const errors: SeatRowErrors = {};
    const labelError = validateRowLabel(label);
    if (labelError) errors.row = labelError;
    else if ((seen.get(label) ?? 0) > 1) errors.row = 'Each row label can only appear once';
    else if (existingLabels.has(label)) errors.row = `Row ${label} already exists in this venue`;
    const seatsError = validateSeatCount(r.seats);
    if (seatsError) errors.seats = seatsError;
    return errors;
  });

  let formError: string | null = null;
  if (rows.length === 0) formError = 'Provide at least one row';
  else if (rows.length > MAX_ROWS_PER_REQUEST) formError = `Cannot add more than ${MAX_ROWS_PER_REQUEST} rows at once`;

  return { rowErrors, formError };
};

/** The label after `label`: A → B, Z → AA, AZ → BA, ZZZ → null (no more room). */
export const nextRowLabel = (label: string): string | null => {
  const chars = label.toUpperCase().split('');
  let i = chars.length - 1;
  while (i >= 0) {
    if (chars[i] !== 'Z') {
      chars[i] = String.fromCharCode(chars[i].charCodeAt(0) + 1);
      return chars.join('');
    }
    chars[i] = 'A';
    i--;
  }
  return chars.length >= 3 ? null : 'A'.repeat(chars.length + 1);
};

/** Sort key matching the API's order: shorter labels first, then alphabetical (Z before AA). */
export const compareRowLabels = (a: string, b: string): number =>
  a.length - b.length || a.localeCompare(b);

// ---- Show (event) --------------------------------------------------------

export const validateShowTitle = (v: string): Rule => lengthRule(v, 'Title', 2, 100);
export const validateShowDescription = (v: string): Rule => lengthRule(v, 'Description', 10, 5000);
export const validateShowLanguage = (v: string): Rule => lengthRule(v, 'Language', 2, 50);

/** Genre is optional: empty is valid (sent as null on edit). */
export const validateShowGenre = (v: string): Rule =>
  v.trim() === '' ? null : lengthRule(v, 'Genre', 2, 50);

export const MAX_DURATION_MINUTES = 12 * 60;

export const validateDuration = (value: number | string): Rule => {
  const n = typeof value === 'number' ? value : Number(value);
  if (value === '' || !Number.isFinite(n)) return 'Duration must be at least 1 minute';
  if (!Number.isInteger(n)) return 'Duration must be a whole number of minutes';
  if (n < 1) return 'Duration must be at least 1 minute';
  if (n > MAX_DURATION_MINUTES) return `Duration cannot exceed ${MAX_DURATION_MINUTES} minutes`;
  return null;
};

/** Poster is optional: empty is valid. Otherwise an https URL of at most 2000 characters. */
export const validatePosterUrl = (v: string): Rule => {
  const trimmed = v.trim();
  if (trimmed === '') return null;
  if (trimmed.length > 2000) return 'Poster URL cannot exceed 2000 characters';
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'https:') return 'Poster URL must be a valid https URL';
  } catch {
    return 'Poster URL must be a valid https URL';
  }
  return null;
};

// ---- Screening -----------------------------------------------------------

export const validateScreeningVenue = (venueId: number | null): Rule =>
  venueId ? null : 'A valid venueId is required';

/** The start must fall in [now + 24 h, now + 180 d]; `startsAt` is an ISO string with offset. */
export const validateStartsAt = (startsAt: string, now = Date.now()): Rule => {
  const t = new Date(startsAt).getTime();
  if (!Number.isFinite(t)) return 'Pick a date and a time';
  if (t < now + MIN_LEAD_HOURS * 60 * 60 * 1000) {
    return `A screening must start at least ${MIN_LEAD_HOURS} hours from now`;
  }
  if (t > now + MAX_DAYS_AHEAD * 24 * 60 * 60 * 1000) {
    return `A screening can't be scheduled more than ${MAX_DAYS_AHEAD} days ahead`;
  }
  return null;
};

export const validatePrice = (value: string): Rule => {
  if (value.trim() === '') return 'Enter a price';
  const n = Number(value);
  if (!Number.isFinite(n)) return 'Enter a price';
  if (n < 0) return 'Price cannot be negative';
  if (n > 100000) return 'Price cannot exceed 100000';
  if (Math.abs(n * 100 - Math.round(n * 100)) >= 1e-6) return 'Price can have at most 2 decimal places';
  return null;
};

/** One price per category the venue actually has; categories it lacks must not be sent. */
export const validatePrices = (
  prices: Partial<Record<SeatCategory, string>>,
  categories: readonly SeatCategory[],
): Partial<Record<SeatCategory, string>> => {
  const errors: Partial<Record<SeatCategory, string>> = {};
  for (const c of categories) {
    const error = validatePrice(prices[c] ?? '');
    if (error) errors[c] = error;
  }
  return errors;
};
