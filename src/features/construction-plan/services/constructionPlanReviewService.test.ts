import { createHash } from 'crypto';
import { httpsCallable } from 'firebase/functions';
import { getBlob, ref } from 'firebase/storage';
import type { ConstructionPlan } from '../types';
import { buildConstructionPlanDraft } from '../domain/drafts';
import {
  CREATE_CONSTRUCTION_PLAN_REVIEW_COMMENT_CALLABLE,
  LIST_CONSTRUCTION_PLAN_REVIEW_COMMENTS_CALLABLE,
  LIST_CONSTRUCTION_PLAN_REVIEW_MESSAGES_CALLABLE,
  LIST_CONSTRUCTION_PLAN_REVIEW_PACKAGES_CALLABLE,
  REPLY_CONSTRUCTION_PLAN_REVIEW_COMMENT_CALLABLE,
  TRANSITION_CONSTRUCTION_PLAN_REVIEW_COMMENT_CALLABLE,
  createConstructionPlanReviewCommentServer,
  downloadVerifiedConstructionPlanSnapshotContent,
  getConstructionPlanSnapshotContent,
  getConstructionPlanDrawingPageFingerprint,
  getConstructionPlanSnapshotPointer,
  listConstructionPlanReviewCommentsServer,
  listConstructionPlanReviewCommentsWithPermissionsServer,
  listConstructionPlanReviewMessagesServer,
  listConstructionPlanReviewPackagesServer,
  materializeConstructionPlanSnapshot,
  replyConstructionPlanReviewCommentServer,
  transitionConstructionPlanReviewCommentServer,
} from './constructionPlanReviewService';

jest.mock('../../../config/firebase', () => ({
  functions: { name: 'test-functions' },
  storage: { name: 'test-storage' },
}));

jest.mock('firebase/functions', () => ({
  httpsCallable: jest.fn(),
}));

jest.mock('firebase/storage', () => ({
  getBlob: jest.fn(),
  ref: jest.fn((_storage, path: string) => ({ fullPath: path })),
}));

const now = '2026-08-22T00:00:00.000Z';
const snapshotHash = 'a'.repeat(64);
const summary = {
  totalOpen: 1,
  totalAddressed: 0,
  totalResolved: 0,
  requiredOpen: 1,
  requiredAddressed: 0,
  requiredResolved: 0,
  unresolvedRequired: 1,
  updatedAt: now,
};
const comment = {
  id: 'comment-1',
  planId: 'plan-1',
  body: '필수 확인 의견',
  reviewPackageId: 'package-1',
  reviewSnapshotId: 'snapshot-1',
  reviewSnapshotHash: snapshotHash,
  reviewCycleId: 'cycle-1',
  anchor: { kind: 'plan' as const },
  anchorStatus: 'active' as const,
  visibility: 'participants' as const,
  required: true,
  status: 'open' as const,
  version: 0,
  replyCount: 0,
  authorReplyCount: 0,
  createdBy: 'reviewer-1',
  createdByName: '검토자',
  createdAt: now,
  updatedAt: now,
};
const message = {
  id: 'message-1',
  planId: 'plan-1',
  commentId: 'comment-1',
  body: '확인했습니다.',
  createdBy: 'author-1',
  createdByName: '작성자',
  createdAt: now,
};
const reviewPackage = {
  id: 'package-1',
  planId: 'plan-1',
  reviewSnapshotId: 'snapshot-1',
  reviewSnapshotHash: snapshotHash,
  reviewSnapshotStoragePath: `construction-plans/site-1/plan-1/snapshots/${snapshotHash}.json`,
  reviewSnapshotLockVersion: 3,
  reviewCycleId: 'cycle-1',
  round: 1,
  status: 'active' as const,
  unresolvedRequiredAtSubmit: 1,
  commentSummary: summary,
  diffSummary: {
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
  },
  previousPackageId: null,
  createdBy: 'author-1',
  createdAt: now,
};

describe('constructionPlanReviewService', () => {
  const mockedHttpsCallable = httpsCallable as jest.MockedFunction<typeof httpsCallable>;
  const mockedGetBlob = getBlob as jest.MockedFunction<typeof getBlob>;
  const mockedRef = ref as jest.MockedFunction<typeof ref>;
  const originalCryptoDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');

  const buildProductionSnapshotEnvelope = () => {
    const snapshotPlan = buildConstructionPlanDraft('plan-1', {
      siteId: 'site-1',
      siteName: '테스트 현장',
      createdBy: 'author-1',
    }, now);
    return {
      snapshotSchemaVersion: 1 as const,
      kind: 'review_submission' as const,
      planId: snapshotPlan.id,
      content: {
        planId: snapshotPlan.id,
        snapshotSchemaVersion: 1 as const,
        siteId: snapshotPlan.siteId,
        title: '검토 제출본',
        tradeType: snapshotPlan.tradeType,
        documentNo: snapshotPlan.documentNo,
        documentDate: snapshotPlan.documentDate,
        revision: snapshotPlan.revision,
        templateId: snapshotPlan.templateId,
        templateVersion: snapshotPlan.templateVersion,
        rendererVersion: snapshotPlan.rendererVersion,
        schemaVersion: snapshotPlan.schemaVersion,
        projectSnapshot: snapshotPlan.projectSnapshot,
        organizationSnapshot: snapshotPlan.organizationSnapshot,
        sections: snapshotPlan.sections,
        sectionOrder: snapshotPlan.sectionOrder,
        drawings: snapshotPlan.drawings,
        drawingApplicability: snapshotPlan.drawingApplicability,
        engineeringValues: snapshotPlan.engineeringValues,
        equipmentPlan: snapshotPlan.equipmentPlan,
        riskAssessments: snapshotPlan.riskAssessments,
        createdBy: snapshotPlan.createdBy,
        createdAt: snapshotPlan.createdAt,
      },
    };
  };

  const mockSnapshotBlob = (serialized: string): string => {
    const bytes = Uint8Array.from(Buffer.from(serialized, 'utf8'));
    const contentHash = createHash('sha256').update(bytes).digest('hex');
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: {
        subtle: {
          digest: jest.fn().mockResolvedValue(
            Uint8Array.from(Buffer.from(contentHash, 'hex')).buffer,
          ),
        },
      },
    });
    mockedGetBlob.mockResolvedValue({
      arrayBuffer: jest.fn().mockResolvedValue(
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      ),
      text: jest.fn().mockResolvedValue(serialized),
    } as never);
    return contentHash;
  };

  const snapshotPointer = (contentHash: string) => ({
    planId: 'plan-1',
    snapshotId: 'snapshot-1',
    storagePath: `construction-plans/site-1/plan-1/snapshots/${contentHash}.json`,
    contentHash,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockedHttpsCallable.mockImplementation(((_functions: unknown, callableName: string) => {
      const responses: Record<string, unknown> = {
        [CREATE_CONSTRUCTION_PLAN_REVIEW_COMMENT_CALLABLE]: { comment },
        [REPLY_CONSTRUCTION_PLAN_REVIEW_COMMENT_CALLABLE]: { message },
        [LIST_CONSTRUCTION_PLAN_REVIEW_COMMENTS_CALLABLE]: {
          comments: [comment],
          permissions: { canCreateComment: true },
        },
        [LIST_CONSTRUCTION_PLAN_REVIEW_MESSAGES_CALLABLE]: { messages: [message] },
        [TRANSITION_CONSTRUCTION_PLAN_REVIEW_COMMENT_CALLABLE]: {
          comment: { ...comment, status: 'resolved', version: 1, resolvedBy: 'reviewer-1', resolvedAt: now },
        },
        [LIST_CONSTRUCTION_PLAN_REVIEW_PACKAGES_CALLABLE]: { packages: [reviewPackage] },
      };
      return jest.fn().mockResolvedValue({ data: responses[callableName] });
    }) as never);
  });

  afterAll(() => {
    if (originalCryptoDescriptor) {
      Object.defineProperty(globalThis, 'crypto', originalCryptoDescriptor);
    } else {
      delete (globalThis as { crypto?: Crypto }).crypto;
    }
  });

  it('validates requests and parses comment, message and package callable responses', async () => {
    await expect(createConstructionPlanReviewCommentServer({
      requestId: 'request-create',
      planId: 'plan-1',
      anchor: { kind: 'plan' },
      visibility: 'participants',
      required: true,
      body: '  필수 확인 의견  ',
    })).resolves.toEqual(comment);
    await expect(replyConstructionPlanReviewCommentServer({
      requestId: 'request-reply',
      planId: 'plan-1',
      commentId: 'comment-1',
      body: message.body,
    })).resolves.toEqual(message);
    await expect(listConstructionPlanReviewCommentsServer({ planId: 'plan-1' }))
      .resolves.toEqual([comment]);
    await expect(listConstructionPlanReviewCommentsWithPermissionsServer({ planId: 'plan-1' }))
      .resolves.toEqual({ comments: [comment], permissions: { canCreateComment: true } });
    await expect(listConstructionPlanReviewMessagesServer({
      planId: 'plan-1',
      commentId: 'comment-1',
    })).resolves.toEqual([message]);
    await expect(transitionConstructionPlanReviewCommentServer({
      requestId: 'request-transition',
      planId: 'plan-1',
      commentId: 'comment-1',
      action: 'resolve',
      expectedVersion: 0,
    })).resolves.toEqual(expect.objectContaining({ status: 'resolved', version: 1 }));
    await expect(listConstructionPlanReviewPackagesServer({ planId: 'plan-1' }))
      .resolves.toEqual([expect.objectContaining({ id: 'package-1', previousPackageId: undefined })]);

    const createInvoke = mockedHttpsCallable.mock.results[0].value as jest.Mock;
    expect(createInvoke).toHaveBeenCalledWith(expect.objectContaining({
      body: '필수 확인 의견',
    }));
  });

  it('accepts a bounded signed rich diff contract and rejects a mismatched detailed count', async () => {
    const signedPackage = {
      ...reviewPackage,
      previousPackageId: undefined,
      diffSummary: {
        summaryVersion: 2,
        baselineKind: 'previous_submission',
        baselineContentHash: 'b'.repeat(64),
        currentContentHash: 'a'.repeat(64),
        summaryHash: 'c'.repeat(64),
        changedTopLevelFields: [],
        changedSectionIds: ['method'],
        changedDrawingIds: [],
        addedDrawingIds: [],
        removedDrawingIds: [],
        textChanges: [{
          id: 'text-1', changeType: 'changed', path: '/sections/method/content/standardTextCurrent', label: '표준 시공문구',
          sectionId: 'method', sectionLabel: '시공 방법', pageNumbers: [12], before: '기존', after: '변경',
          beforeHash: '1'.repeat(64), afterHash: '2'.repeat(64),
          segments: [{ kind: 'removed', text: '기존' }, { kind: 'added', text: '변경' }], valueTruncated: false,
        }],
        fieldChanges: [],
        drawingChanges: [],
        annotationChanges: [],
        changeCount: 1,
      },
    };
    mockedHttpsCallable.mockImplementationOnce((() => jest.fn().mockResolvedValue({
      data: { packages: [signedPackage] },
    })) as never);
    await expect(listConstructionPlanReviewPackagesServer({ planId: 'plan-1' }))
      .resolves.toEqual([expect.objectContaining({
        diffSummary: expect.objectContaining({ summaryHash: 'c'.repeat(64), changeCount: 1 }),
      })]);

    mockedHttpsCallable.mockImplementationOnce((() => jest.fn().mockResolvedValue({
      data: { packages: [{ ...signedPackage, diffSummary: { ...signedPackage.diffSummary, changeCount: 0 } }] },
    })) as never);
    await expect(listConstructionPlanReviewPackagesServer({ planId: 'plan-1' }))
      .rejects.toThrow(/Detailed review change count/);
  });

  it('derives active and approved immutable snapshot pointers from the plan', () => {
    const plan = {
      id: 'plan-1',
      activeReviewSnapshotId: 'review-snapshot',
      activeReviewSnapshotHash: snapshotHash,
      activeReviewSnapshotStoragePath: `construction-plans/site-1/plan-1/snapshots/${snapshotHash}.json`,
      approvedSnapshotId: 'approved-snapshot',
      approvedSnapshotHash: snapshotHash,
      approvedSnapshotStoragePath: `construction-plans/site-1/plan-1/snapshots/${snapshotHash}.json`,
    } as ConstructionPlan;

    expect(getConstructionPlanSnapshotPointer(plan, 'active_review').snapshotId).toBe('review-snapshot');
    expect(getConstructionPlanSnapshotPointer(plan, 'approved').snapshotId).toBe('approved-snapshot');
  });

  it('uses exact page metadata and content-derived fallback fingerprints', () => {
    const drawing = {
      pageCount: 1,
      pages: [],
      sourceSha256: 'ABCDEF',
    } as unknown as ConstructionPlan['drawings'][number];
    expect(getConstructionPlanDrawingPageFingerprint(drawing, 0))
      .toBe('source:abcdef:page:0');
    expect(getConstructionPlanDrawingPageFingerprint({
      ...drawing,
      sourceSha256: '123456',
    }, 0)).toBe('source:123456:page:0');
    expect(getConstructionPlanDrawingPageFingerprint({
      ...drawing,
      pages: [{ pageIndex: 0, pageFingerprint: 'exact-page' } as never],
    }, 0)).toBe('exact-page');
    expect(getConstructionPlanDrawingPageFingerprint({ ...drawing, pageCount: 2 }, 0))
      .toBeUndefined();
  });

  it('verifies SHA-256 and plan binding before returning envelope content', async () => {
    const snapshotPlan = buildConstructionPlanDraft('plan-1', {
      siteId: 'site-1',
      siteName: '테스트 현장',
      createdBy: 'author-1',
    }, now);
    const snapshotContent = {
      planId: snapshotPlan.id,
      snapshotSchemaVersion: 1 as const,
      siteId: snapshotPlan.siteId,
      title: '검토 제출본',
      tradeType: snapshotPlan.tradeType,
      documentNo: snapshotPlan.documentNo,
      documentDate: snapshotPlan.documentDate,
      revision: snapshotPlan.revision,
      templateId: snapshotPlan.templateId,
      templateVersion: snapshotPlan.templateVersion,
      rendererVersion: snapshotPlan.rendererVersion,
      schemaVersion: snapshotPlan.schemaVersion,
      projectSnapshot: snapshotPlan.projectSnapshot,
      organizationSnapshot: snapshotPlan.organizationSnapshot,
      sections: snapshotPlan.sections,
      sectionOrder: snapshotPlan.sectionOrder,
      drawings: snapshotPlan.drawings,
      drawingApplicability: snapshotPlan.drawingApplicability,
      engineeringValues: snapshotPlan.engineeringValues,
      equipmentPlan: snapshotPlan.equipmentPlan,
      riskAssessments: snapshotPlan.riskAssessments,
      createdBy: snapshotPlan.createdBy,
      createdAt: snapshotPlan.createdAt,
    };
    const envelope = JSON.stringify({
      snapshotSchemaVersion: 1,
      kind: 'review_submission',
      planId: 'plan-1',
      content: snapshotContent,
    });
    const bytes = Uint8Array.from(Buffer.from(envelope, 'utf8'));
    const contentHash = createHash('sha256').update(bytes).digest('hex');
    const digestBytes = Uint8Array.from(Buffer.from(contentHash, 'hex'));
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: { subtle: { digest: jest.fn().mockResolvedValue(digestBytes.buffer) } },
    });
    mockedGetBlob.mockResolvedValue({
      arrayBuffer: jest.fn().mockResolvedValue(
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      ),
      text: jest.fn().mockResolvedValue(envelope),
    } as never);
    const storagePath = `construction-plans/site-1/plan-1/snapshots/${contentHash}.json`;

    const pointer = {
      planId: 'plan-1',
      snapshotId: 'snapshot-1',
      storagePath,
      contentHash,
    };
    await expect(downloadVerifiedConstructionPlanSnapshotContent(pointer))
      .resolves.toEqual(expect.objectContaining({ planId: 'plan-1', title: '검토 제출본' }));
    await expect(getConstructionPlanSnapshotContent(pointer))
      .resolves.toEqual(expect.objectContaining({
        id: 'plan-1',
        title: '검토 제출본',
        status: 'approved_pending_issue',
      }));
    const materialized = materializeConstructionPlanSnapshot(
      { ...snapshotPlan, status: 'changes_requested', lockVersion: 9 },
      snapshotContent,
    );
    expect(materialized).toEqual(expect.objectContaining({
      id: 'plan-1',
      title: '검토 제출본',
      status: 'changes_requested',
      lockVersion: 9,
    }));
    expect(mockedRef).toHaveBeenCalledWith(expect.anything(), storagePath);
  });

  it('rejects a production envelope when its downloaded bytes do not match the pointer hash', async () => {
    mockSnapshotBlob(JSON.stringify(buildProductionSnapshotEnvelope()));
    const mismatchedHash = 'b'.repeat(64);

    await expect(downloadVerifiedConstructionPlanSnapshotContent(snapshotPointer(mismatchedHash)))
      .rejects.toThrow('construction-plan-review-snapshot-hash-mismatch');
  });

  it('rejects invalid JSON after the production snapshot hash is verified', async () => {
    const contentHash = mockSnapshotBlob('{"snapshotSchemaVersion":1');

    await expect(downloadVerifiedConstructionPlanSnapshotContent(snapshotPointer(contentHash)))
      .rejects.toThrow('construction-plan-review-snapshot-invalid-json');
  });

  it('rejects a production envelope whose planId does not match the pointer', async () => {
    const envelope = buildProductionSnapshotEnvelope();
    const contentHash = mockSnapshotBlob(JSON.stringify({
      ...envelope,
      planId: 'plan-2',
    }));

    await expect(downloadVerifiedConstructionPlanSnapshotContent(snapshotPointer(contentHash)))
      .rejects.toThrow('construction-plan-review-snapshot-plan-mismatch');
  });

  it('strictly rejects workflow control fields injected into production renderer content', async () => {
    const envelope = buildProductionSnapshotEnvelope();
    const contentHash = mockSnapshotBlob(JSON.stringify({
      ...envelope,
      content: {
        ...envelope.content,
        status: 'in_review',
      },
    }));

    await expect(downloadVerifiedConstructionPlanSnapshotContent(snapshotPointer(contentHash)))
      .rejects.toThrow('construction-plan-review-snapshot-invalid-content');
  });

  it('rejects a snapshot path outside the plan binding before download', async () => {
    await expect(getConstructionPlanSnapshotContent({
      planId: 'plan-1',
      snapshotId: 'snapshot-1',
      storagePath: `construction-plans/site-1/plan-2/snapshots/${snapshotHash}.json`,
      contentHash: snapshotHash,
    })).rejects.toThrow('construction-plan-review-snapshot-path-mismatch');
    expect(mockedGetBlob).not.toHaveBeenCalled();
  });

  it('requires current plan control data when a legacy raw snapshot lacks provenance', async () => {
    const currentPlan = buildConstructionPlanDraft('plan-1', {
      siteId: 'site-1',
      siteName: '레거시 현장',
      createdBy: 'author-1',
    }, now);
    const legacyContent = {
      snapshotSchemaVersion: 1,
      planId: currentPlan.id,
      siteId: currentPlan.siteId,
      title: currentPlan.title,
      tradeType: currentPlan.tradeType,
      documentNo: currentPlan.documentNo,
      documentDate: currentPlan.documentDate,
      revision: currentPlan.revision,
      templateId: currentPlan.templateId,
      templateVersion: currentPlan.templateVersion,
      rendererVersion: currentPlan.rendererVersion,
      schemaVersion: currentPlan.schemaVersion,
      projectSnapshot: currentPlan.projectSnapshot,
      organizationSnapshot: currentPlan.organizationSnapshot,
      sections: currentPlan.sections,
      sectionOrder: currentPlan.sectionOrder,
      drawings: currentPlan.drawings,
      drawingApplicability: currentPlan.drawingApplicability,
      engineeringValues: currentPlan.engineeringValues,
      equipmentPlan: currentPlan.equipmentPlan,
      riskAssessments: currentPlan.riskAssessments,
    };
    const serialized = JSON.stringify(legacyContent);
    const bytes = Uint8Array.from(Buffer.from(serialized, 'utf8'));
    const contentHash = createHash('sha256').update(bytes).digest('hex');
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: {
        subtle: {
          digest: jest.fn().mockResolvedValue(
            Uint8Array.from(Buffer.from(contentHash, 'hex')).buffer,
          ),
        },
      },
    });
    mockedGetBlob.mockResolvedValue({
      arrayBuffer: jest.fn().mockResolvedValue(
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      ),
      text: jest.fn().mockResolvedValue(serialized),
    } as never);
    const pointer = {
      planId: 'plan-1',
      snapshotId: 'legacy-approved',
      storagePath: `construction-plans/site-1/plan-1/snapshots/${contentHash}.json`,
      contentHash,
    };

    await expect(downloadVerifiedConstructionPlanSnapshotContent(pointer))
      .resolves.toEqual(expect.objectContaining({ planId: 'plan-1' }));
    await expect(getConstructionPlanSnapshotContent(pointer))
      .rejects.toThrow('construction-plan-review-snapshot-legacy-needs-current-plan');
    await expect(getConstructionPlanSnapshotContent(pointer, currentPlan))
      .resolves.toEqual(expect.objectContaining({
        id: 'plan-1',
        status: currentPlan.status,
        createdBy: currentPlan.createdBy,
      }));
  });
});
