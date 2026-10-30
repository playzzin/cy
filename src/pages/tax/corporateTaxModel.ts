import type { WorkbookLedgerEntry } from '../../services/workbookLedgerService';
import type { Accommodation, UtilityRecord } from '../../types/accommodation';
import { dedupeAccommodationUtilityRecords } from '../../utils/accommodationUtilityDeduplication';
import { CorporateTaxSourceAmountError } from './corporateTaxLoadError';

export const CORPORATE_TAX_COMPANIES = [
    { key: 'cheongyeon', label: '청연', title: '(주)청연이엔지', ownership: 'Cheongyeon', ledgerPath: '/payroll/workbook-ledger' },
    { key: 'dawon', label: '다원', title: '다원', ownership: 'Dawon', ledgerPath: '/payroll/workbook-ledger-dawon' },
] as const;
export type CorporateTaxCompany = typeof CORPORATE_TAX_COMPANIES[number]['key'];
export const MANUAL_FIELDS = [
    { key: 'invoice', label: '계산서발행' }, { key: 'labor', label: '노무비신고' },
    { key: 'salary', label: '급여' }, { key: 'card', label: '카드사용금액' }, { key: 'depreciation', label: '감가상각비' },
    { key: 'condolence', label: '경조사비' }, { key: 'other', label: '기타비용' },
] as const;
export type ManualField = typeof MANUAL_FIELDS[number]['key'];
export type AutoField = 'sales' | 'purchases' | 'lodging';
export type AmountField = AutoField | ManualField;
export const AMOUNT_COLUMNS: Array<{ key: AmountField; label: string; auto: boolean }> = [
    { key: 'sales', label: '매출액', auto: true }, { key: 'purchases', label: '매입액', auto: true },
    ...MANUAL_FIELDS.slice(0, 4).map(field => ({ ...field, auto: false })),
    { key: 'lodging', label: '숙소비', auto: true },
    ...MANUAL_FIELDS.slice(4).map(field => ({ ...field, auto: false })),
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
export const emptyManual = (): CorporateTaxManual => ({ months: {}, taxRate: 10, interimPayment: 0, taxCredit: 0, memo: '' });
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

/** 법인 명의 숙소의 월세·관리비만 집계한다. 공과금은 매입과 중복 반영하지 않는다. */
export function lodgingEvidence(period: string, records: UtilityRecord[], accommodations: Accommodation[], company: CorporateTaxCompany): Evidence[] {
    const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(period);
    if (!match) throw new Error('숙소 집계 연월을 확인해 주세요.');
    const ownership = CORPORATE_TAX_COMPANIES.find(item => item.key === company)?.ownership;
    const saved = new Map(dedupeAccommodationUtilityRecords(records.filter(row => row.yearMonth === period)).map(row => [row.accommodationId, row]));
    return accommodations.filter(room => room.ownership === ownership).flatMap(room => {
        const row = saved.get(room.id);
        const start = room.contract?.startDate?.slice(0, 7);
        const end = room.contract?.endDate?.slice(0, 7);
        // 저장된 월 자료는 종료된 계약도 보존한다. 기본값은 확인 가능한 계약기간에만 적용한다.
        if (!row && (!start || period < start || (end && period > end) || (room.status === 'inactive' && !end))) return [];
        const rent = sourceAmount(row?.costs.rent ?? room.contract?.monthlyRent ?? 0);
        const maintenance = sourceAmount(row?.costs.maintenance ?? (room.costProfile?.maintenance === 'fixed' ? room.costProfile.fixedMaintenance ?? 0 : 0));
        return [{ id: row?.id || 'contract-' + room.id + '-' + period, month: Number(match[2]), field: 'lodging' as const,
            label: room.name, amount: rent + maintenance,
            description: '월세 ' + rent.toLocaleString('ko-KR') + ' + 관리비 ' + maintenance.toLocaleString('ko-KR') + ' · ' + (row ? '월별 저장 자료 (미입력 항목은 계약 기본값)' : '계약 기본값') }];
    });
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
        evidence.filter(row => row.month === month && AMOUNT_COLUMNS.some(col => col.auto && col.key === row.field)).forEach(row => { amounts[row.field] += row.amount; });
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
