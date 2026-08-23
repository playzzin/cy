import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';
import {
    canonicalStringify,
    classifyConstructionPlanRoleAccess,
    isConstructionPlanParticipant,
    isUnknownRecord,
    readTrimmedString,
    sha256Hex,
    type ConstructionPlanRoleAccess,
    type UnknownRecord,
} from './domain';
import {
    buildConstructionPlanRecordCatalog,
    constructionPlanRecordConfirmationHash,
    deriveConstructionPlanRecordDraftStatus,
    getConstructionPlanRecordCatalog,
    isConstructionPlanRecordType,
    normalizeConstructionPlanRecordResponses,
    validateConstructionPlanRecordForConfirmation,
    type ConstructionPlanRecordCatalog,
    type ConstructionPlanRecordPhoto,
    type ConstructionPlanRecordQuestion,
    type ConstructionPlanRecordType,
} from './executionRecordDomain';
import {
    renderConfirmedConstructionPlanRecordPdf,
    storeImmutableExecutionRecordPdf,
} from './executionRecordPdf';
import type { ConstructionPlanTradeType } from './templateContracts';

export const CONSTRUCTION_PLAN_RECORDS_COLLECTION = 'constructionPlanRecords';
export const CONSTRUCTION_PLAN_RECORD_EXPORTS_COLLECTION = 'constructionPlanRecordExports';
export const CONSTRUCTION_PLAN_RECORD_UPLOAD_SESSIONS_COLLECTION = 'constructionPlanRecordUploadSessions';
const PLANS_COLLECTION = 'constructionPlans';
const USERS_COLLECTION = 'users';
const CLAIMS_COLLECTION = 'constructionPlanMutationKeys';
const AUDIT_COLLECTION = 'constructionPlanAuditEvents';
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/;
const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export interface ExecutionRecordActor {
    uid: string;
    name?: string;
    access: ConstructionPlanRoleAccess;
}

export interface IssuedPlanRecordContext {
    planId: string;
    plan: UnknownRecord;
    exportId: string;
    exportRecord: UnknownRecord;
    binding: UnknownRecord;
}

const runner = functions.runWith({ timeoutSeconds: 60, memory: '512MB', maxInstances: 20 })
    .region('asia-northeast3');
const pdfRunner = functions.runWith({ timeoutSeconds: 300, memory: '1GB', maxInstances: 5 })
    .region('asia-northeast3');

export const executionRecordDb = () => admin.firestore();
export const executionRecordBucket = () => admin.storage().bucket();

const callableRecord = (value: unknown): UnknownRecord => {
    if (!isUnknownRecord(value)) {
        throw new functions.https.HttpsError('invalid-argument', '현장 실행기록 요청이 올바르지 않습니다.');
    }
    return value;
};

const exactKeys = (record: UnknownRecord, keys: readonly string[]): void => {
    const allowed = new Set(keys);
    if (Object.keys(record).some((key) => !allowed.has(key))) {
        throw new functions.https.HttpsError('invalid-argument', '현장 실행기록 요청에 허용되지 않은 필드가 있습니다.');
    }
};

const text = (record: UnknownRecord, key: string, maximum = 200): string => {
    const value = readTrimmedString(record, [key]);
    if (!value || value.length > maximum) {
        throw new functions.https.HttpsError('invalid-argument', `${key} 값이 올바르지 않습니다.`);
    }
    return value.normalize('NFKC').replace(/\s+/g, ' ').trim();
};

const optionalText = (record: UnknownRecord, key: string, maximum = 200): string | undefined => {
    if (record[key] === undefined || record[key] === null || record[key] === '') return undefined;
    return text(record, key, maximum);
};

const id = (record: UnknownRecord, key: string): string => {
    const value = text(record, key, 200);
    if (!ID_PATTERN.test(value) || value.includes('/') || value === '.' || value === '..') {
        throw new functions.https.HttpsError('invalid-argument', `${key} 식별자가 올바르지 않습니다.`);
    }
    return value;
};

const idempotencyKey = (record: UnknownRecord): string => {
    const value = text(record, 'idempotencyKey', 128);
    if (!IDEMPOTENCY_PATTERN.test(value)) {
        throw new functions.https.HttpsError('invalid-argument', 'idempotencyKey 값이 올바르지 않습니다.');
    }
    return value;
};

const positiveVersion = (record: UnknownRecord): number => {
    const value = Number(record.expectedVersion);
    if (!Number.isInteger(value) || value < 1) {
        throw new functions.https.HttpsError('invalid-argument', 'expectedVersion 값이 올바르지 않습니다.');
    }
    return value;
};

const calendarDate = (record: UnknownRecord, key: string): string => {
    const value = text(record, key, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
        throw new functions.https.HttpsError('invalid-argument', `${key} 날짜가 올바르지 않습니다.`);
    }
    return value;
};

const roleStrings = (value: unknown): string[] => {
    if (Array.isArray(value)) return value.flatMap(roleStrings);
    return typeof value === 'string' && value.trim() ? [value.trim().toLowerCase()] : [];
};

export const resolveExecutionRecordActor = async (
    context: functions.https.CallableContext,
): Promise<ExecutionRecordActor> => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', '로그인이 필요합니다.');
    const token = isUnknownRecord(context.auth.token) ? context.auth.token : {};
    const profileSnapshot = await executionRecordDb().collection(USERS_COLLECTION).doc(context.auth.uid).get();
    const profile = profileSnapshot.exists && isUnknownRecord(profileSnapshot.data())
        ? profileSnapshot.data() as UnknownRecord
        : {};
    const roleFields = ['role', 'position', 'systemRole', 'accountType', 'roles', 'additionalPositions', 'erpRoleGroups'];
    const values = roleFields.flatMap((key) => [token[key], profile[key]]);
    const name = readTrimmedString(profile, ['name', 'displayName']) || readTrimmedString(token, ['name']);
    return {
        uid: context.auth.uid,
        ...(name ? { name } : {}),
        access: classifyConstructionPlanRoleAccess(values.flatMap(roleStrings)),
    };
};

const planData = (snapshot: admin.firestore.DocumentSnapshot): UnknownRecord => {
    if (!snapshot.exists || !isUnknownRecord(snapshot.data())) {
        throw new functions.https.HttpsError('not-found', '발행 시공계획서를 찾을 수 없습니다.');
    }
    return snapshot.data() as UnknownRecord;
};

const planParticipants = (plan: UnknownRecord, field: 'authorIds' | 'reviewerIds' | 'approverIds'): string[] => {
    const participants = isUnknownRecord(plan.participants) ? plan.participants : {};
    const values = participants[field];
    return Array.isArray(values)
        ? values.filter((value): value is string => typeof value === 'string' && Boolean(value.trim()))
        : [];
};

const hasCentralAccess = (actor: ExecutionRecordActor): boolean =>
    actor.access.isAdmin || actor.access.isOffice || actor.access.canReviewApproveIssue;

export const assertExecutionRecordPlanReadAccess = (
    plan: UnknownRecord,
    actor: ExecutionRecordActor,
): void => {
    if (!hasCentralAccess(actor) && !isConstructionPlanParticipant(plan, actor.uid)) {
        throw new functions.https.HttpsError('permission-denied', '이 계획서의 현장 실행기록을 조회할 권한이 없습니다.');
    }
};

const exactTrade = (value: unknown): ConstructionPlanTradeType => {
    if (value !== 'system-shoring' && value !== 'system-scaffold') {
        throw new functions.https.HttpsError('data-loss', '계획서 공종 바인딩이 올바르지 않습니다.');
    }
    return value;
};

const buildPlanBinding = (planId: string, plan: UnknownRecord, exported: UnknownRecord): UnknownRecord => {
    const required = {
        siteId: readTrimmedString(plan, ['siteId']),
        seriesId: readTrimmedString(plan, ['seriesId']),
        issuedExportId: readTrimmedString(plan, ['issuedExportId']),
        issuedExportSha256: readTrimmedString(plan, ['issuedExportSha256']),
        templateId: readTrimmedString(plan, ['templateId']),
        templateVersion: readTrimmedString(plan, ['templateVersion']),
        documentNo: readTrimmedString(plan, ['documentNo']),
        title: readTrimmedString(plan, ['title']),
    };
    const revision = Number(plan.revision);
    if (!['issued', 'superseded'].includes(String(plan.status))
        || Object.values(required).some((value) => !value)
        || !Number.isInteger(revision) || revision < 0
        || !SHA256_PATTERN.test(required.issuedExportSha256 || '')
        || exported.id !== required.issuedExportId
        || exported.planId !== planId
        || exported.kind !== 'issued'
        || exported.status !== 'ready'
        || exported.sha256 !== required.issuedExportSha256) {
        throw new functions.https.HttpsError('data-loss', '계획서 발행본 ID·SHA 바인딩이 손상되었습니다.');
    }
    const project = isUnknownRecord(plan.projectSnapshot) ? plan.projectSnapshot : {};
    return {
        planId,
        siteId: required.siteId,
        seriesId: required.seriesId,
        revision,
        planStatusAtCreation: plan.status,
        issuedExportId: required.issuedExportId,
        issuedExportSha256: required.issuedExportSha256,
        tradeType: exactTrade(plan.tradeType),
        templateId: required.templateId,
        templateVersion: required.templateVersion,
        documentNo: required.documentNo,
        title: required.title,
        siteName: readTrimmedString(project, ['siteName']) || readTrimmedString(plan, ['siteName']) || '현장명 미등록',
    };
};

export const loadIssuedPlanRecordContext = async (planId: string): Promise<IssuedPlanRecordContext> => {
    const planRef = executionRecordDb().collection(PLANS_COLLECTION).doc(planId);
    const planSnapshot = await planRef.get();
    const plan = planData(planSnapshot);
    const exportId = readTrimmedString(plan, ['issuedExportId']);
    if (!exportId) throw new functions.https.HttpsError('failed-precondition', '계획서 발행본 정보가 없습니다.');
    const exportSnapshot = await planRef.collection('exports').doc(exportId).get();
    if (!exportSnapshot.exists || !isUnknownRecord(exportSnapshot.data())) {
        throw new functions.https.HttpsError('data-loss', '계획서 발행 export가 없습니다.');
    }
    const exportRecord = exportSnapshot.data() as UnknownRecord;
    return { planId, plan, exportId, exportRecord, binding: buildPlanBinding(planId, plan, exportRecord) };
};

export const assertPlanBindingUnchanged = (
    record: UnknownRecord,
    planId: string,
    plan: UnknownRecord,
    exported: UnknownRecord,
): UnknownRecord => {
    const current = buildPlanBinding(planId, plan, exported);
    const stored = isUnknownRecord(record.planBinding) ? record.planBinding : {};
    const immutableKeys = [
        'planId', 'siteId', 'seriesId', 'revision', 'issuedExportId', 'issuedExportSha256',
        'tradeType', 'templateId', 'templateVersion', 'documentNo', 'title', 'siteName',
    ];
    if (immutableKeys.some((key) => stored[key] !== current[key])) {
        throw new functions.https.HttpsError('data-loss', '실행기록의 발행 계획서 불변 바인딩이 변경되었습니다.');
    }
    return current;
};

export const executionRecordData = (snapshot: admin.firestore.DocumentSnapshot): UnknownRecord => {
    if (!snapshot.exists || !isUnknownRecord(snapshot.data())) {
        throw new functions.https.HttpsError('not-found', '현장 실행기록을 찾을 수 없습니다.');
    }
    const record = snapshot.data() as UnknownRecord;
    if (record.id !== snapshot.id || record.schemaVersion !== 1
        || !Number.isInteger(record.version) || Number(record.version) < 1
        || !['draft', 'incomplete', 'confirmed'].includes(String(record.status))) {
        throw new functions.https.HttpsError('data-loss', '현장 실행기록 서버 레코드가 손상되었습니다.');
    }
    const resourceCandidates = isUnknownRecord(record.resourceCandidates) ? record.resourceCandidates : {};
    if (resourceCandidates.source !== 'issued-plan-snapshot'
        || !Array.isArray(resourceCandidates.workers)
        || !Array.isArray(resourceCandidates.equipment)
        || !Array.isArray(resourceCandidates.confirmers)) {
        throw new functions.https.HttpsError('data-loss', '현장 실행기록의 계획 자원 후보 스냅샷이 없습니다.');
    }
    if (Number(record.recordRevision) > 0) {
        const lineage = isUnknownRecord(record.correctionLineage) ? record.correctionLineage : {};
        if (record.supersedesRecordId !== lineage.supersedesRecordId
            || record.correctionReason !== lineage.reason
            || record.supersededConfirmationHash !== lineage.sourceConfirmationHash
            || record.createdBy !== lineage.actorId
            || record.createdAt !== lineage.createdAt
            || typeof record.supersededConfirmationHash !== 'string'
            || !SHA256_PATTERN.test(record.supersededConfirmationHash)) {
            throw new functions.https.HttpsError('data-loss', '정정 실행기록의 사유·행위자·시각·원본 해시 계보가 손상되었습니다.');
        }
    }
    if (record.status === 'confirmed'
        && (typeof record.confirmationHash !== 'string'
            || record.confirmationHash !== constructionPlanRecordConfirmationHash(record))) {
        throw new functions.https.HttpsError('data-loss', '확인 완료 실행기록의 불변 해시가 일치하지 않습니다.');
    }
    return record;
};

export const catalogFromExecutionRecord = (record: UnknownRecord): ConstructionPlanRecordCatalog => {
    const binding = isUnknownRecord(record.planBinding) ? record.planBinding : {};
    const tradeType = exactTrade(binding.tradeType);
    if (!isConstructionPlanRecordType(record.recordType)
        || typeof record.catalogVersion !== 'string'
        || !Array.isArray(record.questions)) {
        throw new functions.https.HttpsError('data-loss', '실행기록 문항 catalog 바인딩이 없습니다.');
    }
    const questions = record.questions as ConstructionPlanRecordQuestion[];
    const catalog = buildConstructionPlanRecordCatalog(
        tradeType,
        record.recordType,
        record.catalogVersion,
        questions,
    );
    if (catalog.hash !== record.catalogHash || questions.length < 1) {
        throw new functions.https.HttpsError('data-loss', '실행기록 문항 catalog 해시가 일치하지 않습니다.');
    }
    return catalog;
};

export const assertRecordReadAccess = (record: UnknownRecord, plan: UnknownRecord, actor: ExecutionRecordActor) => {
    assertExecutionRecordPlanReadAccess(plan, actor);
    if (record.planId !== record.planBinding?.['planId']) {
        throw new functions.https.HttpsError('data-loss', '실행기록 planId 바인딩이 일치하지 않습니다.');
    }
};

export const assertRecordEditAccess = (
    record: UnknownRecord,
    plan: UnknownRecord,
    actor: ExecutionRecordActor,
): void => {
    assertRecordReadAccess(record, plan, actor);
    if (record.status === 'confirmed') {
        throw new functions.https.HttpsError('failed-precondition', '확인 완료된 실행기록은 변경할 수 없습니다. 정정본을 만드세요.');
    }
    if (!hasCentralAccess(actor) && record.createdBy !== actor.uid) {
        throw new functions.https.HttpsError('permission-denied', '실행기록 작성자 또는 본사만 수정할 수 있습니다.');
    }
};

const assertConfirmAccess = (record: UnknownRecord, plan: UnknownRecord, actor: ExecutionRecordActor) => {
    assertRecordReadAccess(record, plan, actor);
    const allowed = hasCentralAccess(actor)
        || planParticipants(plan, 'reviewerIds').includes(actor.uid)
        || planParticipants(plan, 'approverIds').includes(actor.uid)
        || record.designatedConfirmerId === actor.uid;
    if (!allowed) throw new functions.https.HttpsError('permission-denied', '검토자·승인자·지정 확인자만 확인할 수 있습니다.');
};

const mutationClaimRef = (actorId: string, operation: string, key: string) => executionRecordDb()
    .collection(CLAIMS_COLLECTION)
    .doc(`record_${sha256Hex(canonicalStringify({ actorId, operation, key }))}`);

const fingerprint = (actorId: string, operation: string, request: UnknownRecord) => sha256Hex(canonicalStringify({
    actorId,
    operation,
    request,
}));

const claimResponse = (
    snapshot: admin.firestore.DocumentSnapshot,
    operation: string,
    requestFingerprint: string,
): UnknownRecord | undefined => {
    if (!snapshot.exists) return undefined;
    const claim = snapshot.data();
    if (!isUnknownRecord(claim)
        || claim.scope !== 'construction-plan-record'
        || claim.operation !== operation
        || claim.requestFingerprint !== requestFingerprint
        || !isUnknownRecord(claim.response)) {
        if (isUnknownRecord(claim) && claim.scope === 'construction-plan-record'
            && claim.operation === operation && claim.requestFingerprint !== requestFingerprint) {
            throw new functions.https.HttpsError('already-exists', '같은 idempotencyKey가 다른 실행기록 요청에 사용되었습니다.');
        }
        throw new functions.https.HttpsError('data-loss', '실행기록 멱등성 레코드가 손상되었습니다.');
    }
    return { ...claim.response, idempotent: true };
};

const createClaim = (
    transaction: admin.firestore.Transaction,
    reference: admin.firestore.DocumentReference,
    actor: ExecutionRecordActor,
    operation: string,
    requestFingerprint: string,
    response: UnknownRecord,
    timestamp: string,
) => transaction.create(reference, {
    scope: 'construction-plan-record', actorId: actor.uid, operation,
    requestFingerprint, response, createdAt: timestamp,
});

const audit = (
    actor: ExecutionRecordActor,
    record: UnknownRecord,
    action: string,
    timestamp: string,
    metadata: UnknownRecord = {},
): UnknownRecord => ({
    schemaVersion: 1,
    entityType: 'construction-plan-record',
    entityId: record.id,
    recordId: record.id,
    planId: record.planId,
    siteId: record.siteId,
    recordType: record.recordType,
    recordRevision: record.recordRevision,
    type: action,
    action,
    actorId: actor.uid,
    ...(actor.name ? { actorName: actor.name } : {}),
    metadata,
    at: timestamp,
    createdAt: timestamp,
});

const buildRecordResourceCandidates = (
    plan: UnknownRecord,
    confirmerCandidates: readonly UnknownRecord[],
): UnknownRecord => {
    const organization = isUnknownRecord(plan.organizationSnapshot) ? plan.organizationSnapshot : {};
    const workerCandidates = new Map<string, UnknownRecord>();
    const addWorker = (raw: unknown, fallbackRole?: string) => {
        if (!isUnknownRecord(raw)) return;
        const workerId = readTrimmedString(raw, ['id']);
        const name = readTrimmedString(raw, ['name']);
        if (!workerId || !name || workerId.length > 200 || name.length > 120 || workerCandidates.has(workerId)) return;
        const role = readTrimmedString(raw, ['role', 'position']) || fallbackRole;
        workerCandidates.set(workerId, {
            workerId,
            name: name.slice(0, 120),
            ...(role ? { role: role.slice(0, 120) } : {}),
        });
    };
    const assignments = Array.isArray(organization.assignments) ? organization.assignments : [];
    assignments.forEach((raw) => {
        if (!isUnknownRecord(raw)) return;
        addWorker(raw.worker, readTrimmedString(raw, ['label']));
    });
    const additionalWorkers = Array.isArray(organization.additionalWorkers) ? organization.additionalWorkers : [];
    additionalWorkers.forEach((raw) => addWorker(raw));

    const equipmentCandidates = new Map<string, UnknownRecord>();
    const equipmentPlan = Array.isArray(plan.equipmentPlan) ? plan.equipmentPlan : [];
    equipmentPlan.forEach((raw) => {
        if (!isUnknownRecord(raw)) return;
        const equipmentId = readTrimmedString(raw, ['id']);
        const name = readTrimmedString(raw, ['equipmentName', 'name']);
        if (!equipmentId || !name || equipmentId.length > 200 || name.length > 160 || equipmentCandidates.has(equipmentId)) return;
        const model = readTrimmedString(raw, ['model']);
        const registrationNo = readTrimmedString(raw, ['registrationNo']);
        const operatorWorkerId = readTrimmedString(raw, ['operatorWorkerId']);
        const operator = operatorWorkerId ? workerCandidates.get(operatorWorkerId) : undefined;
        equipmentCandidates.set(equipmentId, {
            equipmentId,
            name: name.slice(0, 160),
            ...(model ? { model: model.slice(0, 160) } : {}),
            ...(registrationNo ? { registrationNo: registrationNo.slice(0, 120) } : {}),
            ...(operatorWorkerId ? { operatorWorkerId: operatorWorkerId.slice(0, 200) } : {}),
            ...(operator && typeof operator.name === 'string' ? { operatorName: operator.name } : {}),
        });
    });
    return {
        workers: Array.from(workerCandidates.values()).slice(0, 100),
        equipment: Array.from(equipmentCandidates.values()).slice(0, 50),
        confirmers: confirmerCandidates.slice(0, 50),
        source: 'issued-plan-snapshot',
    };
};

const loadPlanConfirmerCandidates = async (
    plan: UnknownRecord,
): Promise<UnknownRecord[]> => {
    const rolesByUid = new Map<string, 'author' | 'reviewer' | 'approver'>();
    planParticipants(plan, 'authorIds').forEach((uid) => rolesByUid.set(uid, 'author'));
    planParticipants(plan, 'reviewerIds').forEach((uid) => rolesByUid.set(uid, 'reviewer'));
    planParticipants(plan, 'approverIds').forEach((uid) => rolesByUid.set(uid, 'approver'));
    const ids = Array.from(rolesByUid.keys()).slice(0, 50);
    if (!ids.length) return [];
    const snapshots = await executionRecordDb().getAll(
        ...ids.map((uid) => executionRecordDb().collection(USERS_COLLECTION).doc(uid)),
    );
    return snapshots.flatMap((snapshot) => {
        const name = snapshot.exists && isUnknownRecord(snapshot.data())
            ? readTrimmedString(snapshot.data() as UnknownRecord, ['name', 'displayName'])
            : undefined;
        return name ? [{ uid: snapshot.id, name: name.slice(0, 200), role: rolesByUid.get(snapshot.id) }] : [];
    });
};

export const resolveDesignatedConfirmerFromCandidates = (
    uid: string | undefined,
    candidates: readonly UnknownRecord[],
): { uid?: string; name?: string } => {
    if (!uid) return {};
    const candidate = candidates.find((value) => isUnknownRecord(value) && value.uid === uid);
    const name = candidate && readTrimmedString(candidate, ['name']);
    if (!candidate || !name) {
        throw new functions.https.HttpsError(
            'invalid-argument',
            '지정 확인자는 발행 계획서의 작성·검토·승인 후보에서 선택해야 합니다.',
        );
    }
    return { uid, name };
};

const normalizeWorkers = (value: unknown): UnknownRecord[] => {
    if (!Array.isArray(value) || value.length > 100) throw new functions.https.HttpsError('invalid-argument', '실제 작업자 목록이 올바르지 않습니다.');
    return value.map((item) => {
        if (!isUnknownRecord(item) || Object.keys(item).some((key) => !['workerId', 'name', 'role'].includes(key))) {
            throw new functions.https.HttpsError('invalid-argument', '실제 작업자 항목이 올바르지 않습니다.');
        }
        const name = text(item, 'name', 120);
        const workerId = optionalText(item, 'workerId', 200);
        const role = optionalText(item, 'role', 120);
        return { ...(workerId ? { workerId } : {}), name, ...(role ? { role } : {}) };
    });
};

const normalizeEquipment = (value: unknown): UnknownRecord[] => {
    if (!Array.isArray(value) || value.length > 50) throw new functions.https.HttpsError('invalid-argument', '실제 장비 목록이 올바르지 않습니다.');
    return value.map((item) => {
        if (!isUnknownRecord(item) || Object.keys(item).some((key) => ![
            'equipmentId', 'name', 'model', 'registrationNo', 'operatorName',
        ].includes(key))) throw new functions.https.HttpsError('invalid-argument', '실제 장비 항목이 올바르지 않습니다.');
        const equipmentId = optionalText(item, 'equipmentId', 200);
        const name = text(item, 'name', 160);
        const model = optionalText(item, 'model', 160);
        const registrationNo = optionalText(item, 'registrationNo', 120);
        const operatorName = optionalText(item, 'operatorName', 120);
        return { ...(equipmentId ? { equipmentId } : {}), name, ...(model ? { model } : {}), ...(registrationNo ? { registrationNo } : {}), ...(operatorName ? { operatorName } : {}) };
    });
};

const bindActualResourcesToIssuedSnapshot = (
    record: UnknownRecord,
    workers: UnknownRecord[],
    equipment: UnknownRecord[],
): { actualWorkers: UnknownRecord[]; actualEquipment: UnknownRecord[] } => {
    const resourceCandidates = isUnknownRecord(record.resourceCandidates) ? record.resourceCandidates : {};
    const workerCandidates = new Map(
        (Array.isArray(resourceCandidates.workers) ? resourceCandidates.workers : [])
            .filter(isUnknownRecord)
            .map((candidate) => [readTrimmedString(candidate, ['workerId']), candidate] as const)
            .filter(([candidateId]) => Boolean(candidateId)),
    );
    const equipmentCandidates = new Map(
        (Array.isArray(resourceCandidates.equipment) ? resourceCandidates.equipment : [])
            .filter(isUnknownRecord)
            .map((candidate) => [readTrimmedString(candidate, ['equipmentId']), candidate] as const)
            .filter(([candidateId]) => Boolean(candidateId)),
    );
    const selectedWorkerIds = new Set<string>();
    const actualWorkers = workers.map((worker) => {
        const workerId = readTrimmedString(worker, ['workerId']);
        if (!workerId) return worker;
        const candidate = workerCandidates.get(workerId);
        if (!candidate || readTrimmedString(candidate, ['name']) !== worker.name || selectedWorkerIds.has(workerId)) {
            throw new functions.https.HttpsError('invalid-argument', 'ERP/계획 스냅샷 작업자 ID·이름 바인딩이 올바르지 않습니다.');
        }
        selectedWorkerIds.add(workerId);
        return worker;
    });
    const selectedEquipmentIds = new Set<string>();
    const actualEquipment = equipment.map((item) => {
        const equipmentId = readTrimmedString(item, ['equipmentId']);
        if (!equipmentId) return item;
        const candidate = equipmentCandidates.get(equipmentId);
        if (!candidate || selectedEquipmentIds.has(equipmentId)) {
            throw new functions.https.HttpsError('invalid-argument', '계획 장비 ID 바인딩이 올바르지 않습니다.');
        }
        selectedEquipmentIds.add(equipmentId);
        const candidateName = readTrimmedString(candidate, ['name']);
        if (!candidateName || candidateName !== item.name) {
            throw new functions.https.HttpsError('invalid-argument', '계획 장비 ID·장비명 바인딩이 올바르지 않습니다.');
        }
        return {
            equipmentId,
            name: candidateName,
            ...(readTrimmedString(candidate, ['model']) ? { model: readTrimmedString(candidate, ['model']) } : {}),
            ...(readTrimmedString(candidate, ['registrationNo']) ? { registrationNo: readTrimmedString(candidate, ['registrationNo']) } : {}),
            ...(readTrimmedString(item, ['operatorName']) ? { operatorName: readTrimmedString(item, ['operatorName']) } : {}),
        };
    });
    return { actualWorkers, actualEquipment };
};

const listRecords = async (data: unknown, context: functions.https.CallableContext): Promise<UnknownRecord> => {
    const actor = await resolveExecutionRecordActor(context);
    const request = callableRecord(data);
    exactKeys(request, ['siteId', 'planId', 'recordType', 'status', 'dateFrom', 'dateTo', 'limit']);
    const siteId = optionalText(request, 'siteId');
    const planId = optionalText(request, 'planId');
    const recordType = request.recordType;
    const status = request.status;
    if (recordType !== undefined && !isConstructionPlanRecordType(recordType)) throw new functions.https.HttpsError('invalid-argument', 'recordType 필터가 올바르지 않습니다.');
    if (status !== undefined && !['draft', 'incomplete', 'confirmed'].includes(String(status))) throw new functions.https.HttpsError('invalid-argument', 'status 필터가 올바르지 않습니다.');
    const dateFrom = request.dateFrom === undefined ? undefined : calendarDate(request, 'dateFrom');
    const dateTo = request.dateTo === undefined ? undefined : calendarDate(request, 'dateTo');
    const limit = request.limit === undefined ? 100 : Number(request.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 200) throw new functions.https.HttpsError('invalid-argument', 'limit 값이 올바르지 않습니다.');
    const snapshot = await executionRecordDb().collection(CONSTRUCTION_PLAN_RECORDS_COLLECTION).limit(250).get();
    const planIds = Array.from(new Set(snapshot.docs.map((row) => readTrimmedString(row.data(), ['planId'])).filter(Boolean) as string[]));
    const planSnapshots = await executionRecordDb().getAll(...planIds.map((value) => executionRecordDb().collection(PLANS_COLLECTION).doc(value)));
    const plans = new Map(planSnapshots.filter((row) => row.exists).map((row) => [row.id, row.data() as UnknownRecord]));
    const records = snapshot.docs.map(executionRecordData).filter((record) => {
        const plan = plans.get(String(record.planId));
        if (!plan) return false;
        try { assertRecordReadAccess(record, plan, actor); } catch { return false; }
        return (!siteId || record.siteId === siteId)
            && (!planId || record.planId === planId)
            && (!recordType || record.recordType === recordType)
            && (!status || record.status === status)
            && (!dateFrom || String(record.workDate) >= dateFrom)
            && (!dateTo || String(record.workDate) <= dateTo);
    }).sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt))).slice(0, limit);
    return { schemaVersion: 1, generatedAt: new Date().toISOString(), records };
};

const getRecord = async (data: unknown, context: functions.https.CallableContext): Promise<UnknownRecord> => {
    const actor = await resolveExecutionRecordActor(context);
    const request = callableRecord(data);
    exactKeys(request, ['recordId']);
    const recordId = id(request, 'recordId');
    const record = executionRecordData(await executionRecordDb().collection(CONSTRUCTION_PLAN_RECORDS_COLLECTION).doc(recordId).get());
    const plan = planData(await executionRecordDb().collection(PLANS_COLLECTION).doc(String(record.planId)).get());
    assertRecordReadAccess(record, plan, actor);
    catalogFromExecutionRecord(record);
    return { schemaVersion: 1, record };
};

const createRecord = async (data: unknown, context: functions.https.CallableContext): Promise<UnknownRecord> => {
    const actor = await resolveExecutionRecordActor(context);
    const request = callableRecord(data);
    exactKeys(request, ['planId', 'recordType', 'workDate', 'building', 'floor', 'zone', 'designatedConfirmerId', 'idempotencyKey']);
    const planId = id(request, 'planId');
    if (!isConstructionPlanRecordType(request.recordType)) throw new functions.https.HttpsError('invalid-argument', 'recordType 값이 올바르지 않습니다.');
    const parsed = {
        planId,
        recordType: request.recordType,
        workDate: calendarDate(request, 'workDate'),
        building: text(request, 'building', 120),
        floor: text(request, 'floor', 120),
        zone: text(request, 'zone', 200),
        designatedConfirmerId: optionalText(request, 'designatedConfirmerId', 200),
        idempotencyKey: idempotencyKey(request),
    };
    const operation = 'create_execution_record';
    const claimRef = mutationClaimRef(actor.uid, operation, parsed.idempotencyKey);
    const requestFingerprint = fingerprint(actor.uid, operation, parsed as unknown as UnknownRecord);
    const early = claimResponse(await claimRef.get(), operation, requestFingerprint);
    if (early) return early;
    const planContext = await loadIssuedPlanRecordContext(planId);
    if (planContext.plan.status !== 'issued') throw new functions.https.HttpsError('failed-precondition', '최신 issued 계획서에서만 새 실행기록을 만들 수 있습니다.');
    assertExecutionRecordPlanReadAccess(planContext.plan, actor);
    const confirmerCandidates = await loadPlanConfirmerCandidates(planContext.plan);
    const confirmer = resolveDesignatedConfirmerFromCandidates(parsed.designatedConfirmerId, confirmerCandidates);
    const catalog = getConstructionPlanRecordCatalog(planContext.binding.tradeType as ConstructionPlanTradeType, parsed.recordType);
    const recordRef = executionRecordDb().collection(CONSTRUCTION_PLAN_RECORDS_COLLECTION).doc();
    const eventRef = executionRecordDb().collection(AUDIT_COLLECTION).doc();
    return executionRecordDb().runTransaction(async (transaction) => {
        const planRef = executionRecordDb().collection(PLANS_COLLECTION).doc(planId);
        const exportRef = planRef.collection('exports').doc(planContext.exportId);
        const [claimSnapshot, planSnapshot, exportSnapshot] = await Promise.all([
            transaction.get(claimRef), transaction.get(planRef), transaction.get(exportRef),
        ]);
        const replay = claimResponse(claimSnapshot, operation, requestFingerprint);
        if (replay) return replay;
        const plan = planData(planSnapshot);
        const exported = exportSnapshot.exists && isUnknownRecord(exportSnapshot.data()) ? exportSnapshot.data() as UnknownRecord : {};
        const binding = buildPlanBinding(planId, plan, exported);
        if (plan.status !== 'issued') throw new functions.https.HttpsError('failed-precondition', '최신 issued 계획서에서만 새 실행기록을 만들 수 있습니다.');
        assertExecutionRecordPlanReadAccess(plan, actor);
        const timestamp = new Date().toISOString();
        const record: UnknownRecord = {
            schemaVersion: 1,
            id: recordRef.id,
            rootRecordId: recordRef.id,
            recordRevision: 0,
            planId,
            siteId: binding.siteId,
            seriesId: binding.seriesId,
            planBinding: binding,
            recordType: parsed.recordType,
            catalogVersion: catalog.version,
            catalogHash: catalog.hash,
            questions: catalog.questions,
            resourceCandidates: buildRecordResourceCandidates(plan, confirmerCandidates),
            workDate: parsed.workDate,
            building: parsed.building,
            floor: parsed.floor,
            zone: parsed.zone,
            actualWorkers: [],
            actualEquipment: [],
            responses: catalog.questions.map((question) => ({ questionId: question.id })),
            photos: [],
            ...(confirmer.uid ? { designatedConfirmerId: confirmer.uid, designatedConfirmerName: confirmer.name } : {}),
            status: 'draft',
            version: 1,
            createdBy: actor.uid,
            ...(actor.name ? { createdByName: actor.name } : {}),
            createdAt: timestamp,
            updatedBy: actor.uid,
            ...(actor.name ? { updatedByName: actor.name } : {}),
            updatedAt: timestamp,
        };
        const response: UnknownRecord = { schemaVersion: 1, record, idempotent: false };
        transaction.create(recordRef, record);
        transaction.create(eventRef, audit(actor, record, 'execution_record_created', timestamp));
        createClaim(transaction, claimRef, actor, operation, requestFingerprint, response, timestamp);
        return response;
    });
};

const updateRecord = async (data: unknown, context: functions.https.CallableContext): Promise<UnknownRecord> => {
    const actor = await resolveExecutionRecordActor(context);
    const request = callableRecord(data);
    exactKeys(request, [
        'recordId', 'expectedVersion', 'workDate', 'building', 'floor', 'zone',
        'actualWorkers', 'actualEquipment', 'responses', 'designatedConfirmerId', 'idempotencyKey',
    ]);
    const parsed = {
        recordId: id(request, 'recordId'), expectedVersion: positiveVersion(request),
        workDate: calendarDate(request, 'workDate'), building: text(request, 'building', 120),
        floor: text(request, 'floor', 120), zone: text(request, 'zone', 200),
        actualWorkers: normalizeWorkers(request.actualWorkers),
        actualEquipment: normalizeEquipment(request.actualEquipment),
        responses: request.responses,
        designatedConfirmerId: optionalText(request, 'designatedConfirmerId', 200),
        idempotencyKey: idempotencyKey(request),
    };
    const operation = 'update_execution_record';
    const claimRef = mutationClaimRef(actor.uid, operation, parsed.idempotencyKey);
    const requestFingerprint = fingerprint(actor.uid, operation, parsed as unknown as UnknownRecord);
    const early = claimResponse(await claimRef.get(), operation, requestFingerprint);
    if (early) return early;
    const recordRef = executionRecordDb().collection(CONSTRUCTION_PLAN_RECORDS_COLLECTION).doc(parsed.recordId);
    const preflight = executionRecordData(await recordRef.get());
    const candidates = isUnknownRecord(preflight.resourceCandidates)
        && Array.isArray(preflight.resourceCandidates.confirmers)
        ? preflight.resourceCandidates.confirmers.filter(isUnknownRecord)
        : [];
    const confirmer = resolveDesignatedConfirmerFromCandidates(parsed.designatedConfirmerId, candidates);
    const boundResources = bindActualResourcesToIssuedSnapshot(
        preflight,
        parsed.actualWorkers,
        parsed.actualEquipment,
    );
    const catalog = catalogFromExecutionRecord(preflight);
    let responses;
    try { responses = normalizeConstructionPlanRecordResponses(parsed.responses, catalog); } catch {
        throw new functions.https.HttpsError('invalid-argument', '체크리스트 응답이 서버 문항 계약과 일치하지 않습니다.');
    }
    const planId = String(preflight.planId);
    const planContext = await loadIssuedPlanRecordContext(planId);
    assertRecordEditAccess(preflight, planContext.plan, actor);
    const eventRef = executionRecordDb().collection(AUDIT_COLLECTION).doc();
    return executionRecordDb().runTransaction(async (transaction) => {
        const planRef = executionRecordDb().collection(PLANS_COLLECTION).doc(planId);
        const exportRef = planRef.collection('exports').doc(planContext.exportId);
        const [claimSnapshot, recordSnapshot, planSnapshot, exportSnapshot] = await Promise.all([
            transaction.get(claimRef), transaction.get(recordRef), transaction.get(planRef), transaction.get(exportRef),
        ]);
        const replay = claimResponse(claimSnapshot, operation, requestFingerprint);
        if (replay) return replay;
        const record = executionRecordData(recordSnapshot);
        const plan = planData(planSnapshot);
        const exported = exportSnapshot.exists && isUnknownRecord(exportSnapshot.data()) ? exportSnapshot.data() as UnknownRecord : {};
        assertPlanBindingUnchanged(record, planId, plan, exported);
        assertRecordEditAccess(record, plan, actor);
        if (record.version !== parsed.expectedVersion) throw new functions.https.HttpsError('aborted', '다른 사용자가 실행기록을 변경했습니다. 새로고침하세요.');
        const timestamp = new Date().toISOString();
        const next: UnknownRecord = {
            ...record,
            workDate: parsed.workDate, building: parsed.building, floor: parsed.floor, zone: parsed.zone,
            actualWorkers: boundResources.actualWorkers,
            actualEquipment: boundResources.actualEquipment,
            responses,
            ...(confirmer.uid
                ? { designatedConfirmerId: confirmer.uid, designatedConfirmerName: confirmer.name }
                : {}),
            version: Number(record.version) + 1,
            updatedBy: actor.uid,
            ...(actor.name ? { updatedByName: actor.name } : {}),
            updatedAt: timestamp,
        };
        if (!confirmer.uid) {
            delete next.designatedConfirmerId;
            delete next.designatedConfirmerName;
        }
        next.status = deriveConstructionPlanRecordDraftStatus(next);
        const response: UnknownRecord = { schemaVersion: 1, record: next, idempotent: false };
        transaction.set(recordRef, next);
        transaction.create(eventRef, audit(actor, next, 'execution_record_updated', timestamp, { fromVersion: record.version, toVersion: next.version }));
        createClaim(transaction, claimRef, actor, operation, requestFingerprint, response, timestamp);
        return response;
    });
};

const confirmRecord = async (data: unknown, context: functions.https.CallableContext): Promise<UnknownRecord> => {
    const actor = await resolveExecutionRecordActor(context);
    const request = callableRecord(data);
    exactKeys(request, ['recordId', 'expectedVersion', 'idempotencyKey']);
    const parsed = { recordId: id(request, 'recordId'), expectedVersion: positiveVersion(request), idempotencyKey: idempotencyKey(request) };
    const operation = 'confirm_execution_record';
    const claimRef = mutationClaimRef(actor.uid, operation, parsed.idempotencyKey);
    const requestFingerprint = fingerprint(actor.uid, operation, parsed as unknown as UnknownRecord);
    const early = claimResponse(await claimRef.get(), operation, requestFingerprint);
    if (early) return early;
    const recordRef = executionRecordDb().collection(CONSTRUCTION_PLAN_RECORDS_COLLECTION).doc(parsed.recordId);
    const preflight = executionRecordData(await recordRef.get());
    const planId = String(preflight.planId);
    const planContext = await loadIssuedPlanRecordContext(planId);
    assertConfirmAccess(preflight, planContext.plan, actor);
    const eventRef = executionRecordDb().collection(AUDIT_COLLECTION).doc();
    return executionRecordDb().runTransaction(async (transaction) => {
        const planRef = executionRecordDb().collection(PLANS_COLLECTION).doc(planId);
        const exportRef = planRef.collection('exports').doc(planContext.exportId);
        const [claimSnapshot, recordSnapshot, planSnapshot, exportSnapshot] = await Promise.all([
            transaction.get(claimRef), transaction.get(recordRef), transaction.get(planRef), transaction.get(exportRef),
        ]);
        const replay = claimResponse(claimSnapshot, operation, requestFingerprint);
        if (replay) return replay;
        const record = executionRecordData(recordSnapshot);
        const plan = planData(planSnapshot);
        const exported = exportSnapshot.exists && isUnknownRecord(exportSnapshot.data()) ? exportSnapshot.data() as UnknownRecord : {};
        assertPlanBindingUnchanged(record, planId, plan, exported);
        if (record.status === 'confirmed') throw new functions.https.HttpsError('failed-precondition', '이미 확인 완료된 실행기록입니다.');
        if (record.version !== parsed.expectedVersion) throw new functions.https.HttpsError('aborted', '다른 사용자가 실행기록을 변경했습니다.');
        assertConfirmAccess(record, plan, actor);
        const catalog = catalogFromExecutionRecord(record);
        const issues = validateConstructionPlanRecordForConfirmation(record, catalog);
        if (issues.length) {
            throw new functions.https.HttpsError('failed-precondition', '실행기록 확인 필수항목이 남아 있습니다.', { issues });
        }
        const timestamp = new Date().toISOString();
        const confirmationHash = constructionPlanRecordConfirmationHash(record);
        const next: UnknownRecord = {
            ...record,
            status: 'confirmed',
            confirmationHash,
            confirmedBy: actor.uid,
            confirmedByName: actor.name || '확인자',
            confirmedAt: timestamp,
            version: Number(record.version) + 1,
            updatedBy: actor.uid,
            ...(actor.name ? { updatedByName: actor.name } : {}),
            updatedAt: timestamp,
        };
        const response: UnknownRecord = { schemaVersion: 1, record: next, idempotent: false };
        transaction.set(recordRef, next);
        transaction.create(eventRef, audit(actor, next, 'execution_record_confirmed', timestamp, { confirmationHash }));
        createClaim(transaction, claimRef, actor, operation, requestFingerprint, response, timestamp);
        return response;
    });
};

const createCorrection = async (data: unknown, context: functions.https.CallableContext): Promise<UnknownRecord> => {
    const actor = await resolveExecutionRecordActor(context);
    const request = callableRecord(data);
    exactKeys(request, ['sourceRecordId', 'reason', 'idempotencyKey']);
    const parsed = { sourceRecordId: id(request, 'sourceRecordId'), reason: text(request, 'reason', 500), idempotencyKey: idempotencyKey(request) };
    if (parsed.reason.length < 5) throw new functions.https.HttpsError('invalid-argument', '정정 사유를 5자 이상 입력하세요.');
    const operation = 'create_execution_record_correction';
    const claimRef = mutationClaimRef(actor.uid, operation, parsed.idempotencyKey);
    const requestFingerprint = fingerprint(actor.uid, operation, parsed as unknown as UnknownRecord);
    const early = claimResponse(await claimRef.get(), operation, requestFingerprint);
    if (early) return early;
    const sourceRef = executionRecordDb().collection(CONSTRUCTION_PLAN_RECORDS_COLLECTION).doc(parsed.sourceRecordId);
    const source = executionRecordData(await sourceRef.get());
    if (source.status !== 'confirmed') throw new functions.https.HttpsError('failed-precondition', '확인 완료 기록만 정정할 수 있습니다.');
    const planId = String(source.planId);
    const planContext = await loadIssuedPlanRecordContext(planId);
    assertRecordReadAccess(source, planContext.plan, actor);
    if (!hasCentralAccess(actor) && source.createdBy !== actor.uid) throw new functions.https.HttpsError('permission-denied', '원 기록 작성자 또는 본사만 정정본을 만들 수 있습니다.');
    const nextRef = executionRecordDb().collection(CONSTRUCTION_PLAN_RECORDS_COLLECTION).doc();
    const eventRef = executionRecordDb().collection(AUDIT_COLLECTION).doc();
    return executionRecordDb().runTransaction(async (transaction) => {
        const planRef = executionRecordDb().collection(PLANS_COLLECTION).doc(planId);
        const exportRef = planRef.collection('exports').doc(planContext.exportId);
        const [claimSnapshot, sourceSnapshot, planSnapshot, exportSnapshot] = await Promise.all([
            transaction.get(claimRef), transaction.get(sourceRef), transaction.get(planRef), transaction.get(exportRef),
        ]);
        const replay = claimResponse(claimSnapshot, operation, requestFingerprint);
        if (replay) return replay;
        const current = executionRecordData(sourceSnapshot);
        if (current.status !== 'confirmed') throw new functions.https.HttpsError('failed-precondition', '원 기록이 확인 완료 상태가 아닙니다.');
        const plan = planData(planSnapshot);
        const exported = exportSnapshot.exists && isUnknownRecord(exportSnapshot.data()) ? exportSnapshot.data() as UnknownRecord : {};
        assertPlanBindingUnchanged(current, planId, plan, exported);
        if (!hasCentralAccess(actor) && current.createdBy !== actor.uid) throw new functions.https.HttpsError('permission-denied', '정정 권한이 없습니다.');
        const timestamp = new Date().toISOString();
        const next: UnknownRecord = {
            ...current,
            id: nextRef.id,
            rootRecordId: current.rootRecordId || current.id,
            recordRevision: Number(current.recordRevision) + 1,
            supersedesRecordId: current.id,
            correctionReason: parsed.reason,
            supersededConfirmationHash: current.confirmationHash,
            correctionLineage: {
                supersedesRecordId: current.id,
                sourceConfirmationHash: current.confirmationHash,
                reason: parsed.reason,
                actorId: actor.uid,
                ...(actor.name ? { actorName: actor.name } : {}),
                createdAt: timestamp,
            },
            status: 'incomplete',
            version: 1,
            createdBy: actor.uid,
            ...(actor.name ? { createdByName: actor.name } : {}),
            createdAt: timestamp,
            updatedBy: actor.uid,
            ...(actor.name ? { updatedByName: actor.name } : {}),
            updatedAt: timestamp,
        };
        ['confirmationHash', 'confirmedBy', 'confirmedByName', 'confirmedAt'].forEach((key) => { delete next[key]; });
        const response: UnknownRecord = { schemaVersion: 1, record: next, idempotent: false };
        transaction.create(nextRef, next);
        transaction.create(eventRef, audit(actor, next, 'execution_record_correction_created', timestamp, {
            supersedesRecordId: current.id,
            sourceConfirmationHash: current.confirmationHash,
            reason: parsed.reason,
        }));
        createClaim(transaction, claimRef, actor, operation, requestFingerprint, response, timestamp);
        return response;
    });
};

const generateAppendixPdf = async (data: unknown, context: functions.https.CallableContext): Promise<UnknownRecord> => {
    const actor = await resolveExecutionRecordActor(context);
    const request = callableRecord(data);
    exactKeys(request, ['recordId', 'idempotencyKey']);
    const parsed = { recordId: id(request, 'recordId'), idempotencyKey: idempotencyKey(request) };
    const operation = 'generate_execution_record_appendix_pdf';
    const claimRef = mutationClaimRef(actor.uid, operation, parsed.idempotencyKey);
    const requestFingerprint = fingerprint(actor.uid, operation, parsed as unknown as UnknownRecord);
    const early = claimResponse(await claimRef.get(), operation, requestFingerprint);
    if (early) return early;
    const recordRef = executionRecordDb().collection(CONSTRUCTION_PLAN_RECORDS_COLLECTION).doc(parsed.recordId);
    const record = executionRecordData(await recordRef.get());
    if (record.status !== 'confirmed') throw new functions.https.HttpsError('failed-precondition', '확인 완료 기록만 PDF로 만들 수 있습니다.');
    const planId = String(record.planId);
    const planContext = await loadIssuedPlanRecordContext(planId);
    assertRecordReadAccess(record, planContext.plan, actor);
    assertPlanBindingUnchanged(record, planId, planContext.plan, planContext.exportRecord);
    catalogFromExecutionRecord(record);
    const photoBytes = new Map<string, Buffer>();
    for (const photo of (Array.isArray(record.photos) ? record.photos : []) as ConstructionPlanRecordPhoto[]) {
        const file = executionRecordBucket().file(photo.storagePath);
        const [[bytes], [metadata]] = await Promise.all([file.download(), file.getMetadata()]);
        if (String(metadata.generation || '') !== photo.storageGeneration || sha256Hex(bytes) !== photo.sha256) {
            throw new functions.https.HttpsError('data-loss', `현장사진 ${photo.id} 불변 바인딩이 일치하지 않습니다.`);
        }
        photoBytes.set(photo.id, bytes);
    }
    const artifact = await renderConfirmedConstructionPlanRecordPdf(record, photoBytes);
    const stored = await storeImmutableExecutionRecordPdf(executionRecordBucket(), record, artifact);
    const exportId = `record-appendix-${artifact.sha256.slice(0, 32)}`;
    const exportRef = executionRecordDb().collection(CONSTRUCTION_PLAN_RECORD_EXPORTS_COLLECTION).doc(exportId);
    const eventRef = executionRecordDb().collection(AUDIT_COLLECTION).doc();
    return executionRecordDb().runTransaction(async (transaction) => {
        const planRef = executionRecordDb().collection(PLANS_COLLECTION).doc(planId);
        const issuedExportRef = planRef.collection('exports').doc(planContext.exportId);
        const [claimSnapshot, recordSnapshot, planSnapshot, issuedSnapshot, existingExport] = await Promise.all([
            transaction.get(claimRef), transaction.get(recordRef), transaction.get(planRef),
            transaction.get(issuedExportRef), transaction.get(exportRef),
        ]);
        const replay = claimResponse(claimSnapshot, operation, requestFingerprint);
        if (replay) return replay;
        const current = executionRecordData(recordSnapshot);
        const plan = planData(planSnapshot);
        const issued = issuedSnapshot.exists && isUnknownRecord(issuedSnapshot.data()) ? issuedSnapshot.data() as UnknownRecord : {};
        assertPlanBindingUnchanged(current, planId, plan, issued);
        assertRecordReadAccess(current, plan, actor);
        if (current.status !== 'confirmed' || current.confirmationHash !== artifact.sourceRecordHash) {
            throw new functions.https.HttpsError('aborted', 'PDF 생성 중 실행기록이 변경되었습니다.');
        }
        const timestamp = new Date().toISOString();
        const exportRecord: UnknownRecord = {
            schemaVersion: 1, id: exportId, kind: 'record_appendix', status: 'ready', immutable: true,
            recordId: current.id, rootRecordId: current.rootRecordId, recordRevision: current.recordRevision,
            planId, siteId: current.siteId, issuedExportId: current.planBinding?.['issuedExportId'],
            issuedExportSha256: current.planBinding?.['issuedExportSha256'], ...stored,
            generatedBy: actor.uid, ...(actor.name ? { generatedByName: actor.name } : {}), generatedAt: timestamp,
        };
        if (existingExport.exists && canonicalStringify(existingExport.data()) !== canonicalStringify(exportRecord)) {
            throw new functions.https.HttpsError('data-loss', '부록 PDF export ID 충돌이 발생했습니다.');
        }
        if (!existingExport.exists) transaction.create(exportRef, exportRecord);
        const response: UnknownRecord = { schemaVersion: 1, recordId: current.id, export: exportRecord, idempotent: false };
        transaction.create(eventRef, audit(actor, current, 'execution_record_appendix_generated', timestamp, { exportId, sha256: artifact.sha256 }));
        createClaim(transaction, claimRef, actor, operation, requestFingerprint, response, timestamp);
        return response;
    });
};

export const listConstructionPlanRecordsServer = runner.https.onCall(listRecords);
export const getConstructionPlanRecordServer = runner.https.onCall(getRecord);
export const createConstructionPlanRecordServer = runner.https.onCall(createRecord);
export const updateConstructionPlanRecordServer = runner.https.onCall(updateRecord);
export const confirmConstructionPlanRecordServer = runner.https.onCall(confirmRecord);
export const createConstructionPlanRecordCorrectionServer = runner.https.onCall(createCorrection);
export const generateConstructionPlanRecordAppendixPdfServer = pdfRunner.https.onCall(generateAppendixPdf);
