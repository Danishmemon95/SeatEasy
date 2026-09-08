import { createApi, fetchBaseQuery, type FetchBaseQueryError } from '@reduxjs/toolkit/query/react';
import type {
  AuthResponse,
  CheckAuthResponse,
  LoginPayload,
  RegisterPayload,
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
      invalidatesTags: ['User'],
    }),

    // POST /api/auth/register
    register: builder.mutation<AuthResponse, RegisterPayload>({
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
      invalidatesTags: ['User'],
    }),

    // GET /api/auth/verify?token=...
    verifyEmail: builder.query<VerifyResponse, string>({
      query: (token) => `/auth/verify?token=${encodeURIComponent(token)}`,
      providesTags: ['User'],
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
