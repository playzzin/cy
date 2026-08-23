import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PDFParse } from 'pdf-parse';
import {
    buildConstructionPlanDraftDocument,
    buildConstructionPlanReviewSnapshotContent,
    canonicalStringify,
    CONSTRUCTION_PLAN_RENDERER_VERSION,
    CONSTRUCTION_PLAN_TEMPLATE_PAGES,
    sha256Hex,
    validatePdfAuditPages,
    validatePdfEnvelope,
} from './domain';
import {
    assertConstructionPlanServerPdfFieldUseEligible,
    CONSTRUCTION_PLAN_SERVER_RENDERER_VERSION,
    EXECUTION_FORM_EMPTY_NOTICE,
    EXECUTION_FORM_EVIDENCE_NOTICE,
    getConstructionPlanRendererTemplateBundleHash,
    renderServerKoreanGlyphProbe,
    renderVerifiedConstructionPlanServerPdf,
    validateServerRendererAuditPages,
    validateShadowRendererSnapshotContent,
    verifyApprovedConstructionPlanSnapshot,
} from './serverPdfRenderer';

const buildSnapshot = (): { bytes: Buffer; hash: string } => {
    const planId = 'plan-server-pdf-1';
    const timestamp = '2026-08-22T00:00:00.000Z';
    const base = buildConstructionPlanDraftDocument({
        id: planId,
        seriesId: 'series-1',
        siteId: 'site-seoul-1',
        siteName: '청연 업무시설 증축공사',
        title: '지상 12층 시스템동바리 시공계획서',
        documentNo: 'CP-SH-2026-001',
        documentDate: '2026-08-22',
        projectSnapshot: {
            siteName: '청연 업무시설 증축공사',
            clientName: '청연건설',
            contractorName: '청연건설 원청사',
            address: '서울특별시 중구',
            buildings: ['A동'],
            floors: ['12F'],
            zones: ['1~4열'],
            sitePhotos: [],
            emergencyContactsComplete: true,
            differsFromMaster: false,
        },
        organizationSnapshot: {
            assignments: [
                {
                    id: 'site-manager',
                    role: 'site_manager',
                    label: '현장책임자',
                    required: true,
                    worker: { id: 'worker-1', name: '김현장', status: 'active', position: '현장소장' },
                    responsibilities: ['현장 총괄'],
                    order: 0,
                },
                {
                    id: 'safety-manager',
                    role: 'safety_manager',
                    label: '안전담당',
                    required: true,
                    worker: { id: 'worker-2', name: '박안전', status: 'active', position: '안전관리자' },
                    responsibilities: ['안전계획 및 점검'],
                    order: 2,
                },
            ],
            additionalWorkers: [],
        },
        participants: { authorIds: ['author-1'], reviewerIds: ['reviewer-1'], approverIds: ['approver-1'] },
        actorId: 'author-1',
        actorName: '김작성',
        timestamp,
    });
    const pageBox = { left: 0, bottom: 0, right: 595.28, top: 841.89 };
    const drawing = (id: string, hashCharacter: string) => ({
        id,
        planId,
        storagePath: `construction-plans/site-seoul-1/${planId}/drawings/${id}.pdf`,
        sourceSha256: hashCharacter.repeat(64),
        sourceGeneration: '1700000000000000',
        originalFileName: `${id}.pdf`,
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        pageCount: 1,
        drawingNo: id,
        title: `${id} 승인도면`,
        revision: 'A',
        approvalStatus: 'approved',
        approvalReference: `APPROVAL-${id}`,
        applicableZones: ['A동 12F 1~4열'],
        previewStatus: 'ready',
        previewPaths: [`construction-plans/site-seoul-1/${planId}/previews/${id}/${hashCharacter.repeat(64)}/page-0001.png`],
        pages: [{
            pageIndex: 0,
            mediaBoxPt: pageBox,
            cropBoxPt: pageBox,
            rotation: 0,
            pageFingerprint: `source:${hashCharacter.repeat(64)}:page:0`,
            previewPath: `construction-plans/site-seoul-1/${planId}/previews/${id}/${hashCharacter.repeat(64)}/page-0001.png`,
            previewGeneration: '1700000000000001',
            previewSha256: 'f'.repeat(64),
        }],
        annotations: [{
            id: `${id}-install`,
            pageIndex: 0,
            pageFingerprint: `source:${hashCharacter.repeat(64)}:page:0`,
            layer: id === 'D-01' ? 'install' : 'dismantle',
            geometry: { kind: 'rect', x: 0.1, y: 0.1, w: 0.4, h: 0.3, rotationDeg: 0 },
            style: { strokeToken: 'blue', strokeWidthPt: 2, opacity: 1, dash: 'solid', hatch: 'none' },
            label: `${id} 적용구간`,
            styleVersion: 1,
            locked: true,
            createdBy: 'author-1',
            createdAt: timestamp,
            updatedBy: 'author-1',
            updatedAt: timestamp,
        }],
        uploadedBy: 'author-1',
        uploadedAt: timestamp,
    });
    const releasePlan = {
        ...base,
        sections: (base.sections as Array<Record<string, unknown>>).map((section) => ({
            ...section,
            status: 'complete',
            content: {
                workMethod: `${section.key} 공정은 승인도면과 안전작업절차에 따라 수행한다.`,
                inspection: '작업 전·중·후 체크리스트를 확인한다.',
            },
        })),
        drawings: [drawing('D-01', 'a'), drawing('D-02', 'b')],
        drawingApplicability: [
            { drawingSlot: 'D-01', decision: 'applicable', drawingId: 'D-01', reason: '', reviewedBy: 'reviewer-1' },
            { drawingSlot: 'D-02', decision: 'applicable', drawingId: 'D-02', reason: '', reviewedBy: 'reviewer-1' },
            ...(['D-03', 'D-04', 'D-05', 'D-06'] as const).map((slot) => ({
                drawingSlot: slot,
                decision: 'not_applicable',
                reason: `${slot}은 현장 구조조건상 적용하지 않음`,
                reviewedBy: 'reviewer-1',
            })),
        ],
        engineeringValues: [{
            key: 'slabThickness',
            value: 250,
            unit: 'mm',
            sourceDocumentId: 'STRUCT-001',
            sourceRevision: 'A',
            sourcePageOrSection: 'S-101',
            applicableZones: ['A동 12F'],
            verificationStatus: 'approved',
            verifiedBy: 'engineer-1',
            verifiedAt: timestamp,
        }],
        equipmentPlan: [{
            id: 'equipment-1',
            category: 'lifting',
            equipmentName: '이동식크레인',
            model: 'KATO-25T',
            ratedCapacity: '25t',
            workRadius: '10m',
            inspectionValidUntil: '2099-12-31',
            operatorWorkerId: 'worker-1',
            signalerWorkerId: 'worker-2',
            workZones: ['A동 12F'],
            plannedStages: ['자재 양중'],
            controlMeasures: ['출입통제', '신호수 배치'],
        }],
        riskAssessments: [{
            id: 'risk-1',
            workStage: '자재 양중',
            hazard: '자재 낙하',
            initialRiskLevel: 'high',
            mitigationMeasures: ['양중구역 출입통제', '신호수 배치'],
            responsibleWorkerId: 'worker-2',
            residualRiskLevel: 'low',
            verifiedBy: 'reviewer-1',
        }],
    };
    const envelope = buildConstructionPlanReviewSnapshotContent(planId, releasePlan, 0);
    const bytes = Buffer.from(canonicalStringify(envelope), 'utf8');
    return { bytes, hash: sha256Hex(bytes) };
};

test('server renderer verifies canonical snapshot and emits a parseable 42-page Korean A4 PDF', async () => {
    const snapshot = buildSnapshot();
    const verified = verifyApprovedConstructionPlanSnapshot(snapshot.bytes, snapshot.hash, 'plan-server-pdf-1');
    const rendered = await renderVerifiedConstructionPlanServerPdf(verified);

    assert.equal(rendered.rendererVersion, CONSTRUCTION_PLAN_SERVER_RENDERER_VERSION);
    assert.equal(rendered.releaseEligible, false);
    assert.throws(
        () => assertConstructionPlanServerPdfFieldUseEligible(rendered),
        /shadow-not-release-eligible/,
    );
    assert.equal(rendered.pageCount, 42);
    assert.equal(rendered.pageManifest.length, 42);
    assert.equal(rendered.sha256, sha256Hex(rendered.bytes));
    assert.match(rendered.rendererTemplateBundleHash, /^[a-f0-9]{64}$/);
    assert.match(rendered.contentManifestHash, /^[a-f0-9]{64}$/);
    assert.equal(rendered.bytes.subarray(0, 5).toString('ascii'), '%PDF-');
    assert.ok(rendered.sizeBytes > 500_000);

    const retried = await renderVerifiedConstructionPlanServerPdf(verified);
    assert.equal(retried.sha256, rendered.sha256);
    assert.deepEqual(retried.bytes, rendered.bytes);

    const parser = new PDFParse({ data: rendered.bytes });
    try {
        const text = await parser.getText();
        assert.equal(text.total, 42);
        const pageTexts = text.pages.map((page) => page.text);
        const envelopeValidation = validatePdfEnvelope(rendered.bytes, text.total, rendered.sha256);
        assert.equal(envelopeValidation.valid, true, JSON.stringify(envelopeValidation.issues));
        const identityValidation = validatePdfAuditPages(pageTexts, {
            planId: 'plan-server-pdf-1',
            documentNo: 'CP-SH-2026-001',
            revision: 0,
            templateVersion: '1.0.0',
            snapshotHash: snapshot.hash,
        });
        assert.equal(identityValidation.valid, true, JSON.stringify(identityValidation.issues));
        const provenanceValidation = validateServerRendererAuditPages(pageTexts, rendered);
        assert.equal(provenanceValidation.valid, true, JSON.stringify(provenanceValidation.issues));
        assert.match(pageTexts[0], /시스템\s*동바리\s*시공계획서/);
        assert.match(pageTexts[5], /청연\s*업무시설\s*증축공사/);
        [13, 28, 39, 40, 41, 42].forEach((pageNumber) => {
            assert.ok(pageTexts[pageNumber - 1].includes(EXECUTION_FORM_EMPTY_NOTICE));
            assert.ok(pageTexts[pageNumber - 1].includes(EXECUTION_FORM_EVIDENCE_NOTICE));
        });

        const screenshots = await parser.getScreenshot({
            partial: [1, 42],
            desiredWidth: 420,
            imageBuffer: true,
            imageDataUrl: false,
        });
        assert.equal(screenshots.pages.length, 2);
        screenshots.pages.forEach((page) => {
            assert.ok(page.data && page.data.length > 10_000);
            assert.equal(page.data?.[0], 0x89);
            assert.equal(page.data?.[1], 0x50);
            assert.equal(page.data?.[2], 0x4e);
            assert.equal(page.data?.[3], 0x47);
        });
        const qaOutputDirectory = process.env.CONSTRUCTION_PLAN_SERVER_PDF_QA_DIR;
        if (qaOutputDirectory) {
            mkdirSync(qaOutputDirectory, { recursive: true });
            writeFileSync(join(qaOutputDirectory, 'construction-plan-server-shadow.pdf'), rendered.bytes);
            screenshots.pages.forEach((page, index) => {
                writeFileSync(join(qaOutputDirectory, `construction-plan-server-shadow-${index === 0 ? 'page-01' : 'page-42'}.png`), page.data);
            });
        }
    } finally {
        await parser.destroy();
    }
});

test('registered Noto Sans KR rasterizes distinct Hangul glyphs', () => {
    const first = renderServerKoreanGlyphProbe('한');
    const second = renderServerKoreanGlyphProbe('글');
    assert.ok(first.inkPixels > 200);
    assert.ok(second.inkPixels > 200);
    assert.notEqual(first.pixelHash, second.pixelHash);
    assert.equal(getConstructionPlanRendererTemplateBundleHash(), getConstructionPlanRendererTemplateBundleHash());
});

test('snapshot hash, plan identity, and fake marker-only pages fail closed', () => {
    const snapshot = buildSnapshot();
    assert.throws(
        () => verifyApprovedConstructionPlanSnapshot(snapshot.bytes, '0'.repeat(64), 'plan-server-pdf-1'),
        /snapshot-hash-mismatch/,
    );
    assert.throws(
        () => verifyApprovedConstructionPlanSnapshot(snapshot.bytes, snapshot.hash, 'different-plan'),
        /snapshot-plan-mismatch/,
    );
    const parsed = JSON.parse(snapshot.bytes.toString('utf8')) as { content: Record<string, unknown> };
    const invalidShape = validateShadowRendererSnapshotContent({ ...parsed.content, tradeType: 'system_shoring' });
    assert.equal(invalidShape.valid, false);
    assert.ok(invalidShape.issues.includes('content.tradeType'));
    const tamperedBytes = Buffer.from(canonicalStringify({
        ...parsed,
        content: { ...parsed.content, sectionOrder: [] },
    }), 'utf8');
    assert.throws(
        () => verifyApprovedConstructionPlanSnapshot(tamperedBytes, sha256Hex(tamperedBytes), 'plan-server-pdf-1'),
        /snapshot-content-invalid:content.sectionOrder/,
    );
    const mismatchedSchemaBytes = Buffer.from(canonicalStringify({
        ...parsed,
        snapshotSchemaVersion: parsed.content.snapshotSchemaVersion === 2 ? 1 : 2,
    }), 'utf8');
    assert.throws(
        () => verifyApprovedConstructionPlanSnapshot(
            mismatchedSchemaBytes,
            sha256Hex(mismatchedSchemaBytes),
            'plan-server-pdf-1',
        ),
        /snapshot-schema-mismatch/,
    );
    const fakePages = Array.from({ length: 42 }, (_, index) => `PAGE ${index + 1}/42`);
    const validation = validateServerRendererAuditPages(fakePages, {
        rendererVersion: CONSTRUCTION_PLAN_SERVER_RENDERER_VERSION,
        rendererTemplateBundleHash: '1'.repeat(64),
        contentManifestHash: '2'.repeat(64),
        snapshotHash: snapshot.hash,
    });
    assert.equal(validation.valid, false);
    assert.ok(validation.issues.some((issue) => issue.startsWith('renderer_version-missing')));
});
