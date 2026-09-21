import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type {
  ApplicationDecisionPayload,
  ApplicationDecisionResponse,
  ApplicationListResponse,
  ApplyOrgPayload,
  ApplyOrgResponse,
  MyApplicationResponse,
} from '../types/application.types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const applicationApi = createApi({
  reducerPath: 'applicationApi',
  baseQuery: fetchBaseQuery({
    baseUrl: API_BASE_URL,
    credentials: 'include',
    prepareHeaders: (headers) => {
      headers.set('Content-Type', 'application/json');
      return headers;
    },
  }),
  tagTypes: ['Application', 'ApplicationList', 'User'],
  endpoints: (builder) => ({
    // GET /api/application/ (Fetch current logged-in user's application)
    getMyApplication: builder.query<MyApplicationResponse, void>({
      query: () => '/application/',
      providesTags: ['Application'],
    }),

    // POST /api/application/ (Submit new organization application)
    applyForOrganization: builder.mutation<ApplyOrgResponse, ApplyOrgPayload>({
      query: (payload) => ({
        url: '/application/',
        method: 'POST',
        body: payload,
      }),
      invalidatesTags: (result) => (result ? ['Application', 'ApplicationList'] : []),
    }),

    // GET /api/application/all (Admin fetch all applications)
    getApplicationList: builder.query<ApplicationListResponse, void>({
      query: () => '/application/all',
      providesTags: ['ApplicationList'],
    }),

    // POST /api/application/decision (Admin approve/reject application)
    applicationDecision: builder.mutation<ApplicationDecisionResponse, ApplicationDecisionPayload>({
      query: (payload) => ({
        url: '/application/decision',
        method: 'POST',
        body: payload,
      }),
      invalidatesTags: (result) => (result ? ['Application', 'ApplicationList', 'User'] : []),
    }),
  }),
});

export const {
  useGetMyApplicationQuery,
  useApplyForOrganizationMutation,
  useGetApplicationListQuery,
  useApplicationDecisionMutation,
} = applicationApi;
