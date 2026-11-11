// Explicit PDF-scoped recovery. Preparation is read-only; apply requires an
// encrypted plan and revalidates every amount in one Firestore transaction.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const assert = require('node:assert/strict');
const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const sum = rows => rows.reduce((total, row) => total + row.amount, 0);
const sources = row => [...new Set([row.evidenceUrl, ...(row.statementAttachmentPaths || [])].filter(Boolean))];

function buildRepair({ original, ledger, billings, sourceSha256, yearMonth, pdfTotal, pdfCount }) {
  assert.equal(original.length, pdfCount, 'source-row-count-changed');
  assert.equal(sum(original), pdfTotal, 'source-pdf-total-mismatch');
  assert(original.length && original.every(row => row.statementSourceSha256 === sourceSha256 && row.yearMonth === yearMonth
    && row.status === 'CANCELLED' && /^card-statement__.+__[a-f0-9]{40}$/.test(row.id)), 'source-not-a-converted-import');
  const cardIds = new Set(original.map(row => row.cardId));
  assert.equal(cardIds.size, 1, 'multiple-card-ledgers-require-review');
  const cardId = original[0].cardId;
  const allowedPaths = new Set(original.flatMap(sources));
  const byCategory = new Map();
  for (const row of original) {
    assert(Number.isSafeInteger(row.amount), 'invalid-source-amount');
    const group = byCategory.get(row.category) || { exact: 0, old: new Map() };
    group.exact += row.amount;
    // This reproduces the removed fallback precisely: date/merchant/category/amount.
    group.old.set([row.date, row.merchant, row.category, row.amount].map(value => String(value ?? '').trim()).join('|').toLocaleLowerCase('ko-KR'), row.amount);
    byCategory.set(row.category, group);
  }
  const active = ledger.filter(row => row.cardId === cardId && row.status !== 'CANCELLED' && !row.cancelledAt);
  assert.equal(active.length, byCategory.size, 'ledger-segments-require-review');
  const updates = [];
  const categories = new Map();
  for (const [category, group] of byCategory) {
    const rows = active.filter(row => row.category === category);
    assert.equal(rows.length, 1, 'ambiguous-ledger-category');
    const row = rows[0], before = [...group.old.values()].reduce((a, b) => a + b, 0), after = group.exact;
    assert(row.id.startsWith('card-ledger__') && row.yearMonth === yearMonth && sources(row).length
      && sources(row).every(value => allowedPaths.has(value)), 'ledger-source-changed');
    assert.equal(row.amount, before, 'ledger-no-longer-matches-bug');
    categories.set(category, { before, after });
    if (before !== after) updates.push({ path: `cardTransactions/${row.id}`, before: { amount: before }, after: { amount: after } });
  }
  const beforeTotal = sum(active);
  assert(pdfTotal > beforeTotal && updates.length, 'no-occurrence-loss');
  const linkedBills = billings.filter(row => row.cardId === cardId && row.status !== 'CANCELLED');
  assert.equal(linkedBills.length, 1, 'billing-count-requires-review');
  const billing = linkedBills[0];
  assert.equal(billing.status, 'DRAFT', 'posted-billing-protected');
  assert.equal(billing.yearMonth, yearMonth);
  assert.equal(billing.totalAmount, beforeTotal, 'billing-total-changed');
  assert.equal(billing.variableCost, beforeTotal, 'billing-variable-cost-changed');
  assert.equal(billing.lineItems.length, categories.size, 'billing-items-changed');
  assert.equal(new Set(billing.lineItems.map(item => item.category)).size, categories.size, 'duplicate-billing-category');
  const lineItems = billing.lineItems.map(item => {
    const amounts = categories.get(item.category);
    assert(amounts && item.sourceType === 'card_ledger' && item.sourceLedgerRowId, 'manual-billing-item-protected');
    assert.equal(item.amount, amounts.before, 'billing-line-changed');
    return { ...item, amount: amounts.after };
  });
  updates.push({ path: `cardBillings/${billing.id}`, before: { totalAmount: beforeTotal, variableCost: beforeTotal, lineItems: billing.lineItems },
    after: { totalAmount: pdfTotal, variableCost: pdfTotal, lineItems } });
  return { sourceSha256, yearMonth, pdfTotal, pdfCount, beforeTotal, afterTotal: pdfTotal, updates };
}

function protect(bytes, decrypt = false) {
  const method = decrypt ? 'Unprotect' : 'Protect';
  const result = cp.spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    `Add-Type -AssemblyName System.Security; $bytes=[Convert]::FromBase64String([Console]::In.ReadToEnd()); [Console]::Out.Write([Convert]::ToBase64String([Security.Cryptography.ProtectedData]::${method}($bytes,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)))`],
  { input: bytes.toString('base64'), encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, 0, 'plan-encryption-failed');
  return Buffer.from(result.stdout.trim(), 'base64');
}

async function readState(db, spec, transaction) {
  const read = query => transaction ? transaction.get(query) : query.get();
  const snapshot = await Promise.all([
    read(db.collection('cardTransactions').where('statementSourceSha256', '==', spec.sourceSha256)),
    read(db.collection('cardTransactions').where('yearMonth', '==', spec.yearMonth)),
    read(db.collection('cardBillings').where('yearMonth', '==', spec.yearMonth)),
  ]);
  const [original, ledger, billings] = snapshot.map(group => group.docs.map(doc => ({ ...doc.data(), id: doc.id })));
  return { ...spec, original, ledger, billings };
}

async function main([mode, planPath, ...pdfPaths]) {
  assert(['prepare', 'apply', 'verify'].includes(mode) && planPath, 'usage: prepare PLAN PDF... | apply PLAN | verify PLAN');
  const admin = require('../functions/node_modules/firebase-admin');
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||= path.join(process.env.APPDATA, 'gcloud/application_default_credentials.json');
  const projectId = JSON.parse(fs.readFileSync(path.join(__dirname, '../.firebaserc'))).projects.default;
  const app = admin.initializeApp({ projectId });
  try {
    const db = app.firestore();
    let plan;
    if (mode === 'prepare') {
      assert(pdfPaths.length && pdfPaths.length <= 10, 'specify-target-pdfs');
      const { analyzeKbApprovalPdf } = require('../functions/lib/kbApprovalStatement');
      plan = { projectId, operationId: `pdf-occurrence-repair-${crypto.randomUUID()}`, records: [] };
      for (const filename of pdfPaths) {
        const bytes = fs.readFileSync(filename), parsed = await analyzeKbApprovalPdf(bytes);
        assert(parsed, 'pdf-not-verified');
        const spec = { sourceSha256: crypto.createHash('sha256').update(bytes).digest('hex'), yearMonth: parsed.statementMonth,
          pdfTotal: parsed.grandTotalAmount, pdfCount: parsed.cards.reduce((count, card) => count + card.transactions.length, 0) };
        plan.records.push(buildRepair(await readState(db, spec)));
      }
      assert.equal(new Set(plan.records.flatMap(record => record.updates.map(update => update.path))).size,
        plan.records.flatMap(record => record.updates).length, 'overlapping-repair-targets');
      fs.writeFileSync(planPath, protect(Buffer.from(JSON.stringify(plan))), { flag: 'wx' });
      assert.equal(hash(JSON.parse(protect(fs.readFileSync(planPath), true).toString())), hash(plan), 'encrypted-plan-roundtrip');
    } else {
      assert.equal(pdfPaths.length, 0, 'unexpected-arguments');
      plan = JSON.parse(protect(fs.readFileSync(planPath), true).toString());
      assert.equal(plan.projectId, projectId, 'project-mismatch');
      if (mode === 'apply') await db.runTransaction(async transaction => {
        const auditRef = db.collection('cardStatementOccurrenceRepairs').doc(plan.operationId);
        const previous = await transaction.get(auditRef);
        if (previous.exists) { assert.equal(previous.data().planHash, hash(plan)); return; }
        const current = [];
        for (const spec of plan.records) current.push(buildRepair(await readState(db, spec, transaction)));
        assert.equal(hash(current), hash(plan.records), 'source-or-ledger-changed-since-prepare');
        const now = admin.firestore.FieldValue.serverTimestamp();
        current.forEach((record, index) => {
          record.updates.forEach(update => transaction.update(db.doc(update.path), { ...update.after, updatedAt: now }));
          const billing = record.updates.find(update => update.path.startsWith('cardBillings/'));
          transaction.set(db.collection('card_billing_logs').doc(`${plan.operationId}-${index}`), {
            action: 'updated', actionLabel: '수정', billingId: billing.path.split('/')[1], yearMonth: record.yearMonth,
            source: 'PDF 거래 중복 제거 오류 복구', actor: { uid: 'system:pdf-occurrence-repair', name: 'PDF 금액 복구' },
            before: { totalAmount: record.beforeTotal }, after: { totalAmount: record.afterTotal },
            fieldChanges: [{ field: 'totalAmount', label: '총 청구액', before: record.beforeTotal, after: record.afterTotal }],
            lineItemChanges: { added: [], removed: [], updated: [] }, changeCount: 1,
            summaryLines: ['별도 승인 거래의 잘못된 중복 제거로 누락된 금액을 원본 PDF와 대사하여 복구했습니다.'],
            summaryText: 'PDF 원본 대사에 따른 반복 결제 금액 복구', createdAt: now, createdAtIso: new Date().toISOString(),
          });
        });
        transaction.set(auditRef, { planHash: hash(plan), records: current, appliedAt: now });
      });
      for (const record of plan.records) for (const update of record.updates) {
        const current = (await db.doc(update.path).get()).data();
        for (const key of Object.keys(update.after)) assert.deepEqual(current[key], update.after[key], 'readback-mismatch');
      }
    }
    console.log(JSON.stringify({ mode, files: plan.records.length, writes: plan.records.reduce((count, record) => count + record.updates.length, 0),
      amounts: plan.records.map(record => ({ before: record.beforeTotal, after: record.afterTotal, restored: record.afterTotal - record.beforeTotal })) }));
  } finally { await app.delete(); }
}

module.exports = { buildRepair };
if (require.main === module) main(process.argv.slice(2)).catch(error => { console.error('복구 중단:', error.code || error.message); process.exitCode = 1; });
