import { db, storage } from '../config/firebase';
import { toast } from '../utils/swal';
import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    getDocs,
    query,
    where,
    orderBy,
    serverTimestamp,
    Timestamp,
    increment,
    writeBatch,
    limit,
    startAfter
} from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';

export interface Worker {
    id?: string;
    uid?: string; // Firebase Auth UID
    name: string;
    idNumber: string;
    address?: string;
    contact?: string;
    email?: string;
    role?: string;
    teamId?: string; // Reference to Team
    teamType: string;
    teamName?: string;
    status: string;

    unitPrice: number;
    payType?: string; // 급여 형태 (일급제 등)
    bankName?: string;
    accountNumber?: string;
    accountHolder?: string;
    fileNameSaved?: string;
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
    needsApproval?: boolean; // 관리자 승인 필요 여부
    totalManDay?: number; // 누적 공수
    salaryModel?: string; // 급여 형태 (일급제, 주급제, 월급제, 지원팀, 용역팀, 가지급)
    employmentType?: string; // 고용 형태 (일용직, 상용직 등)
    rank?: string; // 직급/숙련도
    siteId?: string; // 현장 ID
    siteName?: string; // 현장명
    companyId?: string; // 소속 회사 ID
    companyName?: string; // 소속 회사명
    leaderName?: string; // 팀장명 (임시 저장용, 동기화 시 사용)
    color?: string; // 작업자 식별용 색상 (HEX)
    iconKey?: string;
    signatureUrl?: string; // 전자 서명 이미지 URL
}

const COLLECTION_NAME = 'workers';

export const manpowerService = {
    // Get all workers (Paginated)
    getWorkersPaginated: async (limitCount: number, lastDoc: any = null): Promise<{ workers: Worker[], lastDoc: any }> => {
        try {
            let q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'), limit(limitCount));
            if (lastDoc) {
                q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'), startAfter(lastDoc), limit(limitCount));
            }
            const querySnapshot = await getDocs(q);
            const workers = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Worker));
            return {
                workers,
                lastDoc: querySnapshot.docs[querySnapshot.docs.length - 1]
            };
        } catch (error) {
            console.error("Error fetching workers paginated:", error);
            throw error;
        }
    },

    // Get all workers (Legacy - kept for compatibility if needed, but ideally replaced)
    getWorkers: async (): Promise<Worker[]> => {
        try {
            const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'));
            const querySnapshot = await getDocs(q);
            return querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Worker));
        } catch (error) {
            console.error("Error fetching workers:", error);
            throw error;
        }
    },

    // 이메일로 Worker 조회
    getWorkerByEmail: async (email: string): Promise<Worker | null> => {
        try {
            const q = query(
                collection(db, COLLECTION_NAME),
                where('email', '==', email)
            );
            const querySnapshot = await getDocs(q);
            if (querySnapshot.empty) return null;
            return {
                id: querySnapshot.docs[0].id,
                ...querySnapshot.docs[0].data()
            } as Worker;
        } catch (error) {
            console.error("Error finding worker by email:", error);
            throw error;
        }
    },

    // 이름으로 Worker 조회
    getWorkerByName: async (name: string): Promise<Worker | null> => {
        try {
            const q = query(collection(db, COLLECTION_NAME), where('name', '==', name), limit(1));
            const querySnapshot = await getDocs(q);
            if (querySnapshot.empty) return null;
            return { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() } as Worker;
        } catch (error) {
            console.error("Error finding worker by name:", error);
            throw error;
        }
    },

    // Add a new worker with email validation
    addWorker: async (worker: Omit<Worker, 'id'>, checkEmail = true): Promise<string> => {
        try {
            // 이메일 중복 체크
            if (checkEmail && worker.email) {
                const existingWorker = await manpowerService.getWorkerByEmail(worker.email);
                if (existingWorker) {
                    throw new Error('이미 등록된 이메일입니다.');
                }
            }

            const normalizedWorker: Omit<Worker, 'id'> = { ...worker };
            const mergedSalaryModel = normalizedWorker.salaryModel ?? normalizedWorker.payType;
            if (mergedSalaryModel !== undefined) {
                normalizedWorker.salaryModel = mergedSalaryModel;
                normalizedWorker.payType = mergedSalaryModel;
            }

            if (typeof normalizedWorker.iconKey !== 'string') {
                normalizedWorker.iconKey = '';
            }

            const docRef = await addDoc(collection(db, COLLECTION_NAME), {
                ...normalizedWorker,
                needsApproval: !!normalizedWorker.uid, // UID가 있으면 승인 필요 상태로 설정
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });

            // Audit Log
            try {
                const { auditService } = await import('./auditService');
                await auditService.log({
                    action: 'CREATE_WORKER',
                    category: 'MANPOWER',
                    actorId: 'manager', // Placeholder
                    actorEmail: 'system', // Placeholder
                    targetId: docRef.id,
                    details: { name: worker.name }
                });
            } catch (e) { console.warn(e); }

            toast.saved('작업자', 1);
            return docRef.id;
        } catch (error) {
            console.error("Error adding worker:", error);
            throw error;
        }
    },

    // Update a worker with email validation
    updateWorker: async (id: string, updates: Partial<Worker>): Promise<void> => {
        try {
            // 이메일이 변경되는 경우 중복 체크
            if (updates.email) {
                const existingWorker = await manpowerService.getWorkerByEmail(updates.email);
                if (existingWorker && existingWorker.id !== id) {
                    throw new Error('이미 다른 계정에 등록된 이메일입니다.');
                }
            }

            const normalizedUpdates: Partial<Worker> = { ...updates };
            const mergedSalaryModel = normalizedUpdates.salaryModel ?? normalizedUpdates.payType;
            if (mergedSalaryModel !== undefined) {
                normalizedUpdates.salaryModel = mergedSalaryModel;
                normalizedUpdates.payType = mergedSalaryModel;
            }

            const docRef = doc(db, COLLECTION_NAME, id);
            await updateDoc(docRef, {
                ...normalizedUpdates,
                updatedAt: serverTimestamp()
            });
        } catch (error) {
            console.error("Error updating worker:", error);
            throw error;
        }
    },

    // UID로 Worker 조회
    getWorkerByUid: async (uid: string): Promise<Worker | null> => {
        try {
            const q = query(
                collection(db, COLLECTION_NAME),
                where('uid', '==', uid)
            );
            const querySnapshot = await getDocs(q);
            if (querySnapshot.empty) return null;
            return {
                id: querySnapshot.docs[0].id,
                ...querySnapshot.docs[0].data()
            } as Worker;
        } catch (error) {
            console.error("Error finding worker by UID:", error);
            throw error;
        }
    },

    // Link a worker to a UID
    linkWorkerToUid: async (workerId: string, uid: string): Promise<void> => {
        try {
            // 1. Check if worker exists
            const workerRef = doc(db, COLLECTION_NAME, workerId);
            const workerSnap = await getDocs(query(collection(db, COLLECTION_NAME), where('__name__', '==', workerId)));

            if (workerSnap.empty) {
                throw new Error('존재하지 않는 근로자입니다.');
            }

            const workerData = workerSnap.docs[0].data() as Worker;

            // 2. Check if worker is already linked
            if (workerData.uid) {
                throw new Error('이미 다른 계정에 연결된 근로자입니다.');
            }

            // 3. Check if UID is already linked to another worker (Double check)
            const existingLink = await manpowerService.getWorkerByUid(uid);
            if (existingLink) {
                throw new Error('이미 다른 근로자 프로필이 연결되어 있습니다.');
            }

            // 4. Link
            await updateDoc(workerRef, {
                uid: uid,
                updatedAt: serverTimestamp()
            });
        } catch (error) {
            console.error("Error linking worker:", error);
            throw error;
        }
    },

    // Find worker for manual linking
    findWorkerForLinking: async (name: string, idNumber: string): Promise<Worker | null> => {
        try {
            const q = query(
                collection(db, COLLECTION_NAME),
                where('name', '==', name),
                where('idNumber', '==', idNumber)
            );
            const querySnapshot = await getDocs(q);
            if (querySnapshot.empty) return null;

            // Return the first match (assuming name+idNumber is unique enough for this context, 
            // though ideally idNumber should be unique)
            return {
                id: querySnapshot.docs[0].id,
                ...querySnapshot.docs[0].data()
            } as Worker;
        } catch (error) {
            console.error("Error finding worker:", error);
            throw error;
        }
    },

    // Delete a worker
    deleteWorker: async (id: string): Promise<void> => {
        try {
            // 0. Get worker data first to check for file
            const workerRef = doc(db, COLLECTION_NAME, id);
            const workerSnap = await getDocs(query(collection(db, COLLECTION_NAME), where('__name__', '==', id)));
            let workerData: Worker | null = null;

            if (!workerSnap.empty) {
                workerData = workerSnap.docs[0].data() as Worker;

                // 1. Check if linked to a user and unlink
                if (workerData.uid) {
                    const { userService } = await import('./userService');
                    await userService.unlinkUserFromWorker(workerData.uid, id);
                }

                // 2. Delete ID card file if exists
                if (workerData.fileNameSaved) {
                    try {
                        const fileRef = ref(storage, workerData.fileNameSaved);
                        await deleteObject(fileRef);
                    } catch (fileError) {
                        console.warn("Failed to delete ID card file:", fileError);
                        // Continue to delete worker even if file deletion fails
                    }
                }
            }

            // 3. Delete worker from Firestore
            await deleteDoc(workerRef);
            toast.deleted('작업자', 1);

            // Audit Log
            try {
                const { auditService } = await import('./auditService');
                await auditService.log({
                    action: 'DELETE_WORKER',
                    category: 'MANPOWER',
                    actorId: 'manager', // Placeholder
                    actorEmail: 'system', // Placeholder
                    targetId: id,
                    details: { deletedFile: !!workerData?.fileNameSaved }
                });
            } catch (e) { console.warn(e); }

        } catch (error) {
            console.error("Error deleting worker:", error);
            throw error;
        }
    },

    // Increment total man-day for a worker
    incrementManDay: async (workerId: string, amount: number): Promise<void> => {
        try {
            const docRef = doc(db, COLLECTION_NAME, workerId);
            await updateDoc(docRef, {
                totalManDay: increment(amount),
                updatedAt: serverTimestamp()
            });
        } catch (error) {
            console.error(`Error incrementing man-day for worker ${workerId}:`, error);
            // We don't throw here to prevent failing the entire batch if one fails, 
            // but in a real app we might want better error handling/rollback.
        }
    },

    // Delete multiple workers
    deleteWorkers: async (ids: string[]): Promise<void> => {
        try {
            // 1. Unlink users and delete files for all workers to be deleted
            const { userService } = await import('./userService');

            for (const id of ids) {
                const workerSnap = await getDocs(query(collection(db, COLLECTION_NAME), where('__name__', '==', id)));
                if (!workerSnap.empty) {
                    const workerData = workerSnap.docs[0].data() as Worker;

                    // Unlink User
                    if (workerData.uid) {
                        await userService.unlinkUserFromWorker(workerData.uid, id);
                    }

                    // Delete File
                    if (workerData.fileNameSaved) {
                        try {
                            const fileRef = ref(storage, workerData.fileNameSaved);
                            await deleteObject(fileRef);
                        } catch (fileError) {
                            console.warn(`Failed to delete ID card file for worker ${id}:`, fileError);
                        }
                    }
                }
            }

            // 2. Delete workers from Firestore
            const batch = writeBatch(db);
            ids.forEach(id => {
                const docRef = doc(db, COLLECTION_NAME, id);
                batch.delete(docRef);
            });
            await batch.commit();
            toast.deleted('작업자', ids.length);

            // Audit Log (Batch log or individual logs? For simplicity, one log entry for the batch)
            try {
                const { auditService } = await import('./auditService');
                await auditService.log({
                    action: 'DELETE_WORKER_BATCH',
                    category: 'MANPOWER',
                    actorId: 'manager', // Placeholder
                    actorEmail: 'system', // Placeholder
                    targetId: 'batch',
                    details: { count: ids.length, ids }
                });
            } catch (e) { console.warn(e); }

        } catch (error) {
            console.error("Error deleting workers batch:", error);
            throw error;
        }
    },

    // Update multiple workers
    updateWorkersBatch: async (ids: string[], updates: Partial<Worker>): Promise<void> => {
        try {
            const normalizedUpdates: Partial<Worker> = { ...updates };
            const mergedSalaryModel = normalizedUpdates.salaryModel ?? normalizedUpdates.payType;
            if (mergedSalaryModel !== undefined) {
                normalizedUpdates.salaryModel = mergedSalaryModel;
                normalizedUpdates.payType = mergedSalaryModel;
            }

            const batch = writeBatch(db);
            ids.forEach(id => {
                const docRef = doc(db, COLLECTION_NAME, id);
                batch.update(docRef, {
                    ...normalizedUpdates,
                    updatedAt: serverTimestamp()
                });
            });
            await batch.commit();
            toast.updated('작업자');

            // Audit Log
            try {
                const { auditService } = await import('./auditService');
                await auditService.log({
                    action: 'UPDATE_WORKER_BATCH',
                    category: 'MANPOWER',
                    actorId: 'manager', // Placeholder
                    actorEmail: 'system', // Placeholder
                    targetId: 'batch',
                    details: { count: ids.length, ids, updates }
                });
            } catch (e) { console.warn(e); }

        } catch (error) {
            console.error("Error updating workers batch:", error);
            throw error;
        }
    },

    // --- Data Synchronization Methods ---

    // Helper: Batch update workers based on a query
    batchUpdateByQuery: async (q: any, updates: Partial<Worker>): Promise<void> => {
        try {
            const querySnapshot = await getDocs(q);
            if (querySnapshot.empty) return;

            const normalizedUpdates: Partial<Worker> = { ...updates };
            const mergedSalaryModel = normalizedUpdates.salaryModel ?? normalizedUpdates.payType;
            if (mergedSalaryModel !== undefined) {
                normalizedUpdates.salaryModel = mergedSalaryModel;
                normalizedUpdates.payType = mergedSalaryModel;
            }

            // Firestore batch limit is 500
            const batches = [];
            let batch = writeBatch(db);
            let count = 0;

            querySnapshot.docs.forEach((doc, index) => {
                batch.update(doc.ref, { ...normalizedUpdates, updatedAt: serverTimestamp() });
                count++;

                if (count === 500) {
                    batches.push(batch.commit());
                    batch = writeBatch(db);
                    count = 0;
                }
            });

            if (count > 0) {
                batches.push(batch.commit());
            }

            await Promise.all(batches);
        } catch (error) {
            console.error("Error in batchUpdateByQuery:", error);
            throw error; // Propagate error or handle silently? Propagate for now.
        }
    },

    // Update Team Name for all related workers
    updateWorkersTeamName: async (teamId: string, teamName: string) => {
        const q = query(collection(db, COLLECTION_NAME), where('teamId', '==', teamId));
        await manpowerService.batchUpdateByQuery(q, { teamName });
    },

    updateWorkersSalaryModelByTeam: async (teamId: string, salaryModel: string) => {
        const q = query(collection(db, COLLECTION_NAME), where('teamId', '==', teamId));
        await manpowerService.batchUpdateByQuery(q, { salaryModel, payType: salaryModel });
    },

    // Update Site Name for all related workers
    updateWorkersSiteName: async (siteId: string, siteName: string) => {
        const q = query(collection(db, COLLECTION_NAME), where('siteId', '==', siteId));
        await manpowerService.batchUpdateByQuery(q, { siteName });
    },

    // Update Company Name for all related workers
    updateWorkersCompanyName: async (companyId: string, companyName: string) => {
        const q = query(collection(db, COLLECTION_NAME), where('companyId', '==', companyId));
        await manpowerService.batchUpdateByQuery(q, { companyName });
    },

    // Sync all workers in partner company teams to have teamType='지원팀'
    syncPartnerCompanyWorkersTeamType: async (): Promise<{ updated: number, errors: string[] }> => {
        const errors: string[] = [];
        let updatedCount = 0;

        try {
            // 1. Get all companies with type='협력사'
            const companiesSnapshot = await getDocs(
                query(collection(db, 'companies'), where('type', '==', '협력사'))
            );
            const partnerCompanyIds = companiesSnapshot.docs.map(doc => doc.id);

            if (partnerCompanyIds.length === 0) {
                return { updated: 0, errors: ['협력사가 없습니다.'] };
            }

            // 2. Get all teams belonging to partner companies
            const teamsSnapshot = await getDocs(collection(db, 'teams'));
            const partnerTeamIds = teamsSnapshot.docs
                .filter(doc => partnerCompanyIds.includes(doc.data().companyId))
                .map(doc => doc.id);

            if (partnerTeamIds.length === 0) {
                return { updated: 0, errors: ['협력사 소속 팀이 없습니다.'] };
            }

            // 3. Get all workers and filter by partner team IDs
            const workersSnapshot = await getDocs(collection(db, COLLECTION_NAME));
            const workersToUpdate = workersSnapshot.docs.filter(doc => {
                const data = doc.data();
                return partnerTeamIds.includes(data.teamId) && data.teamType !== '지원팀';
            });

            if (workersToUpdate.length === 0) {
                return { updated: 0, errors: [] };
            }

            // 4. Batch update (max 500 per batch)
            const batchSize = 500;
            for (let i = 0; i < workersToUpdate.length; i += batchSize) {
                const batch = writeBatch(db);
                const chunk = workersToUpdate.slice(i, i + batchSize);

                chunk.forEach(workerDoc => {
                    batch.update(doc(db, COLLECTION_NAME, workerDoc.id), {
                        teamType: '지원팀',
                        salaryModel: '지원팀',
                        updatedAt: serverTimestamp()
                    });
                });

                await batch.commit();
                updatedCount += chunk.length;
            }

            return { updated: updatedCount, errors };
        } catch (error) {
            console.error('Error syncing partner company workers:', error);
            errors.push(`동기화 중 오류 발생: ${error}`);
            return { updated: updatedCount, errors };
        }
    }
};
