import { strict as assert } from 'assert';
import { test } from 'node:test';
import * as admin from 'firebase-admin';
import { bankPhotoPath, handleWorkerBankPhotos, validateBankPhoto } from './workerBankPhotos';

const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
test('사진 실제 바이트로 형식을 판별하고 변조·PDF·초과 용량을 거부한다', () => {
    assert.equal(validateBankPhoto(png).contentType, 'image/png');
    assert.deepEqual(validateBankPhoto(png).bytes, Buffer.from(png, 'base64'));
    assert.equal(validateBankPhoto(Buffer.concat([Buffer.from([255, 216, 255]), Buffer.alloc(30)]).toString('base64')).contentType, 'image/jpeg');
    for (const invalid of ['', 'not-base64!', Buffer.from('<svg>private</svg>').toString('base64'), Buffer.from('%PDF-invalid').toString('base64'), Buffer.alloc(6 * 1024 * 1024).toString('base64')]) assert.throws(() => validateBankPhoto(invalid));
});

test('원본 보존·권한·동시 변경·재시도·서버 전용 저장을 실제 에뮬레이터에서 검사한다', { skip: !process.env.FIRESTORE_EMULATOR_HOST }, async () => {
    assert.equal(process.env.GCLOUD_PROJECT, 'demo-team-worker-request');
    assert(process.env.FIREBASE_STORAGE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST);
    const app = admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT, storageBucket: `${process.env.GCLOUD_PROJECT}.appspot.com` });
    const db = app.firestore(), bucket = app.storage().bucket();
    const fixtures: Record<string, any> = {
        'settings/menus_v12': { admin: { positionConfig: [{ id: 'lead', name: '팀장' }, { id: 'office', name: '사무실' }] } },
        'teams/a': { name: '가상 A', legacyId: 'legacy-a', isActive: true }, 'teams/b': { name: '가상 B', isActive: true },
        'workers/lead': { name: '가상 팀장', teamId: 'legacy-a', role: '팀장', isActive: true },
        'workers/one': { name: '가상 원본', teamId: 'a', fileNameSaved: 'untouched-id', bankName: '기존은행', accountNumber: 'unchanged', accountHolder: '기존예금주' },
        'workers/two': { name: '가상 원본 2', teamId: 'legacy-a' }, 'workers/other': { name: '다른팀', teamId: 'b' },
        'users/leader': { status: 'active', position: 'pos_lead', linkedWorkerIds: ['lead'] },
        'users/office': { status: 'active', position: 'pos_office' },
        'users/ordinary': { status: 'active', role: 'user', linkedWorkerIds: ['one'] },
    };
    const call = (input: any, uid = 'leader') => handleWorkerBankPhotos(input, { auth: { uid, token: { role: 'admin' } } } as any);
    const denied = (code: string) => (error: any) => error.code === code;
    const photoId = 'a'.repeat(32), nextId = 'b'.repeat(32);
    const save = { action: 'save', workerId: 'one', photoId, expectedPhotoId: '', base64: png, accountNumber: 'must-not-change' };
    try {
        for (const [path, row] of Object.entries(fixtures)) await db.doc(path).set(row);
        await assert.rejects(handleWorkerBankPhotos(save, {} as any), denied('unauthenticated'));
        await assert.rejects(call({ ...save, workerId: '../one' }), denied('invalid-argument'));
        await assert.rejects(call({ ...save, workerId: 'other' }), denied('permission-denied'));
        await assert.rejects(call(save, 'ordinary'), denied('permission-denied'));
        assert.deepEqual(await call({ action: 'read', workerId: 'one' }), { photo: null });
        assert.deepEqual(await call(save), { photoId });
        assert.deepEqual((await bucket.file(bankPhotoPath('one', photoId)).download())[0], Buffer.from(png, 'base64'));
        assert.ok(!(await bucket.file(bankPhotoPath('one', photoId)).getMetadata())[0].metadata?.firebaseStorageDownloadTokens);
        const worker = (await db.doc('workers/one').get()).data()!;
        assert.equal(worker.fileNameSaved, 'untouched-id'); assert.equal(worker.accountNumber, 'unchanged');
        assert.equal(worker.bankName, '기존은행'); assert.equal(worker.accountHolder, '기존예금주');
        assert.equal((await call({ action: 'read', workerId: 'one' }) as any).photo.base64, png);
        assert.equal((await call({ action: 'read', workerId: 'one' }, 'office') as any).photo.base64, png);
        await assert.rejects(call({ action: 'read', workerId: 'one' }, 'ordinary'), denied('permission-denied'));
        await call(save); // Lost response retry must be idempotent.
        assert.equal((await db.collection('audit_logs').where('category', '==', 'WORKER_BANK_PHOTO').get()).size, 1);
        await assert.rejects(call({ ...save, base64: Buffer.concat([Buffer.from(png, 'base64'), Buffer.from('changed')]).toString('base64') }), denied('already-exists'));
        await assert.rejects(call({ ...save, photoId: nextId, expectedPhotoId: '' }), denied('aborted'));
        await call({ ...save, photoId: nextId, expectedPhotoId: photoId });
        const replaced = (await db.doc('workers/one').get()).data()!;
        assert.equal(replaced.accountNumber, 'unchanged');
        assert.equal(replaced.bankName, '기존은행'); assert.equal(replaced.accountHolder, '기존예금주');
        // Updating payment details independently must leave the shareable original intact.
        await db.doc('workers/one').update({ bankName: '변경은행', accountNumber: 'new-number', accountHolder: '변경예금주' });
        assert.equal((await call({ action: 'read', workerId: 'one' }) as any).photo.base64, png);
        assert.equal((await db.doc('workers/one').get()).data()!.bankPhotoId, nextId);
        assert.equal((await bucket.file(bankPhotoPath('one', photoId)).exists())[0], false);
        // Two purposes may use identical bytes and IDs, but have independent paths and versions.
        const directSave = { ...save, action: 'saveDirectPay', photoId: nextId, expectedPhotoId: '' };
        assert.deepEqual(await call({ action: 'readDirectPay', workerId: 'one' }), { photo: null });
        await assert.rejects(call({ ...directSave, workerId: 'other' }), denied('permission-denied'));
        await assert.rejects(call(directSave, 'ordinary'), denied('permission-denied'));
        await call(directSave);
        await call(directSave);
        assert.equal((await call({ action: 'readDirectPay', workerId: 'one' }) as any).photo.base64, png);
        assert.equal((await db.doc('workers/one').get()).data()!.bankPhotoId, nextId);
        assert.equal((await db.doc('workers/one').get()).data()!.directPayBankPhotoId, nextId);
        assert.notEqual(bankPhotoPath('one', nextId), bankPhotoPath('one', nextId, true));
        await assert.rejects(call({ ...directSave, photoId, expectedPhotoId: '' }), denied('aborted'));
        await call({ ...directSave, photoId, expectedPhotoId: nextId });
        assert.equal((await bucket.file(bankPhotoPath('one', nextId, true)).exists())[0], false);
        assert.equal((await bucket.file(bankPhotoPath('one', nextId)).exists())[0], true);
        await call({ ...save, photoId, expectedPhotoId: nextId });
        assert.equal((await call({ action: 'readDirectPay', workerId: 'one' }) as any).photo.photoId, photoId);
        assert.equal((await bucket.file(bankPhotoPath('one', photoId, true)).exists())[0], true);
        assert.equal((await db.doc('workers/one').get()).data()!.accountNumber, 'new-number');
        // Deleting a direct-pay account removes its original and all fields together, preserving the basic account.
        await db.doc('workers/one').update({ directPayBankName: '직불은행', directPayAccountNumber: '001234567890', directPayAccountHolder: '다른예금주' });
        const deletion = { action: 'deleteDirectPayAccount', workerId: 'one', expectedAccount: {
            bankName: '직불은행', accountNumber: '001234567890', accountHolder: '다른예금주', photoId,
        } };
        await assert.rejects(call(deletion, 'ordinary'), denied('permission-denied'));
        await assert.rejects(call(deletion, 'leader'), denied('permission-denied'));
        await assert.rejects(call({ ...deletion, workerId: 'other' }), denied('permission-denied'));
        await assert.rejects(call({ ...deletion, expectedAccount: { ...deletion.expectedAccount, accountNumber: 'stale' } }, 'office'), denied('aborted'));
        await assert.rejects(call({ ...deletion, expectedAccount: undefined }), denied('invalid-argument'));
        assert.equal((await db.doc('workers/one').get()).data()!.directPayBankPhotoId, photoId);
        const basicBeforeDelete = (await db.doc('workers/one').get()).data()!;
        assert.deepEqual(await call(deletion, 'office'), { deleted: true });
        const deleted = (await db.doc('workers/one').get()).data()!;
        for (const field of ['directPayBankName', 'directPayAccountNumber', 'directPayAccountHolder', 'directPayBankPhotoId']) assert.equal(deleted[field], '');
        for (const field of ['bankName', 'accountNumber', 'accountHolder', 'bankPhotoId', 'fileNameSaved']) assert.equal(deleted[field], basicBeforeDelete[field]);
        assert.equal((await bucket.file(bankPhotoPath('one', photoId, true)).exists())[0], false);
        assert.equal((await bucket.file(bankPhotoPath('one', photoId)).exists())[0], true);
        assert.deepEqual(await call({ action: 'readDirectPay', workerId: 'one' }), { photo: null });
        await call(deletion, 'office');
        assert.equal((await db.collection('audit_logs').where('action', '==', 'DELETE_ACCOUNT').get()).size, 1);
        // An account without a photo is also removable; a failed old request cannot delete a new account.
        await db.doc('workers/one').update({ directPayBankName: '새은행', directPayAccountNumber: '000111222333', directPayAccountHolder: '가상 원본' });
        await assert.rejects(call(deletion, 'office'), denied('aborted'));
        await call({ ...deletion, expectedAccount: { bankName: '새은행', accountNumber: '000111222333', accountHolder: '가상 원본', photoId: '' } }, 'office');
        // Photo-only deletion preserves both account fields, the other purpose and the ID card.
        await call({ ...directSave, photoId, expectedPhotoId: '' });
        await db.doc('workers/one').update({ directPayBankName: '사진삭제은행', directPayAccountNumber: '0012345678', directPayAccountHolder: '가상 원본' });
        for (const [action, field, otherField, isDirect] of [
            ['deleteDirectPayPhoto', 'directPayBankPhotoId', 'bankPhotoId', true],
            ['deletePhoto', 'bankPhotoId', 'directPayBankPhotoId', false],
        ] as const) {
            const request = { action, workerId: 'one', expectedPhotoId: photoId };
            const before = (await db.doc('workers/one').get()).data()!;
            await assert.rejects(call(request, 'ordinary'), denied('permission-denied'));
            await assert.rejects(call(request, 'leader'), denied('permission-denied'));
            await assert.rejects(call({ ...request, expectedPhotoId: nextId }, 'office'), denied('aborted'));
            await assert.rejects(call({ ...request, expectedPhotoId: '' }, 'office'), denied('invalid-argument'));
            assert.deepEqual(await call(request, 'office'), { deleted: true });
            const after = (await db.doc('workers/one').get()).data()!;
            assert.equal(after[field], '');
            for (const key of ['bankName', 'accountNumber', 'accountHolder', 'directPayBankName', 'directPayAccountNumber', 'directPayAccountHolder', 'fileNameSaved', otherField]) assert.equal(after[key], before[key]);
            assert.equal((await bucket.file(bankPhotoPath('one', photoId, isDirect)).exists())[0], false);
            await call(request, 'office');
        }
        assert.equal((await db.collection('audit_logs').where('action', '==', 'DELETE_PHOTO').get()).size, 2);
        await assert.rejects(call({ ...save, action: 'unknown' }), denied('invalid-argument'));
        await call({ ...save, workerId: 'two', photoId: 'c'.repeat(32) });
        // A real authenticated browser is still unable to read or overwrite this private namespace.
        const signUp = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'bank-photo-test@example.test', password: 'test-only-password', returnSecureToken: true }),
        }).then(response => response.json()) as any;
        assert(signUp.idToken);
        await db.doc(`users/${signUp.localId}`).set({ status: 'active', role: 'office' });
        const storageUrl = `http://${process.env.FIREBASE_STORAGE_EMULATOR_HOST}/v0/b/${bucket.name}/o/${encodeURIComponent(bankPhotoPath('one', nextId))}`;
        assert.equal((await fetch(storageUrl + '?alt=media', { headers: { Authorization: `Firebase ${signUp.idToken}` } })).status, 403);
        assert.equal((await fetch(storageUrl, { method: 'DELETE', headers: { Authorization: `Firebase ${signUp.idToken}` } })).status, 403);
        await db.doc('workers/one').update({ teamId: 'b' });
        await assert.rejects(call({ action: 'read', workerId: 'one' }), denied('permission-denied'));
        await assert.rejects(call({ ...save, expectedPhotoId: nextId }), denied('permission-denied'));
        await db.doc('users/leader').update({ status: 'suspended' });
        await assert.rejects(call({ action: 'read', workerId: 'two' }), denied('permission-denied'));
        await db.doc('users/office').update({ position: 'user' });
        await assert.rejects(call({ action: 'read', workerId: 'one' }, 'office'), denied('permission-denied'));
        const logs = await db.collection('audit_logs').where('category', '==', 'WORKER_BANK_PHOTO').get();
        assert(!JSON.stringify(logs.docs.map(doc => doc.data())).includes(png));
        assert(!JSON.stringify(logs.docs.map(doc => doc.data())).includes('unchanged'));
    } finally { await app.delete(); }
});
