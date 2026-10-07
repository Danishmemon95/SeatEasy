/*
 * Buyer API slice: catalog browsing, seat map, holds and bookings.
 *
 * Separate from catalogApi (organizer data with different tags). Holds and
 * bookings live here so they can invalidate the seat map in one slice.
 * A 401 from any buyer call means the session expired — invalidate User so
 * checkAuth re-runs and ProtectedRoute redirects to /login.
 */

import {
  createApi,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from '@reduxjs/toolkit/query/react';
import { baseQuery } from './baseQuery';
import { authApi } from './authApi';
import type {
  CitiesResponse,
  HomeResponse,
  CatalogEventsResponse,
  CatalogEventsQuery,
  CatalogEventDetailResponse,
  SeatMapResponse,
  MyHoldsResponse,
  BookingResponse,
  BookingListResponse,
  BookingListQuery,
  UpdateMePayload,
} from '../types/buyer.types';
import type { CheckAuthResponse } from '../types/auth.types';

const buyerBaseQuery: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions,
) => {
  const result = await baseQuery(args, api, extraOptions);
  if (result.error?.status === 401) {
    api.dispatch(authApi.util.invalidateTags(['User']));
  }
  return result;
};

export const buyerApi = createApi({
  reducerPath: 'buyerApi',
  baseQuery: buyerBaseQuery,
  tagTypes: ['CatalogEvent', 'SeatMap', 'MyHolds', 'Booking'],
  endpoints: (builder) => ({
    // GET /catalog/cities
    getCities: builder.query<CitiesResponse, void>({
      query: () => '/catalog/cities',
    }),

    // GET /catalog/home?city=
    getHome: builder.query<HomeResponse, string>({
      query: (city) => `/catalog/home?city=${encodeURIComponent(city)}`,
      providesTags: ['CatalogEvent'],
    }),

    // GET /catalog/events?city&date&type&page&pageSize
    getCatalogEvents: builder.query<CatalogEventsResponse, CatalogEventsQuery>({
      query: (params) => {
        const p = new URLSearchParams();
        if (params.city) p.set('city', params.city);
        if (params.date) p.set('date', params.date);
        if (params.type) p.set('type', params.type);
        if (params.page) p.set('page', String(params.page));
        if (params.pageSize) p.set('pageSize', String(params.pageSize));
        return `/catalog/events?${p.toString()}`;
      },
      providesTags: ['CatalogEvent'],
    }),

    // GET /catalog/events/:showId
    getCatalogEvent: builder.query<CatalogEventDetailResponse, number>({
      query: (showId) => `/catalog/events/${showId}`,
      providesTags: (_res, _err, id) => [{ type: 'CatalogEvent', id }],
    }),

    // GET /catalog/screenings/:id/seats
    getSeatMap: builder.query<SeatMapResponse, number>({
      query: (screeningId) => `/catalog/screenings/${screeningId}/seats`,
      providesTags: (_res, _err, id) => [{ type: 'SeatMap', id }],
    }),

    // GET /screenings/:id/holds/me
    getMyHolds: builder.query<MyHoldsResponse, number>({
      query: (screeningId) => `/screenings/${screeningId}/holds/me`,
      providesTags: (_res, _err, id) => [{ type: 'MyHolds', id }],
    }),

    // POST /screenings/:id/holds  { seatIds }
    holdSeats: builder.mutation<MyHoldsResponse, { screeningId: number; seatIds: number[] }>({
      query: ({ screeningId, seatIds }) => ({
        url: `/screenings/${screeningId}/holds`,
        method: 'POST',
        body: { seatIds },
      }),
      // Invalidate on success AND on 409 so the map shows who took what.
      invalidatesTags: (_res, _err, arg) => [
        { type: 'SeatMap', id: arg.screeningId },
        { type: 'MyHolds', id: arg.screeningId },
      ],
    }),

    // DELETE /screenings/:id/holds
    releaseHolds: builder.mutation<{ released: number }, number>({
      query: (screeningId) => ({
        url: `/screenings/${screeningId}/holds`,
        method: 'DELETE',
      }),
      invalidatesTags: (_res, _err, screeningId) => [
        { type: 'SeatMap', id: screeningId },
        { type: 'MyHolds', id: screeningId },
        'Booking',
      ],
    }),

    // POST /bookings  { screeningId }
    createBooking: builder.mutation<BookingResponse, { screeningId: number }>({
      query: (body) => ({
        url: '/bookings',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Booking'],
    }),

    // POST /bookings/:id/pay
    payBooking: builder.mutation<BookingResponse, { bookingId: number; screeningId: number }>({
      query: ({ bookingId }) => ({
        url: `/bookings/${bookingId}/pay`,
        method: 'POST',
      }),
      invalidatesTags: (_res, _err, arg) => [
        'Booking',
        { type: 'Booking', id: arg.bookingId },
        { type: 'SeatMap', id: arg.screeningId },
        { type: 'MyHolds', id: arg.screeningId },
      ],
    }),

    // GET /bookings/me?status&page
    getMyBookings: builder.query<BookingListResponse, BookingListQuery>({
      query: (params) => {
        const p = new URLSearchParams();
        if (params.status) p.set('status', params.status);
        if (params.page) p.set('page', String(params.page));
        if (params.pageSize) p.set('pageSize', String(params.pageSize));
        return `/bookings/me?${p.toString()}`;
      },
      providesTags: ['Booking'],
    }),

    // GET /bookings/:id
    getBooking: builder.query<BookingResponse, number>({
      query: (id) => `/bookings/${id}`,
      providesTags: (_res, _err, id) => [{ type: 'Booking', id }],
    }),

    // PATCH /auth/me  { city }  (saves city to the server)
    updateMe: builder.mutation<CheckAuthResponse, UpdateMePayload>({
      query: (body) => ({
        url: '/auth/me',
        method: 'PATCH',
        body,
      }),
      // On success, upsert the checkAuth cache so the header updates instantly
      // without a separate refetch.
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          if (!data.user) return;
          dispatch(
            authApi.util.upsertQueryData('checkAuth', undefined, {
              success: true,
              message: 'Authenticated',
              user: data.user,
            }),
          );
        } catch {
          // Server rejected the city; the cached user is still correct.
        }
      },
    }),
  }),
});

export const {
  useGetCitiesQuery,
  useGetHomeQuery,
  useGetCatalogEventsQuery,
  useGetCatalogEventQuery,
  useGetSeatMapQuery,
  useGetMyHoldsQuery,
  useHoldSeatsMutation,
  useReleaseHoldsMutation,
  useCreateBookingMutation,
  usePayBookingMutation,
  useGetMyBookingsQuery,
  useGetBookingQuery,
  useUpdateMeMutation,
} = buyerApi;
