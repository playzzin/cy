// Emulator-only: firebase emulators:exec --only firestore,auth --project demo-cy-settlement "node scripts/test-team-settlement-rules.mjs"
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeApp as initializeAdminApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, doc, getDocFromServer, getFirestore, setDoc, updateDoc, deleteDoc, setLogLevel } from 'firebase/firestore';

const projectId = process.env.GCLOUD_PROJECT || '';
assert.ok(projectId.startsWith('demo-'), 'Only a demo project is allowed');
assert.ok(process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST, 'Both emulators are required');
const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
const adminApp = initializeAdminApp({ projectId });
const adminDb = getAdminFirestore(adminApp);
const app = initializeApp({ apiKey: 'demo-key', projectId });
const auth = getAuth(app);
connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, { disableWarnings: true });
const { user } = await createUserWithEmailAndPassword(auth, 'settlement-role-test@example.test', 'emulator-only-password');
const db = getFirestore(app);
connectFirestoreEmulator(db, host, Number(port));
setLogLevel('silent');
const profileRef = adminDb.doc(`users/${user.uid}`);
const paths = ['system_configs/team_settlement_2026-10__team',
  'system_configs/team_settlement_support_rate_overrides_v1_2026-10',
  'team_settlement_documents/fixture', 'team_settlement_documents/fixture/history/entry'];
let checks = 0;
const allow = async operation => { await operation; checks++; };
const deny = async operation => { await assert.rejects(operation, error => error.code === 'permission-denied'); checks++; };

try {
  const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
  const ui = readFileSync(new URL('../src/utils/teamSettlementAccess.ts', import.meta.url), 'utf8');
  const strings = text => [...text.matchAll(/'([^']*)'/g)].map(match => match[1]);
  const aliases = strings(rules.match(/function teamSettlementWriterRoles\(\)\s*\{\s*return \[([\s\S]*?)\];/)[1]);
  assert.deepEqual(aliases, strings(ui.match(/TEAM_SETTLEMENT_WRITER_ROLES = \[([\s\S]*?)\];/)[1])); checks++;
  for (const position of aliases) {
    await profileRef.set({ status: 'active', position });
    await allow(setDoc(doc(db, paths[0]), { data: '{}' }));
    await allow(deleteDoc(doc(db, paths[0])));
  }
  for (const field of ['role', 'position', 'systemRole', 'roles', 'additionalPositions']) {
    const value = ['roles', 'additionalPositions'].includes(field) ? ['manager'] : 'manager';
    await profileRef.set({ status: 'active', [field]: value });
    for (const path of paths) {
      await allow(setDoc(doc(db, path), { data: '{}' }));
      await allow(updateDoc(doc(db, path), { data: '{"updated":true}' }));
      await allow(deleteDoc(doc(db, path)));
    }
    await deny(setDoc(doc(db, 'system_configs/unrelated-setting'), { data: '{}' }));
  }
  for (const role of ['admin', '관리자', '실장', 'owner', 'jhl2VTnk9V3C4EiZ4QQI', 'PAYROLL_MANAGER', 'finance', 'office', '팀장', 'site_manager', 'user']) {
    await profileRef.set({ status: 'active', role });
    for (const path of paths) {
      await adminDb.doc(path).delete();
      await deny(setDoc(doc(db, path), { data: '{}' }));
      await adminDb.doc(path).set({ data: '{}' });
      await deny(updateDoc(doc(db, path), { data: 'changed' }));
      await deny(deleteDoc(doc(db, path)));
    }
    await allow(getDocFromServer(doc(db, paths[0])));
  }
  for (const status of ['pending', 'suspended', 'rejected']) {
    await profileRef.set({ status, position: 'ceo' });
    await deny(updateDoc(doc(db, paths[0]), { data: 'changed' }));
  }
  await profileRef.delete();
  await deny(updateDoc(doc(db, paths[0]), { data: 'changed' }));
  await profileRef.set({ role: 'user', status: 'active' });
  await getAdminAuth(adminApp).setCustomUserClaims(user.uid, { position: 'ceo' });
  await user.getIdToken(true);
  await deny(updateDoc(doc(db, paths[0]), { data: 'stale claim' }));
  await profileRef.set({ role: 'dev', status: 'active' });
  await allow(updateDoc(doc(db, paths[0]), { data: '{}' }));
  await profileRef.update({ role: 'user' });
  await deny(updateDoc(doc(db, paths[0]), { data: 'revoked' }));
  await profileRef.update({ position: 'ceo' });
  await getAdminAuth(adminApp).setCustomUserClaims(user.uid, { devPreview: true });
  await user.getIdToken(true);
  await deny(updateDoc(doc(db, paths[0]), { data: 'preview' }));
  console.log(`Team settlement Firestore rules: ${checks} checks passed.`);
} finally {
  await deleteApp(app);
  await adminDb.terminate();
}
