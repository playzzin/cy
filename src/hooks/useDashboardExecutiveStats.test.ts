import { act, renderHook, waitFor } from '@testing-library/react';
import { useDashboardExecutiveStats } from './useDashboardExecutiveStats';
import { dashboardExecutiveService, type DashboardExecutiveStats } from '../services/dashboardExecutiveService';
import type { DailyReportCoverageStatus } from '../features/daily-report-coverage/dailyReportCoverage';
import { useAuth } from '../contexts/AuthContext';

jest.mock('../contexts/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../services/dashboardExecutiveService', () => ({
  createEmptyDashboardExecutiveStats: () => ({ dailyReportCoverage: { date: '2026-06-30', status: 'unavailable' }, recentTasks: [] }),
  dashboardExecutiveService: { getSnapshot: jest.fn(), subscribeRecentTasks: jest.fn(() => () => {}) },
}));
const snapshot = (date: string, status: DailyReportCoverageStatus): DashboardExecutiveStats => ({
  dailyReportCoverage: { date, status, activeSiteCount: 1, expectedSiteCount: 1, reportedSiteCount: 0, missingSiteCount: 1, coverageRate: 0, missingSites: [] },
  workers: { total: 1, active: 1 }, sites: { total: 1, active: 1 }, teams: { total: 1 },
  reports: { today: 0, thisMonth: 0, todayManDay: 0, thisMonthManDay: 0 }, support: { total: 0, inbound: 0, outbound: 0 },
  operations: { reportCoverageRate: 0, averageManDayPerReport: 0, supportBalance: 0, healthScore: null, healthLabel: 'collecting', reportCountTrendPercent: null, manDayTrendPercent: null, monthlyManDayRunRate: 0 },
  recentTasks: [], recentReports: [], dailyTrend: [],
});
const getSnapshot = dashboardExecutiveService.getSnapshot as jest.Mock;

beforeEach(() => {
  jest.useFakeTimers(); jest.clearAllMocks();
  (useAuth as jest.Mock).mockReturnValue({ currentUser: { uid: 'test-user' } });
  (dashboardExecutiveService.subscribeRecentTasks as jest.Mock).mockReturnValue(() => {});
});

it('clears previous account data immediately and ignores a late manual refresh and task callback', async () => {
  jest.setSystemTime(new Date('2026-06-30T07:00:00Z'));
  const oldSnapshot = snapshot('2026-06-30', 'complete');
  const newSnapshot = { ...oldSnapshot, workers: { total: 7, active: 6 } };
  let resolveOld!: (value: DashboardExecutiveStats) => void;
  let resolveNew!: (value: DashboardExecutiveStats) => void;
  getSnapshot.mockResolvedValueOnce(oldSnapshot)
    .mockReturnValueOnce(new Promise(resolve => { resolveOld = resolve; }))
    .mockReturnValueOnce(new Promise(resolve => { resolveNew = resolve; }));
  const unsubscribe = jest.fn();
  const subscribe = dashboardExecutiveService.subscribeRecentTasks as jest.Mock;
  subscribe.mockReturnValue(unsubscribe);
  const { result, rerender } = renderHook(() => useDashboardExecutiveStats());
  await waitFor(() => expect(result.current.loading).toBe(false));
  const oldTasksCallback = subscribe.mock.calls[0][0];
  act(() => { oldTasksCallback([{ id: 'private-task-a' }]); });
  let refreshing!: Promise<void>;
  act(() => { refreshing = result.current.refresh(); });
  expect(result.current.refreshing).toBe(true);
  (useAuth as jest.Mock).mockReturnValue({ currentUser: { uid: 'new-user' } });
  rerender();
  expect(unsubscribe).toHaveBeenCalledTimes(1);
  expect(result.current.loading).toBe(true);
  expect(result.current.stats.recentTasks).toEqual([]);
  expect(result.current.lastUpdatedAt).toBeNull();
  expect(result.current.refreshing).toBe(false);
  await act(async () => { resolveNew(newSnapshot); });
  await act(async () => { resolveOld(oldSnapshot); await refreshing; oldTasksCallback([{ id: 'late-private-a' }]); });
  expect(result.current.stats.workers.total).toBe(7);
  expect(result.current.stats.recentTasks).toEqual([]);
  (useAuth as jest.Mock).mockReturnValue({ currentUser: null });
  rerender();
  expect(result.current.loading).toBe(false);
  expect(result.current.stats.recentTasks).toEqual([]);
  expect(result.current.lastUpdatedAt).toBeNull();
  expect(subscribe).toHaveBeenCalledTimes(2);
});
afterEach(() => { jest.useRealTimers(); });

describe('dashboard business boundary refresh', () => {
  it('refreshes an open dashboard after the Korean deadline and stops repeating after evaluation', async () => {
    jest.setSystemTime(new Date('2026-06-30T08:59:30Z'));
    getSnapshot.mockResolvedValueOnce(snapshot('2026-06-30', 'collecting')).mockResolvedValue(snapshot('2026-06-30', 'overdue'));
    const { result } = renderHook(() => useDashboardExecutiveStats());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { jest.advanceTimersByTime(60_000); });
    expect(getSnapshot).toHaveBeenLastCalledWith({ forceRefresh: true });
    expect(result.current.stats.dailyReportCoverage.status).toBe('overdue');
    await act(async () => { jest.advanceTimersByTime(60_000); });
    expect(getSnapshot).toHaveBeenCalledTimes(2);
  });

  it('refreshes a dashboard when returning after Korean midnight', async () => {
    jest.setSystemTime(new Date('2026-06-30T14:59:59Z'));
    getSnapshot.mockResolvedValueOnce(snapshot('2026-06-30', 'complete')).mockResolvedValue(snapshot('2026-07-01', 'unknown'));
    const { result } = renderHook(() => useDashboardExecutiveStats());
    await waitFor(() => expect(result.current.loading).toBe(false));
    jest.setSystemTime(new Date('2026-06-30T15:00:00Z'));
    await act(async () => { window.dispatchEvent(new Event('focus')); });
    expect(result.current.stats.dailyReportCoverage.date).toBe('2026-07-01');
    expect(getSnapshot).toHaveBeenCalledTimes(2);
  });

  it('does not refresh on ordinary focus or after unmount', async () => {
    jest.setSystemTime(new Date('2026-06-30T07:00:00Z'));
    getSnapshot.mockResolvedValue(snapshot('2026-06-30', 'collecting'));
    const { result, unmount } = renderHook(() => useDashboardExecutiveStats());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { window.dispatchEvent(new Event('focus')); });
    expect(getSnapshot).toHaveBeenCalledTimes(1);
    unmount();
    jest.setSystemTime(new Date('2026-07-01T07:00:00Z'));
    await act(async () => { jest.advanceTimersByTime(60_000); window.dispatchEvent(new Event('focus')); });
    expect(getSnapshot).toHaveBeenCalledTimes(1);
  });
});
