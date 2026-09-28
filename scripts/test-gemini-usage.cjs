// Emulator-only integration: synthetic actors, provider responses and costs. No paid API calls.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createRequire } = require('node:module');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
assert.equal(fs.readFileSync(path.join(root, 'src/utils/geminiUsage.ts'), 'utf8'), fs.readFileSync(path.join(root, 'functions/src/geminiUsage.ts'), 'utf8'), 'Shared usage/pricing code drifted');
assert.ok(String(process.env.GCLOUD_PROJECT).startsWith('demo-') && process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST, 'Emulators are required');
const functionsRequire = createRequire(path.join(root, 'functions/package.json'));
const admin = functionsRequire('firebase-admin');
admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT });
const { initializeApp, deleteApp } = require('firebase/app');
const { getAuth, connectAuthEmulator, createUserWithEmailAndPassword } = require('firebase/auth');
const { getFirestore, connectFirestoreEmulator, doc, setDoc, getDocFromServer, setLogLevel } = require('firebase/firestore');
const { recordGeminiClientUsage, listGeminiUsageLogs, validateClientUsage } = require('../functions/lib/geminiUsageLogs');
const { trackedGeminiFetch, withGeminiUsageContext, saveGeminiUsage } = require('../functions/lib/geminiUsageLogging');
const { geminiEvent } = require('../functions/lib/geminiUsage');
const db = admin.firestore(), apps = [], logs = db.collection('gemini_usage_logs');
const payload = { usageMetadata: { promptTokenCount: 1000, candidatesTokenCount: 100, thoughtsTokenCount: 200 }, candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'private-result-fixture' }] } }] };
const event = geminiEvent('gemini-3.8-flash', 'excel-conversion', payload, 150);
const period = { startDate: '2026-01-01', endDate: '2026-12-31' };
const reject = (promise, code) => assert.rejects(promise, e => e.code === code);
let passed = 0;
async function check(name, work) { await work(); passed++; console.log(`PASS ${name}`); }
async function actor(name, role) {
  const app = initializeApp({ apiKey: 'demo-key', projectId: process.env.GCLOUD_PROJECT }, name); apps.push(app);
  const auth = getAuth(app); connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, { disableWarnings: true });
  const result = await createUserWithEmailAndPassword(auth, `${name}@example.test`, 'synthetic-password');
  const uid = result.user.uid;
  await db.doc(`users/${uid}`).set({ role, status: 'active' });
  const firestore = getFirestore(app), [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
  connectFirestoreEmulator(firestore, host, Number(port));
  return { uid, firestore, context: { auth: { uid, token: { role, name } } } };
}
(async () => {
  setLogLevel('silent');
  try {
    const owner = await actor('usage-owner', 'admin'), staff = await actor('usage-staff', 'user');
    await check('only authenticated actors can report, and only active administrators can list', async () => {
      await reject(recordGeminiClientUsage.run({}, {}), 'unauthenticated');
      await reject(listGeminiUsageLogs.run(period, staff.context), 'permission-denied');
      await db.doc(`users/${owner.uid}`).update({ status: 'suspended' });
      await reject(listGeminiUsageLogs.run(period, owner.context), 'permission-denied');
      await db.doc(`users/${owner.uid}`).update({ status: 'active' });
    });
    await check('client telemetry is idempotent and cannot choose another actor, price or content', async () => {
      const input = { ...event, requestId: 'fixture-request-0001', actorUid: 'forged', estimatedUsd: 9999, prompt: 'private-prompt-fixture', apiKey: 'private-key-fixture', path: '/tools/excel?secret=private-query#private-hash' };
      await recordGeminiClientUsage.run(input, staff.context); await recordGeminiClientUsage.run(input, staff.context);
      const rows = (await logs.get()).docs.map(d => d.data()); assert.equal(rows.length, 1);
      assert.equal(rows[0].actorUid, staff.uid); assert.notEqual(rows[0].estimatedUsd, 9999); assert.equal(rows[0].source, 'browser');
      assert.equal(rows[0].path, '/tools/excel'); assert.ok(!JSON.stringify(rows).includes('private-'));
      assert.throws(() => validateClientUsage({ ...input, model: 'invalid/key' }));
    });
    await check('direct Firestore reads and forged writes are denied, including administrators', async () => {
      const id = (await logs.get()).docs[0].id;
      for (const user of [owner, staff]) {
        await reject(getDocFromServer(doc(user.firestore, 'gemini_usage_logs', id)), 'permission-denied');
        await reject(setDoc(doc(user.firestore, 'gemini_usage_logs', 'forged'), { estimatedUsd: 0 }), 'permission-denied');
      }
    });
    await check('simultaneous server requests retain their own actor and never store provider text', async () => {
      const handler = withGeminiUsageContext(async (input) => {
        const response = await trackedGeminiFetch('identity-analysis', async () => {
          await new Promise(resolve => setTimeout(resolve, input.delay));
          return { ok: true, json: async () => payload };
        })('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=private-key-fixture');
        return response.json();
      });
      await Promise.all([handler({ delay: 30 }, owner.context), handler({ delay: 2 }, staff.context)]);
      const rows = (await logs.get()).docs.map(d => d.data()).filter(r => r.source === 'server');
      assert.deepEqual(new Set(rows.map(r => r.actorUid)), new Set([owner.uid, staff.uid]));
      assert.ok(!JSON.stringify(rows).includes('private-'));
    });
    await check('batch result polling saves one discounted usage record', async () => {
      const batchEvent = { ...event, mode: 'batch' };
      await saveGeminiUsage(batchEvent, { id: 'batch:fixture:0' }); await saveGeminiUsage(batchEvent, { id: 'batch:fixture:0' });
      const rows = (await logs.get()).docs.map(d => d.data()).filter(r => r.mode === 'batch');
      assert.equal(rows.length, 1); assert.equal(rows[0].estimatedUsd, 0.0009375);
    });
    await check('admin pagination neither loses nor duplicates same-timestamp records', async () => {
      const batch = db.batch();
      for (let i = 0; i < 205; i++) batch.set(logs.doc(`page-${String(i).padStart(3, '0')}`), { ...event, createdAt: admin.firestore.Timestamp.fromDate(new Date('2026-09-20T00:00:00Z')) });
      await batch.commit();
      const first = await listGeminiUsageLogs.run(period, owner.context);
      assert.equal(first.logs.length, 200); assert.ok(first.nextCursor);
      const second = await listGeminiUsageLogs.run({ ...period, cursor: first.nextCursor }, owner.context);
      assert.equal(new Set([...first.logs, ...second.logs].map(r => r.id)).size, 209); assert.equal(second.nextCursor, null);
      await reject(listGeminiUsageLogs.run({ startDate: '2026-09-30', endDate: '2026-09-01' }, owner.context), 'invalid-argument');
    });
    console.log(`${passed} Gemini usage integration checks passed`);
  } finally { await Promise.all(apps.map(app => deleteApp(app))); await admin.app().delete(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
