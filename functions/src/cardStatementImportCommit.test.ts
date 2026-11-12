import { strict as assert } from 'assert';
import { test } from 'node:test';
import * as admin from 'firebase-admin';
import {
    buildCardStatementSourceClaimDocumentId,
    buildCardStatementTransactionDocumentId,
    hashCardStatementSource,
} from './cardStatementImportIdentity';

test('Firestore: reimport restores the same transaction id and clears historical cancellation metadata', {
    skip: !process.env.FIRESTORE_EMULATOR_HOST,
}, async () => {
    const app = admin.initializeApp({ projectId: 'demo-card-upload-cancellation' });
    const db = app.firestore();
    const { claimCardStatementImportSources, commitCardStatementBillingGroupTransaction } = await import('./cardBillingStatementAnalysis');
    const yearMonth = '2026-10';
    const actor = { uid: 'commit-test', name: 'Synthetic tester', email: null };
    const seed = async (suffix: string) => {
        const jobId = `commit-job-${suffix}`;
        const fileId = `commit-file-${suffix}`;
        const resultId = `commit-result-${suffix}`;
        const cardId = `commit-card-${suffix}`;
        const billingId = `commit-billing-${suffix}`;
        const sourceSha256 = hashCardStatementSource(Buffer.from(`synthetic-pdf-${suffix}`));
        const storagePath = `card-billing-statements/${yearMonth}/imports/${jobId}/statement.pdf`;
        const row = { date: '2026-10-02', merchant: 'Synthetic merchant', amount: 12000, category: 'MEAL', memo: '' };
        const identity = { cardLast4: '0000', subtotalAmount: row.amount, transactions: [row] };
        const transactionId = buildCardStatementTransactionDocumentId({ yearMonth, cardId, sourceSha256, result: identity, transactionIndex: 0 });
        const fileRef = db.doc(`cardStatementImportFiles/${fileId}`);
        const resultRef = db.doc(`cardStatementImportResults/${resultId}`);
        const transactionRef = db.doc(`cardTransactions/${transactionId}`);
        const claimRef = db.doc(`cardStatementImportSourceClaims/${buildCardStatementSourceClaimDocumentId(sourceSha256)}`);
        const operationId = `card-statement-import:${jobId}`;
        const transactionPayload = {
            id: transactionId, cardId, yearMonth, ...row, status: 'ACTIVE',
            evidenceUrl: storagePath, statementAttachmentPaths: [storagePath], statementSourceSha256: sourceSha256,
            operationId, lastOperationId: operationId,
        };
        const batch = db.batch();
        batch.set(db.doc(`cardStatementImportJobs/${jobId}`), { yearMonth, status: 'reviewing' });
        batch.set(fileRef, { jobId, yearMonth, sha256: sourceSha256, storagePath, status: 'completed' });
        batch.set(resultRef, { jobId, fileId, status: 'matched', matchedCardId: cardId, sourceSha256 });
        batch.set(transactionRef, {
            ...transactionPayload, status: 'CANCELLED', cancelledAt: admin.firestore.Timestamp.fromMillis(1000),
            cancelledByUid: 'previous-actor', lastOperationId: 'previous-cancellation',
        });
        batch.set(claimRef, { ownerJobId: 'previous-job', ownerFileId: 'previous-file', state: 'released', committedTransactionIds: [transactionId] });
        await batch.commit();
        const prepared = {
            resultId, billingId, billingTarget: { teamId: 'synthetic-team', teamName: 'Synthetic team', issuedToType: 'team' as const },
            transactionUpserts: [transactionPayload], lineItems: [], statementPath: storagePath,
        };
        const group = {
            card: { id: cardId }, target: prepared, resultIds: [resultId],
            resultMarkers: new Map([[resultId, { transactionIds: [transactionId], lineItemIds: [], statementPath: storagePath, sourceSha256, sourceFileId: fileId }]]),
            statementPaths: new Set([storagePath]), lineItems: [], transactionUpserts: [transactionPayload],
        };
        const claim = () => claimCardStatementImportSources({
            db, jobId, yearMonth, actor,
            files: [{ id: fileId, ref: fileRef, fileIndex: 0, sourceSha256, storagePath, data: {} }],
        });
        const commit = () => commitCardStatementBillingGroupTransaction({ db, billingId, group, jobId, yearMonth, operationId, actor });
        return { jobId, fileId, fileRef, resultRef, transactionRef, claimRef, transactionId, billingId, operationId, claim, commit };
    };
    try {
        const restored = await seed('restored');
        const cancelledFile = await seed('cancelled-file');
        await cancelledFile.fileRef.update({ status: 'cancelled' });
        await assert.rejects(cancelledFile.claim(), /취소된 업로드/);
        assert.equal((await cancelledFile.transactionRef.get()).data()?.status, 'CANCELLED');
        assert.equal((await cancelledFile.claimRef.get()).data()?.state, 'released');

        const ownership = await restored.claim();
        assert.equal([...ownership.ownedFileBySha256.values()][0], restored.fileId);
        assert.deepEqual((await restored.claimRef.get()).data()?.committedTransactionIds, []);
        const saved = await restored.commit();
        assert.equal(saved.committedTransactions, 1);
        const transaction = (await restored.transactionRef.get()).data()!;
        assert.equal(transaction.id, restored.transactionId);
        assert.equal(transaction.amount, 12000);
        assert.equal(transaction.status, 'ACTIVE');
        assert.equal(transaction.cancelledAt, undefined);
        assert.equal(transaction.cancelledByUid, undefined);
        assert.equal(transaction.lastOperationId, restored.operationId);
        assert.equal(transaction.evidenceUrl, transaction.statementAttachmentPaths[0]);
        assert.deepEqual((await restored.resultRef.get()).data()?.committedTransactionIds, [restored.transactionId]);
        assert.equal((await restored.resultRef.get()).data()?.status, 'committed');
        assert.equal((await restored.commit()).committedTransactions, 0, 'repeating the same commit remains idempotent');
        assert.equal((await cancelledFile.fileRef.get()).data()?.status, 'cancelled');
        assert.equal((await cancelledFile.transactionRef.get()).data()?.status, 'CANCELLED', 'unrelated cancelled transactions stay cancelled');

        const excluded = await seed('excluded-result');
        await excluded.claim();
        await excluded.resultRef.update({ status: 'excluded', cancelledAt: admin.firestore.Timestamp.fromMillis(1000) });
        assert.equal((await excluded.commit()).committedTransactions, 0);
        assert.equal((await excluded.transactionRef.get()).data()?.status, 'CANCELLED', 'excluded import results cannot restore cancelled rows');

        for (const status of ['CONFIRMED', 'PAID', 'OVERDUE']) {
            const protectedImport = await seed(status);
            await protectedImport.claim();
            await db.doc(`cardBillings/${protectedImport.billingId}`).set({ status, totalAmount: 0 });
            const before = (await protectedImport.transactionRef.get()).data();
            const rejected = await protectedImport.commit();
            assert.equal(rejected.committedTransactions, 0);
            assert.equal(rejected.skippedResults, 1);
            assert.deepEqual(rejected.protectedBillingIds, [protectedImport.billingId]);
            assert.deepEqual((await protectedImport.transactionRef.get()).data(), before);
            assert.equal((await protectedImport.resultRef.get()).data()?.status, 'failed');
        }
    } finally {
        await app.delete();
    }
});
