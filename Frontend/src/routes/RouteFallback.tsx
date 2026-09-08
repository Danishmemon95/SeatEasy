import type React from 'react';
import { Loader2 } from 'lucide-react';

export interface RouteFallbackProps {
  label?: string;
}

/** Full-page spinner shared by the route guards and by Suspense boundaries. */
export const RouteFallback: React.FC<RouteFallbackProps> = ({ label = 'LOADING' }) => (
  <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[var(--paper)]">
    <div className="flex flex-col items-center gap-3">
      <Loader2 className="w-7 h-7 text-[var(--accent)] animate-spin" />
      <span className="text-caption text-[var(--ink-muted)] tracking-wider font-medium">
        {label}
      </span>
    </div>
  </div>
);
