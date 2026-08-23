import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { ensureConstructionPlanDrawingPreviewServer } from './callables';
import { ensureConstructionPlanDrawingPreviewServer as indexedPreviewCallable } from './index';

const source = readFileSync(join(__dirname, '../../src/constructionPlans/callables.ts'), 'utf8');
const constructionPlanIndexSource = readFileSync(
    join(__dirname, '../../src/constructionPlans/index.ts'),
    'utf8',
);
const rootIndexSource = readFileSync(join(__dirname, '../../src/index.ts'), 'utf8');
const issuedTransitionSource = readFileSync(
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

const occurrences = (value: string, needle: string): number => value.split(needle).length - 1;

describe('construction plan drawing preview callable wiring', () => {
    it('exports a 1GiB/300s callable from both public indexes', () => {
        assert.equal(indexedPreviewCallable, ensureConstructionPlanDrawingPreviewServer);
        const trigger = (ensureConstructionPlanDrawingPreviewServer as unknown as {
            __trigger: { timeout: string; availableMemoryMb: number; regions: string[] };
        }).__trigger;
        assert.equal(trigger.timeout, '300s');
        assert.equal(trigger.availableMemoryMb, 1024);
        assert.deepEqual(trigger.regions, ['asia-northeast3']);
        assert.match(constructionPlanIndexSource, /ensureConstructionPlanDrawingPreviewServer/);
        assert.match(rootIndexSource, /ensureConstructionPlanDrawingPreviewServer/);
    });

    it('authenticates and rechecks mutation policy around the server pipeline', () => {
        const start = source.indexOf('export const ensureConstructionPlanDrawingPreviewServer');
        assert.ok(start >= 0);
        const block = source.slice(start);
        assert.match(block, /parseEnsureConstructionPlanDrawingPreviewRequest\(data\)/);
        assert.match(block, /resolveCallableActor\(context\)/);
        assert.match(block, /assertDrawingPreviewMutationAccess\(plan, actor\)/);
        assert.match(block, /ensureConstructionPlanDrawingPreview\(/);
        assert.match(block, /assertPlanMutationAllowed/);
    });

    it('guards submit, complete, approve, and issue with authoritative preflight plus transaction hash', () => {
        const submit = sourceBlock('const submitConstructionPlanReview', 'const runReviewTransition');
        const transition = sourceBlock('const runReviewTransition', 'const approveConstructionPlan');
        const approve = sourceBlock('const approveConstructionPlan', 'const createReviewComment');
        const reviewCallable = sourceBlock(
            'export const reviewConstructionPlanServer',
            'const pdfPipelineDataLoss',
        );
        const approvedPdfContext = sourceBlock(
            'const loadApprovedPdfSnapshotContext',
            'const loadImmutableDrawingSource',
        );
        const issue = sourceBlock(
            'export const issueConstructionPlanServer',
            'export const ensureConstructionPlanDrawingPreviewServer',
        );

        assert.ok(occurrences(submit, 'assertConstructionPlanDrawingPreviewBindingHash(') >= 2);
        assert.match(transition, /request\.action === 'complete_review'/);
        assert.ok(occurrences(transition, 'assertConstructionPlanDrawingPreviewBindingHash(') >= 2);
        assert.ok(occurrences(approve, 'assertConstructionPlanDrawingPreviewBindingHash(') >= 2);
        assert.match(reviewCallable, /verifyAuthoritativeDrawingPreviewsForRelease/);
        assert.match(approvedPdfContext, /assertAuthoritativeConstructionPlanDrawingPreviews/);
        assert.match(approvedPdfContext, /assertConstructionPlanDrawingPreviewBindingHash\(/);
        assert.match(issue, /loadApprovedPdfSnapshotContext/);
        assert.match(issue, /authoritativeDrawingPreviewBindingHash/);
        assert.match(issue, /buildIssuedPdfAtomicProjection/);
        assert.match(issuedTransitionSource, /authoritativeDrawingPreviews: true/);
    });
});
