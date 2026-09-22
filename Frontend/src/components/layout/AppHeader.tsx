import type React from 'react';
import { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/useAuth';
import { useLogoutMutation } from '../../api/authApi';
import { Badge } from '../ui/Badge';
import {
  Ticket,
  User,
  LogOut,
  ChevronDown,
  Building2,
  Sparkles,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';

export const AppHeader: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [logout, { isLoading: isLoggingOut }] = useLogoutMutation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setDropdownOpen(false);
    try {
      await logout().unwrap();
    } catch {
      // Session cleared server-side
    }
    navigate('/login', { replace: true });
  };

  if (!user) return null;

  const isOrganizer = user.role === 'organizer' || user.role === 'admin';
  const isAdmin = user.role === 'admin';

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-1.5 text-sm font-medium rounded-[6px] transition-all flex items-center gap-1.5 select-none ${
      isActive
        ? 'bg-[var(--accent-subtle)] text-[var(--accent)] font-semibold shadow-xs'
        : 'text-[var(--ink-secondary)] hover:text-[var(--ink)] hover:bg-[var(--paper-sunken)]'
    }`;

  return (
    <header className="sticky top-0 z-50 w-full h-14 bg-[var(--paper)] border-b border-[var(--rule)] px-4 sm:px-8 flex items-center justify-between shadow-2xs">
      {/* Left: Brand Logo + Main Nav */}
      <div className="flex items-center gap-6 md:gap-8">
        <NavLink to="/account" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-[4px] bg-[var(--accent)] flex items-center justify-center text-[var(--accent-ink)] shadow-xs transition-transform group-hover:scale-105">
            <Ticket className="w-4 h-4 stroke-[1.75]" />
          </div>
          <div className="flex flex-col">
            <span className="font-display font-medium text-lg tracking-tight leading-none text-[var(--ink)]">
              Seat<span className="italic font-normal text-[var(--accent)]">Easy</span>
            </span>
            <span className="text-caption text-[var(--ink-muted)] text-[8px] tracking-widest mt-0.5">
              TICKETING
            </span>
          </div>
        </NavLink>

        {/* Global Nav Links */}
        <nav className="flex items-center gap-1">
          <NavLink to="/account" className={navLinkClass}>
            <User className="w-4 h-4" />
            <span className="hidden sm:inline">Account</span>
          </NavLink>

          {!isAdmin && (
            <NavLink to="/apply-for-organization" className={navLinkClass}>
              <Building2 className="w-4 h-4" />
              <span className="hidden sm:inline">Apply</span>
            </NavLink>
          )}

          {isOrganizer && (
            <NavLink to="/organizer/dashboard" className={navLinkClass}>
              <Sparkles className="w-4 h-4" />
              <span className="hidden sm:inline">Organizer</span>
            </NavLink>
          )}

          {isAdmin && (
            <NavLink to="/admin/applications" className={navLinkClass}>
              <ShieldCheck className="w-4 h-4" />
              <span className="hidden sm:inline">Admin</span>
            </NavLink>
          )}
        </nav>
      </div>

      {/* Right: User Dropdown Menu */}
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setDropdownOpen((prev) => !prev)}
          className="flex items-center gap-2 p-1 pl-2 pr-1.5 rounded-[8px] border border-[var(--rule)] bg-[var(--paper-raised)] hover:bg-[var(--paper-sunken)] transition-colors cursor-pointer select-none"
        >
          <div className="w-7 h-7 rounded-full bg-[var(--accent-subtle)] text-[var(--accent)] border border-[var(--accent-border)] font-medium text-xs flex items-center justify-center shrink-0">
            {user.username.charAt(0).toUpperCase()}
          </div>
          <span className="hidden sm:inline-block font-medium text-xs text-[var(--ink)] truncate max-w-[120px]">
            {user.username}
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-[var(--ink-muted)] shrink-0" />
        </button>

        {/* Dropdown Card */}
        {dropdownOpen && (
          <div className="absolute right-0 mt-2 w-64 rounded-[12px] bg-[var(--paper-raised)] border border-[var(--rule)] shadow-[var(--elev-2)] p-3 flex flex-col gap-3 z-50 text-sm animate-in fade-in slide-in-from-top-2 duration-150">
            <div className="flex flex-col gap-1 pb-2 border-b border-[var(--rule)]">
              <span className="font-medium text-[var(--ink)] truncate">{user.username}</span>
              <span className="text-xs text-[var(--ink-muted)] truncate">{user.email}</span>
              <div className="pt-1.5">
                {isAdmin ? (
                  <Badge variant="warning">
                    <ShieldCheck className="w-3 h-3 mr-1" />
                    ADMIN
                  </Badge>
                ) : user.role === 'organizer' ? (
                  <Badge variant="accent">
                    <UserCheck className="w-3 h-3 mr-1" />
                    ORGANIZER
                  </Badge>
                ) : (
                  <Badge variant="neutral">BUYER</Badge>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => {
                  setDropdownOpen(false);
                  navigate('/account');
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-[6px] text-xs font-medium text-[var(--ink-secondary)] hover:text-[var(--ink)] hover:bg-[var(--paper-sunken)] transition-colors flex items-center gap-2 cursor-pointer"
              >
                <User className="w-3.5 h-3.5" />
                Account Settings
              </button>

              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="w-full text-left px-2.5 py-1.5 rounded-[6px] text-xs font-medium text-[var(--danger)] hover:bg-[var(--danger-subtle)] transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <LogOut className="w-3.5 h-3.5" />
                {isLoggingOut ? 'Signing out...' : 'Sign Out'}
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
