import { httpsCallable } from 'firebase/functions';
import { auth } from '../config/firebase';
import { isDevAdminSessionEnabled } from '../utils/devAdminSession';
import { invalidateWorkerCache } from '../utils/workerCacheRevision';
import { invalidateTeamScopedCache } from './teamScopedReadService';
import { teamResourceStatusService, TeamResourceStatusRequest } from './teamResourceStatusService';

jest.mock('firebase/functions', () => ({ httpsCallable: jest.fn() }));
jest.mock('../config/firebase', () => ({ auth: { currentUser: null }, functions: {} }));
jest.mock('../utils/devAdminSession', () => ({ isDevAdminSessionEnabled: jest.fn() }));
jest.mock('../utils/workerCacheRevision', () => ({ invalidateWorkerCache: jest.fn() }));
jest.mock('./teamScopedReadService', () => ({ invalidateTeamScopedCache: jest.fn() }));
const input: TeamResourceStatusRequest = { kind: 'worker', id: 'synthetic-worker', status: '재직', expectedStatus: '퇴사', expectedIsActive: false };
const call = jest.fn();
beforeEach(() => {
    jest.clearAllMocks();
    (auth as any).currentUser = { uid: 'synthetic-leader' };
    (isDevAdminSessionEnabled as jest.Mock).mockReturnValue(false);
    (httpsCallable as jest.Mock).mockReturnValue(call);
    call.mockResolvedValue({ data: { id: input.id, status: '재직', isActive: true } });
});
test('서버 상태 변경을 호출하고 팀·작업자 캐시를 갱신한다', async () => {
    expect(await teamResourceStatusService.update(input)).toEqual({ id: input.id, status: '재직', isActive: true });
    expect(httpsCallable).toHaveBeenCalledWith({}, 'updateTeamResourceStatus');
    expect(call).toHaveBeenCalledWith(input);
    expect(invalidateWorkerCache).toHaveBeenCalledTimes(1);
    expect(invalidateTeamScopedCache).toHaveBeenCalledTimes(1);
});
test('응답이 오기 전 계정이 바뀌면 결과를 적용하지 않는다', async () => {
    call.mockImplementationOnce(async () => {
        (auth as any).currentUser = { uid: 'another-leader' };
        return { data: { id: input.id, status: '재직' } };
    });
    await expect(teamResourceStatusService.update(input)).rejects.toThrow('로그인 계정이 변경');
});
test('로그인 없는 계정과 개발 샘플은 저장하지 않는다', async () => {
    (auth as any).currentUser = null;
    await expect(teamResourceStatusService.update(input)).rejects.toThrow('로그인이 필요');
    (isDevAdminSessionEnabled as jest.Mock).mockReturnValue(true);
    await expect(teamResourceStatusService.update(input)).rejects.toThrow('샘플 계정');
    expect(call).not.toHaveBeenCalled();
});
test('실패 응답을 그대로 전달하고 새로고침 때 최신 상태를 조회한다', async () => {
    call.mockRejectedValueOnce(new Error('다른 사용자가 상태를 변경했습니다.'));
    await expect(teamResourceStatusService.update(input)).rejects.toThrow('다른 사용자가');
    expect(invalidateWorkerCache).toHaveBeenCalledTimes(1);
});
