import { strict as assert } from 'assert';
import { test } from 'node:test';
import { validatePlan } from './domain';
import { settlementCatalog } from './settlementFixtures';
import { buildSettlementResult } from './settlements';
import { applyBillingReconciliation, billingAmount, reconciliationEntries } from './reconciliation';
import { auditDocument, auditPlan, auditResult, auditSources } from './reconciliationFixtures';
const prepare = (doc = auditDocument()) => {
  const result = buildSettlementResult('audit', auditPlan(), [doc], settlementCatalog());
  return { result, entries: reconciliationEntries(result, [doc]) };
};

test('audit validates a single full month, team scope and deterministic sorting', () => {
  assert.equal(validatePlan(auditPlan()).dataset, 'settlementAudit');
  for (const patch of [{ comparison: { startDate: '2026-07-01', endDate: '2026-07-31' } }, { sortBy: 'amount' }, { operation: 'search' }, { groupBy: 'site' }]) assert.throws(() => validatePlan({ ...auditPlan(), ...patch }));
});
test('audit separates match, difference and non-comparable rows without turning unavailable sources into zero', () => {
  const result = auditResult(), audit = result.reconciliation!;
  assert.deepEqual(audit.counts, { matched: 1, difference: 1, unconfirmed: 1, unavailable: 1, duplicate: 0, unsupported: 1, invalid: 0 });
  assert.equal(audit.absoluteDifference, 20000); assert.equal(audit.comparedSettledAmount, 150000); assert.equal(audit.comparedSourceAmount, 170000);
  assert.equal(audit.rows.find(row => row.status === 'unavailable')!.sourceAmount, null);
  assert.equal(result.completeness, 'partial'); assert.equal(JSON.stringify(result).includes('999999'), false);
});
test('foreign team, wrong month, worker recipient and contradictory nested identity expose no billing amounts', () => {
  for (const patch of [{ teamId: 't2' }, { yearMonth: '2026-09' }, { issuedToType: 'worker' }, { team: { id: 't2' }, teamId: 't1' }]) {
    const { result, entries } = prepare(), sources = auditSources();
    sources.set('cardBillings/card', { ...sources.get('cardBillings/card')!, ...patch, memo: 'forbidden-secret' });
    const output = applyBillingReconciliation(result, entries, sources, settlementCatalog());
    const row = output.reconciliation!.rows[0];
    assert.equal(row.status, 'unavailable'); assert.equal(row.sourceId, ''); assert.equal(row.sourceAmount, null); assert.equal(JSON.stringify(output).includes('forbidden-secret'), false);
  }
});
test('manual, ledger and unsafe IDs cannot become document reads', () => {
  const doc = auditDocument();
  doc.data.deductions = ['card_billing:2026-08:../secret', 'card_billing:2026-08:.', 'card_billing:2026-08:ledger:card', 'unrecognized'].map(id => ({ id, source: 'auto', origin: 'card_billing', amount: 1 }));
  doc.data.deductions.push({ id: 'card_billing:2026-08:manual', source: 'manual', origin: 'card_billing', amount: 1 });
  assert.ok(prepare(doc).entries.every(entry => !entry.referenceId));
});
test('duplicate source references exclude all copies from monetary comparison', () => {
  const doc = auditDocument(); doc.data.deductions.push({ ...doc.data.deductions[0], id: doc.data.deductions[0].id + ' ' });
  const { result, entries } = prepare(doc), output = applyBillingReconciliation(result, entries, auditSources(), settlementCatalog());
  assert.equal(output.reconciliation!.counts.duplicate, 2); assert.equal(output.reconciliation!.counts.difference, 0); assert.equal(output.reconciliation!.absoluteDifference, 0);
});
test('billing formulas honor lines, vehicle fallback, JSON storage and cancelled accommodation items', () => {
  assert.equal(billingAmount({ id: 'x', lineItems: JSON.stringify([{ amount: 70000 }, { amount: -20000 }]), totalAmount: 999999 }, 'card_billing'), 50000);
  assert.equal(billingAmount({ id: 'x', lineItems: [], fixedCost: 30000, variableCost: 15000, totalAmount: 999999 }, 'vehicle_billing'), 45000);
  assert.equal(billingAmount({ id: 'x', lineItems: [], totalAmount: 100 }, 'card_billing'), 100);
  assert.equal(billingAmount(auditSources().get('accommodation_billing_documents/room')!, 'accommodation_billing'), 100000);
  for (const source of [{ lineItems: [{ amount: '100' }] }, { lineItems: [{ amount: NaN }] }, { lineItems: 'broken' }, { lineItems: [{ id: 'x', amount: 1 }, { id: 'x', amount: 2 }] }]) assert.throws(() => billingAmount({ id: 'bad', ...source }, 'card_billing'));
});
test('malformed current bills are distinct from difference or zero and tiny differences stay differences', () => {
  const { result, entries } = prepare(), sources = auditSources();
  sources.get('cardBillings/card')!.lineItems = [{ amount: '70000' }];
  assert.equal(applyBillingReconciliation(result, entries, sources, settlementCatalog()).reconciliation!.counts.invalid, 1);
  entries[0].settledAmount = 69999.999;
  assert.equal(applyBillingReconciliation(result, entries, auditSources(), settlementCatalog()).reconciliation!.rows[0].status, 'difference');
});
test('unconfirmed, out-of-scope and malformed settlements never supply billing references', () => {
  for (const patch of [{ confirmedAt: null }, { teamId: 'other' }, { deductions: [{ id: 'bad', amount: -1 }] }]) {
    const doc = auditDocument(); Object.assign(doc.data, patch); assert.equal(prepare(doc).entries.length, 0);
  }
});
test('audit rejects more than 500 candidate deduction rows before reading sources', () => {
  const doc = auditDocument(); doc.data.deductions = Array.from({ length: 501 }, (_, n) => ({ id: `card_billing:2026-08:c${n}`, source: 'auto', origin: 'card_billing', amount: 1 }));
  assert.throws(() => prepare(doc), /500/);
});
test('audit team ordering follows the selected direction, not document read order', () => {
  const docs = [auditDocument('t1'), auditDocument('t2')]; docs[0].data.teamName = '하팀'; docs[1].data.teamName = '가팀';
  const plan = auditPlan();
  const sorted = () => reconciliationEntries(buildSettlementResult('sort', plan, docs, settlementCatalog()), docs);
  assert.equal(sorted()[0].teamName, '가팀'); plan.direction = 'desc'; assert.equal(sorted()[0].teamName, '하팀');
});
