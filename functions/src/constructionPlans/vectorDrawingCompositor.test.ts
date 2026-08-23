import { strict as assert } from 'assert';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';
import {
    CONSTRUCTION_PLAN_VECTOR_DRAWING_COMPOSITOR_VERSION,
    compositeConstructionPlanVectorDrawings,
    type CompositeConstructionPlanVectorDrawingsInput,
} from './vectorDrawingCompositor';

const sha256 = (value: Buffer): string => createHash('sha256').update(value).digest('hex');

const fixedDate = new Date('2000-01-01T00:00:00.000Z');

const makePdf = async (kind: 'base' | 'source', rotation: 0 | 90 = 0): Promise<Buffer> => {
    const document = await PDFDocument.create();
    document.setCreationDate(fixedDate);
    document.setModificationDate(fixedDate);
    const page = document.addPage(kind === 'base' ? [595.28, 841.89] : [400, 200]);
    const font = await document.embedFont(StandardFonts.Helvetica);
    if (kind === 'base') {
        page.drawRectangle({ x: 0, y: 0, width: 595.28, height: 841.89, color: rgb(0.96, 0.96, 0.96) });
        page.drawText('BASE-PAGE', { x: 20, y: 810, font, size: 10 });
    } else {
        page.setRotation(degrees(rotation));
        page.drawRectangle({ x: 20, y: 20, width: 360, height: 160, borderColor: rgb(0, 0.2, 0.8), borderWidth: 1 });
        page.drawLine({ start: { x: 20, y: 20 }, end: { x: 380, y: 180 }, color: rgb(0.8, 0, 0), thickness: 1 });
        page.drawText('VECTOR-SOURCE-LINE', { x: 95, y: 92, font, size: 14 });
    }
    return Buffer.from(await document.save({ useObjectStreams: false }));
};

const annotationFont = (): Buffer => readFileSync(
    require.resolve('@fontsource/noto-sans-kr/files/noto-sans-kr-korean-400-normal.woff2'),
);

const makeInput = async (rotation: 0 | 90 = 0): Promise<CompositeConstructionPlanVectorDrawingsInput> => {
    const basePdfBytes = await makePdf('base');
    const sourcePdfBytes = await makePdf('source', rotation);
    return {
        basePdfBytes,
        pageWidthPx: 1240,
        pageHeightPx: 1754,
        annotationFontBytes: annotationFont(),
        panels: [{
            physicalPageIndex: 0,
            sourcePdfBytes,
            sourceSha256: sha256(sourcePdfBytes),
            sourcePageIndex: 0,
            sourceCropBoxPt: { left: 0, bottom: 0, right: 400, top: 200 },
            sourceRotation: rotation,
            destinationPx: rotation === 0
                ? { x: 120, y: 300, width: 1000, height: 500 }
                : { x: 370, y: 180, width: 500, height: 1000 },
            annotations: [{
                id: 'annotation-install-a01',
                label: '설치 구간',
                zoneCode: 'A-01',
                geometry: { kind: 'rect', x: 0.1, y: 0.15, w: 0.35, h: 0.25, rotationDeg: 0 },
                style: {
                    strokeHex: '#2563eb',
                    fillHex: '#dbeafe',
                    strokeWidthPt: 1.5,
                    opacity: 0.45,
                    dash: 'solid',
                    hatch: 'diagonal',
                    fontSizePt: 9,
                },
            }, {
                id: 'annotation-route-a01',
                label: '장비 진행방향',
                geometry: {
                    kind: 'polyline',
                    vertices: [{ x: 0.18, y: 0.75 }, { x: 0.72, y: 0.38 }],
                    arrowStart: false,
                    arrowEnd: true,
                },
                style: {
                    strokeHex: '#1d4ed8',
                    fillHex: '#dbeafe',
                    strokeWidthPt: 2,
                    opacity: 0.95,
                    dash: 'dash',
                    hatch: 'none',
                    fontSizePt: 8,
                },
            }],
        }],
    };
};

describe('construction-plan vector drawing compositor', () => {
    it('imports the immutable PDF source as a Form XObject and preserves vector/search content', async () => {
        const input = await makeInput();
        const output = await compositeConstructionPlanVectorDrawings(input);
        const parsed = await PDFDocument.load(output, { updateMetadata: false });

        assert.equal(CONSTRUCTION_PLAN_VECTOR_DRAWING_COMPOSITOR_VERSION, 'pdf-xobject-v1');
        assert.equal(parsed.getPageCount(), 1);
        assert.ok(output.length > input.basePdfBytes.length);
        assert.match(output.toString('latin1'), /\/Subtype\s*\/Form/);
        assert.match(output.toString('latin1'), /\/XObject/);
    });

    it('supports a source page whose immutable page rotation is 90 degrees', async () => {
        const input = await makeInput(90);
        const output = await compositeConstructionPlanVectorDrawings(input);
        assert.equal((await PDFDocument.load(output)).getPageCount(), 1);
        assert.match(output.toString('latin1'), /\/Subtype\s*\/Form/);
    });

    it('is deterministic and fails closed when the verified source SHA is altered', async () => {
        const input = await makeInput();
        const first = await compositeConstructionPlanVectorDrawings(input);
        const second = await compositeConstructionPlanVectorDrawings(input);
        assert.equal(sha256(first), sha256(second));

        await assert.rejects(
            compositeConstructionPlanVectorDrawings({
                ...input,
                panels: [{ ...input.panels[0], sourceSha256: '0'.repeat(64) }],
            }),
            /construction-plan-vector-source-binding-invalid/,
        );
    });
});
