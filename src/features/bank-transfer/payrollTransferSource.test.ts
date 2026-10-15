import { monthlyPayrollSettlementService, type MonthlyPayrollSettlement } from '../../services/monthlyPayrollSettlementService';
import type { KBTransferRow } from '../../pages/payroll/MonthlyWageModel';
import { buildPayrollPreviewCandidates, loadPayrollTransferCandidates } from './payrollTransferSource';
import { buildPayrollTransferDetail } from './payrollTransferDetail';

jest.mock('../../services/monthlyPayrollSettlementService', () => ({
    monthlyPayrollSettlementService: { getSettlementsByYear: jest.fn() },
}));

const payment = {
    id: '2026-10__fixture-worker__fixture-team__월급제', month: '2026-10',
    workerName: '검증작업자', teamName: '검증팀', totalAmount: 96700,
    bankName: '국민은행', bankCode: '004', accountNumber: '000123456789', accountHolder: '검증예금주',
};
const settlement = (overrides: Partial<MonthlyPayrollSettlement> = {}): MonthlyPayrollSettlement => ({
    id: 'fixture-settlement', year: 2026, yearMonth: '2026-10', teamId: 'fixture-team', teamName: '검증팀',
    reportingType: 'business_income', runStatus: 'confirmed',
    calculationOptions: { insuranceApplied: false, insuranceTeamSiteOnly: false, businessIncomeApplied: true, utilitiesApplied: true, dailyFeeApplied: false },
    businessIncomeAppliedAmount: 100000, businessIncomeTaxAmount: 3300,
    rows: [{
        rowKey: payment.id, yearMonth: '2026-10', teamId: 'fixture-team', teamName: '검증팀',
        workerId: 'fixture-worker', workerName: '검증작업자', salaryModel: '월급제',
        grossAmount: 100000, netAmount: 96700, paymentSnapshot: { ...payment },
        manualInput: { invoice: {} as never, labor: {} as never, personalMemo: '' },
        businessIncome: { appliedAmount: 100000, appliedManDay: 1, incomeTax: 3000, residentTax: 300, totalTax: 3300, incomeTaxRate: 0.03, residentTaxRate: 0.003 },
    }],
    ...overrides,
});
const loadMock = monthlyPayrollSettlementService.getSettlementsByYear as jest.Mock;

beforeEach(() => jest.clearAllMocks());

it('저장 스냅샷의 세후 금액·계좌를 사용하고 다른 월을 제외한다', async () => {
    loadMock.mockResolvedValue([settlement(), settlement({ yearMonth: '2026-09' })]);
    const result = await loadPayrollTransferCandidates('2026-10');
    expect(loadMock).toHaveBeenCalledWith(2026);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]).toMatchObject({
        id: `payroll:${payment.id}:totalAmount`, source: 'payroll', sourceId: payment.id,
        amount: 96700, accountNumber: '000123456789', accountHolder: '검증예금주', bankCode: '004',
    });
    expect(result.candidates[0].receiverDisplay).toBeUndefined();
    expect(result.candidates[0].senderMemo).toBeUndefined();
});

it('저장되지 않은 급여는 추정 계산하지 않고 미리보기 가져오기를 안내한다', async () => {
    loadMock.mockResolvedValue([]);
    const result = await loadPayrollTransferCandidates('2026-10');
    expect(result.candidates).toEqual([]);
    expect(result.warnings.join(' ')).toMatch(/저장된 급여가 없습니다.*송금 목록에 담기/);
});

it('paymentSnapshot이 없거나 금액 형식이 잘못된 저장본은 netAmount로 대신하지 않는다', async () => {
    const saved = settlement();
    saved.rows.push({ ...saved.rows[0], rowKey: 'second', paymentSnapshot: { ...payment, totalAmount: '96700' } });
    saved.rows[0].paymentSnapshot = undefined;
    loadMock.mockResolvedValue([saved]);
    const result = await loadPayrollTransferCandidates('2026-10');
    expect(result.candidates).toEqual([]);
    expect(result.warnings.join(' ')).toContain('불완전한 2건');
});

it('지급완료와 0원 이하를 제외하고 초안·누락 계좌는 경고로 표시한다', async () => {
    const draft = settlement({ runStatus: 'draft' });
    draft.rows[0].paymentSnapshot = { ...payment, accountNumber: '', bankName: '', bankCode: '' };
    draft.rows.push({ ...draft.rows[0], rowKey: 'zero', netAmount: 0, paymentSnapshot: { ...payment, id: 'zero', totalAmount: 0 } });
    loadMock.mockResolvedValue([draft, settlement({ runStatus: 'paid' })]);
    const result = await loadPayrollTransferCandidates('2026-10');
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].warning).toContain('확정 전 저장본');
    expect(result.candidates[0].warning).toContain('계좌번호 확인 필요');
    expect(result.warnings.join(' ')).toContain('이미 지급완료된 급여 1건');
    expect(result.warnings.join(' ')).toContain('0원 이하인 1건');
});

it('정산 행과 계산 스냅샷의 실지급액이 다르면 어느 쪽도 임의로 선택하지 않는다', async () => {
    const saved = settlement();
    saved.rows[0].netAmount = 99999;
    loadMock.mockResolvedValue([saved]);
    const result = await loadPayrollTransferCandidates('2026-10');
    expect(result.candidates).toEqual([]);
    expect(result.warnings.join(' ')).toContain('계산 스냅샷이 서로 다른 1건');
});

it('동일 급여 원본을 중복으로 가져오지 않는다', async () => {
    loadMock.mockResolvedValue([settlement(), settlement()]);
    const result = await loadPayrollTransferCandidates('2026-10');
    expect(result.candidates).toHaveLength(1);
    expect(result.warnings.join(' ')).toContain('중복');
});

it('잘못된 월은 조회하지 않으며 저장본 조회 실패를 빈 결과로 숨기지 않는다', async () => {
    await expect(loadPayrollTransferCandidates('2026-13')).rejects.toThrow('월을 선택');
    expect(loadMock).not.toHaveBeenCalled();
    loadMock.mockRejectedValue(new Error('fixture service failure'));
    await expect(loadPayrollTransferCandidates('2026-10')).rejects.toThrow('fixture service failure');
});

it('미리보기의 대표계좌·선택 금액 기준·받는분표시·메모를 재계산 없이 전달한다', () => {
    const preview: KBTransferRow = {
        payrollDetail: buildPayrollTransferDetail({ ...payment, totalDeduction: 3300, grossAmount: 100000 }, {
            salaryLabel: '월급제', amountBasis: '노무가불 2', originalAmount: 12300, isFinalized: false,
        }),
        sourceRowId: payment.id, month: '2026-10', teamName: '검증팀', workerName: '검증작업자', salaryLabel: '월급제',
        bankCode: '088', bankCodeDisplay: '088', bankCodeUnmapped: false, bankCodeNeedsFix: false,
        bankCodeReason: '', bankCodeCandidates: '', bankName: '신한은행', accountNumber: '000987654321',
        accountHolder: '검증대표계좌', amount: 12300, receiverDisplay: '검증법인', senderMemo: '검증작업자 정산',
        usesPrimaryAccount: true, validationErrors: [],
    };
    const candidates = buildPayrollPreviewCandidates([preview], 'laborAdvance2', '노무가불 2');
    expect(candidates[0]).toMatchObject({
        id: `payroll:${payment.id}:laborAdvance2`, amount: 12300, bankCode: '088',
        accountNumber: '000987654321', accountHolder: '검증대표계좌',
        receiverDisplay: '검증법인', senderMemo: '검증작업자 정산',
    });
    expect(candidates[0].detail).toContain('대표계좌 적용');
    expect(candidates[0].payrollDetail).toEqual(preview.payrollDetail);
    expect(buildPayrollPreviewCandidates([{ ...preview, validationErrors: ['bankCode'] }], 'totalAmount', '실지급액')[0].warning).toContain('은행코드');
});
