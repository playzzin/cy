import { doc, runTransaction } from 'firebase/firestore';
import { advancePaymentDepositAccountService, AdvancePaymentDepositAccountError } from './advancePaymentDepositAccountService';

jest.mock('../config/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({
    doc: jest.fn((_db, collection, id) => `${collection}/${id}`), runTransaction: jest.fn(), serverTimestamp: () => 'selection-time',
}));
const transaction = { get: jest.fn(), update: jest.fn() };
beforeEach(() => {
    jest.clearAllMocks();
    (doc as jest.Mock).mockImplementation((_db, collection, id) => `${collection}/${id}`);
    (runTransaction as jest.Mock).mockImplementation(async (_db, callback) => callback(transaction));
});

test('선택값만 저장하고 금액·비고·급여 우선순위 시각은 변경하지 않는다', async () => {
    transaction.get.mockResolvedValue({ exists: () => true, data: () => ({ items: { laborAdvance1: 50000 }, memo: '유지할 비고', updatedAt: 'financial-time' }) });
    await advancePaymentDepositAccountService.save([{ id: 'original', expectedDepositAccount: '', depositAccount: 'corporate' }]);
    expect(doc).toHaveBeenCalledWith({}, 'advance_payments', 'original');
    expect(transaction.update).toHaveBeenCalledWith('advance_payments/original', { depositAccount: 'corporate', depositAccountUpdatedAt: 'selection-time' });
});

test('신청 요약의 입금계좌는 가불관리 대신 신청 원본에만 저장한다', async () => {
    transaction.get.mockResolvedValue({ exists: () => true, data: () => ({ depositAccount: '' }) });
    await advancePaymentDepositAccountService.save([{ id: 'request', expectedDepositAccount: '', depositAccount: 'other' }], 'advance_requests');
    expect(doc).toHaveBeenCalledWith({}, 'advance_requests', 'request');
    expect(transaction.update).toHaveBeenCalledWith('advance_requests/request', { depositAccount: 'other', depositAccountUpdatedAt: 'selection-time' });
});

test('합산한 원본을 모두 읽은 뒤 같은 선택을 저장하고 선택을 해제할 수 있다', async () => {
    transaction.get.mockResolvedValue({ exists: () => true, data: () => ({ depositAccount: 'dawon' }) });
    await advancePaymentDepositAccountService.save([
        { id: 'daily', expectedDepositAccount: 'dawon', depositAccount: '' },
        { id: 'monthly', expectedDepositAccount: 'dawon', depositAccount: '' },
    ]);
    expect(transaction.update).toHaveBeenCalledTimes(2);
    expect(Math.max(...transaction.get.mock.invocationCallOrder)).toBeLessThan(Math.min(...transaction.update.mock.invocationCallOrder));
    expect(transaction.update).toHaveBeenLastCalledWith('advance_payments/monthly', { depositAccount: '', depositAccountUpdatedAt: 'selection-time' });
});

test('원본 하나라도 변경되면 선택을 일부만 저장하거나 덮어쓰지 않는다', async () => {
    transaction.get.mockResolvedValueOnce({ exists: () => true, data: () => ({ depositAccount: 'cheongyeon' }) })
        .mockResolvedValueOnce({ exists: () => true, data: () => ({ depositAccount: 'personal' }) });
    await expect(advancePaymentDepositAccountService.save([
        { id: 'daily', expectedDepositAccount: 'cheongyeon', depositAccount: 'dawon' },
        { id: 'monthly', expectedDepositAccount: '', depositAccount: 'dawon' },
    ])).rejects.toThrow('다른 화면');
    expect(transaction.update).not.toHaveBeenCalled();
});

test('삭제된 원본을 재생성하지 않는다', async () => {
    transaction.get.mockResolvedValue({ exists: () => false });
    await expect(advancePaymentDepositAccountService.save([{ id: 'deleted', expectedDepositAccount: '', depositAccount: 'personal' }])).rejects.toThrow('삭제');
    expect(transaction.update).not.toHaveBeenCalled();
});

test('알 수 없는 선택·중복 ID·잘못된 경로를 저장하지 않는다', async () => {
    const change = { id: 'record', expectedDepositAccount: '' as const, depositAccount: 'dawon' as const };
    for (const changes of [[change, change], [{ ...change, id: 'invalid/path' }], [{ ...change, depositAccount: 'unknown' }], [{ ...change, expectedDepositAccount: 'unknown' }]]) {
        await expect(advancePaymentDepositAccountService.save(changes as any)).rejects.toBeInstanceOf(AdvancePaymentDepositAccountError);
    }
    await advancePaymentDepositAccountService.save([]);
    expect(runTransaction).not.toHaveBeenCalled();
});

test('저장 권한·연결 오류를 숨기지 않는다', async () => {
    (runTransaction as jest.Mock).mockRejectedValueOnce({ code: 'permission-denied' });
    await expect(advancePaymentDepositAccountService.save([{ id: 'record', expectedDepositAccount: '', depositAccount: 'dawon' }])).rejects.toEqual({ code: 'permission-denied' });
});
