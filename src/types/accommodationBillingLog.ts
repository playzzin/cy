import type { Timestamp } from 'firebase/firestore';
import type { AccommodationBillingDocument } from './accommodationBilling';

export type AccommodationBillingLogAction = 'created' | 'updated' | 'deleted';

export interface AccommodationBillingLogActor {
  uid: string;
  name: string;
  email?: string | null;
}

export interface AccommodationBillingFieldChange {
  field: string;
  label: string;
  before: unknown;
  after: unknown;
}

export interface AccommodationBillingLineItemChange {
  key: string;
  label: string;
  before?: unknown;
  after?: unknown;
  changes?: AccommodationBillingFieldChange[];
}

export interface AccommodationBillingChangeSet {
  fieldChanges: AccommodationBillingFieldChange[];
  lineItemChanges: {
    added: AccommodationBillingLineItemChange[];
    removed: AccommodationBillingLineItemChange[];
    updated: AccommodationBillingLineItemChange[];
  };
  summaryLines: string[];
  changeCount: number;
}

export interface AccommodationBillingLog {
  id?: string;
  action: AccommodationBillingLogAction;
  actionLabel: string;
  billingId: string;
  yearMonth: string;
  teamId?: string;
  teamName?: string;
  issuedToType?: AccommodationBillingDocument['issuedToType'];
  issuedToWorkerId?: string;
  issuedToWorkerName?: string;
  status?: AccommodationBillingDocument['status'];
  totalAmount: number;
  actor: AccommodationBillingLogActor;
  source: string;
  before?: Partial<AccommodationBillingDocument> | null;
  after?: Partial<AccommodationBillingDocument> | null;
  fieldChanges: AccommodationBillingFieldChange[];
  lineItemChanges: AccommodationBillingChangeSet['lineItemChanges'];
  summaryLines: string[];
  summaryText: string;
  changeCount: number;
  createdAt: Timestamp;
  createdAtIso: string;
}

export interface CreateAccommodationBillingLogInput {
  action: AccommodationBillingLogAction;
  before?: Partial<AccommodationBillingDocument> | null;
  after?: Partial<AccommodationBillingDocument> | null;
  source?: string;
}
