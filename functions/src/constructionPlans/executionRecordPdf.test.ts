import { strict as assert } from 'node:assert';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { PDFParse } from 'pdf-parse';
import { getConstructionPlanBrandLogoPng } from './brandAssets';
import {
    constructionPlanRecordConfirmationHash,
    getConstructionPlanRecordCatalog,
} from './executionRecordDomain';
import {
    CONSTRUCTION_PLAN_RECORD_PDF_RENDERER_VERSION,
    renderConfirmedConstructionPlanRecordPdf,
} from './executionRecordPdf';

const fixture = () => {
    const catalog = getConstructionPlanRecordCatalog('system-shoring', 'installation_inspection');
    const photoBytes = getConstructionPlanBrandLogoPng();
    const record: Record<string, unknown> = {
        schemaVersion: 1,
        id: 'record-field-a',
        rootRecordId: 'record-field-a',
        recordRevision: 0,
        planId: 'plan-issued-a',
        siteId: 'site-a',
        planBinding: {
            planId: 'plan-issued-a', siteId: 'site-a', siteName: '청연 업무시설 증축공사',
            seriesId: 'series-a', revision: 4, issuedExportId: 'issued-export-a',
            issuedExportSha256: 'a'.repeat(64), tradeType: 'system-shoring',
            templateId: 'system-shoring-standard', templateVersion: '1.0.0',
            documentNo: 'CP-SH-2026-009', title: '시스템동바리 시공계획서',
        },
        recordType: 'installation_inspection',
        catalogVersion: catalog.version,
        catalogHash: catalog.hash,
        questions: catalog.questions,
        workDate: '2026-08-22', building: '101동', floor: '지상 5층', zone: 'A-1 설치구간',
        actualWorkers: [{ workerId: 'worker-a', name: '김작업', role: '설치팀장' }],
        actualEquipment: [{ name: '고소작업대', model: 'CY-20', registrationNo: '서울01가1234', operatorName: '이운전' }],
        responses: catalog.questions.map((question, index) => index === 1 ? ({
            questionId: question.id,
            result: 'fail',
            note: '수직도 측정값이 관리 기준을 초과하여 즉시 재조정했다.',
            measuredValue: '초기 1/180 → 조정 후 1/320',
            action: {
                description: '수직재 재조정 및 체결상태 재검측', owner: '김작업', due: '2026-08-22',
                status: 'resolved', resolution: '재조정 후 1/320 확인 완료',
            },
        }) : ({ questionId: question.id, result: 'pass', note: '현장 확인 완료' })),
        photos: [{
            id: 'photo-a', storagePath: 'construction-plan-records/site-a/plan-issued-a/record-field-a/photos/photo-a/a.png',
            storageGeneration: '1700000000000001', sha256: require('node:crypto').createHash('sha256').update(photoBytes).digest('hex'),
            sizeBytes: photoBytes.length, mimeType: 'image/png', caption: 'A-1 구간 설치 및 체결상태 전경',
            takenAt: '2026-08-22T09:30:00+09:00', zone: 'A-1 설치구간', uploadedBy: 'author-a', uploadedAt: '2026-08-22T00:31:00.000Z',
        }],
        designatedConfirmerId: 'reviewer-a', designatedConfirmerName: '박검토',
        status: 'confirmed', version: 3, createdBy: 'author-a', createdAt: '2026-08-22T00:00:00.000Z',
        confirmedBy: 'reviewer-a', confirmedByName: '박검토', confirmedAt: '2026-08-22T01:00:00.000Z',
    };
    record.confirmationHash = constructionPlanRecordConfirmationHash(record);
    return { record, photoBytes };
};

describe('execution record A4 appendix PDF', () => {
    it('renders deterministic searchable Korean A4 pages with continuation-safe evidence', async () => {
        const { record, photoBytes } = fixture();
        const rendered = await renderConfirmedConstructionPlanRecordPdf(record, new Map([['photo-a', photoBytes]]));
        const retried = await renderConfirmedConstructionPlanRecordPdf(record, new Map([['photo-a', photoBytes]]));
        assert.equal(rendered.rendererVersion, CONSTRUCTION_PLAN_RECORD_PDF_RENDERER_VERSION);
        // PNG object references may be allocated in a different order by PDFKit,
        // while the server callable's idempotency claim reuses the exact stored
        // bytes. The immutable source/render bindings must remain stable.
        assert.equal(rendered.sourceRecordHash, retried.sourceRecordHash);
        assert.equal(rendered.renderInputHash, retried.renderInputHash);
        assert.equal(rendered.rendererBuildHash, retried.rendererBuildHash);
        assert.equal(rendered.pageCount, retried.pageCount);
        assert.ok(rendered.pageCount >= 2);
        assert.equal(rendered.bytes.subarray(0, 5).toString('ascii'), '%PDF-');
        const raw = rendered.bytes.toString('latin1');
        const a4MediaBoxes = (raw.match(/\/MediaBox \[0 0 595\.28 841\.89\]/g) || []).length;
        assert.ok(a4MediaBoxes >= rendered.pageCount);
        assert.equal(a4MediaBoxes % rendered.pageCount, 0);
        ['/Encrypt', '/JavaScript', '/EmbeddedFile', '/Filespec', '/OpenAction'].forEach((feature) => assert.equal(raw.includes(feature), false));

        const parser = new PDFParse({ data: rendered.bytes });
        try {
            const text = await parser.getText();
            assert.equal(text.total, rendered.pageCount);
            const searchable = text.pages.map((page) => page.text).join('\n');
            assert.match(searchable, /설치\s*검측/);
            assert.match(searchable, /청연\s*업무시설\s*증축공사/);
            assert.match(searchable, /REV\.04\s*·\s*시스템동바리/);
            assert.match(searchable, /수직재\s*재조정/);
            assert.match(searchable, /초기\s*1\/180\s*->\s*조정\s*후\s*1\/320/);
            assert.doesNotMatch(searchable, /[→⇒➜‐‑‒–—―]/);
            assert.match(searchable, /A-1\s*구간\s*설치/);
            assert.match(searchable, /빈\s*양식이나\s*승인상태를\s*자동\s*합격/);
            const screenshots = await parser.getScreenshot({
                partial: [1, rendered.pageCount], desiredWidth: 595, imageBuffer: true, imageDataUrl: false,
            });
            assert.equal(screenshots.pages.length, 2);
            screenshots.pages.forEach((page) => {
                assert.ok(page.data && page.data.length > 1_000);
                assert.deepEqual(Array.from(page.data?.subarray(0, 4) || []), [0x89, 0x50, 0x4e, 0x47]);
            });
            const qaDirectory = process.env.CONSTRUCTION_PLAN_RECORD_PDF_QA_DIR;
            if (qaDirectory) {
                mkdirSync(qaDirectory, { recursive: true });
                writeFileSync(join(qaDirectory, 'execution-record-appendix.pdf'), rendered.bytes);
                screenshots.pages.forEach((page, index) => writeFileSync(join(qaDirectory, `execution-record-appendix-${index === 0 ? 'first' : 'last'}.png`), page.data));
            }
        } finally {
            await parser.destroy();
        }
    });
});
