export type UserRole = 'organizer' | 'buyer' | 'admin';

export interface User {
  id: number;
  username: string;
  email: string;
  role?: UserRole;
  isVerified?: boolean;
  /** Persisted city preference (plan §0.1). Null when not yet chosen. */
  city?: string | null;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  username: string;
  email: string;
  password: string;
}

export interface VerifyEmailPayload {
  token: string;
}

export interface AuthResponse {
  message: string;
  user?: User;
}

/**
 * Registration deliberately returns no user. The API answers 202 with the same
 * message whether or not the address was already taken, so that registering
 * cannot be used to discover which emails exist.
 */
export interface RegisterResponse {
  message: string;
}

/** Per-field validation failures from the backend schema. */
export interface ApiFieldError {
  field: string;
  message: string;
}

export interface CheckAuthResponse {
  success: boolean;
  message: string;
  /** null when signed out (checkAuth maps the 401 to this). */
  user: User | null;
}

export interface VerifyResponse {
  message: string;
  user: User;
}

export interface ApiErrorResponse {
  message?: string;
  code?: string;
  errors?: ApiFieldError[];
}

/** Body for resend-verification and forgot-password. */
export interface EmailPayload {
  email: string;
}

export interface ResetPasswordPayload {
  token: string;
  password: string;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

/** Plain `{ message }` answer, e.g. the 202 from resend and forgot-password. */
export interface MessageResponse {
  message: string;
}
