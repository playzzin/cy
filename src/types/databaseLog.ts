import type { Timestamp } from 'firebase/firestore';

export type DatabaseLogAction = 'created' | 'updated' | 'deleted';
export type DatabaseLogEntityType = 'worker' | 'team' | 'site' | 'company' | 'account';

export interface DatabaseLogActor {
  uid: string;
  name: string;
  email: string | null;
}

export interface DatabaseFieldChange {
  field: string;
  label: string;
  before: unknown;
  after: unknown;
}

export interface DatabaseLog {
  id?: string;
  action: DatabaseLogAction;
  actionLabel: string;
  entityType: DatabaseLogEntityType;
  entityLabel: string;
  entityId: string;
  entityName: string;
  entitySubtitle?: string;
  teamId?: string;
  teamName?: string;
  siteId?: string;
  siteName?: string;
  companyId?: string;
  companyName?: string;
  status?: string;
  actor: DatabaseLogActor;
  source: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  fieldChanges: DatabaseFieldChange[];
  summaryLines: string[];
  summaryText: string;
  changeCount: number;
  createdAt: Timestamp;
  createdAtIso: string;
}

export interface CreateDatabaseLogInput {
  action: DatabaseLogAction;
  entityType: DatabaseLogEntityType;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  source?: string;
}
