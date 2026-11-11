const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildRepair } = require('./card-statement-occurrence-repair.cjs');
function fixture() {
  const common = { cardId: 'card', yearMonth: '2026-10', date: '2026-10-01', merchant: 'synthetic', category: 'OTHER', amount: 6000,
    statementSourceSha256: 'c'.repeat(64), status: 'CANCELLED', evidenceUrl: 'source.pdf' };
  return { sourceSha256: common.statementSourceSha256, yearMonth: common.yearMonth, pdfTotal: 12000, pdfCount: 2,
    original: ['a', 'b'].map(letter => ({ ...common, id: `card-statement__2026-10__card__${letter.repeat(40)}` })),
    ledger: [{ ...common, id: 'card-ledger__row', status: 'ACTIVE' }],
    billings: [{ id: 'bill', cardId: 'card', yearMonth: '2026-10', status: 'DRAFT', totalAmount: 6000, variableCost: 6000,
      lineItems: [{ category: 'OTHER', amount: 6000, sourceType: 'card_ledger', sourceLedgerRowId: 'row' }] }] };
}
test('plans only the lost occurrence and draft amounts without mutating input', () => {
  const input = fixture(), before = JSON.stringify(input), repair = buildRepair(input);
  assert.equal(JSON.stringify(input), before);
  assert.equal(repair.beforeTotal, 6000); assert.equal(repair.afterTotal, 12000);
  assert.equal(repair.updates.length, 2); assert.deepEqual(repair.updates[0].after, { amount: 12000 });
  assert.equal(repair.updates[1].after.lineItems[0].amount, 12000);
});
test('manual edits, posted bills, partial sources, mixed attachments and ambiguous splits are protected', () => {
  const mutations = [
    input => { input.ledger[0].amount = 5000; }, input => { input.billings[0].status = 'CONFIRMED'; },
    input => { input.billings[0].lineItems[0].sourceType = 'manual'; }, input => { input.original.pop(); },
    input => { input.ledger[0].statementAttachmentPaths = ['another.pdf']; }, input => { input.ledger.push({ ...input.ledger[0], id: 'card-ledger__second' }); },
    input => { input.original[0].status = 'ACTIVE'; }, input => { input.pdfTotal = 15000; },
  ];
  for (const mutate of mutations) { const input = fixture(); mutate(input); assert.throws(() => buildRepair(input)); }
});
