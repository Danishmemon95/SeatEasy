import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { authApi } from '../../api/authApi';
import type { AuthState, User } from '../../types/auth.types';

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isInitialized: false,
  loading: false,
  error: null,
  successMessage: null,
};

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearAuthError: (state) => {
      state.error = null;
    },
    clearSuccessMessage: (state) => {
      state.successMessage = null;
    },
    setAuthError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
    },
    setSuccessMessage: (state, action: PayloadAction<string>) => {
      state.successMessage = action.payload;
    },
    setUser: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
      state.isAuthenticated = true;
      state.error = null;
    },
    setInitialized: (state, action: PayloadAction<boolean>) => {
      state.isInitialized = action.payload;
    },
    logoutLocal: (state) => {
      state.user = null;
      state.isAuthenticated = false;
      state.error = null;
      state.successMessage = null;
    },
  },
  extraReducers: (builder) => {
    // Check Auth endpoint matches
    builder
      .addMatcher(authApi.endpoints.checkAuth.matchPending, (state) => {
        state.loading = true;
      })
      .addMatcher(authApi.endpoints.checkAuth.matchFulfilled, (state, action) => {
        state.loading = false;
        state.isInitialized = true;
        state.user = action.payload.user;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addMatcher(authApi.endpoints.checkAuth.matchRejected, (state) => {
        state.loading = false;
        state.isInitialized = true;
        state.user = null;
        state.isAuthenticated = false;
      });

    // Login endpoint matches
    builder
      .addMatcher(authApi.endpoints.login.matchPending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addMatcher(authApi.endpoints.login.matchFulfilled, (state, action) => {
        state.loading = false;
        if (action.payload.user) {
          state.user = action.payload.user;
          state.isAuthenticated = true;
          state.isInitialized = true;
        }
        state.error = null;
      })
      .addMatcher(authApi.endpoints.login.matchRejected, (state) => {
        state.loading = false;
      });

    // Logout endpoint matches
    builder
      .addMatcher(authApi.endpoints.logout.matchFulfilled, (state) => {
        state.user = null;
        state.isAuthenticated = false;
        state.isInitialized = true;
        state.loading = false;
        state.error = null;
      });

    // Verify Email endpoint matches
    builder
      .addMatcher(authApi.endpoints.verifyEmail.matchFulfilled, (state, action) => {
        if (action.payload.user) {
          state.user = action.payload.user;
          state.isAuthenticated = true;
          state.isInitialized = true;
        }
      });
  },
});

export const {
  clearAuthError,
  clearSuccessMessage,
  setAuthError,
  setSuccessMessage,
  setUser,
  setInitialized,
  logoutLocal,
} = authSlice.actions;

export default authSlice.reducer;
