// Synthetic data only. Never point this test at a live project.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { initializeApp, deleteApp } from 'firebase/app';
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, doc, getDocFromServer, setDoc, setLogLevel } from 'firebase/firestore';
const projectId = process.env.GCLOUD_PROJECT || '';
assert.ok(projectId.startsWith('demo-') && process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST, 'Emulator-only test');
const require = createRequire(new URL('../functions/package.json', import.meta.url));
const admin = require('firebase-admin'); admin.initializeApp({ projectId });
const db = admin.firestore(), root = db.doc('server_settings/ai_workspace');
const { handleWorkspaceReports: handle, processReportSchedule: processSchedule, sweepWorkspaceReports: sweep } = require('../functions/lib/aiWorkspace/scheduledReports');
const { fixturePlan, fixtureReports, fixtureCatalog } = require('../functions/lib/aiWorkspace/fixtures');
const { saveAnalysis } = require('../functions/lib/aiWorkspace/savedAnalyses');
const execution = require('../functions/lib/aiWorkspace/execution');
const actualExecute = execution.executeWorkspacePlan;
const ExcelJS = require('exceljs');
const apps = []; setLogLevel('silent');
const client = async name => {
  const app = initializeApp({ apiKey: 'demo-key', projectId }, name); apps.push(app);
  const auth = getAuth(app); connectAuthEmulator(auth, 'http://' + process.env.FIREBASE_AUTH_EMULATOR_HOST, { disableWarnings: true });
  const { user } = await createUserWithEmailAndPassword(auth, `${name}@example.test`, 'test-only-password');
  await db.doc(`users/${user.uid}`).set({ role: 'admin', status: 'active', position: '관리자' });
  const firestore = getFirestore(app), [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
  connectFirestoreEmulator(firestore, host, Number(port));
  return { uid: user.uid, db: firestore, context: { auth: { uid: user.uid, token: {} } } };
};
const call = (user, action, data = {}) => handle({ action, ...data }, user.context);
const cadence = { frequency: 'daily', time: '09:00', weekday: null, monthDay: null };
const schedules = root.collection('ai_report_schedules'), runs = root.collection('ai_report_runs'), results = root.collection('ai_report_results');
const rejected = (value, code = 'permission-denied') => assert.rejects(value, error => error.code === code);
let count = 0;
const check = async (name, fn) => { try { await fn(); count++; console.log(`PASS ${name}`); } finally { execution.executeWorkspacePlan = actualExecute; } };
async function seed(user, period = 'fixed') {
  const items = saveAnalysis([], { name: '합성 월간 보고', period }, fixturePlan());
  await root.collection('saved_analyses').doc(user.uid).set({ version: 1, items }); return items[0];
}
async function create(user, item) { const view = await call(user, 'save', { savedId: item.id, savedRevision: item.revision, cadence }); return view.schedules[0]; }
async function due(schedule, at = new Date(Date.now() - 1000).toISOString()) { await schedules.doc(schedule.id).update({ nextRunAt: at }); return at; }
async function removeAll(user) { for (const item of (await call(user, 'list')).schedules) await call(user, 'delete', { id: item.id, revision: item.revision }); }
try {
  await root.set({ runtime: { version: 1, revision: 1, mode: 'on', pilotUids: [], schedulerEnabled: true } });
  const manager = await client('report-manager'), other = await client('report-other');
  for (const [entity, rows] of Object.entries(fixtureCatalog())) for (const row of rows)
    await db.doc(`${({ worker: 'workers', team: 'teams', site: 'sites', company: 'companies' })[entity]}/${row.id}`).set(row);
  for (const row of fixtureReports()) await db.doc(`daily_reports/${row.id}`).set(row);
  let item = await seed(manager), schedule, run;
  await check('concurrent schedule creates enforce the per-account five-item limit', async () => {
    const responses = await Promise.allSettled(Array.from({ length: 6 }, () => create(manager, item)));
    assert.equal(responses.filter(value => value.status === 'fulfilled').length, 5);
    const failure = responses.find(value => value.status === 'rejected'); assert.equal(failure.reason.code, 'resource-exhausted');
    assert.equal((await call(manager, 'list')).schedules.length, 5); await removeAll(manager);
  });
  await check('schedule CRUD validates ownership revisions and cadence', async () => {
    schedule = await create(manager, item);
    await rejected(call(other, 'pause', { id: schedule.id, revision: schedule.revision }));
    await rejected(call(manager, 'pause', { id: schedule.id, revision: 900 }), 'failed-precondition');
    await rejected(call(manager, 'save', { savedId: item.id, savedRevision: 1, cadence: { ...cadence, time: '24:00' } }), 'invalid-argument');
    const view = await call(manager, 'pause', { id: schedule.id, revision: schedule.revision });
    assert.equal(view.schedules[0].enabled, false); assert.equal(view.schedules[0].nextRunAt, null);
    assert.equal(await processSchedule(schedule.id), 'skipped');
    schedule = (await call(manager, 'save', { id: schedule.id, revision: view.schedules[0].revision, savedId: item.id, savedRevision: 1, cadence })).schedules[0];
  });
  await check('scheduler overlap generates one private immutable report without changing the conversation or originals', async () => {
    await root.collection('sessions').doc(manager.uid).set({ marker: 'conversation-unchanged' });
    const original = await db.doc('daily_reports/' + fixtureReports()[0].id).get();
    const savedBefore = await root.collection('saved_analyses').doc(manager.uid).get();
    await due(schedule); let executed = 0;
    execution.executeWorkspacePlan = async (...args) => { executed++; return actualExecute(...args); };
    await Promise.all([processSchedule(schedule.id), processSchedule(schedule.id), processSchedule(schedule.id)]);
    assert.equal(executed, 1);
    run = (await call(manager, 'list')).runs[0]; assert.equal(run.status, 'complete');
    const stored = (await results.doc(run.id).get()).data(); assert.equal(stored.result.totals.amount, 320000);
    assert.equal(JSON.stringify(await call(manager, 'list')).includes('accessHash'), false);
    assert.equal(JSON.stringify(await call(manager, 'list')).includes('320000'), false);
    assert.deepEqual((await root.collection('sessions').doc(manager.uid).get()).data(), { marker: 'conversation-unchanged' });
    assert.ok(original.updateTime.isEqual((await original.ref.get()).updateTime));
    assert.ok(savedBefore.updateTime.isEqual((await savedBefore.ref.get()).updateTime));
  });
  await check('same snapshot exports both formats after source changes and cannot be exported by another account', async () => {
    const original = fixtureReports()[0]; await db.doc(`daily_reports/${original.id}`).delete();
    const file = await call(manager, 'export', { runId: run.id, format: 'xlsx' });
    const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(Buffer.from(file.base64, 'base64'));
    let found = false; workbook.eachSheet(sheet => sheet.eachRow(row => row.eachCell(cell => { if (cell.value === 320000) found = true; })));
    assert.ok(found);
    const pdf = await call(manager, 'export', { runId: run.id, format: 'pdf' }); assert.equal(Buffer.from(pdf.base64, 'base64').subarray(0, 4).toString(), '%PDF');
    await rejected(call(other, 'export', { runId: run.id, format: 'xlsx' }));
    await db.doc(`daily_reports/${original.id}`).set(original);
  });
  await check('direct client rules deny schedules, report metadata and snapshots even to administrators', async () => {
    for (const path of [schedules.doc(schedule.id).path, runs.doc(run.id).path, results.doc(run.id).path, root.collection('report_owners').doc(manager.uid).path]) {
      await rejected(getDocFromServer(doc(manager.db, path)));
      await rejected(setDoc(doc(manager.db, path), { forged: true }));
    }
  });
  await check('permission and disabled-auth changes block stored downloads and pause scheduled execution', async () => {
    await db.doc(`users/${manager.uid}`).update({ role: 'user', position: '팀장', linkedWorkerIds: [] });
    await rejected(call(manager, 'export', { runId: run.id, format: 'xlsx' }));
    await due(schedule); assert.equal(await processSchedule(schedule.id), 'failed');
    assert.equal((await schedules.doc(schedule.id).get()).data().enabled, false);
    await db.doc(`users/${manager.uid}`).update({ role: 'admin', position: '관리자', linkedWorkerIds: [] });
    await admin.auth().updateUser(manager.uid, { disabled: true });
    await rejected(call(manager, 'export', { runId: run.id, format: 'xlsx' }));
    await admin.auth().updateUser(manager.uid, { disabled: false }); await removeAll(manager);
  });
  await check('editing or deleting a saved analysis prevents an old reservation from silently changing', async () => {
    schedule = await create(manager, item);
    await root.collection('saved_analyses').doc(manager.uid).set({ version: 1, items: [{ ...item, revision: 2 }] });
    await due(schedule); assert.equal(await processSchedule(schedule.id), 'failed');
    assert.equal((await schedules.doc(schedule.id).get()).data().enabled, false);
    await removeAll(manager); item = await seed(manager);
    schedule = await create(manager, item);
    await root.collection('saved_analyses').doc(manager.uid).set({ version: 1, items: [] });
    await due(schedule); assert.equal(await processSchedule(schedule.id), 'failed');
    await removeAll(manager); item = await seed(manager);
  });
  await check('pause during generation discards the late result and records why', async () => {
    schedule = await create(manager, item); await due(schedule);
    let release, entered; const started = new Promise(resolve => { entered = resolve; });
    execution.executeWorkspacePlan = async (...args) => { entered(); await new Promise(resolve => { release = resolve; }); return actualExecute(...args); };
    const task = processSchedule(schedule.id); await started;
    await call(manager, 'pause', { id: schedule.id, revision: schedule.revision }); release();
    assert.equal(await task, 'discarded');
    const recent = (await call(manager, 'list')).runs[0]; assert.equal(recent.status, 'failed');
    assert.equal((await results.doc(recent.id).get()).exists, false); await removeAll(manager);
  });
  await check('late saved-revision changes discard the computed result at commit', async () => {
    schedule = await create(manager, item); await due(schedule);
    execution.executeWorkspacePlan = async (...args) => { const response = await actualExecute(...args);
      await root.collection('saved_analyses').doc(manager.uid).set({ version: 1, items: [{ ...item, revision: 2 }] }); return response; };
    assert.equal(await processSchedule(schedule.id), 'failed');
    assert.equal((await results.doc((await call(manager, 'list')).runs[0].id).get()).exists, false);
    await removeAll(manager); item = await seed(manager, 'lastMonth');
  });
  await check('transient failure retry keeps the intended month and stops after three attempts', async () => {
    schedule = await create(manager, item); const intended = await due(schedule, '2026-08-31T15:00:00.000Z');
    execution.executeWorkspacePlan = async () => { throw Object.assign(new Error('private provider response'), { code: 'unavailable' }); };
    assert.equal(await processSchedule(schedule.id), 'failed');
    let failed = (await call(manager, 'list')).runs[0]; assert.equal(failed.retryable, true); assert.equal(failed.message.includes('private'), false);
    // A later regular occurrence can be due while an old failed occurrence is retried.
    const regularDue = await due(schedule, new Date(Date.now() - 1000).toISOString());
    await call(manager, 'retry', { runId: failed.id }); failed = (await runs.doc(failed.id).get()).data(); assert.equal(failed.attempts, 2);
    assert.equal((await schedules.doc(schedule.id).get()).data().nextRunAt, regularDue);
    execution.executeWorkspacePlan = async (...args) => { assert.equal(args[0].range.startDate, '2026-08-01'); return actualExecute(...args); };
    await call(manager, 'retry', { runId: failed.id });
    failed = (await runs.doc(failed.id).get()).data(); assert.equal(failed.dueAt, intended); assert.equal(failed.attempts, 3); assert.equal(failed.status, 'complete');
    assert.equal((await schedules.doc(schedule.id).get()).data().nextRunAt, regularDue);
    await rejected(call(manager, 'retry', { runId: failed.id }), 'failed-precondition');
    execution.executeWorkspacePlan = actualExecute;
    assert.equal(await processSchedule(schedule.id), 'complete');
    assert.equal((await runs.where('scheduleId', '==', schedule.id).get()).size, 2);
    await removeAll(manager);
  });
  await check('lost leases become visible failures; duplicate delivery does not regenerate complete slots', async () => {
    schedule = await create(manager, item); await due(schedule);
    await processSchedule(schedule.id); const finished = (await call(manager, 'list')).runs[0];
    await due(schedule, finished.dueAt); let count = 0;
    execution.executeWorkspacePlan = async (...args) => { count++; return actualExecute(...args); };
    assert.equal(await processSchedule(schedule.id), 'skipped'); assert.equal(count, 0);
    const resumeAt = new Date(Date.now() - 1000).toISOString();
    const lease = { token: 'lost-worker', runId: 'synthetic-lost', dueAt: finished.dueAt, until: new Date(Date.now() - 1).toISOString(), resumeAt };
    await runs.doc(lease.runId).set({ ...(await runs.doc(finished.id).get()).data(), id: lease.runId, status: 'running', attempts: 1 });
    await schedules.doc(schedule.id).update({ lease, nextRunAt: lease.until });
    assert.equal(await processSchedule(schedule.id), 'skipped');
    assert.equal((await runs.doc(lease.runId).get()).data().status, 'failed'); assert.equal(count, 0);
    assert.equal((await schedules.doc(schedule.id).get()).data().nextRunAt, resumeAt); await removeAll(manager);
  });
  await check('partial results remain partial and amount-excluded report settings are preserved', async () => {
    const plan = fixturePlan(); plan.report.includeAmount = false;
    item = saveAnalysis([], { name: '합성 금액 제외', period: 'fixed' }, plan)[0];
    await root.collection('saved_analyses').doc(manager.uid).set({ version: 1, items: [item] });
    schedule = await create(manager, item); await due(schedule);
    execution.executeWorkspacePlan = async (...args) => { const response = await actualExecute(...args); response.result.completeness = 'partial'; response.result.warnings.push('합성 일부 조회 실패'); return response; };
    assert.equal(await processSchedule(schedule.id), 'partial');
    const partial = (await call(manager, 'list')).runs[0]; assert.equal(partial.status, 'partial');
    const file = await call(manager, 'export', { runId: partial.id, format: 'xlsx' });
    const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(Buffer.from(file.base64, 'base64'));
    let amountFound = false; workbook.eachSheet(sheet => sheet.eachRow(row => row.eachCell(cell => { if (cell.value === 320000) amountFound = true; })));
    assert.equal(amountFound, false); await removeAll(manager);
  });
  await check('expired reports cannot download and sweep physically removes both metadata and result', async () => {
    const old = (await call(manager, 'list')).runs.find(value => ['complete', 'partial'].includes(value.status));
    await runs.doc(old.id).update({ expiresAt: '2020-01-01T00:00:00.000Z' });
    await rejected(call(manager, 'export', { runId: old.id, format: 'pdf' }), 'failed-precondition');
    const swept = await sweep(); assert.ok(swept.deleted >= 1);
    assert.equal((await runs.doc(old.id).get()).exists, false); assert.equal((await results.doc(old.id).get()).exists, false);
  });
  await check('sweep executes a due slot but does not execute future or paused schedules', async () => {
    schedule = await create(manager, item); const future = await create(manager, item), paused = await create(manager, item);
    await call(manager, 'pause', { id: paused.id, revision: paused.revision }); await due(schedule);
    const swept = await sweep(); assert.equal(swept.processed, 1);
    assert.equal((await runs.where('scheduleId', '==', future.id).get()).size, 0);
    assert.equal((await runs.where('scheduleId', '==', paused.id).get()).size, 0);
    await removeAll(manager);
  });
  await check('the third transient failure disables retry without promising another manual attempt', async () => {
    schedule = await create(manager, item); await due(schedule);
    execution.executeWorkspacePlan = async () => { throw Object.assign(new Error('synthetic transient'), { code: 'unavailable' }); };
    await processSchedule(schedule.id); const failed = (await call(manager, 'list')).runs[0];
    await call(manager, 'retry', { runId: failed.id }); await call(manager, 'retry', { runId: failed.id });
    const final = (await runs.doc(failed.id).get()).data(); assert.equal(final.attempts, 3); assert.equal(final.retryable, false); assert.match(final.message, /3회/);
    await rejected(call(manager, 'retry', { runId: failed.id }), 'failed-precondition'); await removeAll(manager);
  });
  await check('disabling the Auth account after query completion prevents snapshot persistence', async () => {
    schedule = await create(manager, item); await due(schedule);
    execution.executeWorkspacePlan = async (...args) => { const response = await actualExecute(...args); await admin.auth().updateUser(manager.uid, { disabled: true }); return response; };
    assert.equal(await processSchedule(schedule.id), 'failed');
    const failed = (await runs.where('scheduleId', '==', schedule.id).get()).docs[0];
    assert.equal(failed.data().retryable, false); assert.equal((await results.doc(failed.id).get()).exists, false);
    assert.equal((await schedules.doc(schedule.id).get()).data().enabled, false);
    await admin.auth().updateUser(manager.uid, { disabled: false }); await removeAll(manager);
  });
  await check('background team-leader queries retain row scope and membership changes block old report files', async () => {
    await db.doc(`users/${other.uid}`).set({ role: 'user', position: '팀장', status: 'active', linkedWorkerIds: ['w1'] });
    await db.doc('workers/w1').update({ uid: other.uid, role: '팀장', status: '재직' });
    const teamItem = await seed(other), teamSchedule = await create(other, teamItem); await due(teamSchedule);
    assert.equal(await processSchedule(teamSchedule.id), 'complete'); const teamRun = (await call(other, 'list')).runs[0];
    const result = (await results.doc(teamRun.id).get()).data().result; assert.equal(result.totals.amount, 200000);
    assert.deepEqual(result.details.map(row => row.workerId), ['w1']);
    await db.doc('workers/w1').update({ teamId: 't2' });
    await rejected(call(other, 'export', { runId: teamRun.id, format: 'xlsx' }), 'failed-precondition');
    await due(teamSchedule); assert.equal(await processSchedule(teamSchedule.id), 'failed');
    assert.equal((await schedules.doc(teamSchedule.id).get()).data().enabled, false);
  });
  await check('scheduler emergency stop preserves due reservations, allows history, and still cleans expired reports', async () => {
    schedule = await create(manager, item); const planned = await due(schedule);
    await root.update({ 'runtime.schedulerEnabled': false });
    const overview = await call(manager, 'list'); assert.equal(overview.schedulerEnabled, false);
    assert.equal(await processSchedule(schedule.id), 'skipped');
    await rejected(create(manager, item), 'failed-precondition');
    await rejected(call(manager, 'retry', { runId: 'not-executed' }), 'failed-precondition');
    const completed = overview.runs.find(value => ['complete', 'partial'].includes(value.status));
    if (completed) assert.ok((await call(manager, 'export', { runId: completed.id, format: 'xlsx' })).base64);
    const old = overview.runs[0]; await runs.doc(old.id).update({ expiresAt: '2020-01-01T00:00:00.000Z' });
    const stopped = await sweep(); assert.equal(stopped.processed, 0); assert.ok(stopped.deleted >= 1);
    assert.equal((await schedules.doc(schedule.id).get()).data().nextRunAt, planned);
    await call(manager, 'pause', { id: schedule.id, revision: schedule.revision }); await removeAll(manager);
    await root.update({ 'runtime.schedulerEnabled': true });
  });
  await check('turning off automatic execution while generating discards results without disabling the reservation', async () => {
    schedule = await create(manager, item); await due(schedule);
    execution.executeWorkspacePlan = async (...args) => { const response = await actualExecute(...args); await root.update({ 'runtime.schedulerEnabled': false }); return response; };
    assert.equal(await processSchedule(schedule.id), 'failed');
    const failed = (await call(manager, 'list')).runs[0]; assert.equal(failed.retryable, true);
    assert.equal((await results.doc(failed.id).get()).exists, false); assert.equal((await schedules.doc(schedule.id).get()).data().enabled, true);
    await root.update({ 'runtime.schedulerEnabled': true }); execution.executeWorkspacePlan = actualExecute;
    await call(manager, 'retry', { runId: failed.id }); assert.equal((await runs.doc(failed.id).get()).data().status, 'complete'); await removeAll(manager);
  });
  await check('pilot queue filtering prevents non-pilot backlog from hiding approved due reservations', async () => {
    schedule = await create(manager, item); await due(schedule);
    const seed = (await schedules.doc(schedule.id).get()).data();
    for (let index = 0; index < 12; index++) await schedules.doc(`non-pilot-${index}`).set({ ...seed, id: `non-pilot-${index}`, uid: other.uid, nextRunAt: '2020-01-01T00:00:00.000Z' });
    await root.update({ 'runtime.mode': 'pilot', 'runtime.pilotUids': [manager.uid] });
    await rejected(call(other, 'list'), 'failed-precondition');
    const pilot = await sweep(); assert.equal(pilot.processed, 1);
    assert.equal((await runs.where('scheduleId', '==', schedule.id).get()).docs[0].data().status, 'complete');
    for (let index = 0; index < 12; index++) {
      assert.equal((await schedules.doc(`non-pilot-${index}`).get()).data().nextRunAt, '2020-01-01T00:00:00.000Z');
      await schedules.doc(`non-pilot-${index}`).delete();
    }
    await root.update({ 'runtime.mode': 'off' }); await rejected(call(manager, 'list'), 'failed-precondition');
    assert.equal((await sweep()).processed, 0);
    await root.update({ 'runtime.mode': 'on', 'runtime.pilotUids': [] });
  });
  console.log(`AI workspace scheduled reports: ${count} emulator scenarios passed.`);
} finally { execution.executeWorkspacePlan = actualExecute; await Promise.all(apps.map(deleteApp)); await db.terminate(); }
