import {
    collection,
    deleteDoc,
    doc,
    getDocs,
    query,
    serverTimestamp,
    setDoc,
    where,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { stripUndefinedFields } from '../utils/stripUndefinedFields';

const COLLECTION_NAME = 'buyback_workbook_entries';

export type BuybackWorkbookPaymentStatus = 'unpaid' | 'paid';

export interface BuybackWorkbookEntry {
    id: string;
    targetId: string;
    targetName: string;
    date: string;
    year: string;
    month: string;
    /** 현장 DB를 연결하기 전에는 비워 두고 현장명만 직접 입력합니다. */
    siteId?: string;
    siteName: string;
    preTax: number;
    afterTax?: number;
    afterTaxManual: boolean;
    note: string;
    paymentStatus: BuybackWorkbookPaymentStatus;
    createdAt?: unknown;
    updatedAt?: unknown;
}

export type BuybackWorkbookEntryInput = Omit<BuybackWorkbookEntry, 'createdAt' | 'updatedAt'>;

const normalizeMoney = (value: unknown): number => {
    const numeric = Number(value ?? 0);
    return Number.isFinite(numeric) ? Math.max(0, Math.round(numeric)) : 0;
};

const normalizeEntry = (id: string, value: Record<string, unknown>): BuybackWorkbookEntry => {
    const legacyDate = String(value.date ?? '').trim();
    const legacyMatch = legacyDate.match(/^(\d{4})-(\d{1,2})/);
    const yearValue = String(value.year ?? legacyMatch?.[1] ?? '').trim();
    const monthNumber = Number(value.month ?? legacyMatch?.[2] ?? 0);
    const year = /^\d{4}$/.test(yearValue) ? yearValue : '';
    const month = monthNumber >= 1 && monthNumber <= 12 ? String(monthNumber).padStart(2, '0') : '';

    return {
        id,
        targetId: String(value.targetId ?? '').trim(),
        targetName: String(value.targetName ?? '').trim(),
        date: year && month ? `${year}-${month}` : '',
        year,
        month,
        siteId: String(value.siteId ?? '').trim() || undefined,
        siteName: String(value.siteName ?? '').trim(),
        preTax: normalizeMoney(value.preTax),
        afterTax: value.afterTax === undefined ? undefined : normalizeMoney(value.afterTax),
        afterTaxManual: Boolean(value.afterTaxManual),
        note: String(value.note ?? ''),
        paymentStatus: value.paymentStatus === 'paid' ? 'paid' : 'unpaid',
        createdAt: value.createdAt,
        updatedAt: value.updatedAt,
    };
};

const chunksOf = <T,>(values: T[], size: number): T[][] => {
    const chunks: T[][] = [];
    for (let index = 0; index < values.length; index += size) chunks.push(values.slice(index, index + size));
    return chunks;
};

export const buybackWorkbookService = {
    async getEntriesByTargetIds(targetIds: string[]): Promise<BuybackWorkbookEntry[]> {
        const normalizedTargetIds = Array.from(new Set(targetIds.map((id) => id.trim()).filter(Boolean)));
        if (normalizedTargetIds.length === 0) return [];

        const snapshots = await Promise.all(
            chunksOf(normalizedTargetIds, 30).map((targetIdChunk) => getDocs(query(
                collection(db, COLLECTION_NAME),
                where('targetId', 'in', targetIdChunk)
            )))
        );

        return snapshots
            .flatMap((snapshot) => snapshot.docs.map((entry) => normalizeEntry(entry.id, entry.data())))
            .sort((left, right) => left.date.localeCompare(right.date) || left.id.localeCompare(right.id));
    },

    async saveEntry(entry: BuybackWorkbookEntryInput): Promise<void> {
        const year = /^\d{4}$/.test(entry.year.trim()) ? entry.year.trim() : '';
        const monthNumber = Number(entry.month);
        const month = monthNumber >= 1 && monthNumber <= 12 ? String(monthNumber).padStart(2, '0') : '';
        const payload = stripUndefinedFields({
            targetId: entry.targetId.trim(),
            targetName: entry.targetName.trim(),
            date: year && month ? `${year}-${month}` : '',
            year,
            month,
            siteId: entry.siteId?.trim() || undefined,
            siteName: entry.siteName.trim(),
            preTax: normalizeMoney(entry.preTax),
            afterTax: entry.afterTax === undefined ? undefined : normalizeMoney(entry.afterTax),
            afterTaxManual: Boolean(entry.afterTaxManual),
            note: entry.note,
            paymentStatus: entry.paymentStatus === 'paid' ? 'paid' : 'unpaid',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });

        await setDoc(doc(db, COLLECTION_NAME, entry.id), payload, { merge: true });
    },

    async deleteEntry(id: string): Promise<void> {
        await deleteDoc(doc(db, COLLECTION_NAME, id));
    },
};
