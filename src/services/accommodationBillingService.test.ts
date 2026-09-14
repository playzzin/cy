import {
  accommodationBillingService,
  isDraftAccommodationBillingStatus,
  isProtectedAccommodationBillingStatus
} from './accommodationBillingService';
import { recordSupportWriteOperationSafely } from './supportWriteOperationLogService';
import * as supportWriteReporting from '../utils/supportWriteErrorReporting';
import {
  createAccommodationBillingDocument,
  createAccommodationBillingLineItem,
  deleteAccommodationBillingDocument,
  deleteAccommodationBillingLineItem,
  listAllAccommodationBillingDocuments,
  listAllAccommodationBillingLineItems,
  listAllAdvancePayments,
  listAllTeams,
  listAllWorkers,
  updateAccommodationBillingDocument,
  updateAccommodationBillingLineItem,
  updateAdvancePayment
} from './firestoreCrudCompat';
import { accommodationBillingLogService } from './accommodationBillingLogService';
import type { AccommodationBillingDocument, AccommodationBillingLineItem } from '../types/accommodationBilling';

jest.mock('./firestoreCrudCompat', () => ({
  listAllAccommodationBillingDocuments: jest.fn(),
  listAllAccommodationBillingLineItems: jest.fn(),
  createAccommodationBillingDocument: jest.fn(),
  updateAccommodationBillingDocument: jest.fn(),
  deleteAccommodationBillingDocument: jest.fn(),
  createAccommodationBillingLineItem: jest.fn(),
  updateAccommodationBillingLineItem: jest.fn(),
  deleteAccommodationBillingLineItem: jest.fn(),
  listAllAdvancePayments: jest.fn(),
  createAdvancePayment: jest.fn(),
  updateAdvancePayment: jest.fn(),
  listAllTeams: jest.fn(),
  listAllWorkers: jest.fn()
}));

jest.mock('./accommodationBillingLogService', () => ({
  accommodationBillingLogService: {
    createLog: jest.fn()
  }
}));

jest.mock('./supportWriteOperationLogService', () => ({
  recordSupportWriteOperationSafely: jest.fn()
}));

const mockedListDocs = listAllAccommodationBillingDocuments as jest.MockedFunction<typeof listAllAccommodationBillingDocuments>;
const mockedListItems = listAllAccommodationBillingLineItems as jest.MockedFunction<typeof listAllAccommodationBillingLineItems>;
const mockedCreateDoc = createAccommodationBillingDocument as jest.MockedFunction<typeof createAccommodationBillingDocument>;
const mockedUpdateDoc = updateAccommodationBillingDocument as jest.MockedFunction<typeof updateAccommodationBillingDocument>;
const mockedCreateItem = createAccommodationBillingLineItem as jest.MockedFunction<typeof createAccommodationBillingLineItem>;
const mockedUpdateItem = updateAccommodationBillingLineItem as jest.MockedFunction<typeof updateAccommodationBillingLineItem>;
const mockedDeleteItem = deleteAccommodationBillingLineItem as jest.MockedFunction<typeof deleteAccommodationBillingLineItem>;
const mockedDeleteDoc = deleteAccommodationBillingDocument as jest.MockedFunction<typeof deleteAccommodationBillingDocument>;
const mockedListTeams = listAllTeams as jest.MockedFunction<typeof listAllTeams>;
const mockedListWorkers = listAllWorkers as jest.MockedFunction<typeof listAllWorkers>;
const mockedListAdvances = listAllAdvancePayments as jest.MockedFunction<typeof listAllAdvancePayments>;
const mockedUpdateAdvance = updateAdvancePayment as jest.MockedFunction<typeof updateAdvancePayment>;
const mockedCreateLog = accommodationBillingLogService.createLog as jest.MockedFunction<typeof accommodationBillingLogService.createLog>;
const mockedRecordOperation = recordSupportWriteOperationSafely as jest.MockedFunction<typeof recordSupportWriteOperationSafely>;

const TEAM_UUID = '11111111-1111-4111-8111-111111111111';
const BILLING_ID = `${TEAM_UUID}_team_none_2026-07`;

const buildStoredDoc = (status: AccommodationBillingDocument['status'] = 'draft') => ({
  id: BILLING_ID,
  yearMonth: '2026-07',
  teamId: TEAM_UUID,
  teamName: 'A팀',
  issuedToType: 'team',
  issuedToWorkerId: null,
  issuedToWorkerName: 'A팀',
  status,
  memo: null
});

const buildStoredItem = (patch: Partial<AccommodationBillingLineItem> & { billingDocumentId?: string }) => ({
  id: 'item-1',
  billingDocumentId: BILLING_ID,
  label: 'Rent',
  amount: 100,
  targetField: 'accommodation',
  sourceType: 'utility_ledger',
  sourceAccommodationId: 'acc-1',
  sourceUtilityRecordId: 'utility-1',
  status: 'active',
  ...patch
});

const buildDocument = (lineItems: AccommodationBillingLineItem[]): Omit<AccommodationBillingDocument, 'createdAt' | 'updatedAt'> => ({
  id: BILLING_ID,
  yearMonth: '2026-07',
  teamId: TEAM_UUID,
  teamName: 'A팀',
  issuedToType: 'team',
  issuedToWorkerId: '',
  issuedToWorkerName: 'A팀',
  status: 'draft',
  memo: '',
  lineItems
});

describe('accommodationBillingService.upsertBillingDocument line item safety', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockedListDocs.mockResolvedValue({ data: { accommodationBillingDocuments: [buildStoredDoc()] } } as any);
    mockedListItems.mockResolvedValue({ data: { accommodationBillingLineItems: [] } } as any);
    mockedUpdateDoc.mockResolvedValue({ data: { accommodationBillingDocument_update: { id: BILLING_ID } } } as any);
    mockedCreateDoc.mockResolvedValue({ data: { accommodationBillingDocument_insert: { id: BILLING_ID } } } as any);
    mockedCreateItem.mockResolvedValue({ data: { accommodationBillingLineItem_insert: { id: 'created' } } } as any);
    mockedUpdateItem.mockResolvedValue({ data: { accommodationBillingLineItem_update: { id: 'updated' } } } as any);
    mockedDeleteItem.mockResolvedValue({ data: { accommodationBillingLineItem_delete: { id: 'deleted' } } } as any);
    mockedDeleteDoc.mockResolvedValue({ data: { accommodationBillingDocument_delete: { id: BILLING_ID } } } as any);
    mockedListTeams.mockResolvedValue({ data: { teams: [] } } as any);
    mockedListWorkers.mockResolvedValue({ data: { workers: [] } } as any);
    mockedListAdvances.mockResolvedValue({ data: { advancePayments: [] } } as any);
    mockedUpdateAdvance.mockResolvedValue({ data: { advancePayment_update: { id: 'advance-1' } } } as any);
    mockedCreateLog.mockResolvedValue({} as any);
    mockedRecordOperation.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('updates changed line items without deleting or recreating unrelated existing items', async () => {
    mockedListItems.mockResolvedValue({ data: { accommodationBillingLineItems: [
      buildStoredItem({ id: 'utility-rent', label: 'Rent', amount: 100 }),
      buildStoredItem({
        id: 'manual-note',
        label: 'Manual',
        amount: 30,
        targetField: 'gloves',
        sourceType: 'manual',
        sourceAccommodationId: undefined,
        sourceUtilityRecordId: undefined
      })
    ] } } as any);

    await accommodationBillingService.upsertBillingDocument(buildDocument([
      {
        id: 'utility-rent',
        label: 'Rent',
        amount: 150,
        targetField: 'accommodation',
        sourceType: 'utility_ledger',
        sourceAccommodationId: 'acc-1',
        sourceUtilityRecordId: 'utility-1'
      },
      {
        id: 'manual-note',
        label: 'Manual',
        amount: 30,
        targetField: 'gloves',
        sourceType: 'manual'
      }
    ]));

    expect(mockedDeleteItem).not.toHaveBeenCalled();
    expect(mockedCreateItem).not.toHaveBeenCalled();
    expect(mockedUpdateItem).toHaveBeenCalledTimes(1);
    expect(mockedUpdateItem).toHaveBeenCalledWith(expect.objectContaining({
      id: 'utility-rent',
      amount: 150,
      status: 'active'
    }));
    expect(mockedRecordOperation).toHaveBeenCalledWith(expect.objectContaining({
      domain: 'accommodation',
      yearMonth: '2026-07',
      operationId: `accommodation-billing:2026-07:${BILLING_ID}`,
      status: 'success',
      affectedDocumentIds: expect.arrayContaining(['utility-rent', 'manual-note', BILLING_ID])
    }));
  });

  it('keeps existing line items when creating a new line item fails', async () => {
    mockedListItems.mockResolvedValue({ data: { accommodationBillingLineItems: [
      buildStoredItem({ id: 'utility-rent', label: 'Rent', amount: 100 })
    ] } } as any);
    const originalError = new Error('create failed');
    mockedCreateItem.mockRejectedValueOnce(originalError);

    const failedUpsert = accommodationBillingService.upsertBillingDocument(buildDocument([
      {
        id: 'utility-rent',
        label: 'Rent',
        amount: 100,
        targetField: 'accommodation',
        sourceType: 'utility_ledger',
        sourceAccommodationId: 'acc-1',
        sourceUtilityRecordId: 'utility-1'
      },
      {
        id: 'utility-water',
        label: 'Water',
        amount: 20,
        targetField: 'water',
        sourceType: 'utility_ledger',
        sourceAccommodationId: 'acc-1',
        sourceUtilityRecordId: 'utility-1'
      }
    ]));
    await expect(failedUpsert).rejects.toBe(originalError);
    await expect(failedUpsert).rejects.toThrow('create failed');

    expect(mockedDeleteItem).not.toHaveBeenCalled();
    expect(mockedUpdateItem).not.toHaveBeenCalledWith(expect.objectContaining({
      id: 'utility-rent',
      status: 'cancelled'
    }));
    expect(mockedRecordOperation).toHaveBeenCalledWith(expect.objectContaining({
      domain: 'accommodation',
      status: 'failed',
      affectedDocumentIds: expect.arrayContaining(['utility-rent', 'utility-water', BILLING_ID]),
      errorMessage: 'SUPPORT_WRITE_UNKNOWN'
    }));
  });

  it('blocks general updates to confirmed billing documents', async () => {
    mockedListDocs.mockResolvedValue({ data: { accommodationBillingDocuments: [buildStoredDoc('confirmed')] } } as any);
    mockedListItems.mockResolvedValue({ data: { accommodationBillingLineItems: [
      buildStoredItem({ id: 'utility-rent', amount: 100 })
    ] } } as any);

    await expect(accommodationBillingService.upsertBillingDocument(buildDocument([
      {
        id: 'utility-rent',
        label: 'Rent',
        amount: 200,
        targetField: 'accommodation',
        sourceType: 'utility_ledger',
        sourceAccommodationId: 'acc-1',
        sourceUtilityRecordId: 'utility-1'
      }
    ]))).rejects.toThrow('accommodation-billing-protected-modification-blocked:confirmed');

    expect(mockedUpdateDoc).not.toHaveBeenCalled();
    expect(mockedCreateItem).not.toHaveBeenCalled();
    expect(mockedUpdateItem).not.toHaveBeenCalled();
    expect(mockedDeleteItem).not.toHaveBeenCalled();
  });

  it('fails closed without writing when protected-state lookup fails before an upsert', async () => {
    mockedListDocs.mockRejectedValueOnce(new Error('billing lookup unavailable'));

    await expect(accommodationBillingService.upsertDraftBillingDocument(buildDocument([])))
      .rejects.toThrow('billing lookup unavailable');

    expect(mockedUpdateDoc).not.toHaveBeenCalled();
    expect(mockedCreateDoc).not.toHaveBeenCalled();
    expect(mockedCreateItem).not.toHaveBeenCalled();
    expect(mockedUpdateItem).not.toHaveBeenCalled();
    expect(mockedDeleteItem).not.toHaveBeenCalled();
  });

  it('fails closed when the second protected-state lookup fails immediately before update', async () => {
    mockedListDocs
      .mockResolvedValueOnce({ data: { accommodationBillingDocuments: [buildStoredDoc('draft')] } } as any)
      .mockRejectedValueOnce(new Error('billing guard unavailable'));

    await expect(accommodationBillingService.upsertDraftBillingDocument(buildDocument([])))
      .rejects.toThrow('billing guard unavailable');

    expect(mockedUpdateDoc).not.toHaveBeenCalled();
    expect(mockedCreateDoc).not.toHaveBeenCalled();
    expect(mockedCreateItem).not.toHaveBeenCalled();
    expect(mockedUpdateItem).not.toHaveBeenCalled();
    expect(mockedDeleteItem).not.toHaveBeenCalled();
  });

  it.each(['paid', 'OVERDUE'] as const)('blocks general updates to protected %s documents', async (status) => {
    mockedListDocs.mockResolvedValue({ data: { accommodationBillingDocuments: [buildStoredDoc(status)] } } as any);

    await expect(accommodationBillingService.upsertBillingDocument(buildDocument([])))
      .rejects.toThrow(`accommodation-billing-protected-modification-blocked:${status}`);

    expect(mockedUpdateDoc).not.toHaveBeenCalled();
    expect(mockedCreateDoc).not.toHaveBeenCalled();
  });

  it('upserts a replacement draft with the deterministic target/month id', async () => {
    mockedListDocs.mockResolvedValue({ data: { accommodationBillingDocuments: [buildStoredDoc('draft')] } } as any);
    const result = await accommodationBillingService.upsertDraftBillingDocument({
      ...buildDocument([]),
      id: 'legacy-random-id'
    });

    expect(result).toEqual({ id: BILLING_ID, action: 'replaced' });
    expect(mockedUpdateDoc).toHaveBeenCalledWith(expect.objectContaining({
      id: BILLING_ID,
    }));
    expect(mockedUpdateDoc.mock.calls[0][0]).not.toHaveProperty('status');
    expect(mockedUpdateDoc.mock.calls[0][0]).not.toHaveProperty('confirmedAt');
    expect(mockedUpdateDoc.mock.calls[0][0]).not.toHaveProperty('postedAdvancePaymentId');
    expect(mockedCreateDoc).not.toHaveBeenCalled();
  });

  it('preserves a concurrent confirmation and stops before line-item writes', async () => {
    mockedListDocs
      .mockResolvedValueOnce({ data: { accommodationBillingDocuments: [buildStoredDoc('draft')] } } as any)
      .mockResolvedValueOnce({ data: { accommodationBillingDocuments: [buildStoredDoc('draft')] } } as any)
      .mockResolvedValue({ data: { accommodationBillingDocuments: [buildStoredDoc('confirmed')] } } as any);

    await expect(accommodationBillingService.upsertDraftBillingDocument(buildDocument([
      {
        id: 'utility-rent',
        label: 'Rent',
        amount: 200,
        targetField: 'accommodation',
        sourceType: 'utility_ledger',
        sourceAccommodationId: 'acc-1',
        sourceUtilityRecordId: 'utility-1'
      }
    ]))).resolves.toEqual({
      id: BILLING_ID,
      action: 'skipped-protected',
      protectedStatus: 'confirmed'
    });

    expect(mockedUpdateDoc).toHaveBeenCalledTimes(1);
    expect(mockedUpdateDoc.mock.calls[0][0]).not.toHaveProperty('status');
    expect(mockedCreateItem).not.toHaveBeenCalled();
    expect(mockedUpdateItem).not.toHaveBeenCalled();
    expect(mockedDeleteItem).not.toHaveBeenCalled();
  });

  it('retries update when a concurrent caller creates the deterministic draft id first', async () => {
    mockedListDocs
      .mockResolvedValueOnce({ data: { accommodationBillingDocuments: [] } } as any)
      .mockResolvedValueOnce({ data: { accommodationBillingDocuments: [] } } as any)
      .mockResolvedValue({ data: { accommodationBillingDocuments: [buildStoredDoc('draft')] } } as any);
    mockedUpdateDoc
      .mockResolvedValueOnce({ data: { accommodationBillingDocument_update: null } } as any)
      .mockResolvedValueOnce({ data: { accommodationBillingDocument_update: { id: BILLING_ID } } } as any);
    mockedCreateDoc.mockRejectedValueOnce(new Error('duplicate id'));

    await expect(accommodationBillingService.upsertDraftBillingDocument(buildDocument([])))
      .resolves.toEqual({ id: BILLING_ID, action: 'created' });

    expect(mockedCreateDoc).toHaveBeenCalledTimes(1);
    expect(mockedUpdateDoc).toHaveBeenCalledTimes(2);
    expect(mockedUpdateDoc).toHaveBeenLastCalledWith(expect.objectContaining({ id: BILLING_ID }));
    expect(mockedUpdateDoc.mock.calls[1][0]).not.toHaveProperty('status');
  });

  it.each(['CONFIRMED', 'PAID', 'OVERDUE'] as const)('skips draft replacement when %s is already stored', async (status) => {
    mockedListDocs.mockResolvedValue({ data: { accommodationBillingDocuments: [buildStoredDoc(status)] } } as any);

    const result = await accommodationBillingService.upsertDraftBillingDocument(buildDocument([]));

    expect(result).toEqual({
      id: BILLING_ID,
      action: 'skipped-protected',
      protectedStatus: status
    });
    expect(mockedUpdateDoc).not.toHaveBeenCalled();
    expect(mockedCreateDoc).not.toHaveBeenCalled();
  });

  it('treats only DRAFT as mutable', () => {
    expect(isDraftAccommodationBillingStatus('DRAFT')).toBe(true);
    expect(isDraftAccommodationBillingStatus('draft')).toBe(true);
    expect(isProtectedAccommodationBillingStatus('CONFIRMED')).toBe(true);
    expect(isProtectedAccommodationBillingStatus('paid')).toBe(true);
    expect(isProtectedAccommodationBillingStatus('OVERDUE')).toBe(true);
  });

  it('does not confirm over an already paid document', async () => {
    mockedListDocs.mockResolvedValue({ data: { accommodationBillingDocuments: [buildStoredDoc('PAID')] } } as any);

    await expect(accommodationBillingService.confirmAndPostToAdvancePayment(BILLING_ID))
      .rejects.toThrow('accommodation-billing-protected-confirmation-blocked:PAID');

    expect(mockedUpdateDoc).not.toHaveBeenCalled();
    expect(mockedUpdateAdvance).not.toHaveBeenCalled();
  });

  it('does not delete an overdue document during unbilling cleanup', async () => {
    mockedListDocs.mockResolvedValue({ data: { accommodationBillingDocuments: [buildStoredDoc('OVERDUE')] } } as any);

    await expect(accommodationBillingService.deleteBillingDocument(BILLING_ID))
      .rejects.toThrow('accommodation-billing-protected-delete-blocked:OVERDUE');

    expect(mockedDeleteItem).not.toHaveBeenCalled();
  });

  it('fails closed without deleting when protected-state lookup fails', async () => {
    mockedListDocs.mockRejectedValueOnce(new Error('billing lookup unavailable'));

    await expect(accommodationBillingService.deleteBillingDocument(BILLING_ID))
      .rejects.toThrow('billing lookup unavailable');

    expect(mockedDeleteItem).not.toHaveBeenCalled();
    expect(mockedDeleteDoc).not.toHaveBeenCalled();
  });

  it('fails closed when the final protected-state guard fails before deletion', async () => {
    mockedListDocs
      .mockResolvedValueOnce({ data: { accommodationBillingDocuments: [buildStoredDoc('draft')] } } as any)
      .mockRejectedValueOnce(new Error('billing delete guard unavailable'));

    await expect(accommodationBillingService.deleteBillingDocument(BILLING_ID))
      .rejects.toThrow('billing delete guard unavailable');

    expect(mockedDeleteItem).not.toHaveBeenCalled();
    expect(mockedDeleteDoc).not.toHaveBeenCalled();
  });

  it('removes only the requested draft and its own line items when a saved amount becomes zero', async () => {
    mockedListDocs.mockResolvedValue({ data: { accommodationBillingDocuments: [buildStoredDoc('DRAFT')] } } as any);
    mockedListItems.mockResolvedValue({ data: { accommodationBillingLineItems: [
      buildStoredItem({ id: 'utility-rent' }),
      buildStoredItem({ id: 'other-document-item', billingDocumentId: 'other-billing-id' })
    ] } } as any);

    await accommodationBillingService.deleteBillingDocument(BILLING_ID);

    expect(mockedDeleteItem).toHaveBeenCalledTimes(1);
    expect(mockedDeleteItem).toHaveBeenCalledWith({ id: 'utility-rent' });
    expect(mockedDeleteDoc).toHaveBeenCalledTimes(1);
    expect(mockedDeleteDoc).toHaveBeenCalledWith({ id: BILLING_ID });
  });

  it('cancels a confirmed billing document before a re-billing edit and clears its advance-payment link', async () => {
    mockedListDocs.mockResolvedValue({ data: { accommodationBillingDocuments: [{
      ...buildStoredDoc('confirmed'),
      postedAdvancePaymentId: 'advance-1'
    }] } } as any);
    mockedListAdvances.mockResolvedValue({ data: { advancePayments: [{
      id: 'advance-1',
      yearMonth: '2026-07',
      workerId: null,
      workerName: null,
      teamId: TEAM_UUID,
      teamName: 'A팀',
      items: null,
      prevMonthCarryover: 0,
      accommodation: 100,
      totalDeduction: 100,
      accommodationBillingDocId: BILLING_ID
    }] } } as any);

    await accommodationBillingService.cancelConfirmation(BILLING_ID);

    expect(mockedUpdateAdvance).toHaveBeenCalledWith(expect.objectContaining({
      id: 'advance-1',
      accommodation: 0,
      totalDeduction: 0,
      accommodationBillingDocId: null
    }));
    expect(mockedUpdateDoc).toHaveBeenCalledWith(expect.objectContaining({
      id: BILLING_ID,
      status: 'draft',
      confirmedAt: null,
      postedAdvancePaymentId: null
    }));
  });

  it.each([false, true])('preserves success ID and business call order when history fails (console throws: %s)', async (consoleThrows) => {
    const historyError = new Error('private history failure');
    mockedCreateLog.mockRejectedValueOnce(historyError);
    const reportSpy = jest.spyOn(supportWriteReporting, 'reportSupportWriteError');
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {
      if (consoleThrows) throw new Error('console unavailable');
    });
    const consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {
      throw new Error('legacy warning must not run');
    });

    await expect(accommodationBillingService.upsertBillingDocument(buildDocument([])))
      .resolves.toBe(BILLING_ID);

    expect(reportSpy).toHaveBeenCalledTimes(1);
    expect(reportSpy.mock.calls[0][0]).toBe(historyError);
    expect(reportSpy.mock.calls[0][1]).toEqual({ domain: 'accommodation', status: 'failed' });
    expect(consoleWarn).not.toHaveBeenCalled();
    expect(consoleError.mock.calls).toEqual([[
      '[support-write-operation]', { domain: 'accommodation', errorCode: 'SUPPORT_WRITE_UNKNOWN' }
    ]]);
    expect(mockedRecordOperation).toHaveBeenCalledTimes(1);
    expect(mockedRecordOperation).toHaveBeenCalledWith(expect.objectContaining({
      status: 'success', operationId: `accommodation-billing:2026-07:${BILLING_ID}`,
      affectedDocumentIds: [BILLING_ID]
    }));
    const order = [
      ...mockedListDocs.mock.invocationCallOrder.map(index => ({ index, name: 'read-docs' })),
      ...mockedListItems.mock.invocationCallOrder.map(index => ({ index, name: 'read-items' })),
      ...mockedUpdateDoc.mock.invocationCallOrder.map(index => ({ index, name: 'update-doc' })),
      ...mockedCreateLog.mock.invocationCallOrder.map(index => ({ index, name: 'history' })),
      ...mockedRecordOperation.mock.invocationCallOrder.map(index => ({ index, name: 'record' }))
    ].sort((left, right) => left.index - right.index).map(entry => entry.name);
    expect(order).toEqual([
      'read-docs', 'read-items', 'update-doc', 'read-docs', 'read-items', 'read-items', 'history', 'record'
    ]);
    expect(mockedCreateDoc).not.toHaveBeenCalled();
    expect(mockedCreateItem).not.toHaveBeenCalled();
    expect(mockedUpdateItem).not.toHaveBeenCalled();
    expect(mockedDeleteItem).not.toHaveBeenCalled();
    expect(mockedDeleteDoc).not.toHaveBeenCalled();
    expect(mockedUpdateAdvance).not.toHaveBeenCalled();
  });

  it.each(['error', 'plain-object'] as const)('direct upsert preserves %s identity without reading diagnostic getters', async (kind) => {
    const originalError = kind === 'error' ? new Error('private failure') : {};
    const getter = jest.fn(() => { throw new Error('diagnostic getter must not run'); });
    for (const key of ['message', 'code', 'name', 'toString', Symbol.toPrimitive]) {
      Object.defineProperty(originalError, key, { configurable: true, get: getter });
    }
    mockedListDocs.mockRejectedValueOnce(originalError);
    const reportSpy = jest.spyOn(supportWriteReporting, 'reportSupportWriteError');
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => { throw new Error('console unavailable'); });

    await expect(accommodationBillingService.upsertBillingDocument(buildDocument([])))
      .rejects.toBe(originalError);

    expect(getter).not.toHaveBeenCalled();
    expect(reportSpy).toHaveBeenCalledTimes(1);
    expect(reportSpy.mock.calls[0][0]).toBe(originalError);
    expect(mockedRecordOperation).toHaveBeenCalledWith(expect.objectContaining({
      status: 'failed', errorMessage: 'SUPPORT_WRITE_UNKNOWN',
      userMessage: supportWriteReporting.SUPPORT_WRITE_RETRY_USER_MESSAGE,
      affectedDocumentIds: [BILLING_ID]
    }));
    expect(consoleError.mock.calls).toEqual([[
      '[support-write-operation]', { domain: 'accommodation', errorCode: 'SUPPORT_WRITE_UNKNOWN' }
    ]]);
    expect(mockedUpdateDoc).not.toHaveBeenCalled();
    expect(mockedCreateDoc).not.toHaveBeenCalled();
    expect(mockedCreateItem).not.toHaveBeenCalled();
    expect(mockedUpdateItem).not.toHaveBeenCalled();
    expect(mockedDeleteItem).not.toHaveBeenCalled();
  });

  it('direct upsert retains the original error when failure-context construction hits a getter', async () => {
    const originalError = new Error('business failure');
    const document = buildDocument([]);
    const getter = jest.fn(() => { throw new Error('context getter failure'); });
    mockedListDocs.mockImplementationOnce(async () => {
      Object.defineProperty(document, 'yearMonth', { get: getter });
      throw originalError;
    });
    await expect(accommodationBillingService.upsertBillingDocument(document)).rejects.toBe(originalError);
    expect(getter).toHaveBeenCalledTimes(1);
    expect(mockedRecordOperation).not.toHaveBeenCalled();
    expect(mockedUpdateDoc).not.toHaveBeenCalled();
    expect(mockedCreateDoc).not.toHaveBeenCalled();
  });

  it.each(['sync', 'async'] as const)('direct upsert retains original error after %s diagnostic record failure', async (kind) => {
    const originalError = new Error('business failure');
    mockedListDocs.mockRejectedValueOnce(originalError);
    if (kind === 'sync') {
      mockedRecordOperation.mockImplementationOnce(() => { throw new Error('record failure'); });
    } else {
      mockedRecordOperation.mockRejectedValueOnce(new Error('record failure'));
    }
    const reportSpy = jest.spyOn(supportWriteReporting, 'reportSupportWriteError');
    await expect(accommodationBillingService.upsertBillingDocument(buildDocument([]))).rejects.toBe(originalError);
    expect(mockedRecordOperation).toHaveBeenCalledTimes(1);
    expect(reportSpy).toHaveBeenCalledTimes(1);
    expect(reportSpy.mock.calls[0][0]).toBe(originalError);
    expect(mockedUpdateDoc).not.toHaveBeenCalled();
  });

  it.each(['history', 'failure'] as const)('protects the %s report call itself even after the real reporter ran', async (stage) => {
    const originalError = new Error('original failure');
    const realReport = supportWriteReporting.reportSupportWriteError;
    const reportSpy = jest.spyOn(supportWriteReporting, 'reportSupportWriteError').mockImplementation((error, context) => {
      realReport(error, context);
      throw new Error('report boundary failure');
    });
    if (stage === 'history') mockedCreateLog.mockRejectedValueOnce(originalError);
    else mockedListDocs.mockRejectedValueOnce(originalError);
    const pending = accommodationBillingService.upsertBillingDocument(buildDocument([]));
    const result = await pending.then(value => ({ status: 'fulfilled', value }), error => ({ status: 'rejected', value: error }));
    expect(result.status).toBe(stage === 'history' ? 'fulfilled' : 'rejected');
    expect(result.value).toBe(stage === 'history' ? BILLING_ID : originalError);
    expect(reportSpy).toHaveBeenCalledTimes(1);
    expect(reportSpy.mock.calls[0][0]).toBe(originalError);
  });

  it('uses the unchanged real legacy extractor for a plain-object protected race', async () => {
    const originalError = { code: 'accommodation-billing-protected-modification-blocked', name: 'Race', message: 'confirmed' };
    mockedListDocs
      .mockResolvedValueOnce({ data: { accommodationBillingDocuments: [buildStoredDoc('draft')] } } as any)
      .mockRejectedValueOnce(originalError)
      .mockResolvedValueOnce({ data: { accommodationBillingDocuments: [buildStoredDoc('confirmed')] } } as any);
    await expect(accommodationBillingService.upsertDraftBillingDocument(buildDocument([]))).resolves.toEqual({
      id: BILLING_ID, action: 'skipped-protected', protectedStatus: 'confirmed'
    });
    expect(mockedListDocs).toHaveBeenCalledTimes(3);
    expect(mockedUpdateDoc).not.toHaveBeenCalled();
    expect(mockedCreateDoc).not.toHaveBeenCalled();
    expect(mockedCreateItem).not.toHaveBeenCalled();
    expect(mockedUpdateItem).not.toHaveBeenCalled();
    expect(mockedDeleteItem).not.toHaveBeenCalled();
  });
});
