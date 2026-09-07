import axios, { AxiosError } from 'axios';

export const axiosClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Helper to extract clean error message from Axios errors
export const getErrorMessage = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const serverMessage = (error as AxiosError<{ message?: string }>).response?.data?.message;
    if (serverMessage) return serverMessage;
    if (error.message) return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unexpected error occurred. Please try again.';
};
