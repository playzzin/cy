import { AiPlan, AiSavedAnalysis } from './contract';
import { fixturePlan } from './fixtures';
export const savedCommandPlan = (operation: 'savedFind' | 'savedRun' = 'savedFind', query = '', usePrevious = false): AiPlan => ({
  ...fixturePlan(), operation, saved: { query, usePrevious }, comparison: null, sortBy: 'name', direction: 'asc',
  report: { format: 'none', title: '저장한 분석', includeAmount: true, includeDetails: false, splitByGroup: false },
});
export const savedCommandItems = (): AiSavedAnalysis[] => [
  { id: 'saved-monthly', revision: 1, name: '월간 현장 보고', period: 'fixed', plan: fixturePlan(), createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-01T00:00:00Z' },
  { id: 'saved-evidence', revision: 1, name: '월간 인력 보고', period: 'lastMonth', plan: fixturePlan(), createdAt: '2026-09-02T00:00:00Z', updatedAt: '2026-09-02T00:00:00Z' },
];
