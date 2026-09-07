import React, { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { logoutUser, clearAuthError, clearSuccessMessage } from './authSlice';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { LogOut, CheckCircle } from 'lucide-react';

export const AuthPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const { user, isAuthenticated } = useAppSelector((state) => state.auth);
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');

  const handleTabSwitch = (tab: 'login' | 'register') => {
    dispatch(clearAuthError());
    dispatch(clearSuccessMessage());
    setActiveTab(tab);
  };

  return (
    <AuthLayout>
      {isAuthenticated && user ? (
        /* Authenticated State Preview */
        <Card className="w-full flex flex-col gap-6 shadow-sm border-[var(--rule)]">
          <div className="flex items-center justify-between pb-4 border-b border-[var(--rule)]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[var(--accent-subtle)] text-[var(--accent)] flex items-center justify-center border border-[var(--accent-border)] font-medium">
                {user.username.charAt(0).toUpperCase()}
              </div>
              <div className="flex flex-col">
                <span className="text-caption text-[var(--ink-muted)]">LOGGED IN AS</span>
                <h2 className="font-display font-medium text-xl text-[var(--ink)]">
                  {user.username}
                </h2>
              </div>
            </div>
            <Badge variant="success">
              <CheckCircle className="w-3 h-3 mr-1" />
              AUTHENTICATED
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-4 p-4 rounded-[4px] bg-[var(--paper-sunken)] border border-[var(--rule)] text-sm">
            <div>
              <span className="text-caption text-[var(--ink-muted)] block">EMAIL</span>
              <span className="font-mono text-[13px] text-[var(--ink)] mt-0.5 block truncate">
                {user.email}
              </span>
            </div>
            <div>
              <span className="text-caption text-[var(--ink-muted)] block">ROLE</span>
              <span className="font-mono text-[13px] text-[var(--ink)] mt-0.5 block uppercase">
                {user.role || 'BUYER'}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <Button
              variant="secondary"
              size="md"
              leftIcon={<LogOut className="w-4 h-4" />}
              onClick={() => dispatch(logoutUser())}
              className="w-full"
            >
              Sign Out
            </Button>
          </div>
        </Card>
      ) : (
        /* Login / Register Card Container */
        <Card className="w-full shadow-sm border-[var(--rule)]">
          {/* Subtle Tab Switcher (§9.7) */}
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
            
            {/* Sliding Indicator */}
            <div 
              className="absolute bottom-0 left-0 h-[2px] bg-[var(--accent)] transition-all duration-[200ms] ease-[cubic-bezier(0.25,0.1,0.25,1)]"
              style={{
                width: activeTab === 'login' ? '4rem' : '120px',
                transform: activeTab === 'login' ? 'translateX(0)' : 'translateX(calc(4rem + 1.5rem))'
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
