import { canonicalStringify, type UnknownRecord } from './domain';
import type { ConstructionPlanFieldUsePageManifest } from './fieldUsePdfRenderer';
import type { ConstructionPlanTradeType } from './templateContracts';

export interface IssuedPdfTransitionArtifact {
    profile: 'candidate' | 'issued';
    releaseEligible: boolean;
    storagePath: string;
    storageGeneration: string;
    sha256: string;
    sizeBytes: number;
    pageCount: number;
    pageManifest: ConstructionPlanFieldUsePageManifest[];
    fileName: string;
    snapshotHash: string;
    approvedContentHash: string;
    templateHash: string;
    manifestHash: string;
    templateBundleHash: string;
    templateBindingHash: string;
    rendererVersion: string;
    rendererTemplateBundleHash: string;
    rendererBuildHash: string;
    renderInputHash: string;
    contentManifestHash: string;
    zeroOmissionCoverageHash: string;
    drawingBindingHash: string;
    drawingRenderMode: string;
}

export interface PreparedPdfJobProjectionInput {
    jobCore: UnknownRecord;
    candidate: IssuedPdfTransitionArtifact;
    actorId: string;
    timestamp: string;
}

export const buildPreparedPdfJobProjection = (
    input: PreparedPdfJobProjectionInput,
): UnknownRecord => ({
    ...input.jobCore,
    status: 'READY_FOR_VISUAL_CHECK',
    immutableInput: true,
    candidateStoragePath: input.candidate.storagePath,
    candidateStorageGeneration: input.candidate.storageGeneration,
    candidateSha256: input.candidate.sha256,
    candidatePageCount: input.candidate.pageCount,
    rendererVersion: input.candidate.rendererVersion,
    rendererTemplateBundleHash: input.candidate.rendererTemplateBundleHash,
    rendererBuildHash: input.candidate.rendererBuildHash,
    candidateRenderInputHash: input.candidate.renderInputHash,
    contentManifestHash: input.candidate.contentManifestHash,
    zeroOmissionCoverageHash: input.candidate.zeroOmissionCoverageHash,
    drawingBindingHash: input.candidate.drawingBindingHash,
    drawingRenderMode: input.candidate.drawingRenderMode,
    preparedBy: input.actorId,
    preparedAt: input.timestamp,
    createdAt: input.timestamp,
    updatedAt: input.timestamp,
});

export const ISSUED_PDF_VALIDATION_PROJECTION: Readonly<UnknownRecord> = Object.freeze({
    serverRendered: true,
    createOnlyStorage: true,
    storageBytesReverified: true,
    pdfMagic: true,
    sha256: true,
    pageCount: true,
    a4PhysicalPages: true,
    forbiddenPdfFeaturesAbsent: true,
    auditText: true,
    visualCheckConfirmed: true,
    approvedSnapshotSchemaV2: true,
    authoritativeDrawingPreviews: true,
    zeroOmissionCoverage: true,
    immutablePublishedTemplateBinding: true,
});

export interface IssuedPdfAtomicProjectionInput {
    planId: string;
    jobId: string;
    exportId: string;
    siteId: string;
    tradeType: ConstructionPlanTradeType;
    documentNo: string;
    documentNoKey: string;
    revision: number;
    seriesId: string;
    lineageRootPlanId: string;
    currentPlanLockVersion: number;
    supersedesPlanId?: string;
    supersededSourceLockVersion?: number;
    issueEventId: string;
    supersedeEventId?: string;
    snapshot: {
        id: string;
        hash: string;
        storagePath: string;
        storageGeneration: string;
        byteLength: number;
    };
    approval: { evidenceId: string; evidenceHash: string };
    templateBinding: UnknownRecord;
    templateHash: string;
    manifestHash: string;
    templateBundleHash: string;
    templateBindingHash: string;
    authoritativeDrawingPreviewBindingHash: string;
    candidate: IssuedPdfTransitionArtifact;
    issued: IssuedPdfTransitionArtifact;
    actorId: string;
    actorName?: string;
    timestamp: string;
}

export interface IssuedPdfAtomicProjection {
    exportCreate: UnknownRecord;
    jobUpdate: UnknownRecord;
    planUpdate: UnknownRecord;
    seriesCreate: UnknownRecord;
    seriesUpdate: UnknownRecord;
    supersededPlanUpdate?: UnknownRecord;
    supersedeEventCreate?: UnknownRecord;
    issueEventCreate: UnknownRecord;
}

export const buildIssuedPdfAtomicProjection = (
    input: IssuedPdfAtomicProjectionInput,
): IssuedPdfAtomicProjection => {
    const actor = input.actorName ? { actorName: input.actorName } : {};
    const exportCreate: UnknownRecord = {
        id: input.exportId,
        planId: input.planId,
        jobId: input.jobId,
        snapshotId: input.snapshot.id,
        snapshotHash: input.snapshot.hash,
        approvedContentHash: input.issued.approvedContentHash,
        snapshotStoragePath: input.snapshot.storagePath,
        snapshotStorageGeneration: input.snapshot.storageGeneration,
        snapshotByteLength: input.snapshot.byteLength,
        approvalEvidenceId: input.approval.evidenceId,
        approvalEvidenceHash: input.approval.evidenceHash,
        templateBinding: input.templateBinding,
        templateHash: input.templateHash,
        manifestHash: input.manifestHash,
        templateBundleHash: input.templateBundleHash,
        templateBindingHash: input.templateBindingHash,
        authoritativeDrawingPreviewBindingHash: input.authoritativeDrawingPreviewBindingHash,
        candidateStoragePath: input.candidate.storagePath,
        candidateStorageGeneration: input.candidate.storageGeneration,
        candidateSha256: input.candidate.sha256,
        kind: 'issued',
        status: 'ready',
        immutable: true,
        artifact: input.issued,
        storagePath: input.issued.storagePath,
        storageGeneration: input.issued.storageGeneration,
        sha256: input.issued.sha256,
        sizeBytes: input.issued.sizeBytes,
        pageCount: input.issued.pageCount,
        fileName: input.issued.fileName,
        rendererVersion: input.issued.rendererVersion,
        rendererTemplateBundleHash: input.issued.rendererTemplateBundleHash,
        rendererBuildHash: input.issued.rendererBuildHash,
        renderInputHash: input.issued.renderInputHash,
        contentManifestHash: input.issued.contentManifestHash,
        zeroOmissionCoverageHash: input.issued.zeroOmissionCoverageHash,
        drawingBindingHash: input.issued.drawingBindingHash,
        drawingRenderMode: input.issued.drawingRenderMode,
        visualCheckedBy: input.actorId,
        visualCheckedAt: input.timestamp,
        validation: { ...ISSUED_PDF_VALIDATION_PROJECTION },
        generatedBy: input.actorId,
        generatedAt: input.timestamp,
        createdAt: input.timestamp,
    };
    const jobUpdate: UnknownRecord = {
        status: 'ISSUED',
        issuedExportId: input.exportId,
        issuedArtifact: input.issued,
        issuedStoragePath: input.issued.storagePath,
        issuedStorageGeneration: input.issued.storageGeneration,
        issuedSha256: input.issued.sha256,
        issuedPageCount: input.issued.pageCount,
        approvedSnapshotHash: input.snapshot.hash,
        approvedContentHash: input.issued.approvedContentHash,
        templateHash: input.templateHash,
        manifestHash: input.manifestHash,
        templateBundleHash: input.templateBundleHash,
        templateBindingHash: input.templateBindingHash,
        issuedRenderInputHash: input.issued.renderInputHash,
        visualCheckConfirmed: true,
        visualCheckedBy: input.actorId,
        visualCheckedAt: input.timestamp,
        issuedBy: input.actorId,
        issuedAt: input.timestamp,
        updatedAt: input.timestamp,
    };
    const planUpdate: UnknownRecord = {
        status: 'issued',
        seriesId: input.seriesId,
        lineageRootPlanId: input.lineageRootPlanId,
        issuedExportId: input.exportId,
        issuedExportJobId: input.jobId,
        issuedExportStoragePath: input.issued.storagePath,
        issuedExportStorageGeneration: input.issued.storageGeneration,
        issuedExportSha256: input.issued.sha256,
        issuedExportFileName: input.issued.fileName,
        issuedExportPageCount: input.issued.pageCount,
        issuedCandidateStoragePath: input.candidate.storagePath,
        issuedCandidateStorageGeneration: input.candidate.storageGeneration,
        issuedCandidateSha256: input.candidate.sha256,
        issuedApprovedContentHash: input.issued.approvedContentHash,
        issuedTemplateHash: input.templateHash,
        issuedManifestHash: input.manifestHash,
        issuedTemplateBundleHash: input.templateBundleHash,
        issuedTemplateBindingHash: input.templateBindingHash,
        issuedRendererVersion: input.issued.rendererVersion,
        issuedRendererTemplateBundleHash: input.issued.rendererTemplateBundleHash,
        issuedRendererBuildHash: input.issued.rendererBuildHash,
        issuedRenderInputHash: input.issued.renderInputHash,
        issuedContentManifestHash: input.issued.contentManifestHash,
        issuedZeroOmissionCoverageHash: input.issued.zeroOmissionCoverageHash,
        issuedDrawingBindingHash: input.issued.drawingBindingHash,
        issuedAuthoritativeDrawingPreviewBindingHash: input.authoritativeDrawingPreviewBindingHash,
        issuedVisualCheckedBy: input.actorId,
        issuedVisualCheckedAt: input.timestamp,
        issuedAt: input.timestamp,
        issuedBy: input.actorId,
        lockVersion: input.currentPlanLockVersion + 1,
        updatedBy: input.actorId,
        updatedAt: input.timestamp,
        'releaseReadiness.requiredReviewsComplete': true,
        'releaseReadiness.snapshotHashMatches': true,
        'releaseReadiness.pdfTextCheckPassed': true,
        'releaseReadiness.pdfVisualCheckPassed': true,
    };
    const seriesCreate: UnknownRecord = {
        id: input.seriesId,
        siteId: input.siteId,
        documentNo: input.documentNo,
        documentNoKey: input.documentNoKey,
        tradeType: input.tradeType,
        latestRevisionNo: input.revision,
        latestPlanId: input.planId,
        latestIssuedPlanId: input.planId,
        templateBinding: input.templateBinding,
        templateHash: input.templateHash,
        manifestHash: input.manifestHash,
        templateBundleHash: input.templateBundleHash,
        templateBindingHash: input.templateBindingHash,
        createdBy: input.actorId,
        createdAt: input.timestamp,
        updatedBy: input.actorId,
        updatedAt: input.timestamp,
    };
    const seriesUpdate: UnknownRecord = {
        documentNo: input.documentNo,
        latestRevisionNo: input.revision,
        latestPlanId: input.planId,
        latestIssuedPlanId: input.planId,
        templateBinding: input.templateBinding,
        templateHash: input.templateHash,
        manifestHash: input.manifestHash,
        templateBundleHash: input.templateBundleHash,
        templateBindingHash: input.templateBindingHash,
        updatedBy: input.actorId,
        updatedAt: input.timestamp,
    };
    const issueEventCreate: UnknownRecord = {
        id: input.issueEventId,
        planId: input.planId,
        seriesId: input.seriesId,
        type: 'issue',
        action: 'issue',
        fromStatus: 'approved_pending_issue',
        toStatus: 'issued',
        actorId: input.actorId,
        ...actor,
        at: input.timestamp,
        ...(input.supersedesPlanId ? { sourcePlanId: input.supersedesPlanId } : {}),
        targetPlanId: input.planId,
        revisionNo: input.revision,
        jobId: input.jobId,
        exportId: input.exportId,
        approvedSnapshotHash: input.snapshot.hash,
        approvedContentHash: input.issued.approvedContentHash,
        approvalEvidenceHash: input.approval.evidenceHash,
        templateBinding: input.templateBinding,
        templateHash: input.templateHash,
        manifestHash: input.manifestHash,
        templateBundleHash: input.templateBundleHash,
        templateBindingHash: input.templateBindingHash,
        candidateStoragePath: input.candidate.storagePath,
        candidateStorageGeneration: input.candidate.storageGeneration,
        candidateSha256: input.candidate.sha256,
        issuedStoragePath: input.issued.storagePath,
        issuedStorageGeneration: input.issued.storageGeneration,
        issuedSha256: input.issued.sha256,
        issuedPageCount: input.issued.pageCount,
        rendererVersion: input.issued.rendererVersion,
        rendererTemplateBundleHash: input.issued.rendererTemplateBundleHash,
        rendererBuildHash: input.issued.rendererBuildHash,
        renderInputHash: input.issued.renderInputHash,
        contentManifestHash: input.issued.contentManifestHash,
        zeroOmissionCoverageHash: input.issued.zeroOmissionCoverageHash,
        drawingBindingHash: input.issued.drawingBindingHash,
        authoritativeDrawingPreviewBindingHash: input.authoritativeDrawingPreviewBindingHash,
        visualCheckedBy: input.actorId,
        visualCheckedAt: input.timestamp,
        createdAt: input.timestamp,
    };

    if (!input.supersedesPlanId) {
        return { exportCreate, jobUpdate, planUpdate, seriesCreate, seriesUpdate, issueEventCreate };
    }
    if (!Number.isInteger(input.supersededSourceLockVersion)
        || Number(input.supersededSourceLockVersion) < 0 || !input.supersedeEventId) {
        throw new TypeError('construction-plan-issued-pdf-supersede-projection-invalid');
    }
    const supersededPlanUpdate: UnknownRecord = {
        status: 'superseded',
        supersededByPlanId: input.planId,
        supersededAt: input.timestamp,
        supersededBy: input.actorId,
        lockVersion: Number(input.supersededSourceLockVersion) + 1,
        updatedBy: input.actorId,
        updatedAt: input.timestamp,
    };
    const supersedeEventCreate: UnknownRecord = {
        id: input.supersedeEventId,
        planId: input.supersedesPlanId,
        seriesId: input.seriesId,
        type: 'supersede',
        action: 'supersede',
        actorId: input.actorId,
        ...actor,
        at: input.timestamp,
        createdAt: input.timestamp,
        fromStatus: 'issued',
        toStatus: 'superseded',
        sourcePlanId: input.supersedesPlanId,
        targetPlanId: input.planId,
        revisionNo: input.revision,
        reason: '새 개정본 현장사용 발행',
    };
    return {
        exportCreate,
        jobUpdate,
        planUpdate,
        seriesCreate,
        seriesUpdate,
        supersededPlanUpdate,
        supersedeEventCreate,
        issueEventCreate,
    };
};

export type IssuedPdfTransactionDisposition = 'apply' | 'idempotent' | 'conflict';

export interface IssuedPdfTransactionDecisionInput {
    planStatus: unknown;
    planJobId: unknown;
    planExportId: unknown;
    jobStatus: unknown;
    exportExists: boolean;
    expectedJobId: string;
    expectedExportId: string;
    terminalArtifactsMatch: boolean;
}

export const decideIssuedPdfTransactionDisposition = (
    input: IssuedPdfTransactionDecisionInput,
): IssuedPdfTransactionDisposition => {
    if ((input.planStatus === 'issued' || input.planStatus === 'superseded')
        && input.planJobId === input.expectedJobId
        && input.planExportId === input.expectedExportId
        && input.jobStatus === 'ISSUED'
        && input.exportExists
        && input.terminalArtifactsMatch) {
        return 'idempotent';
    }
    if (input.planStatus === 'approved_pending_issue'
        && input.jobStatus === 'READY_FOR_VISUAL_CHECK'
        && !input.exportExists) {
        return 'apply';
    }
    return 'conflict';
};

export const terminalIssuedPdfArtifactsMatch = (
    jobIssuedArtifact: unknown,
    exportArtifact: unknown,
    expectedIssuedArtifact: IssuedPdfTransitionArtifact,
): boolean => canonicalStringify(jobIssuedArtifact) === canonicalStringify(expectedIssuedArtifact)
    && canonicalStringify(exportArtifact) === canonicalStringify(expectedIssuedArtifact);
