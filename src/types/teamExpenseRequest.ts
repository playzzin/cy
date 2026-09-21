import type { TeamExpenseClaimAttachment } from './teamExpenseLedger';

export interface ExpenseTeamOption { id: string; name: string; color: string; icon?: string }

export interface ExpenseReceiptAnalysis {
  date: string | null;
  amount: number | null;
  paymentMethod: string | null;
  category: string | null;
  warnings: string[];
  isReceipt: boolean;
}

export interface ExpenseReceiptFields { date: string; amount: string; paymentMethod: string; category: string }

export interface TeamExpenseRequest {
  id: string;
  ownerUid: string;
  submitterName: string;
  teamId: string;
  teamName: string;
  teamColor?: string;
  teamIcon?: string;
  chargeToTeamId?: string;
  chargeToTeamName?: string;
  chargeToTeamColor?: string;
  chargeToTeamIcon?: string;
  date: string;
  yearMonth: string;
  category: string;
  categoryLabel: string;
  description: string;
  amount: number;
  paymentMethod: string;
  memo: string;
  attachments: TeamExpenseClaimAttachment[];
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  reviewedAt?: string;
  reviewerName?: string;
  reviewReason?: string;
  claimId?: string;
}

export interface TeamExpenseRequestData {
  nextCursor?: string | null;
  canReview: boolean;
  teams: ExpenseTeamOption[];
  payerTeams: ExpenseTeamOption[];
  categories: Array<{ id: string; label: string }>;
  requests: TeamExpenseRequest[];
}

export interface SubmitTeamExpenseRequest {
  requestId: string;
  teamId: string;
  chargeToTeamId: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  paymentMethod: string;
  memo: string;
  receiptIds: string[];
}
