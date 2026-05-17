import type { Timestamp } from 'firebase/firestore';
import type { DailyReportZod } from './zod/dailyReportSchema';

export type DailyReportLogAction = 'created' | 'updated' | 'deleted';

export interface DailyReportLogActor {
    uid: string;
    name: string;
    email?: string | null;
}

export interface DailyReportFieldChange {
    field: string;
    label: string;
    before: unknown;
    after: unknown;
}

export interface DailyReportWorkerChange {
    key: string;
    workerId?: string;
    name: string;
    role?: string | null;
    before?: unknown;
    after?: unknown;
    changes?: DailyReportFieldChange[];
}

export interface DailyReportChangeSet {
    fieldChanges: DailyReportFieldChange[];
    workerChanges: {
        added: DailyReportWorkerChange[];
        removed: DailyReportWorkerChange[];
        updated: DailyReportWorkerChange[];
    };
    summaryLines: string[];
    changeCount: number;
}

export interface DailyReportLog {
    id?: string;
    action: DailyReportLogAction;
    actionLabel: string;
    reportId: string;
    reportDate: string;
    siteId?: string;
    siteName: string;
    teamId?: string;
    teamName: string;
    actor: DailyReportLogActor;
    source: string;
    before?: Partial<DailyReportZod> | null;
    after?: Partial<DailyReportZod> | null;
    fieldChanges: DailyReportFieldChange[];
    workerChanges: DailyReportChangeSet['workerChanges'];
    summaryLines: string[];
    summaryText: string;
    changeCount: number;
    createdAt: Timestamp;
    createdAtIso: string;
}

export interface CreateDailyReportLogInput {
    action: DailyReportLogAction;
    before?: Partial<DailyReportZod> | null;
    after?: Partial<DailyReportZod> | null;
    source?: string;
}
