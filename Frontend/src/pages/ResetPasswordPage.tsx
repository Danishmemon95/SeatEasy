import type React from 'react';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { useResetPasswordMutation, getFieldErrors, getRtkErrorMessage } from '../api/authApi';
import { AuthLayout } from '../components/layout/AuthLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Alert } from '../components/ui/Alert';
import { Badge } from '../components/ui/Badge';
import { PasswordInput } from '../features/auth/PasswordInput';
import { PasswordStrengthMeter } from '../features/auth/PasswordStrengthMeter';
import { useToast } from '../features/toast/useToast';
import { validatePassword } from '../utils/validation';
import { useDocumentTitle } from '../app/useDocumentTitle';

type FieldErrors = { password?: string; confirm?: string };

/**
 * /reset-password?token=… — the link from the reset email.
 *
 * The token is read once and then removed from the URL, and the page sets
 * referrer to no-referrer while mounted, so the token doesn't linger in
 * history or leak to another site through the Referer header.
 */
export const ResetPasswordPage: React.FC = () => {
  useDocumentTitle('Reset password');
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [token] = useState(() => searchParams.get('token') ?? '');

  const [resetPassword, { isLoading, error, reset }] = useResetPasswordMutation();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [linkInvalid, setLinkInvalid] = useState(!/^[a-f0-9]{64}$/.test(token));

  useEffect(() => {
    if (searchParams.has('token')) setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'referrer';
    meta.content = 'no-referrer';
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: FieldErrors = {};
    const passErr = validatePassword(password);
    if (passErr) errors.password = passErr;
    if (confirm !== password) errors.confirm = 'Passwords do not match';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    try {
      await resetPassword({ token, password }).unwrap();
      toast('Password reset. Sign in with your new password.', 'success');
      navigate('/login', { replace: true });
    } catch (err) {
      // A password rule the client missed comes back as a field error; anything
      // else on a 400 means the link itself is bad (expired, used, malformed).
      const serverFields = getFieldErrors(err);
      if (serverFields?.password) {
        setFieldErrors({ password: serverFields.password });
      } else if (typeof err === 'object' && err !== null && 'status' in err && err.status === 400) {
        setLinkInvalid(true);
      }
    }
  };

  return (
    <AuthLayout>
      <Card className="w-full shadow-sm border-[var(--rule)] flex flex-col gap-6">
        {linkInvalid ? (
          <div className="flex flex-col gap-5">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--rule)]">
              <Badge variant="danger">
                <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                LINK EXPIRED
              </Badge>
              <span className="text-caption text-[var(--ink-muted)]">ACCOUNT RECOVERY</span>
            </div>
            <div className="flex flex-col gap-2">
              <h1 className="font-display font-normal text-2xl tracking-tight text-[var(--ink)]">
                This reset link no longer works
              </h1>
              <p className="text-sm text-[var(--ink-secondary)] leading-relaxed">
                Reset links expire after 30 minutes and work only once. Request a new one and
                use the most recent email.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Button variant="primary" size="md" onClick={() => navigate('/forgot-password')} className="w-full">
                Send a new link
              </Button>
              <Button variant="ghost" size="md" onClick={() => navigate('/login')} className="w-full">
                Back to sign in
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              <span className="text-caption text-[var(--accent)]">ACCOUNT RECOVERY</span>
              <h1 className="font-display font-normal text-[34px] tracking-tight leading-tight text-[var(--ink)]">
                Choose a new password
              </h1>
              <p className="text-[14px] text-[var(--ink-secondary)] leading-relaxed mt-0.5">
                This signs you out on every device. You'll sign in again with the new password.
              </p>
            </div>

            {error && !getFieldErrors(error) && (
              <Alert variant="danger" title="Couldn't reset your password" onClose={() => reset()}>
                {getRtkErrorMessage(error)}
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
              <div className="flex flex-col gap-2">
                <PasswordInput
                  label="New password"
                  autoComplete="new-password"
                  placeholder="Create a strong password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (fieldErrors.password) setFieldErrors((p) => ({ ...p, password: undefined }));
                  }}
                  error={fieldErrors.password}
                  autoFocus
                  required
                />
                <PasswordStrengthMeter password={password} />
              </div>

              <PasswordInput
                label="Confirm new password"
                autoComplete="new-password"
                placeholder="Type it again"
                value={confirm}
                onChange={(e) => {
                  setConfirm(e.target.value);
                  if (fieldErrors.confirm) setFieldErrors((p) => ({ ...p, confirm: undefined }));
                }}
                error={fieldErrors.confirm}
                required
              />

              <Button
                type="submit"
                variant="primary"
                size="lg"
                isLoading={isLoading}
                disabled={isLoading}
                className="w-full mt-2"
              >
                Reset password
              </Button>
            </form>
          </>
        )}
      </Card>
    </AuthLayout>
  );
};
