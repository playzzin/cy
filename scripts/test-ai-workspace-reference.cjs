const { test } = require('node:test');
const assert = require('node:assert/strict');
const { calculateReference } = require('./ai-workspace-settlement-reference.cjs');
const { buildSettlementResult } = require('../functions/lib/aiWorkspace/settlements');
const { settlementPlan, settlementCatalog, settlementDocument } = require('../functions/lib/aiWorkspace/settlementFixtures');
for (const [label, mutate] of [
  ['기본 확정 정산과 레거시 지원 원본 제외', () => {}],
  ['음수 정산 및 이월·입금 변경', doc => { doc.sales[0].amount = 0; doc.summary.prevCarryover = 2000; doc.summary.deposit = 8000; }],
  ['추가 차감과 환급', doc => { doc.deductions.push({id:'expense', origin:'team_expense_claim', amount:35000}); doc.additions.push({id:'addition', amount:20000}); }],
]) test('실제 기존 화면 계산 함수와 동일: ' + label, () => {
  const source = settlementDocument(); mutate(source.data);
  const expected = calculateReference(source.data), actual = buildSettlementResult('reference', settlementPlan(), [source], settlementCatalog()).settlement.totals;
  for (const [key, oldKey] of Object.entries({sales:'salesTotal',purchases:'purchasesTotal',deductions:'deductionsTotal',additions:'additionsTotal',prevCarryover:'prevCarryover',deposit:'deposit',net:'net',payroll:'payrollTotal'})) assert.equal(actual[key], expected[oldKey], key);
});

const { supportAmountReference } = require('./ai-workspace-settlement-reference.cjs');
const { supportSnapshotAmount } = require('../functions/lib/aiWorkspace/settlementEvidence');
test('support amount rounding matches the existing production calculation', () => {
  for (const days of [0, 0.333, 0.5, 1.25, 2.75]) for (const rate of [0, 170000, 180000.4, 180000.5]) assert.equal(supportSnapshotAmount(days, rate), supportAmountReference(days, rate));
});
