import React, { useState } from 'react';
import { Lock, Eye, EyeOff } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { loginUser, clearAuthError } from './authSlice';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Alert';

export interface LoginFormProps {
  onSwitchToRegister: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onSwitchToRegister }) => {
  const dispatch = useAppDispatch();
  const { loading, error } = useAppSelector((state) => state.auth);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formErrors, setFormErrors] = useState<{ email?: string; password?: string }>({});

  const validate = () => {
    const errors: { email?: string; password?: string } = {};
    if (!email.trim()) {
      errors.email = 'Please enter your email address';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Please enter a valid email address';
    }

    if (!password) {
      errors.password = 'Please enter your password';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    dispatch(loginUser({ email, password }));
  };

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
      {error && (
        <Alert
          variant="danger"
          title="Unable to sign in"
          onClose={() => dispatch(clearAuthError())}
        >
          {error}
        </Alert>
      )}

      {/* Form — no leading icons per §9.2 (labels make type clear) */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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

        <div className="flex flex-col gap-1">
          <Input
            label="Password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="Enter your password"
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
            error={formErrors.password}
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

        {/* Primary CTA — verb-first label, no product name, no directional arrow on submit */}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          isLoading={loading}
          className="w-full mt-2"
        >
          Sign in
        </Button>
      </form>

    </div>
  );
};
