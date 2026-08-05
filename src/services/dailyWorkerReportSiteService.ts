import {
    collection,
    deleteDoc,
    doc,
    getDocs,
    query,
    serverTimestamp,
    setDoc,
    where,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { stripUndefinedFields } from '../utils/stripUndefinedFields';

const COLLECTION_NAME = 'daily_worker_report_sites';

export interface DailyWorkerReportSite {
    id: string;
    date: string;
    workerKey: string;
    workerId: string;
    workerName: string;
    workerTeamId?: string;
    workerTeamName?: string;
    reportedSiteId?: string;
    reportedSiteName: string;
    createdAt?: unknown;
    updatedAt?: unknown;
}

export type DailyWorkerReportSiteInput = Omit<DailyWorkerReportSite, 'id' | 'createdAt' | 'updatedAt'>;

const text = (value: unknown): string => String(value ?? '').trim();

const encodeIdPart = (value: unknown): string => encodeURIComponent(text(value) || 'none');

export const buildDailyWorkerReportSiteId = (workerKey: string, date: string): string => [
    'daily-worker-report-site',
    date,
    workerKey,
].map(encodeIdPart).join('__');

const normalizeRecord = (id: string, data: Record<string, unknown>): DailyWorkerReportSite => ({
    id,
    date: text(data.date),
    workerKey: text(data.workerKey),
    workerId: text(data.workerId),
    workerName: text(data.workerName),
    workerTeamId: text(data.workerTeamId) || undefined,
    workerTeamName: text(data.workerTeamName) || undefined,
    reportedSiteId: text(data.reportedSiteId) || undefined,
    reportedSiteName: text(data.reportedSiteName),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
});

export const dailyWorkerReportSiteService = {
    async getByDateRange(startDate: string, endDate: string): Promise<DailyWorkerReportSite[]> {
        const snapshot = await getDocs(query(
            collection(db, COLLECTION_NAME),
            where('date', '>=', startDate),
            where('date', '<=', endDate),
        ));

        return snapshot.docs
            .map((item) => normalizeRecord(item.id, item.data()))
            .filter((item) => item.date && item.workerKey && item.reportedSiteName);
    },

    async save(input: DailyWorkerReportSiteInput): Promise<DailyWorkerReportSite> {
        const workerKey = text(input.workerKey);
        const date = text(input.date);
        const reportedSiteName = text(input.reportedSiteName).slice(0, 120);
        if (!workerKey || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !reportedSiteName) {
            throw new Error('작업자, 날짜, 신고 현장명을 확인해주세요.');
        }

        const id = buildDailyWorkerReportSiteId(workerKey, date);
        const payload = stripUndefinedFields({
            date,
            workerKey,
            workerId: text(input.workerId),
            workerName: text(input.workerName),
            workerTeamId: text(input.workerTeamId) || undefined,
            workerTeamName: text(input.workerTeamName) || undefined,
            reportedSiteId: text(input.reportedSiteId) || undefined,
            reportedSiteName,
            updatedAt: serverTimestamp(),
        });

        await setDoc(doc(db, COLLECTION_NAME, id), payload, { merge: true });
        return normalizeRecord(id, payload);
    },

    async delete(workerKey: string, date: string): Promise<void> {
        await deleteDoc(doc(db, COLLECTION_NAME, buildDailyWorkerReportSiteId(workerKey, date)));
    },
};
