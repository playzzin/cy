import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import {
    assertExistingIssuedRedundantAudit,
    type PersistedServerPdfArtifactRecord,
} from './callables';
import type { ConstructionPlanServerPdfBinding } from './issuedPdfArtifact';
import {
    buildIssuedPdfAtomicProjection,
    buildPreparedPdfJobProjection,
    decideIssuedPdfTransactionDisposition,
    terminalIssuedPdfArtifactsMatch,
} from './issuedPdfTransition';
import type { UnknownRecord } from './domain';

const hash = (value: string): string => value.repeat(64).slice(0, 64);
const pageManifest = Array.from({ length: 42 }, (_, index) => ({
    pageNumber: index + 1,
    physicalPageNumber: index + 1,
    logicalPageNumber: index + 1,
    continuationIndex: 0,
    sectionKey: `section-${index + 1}`,
    title: `page-${index + 1}`,
    required: true,
    templateContractHash: hash('1'),
    payloadHash: hash('2'),
    coveragePaths: [],
    coverageLedger: [],
    drawingBindings: [],
    drawingBindingHash: hash('3'),
}));

const artifact = (profile: 'candidate' | 'issued'): PersistedServerPdfArtifactRecord => ({
    profile,
    releaseEligible: profile === 'issued',
    storagePath: `construction-plans/site-1/plan-r2/server-exports/${profile}/artifact.pdf`,
    storageGeneration: profile === 'candidate' ? '1700000000000101' : '1700000000000102',
    sha256: profile === 'candidate' ? hash('c') : hash('f'),
    sizeBytes: profile === 'candidate' ? 120001 : 120002,
    pageCount: 42,
    pageManifest,
    fileName: `CP-001_REV-02_${profile.toUpperCase()}.pdf`,
    snapshotHash: hash('a'),
    approvedContentHash: hash('9'),
    templateHash: hash('d'),
    manifestHash: hash('e'),
    templateBundleHash: hash('b'),
    templateBindingHash: hash('7'),
    rendererVersion: 'field-use-v1',
    rendererTemplateBundleHash: hash('b'),
    rendererBuildHash: hash('1'),
    renderInputHash: profile === 'candidate' ? hash('2') : hash('3'),
    contentManifestHash: hash('4'),
    zeroOmissionCoverageHash: hash('5'),
    drawingBindingHash: hash('6'),
    drawingRenderMode: 'verified-source-raster-2400',
});

const candidate = artifact('candidate');
const issued = artifact('issued');
const timestamp = '2026-08-22T12:34:56.000Z';
const jobId = 'pdf-job-001';
const exportId = 'issued-export-001';
const planId = 'plan-r2';
const supersedesPlanId = 'plan-r0';
const previewBindingHash = hash('8');
const templateBinding: UnknownRecord = {
    schemaVersion: 1,
    tradeType: 'system-shoring',
    templateId: 'system-shoring-standard',
    templateVersion: '1.0.0',
    templateHash: candidate.templateHash,
};
const templateProjection = {
    templateBinding,
    templateHash: candidate.templateHash,
    manifestHash: candidate.manifestHash,
    templateBundleHash: candidate.templateBundleHash,
    templateBindingHash: candidate.templateBindingHash,
};

const binding: Omit<ConstructionPlanServerPdfBinding, 'exportJobId'> = {
    siteId: 'site-1',
    planId,
    documentNo: 'CP-001',
    revision: 2,
    approvedSnapshotId: 'snapshot-r2',
    approvedSnapshotStoragePath: `construction-plans/site-1/${planId}/snapshots/${hash('a')}.json`,
    approvedSnapshotStorageGeneration: '1700000000000001',
    authoritativeDrawingPreviewBindingHash: previewBindingHash,
    approvedEvidenceId: 'approval-r2',
    approvedEvidenceHash: hash('7'),
    templateHash: candidate.templateHash,
    manifestHash: candidate.manifestHash,
    templateBundleHash: candidate.templateBundleHash,
    templateBindingHash: candidate.templateBindingHash,
};

const jobCore: UnknownRecord = {
    id: jobId,
    jobSchemaVersion: 1,
    authority: 'server',
    planId,
    siteId: binding.siteId,
    documentNo: binding.documentNo,
    revision: binding.revision,
    approvedSnapshotHash: candidate.snapshotHash,
    approvedContentHash: candidate.approvedContentHash,
    snapshot: {
        schemaVersion: 2,
        id: binding.approvedSnapshotId,
        hash: candidate.snapshotHash,
        storagePath: binding.approvedSnapshotStoragePath,
        storageGeneration: binding.approvedSnapshotStorageGeneration,
        byteLength: 48000,
    },
    approval: {
        evidenceId: binding.approvedEvidenceId,
        evidenceHash: binding.approvedEvidenceHash,
    },
    ...templateProjection,
    authoritativeDrawingPreviewBindingHash: previewBindingHash,
    candidateArtifact: candidate,
};

const applyProjectionAtomically = (
    state: {
        plan: UnknownRecord;
        job: UnknownRecord;
        series: UnknownRecord;
        supersededPlan: UnknownRecord;
        exported?: UnknownRecord;
        events: UnknownRecord[];
    },
    projection: ReturnType<typeof buildIssuedPdfAtomicProjection>,
) => ({
    plan: { ...state.plan, ...projection.planUpdate },
    job: { ...state.job, ...projection.jobUpdate },
    series: { ...state.series, ...projection.seriesUpdate },
    supersededPlan: {
        ...state.supersededPlan,
        ...(projection.supersededPlanUpdate || {}),
    },
    exported: { ...projection.exportCreate },
    events: [
        ...state.events,
        ...(projection.supersedeEventCreate ? [projection.supersedeEventCreate] : []),
        projection.issueEventCreate,
    ],
});

describe('issued PDF in-memory transaction orchestration', () => {
    it('preserves a dynamic physical manifest and page count through job, export, and plan projections', () => {
        const dynamicManifest = [
            ...pageManifest,
            ...Array.from({ length: 15 }, (_, index) => ({
                ...pageManifest[41],
                pageNumber: 43 + index,
                physicalPageNumber: 43 + index,
                logicalPageNumber: 42,
                continuationIndex: index + 1,
                payloadHash: hash(String((index % 8) + 1)),
            })),
        ];
        const dynamicCandidate = { ...candidate, pageCount: 57, pageManifest: dynamicManifest };
        const dynamicIssued = { ...issued, pageCount: 57, pageManifest: dynamicManifest };
        const prepared = buildPreparedPdfJobProjection({
            jobCore: { ...jobCore, candidateArtifact: dynamicCandidate },
            candidate: dynamicCandidate,
            actorId: 'office-user',
            timestamp,
        });
        const projection = buildIssuedPdfAtomicProjection({
            tradeType: 'system-shoring',
            planId,
            jobId,
            exportId,
            siteId: 'site-1',
            documentNo: 'CP-001',
            documentNoKey: 'cp-001',
            revision: 2,
            seriesId: 'series-1',
            lineageRootPlanId: planId,
            currentPlanLockVersion: 4,
            issueEventId: 'event-dynamic-issue',
            snapshot: {
                id: binding.approvedSnapshotId,
                hash: dynamicCandidate.snapshotHash,
                storagePath: binding.approvedSnapshotStoragePath,
                storageGeneration: binding.approvedSnapshotStorageGeneration,
                byteLength: 48000,
            },
            approval: {
                evidenceId: binding.approvedEvidenceId || '',
                evidenceHash: binding.approvedEvidenceHash || '',
            },
            ...templateProjection,
            authoritativeDrawingPreviewBindingHash: previewBindingHash,
            candidate: dynamicCandidate,
            issued: dynamicIssued,
            actorId: 'office-user',
            timestamp,
        });

        assert.equal(prepared.candidatePageCount, 57);
        assert.deepEqual((prepared.candidateArtifact as UnknownRecord).pageManifest, dynamicManifest);
        assert.equal(projection.exportCreate.pageCount, 57);
        assert.deepEqual((projection.exportCreate.artifact as UnknownRecord).pageManifest, dynamicManifest);
        assert.equal(projection.jobUpdate.issuedPageCount, 57);
        assert.deepEqual((projection.jobUpdate.issuedArtifact as UnknownRecord).pageManifest, dynamicManifest);
        assert.equal(projection.planUpdate.issuedExportPageCount, 57);
    });

    it('projects PREPARE then atomically issues and supersedes every authority record', () => {
        const preparedJob = buildPreparedPdfJobProjection({
            jobCore,
            candidate,
            actorId: 'office-user',
            timestamp,
        });
        assert.equal(preparedJob.status, 'READY_FOR_VISUAL_CHECK');
        assert.equal(preparedJob.candidateStorageGeneration, candidate.storageGeneration);
        assert.equal(preparedJob.candidateSha256, candidate.sha256);
        assert.equal(preparedJob.authoritativeDrawingPreviewBindingHash, previewBindingHash);

        const before = {
            plan: {
                id: planId,
                status: 'approved_pending_issue',
                lockVersion: 4,
                approvedSnapshotHash: candidate.snapshotHash,
            } as UnknownRecord,
            job: preparedJob,
            series: {
                id: 'series-1',
                latestRevisionNo: 2,
                latestPlanId: planId,
                latestIssuedPlanId: supersedesPlanId,
            } as UnknownRecord,
            supersededPlan: {
                id: supersedesPlanId,
                status: 'issued',
                lockVersion: 9,
            } as UnknownRecord,
            events: [] as UnknownRecord[],
        };
        assert.equal(decideIssuedPdfTransactionDisposition({
            planStatus: before.plan.status,
            planJobId: before.plan.issuedExportJobId,
            planExportId: before.plan.issuedExportId,
            jobStatus: before.job.status,
            exportExists: false,
            expectedJobId: jobId,
            expectedExportId: exportId,
            terminalArtifactsMatch: false,
        }), 'apply');

        const projection = buildIssuedPdfAtomicProjection({
            tradeType: 'system-scaffold',
            planId,
            jobId,
            exportId,
            siteId: 'site-1',
            documentNo: 'CP-001',
            documentNoKey: 'cp-001',
            revision: 2,
            seriesId: 'series-1',
            lineageRootPlanId: supersedesPlanId,
            currentPlanLockVersion: 4,
            supersedesPlanId,
            supersededSourceLockVersion: 9,
            issueEventId: 'event-issue',
            supersedeEventId: 'event-supersede',
            snapshot: {
                id: binding.approvedSnapshotId,
                hash: candidate.snapshotHash,
                storagePath: binding.approvedSnapshotStoragePath,
                storageGeneration: binding.approvedSnapshotStorageGeneration,
                byteLength: 48000,
            },
            approval: {
                evidenceId: binding.approvedEvidenceId || '',
                evidenceHash: binding.approvedEvidenceHash || '',
            },
            ...templateProjection,
            authoritativeDrawingPreviewBindingHash: previewBindingHash,
            candidate,
            issued,
            actorId: 'office-user',
            actorName: '본사 담당자',
            timestamp,
        });
        assert.equal(projection.seriesCreate.tradeType, 'system-scaffold');
        const after = applyProjectionAtomically(before, projection);

        assert.equal(after.plan.status, 'issued');
        assert.equal(after.plan.issuedExportStorageGeneration, issued.storageGeneration);
        assert.equal(after.plan.issuedCandidateStorageGeneration, candidate.storageGeneration);
        assert.equal(after.job.status, 'ISSUED');
        assert.equal(after.job.issuedArtifact, issued);
        assert.equal(after.exported.storageGeneration, issued.storageGeneration);
        assert.equal(after.exported.candidateSha256, candidate.sha256);
        assert.equal(after.series.latestIssuedPlanId, planId);
        assert.equal(after.supersededPlan.status, 'superseded');
        assert.equal(after.supersededPlan.supersededByPlanId, planId);
        assert.deepEqual(after.events.map((event) => event.type), ['supersede', 'issue']);
        assert.notEqual(
            after.exported.authoritativeDrawingPreviewBindingHash,
            after.exported.drawingBindingHash,
        );

        assert.doesNotThrow(() => assertExistingIssuedRedundantAudit(
            after.plan,
            after.job,
            after.exported,
            exportId,
            binding,
            candidate,
            issued,
        ));
    });

    it('recovers response loss and concurrent finalize idempotently, including later superseded plans', () => {
        const preparedJob = buildPreparedPdfJobProjection({
            jobCore,
            candidate,
            actorId: 'office-user',
            timestamp,
        });
        const projection = buildIssuedPdfAtomicProjection({
            tradeType: 'system-shoring',
            planId,
            jobId,
            exportId,
            siteId: 'site-1',
            documentNo: 'CP-001',
            documentNoKey: 'cp-001',
            revision: 2,
            seriesId: 'series-1',
            lineageRootPlanId: planId,
            currentPlanLockVersion: 0,
            issueEventId: 'event-issue',
            snapshot: {
                id: binding.approvedSnapshotId,
                hash: candidate.snapshotHash,
                storagePath: binding.approvedSnapshotStoragePath,
                storageGeneration: binding.approvedSnapshotStorageGeneration,
                byteLength: 48000,
            },
            approval: {
                evidenceId: binding.approvedEvidenceId || '',
                evidenceHash: binding.approvedEvidenceHash || '',
            },
            ...templateProjection,
            authoritativeDrawingPreviewBindingHash: previewBindingHash,
            candidate,
            issued,
            actorId: 'office-user',
            timestamp,
        });
        const terminal = applyProjectionAtomically({
            plan: { id: planId, status: 'approved_pending_issue' },
            job: preparedJob,
            series: {},
            supersededPlan: {},
            events: [],
        }, projection);
        assert.equal(projection.seriesCreate.tradeType, 'system-shoring');
        const artifactsMatch = terminalIssuedPdfArtifactsMatch(
            terminal.job.issuedArtifact,
            terminal.exported.artifact,
            issued,
        );
        const decision = (status: 'issued' | 'superseded') => decideIssuedPdfTransactionDisposition({
            planStatus: status,
            planJobId: terminal.plan.issuedExportJobId,
            planExportId: terminal.plan.issuedExportId,
            jobStatus: terminal.job.status,
            exportExists: true,
            expectedJobId: jobId,
            expectedExportId: exportId,
            terminalArtifactsMatch: artifactsMatch,
        });
        assert.equal(decision('issued'), 'idempotent');
        assert.equal(decision('superseded'), 'idempotent');

        const corruptedPlan = {
            ...terminal.plan,
            issuedExportStorageGeneration: '9999999999999999',
        };
        assert.throws(() => assertExistingIssuedRedundantAudit(
            corruptedPlan,
            terminal.job,
            terminal.exported,
            exportId,
            binding,
            candidate,
            issued,
        ), (error: unknown) => (error as { code?: string }).code === 'data-loss');

        assert.equal(decideIssuedPdfTransactionDisposition({
            planStatus: 'issued',
            planJobId: jobId,
            planExportId: exportId,
            jobStatus: 'ISSUED',
            exportExists: true,
            expectedJobId: jobId,
            expectedExportId: exportId,
            terminalArtifactsMatch: terminalIssuedPdfArtifactsMatch(
                { ...issued, storageGeneration: 'forged' },
                terminal.exported.artifact,
                issued,
            ),
        }), 'conflict');
    });
});
