import {
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    query,
    serverTimestamp,
    setDoc,
    writeBatch,
    where
} from 'firebase/firestore';
import { db } from '../config/firebase';
import {
    AccommodationBillingTarget,
    AccommodationBillingTargetType,
    UpsertAccommodationBillingTargetInput
} from '../types/accommodationBillingTarget';
import { Timestamp } from '../types/timestamp';

const COLLECTION_NAME = 'accommodation_billing_targets';

const normalizeKey = (value: unknown): string => String(value ?? '').trim();

const makeId = (prefix: string): string => {
    const c = typeof crypto !== 'undefined' ? crypto : undefined;
    if (c && typeof c.randomUUID === 'function') return c.randomUUID();
    return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
};

const compareTargetLatestFirst = (a: AccommodationBillingTarget, b: AccommodationBillingTarget): number => {
    const startDiff = String(b.startDate ?? '').localeCompare(String(a.startDate ?? ''));
    if (startDiff !== 0) return startDiff;
    return String(b.id ?? '').localeCompare(String(a.id ?? ''));
};

const getTodayDateText = (): string => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const uniqTargets = (targets: AccommodationBillingTarget[]): AccommodationBillingTarget[] => {
    const map = new Map<string, AccommodationBillingTarget>();
    targets.forEach((target) => {
        if (!target.id) return;
        map.set(target.id, target);
    });
    return Array.from(map.values());
};

const toFirestoreTimestamp = (value?: unknown): Timestamp | undefined => {
    if (!value) return undefined;
    if (value instanceof Timestamp) return value;
    if (typeof (value as any)?.toDate === 'function') {
        try {
            return Timestamp.fromDate((value as any).toDate());
        } catch {
            return undefined;
        }
    }
    if (typeof value === 'object') {
        const obj = value as any;
        const seconds = obj?._seconds ?? obj?.seconds;
        const nanos = obj?._nanoseconds ?? obj?.nanoseconds ?? 0;
        if (typeof seconds === 'number' && Number.isFinite(seconds)) {
            return Timestamp.fromMillis(seconds * 1000 + Math.floor((typeof nanos === 'number' ? nanos : 0) / 1_000_000));
        }
    }
    try {
        return Timestamp.fromDate(new Date(String(value)));
    } catch {
        return undefined;
    }
};

const normalizeTargetType = (value?: string | null): AccommodationBillingTargetType => {
    if (value === 'office') return 'office';
    if (value === 'office_staff') return 'office_staff';
    if (value === 'worker') return 'worker';
    return 'team';
};

const mapDocToTarget = (id: string, row: any): AccommodationBillingTarget => {
    const accommodationId = normalizeKey(row?.accommodationId) || id;
    const targetType = normalizeTargetType(row?.targetType);
    const teamId = normalizeKey(row?.teamId);
    const teamName = normalizeKey(row?.teamName);
    const workerId = normalizeKey(row?.workerId);
    const workerName = normalizeKey(row?.workerName);

    return {
        id,
        accommodationId,
        accommodationName: normalizeKey(row?.accommodationName) || undefined,
        targetType,
        teamId: teamId || undefined,
        teamName: teamName || undefined,
        workerId: workerId || undefined,
        workerName: workerName || undefined,
        startDate: normalizeKey(row?.startDate) || undefined,
        endDate: normalizeKey(row?.endDate) || undefined,
        memo: normalizeKey(row?.memo) || undefined,
        createdAt: toFirestoreTimestamp(row?.createdAt),
        updatedAt: toFirestoreTimestamp(row?.updatedAt)
    };
};

const buildPayload = (input: UpsertAccommodationBillingTargetInput) => {
    const targetType = normalizeTargetType(input.targetType);
    const payload: Record<string, unknown> = {
        accommodationId: normalizeKey(input.accommodationId),
        accommodationName: normalizeKey(input.accommodationName) || null,
        targetType,
        startDate: normalizeKey(input.startDate) || null,
        endDate: normalizeKey(input.endDate) || null,
        memo: normalizeKey(input.memo) || null,
        updatedAt: serverTimestamp()
    };

    if (targetType === 'team' || targetType === 'office') {
        payload.teamId = normalizeKey(input.teamId) || null;
        payload.teamName = normalizeKey(input.teamName) || null;
        payload.workerId = null;
        payload.workerName = null;
    } else {
        payload.workerId = normalizeKey(input.workerId) || null;
        payload.workerName = normalizeKey(input.workerName) || null;
        payload.teamId = null;
        payload.teamName = null;
    }

    return payload;
};

const validateTargetInput = (input: UpsertAccommodationBillingTargetInput): void => {
    const normalizedAccommodationId = normalizeKey(input.accommodationId);
    if (!normalizedAccommodationId) {
        throw new Error('숙소 ID가 필요합니다.');
    }

    const targetType = normalizeTargetType(input.targetType);
    if (targetType === 'team') {
        const hasTeamId = normalizeKey(input.teamId).length > 0;
        const hasTeamName = normalizeKey(input.teamName).length > 0;
        if (!hasTeamId && !hasTeamName) {
            throw new Error('팀 청구대상은 팀 정보가 필요합니다.');
        }
    } else if (targetType === 'worker' || targetType === 'office_staff') {
        const hasWorkerId = normalizeKey(input.workerId).length > 0;
        const hasWorkerName = normalizeKey(input.workerName).length > 0;
        if (!hasWorkerId && !hasWorkerName) {
            throw new Error('개인 청구대상은 작업자 정보가 필요합니다.');
        }
    }
};

export const accommodationBillingTargetService = {
    async listTargets(): Promise<AccommodationBillingTarget[]> {
        try {
            const snapshot = await getDocs(collection(db, COLLECTION_NAME));
            return snapshot.docs
                .map((item) => mapDocToTarget(item.id, item.data()))
                .sort((a, b) => {
                    const nameDiff = String(a.accommodationName ?? '').localeCompare(String(b.accommodationName ?? ''), 'ko-KR');
                    if (nameDiff !== 0) return nameDiff;
                    return compareTargetLatestFirst(a, b);
                });
        } catch (error) {
            console.error('Error fetching accommodation billing targets:', error);
            return [];
        }
    },

    async listTargetsByAccommodationId(accommodationId: string): Promise<AccommodationBillingTarget[]> {
        const normalizedId = normalizeKey(accommodationId);
        if (!normalizedId) return [];

        try {
            const targets: AccommodationBillingTarget[] = [];

            const directRef = doc(db, COLLECTION_NAME, normalizedId);
            const directSnap = await getDoc(directRef);
            if (directSnap.exists()) {
                targets.push(mapDocToTarget(directSnap.id, directSnap.data()));
            }

            const targetQuery = query(
                collection(db, COLLECTION_NAME),
                where('accommodationId', '==', normalizedId)
            );
            const snapshot = await getDocs(targetQuery);
            snapshot.docs.forEach((row) => {
                targets.push(mapDocToTarget(row.id, row.data()));
            });

            return uniqTargets(targets).sort(compareTargetLatestFirst);
        } catch (error) {
            console.error('Error fetching accommodation billing target list:', error);
            return [];
        }
    },

    async getTargetByAccommodationId(accommodationId: string): Promise<AccommodationBillingTarget | null> {
        const normalizedId = normalizeKey(accommodationId);
        if (!normalizedId) return null;

        try {
            const targets = await accommodationBillingTargetService.listTargetsByAccommodationId(normalizedId);
            const today = getTodayDateText();
            return targets.find((target) => {
                const startDate = normalizeKey(target.startDate);
                const endDate = normalizeKey(target.endDate);
                return (!startDate || startDate <= today) && (!endDate || endDate >= today);
            }) ?? null;
        } catch (error) {
            console.error('Error fetching accommodation billing target:', error);
            return null;
        }
    },

    async upsertTarget(input: UpsertAccommodationBillingTargetInput): Promise<string> {
        const normalizedAccommodationId = normalizeKey(input.accommodationId);
        validateTargetInput(input);

        const documentId = normalizeKey(input.id) || makeId('accommodation_billing_target');
        const documentRef = doc(db, COLLECTION_NAME, documentId);
        const snapshot = await getDoc(documentRef);
        const payload = buildPayload({
            ...input,
            accommodationId: normalizedAccommodationId
        });

        if (!snapshot.exists()) {
            payload.createdAt = serverTimestamp();
        }

        await setDoc(documentRef, payload, { merge: true });
        return documentId;
    },

    async applyTargetChanges(params: {
        accommodationId: string;
        upserts?: UpsertAccommodationBillingTargetInput[];
        closeRecords?: Array<{ id: string; endDate: string }>;
        deleteIds?: string[];
    }): Promise<string[]> {
        const normalizedAccommodationId = normalizeKey(params.accommodationId);
        if (!normalizedAccommodationId) {
            throw new Error('숙소 ID가 필요합니다.');
        }

        const batch = writeBatch(db);
        const savedIds: string[] = [];

        (params.closeRecords ?? []).forEach((record) => {
            if (!record.id) return;
            batch.update(doc(db, COLLECTION_NAME, record.id), {
                endDate: record.endDate,
                updatedAt: serverTimestamp()
            });
        });

        (params.upserts ?? []).forEach((input) => {
            validateTargetInput(input);
            const documentId = normalizeKey(input.id) || makeId('accommodation_billing_target');
            savedIds.push(documentId);
            batch.set(doc(db, COLLECTION_NAME, documentId), {
                ...buildPayload({
                    ...input,
                    accommodationId: normalizedAccommodationId
                }),
                createdAt: serverTimestamp()
            }, { merge: true });
        });

        (params.deleteIds ?? []).forEach((id) => {
            if (!id) return;
            batch.delete(doc(db, COLLECTION_NAME, id));
        });

        await batch.commit();
        return savedIds;
    },

    async deleteTarget(accommodationId: string): Promise<void> {
        const normalizedAccommodationId = normalizeKey(accommodationId);
        if (!normalizedAccommodationId) return;

        const targets = await accommodationBillingTargetService.listTargetsByAccommodationId(normalizedAccommodationId);
        if (targets.length === 0) {
            await deleteDoc(doc(db, COLLECTION_NAME, normalizedAccommodationId));
            return;
        }

        await Promise.all(targets.map((target) => deleteDoc(doc(db, COLLECTION_NAME, target.id))));
    }
};
