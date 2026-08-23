import type {
  ConstructionPlan,
  ConstructionPlanReviewComment,
  ConstructionPlanReviewPackage,
  PlanDrawing,
} from '../types';
import {
  constructionPlanReviewUiAdapter,
  resolveConstructionPlanReviewAnchorSectionId,
  resolveConstructionPlanReviewDrawingPage,
} from './constructionPlanReviewUiAdapter';
import { getConstructionPlan } from './constructionPlanService';
import {
  listConstructionPlanReviewCommentsWithPermissionsServer,
  listConstructionPlanReviewPackagesServer,
} from './constructionPlanReviewService';

jest.mock('./constructionPlanService', () => ({ getConstructionPlan: jest.fn() }));
jest.mock('./constructionPlanReviewService', () => ({
  createConstructionPlanReviewCommentServer: jest.fn(),
  listConstructionPlanReviewCommentsWithPermissionsServer: jest.fn(),
  listConstructionPlanReviewMessagesServer: jest.fn(),
  listConstructionPlanReviewPackagesServer: jest.fn(),
  replyConstructionPlanReviewCommentServer: jest.fn(),
  transitionConstructionPlanReviewCommentServer: jest.fn(),
  getConstructionPlanDrawingPageFingerprint: (drawing: PlanDrawing, pageIndex: number) => {
    const page = drawing.pages.find((candidate) => candidate.pageIndex === pageIndex);
    if (page?.pageFingerprint.trim()) return page.pageFingerprint.trim();
    if (drawing.pages.length === 0 && drawing.pageCount === 1 && pageIndex === 0) {
      return `source:${drawing.sourceSha256.trim().toLowerCase()}:page:0`;
    }
    return undefined;
  },
}));

describe('constructionPlanReviewUiAdapter navigation helpers', () => {
  const plan = {
    sections: [
      { id: 'drawing-section', key: 'drawing-install', kind: 'drawing-page', content: { drawingId: 'drawing-1' } },
      { id: 'engineering-section', key: 'structural-control', kind: 'structured-form', content: {} },
      { id: 'risk-section', key: 'risk-assessment', kind: 'risk-assessment', content: {} },
    ],
  } as ConstructionPlan;

  it('routes drawing and structured field anchors by stable IDs', () => {
    expect(resolveConstructionPlanReviewAnchorSectionId(plan, {
      kind: 'drawing', label: '설치구간', drawingId: 'drawing-1', pageIndex: 0, pageFingerprint: 'fp-1',
    })).toBe('drawing-section');
    expect(resolveConstructionPlanReviewAnchorSectionId(plan, {
      kind: 'field', label: '구조값', entityType: 'engineering_value', entityId: 'spacing', jsonPointer: '/value',
    })).toBe('engineering-section');
    expect(resolveConstructionPlanReviewAnchorSectionId(plan, {
      kind: 'field', label: '위험성평가', entityType: 'risk_assessment', entityId: 'risk-1', jsonPointer: '/riskLevel',
    })).toBe('risk-section');
  });

  it('uses the canonical page fingerprint and the single-page source fallback', () => {
    expect(resolveConstructionPlanReviewDrawingPage({
      pages: [{ pageIndex: 2, pageFingerprint: 'canonical-page' }], pageCount: 3,
    } as PlanDrawing)).toEqual({ pageIndex: 2, pageFingerprint: 'canonical-page' });
    expect(resolveConstructionPlanReviewDrawingPage({
      pages: [], pageCount: 1, sourceSha256: 'ABCDEF123',
    } as unknown as PlanDrawing)).toEqual({ pageIndex: 0, pageFingerprint: 'source:abcdef123:page:0' });
    expect(resolveConstructionPlanReviewDrawingPage({
      pages: [], pageCount: 2, sourceSha256: 'source-hash',
    } as unknown as PlanDrawing)).toBeUndefined();
  });
});

describe('constructionPlanReviewUiAdapter historical comparison', () => {
  const iso = '2026-08-22T00:00:00.000Z';
  const hash = 'a'.repeat(64);
  const diffSummary = {
    summaryVersion: 2 as const,
    changedTopLevelFields: [],
    changedSectionIds: [],
    changedDrawingIds: [],
    addedDrawingIds: [],
    removedDrawingIds: [],
    textChanges: [],
    fieldChanges: [],
    drawingChanges: [],
    annotationChanges: [],
    changeCount: 0,
  };
  const commentSummary = {
    totalOpen: 0,
    totalAddressed: 0,
    totalResolved: 0,
    requiredOpen: 0,
    requiredAddressed: 0,
    requiredResolved: 0,
    unresolvedRequired: 0,
    updatedAt: iso,
  };
  const packages = [1, 2, 3].map((round): ConstructionPlanReviewPackage => ({
    id: `package-${round}`,
    planId: 'plan-1',
    reviewSnapshotId: `snapshot-${round}`,
    reviewSnapshotHash: hash,
    reviewSnapshotStoragePath: `construction-plans/site-1/plan-1/snapshots/snapshot-${round}.json`,
    reviewSnapshotLockVersion: round,
    reviewCycleId: 'cycle-1',
    round,
    status: round === 3 ? 'active' : 'superseded',
    unresolvedRequiredAtSubmit: 0,
    commentSummary,
    diffSummary,
    ...(round > 1 ? { previousPackageId: `package-${round - 1}` } : {}),
    createdBy: 'reviewer-1',
    createdAt: iso,
  }));
  const comments = [1, 2, 3].map((round): ConstructionPlanReviewComment => ({
    id: `comment-${round}`,
    planId: 'plan-1',
    body: `Round ${round} 의견`,
    reviewPackageId: `package-${round}`,
    reviewSnapshotId: `snapshot-${round}`,
    reviewSnapshotHash: hash,
    reviewCycleId: 'cycle-1',
    anchor: { kind: 'plan' },
    anchorStatus: 'active',
    visibility: 'participants',
    required: true,
    status: 'open',
    version: 1,
    replyCount: 0,
    authorReplyCount: 0,
    createdBy: 'reviewer-1',
    createdAt: iso,
    updatedAt: iso,
    permissions: { canReply: true, canAddress: true, canResolve: true, canReopen: true },
  }));

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(getConstructionPlan).mockResolvedValue({
      id: 'plan-1',
      activeReviewPackageId: 'package-3',
      activeReviewSnapshotId: 'snapshot-3',
      sections: [],
      drawings: [],
    } as unknown as ConstructionPlan);
    jest.mocked(listConstructionPlanReviewPackagesServer).mockResolvedValue(packages);
    jest.mocked(listConstructionPlanReviewCommentsWithPermissionsServer).mockResolvedValue({
      comments,
      permissions: { canCreateComment: true },
    });
  });

  it('hides future-round comments and makes a historical package read-only', async () => {
    const workspace = await constructionPlanReviewUiAdapter.loadWorkspace('plan-1', { reviewPackageId: 'snapshot-2' });

    expect(workspace.comments.map((comment) => comment.id)).toEqual(['comment-1', 'comment-2']);
    expect(workspace.permissions?.canCreateComment).toBe(false);
    expect(workspace.comparison?.readOnly).toBe(true);
    workspace.comments.forEach((comment) => {
      expect(comment.permissions).toEqual({
        canReply: false,
        canMarkAddressed: false,
        canResolve: false,
        canReopen: false,
      });
    });
  });

  it('maps every signed text, structured field, drawing and annotation change with immutable labels', async () => {
    jest.mocked(getConstructionPlan).mockResolvedValue({
      id: 'plan-1',
      revision: 2,
      sourceRevisionNo: 1,
      sourceSnapshotHash: 'c'.repeat(64),
      activeReviewPackageId: 'package-3',
      activeReviewSnapshotId: 'snapshot-3',
      sections: [{ id: 'drawing-section', kind: 'drawing-page', content: { drawingId: 'drawing-1' } }],
      drawings: [],
    } as unknown as ConstructionPlan);
    const detailed = packages.map((item) => item.id !== 'package-3' ? item : ({
      ...item,
      previousPackageId: undefined,
      diffSummary: {
        summaryVersion: 2 as const,
        baselineKind: 'prior_issued' as const,
        baselineContentHash: 'b'.repeat(64),
        currentContentHash: 'a'.repeat(64),
        summaryHash: 'd'.repeat(64),
        changedTopLevelFields: ['title'],
        changedSectionIds: ['method'],
        changedDrawingIds: ['drawing-1'],
        addedDrawingIds: [],
        removedDrawingIds: [],
        textChanges: [{
          id: 'text-1', changeType: 'changed' as const, path: '/sections/method/content/standardTextCurrent', label: '표준 시공문구',
          sectionId: 'method', sectionLabel: '시공 방법', pageNumbers: [12], before: '기존 문구', after: '변경 문구',
          beforeHash: '1'.repeat(64), afterHash: '2'.repeat(64), valueTruncated: false,
          segments: [{ kind: 'removed' as const, text: '기존' }, { kind: 'added' as const, text: '변경' }, { kind: 'equal' as const, text: ' 문구' }],
        }],
        fieldChanges: [{
          id: 'field-1', entityKind: 'field' as const, changeType: 'changed' as const, path: '/sections/method/content/spacing', label: '설치 간격',
          sectionId: 'method', sectionLabel: '시공 방법', pageNumbers: [12], before: '900', after: '600',
          beforeHash: '3'.repeat(64), afterHash: '4'.repeat(64), valueTruncated: false,
        }],
        drawingChanges: [{
          id: 'drawing-change-1', changeType: 'changed' as const, drawingId: 'drawing-1', drawingLabel: '설치 평면도', pageNumbers: [1],
          changedFields: ['도면 Rev.', '주석'], beforeSummary: 'Rev.A', afterSummary: 'Rev.B',
          beforeHash: '5'.repeat(64), afterHash: '6'.repeat(64),
        }],
        annotationChanges: [{
          id: 'annotation-change-1', changeType: 'changed' as const, drawingId: 'drawing-1', drawingLabel: '설치 평면도',
          annotationId: 'annotation-1', annotationLabel: '통제구간', pageIndex: 0, pageId: 'page-1-abcdef123456', pageLabel: '1쪽',
          changedParts: ['geometry' as const, 'style' as const], geometryBefore: '사각형 x 0.1', geometryAfter: '사각형 x 0.2',
          styleBefore: '두께 1pt', styleAfter: '두께 2pt', beforeHash: '7'.repeat(64), afterHash: '8'.repeat(64),
        }],
        changeCount: 4,
      },
    }));
    jest.mocked(listConstructionPlanReviewPackagesServer).mockResolvedValue(detailed);

    const workspace = await constructionPlanReviewUiAdapter.loadWorkspace('plan-1');

    expect(workspace.comparison?.baseline).toEqual(expect.objectContaining({
      kind: 'prior_issued', hash: 'b'.repeat(64),
    }));
    expect(workspace.comparison?.readOnly).toBe(false);
    expect(workspace.comparison?.changes.map((change) => change.kind)).toEqual([
      'text', 'field', 'drawing', 'annotation',
    ]);
    expect(workspace.comparison?.changes[0]).toEqual(expect.objectContaining({
      path: '/sections/method/content/standardTextCurrent',
      sectionLabel: '시공 방법',
      pageNumbers: [12],
    }));
    expect(workspace.comparison?.changes[3]).toEqual(expect.objectContaining({
      annotationId: 'annotation-1',
      drawingId: 'drawing-1',
      pageId: 'page-1-abcdef123456',
      before: expect.stringContaining('두께 1pt'),
      after: expect.stringContaining('두께 2pt'),
    }));
    expect(workspace.comparison?.changedAnnotationCount).toBe(1);
    expect(workspace.comparison?.changes).toHaveLength(4);
  });
});
