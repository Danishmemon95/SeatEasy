import type { FetchBaseQueryError } from '@reduxjs/toolkit/query/react';

/*
 * Readers for the API's error body: `{ message, code?, errors?: [{ field, message }] }`.
 * Shared by every API slice.
 */

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

/** The HTTP status of a failed request, or null for network/parse failures. */
export const getErrorStatus = (error: unknown): number | null => {
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const { status } = error as FetchBaseQueryError;
    return typeof status === 'number' ? status : null;
  }
  return null;
};
