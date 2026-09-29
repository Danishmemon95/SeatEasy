import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import authReducer from '../features/auth/authSlice';
import { authApi } from '../api/authApi';
import { applicationApi } from '../api/applicationApi';
import { catalogApi } from '../api/catalogApi';
import toastReducer from '../features/toast/toastSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    toast: toastReducer,
    [authApi.reducerPath]: authApi.reducer,
    [applicationApi.reducerPath]: applicationApi.reducer,
    [catalogApi.reducerPath]: catalogApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(authApi.middleware, applicationApi.middleware, catalogApi.middleware),
  devTools: import.meta.env.DEV,
});

setupListeners(store.dispatch);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
