import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
    issueConstructionPlanServer,
    parseIssueRequest,
    parsePrepareIssuedPdfRequest,
    prepareConstructionPlanIssuedPdfServer,
} from './callables';
import {
    issueConstructionPlanServer as indexedIssue,
    prepareConstructionPlanIssuedPdfServer as indexedPrepare,
} from './index';

const source = readFileSync(join(__dirname, '../../src/constructionPlans/callables.ts'), 'utf8');
const constructionPlanIndexSource = readFileSync(
    join(__dirname, '../../src/constructionPlans/index.ts'),
    'utf8',
);
const rootIndexSource = readFileSync(join(__dirname, '../../src/index.ts'), 'utf8');
const transitionSource = readFileSync(
    join(__dirname, '../../src/constructionPlans/issuedPdfTransition.ts'),
    'utf8',
);

const sourceBlock = (start: string, end: string): string => {
    const startIndex = source.indexOf(start);
    const endIndex = source.indexOf(end, startIndex + start.length);
    assert.ok(startIndex >= 0, `missing block start: ${start}`);
    assert.ok(endIndex > startIndex, `missing block end: ${end}`);
    return source.slice(startIndex, endIndex);
};

describe('server-authoritative construction plan issued PDF callables', () => {
    it('exports PREPARE and FINALIZE as 1GiB/300s callables from both indexes', () => {
        assert.equal(indexedPrepare, prepareConstructionPlanIssuedPdfServer);
        assert.equal(indexedIssue, issueConstructionPlanServer);
        [prepareConstructionPlanIssuedPdfServer, issueConstructionPlanServer].forEach((callable) => {
            const trigger = (callable as unknown as {
                __trigger: { timeout: string; availableMemoryMb: number; regions: string[] };
            }).__trigger;
            assert.equal(trigger.timeout, '300s');
            assert.equal(trigger.availableMemoryMb, 1024);
            assert.deepEqual(trigger.regions, ['asia-northeast3']);
        });
        assert.match(constructionPlanIndexSource, /prepareConstructionPlanIssuedPdfServer/);
        assert.match(rootIndexSource, /prepareConstructionPlanIssuedPdfServer/);
    });

    it('uses exact-key request contracts and rejects every legacy client PDF input', () => {
        const parsers = sourceBlock('const assertNoClientPdfInput', 'const rejectServerOwnedPlanFields');
        assert.match(parsers, /assertExactServerPdfRequestKeys\(record, \['planId', 'approvedSnapshotHash'\]\)/);
        assert.match(parsers, /'planId', 'jobId', 'expectedCandidateSha256', 'approvedSnapshotHash', 'visualCheckConfirmed'/);
        assert.match(parsers, /'storagePath', 'expectedSha256', 'bytes', 'candidatePdf', 'pdf'/);
        assert.doesNotMatch(parsers, /storagePath:\s*requireString\(record/);
        const hash = 'a'.repeat(64);
        assert.deepEqual(parsePrepareIssuedPdfRequest({ planId: 'plan-1', approvedSnapshotHash: hash }), {
            planId: 'plan-1', approvedSnapshotHash: hash,
        });
        assert.throws(
            () => parsePrepareIssuedPdfRequest({ planId: 'plan-1', approvedSnapshotHash: hash, fileName: 'x.pdf' }),
            (error: unknown) => (error as { code?: string }).code === 'invalid-argument',
        );
        assert.throws(
            () => parseIssueRequest({
                planId: 'plan-1',
                storagePath: 'construction-plans/site/plan/exports/client.pdf',
                expectedSha256: hash,
                approvedSnapshotHash: hash,
                visualCheckConfirmed: true,
            }),
            (error: unknown) => (error as { code?: string }).code === 'invalid-argument',
        );
        assert.throws(
            () => parseIssueRequest({
                planId: 'plan-1',
                jobId: 'job-1',
                expectedCandidateSha256: hash,
                approvedSnapshotHash: hash,
                visualCheckConfirmed: true,
                metadata: {},
            }),
            (error: unknown) => (error as { code?: string }).code === 'invalid-argument',
        );
    });

    it('prepares only from schema-v2 immutable snapshot, approval evidence, and authoritative drawings', () => {
        const preparation = sourceBlock(
            'export const prepareConstructionPlanIssuedPdfServer',
            'export const issueConstructionPlanServer',
        );
        assert.match(preparation, /requireIssueAccess\(actor\)/);
        assert.match(preparation, /assertPlanParticipantAccess\(preflightPlan, actor\)/);
        assert.match(preparation, /loadApprovedPdfSnapshotContext/);
        assert.match(preparation, /renderApprovedFieldUsePdf\('candidate', approved\)/);
        assert.match(preparation, /storeImmutableConstructionPlanServerPdf/);
        assert.match(preparation, /verifyPersistedServerPdfArtifact/);
        assert.match(preparation, /collection\(EXPORT_JOBS_COLLECTION\)/);
        assert.match(preparation, /buildPreparedPdfJobProjection/);
        assert.match(transitionSource, /status: 'READY_FOR_VISUAL_CHECK'/);
        assert.match(transitionSource, /candidateStorageGeneration/);
    });

    it('finalizes only the exact job candidate and preserves the visual-check audit chain', () => {
        const finalize = sourceBlock(
            'export const issueConstructionPlanServer',
            'export const ensureConstructionPlanDrawingPreviewServer',
        );
        const retry = finalize.indexOf('existingIssuedResponse(request, preflightPlan)');
        const snapshotLoad = finalize.indexOf('loadApprovedPdfSnapshotContext(');
        assert.ok(retry >= 0 && snapshotLoad > retry, 'issued retry must precede snapshot/drawing source reads');
        assert.match(finalize, /status !== 'READY_FOR_VISUAL_CHECK'/);
        assert.match(finalize, /request\.expectedCandidateSha256/);
        assert.match(finalize, /renderApprovedFieldUsePdf\('issued', approved\)/);
        assert.match(finalize, /assertSharedFieldUseProvenance/);
        assert.match(finalize, /buildIssuedPdfAtomicProjection/);
        assert.match(finalize, /transaction\.create\(exportRef, projection\.exportCreate\)/);
        assert.match(finalize, /transaction\.update\(jobRef, projection\.jobUpdate\)/);
        assert.match(finalize, /transaction\.update\(planRef/);
        assert.match(transitionSource, /issuedArtifact: input\.issued/);
        assert.match(transitionSource, /issuedExportJobId: input\.jobId/);
        assert.match(finalize, /candidateStorageGeneration/);
        assert.match(finalize, /assertExportJobTopLevelCandidateAudit\(latestJob, verifiedCandidate\.record\)/);
        assert.match(finalize, /READY job에 issued export가 비정상적으로 선점/);
        assert.match(transitionSource, /visualCheckedBy: input\.actorId/);
        assert.match(transitionSource, /visualCheckedAt: input\.timestamp/);
        assert.doesNotMatch(finalize, /request\.storagePath|request\.expectedSha256|buildIssuedPdfCandidatePath/);
    });

    it('fails closed on terminal retry when any plan, job, or export audit projection drifts', () => {
        const redundantAudit = sourceBlock(
            'const assertExistingIssuedRedundantAudit',
            'const existingIssuedResponse',
        );
        [
            'issuedStorageGeneration',
            'issuedRenderInputHash',
            'issuedExportStorageGeneration',
            'issuedCandidateStorageGeneration',
            'issuedApprovedContentHash',
            'issuedDrawingBindingHash',
            'issuedAuthoritativeDrawingPreviewBindingHash',
            'candidateStorageGeneration',
            'authoritativeDrawingPreviewBindingHash',
            'visualCheckedAt',
        ].forEach((field) => assert.match(redundantAudit, new RegExp(field)));
        const retry = sourceBlock(
            'const existingIssuedResponse',
            '// Server-authoritative PREPARE',
        );
        assert.equal((retry.match(/verifyPersistedServerPdfArtifact\(/g) || []).length, 2);
        assert.match(retry, /assertSharedFieldUseProvenance/);
        assert.match(retry, /assertExistingIssuedRedundantAudit/);
    });

    it('reopens every stored PDF and validates A4 pages, forbidden features, and audit markers', () => {
        const audit = sourceBlock('const assertFieldUsePdfPhysicalAudit', 'const loadApprovedPdfSnapshotContext');
        assert.match(audit, /PDFParse/);
        assert.match(audit, /parsePageInfo: true/);
        assert.match(audit, /595\.28/);
        assert.match(audit, /841\.89/);
        assert.match(audit, /getAttachments/);
        assert.match(audit, /getJSActions/);
        assert.match(audit, /getOpenAction/);
        assert.match(audit, /getPermissions/);
        assert.match(audit, /validateConstructionPlanFieldUseAuditPages/);
    });

    it('maps safe renderer validation codes to an actionable failed-precondition', () => {
        const rendering = sourceBlock('const renderApprovedFieldUsePdf', 'const buildExportJobId');
        assert.match(rendering, /construction-plan-field-use-/);
        assert.match(rendering, /'failed-precondition'/);
        assert.match(rendering, /errorCode: rawCode/);
        assert.match(rendering, /발행 데이터 또는 고정 A4 레이아웃을 보완/);
        assert.match(rendering, /Unexpected field-use renderer failure/);
    });
});
