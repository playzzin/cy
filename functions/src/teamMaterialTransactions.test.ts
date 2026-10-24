import { strict as assert } from 'assert';
import { test } from 'node:test';
import * as admin from 'firebase-admin';
import { readTeamScopedData } from './teamScopedRead';
import { normalizeTeamMaterialTransaction, saveTeamMaterialTransactions } from './teamMaterialTransactions';

const row = (changes: any = {}) => ({ id: 'entry', siteId: 'site-a', materialId: 'catalog-item', itemName: '시험 자재', quantity: 2, unitPrice: 30, transactionDate: '2026-10-17', ...changes });
const denied = (error: any) => error.code === 'permission-denied';
test('입출고 값과 날짜 검증 및 감사 주체 위조 필드 제거', () => {
    const value = normalizeTeamMaterialTransaction(row({ amount: 999, registeredBy: 'forged', secret: true }), 'inbound');
    assert.equal(value.amount, 60); assert.equal(value.registeredBy, undefined); assert.equal(value.secret, undefined);
    for (const quantity of [0, -1, NaN, Infinity, '2']) assert.throws(() => normalizeTeamMaterialTransaction(row({ quantity }), 'inbound'));
    for (const transactionDate of ['2026-02-30', 'bad', '2026-1-1']) assert.throws(() => normalizeTeamMaterialTransaction(row({ transactionDate }), 'inbound'));
    assert.throws(() => normalizeTeamMaterialTransaction(row({ siteId: '../foreign' }), 'inbound'));
});
test('인증 없는 요청과 조회 전용 미리보기는 저장을 차단한다', async () => {
    await assert.rejects(saveTeamMaterialTransactions({}, {} as any), (error: any) => error.code === 'unauthenticated');
    await assert.rejects(saveTeamMaterialTransactions({}, { auth: { uid: 'cy-preview-test', token: {} } } as any), denied);
});
test('담당 현장 등록·수정만 원자적으로 허용하고 권한 회수·타 현장·사진 위조를 차단한다', { skip: !process.env.FIRESTORE_EMULATOR_HOST }, async () => {
    const app = admin.initializeApp({ projectId: process.env.TEAM_READ_TEST_PROJECT_ID || 'demo-team-scoped-read' });
    const db = app.firestore();
    const fixtures: Record<string, any> = {
        'users/material-leader': { status: 'active', position: '팀장', displayName: '합성 팀장', linkedWorkerIds: ['material-worker'] },
        'users/material-worker-account': { status: 'active', position: '작업자', linkedWorkerIds: ['material-worker'] },
        'users/material-unlinked': { status: 'active', position: '팀장' },
        'workers/material-worker': { teamId: 'material-team', role: '팀장', isActive: true },
        'teams/material-team': { name: '합성 팀', legacyId: 'material-legacy', isActive: true },
        'sites/site-a': { name: '담당 현장', responsibleTeamId: 'material-team' },
        'sites/site-b': { name: '다른 현장', responsibleTeamId: 'foreign-team' },
        'sites/site-legacy': { name: '레거시 현장', responsibleTeam: { id: 'material-legacy' } },
        'materialPhotoBatches/foreign-photo': { siteId: 'site-b', photos: [{ path: 'private' }] },
        'materialInbounds/foreign': row({ id: 'foreign', siteId: 'site-b', quantity: 99 }),
    };
    const call = (transactions: any[], extra: any = {}, uid = 'material-leader') => saveTeamMaterialTransactions({ direction: 'inbound', transactions, ...extra }, { auth: { uid, token: { role: 'admin' } } } as any);
    try {
        const seed = db.batch(); Object.entries(fixtures).forEach(([path, data]) => seed.set(db.doc(path), data)); await seed.commit();
        await call([row({ registeredBy: 'forged', siteName: 'forged' })]);
        const created = (await db.doc('materialInbounds/entry').get()).data()!;
        assert.equal(created.registeredBy, 'material-leader'); assert.equal(created.siteName, '담당 현장'); assert.equal(created.amount, 60);
        await call([row({ quantity: 5 })]);
        const updated = (await db.doc('materialInbounds/entry').get()).data()!;
        assert.equal(updated.quantity, 5); assert.equal(updated.amount, 150); assert.deepEqual(updated.createdAt, created.createdAt);
        assert.equal((await db.collection('material_logs').where('entityId', '==', 'entry').get()).size, 2);
        await assert.rejects(call([row({ id: 'foreign', siteId: 'site-a' })]), denied);
        await assert.rejects(call([row({ siteId: 'site-b' })]), denied);
        await assert.rejects(call([row({ id: 'partial' }), row({ id: 'blocked', siteId: 'site-b' })]), denied);
        assert.equal((await db.doc('materialInbounds/partial').get()).exists, false);
        for (const uid of ['material-worker-account', 'material-unlinked', 'missing']) await assert.rejects(call([row()], {}, uid), denied);
        const batch = { id: 'photo-batch', siteId: 'site-a', transactionDate: '2026-10-17', transactionType: 'inbound', photos: [{ path: 'materials/inbound/2026-10-17/site-b/forged.jpg', name: 'test.jpg', size: 10 }] };
        await assert.rejects(call([row({ id: 'photo-entry', photoBatchId: batch.id })], { photoBatch: batch }), denied);
        assert.equal((await db.doc('materialInbounds/photo-entry').get()).exists, false);
        batch.photos[0].path = 'materials/inbound/2026-10-17/site-a/test.jpg';
        await call([row({ id: 'photo-entry', photoBatchId: batch.id })], { photoBatch: batch });
        assert.equal((await db.doc('materialPhotoBatches/photo-batch').get()).data()?.createdBy, 'material-leader');
        const photoRows = await readTeamScopedData({ collection: 'materialPhotoBatches' }, { auth: { uid: 'material-leader', token: {} } } as any);
        assert.deepEqual(photoRows.rows.map((photo: any) => photo.id), ['photo-batch']);
        await call([row({ id: 'out-entry' })], { direction: 'outbound' });
        assert.equal((await db.doc('materialOutbounds/out-entry').get()).data()?.quantity, 2);
        await call([row({ id: 'legacy-entry', siteId: 'site-legacy' })]);
        await assert.rejects(call([row({ id: 'photo-entry', siteId: 'site-legacy' })]), denied);
        await db.doc('sites/site-a').update({ responsibleTeamId: 'foreign-team' });
        await assert.rejects(call([row()]), denied);
        await db.doc('sites/site-a').update({ responsibleTeamId: 'material-team' });
        await db.doc('workers/material-worker').update({ isActive: false });
        await assert.rejects(call([row()]), denied);
        await db.doc('workers/material-worker').update({ isActive: true });
        await db.doc('users/material-leader').update({ status: 'suspended' });
        await assert.rejects(call([row()]), denied);
        assert.equal((await db.doc('materialInbounds/foreign').get()).data()?.quantity, 99);
    } finally {
        const logs = await db.collection('material_logs').where('source', '==', 'teamMaterialTransactions').get();
        await Promise.all([...Object.keys(fixtures), 'materialInbounds/entry', 'materialInbounds/photo-entry', 'materialInbounds/legacy-entry', 'materialPhotoBatches/photo-batch', 'materialOutbounds/out-entry', ...logs.docs.map(doc => doc.ref.path)].map(path => db.doc(path).delete()));
        await app.delete();
    }
});
