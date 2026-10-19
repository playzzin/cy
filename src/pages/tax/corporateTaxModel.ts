import type { WorkbookLedgerEntry } from '../../services/workbookLedgerService';
import type { OfficeStaff } from '../../services/officeStaffService';
import type { CardTransaction } from '../../types/card';
import type { UtilityRecord } from '../../types/accommodation';
import { dedupeImportedStatementTransactions } from '../../utils/cardStatementDeduplication';
import { dedupeAccommodationUtilityRecords } from '../../utils/accommodationUtilityDeduplication';
import { buildStaffDisplayRow, buildManualDisplayRow, calculatePayroll, getStaffRowId, normalizeStoredSettings, StoredPayrollData } from '../payroll/officeStaffPayrollModel';
import { CorporateTaxSourceAmountError } from './corporateTaxLoadError';

export const CORPORATE_TAX_STAFF = ['이재욱', '김정혜', '이창순', '고정은'];
export const MANUAL_FIELDS = [
    { key: 'invoice', label: '계산서발행' }, { key: 'depreciation', label: '감가상각비' },
    { key: 'condolence', label: '경조사비' }, { key: 'other', label: '기타비용' },
] as const;
export type ManualField = typeof MANUAL_FIELDS[number]['key'];
export type AutoField = 'sales' | 'purchases' | 'labor' | 'salary' | 'card' | 'lodging';
export type AmountField = AutoField | ManualField;
export const AMOUNT_COLUMNS: Array<{ key: AmountField; label: string; auto: boolean }> = [
    { key: 'sales', label: '매출액', auto: true }, { key: 'purchases', label: '매입액', auto: true },
    { key: 'invoice', label: '계산서발행', auto: false }, { key: 'labor', label: '노무비신고', auto: true },
    { key: 'salary', label: '급여', auto: true },
    { key: 'card', label: '카드사용금액', auto: true }, { key: 'lodging', label: '숙소비', auto: true },
    ...MANUAL_FIELDS.filter(field => field.key !== 'invoice').map(field => ({ ...field, auto: false })),
];
export interface ManualMonth { amounts: Partial<Record<ManualField, number>>; notes: Partial<Record<ManualField, string>> }
export interface CorporateTaxManual {
    months: Record<string, ManualMonth>;
    taxRate: number;
    interimPayment: number;
    taxCredit: number;
    memo: string;
}
export interface Evidence { id: string; month: number; field: AutoField; label: string; description: string; amount: number; date?: string }
export interface SalaryEvidence { rows: Evidence[]; warnings: string[]; missingMonths: number[]; unconfirmedMonths: number[] }
export const emptyManual = (): CorporateTaxManual => ({ months: {}, taxRate: 10, interimPayment: 0, taxCredit: 0, memo: '' });
const token = (value: unknown) => String(value ?? '').replace(/\s+/g, '').trim();
export const numberValue = (value: unknown): number => {
    const parsed = typeof value === 'number' ? value : Number(String(value ?? '').replace(/,/g, ''));
    if (!Number.isFinite(parsed) || !Number.isSafeInteger(parsed)) throw new Error('금액은 원 단위 정수로 입력해 주세요.');
    return parsed;
};

/** 자동금액은 원본 장부의 소수점도 보존한다. 수기 입력의 원 단위 검증과 분리한다. */
const sourceAmount = (value: unknown): number => {
    const parsed = typeof value === 'number' ? value : Number(String(value ?? '').replace(/,/g, ''));
    if (!Number.isFinite(parsed) || Math.abs(parsed) > Number.MAX_SAFE_INTEGER) throw new CorporateTaxSourceAmountError();
    return parsed;
};

export function validateManual(input: CorporateTaxManual): CorporateTaxManual {
    if (!input || typeof input !== 'object' || !input.months || typeof input.months !== 'object' || Array.isArray(input.months)) throw new Error('수기 자료 형식을 확인해 주세요.');
    const result = emptyManual();
    for (const [month, row] of Object.entries(input.months)) {
        if (!/^(?:[1-9]|1[0-2])$/.test(month) || !row || !row.amounts || !row.notes) throw new Error('수기 자료의 월과 입력값을 확인해 주세요.');
        const amounts: ManualMonth['amounts'] = {}, notes: ManualMonth['notes'] = {};
        MANUAL_FIELDS.forEach(({ key }) => {
            if (row.amounts[key] !== undefined) amounts[key] = numberValue(row.amounts[key]);
            if (row.notes[key] !== undefined) {
                if (typeof row.notes[key] !== 'string' || row.notes[key]!.length > 500) throw new Error('금액 근거는 500자 이내로 입력해 주세요.');
                notes[key] = row.notes[key];
            }
        });
        result.months[month] = { amounts, notes };
    }
    if (!Number.isFinite(input.taxRate) || input.taxRate < 0 || input.taxRate > 100) throw new Error('예상 세율은 0~100%로 입력해 주세요.');
    result.taxRate = input.taxRate;
    result.interimPayment = numberValue(input.interimPayment);
    result.taxCredit = numberValue(input.taxCredit);
    if (result.interimPayment < 0 || result.taxCredit < 0) throw new Error('중간예납과 세금공제는 0원 이상으로 입력해 주세요.');
    if (typeof input.memo !== 'string' || input.memo.length > 3000) throw new Error('정산 메모는 3,000자 이내로 입력해 주세요.');
    result.memo = input.memo;
    return result;
}

/** 거래장과 같은 거래일 기준. 부가세/입출금/선수금 대체를 비용에 더하지 않고 수정분의 부호를 유지한다. */
export function ledgerEvidence(year: number, entries: WorkbookLedgerEntry[]): Evidence[] {
    return entries.flatMap((entry, index) => {
        const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(entry.date);
        if (entry.deletedAt || entry.sourceType === 'advanceUsage' || !match || Number(match[1]) !== year) return [];
        const month = Number(match[2]);
        if (month < 1 || month > 12) return [];
        const amount = sourceAmount(entry.supplyAmount);
        if (!amount) return [];
        return [{ id: entry.id || `ledger-${index}`, month, field: entry.transactionType === '매출' ? 'sales' as const : 'purchases' as const,
            label: entry.partnerName, description: [entry.description, entry.siteName, entry.teamName].filter(Boolean).join(' · '), date: entry.date, amount }];
    });
}

const CARD_CATEGORIES: Record<string, string> = { FUEL: '주유', TOLL: '통행료', MEAL: '식대', MATERIAL: '자재', OTHER: '기타' };
export function cardEvidence(year: number, transactions: CardTransaction[]): Evidence[] {
    return dedupeImportedStatementTransactions(transactions.filter(row => row.status !== 'CANCELLED' && !row.cancelledAt)).flatMap(row => {
        const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(row.yearMonth);
        if (!match || Number(match[1]) !== year || !CARD_CATEGORIES[row.category]) return [];
        return [{ id: row.id, month: Number(match[2]), field: 'card' as const, label: row.cardLabel || '카드', date: row.date,
            description: [CARD_CATEGORIES[row.category], row.merchant, row.memo].filter(Boolean).join(' · '), amount: sourceAmount(row.amount) }];
    });
}

const LODGING_COSTS = [ ['rent', '월세'], ['electricity', '전기'], ['gas', '가스'], ['water', '수도'], ['internet', '인터넷'], ['maintenance', '관리비'], ['other', '기타'] ] as const;
export function lodgingEvidence(year: number, records: UtilityRecord[]): Evidence[] {
    return dedupeAccommodationUtilityRecords(records).flatMap(row => {
        const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(row.yearMonth);
        if (!match || Number(match[1]) !== year) return [];
        const description = LODGING_COSTS.map(([key, label]) => ({ label, amount: sourceAmount(row.costs[key] ?? 0) }))
            .filter(item => item.amount !== 0).map(item => `${item.label} ${item.amount.toLocaleString('ko-KR')}`).join(' + ');
        return [{ id: row.id, month: Number(match[2]), field: 'lodging' as const, label: row.accommodationName,
            description: description || '숙소 통합관리대장 합계', amount: sourceAmount(row.costs.total) }];
    });
}

export interface FreelancerReportRow { id?: string; name?: string; teamId?: string; teamName?: string; [key: string]: unknown }
/** 프리랜서 신고 화면의 팀별 월 합계. 연간 합계/성과급/신고가능액은 재합산하지 않는다. */
export function freelancerEvidence(rows: FreelancerReportRow[], teams: Array<{ id?: string; legacyId?: string | null; name: string; companyId?: string | null }>, companies: Array<{ id?: string; name: string }>): Evidence[] {
    const companyIds = new Set(companies.filter(company => company.name?.includes('청연')).map(company => company.id).filter(Boolean));
    const scopedTeams = teams.filter(team => team.companyId && companyIds.has(team.companyId)).sort((a, b) => a.name.localeCompare(b.name));
    const ids = new Map<string, string>(), names = new Map<string, string>(), teamNames = new Map<string, string>();
    scopedTeams.forEach(team => {
        const id = team.id || team.legacyId;
        if (!id) return;
        if (team.id) ids.set(team.id, id);
        if (team.legacyId) ids.set(team.legacyId, id);
        teamNames.set(id, team.name);
        if (team.id && !names.has(token(team.name))) names.set(token(team.name), team.id);
    });
    const restrictTeams = scopedTeams.some(team => !!team.id);
    const totals = new Map<string, Evidence & { count: number }>();
    rows.forEach(row => {
        if (row.isEmpty || row.isFooter) return;
        const teamId = row.teamId ? ids.get(row.teamId) || row.teamId : names.get(token(row.teamName));
        if (restrictTeams && (!teamId || !ids.has(teamId))) return;
        const teamName = (teamId && teamNames.get(teamId)) || row.teamName || '소속 없음';
        const teamKey = teamId ? `id:${teamId}` : `name:${token(teamName)}`;
        for (let i = 0; i < 12; i += 1) {
            const key = `m${String(i + 1).padStart(2, '0')}`;
            const amount = sourceAmount(row[key] ?? 0);
            if (amount === 0) continue;
            const id = `${teamKey}-${key}`;
            const total = totals.get(id) || { id, month: i + 1, field: 'labor', label: teamName, description: '', amount: 0, count: 0 };
            total.amount += amount;
            total.count += 1;
            totals.set(id, total);
        }
    });
    return Array.from(totals.values()).sort((a, b) => a.month - b.month || a.label.localeCompare(b.label, 'ko'))
        .map(({ count, ...row }) => ({ ...row, description: `프리랜서 신고 ${row.month}월 합계 · 신고 내역 ${count}건` }));
}

export function salaryEvidence(year: number, staff: OfficeStaff[], stored: StoredPayrollData): SalaryEvidence {
    const rows: Evidence[] = [], warnings: string[] = [], missingMonths: number[] = [];
    const unconfirmed = new Set<number>();
    for (let month = 1; month <= 12; month += 1) {
        const period = `${year}-${String(month).padStart(2, '0')}`, saved = stored[period];
        if (!saved) { missingMonths.push(month); unconfirmed.add(month); continue; }
        const hasSnapshot = Array.isArray(saved.grossPaySnapshot);
        const settings = normalizeStoredSettings(saved.settings);
        const sourceRows = hasSnapshot ? saved.grossPaySnapshot! : [
            ...staff.map((person, index) => buildStaffDisplayRow(person, index, saved.rowInputs?.[getStaffRowId(person, index)])),
            ...(saved.manualRows || []).map(buildManualDisplayRow),
        ].map(row => ({ ...row, grossPay: calculatePayroll(row, settings).grossPay }));
        if (!hasSnapshot) {
            unconfirmed.add(month);
            warnings.push(`${month}월 급여: 기존 월 입력값과 현재 직원 기본급으로 계산했습니다. 사무실 직원급여에서 확인해 주세요.`);
        }
        CORPORATE_TAX_STAFF.forEach(name => {
            const matches = sourceRows.filter(row => token(row.name) === name);
            if (matches.length !== 1) {
                unconfirmed.add(month);
                warnings.push(`${month}월 ${name}: ${matches.length ? '동명이인 또는 중복 행' : '급여 자료 없음'} — 합계에서 제외했습니다.`);
                return;
            }
            const row = matches[0];
            rows.push({ id: `${period}-${row.id}`, month, field: 'salary', label: name, amount: sourceAmount(row.grossPay),
                description: `기본급 ${row.baseSalary.toLocaleString('ko-KR')} + 상여 ${row.bonus.toLocaleString('ko-KR')} · ${row.payBasis === 'net' ? '세후 입력 → 세전 환산' : '세전 총액'} · ${hasSnapshot ? '월 저장본' : '기존 입력값'}` });
        });
    }
    return { rows, warnings, missingMonths, unconfirmedMonths: Array.from(unconfirmed) };
}

/** 0.57% × 10,000원의 이진 부동소수점 오차가 57원을 56원으로 내리지 않도록 한다. */
function floorPercentage(amount: number, rate: number): number {
    const fraction = (value: number) => {
        const [coefficient, exponent = '0'] = value.toString().split('e');
        const [whole, decimal = ''] = coefficient.split('.');
        const scale = decimal.length - Number(exponent);
        const digits = BigInt(whole + decimal);
        const factor = BigInt(`1${'0'.repeat(Math.abs(scale))}`);
        return scale >= 0 ? [digits, factor] : [digits * factor, BigInt(1)];
    };
    const [amountNumerator, amountDenominator] = fraction(Math.max(0, amount));
    const [rateNumerator, rateDenominator] = fraction(rate);
    return Number((amountNumerator * rateNumerator) / (amountDenominator * rateDenominator * BigInt(100)));
}

export function buildCorporateTaxReport(evidence: Evidence[], manual: CorporateTaxManual) {
    const months = Array.from({ length: 12 }, (_, index) => {
        const month = index + 1;
        const amounts = Object.fromEntries(AMOUNT_COLUMNS.map(({ key }) => [key, 0])) as Record<AmountField, number>;
        evidence.filter(row => row.month === month).forEach(row => { amounts[row.field] += row.amount; });
        MANUAL_FIELDS.forEach(({ key }) => { amounts[key] = manual.months[month]?.amounts[key] ?? 0; });
        const expenses = AMOUNT_COLUMNS.filter(col => col.key !== 'sales').reduce((sum, col) => sum + amounts[col.key], 0);
        return { month, amounts, expenses, profit: amounts.sales - expenses };
    });
    const totals = Object.fromEntries(AMOUNT_COLUMNS.map(({ key }) => [key, months.reduce((sum, row) => sum + row.amounts[key], 0)])) as Record<AmountField, number>;
    const profit = months.reduce((sum, row) => sum + row.profit, 0);
    const estimatedTax = floorPercentage(profit, manual.taxRate);
    return { months, totals, profit, expenses: totals.sales - profit, estimatedTax,
        payableTax: Math.max(0, estimatedTax - manual.interimPayment - manual.taxCredit) };
}
