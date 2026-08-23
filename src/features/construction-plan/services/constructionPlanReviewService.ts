import { httpsCallable } from 'firebase/functions';
import { getBlob, ref } from 'firebase/storage';
import { z } from 'zod';
import { functions, storage } from '../../../config/firebase';
import {
  ConstructionPlanReviewCommentSchema,
  ConstructionPlanReviewMessageSchema,
  ConstructionPlanReviewPackageSchema,
  ConstructionPlanSnapshotEnvelopeSchema,
  ConstructionPlanSnapshotPointerSchema,
  ConstructionPlanSnapshotRendererContentSchema,
  CreateConstructionPlanReviewCommentRequestSchema,
  ListConstructionPlanReviewCommentsRequestSchema,
  ListConstructionPlanReviewMessagesRequestSchema,
  ListConstructionPlanReviewPackagesRequestSchema,
  ReplyConstructionPlanReviewCommentRequestSchema,
  TransitionConstructionPlanReviewCommentRequestSchema,
  parseConstructionPlanWithLegacyDefaults,
  type ConstructionPlan,
  type ConstructionPlanReviewComment,
  type ConstructionPlanReviewMessage,
  type ConstructionPlanReviewPackage,
  type ConstructionPlanSnapshotPointer,
  type ConstructionPlanSnapshotRendererContent,
  type CreateConstructionPlanReviewCommentRequest,
  type ListConstructionPlanReviewCommentsRequest,
  type ListConstructionPlanReviewMessagesRequest,
  type ListConstructionPlanReviewPackagesRequest,
  type PlanDrawing,
  type ReplyConstructionPlanReviewCommentRequest,
  type TransitionConstructionPlanReviewCommentRequest,
} from '../types';

export type { ConstructionPlanSnapshotRendererContent };

export const CREATE_CONSTRUCTION_PLAN_REVIEW_COMMENT_CALLABLE =
  'createConstructionPlanReviewCommentServer';
export const REPLY_CONSTRUCTION_PLAN_REVIEW_COMMENT_CALLABLE =
  'replyConstructionPlanReviewCommentServer';
export const LIST_CONSTRUCTION_PLAN_REVIEW_COMMENTS_CALLABLE =
  'listConstructionPlanReviewCommentsServer';
export const LIST_CONSTRUCTION_PLAN_REVIEW_MESSAGES_CALLABLE =
  'listConstructionPlanReviewMessagesServer';
export const TRANSITION_CONSTRUCTION_PLAN_REVIEW_COMMENT_CALLABLE =
  'transitionConstructionPlanReviewCommentServer';
export const LIST_CONSTRUCTION_PLAN_REVIEW_PACKAGES_CALLABLE =
  'listConstructionPlanReviewPackagesServer';

const ReviewCommentResponseSchema = z.object({
  comment: ConstructionPlanReviewCommentSchema,
});

const ReviewMessageResponseSchema = z.object({
  message: ConstructionPlanReviewMessageSchema,
});

const ReviewCommentListResponseSchema = z.object({
  comments: z.array(ConstructionPlanReviewCommentSchema),
  permissions: z.object({
    canCreateComment: z.boolean(),
  }),
});

const ReviewMessageListResponseSchema = z.object({
  messages: z.array(ConstructionPlanReviewMessageSchema),
});

const ReviewPackageListResponseSchema = z.object({
  packages: z.array(ConstructionPlanReviewPackageSchema),
});
export type ListConstructionPlanReviewCommentsResult = z.infer<
  typeof ReviewCommentListResponseSchema
>;

const invokeReviewCallable = async <TRequest, TSchema extends z.ZodTypeAny>(
  callableName: string,
  request: TRequest,
  responseSchema: TSchema,
): Promise<z.output<TSchema>> => {
  const callable = httpsCallable<TRequest, unknown>(functions, callableName);
  return responseSchema.parse((await callable(request)).data);
};

export const createConstructionPlanReviewCommentServer = async (
  rawRequest: CreateConstructionPlanReviewCommentRequest,
): Promise<ConstructionPlanReviewComment> => {
  const request = CreateConstructionPlanReviewCommentRequestSchema.parse(rawRequest);
  const response = await invokeReviewCallable(
    CREATE_CONSTRUCTION_PLAN_REVIEW_COMMENT_CALLABLE,
    request,
    ReviewCommentResponseSchema,
  );
  return response.comment;
};

export const replyConstructionPlanReviewCommentServer = async (
  rawRequest: ReplyConstructionPlanReviewCommentRequest,
): Promise<ConstructionPlanReviewMessage> => {
  const request = ReplyConstructionPlanReviewCommentRequestSchema.parse(rawRequest);
  const response = await invokeReviewCallable(
    REPLY_CONSTRUCTION_PLAN_REVIEW_COMMENT_CALLABLE,
    request,
    ReviewMessageResponseSchema,
  );
  return response.message;
};

export const listConstructionPlanReviewCommentsServer = async (
  rawRequest: ListConstructionPlanReviewCommentsRequest,
): Promise<ConstructionPlanReviewComment[]> => {
  return (await listConstructionPlanReviewCommentsWithPermissionsServer(rawRequest)).comments;
};

export const listConstructionPlanReviewCommentsWithPermissionsServer = async (
  rawRequest: ListConstructionPlanReviewCommentsRequest,
): Promise<ListConstructionPlanReviewCommentsResult> => {
  const request = ListConstructionPlanReviewCommentsRequestSchema.parse(rawRequest);
  return invokeReviewCallable(
    LIST_CONSTRUCTION_PLAN_REVIEW_COMMENTS_CALLABLE,
    request,
    ReviewCommentListResponseSchema,
  );
};

export const listConstructionPlanReviewMessagesServer = async (
  rawRequest: ListConstructionPlanReviewMessagesRequest,
): Promise<ConstructionPlanReviewMessage[]> => {
  const request = ListConstructionPlanReviewMessagesRequestSchema.parse(rawRequest);
  const response = await invokeReviewCallable(
    LIST_CONSTRUCTION_PLAN_REVIEW_MESSAGES_CALLABLE,
    request,
    ReviewMessageListResponseSchema,
  );
  return response.messages;
};

export const transitionConstructionPlanReviewCommentServer = async (
  rawRequest: TransitionConstructionPlanReviewCommentRequest,
): Promise<ConstructionPlanReviewComment> => {
  const request = TransitionConstructionPlanReviewCommentRequestSchema.parse(rawRequest);
  const response = await invokeReviewCallable(
    TRANSITION_CONSTRUCTION_PLAN_REVIEW_COMMENT_CALLABLE,
    request,
    ReviewCommentResponseSchema,
  );
  return response.comment;
};

export const listConstructionPlanReviewPackagesServer = async (
  rawRequest: ListConstructionPlanReviewPackagesRequest,
): Promise<ConstructionPlanReviewPackage[]> => {
  const request = ListConstructionPlanReviewPackagesRequestSchema.parse(rawRequest);
  const response = await invokeReviewCallable(
    LIST_CONSTRUCTION_PLAN_REVIEW_PACKAGES_CALLABLE,
    request,
    ReviewPackageListResponseSchema,
  );
  return response.packages;
};

export type ConstructionPlanSnapshotSource = 'active_review' | 'approved';

export const getConstructionPlanDrawingPageFingerprint = (
  drawing: PlanDrawing,
  pageIndex: number,
): string | undefined => {
  if (!Number.isInteger(pageIndex) || pageIndex < 0) return undefined;
  const page = drawing.pages.find((candidate) => candidate.pageIndex === pageIndex);
  const pageFingerprint = page?.pageFingerprint.trim();
  if (pageFingerprint) return pageFingerprint;
  if (drawing.pages.length === 0 && drawing.pageCount === 1 && pageIndex === 0) {
    const sourceSha256 = drawing.sourceSha256.trim().toLowerCase();
    return sourceSha256 ? `source:${sourceSha256}:page:0` : undefined;
  }
  return undefined;
};

export const getConstructionPlanSnapshotPointer = (
  plan: ConstructionPlan,
  source: ConstructionPlanSnapshotSource,
): ConstructionPlanSnapshotPointer => {
  if (source === 'active_review') {
    return ConstructionPlanSnapshotPointerSchema.parse({
      planId: plan.id,
      snapshotId: plan.activeReviewSnapshotId,
      storagePath: plan.activeReviewSnapshotStoragePath,
      contentHash: plan.activeReviewSnapshotHash,
    });
  }
  return ConstructionPlanSnapshotPointerSchema.parse({
    planId: plan.id,
    snapshotId: plan.approvedSnapshotId,
    storagePath: plan.approvedSnapshotStoragePath,
    contentHash: plan.approvedSnapshotHash,
  });
};

const assertCanonicalSnapshotPath = (pointer: ConstructionPlanSnapshotPointer): void => {
  const segments = pointer.storagePath.replace(/\\/g, '/').split('/').filter(Boolean);
  const expectedFileName = `${pointer.contentHash}.json`;
  if (segments.length < 5
    || segments[0] !== 'construction-plans'
    || segments[2] !== pointer.planId
    || segments[3] !== 'snapshots'
    || segments[segments.length - 1] !== expectedFileName) {
    throw new Error('construction-plan-review-snapshot-path-mismatch');
  }
};

const sha256Hex = async (bytes: ArrayBuffer): Promise<string> => {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('construction-plan-review-snapshot-crypto-unavailable');
  const digest = await subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Downloads an immutable canonical snapshot, verifies its content-addressed
 * path and SHA-256 before parsing, then returns the review envelope content.
 * Raw approved snapshots from the pre-envelope release pipeline remain
 * readable so existing approvals do not lose their audit view.
 */
export const downloadVerifiedConstructionPlanSnapshotContent = async (
  rawPointer: ConstructionPlanSnapshotPointer,
): Promise<ConstructionPlanSnapshotRendererContent> => {
  const pointer = ConstructionPlanSnapshotPointerSchema.parse(rawPointer);
  assertCanonicalSnapshotPath(pointer);

  const blob = await getBlob(ref(storage, pointer.storagePath));
  const bytes = await blob.arrayBuffer();
  if (await sha256Hex(bytes) !== pointer.contentHash) {
    throw new Error('construction-plan-review-snapshot-hash-mismatch');
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(await blob.text());
  } catch {
    throw new Error('construction-plan-review-snapshot-invalid-json');
  }

  const envelope = ConstructionPlanSnapshotEnvelopeSchema.safeParse(decoded);
  const content = envelope.success ? envelope.data.content : decoded;
  if (envelope.success && envelope.data.planId !== pointer.planId) {
    throw new Error('construction-plan-review-snapshot-plan-mismatch');
  }
  if (!isRecord(content)
    || content.planId !== pointer.planId) {
    throw new Error('construction-plan-review-snapshot-plan-mismatch');
  }
  try {
    return ConstructionPlanSnapshotRendererContentSchema.parse(content);
  } catch {
    throw new Error('construction-plan-review-snapshot-invalid-content');
  }
};

export const materializeConstructionPlanSnapshot = (
  currentPlan: ConstructionPlan,
  rawVerifiedContent: ConstructionPlanSnapshotRendererContent,
): ConstructionPlan => {
  const verifiedContent = ConstructionPlanSnapshotRendererContentSchema.parse(rawVerifiedContent);
  if (verifiedContent.planId !== currentPlan.id) {
    throw new Error('construction-plan-review-snapshot-plan-mismatch');
  }
  const {
    planId: _planId,
    createdBy,
    createdByName,
    createdAt,
    ...rendererFields
  } = verifiedContent;
  return parseConstructionPlanWithLegacyDefaults({
    ...currentPlan,
    ...rendererFields,
    id: currentPlan.id,
    ...(createdBy ? { createdBy } : {}),
    ...(createdByName ? { createdByName } : {}),
    ...(createdAt ? { createdAt } : {}),
  });
};

export const getConstructionPlanSnapshotContent = async (
  rawPointer: ConstructionPlanSnapshotPointer,
  currentPlan?: ConstructionPlan,
): Promise<ConstructionPlan> => {
  const content = await downloadVerifiedConstructionPlanSnapshotContent(rawPointer);
  if (currentPlan) return materializeConstructionPlanSnapshot(currentPlan, content);
  const createdBy = content.createdBy?.trim();
  const createdAt = content.createdAt;
  if (!createdBy || !createdAt) {
    throw new Error('construction-plan-review-snapshot-legacy-needs-current-plan');
  }
  try {
    // Renderer adapter only: these deterministic values make verified release
    // content consumable as ConstructionPlan. They are not audit/control
    // evidence; workflow status, locks, participants and readiness must still
    // be read from trusted Firestore metadata.
    return parseConstructionPlanWithLegacyDefaults({
      ...content,
      id: content.planId,
      status: 'approved_pending_issue',
      lockVersion: 0,
      participants: {
        authorIds: [createdBy],
        reviewerIds: [],
        approverIds: [],
      },
      releaseReadiness: {
        requiredReviewsComplete: false,
        unresolvedRequiredComments: 0,
        snapshotHashMatches: false,
        pdfVisualCheckPassed: false,
        pdfTextCheckPassed: false,
        drawingLegendMonochromeDistinct: true,
        latestTemplateAvailable: false,
        latestDrawingRevisionAvailable: false,
        workerRefreshAvailable: false,
        recordAppendixAvailable: false,
      },
      validationSummary: { errors: 0, warnings: 0, checkedAt: createdAt },
      updatedBy: createdBy,
      updatedAt: createdAt,
    });
  } catch {
    throw new Error('construction-plan-review-snapshot-invalid-content');
  }
};

export const constructionPlanReviewService = {
  createComment: createConstructionPlanReviewCommentServer,
  replyComment: replyConstructionPlanReviewCommentServer,
  listComments: listConstructionPlanReviewCommentsServer,
  listCommentsWithPermissions: listConstructionPlanReviewCommentsWithPermissionsServer,
  listMessages: listConstructionPlanReviewMessagesServer,
  transitionComment: transitionConstructionPlanReviewCommentServer,
  listPackages: listConstructionPlanReviewPackagesServer,
  getDrawingPageFingerprint: getConstructionPlanDrawingPageFingerprint,
  getSnapshotPointer: getConstructionPlanSnapshotPointer,
  downloadVerifiedSnapshotContent: downloadVerifiedConstructionPlanSnapshotContent,
  materializeSnapshot: materializeConstructionPlanSnapshot,
  getSnapshotContent: getConstructionPlanSnapshotContent,
};

export default constructionPlanReviewService;
