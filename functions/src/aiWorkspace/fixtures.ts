import { AiPlan } from './contract';
import { Catalog, SourceRow } from './domain';
// Synthetic data only; no production records or identifiers.
export const fixturePlan = (): AiPlan => ({
  dataset: 'dailyReports',
  operation: 'aggregate', entity: 'worker', range: { startDate: '2026-08-01', endDate: '2026-08-31' },
  comparison: { startDate: '2026-07-01', endDate: '2026-07-31' }, groupBy: 'site', filters: [], missingAccount: false,
  status: '', sortBy: 'manDay', direction: 'desc', report: { format: 'none', title: '시험 보고서', includeDetails: true, includeAmount: true, splitByGroup: false }, clarification: '',
});
export const fixtureCatalog = (): Catalog => ({
  worker: [{ id: 'w1', name: '동명', teamId: 't1', accountNumber: '' }, { id: 'w2', name: '동명', teamId: 't2', accountNumber: 'synthetic-account' }],
  team: [{ id: 't1', legacyId: 'old-t1', name: '1팀' }, { id: 't2', name: '2팀' }],
  site: [{ id: 's1', name: 'A현장' }, { id: 's2', name: 'B현장' }], company: [],
});
export const fixtureReports = (): SourceRow[] => [
  { id: 'r1', date: '2026-08-10', siteId: 's1', siteName: 'A현장', teamId: 't2', teamName: '2팀', responsibleTeamId: 't1', responsibleTeamName: '당시 1팀', workers: [
    { workerId: 'w1', name: '동명', teamId: 't1', manDay: 1, unitPrice: 200000 },
    { workerId: 'w2', name: '동명', teamId: 't2', manDay: 0.5, unitPrice: 240000 },
  ] },
  { id: 'r2', date: '2026-07-10', siteId: 's2', siteName: 'B현장', teamId: 't2', teamName: '2팀', workers: [
    { workerId: 'w2', name: '동명', teamId: 't2', manDay: 1, unitPrice: 240000 },
  ] },
];
