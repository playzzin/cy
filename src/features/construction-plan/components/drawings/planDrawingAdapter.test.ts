import type { DrawingStudioValue } from './types';
import {
  createPlanDrawingFromStudio,
  drawingAnnotationsToStudioObjects,
  drawingStudioObjectsToAnnotations,
  projectPlanDrawingToStudio,
  syncPlanDrawingFromStudio,
  toPersistedDrawingStudioValue,
} from './planDrawingAdapter';
import { canonicalDrawingObjectStyle } from './layers';

const studio: DrawingStudioValue = {
  schemaVersion: 1,
  background: {
    fileName: 'D-01.png',
    mimeType: 'image/png',
    sizeBytes: 1024,
    kind: 'image',
    storagePath: 'construction-plans/site-1/plan-1/drawings/D-01.png',
  },
  objects: [
    {
      id: 'install-a',
      kind: 'rectangle',
      layer: 'install',
      points: [{ x: 0.1, y: 0.2 }, { x: 0.4, y: 0.6 }],
      label: '1차 설치',
      zoneCode: 'A-01',
    },
    {
      id: 'remove-a',
      kind: 'arrow',
      layer: 'dismantle',
      points: [{ x: 0.5, y: 0.5 }, { x: 0.8, y: 0.7 }],
      label: '해체 동선',
      zoneCode: '',
    },
  ],
};

describe('planDrawingAdapter', () => {
  it('strips runtime preview URLs while preserving the immutable storage path', () => {
    const persisted = toPersistedDrawingStudioValue({
      ...studio,
      background: { ...studio.background!, sourceUrl: 'blob:private-preview' },
      preview: {
        status: 'ready',
        pageIndex: 0,
        pageCount: 1,
        availablePageIndexes: [0],
        pageFingerprint: `source:${'a'.repeat(64)}:page:0`,
        storagePath: 'construction-plans/site-1/plan-1/previews/drawing-1/page-0001.png',
        sourceUrl: 'blob:derived-preview',
      },
    });

    expect(persisted.background).toMatchObject({
      storagePath: 'construction-plans/site-1/plan-1/drawings/D-01.png',
    });
    expect(persisted.background).not.toHaveProperty('sourceUrl');
    expect(persisted).not.toHaveProperty('preview');
    expect(persisted.objects[0].style).toEqual(canonicalDrawingObjectStyle('install'));
    expect(persisted.objects[1].style).toEqual(canonicalDrawingObjectStyle('dismantle'));
  });

  it('converts normalized studio shapes into auditable drawing annotations', () => {
    const annotations = drawingStudioObjectsToAnnotations(
      studio.objects,
      'worker-1',
      '2026-08-21T00:00:00.000Z',
    );

    expect(annotations).toHaveLength(2);
    expect(annotations[0].geometry).toEqual({
      kind: 'rect', x: 0.1, y: 0.2, w: 0.30000000000000004, h: 0.39999999999999997, rotationDeg: 0,
    });
    expect(annotations[1].geometry).toMatchObject({ kind: 'polyline', arrowEnd: true });
    expect(annotations[1].style.dash).toBe('dot');
    const projected = drawingAnnotationsToStudioObjects(annotations);
    expect(projected).toHaveLength(studio.objects.length);
    expect(projected[0]).toMatchObject(studio.objects[0]);
    expect(projected[1]).toMatchObject(studio.objects[1]);
    expect(projected[0].style).toEqual(annotations[0].style);
    expect(projected[1]).toMatchObject({ arrowStart: false, arrowEnd: true, locked: false });
  });

  it('round-trips ellipse, marker, text and multi-point polyline geometry with canonical layer styles', () => {
    const now = '2026-08-21T00:00:00.000Z';
    const objects: DrawingStudioValue['objects'] = [
      {
        id: 'ellipse-1',
        kind: 'ellipse',
        layer: 'restricted',
        points: [{ x: 0.1, y: 0.2 }, { x: 0.4, y: 0.5 }],
        label: '위험 반경',
        zoneCode: 'R-1',
        style: { strokeToken: 'custom.red', fillToken: 'custom.red.fill', strokeWidthPt: 3, opacity: 0.35, dash: 'dash', hatch: 'cross' },
        locked: true,
      },
      {
        id: 'marker-1',
        kind: 'marker',
        layer: 'equipment',
        points: [{ x: 0.6, y: 0.4 }],
        label: '크레인',
        zoneCode: 'E-1',
        markerType: 'warning',
      },
      {
        id: 'text-1',
        kind: 'text',
        layer: 'storage',
        points: [{ x: 0.2, y: 0.6 }, { x: 0.5, y: 0.7 }],
        label: '자재 적치 금지',
        zoneCode: '',
        textAlign: 'center',
        style: { strokeToken: 'custom.text', strokeWidthPt: 1, opacity: 1, dash: 'solid', fontSizePt: 12 },
      },
      {
        id: 'route-1',
        kind: 'polyline',
        layer: 'pedestrian',
        points: [{ x: 0.1, y: 0.8 }, { x: 0.4, y: 0.75 }, { x: 0.8, y: 0.9 }],
        label: '보행 동선',
        zoneCode: '',
        arrowStart: false,
        arrowEnd: false,
      },
    ];

    const annotations = drawingStudioObjectsToAnnotations(objects, 'worker-1', now);
    expect(annotations.map((annotation) => annotation.geometry.kind)).toEqual(['ellipse', 'marker', 'text', 'polyline']);
    const projected = drawingAnnotationsToStudioObjects(annotations);
    expect(projected).toHaveLength(4);
    expect(projected[0]).toMatchObject({ ...objects[0], style: canonicalDrawingObjectStyle('restricted') });
    expect(projected[1]).toMatchObject(objects[1]);
    expect(projected[2]).toMatchObject({ ...objects[2], style: canonicalDrawingObjectStyle('storage') });
    expect(projected[3]).toMatchObject(objects[3]);
  });

  it('preserves every legacy and structured attribute after editing an existing annotation', () => {
    const now = '2026-08-21T00:00:00.000Z';
    const prior = drawingStudioObjectsToAnnotations([{
      id: 'attribute-contract',
      kind: 'rectangle',
      layer: 'install',
      points: [{ x: 0.1, y: 0.1 }, { x: 0.4, y: 0.4 }],
      label: '기존 설치구간',
      zoneCode: 'A-01',
      sequence: 7,
      startDate: '2026-09-01',
      endDate: '2026-09-30',
      reason: '승인된 작업순서',
      releaseCondition: '구조검토 확인 후 해제',
      equipmentType: '이동식 크레인',
      equipmentId: 'equipment-7',
      entrance: '동문',
      destination: 'A동 작업층',
      radius: 12.5,
      responsibleWorkerId: 'worker-7',
      responsibleRole: '유도자',
      materialType: '시스템동바리 수직재',
    }], 'author-1', now);

    const [editable] = drawingAnnotationsToStudioObjects(prior);
    const [synced] = drawingStudioObjectsToAnnotations(
      [{ ...editable, label: '수정 설치구간' }],
      'author-2',
      '2026-08-21T01:00:00.000Z',
      prior,
    );

    expect(synced).toMatchObject({
      label: '수정 설치구간',
      sequence: 7,
      startDate: '2026-09-01',
      endDate: '2026-09-30',
      reason: '승인된 작업순서',
      releaseCondition: '구조검토 확인 후 해제',
      equipmentType: '이동식 크레인',
      equipmentId: 'equipment-7',
      entrance: '동문',
      destination: 'A동 작업층',
      radius: 12.5,
      responsibleWorkerId: 'worker-7',
      responsibleRole: '유도자',
      materialType: '시스템동바리 수직재',
      createdBy: 'author-1',
      updatedBy: 'author-2',
    });
  });

  it('creates a draft drawing and preserves creation audit fields while syncing', () => {
    const drawing = createPlanDrawingFromStudio({
      id: 'drawing-d01',
      planId: 'plan-1',
      studio,
      storagePath: 'construction-plans/site-1/plan-1/drawings/D-01.png',
      sourceSha256: 'a'.repeat(64),
      previewPath: studio.background?.storagePath,
      drawingNo: 'D-01',
      title: '평면 배치도',
      applicableZones: ['A-01'],
      uploadedBy: 'worker-1',
      now: '2026-08-21T00:00:00.000Z',
    });

    expect(drawing.approvalStatus).toBe('draft');
    expect(drawing.previewStatus).toBe('ready');
    expect(drawing.previewPaths).toEqual(['construction-plans/site-1/plan-1/drawings/D-01.png']);
    expect(drawing.annotations[0].pageFingerprint).toBe(`source:${'a'.repeat(64)}:page:0`);
    const synced = syncPlanDrawingFromStudio(
      drawing,
      { ...studio, objects: [{ ...studio.objects[0], label: '변경된 설치구간' }] },
      'worker-2',
      '2026-08-21T01:00:00.000Z',
    );
    expect(synced.annotations[0]).toMatchObject({
      createdBy: 'worker-1',
      createdAt: '2026-08-21T00:00:00.000Z',
      updatedBy: 'worker-2',
      label: '변경된 설치구간',
    });
  });

  it('rebuilds a PDF studio from its immutable source and exact generated page', () => {
    const sourceSha256 = 'b'.repeat(64);
    const pageFingerprint = `source:${sourceSha256}:page:0`;
    const previewPath = `construction-plans/site-1/plan-1/previews/drawing-pdf/${sourceSha256}/page-0001.png`;
    const pdfDrawing = createPlanDrawingFromStudio({
      id: 'drawing-pdf',
      planId: 'plan-1',
      studio: {
        ...studio,
        background: {
          fileName: 'source.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 2048,
          kind: 'pdf',
          storagePath: 'construction-plans/site-1/plan-1/drawings/source.pdf',
        },
      },
      storagePath: 'construction-plans/site-1/plan-1/drawings/source.pdf',
      sourceSha256,
      sourceGeneration: '10',
      drawingNo: 'D-01',
      title: 'PDF 도면',
      applicableZones: ['A-01'],
      uploadedBy: 'worker-1',
      now: '2026-08-21T00:00:00.000Z',
    });
    const readyDrawing = {
      ...pdfDrawing,
      previewStatus: 'ready' as const,
      previewPaths: [previewPath],
      pages: [{
        pageIndex: 0,
        mediaBoxPt: { left: 0, bottom: 0, right: 612, top: 792 },
        cropBoxPt: { left: 0, bottom: 0, right: 612, top: 792 },
        rotation: 0 as const,
        pageFingerprint,
        previewPath,
        previewGeneration: '11',
        previewSha256: 'c'.repeat(64),
      }],
    };

    const projected = projectPlanDrawingToStudio({
      studio: {
        ...studio,
        background: {
          fileName: 'manual-preview.png',
          mimeType: 'image/png',
          sizeBytes: 100,
          kind: 'image',
          storagePath: 'forged/manual-preview.png',
        },
      },
      drawing: readyDrawing,
      runtimePreviewUrl: 'blob:authorized-page',
    });

    expect(projected.background).toEqual({
      fileName: 'source.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 2048,
      kind: 'pdf',
      storagePath: 'construction-plans/site-1/plan-1/drawings/source.pdf',
    });
    expect(projected.preview).toMatchObject({
      status: 'ready',
      pageFingerprint,
      storagePath: previewPath,
      sourceUrl: 'blob:authorized-page',
    });
  });
});
