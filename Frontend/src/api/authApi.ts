import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQuery } from './baseQuery';
import type {
  AuthResponse,
  CheckAuthResponse,
  LoginPayload,
  RegisterPayload,
  RegisterResponse,
  VerifyResponse,
} from '../types/auth.types';

export const authApi = createApi({
  reducerPath: 'authApi',
  baseQuery,
  tagTypes: ['User'],
  endpoints: (builder) => ({
    // GET /api/auth/checkAuth
    checkAuth: builder.query<CheckAuthResponse, void>({
      // A 401 is a real answer ("signed out"), so it is stored as data, not as an
      // error. RTK Query refetches an errored query whenever a new component
      // subscribes; with a 401 left as an error, every page mount re-ran
      // checkAuth, flipped isInitialized off while pending, unmounted the page,
      // and remounted it when the 401 came back — forever.
      async queryFn(_arg, api, extraOptions) {
        const result = await baseQuery('/auth/checkAuth', api, extraOptions);
        if (result.error?.status === 401) {
          return { data: { success: false, message: 'Not authenticated', user: null } };
        }
        return result.error ? { error: result.error } : { data: result.data as CheckAuthResponse };
      },
      providesTags: ['User'],
    }),

    // POST /api/auth/login
    login: builder.mutation<AuthResponse, LoginPayload>({
      query: (credentials) => ({
        url: '/auth/login',
        method: 'POST',
        body: credentials,
      }),
      // RTK Query invalidates on every settled mutation, success or failure.
      // A rejected login changes no session, so refetching checkAuth would only
      // spend a request to be told again that nobody is signed in. `result` is
      // undefined when the mutation failed.
      invalidatesTags: (result) => (result ? ['User'] : []),
    }),

    // POST /api/auth/register
    register: builder.mutation<RegisterResponse, RegisterPayload>({
      query: (userData) => ({
        url: '/auth/register',
        method: 'POST',
        body: userData,
      }),
    }),

    // POST /api/auth/logout
    logout: builder.mutation<{ message: string }, void>({
      query: () => ({
        url: '/auth/logout',
        method: 'POST',
      }),
      // Only a logout the server confirmed has cleared the cookie; if it failed
      // the old session is still live and there is nothing new to fetch.
      invalidatesTags: (result) => (result ? ['User'] : []),
    }),

    // GET /api/auth/verify?token=...
    verifyEmail: builder.query<VerifyResponse, string>({
      query: (token) => `/auth/verify?token=${encodeURIComponent(token)}`,
      // Verifying signs the user in server-side, so the cached session is stale.
      //
      // This deliberately does NOT use tags in either direction. Providing
      // 'User' would let an unrelated login invalidate this result and refire a
      // single-use token; invalidating 'User' re-runs every query holding the
      // tag — including this one, which loops. Writing the fresh user straight
      // into the checkAuth cache updates the session with no request at all.
      async onQueryStarted(_token, { dispatch, queryFulfilled }) {
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
          // A failed verification leaves the session untouched.
        }
      },
    }),
  }),
});

export const {
  useCheckAuthQuery,
  useLazyCheckAuthQuery,
  useLoginMutation,
  useRegisterMutation,
  useLogoutMutation,
  useVerifyEmailQuery,
  useLazyVerifyEmailQuery,
} = authApi;

// The error helpers moved to ./errors so every API slice can share them; they
// are re-exported here so existing imports keep working.
export { getApiErrorCode, getFieldErrors, getRtkErrorMessage } from './errors';
