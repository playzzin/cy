import { Timestamp } from './timestamp';
import type { CardTransactionCategory } from './card';

export type CardStatementImportJobStatus =
  | 'draft'
  | 'uploading'
  | 'queued'
  | 'analyzing'
  | 'reviewing'
  | 'committing'
  | 'completed'
  | 'failed';

export type CardStatementImportFileStatus =
  | 'uploading'
  | 'uploaded'
  | 'analyzing'
  | 'completed'
  | 'failed';

export type CardStatementImportResultStatus =
  | 'matched'
  | 'needs_review'
  | 'excluded'
  | 'committed'
  | 'failed';

export type CardStatementImportAnalysisSource = 'fast_text' | 'gemini';

export interface CardStatementImportJob {
  id: string;
  yearMonth: string;
  status: CardStatementImportJobStatus;
  bankName: string;
  totalFiles: number;
  uploadedFiles: number;
  analyzedFiles: number;
  totalCards: number;
  matchedCards: number;
  needsReviewCards: number;
  totalTransactions: number;
  committedTransactions: number;
  totalAmount: number;
  matchedAmount: number;
  unconfirmedAmount: number;
  errorCount: number;
  warningCount: number;
  createdByUid?: string;
  createdByName?: string;
  analysisRunId?: string;
  analysisRequestedAt?: Timestamp;
  errorMessage?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  completedAt?: Timestamp;
}

export interface CardStatementImportFile {
  id: string;
  jobId: string;
  yearMonth: string;
  fileIndex: number;
  storagePath: string;
  originalFileName: string;
  mimeType: string;
  size: number;
  sha256?: string;
  status: CardStatementImportFileStatus;
  statementMonth?: string;
  grandTotalAmount?: number;
  cardCount: number;
  transactionCount: number;
  analysisSource?: CardStatementImportAnalysisSource;
  warnings: string[];
  errorMessage?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface CardStatementImportTransaction {
  id: string;
  date: string;
  merchant: string;
  amount: number;
  category: CardTransactionCategory;
  memo?: string;
  confidence: number;
}

export interface CardStatementMatchCandidate {
  cardId: string;
  cardLabel: string;
  cardLast4: string;
  score: number;
  reasons: string[];
}

export interface CardStatementImportResult {
  id: string;
  jobId: string;
  fileId: string;
  fileIndex: number;
  resultIndex: number;
  yearMonth: string;
  statementMonth?: string;
  cardLast4?: string;
  cardName?: string;
  holderName?: string;
  matchedCardId?: string | null;
  matchedCardLabel?: string | null;
  matchConfidence: number;
  matchCandidates: CardStatementMatchCandidate[];
  status: CardStatementImportResultStatus;
  subtotalAmount: number;
  transactionCount: number;
  transactions: CardStatementImportTransaction[];
  warnings: string[];
  analysisSource?: CardStatementImportAnalysisSource;
  analysisReviewRequired?: boolean;
  analysisReviewReason?: string;
  analysisReviewResolvedAt?: Timestamp;
  analysisReviewResolvedByUid?: string;
  analysisReviewResolvedByName?: string;
  errorMessage?: string;
  sourceStoragePath?: string;
  originalFileName?: string;
  committedAt?: Timestamp;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface CreateCardStatementImportFileInput {
  storagePath: string;
  originalFileName: string;
  mimeType: string;
  size: number;
  sha256?: string;
}

export interface CreateCardStatementImportJobInput {
  yearMonth: string;
  bankName?: string;
  files: CreateCardStatementImportFileInput[];
}

export interface CreateCardStatementImportJobResult {
  ok: boolean;
  jobId: string;
  fileIds: string[];
  status: CardStatementImportJobStatus;
}

export interface CreateCardStatementImportUploadSessionFileInput {
  originalFileName: string;
  mimeType: string;
  size: number;
  sha256?: string;
}

export interface CreateCardStatementImportUploadSessionInput {
  yearMonth: string;
  bankName?: string;
  files: CreateCardStatementImportUploadSessionFileInput[];
}

export interface CardStatementImportUploadSessionFile extends CreateCardStatementImportFileInput {
  id: string;
  jobId: string;
  yearMonth: string;
  fileIndex: number;
}

export interface CreateCardStatementImportUploadSessionResult extends CreateCardStatementImportJobResult {
  files: CardStatementImportUploadSessionFile[];
}

export interface CompleteCardStatementImportUploadInput {
  jobId: string;
  files: CreateCardStatementImportFileInput[];
}

export interface CancelCardStatementImportUploadSessionInput {
  jobId: string;
  reason?: string;
}

export interface CardStatementImportJobPayload {
  ok: boolean;
  job: CardStatementImportJob;
  files: CardStatementImportFile[];
  results: CardStatementImportResult[];
  commit?: {
    committedResults: number;
    committedTransactions: number;
    skippedResults: number;
  };
}

export interface CardStatementImportUploadProgress {
  fileName: string;
  fileIndex: number;
  uploadedCount: number;
  totalCount: number;
  status: 'uploading' | 'uploaded' | 'failed';
  storagePath?: string;
  errorMessage?: string;
}

export interface UpdateCardStatementImportResultReviewInput {
  resultId: string;
  matchedCardId?: string | null;
  exclude?: boolean;
  exclusionReason?: string;
}
