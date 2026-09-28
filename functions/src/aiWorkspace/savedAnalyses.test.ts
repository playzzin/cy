import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { fixturePlan } from './fixtures';
import { auditPlan } from './reconciliationFixtures';
import { findSavedAnalysis, readSavedAnalyses, reusablePlan, saveAnalysis, savedExecutionPlan } from './savedAnalyses';

test('saved conditions omit result data and preserve fixed dates and report options', () => {
  const plan = fixturePlan(); plan.report = { ...plan.report, format: 'both', includeAmount: false, splitByGroup: true };
  const items = saveAnalysis([], { name: '  월간 보고  ', period: 'fixed', result: { amount: 1234 }, question: 'secret' }, plan);
  assert.equal(items[0].name, '월간 보고');
  assert.deepEqual(Object.keys(items[0]).sort(), ['id', 'revision', 'name', 'period', 'plan', 'createdAt', 'updatedAt'].sort());
  assert.deepEqual(savedExecutionPlan(items[0], new Date('2027-02-03')), plan);
  assert.deepEqual(readSavedAnalyses({ version: 1, items }), items);
});
test('rolling month uses Korea boundary, shifts prior comparison and handles leap years', () => {
  const item = saveAnalysis([], { name: '월말', period: 'lastMonth' }, fixturePlan())[0];
  const january = savedExecutionPlan(item, new Date('2026-01-31T15:00:00Z'));
  assert.deepEqual(january.range, { startDate: '2026-01-01', endDate: '2026-01-31' });
  assert.deepEqual(january.comparison, { startDate: '2025-12-01', endDate: '2025-12-31' });
  assert.equal(savedExecutionPlan(item, new Date('2028-03-01T00:00:00Z')).range.endDate, '2028-02-29');
  item.period = 'thisMonth';
  assert.equal(savedExecutionPlan(item, new Date('2026-01-31T14:59:59Z')).range.startDate, '2026-01-01');
  assert.equal(savedExecutionPlan(item, new Date('2026-01-31T15:00:00Z')).range.startDate, '2026-02-01');
  assert.equal(savedExecutionPlan(item).report.title, item.plan.report.title);
});
test('rolling periods reject partial ranges, arbitrary comparisons and master search', () => {
  const plan = fixturePlan(); plan.range.startDate = '2026-08-02';
  assert.throws(() => saveAnalysis([], { name: '조건', period: 'lastMonth' }, plan));
  plan.range.startDate = '2026-08-01'; plan.comparison!.startDate = '2026-07-02';
  assert.throws(() => saveAnalysis([], { name: '조건', period: 'thisMonth' }, plan));
  plan.operation = 'search'; plan.comparison = null;
  assert.throws(() => saveAnalysis([], { name: '조건', period: 'lastMonth' }, plan));
  assert.equal(saveAnalysis([], { name: '검색', period: 'fixed' }, plan)[0].plan.operation, 'search');
  assert.equal(savedExecutionPlan(saveAnalysis([], { name: '대사', period: 'lastMonth' }, auditPlan())[0]).dataset, 'settlementAudit');
});
test('unresolved, export and clarification plans cannot be persisted as executable queries', () => {
  const plan = fixturePlan(); plan.filters = [{ entity: 'team', name: '동명', id: '' }];
  assert.throws(() => reusablePlan(plan));
  plan.filters = []; plan.operation = 'clarify'; assert.throws(() => reusablePlan(plan));
  plan.operation = 'export'; assert.throws(() => reusablePlan(plan));
});
test('updates preserve identity and detect stale revisions without exceeding bounded storage', () => {
  let items = saveAnalysis([], { name: '초안', period: 'fixed' }, fixturePlan(), new Date('2026-09-01'));
  const original = items[0];
  items = saveAnalysis(items, { id: original.id, revision: 1, name: '수정', period: 'lastMonth' }, fixturePlan(), new Date('2026-09-02'));
  assert.equal(items[0].revision, 2); assert.equal(items[0].createdAt, original.createdAt);
  assert.throws(() => findSavedAnalysis(items, original.id, 1));
  assert.throws(() => findSavedAnalysis(items, '../other-user', 2));
  while (items.length < 20) items = saveAnalysis(items, { name: '별도', period: 'fixed' }, fixturePlan());
  assert.throws(() => saveAnalysis(items, { name: '초과', period: 'fixed' }, fixturePlan()), /최대 20개/);
  assert.equal(saveAnalysis(items, { id: original.id, revision: 2, name: '수정2', period: 'fixed' }, fixturePlan()).length, 20);
});
test('corrupt versions, duplicate IDs and invalid names fail closed', () => {
  assert.deepEqual(readSavedAnalyses(undefined), []);
  assert.throws(() => readSavedAnalyses({ version: 2, items: [] }));
  const item = saveAnalysis([], { name: '분석', period: 'fixed' }, fixturePlan())[0];
  assert.throws(() => readSavedAnalyses({ version: 1, items: [item, item] }));
  for (const name of ['', 'a'.repeat(61), 'a\nb']) assert.throws(() => saveAnalysis([], { name, period: 'fixed' }, fixturePlan()));
});
