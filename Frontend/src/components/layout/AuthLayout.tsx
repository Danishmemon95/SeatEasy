import React from 'react';
import { Link } from 'react-router-dom';

export interface AuthLayoutProps {
  children: React.ReactNode;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)] flex flex-col justify-between p-4 sm:px-6 sm:py-5 selection:bg-[var(--accent-subtle)] selection:text-[var(--accent)]">
      {/* Top Brand Header */}
      <header className="w-full max-w-[880px] mx-auto flex items-center justify-between py-3 sm:py-3.5 border-b border-[var(--rule)]">
        <Link to="/" className="flex items-center gap-2.5 group">
          <img
            src="/logo.png"
            alt="SeatEasy Logo"
            className="w-8 h-8 object-contain transition-transform group-hover:scale-105"
          />
          <div className="flex flex-col">
            <span className="font-display font-medium text-xl tracking-tight leading-none text-[var(--ink)]">
              Seat<span className="italic font-normal text-[var(--accent)]">Easy</span>
            </span>
            <span className="text-caption text-[var(--ink-muted)] text-[9px] tracking-widest mt-0.5">
              TICKETING & EVENTS
            </span>
          </div>
        </Link>
      </header>

      {/* Main Form Center Stage */}
      <main className="w-full max-w-[880px] mx-auto my-auto py-3 sm:py-5 flex items-center justify-center">
        <div className="w-full max-w-[440px]">
          {children}
        </div>
      </main>

      {/* Minimal Editorial Footer */}
      <footer className="w-full max-w-[880px] mx-auto pt-4 sm:pt-5 border-t border-[var(--rule)] flex flex-col sm:flex-row items-center justify-between gap-3 text-caption text-[var(--ink-muted)]">
        <div className="flex items-center gap-6">
          <span>&copy; {new Date().getFullYear()} SEATEASY PLATFORM</span>
          <a href="#privacy" className="hover:text-[var(--ink)] transition-colors">
            PRIVACY
          </a>
          <a href="#terms" className="hover:text-[var(--ink)] transition-colors">
            TERMS
          </a>
        </div>
      </footer>
    </div>
  );
};
