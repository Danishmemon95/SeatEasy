import { catalogApi } from '../catalogApi';
import { getErrorStatus } from '../errors';
import type {
  ScreeningInput,
  ScreeningListQuery,
  ScreeningListResponse,
  ScreeningResponse,
  ScreeningUpdate,
} from '../../types/catalog.types';

/*
 * Screenings: listed and created under /api/shows/:showId/screenings, managed
 * at /api/screenings/:screeningId. Access follows the show's owner.
 *
 * Every write touches more than the screening: the show's schedule (the event
 * page, the duration lock) and the venue's layout lock (an upcoming screening
 * freezes the venue's seats). So writes carry the show and venue ids they
 * affect, and invalidate all three.
 */
const showListTag = (showId: number) => ({ type: 'Screening' as const, id: `LIST-show-${showId}` });

const writeTags = (showId: number, venueIds: number[]) => [
  showListTag(showId),
  { type: 'Show' as const, id: showId },
  ...[...new Set(venueIds)].map((id) => ({ type: 'VenueSeats' as const, id })),
];

interface ScreeningTarget {
  screeningId: number;
  showId: number;
  /** The screening's current venue. */
  venueId: number;
}

export const screeningApi = catalogApi.injectEndpoints({
  endpoints: (builder) => ({
    // GET /shows/:showId/screenings?page&pageSize&status&when
    getShowScreenings: builder.query<ScreeningListResponse, { showId: number } & ScreeningListQuery>({
      query: ({ showId, ...params }) => ({ url: `/shows/${showId}/screenings`, params }),
      providesTags: (result, _error, { showId }) => [
        showListTag(showId),
        ...(result?.screenings.map((s) => ({ type: 'Screening' as const, id: s.id })) ?? []),
      ],
    }),

    // GET /screenings/:screeningId — with show, venue, prices and seat counts.
    getScreening: builder.query<ScreeningResponse, number>({
      query: (screeningId) => `/screenings/${screeningId}`,
      providesTags: (_result, _error, screeningId) => [{ type: 'Screening', id: screeningId }],
    }),

    // POST /shows/:showId/screenings — 409 on an overlap at the venue, or a venue without seats.
    createScreening: builder.mutation<ScreeningResponse, { showId: number; body: ScreeningInput }>({
      query: ({ showId, body }) => ({ url: `/shows/${showId}/screenings`, method: 'POST', body }),
      invalidatesTags: (result, _error, { showId, body }) => (result ? writeTags(showId, [body.venueId]) : []),
    }),

    // PUT /screenings/:screeningId — strict: only the fields that changed.
    // A 409 can mean the screening became read-only (seats sold, started,
    // cancelled elsewhere), so it is refetched and the page catches up.
    updateScreening: builder.mutation<ScreeningResponse, ScreeningTarget & { changes: ScreeningUpdate }>({
      query: ({ screeningId, changes }) => ({ url: `/screenings/${screeningId}`, method: 'PUT', body: changes }),
      invalidatesTags: (result, error, { screeningId, showId, venueId, changes }) =>
        result || getErrorStatus(error) === 409
          ? [{ type: 'Screening', id: screeningId }, ...writeTags(showId, [venueId, changes.venueId ?? venueId])]
          : [],
    }),

    // POST /screenings/:screeningId/cancel — keeps holds and bookings for refunds.
    // Cancelling may be what unlocks the venue's layout.
    cancelScreening: builder.mutation<ScreeningResponse, ScreeningTarget>({
      query: ({ screeningId }) => ({ url: `/screenings/${screeningId}/cancel`, method: 'POST' }),
      invalidatesTags: (result, error, { screeningId, showId, venueId }) =>
        result || getErrorStatus(error) === 409
          ? [{ type: 'Screening', id: screeningId }, ...writeTags(showId, [venueId])]
          : [],
    }),

    // DELETE /screenings/:screeningId — 409 once any seat is held or booked.
    // The screening's own tag is left alone: the page is leaving it, and a
    // refetch would only 404.
    deleteScreening: builder.mutation<{ success: boolean; message: string }, ScreeningTarget>({
      query: ({ screeningId }) => ({ url: `/screenings/${screeningId}`, method: 'DELETE' }),
      invalidatesTags: (result, _error, { showId, venueId }) => (result ? writeTags(showId, [venueId]) : []),
    }),
  }),
});

export const {
  useGetShowScreeningsQuery,
  useGetScreeningQuery,
  useCreateScreeningMutation,
  useUpdateScreeningMutation,
  useCancelScreeningMutation,
  useDeleteScreeningMutation,
} = screeningApi;
