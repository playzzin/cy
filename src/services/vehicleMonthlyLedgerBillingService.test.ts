import {
  buildVehicleLedgerBillingRowFromStoredExpenses,
  getBlockingUnmanagedVehicleBillingDocuments,
  hasVehicleMonthlyLedgerRowScope,
  isManagedVehicleMonthlyLedgerBillingDocument,
  matchesVehicleMonthlyLedgerBillingIdentity,
  selectVehicleMonthlyLedgerRowsForSave,
  upsertVehicleMonthlyLedgerDrafts,
  type VehicleMonthlyLedgerBillingDependencies
} from './vehicleMonthlyLedgerBillingService';
import type { VehicleExpenseRecord, VehicleExpenseType } from '../types/vehicle';
import type { VehicleBillingDocument, VehicleBillingStatus } from '../types/vehicleBilling';

jest.mock('./vehicleBillingService', () => ({
  isPostedVehicleBillingStatus: jest.fn((status: unknown) => (
    ['CONFIRMED', 'PAID', 'OVERDUE'].includes(String(status ?? '').toUpperCase())
  )),
  vehicleBillingService: {
    replaceMonthlyLedgerDrafts: jest.fn()
  }
}));

const EXPENSE_TYPES: VehicleExpenseType[] = ['FUEL', 'REPAIR', 'TOLL', 'FINE', 'OTHER'];

const buildExpense = (patch: Partial<VehicleExpenseRecord> = {}): VehicleExpenseRecord => ({
  id: 'expense-1',
  vehicleId: 'vehicle-1',
  vehiclePlate: '12가3456',
  date: '2026-07-10',
  type: 'FUEL',
  amount: 1000,
  payer: 'COMPANY',
  status: 'ACTIVE',
  ...patch
});

const buildBilling = (id: string, status: VehicleBillingStatus = 'DRAFT', amount = 1000): VehicleBillingDocument => ({
  id,
  yearMonth: '2026-07',
  vehicleId: 'vehicle-1',
  vehiclePlate: '12가3456',
  teamId: 'team-1',
  teamName: 'A팀',
  issuedToType: 'team',
  fixedCost: 0,
  variableCost: amount,
  totalAmount: amount,
  status,
  lineItems: [{ id: 'fuel', label: '주유비', amount, type: 'VARIABLE', category: 'FUEL' }]
});

type ReplaceDraftsInput = Parameters<VehicleMonthlyLedgerBillingDependencies['replaceDrafts']>[0];

const buildDependencies = (): jest.Mocked<VehicleMonthlyLedgerBillingDependencies> => ({
  replaceDrafts: jest.fn().mockImplementation(async ({ existingDocuments, desiredDocuments }: ReplaceDraftsInput) => {
    const desiredIds = new Set(desiredDocuments.map((document) => document.id));
    return {
      savedIds: desiredDocuments.map((document) => document.id),
      deletedDraftIds: existingDocuments
        .filter((document) => document.status === 'DRAFT' && !desiredIds.has(document.id))
        .map((document) => document.id)
    };
  })
});

describe('vehicleMonthlyLedgerBillingService', () => {
  it('keeps failed hidden rows in the next save scope', () => {
    const allRows = [
      { row: { id: 'visible-row' }, index: 0 },
      { row: { id: 'hidden-failed-row' }, index: 1 }
    ];

    expect(selectVehicleMonthlyLedgerRowsForSave({
      allRows,
      visibleRows: [allRows[0]],
      dirtyRowIds: [],
      retryRowIds: ['hidden-failed-row']
    })).toEqual([allRows[1]]);
  });

  it('reconciles all rows after refresh even when the previous failed row is outside the current filter', () => {
    const allRows = [
      { row: { id: 'visible-row' }, index: 0 },
      { row: { id: 'hidden-previously-failed-row' }, index: 1 }
    ];

    expect(selectVehicleMonthlyLedgerRowsForSave({
      allRows,
      visibleRows: [allRows[0]],
      dirtyRowIds: [],
      retryRowIds: []
    })).toEqual(allRows);
  });

  it('distinguishes row-scoped drafts from legacy unscoped vehicle drafts', () => {
    expect(hasVehicleMonthlyLedgerRowScope(buildBilling('billing__row_segment-a'))).toBe(true);
    expect(hasVehicleMonthlyLedgerRowScope({
      ...buildBilling('dated-billing'),
      lineItems: [{
        id: 'fuel', label: '주유비', amount: 1000, type: 'VARIABLE', category: 'FUEL',
        sourceStartDate: '2026-07-10', sourceEndDate: '2026-07-10'
      }]
    })).toBe(true);
    expect(hasVehicleMonthlyLedgerRowScope({
      ...buildBilling('legacy-unscoped-billing'),
      lineItems: [{ id: 'manual', label: '차량비', amount: 1000, type: 'VARIABLE', category: 'OTHER' }]
    })).toBe(false);
  });

  it('preserves source-less and mixed manual drafts even when they use a canonical id', () => {
    const manual = {
      ...buildBilling('vehicle-1_team-1_team_none_2026-07'),
      lineItems: [{ id: 'manual', label: '수기 차량비', amount: 1000, type: 'VARIABLE' as const, category: 'OTHER' as const }]
    };
    const sourceMarkedLegacy = {
      ...buildBilling('old-generated-id'),
      lineItems: [{
        id: 'fuel', label: '주유비', amount: 1000, type: 'VARIABLE' as const, category: 'FUEL' as const,
        sourceType: 'vehicle_ledger' as const
      }]
    };
    const mixedManual = {
      ...sourceMarkedLegacy,
      lineItems: [
        ...(sourceMarkedLegacy.lineItems ?? []),
        { id: 'manual', label: '수기 조정', amount: 500, type: 'VARIABLE' as const, category: 'OTHER' as const }
      ]
    };

    expect(isManagedVehicleMonthlyLedgerBillingDocument(manual)).toBe(false);
    expect(isManagedVehicleMonthlyLedgerBillingDocument(sourceMarkedLegacy)).toBe(true);
    expect(isManagedVehicleMonthlyLedgerBillingDocument(mixedManual)).toBe(false);

    expect(getBlockingUnmanagedVehicleBillingDocuments(
      [manual, mixedManual],
      [buildBilling('vehicle-1_team-1_team_none_2026-07__row_current')]
    )).toEqual([manual, mixedManual]);
    expect(getBlockingUnmanagedVehicleBillingDocuments(
      [manual],
      [buildBilling('vehicle-1_team-1_team_none_2026-07')]
    )).toEqual([manual]);
  });

  it('matches a legacy vehicle billing by normalized plate when its stored vehicle id changed', () => {
    expect(matchesVehicleMonthlyLedgerBillingIdentity(
      { vehicleId: 'legacy-vehicle-id', vehiclePlate: '12가 3456' },
      { id: 'current-vehicle-uuid', licensePlate: '12가3456' }
    )).toBe(true);
    expect(matchesVehicleMonthlyLedgerBillingIdentity(
      { vehicleId: 'another-id', vehiclePlate: '99나9999' },
      { id: 'current-vehicle-uuid', licensePlate: '12가3456' }
    )).toBe(false);
  });

  it('builds billing amounts only from stored expenses, ignoring unsaved screen amounts', () => {
    const screenRow = {
      vehicle: { id: 'vehicle-1' },
      segment: { startDate: '2026-07-01', endDate: '2026-07-31' },
      rentFee: 5000,
      leaseFee: 0,
      amounts: { FUEL: 999999, TOLL: 888888 },
      fineChargeTarget: 'BILLING_TARGET' as const,
      variableTotal: 1888887,
      total: 1893887,
      note: 'unsaved note'
    };

    const stored = buildVehicleLedgerBillingRowFromStoredExpenses(screenRow, [
      buildExpense({ id: 'fuel', amount: 1200 }),
      buildExpense({ id: 'toll', type: 'TOLL', amount: 300 }),
      buildExpense({ id: 'outside', date: '2026-08-01', amount: 7777 }),
      buildExpense({ id: 'other-vehicle', vehicleId: 'vehicle-2', amount: 8888 })
    ], EXPENSE_TYPES);

    expect(stored.amounts).toMatchObject({ FUEL: 1200, TOLL: 300, REPAIR: 0, FINE: 0, OTHER: 0 });
    expect(stored.variableTotal).toBe(1500);
    expect(stored.total).toBe(6500);
    expect(stored.note).toBe('');
  });

  it('upserts the same deterministic DRAFT id without accumulating documents', async () => {
    const dependencies = buildDependencies();
    const existing = buildBilling('vehicle-ledger-draft', 'DRAFT', 1000);
    const desired = buildBilling('vehicle-ledger-draft', 'CONFIRMED', 2000);

    const first = await upsertVehicleMonthlyLedgerDrafts({
      existingDocuments: [existing],
      desiredDocuments: [desired],
      dependencies
    });
    const second = await upsertVehicleMonthlyLedgerDrafts({
      existingDocuments: [{ ...desired, status: 'DRAFT' }],
      desiredDocuments: [desired],
      dependencies
    });

    expect(first.savedIds).toEqual(['vehicle-ledger-draft']);
    expect(second.savedIds).toEqual(first.savedIds);
    expect(dependencies.replaceDrafts).toHaveBeenCalledTimes(2);
    expect(dependencies.replaceDrafts).toHaveBeenNthCalledWith(1, expect.objectContaining({
      desiredDocuments: [expect.objectContaining({
        id: 'vehicle-ledger-draft',
        status: 'DRAFT',
        totalAmount: 2000,
        confirmedAt: undefined
      })]
    }));
  });

  it('removes only stale DRAFT documents after the replacement upsert succeeds', async () => {
    const dependencies = buildDependencies();
    const result = await upsertVehicleMonthlyLedgerDrafts({
      existingDocuments: [buildBilling('stale-draft'), buildBilling('current-draft')],
      desiredDocuments: [buildBilling('current-draft', 'DRAFT', 2000)],
      dependencies
    });

    expect(dependencies.replaceDrafts).toHaveBeenCalledWith(expect.objectContaining({
      existingDocuments: expect.arrayContaining([expect.objectContaining({ id: 'stale-draft' })]),
      desiredDocuments: [expect.objectContaining({ id: 'current-draft' })]
    }));
    expect(result.deletedDraftIds).toEqual(['stale-draft']);
  });

  it('replaces a legacy draft after a target change and stays duplicate-free on retry', async () => {
    const dependencies = buildDependencies();
    const legacyTarget = {
      ...buildBilling('vehicle-1_team-1_team_none_2026-07'),
      teamId: 'team-1',
      teamName: 'A팀',
      lineItems: [{
        id: 'legacy-fuel', label: '주유비', amount: 1000, type: 'VARIABLE' as const, category: 'FUEL' as const,
        sourceType: 'vehicle_ledger' as const
      }]
    };
    const newTarget = {
      ...buildBilling('vehicle-ledger-new-target', 'DRAFT', 2000),
      teamId: 'team-2',
      teamName: 'B팀'
    };

    const first = await upsertVehicleMonthlyLedgerDrafts({
      existingDocuments: [legacyTarget],
      desiredDocuments: [newTarget],
      dependencies
    });
    const retry = await upsertVehicleMonthlyLedgerDrafts({
      existingDocuments: [newTarget],
      desiredDocuments: [newTarget],
      dependencies
    });

    expect(first.savedIds).toEqual(['vehicle-ledger-new-target']);
    expect(first.deletedDraftIds).toEqual(['vehicle-1_team-1_team_none_2026-07']);
    expect(retry.savedIds).toEqual(['vehicle-ledger-new-target']);
    expect(retry.deletedDraftIds).toEqual([]);
    expect(dependencies.replaceDrafts).toHaveBeenCalledTimes(2);
  });

  it('keeps fixed/variable costs and driver fines in two deterministic drafts while removing the legacy combined draft', async () => {
    const dependencies = buildDependencies();
    const defaultTarget = buildBilling('row-default-target', 'DRAFT', 7000);
    const driverFine = {
      ...buildBilling('row-default-target__fine_driver', 'DRAFT', 3000),
      issuedToType: 'worker' as const,
      issuedToWorkerId: 'worker-1',
      issuedToWorkerName: '홍길동',
      lineItems: [{ id: 'fine', label: '과태료', amount: 3000, type: 'VARIABLE' as const, category: 'FINE' }]
    };

    const result = await upsertVehicleMonthlyLedgerDrafts({
      existingDocuments: [buildBilling('legacy-combined-draft', 'DRAFT', 10000)],
      desiredDocuments: [defaultTarget, driverFine],
      dependencies
    });

    expect(dependencies.replaceDrafts).toHaveBeenCalledTimes(1);
    expect(dependencies.replaceDrafts).toHaveBeenCalledWith(expect.objectContaining({
      desiredDocuments: [
        expect.objectContaining({ id: 'row-default-target', totalAmount: 7000, status: 'DRAFT' }),
        expect.objectContaining({
          id: 'row-default-target__fine_driver', totalAmount: 3000, status: 'DRAFT', issuedToType: 'worker'
        })
      ]
    }));
    expect(result.deletedDraftIds).toEqual(['legacy-combined-draft']);
  });

  it('removes the related DRAFT and writes nothing when the stored row total becomes zero', async () => {
    const dependencies = buildDependencies();
    const result = await upsertVehicleMonthlyLedgerDrafts({
      existingDocuments: [buildBilling('zeroed-row-draft')],
      desiredDocuments: [],
      dependencies
    });

    expect(result).toMatchObject({
      status: 'saved',
      savedIds: [],
      deletedDraftIds: ['zeroed-row-draft']
    });
    expect(dependencies.replaceDrafts).toHaveBeenCalledWith(expect.objectContaining({
      desiredDocuments: [],
      existingDocuments: [expect.objectContaining({ id: 'zeroed-row-draft' })]
    }));
  });

  it('does not remove a protected document when the stored row total becomes zero', async () => {
    const dependencies = buildDependencies();
    const result = await upsertVehicleMonthlyLedgerDrafts({
      existingDocuments: [buildBilling('confirmed-row', 'CONFIRMED')],
      desiredDocuments: [],
      dependencies
    });

    expect(result.status).toBe('skipped-posted');
    expect(dependencies.replaceDrafts).not.toHaveBeenCalled();
  });

  it('uses the canonical id returned by the persistence layer before deleting legacy drafts', async () => {
    const dependencies = buildDependencies();
    dependencies.replaceDrafts.mockResolvedValueOnce({
      savedIds: ['canonical-draft'],
      deletedDraftIds: ['legacy-draft']
    });

    const result = await upsertVehicleMonthlyLedgerDrafts({
      existingDocuments: [buildBilling('canonical-draft'), buildBilling('legacy-draft')],
      desiredDocuments: [buildBilling('legacy-input-id', 'DRAFT', 2000)],
      dependencies
    });

    expect(result.savedIds).toEqual(['canonical-draft']);
    expect(result.deletedDraftIds).toEqual(['legacy-draft']);
    expect(dependencies.replaceDrafts).toHaveBeenCalledTimes(1);
  });

  it('keeps the previous draft when the replacement upsert fails', async () => {
    const dependencies = buildDependencies();
    dependencies.replaceDrafts.mockRejectedValueOnce(new Error('atomic replace failed'));

    await expect(upsertVehicleMonthlyLedgerDrafts({
      existingDocuments: [buildBilling('stale-draft')],
      desiredDocuments: [buildBilling('replacement-draft', 'DRAFT', 2000)],
      dependencies
    })).rejects.toThrow('atomic replace failed');
    expect(dependencies.replaceDrafts).toHaveBeenCalledTimes(1);
  });

  it('leaves no split intermediate state when the atomic replacement fails and converges on retry', async () => {
    const firstAttempt = buildDependencies();
    firstAttempt.replaceDrafts.mockRejectedValueOnce(new Error('transaction commit failed'));
    const desiredDocuments = [
      buildBilling('row-default-target', 'DRAFT', 7000),
      buildBilling('row-default-target__fine_driver', 'DRAFT', 3000)
    ];

    await expect(upsertVehicleMonthlyLedgerDrafts({
      existingDocuments: [buildBilling('legacy-combined-draft', 'DRAFT', 10000)],
      desiredDocuments,
      dependencies: firstAttempt
    })).rejects.toThrow('transaction commit failed');
    expect(firstAttempt.replaceDrafts).toHaveBeenCalledTimes(1);
    expect(firstAttempt.replaceDrafts).toHaveBeenCalledWith(expect.objectContaining({
      existingDocuments: [expect.objectContaining({ id: 'legacy-combined-draft' })],
      desiredDocuments: [
        expect.objectContaining({ id: 'row-default-target' }),
        expect.objectContaining({ id: 'row-default-target__fine_driver' })
      ]
    }));

    const retry = buildDependencies();
    const result = await upsertVehicleMonthlyLedgerDrafts({
      // The failed transaction exposed no first split document; only the
      // original legacy DRAFT remains for the retry.
      existingDocuments: [buildBilling('legacy-combined-draft', 'DRAFT', 10000)],
      desiredDocuments,
      dependencies: retry
    });

    expect(result.savedIds).toEqual(['row-default-target', 'row-default-target__fine_driver']);
    expect(result.deletedDraftIds).toEqual(['legacy-combined-draft']);
  });

  it.each(['CONFIRMED', 'PAID', 'OVERDUE'] as VehicleBillingStatus[])(
    'protects and skips %s documents',
    async (status) => {
      const dependencies = buildDependencies();
      const result = await upsertVehicleMonthlyLedgerDrafts({
        existingDocuments: [buildBilling('posted-document', status)],
        desiredDocuments: [buildBilling('posted-document', 'DRAFT', 2000)],
        dependencies
      });

      expect(result).toMatchObject({
        status: 'skipped-posted',
        savedIds: [],
        deletedDraftIds: [],
        protectedIds: ['posted-document'],
        protectedStatuses: [status]
      });
      expect(dependencies.replaceDrafts).not.toHaveBeenCalled();
    }
  );

  it('requires unique deterministic document ids before writing', async () => {
    const dependencies = buildDependencies();
    await expect(upsertVehicleMonthlyLedgerDrafts({
      existingDocuments: [],
      desiredDocuments: [buildBilling('same-id'), buildBilling('same-id')],
      dependencies
    })).rejects.toThrow('vehicle-billing-deterministic-id-required');
    expect(dependencies.replaceDrafts).not.toHaveBeenCalled();
  });
});
