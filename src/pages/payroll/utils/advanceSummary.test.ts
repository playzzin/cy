import type { AdvanceRequest } from '../../../services/advanceRequestService';
import { buildAdvanceSummary, isAdvanceSummaryFilter } from './advanceSummary';

const teams = [{ id: 'team-a', legacyId: 'old-a', name: '검증 A팀' }, { id: 'team-b', name: '검증 B팀' }];
const filters = { yearMonth: '2026-10', teamId: '', item: 'all' as const, query: '' };
const request = (overrides: Partial<AdvanceRequest> = {}): AdvanceRequest => ({
    id: 'request-a', workerId: 'worker-a', workerName: '검증 작업자', teamId: 'team-a',
    yearMonth: '2026-10', periodStart: '2026-09-01', periodEnd: '2026-10-31',
    currentMonthEarned: 900000, previousMonthEarned: 500000, earnedAmountSnapshot: 1400000,
    existingAdvanceAmountSnapshot: 300000, activeRequestAmountSnapshot: 200000, availableAmountSnapshot: 900000,
    requestedAmount: 100000, category: 'first', status: 'requested', ...overrides,
});

test('신청금액만 분류별로 합산하고 가능액·다른 월·팀·취소·반려는 제외한다', () => {
    const result = buildAdvanceSummary([
        request(), request({ id: 'second', category: 'second', requestedAmount: 50000, status: 'approved' }),
        request({ id: 'legacy', category: undefined, requestedAmount: 20000, status: 'paid' }),
        request({ id: 'month', yearMonth: '2026-09' }), request({ id: 'outside', teamId: 'outside' }),
        request({ id: 'cancelled', status: 'cancelled' }), request({ id: 'rejected', status: 'rejected' }),
    ], teams, filters);
    expect(result).toMatchObject({ total: 170000, first: 100000, second: 50000, other: 0, unclassified: 20000, workerCount: 1 });
    expect(result.groups[0].rows[0].items).toEqual({ first: 100000, second: 50000, unclassified: 20000 });
    expect(result.groups[0].total).toBe(170000);
});

test('분류 필터는 합산 금액·비고·입금계좌의 대상 신청에 함께 적용된다', () => {
    const result = buildAdvanceSummary([
        request({ teamId: 'old-a', memo: '1회차 메모', depositAccount: 'cheongyeon' }),
        request({ id: 'second', category: 'second', memo: '2회차 메모', depositAccount: 'dawon' }),
    ], teams, { ...filters, item: 'first', teamId: 'team-a' });
    expect(result.total).toBe(100000);
    expect(result.groups[0].rows[0]).toMatchObject({ memos: ['1회차 메모'],
        memoSources: [{ id: 'request-a', memo: '1회차 메모', label: '1회차' }],
        depositAccountSources: [{ id: 'request-a', depositAccount: 'cheongyeon' }] });
});

test('같은 작업자의 여러 신청은 합산하고 동명이인과 다른 팀은 구분한다', () => {
    const result = buildAdvanceSummary([request(), request({ id: 'repeat', requestedAmount: 25000 }),
        request({ id: 'another', workerId: 'worker-b' }), request({ id: 'team', teamId: 'team-b' })], teams, filters);
    expect(result.groups.map(group => group.rows.length)).toEqual([2, 1]);
    expect(result.groups[0].rows.find(row => row.workerId === 'worker-a')?.amount).toBe(125000);
    expect(result.workerCount).toBe(2);
    expect(result.total).toBe(325000);
});

test('혼합된 작업자 행도 신청 원본별 입금 구분으로 정확히 합산하고 모든 조회 조건을 적용한다', () => {
    const requests = [
        request({ depositAccount: 'corporate' }),
        request({ id: 'second', category: 'second', requestedAmount: 50000, depositAccount: 'personal' }),
        request({ id: 'other', category: 'other', source: 'manual-prepayment', requestedAmount: 30000, depositAccount: 'other', teamId: 'team-b', workerName: '다른 작업자' }),
        request({ id: 'empty', requestedAmount: 10000 }),
        request({ id: 'legacy', requestedAmount: 20000, depositAccount: 'dawon' }),
        request({ id: 'cancelled', depositAccount: 'corporate', status: 'cancelled' }),
    ];
    const result = buildAdvanceSummary(requests, teams, filters);
    expect(result.depositTotals).toEqual({ corporate: 100000, personal: 50000, other: 30000, unclassified: 30000 });
    expect(Object.values(result.depositTotals).reduce((sum, amount) => sum + amount, 0)).toBe(result.total);
    expect(buildAdvanceSummary(requests, teams, { ...filters, item: 'second' }).depositTotals).toEqual({ corporate: 0, personal: 50000, other: 0, unclassified: 0 });
    expect(buildAdvanceSummary(requests, teams, { ...filters, teamId: 'team-a' }).depositTotals.other).toBe(0);
    expect(buildAdvanceSummary(requests, teams, { ...filters, query: '다른 작업자' }).depositTotals).toEqual({ corporate: 0, personal: 0, other: 30000, unclassified: 0 });
});

test('검색·팀·분류 조건이 합계에 적용되며 잘못된 금액은 제외한다', () => {
    const records = [request({ memo: '검색용' }), request({ id: 'b', teamId: 'team-b', category: 'other', source: 'manual-prepayment', requestedAmount: 30000 })];
    expect(buildAdvanceSummary(records, teams, { ...filters, query: '검색용' }).total).toBe(100000);
    expect(buildAdvanceSummary(records, teams, { ...filters, item: 'other' }).total).toBe(30000);
    expect(buildAdvanceSummary(records, teams, { ...filters, teamId: 'old-a' }).total).toBe(100000);
    expect(buildAdvanceSummary(records, teams, { ...filters, teamId: 'unknown' }).groups).toHaveLength(0);
    expect(buildAdvanceSummary(records, teams, { ...filters, item: 'second' }).groups).toHaveLength(0);
    expect(isAdvanceSummaryFilter('corporate')).toBe(false);
    expect(buildAdvanceSummary([0, -1, NaN, Infinity, 1.5].map(requestedAmount => request({ requestedAmount })), teams, filters).groups).toHaveLength(0);
});

test('현재 ID와 기존 ID의 신청을 합치고 현재 등록 계좌를 연결한다', () => {
    const result = buildAdvanceSummary([request(), request({ id: 'legacy', workerId: 'legacy-a' })], teams, filters,
        [{ id: 'worker-a', legacyId: 'legacy-a', bankName: '검증은행', accountNumber: ' 000-000 ', accountHolder: ' 예금주 ' }]);
    expect(result.groups[0].rows).toHaveLength(1);
    expect(result.groups[0].rows[0]).toMatchObject({ amount: 200000, bankName: '검증은행', accountNumber: '000-000', accountHolder: '예금주' });
});

test('현재 ID를 우선하고 중복 기존 ID나 동명이인에게 타인의 계좌를 연결하지 않는다', () => {
    const result = buildAdvanceSummary([request(), request({ id: 'duplicate', workerId: 'shared' }), request({ id: 'missing', workerId: 'missing' })], teams, filters, [
        { id: 'worker-a', accountNumber: '000-0000' }, { id: 'worker-b', legacyId: 'worker-a', accountNumber: '000-1111' },
        { id: 'worker-c', legacyId: 'shared', accountNumber: '000-2222' }, { id: 'worker-d', legacyId: 'shared', accountNumber: '000-3333' },
    ]);
    const rows = new Map(result.groups[0].rows.map(row => [row.workerId, row]));
    expect(rows.get('worker-a')?.accountNumber).toBe('000-0000');
    expect(rows.get('shared')?.accountNumber).toBe('');
    expect(rows.get('missing')?.accountNumber).toBe('');
});
