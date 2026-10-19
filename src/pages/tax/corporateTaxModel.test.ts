import { buildCorporateTaxReport, CORPORATE_TAX_STAFF, emptyManual, freelancerEvidence, ledgerEvidence, salaryEvidence, validateManual, cardEvidence, lodgingEvidence } from './corporateTaxModel';
import type { CardTransaction } from '../../types/card';
import type { UtilityRecord } from '../../types/accommodation';
import type { WorkbookLedgerEntry } from '../../services/workbookLedgerService';
import type { OfficeStaff } from '../../services/officeStaffService';
import { calculatePayroll, DEFAULT_INSURANCE_SETTINGS } from '../payroll/officeStaffPayrollModel';

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
    manual.months[1] = { amounts: { invoice: 3760549, other: 709240 }, notes: {} };
    const evidence = [
        { id: 'sales', month: 1, field: 'sales' as const, label: '', description: '', amount: 638537499 },
        { id: 'purchases', month: 1, field: 'purchases' as const, label: '', description: '', amount: 536436054 },
        { id: 'salary', month: 1, field: 'salary' as const, label: '', description: '', amount: 10000000 },
        { id: 'card', month: 1, field: 'card' as const, label: '', description: '', amount: 40596218 },
        { id: 'lodging', month: 1, field: 'lodging' as const, label: '', description: '', amount: 19748000 },
    ];
    expect(buildCorporateTaxReport(evidence, manual).profit).toBe(27287438);
    manual.months[1].amounts.depreciation = 1000; manual.months[1].amounts.condolence = 2000;
    expect(buildCorporateTaxReport([...evidence, { id: 'labor', month: 1, field: 'labor', label: '', description: '', amount: 3000 }], manual).profit).toBe(27281438);
});

it('카드사용 총액은 취소·타 연도·중복 명세서를 제외하고 환불 금액은 차감한다', () => {
    const transaction: CardTransaction = { id: 'card-statement__2026-01__card__hash__0__tx1', cardId: 'card', cardLabel: '검증 카드', date: '2026-01-10', yearMonth: '2026-01', category: 'MEAL', merchant: '검증 가맹점', amount: 1000, statementSourceSha256: 'synthetic-hash', operationId: 'card-statement-import:synthetic' };
    const result = cardEvidence(2026, [transaction, { ...transaction, id: 'card-statement__2026-01__card__other__0__tx1' },
        { ...transaction, id: 'cancelled', status: 'CANCELLED' }, { ...transaction, id: 'old', yearMonth: '2025-12' },
        { ...transaction, id: 'refund', statementSourceSha256: undefined, amount: -100 }]);
    expect(result.reduce((sum, row) => sum + row.amount, 0)).toBe(900);
    expect(result).toHaveLength(2);
});

it('숙소 월별 총액과 항목별 근거를 가져오며 같은 숙소·월 중복 자료는 최신 한 건만 반영한다', () => {
    const record: UtilityRecord = { id: 'utility_2026-01_room', accommodationId: 'room', accommodationName: '검증 숙소', yearMonth: '2026-01', paymentStatus: 'unpaid',
        costs: { rent: 500000, electricity: 50000, gas: 20000, water: 10000, internet: 30000, maintenance: 40000, other: 5000, total: 655000 } };
    const rows = lodgingEvidence(2026, [record, { ...record, id: 'legacy' }, { ...record, id: 'old', yearMonth: '2025-12' }]);
    expect(rows).toHaveLength(1);
    expect(rows[0].amount).toBe(655000);
    expect(rows[0].description).toContain('월세 500,000 + 전기 50,000');
    expect(buildCorporateTaxReport(rows, emptyManual()).profit).toBe(-655000);
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

it('프리랜서 신고와 같은 청연팀 범위에서 월 신고액만 사용하고 신고가능액/성과급을 중복 합산하지 않는다', () => {
    const rows = freelancerEvidence([
        { id: 'a', name: '검증A', teamId: 'legacy', m01: 300, reportableAmount: 99000, performanceBonus: 9000 },
        { id: 'b', name: '검증B', teamName: '청연 1팀', m02: 200 },
        { id: 'c', name: '검증C', teamId: 'other', m01: 1000 },
    ], [{ id: 'team', legacyId: 'legacy', name: '청연1팀', companyId: 'company' }], [{ id: 'company', name: '청연이엔지' }]);
    expect(rows.map(row => row.amount)).toEqual([300, 200]);
    expect(rows.map(row => row.month)).toEqual([1, 2]);
    expect(rows.map(row => row.label)).toEqual(['청연1팀', '청연1팀']);
});

it('모든 팀의 월 합계를 더하며 기존 팀 ID와 팀명은 같은 팀으로 묶고 음수 정정도 반영한다', () => {
    const rows = freelancerEvidence([
        { teamId: 'legacy-a', teamName: '이전 팀명', m01: '1,000', m02: 200, total: 999999 },
        { teamId: 'a', m01: -100, m01_id: 'manual-correction' },
        { teamName: '검증 A팀', m01: 300 },
        { teamId: 'b', m01: 500, m02: -50 },
        { teamId: 'outside', m01: 90000 },
        { teamId: 'a', isFooter: true, m01: 1200 },
        { teamId: 'a', isEmpty: true, m01: 100000 },
    ], [
        { id: 'a', legacyId: 'legacy-a', name: '검증A팀', companyId: 'company' },
        { id: 'b', name: '검증B팀', companyId: 'company' },
    ], [{ id: 'company', name: '청연이엔지' }]);
    expect(rows.map(({ month, label, amount }) => ({ month, label, amount }))).toEqual([
        { month: 1, label: '검증A팀', amount: 1200 }, { month: 1, label: '검증B팀', amount: 500 },
        { month: 2, label: '검증A팀', amount: 200 }, { month: 2, label: '검증B팀', amount: -50 },
    ]);
    expect(rows[0].description).toContain('신고 내역 3건');
    const report = buildCorporateTaxReport(rows, emptyManual());
    expect(report.months[0].amounts.labor).toBe(1700);
    expect(report.months[1].amounts.labor).toBe(150);
    expect(report.totals.labor).toBe(1850);
    expect(report.profit).toBe(-1850);
});

it('월 금액이 상계되어 0원이 된 팀도 근거를 남기고 동명 팀의 서로 다른 ID는 구분한다', () => {
    const rows = freelancerEvidence([
        { teamId: 'a', teamName: '검증팀', m01: 100 }, { teamId: 'a', teamName: '검증팀', m01: -100 },
        { teamId: 'b', teamName: '검증팀', m01: 500 }, { teamId: 'c', teamName: '빈팀', m01: null },
    ], [], []);
    expect(rows).toHaveLength(2);
    expect(rows.map(row => row.amount)).toEqual([0, 500]);
    expect(new Set(rows.map(row => row.id)).size).toBe(2);
});

it('프리랜서 소수점 금액을 원본 그대로 월별·팀별로 합산하며 정수 전용 입력 검증을 적용하지 않는다', () => {
    const rows = freelancerEvidence([
        { teamId: 'a', teamName: '검증A팀', m06: 1000.25, m07: 2000.75, m08: 0.1 + 0.2 },
        { teamId: 'a', teamName: '검증A팀', m06: '2,000.50' },
        { teamId: 'b', teamName: '검증B팀', m06: -100.25 },
    ], [], []);
    expect(rows.find(row => row.month === 6 && row.label === '검증A팀')?.amount).toBe(3000.75);
    expect(rows.find(row => row.month === 8)?.amount).toBe(0.1 + 0.2);
    const report = buildCorporateTaxReport(rows, emptyManual());
    expect(report.months[5].amounts.labor).toBe(2900.5);
    expect(report.months[6].amounts.labor).toBe(2000.75);
    expect(report.profit).toBeCloseTo(-4901.55);
    expect(() => validateManual({ ...emptyManual(), months: { 1: { amounts: { other: 100.5 }, notes: {} } } })).toThrow();
});

it.each([NaN, Infinity, '잘못된 금액', Number.MAX_SAFE_INTEGER + 1])('처리할 수 없는 원본 금액 %s는 0원으로 덮지 않고 금액 형식 오류를 반환한다', value => {
    expect(() => freelancerEvidence([{ teamId: 'a', m01: value }], [], [])).toThrow(expect.objectContaining({ code: 'invalid-source-amount' }));
});

it('다른 자동금액도 소수점 원본을 보존한다', () => {
    expect(ledgerEvidence(2026, [entry({ supplyAmount: 1000.25 })])[0].amount).toBe(1000.25);
    expect(cardEvidence(2026, [{ id: 'card', yearMonth: '2026-01', category: 'MEAL', amount: 1000.25 } as CardTransaction])[0].amount).toBe(1000.25);
    expect(lodgingEvidence(2026, [{ id: 'room', accommodationId: 'room', yearMonth: '2026-01', costs: { rent: 1000.25, total: 1000.25 } } as UtilityRecord])[0].amount).toBe(1000.25);
    expect(salaryEvidence(2026, [], { '2026-01': { grossPaySnapshot: [{ id: 'staff', name: CORPORATE_TAX_STAFF[0], grossPay: 1000.25, baseSalary: 1000, bonus: 0.25, payBasis: 'gross' }] } }).rows[0].amount).toBe(1000.25);
});

it('지정한 4명만 월 저장본 세전 총액으로 계산하고 없는 달에 현재 급여를 복제하지 않는다', () => {
    const snapshot = [...CORPORATE_TAX_STAFF, '대상외'].map((name, i) => ({ id: String(i), name, grossPay: 1000 + i, baseSalary: 900, bonus: 100 + i, payBasis: 'gross' as const }));
    const staff = [{ id: '0', name: CORPORATE_TAX_STAFF[0], unitPrice: 999999 }] as OfficeStaff[];
    const result = salaryEvidence(2026, staff, { '2026-01': { grossPaySnapshot: snapshot } });
    expect(result.rows).toHaveLength(4);
    expect(result.rows.reduce((sum, row) => sum + row.amount, 0)).toBe(4006);
    expect(result.missingMonths).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(result.warnings).toEqual([]);
});

it('기존 급여의 세후 환산은 사무실 급여와 동일하고 공제/회사 보험료는 총급여에서 빼거나 더하지 않는다', () => {
    const staff = CORPORATE_TAX_STAFF.map((name, index) => ({ id: String(index), name, unitPrice: 1000000, status: '재직' }));
    const input = { baseSalary: 1500000, bonus: 100000, deduction: 50000, payBasis: 'net' as const, insuranceApplied: true, insuranceBurdenMode: 'shared' as const };
    const result = salaryEvidence(2026, staff, { '2026-01': { rowInputs: { 'staff:0': input } } });
    expect(result.rows[0].amount).toBe(calculatePayroll(input, DEFAULT_INSURANCE_SETTINGS).grossPay);
    expect(result.rows[0].amount).toBeGreaterThan(1600000);
    expect(result.warnings[0]).toContain('현재 직원 기본급');
});

it('동명이인 급여를 임의로 합산하지 않고 경고한다', () => {
    const result = salaryEvidence(2026, [], { '2026-01': { grossPaySnapshot: [1, 2].map(i => ({ id: String(i), name: CORPORATE_TAX_STAFF[0], grossPay: 100, baseSalary: 100, bonus: 0, payBasis: 'gross' })) } });
    expect(result.rows).toHaveLength(0);
    expect(result.warnings[0]).toContain('중복');
    expect(result.unconfirmedMonths).toContain(1);
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
