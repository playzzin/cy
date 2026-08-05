import {
    collection,
    doc,
    getDoc,
    getDocs,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import {
    SettlementTargetSchema,
    SettlementTargetZod as SettlementTarget,
} from '../types/zod/settlementTargetSchema';
import { createConverter } from '../utils/firestoreConverter';
import { stripUndefinedFields } from '../utils/stripUndefinedFields';
import { toast } from '../utils/swal';

export type { SettlementTarget };
export type {
    SettlementTargetProcessType,
    SettlementTargetStatus,
    SettlementTargetType,
} from '../types/zod/settlementTargetSchema';

const COLLECTION_NAME = 'settlement_targets';
const CACHE_TTL = 300000;
const settlementTargetConverter = createConverter(SettlementTargetSchema);
export const DEFAULT_SETTLEMENT_TARGET_AFTER_TAX_RATE = 0.75;

let cachedTargets: SettlementTarget[] | null = null;
let lastFetchTime = 0;

export const normalizeSettlementTargetAfterTaxRate = (value: unknown): number => {
    const raw = String(value ?? '').trim();
    if (!raw) return DEFAULT_SETTLEMENT_TARGET_AFTER_TAX_RATE;
    const numeric = typeof value === 'number' ? value : Number(raw);
    if (!Number.isFinite(numeric)) return DEFAULT_SETTLEMENT_TARGET_AFTER_TAX_RATE;
    if (numeric > 1 && numeric <= 100) return numeric / 100;
    return Math.min(1, Math.max(0, numeric));
};

export const normalizeSettlementTarget = (target: SettlementTarget): SettlementTarget => ({
    ...target,
    targetType: target.targetType || 'other',
    defaultProcessType: target.defaultProcessType || 'payable',
    defaultAfterTaxRate: normalizeSettlementTargetAfterTaxRate(target.defaultAfterTaxRate),
    buybackEnabled: Boolean(target.buybackEnabled),
    status: target.status || 'active',
    evidenceRequired: Boolean(target.evidenceRequired),
});

export const settlementTargetService = {
    getCollection() {
        return collection(db, COLLECTION_NAME).withConverter(settlementTargetConverter);
    },

    async getTargets(forceRefresh: boolean = false): Promise<SettlementTarget[]> {
        const now = Date.now();
        if (!forceRefresh && cachedTargets && now - lastFetchTime < CACHE_TTL) {
            return cachedTargets;
        }

        const q = query(this.getCollection(), orderBy('name', 'asc'));
        const snap = await getDocs(q);
        cachedTargets = snap.docs.map((item) => normalizeSettlementTarget(item.data()));
        lastFetchTime = now;
        return cachedTargets;
    },

    async getTarget(id: string): Promise<SettlementTarget | null> {
        const snap = await getDoc(doc(db, COLLECTION_NAME, id).withConverter(settlementTargetConverter));
        return snap.exists() ? normalizeSettlementTarget(snap.data()) : null;
    },

    async addTarget(target: Partial<SettlementTarget>): Promise<string> {
        const data = stripUndefinedFields({
            ...target,
            targetType: target.targetType || 'other',
            defaultProcessType: target.defaultProcessType || 'payable',
            defaultAfterTaxRate: normalizeSettlementTargetAfterTaxRate(target.defaultAfterTaxRate),
            buybackEnabled: Boolean(target.buybackEnabled),
            status: target.status || 'active',
            evidenceRequired: Boolean(target.evidenceRequired),
            createdAt: serverTimestamp(),
        } as Record<string, unknown>);

        const docRef = doc(collection(db, COLLECTION_NAME)).withConverter(settlementTargetConverter);
        await setDoc(docRef, data as any);
        cachedTargets = null;
        toast.saved('정산 대상자', 1);
        return docRef.id;
    },

    async updateTarget(id: string, updates: Partial<SettlementTarget>): Promise<void> {
        const normalizedUpdates = {
            ...updates,
            ...(Object.prototype.hasOwnProperty.call(updates, 'defaultAfterTaxRate')
                ? { defaultAfterTaxRate: normalizeSettlementTargetAfterTaxRate(updates.defaultAfterTaxRate) }
                : {}),
        };
        const data = stripUndefinedFields(normalizedUpdates as Record<string, unknown>);
        await updateDoc(doc(db, COLLECTION_NAME, id).withConverter(settlementTargetConverter), {
            ...data,
            updatedAt: serverTimestamp(),
        });
        cachedTargets = null;
        toast.updated('정산 대상자');
    },

    async deactivateTarget(id: string): Promise<void> {
        await updateDoc(doc(db, COLLECTION_NAME, id).withConverter(settlementTargetConverter), {
            status: 'inactive',
            updatedAt: serverTimestamp(),
        });
        cachedTargets = null;
        toast.success('정산 대상자를 사용 중지했습니다. 기존 정산 내역은 유지됩니다.');
    },
};
