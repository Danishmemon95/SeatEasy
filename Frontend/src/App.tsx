import { Outlet } from 'react-router-dom';
import { useCheckAuthQuery } from './api/authApi';
import { useAppSelector } from './app/hooks';
import { RouteFallback } from './routes/RouteFallback';

/**
 * Layout route for the whole app. Runs the session-restore query exactly once
 * and holds the first paint until it settles, so the guards below never see an
 * undecided auth state and no route flashes before redirecting.
 */
export function App() {
  useCheckAuthQuery();
  const isInitialized = useAppSelector((state) => state.auth.isInitialized);

  if (!isInitialized) {
    return <RouteFallback label="RESTORING SESSION" />;
  }

  return <Outlet />;
}

export default App;
