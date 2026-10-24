import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { buildSettlementEvidence } from './settlementEvidence';
import { evidenceDocuments, evidencePlan, evidenceResult } from './settlementEvidenceFixtures';
import { buildSettlementResult } from './settlements';
import { settlementCatalog } from './settlementFixtures';
import { validatePlan } from './domain';
import { saveAnalysis, savedExecutionPlan } from './savedAnalyses';
const prepare = (docs = evidenceDocuments()) => buildSettlementEvidence(buildSettlementResult('test', evidencePlan(), docs, settlementCatalog()), docs, settlementCatalog());

test('evidence scope enforces full month, team identity and no period comparison; saved rerun preserves dataset', () => {
  assert.equal(validatePlan(evidencePlan()).dataset, 'settlementEvidence');
  for (const patch of [{ sortBy: 'amount' }, { groupBy: 'site' }, { operation: 'search' }, { comparison: evidencePlan().range }, { range: { startDate: '2026-08-02', endDate: '2026-08-31' } }]) assert.throws(() => validatePlan({ ...evidencePlan(), ...patch }));
  assert.equal(savedExecutionPlan(saveAnalysis([], { name: '근거 점검', period: 'lastMonth' }, evidencePlan())[0], new Date('2026-10-01')).dataset, 'settlementEvidence');
});
test('missing daily wages stay non-comparable; support uses stored amounts only without exposing worker evidence', () => {
  const result = evidenceResult();
  assert.deepEqual(result.evidence!.counts, { matched: 1, difference: 1, unavailable: 1, review: 0, noSettlement: 1, invalid: 0 });
  assert.equal(result.evidence!.absoluteDifference, 30000);
  const daily = result.evidence!.rows.find(row => row.category === '일보 금액')!;
  assert.equal(daily.evidenceCount, 1); assert.equal(daily.difference, null); assert.equal(daily.evidenceAmount, null);
  assert.equal(result.completeness, 'partial');
  assert.doesNotMatch(JSON.stringify(result), /반환 금지|private-worker/);
});
test('invalid, missing, future or legacy snapshot evidence never reports an all-clear', () => {
  for (const snapshot of [undefined, { version: 1, capturedAt: '2026-08-31' }, { ...evidenceDocuments()[0].data.sourceSnapshot, version: 3 }, { ...evidenceDocuments()[0].data.sourceSnapshot, capturedAt: 'invalid' }]) {
    const docs = evidenceDocuments(); docs[0].data.sourceSnapshot = snapshot;
    assert.equal(prepare(docs).evidence!.counts.matched, 0); assert.equal(prepare(docs).evidence!.absoluteDifference, 0);
  }
  const docs = evidenceDocuments(); docs[0].data.sourceSnapshot.capturedAt = '2026-09-02T00:00:00.000Z';
  assert.equal(prepare(docs).evidence!.counts.review, 1);
});
test('a malformed, out-of-month, impossible-date or duplicate support row invalidates whole support proof', () => {
  for (const patch of [{ amount: '270000' }, { amount: 1 }, { unitPrice: null }, { manDay: -1 }, { date: '2026-07-10' }, { date: '2026-08-32' }, { id: 'private-worker-reference-2' }]) {
    const docs = evidenceDocuments(); Object.assign(docs[0].data.sourceSnapshot.supportDetails[0], patch);
    const result = prepare(docs).evidence!; assert.equal(result.counts.invalid, 1); assert.equal(result.counts.matched, 0); assert.equal(result.absoluteDifference, 0);
  }
});
test('manual, overridden, ambiguous identity and section mismatch prevent automatic matching', () => {
  for (const patch of [{ source: 'manual' }, { amountOverridden: true }, { siteId: '' }, { counterTeamId: '' }, { origin: 'support_fee_outgoing' }, { origin: '내부지원온곳' }]) {
    const docs = evidenceDocuments(); Object.assign(docs[0].data.sales[0], patch);
    assert.equal(prepare(docs).evidence!.counts.review, 1); assert.equal(prepare(docs).evidence!.counts.matched, 0);
  }
  const docs = evidenceDocuments(); delete docs[0].data.sourceSnapshot.supportDetails[0].siteId;
  assert.equal(prepare(docs).evidence!.counts.review, 1);
  const manual = evidenceDocuments(); manual[0].data.sales.push({ id: 'manual-support', source: 'manual', kind: '지원', origin: 'manual', amount: 100 });
  assert.equal(prepare(manual).evidence!.counts.review, 1); assert.equal(prepare(manual).evidence!.counts.matched, 0);
});
test('missing link, duplicate group and changed man-days remain pending instead of amount differences', () => {
  for (const mutate of [(doc: any) => doc.sales.push({ ...doc.sales[0], id: 'duplicate' }), (doc: any) => { doc.sales = []; },
    (doc: any) => { doc.sales[0].manDay = 1; }, (doc: any) => doc.sourceSnapshot.supportDetails.splice(0, 1)]) {
    const docs = evidenceDocuments(); mutate(docs[0].data);
    assert.equal(prepare(docs).evidence!.counts.review, 1); assert.equal(prepare(docs).evidence!.counts.matched, 0);
  }
});
test('unconfirmed, corrupt and foreign settlement documents never supply snapshot evidence', () => {
  for (const patch of [{ confirmedAt: null }, { teamId: 'foreign' }, { deductions: [{ id: 'bad', amount: -1 }] }]) {
    const docs = evidenceDocuments(); Object.assign(docs[0].data, patch);
    assert.equal(prepare(docs).evidence!.counts.noSettlement, 2);
  }
  const docs = evidenceDocuments(); docs[0].data = JSON.stringify(docs[0].data);
  assert.equal(prepare(docs).evidence!.counts.matched, 1);
});
test('empty or excessive snapshots do not silently return complete comparisons', () => {
  const docs = evidenceDocuments(); docs[0].data.sales = []; docs[0].data.purchases = []; docs[0].data.sourceSnapshot.supportDetails = [];
  assert.equal(prepare(docs).evidence!.counts.unavailable, 2);
  docs[0].data.sourceSnapshot.supportDetails = Array(10001).fill({});
  assert.throws(() => prepare(docs), /10,000/);
});
