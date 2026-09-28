import { strict as assert } from 'assert';
import { test } from 'node:test';
import { validatePlan } from './domain';
import { buildSettlementResult } from './settlements';
import { settlementPlan, settlementCatalog, settlementDocument } from './settlementFixtures';

test('settlement plan only accepts a complete month, confirmed data and team grouping', () => {
  const plan = settlementPlan(); assert.equal(validatePlan(plan).dataset, 'teamSettlements');
  for (const patch of [{ groupBy: 'site' }, { status: '미확정' }, { range: { startDate: '2026-08-01', endDate: '2026-08-28' } }, { range: { startDate: '2026-07-01', endDate: '2026-08-31' } }, { filters: [{ entity: 'worker', name: '합성 작업자', id: 'w1' }] }]) assert.throws(() => validatePlan({ ...plan, ...patch }));
});
test('saved confirmed formula matches settlement screen and strips legacy support originals once', () => {
  const doc = settlementDocument(), result = buildSettlementResult('financial', settlementPlan(), [doc, doc], settlementCatalog());
  assert.deepEqual(result.settlement!.totals, { sales: 1000000, purchases: 200000, deductions: 310000, additions: 20000, prevCarryover: 40000, deposit: 60000, net: 610000, documents: 1, card: 50000, accommodation: 100000, vehicle: 30000, payroll: 120000, other: 10000 });
  assert.equal(result.settlement!.details.length, 10);
  assert.equal(JSON.stringify(result).includes('반환 금지 메모'), false); assert.equal(JSON.stringify(result).includes('9999999'), false);
});
test('unconfirmed snapshots are excluded; malformed confirmed document is excluded as a whole', () => {
  const broken = settlementDocument('t2'); broken.data.deductions[0].amount = -1;
  const result = buildSettlementResult('mixed', settlementPlan(), [settlementDocument('t1', '2026-08', false), broken], settlementCatalog());
  assert.equal(result.settlement!.totals.documents, 0); assert.equal(result.completeness, 'partial');
  assert.ok(result.warnings.some(warning => warning.includes('미확정')));
});
test('team filter, catalog scope and document identity cannot be overridden by payload labels', () => {
  const plan = settlementPlan(); plan.filters = [{ entity: 'team', name: '1팀', id: 't1' }];
  const forged = settlementDocument('t1'); forged.id = 'team_settlement_2026-08__t2';
  const outside = buildSettlementResult('outside', plan, [settlementDocument('t2')], settlementCatalog());
  assert.equal(outside.settlement!.totals.documents, 0); assert.equal(outside.completeness, 'complete');
  const result = buildSettlementResult('limited', plan, [forged], settlementCatalog());
  assert.equal(result.settlement!.totals.documents, 0); assert.equal(result.completeness, 'partial');
});
test('comparison includes previous-only teams and signed change, without summing carryover across months', () => {
  const result = buildSettlementResult('comparison', settlementPlan(), [settlementDocument(), settlementDocument('t2', '2026-07')], settlementCatalog());
  const rows = result.settlement!.rows;
  assert.equal(rows.find(row => row.id === 't1')!.netChange, 610000);
  assert.equal(rows.find(row => row.id === 't2')!.netChange, -610000);
  assert.equal(result.settlement!.totals.net, 610000); assert.equal(result.settlement!.previousTotals!.net, 610000);
});
test('JSON snapshots, negative net, missing additions and empty results are explicit', () => {
  const doc = settlementDocument(); doc.data.sales[0].amount = 0; delete doc.data.additions;
  doc.data = JSON.stringify(doc.data);
  const result = buildSettlementResult('negative', settlementPlan(), [doc], settlementCatalog());
  assert.equal(result.settlement!.totals.net, -410000);
  assert.match(buildSettlementResult('empty', settlementPlan(), [], settlementCatalog()).summary, /없습니다/);
});
