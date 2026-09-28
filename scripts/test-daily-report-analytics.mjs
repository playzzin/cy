// Synthetic data only; server quota writes must never target a production project.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { initializeApp, deleteApp } from 'firebase/app';
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, doc, getDocFromServer, setLogLevel } from 'firebase/firestore';
const projectId = process.env.GCLOUD_PROJECT || '';
assert.ok(projectId.startsWith('demo-') && process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST, 'Emulator-only test');
const require = createRequire(new URL('../functions/package.json', import.meta.url));
const admin = require('firebase-admin'); admin.initializeApp({ projectId });
const db = admin.firestore();
const { handleDailyReportAnalytics: handle, nextAnalyticsQuota } = require('../functions/lib/dailyReportAnalyticsAi');
const apps = []; setLogLevel('silent');
async function user(name, role = 'admin') {
  const app = initializeApp({ apiKey: 'demo-key', projectId }, name); apps.push(app);
  const auth = getAuth(app); connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, { disableWarnings: true });
  const { user } = await createUserWithEmailAndPassword(auth, `${name}@example.test`, 'synthetic-password');
  await db.doc(`users/${user.uid}`).set({ status: 'active', role });
  const firestore = getFirestore(app), [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
  connectFirestoreEmulator(firestore, host, Number(port));
  return { uid: user.uid, firestore, context: { auth: { uid: user.uid, token: { role: 'admin' } } } };
}
const input = { task: 'parse', text: '합성 팀별 공수 질문' };
let generated = 0, passed = 0;
const overrides = { settings: async () => ({ apiKey: 'synthetic', model: 'gemini-3.8-flash' }), generate: async () => { generated++; return '{}'; } };
const rejected = (value, code) => assert.rejects(value, error => error.code === code);
const check = async (name, run) => { await run(); passed++; console.log(`PASS ${name}`); };
const quota = actor => db.doc(`server_settings/ai/analytics_usage/${actor.uid}`);
try {
  const actor = await user('statistics-admin'), ordinary = await user('statistics-general', 'user');
  await check('anonymous and stale admin claims cannot use the shared server key', async () => {
    await rejected(handle(input, {}, overrides), 'unauthenticated');
    await rejected(handle(input, ordinary.context, overrides), 'permission-denied');
    assert.equal(generated, 0);
  });
  await check('active user completes and server-only quota cannot be read by the browser', async () => {
    assert.deepEqual(await handle(input, actor.context, overrides), { text: '{}' });
    assert.equal((await quota(actor).get()).data().busyUntil, 0);
    await rejected(getDocFromServer(doc(actor.firestore, `server_settings/ai/analytics_usage/${actor.uid}`)), 'permission-denied');
  });
  await check('disabled authentication and suspended profile stop requests before the provider', async () => {
    const before = generated;
    await admin.auth().updateUser(actor.uid, { disabled: true });
    await rejected(handle(input, actor.context, overrides), 'permission-denied');
    await admin.auth().updateUser(actor.uid, { disabled: false });
    await db.doc(`users/${actor.uid}`).update({ status: 'suspended' });
    await rejected(handle(input, actor.context, overrides), 'permission-denied');
    await db.doc(`users/${actor.uid}`).update({ status: 'active' });
    assert.equal(generated, before);
  });
  await check('overlapping calls acquire one transactional lease', async () => {
    let enter, finish;
    const entered = new Promise(resolve => { enter = resolve; }), finishing = new Promise(resolve => { finish = resolve; });
    const first = handle(input, actor.context, { ...overrides, generate: async () => { enter(); await finishing; return '{}'; } });
    await entered;
    try { await rejected(handle(input, actor.context, overrides), 'resource-exhausted'); }
    finally { finish(); }
    await first;
    assert.equal((await quota(actor).get()).data().busyUntil, 0);
  });
  await check('provider errors release leases and do not store prompts or credentials', async () => {
    await assert.rejects(handle(input, actor.context, { ...overrides, generate: async () => { throw new Error('synthetic provider failure'); } }));
    const state = (await quota(actor).get()).data();
    assert.equal(state.busyUntil, 0);
    assert.deepEqual(Object.keys(state).sort(), ['busyUntil', 'day', 'dayCount', 'lockId', 'minute', 'minuteCount']);
  });
  await check('role removal during generation discards the result', async () => {
    await rejected(handle(input, actor.context, { ...overrides, generate: async () => { await db.doc(`users/${actor.uid}`).update({ role: 'user' }); return 'discarded'; } }), 'permission-denied');
    await db.doc(`users/${actor.uid}`).update({ role: 'admin' });
    assert.equal((await quota(actor).get()).data().busyUntil, 0);
  });
  await check('daily limit and oversized requests do not reach the provider', async () => {
    const before = generated;
    await quota(actor).set({ ...nextAnalyticsQuota(null, Date.now(), 'test'), busyUntil: 0, dayCount: 240 });
    await rejected(handle(input, actor.context, overrides), 'resource-exhausted');
    await rejected(handle({ ...input, text: 'x'.repeat(4001) }, actor.context, overrides), 'invalid-argument');
    assert.equal(generated, before);
  });
  console.log(`Daily report analytics: ${passed} emulator scenarios passed.`);
} finally { await Promise.all(apps.map(deleteApp)); await admin.app().delete(); }
