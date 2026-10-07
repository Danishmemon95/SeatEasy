import type React from 'react';
import { Outlet } from 'react-router-dom';
import { AppHeader } from './AppHeader';
import { useCurrentCity } from '../../app/useCurrentCity';
import { CityPicker } from '../../features/buyer/CityPicker';

/**
 * The public-facing site layout: header + main content, for signed-in and
 * signed-out users alike. Buyer pages (home, explore, event, seat map,
 * checkout, bookings) all use it.
 *
 * A city is required before anything else (plan §0): with no city, the page
 * is replaced by the blocking city picker. Pages therefore never render, or
 * fetch, without a city.
 */
export const SiteLayout: React.FC = () => {
  const { city, isReady, saveCity } = useCurrentCity();

  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)] flex flex-col">
      <AppHeader />
      <main className="flex-1 flex flex-col">
        {/* Wait for the session check: a signed-in user's city comes from it. */}
        {!isReady ? null : city ? <Outlet /> : <CityPicker mode="blocking" onSave={saveCity} />}
      </main>
    </div>
  );
};
