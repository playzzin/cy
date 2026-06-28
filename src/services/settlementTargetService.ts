import {
    collection,
    deleteDoc,
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

let cachedTargets: SettlementTarget[] | null = null;
let lastFetchTime = 0;

const normalizeTarget = (target: SettlementTarget): SettlementTarget => ({
    ...target,
    targetType: target.targetType || 'other',
    defaultProcessType: target.defaultProcessType || 'payable',
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
        cachedTargets = snap.docs.map((item) => normalizeTarget(item.data()));
        lastFetchTime = now;
        return cachedTargets;
    },

    async getTarget(id: string): Promise<SettlementTarget | null> {
        const snap = await getDoc(doc(db, COLLECTION_NAME, id).withConverter(settlementTargetConverter));
        return snap.exists() ? normalizeTarget(snap.data()) : null;
    },

    async addTarget(target: Partial<SettlementTarget>): Promise<string> {
        const data = stripUndefinedFields({
            ...target,
            targetType: target.targetType || 'other',
            defaultProcessType: target.defaultProcessType || 'payable',
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
        const data = stripUndefinedFields(updates as Record<string, unknown>);
        await updateDoc(doc(db, COLLECTION_NAME, id).withConverter(settlementTargetConverter), {
            ...data,
            updatedAt: serverTimestamp(),
        });
        cachedTargets = null;
        toast.updated('정산 대상자');
    },

    async deleteTarget(id: string): Promise<void> {
        await deleteDoc(doc(db, COLLECTION_NAME, id));
        cachedTargets = null;
        toast.deleted('정산 대상자', 1);
    },
};
