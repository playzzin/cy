import { changeDraftAmount, changeDraftDisplayAmount, createRepairDraft, hasRepairDraftChanges, invalidDraftAmounts, parseRepairAmountInput, repairDraftIssues } from './draft';
import { emptyCosts, RepairRecord, repairAmounts } from './model';

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

test('법인 공급가액 수정 후 되돌리면 기존 법인 구분과 총액이 복구된다', () => {
  const original = { ...row, costs: { personal: 100, joeun: 11000, cheongyeon: 22000, corporate: 33000 } };
  let draft = createRepairDraft(original);
  draft = changeDraftDisplayAmount(draft, 'corporate', '100000');
  expect(draft.record.costs).toEqual({ ...emptyCosts(), personal: 100, corporate: 110000 });
  expect(repairAmounts(draft.record)).toEqual({ personal: 100, corporate: 100000, vat: 10000, total: 110100 });
  draft = changeDraftDisplayAmount(draft, 'corporate', '60000');
  expect(draft.record.costs).toEqual(original.costs);
  expect(hasRepairDraftChanges(draft)).toBe(false);
});

test('공급가액의 소수 반올림과 빈값·0원을 구분하며 재편집해도 VAT를 중복하지 않는다', () => {
  let draft = changeDraftDisplayAmount(createRepairDraft(row), 'corporate', '100.05');
  expect(repairAmounts(draft.record)).toEqual({ personal: 100, corporate: 100.05, vat: 10.01, total: 210.06 });
  const saved = draft.record;
  draft = changeDraftDisplayAmount(createRepairDraft(saved), 'corporate', '100.05');
  expect(hasRepairDraftChanges(draft)).toBe(false);
  expect(draft.record.costs.corporate).toBe(110.06);
  expect(changeDraftDisplayAmount(draft, 'corporate', '0').record.costs.corporate).toBe(0);
  expect(changeDraftDisplayAmount(draft, 'corporate', '').record.costs.corporate).toBeNull();
});

test('부가세 합산으로 안전한 금액 범위를 넘으면 입력을 보존하고 저장을 막는다', () => {
  const draft = changeDraftDisplayAmount(createRepairDraft(row), 'corporate', '90000000000000');
  expect(draft.record).toBe(row);
  expect(draft.amountInputs.corporate).toBe('90000000000000');
  expect(invalidDraftAmounts(draft)).toContain('corporate');
  expect(repairDraftIssues(draft).join(' ')).toContain('금액 형식');
});
