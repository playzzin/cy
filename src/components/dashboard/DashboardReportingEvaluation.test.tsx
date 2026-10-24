import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import type { DashboardExecutiveStats } from '../../services/dashboardExecutiveService';
import { buildDailyReportCoverage } from '../../features/daily-report-coverage/dailyReportCoverage';
import { buildDashboardOperationInsights } from '../../features/dashboard-operations/dashboardOperations';
import { DashboardOperationsPulsePanel } from './DashboardOperationsPulsePanel';
import { DashboardDailyReportCoveragePanel } from './DashboardDailyReportCoveragePanel';
import { createDashboardFeatureSuggestions } from '../../features/dashboard-intelligence/dashboardSuggestions';
import { createDashboardActionItems } from '../../features/dashboard-action-center/dashboardActionCenter';

const Location = () => { const location = useLocation(); return <output aria-label="현재 경로">{location.pathname}{location.search}</output>; };
const createStats = (now: string, known = true): DashboardExecutiveStats => {
  const dailyReportCoverage = buildDailyReportCoverage({
    date: '2026-06-30', now: new Date(now), reports: [],
    sites: [{ id: 's1', name: '테스트 현장', status: 'active' }],
    plan: { source: known ? 'confirmed' : 'unknown', assignments: known ? [{ siteId: 's1' }] : [] },
  });
  return {
    workers: { total: 1, active: 1 }, sites: { total: 1, active: 1 }, teams: { total: 1 },
    reports: { today: 0, thisMonth: 0, todayManDay: 0, thisMonthManDay: 0 }, support: { total: 0, inbound: 0, outbound: 0 },
    operations: { ...buildDashboardOperationInsights({ reports: [], today: '2026-06-30', coverage: dailyReportCoverage }),
      reportCoverageRate: dailyReportCoverage.coverageRate, averageManDayPerReport: 0, supportBalance: 0 },
    dailyReportCoverage, dailyTrend: [], recentReports: [], recentTasks: [],
  };
};
const show = (stats: DashboardExecutiveStats) => render(
  <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <DashboardOperationsPulsePanel stats={stats} /><DashboardDailyReportCoveragePanel coverage={stats.dailyReportCoverage} /><Location />
  </MemoryRouter>
);

describe('dashboard reporting evaluation flow', () => {
  it('shows pending submission before cutoff without low-health recommendations or urgent alerts', () => {
    const stats = createStats('2026-06-30T08:00:00Z');
    show(stats);
    const health = within(screen.getByRole('region', { name: '운영 건강도' }));
    expect(health.getByText('집계 중')).toBeVisible();
    expect(health.queryByText('/ 100점')).not.toBeInTheDocument();
    expect(health.getAllByText('비교 자료 없음')).toHaveLength(2);
    expect(screen.getByText('작성 대기')).toBeVisible();
    expect(screen.queryByRole('button', { name: '누락 알림 초안 작성' })).not.toBeInTheDocument();
    expect(createDashboardFeatureSuggestions(stats).map((item) => item.id)).toEqual(['reporting-readiness']);
    expect(createDashboardActionItems(stats).every((item) => item.severity === 'info')).toBe(true);
  });

  it('explains a real deduction after cutoff and opens the same report date', () => {
    const stats = createStats('2026-06-30T09:00:00Z');
    show(stats);
    const health = within(screen.getByRole('region', { name: '운영 건강도' }));
    expect(health.getByText('0')).toBeVisible();
    expect(health.getByText('마감 후 일보 미작성 · −100점')).toBeVisible();
    fireEvent.click(health.getByRole('link', { name: /마감 후 일보 미작성/ }));
    expect(screen.getByLabelText('현재 경로')).toHaveTextContent('/reports/daily?tab=list-v2&date=2026-06-30');
    expect(createDashboardActionItems(stats).filter((item) => ['daily-report-coverage', 'operations-health'].includes(item.id))).toHaveLength(1);
  });

  it('directs unknown targets to their dated schedule without fabricating a rate', () => {
    const stats = createStats('2026-06-30T09:00:00Z', false);
    show(stats);
    const coverage = within(screen.getByRole('region', { name: '일보 제출 현황' }));
    expect(coverage.getByText('확인 필요')).toBeVisible();
    expect(coverage.queryByText('0%')).not.toBeInTheDocument();
    fireEvent.click(coverage.getByRole('button', { name: /제출 대상 일정 확인/ }));
    expect(screen.getByLabelText('현재 경로')).toHaveTextContent('/assignment/field-schedule?date=2026-06-30');
    expect(createDashboardFeatureSuggestions(stats).map((item) => item.id)).toEqual(['reporting-readiness']);
  });
});
