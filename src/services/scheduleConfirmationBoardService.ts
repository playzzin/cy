import {
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    setDoc,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { DispatchAssignment } from './dispatchService';

const COLLECTION_NAME = 'schedule_confirmation_boards';

export interface ScheduleConfirmationBoard {
    id?: string;
    date: string;
    assignments: DispatchAssignment[];
    status?: 'confirmed';
    confirmedAt?: string;
    createdAt?: unknown;
    updatedAt?: unknown;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const stripUndefined = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(stripUndefined);
    if (!isRecord(value)) return value;

    return Object.fromEntries(
        Object.entries(value)
            .filter(([, entry]) => entry !== undefined)
            .map(([key, entry]) => [key, stripUndefined(entry)])
    );
};

const parseAssignments = (raw: unknown): DispatchAssignment[] => {
    if (Array.isArray(raw)) return raw as DispatchAssignment[];
    if (typeof raw !== 'string') return [];

    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? (parsed as DispatchAssignment[]) : [];
    } catch {
        return [];
    }
};

const mapBoard = (id: string, data: Record<string, unknown>): ScheduleConfirmationBoard => ({
    id,
    date: String(data.date ?? id),
    assignments: parseAssignments(data.assignments),
    status: 'confirmed',
    confirmedAt: typeof data.confirmedAt === 'string' ? data.confirmedAt : undefined,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
});

export const scheduleConfirmationBoardService = {
    getBoardByDate: async (date: string): Promise<ScheduleConfirmationBoard | null> => {
        const ref = doc(db, COLLECTION_NAME, date);
        const snapshot = await getDoc(ref);
        if (!snapshot.exists()) return null;
        return mapBoard(snapshot.id, snapshot.data() as Record<string, unknown>);
    },

    getAllBoards: async (): Promise<ScheduleConfirmationBoard[]> => {
        const snapshot = await getDocs(collection(db, COLLECTION_NAME));
        return snapshot.docs
            .map((entry) => mapBoard(entry.id, entry.data() as Record<string, unknown>))
            .sort((left, right) => right.date.localeCompare(left.date));
    },

    saveBoard: async (date: string, assignments: DispatchAssignment[]): Promise<void> => {
        const ref = doc(db, COLLECTION_NAME, date);
        const existing = await getDoc(ref);
        const now = new Date().toISOString();
        const payload = stripUndefined({
            date,
            assignments,
            status: 'confirmed',
            confirmedAt: now,
            createdAt: existing.exists() ? existing.data().createdAt : now,
            updatedAt: now,
        }) as Record<string, unknown>;

        await setDoc(ref, payload, { merge: true });
    },

    deleteBoard: async (date: string): Promise<void> => {
        await deleteDoc(doc(db, COLLECTION_NAME, date));
    },
};
