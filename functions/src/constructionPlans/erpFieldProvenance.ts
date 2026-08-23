import {
    CONSTRUCTION_PLAN_ERP_REFRESH_FIELDS,
    CONSTRUCTION_PLAN_ERP_REFRESH_SLOT_SOURCE,
    isConstructionPlanErpRefreshFieldId,
    type ConstructionPlanErpRefreshSlot,
} from './erpRefreshContract';
import { createHash } from 'node:crypto';

export type ConstructionPlanErpFieldProvenanceRecord = Record<string, {
    source: 'site' | 'company' | 'team';
    sourceId: string;
    sourceUpdatedAt?: string;
    capturedAt: string;
    captureKind: 'initial' | 'refresh';
    sourceMasterHash: string;
    appliedBy?: string;
    appliedAt?: string;
    changeReason?: string;
    auditEventId?: string;
}>;

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
    Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const exactKeys = (record: UnknownRecord, allowed: readonly string[], code: string): void => {
    const allowedKeys = new Set(allowed);
    if (Object.keys(record).some((key) => !allowedKeys.has(key))) throw new Error(code);
};

const boundedString = (value: unknown, code: string, maxLength = 200): string => {
    const normalized = typeof value === 'string' ? value.trim() : '';
    if (!normalized || normalized.length > maxLength) throw new Error(code);
    return normalized;
};

const isoDateTime = (value: unknown, code: string): string => {
    const normalized = boundedString(value, code, 80);
    const epoch = Date.parse(normalized);
    if (!Number.isFinite(epoch)) throw new Error(code);
    return new Date(epoch).toISOString();
};

const HASH_PATTERN = /^[a-f0-9]{64}$/;

const canonicalize = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(canonicalize);
    if (!isRecord(value)) return value;
    return Object.keys(value).sort().reduce<UnknownRecord>((result, key) => {
        if (value[key] !== undefined) result[key] = canonicalize(value[key]);
        return result;
    }, {});
};

/**
 * Stable safe-master fingerprint. Capture time and overridden state are not
 * included so re-reading an unchanged ERP document yields the same version
 * evidence even when the master has no updatedAt field.
 */
export const buildConstructionPlanErpSourceMasterHash = (source: unknown): string => {
    if (!isRecord(source) || !isRecord(source.value)) {
        throw new Error('construction-plan-erp-source-master-hash-invalid');
    }
    return createHash('sha256').update(JSON.stringify(canonicalize({
        source: source.source,
        sourceId: source.sourceId,
        ...(source.sourceUpdatedAt ? { sourceUpdatedAt: source.sourceUpdatedAt } : {}),
        value: source.value,
    }))).digest('hex');
};

export const buildInitialConstructionPlanErpFieldProvenance = (
    snapshot: UnknownRecord,
): ConstructionPlanErpFieldProvenanceRecord => {
    const result: ConstructionPlanErpFieldProvenanceRecord = {};
    (Object.keys(CONSTRUCTION_PLAN_ERP_REFRESH_FIELDS) as ConstructionPlanErpRefreshSlot[])
        .forEach((slot) => {
            const source = isRecord(snapshot[slot]) ? snapshot[slot] as UnknownRecord : undefined;
            const value = source && isRecord(source.value) ? source.value : undefined;
            if (!source || !value) return;
            const sourceId = boundedString(source.sourceId, 'construction-plan-erp-provenance-source-id-invalid');
            const capturedAt = isoDateTime(source.capturedAt, 'construction-plan-erp-provenance-captured-at-invalid');
            const sourceUpdatedAt = source.sourceUpdatedAt === undefined
                ? undefined
                : isoDateTime(source.sourceUpdatedAt, 'construction-plan-erp-provenance-updated-at-invalid');
            const sourceMasterHash = buildConstructionPlanErpSourceMasterHash(source);
            CONSTRUCTION_PLAN_ERP_REFRESH_FIELDS[slot].forEach((field) => {
                if (value[field] === undefined) return;
                result[`${slot}.${field}`] = {
                    source: CONSTRUCTION_PLAN_ERP_REFRESH_SLOT_SOURCE[slot],
                    sourceId,
                    ...(sourceUpdatedAt ? { sourceUpdatedAt } : {}),
                    capturedAt,
                    captureKind: 'initial',
                    sourceMasterHash,
                };
            });
        });
    return result;
};

/**
 * Validates the server-owned per-field provenance used when one ERP envelope
 * contains fields captured at different master revisions. It is intentionally
 * exact and rejects unknown keys instead of silently creating false lineage.
 */
export const sanitizeConstructionPlanErpFieldProvenance = (
    raw: unknown,
    sanitizedSnapshot: UnknownRecord,
): ConstructionPlanErpFieldProvenanceRecord | undefined => {
    const sources = Object.keys(CONSTRUCTION_PLAN_ERP_REFRESH_FIELDS) as ConstructionPlanErpRefreshSlot[];
    if (raw === undefined || raw === null) {
        if (sources.some((slot) => isRecord(sanitizedSnapshot[slot])
            && (sanitizedSnapshot[slot] as UnknownRecord).overridden === true)) {
            throw new Error('construction-plan-erp-field-provenance-required');
        }
        return undefined;
    }
    if (!isRecord(raw)
        || Object.keys(raw).length > Object.values(CONSTRUCTION_PLAN_ERP_REFRESH_FIELDS)
            .reduce((total, fields) => total + fields.length, 0)) {
        throw new Error('construction-plan-erp-field-provenance-invalid');
    }

    const result: ConstructionPlanErpFieldProvenanceRecord = {};
    Object.entries(raw).forEach(([fieldId, rawEntry]) => {
        if (!isConstructionPlanErpRefreshFieldId(fieldId) || !isRecord(rawEntry)) {
            throw new Error('construction-plan-erp-field-provenance-field-invalid');
        }
        exactKeys(
            rawEntry,
            [
                'source', 'sourceId', 'sourceUpdatedAt', 'capturedAt',
                'captureKind', 'sourceMasterHash',
                'appliedBy', 'appliedAt', 'changeReason', 'auditEventId',
            ],
            'construction-plan-erp-field-provenance-entry-field-invalid',
        );
        const [slot, field] = fieldId.split('.') as [ConstructionPlanErpRefreshSlot, string];
        const envelope = isRecord(sanitizedSnapshot[slot])
            ? sanitizedSnapshot[slot] as UnknownRecord
            : undefined;
        const value = envelope && isRecord(envelope.value) ? envelope.value : undefined;
        const sourceId = boundedString(
            rawEntry.sourceId,
            'construction-plan-erp-field-provenance-source-id-invalid',
        );
        if (!envelope
            || !value
            || value[field] === undefined
            || rawEntry.source !== CONSTRUCTION_PLAN_ERP_REFRESH_SLOT_SOURCE[slot]
            || sourceId !== envelope.sourceId) {
            throw new Error('construction-plan-erp-field-provenance-binding-invalid');
        }
        const capturedAt = isoDateTime(
            rawEntry.capturedAt,
            'construction-plan-erp-field-provenance-captured-at-invalid',
        );
        const sourceUpdatedAt = rawEntry.sourceUpdatedAt === undefined
            ? undefined
            : isoDateTime(
                rawEntry.sourceUpdatedAt,
                'construction-plan-erp-field-provenance-updated-at-invalid',
            );
        const captureKind = rawEntry.captureKind;
        if (captureKind !== 'initial' && captureKind !== 'refresh') {
            throw new Error('construction-plan-erp-field-provenance-capture-kind-invalid');
        }
        const sourceMasterHash = boundedString(
            rawEntry.sourceMasterHash,
            'construction-plan-erp-field-provenance-source-master-hash-invalid',
            64,
        ).toLowerCase();
        if (!HASH_PATTERN.test(sourceMasterHash)) {
            throw new Error('construction-plan-erp-field-provenance-source-master-hash-invalid');
        }
        const appliedBy = rawEntry.appliedBy === undefined
            ? undefined
            : boundedString(rawEntry.appliedBy, 'construction-plan-erp-field-provenance-applied-by-invalid');
        const appliedAt = rawEntry.appliedAt === undefined
            ? undefined
            : isoDateTime(rawEntry.appliedAt, 'construction-plan-erp-field-provenance-applied-at-invalid');
        const changeReason = rawEntry.changeReason === undefined
            ? undefined
            : boundedString(rawEntry.changeReason, 'construction-plan-erp-field-provenance-reason-invalid', 500);
        const auditEventId = rawEntry.auditEventId === undefined
            ? undefined
            : boundedString(rawEntry.auditEventId, 'construction-plan-erp-field-provenance-audit-id-invalid');
        const hasRefreshEvidence = Boolean(appliedBy && appliedAt && changeReason && auditEventId);
        if ((captureKind === 'refresh' && !hasRefreshEvidence)
            || (captureKind === 'initial' && (appliedBy || appliedAt || changeReason || auditEventId))) {
            throw new Error('construction-plan-erp-field-provenance-change-evidence-invalid');
        }
        if (captureKind === 'refresh' && changeReason!.length < 5) {
            throw new Error('construction-plan-erp-field-provenance-reason-invalid');
        }
        if (envelope.overridden !== true
            && sourceMasterHash !== buildConstructionPlanErpSourceMasterHash(envelope)) {
            throw new Error('construction-plan-erp-field-provenance-source-master-hash-binding-invalid');
        }
        result[fieldId] = {
            source: CONSTRUCTION_PLAN_ERP_REFRESH_SLOT_SOURCE[slot],
            sourceId,
            ...(sourceUpdatedAt ? { sourceUpdatedAt } : {}),
            capturedAt,
            captureKind,
            sourceMasterHash,
            ...(appliedBy ? { appliedBy } : {}),
            ...(appliedAt ? { appliedAt } : {}),
            ...(changeReason ? { changeReason } : {}),
            ...(auditEventId ? { auditEventId } : {}),
        };
    });

    sources.forEach((slot) => {
        const envelope = isRecord(sanitizedSnapshot[slot])
            ? sanitizedSnapshot[slot] as UnknownRecord
            : undefined;
        const value = envelope && isRecord(envelope.value) ? envelope.value : undefined;
        if (!envelope || !value || envelope.overridden !== true) return;
        CONSTRUCTION_PLAN_ERP_REFRESH_FIELDS[slot].forEach((field) => {
            if (value[field] !== undefined && !result[`${slot}.${field}`]) {
                throw new Error('construction-plan-erp-field-provenance-coverage-incomplete');
            }
        });
    });
    return result;
};
