import type { AdvancePayment } from '../../../services/advancePaymentService';
import type { LedgerManualInput } from '../types/payroll';

const toNumber = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/,/g, '').trim());
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const normalizeLabel = (value: unknown): string => String(value ?? '').replace(/\s+/g, '').trim();

const createEmptySideInput = (): LedgerManualInput['invoice'] => ({
  carry: 0,
  carrySecond: 0,
  currentAdvance: 0,
  currentAdvanceSecond: 0,
  lodging: 0,
  electricity: 0,
  gas: 0,
  water: 0,
  internet: 0,
  management: 0,
  fine: 0,
  other: 0,
});

const getMappedItemAmount = (
  record: AdvancePayment,
  deductionLabelMap: Record<string, string>,
  canonicalKey: string,
  canonicalLabel: string
): number => {
  const normalizedTargetLabel = normalizeLabel(canonicalLabel);
  return Object.entries(record.items ?? {}).reduce((sum, [key, rawAmount]) => {
    const isCanonicalKey = key === canonicalKey;
    const mappedLabel = normalizeLabel(deductionLabelMap[key]);
    if (!isCanonicalKey && mappedLabel !== normalizedTargetLabel) return sum;
    return sum + toNumber(rawAmount);
  }, 0);
};

const normalizeAssignmentKey = (
  key: string,
  deductionLabelMap: Record<string, string>
): string => {
  if (key === 'accommodation') return 'lodging';
  if (key === 'maintenance') return 'management';
  if (key === 'fines') return 'fine';
  if (key === 'other' || normalizeLabel(deductionLabelMap[key]) === normalizeLabel('기타')) return 'other';
  return key;
};

export const buildManualInputFromAdvanceRecord = (
  record: AdvancePayment | undefined,
  deductionLabelMap: Record<string, string> = {}
): LedgerManualInput | undefined => {
  if (!record) return undefined;

  const normalizedItemAssignments = Object.entries(record.itemAssignments ?? {}).reduce<Record<string, 'corporate' | 'labor'>>(
    (acc, [key, value]) => {
      const normalizedKey = normalizeAssignmentKey(key, deductionLabelMap);
      if (normalizedKey) acc[normalizedKey] = value;
      return acc;
    },
    {}
  );

  const getStandardDeductionAmount = (key: 'privateRoom' | 'gloves' | 'deposit'): number => {
    const directAmount = toNumber(record[key]);
    return directAmount > 0 ? directAmount : toNumber(record.items?.[key]);
  };
  const legacyOtherDeduction =
    getStandardDeductionAmount('privateRoom')
    + getStandardDeductionAmount('gloves')
    + getStandardDeductionAmount('deposit');

  if (!normalizedItemAssignments.other) {
    const mergedAssignments = ['privateRoom', 'gloves', 'deposit']
      .map((key) => record.itemAssignments?.[key])
      .filter((value): value is 'corporate' | 'labor' => value === 'corporate' || value === 'labor');
    if (mergedAssignments.length > 0 && mergedAssignments.every((value) => value === mergedAssignments[0])) {
      normalizedItemAssignments.other = mergedAssignments[0];
    }
  }

  return {
    invoice: {
      ...createEmptySideInput(),
      carry: toNumber(record.items?.corporateAdvance1),
      carrySecond: toNumber(record.items?.corporateAdvance2 ?? record.items?.carrySecond),
      currentAdvance: toNumber(record.items?.corporateAdvance3 ?? record.items?.currentAdvance),
      currentAdvanceSecond: toNumber(record.items?.corporateAdvance4 ?? record.items?.currentAdvanceSecond),
      lodging: toNumber(record.accommodation),
      electricity: toNumber(record.electricity),
      gas: toNumber(record.gas),
      water: toNumber(record.water),
    },
    labor: {
      ...createEmptySideInput(),
      carry: toNumber(record.items?.laborAdvance1),
      carrySecond: toNumber(record.items?.laborAdvance2),
      currentAdvance: toNumber(record.items?.laborAdvance3),
      currentAdvanceSecond: toNumber(record.items?.laborAdvance4),
      internet: toNumber(record.internet),
      management: getMappedItemAmount(record, deductionLabelMap, 'management', '관리비')
        || toNumber(record.items?.maintenance),
      fine: toNumber(record.fines),
      other: getMappedItemAmount(record, deductionLabelMap, 'other', '기타') + legacyOtherDeduction,
    },
    personalMemo: String(record.memo ?? ''),
    assignmentType: record.assignmentType === 'corporate' ? 'corporate' : 'labor',
    itemAssignments: normalizedItemAssignments,
  };
};

const toEpochMillis = (value: unknown): number => {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (!value || typeof value !== 'object') return 0;

  const timestamp = value as {
    toMillis?: () => number;
    toDate?: () => Date;
    seconds?: number;
    _seconds?: number;
    nanoseconds?: number;
    _nanoseconds?: number;
  };
  if (typeof timestamp.toMillis === 'function') return toNumber(timestamp.toMillis());
  if (typeof timestamp.toDate === 'function') return toEpochMillis(timestamp.toDate());

  const seconds = toNumber(timestamp.seconds ?? timestamp._seconds);
  const nanoseconds = toNumber(timestamp.nanoseconds ?? timestamp._nanoseconds);
  return seconds > 0 ? (seconds * 1000) + Math.floor(nanoseconds / 1_000_000) : 0;
};

const mergeNewSourceValuesIntoDraft = (
  advanceInput: LedgerManualInput,
  draftInput: LedgerManualInput
): LedgerManualInput => {
  const mergeSide = (side: 'invoice' | 'labor'): LedgerManualInput['invoice'] => {
    const source = { ...createEmptySideInput(), ...(advanceInput[side] ?? {}) };
    const draft = { ...createEmptySideInput(), ...(draftInput[side] ?? {}) };
    return Object.fromEntries(
      Object.keys(source).map((key) => {
        const field = key as keyof LedgerManualInput['invoice'];
        const draftAmount = toNumber(draft[field]);
        return [field, draftAmount !== 0 ? draftAmount : toNumber(source[field])];
      })
    ) as unknown as LedgerManualInput['invoice'];
  };

  return {
    ...advanceInput,
    ...draftInput,
    invoice: mergeSide('invoice'),
    labor: mergeSide('labor'),
    personalMemo: String(draftInput.personalMemo ?? '').trim()
      ? draftInput.personalMemo
      : advanceInput.personalMemo,
    itemAssignments: {
      ...(advanceInput.itemAssignments ?? {}),
      ...(draftInput.itemAssignments ?? {}),
    },
  };
};

export const resolveInitialLedgerManualInput = (params: {
  advanceInput?: LedgerManualInput;
  advanceUpdatedAt?: unknown;
  settlementInput?: LedgerManualInput;
  settlementUpdatedAt?: unknown;
  settlementStatus?: string;
}): LedgerManualInput | undefined => {
  const { advanceInput, settlementInput } = params;
  if (!settlementInput) return advanceInput;
  if (!advanceInput) return settlementInput;

  const status = String(params.settlementStatus ?? 'draft').trim();
  if (status !== 'draft') return settlementInput;

  const advanceUpdatedAt = toEpochMillis(params.advanceUpdatedAt);
  const settlementUpdatedAt = toEpochMillis(params.settlementUpdatedAt);
  if (advanceUpdatedAt > 0 && settlementUpdatedAt > 0) {
    return advanceUpdatedAt > settlementUpdatedAt ? advanceInput : settlementInput;
  }

  // Legacy drafts may not have timestamps. Preserve existing draft edits while
  // filling fields that were subsequently added in advance management.
  return mergeNewSourceValuesIntoDraft(advanceInput, settlementInput);
};
