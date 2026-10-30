import { doc, runTransaction } from 'firebase/firestore';
import { advancePaymentMemoService, AdvancePaymentMemoError } from './advancePaymentMemoService';

jest.mock('../config/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({
    doc: jest.fn((_db, collection, id) => `${collection}/${id}`), runTransaction: jest.fn(), serverTimestamp: () => 'memo-time',
}));
const transaction = { get: jest.fn(), update: jest.fn() };
beforeEach(() => {
    jest.clearAllMocks();
    (doc as jest.Mock).mockImplementation((_db, collection, id) => `${collection}/${id}`);
    (runTransaction as jest.Mock).mockImplementation(async (_db, callback) => callback(transaction));
});

test('비고만 저장하고 가불 금액과 급여 우선순위에 쓰이는 updatedAt은 보존한다', async () => {
    const stored = { memo: '원래 비고', items: { laborAdvance1: 50000 }, totalDeduction: 70000, updatedAt: 'financial-time' };
    transaction.get.mockResolvedValue({ exists: () => true, data: () => stored });
    await advancePaymentMemoService.save([{ id: 'original-id', expectedMemo: '원래 비고', memo: '새 비고\n둘째 줄' }]);
    expect(doc).toHaveBeenCalledWith({}, 'advance_payments', 'original-id');
    expect(transaction.update).toHaveBeenCalledWith('advance_payments/original-id', { memo: '새 비고\n둘째 줄', memoUpdatedAt: 'memo-time' });
    expect({ ...stored, ...transaction.update.mock.calls[0][1] }).toMatchObject({
        items: { laborAdvance1: 50000 }, totalDeduction: 70000, updatedAt: 'financial-time', memo: '새 비고\n둘째 줄',
    });
});

test('빈 비고도 저장하여 기존 내용을 지울 수 있다', async () => {
    transaction.get.mockResolvedValue({ exists: () => true, data: () => ({ memo: '원래 비고' }) });
    await advancePaymentMemoService.save([{ id: 'record', expectedMemo: '원래 비고', memo: '' }]);
    expect(transaction.update).toHaveBeenCalledWith('advance_payments/record', { memo: '', memoUpdatedAt: 'memo-time' });
});

test('신청 요약의 비고는 가불관리 대신 신청 원본에만 저장한다', async () => {
    transaction.get.mockResolvedValue({ exists: () => true, data: () => ({ memo: '' }) });
    await advancePaymentMemoService.save([{ id: 'request', expectedMemo: '', memo: '신청 비고' }], 'advance_requests');
    expect(doc).toHaveBeenCalledWith({}, 'advance_requests', 'request');
    expect(transaction.update).toHaveBeenCalledWith('advance_requests/request', { memo: '신청 비고', memoUpdatedAt: 'memo-time' });
});

test('비고가 없었던 원본에도 추가할 수 있다', async () => {
    transaction.get.mockResolvedValue({ exists: () => true, data: () => ({ memo: null }) });
    await advancePaymentMemoService.save([{ id: 'record', expectedMemo: '', memo: '추가 비고' }]);
    expect(transaction.update).toHaveBeenCalledTimes(1);
});

test('급여 구분별 비고 중 하나라도 충돌하면 어느 비고도 덮어쓰지 않는다', async () => {
    transaction.get.mockResolvedValueOnce({ exists: () => true, data: () => ({ memo: '기존 A' }) })
        .mockResolvedValueOnce({ exists: () => true, data: () => ({ memo: '다른 화면의 수정' }) });
    await expect(advancePaymentMemoService.save([
        { id: 'daily', expectedMemo: '기존 A', memo: '수정 A' }, { id: 'monthly', expectedMemo: '기존 B', memo: '수정 B' },
    ])).rejects.toThrow('다른 화면');
    expect(transaction.update).not.toHaveBeenCalled();
});

test('삭제된 원본은 새 가불내역으로 다시 만들지 않는다', async () => {
    transaction.get.mockResolvedValue({ exists: () => false });
    await expect(advancePaymentMemoService.save([{ id: 'deleted', expectedMemo: '', memo: '추가' }])).rejects.toThrow('삭제');
    expect(transaction.update).not.toHaveBeenCalled();
});

test('문서 ID 중복과 비고 길이를 검증하고 빈 변경은 저장하지 않는다', async () => {
    const change = { id: 'same', memo: '내용', expectedMemo: '' };
    await expect(advancePaymentMemoService.save([change, change])).rejects.toBeInstanceOf(AdvancePaymentMemoError);
    await expect(advancePaymentMemoService.save([{ ...change, id: 'invalid/path' }])).rejects.toBeInstanceOf(AdvancePaymentMemoError);
    await expect(advancePaymentMemoService.save([{ ...change, memo: '가'.repeat(4001) }])).rejects.toThrow('4,000');
    await advancePaymentMemoService.save([]);
    expect(runTransaction).not.toHaveBeenCalled();
});

test('저장 권한과 연결 오류를 호출자에게 전달한다', async () => {
    (runTransaction as jest.Mock).mockRejectedValue({ code: 'permission-denied' });
    await expect(advancePaymentMemoService.save([{ id: 'record', expectedMemo: '', memo: '내용' }])).rejects.toEqual({ code: 'permission-denied' });
});
