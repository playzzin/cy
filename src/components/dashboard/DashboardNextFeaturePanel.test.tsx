import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import type { DashboardExecutiveStats } from '../../services/dashboardExecutiveService';
import { DashboardNextFeaturePanel } from './DashboardNextFeaturePanel';

const createStats = (): DashboardExecutiveStats => ({
  workers: { total: 10, active: 10 }, sites: { total: 4, active: 4 }, teams: { total: 2 },
  reports: { today: 0, thisMonth: 10, todayManDay: 0, thisMonthManDay: 120 },
  support: { inbound: 0, outbound: 25, total: 25 },
  operations: { healthScore: 10, healthLabel: 'critical', reportCoverageRate: 0, supportBalance: -25, averageManDayPerReport: 12, reportCountTrendPercent: 0, manDayTrendPercent: -20, monthlyManDayRunRate: 150 },
  dailyReportCoverage: { date: '2026-06-30', activeSiteCount: 4, reportedSiteCount: 0, missingSiteCount: 4, coverageRate: 0, missingSites: [{ siteId: 'a', siteName: '테스트 현장' }] },
  dailyTrend: [], recentReports: [],
  recentTasks: [{ id: 'late', title: '확인', assignee: '담당자', status: '요청', priority: '보통', dueDate: '2000-01-01', createdAt: '2000-01-01', comments: [] }],
});

const Location = () => { const location = useLocation(); return <output aria-label="현재 경로">{location.pathname}{location.search}</output>; };
const renderPanel = (props: Partial<React.ComponentProps<typeof DashboardNextFeaturePanel>> = {}) => render(
  <MemoryRouter initialEntries={['/dashboard']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <DashboardNextFeaturePanel stats={createStats()} {...props} />
    <Location />
  </MemoryRouter>
);

describe('DashboardNextFeaturePanel', () => {
  it('shows the top three and can expand and collapse the remaining suggestions', () => {
    renderPanel();
    expect(screen.getAllByRole('article')).toHaveLength(3);
    expect(within(screen.getByRole('region', { name: '다음 기능 자동 제안' })).getByRole('status')).toHaveTextContent('추천 5건');
    fireEvent.click(screen.getByRole('button', { name: '나머지 2개 제안 보기' }));
    expect(screen.getAllByRole('article')).toHaveLength(5);
    fireEvent.click(screen.getByRole('button', { name: '상위 3개만 보기' }));
    expect(screen.getAllByRole('article')).toHaveLength(3);
  });

  it('opens evidence without navigating and routes the action to the report date', () => {
    renderPanel();
    const card = screen.getByRole('article', { name: '일보 누락 자동 리마인더' });
    const toggle = within(card).getByRole('button', { name: /추천 근거 및 실행 단계/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(within(card).getByText(/미작성 현장: 테스트 현장/)).not.toBeVisible();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(within(card).getByText(/미작성 현장: 테스트 현장/)).toBeVisible();
    expect(screen.getByLabelText('현재 경로')).toHaveTextContent('/dashboard');
    fireEvent.click(within(card).getByRole('link', { name: '기준일 일보 확인' }));
    expect(screen.getByLabelText('현재 경로')).toHaveTextContent('/reports/daily?tab=list-v2&date=2026-06-30');
  });

  it('holds recommendations when the snapshot failed to load', () => {
    renderPanel({ dataAvailable: false });
    expect(screen.queryAllByRole('article')).toHaveLength(0);
    expect(screen.getByText('운영 데이터를 불러오지 못해 추천을 보류했습니다.')).toBeVisible();
  });

  it('announces refresh while retaining the previous suggestions', () => {
    renderPanel({ refreshing: true });
    expect(screen.getByRole('region', { name: '다음 기능 자동 제안' })).toHaveAttribute('aria-busy', 'true');
    expect(within(screen.getByRole('region', { name: '다음 기능 자동 제안' })).getByRole('status')).toHaveTextContent('데이터 갱신 중');
    expect(screen.getAllByRole('article')).toHaveLength(3);
  });

  it('shows an empty state instead of a false recommendation', () => {
    const stats = createStats();
    stats.workers = { total: 0, active: 0 }; stats.sites = { total: 0, active: 0 }; stats.teams.total = 0;
    stats.reports = { today: 0, thisMonth: 0, todayManDay: 0, thisMonthManDay: 0 };
    stats.support = { inbound: 0, outbound: 0, total: 0 }; stats.operations.supportBalance = 0;
    stats.dailyReportCoverage.activeSiteCount = 0; stats.recentTasks = [];
    renderPanel({ stats });
    expect(screen.queryAllByRole('article')).toHaveLength(0);
    expect(screen.getByText('추천을 위한 운영 데이터가 아직 없습니다.')).toBeVisible();
  });
});
