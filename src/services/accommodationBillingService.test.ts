import {
  accommodationBillingService,
  isDraftAccommodationBillingStatus,
  isProtectedAccommodationBillingStatus
} from './accommodationBillingService';
import { recordSupportWriteOperationSafely } from './supportWriteOperationLogService';
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

jest.mock('../utils/supportWriteErrorReporting', () => ({
  SUPPORT_WRITE_RETRY_USER_MESSAGE: 'retry later',
  getErrorMessage: (error: unknown) => error instanceof Error ? error.message : String(error),
  reportSupportWriteError: jest.fn()
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
    mockedCreateItem.mockRejectedValueOnce(new Error('create failed'));

    await expect(accommodationBillingService.upsertBillingDocument(buildDocument([
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
    ]))).rejects.toThrow('create failed');

    expect(mockedDeleteItem).not.toHaveBeenCalled();
    expect(mockedUpdateItem).not.toHaveBeenCalledWith(expect.objectContaining({
      id: 'utility-rent',
      status: 'cancelled'
    }));
    expect(mockedRecordOperation).toHaveBeenCalledWith(expect.objectContaining({
      domain: 'accommodation',
      status: 'failed',
      affectedDocumentIds: expect.arrayContaining(['utility-rent', 'utility-water', BILLING_ID]),
      errorMessage: 'create failed'
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
});
