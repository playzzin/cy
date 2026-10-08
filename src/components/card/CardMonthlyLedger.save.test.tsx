import React from 'react';
import { act, render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { buildCardLedgerWorkbook, downloadSupportResourceWorkbook } from '../../utils/supportResourceExcelExport';
import { rememberSupportManagementYearMonth } from '../../utils/supportManagementState';
import '@testing-library/jest-dom';
import { CardMonthlyLedger } from './CardMonthlyLedger';
import { cardService } from '../../services/cardService';
import { cardBillingService } from '../../services/cardBillingService';
import { cardMonthlyLedgerMutationService } from '../../services/cardMonthlyLedgerMutationService';
import { teamSettlementProtectionService } from '../../services/teamSettlementProtectionService';
import { manpowerService } from '../../services/manpowerService';
import { officeStaffService } from '../../services/officeStaffService';
import CardStatementUsageDialog from './CardStatementUsageDialog';
import type { Card, CardTransaction } from '../../types/card';
import type { CardMonthlyLedgerSaveResult } from '../../services/cardMonthlyLedgerMutationService';

jest.mock('../../utils/supportResourceExcelExport', () => ({ buildCardLedgerWorkbook: jest.fn(() => ({})), downloadSupportResourceWorkbook: jest.fn() }));

jest.mock('firebase/storage', () => ({ getDownloadURL: () => { throw Error('SDK forbidden'); }, ref: () => { throw Error('SDK forbidden'); }, uploadBytes: () => { throw Error('SDK forbidden'); } }));
jest.mock('../../config/firebase', () => ({ storage: null }));
jest.mock('../../services/cardStatementAttachmentService', () => ({
  cardStatementAttachmentService: { resolve: jest.fn() },
  getCardStatementFileName: (path: string) => path.split('/').pop(),
  getCardStatementAttachmentError: () => '파일 조회 실패',
}));
jest.mock('./CardStatementImportModal', () => ({ __esModule: true, default: () => null }));
jest.mock('./CardStatementImportHistoryModal', () => ({ CardStatementImportHistoryModal: () => null }));
jest.mock('./CardStatementUsageDialog', () => ({
  __esModule: true,
  default: jest.fn(({ onClose }: { onClose: () => void }) => <div role="dialog" aria-label="사용내역서 상세내역"><button onClick={onClose}>상세내역 닫기</button></div>),
}));
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
  jest.mocked(buildCardLedgerWorkbook).mockClear();
  jest.mocked(CardStatementUsageDialog).mockClear().mockImplementation(({ onClose }) => <div role="dialog" aria-label="사용내역서 상세내역"><button onClick={onClose}>상세내역 닫기</button></div>);
  jest.mocked(downloadSupportResourceWorkbook).mockReset().mockResolvedValue(undefined);
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

it('opens card analysis with every attachment and its ledger amount without ledger or billing writes', async () => {
  transactions = [{ id: 'fixture-tx', cardId: card.id, cardLabel: card.name, date: '2026-07-01', yearMonth: '2026-07', merchant: 'fixture', category: 'OTHER', amount: 100, statementAttachmentPaths: ['statements/first.pdf', 'statements/second.pdf'] }];
  // Both the initial read and the read after worker data hydration must settle.
  // eslint-disable-next-line testing-library/no-unnecessary-act
  await act(async () => { render(<CardMonthlyLedger cards={cards} teams={teams} loadingCards={false} />); });
  fireEvent.click(screen.getByRole('button', { name: '상세내역' }));
  expect(await screen.findByRole('dialog', { name: '사용내역서 상세내역' })).toBeInTheDocument();
  expect(jest.mocked(CardStatementUsageDialog).mock.calls.slice(-1)[0][0]).toEqual(expect.objectContaining({
    yearMonth: '2026-07', cardId: card.id, cardName: card.name, cardLast4: card.last4,
    ledgerTotal: 100, paths: ['statements/first.pdf', 'statements/second.pdf'],
  }));
  expect(ledger).not.toHaveBeenCalled();
  expect(cardBillingService.replaceDraftBilling).not.toHaveBeenCalled();
});

it('reconciles the whole card month across split rows and deduplicates their shared PDFs', async () => {
  transactions = [
    { id: 'tx-first', cardId: card.id, cardLabel: card.name, date: '2026-07-03', yearMonth: '2026-07', merchant: 'fixture', category: 'OTHER', amount: 100, statementAttachmentPaths: ['statements/shared.pdf'] },
    { id: 'tx-second', cardId: card.id, cardLabel: card.name, date: '2026-07-20', yearMonth: '2026-07', merchant: 'fixture', category: 'OTHER', amount: 200, statementAttachmentPaths: ['statements/shared.pdf', 'statements/second.pdf'] },
  ];
  jest.mocked(cardService.listAllCardBillingTargets).mockResolvedValue([
    { id: 'target-first', cardId: card.id, cardLabel: card.name, targetId: 'team-first', targetType: 'TEAM', targetName: '첫팀', startDate: '2026-07-01', endDate: '2026-07-15' },
    { id: 'target-second', cardId: card.id, cardLabel: card.name, targetId: 'team-second', targetType: 'TEAM', targetName: '둘째팀', startDate: '2026-07-16' },
  ]);
  // eslint-disable-next-line testing-library/no-unnecessary-act
  await act(async () => { render(<CardMonthlyLedger cards={cards} teams={teams} loadingCards={false} />); });
  fireEvent.click(screen.getAllByRole('button', { name: '상세내역' })[0]);
  expect(jest.mocked(CardStatementUsageDialog).mock.calls.slice(-1)[0][0]).toEqual(expect.objectContaining({
    ledgerTotal: 300, paths: ['statements/shared.pdf', 'statements/second.pdf'],
  }));
  expect(ledger).not.toHaveBeenCalled();
  expect(cardBillingService.replaceDraftBilling).not.toHaveBeenCalled();
  await act(async () => rememberSupportManagementYearMonth('2026-08'));
  expect(screen.queryByRole('dialog', { name: '사용내역서 상세내역' })).not.toBeInTheDocument();
});

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

it('exports the displayed card rows and current edits without saving', async () => {
  // Flush both the initial load and the load triggered by worker hydration.
  // eslint-disable-next-line testing-library/no-unnecessary-act
  await act(async () => { render(<CardMonthlyLedger cards={cards} teams={teams} loadingCards={false} exportContext={{ teamName: '시험팀', searchText: '시험카드' }} />); });
  await waitFor(() => expect(screen.getByRole('button', { name: '엑셀 다운로드' })).toBeEnabled());
  const amount = screen.getAllByRole('textbox')[0];
  fireEvent.change(amount, { target: { value: '1234' } });
  fireEvent.blur(amount);
  fireEvent.click(screen.getByRole('button', { name: '엑셀 다운로드' }));
  await waitFor(() => expect(downloadSupportResourceWorkbook).toHaveBeenCalledTimes(1));
  expect(buildCardLedgerWorkbook).toHaveBeenCalledWith(expect.objectContaining({ yearMonth: '2026-07', teamName: '시험팀', searchText: '시험카드', hasUnsavedChanges: true }),
    [expect.objectContaining({ card, total: 1234, amounts: expect.objectContaining({ OTHER: 1234 }) })]);
  expect(ledger).not.toHaveBeenCalled();
  expect(cardBillingService.replaceDraftBilling).not.toHaveBeenCalled();
});

it('blocks card export while loading a changed filter and after a failed month load', async () => {
  const { rerender } = render(<CardMonthlyLedger cards={cards} teams={teams} loadingCards={false} />);
  await waitFor(() => expect(screen.getByRole('button', { name: '엑셀 다운로드' })).toBeEnabled());
  jest.mocked(cardService.getTransactionsByMonth).mockRejectedValueOnce(Error('fixture new month failure'));
  await act(async () => rememberSupportManagementYearMonth('2026-08'));
  expect(screen.getByRole('button', { name: '엑셀 다운로드' })).toBeDisabled();
  rerender(<CardMonthlyLedger cards={[]} teams={teams} loadingCards={true} />);
  expect(screen.getByRole('button', { name: '엑셀 다운로드' })).toBeDisabled();
  expect(downloadSupportResourceWorkbook).not.toHaveBeenCalled();
});

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
