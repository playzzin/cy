import * as functions from 'firebase-functions/v1';
import {
    canonicalStringify,
    isUnknownRecord,
    readTrimmedString,
    sha256Hex,
    type UnknownRecord,
} from './domain';
import {
    constructionPlanTemplatePublishedFingerprint,
    type ConstructionPlanTemplateIdentity,
    type ConstructionPlanTemplateLifecycleRecord,
} from './templateLifecycle';
import type { ConstructionPlanTradeType } from './templateContracts';

const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const ISO_INSTANT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const BINDING_KEYS = new Set([
    'schemaVersion',
    'templateRecordId',
    'templateKey',
    'tradeType',
    'templateId',
    'templateVersion',
    'rendererVersion',
    'logicalPageCount',
    'manifestHash',
    'templateBundleHash',
    'templateHash',
    'lifecycleVersionAtCapture',
    'publishedAt',
    'capturedAt',
]);

export interface ConstructionPlanTemplateBinding {
    schemaVersion: 1;
    templateRecordId: string;
    templateKey: string;
    tradeType: ConstructionPlanTradeType;
    templateId: string;
    templateVersion: string;
    rendererVersion: string;
    logicalPageCount: number;
    manifestHash: string;
    templateBundleHash: string;
    /**
     * Immutable published template fingerprint required by PRD 13.4. It is
     * deliberately distinct from a rendered PDF hash and from a plan content
     * snapshot hash.
     */
    templateHash: string;
    lifecycleVersionAtCapture: number;
    publishedAt: string;
    capturedAt: string;
}

const fail = (message: string): never => {
    throw new functions.https.HttpsError('data-loss', message);
};

const requiredString = (record: UnknownRecord, key: string, maximum = 500): string => {
    const value = readTrimmedString(record, [key]);
    if (!value || value.length > maximum) return fail(`템플릿 바인딩 ${key} 값이 손상되었습니다.`);
    return value;
};

const requiredSha256 = (record: UnknownRecord, key: string): string => {
    const value = requiredString(record, key, 64).toLowerCase();
    if (!SHA256_PATTERN.test(value)) return fail(`템플릿 바인딩 ${key} SHA-256이 손상되었습니다.`);
    return value;
};

const requiredInstant = (record: UnknownRecord, key: string): string => {
    const value = requiredString(record, key, 40);
    if (!ISO_INSTANT_PATTERN.test(value) || !Number.isFinite(Date.parse(value))) {
        return fail(`템플릿 바인딩 ${key} 시각이 손상되었습니다.`);
    }
    return value;
};

export const buildConstructionPlanTemplateBinding = (
    record: ConstructionPlanTemplateLifecycleRecord,
    capturedAt: string,
): ConstructionPlanTemplateBinding => {
    if (record.lifecycle !== 'published' || !record.publishedFingerprint || !record.publishedAt) {
        throw new functions.https.HttpsError(
            'failed-precondition',
            '게시 완료된 표준 템플릿만 계획서에 바인딩할 수 있습니다.',
        );
    }
    const expectedFingerprint = constructionPlanTemplatePublishedFingerprint(record);
    if (record.publishedFingerprint !== expectedFingerprint) {
        return fail('게시 템플릿 fingerprint가 서버 계약과 일치하지 않습니다.');
    }
    if (!ISO_INSTANT_PATTERN.test(capturedAt) || !Number.isFinite(Date.parse(capturedAt))) {
        throw new functions.https.HttpsError('invalid-argument', '템플릿 바인딩 수집 시각이 올바르지 않습니다.');
    }
    return {
        schemaVersion: 1,
        templateRecordId: record.id,
        templateKey: record.key,
        tradeType: record.tradeType,
        templateId: record.templateId,
        templateVersion: record.templateVersion,
        rendererVersion: record.rendererVersion,
        logicalPageCount: record.pageCount,
        manifestHash: record.manifestHash,
        templateBundleHash: record.templateBundleHash,
        templateHash: record.publishedFingerprint,
        lifecycleVersionAtCapture: record.lifecycleVersion,
        publishedAt: record.publishedAt,
        capturedAt,
    };
};

export const parseConstructionPlanTemplateBinding = (
    value: unknown,
): ConstructionPlanTemplateBinding => {
    if (!isUnknownRecord(value) || Object.keys(value).some((key) => !BINDING_KEYS.has(key))) {
        return fail('템플릿 바인딩 구조가 손상되었습니다.');
    }
    if (value.schemaVersion !== 1) return fail('지원하지 않는 템플릿 바인딩 schema입니다.');
    const tradeType = requiredString(value, 'tradeType', 80);
    if (tradeType !== 'system-shoring' && tradeType !== 'system-scaffold') {
        return fail('템플릿 바인딩 공종이 손상되었습니다.');
    }
    const logicalPageCount = Number(value.logicalPageCount);
    const lifecycleVersionAtCapture = Number(value.lifecycleVersionAtCapture);
    if (!Number.isInteger(logicalPageCount) || logicalPageCount !== 42
        || !Number.isInteger(lifecycleVersionAtCapture) || lifecycleVersionAtCapture < 1) {
        return fail('템플릿 바인딩 페이지 또는 lifecycle version이 손상되었습니다.');
    }
    return {
        schemaVersion: 1,
        templateRecordId: requiredString(value, 'templateRecordId', 240),
        templateKey: requiredString(value, 'templateKey', 500),
        tradeType,
        templateId: requiredString(value, 'templateId', 160),
        templateVersion: requiredString(value, 'templateVersion', 80),
        rendererVersion: requiredString(value, 'rendererVersion', 160),
        logicalPageCount,
        manifestHash: requiredSha256(value, 'manifestHash'),
        templateBundleHash: requiredSha256(value, 'templateBundleHash'),
        templateHash: requiredSha256(value, 'templateHash'),
        lifecycleVersionAtCapture,
        publishedAt: requiredInstant(value, 'publishedAt'),
        capturedAt: requiredInstant(value, 'capturedAt'),
    };
};

export const constructionPlanTemplateBindingHash = (
    binding: ConstructionPlanTemplateBinding,
): string => sha256Hex(canonicalStringify(parseConstructionPlanTemplateBinding(binding)));

export interface ConstructionPlanTemplateBindingProjection {
    templateHash: string;
    manifestHash: string;
    templateBundleHash: string;
    templateBindingHash: string;
}

/**
 * Denormalized immutable hashes used by Firestore queries, export jobs and
 * Storage custom metadata. The canonical binding remains the source of truth;
 * every projection is derived server-side from the strict parsed value.
 */
export const constructionPlanTemplateBindingProjection = (
    rawBinding: unknown,
): ConstructionPlanTemplateBindingProjection => {
    const binding = parseConstructionPlanTemplateBinding(rawBinding);
    return {
        templateHash: binding.templateHash,
        manifestHash: binding.manifestHash,
        templateBundleHash: binding.templateBundleHash,
        templateBindingHash: constructionPlanTemplateBindingHash(binding),
    };
};

export const constructionPlanTemplateIdentityFromBinding = (
    rawBinding: unknown,
): ConstructionPlanTemplateIdentity => {
    const binding = parseConstructionPlanTemplateBinding(rawBinding);
    return {
        tradeType: binding.tradeType,
        templateId: binding.templateId,
        templateVersion: binding.templateVersion,
    };
};

export const assertConstructionPlanTemplateBindingMatchesPlanIdentity = (
    rawBinding: unknown,
    rawPlan: unknown,
): ConstructionPlanTemplateBinding => {
    if (!isUnknownRecord(rawPlan)) return fail('계획서 템플릿 식별자가 손상되었습니다.');
    const binding = parseConstructionPlanTemplateBinding(rawBinding);
    if (binding.tradeType !== rawPlan.tradeType
        || binding.templateId !== rawPlan.templateId
        || binding.templateVersion !== rawPlan.templateVersion
        || binding.rendererVersion !== rawPlan.rendererVersion) {
        return fail('계획서 식별자와 게시 템플릿 바인딩이 일치하지 않습니다.');
    }
    return binding;
};

export const assertSameConstructionPlanTemplateBinding = (
    left: unknown,
    right: unknown,
): ConstructionPlanTemplateBinding => {
    const parsedLeft = parseConstructionPlanTemplateBinding(left);
    const parsedRight = parseConstructionPlanTemplateBinding(right);
    if (canonicalStringify(parsedLeft) !== canonicalStringify(parsedRight)) {
        return fail('계획서와 승인 스냅샷의 템플릿 바인딩이 일치하지 않습니다.');
    }
    return parsedLeft;
};

/**
 * Existing plans may continue to use a later-retired template. All immutable
 * core fields must still match the code-registered lifecycle record exactly.
 */
export const assertConstructionPlanTemplateBindingMatchesRecord = (
    rawBinding: unknown,
    record: ConstructionPlanTemplateLifecycleRecord,
): ConstructionPlanTemplateBinding => {
    const binding = parseConstructionPlanTemplateBinding(rawBinding);
    if ((record.lifecycle !== 'published' && record.lifecycle !== 'retired')
        || !record.publishedFingerprint
        || binding.templateRecordId !== record.id
        || binding.templateKey !== record.key
        || binding.tradeType !== record.tradeType
        || binding.templateId !== record.templateId
        || binding.templateVersion !== record.templateVersion
        || binding.rendererVersion !== record.rendererVersion
        || binding.logicalPageCount !== record.pageCount
        || binding.manifestHash !== record.manifestHash
        || binding.templateBundleHash !== record.templateBundleHash
        || binding.templateHash !== record.publishedFingerprint
        || record.publishedFingerprint !== constructionPlanTemplatePublishedFingerprint(record)) {
        return fail('계획서 템플릿 바인딩이 게시 템플릿 불변 계약과 일치하지 않습니다.');
    }
    return binding;
};

const semanticVersionParts = (value: string): readonly [number, number, number] | undefined => {
    const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(value);
    if (!match) return undefined;
    const parts = match.slice(1).map(Number);
    if (parts.some((part) => !Number.isSafeInteger(part) || part < 0)) return undefined;
    return [parts[0], parts[1], parts[2]];
};

const compareSemanticVersions = (left: string, right: string): number | undefined => {
    const leftParts = semanticVersionParts(left);
    const rightParts = semanticVersionParts(right);
    if (!leftParts || !rightParts) return undefined;
    for (let index = 0; index < 3; index += 1) {
        if (leftParts[index] !== rightParts[index]) return leftParts[index] - rightParts[index];
    }
    return 0;
};

/**
 * Upgrades are deliberately restricted to a newly-created revision. The
 * lifecycle record supplied here must have been read in that same transaction.
 */
export const assertConstructionPlanTemplateUpgradeTarget = (
    rawSourceBinding: unknown,
    targetRecord: ConstructionPlanTemplateLifecycleRecord,
): void => {
    const source = parseConstructionPlanTemplateBinding(rawSourceBinding);
    const comparison = compareSemanticVersions(targetRecord.templateVersion, source.templateVersion);
    if (targetRecord.lifecycle !== 'published'
        || targetRecord.isLatest !== true
        || targetRecord.tradeType !== source.tradeType
        || targetRecord.id === source.templateRecordId
        || comparison === undefined
        || comparison <= 0) {
        throw new functions.https.HttpsError(
            'failed-precondition',
            '템플릿 업그레이드는 같은 공종의 더 최신 게시 버전으로 새 개정본을 만들 때만 허용됩니다.',
        );
    }
};
