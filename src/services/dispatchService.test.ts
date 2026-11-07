import { dispatchService } from './dispatchService';
import { createDailyDispatch, getDailyDispatch, listAllDailyDispatches, updateDailyDispatch } from './firestoreCrudCompat';

jest.mock('./firestoreCrudCompat', () => ({
    createDailyDispatch: jest.fn(), updateDailyDispatch: jest.fn(), deleteDailyDispatch: jest.fn(),
    getDailyDispatch: jest.fn(), listAllDailyDispatches: jest.fn(),
}));

beforeEach(() => jest.resetAllMocks());

test('현장 카드가 없어도 날짜별 휴무자를 저장하고 재조회한다', async () => {
    let stored: Record<string, unknown> | null = null;
    (getDailyDispatch as jest.Mock).mockImplementation(async () => ({ data: { dailyDispatch: stored } }));
    (createDailyDispatch as jest.Mock).mockImplementation(async data => { stored = data; });
    await dispatchService.saveDispatch('2026-11-08', [], { offDutyWorkerIds: [' worker-a ', 'worker-a', 'worker-b'] });
    expect(await dispatchService.getDispatchByDate('2026-11-08')).toMatchObject({
        date: '2026-11-08', assignments: [], offDutyWorkerIds: ['worker-a', 'worker-b'], offDutyExcludedWorkerIds: [],
    });
});

test('기존 휴무자를 빈 목록으로 해제하고 목록 조회에도 반영한다', async () => {
    let stored = { id: '2026-11-08', date: '2026-11-08', assignments: '[]', offDutyWorkerIds: ['worker-a'] };
    (getDailyDispatch as jest.Mock).mockImplementation(async () => ({ data: { dailyDispatch: stored } }));
    (updateDailyDispatch as jest.Mock).mockImplementation(async data => { stored = { ...stored, ...data }; });
    (listAllDailyDispatches as jest.Mock).mockImplementation(async () => ({ data: { dailyDispatches: [stored] } }));
    await dispatchService.saveDispatch('2026-11-08', [], { offDutyWorkerIds: [], offDutyExcludedWorkerIds: ['worker-a'] });
    expect((await dispatchService.getAllDispatches())[0]).toMatchObject({ offDutyWorkerIds: [], offDutyExcludedWorkerIds: ['worker-a'] });
    expect(createDailyDispatch).not.toHaveBeenCalled();
});

test('다른 배정 화면에서 저장해도 날짜별 휴무자 필드를 덮어쓰지 않는다', async () => {
    (getDailyDispatch as jest.Mock).mockResolvedValue({ data: { dailyDispatch: { id: '2026-11-08', assignments: '[]', offDutyWorkerIds: ['worker-a'] } } });
    await dispatchService.saveDispatch('2026-11-08', []);
    const payload = (updateDailyDispatch as jest.Mock).mock.calls[0][0];
    expect(payload).not.toHaveProperty('offDutyWorkerIds');
    expect(payload).not.toHaveProperty('offDutyExcludedWorkerIds');
});

test('기존 저장 내용 조회 실패 시 새 문서로 덮어쓰지 않는다', async () => {
    (getDailyDispatch as jest.Mock).mockRejectedValue(new Error('offline'));
    await expect(dispatchService.saveDispatch('2026-11-08', [], { offDutyWorkerIds: ['worker-a'] })).rejects.toThrow('offline');
    expect(createDailyDispatch).not.toHaveBeenCalled();
    expect(updateDailyDispatch).not.toHaveBeenCalled();
});
