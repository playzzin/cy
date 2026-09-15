// Real staging SDK smoke test. The temporary account is removed in finally.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { stagingAdmin } = require('./seed-staging.cjs');
const { initializeApp, deleteApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword, signOut } = require('firebase/auth');
const { getFirestore, getDoc, doc, terminate } = require('firebase/firestore');
async function main() {
    const admin = await stagingAdmin();
    const uid = `staging-smoke-${crypto.randomUUID()}`;
    const email = `${uid}@example.invalid`;
    const password = crypto.randomBytes(36).toString('base64url');
    const env = JSON.parse(fs.readFileSync(path.join(__dirname, '../.firebase/staging-env.json'), 'utf8'));
    assert.equal(env.REACT_APP_FIREBASE_PROJECT_ID, 'cy-erp-staging-9c1e4');
    const app = initializeApp({ apiKey: env.REACT_APP_FIREBASE_API_KEY, authDomain: env.REACT_APP_FIREBASE_AUTH_DOMAIN, projectId: env.REACT_APP_FIREBASE_PROJECT_ID, appId: env.REACT_APP_FIREBASE_APP_ID }, uid);
    const auth = getAuth(app);
    const db = getFirestore(app);
    let created = false;
    try {
        await assert.rejects(getDoc(doc(db, 'accommodationUtilityRecords', 'staging-utility-2026-09')), error => error.code === 'permission-denied');
        await admin.auth.createUser({ uid, email, password }); created = true;
        await admin.db.doc(`users/${uid}`).create({ uid, email, role: 'admin', status: 'active' });
        await signInWithEmailAndPassword(auth, email, password);
        const [source, billed, vehicle] = await Promise.all([
            getDoc(doc(db, 'accommodationUtilityRecords', 'staging-utility-2026-09')),
            getDoc(doc(db, 'accommodation_billing_line_items', 'staging-electricity')),
            getDoc(doc(db, 'vehicle_billing_documents', 'staging-vehicle-bill')),
        ]);
        assert.equal(source.data().costs.electricity - billed.data().amount, 1000);
        assert.equal(vehicle.data().lineItems.reduce((sum, line) => sum + line.amount, 0), vehicle.data().totalAmount);
        console.log('실제 검증 서버 확인: 비로그인 접근 차단 / 로그인 후 가상자료 조회 / 숙소 차이 1,000원 / 차량 청구 합계 일치');
    } finally {
        await signOut(auth);
        await terminate(db);
        await deleteApp(app);
        if (created) {
            await admin.db.doc(`users/${uid}`).delete();
            await admin.auth.deleteUser(uid);
        }
        await require('firebase-admin/app').deleteApp(admin.app);
    }
}
main().catch(error => { console.error(`검증 서버 점검 실패 (${error.code || error.name || 'unknown'})`); process.exitCode = 1; });
