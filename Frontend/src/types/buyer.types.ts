/*
 * Buyer-facing types: catalog browsing, seat map, holds and bookings.
 * Reuses SeatCategory, ShowType, AgeRating and Pagination from catalog.types.ts.
 */

import type { AgeRating, Pagination, SeatCategory, ShowType } from './catalog.types';

// ---- City catalog --------------------------------------------------------

export interface CityItem {
  city: string;
  eventCount: number;
}

export interface CitiesResponse {
  success: boolean;
  message: string;
  cities: CityItem[];
}

// ---- Home page -----------------------------------------------------------

export interface HomeNextScreening {
  id: number;
  startsAt: string;
  venue: { id: number; name: string; city: string };
}

export interface CatalogCard {
  id: number;
  title: string;
  type: ShowType;
  genre: string | null;
  language: string;
  durationMinutes: number;
  ageRating: AgeRating;
  posterUrl: string | null;
  nextScreeningAt: string | null;
  minPrice: string | null;
}

export interface FeaturedCard extends CatalogCard {
  nextScreening: HomeNextScreening;
}

export interface HomeSection {
  type: ShowType;
  total: number;
  events: CatalogCard[];
}

export interface HomeResponse {
  success: boolean;
  message: string;
  city: string;
  featured: FeaturedCard[];
  weekend: { total: number; events: CatalogCard[] };
  sections: HomeSection[];
}

// ---- Catalog events (explore) -------------------------------------------

export interface CatalogEvent {
  id: number;
  title: string;
  type: ShowType;
  genre: string | null;
  language: string;
  durationMinutes: number;
  ageRating: AgeRating;
  posterUrl: string | null;
  nextScreeningAt: string | null;
  cities: string[];
  minPrice: string | null;
}

export interface CatalogEventsQuery {
  city?: string;
  date?: string;
  type?: ShowType;
  page?: number;
  pageSize?: number;
}

export interface CatalogEventsResponse {
  success: boolean;
  message: string;
  events: CatalogEvent[];
  pagination: Pagination;
}

// ---- Catalog event detail ------------------------------------------------

export interface ShowtimeVenue {
  id: number;
  name: string;
  city: string;
  address: string;
}

export interface Showtime {
  id: number;
  startsAt: string;
  endsAt: string;
  venue: ShowtimeVenue;
  minPrice: string | null;
  seatsAvailable: number;
  seatsTotal: number;
}

export interface CatalogEventDetail extends CatalogEvent {
  description: string;
  screenings: Showtime[];
}

export interface CatalogEventDetailResponse {
  success: boolean;
  message: string;
  event: CatalogEventDetail;
}

// ---- Seat map ------------------------------------------------------------

export type MapSeatStatus = 'available' | 'held' | 'booked';

export interface MapSeat {
  id: number;
  rowLabel: string;
  seatNumber: number;
  category: SeatCategory;
  price: string;
  status: MapSeatStatus;
}

export interface SeatMapScreening {
  id: number;
  startsAt: string;
  endsAt: string;
  status: 'scheduled' | 'cancelled';
  bookable: boolean;
}

export interface SeatMapEvent {
  id: number;
  title: string;
  type: ShowType;
  durationMinutes: number;
  ageRating: AgeRating;
  posterUrl: string | null;
}

export interface SeatMapVenue {
  id: number;
  name: string;
  city: string;
  address: string;
}

export type SeatMapPrices = Partial<Record<SeatCategory, string>>;

export interface SeatMapSummary {
  available: number;
  held: number;
  booked: number;
  total: number;
}

export interface SeatMapResponse {
  success: boolean;
  message: string;
  screening: SeatMapScreening;
  event: SeatMapEvent;
  venue: SeatMapVenue;
  prices: SeatMapPrices;
  seats: MapSeat[];
  summary: SeatMapSummary;
}

// ---- Holds ---------------------------------------------------------------

export interface HeldSeat {
  id: number;
  rowLabel: string;
  seatNumber: number;
  category: SeatCategory;
  price: string;
}

export interface MyHolds {
  screeningId: number;
  heldUntil: string | null;
  seats: HeldSeat[];
  total: string;
}

export interface MyHoldsResponse {
  success: boolean;
  message: string;
  screeningId: number;
  heldUntil: string | null;
  seats: HeldSeat[];
  total: string;
}

export interface HoldSeatsPayload {
  screeningId: number;
  seatIds: number[];
}

export interface HoldSeatsErrorResponse {
  message: string;
  unavailable?: number[];
  unknown?: number[];
}

// ---- Bookings ------------------------------------------------------------

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled';

export interface BookingSeat {
  id: number;
  rowLabel: string;
  seatNumber: number;
  category: SeatCategory;
  price: string;
}

export interface Booking {
  id: number;
  status: BookingStatus;
  totalAmount: string;
  createdAt: string;
  confirmedAt: string | null;
  screening: {
    id: number;
    startsAt: string;
    endsAt: string;
    status: 'scheduled' | 'cancelled';
  };
  event: {
    id: number;
    title: string;
    posterUrl: string | null;
    ageRating: AgeRating;
    type: ShowType;
  };
  venue: {
    id: number;
    name: string;
    city: string;
    address: string;
  };
  seats: BookingSeat[];
}

export interface BookingResponse {
  success: boolean;
  message: string;
  booking: Booking;
}

export interface BookingListResponse {
  success: boolean;
  message: string;
  bookings: Booking[];
  pagination: Pagination;
}

export interface BookingListQuery {
  status?: BookingStatus;
  page?: number;
  pageSize?: number;
}

export interface UpdateMePayload {
  city: string;
}
