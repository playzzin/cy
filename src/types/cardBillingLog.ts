import type { Timestamp } from 'firebase/firestore';
import type { CardBillingDocument } from './cardBilling';

export type CardBillingLogAction = 'created' | 'updated' | 'deleted';

export interface CardBillingLogActor {
  uid: string;
  name: string;
  email?: string | null;
}

export interface CardBillingFieldChange {
  field: string;
  label: string;
  before: unknown;
  after: unknown;
}

export interface CardBillingLineItemChange {
  key: string;
  label: string;
  before?: unknown;
  after?: unknown;
  changes?: CardBillingFieldChange[];
}

export interface CardBillingChangeSet {
  fieldChanges: CardBillingFieldChange[];
  lineItemChanges: {
    added: CardBillingLineItemChange[];
    removed: CardBillingLineItemChange[];
    updated: CardBillingLineItemChange[];
  };
  summaryLines: string[];
  changeCount: number;
}

export interface CardBillingLog {
  id?: string;
  action: CardBillingLogAction;
  actionLabel: string;
  billingId: string;
  yearMonth: string;
  cardId: string;
  cardLabel: string;
  teamId?: string;
  teamName?: string;
  issuedToType?: CardBillingDocument['issuedToType'];
  issuedToWorkerId?: string;
  issuedToWorkerName?: string;
  status?: CardBillingDocument['status'];
  actor: CardBillingLogActor;
  source: string;
  before?: Partial<CardBillingDocument> | null;
  after?: Partial<CardBillingDocument> | null;
  fieldChanges: CardBillingFieldChange[];
  lineItemChanges: CardBillingChangeSet['lineItemChanges'];
  summaryLines: string[];
  summaryText: string;
  changeCount: number;
  createdAt: Timestamp;
  createdAtIso: string;
}

export interface CreateCardBillingLogInput {
  action: CardBillingLogAction;
  before?: Partial<CardBillingDocument> | null;
  after?: Partial<CardBillingDocument> | null;
  source?: string;
}
