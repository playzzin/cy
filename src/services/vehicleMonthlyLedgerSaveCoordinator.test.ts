// Coordinator-only DI contract tests; no runtime service/SDK or real builder.
// Synthetic I/O results do not prove document generation or financial commit.
import { saveVehicleMonthlyLedgerWithBilling } from './vehicleMonthlyLedgerSaveCoordinator';
import type {
  VehicleMonthlyLedgerMutationRow,
  VehicleMonthlyLedgerSaveInput,
  VehicleMonthlyLedgerSaveResult
} from './vehicleMonthlyLedgerMutationService';
import type {
  StoredVehicleLedgerBillingRow,
  UpsertVehicleMonthlyLedgerDraftsResult
} from './vehicleMonthlyLedgerBillingService';
import type { ConfirmedTeamSettlementKeys } from './teamSettlementProtectionService';
import type { VehicleExpenseRecord } from '../types/vehicle';
import type { VehicleBillingDocument } from '../types/vehicleBilling';

type TestRow = VehicleMonthlyLedgerMutationRow & StoredVehicleLedgerBillingRow;
type LedgerInput = Pick<VehicleMonthlyLedgerSaveInput<TestRow>,
  'yearMonth' | 'visibleRows' | 'originalExpenses' | 'expenseTypes'>;
type AppliedDraft = UpsertVehicleMonthlyLedgerDraftsResult & {
  desiredDocuments: VehicleBillingDocument[];
};

it('keeps ledger acknowledgement separate when stored-expense reread rejects, without a second write', async () => {
  // Created inside the test: CRA resetMocks must not erase factory behavior.
  const calls: string[] = [];
  const row: TestRow = {
    id: 'synthetic-row',
    vehicle: { id: 'synthetic-vehicle', licensePlate: 'TEST-ONLY' },
    segment: { startDate: '2026-08-01', endDate: '2026-08-31' },
    amounts: { FUEL: 100 }, fineChargeTarget: 'BILLING_TARGET',
    rentFee: 0, leaseFee: 0, variableTotal: 100, total: 100, note: ''
  };
  const input: LedgerInput = {
    yearMonth: '2026-08', visibleRows: [{ row }],
    originalExpenses: [], expenseTypes: ['FUEL']
  };
  const ledgerResult: VehicleMonthlyLedgerSaveResult = {
    operationId: 'synthetic-operation', upsertedExpenseCount: 1,
    cancelledExpenseCount: 0, expenseUpsertIds: ['synthetic-expense'], expenseCancelIds: []
  };
  const readError = new Error('synthetic-stored-expense-read-failure');
  const saveMonthlyLedger = jest.fn(async (_input: LedgerInput) => {
    calls.push('ledger-acknowledged');
    return ledgerResult;
  });
  const getExpensesByMonth = jest.fn(async (_month: string): Promise<VehicleExpenseRecord[]> => {
    calls.push('stored-expenses');
    throw readError;
  });
  const getBillingsByMonth = jest.fn(async (
    _month: string, _options?: { throwOnError?: boolean }
  ): Promise<VehicleBillingDocument[]> => {
    calls.push('stored-billings');
    return [];
  });
  const getConfirmedTeamSettlementKeys = jest.fn(async (_month: string): Promise<ConfirmedTeamSettlementKeys> => {
    calls.push('stored-settlements');
    return { teamIds: new Set(), teamNames: new Set() };
  });
  // These are original screen closures, not replacements for server contracts.
  // A failed snapshot must reach none of them, especially the writing boundary.
  const loadStoredBillingRow = jest.fn(async (_row: TestRow, _expenses: VehicleExpenseRecord[]): Promise<TestRow> => {
    throw new Error('unexpected-row-build');
  });
  const getAutoBillingValidationMessage = jest.fn((_row: TestRow): string | null => null);
  const getAllBillingDocumentsForRow = jest.fn((_row: TestRow, _docs: VehicleBillingDocument[]): VehicleBillingDocument[] => []);
  const getBlockingUnmanagedDocumentsForRow = jest.fn((_row: TestRow, _docs: VehicleBillingDocument[]): VehicleBillingDocument[] => []);
  const isRowTeamSettlementConfirmed = jest.fn((_row: TestRow, _docs: VehicleBillingDocument[], _keys: ConfirmedTeamSettlementKeys) => false);
  const applyDraftBillingForStoredRow = jest.fn(async (_row: TestRow, _docs: VehicleBillingDocument[]): Promise<AppliedDraft> => {
    throw new Error('unexpected-draft-write');
  });

  const result = await saveVehicleMonthlyLedgerWithBilling(input, {
    saveMonthlyLedger, getExpensesByMonth, getBillingsByMonth,
    getConfirmedTeamSettlementKeys, loadStoredBillingRow,
    getAutoBillingValidationMessage, getAllBillingDocumentsForRow,
    getBlockingUnmanagedDocumentsForRow, isRowTeamSettlementConfirmed,
    applyDraftBillingForStoredRow
  });

  expect(result).toEqual({
    status: 'partial', ledgerStatus: 'acknowledged', billingStatus: 'snapshot-failed',
    ledgerResult, attemptedRowIds: ['synthetic-row'],
    syncedCount: 0, zeroAmountCount: 0, failedRowIds: [], newlyProtectedRowIds: [],
    error: readError
  });
  expect(result.ledgerResult).toBe(ledgerResult);
  expect(result.error).toBe(readError);
  expect(saveMonthlyLedger).toHaveBeenCalledTimes(1);
  expect(saveMonthlyLedger).toHaveBeenCalledWith(input);
  expect(getExpensesByMonth).toHaveBeenCalledTimes(1);
  expect(getExpensesByMonth).toHaveBeenCalledWith('2026-08');
  expect(getBillingsByMonth).toHaveBeenCalledTimes(1);
  expect(getBillingsByMonth).toHaveBeenCalledWith('2026-08', { throwOnError: true });
  expect(getConfirmedTeamSettlementKeys).toHaveBeenCalledTimes(1);
  expect(getConfirmedTeamSettlementKeys).toHaveBeenCalledWith('2026-08');
  expect(calls).toEqual(['ledger-acknowledged', 'stored-expenses', 'stored-billings', 'stored-settlements']);
  expect(loadStoredBillingRow).not.toHaveBeenCalled();
  expect(getAutoBillingValidationMessage).not.toHaveBeenCalled();
  expect(getAllBillingDocumentsForRow).not.toHaveBeenCalled();
  expect(getBlockingUnmanagedDocumentsForRow).not.toHaveBeenCalled();
  expect(isRowTeamSettlementConfirmed).not.toHaveBeenCalled();
  expect(applyDraftBillingForStoredRow).not.toHaveBeenCalled();
});


function fixture(ids = ['row-a', 'row-b']) {
  const rows: TestRow[] = ids.map(id => ({
    id, vehicle: { id: `vehicle-${id}`, licensePlate: 'TEST-ONLY' },
    segment: { startDate: '2026-08-01', endDate: '2026-08-31' },
    amounts: { FUEL: 100 }, fineChargeTarget: 'BILLING_TARGET',
    rentFee: 0, leaseFee: 0, variableTotal: 100, total: 100, note: ''
  }));
  const storedRows = rows.map(row => ({ ...row, amounts: { FUEL: 250 }, variableTotal: 250, total: 250 }));
  const expenses: VehicleExpenseRecord[] = [];
  const documents: VehicleBillingDocument[] = [];
  const keys: ConfirmedTeamSettlementKeys = { teamIds: new Set(), teamNames: new Set() };
  const input: LedgerInput = { yearMonth: '2026-08', visibleRows: rows.map(row => ({row})), originalExpenses: [], expenseTypes: ['FUEL'] };
  const ledgerResult: VehicleMonthlyLedgerSaveResult = { operationId: 'test-operation', upsertedExpenseCount: 2, cancelledExpenseCount: 0, expenseUpsertIds: ['expense-a', 'expense-b'], expenseCancelIds: [] };
  const calls: string[] = [];
  const deps = {
    saveMonthlyLedger: jest.fn(async (_input: LedgerInput) => { calls.push('ledger'); return ledgerResult; }),
    getExpensesByMonth: jest.fn(async (_month: string) => { calls.push('expenses'); return expenses; }),
    getBillingsByMonth: jest.fn(async (_month: string, _options: {throwOnError: true}) => { calls.push('billings'); return documents; }),
    getConfirmedTeamSettlementKeys: jest.fn(async (_month: string) => { calls.push('settlements'); return keys; }),
    loadStoredBillingRow: jest.fn(async (row: TestRow, _expenses: VehicleExpenseRecord[]) => { calls.push(`load:${row.id}`); return storedRows[rows.indexOf(row)]; }),
    getAutoBillingValidationMessage: jest.fn((row: TestRow): string | null => { calls.push(`validate:${row.id}`); return null; }),
    getAllBillingDocumentsForRow: jest.fn((row: TestRow, docs: VehicleBillingDocument[]) => { calls.push(`documents:${row.id}`); return docs.filter(d => d.vehicleId === row.vehicle.id); }),
    getBlockingUnmanagedDocumentsForRow: jest.fn((row: TestRow, _docs: VehicleBillingDocument[]): VehicleBillingDocument[] => { calls.push(`unmanaged:${row.id}`); return []; }),
    isRowTeamSettlementConfirmed: jest.fn((row: TestRow, _docs: VehicleBillingDocument[], _keys: ConfirmedTeamSettlementKeys) => { calls.push(`settled:${row.id}`); return false; }),
    applyDraftBillingForStoredRow: jest.fn(async (row: TestRow, _docs: VehicleBillingDocument[]): Promise<AppliedDraft> => { calls.push(`apply:${row.id}`); return saved(); })
  };
  return { rows, storedRows, expenses, documents, keys, input, ledgerResult, calls, deps };
}
function saved(desiredDocuments: VehicleBillingDocument[] = [], savedIds: string[] = [], deletedDraftIds: string[] = []): AppliedDraft {
  return { status: 'saved', desiredDocuments, savedIds, deletedDraftIds, protectedIds: [], protectedStatuses: [] };
}
function expectNoRows(f: ReturnType<typeof fixture>) {
  expect(f.deps.loadStoredBillingRow).not.toHaveBeenCalled();
  expect(f.deps.getAutoBillingValidationMessage).not.toHaveBeenCalled();
  expect(f.deps.getAllBillingDocumentsForRow).not.toHaveBeenCalled();
  expect(f.deps.getBlockingUnmanagedDocumentsForRow).not.toHaveBeenCalled();
  expect(f.deps.isRowTeamSettlementConfirmed).not.toHaveBeenCalled();
  expect(f.deps.applyDraftBillingForStoredRow).not.toHaveBeenCalled();
}
it('billing snapshot rejection preserves original error and acknowledgement, with no row work', async () => {
  const f = fixture(); const error = new Error('billing-read');
  f.deps.getBillingsByMonth.mockRejectedValueOnce(error);
  const result = await saveVehicleMonthlyLedgerWithBilling(f.input, f.deps);
  expect(result).toEqual({ status: 'partial', ledgerStatus: 'acknowledged', billingStatus: 'snapshot-failed', ledgerResult: f.ledgerResult, error, attemptedRowIds: ['row-a','row-b'], syncedCount: 0, zeroAmountCount: 0, failedRowIds: [], newlyProtectedRowIds: [] });
  expect(result.ledgerResult).toBe(f.ledgerResult); expect(result.error).toBe(error);
  expect(f.deps.saveMonthlyLedger).toHaveBeenCalledTimes(1);
  expect(f.deps.getBillingsByMonth).toHaveBeenCalledWith('2026-08', {throwOnError: true});
  expectNoRows(f);
});

it('settlement snapshot rejection preserves original error and acknowledgement, with no row work', async () => {
  const f = fixture(); const error = new Error('settlement-read');
  f.deps.getConfirmedTeamSettlementKeys.mockRejectedValueOnce(error);
  const result = await saveVehicleMonthlyLedgerWithBilling(f.input, f.deps);
  expect(result).toEqual({ status: 'partial', ledgerStatus: 'acknowledged', billingStatus: 'snapshot-failed', ledgerResult: f.ledgerResult, error, attemptedRowIds: ['row-a','row-b'], syncedCount: 0, zeroAmountCount: 0, failedRowIds: [], newlyProtectedRowIds: [] });
  expect(result.ledgerResult).toBe(f.ledgerResult); expect(result.error).toBe(error);
  expect(f.deps.saveMonthlyLedger).toHaveBeenCalledTimes(1);
  expect(f.deps.getConfirmedTeamSettlementKeys).toHaveBeenCalledWith('2026-08');
  expectNoRows(f);
});

it('ledger rejection propagates the identical error without reads or retries', async () => {
  const f = fixture(); const error = new Error('ledger-reject');
  f.deps.saveMonthlyLedger.mockRejectedValueOnce(error);
  await expect(saveVehicleMonthlyLedgerWithBilling(f.input, f.deps)).rejects.toBe(error);
  expect(f.deps.saveMonthlyLedger).toHaveBeenCalledTimes(1);
  expect(f.deps.saveMonthlyLedger.mock.calls[0]).toEqual([f.input]);
  expect(Object.keys(f.deps.saveMonthlyLedger.mock.calls[0][0]).sort()).toEqual(['expenseTypes','originalExpenses','visibleRows','yearMonth']);
  expect(f.deps.getExpensesByMonth).not.toHaveBeenCalled();
  expect(f.deps.getBillingsByMonth).not.toHaveBeenCalled();
  expect(f.deps.getConfirmedTeamSettlementKeys).not.toHaveBeenCalled();
  expectNoRows(f);
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
}
it('does not begin rereads before deferred ledger acknowledgement', async () => {
  const f = fixture(); const pending = deferred<VehicleMonthlyLedgerSaveResult>();
  const error = new Error('after-ack-snapshot');
  f.deps.saveMonthlyLedger.mockImplementationOnce(() => pending.promise);
  f.deps.getExpensesByMonth.mockImplementationOnce(async () => { f.calls.push('expenses'); throw error; });
  const running = saveVehicleMonthlyLedgerWithBilling(f.input, f.deps);
  await Promise.resolve(); await Promise.resolve();
  expect(f.deps.saveMonthlyLedger).toHaveBeenCalledTimes(1);
  expect(f.deps.getExpensesByMonth).not.toHaveBeenCalled();
  expect(f.deps.getBillingsByMonth).not.toHaveBeenCalled();
  expect(f.deps.getConfirmedTeamSettlementKeys).not.toHaveBeenCalled(); expectNoRows(f);
  pending.resolve(f.ledgerResult);
  const result = await running;
  expect(result.ledgerResult).toBe(f.ledgerResult); expect(result.error).toBe(error);
  expect(f.calls).toEqual(['expenses','billings','settlements']);
  expect(f.deps.saveMonthlyLedger).toHaveBeenCalledTimes(1); expectNoRows(f);
});

it('continues successful snapshots in original row order using only rebuilt rows and exact DI arguments', async () => {
  const f = fixture();
  const result = await saveVehicleMonthlyLedgerWithBilling(f.input, f.deps);
  expect(result).toEqual({status: 'completed', ledgerStatus: 'acknowledged', billingStatus: 'rows-completed', ledgerResult: f.ledgerResult, attemptedRowIds: ['row-a','row-b'], syncedCount: 2, zeroAmountCount: 0, failedRowIds: [], newlyProtectedRowIds: []});
  expect(result.ledgerResult).toBe(f.ledgerResult);
  expect(f.calls).toEqual(['ledger','expenses','billings','settlements', ...['row-a','row-b'].flatMap(id => ['load','validate','documents','unmanaged','settled','apply'].map(step => `${step}:${id}`))]);
  expect(f.deps.saveMonthlyLedger).toHaveBeenCalledTimes(1);
  expect(f.deps.saveMonthlyLedger.mock.calls[0]).toEqual([f.input]);
  expect(Object.keys(f.deps.saveMonthlyLedger.mock.calls[0][0]).sort()).toEqual(['expenseTypes','originalExpenses','visibleRows','yearMonth']);
  expect(f.deps.getExpensesByMonth.mock.calls).toEqual([['2026-08']]);
  expect(f.deps.getBillingsByMonth.mock.calls).toEqual([['2026-08',{throwOnError:true}]]);
  expect(f.deps.getConfirmedTeamSettlementKeys.mock.calls).toEqual([['2026-08']]);
  f.rows.forEach((row, i) => {
    expect(f.deps.loadStoredBillingRow.mock.calls[i][0]).toBe(row);
    expect(f.deps.loadStoredBillingRow.mock.calls[i][1]).toBe(f.expenses);
    expect(f.deps.getAutoBillingValidationMessage.mock.calls[i]).toEqual([f.storedRows[i]]);
    expect(f.deps.getAllBillingDocumentsForRow.mock.calls[i][0]).toBe(f.storedRows[i]);
    expect(f.deps.getBlockingUnmanagedDocumentsForRow.mock.calls[i][0]).toBe(f.storedRows[i]);
    expect(f.deps.isRowTeamSettlementConfirmed.mock.calls[i]).toEqual([f.storedRows[i],[],f.keys]);
    expect(f.deps.isRowTeamSettlementConfirmed.mock.calls[i][2]).toBe(f.keys);
    expect(f.deps.applyDraftBillingForStoredRow.mock.calls[i]).toEqual([f.storedRows[i],[]]);
    expect(f.deps.applyDraftBillingForStoredRow.mock.calls[i][0]).toBe(f.storedRows[i]);
  });
});

function document(id: string, vehicleId = 'vehicle-row-a'): VehicleBillingDocument {
  return { id, vehicleId, vehiclePlate: 'TEST-ONLY', yearMonth: '2026-08', fixedCost: 0, variableCost: 250, totalAmount: 250, status: 'DRAFT', lineItems: [] };
}
it('awaits each upsert and supplies next row with exact updated workingDocuments without mutating snapshots', async () => {
  const f = fixture();
  const removed = document('old-draft'); const replaced = document('canonical-a'); const unrelated = document('unrelated', 'other');
  f.documents.push(removed, replaced, unrelated);
  const desired = [document('requested-a'), document('requested-b')];
  desired[0].status = 'CONFIRMED';
  const pending = deferred<AppliedDraft>(); const entered = deferred<void>();
  f.deps.applyDraftBillingForStoredRow.mockImplementationOnce(async () => { entered.resolve(); return pending.promise; });
  const running = saveVehicleMonthlyLedgerWithBilling(f.input, f.deps);
  await entered.promise;
  expect(f.deps.loadStoredBillingRow).toHaveBeenCalledTimes(1);
  expect(f.deps.applyDraftBillingForStoredRow).toHaveBeenCalledTimes(1);
  expect(f.deps.getAllBillingDocumentsForRow.mock.calls[0][1]).toBe(f.documents);
  pending.resolve(saved(desired, ['canonical-a','canonical-b'], ['old-draft']));
  const result = await running;
  const expected = [unrelated, {...desired[0], id:'canonical-a', status:'DRAFT', confirmedAt:undefined}, {...desired[1], id:'canonical-b', status:'DRAFT', confirmedAt:undefined}];
  const next = f.deps.getAllBillingDocumentsForRow.mock.calls[1][1];
  expect(next).toEqual(expected);
  expect(next[0]).toBe(unrelated);
  expect(f.deps.getBlockingUnmanagedDocumentsForRow.mock.calls[1][1]).toBe(next);
  expect(f.documents).toEqual([removed,replaced,unrelated]);
  expect(desired[0].status).toBe('CONFIRMED');
  expect(result.syncedCount).toBe(2); expect(result.status).toBe('completed');
  expect(f.deps.saveMonthlyLedger).toHaveBeenCalledTimes(1);
});

it('classifies stored-row validation failure by original row id and continues next row without first-row billing', async () => {
  const f = fixture(); const diagnostic = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  try {
    f.storedRows[0] = {...f.storedRows[0], id:'rebuilt-id-not-retry-id'};
    f.deps.getAutoBillingValidationMessage.mockReturnValueOnce('invalid-stored-target');
    const result = await saveVehicleMonthlyLedgerWithBilling(f.input, f.deps);
    expect(result).toEqual({status:'partial', ledgerStatus:'acknowledged', billingStatus:'rows-partial', ledgerResult:f.ledgerResult, attemptedRowIds:['row-a','row-b'], syncedCount:1, zeroAmountCount:0, failedRowIds:['row-a'], newlyProtectedRowIds:[]});
    expect(result.ledgerResult).toBe(f.ledgerResult);
    expect(f.deps.applyDraftBillingForStoredRow.mock.calls).toEqual([[f.storedRows[1],[]]]);
    expect(f.deps.getAllBillingDocumentsForRow).toHaveBeenCalledTimes(1);
    expect(f.deps.getBlockingUnmanagedDocumentsForRow).toHaveBeenCalledTimes(1);
    expect(f.deps.isRowTeamSettlementConfirmed).toHaveBeenCalledTimes(1);
    expect(f.deps.loadStoredBillingRow).toHaveBeenCalledTimes(2);
    expect(f.deps.saveMonthlyLedger).toHaveBeenCalledTimes(1);
    expect(diagnostic).toHaveBeenCalledTimes(1);
  } finally { diagnostic.mockRestore(); }
});

it('classifies rejected upsert as failed, retains working snapshot, and does not retry before next row', async () => {
  const f = fixture(); const error = new Error('upsert-rejected');
  const diagnostic = jest.spyOn(console,'error').mockImplementation(() => undefined);
  try {
    f.documents.push(document('existing'));
    f.deps.applyDraftBillingForStoredRow.mockRejectedValueOnce(error);
    const result = await saveVehicleMonthlyLedgerWithBilling(f.input,f.deps);
    expect(result).toEqual({status:'partial',ledgerStatus:'acknowledged',billingStatus:'rows-partial',ledgerResult:f.ledgerResult,attemptedRowIds:['row-a','row-b'],syncedCount:1,zeroAmountCount:0,failedRowIds:['row-a'],newlyProtectedRowIds:[]});
    expect(result.ledgerResult).toBe(f.ledgerResult);
    expect(f.deps.applyDraftBillingForStoredRow.mock.calls).toEqual([[f.storedRows[0],f.documents],[f.storedRows[1],[]]]);
    expect(f.deps.getAllBillingDocumentsForRow.mock.calls[1][1]).toBe(f.documents);
    expect(f.deps.saveMonthlyLedger).toHaveBeenCalledTimes(1);
    expect(diagnostic.mock.calls[0][2]).toBe(error);
  } finally { diagnostic.mockRestore(); }
});


it('manual blocking result protects the row without settlement or billing calls for that row', async () => {
  const f = fixture(); const blocker = document('manual-document');
  blocker.lineItems = [ {id:'manual',label:'manual',amount:10,type:'VARIABLE',sourceType:'manual'}  ];
  f.documents.push(blocker);
  // Ownership detection remains the original injected builder/closure boundary.
  f.deps.getBlockingUnmanagedDocumentsForRow.mockReturnValueOnce([blocker]);
  const result = await saveVehicleMonthlyLedgerWithBilling(f.input,f.deps);
  expect(result).toEqual({status:'partial',ledgerStatus:'acknowledged',billingStatus:'rows-partial',ledgerResult:f.ledgerResult,attemptedRowIds:['row-a','row-b'],syncedCount:1,zeroAmountCount:0,failedRowIds:[],newlyProtectedRowIds:['row-a']});
  expect(f.deps.isRowTeamSettlementConfirmed.mock.calls).toEqual([[f.storedRows[1],[],f.keys]]);
  expect(f.deps.applyDraftBillingForStoredRow.mock.calls).toEqual([[f.storedRows[1],[]]]);
  expect(f.deps.getAllBillingDocumentsForRow.mock.calls[1][1]).toBe(f.documents);
  expect(f.documents).toEqual([blocker]); expect(f.deps.saveMonthlyLedger).toHaveBeenCalledTimes(1);
});


it('mixed blocking result protects the row without settlement or billing calls for that row', async () => {
  const f = fixture(); const blocker = document('mixed-document');
  blocker.lineItems = [ {id:'manual',label:'manual',amount:10,type:'VARIABLE',sourceType:'manual'} , {id:'ledger',label:'ledger',amount:20,type:'VARIABLE',sourceType:'vehicle_ledger'} ];
  f.documents.push(blocker);
  // Ownership detection remains the original injected builder/closure boundary.
  f.deps.getBlockingUnmanagedDocumentsForRow.mockReturnValueOnce([blocker]);
  const result = await saveVehicleMonthlyLedgerWithBilling(f.input,f.deps);
  expect(result).toEqual({status:'partial',ledgerStatus:'acknowledged',billingStatus:'rows-partial',ledgerResult:f.ledgerResult,attemptedRowIds:['row-a','row-b'],syncedCount:1,zeroAmountCount:0,failedRowIds:[],newlyProtectedRowIds:['row-a']});
  expect(f.deps.isRowTeamSettlementConfirmed.mock.calls).toEqual([[f.storedRows[1],[],f.keys]]);
  expect(f.deps.applyDraftBillingForStoredRow.mock.calls).toEqual([[f.storedRows[1],[]]]);
  expect(f.deps.getAllBillingDocumentsForRow.mock.calls[1][1]).toBe(f.documents);
  expect(f.documents).toEqual([blocker]); expect(f.deps.saveMonthlyLedger).toHaveBeenCalledTimes(1);
});

it('confirmed settlement protects only that row without applying its draft', async () => {
  const f = fixture(); const existing = document('settled'); f.documents.push(existing);
  f.keys.teamIds.add('synthetic-team');
  f.deps.isRowTeamSettlementConfirmed.mockReturnValueOnce(true);
  const result = await saveVehicleMonthlyLedgerWithBilling(f.input,f.deps);
  expect(result).toEqual({status:'partial',ledgerStatus:'acknowledged',billingStatus:'rows-partial',ledgerResult:f.ledgerResult,attemptedRowIds:['row-a','row-b'],syncedCount:1,zeroAmountCount:0,failedRowIds:[],newlyProtectedRowIds:['row-a']});
  expect(f.deps.isRowTeamSettlementConfirmed.mock.calls[0]).toEqual([f.storedRows[0],[existing],f.keys]);
  expect(f.deps.isRowTeamSettlementConfirmed.mock.calls[0][2]).toBe(f.keys);
  expect(f.deps.applyDraftBillingForStoredRow.mock.calls).toEqual([[f.storedRows[1],[]]]);
  expect(f.deps.getAllBillingDocumentsForRow.mock.calls[1][1]).toBe(f.documents);
  expect(f.deps.saveMonthlyLedger).toHaveBeenCalledTimes(1);
});

it('skipped-posted is protected, not failed or synced, with protected snapshot retained for the next row', async () => {
  const f = fixture(); const posted = document('posted'); posted.status='PAID'; f.documents.push(posted);
  f.storedRows[0].total=0;
  const skipped: AppliedDraft = {status:'skipped-posted',savedIds:[],deletedDraftIds:[],protectedIds:['posted'],protectedStatuses:['PAID'],desiredDocuments:[]};
  f.deps.applyDraftBillingForStoredRow.mockResolvedValueOnce(skipped);
  const result = await saveVehicleMonthlyLedgerWithBilling(f.input,f.deps);
  expect(result).toEqual({status:'partial',ledgerStatus:'acknowledged',billingStatus:'rows-partial',ledgerResult:f.ledgerResult,attemptedRowIds:['row-a','row-b'],syncedCount:1,zeroAmountCount:0,failedRowIds:[],newlyProtectedRowIds:['row-a']});
  expect(f.deps.applyDraftBillingForStoredRow.mock.calls).toEqual([[f.storedRows[0],[posted]],[f.storedRows[1],[]]]);
  expect(f.deps.getAllBillingDocumentsForRow.mock.calls[1][1]).toBe(f.documents);
  expect(f.documents).toEqual([posted]); expect(skipped.deletedDraftIds).toEqual([]);
  expect(f.deps.saveMonthlyLedger).toHaveBeenCalledTimes(1);
});

it('completes only the supplied eligible subset without widening rows or claiming excluded-row completion', async () => {
  const f = fixture(['excluded','eligible']);
  f.input.visibleRows = [{row:f.rows[1]}];
  const result = await saveVehicleMonthlyLedgerWithBilling(f.input,f.deps);
  expect(result).toEqual({status:'completed',ledgerStatus:'acknowledged',billingStatus:'rows-completed',ledgerResult:f.ledgerResult,attemptedRowIds:['eligible'],syncedCount:1,zeroAmountCount:0,failedRowIds:[],newlyProtectedRowIds:[]});
  expect(result.ledgerResult).toBe(f.ledgerResult);
  expect(f.deps.saveMonthlyLedger.mock.calls).toEqual([[f.input]]);
  expect(f.deps.loadStoredBillingRow.mock.calls).toEqual([[f.rows[1],f.expenses]]);
  expect(f.deps.applyDraftBillingForStoredRow.mock.calls).toEqual([[f.storedRows[1],[]]]);
});

it('zero stored total still calls existing draft boundary and consumes only deletedDraftIds while keeping protected documents', async () => {
  const f = fixture();
  const stale = document('stale-draft'); const protectedDoc = document('protected-other','other'); protectedDoc.status='CONFIRMED';
  f.documents.push(stale,protectedDoc); f.storedRows[0].total=0;
  // The original builder/upsert supplies this result. This is not a real deletion or builder test.
  const cleanup = saved([],[],['stale-draft']);
  f.deps.applyDraftBillingForStoredRow.mockResolvedValueOnce(cleanup);
  const result = await saveVehicleMonthlyLedgerWithBilling(f.input,f.deps);
  expect(result).toEqual({status:'completed',ledgerStatus:'acknowledged',billingStatus:'rows-completed',ledgerResult:f.ledgerResult,attemptedRowIds:['row-a','row-b'],syncedCount:2,zeroAmountCount:1,failedRowIds:[],newlyProtectedRowIds:[]});
  expect(f.deps.applyDraftBillingForStoredRow.mock.calls[0]).toEqual([f.storedRows[0],[stale]]);
  expect(f.deps.getAllBillingDocumentsForRow.mock.calls[1][1]).toEqual([protectedDoc]);
  expect(f.deps.getAllBillingDocumentsForRow.mock.calls[1][1][0]).toBe(protectedDoc);
  expect(f.documents).toEqual([stale,protectedDoc]);
  expect(cleanup).toEqual({status:'saved',desiredDocuments:[],savedIds:[],deletedDraftIds:['stale-draft'],protectedIds:[],protectedStatuses:[]});
  expect(f.deps.saveMonthlyLedger).toHaveBeenCalledTimes(1);
});

it('throwing real console diagnostic cannot replace acknowledgement, failed classification, or next-row processing', async () => {
  const f = fixture(); const rowError = new Error('upsert-failed'); const diagnosticError = new Error('diagnostic-failed');
  const diagnostic = jest.spyOn(console,'error').mockImplementation(() => { throw diagnosticError; });
  try {
    f.deps.applyDraftBillingForStoredRow.mockRejectedValueOnce(rowError);
    const result = await saveVehicleMonthlyLedgerWithBilling(f.input,f.deps);
    expect(result).toEqual({status:'partial',ledgerStatus:'acknowledged',billingStatus:'rows-partial',ledgerResult:f.ledgerResult,attemptedRowIds:['row-a','row-b'],syncedCount:1,zeroAmountCount:0,failedRowIds:['row-a'],newlyProtectedRowIds:[]});
    expect(result.ledgerResult).toBe(f.ledgerResult);
    expect(diagnostic).toHaveBeenCalledTimes(1); expect(diagnostic.mock.calls[0][2]).toBe(rowError);
    expect(f.deps.loadStoredBillingRow).toHaveBeenCalledTimes(2);
    expect(f.deps.applyDraftBillingForStoredRow.mock.calls).toEqual([[f.storedRows[0],[]],[f.storedRows[1],[]]]);
    expect(f.deps.saveMonthlyLedger).toHaveBeenCalledTimes(1);
  } finally { diagnostic.mockRestore(); }
});
