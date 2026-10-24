import { calculateTeamAverageExpense } from './teamExpenseAverage';
import type { DailyReport } from '../../services/dailyReportService';

const team = { id: 'a', legacyId: 'old-a', name: 'A팀' };
const report = (overrides: Partial<DailyReport> = {}): DailyReport => ({
  id: 'report', date: '2026-09-01', teamId: 'a', responsibleTeamId: 'a', siteId: 'site',
  totalManDay: 999, totalAmount: 0,
  workers: [{ workerId: 'w', name: '작업자', status: 'attendance', teamId: 'a', manDay: 1, unitPrice: 0 }],
  ...overrides
});

it('counts a repeated report only once without collapsing separate half-day sites', () => {
  const morning = report({ workers: [{ ...report().workers[0], manDay: 0.5 }] });
  const afternoon = report({ id: 'afternoon', siteId: 'other-site', responsibleTeamId: 'b', workers: morning.workers });
  expect(calculateTeamAverageExpense(10000, team, [morning, morning, afternoon], '2026-09')).toEqual({
    responsibleSiteManDay: 0.5, supportManDay: 0.5, totalManDay: 1, averageExpense: 10000
  });
});

it('uses historical IDs and aliases before names, with legacy report affiliation only when worker affiliation is missing', () => {
  const workers = [
    { ...report().workers[0], workerId: 'alias', teamId: 'old-a', manDay: 0.5 },
    { ...report().workers[0], workerId: 'name', teamId: undefined, workerTeamName: 'A팀', manDay: 0.5 },
    { ...report().workers[0], workerId: 'legacy', teamId: undefined, manDay: 1 },
    { ...report().workers[0], workerId: 'other', teamId: 'b', workerTeamName: 'A팀', manDay: 99 },
    { ...report().workers[0], workerId: 'other-name', teamId: undefined, workerTeamName: 'B팀', manDay: 99 }
  ];
  expect(calculateTeamAverageExpense(40000, team, [report({ workers })], '2026-09').averageExpense).toBe(20000);
});

it('returns no average with no labor and ignores outside-month or invalid labor, not replacing it with site totals', () => {
  const invalid = [0, -1, NaN, Infinity].map((manDay, i) => ({ ...report().workers[0], workerId: String(i), manDay }));
  expect(calculateTeamAverageExpense(90000, team, [report({ workers: invalid }), report({ date: '2026-08-31' })], '2026-09')).toEqual({
    responsibleSiteManDay: 0, supportManDay: 0, totalManDay: 0, averageExpense: null
  });
  expect(calculateTeamAverageExpense(0, team, [report()], '2026-09').averageExpense).toBe(0);
});
