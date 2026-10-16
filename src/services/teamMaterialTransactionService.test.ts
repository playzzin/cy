import { httpsCallable } from 'firebase/functions';
import { saveScopedMaterialTransactions } from './teamMaterialTransactionService';
import { usesTeamScopedReads, invalidateTeamScopedCache } from './teamScopedReadService';
const mockCall = jest.fn();
jest.mock('firebase/functions', () => ({ httpsCallable: jest.fn(() => mockCall) }));
jest.mock('../config/firebase', () => ({ functions: {} }));
jest.mock('./teamScopedReadService', () => ({ usesTeamScopedReads: jest.fn(), invalidateTeamScopedCache: jest.fn() }));
beforeEach(() => { jest.clearAllMocks(); (httpsCallable as jest.Mock).mockReturnValue(mockCall); });
it('팀장 입출고 저장은 서버 권한 확인 후 조회 캐시를 갱신한다', async () => {
    (usesTeamScopedReads as jest.Mock).mockResolvedValue(true); mockCall.mockResolvedValue({ data: { saved: 1 } });
    expect(await saveScopedMaterialTransactions('inbound', [{ id: 'one' }])).toBe(true);
    expect(httpsCallable).toHaveBeenCalledWith({}, 'teamMaterialTransactions');
    expect(mockCall).toHaveBeenCalledWith({ direction: 'inbound', transactions: [{ id: 'one' }] });
    expect(invalidateTeamScopedCache).toHaveBeenCalled();
});
it('권한 거절은 직접 저장 경로로 우회하지 않는다', async () => {
    (usesTeamScopedReads as jest.Mock).mockResolvedValue(true); mockCall.mockRejectedValue(new Error('permission-denied'));
    await expect(saveScopedMaterialTransactions('outbound', [{ id: 'one' }])).rejects.toThrow('permission-denied');
    expect(invalidateTeamScopedCache).not.toHaveBeenCalled();
});
it('기존 관리자는 기존 저장 경로를 유지한다', async () => {
    (usesTeamScopedReads as jest.Mock).mockResolvedValue(false);
    expect(await saveScopedMaterialTransactions('inbound', [])).toBe(false); expect(mockCall).not.toHaveBeenCalled();
});
