import type React from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { RouteFallback } from './RouteFallback';
import { App } from '../App';
import { AuthPage } from '../pages/AuthPage';
import { AccountPage } from '../pages/AccountPage';
import { VerifyEmailPage } from '../pages/VerifyEmailPage';
import { ForbiddenPage } from '../pages/ForbiddenPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { ProtectedRoute } from './ProtectedRoute';
import { PublicOnlyRoute } from './PublicOnlyRoute';

import { AuthedLayout } from '../components/layout/AuthedLayout';
import { OrganizerShell } from '../components/layout/OrganizerShell';
import { AdminShell } from '../components/layout/AdminShell';

import { ApplyForOrganizationPage } from '../pages/ApplyForOrganizationPage';
import { AdminApplicationsPage } from '../pages/admin/AdminApplicationsPage';
import { OrganizerDashboardPage } from '../pages/organizer/OrganizerDashboardPage';

/*
 * Catalog pages are lazy-loaded so the organizer bundle stays out of buyer
 * sessions. Each page module exports its component by name.
 */
const venuePage = (name: 'VenueListPage' | 'VenueDetailPage' | 'VenueFormPage') => async () => {
  const pages = {
    VenueListPage: () => import('../pages/organizer/venues/VenueListPage'),
    VenueDetailPage: () => import('../pages/organizer/venues/VenueDetailPage'),
    VenueFormPage: () => import('../pages/organizer/venues/VenueFormPage'),
  };
  const mod = (await pages[name]()) as Record<string, React.ComponentType>;
  return { Component: mod[name] };
};

const eventPage = (name: 'EventListPage' | 'EventDetailPage' | 'EventFormPage') => async () => {
  const pages = {
    EventListPage: () => import('../pages/organizer/events/EventListPage'),
    EventDetailPage: () => import('../pages/organizer/events/EventDetailPage'),
    EventFormPage: () => import('../pages/organizer/events/EventFormPage'),
  };
  const mod = (await pages[name]()) as Record<string, React.ComponentType>;
  return { Component: mod[name] };
};

const screeningPage = (name: 'ScreeningDetailPage' | 'ScreeningFormPage') => async () => {
  const pages = {
    ScreeningDetailPage: () => import('../pages/organizer/screenings/ScreeningDetailPage'),
    ScreeningFormPage: () => import('../pages/organizer/screenings/ScreeningFormPage'),
  };
  const mod = (await pages[name]()) as Record<string, React.ComponentType>;
  return { Component: mod[name] };
};

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
    // Shown if the first page load lands on a lazy route before its module arrives.
    hydrateFallbackElement: <RouteFallback />,
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

      // Authenticated global shell with persistent AppHeader
      {
        element: <ProtectedRoute />,
        children: [
          {
            element: <AuthedLayout />,
            children: [
              { path: 'account', element: <AccountPage /> },
              { path: 'apply-for-organization', element: <ApplyForOrganizationPage /> },

              // Organizer section layout with sidebar
              {
                element: <ProtectedRoute allowedRoles={['organizer', 'admin']} />,
                children: [
                  {
                    element: <OrganizerShell />,
                    children: [
                      { path: 'organizer', element: <Navigate to="/organizer/dashboard" replace /> },
                      { path: 'organizer/dashboard', element: <OrganizerDashboardPage /> },

                      { path: 'organizer/venues', lazy: venuePage('VenueListPage') },
                      { path: 'organizer/venues/:venueId', lazy: venuePage('VenueDetailPage') },
                      { path: 'organizer/venues/:venueId/edit', lazy: venuePage('VenueFormPage') },
                      { path: 'organizer/events', lazy: eventPage('EventListPage') },
                      { path: 'organizer/events/:showId', lazy: eventPage('EventDetailPage') },
                      { path: 'organizer/events/:showId/edit', lazy: eventPage('EventFormPage') },
                      { path: 'organizer/events/:showId/screenings/new', lazy: screeningPage('ScreeningFormPage') },
                      { path: 'organizer/screenings/:screeningId', lazy: screeningPage('ScreeningDetailPage') },
                      { path: 'organizer/screenings/:screeningId/edit', lazy: screeningPage('ScreeningFormPage') },

                      // Creating a venue or an event is organizer-only on the
                      // server (admins get a 403), so the routes match.
                      {
                        element: <ProtectedRoute allowedRoles={['organizer']} />,
                        children: [
                          { path: 'organizer/venues/new', lazy: venuePage('VenueFormPage') },
                          { path: 'organizer/events/new', lazy: eventPage('EventFormPage') },
                        ],
                      },
                    ],
                  },
                ],
              },

              // Admin section layout with sidebar
              {
                element: <ProtectedRoute allowedRoles={['admin']} />,
                children: [
                  {
                    element: <AdminShell />,
                    children: [
                      { path: 'admin', element: <Navigate to="/admin/applications" replace /> },
                      { path: 'admin/applications', element: <AdminApplicationsPage /> },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },

      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
