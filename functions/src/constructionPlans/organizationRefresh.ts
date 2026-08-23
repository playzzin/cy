import * as functions from 'firebase-functions/v1';
import {
    buildConstructionPlanWorkerDirectoryBinding,
    canonicalStringify,
    isUnknownRecord,
    projectSafeWorkerDirectoryEntry,
    readTrimmedString,
    sanitizeConstructionPlanOrganizationSnapshot,
    sha256Hex,
    type SafeWorkerDirectoryEntry,
    type UnknownRecord,
} from './domain';

const MAX_DIRECTORY_WORKERS = 500;
const ASSIGNMENT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/;

export type ConstructionPlanOrganizationRefreshSelection = {
    refreshAssignedWorkers: boolean;
    refreshAdditionalWorkers: boolean;
    reassignments: Array<{ assignmentId: string; workerId: string }>;
};

export type ConstructionPlanOrganizationWorkerChangeKind =
    | 'new'
    | 'inactive'
    | 'missing'
    | 'team_changed'
    | 'profile_changed';

export type ConstructionPlanOrganizationWorkerChange = {
    id: string;
    kind: ConstructionPlanOrganizationWorkerChangeKind;
    workerId: string;
    before?: SafeWorkerDirectoryEntry;
    after?: SafeWorkerDirectoryEntry;
    assignmentIds: string[];
};

export type ConstructionPlanOrganizationAssignmentIssue = {
    assignmentId: string;
    role: string;
    required: boolean;
    kind: 'inactive' | 'missing' | 'unassigned_required';
    worker?: SafeWorkerDirectoryEntry;
};

export type ConstructionPlanOrganizationRefreshComparison = {
    current: UnknownRecord;
    latestWorkers: SafeWorkerDirectoryEntry[];
    changes: ConstructionPlanOrganizationWorkerChange[];
    assignmentIssues: ConstructionPlanOrganizationAssignmentIssue[];
    suggestedAdditionalWorkers: SafeWorkerDirectoryEntry[];
    additionalWorkersChanged: boolean;
    changed: boolean;
};

export type ConstructionPlanOrganizationRefreshProjection = {
    organizationSnapshot: UnknownRecord;
    appliedChangeIds: string[];
    remainingChangeIds: string[];
    beforeHash: string;
    afterHash: string;
};

const isoDateTime = (value: unknown): string | undefined => {
    if (typeof value !== 'string' || !value.trim() || !Number.isFinite(Date.parse(value))) return undefined;
    return new Date(value).toISOString();
};

const safeWorkerEqual = (left: SafeWorkerDirectoryEntry, right: SafeWorkerDirectoryEntry): boolean =>
    canonicalStringify(left as unknown as UnknownRecord) === canonicalStringify(right as unknown as UnknownRecord);

const assignmentsOf = (organization: UnknownRecord): UnknownRecord[] =>
    Array.isArray(organization.assignments)
        ? organization.assignments.filter(isUnknownRecord)
        : [];

const additionalWorkersOf = (organization: UnknownRecord): SafeWorkerDirectoryEntry[] =>
    Array.isArray(organization.additionalWorkers)
        ? organization.additionalWorkers
            .map((worker) => projectSafeWorkerDirectoryEntry(worker))
            .filter((worker): worker is SafeWorkerDirectoryEntry => Boolean(worker))
        : [];

const assignedWorkers = (organization: UnknownRecord): Array<{
    assignmentId: string;
    role: string;
    required: boolean;
    worker?: SafeWorkerDirectoryEntry;
}> => assignmentsOf(organization).map((assignment) => ({
    assignmentId: readTrimmedString(assignment, ['id']) || '',
    role: readTrimmedString(assignment, ['role']) || '',
    required: assignment.required === true,
    worker: projectSafeWorkerDirectoryEntry(assignment.worker),
}));

export const projectConstructionPlanOrganizationRefreshSnapshot = (
    raw: unknown,
    siteId: string,
): UnknownRecord => {
    if (!isUnknownRecord(raw)
        || !Array.isArray(raw.assignments)
        || !Array.isArray(raw.additionalWorkers)) {
        throw new functions.https.HttpsError(
            'data-loss',
            '현재 계획서의 조직 스냅샷이 손상되어 작업자 변경을 자동 처리하지 않습니다.',
        );
    }
    const capturedAt = isoDateTime(raw.capturedAt);
    const sourceSiteId = readTrimmedString(raw, ['sourceSiteId']);
    if (!capturedAt || (sourceSiteId && sourceSiteId !== siteId)) {
        throw new functions.https.HttpsError(
            'data-loss',
            '현재 계획서의 조직 출처 결합이 손상되어 작업자 변경을 자동 처리하지 않습니다.',
        );
    }
    try {
        return sanitizeConstructionPlanOrganizationSnapshot(raw, capturedAt, siteId, true);
    } catch {
        throw new functions.https.HttpsError(
            'data-loss',
            '현재 계획서의 조직·작업자 스냅샷을 안전하게 투영할 수 없습니다.',
        );
    }
};

/** Fixed worker allowlist. Raw HR/contact/payroll fields never cross this boundary. */
export const projectConstructionPlanOrganizationWorkerDirectory = (
    rawWorkers: readonly unknown[],
    prioritizedWorkerIds: ReadonlySet<string> = new Set(),
): SafeWorkerDirectoryEntry[] => {
    const workers = new Map<string, SafeWorkerDirectoryEntry>();
    rawWorkers.forEach((raw) => {
        const projected = projectSafeWorkerDirectoryEntry(raw);
        if (!projected || workers.has(projected.id)) return;
        workers.set(projected.id, projected);
    });
    const selected = Array.from(workers.values())
        .sort((left, right) => {
            const priority = Number(prioritizedWorkerIds.has(right.id)) - Number(prioritizedWorkerIds.has(left.id));
            return priority || left.name.localeCompare(right.name, 'ko-KR') || left.id.localeCompare(right.id);
        })
        .slice(0, MAX_DIRECTORY_WORKERS);
    return buildConstructionPlanWorkerDirectoryBinding(selected, false).workers;
};

const workerDirectoryMap = (
    latestWorkers: readonly SafeWorkerDirectoryEntry[],
): Map<string, SafeWorkerDirectoryEntry> => new Map(
    projectConstructionPlanOrganizationWorkerDirectory(latestWorkers)
        .map((worker) => [worker.id, worker]),
);

const currentWorkerState = (organization: UnknownRecord): Map<string, SafeWorkerDirectoryEntry> => {
    const result = new Map<string, SafeWorkerDirectoryEntry>();
    assignedWorkers(organization).forEach(({ worker }) => {
        if (worker && !result.has(worker.id)) result.set(worker.id, worker);
    });
    additionalWorkersOf(organization).forEach((worker) => {
        if (!result.has(worker.id)) result.set(worker.id, worker);
    });
    return result;
};

const currentAssignmentIdsByWorker = (organization: UnknownRecord): Map<string, string[]> => {
    const result = new Map<string, string[]>();
    assignedWorkers(organization).forEach(({ assignmentId, worker }) => {
        if (!worker) return;
        result.set(worker.id, [...(result.get(worker.id) ?? []), assignmentId]);
    });
    return result;
};

const compareWorkerArrays = (
    left: readonly SafeWorkerDirectoryEntry[],
    right: readonly SafeWorkerDirectoryEntry[],
): boolean => canonicalStringify(left as unknown as UnknownRecord[])
    === canonicalStringify(right as unknown as UnknownRecord[]);

export const compareConstructionPlanOrganizationRefresh = (input: {
    current: unknown;
    siteId: string;
    latestWorkers: readonly SafeWorkerDirectoryEntry[];
}): ConstructionPlanOrganizationRefreshComparison => {
    const current = projectConstructionPlanOrganizationRefreshSnapshot(input.current, input.siteId);
    const directory = workerDirectoryMap(input.latestWorkers);
    const latestWorkers = Array.from(directory.values());
    const currentWorkers = currentWorkerState(current);
    const assignmentIdsByWorker = currentAssignmentIdsByWorker(current);
    const changes: ConstructionPlanOrganizationWorkerChange[] = [];

    latestWorkers.forEach((after) => {
        const before = currentWorkers.get(after.id);
        if (!before) {
            if (after.status === 'active') {
                changes.push({
                    id: `worker.${after.id}.new`,
                    kind: 'new',
                    workerId: after.id,
                    after,
                    assignmentIds: [],
                });
            }
            return;
        }
        const assignmentIds = assignmentIdsByWorker.get(after.id) ?? [];
        if (after.status !== 'active') {
            changes.push({
                id: `worker.${after.id}.inactive`,
                kind: 'inactive',
                workerId: after.id,
                before,
                after,
                assignmentIds,
            });
            return;
        }
        if ((before.teamId ?? '') !== (after.teamId ?? '')
            || (before.teamName ?? '') !== (after.teamName ?? '')) {
            changes.push({
                id: `worker.${after.id}.team_changed`,
                kind: 'team_changed',
                workerId: after.id,
                before,
                after,
                assignmentIds,
            });
            return;
        }
        if (!safeWorkerEqual(before, after)) {
            changes.push({
                id: `worker.${after.id}.profile_changed`,
                kind: 'profile_changed',
                workerId: after.id,
                before,
                after,
                assignmentIds,
            });
        }
    });

    currentWorkers.forEach((before, workerId) => {
        if (directory.has(workerId)) return;
        changes.push({
            id: `worker.${workerId}.missing`,
            kind: 'missing',
            workerId,
            before,
            assignmentIds: assignmentIdsByWorker.get(workerId) ?? [],
        });
    });

    const assignmentIssues: ConstructionPlanOrganizationAssignmentIssue[] = [];
    assignedWorkers(current).forEach((assignment) => {
        if (!assignment.worker) {
            if (assignment.required) assignmentIssues.push({
                assignmentId: assignment.assignmentId,
                role: assignment.role,
                required: true,
                kind: 'unassigned_required',
            });
            return;
        }
        const latest = directory.get(assignment.worker.id);
        if (!latest) {
            assignmentIssues.push({
                assignmentId: assignment.assignmentId,
                role: assignment.role,
                required: assignment.required,
                kind: 'missing',
                worker: assignment.worker,
            });
        } else if (latest.status !== 'active') {
            assignmentIssues.push({
                assignmentId: assignment.assignmentId,
                role: assignment.role,
                required: assignment.required,
                kind: 'inactive',
                worker: latest,
            });
        }
    });

    const assignedIds = new Set(assignedWorkers(current)
        .flatMap(({ worker }) => worker ? [worker.id] : []));
    const suggestedAdditionalWorkers = latestWorkers
        .filter((worker) => worker.status === 'active' && !assignedIds.has(worker.id));
    const additionalWorkersChanged = !compareWorkerArrays(
        additionalWorkersOf(current),
        suggestedAdditionalWorkers,
    );
    changes.sort((left, right) => left.id.localeCompare(right.id));

    return {
        current,
        latestWorkers,
        changes,
        assignmentIssues,
        suggestedAdditionalWorkers,
        additionalWorkersChanged,
        changed: changes.length > 0 || additionalWorkersChanged || assignmentIssues.length > 0,
    };
};

export const parseConstructionPlanOrganizationRefreshSelection = (
    raw: unknown,
): ConstructionPlanOrganizationRefreshSelection | undefined => {
    if (raw === undefined || raw === null) return undefined;
    if (!isUnknownRecord(raw)
        || Object.keys(raw).some((key) => ![
            'refreshAssignedWorkers', 'refreshAdditionalWorkers', 'reassignments',
        ].includes(key))
        || typeof raw.refreshAssignedWorkers !== 'boolean'
        || typeof raw.refreshAdditionalWorkers !== 'boolean'
        || !Array.isArray(raw.reassignments)
        || raw.reassignments.length > 50) {
        throw new functions.https.HttpsError('invalid-argument', '조직·작업자 반영 선택이 올바르지 않습니다.');
    }
    const seenAssignments = new Set<string>();
    const reassignments = raw.reassignments.map((value) => {
        if (!isUnknownRecord(value)
            || Object.keys(value).some((key) => !['assignmentId', 'workerId'].includes(key))) {
            throw new functions.https.HttpsError('invalid-argument', '작업자 재배정 요청이 올바르지 않습니다.');
        }
        const assignmentId = readTrimmedString(value, ['assignmentId']);
        const workerId = readTrimmedString(value, ['workerId']);
        if (!assignmentId || !workerId
            || !ASSIGNMENT_ID_PATTERN.test(assignmentId)
            || !ASSIGNMENT_ID_PATTERN.test(workerId)
            || seenAssignments.has(assignmentId)) {
            throw new functions.https.HttpsError('invalid-argument', '작업자 재배정 식별자가 올바르지 않습니다.');
        }
        seenAssignments.add(assignmentId);
        return { assignmentId, workerId };
    });
    if (!raw.refreshAssignedWorkers && !raw.refreshAdditionalWorkers && reassignments.length === 0) {
        throw new functions.https.HttpsError('invalid-argument', '반영할 조직·작업자 변경을 선택하세요.');
    }
    return {
        refreshAssignedWorkers: raw.refreshAssignedWorkers,
        refreshAdditionalWorkers: raw.refreshAdditionalWorkers,
        reassignments,
    };
};

export const applyConstructionPlanOrganizationRefreshProjection = (input: {
    current: unknown;
    siteId: string;
    responsibleTeamId?: string;
    latestWorkers: readonly SafeWorkerDirectoryEntry[];
    selection: ConstructionPlanOrganizationRefreshSelection;
    actorId: string;
    capturedAt: string;
    reason: string;
    auditEventId: string;
}): ConstructionPlanOrganizationRefreshProjection => {
    const comparison = compareConstructionPlanOrganizationRefresh({
        current: input.current,
        siteId: input.siteId,
        latestWorkers: input.latestWorkers,
    });
    const directory = workerDirectoryMap(comparison.latestWorkers);
    const reassignments = new Map(input.selection.reassignments
        .map(({ assignmentId, workerId }) => [assignmentId, workerId]));
    const currentAssignments = assignmentsOf(comparison.current);
    const hasEffectiveReassignment = input.selection.reassignments.some(({ assignmentId, workerId }) => {
        const assignment = currentAssignments.find((candidate) => readTrimmedString(candidate, ['id']) === assignmentId);
        const currentWorker = assignment ? projectSafeWorkerDirectoryEntry(assignment.worker) : undefined;
        return !currentWorker || currentWorker.id !== workerId;
    });
    const hasAssignedWorkerRefresh = input.selection.refreshAssignedWorkers && currentAssignments.some((assignment) => {
        const currentWorker = projectSafeWorkerDirectoryEntry(assignment.worker);
        const latestWorker = currentWorker ? directory.get(currentWorker.id) : undefined;
        return Boolean(currentWorker && latestWorker?.status === 'active' && !safeWorkerEqual(currentWorker, latestWorker));
    });
    if (!hasEffectiveReassignment
        && !hasAssignedWorkerRefresh
        && !(input.selection.refreshAdditionalWorkers && comparison.additionalWorkersChanged)) {
        throw new functions.https.HttpsError(
            'failed-precondition',
            '선택한 조직·작업자 항목이 더 이상 최신 원천과 다르지 않습니다. 다시 비교하세요.',
        );
    }
    const assignments = currentAssignments.map((currentAssignment) => {
        const assignment = { ...currentAssignment };
        const assignmentId = readTrimmedString(assignment, ['id']) || '';
        const reassignedWorkerId = reassignments.get(assignmentId);
        if (reassignedWorkerId) {
            const worker = directory.get(reassignedWorkerId);
            if (!worker || worker.status !== 'active') {
                throw new functions.https.HttpsError(
                    'failed-precondition',
                    '재배정할 작업자가 최신 현장·담당팀의 활성 작업자가 아닙니다. 다시 비교하세요.',
                );
            }
            assignment.worker = worker as unknown as UnknownRecord;
            assignment.externalAssignment = Boolean(worker.siteId && worker.siteId !== input.siteId);
            // An exception reason is evidence for the previous worker/role
            // pairing and must never be silently transferred on reassignment.
            delete assignment.exceptionReason;
            reassignments.delete(assignmentId);
            return assignment;
        }
        if (input.selection.refreshAssignedWorkers) {
            const currentWorker = projectSafeWorkerDirectoryEntry(assignment.worker);
            const latestWorker = currentWorker ? directory.get(currentWorker.id) : undefined;
            // Missing/inactive workers are deliberately preserved until the
            // user explicitly chooses a replacement. They must never vanish
            // as a side effect of refreshing another worker.
            if (latestWorker?.status === 'active') {
                assignment.worker = latestWorker as unknown as UnknownRecord;
                if (latestWorker.siteId && latestWorker.siteId !== input.siteId) {
                    assignment.externalAssignment = true;
                }
            }
        }
        return assignment;
    });
    if (reassignments.size > 0) {
        throw new functions.https.HttpsError(
            'failed-precondition',
            '재배정 대상 역할이 더 이상 현재 조직도에 없습니다. 다시 비교하세요.',
        );
    }

    const assignedIds = new Set(assignments.flatMap((assignment) => {
        const worker = projectSafeWorkerDirectoryEntry(assignment.worker);
        return worker ? [worker.id] : [];
    }));
    const additionalWorkers = input.selection.refreshAdditionalWorkers
        ? comparison.latestWorkers.filter((worker) => worker.status === 'active' && !assignedIds.has(worker.id))
        : additionalWorkersOf(comparison.current).filter((worker) => !assignedIds.has(worker.id));
    const finalDirectory = buildConstructionPlanWorkerDirectoryBinding([
        ...assignments.flatMap((assignment) => {
            const worker = projectSafeWorkerDirectoryEntry(assignment.worker);
            return worker ? [worker] : [];
        }),
        ...additionalWorkers,
    ]);
    const latestDirectory = workerDirectoryMap(comparison.latestWorkers);
    finalDirectory.workers.forEach((worker) => {
        const latest = latestDirectory.get(worker.id);
        if (!latest || latest.status !== 'active' || !safeWorkerEqual(worker, latest)) {
            throw new functions.https.HttpsError(
                'failed-precondition',
                '선택하지 않은 조직 작업자에 누락·비활성·프로필 변경이 남아 있습니다. 관련 변경을 함께 반영하세요.',
            );
        }
    });
    const organizationSnapshot = sanitizeConstructionPlanOrganizationSnapshot({
        capturedAt: input.capturedAt,
        sourceSiteId: input.siteId,
        assignments,
        additionalWorkers,
        workerDirectoryProvenance: {
            captureKind: 'refresh',
            sourceSiteId: input.siteId,
            ...(input.responsibleTeamId ? { sourceTeamId: input.responsibleTeamId } : {}),
            capturedAt: input.capturedAt,
            sourceMasterHash: finalDirectory.sourceMasterHash,
            sourceWorkerIds: finalDirectory.sourceWorkerIds,
            appliedBy: input.actorId,
            appliedAt: input.capturedAt,
            changeReason: input.reason,
            auditEventId: input.auditEventId,
        },
    }, input.capturedAt, input.siteId, true);
    const remaining = compareConstructionPlanOrganizationRefresh({
        current: organizationSnapshot,
        siteId: input.siteId,
        latestWorkers: comparison.latestWorkers,
    });
    const appliedChangeIds = [
        ...(input.selection.refreshAssignedWorkers ? ['organization.assignments'] : []),
        ...(input.selection.refreshAdditionalWorkers ? ['organization.additionalWorkers'] : []),
        ...input.selection.reassignments.map(({ assignmentId }) => `organization.assignment.${assignmentId}`),
    ].sort();
    const beforeHash = sha256Hex(canonicalStringify(comparison.current));
    const afterHash = sha256Hex(canonicalStringify(organizationSnapshot));
    if (beforeHash === afterHash) {
        throw new functions.https.HttpsError(
            'failed-precondition',
            '선택한 조직·작업자 항목이 더 이상 최신 원천과 다르지 않습니다. 다시 비교하세요.',
        );
    }
    return {
        organizationSnapshot,
        appliedChangeIds,
        remainingChangeIds: [
            ...remaining.changes.map((change) => change.id),
            ...(remaining.additionalWorkersChanged ? ['organization.additionalWorkers'] : []),
            ...remaining.assignmentIssues.map((issue) => `organization.assignment.${issue.assignmentId}.${issue.kind}`),
        ].sort(),
        beforeHash,
        afterHash,
    };
};
