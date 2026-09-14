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
