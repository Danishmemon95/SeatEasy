import { axiosClient } from './axiosClient';
import type { AuthResponse, LoginPayload, RegisterPayload } from '../types/auth.types';

export const authApi = {
  login: async (data: LoginPayload): Promise<AuthResponse> => {
    const response = await axiosClient.post<AuthResponse>('/auth/login', data);
    return response.data;
  },

  register: async (data: RegisterPayload): Promise<AuthResponse> => {
    const response = await axiosClient.post<AuthResponse>('/auth/register', data);
    return response.data;
  },

  logout: async (): Promise<{ message: string }> => {
    const response = await axiosClient.post<{ message: string }>('/auth/logout');
    return response.data;
  },
};
