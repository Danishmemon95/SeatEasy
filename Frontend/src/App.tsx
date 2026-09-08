import { useCheckAuthQuery } from './api/authApi';
import { AuthPage } from './features/auth/AuthPage';
import { Loader2 } from 'lucide-react';

export function App() {
  const { isLoading: isCheckingAuth } = useCheckAuthQuery();

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[var(--paper-base)]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-7 h-7 text-[var(--accent)] animate-spin" />
          <span className="text-caption text-[var(--ink-muted)] tracking-wider font-medium">
            RESTORING SESSION
          </span>
        </div>
      </div>
    );
  }

  return <AuthPage />;
}

export default App;
