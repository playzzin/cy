import {
    collection,
    doc,
    getDocs,
    writeBatch
} from 'firebase/firestore';
import { db } from '../config/firebase';

export type WorkbookTransactionType = '매출' | '매입';

export interface WorkbookLedgerEntry {
    id?: string;
    transactionType: WorkbookTransactionType;
    date: string;
    partnerName: string;
    siteName: string;
    description: string;
    manDays?: number | null;
    supplyAmount: number;
    taxAmount: number;
    totalAmount: number;
    paymentAmount: number;
    appliedYear?: number | null;
    appliedMonth?: number | null;
    matchedEntryId?: string;
    note?: string;
    teamName?: string;
    createdAt?: string;
    updatedAt?: string;
    createdBy?: string;
}

type WorkbookLedgerEntryInput = Omit<WorkbookLedgerEntry, 'id' | 'createdAt' | 'updatedAt'>;

const COLLECTION_NAME = 'sales_purchase_workbook_entries';
const BATCH_SIZE = 400;

const normalizeNumber = (value: unknown): number => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
        const parsed = Number(value.replace(/,/g, '').trim());
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
};

const normalizeInteger = (value: unknown): number | null => {
    const parsed = normalizeNumber(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : null;
};

const normalizeText = (value: unknown): string => {
    return typeof value === 'string' ? value.trim() : '';
};

const sortEntries = (left: WorkbookLedgerEntry, right: WorkbookLedgerEntry) => {
    const dateCompare = (left.date ?? '').localeCompare(right.date ?? '', 'en');
    if (dateCompare !== 0) return dateCompare;

    const createdCompare = (left.createdAt ?? '').localeCompare(right.createdAt ?? '', 'en');
    if (createdCompare !== 0) return createdCompare;

    return (left.id ?? '').localeCompare(right.id ?? '', 'en');
};

const sanitizeEntry = (entry: WorkbookLedgerEntryInput, timestamp: string) => ({
    transactionType: entry.transactionType,
    date: normalizeText(entry.date),
    partnerName: normalizeText(entry.partnerName),
    siteName: normalizeText(entry.siteName),
    description: normalizeText(entry.description),
    manDays: entry.manDays === null || entry.manDays === undefined ? null : normalizeNumber(entry.manDays),
    supplyAmount: normalizeNumber(entry.supplyAmount),
    taxAmount: normalizeNumber(entry.taxAmount),
    totalAmount: normalizeNumber(entry.totalAmount),
    paymentAmount: normalizeNumber(entry.paymentAmount),
    appliedYear: normalizeInteger(entry.appliedYear),
    appliedMonth: normalizeInteger(entry.appliedMonth),
    matchedEntryId: normalizeText(entry.matchedEntryId) || null,
    note: normalizeText(entry.note),
    teamName: normalizeText(entry.teamName),
    createdBy: normalizeText(entry.createdBy) || null,
    createdAt: timestamp,
    updatedAt: timestamp
});

export const workbookLedgerService = {
    async getEntries(): Promise<WorkbookLedgerEntry[]> {
        const snapshot = await getDocs(collection(db, COLLECTION_NAME));
        const entries = snapshot.docs.map((entryDoc) => {
            const data = entryDoc.data() as Record<string, unknown>;

            return {
                id: entryDoc.id,
                transactionType: (data.transactionType === '매입' ? '매입' : '매출') as WorkbookTransactionType,
                date: normalizeText(data.date),
                partnerName: normalizeText(data.partnerName),
                siteName: normalizeText(data.siteName),
                description: normalizeText(data.description),
                manDays: data.manDays === null || data.manDays === undefined ? null : normalizeNumber(data.manDays),
                supplyAmount: normalizeNumber(data.supplyAmount),
                taxAmount: normalizeNumber(data.taxAmount),
                totalAmount: normalizeNumber(data.totalAmount),
                paymentAmount: normalizeNumber(data.paymentAmount),
                appliedYear: normalizeInteger(data.appliedYear),
                appliedMonth: normalizeInteger(data.appliedMonth),
                matchedEntryId: normalizeText(data.matchedEntryId),
                note: normalizeText(data.note),
                teamName: normalizeText(data.teamName),
                createdAt: normalizeText(data.createdAt),
                updatedAt: normalizeText(data.updatedAt),
                createdBy: normalizeText(data.createdBy)
            } as WorkbookLedgerEntry;
        });

        entries.sort(sortEntries);
        return entries;
    },

    async addEntries(entries: WorkbookLedgerEntryInput[]): Promise<void> {
        if (entries.length === 0) return;

        const now = new Date().toISOString();

        for (let index = 0; index < entries.length; index += BATCH_SIZE) {
            const batch = writeBatch(db);
            const chunk = entries.slice(index, index + BATCH_SIZE);

            chunk.forEach((entry) => {
                const entryRef = doc(collection(db, COLLECTION_NAME));
                batch.set(entryRef, sanitizeEntry(entry, now));
            });

            await batch.commit();
        }
    }
};
