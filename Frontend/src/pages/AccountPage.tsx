import type React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '../app/hooks';
import { useLogoutMutation } from '../api/authApi';
import { AuthLayout } from '../components/layout/AuthLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { LogOut, CheckCircle, ShieldCheck, Ticket } from 'lucide-react';

/** The signed-in landing page. Rendered behind ProtectedRoute, so `user` is present. */
export const AccountPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAppSelector((state) => state.auth);
  const [logout, { isLoading: isLoggingOut }] = useLogoutMutation();

  if (!user) return null;

  const handleLogout = async () => {
    try {
      await logout().unwrap();
    } catch {
      // Clearing the cookie is the server's job; if it fails the guard keeps
      // the session as-is and the error surfaces on the next protected call.
    }
    navigate('/login', { replace: true });
  };

  return (
    <AuthLayout>
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

        <div className="flex flex-col gap-3">
          <div className="p-3.5 rounded-[6px] border border-[var(--rule)] bg-[var(--paper-raised)] flex items-center justify-between">
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
            onClick={handleLogout}
            isLoading={isLoggingOut}
            disabled={isLoggingOut}
            className="w-full"
          >
            Sign Out
          </Button>
        </div>
      </Card>
    </AuthLayout>
  );
};
