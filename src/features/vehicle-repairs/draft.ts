import { COST_KEYS, CostKey, isValidRepairAmount, RepairCostCategory, RepairRecord, repairAmounts, repairGrossFromSupply, repairIssues } from './model';

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
export const invalidDraftAmounts = (draft: RepairDraft): CostKey[] => COST_KEYS.filter(key => {
  const raw = draft.amountInputs[key];
  if (raw === undefined) return false;
  const parsed = parseRepairAmountInput(raw);
  return !parsed.valid || (key === 'corporate' && parsed.value !== null && !isValidRepairAmount(repairGrossFromSupply(parsed.value)));
});
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

export function changeDraftDisplayAmount(draft: RepairDraft, key: RepairCostCategory, text: string): RepairDraft {
  if (key === 'personal') return changeDraftAmount(draft, key, text);
  const parsed = parseRepairAmountInput(text);
  const result = { ...draft, amountInputs: { ...draft.amountInputs, corporate: text } };
  if (parsed.valid && parsed.value === repairAmounts(draft.original).corporate) return {
    ...result, record: { ...draft.record, costs: { ...draft.record.costs,
      joeun: draft.original.costs.joeun, cheongyeon: draft.original.costs.cheongyeon, corporate: draft.original.costs.corporate } },
  };
  if (!parsed.valid || parsed.value === repairAmounts(draft.record).corporate) return result;
  const gross = parsed.value === null ? null : repairGrossFromSupply(parsed.value);
  if (gross !== null && !isValidRepairAmount(gross)) return result;
  return { ...result, record: { ...draft.record, costs: { ...draft.record.costs, joeun: null, cheongyeon: null, corporate: gross } } };
}

export function repairDraftIssues(draft: RepairDraft): string[] {
  const issues = repairIssues(draft.record);
  if (invalidDraftAmounts(draft).length) issues.push('금액 형식 확인 필요 (쉼표 구분과 소수 두 자리 확인)');
  return issues;
}
