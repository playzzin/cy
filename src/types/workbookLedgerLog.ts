import type { Timestamp } from 'firebase/firestore';
import type { WorkbookLedgerEntry } from '../services/workbookLedgerService';

export type WorkbookLedgerLogAction = 'created' | 'updated' | 'deleted';

export interface WorkbookLedgerLogActor {
  uid: string;
  name: string;
  email?: string | null;
}

export interface WorkbookLedgerFieldChange {
  field: string;
  label: string;
  before: unknown;
  after: unknown;
}

export interface WorkbookLedgerLog {
  id?: string;
  action: WorkbookLedgerLogAction;
  actionLabel: string;
  tenantKey: string;
  tenantLabel: string;
  entryId: string;
  transactionType: string;
  date: string;
  partnerName: string;
  siteName?: string;
  description?: string;
  teamName?: string;
  sourceType?: string;
  totalAmount: number;
  paymentAmount: number;
  supplyAmount: number;
  taxAmount: number;
  note?: string;
  actor: WorkbookLedgerLogActor;
  source: string;
  before?: Partial<WorkbookLedgerEntry> | null;
  after?: Partial<WorkbookLedgerEntry> | null;
  fieldChanges: WorkbookLedgerFieldChange[];
  summaryLines: string[];
  summaryText: string;
  changeCount: number;
  createdAt: Timestamp;
  createdAtIso: string;
}

export interface CreateWorkbookLedgerLogInput {
  action: WorkbookLedgerLogAction;
  tenantKey: string;
  before?: Partial<WorkbookLedgerEntry> | null;
  after?: Partial<WorkbookLedgerEntry> | null;
  source?: string;
}
