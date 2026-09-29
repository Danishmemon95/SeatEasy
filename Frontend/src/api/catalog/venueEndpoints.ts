import { catalogApi } from '../catalogApi';
import type {
  VenueInput,
  VenueListQuery,
  VenueListResponse,
  VenueResponse,
} from '../../types/catalog.types';

/*
 * /api/venues. Organizers see their own venues, admins every venue; another
 * organizer's venue is a 404, same as a missing one.
 *
 * Invalidation only on success (`result ? [...] : []`), as in authApi: a
 * rejected write changed nothing, so there is nothing to refetch.
 */
export const venueApi = catalogApi.injectEndpoints({
  endpoints: (builder) => ({
    // GET /venues?page&pageSize&ownerId
    getVenues: builder.query<VenueListResponse, VenueListQuery | void>({
      query: (params) => ({ url: '/venues', params: params ?? undefined }),
      providesTags: (result) => [
        { type: 'Venue' as const, id: 'LIST' },
        ...(result?.venues.map((v) => ({ type: 'Venue' as const, id: v.id })) ?? []),
      ],
    }),

    // GET /venues/:venueId
    getVenue: builder.query<VenueResponse, number>({
      query: (venueId) => `/venues/${venueId}`,
      providesTags: (_result, _error, venueId) => [{ type: 'Venue', id: venueId }],
    }),

    // POST /venues (organizer only)
    createVenue: builder.mutation<VenueResponse, VenueInput>({
      query: (body) => ({ url: '/venues', method: 'POST', body }),
      invalidatesTags: (result) => (result ? [{ type: 'Venue', id: 'LIST' }] : []),
    }),

    // PUT /venues/:venueId — send only the fields that changed.
    updateVenue: builder.mutation<VenueResponse, { venueId: number; changes: Partial<VenueInput> }>({
      query: ({ venueId, changes }) => ({ url: `/venues/${venueId}`, method: 'PUT', body: changes }),
      invalidatesTags: (result, _error, { venueId }) =>
        result
          ? [
              { type: 'Venue', id: venueId },
              { type: 'Venue', id: 'LIST' },
            ]
          : [],
    }),

    // DELETE /venues/:venueId — 409 while the venue has any screening.
    deleteVenue: builder.mutation<VenueResponse, number>({
      query: (venueId) => ({ url: `/venues/${venueId}`, method: 'DELETE' }),
      invalidatesTags: (result, _error, venueId) =>
        result
          ? [
              { type: 'Venue', id: 'LIST' },
              { type: 'VenueSeats', id: venueId },
            ]
          : [],
    }),
  }),
});

export const {
  useGetVenuesQuery,
  useGetVenueQuery,
  useCreateVenueMutation,
  useUpdateVenueMutation,
  useDeleteVenueMutation,
} = venueApi;
