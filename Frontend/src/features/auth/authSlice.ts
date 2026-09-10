import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

/**
 * Local UI state for the auth screens.
 *
 * Session state (who is signed in, whether the check has settled) is NOT here —
 * it lives in the checkAuth query cache and is read through useAuth(). This
 * slice holds only what the server cache cannot: messages the UI wants to carry
 * across a tab switch or a route change.
 */
export interface AuthUiState {
  /** Banner shown after an action completes, e.g. "check your email". */
  successMessage: string | null;
}

const initialState: AuthUiState = {
  successMessage: null,
};

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setSuccessMessage: (state, action: PayloadAction<string>) => {
      state.successMessage = action.payload;
    },
    clearSuccessMessage: (state) => {
      state.successMessage = null;
    },
  },
});

export const { setSuccessMessage, clearSuccessMessage } = authSlice.actions;

export default authSlice.reducer;
