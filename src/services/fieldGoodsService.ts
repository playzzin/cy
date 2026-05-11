import {
    collection,
    deleteDoc,
    doc,
    getDocs,
    onSnapshot,
    setDoc,
    updateDoc,
    writeBatch,
} from 'firebase/firestore';
import type { DocumentData, FirestoreError, QuerySnapshot, Unsubscribe } from 'firebase/firestore';
import { db } from '../config/firebase';

export type FieldGoodsTransactionKind = 'purchase' | 'issue';
export type FieldGoodsTransactionSource = 'manual' | 'excel';

export interface FieldGoodsItem {
    id: string;
    name: string;
    unit: string;
    purchasePrice: number;
    salePrice: number;
    active: boolean;
    sortOrder?: number;
    createdAt?: string;
    updatedAt?: string;
    deletedAt?: string | null;
}

export interface FieldGoodsTransaction {
    id: string;
    date: string;
    teamId: string;
    teamName: string;
    kind: FieldGoodsTransactionKind;
    itemId: string;
    itemName: string;
    unit: string;
    quantity: number;
    purchasePrice: number;
    salePrice: number;
    memo: string;
    source: FieldGoodsTransactionSource;
    createdAt: string;
    updatedAt?: string;
}

export type FieldGoodsItemInput = Omit<FieldGoodsItem, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>;
export type FieldGoodsTransactionInput = Omit<FieldGoodsTransaction, 'id' | 'createdAt' | 'updatedAt'>;

const ITEMS_COLLECTION = 'fieldGoodsItems';
const TRANSACTIONS_COLLECTION = 'fieldGoodsTransactions';
const FIRESTORE_BATCH_LIMIT = 450;

const nowIso = (): string => new Date().toISOString();

const normalizeNumber = (value: unknown): number => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const parsed = Number(String(value ?? '').replace(/[^\d.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeItem = (raw: Record<string, any>): FieldGoodsItem => ({
    id: String(raw.id || ''),
    name: String(raw.name || '').trim(),
    unit: String(raw.unit || 'EA').trim() || 'EA',
    purchasePrice: normalizeNumber(raw.purchasePrice),
    salePrice: normalizeNumber(raw.salePrice),
    active: raw.active !== false,
    sortOrder: normalizeNumber(raw.sortOrder),
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : undefined,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : undefined,
    deletedAt: typeof raw.deletedAt === 'string' ? raw.deletedAt : null,
});

const normalizeTransaction = (raw: Record<string, any>): FieldGoodsTransaction => ({
    id: String(raw.id || ''),
    date: String(raw.date || '').slice(0, 10),
    teamId: String(raw.teamId || ''),
    teamName: String(raw.teamName || ''),
    kind: raw.kind === 'purchase' ? 'purchase' : 'issue',
    itemId: String(raw.itemId || ''),
    itemName: String(raw.itemName || ''),
    unit: String(raw.unit || 'EA') || 'EA',
    quantity: normalizeNumber(raw.quantity),
    purchasePrice: normalizeNumber(raw.purchasePrice),
    salePrice: normalizeNumber(raw.salePrice),
    memo: String(raw.memo || ''),
    source: raw.source === 'excel' ? 'excel' : 'manual',
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : nowIso(),
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : undefined,
});

const stripUndefined = <T extends Record<string, unknown>>(value: T): T =>
    Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;

const mapItemsSnapshot = (snap: QuerySnapshot<DocumentData>): FieldGoodsItem[] =>
    snap.docs
        .map((entry) => normalizeItem({ id: entry.id, ...entry.data() }))
        .sort((left, right) => {
            const sortCompare = (left.sortOrder ?? 0) - (right.sortOrder ?? 0);
            if (sortCompare !== 0) return sortCompare;
            return left.name.localeCompare(right.name, 'ko-KR');
        });

const mapTransactionsSnapshot = (snap: QuerySnapshot<DocumentData>): FieldGoodsTransaction[] =>
    snap.docs
        .map((entry) => normalizeTransaction({ id: entry.id, ...entry.data() }))
        .sort((left, right) => {
            const dateCompare = right.date.localeCompare(left.date);
            if (dateCompare !== 0) return dateCompare;
            return right.createdAt.localeCompare(left.createdAt);
        });

const chunkRows = <T>(rows: T[], size: number): T[][] => {
    const chunks: T[][] = [];
    for (let index = 0; index < rows.length; index += size) {
        chunks.push(rows.slice(index, index + size));
    }
    return chunks;
};

export const fieldGoodsService = {
    async getItems(): Promise<FieldGoodsItem[]> {
        const snap = await getDocs(collection(db, ITEMS_COLLECTION));
        return mapItemsSnapshot(snap);
    },

    subscribeItems(
        onChange: (items: FieldGoodsItem[]) => void,
        onError?: (error: FirestoreError) => void
    ): Unsubscribe {
        return onSnapshot(collection(db, ITEMS_COLLECTION), (snap) => onChange(mapItemsSnapshot(snap)), onError);
    },

    async addItem(input: FieldGoodsItemInput): Promise<FieldGoodsItem> {
        const ref = doc(collection(db, ITEMS_COLLECTION));
        const timestamp = nowIso();
        const item: FieldGoodsItem = {
            ...input,
            id: ref.id,
            name: input.name.trim(),
            unit: input.unit.trim() || 'EA',
            purchasePrice: normalizeNumber(input.purchasePrice),
            salePrice: normalizeNumber(input.salePrice),
            active: input.active !== false,
            sortOrder: normalizeNumber(input.sortOrder),
            createdAt: timestamp,
            updatedAt: timestamp,
            deletedAt: null,
        };
        await setDoc(ref, item);
        return item;
    },

    async updateItem(id: string, updates: Partial<FieldGoodsItemInput>): Promise<void> {
        await updateDoc(
            doc(db, ITEMS_COLLECTION, id),
            stripUndefined({
                ...updates,
                name: updates.name?.trim(),
                unit: updates.unit?.trim(),
                purchasePrice:
                    updates.purchasePrice === undefined ? undefined : normalizeNumber(updates.purchasePrice),
                salePrice: updates.salePrice === undefined ? undefined : normalizeNumber(updates.salePrice),
                updatedAt: nowIso(),
            })
        );
    },

    async deleteItem(id: string): Promise<void> {
        await updateDoc(doc(db, ITEMS_COLLECTION, id), {
            active: false,
            deletedAt: nowIso(),
            updatedAt: nowIso(),
        });
    },

    async restoreItem(id: string): Promise<void> {
        await updateDoc(doc(db, ITEMS_COLLECTION, id), {
            active: true,
            deletedAt: null,
            updatedAt: nowIso(),
        });
    },

    async getTransactions(): Promise<FieldGoodsTransaction[]> {
        const snap = await getDocs(collection(db, TRANSACTIONS_COLLECTION));
        return mapTransactionsSnapshot(snap);
    },

    subscribeTransactions(
        onChange: (transactions: FieldGoodsTransaction[]) => void,
        onError?: (error: FirestoreError) => void
    ): Unsubscribe {
        return onSnapshot(
            collection(db, TRANSACTIONS_COLLECTION),
            (snap) => onChange(mapTransactionsSnapshot(snap)),
            onError
        );
    },

    async addTransactionsBatch(inputs: FieldGoodsTransactionInput[]): Promise<FieldGoodsTransaction[]> {
        if (!inputs.length) return [];

        const timestamp = nowIso();
        const rows = inputs.map((input) => {
            const ref = doc(collection(db, TRANSACTIONS_COLLECTION));
            const row: FieldGoodsTransaction = {
                ...input,
                id: ref.id,
                date: input.date,
                teamName: input.teamName.trim(),
                itemName: input.itemName.trim(),
                unit: input.unit.trim() || 'EA',
                quantity: normalizeNumber(input.quantity),
                purchasePrice: normalizeNumber(input.purchasePrice),
                salePrice: normalizeNumber(input.salePrice),
                memo: input.memo.trim(),
                createdAt: timestamp,
                updatedAt: timestamp,
            };
            return { ref, row };
        });

        for (const chunk of chunkRows(rows, FIRESTORE_BATCH_LIMIT)) {
            const batch = writeBatch(db);
            chunk.forEach(({ ref, row }) => batch.set(ref, row));
            await batch.commit();
        }

        return rows.map(({ row }) => row);
    },

    async updateTransaction(
        id: string,
        updates: Partial<FieldGoodsTransactionInput>
    ): Promise<void> {
        await updateDoc(
            doc(db, TRANSACTIONS_COLLECTION, id),
            stripUndefined({
                ...updates,
                teamName: updates.teamName?.trim(),
                itemName: updates.itemName?.trim(),
                unit: updates.unit?.trim(),
                quantity: updates.quantity === undefined ? undefined : normalizeNumber(updates.quantity),
                purchasePrice:
                    updates.purchasePrice === undefined ? undefined : normalizeNumber(updates.purchasePrice),
                salePrice: updates.salePrice === undefined ? undefined : normalizeNumber(updates.salePrice),
                memo: updates.memo?.trim(),
                updatedAt: nowIso(),
            })
        );
    },

    async deleteTransaction(id: string): Promise<void> {
        await deleteDoc(doc(db, TRANSACTIONS_COLLECTION, id));
    },
};

export default fieldGoodsService;
