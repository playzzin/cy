import { strict as assert } from 'assert';
import { test } from 'node:test';
import * as admin from 'firebase-admin';
import { hashVehicleImportSource } from './vehicleImportIdentity';
import { fineSourceMimeType, readVehicleFineSource, saveVehicleFineSource, vehicleFineSourcePath } from './vehicleFineSource';

const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
test('고지서 원본은 허용된 사진·PDF만 표시하고 잘못된 경로를 거부한다', () => {
    assert.equal(fineSourceMimeType(Buffer.from(png, 'base64')), 'image/png');
    assert.equal(fineSourceMimeType(Buffer.from([255, 216, 255, 0])), 'image/jpeg');
    assert.equal(fineSourceMimeType(Buffer.from('RIFF0000WEBP')), 'image/webp');
    assert.equal(fineSourceMimeType(Buffer.from('%PDF-1.4')), 'application/pdf');
    for (const value of ['', '<svg></svg>', '<html></html>']) assert.throws(() => fineSourceMimeType(Buffer.from(value)));
    assert.throws(() => vehicleFineSourcePath('../private'));
});

test('등록→취소→재등록, AI 판독 변경, 실제 중복 방지와 사진 권한을 에뮬레이터에서 검증한다', { skip: !process.env.FIRESTORE_EMULATOR_HOST }, async () => {
    assert.equal(process.env.GCLOUD_PROJECT, 'demo-cy-vehicle-fine');
    assert(process.env.FIREBASE_STORAGE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST);
    const app = admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT, storageBucket: `${process.env.GCLOUD_PROJECT}.appspot.com` });
    const { commitVehicleFineImports, getVehicleFineNoticeAttachment, deleteVehicleFineNoticeAttachment } = await import('./vehicleFineAnalysis');
    const db = app.firestore();
    const context = { auth: { uid: 'fine-support', token: { role: 'support' } } } as any;
    const denied = (code: string) => (error: any) => error.code === code;
    const sourceSha256 = hashVehicleImportSource(png);
    const analysis = { sourceSha256, originalFileName: 'sample.png', licensePlate: '12가3456', violationDate: '2026-11-01', payableAmount: 32000, electronicPaymentNumber: '1234567' };
    let operation = 0;
    const commit = (payment = '1234567') => commitVehicleFineImports.run({ operationId: `test-fine-${++operation}`, items: [{ fileIndex: 0, vehicleId: 'fine-vehicle', manualMatch: false, expenseDate: '2026-11-01', payableAmount: 32000, analysis: { ...analysis, electronicPaymentNumber: payment } }] }, context);
    const photo = (expenseId: string, actor = context) => getVehicleFineNoticeAttachment.run({ expenseId }, actor);
    try {
        await db.doc('vehicles/fine-vehicle').set({ licensePlate: '12가3456' });
        await db.doc('users/fine-support').set({ role: 'support', status: 'active' });
        const first = await commit();
        assert.equal(first.createdCount, 1);
        const firstId = first.results[0].expenseId;
        assert.equal((await commit()).duplicateCount, 1);
        await assert.rejects(photo(firstId), denied('not-found'));
        await db.doc(`vehicleExpenses/${firstId}`).update({ status: 'CANCELLED', cancelledAt: admin.firestore.FieldValue.serverTimestamp() });
        const restored = await commit();
        assert.equal(restored.createdCount, 1);
        assert.equal(restored.results[0].expenseId, firstId);
        assert.equal((await db.doc(`vehicleExpenses/${firstId}`).get()).data()?.cancelledAt, null);
        await db.doc(`vehicleExpenses/${firstId}`).update({ status: 'CANCELLED' });
        const changed = await commit('7654321');
        assert.equal(changed.createdCount, 1);
        const changedId = changed.results[0].expenseId;
        assert.notEqual(changedId, firstId);
        assert.equal((await commit()).duplicateCount, 1, '같은 원본의 판독이 달라도 활성 건은 중복');
        await db.doc(`vehicleExpenses/${changedId}`).delete();
        assert.equal((await commit('7654321')).createdCount, 1, '실제 삭제 후에도 재등록');

        await Promise.all([saveVehicleFineSource({ base64: png, sourceSha256 }), saveVehicleFineSource({ base64: png, sourceSha256 })]);
        assert.deepEqual(await readVehicleFineSource(sourceSha256), { base64: png, mimeType: 'image/png' });
        assert.equal((await photo(changedId)).base64, png, '기존 기록도 같은 원본을 보관하면 연결');
        await assert.rejects(photo(changedId, {}), denied('unauthenticated'));
        await assert.rejects(photo(changedId, { auth: { uid: 'ordinary', token: {} } }), denied('permission-denied'));
        await assert.rejects(photo('../private'), denied('invalid-argument'));
        await assert.rejects(photo(firstId), denied('not-found'), '취소된 내역 사진 접근 차단');
        await assert.rejects(saveVehicleFineSource({ base64: png, sourceSha256: 'a'.repeat(64) }), denied('invalid-argument'));
        const [metadata] = await app.storage().bucket().file(vehicleFineSourcePath(sourceSha256)).getMetadata();
        assert(!metadata.metadata?.firebaseStorageDownloadTokens);
        const beforeRemoval = (await db.doc(`vehicleExpenses/${changedId}`).get()).data()!;
        await assert.rejects(deleteVehicleFineNoticeAttachment.run({ expenseId: changedId }, {} as any), denied('unauthenticated'));
        await assert.rejects(deleteVehicleFineNoticeAttachment.run({ expenseId: changedId }, { auth: { uid: 'ordinary', token: {} } } as any), denied('permission-denied'));
        await deleteVehicleFineNoticeAttachment.run({ expenseId: changedId }, context);
        assert.equal((await deleteVehicleFineNoticeAttachment.run({ expenseId: changedId }, context)).alreadyRemoved, true);
        const afterRemoval = (await db.doc(`vehicleExpenses/${changedId}`).get()).data()!;
        assert.equal(afterRemoval.amount, beforeRemoval.amount);
        assert.equal(afterRemoval.fineNotice.sourceSha256, beforeRemoval.fineNotice.sourceSha256);
        assert.equal(afterRemoval.fineNotice.attachmentRemoved, true);
        await assert.rejects(photo(changedId), denied('not-found'));
        assert.equal((await readVehicleFineSource(sourceSha256)).base64, png, '다른 고지서가 공유하는 원본과 감사 이력은 보존');

        const signUp = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'fine-test@example.test', password: 'test-password-only', returnSecureToken: true }),
        }).then(response => response.json()) as any;
        assert(signUp.idToken);
        await db.doc(`users/${signUp.localId}`).set({ status: 'active', role: 'support' });
        const storageUrl = `http://${process.env.FIREBASE_STORAGE_EMULATOR_HOST}/v0/b/${app.storage().bucket().name}/o/${encodeURIComponent(vehicleFineSourcePath(sourceSha256))}`;
        assert.equal((await fetch(storageUrl + '?alt=media', { headers: { Authorization: `Firebase ${signUp.idToken}` } })).status, 403);
        assert.equal((await fetch(storageUrl, { method: 'DELETE', headers: { Authorization: `Firebase ${signUp.idToken}` } })).status, 403);
    } finally { await app.delete(); }
});
