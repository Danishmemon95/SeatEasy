import { useCheckAuthQuery } from '../../api/authApi';
import type { User, UserRole } from '../../types/auth.types';

export interface AuthContext {
  user: User | null;
  isAuthenticated: boolean;
  /** True once checkAuth has settled, so guards can tell "no session" from "not asked yet". */
  isInitialized: boolean;
  isLoading: boolean;
  /** True while a refetch is in flight, e.g. immediately after login. */
  isFetching: boolean;
  hasRole: (...roles: UserRole[]) => boolean;
}

/**
 * The single source of truth for session state.
 *
 * Everything here is derived from the checkAuth query's cache rather than
 * mirrored into a slice: login and logout invalidate the User tag, which
 * refetches this query, so there is exactly one copy of "who is signed in" and
 * nothing to keep in sync.
 *
 * Every caller shares one cache entry, so calling this in several components
 * does not produce several requests.
 */
export const useAuth = (): AuthContext => {
  const { data, isSuccess, isError, isLoading, isFetching } = useCheckAuthQuery();

  const user = isSuccess ? data.user : null;

  return {
    user,
    isAuthenticated: isSuccess && Boolean(data.user),
    // Settled means the request finished, either way. A 401 arrives as data
    // with user: null (see checkAuth), so this stays true across refetches;
    // isError only covers network/server failures.
    //
    // Deliberately not keyed on isUninitialized: a caller that hides its
    // children while waiting unsubscribes them, RTK Query resets the entry to
    // uninitialized, and the flag would flip back to false and refire the query
    // forever.
    isInitialized: isSuccess || isError,
    isLoading,
    isFetching,
    hasRole: (...roles: UserRole[]) => Boolean(user?.role && roles.includes(user.role)),
  };
};
