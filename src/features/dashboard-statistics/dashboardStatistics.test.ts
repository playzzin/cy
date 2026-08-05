import type { DashboardExecutiveStats } from '../../services/dashboardExecutiveService';
import { createDashboardStatistics } from './dashboardStatistics';

const createStats = (overrides: Partial<DashboardExecutiveStats> = {}): DashboardExecutiveStats => ({
  workers: { total: 20, active: 18 },
  sites: { total: 6, active: 5 },
  teams: { total: 4 },
  reports: {
    today: 5,
    thisMonth: 40,
    todayManDay: 16,
    thisMonthManDay: 150,
  },
  support: { inbound: 0, outbound: 0, total: 0 },
  operations: {
    reportCoverageRate: 80,
    averageManDayPerReport: 4.5,
    supportBalance: 0,
    reportCountTrendPercent: 0,
    manDayTrendPercent: 0,
    monthlyManDayRunRate: 300,
    healthScore: 96,
    healthLabel: 'stable',
  },
  dailyReportCoverage: {
    date: '2026-06-15',
    activeSiteCount: 5,
    reportedSiteCount: 4,
    missingSiteCount: 1,
    coverageRate: 80,
    missingSites: [],
  },
  dailyTrend: [],
  recentReports: [],
  recentTasks: [],
  ...overrides,
});

describe('dashboardStatistics', () => {
  it('creates month, run-rate, coverage and SLA statistics', () => {
    const statistics = createDashboardStatistics(createStats(), { today: '2026-06-15' });

    expect(statistics.map((item) => item.id)).toEqual([
      'month-progress',
      'monthly-run-rate',
      'report-coverage',
      'task-stability',
    ]);
    expect(statistics[0]).toMatchObject({
      value: '50%',
      numericValue: 50,
      unit: '%',
      precision: 0,
      detail: '15/30일 경과',
    });
    expect(statistics[1]).toMatchObject({
      value: '300.0공',
      numericValue: 300,
      unit: '공',
      precision: 1,
      progress: 50,
    });
  });

  it('marks low report coverage as red', () => {
    const coverage = createDashboardStatistics(createStats({
      dailyReportCoverage: {
        date: '2026-06-15',
        activeSiteCount: 5,
        reportedSiteCount: 2,
        missingSiteCount: 3,
        coverageRate: 40,
        missingSites: [],
      },
    }), { today: '2026-06-15' }).find((item) => item.id === 'report-coverage');

    expect(coverage).toMatchObject({
      value: '40%',
      tone: 'red',
      progress: 40,
    });
  });

  it('calculates task SLA stability from recent open tasks', () => {
    const taskStability = createDashboardStatistics(createStats({
      recentTasks: [
        {
          id: 'task-1',
          title: '지연 업무',
          assignee: '담당자',
          priority: '보통',
          status: '진행',
          dueDate: '2026-06-14',
          createdAt: '2026-06-10',
          comments: [],
        },
        {
          id: 'task-2',
          title: '정상 업무',
          assignee: '담당자',
          priority: '보통',
          status: '진행',
          dueDate: '2026-06-25',
          createdAt: '2026-06-10',
          comments: [],
        },
      ],
    }), { today: '2026-06-15' }).find((item) => item.id === 'task-stability');

    expect(taskStability).toMatchObject({
      value: '50%',
      tone: 'red',
      detail: '리스크 1건 / 진행 2건',
    });
  });
});
