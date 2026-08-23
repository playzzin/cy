import type { PlanDrawing } from '../types';
import {
  applyDrawingPreviewResult,
  canonicalDrawingPageFingerprint,
  ConstructionPlanDrawingPreviewResultSchema,
  EnsureConstructionPlanDrawingPreviewRequestSchema,
  resolveDrawingPreviewPage,
} from './drawingPreview';

const sourceSha256 = 'a'.repeat(64);
const sourcePath = 'construction-plans/site-1/plan-1/drawings/drawing-1/rev-1/source.pdf';
const previewPath = (pageIndex: number) =>
  `construction-plans/site-1/plan-1/previews/drawing-1/${sourceSha256}/page-${String(pageIndex + 1).padStart(4, '0')}.png`;

const drawing = (patch: Partial<PlanDrawing> = {}): PlanDrawing => ({
  id: 'drawing-1',
  planId: 'plan-1',
  storagePath: sourcePath,
  sourceSha256,
  originalFileName: '승인도면.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 4096,
  pageCount: 1,
  drawingNo: 'D-01',
  title: '구조 평면도',
  revision: 'A',
  approvalStatus: 'draft',
  applicableZones: ['A-01'],
  previewStatus: 'pending',
  previewPaths: [],
  pages: [],
  annotations: [{
    id: 'mark-1',
    pageIndex: 1,
    layer: 'install',
    geometry: { kind: 'rect', x: 0.1, y: 0.2, w: 0.3, h: 0.4, rotationDeg: 0 },
    style: {
      strokeToken: 'construction-plan.install.stroke',
      strokeWidthPt: 2,
      opacity: 0.4,
      dash: 'solid',
    },
    label: '설치 구간',
    styleVersion: 1,
    locked: false,
    createdBy: 'worker-1',
    createdAt: '2026-08-22T00:00:00.000Z',
    updatedBy: 'worker-1',
    updatedAt: '2026-08-22T00:00:00.000Z',
  }],
  uploadedBy: 'worker-1',
  uploadedAt: '2026-08-22T00:00:00.000Z',
  ...patch,
});

const page = (pageIndex: number, rotation: 0 | 90 | 180 | 270 = 0) => ({
  pageIndex,
  mediaBoxPt: { left: 0, bottom: 0, right: 842, top: 595 },
  cropBoxPt: { left: 12, bottom: 18, right: 830, top: 577 },
  rotation,
  pageFingerprint: canonicalDrawingPageFingerprint(sourceSha256, pageIndex),
  previewPath: previewPath(pageIndex),
  previewGeneration: String(200 + pageIndex),
  previewSha256: String(pageIndex + 1).repeat(64),
});

const readyResult = () => ({
  siteId: 'site-1',
  planId: 'plan-1',
  drawingId: 'drawing-1',
  sourceStoragePath: sourcePath,
  sourceSha256,
  sourceGeneration: '101',
  previewStatus: 'ready' as const,
  pageCount: 2,
  pages: [page(0), page(1, 90)],
  previewPaths: [previewPath(0), previewPath(1)],
  processedAt: '2026-08-22T01:00:00.000Z',
  idempotent: false,
});

describe('construction plan drawing preview manifest', () => {
  it('rejects drawing IDs that could collide after Storage segment sanitization', () => {
    const request = {
      planId: 'plan-1',
      drawingId: 'drawing/one',
      expectedSourceStoragePath: sourcePath,
      expectedSourceSha256: sourceSha256,
      expectedSourceGeneration: '101',
      idempotencyKey: 'preview-drawing-one',
    };
    expect(EnsureConstructionPlanDrawingPreviewRequestSchema.safeParse(request).success).toBe(false);
    expect(EnsureConstructionPlanDrawingPreviewRequestSchema.safeParse({
      ...request,
      drawingId: 'drawing-one',
    }).success).toBe(true);
  });

  it('requires a complete canonical page mapping before READY', () => {
    const incomplete = readyResult();
    incomplete.pages = [page(0)];
    incomplete.previewPaths = [previewPath(0)];

    expect(ConstructionPlanDrawingPreviewResultSchema.safeParse(incomplete).success).toBe(false);

    const wrongPath = readyResult();
    wrongPath.pages[1] = { ...wrongPath.pages[1], previewPath: sourcePath };
    wrongPath.previewPaths[1] = sourcePath;
    expect(ConstructionPlanDrawingPreviewResultSchema.safeParse(wrongPath).success).toBe(false);

    const crossDrawingPath = readyResult();
    crossDrawingPath.pages[0] = {
      ...crossDrawingPath.pages[0],
      previewPath: previewPath(0).replace('/previews/drawing-1/', '/previews/drawing-2/'),
    };
    crossDrawingPath.previewPaths[0] = crossDrawingPath.pages[0].previewPath;
    expect(ConstructionPlanDrawingPreviewResultSchema.safeParse(crossDrawingPath).success).toBe(false);

    const missingArtifactIdentity = readyResult();
    missingArtifactIdentity.pages[0] = {
      ...missingArtifactIdentity.pages[0],
      previewGeneration: undefined as unknown as string,
      previewSha256: undefined as unknown as string,
    };
    expect(ConstructionPlanDrawingPreviewResultSchema.safeParse(missingArtifactIdentity).success).toBe(false);
  });

  it('applies only derived fields and reconnects each exact page', () => {
    const source = drawing();
    const applied = applyDrawingPreviewResult(source, readyResult());

    expect(applied).toMatchObject({
      storagePath: source.storagePath,
      sourceSha256: source.sourceSha256,
      sourceGeneration: '101',
      previewStatus: 'ready',
      pageCount: 2,
      previewPaths: [previewPath(0), previewPath(1)],
    });
    expect(applied.pages[1]).toMatchObject({
      pageIndex: 1,
      rotation: 90,
      cropBoxPt: { left: 12, bottom: 18, right: 830, top: 577 },
    });
    expect(applied.annotations[0].pageFingerprint).toBe(
      canonicalDrawingPageFingerprint(sourceSha256, 1),
    );
    expect(resolveDrawingPreviewPage(applied, 0)).toMatchObject({
      ready: true,
      storagePath: previewPath(0),
      pageFingerprint: canonicalDrawingPageFingerprint(sourceSha256, 0),
    });
    expect(resolveDrawingPreviewPage(applied, 1)).toMatchObject({
      ready: true,
      storagePath: previewPath(1),
      pageFingerprint: canonicalDrawingPageFingerprint(sourceSha256, 1),
    });
  });

  it('rejects a stale source generation and a READY status regression', () => {
    expect(() => applyDrawingPreviewResult(
      drawing({ sourceGeneration: 'different-generation' }),
      readyResult(),
    )).toThrow('construction-plan-drawing-preview-stale-source');

    const processing = {
      ...readyResult(),
      previewStatus: 'processing' as const,
      pages: [],
      previewPaths: [],
    };
    expect(() => applyDrawingPreviewResult(
      drawing({ ...applyDrawingPreviewResult(drawing(), readyResult()) }),
      processing,
    )).toThrow('construction-plan-drawing-preview-status-regression');
  });

  it('preserves a retryable FAILED code while blocking page resolution', () => {
    const failed = applyDrawingPreviewResult(drawing(), {
      ...readyResult(),
      previewStatus: 'failed',
      pages: [],
      previewPaths: [],
      errorCode: 'PDF_PASSWORD_REQUIRED',
      errorMessage: '암호화된 PDF는 미리보기를 생성할 수 없습니다.',
    });

    expect(failed).toMatchObject({
      previewStatus: 'failed',
      previewErrorCode: 'PDF_PASSWORD_REQUIRED',
    });
    expect(resolveDrawingPreviewPage(failed, 0)).toMatchObject({
      ready: false,
      status: 'failed',
      reason: 'preview-not-ready',
      errorCode: 'PDF_PASSWORD_REQUIRED',
    });
  });
});
