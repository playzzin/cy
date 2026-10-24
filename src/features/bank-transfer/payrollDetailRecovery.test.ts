import { recoverSavedPayrollDetail } from './payrollDetailRecovery';
import type { MonthlyPayrollSettlement } from '../../services/monthlyPayrollSettlementService';
import type { TransferCandidate } from './types';
jest.mock('../../services/monthlyPayrollSettlementService', () => ({ monthlyPayrollSettlementService: { getSettlementsByYear: jest.fn() } }));
const target = { source: 'payroll', id: 'payroll:worker-row:totalAmount', sourceId: 'worker-row', period: '2026-09', amount: 90000 } as TransferCandidate;
const settlement = { yearMonth: '2026-09', runStatus: 'confirmed', rows: [{ rowKey: 'worker-row', salaryModel: '일급제', netAmount: 96700, invoiceNetAmount: 60000, laborNetAmount: 36700,
    paymentSnapshot: { id: 'worker-row', month: '2026-09', grossAmount: 100000, totalDeduction: 3300, totalAmount: 96700,
        workEntries: [{ date: '2026-09-01', siteName: '검증현장', manDay: 0.5, unitPrice: 200000, amount: 100000 }] } }] } as unknown as MonthlyPayrollSettlement;

it('기존 이체금액과 무관하게 정확한 월·원본·기준의 저장 상세를 복원한다', () => {
    const result = recoverSavedPayrollDetail(target, [settlement]);
    expect(result.detail).toMatchObject({ originalAmount: 96700, netAmount: 96700, restoredFromSource: true, isFinalized: true });
    expect(result.detail.workEntries[0].siteName).toBe('검증현장');
    expect(target.amount).toBe(90000);
    expect(recoverSavedPayrollDetail({ ...target, id: 'payroll:worker-row:invoiceNet' }, [settlement]).detail.originalAmount).toBe(60000);
});
it('지급완료 원본의 상세 조회는 허용하되 중복 지급 주의를 반환한다', () => {
    expect(recoverSavedPayrollDetail(target, [{ ...settlement, runStatus: 'paid' }]).warning).toContain('지급완료');
});
it.each(['다른월', '다른원본', '중복원본', '금액불일치', '기준불명', '스냅샷누락'])('%s의 원본을 임의로 연결하지 않는다', reason => {
    const data = JSON.parse(JSON.stringify(settlement)) as MonthlyPayrollSettlement;
    const row = { ...target };
    if (reason === '다른월') data.yearMonth = '2026-10';
    if (reason === '다른원본') row.sourceId = 'different';
    if (reason === '금액불일치') data.rows[0].netAmount = 1;
    if (reason === '기준불명') row.id = 'payroll:worker-row:laborAdvance2';
    if (reason === '스냅샷누락') delete data.rows[0].paymentSnapshot;
    expect(() => recoverSavedPayrollDetail(row, reason === '중복원본' ? [data, data] : [data])).toThrow();
});
