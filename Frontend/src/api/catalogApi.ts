import { createApi, type BaseQueryFn, type FetchArgs, type FetchBaseQueryError } from '@reduxjs/toolkit/query/react';
import { baseQuery } from './baseQuery';
import { authApi } from './authApi';

/**
 * A 401 from a catalog call means the session expired mid-use. Invalidating
 * the User tag re-runs checkAuth; once it settles as signed out, ProtectedRoute
 * sends the user to /login. No page has to handle it.
 */
const baseQueryWithSessionCheck: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
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

/**
 * Venues, seats, shows and screenings in one API slice. They invalidate each
 * other (scheduling a screening locks its venue's layout; deleting a show
 * removes its screenings), and RTK Query tags only work within one createApi.
 *
 * Endpoints are added per resource from ./catalog/* with injectEndpoints.
 */
export const catalogApi = createApi({
  reducerPath: 'catalogApi',
  baseQuery: baseQueryWithSessionCheck,
  tagTypes: ['Venue', 'VenueSeats', 'Show', 'Screening'],
  endpoints: () => ({}),
});
