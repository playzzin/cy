import { vehicleBillingService } from './vehicleBillingService';
import {
  createVehicleBillingDocument,
  listAllVehicleBillingDocuments,
  listAllVehicles,
  listTeams,
  listWorkers,
  updateVehicleBillingDocument
} from './firestoreCrudCompat';
import { vehicleBillingLogService } from './vehicleBillingLogService';
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
const mockedUpdateBilling = updateVehicleBillingDocument as jest.MockedFunction<typeof updateVehicleBillingDocument>;
const mockedListBillings = listAllVehicleBillingDocuments as jest.MockedFunction<typeof listAllVehicleBillingDocuments>;
const mockedListVehicles = listAllVehicles as jest.MockedFunction<typeof listAllVehicles>;
const mockedListTeams = listTeams as jest.MockedFunction<typeof listTeams>;
const mockedListWorkers = listWorkers as jest.MockedFunction<typeof listWorkers>;
const mockedCreateLog = vehicleBillingLogService.createLog as jest.MockedFunction<typeof vehicleBillingLogService.createLog>;

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
  });

  it('allows the same amount and line item changes on a DRAFT document', async () => {
    mockedListBillings.mockResolvedValue({
      data: { vehicleBillingDocuments: [buildStoredBilling({ status: 'DRAFT' })] }
    } as any);

    await vehicleBillingService.saveBilling(buildBilling({
      fixedCost: 2000,
      totalAmount: 2000,
      lineItems: [lineItem(2000)]
    }));

    expect(mockedCreateBilling).toHaveBeenCalledWith(expect.objectContaining({
      id: CANONICAL_ID,
      fixedCost: 2000,
      totalAmount: 2000,
      status: 'DRAFT',
      lineItems: JSON.stringify([lineItem(2000)])
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
});
