import { writeBatch, setDoc } from 'firebase/firestore';
import { accommodationFirestoreService } from './accommodationFirestoreService';
jest.mock('../config/firebase', () => ({ db: {} }));
jest.mock('./teamScopedReadService', () => ({ getTeamScopedRows: jest.fn() }));
jest.mock('../utils/firestoreConverter', () => ({ createConverter: () => ({}) }));
jest.mock('firebase/firestore', () => ({
    writeBatch: jest.fn(), setDoc: jest.fn(), Timestamp: { now: () => 1 },
    doc: (_db: unknown, _collection: string, id: string) => ({ withConverter: () => ({ id }) }),
}));
const rows = [{ id: 'a', billingSyncPending: true }, { id: 'b' }];
beforeEach(() => jest.clearAllMocks());
test('queues all rows then commits once, preserving merge and recovery markers', async () => {
    const set = jest.fn();
    const commit = jest.fn().mockResolvedValue(undefined);
    (writeBatch as jest.Mock).mockReturnValue({ set, commit });
    await accommodationFirestoreService.saveUtilityRecords(rows);
    expect(set).toHaveBeenCalledTimes(2);
    expect(set).toHaveBeenCalledWith({ id: 'a' }, expect.objectContaining({ billingSyncPending: true }), { merge: true });
    expect(commit).toHaveBeenCalledTimes(1);
    expect(setDoc).not.toHaveBeenCalled();
});
test('fails as one batch without falling back to individual writes', async () => {
    const commit = jest.fn().mockRejectedValue(new Error('permission-denied'));
    (writeBatch as jest.Mock).mockReturnValue({ set: jest.fn(), commit });
    await expect(accommodationFirestoreService.saveUtilityRecords(rows)).rejects.toThrow('permission-denied');
    expect(setDoc).not.toHaveBeenCalled();
});
test('rejects oversize requests before creating any batch', async () => {
    await expect(accommodationFirestoreService.saveUtilityRecords(Array.from({ length: 501 }, (_, i) => ({ id: String(i) })))).rejects.toThrow('500');
    expect(writeBatch).not.toHaveBeenCalled();
});
