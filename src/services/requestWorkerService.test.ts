import { getRequestWorkers } from './requestWorkerService';
import { getTeamScopedRows } from './teamScopedReadService';
import { manpowerService } from './manpowerService';
jest.mock('./teamScopedReadService', () => ({ getTeamScopedRows: jest.fn() }));
jest.mock('./manpowerService', () => ({ manpowerService: { getWorkers: jest.fn() } }));
beforeEach(() => jest.resetAllMocks());

it('팀장에게 서버가 허용한 팀원만 반환하고 전체 작업자를 조회하지 않는다', async () => {
    const workers = [{ id: 'member-a', name: '팀원' }];
    (getTeamScopedRows as jest.Mock).mockResolvedValue(workers);
    expect(await getRequestWorkers()).toEqual({ workers, canRequestForTeam: true });
    expect(manpowerService.getWorkers).not.toHaveBeenCalled();
});

it('팀 조회 실패를 전체 작업자 선택으로 대체하지 않는다', async () => {
    (getTeamScopedRows as jest.Mock).mockRejectedValue(new Error('permission-denied'));
    await expect(getRequestWorkers()).rejects.toThrow('permission-denied');
    expect(manpowerService.getWorkers).not.toHaveBeenCalled();
});

it('팀장 범위가 아닌 계정은 기존 작업자 조회를 유지한다', async () => {
    (getTeamScopedRows as jest.Mock).mockResolvedValue(null);
    (manpowerService.getWorkers as jest.Mock).mockResolvedValue([]);
    expect(await getRequestWorkers()).toEqual({ workers: [], canRequestForTeam: false });
});
