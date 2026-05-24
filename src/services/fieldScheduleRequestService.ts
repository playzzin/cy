import {
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    orderBy,
    query,
    runTransaction,
    setDoc,
    Timestamp,
    where,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { stripUndefinedFields } from '../utils/stripUndefinedFields';

export type FieldScheduleRequestStatus = 'requested' | 'assigning' | 'assigned' | 'confirmed' | 'cancelled';
export type FieldScheduleRequestPriority = 'normal' | 'urgent';

export interface FieldScheduleRequest {
    id?: string;
    date: string;
    siteId: string;
    siteName: string;
    siteAddress?: string;
    siteColor?: string;
    responsibleTeamId?: string;
    responsibleTeamName?: string;
    siteManagerId?: string;
    siteManagerName?: string;
    requestedHeadcount: number;
    requestedRoles: string[];
    offDutyWorkerIds: string[];
    offDutyWorkerNames: string[];
    memo?: string;
    priority: FieldScheduleRequestPriority;
    requestedById?: string;
    requestedByName?: string;
    status: FieldScheduleRequestStatus;
    createdAt?: unknown;
    updatedAt?: unknown;
}

export interface FieldOffDutyWorkerInput {
    id: string;
    name: string;
}

const COLLECTION_NAME = 'field_schedule_requests';
export const FIELD_REQUEST_OFF_DUTY_SITE_ID = '__date_off_duty__';

const normalizeText = (value: unknown): string => String(value ?? '').trim();

const cleanStringList = (value: unknown): string[] => {
    if (!Array.isArray(value)) return [];
    return Array.from(new Set(value.map(normalizeText).filter(Boolean)));
};

const makeRequestId = (date: string, siteId: string) =>
    `${normalizeText(date)}_${normalizeText(siteId).replace(/[/\\#?]/g, '_')}`;

export const isOffDutyOnlyFieldScheduleRequest = (request: Pick<FieldScheduleRequest, 'siteId'>) =>
    normalizeText(request.siteId) === FIELD_REQUEST_OFF_DUTY_SITE_ID;

const buildOffDutyMemo = (existingMemo: unknown, workers: FieldOffDutyWorkerInput[], memo?: string) => {
    const memoText = normalizeText(memo);
    if (!memoText) return normalizeText(existingMemo);

    const workerNames = cleanStringList(workers.map((worker) => worker.name));
    const line = `${workerNames.join(', ') || '휴무자'}: ${memoText}`;
    return Array.from(new Set([
        ...normalizeText(existingMemo).split('\n').map(normalizeText).filter(Boolean),
        line,
    ])).join('\n');
};

const removeWorkerMemo = (existingMemo: unknown, workerName?: string) => {
    const name = normalizeText(workerName);
    if (!name) return normalizeText(existingMemo);
    return normalizeText(existingMemo)
        .split('\n')
        .map(normalizeText)
        .filter((line) => line && !line.startsWith(`${name}:`))
        .join('\n');
};

const mapRequest = (id: string, data: Record<string, unknown>): FieldScheduleRequest => ({
    id,
    date: normalizeText(data.date),
    siteId: normalizeText(data.siteId),
    siteName: normalizeText(data.siteName),
    siteAddress: normalizeText(data.siteAddress),
    siteColor: normalizeText(data.siteColor),
    responsibleTeamId: normalizeText(data.responsibleTeamId),
    responsibleTeamName: normalizeText(data.responsibleTeamName),
    siteManagerId: normalizeText(data.siteManagerId),
    siteManagerName: normalizeText(data.siteManagerName),
    requestedHeadcount: Math.max(0, Number(data.requestedHeadcount) || 0),
    requestedRoles: cleanStringList(data.requestedRoles),
    offDutyWorkerIds: cleanStringList(data.offDutyWorkerIds),
    offDutyWorkerNames: cleanStringList(data.offDutyWorkerNames),
    memo: normalizeText(data.memo),
    priority: data.priority === 'urgent' ? 'urgent' : 'normal',
    requestedById: normalizeText(data.requestedById),
    requestedByName: normalizeText(data.requestedByName),
    status: ['requested', 'assigning', 'assigned', 'confirmed', 'cancelled'].includes(normalizeText(data.status))
        ? normalizeText(data.status) as FieldScheduleRequestStatus
        : 'requested',
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
});

export const fieldScheduleRequestService = {
    makeRequestId,

    listByDate: async (date: string): Promise<FieldScheduleRequest[]> => {
        const snapshot = await getDocs(query(
            collection(db, COLLECTION_NAME),
            where('date', '==', date)
        ));
        return snapshot.docs
            .map((entry) => mapRequest(entry.id, entry.data() as Record<string, unknown>))
            .sort((left, right) => left.siteName.localeCompare(right.siteName, 'ko'));
    },

    listByDateRange: async (startDate: string, endDate: string): Promise<FieldScheduleRequest[]> => {
        const from = startDate <= endDate ? startDate : endDate;
        const to = startDate <= endDate ? endDate : startDate;
        const snapshot = await getDocs(query(
            collection(db, COLLECTION_NAME),
            where('date', '>=', from),
            where('date', '<=', to),
            orderBy('date', 'asc')
        ));
        return snapshot.docs
            .map((entry) => mapRequest(entry.id, entry.data() as Record<string, unknown>))
            .sort((left, right) =>
                left.date.localeCompare(right.date) || left.siteName.localeCompare(right.siteName, 'ko')
            );
    },

    upsertRequest: async (
        input: Omit<FieldScheduleRequest, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
    ): Promise<string> => {
        const id = input.id || makeRequestId(input.date, input.siteId);
        const ref = doc(db, COLLECTION_NAME, id);
        const existing = await getDoc(ref);
        const now = Timestamp.now();
        const payload = stripUndefinedFields({
            ...input,
            requestedHeadcount: Math.max(0, Number(input.requestedHeadcount) || 0),
            requestedRoles: cleanStringList(input.requestedRoles),
            offDutyWorkerIds: cleanStringList(input.offDutyWorkerIds),
            offDutyWorkerNames: cleanStringList(input.offDutyWorkerNames),
            status: input.status || 'requested',
            priority: input.priority || 'normal',
            updatedAt: now,
            createdAt: existing.exists() ? existing.data().createdAt : now,
        } as Record<string, unknown>);

        await setDoc(ref, payload, { merge: true });
        return id;
    },

    addOffDutyWorkers: async (input: {
        date: string;
        workers: FieldOffDutyWorkerInput[];
        requestedById?: string;
        requestedByName?: string;
        memo?: string;
    }): Promise<string> => {
        const date = normalizeText(input.date);
        const workers = input.workers
            .map((worker) => ({
                id: normalizeText(worker.id),
                name: normalizeText(worker.name),
            }))
            .filter((worker) => worker.id);

        if (!date || workers.length === 0) {
            throw new Error('date-and-workers-required');
        }

        const id = makeRequestId(date, FIELD_REQUEST_OFF_DUTY_SITE_ID);
        const ref = doc(db, COLLECTION_NAME, id);
        const now = Timestamp.now();

        await runTransaction(db, async (transaction) => {
            const existing = await transaction.get(ref);
            const existingData = existing.exists() ? existing.data() as Record<string, unknown> : {};
            const existingIds = cleanStringList(existingData.offDutyWorkerIds);
            const existingNames = cleanStringList(existingData.offDutyWorkerNames);
            const workerNameById = new Map<string, string>();

            existingIds.forEach((workerId, index) => {
                workerNameById.set(workerId, existingNames[index] || workerId);
            });
            workers.forEach((worker) => {
                if (!workerNameById.has(worker.id)) {
                    workerNameById.set(worker.id, worker.name || worker.id);
                }
            });

            const offDutyWorkerIds = Array.from(workerNameById.keys());
            const offDutyWorkerNames = offDutyWorkerIds.map((workerId) => workerNameById.get(workerId) || workerId);
            const payload = stripUndefinedFields({
                date,
                siteId: FIELD_REQUEST_OFF_DUTY_SITE_ID,
                siteName: '날짜별 휴무자',
                siteAddress: '',
                siteColor: '#e11d48',
                responsibleTeamId: '',
                responsibleTeamName: '',
                siteManagerId: '',
                siteManagerName: '',
                requestedHeadcount: 0,
                requestedRoles: [],
                offDutyWorkerIds,
                offDutyWorkerNames,
                memo: buildOffDutyMemo(existingData.memo, workers, input.memo),
                priority: 'normal',
                requestedById: normalizeText(input.requestedById),
                requestedByName: normalizeText(input.requestedByName),
                status: 'requested',
                updatedAt: now,
                createdAt: existing.exists() ? existingData.createdAt : now,
            } as Record<string, unknown>);

            transaction.set(ref, payload, { merge: true });
        });

        return id;
    },

    removeOffDutyWorker: async (input: {
        date: string;
        workerId: string;
        workerName?: string;
    }): Promise<void> => {
        const date = normalizeText(input.date);
        const workerId = normalizeText(input.workerId);
        if (!date || !workerId) return;

        const id = makeRequestId(date, FIELD_REQUEST_OFF_DUTY_SITE_ID);
        const ref = doc(db, COLLECTION_NAME, id);

        await runTransaction(db, async (transaction) => {
            const existing = await transaction.get(ref);
            if (!existing.exists()) return;

            const existingData = existing.data() as Record<string, unknown>;
            const existingIds = cleanStringList(existingData.offDutyWorkerIds);
            const existingNames = cleanStringList(existingData.offDutyWorkerNames);
            const nextPairs = existingIds
                .map((idValue, index) => ({
                    id: idValue,
                    name: existingNames[index] || idValue,
                }))
                .filter((entry) => entry.id !== workerId);

            if (nextPairs.length === 0) {
                transaction.delete(ref);
                return;
            }

            transaction.set(ref, stripUndefinedFields({
                offDutyWorkerIds: nextPairs.map((entry) => entry.id),
                offDutyWorkerNames: nextPairs.map((entry) => entry.name),
                memo: removeWorkerMemo(existingData.memo, input.workerName),
                updatedAt: Timestamp.now(),
            } as Record<string, unknown>), { merge: true });
        });
    },

    deleteRequest: async (id: string): Promise<void> => {
        await deleteDoc(doc(db, COLLECTION_NAME, id));
    },
};
