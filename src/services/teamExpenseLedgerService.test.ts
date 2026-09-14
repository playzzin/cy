import {
  Timestamp,
  deleteDoc,
  doc,
  getDoc,
  setDoc
} from 'firebase/firestore';
import type { TeamExpenseClaimInput } from '../types/teamExpenseLedger';
import {
  TEAM_EXPENSE_CLAIMS_COLLECTION,
  isLockedTeamExpenseClaimStatus,
  isPostedTeamExpenseClaimStatus,
  teamExpenseLedgerService
} from './teamExpenseLedgerService';
import { reportSupportWriteError } from '../utils/supportWriteErrorReporting';
import { recordSupportWriteOperationSafely } from './supportWriteOperationLogService';

const mockNowTimestamp = {
  toMillis: () => 1000,
  toDate: () => new Date(1000)
};

jest.mock('../config/firebase', () => ({
  db: {}
}));

jest.mock('./supportWriteOperationLogService', () => ({
  recordSupportWriteOperationSafely: jest.fn()
}));

jest.mock('firebase/firestore', () => ({
  Timestamp: {
    now: jest.fn(() => mockNowTimestamp),
    fromDate: jest.fn((date: Parameters<typeof Timestamp.fromDate>[0]) => ({
      toMillis: () => date.getTime(),
      toDate: () => date
    }))
  },
  collection: jest.fn((_db, collectionName: string) => ({ collectionName })),
  doc: jest.fn((...args: Parameters<typeof doc>) => ({ collectionName: args[1], id: args[2] })),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  query: jest.fn((...args: unknown[]) => ({ args })),
  setDoc: jest.fn(),
  deleteDoc: jest.fn(),
  where: jest.fn((field: string, op: string, value: unknown) => ({ field, op, value }))
}));

const mockedGetDoc = getDoc as jest.MockedFunction<typeof getDoc>;
const mockedSetDoc = setDoc as jest.MockedFunction<typeof setDoc>;
const mockedDeleteDoc = deleteDoc as jest.MockedFunction<typeof deleteDoc>;
const mockedDoc = doc as unknown as jest.Mock;
const mockedTimestamp = Timestamp as unknown as {
  now: jest.Mock;
  fromDate: jest.Mock;
};
const mockedRecordOperation = recordSupportWriteOperationSafely as jest.MockedFunction<typeof recordSupportWriteOperationSafely>;

const missingDoc = () => ({
  exists: () => false,
  data: () => ({})
});

const existingDoc = (data: unknown) => ({
  exists: () => true,
  data: () => data
});

const buildInput = (patch: Partial<TeamExpenseClaimInput> = {}): TeamExpenseClaimInput => ({
  yearMonth: '2026-07',
  date: '2026-07-10',
  claimType: 'otherExpense',
  payerTeamId: 'payer-team',
  payerTeamName: 'Payer Team',
  chargeToTeamId: '',
  chargeToTeamName: '',
  siteId: '',
  siteName: '',
  cardLabel: '',
  category: 'meal',
  description: 'Team meal',
  amount: 1000,
  status: 'draft',
  memo: 'memo',
  attachments: [],
  ...patch
});

describe('teamExpenseLedgerService save consistency', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockedTimestamp.now.mockReturnValue(mockNowTimestamp);
    mockedTimestamp.fromDate.mockImplementation((date: Parameters<typeof Timestamp.fromDate>[0]) => ({
      toMillis: () => date.getTime(),
      toDate: () => date
    }));
    mockedDoc.mockImplementation((...args: Parameters<typeof doc>) => ({
      collectionName: args[1],
      id: args[2]
    }));
    mockedGetDoc.mockResolvedValue(missingDoc() as any);
    mockedSetDoc.mockResolvedValue(undefined as any);
    mockedDeleteDoc.mockResolvedValue(undefined as any);
    mockedRecordOperation.mockResolvedValue(undefined);
  });

  afterEach(() => { jest.restoreAllMocks(); });

  it('uses an operationId-backed deterministic id for retried saves', async () => {
    const input = buildInput({ operationId: 'expense-op-1' });

    const firstId = await teamExpenseLedgerService.saveClaim(input);
    const secondId = await teamExpenseLedgerService.saveClaim(input);

    expect(firstId).toBe('team-expense-claim__op__expense-op-1');
    expect(secondId).toBe(firstId);
    expect(mockedSetDoc).toHaveBeenCalledWith(
      expect.objectContaining({
        collectionName: TEAM_EXPENSE_CLAIMS_COLLECTION,
        id: firstId
      }),
      expect.objectContaining({
        id: firstId,
        operationId: 'expense-op-1',
        lastOperationId: 'expense-op-1'
      }),
      { merge: true }
    );
    expect(mockedRecordOperation).toHaveBeenCalledWith(expect.objectContaining({
      domain: 'teamExpense',
      yearMonth: '2026-07',
      operationId: 'expense-op-1',
      status: 'success',
      affectedDocumentIds: [firstId]
    }));
  });

  it('uses a stable content fingerprint when callers do not pass an id or operationId', async () => {
    const input = buildInput();

    const firstId = await teamExpenseLedgerService.saveClaim(input);
    const secondId = await teamExpenseLedgerService.saveClaim(input);

    expect(firstId).toMatch(/^team-expense-claim__auto__/);
    expect(secondId).toBe(firstId);
  });

  it('allows general save changes to charged claims', async () => {
    mockedGetDoc.mockResolvedValue(existingDoc(buildInput({ status: 'charged' })) as any);

    await expect(teamExpenseLedgerService.saveClaim({
      ...buildInput({ status: 'charged' }),
      id: 'claim-1',
      amount: 2000
    })).resolves.toBe('claim-1');

    expect(mockedSetDoc).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'claim-1' }),
      expect.objectContaining({ status: 'charged', amount: 2000 }),
      { merge: true }
    );
    expect(mockedRecordOperation).toHaveBeenCalledWith(expect.objectContaining({
      domain: 'teamExpense',
      operationId: 'team-expense-claim:claim-1',
      status: 'success',
      affectedDocumentIds: ['claim-1']
    }));
  });

  it('blocks general save changes to settled claims before writing', async () => {
    mockedGetDoc.mockResolvedValue(existingDoc(buildInput({ status: 'settled' })) as any);

    await expect(teamExpenseLedgerService.saveClaim({
      ...buildInput({ status: 'settled' }),
      id: 'claim-1',
      amount: 2000
    })).rejects.toThrow('team-expense-claim-posted-modification-blocked');

    expect(mockedSetDoc).not.toHaveBeenCalled();
    expect(mockedRecordOperation).toHaveBeenCalledWith(expect.objectContaining({
      domain: 'teamExpense',
      yearMonth: '2026-07',
      operationId: 'team-expense-claim:claim-1',
      status: 'failed',
      affectedDocumentIds: ['claim-1'],
      // Diagnostic text is deliberately fixed; the business rejection above stays exact.
      errorMessage: 'SUPPORT_WRITE_UNKNOWN'
    }));
  });

  it('allows idempotent saves for charged claims without changing business fields', async () => {
    mockedGetDoc.mockResolvedValue(existingDoc(buildInput({ status: 'charged' })) as any);

    await expect(teamExpenseLedgerService.saveClaim({
      ...buildInput({ status: 'charged' }),
      id: 'claim-1'
    })).resolves.toBe('claim-1');

    expect(mockedSetDoc).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'claim-1' }),
      expect.objectContaining({ status: 'charged', amount: 1000 }),
      { merge: true }
    );
  });

  it('blocks physical deletes for settled claims', async () => {
    mockedGetDoc.mockResolvedValue(existingDoc(buildInput({ status: 'settled' })) as any);

    await expect(teamExpenseLedgerService.deleteClaim('claim-1'))
      .rejects.toThrow('team-expense-claim-posted-delete-blocked');

    expect(mockedDeleteDoc).not.toHaveBeenCalled();
  });

  it('allows only forward status transitions through the explicit status API', async () => {
    mockedGetDoc.mockResolvedValue(existingDoc(buildInput({ status: 'settled' })) as any);

    await expect(teamExpenseLedgerService.updateClaimStatus('claim-1', 'charged'))
      .rejects.toThrow('team-expense-claim-status-transition-blocked');
    expect(mockedSetDoc).not.toHaveBeenCalled();

    mockedGetDoc.mockResolvedValue(existingDoc(buildInput({ status: 'charged' })) as any);
    await teamExpenseLedgerService.updateClaimStatus('claim-1', 'settled', {
      actorId: 'actor-1',
      actorName: 'Actor',
      memo: 'paid'
    });

    expect(mockedSetDoc).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'claim-1' }),
      expect.objectContaining({
        status: 'settled',
        handledById: 'actor-1',
        handledByName: 'Actor',
        handleMemo: 'paid'
      }),
      { merge: true }
    );
  });

  it('recognizes charged and settled as posted statuses', () => {
    expect(isPostedTeamExpenseClaimStatus('charged')).toBe(true);
    expect(isPostedTeamExpenseClaimStatus('settled')).toBe(true);
    expect(isPostedTeamExpenseClaimStatus('draft')).toBe(false);
    expect(isLockedTeamExpenseClaimStatus('charged')).toBe(false);
    expect(isLockedTeamExpenseClaimStatus('settled')).toBe(true);
    expect(isLockedTeamExpenseClaimStatus('draft')).toBe(false);
  });

  it.each(['yearMonth', 'claimType', 'amount'] as const)(
    'keeps committed ID when success diagnostic %s getter throws', async (key) => {
      const input = { ...buildInput(), id: 'claim-boundary' };
      const diagnosticError = new Error('diagnostic getter');
      const getter = jest.fn(() => { throw diagnosticError; });
      mockedSetDoc.mockImplementationOnce(async () => {
        Object.defineProperty(input, key, { configurable: true, get: getter });
      });
      await expect(teamExpenseLedgerService.saveClaim(input)).resolves.toBe('claim-boundary');
      expect(getter).toHaveBeenCalledTimes(1);
      expect(mockedGetDoc).toHaveBeenCalledTimes(1);
      expect(mockedSetDoc).toHaveBeenCalledTimes(1);
      expect(mockedDeleteDoc).not.toHaveBeenCalled();
      expect(mockedRecordOperation).not.toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalled();
    }
  );

  it.each(['throw', 'reject'] as const)(
    'keeps committed ID when success recorder %s fails', async (mode) => {
      const diagnosticError = new Error('record diagnostic');
      if (mode === 'throw') mockedRecordOperation.mockImplementationOnce(() => { throw diagnosticError; });
      else mockedRecordOperation.mockRejectedValueOnce(diagnosticError);
      await expect(teamExpenseLedgerService.saveClaim({ ...buildInput(), id: 'claim-boundary' }))
        .resolves.toBe('claim-boundary');
      expect(mockedSetDoc).toHaveBeenCalledTimes(1);
      expect(mockedDeleteDoc).not.toHaveBeenCalled();
      expect(mockedRecordOperation).toHaveBeenCalledTimes(1);
      expect(mockedRecordOperation).toHaveBeenCalledWith(expect.objectContaining({ status: 'success' }));
      expect(console.error).not.toHaveBeenCalled();
    }
  );

  it('never reevaluates failed input or error getters and throws the original reference', async () => {
    const input = { ...buildInput(), id: 'claim-boundary' };
    const errorGetter = jest.fn(() => { throw new Error('must not inspect error'); });
    const originalError = Object.defineProperty({}, 'message', { get: errorGetter });
    const inputGetter = jest.fn(() => { throw new Error('must not inspect input'); });
    mockedSetDoc.mockImplementationOnce(async () => {
      Object.defineProperty(input, 'yearMonth', { get: inputGetter });
      throw originalError;
    });
    await expect(teamExpenseLedgerService.saveClaim(input)).rejects.toBe(originalError);
    expect(inputGetter).not.toHaveBeenCalled();
    expect(errorGetter).not.toHaveBeenCalled();
    expect(mockedSetDoc).toHaveBeenCalledTimes(1);
    expect(mockedDeleteDoc).not.toHaveBeenCalled();
    expect(mockedRecordOperation).toHaveBeenCalledTimes(1);
    expect(mockedRecordOperation).toHaveBeenCalledWith(expect.objectContaining({
      domain: 'teamExpense', yearMonth: '', status: 'failed', errorMessage: 'SUPPORT_WRITE_UNKNOWN',
      operationId: 'team-expense-claim:claim-boundary', affectedDocumentIds: ['claim-boundary']
    }));
    expect(console.error).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledWith('[support-write-operation]', {
      domain: 'teamExpense', errorCode: 'SUPPORT_WRITE_UNKNOWN'
    });
  });

  it.each(['throw', 'reject', 'console'] as const)(
    'preserves original failure reference across %s diagnostic failure', async (mode) => {
      const originalError = new Error('business original');
      const secondaryError = new Error('diagnostic secondary');
      mockedGetDoc.mockRejectedValueOnce(originalError);
      if (mode === 'throw') mockedRecordOperation.mockImplementationOnce(() => { throw secondaryError; });
      if (mode === 'reject') mockedRecordOperation.mockRejectedValueOnce(secondaryError);
      if (mode === 'console') jest.spyOn(console, 'error').mockImplementation(() => { throw secondaryError; });
      await expect(teamExpenseLedgerService.saveClaim({ ...buildInput(), id: 'claim-boundary' }))
        .rejects.toBe(originalError);
      expect(mockedGetDoc).toHaveBeenCalledTimes(1);
      expect(mockedSetDoc).not.toHaveBeenCalled();
      expect(mockedDeleteDoc).not.toHaveBeenCalled();
      expect(mockedRecordOperation).toHaveBeenCalledTimes(1);
      expect(mockedRecordOperation).toHaveBeenCalledWith(expect.objectContaining({
        domain: 'teamExpense', yearMonth: '2026-07', status: 'failed',
        errorMessage: 'SUPPORT_WRITE_UNKNOWN',
        operationId: 'team-expense-claim:claim-boundary', affectedDocumentIds: ['claim-boundary']
      }));
    }
  );

  it('preserves the original read failure when the month descriptor trap throws', async () => {
    const originalError = new Error('business read failure');
    const descriptorError = new Error('diagnostic descriptor failure');
    const descriptorTrap = jest.fn(() => { throw descriptorError; });
    const target = { ...buildInput(), id: 'claim-boundary' };
    const input = new Proxy(target, {
      getOwnPropertyDescriptor: descriptorTrap
    });
    mockedGetDoc.mockRejectedValueOnce(originalError);
    await expect(teamExpenseLedgerService.saveClaim(input)).rejects.toBe(originalError);
    expect(descriptorTrap).toHaveBeenCalledTimes(1);
    expect(descriptorTrap).toHaveBeenCalledWith(target, 'yearMonth');
    expect(mockedGetDoc).toHaveBeenCalledTimes(1);
    expect(mockedSetDoc).not.toHaveBeenCalled();
    expect(mockedDeleteDoc).not.toHaveBeenCalled();
    expect(mockedRecordOperation).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  it('connects the actual pure reporter with an exact sanitized output', () => {
    const getter = jest.fn(() => { throw new Error('no raw exception access'); });
    const error = Object.defineProperty({}, 'message', { get: getter });
    reportSupportWriteError(error, { domain: 'teamExpense', errorMessage: 'private-marker' });
    expect(getter).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledWith('[support-write-operation]', {
      domain: 'teamExpense', errorCode: 'SUPPORT_WRITE_UNKNOWN'
    });
  });

});
