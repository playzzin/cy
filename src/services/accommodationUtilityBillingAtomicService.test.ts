import { deleteField, doc, runTransaction } from 'firebase/firestore';
import type {
  AccommodationBillingDocument,
  AccommodationBillingLineItem,
} from '../types/accommodationBilling';
import { accommodationUtilityBillingAtomicService } from './accommodationUtilityBillingAtomicService';

jest.mock('firebase/firestore', () => ({
  deleteField: jest.fn(() => ({ __deleteField: true })),
  doc: jest.fn((_db: unknown, collectionName: string, id: string) => ({
    id,
    path: `${collectionName}/${id}`,
  })),
  runTransaction: jest.fn(),
  serverTimestamp: jest.fn(() => '__server_timestamp__'),
}));

jest.mock('../config/firebase', () => ({ db: { name: 'test-db' } }));

type StoredData = Record<string, unknown>;
type FakeRef = { id: string; path: string };
type PendingWrite =
  | { kind: 'set'; ref: FakeRef; data: StoredData; merge: boolean }
  | { kind: 'delete'; ref: FakeRef };

const mockedRunTransaction = runTransaction as jest.MockedFunction<typeof runTransaction>;
const mockedDoc = doc as jest.MockedFunction<typeof doc>;
const mockedDeleteField = deleteField as jest.MockedFunction<typeof deleteField>;

const record = {
  recordId: 'utility-101',
  accommodationId: 'acc-101',
  accommodationName: '101호',
};

const line = (
  id: string,
  patch: Partial<AccommodationBillingLineItem> = {}
): AccommodationBillingLineItem => ({
  id,
  label: '101호 월세',
  amount: 100,
  targetField: 'accommodation',
  sourceType: 'utility_ledger',
  sourceAccommodationId: 'acc-101',
  sourceUtilityRecordId: 'utility-101',
  ...patch,
});

const billing = (
  id: string,
  teamId: string,
  lineItems: AccommodationBillingLineItem[],
  status: AccommodationBillingDocument['status'] = 'draft'
): AccommodationBillingDocument => ({
  id,
  yearMonth: '2026-08',
  teamId,
  teamName: teamId,
  issuedToType: 'team',
  issuedToWorkerId: '',
  issuedToWorkerName: teamId,
  status,
  memo: '',
  lineItems,
});

const documentPath = (id: string) => `accommodation_billing_documents/${id}`;
const linePath = (id: string) => `accommodation_billing_line_items/${id}`;
const settlementPath = (teamId: string) => `system_configs/team_settlement_2026-08__${teamId}`;

const storedDocument = (
  document: AccommodationBillingDocument
): StoredData => ({
  yearMonth: document.yearMonth,
  teamId: document.teamId,
  teamName: document.teamName,
  issuedToType: document.issuedToType,
  issuedToWorkerId: document.issuedToWorkerId,
  issuedToWorkerName: document.issuedToWorkerName,
  status: document.status,
  memo: document.memo,
  lineItemIds: (document.lineItems ?? []).map((item) => item.id),
});

const storedLine = (billingDocumentId: string, item: AccommodationBillingLineItem): StoredData => ({
  billingDocumentId,
  label: item.label,
  amount: item.amount,
  targetField: item.targetField,
  sourceType: item.sourceType,
  sourceAccommodationId: item.sourceAccommodationId,
  sourceUtilityRecordId: item.sourceUtilityRecordId,
  status: 'active',
  cancelledAt: null,
});

const installTransactionHarness = (
  initial: Record<string, StoredData>,
  options: { failOnWrite?: number } = {}
): Map<string, StoredData> => {
  const store = new Map<string, StoredData>(
    Object.entries(initial).map(([path, data]) => [path, { ...data }])
  );

  mockedRunTransaction.mockImplementation(async (_db, callback) => {
    const pending: PendingWrite[] = [];
    let writeCount = 0;
    const maybeFail = () => {
      writeCount += 1;
      if (options.failOnWrite === writeCount) throw new Error('simulated transaction write failure');
    };
    const transaction = {
      get: async (ref: FakeRef) => {
        const data = store.get(ref.path);
        return {
          id: ref.id,
          exists: () => Boolean(data),
          data: () => data ? { ...data } : undefined,
        };
      },
      set: (ref: FakeRef, data: StoredData, setOptions?: { merge?: boolean }) => {
        maybeFail();
        pending.push({ kind: 'set', ref, data: { ...data }, merge: Boolean(setOptions?.merge) });
        return transaction;
      },
      delete: (ref: FakeRef) => {
        maybeFail();
        pending.push({ kind: 'delete', ref });
        return transaction;
      },
    };

    const result = await callback(transaction as never);
    pending.forEach((write) => {
      if (write.kind === 'delete') {
        store.delete(write.ref.path);
        return;
      }
      const previous = store.get(write.ref.path) ?? {};
      const next = write.merge ? { ...previous, ...write.data } : { ...write.data };
      Object.entries(next).forEach(([key, value]) => {
        if (
          value
          && typeof value === 'object'
          && !Array.isArray(value)
          && (value as Record<string, unknown>).__deleteField === true
        ) {
          delete next[key];
        }
      });
      store.set(write.ref.path, next);
    });
    return result;
  });

  return store;
};

describe('accommodationUtilityBillingAtomicService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedDoc.mockImplementation(((_db: unknown, collectionName: string, id: string) => ({
      id,
      path: `${collectionName}/${id}`,
    })) as typeof doc);
    mockedDeleteField.mockImplementation(() => ({ __deleteField: true }) as never);
  });

  it('replaces only the record lines while preserving manual and other-accommodation lines', async () => {
    const own = line('own');
    const manual = line('f64f0db4-7992-4718-b493-31ad84f60b04', {
      label: '101호 월세 조정',
      amount: 30,
      sourceType: undefined,
      sourceAccommodationId: undefined,
      sourceUtilityRecordId: undefined,
    });
    const other = line('other', {
      label: '102호 월세',
      sourceAccommodationId: 'acc-102',
      sourceUtilityRecordId: 'utility-102',
    });
    const current = billing('team-a-doc', 'team-a', [own, manual, other]);
    const desired = billing('team-a-doc', 'team-a', [line('own', { amount: 250 })]);
    const store = installTransactionHarness({
      [documentPath(current.id)]: storedDocument(current),
      [linePath(own.id)]: storedLine(current.id, own),
      [linePath(manual.id)]: storedLine(current.id, manual),
      [linePath(other.id)]: storedLine(current.id, other),
    });

    await accommodationUtilityBillingAtomicService.reconcileRecord({
      yearMonth: '2026-08',
      record,
      desiredDocuments: [desired],
      relatedDocuments: [current],
      sourceDocumentsByDesiredId: [{
        desiredDocumentId: desired.id,
        sourceDocumentIds: [current.id],
      }],
    });

    expect(store.get(linePath('own'))).toEqual(expect.objectContaining({ amount: 250 }));
    expect(store.get(linePath(manual.id))).toEqual(expect.objectContaining({
      billingDocumentId: current.id,
      amount: 30,
    }));
    expect(store.get(linePath('other'))).toEqual(expect.objectContaining({
      billingDocumentId: current.id,
      sourceAccommodationId: 'acc-102',
    }));
  });

  it('atomically migrates a legacy source document without leaving old and new drafts', async () => {
    const own = line('own');
    const manual = line('14bb384d-d91f-45ee-85e3-e9db5aad2c23', {
      label: '101호 월세 조정',
      sourceType: undefined,
      sourceAccommodationId: undefined,
      sourceUtilityRecordId: undefined,
    });
    const legacy = billing('legacy-team-a', 'team-a', [own, manual]);
    const desired = billing('canonical-team-a', 'team-a', [line('own', { amount: 180 })]);
    const store = installTransactionHarness({
      [documentPath(legacy.id)]: storedDocument(legacy),
      [linePath(own.id)]: {
        ...storedLine(legacy.id, own),
        billingDocument: { id: legacy.id },
      },
      [linePath(manual.id)]: {
        ...storedLine(legacy.id, manual),
        billingDocument: { id: legacy.id },
      },
    });

    const result = await accommodationUtilityBillingAtomicService.reconcileRecord({
      yearMonth: '2026-08',
      record,
      desiredDocuments: [desired],
      relatedDocuments: [legacy],
      sourceDocumentsByDesiredId: [{
        desiredDocumentId: desired.id,
        sourceDocumentIds: [legacy.id],
      }],
    });

    expect(result.deletedDocumentIds).toEqual([legacy.id]);
    expect(store.has(documentPath(legacy.id))).toBe(false);
    expect(store.has(documentPath(desired.id))).toBe(true);
    expect(store.get(linePath('own'))).toEqual(expect.objectContaining({
      billingDocumentId: desired.id,
      amount: 180,
    }));
    expect(store.get(linePath('own'))).not.toHaveProperty('billingDocument');
    expect(store.get(linePath(manual.id))).toEqual(expect.objectContaining({
      billingDocumentId: desired.id,
    }));
    expect(store.get(linePath(manual.id))).not.toHaveProperty('billingDocument');
    expect(Array.from(store.keys()).some((path) => (
      path.startsWith('support_shared_data/accommodation_billing_sync_v1_')
    ))).toBe(true);
  });

  it('removes only the zeroed record lines and leaves another accommodation untouched', async () => {
    const own = line('own');
    const other = line('other', {
      label: '102호 월세',
      sourceAccommodationId: 'acc-102',
      sourceUtilityRecordId: 'utility-102',
    });
    const current = billing('team-a-doc', 'team-a', [own, other]);
    const unrelated = billing('team-b-doc', 'team-b', [line('team-b-own', {
      label: '201호 월세',
      sourceAccommodationId: 'acc-201',
      sourceUtilityRecordId: 'utility-201',
    })]);
    const store = installTransactionHarness({
      [documentPath(current.id)]: storedDocument(current),
      [documentPath(unrelated.id)]: storedDocument(unrelated),
      [linePath(own.id)]: storedLine(current.id, own),
      [linePath(other.id)]: storedLine(current.id, other),
      [linePath('team-b-own')]: storedLine(unrelated.id, unrelated.lineItems[0]),
    });

    await accommodationUtilityBillingAtomicService.reconcileRecord({
      yearMonth: '2026-08',
      record,
      desiredDocuments: [],
      relatedDocuments: [current],
      sourceDocumentsByDesiredId: [],
    });

    expect(store.has(linePath(own.id))).toBe(false);
    expect(store.get(linePath(other.id))).toEqual(expect.objectContaining({
      billingDocumentId: current.id,
    }));
    expect(store.get(documentPath(current.id))).toEqual(expect.objectContaining({
      lineItemIds: [other.id],
    }));
    expect(store.get(documentPath(unrelated.id))).toEqual(storedDocument(unrelated));
  });

  it('moves only the saved record when its billing target changes', async () => {
    const own = line('own');
    const other = line('other', {
      label: '102호 월세',
      sourceAccommodationId: 'acc-102',
      sourceUtilityRecordId: 'utility-102',
    });
    const oldTarget = billing('team-a-doc', 'team-a', [own, other]);
    const newTarget = billing('team-b-doc', 'team-b', [line('own', { amount: 275 })]);
    const store = installTransactionHarness({
      [documentPath(oldTarget.id)]: storedDocument(oldTarget),
      [linePath(own.id)]: storedLine(oldTarget.id, own),
      [linePath(other.id)]: storedLine(oldTarget.id, other),
    });

    await accommodationUtilityBillingAtomicService.reconcileRecord({
      yearMonth: '2026-08',
      record,
      desiredDocuments: [newTarget],
      relatedDocuments: [oldTarget],
      sourceDocumentsByDesiredId: [{
        desiredDocumentId: newTarget.id,
        sourceDocumentIds: [newTarget.id],
      }],
    });

    expect(store.get(linePath(own.id))).toEqual(expect.objectContaining({
      billingDocumentId: newTarget.id,
      amount: 275,
    }));
    expect(store.get(documentPath(newTarget.id))).toEqual(expect.objectContaining({
      lineItemIds: [own.id],
    }));
    expect(store.get(linePath(other.id))).toEqual(expect.objectContaining({
      billingDocumentId: oldTarget.id,
      sourceUtilityRecordId: 'utility-102',
    }));
    expect(store.get(documentPath(oldTarget.id))).toEqual(expect.objectContaining({
      lineItemIds: [other.id],
    }));
  });

  it('aborts the whole transaction when a related billing document is protected', async () => {
    const own = line('own');
    const protectedDocument = billing('team-a-doc', 'team-a', [own], 'confirmed');
    const desired = billing('team-a-doc', 'team-a', [line('own', { amount: 999 })]);
    const initial = {
      [documentPath(protectedDocument.id)]: storedDocument(protectedDocument),
      [linePath(own.id)]: storedLine(protectedDocument.id, own),
    };
    const store = installTransactionHarness(initial);

    await expect(accommodationUtilityBillingAtomicService.reconcileRecord({
      yearMonth: '2026-08',
      record,
      desiredDocuments: [desired],
      relatedDocuments: [protectedDocument],
      sourceDocumentsByDesiredId: [{
        desiredDocumentId: desired.id,
        sourceDocumentIds: [protectedDocument.id],
      }],
    })).rejects.toThrow('accommodation-billing-atomic-protected');

    expect(store.get(documentPath(protectedDocument.id))).toEqual(initial[documentPath(protectedDocument.id)]);
    expect(store.get(linePath(own.id))).toEqual(initial[linePath(own.id)]);
  });

  it('aborts before writes when the target team settlement is confirmed', async () => {
    const own = line('own');
    const current = billing('team-a-doc', 'team-a', [own]);
    const desired = billing('team-a-doc', 'team-a', [line('own', { amount: 999 })]);
    const initial = {
      [documentPath(current.id)]: storedDocument(current),
      [linePath(own.id)]: storedLine(current.id, own),
      [settlementPath('team-a')]: {
        data: JSON.stringify({
          yearMonth: '2026-08',
          teamId: 'team-a',
          teamName: 'team-a',
          confirmedAt: '2026-08-31T12:00:00.000Z',
        }),
      },
    };
    const store = installTransactionHarness(initial);

    await expect(accommodationUtilityBillingAtomicService.reconcileRecord({
      yearMonth: '2026-08',
      record,
      desiredDocuments: [desired],
      relatedDocuments: [current],
      sourceDocumentsByDesiredId: [{
        desiredDocumentId: desired.id,
        sourceDocumentIds: [current.id],
      }],
    })).rejects.toThrow('accommodation-billing-atomic-team-settlement-confirmed');

    expect(store.get(documentPath(current.id))).toEqual(initial[documentPath(current.id)]);
    expect(store.get(linePath(own.id))).toEqual(initial[linePath(own.id)]);
  });

  it('commits none of the desired/stale writes when a later transaction write fails', async () => {
    const own = line('own');
    const legacy = billing('legacy-team-a', 'team-a', [own]);
    const desired = billing('canonical-team-a', 'team-a', [line('own', { amount: 300 })]);
    const initial = {
      [documentPath(legacy.id)]: storedDocument(legacy),
      [linePath(own.id)]: {
        ...storedLine(legacy.id, own),
        billingDocument: { id: legacy.id },
      },
    };
    const store = installTransactionHarness(initial, { failOnWrite: 2 });

    await expect(accommodationUtilityBillingAtomicService.reconcileRecord({
      yearMonth: '2026-08',
      record,
      desiredDocuments: [desired],
      relatedDocuments: [legacy],
      sourceDocumentsByDesiredId: [{
        desiredDocumentId: desired.id,
        sourceDocumentIds: [legacy.id],
      }],
    })).rejects.toThrow('simulated transaction write failure');

    expect(store.has(documentPath(desired.id))).toBe(false);
    expect(store.get(documentPath(legacy.id))).toEqual(initial[documentPath(legacy.id)]);
    expect(store.get(linePath(own.id))).toEqual(initial[linePath(own.id)]);
  });
});
