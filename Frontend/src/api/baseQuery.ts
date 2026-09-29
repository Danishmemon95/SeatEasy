import { fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/**
 * The one fetchBaseQuery every API slice shares: same base URL, and
 * credentials: 'include' so the HTTP-only auth cookie is sent and received.
 *
 * No 401 handling here — for checkAuth a 401 simply means "signed out". The
 * catalog API wraps this to re-check the session when its calls get a 401.
 */
export const baseQuery = fetchBaseQuery({
  baseUrl: API_BASE_URL,
  credentials: 'include',
  prepareHeaders: (headers) => {
    headers.set('Content-Type', 'application/json');
    return headers;
  },
});
