import { dashboardExecutiveService } from './dashboardExecutiveService';
import { siteService } from './siteService';
import { dailyReportService } from './dailyReportService';
import { companyService } from './companyService';
import { manpowerService } from './manpowerService';
import { teamService } from './teamService';
import { auth } from '../config/firebase';
import type { User } from 'firebase/auth';

jest.mock('../config/firebase', () => ({ auth: { currentUser: { uid: 'account-a' } } }));
jest.mock('../utils/devAdminSession', () => ({ isDevAdminSessionEnabled: () => false }));

jest.mock('./companyService', () => ({ companyService: { getCompanies: jest.fn(async () => []) } }));
jest.mock('./manpowerService', () => ({ manpowerService: { getWorkerCounts: jest.fn() } }));
jest.mock('./teamService', () => ({ teamService: { getTeams: jest.fn(async () => []) } }));
jest.mock('./taskService', () => ({ taskService: { subscribeRecent: jest.fn(() => () => {}) } }));
jest.mock('./siteService', () => ({ siteService: { getSites: jest.fn() } }));
jest.mock('./dailyReportService', () => ({ dailyReportService: { getAllReports: jest.fn() } }));

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-06-30T09:00:00Z'));
  jest.clearAllMocks();
  Object.assign(auth, { currentUser: { uid: 'account-a' } as User });
  dashboardExecutiveService.clearSnapshotCache();
  (companyService.getCompanies as jest.Mock).mockResolvedValue([]);
  (manpowerService.getWorkerCounts as jest.Mock).mockResolvedValue({ total: 0, active: 0 });
  (teamService.getTeams as jest.Mock).mockResolvedValue([]);
  (siteService.getSites as jest.Mock).mockResolvedValue([
    { id: 'a', name: 'A현장', status: 'active' }, { id: 'b', name: 'B현장', status: 'active' },
  ]);
  (dailyReportService.getAllReports as jest.Mock).mockResolvedValue([]);
});

describe('dashboard account isolation and complete worker totals', () => {
  it('uses aggregate totals above 1,000 and only reuses the current account cache', async () => {
    const counts = manpowerService.getWorkerCounts as jest.Mock;
    counts.mockResolvedValueOnce({ total: 2501, active: 1800 }).mockResolvedValue({ total: 7, active: 3 });
    expect((await dashboardExecutiveService.getSnapshot()).workers).toEqual({ total: 2501, active: 1800 });
    expect((await dashboardExecutiveService.getSnapshot()).workers.total).toBe(2501);
    expect(counts).toHaveBeenCalledTimes(1);
    Object.assign(auth, { currentUser: { uid: 'account-b' } as User });
    expect((await dashboardExecutiveService.getSnapshot()).workers).toEqual({ total: 7, active: 3 });
    expect(counts).toHaveBeenCalledTimes(2);
    Object.assign(auth, { currentUser: null });
    await expect(dashboardExecutiveService.getSnapshot()).rejects.toThrow('로그인');
  });

  it('rejects a late old-account response without clearing the new account request', async () => {
    let resolveA!: (value: { total: number; active: number }) => void;
    let resolveB!: (value: { total: number; active: number }) => void;
    const counts = manpowerService.getWorkerCounts as jest.Mock;
    counts.mockReturnValueOnce(new Promise(resolve => { resolveA = resolve; }))
      .mockReturnValueOnce(new Promise(resolve => { resolveB = resolve; }));
    const oldRequest = dashboardExecutiveService.getSnapshot();
    const oldRejection = oldRequest.catch(error => error);
    Object.assign(auth, { currentUser: { uid: 'account-b' } as User });
    const newRequest = dashboardExecutiveService.getSnapshot();
    resolveA({ total: 99, active: 99 });
    await expect(oldRejection).resolves.toMatchObject({ message: expect.stringContaining('만료') });
    const sharedNewRequest = dashboardExecutiveService.getSnapshot();
    expect(counts).toHaveBeenCalledTimes(2);
    resolveB({ total: 2, active: 1 });
    expect((await newRequest).workers.total).toBe(2);
    expect((await sharedNewRequest).workers.total).toBe(2);
    expect((await dashboardExecutiveService.getSnapshot()).workers.total).toBe(2);
  });

  it.each(['clear', 'refresh', 'new-session'] as const)('does not restore a stale cache after %s', async action => {
    let resolveOld!: (value: { total: number; active: number }) => void;
    (manpowerService.getWorkerCounts as jest.Mock).mockReturnValueOnce(new Promise(resolve => { resolveOld = resolve; }))
      .mockResolvedValue({ total: 5, active: 4 });
    const rejected = dashboardExecutiveService.getSnapshot().catch(error => error);
    if (action === 'clear') dashboardExecutiveService.clearSnapshotCache();
    if (action === 'new-session') Object.assign(auth, { currentUser: { uid: 'account-a' } as User });
    await dashboardExecutiveService.getSnapshot({ forceRefresh: action === 'refresh' });
    resolveOld({ total: 999, active: 999 });
    await expect(rejected).resolves.toMatchObject({ message: expect.stringContaining('만료') });
    expect((await dashboardExecutiveService.getSnapshot()).workers.total).toBe(5);
  });
});
afterEach(() => { jest.useRealTimers(); dashboardExecutiveService.clearSnapshotCache(); });

