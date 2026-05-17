import {
    Timestamp,
    collection,
    doc,
    getDocs,
    limit,
    onSnapshot,
    orderBy,
    query,
    setDoc,
    type DocumentData,
    type Unsubscribe,
} from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import type { DailyReportZod, DailyReportWorkerZod } from '../types/zod/dailyReportSchema';
import type {
    CreateDailyReportLogInput,
    DailyReportChangeSet,
    DailyReportFieldChange,
    DailyReportLog,
    DailyReportLogAction,
    DailyReportLogActor,
    DailyReportWorkerChange,
} from '../types/dailyReportLog';

const COLLECTION_NAME = 'daily_report_logs';

const ACTION_LABELS: Record<DailyReportLogAction, string> = {
    created: '저장',
    updated: '수정',
    deleted: '삭제',
};

const REPORT_FIELD_LABELS: Record<string, string> = {
    date: '날짜',
    siteId: '현장 ID',
    siteName: '현장명',
    teamId: '팀 ID',
    teamName: '팀명',
    responsibleTeamId: '담당팀 ID',
    responsibleTeamName: '담당팀',
    companyId: '거래처 ID',
    companyName: '거래처',
    constructorCompanyId: '시공사 ID',
    constructorCompanyName: '시공사',
    partnerId: '협력사 ID',
    partnerName: '협력사',
    writerId: '작성자 ID',
    totalManDay: '총공수',
    totalAmount: '총금액',
    weather: '날씨',
    workContent: '작업내용',
    siteType: '현장 구분',
    paymentType: '정산 구분',
};

const WORKER_FIELD_LABELS: Record<string, string> = {
    workerId: '작업자 ID',
    name: '작업자명',
    role: '직책',
    status: '출력 상태',
    manDay: '공수',
    workContent: '작업내용',
    teamId: '소속팀 ID',
    workerTeamName: '소속팀',
    unitPrice: '단가',
    payType: '급여 방식',
    salaryModel: '급여 모델',
    siteType: '현장 구분',
    paymentType: '정산 구분',
};

const REPORT_COMPARE_FIELDS = Object.keys(REPORT_FIELD_LABELS);
const WORKER_COMPARE_FIELDS = Object.keys(WORKER_FIELD_LABELS);

const formatNumber = (value: unknown): string =>
    Number(value || 0).toLocaleString('ko-KR', {
        maximumFractionDigits: 1,
    });

const getReportId = (report?: Partial<DailyReportZod> | null): string =>
    String(report?.id || report?.legacyId || '').trim();

const asText = (value: unknown, fallback = '-'): string => {
    const text = String(value ?? '').trim();
    return text || fallback;
};

const normalizeComparableValue = (value: unknown): unknown => {
    if (value === undefined || value === '') return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    return value;
};

const sameValue = (left: unknown, right: unknown): boolean =>
    JSON.stringify(normalizeComparableValue(left)) === JSON.stringify(normalizeComparableValue(right));

const stripUndefined = (value: unknown): unknown => {
    if (Array.isArray(value)) {
        return value.map((entry) => stripUndefined(entry));
    }
    if (value && typeof value === 'object') {
        if (value instanceof Timestamp) return value;
        if (typeof (value as { toDate?: unknown }).toDate === 'function') return value;

        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>)
                .filter(([, entry]) => entry !== undefined)
                .map(([key, entry]) => [key, stripUndefined(entry)])
        );
    }
    return value === undefined ? null : value;
};

const snapshotReport = (report?: Partial<DailyReportZod> | null): Partial<DailyReportZod> | null => {
    if (!report) return null;
    return stripUndefined({
        id: report.id,
        legacyId: report.legacyId,
        date: report.date,
        teamId: report.teamId,
        teamName: report.teamName,
        siteId: report.siteId,
        siteName: report.siteName,
        responsibleTeamId: report.responsibleTeamId,
        responsibleTeamName: report.responsibleTeamName,
        companyId: report.companyId,
        companyName: report.companyName,
        constructorCompanyId: report.constructorCompanyId,
        constructorCompanyName: report.constructorCompanyName,
        partnerId: report.partnerId,
        partnerName: report.partnerName,
        writerId: report.writerId,
        workers: Array.isArray(report.workers) ? report.workers.map((worker) => stripUndefined(worker)) : [],
        totalManDay: report.totalManDay ?? 0,
        totalAmount: report.totalAmount ?? 0,
        weather: report.weather,
        workContent: report.workContent,
        siteType: report.siteType,
        paymentType: report.paymentType,
        createdAt: report.createdAt,
        updatedAt: report.updatedAt,
    }) as Partial<DailyReportZod>;
};

const fieldChanges = (
    before: Record<string, unknown> | null | undefined,
    after: Record<string, unknown> | null | undefined,
    fields: string[],
    labels: Record<string, string>
): DailyReportFieldChange[] =>
    fields.reduce<DailyReportFieldChange[]>((changes, field) => {
        const beforeValue = before?.[field] ?? null;
        const afterValue = after?.[field] ?? null;
        if (!sameValue(beforeValue, afterValue)) {
            changes.push({
                field,
                label: labels[field] || field,
                before: normalizeComparableValue(beforeValue),
                after: normalizeComparableValue(afterValue),
            });
        }
        return changes;
    }, []);

const workerKeyFor = (worker: Partial<DailyReportWorkerZod>, index: number, seen: Map<string, number>): string => {
    const base = String(worker.workerId || worker.name || `row-${index + 1}`).trim();
    const count = seen.get(base) || 0;
    seen.set(base, count + 1);
    return `${base}#${count + 1}`;
};

const workerMap = (workers?: DailyReportWorkerZod[] | null): Map<string, DailyReportWorkerChange> => {
    const seen = new Map<string, number>();
    const map = new Map<string, DailyReportWorkerChange>();
    (workers || []).forEach((worker, index) => {
        const key = workerKeyFor(worker, index, seen);
        map.set(key, {
            key,
            workerId: worker.workerId,
            name: worker.name || `작업자 ${index + 1}`,
            role: worker.role,
            before: worker,
        });
    });
    return map;
};

const buildWorkerChanges = (
    beforeWorkers?: DailyReportWorkerZod[] | null,
    afterWorkers?: DailyReportWorkerZod[] | null
): DailyReportChangeSet['workerChanges'] => {
    const beforeMap = workerMap(beforeWorkers);
    const afterMap = workerMap(afterWorkers);
    const added: DailyReportWorkerChange[] = [];
    const removed: DailyReportWorkerChange[] = [];
    const updated: DailyReportWorkerChange[] = [];

    afterMap.forEach((afterEntry, key) => {
        const beforeEntry = beforeMap.get(key);
        if (!beforeEntry) {
            added.push({ ...afterEntry, before: undefined, after: afterEntry.before });
            return;
        }

        const changes = fieldChanges(
            beforeEntry.before as Record<string, unknown>,
            afterEntry.before as Record<string, unknown>,
            WORKER_COMPARE_FIELDS,
            WORKER_FIELD_LABELS
        );
        if (changes.length > 0) {
            updated.push({
                key,
                workerId: afterEntry.workerId || beforeEntry.workerId,
                name: afterEntry.name || beforeEntry.name,
                role: afterEntry.role || beforeEntry.role,
                before: beforeEntry.before,
                after: afterEntry.before,
                changes,
            });
        }
    });

    beforeMap.forEach((beforeEntry, key) => {
        if (!afterMap.has(key)) {
            removed.push(beforeEntry);
        }
    });

    return { added, removed, updated };
};

export const buildDailyReportChangeSet = (
    action: DailyReportLogAction,
    beforeReport?: Partial<DailyReportZod> | null,
    afterReport?: Partial<DailyReportZod> | null
): DailyReportChangeSet => {
    const before = snapshotReport(beforeReport);
    const after = snapshotReport(afterReport);
    const reportFieldChanges = action === 'updated'
        ? fieldChanges(before as Record<string, unknown>, after as Record<string, unknown>, REPORT_COMPARE_FIELDS, REPORT_FIELD_LABELS)
        : [];
    const workerChanges = buildWorkerChanges(
        before?.workers as DailyReportWorkerZod[] | undefined,
        after?.workers as DailyReportWorkerZod[] | undefined
    );

    const summaryLines: string[] = [];
    if (action === 'created') {
        summaryLines.push('출력일보가 신규 저장되었습니다.');
    } else if (action === 'deleted') {
        summaryLines.push('출력일보가 삭제되었습니다.');
    } else if (reportFieldChanges.length > 0) {
        summaryLines.push(`기본 정보 ${reportFieldChanges.length}개 항목이 변경되었습니다.`);
    }

    if (workerChanges.added.length > 0) summaryLines.push(`작업자 ${workerChanges.added.length}명이 추가되었습니다.`);
    if (workerChanges.removed.length > 0) summaryLines.push(`작업자 ${workerChanges.removed.length}명이 삭제되었습니다.`);
    if (workerChanges.updated.length > 0) summaryLines.push(`작업자 ${workerChanges.updated.length}명의 상세 정보가 수정되었습니다.`);

    const beforeManDay = Number(before?.totalManDay || 0);
    const afterManDay = Number(after?.totalManDay || 0);
    if (action === 'updated' && beforeManDay !== afterManDay) {
        summaryLines.push(`총공수 ${formatNumber(beforeManDay)}공수에서 ${formatNumber(afterManDay)}공수로 변경되었습니다.`);
    }

    if (summaryLines.length === 0) {
        summaryLines.push('저장 값은 갱신되었으나 주요 업무 필드 변경은 감지되지 않았습니다.');
    }

    const changeCount =
        reportFieldChanges.length +
        workerChanges.added.length +
        workerChanges.removed.length +
        workerChanges.updated.reduce((sum, worker) => sum + (worker.changes?.length || 0), 0);

    return {
        fieldChanges: reportFieldChanges,
        workerChanges,
        summaryLines,
        changeCount,
    };
};

const resolveActor = (): DailyReportLogActor => {
    const user = auth.currentUser;
    if (!user) {
        return { uid: 'system', name: 'ERP 시스템', email: null };
    }

    return {
        uid: user.uid,
        name: user.displayName || user.email || '사용자',
        email: user.email || null,
    };
};

const normalizeLog = (id: string, data: DocumentData): DailyReportLog => ({
    id,
    action: data.action || 'updated',
    actionLabel: data.actionLabel || ACTION_LABELS[data.action as DailyReportLogAction] || '변경',
    reportId: String(data.reportId || ''),
    reportDate: String(data.reportDate || ''),
    siteId: data.siteId ? String(data.siteId) : undefined,
    siteName: String(data.siteName || '현장 미지정'),
    teamId: data.teamId ? String(data.teamId) : undefined,
    teamName: String(data.teamName || '팀 미지정'),
    actor: {
        uid: String(data.actor?.uid || 'system'),
        name: String(data.actor?.name || 'ERP 시스템'),
        email: data.actor?.email || null,
    },
    source: String(data.source || 'dailyReportService'),
    before: data.before || null,
    after: data.after || null,
    fieldChanges: Array.isArray(data.fieldChanges) ? data.fieldChanges : [],
    workerChanges: {
        added: Array.isArray(data.workerChanges?.added) ? data.workerChanges.added : [],
        removed: Array.isArray(data.workerChanges?.removed) ? data.workerChanges.removed : [],
        updated: Array.isArray(data.workerChanges?.updated) ? data.workerChanges.updated : [],
    },
    summaryLines: Array.isArray(data.summaryLines) ? data.summaryLines.map(String) : [],
    summaryText: String(data.summaryText || ''),
    changeCount: Number(data.changeCount || 0),
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt : Timestamp.now(),
    createdAtIso: String(data.createdAtIso || ''),
});

export const dailyReportLogService = {
    collectionName: COLLECTION_NAME,
    actionLabels: ACTION_LABELS,
    buildChangeSet: buildDailyReportChangeSet,

    createLog: async (input: CreateDailyReportLogInput): Promise<DailyReportLog> => {
        const before = snapshotReport(input.before);
        const after = snapshotReport(input.after);
        const anchor = after || before;
        const changeSet = buildDailyReportChangeSet(input.action, before, after);
        const now = Timestamp.now();
        const logRef = doc(collection(db, COLLECTION_NAME));

        const log: DailyReportLog = {
            id: logRef.id,
            action: input.action,
            actionLabel: ACTION_LABELS[input.action],
            reportId: getReportId(anchor) || logRef.id,
            reportDate: String(anchor?.date || ''),
            siteId: anchor?.siteId || undefined,
            siteName: asText(anchor?.siteName || anchor?.siteId, '현장 미지정'),
            teamId: anchor?.teamId || undefined,
            teamName: asText(anchor?.teamName || anchor?.responsibleTeamName || anchor?.teamId, '팀 미지정'),
            actor: resolveActor(),
            source: input.source || 'dailyReportService',
            before,
            after,
            fieldChanges: changeSet.fieldChanges,
            workerChanges: changeSet.workerChanges,
            summaryLines: changeSet.summaryLines,
            summaryText: changeSet.summaryLines.join('\n'),
            changeCount: changeSet.changeCount,
            createdAt: now,
            createdAtIso: now.toDate().toISOString(),
        };

        await setDoc(logRef, stripUndefined(log) as Record<string, unknown>);
        return log;
    },

    subscribeRecentLogs: (
        callback: (logs: DailyReportLog[]) => void,
        limitCount = 300,
        onError?: (error: Error) => void
    ): Unsubscribe => {
        const logsQuery = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'), limit(limitCount));
        return onSnapshot(
            logsQuery,
            (snapshot) => callback(snapshot.docs.map((docSnap) => normalizeLog(docSnap.id, docSnap.data()))),
            (error) => {
                console.error('[dailyReportLogService] subscribe failed:', error);
                onError?.(error);
            }
        );
    },

    getRecentLogs: async (limitCount = 300): Promise<DailyReportLog[]> => {
        const logsQuery = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'), limit(limitCount));
        const snapshot = await getDocs(logsQuery);
        return snapshot.docs.map((docSnap) => normalizeLog(docSnap.id, docSnap.data()));
    },
};
