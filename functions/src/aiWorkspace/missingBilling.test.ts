import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { validatePlan } from './domain';
import { billOwner, buildMissingBillingResult, missingTeams } from './missingBilling';
import { missingBills, missingDocuments, missingPlan, missingResult } from './missingBillingFixtures';
import { settlementCatalog } from './settlementFixtures';
import { buildSettlementResult } from './settlements';
import { saveAnalysis, savedExecutionPlan } from './savedAnalyses';
const prepare = (docs = missingDocuments(), bills = missingBills()) => buildMissingBillingResult(buildSettlementResult('missing', missingPlan(), docs, settlementCatalog()), docs, bills, settlementCatalog());

test('missing bill plans enforce one full month, team scope, supported start month and saved rerun', () => {
  assert.equal(validatePlan(missingPlan()).dataset, 'settlementMissing');
  for (const patch of [{ operation: 'search' }, { sortBy: 'amount' }, { groupBy: 'site' }, { range: { startDate: '2026-08-02', endDate: '2026-08-31' } },
    { range: { startDate: '2025-12-01', endDate: '2025-12-31' } }, { comparison: { startDate: '2026-07-01', endDate: '2026-07-31' } }]) assert.throws(() => validatePlan({ ...missingPlan(), ...patch }));
  assert.match(readFileSync(resolve(__dirname, '../../../src/utils/supportBillingPeriod.ts'), 'utf8'), /DEFAULT_SUPPORT_BILLING_START_DATE = '2026-01-01'/);
  assert.equal(savedExecutionPlan(saveAnalysis([], { name: '누락 점검', period: 'lastMonth' }, missingPlan())[0], new Date('2026-10-01')).range.startDate, '2026-09-01');
});
test('linked IDs, candidates, ambiguity, missing settlement, malformed amounts and zero remain separate', () => {
  const result = missingResult(), data = result.missingBilling!;
  assert.deepEqual(data.counts, { linked: 1, candidate: 2, review: 1, noSettlement: 1, invalid: 1, zero: 1 });
  assert.equal(data.candidateAmount, 130000); assert.equal(data.teams.filter(team => team.confirmed).length, 1);
  assert.equal(data.rows.find(row => row.status === 'invalid')!.sourceAmount, null);
  assert.deepEqual(data.rows.find(row => row.status === 'linked')!.lineIds, ['card_billing:2026-08:linked-card']);
  assert.equal(result.completeness, 'partial'); assert.equal(JSON.stringify(result.missingBilling).includes('반환 금지'), false);
});
test('no valid confirmed settlement means no omission conclusion, even when bills are present', () => {
  for (const patch of [{ confirmedAt: null }, { deductions: [{ id: 'bad', amount: -1 }] }, { teamId: 'foreign' }]) {
    const docs = missingDocuments(); Object.assign(docs[0].data, patch);
    const result = prepare(docs); assert.equal(result.missingBilling!.counts.candidate, 0);
    assert.ok(result.missingBilling!.teams.every(team => !team.confirmed));
  }
  const empty = prepare([], []); assert.equal(empty.completeness, 'partial'); assert.equal(empty.missingBilling!.teams.length, 2);
});
test('manual unknown deductions suppress candidates across categories; known manual category suppresses only its category', () => {
  const docs = missingDocuments(); docs[0].data.deductions.push({ id: 'manual', source: 'manual', origin: 'manual', amount: 1 });
  assert.equal(prepare(docs).missingBilling!.counts.candidate, 0);
  docs[0].data.deductions[2].origin = 'card_billing';
  const value = prepare(docs).missingBilling!; assert.equal(value.counts.candidate, 1); assert.equal(value.candidateAmount, 40000);
});
test('same-asset and unknown-asset documents are reviewed instead of double counted as missing', () => {
  const bills = missingBills(); bills.push({ ...bills[1], source: { ...bills[1].source, id: 'new-card__row_duplicate' } });
  const data = prepare(undefined, bills).missingBilling!; assert.equal(data.counts.candidate, 1); assert.equal(data.candidateAmount, 40000);
  delete bills[1].source.cardId;
  assert.equal(prepare(undefined, bills).missingBilling!.candidateAmount, 40000);
});
test('other month, conflicting nested team, personal recipient and name-only bills never enter results', () => {
  for (const patch of [{ yearMonth: '2026-07' }, { team: { id: 'foreign' } }, { issuedToType: 'worker' }, { teamId: '', teamName: '1팀' }]) {
    const bills = missingBills(); Object.assign(bills[1].source, patch, { memo: 'secret' });
    const value = prepare(undefined, bills).missingBilling!; assert.equal(value.rows.some(row => row.sourceId === 'new-card'), false); assert.equal(JSON.stringify(value).includes('secret'), false);
  }
  const teams = settlementCatalog().team; teams[1].legacyId = 't1'; assert.equal(billOwner(missingBills()[0].source, teams, '2026-08'), null);
});
test('drafts and duplicate reads are excluded, legacy team IDs and localized posted status remain supported', () => {
  const bills = missingBills(); bills.push(bills[0]); bills[1].source.teamId = 'old-t1';
  assert.equal(prepare(undefined, bills).missingBilling!.rows.length, 7);
  bills[1].source.status = 'DRAFT'; assert.equal(prepare(undefined, bills).missingBilling!.candidateAmount, 40000);
  assert.equal(prepare().missingBilling!.counts.zero, 1);
});
test('query limits fail instead of silently returning a truncated all-clear', () => {
  const catalog = settlementCatalog(); catalog.team = Array.from({ length: 51 }, (_, i) => ({ id: `team${i}`, name: '팀' }));
  assert.throws(() => missingTeams(missingPlan(), catalog), /50/);
  const bill = missingBills()[1]; const bills = Array.from({ length: 501 }, (_, i) => ({ ...bill, source: { ...bill.source, id: `bill${i}` } }));
  assert.throws(() => prepare(undefined, bills), /500/);
});
test('missing bill query indexes exist for each supported identity field', () => {
  const { indexes } = JSON.parse(readFileSync(resolve(__dirname, '../../../firestore.indexes.json'), 'utf8'));
  for (const collection of ['cardBillings', 'accommodation_billing_documents', 'vehicle_billing_documents']) for (const field of ['team.id', 'teamId', 'assignedTeamId'])
    assert.ok(indexes.some((index: any) => index.collectionGroup === collection && index.queryScope === 'COLLECTION' && index.fields.some((entry: any) => entry.fieldPath === field) && index.fields.some((entry: any) => entry.fieldPath === 'yearMonth')));
});
