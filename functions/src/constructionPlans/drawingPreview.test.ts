import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { sha256Hex } from './domain';
import {
    assertConstructionPlanDrawingPdfMagicHeader,
    assertConstructionPlanDrawingSourceMagic,
    assertConstructionPlanDrawingPreviewMutationPolicy,
    assertAuthoritativeConstructionPlanDrawingPreviews,
    assertConstructionPlanDrawingPreviewArtifactMetadata,
    assertConstructionPlanDrawingAnnotationsBoundToPages,
    assertConstructionPlanDrawingPreviewBindingHash,
    buildConstructionPlanDrawingPreviewArtifactMetadata,
    canonicalConstructionPlanDrawingPageFingerprint,
    canonicalConstructionPlanDrawingPreviewPath,
    constructionPlanDrawingPreviewBindingHash,
    ensureConstructionPlanDrawingPreview,
    normalizePdfPageRotation,
    parseConstructionPlanDrawingPreviewResult,
    parseEnsureConstructionPlanDrawingPreviewRequest,
    pdfBoxFromView,
    processConstructionPlanDrawingPdfPagesSequentially,
    projectDrawingPreviewResultToEmbeddedCache,
    renderConstructionPlanDrawingPdfPages,
    type ConstructionPlanDrawingPreviewResult,
} from './drawingPreview';

type TestRecord = Record<string, unknown>;

class MemorySnapshot {
    constructor(private readonly value: TestRecord | undefined) {}

    get exists(): boolean { return this.value !== undefined; }

    data(): TestRecord | undefined {
        return this.value === undefined
            ? undefined
            : JSON.parse(JSON.stringify(this.value)) as TestRecord;
    }
}

class MemoryDocumentReference {
    constructor(readonly database: MemoryDatabase, readonly path: string) {}

    get(): Promise<MemorySnapshot> { return Promise.resolve(this.database.snapshot(this.path)); }

    collection(name: string): MemoryCollectionReference {
        return new MemoryCollectionReference(this.database, `${this.path}/${name}`);
    }
}

class MemoryCollectionReference {
    constructor(readonly database: MemoryDatabase, readonly path: string) {}

    doc(id: string): MemoryDocumentReference {
        return new MemoryDocumentReference(this.database, `${this.path}/${id}`);
    }
}

class MemoryDatabase {
    private readonly documents = new Map<string, TestRecord>();

    collection(name: string): MemoryCollectionReference {
        return new MemoryCollectionReference(this, name);
    }

    seed(path: string, value: TestRecord): void {
        this.documents.set(path, JSON.parse(JSON.stringify(value)) as TestRecord);
    }

    read(path: string): TestRecord | undefined {
        const value = this.documents.get(path);
        return value ? JSON.parse(JSON.stringify(value)) as TestRecord : undefined;
    }

    snapshot(path: string): MemorySnapshot {
        return new MemorySnapshot(this.documents.get(path));
    }

    async runTransaction<T>(handler: (transaction: {
        get: (reference: MemoryDocumentReference) => Promise<MemorySnapshot>;
        set: (reference: MemoryDocumentReference, value: TestRecord) => void;
        update: (reference: MemoryDocumentReference, value: TestRecord) => void;
    }) => Promise<T>): Promise<T> {
        return handler({
            get: (reference) => reference.get(),
            set: (reference, value) => this.seed(reference.path, value),
            update: (reference, value) => {
                const existing = this.documents.get(reference.path);
                if (!existing) throw new Error(`missing-document:${reference.path}`);
                this.seed(reference.path, { ...existing, ...value });
            },
        });
    }
}

interface MemoryStorageObject {
    bytes: Buffer;
    metadata: TestRecord;
}

class MemoryStorageBucket {
    readonly objects = new Map<string, MemoryStorageObject>();
    successfulCreateCount = 0;
    private nextGeneration = 2000;

    seed(path: string, bytes: Buffer, metadata: TestRecord): void {
        this.objects.set(path, { bytes: Buffer.from(bytes), metadata: { ...metadata } });
    }

    file(path: string) {
        return {
            getMetadata: async () => {
                const object = this.objects.get(path);
                if (!object) throw { code: 404 };
                return [{ ...object.metadata }];
            },
            download: async () => {
                const object = this.objects.get(path);
                if (!object) throw { code: 404 };
                return [Buffer.from(object.bytes)];
            },
            save: async (rawBytes: Buffer | Uint8Array, rawOptions: unknown) => {
                const options = rawOptions as {
                    contentType?: string;
                    metadata?: TestRecord;
                    preconditionOpts?: { ifGenerationMatch?: number };
                };
                if (this.objects.has(path) && options.preconditionOpts?.ifGenerationMatch === 0) {
                    throw { code: 412 };
                }
                const bytes = Buffer.from(rawBytes);
                const generation = String(this.nextGeneration++);
                this.successfulCreateCount += 1;
                this.seed(path, bytes, {
                    ...(options.metadata || {}),
                    contentType: options.contentType || options.metadata?.contentType,
                    size: String(bytes.length),
                    generation,
                });
            },
        };
    }
}

const sourceSha256 = 'a'.repeat(64);
const previewSha256 = 'b'.repeat(64);
const sourcePath = 'construction-plans/site-1/plan-1/drawings/drawing-1/source.pdf';
const previewPath = `construction-plans/site-1/plan-1/previews/drawing-1/${sourceSha256}/page-0001.png`;
const pageBox = { left: 10, bottom: 20, right: 190, top: 280 };

const readyResult = (): ConstructionPlanDrawingPreviewResult => ({
    siteId: 'site-1',
    planId: 'plan-1',
    drawingId: 'drawing-1',
    sourceStoragePath: sourcePath,
    sourceSha256,
    sourceGeneration: '1001',
    previewStatus: 'ready',
    pageCount: 1,
    pages: [{
        pageIndex: 0,
        mediaBoxPt: pageBox,
        cropBoxPt: pageBox,
        rotation: 90,
        pageFingerprint: `source:${sourceSha256}:page:0`,
        previewPath,
        previewGeneration: '2002',
        previewSha256,
    }],
    previewPaths: [previewPath],
    processedAt: '2026-08-22T00:00:00.000Z',
    idempotent: false,
});

const drawing = () => ({
    id: 'drawing-1',
    planId: 'plan-1',
    storagePath: sourcePath,
    sourceSha256,
    sourceGeneration: '1001',
    originalFileName: 'source.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 1024,
    pageCount: 1,
    approvalStatus: 'approved',
    previewStatus: 'processing',
    previewPaths: [],
    pages: [],
    annotations: [{ id: 'annotation-1', pageIndex: 0 }],
});

const minimalRotatedCropPdf = (pageCount = 1): Buffer => {
    const chunks: string[] = ['%PDF-1.4\n'];
    const offsets: number[] = [0];
    let byteLength = Buffer.byteLength(chunks[0], 'ascii');
    const appendObject = (id: number, body: string): void => {
        offsets[id] = byteLength;
        const value = `${id} 0 obj\n${body}\nendobj\n`;
        chunks.push(value);
        byteLength += Buffer.byteLength(value, 'ascii');
    };
    appendObject(1, '<< /Type /Catalog /Pages 2 0 R >>');
    appendObject(2, `<< /Type /Pages /Kids [3 0 R${pageCount === 2 ? ' 5 0 R' : ''}] /Count ${pageCount} >>`);
    appendObject(
        3,
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 300] /CropBox [10 20 190 280] /Rotate 90 /Resources << >> /Contents 4 0 R >>',
    );
    appendObject(4, '<< /Length 0 >>\nstream\n\nendstream');
    if (pageCount === 2) {
        appendObject(
            5,
            '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << >> /Contents 6 0 R >>',
        );
        appendObject(6, '<< /Length 0 >>\nstream\n\nendstream');
    }
    const xrefOffset = byteLength;
    const objectCount = pageCount === 2 ? 7 : 5;
    const xref = [
        'xref',
        `0 ${objectCount}`,
        '0000000000 65535 f ',
        ...offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n `),
        'trailer',
        `<< /Size ${objectCount} /Root 1 0 R >>`,
        'startxref',
        String(xrefOffset),
        '%%EOF',
        '',
    ].join('\n');
    chunks.push(xref);
    return Buffer.from(chunks.join(''), 'ascii');
};

const previewPipelineHarness = () => {
    const database = new MemoryDatabase();
    const storageBucket = new MemoryStorageBucket();
    const pdf = minimalRotatedCropPdf();
    const sourceHash = sha256Hex(pdf);
    const planId = 'pipeline-plan';
    const siteId = 'pipeline-site';
    const drawingId = 'pipeline-drawing';
    const storagePath = `construction-plans/${siteId}/${planId}/drawings/${drawingId}/source.pdf`;
    const pageFingerprint = canonicalConstructionPlanDrawingPageFingerprint(sourceHash, 0);
    const plan: TestRecord = {
        id: planId,
        siteId,
        status: 'draft',
        createdBy: 'author-1',
        participants: { authorIds: ['author-1'], reviewerIds: [], approverIds: [] },
        drawings: [{
            id: drawingId,
            planId,
            storagePath,
            sourceSha256: sourceHash,
            sourceGeneration: '1001',
            originalFileName: 'source.pdf',
            mimeType: 'application/pdf',
            sizeBytes: pdf.length,
            pageCount: 1,
            approvalStatus: 'draft',
            previewStatus: 'pending',
            previewPaths: [],
            pages: [],
            annotations: [{
                id: 'install-zone-1',
                pageIndex: 0,
                pageFingerprint,
                layer: 'install',
                geometry: {
                    kind: 'polygon',
                    vertices: [{ x: 0.1, y: 0.1 }, { x: 0.8, y: 0.1 }, { x: 0.8, y: 0.8 }],
                },
            }],
        }],
    };
    database.seed(`constructionPlans/${planId}`, plan);
    storageBucket.seed(storagePath, pdf, {
        contentType: 'application/pdf',
        size: String(pdf.length),
        generation: '1001',
    });
    const request = {
        planId,
        drawingId,
        expectedSourceStoragePath: storagePath,
        expectedSourceSha256: sourceHash,
        expectedSourceGeneration: '1001',
        idempotencyKey: 'pipeline-request-1',
    };
    const assertPlanMutationAllowed = (currentPlan: TestRecord): void => {
        assertConstructionPlanDrawingPreviewMutationPolicy(
            currentPlan,
            { uid: 'author-1', isCentral: false },
            1_000,
        );
    };
    return {
        database,
        storageBucket,
        pdf,
        sourceHash,
        planId,
        siteId,
        drawingId,
        storagePath,
        request,
        assertPlanMutationAllowed,
    };
};

describe('construction plan drawing preview server contract', () => {
    it('parses the exact request and rejects storage-segment collisions', () => {
        const parsed = parseEnsureConstructionPlanDrawingPreviewRequest({
            planId: 'plan-1',
            drawingId: 'drawing-1',
            expectedSourceStoragePath: sourcePath,
            expectedSourceSha256: sourceSha256.toUpperCase(),
            expectedSourceGeneration: '1001',
            requestedPageIndexes: [0],
            idempotencyKey: 'preview-request-1',
            ignoredByExactProjection: true,
        });
        assert.deepEqual(parsed, {
            planId: 'plan-1',
            drawingId: 'drawing-1',
            expectedSourceStoragePath: sourcePath,
            expectedSourceSha256: sourceSha256,
            expectedSourceGeneration: '1001',
            requestedPageIndexes: [0],
            idempotencyKey: 'preview-request-1',
        });
        assert.throws(() => parseEnsureConstructionPlanDrawingPreviewRequest({
            ...parsed,
            drawingId: 'a/b',
        }), /drawingId/);
        assert.throws(() => parseEnsureConstructionPlanDrawingPreviewRequest({
            ...parsed,
            requestedPageIndexes: [0, 0],
        }), /중복/);
    });

    it('allows only draft authors/central users and respects an active edit lock', () => {
        const plan = {
            status: 'draft',
            createdBy: 'author-1',
            participants: { authorIds: ['author-1'], reviewerIds: ['reviewer-1'] },
            editLock: { userId: 'author-1', expiresAtEpochMs: 2_000 },
        };
        assert.doesNotThrow(() => assertConstructionPlanDrawingPreviewMutationPolicy(
            plan,
            { uid: 'author-1', isCentral: false },
            1_000,
        ));
        assert.throws(() => assertConstructionPlanDrawingPreviewMutationPolicy(
            plan,
            { uid: 'reviewer-1', isCentral: false },
            1_000,
        ), /작성자 또는 본사/);
        assert.throws(() => assertConstructionPlanDrawingPreviewMutationPolicy(
            plan,
            { uid: 'office-1', isCentral: true },
            1_000,
        ), /편집 잠금/);
        assert.throws(() => assertConstructionPlanDrawingPreviewMutationPolicy(
            { ...plan, status: 'under_review', editLock: undefined },
            { uid: 'author-1', isCentral: false },
            1_000,
        ), /초안 또는 변경 요청/);
    });

    it('requires a complete canonical READY page map with artifact generation and SHA', () => {
        assert.deepEqual(parseConstructionPlanDrawingPreviewResult(readyResult()), readyResult());
        const missingGeneration = readyResult() as unknown as Record<string, unknown>;
        missingGeneration.pages = [{ ...readyResult().pages[0], previewGeneration: undefined }];
        assert.throws(
            () => parseConstructionPlanDrawingPreviewResult(missingGeneration),
            /previewGeneration|generation/,
        );
        const crossDrawing = readyResult();
        crossDrawing.pages[0].previewPath = crossDrawing.pages[0].previewPath.replace('drawing-1', 'drawing-2');
        crossDrawing.previewPaths = [crossDrawing.pages[0].previewPath];
        assert.throws(
            () => parseConstructionPlanDrawingPreviewResult(crossDrawing),
            /바인딩/,
        );
        const incomplete = readyResult();
        incomplete.pageCount = 2;
        assert.throws(
            () => parseConstructionPlanDrawingPreviewResult(incomplete),
            /모든 물리 페이지/,
        );
        assert.throws(
            () => parseConstructionPlanDrawingPreviewResult({ ...readyResult(), pageCount: '1' }),
            /pageCount/,
        );
        assert.throws(
            () => parseConstructionPlanDrawingPreviewResult({
                ...readyResult(),
                pages: [{ ...readyResult().pages[0], pageIndex: '0' }],
            }),
            /pageIndex/,
        );
        assert.throws(
            () => parseConstructionPlanDrawingPreviewResult({
                ...readyResult(),
                pages: [{
                    ...readyResult().pages[0],
                    cropBoxPt: { ...pageBox, left: '10' },
                }],
            }),
            /좌표 형식/,
        );
    });

    it('reuses same-SHA artifacts across source generations while enforcing content bindings', () => {
        const result = readyResult();
        const page = result.pages[0];
        const metadata = buildConstructionPlanDrawingPreviewArtifactMetadata(
            {
                planId: result.planId,
                drawingId: result.drawingId,
                expectedSourceStoragePath: result.sourceStoragePath,
                expectedSourceSha256: result.sourceSha256,
                expectedSourceGeneration: result.sourceGeneration,
                idempotencyKey: 'request-1',
            },
            result.siteId,
            result.pageCount,
            page.pageIndex,
            page.pageFingerprint,
            page.previewSha256,
        );
        assert.doesNotThrow(() => assertConstructionPlanDrawingPreviewArtifactMetadata(metadata, result, page));
        assert.doesNotThrow(
            () => assertConstructionPlanDrawingPreviewArtifactMetadata(
                { ...metadata, sourceGeneration: '9999', sourceStoragePath: `${sourcePath}.same-bytes` },
                result,
                page,
            ),
        );
        assert.throws(
            () => assertConstructionPlanDrawingPreviewArtifactMetadata(
                { ...metadata, sourceSha256: 'c'.repeat(64) },
                result,
                page,
            ),
            /메타데이터 바인딩/,
        );
    });

    it('requires real normalized annotation geometry bound to an authoritative page', () => {
        const fingerprint = `source:${sourceSha256}:page:0`;
        const annotation = {
            id: 'install-zone-1',
            pageIndex: 0,
            pageFingerprint: fingerprint,
            layer: 'install',
            geometry: {
                kind: 'polygon',
                vertices: [{ x: 0.1, y: 0.1 }, { x: 0.8, y: 0.1 }, { x: 0.8, y: 0.8 }],
            },
        };
        assert.doesNotThrow(() => assertConstructionPlanDrawingAnnotationsBoundToPages(
            { id: 'drawing-1', annotations: [annotation] },
            [fingerprint],
        ));
        assert.throws(() => assertConstructionPlanDrawingAnnotationsBoundToPages(
            { id: 'drawing-1', annotations: [{ ...annotation, geometry: undefined }] },
            [fingerprint],
        ), /geometry/);
        assert.throws(() => assertConstructionPlanDrawingAnnotationsBoundToPages(
            {
                id: 'drawing-1',
                annotations: [{
                    ...annotation,
                    geometry: {
                        kind: 'polygon',
                        vertices: [{ x: 0.2, y: 0.2 }, { x: 0.2, y: 0.2 }, { x: 0.2, y: 0.2 }],
                    },
                }],
            },
            [fingerprint],
        ), /geometry/);
        assert.throws(() => assertConstructionPlanDrawingAnnotationsBoundToPages(
            { id: 'drawing-1', annotations: [{ ...annotation, pageFingerprint: 'forged' }] },
            [fingerprint],
        ), /pageFingerprint/);
        assert.throws(() => assertConstructionPlanDrawingAnnotationsBoundToPages(
            { id: 'drawing-1', annotations: [annotation, { ...annotation }] },
            [fingerprint],
        ), /중복/);
        assert.throws(() => assertConstructionPlanDrawingAnnotationsBoundToPages(
            { id: 'drawing-1', annotations: [{ ...annotation, pageIndex: '0' }] },
            [fingerprint],
        ), /pageIndex/);
        assert.throws(() => assertConstructionPlanDrawingAnnotationsBoundToPages(
            {
                id: 'drawing-1',
                annotations: [{
                    ...annotation,
                    geometry: {
                        kind: 'polygon',
                        vertices: [{ x: '0.1', y: 0.1 }, { x: 0.8, y: null }, { x: false, y: 0.8 }],
                    },
                }],
            },
            [fingerprint],
        ), /geometry/);
    });

    it('checks PDF magic and normalizes page geometry without guessing rotation', () => {
        assert.doesNotThrow(() => assertConstructionPlanDrawingPdfMagicHeader(
            Buffer.from('comment\n%PDF-1.7\n', 'ascii'),
        ));
        assert.throws(
            () => assertConstructionPlanDrawingPdfMagicHeader(Buffer.from('not a pdf', 'ascii')),
            /PDF magic header/,
        );
        assert.deepEqual(pdfBoxFromView([190, 280, 10, 20]), pageBox);
        assert.equal(normalizePdfPageRotation(-90), 270);
        assert.throws(() => normalizePdfPageRotation(45), /90도 단위/);
        assert.throws(() => normalizePdfPageRotation('90'), /rotation 값/);
    });

    it('fails closed when PNG/JPEG MIME does not match source magic bytes', () => {
        assert.doesNotThrow(() => assertConstructionPlanDrawingSourceMagic(
            'image/png',
            Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1]),
        ));
        assert.doesNotThrow(() => assertConstructionPlanDrawingSourceMagic(
            'image/jpeg',
            Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0xff, 0xd9]),
        ));
        assert.throws(
            () => assertConstructionPlanDrawingSourceMagic('image/png', Buffer.from('spoofed')),
            /PNG.*magic bytes/,
        );
        assert.throws(
            () => assertConstructionPlanDrawingSourceMagic('image/jpeg', Buffer.from('spoofed')),
            /JPEG.*magic bytes/,
        );
    });

    it('renders a real CropBox/Rotate PDF to one PNG page', async () => {
        const pages = await renderConstructionPlanDrawingPdfPages(minimalRotatedCropPdf());
        assert.equal(pages.length, 1);
        assert.equal(pages[0].pageIndex, 0);
        assert.deepEqual(pages[0].cropBoxPt, pageBox);
        assert.deepEqual(pages[0].mediaBoxPt, pageBox);
        assert.equal(pages[0].rotation, 90);
        assert.deepEqual([...pages[0].png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    });

    it('awaits each page consumer before rendering the next page', async () => {
        let activeConsumers = 0;
        let peakConsumers = 0;
        const indexes: number[] = [];
        const total = await processConstructionPlanDrawingPdfPagesSequentially(
            minimalRotatedCropPdf(2),
            async (page, pageCount) => {
                activeConsumers += 1;
                peakConsumers = Math.max(peakConsumers, activeConsumers);
                assert.equal(pageCount, 2);
                indexes.push(page.pageIndex);
                await Promise.resolve();
                activeConsumers -= 1;
            },
        );
        assert.equal(total, 2);
        assert.equal(peakConsumers, 1);
        assert.deepEqual(indexes, [0, 1]);
    });

    it('projects only derived cache fields and hashes every release binding', () => {
        const source = drawing();
        const result = readyResult();
        const projected = projectDrawingPreviewResultToEmbeddedCache(source, result);
        assert.equal(projected.storagePath, source.storagePath);
        assert.equal(projected.sourceSha256, source.sourceSha256);
        assert.equal(projected.sourceGeneration, source.sourceGeneration);
        assert.deepEqual(projected.annotations, source.annotations);
        assert.equal(projected.previewStatus, 'ready');
        assert.deepEqual(projected.previewPaths, [previewPath]);

        const basePlan = { siteId: 'site-1', drawings: [projected] };
        const baseHash = constructionPlanDrawingPreviewBindingHash('plan-1', basePlan);
        assert.notEqual(
            constructionPlanDrawingPreviewBindingHash('plan-1', {
                ...basePlan,
                drawings: [{ ...projected, sourceGeneration: '1002' }],
            }),
            baseHash,
        );
        assert.throws(() => assertConstructionPlanDrawingPreviewBindingHash(
            'plan-1',
            {
                ...basePlan,
                drawings: [{ ...projected, sourceGeneration: '1002' }],
            },
            baseHash,
        ), /검증 중 변경/);
        assert.notEqual(
            constructionPlanDrawingPreviewBindingHash('plan-1', {
                ...basePlan,
                drawings: [{ ...projected, annotations: [{ id: 'forged', layer: 'install' }] }],
            }),
            baseHash,
        );
        assert.notEqual(
            constructionPlanDrawingPreviewBindingHash('plan-1', {
                ...basePlan,
                drawings: [{
                    ...projected,
                    pages: [{ ...result.pages[0], previewGeneration: '2003' }],
                }],
            }),
            baseHash,
        );
    });

    it('uses deterministic canonical path and page fingerprint contracts', () => {
        assert.equal(
            canonicalConstructionPlanDrawingPreviewPath('site-1', 'plan-1', 'drawing-1', sourceSha256, 0),
            previewPath,
        );
        assert.equal(
            canonicalConstructionPlanDrawingPageFingerprint(sourceSha256.toUpperCase(), 0),
            `source:${sourceSha256}:page:0`,
        );
    });

    it('runs the server pipeline end to end and recovers READY idempotently', async () => {
        const harness = previewPipelineHarness();
        const options = {
            database: harness.database as never,
            storageBucket: harness.storageBucket as never,
            actorId: 'author-1',
            request: harness.request,
            now: () => new Date('2026-08-22T00:00:00.000Z'),
            assertPlanMutationAllowed: harness.assertPlanMutationAllowed,
        };
        const first = await ensureConstructionPlanDrawingPreview(options);
        assert.equal(first.previewStatus, 'ready');
        assert.equal(first.idempotent, false);
        assert.equal(first.pageCount, 1);
        assert.equal(first.pages[0].previewGeneration, '2000');
        assert.equal(harness.storageBucket.successfulCreateCount, 1);
        const manifestPath = `constructionPlans/${harness.planId}/drawingPreviewManifests/${harness.drawingId}`;
        const manifest = harness.database.read(manifestPath);
        assert.equal(manifest?.authority, 'server');
        assert.equal(manifest?.schemaVersion, 1);
        const plan = harness.database.read(`constructionPlans/${harness.planId}`) as TestRecord;
        const embedded = (plan.drawings as TestRecord[])[0];
        assert.equal(embedded.previewStatus, 'ready');
        assert.deepEqual(embedded.previewPaths, first.previewPaths);
        const verification = await assertAuthoritativeConstructionPlanDrawingPreviews({
            database: harness.database as never,
            storageBucket: harness.storageBucket as never,
            planId: harness.planId,
            plan,
        });
        assert.equal(verification.pdfDrawingCount, 1);

        const recovered = await ensureConstructionPlanDrawingPreview(options);
        assert.equal(recovered.previewStatus, 'ready');
        assert.equal(recovered.idempotent, true);
        assert.equal(recovered.pages[0].previewGeneration, first.pages[0].previewGeneration);
        assert.equal(harness.storageBucket.successfulCreateCount, 1);
        const centralRecovery = await ensureConstructionPlanDrawingPreview({
            ...options,
            actorId: 'office-1',
            assertPlanMutationAllowed: (currentPlan) => {
                assertConstructionPlanDrawingPreviewMutationPolicy(
                    currentPlan,
                    { uid: 'office-1', isCentral: true },
                    1_000,
                );
            },
        });
        assert.equal(centralRecovery.idempotent, true);
        assert.equal(centralRecovery.pages[0].previewGeneration, first.pages[0].previewGeneration);

        const forgedPlan = harness.database.read(`constructionPlans/${harness.planId}`) as TestRecord;
        const forgedDrawing = (forgedPlan.drawings as TestRecord[])[0];
        await assert.rejects(
            () => assertAuthoritativeConstructionPlanDrawingPreviews({
                database: harness.database as never,
                storageBucket: harness.storageBucket as never,
                planId: harness.planId,
                plan: {
                    ...forgedPlan,
                    drawings: [{
                        ...forgedDrawing,
                        annotations: [{
                            id: 'forged-install',
                            layer: 'install',
                            pageIndex: 0,
                            pageFingerprint: first.pages[0].pageFingerprint,
                        }],
                    }],
                },
            }),
            /geometry/,
        );
    });

    it('reuses a content-addressed preview when identical PDF bytes get a new source generation', async () => {
        const harness = previewPipelineHarness();
        const baseOptions = {
            database: harness.database as never,
            storageBucket: harness.storageBucket as never,
            actorId: 'author-1',
            request: harness.request,
            now: () => new Date('2026-08-22T00:00:00.000Z'),
            assertPlanMutationAllowed: harness.assertPlanMutationAllowed,
        };
        const first = await ensureConstructionPlanDrawingPreview(baseOptions);
        const nextStoragePath = `construction-plans/${harness.siteId}/${harness.planId}/drawings/${harness.drawingId}/same.pdf`;
        harness.storageBucket.seed(nextStoragePath, harness.pdf, {
            contentType: 'application/pdf',
            size: String(harness.pdf.length),
            generation: '1002',
        });
        const currentPlan = harness.database.read(`constructionPlans/${harness.planId}`) as TestRecord;
        const currentDrawing = (currentPlan.drawings as TestRecord[])[0];
        harness.database.seed(`constructionPlans/${harness.planId}`, {
            ...currentPlan,
            drawings: [{
                ...currentDrawing,
                storagePath: nextStoragePath,
                sourceGeneration: '1002',
                previewStatus: 'pending',
                previewPaths: [],
                pages: [],
            }],
        });
        const second = await ensureConstructionPlanDrawingPreview({
            ...baseOptions,
            request: {
                ...harness.request,
                expectedSourceStoragePath: nextStoragePath,
                expectedSourceGeneration: '1002',
                idempotencyKey: 'pipeline-request-2',
            },
        });
        assert.equal(second.previewStatus, 'ready');
        assert.equal(second.sourceGeneration, '1002');
        assert.equal(second.pages[0].previewPath, first.pages[0].previewPath);
        assert.equal(second.pages[0].previewGeneration, first.pages[0].previewGeneration);
        assert.equal(harness.storageBucket.successfulCreateCount, 1);
        const latestPlan = harness.database.read(`constructionPlans/${harness.planId}`) as TestRecord;
        await assertAuthoritativeConstructionPlanDrawingPreviews({
            database: harness.database as never,
            storageBucket: harness.storageBucket as never,
            planId: harness.planId,
            plan: latestPlan,
        });
    });

    it('persists a server FAILED manifest and embedded cache when the source object is missing', async () => {
        const harness = previewPipelineHarness();
        harness.storageBucket.objects.delete(harness.storagePath);
        const failed = await ensureConstructionPlanDrawingPreview({
            database: harness.database as never,
            storageBucket: harness.storageBucket as never,
            actorId: 'author-1',
            request: harness.request,
            now: () => new Date('2026-08-22T00:00:00.000Z'),
            assertPlanMutationAllowed: harness.assertPlanMutationAllowed,
        });
        assert.equal(failed.previewStatus, 'failed');
        assert.equal(failed.errorCode, 'SOURCE_NOT_FOUND');
        assert.deepEqual(failed.pages, []);
        assert.deepEqual(failed.previewPaths, []);
        const manifest = harness.database.read(
            `constructionPlans/${harness.planId}/drawingPreviewManifests/${harness.drawingId}`,
        );
        assert.equal(manifest?.authority, 'server');
        assert.equal(manifest?.previewStatus, 'failed');
        const plan = harness.database.read(`constructionPlans/${harness.planId}`) as TestRecord;
        assert.equal((plan.drawings as TestRecord[])[0].previewStatus, 'failed');
    });
});
