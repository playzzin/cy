import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CardMonthlyLedger } from './CardMonthlyLedger';
import { cardService } from '../../services/cardService';
import { cardBillingService } from '../../services/cardBillingService';
import { cardMonthlyLedgerMutationService } from '../../services/cardMonthlyLedgerMutationService';
import { teamSettlementProtectionService } from '../../services/teamSettlementProtectionService';
import { manpowerService } from '../../services/manpowerService';
import { officeStaffService } from '../../services/officeStaffService';
import type { Card, CardTransaction } from '../../types/card';
import type { CardMonthlyLedgerSaveResult } from '../../services/cardMonthlyLedgerMutationService';

jest.mock('firebase/storage', () => ({ getDownloadURL: () => { throw Error('SDK forbidden'); }, ref: () => { throw Error('SDK forbidden'); }, uploadBytes: () => { throw Error('SDK forbidden'); } }));
jest.mock('../../config/firebase', () => ({ storage: null }));
jest.mock('./CardStatementImportModal', () => ({ __esModule: true, default: () => null }));
jest.mock('./CardStatementImportHistoryModal', () => ({ CardStatementImportHistoryModal: () => null }));
jest.mock('../../services/cardFirestoreService', () => ({ cardFirestoreService: {} }));
jest.mock('../../services/firestoreCrudCompat', () => ({ listSystemConfigs: () => { throw Error('SDK forbidden'); } }));
jest.mock('../../constants/iconMap', () => ({ iconMap: {} }));
jest.mock('../../services/cardService', () => ({ cardService: { getTransactionsByMonth: jest.fn(), listAllCardAssignments: jest.fn(), listAllCardBillingTargets: jest.fn(), applyCardTransactionChanges: () => { throw Error('default ledger forbidden'); } } }));
jest.mock('../../services/cardBillingService', () => {
  const pure = jest.requireActual('../../services/cardBillingService');
  return { isPostedCardBillingStatus: pure.isPostedCardBillingStatus, cardBillingService: { buildBillingDocumentId: pure.cardBillingService.buildBillingDocumentId, getBillingsByMonth: jest.fn(), replaceDraftBilling: jest.fn(), deleteDraftBillings: jest.fn(), saveBilling: () => { throw Error('attachment forbidden'); } } };
});
jest.mock('../../services/cardMonthlyLedgerMutationService', () => ({ cardMonthlyLedgerMutationService: { saveMonthlyLedger: jest.fn() } }));
jest.mock('../../services/teamSettlementProtectionService', () => {
  const pure = jest.requireActual('../../services/teamSettlementProtectionService');
  return { teamSettlementProtectionService: { getConfirmedTeamSettlementKeys: jest.fn(), isConfirmedTarget: pure.isConfirmedTeamSettlementTarget } };
});
jest.mock('../../services/manpowerService', () => ({ manpowerService: { getWorkers: jest.fn() } }));
jest.mock('../../services/officeStaffService', () => ({ officeStaffService: { getOfficeStaff: jest.fn() } }));

const card: Card = { id: 'fixture-card', name: '시험카드', issuer: '시험', cardType: 'CREDIT', last4: '0000', maskedNumber: '****', status: 'ASSIGNED' };
const cards = [card];
const teams: [] = [];
const saved: CardMonthlyLedgerSaveResult = { operationId: 'fixture-operation', upsertedTransactionCount: 1, cancelledTransactionCount: 0, savedBillingCount: 0, cancelledBillingCount: 0, skippedBillingCount: 0, transactionUpsertIds: ['fixture-tx'], transactionCancelIds: [], billingSaveIds: [], billingCancelIds: [], skippedBillingRows: [] };
let transactions: CardTransaction[];
let sequence: string[];
let diagnostic: jest.SpyInstance;
const ledger = jest.mocked(cardMonthlyLedgerMutationService.saveMonthlyLedger);
const billings = jest.mocked(cardBillingService.getBillingsByMonth);
const protection = jest.mocked(teamSettlementProtectionService.getConfirmedTeamSettlementKeys);

beforeEach(() => {
  sequence = [];
  transactions = [];
  window.sessionStorage.setItem('cy.support-management.year-month', '2026-07');
  diagnostic = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  jest.mocked(manpowerService.getWorkers).mockResolvedValue([]);
  jest.mocked(officeStaffService.getOfficeStaff).mockResolvedValue([]);
  jest.mocked(cardService.getTransactionsByMonth).mockImplementation(async () => { sequence.push('read'); return transactions; });
  jest.mocked(cardService.listAllCardAssignments).mockResolvedValue([]);
  jest.mocked(cardService.listAllCardBillingTargets).mockResolvedValue([{ id: 'target-fixture', cardId: card.id, cardLabel: card.name, targetId: 'fixture-team', targetType: 'TEAM', targetName: '시험팀', startDate: '2026-07-01' }]);
  billings.mockResolvedValue([]);
  protection.mockResolvedValue({ teamIds: new Set(), teamNames: new Set() });
  ledger.mockImplementation(async (input) => {
    sequence.push('ledger');
    transactions = input.visibleRows.map(({ row }) => ({ id: 'fixture-tx', cardId: card.id, cardLabel: card.name, date: '2026-07-01', yearMonth: '2026-07', merchant: 'fixture', category: 'OTHER', amount: row.amounts.OTHER ?? 0 }));
    return saved;
  });
  jest.mocked(cardBillingService.replaceDraftBilling).mockImplementation(async () => { sequence.push('billing'); });
  jest.mocked(cardBillingService.deleteDraftBillings).mockResolvedValue(undefined);
});
afterEach(() => { cleanup(); diagnostic.mockRestore(); });

async function editAndSave(beforeSave?: () => void) {
  render(<CardMonthlyLedger cards={cards} teams={teams} loadingCards={false} />);
  await screen.findByText('시험카드 (0000)');
  const amount = (await screen.findAllByRole('textbox'))[0];
  fireEvent.change(amount, { target: { value: '1200' } });
  fireEvent.blur(amount);
  expect(screen.getByText('● 수정사항 있음')).toBeInTheDocument();
  sequence = [];
  beforeSave?.();
  fireEvent.click(screen.getByRole('button', { name: /^저장$/ }));
}

it('post-save settlement read failure remains a ledger-preserving warning even when diagnostics throw', async () => {
  protection.mockResolvedValueOnce({ teamIds: new Set(), teamNames: new Set() })
    .mockRejectedValueOnce(new Error('fixture settlement read refused'));
  diagnostic.mockImplementation((message: unknown) => {
    if (String(message).includes('post-save settlement protection')) throw Error('fixture diagnostic failure');
  });
  await editAndSave();
  await screen.findByText('대장은 저장됐지만 팀별 경비 반영을 중단했습니다.');
  expect(ledger).toHaveBeenCalledTimes(1);
  expect(cardBillingService.replaceDraftBilling).not.toHaveBeenCalled();
  expect(cardBillingService.deleteDraftBillings).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: '다시 저장' })).toBeEnabled();
  expect(screen.queryByText('저장 실패')).not.toBeInTheDocument();
});

it('existing flow fixture: saves ledger then reads persisted amount then reconciles with unchanged success UI', async () => {
  await editAndSave();
  await screen.findByText('저장 및 팀별 경비 반영 완료');
  expect(sequence).toEqual(['ledger', 'read', 'billing', 'read']);
  expect(cardBillingService.replaceDraftBilling).toHaveBeenCalledWith(expect.objectContaining({ totalAmount: 1200, id: 'fixture-card_fixture-team_team_none_2026-07__row_target-fixture', status: 'DRAFT' }), []);
  expect(screen.queryByText('● 수정사항 있음')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '다시 저장' })).not.toBeInTheDocument();
});

it('preflight billing read refusal leaves editable amounts and performs zero ledger writes', async () => {
  await editAndSave(() => billings.mockRejectedValueOnce(Error('fixture preflight refused')));
  await screen.findByText('저장 실패');
  expect(ledger).not.toHaveBeenCalled();
  expect(cardBillingService.replaceDraftBilling).not.toHaveBeenCalled();
  expect(screen.getByText('● 수정사항 있음')).toBeInTheDocument();
  expect(sequence).toEqual([]);
});

it('ledger refusal keeps the original failure guidance and performs zero subsequent reads or billing', async () => {
  await editAndSave(() => ledger.mockRejectedValueOnce(Error('fixture ledger refused')));
  await screen.findByText('저장 실패');
  expect(screen.getByText('저장에 실패했습니다. 같은 화면에서 잠시 후 다시 시도해 주세요. 문제가 반복되면 작업 시간과 화면명을 관리자에게 전달해 주세요.')).toBeInTheDocument();
  expect(sequence).toEqual([]);
  expect(cardBillingService.replaceDraftBilling).not.toHaveBeenCalled();
  expect(screen.getByText('● 수정사항 있음')).toBeInTheDocument();
});

it('post-save null snapshot uses the existing saved-ledger warning and leaves billing untouched', async () => {
  await editAndSave(() => jest.mocked(cardService.getTransactionsByMonth).mockRejectedValueOnce(Error('fixture stored read refused')));
  await screen.findByText('대장은 저장됐지만 자동 반영을 확인하지 못했습니다.');
  expect(ledger).toHaveBeenCalledTimes(1);
  expect(cardBillingService.replaceDraftBilling).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: '다시 저장' })).toBeEnabled();
});

it('preflight team protection preserves original guide and excludes protected amounts from the ledger input', async () => {
  await editAndSave(() => protection.mockResolvedValue({ teamIds: new Set(['fixture-team']), teamNames: new Set() }));
  await screen.findByText('저장 완료 · 일부 행 확인 필요');
  expect(ledger).toHaveBeenCalledWith(expect.objectContaining({ visibleRows: [] }));
  expect(screen.getByText(/팀정산 확정 보호로 저장하지 않은 행 1건/)).toBeInTheDocument();
  expect(cardBillingService.replaceDraftBilling).not.toHaveBeenCalled();
});

it.each([
  ['fixture row refused', '자동 반영 실패 1건(저장을 다시 누르면 중복 없이 재시도)'],
  ['team-settlement-confirmed-card-billing-blocked', '경비 반영 직전 팀정산 확정 감지 1건(대장은 저장됨 · 확정 취소 후 다시 저장 필요)']
])('row failure %s preserves original count and retry guidance', async (error, text) => {
  await editAndSave(() => jest.mocked(cardBillingService.replaceDraftBilling).mockRejectedValueOnce(Error(error)));
  await screen.findByText('저장 완료 · 일부 행 확인 필요');
  expect(screen.getByText((content) => content.includes(text))).toBeInTheDocument();
  expect(screen.queryByText('저장 실패')).not.toBeInTheDocument();
  expect(ledger).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: '다시 저장' })).toBeEnabled();
});

it('unexpected builder throw preserves ledger outcome without inventing a failed row count', async () => {
  const builder = jest.spyOn(cardBillingService, 'buildBillingDocumentId').mockImplementation(() => { throw Error('fixture builder refused'); });
  try {
    await editAndSave();
    await screen.findByText('저장 완료 · 일부 행 확인 필요');
    expect(screen.getByText('대장은 저장됐지만 자동 반영을 확인하지 못했습니다.')).toBeInTheDocument();
    expect(screen.queryByText('저장 실패')).not.toBeInTheDocument();
    expect(ledger).toHaveBeenCalledTimes(1);
    expect(cardBillingService.replaceDraftBilling).not.toHaveBeenCalled();
  } finally { builder.mockRestore(); }
});
