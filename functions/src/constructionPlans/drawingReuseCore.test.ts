import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    applyConstructionPlanImportedDrawingProjection,
    buildConstructionPlanDrawingReuseProjection,
    projectConstructionPlanDrawingSourceBinding,
    projectConstructionPlanDrawingSourceBindings,
    type ConstructionPlanDrawingCopyBinding,
} from './drawingReuseCore';

type RecordValue = Record<string, unknown>;

const SHA = 'a'.repeat(64);
const SOURCE_PATH = 'construction-plans/site-1/plan-source/drawings/drawing-1/rev-2/source.png';
const TARGET_PATH = 'construction-plans/site-1/plan-target/drawings/drawing-1/rev-1/source.png';

const annotation = (): RecordValue => ({
    id: 'annotation-1',
    pageIndex: 0,
    pageFingerprint: 'page-fingerprint',
    layer: 'install',
    geometry: { kind: 'polygon', vertices: [{ x: 0.1, y: 0.1 }, { x: 0.8, y: 0.1 }, { x: 0.4, y: 0.8 }] },
    style: {
        strokeToken: 'construction-plan.install.stroke',
        fillToken: 'construction-plan.install.fill',
        strokeWidthPt: 2,
        opacity: 0.4,
        dash: 'solid',
        hatch: 'diagonal',
    },
    label: '설치 구간',
    zoneCode: 'A',
    sequence: 1,
    startDate: '2026-09-01',
    endDate: '2026-09-30',
    reason: '승인 작업순서 유지',
    releaseCondition: '검측 승인 후 해제',
    equipmentType: '이동식 크레인',
    equipmentId: 'equipment-1',
    entrance: '동문',
    destination: 'A동 작업층',
    radius: 12.5,
    responsibleWorkerId: 'worker-1',
    responsibleRole: '통제담당',
    materialType: '시스템동바리 수직재',
    styleVersion: 1,
    locked: true,
    createdBy: 'worker-1',
    createdAt: '2026-08-22T00:00:00.000Z',
    updatedBy: 'worker-2',
    updatedAt: '2026-08-22T01:00:00.000Z',
    residentRegistrationNo: 'must-not-copy',
});

const drawing = (): RecordValue => ({
    id: 'drawing-1',
    planId: 'plan-source',
    storagePath: SOURCE_PATH,
    sourceSha256: SHA,
    sourceGeneration: '123456',
    originalFileName: '구조도.png',
    mimeType: 'image/png',
    sizeBytes: 128,
    pageCount: 1,
    drawingNo: 'D-01',
    title: '설치 평면도',
    revision: 'A',
    approvalStatus: 'approved',
    approvalReference: 'APPROVAL-SECRET',
    approvedAt: '2026-08-01T00:00:00.000Z',
    applicableZones: ['A구간'],
    scaleText: '1/100',
    previewStatus: 'ready',
    previewPaths: ['construction-plans/site-1/plan-source/previews/page-1.png'],
    previewErrorCode: 'OLD',
    pages: [{ pageIndex: 0, previewPath: 'old-preview', previewGeneration: '99' }],
    annotations: [annotation()],
    uploadedBy: 'worker-1',
    uploadedAt: '2026-08-01T00:00:00.000Z',
    privateWorkerPhone: 'must-not-copy',
});

const sourcePlan = (): RecordValue => ({
    id: 'plan-source',
    siteId: 'site-1',
    drawings: [drawing()],
    sections: [{
        id: 'section-drawing',
        key: 'drawings',
        kind: 'drawing-page',
        title: 'D-01 설치 평면도',
        status: 'complete',
        content: {
            drawingId: 'drawing-1',
            drawingPageIndex: 0,
            drawingStudio: {
                schemaVersion: 1,
                background: {
                    fileName: '구조도.png',
                    mimeType: 'image/png',
                    sizeBytes: 128,
                    kind: 'image',
                    storagePath: SOURCE_PATH,
                    sourceUrl: 'blob:must-not-copy',
                },
                preview: { status: 'ready', sourceUrl: 'blob:must-not-copy' },
                objects: [{
                    id: 'object-1',
                    kind: 'polygon',
                    layer: 'install',
                    points: [{ x: 0.1, y: 0.1 }, { x: 0.8, y: 0.1 }, { x: 0.4, y: 0.8 }],
                    label: '설치 구간',
                    zoneCode: 'A',
                    sequence: 1,
                    startDate: '2026-09-01',
                    endDate: '2026-09-30',
                    reason: '승인 작업순서 유지',
                    releaseCondition: '검측 승인 후 해제',
                    equipmentType: '이동식 크레인',
                    equipmentId: 'equipment-1',
                    entrance: '동문',
                    destination: 'A동 작업층',
                    radius: 12.5,
                    responsibleWorkerId: 'worker-1',
                    responsibleRole: '통제담당',
                    materialType: '시스템동바리 수직재',
                    locked: true,
                    runtimeOnly: 'must-not-copy',
                }],
            },
        },
    }],
    drawingApplicability: [{
        drawingSlot: 'D-01',
        decision: 'applicable',
        drawingId: 'drawing-1',
        reason: '승인 완료',
        reviewedBy: 'reviewer-1',
        technicalReviewReference: 'TECH-1',
    }],
});

const copyBinding = (overrides: Partial<ConstructionPlanDrawingCopyBinding> = {}): ConstructionPlanDrawingCopyBinding => ({
    ...projectConstructionPlanDrawingSourceBinding({
        plan: sourcePlan(),
        drawing: drawing(),
    }),
    targetPlanId: 'plan-target',
    targetDrawingId: 'drawing-1',
    targetStoragePath: TARGET_PATH,
    targetGeneration: '654321',
    ...overrides,
});

describe('construction plan drawing reuse core', () => {
    it('requires an exact canonical source path, immutable generation, SHA and plan binding', () => {
        const binding = projectConstructionPlanDrawingSourceBinding({
            plan: sourcePlan(),
            drawing: drawing(),
        });
        assert.equal(binding.sourceRevision, 2);
        assert.equal(binding.sourceGeneration, '123456');
        assert.equal(binding.sourceSha256, SHA);

        const legacy = drawing();
        delete legacy.sourceGeneration;
        assert.throws(
            () => projectConstructionPlanDrawingSourceBinding({ plan: sourcePlan(), drawing: legacy }),
            /source-generation-missing/,
        );

        const crossPlan = { ...drawing(), storagePath: SOURCE_PATH.replace('plan-source', 'other-plan') };
        assert.throws(
            () => projectConstructionPlanDrawingSourceBinding({ plan: sourcePlan(), drawing: crossPlan }),
            /source-path-invalid/,
        );
    });

    it('rejects duplicate drawing ids and source paths before any target projection', () => {
        const plan = sourcePlan();
        plan.drawings = [drawing(), { ...drawing() }];
        assert.throws(() => projectConstructionPlanDrawingSourceBindings(plan), /duplicate-binding/);
    });

    it('rebinds drawings and sections to the target while resetting approvals and previews', () => {
        const source = sourcePlan();
        const projection = buildConstructionPlanDrawingReuseProjection({
            sourcePlan: source,
            bindings: [copyBinding()],
            actorId: 'copy-actor',
            timestamp: '2026-08-22T02:00:00.000Z',
        });
        const reused = projection.drawings[0];
        assert.equal(reused.planId, 'plan-target');
        assert.equal(reused.storagePath, TARGET_PATH);
        assert.equal(reused.sourceGeneration, '654321');
        assert.equal(reused.sourceRevision, 1);
        assert.equal(reused.sourceSha256, SHA);
        assert.equal(reused.approvalStatus, 'draft');
        assert.equal(reused.approvalReference, undefined);
        assert.equal(reused.approvedAt, undefined);
        assert.equal(reused.previewStatus, 'ready');
        assert.deepEqual(reused.previewPaths, [TARGET_PATH]);
        assert.deepEqual(reused.pages, []);
        assert.equal(reused.previewErrorCode, undefined);
        assert.equal(reused.privateWorkerPhone, undefined);

        const copiedAnnotation = (reused.annotations as RecordValue[])[0];
        assert.equal(copiedAnnotation.label, '설치 구간');
        assert.equal(copiedAnnotation.locked, false);
        assert.equal(copiedAnnotation.residentRegistrationNo, undefined);
        assert.deepEqual({
            sequence: copiedAnnotation.sequence,
            startDate: copiedAnnotation.startDate,
            endDate: copiedAnnotation.endDate,
            reason: copiedAnnotation.reason,
            releaseCondition: copiedAnnotation.releaseCondition,
            equipmentType: copiedAnnotation.equipmentType,
            equipmentId: copiedAnnotation.equipmentId,
            entrance: copiedAnnotation.entrance,
            destination: copiedAnnotation.destination,
            radius: copiedAnnotation.radius,
            responsibleWorkerId: copiedAnnotation.responsibleWorkerId,
            responsibleRole: copiedAnnotation.responsibleRole,
            materialType: copiedAnnotation.materialType,
        }, {
            sequence: 1,
            startDate: '2026-09-01',
            endDate: '2026-09-30',
            reason: '승인 작업순서 유지',
            releaseCondition: '검측 승인 후 해제',
            equipmentType: '이동식 크레인',
            equipmentId: 'equipment-1',
            entrance: '동문',
            destination: 'A동 작업층',
            radius: 12.5,
            responsibleWorkerId: 'worker-1',
            responsibleRole: '통제담당',
            materialType: '시스템동바리 수직재',
        });
        assert.notEqual(copiedAnnotation, (drawing().annotations as RecordValue[])[0]);

        const section = projection.sections[0];
        const content = section.content as RecordValue;
        const studio = content.drawingStudio as RecordValue;
        const background = studio.background as RecordValue;
        assert.equal(content.drawingId, 'drawing-1');
        assert.equal(content.drawingPageIndex, 0);
        assert.equal(background.storagePath, TARGET_PATH);
        assert.equal(background.sourceUrl, undefined);
        assert.equal(studio.preview, undefined);
        assert.equal(((studio.objects as RecordValue[])[0]).locked, false);
        assert.equal(((studio.objects as RecordValue[])[0]).runtimeOnly, undefined);
        assert.equal(((studio.objects as RecordValue[])[0]).releaseCondition, '검측 승인 후 해제');
        assert.equal(section.status, 'in_progress');

        assert.deepEqual(projection.drawingApplicability, [{
            drawingSlot: 'D-01',
            decision: 'applicable',
            drawingId: 'drawing-1',
            reason: '재사용 도면의 현장 적용성 및 승인근거 재검토 필요',
        }]);
        assert.equal((source.drawings as RecordValue[])[0].storagePath, SOURCE_PATH);
    });

    it('forces copied PDFs back through target-plan preview generation', () => {
        const pdfPath = 'construction-plans/site-1/plan-source/drawings/drawing-1/rev-2/source.pdf';
        const pdfDrawing = {
            ...drawing(),
            storagePath: pdfPath,
            mimeType: 'application/pdf',
            originalFileName: '구조도.pdf',
        };
        const plan = { ...sourcePlan(), drawings: [pdfDrawing] };
        const sourceBinding = projectConstructionPlanDrawingSourceBinding({ plan, drawing: pdfDrawing });
        const targetPath = 'construction-plans/site-1/plan-target/drawings/drawing-1/rev-1/source.pdf';
        const projection = buildConstructionPlanDrawingReuseProjection({
            sourcePlan: plan,
            bindings: [{
                ...sourceBinding,
                targetPlanId: 'plan-target',
                targetDrawingId: 'drawing-1',
                targetStoragePath: targetPath,
                targetGeneration: '777',
            }],
            actorId: 'copy-actor',
            timestamp: '2026-08-22T02:00:00.000Z',
        });
        assert.equal(projection.drawings[0].previewStatus, 'pending');
        assert.deepEqual(projection.drawings[0].previewPaths, []);
        assert.deepEqual(projection.drawings[0].pages, []);
    });

    it('imports a selected source drawing without overwriting existing target drawings', () => {
        const target = {
            id: 'plan-target',
            siteId: 'site-1',
            status: 'draft',
            lockVersion: 4,
            sections: [{
                id: 'target-section',
                kind: 'drawing-page',
                title: 'D-01 설치 평면도',
                status: 'empty',
                content: {},
            }],
            drawings: [{ id: 'existing', planId: 'plan-target' }],
            drawingApplicability: [],
            releaseReadiness: { requiredReviewsComplete: true, pdfVisualCheckPassed: true },
        };
        const binding = copyBinding({ targetDrawingId: 'drawing-imported' });
        const result = applyConstructionPlanImportedDrawingProjection({
            targetPlan: target,
            targetSectionId: 'target-section',
            binding,
            actorId: 'copy-actor',
            timestamp: '2026-08-22T02:00:00.000Z',
        });
        assert.equal(result.lockVersion, 5);
        assert.equal((result.plan.drawings as unknown[]).length, 2);
        assert.equal((result.section.content as RecordValue).drawingId, 'drawing-imported');
        assert.deepEqual(result.plan.drawingApplicability, [{
            drawingSlot: 'D-01',
            decision: 'applicable',
            drawingId: 'drawing-imported',
            reason: '재사용 도면의 현장 적용성 및 승인근거 재검토 필요',
        }]);
        assert.equal((result.plan.releaseReadiness as RecordValue).requiredReviewsComplete, false);
        assert.equal((result.plan.releaseReadiness as RecordValue).pdfVisualCheckPassed, false);
    });
});
