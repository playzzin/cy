import { act, renderHook, waitFor } from '@testing-library/react';
import { useOrganizationTree } from './useOrganizationTree';
import { companyService } from '../../../services/companyService';
import { teamService } from '../../../services/teamService';
import { manpowerService } from '../../../services/manpowerService';
import { siteService } from '../../../services/siteService';
import { companyFirestoreService } from '../../../services/companyFirestoreService';
import { teamFirestoreService } from '../../../services/teamFirestoreService';
import { siteFirestoreService } from '../../../services/siteFirestoreService';

jest.mock('../../../services/companyService', () => ({ companyService: { getCompanies: jest.fn() } }));
jest.mock('../../../services/teamService', () => ({ teamService: { getTeams: jest.fn() } }));
jest.mock('../../../services/manpowerService', () => ({ manpowerService: { getWorkers: jest.fn() } }));
jest.mock('../../../services/siteService', () => ({ siteService: { getSites: jest.fn() } }));
jest.mock('../../../services/companyFirestoreService', () => ({ companyFirestoreService: { getCompanies: jest.fn() } }));
jest.mock('../../../services/teamFirestoreService', () => ({ teamFirestoreService: { getTeams: jest.fn() } }));
jest.mock('../../../services/siteFirestoreService', () => ({ siteFirestoreService: { getSites: jest.fn() } }));

beforeEach(() => {
    jest.resetAllMocks();
    for (const fn of [companyService.getCompanies, teamService.getTeams, manpowerService.getWorkers, siteService.getSites, companyFirestoreService.getCompanies, teamFirestoreService.getTeams, siteFirestoreService.getSites]) {
        (fn as jest.Mock).mockResolvedValue([]);
    }
    (teamService.getTeams as jest.Mock).mockResolvedValue([{ id: 't1', name: '검증팀' }]);
});

it('retains organization data when only site lookup fails', async () => {
    (siteService.getSites as jest.Mock).mockRejectedValue(new Error('unavailable'));
    const { result } = renderHook(useOrganizationTree);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data?.teams[0].id).toBe('t1');
    expect(result.current.error).toBe('');
    expect(result.current.siteError).toContain('현장 정보를 불러오지 못했습니다');
});

it('reports an initial core failure and retries using fresh services', async () => {
    (companyService.getCompanies as jest.Mock).mockRejectedValue(new Error('unavailable'));
    const { result } = renderHook(useOrganizationTree);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBeNull();
    expect(result.current.error).toContain('조직 정보를 불러오지 못했습니다');
    act(() => result.current.refresh());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(companyFirestoreService.getCompanies).toHaveBeenCalledTimes(1);
    expect(teamFirestoreService.getTeams).toHaveBeenCalledTimes(1);
    expect(siteFirestoreService.getSites).toHaveBeenCalledTimes(1);
    expect(manpowerService.getWorkers).toHaveBeenLastCalledWith(true);
    expect(result.current.error).toBe('');
    expect(result.current.data).not.toBeNull();
});

it('preserves the last successful data and timestamp when refresh fails', async () => {
    const { result } = renderHook(useOrganizationTree);
    await waitFor(() => expect(result.current.loading).toBe(false));
    const previous = result.current.data;
    const timestamp = result.current.updatedAt;
    (teamFirestoreService.getTeams as jest.Mock).mockRejectedValue(new Error('unavailable'));
    act(() => result.current.refresh());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBe(previous);
    expect(result.current.updatedAt).toBe(timestamp);
    expect(result.current.error).toContain('마지막으로 조회한 정보');
});

it('ignores an older request that resolves after a newer refresh', async () => {
    let resolveOld!: (value: unknown[]) => void;
    (teamService.getTeams as jest.Mock).mockReturnValue(new Promise(resolve => { resolveOld = resolve; }));
    (teamFirestoreService.getTeams as jest.Mock).mockResolvedValue([{ id: 'new', name: '최신팀' }]);
    const { result } = renderHook(useOrganizationTree);
    act(() => result.current.refresh());
    await waitFor(() => expect(result.current.data?.teams[0].id).toBe('new'));
    await act(async () => { resolveOld([{ id: 'old', name: '이전팀' }]); });
    expect(result.current.data?.teams[0].id).toBe('new');
    expect(result.current.loading).toBe(false);
});
