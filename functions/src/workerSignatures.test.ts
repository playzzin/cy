import { strict as assert } from 'assert';
import { test } from 'node:test';
import * as admin from 'firebase-admin';
import { handleWorkerSignature, signatureWorkerId } from './workerSignatures';

test('서명 경로는 작업자를 식별하고 다른 폴더와 잘못된 경로를 거부한다', () => {
    assert.equal(signatureWorkerId('signatures/worker_one_123456.png'), 'worker_one');
    assert.equal(signatureWorkerId('signatures/worker_one/random.png'), 'worker_one');
    for (const path of ['other/worker_1.png', 'signatures/../file.png', 'signatures/worker/../../file.png']) assert.throws(() => signatureWorkerId(path));
});

test('서명은 본인 또는 현재 담당자만 읽고 공개 토큰 없이 저장한다', { skip: !process.env.FIRESTORE_EMULATOR_HOST }, async () => {
    assert.equal(process.env.GCLOUD_PROJECT, 'demo-team-worker-request');
    const app = admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT, storageBucket: `${process.env.GCLOUD_PROJECT}.appspot.com` });
    const db = app.firestore(), bucket = app.storage().bucket();
    const call = (input: any, uid = 'signature-owner') => handleWorkerSignature(input, { auth: { uid, token: { role: 'admin' } } } as any);
    const bytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
    const legacy = 'signatures/signature-worker_123456.png';
    let savedPath = '';
    try {
        await db.doc('workers/signature-worker').set({ isActive: true });
        await db.doc('users/signature-owner').set({ status: 'active', role: 'user', linkedWorkerIds: ['signature-worker'] });
        await db.doc('users/signature-outsider').set({ status: 'active', role: 'user' });
        await db.doc('users/signature-office').set({ status: 'active', role: 'office' });
        await bucket.file(legacy).save(bytes, { resumable: false, metadata: { contentType: 'image/png' } });
        await assert.rejects(call({ action: 'read', path: legacy }, 'signature-outsider'), (e: any) => e.code === 'permission-denied');
        assert.equal((await call({ action: 'read', path: legacy })).dataUrl, `data:image/png;base64,${bytes.toString('base64')}`);
        assert.ok((await call({ action: 'read', path: legacy }, 'signature-office')).dataUrl);
        await assert.rejects(call({ action: 'save', workerId: 'signature-worker', dataUrl: 'data:image/png;base64,YWJj' }), (e: any) => e.code === 'invalid-argument');
        const saved = await call({ action: 'save', workerId: 'signature-worker', dataUrl: `data:image/png;base64,${bytes.toString('base64')}` });
        savedPath = saved.signatureUrl!.split(`${bucket.name}/`)[1];
        assert.equal((await db.doc('workers/signature-worker').get()).data()?.signatureUrl, saved.signatureUrl);
        assert.ok(!(await bucket.file(savedPath).getMetadata())[0].metadata?.firebaseStorageDownloadTokens);
        assert.deepEqual((await bucket.file(savedPath).download())[0], bytes);
        await db.doc('users/signature-owner').update({ status: 'suspended' });
        await assert.rejects(call({ action: 'read', path: savedPath }), (e: any) => e.code === 'permission-denied');
        await db.doc('users/signature-office').update({ role: 'user' });
        await assert.rejects(call({ action: 'read', path: legacy }, 'signature-office'), (e: any) => e.code === 'permission-denied');
    } finally {
        await Promise.all([legacy, savedPath].filter(Boolean).map(path => bucket.file(path).delete({ ignoreNotFound: true })));
        await Promise.all(['workers/signature-worker', 'users/signature-owner', 'users/signature-outsider', 'users/signature-office'].map(path => db.doc(path).delete()));
        await app.delete();
    }
});
