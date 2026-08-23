import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
    buildConstructionPlanDrawingCanonicalPath,
    buildFinalizedConstructionPlanDrawingProjection,
    detectConstructionPlanDrawingMimeType,
    nextConstructionPlanDrawingSourceRevision,
    validateConstructionPlanDrawingSourceBytes,
} from './drawingUpload';

const digest = (bytes: Buffer): string =>
    require('node:crypto').createHash('sha256').update(bytes).digest('hex');

test('drawing source revisions advance only from canonical immutable paths', () => {
    assert.equal(nextConstructionPlanDrawingSourceRevision(undefined), 1);
    assert.equal(nextConstructionPlanDrawingSourceRevision('legacy/random/source.pdf'), 1);
    assert.equal(nextConstructionPlanDrawingSourceRevision(
        'construction-plans/site-a/plan-a/drawings/drawing-a/rev-7/source.pdf',
    ), 8);
});

test('canonical path binds site, plan, drawing, revision, and MIME extension', () => {
    assert.equal(buildConstructionPlanDrawingCanonicalPath({
        siteId: 'site-a',
        planId: 'plan-a',
        drawingId: 'drawing-equipment-layout',
        sourceRevision: 2,
        mimeType: 'image/jpeg',
    }), 'construction-plans/site-a/plan-a/drawings/drawing-equipment-layout/rev-2/source.jpg');
    assert.throws(() => buildConstructionPlanDrawingCanonicalPath({
        siteId: '../escape',
        planId: 'plan-a',
        drawingId: 'drawing-a',
        sourceRevision: 1,
        mimeType: 'image/png',
    }), /path-segment-invalid/);
});

test('MIME is detected from magic bytes instead of caller metadata', () => {
    assert.equal(detectConstructionPlanDrawingMimeType(Buffer.from('%PDF-1.7\n')), 'application/pdf');
    assert.equal(detectConstructionPlanDrawingMimeType(Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ])), 'image/png');
    assert.equal(detectConstructionPlanDrawingMimeType(Buffer.from([0xff, 0xd8, 0xff, 0xe0])), 'image/jpeg');
    assert.equal(detectConstructionPlanDrawingMimeType(Buffer.from('<svg/>')), null);
});

test('source validation fails closed on size, magic, or SHA mismatch', () => {
    const bytes = Buffer.from('%PDF-1.7\nverified drawing');
    validateConstructionPlanDrawingSourceBytes({
        bytes,
        expectedMimeType: 'application/pdf',
        expectedSizeBytes: bytes.byteLength,
        expectedSha256: digest(bytes),
    });
    assert.throws(() => validateConstructionPlanDrawingSourceBytes({
        bytes,
        expectedMimeType: 'image/png',
        expectedSizeBytes: bytes.byteLength,
        expectedSha256: digest(bytes),
    }), /magic-mismatch/);
    assert.throws(() => validateConstructionPlanDrawingSourceBytes({
        bytes,
        expectedMimeType: 'application/pdf',
        expectedSizeBytes: bytes.byteLength + 1,
        expectedSha256: digest(bytes),
    }), /size-mismatch/);
    assert.throws(() => validateConstructionPlanDrawingSourceBytes({
        bytes,
        expectedMimeType: 'application/pdf',
        expectedSizeBytes: bytes.byteLength,
        expectedSha256: '0'.repeat(64),
    }), /sha256-mismatch/);
});

test('finalization projection resets stale approval and annotations and advances lock atomically', () => {
    const plan = {
        id: 'plan-a',
        siteId: 'site-a',
        status: 'draft',
        lockVersion: 4,
        projectSnapshot: { zones: ['A구간'] },
        sections: [{
            id: 'equipment-layout',
            key: 'equipment-layout',
            title: 'D-01 장비 배치도',
            kind: 'drawing-page',
            order: 8,
            pageNumbers: [9],
            required: true,
            status: 'complete',
            content: { drawingId: 'drawing-equipment-layout', old: 'preserved' },
        }],
        drawings: [{
            id: 'drawing-equipment-layout',
            storagePath: 'construction-plans/site-a/plan-a/drawings/drawing-equipment-layout/rev-1/source.pdf',
            sourceSha256: '1'.repeat(64),
            sourceGeneration: '7',
            drawingNo: 'D-01',
            title: '장비 배치도',
            revision: '승인 Rev.1',
            approvalStatus: 'approved',
            approvalReference: '승인-001',
            applicableZones: ['기존구간'],
            annotations: [{ id: 'stale' }],
        }],
        drawingApplicability: [{
            drawingSlot: 'D-01',
            decision: 'applicable',
            drawingId: 'drawing-equipment-layout',
            reason: '기존 승인',
        }],
    };
    const projection = buildFinalizedConstructionPlanDrawingProjection({
        plan,
        session: {
            schemaVersion: 1,
            id: 'session-a',
            ownerId: 'author-a',
            siteId: 'site-a',
            planId: 'plan-a',
            sectionId: 'equipment-layout',
            drawingId: 'drawing-equipment-layout',
            originalFileName: 'approved-plan.pdf',
            mimeType: 'application/pdf',
            sizeBytes: 128,
            sha256: '2'.repeat(64),
            sourceRevision: 2,
            stagingPath: 'construction-plan-staging/author-a/session-a/source',
            canonicalPath: 'construction-plans/site-a/plan-a/drawings/drawing-equipment-layout/rev-2/source.pdf',
            baseSourceBindingHash: '3'.repeat(64),
            requestFingerprint: '4'.repeat(64),
            idempotencyKeyHash: '5'.repeat(64),
            idempotencyKey: 'request-a',
            status: 'awaiting_upload',
            createdAt: '2026-08-22T00:00:00.000Z',
            createdAtEpochMs: 1,
            expiresAt: '2026-08-22T00:30:00.000Z',
            expiresAtEpochMs: 2,
            cleanupAfterEpochMs: 2,
        },
        actorId: 'author-a',
        canonicalGeneration: '9',
        now: '2026-08-22T00:10:00.000Z',
    });
    assert.equal(projection.lockVersion, 5);
    assert.equal(projection.drawing.storagePath,
        'construction-plans/site-a/plan-a/drawings/drawing-equipment-layout/rev-2/source.pdf');
    assert.equal(projection.drawing.approvalStatus, 'draft');
    assert.equal(projection.drawing.revision, '');
    assert.equal('approvalReference' in projection.drawing, false);
    assert.deepEqual(projection.drawing.annotations, []);
    assert.equal((projection.section.content as Record<string, unknown>).old, 'preserved');
    assert.equal((projection.plan as Record<string, unknown>).updatedBy, 'author-a');
});
