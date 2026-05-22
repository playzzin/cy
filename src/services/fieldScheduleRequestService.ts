import {
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    orderBy,
    query,
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

    deleteRequest: async (id: string): Promise<void> => {
        await deleteDoc(doc(db, COLLECTION_NAME, id));
    },
};
