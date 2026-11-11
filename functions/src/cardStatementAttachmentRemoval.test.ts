import { strict as assert } from 'assert';
import { test } from 'node:test';
import * as admin from 'firebase-admin';
import { removeCardStatementAttachment } from './cardStatementAttachmentRemoval';
import { getCardStatementFileAnalysisId } from './cardStatementFileDetails';

test('attachment removal rejects unrelated paths and months before accessing data', async () => {
    for (const storagePath of ['', '../private', 'vehicle-fine-notices/hash', 'card-ledger-statements/2026-10/../a.pdf']) {
        await assert.rejects(removeCardStatementAttachment({} as any, { storagePath }, 'support'), /경로/);
    }
    await assert.rejects(removeCardStatementAttachment({} as any, { storagePath: 'card-ledger-statements/2026-10/a.pdf', yearMonth: '2026-09' }, 'support'), /월/);
});

test('Firestore: removing one of two attachments preserves financial rows, provenance and other files', { skip: !process.env.FIRESTORE_EMULATOR_HOST }, async () => {
    assert.equal(process.env.GCLOUD_PROJECT, 'demo-card-upload-cancellation');
    const app = admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT });
    const db = app.firestore();
    const first = 'card-ledger-statements/2026-10/card/first.pdf';
    const second = 'card-ledger-statements/2026-10/card/second.pdf';
    const analysisRef = db.doc(`cardStatementFileAnalyses/${getCardStatementFileAnalysisId(first)}`);
    const fixtures = {
        'users/attachment-worker': { role: 'worker', status: 'active' },
        'users/attachment-support': { role: 'support', status: 'active' },
        'cardTransactions/attachment-tx': { yearMonth: '2026-10', amount: 17000, evidenceUrl: first, statementAttachmentPaths: [first, second], statementSourceSha256: 'e'.repeat(64) },
        'cardBillings/attachment-bill': { yearMonth: '2026-10', status: 'PAID', totalAmount: 17000, lineItems: [{ amount: 17000 }], statementAttachmentPaths: [first, second] },
        'cardTransactions/attachment-unrelated': { yearMonth: '2026-10', amount: 9000, evidenceUrl: second, statementAttachmentPaths: [second] },
        'cardStatementImportFiles/attachment-file': { yearMonth: '2026-10', storagePath: first, jobId: 'attachment-job', status: 'completed' },
        'cardStatementImportJobs/attachment-job': { yearMonth: '2026-10', status: 'completed' },
        'cardStatementImportSourceClaims/attachment-claim': { state: 'committed', ownerFileId: 'attachment-file' },
    };
    try {
        const batch = db.batch();
        Object.entries(fixtures).forEach(([path, data]) => batch.set(db.doc(path), data));
        await batch.commit();
        const { deleteCardStatementAttachment } = await import('./cardBillingStatementAnalysis');
        const input = { storagePath: first };
        await assert.rejects(deleteCardStatementAttachment.run(input, {} as any), (e: any) => e.code === 'unauthenticated');
        await assert.rejects(deleteCardStatementAttachment.run(input, { auth: { uid: 'attachment-worker', token: {} } } as any), (e: any) => e.code === 'permission-denied');
        await db.doc('cardStatementImportJobs/attachment-job').update({ status: 'committing' });
        await assert.rejects(removeCardStatementAttachment(db, input, 'support'), /진행 중/);
        await db.doc('cardStatementImportJobs/attachment-job').update({ status: 'completed' });
        await analysisRef.set({ storagePath: first, analysisStatus: 'analyzing', analysisStartedAtMillis: Date.now() });
        await assert.rejects(removeCardStatementAttachment(db, input, 'support'), /분석이 끝난/);
        await analysisRef.update({ analysisStatus: 'completed' });
        const responses = await Promise.all([1, 2].map(() => deleteCardStatementAttachment.run(input, { auth: { uid: 'attachment-support', token: {} } } as any)));
        assert.deepEqual(responses.map(r => r.alreadyRemoved).sort(), [false, true]);
        const tx = (await db.doc('cardTransactions/attachment-tx').get()).data()!;
        assert.equal(tx.amount, 17000); assert.equal(tx.evidenceUrl, second);
        assert.deepEqual(tx.statementAttachmentPaths, [second]);
        assert.equal(tx.statementSourceSha256, 'e'.repeat(64));
        const bill = (await db.doc('cardBillings/attachment-bill').get()).data()!;
        assert.equal(bill.totalAmount, 17000); assert.equal(bill.status, 'PAID');
        assert.deepEqual(bill.lineItems, [{ amount: 17000 }]); assert.deepEqual(bill.statementAttachmentPaths, [second]);
        for (const path of ['cardTransactions/attachment-unrelated', 'cardStatementImportSourceClaims/attachment-claim']) assert.deepEqual((await db.doc(path).get()).data(), fixtures[path as keyof typeof fixtures]);
        assert.equal((await db.doc('cardStatementImportFiles/attachment-file').get()).data()?.attachmentRemoved, true);
        assert.equal((await analysisRef.get()).data()?.attachmentRemovedByUid, 'attachment-support');
    } finally { await app.delete(); }
});
