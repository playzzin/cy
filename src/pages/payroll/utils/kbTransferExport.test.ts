import {
    filterKBPaymentRows,
    formatKBTransferMemo,
    getKBAmountTypeLabel,
    resolveKBSalaryFilterFromPaymentId,
    summarizeKBTransferRows,
    validateKBTransferRow,
} from './kbTransferExport';

describe('kbTransferExport', () => {
    it('filters payment rows by the ledger salary model filter', () => {
        const rows = [
            { id: '2026-06__w1__t1__월급제', name: '월급' },
            { id: '2026-06__w2__t1__일급제', name: '일급' },
            { id: '2026-06__w3__t1__용역팀', name: '용역' },
        ];

        expect(filterKBPaymentRows(rows, { pageViewMode: 'ledger', ledgerSalaryModelFilter: 'monthly' })).toEqual([rows[0]]);
        expect(filterKBPaymentRows(rows, { pageViewMode: 'ledger', ledgerSalaryModelFilter: 'daily' })).toEqual([rows[1]]);
        expect(filterKBPaymentRows(rows, { pageViewMode: 'ledger', ledgerSalaryModelFilter: 'service' })).toEqual([rows[2]]);
        expect(filterKBPaymentRows(rows, { pageViewMode: 'standard', ledgerSalaryModelFilter: 'monthly' })).toEqual(rows);
    });

    it('resolves salary model from payment row ids', () => {
        expect(resolveKBSalaryFilterFromPaymentId('a__b__c__월급제')).toBe('monthly');
        expect(resolveKBSalaryFilterFromPaymentId('a__b__c__일급제')).toBe('daily');
        expect(resolveKBSalaryFilterFromPaymentId('a__b__c__용역팀')).toBe('service');
    });

    it('formats transfer memo templates', () => {
        expect(formatKBTransferMemo('{이름} 가불', '홍길동')).toBe('홍길동 가불');
        expect(formatKBTransferMemo(' 급여', '홍길동')).toBe('홍길동 급여');
        expect(formatKBTransferMemo('', '홍길동')).toBe('홍길동');
        expect(formatKBTransferMemo('월급', '홍길동')).toBe('월급');
    });

    it('validates blocking bank transfer fields', () => {
        expect(validateKBTransferRow({
            bankCode: '004',
            accountNumber: '123-456',
            accountHolder: '홍길동',
            amount: 1000,
        })).toEqual([]);

        expect(validateKBTransferRow({
            bankCode: '',
            accountNumber: '',
            accountHolder: '',
            amount: 0,
        })).toEqual(['bankCode', 'accountNumber', 'accountHolder', 'amount']);
    });

    it('summarizes preview rows', () => {
        expect(summarizeKBTransferRows([
            { amount: 1000, validationErrors: [] },
            { amount: 2000, validationErrors: ['bankCode'] },
        ], 3)).toEqual({
            rowCount: 2,
            totalAmount: 3000,
            errorCount: 1,
            excludedCount: 3,
        });
    });

    it('uses clear amount type labels for the default transfer basis', () => {
        expect(getKBAmountTypeLabel('totalAmount')).toBe('현재 화면 실지급액');
    });
});
