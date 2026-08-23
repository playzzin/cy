import {
  ConstructionPlanReviewAnchorSchema,
  ConstructionPlanReviewCommentSchema,
  CreateConstructionPlanReviewCommentRequestSchema,
} from './review';
import { ConstructionPlanReviewCommentSummarySchema } from './constructionPlan';

describe('construction plan review contracts', () => {
  it('accepts stable entity field anchors and rejects mutable fieldPath anchors', () => {
    expect(ConstructionPlanReviewAnchorSchema.parse({
      kind: 'field',
      entityType: 'engineering_value',
      entityId: 'spacing-x',
      jsonPointer: '/value',
    })).toEqual({
      kind: 'field',
      entityType: 'engineering_value',
      entityId: 'spacing-x',
      jsonPointer: '/value',
    });

    expect(() => ConstructionPlanReviewAnchorSchema.parse({
      kind: 'field',
      fieldPath: 'engineeringValues[0].value',
    })).toThrow();
    expect(() => ConstructionPlanReviewAnchorSchema.parse({
      kind: 'field',
      entityType: 'plan',
      entityId: 'plan-1',
      jsonPointer: '/__proto__/polluted',
    })).toThrow();
  });

  it('requires immutable page identity and paired coordinates for drawing anchors', () => {
    expect(() => ConstructionPlanReviewAnchorSchema.parse({
      kind: 'drawing',
      drawingId: 'drawing-1',
      pageIndex: 0,
    })).toThrow();
    expect(() => ConstructionPlanReviewAnchorSchema.parse({
      kind: 'drawing',
      drawingId: 'drawing-1',
      pageIndex: 0,
      pageFingerprint: 'page-fingerprint',
      x: 0.5,
    })).toThrow();
  });

  it('prevents hidden required comments', () => {
    expect(() => CreateConstructionPlanReviewCommentRequestSchema.parse({
      requestId: 'request-1',
      planId: 'plan-1',
      anchor: { kind: 'plan' },
      visibility: 'central_only',
      required: true,
      body: '필수 의견',
    })).toThrow('Required review comments must be visible to all participants.');
  });

  it('defaults the server-authoritative plan-author reply counter and rejects invalid values', () => {
    expect(ConstructionPlanReviewCommentSchema.shape.authorReplyCount.parse(undefined)).toBe(0);
    expect(ConstructionPlanReviewCommentSchema.shape.authorReplyCount.parse(2)).toBe(2);
    expect(() => ConstructionPlanReviewCommentSchema.shape.authorReplyCount.parse(-1)).toThrow();
  });

  it('validates the unresolved required comment counter invariant', () => {
    const base = {
      totalOpen: 1,
      totalAddressed: 1,
      totalResolved: 2,
      requiredOpen: 1,
      requiredAddressed: 1,
      requiredResolved: 0,
      updatedAt: '2026-08-22T00:00:00.000Z',
    };
    expect(ConstructionPlanReviewCommentSummarySchema.parse({
      ...base,
      unresolvedRequired: 2,
    }).unresolvedRequired).toBe(2);
    expect(() => ConstructionPlanReviewCommentSummarySchema.parse({
      ...base,
      unresolvedRequired: 1,
    })).toThrow();
  });
});
