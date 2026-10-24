import { COST_KEYS, CostKey, isValidRepairAmount, RepairRecord, repairIssues } from './model';

export interface RepairDraft {
  original: RepairRecord;
  record: RepairRecord;
  amountInputs: Partial<Record<CostKey, string>>;
}

export function parseRepairAmountInput(raw: string): { valid: true; value: number | null } | { valid: false } {
  const text = raw.trim();
  if (!text) return { valid: true, value: null };
  // Accept grouped thousands and up to two decimals, including .5. Never drop malformed separators.
  if (!/^(?:(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{0,2})?|\.\d{1,2})$/.test(text)) return { valid: false };
  const value = Number(text.replace(/,/g, ''));
  return isValidRepairAmount(value) ? { valid: true, value } : { valid: false };
}

export const createRepairDraft = (row: RepairRecord): RepairDraft => ({ original: row, record: row, amountInputs: {} });
export const invalidDraftAmounts = (draft: RepairDraft): CostKey[] => COST_KEYS.filter(key => draft.amountInputs[key] !== undefined && !parseRepairAmountInput(draft.amountInputs[key]!).valid);
export function hasRepairDraftChanges(draft: RepairDraft): boolean {
  if (draft.record.revision === 0 || invalidDraftAmounts(draft).length) return true;
  const { original, record } = draft;
  return (['date', 'vehiclePlate', 'description', 'driver', 'vendor', 'memo'] as const).some(key => original[key] !== record[key])
    || COST_KEYS.some(key => original.costs[key] !== record.costs[key])
    || original.issues.join('\n') !== record.issues.join('\n');
}

export function changeDraftAmount(draft: RepairDraft, key: CostKey, text: string): RepairDraft {
  const parsed = parseRepairAmountInput(text);
  return {
    ...draft,
    amountInputs: { ...draft.amountInputs, [key]: text },
    // Keep persisted values numeric; the raw input and its validation survive pagination separately.
    record: parsed.valid ? { ...draft.record, costs: { ...draft.record.costs, [key]: parsed.value } } : draft.record,
  };
}

export function repairDraftIssues(draft: RepairDraft): string[] {
  const issues = repairIssues(draft.record);
  if (invalidDraftAmounts(draft).length) issues.push('금액 형식 확인 필요 (쉼표 구분과 소수 두 자리 확인)');
  return issues;
}
