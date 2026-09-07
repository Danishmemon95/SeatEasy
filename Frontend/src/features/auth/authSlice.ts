import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import { authApi } from '../../api/authApi';
import { getErrorMessage } from '../../api/axiosClient';
import type { AuthState, LoginPayload, RegisterPayload, User } from '../../types/auth.types';

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  loading: false,
  error: null,
  successMessage: null,
};

export const loginUser = createAsyncThunk<User, LoginPayload, { rejectValue: string }>(
  'auth/loginUser',
  async (credentials, { rejectWithValue }) => {
    try {
      const response = await authApi.login(credentials);
      if (!response.user) {
        throw new Error(response.message || 'Login succeeded without user profile');
      }
      return response.user;
    } catch (err) {
      return rejectWithValue(getErrorMessage(err));
    }
  }
);

export const registerUser = createAsyncThunk<string, RegisterPayload, { rejectValue: string }>(
  'auth/registerUser',
  async (payload, { rejectWithValue }) => {
    try {
      const response = await authApi.register(payload);
      return response.message || 'Account created successfully. Please check your email to verify.';
    } catch (err) {
      return rejectWithValue(getErrorMessage(err));
    }
  }
);

export const logoutUser = createAsyncThunk<void, void, { rejectValue: string }>(
  'auth/logoutUser',
  async (_, { rejectWithValue }) => {
    try {
      await authApi.logout();
    } catch (err) {
      return rejectWithValue(getErrorMessage(err));
    }
  }
);

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
    setUser: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
      state.isAuthenticated = true;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // Login cases
    builder
      .addCase(loginUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false;
        state.isAuthenticated = true;
        state.user = action.payload;
        state.error = null;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Login failed';
      });

    // Register cases
    builder
      .addCase(registerUser.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.successMessage = null;
      })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.loading = false;
        state.successMessage = action.payload;
        state.error = null;
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Registration failed';
      });

    // Logout cases
    builder
      .addCase(logoutUser.fulfilled, (state) => {
        state.user = null;
        state.isAuthenticated = false;
        state.loading = false;
        state.error = null;
      })
      .addCase(logoutUser.rejected, (state) => {
        state.user = null;
        state.isAuthenticated = false;
        state.loading = false;
      });
  },
});

export const { clearAuthError, clearSuccessMessage, setUser } = authSlice.actions;
export default authSlice.reducer;
