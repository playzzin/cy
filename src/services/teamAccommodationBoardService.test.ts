import { httpsCallable } from 'firebase/functions';
import { teamAccommodationBoardService as service } from './teamAccommodationBoardService';
import { isDevAdminSessionEnabled } from '../utils/devAdminSession';
import type { TeamAccommodationBoard } from '../types/teamAccommodationBoard';

jest.mock('firebase/functions', () => ({ httpsCallable: jest.fn() }));
jest.mock('../config/firebase', () => ({ functions: {} }));
jest.mock('../utils/devAdminSession', () => ({ isDevAdminSessionEnabled: jest.fn(() => false) }));
const board: TeamAccommodationBoard = { teamId: 'team-a', teams: [], rooms: [], workers: [], date: '2026-10-30', revision: 'revision' };
const call = jest.fn();
beforeEach(() => {
    jest.clearAllMocks();
    (isDevAdminSessionEnabled as jest.Mock).mockReturnValue(false);
    (httpsCallable as jest.Mock).mockReturnValue(call);
});
test('조회와 저장은 실제 callable에 선택한 팀과 변경분을 전달한다', async () => {
    call.mockResolvedValue({ data: board });
    expect(await service.load('team-a')).toBe(board);
    expect(httpsCallable).toHaveBeenLastCalledWith({}, 'getTeamAccommodationBoard');
    expect(call).toHaveBeenLastCalledWith({ teamId: 'team-a' });
    const changes = [{ workerId: 'w', accommodationId: 'r' }];
    await service.save(board, changes);
    expect(httpsCallable).toHaveBeenLastCalledWith({}, 'saveTeamAccommodationBoard');
    expect(call).toHaveBeenLastCalledWith({ teamId: 'team-a', revision: 'revision', changes });
});
test('샘플 계정 조회·저장은 성공으로 처리하거나 가상 데이터를 반환하지 않는다', async () => {
    (isDevAdminSessionEnabled as jest.Mock).mockReturnValue(true);
    await expect(service.load()).rejects.toThrow('실제 계정');
    await expect(service.save(board, [])).rejects.toThrow('실제 계정');
    expect(httpsCallable).not.toHaveBeenCalled();
});
test('실제 서버 오류를 샘플 데이터로 대체하지 않는다', async () => {
    call.mockRejectedValue(new Error('unavailable'));
    await expect(service.load('team-a')).rejects.toThrow('unavailable');
});

test('숙소 설정 변경과 미설정 값도 실제 저장 함수에 전달한다', async () => {
    call.mockResolvedValue({ data: { saved: 0, roomsSaved: 1 } });
    const roomChanges = [{ accommodationId: 'room', roomCount: 3, maxOccupants: null }];
    await service.save(board, [], roomChanges);
    expect(call).toHaveBeenLastCalledWith({ teamId: 'team-a', revision: 'revision', changes: [], roomChanges });
});
