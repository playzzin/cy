import type { AccommodationBillingLineItem } from '../types/accommodationBilling';

export type AccommodationExpenseBucket =
  | 'accommodation'
  | 'privateRoom'
  | 'electricity'
  | 'gas'
  | 'water'
  | 'internet'
  | 'other';

type AccommodationExpenseLineItem = Pick<
  AccommodationBillingLineItem,
  'id' | 'label' | 'sourceType' | 'targetField'
>;

const UTILITY_OTHER_ID_PATTERN = /-other(?:-split-\d+)?$/i;
const UTILITY_SPLIT_RANGE_SUFFIX_PATTERN = /\s+\d{4}-\d{2}-\d{2}\s*~\s*\d{4}-\d{2}-\d{2}\s*$/;
const UTILITY_OTHER_LABEL_PATTERN = /(?:^|\s)기타\s*$/;

/**
 * Utility-ledger "other" rows historically use `targetField: accommodation`
 * because that field is the posting destination in the advance-payment ledger.
 * Preserve that posting contract while recovering the original source column for
 * operating-expense presentation.
 */
export const isUtilityLedgerOtherExpense = (item: AccommodationExpenseLineItem): boolean => {
  const itemId = String(item.id ?? '').trim();
  const hasUtilityLedgerIdentity = item.sourceType === 'utility_ledger' || itemId.startsWith('utility-');
  if (!hasUtilityLedgerIdentity) return false;
  if (UTILITY_OTHER_ID_PATTERN.test(itemId)) return true;

  const labelWithoutSplitRange = String(item.label ?? '')
    .trim()
    .replace(UTILITY_SPLIT_RANGE_SUFFIX_PATTERN, '')
    .trim();
  return UTILITY_OTHER_LABEL_PATTERN.test(labelWithoutSplitRange);
};

export const getAccommodationExpenseBucket = (
  item: AccommodationExpenseLineItem
): AccommodationExpenseBucket => {
  if (isUtilityLedgerOtherExpense(item)) return 'other';

  if (item.targetField === 'accommodation') return 'accommodation';
  if (item.targetField === 'privateRoom') return 'privateRoom';
  if (item.targetField === 'electricity') return 'electricity';
  if (item.targetField === 'gas') return 'gas';
  if (item.targetField === 'water') return 'water';
  if (item.targetField === 'internet') return 'internet';
  return 'other';
};
