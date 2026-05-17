import type { Timestamp } from 'firebase/firestore';

export type LoginLogAction = 'login_success' | 'login_failed' | 'logout' | 'signup_success';
export type LoginLogStatus = 'success' | 'failed' | 'info';

export interface LoginLogActor {
  uid: string | null;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
}

export interface LoginLogClient {
  userAgent: string;
  browser: string;
  os: string;
  platform: string;
  language: string;
  timezone: string;
  path: string;
  referrer: string;
  screen: string;
  viewport: string;
}

export interface LoginLog {
  id?: string;
  action: LoginLogAction;
  actionLabel: string;
  status: LoginLogStatus;
  provider: string;
  method: string;
  actor: LoginLogActor;
  email: string | null;
  summaryLines: string[];
  summaryText: string;
  errorCode?: string | null;
  errorMessage?: string | null;
  client: LoginLogClient;
  createdAt: Timestamp;
  createdAtIso: string;
}

export interface CreateLoginLogInput {
  action: LoginLogAction;
  status?: LoginLogStatus;
  provider?: string;
  method?: string;
  user?: {
    uid?: string | null;
    email?: string | null;
    displayName?: string | null;
    photoURL?: string | null;
  } | null;
  email?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
}
