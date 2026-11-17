import { doc, getDoc, writeBatch } from 'firebase/firestore';
import { manpowerService } from './manpowerService';
import { workerFirestoreService } from './workerFirestoreService';

jest.mock('../config/firebase', () => ({ auth: { currentUser: { uid: 'test' } }, db: {}, storage: {} }));
jest.mock('./workerFirestoreService', () => ({ workerFirestoreService: { addWorker: jest.fn(), updateWorker: jest.fn() } }));
jest.mock('./databaseLogService', () => ({ databaseLogService: { safeCreateLog: jest.fn() } }));
jest.mock('./identityDocumentLogService', () => ({ recordWorkerIdentityChange: jest.fn() }));
jest.mock('./teamScopedReadService', () => ({ getTeamScopedRows: jest.fn() }));
jest.mock('../utils/devAdminSession', () => ({ isDevAdminSessionEnabled: () => false }));
jest.mock('firebase/firestore', () => ({ doc: jest.fn((_db, _collection, id) => ({ id })), getDoc: jest.fn(), writeBatch: jest.fn(), Timestamp: { now: () => 'now' } }));

const worker = { id: 'one', name: '가상작업자', directPayBankName: '검증은행', directPayAccountNumber: '001234567890', directPayAccountHolder: '가상작업자' };
beforeEach(() => {
    jest.clearAllMocks();
    (doc as jest.Mock).mockImplementation((_db, _collection, id) => ({ id }));
    jest.spyOn(manpowerService, 'getWorker').mockResolvedValue(worker);
    (getDoc as jest.Mock).mockResolvedValue({ exists: () => true, data: () => worker });
});
afterEach(() => jest.restoreAllMocks());

test('신규 및 개별 수정에서 다른 직불 예금주는 DB 쓰기 전에 거부한다', async () => {
    await expect(manpowerService.addWorker({ ...worker, directPayAccountHolder: '다른사람' })).rejects.toThrow('예금주');
    await expect(manpowerService.updateWorker('one', { directPayAccountHolder: '다른사람' })).rejects.toThrow('예금주');
    expect(workerFirestoreService.addWorker).not.toHaveBeenCalled();
    expect(workerFirestoreService.updateWorker).not.toHaveBeenCalled();
});
test('현재 DB 이름과 다르면 저장을 거부하고 기본 예금주 변경은 허용한다', async () => {
    await expect(manpowerService.updateWorker('one', { directPayAccountHolder: '이전이름' })).rejects.toThrow('예금주');
    await manpowerService.updateWorker('one', { accountHolder: '다른사람' });
    expect(workerFirestoreService.updateWorker).toHaveBeenCalledWith('one', expect.objectContaining({ accountHolder: '다른사람' }));
});
test('일괄 수정 중 한 명이라도 직불 예금주가 다르면 배치 전체를 쓰지 않는다', async () => {
    await expect(manpowerService.updateWorkersBatch([
        { id: 'one', updates: { accountHolder: '다른사람' } },
        { id: 'two', updates: { directPayAccountHolder: '다른사람' } },
    ])).rejects.toThrow('예금주');
    expect(writeBatch).not.toHaveBeenCalled();
});
test('일치하는 직불 예금주와 다른 기본 예금주의 일괄 수정은 저장한다', async () => {
    const batch = { update: jest.fn(), commit: jest.fn().mockResolvedValue(undefined) };
    (writeBatch as jest.Mock).mockReturnValue(batch);
    await manpowerService.updateWorkersBatch(['one'], { directPayAccountHolder: '가상 작업자', accountHolder: '다른사람' });
    expect(batch.update).toHaveBeenCalledWith({ id: 'one' }, expect.objectContaining({ directPayAccountHolder: '가상 작업자', accountHolder: '다른사람' }));
    expect(batch.commit).toHaveBeenCalledTimes(1);
});
