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
    expect(suggestions[0].description).toContain('A 현장');
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
});
