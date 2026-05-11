import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HotTable } from '@handsontable/react';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/dist/handsontable.full.min.css';
import Swal from 'sweetalert2';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faCopy,
    faDownload,
    faDatabase,
    faMagnifyingGlass,
    faPenToSquare,
    faPrint,
    faRotateRight,
    faSpinner,
    faTrashCan,
    faUpload,
    faXmark
} from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../../contexts/AuthContext';
import { companyService } from '../../services/companyService';
import { siteService } from '../../services/siteService';
import { teamService } from '../../services/teamService';
import { accountDirectoryService, AccountDirectory } from '../../services/accountDirectoryService';
import {
    createWorkbookLedgerService,
    WorkbookLedgerEntry,
    WorkbookLedgerTenant,
    WorkbookTransactionType
} from '../../services/workbookLedgerService';
import './WorkbookLedgerPage.css';

registerAllModules();

type WorkbookTab = 'input' | 'database' | 'ledger' | 'summary';
type SummaryMode = '매출' | '매입' | '미수금' | '미지급금';

interface InputRow {
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

type InputGridChange = [number, keyof InputRow | string | number, unknown, unknown];

interface LedgerFilter {
    startDate: string;
    endDate: string;
    teamName: string;
    transactionType: WorkbookTransactionType;
    partnerName: string;
    siteName: string;
}

interface SummaryFilter {
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

interface LedgerRow {
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

interface SummaryRow {
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
    outstandingAmount: number;
    note: string;
    teamName: string;
}

interface LegacyMatchCandidate {
    id: string;
    partnerName: string;
    siteName: string;
    issueDate: string;
    appliedYear: number | null;
    appliedMonth: number | null;
    teamName: string;
}

interface ReceiptEditDraft {
    id: string;
    date: string;
    paymentAmount: string;
    note: string;
}

interface DbEditDraft {
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

interface DatabaseDisplayRow {
    entry: WorkbookLedgerEntry;
    indexLabel: string;
    nested: boolean;
}

type DbSortField = 'date' | 'partnerName' | 'amount';

interface DbSortState {
    field: DbSortField;
    direction: 'asc' | 'desc';
}

interface DbFilterState {
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

const INPUT_ROW_COUNT = 80;
const DB_PAGE_SIZE = 100;
const DB_INITIAL_LOAD_LIMIT = 300;
const INPUT_GRID_DERIVED_SOURCE = 'workbook-input-derived';
const INPUT_GRID_MOUSE_COMMIT_SOURCE = 'workbook-input-mouse-commit';
type EntryLoadScope = 'none' | 'recent' | 'range' | 'all';
interface EntryLoadQuery {
    scope: EntryLoadScope;
    startDate?: string;
    endDate?: string;
    limitCount?: number;
    orderDirection?: 'asc' | 'desc';
}

const createRecentDbEntryLoadQuery = (): EntryLoadQuery => ({
    scope: 'recent',
    limitCount: DB_INITIAL_LOAD_LIMIT,
    orderDirection: 'desc'
});

const createAllEntryLoadQuery = (): EntryLoadQuery => ({
    scope: 'all',
    orderDirection: 'asc'
});

const createRangeEntryLoadQuery = (startDate: string, endDate: string): EntryLoadQuery => {
    const normalizedStart = String(startDate ?? '').trim();
    const normalizedEnd = String(endDate ?? '').trim();

    if (normalizedStart && normalizedEnd && normalizedStart > normalizedEnd) {
        return {
            scope: 'range',
            startDate: normalizedEnd,
            endDate: normalizedStart,
            orderDirection: 'asc'
        };
    }

    return {
        scope: 'range',
        startDate: normalizedStart,
        endDate: normalizedEnd,
        orderDirection: 'asc'
    };
};

const buildEntryLoadQueryKey = (entryQuery: EntryLoadQuery) => [
    entryQuery.scope,
    entryQuery.startDate ?? '',
    entryQuery.endDate ?? '',
    entryQuery.limitCount ?? '',
    entryQuery.orderDirection ?? 'asc'
].join('|');

const getEntryLoadScopeText = (scope: EntryLoadScope, count: number) => {
    if (scope === 'all') return `전체 ${count.toLocaleString()}건`;
    if (scope === 'recent') return `최근 ${count.toLocaleString()}건`;
    if (scope === 'range') return `기간 ${count.toLocaleString()}건`;
    return '미로드';
};

interface RefreshPageDataOptions {
    forceEntries?: boolean;
    forceCatalogs?: boolean;
    loadEntries?: boolean;
    entryQuery?: EntryLoadQuery;
}

const buildDefaultLedgerStart = (date: Date) => (
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`
);
const WORKBOOK_TABS: Array<{ id: WorkbookTab; label: string }> = [
    { id: 'input', label: '입력폼' },
    { id: 'database', label: 'DB' },
    { id: 'ledger', label: '조회 (매출, 매입 거래장)' },
    { id: 'summary', label: '전체 조회' },
];

const TENANT_TABS: Array<{ key: WorkbookLedgerTenant; label: string; path: string; colorClass: string }> = [
    { key: 'cheongyeon', label: '청연', path: '/payroll/workbook-ledger', colorClass: 'tenant-cheongyeon' },
    { key: 'dawon', label: '다원', path: '/payroll/workbook-ledger-dawon', colorClass: 'tenant-dawon' }
];

const DB_HEADERS = [
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
] as const;

const NOTE_HEADER_ALIASES = ['비고', '비 고', '메모', '비고/메모', '메모/비고', '특이사항', 'remark', 'remarks', 'memo', 'note'] as const;

const emptyInputRow = (): InputRow => ({
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

const createEmptyInputRows = () => Array.from({ length: INPUT_ROW_COUNT }, emptyInputRow);

const emptyDbFilter = (): DbFilterState => ({
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

const normalizeInputRows = (rows: Array<Partial<InputRow> | null | undefined>, baseYear: number, selectedTeam: string) =>
    rows.map((row) => normalizeInputRowForGrid(row, baseYear, selectedTeam));

const areInputRowsEqual = (left: InputRow[], right: InputRow[]) => {
    if (left === right) return true;
    if (left.length !== right.length) return false;

    for (let index = 0; index < left.length; index += 1) {
        const leftRow = left[index];
        const rightRow = right[index];

        if (
            leftRow.transactionType !== rightRow.transactionType ||
            leftRow.date !== rightRow.date ||
            leftRow.partnerName !== rightRow.partnerName ||
            leftRow.siteName !== rightRow.siteName ||
            leftRow.description !== rightRow.description ||
            leftRow.manDays !== rightRow.manDays ||
            leftRow.supplyAmount !== rightRow.supplyAmount ||
            leftRow.taxAmount !== rightRow.taxAmount ||
            leftRow.totalAmount !== rightRow.totalAmount ||
            leftRow.paymentAmount !== rightRow.paymentAmount ||
            leftRow.appliedYear !== rightRow.appliedYear ||
            leftRow.appliedMonth !== rightRow.appliedMonth ||
            leftRow.note !== rightRow.note ||
            leftRow.teamName !== rightRow.teamName
        ) {
            return false;
        }
    }

    return true;
};

const formatDateInput = (date: Date) => (
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
);

const formatShortDateInput = (normalizedDate: string) => (
    `${normalizedDate.slice(2, 4)}-${normalizedDate.slice(5, 7)}-${normalizedDate.slice(8, 10)}`
);

const expandDateYear = (yearText: string): number => {
    const year = Number(yearText);
    if (!Number.isFinite(year)) return NaN;
    return yearText.length === 2 ? 2000 + year : year;
};

const formatDateParts = (year: number, month: number, day: number) => (
    `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
);

const normalizeDateParts = (yearText: string, monthText: string, dayText: string): string => {
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

const formatNumber = (value: number | null | undefined) => {
    if (value === null || value === undefined || !Number.isFinite(value)) return '-';
    return new Intl.NumberFormat('ko-KR').format(value);
};

const toNumberOrNull = (value: unknown): number | null => {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
        const parsed = Number(value.replace(/,/g, '').trim());
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
};

const normalizeText = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const normalizeHeaderKey = (value: unknown) => normalizeText(value).replace(/\s+/g, '').toLowerCase();
const normalizeBankName = (value: unknown) => (
    String(value ?? '')
        .toLowerCase()
        .replace(/\s+/g, '')
        .trim()
);

const KB_BANK_CODE_BY_NAME = new Map<string, string>([
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

const resolveKBBankCode = (bankName: unknown) => {
    const normalized = normalizeBankName(bankName);
    if (!normalized) return '';

    for (const [key, code] of KB_BANK_CODE_BY_NAME.entries()) {
        if (normalized.includes(normalizeBankName(key))) return code;
    }

    return '';
};
const normalizePartnerMatchKey = (value: unknown) => normalizeText(value)
    .toLowerCase()
    .replace(/\(주\)|㈜|주식회사/g, '')
    .replace(/\s+/g, '')
    .replace(/[^0-9a-z가-힣]/g, '');
const escapeHtml = (value: string) => value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

interface PrintColumnSpec {
    className: string;
    width: string;
}

const LEDGER_PRINT_COLUMNS: PrintColumnSpec[] = [
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

const SUMMARY_PRINT_COLUMNS: PrintColumnSpec[] = [
    { className: 'print-summary-col-no', width: '36px' },
    { className: 'print-summary-col-partner', width: '160px' },
    { className: 'print-summary-col-site', width: '260px' },
    { className: 'print-summary-col-issue-date', width: '72px' },
    { className: 'print-summary-col-amount', width: '78px' },
    { className: 'print-summary-col-tax', width: '72px' },
    { className: 'print-summary-col-total', width: '78px' },
    { className: 'print-summary-col-payment-date', width: '72px' },
    { className: 'print-summary-col-settled', width: '78px' },
    { className: 'print-summary-col-outstanding', width: '78px' },
    { className: 'print-summary-col-note', width: '60px' },
    { className: 'print-summary-col-team', width: '48px' }
];

const buildPrintColGroup = (columns: PrintColumnSpec[]) => `
                            <colgroup>
                                ${columns.map((column) => `<col class="${column.className}" />`).join('')}
                            </colgroup>
                        `;

const buildPrintColumnStyles = (columns: PrintColumnSpec[]) => columns
    .map((column) => `.${column.className} { width: ${column.width}; }`)
    .join('\n');

const getPrintTableTheme = (tenantKey: WorkbookLedgerTenant | string) => {
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

const normalizeTransactionType = (value: unknown): WorkbookTransactionType | null => {
    const text = normalizeText(value);
    if (text.includes('매입')) return '매입';
    if (text.includes('매출')) return '매출';
    return null;
};

const normalizeDate = (value: unknown, fallbackYear?: number): string => {
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

const getMonthFromDate = (date: string): number | null => {
    const normalized = normalizeDate(date);
    if (!normalized) return null;
    return Number(normalized.slice(5, 7));
};

const getYearFromDate = (date: string): number | null => {
    const normalized = normalizeDate(date);
    if (!normalized) return null;
    return Number(normalized.slice(0, 4));
};

const toDbRow = (entry: WorkbookLedgerEntry) => ([
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
    entry.teamName || ''
]);

const createDbEditDraft = (entry: WorkbookLedgerEntry): DbEditDraft => ({
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

const hasInputContent = (row: InputRow) => {
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

const coerceInputRow = (row: Partial<InputRow> | null | undefined): InputRow => ({
    ...emptyInputRow(),
    ...(row ?? {})
});

const toInputText = (value: unknown) => {
    if (value === null || value === undefined) return '';
    return typeof value === 'string' ? value : String(value);
};

const normalizeInputDateForGrid = (value: unknown, baseYear: number): string => {
    const normalizedDate = normalizeDate(value, baseYear);
    if (normalizedDate) return formatShortDateInput(normalizedDate);
    return toInputText(value);
};

const normalizeInputRowForGrid = (
    row: Partial<InputRow> | null | undefined,
    baseYear: number,
    selectedTeam: string
): InputRow => {
    const source = coerceInputRow(row);
    const normalizedDate = normalizeDate(source.date, baseYear);
    const date = normalizeInputDateForGrid(source.date, baseYear);
    const supplyAmount = toNumberOrNull(source.supplyAmount);
    const taxAmount = supplyAmount === null ? null : Math.round(supplyAmount * 0.1);
    const totalAmount = supplyAmount === null ? null : supplyAmount + (taxAmount ?? 0);
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

const INPUT_GRID_DERIVED_PROPS: Array<keyof InputRow> = [
    'taxAmount',
    'totalAmount',
    'appliedYear',
    'appliedMonth'
];

const isEmptyInputGridValue = (value: unknown) => value === null || value === undefined || value === '';

const areInputGridValuesEqual = (left: unknown, right: unknown) => {
    if (left === right) return true;
    if (isEmptyInputGridValue(left) && isEmptyInputGridValue(right)) return true;
    return false;
};

const applyInputGridDerivedValues = (
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

const hasLedgerEntryContent = (entry: WorkbookLedgerEntry) => {
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

const parseImportedDbEntries = (rows: unknown[][], fallbackTeamName: string, fallbackYear: number) => {
    if (rows.length === 0) {
        return { entries: [] as Omit<WorkbookLedgerEntry, 'id' | 'createdAt' | 'updatedAt'>[], skipped: 0 };
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

    const entries: Omit<WorkbookLedgerEntry, 'id' | 'createdAt' | 'updatedAt'>[] = [];
    let skipped = 0;

    rows.slice(1).forEach((row) => {
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
        const appliedYear = toNumberOrNull(readCell(row, '적용연도')) ?? getYearFromDate(date) ?? fallbackYear;
        const appliedMonth = toNumberOrNull(
            readCell(row, '적용월')
        ) ?? getMonthFromDate(date);
        const matchedEntryId = normalizeText(readCell(row, '매칭매출ID'));
        const note = normalizeText(readFirstCell(row, NOTE_HEADER_ALIASES));
        const teamName = normalizeText(
            readCell(row, '팀명')
        ) || fallbackTeamName;

        const entry: WorkbookLedgerEntry = {
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

const normalizeInputRow = (row: Partial<InputRow> | null | undefined, baseYear: number, selectedTeam: string): InputRow => {
    const source = coerceInputRow(row);
    const normalizedDate = normalizeDate(source.date, baseYear);
    const supplyAmount = toNumberOrNull(source.supplyAmount);
    const taxAmount = supplyAmount === null ? null : Math.round(supplyAmount * 0.1);
    const totalAmount = supplyAmount === null ? null : supplyAmount + (taxAmount ?? 0);
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

const sortWorkbookEntries = (left: WorkbookLedgerEntry, right: WorkbookLedgerEntry) => {
    const dateCompare = (left.date ?? '').localeCompare(right.date ?? '', 'en');
    if (dateCompare !== 0) return dateCompare;

    const createdCompare = (left.createdAt ?? '').localeCompare(right.createdAt ?? '', 'en');
    if (createdCompare !== 0) return createdCompare;

    return (left.id ?? '').localeCompare(right.id ?? '', 'en');
};

const getDbEntrySortAmount = (entry: WorkbookLedgerEntry) => {
    if ((entry.totalAmount ?? 0) !== 0) return entry.totalAmount ?? 0;
    return entry.paymentAmount ?? 0;
};

const compareDbEntriesBySortState = (
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

const sortSummaryRowsByDate = (left: SummaryRow, right: SummaryRow) => {
    const dateCompare = (left.issueDate ?? '').localeCompare(right.issueDate ?? '', 'en');
    if (dateCompare !== 0) return dateCompare;

    return (left.id ?? '').localeCompare(right.id ?? '', 'en');
};

const matchesFilter = (source: string | undefined, keyword: string) => {
    if (!keyword.trim()) return true;
    return (source ?? '').toLowerCase().includes(keyword.trim().toLowerCase());
};

const isDateWithinRange = (date: string | undefined, startDate: string, endDate: string) => {
    const normalizedDate = normalizeDate(date);
    if (!normalizedDate) return false;
    return normalizedDate >= startDate && normalizedDate <= endDate;
};

const getWorkbookEntryKey = (entry: Pick<WorkbookLedgerEntry, 'id' | 'date' | 'partnerName' | 'description'>) => (
    entry.id ?? `${entry.date}-${entry.partnerName}-${entry.description}`
);

const getLegacyMatchKey = (
    entry: Pick<WorkbookLedgerEntry, 'partnerName' | 'siteName' | 'teamName' | 'appliedYear' | 'appliedMonth'>,
    includePeriod: boolean
) => [
    normalizePartnerMatchKey(entry.partnerName),
    normalizeText(entry.siteName).toLowerCase(),
    normalizeText(entry.teamName).toLowerCase(),
    includePeriod ? String(entry.appliedYear ?? '') : '',
    includePeriod ? String(entry.appliedMonth ?? '') : ''
].join('|');

const isInvoiceEntry = (entry: WorkbookLedgerEntry) => (entry.totalAmount ?? 0) > 0;
const isNegativeInvoiceEntry = (entry: WorkbookLedgerEntry) => (entry.totalAmount ?? 0) < 0;
const isPaymentEntry = (entry: WorkbookLedgerEntry) => (entry.paymentAmount ?? 0) > 0;

const findLegacyMatchedCandidateId = (
    paymentEntry: Pick<WorkbookLedgerEntry, 'date' | 'partnerName' | 'siteName' | 'teamName' | 'appliedYear' | 'appliedMonth'>,
    candidates: LegacyMatchCandidate[]
) => {
    const partnerKey = normalizePartnerMatchKey(paymentEntry.partnerName);
    if (!partnerKey) return null;

    const partnerCandidates = candidates.filter((candidate) => normalizePartnerMatchKey(candidate.partnerName) === partnerKey);
    if (!partnerCandidates.length) return null;

    const paymentDate = normalizeDate(paymentEntry.date);
    const normalizedSiteName = normalizeText(paymentEntry.siteName).toLowerCase();
    const normalizedTeamName = normalizeText(paymentEntry.teamName).toLowerCase();
    const appliedYear = paymentEntry.appliedYear ?? null;
    const appliedMonth = paymentEntry.appliedMonth ?? null;

    const matchesBaseConditions = (candidate: LegacyMatchCandidate) => {
        if (paymentDate && candidate.issueDate > paymentDate) return false;
        if (normalizedSiteName && normalizeText(candidate.siteName).toLowerCase() !== normalizedSiteName) return false;
        if (normalizedTeamName && normalizeText(candidate.teamName).toLowerCase() !== normalizedTeamName) return false;
        return true;
    };

    const strictCandidates = partnerCandidates.filter((candidate) => {
        if (!matchesBaseConditions(candidate)) return false;
        if (appliedYear !== null && candidate.appliedYear !== appliedYear) return false;
        if (appliedMonth !== null && candidate.appliedMonth !== appliedMonth) return false;
        return true;
    });

    if (strictCandidates.length === 1) {
        return strictCandidates[0].id;
    }

    const relaxedCandidates = partnerCandidates.filter(matchesBaseConditions);
    if (relaxedCandidates.length === 1) {
        return relaxedCandidates[0].id;
    }

    return null;
};

const getSettlementLabels = (transactionType: WorkbookTransactionType | undefined) => {
    const isPurchase = transactionType === '매입';

    return {
        action: isPurchase ? '지급' : '입금',
        history: isPurchase ? '지급내역' : '입금내역',
        date: isPurchase ? '지급일자' : '입금일자',
        amount: isPurchase ? '지급금액' : '입금금액',
        cumulative: isPurchase ? '누적지급' : '누적입금',
        outstanding: isPurchase ? '미지급금' : '미수금',
        placeholder: isPurchase ? '지급 메모' : '입금 메모',
    };
};

const getSummaryDisplayedSettledAmount = (row: SummaryRow) => {
    if (row.outstandingAmount < 0) {
        return row.outstandingAmount;
    }

    return row.settledAmount;
};

const appendSummaryNote = (currentNote: string, nextNote: unknown) => {
    const current = normalizeText(currentNote);
    const next = normalizeText(nextNote);

    if (!next) return current;
    if (!current) return next;
    if (current.split(' / ').includes(next)) return current;

    return `${current} / ${next}`;
};

const buildLedgerRows = (entries: WorkbookLedgerEntry[], filter: LedgerFilter): LedgerRow[] => {
    const scopedEntries = entries
        .filter((entry) => entry.transactionType === filter.transactionType)
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
            note: entry.note ?? '',
            teamName: entry.teamName ?? ''
        };
    });
};

const buildReceiptHistorySettlementEntries = (
    entries: WorkbookLedgerEntry[],
    filter: SummaryFilter,
    targetId: string | null
) => {
    if (!targetId) return [];

    const transactionType: WorkbookTransactionType = filter.mode === '매입' || filter.mode === '미지급금' ? '매입' : '매출';
    const startDate = normalizeDate(filter.startDate);
    const endDate = normalizeDate(filter.endDate);

    if (!startDate || !endDate) return [];

    const candidates: LegacyMatchCandidate[] = entries
        .filter((entry) => entry.transactionType === transactionType)
        .filter(isInvoiceEntry)
        .filter((entry) => matchesFilter(entry.teamName, filter.teamName))
        .filter((entry) => matchesFilter(entry.partnerName, filter.partnerName))
        .filter((entry) => matchesFilter(entry.siteName, filter.siteName))
        .map((entry) => ({
            id: getWorkbookEntryKey(entry),
            partnerName: entry.partnerName,
            siteName: entry.siteName ?? '',
            issueDate: entry.date,
            appliedYear: entry.appliedYear ?? getYearFromDate(entry.date),
            appliedMonth: entry.appliedMonth ?? getMonthFromDate(entry.date),
            teamName: entry.teamName ?? ''
        }));

    return entries
        .filter((entry) => {
            if (!isPaymentEntry(entry)) return false;
            if (entry.matchedEntryId === targetId) return true;
            if (entry.matchedEntryId) return false;
            return findLegacyMatchedCandidateId(entry, candidates) === targetId;
        })
        .sort(sortWorkbookEntries);
};

const buildSummaryRows = (entries: WorkbookLedgerEntry[], filter: SummaryFilter): SummaryRow[] => {
    const transactionType: WorkbookTransactionType = filter.mode === '매입' || filter.mode === '미지급금' ? '매입' : '매출';
    const startDate = normalizeDate(filter.startDate);
    const endDate = normalizeDate(filter.endDate);
    const isSettlementMode = filter.mode === '미수금' || filter.mode === '미지급금';

    if (!startDate || !endDate) return [];

    const summaryInvoiceEntries = entries
        .filter((entry) => entry.transactionType === transactionType)
        .filter((entry) => (entry.totalAmount ?? 0) !== 0)
        .filter((entry) => matchesFilter(entry.teamName, filter.teamName))
        .filter((entry) => matchesFilter(entry.partnerName, filter.partnerName))
        .filter((entry) => matchesFilter(entry.siteName, filter.siteName))
        .sort(sortWorkbookEntries);

    const positiveInvoiceEntries = summaryInvoiceEntries.filter(isInvoiceEntry);
    const adjustmentInvoiceEntries = summaryInvoiceEntries.filter(isNegativeInvoiceEntry);

    type WorkingSummaryRow = SummaryRow & { remainingAmount: number };
    const invoices = positiveInvoiceEntries
        .map((entry) => ({
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
            outstandingAmount: entry.totalAmount ?? 0,
            remainingAmount: entry.totalAmount ?? 0,
            note: entry.note ?? '',
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
            outstandingAmount: 0,
            note: entry.note ?? '',
            teamName: entry.teamName ?? ''
        });
    });

    const invoiceById = new Map<string, WorkingSummaryRow>();
    const invoicesByPartner = new Map<string, WorkingSummaryRow[]>();
    invoices.forEach((invoice) => {
        invoiceById.set(invoice.id, invoice);

        const partnerKey = normalizePartnerMatchKey(invoice.partnerName);
        if (!partnerKey) return;

        const bucket = invoicesByPartner.get(partnerKey) ?? [];
        bucket.push(invoice);
        invoicesByPartner.set(partnerKey, bucket);
    });

    const paymentEntries = entries
        .filter((entry) => entry.transactionType === transactionType)
        .filter(isPaymentEntry)
        .filter((entry) => entry.date <= endDate)
        .filter((entry) => matchesFilter(entry.teamName, filter.teamName))
        .filter((entry) => matchesFilter(entry.partnerName, filter.partnerName))
        .filter((entry) => matchesFilter(entry.siteName, filter.siteName))
        .sort(sortWorkbookEntries);

    const applyPaymentToInvoice = (
        invoice: WorkingSummaryRow,
        paymentAmount: number,
        paymentDate: string,
        options?: { recordDate?: boolean; note?: string }
    ) => {
        if (paymentAmount <= 0) return paymentAmount;

        const appliedAmount = invoice.remainingAmount > 0
            ? Math.min(invoice.remainingAmount, paymentAmount)
            : 0;
        const overpaidAmount = paymentAmount - appliedAmount;

        invoice.settledAmount += appliedAmount + overpaidAmount;
        invoice.remainingAmount -= appliedAmount + overpaidAmount;
        invoice.outstandingAmount = invoice.remainingAmount;
        if ((options?.recordDate ?? true) && paymentDate && !invoice.paymentDates.includes(paymentDate)) {
            invoice.paymentDates = [...invoice.paymentDates, paymentDate].sort((left, right) => left.localeCompare(right, 'en'));
        }
        invoice.note = appendSummaryNote(invoice.note, options?.note);

        return 0;
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

        const directCandidates = positiveInvoiceEntries.filter((invoiceEntry) => {
            if (normalizePartnerMatchKey(invoiceEntry.partnerName) !== partnerKey) return false;
            if (Math.abs((invoiceEntry.totalAmount ?? 0) - exactAmount) >= 0.5) return false;
            if (adjustmentDate && normalizeDate(invoiceEntry.date) !== adjustmentDate) return false;
            if (normalizedSiteName && normalizeText(invoiceEntry.siteName).toLowerCase() !== normalizedSiteName) return false;
            if (normalizedDescription && normalizeText(invoiceEntry.description).toLowerCase() !== normalizedDescription) return false;
            if (normalizedTeamName && normalizeText(invoiceEntry.teamName).toLowerCase() !== normalizedTeamName) return false;

            const invoiceAppliedYear = invoiceEntry.appliedYear ?? getYearFromDate(invoiceEntry.date);
            const invoiceAppliedMonth = invoiceEntry.appliedMonth ?? getMonthFromDate(invoiceEntry.date);
            if (appliedYear !== null && invoiceAppliedYear !== appliedYear) return false;
            if (appliedMonth !== null && invoiceAppliedMonth !== appliedMonth) return false;

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
            if (normalizedSiteName && normalizeText(invoice.siteName).toLowerCase() !== normalizedSiteName) return false;
            if (normalizedTeamName && normalizeText(invoice.teamName).toLowerCase() !== normalizedTeamName) return false;
            return true;
        };

        const resolveExactAmountCandidate = (candidates: WorkingSummaryRow[]) => {
            if (!(exactAmount && exactAmount > 0)) return null;

            const exactMatches = candidates.filter((invoice) => (
                Math.abs((invoice.totalAmount ?? 0) - exactAmount) < 0.5 ||
                Math.abs((invoice.remainingAmount ?? 0) - exactAmount) < 0.5
            ));
            if (exactMatches.length === 1) {
                return exactMatches[0];
            }

            return null;
        };

        const resolveUniqueOutstandingCandidate = (candidates: WorkingSummaryRow[]) => {
            const outstandingCandidates = candidates.filter((invoice) => (invoice.remainingAmount ?? 0) > 0);
            if (outstandingCandidates.length === 1) {
                return outstandingCandidates[0];
            }
            return null;
        };

        const strictCandidates = partnerInvoices.filter((invoice) => {
            if (!matchesBaseConditions(invoice)) return false;
            if (appliedYear !== null && invoice.appliedYear !== appliedYear) return false;
            if (appliedMonth !== null && invoice.appliedMonth !== appliedMonth) return false;
            return true;
        });

        if (strictCandidates.length === 1) {
            return strictCandidates[0];
        }

        const strictOutstandingCandidate = resolveUniqueOutstandingCandidate(strictCandidates);
        if (strictOutstandingCandidate) {
            return strictOutstandingCandidate;
        }

        const strictExactAmountMatch = resolveExactAmountCandidate(strictCandidates);
        if (strictExactAmountMatch) {
            return strictExactAmountMatch;
        }

        const relaxedCandidates = partnerInvoices.filter(matchesBaseConditions);
        if (relaxedCandidates.length === 1) {
            return relaxedCandidates[0];
        }

        const relaxedOutstandingCandidate = resolveUniqueOutstandingCandidate(relaxedCandidates);
        if (relaxedOutstandingCandidate) {
            return relaxedOutstandingCandidate;
        }

        const relaxedExactAmountMatch = resolveExactAmountCandidate(relaxedCandidates);
        if (relaxedExactAmountMatch) {
            return relaxedExactAmountMatch;
        }

        return null;
    };

    paymentEntries.forEach((paymentEntry) => {
        const paymentAmount = paymentEntry.paymentAmount ?? 0;
        if (paymentAmount <= 0) return;

        const paymentEntryKey = getWorkbookEntryKey(paymentEntry);
        const selfInvoice = isInvoiceEntry(paymentEntry) ? invoiceById.get(paymentEntryKey) : null;

        if (paymentEntry.matchedEntryId) {
            const matchedInvoice = invoiceById.get(paymentEntry.matchedEntryId);
            if (matchedInvoice) {
                applyPaymentToInvoice(matchedInvoice, paymentAmount, paymentEntry.date, { note: paymentEntry.note });
            }
            return;
        }

        if (selfInvoice) {
            applyPaymentToInvoice(selfInvoice, paymentAmount, paymentEntry.date, { note: paymentEntry.note });
            return;
        }

        const legacyMatchedInvoice = findLegacyMatchedInvoice(paymentEntry, paymentAmount);
        if (legacyMatchedInvoice) {
            applyPaymentToInvoice(legacyMatchedInvoice, paymentAmount, paymentEntry.date, { note: paymentEntry.note });
            return;
        }

        // Leave ambiguous legacy payments unmatched so summary rows do not show
        // settled amounts without a concrete linked payment history.
    });

    adjustmentInvoiceEntries.forEach((adjustmentEntry) => {
        const adjustmentAmount = Math.abs(adjustmentEntry.totalAmount ?? 0);
        if (adjustmentAmount <= 0) return;

        if (adjustmentEntry.matchedEntryId) {
            const matchedInvoice = invoiceById.get(adjustmentEntry.matchedEntryId);
            if (matchedInvoice) {
                applyPaymentToInvoice(matchedInvoice, adjustmentAmount, adjustmentEntry.date, { note: adjustmentEntry.note });
            }
            return;
        }

        const directOffsetInvoice = findDirectOffsetInvoice(adjustmentEntry);
        if (directOffsetInvoice) {
            applyPaymentToInvoice(directOffsetInvoice, adjustmentAmount, adjustmentEntry.date, { note: adjustmentEntry.note });
            return;
        }

        const legacyMatchedInvoice = findLegacyMatchedInvoice(adjustmentEntry, adjustmentAmount);
        if (legacyMatchedInvoice) {
            applyPaymentToInvoice(legacyMatchedInvoice, adjustmentAmount, adjustmentEntry.date, { note: adjustmentEntry.note });
            return;
        }

        // Same rule for negative adjustments: only apply when the target invoice
        // can be identified uniquely from the legacy data.
    });

    const finalizedPositiveRowsById = new Map<string, SummaryRow>();
    invoices.forEach(({ remainingAmount, ...row }) => {
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

    const scopedRows = finalizedRows.filter((row) => {
        if (!isSettlementMode) {
            return isDateWithinRange(row.issueDate, startDate, endDate);
        }

        // Receivable/payable mode is still scoped by issue-date range, but the
        // open balance itself is calculated as of the search end date.
        return isDateWithinRange(row.issueDate, startDate, endDate);
    });

    if (isSettlementMode) {
        return scopedRows
            .filter((row) => row.outstandingAmount !== 0)
            .sort(sortSummaryRowsByDate);
    }

    return scopedRows.sort(sortSummaryRowsByDate);
};

interface WorkbookLedgerPageProps {
    tenantKey?: WorkbookLedgerTenant;
    companyLabel?: string;
}

const WorkbookLedgerPage: React.FC<WorkbookLedgerPageProps> = ({
    tenantKey = 'cheongyeon',
    companyLabel = '청연'
}) => {
    const navigate = useNavigate();
    const hotRef = useRef<any>(null);
    const dbUploadInputRef = useRef<HTMLInputElement | null>(null);
    const ledgerCaptureRef = useRef<HTMLDivElement | null>(null);
    const summaryCaptureRef = useRef<HTMLDivElement | null>(null);
    const { currentUser } = useAuth();
    const ledgerService = useMemo(() => createWorkbookLedgerService(tenantKey), [tenantKey]);

    const today = useMemo(() => new Date(), []);
    const currentYear = today.getFullYear();
    const todayString = formatDateInput(today);
    const defaultLedgerStart = buildDefaultLedgerStart(today);

    const [activeTab, setActiveTab] = useState<WorkbookTab>('input');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [uploadingDb, setUploadingDb] = useState(false);
    const [downloadingDb, setDownloadingDb] = useState(false);
    const [downloadingKb, setDownloadingKb] = useState(false);
    const [showKbPreview, setShowKbPreview] = useState(false);
    const [kbReceiverDisplay, setKbReceiverDisplay] = useState(companyLabel);
    const [kbMemoSuffix, setKbMemoSuffix] = useState('');
    const [dbActionLoading, setDbActionLoading] = useState(false);
    const [capturingView, setCapturingView] = useState<'ledger' | 'summary' | null>(null);
    const [printingLedger, setPrintingLedger] = useState(false);
    const [printingSummary, setPrintingSummary] = useState(false);
    const [receiptActionLoading, setReceiptActionLoading] = useState(false);
    const [entries, setEntries] = useState<WorkbookLedgerEntry[]>([]);
    const [entriesLoaded, setEntriesLoaded] = useState(false);
    const [entryLoadScope, setEntryLoadScope] = useState<EntryLoadScope>('none');
    const [partnerNames, setPartnerNames] = useState<string[]>([]);
    const [siteNames, setSiteNames] = useState<string[]>([]);
    const [teamNames, setTeamNames] = useState<string[]>([]);
    const partnerSeedNamesRef = useRef<string[]>([]);
    const siteSeedNamesRef = useRef<string[]>([]);
    const teamSeedNamesRef = useRef<string[]>([]);
    const catalogsLoadedRef = useRef(false);
    const entriesLoadedRef = useRef(false);
    const entryLoadQueryRef = useRef<EntryLoadQuery>({ scope: 'none' });
    const entryLoadQueryKeyRef = useRef(buildEntryLoadQueryKey({ scope: 'none' }));
    const [selectedTeam, setSelectedTeam] = useState('');
    const [baseYear, setBaseYear] = useState(currentYear);
    const selectedTeamInputRef = useRef<HTMLInputElement | null>(null);
    const baseYearInputRef = useRef<HTMLInputElement | null>(null);
    const inputRowsRef = useRef<InputRow[]>([]);
    const selectedTeamRef = useRef('');
    const baseYearRef = useRef(currentYear);
    if (inputRowsRef.current.length === 0) {
        inputRowsRef.current = createEmptyInputRows();
    }

    const [ledgerDraft, setLedgerDraft] = useState<LedgerFilter>({
        startDate: defaultLedgerStart,
        endDate: todayString,
        teamName: '',
        transactionType: '매출',
        partnerName: '',
        siteName: ''
    });
    const [ledgerFilter, setLedgerFilter] = useState<LedgerFilter>({
        startDate: defaultLedgerStart,
        endDate: todayString,
        teamName: '',
        transactionType: '매출',
        partnerName: '',
        siteName: ''
    });

    const [summaryDraft, setSummaryDraft] = useState<SummaryFilter>({
        startDate: defaultLedgerStart,
        endDate: todayString,
        teamName: '',
        mode: '미수금',
        partnerName: '',
        siteName: '',
    });
    const [summaryFilter, setSummaryFilter] = useState<SummaryFilter>({
        startDate: defaultLedgerStart,
        endDate: todayString,
        teamName: '',
        mode: '미수금',
        partnerName: '',
        siteName: '',
    });
    const [dbFilter, setDbFilter] = useState<DbFilterState>(emptyDbFilter);
    const [dbSort, setDbSort] = useState<DbSortState>({ field: 'date', direction: 'asc' });
    const [dbPage, setDbPage] = useState(1);
    const [selectedDbEntryIds, setSelectedDbEntryIds] = useState<string[]>([]);
    const [selectedSummaryRowIds, setSelectedSummaryRowIds] = useState<string[]>([]);
    const [purchaseAccountsByName, setPurchaseAccountsByName] = useState<Map<string, AccountDirectory>>(new Map());
    const [editingDbDraft, setEditingDbDraft] = useState<DbEditDraft | null>(null);
    const [expandedDbEntryIds, setExpandedDbEntryIds] = useState<string[]>([]);
    const [receiptHistoryTargetId, setReceiptHistoryTargetId] = useState<string | null>(null);
    const [editingReceiptDraft, setEditingReceiptDraft] = useState<ReceiptEditDraft | null>(null);

    const rebuildLookupOptions = useCallback((savedEntries: WorkbookLedgerEntry[]) => {
        const nextPartnerNames = new Set(partnerSeedNamesRef.current);
        const nextSiteNames = new Set(siteSeedNamesRef.current);
        const nextTeamNames = new Set(teamSeedNamesRef.current);

        savedEntries.forEach((entry) => {
            if (entry.partnerName) nextPartnerNames.add(entry.partnerName);
            if (entry.siteName) nextSiteNames.add(entry.siteName);
            if (entry.teamName) nextTeamNames.add(entry.teamName);
        });

        setEntries(savedEntries);
        setPartnerNames(Array.from(nextPartnerNames).sort((left, right) => left.localeCompare(right, 'ko')));
        setSiteNames(Array.from(nextSiteNames).sort((left, right) => left.localeCompare(right, 'ko')));
        setTeamNames(Array.from(nextTeamNames).sort((left, right) => left.localeCompare(right, 'ko')));
    }, []);

    const refreshPageData = useCallback(async (options?: RefreshPageDataOptions): Promise<WorkbookLedgerEntry[] | null> => {
        let loadedEntries: WorkbookLedgerEntry[] | null = null;
        setLoading(true);
        try {
            const shouldLoadCatalogs = options?.forceCatalogs || !catalogsLoadedRef.current;
            const shouldLoadEntries = options?.loadEntries ?? entriesLoadedRef.current;
            const requestedEntryQuery = options?.entryQuery ?? entryLoadQueryRef.current;
            const [savedEntries, companies, sites, teams] = await Promise.all([
                shouldLoadEntries ? ledgerService.getEntries({
                    force: options?.forceEntries,
                    startDate: requestedEntryQuery.startDate,
                    endDate: requestedEntryQuery.endDate,
                    limitCount: requestedEntryQuery.limitCount,
                    orderDirection: requestedEntryQuery.orderDirection
                }) : Promise.resolve(null),
                shouldLoadCatalogs ? companyService.getActiveCompanies() : Promise.resolve(null),
                shouldLoadCatalogs ? siteService.getSites() : Promise.resolve(null),
                shouldLoadCatalogs ? teamService.getTeams() : Promise.resolve(null)
            ]);

            if (shouldLoadCatalogs) {
                partnerSeedNamesRef.current = (companies ?? [])
                    .map((company) => company.name)
                    .filter((name): name is string => Boolean(name));
                siteSeedNamesRef.current = (sites ?? [])
                    .map((site) => site.name)
                    .filter((name): name is string => Boolean(name));
                teamSeedNamesRef.current = (teams ?? [])
                    .map((team) => team.name)
                    .filter((name): name is string => Boolean(name));
                catalogsLoadedRef.current = true;
            }

            if (savedEntries) {
                loadedEntries = savedEntries;
                rebuildLookupOptions(savedEntries);
                entriesLoadedRef.current = true;
                entryLoadQueryRef.current = requestedEntryQuery;
                entryLoadQueryKeyRef.current = buildEntryLoadQueryKey(requestedEntryQuery);
                setEntriesLoaded(true);
                setEntryLoadScope(requestedEntryQuery.scope);
            }
        } catch (error) {
            console.error(error);
            Swal.fire('오류', '전용 장부 데이터를 불러오지 못했습니다.', 'error');
        } finally {
            setLoading(false);
        }

        return loadedEntries;
    }, [ledgerService, rebuildLookupOptions]);

    useEffect(() => {
        refreshPageData({ forceCatalogs: true, loadEntries: false });
    }, [refreshPageData]);

    const getEntryLoadQueryForTab = useCallback((tab: WorkbookTab): EntryLoadQuery => {
        if (tab === 'database') {
            return createRecentDbEntryLoadQuery();
        }

        if (tab === 'ledger') {
            return createRangeEntryLoadQuery(ledgerFilter.startDate, ledgerFilter.endDate);
        }

        if (tab === 'summary') {
            return createRangeEntryLoadQuery(summaryFilter.startDate, summaryFilter.endDate);
        }

        return { scope: 'none' };
    }, [ledgerFilter.endDate, ledgerFilter.startDate, summaryFilter.endDate, summaryFilter.startDate]);

    useEffect(() => {
        if (activeTab === 'input') return;

        const entryQuery = getEntryLoadQueryForTab(activeTab);
        const nextQueryKey = buildEntryLoadQueryKey(entryQuery);
        if (entriesLoadedRef.current && entryLoadQueryKeyRef.current === nextQueryKey) return;

        refreshPageData({ loadEntries: true, entryQuery });
    }, [activeTab, getEntryLoadQueryForTab, refreshPageData]);

    useEffect(() => {
        const loadPurchaseAccounts = async () => {
            try {
                const accounts = await accountDirectoryService.getEntriesByCategory('purchase');
                const nextMap = new Map<string, AccountDirectory>();

                accounts.forEach((account) => {
                    const key = normalizeText(account.name);
                    if (!key) return;
                    nextMap.set(key, account);
                });

                setPurchaseAccountsByName(nextMap);
            } catch (error) {
                console.error(error);
                setPurchaseAccountsByName(new Map());
            }
        };

        loadPurchaseAccounts();
    }, []);

    useEffect(() => {
        selectedTeamRef.current = selectedTeam;
    }, [selectedTeam]);

    const applyInputGridDerivedValuesForRows = useCallback((rowIndexes?: number[]) => {
        const hotInstance = hotRef.current?.hotInstance;
        if (!hotInstance || hotInstance.isDestroyed) {
            inputRowsRef.current = normalizeInputRows(
                inputRowsRef.current,
                baseYearRef.current,
                selectedTeamRef.current
            );
            return;
        }

        const sourceRows = hotInstance.getSourceData() as InputRow[];
        applyInputGridDerivedValues(
            hotInstance,
            rowIndexes ?? sourceRows.map((_, rowIndex) => rowIndex),
            baseYearRef.current,
            selectedTeamRef.current
        );
        inputRowsRef.current = hotInstance.getSourceData() as InputRow[];
    }, []);

    useEffect(() => {
        baseYearRef.current = baseYear;
        applyInputGridDerivedValuesForRows();
    }, [applyInputGridDerivedValuesForRows, baseYear]);

    const handleSelectedTeamChange = useCallback((value: string) => {
        selectedTeamRef.current = value;
    }, []);

    const handleBaseYearChange = useCallback((value: string) => {
        baseYearInputRef.current && (baseYearInputRef.current.value = value);
    }, []);

    const commitBaseYearInput = useCallback(() => {
        const input = baseYearInputRef.current;
        const value = input?.value.trim() ?? '';
        const nextYear = Number(value);

        if (!Number.isInteger(nextYear) || nextYear < 2000 || nextYear > 2100) {
            if (input) input.value = String(baseYearRef.current || currentYear);
            return;
        }

        baseYearRef.current = nextYear;
        setBaseYear(nextYear);
        if (input) input.value = String(nextYear);
    }, [currentYear]);

    const syncTopInputRefs = useCallback(() => {
        selectedTeamRef.current = selectedTeamInputRef.current?.value ?? selectedTeamRef.current;
        commitBaseYearInput();
    }, [commitBaseYearInput]);

    const handleInputGridAfterInit = useCallback(function handleInputGridAfterInit(this: any) {
        const hotInstance = this ?? hotRef.current?.hotInstance;
        hotInstance?.getFocusManager?.().setRefocusDelay(0);
    }, []);

    const refocusInputGridEditor = useCallback(() => {
        const hotInstance = hotRef.current?.hotInstance;
        if (!hotInstance || hotInstance.isDestroyed) return;

        hotInstance.getFocusManager?.().setRefocusDelay(0);
        hotInstance.getFocusManager?.().refocusToEditorTextarea?.(0);
    }, []);

    const handleInputGridSelectionEnd = useCallback(() => {
        refocusInputGridEditor();
    }, [refocusInputGridEditor]);

    const handleInputGridBeforeKeyDown = useCallback((event: KeyboardEvent) => {
        if (event.ctrlKey || event.metaKey || event.altKey) return;
        if (event.key.length !== 1 && event.key !== 'Process') return;
        refocusInputGridEditor();
    }, [refocusInputGridEditor]);

    const handleInputGridModifyFocusedElement = useCallback((_row: number, _column: number, focusedElement: HTMLElement) => {
        const hotInstance = hotRef.current?.hotInstance;
        const activeElement = hotInstance?.rootDocument?.activeElement as HTMLElement | null | undefined;

        if (
            activeElement &&
            activeElement !== hotInstance?.rootDocument?.body &&
            !hotInstance?.rootElement?.contains(activeElement) &&
            ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeElement.tagName)
        ) {
            return activeElement;
        }

        const activeEditor = hotInstance?.getActiveEditor?.();
        return activeEditor?.TEXTAREA ?? focusedElement;
    }, []);

    const handleInputGridChange = useCallback((changes: unknown, source: string) => {
        if (!Array.isArray(changes) || changes.length === 0) return;

        const hotInstance = hotRef.current?.hotInstance;
        if (!hotInstance) return;

        if (source === 'loadData' || source === 'updateData' || source === INPUT_GRID_DERIVED_SOURCE) {
            inputRowsRef.current = hotInstance.getSourceData() as InputRow[];
            return;
        }

        const changedRows = (changes as InputGridChange[])
            .map(([rowIndex]) => rowIndex)
            .filter((rowIndex) => Number.isInteger(rowIndex) && rowIndex >= 0);

        applyInputGridDerivedValues(
            hotInstance,
            changedRows,
            baseYearRef.current,
            selectedTeamRef.current
        );
        inputRowsRef.current = hotInstance.getSourceData() as InputRow[];
    }, []);

    const commitActiveInputGridEditor = useCallback(() => {
        const hotInstance = hotRef.current?.hotInstance;
        if (!hotInstance || hotInstance.isDestroyed) return;

        const activeEditor = hotInstance.getActiveEditor?.();
        if (!activeEditor || typeof activeEditor.isOpened !== 'function' || !activeEditor.isOpened()) {
            inputRowsRef.current = hotInstance.getSourceData() as InputRow[];
            return;
        }

        const rowIndex = Number(activeEditor.row);
        const columnIndex = Number(activeEditor.col);
        if (!Number.isInteger(rowIndex) || rowIndex < 0 || !Number.isInteger(columnIndex) || columnIndex < 0) {
            return;
        }

        const prop = activeEditor.prop ?? hotInstance.colToProp?.(columnIndex);
        const editorValue = typeof activeEditor.getValue === 'function' ? activeEditor.getValue() : undefined;

        if (prop !== undefined && prop !== null && editorValue !== undefined) {
            const sourceRows = hotInstance.getSourceData() as InputRow[];
            const sourceRow = sourceRows[rowIndex] as unknown as Record<string, unknown> | undefined;
            const currentValue = sourceRow?.[String(prop)];

            if (!areInputGridValuesEqual(currentValue, editorValue)) {
                hotInstance.setSourceDataAtCell(rowIndex, prop, editorValue, INPUT_GRID_MOUSE_COMMIT_SOURCE);
            }
        }

        if (typeof activeEditor.finishEditing === 'function') {
            activeEditor.finishEditing(false);
        }

        applyInputGridDerivedValues(
            hotInstance,
            [rowIndex],
            baseYearRef.current,
            selectedTeamRef.current
        );
        inputRowsRef.current = hotInstance.getSourceData() as InputRow[];
    }, []);

    const handleInputGridBeforeMouseDown = useCallback((event: MouseEvent, coords: { row: number; col: number }) => {
        if (event.button !== 0) return;
        if (!coords || coords.row < 0 || coords.col < 0) return;
        commitActiveInputGridEditor();
    }, [commitActiveInputGridEditor]);

    const handleResetInputGrid = useCallback(() => {
        const nextRows = createEmptyInputRows();
        inputRowsRef.current = nextRows;

        const hotInstance = hotRef.current?.hotInstance;
        if (hotInstance && !hotInstance.isDestroyed) {
            hotInstance.loadData(nextRows);
        }
    }, []);

    const handleSaveRows = useCallback(async () => {
        syncTopInputRefs();
        commitActiveInputGridEditor();

        const hotInstance = hotRef.current?.hotInstance;
        const sourceRows = hotInstance && !hotInstance.isDestroyed
            ? (hotInstance.getSourceData() as InputRow[])
            : inputRowsRef.current;
        inputRowsRef.current = sourceRows;

        const normalizedRows = sourceRows.map((row) => normalizeInputRow(row, baseYearRef.current, selectedTeamRef.current));
        const filledRows = normalizedRows
            .map((row, index) => ({ row, excelRowNumber: index + 7 }))
            .filter(({ row }) => hasInputContent(row));

        if (filledRows.length === 0) {
            Swal.fire('안내', '저장할 입력 행이 없습니다.', 'info');
            return;
        }

        const validationErrors: string[] = [];
        const preparedEntries: Omit<WorkbookLedgerEntry, 'createdAt' | 'updatedAt'>[] = [];

        filledRows.forEach(({ row, excelRowNumber }) => {
            if (!row.transactionType) {
                validationErrors.push(`${excelRowNumber}행: 구분을 선택하세요.`);
                return;
            }

            if (!row.date) {
                validationErrors.push(`${excelRowNumber}행: 날짜를 입력하세요.`);
                return;
            }

            if (!row.partnerName) {
                validationErrors.push(`${excelRowNumber}행: 거래처명을 입력하세요.`);
                return;
            }

            const supplyAmount = toNumberOrNull(row.supplyAmount) ?? 0;
            const taxAmount = row.taxAmount ?? 0;
            const totalAmount = row.totalAmount ?? 0;
            const paymentAmount = toNumberOrNull(row.paymentAmount) ?? 0;
            const appliedMonth = toNumberOrNull(row.appliedMonth) ?? getMonthFromDate(row.date);

            if (totalAmount === 0 && paymentAmount <= 0) {
                validationErrors.push(`${excelRowNumber}행: 합계 또는 입금금액 중 하나는 입력되어야 합니다.`);
                return;
            }

            const basePayload = {
                transactionType: row.transactionType,
                date: row.date,
                partnerName: row.partnerName,
                siteName: row.siteName,
                description: row.description,
                manDays: toNumberOrNull(row.manDays),
                appliedYear: row.appliedYear ?? baseYearRef.current,
                appliedMonth,
                note: row.note,
                teamName: row.teamName || selectedTeamRef.current,
                createdBy: currentUser?.uid ?? ''
            };

            const baseDescription = row.description || row.transactionType;

            if (totalAmount !== 0) {
                const sourceEntryId = `${row.transactionType}-${row.date}-${excelRowNumber}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

                preparedEntries.push({
                    id: sourceEntryId,
                    ...basePayload,
                    description: baseDescription,
                    supplyAmount,
                    taxAmount,
                    totalAmount,
                    paymentAmount: 0
                });

                if (paymentAmount > 0) {
                    preparedEntries.push({
                        ...basePayload,
                        description: getSettlementLabels(row.transactionType).action,
                        supplyAmount: 0,
                        taxAmount: 0,
                        totalAmount: 0,
                        paymentAmount,
                        matchedEntryId: sourceEntryId
                    });
                }

                return;
            }

            preparedEntries.push({
                ...basePayload,
                description:
                    row.description ||
                    (totalAmount !== 0
                        ? (row.transactionType === '매출' ? '매출' : '매입')
                        : (
                            row.transactionType === '매출'
                                ? '입금'
                                : '지급'
                        )),
                supplyAmount,
                taxAmount,
                totalAmount,
                paymentAmount
            });
        });

        if (validationErrors.length > 0) {
            Swal.fire('입력 확인', validationErrors.slice(0, 8).join('<br />'), 'warning');
            return;
        }

        if (preparedEntries.length === 0) {
            Swal.fire('안내', '저장 가능한 데이터가 없습니다.', 'info');
            return;
        }

        setSaving(true);
        try {
            await ledgerService.addEntries(preparedEntries);
            handleResetInputGrid();
            await refreshPageData();
            Swal.fire('저장 완료', `${preparedEntries.length}건을 전용 장부 DB에 등록했습니다.`, 'success');
        } catch (error) {
            console.error(error);
            Swal.fire('오류', '장부 데이터를 저장하지 못했습니다.', 'error');
        } finally {
            setSaving(false);
        }
    }, [commitActiveInputGridEditor, currentUser?.uid, handleResetInputGrid, refreshPageData, syncTopInputRefs]);

    const handleOpenDbUpload = useCallback(() => {
        dbUploadInputRef.current?.click();
    }, []);

    const handleDbUploadFile = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';

        if (!file) return;

        setUploadingDb(true);
        try {
            const XLSX = await import('xlsx');
            const buffer = await file.arrayBuffer();
            const workbook = XLSX.read(buffer, { type: 'array' });
            const sheetName = workbook.SheetNames.includes('DB') ? 'DB' : workbook.SheetNames[0];

            if (!sheetName) {
                throw new Error('업로드 파일에서 시트를 찾을 수 없습니다.');
            }

            const worksheet = workbook.Sheets[sheetName];
            const rows = XLSX.utils.sheet_to_json(worksheet, {
                header: 1,
                raw: false,
                defval: ''
            }) as unknown[][];

            syncTopInputRefs();
            const { entries: importedEntries, skipped } = parseImportedDbEntries(
                rows,
                selectedTeamRef.current,
                baseYearRef.current
            );

            if (importedEntries.length === 0) {
                Swal.fire('안내', '가져올 수 있는 DB 행이 없습니다.', 'info');
                return;
            }

            const result = await Swal.fire({
                title: 'DB 업로드',
                html:
                    `${importedEntries.length.toLocaleString()}건을 현재 장부 DB에 추가합니다.` +
                    `${skipped > 0 ? `<br />건너뜀: ${skipped.toLocaleString()}건` : ''}`,
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: '업로드',
                cancelButtonText: '취소'
            });

            if (!result.isConfirmed) return;

            await ledgerService.addEntries(
                importedEntries.map((entry) => ({
                    ...entry,
                    createdBy: currentUser?.uid ?? ''
                }))
            );

            await refreshPageData();
            setActiveTab('database');
            Swal.fire('업로드 완료', `${importedEntries.length.toLocaleString()}건을 DB에 추가했습니다.`, 'success');
        } catch (error) {
            console.error(error);
            Swal.fire('오류', error instanceof Error ? error.message : 'DB 업로드에 실패했습니다.', 'error');
        } finally {
            setUploadingDb(false);
        }
    }, [currentUser?.uid, refreshPageData, syncTopInputRefs]);

    const loadAllEntries = useCallback(async (reason: 'view' | 'download' | 'reset' = 'view') => {
        if (entryLoadScope === 'all') {
            return entries;
        }

        if (reason !== 'view') {
            const result = await Swal.fire({
                title: '전체 DB 불러오기',
                text: reason === 'download'
                    ? '현재 화면은 일부 데이터만 불러온 상태입니다. 다운로드 전에 전체 DB를 한 번 불러올까요?'
                    : '현재 화면은 일부 데이터만 불러온 상태입니다. 초기화 전에 전체 DB를 한 번 확인할까요?',
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: '전체 불러오기',
                cancelButtonText: '취소'
            });

            if (!result.isConfirmed) return null;
        }

        return refreshPageData({
            forceEntries: true,
            loadEntries: true,
            entryQuery: createAllEntryLoadQuery()
        });
    }, [entries, entryLoadScope, refreshPageData]);

    const handleLoadAllEntries = useCallback(() => {
        loadAllEntries('view');
    }, [loadAllEntries]);

    const handleDownloadDb = useCallback(async () => {
        const downloadEntries = entryLoadScope === 'all'
            ? entries
            : await loadAllEntries('download');

        if (!downloadEntries) return;

        if (downloadEntries.length === 0) {
            Swal.fire('안내', '다운로드할 DB 데이터가 없습니다.', 'info');
            return;
        }

        setDownloadingDb(true);
        try {
            const XLSX = await import('xlsx');
            const { saveAs } = await import('file-saver');
            const worksheet = XLSX.utils.aoa_to_sheet([
                [...DB_HEADERS],
                ...downloadEntries.map(toDbRow)
            ]);

            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'DB');

            const workbookBuffer = XLSX.write(workbook, {
                bookType: 'xlsx',
                type: 'array'
            });

            const blob = new Blob([workbookBuffer], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });

            saveAs(blob, `매입매출_DB_${new Date().toISOString().slice(0, 10)}.xlsx`);
        } catch (error) {
            console.error(error);
            Swal.fire('오류', 'DB 다운로드에 실패했습니다.', 'error');
        } finally {
            setDownloadingDb(false);
        }
    }, [entries, entryLoadScope, loadAllEntries]);

    const handleCopyCapture = useCallback(async (
        target: 'ledger' | 'summary',
        element: HTMLElement | null,
        label: string
    ) => {
        if (!element) {
            Swal.fire('안내', `${label} 화면을 찾지 못했습니다.`, 'info');
            return;
        }

        setCapturingView(target);
        try {
            const { default: html2canvas } = await import('html2canvas');
            const captureWidth = Math.max(element.scrollWidth, element.clientWidth);
            const captureHeight = Math.max(element.scrollHeight, element.clientHeight);
            const deviceScale = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
            const preferredScale = Math.max(2.5, Math.min(deviceScale * 2, 4));
            const maxPixelArea = 36000000;
            const estimatedPixelArea = captureWidth * captureHeight * preferredScale * preferredScale;
            const captureScale = estimatedPixelArea > maxPixelArea
                ? Math.max(2, Math.sqrt(maxPixelArea / Math.max(captureWidth * captureHeight, 1)))
                : preferredScale;
            const canvas = await (html2canvas as any)(element, {
                scale: captureScale,
                backgroundColor: '#ffffff',
                logging: false,
                useCORS: true,
                width: captureWidth,
                height: captureHeight,
                windowWidth: captureWidth,
                windowHeight: captureHeight,
                onclone: (documentClone: Document) => {
                    const rootClone = documentClone.querySelector('.workbook-ledger-page');
                    if (!rootClone) return;

                    const rootElement = rootClone as HTMLElement;
                    rootElement.style.background = '#ffffff';
                    rootElement.style.textRendering = 'geometricPrecision';
                    rootElement.style.setProperty('-webkit-font-smoothing', 'antialiased');

                    const bodyClone = documentClone.body as HTMLBodyElement;
                    bodyClone.style.background = '#ffffff';
                    bodyClone.style.textRendering = 'geometricPrecision';
                    bodyClone.style.setProperty('-webkit-font-smoothing', 'antialiased');

                    // Expand scroll-limited wrappers so the copied image contains all searched rows.
                    rootClone.querySelectorAll('.sheet-table-wrapper, .workbook-frozen-table-wrapper').forEach((node) => {
                        const wrapper = node as HTMLElement;
                        wrapper.style.maxHeight = 'none';
                        wrapper.style.height = 'auto';
                        wrapper.style.overflow = 'visible';
                        wrapper.style.contain = 'none';
                    });

                    rootClone.querySelectorAll('.sheet-table thead th').forEach((node) => {
                        const th = node as HTMLElement;
                        th.style.position = 'static';
                        th.style.top = 'auto';
                    });

                    rootClone.querySelectorAll('table, th, td, input, button, .sheet-merged-heading').forEach((node) => {
                        const elementNode = node as HTMLElement;
                        elementNode.style.textRendering = 'geometricPrecision';
                        elementNode.style.setProperty('-webkit-font-smoothing', 'antialiased');
                    });
                },
                ignoreElements: (node: Element) => (node as HTMLElement).dataset?.html2canvasIgnore === 'true'
            });

            const blob = await new Promise<Blob | null>((resolve) => {
                canvas.toBlob((nextBlob: Blob | null) => resolve(nextBlob), 'image/png');
            });

            if (!blob) {
                Swal.fire('오류', `${label} 화면 이미지 생성에 실패했습니다.`, 'error');
                return;
            }

            const ClipboardItemCtor = (window as typeof window & {
                ClipboardItem?: new (items: Record<string, Blob>) => ClipboardItem;
            }).ClipboardItem;
            const clipboard = navigator.clipboard as Clipboard & {
                write?: (data: ClipboardItem[]) => Promise<void>;
            };

            if (!ClipboardItemCtor || !clipboard.write) {
                Swal.fire('안내', '이 브라우저는 이미지 클립보드 복사를 지원하지 않습니다.', 'info');
                return;
            }

            await clipboard.write([
                new ClipboardItemCtor({
                    'image/png': blob
                })
            ]);

            Swal.fire('복사 완료', `${label} 화면이 클립보드에 복사되었습니다.`, 'success');
        } catch (error) {
            console.error(error);
            Swal.fire('오류', `${label} 화면 복사에 실패했습니다.`, 'error');
        } finally {
            setCapturingView((current) => (current === target ? null : current));
        }
    }, []);

    const handleEditDbEntry = useCallback(async (entry: WorkbookLedgerEntry) => {
        if (!entry.id) return;

        const linkedPayments = entries.filter((item) => isPaymentEntry(item) && item.matchedEntryId === entry.id);
        const linkedPaymentTotal = linkedPayments.reduce((sum, item) => sum + (item.paymentAmount ?? 0), 0);

        const result = await Swal.fire({
            title: 'DB 행 수정',
            width: 760,
            html: `
                <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;text-align:left;">
                    <label style="display:grid;gap:6px;">
                        <span style="font-size:13px;font-weight:700;">구분</span>
                        <select id="db-type" class="swal2-input" style="margin:0;width:100%;">
                            <option value="매출" ${entry.transactionType === '매출' ? 'selected' : ''}>매출</option>
                            <option value="매입" ${entry.transactionType === '매입' ? 'selected' : ''}>매입</option>
                        </section>
                    );
                        <span style="font-size:13px;font-weight:700;">내용</span>
                        <input id="db-description" type="text" value="${escapeHtml(entry.description || '')}" class="swal2-input" style="margin:0;width:100%;" />
                    </label>
                    <label style="display:grid;gap:6px;">
                        <span style="font-size:13px;font-weight:700;">공급가액</span>
                        <input id="db-supply" type="number" value="${entry.supplyAmount || 0}" class="swal2-input" style="margin:0;width:100%;" />
                    </label>
                    <label style="display:grid;gap:6px;">
                        <span style="font-size:13px;font-weight:700;">입금금액</span>
                        <input id="db-payment" type="number" min="0" value="${entry.paymentAmount || 0}" class="swal2-input" style="margin:0;width:100%;" />
                    </label>
                    <label style="display:grid;gap:6px;">
                        <span style="font-size:13px;font-weight:700;">적용연도</span>
                        <input id="db-year" type="number" min="2000" max="2100" value="${entry.appliedYear ?? getYearFromDate(entry.date) ?? baseYear}" class="swal2-input" style="margin:0;width:100%;" />
                    </label>
                    <label style="display:grid;gap:6px;">
                        <span style="font-size:13px;font-weight:700;">적용월</span>
                        <input id="db-month" type="number" min="1" max="12" value="${entry.appliedMonth ?? getMonthFromDate(entry.date) ?? 1}" class="swal2-input" style="margin:0;width:100%;" />
                    </label>
                    <label style="display:grid;gap:6px;grid-column:1 / -1;">
                        <span style="font-size:13px;font-weight:700;">비고</span>
                        <input id="db-note" type="text" value="${escapeHtml(entry.note || '')}" class="swal2-input" style="margin:0;width:100%;" />
                    </label>
                    <label style="display:grid;gap:6px;grid-column:1 / -1;">
                        <span style="font-size:13px;font-weight:700;">팀명</span>
                        <input id="db-team" type="text" value="${escapeHtml(entry.teamName || '')}" class="swal2-input" style="margin:0;width:100%;" />
                    </label>
                    ${entry.matchedEntryId ? `
                        <label style="display:grid;gap:6px;grid-column:1 / -1;">
                            <span style="font-size:13px;font-weight:700;">매칭매출ID</span>
                            <input type="text" value="${escapeHtml(entry.matchedEntryId)}" class="swal2-input" style="margin:0;width:100%;background:#f8fafc;" readonly />
                        </label>
                    ` : ''}
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: '저장',
            cancelButtonText: '취소',
            focusConfirm: false,
            preConfirm: () => {
                const transactionType = ((document.getElementById('db-type') as HTMLSelectElement | null)?.value ?? '') as WorkbookTransactionType;
                const date = normalizeDate((document.getElementById('db-date') as HTMLInputElement | null)?.value ?? '');
                const partnerName = normalizeText((document.getElementById('db-partner') as HTMLInputElement | null)?.value ?? '');
                const siteName = normalizeText((document.getElementById('db-site') as HTMLInputElement | null)?.value ?? '');
                const description = normalizeText((document.getElementById('db-description') as HTMLInputElement | null)?.value ?? '');
                const supplyAmount = toNumberOrNull((document.getElementById('db-supply') as HTMLInputElement | null)?.value ?? '0') ?? 0;
                const paymentAmount = toNumberOrNull((document.getElementById('db-payment') as HTMLInputElement | null)?.value ?? '0') ?? 0;
                const appliedYear = toNumberOrNull((document.getElementById('db-year') as HTMLInputElement | null)?.value ?? '') ?? getYearFromDate(date) ?? baseYear;
                const appliedMonth = toNumberOrNull((document.getElementById('db-month') as HTMLInputElement | null)?.value ?? '') ?? getMonthFromDate(date);
                const note = normalizeText((document.getElementById('db-note') as HTMLInputElement | null)?.value ?? '');
                const teamName = normalizeText((document.getElementById('db-team') as HTMLInputElement | null)?.value ?? '');
                const taxAmount = supplyAmount !== 0 ? Math.round(supplyAmount * 0.1) : 0;
                const totalAmount = supplyAmount !== 0 ? supplyAmount + taxAmount : 0;

                if (transactionType !== '매출' && transactionType !== '매입') {
                    Swal.showValidationMessage('구분을 선택해 주세요.');
                    return null;
                }

                if (!date) {
                    Swal.showValidationMessage('날짜를 입력해 주세요.');
                    return null;
                }

                if (!partnerName) {
                    Swal.showValidationMessage('거래처명을 입력해 주세요.');
                    return null;
                }

                if (totalAmount === 0 && paymentAmount <= 0) {
                    Swal.showValidationMessage('공급가액 또는 입금금액 중 하나는 입력해 주세요.');
                    return null;
                }

                if (paymentAmount < 0) {
                    Swal.showValidationMessage('입금금액은 0 이상이어야 합니다.');
                    return null;
                }

                if (linkedPayments.length > 0 && transactionType !== entry.transactionType) {
                    Swal.showValidationMessage('연결된 입금내역이 있는 매출/매입 행은 구분을 변경할 수 없습니다.');
                    return null;
                }

                if (linkedPayments.length > 0 && totalAmount <= 0) {
                    Swal.showValidationMessage('연결된 입금내역이 있는 행은 합계를 0으로 만들 수 없습니다.');
                    return null;
                }

                if (totalAmount > 0) {
                    const minimumInvoiceAmount = linkedPaymentTotal + paymentAmount;
                    if (totalAmount < minimumInvoiceAmount) {
                        Swal.showValidationMessage(`합계는 연결된 입금 ${formatNumber(minimumInvoiceAmount)}원 이상이어야 합니다.`);
                        return null;
                    }
                }

                if (paymentAmount > 0 && entry.matchedEntryId) {
                    const matchedInvoice = entries.find((item) => item.id === entry.matchedEntryId && isInvoiceEntry(item));
                    if (matchedInvoice) {
                        if (transactionType !== matchedInvoice.transactionType) {
                            Swal.showValidationMessage('입금 행의 구분은 연결된 원본 행과 같아야 합니다.');
                            return null;
                        }

                        const siblingPayments = entries
                            .filter((item) => isPaymentEntry(item) && item.matchedEntryId === entry.matchedEntryId && item.id !== entry.id)
                            .reduce((sum, item) => sum + (item.paymentAmount ?? 0), 0);
                        const maxPaymentAmount = Math.max((matchedInvoice.totalAmount ?? 0) - siblingPayments, 0);

                        if (paymentAmount > maxPaymentAmount) {
                            Swal.showValidationMessage(`입금금액은 연결 매출의 잔액 ${formatNumber(maxPaymentAmount)}원을 넘을 수 없습니다.`);
                            return null;
                        }
                    }
                }

                return {
                    transactionType,
                    date,
                    partnerName,
                    siteName,
                    description,
                    supplyAmount,
                    taxAmount,
                    totalAmount,
                    paymentAmount,
                    appliedYear,
                    appliedMonth,
                    note,
                    teamName
                };
            }
        });

        if (!result.isConfirmed || !result.value) return;

        setDbActionLoading(true);
        try {
            await ledgerService.updateEntry(entry.id, {
                ...result.value,
                updatedBy: currentUser?.uid ?? ''
            });
            await refreshPageData();
            Swal.fire('수정 완료', 'DB 행을 수정했습니다.', 'success');
        } catch (error) {
            console.error(error);
            Swal.fire('오류', 'DB 행 수정에 실패했습니다.', 'error');
        } finally {
            setDbActionLoading(false);
        }
    }, [baseYear, currentUser?.uid, entries, refreshPageData]);

    const handleStartEditDbEntry = useCallback((entry: WorkbookLedgerEntry) => {
        if (!entry.id) return;
        setEditingDbDraft(createDbEditDraft(entry));
    }, []);

    const handleChangeEditingDbDraft = useCallback((field: keyof DbEditDraft, value: string) => {
        setEditingDbDraft((prev) => (prev ? { ...prev, [field]: value } : prev));
    }, []);

    const handleCancelEditDbEntry = useCallback(() => {
        setEditingDbDraft(null);
    }, []);

    const handleSaveDbEntry = useCallback(async () => {
        if (!editingDbDraft?.id) return;

        const entry = entries.find((item) => item.id === editingDbDraft.id);
        if (!entry?.id) {
            Swal.fire('안내', '수정할 DB 행을 다시 불러와 주세요.', 'info');
            return;
        }

        const linkedPayments = entries.filter((item) => isPaymentEntry(item) && item.matchedEntryId === entry.id);
        const linkedPaymentTotal = linkedPayments.reduce((sum, item) => sum + (item.paymentAmount ?? 0), 0);
        const transactionType = editingDbDraft.transactionType;
        const date = normalizeDate(editingDbDraft.date);
        const partnerName = normalizeText(editingDbDraft.partnerName);
        const siteName = normalizeText(editingDbDraft.siteName);
        const description = normalizeText(editingDbDraft.description);
        const supplyAmount = toNumberOrNull(editingDbDraft.supplyAmount) ?? 0;
        const paymentAmount = toNumberOrNull(editingDbDraft.paymentAmount) ?? 0;
        const appliedYear = toNumberOrNull(editingDbDraft.appliedYear) ?? getYearFromDate(date) ?? baseYear;
        const appliedMonth = toNumberOrNull(editingDbDraft.appliedMonth) ?? getMonthFromDate(date);
        const note = normalizeText(editingDbDraft.note);
        const teamName = normalizeText(editingDbDraft.teamName);
        const taxAmount = supplyAmount !== 0 ? Math.round(supplyAmount * 0.1) : 0;
        const totalAmount = supplyAmount !== 0 ? supplyAmount + taxAmount : 0;

        if (transactionType !== '매출' && transactionType !== '매입') {
            Swal.fire('입력 확인', '구분을 선택해 주세요.', 'warning');
            return;
        }

        if (!date) {
            Swal.fire('입력 확인', '날짜를 입력해 주세요.', 'warning');
            return;
        }

        if (!partnerName) {
            Swal.fire('입력 확인', '거래처명을 입력해 주세요.', 'warning');
            return;
        }

        if (totalAmount === 0 && paymentAmount <= 0) {
            Swal.fire('입력 확인', '공급가액 또는 입금금액 중 하나를 입력해 주세요.', 'warning');
            return;
        }

        if (paymentAmount < 0) {
            Swal.fire('입력 확인', '입금금액은 0 이상이어야 합니다.', 'warning');
            return;
        }

        if (linkedPayments.length > 0 && transactionType !== entry.transactionType) {
            Swal.fire('입력 확인', '연결된 입금내역이 있는 매출/매입 행은 구분을 변경할 수 없습니다.', 'warning');
            return;
        }

        if (linkedPayments.length > 0 && totalAmount <= 0) {
            Swal.fire('입력 확인', '연결된 입금내역이 있는 행은 합계를 0 이하로 변경할 수 없습니다.', 'warning');
            return;
        }

        if (totalAmount > 0) {
            const minimumInvoiceAmount = linkedPaymentTotal + paymentAmount;
            if (totalAmount < minimumInvoiceAmount) {
                Swal.fire('입력 확인', `합계는 연결된 입금 ${formatNumber(minimumInvoiceAmount)}원 이상이어야 합니다.`, 'warning');
                return;
            }
        }

        if (paymentAmount > 0 && entry.matchedEntryId) {
            const matchedInvoice = entries.find((item) => item.id === entry.matchedEntryId && isInvoiceEntry(item));
            if (matchedInvoice) {
                if (transactionType !== matchedInvoice.transactionType) {
                    Swal.fire('입력 확인', '입금 행의 구분은 연결된 원본 행과 같아야 합니다.', 'warning');
                    return;
                }

                const siblingPayments = entries
                    .filter((item) => isPaymentEntry(item) && item.matchedEntryId === entry.matchedEntryId && item.id !== entry.id)
                    .reduce((sum, item) => sum + (item.paymentAmount ?? 0), 0);
                const maxPaymentAmount = Math.max((matchedInvoice.totalAmount ?? 0) - siblingPayments, 0);

                if (paymentAmount > maxPaymentAmount) {
                    Swal.fire('입력 확인', `입금금액은 연결 매출의 잔액 ${formatNumber(maxPaymentAmount)}원을 넘을 수 없습니다.`, 'warning');
                    return;
                }
            }
        }

        setDbActionLoading(true);
        try {
            await ledgerService.updateEntry(entry.id, {
                transactionType,
                date,
                partnerName,
                siteName,
                description,
                supplyAmount,
                taxAmount,
                totalAmount,
                paymentAmount,
                appliedYear,
                appliedMonth,
                note,
                teamName,
                updatedBy: currentUser?.uid ?? ''
            });
            await refreshPageData();
            setEditingDbDraft(null);
            Swal.fire('수정 완료', 'DB 행을 수정했습니다.', 'success');
        } catch (error) {
            console.error(error);
            Swal.fire('오류', 'DB 행 수정에 실패했습니다.', 'error');
        } finally {
            setDbActionLoading(false);
        }
    }, [baseYear, currentUser?.uid, editingDbDraft, entries, refreshPageData]);

    const handleDeleteDbEntry = useCallback(async (entry: WorkbookLedgerEntry) => {
        if (!entry.id) return;

        const linkedPayments = entries.filter((item) => isPaymentEntry(item) && item.matchedEntryId === entry.id);

        if (isInvoiceEntry(entry) && linkedPayments.length > 0) {
            Swal.fire('삭제 불가', '이 행에 연결된 입금내역이 있습니다. 입금내역을 먼저 삭제해 주세요.', 'warning');
            return;
        }

        const result = await Swal.fire({
            title: 'DB 행 삭제',
            text: `${entry.date} / ${entry.partnerName} 행을 삭제하시겠습니까?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: '삭제',
            cancelButtonText: '취소'
        });

        if (!result.isConfirmed) return;

        setDbActionLoading(true);
        try {
            await ledgerService.softDeleteEntry(entry.id, currentUser?.uid ?? '');
            await refreshPageData();
            setEditingDbDraft((prev) => (prev?.id === entry.id ? null : prev));
            Swal.fire('삭제 완료', 'DB 행을 삭제했습니다.', 'success');
        } catch (error) {
            console.error(error);
            Swal.fire('오류', 'DB 행 삭제에 실패했습니다.', 'error');
        } finally {
            setDbActionLoading(false);
        }
    }, [currentUser?.uid, entries, refreshPageData]);

    const handleResetDatabase = useCallback(async () => {
        const resetEntries = entryLoadScope === 'all'
            ? entries
            : await loadAllEntries('reset');

        if (!resetEntries) return;

        if (resetEntries.length === 0) {
            Swal.fire('안내', '초기화할 DB 데이터가 없습니다.', 'info');
            return;
        }

        const result = await Swal.fire({
            title: 'DB 초기화',
            html: `현재 저장된 <strong>${resetEntries.length.toLocaleString()}건</strong>을 모두 초기화합니다.<br />계속하려면 <strong>초기화</strong>를 입력하세요.`,
            input: 'text',
            inputPlaceholder: '초기화',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: '초기화',
            cancelButtonText: '취소',
            focusConfirm: false,
            preConfirm: (value) => {
                if (normalizeText(value) !== '초기화') {
                    Swal.showValidationMessage("'초기화'를 입력하세요.");
                    return false;
                }

                return true;
            }
        });

        if (!result.isConfirmed) return;

        setDbActionLoading(true);
        try {
            const deletedCount = await ledgerService.softDeleteAllEntries(currentUser?.uid ?? '');
            await refreshPageData({ forceEntries: true });
            setEditingDbDraft(null);
            setExpandedDbEntryIds([]);
            setDbPage(1);
            Swal.fire('초기화 완료', `${deletedCount.toLocaleString()}건의 DB 데이터를 초기화했습니다.`, 'success');
        } catch (error) {
            console.error(error);
            Swal.fire('오류', 'DB 초기화에 실패했습니다.', 'error');
        } finally {
            setDbActionLoading(false);
        }
    }, [currentUser?.uid, entries, entryLoadScope, loadAllEntries, refreshPageData]);

    const handleBulkDeleteDbEntries = useCallback(async () => {
        if (selectedDbEntryIds.length === 0) {
            Swal.fire('안내', '삭제할 DB 행을 먼저 선택하세요.', 'info');
            return;
        }

        const selectedIdSet = new Set(selectedDbEntryIds);
        const selectedEntries = entries.filter((entry) => entry.id && selectedIdSet.has(entry.id));

        if (selectedEntries.length === 0) {
            Swal.fire('안내', '선택한 DB 행을 다시 불러와 주세요.', 'info');
            return;
        }

        const blockedInvoiceEntries = selectedEntries.filter((entry) => (
            Boolean(entry.id) &&
            isInvoiceEntry(entry) &&
            entries.some((item) => (
                Boolean(item.id) &&
                isPaymentEntry(item) &&
                item.matchedEntryId === entry.id &&
                !selectedIdSet.has(item.id!)
            ))
        ));

        const blockedInvoiceIdSet = new Set(
            blockedInvoiceEntries
                .map((entry) => entry.id)
                .filter((id): id is string => Boolean(id))
        );
        const deletableEntryIds = selectedEntries.reduce<string[]>((accumulator, entry) => {
            if (!entry.id || blockedInvoiceIdSet.has(entry.id)) return accumulator;
            accumulator.push(entry.id);
            return accumulator;
        }, []);

        if (deletableEntryIds.length === 0) {
            const blockedPreview = blockedInvoiceEntries
                .slice(0, 5)
                .map((entry) => `${escapeHtml(entry.date)} / ${escapeHtml(entry.partnerName)} / ${escapeHtml(entry.description || '-')}`)
                .join('<br />');
            Swal.fire(
                '삭제 불가',
                `선택한 원본 행에 연결된 입금내역이 남아 있습니다.<br />연결 행까지 함께 선택한 뒤 다시 시도하세요.${blockedPreview ? `<br /><br />${blockedPreview}` : ''}`,
                'warning'
            );
            return;
        }

        const blockedCount = blockedInvoiceEntries.length;
        const blockedPreview = blockedInvoiceEntries
            .slice(0, 5)
            .map((entry) => `${escapeHtml(entry.date)} / ${escapeHtml(entry.partnerName)} / ${escapeHtml(entry.description || '-')}`)
            .join('<br />');

        const result = await Swal.fire({
            title: '선택 행 일괄삭제',
            html: [
                `선택한 <strong>${selectedEntries.length.toLocaleString()}건</strong> 중 <strong>${deletableEntryIds.length.toLocaleString()}건</strong>을 삭제합니다.`,
                blockedCount > 0
                    ? `연결된 입금내역이 남아 있는 <strong>${blockedCount.toLocaleString()}건</strong>은 제외됩니다.${blockedPreview ? `<br /><br />${blockedPreview}${blockedCount > 5 ? '<br />...' : ''}` : ''}`
                    : ''
            ].filter(Boolean).join('<br />'),
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: blockedCount > 0
                ? '가능한 항목만 삭제'
                : '선택삭제',
            cancelButtonText: '취소'
        });

        if (!result.isConfirmed) return;

        setDbActionLoading(true);
        try {
            const deletedCount = await ledgerService.softDeleteEntries(deletableEntryIds, currentUser?.uid ?? '');
            await refreshPageData({ forceEntries: true });
            setSelectedDbEntryIds((prev) => prev.filter((id) => !deletableEntryIds.includes(id)));
            setEditingDbDraft((prev) => (prev && deletableEntryIds.includes(prev.id) ? null : prev));
            setExpandedDbEntryIds((prev) => prev.filter((id) => !deletableEntryIds.includes(id)));
            Swal.fire(
                blockedCount > 0 ? '부분 삭제 완료' : '삭제 완료',
                blockedCount > 0
                    ? `${deletedCount.toLocaleString()}건을 삭제했고 ${blockedCount.toLocaleString()}건은 제외했습니다.`
                    : `${deletedCount.toLocaleString()}건을 삭제했습니다.`,
                'success'
            );
        } catch (error) {
            console.error(error);
            Swal.fire('오류', '선택 행 일괄삭제에 실패했습니다.', 'error');
        } finally {
            setDbActionLoading(false);
        }
    }, [currentUser?.uid, entries, refreshPageData, selectedDbEntryIds]);

    const handleRegisterReceipt = useCallback(async (row: SummaryRow) => {
        const labels = getSettlementLabels(row.transactionType);

        const result = await Swal.fire({
            title: `${labels.action} 등록`,
            html: `
                <div style="display:grid;gap:12px;text-align:left;">
                    <div>
                        <div style="font-size:13px;font-weight:700;margin-bottom:6px;">거래처</div>
                        <div style="padding:10px 12px;border:1px solid #d7dde7;border-radius:10px;background:#f8fafc;">${row.partnerName}</div>
                    </div>
                    <div>
                        <div style="font-size:13px;font-weight:700;margin-bottom:6px;">${labels.outstanding}</div>
                        <div style="padding:10px 12px;border:1px solid #d7dde7;border-radius:10px;background:#f8fafc;">${formatNumber(row.outstandingAmount)}원</div>
                    </div>
                    <div>
                        <label for="receipt-date" style="font-size:13px;font-weight:700;display:block;margin-bottom:6px;">${labels.date}</label>
                        <input id="receipt-date" type="date" value="${todayString}" class="swal2-input" style="margin:0;width:100%;" />
                    </div>
                    <div>
                        <label for="receipt-amount" style="font-size:13px;font-weight:700;display:block;margin-bottom:6px;">${labels.amount}</label>
                        <input id="receipt-amount" type="number" min="1" max="${Math.max(1, row.outstandingAmount)}" value="${row.outstandingAmount}" class="swal2-input" style="margin:0;width:100%;" />
                    </div>
                    <div>
                        <label for="receipt-note" style="font-size:13px;font-weight:700;display:block;margin-bottom:6px;">비고</label>
                        <input id="receipt-note" type="text" class="swal2-input" style="margin:0;width:100%;" placeholder="${labels.placeholder}" />
                    </div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: '저장',
            cancelButtonText: '취소',
            focusConfirm: false,
            preConfirm: () => {
                const date = (document.getElementById('receipt-date') as HTMLInputElement | null)?.value ?? '';
                const amount = Number((document.getElementById('receipt-amount') as HTMLInputElement | null)?.value ?? '0');
                const note = (document.getElementById('receipt-note') as HTMLInputElement | null)?.value ?? '';

                if (!date) {
                    Swal.showValidationMessage(`${labels.date}를 입력하세요.`);
                    return null;
                }

                if (!Number.isFinite(amount) || amount <= 0) {
                    Swal.showValidationMessage(`${labels.amount}은 0보다 커야 합니다.`);
                    return null;
                }

                if (amount > row.outstandingAmount) {
                    Swal.showValidationMessage(`${labels.amount}은 현재 ${labels.outstanding}보다 클 수 없습니다.`);
                    return null;
                }

                return { date, amount, note };
            }
        });

        if (!result.isConfirmed || !result.value) return;

        const { date, amount, note } = result.value;
        const appliedYear = row.appliedYear ?? getYearFromDate(row.issueDate) ?? getYearFromDate(date);
        const appliedMonth = row.appliedMonth ?? getMonthFromDate(row.issueDate) ?? getMonthFromDate(date);

        setSaving(true);
        try {
            await ledgerService.addEntries([{
                transactionType: row.transactionType,
                date,
                partnerName: row.partnerName,
                siteName: row.siteName,
                description: labels.action,
                manDays: null,
                supplyAmount: 0,
                taxAmount: 0,
                totalAmount: 0,
                paymentAmount: amount,
                appliedYear,
                appliedMonth,
                matchedEntryId: row.id,
                note: normalizeText(note),
                teamName: row.teamName,
                createdBy: currentUser?.uid ?? ''
            }]);

            await refreshPageData();
            Swal.fire('저장 완료', `${formatNumber(amount)}원 ${labels.action}을 등록했습니다.`, 'success');
        } catch (error) {
            console.error(error);
            Swal.fire('오류', `${labels.action} 등록에 실패했습니다.`, 'error');
        } finally {
            setSaving(false);
        }
    }, [currentUser?.uid, refreshPageData, todayString]);

    const handleOpenReceiptHistory = useCallback((row: SummaryRow) => {
        setReceiptHistoryTargetId(row.id);
        setEditingReceiptDraft(null);
    }, []);

    const handleCloseReceiptHistory = useCallback(() => {
        setReceiptHistoryTargetId(null);
        setEditingReceiptDraft(null);
    }, []);

    const handleStartEditReceipt = useCallback((entry: WorkbookLedgerEntry) => {
        if (!entry.id) return;

        setEditingReceiptDraft({
            id: entry.id,
            date: entry.date,
            paymentAmount: String(entry.paymentAmount ?? ''),
            note: entry.note ?? ''
        });
    }, []);

    const handleCancelEditReceipt = useCallback(() => {
        setEditingReceiptDraft(null);
    }, []);

    const handleChangeEditingReceipt = useCallback((field: keyof ReceiptEditDraft, value: string) => {
        setEditingReceiptDraft((prev) => (prev ? { ...prev, [field]: value } : prev));
    }, []);

    const handleSaveEditedReceipt = useCallback(async () => {
        if (!editingReceiptDraft || !receiptHistoryTargetId) return;

        const receiptHistoryInvoice = entries.find(
            (entry) => entry.id === receiptHistoryTargetId && isInvoiceEntry(entry)
        );

        if (!receiptHistoryInvoice) {
            Swal.fire('안내', '기준이 되는 원본 행을 다시 불러와주세요.', 'info');
            return;
        }

        const receiptHistoryEntries = entries
            .filter((entry) => isPaymentEntry(entry) && entry.matchedEntryId === receiptHistoryTargetId)
            .sort(sortWorkbookEntries);

        const receiptHistoryTotal = receiptHistoryEntries.reduce((sum, entry) => sum + (entry.paymentAmount ?? 0), 0);
        const normalizedDate = normalizeDate(editingReceiptDraft.date);
        const paymentAmount = toNumberOrNull(editingReceiptDraft.paymentAmount) ?? 0;
        const currentReceipt = receiptHistoryEntries.find((entry) => entry.id === editingReceiptDraft.id);
        const labels = getSettlementLabels(receiptHistoryInvoice.transactionType);

        if (!currentReceipt) {
            Swal.fire('안내', '수정할 입금내역을 다시 불러와주세요.', 'info');
            return;
        }

        const currentAmount = currentReceipt.paymentAmount ?? 0;
        const maxAmount = Math.max((receiptHistoryInvoice.totalAmount ?? 0) - (receiptHistoryTotal - currentAmount), 0);

        if (!normalizedDate) {
            Swal.fire('입력 확인', '입금일자를 입력하세요.', 'warning');
            return;
        }

        if (paymentAmount <= 0) {
            Swal.fire('입력 확인', '입금금액은 0보다 커야 합니다.', 'warning');
            return;
        }

        if (paymentAmount > maxAmount) {
            Swal.fire('입력 확인', '수정 금액이 해당 매출의 잔액을 초과합니다.', 'warning');
            return;
        }

        setReceiptActionLoading(true);
        try {
            await ledgerService.updateEntry(editingReceiptDraft.id, {
                date: normalizedDate,
                paymentAmount,
                note: normalizeText(editingReceiptDraft.note),
                updatedBy: currentUser?.uid ?? ''
            });

            await refreshPageData();
            setEditingReceiptDraft(null);
            Swal.fire('수정 완료', '입금내역을 수정했습니다.', 'success');
        } catch (error) {
            console.error(error);
            Swal.fire('오류', '입금내역 수정에 실패했습니다.', 'error');
        } finally {
            setReceiptActionLoading(false);
        }
    }, [currentUser?.uid, editingReceiptDraft, entries, receiptHistoryTargetId, refreshPageData]);

    const handleDeleteReceipt = useCallback(async (entry: WorkbookLedgerEntry) => {
        if (!entry.id) return;

        const result = await Swal.fire({
            title: '입금내역 삭제',
            text: `${entry.date} / ${formatNumber(entry.paymentAmount)}원 입금내역을 삭제하시겠습니까?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: '삭제',
            cancelButtonText: '취소'
        });

        if (!result.isConfirmed) return;

        setReceiptActionLoading(true);
        try {
            await ledgerService.softDeleteEntry(entry.id, currentUser?.uid ?? '');
            await refreshPageData();
            setEditingReceiptDraft((prev) => (prev?.id === entry.id ? null : prev));
            Swal.fire('삭제 완료', '입금내역을 삭제했습니다.', 'success');
        } catch (error) {
            console.error(error);
            Swal.fire('오류', '입금내역 삭제에 실패했습니다.', 'error');
        } finally {
            setReceiptActionLoading(false);
        }
    }, [currentUser?.uid, refreshPageData]);

    const handleSaveEditedSettlement = useCallback(async () => {
        if (!editingReceiptDraft || !receiptHistoryTargetId) return;

        const sourceEntry = entries.find(
            (entry) => entry.id === receiptHistoryTargetId && isInvoiceEntry(entry)
        );

        if (!sourceEntry) {
            Swal.fire('알림', '수정할 원본 행을 찾을 수 없습니다.', 'info');
            return;
        }

        const linkedEntries = buildReceiptHistorySettlementEntries(entries, summaryFilter, receiptHistoryTargetId);

        const originalPaymentAmount = isPaymentEntry(sourceEntry) ? (sourceEntry.paymentAmount ?? 0) : 0;
        const linkedTotal = originalPaymentAmount + linkedEntries.reduce((sum, entry) => sum + (entry.paymentAmount ?? 0), 0);
        const normalizedDate = normalizeDate(editingReceiptDraft.date);
        const paymentAmount = toNumberOrNull(editingReceiptDraft.paymentAmount) ?? 0;
        const currentEntry = linkedEntries.find((entry) => entry.id === editingReceiptDraft.id);
        const labels = getSettlementLabels(sourceEntry.transactionType);

        if (!currentEntry) {
            Swal.fire('알림', '수정할 이력을 찾을 수 없습니다.', 'info');
            return;
        }

        const currentAmount = currentEntry.paymentAmount ?? 0;
        const maxAmount = Math.max((sourceEntry.totalAmount ?? 0) - (linkedTotal - currentAmount), 0);

        if (!normalizedDate) {
            Swal.fire('입력 확인', `${labels.date}를 입력하세요.`, 'warning');
            return;
        }

        if (paymentAmount <= 0) {
            Swal.fire('입력 확인', `${labels.amount}은 0보다 커야 합니다.`, 'warning');
            return;
        }

        if (paymentAmount > maxAmount) {
            Swal.fire('입력 확인', `수정 금액이 해당 ${labels.outstanding} 잔액을 초과합니다.`, 'warning');
            return;
        }

        setReceiptActionLoading(true);
        try {
            await ledgerService.updateEntry(editingReceiptDraft.id, {
                date: normalizedDate,
                paymentAmount,
                note: normalizeText(editingReceiptDraft.note),
                updatedBy: currentUser?.uid ?? ''
            });

            await refreshPageData();
            setEditingReceiptDraft(null);
            Swal.fire('수정 완료', `${labels.history}을 수정했습니다.`, 'success');
        } catch (error) {
            console.error(error);
            Swal.fire('오류', `${labels.history} 수정에 실패했습니다.`, 'error');
        } finally {
            setReceiptActionLoading(false);
        }
    }, [currentUser?.uid, editingReceiptDraft, entries, receiptHistoryTargetId, refreshPageData, summaryFilter]);

    const handleDeleteSettlement = useCallback(async (entry: WorkbookLedgerEntry) => {
        if (!entry.id) return;

        const labels = getSettlementLabels(entry.transactionType);
        const result = await Swal.fire({
            title: `${labels.history} 삭제`,
            text: `${entry.date} / ${formatNumber(entry.paymentAmount)}원 ${labels.history}을 삭제하시겠습니까?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: '삭제',
            cancelButtonText: '취소'
        });

        if (!result.isConfirmed) return;

        setReceiptActionLoading(true);
        try {
            await ledgerService.softDeleteEntry(entry.id, currentUser?.uid ?? '');
            await refreshPageData();
            setEditingReceiptDraft((prev) => (prev?.id === entry.id ? null : prev));
            Swal.fire('삭제 완료', `${labels.history}을 삭제했습니다.`, 'success');
        } catch (error) {
            console.error(error);
            Swal.fire('오류', `${labels.history} 삭제에 실패했습니다.`, 'error');
        } finally {
            setReceiptActionLoading(false);
        }
    }, [currentUser?.uid, refreshPageData]);

    const applyLedgerFilter = useCallback(() => {
        const draft = {
            ...ledgerDraft,
            startDate: normalizeDate(ledgerDraft.startDate) || defaultLedgerStart,
            endDate: normalizeDate(ledgerDraft.endDate) || todayString
        };

        const nextFilter = draft.startDate <= draft.endDate
            ? draft
            : {
                ...draft,
                startDate: draft.endDate,
                endDate: draft.startDate
            };

        setLedgerDraft(nextFilter);
        setLedgerFilter(nextFilter);
    }, [defaultLedgerStart, ledgerDraft, todayString]);

    const applySummaryFilter = useCallback(() => {
        const draft = {
            ...summaryDraft,
            startDate: normalizeDate(summaryDraft.startDate) || defaultLedgerStart,
            endDate: normalizeDate(summaryDraft.endDate) || todayString
        };

        const startDate = draft.startDate;
        const endDate = draft.endDate;

        if (!startDate || !endDate) {
            Swal.fire('입력 확인', '시작일과 종료일을 올바른 연/월/일로 입력해 주세요.', 'warning');
            return;
        }

        const nextFilter = startDate <= endDate
            ? draft
            : {
                ...draft,
                startDate: draft.endDate,
                endDate: draft.startDate
            };

        setSummaryFilter(nextFilter);
    }, [defaultLedgerStart, summaryDraft, todayString]);

    const ledgerRows = useMemo(
        () => (activeTab === 'ledger' ? buildLedgerRows(entries, ledgerFilter) : []),
        [activeTab, entries, ledgerFilter]
    );
    const summaryRows = useMemo(
        () => (activeTab === 'summary' || receiptHistoryTargetId ? buildSummaryRows(entries, summaryFilter) : []),
        [activeTab, entries, receiptHistoryTargetId, summaryFilter]
    );

    const ledgerTotals = useMemo(() => {
        return ledgerRows.reduce((accumulator, row) => ({
            transactionAmount: accumulator.transactionAmount + row.transactionAmount,
            paymentAmount: accumulator.paymentAmount + row.paymentAmount,
            balance: row.balance
        }), { transactionAmount: 0, paymentAmount: 0, balance: 0 });
    }, [ledgerRows]);

    const summaryTotals = useMemo(() => {
        return summaryRows.reduce((accumulator, row) => ({
            supplyAmount: accumulator.supplyAmount + row.supplyAmount,
            taxAmount: accumulator.taxAmount + row.taxAmount,
            totalAmount: accumulator.totalAmount + row.totalAmount,
            settledAmount: accumulator.settledAmount + getSummaryDisplayedSettledAmount(row),
            outstandingAmount: accumulator.outstandingAmount + row.outstandingAmount
        }), { supplyAmount: 0, taxAmount: 0, totalAmount: 0, settledAmount: 0, outstandingAmount: 0 });
    }, [summaryRows]);

    const analyzeSummaryKbBank = useCallback((bankName: unknown) => {
        const normalized = String(bankName ?? '')
            .toLowerCase()
            .replace(/\s+/g, '')
            .trim();
        const raw = String(bankName ?? '').trim();
        if (!normalized) {
            return {
                code: '',
                display: raw || '(은행명없음)',
                needsFix: true,
                reason: '은행명이 비어있거나 형식이 올바르지 않습니다.'
            };
        }

        // 이미 3자리 숫자 코드으로 저장된 경우 그대로 반환
        if (/^\d{3}$/.test(normalized)) {
            return {
                code: normalized,
                display: normalized,
                needsFix: false,
                reason: ''
            };
        }

        const candidates = Array.from(KB_BANK_CODE_BY_NAME.entries())
            .filter(([name]) => {
                const key = normalizeBankName(name);
                if (!key) return false;
                return normalized.includes(key) || key.includes(normalized);
            })
            .map(([name, code]) => ({ name, code }));

        if (candidates.length === 1) {
            return {
                code: candidates[0].code,
                display: candidates[0].code,
                needsFix: false,
                reason: ''
            };
        }

        if (candidates.length > 1) {
            const ranked = candidates
                .map((candidate) => {
                    const key = normalizeBankName(candidate.name);
                    let score = 0;
                    if (/은행|뱅크/.test(candidate.name)) score += 40;
                    if (/저축은행/.test(candidate.name)) score -= 15;
                    if (/증권|선물/.test(candidate.name)) score -= 20;
                    if (key === normalized) score += 50;
                    else if (key.startsWith(normalized)) score += 20;
                    else if (key.includes(normalized)) score += 10;
                    return { ...candidate, score };
                })
                .sort((a, b) => b.score - a.score);

            if (ranked[0] && (ranked.length === 1 || ranked[0].score > ranked[1].score)) {
                return {
                    code: ranked[0].code,
                    display: ranked[0].code,
                    needsFix: false,
                    reason: ''
                };
            }

            return {
                code: '',
                display: raw || '(은행명없음)',
                needsFix: true,
                reason: `유사 후보 다수: ${ranked.slice(0, 4).map((r) => `${r.name}(${r.code})`).join(', ')}`
            };
        }

        return {
            code: '',
            display: raw || '(은행명없음)',
            needsFix: true,
            reason: '등록된 은행명/별칭과 일치하는 코드가 없습니다.'
        };
    }, []);

    const resolveSummaryKbBankCode = useCallback((bankName: unknown) => {
        return analyzeSummaryKbBank(bankName).code;
    }, [analyzeSummaryKbBank]);

    const kbPreviewRows = useMemo(() => {
        if (summaryFilter.mode !== '미지급금') return [];
        const selectedIdSet = new Set(selectedSummaryRowIds);

        return summaryRows
            .filter((row) => selectedIdSet.has(row.id))
            .filter((row) => row.outstandingAmount > 0)
            .map((row) => {
                const account = purchaseAccountsByName.get(normalizeText(row.partnerName));
                const analysis = analyzeSummaryKbBank(account?.bankName);
                const accountNumber = normalizeText(account?.accountNumber);
                return {
                    bankCode: analysis.code,
                    bankCodeDisplay: analysis.display,
                    bankCodeNeedsFix: analysis.needsFix,
                    bankCodeReason: analysis.reason,
                    accountNumber,
                    amount: row.outstandingAmount,
                    receiverDisplay: kbReceiverDisplay.slice(0, 10),
                    memoDisplay: `${row.partnerName}${kbMemoSuffix}`.slice(0, 14)
                };
            });
    }, [analyzeSummaryKbBank, kbMemoSuffix, kbReceiverDisplay, purchaseAccountsByName, selectedSummaryRowIds, summaryFilter.mode, summaryRows]);

    const handleOpenKbPreview = useCallback(() => {
        if (summaryFilter.mode !== '미지급금') {
            Swal.fire('안내', '국민은행용 다운로드는 미지급금 조회에서만 가능합니다.', 'info');
            return;
        }

        if (kbPreviewRows.length === 0) {
            Swal.fire('안내', '국민은행용으로 내보낼 미지급금 행을 먼저 선택하세요.', 'info');
            return;
        }

        setShowKbPreview(true);
    }, [kbPreviewRows.length, summaryFilter.mode]);

    const handleDownloadSummaryKb = useCallback(async () => {
        if (summaryFilter.mode !== '미지급금') {
            Swal.fire('안내', '국민은행용 다운로드는 미지급금 조회에서만 가능합니다.', 'info');
            return;
        }

        if (kbPreviewRows.length === 0) {
            Swal.fire('안내', '국민은행용으로 내보낼 미지급금 행을 먼저 선택하세요.', 'info');
            return;
        }

        setDownloadingKb(true);
        try {
            const XLSX = await import('xlsx');
            const { saveAs } = await import('file-saver');

            const rows = kbPreviewRows.map((row) => [
                row.bankCode,
                row.accountNumber,
                row.amount,
                row.receiverDisplay,
                row.memoDisplay
            ]);

            const worksheet = XLSX.utils.aoa_to_sheet([
                ['은행코드', '계좌번호', '이체금액', '받는분통장표시', '내통장메모'],
                ...rows
            ]);

            worksheet['!cols'] = [
                { wch: 10 },
                { wch: 24 },
                { wch: 14 },
                { wch: 20 },
                { wch: 28 }
            ];

            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, '국민은행용');

            const workbookBuffer = XLSX.write(workbook, {
                bookType: 'xlsx',
                type: 'array'
            });

            const blob = new Blob([workbookBuffer], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });

            saveAs(blob, `미지급금_국민은행용_${new Date().toISOString().slice(0, 10)}.xlsx`);

            const missingCount = rows.filter((row) => !row[0] || !row[1]).length;
            if (missingCount > 0) {
                Swal.fire('완료', `다운로드 완료 (${kbPreviewRows.length.toLocaleString()}건)\n계좌 미매핑 ${missingCount.toLocaleString()}건`, 'warning');
            }
        } catch (error) {
            console.error(error);
            Swal.fire('오류', '국민은행용 다운로드에 실패했습니다.', 'error');
        } finally {
            setDownloadingKb(false);
            setShowKbPreview(false);
        }
    }, [kbPreviewRows, summaryFilter.mode]);

    const canRegisterReceipt = summaryFilter.mode === '미수금' || summaryFilter.mode === '미지급금';
    const canOpenReceiptHistory = canRegisterReceipt;
    const summarySettlementType: WorkbookTransactionType = summaryFilter.mode === '매입' || summaryFilter.mode === '미지급금' ? '매입' : '매출';
    const summarySettlementLabels = getSettlementLabels(summarySettlementType);

    const receiptHistoryInvoice = useMemo(() => {
        if (!receiptHistoryTargetId) return null;
        return entries.find((entry) => entry.id === receiptHistoryTargetId && isInvoiceEntry(entry)) ?? null;
    }, [entries, receiptHistoryTargetId]);

    const receiptHistorySummaryRow = useMemo(() => {
        if (!receiptHistoryTargetId) return null;
        return summaryRows.find((row) => row.id === receiptHistoryTargetId) ?? null;
    }, [receiptHistoryTargetId, summaryRows]);

    const receiptHistoryEntries = useMemo(
        () => buildReceiptHistorySettlementEntries(entries, summaryFilter, receiptHistoryTargetId),
        [entries, receiptHistoryTargetId, summaryFilter]
    );

    const receiptHistoryOriginalPaymentAmount = useMemo(() => {
        if (!receiptHistoryInvoice || !isPaymentEntry(receiptHistoryInvoice)) return 0;
        return receiptHistoryInvoice.paymentAmount ?? 0;
    }, [receiptHistoryInvoice]);

    const receiptHistoryTotal = useMemo(
        () => receiptHistoryOriginalPaymentAmount + receiptHistoryEntries.reduce((sum, entry) => sum + (entry.paymentAmount ?? 0), 0),
        [receiptHistoryEntries, receiptHistoryOriginalPaymentAmount]
    );

    const receiptHistoryOutstanding = useMemo(() => {
        if (!receiptHistoryInvoice) return 0;
        return (receiptHistoryInvoice.totalAmount ?? 0) - receiptHistoryTotal;
    }, [receiptHistoryInvoice, receiptHistoryTotal]);

    const legacyMatchedGap = useMemo(() => {
        if (!receiptHistorySummaryRow) return 0;
        return Math.max(receiptHistorySummaryRow.settledAmount - receiptHistoryTotal, 0);
    }, [receiptHistorySummaryRow, receiptHistoryTotal]);

    const receiptHistoryLabels = useMemo(
        () => getSettlementLabels(receiptHistoryInvoice?.transactionType ?? receiptHistorySummaryRow?.transactionType),
        [receiptHistoryInvoice?.transactionType, receiptHistorySummaryRow?.transactionType]
    );

    const handlePrintLedger = useCallback(() => {
        if (ledgerRows.length === 0) {
            Swal.fire('안내', '인쇄할 조회 결과가 없습니다.', 'info');
            return;
        }

        const transactionAmountLabel = ledgerFilter.transactionType === '매출' ? '매출금액' : '매입금액';
        const paymentAmountLabel = ledgerFilter.transactionType === '매출' ? '입금금액' : '지급금액';
        const title = ledgerFilter.partnerName || `${ledgerFilter.transactionType} 거래장`;
        const filterItems = [
            ['조회 기간', `${ledgerFilter.startDate} ~ ${ledgerFilter.endDate}`],
            ['구분', ledgerFilter.transactionType],
            ['팀명', ledgerFilter.teamName || '전체'],
            ['거래처', ledgerFilter.partnerName || '전체'],
            ['현장명', ledgerFilter.siteName || '전체'],
            ['건수', `${ledgerRows.length.toLocaleString()}건`]
        ];

        const rowsHtml = ledgerRows
            .map((row) => `
                <tr>
                    <td>${escapeHtml(row.date || '-')}</td>
                    <td>${escapeHtml(row.partnerName || '-')}</td>
                    <td>${escapeHtml(row.description || '-')}</td>
                    <td class="align-right">${row.transactionAmount !== 0 ? formatNumber(row.transactionAmount) : '-'}</td>
                    <td class="align-right">${row.paymentAmount !== 0 ? formatNumber(row.paymentAmount) : '-'}</td>
                    <td class="align-right">${formatNumber(row.balance)}</td>
                    <td>${escapeHtml(row.siteName || '-')}</td>
                    <td>${escapeHtml(row.note || '-')}</td>
                    <td>${escapeHtml(row.teamName || '-')}</td>
                </tr>
            `)
            .join('');

        const totalRowHtml = `
            <tr class="summary-total-row">
                <td></td>
                <td></td>
                <td>합계</td>
                <td class="align-right">${formatNumber(ledgerTotals.transactionAmount)}</td>
                <td class="align-right">${formatNumber(ledgerTotals.paymentAmount)}</td>
                <td class="align-right">${formatNumber(ledgerTotals.balance)}</td>
                <td></td>
                <td></td>
                <td></td>
            </tr>
        `;

        const ledgerPrintColGroup = buildPrintColGroup(LEDGER_PRINT_COLUMNS);
        const ledgerPrintColumnStyles = buildPrintColumnStyles(LEDGER_PRINT_COLUMNS);
        const printTheme = getPrintTableTheme(tenantKey);

        setPrintingLedger(true);

        const iframe = document.createElement('iframe');
        iframe.setAttribute('aria-hidden', 'true');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        iframe.style.visibility = 'hidden';
        document.body.appendChild(iframe);

        const cleanup = () => {
            setPrintingLedger(false);
            if (iframe.parentNode) {
                iframe.parentNode.removeChild(iframe);
            }
        };

        const printWindow = iframe.contentWindow;
        if (!printWindow) {
            cleanup();
            Swal.fire('오류', '인쇄 미리보기를 열 수 없습니다.', 'error');
            return;
        }

        const printableHtml = `
            <!DOCTYPE html>
            <html lang="ko">
                <head>
                    <meta charset="utf-8" />
                    <title>${escapeHtml(title)} 인쇄</title>
                    <style>
                        @page {
                            size: A4 landscape;
                            margin: 12mm;
                        }

                        * {
                            box-sizing: border-box;
                            -webkit-print-color-adjust: exact !important;
                            print-color-adjust: exact !important;
                        }

                        body {
                            margin: 0;
                            font-family: "Segoe UI", "Malgun Gothic", sans-serif;
                            color: #111827;
                            background: #ffffff;
                        }

                        .print-shell {
                            padding: 20px 24px 28px;
                        }

                        .print-header {
                            margin-bottom: 16px;
                        }

                        .print-header h1 {
                            margin: 0;
                            font-size: 26px;
                        }

                        .print-header p {
                            margin: 6px 0 0;
                            color: #475569;
                            font-size: 12px;
                        }

                        .print-filter-grid {
                            display: grid;
                            grid-template-columns: repeat(3, minmax(0, 1fr));
                            gap: 8px;
                            margin-bottom: 16px;
                        }

                        .print-filter-item {
                            padding: 8px 10px;
                            border: 1px solid #e5cf87;
                            border-radius: 10px;
                            background: #fff8d9;
                            font-size: 12px;
                        }

                        .print-filter-item strong {
                            display: inline-block;
                            margin-right: 6px;
                            color: #111827;
                        }

                        .print-table-heading {
                            padding: 11px 14px;
                            background: linear-gradient(180deg, #365f91 0%, #27466b 100%);
                            color: #ffffff;
                            font-size: 16px;
                            font-weight: 800;
                        }

                        table {
                            width: 100%;
                            border-collapse: collapse;
                            table-layout: fixed;
                        }

                        ${ledgerPrintColumnStyles}

                        th,
                        td {
                            border: 1px solid #cbd5e1;
                            padding: 5px 7px;
                            font-size: 11px;
                            line-height: 1.25;
                            vertical-align: top;
                            white-space: normal;
                            word-break: keep-all;
                            overflow-wrap: anywhere;
                        }

                        th {
                            background: ${printTheme.headerBackground};
                            color: ${printTheme.headerColor};
                            font-weight: 700;
                            white-space: nowrap;
                        }

                        td {
                            background: #ffffff;
                        }

                        .align-right {
                            text-align: right;
                        }

                        .summary-total-row td {
                            background: ${printTheme.totalBackground};
                            color: ${printTheme.totalColor};
                            font-weight: 700;
                        }
                    </style>
                </head>
                <body>
                    <div class="print-shell">
                        <div class="print-header">
                            <h1>${escapeHtml(title)}</h1>
                            <p>${escapeHtml(new Date().toLocaleString('ko-KR'))}</p>
                        </div>
                        <div class="print-filter-grid">
                            ${filterItems.map(([label, value]) => `
                                <div class="print-filter-item">
                                    <strong>${escapeHtml(label)}</strong>${escapeHtml(value)}
                                </div>
                            `).join('')}
                        </div>
                        <div class="print-table-heading">${escapeHtml(title)}</div>
                        <table>
                            ${ledgerPrintColGroup}
                            <thead>
                                <tr>
                                    <th>날짜</th>
                                    <th>거래처명</th>
                                    <th>내용</th>
                                    <th>${escapeHtml(transactionAmountLabel)}</th>
                                    <th>${escapeHtml(paymentAmountLabel)}</th>
                                    <th>잔액</th>
                                    <th>현장명</th>
                                    <th>비고</th>
                                    <th>팀명</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${rowsHtml}
                                ${totalRowHtml}
                            </tbody>
                        </table>
                    </div>
                </body>
            </html>
        `;

        printWindow.document.open();
        printWindow.document.write(printableHtml);
        printWindow.document.close();

        const handleAfterPrint = () => {
            printWindow.removeEventListener('afterprint', handleAfterPrint);
            cleanup();
        };

        printWindow.addEventListener('afterprint', handleAfterPrint);

        window.setTimeout(() => {
            try {
                printWindow.focus();
                printWindow.print();
            } catch (error) {
                console.error(error);
                cleanup();
                Swal.fire('오류', '인쇄 실행 중 오류가 발생했습니다.', 'error');
            }
        }, 150);
    }, [ledgerFilter, ledgerRows, ledgerTotals, tenantKey]);

    const handlePrintSummary = useCallback(() => {
        if (summaryRows.length === 0) {
            Swal.fire('안내', '인쇄할 조회 결과가 없습니다.', 'info');
            return;
        }

        const paymentDateLabel = summarySettlementLabels.date;
        const settledAmountLabel = summarySettlementLabels.amount;
        const outstandingLabel = summarySettlementLabels.outstanding;
        const countText = `${summaryRows.length.toLocaleString()}건`;
        const dateRangeLabel = summaryFilter.mode === '매출' || summaryFilter.mode === '매입'
            ? '발행일 기간'
            : `${paymentDateLabel} 기간`;
        const filterItems = [
            [dateRangeLabel, `${summaryFilter.startDate} ~ ${summaryFilter.endDate}`],
            ['구분', summaryFilter.mode],
            ['팀명', summaryFilter.teamName || '전체'],
            ['거래처', summaryFilter.partnerName || '전체'],
            ['현장명', summaryFilter.siteName || '전체'],
            ['건수', countText]
        ];

        const rowsHtml = summaryRows
            .map((row, index) => `
                <tr>
                    <td class="align-right">${index + 1}</td>
                    <td>${escapeHtml(row.partnerName || '-')}</td>
                    <td>${escapeHtml(row.siteName || '-')}</td>
                    <td>${escapeHtml(row.issueDate || '-')}</td>
                    <td class="align-right">${formatNumber(row.supplyAmount)}</td>
                    <td class="align-right">${formatNumber(row.taxAmount)}</td>
                    <td class="align-right">${formatNumber(row.totalAmount)}</td>
                    <td>${row.paymentDates.length > 0 ? row.paymentDates.map((paymentDate) => escapeHtml(paymentDate)).join('<br />') : '-'}</td>
                    <td class="align-right">${formatNumber(getSummaryDisplayedSettledAmount(row))}</td>
                    <td class="align-right">${formatNumber(row.outstandingAmount)}</td>
                    <td>${escapeHtml(row.note || '-')}</td>
                    <td>${escapeHtml(row.teamName || '-')}</td>
                </tr>
            `)
            .join('');

        const totalRowHtml = `
            <tr class="summary-total-row">
                <td></td>
                <td>합계</td>
                <td></td>
                <td></td>
                <td class="align-right">${formatNumber(summaryTotals.supplyAmount)}</td>
                <td class="align-right">${formatNumber(summaryTotals.taxAmount)}</td>
                <td class="align-right">${formatNumber(summaryTotals.totalAmount)}</td>
                <td></td>
                <td class="align-right">${formatNumber(summaryTotals.settledAmount)}</td>
                <td class="align-right">${formatNumber(summaryTotals.outstandingAmount)}</td>
                <td></td>
                <td></td>
            </tr>
        `;

        const summaryPrintColGroup = buildPrintColGroup(SUMMARY_PRINT_COLUMNS);
        const summaryPrintColumnStyles = buildPrintColumnStyles(SUMMARY_PRINT_COLUMNS);
        const printTheme = getPrintTableTheme(tenantKey);

        setPrintingSummary(true);

        const iframe = document.createElement('iframe');
        iframe.setAttribute('aria-hidden', 'true');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        iframe.style.visibility = 'hidden';
        document.body.appendChild(iframe);

        const cleanup = () => {
            setPrintingSummary(false);
            if (iframe.parentNode) {
                iframe.parentNode.removeChild(iframe);
            }
        };

        const printWindow = iframe.contentWindow;

        if (!printWindow) {
            cleanup();
            Swal.fire('오류', '인쇄 미리보기를 열 수 없습니다.', 'error');
            return;
        }

        const printableHtml = `
            <!DOCTYPE html>
            <html lang="ko">
                <head>
                    <meta charset="utf-8" />
                    <title>전체 조회 인쇄</title>
                    <style>
                        @page {
                            size: A4 landscape;
                            margin: 12mm;
                        }

                        * {
                            box-sizing: border-box;
                            -webkit-print-color-adjust: exact !important;
                            print-color-adjust: exact !important;
                        }

                        body {
                            margin: 0;
                            font-family: "Segoe UI", "Malgun Gothic", sans-serif;
                            color: #111827;
                            background: #ffffff;
                        }

                        .print-shell {
                            padding: 20px 24px 28px;
                        }

                        .print-header {
                            margin-bottom: 16px;
                        }

                        .print-header h1 {
                            margin: 0;
                            font-size: 26px;
                        }

                        .print-header p {
                            margin: 6px 0 0;
                            color: #475569;
                            font-size: 12px;
                        }

                        .print-filter-grid {
                            display: grid;
                            grid-template-columns: repeat(3, minmax(0, 1fr));
                            gap: 8px;
                            margin-bottom: 16px;
                        }

                        .print-filter-item {
                            padding: 8px 10px;
                            border: 1px solid #d7dde7;
                            border-radius: 10px;
                            background: #f8fafc;
                            font-size: 12px;
                        }

                        .print-filter-item strong {
                            display: inline-block;
                            margin-right: 6px;
                            color: #334155;
                        }

                        table {
                            width: 100%;
                            border-collapse: collapse;
                            table-layout: fixed;
                        }

                        ${summaryPrintColumnStyles}

                        th,
                        td {
                            border: 1px solid #cbd5e1;
                            padding: 5px 7px;
                            font-size: 11px;
                            line-height: 1.25;
                            vertical-align: top;
                            white-space: normal;
                            word-break: keep-all;
                            overflow-wrap: anywhere;
                        }

                        thead th {
                            background: ${printTheme.summaryHeaderBackground};
                            color: ${printTheme.summaryHeaderColor};
                            font-weight: 700;
                            white-space: nowrap;
                        }

                        tbody td:first-child {
                            background: #f8fafc;
                        }

                        .summary-total-row td {
                            background: ${printTheme.totalBackground};
                            color: ${printTheme.totalColor};
                            font-weight: 700;
                        }

                        .align-right {
                            text-align: right;
                        }
                    </style>
                </head>
                <body>
                    <div class="print-shell">
                        <div class="print-header">
                            <h1>전체 조회</h1>
                            <p>현재 조회 조건으로 검색된 결과만 인쇄합니다.</p>
                        </div>
                        <div class="print-filter-grid">
                            ${filterItems.map(([label, value]) => `
                                <div class="print-filter-item">
                                    <strong>${escapeHtml(label)}</strong>${escapeHtml(value)}
                                </div>
                            `).join('')}
                        </div>
                        <table>
                            ${summaryPrintColGroup}
                            <thead>
                                <tr>
                                    <th>No</th>
                                    <th>거래처명</th>
                                    <th>현장명</th>
                                    <th>발행일</th>
                                    <th>공급가액</th>
                                    <th>세액</th>
                                    <th>합계</th>
                                    <th>${escapeHtml(paymentDateLabel)}</th>
                                    <th>${escapeHtml(settledAmountLabel)}</th>
                                    <th>${escapeHtml(outstandingLabel)}</th>
                                    <th>비고</th>
                                    <th>팀명</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${rowsHtml}
                                ${totalRowHtml}
                            </tbody>
                        </table>
                    </div>
                </body>
            </html>
        `;

        printWindow.document.open();
        printWindow.document.write(printableHtml);
        printWindow.document.close();

        const handleAfterPrint = () => {
            printWindow.removeEventListener('afterprint', handleAfterPrint);
            cleanup();
        };

        printWindow.addEventListener('afterprint', handleAfterPrint);

        iframe.onload = () => {
            setTimeout(() => {
                try {
                    printWindow.focus();
                    printWindow.print();
                } catch (error) {
                    console.error(error);
                    cleanup();
                    Swal.fire('오류', '인쇄 미리보기를 여는 중 문제가 발생했습니다.', 'error');
                }
            }, 150);
        };

        window.setTimeout(() => {
            if (iframe.parentNode) {
                cleanup();
            }
        }, 60000);
    }, [summaryFilter, summaryRows, summarySettlementLabels, summaryTotals, tenantKey]);

    const linkedDbEntriesByParentId = useMemo(() => {
        const nextMap = new Map<string, WorkbookLedgerEntry[]>();

        entries.forEach((entry) => {
            if (!isPaymentEntry(entry) || !entry.matchedEntryId) return;

            const bucket = nextMap.get(entry.matchedEntryId) ?? [];
            bucket.push(entry);
            nextMap.set(entry.matchedEntryId, bucket);
        });

        nextMap.forEach((bucket) => {
            bucket.sort(sortWorkbookEntries);
        });

        return nextMap;
    }, [entries]);

    const deferredDbFilter = useDeferredValue(dbFilter);

    const hasDbFilterInput = useMemo(
        () => Object.values(dbFilter).some((value) => normalizeText(value) !== ''),
        [dbFilter]
    );

    const hasActiveDbFilter = useMemo(
        () => Object.values(deferredDbFilter).some((value) => normalizeText(value) !== ''),
        [deferredDbFilter]
    );

    const dbFilterCriteria = useMemo(() => ({
        transactionType: normalizeText(deferredDbFilter.transactionType).toLowerCase(),
        date: normalizeText(deferredDbFilter.date).toLowerCase(),
        partnerName: normalizeText(deferredDbFilter.partnerName).toLowerCase(),
        siteName: normalizeText(deferredDbFilter.siteName).toLowerCase(),
        description: normalizeText(deferredDbFilter.description).toLowerCase(),
        supplyAmount: normalizeText(deferredDbFilter.supplyAmount).replace(/,/g, ''),
        taxAmount: normalizeText(deferredDbFilter.taxAmount).replace(/,/g, ''),
        totalAmount: normalizeText(deferredDbFilter.totalAmount).replace(/,/g, ''),
        paymentAmount: normalizeText(deferredDbFilter.paymentAmount).replace(/,/g, ''),
        appliedYear: normalizeText(deferredDbFilter.appliedYear).replace(/,/g, ''),
        appliedMonth: normalizeText(deferredDbFilter.appliedMonth).replace(/,/g, ''),
        note: normalizeText(deferredDbFilter.note).toLowerCase(),
        teamName: normalizeText(deferredDbFilter.teamName).toLowerCase()
    }), [deferredDbFilter]);

    const dbEntryFilterIndex = useMemo(() => {
        const nextMap = new Map<WorkbookLedgerEntry, DbFilterState>();

        entries.forEach((entry) => {
            nextMap.set(entry, {
                transactionType: String(entry.transactionType ?? '').toLowerCase(),
                date: String(entry.date ?? '').toLowerCase(),
                partnerName: String(entry.partnerName ?? '').toLowerCase(),
                siteName: String(entry.siteName ?? '').toLowerCase(),
                description: String(entry.description ?? '').toLowerCase(),
                supplyAmount: String(entry.supplyAmount ?? ''),
                taxAmount: String(entry.taxAmount ?? ''),
                totalAmount: String(entry.totalAmount ?? ''),
                paymentAmount: String(entry.paymentAmount ?? ''),
                appliedYear: String(entry.appliedYear ?? ''),
                appliedMonth: String(entry.appliedMonth ?? ''),
                note: String(entry.note ?? '').toLowerCase(),
                teamName: String(entry.teamName ?? '').toLowerCase()
            });
        });

        return nextMap;
    }, [entries]);

    const matchesDbFilter = useCallback((entry: WorkbookLedgerEntry) => {
        const indexedEntry = dbEntryFilterIndex.get(entry);
        if (!indexedEntry) return false;

        const includesText = (source: string, keyword: string) => {
            if (!keyword) return true;
            return source.includes(keyword);
        };

        const includesNumber = (source: string, keyword: string) => {
            if (!keyword) return true;
            return source.includes(keyword);
        };

        return (
            includesText(indexedEntry.transactionType, dbFilterCriteria.transactionType) &&
            includesText(indexedEntry.date, dbFilterCriteria.date) &&
            includesText(indexedEntry.partnerName, dbFilterCriteria.partnerName) &&
            includesText(indexedEntry.siteName, dbFilterCriteria.siteName) &&
            includesText(indexedEntry.description, dbFilterCriteria.description) &&
            includesNumber(indexedEntry.supplyAmount, dbFilterCriteria.supplyAmount) &&
            includesNumber(indexedEntry.taxAmount, dbFilterCriteria.taxAmount) &&
            includesNumber(indexedEntry.totalAmount, dbFilterCriteria.totalAmount) &&
            includesNumber(indexedEntry.paymentAmount, dbFilterCriteria.paymentAmount) &&
            includesNumber(indexedEntry.appliedYear, dbFilterCriteria.appliedYear) &&
            includesNumber(indexedEntry.appliedMonth, dbFilterCriteria.appliedMonth) &&
            includesText(indexedEntry.note, dbFilterCriteria.note) &&
            includesText(indexedEntry.teamName, dbFilterCriteria.teamName)
        );
    }, [dbEntryFilterIndex, dbFilterCriteria]);

    const matchingDbEntries = useMemo(() => {
        if (!hasActiveDbFilter) return null;

        const nextSet = new Set<WorkbookLedgerEntry>();
        entries.forEach((entry) => {
            if (matchesDbFilter(entry)) {
                nextSet.add(entry);
            }
        });
        return nextSet;
    }, [entries, hasActiveDbFilter, matchesDbFilter]);

    const filteredLinkedDbEntriesByParentId = useMemo(() => {
        if (!hasActiveDbFilter) return linkedDbEntriesByParentId;

        const nextMap = new Map<string, WorkbookLedgerEntry[]>();
        linkedDbEntriesByParentId.forEach((bucket, parentId) => {
            const filteredBucket = bucket.filter((entry) => matchingDbEntries?.has(entry));
            if (filteredBucket.length > 0) {
                nextMap.set(parentId, filteredBucket);
            }
        });
        return nextMap;
    }, [hasActiveDbFilter, linkedDbEntriesByParentId, matchingDbEntries]);

    const sortedDbTopLevelEntries = useMemo(() => {
        const entryIds = new Set(entries.map((entry) => entry.id).filter((id): id is string => Boolean(id)));

        return entries
            .filter((entry) => !(isPaymentEntry(entry) && entry.matchedEntryId && entryIds.has(entry.matchedEntryId)))
            .slice()
            .sort((left, right) => compareDbEntriesBySortState(left, right, dbSort));
    }, [dbSort, entries]);

    const databaseDisplayRows = useMemo(() => {
        const rows: DatabaseDisplayRow[] = [];
        let topLevelIndex = 0;

        sortedDbTopLevelEntries.forEach((entry) => {
            const visibleLinkedEntries = entry.id ? (filteredLinkedDbEntriesByParentId.get(entry.id) ?? []) : [];
            const matchesTopLevel = hasActiveDbFilter ? (matchingDbEntries?.has(entry) ?? false) : true;

            if (hasActiveDbFilter && !matchesTopLevel && visibleLinkedEntries.length === 0) {
                return;
            }

            topLevelIndex += 1;
            rows.push({
                entry,
                indexLabel: String(topLevelIndex),
                nested: false
            });

            if (!entry.id) return;
            if (!hasActiveDbFilter && !expandedDbEntryIds.includes(entry.id)) return;

            visibleLinkedEntries.forEach((linkedEntry, linkedIndex) => {
                rows.push({
                    entry: linkedEntry,
                    indexLabel: `${topLevelIndex}-${linkedIndex + 1}`,
                    nested: true
                });
            });
        });

        return rows;
    }, [expandedDbEntryIds, filteredLinkedDbEntriesByParentId, hasActiveDbFilter, matchingDbEntries, sortedDbTopLevelEntries]);

    const totalDbPages = useMemo(
        () => Math.max(1, Math.ceil(databaseDisplayRows.length / DB_PAGE_SIZE)),
        [databaseDisplayRows.length]
    );

    const pagedDatabaseDisplayRows = useMemo(() => {
        const startIndex = (dbPage - 1) * DB_PAGE_SIZE;
        return databaseDisplayRows.slice(startIndex, startIndex + DB_PAGE_SIZE);
    }, [databaseDisplayRows, dbPage]);

    const selectedDbEntryIdSet = useMemo(
        () => new Set(selectedDbEntryIds),
        [selectedDbEntryIds]
    );

    const selectedSummaryRowIdSet = useMemo(
        () => new Set(selectedSummaryRowIds),
        [selectedSummaryRowIds]
    );

    const selectableSummaryRowIds = useMemo(
        () => summaryFilter.mode === '미지급금'
            ? summaryRows
                .filter((row) => row.outstandingAmount > 0)
                .map((row) => row.id)
            : [],
        [summaryFilter.mode, summaryRows]
    );

    const areAllSelectableSummaryRowsSelected = useMemo(
        () => selectableSummaryRowIds.length > 0 && selectableSummaryRowIds.every((id) => selectedSummaryRowIdSet.has(id)),
        [selectableSummaryRowIds, selectedSummaryRowIdSet]
    );

    const visibleSelectableDbEntryIds = useMemo(
        () => pagedDatabaseDisplayRows
            .map((row) => row.entry.id)
            .filter((id): id is string => Boolean(id)),
        [pagedDatabaseDisplayRows]
    );

    const areAllVisibleDbEntriesSelected = useMemo(
        () => visibleSelectableDbEntryIds.length > 0 && visibleSelectableDbEntryIds.every((id) => selectedDbEntryIdSet.has(id)),
        [selectedDbEntryIdSet, visibleSelectableDbEntryIds]
    );

    useEffect(() => {
        setDbPage(1);
    }, [dbFilter, dbSort]);

    useEffect(() => {
        if (dbPage <= totalDbPages) return;
        setDbPage(totalDbPages);
    }, [dbPage, totalDbPages]);

    useEffect(() => {
        const validEntryIds = new Set(entries.map((entry) => entry.id).filter((id): id is string => Boolean(id)));
        setSelectedDbEntryIds((prev) => prev.filter((id) => validEntryIds.has(id)));
    }, [entries]);

    useEffect(() => {
        const validSummaryIds = new Set(selectableSummaryRowIds);
        setSelectedSummaryRowIds((prev) => prev.filter((id) => validSummaryIds.has(id)));
    }, [selectableSummaryRowIds]);

    const handleToggleDbEntryDetails = useCallback((entryId: string) => {
        setExpandedDbEntryIds((prev) => (
            prev.includes(entryId)
                ? prev.filter((item) => item !== entryId)
                : [...prev, entryId]
        ));
    }, []);

    const handleChangeDbSort = useCallback((field: DbSortField) => {
        setDbSort((prev) => (
            prev.field === field
                ? { field, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
                : { field, direction: 'asc' }
        ));
    }, []);

    const getDbSortLabel = useCallback((field: DbSortField, baseLabel: string) => {
        if (dbSort.field !== field) return baseLabel;
        return `${baseLabel} ${dbSort.direction === 'asc' ? '▲' : '▼'}`;
    }, [dbSort]);

    const handleMoveDbPage = useCallback((direction: 'prev' | 'next') => {
        setDbPage((prev) => {
            if (direction === 'prev') {
                return Math.max(1, prev - 1);
            }
            return Math.min(totalDbPages, prev + 1);
        });
    }, [totalDbPages]);

    const handleChangeDbFilter = useCallback((field: keyof DbFilterState, value: string) => {
        setDbFilter((prev) => ({ ...prev, [field]: value }));
    }, []);

    const handleResetDbFilter = useCallback(() => {
        setDbFilter(emptyDbFilter());
    }, []);

    const handleToggleDbEntrySelection = useCallback((entryId: string) => {
        setSelectedDbEntryIds((prev) => (
            prev.includes(entryId)
                ? prev.filter((id) => id !== entryId)
                : [...prev, entryId]
        ));
    }, []);

    const handleToggleVisibleDbEntrySelection = useCallback(() => {
        if (visibleSelectableDbEntryIds.length === 0) return;

        setSelectedDbEntryIds((prev) => {
            const nextSet = new Set(prev);
            const shouldSelectAll = visibleSelectableDbEntryIds.some((id) => !nextSet.has(id));

            visibleSelectableDbEntryIds.forEach((id) => {
                if (shouldSelectAll) {
                    nextSet.add(id);
                } else {
                    nextSet.delete(id);
                }
            });

            return Array.from(nextSet);
        });
    }, [visibleSelectableDbEntryIds]);

    const handleToggleSummaryRowSelection = useCallback((rowId: string) => {
        setSelectedSummaryRowIds((prev) => (
            prev.includes(rowId)
                ? prev.filter((id) => id !== rowId)
                : [...prev, rowId]
        ));
    }, []);

    const handleToggleAllSummaryRowSelection = useCallback(() => {
        if (selectableSummaryRowIds.length === 0) return;

        setSelectedSummaryRowIds((prev) => {
            const nextSet = new Set(prev);
            const shouldSelectAll = selectableSummaryRowIds.some((id) => !nextSet.has(id));

            selectableSummaryRowIds.forEach((id) => {
                if (shouldSelectAll) {
                    nextSet.add(id);
                } else {
                    nextSet.delete(id);
                }
            });

            return Array.from(nextSet);
        });
    }, [selectableSummaryRowIds]);

    const inputDataSchema = useMemo(() => emptyInputRow(), []);

    const inputColumns = useMemo<any[]>(() => [
        { data: 'transactionType', type: 'dropdown', source: ['매입', '매출'], width: 88 },
        { data: 'date', type: 'date', dateFormat: 'YY-MM-DD', correctFormat: true, width: 98 },
        { data: 'partnerName', type: 'autocomplete', source: partnerNames, strict: false, width: 190 },
        { data: 'siteName', type: 'autocomplete', source: siteNames, strict: false, width: 210 },
        { data: 'description', type: 'text', width: 240 },
        { data: 'manDays', type: 'numeric', numericFormat: { pattern: '0.0' }, width: 84 },
        { data: 'supplyAmount', type: 'numeric', numericFormat: { pattern: '0,0' }, width: 110 },
        { data: 'taxAmount', type: 'numeric', numericFormat: { pattern: '0,0' }, readOnly: true, width: 98 },
        { data: 'totalAmount', type: 'numeric', numericFormat: { pattern: '0,0' }, readOnly: true, width: 104 },
        { data: 'paymentAmount', type: 'numeric', numericFormat: { pattern: '0,0' }, width: 112 },
        { data: 'appliedYear', type: 'numeric', numericFormat: { pattern: '0' }, readOnly: true, width: 88 },
        { data: 'appliedMonth', type: 'numeric', numericFormat: { pattern: '0' }, width: 78 },
        { data: 'note', type: 'text', width: 170 },
        { data: 'teamName', type: 'text', width: 112 }
    ], [partnerNames, siteNames]);

    const inputColHeaders = useMemo(() => ([
        '구분',
        '날짜',
        '거래처명',
        '현장명',
        '내용',
        '공수',
        '공급가액',
        '부가세',
        '합계',
        '입금금액',
        '적용연도',
        '적용월',
        '비고',
        '팀명'
    ]), []);

    const inputCells = useCallback((_row: number, column: number) => {
        const cellProperties: Record<string, unknown> = {};
        if ([5, 6, 7, 8, 9, 10, 11].includes(column)) {
            cellProperties.className = 'htRight';
        }
        if ([7, 8, 10].includes(column)) {
            cellProperties.readOnly = true;
            cellProperties.className = `${cellProperties.className ?? ''} workbook-readonly-cell`.trim();
        }
        return cellProperties;
    }, []);

    const renderInputTab = () => (
        <section className="workbook-sheet">
            <table className="sheet-control-table input-sheet-table">
                <tbody>
                    <tr>
                        <th className="sheet-title-dark" colSpan={14}>데이터 입력 시트</th>
                    </tr>
                    <tr>
                        <th className="sheet-label-yellow">팀 명</th>
                        <td className="sheet-value" colSpan={2}>
                            <input
                                ref={selectedTeamInputRef}
                                defaultValue={selectedTeam}
                                onChange={(event) => handleSelectedTeamChange(event.target.value)}
                                placeholder="팀명 입력 또는 선택"
                                autoComplete="off"
                            />
                        </td>
                        <td className="sheet-spacer" colSpan={6} />
                        <td className="sheet-button-wrap" colSpan={2}>
                            <button
                                type="button"
                                className="excel-button excel-button-green"
                                onClick={handleSaveRows}
                                disabled={saving}
                            >
                                <FontAwesomeIcon icon={saving ? faSpinner : faDatabase} spin={saving} />
                                DB 등록
                            </button>
                        </td>
                        <td className="sheet-button-wrap" colSpan={3}>
                            <button
                                type="button"
                                className="excel-button excel-button-blue"
                                onClick={handleResetInputGrid}
                                disabled={saving}
                            >
                                <FontAwesomeIcon icon={faRotateRight} />
                                리셋(RESET)
                            </button>
                        </td>
                    </tr>
                    <tr>
                        <th className="sheet-label-yellow">기준연도</th>
                        <td className="sheet-value" colSpan={2}>
                            <input
                                ref={baseYearInputRef}
                                type="number"
                                min={2000}
                                max={2100}
                                defaultValue={baseYear}
                                onChange={(event) => handleBaseYearChange(event.target.value)}
                                onBlur={commitBaseYearInput}
                            />
                        </td>
                        <td className="sheet-spacer" colSpan={11} />
                    </tr>
                </tbody>
            </table>

            <div className="input-grid-shell workbook-input-grid">
                <HotTable
                    ref={hotRef}
                    data={inputRowsRef.current}
                    dataSchema={inputDataSchema}
                    columns={inputColumns}
                    colHeaders={inputColHeaders}
                    rowHeaders={true}
                    width="100%"
                    height={640}
                    stretchH="all"
                    manualColumnResize={true}
                    contextMenu={true}
                    minSpareRows={8}
                    licenseKey="non-commercial-and-evaluation"
                    afterInit={handleInputGridAfterInit}
                    afterChange={handleInputGridChange}
                    afterSelectionEnd={handleInputGridSelectionEnd}
                    beforeKeyDown={handleInputGridBeforeKeyDown}
                    beforeOnCellMouseDown={handleInputGridBeforeMouseDown}
                    modifyFocusedElement={handleInputGridModifyFocusedElement}
                    copyPaste={true}
                    imeFastEdit={true}
                    outsideClickDeselects={false}
                    className="excel-handsontable"
                    cells={inputCells}
                />
            </div>

            <p className="workbook-help-text">
                입력폼에서 공급가액을 넣으면 부가세와 합계가 자동 계산됩니다. 행의 팀명이 비어 있으면 저장할 때 상단 팀명을 사용합니다.
            </p>
        </section>
    );

    const renderDatabaseTab = () => (
        <section className="workbook-sheet">
            <input
                ref={dbUploadInputRef}
                type="file"
                accept=".xlsx,.xls,.xlsm,.csv"
                className="workbook-hidden-input"
                onChange={handleDbUploadFile}
            />
            <table className="sheet-control-table query-sheet-table">
                <tbody>
                    <tr>
                        <th className="sheet-title-dark" colSpan={16}>DB</th>
                    </tr>
                    <tr>
                        <th className="sheet-label-green">저장건수</th>
                        <td className="sheet-value-light">{getEntryLoadScopeText(entryLoadScope, entries.length)}</td>
                        <td className="sheet-spacer workbook-db-sort-cell" colSpan={4}>
                            <div className="workbook-db-sort-actions">
                                <button
                                    type="button"
                                    className={[
                                        'workbook-toolbar-button',
                                        'workbook-db-sort-button',
                                        dbSort.field === 'date' ? 'active' : ''
                                    ].filter(Boolean).join(' ')}
                                    onClick={() => handleChangeDbSort('date')}
                                    disabled={entries.length === 0}
                                >
                                    {getDbSortLabel('date', '날짜순')}
                                </button>
                                <button
                                    type="button"
                                    className={[
                                        'workbook-toolbar-button',
                                        'workbook-db-sort-button',
                                        dbSort.field === 'partnerName' ? 'active' : ''
                                    ].filter(Boolean).join(' ')}
                                    onClick={() => handleChangeDbSort('partnerName')}
                                    disabled={entries.length === 0}
                                >
                                    {getDbSortLabel('partnerName', '이름순')}
                                </button>
                                <button
                                    type="button"
                                    className={[
                                        'workbook-toolbar-button',
                                        'workbook-db-sort-button',
                                        dbSort.field === 'amount' ? 'active' : ''
                                    ].filter(Boolean).join(' ')}
                                    onClick={() => handleChangeDbSort('amount')}
                                    disabled={entries.length === 0}
                                >
                                    {getDbSortLabel('amount', '금액순')}
                                </button>
                            </div>
                        </td>
                        <td className="sheet-button-wrap" colSpan={2}>
                            <button
                                type="button"
                                className="excel-button excel-button-gray"
                                onClick={handleResetDbFilter}
                                disabled={!hasDbFilterInput || uploadingDb || downloadingDb || dbActionLoading}
                            >
                                <FontAwesomeIcon icon={faRotateRight} />
                                필터 초기화
                            </button>
                        </td>
                        <td className="sheet-button-wrap" colSpan={2}>
                            <button
                                type="button"
                                className="excel-button excel-button-blue"
                                onClick={handleOpenDbUpload}
                                disabled={uploadingDb || downloadingDb}
                            >
                                <FontAwesomeIcon icon={uploadingDb ? faSpinner : faUpload} spin={uploadingDb} />
                                DB 업로드
                            </button>
                        </td>
                        <td className="sheet-button-wrap" colSpan={2}>
                            <button
                                type="button"
                                className="excel-button excel-button-green"
                                onClick={handleDownloadDb}
                                disabled={uploadingDb || downloadingDb || entries.length === 0}
                            >
                                <FontAwesomeIcon icon={downloadingDb ? faSpinner : faDownload} spin={downloadingDb} />
                                DB 다운로드
                            </button>
                        </td>
                        <td className="sheet-button-wrap" colSpan={2}>
                            <button
                                type="button"
                                className="excel-button excel-button-red"
                                onClick={handleBulkDeleteDbEntries}
                                disabled={uploadingDb || downloadingDb || dbActionLoading || selectedDbEntryIds.length === 0}
                            >
                                <FontAwesomeIcon icon={dbActionLoading ? faSpinner : faTrashCan} spin={dbActionLoading} />
                                {`선택삭제${selectedDbEntryIds.length > 0 ? ` (${selectedDbEntryIds.length})` : ''}`}
                            </button>
                        </td>
                        <td className="sheet-button-wrap" colSpan={2}>
                            <button
                                type="button"
                                className="excel-button excel-button-red"
                                onClick={handleResetDatabase}
                                disabled={uploadingDb || downloadingDb || dbActionLoading || entries.length === 0}
                            >
                                <FontAwesomeIcon icon={dbActionLoading ? faSpinner : faTrashCan} spin={dbActionLoading} />
                                DB 초기화
                            </button>
                        </td>
                    </tr>
                </tbody>
            </table>

            <div className="workbook-help-text">
                잔액은 선택한 종료일 기준으로 계산됩니다. 종료일 이후에 등록된 입금/지급은 해당 조회에 반영되지 않습니다.
            </div>

            <div className="sheet-table-wrapper workbook-frozen-table-wrapper">
                <table className="sheet-table">
                    <thead>
                        <tr className="workbook-filter-row">
                            <th className="workbook-filter-spacer">
                                <input
                                    type="checkbox"
                                    checked={areAllVisibleDbEntriesSelected}
                                    onChange={handleToggleVisibleDbEntrySelection}
                                    disabled={visibleSelectableDbEntryIds.length === 0 || dbActionLoading}
                                />
                            </th>
                            <th className="workbook-filter-spacer" />
                            <th>
                                <select
                                    className="workbook-filter-input"
                                    value={dbFilter.transactionType}
                                    onChange={(event) => handleChangeDbFilter('transactionType', event.target.value)}
                                >
                                    <option value="">전체</option>
                                    <option value="매출">매출</option>
                                    <option value="매입">매입</option>
                                </select>
                            </th>
                            <th>
                                <input
                                    className="workbook-filter-input"
                                    type="text"
                                    value={dbFilter.date}
                                    onChange={(event) => handleChangeDbFilter('date', event.target.value)}
                                    placeholder="날짜"
                                />
                            </th>
                            <th>
                                <input
                                    className="workbook-filter-input"
                                    type="text"
                                    value={dbFilter.partnerName}
                                    onChange={(event) => handleChangeDbFilter('partnerName', event.target.value)}
                                    placeholder="거래처명"
                                />
                            </th>
                            <th>
                                <input
                                    className="workbook-filter-input"
                                    type="text"
                                    value={dbFilter.siteName}
                                    onChange={(event) => handleChangeDbFilter('siteName', event.target.value)}
                                    placeholder="현장명"
                                />
                            </th>
                            <th>
                                <input
                                    className="workbook-filter-input"
                                    type="text"
                                    value={dbFilter.description}
                                    onChange={(event) => handleChangeDbFilter('description', event.target.value)}
                                    placeholder="내용"
                                />
                            </th>
                            <th>
                                <input
                                    className="workbook-filter-input"
                                    type="text"
                                    value={dbFilter.supplyAmount}
                                    onChange={(event) => handleChangeDbFilter('supplyAmount', event.target.value)}
                                    placeholder="공급가액"
                                />
                            </th>
                            <th>
                                <input
                                    className="workbook-filter-input"
                                    type="text"
                                    value={dbFilter.taxAmount}
                                    onChange={(event) => handleChangeDbFilter('taxAmount', event.target.value)}
                                    placeholder="부가세"
                                />
                            </th>
                            <th>
                                <input
                                    className="workbook-filter-input"
                                    type="text"
                                    value={dbFilter.totalAmount}
                                    onChange={(event) => handleChangeDbFilter('totalAmount', event.target.value)}
                                    placeholder="합계"
                                />
                            </th>
                            <th>
                                <input
                                    className="workbook-filter-input"
                                    type="text"
                                    value={dbFilter.paymentAmount}
                                    onChange={(event) => handleChangeDbFilter('paymentAmount', event.target.value)}
                                    placeholder="입금금액"
                                />
                            </th>
                            <th>
                                <input
                                    className="workbook-filter-input"
                                    type="text"
                                    value={dbFilter.appliedYear}
                                    onChange={(event) => handleChangeDbFilter('appliedYear', event.target.value)}
                                    placeholder="연도"
                                />
                            </th>
                            <th>
                                <input
                                    className="workbook-filter-input"
                                    type="text"
                                    value={dbFilter.appliedMonth}
                                    onChange={(event) => handleChangeDbFilter('appliedMonth', event.target.value)}
                                    placeholder="월"
                                />
                            </th>
                            <th>
                                <input
                                    className="workbook-filter-input"
                                    type="text"
                                    value={dbFilter.note}
                                    onChange={(event) => handleChangeDbFilter('note', event.target.value)}
                                    placeholder="비고"
                                />
                            </th>
                            <th>
                                <input
                                    className="workbook-filter-input"
                                    type="text"
                                    value={dbFilter.teamName}
                                    onChange={(event) => handleChangeDbFilter('teamName', event.target.value)}
                                    placeholder="팀명"
                                />
                            </th>
                            <th className="workbook-filter-spacer" />
                            <th className="workbook-filter-spacer" />
                        </tr>
                    </thead>
                    <tbody>
                        {databaseDisplayRows.length === 0 && (
                            <tr>
                                <td colSpan={17} className="sheet-empty-state">저장된 DB 데이터가 없습니다.</td>
                            </tr>
                        )}
                        {pagedDatabaseDisplayRows.map((row) => {
                            const { entry, indexLabel, nested } = row;
                            const entryId = entry.id ?? null;
                            const isEditing = editingDbDraft?.id === entry.id;
                            const dbDraft = isEditing ? editingDbDraft : null;
                            const editSupplyAmount = isEditing ? (toNumberOrNull(editingDbDraft?.supplyAmount) ?? 0) : 0;
                            const editTaxAmount = editSupplyAmount !== 0 ? Math.round(editSupplyAmount * 0.1) : 0;
                            const editTotalAmount = editSupplyAmount !== 0 ? editSupplyAmount + editTaxAmount : 0;
                            const linkedEntries = !nested && entry.id ? (linkedDbEntriesByParentId.get(entry.id) ?? []) : [];
                            const visibleLinkedEntries = !nested && entry.id ? (filteredLinkedDbEntriesByParentId.get(entry.id) ?? []) : [];
                            const canToggleDetails = !nested && isInvoiceEntry(entry) && linkedEntries.length > 0;
                            const isExpanded = hasActiveDbFilter
                                ? visibleLinkedEntries.length > 0
                                : !!entry.id && expandedDbEntryIds.includes(entry.id);

                            return (
                                <tr
                                    key={entryId ?? `${entry.date}-${entry.partnerName}-${indexLabel}`}
                                    className={[
                                        isEditing ? 'workbook-inline-edit-row' : '',
                                        nested ? 'workbook-linked-row' : ''
                                    ].filter(Boolean).join(' ') || undefined}
                                >
                                    <td>
                                        {entryId ? (
                                            <input
                                                type="checkbox"
                                                checked={selectedDbEntryIdSet.has(entryId)}
                                                onChange={() => handleToggleDbEntrySelection(entryId)}
                                                disabled={dbActionLoading}
                                            />
                                        ) : null}
                                    </td>
                                    <td>{indexLabel}</td>
                                    <td>
                                        {isEditing ? (
                                            <select
                                                className="workbook-inline-cell-select"
                                                value={dbDraft?.transactionType ?? '매출'}
                                                onChange={(event) => handleChangeEditingDbDraft('transactionType', event.target.value)}
                                                disabled={dbActionLoading}
                                            >
                                                <option value="매출">매출</option>
                                                <option value="매입">매입</option>
                                            </select>
                                        ) : entry.transactionType}
                                    </td>
                                    <td>
                                        {isEditing ? (
                                            <input
                                                className="workbook-inline-cell-input"
                                                type="date"
                                                value={dbDraft?.date ?? ''}
                                                onChange={(event) => handleChangeEditingDbDraft('date', event.target.value)}
                                                disabled={dbActionLoading}
                                            />
                                        ) : (entry.date || '-')}
                                    </td>
                                    <td>
                                        {isEditing ? (
                                            <input
                                                className="workbook-inline-cell-input"
                                                list="workbook-partner-options"
                                                type="text"
                                                value={dbDraft?.partnerName ?? ''}
                                                onChange={(event) => handleChangeEditingDbDraft('partnerName', event.target.value)}
                                                disabled={dbActionLoading}
                                            />
                                        ) : (entry.partnerName || '-')}
                                    </td>
                                    <td>
                                        {isEditing ? (
                                            <input
                                                className="workbook-inline-cell-input"
                                                list="workbook-site-options"
                                                type="text"
                                                value={dbDraft?.siteName ?? ''}
                                                onChange={(event) => handleChangeEditingDbDraft('siteName', event.target.value)}
                                                disabled={dbActionLoading}
                                            />
                                        ) : (entry.siteName || '-')}
                                    </td>
                                    <td>
                                        {isEditing ? (
                                            <input
                                                className="workbook-inline-cell-input"
                                                type="text"
                                                value={dbDraft?.description ?? ''}
                                                onChange={(event) => handleChangeEditingDbDraft('description', event.target.value)}
                                                disabled={dbActionLoading}
                                            />
                                        ) : (entry.description || '-')}
                                    </td>
                                    <td className="align-right">
                                        {isEditing ? (
                                            <input
                                                className="workbook-inline-cell-input workbook-inline-cell-number"
                                                type="number"
                                                value={dbDraft?.supplyAmount ?? ''}
                                                onChange={(event) => handleChangeEditingDbDraft('supplyAmount', event.target.value)}
                                                disabled={dbActionLoading}
                                            />
                                        ) : (entry.supplyAmount !== 0 ? formatNumber(entry.supplyAmount) : '-')}
                                    </td>
                                    <td className="align-right">
                                        {isEditing ? (
                                            <span className="workbook-inline-cell-value">{formatNumber(editTaxAmount)}</span>
                                        ) : (entry.taxAmount !== 0 ? formatNumber(entry.taxAmount) : '-')}
                                    </td>
                                    <td className="align-right">
                                        {isEditing ? (
                                            <span className="workbook-inline-cell-value">{formatNumber(editTotalAmount)}</span>
                                        ) : (entry.totalAmount !== 0 ? formatNumber(entry.totalAmount) : '-')}
                                    </td>
                                    <td className="align-right">
                                        {isEditing ? (
                                            <input
                                                className="workbook-inline-cell-input workbook-inline-cell-number"
                                                type="number"
                                                min={0}
                                                value={dbDraft?.paymentAmount ?? ''}
                                                onChange={(event) => handleChangeEditingDbDraft('paymentAmount', event.target.value)}
                                                disabled={dbActionLoading}
                                            />
                                        ) : (entry.paymentAmount !== 0 ? formatNumber(entry.paymentAmount) : '-')}
                                    </td>
                                    <td className="align-right">
                                        {isEditing ? (
                                            <input
                                                className="workbook-inline-cell-input workbook-inline-cell-number"
                                                type="number"
                                                min={2000}
                                                max={2100}
                                                value={dbDraft?.appliedYear ?? ''}
                                                onChange={(event) => handleChangeEditingDbDraft('appliedYear', event.target.value)}
                                                disabled={dbActionLoading}
                                            />
                                        ) : (entry.appliedYear ?? '-')}
                                    </td>
                                    <td className="align-right">
                                        {isEditing ? (
                                            <input
                                                className="workbook-inline-cell-input workbook-inline-cell-number"
                                                type="number"
                                                min={1}
                                                max={12}
                                                value={dbDraft?.appliedMonth ?? ''}
                                                onChange={(event) => handleChangeEditingDbDraft('appliedMonth', event.target.value)}
                                                disabled={dbActionLoading}
                                            />
                                        ) : (entry.appliedMonth ?? '-')}
                                    </td>
                                    <td>
                                        {isEditing ? (
                                            <input
                                                className="workbook-inline-cell-input"
                                                type="text"
                                                value={dbDraft?.note ?? ''}
                                                onChange={(event) => handleChangeEditingDbDraft('note', event.target.value)}
                                                disabled={dbActionLoading}
                                            />
                                        ) : (entry.note || '-')}
                                    </td>
                                    <td>
                                        {isEditing ? (
                                            <input
                                                className="workbook-inline-cell-input"
                                                list="workbook-team-options"
                                                type="text"
                                                value={dbDraft?.teamName ?? ''}
                                                onChange={(event) => handleChangeEditingDbDraft('teamName', event.target.value)}
                                                disabled={dbActionLoading}
                                            />
                                        ) : (
                                            nested
                                                ? <span className="workbook-linked-cell">{entry.teamName || '-'}</span>
                                                : (entry.teamName || '-')
                                        )}
                                    </td>
                                    <td>
                                        {canToggleDetails && hasActiveDbFilter ? (
                                            visibleLinkedEntries.length > 0
                                                ? <span className="workbook-linked-badge">필터 {visibleLinkedEntries.length}건</span>
                                                : '-'
                                        ) : canToggleDetails ? (
                                            <button
                                                type="button"
                                                className="workbook-toolbar-button workbook-inline-button"
                                                onClick={() => handleToggleDbEntryDetails(entry.id!)}
                                                disabled={dbActionLoading}
                                            >
                                                {isExpanded ? '닫기' : `내역 ${linkedEntries.length}건`}
                                            </button>
                                        ) : (
                                            nested
                                                ? <span className="workbook-linked-badge">연결내역</span>
                                                : '-'
                                        )}
                                    </td>
                                    <td>
                                        <div className="workbook-inline-actions">
                                            {isEditing ? (
                                                <>
                                                    <button
                                                        type="button"
                                                        className="workbook-toolbar-button workbook-inline-button"
                                                        onClick={handleSaveDbEntry}
                                                        disabled={dbActionLoading}
                                                    >
                                                        <FontAwesomeIcon icon={dbActionLoading ? faSpinner : faPenToSquare} spin={dbActionLoading} />
                                                        저장
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="workbook-toolbar-button workbook-inline-button"
                                                        onClick={handleCancelEditDbEntry}
                                                        disabled={dbActionLoading}
                                                    >
                                                        취소
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <button
                                                        type="button"
                                                        className="workbook-toolbar-button workbook-inline-button"
                                                        onClick={() => handleStartEditDbEntry(entry)}
                                                        disabled={dbActionLoading}
                                                    >
                                                        <FontAwesomeIcon icon={faPenToSquare} />
                                                        수정
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="workbook-toolbar-button workbook-inline-button workbook-danger-button"
                                                        onClick={() => handleDeleteDbEntry(entry)}
                                                        disabled={dbActionLoading}
                                                    >
                                                        <FontAwesomeIcon icon={faTrashCan} />
                                                        삭제
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {databaseDisplayRows.length > 0 && (
                <div className="workbook-pagination" data-html2canvas-ignore="true">
                    <span className="workbook-pagination-status">
                        {`${(dbPage - 1) * DB_PAGE_SIZE + 1}-${Math.min(dbPage * DB_PAGE_SIZE, databaseDisplayRows.length)} / ${databaseDisplayRows.length}`}
                    </span>
                    <button
                        type="button"
                        className="workbook-toolbar-button workbook-pagination-button"
                        onClick={() => handleMoveDbPage('prev')}
                        disabled={dbPage <= 1}
                    >
                        이전 100개
                    </button>
                    <span className="workbook-pagination-status">
                        {`${dbPage} / ${totalDbPages} 페이지`}
                    </span>
                    <button
                        type="button"
                        className="workbook-toolbar-button workbook-pagination-button"
                        onClick={() => handleMoveDbPage('next')}
                        disabled={dbPage >= totalDbPages}
                    >
                        다음 100개
                    </button>
                </div>
            )}

            <p className="workbook-help-text">
                입력폼에서 저장한 원본 행과 조회에서 등록한 입금/지급 행은 DB에 함께 저장됩니다. 연결된 정산 행은 내역 버튼으로 같이 펼쳐 보고, 같은 화면에서 수정/삭제할 수 있습니다.
            </p>
        </section>
    );

    const renderLedgerTab = () => (
        <section className="workbook-sheet">
            <div ref={ledgerCaptureRef}>
                <table className="sheet-control-table query-sheet-table workbook-summary-filter-table">
                    <tbody>
                        <tr>
                            <th className="sheet-title-dark" colSpan={16}>매출/매입 거래장</th>
                        </tr>
                        <tr>
                            <th className="sheet-label-blue">검색시작일</th>
                            <td className="sheet-value sheet-filter-date-cell" colSpan={2}>
                                <input
                                    type="date"
                                    className="sheet-filter-input"
                                    value={ledgerDraft.startDate}
                                    onChange={(event) => setLedgerDraft((prev) => ({ ...prev, startDate: event.target.value }))}
                                />
                            </td>
                            <th className="sheet-label-blue">검색종료일</th>
                            <td className="sheet-value sheet-filter-date-cell" colSpan={2}>
                                <input
                                    type="date"
                                    className="sheet-filter-input"
                                    value={ledgerDraft.endDate}
                                    onChange={(event) => setLedgerDraft((prev) => ({ ...prev, endDate: event.target.value }))}
                                />
                            </td>
                            <td className="sheet-spacer" colSpan={4} />
                            <td className="sheet-button-wrap" colSpan={2}>
                                <button
                                    type="button"
                                    className="excel-button excel-button-blue"
                                    onClick={() => handleCopyCapture('ledger', ledgerCaptureRef.current, '거래장')}
                                    disabled={capturingView === 'ledger'}
                                >
                                    <FontAwesomeIcon icon={capturingView === 'ledger' ? faSpinner : faCopy} spin={capturingView === 'ledger'} />
                                    화면 복사
                                </button>
                            </td>
                            <td className="sheet-button-wrap" colSpan={2}>
                                <button
                                    type="button"
                                    className="excel-button excel-button-gray"
                                    onClick={handlePrintLedger}
                                    disabled={printingLedger}
                                >
                                    <FontAwesomeIcon icon={printingLedger ? faSpinner : faPrint} spin={printingLedger} />
                                    인쇄
                                </button>
                            </td>
                            <td className="sheet-button-wrap sheet-button-stack" colSpan={2}>
                                <button type="button" className="excel-button excel-button-green" onClick={applyLedgerFilter}>
                                    <FontAwesomeIcon icon={faMagnifyingGlass} />
                                    조회
                                </button>
                            </td>
                        </tr>
                        <tr>
                            <th className="sheet-label-green">팀 명</th>
                            <td className="sheet-value-light">
                                <input
                                    className="sheet-filter-input"
                                    list="workbook-team-options"
                                    value={ledgerDraft.teamName}
                                    onChange={(event) => setLedgerDraft((prev) => ({ ...prev, teamName: event.target.value }))}
                                    placeholder="전체"
                                />
                            </td>
                            <th className="sheet-label-green">구 분</th>
                            <td className="sheet-value-light">
                                <select
                                    className="sheet-filter-input"
                                    value={ledgerDraft.transactionType}
                                    onChange={(event) => setLedgerDraft((prev) => ({
                                        ...prev,
                                        transactionType: event.target.value as WorkbookTransactionType
                                    }))}
                                >
                                    <option value="매출">매출</option>
                                    <option value="매입">매입</option>
                                </select>
                            </td>
                            <th className="sheet-label-green">거래처</th>
                            <td className="sheet-value-light sheet-filter-wide-cell" colSpan={2}>
                                <input
                                    className="sheet-filter-input"
                                    list="workbook-partner-options"
                                    value={ledgerDraft.partnerName}
                                    onChange={(event) => setLedgerDraft((prev) => ({ ...prev, partnerName: event.target.value }))}
                                    placeholder="거래처 전체"
                                />
                            </td>
                            <th className="sheet-label-green">현장명</th>
                            <td className="sheet-value-light sheet-filter-wide-cell" colSpan={2}>
                                <input
                                    className="sheet-filter-input"
                                    list="workbook-site-options"
                                    value={ledgerDraft.siteName}
                                    onChange={(event) => setLedgerDraft((prev) => ({ ...prev, siteName: event.target.value }))}
                                    placeholder="현장 전체"
                                />
                            </td>
                            <td className="sheet-spacer sheet-filter-count-cell" colSpan={6}>
                                <div className="sheet-button-count">{getEntryLoadScopeText(entryLoadScope, entries.length)}</div>
                            </td>
                        </tr>
                    </tbody>
                </table>

                <div className="sheet-merged-heading">
                    {ledgerFilter.partnerName || `${ledgerFilter.transactionType} 거래장`}
                </div>

                <div className="sheet-table-wrapper workbook-frozen-table-wrapper">
                    <table className="sheet-table workbook-ledger-table">
                        <colgroup>
                            <col className="workbook-ledger-col-date" />
                            <col className="workbook-ledger-col-partner" />
                            <col className="workbook-ledger-col-description" />
                            <col className="workbook-ledger-col-transaction" />
                            <col className="workbook-ledger-col-payment" />
                            <col className="workbook-ledger-col-balance" />
                            <col className="workbook-ledger-col-site" />
                            <col className="workbook-ledger-col-note" />
                            <col className="workbook-ledger-col-team" />
                        </colgroup>
                        <thead>
                            <tr>
                                <th>날짜</th>
                                <th>거래처명</th>
                                <th>내용</th>
                                <th>{ledgerFilter.transactionType === '매출' ? '매출금액' : '매입금액'}</th>
                                <th>{ledgerFilter.transactionType === '매출' ? '입금금액' : '지급금액'}</th>
                                <th>잔액</th>
                                <th>현장명</th>
                                <th>비고</th>
                                <th>팀명</th>
                            </tr>
                        </thead>
                        <tbody>
                            {ledgerRows.length === 0 && (
                                <tr>
                                    <td colSpan={9} className="sheet-empty-state">조회 결과가 없습니다.</td>
                                </tr>
                            )}
                            {ledgerRows.map((row) => (
                                <tr key={row.id}>
                                    <td>{row.date}</td>
                                    <td>{row.partnerName || '-'}</td>
                                    <td>{row.description}</td>
                                    <td className="align-right">{row.transactionAmount !== 0 ? formatNumber(row.transactionAmount) : '-'}</td>
                                    <td className="align-right">{row.paymentAmount !== 0 ? formatNumber(row.paymentAmount) : '-'}</td>
                                    <td className="align-right">{formatNumber(row.balance)}</td>
                                    <td>{row.siteName || '-'}</td>
                                    <td>{row.note || '-'}</td>
                                    <td>{row.teamName || '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td />
                                <td />
                                <td>합계</td>
                                <td className="align-right">{formatNumber(ledgerTotals.transactionAmount)}</td>
                                <td className="align-right">{formatNumber(ledgerTotals.paymentAmount)}</td>
                                <td className="align-right">{formatNumber(ledgerTotals.balance)}</td>
                                <td colSpan={3} />
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </section>
    );
    const renderSummaryTab = () => (
        <section className="workbook-sheet">
            <div ref={summaryCaptureRef}>
                <table className="sheet-control-table query-sheet-table">
                    <tbody>
                        <tr>
                            <th className="sheet-title-dark" colSpan={16}>전체 조회</th>
                        </tr>
                        <tr>
                            <th className="sheet-label-blue">검색시작일</th>
                            <td className="sheet-value sheet-filter-date-cell" colSpan={2}>
                                <input
                                    type="date"
                                    className="sheet-filter-input"
                                    value={summaryDraft.startDate}
                                    onChange={(event) => setSummaryDraft((prev) => ({ ...prev, startDate: event.target.value }))}
                                />
                            </td>
                            <th className="sheet-label-blue">검색종료일</th>
                            <td className="sheet-value sheet-filter-date-cell" colSpan={2}>
                                <input
                                    type="date"
                                    className="sheet-filter-input"
                                    value={summaryDraft.endDate}
                                    onChange={(event) => setSummaryDraft((prev) => ({ ...prev, endDate: event.target.value }))}
                                />
                            </td>
                            <td className="sheet-spacer" colSpan={4} />
                            <td className="sheet-button-wrap" colSpan={2}>
                                <button
                                    type="button"
                                    className="excel-button excel-button-blue"
                                    onClick={() => handleCopyCapture('summary', summaryCaptureRef.current, '전체 조회')}
                                    disabled={capturingView === 'summary'}
                                >
                                    <FontAwesomeIcon icon={capturingView === 'summary' ? faSpinner : faCopy} spin={capturingView === 'summary'} />
                                    화면 복사
                                </button>
                            </td>
                            <td className="sheet-button-wrap" colSpan={2}>
                                <button
                                    type="button"
                                    className="excel-button excel-button-gray"
                                    onClick={handlePrintSummary}
                                    disabled={printingSummary}
                                >
                                    <FontAwesomeIcon icon={printingSummary ? faSpinner : faPrint} spin={printingSummary} />
                                    인쇄
                                </button>
                            </td>
                            <td className="sheet-button-wrap" colSpan={2}>
                                <button
                                    type="button"
                                    className="excel-button excel-button-green"
                                    onClick={handleOpenKbPreview}
                                    disabled={
                                        downloadingKb ||
                                        summaryFilter.mode !== '미지급금' ||
                                        selectedSummaryRowIds.length === 0
                                    }
                                >
                                    <FontAwesomeIcon icon={downloadingKb ? faSpinner : faDownload} spin={downloadingKb} />
                                    {`국민은행용 다운로드${selectedSummaryRowIds.length > 0 ? ` (${selectedSummaryRowIds.length})` : ''}`}
                                </button>
                            </td>
                            <td className="sheet-button-wrap sheet-button-stack" colSpan={2}>
                                <button type="button" className="excel-button excel-button-green" onClick={applySummaryFilter}>
                                    <FontAwesomeIcon icon={faMagnifyingGlass} />
                                    조회
                                </button>
                            </td>
                        </tr>
                        <tr>
                            <th className="sheet-label-green">팀 명</th>
                            <td className="sheet-value-light">
                                <input
                                    className="sheet-filter-input"
                                    list="workbook-team-options"
                                    value={summaryDraft.teamName}
                                    onChange={(event) => setSummaryDraft((prev) => ({ ...prev, teamName: event.target.value }))}
                                    placeholder="전체"
                                />
                            </td>
                            <th className="sheet-label-green">구 분</th>
                            <td className="sheet-value-light">
                                <select
                                    className="sheet-filter-input"
                                    value={summaryDraft.mode}
                                    onChange={(event) => {
                                        const nextMode = event.target.value as SummaryMode;
                                        setSummaryDraft((prev) => ({ ...prev, mode: nextMode }));
                                        setSummaryFilter((prev) => ({ ...prev, mode: nextMode }));
                                    }}
                                >
                                    <option value="매출">매출</option>
                                    <option value="매입">매입</option>
                                    <option value="미수금">미수금</option>
                                    <option value="미지급금">미지급금</option>
                                </select>
                            </td>
                            <th className="sheet-label-green">거래처</th>
                            <td className="sheet-value-light sheet-filter-wide-cell" colSpan={2}>
                                <input
                                    className="sheet-filter-input"
                                    list="workbook-partner-options"
                                    value={summaryDraft.partnerName}
                                    onChange={(event) => setSummaryDraft((prev) => ({ ...prev, partnerName: event.target.value }))}
                                    placeholder="거래처 전체"
                                />
                            </td>
                            <th className="sheet-label-green">현장명</th>
                            <td className="sheet-value-light sheet-filter-wide-cell" colSpan={2}>
                                <input
                                    className="sheet-filter-input"
                                    list="workbook-site-options"
                                    value={summaryDraft.siteName}
                                    onChange={(event) => setSummaryDraft((prev) => ({ ...prev, siteName: event.target.value }))}
                                    placeholder="현장 전체"
                                />
                            </td>
                            <td className="sheet-spacer sheet-filter-count-cell" colSpan={6}>
                                <div className="sheet-button-count">{getEntryLoadScopeText(entryLoadScope, entries.length)}</div>
                            </td>
                        </tr>
                    </tbody>
                </table>

                {summaryFilter.mode === '미지급금' && (
                    <div className="mb-2 flex flex-col gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="text-sm text-emerald-900">
                            미지급금 선택 {selectedSummaryRowIds.length.toLocaleString()}건
                        </div>
                    </div>
                )}

                <div className="sheet-table-wrapper workbook-frozen-table-wrapper">
                    <table className="sheet-table workbook-summary-table">
                        <colgroup>
                            <col style={{ width: '80px' }} />
                            <col className="workbook-summary-col-no" />
                            <col className="workbook-summary-col-partner" />
                            <col className="workbook-summary-col-site" />
                            <col className="workbook-summary-col-issue-date" />
                            <col className="workbook-summary-col-amount" />
                            <col className="workbook-summary-col-tax" />
                            <col className="workbook-summary-col-total" />
                            <col className="workbook-summary-col-payment-date" />
                            <col className="workbook-summary-col-settled" />
                            <col className="workbook-summary-col-outstanding" />
                            <col className="workbook-summary-col-note" />
                            <col className="workbook-summary-col-team" />
                            {canRegisterReceipt && <col className="workbook-summary-col-action" />}
                        </colgroup>
                        <thead className="summary-header">
                            <tr>
                                <th>
                                    <label className="workbook-summary-select-inline" htmlFor="summary-select-all">
                                        <input
                                            id="summary-select-all"
                                            type="checkbox"
                                            className="workbook-summary-select-checkbox"
                                            checked={areAllSelectableSummaryRowsSelected}
                                            onChange={handleToggleAllSummaryRowSelection}
                                            disabled={summaryFilter.mode !== '미지급금' || selectableSummaryRowIds.length === 0}
                                        />
                                        <span>{areAllSelectableSummaryRowsSelected ? '전체해제' : '전체선택'}</span>
                                    </label>
                                </th>
                                <th>No</th>
                                <th>거래처명</th>
                                <th>현장명</th>
                                <th>발행일</th>
                                <th>공급가액</th>
                                <th>세액</th>
                                <th>합계</th>
                                <th>{summaryFilter.mode === '매입' || summaryFilter.mode === '미지급금' ? '지급일' : '입금일'}</th>
                                <th>{summaryFilter.mode === '매입' || summaryFilter.mode === '미지급금' ? '지급금액' : '수금금액'}</th>
                                <th>{summaryFilter.mode === '매입' || summaryFilter.mode === '미지급금' ? '미지급금' : '미수금'}</th>
                                <th>비고</th>
                                <th>팀명</th>
                                {canRegisterReceipt && <th>처리</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {summaryRows.length === 0 && (
                                <tr>
                                    <td colSpan={canRegisterReceipt ? 14 : 13} className="sheet-empty-state">조회 결과가 없습니다.</td>
                                </tr>
                            )}
                            {summaryRows.map((row, index) => (
                                <tr key={row.id}>
                                    <td>
                                        <label className="workbook-summary-select-inline">
                                            <input
                                                type="checkbox"
                                                className="workbook-summary-select-checkbox"
                                                checked={selectedSummaryRowIdSet.has(row.id)}
                                                onChange={() => handleToggleSummaryRowSelection(row.id)}
                                                disabled={summaryFilter.mode !== '미지급금' || row.outstandingAmount <= 0}
                                            />
                                            <span>{selectedSummaryRowIdSet.has(row.id) ? '해제' : '선택'}</span>
                                        </label>
                                    </td>
                                    <td className="align-right">{index + 1}</td>
                                    <td>{row.partnerName}</td>
                                    <td>{row.siteName || '-'}</td>
                                    <td>{row.issueDate}</td>
                                    <td className="align-right">{formatNumber(row.supplyAmount)}</td>
                                    <td className="align-right">{formatNumber(row.taxAmount)}</td>
                                    <td className="align-right">{formatNumber(row.totalAmount)}</td>
                                    <td>
                                        {row.paymentDates.length > 0 ? (
                                            <div className="cell-date-list">
                                                {row.paymentDates.map((paymentDate) => (
                                                    <div key={`${row.id}-${paymentDate}`}>{paymentDate}</div>
                                                ))}
                                            </div>
                                        ) : '-'}
                                    </td>
                                    <td className="align-right">{formatNumber(getSummaryDisplayedSettledAmount(row))}</td>
                                    <td className="align-right">{formatNumber(row.outstandingAmount)}</td>
                                    <td>{row.note || '-'}</td>
                                    <td>{row.teamName || '-'}</td>
                                    {canRegisterReceipt && (
                                        <td>
                                            <div className="workbook-inline-actions workbook-inline-actions-horizontal">
                                                <button
                                                    type="button"
                                                    className="workbook-toolbar-button workbook-inline-button"
                                                    onClick={() => handleRegisterReceipt(row)}
                                                    disabled={saving || row.outstandingAmount <= 0}
                                                >
                                                    {summarySettlementLabels.action}
                                                </button>
                                                {canOpenReceiptHistory && (
                                                    <button
                                                        type="button"
                                                        className="workbook-toolbar-button workbook-inline-button"
                                                        onClick={() => handleOpenReceiptHistory(row)}
                                                        disabled={saving}
                                                    >
                                                        내역
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td />
                                <td />
                                <td>합계</td>
                                <td />
                                <td />
                                <td className="align-right">{formatNumber(summaryTotals.supplyAmount)}</td>
                                <td className="align-right">{formatNumber(summaryTotals.taxAmount)}</td>
                                <td className="align-right">{formatNumber(summaryTotals.totalAmount)}</td>
                                <td />
                                <td className="align-right">{formatNumber(summaryTotals.settledAmount)}</td>
                                <td className="align-right">{formatNumber(summaryTotals.outstandingAmount)}</td>
                                <td colSpan={canRegisterReceipt ? 3 : 2} />
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </section>
    );
    return (
        <div className={`workbook-ledger-page ${tenantKey === 'cheongyeon' ? 'tenant-cheongyeon' : 'tenant-dawon'}`}>
            <div className="workbook-shell">
                <div className="workbook-titlebar">
                    <div>
                        <h1>{`${companyLabel} 매입매출`}</h1>
                        <p>{`${companyLabel} 매입매출 전용 장부 페이지입니다.`}</p>
                    </div>
                    <div className="workbook-title-actions">
                        <button
                            type="button"
                            className="workbook-toolbar-button"
                            onClick={handleLoadAllEntries}
                            disabled={loading || entryLoadScope === 'all'}
                        >
                            <FontAwesomeIcon icon={faDatabase} />
                            전체 DB 불러오기
                        </button>
                        <button
                            type="button"
                            className="workbook-toolbar-button"
                            onClick={() => refreshPageData({ forceEntries: true, forceCatalogs: true })}
                            disabled={loading}
                        >
                            <FontAwesomeIcon icon={loading ? faSpinner : faRotateRight} spin={loading} />
                            새로고침
                        </button>
                    </div>
                </div>

                <div className="workbook-tenant-tabs" role="tablist" aria-label="Tenant tabs">
                    {TENANT_TABS.map((tab) => (
                        <button
                            key={tab.key}
                            type="button"
                            className={`workbook-tenant-tab ${tab.colorClass} ${tenantKey === tab.key ? 'active' : ''}`}
                            onClick={() => navigate(tab.path)}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className={`workbook-tabs ${tenantKey === 'cheongyeon' ? 'tenant-cheongyeon' : 'tenant-dawon'}`} role="tablist" aria-label="Workbook tabs">
                    {WORKBOOK_TABS.map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            className={`workbook-tab ${activeTab === tab.id ? 'active' : ''}`}
                            onClick={() => setActiveTab(tab.id)}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {activeTab === 'input' && renderInputTab()}
                {activeTab === 'database' && renderDatabaseTab()}
                {activeTab === 'ledger' && renderLedgerTab()}
                {activeTab === 'summary' && renderSummaryTab()}

                {showKbPreview && (
                    <div
                        style={{
                            position: 'fixed',
                            inset: 0,
                            zIndex: 9999,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: 16,
                            background: 'rgba(2, 6, 23, 0.68)',
                            backdropFilter: 'blur(8px)'
                        }}
                        onClick={() => setShowKbPreview(false)}
                    >
                        <div
                            style={{
                                width: '100%',
                                maxWidth: 1180,
                                maxHeight: '88vh',
                                display: 'flex',
                                flexDirection: 'column',
                                overflow: 'hidden',
                                borderRadius: 28,
                                border: '1px solid rgba(71, 85, 105, 0.68)',
                                background: 'linear-gradient(180deg, #020617 0%, #111827 100%)',
                                boxShadow: '0 36px 80px -34px rgba(2, 6, 23, 0.92)'
                            }}
                            onClick={(event) => event.stopPropagation()}
                        >
                            <div
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 18,
                                    padding: 22,
                                    borderBottom: '1px solid rgba(71, 85, 105, 0.42)',
                                    background: 'radial-gradient(circle at top right, rgba(245, 158, 11, 0.16), transparent 24%), linear-gradient(135deg, rgba(15, 23, 42, 0.98) 0%, rgba(17, 24, 39, 0.94) 100%)'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#f59e0b' }}>KB Transfer Preview</span>
                                        <h3 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#f8fafc' }}>국민은행용 엑셀 미리보기</h3>
                                        <p style={{ margin: 0, fontSize: 13, color: '#94a3b8' }}>monthly-wage와 동일한 팔레트/구성으로 송금표시와 메모 규칙을 미리 확인합니다.</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setShowKbPreview(false)}
                                        style={{
                                            width: 42,
                                            height: 42,
                                            border: '1px solid rgba(71, 85, 105, 0.82)',
                                            borderRadius: 14,
                                            background: 'rgba(15, 23, 42, 0.92)',
                                            color: '#cbd5e1',
                                            fontSize: 24,
                                            cursor: 'pointer'
                                        }}
                                    >
                                    <FontAwesomeIcon icon={faXmark} />
                                    </button>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 16, borderRadius: 20, border: '1px solid rgba(51, 65, 85, 0.86)', background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.96) 0%, rgba(30, 41, 59, 0.92) 100%)' }}>
                                        <label style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#64748b' }}>받는분통장표시</label>
                                        <input
                                            type="text"
                                            value={kbReceiverDisplay}
                                            maxLength={10}
                                            onChange={(event) => setKbReceiverDisplay(event.target.value)}
                                            style={{
                                                width: '100%',
                                                minHeight: 46,
                                                padding: '0 14px',
                                                borderRadius: 14,
                                                border: '1px solid rgba(71, 85, 105, 0.88)',
                                                background: 'rgba(2, 6, 23, 0.72)',
                                                color: '#f8fafc',
                                                fontSize: 14,
                                                fontWeight: 700,
                                                outline: 'none'
                                            }}
                                            placeholder="㈜다원"
                                        />
                                        <span style={{ fontSize: 12, lineHeight: 1.45, color: '#94a3b8' }}>D열에 동일하게 적용됩니다.</span>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 16, borderRadius: 20, border: '1px solid rgba(51, 65, 85, 0.86)', background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.96) 0%, rgba(30, 41, 59, 0.92) 100%)' }}>
                                        <label style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#64748b' }}>내통장메모 규칙</label>
                                        <input
                                            type="text"
                                            value={kbMemoSuffix}
                                            onChange={(event) => setKbMemoSuffix(event.target.value)}
                                            style={{
                                                width: '100%',
                                                minHeight: 46,
                                                padding: '0 14px',
                                                borderRadius: 14,
                                                border: '1px solid rgba(71, 85, 105, 0.88)',
                                                background: 'rgba(2, 6, 23, 0.72)',
                                                color: '#f8fafc',
                                                fontSize: 14,
                                                fontWeight: 700,
                                                outline: 'none'
                                            }}
                                            placeholder="{이름} 미지급금"
                                        />
                                        <span style={{ fontSize: 12, lineHeight: 1.45, color: '#94a3b8' }}>E열은 거래처명+접미어로 최대 14자까지 반영됩니다.</span>
                                    </div>
                                </div>
                            </div>
                            <div style={{ flex: 1, overflow: 'auto', padding: '20px 22px', background: 'rgba(15, 23, 42, 0.78)' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, color: '#e2e8f0' }}>
                                    <thead style={{ position: 'sticky', top: 0, background: 'rgba(30, 41, 59, 0.95)' }}>
                                        <tr>
                                            <th style={{ border: '1px solid #334155', padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#f1f5f9' }}>A. 은행코드</th>
                                            <th style={{ border: '1px solid #334155', padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#f1f5f9' }}>B. 계좌번호</th>
                                            <th style={{ border: '1px solid #334155', padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#f1f5f9' }}>C. 이체금액</th>
                                            <th style={{ border: '1px solid #334155', padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#f1f5f9' }}>D. 받는분통장표시</th>
                                            <th style={{ border: '1px solid #334155', padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#f1f5f9' }}>E. 내통장메모</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {kbPreviewRows.map((row, index) => (
                                            <tr key={`${row.accountNumber}-${index}`} style={{ background: index % 2 === 0 ? 'rgba(15, 23, 42, 0.45)' : 'rgba(30, 41, 59, 0.45)' }}>
                                                <td style={{ border: '1px solid #334155', padding: '8px 12px', color: row.bankCode ? '#e2e8f0' : '#f87171' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                                        <span>{row.bankCodeDisplay}</span>
                                                        {row.bankCodeNeedsFix && (
                                                            <span style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 9999, padding: '2px 7px', fontSize: 10, fontWeight: 800, background: 'rgba(239, 68, 68, 0.24)', color: '#fecaca' }}>
                                                                수정요망
                                                            </span>
                                                        )}
                                                    </div>
                                                    {row.bankCodeNeedsFix && row.bankCodeReason && (
                                                        <div style={{ marginTop: 4, fontSize: 11, lineHeight: 1.35, color: '#fca5a5' }}>
                                                            {row.bankCodeReason}
                                                        </div>
                                                    )}
                                                </td>
                                                <td style={{ border: '1px solid #334155', padding: '8px 12px', fontFamily: 'monospace', color: row.accountNumber ? '#e2e8f0' : '#f87171' }}>{row.accountNumber || '계좌 없음'}</td>
                                                <td style={{ border: '1px solid #334155', padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: '#fbbf24' }}>{row.amount.toLocaleString()}</td>
                                                <td style={{ border: '1px solid #334155', padding: '8px 12px' }}>{row.receiverDisplay}</td>
                                                <td style={{ border: '1px solid #334155', padding: '8px 12px' }}>{row.memoDisplay}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', padding: '18px 22px 22px', borderTop: '1px solid rgba(71, 85, 105, 0.42)', background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.96) 0%, rgba(2, 6, 23, 0.96) 100%)' }}>
                                <span style={{ fontSize: 14, color: '#cbd5e1' }}>
                                    총 {kbPreviewRows.length.toLocaleString()}건 · 총 이체금액 {kbPreviewRows.reduce((sum, row) => sum + row.amount, 0).toLocaleString()}원
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setShowKbPreview(false)}
                                    style={{
                                        minHeight: 42,
                                        padding: '0 16px',
                                        borderRadius: 14,
                                        border: '1px solid #64748b',
                                        background: 'transparent',
                                        color: '#e2e8f0',
                                        cursor: 'pointer',
                                        fontSize: 13,
                                        fontWeight: 700
                                    }}
                                >
                                    닫기
                                </button>
                                <button
                                    type="button"
                                    className="excel-button excel-button-green"
                                    onClick={handleDownloadSummaryKb}
                                    disabled={downloadingKb}
                                    style={{ minHeight: 42, padding: '0 16px', borderRadius: 14, border: '1px solid rgba(202, 138, 4, 0.7)', background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#111827', fontWeight: 800 }}
                                >
                                    <FontAwesomeIcon icon={downloadingKb ? faSpinner : faDownload} spin={downloadingKb} />
                                    국민은행용 다운로드 ({kbPreviewRows.length})
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {receiptHistoryTargetId && (
                    <div className="workbook-modal-overlay" onClick={handleCloseReceiptHistory}>
                        <div className="workbook-modal" onClick={(event) => event.stopPropagation()}>
                            <div className="workbook-modal-header">
                                <div>
                                    <h2>{receiptHistoryLabels.history}</h2>
                                    <p>선택한 {receiptHistoryLabels.outstanding} 행에 연결된 {receiptHistoryLabels.history}을 수정하거나 삭제합니다.</p>
                                </div>
                                <button
                                    type="button"
                                    className="workbook-modal-close"
                                    onClick={handleCloseReceiptHistory}
                                >
                                    <FontAwesomeIcon icon={faXmark} />
                                </button>
                            </div>

                            {receiptHistoryInvoice ? (
                                <>
                                    <div className="workbook-modal-summary">
                                        <div><strong>거래처</strong><span>{receiptHistoryInvoice.partnerName}</span></div>
                                        <div><strong>현장명</strong><span>{receiptHistoryInvoice.siteName || '-'}</span></div>
                                        <div><strong>발행일</strong><span>{receiptHistoryInvoice.date}</span></div>
                                        <div><strong>합계</strong><span>{formatNumber(receiptHistoryInvoice.totalAmount)}원</span></div>
                                        <div><strong>{receiptHistoryLabels.cumulative}</strong><span>{formatNumber(receiptHistoryTotal)}원</span></div>
                                        <div><strong>{receiptHistoryLabels.outstanding}</strong><span>{formatNumber(receiptHistoryOutstanding)}원</span></div>
                                    </div>

                                    <div className="workbook-editor-card">
                                        <div className="workbook-editor-header">
                                            <h3>원본 행</h3>
                                        </div>

                                        <div className="sheet-table-wrapper compact">
                                            <table className="sheet-table">
                                                <thead>
                                                    <tr>
                                                        <th>구분</th>
                                                        <th>일자</th>
                                                        <th>현장명</th>
                                                        <th>내용</th>
                                                        <th>공급가액</th>
                                                        <th>세액</th>
                                                        <th>합계</th>
                                                        <th>{receiptHistoryLabels.amount}</th>
                                                        <th>비고</th>
                                                        <th>팀명</th>
                                                        <th>처리</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    <tr>
                                                        <td>{receiptHistoryInvoice.transactionType}</td>
                                                        <td>{receiptHistoryInvoice.date}</td>
                                                        <td>{receiptHistoryInvoice.siteName || '-'}</td>
                                                        <td>{receiptHistoryInvoice.description || '-'}</td>
                                                        <td className="align-right">{formatNumber(receiptHistoryInvoice.supplyAmount)}</td>
                                                        <td className="align-right">{formatNumber(receiptHistoryInvoice.taxAmount)}</td>
                                                        <td className="align-right">{formatNumber(receiptHistoryInvoice.totalAmount)}</td>
                                                        <td className="align-right">{formatNumber(receiptHistoryInvoice.paymentAmount)}</td>
                                                        <td>{receiptHistoryInvoice.note || '-'}</td>
                                                        <td>{receiptHistoryInvoice.teamName || '-'}</td>
                                                        <td>
                                                            <div className="workbook-inline-actions">
                                                                <button
                                                                    type="button"
                                                                    className="workbook-toolbar-button workbook-inline-button"
                                                                    onClick={() => handleEditDbEntry(receiptHistoryInvoice)}
                                                                    disabled={dbActionLoading || receiptActionLoading}
                                                                >
                                                                    <FontAwesomeIcon icon={faPenToSquare} />
                                                                    수정
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    className="workbook-toolbar-button workbook-inline-button workbook-danger-button"
                                                                    onClick={() => handleDeleteDbEntry(receiptHistoryInvoice)}
                                                                    disabled={dbActionLoading || receiptActionLoading}
                                                                >
                                                                    <FontAwesomeIcon icon={faTrashCan} />
                                                                    삭제
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    {legacyMatchedGap > 0 && (
                                        <div className="workbook-modal-warning">
                                            기존 자동매칭 수금 {formatNumber(legacyMatchedGap)}원은 개별 이력이 연결되지 않아 여기서 수정/삭제할 수 없습니다.
                                        </div>
                                    )}

                                    <div className="sheet-table-wrapper compact">
                                        <table className="sheet-table">
                                            <thead>
                                                <tr>
                                                    <th>{receiptHistoryLabels.date}</th>
                                                    <th>{receiptHistoryLabels.amount}</th>
                                                    <th>비고</th>
                                                    <th>처리</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {receiptHistoryOriginalPaymentAmount <= 0 && receiptHistoryEntries.length === 0 && (
                                                    <tr>
                                                        <td colSpan={4} className="sheet-empty-state">등록된 {receiptHistoryLabels.history}이 없습니다.</td>
                                                    </tr>
                                                )}
                                                {receiptHistoryInvoice && receiptHistoryOriginalPaymentAmount > 0 && (
                                                    <tr key={`original-${receiptHistoryInvoice.id ?? receiptHistoryInvoice.date}`}>
                                                        <td>{receiptHistoryInvoice.date}</td>
                                                        <td className="align-right">{formatNumber(receiptHistoryOriginalPaymentAmount)}</td>
                                                        <td>{receiptHistoryInvoice.note || '원본 업로드 행'}</td>
                                                        <td>
                                                            <div className="workbook-inline-actions">
                                                                <button
                                                                    type="button"
                                                                    className="workbook-toolbar-button workbook-inline-button"
                                                                    onClick={() => handleEditDbEntry(receiptHistoryInvoice)}
                                                                    disabled={dbActionLoading || receiptActionLoading}
                                                                >
                                                                    <FontAwesomeIcon icon={faPenToSquare} />
                                                                    원본수정
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    className="workbook-toolbar-button workbook-inline-button workbook-danger-button"
                                                                    onClick={() => handleDeleteDbEntry(receiptHistoryInvoice)}
                                                                    disabled={dbActionLoading || receiptActionLoading}
                                                                >
                                                                    <FontAwesomeIcon icon={faTrashCan} />
                                                                    원본삭제
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                                {receiptHistoryEntries.map((entry) => (
                                                    <tr key={entry.id}>
                                                        <td>{entry.date}</td>
                                                        <td className="align-right">{formatNumber(entry.paymentAmount)}</td>
                                                        <td>{entry.note || '-'}</td>
                                                        <td>
                                                            <div className="workbook-inline-actions">
                                                                <button
                                                                    type="button"
                                                                    className="workbook-toolbar-button workbook-inline-button"
                                                                    onClick={() => handleStartEditReceipt(entry)}
                                                                    disabled={receiptActionLoading}
                                                                >
                                                                    <FontAwesomeIcon icon={faPenToSquare} />
                                                                    수정
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    className="workbook-toolbar-button workbook-inline-button workbook-danger-button"
                                                                    onClick={() => handleDeleteSettlement(entry)}
                                                                    disabled={receiptActionLoading}
                                                                >
                                                                    <FontAwesomeIcon icon={faTrashCan} />
                                                                    삭제
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    <div className="workbook-editor-card">
                                        <div className="workbook-editor-header">
                                            <h3>{receiptHistoryLabels.history} 수정</h3>
                                            {editingReceiptDraft && (
                                                <button
                                                    type="button"
                                                    className="workbook-toolbar-button workbook-inline-button"
                                                    onClick={handleCancelEditReceipt}
                                                    disabled={receiptActionLoading}
                                                >
                                                    취소
                                                </button>
                                            )}
                                        </div>

                                        {editingReceiptDraft ? (
                                            <div className="workbook-editor-grid">
                                                <label>
                                                    <span>{receiptHistoryLabels.date}</span>
                                                    <input
                                                        type="date"
                                                        value={editingReceiptDraft.date}
                                                        onChange={(event) => handleChangeEditingReceipt('date', event.target.value)}
                                                        disabled={receiptActionLoading}
                                                    />
                                                </label>
                                                <label>
                                                    <span>{receiptHistoryLabels.amount}</span>
                                                    <input
                                                        type="number"
                                                        min={1}
                                                        value={editingReceiptDraft.paymentAmount}
                                                        onChange={(event) => handleChangeEditingReceipt('paymentAmount', event.target.value)}
                                                        disabled={receiptActionLoading}
                                                    />
                                                </label>
                                                <label className="workbook-editor-wide">
                                                    <span>비고</span>
                                                    <input
                                                        type="text"
                                                        value={editingReceiptDraft.note}
                                                        onChange={(event) => handleChangeEditingReceipt('note', event.target.value)}
                                                        disabled={receiptActionLoading}
                                                    />
                                                </label>
                                                <div className="workbook-editor-actions">
                                                    <button
                                                        type="button"
                                                        className="excel-button excel-button-green"
                                                        onClick={handleSaveEditedSettlement}
                                                        disabled={receiptActionLoading}
                                                    >
                                                        <FontAwesomeIcon icon={receiptActionLoading ? faSpinner : faPenToSquare} spin={receiptActionLoading} />
                                                        수정 저장
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="sheet-empty-state">수정할 {receiptHistoryLabels.history}을 선택하세요.</div>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <div className="sheet-empty-state">대상 매출을 찾을 수 없습니다.</div>
                            )}
                        </div>
                    </div>
                )}

                <datalist id="workbook-partner-options">
                    {partnerNames.map((partner) => (
                        <option key={partner} value={partner} />
                    ))}
                </datalist>
                <datalist id="workbook-site-options">
                    {siteNames.map((site) => (
                        <option key={site} value={site} />
                    ))}
                </datalist>
                <datalist id="workbook-team-options">
                    {teamNames.map((team) => (
                        <option key={team} value={team} />
                    ))}
                </datalist>
            </div>
        </div>
    );
};

export default WorkbookLedgerPage;
