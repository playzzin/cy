import {
  saveCardMonthlyLedgerMutation,
  type CardMonthlyLedgerMutationDependencies,
  type CardMonthlyLedgerMutationRow
} from './cardMonthlyLedgerMutationService';
import type { CardTransaction, CardTransactionCategory } from '../types/card';
import type { CardBillingDocument } from '../types/cardBilling';

jest.mock('./cardService', () => ({
  cardService: {
    applyCardTransactionChanges: jest.fn()
  }
}));

jest.mock('./cardBillingService', () => ({
  isPostedCardBillingStatus: jest.fn((status: unknown) => (
    ['CONFIRMED', 'PAID', 'OVERDUE'].includes(String(status ?? '').toUpperCase())
  )),
  cardBillingService: {
    saveBilling: jest.fn()
  }
}));

jest.mock('./supportWriteOperationLogService', () => ({
  supportWriteOperationLogService: {
    recordOperation: jest.fn()
  }
}));

jest.mock('../utils/supportWriteErrorReporting', () => ({
  SUPPORT_WRITE_RETRY_USER_MESSAGE: 'retry later',
  getErrorMessage: (error: unknown) => error instanceof Error ? error.message : String(error),
  reportSupportWriteError: jest.fn()
}));

const buildRow = (patch: Partial<CardMonthlyLedgerMutationRow> = {}): CardMonthlyLedgerMutationRow => ({
  id: 'row-1',
  card: { id: 'card-1', name: '법인카드', last4: '1234' },
  segment: { startDate: '2026-07-01', endDate: '2026-07-31' },
  amounts: {
    FUEL: 10000,
    TOLL: 5000,
    MEAL: 0,
    MATERIAL: 0,
    OTHER: 0
  },
  memo: '월원장 메모',
  ...patch
});

const buildTransaction = (patch: Partial<CardTransaction>): CardTransaction => ({
  id: 'tx-1',
  cardId: 'card-1',
  cardLabel: '법인카드(1234)',
  date: '2026-07-10',
  yearMonth: '2026-07',
  merchant: '기존 거래',
  category: 'FUEL',
  amount: 1000,
  ...patch
});

const buildBilling = (id: string): CardBillingDocument => ({
  id,
  yearMonth: '2026-07',
  cardId: 'card-1',
  cardLabel: '법인카드 (1234)',
  variableCost: 0,
  totalAmount: 0,
  status: 'DRAFT',
  lineItems: [],
  statementAttachmentPaths: []
});

const buildDependencies = (): jest.Mocked<CardMonthlyLedgerMutationDependencies> => ({
  applyTransactionChanges: jest.fn().mockResolvedValue(undefined),
  recordOperation: jest.fn().mockResolvedValue(undefined)
});

describe('saveCardMonthlyLedgerMutation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('saves deterministic ledger transactions without mutating billing documents', async () => {
    const dependencies = buildDependencies();
    const row = buildRow();

    const result = await saveCardMonthlyLedgerMutation({
      yearMonth: '2026-07',
      visibleRows: [{ row }],
      originalTransactions: [
        buildTransaction({ id: 'visible-tx', date: '2026-07-10' }),
        buildTransaction({ id: 'hidden-tx', date: '2026-08-01' })
      ],
      categories: ['FUEL', 'TOLL', 'MEAL', 'MATERIAL', 'OTHER'],
      getBillingDocumentsForRow: () => [],
      dependencies
    });

    expect(dependencies.applyTransactionChanges).toHaveBeenCalledTimes(1);
    expect(dependencies.applyTransactionChanges).toHaveBeenCalledWith(expect.objectContaining({
      cancelIds: ['visible-tx']
    }));
    const transactionChanges = dependencies.applyTransactionChanges.mock.calls[0][0];
    expect(transactionChanges.upserts).toHaveLength(2);
    expect(transactionChanges.upserts.map((transaction) => transaction.id)).toEqual([
      'card-ledger__2026-07__card-1__2026-07-01__2026-07-31__FUEL',
      'card-ledger__2026-07__card-1__2026-07-01__2026-07-31__TOLL'
    ]);
    expect(transactionChanges.upserts[0]).toMatchObject({
      cardId: 'card-1',
      date: '2026-07-01',
      category: 'FUEL',
      amount: 10000,
      status: 'ACTIVE'
    });
    expect(result).toMatchObject({
      upsertedTransactionCount: 2,
      cancelledTransactionCount: 1,
      savedBillingCount: 0,
      cancelledBillingCount: 0,
      transactionCancelIds: ['visible-tx'],
      billingSaveIds: [],
      billingCancelIds: []
    });
    expect(dependencies.recordOperation).toHaveBeenCalledWith(expect.objectContaining({
      domain: 'card',
      yearMonth: '2026-07',
      operationId: 'card-monthly-ledger:2026-07',
      status: 'success',
      affectedDocumentIds: expect.arrayContaining([
        'card-ledger__2026-07__card-1__2026-07-01__2026-07-31__FUEL',
        'visible-tx'
      ])
    }));
  });

  it('does not save billings when transaction batch fails', async () => {
    const dependencies = buildDependencies();
    dependencies.applyTransactionChanges.mockRejectedValueOnce(new Error('batch failed'));

    await expect(saveCardMonthlyLedgerMutation({
      yearMonth: '2026-07',
      visibleRows: [{ row: buildRow() }],
      originalTransactions: [buildTransaction({ id: 'visible-tx' })],
      categories: ['FUEL'],
      getBillingDocumentsForRow: () => [buildBilling('billing-current')],
      dependencies
    })).rejects.toThrow('batch failed');

    expect(dependencies.applyTransactionChanges).toHaveBeenCalledWith(expect.objectContaining({
      cancelIds: ['visible-tx']
    }));
    expect(dependencies.recordOperation).toHaveBeenCalledWith(expect.objectContaining({
      domain: 'card',
      operationId: 'card-monthly-ledger:2026-07',
      status: 'failed',
      affectedDocumentIds: expect.arrayContaining([
        'card-ledger__2026-07__card-1__2026-07-01__2026-07-31__FUEL',
        'visible-tx'
      ]),
      errorMessage: 'batch failed'
    }));
  });

  it('uses stable transaction ids when the same ledger save is executed twice', async () => {
    const dependencies = buildDependencies();
    const row = buildRow();
    const nextBilling = buildBilling('billing-current');
    const input = {
      yearMonth: '2026-07',
      visibleRows: [{ row }],
      originalTransactions: [] as CardTransaction[],
      categories: ['FUEL', 'TOLL'] as CardTransactionCategory[],
      getBillingDocumentsForRow: () => [nextBilling],
      dependencies
    };

    const first = await saveCardMonthlyLedgerMutation(input);
    const second = await saveCardMonthlyLedgerMutation(input);

    expect(first.transactionUpsertIds).toEqual(second.transactionUpsertIds);
    expect(first.billingSaveIds).toEqual([]);
    expect(second.billingSaveIds).toEqual([]);
    expect(dependencies.applyTransactionChanges.mock.calls[0][0].upserts.map((transaction) => transaction.id)).toEqual(
      dependencies.applyTransactionChanges.mock.calls[1][0].upserts.map((transaction) => transaction.id)
    );
  });

  it('keeps imported PDF attachments when the monthly ledger is saved again', async () => {
    const dependencies = buildDependencies();
    const row = buildRow({
      statementAttachmentPaths: [
        'card-statement-imports/2026-07/job-1/statement.pdf',
        'card-statement-imports/2026-07/job-1/statement.pdf'
      ]
    });

    await saveCardMonthlyLedgerMutation({
      yearMonth: '2026-07',
      visibleRows: [{ row }],
      originalTransactions: [],
      categories: ['FUEL'],
      getBillingDocumentsForRow: () => [],
      dependencies
    });

    const [upsert] = dependencies.applyTransactionChanges.mock.calls[0][0].upserts;
    expect(upsert).toMatchObject({
      evidenceUrl: 'card-statement-imports/2026-07/job-1/statement.pdf',
      statementAttachmentPaths: ['card-statement-imports/2026-07/job-1/statement.pdf']
    });
  });

  it('cancels every physical PDF duplicate hidden by the ledger deduplication', async () => {
    const dependencies = buildDependencies();
    const originalPath = 'card-billing-statements/2026-07/imports/job-old/001_김세흔팀_9910.pdf';
    const repeatedPath = 'card-billing-statements/2026-07/imports/job-new/001_김세흔팀_9910.pdf';
    const row = buildRow({
      segment: { startDate: '2026-07-13', endDate: '2026-07-31' },
      statementAttachmentPaths: [repeatedPath]
    });

    await saveCardMonthlyLedgerMutation({
      yearMonth: '2026-07',
      visibleRows: [{ row }],
      originalTransactions: [
        buildTransaction({
          id: 'legacy-import',
          date: '2026-07-01',
          category: 'FUEL',
          amount: 10000,
          evidenceUrl: originalPath,
          operationId: 'card-statement-import:job-old'
        }),
        buildTransaction({
          id: 'hash-import',
          date: '2026-07-01',
          category: 'FUEL',
          amount: 10000,
          evidenceUrl: repeatedPath,
          statementAttachmentPaths: [repeatedPath],
          statementSourceSha256: 'same-hash',
          operationId: 'card-statement-import:job-new'
        })
      ],
      categories: ['FUEL'],
      getBillingDocumentsForRow: () => [],
      dependencies
    });

    expect(dependencies.applyTransactionChanges).toHaveBeenCalledWith(expect.objectContaining({
      cancelIds: ['legacy-import', 'hash-import']
    }));
  });

  it('skips posted billing rows and still saves safe rows in the same batch', async () => {
    const dependencies = buildDependencies();
    const postedRow = buildRow({ id: 'posted-row' });
    const safeRow = buildRow({
      id: 'safe-row',
      card: { id: 'card-2', name: '현장카드', last4: '5678' }
    });
    const postedBilling = {
      ...buildBilling('billing-posted'),
      status: 'CONFIRMED' as const,
      totalAmount: 10000
    };
    const safeBilling = {
      ...buildBilling('billing-safe'),
      cardId: 'card-2',
      cardLabel: '현장카드 (5678)'
    };

    const result = await saveCardMonthlyLedgerMutation({
      yearMonth: '2026-07',
      visibleRows: [{ row: postedRow }, { row: safeRow }],
      originalTransactions: [
        buildTransaction({ id: 'posted-tx', cardId: 'card-1', date: '2026-07-10' }),
        buildTransaction({ id: 'safe-tx', cardId: 'card-2', date: '2026-07-10' })
      ],
      categories: ['FUEL'],
      getBillingDocumentsForRow: (row) => row.id === 'posted-row' ? [postedBilling] : [safeBilling],
      dependencies
    });

    expect(dependencies.applyTransactionChanges).toHaveBeenCalledWith(expect.objectContaining({
      cancelIds: ['safe-tx']
    }));
    const transactionChanges = dependencies.applyTransactionChanges.mock.calls[0][0];
    expect(transactionChanges.upserts).toHaveLength(1);
    expect(transactionChanges.upserts[0]).toMatchObject({
      id: 'card-ledger__2026-07__card-2__2026-07-01__2026-07-31__FUEL',
      cardId: 'card-2'
    });
    expect(result).toMatchObject({
      savedBillingCount: 0,
      cancelledBillingCount: 0,
      skippedBillingCount: 1,
      billingSaveIds: [],
      billingCancelIds: []
    });
    expect(result.skippedBillingRows).toEqual([{
      rowId: 'posted-row',
      cardId: 'card-1',
      cardLabel: '법인카드(1234)',
      reason: 'posted-billing-protected',
      billingIds: ['billing-posted'],
      statuses: ['CONFIRMED']
    }]);
  });

  it('validates rows before writing', async () => {
    const dependencies = buildDependencies();

    await expect(saveCardMonthlyLedgerMutation({
      yearMonth: '2026-07',
      visibleRows: [{ row: buildRow({ segment: { startDate: '2026-07-31', endDate: '2026-07-01' } }) }],
      originalTransactions: [],
      categories: ['FUEL'],
      getBillingDocumentsForRow: () => [],
      dependencies
    })).rejects.toThrow('invalid-ledger-period:row-1');

    expect(dependencies.applyTransactionChanges).not.toHaveBeenCalled();
  });
});
