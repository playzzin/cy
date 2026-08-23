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

jest.mock('../utils/supportWriteErrorReporting', () => ({
  SUPPORT_WRITE_RETRY_USER_MESSAGE: 'retry later',
  getErrorMessage: (error: unknown) => error instanceof Error ? error.message : String(error),
  reportSupportWriteError: jest.fn()
}));

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
