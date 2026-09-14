import { hasSupportWriteRecordFailure, subscribeSupportWriteRecordFailure } from '../utils/supportWriteErrorReporting';
import { recordSupportWriteOperationSafely } from './supportWriteOperationLogService';
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


// Stage 1: baseline tests and their original SDK-fake boundary above are unchanged.



describe('stage1 observation and preservation', () => {
  beforeEach(() => {
    // CRA resetMocks clears factory implementations before each test.
    mockedTimestamp.now.mockReset().mockReturnValue(mockTimestamp);
    mockedDoc.mockReset().mockImplementation((_db: unknown, collectionName: string, id: string) => ({ collectionName, id }));
    mockedSetDoc.mockReset().mockResolvedValue(undefined as any);
  });
  it('rearms the default timestamp, reference and write implementation', async () => {
    const log = await supportWriteOperationLogService.recordOperation({ domain: 'card', yearMonth: '2026-07', operationId: 'revision2-rearmed', status: 'success' });
    expect(mockedTimestamp.now).toHaveBeenCalledTimes(1);
    expect(mockedDoc).toHaveBeenCalledWith(expect.anything(), SUPPORT_WRITE_OPERATIONS_COLLECTION, log.id);
    expect(mockedSetDoc).toHaveBeenCalledTimes(1);
    expect(mockedSetDoc).toHaveBeenCalledWith({ collectionName: SUPPORT_WRITE_OPERATIONS_COLLECTION, id: log.id }, expect.objectContaining({ createdAtIso: '2026-07-04T00:00:00.000Z' }), { merge: true });
    expect(hasSupportWriteRecordFailure('revision2-rearmed')).toBe(false);
  });
  it('preserves the thrown error and observes failure without retrying', async () => {
    const error = new Error('record-unavailable');
    mockedSetDoc.mockReset();
    mockedSetDoc.mockRejectedValue(error);
    const unsubscribe = subscribeSupportWriteRecordFailure(() => { throw new Error('observer'); });
    try {
      await expect(supportWriteOperationLogService.recordOperation({ domain: 'card', yearMonth: '2026-07', operationId: 'stage1-reject', status: 'success' })).rejects.toBe(error);
      expect(hasSupportWriteRecordFailure('stage1-reject')).toBe(true);
      expect(mockedSetDoc).toHaveBeenCalledTimes(1);
    } finally { unsubscribe(); }
  });
  it('keeps the safe wrapper nonthrowing when console throws', async () => {
    mockedSetDoc.mockReset();
    mockedSetDoc.mockRejectedValue(new Error('private-error'));
    const output = jest.spyOn(console, 'error').mockImplementation(() => { throw new Error('console'); });
    try {
      await expect(recordSupportWriteOperationSafely({ domain: 'vehicle', yearMonth: '2026-07', operationId: 'stage1-safe', status: 'failed' })).resolves.toBeUndefined();
      expect(mockedSetDoc).toHaveBeenCalledTimes(1);
      expect(hasSupportWriteRecordFailure('stage1-safe')).toBe(true);
      expect(output).toHaveBeenCalledWith('[support-write-operation]', { domain: 'vehicle', errorCode: 'SUPPORT_WRITE_UNKNOWN' });
    } finally { output.mockRestore(); }
  });
  it('preserves stored actor, messages, metadata and IDs', () => {
    const metadata = { billingMutation: 'automatic-after-save', skippedBillingRows: [{ rowId: 'fixture' }] };
    const log = buildSupportWriteOperationLog({ domain: 'card', yearMonth: '2026-07', operationId: 'stage1-contract', status: 'success', actor: { uid: 'fixture', name: 'Fixture' }, userMessage: 'legacy', affectedDocumentIds: ['fixture/ref', 'fixture/ref'], metadata }, mockTimestamp as any);
    expect(log.actor.uid).toBe('fixture');
    expect(log.userMessage).toBe('legacy');
    expect(log.metadata).toBe(metadata);
    expect(log.affectedDocumentIds).toEqual(['fixture/ref']);
  });
});
