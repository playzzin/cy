import { getDoc, runTransaction } from 'firebase/firestore';
import { supportLedgerMemoService } from './supportLedgerMemoService';
jest.mock('../config/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({ doc: jest.fn((_db, _collection, id) => id), getDoc: jest.fn(), runTransaction: jest.fn(), serverTimestamp: () => 'now' }));
const transaction = { get: jest.fn(), set: jest.fn() };
beforeEach(() => { jest.resetAllMocks(); jest.mocked(runTransaction).mockImplementation(async (_db, callback) => callback(transaction as any)); });
test('빈 비고와 미작성 비고를 구분한다', async () => {
  jest.mocked(getDoc).mockResolvedValue({ exists: () => false } as any);
  expect(await supportLedgerMemoService.read('card:month:row')).toBeNull();
  jest.mocked(getDoc).mockResolvedValue({ exists: () => true, data: () => ({ memo: '' }) } as any);
  expect(await supportLedgerMemoService.read('card:month:row')).toBe('');
});
test('다른 사용자가 변경한 비고를 덮어쓰지 않는다', async () => {
  transaction.get.mockResolvedValue({ exists: () => true, data: () => ({ memo: '다른 수정' }) });
  await expect(supportLedgerMemoService.save('card:month:row', '내 수정', '이전')).rejects.toThrow('다른 사용자');
  expect(transaction.set).not.toHaveBeenCalled();
});
test('빈 문자열도 저장하고 금액 필드를 쓰지 않는다', async () => {
  transaction.get.mockResolvedValue({ exists: () => true, data: () => ({ memo: '이전' }) });
  await supportLedgerMemoService.save('card:month:row', '', '이전');
  expect(transaction.set.mock.calls[0][1]).toEqual({ kind: 'support_ledger_memo', memo: '', updatedAt: 'now' });
});
