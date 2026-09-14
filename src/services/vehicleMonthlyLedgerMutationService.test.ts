import {
  saveVehicleMonthlyLedgerMutation,
  type VehicleMonthlyLedgerMutationDependencies,
  type VehicleMonthlyLedgerMutationRow
} from './vehicleMonthlyLedgerMutationService';
import type { VehicleExpenseRecord, VehicleExpenseType } from '../types/vehicle';

jest.mock('./vehicleService', () => ({
  vehicleService: {
    applyVehicleExpenseChanges: jest.fn()
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
  return { ...actual, reportSupportWriteError: jest.fn(actual.reportSupportWriteError) };
});

const buildRow = (patch: Partial<VehicleMonthlyLedgerMutationRow> = {}): VehicleMonthlyLedgerMutationRow => ({
  id: 'row-1',
  vehicle: { id: 'vehicle-1', licensePlate: '12가3456' },
  segment: { startDate: '2026-07-01', endDate: '2026-07-31' },
  amounts: { FUEL: 10000, REPAIR: 0, TOLL: 5000, FINE: 0, OTHER: 0 },
  fineChargeTarget: 'BILLING_TARGET',
  note: '월원장 메모',
  ...patch
});

const buildExpense = (patch: Partial<VehicleExpenseRecord>): VehicleExpenseRecord => ({
  id: 'expense-1',
  vehicleId: 'vehicle-1',
  vehiclePlate: '12가3456',
  date: '2026-07-10',
  type: 'FUEL',
  amount: 1000,
  payer: 'COMPANY',
  ...patch
});

const buildDependencies = (): jest.Mocked<VehicleMonthlyLedgerMutationDependencies> => ({
  applyExpenseChanges: jest.fn().mockResolvedValue(undefined),
  recordOperation: jest.fn().mockResolvedValue(undefined)
});

describe('saveVehicleMonthlyLedgerMutation', () => {
  beforeEach(() => jest.clearAllMocks());

  it('persists deterministic ledger expenses before the automatic billing sync', async () => {
    const dependencies = buildDependencies();
    const result = await saveVehicleMonthlyLedgerMutation({
      yearMonth: '2026-07',
      visibleRows: [{ row: buildRow() }],
      originalExpenses: [
        buildExpense({ id: 'visible-expense', date: '2026-07-10' }),
        buildExpense({ id: 'hidden-expense', date: '2026-08-01' })
      ],
      expenseTypes: ['FUEL', 'REPAIR', 'TOLL', 'FINE', 'OTHER'],
      dependencies
    });

    const expenseChanges = dependencies.applyExpenseChanges.mock.calls[0][0];
    expect(expenseChanges.upserts.map((expense) => expense.id)).toEqual([
      'vehicle-ledger__2026-07__vehicle-1__2026-07-01__2026-07-31__FUEL__default',
      'vehicle-ledger__2026-07__vehicle-1__2026-07-01__2026-07-31__TOLL__default'
    ]);
    expect(expenseChanges.upserts[0]).toMatchObject({
      vehicleId: 'vehicle-1', date: '2026-07-01', type: 'FUEL', amount: 10000,
      payer: 'COMPANY', note: '월원장 메모', status: 'ACTIVE'
    });
    expect(expenseChanges.cancelIds).toEqual(['visible-expense']);
    expect(result).toEqual(expect.objectContaining({
      upsertedExpenseCount: 2,
      cancelledExpenseCount: 1,
      expenseCancelIds: ['visible-expense']
    }));
    expect(dependencies.recordOperation).toHaveBeenCalledWith(expect.objectContaining({
      domain: 'vehicle',
      operationId: 'vehicle-monthly-ledger:2026-07',
      status: 'success',
      metadata: expect.objectContaining({ billingMutation: 'automatic-after-save' })
    }));
  });

  it('saves every ledger row independently of billing status', async () => {
    const dependencies = buildDependencies();
    const result = await saveVehicleMonthlyLedgerMutation({
      yearMonth: '2026-07',
      visibleRows: [
        { row: buildRow({ id: 'posted-row' }) },
        { row: buildRow({ id: 'safe-row', vehicle: { id: 'vehicle-2', licensePlate: '34나5678' } }) }
      ],
      originalExpenses: [],
      expenseTypes: ['FUEL'],
      dependencies
    });

    const upserts = dependencies.applyExpenseChanges.mock.calls[0][0].upserts;
    expect(upserts).toHaveLength(2);
    expect(upserts.map((expense) => expense.vehicleId)).toEqual(['vehicle-1', 'vehicle-2']);
    expect(result.upsertedExpenseCount).toBe(2);
  });

  it('records a failed operation when the expense batch fails', async () => {
    const dependencies = buildDependencies();
    dependencies.applyExpenseChanges.mockRejectedValueOnce(new Error('batch failed'));

    await expect(saveVehicleMonthlyLedgerMutation({
      yearMonth: '2026-07',
      visibleRows: [{ row: buildRow() }],
      originalExpenses: [buildExpense({ id: 'visible-expense' })],
      expenseTypes: ['FUEL'],
      dependencies
    })).rejects.toThrow('batch failed');

    expect(dependencies.recordOperation).toHaveBeenCalledWith(expect.objectContaining({
      status: 'failed',
      affectedDocumentIds: expect.arrayContaining([
        'vehicle-ledger__2026-07__vehicle-1__2026-07-01__2026-07-31__FUEL__default',
        'visible-expense'
      ])
    }));
  });

  it('uses stable expense ids when the same save is executed twice', async () => {
    const dependencies = buildDependencies();
    const input = {
      yearMonth: '2026-07',
      visibleRows: [{ row: buildRow() }],
      originalExpenses: [] as VehicleExpenseRecord[],
      expenseTypes: ['FUEL', 'TOLL'] as VehicleExpenseType[],
      dependencies
    };

    const first = await saveVehicleMonthlyLedgerMutation(input);
    const second = await saveVehicleMonthlyLedgerMutation(input);
    expect(first.expenseUpsertIds).toEqual(second.expenseUpsertIds);
  });

  it('preserves the selected fine driver when replacing a legacy fine expense', async () => {
    const dependencies = buildDependencies();
    const selectedDriver = {
      workerId: 'worker-2',
      workerName: '홍길동',
      teamId: 'team-2',
      teamName: 'B팀'
    };

    await saveVehicleMonthlyLedgerMutation({
      yearMonth: '2026-07',
      visibleRows: [{
        row: buildRow({
          amounts: { FINE: 3000 },
          fineChargeTarget: 'DRIVER',
          fineDriverBillingTarget: selectedDriver
        })
      }],
      originalExpenses: [buildExpense({
        id: 'legacy-random-fine-id',
        type: 'FINE',
        amount: 3000,
        fineChargeTarget: 'DRIVER',
        fineDriverBillingTarget: selectedDriver
      })],
      expenseTypes: ['FINE'],
      dependencies
    });

    expect(dependencies.applyExpenseChanges).toHaveBeenCalledWith(expect.objectContaining({
      upserts: [expect.objectContaining({
        type: 'FINE',
        fineChargeTarget: 'DRIVER',
        fineDriverBillingTarget: selectedDriver
      })],
      cancelIds: ['legacy-random-fine-id']
    }));
  });

  it('validates all rows before writing', async () => {
    const dependencies = buildDependencies();
    await expect(saveVehicleMonthlyLedgerMutation({
      yearMonth: '2026-07',
      visibleRows: [{ row: buildRow({ segment: { startDate: '2026-07-31', endDate: '2026-07-01' } }) }],
      originalExpenses: [],
      expenseTypes: ['FUEL'],
      dependencies
    })).rejects.toThrow('invalid-ledger-period:row-1');
    expect(dependencies.applyExpenseChanges).not.toHaveBeenCalled();
  });
});


// Source-only candidate: NOT EXECUTED. SDK factory never imports a real SDK.
// Existing dependency-injected cases above remain intact. Cases below use the
// real vehicleService -> vehicleFirestoreService -> staged fake SDK batch.
jest.mock('../config/firebase', () => ({ db: Object.freeze({ isolated: true }) }));
jest.mock('firebase/firestore', () => {
  const blocked = () => { throw new Error('unexpected-sdk-operation'); };
  return {
    doc: jest.fn((_db: unknown, collection: string, id: string) => ({ path: `${collection}/${id}` })),
    serverTimestamp: jest.fn(() => 'isolated-timestamp'),
    writeBatch: jest.fn(blocked),
    collection: blocked, deleteDoc: blocked, getDoc: blocked, getDocs: blocked,
    query: blocked, where: blocked, orderBy: blocked, limit: blocked,
    setDoc: blocked, deleteField: blocked, runTransaction: blocked
  };
});
// Not exercised by expense batches: fail closed rather than load schema/SDK dependencies.
jest.mock('../utils/firestoreConverter', () => ({
  createConverter: () => { throw new Error('unexpected-converter'); }
}));
jest.mock('../types/zod/vehicleSchema', () => {
  const schema = { parse: () => { throw new Error('unexpected-schema'); } };
  return { vehicleSchema: schema, vehicleAssignmentSchema: schema,
    vehicleBillingTargetSchema: schema, vehicleExpenseSchema: schema };
});

describe('vehicle ledger diagnostic isolation at the closed SDK boundary (not server verification)', () => {
  const actualVehicle = jest.requireActual<typeof import('./vehicleService')>('./vehicleService').vehicleService;
  const sdk = jest.requireMock('firebase/firestore') as {
    writeBatch: jest.Mock;
    doc: jest.Mock;
    serverTimestamp: jest.Mock;
  };
  const reporting = jest.requireMock('../utils/supportWriteErrorReporting') as
    typeof import('../utils/supportWriteErrorReporting');
  const actualReporting = jest.requireActual<typeof import('../utils/supportWriteErrorReporting')>(
    '../utils/supportWriteErrorReporting'
  );
  const reporter = reporting.reportSupportWriteError as jest.MockedFunction<typeof reporting.reportSupportWriteError>;
  type Write = { kind: 'set'; path: string; data: Record<string, unknown>; options: unknown };
  let staged: Write[];
  let committed: Write[];
  let events: string[];
  let commit: jest.Mock;
  let consoleError: jest.SpyInstance;
  let consoleWarn: jest.SpyInstance;
  let consoleLog: jest.SpyInstance;
  let dependencies: jest.Mocked<VehicleMonthlyLedgerMutationDependencies>;
  const operationId = 'private-operation-marker';
  const upsertId = 'vehicle-ledger__2026-07__vehicle-1__2026-07-01__2026-07-31__FUEL__default';
  const expectedResult = {
    operationId, upsertedExpenseCount: 1, cancelledExpenseCount: 1,
    expenseUpsertIds: [upsertId], expenseCancelIds: ['visible-expense']
  };
  const save = () => saveVehicleMonthlyLedgerMutation({
    yearMonth: '2026-07', visibleRows: [{ row: buildRow() }],
    originalExpenses: [buildExpense({ id: 'visible-expense' }),
      buildExpense({ id: 'hidden-expense', date: '2026-08-01' })],
    expenseTypes: ['FUEL'], operationId, dependencies
  });
  const expectedWrites = (): Write[] => [
    { kind: 'set', path: `vehicleExpenses/${upsertId}`, options: { merge: true }, data: {
      id: upsertId, vehicleId: 'vehicle-1', vehiclePlate: '12가3456',
      date: '2026-07-01', type: 'FUEL', amount: 10000, payer: 'COMPANY',
      note: '월원장 메모', status: 'ACTIVE', operationId, lastOperationId: operationId,
      cancelledAt: null, updatedAt: 'isolated-timestamp'
    } },
    { kind: 'set', path: 'vehicleExpenses/visible-expense', options: { merge: true }, data: {
      status: 'CANCELLED', cancelledAt: 'isolated-timestamp',
      lastOperationId: operationId, updatedAt: 'isolated-timestamp'
    } }
  ];
  const expectFinancialScope = (success: boolean) => {
    expect(dependencies.applyExpenseChanges).toHaveBeenCalledTimes(1);
    expect(sdk.writeBatch).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledTimes(1);
    expect(staged).toEqual(expectedWrites());
    expect(committed).toEqual(success ? expectedWrites() : []);
    expect(sdk.doc.mock.calls.map(call => call.slice(1))).toEqual([
      ['vehicleExpenses', upsertId], ['vehicleExpenses', 'visible-expense']
    ]);
  };
  const expectSafeConsole = () => {
    for (const call of consoleError.mock.calls) {
      expect(call).toEqual(['[support-write-operation]', {
        domain: 'vehicle', errorCode: 'SUPPORT_WRITE_UNKNOWN'
      }]);
    }
    expect(consoleWarn).not.toHaveBeenCalled();
    expect(consoleLog).not.toHaveBeenCalled();
  };
  const expectSuccessRecord = () => {
    expect(dependencies.recordOperation).toHaveBeenCalledTimes(1);
    expect(dependencies.recordOperation).toHaveBeenCalledWith({
      domain: 'vehicle', yearMonth: '2026-07', operationId, status: 'success',
      affectedDocumentIds: [upsertId, 'visible-expense'], metadata: {
        upsertedExpenseCount: 1, cancelledExpenseCount: 1, billingMutation: 'automatic-after-save'
      }
    });
  };
  beforeEach(() => {
    jest.clearAllMocks();
    reporter.mockReset().mockImplementation(actualReporting.reportSupportWriteError);
    sdk.doc.mockImplementation((_db: unknown, collection: string, id: string) => ({ path: `${collection}/${id}` }));
    sdk.serverTimestamp.mockImplementation(() => 'isolated-timestamp');
    staged = []; committed = []; events = [];
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    consoleLog = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    commit = jest.fn(async () => { events.push('commit'); committed = staged.slice(); });
    sdk.writeBatch.mockImplementation(() => ({
      set: (ref: { path: string }, data: Record<string, unknown>, options: unknown) => {
        events.push('set'); staged.push({ kind: 'set', path: ref.path, data, options });
      },
      update: () => { throw new Error('unexpected-update'); },
      delete: () => { throw new Error('unexpected-delete'); }, commit
    }));
    dependencies = {
      applyExpenseChanges: jest.fn(params => actualVehicle.applyVehicleExpenseChanges(params)),
      recordOperation: jest.fn(async (_input: Parameters<VehicleMonthlyLedgerMutationDependencies['recordOperation']>[0]) => { events.push('record'); })
    };
  });
  afterEach(() => jest.restoreAllMocks());

  it('positive control: preserves exact writes, commit order, result and success record', async () => {
    await expect(save()).resolves.toEqual(expectedResult);
    expectFinancialScope(true);
    expect(events).toEqual(['set', 'set', 'commit', 'record']);
    expectSuccessRecord();
    expect(reporter).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('positive control: ordinary business failure retains identity and failed context', async () => {
    const error = new Error('ordinary-business-failure');
    commit.mockImplementationOnce(async () => { events.push('commit-failed'); throw error; });
    await expect(save()).rejects.toBe(error);
    expectFinancialScope(false);
    expect(events).toEqual(['set', 'set', 'commit-failed', 'record']);
    const context = {
      domain: 'vehicle', yearMonth: '2026-07', operationId,
      affectedDocumentIds: [upsertId, 'visible-expense'], errorMessage: error.message,
      userMessage: actualReporting.SUPPORT_WRITE_RETRY_USER_MESSAGE, status: 'failed'
    };
    expect(dependencies.recordOperation).toHaveBeenCalledTimes(1);
    expect(dependencies.recordOperation).toHaveBeenCalledWith(context);
    expect(reporter).toHaveBeenCalledTimes(1);
    expect(reporter).toHaveBeenCalledWith(error, context);
    expect(consoleError).toHaveBeenCalledTimes(1);
    expectSafeConsole();
  });

  it.each(['Error', 'plain object'])('retains original %s when the actual message getter throws', async kind => {
    const error = kind === 'Error' ? new Error('not-readable') : {};
    const getterFailure = new Error('getter-failed');
    const getter = jest.fn(() => { throw getterFailure; });
    Object.defineProperty(error, 'message', { get: getter });
    expect(reporting.getErrorMessage).toBe(actualReporting.getErrorMessage);
    expect(() => actualReporting.getErrorMessage(error)).toThrow(getterFailure);
    getter.mockClear();
    commit.mockRejectedValueOnce(error);
    await expect(save()).rejects.toBe(error);
    expect(getter).toHaveBeenCalledTimes(1);
    expectFinancialScope(false);
    expect(dependencies.recordOperation).not.toHaveBeenCalled();
    expect(reporter).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
    expectSafeConsole();
  });

  it('preserves the business exception if reporting throws', async () => {
    const error = new Error('business-private');
    commit.mockRejectedValueOnce(error);
    reporter.mockImplementationOnce(() => { throw new Error('report-private'); });
    await expect(save()).rejects.toBe(error);
    expectFinancialScope(false);
    expect(dependencies.recordOperation).toHaveBeenCalledTimes(1);
    expect(reporter).toHaveBeenCalledTimes(1);
    expectSafeConsole();
  });

  it.each([false, true])('log failure cannot change a committed success (report throws: %s)', async reportThrows => {
    const logError = new Error('raw-log-private');
    dependencies.recordOperation.mockRejectedValueOnce(logError);
    if (reportThrows) reporter.mockImplementationOnce(() => { throw new Error('report-private'); });
    await expect(save()).resolves.toEqual(expectedResult);
    expectFinancialScope(true);
    expectSuccessRecord();
    expect(reporter).toHaveBeenCalledTimes(1);
    expect(reporter).toHaveBeenCalledWith(logError, { domain: 'vehicle', status: 'record-failed' });
    expectSafeConsole();
  });

  it('isolates both failed recording and failed reporting without retrying financial writes', async () => {
    const error = new Error('original-business-private');
    commit.mockRejectedValueOnce(error);
    dependencies.recordOperation.mockRejectedValueOnce(new Error('log-private'));
    reporter.mockImplementation(() => { throw new Error('report-private'); });
    await expect(save()).rejects.toBe(error);
    expectFinancialScope(false);
    expect(dependencies.recordOperation).toHaveBeenCalledTimes(1);
    expect(reporter).toHaveBeenCalledTimes(2);
    expectSafeConsole();
  });

  it('a throwing console inside the real safe reporter cannot undo successful finance', async () => {
    dependencies.recordOperation.mockRejectedValueOnce(new Error('log-private'));
    consoleError.mockImplementation(() => { throw new Error('console-private'); });
    await expect(save()).resolves.toEqual(expectedResult);
    expectFinancialScope(true);
    expectSuccessRecord();
    expect(reporter).toHaveBeenCalledTimes(1);
    expectSafeConsole();
  });
});
