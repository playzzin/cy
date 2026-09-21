import {
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    setDoc,
    Timestamp,
    updateDoc,
    where,
} from 'firebase/firestore';
import { auth, db, functions } from '../config/firebase';
import { httpsCallable } from 'firebase/functions';
import { stripUndefinedFields } from '../utils/stripUndefinedFields';
import { getTeamScopedRows } from './teamScopedReadService';

export type AdvanceRequestStatus = 'requested' | 'approved' | 'rejected' | 'paid' | 'cancelled';

export interface AdvanceRequest {
    id?: string;
    workerId: string;
    workerName: string;
    teamId?: string;
    teamName?: string;
    requesterUid?: string;
    requesterName?: string;
    requesterEmail?: string;
    yearMonth: string;
    periodStart: string;
    periodEnd: string;
    currentMonthEarned: number;
    previousMonthEarned: number;
    earnedAmountSnapshot: number;
    existingAdvanceAmountSnapshot: number;
    activeRequestAmountSnapshot: number;
    availableAmountSnapshot: number;
    requestedAmount: number;
    bankName?: string;
    accountNumber?: string;
    accountHolder?: string;
    memo?: string;
    status: AdvanceRequestStatus;
    reviewedById?: string;
    reviewedByName?: string;
    reviewMemo?: string;
    reviewedAt?: unknown;
    paidById?: string;
    paidByName?: string;
    paidAt?: unknown;
    createdAt?: unknown;
    updatedAt?: unknown;
}

export type AdvanceRequestCreateInput = Omit<
    AdvanceRequest,
    'id' | 'status' | 'createdAt' | 'updatedAt' | 'reviewedById' | 'reviewedByName' | 'reviewMemo' | 'reviewedAt'
>;

const COLLECTION_NAME = 'advance_requests';

const normalizeText = (value: unknown): string => String(value ?? '').trim();

const toFiniteNumber = (value: unknown): number => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (typeof value === 'string') {
        const parsed = Number(value.replace(/,/g, '').trim());
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
};

const normalizeStatus = (value: unknown): AdvanceRequestStatus => {
    const status = normalizeText(value);
    if (status === 'approved' || status === 'rejected' || status === 'paid' || status === 'cancelled') {
        return status;
    }
    return 'requested';
};

const makeRequestId = (workerId: string): string => {
    const safeWorkerId = normalizeText(workerId).replace(/[/\\#?]/g, '_') || 'worker';
    const suffix = Math.random().toString(36).slice(2, 8);
    return `${safeWorkerId}_${Date.now()}_${suffix}`;
};

const toMillis = (value: unknown): number => {
    if (!value) return 0;
    if (value instanceof Timestamp) return value.toMillis();
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
        const parsed = new Date(value).getTime();
        return Number.isFinite(parsed) ? parsed : 0;
    }
    if (typeof value === 'object') {
        const record = value as { seconds?: unknown; _seconds?: unknown };
        const seconds = typeof record.seconds === 'number' ? record.seconds : record._seconds;
        return typeof seconds === 'number' && Number.isFinite(seconds) ? seconds * 1000 : 0;
    }
    return 0;
};

const mapRequest = (id: string, data: Record<string, unknown>): AdvanceRequest => ({
    id,
    workerId: normalizeText(data.workerId),
    workerName: normalizeText(data.workerName),
    teamId: normalizeText(data.teamId),
    teamName: normalizeText(data.teamName),
    requesterUid: normalizeText(data.requesterUid),
    requesterName: normalizeText(data.requesterName),
    requesterEmail: normalizeText(data.requesterEmail),
    yearMonth: normalizeText(data.yearMonth),
    periodStart: normalizeText(data.periodStart),
    periodEnd: normalizeText(data.periodEnd),
    currentMonthEarned: toFiniteNumber(data.currentMonthEarned),
    previousMonthEarned: toFiniteNumber(data.previousMonthEarned),
    earnedAmountSnapshot: toFiniteNumber(data.earnedAmountSnapshot),
    existingAdvanceAmountSnapshot: toFiniteNumber(data.existingAdvanceAmountSnapshot),
    activeRequestAmountSnapshot: toFiniteNumber(data.activeRequestAmountSnapshot),
    availableAmountSnapshot: toFiniteNumber(data.availableAmountSnapshot),
    requestedAmount: toFiniteNumber(data.requestedAmount),
    bankName: normalizeText(data.bankName),
    accountNumber: normalizeText(data.accountNumber),
    accountHolder: normalizeText(data.accountHolder),
    memo: normalizeText(data.memo),
    status: normalizeStatus(data.status),
    reviewedById: normalizeText(data.reviewedById),
    reviewedByName: normalizeText(data.reviewedByName),
    reviewMemo: normalizeText(data.reviewMemo),
    reviewedAt: data.reviewedAt,
    paidById: normalizeText(data.paidById),
    paidByName: normalizeText(data.paidByName),
    paidAt: data.paidAt,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
});

const sortNewestFirst = (requests: AdvanceRequest[]): AdvanceRequest[] =>
    [...requests].sort((left, right) => toMillis(right.createdAt) - toMillis(left.createdAt));

const getRequestById = async (id: string): Promise<AdvanceRequest> => {
    const requestId = normalizeText(id);
    if (!requestId) throw new Error('request-id-required');

    const snapshot = await getDoc(doc(db, COLLECTION_NAME, requestId));
    if (!snapshot.exists()) throw new Error('request-not-found');

    return mapRequest(snapshot.id, snapshot.data() as Record<string, unknown>);
};

const listByField = async (field: 'workerId' | 'requesterUid', value: string): Promise<AdvanceRequest[]> => {
    const normalizedValue = normalizeText(value);
    if (!normalizedValue) return [];

    const snapshot = await getDocs(query(
        collection(db, COLLECTION_NAME),
        where(field, '==', normalizedValue)
    ));

    return sortNewestFirst(
        snapshot.docs.map((entry) => mapRequest(entry.id, entry.data() as Record<string, unknown>))
    );
};

export const advanceRequestService = {
    listAll: async (): Promise<AdvanceRequest[]> => {
        const snapshot = await getDocs(collection(db, COLLECTION_NAME));
        return sortNewestFirst(
            snapshot.docs.map((entry) => mapRequest(entry.id, entry.data() as Record<string, unknown>))
        );
    },

    listByStatus: async (status: AdvanceRequestStatus): Promise<AdvanceRequest[]> => {
        const snapshot = await getDocs(query(
            collection(db, COLLECTION_NAME),
            where('status', '==', status)
        ));
        return sortNewestFirst(
            snapshot.docs.map((entry) => mapRequest(entry.id, entry.data() as Record<string, unknown>))
        );
    },

    getRequest: getRequestById,

    listByWorkerId: (workerId: string): Promise<AdvanceRequest[]> => listByField('workerId', workerId),

    listByRequesterUid: (requesterUid: string): Promise<AdvanceRequest[]> => listByField('requesterUid', requesterUid),

    listForWorkerIds: async (workerIds: string[], requesterUid?: string): Promise<AdvanceRequest[]> => {
        const uniqueWorkerIds = Array.from(new Set(workerIds.map(normalizeText).filter(Boolean)));
        const scoped = await getTeamScopedRows<Record<string, unknown> & { id: string }>(COLLECTION_NAME);
        if (scoped !== null) {
            return sortNewestFirst(scoped.map(row => mapRequest(row.id, row)).filter(request =>
                uniqueWorkerIds.includes(request.workerId)
                || Boolean(requesterUid && request.requesterUid === requesterUid)
            ));
        }
        const requestMap = new Map<string, AdvanceRequest>();

        const workerResults = await Promise.all(uniqueWorkerIds.map((workerId) => listByField('workerId', workerId)));
        workerResults.flat().forEach((request) => {
            if (request.id) requestMap.set(request.id, request);
        });

        if (requesterUid) {
            const requesterRows = await listByField('requesterUid', requesterUid);
            requesterRows.forEach((request) => {
                if (request.id) requestMap.set(request.id, request);
            });
        }

        return sortNewestFirst(Array.from(requestMap.values()));
    },

    createRequest: async (input: AdvanceRequestCreateInput, requestId = makeRequestId(input.workerId)): Promise<string> => {
        const uid = auth.currentUser?.uid;
        if (!uid) throw new Error('로그인이 필요합니다.');
        const result = await httpsCallable<Record<string, unknown>, { id: string }>(functions, 'teamAdvanceRequests')({
            action: 'create', requestId, workerId: input.workerId, yearMonth: input.yearMonth,
            requestedAmount: input.requestedAmount, memo: input.memo || '',
        });
        if (auth.currentUser?.uid !== uid) throw new Error('로그인 계정이 변경되었습니다.');
        return result.data.id;
    },

    cancelRequest: async (id: string, requesterUid?: string): Promise<void> => {
        const uid = auth.currentUser?.uid;
        if (!uid) throw new Error('로그인이 필요합니다.');
        await httpsCallable(functions, 'teamAdvanceRequests')({ action: 'cancel', id });
        if (auth.currentUser?.uid !== uid) throw new Error('로그인 계정이 변경되었습니다.');
    },

    reviewRequest: async (
        id: string,
        input: {
            decision: 'approved' | 'rejected';
            reviewedById?: string;
            reviewedByName?: string;
            reviewMemo?: string;
        }
    ): Promise<void> => {
        const requestId = normalizeText(id);
        if (!requestId) throw new Error('request-id-required');

        const request = await getRequestById(requestId);
        if (request.status !== 'requested') {
            throw new Error('request-not-reviewable');
        }

        const now = Timestamp.now();
        await updateDoc(doc(db, COLLECTION_NAME, requestId), stripUndefinedFields({
            status: input.decision,
            reviewedById: normalizeText(input.reviewedById),
            reviewedByName: normalizeText(input.reviewedByName),
            reviewMemo: normalizeText(input.reviewMemo),
            reviewedAt: now,
            updatedAt: now,
        } as Record<string, unknown>));
    },

    markPaid: async (
        id: string,
        input: {
            paidById?: string;
            paidByName?: string;
            reviewMemo?: string;
        } = {}
    ): Promise<void> => {
        const requestId = normalizeText(id);
        if (!requestId) throw new Error('request-id-required');

        const request = await getRequestById(requestId);
        if (request.status !== 'approved') {
            throw new Error('request-not-payable');
        }

        const now = Timestamp.now();
        await updateDoc(doc(db, COLLECTION_NAME, requestId), stripUndefinedFields({
            status: 'paid',
            paidById: normalizeText(input.paidById),
            paidByName: normalizeText(input.paidByName),
            reviewMemo: normalizeText(input.reviewMemo) || request.reviewMemo,
            paidAt: now,
            updatedAt: now,
        } as Record<string, unknown>));
    },
};
