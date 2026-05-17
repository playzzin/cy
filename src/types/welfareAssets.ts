import type { Timestamp } from 'firebase/firestore';

export type WelfareAssetKind = 'cash' | 'point';

export type WelfareAccountScope =
  | 'user'
  | 'company'
  | 'system'
  | 'game'
  | 'expense'
  | 'settlement';

export type WelfareTransactionSource =
  | 'manual_adjustment'
  | 'bulk_action'
  | 'payroll_sync'
  | 'game_play'
  | 'store_purchase'
  | 'point_expiry'
  | 'refund';

export type WelfareTransactionStatus = 'posted' | 'voided' | 'pending_review';

export type WelfareAdminGrade = 'viewer' | 'operator' | 'asset_manager' | 'super_admin';

export interface WelfareAdminPermission {
  id: WelfareAdminGrade;
  grade: WelfareAdminGrade;
  label: string;
  roleAliases: string[];
  ledger: boolean;
  adjustCash: boolean;
  adjustPoint: boolean;
  game: boolean;
  bulk: boolean;
  categories: boolean;
  permissions: boolean;
  active: boolean;
  updatedAt?: Timestamp | string;
}

export interface WelfareLedgerPosting {
  id?: string;
  accountId: string;
  accountName: string;
  accountScope: WelfareAccountScope;
  assetKind: WelfareAssetKind;
  userId?: string;
  userName?: string;
  amount: number;
  memo?: string;
}

export interface WelfareLedgerTransaction {
  id: string;
  title: string;
  categoryId: string;
  categoryName: string;
  source: WelfareTransactionSource;
  status: WelfareTransactionStatus;
  businessDate: string;
  transactionAt: Timestamp | string;
  postings: WelfareLedgerPosting[];
  idempotencyKey?: string;
  createdBy: string;
  createdByName?: string;
  createdAt?: Timestamp | string;
  updatedAt?: Timestamp | string;
  metadata?: Record<string, unknown>;
}

export interface WelfareAccountSnapshot {
  id: string;
  accountName: string;
  accountScope: WelfareAccountScope;
  assetKind: WelfareAssetKind;
  userId?: string;
  userName?: string;
  balance: number;
  ledgerCount: number;
  updatedAt?: Timestamp | string;
}

export interface WelfareCategory {
  id: string;
  name: string;
  assetKind: WelfareAssetKind | 'both';
  source: WelfareTransactionSource;
  direction: 'credit' | 'debit' | 'both';
  active: boolean;
  expiresAfterDays?: number;
  approvalRequired?: boolean;
  createdAt?: Timestamp | string;
  updatedAt?: Timestamp | string;
}

export interface WelfareGameConfig {
  id: string;
  name: string;
  type: 'roulette' | 'ocean_reel';
  assetKind: 'point';
  stake: number;
  dailyLimit: number;
  active: boolean;
  expectedReturnRate: number;
}

export interface WelfareGamePlay {
  id: string;
  gameId: string;
  gameName: string;
  userId: string;
  userName: string;
  businessDate: string;
  stake: number;
  reward: number;
  resultLabel: string;
  ledgerTransactionId: string;
  metadata?: Record<string, unknown>;
  createdAt?: Timestamp | string;
}

export interface WelfareBulkActionRow {
  id: string;
  employeeId: string;
  employeeName: string;
  assetKind: WelfareAssetKind;
  amount: number | string;
  categoryId?: string;
  categoryName: string;
  memo?: string;
  validationStatus: 'ready' | 'warning' | 'error';
  validationMessage: string;
}

export interface WelfareAuditLog {
  id: string;
  action: string;
  actorId: string;
  actorName: string;
  targetId?: string;
  targetName?: string;
  createdAt?: Timestamp | string;
  details?: Record<string, unknown>;
}
