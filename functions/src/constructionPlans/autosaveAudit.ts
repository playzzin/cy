import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';
import {
    canonicalStringify,
    isUnknownRecord,
    readTrimmedString,
    sha256Hex,
    type UnknownRecord,
} from './domain';

const PLANS_COLLECTION = 'constructionPlans';
const AUDIT_COLLECTION = 'constructionPlanAuditEvents';
const USERS_COLLECTION = 'users';
const MAX_TRANSACTION_EVENTS = 400;
export const MAX_CONSTRUCTION_PLAN_AUTOSAVE_AUDIT_EVENTS = 2_000;
const MAX_REQUEST_ID_LENGTH = 500;
const MAX_ACTOR_NAME_LENGTH = 120;
const SAFE_IDENTIFIER = /^[A-Za-z0-9가-힣][A-Za-z0-9가-힣._:-]{0,199}$/u;

export type ConstructionPlanAutosaveAuditEntity =
    | 'standard_text'
    | 'organization_role'
    | 'drawing_metadata_status'
    | 'drawing_annotation';

export type ConstructionPlanAutosaveAuditAction =
    | 'standard_text_changed'
    | 'organization_role_created'
    | 'organization_role_changed'
    | 'organization_role_deleted'
    | 'drawing_metadata_status_changed'
    | 'drawing_annotation_created'
    | 'drawing_annotation_changed'
    | 'drawing_annotation_deleted';

export interface ConstructionPlanAutosaveAuditDiff {
    action: ConstructionPlanAutosaveAuditAction;
    entity: ConstructionPlanAutosaveAuditEntity;
    targetId: string;
    targetIds: Readonly<Record<string, string>>;
    beforeHash: string;
    afterHash: string;
    summary: string;
    reason: string;
}

export interface ConstructionPlanAutosaveAuditEvent extends ConstructionPlanAutosaveAuditDiff {
    id: string;
    schemaVersion: 1;
    type: 'construction_plan_autosave_change';
    requestId: string;
    planId: string;
    siteId?: string;
    actorId: string;
    actorName: string;
    timestamp: string;
    createdAt: string;
    source: 'construction_plan_on_update';
    eventFingerprint: string;
}

interface AuditEventContext {
    requestId: string;
    planId: string;
    siteId?: string;
    actorId: string;
    actorName: string;
    timestamp: string;
}

const hashProjection = (value: unknown): string => sha256Hex(canonicalStringify(value));

const safeIdentifier = (value: unknown, fallbackScope: string): string => {
    const raw = typeof value === 'string' ? value.trim() : '';
    if (raw && SAFE_IDENTIFIER.test(raw) && !raw.includes('@')) return raw;
    return `${fallbackScope}-${sha256Hex(raw || fallbackScope).slice(0, 20)}`;
};

const boundedRequestId = (value: unknown): string => {
    const raw = typeof value === 'string' ? value.trim() : '';
    if (!raw) return `event-${sha256Hex('missing-request-id').slice(0, 24)}`;
    if (raw.length <= MAX_REQUEST_ID_LENGTH) return raw;
    return `${raw.slice(0, MAX_REQUEST_ID_LENGTH - 25)}-${sha256Hex(raw).slice(0, 24)}`;
};

const boundedActorName = (value: unknown): string => {
    const raw = typeof value === 'string' ? value.trim().replace(/[\u0000-\u001f\u007f]/g, '') : '';
    if (!raw || raw.includes('@') || /https?:\/\//i.test(raw)) return '사용자 이름 미확인';
    return raw.slice(0, MAX_ACTOR_NAME_LENGTH);
};

export const sanitizeConstructionPlanAutosaveAuditReason = (
    value: unknown,
    fallback: string,
): string => {
    const raw = typeof value === 'string' ? value : '';
    const sanitized = raw
        .replace(/[\u0000-\u001f\u007f]/g, ' ')
        .replace(/(?:https?|ftp):\/\/\S+|gs:\/\/\S+/gi, '[링크 제거]')
        .replace(/\b[^\s@]+@[^\s@]+\.[^\s@]+\b/gi, '[이메일 제거]')
        .replace(/\b0\d{1,2}[-\s]?\d{3,4}[-\s]?\d{4}\b/g, '[연락처 제거]')
        .replace(/\b\d{6}[-\s]?\d{7}\b/g, '[식별번호 제거]')
        .replace(/\b\d{3}[-\s]?\d{2}[-\s]?\d{5}\b/g, '[등록번호 제거]')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 500);
    return sanitized || fallback;
};

const asRecordArray = (value: unknown): UnknownRecord[] => (
    Array.isArray(value) ? value.filter(isUnknownRecord) : []
);

const keyedRecords = (
    value: unknown,
    keyOf: (entry: UnknownRecord, index: number) => string,
): Map<string, UnknownRecord> => {
    const result = new Map<string, UnknownRecord>();
    asRecordArray(value).forEach((entry, index) => {
        const key = keyOf(entry, index);
        if (!result.has(key)) result.set(key, entry);
    });
    return result;
};

const allSortedKeys = (...maps: ReadonlyMap<string, unknown>[]): string[] => (
    Array.from(new Set(maps.flatMap((map) => Array.from(map.keys())))).sort((left, right) => (
        left.localeCompare(right, 'en')
    ))
);

const standardTextProjection = (section: UnknownRecord | undefined): unknown => {
    if (!section) return null;
    const content = isUnknownRecord(section.content) ? section.content : {};
    const hasBoundStandardText = content.standardTextVersion !== undefined
        || content.standardTextCurrent !== undefined
        || section.standardTextModified === true
        || section.standardTextModificationReason !== undefined;
    if (!hasBoundStandardText) return null;
    return {
        standardTextModified: section.standardTextModified === true,
        standardTextModificationReason: section.standardTextModificationReason ?? null,
        standardTextVersion: content.standardTextVersion ?? null,
        standardTextCurrent: content.standardTextCurrent ?? null,
    };
};

const workerProjection = (raw: unknown): unknown => {
    if (!isUnknownRecord(raw)) return null;
    return {
        id: raw.id ?? null,
        name: raw.name ?? null,
        role: raw.role ?? null,
        position: raw.position ?? null,
        teamId: raw.teamId ?? null,
        teamName: raw.teamName ?? null,
        status: raw.status ?? null,
    };
};

const organizationRoleProjection = (assignment: UnknownRecord | undefined): unknown => {
    if (!assignment) return null;
    return {
        id: assignment.id ?? null,
        role: assignment.role ?? null,
        label: assignment.label ?? null,
        required: assignment.required === true,
        responsibilities: Array.isArray(assignment.responsibilities) ? assignment.responsibilities : [],
        order: assignment.order ?? null,
        worker: workerProjection(assignment.worker),
    };
};

const drawingStatusProjection = (drawing: UnknownRecord | undefined): unknown => {
    if (!drawing) return null;
    return {
        approvalStatus: drawing.approvalStatus ?? null,
        approvalReference: drawing.approvalReference ?? null,
        previewStatus: drawing.previewStatus ?? null,
        previewErrorCode: drawing.previewErrorCode ?? null,
    };
};

const annotationProjection = (annotation: UnknownRecord | undefined): unknown => {
    if (!annotation) return null;
    return {
        id: annotation.id ?? null,
        pageIndex: annotation.pageIndex ?? null,
        pageFingerprint: annotation.pageFingerprint ?? null,
        layer: annotation.layer ?? null,
        geometry: annotation.geometry ?? null,
        style: annotation.style ?? null,
        label: annotation.label ?? null,
        zoneCode: annotation.zoneCode ?? null,
        sequence: annotation.sequence ?? null,
        startDate: annotation.startDate ?? null,
        endDate: annotation.endDate ?? null,
        reason: annotation.reason ?? null,
        releaseCondition: annotation.releaseCondition ?? null,
        equipmentType: annotation.equipmentType ?? null,
        equipmentId: annotation.equipmentId ?? null,
        entrance: annotation.entrance ?? null,
        destination: annotation.destination ?? null,
        radius: annotation.radius ?? null,
        responsibleWorkerId: annotation.responsibleWorkerId ?? null,
        responsibleRole: annotation.responsibleRole ?? null,
        materialType: annotation.materialType ?? null,
        styleVersion: annotation.styleVersion ?? null,
        locked: annotation.locked === true,
    };
};

const changed = (before: unknown, after: unknown): { beforeHash: string; afterHash: string } | null => {
    const beforeHash = hashProjection(before);
    const afterHash = hashProjection(after);
    return beforeHash === afterHash ? null : { beforeHash, afterHash };
};

const standardTextDiffs = (before: UnknownRecord, after: UnknownRecord): ConstructionPlanAutosaveAuditDiff[] => {
    const beforeSections = keyedRecords(before.sections, (entry, index) => safeIdentifier(
        readTrimmedString(entry, ['key']) || readTrimmedString(entry, ['id']),
        `section-${index}`,
    ));
    const afterSections = keyedRecords(after.sections, (entry, index) => safeIdentifier(
        readTrimmedString(entry, ['key']) || readTrimmedString(entry, ['id']),
        `section-${index}`,
    ));
    return allSortedKeys(beforeSections, afterSections).flatMap((sectionKey) => {
        const hashes = changed(
            standardTextProjection(beforeSections.get(sectionKey)),
            standardTextProjection(afterSections.get(sectionKey)),
        );
        if (!hashes) return [];
        return [{
            action: 'standard_text_changed' as const,
            entity: 'standard_text' as const,
            targetId: `section:${sectionKey}`,
            targetIds: { sectionId: sectionKey },
            ...hashes,
            summary: '표준 시공문구 또는 변경 근거가 수정되었습니다.',
            reason: sanitizeConstructionPlanAutosaveAuditReason(
                afterSections.get(sectionKey)?.standardTextModificationReason,
                '표준 시공문구 변경을 자동저장 감사에서 감지했습니다.',
            ),
        }];
    });
};

const organizationRoleDiffs = (before: UnknownRecord, after: UnknownRecord): ConstructionPlanAutosaveAuditDiff[] => {
    const beforeOrganization = isUnknownRecord(before.organizationSnapshot) ? before.organizationSnapshot : {};
    const afterOrganization = isUnknownRecord(after.organizationSnapshot) ? after.organizationSnapshot : {};
    const roleKey = (entry: UnknownRecord, index: number): string => safeIdentifier(
        readTrimmedString(entry, ['id']) || readTrimmedString(entry, ['role']),
        `role-${index}`,
    );
    const beforeRoles = keyedRecords(beforeOrganization.assignments, roleKey);
    const afterRoles = keyedRecords(afterOrganization.assignments, roleKey);
    return allSortedKeys(beforeRoles, afterRoles).flatMap((roleId) => {
        const beforeRole = beforeRoles.get(roleId);
        const afterRole = afterRoles.get(roleId);
        const hashes = changed(
            organizationRoleProjection(beforeRole),
            organizationRoleProjection(afterRole),
        );
        if (!hashes) return [];
        const action: ConstructionPlanAutosaveAuditAction = !beforeRole
            ? 'organization_role_created'
            : !afterRole ? 'organization_role_deleted' : 'organization_role_changed';
        return [{
            action,
            entity: 'organization_role' as const,
            targetId: `organization-role:${roleId}`,
            targetIds: { roleAssignmentId: roleId },
            ...hashes,
            summary: action === 'organization_role_created'
                ? '현장 조직 역할이 추가되었습니다.'
                : action === 'organization_role_deleted'
                    ? '현장 조직 역할이 삭제되었습니다.'
                    : '현장 조직 역할 또는 작업자 배정이 수정되었습니다.',
            reason: '현장 조직 역할 변경을 자동저장 감사에서 감지했습니다.',
        }];
    });
};

const drawingDiffs = (before: UnknownRecord, after: UnknownRecord): ConstructionPlanAutosaveAuditDiff[] => {
    const drawingKey = (entry: UnknownRecord, index: number): string => safeIdentifier(
        readTrimmedString(entry, ['id']),
        `drawing-${index}`,
    );
    const beforeDrawings = keyedRecords(before.drawings, drawingKey);
    const afterDrawings = keyedRecords(after.drawings, drawingKey);
    const result: ConstructionPlanAutosaveAuditDiff[] = [];
    allSortedKeys(beforeDrawings, afterDrawings).forEach((drawingId) => {
        const beforeDrawing = beforeDrawings.get(drawingId);
        const afterDrawing = afterDrawings.get(drawingId);
        if (beforeDrawing && afterDrawing) {
            const hashes = changed(
                drawingStatusProjection(beforeDrawing),
                drawingStatusProjection(afterDrawing),
            );
            if (hashes) result.push({
                action: 'drawing_metadata_status_changed',
                entity: 'drawing_metadata_status',
                targetId: `drawing:${drawingId}`,
                targetIds: { drawingId },
                ...hashes,
                summary: '도면 검토 또는 미리보기 상태 메타데이터가 수정되었습니다.',
                reason: '도면 상태 메타데이터 변경을 자동저장 감사에서 감지했습니다.',
            });
        }

        const annotationKey = (entry: UnknownRecord, index: number): string => safeIdentifier(
            readTrimmedString(entry, ['id']),
            `annotation-${index}`,
        );
        const beforeAnnotations = keyedRecords(beforeDrawing?.annotations, annotationKey);
        const afterAnnotations = keyedRecords(afterDrawing?.annotations, annotationKey);
        allSortedKeys(beforeAnnotations, afterAnnotations).forEach((annotationId) => {
            const beforeAnnotation = beforeAnnotations.get(annotationId);
            const afterAnnotation = afterAnnotations.get(annotationId);
            const hashes = changed(
                annotationProjection(beforeAnnotation),
                annotationProjection(afterAnnotation),
            );
            if (!hashes) return;
            const action: ConstructionPlanAutosaveAuditAction = !beforeAnnotation
                ? 'drawing_annotation_created'
                : !afterAnnotation ? 'drawing_annotation_deleted' : 'drawing_annotation_changed';
            result.push({
                action,
                entity: 'drawing_annotation',
                targetId: `drawing:${drawingId}:annotation:${annotationId}`,
                targetIds: { drawingId, annotationId },
                ...hashes,
                summary: action === 'drawing_annotation_created'
                    ? '도면 좌표 주석이 추가되었습니다.'
                    : action === 'drawing_annotation_deleted'
                        ? '도면 좌표 주석이 삭제되었습니다.'
                        : '도면 좌표 주석이 수정되었습니다.',
                reason: sanitizeConstructionPlanAutosaveAuditReason(
                    afterAnnotation?.reason ?? beforeAnnotation?.reason,
                    '도면 좌표 주석 변경을 자동저장 감사에서 감지했습니다.',
                ),
            });
        });
    });
    return result;
};

/**
 * Emits only business-relevant autosave changes. Volatile lock/version/time
 * fields and annotation audit timestamps are deliberately outside every hash.
 */
export const diffConstructionPlanAutosaveAudit = (
    beforeValue: unknown,
    afterValue: unknown,
): ConstructionPlanAutosaveAuditDiff[] => {
    const before = isUnknownRecord(beforeValue) ? beforeValue : {};
    const after = isUnknownRecord(afterValue) ? afterValue : {};
    const diffs = [
        ...standardTextDiffs(before, after),
        ...organizationRoleDiffs(before, after),
        ...drawingDiffs(before, after),
    ];
    if (diffs.length > MAX_CONSTRUCTION_PLAN_AUTOSAVE_AUDIT_EVENTS) {
        throw new Error('construction-plan-autosave-audit-event-limit-exceeded');
    }
    return diffs;
};

const deterministicEventId = (
    context: AuditEventContext,
    diff: ConstructionPlanAutosaveAuditDiff,
): string => `cpa-${sha256Hex(canonicalStringify({
    requestId: context.requestId,
    planId: context.planId,
    action: diff.action,
    entity: diff.entity,
    targetId: diff.targetId,
})).slice(0, 48)}`;

export const buildConstructionPlanAutosaveAuditEvents = (
    rawContext: AuditEventContext,
    diffs: readonly ConstructionPlanAutosaveAuditDiff[],
): ConstructionPlanAutosaveAuditEvent[] => {
    const context: AuditEventContext = {
        requestId: boundedRequestId(rawContext.requestId),
        planId: safeIdentifier(rawContext.planId, 'plan'),
        ...(rawContext.siteId ? { siteId: safeIdentifier(rawContext.siteId, 'site') } : {}),
        actorId: safeIdentifier(rawContext.actorId, 'actor'),
        actorName: boundedActorName(rawContext.actorName),
        timestamp: new Date(rawContext.timestamp).toISOString(),
    };
    return diffs.map((diff) => {
        const id = deterministicEventId(context, diff);
        const eventWithoutFingerprint = {
            id,
            schemaVersion: 1 as const,
            type: 'construction_plan_autosave_change' as const,
            requestId: context.requestId,
            planId: context.planId,
            ...(context.siteId ? { siteId: context.siteId } : {}),
            actorId: context.actorId,
            actorName: context.actorName,
            timestamp: context.timestamp,
            createdAt: context.timestamp,
            source: 'construction_plan_on_update' as const,
            ...diff,
        };
        return {
            ...eventWithoutFingerprint,
            eventFingerprint: hashProjection(eventWithoutFingerprint),
        };
    });
};

export const partitionConstructionPlanAutosaveAuditEvents = <T>(events: readonly T[]): T[][] => {
    const chunks: T[][] = [];
    for (let start = 0; start < events.length; start += MAX_TRANSACTION_EVENTS) {
        chunks.push(events.slice(start, start + MAX_TRANSACTION_EVENTS));
    }
    return chunks;
};

export const assertConstructionPlanAutosaveAuditEventIdempotent = (
    existing: unknown,
    expected: ConstructionPlanAutosaveAuditEvent,
): void => {
    if (!isUnknownRecord(existing)
        || existing.eventFingerprint !== expected.eventFingerprint
        || existing.id !== expected.id) {
        throw new functions.https.HttpsError(
            'data-loss',
            '결정적 시공계획서 감사 이벤트가 기존 기록과 일치하지 않습니다.',
        );
    }
};

const resolveActorName = async (actorId: string): Promise<string> => {
    if (actorId === 'system') return '시스템 자동처리';
    try {
        const profile = await admin.firestore().collection(USERS_COLLECTION).doc(actorId).get();
        const data = profile.exists && isUnknownRecord(profile.data()) ? profile.data() as UnknownRecord : {};
        return boundedActorName(
            readTrimmedString(data, ['name'])
            || readTrimmedString(data, ['displayName'])
            || readTrimmedString(data, ['userName']),
        );
    } catch {
        return '사용자 이름 미확인';
    }
};

const persistAppendOnlyEvents = async (events: readonly ConstructionPlanAutosaveAuditEvent[]): Promise<void> => {
    const database = admin.firestore();
    for (const chunk of partitionConstructionPlanAutosaveAuditEvents(events)) {
        const refs = chunk.map((event) => database.collection(AUDIT_COLLECTION).doc(event.id));
        await database.runTransaction(async (transaction) => {
            const existing = await Promise.all(refs.map((ref) => transaction.get(ref)));
            existing.forEach((snapshot, index) => {
                if (snapshot.exists) {
                    assertConstructionPlanAutosaveAuditEventIdempotent(snapshot.data(), chunk[index]);
                } else {
                    transaction.create(refs[index], chunk[index]);
                }
            });
        });
    }
};

export const auditConstructionPlanAutosaveOnUpdate = functions
    .runWith({ timeoutSeconds: 120, memory: '256MB', maxInstances: 20 })
    .region('asia-northeast3')
    .firestore.document(`${PLANS_COLLECTION}/{planId}`)
    .onUpdate(async (change, context) => {
        const before = change.before.data();
        const after = change.after.data();
        const diffs = diffConstructionPlanAutosaveAudit(before, after);
        if (diffs.length === 0) return;
        const afterRecord = isUnknownRecord(after) ? after : {};
        const actorId = safeIdentifier(readTrimmedString(afterRecord, ['updatedBy']) || 'system', 'actor');
        const actorName = await resolveActorName(actorId);
        const events = buildConstructionPlanAutosaveAuditEvents({
            requestId: context.eventId,
            planId: context.params.planId,
            siteId: readTrimmedString(afterRecord, ['siteId']),
            actorId,
            actorName,
            timestamp: context.timestamp,
        }, diffs);
        await persistAppendOnlyEvents(events);
    });
