import type { ExpenseTeamOption } from './teamExpenseRequest';
export type WorkerDocumentKind = 'identity' | 'bank';
export interface WorkerRegistrationFields { name: string; address: string; contact: string; bankName: string; accountNumber: string; accountHolder: string }
export interface WorkerRegistrationAttachment { id: string; kind: WorkerDocumentKind; name: string; contentType: string }
export interface TeamWorkerRequest extends WorkerRegistrationFields {
  id: string; ownerUid: string; submitterName: string;
  teamId: string; teamName: string; teamColor: string; teamIcon: string;
  companyId: string; companyName: string;
  status: 'pending' | 'approved' | 'rejected'; createdAt: string; submittedAt: string;
  attachments: WorkerRegistrationAttachment[]; workerId?: string;
  reviewerName?: string; reviewedAt?: string; reviewReason?: string;
}
export interface TeamWorkerRequestData { canReview: boolean; teams: ExpenseTeamOption[]; company: { id: string; name: string }; requests: TeamWorkerRequest[]; nextCursor?: string | null }
export interface WorkerDocumentAnalysis { fields: Partial<WorkerRegistrationFields>; warnings: string[] }
