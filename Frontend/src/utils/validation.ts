/**
 * Input validation and security sanitation utilities
 */

// RFC 5322 standard compliant email regex
const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

// Alphanumeric, underscores, hyphens, 3 to 30 characters
const USERNAME_REGEX = /^[a-zA-Z0-9_-]{3,30}$/;

export interface PasswordRuleStatus {
  id: string;
  label: string;
  passed: boolean;
}

export interface PasswordStrengthResult {
  score: number; // 0 to 4
  label: 'Very Weak' | 'Weak' | 'Fair' | 'Good' | 'Strong';
  color: string;
  rules: PasswordRuleStatus[];
}

/**
 * Validates an email address.
 * Returns null if valid, or an error string if invalid.
 */
export const validateEmail = (email: string): string | null => {
  const trimmed = email.trim();
  if (!trimmed) {
    return 'Email address is required';
  }
  if (trimmed.length > 254) {
    return 'Email address is too long';
  }
  if (!EMAIL_REGEX.test(trimmed)) {
    return 'Please enter a valid email address';
  }
  return null;
};

/**
 * Validates a username.
 * Returns null if valid, or an error string if invalid.
 */
export const validateUsername = (username: string): string | null => {
  const trimmed = username.trim();
  if (!trimmed) {
    return 'Username is required';
  }
  if (trimmed.length < 3) {
    return 'Username must be at least 3 characters';
  }
  if (trimmed.length > 30) {
    return 'Username cannot exceed 30 characters';
  }
  if (!USERNAME_REGEX.test(trimmed)) {
    return 'Username can only contain letters, numbers, hyphens, and underscores';
  }
  return null;
};

/**
 * Validates a password for the register form.
 *
 * These rules mirror registerSchema in Backend/src/Auth/authSchemas.ts. Keeping
 * them in step means the strength meter's checklist is also the submit
 * condition, so a user is never told what is wrong only after a round trip.
 * The backend remains the authority — this is a convenience, not a control.
 */
export const validatePassword = (password: string): string | null => {
  if (!password) {
    return 'Password is required';
  }
  if (password.length < 8) {
    return 'Password must be at least 8 characters long';
  }
  // Bcrypt ignores anything past 72 bytes, so the backend rejects longer input
  // rather than silently accepting a password whose tail does not count.
  if (password.length > 72) {
    return 'Password cannot exceed 72 characters';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain an uppercase letter';
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must contain a lowercase letter';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must contain a number';
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return 'Password must contain a special character';
  }
  return null;
};

/**
 * Validates a password at sign-in.
 *
 * Deliberately only checks presence: the rules above are for choosing a new
 * password, and applying them here would lock out anyone whose existing
 * password predates them.
 */
export const validateLoginPassword = (password: string): string | null =>
  password ? null : 'Please provide your password';

/**
 * Evaluates password strength and returns score, rules checklist, and label.
 */
export const evaluatePasswordStrength = (password: string): PasswordStrengthResult => {
  const rules: PasswordRuleStatus[] = [
    {
      id: 'min-length',
      label: 'At least 8 characters',
      passed: password.length >= 8,
    },
    {
      id: 'uppercase',
      label: 'One uppercase letter (A-Z)',
      passed: /[A-Z]/.test(password),
    },
    {
      id: 'lowercase',
      label: 'One lowercase letter (a-z)',
      passed: /[a-z]/.test(password),
    },
    {
      id: 'number',
      label: 'One number (0-9)',
      passed: /[0-9]/.test(password),
    },
    {
      id: 'special',
      label: 'One special character (!@#$%^&*)',
      passed: /[^A-Za-z0-9]/.test(password),
    },
  ];

  const passedCount = rules.filter((r) => r.passed).length;

  let score = 0;
  let label: PasswordStrengthResult['label'] = 'Very Weak';
  let color = 'var(--danger)';

  if (!password) {
    score = 0;
    label = 'Very Weak';
    color = 'var(--rule)';
  } else if (passedCount <= 1) {
    score = 1;
    label = 'Very Weak';
    color = 'var(--danger)';
  } else if (passedCount === 2 || passedCount === 3) {
    score = 2;
    label = 'Weak';
    color = 'var(--amber, #f59e0b)';
  } else if (passedCount === 4) {
    score = 3;
    label = 'Good';
    color = 'var(--accent)';
  } else {
    score = 4;
    label = 'Strong';
    color = 'var(--success)';
  }

  return { score, label, color, rules };
};

/**
 * Trims surrounding whitespace from user input.
 *
 * NOTE: This is a convenience helper, not a security control. It does not
 * escape or strip anything and provides no protection against XSS or
 * injection. Rely on React's escaping for rendering and on parameterized
 * queries server-side.
 */
export const sanitizeInput = (input: string): string => {
  return input.trim();
};
