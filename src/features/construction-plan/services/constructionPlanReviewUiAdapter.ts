import type {
  ConstructionPlan,
  ConstructionPlanReviewAnchor as DomainReviewAnchor,
  ConstructionPlanReviewComment,
  ConstructionPlanReviewCommentVisibility,
  ConstructionPlanReviewMessage,
  ConstructionPlanReviewPackage,
  PlanDrawing,
} from '../types';
import { getConstructionPlan } from './constructionPlanService';
import { createConstructionPlanReviewMutationRequestId } from './constructionPlanReviewMutationId';
import {
  createConstructionPlanReviewCommentServer,
  getConstructionPlanDrawingPageFingerprint,
  listConstructionPlanReviewCommentsWithPermissionsServer,
  listConstructionPlanReviewMessagesServer,
  listConstructionPlanReviewPackagesServer,
  replyConstructionPlanReviewCommentServer,
  transitionConstructionPlanReviewCommentServer,
} from './constructionPlanReviewService';

export type ConstructionPlanReviewAnchorKind = 'plan' | 'section' | 'field' | 'drawing';
export type ConstructionPlanReviewCommentStatus = 'open' | 'addressed' | 'resolved';
export type { ConstructionPlanReviewCommentVisibility };

export type ConstructionPlanReviewAnchor = {
  kind: ConstructionPlanReviewAnchorKind;
  label: string;
  sectionId?: string;
  entityType?: 'plan' | 'section' | 'engineering_value' | 'equipment_item' | 'risk_assessment' | 'organization_assignment';
  entityId?: string;
  jsonPointer?: string;
  fieldPath?: string;
  drawingId?: string;
  annotationId?: string;
  pageIndex?: number;
  pageFingerprint?: string;
  x?: number;
  y?: number;
};

export type ConstructionPlanReviewCommentView = {
  id: string;
  planId: string;
  reviewPackageId: string;
  reviewSnapshotId: string;
  version: number;
  body: string;
  status: ConstructionPlanReviewCommentStatus;
  authorId: string;
  authorName: string;
  createdAt: string;
  anchor: ConstructionPlanReviewAnchor;
  visibility: ConstructionPlanReviewCommentVisibility;
  required: boolean;
  anchorStatus: 'active' | 'carried' | 'stale' | 'orphaned';
  originReviewPackageId?: string;
  originReviewRound?: number;
  currentAnchorMapping?: {
    status: 'unchanged' | 'moved' | 'stale' | 'orphaned';
    anchor?: ConstructionPlanReviewAnchor;
  };
  carriedFromCommentId?: string;
  replyCount?: number;
  authorReplyCount?: number;
  permissions?: {
    canReply?: boolean;
    canMarkAddressed?: boolean;
    canResolve?: boolean;
    canReopen?: boolean;
  };
  resolvedAt?: string;
  resolvedByName?: string;
};

export type ConstructionPlanReviewMessageView = {
  id: string;
  commentId: string;
  body: string;
  authorId: string;
  authorName: string;
  createdAt: string;
};

export type ConstructionPlanSnapshotChangeView = {
  id: string;
  kind: 'section' | 'field' | 'text' | 'drawing' | 'annotation';
  changeType?: 'added' | 'deleted' | 'changed';
  label: string;
  path?: string;
  sectionId?: string;
  sectionLabel?: string;
  pageNumbers?: number[];
  drawingId?: string;
  drawingLabel?: string;
  annotationId?: string;
  pageIndex?: number;
  pageId?: string;
  changedParts?: string[];
  details?: string[];
  before?: string;
  after?: string;
  beforeHash?: string;
  afterHash?: string;
  textSegments?: Array<{ kind: 'equal' | 'added' | 'removed'; text: string }>;
  valueTruncated?: boolean;
};

export type ConstructionPlanSnapshotComparisonView = {
  reviewPackageId: string;
  reviewPackageLabel: string;
  reviewPackageHash: string;
  reviewRound: number;
  reviewPackageLockVersion?: number;
  reviewPackageCreatedAt?: string;
  readOnly?: boolean;
  summaryHash?: string;
  baselineContentHash?: string;
  currentContentHash?: string;
  baseline: {
    kind: 'previous_submission' | 'prior_issued' | 'empty';
    id?: string;
    label: string;
    hash?: string;
  };
  changedSectionCount: number;
  changedFieldCount: number;
  changedDrawingCount: number;
  changedAnnotationCount?: number;
  changes: ConstructionPlanSnapshotChangeView[];
};

export type ConstructionPlanReviewWorkspaceView = {
  available: boolean;
  unavailableReason?: string;
  comments: ConstructionPlanReviewCommentView[];
  comparison?: ConstructionPlanSnapshotComparisonView;
  permissions?: { canCreateComment?: boolean };
};

export interface ConstructionPlanReviewUiAdapter {
  loadWorkspace(planId: string, options?: { reviewPackageId?: string }): Promise<ConstructionPlanReviewWorkspaceView>;
  setCommentResolved(input: { planId: string; commentId: string; expectedVersion: number; resolved: boolean; reason?: string }): Promise<ConstructionPlanReviewCommentView>;
  replyComment(input: { planId: string; commentId: string; body: string; requestId?: string }): Promise<ConstructionPlanReviewCommentView>;
  markCommentAddressed(input: { planId: string; commentId: string; expectedVersion: number }): Promise<ConstructionPlanReviewCommentView>;
  createComment(input: {
    planId: string;
    reviewPackageId?: string;
    body: string;
    required: boolean;
    visibility: ConstructionPlanReviewCommentVisibility;
    anchor: ConstructionPlanReviewAnchor;
    requestId?: string;
  }): Promise<ConstructionPlanReviewCommentView>;
  listMessages(input: { planId: string; commentId: string }): Promise<ConstructionPlanReviewMessageView[]>;
}

/** Resolves a stable review anchor to the editor section without relying on array positions. */
export const resolveConstructionPlanReviewAnchorSectionId = (
  plan: ConstructionPlan,
  anchor: ConstructionPlanReviewAnchor,
): string | undefined => {
  if (anchor.sectionId && plan.sections.some((section) => section.id === anchor.sectionId)) return anchor.sectionId;
  if (anchor.kind === 'drawing' && anchor.drawingId) {
    return plan.sections.find((section) => section.kind === 'drawing-page' && section.content.drawingId === anchor.drawingId)?.id;
  }
  if (anchor.kind !== 'field') return undefined;
  if (anchor.entityType === 'section' && anchor.entityId
      && plan.sections.some((section) => section.id === anchor.entityId || section.key === anchor.entityId)) {
    return plan.sections.find((section) => section.id === anchor.entityId || section.key === anchor.entityId)?.id;
  }
  const preferredKeys: Partial<Record<NonNullable<ConstructionPlanReviewAnchor['entityType']>, string[]>> = {
    engineering_value: ['structural-control', 'member-specifications'],
    equipment_item: ['equipment-plan', 'lifting-plan'],
    risk_assessment: ['risk-assessment'],
    organization_assignment: ['organization'],
  };
  const keys = anchor.entityType ? preferredKeys[anchor.entityType] : undefined;
  return keys?.flatMap((key) => plan.sections.filter((section) => section.key === key || section.id === key))[0]?.id;
};

export const resolveConstructionPlanReviewDrawingPage = (
  drawing?: PlanDrawing,
): { pageIndex: number; pageFingerprint: string } | undefined => {
  const firstPage = drawing?.pages[0];
  if (firstPage) return { pageIndex: firstPage.pageIndex, pageFingerprint: firstPage.pageFingerprint };
  if (drawing) {
    const pageFingerprint = getConstructionPlanDrawingPageFingerprint(drawing, 0);
    if (pageFingerprint) return { pageIndex: 0, pageFingerprint };
  }
  return undefined;
};

const stableRequestId = (operation: string, payload: unknown): string => {
  const source = JSON.stringify(payload);
  const hash = (seed: number): string => {
    let value = seed >>> 0;
    for (let index = 0; index < source.length; index += 1) {
      value ^= source.charCodeAt(index);
      value = Math.imul(value, 16_777_619) >>> 0;
    }
    return value.toString(36);
  };
  return `cp-review-${operation}-${hash(2_166_136_261)}${hash(1_315_423_911)}-${source.length.toString(36)}`.slice(0, 128);
};

const mutationRequestId = (
  operation: 'create' | 'reply',
  requestId?: string,
): string => requestId?.trim() || createConstructionPlanReviewMutationRequestId(operation);

const sectionLabel = (plan: ConstructionPlan, sectionId: string): string =>
  plan.sections.find((section) => section.id === sectionId)?.title || sectionId;

const drawingLabel = (plan: ConstructionPlan, drawingId: string): string => {
  const drawing = plan.drawings.find((candidate) => candidate.id === drawingId);
  return drawing?.title || drawing?.drawingNo || drawingId;
};

const mapAnchor = (anchor: DomainReviewAnchor, plan: ConstructionPlan): ConstructionPlanReviewAnchor => {
  if (anchor.kind === 'plan') return { kind: 'plan', label: '계획서 전체' };
  if (anchor.kind === 'section') {
    return { kind: 'section', sectionId: anchor.sectionId, label: sectionLabel(plan, anchor.sectionId) };
  }
  if (anchor.kind === 'field') {
    return {
      kind: 'field',
      entityType: anchor.entityType,
      entityId: anchor.entityId,
      jsonPointer: anchor.jsonPointer,
      fieldPath: anchor.jsonPointer,
      label: `${anchor.entityType} · ${anchor.jsonPointer}`,
    };
  }
  return {
    kind: 'drawing',
    drawingId: anchor.drawingId,
    annotationId: anchor.annotationId,
    pageIndex: anchor.pageIndex,
    pageFingerprint: anchor.pageFingerprint,
    x: anchor.x,
    y: anchor.y,
    label: `${drawingLabel(plan, anchor.drawingId)} · ${anchor.pageIndex + 1}쪽`,
  };
};

const toDomainAnchor = (anchor: ConstructionPlanReviewAnchor): DomainReviewAnchor => {
  if (anchor.kind === 'plan') return { kind: 'plan' };
  if (anchor.kind === 'section' && anchor.sectionId) return { kind: 'section', sectionId: anchor.sectionId };
  if (anchor.kind === 'field' && anchor.entityType && anchor.entityId && (anchor.jsonPointer || anchor.fieldPath)) {
    return { kind: 'field', entityType: anchor.entityType, entityId: anchor.entityId, jsonPointer: anchor.jsonPointer || anchor.fieldPath! };
  }
  if (anchor.kind === 'drawing' && anchor.drawingId && anchor.pageIndex !== undefined && anchor.pageFingerprint) {
    return {
      kind: 'drawing',
      drawingId: anchor.drawingId,
      pageIndex: anchor.pageIndex,
      pageFingerprint: anchor.pageFingerprint,
      ...(anchor.annotationId ? { annotationId: anchor.annotationId } : {}),
      ...(anchor.x !== undefined && anchor.y !== undefined ? { x: anchor.x, y: anchor.y } : {}),
    };
  }
  throw new Error('construction-plan-review-anchor-incomplete');
};

const packageRound = (packages: readonly ConstructionPlanReviewPackage[], packageId: string): number | undefined =>
  packages.find((item) => item.id === packageId)?.round;

const mapComment = (
  comment: ConstructionPlanReviewComment,
  plan: ConstructionPlan,
  packages: readonly ConstructionPlanReviewPackage[],
  selectedPackage: ConstructionPlanReviewPackage,
): ConstructionPlanReviewCommentView => {
  const mappedAnchor = mapAnchor(comment.anchor, plan);
  const isActivePackage = selectedPackage.id === plan.activeReviewPackageId;
  return {
    id: comment.id,
    planId: comment.planId,
    reviewPackageId: comment.reviewPackageId,
    reviewSnapshotId: comment.reviewSnapshotId,
    version: comment.version,
    body: comment.body,
    status: comment.status,
    authorId: comment.createdBy,
    authorName: comment.createdByName || '검토자',
    createdAt: comment.createdAt,
    anchor: mappedAnchor,
    visibility: comment.visibility,
    required: comment.required,
    anchorStatus: comment.anchorStatus,
    originReviewPackageId: comment.reviewPackageId,
    originReviewRound: packageRound(packages, comment.reviewPackageId),
    currentAnchorMapping: comment.anchorStatus === 'active' || comment.anchorStatus === 'carried'
      ? { status: 'unchanged', anchor: mappedAnchor }
      : { status: comment.anchorStatus },
    replyCount: comment.replyCount,
    authorReplyCount: comment.authorReplyCount,
    permissions: {
      canReply: isActivePackage && (comment.permissions?.canReply ?? false),
      canMarkAddressed: isActivePackage && (comment.permissions?.canAddress ?? false),
      canResolve: isActivePackage && (comment.permissions?.canResolve ?? false),
      canReopen: isActivePackage && (comment.permissions?.canReopen ?? false),
    },
    resolvedAt: comment.resolvedAt,
  };
};

const mapMessage = (message: ConstructionPlanReviewMessage): ConstructionPlanReviewMessageView => ({
  id: message.id,
  commentId: message.commentId,
  body: message.body,
  authorId: message.createdBy,
  authorName: message.createdByName || '참여자',
  createdAt: message.createdAt,
});

const selectPackage = (plan: ConstructionPlan, packages: readonly ConstructionPlanReviewPackage[], requestedId?: string): ConstructionPlanReviewPackage | undefined => {
  if (requestedId) return packages.find((item) => item.id === requestedId || item.reviewSnapshotId === requestedId);
  return packages.find((item) => item.id === plan.activeReviewPackageId)
    ?? packages.find((item) => item.reviewSnapshotId === plan.activeReviewSnapshotId)
    ?? [...packages].sort((left, right) => right.round - left.round)[0];
};

const comparisonFromPackage = (plan: ConstructionPlan, selected: ConstructionPlanReviewPackage, packages: readonly ConstructionPlanReviewPackage[]): ConstructionPlanSnapshotComparisonView => {
  const previous = selected.previousPackageId ? packages.find((item) => item.id === selected.previousPackageId) : undefined;
  const summary = selected.diffSummary;
  const baselineKind = previous ? 'previous_submission' : summary.baselineKind;
  const baseline: ConstructionPlanSnapshotComparisonView['baseline'] = previous
    ? { kind: 'previous_submission', id: previous.id, label: `직전 제출본 · Round ${previous.round}`, hash: previous.reviewSnapshotHash }
    : baselineKind === 'previous_submission'
      ? { kind: 'previous_submission', id: selected.previousPackageId, label: '직전 제출본', hash: summary.baselineContentHash }
      : baselineKind === 'prior_issued'
        ? { kind: 'prior_issued', label: `직전 발행본 · REV.${String(plan.sourceRevisionNo ?? Math.max(0, plan.revision - 1)).padStart(2, '0')}`, hash: summary.baselineContentHash || plan.sourceSnapshotHash }
        : baselineKind === 'empty'
          ? { kind: 'empty', label: '최초 제출 · 빈 기준', hash: summary.baselineContentHash }
          : plan.sourceSnapshotHash
            ? { kind: 'prior_issued', label: `직전 발행본 · REV.${String(plan.sourceRevisionNo ?? Math.max(0, plan.revision - 1)).padStart(2, '0')}`, hash: plan.sourceSnapshotHash }
            : { kind: 'empty', label: '최초 제출 · 빈 기준' };
  const richChanges: ConstructionPlanSnapshotChangeView[] = [
    ...summary.textChanges.map((change) => ({
      id: change.id,
      kind: 'text' as const,
      changeType: change.changeType,
      label: change.label,
      path: change.path,
      sectionId: change.sectionId,
      sectionLabel: change.sectionLabel,
      pageNumbers: change.pageNumbers,
      before: change.before,
      after: change.after,
      beforeHash: change.beforeHash,
      afterHash: change.afterHash,
      textSegments: change.segments,
      valueTruncated: change.valueTruncated,
    })),
    ...summary.fieldChanges.map((change) => ({
      id: change.id,
      kind: change.entityKind,
      changeType: change.changeType,
      label: change.label,
      path: change.path,
      sectionId: change.sectionId,
      sectionLabel: change.sectionLabel,
      pageNumbers: change.pageNumbers,
      before: change.before,
      after: change.after,
      beforeHash: change.beforeHash,
      afterHash: change.afterHash,
      valueTruncated: change.valueTruncated,
    })),
    ...summary.drawingChanges.map((change) => ({
      id: change.id,
      kind: 'drawing' as const,
      changeType: change.changeType,
      label: change.drawingLabel,
      drawingId: change.drawingId,
      drawingLabel: change.drawingLabel,
      sectionId: plan.sections.find((section) => section.kind === 'drawing-page' && section.content.drawingId === change.drawingId)?.id,
      pageNumbers: change.pageNumbers,
      changedParts: change.changedFields,
      before: change.beforeSummary,
      after: change.afterSummary,
      beforeHash: change.beforeHash,
      afterHash: change.afterHash,
    })),
    ...summary.annotationChanges.map((change) => ({
      id: change.id,
      kind: 'annotation' as const,
      changeType: change.changeType,
      label: change.annotationLabel,
      drawingId: change.drawingId,
      drawingLabel: change.drawingLabel,
      annotationId: change.annotationId,
      sectionId: plan.sections.find((section) => section.kind === 'drawing-page' && section.content.drawingId === change.drawingId)?.id,
      pageNumbers: [change.pageIndex + 1],
      pageIndex: change.pageIndex,
      pageId: change.pageId,
      changedParts: change.changedParts,
      before: [change.geometryBefore, change.styleBefore, change.metadataBefore].filter(Boolean).join(' · ') || undefined,
      after: [change.geometryAfter, change.styleAfter, change.metadataAfter].filter(Boolean).join(' · ') || undefined,
      details: change.changedParts,
      beforeHash: change.beforeHash,
      afterHash: change.afterHash,
    })),
  ];
  const legacyChanges: ConstructionPlanSnapshotChangeView[] = [
    ...summary.changedTopLevelFields.map((field) => ({ id: `field-${field}`, kind: 'field' as const, label: field })),
    ...summary.changedSectionIds.map((sectionId) => ({ id: `section-${sectionId}`, kind: 'section' as const, label: sectionLabel(plan, sectionId), sectionId })),
    ...summary.changedDrawingIds.map((drawingId) => ({ id: `drawing-${drawingId}`, kind: 'drawing' as const, label: drawingLabel(plan, drawingId), drawingId })),
    ...summary.addedDrawingIds.map((drawingId) => ({ id: `drawing-added-${drawingId}`, kind: 'drawing' as const, changeType: 'added' as const, label: `${drawingLabel(plan, drawingId)} 추가`, drawingId })),
    ...summary.removedDrawingIds.map((drawingId) => ({ id: `drawing-removed-${drawingId}`, kind: 'drawing' as const, changeType: 'deleted' as const, label: `${drawingId} 삭제`, drawingId })),
  ];
  const changes = summary.summaryHash ? richChanges : legacyChanges;
  return {
    reviewPackageId: selected.id,
    reviewPackageLabel: `Round ${selected.round} 제출본`,
    reviewPackageHash: selected.reviewSnapshotHash,
    reviewRound: selected.round,
    reviewPackageLockVersion: selected.reviewSnapshotLockVersion,
    reviewPackageCreatedAt: selected.createdAt,
    readOnly: selected.id !== plan.activeReviewPackageId,
    summaryHash: summary.summaryHash,
    baselineContentHash: summary.baselineContentHash,
    currentContentHash: summary.currentContentHash,
    baseline,
    changedSectionCount: summary.changedSectionIds.length,
    changedFieldCount: summary.summaryHash
      ? summary.textChanges.length + summary.fieldChanges.length
      : summary.changedTopLevelFields.length,
    changedDrawingCount: new Set([...summary.changedDrawingIds, ...summary.addedDrawingIds, ...summary.removedDrawingIds]).size,
    changedAnnotationCount: summary.annotationChanges.length,
    changes,
  };
};

const loadMutationContext = async (planId: string) => {
  const [plan, packages] = await Promise.all([getConstructionPlan(planId), listConstructionPlanReviewPackagesServer({ planId })]);
  if (!plan) throw new Error('construction-plan-review-plan-not-found');
  const selected = selectPackage(plan, packages);
  if (!selected) throw new Error('construction-plan-review-package-not-found');
  return { plan, packages, selected };
};

const reloadComment = async (planId: string, commentId: string): Promise<ConstructionPlanReviewCommentView> => {
  const [{ plan, packages, selected }, response] = await Promise.all([loadMutationContext(planId), listConstructionPlanReviewCommentsWithPermissionsServer({ planId })]);
  const comments = response.comments;
  const comment = comments.find((item) => item.id === commentId);
  if (!comment) throw new Error('construction-plan-review-comment-not-found');
  return mapComment(comment, plan, packages, selected);
};

export const constructionPlanReviewUiAdapter: ConstructionPlanReviewUiAdapter = {
  async loadWorkspace(planId, options) {
    const [plan, packages] = await Promise.all([getConstructionPlan(planId), listConstructionPlanReviewPackagesServer({ planId })]);
    if (!plan) throw new Error('construction-plan-review-plan-not-found');
    const selected = selectPackage(plan, packages, options?.reviewPackageId);
    if (!selected) {
      return {
        available: false,
        unavailableReason: options?.reviewPackageId
          ? '요청한 검토 패키지 또는 스냅샷을 찾을 수 없습니다. 목록에서 다시 열어주세요.'
          : '아직 고정된 검토 제출본이 없습니다. 검토 요청 후 댓글과 변경요약을 확인할 수 있습니다.',
        comments: [],
      };
    }
    const response = await listConstructionPlanReviewCommentsWithPermissionsServer({ planId });
    const visibleComments = response.comments.filter((comment) => {
      const originRound = packageRound(packages, comment.reviewPackageId);
      return originRound !== undefined && originRound <= selected.round;
    });
    return {
      available: true,
      comments: visibleComments.map((comment) => mapComment(comment, plan, packages, selected)),
      comparison: comparisonFromPackage(plan, selected, packages),
      permissions: {
        canCreateComment: Boolean(
          response.permissions.canCreateComment
          && selected.id === plan.activeReviewPackageId,
        ),
      },
    };
  },
  async setCommentResolved({ planId, commentId, expectedVersion, resolved, reason }) {
    const context = await loadMutationContext(planId);
    const mutationPayload = { planId, commentId, expectedVersion, resolved, reason: reason?.trim() };
    const updated = await transitionConstructionPlanReviewCommentServer({
      requestId: stableRequestId(resolved ? 'resolve' : 'reopen', mutationPayload),
      planId,
      commentId,
      action: resolved ? 'resolve' : 'reopen',
      expectedVersion,
      ...(!resolved && reason?.trim() ? { reason: reason.trim() } : {}),
    });
    return mapComment(updated, context.plan, context.packages, context.selected);
  },
  async replyComment({ planId, commentId, body, requestId }) {
    await replyConstructionPlanReviewCommentServer({ requestId: mutationRequestId('reply', requestId), planId, commentId, body });
    return reloadComment(planId, commentId);
  },
  async markCommentAddressed({ planId, commentId, expectedVersion }) {
    const context = await loadMutationContext(planId);
    const updated = await transitionConstructionPlanReviewCommentServer({ requestId: stableRequestId('address', { planId, commentId, expectedVersion }), planId, commentId, action: 'address', expectedVersion });
    return mapComment(updated, context.plan, context.packages, context.selected);
  },
  async createComment({ planId, reviewPackageId, body, required, visibility, anchor, requestId }) {
    const context = await loadMutationContext(planId);
    const domainAnchor = toDomainAnchor(anchor);
    const created = await createConstructionPlanReviewCommentServer({
      requestId: mutationRequestId('create', requestId),
      planId,
      reviewPackageId,
      body,
      required,
      visibility,
      anchor: domainAnchor,
    });
    return mapComment(created, context.plan, context.packages, context.selected);
  },
  async listMessages({ planId, commentId }) {
    return (await listConstructionPlanReviewMessagesServer({ planId, commentId })).map(mapMessage);
  },
};
