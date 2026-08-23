import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';

const PDF_RENDER_OPERATIONS_COLLECTION = 'constructionPlanPdfRenderOperations';
const EXPORT_JOBS_COLLECTION = 'constructionPlanExportJobs';
const HEARTBEAT_INTERVAL_MS = 30_000;
export const PDF_RENDER_STALE_AFTER_MS = 7 * 60_000;
export const PDF_VISUAL_CHECK_OVERDUE_AFTER_MS = 24 * 60 * 60_000;
const MONITOR_BATCH_LIMIT = 500;

type PdfRenderProfile = 'candidate' | 'issued';
type PdfRenderFailureKind = 'OOM' | 'TIMEOUT' | 'DATA_LOSS' | 'RENDER_ERROR';

interface PdfRenderOperationIdentity {
    planId: string;
    approvedSnapshotHash: string;
    templateBindingHash: string;
    drawingBindingHash: string;
    rendererVersion: string;
    profile: PdfRenderProfile;
    actorId: string;
}

interface PdfRenderOperationHandle {
    id: string;
    active: boolean;
    startedAtEpochMs: number;
    reference: admin.firestore.DocumentReference;
}

export interface PdfRenderSuccessMetadata {
    sha256: string;
    sizeBytes: number;
    pageCount: number;
    renderInputHash?: string;
}

interface RunMonitoredPdfRenderOptions<T> extends PdfRenderOperationIdentity {
    task: () => Promise<T>;
    summarize: (result: T) => PdfRenderSuccessMetadata;
}

const database = () => admin.firestore();

const normalizedErrorText = (error: unknown): string => {
    if (error instanceof Error) return `${error.name} ${error.message}`.toLowerCase();
    if (typeof error === 'string') return error.toLowerCase();
    if (error && typeof error === 'object') {
        const record = error as Record<string, unknown>;
        return `${String(record.code || '')} ${String(record.message || '')}`.toLowerCase();
    }
    return 'unknown render error';
};

export const classifyConstructionPlanPdfRenderFailure = (error: unknown): PdfRenderFailureKind => {
    const text = normalizedErrorText(error);
    if (/heap out of memory|allocation failed|out[- ]of[- ]memory|oom/.test(text)) return 'OOM';
    if (/deadline|timed?\s*out|timeout/.test(text)) return 'TIMEOUT';
    if (/data-loss|data_loss|sha-?256|provenance|page count|page-count/.test(text)) return 'DATA_LOSS';
    return 'RENDER_ERROR';
};

export const isConstructionPlanPdfRenderStale = (
    heartbeatAtEpochMs: unknown,
    nowEpochMs: number,
): boolean => Number.isFinite(heartbeatAtEpochMs)
    && Number(heartbeatAtEpochMs) > 0
    && Number(heartbeatAtEpochMs) <= nowEpochMs - PDF_RENDER_STALE_AFTER_MS;

export const isConstructionPlanPdfVisualCheckOverdue = (
    preparedAt: unknown,
    nowEpochMs: number,
): boolean => typeof preparedAt === 'string'
    && !Number.isNaN(Date.parse(preparedAt))
    && Date.parse(preparedAt) <= nowEpochMs - PDF_VISUAL_CHECK_OVERDUE_AFTER_MS;

export const buildConstructionPlanPdfRenderStartRecord = (
    identity: PdfRenderOperationIdentity,
    operationId: string,
    nowEpochMs: number,
): Record<string, unknown> => {
    const timestamp = new Date(nowEpochMs).toISOString();
    return {
        id: operationId,
        schemaVersion: 1,
        authority: 'server',
        status: 'RUNNING',
        phase: 'RENDERING',
        ...identity,
        startedAt: timestamp,
        heartbeatAt: timestamp,
        heartbeatAtEpochMs: nowEpochMs,
        expectedDeadlineAt: new Date(nowEpochMs + PDF_RENDER_STALE_AFTER_MS).toISOString(),
        createdAt: timestamp,
        updatedAt: timestamp,
    };
};

const memoryUsageProjection = (): Record<string, number> => {
    const usage = process.memoryUsage();
    return {
        rssBytes: usage.rss,
        heapUsedBytes: usage.heapUsed,
        externalBytes: usage.external,
    };
};

const beginOperation = async (
    identity: PdfRenderOperationIdentity,
): Promise<PdfRenderOperationHandle> => {
    const reference = database().collection(PDF_RENDER_OPERATIONS_COLLECTION).doc();
    const nowEpochMs = Date.now();
    try {
        await reference.create({
            ...buildConstructionPlanPdfRenderStartRecord(identity, reference.id, nowEpochMs),
            memory: memoryUsageProjection(),
        });
        return { id: reference.id, reference, active: true, startedAtEpochMs: nowEpochMs };
    } catch (error) {
        functions.logger.error('[constructionPlans] PDF render monitoring start failed', {
            operationId: reference.id,
            planId: identity.planId,
            profile: identity.profile,
            error,
        });
        return { id: reference.id, reference, active: false, startedAtEpochMs: nowEpochMs };
    }
};

const updateOperationBestEffort = async (
    operation: PdfRenderOperationHandle,
    patch: Record<string, unknown>,
): Promise<void> => {
    if (!operation.active) return;
    try {
        await operation.reference.update(patch);
    } catch (error) {
        functions.logger.error('[constructionPlans] PDF render monitoring update failed', {
            operationId: operation.id,
            error,
        });
    }
};

export const runMonitoredConstructionPlanPdfRender = async <T>(
    options: RunMonitoredPdfRenderOptions<T>,
): Promise<T> => {
    const {
        task,
        summarize,
        ...identity
    } = options;
    const operation = await beginOperation(identity);
    const heartbeat = setInterval(() => {
        const nowEpochMs = Date.now();
        void updateOperationBestEffort(operation, {
            heartbeatAt: new Date(nowEpochMs).toISOString(),
            heartbeatAtEpochMs: nowEpochMs,
            memory: memoryUsageProjection(),
            updatedAt: new Date(nowEpochMs).toISOString(),
        });
    }, HEARTBEAT_INTERVAL_MS);
    heartbeat.unref?.();

    try {
        const result = await task();
        const completedAtEpochMs = Date.now();
        await updateOperationBestEffort(operation, {
            status: 'SUCCEEDED',
            phase: 'COMPLETE',
            result: summarize(result),
            heartbeatAt: new Date(completedAtEpochMs).toISOString(),
            heartbeatAtEpochMs: completedAtEpochMs,
            completedAt: new Date(completedAtEpochMs).toISOString(),
            durationMs: completedAtEpochMs - operation.startedAtEpochMs,
            memory: memoryUsageProjection(),
            updatedAt: new Date(completedAtEpochMs).toISOString(),
        });
        return result;
    } catch (error) {
        const failedAtEpochMs = Date.now();
        const failureKind = classifyConstructionPlanPdfRenderFailure(error);
        await updateOperationBestEffort(operation, {
            status: 'FAILED',
            phase: 'FAILED',
            failureKind,
            errorCode: error && typeof error === 'object' && 'code' in error
                ? String((error as { code?: unknown }).code || 'unknown')
                : 'unknown',
            heartbeatAt: new Date(failedAtEpochMs).toISOString(),
            heartbeatAtEpochMs: failedAtEpochMs,
            failedAt: new Date(failedAtEpochMs).toISOString(),
            memory: memoryUsageProjection(),
            updatedAt: new Date(failedAtEpochMs).toISOString(),
        });
        functions.logger.error('[constructionPlans] PDF render failed', {
            operationId: operation.id,
            planId: identity.planId,
            profile: identity.profile,
            failureKind,
            errorCode: error && typeof error === 'object' && 'code' in error
                ? String((error as { code?: unknown }).code || 'unknown')
                : 'unknown',
            errorName: error instanceof Error ? error.name : typeof error,
        });
        throw error;
    } finally {
        clearInterval(heartbeat);
    }
};

const markStalledOperation = async (
    snapshot: admin.firestore.QueryDocumentSnapshot,
    nowEpochMs: number,
): Promise<boolean> => database().runTransaction(async (transaction) => {
    const current = await transaction.get(snapshot.ref);
    const record = current.data();
    if (!current.exists || record?.status !== 'RUNNING'
        || !isConstructionPlanPdfRenderStale(record?.heartbeatAtEpochMs, nowEpochMs)) return false;
    const timestamp = new Date(nowEpochMs).toISOString();
    transaction.update(snapshot.ref, {
        status: 'STALLED',
        phase: 'STALLED',
        failureKind: 'TIMEOUT',
        stalledDetectedAt: timestamp,
        updatedAt: timestamp,
    });
    return true;
});

const alertOverdueVisualCheck = async (
    snapshot: admin.firestore.QueryDocumentSnapshot,
    nowEpochMs: number,
): Promise<boolean> => database().runTransaction(async (transaction) => {
    const current = await transaction.get(snapshot.ref);
    const record = current.data();
    if (!current.exists || record?.status !== 'READY_FOR_VISUAL_CHECK'
        || record.visualCheckOverdueAlertedAt
        || !isConstructionPlanPdfVisualCheckOverdue(record?.preparedAt, nowEpochMs)) return false;
    transaction.update(snapshot.ref, {
        visualCheckOverdueAlertedAt: new Date(nowEpochMs).toISOString(),
        updatedAt: new Date(nowEpochMs).toISOString(),
    });
    return true;
});

export const monitorConstructionPlanPdfRenderOperationsScheduled = functions
    .runWith({ timeoutSeconds: 300, memory: '512MB', maxInstances: 1 })
    .region('asia-northeast3')
    .pubsub.schedule('every 5 minutes')
    .timeZone('Asia/Seoul')
    .onRun(async () => {
        const nowEpochMs = Date.now();
        const [runningOperations, visualCheckJobs] = await Promise.all([
            database().collection(PDF_RENDER_OPERATIONS_COLLECTION)
                .where('status', '==', 'RUNNING').limit(MONITOR_BATCH_LIMIT).get(),
            database().collection(EXPORT_JOBS_COLLECTION)
                .where('status', '==', 'READY_FOR_VISUAL_CHECK').limit(MONITOR_BATCH_LIMIT).get(),
        ]);

        for (const snapshot of runningOperations.docs) {
            if (!isConstructionPlanPdfRenderStale(snapshot.data().heartbeatAtEpochMs, nowEpochMs)) continue;
            if (await markStalledOperation(snapshot, nowEpochMs)) {
                const record = snapshot.data();
                functions.logger.error('[constructionPlans] PDF render operation stalled', {
                    operationId: snapshot.id,
                    planId: record.planId,
                    profile: record.profile,
                    heartbeatAt: record.heartbeatAt,
                });
            }
        }

        for (const snapshot of visualCheckJobs.docs) {
            if (!isConstructionPlanPdfVisualCheckOverdue(snapshot.data().preparedAt, nowEpochMs)) continue;
            if (await alertOverdueVisualCheck(snapshot, nowEpochMs)) {
                const record = snapshot.data();
                functions.logger.warn('[constructionPlans] PDF candidate visual check overdue', {
                    jobId: snapshot.id,
                    planId: record.planId,
                    preparedAt: record.preparedAt,
                });
            }
        }
        return null;
    });
