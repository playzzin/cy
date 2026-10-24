const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildRepair, protectedContent } = require('./team-settlement-expense-recovery.cjs');
const item = (id, amount, origin = 'card_billing') => ({ id, amount, origin, source: 'auto', category: '검증 경비' });
const entry = (id, amount, direction = 'deduction') => ({ direction, item: item(id, amount, direction === 'addition' ? 'team_expense_claim' : 'card_billing'), details: [] });
const document = () => ({ yearMonth: '2026-08', teamId: 'team', teamName: '검증팀', sales: [], purchases: [],
  deductions: [item('old', 100), item('old', 100), { id: 'manual', amount: 7, source: 'manual', origin: 'manual', category: '수기' }],
  additions: [], summary: { prevCarryover: 30, deposit: 40 }, transactionMemo: '보존', custom: { keep: true },
  sourceSnapshot: { version: 1, capturedAt: '2026-09-01T00:00:00.000Z', dailyReports: [], totals: { sales: 0, purchases: 0, deductions: 200, additions: 0, net: -200 } },
  updatedAt: '2026-09-01T00:00:00.000Z', confirmedAt: null });
test('누락·중복·금액 수정과 원천 합계를 갱신하고 나머지 필드는 보존한다', () => {
  const raw = document(), before = JSON.stringify(raw), entries = [entry('old', 150), entry('new', 50), entry('credit', 80, 'addition')];
  const result = buildRepair(raw, entries, '2026-10-14T04:00:00.000Z');
  assert.equal(result.candidate.deductions.length, 3);
  assert.equal(result.candidate.sourceSnapshot.totals.net, -120);
  assert.equal(result.candidate.sourceSnapshot.totals.deductions, 200);
  assert.equal(protectedContent(result.candidate), protectedContent(raw));
  assert.equal(JSON.stringify(raw), before);
  assert.equal(buildRepair(result.candidate, entries, '2026-10-14T05:00:00.000Z').skip, 'unchanged');
});
test('확정 정산은 수정하지 않는다', () => {
  assert.equal(buildRepair({ ...document(), confirmedAt: '2026-09-01T00:00:00.000Z' }, [], '2026-10-14T04:00:00.000Z').skip, 'confirmed');
});
test('새로 추가할 경비와 같은 금액의 수기가 있으면 검토 대상으로 보류한다', () => {
  assert.equal(buildRepair(document(), [entry('old', 200), entry('new', 7)], '2026-10-14T04:00:00.000Z').skip, 'manual-review');
});
test('금액이 같은 청구서 연결 교체는 수기 일치 때문에 막지 않는다', () => {
  const raw = document(); raw.deductions = [item('old', 7), raw.deductions[2]];
  assert.ok(buildRepair(raw, [entry('new', 7)], '2026-10-14T04:00:00.000Z').candidate);
});
