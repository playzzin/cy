import { advancePaymentService } from './advancePaymentService';
import { listAllAdvancePayments, createAdvancePayment } from './firestoreCrudCompat';
import { buildManualInputFromAdvanceRecord, resolveInitialLedgerManualInput } from '../pages/payroll/utils/advanceLedgerInput';

jest.mock('./firestoreCrudCompat', () => ({
    listAllAdvancePayments: jest.fn(),
    listAllWorkers: jest.fn(),
    listAllTeams: jest.fn(),
    createAdvancePayment: jest.fn(),
    updateAdvancePayment: jest.fn(),
    deleteAdvancePayment: jest.fn(),
}));

const listAdvances = listAllAdvancePayments as jest.Mock;
const saveAdvance = createAdvancePayment as jest.Mock;
const workerId = '00000000-0000-4000-8000-000000000001';
const teamId = '00000000-0000-4000-8000-000000000002';
const modifiedAt = new Date('2026-09-30T01:00:00.000Z');

beforeEach(() => jest.clearAllMocks());

it('새로 조회한 입금계좌 선택을 유지하고 기존 미선택 내역도 읽는다', async () => {
    listAdvances.mockResolvedValue({ data: { advancePayments: ['cheongyeon', 'dawon', 'personal', undefined, 'unknown'].map((depositAccount, index) => ({
        id: `account-${index}`, workerId, teamId, yearMonth: '2026-10', depositAccount,
    })) } });
    const records = await advancePaymentService.getAdvancePaymentsByYearMonth(2026, 10);
    expect(records.map(record => record.depositAccount)).toEqual(['cheongyeon', 'dawon', 'personal', '', '']);
});

it.each([
    ['ISO', modifiedAt.toISOString()],
    ['Date', modifiedAt],
    ['Timestamp', { toDate: () => modifiedAt }],
    ['직렬화된 Timestamp', { seconds: modifiedAt.getTime() / 1000, nanoseconds: 0 }],
    ['서버 Timestamp', { _seconds: modifiedAt.getTime() / 1000, _nanoseconds: 0 }],
])('%s 저장 시각을 보존하여 최신 가불 수정액을 기존 초안에 반영한다', async (_, updatedAt) => {
    listAdvances.mockResolvedValue({ data: { advancePayments: [{
        id: 'advance-1', workerId, teamId, yearMonth: '2026-09',
        items: JSON.stringify({ laborAdvance3: 200000 }), updatedAt,
    }] } });
    const [record] = await advancePaymentService.getAdvancePaymentsByYearMonth(2026, 9);
    expect(record.updatedAt).toEqual(modifiedAt);
    const current = buildManualInputFromAdvanceRecord(record)!;
    const draft = { ...current, labor: { ...current.labor, currentAdvance: 500000 } };
    expect(resolveInitialLedgerManualInput({
        advanceInput: current, advanceUpdatedAt: record.updatedAt,
        settlementInput: draft, settlementUpdatedAt: '2026-09-29T01:00:00.000Z',
        settlementStatus: 'draft',
    })?.labor.currentAdvance).toBe(200000);
});

it('신규 저장 후 같은 가불을 감소·0원으로 수정해도 다시 조회하면 수정액이 남는다', async () => {
    const stored = new Map<string, unknown>();
    saveAdvance.mockImplementation(async (payload) => { stored.set(payload.id, payload); });
    listAdvances.mockImplementation(async () => ({ data: { advancePayments: [...stored.values()] } }));
    for (const amount of [500000, 200000, 0]) {
        await advancePaymentService.saveAdvancePayment({
            workerId, workerName: '테스트 근로자', teamId, teamName: '테스트팀',
            yearMonth: '2026-09', salaryModel: '월급제',
            items: { laborAdvance3: amount }, totalDeduction: amount,
            prevMonthCarryover: 0, accommodation: 0, privateRoom: 0, gloves: 0,
            deposit: 0, fines: 0, electricity: 0, gas: 0, internet: 0, water: 0,
        });
        const records = await advancePaymentService.getAdvancePaymentsByYearMonth(2026, 9);
        expect(records).toHaveLength(1);
        expect(buildManualInputFromAdvanceRecord(records[0])?.labor.currentAdvance).toBe(amount);
    }
});
