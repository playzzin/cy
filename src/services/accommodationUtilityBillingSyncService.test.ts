import type { AccommodationBillingLineItem } from '../types/accommodationBilling';
import {
  matchesAccommodationUtilityBillingLineItem,
  preserveOtherAccommodationUtilityLineItems,
  resolveAccommodationAutoBillingCandidateKeys,
  isAccommodationAssignmentActiveInMonth,
  hasSameAccommodationUtilityBillingAmounts,
} from './accommodationUtilityBillingSyncService';

const reference = {
  recordId: 'utility-101',
  accommodationId: 'acc-101',
  accommodationName: '101호',
};

const line = (patch: Partial<AccommodationBillingLineItem>): AccommodationBillingLineItem => ({
  id: 'line',
  label: '101호 월세',
  amount: 100,
  targetField: 'accommodation',
  ...patch,
});

describe('accommodationUtilityBillingSyncService', () => {
  it('preserves another accommodation line item in the same team draft', () => {
    const own = line({ id: 'own', sourceUtilityRecordId: 'utility-101', sourceAccommodationId: 'acc-101' });
    const other = line({
      id: 'other',
      label: '102호 월세',
      sourceUtilityRecordId: 'utility-102',
      sourceAccommodationId: 'acc-102',
    });

    expect(preserveOtherAccommodationUtilityLineItems([own, other], reference)).toEqual([other]);
  });

  it('removes only the zeroed accommodation lines while preserving manual and other rows', () => {
    const ownRent = line({ id: 'own-rent', sourceAccommodationId: 'acc-101' });
    const ownWater = line({ id: 'own-water', label: '101호 수도세', sourceUtilityRecordId: 'utility-101' });
    const manual = line({ id: 'manual', label: '수기 조정', sourceType: 'manual' });
    const other = line({ id: 'other', label: '102호 관리비', sourceAccommodationId: 'acc-102' });

    expect(preserveOtherAccommodationUtilityLineItems(
      [ownRent, ownWater, manual, other],
      reference
    )).toEqual([manual, other]);
  });

  it('does not use a fuzzy label fallback for source-aware rows from another accommodation', () => {
    expect(matchesAccommodationUtilityBillingLineItem(line({
      label: '101호 월세',
      sourceUtilityRecordId: 'utility-other',
      sourceAccommodationId: 'acc-other',
    }), reference)).toBe(false);
  });

  it('preserves a manual row even when its label resembles a utility-ledger label', () => {
    expect(matchesAccommodationUtilityBillingLineItem(line({
      label: '101호 월세',
      sourceType: 'manual',
      sourceUtilityRecordId: undefined,
      sourceAccommodationId: undefined,
    }), reference)).toBe(false);
  });

  it('matches only an exact legacy utility label prefix, not a similarly named accommodation', () => {
    expect(matchesAccommodationUtilityBillingLineItem(line({
      label: '101호 월세 2026-08-01~2026-08-31',
      sourceType: 'utility_ledger',
      sourceUtilityRecordId: undefined,
      sourceAccommodationId: undefined,
    }), reference)).toBe(true);
    expect(matchesAccommodationUtilityBillingLineItem(line({
      label: '101호 별관 월세',
      sourceType: 'utility_ledger',
      sourceUtilityRecordId: undefined,
      sourceAccommodationId: undefined,
    }), reference)).toBe(false);
  });

  it('preserves an unmarked UUID manual row even when its label looks like a utility row', () => {
    expect(matchesAccommodationUtilityBillingLineItem(line({
      id: 'f64f0db4-7992-4718-b493-31ad84f60b04',
      label: '101호 월세 조정',
      sourceType: undefined,
      sourceUtilityRecordId: undefined,
      sourceAccommodationId: undefined,
    }), reference)).toBe(false);
  });

  it('reconciles the loaded month on an explicit save after refresh erased retry keys', () => {
    expect(Array.from(resolveAccommodationAutoBillingCandidateKeys(
      ['acc-101|2026-08', 'acc-102|2026-08', 'inactive-history|2026-08'],
      []
    ))).toEqual(['acc-101|2026-08', 'acc-102|2026-08', 'inactive-history|2026-08']);
  });

  it('keeps a targeted retry scoped when changed or pending keys exist', () => {
    expect(Array.from(resolveAccommodationAutoBillingCandidateKeys(
      ['acc-101|2026-08', 'acc-102|2026-08'],
      ['acc-102|2026-08']
    ))).toEqual(['acc-102|2026-08']);
  });

  it('keeps an ended assignment when its dated occupancy overlaps the billed month', () => {
    expect(isAccommodationAssignmentActiveInMonth({
      status: 'ended',
      startDate: '2026-07-20',
      endDate: '2026-08-05',
    }, '2026-08')).toBe(true);
    expect(isAccommodationAssignmentActiveInMonth({
      status: 'ended',
      startDate: '2026-07-01',
      endDate: '2026-07-31',
    }, '2026-08')).toBe(false);
  });

  it('recognizes a persisted retry whose protected billing already matches the ledger snapshot', () => {
    const document = (
      teamId: string,
      amount: number,
      status: 'draft' | 'confirmed'
    ) => ({
      id: `${teamId}-billing`,
      yearMonth: '2026-08',
      teamId,
      teamName: teamId,
      issuedToType: 'team' as const,
      issuedToWorkerId: '',
      issuedToWorkerName: teamId,
      status,
      memo: '',
      lineItems: [line({
        id: `${teamId}-rent`,
        amount,
        sourceUtilityRecordId: 'utility-101',
        sourceAccommodationId: 'acc-101',
      })],
    });

    expect(hasSameAccommodationUtilityBillingAmounts(
      [document('team-a', 100, 'draft')],
      [document('team-a', 100, 'confirmed')],
      reference
    )).toBe(true);
    expect(hasSameAccommodationUtilityBillingAmounts(
      [document('team-b', 100, 'draft')],
      [document('team-a', 100, 'confirmed')],
      reference
    )).toBe(false);
  });
});
