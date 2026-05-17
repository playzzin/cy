import type { Timestamp } from 'firebase/firestore';
import type { VehicleBillingDocument } from './vehicleBilling';

export type VehicleBillingLogAction = 'created' | 'updated' | 'deleted';

export interface VehicleBillingLogActor {
  uid: string;
  name: string;
  email?: string | null;
}

export interface VehicleBillingFieldChange {
  field: string;
  label: string;
  before: unknown;
  after: unknown;
}

export interface VehicleBillingLineItemChange {
  key: string;
  label: string;
  before?: unknown;
  after?: unknown;
  changes?: VehicleBillingFieldChange[];
}

export interface VehicleBillingChangeSet {
  fieldChanges: VehicleBillingFieldChange[];
  lineItemChanges: {
    added: VehicleBillingLineItemChange[];
    removed: VehicleBillingLineItemChange[];
    updated: VehicleBillingLineItemChange[];
  };
  summaryLines: string[];
  changeCount: number;
}

export interface VehicleBillingLog {
  id?: string;
  action: VehicleBillingLogAction;
  actionLabel: string;
  billingId: string;
  yearMonth: string;
  vehicleId: string;
  vehiclePlate: string;
  teamId?: string;
  teamName?: string;
  issuedToType?: VehicleBillingDocument['issuedToType'];
  issuedToWorkerId?: string;
  issuedToWorkerName?: string;
  status?: VehicleBillingDocument['status'];
  actor: VehicleBillingLogActor;
  source: string;
  before?: Partial<VehicleBillingDocument> | null;
  after?: Partial<VehicleBillingDocument> | null;
  fieldChanges: VehicleBillingFieldChange[];
  lineItemChanges: VehicleBillingChangeSet['lineItemChanges'];
  summaryLines: string[];
  summaryText: string;
  changeCount: number;
  createdAt: Timestamp;
  createdAtIso: string;
}

export interface CreateVehicleBillingLogInput {
  action: VehicleBillingLogAction;
  before?: Partial<VehicleBillingDocument> | null;
  after?: Partial<VehicleBillingDocument> | null;
  source?: string;
}
