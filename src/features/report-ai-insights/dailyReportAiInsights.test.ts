import { createDailyReportAiInsights } from './dailyReportAiInsights';

describe('dailyReportAiInsights', () => {
  const baseInput = {
    query: {
      startDate: '2026-07-01',
      endDate: '2026-07-31',
      analysisType: 'general',
    },
    summary: {
      totalManDay: 140,
      totalAmount: 28_000_000,
      totalWorkers: 25,
      totalReports: 7,
      dateRange: '2026-07-01 ~ 2026-07-31',
    },
    teamAgg: [
      { teamName: '1팀', totalManDay: 90, totalAmount: 18_000_000, workerCount: 12, days: 7, avgDailyManDay: 12.9 },
      { teamName: '2팀', totalManDay: 50, totalAmount: 10_000_000, workerCount: 13, days: 7, avgDailyManDay: 7.1 },
    ],
    siteAgg: [
      { siteName: 'A현장', totalManDay: 80, totalAmount: 16_000_000, workerCount: 12, teamCount: 2, days: 7 },
      { siteName: 'B현장', totalManDay: 40, totalAmount: 8_000_000, workerCount: 8, teamCount: 1, days: 5 },
      { siteName: 'C현장', totalManDay: 20, totalAmount: 4_000_000, workerCount: 5, teamCount: 1, days: 3 },
    ],
    workerAgg: [
      { name: '김작업', totalManDay: 7, totalAmount: 1_400_000, workDays: 7, avgManDay: 1, sites: ['A현장'], teams: ['1팀'], salaryModel: '일급제' },
    ],
    dailyAgg: [
      { date: '2026-07-01', totalManDay: 20, totalAmount: 4_000_000, workerCount: 10, teamCount: 2, siteCount: 2 },
      { date: '2026-07-02', totalManDay: 20, totalAmount: 4_000_000, workerCount: 10, teamCount: 2, siteCount: 2 },
      { date: '2026-07-03', totalManDay: 20, totalAmount: 4_000_000, workerCount: 10, teamCount: 2, siteCount: 2 },
      { date: '2026-07-04', totalManDay: 20, totalAmount: 4_000_000, workerCount: 10, teamCount: 2, siteCount: 2 },
      { date: '2026-07-05', totalManDay: 20, totalAmount: 4_000_000, workerCount: 10, teamCount: 2, siteCount: 2 },
      { date: '2026-07-06', totalManDay: 20, totalAmount: 4_000_000, workerCount: 10, teamCount: 2, siteCount: 2 },
      { date: '2026-07-07', totalManDay: 20, totalAmount: 4_000_000, workerCount: 10, teamCount: 2, siteCount: 2 },
    ],
    today: '2026-07-07',
  };

  it('creates a month-end forecast from current run rate', () => {
    const insights = createDailyReportAiInsights(baseInput);

    expect(insights.forecast).toMatchObject({
      elapsedDays: 7,
      totalDays: 31,
      observedManDay: 140,
      projectedManDay: 620,
      projectedAmount: 124_000_000,
      confidence: 'medium',
    });
  });

  it('projects month-to-date queries to month end', () => {
    const insights = createDailyReportAiInsights({
      ...baseInput,
      query: {
        ...baseInput.query,
        endDate: '2026-07-07',
      },
    });

    expect(insights.forecast).toMatchObject({
      elapsedDays: 7,
      totalDays: 31,
      targetDate: '2026-07-31',
      projectedManDay: 620,
    });
  });

  it('detects concentrated team and site risk signals', () => {
    const insights = createDailyReportAiInsights(baseInput);

    expect(insights.riskSignals.map((signal) => signal.id)).toEqual(
      expect.arrayContaining(['team-concentration', 'site-concentration'])
    );
    expect(insights.riskSignals.find((signal) => signal.id === 'team-concentration')).toMatchObject({
      severity: 'critical',
      metricValue: '64.3%',
    });
  });

  it('builds contribution items from comparison data', () => {
    const insights = createDailyReportAiInsights({
      ...baseInput,
      comparison: {
        prevPeriod: '2026-06-01 ~ 2026-06-30',
        prevSummary: {
          totalManDay: 100,
          totalAmount: 20_000_000,
          totalWorkers: 20,
          totalReports: 6,
          dateRange: '2026-06-01 ~ 2026-06-30',
        },
        prevTeamAgg: [
          { teamName: '1팀', totalManDay: 40, totalAmount: 8_000_000, workerCount: 10, days: 6, avgDailyManDay: 6.7 },
          { teamName: '2팀', totalManDay: 60, totalAmount: 12_000_000, workerCount: 10, days: 6, avgDailyManDay: 10 },
        ],
        prevSiteAgg: [
          { siteName: 'A현장', totalManDay: 30, totalAmount: 6_000_000, workerCount: 8, teamCount: 1, days: 6 },
          { siteName: 'B현장', totalManDay: 70, totalAmount: 14_000_000, workerCount: 12, teamCount: 1, days: 6 },
        ],
        prevWorkerAgg: [],
      },
    });

    expect(insights.contributions[0]).toMatchObject({
      label: '1팀',
      diff: 50,
      direction: 'up',
    });
    expect(insights.riskSignals.map((signal) => signal.id)).toContain('comparison-shift');
  });
});
