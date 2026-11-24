import { runTransaction, serverTimestamp, Timestamp } from 'firebase/firestore';
import { monthlyPayrollSettlementService, MonthlyPayrollSettlementSaveInput } from './monthlyPayrollSettlementService';

jest.mock('../config/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({
    ...jest.requireActual('firebase/firestore'),
    doc: (_db: unknown, collection: string, id: string) => ({ path: `${collection}/${id}` }),
    runTransaction: jest.fn(),
}));

const transaction = { get: jest.fn(), set: jest.fn(), update: jest.fn() };
const side = { carry: 0, carrySecond: 0, currentAdvance: 1200000, currentAdvanceSecond: 0, lodging: 0,
    electricity: 0, gas: 0, water: 0, internet: 0, management: 0, fine: 0, other: 0 };
const sourceTimestamp = Timestamp.fromDate(new Date('2026-11-10T01:00:00Z'));
const sourceDate = new Date('2026-11-10T01:00:00Z');
const draft: MonthlyPayrollSettlementSaveInput = {
    year: 2026, yearMonth: '2026-10', teamId: 'fixture-team', teamName: '검증팀', reportingType: 'labor',
    calculationOptions: { insuranceApplied: false, insuranceTeamSiteOnly: false, businessIncomeApplied: false, utilitiesApplied: false, dailyFeeApplied: false },
    businessIncomeAppliedAmount: 0, businessIncomeTaxAmount: 0,
    rows: [{ rowKey: 'fixture-row', yearMonth: '2026-10', teamId: 'fixture-team', teamName: '검증팀',
        workerId: 'fixture-worker', workerName: '가상작업자', salaryModel: '월급제', grossAmount: 3000000, netAmount: 1800000,
        manualInput: { invoice: side, labor: side, personalMemo: '', allocationMode: undefined },
        businessIncome: { appliedAmount: 0, appliedManDay: 0, incomeTax: 0, residentTax: 0, totalTax: 0, incomeTaxRate: 0, residentTaxRate: 0 },
        paymentSnapshot: { sourceTimestamp, sourceDate, optional: undefined, nested: { optional: undefined, amount: 1200000 } },
    }],
};

beforeEach(() => {
    jest.clearAllMocks();
    transaction.get.mockResolvedValue({ exists: () => false, data: () => undefined });
    (runTransaction as jest.Mock).mockImplementation(async (_db, callback) => callback(transaction));
});

it('초안 저장 시 실제 Firestore 서버 시각을 전달하고 중첩된 날짜는 보존한다', async () => {
    await monthlyPayrollSettlementService.saveSettlements([draft]);
    const payload = transaction.set.mock.calls[0][1];
    expect(payload.updatedAt.isEqual(serverTimestamp())).toBe(true);
    expect(payload.draftRevision).toBe(1);
    expect(payload.rows[0].paymentSnapshot.sourceTimestamp).toBe(sourceTimestamp);
    expect(payload.rows[0].paymentSnapshot.sourceDate).toBe(sourceDate);
    expect(payload.rows[0].paymentSnapshot).not.toHaveProperty('optional');
    expect(payload.rows[0].paymentSnapshot.nested).toEqual({ amount: 1200000 });
    expect(payload.rows[0].manualInput).not.toHaveProperty('allocationMode');
    expect(runTransaction).toHaveBeenCalledTimes(1);
});

it.each([
    ['draft', 'reviewed', 'reviewedAt'],
    ['reviewed', 'confirmed', 'confirmedAt'],
    ['confirmed', 'paid', 'paidAt'],
] as const)('%s → %s 변경 시 상태 시각과 수정 시각을 정상 저장한다', async (current, next, field) => {
    transaction.get.mockResolvedValue({ exists: () => true, data: () => ({ runStatus: current }) });
    await monthlyPayrollSettlementService.transitionRunStatus(['fixture-settlement'], next);
    const payload = transaction.update.mock.calls[0][1];
    expect(payload.updatedAt.isEqual(serverTimestamp())).toBe(true);
    expect(payload[field].isEqual(serverTimestamp())).toBe(true);
    expect(payload.runStatus).toBe(next);
});

it('확정된 급여 저장본은 가불 수정으로 덮어쓰지 않는다', async () => {
    transaction.get.mockResolvedValue({ exists: () => true, data: () => ({ runStatus: 'confirmed' }) });
    await expect(monthlyPayrollSettlementService.saveSettlements([draft])).rejects.toThrow('저장본을 덮어쓸 수 없습니다');
    expect(transaction.set).not.toHaveBeenCalled();
});

it('메모만 저장할 때 다른 PC가 저장한 분류를 덮어쓸 수 없다', async () => {
    const row = draft.rows[0];
    transaction.get.mockResolvedValue({ data: () => ({ rows: [
        { ...row, manualInput: { ...row.manualInput, allocationMode: 'labor' } },
    ] }) });
    const stale = { ...draft, rows: [{ ...row, manualInput: { ...row.manualInput, personalMemo: '수정' } }] };
    await expect(monthlyPayrollSettlementService.saveSettlements([stale])).rejects.toThrow('다시 조회');
    const staleChoice = new Map([[row.rowKey, { from: 'corporate', to: 'split' } as const]]);
    await expect(monthlyPayrollSettlementService.saveSettlements([stale], {}, staleChoice)).rejects.toThrow('다시 조회');
    expect(transaction.set).not.toHaveBeenCalled();
});

it('팀원이 추가된 최신 초안을 옛 화면의 행 목록으로 덮어쓰지 않는다', async () => {
    transaction.get.mockResolvedValue({ data: () => ({ draftRevision: 1, rows: [
        ...draft.rows, { ...draft.rows[0], rowKey: 'new-worker' },
    ] }) });
    await expect(monthlyPayrollSettlementService.saveSettlements([draft], {}, new Map(), [
        { ...draft, runStatus: 'draft' },
    ])).rejects.toThrow('다른 화면에서 변경');
    expect(transaction.set).not.toHaveBeenCalled();
});

it.each(['split', 'corporate'] as const)('담당자가 노무를 %s로 직접 바꾸면 새 분류를 저장한다', async (next) => {
    const row = draft.rows[0];
    transaction.get.mockResolvedValue({ data: () => ({ rows: [
        { ...row, manualInput: { ...row.manualInput, allocationMode: 'labor' } },
    ] }) });
    const changed = { ...draft, rows: [{ ...row, manualInput: { ...row.manualInput, allocationMode: next } }] };
    const choice = new Map([[row.rowKey, { from: 'labor', to: next } as const]]);
    await monthlyPayrollSettlementService.saveSettlements([changed], {}, choice);
    expect(transaction.set.mock.calls[0][1].rows[0].manualInput.allocationMode).toBe(next);
});
