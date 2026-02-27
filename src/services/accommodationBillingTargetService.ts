import {
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    limit,
    query,
    serverTimestamp,
    setDoc,
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
        memo: normalizeKey(input.memo) || null,
        updatedAt: serverTimestamp()
    };

    if (targetType === 'team') {
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

export const accommodationBillingTargetService = {
    async listTargets(): Promise<AccommodationBillingTarget[]> {
        try {
            const snapshot = await getDocs(collection(db, COLLECTION_NAME));
            return snapshot.docs
                .map((item) => mapDocToTarget(item.id, item.data()))
                .sort((a, b) => String(a.accommodationName ?? '').localeCompare(String(b.accommodationName ?? ''), 'ko-KR'));
        } catch (error) {
            console.error('Error fetching accommodation billing targets:', error);
            return [];
        }
    },

    async getTargetByAccommodationId(accommodationId: string): Promise<AccommodationBillingTarget | null> {
        const normalizedId = normalizeKey(accommodationId);
        if (!normalizedId) return null;

        try {
            const directRef = doc(db, COLLECTION_NAME, normalizedId);
            const directSnap = await getDoc(directRef);
            if (directSnap.exists()) {
                return mapDocToTarget(directSnap.id, directSnap.data());
            }

            const fallbackQuery = query(
                collection(db, COLLECTION_NAME),
                where('accommodationId', '==', normalizedId),
                limit(1)
            );
            const fallbackSnapshot = await getDocs(fallbackQuery);
            if (fallbackSnapshot.empty) return null;
            const row = fallbackSnapshot.docs[0];
            return mapDocToTarget(row.id, row.data());
        } catch (error) {
            console.error('Error fetching accommodation billing target:', error);
            return null;
        }
    },

    async upsertTarget(input: UpsertAccommodationBillingTargetInput): Promise<void> {
        const normalizedAccommodationId = normalizeKey(input.accommodationId);
        if (!normalizedAccommodationId) {
            throw new Error('숙소 ID가 필요합니다.');
        }

        if (input.targetType === 'team') {
            const hasTeamId = normalizeKey(input.teamId).length > 0;
            const hasTeamName = normalizeKey(input.teamName).length > 0;
            if (!hasTeamId && !hasTeamName) {
                throw new Error('팀 청구대상은 팀 정보가 필요합니다.');
            }
        } else {
            const hasWorkerId = normalizeKey(input.workerId).length > 0;
            const hasWorkerName = normalizeKey(input.workerName).length > 0;
            if (!hasWorkerId && !hasWorkerName) {
                throw new Error('개인 청구대상은 작업자 정보가 필요합니다.');
            }
        }

        const documentRef = doc(db, COLLECTION_NAME, normalizedAccommodationId);
        const snapshot = await getDoc(documentRef);
        const payload = buildPayload({
            ...input,
            accommodationId: normalizedAccommodationId
        });

        if (!snapshot.exists()) {
            payload.createdAt = serverTimestamp();
        }

        await setDoc(documentRef, payload, { merge: true });
    },

    async deleteTarget(accommodationId: string): Promise<void> {
        const normalizedAccommodationId = normalizeKey(accommodationId);
        if (!normalizedAccommodationId) return;

        await deleteDoc(doc(db, COLLECTION_NAME, normalizedAccommodationId));
    }
};
