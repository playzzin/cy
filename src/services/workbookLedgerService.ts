import {
    collection,
    doc,
    getDocs,
    updateDoc,
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
    updatedBy?: string;
    deletedAt?: string;
    deletedBy?: string;
}

type WorkbookLedgerEntryInput = Omit<WorkbookLedgerEntry, 'id' | 'createdAt' | 'updatedAt'>;
type WorkbookLedgerEntryUpdate = Partial<Omit<WorkbookLedgerEntry, 'id' | 'createdAt' | 'createdBy' | 'deletedAt' | 'deletedBy'>>;

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
    updatedBy: normalizeText(entry.updatedBy) || null,
    createdAt: timestamp,
    updatedAt: timestamp
});

const sanitizeUpdate = (entry: WorkbookLedgerEntryUpdate, timestamp: string) => {
    const payload: Record<string, unknown> = {
        updatedAt: timestamp
    };

    if (entry.transactionType !== undefined) payload.transactionType = entry.transactionType;
    if (entry.date !== undefined) payload.date = normalizeText(entry.date);
    if (entry.partnerName !== undefined) payload.partnerName = normalizeText(entry.partnerName);
    if (entry.siteName !== undefined) payload.siteName = normalizeText(entry.siteName);
    if (entry.description !== undefined) payload.description = normalizeText(entry.description);
    if (entry.manDays !== undefined) payload.manDays = entry.manDays === null ? null : normalizeNumber(entry.manDays);
    if (entry.supplyAmount !== undefined) payload.supplyAmount = normalizeNumber(entry.supplyAmount);
    if (entry.taxAmount !== undefined) payload.taxAmount = normalizeNumber(entry.taxAmount);
    if (entry.totalAmount !== undefined) payload.totalAmount = normalizeNumber(entry.totalAmount);
    if (entry.paymentAmount !== undefined) payload.paymentAmount = normalizeNumber(entry.paymentAmount);
    if (entry.appliedYear !== undefined) payload.appliedYear = entry.appliedYear === null ? null : normalizeInteger(entry.appliedYear);
    if (entry.appliedMonth !== undefined) payload.appliedMonth = entry.appliedMonth === null ? null : normalizeInteger(entry.appliedMonth);
    if (entry.matchedEntryId !== undefined) payload.matchedEntryId = normalizeText(entry.matchedEntryId) || null;
    if (entry.note !== undefined) payload.note = normalizeText(entry.note);
    if (entry.teamName !== undefined) payload.teamName = normalizeText(entry.teamName);
    if (entry.updatedBy !== undefined) payload.updatedBy = normalizeText(entry.updatedBy) || null;

    return payload;
};

export const workbookLedgerService = {
    async getEntries(): Promise<WorkbookLedgerEntry[]> {
        const snapshot = await getDocs(collection(db, COLLECTION_NAME));
        const entries = snapshot.docs.map((entryDoc) => {
            const data = entryDoc.data() as Record<string, unknown>;
            const deletedAt = normalizeText(data.deletedAt);

            if (deletedAt) return null;

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
                createdBy: normalizeText(data.createdBy),
                updatedBy: normalizeText(data.updatedBy),
                deletedAt,
                deletedBy: normalizeText(data.deletedBy)
            } as WorkbookLedgerEntry;
        }).filter((entry): entry is WorkbookLedgerEntry => entry !== null);

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
    },

    async updateEntry(id: string, updates: WorkbookLedgerEntryUpdate): Promise<void> {
        const now = new Date().toISOString();
        await updateDoc(doc(collection(db, COLLECTION_NAME), id), sanitizeUpdate(updates, now));
    },

    async softDeleteEntry(id: string, deletedBy?: string): Promise<void> {
        const now = new Date().toISOString();
        await updateDoc(doc(collection(db, COLLECTION_NAME), id), {
            deletedAt: now,
            deletedBy: normalizeText(deletedBy) || null,
            updatedAt: now
        });
    }
};
