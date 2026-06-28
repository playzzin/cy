import type { TeamExpenseClaimCategory } from './teamExpenseLedger';

export interface OfficeFixedExpense {
  id: string;
  name: string;
  category: TeamExpenseClaimCategory;
  amount: number;
  dayOfMonth: number;
  startYearMonth: string;
  endYearMonth?: string;
  isActive: boolean;
  memo?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface OfficeFixedExpenseInput {
  name: string;
  category: TeamExpenseClaimCategory;
  amount: number;
  dayOfMonth: number;
  startYearMonth: string;
  endYearMonth?: string;
  isActive?: boolean;
  memo?: string;
}
