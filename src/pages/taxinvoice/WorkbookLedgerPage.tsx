import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HotTable } from '@handsontable/react';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/dist/handsontable.full.min.css';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import Swal from 'sweetalert2';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faCopy,
    faDownload,
    faDatabase,
    faMagnifyingGlass,
    faPenToSquare,
    faRotateRight,
    faSpinner,
    faTableCellsLarge,
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

interface LedgerFilter {
    startDate: string;
    endDate: string;
    teamName: string;
    transactionType: WorkbookTransactionType;
    partnerName: string;
    siteName: string;
}

interface SummaryFilter {
    startYear: number;
    startMonth: number;
    startDay: number;
    endYear: number;
    endMonth: number;
    endDay: number;
    teamName: string;
    mode: SummaryMode;
    partnerName: string;
    siteName: string;
}

interface LedgerRow {
    id: string;
    date: string;
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

const INPUT_ROW_COUNT = 80;
const DEFAULT_LEDGER_START = '2019-01-01';
const WORKBOOK_TABS: Array<{ id: WorkbookTab; label: string }> = [
    { id: 'input', label: '입력폼' },
    { id: 'database', label: 'DB' },
    { id: 'ledger', label: '조회(매출,매입거래장)' },
    { id: 'summary', label: '전체 조회' }
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
    '팀명'
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
const escapeHtml = (value: string) => value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const normalizeTransactionType = (value: unknown): WorkbookTransactionType | null => {
    const text = normalizeText(value);
    if (text.includes('매입')) return '매입';
    if (text.includes('매출')) return '매출';
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

const buildDateFromParts = (year: number, month: number, day: number) => {
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return '';
    if (month < 1 || month > 12 || day < 1 || day > 31) return '';

    const candidate = new Date(year, month - 1, day);
    if (
        candidate.getFullYear() !== year ||
        candidate.getMonth() !== month - 1 ||
        candidate.getDate() !== day
    ) {
        return '';
    }

    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const getMonthEndDate = (year: number, month: number) => {
    return formatDateInput(new Date(year, month, 0));
};

const getPeriodCode = (year: number | null, month: number | null) => {
    if (!year || !month) return null;
    return year * 100 + month;
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

    const requiredHeaders = ['구분', '날짜', '거래처명'];
    const hasRequiredHeaders = requiredHeaders.every((header) => headerIndex.has(header));

    if (!hasRequiredHeaders) {
        throw new Error('업로드 파일에서 DB 헤더를 찾지 못했습니다. DB 시트 또는 동일한 헤더 형식의 파일을 올려주세요.');
    }

    const readCell = (row: unknown[], header: string) => {
        const index = headerIndex.get(header);
        return index === undefined ? '' : row[index];
    };

    const entries: Omit<WorkbookLedgerEntry, 'id' | 'createdAt' | 'updatedAt'>[] = [];
    let skipped = 0;

    rows.slice(1).forEach((row) => {
        const transactionType = normalizeTransactionType(readCell(row, '구분'));
        const date = normalizeDate(readCell(row, '날짜'));
        const partnerName = normalizeText(readCell(row, '거래처명'));
        const siteName = normalizeText(readCell(row, '현장명'));
        const description = normalizeText(readCell(row, '내용'));
        const manDays = headerIndex.has('공수') ? toNumberOrNull(readCell(row, '공수')) : null;
        const supplyAmount = toNumberOrNull(readCell(row, '공급가액')) ?? 0;
        const taxAmount = toNumberOrNull(readCell(row, '부가세')) ?? 0;
        const totalAmount = toNumberOrNull(readCell(row, '합계')) ?? 0;
        const paymentAmount = toNumberOrNull(readCell(row, '입금금액')) ?? 0;
        const appliedYear = toNumberOrNull(readCell(row, '적용연도')) ?? getYearFromDate(date) ?? fallbackYear;
        const appliedMonth = toNumberOrNull(readCell(row, '적용월')) ?? getMonthFromDate(date);
        const matchedEntryId = normalizeText(readCell(row, '매칭매출ID'));
        const note = normalizeText(readCell(row, '비고'));
        const teamName = normalizeText(readCell(row, '팀명')) || fallbackTeamName;

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

const matchesFilter = (source: string | undefined, keyword: string) => {
    if (!keyword.trim()) return true;
    return (source ?? '').toLowerCase().includes(keyword.trim().toLowerCase());
};

const isInvoiceEntry = (entry: WorkbookLedgerEntry) => (entry.totalAmount ?? 0) > 0;
const isPaymentEntry = (entry: WorkbookLedgerEntry) => (entry.paymentAmount ?? 0) > 0;

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

const buildSummaryRows = (entries: WorkbookLedgerEntry[], filter: SummaryFilter): SummaryRow[] => {
    const transactionType: WorkbookTransactionType = filter.mode === '매입' || filter.mode === '미지급금' ? '매입' : '매출';
    const startDate = buildDateFromParts(filter.startYear, filter.startMonth, filter.startDay);
    const endDate = buildDateFromParts(filter.endYear, filter.endMonth, filter.endDay);

    if (!startDate || !endDate) return [];

    const invoiceEntries = entries
        .filter((entry) => entry.transactionType === transactionType)
        .filter(isInvoiceEntry)
        .filter((entry) => entry.date >= startDate && entry.date <= endDate)
        .filter((entry) => matchesFilter(entry.teamName, filter.teamName))
        .filter((entry) => matchesFilter(entry.partnerName, filter.partnerName))
        .filter((entry) => matchesFilter(entry.siteName, filter.siteName))
        .sort(sortWorkbookEntries);

    type WorkingSummaryRow = SummaryRow & { remainingAmount: number };
    const invoices = invoiceEntries
        .map((entry) => ({
            id: entry.id ?? `${entry.date}-${entry.partnerName}-${entry.description}`,
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

    const invoiceById = new Map<string, WorkingSummaryRow>();
    invoices.forEach((invoice) => {
        invoiceById.set(invoice.id, invoice);
    });

    const invoicesByPartner = new Map<string, WorkingSummaryRow[]>();
    invoices.forEach((invoice) => {
        const bucket = invoicesByPartner.get(invoice.partnerName) ?? [];
        bucket.push(invoice);
        invoicesByPartner.set(invoice.partnerName, bucket);
    });

    const paymentEntries = entries
        .filter((entry) => entry.transactionType === transactionType)
        .filter(isPaymentEntry)
        .filter((entry) => entry.date <= endDate)
        .filter((entry) => matchesFilter(entry.teamName, filter.teamName))
        .filter((entry) => matchesFilter(entry.partnerName, filter.partnerName))
        .filter((entry) => matchesFilter(entry.siteName, filter.siteName))
        .sort(sortWorkbookEntries);

    const applyPaymentToInvoice = (invoice: WorkingSummaryRow, paymentAmount: number, paymentDate: string) => {
        if (paymentAmount <= 0 || invoice.remainingAmount <= 0) return paymentAmount;

        const appliedAmount = Math.min(invoice.remainingAmount, paymentAmount);
        invoice.settledAmount += appliedAmount;
        invoice.remainingAmount -= appliedAmount;
        invoice.outstandingAmount = invoice.remainingAmount;
        if (paymentDate && !invoice.paymentDates.includes(paymentDate)) {
            invoice.paymentDates = [...invoice.paymentDates, paymentDate].sort((left, right) => left.localeCompare(right, 'en'));
        }

        return paymentAmount - appliedAmount;
    };

    paymentEntries.forEach((paymentEntry) => {
            let remainingPayment = paymentEntry.paymentAmount ?? 0;

            if (paymentEntry.matchedEntryId) {
                const matchedInvoice = invoiceById.get(paymentEntry.matchedEntryId);
                if (matchedInvoice) {
                    remainingPayment = applyPaymentToInvoice(matchedInvoice, remainingPayment, paymentEntry.date);
                }
            }

            if (paymentEntry.date < startDate) {
                return;
            }

            const bucket = invoicesByPartner.get(paymentEntry.partnerName) ?? [];

            for (const invoice of bucket) {
                if (remainingPayment <= 0) break;
                if (invoice.remainingAmount <= 0) continue;

                if (paymentEntry.matchedEntryId && invoice.id === paymentEntry.matchedEntryId) {
                    continue;
                }

                remainingPayment = applyPaymentToInvoice(invoice, remainingPayment, paymentEntry.date);
            }
        });

    const finalizedRows = invoices.map(({ remainingAmount, ...row }) => row);

    if (filter.mode === '미수금' || filter.mode === '미지급금') {
        return finalizedRows.filter((row) => row.outstandingAmount > 0);
    }

    return finalizedRows;
};

const WorkbookLedgerPage: React.FC = () => {
    const hotRef = useRef<any>(null);
    const dbUploadInputRef = useRef<HTMLInputElement | null>(null);
    const ledgerCaptureRef = useRef<HTMLDivElement | null>(null);
    const summaryCaptureRef = useRef<HTMLDivElement | null>(null);
    const { currentUser } = useAuth();

    const today = useMemo(() => new Date(), []);
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;
    const currentDay = today.getDate();
    const todayString = formatDateInput(today);

    const [activeTab, setActiveTab] = useState<WorkbookTab>('input');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [uploadingDb, setUploadingDb] = useState(false);
    const [downloadingDb, setDownloadingDb] = useState(false);
    const [dbActionLoading, setDbActionLoading] = useState(false);
    const [capturingView, setCapturingView] = useState<'ledger' | 'summary' | null>(null);
    const [receiptActionLoading, setReceiptActionLoading] = useState(false);
    const [entries, setEntries] = useState<WorkbookLedgerEntry[]>([]);
    const [partnerNames, setPartnerNames] = useState<string[]>([]);
    const [siteNames, setSiteNames] = useState<string[]>([]);
    const [teamNames, setTeamNames] = useState<string[]>([]);
    const [selectedTeam, setSelectedTeam] = useState('');
    const [baseYear, setBaseYear] = useState(currentYear);
    const [inputRows, setInputRows] = useState<InputRow[]>(() => Array.from({ length: INPUT_ROW_COUNT }, emptyInputRow));

    const [ledgerDraft, setLedgerDraft] = useState<LedgerFilter>({
        startDate: DEFAULT_LEDGER_START,
        endDate: todayString,
        teamName: '',
        transactionType: '매출',
        partnerName: '',
        siteName: ''
    });
    const [ledgerFilter, setLedgerFilter] = useState<LedgerFilter>({
        startDate: DEFAULT_LEDGER_START,
        endDate: todayString,
        teamName: '',
        transactionType: '매출',
        partnerName: '',
        siteName: ''
    });

    const [summaryDraft, setSummaryDraft] = useState<SummaryFilter>({
        startYear: currentYear,
        startMonth: 1,
        startDay: 1,
        endYear: currentYear,
        endMonth: currentMonth,
        endDay: currentDay,
        teamName: '',
        mode: '미수금',
        partnerName: '',
        siteName: ''
    });
    const [summaryFilter, setSummaryFilter] = useState<SummaryFilter>({
        startYear: currentYear,
        startMonth: 1,
        startDay: 1,
        endYear: currentYear,
        endMonth: currentMonth,
        endDay: currentDay,
        teamName: '',
        mode: '미수금',
        partnerName: '',
        siteName: ''
    });
    const [editingDbDraft, setEditingDbDraft] = useState<DbEditDraft | null>(null);
    const [receiptHistoryTargetId, setReceiptHistoryTargetId] = useState<string | null>(null);
    const [editingReceiptDraft, setEditingReceiptDraft] = useState<ReceiptEditDraft | null>(null);

    const refreshPageData = useCallback(async () => {
        setLoading(true);
        try {
            const [savedEntries, companies, sites, teams] = await Promise.all([
                workbookLedgerService.getEntries(),
                companyService.getActiveCompanies(),
                siteService.getSites(),
                teamService.getTeams()
            ]);

            const nextPartnerNames = new Set<string>();
            companies.forEach((company) => {
                if (company.name) nextPartnerNames.add(company.name);
            });
            savedEntries.forEach((entry) => {
                if (entry.partnerName) nextPartnerNames.add(entry.partnerName);
            });

            const nextSiteNames = new Set<string>();
            sites.forEach((site) => {
                if (site.name) nextSiteNames.add(site.name);
            });
            savedEntries.forEach((entry) => {
                if (entry.siteName) nextSiteNames.add(entry.siteName);
            });

            const nextTeamNames = new Set<string>();
            teams.forEach((team) => {
                if (team.name) nextTeamNames.add(team.name);
            });
            savedEntries.forEach((entry) => {
                if (entry.teamName) nextTeamNames.add(entry.teamName);
            });

            setEntries(savedEntries);
            setPartnerNames(Array.from(nextPartnerNames).sort((left, right) => left.localeCompare(right, 'ko')));
            setSiteNames(Array.from(nextSiteNames).sort((left, right) => left.localeCompare(right, 'ko')));
            setTeamNames(Array.from(nextTeamNames).sort((left, right) => left.localeCompare(right, 'ko')));
        } catch (error) {
            console.error(error);
            Swal.fire('오류', '전용 장부 데이터를 불러오지 못했습니다.', 'error');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refreshPageData();
    }, [refreshPageData]);

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
            Swal.fire('안내', '저장할 입력 행이 없습니다.', 'info');
            return;
        }

        const validationErrors: string[] = [];
        const preparedEntries: Omit<WorkbookLedgerEntry, 'id' | 'createdAt' | 'updatedAt'>[] = [];

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

            const supplyAmount = row.supplyAmount ?? 0;
            const taxAmount = row.taxAmount ?? 0;
            const totalAmount = row.totalAmount ?? 0;
            const paymentAmount = row.paymentAmount ?? 0;
            const appliedMonth = row.appliedMonth ?? getMonthFromDate(row.date);

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
                manDays: row.manDays,
                appliedYear: row.appliedYear ?? baseYear,
                appliedMonth,
                note: row.note,
                teamName: row.teamName || selectedTeam,
                createdBy: currentUser?.uid ?? ''
            };

            preparedEntries.push({
                ...basePayload,
                description:
                    row.description ||
                    (totalAmount !== 0
                        ? (row.transactionType === '매출' ? '매출' : '매입')
                        : (row.transactionType === '매출' ? '입금' : '지급')),
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
            await workbookLedgerService.addEntries(preparedEntries);
            handleResetInputGrid();
            await refreshPageData();
            Swal.fire('저장 완료', `${preparedEntries.length}건을 전용 장부 DB에 등록했습니다.`, 'success');
        } catch (error) {
            console.error(error);
            Swal.fire('오류', '장부 데이터를 저장하지 못했습니다.', 'error');
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

            const { entries: importedEntries, skipped } = parseImportedDbEntries(rows, selectedTeam, baseYear);

            if (importedEntries.length === 0) {
                Swal.fire('안내', '가져올 수 있는 DB 행이 없습니다.', 'info');
                return;
            }

            const result = await Swal.fire({
                title: 'DB 업로드',
                html: `${importedEntries.length.toLocaleString()}건을 현재 장부 DB에 추가합니다.${skipped > 0 ? `<br />건너뜀: ${skipped.toLocaleString()}건` : ''}`,
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: '업로드',
                cancelButtonText: '취소'
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
            Swal.fire('업로드 완료', `${importedEntries.length.toLocaleString()}건을 DB에 추가했습니다.`, 'success');
        } catch (error) {
            console.error(error);
            Swal.fire('오류', error instanceof Error ? error.message : 'DB 업로드에 실패했습니다.', 'error');
        } finally {
            setUploadingDb(false);
        }
    }, [baseYear, currentUser?.uid, refreshPageData, selectedTeam]);

    const handleDownloadDb = useCallback(async () => {
        if (entries.length === 0) {
            Swal.fire('안내', '다운로드할 DB 데이터가 없습니다.', 'info');
            return;
        }

        setDownloadingDb(true);
        try {
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

            saveAs(blob, `매입매출_DB_${new Date().toISOString().slice(0, 10)}.xlsx`);
        } catch (error) {
            console.error(error);
            Swal.fire('오류', 'DB 다운로드에 실패했습니다.', 'error');
        } finally {
            setDownloadingDb(false);
        }
    }, [entries]);

    const handleCopyCapture = useCallback(async (
        target: 'ledger' | 'summary',
        element: HTMLDivElement | null,
        label: string
    ) => {
        if (!element) {
            Swal.fire('안내', `${label} 화면을 찾지 못했습니다.`, 'info');
            return;
        }

        setCapturingView(target);
        try {
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
                        </select>
                    </label>
                    <label style="display:grid;gap:6px;">
                        <span style="font-size:13px;font-weight:700;">날짜</span>
                        <input id="db-date" type="date" value="${escapeHtml(entry.date || '')}" class="swal2-input" style="margin:0;width:100%;" />
                    </label>
                    <label style="display:grid;gap:6px;">
                        <span style="font-size:13px;font-weight:700;">거래처명</span>
                        <input id="db-partner" type="text" value="${escapeHtml(entry.partnerName || '')}" class="swal2-input" style="margin:0;width:100%;" />
                    </label>
                    <label style="display:grid;gap:6px;">
                        <span style="font-size:13px;font-weight:700;">현장명</span>
                        <input id="db-site" type="text" value="${escapeHtml(entry.siteName || '')}" class="swal2-input" style="margin:0;width:100%;" />
                    </label>
                    <label style="display:grid;gap:6px;grid-column:1 / -1;">
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
            await workbookLedgerService.updateEntry(entry.id, {
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
            await workbookLedgerService.softDeleteEntry(entry.id, currentUser?.uid ?? '');
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

    const handleRegisterReceipt = useCallback(async (row: SummaryRow) => {
        const result = await Swal.fire({
            title: '입금 등록',
            html: `
                <div style="display:grid;gap:12px;text-align:left;">
                    <div>
                        <div style="font-size:13px;font-weight:700;margin-bottom:6px;">거래처</div>
                        <div style="padding:10px 12px;border:1px solid #d7dde7;border-radius:10px;background:#f8fafc;">${row.partnerName}</div>
                    </div>
                    <div>
                        <div style="font-size:13px;font-weight:700;margin-bottom:6px;">미수잔액</div>
                        <div style="padding:10px 12px;border:1px solid #d7dde7;border-radius:10px;background:#f8fafc;">${formatNumber(row.outstandingAmount)}원</div>
                    </div>
                    <div>
                        <label for="receipt-date" style="font-size:13px;font-weight:700;display:block;margin-bottom:6px;">입금일자</label>
                        <input id="receipt-date" type="date" value="${todayString}" class="swal2-input" style="margin:0;width:100%;" />
                    </div>
                    <div>
                        <label for="receipt-amount" style="font-size:13px;font-weight:700;display:block;margin-bottom:6px;">입금금액</label>
                        <input id="receipt-amount" type="number" min="1" max="${Math.max(1, row.outstandingAmount)}" value="${row.outstandingAmount}" class="swal2-input" style="margin:0;width:100%;" />
                    </div>
                    <div>
                        <label for="receipt-note" style="font-size:13px;font-weight:700;display:block;margin-bottom:6px;">비고</label>
                        <input id="receipt-note" type="text" class="swal2-input" style="margin:0;width:100%;" placeholder="입금 메모" />
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
                    Swal.showValidationMessage('입금일자를 입력하세요.');
                    return null;
                }

                if (!Number.isFinite(amount) || amount <= 0) {
                    Swal.showValidationMessage('입금금액은 0보다 커야 합니다.');
                    return null;
                }

                if (amount > row.outstandingAmount) {
                    Swal.showValidationMessage('입금금액은 현재 미수잔액보다 클 수 없습니다.');
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
                transactionType: '매출',
                date,
                partnerName: row.partnerName,
                siteName: row.siteName,
                description: '입금',
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
            Swal.fire('저장 완료', `${formatNumber(amount)}원 입금을 등록했습니다.`, 'success');
        } catch (error) {
            console.error(error);
            Swal.fire('오류', '입금 등록에 실패했습니다.', 'error');
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
            Swal.fire('?덈궡', '?낃툑??湲곗??媛 ?섎뒗 留ㅼ텧 ?꾨룄瑜??ㅼ떆 遺덈윭?ㅼ꽭??', 'info');
            return;
        }

        const receiptHistoryEntries = entries
            .filter((entry) => isPaymentEntry(entry) && entry.matchedEntryId === receiptHistoryTargetId)
            .sort(sortWorkbookEntries);

        const receiptHistoryTotal = receiptHistoryEntries.reduce((sum, entry) => sum + (entry.paymentAmount ?? 0), 0);
        const normalizedDate = normalizeDate(editingReceiptDraft.date);
        const paymentAmount = toNumberOrNull(editingReceiptDraft.paymentAmount) ?? 0;
        const currentReceipt = receiptHistoryEntries.find((entry) => entry.id === editingReceiptDraft.id);

        if (!currentReceipt) {
            Swal.fire('?덈궡', '?섏젙???낃툑?댁뿭???ㅼ떆 遺덈윭?ㅼ꽭??', 'info');
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
            await workbookLedgerService.updateEntry(editingReceiptDraft.id, {
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
            await workbookLedgerService.softDeleteEntry(entry.id, currentUser?.uid ?? '');
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

    const applyLedgerFilter = useCallback(() => {
        setLedgerFilter({ ...ledgerDraft });
    }, [ledgerDraft]);

    const applySummaryFilter = useCallback(() => {
        const draft = {
            ...summaryDraft,
            startYear: summaryDraft.startYear || currentYear,
            startMonth: summaryDraft.startMonth || 1,
            startDay: summaryDraft.startDay || 1,
            endYear: summaryDraft.endYear || currentYear,
            endMonth: summaryDraft.endMonth || currentMonth,
            endDay: summaryDraft.endDay || currentDay
        };

        const startDate = buildDateFromParts(draft.startYear, draft.startMonth, draft.startDay);
        const endDate = buildDateFromParts(draft.endYear, draft.endMonth, draft.endDay);

        if (!startDate || !endDate) {
            Swal.fire('입력 확인', '시작일과 종료일을 올바른 연/월/일로 입력해 주세요.', 'warning');
            return;
        }

        setSummaryFilter(
            startDate <= endDate
                ? draft
                : {
                    ...draft,
                    startYear: draft.endYear,
                    startMonth: draft.endMonth,
                    startDay: draft.endDay,
                    endYear: draft.startYear,
                    endMonth: draft.startMonth,
                    endDay: draft.startDay
                }
        );
    }, [currentDay, currentMonth, currentYear, summaryDraft]);

    const ledgerRows = useMemo(() => buildLedgerRows(entries, ledgerFilter), [entries, ledgerFilter]);
    const summaryRows = useMemo(() => buildSummaryRows(entries, summaryFilter), [entries, summaryFilter]);

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
            settledAmount: accumulator.settledAmount + row.settledAmount,
            outstandingAmount: accumulator.outstandingAmount + row.outstandingAmount
        }), { supplyAmount: 0, taxAmount: 0, totalAmount: 0, settledAmount: 0, outstandingAmount: 0 });
    }, [summaryRows]);

    const canRegisterReceipt = summaryFilter.mode === '미수금';
    const canOpenReceiptHistory = summaryFilter.mode === '미수금';

    const receiptHistoryInvoice = useMemo(() => {
        if (!receiptHistoryTargetId) return null;
        return entries.find((entry) => entry.id === receiptHistoryTargetId && isInvoiceEntry(entry)) ?? null;
    }, [entries, receiptHistoryTargetId]);

    const receiptHistorySummaryRow = useMemo(() => {
        if (!receiptHistoryTargetId) return null;
        return summaryRows.find((row) => row.id === receiptHistoryTargetId) ?? null;
    }, [receiptHistoryTargetId, summaryRows]);

    const receiptHistoryEntries = useMemo(() => {
        if (!receiptHistoryTargetId) return [];
        return entries
            .filter((entry) => isPaymentEntry(entry) && entry.matchedEntryId === receiptHistoryTargetId)
            .sort(sortWorkbookEntries);
    }, [entries, receiptHistoryTargetId]);

    const receiptHistoryTotal = useMemo(
        () => receiptHistoryEntries.reduce((sum, entry) => sum + (entry.paymentAmount ?? 0), 0),
        [receiptHistoryEntries]
    );

    const receiptHistoryOutstanding = useMemo(() => {
        if (!receiptHistoryInvoice) return 0;
        return Math.max((receiptHistoryInvoice.totalAmount ?? 0) - receiptHistoryTotal, 0);
    }, [receiptHistoryInvoice, receiptHistoryTotal]);

    const legacyMatchedGap = useMemo(() => {
        if (!receiptHistorySummaryRow) return 0;
        return Math.max(receiptHistorySummaryRow.settledAmount - receiptHistoryTotal, 0);
    }, [receiptHistorySummaryRow, receiptHistoryTotal]);

    const inputColumns = useMemo<any[]>(() => [
        { data: 'transactionType', type: 'dropdown', source: ['매입', '매출'], width: 88 },
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
                        <th className="sheet-title-dark" colSpan={14}>데이터 입력 시트</th>
                    </tr>
                    <tr>
                        <th className="sheet-label-yellow">팀 명</th>
                        <td className="sheet-value" colSpan={2}>
                            <input
                                list="workbook-team-options"
                                value={selectedTeam}
                                onChange={(event) => setSelectedTeam(event.target.value)}
                                placeholder="팀명 입력 또는 선택"
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
                입력폼에서 공급가액을 넣으면 부가세와 합계가 자동 계산되고, 적용연도와 팀명은 상단 값으로 자동 반영됩니다.
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
                        <th className="sheet-title-dark" colSpan={15}>DB</th>
                    </tr>
                    <tr>
                        <th className="sheet-label-green">저장건수</th>
                        <td className="sheet-value-light">{entries.length.toLocaleString()}건</td>
                        <td className="sheet-spacer" colSpan={9} />
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
                    </tr>
                </tbody>
            </table>

            <div className="workbook-help-text">
                잔액은 선택한 종료일 기준으로 계산됩니다. 종료일 이후에 등록된 입금/지급은 해당 조회에 반영되지 않습니다.
            </div>

            <div className="sheet-table-wrapper">
                <table className="sheet-table">
                    <thead>
                        <tr>
                            <th>No.</th>
                            <th>구분</th>
                            <th>날짜</th>
                            <th>거래처명</th>
                            <th>현장명</th>
                            <th>내용</th>
                            <th>공급가액</th>
                            <th>부가세</th>
                            <th>합계</th>
                            <th>입금금액</th>
                            <th>적용연도</th>
                            <th>적용월</th>
                            <th>비고</th>
                            <th>팀명</th>
                            <th>처리</th>
                        </tr>
                    </thead>
                    <tbody>
                        {entries.length === 0 && (
                            <tr>
                                <td colSpan={15} className="sheet-empty-state">저장된 DB 데이터가 없습니다.</td>
                            </tr>
                        )}
                        {entries.map((entry, index) => {
                            const isEditing = editingDbDraft?.id === entry.id;
                            const dbDraft = isEditing ? editingDbDraft : null;
                            const editSupplyAmount = isEditing ? (toNumberOrNull(editingDbDraft?.supplyAmount) ?? 0) : 0;
                            const editTaxAmount = editSupplyAmount !== 0 ? Math.round(editSupplyAmount * 0.1) : 0;
                            const editTotalAmount = editSupplyAmount !== 0 ? editSupplyAmount + editTaxAmount : 0;

                            return (
                                <tr
                                    key={entry.id ?? `${entry.date}-${entry.partnerName}-${index}`}
                                    className={isEditing ? 'workbook-inline-edit-row' : undefined}
                                >
                                    <td>{index + 1}</td>
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
                                        ) : (entry.teamName || '-')}
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

            <p className="workbook-help-text">
                입력폼에서 저장한 행은 전용 장부 DB에 그대로 저장되고 이 탭에서 바로 확인할 수 있습니다. 업로드는 현재 DB에 추가 저장됩니다.
            </p>
        </section>
    );

    const renderLedgerTab = () => (
        <section className="workbook-sheet">
            <div className="workbook-section-toolbar" data-html2canvas-ignore="true">
                <button
                    type="button"
                    className="workbook-toolbar-button"
                    onClick={() => handleCopyCapture('ledger', ledgerCaptureRef.current, '거래장')}
                    disabled={capturingView === 'ledger'}
                >
                    <FontAwesomeIcon icon={capturingView === 'ledger' ? faSpinner : faCopy} spin={capturingView === 'ledger'} />
                    화면 복사
                </button>
            </div>

            <div ref={ledgerCaptureRef}>
                <table className="sheet-control-table query-sheet-table">
                    <tbody>
                        <tr>
                            <th className="sheet-title-dark" colSpan={8}>매출/매입 거래장</th>
                        </tr>
                        <tr>
                            <th className="sheet-label-blue">검색시작일</th>
                            <td className="sheet-value">
                                <input
                                    type="date"
                                    value={ledgerDraft.startDate}
                                    onChange={(event) => setLedgerDraft((prev) => ({ ...prev, startDate: event.target.value }))}
                                />
                            </td>
                            <td className="sheet-spacer" colSpan={6} />
                        </tr>
                        <tr>
                            <th className="sheet-label-blue">검색종료일</th>
                            <td className="sheet-value">
                                <input
                                    type="date"
                                    value={ledgerDraft.endDate}
                                    onChange={(event) => setLedgerDraft((prev) => ({ ...prev, endDate: event.target.value }))}
                                />
                            </td>
                            <td className="sheet-spacer" colSpan={6} />
                        </tr>
                        <tr>
                            <th className="sheet-label-green">팀 명</th>
                            <td className="sheet-value-light">
                                <input
                                    list="workbook-team-options"
                                    value={ledgerDraft.teamName}
                                    onChange={(event) => setLedgerDraft((prev) => ({ ...prev, teamName: event.target.value }))}
                                    placeholder="전체"
                                />
                            </td>
                            <td className="sheet-spacer" colSpan={6} />
                        </tr>
                        <tr>
                            <th className="sheet-label-green">구 분</th>
                            <td className="sheet-value-light">
                                <select
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
                            <td className="sheet-spacer" colSpan={6} />
                        </tr>
                        <tr>
                            <th className="sheet-label-green">거래처</th>
                            <td className="sheet-value-light">
                                <input
                                    list="workbook-partner-options"
                                    value={ledgerDraft.partnerName}
                                    onChange={(event) => setLedgerDraft((prev) => ({ ...prev, partnerName: event.target.value }))}
                                    placeholder="거래처 전체"
                                />
                            </td>
                            <td className="sheet-spacer" colSpan={4} />
                            <td className="sheet-button-wrap" colSpan={2}>
                                <button type="button" className="excel-button excel-button-green" onClick={applyLedgerFilter}>
                                    <FontAwesomeIcon icon={faMagnifyingGlass} />
                                    조회
                                </button>
                            </td>
                        </tr>
                        <tr>
                            <th className="sheet-label-green">현장명</th>
                            <td className="sheet-value-light">
                                <input
                                    list="workbook-site-options"
                                    value={ledgerDraft.siteName}
                                    onChange={(event) => setLedgerDraft((prev) => ({ ...prev, siteName: event.target.value }))}
                                    placeholder="현장 전체"
                                />
                            </td>
                            <td className="sheet-spacer" colSpan={6} />
                        </tr>
                    </tbody>
                </table>

                <div className="sheet-merged-heading">
                    {ledgerFilter.partnerName || `${ledgerFilter.transactionType} 거래장`}
                </div>

                <div className="sheet-table-wrapper">
                    <table className="sheet-table">
                        <thead>
                            <tr>
                                <th>날짜</th>
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
                                    <td colSpan={8} className="sheet-empty-state">조회 결과가 없습니다.</td>
                                </tr>
                            )}
                            {ledgerRows.map((row) => (
                                <tr key={row.id}>
                                    <td>{row.date}</td>
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
                                <td>합 계</td>
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
            <div className="workbook-section-toolbar" data-html2canvas-ignore="true">
                <button
                    type="button"
                    className="workbook-toolbar-button"
                    onClick={() => handleCopyCapture('summary', summaryCaptureRef.current, '전체 조회')}
                    disabled={capturingView === 'summary'}
                >
                    <FontAwesomeIcon icon={capturingView === 'summary' ? faSpinner : faCopy} spin={capturingView === 'summary'} />
                    화면 복사
                </button>
            </div>

            <div ref={summaryCaptureRef}>
                <table className="sheet-control-table summary-sheet-table">
                    <tbody>
                        <tr>
                            <th className="sheet-title-dark" colSpan={12}>주식회사 청연이엔지</th>
                        </tr>
                        <tr>
                            <th className="sheet-label-dark">시작연도</th>
                            <td className="sheet-value">
                                <input
                                    type="number"
                                    min={2000}
                                    max={2100}
                                    value={summaryDraft.startYear}
                                    onChange={(event) => setSummaryDraft((prev) => ({ ...prev, startYear: Number(event.target.value) || currentYear }))}
                                />
                            </td>
                            <th className="sheet-label-blue">시작월</th>
                            <td className="sheet-value">
                                <input
                                    type="number"
                                    min={1}
                                    max={12}
                                    value={summaryDraft.startMonth}
                                    onChange={(event) => setSummaryDraft((prev) => ({ ...prev, startMonth: Number(event.target.value) || 1 }))}
                                />
                            </td>
                            <th className="sheet-label-blue">시작일</th>
                            <td className="sheet-value">
                                <input
                                    type="number"
                                    min={1}
                                    max={31}
                                    value={summaryDraft.startDay}
                                    onChange={(event) => setSummaryDraft((prev) => ({ ...prev, startDay: Number(event.target.value) || 1 }))}
                                />
                            </td>
                            <td className="sheet-spacer" colSpan={6} />
                        </tr>
                        <tr>
                            <th className="sheet-label-dark">종료연도</th>
                            <td className="sheet-value">
                                <input
                                    type="number"
                                    min={2000}
                                    max={2100}
                                    value={summaryDraft.endYear}
                                    onChange={(event) => setSummaryDraft((prev) => ({ ...prev, endYear: Number(event.target.value) || currentYear }))}
                                />
                            </td>
                            <th className="sheet-label-blue">종료월</th>
                            <td className="sheet-value">
                                <input
                                    type="number"
                                    min={1}
                                    max={12}
                                    value={summaryDraft.endMonth}
                                    onChange={(event) => setSummaryDraft((prev) => ({ ...prev, endMonth: Number(event.target.value) || 12 }))}
                                />
                            </td>
                            <th className="sheet-label-blue">종료일</th>
                            <td className="sheet-value">
                                <input
                                    type="number"
                                    min={1}
                                    max={31}
                                    value={summaryDraft.endDay}
                                    onChange={(event) => setSummaryDraft((prev) => ({ ...prev, endDay: Number(event.target.value) || currentDay }))}
                                />
                            </td>
                            <td className="sheet-spacer" colSpan={6} />
                        </tr>
                        <tr>
                            <th className="sheet-label-green">팀 명</th>
                            <td className="sheet-value-light">
                                <input
                                    list="workbook-team-options"
                                    value={summaryDraft.teamName}
                                    onChange={(event) => setSummaryDraft((prev) => ({ ...prev, teamName: event.target.value }))}
                                    placeholder="전체"
                                />
                            </td>
                            <td className="sheet-spacer" colSpan={10} />
                        </tr>
                        <tr>
                            <th className="sheet-label-green">구 분</th>
                            <td className="sheet-value-light">
                                <select
                                    value={summaryDraft.mode}
                                    onChange={(event) => setSummaryDraft((prev) => ({ ...prev, mode: event.target.value as SummaryMode }))}
                                >
                                    <option value="매출">매출</option>
                                    <option value="매입">매입</option>
                                    <option value="미수금">미수금</option>
                                    <option value="미지급금">미지급금</option>
                                </select>
                            </td>
                            <td className="sheet-spacer" colSpan={10} />
                        </tr>
                        <tr>
                            <th className="sheet-label-green">거래처</th>
                            <td className="sheet-value-light">
                                <input
                                    list="workbook-partner-options"
                                    value={summaryDraft.partnerName}
                                    onChange={(event) => setSummaryDraft((prev) => ({ ...prev, partnerName: event.target.value }))}
                                    placeholder="거래처 전체"
                                />
                            </td>
                            <th className="sheet-label-green">현장명</th>
                            <td className="sheet-value-light">
                                <input
                                    list="workbook-site-options"
                                    value={summaryDraft.siteName}
                                    onChange={(event) => setSummaryDraft((prev) => ({ ...prev, siteName: event.target.value }))}
                                    placeholder="현장 전체"
                                />
                            </td>
                            <td className="sheet-spacer" colSpan={6} />
                            <td className="sheet-button-wrap" colSpan={2}>
                                <button type="button" className="excel-button excel-button-green" onClick={applySummaryFilter}>
                                    <FontAwesomeIcon icon={faMagnifyingGlass} />
                                    조회
                                </button>
                            </td>
                        </tr>
                    </tbody>
                </table>

                <div className="sheet-table-wrapper">
                    <table className="sheet-table">
                        <thead className="summary-header">
                            <tr>
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
                                    <td colSpan={canRegisterReceipt ? 13 : 12} className="sheet-empty-state">조회 결과가 없습니다.</td>
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
                                    <td className="align-right">{formatNumber(row.settledAmount)}</td>
                                    <td className="align-right">{formatNumber(row.outstandingAmount)}</td>
                                    <td>{row.note || '-'}</td>
                                    <td>{row.teamName || '-'}</td>
                                    {canRegisterReceipt && (
                                        <td>
                                            <div className="workbook-inline-actions">
                                                <button
                                                    type="button"
                                                    className="workbook-toolbar-button workbook-inline-button"
                                                    onClick={() => handleRegisterReceipt(row)}
                                                    disabled={saving || row.outstandingAmount <= 0}
                                                >
                                                    입금
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
                                <td>합 계</td>
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
                        <h1>매입매출 Pro Ver 2.5 (청연)</h1>
                        <p>엑셀 통합문서 UI를 웹 화면으로 옮긴 전용 장부 페이지입니다.</p>
                    </div>
                    <div className="workbook-title-actions">
                        <button type="button" className="workbook-toolbar-button" onClick={refreshPageData} disabled={loading}>
                            <FontAwesomeIcon icon={loading ? faSpinner : faRotateRight} spin={loading} />
                            새로고침
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

                <div className="workbook-status-bar">
                    <span><FontAwesomeIcon icon={faDatabase} /> 저장된 장부 행: {entries.length.toLocaleString()}건</span>
                    <span><FontAwesomeIcon icon={faTableCellsLarge} /> 입력 기준연도: {baseYear}년</span>
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
                                    <h2>입금내역</h2>
                                    <p>선택한 미수금 행에 연결된 입금 이력을 수정하거나 삭제합니다.</p>
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
                                        <div><strong>누적입금</strong><span>{formatNumber(receiptHistoryTotal)}원</span></div>
                                        <div><strong>잔액</strong><span>{formatNumber(receiptHistoryOutstanding)}원</span></div>
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
                                                    <th>입금일자</th>
                                                    <th>입금금액</th>
                                                    <th>비고</th>
                                                    <th>처리</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {receiptHistoryEntries.length === 0 && (
                                                    <tr>
                                                        <td colSpan={4} className="sheet-empty-state">등록된 입금내역이 없습니다.</td>
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
                                                                    onClick={() => handleDeleteReceipt(entry)}
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
                                            <h3>입금내역 수정</h3>
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
                                                    <span>입금일자</span>
                                                    <input
                                                        type="date"
                                                        value={editingReceiptDraft.date}
                                                        onChange={(event) => handleChangeEditingReceipt('date', event.target.value)}
                                                        disabled={receiptActionLoading}
                                                    />
                                                </label>
                                                <label>
                                                    <span>입금금액</span>
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
                                                        onClick={handleSaveEditedReceipt}
                                                        disabled={receiptActionLoading}
                                                    >
                                                        <FontAwesomeIcon icon={receiptActionLoading ? faSpinner : faPenToSquare} spin={receiptActionLoading} />
                                                        수정 저장
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="sheet-empty-state">수정할 입금내역을 선택하세요.</div>
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
