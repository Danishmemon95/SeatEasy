import { catalogApi } from '../catalogApi';
import { getErrorStatus } from '../errors';
import type {
  ShowDetailResponse,
  ShowInput,
  ShowListQuery,
  ShowListResponse,
  ShowResponse,
  ShowUpdate,
} from '../../types/catalog.types';

/*
 * /api/shows — events in the UI. Organizers see their own, admins every
 * organizer's; another organizer's show is a 404, same as a missing one.
 *
 * Invalidation only on success (`result ? [...] : []`), as in authApi, with one
 * exception: a 409 from update or publish means the cached show is stale (a
 * screening was scheduled elsewhere, or it was already published), so it is
 * refetched and the page catches up without a reload.
 */
const showTags = (showId: number) => [
  { type: 'Show' as const, id: showId },
  { type: 'Show' as const, id: 'LIST' },
];

export const showApi = catalogApi.injectEndpoints({
  endpoints: (builder) => ({
    // GET /shows?page&pageSize&status
    getShows: builder.query<ShowListResponse, ShowListQuery | void>({
      query: (params) => ({ url: '/shows', params: params ?? undefined }),
      providesTags: (result) => [
        { type: 'Show' as const, id: 'LIST' },
        ...(result?.shows.map((s) => ({ type: 'Show' as const, id: s.id })) ?? []),
      ],
    }),

    // GET /shows/:showId — includes the compact schedule (`screenings`).
    getShow: builder.query<ShowDetailResponse, number>({
      query: (showId) => `/shows/${showId}`,
      providesTags: (_result, _error, showId) => [{ type: 'Show', id: showId }],
    }),

    // POST /shows (organizer only) — always created as a draft.
    createShow: builder.mutation<ShowResponse, ShowInput>({
      query: (body) => ({ url: '/shows', method: 'POST', body }),
      invalidatesTags: (result) => (result ? [{ type: 'Show', id: 'LIST' }] : []),
    }),

    // PUT /shows/:showId — strict: only the fields that changed, never status or orgId.
    // 409 when the duration changes while a screening is scheduled.
    updateShow: builder.mutation<ShowResponse, { showId: number; changes: ShowUpdate }>({
      query: ({ showId, changes }) => ({ url: `/shows/${showId}`, method: 'PUT', body: changes }),
      invalidatesTags: (result, error, { showId }) =>
        result || getErrorStatus(error) === 409 ? showTags(showId) : [],
    }),

    // POST /shows/:showId/publish — one-way; 409 if already published.
    publishShow: builder.mutation<ShowResponse, number>({
      query: (showId) => ({ url: `/shows/${showId}/publish`, method: 'POST' }),
      invalidatesTags: (result, error, showId) =>
        result || getErrorStatus(error) === 409 ? showTags(showId) : [],
    }),

    // DELETE /shows/:showId — removes its screenings too; 409 once any seat is held or booked.
    deleteShow: builder.mutation<ShowResponse, number>({
      query: (showId) => ({ url: `/shows/${showId}`, method: 'DELETE' }),
      invalidatesTags: (result) =>
        result
          ? [
              { type: 'Show', id: 'LIST' },
              'Screening',
              // Its screenings may have been all that kept a venue's layout locked.
              'VenueSeats',
            ]
          : [],
    }),
  }),
});

export const {
  useGetShowsQuery,
  useGetShowQuery,
  useCreateShowMutation,
  useUpdateShowMutation,
  usePublishShowMutation,
  useDeleteShowMutation,
} = showApi;
