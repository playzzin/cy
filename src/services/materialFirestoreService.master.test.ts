import { doc, writeBatch } from 'firebase/firestore';
import { materialFirestoreService } from './materialFirestoreService';
import { invalidateTeamScopedCache } from './teamScopedReadService';

jest.mock('../config/firebase', () => ({ db: {} }));
jest.mock('../utils/firestoreConverter', () => ({ createConverter: jest.fn(() => ({})) }));
jest.mock('./teamScopedReadService', () => ({ getTeamScopedRows: jest.fn(), invalidateTeamScopedCache: jest.fn() }));
jest.mock('firebase/firestore', () => ({ doc: jest.fn(), writeBatch: jest.fn() }));

const set = jest.fn();
const commit = jest.fn();
beforeEach(() => {
    jest.clearAllMocks();
    (doc as jest.Mock).mockImplementation((_db, collection, id) => ({ withConverter: () => ({ collection, id }) }));
    (writeBatch as jest.Mock).mockReturnValue({ set, commit });
    commit.mockResolvedValue(undefined);
});

it('대표 행과 중복 행의 변경을 같은 커밋에 넣고 완료 후 조회 캐시를 무효화한다', async () => {
    const rows = [
        { id: 'selected', itemName: '자재', unitPrice: 250, isActive: true },
        { id: 'duplicate', itemName: '자재', unitPrice: 100, isActive: false },
    ];
    await materialFirestoreService.saveMaterialsBatch(rows);
    expect(writeBatch).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledTimes(2);
    expect(set).toHaveBeenNthCalledWith(2, { collection: 'materials', id: 'duplicate' }, rows[1], { merge: true });
    expect(commit).toHaveBeenCalledTimes(1);
    expect(invalidateTeamScopedCache).toHaveBeenCalledTimes(1);
});

it('커밋 실패를 호출자에게 전달하고 성공으로 취급하지 않는다', async () => {
    commit.mockRejectedValueOnce(new Error('permission-denied'));
    await expect(materialFirestoreService.saveMaterialsBatch([
        { id: 'selected', itemName: '자재', unitPrice: 0, isActive: false },
    ])).rejects.toThrow('permission-denied');
    expect(invalidateTeamScopedCache).not.toHaveBeenCalled();
});

it('처리 한도를 넘으면 부분 저장을 시작하지 않는다', async () => {
    const rows = Array.from({ length: 451 }, (_, index) => ({
        id: String(index), itemName: '자재', unitPrice: 0, isActive: false,
    }));
    await expect(materialFirestoreService.saveMaterialsBatch(rows)).rejects.toThrow('너무 많아');
    expect(writeBatch).not.toHaveBeenCalled();
});
