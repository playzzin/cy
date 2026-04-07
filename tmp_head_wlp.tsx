import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
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
import {
    workbookLedgerService,
    WorkbookLedgerEntry,
    WorkbookTransactionType
} from '../../services/workbookLedgerService';
import './WorkbookLedgerPage.css';

registerAllModules();

type WorkbookTab = 'input' | 'database' | 'ledger' | 'summary';
type SummaryMode = '???' | '???' | '????? | '??????';

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
const buildDefaultLedgerStart = (year: number) => `${year}-01-01`;
const WORKBOOK_TABS: Array<{ id: WorkbookTab; label: string }> = [
    { id: 'input', label: '????? },
    { id: 'database', label: 'DB' },
    { id: 'ledger', label: '???(???,????????' },
    { id: 'summary', label: '??? ???' }
];

const DB_HEADERS = [
    '???',
    '???',
    '??????',
    '?????,
    '???',
    '???????,
    '??????,
    '???',
    '??????',
    '??????',
    '?????,
    '??????ID',
    '???',
    '????
] as const;

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

const normalizeInputRows = (rows: InputRow[], baseYear: number, selectedTeam: string) =>
    rows.map((row) => normalizeInputRow(row, baseYear, selectedTeam));

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

const formatDateInput = (date: Date) => date.toISOString().slice(0, 10);

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
const normalizePartnerMatchKey = (value: unknown) => normalizeText(value)
    .toLowerCase()
    .replace(/\(??)|????????/g, '')
    .replace(/\s+/g, '')
    .replace(/[^0-9a-z??-??/g, '');
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

const normalizeTransactionType = (value: unknown): WorkbookTransactionType | null => {
    const text = normalizeText(value);
    if (text.includes('???')) return '???';
    if (text.includes('???')) return '???';
    return null;
};

const normalizeDate = (value: unknown): string => {
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
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

    const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (slashMatch) {
        const [, monthText, dayText, yearText] = slashMatch;
        const yearNumber = Number(yearText.length === 2 ? `20${yearText}` : yearText);
        const monthNumber = Number(monthText);
        const dayNumber = Number(dayText);
        if (
            Number.isFinite(yearNumber) &&
            monthNumber >= 1 &&
            monthNumber <= 12 &&
            dayNumber >= 1 &&
            dayNumber <= 31
        ) {
            return `${yearNumber}-${String(monthNumber).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`;
        }
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
    headerRow.forEach((header, index) => {
        if (header) headerIndex.set(header, index);
    });

    const requiredHeaders = ['???', '???', '??????'];
    const hasRequiredHeaders = requiredHeaders.every((header) => headerIndex.has(header));

    if (!hasRequiredHeaders) {
        throw new Error('??????????? DB ???????? ???????? DB ??? ??? ???????? ??????????????????');
    }

    const readCell = (row: unknown[], header: string) => {
        const index = headerIndex.get(header);
        return index === undefined ? '' : row[index];
    };

    const entries: Omit<WorkbookLedgerEntry, 'id' | 'createdAt' | 'updatedAt'>[] = [];
    let skipped = 0;

    rows.slice(1).forEach((row) => {
        const transactionType = normalizeTransactionType(readCell(row, '???'));
        const date = normalizeDate(readCell(row, '???'));
        const partnerName = normalizeText(readCell(row, '??????'));
        const siteName = normalizeText(readCell(row, '?????));
        const description = normalizeText(readCell(row, '???'));
        const manDays = headerIndex.has('???') ? toNumberOrNull(readCell(row, '???')) : null;
        const supplyAmount = toNumberOrNull(readCell(row, '???????)) ?? 0;
        const taxAmount = toNumberOrNull(readCell(row, '??????)) ?? 0;
        const totalAmount = toNumberOrNull(readCell(row, '???')) ?? 0;
        const paymentAmount = toNumberOrNull(readCell(row, '??????')) ?? 0;
        const appliedYear = toNumberOrNull(readCell(row, '??????')) ?? getYearFromDate(date) ?? fallbackYear;
        const appliedMonth = toNumberOrNull(readCell(row, '?????)) ?? getMonthFromDate(date);
        const matchedEntryId = normalizeText(readCell(row, '??????ID'));
        const note = normalizeText(readCell(row, '???'));
        const teamName = normalizeText(readCell(row, '????)) || fallbackTeamName;

        const entry: WorkbookLedgerEntry = {
            transactionType: transactionType ?? '???',
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

const normalizeInputRow = (row: InputRow, baseYear: number, selectedTeam: string): InputRow => {
    const normalizedDate = normalizeDate(row.date);
    const supplyAmount = toNumberOrNull(row.supplyAmount);
    const taxAmount = supplyAmount === null ? null : Math.round(supplyAmount * 0.1);
    const totalAmount = supplyAmount === null ? null : supplyAmount + (taxAmount ?? 0);
    const paymentAmount = toNumberOrNull(row.paymentAmount);
    const manDays = toNumberOrNull(row.manDays);
    const rowHasContent = hasInputContent({
        ...row,
        date: normalizedDate,
        supplyAmount,
        paymentAmount,
        manDays
    });

    return {
        transactionType: row.transactionType,
        date: normalizedDate,
        partnerName: normalizeText(row.partnerName),
        siteName: normalizeText(row.siteName),
        description: normalizeText(row.description),
        manDays,
        supplyAmount,
        taxAmount,
        totalAmount,
        paymentAmount,
        appliedYear: normalizedDate ? baseYear : null,
        appliedMonth: normalizedDate ? (toNumberOrNull(row.appliedMonth) ?? getMonthFromDate(normalizedDate)) : null,
        note: normalizeText(row.note),
        teamName: rowHasContent ? selectedTeam : ''
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
    const isPurchase = transactionType === '???';

    return {
        action: isPurchase ? '???? : '???',
        history: isPurchase ? '??????? : '??????',
        date: isPurchase ? '??????? : '??????',
        amount: isPurchase ? '??????? : '??????',
        cumulative: isPurchase ? '??????? : '??????',
        outstanding: isPurchase ? '??????' : '?????,
        placeholder: isPurchase ? '???????' : '??? ???'
    };
};

const getSummaryDisplayedSettledAmount = (row: SummaryRow) => {
    if (row.outstandingAmount < 0) {
        return row.outstandingAmount;
    }

    return row.settledAmount;
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

    const transactionType: WorkbookTransactionType = filter.mode === '???' || filter.mode === '??????' ? '???' : '???';
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
    const transactionType: WorkbookTransactionType = filter.mode === '???' || filter.mode === '??????' ? '???' : '???';
    const startDate = normalizeDate(filter.startDate);
    const endDate = normalizeDate(filter.endDate);
    const isSettlementMode = filter.mode === '????? || filter.mode === '??????';

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
        .filter((entry) => {
            if (!isSettlementMode) return true;
            return entry.date <= endDate;
        })
        .filter((entry) => matchesFilter(entry.teamName, filter.teamName))
        .filter((entry) => matchesFilter(entry.partnerName, filter.partnerName))
        .filter((entry) => matchesFilter(entry.siteName, filter.siteName))
        .sort(sortWorkbookEntries);

    const applyPaymentToInvoice = (
        invoice: WorkingSummaryRow,
        paymentAmount: number,
        paymentDate: string,
        options?: { recordDate?: boolean }
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
                applyPaymentToInvoice(matchedInvoice, paymentAmount, paymentEntry.date);
            }
            return;
        }

        if (selfInvoice) {
            applyPaymentToInvoice(selfInvoice, paymentAmount, paymentEntry.date);
            return;
        }

        const legacyMatchedInvoice = findLegacyMatchedInvoice(paymentEntry, paymentAmount);
        if (legacyMatchedInvoice) {
            applyPaymentToInvoice(legacyMatchedInvoice, paymentAmount, paymentEntry.date);
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
                applyPaymentToInvoice(matchedInvoice, adjustmentAmount, adjustmentEntry.date);
            }
            return;
        }

        const directOffsetInvoice = findDirectOffsetInvoice(adjustmentEntry);
        if (directOffsetInvoice) {
            applyPaymentToInvoice(directOffsetInvoice, adjustmentAmount, adjustmentEntry.date);
            return;
        }

        const legacyMatchedInvoice = findLegacyMatchedInvoice(adjustmentEntry, adjustmentAmount);
        if (legacyMatchedInvoice) {
            applyPaymentToInvoice(legacyMatchedInvoice, adjustmentAmount, adjustmentEntry.date);
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

const WorkbookLedgerPage: React.FC = () => {
    const hotRef = useRef<any>(null);
    const dbUploadInputRef = useRef<HTMLInputElement | null>(null);
    const ledgerCaptureRef = useRef<HTMLDivElement | null>(null);
    const summaryCaptureRef = useRef<HTMLDivElement | null>(null);
    const { currentUser } = useAuth();

    const today = useMemo(() => new Date(), []);
    const currentYear = today.getFullYear();
    const todayString = formatDateInput(today);
    const defaultLedgerStart = buildDefaultLedgerStart(currentYear);

    const [activeTab, setActiveTab] = useState<WorkbookTab>('input');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [uploadingDb, setUploadingDb] = useState(false);
    const [downloadingDb, setDownloadingDb] = useState(false);
    const [dbActionLoading, setDbActionLoading] = useState(false);
    const [capturingView, setCapturingView] = useState<'ledger' | 'summary' | null>(null);
    const [printingLedger, setPrintingLedger] = useState(false);
    const [printingSummary, setPrintingSummary] = useState(false);
    const [receiptActionLoading, setReceiptActionLoading] = useState(false);
    const [entries, setEntries] = useState<WorkbookLedgerEntry[]>([]);
    const [entriesLoaded, setEntriesLoaded] = useState(false);
    const [partnerNames, setPartnerNames] = useState<string[]>([]);
    const [siteNames, setSiteNames] = useState<string[]>([]);
    const [teamNames, setTeamNames] = useState<string[]>([]);
    const partnerSeedNamesRef = useRef<string[]>([]);
    const siteSeedNamesRef = useRef<string[]>([]);
    const teamSeedNamesRef = useRef<string[]>([]);
    const catalogsLoadedRef = useRef(false);
    const entriesLoadedRef = useRef(false);
    const [selectedTeam, setSelectedTeam] = useState('');
    const [baseYear, setBaseYear] = useState(currentYear);
    const [inputRows, setInputRows] = useState<InputRow[]>(() => Array.from({ length: INPUT_ROW_COUNT }, emptyInputRow));

    const [ledgerDraft, setLedgerDraft] = useState<LedgerFilter>({
        startDate: defaultLedgerStart,
        endDate: todayString,
        teamName: '',
        transactionType: '???',
        partnerName: '',
        siteName: ''
    });
    const [ledgerFilter, setLedgerFilter] = useState<LedgerFilter>({
        startDate: defaultLedgerStart,
        endDate: todayString,
        teamName: '',
        transactionType: '???',
        partnerName: '',
        siteName: ''
    });

    const [summaryDraft, setSummaryDraft] = useState<SummaryFilter>({
        startDate: defaultLedgerStart,
        endDate: todayString,
        teamName: '',
        mode: '?????,
        partnerName: '',
        siteName: ''
    });
    const [summaryFilter, setSummaryFilter] = useState<SummaryFilter>({
        startDate: defaultLedgerStart,
        endDate: todayString,
        teamName: '',
        mode: '?????,
        partnerName: '',
        siteName: ''
    });
    const [dbFilter, setDbFilter] = useState<DbFilterState>(emptyDbFilter);
    const [dbSort, setDbSort] = useState<DbSortState>({ field: 'date', direction: 'asc' });
    const [dbPage, setDbPage] = useState(1);
    const [selectedDbEntryIds, setSelectedDbEntryIds] = useState<string[]>([]);
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

    const refreshPageData = useCallback(async (options?: { forceEntries?: boolean; forceCatalogs?: boolean; loadEntries?: boolean }) => {
        setLoading(true);
        try {
            const shouldLoadCatalogs = options?.forceCatalogs || !catalogsLoadedRef.current;
            const shouldLoadEntries = options?.loadEntries ?? entriesLoadedRef.current;
            const [savedEntries, companies, sites, teams] = await Promise.all([
                shouldLoadEntries ? workbookLedgerService.getEntries({ force: options?.forceEntries }) : Promise.resolve(null),
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
                rebuildLookupOptions(savedEntries);
                entriesLoadedRef.current = true;
                setEntriesLoaded(true);
            }
        } catch (error) {
            console.error(error);
            Swal.fire('???', '??? ??? ?????? ?????? ????????', 'error');
        } finally {
            setLoading(false);
        }
    }, [rebuildLookupOptions]);

    useEffect(() => {
        refreshPageData({ forceCatalogs: true, loadEntries: false });
    }, [refreshPageData]);

    useEffect(() => {
        if (activeTab === 'input' || entriesLoadedRef.current) return;
        refreshPageData({ loadEntries: true });
    }, [activeTab, refreshPageData]);

    useEffect(() => {
        setInputRows((prevRows) => {
            const nextRows = normalizeInputRows(prevRows, baseYear, selectedTeam);
            return areInputRowsEqual(prevRows, nextRows) ? prevRows : nextRows;
        });
    }, [baseYear, selectedTeam]);

    const handleInputGridChange = useCallback((changes: unknown, source: string) => {
        if (!Array.isArray(changes) || changes.length === 0) return;
        if (source === 'loadData' || source === 'updateData') return;

        const hotInstance = hotRef.current?.hotInstance;
        if (!hotInstance) return;

        const nextRows = normalizeInputRows(hotInstance.getSourceData() as InputRow[], baseYear, selectedTeam);

        setInputRows((prevRows) => (areInputRowsEqual(prevRows, nextRows) ? prevRows : nextRows));
    }, [baseYear, selectedTeam]);

    const handleResetInputGrid = useCallback(() => {
        setInputRows(Array.from({ length: INPUT_ROW_COUNT }, emptyInputRow));
    }, []);

    const handleSaveRows = useCallback(async () => {
        const normalizedRows = inputRows.map((row) => normalizeInputRow(row, baseYear, selectedTeam));
        const filledRows = normalizedRows
            .map((row, index) => ({ row, excelRowNumber: index + 7 }))
            .filter(({ row }) => hasInputContent(row));

        if (filledRows.length === 0) {
            Swal.fire('???', '????? ??? ??? ??????.', 'info');
            return;
        }

        const validationErrors: string[] = [];
        const preparedEntries: Omit<WorkbookLedgerEntry, 'createdAt' | 'updatedAt'>[] = [];

        filledRows.forEach(({ row, excelRowNumber }) => {
            if (!row.transactionType) {
                validationErrors.push(`${excelRowNumber}?? ?????????????`);
                return;
            }

            if (!row.date) {
                validationErrors.push(`${excelRowNumber}?? ?????????????`);
                return;
            }

            if (!row.partnerName) {
                validationErrors.push(`${excelRowNumber}?? ????????????????`);
                return;
            }

            const supplyAmount = row.supplyAmount ?? 0;
            const taxAmount = row.taxAmount ?? 0;
            const totalAmount = row.totalAmount ?? 0;
            const paymentAmount = row.paymentAmount ?? 0;
            const appliedMonth = row.appliedMonth ?? getMonthFromDate(row.date);

            if (totalAmount === 0 && paymentAmount <= 0) {
                validationErrors.push(`${excelRowNumber}?? ??? ??? ?????? ????????????????????`);
                return;
            }

            const basePayload = {
                transactionType: row.transactionType,
                date: row.date,
                partnerName: row.partnerName,
                siteName: row.siteName,
                description: row.description,
                manDays: row.manDays,
                appliedYear: row.appliedYear ?? baseYear,
                appliedMonth,
                note: row.note,
                teamName: row.teamName || selectedTeam,
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
                        ? (row.transactionType === '???' ? '???' : '???')
                        : (row.transactionType === '???' ? '???' : '????)),
                supplyAmount,
                taxAmount,
                totalAmount,
                paymentAmount
            });
        });

        if (validationErrors.length > 0) {
            Swal.fire('??? ???', validationErrors.slice(0, 8).join('<br />'), 'warning');
            return;
        }

        if (preparedEntries.length === 0) {
            Swal.fire('???', '????????? ?????? ??????.', 'info');
            return;
        }

        setSaving(true);
        try {
            await workbookLedgerService.addEntries(preparedEntries);
            handleResetInputGrid();
            await refreshPageData();
            Swal.fire('???????', `${preparedEntries.length}??? ??? ??? DB???????????.`, 'success');
        } catch (error) {
            console.error(error);
            Swal.fire('???', '??? ?????? ??????? ????????', 'error');
        } finally {
            setSaving(false);
        }
    }, [baseYear, currentUser?.uid, handleResetInputGrid, inputRows, refreshPageData, selectedTeam]);

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
                throw new Error('??????????? ???????? ????????.');
            }

            const worksheet = workbook.Sheets[sheetName];
            const rows = XLSX.utils.sheet_to_json(worksheet, {
                header: 1,
                raw: false,
                defval: ''
            }) as unknown[][];

            const { entries: importedEntries, skipped } = parseImportedDbEntries(rows, selectedTeam, baseYear);

            if (importedEntries.length === 0) {
                Swal.fire('???', '????? ????? DB ??? ??????.', 'info');
                return;
            }

            const result = await Swal.fire({
                title: 'DB ?????,
                html: `${importedEntries.length.toLocaleString()}??? ??? ??? DB??????????${skipped > 0 ? `<br />?????: ${skipped.toLocaleString()}?? : ''}`,
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: '?????,
                cancelButtonText: '???'
            });

            if (!result.isConfirmed) return;

            await workbookLedgerService.addEntries(
                importedEntries.map((entry) => ({
                    ...entry,
                    createdBy: currentUser?.uid ?? ''
                }))
            );

            await refreshPageData();
            setActiveTab('database');
            Swal.fire('????????', `${importedEntries.length.toLocaleString()}??? DB???????????.`, 'success');
        } catch (error) {
            console.error(error);
            Swal.fire('???', error instanceof Error ? error.message : 'DB ?????? ?????????.', 'error');
        } finally {
            setUploadingDb(false);
        }
    }, [baseYear, currentUser?.uid, refreshPageData, selectedTeam]);

    const handleDownloadDb = useCallback(async () => {
        if (entries.length === 0) {
            Swal.fire('???', '????????DB ?????? ??????.', 'info');
            return;
        }

        setDownloadingDb(true);
        try {
            const XLSX = await import('xlsx');
            const { saveAs } = await import('file-saver');
            const worksheet = XLSX.utils.aoa_to_sheet([
                [...DB_HEADERS],
                ...entries.map(toDbRow)
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

            saveAs(blob, `??????_DB_${new Date().toISOString().slice(0, 10)}.xlsx`);
        } catch (error) {
            console.error(error);
            Swal.fire('???', 'DB ?????????????????.', 'error');
        } finally {
            setDownloadingDb(false);
        }
    }, [entries]);

    const handleCopyCapture = useCallback(async (
        target: 'ledger' | 'summary',
        element: HTMLElement | null,
        label: string
    ) => {
        if (!element) {
            Swal.fire('???', `${label} ???????? ????????`, 'info');
            return;
        }

        setCapturingView(target);
        try {
            const { default: html2canvas } = await import('html2canvas');
            const captureWidth = Math.max(element.scrollWidth, element.clientWidth);
            const captureHeight = Math.max(element.scrollHeight, element.clientHeight);
            const canvas = await (html2canvas as any)(element, {
                scale: 2,
                backgroundColor: '#ffffff',
                logging: false,
                useCORS: true,
                width: captureWidth,
                height: captureHeight,
                windowWidth: captureWidth,
                windowHeight: captureHeight,
                ignoreElements: (node: Element) => (node as HTMLElement).dataset?.html2canvasIgnore === 'true'
            });

            const blob = await new Promise<Blob | null>((resolve) => {
                canvas.toBlob((nextBlob: Blob | null) => resolve(nextBlob), 'image/png');
            });

            if (!blob) {
                Swal.fire('???', `${label} ??? ????? ??????????????.`, 'error');
                return;
            }

            const ClipboardItemCtor = (window as typeof window & {
                ClipboardItem?: new (items: Record<string, Blob>) => ClipboardItem;
            }).ClipboardItem;
            const clipboard = navigator.clipboard as Clipboard & {
                write?: (data: ClipboardItem[]) => Promise<void>;
            };

            if (!ClipboardItemCtor || !clipboard.write) {
                Swal.fire('???', '??????????????? ?????? ???????????? ??????.', 'info');
                return;
            }

            await clipboard.write([
                new ClipboardItemCtor({
                    'image/png': blob
                })
            ]);

            Swal.fire('??? ???', `${label} ????????????????????????`, 'success');
        } catch (error) {
            console.error(error);
            Swal.fire('???', `${label} ??? ??????????????.`, 'error');
        } finally {
            setCapturingView((current) => (current === target ? null : current));
        }
    }, []);

    const handleEditDbEntry = useCallback(async (entry: WorkbookLedgerEntry) => {
        if (!entry.id) return;

        const linkedPayments = entries.filter((item) => isPaymentEntry(item) && item.matchedEntryId === entry.id);
        const linkedPaymentTotal = linkedPayments.reduce((sum, item) => sum + (item.paymentAmount ?? 0), 0);

        const result = await Swal.fire({
            title: 'DB ?????',
            width: 760,
            html: `
                <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;text-align:left;">
                    <label style="display:grid;gap:6px;">
                        <span style="font-size:13px;font-weight:700;">???</span>
                        <select id="db-type" class="swal2-input" style="margin:0;width:100%;">
                            <option value="???" ${entry.transactionType === '???' ? 'selected' : ''}>???</option>
                            <option value="???" ${entry.transactionType === '???' ? 'selected' : ''}>???</option>
                        </select>
                    </label>
                    <label style="display:grid;gap:6px;">
                        <span style="font-size:13px;font-weight:700;">???</span>
                        <input id="db-date" type="date" value="${escapeHtml(entry.date || '')}" class="swal2-input" style="margin:0;width:100%;" />
                    </label>
                    <label style="display:grid;gap:6px;">
                        <span style="font-size:13px;font-weight:700;">??????</span>
                        <input id="db-partner" type="text" value="${escapeHtml(entry.partnerName || '')}" class="swal2-input" style="margin:0;width:100%;" />
                    </label>
                    <label style="display:grid;gap:6px;">
                        <span style="font-size:13px;font-weight:700;">?????/span>
                        <input id="db-site" type="text" value="${escapeHtml(entry.siteName || '')}" class="swal2-input" style="margin:0;width:100%;" />
                    </label>
                    <label style="display:grid;gap:6px;grid-column:1 / -1;">
                        <span style="font-size:13px;font-weight:700;">???</span>
                        <input id="db-description" type="text" value="${escapeHtml(entry.description || '')}" class="swal2-input" style="margin:0;width:100%;" />
                    </label>
                    <label style="display:grid;gap:6px;">
                        <span style="font-size:13px;font-weight:700;">???????/span>
                        <input id="db-supply" type="number" value="${entry.supplyAmount || 0}" class="swal2-input" style="margin:0;width:100%;" />
                    </label>
                    <label style="display:grid;gap:6px;">
                        <span style="font-size:13px;font-weight:700;">??????</span>
                        <input id="db-payment" type="number" min="0" value="${entry.paymentAmount || 0}" class="swal2-input" style="margin:0;width:100%;" />
                    </label>
                    <label style="display:grid;gap:6px;">
                        <span style="font-size:13px;font-weight:700;">??????</span>
                        <input id="db-year" type="number" min="2000" max="2100" value="${entry.appliedYear ?? getYearFromDate(entry.date) ?? baseYear}" class="swal2-input" style="margin:0;width:100%;" />
                    </label>
                    <label style="display:grid;gap:6px;">
                        <span style="font-size:13px;font-weight:700;">?????/span>
                        <input id="db-month" type="number" min="1" max="12" value="${entry.appliedMonth ?? getMonthFromDate(entry.date) ?? 1}" class="swal2-input" style="margin:0;width:100%;" />
                    </label>
                    <label style="display:grid;gap:6px;grid-column:1 / -1;">
                        <span style="font-size:13px;font-weight:700;">???</span>
                        <input id="db-note" type="text" value="${escapeHtml(entry.note || '')}" class="swal2-input" style="margin:0;width:100%;" />
                    </label>
                    <label style="display:grid;gap:6px;grid-column:1 / -1;">
                        <span style="font-size:13px;font-weight:700;">????/span>
                        <input id="db-team" type="text" value="${escapeHtml(entry.teamName || '')}" class="swal2-input" style="margin:0;width:100%;" />
                    </label>
                    ${entry.matchedEntryId ? `
                        <label style="display:grid;gap:6px;grid-column:1 / -1;">
                            <span style="font-size:13px;font-weight:700;">??????ID</span>
                            <input type="text" value="${escapeHtml(entry.matchedEntryId)}" class="swal2-input" style="margin:0;width:100%;background:#f8fafc;" readonly />
                        </label>
                    ` : ''}
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: '????,
            cancelButtonText: '???',
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

                if (transactionType !== '???' && transactionType !== '???') {
                    Swal.showValidationMessage('???????????????');
                    return null;
                }

                if (!date) {
                    Swal.showValidationMessage('???????????????');
                    return null;
                }

                if (!partnerName) {
                    Swal.showValidationMessage('??????????????????');
                    return null;
                }

                if (totalAmount === 0 && paymentAmount <= 0) {
                    Swal.showValidationMessage('?????????? ?????? ?????????????????');
                    return null;
                }

                if (paymentAmount < 0) {
                    Swal.showValidationMessage('???????? 0 ?????????????');
                    return null;
                }

                if (linkedPayments.length > 0 && transactionType !== entry.transactionType) {
                    Swal.showValidationMessage('???????????????? ???/??? ??? ?????????? ????????.');
                    return null;
                }

                if (linkedPayments.length > 0 && totalAmount <= 0) {
                    Swal.showValidationMessage('???????????????? ??? ?????0??? ??? ????????.');
                    return null;
                }

                if (totalAmount > 0) {
                    const minimumInvoiceAmount = linkedPaymentTotal + paymentAmount;
                    if (totalAmount < minimumInvoiceAmount) {
                        Swal.showValidationMessage(`????????????? ${formatNumber(minimumInvoiceAmount)}???????????????`);
                        return null;
                    }
                }

                if (paymentAmount > 0 && entry.matchedEntryId) {
                    const matchedInvoice = entries.find((item) => item.id === entry.matchedEntryId && isInvoiceEntry(item));
                    if (matchedInvoice) {
                        if (transactionType !== matchedInvoice.transactionType) {
                            Swal.showValidationMessage('??? ??? ????? ???????? ??? ??????????');
                            return null;
                        }

                        const siblingPayments = entries
                            .filter((item) => isPaymentEntry(item) && item.matchedEntryId === entry.matchedEntryId && item.id !== entry.id)
                            .reduce((sum, item) => sum + (item.paymentAmount ?? 0), 0);
                        const maxPaymentAmount = Math.max((matchedInvoice.totalAmount ?? 0) - siblingPayments, 0);

                        if (paymentAmount > maxPaymentAmount) {
                            Swal.showValidationMessage(`???????? ??? ???????? ${formatNumber(maxPaymentAmount)}??? ??? ????????.`);
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
            await workbookLedgerService.updateEntry(entry.id, {
                ...result.value,
                updatedBy: currentUser?.uid ?? ''
            });
            await refreshPageData();
            Swal.fire('??? ???', 'DB ??? ?????????.', 'success');
        } catch (error) {
            console.error(error);
            Swal.fire('???', 'DB ????????????????.', 'error');
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
            Swal.fire('???', '?????DB ??? ??? ????? ?????', 'info');
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

        if (transactionType !== '???' && transactionType !== '???') {
            Swal.fire('??? ???', '???????????????', 'warning');
            return;
        }

        if (!date) {
            Swal.fire('??? ???', '???????????????', 'warning');
            return;
        }

        if (!partnerName) {
            Swal.fire('??? ???', '??????????????????', 'warning');
            return;
        }

        if (totalAmount === 0 && paymentAmount <= 0) {
            Swal.fire('??? ???', '?????????? ?????? ?????????????????', 'warning');
            return;
        }

        if (paymentAmount < 0) {
            Swal.fire('??? ???', '???????? 0 ?????????????', 'warning');
            return;
        }

        if (linkedPayments.length > 0 && transactionType !== entry.transactionType) {
            Swal.fire('??? ???', '???????????????? ???/??? ??? ?????????? ????????.', 'warning');
            return;
        }

        if (linkedPayments.length > 0 && totalAmount <= 0) {
            Swal.fire('??? ???', '???????????????? ??? ?????0 ?????????? ????????.', 'warning');
            return;
        }

        if (totalAmount > 0) {
            const minimumInvoiceAmount = linkedPaymentTotal + paymentAmount;
            if (totalAmount < minimumInvoiceAmount) {
                Swal.fire('??? ???', `????????????? ${formatNumber(minimumInvoiceAmount)}???????????????`, 'warning');
                return;
            }
        }

        if (paymentAmount > 0 && entry.matchedEntryId) {
            const matchedInvoice = entries.find((item) => item.id === entry.matchedEntryId && isInvoiceEntry(item));
            if (matchedInvoice) {
                if (transactionType !== matchedInvoice.transactionType) {
                    Swal.fire('??? ???', '??? ??? ????? ???????? ??? ??????????', 'warning');
                    return;
                }

                const siblingPayments = entries
                    .filter((item) => isPaymentEntry(item) && item.matchedEntryId === entry.matchedEntryId && item.id !== entry.id)
                    .reduce((sum, item) => sum + (item.paymentAmount ?? 0), 0);
                const maxPaymentAmount = Math.max((matchedInvoice.totalAmount ?? 0) - siblingPayments, 0);

                if (paymentAmount > maxPaymentAmount) {
                    Swal.fire('??? ???', `???????? ??? ???????? ${formatNumber(maxPaymentAmount)}??? ??? ????????.`, 'warning');
                    return;
                }
            }
        }

        setDbActionLoading(true);
        try {
            await workbookLedgerService.updateEntry(entry.id, {
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
            Swal.fire('??? ???', 'DB ??? ?????????.', 'success');
        } catch (error) {
            console.error(error);
            Swal.fire('???', 'DB ????????????????.', 'error');
        } finally {
            setDbActionLoading(false);
        }
    }, [baseYear, currentUser?.uid, editingDbDraft, entries, refreshPageData]);

    const handleDeleteDbEntry = useCallback(async (entry: WorkbookLedgerEntry) => {
        if (!entry.id) return;

        const linkedPayments = entries.filter((item) => isPaymentEntry(item) && item.matchedEntryId === entry.id);

        if (isInvoiceEntry(entry) && linkedPayments.length > 0) {
            Swal.fire('??? ???', '????? ???????????????????. ??????????? ??????????', 'warning');
            return;
        }

        const result = await Swal.fire({
            title: 'DB ?????',
            text: `${entry.date} / ${entry.partnerName} ??? ?????????????`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: '???',
            cancelButtonText: '???'
        });

        if (!result.isConfirmed) return;

        setDbActionLoading(true);
        try {
            await workbookLedgerService.softDeleteEntry(entry.id, currentUser?.uid ?? '');
            await refreshPageData();
            setEditingDbDraft((prev) => (prev?.id === entry.id ? null : prev));
            Swal.fire('??? ???', 'DB ??? ?????????.', 'success');
        } catch (error) {
            console.error(error);
            Swal.fire('???', 'DB ????????????????.', 'error');
        } finally {
            setDbActionLoading(false);
        }
    }, [currentUser?.uid, entries, refreshPageData]);

    const handleResetDatabase = useCallback(async () => {
        if (entries.length === 0) {
            Swal.fire('???', '?????? DB ?????? ??????.', 'info');
            return;
        }

        const result = await Swal.fire({
            title: 'DB ?????,
            html: `??? ????? <strong>${entries.length.toLocaleString()}??/strong>????? ?????????.<br />????????<strong>?????/strong>??????????`,
            input: 'text',
            inputPlaceholder: '?????,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: '?????,
            cancelButtonText: '???',
            focusConfirm: false,
            preConfirm: (value) => {
                if (normalizeText(value) !== '?????) {
                    Swal.showValidationMessage("'???????????????");
                    return false;
                }

                return true;
            }
        });

        if (!result.isConfirmed) return;

        setDbActionLoading(true);
        try {
            const deletedCount = await workbookLedgerService.softDeleteAllEntries(currentUser?.uid ?? '');
            await refreshPageData({ forceEntries: true });
            setEditingDbDraft(null);
            setExpandedDbEntryIds([]);
            setDbPage(1);
            Swal.fire('????????', `${deletedCount.toLocaleString()}??? DB ?????? ???????????`, 'success');
        } catch (error) {
            console.error(error);
            Swal.fire('???', 'DB ?????? ?????????.', 'error');
        } finally {
            setDbActionLoading(false);
        }
    }, [currentUser?.uid, entries.length, refreshPageData]);

    const handleBulkDeleteDbEntries = useCallback(async () => {
        if (selectedDbEntryIds.length === 0) {
            Swal.fire('???', '?????DB ??? ??? ????????', 'info');
            return;
        }

        const selectedIdSet = new Set(selectedDbEntryIds);
        const selectedEntries = entries.filter((entry) => entry.id && selectedIdSet.has(entry.id));

        if (selectedEntries.length === 0) {
            Swal.fire('???', '?????DB ??? ??? ????? ?????', 'info');
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
                '??? ???',
                `???????? ??? ???????????????? ??????.<br />??? ????? ??? ?????????? ????????${blockedPreview ? `<br /><br />${blockedPreview}` : ''}`,
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
            title: '??? ????????',
            html: [
                `?????<strong>${selectedEntries.length.toLocaleString()}??/strong> ??<strong>${deletableEntryIds.length.toLocaleString()}??/strong>??????????`,
                blockedCount > 0
                    ? `???????????????? ??? <strong>${blockedCount.toLocaleString()}??/strong>?? ????????${blockedPreview ? `<br /><br />${blockedPreview}${blockedCount > 5 ? '<br />...' : ''}` : ''}`
                    : ''
            ].filter(Boolean).join('<br />'),
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: blockedCount > 0 ? '????? ????????' : '??????',
            cancelButtonText: '???'
        });

        if (!result.isConfirmed) return;

        setDbActionLoading(true);
        try {
            const deletedCount = await workbookLedgerService.softDeleteEntries(deletableEntryIds, currentUser?.uid ?? '');
            await refreshPageData({ forceEntries: true });
            setSelectedDbEntryIds((prev) => prev.filter((id) => !deletableEntryIds.includes(id)));
            setEditingDbDraft((prev) => (prev && deletableEntryIds.includes(prev.id) ? null : prev));
            setExpandedDbEntryIds((prev) => prev.filter((id) => !deletableEntryIds.includes(id)));
            Swal.fire(
                blockedCount > 0 ? '??????? ???' : '??? ???',
                blockedCount > 0
                    ? `${deletedCount.toLocaleString()}??? ?????? ${blockedCount.toLocaleString()}??? ?????????.`
                    : `${deletedCount.toLocaleString()}??? ?????????.`,
                'success'
            );
        } catch (error) {
            console.error(error);
            Swal.fire('???', '??? ???????????????????.', 'error');
        } finally {
            setDbActionLoading(false);
        }
    }, [currentUser?.uid, entries, refreshPageData, selectedDbEntryIds]);

    const handleRegisterReceipt = useCallback(async (row: SummaryRow) => {
        const labels = getSettlementLabels(row.transactionType);

        const result = await Swal.fire({
            title: `${labels.action} ???`,
            html: `
                <div style="display:grid;gap:12px;text-align:left;">
                    <div>
                        <div style="font-size:13px;font-weight:700;margin-bottom:6px;">?????/div>
                        <div style="padding:10px 12px;border:1px solid #d7dde7;border-radius:10px;background:#f8fafc;">${row.partnerName}</div>
                    </div>
                    <div>
                        <div style="font-size:13px;font-weight:700;margin-bottom:6px;">${labels.outstanding}</div>
                        <div style="padding:10px 12px;border:1px solid #d7dde7;border-radius:10px;background:#f8fafc;">${formatNumber(row.outstandingAmount)}??/div>
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
                        <label for="receipt-note" style="font-size:13px;font-weight:700;display:block;margin-bottom:6px;">???</label>
                        <input id="receipt-note" type="text" class="swal2-input" style="margin:0;width:100%;" placeholder="${labels.placeholder}" />
                    </div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: '????,
            cancelButtonText: '???',
            focusConfirm: false,
            preConfirm: () => {
                const date = (document.getElementById('receipt-date') as HTMLInputElement | null)?.value ?? '';
                const amount = Number((document.getElementById('receipt-amount') as HTMLInputElement | null)?.value ?? '0');
                const note = (document.getElementById('receipt-note') as HTMLInputElement | null)?.value ?? '';

                if (!date) {
                    Swal.showValidationMessage(`${labels.date}??????????`);
                    return null;
                }

                if (!Number.isFinite(amount) || amount <= 0) {
                    Swal.showValidationMessage(`${labels.amount}?? 0??? ??? ?????`);
                    return null;
                }

                if (amount > row.outstandingAmount) {
                    Swal.showValidationMessage(`${labels.amount}?? ??? ${labels.outstanding}??? ??????????.`);
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
            await workbookLedgerService.addEntries([{
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
            Swal.fire('???????', `${formatNumber(amount)}??${labels.action}???????????.`, 'success');
        } catch (error) {
            console.error(error);
            Swal.fire('???', `${labels.action} ??????????????.`, 'error');
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
            Swal.fire('????', '?????????????? ???? ??????????????? ??????????', 'info');
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
            Swal.fire('????', '???????????????????? ??????????', 'info');
            return;
        }

        const currentAmount = currentReceipt.paymentAmount ?? 0;
        const maxAmount = Math.max((receiptHistoryInvoice.totalAmount ?? 0) - (receiptHistoryTotal - currentAmount), 0);

        if (!normalizedDate) {
            Swal.fire('??? ???', '????????????????', 'warning');
            return;
        }

        if (paymentAmount <= 0) {
            Swal.fire('??? ???', '???????? 0??? ??? ?????', 'warning');
            return;
        }

        if (paymentAmount > maxAmount) {
            Swal.fire('??? ???', '??? ???????? ??????????????????', 'warning');
            return;
        }

        setReceiptActionLoading(true);
        try {
            await workbookLedgerService.updateEntry(editingReceiptDraft.id, {
                date: normalizedDate,
                paymentAmount,
                note: normalizeText(editingReceiptDraft.note),
                updatedBy: currentUser?.uid ?? ''
            });

            await refreshPageData();
            setEditingReceiptDraft(null);
            Swal.fire('??? ???', '?????????????????.', 'success');
        } catch (error) {
            console.error(error);
            Swal.fire('???', '?????? ??????????????.', 'error');
        } finally {
            setReceiptActionLoading(false);
        }
    }, [currentUser?.uid, editingReceiptDraft, entries, receiptHistoryTargetId, refreshPageData]);

    const handleDeleteReceipt = useCallback(async (entry: WorkbookLedgerEntry) => {
        if (!entry.id) return;

        const result = await Swal.fire({
            title: '?????? ???',
            text: `${entry.date} / ${formatNumber(entry.paymentAmount)}???????????????????????`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: '???',
            cancelButtonText: '???'
        });

        if (!result.isConfirmed) return;

        setReceiptActionLoading(true);
        try {
            await workbookLedgerService.softDeleteEntry(entry.id, currentUser?.uid ?? '');
            await refreshPageData();
            setEditingReceiptDraft((prev) => (prev?.id === entry.id ? null : prev));
            Swal.fire('??? ???', '?????????????????.', 'success');
        } catch (error) {
            console.error(error);
            Swal.fire('???', '?????? ??????????????.', 'error');
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
            Swal.fire('???', '???????? ??? ??? ????????.', 'info');
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
            Swal.fire('???', '????????????? ????????.', 'info');
            return;
        }

        const currentAmount = currentEntry.paymentAmount ?? 0;
        const maxAmount = Math.max((sourceEntry.totalAmount ?? 0) - (linkedTotal - currentAmount), 0);

        if (!normalizedDate) {
            Swal.fire('??? ???', `${labels.date}??????????`, 'warning');
            return;
        }

        if (paymentAmount <= 0) {
            Swal.fire('??? ???', `${labels.amount}?? 0??? ??? ?????`, 'warning');
            return;
        }

        if (paymentAmount > maxAmount) {
            Swal.fire('??? ???', `??? ???????? ${labels.outstanding} ?????????????`, 'warning');
            return;
        }

        setReceiptActionLoading(true);
        try {
            await workbookLedgerService.updateEntry(editingReceiptDraft.id, {
                date: normalizedDate,
                paymentAmount,
                note: normalizeText(editingReceiptDraft.note),
                updatedBy: currentUser?.uid ?? ''
            });

            await refreshPageData();
            setEditingReceiptDraft(null);
            Swal.fire('??? ???', `${labels.history}???????????.`, 'success');
        } catch (error) {
            console.error(error);
            Swal.fire('???', `${labels.history} ??????????????.`, 'error');
        } finally {
            setReceiptActionLoading(false);
        }
    }, [currentUser?.uid, editingReceiptDraft, entries, receiptHistoryTargetId, refreshPageData, summaryFilter]);

    const handleDeleteSettlement = useCallback(async (entry: WorkbookLedgerEntry) => {
        if (!entry.id) return;

        const labels = getSettlementLabels(entry.transactionType);
        const result = await Swal.fire({
            title: `${labels.history} ???`,
            text: `${entry.date} / ${formatNumber(entry.paymentAmount)}??${labels.history}???????????????`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: '???',
            cancelButtonText: '???'
        });

        if (!result.isConfirmed) return;

        setReceiptActionLoading(true);
        try {
            await workbookLedgerService.softDeleteEntry(entry.id, currentUser?.uid ?? '');
            await refreshPageData();
            setEditingReceiptDraft((prev) => (prev?.id === entry.id ? null : prev));
            Swal.fire('??? ???', `${labels.history}???????????.`, 'success');
        } catch (error) {
            console.error(error);
            Swal.fire('???', `${labels.history} ??????????????.`, 'error');
        } finally {
            setReceiptActionLoading(false);
        }
    }, [currentUser?.uid, refreshPageData]);

    const applyLedgerFilter = useCallback(() => {
        setLedgerFilter({ ...ledgerDraft });
    }, [ledgerDraft]);

    const applySummaryFilter = useCallback(() => {
        const draft = {
            ...summaryDraft,
            startDate: normalizeDate(summaryDraft.startDate) || defaultLedgerStart,
            endDate: normalizeDate(summaryDraft.endDate) || todayString
        };

        const startDate = draft.startDate;
        const endDate = draft.endDate;

        if (!startDate || !endDate) {
            Swal.fire('??? ???', '?????? ?????? ???????????? ??????????', 'warning');
            return;
        }

        setSummaryFilter(
            startDate <= endDate
                ? draft
                : {
                    ...draft,
                    startDate: draft.endDate,
                    endDate: draft.startDate
                }
        );
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

    const canRegisterReceipt = summaryFilter.mode === '????? || summaryFilter.mode === '??????';
    const canOpenReceiptHistory = canRegisterReceipt;
    const summarySettlementType: WorkbookTransactionType = summaryFilter.mode === '???' || summaryFilter.mode === '??????' ? '???' : '???';
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
            Swal.fire('???', '???????? ????? ??????.', 'info');
            return;
        }

        const transactionAmountLabel = ledgerFilter.transactionType === '???' ? '??????' : '??????';
        const paymentAmountLabel = ledgerFilter.transactionType === '???' ? '??????' : '???????;
        const title = ledgerFilter.partnerName || `${ledgerFilter.transactionType} ?????;
        const filterItems = [
            ['??? ???', `${ledgerFilter.startDate} ~ ${ledgerFilter.endDate}`],
            ['???', ledgerFilter.transactionType],
            ['????, ledgerFilter.teamName || '???'],
            ['?????, ledgerFilter.partnerName || '???'],
            ['?????, ledgerFilter.siteName || '???'],
            ['???', `${ledgerRows.length.toLocaleString()}??]
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
                <td>???</td>
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
            Swal.fire('???', '??? ??????????????????.', 'error');
            return;
        }

        const printableHtml = `
            <!DOCTYPE html>
            <html lang="ko">
                <head>
                    <meta charset="utf-8" />
                    <title>${escapeHtml(title)} ???</title>
                    <style>
                        @page {
                            size: A4 landscape;
                            margin: 12mm;
                        }

                        * {
                            box-sizing: border-box;
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
                            background: #2e75b6;
                            color: #ffffff;
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
                            background: #eff6ff;
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
                        <table>
                            ${ledgerPrintColGroup}
                            <thead>
                                <tr>
                                    <th>???</th>
                                    <th>??????</th>
                                    <th>???</th>
                                    <th>${escapeHtml(transactionAmountLabel)}</th>
                                    <th>${escapeHtml(paymentAmountLabel)}</th>
                                    <th>???</th>
                                    <th>?????/th>
                                    <th>???</th>
                                    <th>????/th>
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
                Swal.fire('???', '??? ??? ??????? ?????????.', 'error');
            }
        }, 150);
    }, [ledgerFilter, ledgerRows, ledgerTotals]);

    const handlePrintSummary = useCallback(() => {
        if (summaryRows.length === 0) {
            Swal.fire('???', '???????? ????? ??????.', 'info');
            return;
        }

        const paymentDateLabel = summarySettlementLabels.date;
        const settledAmountLabel = summarySettlementLabels.amount;
        const outstandingLabel = summarySettlementLabels.outstanding;
        const countText = `${summaryRows.length.toLocaleString()}??;
        const dateRangeLabel = summaryFilter.mode === '???' || summaryFilter.mode === '???'
            ? '????????'
            : `${paymentDateLabel} ???`;
        const filterItems = [
            [dateRangeLabel, `${summaryFilter.startDate} ~ ${summaryFilter.endDate}`],
            ['???', summaryFilter.mode],
            ['????, summaryFilter.teamName || '???'],
            ['?????, summaryFilter.partnerName || '???'],
            ['?????, summaryFilter.siteName || '???'],
            ['???', countText]
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
                <td>???</td>
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
            Swal.fire('???', '??? ??????????????????.', 'error');
            return;
        }

        const printableHtml = `
            <!DOCTYPE html>
            <html lang="ko">
                <head>
                    <meta charset="utf-8" />
                    <title>??? ??? ???</title>
                    <style>
                        @page {
                            size: A4 landscape;
                            margin: 12mm;
                        }

                        * {
                            box-sizing: border-box;
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
                            background: #ffd966;
                            color: #111827;
                            font-weight: 700;
                            white-space: nowrap;
                        }

                        .summary-total-row td {
                            background: #f8fafc;
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
                            <h1>??? ???</h1>
                            <p>??? ??? ?????? ????? ?????????????</p>
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
                                    <th>??????</th>
                                    <th>?????/th>
                                    <th>?????/th>
                                    <th>???????/th>
                                    <th>???</th>
                                    <th>???</th>
                                    <th>${escapeHtml(paymentDateLabel)}</th>
                                    <th>${escapeHtml(settledAmountLabel)}</th>
                                    <th>${escapeHtml(outstandingLabel)}</th>
                                    <th>???</th>
                                    <th>????/th>
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
                    Swal.fire('???', '??? ??????????? ??????? ?????????.', 'error');
                }
            }, 150);
        };

        window.setTimeout(() => {
            if (iframe.parentNode) {
                cleanup();
            }
        }, 60000);
    }, [summaryFilter, summaryRows, summarySettlementLabels, summaryTotals]);

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
        return `${baseLabel} ${dbSort.direction === 'asc' ? '?? : '??}`;
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

    const inputColumns = useMemo<any[]>(() => [
        { data: 'transactionType', type: 'dropdown', source: ['???', '???'], width: 88 },
        { data: 'date', type: 'date', dateFormat: 'YYYY-MM-DD', correctFormat: true, width: 118 },
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
        { data: 'teamName', type: 'text', readOnly: true, width: 112 }
    ], [partnerNames, siteNames]);

    const inputColHeaders = useMemo(() => ([
        '???',
        '???',
        '??????',
        '?????,
        '???',
        '???',
        '???????,
        '??????,
        '???',
        '??????',
        '??????',
        '?????,
        '???',
        '????
    ]), []);

    const inputCells = useCallback((_row: number, column: number) => {
        const cellProperties: Record<string, unknown> = {};
        if ([5, 6, 7, 8, 9, 10, 11].includes(column)) {
            cellProperties.className = 'htRight';
        }
        if ([7, 8, 10, 13].includes(column)) {
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
                        <th className="sheet-title-dark" colSpan={14}>???????? ???</th>
                    </tr>
                    <tr>
                        <th className="sheet-label-yellow">?? ??/th>
                        <td className="sheet-value" colSpan={2}>
                            <input
                                list="workbook-team-options"
                                value={selectedTeam}
                                onChange={(event) => setSelectedTeam(event.target.value)}
                                placeholder="??????? ??? ???"
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
                                DB ???
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
                                ???(RESET)
                            </button>
                        </td>
                    </tr>
                    <tr>
                        <th className="sheet-label-yellow">??????</th>
                        <td className="sheet-value" colSpan={2}>
                            <input
                                type="number"
                                min={2000}
                                max={2100}
                                value={baseYear}
                                onChange={(event) => setBaseYear(Number(event.target.value) || currentYear)}
                            />
                        </td>
                        <td className="sheet-spacer" colSpan={11} />
                    </tr>
                </tbody>
            </table>

            <div className="input-grid-shell workbook-input-grid">
                <HotTable
                    ref={hotRef}
                    data={inputRows}
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
                    afterChange={handleInputGridChange}
                    copyPaste={true}
                    outsideClickDeselects={false}
                    className="excel-handsontable"
                    cells={inputCells}
                />
            </div>

            <p className="workbook-help-text">
                ???????????????? ???????????? ????? ??? ??????, ???????? ????? ??? ???????? ????????
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
                        <th className="sheet-label-green">???????/th>
                        <td className="sheet-value-light">{entries.length.toLocaleString()}??/td>
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
                                    {getDbSortLabel('date', '?????)}
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
                                    {getDbSortLabel('partnerName', '?????)}
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
                                    {getDbSortLabel('amount', '?????)}
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
                                ??? ?????                            </button>
                        </td>
                        <td className="sheet-button-wrap" colSpan={2}>
                            <button
                                type="button"
                                className="excel-button excel-button-blue"
                                onClick={handleOpenDbUpload}
                                disabled={uploadingDb || downloadingDb}
                            >
                                <FontAwesomeIcon icon={uploadingDb ? faSpinner : faUpload} spin={uploadingDb} />
                                DB ?????                            </button>
                        </td>
                        <td className="sheet-button-wrap" colSpan={2}>
                            <button
                                type="button"
                                className="excel-button excel-button-green"
                                onClick={handleDownloadDb}
                                disabled={uploadingDb || downloadingDb || entries.length === 0}
                            >
                                <FontAwesomeIcon icon={downloadingDb ? faSpinner : faDownload} spin={downloadingDb} />
                                DB ??????
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
                                {`??????${selectedDbEntryIds.length > 0 ? ` (${selectedDbEntryIds.length})` : ''}`}
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
                                DB ?????                            </button>
                        </td>
                    </tr>
                </tbody>
            </table>

            <div className="workbook-help-text">
                ????? ???????????????? ???????? ??????????????????/????? ??? ??????????? ??????.
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
                                    <option value="">???</option>
                                    <option value="???">???</option>
                                    <option value="???">???</option>
                                </select>
                            </th>
                            <th>
                                <input
                                    className="workbook-filter-input"
                                    type="text"
                                    value={dbFilter.date}
                                    onChange={(event) => handleChangeDbFilter('date', event.target.value)}
                                    placeholder="???"
                                />
                            </th>
                            <th>
                                <input
                                    className="workbook-filter-input"
                                    type="text"
                                    value={dbFilter.partnerName}
                                    onChange={(event) => handleChangeDbFilter('partnerName', event.target.value)}
                                    placeholder="??????"
                                />
                            </th>
                            <th>
                                <input
                                    className="workbook-filter-input"
                                    type="text"
                                    value={dbFilter.siteName}
                                    onChange={(event) => handleChangeDbFilter('siteName', event.target.value)}
                                    placeholder="?????
                                />
                            </th>
                            <th>
                                <input
                                    className="workbook-filter-input"
                                    type="text"
                                    value={dbFilter.description}
                                    onChange={(event) => handleChangeDbFilter('description', event.target.value)}
                                    placeholder="???"
                                />
                            </th>
                            <th>
                                <input
                                    className="workbook-filter-input"
                                    type="text"
                                    value={dbFilter.supplyAmount}
                                    onChange={(event) => handleChangeDbFilter('supplyAmount', event.target.value)}
                                    placeholder="???????
                                />
                            </th>
                            <th>
                                <input
                                    className="workbook-filter-input"
                                    type="text"
                                    value={dbFilter.taxAmount}
                                    onChange={(event) => handleChangeDbFilter('taxAmount', event.target.value)}
                                    placeholder="??????
                                />
                            </th>
                            <th>
                                <input
                                    className="workbook-filter-input"
                                    type="text"
                                    value={dbFilter.totalAmount}
                                    onChange={(event) => handleChangeDbFilter('totalAmount', event.target.value)}
                                    placeholder="???"
                                />
                            </th>
                            <th>
                                <input
                                    className="workbook-filter-input"
                                    type="text"
                                    value={dbFilter.paymentAmount}
                                    onChange={(event) => handleChangeDbFilter('paymentAmount', event.target.value)}
                                    placeholder="??????"
                                />
                            </th>
                            <th>
                                <input
                                    className="workbook-filter-input"
                                    type="text"
                                    value={dbFilter.appliedYear}
                                    onChange={(event) => handleChangeDbFilter('appliedYear', event.target.value)}
                                    placeholder="???"
                                />
                            </th>
                            <th>
                                <input
                                    className="workbook-filter-input"
                                    type="text"
                                    value={dbFilter.appliedMonth}
                                    onChange={(event) => handleChangeDbFilter('appliedMonth', event.target.value)}
                                    placeholder="??
                                />
                            </th>
                            <th>
                                <input
                                    className="workbook-filter-input"
                                    type="text"
                                    value={dbFilter.note}
                                    onChange={(event) => handleChangeDbFilter('note', event.target.value)}
                                    placeholder="???"
                                />
                            </th>
                            <th>
                                <input
                                    className="workbook-filter-input"
                                    type="text"
                                    value={dbFilter.teamName}
                                    onChange={(event) => handleChangeDbFilter('teamName', event.target.value)}
                                    placeholder="????
                                />
                            </th>
                            <th className="workbook-filter-spacer" />
                            <th className="workbook-filter-spacer" />
                        </tr>
                    </thead>
                    <tbody>
                        {databaseDisplayRows.length === 0 && (
                            <tr>
                                <td colSpan={17} className="sheet-empty-state">????? DB ?????? ??????.</td>
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
                                                value={dbDraft?.transactionType ?? '???'}
                                                onChange={(event) => handleChangeEditingDbDraft('transactionType', event.target.value)}
                                                disabled={dbActionLoading}
                                            >
                                                <option value="???">???</option>
                                                <option value="???">???</option>
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
                                                ? <span className="workbook-linked-badge">??? {visibleLinkedEntries.length}??/span>
                                                : '-'
                                        ) : canToggleDetails ? (
                                            <button
                                                type="button"
                                                className="workbook-toolbar-button workbook-inline-button"
                                                onClick={() => handleToggleDbEntryDetails(entry.id!)}
                                                disabled={dbActionLoading}
                                            >
                                                {isExpanded ? '???' : `??? ${linkedEntries.length}??}
                                            </button>
                                        ) : (
                                            nested
                                                ? <span className="workbook-linked-badge">??????</span>
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
                                                        ????                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="workbook-toolbar-button workbook-inline-button"
                                                        onClick={handleCancelEditDbEntry}
                                                        disabled={dbActionLoading}
                                                    >
                                                        ???
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
                                                        ???
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="workbook-toolbar-button workbook-inline-button workbook-danger-button"
                                                        onClick={() => handleDeleteDbEntry(entry)}
                                                        disabled={dbActionLoading}
                                                    >
                                                        <FontAwesomeIcon icon={faTrashCan} />
                                                        ???
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
                        ??? 100??                    </button>
                    <span className="workbook-pagination-status">
                        {`${dbPage} / ${totalDbPages} ?????`}
                    </span>
                    <button
                        type="button"
                        className="workbook-toolbar-button workbook-pagination-button"
                        onClick={() => handleMoveDbPage('next')}
                        disabled={dbPage >= totalDbPages}
                    >
                        ??? 100??                    </button>
                </div>
            )}

            <p className="workbook-help-text">
                ????????????? ??? ??? ?????? ????????/??????? DB????? ????????. ???????? ??? ??? ?????? ??? ??? ???, ??? ?????? ???/?????????????.
            </p>
        </section>
    );

    const renderLedgerTab = () => (
        <section className="workbook-sheet">
            <div ref={ledgerCaptureRef}>
                <table className="sheet-control-table query-sheet-table workbook-summary-filter-table">
                    <tbody>
                        <tr>
                            <th className="sheet-title-dark" colSpan={16}>???/??? ?????/th>
                        </tr>
                        <tr>
                            <th className="sheet-label-blue">????????</th>
                            <td className="sheet-value sheet-filter-date-cell" colSpan={2}>
                                <input
                                    type="date"
                                    className="sheet-filter-input"
                                    value={ledgerDraft.startDate}
                                    onChange={(event) => setLedgerDraft((prev) => ({ ...prev, startDate: event.target.value }))}
                                />
                            </td>
                            <th className="sheet-label-blue">????????</th>
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
                                    onClick={() => handleCopyCapture('ledger', ledgerCaptureRef.current, '?????)}
                                    disabled={capturingView === 'ledger'}
                                >
                                    <FontAwesomeIcon icon={capturingView === 'ledger' ? faSpinner : faCopy} spin={capturingView === 'ledger'} />
                                    ??? ???
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
                                    ???
                                </button>
                            </td>
                            <td className="sheet-button-wrap sheet-button-stack" colSpan={2}>
                                <button type="button" className="excel-button excel-button-green" onClick={applyLedgerFilter}>
                                    <FontAwesomeIcon icon={faMagnifyingGlass} />
                                    ???
                                </button>
                            </td>
                        </tr>
                        <tr>
                            <th className="sheet-label-green">?? ??/th>
                            <td className="sheet-value-light">
                                <input
                                    className="sheet-filter-input"
                                    list="workbook-team-options"
                                    value={ledgerDraft.teamName}
                                    onChange={(event) => setLedgerDraft((prev) => ({ ...prev, teamName: event.target.value }))}
                                    placeholder="???"
                                />
                            </td>
                            <th className="sheet-label-green">????/th>
                            <td className="sheet-value-light">
                                <select
                                    className="sheet-filter-input"
                                    value={ledgerDraft.transactionType}
                                    onChange={(event) => setLedgerDraft((prev) => ({
                                        ...prev,
                                        transactionType: event.target.value as WorkbookTransactionType
                                    }))}
                                >
                                    <option value="???">???</option>
                                    <option value="???">???</option>
                                </select>
                            </td>
                            <th className="sheet-label-green">?????/th>
                            <td className="sheet-value-light sheet-filter-wide-cell" colSpan={2}>
                                <input
                                    className="sheet-filter-input"
                                    list="workbook-partner-options"
                                    value={ledgerDraft.partnerName}
                                    onChange={(event) => setLedgerDraft((prev) => ({ ...prev, partnerName: event.target.value }))}
                                    placeholder="????????"
                                />
                            </td>
                            <th className="sheet-label-green">?????/th>
                            <td className="sheet-value-light sheet-filter-wide-cell" colSpan={2}>
                                <input
                                    className="sheet-filter-input"
                                    list="workbook-site-options"
                                    value={ledgerDraft.siteName}
                                    onChange={(event) => setLedgerDraft((prev) => ({ ...prev, siteName: event.target.value }))}
                                    placeholder="??? ???"
                                />
                            </td>
                            <td className="sheet-spacer sheet-filter-count-cell" colSpan={6}>
                                <div className="sheet-button-count">{entries.length.toLocaleString()}??/div>
                            </td>
                        </tr>
                    </tbody>
                </table>

                <div className="sheet-merged-heading">
                    {ledgerFilter.partnerName || `${ledgerFilter.transactionType} ?????}
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
                                <th>???</th>
                                <th>??????</th>
                                <th>???</th>
                                <th>{ledgerFilter.transactionType === '???' ? '??????' : '??????'}</th>
                                <th>{ledgerFilter.transactionType === '???' ? '??????' : '???????}</th>
                                <th>???</th>
                                <th>?????/th>
                                <th>???</th>
                                <th>????/th>
                            </tr>
                        </thead>
                        <tbody>
                            {ledgerRows.length === 0 && (
                                <tr>
                                    <td colSpan={9} className="sheet-empty-state">??? ????? ??????.</td>
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
                                <td>???</td>
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
                            <th className="sheet-title-dark" colSpan={16}>??? ???</th>
                        </tr>
                        <tr>
                            <th className="sheet-label-blue">????????</th>
                            <td className="sheet-value sheet-filter-date-cell" colSpan={2}>
                                <input
                                    type="date"
                                    className="sheet-filter-input"
                                    value={summaryDraft.startDate}
                                    onChange={(event) => setSummaryDraft((prev) => ({ ...prev, startDate: event.target.value }))}
                                />
                            </td>
                            <th className="sheet-label-blue">????????</th>
                            <td className="sheet-value sheet-filter-date-cell" colSpan={2}>
                                <input
                                    type="date"
                                    className="sheet-filter-input"
                                    value={summaryDraft.endDate}
                                    onChange={(event) => setSummaryDraft((prev) => ({ ...prev, endDate: event.target.value }))}
                                />
                            </td>
                            <td className="sheet-spacer" colSpan={6} />
                            <td className="sheet-button-wrap" colSpan={2}>
                                <button
                                    type="button"
                                    className="excel-button excel-button-blue"
                                    onClick={() => handleCopyCapture('summary', summaryCaptureRef.current, '??? ???')}
                                    disabled={capturingView === 'summary'}
                                >
                                    <FontAwesomeIcon icon={capturingView === 'summary' ? faSpinner : faCopy} spin={capturingView === 'summary'} />
                                    ??? ???
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
                                    ???
                                </button>
                            </td>
                            <td className="sheet-button-wrap sheet-button-stack" colSpan={2}>
                                <button type="button" className="excel-button excel-button-green" onClick={applySummaryFilter}>
                                    <FontAwesomeIcon icon={faMagnifyingGlass} />
                                    ???
                                </button>
                            </td>
                        </tr>
                        <tr>
                            <th className="sheet-label-green">?? ??/th>
                            <td className="sheet-value-light">
                                <input
                                    className="sheet-filter-input"
                                    list="workbook-team-options"
                                    value={summaryDraft.teamName}
                                    onChange={(event) => setSummaryDraft((prev) => ({ ...prev, teamName: event.target.value }))}
                                    placeholder="???"
                                />
                            </td>
                            <th className="sheet-label-green">????/th>
                            <td className="sheet-value-light">
                                <select
                                    className="sheet-filter-input"
                                    value={summaryDraft.mode}
                                    onChange={(event) => setSummaryDraft((prev) => ({ ...prev, mode: event.target.value as SummaryMode }))}
                                >
                                    <option value="???">???</option>
                                    <option value="???">???</option>
                                    <option value="?????>?????/option>
                                    <option value="??????">??????</option>
                                </select>
                            </td>
                            <th className="sheet-label-green">?????/th>
                            <td className="sheet-value-light sheet-filter-wide-cell" colSpan={2}>
                                <input
                                    className="sheet-filter-input"
                                    list="workbook-partner-options"
                                    value={summaryDraft.partnerName}
                                    onChange={(event) => setSummaryDraft((prev) => ({ ...prev, partnerName: event.target.value }))}
                                    placeholder="????????"
                                />
                            </td>
                            <th className="sheet-label-green">?????/th>
                            <td className="sheet-value-light sheet-filter-wide-cell" colSpan={2}>
                                <input
                                    className="sheet-filter-input"
                                    list="workbook-site-options"
                                    value={summaryDraft.siteName}
                                    onChange={(event) => setSummaryDraft((prev) => ({ ...prev, siteName: event.target.value }))}
                                    placeholder="??? ???"
                                />
                            </td>
                            <td className="sheet-spacer sheet-filter-count-cell" colSpan={6}>
                                <div className="sheet-button-count">{entries.length.toLocaleString()}??/div>
                            </td>
                        </tr>
                    </tbody>
                </table>

                <div className="sheet-table-wrapper workbook-frozen-table-wrapper">
                    <table className="sheet-table workbook-summary-table">
                        <colgroup>
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
                                <th>No</th>
                                <th>??????</th>
                                <th>?????/th>
                                <th>?????/th>
                                <th>???????/th>
                                <th>???</th>
                                <th>???</th>
                                <th>{summaryFilter.mode === '???' || summaryFilter.mode === '??????' ? '?????' : '?????}</th>
                                <th>{summaryFilter.mode === '???' || summaryFilter.mode === '??????' ? '??????? : '??????'}</th>
                                <th>{summaryFilter.mode === '???' || summaryFilter.mode === '??????' ? '??????' : '?????}</th>
                                <th>???</th>
                                <th>????/th>
                                {canRegisterReceipt && <th>???</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {summaryRows.length === 0 && (
                                <tr>
                                    <td colSpan={canRegisterReceipt ? 13 : 12} className="sheet-empty-state">??? ????? ??????.</td>
                                </tr>
                            )}
                            {summaryRows.map((row, index) => (
                                <tr key={row.id}>
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
                                                        ???
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
                                <td>???</td>
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
        <div className="workbook-ledger-page">
            <div className="workbook-shell">
                <div className="workbook-titlebar">
                    <div>
                        <h1>?????? Pro Ver 2.5 (???)</h1>
                        <p>??? ?????? UI?????????? ??? ??? ??? ??????????</p>
                    </div>
                    <div className="workbook-title-actions">
                        <button
                            type="button"
                            className="workbook-toolbar-button"
                            onClick={() => refreshPageData({ forceEntries: true, forceCatalogs: true })}
                            disabled={loading}
                        >
                            <FontAwesomeIcon icon={loading ? faSpinner : faRotateRight} spin={loading} />
                            ??????
                        </button>
                    </div>
                </div>

                <div className="workbook-tabs" role="tablist" aria-label="Workbook tabs">
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

                {receiptHistoryTargetId && (
                    <div className="workbook-modal-overlay" onClick={handleCloseReceiptHistory}>
                        <div className="workbook-modal" onClick={(event) => event.stopPropagation()}>
                            <div className="workbook-modal-header">
                                <div>
                                    <h2>{receiptHistoryLabels.history}</h2>
                                    <p>?????{receiptHistoryLabels.outstanding} ??? ?????{receiptHistoryLabels.history}??????????????????</p>
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
                                        <div><strong>?????/strong><span>{receiptHistoryInvoice.partnerName}</span></div>
                                        <div><strong>?????/strong><span>{receiptHistoryInvoice.siteName || '-'}</span></div>
                                        <div><strong>?????/strong><span>{receiptHistoryInvoice.date}</span></div>
                                        <div><strong>???</strong><span>{formatNumber(receiptHistoryInvoice.totalAmount)}??/span></div>
                                        <div><strong>{receiptHistoryLabels.cumulative}</strong><span>{formatNumber(receiptHistoryTotal)}??/span></div>
                                        <div><strong>{receiptHistoryLabels.outstanding}</strong><span>{formatNumber(receiptHistoryOutstanding)}??/span></div>
                                    </div>

                                    <div className="workbook-editor-card">
                                        <div className="workbook-editor-header">
                                            <h3>??? ??/h3>
                                        </div>

                                        <div className="sheet-table-wrapper compact">
                                            <table className="sheet-table">
                                                <thead>
                                                    <tr>
                                                        <th>???</th>
                                                        <th>???</th>
                                                        <th>?????/th>
                                                        <th>???</th>
                                                        <th>???????/th>
                                                        <th>???</th>
                                                        <th>???</th>
                                                        <th>{receiptHistoryLabels.amount}</th>
                                                        <th>???</th>
                                                        <th>????/th>
                                                        <th>???</th>
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
                                                                    ???
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    className="workbook-toolbar-button workbook-inline-button workbook-danger-button"
                                                                    onClick={() => handleDeleteDbEntry(receiptHistoryInvoice)}
                                                                    disabled={dbActionLoading || receiptActionLoading}
                                                                >
                                                                    <FontAwesomeIcon icon={faTrashCan} />
                                                                    ???
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
                                            ??? ?????? ??? {formatNumber(legacyMatchedGap)}??? ??? ??????????? ??? ????????/?????????????.
                                        </div>
                                    )}

                                    <div className="sheet-table-wrapper compact">
                                        <table className="sheet-table">
                                            <thead>
                                                <tr>
                                                    <th>{receiptHistoryLabels.date}</th>
                                                    <th>{receiptHistoryLabels.amount}</th>
                                                    <th>???</th>
                                                    <th>???</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {receiptHistoryOriginalPaymentAmount <= 0 && receiptHistoryEntries.length === 0 && (
                                                    <tr>
                                                        <td colSpan={4} className="sheet-empty-state">?????{receiptHistoryLabels.history}????????.</td>
                                                    </tr>
                                                )}
                                                {receiptHistoryInvoice && receiptHistoryOriginalPaymentAmount > 0 && (
                                                    <tr key={`original-${receiptHistoryInvoice.id ?? receiptHistoryInvoice.date}`}>
                                                        <td>{receiptHistoryInvoice.date}</td>
                                                        <td className="align-right">{formatNumber(receiptHistoryOriginalPaymentAmount)}</td>
                                                        <td>{receiptHistoryInvoice.note || '??? ???????}</td>
                                                        <td>
                                                            <div className="workbook-inline-actions">
                                                                <button
                                                                    type="button"
                                                                    className="workbook-toolbar-button workbook-inline-button"
                                                                    onClick={() => handleEditDbEntry(receiptHistoryInvoice)}
                                                                    disabled={dbActionLoading || receiptActionLoading}
                                                                >
                                                                    <FontAwesomeIcon icon={faPenToSquare} />
                                                                    ??????
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    className="workbook-toolbar-button workbook-inline-button workbook-danger-button"
                                                                    onClick={() => handleDeleteDbEntry(receiptHistoryInvoice)}
                                                                    disabled={dbActionLoading || receiptActionLoading}
                                                                >
                                                                    <FontAwesomeIcon icon={faTrashCan} />
                                                                    ??????
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
                                                                    ???
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    className="workbook-toolbar-button workbook-inline-button workbook-danger-button"
                                                                    onClick={() => handleDeleteSettlement(entry)}
                                                                    disabled={receiptActionLoading}
                                                                >
                                                                    <FontAwesomeIcon icon={faTrashCan} />
                                                                    ???
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
                                            <h3>{receiptHistoryLabels.history} ???</h3>
                                            {editingReceiptDraft && (
                                                <button
                                                    type="button"
                                                    className="workbook-toolbar-button workbook-inline-button"
                                                    onClick={handleCancelEditReceipt}
                                                    disabled={receiptActionLoading}
                                                >
                                                    ???
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
                                                    <span>???</span>
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
                                                        ??? ????                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="sheet-empty-state">?????{receiptHistoryLabels.history}??????????</div>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <div className="sheet-empty-state">???????????? ????????.</div>
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
