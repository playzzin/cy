import { httpsCallable } from 'firebase/functions';
import { advanceRequestService, type AdvanceRequestCreateInput } from './advanceRequestService';

jest.mock('../config/firebase', () => ({ db: {}, functions: {}, auth: { currentUser: { uid: 'requester' } } }));
jest.mock('./teamScopedReadService', () => ({ getTeamScopedRows: jest.fn() }));
jest.mock('firebase/functions', () => ({ httpsCallable: jest.fn() }));

test.each(['first', 'second'] as const)('%s 분류를 신청 금액과 함께 서버에 전달한다', async category => {
    const call = jest.fn().mockResolvedValue({ data: { id: 'saved', category } });
    (httpsCallable as jest.Mock).mockReturnValue(call);
    await expect(advanceRequestService.createRequest({ workerId: 'worker', yearMonth: '2026-10', requestedAmount: 10000, category, memo: '신청' } as AdvanceRequestCreateInput, 'retry-id')).resolves.toBe('saved');
    expect(call).toHaveBeenCalledWith({ action: 'create', requestId: 'retry-id', workerId: 'worker', yearMonth: '2026-10', requestedAmount: 10000, category, memo: '신청' });
});

test.each([undefined, 'other'])('서버가 1회차 저장을 확인하지 않으면 성공으로 처리하지 않는다 (%s)', async category => {
    (httpsCallable as jest.Mock).mockReturnValue(jest.fn().mockResolvedValue({ data: { id: 'saved', category } }));
    await expect(advanceRequestService.createRequest({ workerId: 'worker', yearMonth: '2026-10', requestedAmount: 10000, category: 'first' } as AdvanceRequestCreateInput, 'retry-id')).rejects.toThrow('request-category-not-saved');
});

test('기존 신청의 분류와 기대값만 서버에 보내 수정한다', async () => {
    const call = jest.fn().mockResolvedValue({ data: { id: 'saved', category: 'first' } });
    (httpsCallable as jest.Mock).mockReturnValue(call);
    await advanceRequestService.setCategory('saved', 'first', 'unclassified');
    expect(call).toHaveBeenCalledWith({ action: 'setCategory', id: 'saved', category: 'first', expectedCategory: 'unclassified' });
});

test('선입금을 일반 신청으로 제출할 수 없고 수기 저장에는 충돌 확인 금액을 보낸다', async () => {
    const call = jest.fn().mockResolvedValue({ data: { id: 'saved' } });
    (httpsCallable as jest.Mock).mockReturnValue(call);
    await expect(advanceRequestService.createRequest({ category: 'other' } as AdvanceRequestCreateInput)).rejects.toThrow('신청 회차');
    expect(call).not.toHaveBeenCalled();
    await advanceRequestService.setPrepayment('worker', '2026-10', 30000, 10000);
    expect(call).toHaveBeenCalledWith({ action: 'setPrepayment', workerId: 'worker', yearMonth: '2026-10', amount: 30000, expectedAmount: 10000 });
});
