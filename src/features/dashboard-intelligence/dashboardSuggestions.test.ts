import type { DashboardExecutiveStats } from '../../services/dashboardExecutiveService';
import { createDashboardFeatureSuggestions } from './dashboardSuggestions';

const createStats = (overrides: Partial<DashboardExecutiveStats> = {}): DashboardExecutiveStats => ({
  workers: { total: 10, active: 8 },
  sites: { total: 5, active: 4 },
  teams: { total: 3 },
  reports: {
    today: 4,
    thisMonth: 20,
    todayManDay: 12,
    thisMonthManDay: 0,
  },
  support: { inbound: 0, outbound: 0, total: 0 },
  operations: {
    reportCoverageRate: 100,
    averageManDayPerReport: 1.5,
    supportBalance: 0,
    reportCountTrendPercent: 0,
    manDayTrendPercent: 0,
    monthlyManDayRunRate: 0,
    healthScore: 100,
    healthLabel: 'stable',
  },
  dailyReportCoverage: {
    date: '2026-06-30',
    activeSiteCount: 4,
    reportedSiteCount: 4,
    missingSiteCount: 0,
    coverageRate: 100,
    missingSites: [],
  },
  dailyTrend: [],
  recentReports: [],
  recentTasks: [],
  ...overrides,
});

describe('dashboardSuggestions', () => {
  it('prioritizes missing daily report coverage', () => {
    const suggestions = createDashboardFeatureSuggestions(createStats({
      operations: {
        reportCoverageRate: 50,
        averageManDayPerReport: 1.5,
        supportBalance: 0,
        reportCountTrendPercent: 0,
        manDayTrendPercent: 0,
        monthlyManDayRunRate: 0,
        healthScore: 50,
        healthLabel: 'critical',
      },
      dailyReportCoverage: {
        date: '2026-06-30',
        activeSiteCount: 4,
        reportedSiteCount: 2,
        missingSiteCount: 2,
        coverageRate: 50,
        missingSites: [
          { siteId: 's1', siteName: 'A 현장', responsibleTeamName: '1팀' },
          { siteId: 's2', siteName: 'B 현장', responsibleTeamName: '2팀' },
        ],
      },
    }));

    expect(suggestions[0]).toMatchObject({
      id: 'daily-report-reminder',
      priorityLabel: '높음',
      tone: 'red',
    });
    expect(suggestions[0].reason).toContain('A 현장');
    expect(suggestions[0].route).toBe('/reports/daily?tab=list-v2&date=2026-06-30');
  });

  it('uses task SLA risk as a high-priority suggestion', () => {
    const suggestions = createDashboardFeatureSuggestions(createStats({
      recentTasks: [
        {
          id: 'task-1',
          title: 'Overdue task',
          assignee: 'Kim',
          status: '요청',
          dueDate: '2000-01-01',
          createdAt: '2026-06-01',
          comments: [],
        } as any,
      ],
    }));

    expect(suggestions[0]).toMatchObject({
      id: 'task-sla-board',
      priorityLabel: '높음',
      tone: 'red',
    });
  });

  it('suggests a health review when the operation score drops', () => {
    const suggestions = createDashboardFeatureSuggestions(createStats({
      operations: {
        reportCoverageRate: 90,
        averageManDayPerReport: 1.5,
        supportBalance: 0,
        reportCountTrendPercent: -20,
        manDayTrendPercent: -30,
        monthlyManDayRunRate: 10,
        healthScore: 55,
        healthLabel: 'critical',
      },
    }));

    expect(suggestions[0]).toMatchObject({
      id: 'operations-health-review',
      priorityLabel: '높음',
      tone: 'red',
    });
  });

  it('falls back to data quality audit when operations are stable', () => {
    const suggestions = createDashboardFeatureSuggestions(createStats());

    expect(suggestions.map((suggestion) => suggestion.id)).toContain('data-quality-audit');
  });

  it('does not mistake an empty dashboard for a healthy operation', () => {
    const stats = createStats();
    stats.workers = { total: 0, active: 0 };
    stats.sites = { total: 0, active: 0 };
    stats.teams = { total: 0 };
    stats.reports = { today: 0, thisMonth: 0, todayManDay: 0, thisMonthManDay: 0 };
    stats.dailyReportCoverage = { ...stats.dailyReportCoverage, activeSiteCount: 0, reportedSiteCount: 0, coverageRate: 0 };
    stats.operations.healthScore = 0;
    expect(createDashboardFeatureSuggestions(stats)).toEqual([]);
  });

  it('does not suggest missing reports for inactive sites', () => {
    const stats = createStats();
    stats.dailyReportCoverage = { ...stats.dailyReportCoverage, activeSiteCount: 0, reportedSiteCount: 0, coverageRate: 0 };
    stats.operations.healthScore = 0;
    expect(createDashboardFeatureSuggestions(stats).map((item) => item.id)).toEqual(['data-quality-audit']);
  });

  it('includes a genuine zero health score and avoids returning to the dashboard', () => {
    const stats = createStats();
    stats.operations.healthScore = 0;
    const suggestion = createDashboardFeatureSuggestions(stats)[0];
    expect(suggestion.id).toBe('operations-health-review');
    expect(suggestion.priorityLabel).toBe('높음');
    expect(suggestion.route).toBe('/reports/daily?tab=list-v2&date=2026-06-30');
  });

  it('keeps independent risks ahead of the health signal that repeats missing reports', () => {
    const stats = createStats();
    stats.dailyReportCoverage = { ...stats.dailyReportCoverage, missingSiteCount: 4, reportedSiteCount: 0, coverageRate: 0 };
    stats.operations.healthScore = 10;
    stats.operations.supportBalance = -25;
    stats.reports.thisMonthManDay = 150;
    stats.recentTasks = [{ id: 'late', title: '점검', assignee: '담당자', status: '요청', priority: '보통', dueDate: '2000-01-01', createdAt: '2000-01-01', comments: [] }];
    const suggestions = createDashboardFeatureSuggestions(stats);
    expect(suggestions.length).toBe(5);
    expect(suggestions.slice(0, 3).map((item) => item.id)).toEqual(['daily-report-reminder', 'support-balance-alert', 'task-sla-board']);
    expect(suggestions.every((item) => item.score >= 0 && item.score <= 100)).toBe(true);
  });

  it('includes missing due dates and upcoming tasks but excludes completed tasks', () => {
    const stats = createStats();
    const task = { id: '1', title: '확인', assignee: '담당자', status: '요청' as const, priority: '보통' as const, dueDate: '', createdAt: '2026-06-01', comments: [] };
    stats.recentTasks = [task, { ...task, id: '2', dueDate: '2026-07-02' }, { ...task, id: '3', dueDate: '2000-01-01', status: '완료함' }];
    const suggestion = createDashboardFeatureSuggestions(stats, new Date(2026, 5, 30)).find((item) => item.id === 'task-sla-board');
    expect(suggestion?.priorityLabel).toBe('중간');
    expect(suggestion?.reason).toContain('미완료 2건');
    expect(suggestion?.reason).toContain('3일 이내 마감은 1건');
    expect(suggestion?.evidence[0].value).toBe('0 / 0건');
  });

  it('does not flag balanced support just because there is support activity', () => {
    const stats = createStats({ support: { inbound: 50, outbound: 50, total: 100 } });
    expect(createDashboardFeatureSuggestions(stats).some((item) => item.id === 'support-balance-alert')).toBe(false);
  });

  it('requires recorded days, not volume alone, before recommending trend analysis', () => {
    const stats = createStats();
    stats.reports.thisMonthManDay = 2000;
    stats.operations.monthlyManDayRunRate = 3000;
    let suggestion = createDashboardFeatureSuggestions(stats).find((item) => item.id === 'productivity-forecast');
    expect(suggestion?.title).toBe('월간 공수 분석 기반 만들기');
    expect(suggestion?.priorityLabel).toBe('관찰');
    stats.dailyTrend = Array.from({ length: 7 }, (_, index) => ({ date: `2026-06-${20 + index}`, reportCount: 2, manDay: 10, siteCount: 1 }));
    suggestion = createDashboardFeatureSuggestions(stats).find((item) => item.id === 'productivity-forecast');
    expect(suggestion?.title).toBe('월간 공수 추세 분석');
    expect(suggestion?.note).toContain('단순 월말 환산');
  });

  it('does not count duplicate days, zero-report days, or previous-month data as history', () => {
    const stats = createStats();
    stats.reports.thisMonthManDay = 100;
    stats.dailyTrend = [
      ...Array.from({ length: 8 }, () => ({ date: '2026-06-20', reportCount: 2, manDay: 10, siteCount: 1 })),
      { date: '2026-05-31', reportCount: 2, manDay: 10, siteCount: 1 },
      { date: '2026-06-21', reportCount: 0, manDay: 0, siteCount: 0 },
    ];
    expect(createDashboardFeatureSuggestions(stats).find((item) => item.id === 'productivity-forecast')?.evidence[1].value).toBe('1일');
  });

  it('does not present non-finite metrics as urgent risks or predictions', () => {
    const stats = createStats();
    stats.dailyReportCoverage.coverageRate = NaN;
    stats.operations.healthScore = NaN;
    stats.operations.supportBalance = Infinity;
    stats.reports.thisMonthManDay = Infinity;
    const suggestions = createDashboardFeatureSuggestions(stats);
    expect(suggestions.map((item) => item.id)).toEqual(['data-quality-audit']);
    expect(JSON.stringify(suggestions)).not.toMatch(/NaN|Infinity/);
  });
});
