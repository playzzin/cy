import { cardService } from './cardService';
import { cardBillingService, isPostedCardBillingStatus } from './cardBillingService';
import { supportWriteOperationLogService } from './supportWriteOperationLogService';
import { reportSupportWriteError } from '../utils/supportWriteErrorReporting';
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

jest.mock('../utils/supportWriteErrorReporting', () => {
  const actual = jest.requireActual<typeof import('../utils/supportWriteErrorReporting')>(
    '../utils/supportWriteErrorReporting'
  );
  return { ...actual, reportSupportWriteError: jest.fn() };
});

// 이 파일의 기존 서비스 경계를 유지한다. SDK는 가짜 성공도 허용하지 않는다.
jest.mock('firebase/firestore', () => new Proxy({}, {
  get: () => { throw new Error('검사 범위 밖 Firestore 접근'); }
}));
jest.mock('firebase/app', () => new Proxy({}, {
  get: () => { throw new Error('검사 범위 밖 Firebase 앱 접근'); }
}));
jest.mock('firebase/auth', () => new Proxy({}, {
  get: () => { throw new Error('검사 범위 밖 인증 접근'); }
}));
jest.mock('firebase/storage', () => new Proxy({}, {
  get: () => { throw new Error('검사 범위 밖 저장소 접근'); }
}));
jest.mock('firebase/functions', () => new Proxy({}, {
  get: () => { throw new Error('검사 범위 밖 원격 함수 접근'); }
}));
jest.mock('../config/firebase', () => new Proxy({}, {
  get: () => { throw new Error('검사 범위 밖 실제 설정 접근'); }
}));

const actualReporting = jest.requireActual<typeof import('../utils/supportWriteErrorReporting')>(
  '../utils/supportWriteErrorReporting'
);
const mockApply = cardService.applyCardTransactionChanges as jest.MockedFunction<
  typeof cardService.applyCardTransactionChanges
>;
const mockRecord = supportWriteOperationLogService.recordOperation as jest.MockedFunction<
  typeof supportWriteOperationLogService.recordOperation
>;
const mockReport = reportSupportWriteError as jest.MockedFunction<typeof reportSupportWriteError>;
const mockPosted = isPostedCardBillingStatus as jest.MockedFunction<typeof isPostedCardBillingStatus>;
const mockBilling = cardBillingService.saveBilling as jest.MockedFunction<typeof cardBillingService.saveBilling>;

beforeEach(() => {
  jest.resetAllMocks();
  // resetMocks 설정 뒤 모든 호출 경계를 매 검사마다 재무장한다.
  // doc/time은 사용하지 않으며 위 SDK 전체 차단이 매 검사에 유지된다.
  mockApply.mockImplementation(async (..._args: Parameters<typeof cardService.applyCardTransactionChanges>) => {
    throw new Error('금융 호출 결과를 검사에서 명시해야 함');
  });
  mockRecord.mockImplementation(async (..._args: Parameters<typeof supportWriteOperationLogService.recordOperation>) => {
    throw new Error('기록 호출 결과를 검사에서 명시해야 함');
  });
  mockReport.mockImplementation(actualReporting.reportSupportWriteError);
  mockPosted.mockImplementation((...args: Parameters<typeof isPostedCardBillingStatus>) => (
    ['CONFIRMED', 'PAID', 'OVERDUE'].includes(String(args[0] ?? '').toUpperCase())
  ));
  mockBilling.mockImplementation(async (..._args: Parameters<typeof cardBillingService.saveBilling>) => {
    throw new Error('월원장 검사에서 청구 저장 금지');
  });
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => { jest.restoreAllMocks(); });

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


// 금융 어댑터/SDK commit 검사가 아니라 기존 금융 서비스 호출 경계의 진단 회귀검사다.
// 실제 staged/committed 검사는 추가 의존 범위를 승인받은 뒤 별도로 수행한다.
describe('카드 진단 실패 격리', () => {
  type ApplyArgs = Parameters<typeof cardService.applyCardTransactionChanges>;
  type SaveInput = Parameters<typeof saveCardMonthlyLedgerMutation>[0];
  const operationId = 'diagnostic-fixture-operation';
  const fuelId = 'card-ledger__2026-07__card-1__2026-07-01__2026-07-31__FUEL';
  const tollId = 'card-ledger__2026-07__card-1__2026-07-01__2026-07-31__TOLL';
  let events: string[];
  let applied: ApplyArgs[0][];
  const recordedLog = (
    ...args: Parameters<typeof supportWriteOperationLogService.recordOperation>
  ): Awaited<ReturnType<typeof supportWriteOperationLogService.recordOperation>> => ({
    ...args[0], id: 'synthetic-log', affectedDocumentIds: args[0].affectedDocumentIds ?? [],
    actor: { uid: 'synthetic-actor', name: '검사용 사용자' }
  });

  const input = (): SaveInput => ({
    yearMonth: '2026-07',
    operationId,
    visibleRows: [{ row: buildRow() }],
    originalTransactions: [buildTransaction({ id: 'visible-tx' })],
    categories: ['FUEL', 'TOLL'],
    getBillingDocumentsForRow: () => []
  });
  const expectedChanges = (): ApplyArgs[0] => ({
    upserts: [
      { id: fuelId, cardId: 'card-1', cardLabel: '법인카드(1234)', date: '2026-07-01',
        yearMonth: '2026-07', merchant: 'Monthly ledger', category: 'FUEL', amount: 10000,
        memo: '월원장 메모', status: 'ACTIVE', operationId, lastOperationId: operationId },
      { id: tollId, cardId: 'card-1', cardLabel: '법인카드(1234)', date: '2026-07-01',
        yearMonth: '2026-07', merchant: 'Monthly ledger', category: 'TOLL', amount: 5000,
        memo: '월원장 메모', status: 'ACTIVE', operationId, lastOperationId: operationId }
    ],
    cancelIds: ['visible-tx'], operationId
  });
  const expectedResult = () => ({
    operationId, upsertedTransactionCount: 2, cancelledTransactionCount: 1,
    savedBillingCount: 0, cancelledBillingCount: 0, skippedBillingCount: 0,
    transactionUpsertIds: [fuelId, tollId], transactionCancelIds: ['visible-tx'],
    billingSaveIds: [], billingCancelIds: [], skippedBillingRows: []
  });
  const expectedSuccessRecord = () => ({
    domain: 'card', yearMonth: '2026-07', operationId, status: 'success',
    affectedDocumentIds: [fuelId, tollId, 'visible-tx'],
    metadata: { upsertedTransactionCount: 2, cancelledTransactionCount: 1,
      savedBillingCount: 0, cancelledBillingCount: 0, skippedBillingCount: 0,
      skippedBillingRows: [] }
  });
  const expectSingleFinancialCall = () => {
    expect(mockApply.mock.calls).toEqual([[expectedChanges()]]);
    expect(mockBilling).not.toHaveBeenCalled();
  };
  const expectSafeConsole = (count: number) => {
    expect(console.error).toHaveBeenCalledTimes(count);
    for (let index = 1; index <= count; index += 1) {
      expect(console.error).toHaveBeenNthCalledWith(index, '[support-write-operation]', {
        domain: 'card', errorCode: 'SUPPORT_WRITE_UNKNOWN'
      });
    }
  };
  const failBusinessWith = (error: unknown) => {
    mockApply.mockImplementation(async (..._args: ApplyArgs) => {
      events.push('금융 실패');
      throw error;
    });
  };
  const failLog = () => {
    mockRecord.mockImplementation(async (..._args: Parameters<typeof supportWriteOperationLogService.recordOperation>) => {
      events.push('기록 실패');
      throw new Error('원시 기록 오류 노출 금지');
    });
  };
  beforeEach(() => {
    events = [];
    applied = [];
    mockApply.mockImplementation(async (...args: ApplyArgs) => {
      events.push('금융 성공');
      applied.push(args[0]);
    });
    // 실제 반환 계약을 만족하는 합성 기록이며 원본 로그 서비스는 실행하지 않는다.
    mockRecord.mockImplementation(async (...args: Parameters<typeof supportWriteOperationLogService.recordOperation>) => recordedLog(...args));
  });

  it('정상 대조: 금융 입력 전체와 순서, 결과, 기록 metadata를 유지한다', async () => {
    mockRecord.mockImplementation(async (...args: Parameters<typeof supportWriteOperationLogService.recordOperation>) => {
      events.push('기록 성공');
      return recordedLog(...args);
    });
    expect(await saveCardMonthlyLedgerMutation(input())).toEqual(expectedResult());
    expectSingleFinancialCall();
    expect(applied).toEqual([expectedChanges()]);
    expect(events).toEqual(['금융 성공', '기록 성공']);
    expect(mockRecord.mock.calls).toEqual([[expectedSuccessRecord()]]);
    expect(mockReport).not.toHaveBeenCalled();
    expectSafeConsole(0);
  });

  it.each(['기록만 실패', '실제 보고의 console 실패', '보고 함수 자체 실패'])(
    '성공 후 %s여도 성공 결과와 금융 호출을 바꾸지 않는다', async (mode) => {
      failLog();
      if (mode === '실제 보고의 console 실패') {
        jest.spyOn(console, 'error').mockImplementation(() => { throw new Error('출력 실패'); });
      }
      if (mode === '보고 함수 자체 실패') {
        mockReport.mockImplementation(() => { throw new Error('보고 실패'); });
      }
      expect(await saveCardMonthlyLedgerMutation(input())).toEqual(expectedResult());
      expectSingleFinancialCall();
      expect(applied).toEqual([expectedChanges()]);
      expect(events).toEqual(['금융 성공', '기록 실패']);
      expect(mockRecord.mock.calls).toEqual([[expectedSuccessRecord()]]);
      expect(mockReport).toHaveBeenCalledTimes(1);
      expectSafeConsole(mode === '보고 함수 자체 실패' ? 0 : 1);
    }
  );

  it('정상 업무 실패 대조: 실패 기록과 실제 공통 보고를 거쳐 동일 오류를 전달한다', async () => {
    const error = new Error('batch failed');
    failBusinessWith(error);
    await expect(saveCardMonthlyLedgerMutation(input())).rejects.toBe(error);
    expectSingleFinancialCall();
    expect(applied).toEqual([]);
    const context = { domain: 'card', yearMonth: '2026-07', operationId,
      affectedDocumentIds: [fuelId, tollId, 'visible-tx'], errorMessage: 'batch failed',
      userMessage: actualReporting.SUPPORT_WRITE_RETRY_USER_MESSAGE, status: 'failed' };
    expect(mockRecord.mock.calls).toEqual([[context]]);
    expect(mockReport.mock.calls).toEqual([[error, context]]);
    expectSafeConsole(1);
  });

  it.each(['Error.message', 'object.code', 'object.name', 'object.message'])(
    '%s getter가 던져도 원래 오류를 동일 참조로 보존한다', async (kind) => {
      const getterError = new Error('속성 추출 실패');
      const error: object = kind === 'Error.message' ? new Error('원본 오류') : {};
      const getter = jest.fn(() => { throw getterError; });
      Object.defineProperty(error, kind.split('.')[1], { get: getter });
      failBusinessWith(error);
      await expect(saveCardMonthlyLedgerMutation(input())).rejects.toBe(error);
      expect(getter).toHaveBeenCalledTimes(1);
      expectSingleFinancialCall();
      expect(applied).toEqual([]);
      expect(mockRecord).toHaveBeenCalledTimes(1);
      expect(mockRecord.mock.calls[0][0]).toEqual({
        domain: 'card', yearMonth: '2026-07', operationId,
        affectedDocumentIds: [fuelId, tollId, 'visible-tx'], errorMessage: 'unknown-error',
        userMessage: actualReporting.SUPPORT_WRITE_RETRY_USER_MESSAGE, status: 'failed'
      });
      expect(mockReport.mock.calls[0][0]).toBe(error);
      expectSafeConsole(1);
    }
  );

  it('일반 객체의 정상 추출값과 오류 참조를 유지한다', async () => {
    const error = { code: 'denied', name: 'SyntheticFailure', message: 'synthetic message' };
    failBusinessWith(error);
    await expect(saveCardMonthlyLedgerMutation(input())).rejects.toBe(error);
    expectSingleFinancialCall();
    expect(applied).toEqual([]);
    expect(mockRecord.mock.calls[0][0].errorMessage).toBe('denied SyntheticFailure synthetic message');
    expectSafeConsole(1);
  });

  it.each(['실제 보고의 console 실패', '보고 함수 자체 실패'])(
    '업무·기록 실패와 %s가 겹쳐도 추가 금융 호출 없이 원래 오류를 보존한다', async (mode) => {
      const error = new Error('원래 업무 실패');
      failBusinessWith(error);
      failLog();
      if (mode === '보고 함수 자체 실패') {
        mockReport.mockImplementation(() => { throw new Error('보고 실패'); });
      } else {
        jest.spyOn(console, 'error').mockImplementation(() => { throw new Error('출력 실패'); });
      }
      await expect(saveCardMonthlyLedgerMutation(input())).rejects.toBe(error);
      expectSingleFinancialCall();
      expect(applied).toEqual([]);
      expect(events).toEqual(['금융 실패', '기록 실패']);
      expect(mockRecord).toHaveBeenCalledTimes(1);
      expect(mockReport).toHaveBeenCalledTimes(2);
      expect(mockReport.mock.calls[1][0]).toBe(error);
      expectSafeConsole(mode === '보고 함수 자체 실패' ? 0 : 2);
    }
  );

  it('getter·기록·보고 실패가 모두 겹쳐도 동일 업무 오류를 보존한다', async () => {
    const error = Object.defineProperty({}, 'code', { get: () => { throw new Error('추출 실패'); } });
    failBusinessWith(error);
    failLog();
    mockReport.mockImplementation(() => { throw new Error('보고 실패'); });
    await expect(saveCardMonthlyLedgerMutation(input())).rejects.toBe(error);
    expectSingleFinancialCall();
    expect(applied).toEqual([]);
    expect(mockRecord).toHaveBeenCalledTimes(1);
    expect(mockReport).toHaveBeenCalledTimes(2);
    expect(mockReport.mock.calls[1][0]).toBe(error);
    expectSafeConsole(0);
  });
});
