import { getDocs } from 'firebase/firestore';
import { getTeamScopedRows } from './teamScopedReadService';
import { advanceRequestService } from './advanceRequestService';

jest.mock('../config/firebase', () => ({ db: {} }));
jest.mock('./teamScopedReadService', () => ({ getTeamScopedRows: jest.fn() }));
jest.mock('firebase/firestore', () => ({
    collection: jest.fn(), doc: jest.fn(), getDoc: jest.fn(), getDocs: jest.fn(),
    query: jest.fn(), setDoc: jest.fn(), updateDoc: jest.fn(), where: jest.fn(),
    Timestamp: class { toMillis() { return 0; } },
}));
const scoped = getTeamScopedRows as jest.Mock;
const read = getDocs as jest.Mock;
beforeEach(() => { jest.clearAllMocks(); });

it('팀장은 허용된 팀 응답에서 작업자와 기존 ID 신청만 읽는다', async () => {
    scoped.mockResolvedValue([
        { id: 'old', workerId: 'legacy-a', requestedAmount: '10,000', createdAt: '2026-09-01' },
        { id: 'new', workerId: 'worker-a', requestedAmount: 20000, createdAt: '2026-09-02' },
        { id: 'different', workerId: 'worker-c' },
    ]);
    const rows = await advanceRequestService.listForWorkerIds(['worker-a', 'legacy-a'], 'leader');
    expect(rows.map(row => row.id)).toEqual(['new', 'old']);
    expect(rows[1].requestedAmount).toBe(10000);
    expect(read).not.toHaveBeenCalled();
});

it('서버 권한 오류나 빈 결과를 직접 조회로 우회하지 않는다', async () => {
    scoped.mockRejectedValueOnce(new Error('permission-denied'));
    await expect(advanceRequestService.listForWorkerIds(['worker-a'])).rejects.toThrow('permission-denied');
    scoped.mockResolvedValueOnce([]);
    await expect(advanceRequestService.listForWorkerIds(['worker-a'])).resolves.toEqual([]);
    expect(read).not.toHaveBeenCalled();
});

it('관리자는 기존 조회를 유지하고 중복 신청을 합친다', async () => {
    scoped.mockResolvedValue(null);
    read.mockResolvedValue({ docs: [{ id: 'one', data: () => ({ workerId: 'worker-a' }) }] });
    expect(await advanceRequestService.listForWorkerIds(['worker-a', 'worker-a'], 'admin')).toHaveLength(1);
    expect(read).toHaveBeenCalledTimes(2);
});
