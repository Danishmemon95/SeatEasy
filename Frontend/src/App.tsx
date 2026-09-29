import { Outlet } from 'react-router-dom';
import { useAuth } from './features/auth/useAuth';
import { RouteFallback } from './routes/RouteFallback';

/**
 * Layout route for the whole app.
 *
 * Calling useAuth here is what kicks off the session-restore request; every
 * guard and page below shares that one cache entry rather than refetching.
 * Holding the first paint until it settles means the guards never observe an
 * undecided auth state and no route flashes before redirecting.
 */
export function App() {
  const { isInitialized } = useAuth();

  // The Outlet stays mounted and is hidden instead of being swapped out. App is
  // the only subscriber to checkAuth while the session is being restored, and
  // unmounting the tree here would tear that subscription down, reset the cache
  // entry, and start the query over on every pass.
  return (
    <>
      {!isInitialized && <RouteFallback label="RESTORING SESSION" />}
      <div hidden={!isInitialized}>
        <Outlet />
      </div>
    </>
  );
}

export default App;
