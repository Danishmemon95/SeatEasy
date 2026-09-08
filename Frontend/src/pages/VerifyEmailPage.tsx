import type React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useVerifyEmailQuery, getRtkErrorMessage } from '../api/authApi';
import { AuthLayout } from '../components/layout/AuthLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { CheckCircle2, AlertTriangle, ArrowRight, RefreshCw } from 'lucide-react';

/**
 * Handles the emailed verification link (/verify?token=...). The token is read
 * from the query string by the router; verifying also logs the user in
 * server-side, so success lands on the account page.
 */
export const VerifyEmailPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const { data, error, isLoading, refetch } = useVerifyEmailQuery(token, {
    skip: !token,
  });

  const errorMessage = error
    ? getRtkErrorMessage(error)
    : !token
      ? 'This link is missing its verification token.'
      : null;

  // Drop the token from the URL on the way out so it is not left in history.
  const onNavigateHome = () => navigate(data ? '/account' : '/login', { replace: true });

  return (
    <AuthLayout>
      <Card className="w-full shadow-sm border-[var(--rule)] flex flex-col gap-6">
        {isLoading && token ? (
          <div className="flex flex-col items-center justify-center py-10 gap-4 text-center">
            <RefreshCw className="w-8 h-8 text-[var(--accent)] animate-spin" />
            <div className="flex flex-col gap-1">
              <h2 className="font-display font-medium text-xl text-[var(--ink)]">
                Verifying your email...
              </h2>
              <p className="text-sm text-[var(--ink-secondary)]">
                Please wait while we secure and activate your SeatEase account.
              </p>
            </div>
          </div>
        ) : data ? (
          <div className="flex flex-col gap-5">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--rule)]">
              <Badge variant="success">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                VERIFIED
              </Badge>
              <span className="text-caption text-[var(--ink-muted)]">EMAIL CONFIRMATION</span>
            </div>

            <div className="flex flex-col gap-2">
              <h1 className="font-display font-normal text-3xl tracking-tight text-[var(--ink)]">
                Email Verified!
              </h1>
              <p className="text-sm text-[var(--ink-secondary)] leading-relaxed">
                {data.message || 'Your email has been confirmed and your account is now fully active.'}
              </p>
            </div>

            {data.user && (
              <div className="p-4 rounded-[6px] bg-[var(--paper-sunken)] border border-[var(--rule)] flex flex-col gap-1">
                <span className="text-caption text-[var(--ink-muted)]">ACTIVATED PROFILE</span>
                <span className="font-medium text-sm text-[var(--ink)]">
                  {data.user.username} ({data.user.email})
                </span>
              </div>
            )}

            <Button
              variant="primary"
              size="lg"
              onClick={onNavigateHome}
              rightIcon={<ArrowRight className="w-4 h-4" />}
              className="w-full mt-2"
            >
              Continue to SeatEase
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--rule)]">
              <Badge variant="danger">
                <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                VERIFICATION FAILED
              </Badge>
              <span className="text-caption text-[var(--ink-muted)]">SECURITY CHECK</span>
            </div>

            <div className="flex flex-col gap-2">
              <h1 className="font-display font-normal text-2xl tracking-tight text-[var(--ink)]">
                Invalid or Expired Token
              </h1>
              <p className="text-sm text-[var(--ink-secondary)] leading-relaxed">
                {errorMessage ||
                  'The verification link you used may have expired or is no longer valid. Please log in or request a new confirmation.'}
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <Button
                variant="secondary"
                size="md"
                onClick={() => refetch()}
                disabled={!token}
                leftIcon={<RefreshCw className="w-4 h-4" />}
                className="w-full"
              >
                Retry Verification
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={onNavigateHome}
                className="w-full"
              >
                Back to Sign In
              </Button>
            </div>
          </div>
        )}
      </Card>
    </AuthLayout>
  );
};
