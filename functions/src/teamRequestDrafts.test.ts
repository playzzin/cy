import { strict as assert } from 'assert';
import { test } from 'node:test';
import * as admin from 'firebase-admin';
import { maintainRequestDrafts } from './teamRequestDrafts';

test('오래된 미제출 첨부만 정리하고 최근·제출 자료와 다른 신청 파일을 보존한다', { skip: !process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_STORAGE_EMULATOR_HOST }, async () => {
    assert.equal(process.env.GCLOUD_PROJECT, 'demo-team-worker-request');
    const app = admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT, storageBucket: `${process.env.GCLOUD_PROJECT}.appspot.com` });
    const db = app.firestore(), bucket = app.storage().bucket();
    const old = '2000-01-01T00:00:00Z';
    try {
        for (const [collection, folder] of [['team_worker_requests', 'team-worker-documents'], ['team_expense_requests', 'team-expense-receipts']]) {
            const call = (input: any, reviewer = true) => maintainRequestDrafts(input, reviewer, collection, folder);
            for (const [id, status, date] of [['old', 'uploading', old], ['recent', 'uploading', new Date().toISOString()], ['pending', 'pending', old], ['approved', 'approved', old], ['rejected', 'rejected', old], ['retry', 'discarding', old]]) {
                await db.collection(collection).doc(id).set({ ownerUid: 'fixture-owner', status, createdAt: date });
                await db.collection(collection).doc(id).collection('files').doc('file').set({ fixture: true });
                await bucket.file(`${folder}/fixture-owner/${id}/file`).save('fixture');
            }
            await assert.rejects(call({ action: 'drafts' }, false), (e: any) => e.code === 'permission-denied');
            await assert.rejects(call({ action: 'discardDraft', id: 'old' }, false), (e: any) => e.code === 'permission-denied');
            const page: any = await call({ action: 'drafts' });
            assert.deepEqual(page.drafts.map((row: any) => row.id), ['old', 'retry']);
            for (const id of ['recent', 'pending', 'approved', 'rejected']) await assert.rejects(call({ action: 'discardDraft', id }), (e: any) => e.code === 'failed-precondition');
            // A stale listing cannot authorize deletion after a user resumes work.
            await db.collection(collection).doc('old').update({ updatedAt: new Date().toISOString() });
            await assert.rejects(call({ action: 'discardDraft', id: 'old' }), (e: any) => e.code === 'failed-precondition');
            await db.collection(collection).doc('old').update({ updatedAt: old });
            for (const id of ['old', 'retry']) {
                await Promise.all([call({ action: 'discardDraft', id }), call({ action: 'discardDraft', id })]);
                await call({ action: 'discardDraft', id });
                assert.equal((await db.collection(collection).doc(id).get()).data()?.status, 'discarded');
                assert.equal((await db.collection(collection).doc(id).collection('files').get()).size, 0);
                assert.equal((await bucket.file(`${folder}/fixture-owner/${id}/file`).exists())[0], false);
            }
            assert.equal((await bucket.file(`${folder}/fixture-owner/pending/file`).exists())[0], true);
            await db.recursiveDelete(db.collection(collection));
            await bucket.deleteFiles({ prefix: `${folder}/fixture-owner/` });
        }
    } finally { await app.delete(); }
});
