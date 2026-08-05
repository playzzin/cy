import type { DashboardExecutiveStats } from '../../services/dashboardExecutiveService';
import { createDashboardActionItems } from './dashboardActionCenter';

const createStats = (overrides: Partial<DashboardExecutiveStats> = {}): DashboardExecutiveStats => ({
  workers: { total: 20, active: 18 },
  sites: { total: 6, active: 5 },
  teams: { total: 4 },
  reports: {
    today: 5,
    thisMonth: 40,
    todayManDay: 16,
    thisMonthManDay: 180,
  },
  support: { inbound: 0, outbound: 0, total: 0 },
  operations: {
    reportCoverageRate: 100,
    averageManDayPerReport: 4.5,
    supportBalance: 0,
    reportCountTrendPercent: 0,
    manDayTrendPercent: 0,
    monthlyManDayRunRate: 180,
    healthScore: 96,
    healthLabel: 'stable',
  },
  dailyReportCoverage: {
    date: '2026-06-30',
    activeSiteCount: 5,
    reportedSiteCount: 5,
    missingSiteCount: 0,
    coverageRate: 100,
    missingSites: [],
  },
  dailyTrend: [],
  recentReports: [],
  recentTasks: [],
  ...overrides,
});
describe('dashboardActionCenter', () => {
  it('prioritizes missing daily report coverage', () => {
    const actions = createDashboardActionItems(createStats({
      operations: {
        reportCoverageRate: 40,
        averageManDayPerReport: 4.5,
        supportBalance: 0,
        reportCountTrendPercent: 0,
        manDayTrendPercent: 0,
        monthlyManDayRunRate: 180,
        healthScore: 55,
        healthLabel: 'critical',
      },
      dailyReportCoverage: {
        date: '2026-06-30',
        activeSiteCount: 5,
        reportedSiteCount: 2,
        missingSiteCount: 3,
        coverageRate: 40,
        missingSites: [
          { siteId: 's1', siteName: 'A 현장' },
          { siteId: 's2', siteName: 'B 현장' },
          { siteId: 's3', siteName: 'C 현장' },
        ],
      },
    }), { today: '2026-06-30' });

    expect(actions[0]).toMatchObject({
      id: 'daily-report-coverage',
      severity: 'critical',
      metricValue: '40%',
    });
    expect(actions[0].description).toContain('A 현장');
  });

  it('creates task SLA actions for overdue and missing-assignee work', () => {
    const actions = createDashboardActionItems(createStats({
      recentTasks: [
        {
          id: 'task-1',
          title: '지연 업무',
          assignee: '담당자',
          priority: '보통',
          status: '진행',
          dueDate: '2026-06-29',
          createdAt: '2026-06-25',
          comments: [],
        },
        {
          id: 'task-2',
          title: '담당자 누락',
          assignee: '',
          priority: '긴급',
          status: '요청',
          dueDate: '2026-07-01',
          createdAt: '2026-06-25',
          comments: [],
        },
      ],
    }), { today: '2026-06-30' });

    const taskAction = actions.find((action) => action.id === 'task-sla');
    expect(taskAction).toMatchObject({
      severity: 'critical',
      metricValue: '2건',
      route: '/todo',
    });
  });

  it('adds support balance action only when support volume is meaningful', () => {
    const actions = createDashboardActionItems(createStats({
      support: { inbound: 2, outbound: 15, total: 17 },
      operations: {
        reportCoverageRate: 100,
        averageManDayPerReport: 4.5,
        supportBalance: -13,
        reportCountTrendPercent: 0,
        manDayTrendPercent: 0,
        monthlyManDayRunRate: 180,
        healthScore: 96,
        healthLabel: 'stable',
      },
    }));

    expect(actions.find((action) => action.id === 'support-balance')).toMatchObject({
      severity: 'info',
      metricValue: '-13.0공',
    });
  });

  it('returns a stable action when there is no immediate risk', () => {
    const actions = createDashboardActionItems(createStats());

    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      id: 'operations-clear',
      severity: 'success',
    });
  });
});
