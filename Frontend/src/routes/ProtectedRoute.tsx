import type React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import type { UserRole } from '../types/auth.types';
import { useAuth } from '../features/auth/useAuth';
import { RouteFallback } from './RouteFallback';

export interface ProtectedRouteProps {
  /** When set, the user's role must be in this list or they are sent to /forbidden. */
  allowedRoles?: UserRole[];
}

/**
 * Gates a branch of the route tree behind an authenticated session.
 *
 * Session restoration is driven by the single `checkAuth` query in App; this
 * component only reads the resulting state, so it never triggers a request of
 * its own. Unauthenticated visitors are sent to /login with the location they
 * were aiming for, so the login form can return them there.
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles }) => {
  const location = useLocation();
  const { isAuthenticated, isInitialized, isFetching, user, hasRole } = useAuth();

  // Hold while the session is being established or re-checked. The isFetching
  // case matters right after login: the cache still holds the signed-out result
  // until the refetch lands, and redirecting on that would bounce the user
  // straight back to the login form they just completed.
  if (!isInitialized || (isFetching && !isAuthenticated)) {
    return <RouteFallback label="RESTORING SESSION" />;
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (allowedRoles && !hasRole(...allowedRoles)) {
    return <Navigate to="/forbidden" replace />;
  }

  return <Outlet />;
};
