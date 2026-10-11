import {
    calculateExpectedAmount, DelegatedClaim, filterClaims, getClaimTotals, mergeImportedClaims, Receipt, summarizeClaims, summarizeClaimAmounts,
} from './model';

const receipt = (amount: number): Receipt => ({
    id: `receipt-${amount}`, amount, date: '2025-01-15', method: 'transfer', memo: '', createdAt: '2025-01-15T00:00:00Z',
});
const claim = (overrides: Partial<DelegatedClaim> = {}): DelegatedClaim => ({
    id: 'claim-1', month: '2025-01', siteName: '가상 현장 A', workerName: '가상 작업자', delegationType: 'delegate',
    paymentMethod: 'transfer', grossAmount: 1000000, expectedAmount: null, receipts: [], sourceStatus: '', sourceLabel: '',
    memo: '', updatedAt: '2025-01-01T00:00:00Z', ...overrides,
});

it('현황 합계는 미확정과 0원을 구분하고 세전·예정을 각각 합산한다', () => {
    expect(summarizeClaimAmounts([claim({ grossAmount: null })])).toEqual({ gross: { amount: null, missing: 1 }, expected: { amount: null, missing: 1 } });
    expect(summarizeClaimAmounts([claim({ grossAmount: 0, expectedAmount: 0 }), claim({ grossAmount: null, expectedAmount: 100 })]))
        .toEqual({ gross: { amount: 0, missing: 1 }, expected: { amount: 100, missing: 0 } });
    expect(summarizeClaimAmounts([])).toEqual({ gross: { amount: 0, missing: 0 }, expected: { amount: 0, missing: 0 } });
});

describe('위임금 합계', () => {
    it('세전액이나 원본 완료 표시로 받을 금액과 실제 입금액을 추정하지 않는다', () => {
        expect(getClaimTotals(claim({ sourceStatus: '입금 완료' }))).toEqual({ received: 0, remaining: null, overpaid: 0, status: 'unconfirmed' });
        expect(getClaimTotals(claim({ receipts: [receipt(500)] }))).toEqual({ received: 500, remaining: null, overpaid: 0, status: 'unconfirmed' });
    });

    it.each([
        [0, [], 'paid', 0, 0],
        [1000, [], 'unpaid', 1000, 0],
        [1000, [400, 100], 'partial', 500, 0],
        [1000, [400, 600], 'paid', 0, 0],
        [1000, [1500], 'overpaid', 0, 500],
    ])('확정액 %s원과 입금 배열 %s의 상태를 계산한다', (expected, amounts, status, remaining, overpaid) => {
        const receipts = (amounts as number[]).map(receipt);
        expect(getClaimTotals(claim({ expectedAmount: expected as number, receipts }))).toEqual({
            received: (amounts as number[]).reduce((sum, amount) => sum + amount, 0), remaining, overpaid, status,
        });
    });

    it('유효하지 않은 입금액은 합계에 포함하지 않고 유효하지 않은 확정액은 미확인으로 표시한다', () => {
        expect(getClaimTotals(claim({ expectedAmount: 1000, receipts: [-10, NaN, Infinity, 1.2, 500].map(receipt) })).received).toBe(500);
        expect(getClaimTotals(claim({ expectedAmount: -1 })).status).toBe('unconfirmed');
    });

    it('초과 입금을 다른 작업자의 미입금과 상계하지 않으며 미확인 건수도 남긴다', () => {
        expect(summarizeClaims([
            claim({ expectedAmount: 1000, receipts: [receipt(1500)] }),
            claim({ id: 'claim-2', expectedAmount: 1000, receipts: [receipt(100)] }),
            claim({ id: 'claim-3', receipts: [receipt(50)] }),
        ])).toEqual({ expected: 2000, received: 1650, remaining: 900, overpaid: 500, unconfirmed: 1, count: 3 });
        expect(summarizeClaims([])).toEqual({ expected: 0, received: 0, remaining: 0, overpaid: 0, unconfirmed: 0, count: 0 });
    });

    it('월·현장·작업자·위임직불·입금수단·상태를 함께 필터링한다', () => {
        const matching = claim({ expectedAmount: 1000, workerName: '가상 Worker', receipts: [receipt(300)] });
        const claims = [matching, claim({ id: 'claim-2', month: '2025-02' }), claim({ id: 'claim-3', delegationType: 'direct' })];
        expect(filterClaims(claims, { month: '2025-01', siteName: '가상 현장 A', worker: '상worker', paymentMethod: 'transfer', delegationType: 'delegate', status: 'partial' })).toEqual([matching]);
        expect(filterClaims(claims, { month: 'all', siteName: '', worker: ' ', paymentMethod: 'all', delegationType: 'all', status: 'all' })).toHaveLength(3);
        expect(filterClaims(claims, { delegationType: 'unknown' })).toEqual([]);
        expect(filterClaims(claims, { siteName: '없는 현장' })).toEqual([]);
        expect(filterClaims(claims, { paymentMethod: 'cash' })).toEqual([]);
    });

    it('반복 가져오기로 기존 수정액·입금기록이 지워지지 않으며 중복 신규행도 추가하지 않는다', () => {
        const saved = claim({ expectedAmount: 900, receipts: [receipt(500)], memo: '확인 메모' });
        const added = claim({ id: 'claim-2' });
        const merged = mergeImportedClaims([saved], [claim(), added, added]);
        expect(merged).toEqual({ claims: [saved, added], added: 1, skipped: 2 });
        expect(merged.claims[0]).toBe(saved);
    });
});

describe('사용자 지정 세금', () => {
    it.each([
        [1000, 0, 0, 1000],
        [1000, 100, 1000, 0],
        [1000, 12.5, 125, 875],
        [101, 12.5, 13, 88],
        [1, 50, 1, 0],
        [0, 25, 0, 0],
    ])('세전 %s원에 사용자 세율 %s%%를 적용하고 세금을 원 단위 반올림한다', (gross, rate, taxAmount, expectedAmount) => {
        expect(calculateExpectedAmount(gross, rate)).toEqual({ taxAmount, expectedAmount });
    });

    it.each([-1, 100.01, NaN, Infinity])('유효하지 않은 세율 %s를 거부한다', rate => {
        expect(() => calculateExpectedAmount(1000, rate)).toThrow('세율');
    });

    it.each([-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])('유효하지 않은 세전 금액 %s를 거부한다', gross => {
        expect(() => calculateExpectedAmount(gross, 0)).toThrow('세전 금액');
    });
});
