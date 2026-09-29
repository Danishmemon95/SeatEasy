import { catalogApi } from '../catalogApi';
import { getErrorStatus } from '../errors';
import type {
  AddSeatRowsResponse,
  SeatCategory,
  SeatResponse,
  SeatRowInput,
  VenueSeatsResponse,
} from '../../types/catalog.types';

/*
 * /api/venues/:venueId/seats — a venue's seat layout.
 *
 * Every layout write can 409 because an upcoming screening now depends on the
 * layout. A 409 also refetches the seats, so `layoutLocked` flips to true and
 * the editor switches to read-only without a reload.
 */
const layoutTags = (venueId: number) => [
  { type: 'VenueSeats' as const, id: venueId },
  // The venue list shows each venue's seat count.
  { type: 'Venue' as const, id: 'LIST' },
];

const invalidateLayout =
  <A extends { venueId: number }>() =>
  (result: unknown, error: unknown, { venueId }: A) =>
    result || getErrorStatus(error) === 409 ? layoutTags(venueId) : [];

export const seatApi = catalogApi.injectEndpoints({
  endpoints: (builder) => ({
    // GET /venues/:venueId/seats — ordered A…Z, AA…, then seat number.
    getVenueSeats: builder.query<VenueSeatsResponse, number>({
      query: (venueId) => `/venues/${venueId}/seats`,
      providesTags: (_result, _error, venueId) => [{ type: 'VenueSeats', id: venueId }],
    }),

    // POST /venues/:venueId/seats — 409 if a row already exists or the layout is locked.
    addSeatRows: builder.mutation<AddSeatRowsResponse, { venueId: number; rows: SeatRowInput[] }>({
      query: ({ venueId, rows }) => ({ url: `/venues/${venueId}/seats`, method: 'POST', body: { rows } }),
      invalidatesTags: invalidateLayout(),
    }),

    // PATCH /venues/:venueId/seats/:seatId
    updateSeat: builder.mutation<SeatResponse, { venueId: number; seatId: number; category: SeatCategory }>({
      query: ({ venueId, seatId, category }) => ({
        url: `/venues/${venueId}/seats/${seatId}`,
        method: 'PATCH',
        body: { category },
      }),
      invalidatesTags: invalidateLayout(),
    }),

    // DELETE /venues/:venueId/seats/:seatId — leaves a gap (e.g. an aisle).
    deleteSeat: builder.mutation<SeatResponse, { venueId: number; seatId: number }>({
      query: ({ venueId, seatId }) => ({ url: `/venues/${venueId}/seats/${seatId}`, method: 'DELETE' }),
      invalidatesTags: invalidateLayout(),
    }),

    // DELETE /venues/:venueId/seats/rows/:row
    deleteSeatRow: builder.mutation<{ success: boolean; message: string }, { venueId: number; row: string }>({
      query: ({ venueId, row }) => ({
        url: `/venues/${venueId}/seats/rows/${encodeURIComponent(row)}`,
        method: 'DELETE',
      }),
      invalidatesTags: invalidateLayout(),
    }),
  }),
});

export const {
  useGetVenueSeatsQuery,
  useAddSeatRowsMutation,
  useUpdateSeatMutation,
  useDeleteSeatMutation,
  useDeleteSeatRowMutation,
} = seatApi;
