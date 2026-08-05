import type { Timestamp } from 'firebase/firestore';

export type SettlementAlertDomain =
  | 'support'
  | 'vehicle'
  | 'accommodation'
  | 'card'
  | 'expense'
  | 'tax';

export type SettlementAlertType =
  | 'missing_billing'
  | 'unconfirmed_billing'
  | 'receivable_overdue'
  | 'overpaid'
  | 'amount_anomaly'
  | 'data_gap';

export type SettlementAlertDirection = 'receivable' | 'payable' | 'neutral';
export type SettlementAlertSeverity = 'critical' | 'high' | 'medium' | 'low';
export type SettlementAlertStateStatus = 'open' | 'acknowledged' | 'snoozed' | 'resolved';

export interface SettlementAlert {
  id: string;
  yearMonth: string;
  domain: SettlementAlertDomain;
  type: SettlementAlertType;
  direction: SettlementAlertDirection;
  severity: SettlementAlertSeverity;
  title: string;
  description: string;
  amount?: number;
  siteId?: string;
  siteName?: string;
  teamId?: string;
  teamName?: string;
  companyId?: string;
  companyName?: string;
  sourceCollection?: string;
  sourceId?: string;
  actionLabel: string;
  actionUrl: string;
  dedupeKey: string;
}

export interface SettlementAlertState {
  alertId: string;
  yearMonth: string;
  status: SettlementAlertStateStatus;
  memo?: string;
  snoozedUntil?: string;
  updatedBy?: string;
  updatedByName?: string;
  updatedAt?: Timestamp;
  createdAt?: Timestamp;
}

export type SettlementAlertWithState = SettlementAlert & {
  stateStatus: SettlementAlertStateStatus;
  state?: SettlementAlertState;
};

export interface SettlementAlertSummary {
  total: number;
  critical: number;
  high: number;
  receivableAmount: number;
  payableAmount: number;
  unconfirmedCount: number;
  openCount: number;
  resolvedCount: number;
}

export interface SettlementAlertQuery {
  yearMonth: string;
  includeResolved?: boolean;
  forceRefresh?: boolean;
}
