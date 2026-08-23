import type {
  AccommodationBillingDocument,
  AccommodationBillingLineItem,
} from '../types/accommodationBilling';
import type { AccommodationAssignment } from '../types/accommodationAssignment';

export interface AccommodationUtilityBillingRecordReference {
  recordId: string;
  accommodationId: string;
  accommodationName: string;
}

const UTILITY_LABELS = [
  '월세',
  '전기세',
  '가스비',
  '수도세',
  '인터넷',
  '관리비',
  '기타',
] as const;

const normalize = (value: unknown): string => String(value ?? '').trim();

export const isAccommodationAssignmentActiveInMonth = (
  assignment: Pick<AccommodationAssignment, 'status' | 'startDate' | 'endDate'>,
  yearMonth: string
): boolean => {
  const match = /^(\d{4})-(\d{2})$/.exec(normalize(yearMonth));
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0);
  const startDate = assignment.startDate ? new Date(assignment.startDate) : null;
  if (startDate && !Number.isNaN(startDate.getTime()) && startDate > monthEnd) return false;
  if (!assignment.endDate) return (assignment.status ?? 'active') !== 'ended';
  const endDate = new Date(assignment.endDate);
  if (Number.isNaN(endDate.getTime())) return true;
  return endDate >= monthStart;
};

/**
 * Links a billing line to exactly one utility-ledger record.
 * Modern source ids take precedence. The label fallback is intentionally
 * strict so similarly named accommodations (for example "101호" and
 * "101호 별관") cannot remove each other's legacy line items.
 */
export const matchesAccommodationUtilityBillingLineItem = (
  lineItem: Pick<
    AccommodationBillingLineItem,
    'id' | 'label' | 'sourceType' | 'sourceUtilityRecordId' | 'sourceAccommodationId'
  >,
  reference: AccommodationUtilityBillingRecordReference
): boolean => {
  const recordId = normalize(reference.recordId);
  const accommodationId = normalize(reference.accommodationId);
  const sourceRecordId = normalize(lineItem.sourceUtilityRecordId);
  const sourceAccommodationId = normalize(lineItem.sourceAccommodationId);

  if (lineItem.sourceType === 'manual') return false;

  if (sourceRecordId && recordId && sourceRecordId === recordId) return true;
  if (sourceAccommodationId && accommodationId && sourceAccommodationId === accommodationId) return true;

  // Source-aware rows belong to another record when neither source key matched.
  if (sourceRecordId || sourceAccommodationId) return false;

  const lineItemId = normalize(lineItem.id);
  const sanitizedRecordId = recordId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const hasDeterministicUtilityId = Boolean(
    recordId
    && (
      lineItemId.startsWith(`utility-${recordId}-`)
      || lineItemId.startsWith(`utility-${sanitizedRecordId}-`)
    )
  );
  if (hasDeterministicUtilityId) return true;

  // Unmarked UUID rows are legacy/manual rows. A utility-ledger source marker
  // is required before using the label fallback, otherwise labels such as
  // "101호 월세 조정" could be deleted by automatic reconciliation.
  if (lineItem.sourceType !== 'utility_ledger') return false;

  const accommodationName = normalize(reference.accommodationName);
  const label = normalize(lineItem.label);
  if (!accommodationName || !label) return false;

  return UTILITY_LABELS.some((utilityLabel) => {
    const prefix = `${accommodationName} ${utilityLabel}`;
    return label === prefix || label.startsWith(`${prefix} `);
  });
};

export const preserveOtherAccommodationUtilityLineItems = (
  lineItems: AccommodationBillingLineItem[],
  reference: AccommodationUtilityBillingRecordReference
): AccommodationBillingLineItem[] => lineItems.filter((lineItem) => (
  !matchesAccommodationUtilityBillingLineItem(lineItem, reference)
));

/**
 * A retry key lives in memory only. After a refresh there may be no changed
 * key even though a previous ledger save failed during billing sync. An
 * explicit Save with no candidates therefore reconciles the loaded month
 * idempotently instead of silently doing nothing.
 */
export const resolveAccommodationAutoBillingCandidateKeys = (
  loadedRecordKeys: Iterable<string>,
  candidateKeys: Iterable<string>
): Set<string> => {
  const candidates = new Set(Array.from(candidateKeys, normalize).filter(Boolean));
  if (candidates.size > 0) return candidates;
  return new Set(Array.from(loadedRecordKeys, normalize).filter(Boolean));
};

const getBillingTargetKey = (document: AccommodationBillingDocument): string => {
  const issuedToType = document.issuedToType === 'team_leader' ? 'team' : document.issuedToType;
  if (issuedToType === 'worker') {
    return `worker:${normalize(document.issuedToWorkerId) || normalize(document.issuedToWorkerName).toLowerCase()}`;
  }
  return `team:${normalize(document.teamId) || normalize(document.teamName).toLowerCase()}`;
};

const getRecordBillingAmountMap = (
  documents: AccommodationBillingDocument[],
  reference: AccommodationUtilityBillingRecordReference
): Map<string, number> => {
  const amounts = new Map<string, number>();
  documents.forEach((document) => {
    const targetKey = getBillingTargetKey(document);
    (document.lineItems ?? [])
      .filter((lineItem) => matchesAccommodationUtilityBillingLineItem(lineItem, reference))
      .forEach((lineItem) => {
        const key = `${targetKey}|${lineItem.targetField}`;
        amounts.set(key, (amounts.get(key) ?? 0) + Number(lineItem.amount ?? 0));
      });
  });
  return amounts;
};

export const hasSameAccommodationUtilityBillingAmounts = (
  expectedDocuments: AccommodationBillingDocument[],
  actualDocuments: AccommodationBillingDocument[],
  reference: AccommodationUtilityBillingRecordReference
): boolean => {
  const expected = getRecordBillingAmountMap(expectedDocuments, reference);
  const actual = getRecordBillingAmountMap(actualDocuments, reference);
  if (expected.size !== actual.size) return false;
  for (const [key, amount] of expected) {
    if (actual.get(key) !== amount) return false;
  }
  return true;
};
