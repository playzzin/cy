const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { root, createClient, issue, seed, close, firestore: f } = require('./runtime.cjs');
const a = createClient('integration-a');
const b = createClient('integration-b');
const results = [];
const ref = id => f.doc(a.db, 'tax_invoice_issues', id);
const read = async id => (await f.getDocFromServer(ref(id))).data();

async function test(name, run) {
  await run();
  results.push({ name, passed: true });
  console.log(`PASS ${name}`);
}

async function conflict(operation, name, completed = 0) {
  await assert.rejects(operation, error => {
    assert.equal(error.name, 'IssueBatchWriteError');
    assert.equal(error.originalError.name, name);
    assert.equal(error.completedIds.length, completed);
    return true;
  });
}

async function main() {
  await test('concurrent edits to the same field preserve exactly one winner', async () => {
    const row = issue('race-save'); await seed(a.db, [row]);
    const outcomes = await Promise.allSettled([
      a.service.saveIssuesWithConflictCheck([{ id: row.id, data: { supplyAmount: 200 } }], [row]),
      b.service.saveIssuesWithConflictCheck([{ id: row.id, data: { supplyAmount: 300 } }], [row]),
    ]);
    assert.equal(outcomes.filter(r => r.status === 'fulfilled').length, 1);
    const rejected = outcomes.find(r => r.status === 'rejected').reason;
    assert.equal(rejected.originalError.name, 'IssueSaveConflictError');
    assert.ok([200, 300].includes((await read(row.id)).supplyAmount));
  });
  await test('concurrent edits to unrelated fields both persist', async () => {
    const row = issue('race-independent'); await seed(a.db, [row]);
    await Promise.all([
      a.service.saveIssuesWithConflictCheck([{ id: row.id, data: { supplyAmount: 200 } }], [row]),
      b.service.saveIssuesWithConflictCheck([{ id: row.id, data: { note: '다른 창 메모' } }], [row]),
    ]);
    const current = await read(row.id);
    assert.equal(current.supplyAmount, 200); assert.equal(current.note, '다른 창 메모');
  });
  await test('save versus deletion cannot silently erase a completed change', async () => {
    const row = issue('race-save-delete'); await seed(a.db, [row]);
    const outcomes = await Promise.allSettled([
      a.service.saveIssuesWithConflictCheck([{ id: row.id, data: { supplyAmount: 200 } }], [row]),
      b.service.deleteIssuesWithConflictCheck([row.id], [row]),
    ]);
    assert.equal(outcomes.filter(r => r.status === 'fulfilled').length, 1);
    const current = await read(row.id);
    if (outcomes[0].status === 'fulfilled') {
      assert.equal(current.supplyAmount, 200);
      assert.equal(outcomes[1].reason.originalError.name, 'IssueDeleteConflictError');
    } else { assert.equal(current, undefined); assert.equal(outcomes[0].reason.originalError.name, 'IssueSaveConflictError'); }
  });
  await test('a changed row aborts every deletion in its transaction', async () => {
    const rows = [issue('atomic-a'), issue('atomic-b')]; await seed(a.db, rows);
    await f.updateDoc(ref('atomic-b'), { scanCompleted: true });
    await conflict(() => b.service.deleteIssuesWithConflictCheck(rows.map(r => r.id), rows), 'IssueDeleteConflictError');
    assert.ok(await read('atomic-a')); assert.equal((await read('atomic-b')).scanCompleted, true);
  });
  await test('451-row partial save acknowledges 450 and retries the last row safely', async () => {
    const rows = Array.from({ length: 451 }, (_, i) => issue(`bulk-save-${i}`)); await seed(a.db, rows);
    await f.updateDoc(ref(rows[450].id), { supplyAmount: 300 });
    const updates = rows.map(r => ({ id: r.id, data: { supplyAmount: 200 } }));
    await conflict(() => b.service.saveIssuesWithConflictCheck(updates, rows), 'IssueSaveConflictError', 450);
    const current = await Promise.all(rows.map(r => read(r.id)));
    assert.ok(current.slice(0, 450).every(r => r.supplyAmount === 200)); assert.equal(current[450].supplyAmount, 300);
    await b.service.saveIssuesWithConflictCheck([updates[450]], [{ ...current[450], id: rows[450].id }]);
    assert.equal((await read(rows[450].id)).supplyAmount, 200);
  });
  await test('451-row partial deletion preserves the changed row for explicit retry', async () => {
    const rows = Array.from({ length: 451 }, (_, i) => issue(`bulk-delete-${i}`)); await seed(a.db, rows);
    await f.updateDoc(ref(rows[450].id), { note: '보존해야 하는 최신 내용' });
    await conflict(() => b.service.deleteIssuesWithConflictCheck(rows.map(r => r.id), rows), 'IssueDeleteConflictError', 450);
    const current = await Promise.all(rows.map(r => read(r.id)));
    assert.ok(current.slice(0, 450).every(r => r === undefined)); assert.equal(current[450].note, '보존해야 하는 최신 내용');
    await b.service.deleteIssuesWithConflictCheck([rows[450].id], [{ ...current[450], id: rows[450].id }]);
    assert.equal(await read(rows[450].id), undefined);
  });
  await test('offline save rejects without silently queuing a write; online retry succeeds', async () => {
    const row = issue('offline-save'); await seed(a.db, [row]);
    // disableNetwork only controls SDK streams; cut the actual TCP path for transactions.
    let online = false;
    const sockets = new Set();
    const proxy = net.createServer(socket => {
      if (!online) { socket.destroy(); return; }
      const upstream = net.connect(18086, '127.0.0.1');
      for (const connection of [socket, upstream]) {
        sockets.add(connection); connection.on('close', () => sockets.delete(connection));
        connection.on('error', () => { socket.destroy(); upstream.destroy(); });
      }
      socket.pipe(upstream).pipe(socket);
    });
    await new Promise(resolve => proxy.listen(0, '127.0.0.1', resolve));
    const offline = createClient('integration-offline', proxy.address().port);
    try {
      await assert.rejects(() => offline.service.saveIssuesWithConflictCheck([{ id: row.id, data: { note: '재시도 성공' } }], [row]), error => {
        assert.deepEqual(error.completedIds, []); return true;
      });
      assert.equal((await read(row.id)).note, '');
      online = true;
      await offline.service.saveIssuesWithConflictCheck([{ id: row.id, data: { note: '재시도 성공' } }], [row]);
      assert.equal((await read(row.id)).note, '재시도 성공');
    } finally { sockets.forEach(socket => socket.destroy()); proxy.close(); }
  });
  await test('offline renumbering rejects instead of persisting cached rows', async () => {
    const row = issue('offline-renumber', { yearMonth: '2081-02', no: 9 }); await seed(a.db, [row]);
    await b.service.getIssuesByMonth(row.yearMonth);
    await f.disableNetwork(b.db);
    try { await assert.rejects(() => b.service.renumberIssuesByMonth(row.yearMonth)); }
    finally { await f.enableNetwork(b.db); }
    assert.equal((await read(row.id)).no, 9);
    await b.service.renumberIssuesByMonth(row.yearMonth); assert.equal((await read(row.id)).no, 1);
  });
  await test('parallel carryover creates one document and preserves its later edits', async () => {
    const { id, ...data } = issue('carryover-source', { yearMonth: '2081-03', carriedFromYearMonth: '2081-02', carriedFromIssueId: 'source' });
    const outcomes = await Promise.all([a.service.importDeferredIssue(data), b.service.importDeferredIssue(data)]);
    assert.equal(outcomes.filter(r => r.created).length, 1); assert.equal(outcomes[0].issue.id, outcomes[1].issue.id);
    await f.updateDoc(ref(outcomes[0].issue.id), { note: '이월 후 편집' });
    const repeated = await b.service.importDeferredIssue(data);
    assert.equal(repeated.created, false); assert.equal(repeated.issue.note, '이월 후 편집');
    assert.equal((await a.service.getIssuesByMonth('2081-03')).length, 1);
  });
  await test('stored stale id cannot redirect renumbering to another document', async () => {
    const row = issue('real-document', { yearMonth: '2081-04', no: 8 }); await seed(a.db, [row]);
    await f.updateDoc(ref(row.id), { id: 'wrong-document' });
    const result = await b.service.renumberIssuesByMonth(row.yearMonth);
    assert.equal(result[0].id, row.id); assert.equal((await read(row.id)).no, 1); assert.equal(await read('wrong-document'), undefined);
  });
  const output = path.join(root, 'artifacts/audits/taxinvoice-emulator-results.json');
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify({ checkedAt: new Date().toISOString(), storage: 'loopback Firestore emulator', productionWrites: 0, results }, null, 2));
  console.log(`${results.length} emulator integration checks passed`);
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(close);
