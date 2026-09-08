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
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
  loading: boolean;
  error: string | null;
  successMessage: string | null;
}
