import { httpsCallable } from 'firebase/functions';
import { buildConstructionPlanDraft } from '../domain';
import {
  GET_CONSTRUCTION_PLAN_DRAWING_REUSE_DERIVATION_STATUS_CALLABLE,
  IMPORT_CONSTRUCTION_PLAN_DRAWING_LIBRARY_CALLABLE,
  LIST_CONSTRUCTION_PLAN_DRAWING_LIBRARY_CALLABLE,
  createConstructionPlanDrawingLibraryImportIdempotencyKey,
  getConstructionPlanDerivationDrawingReuseStatus,
  importConstructionPlanDrawingFromLibrary,
  listConstructionPlanDrawingLibrary,
} from './constructionPlanDrawingLibraryService';

jest.mock('../../../config/firebase', () => ({ functions: { name: 'test-functions' } }));
jest.mock('firebase/functions', () => ({ httpsCallable: jest.fn() }));

const mockedHttpsCallable = httpsCallable as jest.MockedFunction<typeof httpsCallable>;
const SHA = 'a'.repeat(64);

const importedPlan = () => {
  const draft = buildConstructionPlanDraft('plan-target', {
    siteId: 'site-1',
    siteName: '테스트 현장',
    createdBy: 'actor-1',
  }, '2026-08-22T00:00:00.000Z');
  const section = draft.sections.find((candidate) => (
    candidate.kind === 'drawing-page' || candidate.kind === 'drawing-register'
  )) ?? draft.sections[0];
  const drawing = {
    id: 'drawing-imported',
    planId: draft.id,
    storagePath: `construction-plans/${draft.siteId}/${draft.id}/drawings/drawing-imported/rev-1/source.pdf`,
    sourceSha256: SHA,
    sourceGeneration: '9001',
    sourceRevision: 1,
    originalFileName: '구조도.pdf',
    mimeType: 'application/pdf' as const,
    sizeBytes: 128,
    pageCount: 1,
    drawingNo: 'D-01',
    title: '설치 평면도',
    revision: 'A',
    approvalStatus: 'draft' as const,
    applicableZones: ['A구간'],
    previewStatus: 'pending' as const,
    previewPaths: [],
    pages: [],
    annotations: [],
    uploadedBy: 'actor-1',
    uploadedAt: '2026-08-22T00:00:00.000Z',
  };
  const linkedSection = {
    ...section,
    status: 'in_progress' as const,
    content: { ...section.content, drawingId: drawing.id, drawingPageIndex: 0 },
  };
  return {
    plan: {
      ...draft,
      lockVersion: 2,
      drawings: [drawing],
      sections: draft.sections.map((candidate) => candidate.id === section.id ? linkedSection : candidate),
    },
    drawing,
    section: linkedSection,
  };
};

describe('constructionPlanDrawingLibraryService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('lists bounded safe metadata without exposing browser-copyable Storage bindings', async () => {
    mockedHttpsCallable.mockReturnValueOnce(jest.fn().mockResolvedValue({
      data: {
        items: [{
          sourcePlanId: 'plan-source',
          sourcePlanTitle: '기준 계획서',
          sourceDocumentNo: 'CP-001',
          sourcePlanRevision: 3,
          sourcePlanStatus: 'issued',
          drawingId: 'drawing-source',
          drawingNo: 'D-01',
          title: '설치 평면도',
          originalFileName: '구조도.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 128,
          sourceSha256: SHA,
          approvalStatus: 'approved',
          reusable: true,
        }],
        nextCursor: 'next-page',
      },
    }) as never);

    await expect(listConstructionPlanDrawingLibrary({ targetPlanId: 'plan-target', pageSize: 20 }))
      .resolves.toEqual(expect.objectContaining({
        items: [expect.objectContaining({ sourcePlanId: 'plan-source', reusable: true })],
        nextCursor: 'next-page',
      }));
    expect(mockedHttpsCallable).toHaveBeenCalledWith(
      expect.anything(),
      LIST_CONSTRUCTION_PLAN_DRAWING_LIBRARY_CALLABLE,
    );
  });

  it('fails closed if a library response leaks a Storage path or generation', async () => {
    mockedHttpsCallable.mockReturnValueOnce(jest.fn().mockResolvedValue({
      data: {
        items: [{
          sourcePlanId: 'plan-source', sourcePlanTitle: '기준', sourceDocumentNo: 'CP-001',
          sourcePlanRevision: 1, sourcePlanStatus: 'issued', drawingId: 'drawing-source',
          drawingNo: 'D-01', title: '도면', originalFileName: 'drawing.pdf',
          mimeType: 'application/pdf', sizeBytes: 10, sourceSha256: SHA,
          approvalStatus: 'approved', reusable: true,
          storagePath: 'construction-plans/site-1/source/drawings/d/rev-1/source.pdf',
        }],
      },
    }) as never);

    await expect(listConstructionPlanDrawingLibrary({ targetPlanId: 'plan-target' }))
      .rejects.toThrow('unsafe-field');
  });

  it('accepts only a server-returned target binding with draft approval and canonical plan path', async () => {
    const fixture = importedPlan();
    mockedHttpsCallable.mockReturnValueOnce(jest.fn().mockResolvedValue({
      data: {
        planId: fixture.plan.id,
        sourcePlanId: 'plan-source',
        sourceDrawingId: 'drawing-source',
        targetDrawingId: fixture.drawing.id,
        lockVersion: fixture.plan.lockVersion,
        plan: fixture.plan,
        drawing: fixture.drawing,
        section: fixture.section,
        idempotent: false,
      },
    }) as never);

    const result = await importConstructionPlanDrawingFromLibrary({
      targetPlanId: fixture.plan.id,
      targetSectionId: fixture.section.id,
      sourcePlanId: 'plan-source',
      sourceDrawingId: 'drawing-source',
      expectedLockVersion: 1,
      idempotencyKey: 'request-1',
    });
    expect(result.drawing.storagePath).toContain(`/${fixture.plan.id}/drawings/${fixture.drawing.id}/rev-1/`);
    expect(result.drawing.sourceGeneration).toBe('9001');
    expect(result.drawing.approvalStatus).toBe('draft');
    expect(mockedHttpsCallable).toHaveBeenCalledWith(
      expect.anything(),
      IMPORT_CONSTRUCTION_PLAN_DRAWING_LIBRARY_CALLABLE,
    );
  });

  it('rejects an import response that still points at the source plan path', async () => {
    const fixture = importedPlan();
    const forgedDrawing = {
      ...fixture.drawing,
      storagePath: 'construction-plans/site-1/plan-source/drawings/drawing-source/rev-1/source.pdf',
    };
    const forgedPlan = { ...fixture.plan, drawings: [forgedDrawing] };
    mockedHttpsCallable.mockReturnValueOnce(jest.fn().mockResolvedValue({
      data: {
        planId: forgedPlan.id,
        sourcePlanId: 'plan-source',
        sourceDrawingId: 'drawing-source',
        targetDrawingId: forgedDrawing.id,
        lockVersion: forgedPlan.lockVersion,
        plan: forgedPlan,
        drawing: forgedDrawing,
        section: fixture.section,
        idempotent: false,
      },
    }) as never);

    await expect(importConstructionPlanDrawingFromLibrary({
      targetPlanId: forgedPlan.id,
      targetSectionId: fixture.section.id,
      sourcePlanId: 'plan-source',
      sourceDrawingId: 'drawing-source',
      expectedLockVersion: 1,
      idempotencyKey: 'request-1',
    })).rejects.toThrow('drawing-binding');
  });

  it('recovers a response-loss derivation only from a completed server job', async () => {
    mockedHttpsCallable.mockReturnValueOnce(jest.fn().mockResolvedValue({
      data: {
        status: 'completed',
        targetPlanId: 'plan-derived',
        result: {
          planId: 'plan-derived',
          seriesId: 'series-1',
          revisionNo: 4,
          documentNo: 'CP-001',
          idempotent: false,
        },
      },
    }) as never);
    await expect(getConstructionPlanDerivationDrawingReuseStatus({
      operation: 'revision',
      idempotencyKey: 'request-1',
    })).resolves.toEqual(expect.objectContaining({
      status: 'completed',
      targetPlanId: 'plan-derived',
    }));
    expect(mockedHttpsCallable).toHaveBeenCalledWith(
      expect.anything(),
      GET_CONSTRUCTION_PLAN_DRAWING_REUSE_DERIVATION_STATUS_CALLABLE,
    );
  });

  it('creates bounded retry keys for explicit user retries', () => {
    const key = createConstructionPlanDrawingLibraryImportIdempotencyKey();
    expect(key).toMatch(/^cp-drawing-reuse-/);
    expect(key.length).toBeLessThanOrEqual(128);
  });
});
