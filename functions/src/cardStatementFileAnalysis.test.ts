import { strict as assert } from 'assert';
import { test } from 'node:test';
import * as admin from 'firebase-admin';
import { PDFDocument } from 'pdf-lib';
import { getCardStatementFileAnalysisId } from './cardStatementFileDetails';

// Every networked persistence operation in this test targets local demo emulators.
test('stored statement API persists Gemini details, preserves posted bills, and keeps prior details after failure', {
    skip: !process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_STORAGE_EMULATOR_HOST,
}, async () => {
    const projectId = 'demo-card-statement-details';
    const app = admin.initializeApp({ projectId, storageBucket: `${projectId}.appspot.com` });
    const db = app.firestore();
    const originalFetch = global.fetch;
    const storagePath = 'card-ledger-statements/2026-09/card-1234/row-1/test.pdf';
    const file = { jobId: 'job-completed', yearMonth: '2026-09', fileIndex: 0, storagePath,
        originalFileName: 'test.pdf', mimeType: 'application/pdf', size: 100, status: 'completed',
        cardCount: 1, transactionCount: 0, warnings: [] };
    const context = { auth: { uid: 'ordinary-user', token: {} } } as any;
    let apiCalls = 0;
    try {
        const batch = db.batch();
        const fixtures = {
            'users/ordinary-user': { role: 'worker', status: 'active' },
            'users/suspended-user': { role: 'admin', status: 'suspended' },
            'server_settings/ai': { apiKey: 'local-fixture-key', model: 'gemini-3.5-flash' },
            'cards/card-1234': { name: '검증카드', last4: '1234' },
            'cardStatementImportJobs/job-completed': { yearMonth: '2026-09', status: 'completed' },
            'cardStatementImportFiles/file-1': file,
            'cardStatementImportResults/committed-1': { fileId: 'file-1', jobId: 'job-completed',
                status: 'committed', analysisSource: 'fast_text', subtotalAmount: 9000,
                transactions: [{ date: '2026-09-01', merchant: '청구 합계', amount: 9000, category: 'OTHER', confidence: 1 }] },
            'cardBillings/bill-posted': { status: 'PAID', totalAmount: 9000 },
            'cardTransactions/tx-posted': { amount: 9000, status: 'ACTIVE' },
        };
        Object.entries(fixtures).forEach(([path, value]) => batch.set(db.doc(path), value));
        await batch.commit();
        const pdf = await PDFDocument.create();
        pdf.addPage();
        await app.storage().bucket().file(storagePath).save(Buffer.from(await pdf.save()), { contentType: 'application/pdf' });

        global.fetch = (async (_url, init) => {
            apiCalls += 1;
            const request = JSON.parse(String(init?.body));
            assert.ok(request.contents[0].parts[1].inlineData.data);
            return { ok: true, status: 200, text: async () => JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({
                bankName: '다른카드사', statementMonth: '2026-09', grandTotalAmount: 12000, warnings: [],
                cards: [{ cardLast4: '1234', cardName: '검증카드', holderName: '', subtotalAmount: 12000,
                    warnings: [], confidence: 1, transactions: [
                        { date: '2026-09-01', merchant: '테스트식당', amount: 15000, category: 'MEAL', memo: '', confidence: 1 },
                        { date: '2026-09-02', merchant: '환불', amount: -3000, category: 'MEAL', memo: '취소', confidence: 1 },
                    ] }],
            }) }] } }] }) } as any;
        }) as any;
        const { analyzeStoredCardStatementFile, getCardStatementFileDetail, listCardStatementFiles,
            commitCardStatementImportJob, cancelCardStatementImportFile } = await import('./cardBillingStatementAnalysis');
        await assert.rejects(getCardStatementFileDetail.run({ fileId: 'file-1' }, {} as any), (error: any) => error.code === 'unauthenticated');
        await assert.rejects(getCardStatementFileDetail.run({ fileId: 'file-1' }, { auth: { uid: 'suspended-user', token: { role: 'admin' } } } as any), (error: any) => error.code === 'permission-denied');
        await assert.rejects(getCardStatementFileDetail.run({ storagePath: 'users/private.pdf' }, context), (error: any) => error.code === 'invalid-argument');
        await assert.rejects(commitCardStatementImportJob.run({ jobId: 'job-completed' }, context), (error: any) => error.code === 'permission-denied');
        await assert.rejects(cancelCardStatementImportFile.run({ fileId: 'file-1' }, context), (error: any) => error.code === 'permission-denied');
        const beforeAnalysis: any = await getCardStatementFileDetail.run({ fileId: 'file-1' }, context);
        assert.equal(beforeAnalysis.analysisStatus, 'not_analyzed');
        assert.deepEqual(beforeAnalysis.results, [], 'A legacy billing summary is not itemized usage');

        const analyzed: any = await analyzeStoredCardStatementFile.run({ fileId: 'file-1' }, context);
        assert.equal(apiCalls, 1);
        assert.equal(analyzed.analysisStatus, 'completed');
        assert.equal(analyzed.file.grandTotalAmount, 12000);
        assert.equal(analyzed.results[0].transactions.length, 2);
        assert.equal(analyzed.results[0].transactions[1].amount, -3000);
        assert.equal(analyzed.file.grandTotalAvailable, true);
        assert.equal(analyzed.results[0].statementTotalAvailable, true);
        assert.equal(analyzed.results[0].transactionTotalAmount, 12000);
        assert.equal(analyzed.results[0].reconciliationDifference, 0);
        assert.equal(analyzed.results[0].reconciliationStatus, 'matched');
        const reopened: any = await getCardStatementFileDetail.run({ storagePath }, context);
        assert.deepEqual(reopened.results, analyzed.results);
        const stored = await db.doc(`cardStatementFileAnalyses/${getCardStatementFileAnalysisId(storagePath)}`).get();
        assert.equal(stored.data()?.analysisStatus, 'completed');
        for (const path of ['cardBillings/bill-posted', 'cardTransactions/tx-posted', 'cardStatementImportResults/committed-1', 'cardStatementImportJobs/job-completed', 'cardStatementImportFiles/file-1']) {
            assert.deepEqual((await db.doc(path).get()).data(), fixtures[path as keyof typeof fixtures]);
        }
        const history: any = await listCardStatementFiles.run({ yearMonth: '2026-09' }, context);
        assert.equal(history.files.length, 1);
        assert.equal(history.files[0].detailAnalysisStatus, 'completed');

        const successfulGeminiFetch = global.fetch;
        for (const cards of [[], [{ cardLast4: '1234', subtotalAmount: 12000, transactions: [] }]]) {
            global.fetch = (async () => ({ ok: true, status: 200, text: async () => JSON.stringify({
                candidates: [{ content: { parts: [{ text: JSON.stringify({ bankName: '검증카드',
                    statementMonth: '2026-09', grandTotalAmount: 12000, cards, warnings: [] }) }] } }],
            }) })) as any;
            await assert.rejects(analyzeStoredCardStatementFile.run({ fileId: 'file-1' }, context), /상세내역/);
            const emptyAnalysis: any = await getCardStatementFileDetail.run({ fileId: 'file-1' }, context);
            assert.equal(emptyAnalysis.analysisStatus, 'failed');
            assert.deepEqual(emptyAnalysis.results, analyzed.results, 'Empty analysis cannot replace prior itemized details');
        }
        global.fetch = (async () => { throw new Error('분석 서버 연결 실패'); }) as any;
        await assert.rejects(analyzeStoredCardStatementFile.run({ fileId: 'file-1' }, context), /연결 실패/);
        const afterFailure: any = await getCardStatementFileDetail.run({ fileId: 'file-1' }, context);
        assert.equal(afterFailure.analysisStatus, 'failed');
        assert.deepEqual(afterFailure.results, analyzed.results);
        await db.doc('cardStatementImportFiles/file-1').update({ status: 'cancelled' });
        assert.equal(((await getCardStatementFileDetail.run({ fileId: 'file-1' }, context)) as any).file.status, 'cancelled');
        await assert.rejects(analyzeStoredCardStatementFile.run({ fileId: 'file-1' }, context), /취소/);

        await db.doc('cardStatementImportFiles/file-1').update({ status: 'completed' });
        global.fetch = (async (...args: Parameters<typeof fetch>) => {
            await db.doc('cardStatementImportFiles/file-1').update({ status: 'cancelled' });
            return successfulGeminiFetch(...args);
        }) as any;
        await assert.rejects(analyzeStoredCardStatementFile.run({ fileId: 'file-1' }, context), /분석 중 명세서가 취소/);
        assert.deepEqual(((await getCardStatementFileDetail.run({ fileId: 'file-1' }, context)) as any).results, analyzed.results);

        // The ledger's plain Storage attachment also resolves without an import job.
        const standalonePath = storagePath.replace('test.pdf', 'standalone.pdf');
        await app.storage().bucket().file(standalonePath).save(Buffer.from(await pdf.save()), { contentType: 'application/pdf' });
        const standalone: any = await getCardStatementFileDetail.run({ storagePath: standalonePath }, context);
        assert.ok(standalone.file.id.startsWith('stored_'));
        assert.equal(standalone.job, null);
        assert.deepEqual(standalone.results, []);
        const unanalysedHistory: any = await listCardStatementFiles.run({ yearMonth: '2026-09' }, context);
        assert.ok(unanalysedHistory.files.some((entry: any) => entry.storagePath === standalonePath));
        const fromList: any = await getCardStatementFileDetail.run({ fileId: standalone.file.id, storagePath: standalonePath }, context);
        assert.equal(fromList.file.id, standalone.file.id);
        global.fetch = successfulGeminiFetch;
        await analyzeStoredCardStatementFile.run({ storagePath: standalonePath }, context);
        const legacyStored: any = await getCardStatementFileDetail.run({ fileId: standalone.file.id }, context);
        assert.equal(legacyStored.results[0].transactions.length, 2);
        const standaloneRef = db.doc(`cardStatementFileAnalyses/${getCardStatementFileAnalysisId(standalonePath)}`);
        await standaloneRef.update({ analysisStatus: 'analyzing', analysisStartedAtMillis: Date.now() });
        await assert.rejects(analyzeStoredCardStatementFile.run({ storagePath: standalonePath }, context), (error: any) => error.code === 'already-exists');
        await standaloneRef.update({ analysisStartedAtMillis: Date.now() - 600_001 });
        assert.equal((await getCardStatementFileDetail.run({ storagePath: standalonePath }, context)).analysisStatus, 'failed');
        assert.equal((await analyzeStoredCardStatementFile.run({ storagePath: standalonePath }, context)).analysisStatus, 'completed');
    } finally {
        global.fetch = originalFetch;
        await app.delete();
    }
});
