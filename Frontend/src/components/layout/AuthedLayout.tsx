import type React from 'react';
import { Outlet } from 'react-router-dom';
import { AppHeader } from './AppHeader';

export const AuthedLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)] flex flex-col">
      <AppHeader />
      <main className="flex-1 flex flex-col">
        <Outlet />
      </main>
    </div>
  );
};
