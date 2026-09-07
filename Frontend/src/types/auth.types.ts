export type UserRole = 'organizer' | 'buyer';

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

export interface AuthResponse {
  message: string;
  user?: User;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  successMessage: string | null;
}
