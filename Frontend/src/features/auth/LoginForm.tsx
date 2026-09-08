import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { useLoginMutation, getRtkErrorMessage } from '../../api/authApi';
import { validateEmail, validatePassword, sanitizeInput } from '../../utils/validation';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Alert';

export interface LoginFormProps {
  onSwitchToRegister: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onSwitchToRegister }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [login, { isLoading, error: rtkError, reset }] = useLoginMutation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formErrors, setFormErrors] = useState<{ email?: string; password?: string }>({});
  const [touched, setTouched] = useState<{ email?: boolean; password?: boolean }>({});

  const validate = () => {
    const emailErr = validateEmail(email);
    const passErr = validatePassword(password);

    const errors: { email?: string; password?: string } = {};
    if (emailErr) errors.email = emailErr;
    if (passErr) errors.password = passErr;

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleBlur = (field: 'email' | 'password') => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    if (field === 'email') {
      const err = validateEmail(email);
      setFormErrors((prev) => ({ ...prev, email: err || undefined }));
    } else if (field === 'password') {
      const err = validatePassword(password);
      setFormErrors((prev) => ({ ...prev, password: err || undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ email: true, password: true });

    if (!validate()) return;

    try {
      await login({
        email: sanitizeInput(email).toLowerCase(),
        password,
      }).unwrap();

      const state = location.state as { from?: { pathname?: string } } | null;
      navigate(state?.from?.pathname ?? '/account', { replace: true });
    } catch {
      // RTK Query maintains the error state accessible via rtkError
    }
  };

  const errorMessage = rtkError ? getRtkErrorMessage(rtkError) : null;

  return (
    <div className="w-full flex flex-col gap-6">
      {/* Editorial Header */}
      <div className="flex flex-col gap-1.5">
        <span className="text-caption text-[var(--accent)]">ACCOUNT ACCESS</span>
        <h1 className="font-display font-normal text-[38px] sm:text-[42px] tracking-tight leading-tight text-[var(--ink)] whitespace-nowrap">
          Welcome back
        </h1>
        <p className="text-[14px] text-[var(--ink-secondary)] leading-relaxed mt-0.5">
          Sign in to manage your tickets, seats, and reservations.
        </p>
      </div>

      {/* Calm Error Alert */}
      {errorMessage && (
        <Alert
          variant="danger"
          title="Unable to sign in"
          onClose={() => reset()}
        >
          {errorMessage}
        </Alert>
      )}

      {/* Form with Real-time & On-blur Validations */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <Input
          label="Email address"
          type="email"
          autoComplete="email"
          placeholder="e.g. clara@example.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (formErrors.email) {
              setFormErrors((prev) => ({ ...prev, email: undefined }));
            }
            if (rtkError) reset();
          }}
          onBlur={() => handleBlur('email')}
          error={touched.email ? formErrors.email : undefined}
          required
        />

        <div className="flex flex-col gap-1">
          <Input
            label="Password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (formErrors.password) {
                setFormErrors((prev) => ({ ...prev, password: undefined }));
              }
              if (rtkError) reset();
            }}
            onBlur={() => handleBlur('password')}
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
            error={touched.password ? formErrors.password : undefined}
            required
          />
          <div className="flex justify-end mt-0.5">
            <button
              type="button"
              className="text-caption text-[var(--ink-muted)] hover:text-[var(--accent)] link-underline cursor-pointer transition-colors duration-[150ms]"
            >
              FORGOT PASSWORD?
            </button>
          </div>
        </div>

        {/* Primary CTA */}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          isLoading={isLoading}
          disabled={isLoading}
          className="w-full mt-2"
        >
          Sign in
        </Button>

        <p className="text-[13px] text-[var(--ink-secondary)] text-center mt-1">
          Don't have an account?{' '}
          <button
            type="button"
            onClick={onSwitchToRegister}
            className="text-[var(--accent)] font-medium link-underline cursor-pointer hover:opacity-80 transition-opacity"
          >
            Create one
          </button>
        </p>
      </form>
    </div>
  );
};
