import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';
import {
    buildCanonicalConstructionPlanDraftContext,
    buildConstructionPlanMutationClaimId,
    canonicalStringify,
    classifyConstructionPlanRoleAccess,
    isConstructionPlanParticipant,
    isUnknownRecord,
    projectSafeWorkerDirectoryEntry,
    readTrimmedString,
    sha256Hex,
    validateConstructionPlanForRelease,
    type ConstructionPlanRoleAccess,
    type SafeWorkerDirectoryEntry,
    type UnknownRecord,
} from './domain';
import { callableFirestoreValue } from './callableFirestoreValue';
import {
    CONSTRUCTION_PLAN_ERP_REFRESH_FIELDS,
    CONSTRUCTION_PLAN_ERP_REFRESH_FIELD_IDS as ERP_REFRESH_FIELD_IDS,
    CONSTRUCTION_PLAN_ERP_REFRESH_SLOT_SOURCE as SLOT_SOURCE,
    type ConstructionPlanErpRefreshFieldId,
    type ConstructionPlanErpRefreshSlot,
} from './erpRefreshContract';
import { buildConstructionPlanErpSourceMasterHash } from './erpFieldProvenance';
import {
    applyConstructionPlanOrganizationRefreshProjection,
    compareConstructionPlanOrganizationRefresh,
    parseConstructionPlanOrganizationRefreshSelection,
    projectConstructionPlanOrganizationWorkerDirectory,
    type ConstructionPlanOrganizationRefreshComparison,
    type ConstructionPlanOrganizationRefreshSelection,
} from './organizationRefresh';

export {
    CONSTRUCTION_PLAN_ERP_REFRESH_FIELDS,
    type ConstructionPlanErpRefreshFieldId,
    type ConstructionPlanErpRefreshSlot,
} from './erpRefreshContract';

const PLANS_COLLECTION = 'constructionPlans';
const SITES_COLLECTION = 'sites';
const COMPANIES_COLLECTION = 'companies';
const TEAMS_COLLECTION = 'teams';
const USERS_COLLECTION = 'users';
const WORKERS_COLLECTION = 'workers';
const MUTATION_KEYS_COLLECTION = 'constructionPlanMutationKeys';
const AUDIT_COLLECTION = 'constructionPlanAuditEvents';
const APPLY_OPERATION = 'apply_erp_snapshot_fields';
const MAX_WORKER_RESULTS = 500;
const EDITABLE_STATUSES = new Set(['draft', 'changes_requested']);
const PLAN_STATUSES = new Set([
    'draft',
    'in_review',
    'changes_requested',
    'review_completed',
    'approved_pending_issue',
    'issued',
    'superseded',
    'archived',
    'void',
]);
const DOCUMENT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/;

const SLOT_LINK_FIELD: Partial<Record<ConstructionPlanErpRefreshSlot, string>> = {
    clientCompany: 'site.clientCompanyId',
    contractorCompany: 'site.contractorCompanyId',
    partnerCompany: 'site.partnerCompanyId',
    responsibleTeam: 'site.responsibleTeamId',
};
const SLOT_LINK_NAME_FIELD: Partial<Record<ConstructionPlanErpRefreshSlot, string>> = {
    clientCompany: 'site.clientCompanyName',
    contractorCompany: 'site.contractorCompanyName',
    partnerCompany: 'site.partnerCompanyName',
    responsibleTeam: 'site.responsibleTeamName',
};

type ErpRefreshActor = {
    uid: string;
    access: ConstructionPlanRoleAccess;
    profile: UnknownRecord;
};

export type ConstructionPlanErpRefreshApplyRequest = {
    planId: string;
    expectedLockVersion: number;
    fieldIds: string[];
    reason: string;
    idempotencyKey: string;
    organizationSelection?: ConstructionPlanOrganizationRefreshSelection;
};

export type ConstructionPlanErpRefreshFieldChange = {
    id: string;
    slot: ConstructionPlanErpRefreshSlot;
    field: string;
    before?: string;
    after?: string;
};

export type ConstructionPlanErpRefreshProjection = {
    plan: UnknownRecord;
    appliedFieldIds: string[];
    remainingFieldIds: string[];
    beforeHash: string;
    afterHash: string;
};

type ConstructionPlanLatestRefreshContext = {
    erpSnapshot: UnknownRecord;
    responsibleTeamId?: string;
    workers: SafeWorkerDirectoryEntry[];
    organizationComparison: ConstructionPlanOrganizationRefreshComparison;
};

const runner = functions
    .runWith({ timeoutSeconds: 60, memory: '512MB', maxInstances: 10 })
    .region('asia-northeast3');

const db = () => admin.firestore();

const bindPlanDocumentId = (raw: UnknownRecord, planId: string): UnknownRecord => {
    const storedId = readTrimmedString(raw, ['id']);
    if (storedId && storedId !== planId) {
        throw new functions.https.HttpsError('data-loss', '계획서 문서 ID 결합이 손상되었습니다.');
    }
    return { ...raw, id: planId };
};

const callableRecord = (value: unknown): UnknownRecord => {
    if (!isUnknownRecord(value)) {
        throw new functions.https.HttpsError('invalid-argument', 'ERP 원천 비교 요청이 올바르지 않습니다.');
    }
    return value;
};

const assertExactKeys = (record: UnknownRecord, allowed: readonly string[]): void => {
    const allowedSet = new Set(allowed);
    if (Object.keys(record).some((key) => !allowedSet.has(key))) {
        throw new functions.https.HttpsError(
            'invalid-argument',
            '서버가 생성해야 하는 최신 ERP 데이터를 요청에 포함할 수 없습니다.',
        );
    }
};

const requiredString = (record: UnknownRecord, key: string, maxLength: number): string => {
    const value = readTrimmedString(record, [key]);
    if (!value || value.length > maxLength) {
        throw new functions.https.HttpsError('invalid-argument', `${key} 값이 올바르지 않습니다.`);
    }
    return value;
};

const documentId = (record: UnknownRecord, key: string): string => {
    const value = requiredString(record, key, 200);
    if (!DOCUMENT_ID_PATTERN.test(value)) {
        throw new functions.https.HttpsError('invalid-argument', `${key} 문서 ID가 올바르지 않습니다.`);
    }
    return value;
};

export const parseConstructionPlanErpRefreshGetRequest = (value: unknown): { planId: string } => {
    const record = callableRecord(value);
    assertExactKeys(record, ['planId']);
    return { planId: documentId(record, 'planId') };
};

export const parseConstructionPlanErpRefreshApplyRequest = (
    value: unknown,
): ConstructionPlanErpRefreshApplyRequest => {
    const record = callableRecord(value);
    assertExactKeys(record, [
        'planId', 'expectedLockVersion', 'fieldIds', 'reason', 'idempotencyKey', 'organizationSelection',
    ]);
    if (!Number.isInteger(record.expectedLockVersion) || Number(record.expectedLockVersion) < 0) {
        throw new functions.https.HttpsError('invalid-argument', 'expectedLockVersion 값이 올바르지 않습니다.');
    }
    if (!Array.isArray(record.fieldIds)
        || record.fieldIds.length > ERP_REFRESH_FIELD_IDS.size
        || record.fieldIds.some((fieldId) => typeof fieldId !== 'string' || !ERP_REFRESH_FIELD_IDS.has(fieldId))) {
        throw new functions.https.HttpsError('invalid-argument', '반영할 ERP 필드가 올바르지 않습니다.');
    }
    const fieldIds = record.fieldIds.map((fieldId) => String(fieldId));
    if (new Set(fieldIds).size !== fieldIds.length) {
        throw new functions.https.HttpsError('invalid-argument', '반영할 ERP 필드가 중복되었습니다.');
    }
    const organizationSelection = parseConstructionPlanOrganizationRefreshSelection(record.organizationSelection);
    if (fieldIds.length === 0 && !organizationSelection) {
        throw new functions.https.HttpsError('invalid-argument', '반영할 ERP 또는 조직·작업자 변경을 선택하세요.');
    }
    const reason = requiredString(record, 'reason', 500);
    if (reason.length < 5) {
        throw new functions.https.HttpsError('invalid-argument', '반영 사유를 5자 이상 기록하세요.');
    }
    return {
        planId: documentId(record, 'planId'),
        expectedLockVersion: Number(record.expectedLockVersion),
        fieldIds: fieldIds.sort(),
        reason,
        idempotencyKey: requiredString(record, 'idempotencyKey', 128),
        ...(organizationSelection ? { organizationSelection } : {}),
    };
};

const isoDateTime = (value: unknown): string | undefined => {
    if (typeof value !== 'string' || !value.trim() || !Number.isFinite(Date.parse(value))) return undefined;
    return new Date(value).toISOString();
};

const normalizedString = (value: unknown): string | undefined =>
    typeof value === 'string' && value.trim() ? value.trim() : undefined;

const projectRefreshSource = (
    raw: unknown,
    slot: ConstructionPlanErpRefreshSlot,
): UnknownRecord | undefined => {
    if (!isUnknownRecord(raw) || !isUnknownRecord(raw.value)) return undefined;
    const expectedSource = SLOT_SOURCE[slot];
    const sourceId = normalizedString(raw.sourceId);
    const id = normalizedString(raw.value.id) || sourceId;
    const name = normalizedString(raw.value.name);
    const capturedAt = isoDateTime(raw.capturedAt);
    if (raw.source !== expectedSource || !sourceId || !id || !name || id !== sourceId || !capturedAt) {
        return undefined;
    }
    const value: UnknownRecord = { id, name };
    CONSTRUCTION_PLAN_ERP_REFRESH_FIELDS[slot].forEach((field) => {
        const projected = normalizedString(raw.value[field]);
        if (projected) value[field] = projected;
    });
    const sourceUpdatedAt = isoDateTime(raw.sourceUpdatedAt);
    return {
        value,
        source: expectedSource,
        sourceId,
        ...(sourceUpdatedAt ? { sourceUpdatedAt } : {}),
        capturedAt,
        overridden: raw.overridden === true,
    };
};

const projectFieldProvenance = (raw: unknown): UnknownRecord => {
    if (!isUnknownRecord(raw)) return {};
    const result: UnknownRecord = {};
    Object.entries(raw).forEach(([fieldId, value]) => {
        if (!ERP_REFRESH_FIELD_IDS.has(fieldId) || !isUnknownRecord(value)) return;
        const [slot] = fieldId.split('.') as [ConstructionPlanErpRefreshSlot];
        const sourceId = normalizedString(value.sourceId);
        const capturedAt = isoDateTime(value.capturedAt);
        if (!sourceId || !capturedAt || value.source !== SLOT_SOURCE[slot]) return;
        const sourceUpdatedAt = isoDateTime(value.sourceUpdatedAt);
        const captureKind = value.captureKind === 'initial' || value.captureKind === 'refresh'
            ? value.captureKind
            : undefined;
        const sourceMasterHash = normalizedString(value.sourceMasterHash)?.toLowerCase();
        if (!captureKind || !sourceMasterHash || !/^[a-f0-9]{64}$/.test(sourceMasterHash)) return;
        const appliedBy = normalizedString(value.appliedBy);
        const appliedAt = isoDateTime(value.appliedAt);
        const changeReason = normalizedString(value.changeReason);
        const auditEventId = normalizedString(value.auditEventId);
        const hasAnyRefreshEvidence = Boolean(appliedBy || appliedAt || changeReason || auditEventId);
        const hasRefreshEvidence = Boolean(appliedBy && appliedAt && changeReason && auditEventId);
        if ((captureKind === 'refresh' && (!hasRefreshEvidence || changeReason!.length < 5))
            || (captureKind === 'initial' && hasAnyRefreshEvidence)) return;
        result[fieldId] = {
            source: SLOT_SOURCE[slot],
            sourceId,
            ...(sourceUpdatedAt ? { sourceUpdatedAt } : {}),
            capturedAt,
            captureKind,
            sourceMasterHash,
            ...(captureKind === 'refresh' ? {
                appliedBy,
                appliedAt,
                changeReason,
                auditEventId,
            } : {}),
        };
    });
    return result;
};

/**
 * Projects only fields allowed in the refresh comparison channel. Raw photos,
 * image URLs, email, fax and arbitrary master fields are never returned.
 */
export const projectConstructionPlanErpRefreshSnapshot = (raw: unknown): UnknownRecord | undefined => {
    if (!isUnknownRecord(raw)) return undefined;
    const capturedAt = isoDateTime(raw.capturedAt);
    const site = projectRefreshSource(raw.site, 'site');
    if (!capturedAt || !site) return undefined;
    const result: UnknownRecord = { schemaVersion: 1, capturedAt, site };
    (['clientCompany', 'contractorCompany', 'partnerCompany', 'responsibleTeam'] as const)
        .forEach((slot) => {
            const projected = projectRefreshSource(raw[slot], slot);
            if (projected) result[slot] = projected;
        });
    const fieldProvenance = projectFieldProvenance(raw.fieldProvenance);
    if (Object.keys(fieldProvenance).length) result.fieldProvenance = fieldProvenance;
    return result;
};

const sourceValue = (snapshot: UnknownRecord | undefined, slot: ConstructionPlanErpRefreshSlot): UnknownRecord => {
    const source = snapshot && isUnknownRecord(snapshot[slot]) ? snapshot[slot] as UnknownRecord : {};
    return isUnknownRecord(source.value) ? source.value : {};
};

export const diffConstructionPlanErpRefreshSnapshots = (
    before: unknown,
    after: unknown,
): ConstructionPlanErpRefreshFieldChange[] => {
    const beforeSnapshot = projectConstructionPlanErpRefreshSnapshot(before);
    const afterSnapshot = projectConstructionPlanErpRefreshSnapshot(after);
    if (!afterSnapshot) return [];
    const changes: ConstructionPlanErpRefreshFieldChange[] = [];
    (Object.keys(CONSTRUCTION_PLAN_ERP_REFRESH_FIELDS) as ConstructionPlanErpRefreshSlot[])
        .forEach((slot) => {
            const beforeSource = beforeSnapshot && isUnknownRecord(beforeSnapshot[slot])
                ? beforeSnapshot[slot] as UnknownRecord
                : undefined;
            const afterSource = isUnknownRecord(afterSnapshot[slot])
                ? afterSnapshot[slot] as UnknownRecord
                : undefined;
            const beforeValue = sourceValue(beforeSnapshot, slot);
            const afterValue = sourceValue(afterSnapshot, slot);
            const sourceChanged = normalizedString(beforeSource?.sourceId) !== normalizedString(afterSource?.sourceId);
            CONSTRUCTION_PLAN_ERP_REFRESH_FIELDS[slot].forEach((field) => {
                const previous = normalizedString(beforeValue[field]);
                const latest = normalizedString(afterValue[field]);
                if (previous === latest && !(sourceChanged && field === 'name')) return;
                changes.push({
                    id: `${slot}.${field}`,
                    slot,
                    field,
                    ...(previous ? { before: previous } : {}),
                    ...(latest ? { after: latest } : {}),
                });
            });
        });
    return changes;
};

type RefreshProvenanceEvidence = {
    actorId: string;
    appliedAt: string;
    changeReason: string;
    auditEventId: string;
};

const provenanceForSource = (
    source: UnknownRecord,
    evidence?: RefreshProvenanceEvidence,
): UnknownRecord => ({
    source: source.source,
    sourceId: source.sourceId,
    ...(source.sourceUpdatedAt ? { sourceUpdatedAt: source.sourceUpdatedAt } : {}),
    capturedAt: source.capturedAt,
    captureKind: evidence ? 'refresh' : 'initial',
    sourceMasterHash: buildConstructionPlanErpSourceMasterHash(source),
    ...(evidence ? {
        appliedBy: evidence.actorId,
        appliedAt: evidence.appliedAt,
        changeReason: evidence.changeReason,
        auditEventId: evidence.auditEventId,
    } : {}),
});

const seedFieldProvenance = (snapshot: UnknownRecord): UnknownRecord => {
    const seeded = projectFieldProvenance(snapshot.fieldProvenance);
    (Object.keys(CONSTRUCTION_PLAN_ERP_REFRESH_FIELDS) as ConstructionPlanErpRefreshSlot[])
        .forEach((slot) => {
            const source = isUnknownRecord(snapshot[slot]) ? snapshot[slot] as UnknownRecord : undefined;
            if (!source || !isUnknownRecord(source.value)) return;
            CONSTRUCTION_PLAN_ERP_REFRESH_FIELDS[slot].forEach((field) => {
                const fieldId = `${slot}.${field}`;
                if (source.value[field] !== undefined && seeded[fieldId] === undefined) {
                    seeded[fieldId] = provenanceForSource(source);
                }
            });
        });
    return seeded;
};

const setOptionalString = (record: UnknownRecord, key: string, value: string | undefined): void => {
    if (value) record[key] = value;
    else delete record[key];
};

const applyPdfVisibleProjectFields = (
    rawProject: unknown,
    nextSnapshot: UnknownRecord,
    selected: ReadonlySet<string>,
    capturedAt: string,
    hasRemainingChanges: boolean,
): UnknownRecord => {
    const project = isUnknownRecord(rawProject) ? { ...rawProject } : {};
    const site = sourceValue(nextSnapshot, 'site');
    if (selected.has('site.name')) setOptionalString(project, 'siteName', normalizedString(site.name));
    if (selected.has('site.address')) setOptionalString(project, 'address', normalizedString(site.address));
    if (selected.has('site.startDate') || selected.has('site.endDate')) {
        const period = isUnknownRecord(project.constructionPeriod) ? { ...project.constructionPeriod } : {};
        if (selected.has('site.startDate')) setOptionalString(period, 'startDate', normalizedString(site.startDate));
        if (selected.has('site.endDate')) setOptionalString(period, 'endDate', normalizedString(site.endDate));
        project.constructionPeriod = period;
    }
    if (selected.has('clientCompany.name') || selected.has('site.clientCompanyName')) {
        const client = sourceValue(nextSnapshot, 'clientCompany');
        setOptionalString(project, 'clientName', normalizedString(client.name)
            || normalizedString(site.clientCompanyName));
    }
    if (selected.has('contractorCompany.name') || selected.has('site.contractorCompanyName')) {
        const contractor = sourceValue(nextSnapshot, 'contractorCompany');
        setOptionalString(project, 'contractorName', normalizedString(contractor.name)
            || normalizedString(site.contractorCompanyName));
    }
    // Site-master media may contain private download tokens and is never part
    // of the construction-plan ERP/project snapshot contract.
    project.sitePhotos = [];
    project.capturedAt = capturedAt;
    project.differsFromMaster = hasRemainingChanges;
    return project;
};

const assertRelationalSelection = (
    changes: readonly ConstructionPlanErpRefreshFieldChange[],
    selected: ReadonlySet<string>,
): void => {
    (Object.keys(SLOT_LINK_FIELD) as ConstructionPlanErpRefreshSlot[]).forEach((slot) => {
        const linkField = SLOT_LINK_FIELD[slot];
        if (!linkField) return;
        const slotChanges = changes.filter((change) => change.slot === slot).map((change) => change.id);
        const linkChanged = changes.some((change) => change.id === linkField);
        const linkedNameField = SLOT_LINK_NAME_FIELD[slot];
        const linkedNameChanged = Boolean(
            linkedNameField && changes.some((change) => change.id === linkedNameField),
        );
        const relationChanges = [
            linkField,
            ...(linkedNameChanged && linkedNameField ? [linkedNameField] : []),
            ...slotChanges,
        ];
        const touchesRelation = relationChanges.some((fieldId) => selected.has(fieldId));
        if (!linkChanged || !touchesRelation) return;
        if (relationChanges.some((fieldId) => !selected.has(fieldId))) {
            throw new functions.https.HttpsError(
                'failed-precondition',
                '연결된 ERP 원천 ID가 바뀌어 해당 회사·팀 변경 전체를 함께 선택해야 합니다.',
            );
        }
    });
};

const finalizeConstructionPlanSourceRefresh = (input: {
    plan: UnknownRecord;
    patch: UnknownRecord;
    actorId: string;
    capturedAt: string;
}): UnknownRecord => {
    const lockVersion = Number(input.plan.lockVersion);
    if (!Number.isInteger(lockVersion) || lockVersion < 0) {
        throw new functions.https.HttpsError('data-loss', '계획서 잠금 버전이 손상되었습니다.');
    }
    const releaseReadiness = isUnknownRecord(input.plan.releaseReadiness)
        ? { ...input.plan.releaseReadiness }
        : {};
    Object.assign(releaseReadiness, {
        requiredReviewsComplete: false,
        snapshotHashMatches: false,
        pdfVisualCheckPassed: false,
        pdfTextCheckPassed: false,
        workerRefreshAvailable: false,
    });
    const nextPlan: UnknownRecord = {
        ...input.plan,
        ...input.patch,
        releaseReadiness,
        updatedBy: input.actorId,
        updatedAt: input.capturedAt,
        lockVersion: lockVersion + 1,
    };
    [
        // A changes_requested plan still belongs to the same immutable review
        // cycle. Preserve all activeReview* anchors for the next round.
        'approvedSnapshotId', 'approvedSnapshotHash', 'approvedSnapshotStoragePath',
        'approvedEvidenceId', 'approvedEvidenceHash', 'approverName', 'approvedAt',
    ].forEach((field) => delete nextPlan[field]);
    const validation = validateConstructionPlanForRelease(nextPlan);
    nextPlan.validationSummary = {
        errors: validation.issues.length,
        warnings: 0,
        checkedAt: input.capturedAt,
    };
    return nextPlan;
};

/** Applies only the selected server-observed differences and preserves every unselected value. */
export const applyConstructionPlanErpRefreshProjection = (input: {
    plan: UnknownRecord;
    latestSnapshot: unknown;
    fieldIds: readonly string[];
    actorId: string;
    capturedAt: string;
    reason: string;
    auditEventId: string;
}): ConstructionPlanErpRefreshProjection => {
    const currentRaw = isUnknownRecord(input.plan.erpSnapshot) ? input.plan.erpSnapshot : undefined;
    const current = projectConstructionPlanErpRefreshSnapshot(currentRaw);
    const latest = projectConstructionPlanErpRefreshSnapshot(input.latestSnapshot);
    if (!current || !latest) {
        throw new functions.https.HttpsError(
            'failed-precondition',
            '현재 문서의 ERP 출처 스냅샷을 검증할 수 없어 자동 반영하지 않습니다.',
        );
    }
    const changes = diffConstructionPlanErpRefreshSnapshots(current, latest);
    const changed = new Set(changes.map((change) => change.id));
    const selected = new Set(input.fieldIds);
    if (!selected.size || Array.from(selected).some((fieldId) => !changed.has(fieldId))) {
        throw new functions.https.HttpsError(
            'failed-precondition',
            '선택한 ERP 필드가 더 이상 최신 원천과 다르지 않습니다. 다시 비교하세요.',
        );
    }
    assertRelationalSelection(changes, selected);

    // Rebuild exclusively from the safe projection. Spreading currentRaw here
    // would preserve legacy/forged keys (photos, email, arbitrary PII) in the
    // newly server-authoritative snapshot and leak them through the response.
    const nextSnapshot: UnknownRecord = { ...current, schemaVersion: 1, capturedAt: input.capturedAt };
    const fieldProvenance = seedFieldProvenance(current);
    const refreshEvidence: RefreshProvenanceEvidence = {
        actorId: input.actorId,
        appliedAt: input.capturedAt,
        changeReason: input.reason,
        auditEventId: input.auditEventId,
    };
    (Object.keys(CONSTRUCTION_PLAN_ERP_REFRESH_FIELDS) as ConstructionPlanErpRefreshSlot[])
        .forEach((slot) => {
            const selectedForSlot = (CONSTRUCTION_PLAN_ERP_REFRESH_FIELDS[slot] as readonly string[])
                .filter((field) => selected.has(`${slot}.${field}`));
            if (!selectedForSlot.length) return;
            const currentSource = isUnknownRecord(current[slot]) ? current[slot] as UnknownRecord : undefined;
            const latestSource = isUnknownRecord(latest[slot]) ? latest[slot] as UnknownRecord : undefined;
            const slotChangeIds = changes.filter((change) => change.slot === slot).map((change) => change.id);
            const wholeSlotSelected = slotChangeIds.every((fieldId) => selected.has(fieldId));
            const sourceIdentityChanged = normalizedString(currentSource?.sourceId)
                !== normalizedString(latestSource?.sourceId);
            if ((!currentSource || !latestSource || sourceIdentityChanged) && !wholeSlotSelected) {
                throw new functions.https.HttpsError(
                    'failed-precondition',
                    '원천 연결이 바뀐 ERP 항목은 해당 그룹을 전체 선택해야 합니다.',
                );
            }
            if (!latestSource) {
                delete nextSnapshot[slot];
                CONSTRUCTION_PLAN_ERP_REFRESH_FIELDS[slot].forEach((field) => {
                    delete fieldProvenance[`${slot}.${field}`];
                });
                return;
            }
            if (!currentSource || sourceIdentityChanged || wholeSlotSelected) {
                nextSnapshot[slot] = { ...latestSource, overridden: false };
                CONSTRUCTION_PLAN_ERP_REFRESH_FIELDS[slot].forEach((field) => {
                    const fieldId = `${slot}.${field}`;
                    if (isUnknownRecord(latestSource.value) && latestSource.value[field] !== undefined) {
                        fieldProvenance[fieldId] = provenanceForSource(latestSource, refreshEvidence);
                    } else {
                        delete fieldProvenance[fieldId];
                    }
                });
                return;
            }
            const currentValue = isUnknownRecord(currentSource.value) ? { ...currentSource.value } : {};
            const latestValue = isUnknownRecord(latestSource.value) ? latestSource.value : {};
            selectedForSlot.forEach((field) => {
                const fieldId = `${slot}.${field}`;
                const value = normalizedString(latestValue[field]);
                if (value) currentValue[field] = value;
                else delete currentValue[field];
                if (value) fieldProvenance[fieldId] = provenanceForSource(latestSource, refreshEvidence);
                else delete fieldProvenance[fieldId];
            });
            if (!normalizedString(currentValue.id) || !normalizedString(currentValue.name)) {
                throw new functions.https.HttpsError(
                    'failed-precondition',
                    '필수 ERP 식별·명칭 필드를 부분적으로 제거할 수 없습니다.',
                );
            }
            const mixedSource: UnknownRecord = {
                ...currentSource,
                value: currentValue,
                capturedAt: input.capturedAt,
                overridden: true,
            };
            delete mixedSource.sourceUpdatedAt;
            nextSnapshot[slot] = mixedSource;
        });
    nextSnapshot.fieldProvenance = fieldProvenance;

    const remainingFieldIds = diffConstructionPlanErpRefreshSnapshots(nextSnapshot, latest)
        .map((change) => change.id);
    const projectSnapshot = applyPdfVisibleProjectFields(
        input.plan.projectSnapshot,
        nextSnapshot,
        selected,
        input.capturedAt,
        remainingFieldIds.length > 0,
    );
    const nextPlan = finalizeConstructionPlanSourceRefresh({
        plan: input.plan,
        patch: { erpSnapshot: nextSnapshot, projectSnapshot },
        actorId: input.actorId,
        capturedAt: input.capturedAt,
    });
    return {
        plan: nextPlan,
        appliedFieldIds: Array.from(selected).sort(),
        remainingFieldIds,
        beforeHash: sha256Hex(canonicalStringify({
            erpSnapshot: input.plan.erpSnapshot,
            projectSnapshot: input.plan.projectSnapshot,
        })),
        afterHash: sha256Hex(canonicalStringify({ erpSnapshot: nextSnapshot, projectSnapshot })),
    };
};

export const assertConstructionPlanErpRefreshReadAccess = (
    plan: UnknownRecord,
    actor: Pick<ErpRefreshActor, 'uid' | 'access'>,
): void => {
    if (!isConstructionPlanParticipant(plan, actor.uid)
        && !actor.access.isAdmin
        && !actor.access.isOffice) {
        throw new functions.https.HttpsError('permission-denied', '이 시공계획서의 ERP 원천을 비교할 권한이 없습니다.');
    }
};

export const assertConstructionPlanErpRefreshApplyAccess = (input: {
    plan: UnknownRecord;
    actor: Pick<ErpRefreshActor, 'uid' | 'access'>;
    expectedLockVersion: number;
    nowEpochMs: number;
}): void => {
    assertConstructionPlanErpRefreshReadAccess(input.plan, input.actor);
    const status = readTrimmedString(input.plan, ['status']);
    if (!status || !EDITABLE_STATUSES.has(status)) {
        throw new functions.https.HttpsError(
            'failed-precondition',
            '검토·승인·발행 상태에서는 ERP 변경을 비교만 할 수 있습니다.',
        );
    }
    const lockVersion = Number(input.plan.lockVersion);
    if (!Number.isInteger(lockVersion) || lockVersion < 0) {
        throw new functions.https.HttpsError('data-loss', '계획서 잠금 버전이 손상되었습니다.');
    }
    if (lockVersion !== input.expectedLockVersion) {
        throw new functions.https.HttpsError('aborted', '다른 작업으로 문서가 변경되었습니다. 다시 비교하세요.');
    }
    const lock = isUnknownRecord(input.plan.editLock) ? input.plan.editLock : {};
    if (readTrimmedString(lock, ['userId']) !== input.actor.uid
        || !Number.isFinite(lock.expiresAtEpochMs)
        || Number(lock.expiresAtEpochMs) <= input.nowEpochMs) {
        throw new functions.https.HttpsError('failed-precondition', '유효한 편집 잠금을 먼저 획득하세요.');
    }
};

export const requireConstructionPlanErpRefreshAuthenticatedUid = (
    auth: Pick<NonNullable<functions.https.CallableContext['auth']>, 'uid'> | undefined,
): string => {
    const uid = typeof auth?.uid === 'string' ? auth.uid.trim() : '';
    if (!uid) {
        throw new functions.https.HttpsError('unauthenticated', '로그인이 필요합니다.');
    }
    return uid;
};

const resolveActor = async (context: functions.https.CallableContext): Promise<ErpRefreshActor> => {
    const uid = requireConstructionPlanErpRefreshAuthenticatedUid(context.auth);
    const token = isUnknownRecord(context.auth.token) ? context.auth.token : {};
    const profileSnapshot = await db().collection(USERS_COLLECTION).doc(uid).get();
    const profile = profileSnapshot.exists && isUnknownRecord(profileSnapshot.data())
        ? profileSnapshot.data() as UnknownRecord
        : {};
    const roleFields = ['role', 'position', 'systemRole', 'accountType', 'roles', 'additionalPositions', 'erpRoleGroups'];
    return {
        uid,
        access: classifyConstructionPlanRoleAccess(roleFields.flatMap((key) => [token[key], profile[key]])),
        profile,
    };
};

const validMasterDocumentId = (value: string | undefined, label: string): string | undefined => {
    if (!value) return undefined;
    if (!DOCUMENT_ID_PATTERN.test(value)) {
        throw new functions.https.HttpsError('failed-precondition', `현장에 연결된 ${label} 마스터 ID가 올바르지 않습니다.`);
    }
    return value;
};

const transactionMaster = async (
    transaction: admin.firestore.Transaction,
    collectionName: string,
    id: string | undefined,
    label: string,
): Promise<UnknownRecord | undefined> => {
    if (!id) return undefined;
    const snapshot = await transaction.get(db().collection(collectionName).doc(id));
    if (!snapshot.exists) {
        throw new functions.https.HttpsError('not-found', `현장에 연결된 ${label} ERP 마스터를 찾을 수 없습니다.`);
    }
    if (!isUnknownRecord(snapshot.data())) {
        throw new functions.https.HttpsError('data-loss', `현장에 연결된 ${label} ERP 마스터가 손상되었습니다.`);
    }
    const value = callableFirestoreValue(snapshot.data());
    return isUnknownRecord(value) ? { ...value, id: snapshot.id } : undefined;
};

const assignedOrganizationWorkerIds = (raw: unknown): string[] => {
    if (!isUnknownRecord(raw) || !Array.isArray(raw.assignments)) return [];
    return Array.from(new Set(raw.assignments.flatMap((assignment) => {
        if (!isUnknownRecord(assignment) || !isUnknownRecord(assignment.worker)) return [];
        const workerId = readTrimmedString(assignment.worker, ['id']);
        return workerId && DOCUMENT_ID_PATTERN.test(workerId) ? [workerId] : [];
    }))).slice(0, 50);
};

const loadSafeWorkerDirectoryInTransaction = async (
    transaction: admin.firestore.Transaction,
    siteId: string,
    responsibleTeamId: string | undefined,
    organizationSnapshot: unknown,
    trustedWorkerIds: readonly string[] = [],
): Promise<SafeWorkerDirectoryEntry[]> => {
    const prioritizedIds = Array.from(new Set([
        ...assignedOrganizationWorkerIds(organizationSnapshot),
        ...trustedWorkerIds.filter((workerId) => DOCUMENT_ID_PATTERN.test(workerId)),
    ])).slice(0, 50);
    const trustedSnapshots = await Promise.all(prioritizedIds.map((workerId) => (
        transaction.get(db().collection(WORKERS_COLLECTION).doc(workerId))
    )));
    const rawWorkers: UnknownRecord[] = [];
    const seenDocumentIds = new Set<string>();
    const collectDocument = (document: admin.firestore.DocumentSnapshot): void => {
        if (!document.exists || seenDocumentIds.has(document.id) || !isUnknownRecord(document.data())) return;
        const normalized = callableFirestoreValue(document.data());
        if (!isUnknownRecord(normalized)) return;
        seenDocumentIds.add(document.id);
        rawWorkers.push({ ...normalized, id: document.id });
    };
    trustedSnapshots.forEach(collectDocument);

    const siteWorkers = await transaction.get(
        db().collection(WORKERS_COLLECTION).where('siteId', '==', siteId).limit(MAX_WORKER_RESULTS),
    );
    siteWorkers.docs.forEach(collectDocument);
    if (responsibleTeamId && seenDocumentIds.size < MAX_WORKER_RESULTS) {
        const remaining = MAX_WORKER_RESULTS - seenDocumentIds.size;
        const teamWorkers = await transaction.get(
            db().collection(WORKERS_COLLECTION).where('teamId', '==', responsibleTeamId).limit(remaining),
        );
        teamWorkers.docs.forEach(collectDocument);
    }
    return projectConstructionPlanOrganizationWorkerDirectory(rawWorkers, new Set(prioritizedIds));
};

const loadLatestSnapshotInTransaction = async (
    transaction: admin.firestore.Transaction,
    plan: UnknownRecord,
    actorId: string,
    capturedAt: string,
): Promise<ConstructionPlanLatestRefreshContext> => {
    const siteId = readTrimmedString(plan, ['siteId']);
    if (!siteId || !DOCUMENT_ID_PATTERN.test(siteId)) {
        throw new functions.https.HttpsError('data-loss', '계획서 현장 ID가 손상되었습니다.');
    }
    const siteSnapshot = await transaction.get(db().collection(SITES_COLLECTION).doc(siteId));
    if (!siteSnapshot.exists || !isUnknownRecord(siteSnapshot.data())) {
        throw new functions.https.HttpsError('not-found', 'ERP 현장 마스터를 찾을 수 없습니다.');
    }
    const normalizedSiteValue = callableFirestoreValue(siteSnapshot.data());
    if (!isUnknownRecord(normalizedSiteValue)) {
        throw new functions.https.HttpsError('data-loss', 'ERP 현장 마스터를 정규화할 수 없습니다.');
    }
    const site = { ...normalizedSiteValue, id: siteSnapshot.id };
    const clientCompanyId = validMasterDocumentId(readTrimmedString(site, ['clientCompanyId']), '발주처');
    const contractorCompanyId = validMasterDocumentId(
        readTrimmedString(site, ['constructorCompanyId', 'companyId']),
        '원도급사',
    );
    const partnerCompanyId = validMasterDocumentId(readTrimmedString(site, ['partnerId']), '협력사');
    const responsibleTeamId = validMasterDocumentId(readTrimmedString(site, ['responsibleTeamId']), '담당팀');
    const trustedSiteManagerWorkerIds = Array.from(new Set([
        'managerId', 'managerUid', 'siteManagerId', 'siteManagerUid',
        'responsibleManagerId', 'responsibleManagerUid',
    ].flatMap((key) => {
        const value = normalizedString(site[key]);
        return value ? [value] : [];
    }).concat([
        'managerIds', 'managerUids', 'siteManagerIds', 'siteManagerUids',
    ].flatMap((key) => Array.isArray(site[key])
        ? (site[key] as unknown[]).flatMap((value) => normalizedString(value) ? [normalizedString(value)!] : [])
        : []))));
    const [clientCompany, contractorCompany, partnerCompany, responsibleTeam, safeWorkers] = await Promise.all([
        transactionMaster(transaction, COMPANIES_COLLECTION, clientCompanyId, '발주처'),
        transactionMaster(transaction, COMPANIES_COLLECTION, contractorCompanyId, '원도급사'),
        transactionMaster(transaction, COMPANIES_COLLECTION, partnerCompanyId, '협력사'),
        transactionMaster(transaction, TEAMS_COLLECTION, responsibleTeamId, '담당팀'),
        loadSafeWorkerDirectoryInTransaction(
            transaction,
            siteId,
            responsibleTeamId,
            plan.organizationSnapshot,
            trustedSiteManagerWorkerIds,
        ),
    ]);
    let canonical: ReturnType<typeof buildCanonicalConstructionPlanDraftContext>;
    try {
        canonical = buildCanonicalConstructionPlanDraftContext({
            siteId,
            site,
            clientCompany,
            contractorCompany,
            partnerCompany,
            responsibleTeam,
            requestedProjectSnapshot: plan.projectSnapshot,
            safeWorkers,
            actorId,
            capturedAt,
        });
    } catch (error) {
        functions.logger.error('[constructionPlans] ERP refresh master projection failed.', {
            planId: readTrimmedString(plan, ['id']),
            siteId,
            errorCode: error instanceof Error ? error.message : 'unknown',
        });
        throw new functions.https.HttpsError(
            'data-loss',
            'ERP 마스터를 시공계획서 안전 스냅샷으로 변환할 수 없습니다.',
        );
    }
    const projected = projectConstructionPlanErpRefreshSnapshot(canonical.erpSnapshot);
    if (!projected) {
        throw new functions.https.HttpsError('data-loss', '최신 ERP 원천을 안전한 비교 형식으로 투영할 수 없습니다.');
    }
    const organizationComparison = compareConstructionPlanOrganizationRefresh({
        current: plan.organizationSnapshot,
        siteId,
        latestWorkers: safeWorkers,
    });
    return {
        erpSnapshot: projected,
        ...(responsibleTeamId ? { responsibleTeamId } : {}),
        workers: safeWorkers,
        organizationComparison,
    };
};

const mutationRequestFingerprint = (
    actorId: string,
    request: ConstructionPlanErpRefreshApplyRequest,
): string => sha256Hex(canonicalStringify({
    actorId,
    operation: APPLY_OPERATION,
    planId: request.planId,
    expectedLockVersion: request.expectedLockVersion,
    fieldIds: request.fieldIds,
    organizationSelection: request.organizationSelection,
    reason: request.reason,
}));

export const resolveConstructionPlanErpRefreshClaim = (
    raw: unknown,
    actorId: string,
    requestFingerprint: string,
): UnknownRecord | null => {
    if (raw === undefined || raw === null) return null;
    if (!isUnknownRecord(raw)
        || raw.operation !== APPLY_OPERATION
        || raw.actorId !== actorId
        || raw.requestFingerprint !== requestFingerprint) {
        throw new functions.https.HttpsError('already-exists', '같은 멱등 키가 다른 ERP 반영 요청에 사용되었습니다.');
    }
    const response = isUnknownRecord(raw.response) ? raw.response : undefined;
    const safeOrganizationIds = (value: unknown): value is string[] => Array.isArray(value)
        && value.length <= 1_100
        && value.every((entry) => typeof entry === 'string'
            && entry.length >= 1
            && entry.length <= 500
            && /^[A-Za-z0-9._:-]+$/.test(entry));
    if (!response
        || !normalizedString(response.planId)
        || !Array.isArray(response.appliedFieldIds)
        || response.appliedFieldIds.some((fieldId) => !ERP_REFRESH_FIELD_IDS.has(String(fieldId)))
        || !Array.isArray(response.remainingFieldIds)
        || response.remainingFieldIds.some((fieldId) => !ERP_REFRESH_FIELD_IDS.has(String(fieldId)))
        || !safeOrganizationIds(response.appliedOrganizationChangeIds)
        || !safeOrganizationIds(response.remainingOrganizationChangeIds)
        || !normalizedString(response.auditEventId)
        || !Number.isInteger(response.afterLockVersion)
        || Number(response.afterLockVersion) < 0) {
        throw new functions.https.HttpsError('data-loss', 'ERP 반영 멱등성 기록이 손상되었습니다.');
    }
    return { ...response, idempotent: true };
};

export const hydrateConstructionPlanErpRefreshClaimResponse = (
    claimResponse: UnknownRecord,
    plan: UnknownRecord,
): UnknownRecord => {
    const lockVersion = Number(plan.lockVersion);
    if (!Number.isInteger(lockVersion)
        || lockVersion < Number(claimResponse.afterLockVersion)) {
        throw new functions.https.HttpsError('data-loss', 'ERP 반영 이후 계획서 버전을 검증할 수 없습니다.');
    }
    return {
        planId: claimResponse.planId,
        plan,
        appliedFieldIds: claimResponse.appliedFieldIds,
        remainingFieldIds: claimResponse.remainingFieldIds,
        appliedOrganizationChangeIds: claimResponse.appliedOrganizationChangeIds,
        remainingOrganizationChangeIds: claimResponse.remainingOrganizationChangeIds,
        auditEventId: claimResponse.auditEventId,
        idempotent: true,
    };
};

const actorName = (actor: ErpRefreshActor): string | undefined =>
    readTrimmedString(actor.profile, ['name', 'displayName', 'userName', 'email']);

const sourceSummary = (snapshot: UnknownRecord): UnknownRecord => {
    const result: UnknownRecord = { capturedAt: snapshot.capturedAt };
    (Object.keys(CONSTRUCTION_PLAN_ERP_REFRESH_FIELDS) as ConstructionPlanErpRefreshSlot[])
        .forEach((slot) => {
            const source = isUnknownRecord(snapshot[slot]) ? snapshot[slot] as UnknownRecord : undefined;
            if (!source) return;
            result[slot] = {
                sourceId: source.sourceId,
                ...(source.sourceUpdatedAt ? { sourceUpdatedAt: source.sourceUpdatedAt } : {}),
                capturedAt: source.capturedAt,
            };
        });
    return result;
};

export const buildConstructionPlanErpRefreshAuditEvent = (input: {
    requestId: string;
    planId: string;
    siteId: string;
    actorId: string;
    actorName?: string;
    capturedAt: string;
    reason: string;
    fieldIds: readonly string[];
    organizationChangeIds?: readonly string[];
    beforeHash: string;
    afterHash: string;
    latestSnapshot: UnknownRecord;
    organizationSourceSummary?: UnknownRecord;
    requestFingerprint: string;
    beforeLockVersion: number;
    afterLockVersion: number;
}): UnknownRecord => ({
    id: input.requestId,
    schemaVersion: 1,
    type: input.fieldIds.length > 0
        ? (input.organizationChangeIds?.length ? 'erp_and_organization_sources_applied' : 'erp_snapshot_fields_applied')
        : 'organization_worker_snapshot_applied',
    requestId: input.requestId,
    planId: input.planId,
    siteId: input.siteId,
    actorId: input.actorId,
    ...(input.actorName ? { actorName: input.actorName } : {}),
    at: input.capturedAt,
    createdAt: input.capturedAt,
    reason: input.reason,
    fieldIds: [...input.fieldIds],
    organizationChangeIds: [...(input.organizationChangeIds ?? [])],
    beforeHash: input.beforeHash,
    afterHash: input.afterHash,
    hashScope: 'erpSnapshot+projectSnapshot+organizationSnapshot',
    sourceSummary: sourceSummary(input.latestSnapshot),
    ...(input.organizationSourceSummary
        ? { organizationSourceSummary: input.organizationSourceSummary } : {}),
    requestFingerprint: input.requestFingerprint,
    beforeLockVersion: input.beforeLockVersion,
    afterLockVersion: input.afterLockVersion,
});

const getLatestErpSnapshot = async (
    data: unknown,
    context: functions.https.CallableContext,
): Promise<UnknownRecord> => {
    const [request, actor] = await Promise.all([
        Promise.resolve(parseConstructionPlanErpRefreshGetRequest(data)),
        resolveActor(context),
    ]);
    return db().runTransaction(async (transaction) => {
        const planSnapshot = await transaction.get(db().collection(PLANS_COLLECTION).doc(request.planId));
        if (!planSnapshot.exists || !isUnknownRecord(planSnapshot.data())) {
            throw new functions.https.HttpsError('not-found', '시공계획서를 찾을 수 없습니다.');
        }
        const plan = bindPlanDocumentId(planSnapshot.data() as UnknownRecord, request.planId);
        assertConstructionPlanErpRefreshReadAccess(plan, actor);
        const status = readTrimmedString(plan, ['status']);
        const lockVersion = Number(plan.lockVersion);
        if (!status || !PLAN_STATUSES.has(status)) {
            throw new functions.https.HttpsError('data-loss', '계획서 상태가 손상되었습니다.');
        }
        if (!Number.isInteger(lockVersion) || lockVersion < 0) {
            throw new functions.https.HttpsError('data-loss', '계획서 잠금 버전이 손상되었습니다.');
        }
        const capturedAt = new Date().toISOString();
        const latestContext = await loadLatestSnapshotInTransaction(transaction, plan, actor.uid, capturedAt);
        const latest = latestContext.erpSnapshot;
        const current = projectConstructionPlanErpRefreshSnapshot(plan.erpSnapshot);
        const changedFieldIds = current
            ? diffConstructionPlanErpRefreshSnapshots(current, latest).map((change) => change.id)
            : [];
        return {
            planId: request.planId,
            status,
            lockVersion,
            ...(current ? { current } : {}),
            latest,
            changedFieldIds,
            organizationComparison: latestContext.organizationComparison,
            capturedAt,
        };
    });
};

const applyErpSnapshotFields = async (
    data: unknown,
    context: functions.https.CallableContext,
): Promise<UnknownRecord> => {
    const [request, actor] = await Promise.all([
        Promise.resolve(parseConstructionPlanErpRefreshApplyRequest(data)),
        resolveActor(context),
    ]);
    const claimId = buildConstructionPlanMutationClaimId(actor.uid, APPLY_OPERATION, request.idempotencyKey);
    const fingerprint = mutationRequestFingerprint(actor.uid, request);
    const claimRef = db().collection(MUTATION_KEYS_COLLECTION).doc(claimId);
    const planRef = db().collection(PLANS_COLLECTION).doc(request.planId);
    const earlyIdempotent = resolveConstructionPlanErpRefreshClaim(
        (await claimRef.get()).data(),
        actor.uid,
        fingerprint,
    );
    if (earlyIdempotent) {
        const planSnapshot = await planRef.get();
        if (!planSnapshot.exists || !isUnknownRecord(planSnapshot.data())) {
            throw new functions.https.HttpsError('not-found', '시공계획서를 찾을 수 없습니다.');
        }
        const currentPlan = bindPlanDocumentId(planSnapshot.data() as UnknownRecord, request.planId);
        assertConstructionPlanErpRefreshReadAccess(currentPlan, actor);
        return hydrateConstructionPlanErpRefreshClaimResponse(earlyIdempotent, currentPlan);
    }

    const auditRef = db().collection(AUDIT_COLLECTION).doc(`erp-refresh-${claimId}`);
    return db().runTransaction(async (transaction) => {
        const [claimSnapshot, planSnapshot] = await Promise.all([
            transaction.get(claimRef),
            transaction.get(planRef),
        ]);
        const idempotent = resolveConstructionPlanErpRefreshClaim(
            claimSnapshot.data(),
            actor.uid,
            fingerprint,
        );
        if (!planSnapshot.exists || !isUnknownRecord(planSnapshot.data())) {
            throw new functions.https.HttpsError('not-found', '시공계획서를 찾을 수 없습니다.');
        }
        const plan = bindPlanDocumentId(planSnapshot.data() as UnknownRecord, request.planId);
        if (idempotent) {
            assertConstructionPlanErpRefreshReadAccess(plan, actor);
            return hydrateConstructionPlanErpRefreshClaimResponse(idempotent, plan);
        }
        const nowEpochMs = Date.now();
        assertConstructionPlanErpRefreshApplyAccess({
            plan,
            actor,
            expectedLockVersion: request.expectedLockVersion,
            nowEpochMs,
        });
        const capturedAt = new Date(nowEpochMs).toISOString();
        const latestContext = await loadLatestSnapshotInTransaction(transaction, plan, actor.uid, capturedAt);
        const erpProjection = request.fieldIds.length > 0
            ? applyConstructionPlanErpRefreshProjection({
                plan,
                latestSnapshot: latestContext.erpSnapshot,
                fieldIds: request.fieldIds,
                actorId: actor.uid,
                capturedAt,
                reason: request.reason,
                auditEventId: auditRef.id,
            })
            : undefined;
        const organizationProjection = request.organizationSelection
            ? applyConstructionPlanOrganizationRefreshProjection({
                current: plan.organizationSnapshot,
                siteId: readTrimmedString(plan, ['siteId']) as string,
                responsibleTeamId: latestContext.responsibleTeamId,
                latestWorkers: latestContext.workers,
                selection: request.organizationSelection,
                actorId: actor.uid,
                capturedAt,
                reason: request.reason,
                auditEventId: auditRef.id,
            })
            : undefined;
        let nextPlan = erpProjection?.plan;
        if (organizationProjection) {
            if (nextPlan) {
                nextPlan = { ...nextPlan, organizationSnapshot: organizationProjection.organizationSnapshot };
                const validation = validateConstructionPlanForRelease(nextPlan);
                nextPlan.validationSummary = {
                    errors: validation.issues.length,
                    warnings: 0,
                    checkedAt: capturedAt,
                };
            } else {
                nextPlan = finalizeConstructionPlanSourceRefresh({
                    plan,
                    patch: { organizationSnapshot: organizationProjection.organizationSnapshot },
                    actorId: actor.uid,
                    capturedAt,
                });
            }
        }
        if (!nextPlan) {
            throw new functions.https.HttpsError('invalid-argument', '반영할 ERP 또는 조직·작업자 변경을 선택하세요.');
        }
        const appliedFieldIds = erpProjection?.appliedFieldIds ?? [];
        const remainingFieldIds = erpProjection
            ? erpProjection.remainingFieldIds
            : diffConstructionPlanErpRefreshSnapshots(plan.erpSnapshot, latestContext.erpSnapshot)
                .map((change) => change.id);
        const appliedOrganizationChangeIds = organizationProjection?.appliedChangeIds ?? [];
        const remainingOrganizationChangeIds = organizationProjection
            ? organizationProjection.remainingChangeIds
            : [
                ...latestContext.organizationComparison.changes.map((change) => change.id),
                ...(latestContext.organizationComparison.additionalWorkersChanged
                    ? ['organization.additionalWorkers'] : []),
                ...latestContext.organizationComparison.assignmentIssues.map(
                    (issue) => `organization.assignment.${issue.assignmentId}.${issue.kind}`,
                ),
            ].sort();
        const response: UnknownRecord = {
            planId: request.planId,
            plan: nextPlan,
            appliedFieldIds,
            remainingFieldIds,
            appliedOrganizationChangeIds,
            remainingOrganizationChangeIds,
            auditEventId: auditRef.id,
            idempotent: false,
        };
        const claimResponse: UnknownRecord = {
            planId: request.planId,
            appliedFieldIds,
            remainingFieldIds,
            appliedOrganizationChangeIds,
            remainingOrganizationChangeIds,
            auditEventId: auditRef.id,
            afterLockVersion: nextPlan.lockVersion,
        };
        transaction.set(planRef, nextPlan);
        transaction.create(claimRef, {
            operation: APPLY_OPERATION,
            actorId: actor.uid,
            requestFingerprint: fingerprint,
            response: claimResponse,
            createdAt: capturedAt,
        });
        transaction.create(auditRef, {
            ...buildConstructionPlanErpRefreshAuditEvent({
                requestId: auditRef.id,
                planId: request.planId,
                siteId: readTrimmedString(plan, ['siteId']) as string,
                actorId: actor.uid,
                actorName: actorName(actor),
                capturedAt,
                reason: request.reason,
                fieldIds: appliedFieldIds,
                organizationChangeIds: appliedOrganizationChangeIds,
                beforeHash: sha256Hex(canonicalStringify({
                    erpSnapshot: plan.erpSnapshot,
                    projectSnapshot: plan.projectSnapshot,
                    organizationSnapshot: plan.organizationSnapshot,
                })),
                afterHash: sha256Hex(canonicalStringify({
                    erpSnapshot: nextPlan.erpSnapshot,
                    projectSnapshot: nextPlan.projectSnapshot,
                    organizationSnapshot: nextPlan.organizationSnapshot,
                })),
                latestSnapshot: latestContext.erpSnapshot,
                organizationSourceSummary: {
                    siteId: readTrimmedString(plan, ['siteId']),
                    ...(latestContext.responsibleTeamId
                        ? { responsibleTeamId: latestContext.responsibleTeamId } : {}),
                    capturedAt,
                    workerCount: latestContext.workers.length,
                    workerDirectoryHash: sha256Hex(canonicalStringify(
                        latestContext.workers as unknown as UnknownRecord[],
                    )),
                },
                requestFingerprint: fingerprint,
                beforeLockVersion: request.expectedLockVersion,
                afterLockVersion: Number(nextPlan.lockVersion),
            }),
        });
        return response;
    });
};

export const getConstructionPlanLatestErpSnapshotServer = runner.https.onCall(getLatestErpSnapshot);
export const applyConstructionPlanErpSnapshotFieldsServer = runner.https.onCall(applyErpSnapshotFields);
