import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HotTable } from '@handsontable/react';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/dist/handsontable.full.min.css';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import Swal from 'sweetalert2';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faDownload,
    faDatabase,
    faMagnifyingGlass,
    faRotateRight,
    faSpinner,
    faTableCellsLarge,
    faUpload
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
    year: number;
    startMonth: number;
    endMonth: number;
    teamName: string;
    mode: SummaryMode;
    partnerName: string;
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
    paymentDate: string;
    settledAmount: number;
    outstandingAmount: number;
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
    '공수',
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

const getMonthEndDate = (year: number, month: number) => {
    return formatDateInput(new Date(year, month, 0));
};

const toDbRow = (entry: WorkbookLedgerEntry) => ([
    entry.transactionType,
    entry.date || '',
    entry.partnerName || '',
    entry.siteName || '',
    entry.description || '',
    entry.manDays ?? '',
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
        const manDays = toNumberOrNull(readCell(row, '공수'));
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
    const asOfDate = getMonthEndDate(filter.year, filter.endMonth);

    const scopedEntries = entries
        .filter((entry) => entry.transactionType === transactionType)
        .filter((entry) => (entry.appliedYear ?? getYearFromDate(entry.date)) === filter.year)
        .filter((entry) => {
            const month = entry.appliedMonth ?? getMonthFromDate(entry.date);
            if (!month) return false;
            return month >= filter.startMonth && month <= filter.endMonth;
        })
        .filter((entry) => matchesFilter(entry.teamName, filter.teamName))
        .filter((entry) => matchesFilter(entry.partnerName, filter.partnerName))
        .filter((entry) => !asOfDate || entry.date <= asOfDate)
        .sort(sortWorkbookEntries);

    type WorkingSummaryRow = SummaryRow & { remainingAmount: number };
    const invoices = scopedEntries
        .filter(isInvoiceEntry)
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
            paymentDate: '',
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

    const applyPaymentToInvoice = (invoice: WorkingSummaryRow, paymentAmount: number, paymentDate: string) => {
        if (paymentAmount <= 0 || invoice.remainingAmount <= 0) return paymentAmount;

        const appliedAmount = Math.min(invoice.remainingAmount, paymentAmount);
        invoice.settledAmount += appliedAmount;
        invoice.remainingAmount -= appliedAmount;
        invoice.outstandingAmount = invoice.remainingAmount;
        invoice.paymentDate = paymentDate;

        return paymentAmount - appliedAmount;
    };

    scopedEntries
        .filter(isPaymentEntry)
        .forEach((paymentEntry) => {
            let remainingPayment = paymentEntry.paymentAmount ?? 0;

            if (paymentEntry.matchedEntryId) {
                const matchedInvoice = invoiceById.get(paymentEntry.matchedEntryId);
                if (matchedInvoice) {
                    remainingPayment = applyPaymentToInvoice(matchedInvoice, remainingPayment, paymentEntry.date);
                }
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
    const { currentUser } = useAuth();

    const today = useMemo(() => new Date(), []);
    const currentYear = today.getFullYear();
    const todayString = formatDateInput(today);

    const [activeTab, setActiveTab] = useState<WorkbookTab>('input');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [uploadingDb, setUploadingDb] = useState(false);
    const [downloadingDb, setDownloadingDb] = useState(false);
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
        year: currentYear,
        startMonth: 1,
        endMonth: 12,
        teamName: '',
        mode: '미수금',
        partnerName: ''
    });
    const [summaryFilter, setSummaryFilter] = useState<SummaryFilter>({
        year: currentYear,
        startMonth: 1,
        endMonth: 12,
        teamName: '',
        mode: '미수금',
        partnerName: ''
    });

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

            if (totalAmount <= 0 && paymentAmount <= 0) {
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
                    (totalAmount > 0
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

    const applyLedgerFilter = useCallback(() => {
        setLedgerFilter({ ...ledgerDraft });
    }, [ledgerDraft]);

    const applySummaryFilter = useCallback(() => {
        setSummaryFilter({
            ...summaryDraft,
            startMonth: Math.min(summaryDraft.startMonth, summaryDraft.endMonth),
            endMonth: Math.max(summaryDraft.startMonth, summaryDraft.endMonth)
        });
    }, [summaryDraft]);

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
                잔액은 선택한 종료월의 말일 기준으로 계산됩니다. 종료월 이후에 등록된 입금/지급은 해당 조회에 반영되지 않습니다.
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
                            <th>공수</th>
                            <th>공급가액</th>
                            <th>부가세</th>
                            <th>합계</th>
                            <th>입금금액</th>
                            <th>적용연도</th>
                            <th>적용월</th>
                            <th>비고</th>
                            <th>팀명</th>
                        </tr>
                    </thead>
                    <tbody>
                        {entries.length === 0 && (
                            <tr>
                                <td colSpan={15} className="sheet-empty-state">저장된 DB 데이터가 없습니다.</td>
                            </tr>
                        )}
                        {entries.map((entry, index) => (
                            <tr key={entry.id ?? `${entry.date}-${entry.partnerName}-${index}`}>
                                <td>{index + 1}</td>
                                <td>{entry.transactionType}</td>
                                <td>{entry.date || '-'}</td>
                                <td>{entry.partnerName || '-'}</td>
                                <td>{entry.siteName || '-'}</td>
                                <td>{entry.description || '-'}</td>
                                <td className="align-right">{entry.manDays !== null && entry.manDays !== undefined ? entry.manDays : '-'}</td>
                                <td className="align-right">{entry.supplyAmount > 0 ? formatNumber(entry.supplyAmount) : '-'}</td>
                                <td className="align-right">{entry.taxAmount > 0 ? formatNumber(entry.taxAmount) : '-'}</td>
                                <td className="align-right">{entry.totalAmount > 0 ? formatNumber(entry.totalAmount) : '-'}</td>
                                <td className="align-right">{entry.paymentAmount > 0 ? formatNumber(entry.paymentAmount) : '-'}</td>
                                <td className="align-right">{entry.appliedYear ?? '-'}</td>
                                <td className="align-right">{entry.appliedMonth ?? '-'}</td>
                                <td>{entry.note || '-'}</td>
                                <td>{entry.teamName || '-'}</td>
                            </tr>
                        ))}
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
                                <td className="align-right">{row.transactionAmount > 0 ? formatNumber(row.transactionAmount) : '-'}</td>
                                <td className="align-right">{row.paymentAmount > 0 ? formatNumber(row.paymentAmount) : '-'}</td>
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
        </section>
    );

    const renderSummaryTab = () => (
        <section className="workbook-sheet">
            <table className="sheet-control-table summary-sheet-table">
                <tbody>
                    <tr>
                        <th className="sheet-title-dark" colSpan={12}>주식회사 청연이엔지</th>
                    </tr>
                    <tr>
                        <th className="sheet-label-dark">연도</th>
                        <td className="sheet-value">
                            <input
                                type="number"
                                min={2000}
                                max={2100}
                                value={summaryDraft.year}
                                onChange={(event) => setSummaryDraft((prev) => ({ ...prev, year: Number(event.target.value) || currentYear }))}
                            />
                        </td>
                        <td className="sheet-spacer" colSpan={10} />
                    </tr>
                    <tr>
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
                        <td className="sheet-spacer" colSpan={10} />
                    </tr>
                    <tr>
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
                        <td className="sheet-spacer" colSpan={10} />
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
                        <td className="sheet-spacer" colSpan={8} />
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
                                <td>{row.paymentDate || '-'}</td>
                                <td className="align-right">{formatNumber(row.settledAmount)}</td>
                                <td className="align-right">{formatNumber(row.outstandingAmount)}</td>
                                <td>{row.note || '-'}</td>
                                <td>{row.teamName || '-'}</td>
                                {canRegisterReceipt && (
                                    <td>
                                        <button
                                            type="button"
                                            className="workbook-toolbar-button"
                                            onClick={() => handleRegisterReceipt(row)}
                                            disabled={saving || row.outstandingAmount <= 0}
                                        >
                                            입금
                                        </button>
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
