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
    '???',
    '???????,
    '??????,
    '???',
    '??????',
    '??????',
    '?????,
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
    entry.manDays ?? '',
    entry.supplyAmount || '',
    entry.taxAmount || '',
    entry.totalAmount || '',
    entry.paymentAmount || '',
    entry.appliedYear ?? '',
    entry.appliedMonth ?? '',
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
        const manDays = toNumberOrNull(readCell(row, '???'));
        const supplyAmount = toNumberOrNull(readCell(row, '???????)) ?? 0;
        const taxAmount = toNumberOrNull(readCell(row, '??????)) ?? 0;
        const totalAmount = toNumberOrNull(readCell(row, '???')) ?? 0;
        const paymentAmount = toNumberOrNull(readCell(row, '??????')) ?? 0;
        const appliedYear = toNumberOrNull(readCell(row, '??????')) ?? getYearFromDate(date) ?? fallbackYear;
        const appliedMonth = toNumberOrNull(readCell(row, '?????)) ?? getMonthFromDate(date);
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
    const transactionType: WorkbookTransactionType = filter.mode === '???' || filter.mode === '??????' ? '???' : '???';

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
        .sort(sortWorkbookEntries);

    type WorkingSummaryRow = SummaryRow & { remainingAmount: number };
    const invoices = scopedEntries
        .filter(isInvoiceEntry)
        .map((entry) => ({
            id: entry.id ?? `${entry.date}-${entry.partnerName}-${entry.description}`,
            partnerName: entry.partnerName,
            siteName: entry.siteName ?? '',
            issueDate: entry.date,
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

    const invoicesByPartner = new Map<string, WorkingSummaryRow[]>();
    invoices.forEach((invoice) => {
        const bucket = invoicesByPartner.get(invoice.partnerName) ?? [];
        bucket.push(invoice);
        invoicesByPartner.set(invoice.partnerName, bucket);
    });

    scopedEntries
        .filter(isPaymentEntry)
        .forEach((paymentEntry) => {
            const bucket = invoicesByPartner.get(paymentEntry.partnerName) ?? [];
            let remainingPayment = paymentEntry.paymentAmount ?? 0;

            for (const invoice of bucket) {
                if (remainingPayment <= 0) break;
                if (invoice.remainingAmount <= 0) continue;

                const appliedAmount = Math.min(invoice.remainingAmount, remainingPayment);
                invoice.settledAmount += appliedAmount;
                invoice.remainingAmount -= appliedAmount;
                invoice.outstandingAmount = invoice.remainingAmount;
                invoice.paymentDate = paymentEntry.date;
                remainingPayment -= appliedAmount;
            }
        });

    const finalizedRows = invoices.map(({ remainingAmount, ...row }) => row);

    if (filter.mode === '????? || filter.mode === '??????') {
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
        transactionType: '???',
        partnerName: '',
        siteName: ''
    });
    const [ledgerFilter, setLedgerFilter] = useState<LedgerFilter>({
        startDate: DEFAULT_LEDGER_START,
        endDate: todayString,
        teamName: '',
        transactionType: '???',
        partnerName: '',
        siteName: ''
    });

    const [summaryDraft, setSummaryDraft] = useState<SummaryFilter>({
        year: currentYear,
        startMonth: 1,
        endMonth: 12,
        teamName: '',
        mode: '?????,
        partnerName: ''
    });
    const [summaryFilter, setSummaryFilter] = useState<SummaryFilter>({
        year: currentYear,
        startMonth: 1,
        endMonth: 12,
        teamName: '',
        mode: '?????,
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
            Swal.fire('???', '??? ??? ?????? ?????? ????????', 'error');
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
            Swal.fire('???', '????? ??? ??? ??????.', 'info');
            return;
        }

        const validationErrors: string[] = [];
        const preparedEntries: Omit<WorkbookLedgerEntry, 'id' | 'createdAt' | 'updatedAt'>[] = [];

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

            if (totalAmount <= 0 && paymentAmount <= 0) {
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

            preparedEntries.push({
                ...basePayload,
                description:
                    row.description ||
                    (totalAmount > 0
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
                        <th className="sheet-title-dark" colSpan={15}>DB</th>
                    </tr>
                    <tr>
                        <th className="sheet-label-green">???????/th>
                        <td className="sheet-value-light">{entries.length.toLocaleString()}??/td>
                        <td className="sheet-spacer" colSpan={9} />
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
                    </tr>
                </tbody>
            </table>

            <div className="sheet-table-wrapper">
                <table className="sheet-table">
                    <thead>
                        <tr>
                            <th>No.</th>
                            <th>???</th>
                            <th>???</th>
                            <th>??????</th>
                            <th>?????/th>
                            <th>???</th>
                            <th>???</th>
                            <th>???????/th>
                            <th>??????/th>
                            <th>???</th>
                            <th>??????</th>
                            <th>??????</th>
                            <th>?????/th>
                            <th>???</th>
                            <th>????/th>
                        </tr>
                    </thead>
                    <tbody>
                        {entries.length === 0 && (
                            <tr>
                                <td colSpan={15} className="sheet-empty-state">????? DB ?????? ??????.</td>
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
                ????????????? ??? ??? ??? DB???????????????????????? ?????????????. ?????? ??? DB????? ????????.
            </p>
        </section>
    );

    const renderLedgerTab = () => (
        <section className="workbook-sheet">
            <table className="sheet-control-table query-sheet-table">
                <tbody>
                    <tr>
                        <th className="sheet-title-dark" colSpan={8}>???/??? ?????/th>
                    </tr>
                    <tr>
                        <th className="sheet-label-blue">????????</th>
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
                        <th className="sheet-label-blue">????????</th>
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
                        <th className="sheet-label-green">?? ??/th>
                        <td className="sheet-value-light">
                            <input
                                list="workbook-team-options"
                                value={ledgerDraft.teamName}
                                onChange={(event) => setLedgerDraft((prev) => ({ ...prev, teamName: event.target.value }))}
                                placeholder="???"
                            />
                        </td>
                        <td className="sheet-spacer" colSpan={6} />
                    </tr>
                    <tr>
                        <th className="sheet-label-green">????/th>
                        <td className="sheet-value-light">
                            <select
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
                        <td className="sheet-spacer" colSpan={6} />
                    </tr>
                    <tr>
                        <th className="sheet-label-green">?????/th>
                        <td className="sheet-value-light">
                            <input
                                list="workbook-partner-options"
                                value={ledgerDraft.partnerName}
                                onChange={(event) => setLedgerDraft((prev) => ({ ...prev, partnerName: event.target.value }))}
                                placeholder="????????"
                            />
                        </td>
                        <td className="sheet-spacer" colSpan={4} />
                        <td className="sheet-button-wrap" colSpan={2}>
                            <button type="button" className="excel-button excel-button-green" onClick={applyLedgerFilter}>
                                <FontAwesomeIcon icon={faMagnifyingGlass} />
                                ???
                            </button>
                        </td>
                    </tr>
                    <tr>
                        <th className="sheet-label-green">?????/th>
                        <td className="sheet-value-light">
                            <input
                                list="workbook-site-options"
                                value={ledgerDraft.siteName}
                                onChange={(event) => setLedgerDraft((prev) => ({ ...prev, siteName: event.target.value }))}
                                placeholder="??? ???"
                            />
                        </td>
                        <td className="sheet-spacer" colSpan={6} />
                    </tr>
                </tbody>
            </table>

            <div className="sheet-merged-heading">
                {ledgerFilter.partnerName || `${ledgerFilter.transactionType} ?????}
            </div>

            <div className="sheet-table-wrapper">
                <table className="sheet-table">
                    <thead>
                        <tr>
                            <th>???</th>
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
                                <td colSpan={8} className="sheet-empty-state">??? ????? ??????.</td>
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
                            <td>????/td>
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
                        <th className="sheet-title-dark" colSpan={12}>?????? ????????</th>
                    </tr>
                    <tr>
                        <th className="sheet-label-dark">???</th>
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
                        <th className="sheet-label-blue">?????/th>
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
                        <th className="sheet-label-blue">?????/th>
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
                        <th className="sheet-label-green">?? ??/th>
                        <td className="sheet-value-light">
                            <input
                                list="workbook-team-options"
                                value={summaryDraft.teamName}
                                onChange={(event) => setSummaryDraft((prev) => ({ ...prev, teamName: event.target.value }))}
                                placeholder="???"
                            />
                        </td>
                        <td className="sheet-spacer" colSpan={10} />
                    </tr>
                    <tr>
                        <th className="sheet-label-green">????/th>
                        <td className="sheet-value-light">
                            <select
                                value={summaryDraft.mode}
                                onChange={(event) => setSummaryDraft((prev) => ({ ...prev, mode: event.target.value as SummaryMode }))}
                            >
                                <option value="???">???</option>
                                <option value="???">???</option>
                                <option value="?????>?????/option>
                                <option value="??????">??????</option>
                            </select>
                        </td>
                        <td className="sheet-spacer" colSpan={10} />
                    </tr>
                    <tr>
                        <th className="sheet-label-green">?????/th>
                        <td className="sheet-value-light">
                            <input
                                list="workbook-partner-options"
                                value={summaryDraft.partnerName}
                                onChange={(event) => setSummaryDraft((prev) => ({ ...prev, partnerName: event.target.value }))}
                                placeholder="????????"
                            />
                        </td>
                        <td className="sheet-spacer" colSpan={8} />
                        <td className="sheet-button-wrap" colSpan={2}>
                            <button type="button" className="excel-button excel-button-green" onClick={applySummaryFilter}>
                                <FontAwesomeIcon icon={faMagnifyingGlass} />
                                ???
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
                        </tr>
                    </thead>
                    <tbody>
                        {summaryRows.length === 0 && (
                            <tr>
                                <td colSpan={12} className="sheet-empty-state">??? ????? ??????.</td>
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
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td />
                            <td>????/td>
                            <td />
                            <td />
                            <td className="align-right">{formatNumber(summaryTotals.supplyAmount)}</td>
                            <td className="align-right">{formatNumber(summaryTotals.taxAmount)}</td>
                            <td className="align-right">{formatNumber(summaryTotals.totalAmount)}</td>
                            <td />
                            <td className="align-right">{formatNumber(summaryTotals.settledAmount)}</td>
                            <td className="align-right">{formatNumber(summaryTotals.outstandingAmount)}</td>
                            <td colSpan={2} />
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
                        <h1>?????? Pro Ver 2.5 (???)</h1>
                        <p>??? ?????? UI?????????? ??? ??? ??? ??????????</p>
                    </div>
                    <div className="workbook-title-actions">
                        <button type="button" className="workbook-toolbar-button" onClick={refreshPageData} disabled={loading}>
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

                <div className="workbook-status-bar">
                    <span><FontAwesomeIcon icon={faDatabase} /> ????? ??? ?? {entries.length.toLocaleString()}??/span>
                    <span><FontAwesomeIcon icon={faTableCellsLarge} /> ??? ??????: {baseYear}??/span>
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
