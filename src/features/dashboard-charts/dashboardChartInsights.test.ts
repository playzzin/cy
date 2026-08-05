import { createDashboardChartInsights } from './dashboardChartInsights';

describe('dashboardChartInsights', () => {
  it('summarizes total, average and peak values', () => {
    const insights = createDashboardChartInsights([
      { date: '2026-06-27', manDay: 2, reportCount: 1, siteCount: 1 },
      { date: '2026-06-28', manDay: 5.25, reportCount: 2, siteCount: 2 },
      { date: '2026-06-29', manDay: 1, reportCount: 1, siteCount: 1 },
      { date: '2026-06-30', manDay: 8, reportCount: 4, siteCount: 3 },
    ]);

    expect(insights).toMatchObject({
      totalManDay: 16.3,
      totalReports: 8,
      averageDailyManDay: 4.1,
      activeDayCount: 4,
      peakManDayDate: '2026-06-30',
      peakManDay: 8,
      peakReportDate: '2026-06-30',
      peakReportCount: 4,
    });
  });

  it('detects upward and downward trend directions', () => {
    expect(createDashboardChartInsights([
      { date: '2026-06-25', manDay: 1, reportCount: 1, siteCount: 1 },
      { date: '2026-06-26', manDay: 1, reportCount: 1, siteCount: 1 },
      { date: '2026-06-27', manDay: 5, reportCount: 2, siteCount: 1 },
      { date: '2026-06-28', manDay: 7, reportCount: 2, siteCount: 1 },
    ]).direction).toBe('up');

    expect(createDashboardChartInsights([
      { date: '2026-06-25', manDay: 7, reportCount: 2, siteCount: 1 },
      { date: '2026-06-26', manDay: 5, reportCount: 2, siteCount: 1 },
      { date: '2026-06-27', manDay: 1, reportCount: 1, siteCount: 1 },
      { date: '2026-06-28', manDay: 1, reportCount: 1, siteCount: 1 },
    ]).direction).toBe('down');
  });

  it('returns stable empty insights for blank data', () => {
    expect(createDashboardChartInsights([])).toMatchObject({
      totalManDay: 0,
      totalReports: 0,
      averageDailyManDay: 0,
      activeDayCount: 0,
      peakManDayDate: '',
      direction: 'flat',
    });
  });
});
