import { db } from '../config/firebase';
import { toast } from '../utils/swal';
import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    query,
    where,
    Timestamp,
    serverTimestamp,
    writeBatch
} from 'firebase/firestore';

export interface WorkerSiteAssignment {
    id?: string;
    workerId: string;
    workerName?: string;
    siteId: string;
    siteName?: string;
    teamId?: string;
    teamName?: string;
    companyId?: string;
    companyName?: string;
    isPrimary?: boolean;
    status?: 'active' | 'ended';
    startDate?: string;
    endDate?: string;
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
}

const COLLECTION_NAME = 'worker_site_assignments';

const toMillis = (ts?: Timestamp): number => (ts ? ts.toMillis() : 0);

const isActiveAssignment = (assignment: WorkerSiteAssignment): boolean => {
    const status = assignment.status || 'active';
    return status === 'active';
};

export const workerSiteAssignmentService = {
    addAssignment: async (assignment: Omit<WorkerSiteAssignment, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
        const docRef = await addDoc(collection(db, COLLECTION_NAME), {
            ...assignment,
            status: assignment.status || 'active',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        toast.saved('현장 배정', 1);

        if (assignment.isPrimary) {
            await workerSiteAssignmentService.setPrimaryAssignment(assignment.workerId, docRef.id);
        } else {
            await workerSiteAssignmentService.syncWorkerPrimarySite(assignment.workerId);
        }
        return docRef.id;
    },

    updateAssignment: async (id: string, updates: Partial<WorkerSiteAssignment>): Promise<void> => {
        const docRef = doc(db, COLLECTION_NAME, id);
        let workerId = updates.workerId;

        if (!workerId) {
            const snap = await getDoc(docRef);
            if (snap.exists()) {
                const existing = snap.data() as WorkerSiteAssignment;
                workerId = existing.workerId;
            }
        }

        await updateDoc(docRef, {
            ...updates,
            updatedAt: serverTimestamp()
        });
        toast.updated('현장 배정');

        if (workerId) {
            if (updates.isPrimary === true) {
                await workerSiteAssignmentService.setPrimaryAssignment(workerId, id);
            } else {
                await workerSiteAssignmentService.syncWorkerPrimarySite(workerId);
            }
        }
    },

    deleteAssignment: async (id: string): Promise<void> => {
        const docRef = doc(db, COLLECTION_NAME, id);
        const snap = await getDoc(docRef);
        const workerId = snap.exists() ? (snap.data() as WorkerSiteAssignment).workerId : undefined;

        await deleteDoc(docRef);
        toast.deleted('현장 배정', 1);

        if (workerId) {
            await workerSiteAssignmentService.syncWorkerPrimarySite(workerId);
        }
    },

    getAssignmentsByWorker: async (workerId: string): Promise<WorkerSiteAssignment[]> => {
        const q = query(
            collection(db, COLLECTION_NAME),
            where('workerId', '==', workerId)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs
            .map(d => ({ id: d.id, ...d.data() } as WorkerSiteAssignment))
            .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
    },

    getAllAssignments: async (): Promise<WorkerSiteAssignment[]> => {
        const q = query(collection(db, COLLECTION_NAME));
        const snapshot = await getDocs(q);
        return snapshot.docs
            .map(d => ({ id: d.id, ...d.data() } as WorkerSiteAssignment))
            .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
    },

    setPrimaryAssignment: async (workerId: string, assignmentId: string): Promise<void> => {
        const assignments = await workerSiteAssignmentService.getAssignmentsByWorker(workerId);

        if (assignments.length === 0) {
            await workerSiteAssignmentService.syncWorkerPrimarySite(workerId);
            return;
        }

        const batch = writeBatch(db);
        assignments.forEach(item => {
            if (!item.id) return;

            batch.update(doc(db, COLLECTION_NAME, item.id), {
                isPrimary: item.id === assignmentId,
                updatedAt: serverTimestamp()
            });
        });

        await batch.commit();
        await workerSiteAssignmentService.syncWorkerPrimarySite(workerId);
    },

    getActiveAssignmentsByWorker: async (workerId: string): Promise<WorkerSiteAssignment[]> => {
        const assignments = await workerSiteAssignmentService.getAssignmentsByWorker(workerId);
        return assignments.filter(isActiveAssignment);
    },

    getAssignmentsBySite: async (siteId: string): Promise<WorkerSiteAssignment[]> => {
        const q = query(
            collection(db, COLLECTION_NAME),
            where('siteId', '==', siteId)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs
            .map(d => ({ id: d.id, ...d.data() } as WorkerSiteAssignment))
            .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
    },

    getActiveAssignmentsBySite: async (siteId: string): Promise<WorkerSiteAssignment[]> => {
        const assignments = await workerSiteAssignmentService.getAssignmentsBySite(siteId);
        return assignments.filter(isActiveAssignment);
    },

    syncWorkerPrimarySite: async (workerId: string): Promise<void> => {
        const workerSnap = await getDoc(doc(db, 'workers', workerId));
        const workerData = workerSnap.exists()
            ? (workerSnap.data() as { siteId?: string; siteName?: string })
            : {};

        const currentSiteId = workerData.siteId || '';
        const currentSiteName = workerData.siteName || '';

        const activeAssignments = await workerSiteAssignmentService.getActiveAssignmentsByWorker(workerId);

        const explicitPrimary = activeAssignments.find(a => a.isPrimary) || null;
        const primary = explicitPrimary || activeAssignments[0] || null;

        const siteId = primary?.siteId || '';
        const siteName =
            primary?.siteName ||
            (primary?.siteId && primary.siteId === currentSiteId ? currentSiteName : '');

        const { manpowerService } = await import('./manpowerService');
        await manpowerService.updateWorker(workerId, {
            siteId,
            siteName
        });
    }
};
