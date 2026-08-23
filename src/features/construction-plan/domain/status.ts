import type { PlanStatus } from '../types';

export const PLAN_STATUS_TRANSITIONS: Record<PlanStatus, readonly PlanStatus[]> = {
  draft: ['in_review', 'void', 'archived'],
  in_review: ['changes_requested', 'review_completed', 'draft', 'void'],
  changes_requested: ['in_review', 'void', 'archived'],
  review_completed: ['approved_pending_issue', 'changes_requested', 'void'],
  approved_pending_issue: ['issued', 'void'],
  issued: ['superseded', 'archived'],
  superseded: ['archived'],
  archived: [],
  void: ['archived'],
};

export const canTransitionPlanStatus = (from: PlanStatus, to: PlanStatus): boolean =>
  PLAN_STATUS_TRANSITIONS[from].includes(to);

export const assertPlanStatusTransition = (from: PlanStatus, to: PlanStatus): void => {
  if (!canTransitionPlanStatus(from, to)) {
    throw new Error(`construction-plan-invalid-status-transition:${from}:${to}`);
  }
};

export const isPlanContentEditable = (status: PlanStatus): boolean =>
  status === 'draft' || status === 'changes_requested';
