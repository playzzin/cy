export type SupportWriteOperationDomain =
  | 'vehicle'
  | 'card'
  | 'accommodation'
  | 'teamExpense';

export type SupportWriteOperationStatus = 'success' | 'failed';

export interface SupportWriteOperationActor {
  uid: string;
  name: string;
  email?: string | null;
}

export interface SupportWriteOperationLog {
  id: string;
  domain: SupportWriteOperationDomain;
  yearMonth: string;
  operationId: string;
  status: SupportWriteOperationStatus;
  affectedDocumentIds: string[];
  errorMessage?: string;
  userMessage?: string;
  actor: SupportWriteOperationActor;
  metadata?: Record<string, unknown>;
  createdAt?: unknown;
  createdAtIso?: string;
  updatedAt?: unknown;
  updatedAtIso?: string;
}

export interface CreateSupportWriteOperationLogInput {
  domain: SupportWriteOperationDomain;
  yearMonth: string;
  operationId: string;
  status: SupportWriteOperationStatus;
  affectedDocumentIds?: string[];
  errorMessage?: string;
  userMessage?: string;
  actor?: Partial<SupportWriteOperationActor>;
  metadata?: Record<string, unknown>;
}
