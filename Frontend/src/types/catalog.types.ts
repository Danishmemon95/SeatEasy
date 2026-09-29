/*
 * Venues, seats, shows (UI: "events") and screenings, as the API returns them.
 * Value lists mirror the backend zod schemas; timestamps are ISO strings (UTC).
 */

export type SeatCategory = 'gold' | 'platinum' | 'sofa';
/** Price-ladder order: entry tier first. */
export const SEAT_CATEGORIES: readonly SeatCategory[] = ['gold', 'platinum', 'sofa'];

export type ShowType = 'movie' | 'concert' | 'play' | 'comedy' | 'sports' | 'other';
export const SHOW_TYPES: readonly ShowType[] = ['movie', 'concert', 'play', 'comedy', 'sports', 'other'];

export type AgeRating = 'U' | 'UA' | 'A';
export const AGE_RATINGS: readonly AgeRating[] = ['U', 'UA', 'A'];

export type ShowStatus = 'draft' | 'published';
export type ScreeningStatus = 'scheduled' | 'cancelled';

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PageQuery {
  page?: number;
  pageSize?: number;
}

/** Envelope fields every successful catalog response carries. */
interface ApiEnvelope {
  success: boolean;
  message: string;
}

// ---- Venues --------------------------------------------------------------

export interface Venue {
  id: number;
  ownerId: number;
  name: string;
  city: string;
  address: string;
  createdAt: string;
  updatedAt: string;
}

/** List rows also carry the venue's capacity. */
export interface VenueListItem extends Venue {
  seatCount: number;
}

export interface VenueInput {
  name: string;
  city: string;
  address: string;
}

export interface VenueListQuery extends PageQuery {
  /** Admin only: narrow to one organizer's venues. */
  ownerId?: number;
}

export interface VenueListResponse extends ApiEnvelope {
  venues: VenueListItem[];
  pagination: Pagination;
}

export interface VenueResponse extends ApiEnvelope {
  venue: Venue;
}

// ---- Seats ---------------------------------------------------------------

export interface Seat {
  id: number;
  venueId: number;
  rowLabel: string;
  seatNumber: number;
  category: SeatCategory;
  createdAt: string;
  updatedAt: string;
}

export type SeatSummary = Record<SeatCategory, number> & { total: number };

export interface VenueSeatsResponse extends ApiEnvelope {
  seats: Seat[];
  summary: SeatSummary;
  /** True while an upcoming screening depends on the layout; mutations would 409. */
  layoutLocked: boolean;
}

export interface SeatRowInput {
  row: string;
  seats: number;
  category: SeatCategory;
}

export interface AddSeatRowsResponse extends ApiEnvelope {
  seats: Seat[];
}

export interface SeatResponse extends ApiEnvelope {
  seat: Seat;
}

// ---- Shows (events) ------------------------------------------------------

export interface Show {
  id: number;
  orgId: number;
  title: string;
  description: string;
  type: ShowType;
  genre: string | null;
  language: string;
  durationMinutes: number;
  ageRating: AgeRating;
  posterUrl: string | null;
  status: ShowStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** The compact schedule embedded in GET /shows/:showId. */
export interface ScheduleItem {
  id: number;
  venueId: number;
  venueName: string;
  venueCity: string;
  startsAt: string;
  endsAt: string;
  status: ScreeningStatus;
}

export interface ShowDetail extends Show {
  screenings: ScheduleItem[];
}

export interface ShowInput {
  title: string;
  description: string;
  type: ShowType;
  genre?: string | null;
  language: string;
  durationMinutes: number;
  ageRating: AgeRating;
  posterUrl?: string | null;
}

/** PUT /shows/:id is strict: only these fields, and only the ones that changed. */
export type ShowUpdate = Partial<ShowInput>;

export interface ShowListQuery extends PageQuery {
  status?: ShowStatus;
}

export interface ShowListResponse extends ApiEnvelope {
  shows: Show[];
  pagination: Pagination;
}

export interface ShowResponse extends ApiEnvelope {
  show: Show;
}

export interface ShowDetailResponse extends ApiEnvelope {
  show: ShowDetail;
}

// ---- Screenings ----------------------------------------------------------

/** Server → client: decimals arrive as strings, e.g. "250.00". */
export type Prices = Partial<Record<SeatCategory, string>>;
/** Client → server. */
export type PricesInput = Partial<Record<SeatCategory, number>>;

export interface SeatCounts {
  available: number;
  held: number;
  booked: number;
  total: number;
}

export interface Screening {
  id: number;
  showId: number;
  venueId: number;
  startsAt: string;
  endsAt: string;
  status: ScreeningStatus;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  show?: { id: number; title: string; durationMinutes: number; status: ShowStatus };
  venue: { id: number; name: string; city: string };
  prices: Prices;
  seats: SeatCounts;
}

export interface ScreeningInput {
  venueId: number;
  /** ISO with offset, e.g. 2026-10-05T19:30:00+05:30 (see utils/datetime). */
  startsAt: string;
  prices: PricesInput;
}

export type ScreeningUpdate = Partial<ScreeningInput>;

export interface ScreeningListQuery extends PageQuery {
  status?: ScreeningStatus;
}

export interface ScreeningListResponse extends ApiEnvelope {
  screenings: Screening[];
  pagination: Pagination;
}

export interface ScreeningResponse extends ApiEnvelope {
  screening: Screening;
}
