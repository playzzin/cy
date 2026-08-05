import {
  buildDashboardDailyTrend,
  buildDashboardOperationInsights,
} from './dashboardOperations';

const reports = [
  { date: '2026-06-24', totalManDay: 2, siteId: 's1' },
  { date: '2026-06-29', totalManDay: 4, siteId: 's1' },
  { date: '2026-06-29', totalManDay: 1, siteId: 's2' },
  { date: '2026-06-30', totalManDay: 6, siteId: 's1' },
  { date: '2026-06-30', totalManDay: 4, siteId: 's3' },
];

describe('dashboardOperations', () => {
  it('builds daily trend points for the requested range', () => {
    const trend = buildDashboardDailyTrend(reports, '2026-06-30', 7);

    expect(trend).toHaveLength(7);
    expect(trend[0]).toMatchObject({
      date: '2026-06-24',
      reportCount: 1,
      manDay: 2,
      siteCount: 1,
    });
    expect(trend[6]).toMatchObject({
      date: '2026-06-30',
      reportCount: 2,
      manDay: 10,
      siteCount: 2,
    });
  });

  it('calculates operation insights from today and yesterday', () => {
    const insights = buildDashboardOperationInsights({
      reports,
      today: '2026-06-30',
      reportCoverageRate: 75,
      activeSiteCount: 4,
      supportBalance: 3,
    });

    expect(insights.reportCountTrendPercent).toBe(0);
    expect(insights.manDayTrendPercent).toBe(100);
    expect(insights.monthlyManDayRunRate).toBe(17);
    expect(insights.healthScore).toBe(86);
    expect(insights.healthLabel).toBe('stable');
  });

  it('penalizes missing active-site activity and low coverage', () => {
    const insights = buildDashboardOperationInsights({
      reports: [],
      today: '2026-06-30',
      reportCoverageRate: 40,
      activeSiteCount: 3,
      supportBalance: 0,
    });

    expect(insights.healthScore).toBeLessThan(60);
    expect(insights.healthLabel).toBe('critical');
  });
});
