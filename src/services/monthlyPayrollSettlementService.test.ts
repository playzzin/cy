import { getDoc, runTransaction, serverTimestamp, Timestamp, writeBatch } from 'firebase/firestore';
import { monthlyPayrollSettlementService, MonthlyPayrollSettlementSaveInput } from './monthlyPayrollSettlementService';

jest.mock('../config/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({
    ...jest.requireActual('firebase/firestore'),
    doc: (_db: unknown, collection: string, id: string) => ({ path: `${collection}/${id}` }),
    getDoc: jest.fn(),
    writeBatch: jest.fn(),
    runTransaction: jest.fn(),
}));

const batch = { set: jest.fn(), commit: jest.fn().mockResolvedValue(undefined) };
const transaction = { get: jest.fn(), update: jest.fn() };
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
    (getDoc as jest.Mock).mockResolvedValue({ exists: () => false });
    (writeBatch as jest.Mock).mockReturnValue(batch);
    batch.commit.mockResolvedValue(undefined);
    (runTransaction as jest.Mock).mockImplementation(async (_db, callback) => callback(transaction));
});

it('초안 저장 시 실제 Firestore 서버 시각을 전달하고 중첩된 날짜는 보존한다', async () => {
    await monthlyPayrollSettlementService.saveSettlements([draft]);
    const payload = batch.set.mock.calls[0][1];
    expect(payload.updatedAt.isEqual(serverTimestamp())).toBe(true);
    expect(payload.rows[0].paymentSnapshot.sourceTimestamp).toBe(sourceTimestamp);
    expect(payload.rows[0].paymentSnapshot.sourceDate).toBe(sourceDate);
    expect(payload.rows[0].paymentSnapshot).not.toHaveProperty('optional');
    expect(payload.rows[0].paymentSnapshot.nested).toEqual({ amount: 1200000 });
    expect(payload.rows[0].manualInput).not.toHaveProperty('allocationMode');
    expect(batch.commit).toHaveBeenCalledTimes(1);
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
    (getDoc as jest.Mock).mockResolvedValue({ exists: () => true, data: () => ({ runStatus: 'confirmed' }) });
    await expect(monthlyPayrollSettlementService.saveSettlements([draft])).rejects.toThrow('저장본을 덮어쓸 수 없습니다');
    expect(batch.set).not.toHaveBeenCalled();
});
