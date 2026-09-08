import type React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAppDispatch } from '../app/hooks';
import { clearAuthError, clearSuccessMessage } from '../features/auth/authSlice';
import { AuthLayout } from '../components/layout/AuthLayout';
import { LoginForm } from '../features/auth/LoginForm';
import { RegisterForm } from '../features/auth/RegisterForm';
import { Card } from '../components/ui/Card';

export interface AuthPageProps {
  mode: 'login' | 'register';
}

const TABS = [
  { mode: 'login' as const, to: '/login', label: 'SIGN IN', width: '4rem' },
  { mode: 'register' as const, to: '/register', label: 'CREATE ACCOUNT', width: '120px' },
];

/**
 * Shell for the sign-in / create-account pair. The active tab is derived from
 * the route rather than local state, so the browser's back button steps
 * between them and each is independently linkable.
 */
export const AuthPage: React.FC<AuthPageProps> = ({ mode }) => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  // Preserve the post-login redirect target across a tab switch.
  const switchTo = (to: string) => {
    dispatch(clearAuthError());
    dispatch(clearSuccessMessage());
    navigate(to, { replace: true, state: location.state });
  };

  return (
    <AuthLayout>
      <Card className="w-full shadow-sm border-[var(--rule)]">
        <div className="relative flex border-b border-[var(--rule)] mb-6 gap-6">
          {TABS.map((tab) => (
            <Link
              key={tab.mode}
              to={tab.to}
              replace
              state={location.state}
              onClick={() => {
                dispatch(clearAuthError());
                dispatch(clearSuccessMessage());
              }}
              className={`pb-3 text-caption transition-colors cursor-pointer text-center ${
                mode === tab.mode
                  ? 'text-[var(--accent)] font-medium'
                  : 'text-[var(--ink-muted)] hover:text-[var(--ink-secondary)] font-normal'
              }`}
              style={{ width: tab.width }}
            >
              {tab.label}
            </Link>
          ))}

          <div
            className="absolute bottom-0 left-0 h-[2px] bg-[var(--accent)] transition-all duration-200 ease-out"
            style={{
              width: mode === 'login' ? '4rem' : '120px',
              transform:
                mode === 'login' ? 'translateX(0)' : 'translateX(calc(4rem + 1.5rem))',
            }}
          />
        </div>

        {mode === 'login' ? (
          <LoginForm onSwitchToRegister={() => switchTo('/register')} />
        ) : (
          <RegisterForm onSwitchToLogin={() => switchTo('/login')} />
        )}
      </Card>
    </AuthLayout>
  );
};
