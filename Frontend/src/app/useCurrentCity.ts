/*
 * useCurrentCity — the single source of truth for the active city.
 *
 * Rules (plan §0.1):
 *   1. Signed in?  use user.city  (server wins over localStorage)
 *   2. Signed out? use localStorage['seatease:city']
 *   3. Neither?    return null  → the blocking city picker opens
 *
 * Saving a city:
 *   - Signed in:  PATCH /auth/me { city }  then write localStorage too
 *   - Signed out: write localStorage only
 *
 * The stored city is an external store (useSyncExternalStore): every
 * component reading it re-renders when it changes, in this tab (a custom
 * event) and in other tabs (the browser's `storage` event).
 */

import { useCallback, useSyncExternalStore } from 'react';
import { useAuth } from '../features/auth/useAuth';
import { useUpdateMeMutation } from '../api/buyerApi';

const CITY_KEY = 'seatease:city';
const CITY_EVENT = 'seatease:city-change';

/** Read the locally-stored city (localStorage). */
export const getStoredCity = (): string | null => {
  try {
    return localStorage.getItem(CITY_KEY);
  } catch {
    return null;
  }
};

/** Write the locally-stored city and notify every subscriber in this tab. */
export const setStoredCity = (city: string): void => {
  try {
    localStorage.setItem(CITY_KEY, city);
  } catch {
    // Storage blocked (private mode, full quota); the in-memory session city still applies when signed in.
  }
  window.dispatchEvent(new Event(CITY_EVENT));
};

const subscribe = (onChange: () => void) => {
  const onStorage = (e: StorageEvent) => {
    if (e.key === CITY_KEY) onChange();
  };
  window.addEventListener(CITY_EVENT, onChange);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(CITY_EVENT, onChange);
    window.removeEventListener('storage', onStorage);
  };
};

export const useCurrentCity = (): {
  /** The active city, or null when none is chosen yet. */
  city: string | null;
  /** False until the session check settles; don't decide "no city" before then. */
  isReady: boolean;
  /** Save city to the server (signed in) and localStorage. Rejects with the server error. */
  saveCity: (city: string) => Promise<void>;
} => {
  const { user, isAuthenticated, isInitialized } = useAuth();
  const [updateMe] = useUpdateMeMutation();
  const storedCity = useSyncExternalStore(subscribe, getStoredCity, () => null);

  // City resolution: server > localStorage > null
  const city: string | null = isAuthenticated && user?.city ? user.city : storedCity;

  const saveCity = useCallback(
    async (newCity: string) => {
      if (isAuthenticated) {
        // Server first: if it rejects the city, nothing changes and the picker shows the error.
        await updateMe({ city: newCity }).unwrap();
      }
      // Also kept locally, so a later sign-out keeps the same city.
      setStoredCity(newCity);
    },
    [isAuthenticated, updateMe],
  );

  return { city, isReady: isInitialized, saveCity };
};
