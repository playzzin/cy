import { strict as assert } from 'assert';
import { test } from 'node:test';
import * as admin from 'firebase-admin';
import { assertCardStatementCancellationSafe, cancelStoredCardStatementFile } from './cardStatementImportCancellation';
import { buildCardStatementSourceClaimDocumentId } from './cardStatementImportIdentity';

test('zeroed ledger and cancelled history may cancel; any remaining amount is protected', () => {
    assert.doesNotThrow(() => assertCardStatementCancellationSafe('completed', [{ amount: 0 }, { amount: 100, status: 'CANCELLED' }], [{ totalAmount: 0, status: 'DRAFT' }]));
    for (const amount of [1, -1, 'invalid']) assert.throws(() => assertCardStatementCancellationSafe('completed', [{ amount }], []), /금액이 남아/);
    assert.throws(() => assertCardStatementCancellationSafe('completed', [], [{ status: 'DRAFT', totalAmount: 0, lineItems: [{ amount: 10 }] }]), /금액이 남아/);
});

test('Firestore: original deletion cleans attachments, protects shared sources and retries safely', { skip: !process.env.FIRESTORE_EMULATOR_HOST }, async () => {
    const app = admin.initializeApp({ projectId: 'demo-card-upload-cancellation' }, 'original-deletion');
    const db = app.firestore();
    const deletes: string[] = [];
    const options = { deleteOriginal: true, deleteStorageFile: async (path: string) => { deletes.push(path); } };
    const seed = async (suffix: string, overrides: Record<string, unknown> = {}) => {
        const fileId = `original-${suffix}`;
        const jobId = `original-job-${suffix}`;
        const sourcePath = `card-billing-statements/2026-10/imports/${jobId}/statement.pdf`;
        const fileRef = db.doc(`cardStatementImportFiles/${fileId}`);
        const txRef = db.doc(`cardTransactions/original-tx-${suffix}`);
        const billRef = db.doc(`cardBillings/original-bill-${suffix}`);
        const batch = db.batch();
        batch.set(fileRef, { jobId, yearMonth: '2026-10', storagePath: sourcePath, status: 'completed', ...overrides });
        batch.set(db.doc(`cardStatementImportJobs/${jobId}`), { yearMonth: '2026-10', status: 'completed' });
        batch.set(db.doc(`cardStatementImportResults/original-result-${suffix}`), { jobId, fileId, matchedCardId: `original-card-${suffix}`, status: 'committed' });
        batch.set(txRef, { yearMonth: '2026-10', cardId: `original-card-${suffix}`, amount: 0, evidenceUrl: sourcePath, statementAttachmentPaths: [sourcePath, 'unrelated.pdf'] });
        batch.set(billRef, { yearMonth: '2026-10', totalAmount: 0, status: 'DRAFT', statementAttachmentPaths: [sourcePath, 'unrelated.pdf'] });
        await batch.commit();
        return { fileId, fileRef, txRef, billRef, sourcePath };
    };
    try {
        const normal = await seed('normal');
        assert.deepEqual(await cancelStoredCardStatementFile(db, normal.fileId, 'tester', options), { ok: true, alreadyCancelled: false, originalDeleted: true });
        assert.deepEqual(deletes, [normal.sourcePath]);
        assert.equal((await normal.fileRef.get()).data()?.sourceDeletionStatus, 'deleted');
        assert.equal((await normal.txRef.get()).data()?.evidenceUrl, undefined);
        assert.deepEqual((await normal.txRef.get()).data()?.statementAttachmentPaths, ['unrelated.pdf']);
        assert.deepEqual((await normal.billRef.get()).data()?.statementAttachmentPaths, ['unrelated.pdf']);
        assert.equal((await db.doc(`cardStatementImportCancellations/${normal.fileId}`).get()).data()?.sourceDeletionStatus, 'deleted');
        assert.deepEqual(await cancelStoredCardStatementFile(db, normal.fileId, 'tester', options), { ok: true, alreadyCancelled: true, originalDeleted: true });
        assert.equal(deletes.length, 1);

        const retained = await seed('retained', { status: 'cancelled', cancelledByUid: 'previous-user' });
        // A later upload for the same card/hash must survive cleanup of an old path.
        const otherTx = db.doc('cardTransactions/original-new-upload');
        await otherTx.set({ yearMonth: '2026-10', cardId: 'original-card-retained', amount: 100, evidenceUrl: 'new-upload.pdf' });
        await cancelStoredCardStatementFile(db, retained.fileId, 'tester', options);
        assert.equal((await retained.fileRef.get()).data()?.cancelledByUid, 'previous-user');
        assert.equal((await otherTx.get()).data()?.evidenceUrl, 'new-upload.pdf');
        assert.equal((await otherTx.get()).data()?.amount, 100);
        assert.deepEqual((await retained.billRef.get()).data()?.statementAttachmentPaths, ['unrelated.pdf']);

        const retry = await seed('retry');
        await assert.rejects(cancelStoredCardStatementFile(db, retry.fileId, 'tester', {
            deleteOriginal: true, deleteStorageFile: async () => { throw new Error('storage unavailable'); },
        }), (error: any) => error.code === 'unavailable' && error.details?.sourceDeletionStatus === 'pending');
        assert.equal((await retry.fileRef.get()).data()?.status, 'cancelled');
        assert.equal((await retry.fileRef.get()).data()?.sourceDeletionStatus, 'pending');
        await cancelStoredCardStatementFile(db, retry.fileId, 'tester', options);
        assert.equal((await retry.fileRef.get()).data()?.sourceDeletionStatus, 'deleted');

        const guarded = await seed('guarded');
        const before = deletes.length;
        await guarded.txRef.update({ amount: 1 });
        await assert.rejects(cancelStoredCardStatementFile(db, guarded.fileId, 'tester', options), /금액이 남아/);
        await guarded.txRef.update({ amount: 0 });
        await guarded.billRef.update({ status: 'CONFIRMED' });
        await assert.rejects(cancelStoredCardStatementFile(db, guarded.fileId, 'tester', options), /확정된/);
        assert.equal(deletes.length, before);
        assert.equal((await guarded.fileRef.get()).data()?.status, 'completed');

        const shared = await seed('shared');
        const externalBill = db.doc('cardBillings/original-other-month');
        await externalBill.set({ yearMonth: '2026-11', totalAmount: 10, statementAttachmentPaths: [shared.sourcePath] });
        await assert.rejects(cancelStoredCardStatementFile(db, shared.fileId, 'tester', options), /금액이 남아/);
        await externalBill.update({ totalAmount: 0 });
        await cancelStoredCardStatementFile(db, shared.fileId, 'tester', options);
        assert.deepEqual((await externalBill.get()).data()?.statementAttachmentPaths, []);

        const duplicate = await seed('duplicate');
        await db.doc('cardStatementImportFiles/original-shared-file').set({ storagePath: duplicate.sourcePath, status: 'completed' });
        await assert.rejects(cancelStoredCardStatementFile(db, duplicate.fileId, 'tester', options), /다른 업로드/);

        const invalid = await seed('invalid', { storagePath: 'workers/private.pdf' });
        await assert.rejects(cancelStoredCardStatementFile(db, invalid.fileId, 'tester', options), /카드 명세서 보관 경로/);
        assert.equal((await invalid.fileRef.get()).data()?.status, 'completed');
    } finally {
        await app.delete();
    }
});

test('Storage emulator: confirmed deletion removes the object and tolerates an already missing original', {
    skip: !process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_STORAGE_EMULATOR_HOST,
}, async () => {
    const projectId = 'demo-card-upload-cancellation';
    const app = admin.initializeApp({ projectId, storageBucket: `${projectId}.appspot.com` });
    const db = app.firestore();
    try {
        for (const exists of [true, false]) {
            const fileId = `storage-original-${exists}`;
            const jobId = `storage-job-${exists}`;
            const sourcePath = `card-billing-statements/2026-10/imports/${jobId}/statement.pdf`;
            const object = app.storage().bucket().file(sourcePath);
            if (exists) await object.save(Buffer.from('%PDF-1.4\nfixture only'), { contentType: 'application/pdf' });
            await db.doc(`cardStatementImportJobs/${jobId}`).set({ yearMonth: '2026-10', status: 'completed' });
            await db.doc(`cardStatementImportFiles/${fileId}`).set({ jobId, yearMonth: '2026-10', storagePath: sourcePath, status: 'completed' });
            await cancelStoredCardStatementFile(db, fileId, 'tester', { deleteOriginal: true });
            assert.equal((await object.exists())[0], false);
            assert.equal((await db.doc(`cardStatementImportFiles/${fileId}`).get()).data()?.sourceDeletionStatus, 'deleted');
        }
    } finally {
        await app.delete();
    }
});

test('processing jobs and posted bills are protected even at zero', () => {
    for (const status of ['uploading', 'queued', 'analyzing', 'committing']) assert.throws(() => assertCardStatementCancellationSafe(status, [], []), /처리 중/);
    for (const status of ['CONFIRMED', 'PAID', 'OVERDUE']) assert.throws(() => assertCardStatementCancellationSafe('completed', [], [{ status, totalAmount: 0 }]), /확정된/);
});

test('invalid file ids never reach the database', async () => {
    for (const fileId of ['', 'other/file', 'x'.repeat(201)]) await assert.rejects(cancelStoredCardStatementFile({} as any, fileId, 'tester'), /파일을 선택/);
});

// Run against an isolated demo project only. Never initializes a production connection.
test('Firestore: cancellation is atomic, idempotent and releases only the owned source', { skip: !process.env.FIRESTORE_EMULATOR_HOST }, async () => {
    const projectId = 'demo-card-upload-cancellation';
    const app = admin.initializeApp({ projectId });
    const db = app.firestore();
    const hash = 'a'.repeat(64);
    const claimId = buildCardStatementSourceClaimDocumentId(hash);
    const seed = async (suffix: string, amount: number, claimFile: string) => {
        const fileId = `file-${suffix}`;
        const jobId = `job-${suffix}`;
        const path = `card-statement-imports/${jobId}/statement.pdf`;
        const batch = db.batch();
        batch.set(db.doc(`cardStatementImportFiles/${fileId}`), { jobId, yearMonth: '2026-09', storagePath: path, sha256: hash, status: 'completed' });
        batch.set(db.doc(`cardStatementImportJobs/${jobId}`), { yearMonth: '2026-09', status: 'completed' });
        batch.set(db.doc(`cardStatementImportResults/result-${suffix}`), { jobId, fileId, matchedCardId: `card-${suffix}`, status: 'committed', committedTransactionIds: [`tx-${suffix}`] });
        batch.set(db.doc(`cardTransactions/tx-${suffix}`), { yearMonth: '2026-09', cardId: `card-${suffix}`, amount, status: 'ACTIVE', evidenceUrl: path, statementAttachmentPaths: [path, 'another.pdf'], statementSourceSha256: hash });
        batch.set(db.doc(`cardStatementImportSourceClaims/${claimId}`), { ownerJobId: jobId, ownerFileId: claimFile, state: 'committed' });
        await batch.commit();
        return fileId;
    };
    try {
        const fileId = await seed('one', 100, 'file-one');
        await assert.rejects(cancelStoredCardStatementFile(db, fileId, 'tester'), /금액이 남아/);
        assert.equal((await db.doc(`cardStatementImportFiles/${fileId}`).get()).data()?.status, 'completed');
        assert.equal((await db.doc(`cardStatementImportSourceClaims/${claimId}`).get()).data()?.state, 'committed');
        await db.doc('cardTransactions/tx-one').update({ amount: 0 });
        assert.deepEqual(await cancelStoredCardStatementFile(db, fileId, 'tester'), { ok: true, alreadyCancelled: false });
        const tx = (await db.doc('cardTransactions/tx-one').get()).data()!;
        assert.equal(tx.amount, 0);
        assert.equal(tx.evidenceUrl, undefined);
        assert.deepEqual(tx.statementAttachmentPaths, ['another.pdf']);
        assert.equal((await db.doc(`cardStatementImportSourceClaims/${claimId}`).get()).data()?.state, 'released');
        assert.equal((await db.doc('cardStatementImportResults/result-one').get()).data()?.status, 'excluded');
        assert.deepEqual(await cancelStoredCardStatementFile(db, fileId, 'tester'), { ok: true, alreadyCancelled: true });
        const newFileRef = db.doc('cardStatementImportFiles/file-correct-month');
        await newFileRef.set({ jobId: 'job-correct-month', yearMonth: '2026-08', status: 'completed', sha256: hash });
        await db.doc('cardStatementImportJobs/job-correct-month').set({ yearMonth: '2026-08', status: 'reviewing' });
        const { claimCardStatementImportSources } = await import('./cardBillingStatementAnalysis');
        const newClaim = await claimCardStatementImportSources({
            db, jobId: 'job-correct-month', yearMonth: '2026-08', actor: { uid: 'tester', name: 'test', email: null },
            files: [{ id: newFileRef.id, ref: newFileRef, fileIndex: 0, sourceSha256: hash, storagePath: 'correct-month.pdf', data: {} }],
        });
        assert.equal(newClaim.ownedFileBySha256.get(hash), 'file-correct-month');
        assert.equal((await db.doc(`cardStatementImportSourceClaims/${claimId}`).get()).data()?.ownerYearMonth, '2026-08');
        await assert.rejects(claimCardStatementImportSources({
            db, jobId: 'job-correct-month', yearMonth: '2026-08', actor: { uid: 'tester', name: 'test', email: null },
            files: [{ id: newFileRef.id, ref: newFileRef, fileIndex: 0, sourceSha256: hash, storagePath: 'correct-month.pdf', data: {} }],
        }), /처리 중/);
        const duplicate = await seed('two', 0, 'some-other-file');
        await cancelStoredCardStatementFile(db, duplicate, 'tester');
        assert.equal((await db.doc(`cardStatementImportSourceClaims/${claimId}`).get()).data()?.state, 'committed');
        const { cancelCardStatementImportFile } = await import('./cardBillingStatementAnalysis');
        await assert.rejects(cancelCardStatementImportFile.run({ fileId }, {} as any), /Authentication is required/);
        await assert.rejects(cancelCardStatementImportFile.run({ fileId }, { auth: { uid: 'unauthorized', token: {} } } as any), /권한이 없습니다/);
    } finally {
        await app.delete();
    }
});
