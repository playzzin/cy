import type { CardTransaction } from '../types/card';
import {
  dedupeImportedStatementTransactions,
  dedupeStatementPaths,
  getStatementFileIdentity,
  isLegacyCardStatementImportBillingDocument,
  matchesLegacyCardStatementImportBillingTotal,
} from './cardStatementDeduplication';

const buildImportedTotal = (overrides: Partial<CardTransaction>): CardTransaction => ({
  id: 'card-statement__2026-07__card-9910__file-a__0__total',
  cardId: 'card-9910',
  cardLabel: '김세흔팀 (9910)',
  date: '2026-07-01',
  yearMonth: '2026-07',
  merchant: '김세흔팀 9910.pdf',
  category: 'OTHER',
  amount: 1005500,
  memo: 'PDF로 가져옴 · 청구서 총액',
  evidenceUrl: 'card-billing-statements/2026-07/imports/job-a/001_김세흔팀_9910.pdf',
  statementAttachmentPaths: [
    'card-billing-statements/2026-07/imports/job-a/001_김세흔팀_9910.pdf',
  ],
  status: 'ACTIVE',
  operationId: 'card-statement-import:job-a',
  ...overrides,
});

describe('card statement duplicate protection', () => {
  it('uses the original file name as the identity across import job folders', () => {
    expect(getStatementFileIdentity(
      'card-billing-statements/2026-07/imports/job-a/001_김세흔팀_9910.pdf',
    )).toBe('김세흔팀_9910.pdf');
  });

  it('keeps distinct storage attachments even when their original file names match', () => {
    expect(dedupeStatementPaths([
      'card-billing-statements/2026-07/imports/job-a/001_김세흔팀_9910.pdf',
      'card-billing-statements/2026-07/imports/job-b/001_김세흔팀_9910.pdf',
    ])).toEqual([
      'card-billing-statements/2026-07/imports/job-a/001_김세흔팀_9910.pdf',
      'card-billing-statements/2026-07/imports/job-b/001_김세흔팀_9910.pdf',
    ]);
  });

  it('counts a repeated imported total once while preserving distinct cards', () => {
    const duplicate = buildImportedTotal({
      id: 'card-statement__2026-07__card-9910__file-b__0__total',
      evidenceUrl: 'card-billing-statements/2026-07/imports/job-b/001_김세흔팀_9910.pdf',
      statementAttachmentPaths: [
        'card-billing-statements/2026-07/imports/job-b/001_김세흔팀_9910.pdf',
      ],
      operationId: 'card-statement-import:job-b',
    });
    const otherCard = buildImportedTotal({
      id: 'card-statement__2026-07__card-1924__file-c__0__total',
      cardId: 'card-1924',
      cardLabel: '김종남팀 (1924)',
      amount: 31600,
      evidenceUrl: 'card-billing-statements/2026-07/imports/job-c/001_김종남팀_1924.pdf',
      statementAttachmentPaths: [
        'card-billing-statements/2026-07/imports/job-c/001_김종남팀_1924.pdf',
      ],
      operationId: 'card-statement-import:job-c',
    });

    const deduped = dedupeImportedStatementTransactions([
      buildImportedTotal({}),
      duplicate,
      otherCard,
    ]);

    expect(deduped).toHaveLength(2);
    expect(deduped.reduce((sum, transaction) => sum + transaction.amount, 0)).toBe(1037100);
    expect(deduped.find((transaction) => transaction.cardId === 'card-9910')?.statementAttachmentPaths).toEqual([
      'card-billing-statements/2026-07/imports/job-a/001_김세흔팀_9910.pdf',
      'card-billing-statements/2026-07/imports/job-b/001_김세흔팀_9910.pdf',
    ]);
  });

  it('keeps different PDF contents separate even when the file name and line position match', () => {
    const first = buildImportedTotal({
      statementSourceSha256: 'hash-a',
      statementOriginalFileName: '공통카드.pdf',
    });
    const second = buildImportedTotal({
      id: 'card-statement__2026-07__card-9910__hash-b__0__total',
      statementSourceSha256: 'hash-b',
      statementOriginalFileName: '공통카드.pdf',
      evidenceUrl: 'card-billing-statements/2026-07/imports/job-b/001_공통카드.pdf',
      statementAttachmentPaths: [
        'card-billing-statements/2026-07/imports/job-b/001_공통카드.pdf',
      ],
      operationId: 'card-statement-import:job-b',
    });

    expect(dedupeImportedStatementTransactions([first, second])).toHaveLength(2);
  });

  it('does not add a monthly-ledger rollup on top of the imports it was generated from', () => {
    const first = buildImportedTotal({});
    const second = buildImportedTotal({
      id: 'card-statement__2026-07__card-9910__file-b__0__total',
      evidenceUrl: 'card-billing-statements/2026-07/imports/job-b/001_김세흔팀_9910.pdf',
      statementAttachmentPaths: [
        'card-billing-statements/2026-07/imports/job-b/001_김세흔팀_9910.pdf',
      ],
      operationId: 'card-statement-import:job-b',
    });
    const rollup = buildImportedTotal({
      id: 'card-ledger__2026-07__card-9910__2026-07-13__2026-07-31__OTHER',
      amount: 2011000,
      evidenceUrl: first.evidenceUrl,
      statementAttachmentPaths: [first.evidenceUrl!, second.evidenceUrl!],
      operationId: 'card-monthly-ledger:2026-07',
      lastOperationId: 'card-monthly-ledger:2026-07',
    });

    const deduped = dedupeImportedStatementTransactions([rollup, first, second]);

    expect(deduped).toHaveLength(1);
    expect(deduped[0].amount).toBe(1005500);
    expect(deduped[0].id).toContain('card-statement__');
  });

  it('bridges a hash-backed import to its legacy file-only monthly rollup', () => {
    const imported = buildImportedTotal({
      statementSourceSha256: 'verified-hash',
      statementOriginalFileName: '김세흔팀_9910.pdf',
    });
    const rollup = buildImportedTotal({
      id: 'card-ledger__2026-07__card-9910__2026-07-13__2026-07-31__OTHER',
      statementSourceSha256: undefined,
      statementOriginalFileName: undefined,
      operationId: 'card-monthly-ledger:2026-07',
      lastOperationId: 'card-monthly-ledger:2026-07',
    });

    const deduped = dedupeImportedStatementTransactions([rollup, imported]);

    expect(deduped).toHaveLength(1);
    expect(deduped[0].id).toContain('card-statement__');
  });

  it('keeps a manually corrected monthly-ledger amount instead of its source imports', () => {
    const first = buildImportedTotal({});
    const second = buildImportedTotal({
      id: 'card-statement__2026-07__card-9910__file-b__0__total',
      evidenceUrl: 'card-billing-statements/2026-07/imports/job-b/001_김세흔팀_9910.pdf',
      operationId: 'card-statement-import:job-b',
    });
    const corrected = buildImportedTotal({
      id: 'card-ledger__2026-07__card-9910__2026-07-13__2026-07-31__OTHER',
      amount: 990000,
      evidenceUrl: first.evidenceUrl,
      statementAttachmentPaths: [first.evidenceUrl!, second.evidenceUrl!],
      operationId: 'card-monthly-ledger:2026-07',
      lastOperationId: 'card-monthly-ledger:2026-07',
    });

    expect(dedupeImportedStatementTransactions([corrected, first, second])).toEqual([
      expect.objectContaining({ id: corrected.id, amount: 990000 }),
    ]);
  });

  it('prefers the SHA-256 identity when the same file is renamed', () => {
    const first = buildImportedTotal({ statementSourceSha256: 'same-hash' });
    const renamed = buildImportedTotal({
      id: 'card-statement__2026-07__card-9910__file-b__0__total',
      statementSourceSha256: 'same-hash',
      statementOriginalFileName: 'renamed.pdf',
      evidenceUrl: 'card-billing-statements/2026-07/imports/job-b/001_renamed.pdf',
      operationId: 'card-statement-import:job-b',
    });

    expect(dedupeImportedStatementTransactions([first, renamed])).toHaveLength(1);
  });

  it('deduplicates a legacy hash-less import with a new hash-backed import', () => {
    const legacy = buildImportedTotal({
      statementSourceSha256: undefined,
      statementOriginalFileName: undefined,
    });
    const hashBacked = buildImportedTotal({
      id: 'card-statement__2026-07__card-9910__same-hash__0__total',
      evidenceUrl: 'card-billing-statements/2026-07/imports/job-new/001_김세흔팀_9910.pdf',
      statementAttachmentPaths: [
        'card-billing-statements/2026-07/imports/job-new/001_김세흔팀_9910.pdf',
      ],
      statementSourceSha256: 'same-hash',
      statementOriginalFileName: '김세흔팀_9910.pdf',
      operationId: 'card-statement-import:job-new',
    });

    const deduped = dedupeImportedStatementTransactions([legacy, hashBacked]);

    expect(deduped).toHaveLength(1);
    expect(deduped[0]).toMatchObject({
      amount: 1005500,
      statementSourceSha256: 'same-hash',
      statementOriginalFileName: '김세흔팀_9910.pdf',
    });
  });

  it('does not merge same-card transaction indexes from separate PDF blocks', () => {
    const firstBlock = buildImportedTotal({
      id: 'card-statement__2026-07__card-9910__same-hash__0__tx_0000',
      statementSourceSha256: 'same-hash',
      merchant: '첫 번째 블록',
      amount: 10000,
    });
    const secondBlock = buildImportedTotal({
      id: 'card-statement__2026-07__card-9910__same-hash__1__tx_0000',
      statementSourceSha256: 'same-hash',
      merchant: '두 번째 블록',
      amount: 20000,
    });

    const deduped = dedupeImportedStatementTransactions([firstBlock, secondBlock]);

    expect(deduped).toHaveLength(2);
    expect(deduped.map((transaction) => transaction.amount)).toEqual([10000, 20000]);
  });

  it('recognizes an existing legacy PDF billing so bulk billing does not create a second document', () => {
    const legacyBilling = {
      memo: 'KB PDF import old-job',
      totalAmount: 502750,
      statementAttachmentPaths: [
        'card-billing-statements/2026-07/imports/old-job/013_김세흔팀_9910.pdf',
      ],
      lineItems: [{
        id: 'card-statement__2026-07__card-9910__old-file__0__total',
        sourceLedgerRowId: 'card-statement__2026-07__card-9910__old-file__0__total',
      }],
    };

    expect(matchesLegacyCardStatementImportBillingTotal(legacyBilling as any, 502750)).toBe(true);
    expect(matchesLegacyCardStatementImportBillingTotal(legacyBilling as any, 1005500)).toBe(false);
    expect(isLegacyCardStatementImportBillingDocument({
      ...legacyBilling,
      totalAmount: 1005500,
    } as any)).toBe(true);
  });

  it('does not treat a normal row billing as a legacy PDF import billing', () => {
    expect(matchesLegacyCardStatementImportBillingTotal({
      memo: '현장 카드 청구',
      totalAmount: 502750,
      statementAttachmentPaths: [],
      lineItems: [{
        id: 'other-card-row',
        sourceLedgerRowId: 'card-ledger__2026-07__card-9910__2026-07-13__2026-07-31__OTHER',
      }],
    } as any, 502750)).toBe(false);
  });
});
