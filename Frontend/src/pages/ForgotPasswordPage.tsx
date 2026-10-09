import type React from 'react';
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, MailCheck } from 'lucide-react';
import { useForgotPasswordMutation, getRtkErrorMessage } from '../api/authApi';
import { AuthLayout } from '../components/layout/AuthLayout';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Alert } from '../components/ui/Alert';
import { validateEmail, sanitizeInput } from '../utils/validation';
import { useDocumentTitle } from '../app/useDocumentTitle';

/**
 * /forgot-password. Asks for an email and always shows the same neutral
 * confirmation afterwards: the API answers 202 whether or not the account
 * exists, so this page can't be used to find out who is registered.
 */
export const ForgotPasswordPage: React.FC = () => {
  useDocumentTitle('Forgot password');
  const location = useLocation();
  // LoginForm passes the email it already had, so the user doesn't retype it.
  const initialEmail = (location.state as { email?: string } | null)?.email ?? '';

  const [forgotPassword, { isLoading, error, reset }] = useForgotPasswordMutation();
  const [email, setEmail] = useState(initialEmail);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [sentMessage, setSentMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateEmail(email);
    setEmailError(err);
    if (err) return;

    try {
      const result = await forgotPassword({ email: sanitizeInput(email).toLowerCase() }).unwrap();
      setSentMessage(result.message);
    } catch {
      // Shown through `error` below.
    }
  };

  return (
    <AuthLayout>
      <Card className="w-full shadow-sm border-[var(--rule)] flex flex-col gap-6">
        <div className="flex flex-col gap-1.5">
          <span className="text-caption text-[var(--accent)]">ACCOUNT RECOVERY</span>
          <h1 className="font-display font-normal text-[34px] tracking-tight leading-tight text-[var(--ink)]">
            Forgot your password?
          </h1>
          <p className="text-[14px] text-[var(--ink-secondary)] leading-relaxed mt-0.5">
            Enter the email you signed up with and we'll send you a link to choose a new one.
          </p>
        </div>

        {sentMessage ? (
          <div className="flex flex-col gap-4 p-5 rounded-[10px] border border-[var(--success)]/20 bg-[var(--success-subtle)]">
            <div className="flex items-start gap-3">
              <MailCheck className="w-5 h-5 text-[var(--success)] shrink-0 mt-0.5" />
              <div className="flex flex-col gap-1">
                <h3 className="font-sans font-medium text-[15px] text-[var(--ink)]">Check your email</h3>
                <p className="text-[13px] text-[var(--ink-secondary)] leading-relaxed">
                  {sentMessage} The link expires in 30 minutes.
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="md"
              onClick={() => setSentMessage(null)}
              className="w-full"
            >
              Use a different email
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
            {error && (
              <Alert variant="danger" title="Couldn't send the link" onClose={() => reset()}>
                {getRtkErrorMessage(error)}
              </Alert>
            )}

            <Input
              label="Email address"
              type="email"
              autoComplete="email"
              placeholder="e.g. clara@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailError) setEmailError(null);
                if (error) reset();
              }}
              error={emailError ?? undefined}
              autoFocus={!initialEmail}
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
              Send reset link
            </Button>
          </form>
        )}

        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 text-[13px] text-[var(--ink-secondary)] hover:text-[var(--accent)] self-center"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to sign in
        </Link>
      </Card>
    </AuthLayout>
  );
};
