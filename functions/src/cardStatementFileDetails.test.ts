import { strict as assert } from 'assert';
import { test } from 'node:test';
import {
    assertCardStatementStoragePath,
    chunkCardStatementDetailResults,
    getCardStatementFileAnalysisId,
    getCardStatementDetailAnalysisState,
    isActiveCardStatementProfile,
    joinCardStatementDetailChunks,
    resolveCardStatementYearMonth,
} from './cardStatementFileDetails';

test('statement access accepts active ordinary profiles but rejects absent and inactive profiles', () => {
    assert.equal(isActiveCardStatementProfile(true, { role: 'worker' }), true);
    assert.equal(isActiveCardStatementProfile(true, { status: 'active' }), true);
    assert.equal(isActiveCardStatementProfile(false, {}), false);
    for (const status of ['pending', 'suspended', 'rejected', 'deleted']) {
        assert.equal(isActiveCardStatementProfile(true, { role: 'admin', status }), false);
    }
});

test('analysis stays within the three card statement attachment namespaces', () => {
    for (const namespace of ['card-billing-statements', 'card-ledger-statements', 'card-statement-imports']) {
        const path = `${namespace}/2026-09/card/file.pdf`;
        assert.equal(assertCardStatementStoragePath(path), path);
        assert.equal(resolveCardStatementYearMonth(path), '2026-09');
    }
    for (const path of ['users/private.pdf', 'card-ledger-statements/2026-09/../private.pdf',
        'card-ledger-statements/2026-13/file.pdf', 'card-ledger-statements/2026-09//file.pdf',
        'https://storage.example/secret.pdf', 'card-ledger-statements/2026-09/file.pdf?token=secret']) {
        assert.throws(() => assertCardStatementStoragePath(path));
    }
    assert.throws(() => resolveCardStatementYearMonth('card-ledger-statements/2026-09/file.pdf', '2026-08'));
});

test('attachment identity is stable across file-id and display-name changes', () => {
    const path = 'card-ledger-statements/2026-09/card/file.pdf';
    assert.equal(getCardStatementFileAnalysisId(path), getCardStatementFileAnalysisId(path));
    assert.notEqual(getCardStatementFileAnalysisId(path), getCardStatementFileAnalysisId(path.replace('09/', '08/')));
});

test('large transaction details round-trip in order through bounded Firestore chunks', () => {
    const results = [
        { id: 'card-a', subtotalAmount: 1000, transactions: Array.from({ length: 80 }, (_, index) => ({
            id: `tx_${index}`, merchant: '명세서 거래처'.repeat(8), amount: index,
        })) },
        { id: 'card-b', subtotalAmount: 0, transactions: [] },
    ];
    const chunks = chunkCardStatementDetailResults(results, 2200);
    assert.ok(chunks.length > 2);
    for (const chunk of chunks) assert.ok(Buffer.byteLength(JSON.stringify(chunk)) < 2200);
    assert.deepEqual(joinCardStatementDetailChunks([...chunks].reverse()), results);
    assert.throws(() => chunkCardStatementDetailResults([{ transactions: [{ memo: 'x'.repeat(5000) }] }], 2200));
});

test('interrupted analysis leases become retryable without changing saved details', () => {
    const now = 1_000_000;
    assert.equal(getCardStatementDetailAnalysisState({ analysisStatus: 'analyzing', analysisStartedAtMillis: now - 599_999 }, now).analysisStatus, 'analyzing');
    assert.equal(getCardStatementDetailAnalysisState({ analysisStatus: 'analyzing', analysisStartedAtMillis: now - 600_000 }, now).analysisStatus, 'failed');
    assert.equal(getCardStatementDetailAnalysisState({ analysisStatus: 'analyzing' }, now).analysisStatus, 'failed');
    assert.equal(getCardStatementDetailAnalysisState({ analysisStatus: 'completed', analysisStartedAtMillis: 0 }, now).analysisStatus, 'completed');
});

test('legacy completed analyses without transaction rows are not reported as successful', () => {
    assert.equal(getCardStatementDetailAnalysisState({ analysisStatus: 'completed', activeRunId: 'old-run', file: { transactionCount: 0 } }).analysisStatus, 'failed');
    assert.equal(getCardStatementDetailAnalysisState({ analysisStatus: 'completed', activeRunId: 'valid-run', file: { transactionCount: 2 } }).analysisStatus, 'completed');
});
