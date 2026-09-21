export type ApplicationStatus = 'pending' | 'approved' | 'rejected';

export interface OrgApplication {
  id: number;
  requesterId: number;
  description: string;
  status: ApplicationStatus;
  reviewerId: number | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApplyOrgPayload {
  description: string;
}

export interface ApplicationDecisionPayload {
  applicationId: number;
  status: 'approved' | 'rejected';
}

export interface MyApplicationResponse {
  success: boolean;
  message: string;
  application: OrgApplication;
}

export interface ApplyOrgResponse {
  success: boolean;
  message: string;
  application: OrgApplication;
}

export interface ApplicationListResponse {
  success: boolean;
  message: string;
  applications: OrgApplication[];
}

export interface ApplicationDecisionResponse {
  success: boolean;
  message: string;
  application: OrgApplication;
  user: {
    id: number;
    role: 'organizer';
  } | null;
}
