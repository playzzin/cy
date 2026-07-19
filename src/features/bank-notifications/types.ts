import type { Timestamp } from 'firebase/firestore';

export const BANK_TRANSACTION_STATUSES = [
  'pending',
  'confirmed',
  'ignored',
  'parse_failed',
] as const;

export type BankTransactionStatus = (typeof BANK_TRANSACTION_STATUSES)[number];

export const BANK_TRANSACTION_DIRECTIONS = ['deposit', 'withdrawal', 'unknown'] as const;

export type BankTransactionDirection = (typeof BANK_TRANSACTION_DIRECTIONS)[number];

export type BankDateValue =
  | Date
  | Timestamp
  | { seconds: number; nanoseconds?: number; toDate?: () => Date }
  | string
  | number
  | null
  | undefined;

export interface BankTransactionCandidate {
  id: string;
  status: BankTransactionStatus;
  direction: BankTransactionDirection;
  amount: number;
  balance: number | null;
  bankName: string;
  accountMasked: string;
  sourceMasked: string;
  counterpartyMasked: string;
  memo: string;
  messagePreview: string;
  transactionAt: BankDateValue;
  receivedAt: BankDateValue;
  createdAt: BankDateValue;
  updatedAt: BankDateValue;
  parseError: string;
  parserVersion: string;
  confidence: number | null;
  reviewedById: string;
  reviewedByName: string;
  reviewedAt: BankDateValue;
}

export interface BankNotificationQuietHours {
  enabled: boolean;
  start: string;
  end: string;
  timezone: 'Asia/Seoul';
}

export interface BankNotificationSettings {
  enabled: boolean;
  recipientIds: string[];
  minimumAmount: number;
  directions: Array<Exclude<BankTransactionDirection, 'unknown'>>;
  notifyOnParseFailure: boolean;
  quietHours: BankNotificationQuietHours;
  updatedAt?: BankDateValue;
  updatedById?: string;
  updatedByName?: string;
}

export type BankNotificationPermission = NotificationPermission | 'unsupported';

export interface BankNotificationDevice {
  id: string;
  uid: string;
  token?: string;
  platform: 'web';
  label: string;
  browser: string;
  userAgent: string;
  permission: BankNotificationPermission;
  enabled: boolean;
  createdAt?: BankDateValue;
  updatedAt?: BankDateValue;
  lastSeenAt?: BankDateValue;
}

export type BankNotificationHealthState = 'healthy' | 'stale' | 'unconfigured' | 'error';

export interface BankNotificationHealth {
  state: BankNotificationHealthState;
  lastEventAt: BankDateValue;
  lastDeviceIdMasked: string;
  lastErrorCode: string;
  updatedAt: BankDateValue;
}

export interface BankCandidateFilters {
  status: BankTransactionStatus | 'all';
  direction: BankTransactionDirection | 'all';
  query: string;
  startDate: string;
  endDate: string;
  minimumAmount: number | null;
}

export interface BankNotificationSummary {
  pendingCount: number;
  parseFailedCount: number;
  todayDepositTotal: number;
  todayWithdrawalTotal: number;
}

export interface BankNotificationPermissions {
  canView: boolean;
  canReview: boolean;
  canConfigure: boolean;
  canManageOwnDevice: boolean;
}

export interface BankNotificationActor {
  uid: string;
  displayName: string;
  email?: string | null;
}

export interface BankNotificationRecipient {
  uid: string;
  displayName: string;
  email: string;
  role: string;
}

export const DEFAULT_BANK_NOTIFICATION_SETTINGS: BankNotificationSettings = {
  enabled: true,
  recipientIds: [],
  minimumAmount: 0,
  directions: ['deposit', 'withdrawal'],
  notifyOnParseFailure: true,
  quietHours: {
    enabled: false,
    start: '22:00',
    end: '07:00',
    timezone: 'Asia/Seoul',
  },
};

export const DEFAULT_BANK_CANDIDATE_FILTERS: BankCandidateFilters = {
  status: 'all',
  direction: 'all',
  query: '',
  startDate: '',
  endDate: '',
  minimumAmount: null,
};
