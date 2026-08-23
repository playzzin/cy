import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';
import {
    isUnknownRecord,
    readTrimmedString,
    sanitizeConstructionPlanStorageSegment,
    sha256Hex,
    type UnknownRecord,
} from './domain';
import {
    CONSTRUCTION_PLAN_FIELD_USE_MAX_PHYSICAL_PAGES,
    CONSTRUCTION_PLAN_FIELD_USE_MIN_PHYSICAL_PAGES,
    type ConstructionPlanFieldUsePageManifest,
} from './fieldUsePdfRenderer';

export const CONSTRUCTION_PLAN_SERVER_PDF_ARTIFACT_CLASS = 'construction-plan-server-pdf';

export type ConstructionPlanServerPdfProfile = 'candidate' | 'issued';

export interface ConstructionPlanServerPdfArtifact {
    profile: ConstructionPlanServerPdfProfile;
    releaseEligible: boolean;
    rendererVersion: string;
    drawingRenderMode: string;
    bytes: Buffer;
    sha256: string;
    sizeBytes: number;
    pageCount: number;
    pageManifest: ConstructionPlanFieldUsePageManifest[];
    snapshotHash: string;
    approvedContentHash: string;
    templateHash: string;
    manifestHash: string;
    templateBundleHash: string;
    templateBindingHash: string;
    rendererTemplateBundleHash: string;
    rendererBuildHash: string;
    renderInputHash: string;
    contentManifestHash: string;
    zeroOmissionCoverageHash: string;
    drawingBindingHash: string;
    fileName: string;
}

export interface ConstructionPlanServerPdfBinding {
    siteId: string;
    planId: string;
    exportJobId: string;
    documentNo: string;
    revision: number;
    approvedSnapshotId: string;
    approvedSnapshotStoragePath: string;
    approvedSnapshotStorageGeneration: string;
    authoritativeDrawingPreviewBindingHash: string;
    approvedEvidenceId?: string;
    approvedEvidenceHash?: string;
    templateHash: string;
    manifestHash: string;
    templateBundleHash: string;
    templateBindingHash: string;
}

export interface StoredConstructionPlanServerPdfArtifact {
    storagePath: string;
    storageGeneration: string;
    customMetadata: Record<string, string>;
}

type StorageBucket = ReturnType<ReturnType<typeof admin.storage>['bucket']>;

const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const GENERATION_PATTERN = /^\d+$/;
const MAX_SERVER_PDF_SIZE_BYTES = 100 * 1024 * 1024;

const requireSha256 = (value: string, label: string): string => {
    const normalized = String(value || '').trim().toLowerCase();
    if (!SHA256_PATTERN.test(normalized)) {
        throw new TypeError(`construction-plan-server-pdf-${label}-invalid`);
    }
    return normalized;
};

const requireGeneration = (value: string, label: string): string => {
    const normalized = String(value || '').trim();
    if (!GENERATION_PATTERN.test(normalized)) {
        throw new TypeError(`construction-plan-server-pdf-${label}-invalid`);
    }
    return normalized;
};

const requireBoundedValue = (value: string, label: string, maximum = 1000): string => {
    const normalized = String(value || '').trim();
    if (!normalized || normalized.length > maximum) {
        throw new TypeError(`construction-plan-server-pdf-${label}-invalid`);
    }
    return normalized;
};

export const buildConstructionPlanServerPdfStoragePath = (
    binding: Pick<ConstructionPlanServerPdfBinding, 'siteId' | 'planId' | 'revision'>,
    artifact: Pick<ConstructionPlanServerPdfArtifact, 'profile' | 'rendererVersion' | 'snapshotHash' | 'sha256'>,
): string => {
    if (!Number.isInteger(binding.revision) || binding.revision < 0) {
        throw new TypeError('construction-plan-server-pdf-revision-invalid');
    }
    const site = sanitizeConstructionPlanStorageSegment(binding.siteId, 'unknown-site');
    const plan = sanitizeConstructionPlanStorageSegment(binding.planId, 'unknown-plan');
    const renderer = sanitizeConstructionPlanStorageSegment(artifact.rendererVersion, 'unknown-renderer');
    const revision = String(binding.revision).padStart(2, '0');
    const snapshotHash = requireSha256(artifact.snapshotHash, 'snapshot-hash');
    const outputHash = requireSha256(artifact.sha256, 'output-hash');
    return [
        'construction-plans', site, plan, 'server-exports', artifact.profile,
        `rev-${revision}`, renderer, snapshotHash, `${outputHash}.pdf`,
    ].join('/');
};

export const buildConstructionPlanServerPdfExportId = (
    artifact: Pick<ConstructionPlanServerPdfArtifact, 'profile' | 'sha256'>,
): string => `${artifact.profile}-${requireSha256(artifact.sha256, 'output-hash').slice(0, 24)}`;

export const buildConstructionPlanServerPdfCustomMetadata = (
    binding: ConstructionPlanServerPdfBinding,
    artifact: ConstructionPlanServerPdfArtifact,
): Record<string, string> => {
    const snapshotHash = requireSha256(artifact.snapshotHash, 'snapshot-hash');
    const approvedContentHash = requireSha256(artifact.approvedContentHash, 'approved-content-hash');
    const templateHash = requireSha256(artifact.templateHash, 'template-hash');
    const manifestHash = requireSha256(artifact.manifestHash, 'manifest-hash');
    const templateBundleHash = requireSha256(artifact.templateBundleHash, 'template-bundle-hash');
    const templateBindingHash = requireSha256(artifact.templateBindingHash, 'template-binding-hash');
    if (templateHash !== requireSha256(binding.templateHash, 'binding-template-hash')
        || manifestHash !== requireSha256(binding.manifestHash, 'binding-manifest-hash')
        || templateBundleHash !== requireSha256(binding.templateBundleHash, 'binding-template-bundle-hash')
        || templateBindingHash !== requireSha256(binding.templateBindingHash, 'binding-template-binding-hash')) {
        throw new TypeError('construction-plan-server-pdf-template-binding-mismatch');
    }
    if ((artifact.profile === 'issued' && artifact.releaseEligible !== true)
        || (artifact.profile === 'candidate' && artifact.releaseEligible !== false)) {
        throw new TypeError('construction-plan-server-pdf-profile-release-eligibility-invalid');
    }
    if (!Number.isInteger(artifact.pageCount)
        || artifact.pageCount < CONSTRUCTION_PLAN_FIELD_USE_MIN_PHYSICAL_PAGES
        || artifact.pageCount > CONSTRUCTION_PLAN_FIELD_USE_MAX_PHYSICAL_PAGES
        || artifact.pageManifest.length !== artifact.pageCount
        || artifact.pageManifest.some((page, index) => page.physicalPageNumber !== index + 1)
        || artifact.sizeBytes !== artifact.bytes.length
        || artifact.sizeBytes < 1 || artifact.sizeBytes > MAX_SERVER_PDF_SIZE_BYTES
        || sha256Hex(artifact.bytes) !== requireSha256(artifact.sha256, 'output-hash')) {
        throw new TypeError('construction-plan-server-pdf-envelope-invalid');
    }
    if (artifact.bytes.subarray(0, 5).toString('ascii') !== '%PDF-') {
        throw new TypeError('construction-plan-server-pdf-magic-invalid');
    }
    return {
        artifactClass: CONSTRUCTION_PLAN_SERVER_PDF_ARTIFACT_CLASS,
        releaseProfile: artifact.profile,
        releaseEligible: String(artifact.releaseEligible),
        planId: requireBoundedValue(binding.planId, 'plan-id', 200),
        siteId: requireBoundedValue(binding.siteId, 'site-id', 200),
        exportJobId: requireBoundedValue(binding.exportJobId, 'export-job-id', 240),
        documentNo: requireBoundedValue(binding.documentNo, 'document-no', 240),
        revision: String(binding.revision),
        pageCount: String(artifact.pageCount),
        sha256: requireSha256(artifact.sha256, 'output-hash'),
        approvedSnapshotId: requireBoundedValue(binding.approvedSnapshotId, 'snapshot-id', 240),
        approvedSnapshotHash: snapshotHash,
        approvedContentHash,
        templateHash,
        manifestHash,
        templateBundleHash,
        templateBindingHash,
        approvedSnapshotStoragePath: requireBoundedValue(
            binding.approvedSnapshotStoragePath,
            'snapshot-storage-path',
        ),
        approvedSnapshotStorageGeneration: requireGeneration(
            binding.approvedSnapshotStorageGeneration,
            'snapshot-storage-generation',
        ),
        authoritativeDrawingPreviewBindingHash: requireSha256(
            binding.authoritativeDrawingPreviewBindingHash,
            'authoritative-drawing-preview-binding-hash',
        ),
        ...(binding.approvedEvidenceId
            ? { approvedEvidenceId: requireBoundedValue(binding.approvedEvidenceId, 'evidence-id', 240) }
            : {}),
        ...(binding.approvedEvidenceHash
            ? { approvedEvidenceHash: requireSha256(binding.approvedEvidenceHash, 'evidence-hash') }
            : {}),
        rendererVersion: requireBoundedValue(artifact.rendererVersion, 'renderer-version', 160),
        rendererTemplateBundleHash: requireSha256(
            artifact.rendererTemplateBundleHash,
            'template-bundle-hash',
        ),
        rendererBuildHash: requireSha256(artifact.rendererBuildHash, 'renderer-build-hash'),
        renderInputHash: requireSha256(artifact.renderInputHash, 'render-input-hash'),
        contentManifestHash: requireSha256(artifact.contentManifestHash, 'content-manifest-hash'),
        zeroOmissionCoverageHash: requireSha256(
            artifact.zeroOmissionCoverageHash,
            'zero-omission-coverage-hash',
        ),
        drawingBindingHash: requireSha256(artifact.drawingBindingHash, 'drawing-binding-hash'),
        drawingRenderMode: requireBoundedValue(artifact.drawingRenderMode, 'drawing-render-mode', 160),
        fileName: requireBoundedValue(artifact.fileName, 'file-name', 240),
    };
};

const isPreconditionFailure = (error: unknown): boolean => {
    if (!isUnknownRecord(error)) return false;
    return error.code === 409 || error.code === 412 || error.code === '409' || error.code === '412';
};

const assertStoredMetadata = (
    rawMetadata: unknown,
    expected: Record<string, string>,
    expectedSize: number,
): string => {
    if (!isUnknownRecord(rawMetadata)
        || rawMetadata.contentType !== 'application/pdf'
        || Number(rawMetadata.size) !== expectedSize) {
        throw new functions.https.HttpsError('data-loss', '서버 PDF 객체 메타데이터가 손상되었습니다.');
    }
    const generation = String(rawMetadata.generation || '');
    if (!GENERATION_PATTERN.test(generation)) {
        throw new functions.https.HttpsError('data-loss', '서버 PDF 객체 generation이 없습니다.');
    }
    const custom = isUnknownRecord(rawMetadata.metadata) ? rawMetadata.metadata : {};
    const expectedKeys = Object.keys(expected).sort();
    const storedKeys = Object.keys(custom).sort();
    if (JSON.stringify(storedKeys) !== JSON.stringify(expectedKeys)) {
        throw new functions.https.HttpsError(
            'data-loss',
            '서버 PDF 객체 custom metadata schema가 일치하지 않습니다.',
        );
    }
    for (const [key, value] of Object.entries(expected)) {
        if (readTrimmedString(custom, [key]) !== value) {
            throw new functions.https.HttpsError(
                'data-loss',
                `서버 PDF 객체 ${key} 바인딩이 일치하지 않습니다.`,
            );
        }
    }
    return generation;
};

/**
 * Saves a deterministic server-rendered PDF create-only, then re-downloads it
 * and verifies both bytes and every provenance field before it can be cited by
 * an export transaction. A concurrent identical retry is safely reusable.
 */
export const storeImmutableConstructionPlanServerPdf = async (
    storageBucket: StorageBucket,
    binding: ConstructionPlanServerPdfBinding,
    artifact: ConstructionPlanServerPdfArtifact,
): Promise<StoredConstructionPlanServerPdfArtifact> => {
    const storagePath = buildConstructionPlanServerPdfStoragePath(binding, artifact);
    const customMetadata = buildConstructionPlanServerPdfCustomMetadata(binding, artifact);
    const file = storageBucket.file(storagePath);
    try {
        await file.save(artifact.bytes, {
            resumable: false,
            contentType: 'application/pdf',
            metadata: {
                contentType: 'application/pdf',
                cacheControl: 'private,max-age=31536000,immutable',
                metadata: customMetadata,
            },
            preconditionOpts: { ifGenerationMatch: 0 },
        });
    } catch (error) {
        if (!isPreconditionFailure(error)) throw error;
    }

    const [storedBytes] = await file.download();
    if (storedBytes.length !== artifact.sizeBytes || sha256Hex(storedBytes) !== artifact.sha256) {
        throw new functions.https.HttpsError('data-loss', '서버 PDF 불변 객체의 SHA-256이 일치하지 않습니다.');
    }
    const [rawMetadata] = await file.getMetadata();
    const storageGeneration = assertStoredMetadata(
        rawMetadata as unknown,
        customMetadata,
        artifact.sizeBytes,
    );
    return { storagePath, storageGeneration, customMetadata };
};
