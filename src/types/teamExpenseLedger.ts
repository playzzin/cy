export type TeamExpenseClaimCategory = string;
export type TeamExpenseClaimStatus = 'draft' | 'charged' | 'settled';
export type TeamExpenseClaimType = 'teamCharge' | 'otherExpense' | 'officeExpense';
export type TeamExpenseCategoryScope = TeamExpenseClaimType | 'both';

export interface TeamExpenseCategory {
  id: string;
  label: string;
  scope: TeamExpenseCategoryScope;
  order: number;
  isActive: boolean;
  isDefault?: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

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
