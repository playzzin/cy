// Synthetic data only. Refuse to run against any live project.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { initializeApp, deleteApp } from 'firebase/app';
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, doc, getDocFromServer, setDoc, setLogLevel } from 'firebase/firestore';
const projectId = process.env.GCLOUD_PROJECT || '';
assert.ok(projectId.startsWith('demo-') && process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST, 'Emulator-only test');
const require = createRequire(new URL('../functions/package.json', import.meta.url));
const admin = require('firebase-admin');
admin.initializeApp({ projectId });
const db = admin.firestore();
const { handleAiWorkspace, requireCurrentResult, applyExportPlan } = require('../functions/lib/aiWorkspace/index.js');
const { fixturePlan, fixtureCatalog, fixtureReports } = require('../functions/lib/aiWorkspace/fixtures.js');
const { settlementPlan, settlementDocument } = require('../functions/lib/aiWorkspace/settlementFixtures.js');
const { auditPlan, auditDocument, auditSources } = require('../functions/lib/aiWorkspace/reconciliationFixtures.js');
const { missingPlan, missingDocuments, missingBills } = require('../functions/lib/aiWorkspace/missingBillingFixtures.js');
const apps = [];
setLogLevel('silent');
const client = async (name, role) => {
  const app = initializeApp({ apiKey: 'demo-key', projectId }, name); apps.push(app);
  const auth = getAuth(app); connectAuthEmulator(auth, 'http://' + process.env.FIREBASE_AUTH_EMULATOR_HOST, { disableWarnings: true });
  const { user } = await createUserWithEmailAndPassword(auth, name + '@example.test', 'test-only-password');
  await db.doc('users/' + user.uid).set({ role, status: 'active', position: role === 'admin' ? '관리자' : '팀장', linkedWorkerIds: role === 'admin' ? [] : ['w1'] });
  const firestore = getFirestore(app), [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
  connectFirestoreEmulator(firestore, host, Number(port));
  return { uid: user.uid, db: firestore, context: { auth: { uid: user.uid, token: { role: 'admin' } } } }; // intentionally stale claim
};
let count = 0;
const check = async (label, fn) => { await fn(); count++; console.log('PASS ' + label); };
const rejected = (promise, code = 'permission-denied') => assert.rejects(promise, error => error.code === code);
const snapshot = uid => db.doc('server_settings/ai_workspace/sessions/' + uid);
const analyze = (user, plan = fixturePlan(), extra = {}) => handleAiWorkspace({ action: 'analyze', question: '합성 자료 분석', plan, ...extra }, user.context);
const exportFile = (user, resultId, format = 'xlsx') => handleAiWorkspace({ action: 'export', resultId, format }, user.context);
try {
  await db.doc('server_settings/ai_workspace').set({ runtime: { version: 1, revision: 1, mode: 'on', pilotUids: [], schedulerEnabled: true } });
  const manager = await client('ai-manager', 'admin'), leader = await client('ai-leader', 'user'), stranger = await client('ai-stranger', 'user');
  const catalog = fixtureCatalog();
  await check('missing or stopped runtime and non-pilot accounts cannot call the server directly', async () => {
    const root = db.doc('server_settings/ai_workspace');
    await root.set({}); await rejected(analyze(manager), 'failed-precondition');
    await root.set({ runtime: { version: 1, revision: 1, mode: 'pilot', pilotUids: [manager.uid], schedulerEnabled: false } });
    await rejected(analyze(leader), 'failed-precondition');
    // Even an approved pilot still needs current business authorization.
    await db.doc('users/' + manager.uid).update({ status: 'suspended' }); await rejected(analyze(manager));
    await db.doc('users/' + manager.uid).update({ status: 'active' });
    await root.set({ runtime: { version: 1, revision: 1, mode: 'on', pilotUids: [], schedulerEnabled: true } });
  });
  for (const [entity, rows] of Object.entries(catalog)) for (const row of rows) {
    const collection = { worker: 'workers', team: 'teams', site: 'sites', company: 'companies' }[entity];
    await db.doc(collection + '/' + row.id).set({ ...row, ...(row.id === 'w1' ? { uid: leader.uid, role: '팀장', status: '재직' } : {}), ...(entity === 'team' ? { companyId: 'c1' } : {}) });
  }
  await db.doc('companies/c1').set({ name: '시험 회사', accountNumber: 'synthetic-hidden-account' });
  for (const row of fixtureReports()) await db.doc('daily_reports/' + row.id).set(row);
  // Out-of-range data must never be part of this result.
  await db.doc('daily_reports/outside').set({ ...fixtureReports()[0], date: '2020-01-01' });
  let adminResult, teamResult;
  await check('server aggregation reads bounded dates and authoritative values', async () => {
    adminResult = (await analyze(manager)).result;
    assert.equal(adminResult.totals.amount, 320000); assert.equal(adminResult.previousTotals.amount, 240000);
    assert.equal(adminResult.totals.reports, 1); assert.equal(adminResult.totals.workers, 2);
  });
  await check('stale administrator claim cannot expose another team or embedded worker', async () => {
    teamResult = (await analyze(leader)).result;
    assert.equal(teamResult.totals.amount, 200000);
    assert.deepEqual(teamResult.details.map(row => row.workerId), ['w1']);
    assert.equal(teamResult.previousTotals.amount, 0);
  });
  await check('account without its own active worker anchor is denied', async () => {
    await db.doc('users/' + stranger.uid).update({ linkedWorkerIds: [] });
    await rejected(analyze(stranger));
  });
  await check('client users including admins cannot read or forge server snapshots', async () => {
    const path = 'server_settings/ai_workspace/sessions/' + manager.uid;
    for (const user of [manager, leader]) {
      await rejected(getDocFromServer(doc(user.db, path)));
      await rejected(setDoc(doc(user.db, path), { result: { id: 'forged' } }));
    }
  });
  await check('another user cannot export a known result ID', async () => {
    await rejected(exportFile(leader, adminResult.id), 'failed-precondition');
  });
  await check('missing account search uses minimal fields and no masked-company false positives', async () => {
    const plan = fixturePlan(); plan.operation = 'search'; plan.comparison = null; plan.missingAccount = true;
    const value = (await analyze(leader, plan)).result;
    assert.equal(value.records.length, 1); assert.equal(value.records[0].accountRegistered, false);
    assert.equal(JSON.stringify(value).includes('synthetic-account'), false);
    plan.entity = 'company';
    await rejected(analyze(leader, plan), 'failed-precondition');
  });
  await check('ambiguous names prompt a choice; inaccessible IDs do not fall back to all data', async () => {
    const plan = fixturePlan(); plan.filters = [{ entity: 'worker', name: '동명', id: '' }];
    assert.equal((await analyze(manager, plan)).choices.length, 2);
    plan.filters[0].id = 'w2';
    const deniedTarget = await analyze(leader, plan);
    assert.equal(deniedTarget.status, 'clarification'); assert.equal(deniedTarget.result, undefined);
  });
  await check('output honors a saved result and supports formatting without querying again', async () => {
    const plan = structuredClone(adminResult.plan); plan.operation = 'export'; plan.report.includeAmount = false;
    const revised = await analyze(manager, plan, { previousId: adminResult.id });
    assert.equal(revised.result.id, adminResult.id); assert.equal(revised.result.plan.report.includeAmount, false);
    assert.match(revised.result.summary, /금액을 제외/); assert.doesNotMatch(revised.result.summary, /[\d,]+원/);
    const file = await exportFile(manager, adminResult.id);
    assert.ok(Buffer.from(file.base64, 'base64').subarray(0, 2).equals(Buffer.from('PK')));
    plan.range.startDate = '2026-08-02';
    assert.throws(() => applyExportPlan(adminResult, plan), error => error.code === 'invalid-argument');
  });
  await check('new result invalidates older result export', async () => {
    const newer = (await analyze(manager)).result;
    assert.notEqual(newer.id, adminResult.id);
    await rejected(exportFile(manager, adminResult.id), 'failed-precondition');
    adminResult = newer;
  });
  await check('confirmed settlements reuse team authorization and perform no source writes', async () => {
    const documents = [settlementDocument('t1'), settlementDocument('t2')];
    for (const row of documents) await db.doc('system_configs/' + row.id).set({ data: JSON.stringify(row.data) });
    const ref = db.doc('system_configs/' + documents[0].id), before = await ref.get();
    const own = (await analyze(leader, settlementPlan())).result;
    assert.deepEqual(own.settlement.rows.map(row => row.id), ['t1']); assert.equal(own.settlement.totals.net, 610000);
    const all = (await analyze(manager, settlementPlan())).result;
    assert.equal(all.settlement.totals.net, 1220000); assert.equal(all.settlement.totals.documents, 2);
    assert.equal((await ref.get()).updateTime.toMillis(), before.updateTime.toMillis());
    const forbidden = settlementPlan(); forbidden.filters = [{ entity: 'team', id: 't2', name: '2팀' }];
    assert.equal((await analyze(leader, forbidden)).status, 'clarification');
    const file = await exportFile(leader, own.id); assert.ok(file.base64.length > 0);
    // Keep later revocation assertions pointed at the latest admin snapshot.
    adminResult = all;
  });
  await check('billing audit verifies parent scope before child rows and never writes source documents', async () => {
    // Reset synthetic counters for this separate scenario; rate-limit behavior has its own test below.
    for (const user of [leader, manager]) await snapshot(user.uid).set({ requestCount: 0, windowStart: 0 }, { merge: true });
    for (const teamId of ['t1', 't2']) { const row = auditDocument(teamId); await db.doc('system_configs/' + row.id).set({ data: JSON.stringify(row.data) }); }
    for (const [path, row] of auditSources()) {
      const { lineItems, ...parent } = row;
      await db.doc(path).set(path.startsWith('accommodation_') ? parent : row);
      if (path.startsWith('accommodation_')) for (const line of lineItems) await db.doc('accommodation_billing_line_items/' + line.id).set({ ...line, billingDocument: { id: row.id } });
    }
    await db.doc('accommodation_billing_line_items/foreign-child').set({ amount: 987654321, billingDocumentId: 'room', billingDocument: { id: 'other-room' } });
    const sourceRef = db.doc('cardBillings/card'), before = await sourceRef.get();
    const own = (await analyze(leader, auditPlan())).result;
    assert.deepEqual([...new Set(own.reconciliation.rows.map(row => row.teamId))], ['t1']);
    assert.equal(own.reconciliation.absoluteDifference, 20000); assert.equal(own.reconciliation.counts.matched, 1);
    assert.equal(JSON.stringify(own).includes('987654321'), false);
    assert.equal((await sourceRef.get()).updateTime.toMillis(), before.updateTime.toMillis());
    adminResult = (await analyze(manager, auditPlan())).result;
    assert.equal(adminResult.reconciliation.rows.length, 10);
    await sourceRef.update({ teamId: 't2', lineItems: [{ amount: 987654321 }] });
    const forbidden = (await analyze(leader, auditPlan())).result;
    assert.equal(forbidden.reconciliation.rows[0].sourceAmount, null); assert.equal(forbidden.reconciliation.rows[0].sourceId, '');
    assert.equal(JSON.stringify(forbidden).includes('987654321'), false);
    await sourceRef.set(auditSources().get('cardBillings/card'));
  });
  await check('audit downloads preserve the saved comparison while reanalysis detects changed billing amounts', async () => {
    const own = (await analyze(leader, auditPlan())).result;
    await db.doc('cardBillings/card').update({ lineItems: [{ amount: 95000 }] });
    const file = await exportFile(leader, own.id), ExcelJS = require('exceljs'), book = new ExcelJS.Workbook();
    await book.xlsx.load(Buffer.from(file.base64, 'base64'));
    assert.equal(book.getWorksheet('분석 결과').getCell('F2').value, 20000);
    const fresh = (await analyze(leader, auditPlan())).result; assert.equal(fresh.reconciliation.absoluteDifference, 45000);
    await rejected(exportFile(manager, fresh.id), 'failed-precondition');
  });
  const billingCollections = { card_billing: 'cardBillings', accommodation_billing: 'accommodation_billing_documents', vehicle_billing: 'vehicle_billing_documents' };
  let missingSnapshot;
  await check('missing billing scan respects current team and month, nested parent identity, posted status and source immutability', async () => {
    for (const user of [manager, leader]) await snapshot(user.uid).set({ requestCount: 0, windowStart: 0 }, { merge: true });
    // This runner refuses non-demo projects; remove only synthetic billing fixtures from earlier scenarios.
    for (const collection of [...Object.values(billingCollections), 'accommodation_billing_line_items']) for (const doc of (await db.collection(collection).get()).docs) await doc.ref.delete();
    for (const source of missingDocuments()) await db.doc('system_configs/' + source.id).set({ data: JSON.stringify(source.data) });
    for (const { origin, source } of missingBills()) {
      const { lineItems, ...parent } = source;
      await db.doc(billingCollections[origin] + '/' + source.id).set(origin === 'accommodation_billing' ? parent : source);
      if (origin === 'accommodation_billing') for (const line of lineItems) await db.doc('accommodation_billing_line_items/' + line.id).set({ ...line, billingDocument: { id: source.id } });
    }
    const source = missingBills()[1].source;
    await db.doc('accommodation_billing_line_items/foreign-child').set({ amount: 987654321, billingDocumentId: 'room', billingDocument: { id: 'foreign-room' } });
    await db.doc('cardBillings/draft-only').set({ ...source, id: 'draft-only', status: 'DRAFT' });
    await db.doc('cardBillings/cancelled-only').set({ ...source, id: 'cancelled-only', status: 'CANCELLED' });
    await db.doc('cardBillings/foreign-parent').set({ ...source, teamId: 't1', team: { id: 't2' }, lineItems: [{ amount: 987654321 }] });
    await db.doc('cardBillings/worker-recipient').set({ ...source, issuedToType: 'worker', lineItems: [{ amount: 987654321 }] });
    const ref = db.doc('cardBillings/new-card'), before = await ref.get();
    missingSnapshot = (await analyze(leader, missingPlan())).result;
    const data = missingSnapshot.missingBilling;
    assert.equal(data.rows.length, 6); assert.equal(data.candidateAmount, 130000); assert.equal(data.excludedUnconfirmed, 2);
    assert.deepEqual(data.teams.map(team => team.id), ['t1']); assert.equal(data.teams[0].confirmed, true);
    assert.equal(JSON.stringify(data).includes('987654321'), false);
    assert.equal(data.rows.find(row => row.sourceId === 'room').sourceAmount, 100000);
    assert.equal((await ref.get()).updateTime.toMillis(), before.updateTime.toMillis());
    const all = (await analyze(manager, missingPlan())).result.missingBilling;
    assert.ok(all.teams.some(team => !team.confirmed)); assert.equal(all.counts.noSettlement, 2);
    const forbidden = missingPlan(); forbidden.filters = [{ entity: 'team', id: 't2', name: '2팀' }];
    assert.equal((await analyze(leader, forbidden)).status, 'clarification');
  });
  await check('saved missing-bill analysis rechecks live links while old downloads preserve the prior result', async () => {
    const saved = await handleAiWorkspace({ action: 'saved-save', resultId: missingSnapshot.id, name: '연결 점검', period: 'fixed' }, leader.context);
    const source = missingDocuments()[0]; source.data.deductions.push({ id: 'card_billing:2026-08:new-card', source: 'auto', origin: 'card_billing', amount: 90000 });
    await db.doc('system_configs/' + source.id).set({ data: JSON.stringify(source.data) });
    const oldFile = await exportFile(leader, missingSnapshot.id), ExcelJS = require('exceljs'), book = new ExcelJS.Workbook();
    await book.xlsx.load(Buffer.from(oldFile.base64, 'base64')); assert.equal(book.getWorksheet('요약').getCell('B12').value, 130000);
    const fresh = (await handleAiWorkspace({ action: 'saved-run', id: saved.items[0].id, revision: 1 }, leader.context)).result;
    assert.equal(fresh.missingBilling.candidateAmount, 40000); assert.equal(fresh.missingBilling.counts.linked, 2);
    await rejected(exportFile(manager, fresh.id), 'failed-precondition');
    await handleAiWorkspace({ action: 'saved-delete', id: saved.items[0].id, revision: 1 }, leader.context);
  });
  await check('large out-of-month scans are avoided and an in-scope overflow fails instead of claiming completeness', async () => {
    const template = missingBills()[1].source;
    for (let start = 0; start < 501; start += 200) {
      const batch = db.batch();
      for (let index = start; index < Math.min(start + 200, 501); index++) batch.set(db.doc('cardBillings/bound-' + index), { ...template, yearMonth: '2025-01' });
      await batch.commit();
    }
    assert.ok((await analyze(leader, missingPlan())).result.missingBilling.rows.length < 500);
    for (let start = 0; start < 501; start += 200) {
      const batch = db.batch();
      for (let index = start; index < Math.min(start + 200, 501); index++) batch.update(db.doc('cardBillings/bound-' + index), { yearMonth: '2026-08' });
      await batch.commit();
    }
    await rejected(analyze(leader, missingPlan()), 'resource-exhausted');
    assert.equal((await snapshot(leader.uid).get()).data().busyUntil, 0);
    await snapshot(leader.uid).set({ requestCount: 0, windowStart: 0 }, { merge: true });
  });
  await check('saved support evidence uses authorized snapshots and leaves sources unchanged', async () => {
    const { evidencePlan, evidenceDocuments } = require('../functions/lib/aiWorkspace/settlementEvidenceFixtures.js');
    for (const user of [manager, leader]) await snapshot(user.uid).set({ requestCount: 0, windowStart: 0 }, { merge: true });
    for (const source of evidenceDocuments()) await db.doc('system_configs/' + source.id).set({ data: JSON.stringify(source.data) });
    const ref = db.doc('system_configs/team_settlement_2026-08__t1'), before = await ref.get();
    const own = (await analyze(leader, evidencePlan())).result;
    assert.deepEqual([...new Set(own.evidence.rows.map(row => row.teamId))], ['t1']);
    assert.equal(own.evidence.absoluteDifference, 30000); assert.equal(own.evidence.counts.unavailable, 1);
    assert.doesNotMatch(JSON.stringify(own), /private-worker|반환 금지/);
    assert.ok((await ref.get()).updateTime.isEqual(before.updateTime));
    const forbidden = evidencePlan(); forbidden.filters = [{ entity: 'team', id: 't2', name: '2팀' }];
    assert.equal((await analyze(leader, forbidden)).status, 'clarification');
    const all = (await analyze(manager, evidencePlan())).result;
    assert.equal(all.evidence.counts.noSettlement, 1);
  });
  await check('saved evidence rerun reloads proof while exporting prior result remains stable', async () => {
    const { evidencePlan, evidenceDocuments } = require('../functions/lib/aiWorkspace/settlementEvidenceFixtures.js');
    const current = (await analyze(leader, evidencePlan())).result;
    const saved = (await handleAiWorkspace({ action: 'saved-save', resultId: current.id, name: '근거 검증', period: 'fixed' }, leader.context)).items[0];
    const source = evidenceDocuments()[0]; source.data.purchases[0].amount = 180000;
    await db.doc('system_configs/' + source.id).set({ data: JSON.stringify(source.data) });
    const file = await exportFile(leader, current.id), ExcelJS = require('exceljs'), book = new ExcelJS.Workbook();
    await book.xlsx.load(Buffer.from(file.base64, 'base64')); assert.ok(JSON.stringify(book.model).includes('30000'));
    const fresh = (await handleAiWorkspace({ action: 'saved-run', id: saved.id, revision: saved.revision }, leader.context)).result;
    assert.equal(fresh.evidence.absoluteDifference, 0); assert.equal(fresh.evidence.counts.matched, 2);
    await handleAiWorkspace({ action: 'saved-delete', id: saved.id, revision: saved.revision }, leader.context);
    await snapshot(leader.uid).set({ requestCount: 0, windowStart: 0 }, { merge: true });
  });
  const savedStore = user => db.doc('server_settings/ai_workspace/saved_analyses/' + user.uid);
  const savedCall = (user, action, extra = {}) => handleAiWorkspace({ action, ...extra }, user.context);
  let savedAnalysis;
  await check('saved configuration is derived only from the current server result and never contains snapshot data', async () => {
    await snapshot(manager.uid).set({ requestCount: 0, windowStart: 0 }, { merge: true });
    const plan = fixturePlan(); plan.report = { ...plan.report, format: 'both', includeAmount: false, splitByGroup: true };
    adminResult = (await analyze(manager, plan)).result;
    const response = await savedCall(manager, 'saved-save', { resultId: adminResult.id, name: '월간 보고', period: 'fixed',
      plan: { operation: 'forged' }, result: { amount: 987654321 } });
    savedAnalysis = response.items[0];
    assert.deepEqual(savedAnalysis.plan, adminResult.plan);
    const stored = (await savedStore(manager).get()).data();
    assert.deepEqual(Object.keys(stored).sort(), ['items', 'version']);
    assert.equal(JSON.stringify(stored).includes('987654321'), false);
    assert.equal(stored.items[0].result, undefined); assert.equal(stored.items[0].question, undefined);
    await rejected(savedCall(manager, 'saved-save', { resultId: 'old-result', name: '실패', period: 'fixed' }), 'failed-precondition');
  });
  await check('saved lists are private and direct client reads or writes remain forbidden', async () => {
    assert.equal((await savedCall(leader, 'saved-list')).items.length, 0);
    for (const action of ['saved-run', 'saved-delete']) await rejected(savedCall(leader, action, { id: savedAnalysis.id, revision: 1 }), 'failed-precondition');
    await rejected(savedCall(leader, 'saved-save', { resultId: adminResult.id, name: '복제', period: 'fixed' }), 'failed-precondition');
    for (const user of [manager, leader]) {
      await rejected(getDocFromServer(doc(user.db, savedStore(manager).path)));
      await rejected(setDoc(doc(user.db, savedStore(manager).path), { version: 1, items: [] }));
    }
  });
  await check('saved rerun survives expired results, fetches changed data and preserves report settings without Gemini', async () => {
    await snapshot(manager.uid).update({ 'result.expiresAt': '2020-01-01T00:00:00Z' });
    const original = fixtureReports()[0];
    await db.doc('daily_reports/r1').update({ workers: original.workers.map(row => ({ ...row, manDay: row.manDay * 2 })) });
    const before = await db.doc('daily_reports/r1').get();
    const response = await savedCall(manager, 'saved-run', { id: savedAnalysis.id, revision: 1, previousId: 'expired', plan: { operation: 'forged' } });
    assert.equal(response.status, 'complete'); assert.notEqual(response.result.id, adminResult.id);
    assert.equal(response.result.totals.amount, 640000); assert.equal(response.result.plan.report.includeAmount, false);
    assert.equal(response.result.plan.report.format, 'both'); assert.equal(response.result.plan.report.splitByGroup, true);
    assert.equal((await db.doc('daily_reports/r1').get()).updateTime.toMillis(), before.updateTime.toMillis());
    await rejected(exportFile(manager, adminResult.id), 'failed-precondition');
    const file = await exportFile(manager, response.result.id); assert.ok(file.base64.length > 0);
    adminResult = response.result;
    await db.doc('daily_reports/r1').set(original);
  });
  await check('lost saved target or current team membership never broadens a rerun to all accessible records', async () => {
    await snapshot(leader.uid).set({ requestCount: 0, windowStart: 0 }, { merge: true });
    const plan = fixturePlan(); plan.groupBy = 'workerTeam'; plan.filters = [{ entity: 'team', id: 't1', name: '1팀' }];
    const own = (await analyze(leader, plan)).result;
    const item = (await savedCall(leader, 'saved-save', { resultId: own.id, name: '우리 팀', period: 'fixed' })).items[0];
    await db.doc('workers/w1').update({ teamId: 't2' });
    await rejected(savedCall(leader, 'saved-run', { id: item.id, revision: 1 }), 'failed-precondition');
    await db.doc('workers/w1').update({ teamId: 't1' });
    await db.doc('teams/t1').delete();
    await rejected(savedCall(leader, 'saved-run', { id: item.id, revision: 1 }), 'failed-precondition');
    await db.doc('teams/t1').set({ ...fixtureCatalog().team[0], companyId: 'c1' });
    assert.equal((await savedCall(leader, 'saved-run', { id: item.id, revision: 1 })).result.totals.amount, 200000);
  });
  await check('saved rerun recomputes current role scope and denies suspended accounts', async () => {
    // Admin saved an unfiltered plan; a later team role must execute only its current team scope.
    await db.doc('users/' + manager.uid).update({ role: 'user', position: '팀장', linkedWorkerIds: ['w1'] });
    await db.doc('workers/w1').update({ uid: manager.uid });
    const narrowed = (await savedCall(manager, 'saved-run', { id: savedAnalysis.id, revision: 1 })).result;
    assert.equal(narrowed.totals.amount, 200000); assert.deepEqual(narrowed.details.map(row => row.workerId), ['w1']);
    await db.doc('users/' + manager.uid).update({ status: 'suspended' });
    for (const action of ['saved-list', 'saved-run', 'saved-delete', 'saved-save']) await rejected(savedCall(manager, action, { id: savedAnalysis.id, revision: 1, resultId: narrowed.id, name: '차단', period: 'fixed' }));
    await db.doc('users/' + manager.uid).update({ role: 'admin', position: '관리자', linkedWorkerIds: [], status: 'active' });
    await db.doc('workers/w1').update({ uid: leader.uid });
    adminResult = (await analyze(manager)).result;
  });
  await check('concurrent saved updates detect stale revisions; deletion prevents further reruns', async () => {
    const attempts = await Promise.allSettled(['변경1', '변경2'].map(name => savedCall(manager, 'saved-save', { id: savedAnalysis.id, revision: 1,
      resultId: adminResult.id, name, period: 'fixed' })));
    assert.equal(attempts.filter(row => row.status === 'fulfilled').length, 1);
    assert.equal(attempts.find(row => row.status === 'rejected').reason.code, 'failed-precondition');
    await rejected(savedCall(manager, 'saved-run', { id: savedAnalysis.id, revision: 1 }), 'failed-precondition');
    await rejected(savedCall(manager, 'saved-delete', { id: savedAnalysis.id, revision: 1 }), 'failed-precondition');
    const latest = (await savedCall(manager, 'saved-list')).items[0]; assert.equal(latest.revision, 2);
    assert.equal((await savedCall(manager, 'saved-delete', { id: latest.id, revision: 2 })).items.length, 0);
    await rejected(savedCall(manager, 'saved-run', { id: latest.id, revision: 2 }), 'failed-precondition');
  });
  await check('saved reruns obey the same busy lease and per-minute limit as ordinary analysis', async () => {
    const item = (await savedCall(leader, 'saved-list')).items[0];
    await snapshot(leader.uid).set({ busyUntil: Date.now() + 60000 }, { merge: true });
    await rejected(savedCall(leader, 'saved-run', { id: item.id, revision: 1 }), 'already-exists');
    await snapshot(leader.uid).set({ busyUntil: 0, requestCount: 10, windowStart: Date.now() }, { merge: true });
    await rejected(savedCall(leader, 'saved-run', { id: item.id, revision: 1 }), 'resource-exhausted');
    await snapshot(leader.uid).set({ requestCount: 0, windowStart: 0 }, { merge: true });
  });

  const { savedCommandPlan } = require('../functions/lib/aiWorkspace/savedCommandFixtures.js');
  let commandItem;
  await check('natural saved lookup is private, does not rerun, and survives an expired displayed result', async () => {
    for (const user of [manager, leader]) await snapshot(user.uid).set({ requestCount: 0, windowStart: 0 }, { merge: true });
    const plan = fixturePlan(); plan.report.includeAmount = false; plan.report.format = 'xlsx';
    adminResult = (await analyze(manager, plan)).result;
    commandItem = (await savedCall(manager, 'saved-save', { resultId: adminResult.id, name: '월간 현장 보고', period: 'fixed' })).items[0];
    const beforeStore = await savedStore(manager).get(), beforeSource = await db.doc('daily_reports/r1').get();
    await snapshot(manager.uid).update({ 'result.expiresAt': '2020-01-01T00:00:00Z' });
    const found = await analyze(manager, savedCommandPlan('savedFind', '현장'), { previousId: adminResult.id });
    assert.equal(found.status, 'saved'); assert.deepEqual(found.savedMatches.items.map(row => row.id), [commandItem.id]);
    assert.equal((await snapshot(manager.uid).get()).data().result.id, adminResult.id);
    assert.ok((await savedStore(manager).get()).updateTime.isEqual(beforeStore.updateTime));
    assert.ok((await db.doc('daily_reports/r1').get()).updateTime.isEqual(beforeSource.updateTime));
    assert.equal((await analyze(leader, savedCommandPlan('savedFind', '월간 현장 보고'))).savedMatches.items.length, 0);
    await rejected(analyze(leader, savedCommandPlan('savedRun', '', true), { savedContextId: found.savedMatches.contextId }), 'failed-precondition');
  });
  await check('natural exact-name rerun reloads authorized data and preserves saved output choices', async () => {
    await snapshot(manager.uid).set({ requestCount: 0, windowStart: 0 }, { merge: true });
    const old = adminResult.id;
    const fresh = (await analyze(manager, savedCommandPlan('savedRun', '월간현장보고'), { previousId: old })).result;
    assert.notEqual(fresh.id, old); assert.equal(fresh.totals.amount, 320000); assert.equal(fresh.plan.report.includeAmount, false); assert.equal(fresh.plan.report.format, 'xlsx');
    assert.equal((await snapshot(manager.uid).get()).data().savedSelection, null);
    const file = await exportFile(manager, fresh.id), ExcelJS = require('exceljs'), book = new ExcelJS.Workbook();
    await book.xlsx.load(Buffer.from(file.base64, 'base64')); book.eachSheet(sheet => sheet.eachRow(row => row.eachCell(cell => assert.notEqual(cell.value, 320000))));
    adminResult = fresh;
    const found = await analyze(manager, savedCommandPlan('savedRun', '현장'));
    assert.equal(found.status, 'saved'); assert.equal((await snapshot(manager.uid).get()).data().result.id, fresh.id);
    const selected = (await analyze(manager, savedCommandPlan('savedRun', '', true), { savedContextId: found.savedMatches.contextId })).result;
    assert.notEqual(selected.id, fresh.id); adminResult = selected;
    await rejected(analyze(manager, savedCommandPlan('savedRun', '', true), { savedContextId: found.savedMatches.contextId }), 'failed-precondition');
  });
  await check('saved natural selection rejects expired, changed and superseded references and never guesses duplicate names', async () => {
    await snapshot(manager.uid).set({ requestCount: 0, windowStart: 0 }, { merge: true });
    const first = await analyze(manager, savedCommandPlan('savedFind', '현장'));
    const second = await analyze(manager, savedCommandPlan('savedFind', '현장'));
    await rejected(analyze(manager, savedCommandPlan('savedRun', '', true), { savedContextId: first.savedMatches.contextId }), 'failed-precondition');
    await snapshot(manager.uid).update({ 'savedSelection.expiresAt': '2020-01-01T00:00:00Z' });
    await rejected(analyze(manager, savedCommandPlan('savedRun', '', true), { savedContextId: second.savedMatches.contextId }), 'failed-precondition');
    const third = await analyze(manager, savedCommandPlan('savedFind', '현장'));
    commandItem = (await savedCall(manager, 'saved-save', { id: commandItem.id, revision: commandItem.revision, resultId: adminResult.id, name: commandItem.name, period: 'fixed' })).items[0];
    await rejected(analyze(manager, savedCommandPlan('savedRun', '', true), { savedContextId: third.savedMatches.contextId }), 'failed-precondition');
    const duplicates = await savedCall(manager, 'saved-save', { resultId: adminResult.id, name: commandItem.name, period: 'fixed' });
    const duplicate = duplicates.items.find(row => row.id !== commandItem.id);
    const choices = await analyze(manager, savedCommandPlan('savedRun', commandItem.name));
    assert.equal(choices.status, 'saved'); assert.equal(choices.savedMatches.items.length, 2);
    assert.equal((await snapshot(manager.uid).get()).data().result.id, adminResult.id);
    const ambiguous = await analyze(manager, savedCommandPlan('savedRun', '', true), { savedContextId: choices.savedMatches.contextId });
    assert.equal(ambiguous.status, 'saved'); assert.equal(ambiguous.savedMatches.items.length, 2);
    await savedCall(manager, 'saved-delete', { id: duplicate.id, revision: duplicate.revision });
  });
  await check('natural saved rerun rechecks current role and cannot execute an old selection after membership changes', async () => {
    await snapshot(manager.uid).set({ requestCount: 0, windowStart: 0 }, { merge: true });
    const found = await analyze(manager, savedCommandPlan('savedFind', '현장'));
    await db.doc('users/' + manager.uid).update({ role: 'user', position: '팀장', linkedWorkerIds: ['w1'] });
    await db.doc('workers/w1').update({ uid: manager.uid });
    await rejected(analyze(manager, savedCommandPlan('savedRun', '', true), { savedContextId: found.savedMatches.contextId }), 'failed-precondition');
    const narrowed = (await analyze(manager, savedCommandPlan('savedRun', commandItem.name))).result;
    assert.equal(narrowed.totals.amount, 200000); assert.deepEqual(narrowed.details.map(row => row.workerId), ['w1']);
    await db.doc('users/' + manager.uid).update({ role: 'admin', position: '관리자', linkedWorkerIds: [] });
    await db.doc('workers/w1').update({ uid: leader.uid });
    adminResult = (await analyze(manager)).result;
    await snapshot(leader.uid).set({ requestCount: 0, windowStart: 0 }, { merge: true });
  });
  await check('membership change revokes saved access even if custom claims remain admin', async () => {
    teamResult = (await analyze(leader)).result;
    await db.doc('workers/w1').update({ teamId: 't2' });
    await rejected(exportFile(leader, teamResult.id), 'failed-precondition');
  });
  await check('inactive account cannot retrieve an already generated snapshot', async () => {
    await db.doc('users/' + manager.uid).update({ status: 'suspended' });
    await rejected(exportFile(manager, adminResult.id));
    await db.doc('users/' + manager.uid).update({ status: 'active' });
  });
  await check('candidate names are withheld when runtime or account status changes during lookup', async () => {
    const data = require('../functions/lib/aiWorkspace/data.js'), original = data.loadCatalog;
    const plan = fixturePlan(); plan.filters = [{ entity: 'worker', name: '동명', id: '' }];
    for (const change of ['runtime', 'profile']) {
      await snapshot(manager.uid).set({ requestCount: 0, windowStart: 0 }, { merge: true });
      try {
        data.loadCatalog = async (...args) => {
          const catalog = await original(...args);
          if (change === 'runtime') await db.doc('server_settings/ai_workspace').update({ 'runtime.mode': 'off' });
          else await db.doc('users/' + manager.uid).update({ status: 'suspended' });
          return catalog;
        };
        await rejected(analyze(manager, plan), change === 'runtime' ? 'failed-precondition' : 'permission-denied');
        assert.equal((await snapshot(manager.uid).get()).data().busyUntil, 0);
      } finally {
        data.loadCatalog = original;
        await db.doc('server_settings/ai_workspace').update({ 'runtime.mode': 'on' });
        await db.doc('users/' + manager.uid).update({ status: 'active' });
      }
    }
  });
  await check('disabled Auth or a revised runtime revokes an existing interactive result', async () => {
    await admin.auth().updateUser(manager.uid, { disabled: true }); await rejected(exportFile(manager, adminResult.id));
    await admin.auth().updateUser(manager.uid, { disabled: false });
    await db.doc('server_settings/ai_workspace').update({ 'runtime.revision': 2 });
    await rejected(exportFile(manager, adminResult.id), 'failed-precondition');
    await db.doc('server_settings/ai_workspace').update({ 'runtime.revision': 1 });
  });
  await check('expiry, busy lease and request limit are enforced before generation', async () => {
    const saved = (await snapshot(manager.uid).get()).data();
    assert.throws(() => requireCurrentResult(saved, { hash: saved.accessHash }, adminResult.id, Date.parse(adminResult.expiresAt) + 1), error => error.code === 'failed-precondition');
    await snapshot(manager.uid).update({ busyUntil: Date.now() + 60000 });
    await rejected(analyze(manager), 'already-exists');
    await snapshot(manager.uid).update({ busyUntil: 0, windowStart: Date.now(), requestCount: 10 });
    await rejected(analyze(manager), 'resource-exhausted');
  });
  console.log(`AI workspace: ${count} emulator scenarios passed.`);
} finally { await Promise.all(apps.map(deleteApp)); await db.terminate(); }
