import { saveCardMonthlyLedger, CardSaveDependencies, CardSaveInput, CardSaveRow, CardSaveSnapshot } from './cardMonthlyLedgerSaveCoordinator';
import { assignCardLedgerOrphanDrafts, getCardIdsWithProtectedOrphanBillings, reconcileSavedCardLedgerBillings, mergeCardLedgerWithPreservedManualLineItems } from './cardMonthlyLedgerAutoBillingService';
import { isConfirmedTeamSettlementTarget } from './teamSettlementProtectionService';
import type { CardBillingDocument } from '../types/cardBilling';
import type { CardMonthlyLedgerSaveResult } from './cardMonthlyLedgerMutationService';

jest.mock('./cardBillingService', () => {
  const pure = jest.requireActual('./cardBillingService');
  return { isPostedCardBillingStatus: pure.isPostedCardBillingStatus, cardBillingService: { replaceDraftBilling: () => { throw Error('default SDK forbidden'); }, deleteDraftBillings: () => { throw Error('default SDK forbidden'); } } };
});
jest.mock('./cardFirestoreService', () => ({ cardFirestoreService: {} }));
jest.mock('./cardService', () => ({ cardService: {} }));
jest.mock('./manpowerService', () => ({ manpowerService: {} }));
jest.mock('./firestoreCrudCompat', () => ({ listSystemConfigs: () => { throw Error('SDK forbidden'); } }));

interface Row extends CardSaveRow { target: string; }
const row = (id = 'row-1', cardId = 'card-1', total = 1200): Row => ({ id, card: { id: cardId, name: 'fixture', last4: '0000' }, segment: { startDate: '2026-07-01', endDate: '2026-07-31' }, total, amounts: { OTHER: total }, target: 'team-1' });
const billing = (patch: Partial<CardBillingDocument> = {}): CardBillingDocument => ({ id: 'billing__row_row-1', yearMonth: '2026-07', cardId: 'card-1', cardLabel: 'fixture', teamId: 'team-1', variableCost: 1200, totalAmount: 1200, status: 'DRAFT', lineItems: [], statementAttachmentPaths: [], ...patch });
let input: CardSaveInput<Row>;
let deps: CardSaveDependencies<Row>;
let snapshot: CardSaveSnapshot<Row>;
let saved: CardMonthlyLedgerSaveResult;
let calls: string[];
let save: jest.Mock;
let load: jest.Mock;
let replace: jest.Mock;
let remove: jest.Mock;
let keys: jest.Mock;
let report: jest.Mock;

beforeEach(() => {
  const r = row();
  calls = [];
  snapshot = { rows: [r], billings: [] };
  saved = { operationId: 'fixture-operation', upsertedTransactionCount: 1, cancelledTransactionCount: 0, savedBillingCount: 0, cancelledBillingCount: 0, skippedBillingCount: 0, transactionUpsertIds: ['tx'], transactionCancelIds: [], billingSaveIds: [], billingCancelIds: [], skippedBillingRows: [] };
  input = { ledgerInput: { yearMonth: '2026-07', visibleRows: [{ row: r }], originalTransactions: [], categories: ['OTHER'], getBillingDocumentsForRow: () => [] }, eligibleRowIds: new Set([r.id]), allRowsByCardId: new Map([[r.card.id, [r]]]), sourceFullyEligibleCardIds: new Set([r.card.id]) };
  save = jest.fn(async () => { calls.push('ledger'); return saved; });
  load = jest.fn(async () => { calls.push('read'); return snapshot; });
  replace = jest.fn(async () => { calls.push('replace'); });
  remove = jest.fn(async () => { calls.push('delete'); });
  keys = jest.fn(async () => { calls.push('keys'); return { teamIds: new Set<string>(), teamNames: new Set<string>() }; });
  report = jest.fn();
  deps = { saveMonthlyLedger: save, loadPersistedSnapshot: load, onLedgerSaved: () => { calls.push('accepted'); }, getConfirmedTeamSettlementKeys: keys, isConfirmedTarget: isConfirmedTeamSettlementTarget,
    resolveCardBillingTarget: r => r.target ? { teamId: r.target, teamName: r.target } : null,
    getAllBillingDocumentsForRow: (r, docs) => docs.filter(d => d.id.endsWith(`__row_${r.id}`)),
    buildBillingDocumentForRow: (r, existing) => {
      if (!r.target) return null;
      const items = mergeCardLedgerWithPreservedManualLineItems(r.total ? [{ label: 'ledger', amount: r.total, sourceType: 'card_ledger' }] : [], existing?.lineItems ?? []);
      const total = items.reduce((sum, item) => sum + item.amount, 0);
      return billing({ id: `billing__row_${r.id}`, cardId: r.card.id, teamId: r.target, totalAmount: total, variableCost: total, lineItems: items });
    },
    getCardLedgerStructureFingerprint: r => JSON.stringify([r.id, r.card.id, r.segment, r.target]), normalizeKey: value => String(value ?? '').trim(),
    getCardIdsWithProtectedOrphanBillings, assignCardLedgerOrphanDrafts, reconcileSavedBillings: reconcileSavedCardLedgerBillings,
    replaceDraftBilling: replace, deleteDraftBillings: remove, reportDiagnostic: report };
});

it('preserves the full ledger response in a partial result when post-commit reconciliation throws', async () => {
  const failure = new Error('fixture unexpected reconciliation rejection');
  deps.reconcileSavedBillings = async () => { throw failure; };
  const result = await saveCardMonthlyLedger(input, deps);
  expect(result).toMatchObject({ status: 'partial', stage: 'billing', result: saved, error: failure });
  expect(result.result).toBe(saved);
  expect(save).toHaveBeenCalledTimes(1);
  expect(load).toHaveBeenCalledTimes(1);
  expect(replace).not.toHaveBeenCalled();
  expect(remove).not.toHaveBeenCalled();
});

it('post-read preparation error is not mislabeled as a failed persisted read', async () => {
  const failure = new Error('fixture fingerprint refused');
  deps.getCardLedgerStructureFingerprint = () => { throw failure; };
  expect(await saveCardMonthlyLedger(input, deps)).toMatchObject({ status: 'partial', stage: 'billing', result: saved, error: failure });
  expect(load).toHaveBeenCalledTimes(1);
  expect(keys).not.toHaveBeenCalled();
  expect(replace).not.toHaveBeenCalled();
});

it('ledger rejection preserves the exact original error and performs no read, billing or diagnostics', async () => {
  const failure = Object.freeze({ reason: 'fixture ledger refused' });
  save.mockRejectedValueOnce(failure);
  await expect(saveCardMonthlyLedger(input, deps)).rejects.toBe(failure);
  expect(load).not.toHaveBeenCalled(); expect(keys).not.toHaveBeenCalled();
  expect(replace).not.toHaveBeenCalled(); expect(remove).not.toHaveBeenCalled(); expect(report).not.toHaveBeenCalled();
  expect(calls).not.toContain('accepted');
});

it('success uses persisted rows rather than editable amounts and returns every original ledger field', async () => {
  snapshot.rows = [{ ...row(), total: 2300, amounts: { OTHER: 2300 } }];
  const result = await saveCardMonthlyLedger(input, deps);
  expect(result.result).toBe(saved);
  expect(save).toHaveBeenCalledWith(input.ledgerInput);
  expect(calls).toEqual(['ledger', 'accepted', 'read', 'keys', 'replace', 'read']);
  expect(load.mock.calls).toEqual([[{ strictBillingRead: true }], [{ strictBillingRead: true }]]);
  expect(replace).toHaveBeenCalledWith(expect.objectContaining({ totalAmount: 2300 }), []);
  expect(result).toMatchObject({ status: 'completed', autoBillingResult: { upsertedCount: 1, deletedCount: 0, protectedCount: 0, missingTargetCount: 0, unchangedCount: 0, failures: [] } });
});

it('null persisted snapshot stops all automatic billing', async () => {
  load.mockResolvedValueOnce(null);
  expect(await saveCardMonthlyLedger(input, deps)).toEqual({ status: 'snapshot-unavailable', result: saved });
  expect(keys).not.toHaveBeenCalled(); expect(replace).not.toHaveBeenCalled(); expect(remove).not.toHaveBeenCalled();
});

it('rejected persisted snapshot retains ledger response even when diagnostics throw', async () => {
  const failure = new Error('fixture read rejected'); load.mockRejectedValueOnce(failure);
  report.mockImplementation(() => { throw Error('fixture diagnostic rejected'); });
  expect(await saveCardMonthlyLedger(input, deps)).toMatchObject({ status: 'partial', stage: 'stored-read', result: saved, error: failure });
  expect(keys).not.toHaveBeenCalled(); expect(replace).not.toHaveBeenCalled();
});

it('settlement reread rejection stops billing and diagnostics cannot change the result', async () => {
  keys.mockRejectedValueOnce(new Error('fixture settlement refused'));
  report.mockImplementation(() => { throw Error('fixture diagnostic refused'); });
  expect(await saveCardMonthlyLedger(input, deps)).toEqual({ status: 'settlement-unavailable', result: saved });
  expect(replace).not.toHaveBeenCalled(); expect(remove).not.toHaveBeenCalled(); expect(load).toHaveBeenCalledTimes(1);
});

it('protects a team confirmed after the ledger response', async () => {
  keys.mockResolvedValueOnce({ teamIds: new Set(['team-1']), teamNames: new Set() });
  const result = await saveCardMonthlyLedger(input, deps);
  expect(result).toMatchObject({ status: 'completed', postSaveSettlementProtectedRowIds: new Set(['row-1']) });
  expect(replace).not.toHaveBeenCalled(); expect(remove).not.toHaveBeenCalled();
});

it.each(['CONFIRMED', 'PAID', 'OVERDUE'] as const)('retains existing %s billing protection', async status => {
  snapshot.billings = [billing({ status })];
  const result = await saveCardMonthlyLedger(input, deps);
  expect(result).toMatchObject({ autoBillingResult: { protectedCount: 1, failures: [] } });
  expect(replace).not.toHaveBeenCalled(); expect(remove).not.toHaveBeenCalled();
});

it('protects the complete card when persisted target or split structure changed', async () => {
  snapshot.rows = [{ ...row(), target: 'changed-team' }];
  const result = await saveCardMonthlyLedger(input, deps);
  expect(result).toMatchObject({ postSaveStructureChangedCardIds: new Set(['card-1']) });
  expect(replace).not.toHaveBeenCalled(); expect(remove).not.toHaveBeenCalled();
});

it('protects a posted orphan and does not retarget the old document', async () => {
  snapshot.billings = [billing({ id: 'old__row_orphan', status: 'CONFIRMED', teamId: 'old-team' })];
  const result = await saveCardMonthlyLedger(input, deps);
  expect(result).toMatchObject({ postSaveProtectedOrphanCardIds: new Set(['card-1']) });
  expect(replace).not.toHaveBeenCalled(); expect(remove).not.toHaveBeenCalled();
});

it('assigns a draft orphan exactly once and preserves manual adjustments', async () => {
  snapshot.billings = [billing({ id: 'old__row_orphan', lineItems: [{ label: 'manual', amount: 70, sourceType: 'manual' }] })];
  await saveCardMonthlyLedger(input, deps);
  expect(replace).toHaveBeenCalledTimes(1);
  expect(replace).toHaveBeenCalledWith(expect.objectContaining({ totalAmount: 1270, lineItems: expect.arrayContaining([{ label: 'manual', amount: 70, sourceType: 'manual' }]) }), ['old__row_orphan']);
});

it('zero persisted row deletes only owned drafts', async () => {
  snapshot.rows = [row('row-1', 'card-1', 0)];
  snapshot.billings = [billing(), billing({ id: 'manual-unmarked' }), billing({ id: 'cancelled__row_row-1', status: 'CANCELLED' })];
  const result = await saveCardMonthlyLedger(input, deps);
  expect(remove).toHaveBeenCalledWith(['billing__row_row-1']); expect(replace).not.toHaveBeenCalled();
  expect(result).toMatchObject({ autoBillingResult: { deletedCount: 1 } });
});

it('zero row keeps manual adjustments instead of deleting the draft', async () => {
  snapshot.rows = [row('row-1', 'card-1', 0)];
  snapshot.billings = [billing({ lineItems: [{ label: 'manual', amount: 70, sourceType: 'manual' }] })];
  await saveCardMonthlyLedger(input, deps);
  expect(remove).not.toHaveBeenCalled(); expect(replace).toHaveBeenCalledWith(expect.objectContaining({ totalAmount: 70 }), []);
});

it('missing builder target is counted without deleting or inventing a target', async () => {
  deps.buildBillingDocumentForRow = () => null;
  expect(await saveCardMonthlyLedger(input, deps)).toMatchObject({ autoBillingResult: { missingTargetCount: 1, failures: [] } });
  expect(replace).not.toHaveBeenCalled(); expect(remove).not.toHaveBeenCalled();
});

it('row failure stops later rows in that card scope but permits unrelated cards', async () => {
  const rows = [row(), row('row-2'), row('row-3', 'card-2')];
  snapshot.rows = rows;
  input.eligibleRowIds = new Set(rows.map(r => r.id));
  input.allRowsByCardId = new Map([['card-1', rows.slice(0, 2)], ['card-2', [rows[2]]]]);
  input.sourceFullyEligibleCardIds = new Set(['card-1', 'card-2']);
  replace.mockRejectedValueOnce(new Error('team-settlement-confirmed-card-billing-blocked'));
  const result = await saveCardMonthlyLedger(input, deps);
  expect(result.result).toBe(saved);
  expect(result).toMatchObject({ autoBillingResult: { upsertedCount: 1, failures: [
    { rowId: 'row-1', operation: 'upsert', message: 'team-settlement-confirmed-card-billing-blocked' },
    { rowId: 'row-2', operation: 'upsert', message: 'card-billing-scope-prerequisite-failed' }
  ] } });
  expect(replace).toHaveBeenCalledTimes(2);
});

it('final null read preserves actual completed automatic billing counts', async () => {
  load.mockResolvedValueOnce(snapshot).mockResolvedValueOnce(null);
  expect(await saveCardMonthlyLedger(input, deps)).toMatchObject({ status: 'completed', finalSnapshot: null, autoBillingResult: { upsertedCount: 1 } });
  expect(save).toHaveBeenCalledTimes(1);
});

it('final read rejection preserves both original ledger and completed billing results', async () => {
  const failure = new Error('fixture final read rejected');
  load.mockResolvedValueOnce(snapshot).mockRejectedValueOnce(failure);
  const result = await saveCardMonthlyLedger(input, deps);
  expect(result).toMatchObject({ status: 'partial', stage: 'final-read', result: saved, error: failure, autoBillingResult: { upsertedCount: 1 } });
  expect(save).toHaveBeenCalledTimes(1); expect(replace).toHaveBeenCalledTimes(1);
});
