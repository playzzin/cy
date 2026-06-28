import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    limit,
    serverTimestamp,
    writeBatch,
    getCountFromServer,
} from 'firebase/firestore';
import { format } from 'date-fns';
import { db } from '../config/firebase';
import {
    DailyReportSchema,
    DailyReportZod,
    DailyReportInputZod,
    DailyReportWorkerZod,
    DailyReportWorkerInputZod,
} from '../types/zod/dailyReportSchema';
import { createConverter } from '../utils/firestoreConverter';
import { toast } from '../utils/swal';

const COLLECTION_NAME = 'daily_reports';
const reportConverter = createConverter(DailyReportSchema);

const normalizeWorker = (worker: Partial<DailyReportWorkerInputZod>): DailyReportWorkerZod => ({
    workerId: worker.workerId ?? '',
    name: worker.name ?? '',
    role: worker.role,
    status: worker.status ?? 'attendance',
    manDay: worker.manDay ?? 0,
    workContent: worker.workContent,
    teamId: worker.teamId,
    unitPrice: worker.unitPrice,
    payType: worker.payType,
    salaryModel: worker.salaryModel,
    siteType: worker.siteType,
    paymentType: worker.paymentType,
    workerTeamName: worker.workerTeamName,
});

const withSiteSnapshot = (
    worker: DailyReportWorkerZod,
    siteType?: string | null,
    paymentType?: string | null
): DailyReportWorkerZod => ({
    ...worker,
    siteType: worker.siteType ?? siteType ?? undefined,
    paymentType: worker.paymentType ?? paymentType ?? undefined,
});

const normalizeReport = (
    report: Partial<DailyReportInputZod> & Pick<DailyReportInputZod, 'date' | 'teamId' | 'siteId'>
): DailyReportZod => ({
    ...report,
    workers: Array.isArray(report.workers) ? report.workers.map(worker => normalizeWorker(worker as DailyReportWorkerInputZod)) : [],
    totalManDay: report.totalManDay ?? 0,
    totalAmount: report.totalAmount ?? 0,
}) as DailyReportZod;

export const dailyReportFirestoreService = {
    getCollection() {
        return collection(db, COLLECTION_NAME).withConverter(reportConverter);
    },

    async getReport(id: string): Promise<DailyReportZod | null> {
        const docRef = doc(db, COLLECTION_NAME, id).withConverter(reportConverter);
        const snap = await getDoc(docRef);
        return snap.exists() ? normalizeReport(snap.data() as DailyReportInputZod) : null;
    },

    async getReportsByDate(date: string): Promise<DailyReportZod[]> {
        const q = query(
            this.getCollection(),
            where('date', '==', date),
            orderBy('createdAt', 'desc')
        );
        const snap = await getDocs(q);
        return snap.docs.map(d => normalizeReport(d.data() as DailyReportInputZod));
    },

    async getReportsByTeam(teamId: string, limitCount: number = 50): Promise<DailyReportZod[]> {
        const q = query(
            this.getCollection(),
            where('teamId', '==', teamId),
            orderBy('date', 'desc'),
            limit(limitCount)
        );
        const snap = await getDocs(q);
        return snap.docs.map(d => normalizeReport(d.data() as DailyReportInputZod));
    },

    async getReportsByRange(params: {
        startDate: string;
        endDate: string;
        teamId?: string;
        siteId?: string;
    }): Promise<DailyReportZod[]> {
        let q = query(
            this.getCollection(),
            where('date', '>=', params.startDate),
            where('date', '<=', params.endDate),
            orderBy('date', 'desc')
        );

        if (params.teamId) {
            q = query(q, where('teamId', '==', params.teamId));
        }
        if (params.siteId) {
            q = query(q, where('siteId', '==', params.siteId));
        }

        const snap = await getDocs(q);
        return snap.docs.map(d => normalizeReport(d.data() as DailyReportInputZod));
    },

    async addReport(data: Omit<DailyReportInputZod, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
        const docRef = doc(collection(db, COLLECTION_NAME)).withConverter(reportConverter);
        await setDoc(docRef, {
            ...data,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        } as any);
        toast.saved('report', 1);
        return docRef.id;
    },

    async updateReport(id: string, data: Partial<DailyReportInputZod>): Promise<void> {
        const docRef = doc(db, COLLECTION_NAME, id).withConverter(reportConverter);
        await updateDoc(docRef, {
            ...data,
            updatedAt: serverTimestamp(),
        });
        toast.updated('report');
    },

    async updateReportsBatch(reports: Array<{ id: string; data: Partial<DailyReportInputZod> }>): Promise<void> {
        const validReports = reports.filter(report => report.id);
        const chunkSize = 450;

        for (let index = 0; index < validReports.length; index += chunkSize) {
            const batch = writeBatch(db);
            validReports.slice(index, index + chunkSize).forEach(({ id, data }) => {
                const docRef = doc(db, COLLECTION_NAME, id).withConverter(reportConverter);
                batch.update(docRef, {
                    ...data,
                    updatedAt: serverTimestamp(),
                } as any);
            });
            await batch.commit();
        }

        if (validReports.length > 0) {
            toast.updated('report');
        }
    },

    async deleteReport(id: string): Promise<void> {
        await deleteDoc(doc(db, COLLECTION_NAME, id));
        toast.deleted('report', 1);
    },

    async saveReportsBatch(reports: Array<Omit<DailyReportInputZod, 'id' | 'createdAt' | 'updatedAt'>>): Promise<string[]> {
        const batch = writeBatch(db);
        const ids: string[] = [];
        reports.forEach(report => {
            const docRef = doc(collection(db, COLLECTION_NAME)).withConverter(reportConverter);
            ids.push(docRef.id);
            batch.set(docRef, {
                ...report,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            } as any);
        });
        await batch.commit();
        toast.saved('report', reports.length);
        return ids;
    },

    async getDBStats(): Promise<{ total: number; thisMonth: number; today: number }> {
        const today = format(new Date(), 'yyyy-MM-dd');
        const thisMonth = format(new Date(), 'yyyy-MM');

        const [totalSnap, monthSnap, todaySnap] = await Promise.all([
            getCountFromServer(this.getCollection()),
            getCountFromServer(query(this.getCollection(), where('date', '>=', `${thisMonth}-01`), where('date', '<=', `${thisMonth}-31`))),
            getCountFromServer(query(this.getCollection(), where('date', '==', today)))
        ]);

        return {
            total: totalSnap.data().count,
            thisMonth: monthSnap.data().count,
            today: todaySnap.data().count
        };
    },

    async upsertReportWorkersBatch(params: {
        date: string;
        teamId: string;
        teamName: string;
        siteId: string;
        siteName: string;
        siteType?: string;
        paymentType?: string;
        workers: DailyReportWorkerInputZod[];
    }): Promise<void> {
        const q = query(
            this.getCollection(),
            where('date', '==', params.date),
            where('teamId', '==', params.teamId),
            where('siteId', '==', params.siteId),
            limit(1)
        );
        const snap = await getDocs(q);
        const reportDoc = snap.docs[0];

        if (reportDoc) {
            const existingData = normalizeReport(reportDoc.data() as DailyReportInputZod);
            const nextSiteType = String(params.siteType ?? '').trim() || existingData.siteType;
            const nextPaymentType = String(params.paymentType ?? '').trim() || existingData.paymentType;
            const updatedWorkers = [...existingData.workers];

            params.workers.forEach(newWorker => {
                const normalizedWorker = normalizeWorker(newWorker);
                const idx = updatedWorkers.findIndex(worker => worker.workerId === normalizedWorker.workerId);
                if (idx >= 0) {
                    const existingWorker = updatedWorkers[idx];
                    updatedWorkers[idx] = {
                        ...existingWorker,
                        ...normalizedWorker,
                        siteType: normalizedWorker.siteType ?? existingWorker.siteType ?? nextSiteType,
                        paymentType: normalizedWorker.paymentType ?? existingWorker.paymentType ?? nextPaymentType,
                    };
                } else {
                    updatedWorkers.push(withSiteSnapshot(
                        normalizedWorker,
                        nextSiteType,
                        nextPaymentType
                    ));
                }
            });

            const totalManDay = updatedWorkers.reduce((acc, worker) => acc + (worker.manDay || 0), 0);
            const totalAmount = updatedWorkers.reduce((acc, worker) => acc + ((worker.manDay || 0) * (worker.unitPrice || 0)), 0);

            await this.updateReport(reportDoc.id, {
                siteType: nextSiteType,
                paymentType: nextPaymentType,
                workers: updatedWorkers,
                totalManDay,
                totalAmount,
                updatedAt: serverTimestamp() as any
            });
            return;
        }

        const normalizedWorkers = params.workers.map(worker => withSiteSnapshot(
            normalizeWorker(worker),
            params.siteType,
            params.paymentType
        ));
        const totalManDay = normalizedWorkers.reduce((acc, worker) => acc + (worker.manDay || 0), 0);
        const totalAmount = normalizedWorkers.reduce((acc, worker) => acc + ((worker.manDay || 0) * (worker.unitPrice || 0)), 0);

        await this.addReport({
            date: params.date,
            teamId: params.teamId,
            teamName: params.teamName,
            siteId: params.siteId,
            siteName: params.siteName,
            siteType: params.siteType,
            paymentType: params.paymentType,
            workers: normalizedWorkers,
            totalManDay,
            totalAmount,
            writerId: 'system'
        });
    }
};
