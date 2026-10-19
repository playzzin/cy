import assert from 'node:assert/strict';
import { initializeApp as initializeAdminApp } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, doc, getDoc, getFirestore, setDoc, runTransaction, serverTimestamp, deleteDoc, collection, query, where, getDocs } from 'firebase/firestore';
const projectId = process.env.GCLOUD_PROJECT;
assert.equal(projectId, 'demo-cy-corporate-tax');
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8198');
assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, '127.0.0.1:9198');
const admin = initializeAdminApp({ projectId });
const adminDb = getAdminFirestore(admin);
const apps = [];
async function client(role) {
    const app = initializeApp({ apiKey: 'demo-api-key', projectId }, role);
    apps.push(app);
    const db = getFirestore(app); connectFirestoreEmulator(db, '127.0.0.1', 8198);
    const auth = getAuth(app); connectAuthEmulator(auth, 'http://127.0.0.1:9198', { disableWarnings: true });
    if (role !== 'anonymous') {
        const { user } = await createUserWithEmailAndPassword(auth, `${role}@example.test`, 'emulator-password');
        await adminDb.doc(`users/${user.uid}`).set({ role, status: 'active' });
    }
    return db;
}
const finance = await client('finance'), worker = await client('worker'), anonymous = await client('anonymous');
const ref = db => doc(db, 'corporate_tax_settlements', 'cheongyeon-2026');
const manual = { months: { 1: { amounts: { depreciation: 1000 }, notes: { depreciation: 'synthetic evidence' } } }, taxRate: 10, interimPayment: 0, taxCredit: 0, memo: '' };
await setDoc(ref(finance), { year: 2026, manual, revision: 1 });
assert.deepEqual((await getDoc(ref(finance))).data().manual, manual);
await runTransaction(finance, async transaction => {
    const saved = await transaction.get(ref(finance));
    assert.equal(saved.data().revision, 1);
    transaction.update(ref(finance), { revision: 2 });
});
assert.equal((await getDoc(ref(finance))).data().revision, 2);
for (const db of [worker, anonymous]) {
    await assert.rejects(() => getDoc(ref(db)), { code: 'permission-denied' });
    await assert.rejects(() => setDoc(ref(db), { manual }), { code: 'permission-denied' });
}
await setDoc(doc(finance, 'corporate_tax_settlements', 'cheongyeon-2025'), { year: 2025, manual: { ...manual, taxRate: 8 }, revision: 1 });
assert.equal((await getDoc(ref(finance))).data().manual.taxRate, 10);
console.log('PASS: finance create/read/transaction, year isolation, worker and anonymous denied (8 assertions)');
const payrollRef = db => doc(db, 'office_staff_payroll', '2026-01');
const payroll = { month: '2026-01', year: 2026, payroll: { grossPaySnapshot: [{ id: 'synthetic', name: '검증 직원', grossPay: 1000, baseSalary: 1000, bonus: 0, payBasis: 'gross' }] }, revision: 1, updatedBy: getAuth(apps[0]).currentUser.uid, updatedAt: serverTimestamp() };
await setDoc(payrollRef(finance), payroll);
assert.equal((await getDoc(payrollRef(finance))).data().revision, 1);
assert.equal((await getDocs(query(collection(finance, 'office_staff_payroll'), where('year', '==', 2026)))).size, 1);
await setDoc(payrollRef(finance), { ...payroll, revision: 2 });
await assert.rejects(() => setDoc(payrollRef(finance), { ...payroll, revision: 2 }), { code: 'permission-denied' });
await assert.rejects(() => setDoc(payrollRef(finance), { ...payroll, revision: 3, updatedBy: 'forged-user' }), { code: 'permission-denied' });
await assert.rejects(() => setDoc(payrollRef(finance), { ...payroll, revision: 3, year: 2025 }), { code: 'permission-denied' });
await assert.rejects(() => deleteDoc(payrollRef(finance)), { code: 'permission-denied' });
for (const db of [worker, anonymous]) {
    await assert.rejects(() => getDoc(payrollRef(db)), { code: 'permission-denied' });
    await assert.rejects(() => setDoc(payrollRef(db), { ...payroll, revision: 3 }), { code: 'permission-denied' });
    await assert.rejects(() => setDoc(doc(db, 'office_staff_payroll', '2026-01', 'nested', 'forbidden'), {}), { code: 'permission-denied' });
}
console.log('PASS: shared payroll finance read/year query, revision conflict, actor/year validation, delete and worker/anonymous access denied (12 assertions)');
await Promise.all(apps.map(deleteApp));
await adminDb.terminate();
