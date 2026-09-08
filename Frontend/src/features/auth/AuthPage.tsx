import React, { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { useLogoutMutation } from '../../api/authApi';
import { clearAuthError, clearSuccessMessage } from './authSlice';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';
import { VerifyEmailPage } from './VerifyEmailPage';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { LogOut, CheckCircle, ShieldCheck, Ticket } from 'lucide-react';

export const AuthPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const { user, isAuthenticated } = useAppSelector((state) => state.auth);
  const [logout, { isLoading: isLoggingOut }] = useLogoutMutation();
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');

  // Check if URL has a verification token
  const urlParams = new URLSearchParams(window.location.search);
  const verificationToken = urlParams.get('token');

  const handleTabSwitch = (tab: 'login' | 'register') => {
    dispatch(clearAuthError());
    dispatch(clearSuccessMessage());
    setActiveTab(tab);
  };

  const handleClearUrlToken = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('token');
    window.history.replaceState({}, '', url.pathname);
  };

  if (verificationToken) {
    return (
      <VerifyEmailPage
        token={verificationToken}
        onNavigateHome={handleClearUrlToken}
      />
    );
  }

  return (
    <AuthLayout>
      {isAuthenticated && user ? (
        /* Authenticated State Profile View */
        <Card className="w-full flex flex-col gap-6 shadow-sm border-[var(--rule)]">
          <div className="flex items-center justify-between pb-4 border-b border-[var(--rule)]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[var(--accent-subtle)] text-[var(--accent)] flex items-center justify-center border border-[var(--accent-border)] font-medium text-base">
                {user.username.charAt(0).toUpperCase()}
              </div>
              <div className="flex flex-col">
                <span className="text-caption text-[var(--ink-muted)]">ACTIVE SESSION</span>
                <h2 className="font-display font-medium text-xl text-[var(--ink)]">
                  {user.username}
                </h2>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {user.isVerified ? (
                <Badge variant="success">
                  <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                  VERIFIED
                </Badge>
              ) : (
                <Badge variant="neutral">
                  <CheckCircle className="w-3.5 h-3.5 mr-1" />
                  AUTHENTICATED
                </Badge>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 p-4 rounded-[6px] bg-[var(--paper-sunken)] border border-[var(--rule)] text-sm">
            <div>
              <span className="text-caption text-[var(--ink-muted)] block">EMAIL ADDRESS</span>
              <span className="font-mono text-[13px] text-[var(--ink)] mt-0.5 block truncate">
                {user.email}
              </span>
            </div>
            <div>
              <span className="text-caption text-[var(--ink-muted)] block">ACCOUNT ROLE</span>
              <span className="font-mono text-[13px] text-[var(--ink)] mt-0.5 block uppercase font-medium">
                {user.role || 'BUYER'}
              </span>
            </div>
          </div>

          {/* Quick Actions Panel */}
          <div className="flex flex-col gap-3">
            <div className="p-3.5 rounded-[6px] border border-[var(--rule)] bg-[var(--paper-surface)] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Ticket className="w-4 h-4 text-[var(--accent)]" />
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-[var(--ink)]">Your Reservations</span>
                  <span className="text-xs text-[var(--ink-muted)]">Manage tickets and seats</span>
                </div>
              </div>
              <Badge variant="accent">Ready</Badge>
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-2 border-t border-[var(--rule)]">
            <Button
              variant="secondary"
              size="md"
              leftIcon={<LogOut className="w-4 h-4" />}
              onClick={() => logout()}
              isLoading={isLoggingOut}
              disabled={isLoggingOut}
              className="w-full"
            >
              Sign Out
            </Button>
          </div>
        </Card>
      ) : (
        /* Login / Register Card Container */
        <Card className="w-full shadow-sm border-[var(--rule)]">
          {/* Refined Tab Switcher */}
          <div className="relative flex border-b border-[var(--rule)] mb-6 gap-6">
            <button
              type="button"
              onClick={() => handleTabSwitch('login')}
              className={`pb-3 text-caption transition-colors cursor-pointer w-16 text-center ${
                activeTab === 'login'
                  ? 'text-[var(--accent)] font-medium'
                  : 'text-[var(--ink-muted)] hover:text-[var(--ink-secondary)] font-normal'
              }`}
            >
              SIGN IN
            </button>
            <button
              type="button"
              onClick={() => handleTabSwitch('register')}
              className={`pb-3 text-caption transition-colors cursor-pointer w-[120px] text-center ${
                activeTab === 'register'
                  ? 'text-[var(--accent)] font-medium'
                  : 'text-[var(--ink-muted)] hover:text-[var(--ink-secondary)] font-normal'
              }`}
            >
              CREATE ACCOUNT
            </button>

            {/* Sliding Underline Indicator */}
            <div
              className="absolute bottom-0 left-0 h-[2px] bg-[var(--accent)] transition-all duration-200 ease-out"
              style={{
                width: activeTab === 'login' ? '4rem' : '120px',
                transform:
                  activeTab === 'login'
                    ? 'translateX(0)'
                    : 'translateX(calc(4rem + 1.5rem))',
              }}
            />
          </div>

          {activeTab === 'login' ? (
            <LoginForm onSwitchToRegister={() => handleTabSwitch('register')} />
          ) : (
            <RegisterForm onSwitchToLogin={() => handleTabSwitch('login')} />
          )}
        </Card>
      )}
    </AuthLayout>
  );
};
