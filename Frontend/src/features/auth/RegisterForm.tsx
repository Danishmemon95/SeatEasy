import React, { useState } from 'react';
import { Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { registerUser, clearAuthError, clearSuccessMessage } from './authSlice';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Alert';

export interface RegisterFormProps {
  onSwitchToLogin: () => void;
}

export const RegisterForm: React.FC<RegisterFormProps> = ({ onSwitchToLogin }) => {
  const dispatch = useAppDispatch();
  const { loading, error, successMessage } = useAppSelector((state) => state.auth);

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formErrors, setFormErrors] = useState<{
    username?: string;
    email?: string;
    password?: string;
  }>({});

  const validate = () => {
    const errors: { username?: string; email?: string; password?: string } = {};

    if (!username.trim()) {
      errors.username = 'Please enter a username';
    } else if (username.trim().length < 3) {
      errors.username = 'Username must be at least 3 characters';
    }

    if (!email.trim()) {
      errors.email = 'Please enter your email address';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Please enter a valid email address';
    }

    if (!password) {
      errors.password = 'Please enter a password';
    } else if (password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    dispatch(registerUser({ username, email, password }));
  };

  return (
    <div className="w-full flex flex-col gap-6">
      {/* Editorial Header */}
      <div className="flex flex-col gap-1.5">
        <span className="text-caption text-[var(--accent)]">NEW MEMBERSHIP</span>
        <h1 className="font-display font-normal text-[38px] sm:text-[42px] tracking-tight leading-tight text-[var(--ink)] whitespace-nowrap">
          Create your account
        </h1>
        <p className="text-[14px] text-[var(--ink-secondary)] leading-relaxed mt-0.5">
          Reserve seats, access digital stubs, and receive live event updates.
        </p>
      </div>

      {/* Success Banner */}
      {successMessage ? (
        <div className="flex flex-col gap-4 p-5 rounded-[10px] border border-[var(--success)]/20 bg-[var(--success-subtle)] text-[var(--ink)]">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-[var(--success)] shrink-0 mt-0.5" />
            <div className="flex flex-col gap-1">
              <h3 className="font-sans font-medium text-[15px] text-[var(--ink)]">
                Registration successful
              </h3>
              <p className="text-[13px] text-[var(--ink-secondary)] leading-relaxed">
                {successMessage}
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={() => {
              dispatch(clearSuccessMessage());
              onSwitchToLogin();
            }}
            className="w-full mt-1"
          >
            Proceed to sign in
          </Button>
        </div>
      ) : (
        <>
          {/* Calm Error Alert */}
          {error && (
            <Alert
              variant="danger"
              title="Unable to create account"
              onClose={() => dispatch(clearAuthError())}
            >
              {error}
            </Alert>
          )}

          {/* Form — no leading icons per §9.2 */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Username"
              type="text"
              autoComplete="username"
              placeholder="e.g. ClaraOswald"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                if (formErrors.username) setFormErrors((prev) => ({ ...prev, username: undefined }));
                if (error) dispatch(clearAuthError());
              }}
              error={formErrors.username}
              required
            />

            <Input
              label="Email address"
              type="email"
              autoComplete="email"
              placeholder="e.g. clara@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (formErrors.email) setFormErrors((prev) => ({ ...prev, email: undefined }));
                if (error) dispatch(clearAuthError());
              }}
              error={formErrors.email}
              required
            />

            <Input
              label="Password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (formErrors.password) setFormErrors((prev) => ({ ...prev, password: undefined }));
                if (error) dispatch(clearAuthError());
              }}
              rightAdornment={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--paper-sunken)] cursor-pointer transition-[background-color,color] duration-[150ms] ease-[cubic-bezier(0.25,0.1,0.25,1)]"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              }
              helperText="Must be 8+ characters with numbers or symbols"
              error={formErrors.password}
              required
            />

            {/* Primary CTA — verb-first label, no product name, no directional arrow */}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={loading}
              className="w-full mt-2"
            >
              Create account
            </Button>
          </form>

        </>
      )}
    </div>
  );
};
