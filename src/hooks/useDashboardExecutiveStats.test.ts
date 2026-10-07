import { act, renderHook, waitFor } from '@testing-library/react';
import { useDashboardExecutiveStats } from './useDashboardExecutiveStats';
import { createEmptyDashboardExecutiveStats, dashboardExecutiveService, type DashboardExecutiveStats } from '../services/dashboardExecutiveService';
import { useAuth } from '../contexts/AuthContext';

jest.mock('../contexts/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../services/dashboardExecutiveService', () => ({
  createEmptyDashboardExecutiveStats: () => ({ dailyReportCoverage: { date: '2026-06-30', status: 'unavailable' }, recentTasks: [] }),
  dashboardExecutiveService: { getSnapshot: jest.fn(), subscribeRecentTasks: jest.fn(() => () => {}) },
}));
const snapshot = (): DashboardExecutiveStats => ({ ...createEmptyDashboardExecutiveStats(), workers: { total: 1, active: 1 } });
const getSnapshot = dashboardExecutiveService.getSnapshot as jest.Mock;

beforeEach(() => {
  jest.useFakeTimers(); jest.clearAllMocks();
  (useAuth as jest.Mock).mockReturnValue({ currentUser: { uid: 'test-user' } });
  (dashboardExecutiveService.subscribeRecentTasks as jest.Mock).mockReturnValue(() => {});
});

it('clears previous account data immediately and ignores a late manual refresh and task callback', async () => {
  jest.setSystemTime(new Date('2026-06-30T07:00:00Z'));
  const oldSnapshot = snapshot();
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

