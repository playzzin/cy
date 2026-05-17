import type { Timestamp } from 'firebase/firestore';

export type MaterialLogAction = 'created' | 'updated' | 'deleted';
export type MaterialLogEntityType = 'material' | 'inbound' | 'outbound';

export interface MaterialLogActor {
  uid: string;
  name: string;
  email: string | null;
}

export interface MaterialFieldChange {
  field: string;
  label: string;
  before: unknown;
  after: unknown;
}

export interface MaterialLog {
  id?: string;
  action: MaterialLogAction;
  actionLabel: string;
  entityType: MaterialLogEntityType;
  entityLabel: string;
  entityId: string;
  materialId?: string;
  materialKey?: string;
  materialName: string;
  category?: string;
  spec?: string;
  unit?: string;
  siteId?: string;
  siteName?: string;
  transactionDate?: string;
  quantity?: number;
  actor: MaterialLogActor;
  source: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  fieldChanges: MaterialFieldChange[];
  summaryLines: string[];
  summaryText: string;
  changeCount: number;
  createdAt: Timestamp;
  createdAtIso: string;
}

export interface CreateMaterialLogInput {
  action: MaterialLogAction;
  entityType: MaterialLogEntityType;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  source?: string;
}
