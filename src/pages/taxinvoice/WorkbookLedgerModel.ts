import { WorkbookLedgerEntry, WorkbookLedgerTenant, WorkbookTransactionType } from '../../services/workbookLedgerService';
import { calculateWorkbookTotalAmount, calculateWorkbookVatAmount } from '../../utils/workbookLedgerAmounts';
import { parseWorkbookNumber } from '../../utils/workbookLedgerParsing';
import { getWorkbookNumericIssues } from '../../utils/workbookLedgerValidation';


export const ADVANCE_USAGE_SOURCE_TYPE = 'advanceUsage';

export const SUMMARY_ADVANCE_LOOKBACK_START = '1900-01-01';

export type WorkbookTab = 'input' | 'database' | 'ledger' | 'summary' | 'vat';

export type SummaryMode = '매출' | '매입' | '미수금' | '미지급금';

export type DateSearchMode = 'range' | 'month';

export type QuarterVatBasis = 'date' | 'applied';

export type QuarterVatOption = 'all' | 'Q1' | 'Q2' | 'Q3' | 'Q4';

export type QuarterVatDetailTransactionType = 'all' | WorkbookTransactionType;

export interface InputRow {
    transactionType: WorkbookTransactionType | '';
    date: string;
    partnerName: string;
    siteName: string;
    description: string;
    manDays: number | null;
    supplyAmount: number | null;
    taxAmount: number | null;
    totalAmount: number | null;
    paymentAmount: number | null;
    appliedYear: number | null;
    appliedMonth: number | null;
    note: string;
    teamName: string;
}

export type InputGridChange = [number, keyof InputRow | string | number, unknown, unknown];

export interface InputRowValidationIssue {
    rowIndex: number;
    rowNumber: number;
    fields: Array<keyof InputRow>;
    messages: string[];
}

export type WorkbookImportEntry = Omit<WorkbookLedgerEntry, 'createdAt' | 'updatedAt'>;

export interface LedgerFilter {
    startDate: string;
    endDate: string;
    teamName: string;
    transactionType: WorkbookTransactionType;
    partnerName: string;
    siteName: string;
}

export interface SummaryFilter {
    startDate: string;
    endDate: string;
    startYear?: number;
    startMonth?: number;
    startDay?: number;
    endYear?: number;
    endMonth?: number;
    endDay?: number;
    teamName: string;
    mode: SummaryMode;
    partnerName: string;
    siteName: string;
}

export interface QuarterVatFilter {
    year: number;
    quarter: QuarterVatOption;
    basis: QuarterVatBasis;
    detailTransactionType: QuarterVatDetailTransactionType;
    partnerName: string;
    siteName: string;
}

export interface LedgerRow {
    id: string;
    date: string;
    partnerName: string;
    description: string;
    transactionAmount: number;
    paymentAmount: number;
    balance: number;
    siteName: string;
    note: string;
    teamName: string;
}

export interface SummaryRow {
    id: string;
    transactionType: WorkbookTransactionType;
    partnerName: string;
    siteName: string;
    issueDate: string;
    appliedYear: number | null;
    appliedMonth: number | null;
    supplyAmount: number;
    taxAmount: number;
    totalAmount: number;
    paymentDates: string[];
    settledAmount: number;
    advanceUsedAmount: number;
    outstandingAmount: number;
    advanceAmount: number;
    settlementEntryIds: string[];
    note: string;
    teamName: string;
}

export interface QuarterVatSummaryRow {
    quarter: QuarterVatOption;
    label: string;
    periodLabel: string;
    salesSupply: number;
    salesVat: number;
    salesTotal: number;
    purchaseSupply: number;
    purchaseVat: number;
    purchaseTotal: number;
    payableVat: number;
    entryCount: number;
    warningCount: number;
}

export interface QuarterVatMonthlyRow {
    month: number;
    label: string;
    salesSupply: number;
    salesVat: number;
    salesTotal: number;
    purchaseSupply: number;
    purchaseVat: number;
    purchaseTotal: number;
    payableVat: number;
    entryCount: number;
    warningCount: number;
}

export interface QuarterVatDetailRow {
    id: string;
    transactionType: WorkbookTransactionType;
    date: string;
    periodLabel: string;
    quarter: QuarterVatOption;
    partnerName: string;
    siteName: string;
    description: string;
    supplyAmount: number;
    taxAmount: number;
    expectedTaxAmount: number;
    totalAmount: number;
    expectedTotalAmount: number;
    issues: string[];
    note: string;
    teamName: string;
}

export interface QuarterVatReport {
    quarterRows: QuarterVatSummaryRow[];
    monthlyRows: QuarterVatMonthlyRow[];
    detailRows: QuarterVatDetailRow[];
    warningRows: QuarterVatDetailRow[];
    totals: QuarterVatSummaryRow;
}

export type StyledExcelCell = {
    t?: string;
    v?: unknown;
    f?: string;
    s?: Record<string, unknown>;
};

export type StyledExcelWorksheet = Record<string, StyledExcelCell | unknown> & {
    '!cols'?: Array<{ wch: number }>;
    '!rows'?: Array<{ hpx: number }>;
    '!merges'?: unknown[];
    '!autofilter'?: { ref: string };
};

export type XlsxModule = typeof import('xlsx');

export interface LegacyMatchCandidate {
    id: string;
    partnerName: string;
    siteName: string;
    issueDate: string;
    appliedYear: number | null;
    appliedMonth: number | null;
    teamName: string;
}

export interface ReceiptEditDraft {
    id: string;
    date: string;
    paymentAmount: string;
    note: string;
}

export interface DbEditDraft {
    id: string;
    transactionType: WorkbookTransactionType;
    date: string;
    partnerName: string;
    siteName: string;
    description: string;
    supplyAmount: string;
    paymentAmount: string;
    appliedYear: string;
    appliedMonth: string;
    note: string;
    teamName: string;
}

export interface DatabaseDisplayRow {
    entry: WorkbookLedgerEntry;
    indexLabel: string;
    nested: boolean;
}

export type DbPaymentMappingMode = 'all' | 'unmappedPayments';

export type PaymentMappingStatus = 'linked' | 'auto' | 'ambiguous' | 'none';

export interface PaymentMatchCandidate {
    entry: WorkbookLedgerEntry;
    linkedPaymentAmount: number;
    outstandingAmount: number;
    score: number;
    reasons: string[];
}

export interface PaymentMatchContext {
    invoiceEntriesByPartnerKey: Map<string, WorkbookLedgerEntry[]>;
    linkedPaymentTotalsByInvoiceId: Map<string, number>;
    entriesById: Map<string, WorkbookLedgerEntry>;
}

export interface PaymentMappingSuggestion {
    status: PaymentMappingStatus;
    candidates: PaymentMatchCandidate[];
}

export type DbSortField = 'date' | 'partnerName' | 'amount';

export interface DbSortState {
    field: DbSortField;
    direction: 'asc' | 'desc';
}

export interface DbFilterState {
    transactionType: string;
    date: string;
    partnerName: string;
    siteName: string;
    description: string;
    supplyAmount: string;
    taxAmount: string;
    totalAmount: string;
    paymentAmount: string;
    appliedYear: string;
    appliedMonth: string;
    note: string;
    teamName: string;
}

export const INPUT_ROW_COUNT = 80;

export const DB_PAGE_SIZE = 100;

export const SUMMARY_PAGE_SIZE = 200;

export const DB_INITIAL_LOAD_LIMIT = 300;

export const INPUT_GRID_DERIVED_SOURCE = 'workbook-input-derived';

export const INPUT_GRID_MOUSE_COMMIT_SOURCE = 'workbook-input-mouse-commit';

export const INPUT_GRID_AMOUNT_COLUMNS = new Set([6, 7, 8, 9]);

export const INPUT_GRID_AMOUNT_PROPS = new Set<keyof InputRow>([
    'supplyAmount',
    'taxAmount',
    'totalAmount',
    'paymentAmount'
]);

export const INPUT_GRID_COLUMN_PROPS: Array<keyof InputRow> = [
    'transactionType',
    'date',
    'partnerName',
    'siteName',
    'description',
    'manDays',
    'supplyAmount',
    'taxAmount',
    'totalAmount',
    'paymentAmount',
    'appliedYear',
    'appliedMonth',
    'note',
    'teamName'
];

export const isInputGridAmountColumn = (columnIndex: number) => INPUT_GRID_AMOUNT_COLUMNS.has(columnIndex);

export type EntryLoadScope = 'none' | 'recent' | 'range' | 'summary' | 'type' | 'all';

export interface EntryLoadQuery {
    scope: EntryLoadScope;
    startDate?: string;
    endDate?: string;
    paymentCutoffDate?: string;
    transactionType?: WorkbookTransactionType;
    limitCount?: number;
    orderDirection?: 'asc' | 'desc';
}

export const createRecentDbEntryLoadQuery = (): EntryLoadQuery => ({
    scope: 'recent',
    limitCount: DB_INITIAL_LOAD_LIMIT,
    orderDirection: 'desc'
});

export const createAllEntryLoadQuery = (): EntryLoadQuery => ({
    scope: 'all',
    orderDirection: 'asc'
});

export const createTransactionTypeEntryLoadQuery = (transactionType: WorkbookTransactionType): EntryLoadQuery => ({
    scope: 'type',
    transactionType,
    orderDirection: 'asc'
});

export const createRangeEntryLoadQuery = (
    startDate: string,
    endDate: string,
    transactionType?: WorkbookTransactionType
): EntryLoadQuery => {
    const normalizedStart = String(startDate ?? '').trim();
    const normalizedEnd = String(endDate ?? '').trim();

    if (normalizedStart && normalizedEnd && normalizedStart > normalizedEnd) {
        return {
            scope: 'range',
            startDate: normalizedEnd,
            endDate: normalizedStart,
            transactionType,
            orderDirection: 'asc'
        };
    }

    return {
        scope: 'range',
        startDate: normalizedStart,
        endDate: normalizedEnd,
        transactionType,
        orderDirection: 'asc'
    };
};

export const buildEntryLoadQueryKey = (entryQuery: EntryLoadQuery) => [
    entryQuery.scope,
    entryQuery.startDate ?? '',
    entryQuery.endDate ?? '',
    entryQuery.paymentCutoffDate ?? '',
    entryQuery.transactionType ?? '',
    entryQuery.limitCount ?? '',
    entryQuery.orderDirection ?? 'asc'
].join('|');

export const getEntryLoadScopeText = (scope: EntryLoadScope, count: number) => {
    if (scope === 'all') return `전체 ${count.toLocaleString()}건`;
    if (scope === 'type') return `구분별 ${count.toLocaleString()}건`;
    if (scope === 'recent') return `최근 ${count.toLocaleString()}건`;
    if (scope === 'range') return `기간 ${count.toLocaleString()}건`;
    if (scope === 'summary') return `기간 정산 ${count.toLocaleString()}건`;
    return '미로드';
};

export interface RefreshPageDataOptions {
    forceEntries?: boolean;
    forceCatalogs?: boolean;
    loadEntries?: boolean;
    entryQuery?: EntryLoadQuery;
    silent?: boolean;
}

export const buildDefaultLedgerStart = (date: Date) => (
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`
);

export const WORKBOOK_TABS: Array<{ id: WorkbookTab; label: string }> = [
    { id: 'input', label: '입력폼' },
    { id: 'database', label: 'DB' },
    { id: 'ledger', label: '조회 (매출, 매입 거래장)' },
    { id: 'summary', label: '전체 조회' },
    { id: 'vat', label: '분기 부가세' },
];

export const getWorkbookTabStorageKey = (tenantKey: WorkbookLedgerTenant | string) => (
    `workbook-ledger:${tenantKey}:active-tab`
);

export const getInitialWorkbookTab = (tenantKey: WorkbookLedgerTenant | string): WorkbookTab => {
    if (typeof window === 'undefined') return 'input';

    try {
        const savedTab = window.sessionStorage.getItem(getWorkbookTabStorageKey(tenantKey));
        return WORKBOOK_TABS.some((tab) => tab.id === savedTab)
            ? savedTab as WorkbookTab
            : 'input';
    } catch {
        return 'input';
    }
};

export const saveWorkbookTab = (tenantKey: WorkbookLedgerTenant | string, tab: WorkbookTab) => {
    if (typeof window === 'undefined') return;

    try {
        window.sessionStorage.setItem(getWorkbookTabStorageKey(tenantKey), tab);
    } catch {
        // Storage can be unavailable in private or restricted browser contexts.
    }
};

export const SUMMARY_MODE_TABS: SummaryMode[] = ['매출', '매입', '미수금', '미지급금'];

export const TENANT_TABS: Array<{ key: WorkbookLedgerTenant; label: string; path: string; colorClass: string }> = [
    { key: 'cheongyeon', label: '청연', path: '/payroll/workbook-ledger', colorClass: 'tenant-cheongyeon' },
    { key: 'dawon', label: '다원', path: '/payroll/workbook-ledger-dawon', colorClass: 'tenant-dawon' }
];

export const DB_HEADERS = [
    '구분',
    '날짜',
    '거래처명',
    '현장명',
    '내용',
    '공급가액',
    '부가세',
    '합계',
    '입금금액',
    '적용연도',
    '적용월',
    '매칭매출ID',
    '비고',
    '팀명',
    '거래ID',
    '공수',
    '출처유형',
    '출처ID',
    '출처월',
] as const;

export const NOTE_HEADER_ALIASES = ['비고', '비 고', '메모', '비고/메모', '메모/비고', '특이사항', 'remark', 'remarks', 'memo', 'note'] as const;

export const emptyInputRow = (): InputRow => ({
    transactionType: '',
    date: '',
    partnerName: '',
    siteName: '',
    description: '',
    manDays: null,
    supplyAmount: null,
    taxAmount: null,
    totalAmount: null,
    paymentAmount: null,
    appliedYear: null,
    appliedMonth: null,
    note: '',
    teamName: ''
});

export const createEmptyInputRows = () => Array.from({ length: INPUT_ROW_COUNT }, emptyInputRow);

export const emptyDbFilter = (): DbFilterState => ({
    transactionType: '',
    date: '',
    partnerName: '',
    siteName: '',
    description: '',
    supplyAmount: '',
    taxAmount: '',
    totalAmount: '',
    paymentAmount: '',
    appliedYear: '',
    appliedMonth: '',
    note: '',
    teamName: ''
});

export const normalizeInputRows = (rows: Array<Partial<InputRow> | null | undefined>, baseYear: number, selectedTeam: string) =>
    rows.map((row) => normalizeInputRowForGrid(row, baseYear, selectedTeam));

export const formatDateInput = (date: Date) => (
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
);

export const formatDateInputForGrid = (normalizedDate: string) => normalizedDate;

export const isSupportedInputYear = (value: number): boolean => (
    Number.isInteger(value) && value >= 2000 && value <= 2100
);

export const parseInputYear = (value: unknown): number | null => {
    const firstCell = String(value ?? '')
        .split(/\t|\r\n|\n|\r/)
        .map((part) => part.trim())
        .find(Boolean) ?? '';

    if (!firstCell) return null;

    const fullYearMatch = firstCell.match(/\b(19\d{2}|20\d{2}|2100)\b/);
    if (fullYearMatch) {
        const year = Number(fullYearMatch[1]);
        return isSupportedInputYear(year) ? year : null;
    }

    const compactDigits = firstCell.replace(/\D/g, '');
    if (compactDigits.length >= 4) {
        const year = Number(compactDigits.slice(0, 4));
        if (isSupportedInputYear(year)) return year;
    }

    const twoDigitYearMatch = firstCell.match(/^\d{2}(?:[-./]\d{1,2}[-./]\d{1,2})?$/);
    if (twoDigitYearMatch) {
        const year = 2000 + Number(firstCell.slice(0, 2));
        return isSupportedInputYear(year) ? year : null;
    }

    return null;
};

export const expandDateYear = (yearText: string): number => {
    const year = Number(yearText);
    if (!Number.isFinite(year)) return NaN;
    return yearText.length === 2 ? 2000 + year : year;
};

export const formatDateParts = (year: number, month: number, day: number) => (
    `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
);

export const normalizeDateParts = (yearText: string, monthText: string, dayText: string): string => {
    const yearNumber = expandDateYear(yearText);
    const monthNumber = Number(monthText);
    const dayNumber = Number(dayText);

    if (
        !Number.isFinite(yearNumber) ||
        !Number.isInteger(monthNumber) ||
        !Number.isInteger(dayNumber) ||
        monthNumber < 1 ||
        monthNumber > 12 ||
        dayNumber < 1 ||
        dayNumber > 31
    ) {
        return '';
    }

    const parsed = new Date(yearNumber, monthNumber - 1, dayNumber);
    if (
        parsed.getFullYear() !== yearNumber ||
        parsed.getMonth() !== monthNumber - 1 ||
        parsed.getDate() !== dayNumber
    ) {
        return '';
    }

    return formatDateParts(yearNumber, monthNumber, dayNumber);
};

export const formatNumber = (value: number | null | undefined) => {
    if (value === null || value === undefined || !Number.isFinite(value)) return '-';
    return new Intl.NumberFormat('ko-KR').format(value);
};

export const EXCEL_REPORT_BORDER = {
    top: { style: 'thin', color: { rgb: 'CBD5E1' } },
    bottom: { style: 'thin', color: { rgb: 'CBD5E1' } },
    left: { style: 'thin', color: { rgb: 'CBD5E1' } },
    right: { style: 'thin', color: { rgb: 'CBD5E1' } },
};

export const getExcelFill = (rgb: string) => ({
    fgColor: { rgb },
    patternType: 'solid'
});

export const getOrCreateStyledExcelCell = (worksheet: StyledExcelWorksheet, address: string): StyledExcelCell => {
    const existing = worksheet[address];
    if (existing && typeof existing === 'object') return existing as StyledExcelCell;

    const nextCell: StyledExcelCell = { t: 's', v: '' };
    worksheet[address] = nextCell;
    return nextCell;
};

export const applyExcelRangeStyle = (
    xlsx: XlsxModule,
    worksheet: StyledExcelWorksheet,
    rangeText: string,
    style: Record<string, unknown>
) => {
    const range = xlsx.utils.decode_range(rangeText);
    for (let row = range.s.r; row <= range.e.r; row += 1) {
        for (let column = range.s.c; column <= range.e.c; column += 1) {
            const address = xlsx.utils.encode_cell({ r: row, c: column });
            getOrCreateStyledExcelCell(worksheet, address).s = style;
        }
    }
};

export const mergeExcelCells = (xlsx: XlsxModule, worksheet: StyledExcelWorksheet, rangeText: string) => {
    worksheet['!merges'] = [
        ...(worksheet['!merges'] ?? []),
        xlsx.utils.decode_range(rangeText)
    ];
};

export const setExcelRowHeight = (worksheet: StyledExcelWorksheet, rowNumber: number, height: number) => {
    const rows = worksheet['!rows'] ?? [];
    rows[rowNumber - 1] = { hpx: height };
    worksheet['!rows'] = rows;
};

export const toNumberOrNull = (value: unknown): number | null => {
    return parseWorkbookNumber(value);
};

export const formatAmountInputValue = (value: unknown) => {
    const amount = toNumberOrNull(value);
    return amount === null ? '' : formatNumber(amount);
};

export const normalizeInputGridAmountValue = (value: unknown): unknown => {
    const parsed = parseWorkbookNumber(value);
    return parsed === null ? value : parsed;
};

export const normalizeText = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

export const normalizeHeaderKey = (value: unknown) => normalizeText(value).replace(/\s+/g, '').toLowerCase();

export const normalizeBankName = (value: unknown) => (
    String(value ?? '')
        .toLowerCase()
        .replace(/\s+/g, '')
        .trim()
);

export const KB_BANK_CODE_BY_NAME = new Map<string, string>([
    ['한국은행', '001'],
    ['산업은행', '002'], ['kdb', '002'],
    ['기업은행', '003'], ['기업', '003'], ['ibk', '003'], ['ibk기업은행', '003'], ['ibk기업', '003'],
    ['국민은행', '004'], ['국민', '004'], ['kb국민', '004'], ['kb국민은행', '004'], ['kb', '004'],
    ['수협은행', '007'], ['수협', '007'], ['sh수협', '007'],
    ['수출입은행', '008'],
    ['농협은행', '011'], ['nh농협은행', '011'], ['nh농협', '011'], ['농협', '011'],
    ['지역농협', '012'], ['농축협', '012'],
    ['우리은행', '020'], ['우리', '020'],
    ['sc제일은행', '023'], ['제일은행', '023'], ['sc', '023'],
    ['한국씨티은행', '027'], ['씨티은행', '027'], ['씨티', '027'],
    ['대구은행', '031'], ['im뱅크', '031'], ['dgb', '031'],
    ['부산은행', '032'], ['bnk부산', '032'],
    ['광주은행', '034'],
    ['제주은행', '035'],
    ['전북은행', '037'],
    ['경남은행', '039'], ['bnk경남', '039'],
    ['새마을금고', '045'], ['mg새마을', '045'], ['mg', '045'],
    ['신협', '048'],
    ['상호저축은행', '050'], ['저축은행', '050'],
    ['우체국', '071'], ['우체국예금', '071'],
    ['하나은행', '081'], ['keb하나', '081'], ['하나', '081'],
    ['신한은행', '088'], ['신한', '088'],
    ['케이뱅크', '089'], ['k뱅크', '089'],
    ['카카오뱅크', '090'], ['카카오', '090'],
    ['토스뱅크', '092'], ['토스', '092'],
]);

export const normalizePartnerMatchKey = (value: unknown) => normalizeText(value)
    .toLowerCase()
    .replace(/\(주\)|㈜|주식회사/g, '')
    .replace(/\s+/g, '')
    .replace(/[^0-9a-z가-힣]/g, '');

export const escapeHtml = (value: string) => value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export interface PrintColumnSpec {
    className: string;
    width: string;
}

export const LEDGER_PRINT_COLUMNS: PrintColumnSpec[] = [
    { className: 'print-ledger-col-date', width: '78px' },
    { className: 'print-ledger-col-partner', width: '170px' },
    { className: 'print-ledger-col-description', width: '200px' },
    { className: 'print-ledger-col-transaction', width: '92px' },
    { className: 'print-ledger-col-payment', width: '92px' },
    { className: 'print-ledger-col-balance', width: '92px' },
    { className: 'print-ledger-col-site', width: '220px' },
    { className: 'print-ledger-col-note', width: '72px' },
    { className: 'print-ledger-col-team', width: '56px' }
];

export const SUMMARY_PRINT_COLUMNS: PrintColumnSpec[] = [
    { className: 'print-summary-col-no', width: '38px' },
    { className: 'print-summary-col-partner', width: '150px' },
    { className: 'print-summary-col-site', width: '250px' },
    { className: 'print-summary-col-issue-date', width: '90px' },
    { className: 'print-summary-col-amount', width: '94px' },
    { className: 'print-summary-col-tax', width: '84px' },
    { className: 'print-summary-col-total', width: '94px' },
    { className: 'print-summary-col-payment-date', width: '90px' },
    { className: 'print-summary-col-settled', width: '94px' },
    { className: 'print-summary-col-outstanding', width: '100px' },
    { className: 'print-summary-col-advance', width: '94px' },
    { className: 'print-summary-col-note', width: '60px' },
    { className: 'print-summary-col-team', width: '48px' }
];

export const buildPrintColGroup = (columns: PrintColumnSpec[]) => `
                            <colgroup>
                                ${columns.map((column) => `<col class="${column.className}" />`).join('')}
                            </colgroup>
                        `;

export const buildPrintColumnStyles = (columns: PrintColumnSpec[]) => columns
    .map((column) => `.${column.className} { width: ${column.width}; }`)
    .join('\n');

export const getPrintTableTheme = (tenantKey: WorkbookLedgerTenant | string) => {
    if (tenantKey === 'dawon') {
        return {
            headerBackground: '#dc2626',
            headerColor: '#f8fafc',
            summaryHeaderBackground: '#fee2e2',
            summaryHeaderColor: '#7f1d1d',
            totalBackground: '#fff1f2',
            totalColor: '#7f1d1d'
        };
    }

    return {
        headerBackground: '#4338ca',
        headerColor: '#f8fafc',
        summaryHeaderBackground: '#ede9fe',
        summaryHeaderColor: '#312e81',
        totalBackground: '#f5f3ff',
        totalColor: '#312e81'
    };
};

export const normalizeTransactionType = (value: unknown): WorkbookTransactionType | null => {
    const text = normalizeText(value);
    if (text.includes('매입')) return '매입';
    if (text.includes('매출')) return '매출';
    return null;
};

export const normalizeDate = (value: unknown, fallbackYear?: number): string => {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return formatDateInput(value);
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
        const parsed = new Date(Math.round((value - 25569) * 86400 * 1000));
        return Number.isNaN(parsed.getTime()) ? '' : formatDateInput(parsed);
    }

    if (typeof value !== 'string') return '';

    const trimmed = value.trim();
    if (!trimmed) return '';

    const yearFirstMatch = trimmed.match(/^(\d{2}|\d{4})[-.](\d{1,2})[-.](\d{1,2})$/);
    if (yearFirstMatch) {
        return normalizeDateParts(yearFirstMatch[1], yearFirstMatch[2], yearFirstMatch[3]);
    }

    const slashMatch = trimmed.match(/^(\d{1,4})\/(\d{1,2})\/(\d{1,4})$/);
    if (slashMatch) {
        const [, firstText, secondText, thirdText] = slashMatch;
        const firstNumber = Number(firstText);
        const thirdNumber = Number(thirdText);

        if (firstText.length === 4 || firstNumber > 12) {
            return normalizeDateParts(firstText, secondText, thirdText);
        }

        if (thirdText.length === 2 || thirdText.length === 4 || thirdNumber > 31) {
            return normalizeDateParts(thirdText, firstText, secondText);
        }
    }

    const compactMatch = trimmed.match(/^(\d{2}|\d{4})(\d{2})(\d{2})$/);
    if (compactMatch) {
        return normalizeDateParts(compactMatch[1], compactMatch[2], compactMatch[3]);
    }

    const monthDayMatch = trimmed.match(/^(\d{1,2})[-./](\d{1,2})$/);
    if (monthDayMatch && fallbackYear) {
        return normalizeDateParts(String(fallbackYear), monthDayMatch[1], monthDayMatch[2]);
    }

    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? '' : formatDateInput(parsed);
};

export const getWorkbookMonthRange = (monthValue: string): { startDate: string; endDate: string } | null => {
    const match = String(monthValue ?? '').trim().match(/^(\d{4})-(\d{2})$/);
    if (!match) return null;

    const year = Number(match[1]);
    const month = Number(match[2]);
    if (!Number.isInteger(year) || year < 2000 || year > 2100 || month < 1 || month > 12) return null;

    const lastDay = new Date(year, month, 0).getDate();
    const normalizedMonth = `${year}-${String(month).padStart(2, '0')}`;
    return {
        startDate: `${normalizedMonth}-01`,
        endDate: `${normalizedMonth}-${String(lastDay).padStart(2, '0')}`,
    };
};

export const shiftWorkbookMonth = (monthValue: string, offset: number): string => {
    const range = getWorkbookMonthRange(monthValue);
    if (!range || !Number.isInteger(offset)) return monthValue;

    const year = Number(range.startDate.slice(0, 4));
    const month = Number(range.startDate.slice(5, 7));
    const shifted = new Date(year, month - 1 + offset, 1);
    return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, '0')}`;
};

export const getMonthFromDate = (date: string): number | null => {
    const normalized = normalizeDate(date);
    if (!normalized) return null;
    return Number(normalized.slice(5, 7));
};

export const getYearFromDate = (date: string): number | null => {
    const normalized = normalizeDate(date);
    if (!normalized) return null;
    return Number(normalized.slice(0, 4));
};

export const toDbRow = (entry: WorkbookLedgerEntry) => ([
    entry.transactionType,
    entry.date || '',
    entry.partnerName || '',
    entry.siteName || '',
    entry.description || '',
    entry.supplyAmount || '',
    entry.taxAmount || '',
    entry.totalAmount || '',
    entry.paymentAmount || '',
    entry.appliedYear ?? '',
    entry.appliedMonth ?? '',
    entry.matchedEntryId || '',
    entry.note || '',
    entry.teamName || '',
    entry.id || '', entry.manDays ?? '', entry.sourceType || '', entry.sourceId || '', entry.sourceMonth || ''
]);

export const createDbEditDraft = (entry: WorkbookLedgerEntry): DbEditDraft => ({
    id: entry.id ?? '',
    transactionType: entry.transactionType,
    date: entry.date || '',
    partnerName: entry.partnerName || '',
    siteName: entry.siteName || '',
    description: entry.description || '',
    supplyAmount: String(entry.supplyAmount ?? 0),
    paymentAmount: String(entry.paymentAmount ?? 0),
    appliedYear: entry.appliedYear ? String(entry.appliedYear) : '',
    appliedMonth: entry.appliedMonth ? String(entry.appliedMonth) : '',
    note: entry.note || '',
    teamName: entry.teamName || ''
});

export const hasInputContent = (row: InputRow) => {
    return Boolean(
        row.transactionType ||
        row.date ||
        row.partnerName ||
        row.siteName ||
        row.description ||
        row.note ||
        toNumberOrNull(row.manDays) !== null ||
        toNumberOrNull(row.supplyAmount) !== null ||
        toNumberOrNull(row.paymentAmount) !== null
    );
};

export const coerceInputRow = (row: Partial<InputRow> | null | undefined): InputRow => ({
    ...emptyInputRow(),
    ...(row ?? {})
});

export const toInputText = (value: unknown) => {
    if (value === null || value === undefined) return '';
    return typeof value === 'string' ? value : String(value);
};

export const normalizeInputDateForGrid = (value: unknown, baseYear: number): string => {
    const normalizedDate = normalizeDate(value, baseYear);
    if (normalizedDate) return formatDateInputForGrid(normalizedDate);
    return toInputText(value);
};

export const normalizeInputRowForGrid = (
    row: Partial<InputRow> | null | undefined,
    baseYear: number,
    selectedTeam: string
): InputRow => {
    const source = coerceInputRow(row);
    const normalizedDate = normalizeDate(source.date, baseYear);
    const date = normalizeInputDateForGrid(source.date, baseYear);
    const supplyAmount = toNumberOrNull(source.supplyAmount);
    const taxAmount = supplyAmount === null ? null : calculateWorkbookVatAmount(supplyAmount);
    const totalAmount = supplyAmount === null ? null : calculateWorkbookTotalAmount(supplyAmount);
    const paymentAmount = toNumberOrNull(source.paymentAmount);
    const manDays = toNumberOrNull(source.manDays);
    const appliedMonth = normalizedDate
        ? (toNumberOrNull(source.appliedMonth) ?? getMonthFromDate(normalizedDate))
        : null;
    const rowHasContent = hasInputContent({
        ...source,
        date,
        partnerName: toInputText(source.partnerName),
        siteName: toInputText(source.siteName),
        description: toInputText(source.description),
        note: toInputText(source.note),
        supplyAmount,
        paymentAmount,
        manDays
    });

    return {
        transactionType: normalizeTransactionType(source.transactionType) ?? '',
        date,
        partnerName: toInputText(source.partnerName),
        siteName: toInputText(source.siteName),
        description: toInputText(source.description),
        manDays,
        supplyAmount,
        taxAmount,
        totalAmount,
        paymentAmount,
        appliedYear: normalizedDate ? baseYear : null,
        appliedMonth,
        note: toInputText(source.note),
        teamName: rowHasContent ? (toInputText(source.teamName) || selectedTeam) : ''
    };
};

export const INPUT_GRID_DERIVED_PROPS: Array<keyof InputRow> = [
    'taxAmount',
    'totalAmount',
    'appliedYear',
    'appliedMonth'
];

export const isEmptyInputGridValue = (value: unknown) => value === null || value === undefined || value === '';

export const areInputGridValuesEqual = (left: unknown, right: unknown) => {
    if (left === right) return true;
    if (isEmptyInputGridValue(left) && isEmptyInputGridValue(right)) return true;
    return false;
};

export const isInputGridAmountProp = (prop: unknown) => {
    if (typeof prop === 'number') return isInputGridAmountColumn(prop);
    if (typeof prop === 'string') {
        if (INPUT_GRID_AMOUNT_PROPS.has(prop as keyof InputRow)) return true;

        const numericProp = Number(prop);
        return Number.isInteger(numericProp) && isInputGridAmountColumn(numericProp);
    }
    return false;
};

export const normalizeInputGridAmountChanges = (changes: Array<unknown>) => {
    changes.forEach((change) => {
        if (!Array.isArray(change)) return;
        if (!change || !isInputGridAmountProp(change[1])) return;
        change[3] = normalizeInputGridAmountValue(change[3]);
    });
};

export const normalizeInputGridPastedData = (data: unknown[][], startColumn: number) => {
    const normalizedStartColumn = Number.isInteger(startColumn) ? startColumn : 0;

    data.forEach((row) => {
        if (!Array.isArray(row)) return;

        row.forEach((cellValue, columnOffset) => {
            if (!isInputGridAmountColumn(normalizedStartColumn + columnOffset)) return;
            row[columnOffset] = normalizeInputGridAmountValue(cellValue);
        });
    });
};

export const applyInputGridDerivedValues = (
    hotInstance: any,
    rowIndexes: number[],
    baseYear: number,
    selectedTeam: string
) => {
    const sourceRows = hotInstance.getSourceData() as InputRow[];
    const updates: Array<[number, keyof InputRow, unknown]> = [];
    const uniqueRowIndexes = Array.from(new Set(rowIndexes));

    uniqueRowIndexes.forEach((rowIndex) => {
        if (!Number.isInteger(rowIndex) || rowIndex < 0 || rowIndex >= sourceRows.length) return;

        const sourceRow = sourceRows[rowIndex];
        const normalizedRow = normalizeInputRowForGrid(sourceRow, baseYear, selectedTeam);

        INPUT_GRID_DERIVED_PROPS.forEach((prop) => {
            if (!areInputGridValuesEqual(sourceRow?.[prop], normalizedRow[prop])) {
                updates.push([rowIndex, prop, normalizedRow[prop]]);
            }
        });
    });

    if (updates.length === 0) return;

    const applyUpdates = () => {
        updates.forEach(([rowIndex, prop, value]) => {
            hotInstance.setSourceDataAtCell(rowIndex, prop, value, INPUT_GRID_DERIVED_SOURCE);
        });
    };

    if (typeof hotInstance.batch === 'function') {
        hotInstance.batch(applyUpdates);
    } else {
        applyUpdates();
    }
};

export const hasLedgerEntryContent = (entry: WorkbookLedgerEntry) => {
    return Boolean(
        entry.transactionType ||
        entry.date ||
        entry.partnerName ||
        entry.siteName ||
        entry.description ||
        entry.note ||
        toNumberOrNull(entry.manDays) !== null ||
        (entry.supplyAmount ?? 0) > 0 ||
        (entry.taxAmount ?? 0) > 0 ||
        (entry.totalAmount ?? 0) > 0 ||
        (entry.paymentAmount ?? 0) > 0
    );
};

export const parseImportedDbEntries = (rows: unknown[][], fallbackTeamName: string, fallbackYear: number) => {
    if (rows.length === 0) {
        return { entries: [] as WorkbookImportEntry[], skipped: 0 };
    }

    const headerRow = rows[0].map((cell) => normalizeText(cell));
    const headerIndex = new Map<string, number>();
    const normalizedHeaderIndex = new Map<string, number>();
    headerRow.forEach((header, index) => {
        if (!header) return;
        headerIndex.set(header, index);

        const normalizedHeader = normalizeHeaderKey(header);
        if (normalizedHeader && !normalizedHeaderIndex.has(normalizedHeader)) {
            normalizedHeaderIndex.set(normalizedHeader, index);
        }
    });

    const requiredHeaders = ['구분', '날짜', '거래처명'];
    const hasRequiredHeaders = requiredHeaders.every((header) => (
        headerIndex.has(header) || normalizedHeaderIndex.has(normalizeHeaderKey(header))
    ));

    if (!hasRequiredHeaders) {
        throw new Error('업로드 파일에서 DB 헤더를 찾지 못했습니다. DB 시트 또는 동일한 헤더 형식의 파일을 올려주세요.');
    }

    const getHeaderIndex = (header: string) => {
        const exactIndex = headerIndex.get(header);
        if (exactIndex !== undefined) return exactIndex;
        return normalizedHeaderIndex.get(normalizeHeaderKey(header));
    };

    const readCell = (row: unknown[], header: string) => {
        const index = getHeaderIndex(header);
        return index === undefined ? '' : row[index];
    };

    const readFirstCell = (row: unknown[], headers: readonly string[]) => {
        for (const header of headers) {
            const value = readCell(row, header);
            if (normalizeText(value)) return value;
        }
        return '';
    };

    const entries: WorkbookImportEntry[] = [];
    let skipped = 0;

    rows.slice(1).forEach((row, rowIndex) => {
        const numericIssues = getWorkbookNumericIssues({
            supplyAmount: readCell(row, '공급가액'), taxAmount: readCell(row, '부가세'),
            totalAmount: readCell(row, '합계'), paymentAmount: readCell(row, '입금금액'),
            manDays: readCell(row, '공수'), appliedYear: readCell(row, '적용연도'), appliedMonth: readCell(row, '적용월'),
        });
        if (numericIssues.length) throw new Error(`${rowIndex + 2}행: ${numericIssues.map((issue) => issue.message).join(' ')}`);
        const transactionType = normalizeTransactionType(readCell(row, '구분'));
        const date = normalizeDate(readCell(row, '날짜'));
        const partnerName = normalizeText(readCell(row, '거래처명'));
        const siteName = normalizeText(
            readCell(row, '현장명')
        );
        const description = normalizeText(readCell(row, '내용'));
        const manDays = getHeaderIndex('공수') !== undefined ? toNumberOrNull(readCell(row, '공수')) : null;
        const supplyAmount = toNumberOrNull(readCell(row, '공급가액')) ?? 0;
        const taxAmount = toNumberOrNull(readCell(row, '부가세')) ?? 0;
        const totalAmount = toNumberOrNull(readCell(row, '합계')) ?? 0;
        const paymentAmount = toNumberOrNull(readCell(row, '입금금액')) ?? 0;
        const isBackupRow = Boolean(normalizeText(readCell(row, '거래ID')));
        const appliedYear = toNumberOrNull(readCell(row, '적용연도')) ?? (isBackupRow ? null : getYearFromDate(date) ?? fallbackYear);
        const appliedMonth = toNumberOrNull(
            readCell(row, '적용월')
        ) ?? (isBackupRow ? null : getMonthFromDate(date));
        const matchedEntryId = normalizeText(readCell(row, '매칭매출ID'));
        const note = normalizeText(readFirstCell(row, NOTE_HEADER_ALIASES));
        const teamName = normalizeText(
            readCell(row, '팀명')
        ) || fallbackTeamName;

        const entry: WorkbookLedgerEntry = {
            id: normalizeText(readCell(row, '거래ID')) || undefined,
            sourceType: normalizeText(readCell(row, '출처유형')),
            sourceId: normalizeText(readCell(row, '출처ID')),
            sourceMonth: normalizeText(readCell(row, '출처월')),
            transactionType: transactionType ?? '매출',
            date,
            partnerName,
            siteName,
            description,
            manDays,
            supplyAmount,
            taxAmount,
            totalAmount,
            paymentAmount,
            appliedYear,
            appliedMonth,
            matchedEntryId,
            note,
            teamName
        };

        if (!hasLedgerEntryContent(entry)) {
            skipped += 1;
            return;
        }

        if (!transactionType || !date || !partnerName) {
            skipped += 1;
            return;
        }

        entries.push(entry);
    });

    return { entries, skipped };
};

export const normalizeInputRow = (row: Partial<InputRow> | null | undefined, baseYear: number, selectedTeam: string): InputRow => {
    const source = coerceInputRow(row);
    const normalizedDate = normalizeDate(source.date, baseYear);
    const supplyAmount = toNumberOrNull(source.supplyAmount);
    const taxAmount = supplyAmount === null ? null : calculateWorkbookVatAmount(supplyAmount);
    const totalAmount = supplyAmount === null ? null : calculateWorkbookTotalAmount(supplyAmount);
    const paymentAmount = toNumberOrNull(source.paymentAmount);
    const manDays = toNumberOrNull(source.manDays);
    const rowHasContent = hasInputContent({
        ...source,
        date: normalizedDate,
        supplyAmount,
        paymentAmount,
        manDays
    });

    return {
        transactionType: normalizeTransactionType(source.transactionType) ?? '',
        date: normalizedDate,
        partnerName: normalizeText(source.partnerName),
        siteName: normalizeText(source.siteName),
        description: normalizeText(source.description),
        manDays,
        supplyAmount,
        taxAmount,
        totalAmount,
        paymentAmount,
        appliedYear: normalizedDate ? baseYear : null,
        appliedMonth: normalizedDate ? (toNumberOrNull(source.appliedMonth) ?? getMonthFromDate(normalizedDate)) : null,
        note: normalizeText(source.note),
        teamName: rowHasContent ? (normalizeText(source.teamName) || selectedTeam) : ''
    };
};

export const getWorkbookInputRowIssues = (
    rows: Array<Partial<InputRow> | null | undefined>,
    baseYear: number,
    selectedTeam: string
): InputRowValidationIssue[] => rows.flatMap((sourceRow, rowIndex) => {
    const row = normalizeInputRow(sourceRow, baseYear, selectedTeam);
    if (!hasInputContent(row)) return [];

    const fields: Array<keyof InputRow> = [];
    const messages: string[] = [];
    const addIssue = (field: keyof InputRow, message: string) => {
        if (!fields.includes(field)) fields.push(field);
        messages.push(message);
    };

    if (!row.transactionType) addIssue('transactionType', '구분을 선택하세요.');
    if (!row.date) addIssue('date', '유효한 날짜를 입력하세요.');
    if (!row.partnerName) addIssue('partnerName', '거래처명을 입력하세요.');
    getWorkbookNumericIssues(sourceRow ?? {}).forEach((issue) => addIssue(issue.field, issue.message));
    getWorkbookNumericIssues({ appliedYear: row.appliedYear, appliedMonth: row.appliedMonth })
        .forEach((issue) => addIssue(issue.field, issue.message));

    const totalAmount = toNumberOrNull(row.totalAmount) ?? 0;
    const paymentAmount = toNumberOrNull(row.paymentAmount) ?? 0;
    if (totalAmount === 0 && paymentAmount <= 0) {
        addIssue('supplyAmount', '공급가액 또는 입금금액을 입력하세요.');
        addIssue('paymentAmount', '공급가액 또는 입금금액을 입력하세요.');
    }

    if (messages.length === 0) return [];
    return [{
        rowIndex,
        rowNumber: rowIndex + 1,
        fields,
        messages: Array.from(new Set(messages))
    }];
});

export const createWorkbookImportDuplicateFingerprint = (
    entry: Pick<WorkbookLedgerEntry, 'transactionType' | 'date' | 'partnerName' | 'siteName' | 'totalAmount' | 'paymentAmount'>
): string => {
    const transactionType = normalizeTransactionType(entry.transactionType);
    const date = normalizeDate(entry.date);
    const partnerName = normalizePartnerMatchKey(entry.partnerName);
    const siteName = normalizePartnerMatchKey(entry.siteName);
    const totalAmount = toNumberOrNull(entry.totalAmount) ?? 0;
    const paymentAmount = toNumberOrNull(entry.paymentAmount) ?? 0;
    const amount = totalAmount !== 0 ? totalAmount : paymentAmount;
    const entryKind = totalAmount !== 0 ? 'invoice' : 'payment';

    if (!transactionType || !date || !partnerName || amount === 0) return '';
    return [transactionType, date, partnerName, siteName, entryKind, amount].join('|');
};

export const partitionWorkbookImportDuplicates = (
    importedEntries: WorkbookImportEntry[],
    existingEntries: WorkbookLedgerEntry[]
) => {
    const knownFingerprints = new Set(
        existingEntries
            .map(createWorkbookImportDuplicateFingerprint)
            .filter(Boolean)
    );
    const newEntries: WorkbookImportEntry[] = [];
    const duplicateEntries: WorkbookImportEntry[] = [];

    importedEntries.forEach((entry) => {
        const fingerprint = createWorkbookImportDuplicateFingerprint(entry);
        if (fingerprint && knownFingerprints.has(fingerprint)) {
            duplicateEntries.push(entry);
            return;
        }

        newEntries.push(entry);
        if (fingerprint) knownFingerprints.add(fingerprint);
    });

    return { newEntries, duplicateEntries };
};

export const sortWorkbookEntries = (left: WorkbookLedgerEntry, right: WorkbookLedgerEntry) => {
    const dateCompare = (left.date ?? '').localeCompare(right.date ?? '', 'en');
    if (dateCompare !== 0) return dateCompare;

    const createdCompare = (left.createdAt ?? '').localeCompare(right.createdAt ?? '', 'en');
    if (createdCompare !== 0) return createdCompare;

    return (left.id ?? '').localeCompare(right.id ?? '', 'en');
};

export const getDbEntrySortAmount = (entry: WorkbookLedgerEntry) => {
    if ((entry.totalAmount ?? 0) !== 0) return entry.totalAmount ?? 0;
    return entry.paymentAmount ?? 0;
};

export const compareDbEntriesBySortState = (
    left: WorkbookLedgerEntry,
    right: WorkbookLedgerEntry,
    sortState: DbSortState
) => {
    const fallbackCompare = sortWorkbookEntries(left, right);
    const direction = sortState.direction === 'asc' ? 1 : -1;

    if (sortState.field === 'date') {
        return fallbackCompare * direction;
    }

    if (sortState.field === 'partnerName') {
        const nameCompare = (left.partnerName ?? '').localeCompare(right.partnerName ?? '', 'ko');
        if (nameCompare !== 0) return nameCompare * direction;

        const siteCompare = (left.siteName ?? '').localeCompare(right.siteName ?? '', 'ko');
        if (siteCompare !== 0) return siteCompare * direction;

        return fallbackCompare;
    }

    const amountCompare = getDbEntrySortAmount(left) - getDbEntrySortAmount(right);
    if (amountCompare !== 0) {
        return amountCompare * direction;
    }

    return fallbackCompare;
};

export const sortSummaryRowsByDate = (left: SummaryRow, right: SummaryRow) => {
    const dateCompare = (left.issueDate ?? '').localeCompare(right.issueDate ?? '', 'en');
    if (dateCompare !== 0) return dateCompare;

    const partnerCompare = (left.partnerName ?? '').localeCompare(right.partnerName ?? '', 'ko-KR', {
        numeric: true,
        sensitivity: 'base'
    });
    if (partnerCompare !== 0) return partnerCompare;

    return (left.id ?? '').localeCompare(right.id ?? '', 'en');
};

export const matchesFilter = (source: string | undefined, keyword: string) => {
    if (!keyword.trim()) return true;
    return (source ?? '').toLowerCase().includes(keyword.trim().toLowerCase());
};

export const isDateWithinRange = (date: string | undefined, startDate: string, endDate: string) => {
    const normalizedDate = normalizeDate(date);
    if (!normalizedDate) return false;
    return normalizedDate >= startDate && normalizedDate <= endDate;
};

export const getWorkbookEntryKey = (entry: Pick<WorkbookLedgerEntry, 'id' | 'date' | 'partnerName' | 'description'>) => (
    entry.id ?? `${entry.date}-${entry.partnerName}-${entry.description}`
);

export const isInvoiceEntry = (entry: WorkbookLedgerEntry) => (entry.totalAmount ?? 0) > 0;

export const isNegativeInvoiceEntry = (entry: WorkbookLedgerEntry) => (entry.totalAmount ?? 0) < 0;

export const isPaymentEntry = (entry: WorkbookLedgerEntry) => (entry.paymentAmount ?? 0) > 0;

export const isAdvanceUsageEntry = (entry: WorkbookLedgerEntry) => normalizeText(entry.sourceType) === ADVANCE_USAGE_SOURCE_TYPE;

export const isSummarySettlementMode = (mode: SummaryMode) => mode === '미수금' || mode === '미지급금';

export const isStandalonePaymentEntry = (entry: WorkbookLedgerEntry) => isPaymentEntry(entry) && (entry.totalAmount ?? 0) <= 0;

export const isUnmappedPaymentEntry = (entry: WorkbookLedgerEntry) => isStandalonePaymentEntry(entry) && !normalizeText(entry.matchedEntryId);

export const SETTLEMENT_AMOUNT_EPSILON = 0.5;

export const canUseSummaryRangePreview = (entries: WorkbookLedgerEntry[]) => {
    const entryIds = new Set(
        entries.map((entry) => normalizeText(entry.id)).filter(Boolean)
    );

    return !entries.some((entry) => {
        if (isUnmappedPaymentEntry(entry)) return true;
        if (isNegativeInvoiceEntry(entry) && !normalizeText(entry.matchedEntryId)) return true;
        if (!isAdvanceUsageEntry(entry)) return false;

        const sourceId = normalizeText(entry.sourceId);
        const targetId = normalizeText(entry.matchedEntryId);
        return !sourceId || !targetId || !entryIds.has(sourceId) || !entryIds.has(targetId);
    });
};

export const getLinkedSettlementStatus = (
    invoice: Pick<WorkbookLedgerEntry, 'id' | 'totalAmount' | 'paymentAmount'>,
    linkedEntries: WorkbookLedgerEntry[],
) => {
    const invoiceId = normalizeText(invoice.id);
    const activeLinkedEntries = linkedEntries.filter((entry) => (
        !normalizeText(entry.deletedAt) &&
        normalizeText(entry.matchedEntryId) === invoiceId &&
        (isPaymentEntry(entry) || isNegativeInvoiceEntry(entry))
    ));
    const originalSettlementAmount = Math.max(invoice.paymentAmount ?? 0, 0);
    const linkedSettlementAmount = activeLinkedEntries.reduce((total, entry) => (
        total + Math.max(entry.paymentAmount ?? 0, 0) + Math.max(-(entry.totalAmount ?? 0), 0)
    ), 0);
    const totalAmount = Math.max(invoice.totalAmount ?? 0, 0);
    const settledAmount = originalSettlementAmount + linkedSettlementAmount;
    const outstandingAmount = Math.max(totalAmount - settledAmount, 0);

    return {
        entries: activeLinkedEntries,
        settledAmount,
        outstandingAmount,
        isFullySettled: totalAmount > 0 && outstandingAmount < SETTLEMENT_AMOUNT_EPSILON,
    };
};

export const QUARTER_VAT_OPTIONS: Array<{ value: QuarterVatOption; label: string; months: number[] }> = [
    { value: 'Q1', label: '1분기', months: [1, 2, 3] },
    { value: 'Q2', label: '2분기', months: [4, 5, 6] },
    { value: 'Q3', label: '3분기', months: [7, 8, 9] },
    { value: 'Q4', label: '4분기', months: [10, 11, 12] },
];

export const getQuarterFromMonth = (month: number | null | undefined): QuarterVatOption | null => {
    if (!month || !Number.isInteger(month) || month < 1 || month > 12) return null;
    if (month <= 3) return 'Q1';
    if (month <= 6) return 'Q2';
    if (month <= 9) return 'Q3';
    return 'Q4';
};

export const getQuarterVatOption = (quarter: QuarterVatOption) =>
    QUARTER_VAT_OPTIONS.find((option) => option.value === quarter);

export const getQuarterVatLabel = (quarter: QuarterVatOption) =>
    quarter === 'all' ? '전체' : getQuarterVatOption(quarter)?.label ?? quarter;

export const getQuarterVatPeriodLabel = (year: number, quarter: QuarterVatOption) => {
    const option = getQuarterVatOption(quarter);
    if (!option) return `${year}년 전체`;
    return `${year}.${String(option.months[0]).padStart(2, '0')}~${String(option.months[2]).padStart(2, '0')}`;
};

export const getQuarterVatEntryPeriod = (entry: WorkbookLedgerEntry, basis: QuarterVatBasis) => {
    if (basis === 'applied') {
        const appliedYear = entry.appliedYear ?? getYearFromDate(entry.date);
        const appliedMonth = entry.appliedMonth ?? getMonthFromDate(entry.date);
        const quarter = getQuarterFromMonth(appliedMonth);

        return {
            year: appliedYear,
            month: appliedMonth,
            quarter,
            periodLabel: appliedYear && appliedMonth
                ? `${appliedYear}-${String(appliedMonth).padStart(2, '0')}`
                : '-',
        };
    }

    const normalizedDate = normalizeDate(entry.date);
    const year = getYearFromDate(normalizedDate);
    const month = getMonthFromDate(normalizedDate);
    const quarter = getQuarterFromMonth(month);

    return {
        year,
        month,
        quarter,
        periodLabel: normalizedDate || '-',
    };
};

export const emptyQuarterVatSummaryRow = (
    quarter: QuarterVatOption,
    label: string,
    periodLabel: string
): QuarterVatSummaryRow => ({
    quarter,
    label,
    periodLabel,
    salesSupply: 0,
    salesVat: 0,
    salesTotal: 0,
    purchaseSupply: 0,
    purchaseVat: 0,
    purchaseTotal: 0,
    payableVat: 0,
    entryCount: 0,
    warningCount: 0,
});

export const addQuarterVatAmount = (
    target: QuarterVatSummaryRow | QuarterVatMonthlyRow,
    entry: WorkbookLedgerEntry,
    warningCount: number
) => {
    const supplyAmount = entry.supplyAmount ?? 0;
    const taxAmount = entry.taxAmount ?? 0;
    const totalAmount = entry.totalAmount ?? 0;

    if (entry.transactionType === '매입') {
        target.purchaseSupply += supplyAmount;
        target.purchaseVat += taxAmount;
        target.purchaseTotal += totalAmount;
    } else {
        target.salesSupply += supplyAmount;
        target.salesVat += taxAmount;
        target.salesTotal += totalAmount;
    }

    target.payableVat = target.salesVat - target.purchaseVat;
    target.entryCount += 1;
    target.warningCount += warningCount;
};

export const getQuarterVatEntryIssues = (entry: WorkbookLedgerEntry, basis: QuarterVatBasis): string[] => {
    const issues: string[] = [];
    const supplyAmount = entry.supplyAmount ?? 0;
    const taxAmount = entry.taxAmount ?? 0;
    const totalAmount = entry.totalAmount ?? 0;
    const expectedTaxAmount = calculateWorkbookVatAmount(supplyAmount);
    const expectedTotalAmount = supplyAmount + taxAmount;

    if (!normalizeDate(entry.date)) issues.push('날짜 오류');
    if (basis === 'applied' && (!entry.appliedYear || !entry.appliedMonth)) issues.push('적용연월 없음');
    if (basis === 'applied') issues.push(...getWorkbookNumericIssues({ appliedYear: entry.appliedYear, appliedMonth: entry.appliedMonth }).map((issue) => issue.message));
    if (Math.abs(taxAmount - expectedTaxAmount) > 1) issues.push('세액 불일치');
    if (Math.abs(totalAmount - expectedTotalAmount) > 1) issues.push('합계 불일치');

    return issues;
};

export const buildQuarterVatReport = (entries: WorkbookLedgerEntry[], filter: QuarterVatFilter): QuarterVatReport => {
    const year = Number(filter.year);
    const quarterRowsByKey = new Map<QuarterVatOption, QuarterVatSummaryRow>();
    QUARTER_VAT_OPTIONS.forEach((option) => {
        quarterRowsByKey.set(
            option.value,
            emptyQuarterVatSummaryRow(option.value, option.label, getQuarterVatPeriodLabel(year, option.value))
        );
    });

    const selectedMonths = filter.quarter === 'all'
        ? Array.from({ length: 12 }, (_, index) => index + 1)
        : getQuarterVatOption(filter.quarter)?.months ?? [];
    const monthlyRowsByMonth = new Map<number, QuarterVatMonthlyRow>();
    selectedMonths.forEach((month) => {
        monthlyRowsByMonth.set(month, {
            month,
            label: `${month}월`,
            salesSupply: 0,
            salesVat: 0,
            salesTotal: 0,
            purchaseSupply: 0,
            purchaseVat: 0,
            purchaseTotal: 0,
            payableVat: 0,
            entryCount: 0,
            warningCount: 0,
        });
    });

    const allDetailRows: QuarterVatDetailRow[] = [];
    const invalidPeriodRows: QuarterVatDetailRow[] = [];

    entries
        .filter((entry) => (entry.totalAmount ?? 0) !== 0 || (entry.supplyAmount ?? 0) !== 0 || (entry.taxAmount ?? 0) !== 0)
        .filter((entry) => matchesFilter(entry.partnerName, filter.partnerName))
        .filter((entry) => matchesFilter(entry.siteName, filter.siteName))
        .forEach((entry) => {
            const period = getQuarterVatEntryPeriod(entry, filter.basis);
            const issues = getQuarterVatEntryIssues(entry, filter.basis);
            if (!period.month || !period.quarter || !period.year || !isSupportedInputYear(period.year)) {
                if (period.year !== year && getYearFromDate(entry.date) !== year) return;
                invalidPeriodRows.push({
                    id: getWorkbookEntryKey(entry), transactionType: entry.transactionType, date: entry.date,
                    periodLabel: period.periodLabel, quarter: 'all', partnerName: entry.partnerName,
                    siteName: entry.siteName ?? '', description: entry.description, supplyAmount: entry.supplyAmount,
                    taxAmount: entry.taxAmount, expectedTaxAmount: calculateWorkbookVatAmount(entry.supplyAmount),
                    totalAmount: entry.totalAmount, expectedTotalAmount: entry.supplyAmount + entry.taxAmount,
                    issues: [...issues, '집계 제외: 유효한 연월을 확인하세요.'], note: entry.note ?? '', teamName: entry.teamName ?? '',
                });
                return;
            }
            if (period.year !== year) return;
            const warningCount = issues.length > 0 ? 1 : 0;
            const quarterRow = quarterRowsByKey.get(period.quarter);
            if (quarterRow) addQuarterVatAmount(quarterRow, entry, warningCount);

            const isSelectedQuarter = filter.quarter === 'all' || filter.quarter === period.quarter;
            if (!isSelectedQuarter) return;

            const monthRow = monthlyRowsByMonth.get(period.month);
            if (monthRow) addQuarterVatAmount(monthRow, entry, warningCount);

            const supplyAmount = entry.supplyAmount ?? 0;
            const taxAmount = entry.taxAmount ?? 0;
            allDetailRows.push({
                id: getWorkbookEntryKey(entry),
                transactionType: entry.transactionType,
                date: entry.date,
                periodLabel: period.periodLabel,
                quarter: period.quarter,
                partnerName: entry.partnerName,
                siteName: entry.siteName ?? '',
                description: entry.description,
                supplyAmount,
                taxAmount,
                expectedTaxAmount: calculateWorkbookVatAmount(supplyAmount),
                totalAmount: entry.totalAmount ?? 0,
                expectedTotalAmount: supplyAmount + taxAmount,
                issues,
                note: entry.note ?? '',
                teamName: entry.teamName ?? '',
            });
        });

    const quarterRows = QUARTER_VAT_OPTIONS.map((option) => quarterRowsByKey.get(option.value))
        .filter((row): row is QuarterVatSummaryRow => Boolean(row));
    const monthlyRows = selectedMonths
        .map((month) => monthlyRowsByMonth.get(month))
        .filter((row): row is QuarterVatMonthlyRow => Boolean(row));
    const detailRows = allDetailRows
        .filter((row) => (
            filter.detailTransactionType === 'all' || row.transactionType === filter.detailTransactionType
        ));
    const warningRows = [...detailRows.filter((row) => row.issues.length > 0), ...invalidPeriodRows.filter((row) => (
        filter.detailTransactionType === 'all' || row.transactionType === filter.detailTransactionType
    ))];
    const totals = allDetailRows.reduce((accumulator, row) => {
        const syntheticEntry: WorkbookLedgerEntry = {
            transactionType: row.transactionType,
            date: row.date,
            partnerName: row.partnerName,
            siteName: row.siteName,
            description: row.description,
            supplyAmount: row.supplyAmount,
            taxAmount: row.taxAmount,
            totalAmount: row.totalAmount,
            paymentAmount: 0,
        };
        addQuarterVatAmount(accumulator, syntheticEntry, row.issues.length > 0 ? 1 : 0);
        return accumulator;
    }, emptyQuarterVatSummaryRow(
        filter.quarter,
        filter.quarter === 'all' ? `${year}년 전체` : `${year}년 ${getQuarterVatLabel(filter.quarter)}`,
        getQuarterVatPeriodLabel(year, filter.quarter)
    ));

    totals.warningCount += invalidPeriodRows.length;
    return {
        quarterRows,
        monthlyRows,
        detailRows: detailRows.sort((left, right) => {
            const dateCompare = left.date.localeCompare(right.date, 'en');
            if (dateCompare !== 0) return dateCompare;
            const typeCompare = left.transactionType.localeCompare(right.transactionType, 'ko');
            if (typeCompare !== 0) return typeCompare;
            return left.partnerName.localeCompare(right.partnerName, 'ko');
        }),
        warningRows,
        totals,
    };
};

export const getLinkedPaymentTotal = (entries: WorkbookLedgerEntry[], invoiceId: string, excludePaymentId?: string) => entries
    .filter((entry) => (
        isPaymentEntry(entry) &&
        entry.matchedEntryId === invoiceId &&
        entry.id !== excludePaymentId
    ))
    .reduce((sum, entry) => sum + (entry.paymentAmount ?? 0), 0);

export const buildPaymentMatchContext = (entries: WorkbookLedgerEntry[]): PaymentMatchContext => {
    const invoiceEntriesByPartnerKey = new Map<string, WorkbookLedgerEntry[]>();
    const linkedPaymentTotalsByInvoiceId = new Map<string, number>();
    const entriesById = new Map<string, WorkbookLedgerEntry>();

    entries.forEach((entry) => {
        if (entry.id) {
            entriesById.set(entry.id, entry);
        }

        if (entry.id && isInvoiceEntry(entry)) {
            const partnerKey = normalizePartnerMatchKey(entry.partnerName);
            if (partnerKey) {
                const bucket = invoiceEntriesByPartnerKey.get(partnerKey) ?? [];
                bucket.push(entry);
                invoiceEntriesByPartnerKey.set(partnerKey, bucket);
            }
        }

        if (isPaymentEntry(entry) && entry.matchedEntryId) {
            linkedPaymentTotalsByInvoiceId.set(
                entry.matchedEntryId,
                (linkedPaymentTotalsByInvoiceId.get(entry.matchedEntryId) ?? 0) + (entry.paymentAmount ?? 0)
            );
        }
    });

    return {
        invoiceEntriesByPartnerKey,
        linkedPaymentTotalsByInvoiceId,
        entriesById
    };
};

export const getLinkedPaymentTotalFromContext = (
    context: PaymentMatchContext,
    invoiceId: string,
    excludePaymentId?: string
) => {
    const total = context.linkedPaymentTotalsByInvoiceId.get(invoiceId) ?? 0;
    if (!excludePaymentId) return total;

    const excludedPayment = context.entriesById.get(excludePaymentId);
    if (!excludedPayment || excludedPayment.matchedEntryId !== invoiceId) {
        return total;
    }

    return total - (excludedPayment.paymentAmount ?? 0);
};

export const buildPaymentMatchCandidates = (
    entries: WorkbookLedgerEntry[],
    paymentEntry: WorkbookLedgerEntry,
    options?: { relaxed?: boolean },
    context?: PaymentMatchContext
): PaymentMatchCandidate[] => {
    const paymentAmount = paymentEntry.paymentAmount ?? 0;
    const paymentDate = normalizeDate(paymentEntry.date);
    const partnerKey = normalizePartnerMatchKey(paymentEntry.partnerName);
    const normalizedSiteName = normalizeText(paymentEntry.siteName).toLowerCase();
    const normalizedTeamName = normalizeText(paymentEntry.teamName).toLowerCase();
    const appliedYear = paymentEntry.appliedYear ?? null;
    const appliedMonth = paymentEntry.appliedMonth ?? null;
    const relaxed = options?.relaxed ?? false;

    if (paymentAmount <= 0 || !partnerKey) return [];

    const candidateEntries = context
        ? (context.invoiceEntriesByPartnerKey.get(partnerKey) ?? [])
        : entries;

    return candidateEntries
        .filter((entry) => {
            if (!entry.id || entry.id === paymentEntry.id) return false;
            if (entry.transactionType !== paymentEntry.transactionType) return false;
            if (!isInvoiceEntry(entry)) return false;
            if (normalizePartnerMatchKey(entry.partnerName) !== partnerKey) return false;
            if (paymentDate && normalizeDate(entry.date) > paymentDate) return false;
            if (!relaxed && normalizedSiteName && normalizeText(entry.siteName).toLowerCase() !== normalizedSiteName) return false;
            if (!relaxed && normalizedTeamName && normalizeText(entry.teamName).toLowerCase() !== normalizedTeamName) return false;

            const invoiceAppliedYear = entry.appliedYear ?? getYearFromDate(entry.date);
            const invoiceAppliedMonth = entry.appliedMonth ?? getMonthFromDate(entry.date);
            if (!relaxed && appliedYear !== null && invoiceAppliedYear !== appliedYear) return false;
            if (!relaxed && appliedMonth !== null && invoiceAppliedMonth !== appliedMonth) return false;

            return true;
        })
        .map((entry) => {
            const linkedPaymentAmount = entry.id
                ? context
                    ? getLinkedPaymentTotalFromContext(context, entry.id, paymentEntry.id)
                    : getLinkedPaymentTotal(entries, entry.id, paymentEntry.id)
                : 0;
            const outstandingAmount = Math.max((entry.totalAmount ?? 0) - linkedPaymentAmount, 0);
            const reasons: string[] = [];
            let score = 0;

            if (Math.abs((entry.totalAmount ?? 0) - paymentAmount) < 0.5) {
                score += 1000;
                reasons.push('합계 일치');
            }

            if (Math.abs(outstandingAmount - paymentAmount) < 0.5) {
                score += 900;
                reasons.push('잔액 일치');
            }

            if (normalizedSiteName && normalizeText(entry.siteName).toLowerCase() === normalizedSiteName) {
                score += 120;
                reasons.push('현장 일치');
            }

            if (normalizedTeamName && normalizeText(entry.teamName).toLowerCase() === normalizedTeamName) {
                score += 40;
                reasons.push('팀 일치');
            }

            const invoiceAppliedYear = entry.appliedYear ?? getYearFromDate(entry.date);
            const invoiceAppliedMonth = entry.appliedMonth ?? getMonthFromDate(entry.date);
            if (appliedYear !== null && invoiceAppliedYear === appliedYear) score += 30;
            if (appliedMonth !== null && invoiceAppliedMonth === appliedMonth) {
                score += 80;
                reasons.push('적용월 일치');
            }

            if (paymentDate) {
                const invoiceDate = normalizeDate(entry.date);
                const dayGap = invoiceDate
                    ? Math.abs(new Date(paymentDate).getTime() - new Date(invoiceDate).getTime()) / 86400000
                    : 3650;
                score += Math.max(0, 70 - Math.min(dayGap, 70));
            }

            return {
                entry,
                linkedPaymentAmount,
                outstandingAmount,
                score,
                reasons: reasons.length > 0 ? reasons : ['거래처 일치']
            };
        })
        .sort((left, right) => {
            const scoreCompare = right.score - left.score;
            if (scoreCompare !== 0) return scoreCompare;
            const dateCompare = (right.entry.date ?? '').localeCompare(left.entry.date ?? '', 'en');
            if (dateCompare !== 0) return dateCompare;
            return (left.entry.id ?? '').localeCompare(right.entry.id ?? '', 'en');
        });
};

export const getPaymentMappingSuggestion = (
    entries: WorkbookLedgerEntry[],
    paymentEntry: WorkbookLedgerEntry,
    context?: PaymentMatchContext
): PaymentMappingSuggestion => {
    if (paymentEntry.matchedEntryId) {
        return { status: 'linked', candidates: [] };
    }

    const strictCandidates = buildPaymentMatchCandidates(entries, paymentEntry, undefined, context);
    const paymentAmount = paymentEntry.paymentAmount ?? 0;
    const exactCandidates = strictCandidates.filter((candidate) => (
        Math.abs((candidate.entry.totalAmount ?? 0) - paymentAmount) < 0.5 ||
        Math.abs(candidate.outstandingAmount - paymentAmount) < 0.5
    ));

    if (exactCandidates.length === 1) {
        return { status: 'auto', candidates: exactCandidates };
    }

    if (strictCandidates.length === 1) {
        return { status: 'auto', candidates: strictCandidates };
    }

    if (strictCandidates.length > 1) {
        return { status: 'ambiguous', candidates: strictCandidates };
    }

    const relaxedCandidates = buildPaymentMatchCandidates(entries, paymentEntry, { relaxed: true }, context);
    if (relaxedCandidates.length > 0) {
        return { status: 'ambiguous', candidates: relaxedCandidates };
    }

    return { status: 'none', candidates: [] };
};

export const getPaymentMappingStatusLabel = (status: PaymentMappingStatus) => {
    if (status === 'linked') return '연결됨';
    if (status === 'auto') return '자동추천';
    if (status === 'ambiguous') return '후보다수';
    return '후보없음';
};

export const getSettlementLabels = (transactionType: WorkbookTransactionType | undefined) => {
    const isPurchase = transactionType === '매입';

    return {
        action: isPurchase ? '지급' : '입금',
        history: isPurchase ? '지급내역' : '입금내역',
        date: isPurchase ? '지급일자' : '입금일자',
        amount: isPurchase ? '지급금액' : '입금금액',
        cumulative: isPurchase ? '누적지급' : '누적입금',
        outstanding: isPurchase ? '미지급금' : '미수금',
        advance: isPurchase ? '선급금' : '선수금',
        placeholder: isPurchase ? '지급 메모' : '입금 메모',
    };
};

export const getSummaryDisplayedSettledAmount = (row: SummaryRow) => {
    return row.settledAmount;
};

export const buildLedgerExcelData = (rows: LedgerRow[], transactionType: WorkbookTransactionType) => {
    const isPurchase = transactionType === '매입';
    return [
        ['날짜', '거래처명', '내용', isPurchase ? '매입금액' : '매출금액', isPurchase ? '지급금액' : '입금금액', '잔액', '현장명', '비고', '팀명'],
        ...rows.map((row) => [row.date, row.partnerName, row.description, row.transactionAmount, row.paymentAmount, row.balance, row.siteName, row.note, row.teamName]),
        ['', '', '합계', rows.reduce((sum, row) => sum + row.transactionAmount, 0), rows.reduce((sum, row) => sum + row.paymentAmount, 0), rows[rows.length - 1]?.balance ?? 0, '', '', '']
    ];
};

export const buildSummaryExcelData = (rows: SummaryRow[], mode: SummaryMode) => {
    const isPurchase = mode === '매입' || mode === '미지급금';
    const sum = (getAmount: (row: SummaryRow) => number) => rows.reduce((total, row) => total + getAmount(row), 0);
    return [
        ['No', '거래처명', '현장명', '발행일', '공급가액', '세액', '합계', isPurchase ? '지급일' : '입금일', isPurchase ? '지급금액' : '수금금액', isPurchase ? '미지급금' : '미수금', isPurchase ? '선급금' : '선수금', '비고', '팀명'],
        ...rows.map((row, index) => [index + 1, row.partnerName, row.siteName, row.issueDate, row.supplyAmount, row.taxAmount, row.totalAmount, row.paymentDates.join('\n'), getSummaryDisplayedSettledAmount(row), row.outstandingAmount, row.advanceAmount, row.note, row.teamName]),
        ['', '합계', '', '', sum((row) => row.supplyAmount), sum((row) => row.taxAmount), sum((row) => row.totalAmount), '', sum(getSummaryDisplayedSettledAmount), sum((row) => row.outstandingAmount), sum((row) => row.advanceAmount), '', '']
    ];
};

export const AI_TAX_INVOICE_REMARK_PATTERN = /(?:gemini|ai)\s*세금\s*계산서|세금\s*계산서\s*(?:ai\s*)?(?:대량\s*)?검수|대량\s*검수/i;

export const MAPPING_ADDRESS_REMARK_PATTERN = /(?:매핑\s*주소|주소\s*매핑|mapping\s*address)\s*[:：=-]?\s*/i;

export const REMARK_SEGMENT_SEPARATOR = /\s*(?:·|\||\n)\s*|\s+\/\s+/;

export const getVisibleWorkbookRemark = (value: unknown): string => {
    const note = normalizeText(value);
    if (!note || !AI_TAX_INVOICE_REMARK_PATTERN.test(note)) return note;

    let generatedMetadata = false;
    return note
        .split(REMARK_SEGMENT_SEPARATOR)
        .map((segment) => {
            const text = normalizeText(segment);
            if (/^-?\s*Gemini\s*세금\s*계산서\s*검수$/i.test(text)) {
                generatedMetadata = true;
                return '';
            }
            if (generatedMetadata && (/\.(?:pdf|jpe?g|png|webp|heic|heif)$/i.test(text) || /^승인번호\s+\S+$/.test(text))) {
                return '';
            }
            generatedMetadata = false;
            const markerIndex = segment.search(MAPPING_ADDRESS_REMARK_PATTERN);
            if (markerIndex < 0) return normalizeText(segment);

            return normalizeText(segment.slice(0, markerIndex).replace(/[\s([,:;/-]+$/, ''));
        })
        .filter(Boolean)
        .join(' · ');
};

export const appendSummaryNote = (currentNote: string, nextNote: unknown) => {
    const current = normalizeText(currentNote);
    const next = normalizeText(nextNote);

    if (!next) return getVisibleWorkbookRemark(current);
    if (!current) return getVisibleWorkbookRemark(next);
    if (current.split(' / ').includes(next)) return getVisibleWorkbookRemark(current);

    return getVisibleWorkbookRemark(`${current} / ${next}`);
};

export const buildLedgerRows = (entries: WorkbookLedgerEntry[], filter: LedgerFilter): LedgerRow[] => {
    const scopedEntries = entries
        .filter((entry) => entry.transactionType === filter.transactionType)
        .filter((entry) => !isAdvanceUsageEntry(entry))
        .filter((entry) => entry.date >= filter.startDate && entry.date <= filter.endDate)
        .filter((entry) => matchesFilter(entry.teamName, filter.teamName))
        .filter((entry) => matchesFilter(entry.partnerName, filter.partnerName))
        .filter((entry) => matchesFilter(entry.siteName, filter.siteName))
        .sort(sortWorkbookEntries);

    let runningBalance = 0;

    return scopedEntries.map((entry) => {
        const transactionAmount = entry.totalAmount ?? 0;
        const paymentAmount = entry.paymentAmount ?? 0;
        runningBalance += transactionAmount - paymentAmount;

        return {
            id: entry.id ?? `${entry.date}-${entry.partnerName}-${entry.description}`,
            date: entry.date,
            partnerName: entry.partnerName ?? '',
            description: entry.description,
            transactionAmount,
            paymentAmount,
            balance: runningBalance,
            siteName: entry.siteName ?? '',
            note: getVisibleWorkbookRemark(entry.note),
            teamName: entry.teamName ?? ''
        };
    });
};

export const buildReceiptHistorySettlementEntries = (
    entries: WorkbookLedgerEntry[],
    _filter: SummaryFilter,
    targetId: string | null
) => {
    if (!targetId) return [];

    return entries
        .filter((entry) => {
            if (!isPaymentEntry(entry)) return false;
            return entry.matchedEntryId === targetId;
        })
        .sort(sortWorkbookEntries);
};

export const buildSummaryBaseRowsForTransaction = (
    entries: WorkbookLedgerEntry[],
    transactionType: WorkbookTransactionType,
    paymentCutoffDate: string
): SummaryRow[] => {

    const summaryInvoiceEntries: WorkbookLedgerEntry[] = [];
    const paymentEntries: WorkbookLedgerEntry[] = [];
    const advanceUsageEntries: WorkbookLedgerEntry[] = [];

    entries.forEach((entry) => {
        if (entry.transactionType !== transactionType) return;

        if ((entry.totalAmount ?? 0) !== 0) {
            summaryInvoiceEntries.push(entry);
        }

        if (!isPaymentEntry(entry)) return;
        const paymentDate = normalizeDate(entry.date);
        // The invoice date range is applied later; balances intentionally include settlements through today.
        if (!paymentDate || paymentDate > paymentCutoffDate) return;

        if (isAdvanceUsageEntry(entry)) {
            advanceUsageEntries.push(entry);
        } else {
            paymentEntries.push(entry);
        }
    });

    summaryInvoiceEntries.sort(sortWorkbookEntries);
    paymentEntries.sort(sortWorkbookEntries);
    advanceUsageEntries.sort(sortWorkbookEntries);

    const positiveInvoiceEntries = summaryInvoiceEntries.filter(isInvoiceEntry);
    const adjustmentInvoiceEntries = summaryInvoiceEntries.filter(isNegativeInvoiceEntry);

    type WorkingSummaryRow = SummaryRow & {
        remainingAmount: number;
        normalizedSiteName: string;
        normalizedTeamName: string;
        paymentDateSet: Set<string>;
        settlementEntryIdSet: Set<string>;
    };
    type PositiveInvoiceMatchMetadata = {
        date: string;
        siteName: string;
        description: string;
        teamName: string;
        appliedYear: number | null;
        appliedMonth: number | null;
    };
    const invoices: WorkingSummaryRow[] = positiveInvoiceEntries
        .map((entry): WorkingSummaryRow => ({
            id: getWorkbookEntryKey(entry),
            transactionType: entry.transactionType,
            partnerName: entry.partnerName,
            siteName: entry.siteName ?? '',
            issueDate: entry.date,
            appliedYear: entry.appliedYear ?? getYearFromDate(entry.date),
            appliedMonth: entry.appliedMonth ?? getMonthFromDate(entry.date),
            supplyAmount: entry.supplyAmount ?? 0,
            taxAmount: entry.taxAmount ?? 0,
            totalAmount: entry.totalAmount ?? 0,
            paymentDates: [],
            settledAmount: 0,
            advanceUsedAmount: 0,
            outstandingAmount: entry.totalAmount ?? 0,
            advanceAmount: 0,
            settlementEntryIds: [],
            remainingAmount: entry.totalAmount ?? 0,
            normalizedSiteName: normalizeText(entry.siteName).toLowerCase(),
            normalizedTeamName: normalizeText(entry.teamName).toLowerCase(),
            paymentDateSet: new Set<string>(),
            settlementEntryIdSet: new Set<string>(),
            note: getVisibleWorkbookRemark(entry.note),
            teamName: entry.teamName ?? ''
        }));

    const adjustmentRowsById = new Map<string, SummaryRow>();
    adjustmentInvoiceEntries.forEach((entry) => {
        const adjustmentId = getWorkbookEntryKey(entry);
        adjustmentRowsById.set(adjustmentId, {
            id: adjustmentId,
            transactionType: entry.transactionType,
            partnerName: entry.partnerName,
            siteName: entry.siteName ?? '',
            issueDate: entry.date,
            appliedYear: entry.appliedYear ?? getYearFromDate(entry.date),
            appliedMonth: entry.appliedMonth ?? getMonthFromDate(entry.date),
            supplyAmount: entry.supplyAmount ?? 0,
            taxAmount: entry.taxAmount ?? 0,
            totalAmount: entry.totalAmount ?? 0,
            paymentDates: [],
            settledAmount: 0,
            advanceUsedAmount: 0,
            outstandingAmount: 0,
            advanceAmount: 0,
            settlementEntryIds: [],
            note: getVisibleWorkbookRemark(entry.note),
            teamName: entry.teamName ?? ''
        });
    });

    const invoiceById = new Map<string, WorkingSummaryRow>();
    const invoicesByPartner = new Map<string, WorkingSummaryRow[]>();
    const positiveInvoiceEntriesByPartner = new Map<string, WorkbookLedgerEntry[]>();
    const positiveInvoiceMatchMetadata = new WeakMap<WorkbookLedgerEntry, PositiveInvoiceMatchMetadata>();
    invoices.forEach((invoice, index) => {
        invoiceById.set(invoice.id, invoice);

        const partnerKey = normalizePartnerMatchKey(invoice.partnerName);
        if (!partnerKey) return;

        const bucket = invoicesByPartner.get(partnerKey) ?? [];
        bucket.push(invoice);
        invoicesByPartner.set(partnerKey, bucket);

        const sourceEntry = positiveInvoiceEntries[index];
        const sourceBucket = positiveInvoiceEntriesByPartner.get(partnerKey) ?? [];
        sourceBucket.push(sourceEntry);
        positiveInvoiceEntriesByPartner.set(partnerKey, sourceBucket);
        positiveInvoiceMatchMetadata.set(sourceEntry, {
            date: normalizeDate(sourceEntry.date),
            siteName: normalizeText(sourceEntry.siteName).toLowerCase(),
            description: normalizeText(sourceEntry.description).toLowerCase(),
            teamName: normalizeText(sourceEntry.teamName).toLowerCase(),
            appliedYear: sourceEntry.appliedYear ?? getYearFromDate(sourceEntry.date),
            appliedMonth: sourceEntry.appliedMonth ?? getMonthFromDate(sourceEntry.date)
        });
    });

    const applyPaymentToInvoice = (
        invoice: WorkingSummaryRow,
        paymentAmount: number,
        paymentDate: string,
        options?: { recordDate?: boolean; note?: string; sourceEntryId?: string; allowAdvance?: boolean }
    ) => {
        if (paymentAmount <= 0) return paymentAmount;

        const appliedAmount = invoice.remainingAmount > 0
            ? Math.min(invoice.remainingAmount, paymentAmount)
            : 0;
        const advanceAmount = (options?.allowAdvance ?? true)
            ? Math.max(paymentAmount - appliedAmount, 0)
            : 0;
        const settledAmount = appliedAmount + advanceAmount;
        if (settledAmount <= 0) return paymentAmount;

        invoice.settledAmount += settledAmount;
        invoice.remainingAmount = Math.max(invoice.remainingAmount - appliedAmount, 0);
        invoice.outstandingAmount = invoice.remainingAmount;
        invoice.advanceAmount += advanceAmount;
        if ((options?.recordDate ?? true) && paymentDate && !invoice.paymentDateSet.has(paymentDate)) {
            invoice.paymentDateSet.add(paymentDate);
            invoice.paymentDates.push(paymentDate);
        }
        if (options?.sourceEntryId && !invoice.settlementEntryIdSet.has(options.sourceEntryId)) {
            invoice.settlementEntryIdSet.add(options.sourceEntryId);
            invoice.settlementEntryIds.push(options.sourceEntryId);
        }
        invoice.note = appendSummaryNote(invoice.note, options?.note);

        return paymentAmount - settledAmount;
    };

    const applyAdvanceUsageToInvoice = (usageEntry: WorkbookLedgerEntry) => {
        const sourceId = normalizeText(usageEntry.sourceId);
        const targetId = normalizeText(usageEntry.matchedEntryId);
        const usageAmount = usageEntry.paymentAmount ?? 0;
        if (!sourceId || !targetId || usageAmount <= 0) return;

        const sourceInvoice = invoiceById.get(sourceId);
        const targetInvoice = invoiceById.get(targetId);
        if (!sourceInvoice || !targetInvoice || sourceInvoice.id === targetInvoice.id) return;
        if (normalizePartnerMatchKey(sourceInvoice.partnerName) !== normalizePartnerMatchKey(targetInvoice.partnerName)) return;

        const appliedAmount = Math.min(
            usageAmount,
            Math.max(sourceInvoice.advanceAmount, 0),
            Math.max(targetInvoice.remainingAmount, 0)
        );
        if (appliedAmount <= 0) return;

        sourceInvoice.advanceAmount = Math.max(sourceInvoice.advanceAmount - appliedAmount, 0);
        targetInvoice.advanceUsedAmount += appliedAmount;
        targetInvoice.remainingAmount = Math.max(targetInvoice.remainingAmount - appliedAmount, 0);
        targetInvoice.outstandingAmount = targetInvoice.remainingAmount;

        const usageEntryKey = getWorkbookEntryKey(usageEntry);
        if (usageEntry.date && !targetInvoice.paymentDateSet.has(usageEntry.date)) {
            targetInvoice.paymentDateSet.add(usageEntry.date);
            targetInvoice.paymentDates.push(usageEntry.date);
        }
        if (!targetInvoice.settlementEntryIdSet.has(usageEntryKey)) {
            targetInvoice.settlementEntryIdSet.add(usageEntryKey);
            targetInvoice.settlementEntryIds.push(usageEntryKey);
        }
        targetInvoice.note = appendSummaryNote(targetInvoice.note, usageEntry.note);
    };

    const findDirectOffsetInvoice = (adjustmentEntry: WorkbookLedgerEntry) => {
        const exactAmount = Math.abs(adjustmentEntry.totalAmount ?? 0);
        if (exactAmount <= 0) return null;

        const partnerKey = normalizePartnerMatchKey(adjustmentEntry.partnerName);
        if (!partnerKey) return null;

        const adjustmentDate = normalizeDate(adjustmentEntry.date);
        const normalizedSiteName = normalizeText(adjustmentEntry.siteName).toLowerCase();
        const normalizedDescription = normalizeText(adjustmentEntry.description).toLowerCase();
        const normalizedTeamName = normalizeText(adjustmentEntry.teamName).toLowerCase();
        const appliedYear = adjustmentEntry.appliedYear ?? null;
        const appliedMonth = adjustmentEntry.appliedMonth ?? null;

        const directCandidates = (positiveInvoiceEntriesByPartner.get(partnerKey) ?? []).filter((invoiceEntry) => {
            const metadata = positiveInvoiceMatchMetadata.get(invoiceEntry);
            if (!metadata) return false;
            if (Math.abs((invoiceEntry.totalAmount ?? 0) - exactAmount) >= 0.5) return false;
            if (adjustmentDate && metadata.date !== adjustmentDate) return false;
            if (normalizedSiteName && metadata.siteName !== normalizedSiteName) return false;
            if (normalizedDescription && metadata.description !== normalizedDescription) return false;
            if (normalizedTeamName && metadata.teamName !== normalizedTeamName) return false;

            if (appliedYear !== null && metadata.appliedYear !== appliedYear) return false;
            if (appliedMonth !== null && metadata.appliedMonth !== appliedMonth) return false;

            return true;
        });

        if (directCandidates.length !== 1) return null;

        return invoiceById.get(getWorkbookEntryKey(directCandidates[0])) ?? null;
    };

    const findLegacyMatchedInvoice = (paymentEntry: WorkbookLedgerEntry, exactAmount?: number) => {
        const partnerKey = normalizePartnerMatchKey(paymentEntry.partnerName);
        if (!partnerKey) return null;

        const partnerInvoices = invoicesByPartner.get(partnerKey) ?? [];
        if (!partnerInvoices.length) return null;

        const paymentDate = normalizeDate(paymentEntry.date);
        const normalizedSiteName = normalizeText(paymentEntry.siteName).toLowerCase();
        const normalizedTeamName = normalizeText(paymentEntry.teamName).toLowerCase();
        const appliedYear = paymentEntry.appliedYear ?? null;
        const appliedMonth = paymentEntry.appliedMonth ?? null;

        const matchesBaseConditions = (invoice: WorkingSummaryRow) => {
            if (paymentDate && invoice.issueDate > paymentDate) return false;
            if (normalizedSiteName && invoice.normalizedSiteName !== normalizedSiteName) return false;
            if (normalizedTeamName && invoice.normalizedTeamName !== normalizedTeamName) return false;
            return true;
        };

        const resolveCandidateSet = (candidates: WorkingSummaryRow[]) => {
            if (candidates.length === 1) return candidates[0];

            let outstandingCandidate: WorkingSummaryRow | null = null;
            let outstandingCount = 0;
            let exactAmountCandidate: WorkingSummaryRow | null = null;
            let exactAmountCount = 0;
            const shouldMatchExactAmount = Boolean(exactAmount && exactAmount > 0);

            candidates.forEach((invoice) => {
                if ((invoice.remainingAmount ?? 0) > 0) {
                    outstandingCandidate = invoice;
                    outstandingCount += 1;
                }

                if (shouldMatchExactAmount && (
                    Math.abs((invoice.totalAmount ?? 0) - (exactAmount ?? 0)) < 0.5 ||
                    Math.abs((invoice.remainingAmount ?? 0) - (exactAmount ?? 0)) < 0.5
                )) {
                    exactAmountCandidate = invoice;
                    exactAmountCount += 1;
                }
            });

            if (outstandingCount === 1) return outstandingCandidate;
            if (exactAmountCount === 1) return exactAmountCandidate;
            return null;
        };

        const strictCandidates: WorkingSummaryRow[] = [];
        const relaxedCandidates: WorkingSummaryRow[] = [];
        partnerInvoices.forEach((invoice) => {
            if (!matchesBaseConditions(invoice)) return;

            relaxedCandidates.push(invoice);
            if (appliedYear !== null && invoice.appliedYear !== appliedYear) return;
            if (appliedMonth !== null && invoice.appliedMonth !== appliedMonth) return;
            strictCandidates.push(invoice);
        });

        return resolveCandidateSet(strictCandidates) ?? resolveCandidateSet(relaxedCandidates);
    };

    paymentEntries.forEach((paymentEntry) => {
        const paymentAmount = paymentEntry.paymentAmount ?? 0;
        if (paymentAmount <= 0) return;

        const paymentEntryKey = getWorkbookEntryKey(paymentEntry);
        const selfInvoice = isInvoiceEntry(paymentEntry) ? invoiceById.get(paymentEntryKey) : null;

        if (paymentEntry.matchedEntryId) {
            const matchedInvoice = invoiceById.get(paymentEntry.matchedEntryId);
            if (matchedInvoice) {
                applyPaymentToInvoice(matchedInvoice, paymentAmount, paymentEntry.date, {
                    note: paymentEntry.note,
                    sourceEntryId: paymentEntryKey
                });
            }
            return;
        }

        if (selfInvoice) {
            applyPaymentToInvoice(selfInvoice, paymentAmount, paymentEntry.date, {
                note: paymentEntry.note,
                sourceEntryId: paymentEntryKey
            });
            return;
        }

        const legacyMatchedInvoice = findLegacyMatchedInvoice(paymentEntry, paymentAmount);
        if (legacyMatchedInvoice) {
            applyPaymentToInvoice(legacyMatchedInvoice, paymentAmount, paymentEntry.date, {
                note: paymentEntry.note,
                sourceEntryId: paymentEntryKey
            });
            return;
        }

        // Leave ambiguous legacy payments unmatched so summary rows do not show
        // settled amounts without a concrete linked payment history.
    });

    adjustmentInvoiceEntries.forEach((adjustmentEntry) => {
        const adjustmentDate = normalizeDate(adjustmentEntry.date);
        if (!adjustmentDate || adjustmentDate > paymentCutoffDate) return;
        const adjustmentAmount = Math.abs(adjustmentEntry.totalAmount ?? 0);
        if (adjustmentAmount <= 0) return;

        if (adjustmentEntry.matchedEntryId) {
            const matchedInvoice = invoiceById.get(adjustmentEntry.matchedEntryId);
            if (matchedInvoice) {
                applyPaymentToInvoice(matchedInvoice, adjustmentAmount, adjustmentEntry.date, { note: adjustmentEntry.note, allowAdvance: false });
            }
            return;
        }

        const directOffsetInvoice = findDirectOffsetInvoice(adjustmentEntry);
        if (directOffsetInvoice) {
            applyPaymentToInvoice(directOffsetInvoice, adjustmentAmount, adjustmentEntry.date, { note: adjustmentEntry.note, allowAdvance: false });
            return;
        }

        const legacyMatchedInvoice = findLegacyMatchedInvoice(adjustmentEntry, adjustmentAmount);
        if (legacyMatchedInvoice) {
            applyPaymentToInvoice(legacyMatchedInvoice, adjustmentAmount, adjustmentEntry.date, { note: adjustmentEntry.note, allowAdvance: false });
            return;
        }

        // Same rule for negative adjustments: only apply when the target invoice
        // can be identified uniquely from the legacy data.
    });

    advanceUsageEntries.forEach(applyAdvanceUsageToInvoice);

    const finalizedPositiveRowsById = new Map<string, SummaryRow>();
    invoices.forEach(({
        remainingAmount,
        normalizedSiteName,
        normalizedTeamName,
        paymentDateSet,
        settlementEntryIdSet,
        ...row
    }) => {
        row.paymentDates.sort((left, right) => left.localeCompare(right, 'en'));
        finalizedPositiveRowsById.set(row.id, row);
    });

    const finalizedRows = summaryInvoiceEntries
        .map((entry) => {
            const entryId = getWorkbookEntryKey(entry);
            if (isInvoiceEntry(entry)) {
                return finalizedPositiveRowsById.get(entryId) ?? null;
            }
            if (isNegativeInvoiceEntry(entry)) {
                return adjustmentRowsById.get(entryId) ?? null;
            }
            return null;
        })
        .filter((row): row is SummaryRow => Boolean(row));

    return finalizedRows;
};

export const buildSummaryBaseRows = (entries: WorkbookLedgerEntry[], filter: SummaryFilter): SummaryRow[] => {
    const startDate = normalizeDate(filter.startDate);
    const endDate = normalizeDate(filter.endDate);
    if (!startDate || !endDate) return [];

    const transactionType: WorkbookTransactionType = filter.mode === '매입' || filter.mode === '미지급금' ? '매입' : '매출';
    return buildSummaryBaseRowsForTransaction(entries, transactionType, formatDateInput(new Date()));
};

export const filterSummaryRows = (rows: SummaryRow[], filter: SummaryFilter): SummaryRow[] => {
    const startDate = normalizeDate(filter.startDate);
    const endDate = normalizeDate(filter.endDate);

    if (!startDate || !endDate) return [];

    const scopedRows = rows.filter((row) => {
        return (
            isDateWithinRange(row.issueDate, startDate, endDate) &&
            matchesFilter(row.teamName, filter.teamName) &&
            matchesFilter(row.partnerName, filter.partnerName) &&
            matchesFilter(row.siteName, filter.siteName)
        );
    });

    if (isSummarySettlementMode(filter.mode)) {
        return scopedRows
            .filter((row) => row.outstandingAmount >= SETTLEMENT_AMOUNT_EPSILON)
            .sort(sortSummaryRowsByDate);
    }

    return scopedRows.sort(sortSummaryRowsByDate);
};

export const buildSummaryRows = (entries: WorkbookLedgerEntry[], filter: SummaryFilter): SummaryRow[] => (
    filterSummaryRows(buildSummaryBaseRows(entries, filter), filter)
);
