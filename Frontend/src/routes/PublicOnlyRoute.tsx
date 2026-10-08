import type React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../features/auth/useAuth';
import { RouteFallback } from './RouteFallback';

interface RedirectState {
  from?: { pathname?: string; search?: string };
}

/**
 * The inverse of ProtectedRoute: for /login and /register, which an already
 * authenticated user has no reason to see. Sends them back to wherever
 * ProtectedRoute originally bounced them from. Otherwise buyers land on the
 * home page (the event list); organizers and admins on their account page.
 */
export const PublicOnlyRoute: React.FC = () => {
  const location = useLocation();
  const { isAuthenticated, isInitialized, hasRole } = useAuth();

  if (!isInitialized) {
    return <RouteFallback label="RESTORING SESSION" />;
  }

  if (isAuthenticated) {
    const state = location.state as RedirectState | null;
    const from = state?.from?.pathname ? `${state.from.pathname}${state.from.search ?? ''}` : null;
    return <Navigate to={from ?? (hasRole('buyer') ? '/' : '/account')} replace />;
  }

  return <Outlet />;
};
