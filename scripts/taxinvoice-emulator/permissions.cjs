const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { initializeApp: initializeAdminApp, deleteApp: deleteAdminApp } = require('firebase-admin/app');
const { getFirestore: getAdminFirestore } = require('firebase-admin/firestore');
const { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signOut, signInWithEmailAndPassword } = require('firebase/auth');
const { root, projectId, createClient, issue, close } = require('./runtime.cjs');

// Fixed demo project and loopback endpoints; production credentials are never used.
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:18086';
const adminApp = initializeAdminApp({ projectId }, 'taxinvoice-permission-seed');
const admin = getAdminFirestore(adminApp);
const cases = [];
const password = 'Synthetic-only-password-42';
const month = '2082-01';

async function user(name, role, status) {
  const client = createClient(`permission-${name}`);
  const auth = getAuth(client.app);
  connectAuthEmulator(auth, 'http://127.0.0.1:19096', { disableWarnings: true });
  const email = `${name}@example.test`;
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  if (status) await admin.doc(`users/${credential.user.uid}`).set({ role, status, displayName: '합성 권한 검증 계정' });
  return { ...client, auth, email };
}

async function denied(operation) {
  await assert.rejects(operation, error => {
    assert.equal((error.originalError || error).code, 'permission-denied'); return true;
  });
}

async function main() {
  for (const [name, role, status] of [
    ['admin', 'admin', 'active'], ['finance', 'finance', 'active'], ['payroll', 'PAYROLL_MANAGER', 'active'],
    ['pending', 'finance', 'pending'], ['suspended', 'finance', 'suspended'], ['missing-profile', 'finance', null],
  ]) {
    const client = await user(name, role, status);
    const row = issue(`permission-${name}`, { yearMonth: month, issueDate: `${month}-31` });
    const { id, ...data } = row;
    await admin.doc(`tax_invoice_issues/${id}`).set(data);
    if (status === 'active') {
      assert.ok((await client.service.getIssuesByMonth(month)).some(value => value.id === id));
      await client.service.saveIssuesWithConflictCheck([{ id, data: { supplyAmount: 200 } }], [row]);
      await client.service.deleteIssuesWithConflictCheck([id], [{ ...row, supplyAmount: 200 }]);
      assert.equal((await admin.doc(`tax_invoice_issues/${id}`).get()).exists, false);
    } else {
      await denied(() => client.service.getIssuesByMonth(month));
      await denied(() => client.service.saveIssuesWithConflictCheck([{ id, data: { supplyAmount: 200 } }], [row]));
      await denied(() => client.service.deleteIssuesWithConflictCheck([id], [row]));
      assert.equal((await admin.doc(`tax_invoice_issues/${id}`).get()).data().supplyAmount, 100);
    }
    cases.push({ name, access: status === 'active' ? 'allowed' : 'denied', passed: true });
    console.log(`PASS ${name}: read/save/delete ${status === 'active' ? 'allowed' : 'denied'}`);
  }
  const client = await user('login-cycle', 'finance', 'active');
  await signOut(client.auth);
  await denied(() => client.service.getIssuesByMonth(month));
  await signInWithEmailAndPassword(client.auth, client.email, password);
  await client.service.getIssuesByMonth(month);
  cases.push({ name: 'sign-out and sign-in', passed: true });
  console.log('PASS sign-out blocks access and sign-in restores active profile access');

  const rows = Array.from({ length: 451 }, (_, index) => issue(`permission-bulk-${index}`, { yearMonth: month, issueDate: `${month}-31` }));
  for (let start = 0; start < rows.length; start += 450) {
    const batch = admin.batch();
    rows.slice(start, start + 450).forEach(({ id, ...data }) => batch.set(admin.doc(`tax_invoice_issues/${id}`), data));
    await batch.commit();
  }
  await client.service.saveIssuesWithConflictCheck(rows.map(({ id }) => ({ id, data: { supplyAmount: 200 } })), rows);
  await client.service.deleteIssuesWithConflictCheck(rows.map(({ id }) => id), rows.map(row => ({ ...row, supplyAmount: 200 })));
  const remaining = await admin.collection('tax_invoice_issues').where('supplyAmount', '==', 200).get();
  assert.equal(remaining.size, 0);
  cases.push({ name: '451 rows under deployed rules', passed: true });
  console.log('PASS deployed rules allow checked 451-row save and delete');

  // Characterize the explicitly excluded existing rule, without changing it.
  const site = await user('existing-site-policy', 'SITE_MANAGER', 'active');
  await site.service.getIssuesByMonth(month);
  cases.push({ name: 'excluded existing broad active-account policy', observedAccess: 'read allowed', unchanged: true });
  fs.mkdirSync(path.join(root, 'artifacts/audits'), { recursive: true });
  fs.writeFileSync(path.join(root, 'artifacts/audits/taxinvoice-permissions-results.json'), JSON.stringify({ checkedAt: new Date().toISOString(), productionWrites: 0, cases }, null, 2));
}
main().catch(error => { console.error(error.name, error.message, error.originalError?.code || error.code || ''); process.exitCode = 1; })
  .finally(async () => { await close(); await admin.terminate(); await deleteAdminApp(adminApp); });
