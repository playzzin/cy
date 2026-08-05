import {
  saveVehicleMonthlyLedgerMutation,
  type VehicleMonthlyLedgerMutationDependencies,
  type VehicleMonthlyLedgerMutationRow
} from './vehicleMonthlyLedgerMutationService';
import type { VehicleExpenseRecord, VehicleExpenseType } from '../types/vehicle';
import type { VehicleBillingDocument } from '../types/vehicleBilling';

jest.mock('./vehicleService', () => ({
  vehicleService: {
    applyVehicleExpenseChanges: jest.fn()
  }
}));

jest.mock('./vehicleBillingService', () => ({
  isPostedVehicleBillingStatus: jest.fn((status: unknown) => (
    ['CONFIRMED', 'PAID', 'OVERDUE'].includes(String(status ?? '').toUpperCase())
  )),
  vehicleBillingService: {
    saveBilling: jest.fn(),
    deleteBilling: jest.fn()
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

const buildRow = (patch: Partial<VehicleMonthlyLedgerMutationRow> = {}): VehicleMonthlyLedgerMutationRow => ({
  id: 'row-1',
  vehicle: { id: 'vehicle-1', licensePlate: '12가3456' },
  segment: { startDate: '2026-07-01', endDate: '2026-07-31' },
  amounts: {
    FUEL: 10000,
    REPAIR: 0,
    TOLL: 5000,
    FINE: 0,
    OTHER: 0
  },
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

const buildBilling = (id: string): VehicleBillingDocument => ({
  id,
  yearMonth: '2026-07',
  vehicleId: 'vehicle-1',
  vehiclePlate: '12가3456',
  fixedCost: 0,
  variableCost: 0,
  totalAmount: 0,
  status: 'DRAFT',
  lineItems: []
});

const buildDependencies = (): jest.Mocked<VehicleMonthlyLedgerMutationDependencies> => ({
  applyExpenseChanges: jest.fn().mockResolvedValue(undefined),
  saveBilling: jest.fn().mockResolvedValue(undefined),
  recordOperation: jest.fn().mockResolvedValue(undefined)
});

describe('saveVehicleMonthlyLedgerMutation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('upserts deterministic visible expenses and cancels stale visible expenses', async () => {
    const dependencies = buildDependencies();
    const row = buildRow();
    const existingBilling = buildBilling('billing-current');
    const staleBilling = buildBilling('billing-stale');
    const nextBilling = buildBilling('billing-current');

    const result = await saveVehicleMonthlyLedgerMutation({
      yearMonth: '2026-07',
      visibleRows: [{ row }],
      originalExpenses: [
        buildExpense({ id: 'visible-expense', date: '2026-07-10' }),
        buildExpense({ id: 'hidden-expense', date: '2026-08-01' })
      ],
      expenseTypes: ['FUEL', 'REPAIR', 'TOLL', 'FINE', 'OTHER'],
      getBillingDocumentsForRow: () => [existingBilling, staleBilling],
      buildBillingDocumentsForRow: () => [nextBilling],
      dependencies
    });

    expect(dependencies.applyExpenseChanges).toHaveBeenCalledTimes(1);
    expect(dependencies.applyExpenseChanges).toHaveBeenCalledWith(expect.objectContaining({
      cancelIds: ['visible-expense']
    }));
    const expenseChanges = dependencies.applyExpenseChanges.mock.calls[0][0];
    expect(expenseChanges.upserts).toHaveLength(2);
    expect(expenseChanges.upserts.map((expense) => expense.id)).toEqual([
      'vehicle-ledger__2026-07__vehicle-1__2026-07-01__2026-07-31__FUEL__default',
      'vehicle-ledger__2026-07__vehicle-1__2026-07-01__2026-07-31__TOLL__default'
    ]);
    expect(expenseChanges.upserts[0]).toMatchObject({
      vehicleId: 'vehicle-1',
      date: '2026-07-01',
      type: 'FUEL',
      amount: 10000,
      payer: 'COMPANY',
      note: '월원장 메모',
      status: 'ACTIVE'
    });
    expect(dependencies.saveBilling).toHaveBeenCalledWith(nextBilling);
    expect(dependencies.saveBilling).toHaveBeenCalledWith(expect.objectContaining({
      id: 'billing-stale',
      status: 'CANCELLED',
      totalAmount: 0,
      lineItems: []
    }));
    expect(result).toMatchObject({
      upsertedExpenseCount: 2,
      cancelledExpenseCount: 1,
      savedBillingCount: 1,
      cancelledBillingCount: 1,
      expenseCancelIds: ['visible-expense'],
      billingSaveIds: ['billing-current'],
      billingCancelIds: ['billing-stale']
    });
    expect(dependencies.recordOperation).toHaveBeenCalledWith(expect.objectContaining({
      domain: 'vehicle',
      yearMonth: '2026-07',
      operationId: 'vehicle-monthly-ledger:2026-07',
      status: 'success',
      affectedDocumentIds: expect.arrayContaining([
        'vehicle-ledger__2026-07__vehicle-1__2026-07-01__2026-07-31__FUEL__default',
        'visible-expense',
        'billing-current',
        'billing-stale'
      ])
    }));
  });

  it('does not cancel existing data or save billings when expense batch fails', async () => {
    const dependencies = buildDependencies();
    dependencies.applyExpenseChanges.mockRejectedValueOnce(new Error('batch failed'));

    await expect(saveVehicleMonthlyLedgerMutation({
      yearMonth: '2026-07',
      visibleRows: [{ row: buildRow() }],
      originalExpenses: [buildExpense({ id: 'visible-expense' })],
      expenseTypes: ['FUEL'],
      getBillingDocumentsForRow: () => [buildBilling('billing-current')],
      buildBillingDocumentsForRow: () => [buildBilling('billing-current')],
      dependencies
    })).rejects.toThrow('batch failed');

    expect(dependencies.applyExpenseChanges).toHaveBeenCalledWith(expect.objectContaining({
      cancelIds: ['visible-expense']
    }));
    expect(dependencies.saveBilling).not.toHaveBeenCalled();
    expect(dependencies.recordOperation).toHaveBeenCalledWith(expect.objectContaining({
      domain: 'vehicle',
      operationId: 'vehicle-monthly-ledger:2026-07',
      status: 'failed',
      affectedDocumentIds: expect.arrayContaining([
        'vehicle-ledger__2026-07__vehicle-1__2026-07-01__2026-07-31__FUEL__default',
        'visible-expense'
      ]),
      errorMessage: 'batch failed'
    }));
  });

  it('uses stable expense and billing ids when the same save is executed twice', async () => {
    const dependencies = buildDependencies();
    const row = buildRow();
    const nextBilling = buildBilling('billing-current');
    const input = {
      yearMonth: '2026-07',
      visibleRows: [{ row }],
      originalExpenses: [] as VehicleExpenseRecord[],
      expenseTypes: ['FUEL', 'TOLL'] as VehicleExpenseType[],
      getBillingDocumentsForRow: () => [nextBilling],
      buildBillingDocumentsForRow: () => [nextBilling],
      dependencies
    };

    const first = await saveVehicleMonthlyLedgerMutation(input);
    const second = await saveVehicleMonthlyLedgerMutation(input);

    expect(first.expenseUpsertIds).toEqual(second.expenseUpsertIds);
    expect(first.billingSaveIds).toEqual(second.billingSaveIds);
    expect(dependencies.applyExpenseChanges.mock.calls[0][0].upserts.map((expense) => expense.id)).toEqual(
      dependencies.applyExpenseChanges.mock.calls[1][0].upserts.map((expense) => expense.id)
    );
  });

  it('preserves hidden or filtered-out expenses when saving visible rows only', async () => {
    const dependencies = buildDependencies();

    await saveVehicleMonthlyLedgerMutation({
      yearMonth: '2026-07',
      visibleRows: [{ row: buildRow() }],
      originalExpenses: [
        buildExpense({ id: 'visible-expense', vehicleId: 'vehicle-1', date: '2026-07-15' }),
        buildExpense({ id: 'other-vehicle-expense', vehicleId: 'vehicle-2', date: '2026-07-15' }),
        buildExpense({ id: 'other-month-expense', vehicleId: 'vehicle-1', date: '2026-08-01' })
      ],
      expenseTypes: ['FUEL'],
      getBillingDocumentsForRow: () => [],
      buildBillingDocumentsForRow: () => [],
      dependencies
    });

    expect(dependencies.applyExpenseChanges).toHaveBeenCalledWith(expect.objectContaining({
      cancelIds: ['visible-expense']
    }));
  });

  it('skips posted billing rows and still saves safe rows in the same batch', async () => {
    const dependencies = buildDependencies();
    const postedRow = buildRow({ id: 'posted-row' });
    const safeRow = buildRow({
      id: 'safe-row',
      vehicle: { id: 'vehicle-2', licensePlate: '34나5678' }
    });
    const postedBilling = {
      ...buildBilling('billing-posted'),
      status: 'CONFIRMED' as const,
      totalAmount: 10000
    };
    const safeBilling = buildBilling('billing-safe');

    const result = await saveVehicleMonthlyLedgerMutation({
      yearMonth: '2026-07',
      visibleRows: [{ row: postedRow }, { row: safeRow }],
      originalExpenses: [
        buildExpense({ id: 'posted-expense', vehicleId: 'vehicle-1', date: '2026-07-10' }),
        buildExpense({ id: 'safe-expense', vehicleId: 'vehicle-2', date: '2026-07-10' })
      ],
      expenseTypes: ['FUEL'],
      getBillingDocumentsForRow: (row) => row.id === 'posted-row' ? [postedBilling] : [safeBilling],
      buildBillingDocumentsForRow: (row) => row.id === 'posted-row' ? [{
        ...postedBilling,
        totalAmount: 20000
      }] : [safeBilling],
      dependencies
    });

    expect(dependencies.applyExpenseChanges).toHaveBeenCalledWith(expect.objectContaining({
      cancelIds: ['safe-expense']
    }));
    const expenseChanges = dependencies.applyExpenseChanges.mock.calls[0][0];
    expect(expenseChanges.upserts).toHaveLength(1);
    expect(expenseChanges.upserts[0]).toMatchObject({
      id: 'vehicle-ledger__2026-07__vehicle-2__2026-07-01__2026-07-31__FUEL__default',
      vehicleId: 'vehicle-2'
    });
    expect(dependencies.saveBilling).toHaveBeenCalledTimes(1);
    expect(dependencies.saveBilling).toHaveBeenCalledWith(safeBilling);
    expect(result).toMatchObject({
      savedBillingCount: 1,
      cancelledBillingCount: 0,
      skippedBillingCount: 1,
      billingSaveIds: ['billing-safe'],
      billingCancelIds: []
    });
    expect(result.skippedBillingRows).toEqual([{
      rowId: 'posted-row',
      vehicleId: 'vehicle-1',
      vehiclePlate: '12가3456',
      reason: 'posted-billing-protected',
      billingIds: ['billing-posted'],
      statuses: ['CONFIRMED']
    }]);
  });

  it('validates rows before writing', async () => {
    const dependencies = buildDependencies();

    await expect(saveVehicleMonthlyLedgerMutation({
      yearMonth: '2026-07',
      visibleRows: [{ row: buildRow({ segment: { startDate: '2026-07-31', endDate: '2026-07-01' } }) }],
      originalExpenses: [],
      expenseTypes: ['FUEL'],
      getBillingDocumentsForRow: () => [],
      buildBillingDocumentsForRow: () => [],
      dependencies
    })).rejects.toThrow('invalid-ledger-period:row-1');

    expect(dependencies.applyExpenseChanges).not.toHaveBeenCalled();
    expect(dependencies.saveBilling).not.toHaveBeenCalled();
  });
});
