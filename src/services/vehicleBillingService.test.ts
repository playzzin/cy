import { vehicleBillingService } from './vehicleBillingService';
import {
  createVehicleBillingDocument,
  deleteVehicleBillingDocument,
  listAllVehicleBillingDocuments,
  listAllVehicles,
  listTeams,
  listWorkers,
  updateVehicleBillingDocument
} from './firestoreCrudCompat';
import { vehicleBillingLogService } from './vehicleBillingLogService';
import { vehicleFirestoreService } from './vehicleFirestoreService';
import type { VehicleBillingDocument, VehicleBillingCostItem } from '../types/vehicleBilling';

jest.mock('./firestoreCrudCompat', () => ({
  createVehicleBillingDocument: jest.fn(),
  updateVehicleBillingDocument: jest.fn(),
  deleteVehicleBillingDocument: jest.fn(),
  listAllVehicleBillingDocuments: jest.fn(),
  listAllVehicles: jest.fn(),
  listTeams: jest.fn(),
  listWorkers: jest.fn()
}));

jest.mock('./vehicleFirestoreService', () => ({
  vehicleFirestoreService: {
    replaceVehicleBillingDrafts: jest.fn(),
    saveVehicleBillingDocumentProtected: jest.fn(),
    deleteVehicleBillingDocumentProtected: jest.fn()
  }
}));

jest.mock('./vehicleService', () => ({
  vehicleService: {
    getVehicles: jest.fn(),
    getExpensesByVehicle: jest.fn(),
    getBillingTargetHistory: jest.fn()
  }
}));

jest.mock('./vehicleBillingLogService', () => ({
  vehicleBillingLogService: {
    createLog: jest.fn()
  }
}));

const mockedCreateBilling = createVehicleBillingDocument as jest.MockedFunction<typeof createVehicleBillingDocument>;
const mockedDeleteBilling = deleteVehicleBillingDocument as jest.MockedFunction<typeof deleteVehicleBillingDocument>;
const mockedUpdateBilling = updateVehicleBillingDocument as jest.MockedFunction<typeof updateVehicleBillingDocument>;
const mockedListBillings = listAllVehicleBillingDocuments as jest.MockedFunction<typeof listAllVehicleBillingDocuments>;
const mockedListVehicles = listAllVehicles as jest.MockedFunction<typeof listAllVehicles>;
const mockedListTeams = listTeams as jest.MockedFunction<typeof listTeams>;
const mockedListWorkers = listWorkers as jest.MockedFunction<typeof listWorkers>;
const mockedCreateLog = vehicleBillingLogService.createLog as jest.MockedFunction<typeof vehicleBillingLogService.createLog>;
const mockedReplaceVehicleBillingDrafts = vehicleFirestoreService.replaceVehicleBillingDrafts as jest.MockedFunction<
  typeof vehicleFirestoreService.replaceVehicleBillingDrafts
>;
const mockedSaveVehicleBillingProtected = vehicleFirestoreService.saveVehicleBillingDocumentProtected as jest.MockedFunction<
  typeof vehicleFirestoreService.saveVehicleBillingDocumentProtected
>;
const mockedDeleteVehicleBillingProtected = vehicleFirestoreService.deleteVehicleBillingDocumentProtected as jest.MockedFunction<
  typeof vehicleFirestoreService.deleteVehicleBillingDocumentProtected
>;

const VEHICLE_UUID = '11111111-1111-4111-8111-111111111111';
const TEAM_UUID = '22222222-2222-4222-8222-222222222222';
const CANONICAL_ID = `${VEHICLE_UUID}_${TEAM_UUID}_team_none_2026-07`;

const lineItem = (amount: number): VehicleBillingCostItem => ({
  id: 'rent',
  label: 'rent',
  amount,
  type: 'FIXED',
  category: 'RENT',
  sourceType: 'vehicle_ledger'
});

const buildBilling = (patch: Partial<VehicleBillingDocument> = {}): VehicleBillingDocument => ({
  id: CANONICAL_ID,
  yearMonth: '2026-07',
  vehicleId: 'vehicle-legacy',
  vehiclePlate: '12가3456',
  teamId: 'team-legacy',
  teamName: 'A팀',
  issuedToType: 'team',
  fixedCost: 1000,
  variableCost: 0,
  totalAmount: 1000,
  status: 'DRAFT',
  lineItems: [lineItem(1000)],
  ...patch
});

const buildStoredBilling = (patch: Partial<VehicleBillingDocument> = {}) => {
  const billing = buildBilling({
    id: CANONICAL_ID,
    vehicleId: VEHICLE_UUID,
    teamId: TEAM_UUID,
    ...patch
  });
  return {
    ...billing,
    lineItems: JSON.stringify(billing.lineItems ?? [])
  };
};

describe('vehicleBillingService posted document protection', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockedListVehicles.mockResolvedValue({
      data: { vehicles: [{ id: VEHICLE_UUID, legacyId: 'vehicle-legacy' }] }
    } as any);
    mockedListTeams.mockResolvedValue({
      data: { teams: [{ id: TEAM_UUID, legacyId: 'team-legacy', name: 'A팀' }] }
    } as any);
    mockedListWorkers.mockResolvedValue({ data: { workers: [] } } as any);
    mockedCreateBilling.mockResolvedValue({ data: { vehicleBillingDocument_insert: { id: CANONICAL_ID } } } as any);
    mockedUpdateBilling.mockResolvedValue({ data: { vehicleBillingDocument_update: { id: CANONICAL_ID } } } as any);
    mockedCreateLog.mockResolvedValue({} as any);
    mockedSaveVehicleBillingProtected.mockResolvedValue(undefined);
    mockedDeleteVehicleBillingProtected.mockResolvedValue(undefined);
    mockedReplaceVehicleBillingDrafts.mockImplementation(async ({ desiredDocuments, existingDocumentIds }) => ({
      savedIds: desiredDocuments.map((document) => document.id),
      deletedDraftIds: existingDocumentIds.filter((id) => !desiredDocuments.some((document) => document.id === id))
    }));
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('blocks amount and line item changes on a CONFIRMED document', async () => {
    mockedListBillings.mockResolvedValue({
      data: { vehicleBillingDocuments: [buildStoredBilling({ status: 'CONFIRMED' })] }
    } as any);

    await expect(vehicleBillingService.saveBilling(buildBilling({
      fixedCost: 2000,
      totalAmount: 2000,
      lineItems: [lineItem(2000)]
    }))).rejects.toThrow('vehicle-billing-posted-modification-blocked');

    expect(mockedCreateBilling).not.toHaveBeenCalled();
    expect(mockedUpdateBilling).not.toHaveBeenCalled();
    expect(mockedSaveVehicleBillingProtected).not.toHaveBeenCalled();
  });

  it('allows the same amount and line item changes on a DRAFT document', async () => {
    mockedListBillings.mockResolvedValue({
      data: { vehicleBillingDocuments: [buildStoredBilling({ status: 'DRAFT' })] }
    } as any);

    await expect(vehicleBillingService.saveBilling(buildBilling({
      fixedCost: 2000,
      totalAmount: 2000,
      lineItems: [lineItem(2000)]
    }))).resolves.toBe(CANONICAL_ID);

    expect(mockedSaveVehicleBillingProtected).toHaveBeenCalledWith(expect.objectContaining({
      billing: expect.objectContaining({
        id: CANONICAL_ID,
        fixedCost: 2000,
        totalAmount: 2000,
        status: 'DRAFT',
        lineItems: [lineItem(2000)]
      })
    }));
  });

  it('cancels confirmation only through the explicit API and writes reason metadata', async () => {
    mockedListBillings.mockResolvedValue({
      data: { vehicleBillingDocuments: [buildStoredBilling({ status: 'CONFIRMED' })] }
    } as any);

    await vehicleBillingService.cancelConfirmation(CANONICAL_ID, {
      reason: 'amount entered twice',
      actorId: 'user-1',
      actorName: 'Manager'
    });

    expect(mockedUpdateBilling).toHaveBeenCalledWith(expect.objectContaining({
      id: CANONICAL_ID,
      status: 'DRAFT',
      confirmedAt: null,
      confirmationCancelReason: 'amount entered twice',
      confirmationCancelledById: 'user-1',
      confirmationCancelledByName: 'Manager',
      confirmationCancelledAt: expect.any(String)
    }));
    expect(mockedCreateLog).toHaveBeenCalledWith(expect.objectContaining({
      action: 'updated',
      source: 'vehicleBillingService.cancelConfirmation',
      before: expect.objectContaining({ status: 'CONFIRMED' }),
      after: expect.objectContaining({
        status: 'DRAFT',
        confirmationCancelReason: 'amount entered twice',
        confirmationCancelledById: 'user-1',
        confirmationCancelledByName: 'Manager'
      })
    }));
  });

  it('surfaces billing read failures when settlement protection requires a strict read', async () => {
    mockedListBillings.mockRejectedValueOnce(new Error('billing list unavailable'));

    await expect(vehicleBillingService.getBillingsByMonth('2026-07', { throwOnError: true }))
      .rejects.toThrow('billing list unavailable');
  });

  it('fails closed instead of overwriting a possibly posted document when the upsert protection read fails', async () => {
    mockedListBillings.mockRejectedValueOnce(new Error('billing protection read failed'));

    await expect(vehicleBillingService.saveBilling(buildBilling()))
      .rejects.toThrow('billing protection read failed');

    expect(mockedCreateBilling).not.toHaveBeenCalled();
    expect(mockedUpdateBilling).not.toHaveBeenCalled();
    expect(mockedSaveVehicleBillingProtected).not.toHaveBeenCalled();
  });

  it('fails closed instead of deleting when the delete protection read fails', async () => {
    mockedListBillings.mockRejectedValueOnce(new Error('billing protection read failed'));

    await expect(vehicleBillingService.deleteBilling(CANONICAL_ID))
      .rejects.toThrow('billing protection read failed');

    expect(mockedDeleteBilling).not.toHaveBeenCalled();
    expect(mockedDeleteVehicleBillingProtected).not.toHaveBeenCalled();
  });

  it('delegates a DRAFT delete to the transaction-protected persistence path', async () => {
    mockedListBillings.mockResolvedValue({
      data: { vehicleBillingDocuments: [buildStoredBilling({ status: 'DRAFT' })] }
    } as any);

    await vehicleBillingService.deleteBilling(CANONICAL_ID);

    expect(mockedDeleteVehicleBillingProtected).toHaveBeenCalledWith(CANONICAL_ID, [{
      yearMonth: '2026-07',
      teamId: TEAM_UUID
    }]);
    expect(mockedDeleteBilling).not.toHaveBeenCalled();
  });

  it('delegates all split drafts and stale ids to one atomic monthly-ledger replacement', async () => {
    const legacy = buildBilling({ id: 'legacy-old-target' });
    const desired = [
      buildBilling({ id: `${CANONICAL_ID}__row_segment-a`, totalAmount: 7000 }),
      buildBilling({
        id: `${CANONICAL_ID}__row_segment-a__fine_driver`,
        issuedToType: 'worker',
        issuedToWorkerId: 'worker-legacy',
        issuedToWorkerName: '홍길동',
        totalAmount: 3000
      })
    ];
    mockedListWorkers.mockResolvedValue({
      data: { workers: [{ id: '33333333-3333-4333-8333-333333333333', legacyId: 'worker-legacy' }] }
    } as any);

    const result = await vehicleBillingService.replaceMonthlyLedgerDrafts({
      existingDocuments: [legacy],
      desiredDocuments: desired
    });

    expect(mockedReplaceVehicleBillingDrafts).toHaveBeenCalledTimes(1);
    expect(mockedReplaceVehicleBillingDrafts).toHaveBeenCalledWith(expect.objectContaining({
      existingDocumentIds: ['legacy-old-target'],
      desiredDocuments: [
        expect.objectContaining({
          id: `${CANONICAL_ID}__row_segment-a`, status: 'DRAFT', totalAmount: 7000
        }),
        expect.objectContaining({
          id: `${VEHICLE_UUID}_${TEAM_UUID}_worker_33333333-3333-4333-8333-333333333333_2026-07__row_segment-a__fine_driver`,
          status: 'DRAFT', totalAmount: 3000
        })
      ],
      settlementTargets: expect.arrayContaining([
        { yearMonth: '2026-07', teamId: 'team-legacy' },
        { yearMonth: '2026-07', teamId: TEAM_UUID }
      ])
    }));
    expect(result.savedIds).toHaveLength(2);
    expect(result.deletedDraftIds).toEqual(['legacy-old-target']);
  });
});
