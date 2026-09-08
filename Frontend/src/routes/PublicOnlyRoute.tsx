import type React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAppSelector } from '../app/hooks';
import { RouteFallback } from './RouteFallback';

interface RedirectState {
  from?: { pathname?: string };
}

/**
 * The inverse of ProtectedRoute: for /login and /register, which an already
 * authenticated user has no reason to see. Sends them back to wherever
 * ProtectedRoute originally bounced them from, falling back to the account page.
 */
export const PublicOnlyRoute: React.FC = () => {
  const location = useLocation();
  const { isAuthenticated, isInitialized } = useAppSelector((state) => state.auth);

  if (!isInitialized) {
    return <RouteFallback label="RESTORING SESSION" />;
  }

  if (isAuthenticated) {
    const state = location.state as RedirectState | null;
    return <Navigate to={state?.from?.pathname ?? '/account'} replace />;
  }

  return <Outlet />;
};
