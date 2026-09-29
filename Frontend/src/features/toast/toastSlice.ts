import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

/**
 * Transient confirmations ("Venue created", "Row C deleted"). UI-only state:
 * server data never lives here.
 */
export type ToastTone = 'neutral' | 'success' | 'danger';

export interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

export interface ToastState {
  items: Toast[];
}

const initialState: ToastState = { items: [] };

/** Older toasts are dropped beyond this, so a burst never stacks up the screen. */
const MAX_VISIBLE = 3;

let nextId = 1;

export const toastSlice = createSlice({
  name: 'toast',
  initialState,
  reducers: {
    showToast: {
      reducer: (state, action: PayloadAction<Toast>) => {
        state.items.push(action.payload);
        if (state.items.length > MAX_VISIBLE) state.items.shift();
      },
      prepare: (message: string, tone: ToastTone = 'neutral') => ({
        payload: { id: nextId++, message, tone },
      }),
    },
    dismissToast: (state, action: PayloadAction<number>) => {
      state.items = state.items.filter((t) => t.id !== action.payload);
    },
  },
});

export const { showToast, dismissToast } = toastSlice.actions;

export default toastSlice.reducer;
