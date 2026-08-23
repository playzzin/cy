import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { supportCancellationLogService } from './supportCancellationLogService';

const mockTimestamp = {
  toDate: () => new Date('2026-08-19T03:00:00.000Z'),
};

jest.mock('../config/firebase', () => ({
  db: {},
  auth: {
    currentUser: {
      uid: 'manager-1',
      displayName: 'Manager',
      email: 'manager@example.com',
    },
  },
}));

jest.mock('firebase/firestore', () => ({
  Timestamp: class MockTimestamp {
    static now: jest.Mock = jest.fn(() => mockTimestamp);
  },
  collection: jest.fn((_db, name: string) => ({ name })),
  doc: jest.fn((_dbOrCollection, collectionName?: string, id?: string) => ({
    collectionName,
    id: id ?? 'random-id',
  })),
  getDocs: jest.fn(),
  limit: jest.fn(),
  onSnapshot: jest.fn(),
  orderBy: jest.fn(),
  query: jest.fn(),
  setDoc: jest.fn(),
}));

const mockedDoc = doc as unknown as jest.Mock;
const mockedSetDoc = setDoc as jest.MockedFunction<typeof setDoc>;
const mockedTimestamp = Timestamp as unknown as { now: jest.Mock };

describe('supportCancellationLogService deterministic lifecycle log', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedTimestamp.now.mockReturnValue(mockTimestamp);
    mockedDoc.mockImplementation((_dbOrCollection: unknown, collectionName?: string, id?: string) => ({
      collectionName,
      id: id ?? 'random-id',
    }));
    mockedSetDoc.mockResolvedValue(undefined as any);
  });

  it('upserts the same document for repeated operation ids', async () => {
    const input = {
      resourceType: 'card' as const,
      resourceId: 'card-3909',
      resourceLabel: '국민카드 3909',
      reason: 'OTHER' as const,
      reasonLabel: '카드 정지 해제',
      processedDate: '2026-08-19',
      statusBefore: 'SUSPENDED',
      statusAfter: 'AVAILABLE',
      note: '분실 카드 정지 해제',
    };

    await supportCancellationLogService.createLog(input, { operationId: 'card/restore/3909' });
    await supportCancellationLogService.createLog(input, { operationId: 'card/restore/3909' });

    expect(mockedDoc).toHaveBeenNthCalledWith(1, {}, 'support_cancellation_logs', 'card_restore_3909');
    expect(mockedDoc).toHaveBeenNthCalledWith(2, {}, 'support_cancellation_logs', 'card_restore_3909');
    expect(mockedSetDoc).toHaveBeenCalledTimes(2);
    expect(mockedSetDoc.mock.calls[0][0]).toEqual(mockedSetDoc.mock.calls[1][0]);
  });
});
