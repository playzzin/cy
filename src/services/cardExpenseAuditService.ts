import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';
import type {
  CardExpenseAuditDashboard,
  CardExpenseAuditPolicy,
  CardExpenseAuditReviewStatus,
  RunCardExpenseAuditResult,
} from '../types/cardExpenseAudit';

const LONG_CALLABLE_TIMEOUT_MS = 540_000;

export const cardExpenseAuditService = {
  async getDashboard(yearMonth: string): Promise<CardExpenseAuditDashboard> {
    const callable = httpsCallable<{ yearMonth: string }, CardExpenseAuditDashboard>(
      functions,
      'getCardExpenseAuditDashboard',
    );
    const response = await callable({ yearMonth });
    return response.data;
  },

  async runAudit(yearMonth: string, useGemini = true): Promise<RunCardExpenseAuditResult> {
    const callable = httpsCallable<
      { yearMonth: string; useGemini: boolean },
      RunCardExpenseAuditResult
    >(
      functions,
      'runCardExpenseAudit',
      { timeout: LONG_CALLABLE_TIMEOUT_MS },
    );
    const response = await callable({ yearMonth, useGemini });
    return response.data;
  },

  async reviewFinding(input: {
    findingId: string;
    reviewStatus: CardExpenseAuditReviewStatus;
    reviewNote?: string;
  }): Promise<void> {
    const callable = httpsCallable<typeof input, { ok: boolean }>(
      functions,
      'reviewCardExpenseAuditFinding',
    );
    await callable(input);
  },

  async savePolicy(policy: CardExpenseAuditPolicy): Promise<CardExpenseAuditPolicy> {
    const callable = httpsCallable<
      { policy: CardExpenseAuditPolicy },
      { ok: boolean; policy: CardExpenseAuditPolicy }
    >(
      functions,
      'saveCardExpenseAuditPolicy',
    );
    const response = await callable({ policy });
    return response.data.policy;
  },
};
