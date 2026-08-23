import {
  getAccommodationExpenseBucket,
  isUtilityLedgerOtherExpense
} from './accommodationExpenseClassification';
import type { AccommodationBillingLineItem } from '../types/accommodationBilling';

const buildLineItem = (
  patch: Partial<AccommodationBillingLineItem> = {}
): AccommodationBillingLineItem => ({
  id: 'utility-record-1-rent',
  label: '테스트 숙소 월세',
  amount: 100_000,
  targetField: 'accommodation',
  sourceType: 'utility_ledger',
  ...patch
});

describe('accommodation expense classification', () => {
  it('classifies a utility-ledger other row separately even with the legacy accommodation target', () => {
    const item = buildLineItem({
      id: 'utility-record-1-other',
      label: '테스트 숙소 기타'
    });

    expect(isUtilityLedgerOtherExpense(item)).toBe(true);
    expect(getAccommodationExpenseBucket(item)).toBe('other');
  });

  it('classifies split utility-ledger other rows separately', () => {
    const item = buildLineItem({
      id: 'utility-record-1-other-split-0',
      label: '테스트 숙소 기타 2026-07-01~2026-07-15'
    });

    expect(getAccommodationExpenseBucket(item)).toBe('other');
  });

  it('uses the utility label as a fallback for older deterministic ids', () => {
    const item = buildLineItem({
      id: 'legacy-line-item',
      label: '테스트 숙소 기타'
    });

    expect(getAccommodationExpenseBucket(item)).toBe('other');
  });

  it('recognizes deterministic utility ids when an older row has no source type', () => {
    const item = buildLineItem({
      id: 'utility-record-1-other',
      sourceType: undefined
    });

    expect(getAccommodationExpenseBucket(item)).toBe('other');
  });

  it('does not reclassify a manual accommodation charge merely because its label says 기타', () => {
    const item = buildLineItem({
      id: 'manual-accommodation-charge',
      label: '기타',
      sourceType: 'manual'
    });

    expect(getAccommodationExpenseBucket(item)).toBe('accommodation');
  });

  it('keeps utility rent in the accommodation bucket', () => {
    expect(getAccommodationExpenseBucket(buildLineItem())).toBe('accommodation');
  });
});
