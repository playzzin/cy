export type CardExpenseAuditSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type CardExpenseAuditReviewStatus = 'OPEN' | 'NORMAL' | 'NEEDS_EVIDENCE' | 'EXCEPTION' | 'ACKNOWLEDGED';
export type CardExpenseAuditRunStatus = 'RUNNING' | 'COMPLETED' | 'FAILED';

export interface CardExpenseAuditPolicy {
  highAmountThreshold: number;
  receiptRequiredAmount: number;
  splitPaymentTotalThreshold: number;
  unusualAmountRatio: number;
  unusualAmountMinimum: number;
  newMerchantMinimum: number;
  categoryLimits: Record<string, number>;
  geminiEnabled: boolean;
  geminiMinimumScore: number;
  geminiMaximumTransactions: number;
}

export interface CardExpenseAuditRuleHit {
  code: string;
  label: string;
  detail: string;
  score: number;
}

export interface CardExpenseAuditGeminiReview {
  transactionId: string;
  scoreAdjustment: number;
  summary: string;
  reasons: string[];
  confidence: number;
  suggestedAction: 'ACCEPT' | 'REVIEW' | 'REQUEST_EVIDENCE';
}

export interface CardExpenseAuditFinding {
  id: string;
  runId: string;
  transactionId: string;
  cardId: string;
  cardLabel: string;
  assignedTo: string;
  date: string;
  yearMonth: string;
  merchant: string;
  normalizedMerchant: string;
  category: string;
  amount: number;
  deterministicScore: number;
  riskScore: number;
  severity: CardExpenseAuditSeverity;
  ruleHits: CardExpenseAuditRuleHit[];
  baseline: {
    historicalCount: number;
    historicalMedian: number;
    amountRatio: number;
    merchantSeenCount: number;
  };
  hasReceipt: boolean;
  hasStatementEvidence: boolean;
  detectionHash: string;
  gemini?: CardExpenseAuditGeminiReview;
  reviewStatus: CardExpenseAuditReviewStatus;
  reviewNote?: string;
  reviewedAt?: unknown;
  reviewedBy?: {
    uid?: string;
    name?: string;
    email?: string | null;
  };
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CardExpenseAuditSummary {
  totalTransactions: number;
  findingCount: number;
  openAmount: number;
  severityCounts: Record<CardExpenseAuditSeverity, number>;
  missingReceiptCount: number;
  duplicateCount: number;
  assignmentMismatchCount: number;
}

export interface CardExpenseAuditRun {
  id: string;
  yearMonth: string;
  status: CardExpenseAuditRunStatus;
  useGemini: boolean;
  geminiStatus?: 'SKIPPED' | 'COMPLETED' | 'FAILED';
  geminiModel?: string;
  geminiError?: string;
  geminiExecutiveSummary?: string;
  geminiPriorityActions?: string[];
  summary?: CardExpenseAuditSummary;
  errorMessage?: string;
  createdAt?: unknown;
  completedAt?: unknown;
}

export interface CardExpenseAuditDashboard {
  ok: boolean;
  yearMonth: string;
  policy: CardExpenseAuditPolicy;
  latestRun: CardExpenseAuditRun | null;
  findings: CardExpenseAuditFinding[];
}

export interface RunCardExpenseAuditResult {
  ok: boolean;
  runId: string;
  yearMonth: string;
  summary: CardExpenseAuditSummary;
  geminiStatus: 'SKIPPED' | 'COMPLETED' | 'FAILED';
  geminiModel?: string;
  geminiError?: string;
}
