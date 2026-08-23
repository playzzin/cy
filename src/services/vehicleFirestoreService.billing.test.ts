import { doc, runTransaction } from 'firebase/firestore';
import { vehicleFirestoreService } from './vehicleFirestoreService';
import type { VehicleBillingDocument } from '../types/vehicleBilling';

jest.mock('../config/firebase', () => ({ db: { name: 'test-db' } }));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn((_db: unknown, name: string) => ({ name, withConverter: jest.fn().mockReturnThis() })),
  doc: jest.fn((_db: unknown, collectionName: string, id: string) => ({
    id,
    path: `${collectionName}/${id}`,
    collectionName,
    withConverter: jest.fn().mockReturnThis()
  })),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  setDoc: jest.fn(),
  deleteDoc: jest.fn(),
  deleteField: jest.fn(() => ({ type: 'delete-field' })),
  query: jest.fn((value: unknown) => value),
  where: jest.fn(),
  orderBy: jest.fn(),
  serverTimestamp: jest.fn(() => ({ type: 'server-timestamp' })),
  writeBatch: jest.fn(),
  runTransaction: jest.fn(),
  limit: jest.fn()
}));

type FakeRef = {
  id: string;
  path: string;
  collectionName: string;
};

type FakeSnapshot = {
  id: string;
  ref: FakeRef;
  exists: () => boolean;
  data: () => Record<string, unknown> | undefined;
};

const mockedDoc = doc as jest.MockedFunction<typeof doc>;
const mockedRunTransaction = runTransaction as jest.MockedFunction<typeof runTransaction>;

const buildBilling = (id: string, patch: Partial<VehicleBillingDocument> = {}): VehicleBillingDocument => ({
  id,
  yearMonth: '2026-07',
  vehicleId: 'vehicle-1',
  vehiclePlate: '12가3456',
  teamId: 'team-1',
  teamName: 'A팀',
  issuedToType: 'team',
  fixedCost: 0,
  variableCost: 1000,
  totalAmount: 1000,
  status: 'DRAFT',
  lineItems: [{
    id: 'fuel',
    label: '주유비',
    amount: 1000,
    type: 'VARIABLE',
    category: 'FUEL',
    sourceType: 'vehicle_ledger',
    sourceLedgerRowId: 'row-1'
  }],
  ...patch
});

const installTransactionStore = (initialDocuments: Record<string, Record<string, unknown>>) => {
  const store = new Map(Object.entries(initialDocuments));
  const setCalls: Array<{ ref: FakeRef; data: Record<string, unknown> }> = [];
  const deleteCalls: FakeRef[] = [];

  mockedRunTransaction.mockImplementation(async (_db, callback) => {
    const transaction = {
      get: jest.fn(async (ref: FakeRef): Promise<FakeSnapshot> => {
        const value = store.get(ref.path);
        return {
          id: ref.id,
          ref,
          exists: () => value !== undefined,
          data: () => value
        };
      }),
      set: jest.fn((ref: FakeRef, data: Record<string, unknown>) => {
        setCalls.push({ ref, data });
      }),
      delete: jest.fn((ref: FakeRef) => {
        deleteCalls.push(ref);
      })
    };
    const result = await callback(transaction as never);
    // Mimic Firestore atomic visibility: queued writes become visible only when
    // the whole callback succeeds.
    setCalls.forEach(({ ref, data }) => store.set(ref.path, data));
    deleteCalls.forEach((ref) => store.delete(ref.path));
    return result;
  });

  return { store, setCalls, deleteCalls };
};

describe('vehicleFirestoreService.replaceVehicleBillingDrafts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedDoc.mockImplementation(((_db: unknown, collectionName: string, id: string) => ({
      id,
      path: `${collectionName}/${id}`,
      collectionName,
      withConverter: jest.fn().mockReturnThis()
    })) as never);
  });

  it('commits both split DRAFTs and the stale deletion in one transaction', async () => {
    const state = installTransactionStore({
      'vehicle_billing_documents/legacy-draft': {
        status: 'DRAFT', yearMonth: '2026-07', teamId: 'team-1'
      }
    });

    const result = await vehicleFirestoreService.replaceVehicleBillingDrafts({
      desiredDocuments: [
        buildBilling('row-default'),
        buildBilling('row-default__fine_driver', {
          issuedToType: 'worker', issuedToWorkerId: 'worker-1', totalAmount: 3000
        })
      ],
      existingDocumentIds: ['legacy-draft']
    });

    expect(mockedRunTransaction).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      savedIds: ['row-default', 'row-default__fine_driver'],
      deletedDraftIds: ['legacy-draft']
    });
    expect(state.setCalls.map(({ ref }) => ref.id)).toEqual(['row-default', 'row-default__fine_driver']);
    expect(state.deleteCalls.map((ref) => ref.id)).toEqual(['legacy-draft']);
    expect(state.store.has('vehicle_billing_documents/legacy-draft')).toBe(false);
    expect(state.store.has('vehicle_billing_documents/row-default')).toBe(true);
    expect(state.store.has('vehicle_billing_documents/row-default__fine_driver')).toBe(true);
  });

  it.each(['CONFIRMED', 'PAID', 'OVERDUE'])(
    'fails closed without writes when an owned document becomes %s',
    async (status) => {
      const state = installTransactionStore({
        'vehicle_billing_documents/legacy-draft': {
          status, yearMonth: '2026-07', teamId: 'team-1'
        }
      });

      await expect(vehicleFirestoreService.replaceVehicleBillingDrafts({
        desiredDocuments: [buildBilling('row-default')],
        existingDocumentIds: ['legacy-draft']
      })).rejects.toThrow('vehicle-billing-posted-replace-blocked');

      expect(state.setCalls).toEqual([]);
      expect(state.deleteCalls).toEqual([]);
      expect(state.store.has('vehicle_billing_documents/legacy-draft')).toBe(true);
    }
  );

  it('fails closed without writes when the target team settlement is confirmed', async () => {
    const state = installTransactionStore({
      'vehicle_billing_documents/legacy-draft': {
        status: 'DRAFT', yearMonth: '2026-07', teamId: 'team-old'
      },
      'system_configs/team_settlement_2026-07__team-1': {
        data: JSON.stringify({ yearMonth: '2026-07', teamId: 'team-1', confirmedAt: '2026-08-01T00:00:00.000Z' })
      }
    });

    await expect(vehicleFirestoreService.replaceVehicleBillingDrafts({
      desiredDocuments: [buildBilling('row-default')],
      existingDocumentIds: ['legacy-draft']
    })).rejects.toThrow('team-settlement-confirmed-vehicle-billing-blocked');

    expect(state.setCalls).toEqual([]);
    expect(state.deleteCalls).toEqual([]);
    expect(state.store.has('vehicle_billing_documents/legacy-draft')).toBe(true);
  });

  it('also guards the stale document old target during an atomic target change', async () => {
    const state = installTransactionStore({
      'vehicle_billing_documents/legacy-draft': {
        status: 'DRAFT', yearMonth: '2026-07', teamId: 'team-old'
      },
      'system_configs/team_settlement_2026-07__team-old': {
        data: JSON.stringify({ yearMonth: '2026-07', teamId: 'team-old', confirmedAt: '2026-08-01T00:00:00.000Z' })
      }
    });

    await expect(vehicleFirestoreService.replaceVehicleBillingDrafts({
      desiredDocuments: [buildBilling('row-default', { teamId: 'team-new' })],
      existingDocumentIds: ['legacy-draft']
    })).rejects.toThrow('team-settlement-confirmed-vehicle-billing-blocked');

    expect(state.setCalls).toEqual([]);
    expect(state.deleteCalls).toEqual([]);
    expect(state.store.has('vehicle_billing_documents/legacy-draft')).toBe(true);
  });

  it('preserves a manual canonical DRAFT collision instead of overwriting its lines', async () => {
    const manualData = {
      status: 'DRAFT',
      yearMonth: '2026-07',
      teamId: 'team-1',
      totalAmount: 500,
      lineItems: JSON.stringify([{ id: 'manual', label: '수기 조정', amount: 500, type: 'VARIABLE' }])
    };
    const state = installTransactionStore({
      'vehicle_billing_documents/row-default': manualData
    });

    await expect(vehicleFirestoreService.replaceVehicleBillingDrafts({
      desiredDocuments: [buildBilling('row-default')],
      // The caller excluded this unowned manual document from its managed scope.
      existingDocumentIds: []
    })).rejects.toThrow('vehicle-billing-unmanaged-collision-blocked');

    expect(state.setCalls).toEqual([]);
    expect(state.deleteCalls).toEqual([]);
    expect(state.store.get('vehicle_billing_documents/row-default')).toEqual(manualData);
  });

  it('atomically removes an owned zero-amount DRAFT without creating a replacement', async () => {
    const state = installTransactionStore({
      'vehicle_billing_documents/zero-row': {
        status: 'DRAFT', yearMonth: '2026-07', teamId: 'team-1'
      }
    });

    const result = await vehicleFirestoreService.replaceVehicleBillingDrafts({
      desiredDocuments: [],
      existingDocumentIds: ['zero-row']
    });

    expect(result).toEqual({ savedIds: [], deletedDraftIds: ['zero-row'] });
    expect(state.setCalls).toEqual([]);
    expect(state.deleteCalls.map((ref) => ref.id)).toEqual(['zero-row']);
    expect(state.store.has('vehicle_billing_documents/zero-row')).toBe(false);
  });

  it('does not let the generic save overwrite a document observed as posted in the transaction', async () => {
    const state = installTransactionStore({
      'vehicle_billing_documents/manual-doc': {
        status: 'CONFIRMED', yearMonth: '2026-07', teamId: 'team-1', totalAmount: 1000
      }
    });

    await expect(vehicleFirestoreService.saveVehicleBillingDocumentProtected({
      billing: buildBilling('manual-doc', { totalAmount: 2000 })
    })).rejects.toThrow('vehicle-billing-posted-modification-blocked');

    expect(state.setCalls).toEqual([]);
    expect(state.deleteCalls).toEqual([]);
    expect(state.store.get('vehicle_billing_documents/manual-doc')).toEqual(expect.objectContaining({
      status: 'CONFIRMED', totalAmount: 1000
    }));
  });

  it('does not let the generic delete pass a team-settlement confirmation race', async () => {
    const state = installTransactionStore({
      'vehicle_billing_documents/manual-doc': {
        status: 'DRAFT', yearMonth: '2026-07', teamId: 'team-1', totalAmount: 1000
      },
      'system_configs/team_settlement_2026-07__team-1': {
        data: { yearMonth: '2026-07', teamId: 'team-1', confirmedAt: '2026-08-01T00:00:00.000Z' }
      }
    });

    await expect(vehicleFirestoreService.deleteVehicleBillingDocumentProtected('manual-doc'))
      .rejects.toThrow('team-settlement-confirmed-vehicle-billing-blocked');

    expect(state.setCalls).toEqual([]);
    expect(state.deleteCalls).toEqual([]);
    expect(state.store.has('vehicle_billing_documents/manual-doc')).toBe(true);
  });
});
