import { reviewPayroll, reviewTransferTotals, type PayrollReviewRow } from './payrollReview';

const row = (changes: Partial<PayrollReviewRow> = {}): PayrollReviewRow => ({
    id: 'payment-1', workerId: 'worker-1', workerName: '검증 작업자', teamId: 'team-1', teamName: '검증팀', month: '2026-09', salaryModel: 'monthly',
    totalManDay: 10, grossAmount: 1000000, personalDeduction: 100000, taxDeduction: 30000, totalDeduction: 130000, netAmount: 870000,
    deductionLineTotal: 100000, bankCode: '004', accountNumber: 'test-account', accountHolder: '검증 작업자', isValid: true, ...changes,
});

describe('payroll review', () => {
    it('accepts reconciled amounts without modifying its inputs', () => {
        const input = Object.freeze(row());
        expect(reviewPayroll([input]).issues).toEqual([]);
    });
    it('detects a wrong net amount even when account validation succeeded', () => {
        expect(reviewPayroll([row({ netAmount: 860000 })]).issues[0].title).toBe('총급여와 실지급액 차이');
    });
    it('detects deduction detail mismatch and invalid numeric values', () => {
        expect(reviewPayroll([row({ deductionLineTotal: 90000 })]).errorCount).toBe(1);
        expect(reviewPayroll([row({ grossAmount: Number.NaN })]).issues[0].title).toBe('금액을 읽을 수 없음');
    });
    it('detects duplicate identity but permits different months, teams and salary types', () => {
        expect(reviewPayroll([row(), row({ id: 'other-id' })]).errorCount).toBe(1);
        expect(reviewPayroll([row(), row({ month: '2026-08' }), row({ teamId: 'team-2' }), row({ salaryModel: 'daily' })]).issues).toEqual([]);
    });
    it('treats missing account details as a warning because representative accounts may be used', () => {
        const result = reviewPayroll([row({ accountNumber: '', accountHolder: '' })]);
        expect(result.warningCount).toBe(1);
        expect(result.errorCount).toBe(0);
        expect(result.issues[0].detail).toContain('예금주');
    });
    it('compares drafts against saved amounts and preserves finalized snapshots', () => {
        const saved = { grossAmount: 1000000, totalDeduction: 120000, netAmount: 880000 };
        expect(reviewPayroll([row({ saved })]).issues[0].title).toBe('저장본과 현재 금액이 다름');
        expect(reviewPayroll([row({ saved, isSnapshot: true })]).issues).toEqual([]);
    });
    it('detects negative payments without treating zero payments as missing bank details', () => {
        expect(reviewPayroll([row({ totalDeduction: 1130000, personalDeduction: 1100000, deductionLineTotal: 1100000, netAmount: -130000 })]).issues[0].title).toBe('공제액이 급여보다 큼');
        expect(reviewPayroll([row({ grossAmount: 130000, netAmount: 0, bankCode: '', accountNumber: '' })]).issues).toEqual([]);
    });
});

describe('bank download reconciliation', () => {
    const sources = [{ sourceRowId: 'a', amount: 100 }, { sourceRowId: 'b', amount: 200 }, { sourceRowId: 'zero', amount: 0 }];
    it('counts excluded bank errors against the amount selected for transfer', () => {
        expect(reviewTransferTotals(sources, [{ sourceRowId: 'a', amount: 100, validationErrors: [] }, { sourceRowId: 'b', amount: 200, validationErrors: ['bankCode'] }])).toMatchObject({ expected: 300, downloadable: 100, difference: 200, matches: false });
    });
    it('compares identities as well as totals', () => {
        expect(reviewTransferTotals(sources, [{ sourceRowId: 'a', amount: 100, validationErrors: [] }, { sourceRowId: 'wrong', amount: 200, validationErrors: [] }]).matches).toBe(false);
        expect(reviewTransferTotals(sources, sources.slice(0, 2).map(item => ({ ...item, validationErrors: [] }))).matches).toBe(true);
        expect(reviewTransferTotals([{ sourceRowId: 'a', amount: 100 }], [{ sourceRowId: 'a', amount: 50, validationErrors: [] }, { sourceRowId: 'a', amount: 50, validationErrors: [] }]).matches).toBe(false);
    });
});
