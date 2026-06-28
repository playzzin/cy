import { workerFirestoreService } from './workerFirestoreService';
import { databaseLogService } from './databaseLogService';
import { WorkerZod as Worker } from '../types/zod/workerSchema';
import { db, storage } from '../config/firebase';
import {
    collection,
    getDocs,
    query,
    where,
    Timestamp,
    writeBatch,
    doc,
    getDoc,
    orderBy,
    limit,
    startAfter
} from 'firebase/firestore';
import { deleteObject, ref } from 'firebase/storage';
import { stripUndefinedFields } from '../utils/stripUndefinedFields';
import { resolveWorkerPayType, syncPayTypeFields } from '../utils/payType';

export type { Worker };

const WORKER_CACHE_TTL = 300000; // 5 minutes
let cachedWorkers: Worker[] | null = null;
let lastWorkerFetchTime = 0;

const hasOwn = (value: object, key: string): boolean =>
    Object.prototype.hasOwnProperty.call(value, key);

const normalizeWorkerSalaryFields = (worker: Worker): Worker => {
    const resolved = resolveWorkerPayType(worker);
    if (!resolved) return worker;
    return syncPayTypeFields(worker, { preferTeamType: true });
};

const syncWorkerSalaryFields = (updates: Partial<Worker>): Partial<Worker> => {
    const nextUpdates: Partial<Worker> = { ...updates };

    if (hasOwn(nextUpdates as object, 'salaryModel') && !hasOwn(nextUpdates as object, 'payType')) {
        nextUpdates.payType = nextUpdates.salaryModel;
    } else if (hasOwn(nextUpdates as object, 'payType') && !hasOwn(nextUpdates as object, 'salaryModel')) {
        nextUpdates.salaryModel = nextUpdates.payType;
    }

    return syncPayTypeFields(nextUpdates, { returnUndefinedOnEmpty: true, preferTeamType: true });
};

const logWorkerChange = async (
    action: 'created' | 'updated' | 'deleted',
    before: Record<string, unknown> | null,
    after: Record<string, unknown> | null,
    source = 'manpowerService'
): Promise<void> => {
    await databaseLogService.safeCreateLog({
        action,
        entityType: 'worker',
        before,
        after,
        source,
    });
};

const snapshotWorker = (id: string, data: Record<string, unknown>): Record<string, unknown> => ({
    id,
    ...stripUndefinedFields(data),
});

export const manpowerService = {
    // Get all workers (Paginated)
    getWorkersPaginated: async (limitCount: number, lastDoc: any = null): Promise<{ workers: Worker[], lastDoc: any }> => {
        let q = query(
            collection(db, 'workers'),
            orderBy('createdAt', 'desc'),
            limit(limitCount)
        );
        if (lastDoc) {
            const lastDocRef = typeof lastDoc === 'string'
                ? await getDoc(doc(db, 'workers', lastDoc))
                : lastDoc;
            if (lastDocRef?.exists?.()) {
                q = query(
                    collection(db, 'workers'),
                    orderBy('createdAt', 'desc'),
                    startAfter(lastDocRef),
                    limit(limitCount)
                );
            }
        }
        const snapshot = await getDocs(q);
        const workers = snapshot.docs.map(d => normalizeWorkerSalaryFields({ id: d.id, ...d.data() } as Worker));
        return { workers, lastDoc: snapshot.docs[snapshot.docs.length - 1] };
    },

    /**
     * 실시간 근로자 목록 구독 (onSnapshot)
     * @param {(workers: Worker[]) => void} callback
     * @returns {() => void} unsubscribe 함수 반환
     */
    subscribeWorkers(callback: (workers: Worker[]) => void): () => void {
        // workerFirestoreService의 subscribeWorkers 사용
        return workerFirestoreService.subscribeWorkers((workers) => {
            callback(workers.map((worker) => normalizeWorkerSalaryFields(worker as Worker)));
        });
    },

    // Get all workers
    getWorkers: async (forceRefresh: boolean = false): Promise<Worker[]> => {
        const now = Date.now();
        if (!forceRefresh && cachedWorkers && (now - lastWorkerFetchTime < WORKER_CACHE_TTL)) {
            return cachedWorkers;
        }

        cachedWorkers = (await workerFirestoreService.getWorkers()).map((worker) => normalizeWorkerSalaryFields(worker as Worker));
        lastWorkerFetchTime = now;
        return cachedWorkers;
    },

    // Get a single worker by ID
    getWorker: async (id: string): Promise<Worker | null> => {
        const worker = await workerFirestoreService.getWorker(id);
        return worker ? normalizeWorkerSalaryFields(worker as Worker) : null;
    },

    // Find worker for manual linking
    findWorkerForLinking: async (name: string, idNumber: string): Promise<Worker | null> => {
        const q = query(
            collection(db, 'workers'),
            where('name', '==', name.trim())
        );
        const snapshot = await getDocs(q);
        const found = snapshot.docs.find(d => {
            const data = d.data();
            return (data.idNumber ?? data.residentNumber ?? '') === idNumber.trim();
        });
        return found ? normalizeWorkerSalaryFields({ id: found.id, ...found.data() } as Worker) : null;
    },

    // Get workers by team for tax reporting
    getTaxReportWorkersByTeams: async (teamIds: string[]): Promise<Worker[]> => {
        if (!teamIds || teamIds.length === 0) return [];
        const q = query(
            collection(db, 'workers'),
            where('teamId', 'in', teamIds.slice(0, 10))
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => normalizeWorkerSalaryFields({ id: d.id, ...d.data() } as Worker));
    },

    // Get worker by email
    getWorkerByEmail: async (email: string): Promise<Worker | null> => {
        const q = query(
            collection(db, 'workers'),
            where('email', '==', email.trim()),
            limit(1)
        );
        const snapshot = await getDocs(q);
        if (snapshot.empty) return null;
        return normalizeWorkerSalaryFields({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Worker);
    },

    // Get worker by Firebase Auth UID
    getWorkerByUid: async (uid: string): Promise<Worker | null> => {
        const q = query(
            collection(db, 'workers'),
            where('uid', '==', uid),
            limit(1)
        );
        const snapshot = await getDocs(q);
        if (snapshot.empty) return null;
        return normalizeWorkerSalaryFields({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Worker);
    },

    // Link a worker record to a Firebase Auth UID
    linkWorkerToUid: async (workerId: string, uid: string): Promise<void> => {
        const { userService } = await import('./userService');
        await userService.linkUserToWorker(uid, workerId);
        cachedWorkers = null;
    },
    // Get worker by name
    getWorkerByName: async (name: string): Promise<Worker | null> => {
        const q = query(
            collection(db, 'workers'),
            where('name', '==', name.trim()),
            limit(1)
        );
        const snapshot = await getDocs(q);
        if (snapshot.empty) return null;
        return normalizeWorkerSalaryFields({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Worker);
    },

    // Add a new worker
    addWorker: async (worker: any, _silent?: boolean): Promise<string> => {
        const data = syncWorkerSalaryFields(worker) as Record<string, unknown>;
        const id = await workerFirestoreService.addWorker(data as any);
        cachedWorkers = null;
        await logWorkerChange('created', null, snapshotWorker(id, data), 'manpowerService.addWorker');
        return id;
    },

    // Update a worker
    updateWorker: async (id: string, updates: Partial<Worker>): Promise<void> => {
        const before = await manpowerService.getWorker(id);
        const normalizedUpdates = stripUndefinedFields(syncWorkerSalaryFields(updates) as Record<string, unknown>);
        await workerFirestoreService.updateWorker(id, normalizedUpdates);
        cachedWorkers = null;
        if (hasOwn(normalizedUpdates, 'role') && before?.uid) {
            const { userService } = await import('./userService');
            await userService.updateUserProfile(String(before.uid), {
                position: String(normalizedUpdates.role ?? '').trim()
            });
        }
        await logWorkerChange(
            'updated',
            before ? snapshotWorker(id, before as Record<string, unknown>) : null,
            snapshotWorker(id, { ...(before ? before as Record<string, unknown> : {}), ...normalizedUpdates }),
            'manpowerService.updateWorker'
        );
    },

    // Delete a worker
    deleteWorker: async (id: string): Promise<void> => {
        const workerSnap = await getDoc(doc(db, 'workers', id));
        const before = workerSnap.exists() ? snapshotWorker(id, workerSnap.data()) : null;
        if (workerSnap.exists()) {
            const data = workerSnap.data();
            if (data?.fileNameSaved) {
                try {
                    const fileRef = ref(storage, `workers/${data.fileNameSaved}`);
                    await deleteObject(fileRef);
                } catch (e) {
                    console.warn('Failed to delete worker file:', e);
                }
            }
        }
        await workerFirestoreService.deleteWorker(id);
        cachedWorkers = null;
        await logWorkerChange('deleted', before, null, 'manpowerService.deleteWorker');
    },

    // Delete multiple workers
    deleteWorkers: async (ids: string[]): Promise<void> => {
        const beforeRows = await Promise.all(ids.map(async (id) => {
            const snap = await getDoc(doc(db, 'workers', id));
            return snap.exists() ? snapshotWorker(id, snap.data()) : null;
        }));
        const batch = writeBatch(db);
        ids.forEach(id => {
            batch.delete(doc(db, 'workers', id));
        });
        await batch.commit();
        cachedWorkers = null;
        await Promise.all(beforeRows.map((before) =>
            before ? logWorkerChange('deleted', before, null, 'manpowerService.deleteWorkers') : Promise.resolve()
        ));
    },

    // Retire a worker (set status to '??�궗')
    retireWorker: async (id: string): Promise<void> => {
        await manpowerService.updateWorker(id, { status: '\uD1F4\uC0AC' });
    },

    // Retire multiple workers
    retireWorkers: async (ids: string[]): Promise<void> => {
        const beforeRows = await Promise.all(ids.map(async (id) => {
            const snap = await getDoc(doc(db, 'workers', id));
            return snap.exists() ? snapshotWorker(id, snap.data()) : null;
        }));
        const updatedAt = Timestamp.now();
        const batch = writeBatch(db);
        ids.forEach(id => {
            batch.update(doc(db, 'workers', id), {
                status: '\uD1F4\uC0AC',
                updatedAt
            });
        });
        await batch.commit();
        cachedWorkers = null;
        await Promise.all(beforeRows.map((before) =>
            before
                ? logWorkerChange(
                    'updated',
                    before,
                    { ...before, status: '\uD1F4\uC0AC', updatedAt },
                    'manpowerService.retireWorkers'
                )
                : Promise.resolve()
        ));
    },

    // Increment man-day count for a worker
    incrementManDay: async (workerId: string, amount: number): Promise<void> => {
        return workerFirestoreService.incrementManDay(workerId, amount);
    },

    // Get workers by team
    getWorkersByTeam: async (teamId: string): Promise<Worker[]> => {
        return (await workerFirestoreService.getWorkersByTeam(teamId)).map((worker) => normalizeWorkerSalaryFields(worker as Worker));
    },

    // Get worker identity map (uid/email by workerId)
    getWorkerIdentityMap: async (): Promise<Map<string, { uid?: string; email?: string }>> => {
        const map = new Map<string, { uid?: string; email?: string }>();
        const workers = await manpowerService.getWorkers();

        workers.forEach(w => {
            if (w.id && (w.uid || w.email)) {
                map.set(w.id, { uid: w.uid ?? undefined, email: w.email ?? undefined });
            }
        });
        return map;
    },

    // Update team name for all related workers
    updateWorkersTeamName: async (teamId: string, teamName: string) => {
        const q = query(collection(db, 'workers'), where('teamId', '==', teamId));
        const snapshot = await getDocs(q);
        const rows = snapshot.docs.map(d => snapshotWorker(d.id, d.data()));
        const updatedAt = Timestamp.now();
        const batch = writeBatch(db);
        snapshot.docs.forEach(d => {
            batch.update(d.ref, { teamName, updatedAt });
        });
        await batch.commit();
        cachedWorkers = null;
        await Promise.all(rows.map((before) =>
            logWorkerChange(
                'updated',
                before,
                { ...before, teamName, updatedAt },
                'manpowerService.updateWorkersTeamName'
            )
        ));
    },

    updateWorkersTeamColor: async (teamId: string, color: string) => {
        const q = query(collection(db, 'workers'), where('teamId', '==', teamId));
        const snapshot = await getDocs(q);
        if (snapshot.empty) return;

        const rows = snapshot.docs.map(d => snapshotWorker(d.id, d.data()));
        const updatedAt = Timestamp.now();
        const batch = writeBatch(db);
        snapshot.docs.forEach(d => {
            batch.update(d.ref, { color, updatedAt });
        });
        await batch.commit();
        cachedWorkers = null;
        await Promise.all(rows.map((before) =>
            logWorkerChange(
                'updated',
                before,
                { ...before, color, updatedAt },
                'manpowerService.updateWorkersTeamColor'
            )
        ));
    },

    // Update salary model for all workers in a team
    updateWorkersSalaryModelByTeam: async (teamId: string, salaryModel: string) => {
        const q = query(collection(db, 'workers'), where('teamId', '==', teamId));
        const snapshot = await getDocs(q);
        const rows = snapshot.docs.map(d => snapshotWorker(d.id, d.data()));
        const batch = writeBatch(db);
        const syncedUpdates = syncWorkerSalaryFields({ salaryModel });
        const cleanedUpdates = stripUndefinedFields(syncedUpdates as Record<string, unknown>);
        const updatedAt = Timestamp.now();
        snapshot.docs.forEach(d => {
            batch.update(d.ref, { ...cleanedUpdates, updatedAt });
        });
        await batch.commit();
        cachedWorkers = null;
        await Promise.all(rows.map((before) =>
            logWorkerChange(
                'updated',
                before,
                { ...before, ...cleanedUpdates, updatedAt },
                'manpowerService.updateWorkersSalaryModelByTeam'
            )
        ));
    },

    // Update site name for all related workers
    updateWorkersSiteName: async (siteId: string, siteName: string) => {
        const q = query(collection(db, 'workers'), where('siteId', '==', siteId));
        const snapshot = await getDocs(q);
        const rows = snapshot.docs.map(d => snapshotWorker(d.id, d.data()));
        const updatedAt = Timestamp.now();
        const batch = writeBatch(db);
        snapshot.docs.forEach(d => {
            batch.update(d.ref, { siteName, updatedAt });
        });
        await batch.commit();
        cachedWorkers = null;
        await Promise.all(rows.map((before) =>
            logWorkerChange(
                'updated',
                before,
                { ...before, siteName, updatedAt },
                'manpowerService.updateWorkersSiteName'
            )
        ));
    },

    // Update company name for all related workers
    updateWorkersCompanyName: async (companyId: string, companyName: string) => {
        const q = query(collection(db, 'workers'), where('companyId', '==', companyId));
        const snapshot = await getDocs(q);
        const rows = snapshot.docs.map(d => snapshotWorker(d.id, d.data()));
        const updatedAt = Timestamp.now();
        const batch = writeBatch(db);
        snapshot.docs.forEach(d => {
            batch.update(d.ref, { companyName, updatedAt });
        });
        await batch.commit();
        cachedWorkers = null;
        await Promise.all(rows.map((before) =>
            logWorkerChange(
                'updated',
                before,
                { ...before, companyName, updatedAt },
                'manpowerService.updateWorkersCompanyName'
            )
        ));
    },

    // Sync partner company workers team type
    syncPartnerCompanyWorkersTeamType: async (): Promise<{ updated: number, errors: string[] }> => {
        const errors: string[] = [];
        let updatedCount = 0;
        try {
            const companiesSnap = await getDocs(query(
                collection(db, 'companies'),
                where('type', '==', '\uD611\uB825\uC0AC')
            ));
            const partnerCompanyIds = companiesSnap.docs.map(d => d.id);
            if (partnerCompanyIds.length === 0) return { updated: 0, errors: ['?묐젰??? ??�뒿??�떎.'] };

            const teamsSnap = await getDocs(query(
                collection(db, 'teams'),
                where('companyId', 'in', partnerCompanyIds.slice(0, 10))
            ));
            const partnerTeamIds = new Set(teamsSnap.docs.map(d => d.id));
            if (partnerTeamIds.size === 0) return { updated: 0, errors: ['?묐젰?????�� ??????�뒿??�떎.'] };

            const workersSnap = await getDocs(collection(db, 'workers'));
            const batch = writeBatch(db);
            workersSnap.docs.forEach(d => {
                const data = d.data();
                if (data.teamId && partnerTeamIds.has(data.teamId)) {
                    batch.update(d.ref, { salaryModel: '吏?�?', updatedAt: Timestamp.now() });
                    updatedCount++;
                }
            });
            await batch.commit();
            return { updated: updatedCount, errors };
        } catch (error) {
            console.error('Error syncing partner company workers:', error);
            errors.push(`??�린??�???�쪟 諛쒖�? ${error}`);
            return { updated: updatedCount, errors };
        }
    },

    // Update multiple workers in a batch.
    // Supports both legacy call shapes:
    // 1) updateWorkersBatch([{ id, updates }, ...])
    // 2) updateWorkersBatch([id1, id2], updates)
    updateWorkersBatch: async (
        workerIdsOrUpdates: string[] | { id: string, updates: Partial<Worker> }[],
        sharedUpdates?: Partial<Worker>
    ): Promise<void> => {
        if (!workerIdsOrUpdates || workerIdsOrUpdates.length === 0) return;

        const updates = typeof workerIdsOrUpdates[0] === 'string'
            ? (workerIdsOrUpdates as string[]).map(id => ({ id, updates: { ...(sharedUpdates ?? {}) } }))
            : (workerIdsOrUpdates as { id: string, updates: Partial<Worker> }[]);

        if (updates.length === 0) return;

        const preparedUpdates = updates.map(({ id, updates: workerUpdates }) => ({
            id,
            updates: stripUndefinedFields(syncWorkerSalaryFields(workerUpdates) as Record<string, unknown>),
        }));
        const beforeRows = await Promise.all(preparedUpdates.map(async ({ id }) => {
            const snap = await getDoc(doc(db, 'workers', id));
            return snap.exists() ? snapshotWorker(id, snap.data()) : null;
        }));
        const updatedAt = Timestamp.now();
        const batch = writeBatch(db);
        preparedUpdates.forEach(({ id, updates: workerUpdates }) => {
            const workerRef = doc(db, 'workers', id);
            batch.update(workerRef, {
                ...workerUpdates,
                updatedAt
            });
        });

        await batch.commit();
        cachedWorkers = null;
        await Promise.all(preparedUpdates.map(({ updates: workerUpdates }, index) => {
            const before = beforeRows[index];
            return before
                ? logWorkerChange(
                    'updated',
                    before,
                    { ...before, ...workerUpdates, updatedAt },
                    'manpowerService.updateWorkersBatch'
                )
                : Promise.resolve();
        }));
    },
};




