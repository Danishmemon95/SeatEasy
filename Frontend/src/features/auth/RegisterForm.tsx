import React, { useState } from 'react';
import { Eye, EyeOff, MailCheck, Check, X } from 'lucide-react';
import { useRegisterMutation, getRtkErrorMessage, getFieldErrors } from '../../api/authApi';
import {
  validateUsername,
  validateEmail,
  validatePassword,
  evaluatePasswordStrength,
  sanitizeInput,
} from '../../utils/validation';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Alert';

export interface RegisterFormProps {
  onSwitchToLogin: () => void;
}

export const RegisterForm: React.FC<RegisterFormProps> = ({ onSwitchToLogin }) => {
  const [registerUser, { isLoading, error: rtkError, reset }] = useRegisterMutation();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [successResponse, setSuccessResponse] = useState<string | null>(null);

  const [formErrors, setFormErrors] = useState<{
    username?: string;
    email?: string;
    password?: string;
  }>({});

  const [touched, setTouched] = useState<{
    username?: boolean;
    email?: boolean;
    password?: boolean;
  }>({});

  const passwordEvaluation = evaluatePasswordStrength(password);

  const validate = () => {
    const userErr = validateUsername(username);
    const emailErr = validateEmail(email);
    const passErr = validatePassword(password);

    const errors: { username?: string; email?: string; password?: string } = {};
    if (userErr) errors.username = userErr;
    if (emailErr) errors.email = emailErr;
    if (passErr) errors.password = passErr;

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleBlur = (field: 'username' | 'email' | 'password') => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    if (field === 'username') {
      const err = validateUsername(username);
      setFormErrors((prev) => ({ ...prev, username: err || undefined }));
    } else if (field === 'email') {
      const err = validateEmail(email);
      setFormErrors((prev) => ({ ...prev, email: err || undefined }));
    } else if (field === 'password') {
      const err = validatePassword(password);
      setFormErrors((prev) => ({ ...prev, password: err || undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ username: true, email: true, password: true });

    if (!validate()) return;

    try {
      const result = await registerUser({
        username: sanitizeInput(username),
        email: sanitizeInput(email).toLowerCase(),
        password,
      }).unwrap();

      // A 202 means "accepted", not "created" — the API deliberately gives the
      // same answer whether or not the address was already registered, so the
      // banner must not claim an account was made. Show the server's wording.
      setSuccessResponse(result.message);
    } catch (err) {
      // Surface per-field messages from the backend schema next to their inputs.
      const fieldErrors = getFieldErrors(err);
      if (fieldErrors) {
        setFormErrors((prev) => ({ ...prev, ...fieldErrors }));
        setTouched({ username: true, email: true, password: true });
      }
    }
  };

  const errorMessage = rtkError ? getRtkErrorMessage(rtkError) : null;

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
      {successResponse ? (
        <div className="flex flex-col gap-4 p-5 rounded-[10px] border border-[var(--success)]/20 bg-[var(--success-subtle)] text-[var(--ink)]">
          <div className="flex items-start gap-3">
            <MailCheck className="w-5 h-5 text-[var(--success)] shrink-0 mt-0.5" />
            <div className="flex flex-col gap-1">
              <h3 className="font-sans font-medium text-[15px] text-[var(--ink)]">
                Check your email
              </h3>
              <p className="text-[13px] text-[var(--ink-secondary)] leading-relaxed">
                {successResponse}
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={() => {
              setSuccessResponse(null);
              onSwitchToLogin();
            }}
            className="w-full mt-1"
          >
            Proceed to sign in
          </Button>
        </div>
      ) : (
        <>
          {/* Server Error Alert */}
          {errorMessage && (
            <Alert
              variant="danger"
              title="Unable to create account"
              onClose={() => reset()}
            >
              {errorMessage}
            </Alert>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
            <Input
              label="Username"
              type="text"
              autoComplete="username"
              placeholder="e.g. ClaraOswald"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                if (formErrors.username) {
                  setFormErrors((prev) => ({ ...prev, username: undefined }));
                }
                if (rtkError) reset();
              }}
              onBlur={() => handleBlur('username')}
              error={touched.username ? formErrors.username : undefined}
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
                if (formErrors.email) {
                  setFormErrors((prev) => ({ ...prev, email: undefined }));
                }
                if (rtkError) reset();
              }}
              onBlur={() => handleBlur('email')}
              error={touched.email ? formErrors.email : undefined}
              required
            />

            <div className="flex flex-col gap-2">
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Create a strong password"
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

              {/* Real-time Password Strength Meter */}
              {password.length > 0 && (
                <div className="flex flex-col gap-2 p-3 rounded-[6px] bg-[var(--paper-sunken)] border border-[var(--rule)]">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[var(--ink-muted)] font-medium">Security strength:</span>
                    <span
                      className="font-medium capitalize"
                      style={{ color: passwordEvaluation.color }}
                    >
                      {passwordEvaluation.label}
                    </span>
                  </div>

                  {/* Visual strength bar */}
                  <div className="grid grid-cols-4 gap-1.5 h-1.5 w-full">
                    {[1, 2, 3, 4].map((step) => (
                      <div
                        key={step}
                        className="rounded-full h-full transition-all duration-300"
                        style={{
                          backgroundColor:
                            passwordEvaluation.score >= step
                              ? passwordEvaluation.color
                              : 'var(--rule)',
                        }}
                      />
                    ))}
                  </div>

                  {/* Checklist of security requirements */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-1">
                    {passwordEvaluation.rules.map((rule) => (
                      <div
                        key={rule.id}
                        className={`flex items-center gap-1.5 text-[11px] transition-colors duration-200 ${
                          rule.passed
                            ? 'text-[var(--success)] font-medium'
                            : 'text-[var(--ink-muted)]'
                        }`}
                      >
                        {rule.passed ? (
                          <Check className="w-3 h-3 text-[var(--success)] shrink-0" />
                        ) : (
                          <X className="w-3 h-3 text-[var(--ink-muted)] opacity-60 shrink-0" />
                        )}
                        <span>{rule.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
              Create account
            </Button>
          </form>
        </>
      )}
    </div>
  );
};
