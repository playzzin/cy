import { strict as assert } from 'assert';
import { test } from 'node:test';
import {
    buildCardStatementSourceClaimDocumentId,
    buildCardStatementTransactionDocumentId,
    hashCardStatementSource,
    normalizeCardStatementSourceSha256,
    type CardStatementIdentityResult,
} from './cardStatementImportIdentity';

const sourceSha256 = hashCardStatementSource(Buffer.from('the same card statement pdf bytes'));

const buildIds = (result: CardStatementIdentityResult, cardId = 'card-9910'): string[] => (
    (result.transactions || [])
        .map((_, transactionIndex) => buildCardStatementTransactionDocumentId({
            yearMonth: '2026-07',
            cardId,
            sourceSha256,
            result,
            transactionIndex,
        }))
        .sort()
);

test('hashes original bytes and normalizes only valid SHA-256 values', () => {
    assert.equal(sourceSha256.length, 64);
    assert.equal(normalizeCardStatementSourceSha256(sourceSha256.toUpperCase()), sourceSha256);
    assert.equal(normalizeCardStatementSourceSha256('missing'), '');
});

test('one source claim id is shared by another job and filename', () => {
    assert.equal(
        buildCardStatementSourceClaimDocumentId(sourceSha256),
        buildCardStatementSourceClaimDocumentId(sourceSha256.toUpperCase()),
    );
});

test('transaction ids are invariant when AI changes line order', () => {
    const first: CardStatementIdentityResult = {
        cardLast4: '9910',
        cardName: '현장카드',
        subtotalAmount: 13000,
        transactions: [
            { date: '2026-07-02', merchant: '주유소', amount: 10000, category: 'FUEL', memo: '' },
            { date: '2026-07-03', merchant: '편의점', amount: 3000, category: 'MEAL', memo: '' },
        ],
    };
    const reordered: CardStatementIdentityResult = {
        ...first,
        transactions: [...(first.transactions || [])].reverse(),
    };

    assert.deepEqual(buildIds(first), buildIds(reordered));
});

test('repeated identical rows retain the same id set after reordering', () => {
    const duplicate = { date: '2026-07-02', merchant: '통행료', amount: 1200, category: 'TOLL', memo: '' };
    const unique = { date: '2026-07-04', merchant: '식당', amount: 8000, category: 'MEAL', memo: '' };
    const first: CardStatementIdentityResult = {
        cardLast4: '9910',
        subtotalAmount: 10400,
        transactions: [duplicate, unique, duplicate],
    };
    const reordered: CardStatementIdentityResult = {
        ...first,
        transactions: [duplicate, duplicate, unique],
    };

    assert.deepEqual(buildIds(first), buildIds(reordered));
    assert.equal(new Set(buildIds(first)).size, 3);
});

test('block position does not affect transaction ids', () => {
    const firstBlock: CardStatementIdentityResult = {
        cardLast4: '9910',
        subtotalAmount: 10000,
        transactions: [{ date: '2026-07-02', merchant: 'A', amount: 10000, category: 'OTHER' }],
    };
    const secondBlock: CardStatementIdentityResult = {
        cardLast4: '1924',
        subtotalAmount: 15800,
        transactions: [{ date: '2026-07-03', merchant: 'B', amount: 15800, category: 'OTHER' }],
    };
    const forward = [
        ...buildIds(firstBlock),
        ...buildIds(secondBlock, 'card-1924'),
    ].sort();
    const reversed = [
        ...buildIds(secondBlock, 'card-1924'),
        ...buildIds(firstBlock),
    ].sort();

    assert.deepEqual(forward, reversed);
});
