import type {
    WorkbookLedgerEntry,
    WorkbookTransactionType,
} from '../services/workbookLedgerService';

export interface WorkbookReceivableRow {
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
    settledAmount: number;
    outstandingAmount: number;
    paymentDates: string[];
    settlementEntryIds: string[];
    note: string;
    teamName: string;
}

export interface WorkbookReceivableFilter {
    startDate: string;
    endDate: string;
    transactionType?: WorkbookTransactionType;
    settlementOnly?: boolean;
    partnerName?: string;
    siteName?: string;
    teamName?: string;
}

const formatDateInput = (date: Date) => (
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
);

const normalizeText = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

export const normalizeWorkbookPartnerKey = (value: unknown) => normalizeText(value)
    .toLowerCase()
    .replace(/\(주\)|㈜|주식회사/g, '')
    .replace(/\s+/g, '')
    .replace(/[^0-9a-z가-힣]/g, '');

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

const isInvoiceEntry = (entry: WorkbookLedgerEntry) => (entry.totalAmount ?? 0) > 0;
const isNegativeInvoiceEntry = (entry: WorkbookLedgerEntry) => (entry.totalAmount ?? 0) < 0;
const isPaymentEntry = (entry: WorkbookLedgerEntry) => (entry.paymentAmount ?? 0) > 0;

const sortWorkbookEntries = (left: WorkbookLedgerEntry, right: WorkbookLedgerEntry) => {
    const dateCompare = (left.date ?? '').localeCompare(right.date ?? '', 'en');
    if (dateCompare !== 0) return dateCompare;

    const createdCompare = (left.createdAt ?? '').localeCompare(right.createdAt ?? '', 'en');
    if (createdCompare !== 0) return createdCompare;

    return (left.id ?? '').localeCompare(right.id ?? '', 'en');
};

const sortReceivableRowsByDate = (left: WorkbookReceivableRow, right: WorkbookReceivableRow) => {
    const dateCompare = (left.issueDate ?? '').localeCompare(right.issueDate ?? '', 'en');
    if (dateCompare !== 0) return dateCompare;

    const partnerCompare = (left.partnerName ?? '').localeCompare(right.partnerName ?? '', 'ko-KR', {
        numeric: true,
        sensitivity: 'base',
    });
    if (partnerCompare !== 0) return partnerCompare;

    return (left.id ?? '').localeCompare(right.id ?? '', 'en');
};

const matchesFilter = (source: string | undefined, keyword: string | undefined) => {
    const text = normalizeText(keyword);
    if (!text) return true;
    return (source ?? '').toLowerCase().includes(text.toLowerCase());
};

const isDateWithinRange = (date: string | undefined, startDate: string, endDate: string) => {
    const normalizedDate = normalizeDate(date);
    if (!normalizedDate) return false;
    return normalizedDate >= startDate && normalizedDate <= endDate;
};

const getWorkbookEntryKey = (entry: Pick<WorkbookLedgerEntry, 'id' | 'date' | 'partnerName' | 'description'>) => (
    entry.id ?? `${entry.date}-${entry.partnerName}-${entry.description}`
);

const appendSummaryNote = (currentNote: string, nextNote: unknown) => {
    const current = normalizeText(currentNote);
    const next = normalizeText(nextNote);

    if (!next) return current;
    if (!current) return next;
    if (current.split(' / ').includes(next)) return current;

    return `${current} / ${next}`;
};

export const buildWorkbookReceivableRows = (
    entries: WorkbookLedgerEntry[],
    filter: WorkbookReceivableFilter,
): WorkbookReceivableRow[] => {
    const transactionType: WorkbookTransactionType = filter.transactionType ?? '매출';
    const startDate = normalizeDate(filter.startDate);
    const endDate = normalizeDate(filter.endDate);
    const paymentCutoffDate = endDate;

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

    type WorkingReceivableRow = WorkbookReceivableRow & { remainingAmount: number };
    const invoices: WorkingReceivableRow[] = positiveInvoiceEntries.map((entry) => ({
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
        settlementEntryIds: [],
        remainingAmount: entry.totalAmount ?? 0,
        note: entry.note ?? '',
        teamName: entry.teamName ?? '',
    }));

    const adjustmentRowsById = new Map<string, WorkbookReceivableRow>();
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
            settlementEntryIds: [],
            note: entry.note ?? '',
            teamName: entry.teamName ?? '',
        });
    });

    const invoiceById = new Map<string, WorkingReceivableRow>();
    const invoicesByPartner = new Map<string, WorkingReceivableRow[]>();
    invoices.forEach((invoice) => {
        invoiceById.set(invoice.id, invoice);

        const partnerKey = normalizeWorkbookPartnerKey(invoice.partnerName);
        if (!partnerKey) return;

        const bucket = invoicesByPartner.get(partnerKey) ?? [];
        bucket.push(invoice);
        invoicesByPartner.set(partnerKey, bucket);
    });

    const paymentEntries = entries
        .filter((entry) => entry.transactionType === transactionType)
        .filter(isPaymentEntry)
        .filter((entry) => {
            const paymentDate = normalizeDate(entry.date);
            if (!paymentDate) return false;
            return paymentDate <= paymentCutoffDate;
        })
        .filter((entry) => matchesFilter(entry.teamName, filter.teamName))
        .filter((entry) => matchesFilter(entry.partnerName, filter.partnerName))
        .filter((entry) => matchesFilter(entry.siteName, filter.siteName))
        .sort(sortWorkbookEntries);

    const applyPaymentToInvoice = (
        invoice: WorkingReceivableRow,
        paymentAmount: number,
        paymentDate: string,
        options?: { recordDate?: boolean; note?: string; sourceEntryId?: string },
    ) => {
        if (paymentAmount <= 0) return paymentAmount;

        const appliedAmount = invoice.remainingAmount > 0
            ? Math.min(invoice.remainingAmount, paymentAmount)
            : 0;
        if (appliedAmount <= 0) return paymentAmount;

        invoice.settledAmount += appliedAmount;
        invoice.remainingAmount = Math.max(invoice.remainingAmount - appliedAmount, 0);
        invoice.outstandingAmount = invoice.remainingAmount;
        if ((options?.recordDate ?? true) && paymentDate && !invoice.paymentDates.includes(paymentDate)) {
            invoice.paymentDates = [...invoice.paymentDates, paymentDate].sort((left, right) => left.localeCompare(right, 'en'));
        }
        if (options?.sourceEntryId && !invoice.settlementEntryIds.includes(options.sourceEntryId)) {
            invoice.settlementEntryIds = [...invoice.settlementEntryIds, options.sourceEntryId];
        }
        invoice.note = appendSummaryNote(invoice.note, options?.note);

        return paymentAmount - appliedAmount;
    };

    const findDirectOffsetInvoice = (adjustmentEntry: WorkbookLedgerEntry) => {
        const exactAmount = Math.abs(adjustmentEntry.totalAmount ?? 0);
        if (exactAmount <= 0) return null;

        const partnerKey = normalizeWorkbookPartnerKey(adjustmentEntry.partnerName);
        if (!partnerKey) return null;

        const adjustmentDate = normalizeDate(adjustmentEntry.date);
        const normalizedSiteName = normalizeText(adjustmentEntry.siteName).toLowerCase();
        const normalizedDescription = normalizeText(adjustmentEntry.description).toLowerCase();
        const normalizedTeamName = normalizeText(adjustmentEntry.teamName).toLowerCase();
        const appliedYear = adjustmentEntry.appliedYear ?? null;
        const appliedMonth = adjustmentEntry.appliedMonth ?? null;

        const directCandidates = positiveInvoiceEntries.filter((invoiceEntry) => {
            if (normalizeWorkbookPartnerKey(invoiceEntry.partnerName) !== partnerKey) return false;
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
        const partnerKey = normalizeWorkbookPartnerKey(paymentEntry.partnerName);
        if (!partnerKey) return null;

        const partnerInvoices = invoicesByPartner.get(partnerKey) ?? [];
        if (!partnerInvoices.length) return null;

        const paymentDate = normalizeDate(paymentEntry.date);
        const normalizedSiteName = normalizeText(paymentEntry.siteName).toLowerCase();
        const normalizedTeamName = normalizeText(paymentEntry.teamName).toLowerCase();
        const appliedYear = paymentEntry.appliedYear ?? null;
        const appliedMonth = paymentEntry.appliedMonth ?? null;

        const matchesBaseConditions = (invoice: WorkingReceivableRow) => {
            if (paymentDate && invoice.issueDate > paymentDate) return false;
            if (normalizedSiteName && normalizeText(invoice.siteName).toLowerCase() !== normalizedSiteName) return false;
            if (normalizedTeamName && normalizeText(invoice.teamName).toLowerCase() !== normalizedTeamName) return false;
            return true;
        };

        const resolveExactAmountCandidate = (candidates: WorkingReceivableRow[]) => {
            if (!(exactAmount && exactAmount > 0)) return null;

            const exactMatches = candidates.filter((invoice) => (
                Math.abs((invoice.totalAmount ?? 0) - exactAmount) < 0.5 ||
                Math.abs((invoice.remainingAmount ?? 0) - exactAmount) < 0.5
            ));
            return exactMatches.length === 1 ? exactMatches[0] : null;
        };

        const resolveUniqueOutstandingCandidate = (candidates: WorkingReceivableRow[]) => {
            const outstandingCandidates = candidates.filter((invoice) => (invoice.remainingAmount ?? 0) > 0);
            return outstandingCandidates.length === 1 ? outstandingCandidates[0] : null;
        };

        const strictCandidates = partnerInvoices.filter((invoice) => {
            if (!matchesBaseConditions(invoice)) return false;
            if (appliedYear !== null && invoice.appliedYear !== appliedYear) return false;
            if (appliedMonth !== null && invoice.appliedMonth !== appliedMonth) return false;
            return true;
        });

        if (strictCandidates.length === 1) return strictCandidates[0];

        const strictOutstandingCandidate = resolveUniqueOutstandingCandidate(strictCandidates);
        if (strictOutstandingCandidate) return strictOutstandingCandidate;

        const strictExactAmountMatch = resolveExactAmountCandidate(strictCandidates);
        if (strictExactAmountMatch) return strictExactAmountMatch;

        const relaxedCandidates = partnerInvoices.filter(matchesBaseConditions);
        if (relaxedCandidates.length === 1) return relaxedCandidates[0];

        const relaxedOutstandingCandidate = resolveUniqueOutstandingCandidate(relaxedCandidates);
        if (relaxedOutstandingCandidate) return relaxedOutstandingCandidate;

        const relaxedExactAmountMatch = resolveExactAmountCandidate(relaxedCandidates);
        if (relaxedExactAmountMatch) return relaxedExactAmountMatch;

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
                applyPaymentToInvoice(matchedInvoice, paymentAmount, paymentEntry.date, {
                    note: paymentEntry.note,
                    sourceEntryId: paymentEntryKey,
                });
            }
            return;
        }

        if (selfInvoice) {
            applyPaymentToInvoice(selfInvoice, paymentAmount, paymentEntry.date, {
                note: paymentEntry.note,
                sourceEntryId: paymentEntryKey,
            });
            return;
        }

        const legacyMatchedInvoice = findLegacyMatchedInvoice(paymentEntry, paymentAmount);
        if (legacyMatchedInvoice) {
            applyPaymentToInvoice(legacyMatchedInvoice, paymentAmount, paymentEntry.date, {
                note: paymentEntry.note,
                sourceEntryId: paymentEntryKey,
            });
        }
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
        }
    });

    const finalizedPositiveRowsById = new Map<string, WorkbookReceivableRow>();
    invoices.forEach(({ remainingAmount, ...row }) => {
        finalizedPositiveRowsById.set(row.id, row);
    });

    const finalizedRows = summaryInvoiceEntries
        .map((entry) => {
            const entryId = getWorkbookEntryKey(entry);
            if (isInvoiceEntry(entry)) return finalizedPositiveRowsById.get(entryId) ?? null;
            if (isNegativeInvoiceEntry(entry)) return adjustmentRowsById.get(entryId) ?? null;
            return null;
        })
        .filter((row): row is WorkbookReceivableRow => Boolean(row))
        .filter((row) => isDateWithinRange(row.issueDate, startDate, endDate));

    if (filter.settlementOnly) {
        return finalizedRows
            .filter((row) => row.outstandingAmount > 0)
            .sort(sortReceivableRowsByDate);
    }

    return finalizedRows.sort(sortReceivableRowsByDate);
};
