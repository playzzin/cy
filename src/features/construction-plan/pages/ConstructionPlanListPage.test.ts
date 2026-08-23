import type { ConstructionPlan } from '../types';
import {
  filterConstructionPlanList,
  type ConstructionPlanListFilters,
} from '../domain/constructionPlanListFilters';

const plan = (overrides: Partial<ConstructionPlan> & { id: string }): ConstructionPlan => {
  const { id, ...rest } = overrides;
  return ({
  id,
  title: `계획서 ${overrides.id}`,
  documentNo: `CP-${overrides.id}`,
  documentDate: '2026-08-22',
  status: 'draft',
  tradeType: 'system-shoring',
  projectSnapshot: {
    siteName: `현장 ${overrides.id}`,
    constructionPeriod: { startDate: '2026-08-01', endDate: '2026-12-31' },
  },
  sections: [],
  ...rest,
} as unknown as ConstructionPlan);
};

const filters = (overrides: Partial<ConstructionPlanListFilters> = {}): ConstructionPlanListFilters => ({
  query: '', status: 'all', site: 'all', tradeType: 'all', assignee: 'all',
  periodStart: '', periodEnd: '', ...overrides,
});

describe('filterConstructionPlanList', () => {
  const plans = [
    plan({ id: 'A', tradeType: 'system-shoring', createdByName: '김작성' }),
    plan({
      id: 'B', tradeType: 'system-scaffold', status: 'issued', createdByName: '박담당',
      projectSnapshot: {
        siteName: '부산 비계 현장',
        constructionPeriod: { startDate: '2027-01-01', endDate: '2027-03-31' },
      } as ConstructionPlan['projectSnapshot'],
    }),
  ];

  it('combines method, assignee and overlapping construction-period filters', () => {
    expect(filterConstructionPlanList(plans, filters({
      tradeType: 'system-scaffold', assignee: '박담당', periodStart: '2027-02-01', periodEnd: '2027-02-28',
    })).map((item) => item.id)).toEqual(['B']);
  });

  it('excludes a plan whose construction period does not overlap the requested range', () => {
    expect(filterConstructionPlanList(plans, filters({
      periodStart: '2026-01-01', periodEnd: '2026-07-31',
    }))).toEqual([]);
  });
});
