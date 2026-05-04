export type TeamExpenseClaimCategory = 'meal' | 'parking' | 'fuel' | 'toll' | 'material' | 'tool' | 'etc';
export type TeamExpenseClaimStatus = 'draft' | 'charged' | 'settled';
export type TeamExpenseClaimType = 'teamCharge' | 'otherExpense';

export interface TeamExpenseClaim {
  id: string;
  yearMonth: string;
  date: string;
  claimType: TeamExpenseClaimType;
  payerTeamId: string;
  payerTeamName: string;
  chargeToTeamId?: string;
  chargeToTeamName?: string;
  siteId?: string;
  siteName?: string;
  cardLabel?: string;
  category: TeamExpenseClaimCategory;
  description: string;
  amount: number;
  status: TeamExpenseClaimStatus;
  memo?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface TeamExpenseClaimInput {
  yearMonth: string;
  date: string;
  claimType?: TeamExpenseClaimType;
  payerTeamId: string;
  payerTeamName: string;
  chargeToTeamId?: string;
  chargeToTeamName?: string;
  siteId?: string;
  siteName?: string;
  cardLabel?: string;
  category: TeamExpenseClaimCategory;
  description: string;
  amount: number;
  status?: TeamExpenseClaimStatus;
  memo?: string;
}
