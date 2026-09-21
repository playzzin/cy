// Run against the local demo-team-browser Auth/Firestore/Functions emulators only.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const admin = require('../functions/node_modules/firebase-admin');

process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
const projectId = 'demo-team-browser';

async function main() {
  const app = admin.initializeApp({ projectId });
  const db = app.firestore();
  const uid = `role-check-${randomUUID()}`;
  const email = `${uid}@example.test`;
  const password = randomUUID();
  const profile = db.doc(`users/${uid}`);
  const worker = db.doc(`workers/${uid}`);
  try {
    await app.auth().createUser({ uid, email, password, emailVerified: true });
    await profile.set({ email, name: '직책 검증 계정', status: 'active', role: 'user', position: '작업자', linkedWorkerIds: [uid] });
    // The linked worker deliberately has no leader role, so only the account's
    // persisted position can grant team-leader access in this test.
    await worker.set({ name: '직책 검증 작업자', role: '작업자', status: '재직', isActive: true, teamId: 'role-check-team' });
    await db.doc('teams/role-check-team').set({ name: '직책 검증팀', isActive: true });
    await db.doc('companies/role-check-company').set({ name: '㈜청연이엔지', isActive: true });
    await db.doc('settings/menus_v12').set({ admin: { positionConfig: [{ id: 'role-check-leader', name: '팀장' }, { id: 'role-check-office', name: '사무실' }] } });

    const response = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true })
    });
    const signedIn = await response.json();
    assert.ok(signedIn.idToken, 'Test account must actually sign in');
    const call = async name => {
      const result = await fetch(`http://127.0.0.1:5001/${projectId}/asia-northeast3/${name}`, {
        method: 'POST', headers: { 'content-type': 'application/json', Authorization: `Bearer ${signedIn.idToken}` },
        body: JSON.stringify({ data: { action: 'list', yearMonth: '2026-09' } })
      });
      return result.json();
    };
    for (const [position, expected] of [['작업자', 'denied'], ['role-check-leader', 'leader'], ['role-check-office', 'office'], ['role-check-leader', 'leader']]) {
      await profile.update({ position });
      assert.equal((await profile.get()).data().position, position);
      for (const name of ['teamExpenseRequests', 'teamWorkerRequests']) {
        const response = await call(name);
        if (expected === 'denied') assert.equal(response.error?.status, 'PERMISSION_DENIED');
        else {
          assert.ok(response.result, 'Expected a successful callable response');
          assert.equal(response.result.canReview, expected === 'office');
          const teams = response.result.payerTeams || response.result.teams;
          assert.equal(teams.length, 1);
          assert.equal(teams[0].id, 'role-check-team');
        }
      }
      console.log(`PASS: persisted position ${expected}; both menus checked with the same authenticated session`);
    }
    assert.equal((await app.auth().getUser(uid)).customClaims?.admin, undefined);
    console.log('PASS: no admin claim and no linked-worker leader role; final account position resolves to team leader');
  } finally {
    await Promise.all([profile.delete(), worker.delete(), db.doc('teams/role-check-team').delete(), db.doc('companies/role-check-company').delete(), app.auth().deleteUser(uid)]);
    await app.delete();
  }
}
main().catch(error => { console.error(`Role verification failed: ${error.code || error.message}`); process.exitCode = 1; });
