import { changeDraftAmount, createRepairDraft, hasRepairDraftChanges, parseRepairAmountInput, repairDraftIssues } from './draft';
import { emptyCosts, RepairRecord } from './model';

const row: RepairRecord = { id: 'test', date: '2026-04-01', yearMonth: '2026-04', originalDate: '', vehiclePlate: '12가3456', vehicleId: '', description: '점검', driver: '', vendor: '업체', costs: { ...emptyCosts(), personal: 100 }, memo: '', issues: [], archived: false, revision: 1 };

test.each([['', null], ['0', 0], ['.5', 0.5], ['1,234.70', 1234.7], ['100.', 100], ['10000000000.01', 10000000000.01]])('유효한 금액 입력 %s를 정확히 해석한다', (text, value) => {
  expect(parseRepairAmountInput(text as string)).toEqual({ valid: true, value });
});
test.each(['1,2', '1,,234', '-10', '10.001', '1e3', 'Infinity', '9007199254740992'])('잘못된 금액 입력 %s를 거부한다', text => {
  expect(parseRepairAmountInput(text)).toEqual({ valid: false });
});
test('잘못된 입력은 원문을 보존하고 숫자 데이터에 NaN을 넣지 않는다', () => {
  const draft = changeDraftAmount(createRepairDraft(row), 'personal', '1,2');
  expect(draft.amountInputs.personal).toBe('1,2');
  expect(draft.record.costs.personal).toBe(100);
  expect(repairDraftIssues(draft).join(' ')).toContain('금액 형식');
  expect(hasRepairDraftChanges(draft)).toBe(true);
});
test('원래 값과 같은 금액의 표기 변경은 실제 수정으로 취급하지 않는다', () => {
  const draft = changeDraftAmount(createRepairDraft(row), 'personal', '100.00');
  expect(hasRepairDraftChanges(draft)).toBe(false);
  expect(hasRepairDraftChanges(changeDraftAmount(draft, 'personal', '101'))).toBe(true);
});
