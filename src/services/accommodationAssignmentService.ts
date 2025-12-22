import { db } from '../config/firebase';
import { toast } from '../utils/swal';
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    query,
    serverTimestamp,
    Timestamp,
    updateDoc,
    where,
    writeBatch
} from 'firebase/firestore';
import { z } from 'zod';
import { format, parseISO, subDays } from 'date-fns';
import {
    AccommodationAssignment,
    AccommodationAssignmentSource,
    AccommodationAssignmentStatus
} from '../types/accommodationAssignment';

const COLLECTION_NAME = 'accommodation_assignments';

const omitUndefined = (value: Record<string, unknown>): Record<string, unknown> => {
    const entries = Object.entries(value).filter(([, v]) => v !== undefined);
    return Object.fromEntries(entries);
};

const DateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '날짜 형식은 YYYY-MM-DD 이어야 합니다.');

// Status and Source are validated as strings, type narrowing happens at runtime
const StatusSchema = z.string().refine(
    (val): val is AccommodationAssignmentStatus => val === 'active' || val === 'ended',
    { message: 'status는 active 또는 ended이어야 합니다.' }
);

const SourceSchema = z.string().refine(
    (val): val is AccommodationAssignmentSource => val === 'team' || val === 'worker',
    { message: 'source는 team 또는 worker이어야 합니다.' }
);

const AssignmentSchema = z.object({
    workerId: z.string().min(1),
    workerName: z.string().optional(),

    teamId: z.string().optional(),
    teamName: z.string().optional(),

    accommodationId: z.string().min(1),
    accommodationName: z.string().optional(),

    status: StatusSchema.default('active'),

    startDate: DateStringSchema,
    endDate: DateStringSchema.optional(),

    source: SourceSchema.optional(),
    memo: z.string().optional()
});

type AssignmentInput = z.infer<typeof AssignmentSchema>;

type AssignmentUpdate = Partial<AssignmentInput>;

const toMillis = (ts?: Timestamp): number => (ts ? ts.toMillis() : 0);

const isActive = (item: AccommodationAssignment): boolean => {
    return (item.status || 'active') === 'active' && !item.endDate;
};

const buildEndDateAsDayBefore = (startDate: string): string => {
    const dayBefore = subDays(parseISO(startDate), 1);
    return format(dayBefore, 'yyyy-MM-dd');
};

export const accommodationAssignmentService = {
    buildEndDateAsDayBefore,

    addAssignment: async (
        assignment: Omit<AccommodationAssignment, 'id' | 'createdAt' | 'updatedAt'>
    ): Promise<string> => {
        const parsed = AssignmentSchema.parse({
            ...assignment,
            status: assignment.status ?? 'active'
        });

        const data = omitUndefined(parsed as unknown as Record<string, unknown>);

        const docRef = await addDoc(collection(db, COLLECTION_NAME), {
            ...data,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });

        toast.saved('숙소 배정', 1);
        return docRef.id;
    },

    addAssignmentsBatch: async (
        assignments: Array<Omit<AccommodationAssignment, 'id' | 'createdAt' | 'updatedAt'>>
    ): Promise<string[]> => {
        if (assignments.length === 0) return [];

        const parsed = assignments
            .map((a) =>
                AssignmentSchema.parse({
                    ...a,
                    status: a.status ?? 'active'
                })
            )
            .map((item) => omitUndefined(item as unknown as Record<string, unknown>));

        const ids: string[] = [];

        const batchSize = 450;
        for (let i = 0; i < parsed.length; i += batchSize) {
            const batch = writeBatch(db);
            const chunk = parsed.slice(i, i + batchSize);

            chunk.forEach((item) => {
                const ref = doc(collection(db, COLLECTION_NAME));
                ids.push(ref.id);
                batch.set(ref, {
                    ...item,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                });
            });

            await batch.commit();
        }

        toast.saved('숙소 배정', assignments.length);
        return ids;
    },

    updateAssignment: async (id: string, updates: AssignmentUpdate): Promise<void> => {
        if (!id) throw new Error('배정 ID가 필요합니다.');

        const parsedUpdates = AssignmentSchema.partial().parse(updates);

        const data = omitUndefined(parsedUpdates as unknown as Record<string, unknown>);
        if (Object.keys(data).length === 0) return;

        await updateDoc(doc(db, COLLECTION_NAME, id), {
            ...data,
            updatedAt: serverTimestamp()
        });

        toast.updated('숙소 배정');
    },

    endAssignment: async (id: string, endDate: string): Promise<void> => {
        if (!id) throw new Error('배정 ID가 필요합니다.');
        const parsedEndDate = DateStringSchema.parse(endDate);

        await updateDoc(doc(db, COLLECTION_NAME, id), {
            status: 'ended',
            endDate: parsedEndDate,
            updatedAt: serverTimestamp()
        });

        toast.updated('숙소 배정');
    },

    endAssignmentsBatch: async (ids: string[], endDate: string): Promise<void> => {
        if (ids.length === 0) return;
        const parsedEndDate = DateStringSchema.parse(endDate);

        const batchSize = 450;
        for (let i = 0; i < ids.length; i += batchSize) {
            const batch = writeBatch(db);
            const chunk = ids.slice(i, i + batchSize);

            chunk.forEach((id) => {
                batch.update(doc(db, COLLECTION_NAME, id), {
                    status: 'ended',
                    endDate: parsedEndDate,
                    updatedAt: serverTimestamp()
                });
            });

            await batch.commit();
        }

        toast.updated('숙소 배정');
    },

    deleteAssignment: async (id: string): Promise<void> => {
        if (!id) throw new Error('배정 ID가 필요합니다.');
        await deleteDoc(doc(db, COLLECTION_NAME, id));
        toast.deleted('숙소 배정', 1);
    },

    getAssignment: async (id: string): Promise<AccommodationAssignment | null> => {
        if (!id) return null;
        const snap = await getDoc(doc(db, COLLECTION_NAME, id));
        if (!snap.exists()) return null;
        return { id: snap.id, ...(snap.data() as Omit<AccommodationAssignment, 'id'>) };
    },

    getAssignmentsByWorker: async (workerId: string): Promise<AccommodationAssignment[]> => {
        const q = query(collection(db, COLLECTION_NAME), where('workerId', '==', workerId));
        const snapshot = await getDocs(q);
        return snapshot.docs
            .map((d) => ({ id: d.id, ...d.data() } as AccommodationAssignment))
            .sort((a, b) => toMillis(b.createdAt as Timestamp | undefined) - toMillis(a.createdAt as Timestamp | undefined));
    },

    getActiveAssignmentsByWorker: async (workerId: string): Promise<AccommodationAssignment[]> => {
        const items = await accommodationAssignmentService.getAssignmentsByWorker(workerId);
        return items.filter(isActive);
    },

    getAssignmentsByAccommodation: async (accommodationId: string): Promise<AccommodationAssignment[]> => {
        const q = query(collection(db, COLLECTION_NAME), where('accommodationId', '==', accommodationId));
        const snapshot = await getDocs(q);
        return snapshot.docs
            .map((d) => ({ id: d.id, ...d.data() } as AccommodationAssignment))
            .sort((a, b) => toMillis(b.createdAt as Timestamp | undefined) - toMillis(a.createdAt as Timestamp | undefined));
    },

    getActiveAssignmentsByAccommodation: async (accommodationId: string): Promise<AccommodationAssignment[]> => {
        const items = await accommodationAssignmentService.getAssignmentsByAccommodation(accommodationId);
        return items.filter(isActive);
    },

    getAssignmentsByTeam: async (teamId: string): Promise<AccommodationAssignment[]> => {
        const q = query(collection(db, COLLECTION_NAME), where('teamId', '==', teamId));
        const snapshot = await getDocs(q);
        return snapshot.docs
            .map((d) => ({ id: d.id, ...d.data() } as AccommodationAssignment))
            .sort((a, b) => toMillis(b.createdAt as Timestamp | undefined) - toMillis(a.createdAt as Timestamp | undefined));
    },

    getActiveAssignmentsByTeam: async (teamId: string): Promise<AccommodationAssignment[]> => {
        const items = await accommodationAssignmentService.getAssignmentsByTeam(teamId);
        return items.filter(isActive);
    },

    getAllAssignments: async (): Promise<AccommodationAssignment[]> => {
        const snapshot = await getDocs(query(collection(db, COLLECTION_NAME)));
        return snapshot.docs
            .map((d) => ({ id: d.id, ...d.data() } as AccommodationAssignment))
            .sort((a, b) => toMillis(b.createdAt as Timestamp | undefined) - toMillis(a.createdAt as Timestamp | undefined));
    }
};
