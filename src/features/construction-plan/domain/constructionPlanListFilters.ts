import type { ConstructionPlan, ConstructionPlanTradeType, PlanStatus } from '../types';

export type ConstructionPlanListView = ConstructionPlan & {
  lastEditorName?: string;
};

export type ConstructionPlanListFilters = {
  query: string;
  status: PlanStatus | 'all';
  site: string;
  tradeType: ConstructionPlanTradeType | 'all';
  assignee: string;
  periodStart: string;
  periodEnd: string;
};

export const constructionPlanListAssignee = (plan: ConstructionPlanListView): string =>
  plan.lastEditorName || plan.createdByName || plan.updatedBy || '';

const planSearchText = (plan: ConstructionPlanListView): string => [
  plan.title,
  plan.documentNo,
  plan.projectSnapshot.siteName,
  plan.projectSnapshot.contractorName,
  plan.tradeType,
].filter(Boolean).join(' ').toLocaleLowerCase('ko-KR');

const planPeriod = (plan: ConstructionPlanListView): { start: string; end: string } => {
  const start = plan.projectSnapshot.constructionPeriod?.startDate || plan.documentDate;
  const end = plan.projectSnapshot.constructionPeriod?.endDate || start;
  return { start, end };
};

export const filterConstructionPlanList = (
  plans: readonly ConstructionPlanListView[],
  filters: ConstructionPlanListFilters,
): ConstructionPlanListView[] => {
  const normalizedQuery = filters.query.trim().toLocaleLowerCase('ko-KR');
  return plans.filter((plan) => {
    if (filters.status !== 'all' && plan.status !== filters.status) return false;
    if (filters.site !== 'all' && plan.projectSnapshot.siteName !== filters.site) return false;
    if (filters.tradeType !== 'all' && plan.tradeType !== filters.tradeType) return false;
    if (filters.assignee !== 'all' && constructionPlanListAssignee(plan) !== filters.assignee) return false;
    const period = planPeriod(plan);
    if (filters.periodStart && period.end < filters.periodStart) return false;
    if (filters.periodEnd && period.start > filters.periodEnd) return false;
    if (normalizedQuery && !planSearchText(plan).includes(normalizedQuery)) return false;
    return true;
  });
};
