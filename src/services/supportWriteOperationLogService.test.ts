import { doc, setDoc, Timestamp } from 'firebase/firestore';
import {
  SUPPORT_WRITE_OPERATIONS_COLLECTION,
  buildSupportWriteOperationLog,
  supportWriteOperationLogService
} from './supportWriteOperationLogService';

const mockTimestamp = {
  toDate: () => new Date('2026-07-04T00:00:00.000Z')
};

jest.mock('../config/firebase', () => ({
  db: {},
  auth: {
    currentUser: {
      uid: 'user-1',
      displayName: 'Manager',
      email: 'manager@example.com'
    }
  }
}));

jest.mock('firebase/firestore', () => ({
  Timestamp: {
    now: jest.fn(() => mockTimestamp)
  },
  doc: jest.fn((_db, collectionName: string, id: string) => ({ collectionName, id })),
  setDoc: jest.fn()
}));

const mockedSetDoc = setDoc as jest.MockedFunction<typeof setDoc>;
const mockedDoc = doc as unknown as jest.Mock;
const mockedTimestamp = Timestamp as unknown as { now: jest.Mock };

describe('supportWriteOperationLogService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedTimestamp.now.mockReturnValue(mockTimestamp);
    mockedDoc.mockImplementation((_db: unknown, collectionName: string, id: string) => ({ collectionName, id }));
    mockedSetDoc.mockResolvedValue(undefined as any);
  });

  it('builds a deterministic operation log document for an operationId', () => {
    const log = buildSupportWriteOperationLog({
      domain: 'vehicle',
      yearMonth: '2026-07',
      operationId: 'vehicle-monthly-ledger:2026-07',
      status: 'failed',
      affectedDocumentIds: ['doc-1', 'doc-1', 'doc-2'],
      errorMessage: 'billing save failed'
    }, mockTimestamp as any);

    expect(log).toMatchObject({
      id: 'vehicle__vehicle-monthly-ledger_2026-07',
      domain: 'vehicle',
      yearMonth: '2026-07',
      operationId: 'vehicle-monthly-ledger:2026-07',
      status: 'failed',
      affectedDocumentIds: ['doc-1', 'doc-2'],
      errorMessage: 'billing save failed',
      actor: {
        uid: 'user-1',
        name: 'Manager',
        email: 'manager@example.com'
      },
      createdAtIso: '2026-07-04T00:00:00.000Z'
    });
  });

  it('upserts the support_write_operations document', async () => {
    await supportWriteOperationLogService.recordOperation({
      domain: 'card',
      yearMonth: '2026-07',
      operationId: 'card-monthly-ledger:2026-07',
      status: 'success',
      affectedDocumentIds: ['tx-1']
    });

    expect(mockedSetDoc).toHaveBeenCalledWith(
      expect.objectContaining({
        collectionName: SUPPORT_WRITE_OPERATIONS_COLLECTION,
        id: 'card__card-monthly-ledger_2026-07'
      }),
      expect.objectContaining({
        domain: 'card',
        yearMonth: '2026-07',
        operationId: 'card-monthly-ledger:2026-07',
        status: 'success',
        affectedDocumentIds: ['tx-1']
      }),
      { merge: true }
    );
  });
});
