import { createBrowserRouter, Navigate } from 'react-router-dom';
import { App } from '../App';
import { AuthPage } from '../pages/AuthPage';
import { AccountPage } from '../pages/AccountPage';
import { VerifyEmailPage } from '../pages/VerifyEmailPage';
import { ForbiddenPage } from '../pages/ForbiddenPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { ProtectedRoute } from './ProtectedRoute';
import { PublicOnlyRoute } from './PublicOnlyRoute';

/**
 * App is the layout route: it runs the single checkAuth query and renders an
 * <Outlet />, so session restoration happens once for the whole tree rather
 * than per page.
 *
 * Organizer and admin sections are gated by `allowedRoles`, mirroring the
 * backend's role check — the client guard is for navigation only; the server
 * remains the authority.
 */
export const router = createBrowserRouter([
  {
    element: <App />,
    children: [
      { index: true, element: <Navigate to="/account" replace /> },

      // Public: the verification link must work while signed out.
      { path: 'verify', element: <VerifyEmailPage /> },
      { path: 'forbidden', element: <ForbiddenPage /> },

      // Signed-out only.
      {
        element: <PublicOnlyRoute />,
        children: [
          { path: 'login', element: <AuthPage mode="login" /> },
          { path: 'register', element: <AuthPage mode="register" /> },
        ],
      },

      // Any signed-in user.
      {
        element: <ProtectedRoute />,
        children: [{ path: 'account', element: <AccountPage /> }],
      },

      // Organizer-only. Shows, screenings and pricing land here.
      {
        element: <ProtectedRoute allowedRoles={['organizer', 'admin']} />,
        children: [
          { path: 'organizer', element: <Navigate to="/account" replace /> },
        ],
      },

      // Admin-only. Organizer application review lands here.
      {
        element: <ProtectedRoute allowedRoles={['admin']} />,
        children: [
          { path: 'admin', element: <Navigate to="/account" replace /> },
        ],
      },

      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
