export type UserRole = 'organizer' | 'buyer' | 'admin';

export interface User {
  id: number;
  username: string;
  email: string;
  role?: UserRole;
  isVerified?: boolean;
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
  user: User;
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
