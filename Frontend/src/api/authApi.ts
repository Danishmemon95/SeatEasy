import { createApi, fetchBaseQuery, type FetchBaseQueryError } from '@reduxjs/toolkit/query/react';
import type {
  AuthResponse,
  CheckAuthResponse,
  LoginPayload,
  RegisterPayload,
  RegisterResponse,
  VerifyResponse,
} from '../types/auth.types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const authApi = createApi({
  reducerPath: 'authApi',
  baseQuery: fetchBaseQuery({
    baseUrl: API_BASE_URL,
    credentials: 'include', // Ensures HTTP-only auth cookies are sent and received
    prepareHeaders: (headers) => {
      headers.set('Content-Type', 'application/json');
      return headers;
    },
  }),
  tagTypes: ['User'],
  endpoints: (builder) => ({
    // GET /api/auth/checkAuth
    checkAuth: builder.query<CheckAuthResponse, void>({
      query: () => '/auth/checkAuth',
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

/**
 * Maps the API's validation `errors` array onto a { field: message } object the
 * forms can merge straight into their own error state.
 *
 * Only the first message per field is kept — zod reports every failed rule, and
 * listing all of them under one input is noise. Fields the form does not know
 * about are ignored rather than rendered somewhere unexpected.
 */
export const getFieldErrors = (error: unknown): Record<string, string> | null => {
  if (typeof error !== 'object' || error === null || !('data' in error)) return null;

  const data = (error as FetchBaseQueryError).data;
  if (!data || typeof data !== 'object' || !('errors' in data)) return null;

  const raw = (data as { errors: unknown }).errors;
  if (!Array.isArray(raw)) return null;

  const result: Record<string, string> = {};
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue;
    const { field, message } = item as { field?: unknown; message?: unknown };
    if (typeof field === 'string' && typeof message === 'string' && !(field in result)) {
      result[field] = message;
    }
  }

  return Object.keys(result).length > 0 ? result : null;
};

/**
 * Reads the machine-readable `code` the API attaches to some errors, so the UI
 * can branch on the reason rather than pattern-matching the display message.
 * Currently only EMAIL_NOT_VERIFIED (403 from /login).
 */
export const getApiErrorCode = (error: unknown): string | null => {
  if (typeof error === 'object' && error !== null && 'data' in error) {
    const data = (error as FetchBaseQueryError).data;
    if (data && typeof data === 'object' && 'code' in data) {
      return String((data as { code: unknown }).code);
    }
  }
  return null;
};

/**
 * Utility to extract clean error message from RTK Query / Network error
 */
export const getRtkErrorMessage = (error: unknown): string => {
  if (!error) return 'An unexpected error occurred';
  
  // RTK Query FetchBaseQueryError
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const fetchErr = error as FetchBaseQueryError;
    if (fetchErr.data && typeof fetchErr.data === 'object' && 'message' in fetchErr.data) {
      return String((fetchErr.data as { message: unknown }).message);
    }
    if (typeof fetchErr.data === 'string') {
      return fetchErr.data;
    }
    if (fetchErr.status === 'FETCH_ERROR') {
      return 'Unable to reach the server. Please check your internet connection or backend server status.';
    }
    if (fetchErr.status === 401) {
      return 'Invalid credentials or unauthorized access.';
    }
    if (fetchErr.status === 403) {
      return 'Access forbidden.';
    }
    if (fetchErr.status === 404) {
      return 'Requested resource was not found.';
    }
    if (fetchErr.status === 500) {
      return 'Internal server error. Please try again later.';
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'An unexpected error occurred. Please try again.';
};
