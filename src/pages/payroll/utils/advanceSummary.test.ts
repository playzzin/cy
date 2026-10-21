import type { AdvancePayment } from '../../../services/advancePaymentService';
import { buildAdvanceSummary } from './advanceSummary';

jest.mock('../../../services/firestoreCrudCompat', () => ({}));

const teams = [{ id: 'team-a', legacyId: 'old-a', name: '테스트 A팀' }, { id: 'team-b', name: '테스트 B팀' }];
const filters = { yearMonth: '2026-10', teamId: '', item: 'all' as const, query: '' };
const payment = (overrides: Partial<AdvancePayment> = {}): AdvancePayment => ({
    id: 'payment-a', workerId: 'worker-a', workerName: '테스트 작업자', teamId: 'team-a', teamName: '과거 팀명',
    yearMonth: '2026-10', salaryModel: '일급제', items: { corporateAdvance1: 100000, laborAdvance2: 50000 },
    prevMonthCarryover: 20000, accommodation: 30000, privateRoom: 0, gloves: 0, deposit: 0, fines: 0,
    electricity: 0, gas: 0, internet: 0, water: 0, totalDeduction: 200000, ...overrides,
});

test('가불만 합산하고 이월·공제·사용자 정의 공제와 다른 월/팀은 제외한다', () => {
    const result = buildAdvanceSummary([
        payment({ items: { corporateAdvance1: 100000, laborAdvance2: 50000, customDeduction: 90000 } }),
        payment({ id: 'other-month', yearMonth: '2026-09' }), payment({ id: 'outside', teamId: 'outside-scope' }),
    ], teams, filters);
    expect(result.total).toBe(150000);
    expect(result.corporate).toBe(100000);
    expect(result.labor).toBe(50000);
    expect(result.workerCount).toBe(1);
    expect(result.groups[0].total).toBe(150000);
});

test('legacy 팀 ID와 여러 급여 구분을 같은 작업자 행에 합치고 비고를 보존한다', () => {
    const result = buildAdvanceSummary([
        payment({ teamId: 'old-a', memo: '테스트 메모 A' }),
        payment({ id: 'monthly', salaryModel: '월급제', items: { corporateAdvance1: 25000 }, memo: '테스트 메모 B' }),
    ], teams, filters);
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].rows).toHaveLength(1);
    expect(result.groups[0].rows[0]).toMatchObject({ amount: 175000, memos: ['테스트 메모 A', '테스트 메모 B'] });
});

test('동명이인을 합치지 않고 같은 작업자의 다른 팀 내역도 구분한다', () => {
    const result = buildAdvanceSummary([
        payment(), payment({ id: 'another-person', workerId: 'worker-b' }), payment({ id: 'other-team', teamId: 'team-b' }),
    ], teams, filters);
    expect(result.groups.map(group => group.rows.length)).toEqual([2, 1]);
    expect(result.workerCount).toBe(2);
    expect(result.total).toBe(450000);
});

test('법인·노무·개별 항목과 팀·검색 조건이 소계 및 전체 합계에 동일하게 적용된다', () => {
    const records = [payment({ memo: '검색용 메모' }), payment({ id: 'b', workerId: 'worker-b', teamId: 'team-b' })];
    expect(buildAdvanceSummary(records, teams, { ...filters, item: 'corporate', teamId: 'old-a' }).total).toBe(100000);
    expect(buildAdvanceSummary(records, teams, { ...filters, item: 'labor', query: '검색용' }).total).toBe(50000);
    expect(buildAdvanceSummary(records, teams, { ...filters, item: 'laborAdvance2', teamId: 'team-a' }).total).toBe(50000);
    expect(buildAdvanceSummary(records, teams, { ...filters, item: 'corporateAdvance4' }).groups).toHaveLength(0);
    expect(buildAdvanceSummary(records, teams, { ...filters, teamId: 'unknown' }).groups).toHaveLength(0);
});

test('음수 조정과 상쇄되는 가불을 보존하며 가불 없는 공제 전용 행은 숨긴다', () => {
    const result = buildAdvanceSummary([
        payment({ items: { corporateAdvance1: 50000, laborAdvance1: -50000 } }),
        payment({ id: 'zero', workerId: 'worker-b', items: {} }),
    ], teams, filters);
    expect(result.groups[0].rows).toHaveLength(1);
    expect(result.total).toBe(0);
    expect(result.corporate).toBe(50000);
    expect(result.labor).toBe(-50000);
});
