import { createHash } from 'node:crypto';
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';
import {
    classifyConstructionPlanRoleAccess,
    isUnknownRecord,
    readTrimmedString,
    type UnknownRecord,
} from './domain';
import { getConstructionPlanFieldUseTemplateBundleHash } from './fieldUsePdfRenderer';
import {
    SYSTEM_SCAFFOLD_SERVER_TEMPLATE,
    SYSTEM_SHORING_SERVER_TEMPLATE,
    resolveConstructionPlanServerTemplate,
    type ConstructionPlanServerTemplateContract,
    type ConstructionPlanTradeType,
} from './templateContracts';

const TEMPLATES_COLLECTION = 'constructionPlanTemplates';
const MUTATION_KEYS_COLLECTION = 'constructionPlanMutationKeys';
const AUDIT_COLLECTION = 'constructionPlanAuditEvents';
const USERS_COLLECTION = 'users';
const TEMPLATE_RECORD_SCHEMA_VERSION = 1;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export const CONSTRUCTION_PLAN_TEMPLATE_LIFECYCLES = [
    'draft',
    'in_review',
    'published',
    'retired',
] as const;

export type ConstructionPlanTemplateLifecycle =
    typeof CONSTRUCTION_PLAN_TEMPLATE_LIFECYCLES[number];
export type ConstructionPlanTemplateListLifecycle =
    ConstructionPlanTemplateLifecycle | 'uninitialized';

export interface ConstructionPlanTemplateIdentity {
    tradeType: ConstructionPlanTradeType;
    templateId: string;
    templateVersion: string;
}

interface TemplateActor {
    uid: string;
    name?: string;
    canManage: boolean;
}

interface InitializeTemplateRequest extends ConstructionPlanTemplateIdentity {
    reason: string;
    idempotencyKey: string;
}

interface TransitionTemplateRequest extends ConstructionPlanTemplateIdentity {
    toLifecycle: ConstructionPlanTemplateLifecycle;
    expectedLifecycleVersion: number;
    reason: string;
    idempotencyKey: string;
}

export interface ConstructionPlanTemplateLifecycleRecord extends ConstructionPlanTemplateIdentity {
    schemaVersion: 1;
    id: string;
    key: string;
    name: string;
    rendererVersion: string;
    pageCount: number;
    manifest: ConstructionPlanServerTemplateContract;
    manifestHash: string;
    templateBundleHash: string;
    lifecycle: ConstructionPlanTemplateLifecycle;
    lifecycleVersion: number;
    isLatest: boolean;
    publishedFingerprint?: string;
    createdAt: string;
    createdBy: string;
    createdByName?: string;
    updatedAt: string;
    updatedBy: string;
    updatedByName?: string;
    reviewRequestedAt?: string;
    reviewRequestedBy?: string;
    publishedAt?: string;
    publishedBy?: string;
    publishedReason?: string;
    retiredAt?: string;
    retiredBy?: string;
    retiredReason?: string;
    lastTransitionReason: string;
}

export interface ConstructionPlanTemplateListItem extends ConstructionPlanTemplateIdentity {
    schemaVersion: 1;
    id: string;
    key: string;
    name: string;
    rendererVersion: string;
    pageCount: number;
    manifestHash: string;
    templateBundleHash: string;
    initialized: boolean;
    lifecycle: ConstructionPlanTemplateListLifecycle;
    lifecycleVersion: number;
    isLatest: boolean;
    selectableForNewPlan: boolean;
    createdAt?: string;
    createdBy?: string;
    createdByName?: string;
    updatedAt?: string;
    updatedBy?: string;
    updatedByName?: string;
    reviewRequestedAt?: string;
    reviewRequestedBy?: string;
    publishedAt?: string;
    publishedBy?: string;
    retiredAt?: string;
    retiredBy?: string;
    lastTransitionReason?: string;
}

export interface ConstructionPlanTemplateMutationResponse {
    schemaVersion: 1;
    template: ConstructionPlanTemplateListItem;
    affectedTemplateKeys: string[];
    idempotent: boolean;
}

const runner = functions
    .runWith({ timeoutSeconds: 60, memory: '512MB', maxInstances: 10 })
    .region('asia-northeast3');

const db = () => admin.firestore();

const canonicalJson = (value: unknown): string => {
    if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
    if (isUnknownRecord(value)) {
        return `{${Object.keys(value).sort().map((key) => (
            `${JSON.stringify(key)}:${canonicalJson(value[key])}`
        )).join(',')}}`;
    }
    return JSON.stringify(value) ?? 'null';
};

const sha256 = (value: string | Buffer): string =>
    createHash('sha256').update(value).digest('hex');

const templateKey = (identity: ConstructionPlanTemplateIdentity): string =>
    `${identity.tradeType}:${identity.templateId}@${identity.templateVersion}`;

export const constructionPlanTemplateDocumentId = (
    identity: ConstructionPlanTemplateIdentity,
): string => `tpl_${sha256(templateKey(identity)).slice(0, 40)}`;

const cloneManifest = (
    contract: ConstructionPlanServerTemplateContract,
): ConstructionPlanServerTemplateContract => ({
    tradeType: contract.tradeType,
    templateId: contract.templateId,
    templateVersion: contract.templateVersion,
    rendererVersion: contract.rendererVersion,
    schemaVersion: contract.schemaVersion,
    pageCount: contract.pageCount,
    riskAssessmentPolicy: {
        ...contract.riskAssessmentPolicy,
        thresholds: contract.riskAssessmentPolicy.thresholds.map((threshold) => ({ ...threshold })),
        acceptance: {
            ...contract.riskAssessmentPolicy.acceptance,
            blockedResidualLevels: [...contract.riskAssessmentPolicy.acceptance.blockedResidualLevels],
        },
        reviewTriggers: [...contract.riskAssessmentPolicy.reviewTriggers],
    },
    pages: contract.pages.map((page) => ({
        pageNumber: page.pageNumber,
        sectionKey: page.sectionKey,
        required: page.required,
        title: page.title,
        drawingSlots: [...page.drawingSlots],
    })),
});

const templateDisplayName = (tradeType: ConstructionPlanTradeType): string =>
    tradeType === 'system-scaffold'
        ? '시스템비계 시공계획서 표준'
        : '시스템동바리 시공계획서 표준';

export const constructionPlanTemplateManifestHash = (
    contract: ConstructionPlanServerTemplateContract,
): string => sha256(canonicalJson(cloneManifest(contract)));

const KNOWN_CONTRACTS: readonly ConstructionPlanServerTemplateContract[] = [
    SYSTEM_SHORING_SERVER_TEMPLATE,
    SYSTEM_SCAFFOLD_SERVER_TEMPLATE,
];

export interface KnownConstructionPlanTemplateDefinition extends ConstructionPlanTemplateIdentity {
    id: string;
    key: string;
    name: string;
    rendererVersion: string;
    pageCount: number;
    manifest: ConstructionPlanServerTemplateContract;
    manifestHash: string;
    templateBundleHash: string;
}

export const getKnownConstructionPlanTemplateDefinitions = (
    templateBundleHash = getConstructionPlanFieldUseTemplateBundleHash(),
): KnownConstructionPlanTemplateDefinition[] => KNOWN_CONTRACTS.map((contract) => {
    const manifest = cloneManifest(contract);
    const identity: ConstructionPlanTemplateIdentity = {
        tradeType: contract.tradeType,
        templateId: contract.templateId,
        templateVersion: contract.templateVersion,
    };
    return {
        ...identity,
        id: constructionPlanTemplateDocumentId(identity),
        key: templateKey(identity),
        name: templateDisplayName(identity.tradeType),
        rendererVersion: contract.rendererVersion,
        pageCount: contract.pageCount,
        manifest,
        manifestHash: constructionPlanTemplateManifestHash(contract),
        templateBundleHash,
    };
});

const definitionForIdentity = (
    identity: ConstructionPlanTemplateIdentity,
): KnownConstructionPlanTemplateDefinition => {
    let contract: ConstructionPlanServerTemplateContract;
    try {
        contract = resolveConstructionPlanServerTemplate(identity);
    } catch {
        throw new functions.https.HttpsError(
            'invalid-argument',
            '서버에 등록되지 않은 시공계획서 템플릿입니다.',
        );
    }
    const templateBundleHash = getConstructionPlanFieldUseTemplateBundleHash();
    const definition = getKnownConstructionPlanTemplateDefinitions(templateBundleHash)
        .find((candidate) => candidate.tradeType === contract.tradeType
            && candidate.templateId === contract.templateId
            && candidate.templateVersion === contract.templateVersion);
    if (!definition) {
        throw new functions.https.HttpsError('internal', '서버 템플릿 레지스트리가 일치하지 않습니다.');
    }
    return definition;
};

export const constructionPlanTemplatePublishedFingerprint = (
    definition: Pick<KnownConstructionPlanTemplateDefinition,
        'key' | 'manifestHash' | 'templateBundleHash' | 'rendererVersion' | 'pageCount'>,
): string => sha256(canonicalJson({
    key: definition.key,
    manifestHash: definition.manifestHash,
    templateBundleHash: definition.templateBundleHash,
    rendererVersion: definition.rendererVersion,
    pageCount: definition.pageCount,
}));

const lifecycleValue = (value: unknown): value is ConstructionPlanTemplateLifecycle =>
    CONSTRUCTION_PLAN_TEMPLATE_LIFECYCLES.includes(value as ConstructionPlanTemplateLifecycle);

const exactString = (record: UnknownRecord, key: string, maxLength: number): string => {
    const value = readTrimmedString(record, [key]);
    if (!value || value.length > maxLength) {
        throw new functions.https.HttpsError('invalid-argument', `${key} 값이 올바르지 않습니다.`);
    }
    return value;
};

const callableRecord = (value: unknown): UnknownRecord => {
    if (!isUnknownRecord(value)) {
        throw new functions.https.HttpsError('invalid-argument', '템플릿 관리 요청이 올바르지 않습니다.');
    }
    return value;
};

const assertExactRequestKeys = (
    record: UnknownRecord,
    allowedKeys: readonly string[],
): void => {
    const allowed = new Set(allowedKeys);
    if (Object.keys(record).some((key) => !allowed.has(key))) {
        throw new functions.https.HttpsError(
            'invalid-argument',
            '템플릿 관리 요청에 허용되지 않은 필드가 있습니다.',
        );
    }
};

const parseIdentity = (record: UnknownRecord): ConstructionPlanTemplateIdentity => {
    const tradeType = exactString(record, 'tradeType', 80);
    const templateId = exactString(record, 'templateId', 160);
    const templateVersion = exactString(record, 'templateVersion', 80);
    if (tradeType !== 'system-shoring' && tradeType !== 'system-scaffold') {
        throw new functions.https.HttpsError('invalid-argument', 'tradeType 값이 올바르지 않습니다.');
    }
    const identity: ConstructionPlanTemplateIdentity = { tradeType, templateId, templateVersion };
    definitionForIdentity(identity);
    return identity;
};

const parseReason = (record: UnknownRecord): string => {
    const reason = exactString(record, 'reason', 500);
    if (reason.length < 5) {
        throw new functions.https.HttpsError('invalid-argument', '전이 사유를 5자 이상 입력해야 합니다.');
    }
    return reason;
};

const parseIdempotencyKey = (record: UnknownRecord): string => {
    const value = exactString(record, 'idempotencyKey', 128);
    if (!IDEMPOTENCY_KEY_PATTERN.test(value)) {
        throw new functions.https.HttpsError('invalid-argument', 'idempotencyKey 값이 올바르지 않습니다.');
    }
    return value;
};

const parseInitializeRequest = (value: unknown): InitializeTemplateRequest => {
    const record = callableRecord(value);
    assertExactRequestKeys(record, [
        'tradeType', 'templateId', 'templateVersion', 'reason', 'idempotencyKey',
    ]);
    return {
        ...parseIdentity(record),
        reason: parseReason(record),
        idempotencyKey: parseIdempotencyKey(record),
    };
};

const parseTransitionRequest = (value: unknown): TransitionTemplateRequest => {
    const record = callableRecord(value);
    assertExactRequestKeys(record, [
        'tradeType', 'templateId', 'templateVersion', 'toLifecycle',
        'expectedLifecycleVersion', 'reason', 'idempotencyKey',
    ]);
    const toLifecycle = record.toLifecycle;
    const expectedLifecycleVersion = Number(record.expectedLifecycleVersion);
    if (!lifecycleValue(toLifecycle)) {
        throw new functions.https.HttpsError('invalid-argument', 'toLifecycle 값이 올바르지 않습니다.');
    }
    if (!Number.isInteger(expectedLifecycleVersion) || expectedLifecycleVersion < 1) {
        throw new functions.https.HttpsError(
            'invalid-argument',
            'expectedLifecycleVersion 값이 올바르지 않습니다.',
        );
    }
    return {
        ...parseIdentity(record),
        toLifecycle,
        expectedLifecycleVersion,
        reason: parseReason(record),
        idempotencyKey: parseIdempotencyKey(record),
    };
};

const roleStrings = (value: unknown): string[] => {
    if (Array.isArray(value)) return value.flatMap(roleStrings);
    return typeof value === 'string' && value.trim() ? [value.trim().toLowerCase()] : [];
};

const TEMPLATE_ADMIN_ROLE_ALIASES = new Set([
    'template_admin',
    'construction_plan_template_admin',
    'construction-plan-template-admin',
    '템플릿관리자',
    '표준템플릿관리자',
]);

const resolveActor = async (
    context: functions.https.CallableContext,
): Promise<TemplateActor> => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', '로그인이 필요합니다.');
    }
    const token = isUnknownRecord(context.auth.token) ? context.auth.token : {};
    const profileSnapshot = await db().collection(USERS_COLLECTION).doc(context.auth.uid).get();
    const profile = profileSnapshot.exists && isUnknownRecord(profileSnapshot.data())
        ? profileSnapshot.data() as UnknownRecord
        : {};
    const roleFields = [
        'role', 'position', 'systemRole', 'accountType',
        'roles', 'additionalPositions', 'erpRoleGroups',
    ];
    const roleValues = roleFields.flatMap((key) => [token[key], profile[key]]);
    const access = classifyConstructionPlanRoleAccess(roleValues);
    const roles = new Set(roleValues.flatMap(roleStrings));
    return {
        uid: context.auth.uid,
        ...(readTrimmedString(profile, ['name', 'displayName'])
            || readTrimmedString(token, ['name'])
            ? {
                name: readTrimmedString(profile, ['name', 'displayName'])
                    || readTrimmedString(token, ['name']),
            }
            : {}),
        canManage: access.canReviewApproveIssue
            || Array.from(roles).some((role) => TEMPLATE_ADMIN_ROLE_ALIASES.has(role)),
    };
};

const requireManageAccess = (actor: TemplateActor): void => {
    if (!actor.canManage) {
        throw new functions.https.HttpsError(
            'permission-denied',
            '본사 또는 표준 템플릿 관리자 권한이 필요합니다.',
        );
    }
};

const TEMPLATE_RECORD_KEYS = new Set([
    'schemaVersion', 'id', 'key', 'name', 'tradeType', 'templateId', 'templateVersion',
    'rendererVersion', 'pageCount', 'manifest', 'manifestHash', 'templateBundleHash',
    'lifecycle', 'lifecycleVersion', 'isLatest', 'publishedFingerprint',
    'createdAt', 'createdBy', 'createdByName', 'updatedAt', 'updatedBy', 'updatedByName',
    'reviewRequestedAt', 'reviewRequestedBy', 'publishedAt', 'publishedBy', 'publishedReason',
    'retiredAt', 'retiredBy', 'retiredReason', 'lastTransitionReason',
]);

const corruptRecord = (definition: KnownConstructionPlanTemplateDefinition): never => {
    throw new functions.https.HttpsError(
        'data-loss',
        `표준 템플릿 레코드가 서버 계약과 일치하지 않습니다: ${definition.key}`,
    );
};

const parseStoredRecord = (
    value: unknown,
    definition: KnownConstructionPlanTemplateDefinition,
): ConstructionPlanTemplateLifecycleRecord => {
    if (!isUnknownRecord(value)
        || Object.keys(value).some((key) => !TEMPLATE_RECORD_KEYS.has(key))
        || value.schemaVersion !== TEMPLATE_RECORD_SCHEMA_VERSION
        || value.id !== definition.id
        || value.key !== definition.key
        || value.name !== definition.name
        || value.tradeType !== definition.tradeType
        || value.templateId !== definition.templateId
        || value.templateVersion !== definition.templateVersion
        || value.rendererVersion !== definition.rendererVersion
        || value.pageCount !== definition.pageCount
        || value.manifestHash !== definition.manifestHash
        || value.templateBundleHash !== definition.templateBundleHash
        || canonicalJson(value.manifest) !== canonicalJson(definition.manifest)
        || !lifecycleValue(value.lifecycle)
        || !Number.isInteger(value.lifecycleVersion)
        || Number(value.lifecycleVersion) < 1
        || typeof value.isLatest !== 'boolean'
        || (value.isLatest === true && value.lifecycle !== 'published')
        || !readTrimmedString(value, ['createdAt'])
        || !readTrimmedString(value, ['createdBy'])
        || !readTrimmedString(value, ['updatedAt'])
        || !readTrimmedString(value, ['updatedBy'])
        || !readTrimmedString(value, ['lastTransitionReason'])) {
        return corruptRecord(definition);
    }
    if ((value.lifecycle === 'published' || value.lifecycle === 'retired')
        && (value.publishedFingerprint !== constructionPlanTemplatePublishedFingerprint(definition)
            || !readTrimmedString(value, ['publishedAt'])
            || !readTrimmedString(value, ['publishedBy'])
            || !readTrimmedString(value, ['publishedReason']))) {
        return corruptRecord(definition);
    }
    if (value.lifecycle === 'retired'
        && (!readTrimmedString(value, ['retiredAt'])
            || !readTrimmedString(value, ['retiredBy'])
            || !readTrimmedString(value, ['retiredReason']))) {
        return corruptRecord(definition);
    }
    return value as unknown as ConstructionPlanTemplateLifecycleRecord;
};

const listItem = (
    definition: KnownConstructionPlanTemplateDefinition,
    record?: ConstructionPlanTemplateLifecycleRecord,
): ConstructionPlanTemplateListItem => ({
    schemaVersion: 1,
    id: definition.id,
    key: definition.key,
    name: definition.name,
    tradeType: definition.tradeType,
    templateId: definition.templateId,
    templateVersion: definition.templateVersion,
    rendererVersion: definition.rendererVersion,
    pageCount: definition.pageCount,
    manifestHash: definition.manifestHash,
    templateBundleHash: definition.templateBundleHash,
    initialized: Boolean(record),
    lifecycle: record?.lifecycle ?? 'uninitialized',
    lifecycleVersion: record?.lifecycleVersion ?? 0,
    isLatest: record?.isLatest ?? false,
    selectableForNewPlan: record?.lifecycle === 'published',
    ...(record?.createdAt ? { createdAt: record.createdAt } : {}),
    ...(record?.createdBy ? { createdBy: record.createdBy } : {}),
    ...(record?.createdByName ? { createdByName: record.createdByName } : {}),
    ...(record?.updatedAt ? { updatedAt: record.updatedAt } : {}),
    ...(record?.updatedBy ? { updatedBy: record.updatedBy } : {}),
    ...(record?.updatedByName ? { updatedByName: record.updatedByName } : {}),
    ...(record?.reviewRequestedAt ? { reviewRequestedAt: record.reviewRequestedAt } : {}),
    ...(record?.reviewRequestedBy ? { reviewRequestedBy: record.reviewRequestedBy } : {}),
    ...(record?.publishedAt ? { publishedAt: record.publishedAt } : {}),
    ...(record?.publishedBy ? { publishedBy: record.publishedBy } : {}),
    ...(record?.retiredAt ? { retiredAt: record.retiredAt } : {}),
    ...(record?.retiredBy ? { retiredBy: record.retiredBy } : {}),
    ...(record?.lastTransitionReason ? { lastTransitionReason: record.lastTransitionReason } : {}),
});

const assertLatestInvariant = (
    templates: readonly ConstructionPlanTemplateListItem[],
): void => {
    (['system-shoring', 'system-scaffold'] as const).forEach((tradeType) => {
        const tradeTemplates = templates.filter((template) => template.tradeType === tradeType);
        const latest = tradeTemplates.filter((template) => template.isLatest);
        const published = tradeTemplates.filter((template) => template.lifecycle === 'published');
        if (latest.length > 1
            || latest.some((template) => template.lifecycle !== 'published')
            || (published.length > 0 && latest.length !== 1)) {
            throw new functions.https.HttpsError(
                'data-loss',
                `${templateDisplayName(tradeType)} 최신 게시본 상태가 올바르지 않습니다.`,
            );
        }
    });
};

export const isConstructionPlanTemplateTransitionAllowed = (
    from: ConstructionPlanTemplateLifecycle,
    to: ConstructionPlanTemplateLifecycle,
): boolean => (
    (from === 'draft' && to === 'in_review')
    || (from === 'in_review' && (to === 'draft' || to === 'published'))
    || (from === 'published' && to === 'retired')
);

export const selectLatestPublishedConstructionPlanTemplateKey = (
    records: readonly Pick<ConstructionPlanTemplateLifecycleRecord,
        'key' | 'templateVersion' | 'lifecycle'>[],
): string | undefined => [...records]
    .filter((record) => record.lifecycle === 'published')
    .sort((left, right) => right.templateVersion.localeCompare(
        left.templateVersion,
        undefined,
        { numeric: true, sensitivity: 'base' },
    ))[0]?.key;

const mutationClaimRef = (
    actorId: string,
    operation: string,
    idempotencyKey: string,
): admin.firestore.DocumentReference => db().collection(MUTATION_KEYS_COLLECTION).doc(
    `template_${sha256(canonicalJson({ actorId, operation, idempotencyKey }))}`,
);

const requestFingerprint = (
    actorId: string,
    operation: string,
    request: InitializeTemplateRequest | TransitionTemplateRequest,
): string => {
    const { idempotencyKey: _idempotencyKey, ...payload } = request;
    return sha256(canonicalJson({ actorId, operation, payload }));
};

const readClaimResponse = (
    snapshot: admin.firestore.DocumentSnapshot,
    operation: string,
    fingerprint: string,
): ConstructionPlanTemplateMutationResponse | undefined => {
    if (!snapshot.exists) return undefined;
    const claim = snapshot.data();
    if (!isUnknownRecord(claim)
        || claim.scope !== 'construction-plan-template'
        || claim.operation !== operation
        || claim.requestFingerprint !== fingerprint
        || !isUnknownRecord(claim.response)
        || !isUnknownRecord(claim.response.template)
        || !Array.isArray(claim.response.affectedTemplateKeys)) {
        if (isUnknownRecord(claim)
            && claim.scope === 'construction-plan-template'
            && claim.operation === operation
            && claim.requestFingerprint !== fingerprint) {
            throw new functions.https.HttpsError(
                'already-exists',
                '같은 idempotencyKey가 다른 템플릿 요청에 이미 사용되었습니다.',
            );
        }
        throw new functions.https.HttpsError('data-loss', '템플릿 멱등성 기록이 손상되었습니다.');
    }
    return {
        ...(claim.response as unknown as ConstructionPlanTemplateMutationResponse),
        idempotent: true,
    };
};

const auditEvent = (
    actor: TemplateActor,
    definition: KnownConstructionPlanTemplateDefinition,
    input: {
        action: 'template_initialized' | 'template_transitioned';
        fromLifecycle: ConstructionPlanTemplateListLifecycle;
        toLifecycle: ConstructionPlanTemplateLifecycle;
        reason: string;
        affectedTemplateKeys: string[];
        at: string;
    },
): UnknownRecord => ({
    schemaVersion: 1,
    entityType: 'construction-plan-template',
    templateId: definition.templateId,
    templateVersion: definition.templateVersion,
    templateKey: definition.key,
    tradeType: definition.tradeType,
    type: input.action,
    action: input.action,
    fromLifecycle: input.fromLifecycle,
    toLifecycle: input.toLifecycle,
    reason: input.reason,
    affectedTemplateKeys: input.affectedTemplateKeys,
    manifestHash: definition.manifestHash,
    templateBundleHash: definition.templateBundleHash,
    actorId: actor.uid,
    ...(actor.name ? { actorName: actor.name } : {}),
    at: input.at,
    createdAt: input.at,
});

const listTemplates = async (
    data: unknown,
    context: functions.https.CallableContext,
): Promise<UnknownRecord> => {
    const actor = await resolveActor(context);
    const request = callableRecord(data);
    assertExactRequestKeys(request, []);
    const definitions = getKnownConstructionPlanTemplateDefinitions();
    const snapshots = await db().getAll(...definitions.map((definition) => (
        db().collection(TEMPLATES_COLLECTION).doc(definition.id)
    )));
    const templates = definitions.map((definition, index) => {
        const snapshot = snapshots[index];
        return listItem(
            definition,
            snapshot.exists ? parseStoredRecord(snapshot.data(), definition) : undefined,
        );
    });
    assertLatestInvariant(templates);
    return {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        canManage: actor.canManage,
        templates,
    };
};

const initializeTemplate = async (
    data: unknown,
    context: functions.https.CallableContext,
): Promise<ConstructionPlanTemplateMutationResponse> => {
    const actor = await resolveActor(context);
    requireManageAccess(actor);
    const request = parseInitializeRequest(data);
    const definition = definitionForIdentity(request);
    const operation = 'initialize_construction_plan_template';
    const fingerprint = requestFingerprint(actor.uid, operation, request);
    const claimRef = mutationClaimRef(actor.uid, operation, request.idempotencyKey);
    const templateRef = db().collection(TEMPLATES_COLLECTION).doc(definition.id);
    const eventRef = db().collection(AUDIT_COLLECTION).doc();

    return db().runTransaction(async (transaction) => {
        const [claimSnapshot, templateSnapshot] = await Promise.all([
            transaction.get(claimRef),
            transaction.get(templateRef),
        ]);
        const replay = readClaimResponse(claimSnapshot, operation, fingerprint);
        if (replay) return replay;
        if (templateSnapshot.exists) {
            parseStoredRecord(templateSnapshot.data(), definition);
            throw new functions.https.HttpsError(
                'already-exists',
                '이미 초기화된 표준 템플릿입니다.',
            );
        }
        const timestamp = new Date().toISOString();
        const record: ConstructionPlanTemplateLifecycleRecord = {
            schemaVersion: 1,
            id: definition.id,
            key: definition.key,
            name: definition.name,
            tradeType: definition.tradeType,
            templateId: definition.templateId,
            templateVersion: definition.templateVersion,
            rendererVersion: definition.rendererVersion,
            pageCount: definition.pageCount,
            manifest: definition.manifest,
            manifestHash: definition.manifestHash,
            templateBundleHash: definition.templateBundleHash,
            lifecycle: 'draft',
            lifecycleVersion: 1,
            isLatest: false,
            createdAt: timestamp,
            createdBy: actor.uid,
            ...(actor.name ? { createdByName: actor.name } : {}),
            updatedAt: timestamp,
            updatedBy: actor.uid,
            ...(actor.name ? { updatedByName: actor.name } : {}),
            lastTransitionReason: request.reason,
        };
        const response: ConstructionPlanTemplateMutationResponse = {
            schemaVersion: 1,
            template: listItem(definition, record),
            affectedTemplateKeys: [definition.key],
            idempotent: false,
        };
        transaction.create(templateRef, record as unknown as admin.firestore.DocumentData);
        transaction.create(claimRef, {
            scope: 'construction-plan-template',
            operation,
            actorId: actor.uid,
            requestFingerprint: fingerprint,
            response,
            createdAt: timestamp,
        });
        transaction.create(eventRef, auditEvent(actor, definition, {
            action: 'template_initialized',
            fromLifecycle: 'uninitialized',
            toLifecycle: 'draft',
            reason: request.reason,
            affectedTemplateKeys: [definition.key],
            at: timestamp,
        }));
        return response;
    });
};

const transitionTemplate = async (
    data: unknown,
    context: functions.https.CallableContext,
): Promise<ConstructionPlanTemplateMutationResponse> => {
    const actor = await resolveActor(context);
    requireManageAccess(actor);
    const request = parseTransitionRequest(data);
    const definition = definitionForIdentity(request);
    const operation = 'transition_construction_plan_template';
    const fingerprint = requestFingerprint(actor.uid, operation, request);
    const claimRef = mutationClaimRef(actor.uid, operation, request.idempotencyKey);
    const definitions = getKnownConstructionPlanTemplateDefinitions(definition.templateBundleHash)
        .filter((candidate) => candidate.tradeType === definition.tradeType);
    const templateRefs = definitions.map((candidate) => (
        db().collection(TEMPLATES_COLLECTION).doc(candidate.id)
    ));
    const eventRef = db().collection(AUDIT_COLLECTION).doc();

    return db().runTransaction(async (transaction) => {
        const [claimSnapshot, ...templateSnapshots] = await Promise.all([
            transaction.get(claimRef),
            ...templateRefs.map((reference) => transaction.get(reference)),
        ]);
        const replay = readClaimResponse(claimSnapshot, operation, fingerprint);
        if (replay) return replay;

        const records = definitions.flatMap((candidate, index) => {
            const snapshot = templateSnapshots[index];
            return snapshot.exists ? [parseStoredRecord(snapshot.data(), candidate)] : [];
        });
        const current = records.find((record) => record.key === definition.key);
        if (!current) {
            throw new functions.https.HttpsError(
                'failed-precondition',
                '초기화되지 않은 표준 템플릿입니다.',
            );
        }
        if (current.lifecycleVersion !== request.expectedLifecycleVersion) {
            throw new functions.https.HttpsError(
                'aborted',
                '표준 템플릿 상태가 다른 작업에서 변경되었습니다. 목록을 새로고침하세요.',
            );
        }
        if (!isConstructionPlanTemplateTransitionAllowed(current.lifecycle, request.toLifecycle)) {
            throw new functions.https.HttpsError(
                'failed-precondition',
                `${current.lifecycle}에서 ${request.toLifecycle}(으)로 전환할 수 없습니다.`,
            );
        }

        const timestamp = new Date().toISOString();
        const affected = new Set<string>([definition.key]);
        const nextRecords = records.map((record) => ({ ...record }));
        const next = nextRecords.find((record) => record.key === definition.key);
        if (!next) throw new functions.https.HttpsError('internal', '템플릿 상태 전이를 준비하지 못했습니다.');

        next.lifecycle = request.toLifecycle;
        next.lifecycleVersion += 1;
        next.updatedAt = timestamp;
        next.updatedBy = actor.uid;
        if (actor.name) next.updatedByName = actor.name;
        next.lastTransitionReason = request.reason;

        if (request.toLifecycle === 'in_review') {
            next.reviewRequestedAt = timestamp;
            next.reviewRequestedBy = actor.uid;
            next.isLatest = false;
        } else if (request.toLifecycle === 'draft') {
            next.isLatest = false;
        } else if (request.toLifecycle === 'published') {
            next.isLatest = true;
            next.publishedFingerprint = constructionPlanTemplatePublishedFingerprint(definition);
            next.publishedAt = timestamp;
            next.publishedBy = actor.uid;
            next.publishedReason = request.reason;
            nextRecords.forEach((record) => {
                if (record.key !== next.key && record.isLatest) {
                    record.isLatest = false;
                    record.lifecycleVersion += 1;
                    record.updatedAt = timestamp;
                    record.updatedBy = actor.uid;
                    if (actor.name) record.updatedByName = actor.name;
                    record.lastTransitionReason = request.reason;
                    affected.add(record.key);
                }
            });
        } else if (request.toLifecycle === 'retired') {
            next.isLatest = false;
            next.retiredAt = timestamp;
            next.retiredBy = actor.uid;
            next.retiredReason = request.reason;
            const promotedKey = selectLatestPublishedConstructionPlanTemplateKey(nextRecords);
            if (promotedKey) {
                const promoted = nextRecords.find((record) => record.key === promotedKey);
                if (promoted && !promoted.isLatest) {
                    promoted.isLatest = true;
                    promoted.lifecycleVersion += 1;
                    promoted.updatedAt = timestamp;
                    promoted.updatedBy = actor.uid;
                    if (actor.name) promoted.updatedByName = actor.name;
                    promoted.lastTransitionReason = request.reason;
                    affected.add(promoted.key);
                }
            }
        }

        nextRecords.forEach((record) => {
            const candidateDefinition = definitions.find((candidate) => candidate.key === record.key);
            if (!candidateDefinition) return;
            const before = records.find((candidate) => candidate.key === record.key);
            if (!before || canonicalJson(before) !== canonicalJson(record)) {
                transaction.set(
                    db().collection(TEMPLATES_COLLECTION).doc(record.id),
                    record as unknown as admin.firestore.DocumentData,
                );
            }
        });

        const response: ConstructionPlanTemplateMutationResponse = {
            schemaVersion: 1,
            template: listItem(definition, next),
            affectedTemplateKeys: Array.from(affected).sort(),
            idempotent: false,
        };
        transaction.create(claimRef, {
            scope: 'construction-plan-template',
            operation,
            actorId: actor.uid,
            requestFingerprint: fingerprint,
            response,
            createdAt: timestamp,
        });
        transaction.create(eventRef, auditEvent(actor, definition, {
            action: 'template_transitioned',
            fromLifecycle: current.lifecycle,
            toLifecycle: request.toLifecycle,
            reason: request.reason,
            affectedTemplateKeys: response.affectedTemplateKeys,
            at: timestamp,
        }));
        return response;
    });
};

/**
 * Server-side guard for new-draft call paths. Existing plans remain renderable
 * by their exact code-registered identity even after the lifecycle is retired.
 */
export const requirePublishedConstructionPlanTemplateForNewDraft = async (
    identity: ConstructionPlanTemplateIdentity,
): Promise<ConstructionPlanTemplateLifecycleRecord> => {
    const definition = definitionForIdentity(identity);
    const snapshot = await db().collection(TEMPLATES_COLLECTION).doc(definition.id).get();
    return assertPublishedConstructionPlanTemplateSnapshotForNewDraft(
        identity,
        snapshot.exists ? snapshot.data() : undefined,
    );
};

export const constructionPlanTemplateDocumentReferenceForIdentity = (
    identity: ConstructionPlanTemplateIdentity,
): admin.firestore.DocumentReference => {
    const definition = definitionForIdentity(identity);
    return db().collection(TEMPLATES_COLLECTION).doc(definition.id);
};

/**
 * Transaction-safe new-draft decision. Callers must pass the lifecycle
 * snapshot read in the same transaction that creates the series and plan.
 */
export const assertPublishedConstructionPlanTemplateSnapshotForNewDraft = (
    identity: ConstructionPlanTemplateIdentity,
    snapshotData: unknown,
): ConstructionPlanTemplateLifecycleRecord => {
    const definition = definitionForIdentity(identity);
    if (snapshotData === undefined || snapshotData === null) {
        throw new functions.https.HttpsError(
            'failed-precondition',
            '게시된 표준 템플릿이 아닙니다. 템플릿 관리에서 먼저 게시하세요.',
        );
    }
    const record = parseStoredRecord(snapshotData, definition);
    if (record.lifecycle !== 'published') {
        throw new functions.https.HttpsError(
            'failed-precondition',
            record.lifecycle === 'retired'
                ? '폐기된 표준 템플릿으로 새 계획서를 만들 수 없습니다.'
                : '게시 완료된 표준 템플릿만 새 계획서에 사용할 수 있습니다.',
        );
    }
    return record;
};

/**
 * Existing bound plans remain reproducible after a template is retired, but
 * the stored lifecycle document must still match the code-registered exact
 * manifest and renderer bundle. Draft/in-review lifecycle records have never
 * been publish-authorized and therefore cannot validate an existing binding.
 */
export const assertConstructionPlanTemplateSnapshotForExistingPlan = (
    identity: ConstructionPlanTemplateIdentity,
    snapshotData: unknown,
): ConstructionPlanTemplateLifecycleRecord => {
    const definition = definitionForIdentity(identity);
    if (snapshotData === undefined || snapshotData === null) {
        throw new functions.https.HttpsError(
            'data-loss',
            '계획서에 바인딩된 표준 템플릿 lifecycle 레코드가 없습니다.',
        );
    }
    const record = parseStoredRecord(snapshotData, definition);
    if (record.lifecycle !== 'published' && record.lifecycle !== 'retired') {
        throw new functions.https.HttpsError(
            'data-loss',
            '계획서 템플릿은 게시 이력이 있는 불변 버전이어야 합니다.',
        );
    }
    return record;
};

export const listConstructionPlanTemplatesServer = runner.https.onCall(listTemplates);

export const initializeConstructionPlanTemplateServer = runner.https.onCall(initializeTemplate);

export const transitionConstructionPlanTemplateLifecycleServer = runner.https.onCall(
    transitionTemplate,
);
