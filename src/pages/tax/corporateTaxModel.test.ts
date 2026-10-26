import { buildCorporateTaxReport, emptyManual, ledgerEvidence, validateManual, lodgingEvidence } from './corporateTaxModel';
import type { Accommodation, UtilityRecord } from '../../types/accommodation';
import type { WorkbookLedgerEntry } from '../../services/workbookLedgerService';

const entry = (patch: Partial<WorkbookLedgerEntry> = {}): WorkbookLedgerEntry => ({ id: 'invoice', date: '2026-01-15', transactionType: '매출', partnerName: '검증 거래처', siteName: '', description: '검증 거래', supplyAmount: 1000, taxAmount: 100, totalAmount: 1100, paymentAmount: 0, ...patch });

it('거래일별 공급가액만 합산하고 음수 수정분을 유지하며 삭제/선수금/입금은 제외한다', () => {
    const evidence = ledgerEvidence(2026, [entry(), entry({ id: 'purchase', transactionType: '매입', supplyAmount: 400, totalAmount: 440 }),
        entry({ id: 'credit', supplyAmount: -100, totalAmount: -110 }), entry({ id: 'cash', supplyAmount: 0, totalAmount: 0, paymentAmount: 500 }),
        entry({ deletedAt: '2026-01-20' }), entry({ sourceType: 'advanceUsage' }), entry({ date: '2025-12-30' }), entry({ date: '2026-13-01' }),
        entry({ id: 'applied', date: '2026-02-01', appliedYear: 2025, appliedMonth: 12, supplyAmount: 10 }),
    ]);
    const report = buildCorporateTaxReport(evidence, emptyManual());
    expect(report.months[0].amounts).toMatchObject({ sales: 900, purchases: 400 });
    expect(report.months[1].amounts.sales).toBe(10);
    expect(evidence).toHaveLength(4);
});

it('첨부 표의 1월 이익을 재현하고 모든 수기 비용과 노무비를 차감한다', () => {
    const manual = emptyManual();
    manual.months[1] = { amounts: { invoice: 3760549, other: 709240, salary: 10000000, card: 40596218 }, notes: {} };
    const evidence = [
        { id: 'sales', month: 1, field: 'sales' as const, label: '', description: '', amount: 638537499 },
        { id: 'purchases', month: 1, field: 'purchases' as const, label: '', description: '', amount: 536436054 },
        { id: 'lodging', month: 1, field: 'lodging' as const, label: '', description: '', amount: 19748000 },
    ];
    expect(buildCorporateTaxReport(evidence, manual).profit).toBe(27287438);
    manual.months[1].amounts.depreciation = 1000; manual.months[1].amounts.condolence = 2000;
    manual.months[1].amounts.labor = 3000;
    expect(buildCorporateTaxReport(evidence, manual).profit).toBe(27281438);
});

it('연간 순이익으로 세액을 계산하며 손실 또는 과다 예납시 납부액을 0으로 제한한다', () => {
    const manual = emptyManual();
    manual.interimPayment = 15; manual.taxCredit = 10;
    const evidence = [{ id: '1', month: 1, field: 'sales' as const, label: '', description: '', amount: 1000 }, { id: '2', month: 2, field: 'purchases' as const, label: '', description: '', amount: 500 }];
    expect(buildCorporateTaxReport(evidence, manual)).toMatchObject({ profit: 500, estimatedTax: 50, payableTax: 25 });
    manual.interimPayment = 1000;
    expect(buildCorporateTaxReport(evidence, manual).payableTax).toBe(0);
    manual.months[3] = { amounts: { other: 2000 }, notes: {} };
    expect(buildCorporateTaxReport(evidence, manual).estimatedTax).toBe(0);
});

it.each([[10000, 0.57, 57], [10000, 0.29, 29], [9999.99, 1, 99], [100, 10, 10], [10000000, 1e-5, 1], [0, 10, 0]])('소수점 오차 없이 %s원 × %s%%의 세액을 원 단위로 버림한다', (profit, rate, expected) => {
    const manual = { ...emptyManual(), taxRate: rate };
    expect(buildCorporateTaxReport([{ id: 'sale', month: 1, field: 'sales', label: '', description: '', amount: profit }], manual).estimatedTax).toBe(expected);
});

it('수기 금액 형식/연월/예납/세율을 검증하고 음수 비용 정정은 허용한다', () => {
    const manual = emptyManual();
    manual.months[1] = { amounts: { other: -100 }, notes: { other: '환입' } };
    expect(validateManual(manual).months[1].amounts.other).toBe(-100);
    expect(() => validateManual({ ...manual, taxRate: 101 })).toThrow();
    expect(() => validateManual({ ...manual, interimPayment: -1 })).toThrow();
    expect(() => validateManual({ ...manual, months: { 13: { amounts: {}, notes: {} } } })).toThrow();
    expect(() => validateManual({ ...manual, months: { 1: { amounts: { other: NaN }, notes: {} } } })).toThrow();
});

const room = (id: string, ownership: Accommodation['ownership'] = 'Cheongyeon', patch: Partial<Accommodation> = {}): Accommodation => ({
    id, name: id, ownership, status: 'active', contract: { startDate: '2026-01-01', endDate: '2026-12-31', monthlyRent: 500000 },
    costProfile: { maintenance: 'fixed', fixedMaintenance: 110000 }, ...patch,
} as Accommodation);
const utility = (accommodationId: string, patch: Partial<UtilityRecord> = {}): UtilityRecord => ({
    id: 'utility_2026-01_' + accommodationId, accommodationId, accommodationName: accommodationId, yearMonth: '2026-01', paymentStatus: 'unpaid',
    costs: { rent: 500000, maintenance: 110000, electricity: 50000, gas: 20000, water: 10000, internet: 30000, other: 5000, total: 725000 }, ...patch,
});

it('청연·다원 숙소를 분리하고 개인·소유 불명·다른 연월과 공과금을 제외한다', () => {
    const rooms = [room('cy'), room('dw', 'Dawon'), room('person', 'Individual')];
    const records = ['cy', 'dw', 'person', 'unknown'].map(id => utility(id));
    const cy = lodgingEvidence('2026-01', records, rooms, 'cheongyeon');
    const dw = lodgingEvidence('2026-01', records, rooms, 'dawon');
    expect(cy).toEqual([expect.objectContaining({ label: 'cy', amount: 610000, description: expect.stringContaining('관리비 110,000') })]);
    expect(dw).toEqual([expect.objectContaining({ label: 'dw', amount: 610000 })]);
    expect(buildCorporateTaxReport(cy, emptyManual()).profit).toBe(-610000);
});

it('7월에 한정하지 않고 1~12월 계약기간의 월세와 관리비를 집계한다', () => {
    const rows = Array.from({ length: 12 }, (_, i) => lodgingEvidence('2026-' + String(i + 1).padStart(2, '0'), [], [room('cy')], 'cheongyeon')).flat();
    expect(rows.map(row => row.month)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(buildCorporateTaxReport(rows, emptyManual()).totals.lodging).toBe(7320000);
    expect(lodgingEvidence('2025-12', [], [room('cy')], 'cheongyeon')).toEqual([]);
    expect(lodgingEvidence('2027-01', [], [room('cy')], 'cheongyeon')).toEqual([]);
});

it('명시한 0원·정정·소수점과 중복 제거를 보존하며 월세 포함 관리비는 더하지 않는다', () => {
    const record = utility('cy', { costs: { rent: 0, maintenance: -1000.25, total: 999999 } as UtilityRecord['costs'] });
    const rows = lodgingEvidence('2026-01', [record, { ...record, id: 'legacy' }], [room('cy')], 'cheongyeon');
    expect(rows).toHaveLength(1);
    expect(rows[0].amount).toBe(-1000.25);
    expect(lodgingEvidence('2026-01', [], [room('cy', 'Cheongyeon', { costProfile: { maintenance: 'included', fixedMaintenance: 110000 } as Accommodation['costProfile'] })], 'cheongyeon')[0].amount).toBe(500000);
});

it('종료 숙소의 저장된 과거 자료를 보존하고 계약 전후의 기본값은 생성하지 않는다', () => {
    const inactive = room('cy', 'Cheongyeon', { status: 'inactive' });
    expect(lodgingEvidence('2026-01', [utility('cy')], [inactive], 'cheongyeon')[0].amount).toBe(610000);
    expect(lodgingEvidence('2027-01', [], [inactive], 'cheongyeon')).toEqual([]);
    const unknownContract = room('cy', 'Cheongyeon', { contract: {} as Accommodation['contract'] });
    expect(lodgingEvidence('2026-01', [], [unknownContract], 'cheongyeon')).toEqual([]);
    expect(lodgingEvidence('2026-01', [utility('cy')], [unknownContract], 'cheongyeon')[0].amount).toBe(610000);
});

it('기존 수기 자료를 보존하고 노무비·급여·카드 금액과 근거를 저장·합산한다', () => {
    const manual = emptyManual();
    manual.months[1] = { amounts: { labor: 3000, salary: 2000, card: 1000, other: 500 }, notes: { labor: '신고서', salary: '급여대장', card: '회사 카드' } };
    expect(validateManual(manual)).toEqual(manual);
    expect(buildCorporateTaxReport([], manual)).toMatchObject({ profit: -6500, totals: { labor: 3000, salary: 2000, card: 1000 } });
    expect(validateManual({ ...emptyManual(), months: { 1: { amounts: { other: 100 }, notes: {} } } }).months[1].amounts).toEqual({ other: 100 });
});

it.each([NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])('잘못된 숙소 금액 %s를 0원으로 덮지 않는다', amount => {
    expect(() => lodgingEvidence('2026-01', [utility('cy', { costs: { rent: amount, maintenance: 0 } as UtilityRecord['costs'] })], [room('cy')], 'cheongyeon')).toThrow(expect.objectContaining({ code: 'invalid-source-amount' }));
});
