import { strict as assert } from 'assert';
import { test } from 'node:test';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { analyzeReports, buildResult, percentage, resolveFilters, searchCatalog, validatePlan, validateRange } from './domain';
import { fixtureCatalog, fixturePlan, fixtureReports } from './fixtures';

test('separate browser/server builds use the same contract', () => {
  assert.equal(readFileSync(resolve(__dirname, '../../../src/features/ai-workspace/contract.ts'), 'utf8').replace(/\r\n/g, '\n'),
    readFileSync(resolve(__dirname, '../../src/aiWorkspace/contract.ts'), 'utf8').replace(/\r\n/g, '\n'));
});

test('aggregation itself rejects an unresolved filter instead of returning everything', () => {
  const plan = fixturePlan(); plan.filters = [{ entity: 'worker', name: 'unavailable', id: 'not-allowed' }];
  assert.throws(() => analyzeReports(plan, fixtureReports(), fixtureCatalog()), /다시 선택/);
});

test('aggregate overflow cannot become a plausible rounded monetary result', () => {
  const reports = fixtureReports(); reports[0].workers.forEach((worker: any) => { worker.manDay = 1; worker.unitPrice = Number.MAX_SAFE_INTEGER; });
  assert.throws(() => analyzeReports(fixturePlan(), reports, fixtureCatalog()), /수치 범위/);
});
test('dates reject overflow, reversed and unbounded ranges while allowing leap day', () => {
  for (const range of [{ startDate: '2026-02-30', endDate: '2026-03-01' }, { startDate: '2026-09-02', endDate: '2026-09-01' }, { startDate: '2020-01-01', endDate: '2026-01-01' }]) assert.throws(() => validateRange(range));
  assert.equal(validateRange({ startDate: '2024-02-29', endDate: '2024-03-01' }).startDate, '2024-02-29');
});
test('untrusted plans cannot inject collections, queries, arbitrary tools or unsupported filters', () => {
  const base = fixturePlan();
  for (const patch of [{ collection: 'users' }, { operation: 'delete' }, { groupBy: '__proto__' }, { missingAccount: true }, { filters: [{ entity: 'worker', id: '../users', name: '' }] }]) assert.throws(() => validatePlan({ ...base, ...patch }));
  assert.deepEqual(validatePlan(base), base);
});
test('same-name workers are counted by ID and report snapshot totals are recomputed', () => {
  const reports = fixtureReports(); reports[0].totalAmount = 9999999;
  const result = analyzeReports(fixturePlan(), reports, fixtureCatalog());
  assert.deepEqual(result.totals, { manDay: 1.5, amount: 320000, workers: 2, reports: 1 });
  assert.equal(result.completeness, 'complete');
});
test('comparison includes groups present only in the previous period and zero base is explicit', () => {
  const result = analyzeReports(fixturePlan(), fixtureReports(), fixtureCatalog());
  assert.equal(result.rows.find(row => row.id === 's1')?.manDayChangePercent, null);
  assert.equal(result.rows.find(row => row.id === 's2')?.manDayChangePercent, -100);
  assert.equal(percentage(0, 0), null);
  assert.deepEqual(result.previousTotals, { manDay: 1, amount: 240000, workers: 1, reports: 1 });
});
test('responsible-team history and worker team are independent grouping/filtering dimensions', () => {
  const plan = fixturePlan(); plan.groupBy = 'responsibleTeam'; plan.comparison = null;
  const result = analyzeReports(plan, fixtureReports(), fixtureCatalog());
  assert.equal(result.rows[0].id, 't1'); assert.equal(result.rows[0].name, '당시 1팀');
  plan.groupBy = 'workerTeam'; plan.filters = [{ entity: 'team', name: '1팀', id: 't1' }];
  assert.deepEqual(analyzeReports(plan, fixtureReports(), fixtureCatalog()).totals, { manDay: 1, amount: 200000, workers: 1, reports: 1 });
});
test('overlapping ranges do not duplicate fetched reports or aggregate totals', () => {
  const plan = fixturePlan(); plan.comparison = plan.range;
  const reports = fixtureReports();
  const result = analyzeReports(plan, [...reports, reports[0]], fixtureCatalog());
  assert.equal(result.totals.manDay, 1.5); assert.deepEqual(result.previousTotals, result.totals);
});
test('malformed and duplicate worker rows make incompleteness visible', () => {
  const reports = fixtureReports(); reports[0].workers.push(reports[0].workers[0], { workerId: 'bad', manDay: NaN, unitPrice: 100 });
  const result = analyzeReports(fixturePlan(), reports, fixtureCatalog());
  assert.equal(result.completeness, 'partial'); assert.equal(result.warnings.length, 2);
  assert.equal(result.totals.amount, 320000);
});
test('empty data is a successful zero result rather than a failed query', () => {
  const result = buildResult('empty', fixturePlan(), [], fixtureCatalog());
  assert.equal(result.completeness, 'complete'); assert.equal(result.totals.manDay, 0); assert.equal(result.rows.length, 0);
});
test('ambiguous names require selection and never select the first candidate', () => {
  const plan = fixturePlan(); plan.filters = [{ entity: 'worker', name: '동명', id: '' }];
  const result = resolveFilters(plan, fixtureCatalog());
  assert.equal(result.choices.length, 2); assert.equal(result.plan.filters[0].id, '');
  plan.filters[0].id = 'w2'; assert.equal(resolveFilters(plan, fixtureCatalog()).plan.filters[0].id, 'w2');
});
test('an unavailable or unauthorized target never falls back to an unfiltered query', () => {
  const plan = fixturePlan(); plan.filters = [{ entity: 'worker', name: '다른팀', id: 'not-visible' }];
  const resolved = resolveFilters(plan, fixtureCatalog());
  assert.ok(resolved.message); assert.equal(resolved.choices.length, 0);
});
test('search returns only safe projections and cannot silently ignore unsupported joins', () => {
  const plan = fixturePlan(); plan.operation = 'search'; plan.comparison = null; plan.missingAccount = true;
  const catalog = fixtureCatalog(); catalog.worker[0].idNumber = 'synthetic-private';
  assert.deepEqual(searchCatalog(plan, catalog).map(row => row.id), ['w1']);
  assert.equal(JSON.stringify(searchCatalog(plan, catalog)).includes('synthetic-private'), false);
  plan.entity = 'team'; plan.filters = [{ entity: 'site', name: 'A현장', id: 's1' }];
  assert.throws(() => searchCatalog(plan, catalog));
});
test('redacted account metadata is not reported as a missing account', () => {
  const plan = fixturePlan(); plan.operation = 'search'; plan.comparison = null; plan.entity = 'company';
  const catalog = fixtureCatalog(); catalog.company = [{ id: 'c1', name: '가상회사', _accountVisibility: false }];
  assert.equal(searchCatalog(plan, catalog)[0].accountRegistered, null);
  plan.missingAccount = true; assert.throws(() => searchCatalog(plan, catalog));
});
