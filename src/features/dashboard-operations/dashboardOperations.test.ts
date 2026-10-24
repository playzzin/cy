import { buildDashboardDailyTrend, buildDashboardOperationInsights, formatDashboardTrend } from './dashboardOperations';
import type { DailyReportCoverageSummary } from '../daily-report-coverage/dailyReportCoverage';

const reports = [
  { date: '2026-06-24', totalManDay: 2, siteId: 's1' },
  { date: '2026-06-29', totalManDay: 4, siteId: 's1' },
  { date: '2026-06-29', totalManDay: 1, siteId: 's2' },
  { date: '2026-06-30', totalManDay: 6, siteId: 's1' },
  { date: '2026-06-30', totalManDay: 4, siteId: 's3' },
];
const coverage: DailyReportCoverageSummary = {
  date: '2026-06-30', activeSiteCount: 200, expectedSiteCount: 4, reportedSiteCount: 3,
  missingSiteCount: 1, coverageRate: 75, missingSites: [{ siteId: 's4', siteName: 'D현장' }], status: 'overdue',
};

describe('dashboardOperations', () => {
  it('builds a continuous daily range based on Korean business dates', () => {
    const trend = buildDashboardDailyTrend(reports, new Date('2026-06-29T15:00:00Z'), 7);
    expect(trend).toHaveLength(7);
    expect(trend[0]).toMatchObject({ date: '2026-06-24', reportCount: 1, manDay: 2, siteCount: 1 });
    expect(trend[6]).toMatchObject({ date: '2026-06-30', reportCount: 2, manDay: 10, siteCount: 2 });
  });

  it('computes real comparisons and explains deductions using only submission targets', () => {
    const result = buildDashboardOperationInsights({ reports, today: '2026-06-30', coverage });
    expect(result).toMatchObject({ reportCountTrendPercent: 0, manDayTrendPercent: 100, monthlyManDayRunRate: 17, healthScore: 75, healthLabel: 'watch' });
    expect(result.healthDeductions).toEqual([{ label: '마감 후 일보 미작성', points: 25,
      detail: '제출 대상 4개 중 1개 현장의 일보가 없습니다.', route: '/reports/daily?tab=list-v2&date=2026-06-30' }]);
  });

  it.each(['collecting', 'unknown', 'unavailable', 'no-work', 'monitoring'] as const)('withholds scoring while %s', (status) => {
    const result = buildDashboardOperationInsights({ reports: [], today: '2026-06-30', coverage: { ...coverage, status } });
    expect(result).toMatchObject({ healthScore: null, healthLabel: status, healthDeductions: [], manDayTrendPercent: null, reportCountTrendPercent: null });
  });

  it.each([
    { rows: [] },
    { rows: [{ date: '2026-06-29', totalManDay: 5 }] },
    { rows: [{ date: '2026-06-30', totalManDay: 5 }] },
  ])('does not turn missing comparison data into zero or 100 percent: %j', ({ rows }) => {
    const result = buildDashboardOperationInsights({ reports: rows, today: '2026-06-30' });
    expect(result.manDayTrendPercent).toBeNull();
    expect(result.reportCountTrendPercent).toBeNull();
    expect(formatDashboardTrend(result.manDayTrendPercent)).toBe('비교 자료 없음');
  });

  it('distinguishes unchanged effort from a zero denominator', () => {
    const calculate = (previous: number) => buildDashboardOperationInsights({ today: '2026-06-30', reports: [
      { date: '2026-06-29', totalManDay: previous }, { date: '2026-06-30', totalManDay: 5 },
    ] });
    expect(formatDashboardTrend(calculate(5).manDayTrendPercent)).toBe('0.0%');
    expect(calculate(0).manDayTrendPercent).toBeNull();
  });

  it('does not penalize a drop in effort when required reports are complete', () => {
    const result = buildDashboardOperationInsights({ today: '2026-06-30', coverage: { ...coverage, reportedSiteCount: 4, missingSiteCount: 0, coverageRate: 100, status: 'complete' },
      reports: [{ date: '2026-06-29', totalManDay: 100 }, { date: '2026-06-30', totalManDay: 1 }] });
    expect(result).toMatchObject({ manDayTrendPercent: -99, healthScore: 100, healthDeductions: [] });
  });

  it('does not project future-dated records into the current month run rate', () => {
    const result = buildDashboardOperationInsights({ today: '2026-06-15', reports: [{ date: '2026-06-15', totalManDay: 10 }, { date: '2026-06-30', totalManDay: 900 }] });
    expect(result.monthlyManDayRunRate).toBe(20);
  });
});
