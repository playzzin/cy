import type { AccommodationAssignment } from '../types/accommodationAssignment';
import type { AccommodationBillingTarget } from '../types/accommodationBillingTarget';

type DateRange = {
  startDate?: string | null;
  endDate?: string | null;
};

const toLocalDay = (value: string): Date | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) return null;

  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
};

const isDateRangeCurrent = (range: DateRange, now: Date): boolean => {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startDate = range.startDate ? toLocalDay(range.startDate) : null;
  const endDate = range.endDate ? toLocalDay(range.endDate) : null;

  if (startDate && startDate > today) return false;
  if (endDate && endDate < today) return false;
  return true;
};

export const isCurrentAccommodationAssignment = (
  assignment: Pick<AccommodationAssignment, 'status' | 'startDate' | 'endDate'>,
  now = new Date()
): boolean => assignment.status !== 'ended' && isDateRangeCurrent(assignment, now);

export const isCurrentAccommodationBillingTarget = (
  target: Pick<AccommodationBillingTarget, 'startDate' | 'endDate'>,
  now = new Date()
): boolean => isDateRangeCurrent(target, now);

export const matchesCurrentAccommodationTeamScope = <
  Assignment extends Pick<AccommodationAssignment, 'status' | 'startDate' | 'endDate'>,
  BillingTarget extends Pick<AccommodationBillingTarget, 'startDate' | 'endDate'>
>(
  assignments: readonly Assignment[],
  billingTargets: readonly BillingTarget[],
  assignmentMatches: (assignment: Assignment) => boolean,
  billingTargetMatches: (target: BillingTarget) => boolean,
  now = new Date()
): boolean => {
  const currentAssignments = assignments.filter((assignment) =>
    isCurrentAccommodationAssignment(assignment, now)
  );

  if (currentAssignments.length > 0) {
    return currentAssignments.some(assignmentMatches);
  }

  return billingTargets
    .filter((target) => isCurrentAccommodationBillingTarget(target, now))
    .some(billingTargetMatches);
};
