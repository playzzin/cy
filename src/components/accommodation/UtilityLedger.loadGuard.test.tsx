import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import UtilityLedger from './UtilityLedger';
import { accommodationService } from '../../services/accommodationService';
import { accommodationAssignmentService } from '../../services/accommodationAssignmentService';
import { accommodationBillingTargetService } from '../../services/accommodationBillingTargetService';
import { accommodationBillingService } from '../../services/accommodationBillingService';
import { accommodationUtilityBillingAtomicService } from '../../services/accommodationUtilityBillingAtomicService';
import { teamSettlementProtectionService } from '../../services/teamSettlementProtectionService';
import { teamService } from '../../services/teamService';
import { manpowerService } from '../../services/manpowerService';
import { rememberSupportManagementYearMonth } from '../../utils/supportManagementState';
import type { UtilityRecord } from '../../types/accommodation';
import { buildAccommodationLedgerWorkbook, downloadAccommodationWorkbook } from '../../utils/accommodationExcelExport';

jest.mock('../../utils/accommodationExcelExport', () => ({
  buildAccommodationLedgerWorkbook: jest.fn(() => ({})), downloadAccommodationWorkbook: jest.fn(),
}));

// No Firebase initialization or AI imports are permitted in this component suite.
jest.mock('../../config/firebase', () => { throw Error('Firebase forbidden'); });
jest.mock('./AccommodationElectricityBillImportModal', () => ({ __esModule: true, default: () => null }));
jest.mock('./QuickAssignmentModal', () => ({ __esModule: true, default: () => null }));
jest.mock('../support/SupportLedgerReview', () => ({ SupportLedgerReview: ({ reload }: { reload: () => Promise<void> }) => <button onClick={() => { void reload(); }}>fixture reload</button> }));
jest.mock('../../constants/iconMap', () => ({ iconMap: {} }));
jest.mock('../../services/accommodationService', () => ({ accommodationService: {
  getAccommodations: jest.fn(), getMonthlyLedger: jest.fn(), listAllUtilityRecords: jest.fn(),
  saveUtilityRecords: jest.fn(), saveUtilityRecord: jest.fn(), replaceUtilityRecord: jest.fn(), deleteUtilityRecord: jest.fn(),
} }));
jest.mock('../../services/accommodationAssignmentService', () => ({ accommodationAssignmentService: { getAllAssignments: jest.fn() } }));
jest.mock('../../services/accommodationBillingTargetService', () => ({ accommodationBillingTargetService: { listTargets: jest.fn() } }));
jest.mock('../../services/accommodationBillingService', () => ({
  accommodationBillingService: { getBillingDocuments: jest.fn(), buildBillingDocumentId: () => 'fixture-billing' },
  isDraftAccommodationBillingStatus: (status: string) => status === 'draft',
  isProtectedAccommodationBillingStatus: (status: string) => status !== 'draft' && status !== 'cancelled',
}));
jest.mock('../../services/accommodationUtilityBillingAtomicService', () => ({
  accommodationUtilityBillingAtomicService: { reconcileRecord: jest.fn() },
  isAccommodationUtilityBillingAtomicProtectionError: () => false,
}));
jest.mock('../../services/teamSettlementProtectionService', () => ({ teamSettlementProtectionService: {
  getConfirmedTeamSettlementKeys: jest.fn(), isConfirmedTarget: () => false,
} }));
jest.mock('../../services/teamService', () => ({ teamService: { getTeams: jest.fn() } }));
jest.mock('../../services/manpowerService', () => ({ manpowerService: { getWorkers: jest.fn() } }));

const row = (yearMonth = '2026-07', name = '시험숙소'): UtilityRecord => ({
  id: `fixture-${yearMonth}`, accommodationId: 'fixture-accommodation', accommodationName: name, yearMonth,
  costs: { rent: 0, electricity: 0, gas: 0, water: 0, internet: 0, maintenance: 0, other: 0, total: 0 },
  paymentStatus: 'unpaid', memo: '',
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const load = jest.mocked(accommodationService.getMonthlyLedger);
const save = jest.mocked(accommodationService.saveUtilityRecords);
let stored: UtilityRecord[];
let alertSpy: jest.SpyInstance;
let errorSpy: jest.SpyInstance;
beforeEach(() => {
  jest.mocked(buildAccommodationLedgerWorkbook).mockClear();
  jest.mocked(downloadAccommodationWorkbook).mockReset().mockResolvedValue(undefined);
  stored = [];
  sessionStorage.setItem('cy.support-management.year-month', '2026-07');
  alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => undefined);
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  jest.spyOn(window, 'confirm').mockReturnValue(true);
  jest.mocked(accommodationService.getAccommodations).mockResolvedValue([]);
  jest.mocked(teamService.getTeams).mockResolvedValue([]);
  jest.mocked(manpowerService.getWorkers).mockResolvedValue([]);
  jest.mocked(accommodationAssignmentService.getAllAssignments).mockResolvedValue([]);
  jest.mocked(accommodationBillingTargetService.listTargets).mockResolvedValue([]);
  jest.mocked(accommodationBillingService.getBillingDocuments).mockResolvedValue([]);
  jest.mocked(teamSettlementProtectionService.getConfirmedTeamSettlementKeys).mockResolvedValue({ teamIds: new Set(), teamNames: new Set() });
  load.mockResolvedValue([row()]);
  jest.mocked(accommodationService.listAllUtilityRecords).mockImplementation(async () => stored);
  save.mockImplementation(async (rows) => { stored = rows as UtilityRecord[]; });
  jest.mocked(accommodationService.saveUtilityRecord).mockResolvedValue(undefined);
  jest.mocked(accommodationUtilityBillingAtomicService.reconcileRecord).mockResolvedValue({ action: 'cleared', deletedDocumentIds: [], savedDocumentIds: [] } as never);
});
afterEach(() => { cleanup(); jest.restoreAllMocks(); });
// Flush the month effect and its asynchronous load without waiting on intentionally pending fixtures.
// eslint-disable-next-line testing-library/no-unnecessary-act
async function mount() { await act(async () => { render(<UtilityLedger />); }); }
function saveButton() { return screen.getByRole('button', { name: /^저장$/ }); }
// React suppresses events on disabled controls even if their DOM attribute is removed.
// Invoke the actual rendered callback to prove the handler, not just that UI suppression.
async function forceSave(button = saveButton()) {
  const key = Object.keys(button).find(key => key.startsWith('__reactProps$'))!;
  await act(async () => { await (button as any)[key].onClick(); });
}
function expectNoWrites() {
  expect(save).not.toHaveBeenCalled();
  expect(accommodationService.saveUtilityRecord).not.toHaveBeenCalled();
  expect(accommodationService.replaceUtilityRecord).not.toHaveBeenCalled();
  expect(accommodationService.deleteUtilityRecord).not.toHaveBeenCalled();
  expect(accommodationUtilityBillingAtomicService.reconcileRecord).not.toHaveBeenCalled();
}

it('reports a post-commit snapshot failure as saved, never as a failed ledger save', async () => {
  await mount();
  jest.mocked(accommodationService.listAllUtilityRecords).mockResolvedValueOnce([]).mockRejectedValueOnce(Error('refresh refused'));
  await forceSave();
  expect(save).toHaveBeenCalledTimes(1);
  expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('대장은 저장되었지만'));
  expect(alertSpy).not.toHaveBeenCalledWith(expect.stringContaining('저장에 실패했습니다'));
  expect(saveButton()).toBeDisabled();
});

it('allows a successful empty monthly load', async () => {
  load.mockResolvedValue([]);
  await mount();
  expect(saveButton()).toBeEnabled();
  await forceSave();
  expect(save).toHaveBeenCalledWith([]);
  expect(alertSpy).toHaveBeenCalledWith('저장되었습니다.');
});

it('preserves legitimate new draft input with no saved records through normal save and billing reconciliation', async () => {
  await mount();
  fireEvent.change(screen.getByPlaceholderText('월별 메모 입력'), { target: { value: '신규 월별 초안' } });
  load.mockImplementation(async () => stored);
  await forceSave();
  expect(save).toHaveBeenCalledTimes(1);
  expect(save).toHaveBeenCalledWith([expect.objectContaining({ yearMonth: '2026-07', memo: '신규 월별 초안', billingSyncPending: true })]);
  expect(accommodationUtilityBillingAtomicService.reconcileRecord).toHaveBeenCalledTimes(1);
  expect(accommodationService.saveUtilityRecord).toHaveBeenCalledWith(expect.objectContaining({ billingSyncPending: false }));
  expect(screen.getByDisplayValue('신규 월별 초안')).toBeInTheDocument();
  expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('저장하고 팀별 경비에 자동 반영했습니다.'));
});

it('denies forced saves after the new month fails and keeps the existing draft', async () => {
  await mount();
  fireEvent.change(screen.getByPlaceholderText('월별 메모 입력'), { target: { value: '실패해도 보존' } });
  load.mockRejectedValueOnce(Error('current refusal'));
  await act(async () => { rememberSupportManagementYearMonth('2026-08'); });
  await forceSave();
  expectNoWrites();
  expect(saveButton()).toBeDisabled();
  expect(screen.getByDisplayValue('실패해도 보존')).toBeInTheDocument();
});

it('revokes the old success token during a same-month reload and preserves draft on failure', async () => {
  await mount();
  fireEvent.change(screen.getByPlaceholderText('월별 메모 입력'), { target: { value: '같은 월 초안' } });
  const next = deferred<UtilityRecord[]>();
  load.mockReturnValueOnce(next.promise);
  fireEvent.click(screen.getByText('fixture reload'));
  await forceSave();
  expectNoWrites();
  expect(saveButton()).toBeDisabled();
  await act(async () => { next.reject(Error('same month refusal')); });
  await forceSave();
  expectNoWrites();
  expect(screen.getByDisplayValue('같은 월 초안')).toBeInTheDocument();
});

it('keeps final reload failure separate from successful ledger and billing persistence', async () => {
  await mount();
  load.mockRejectedValueOnce(Error('final reload refused'));
  await forceSave();
  expect(save).toHaveBeenCalledTimes(1);
  expect(accommodationUtilityBillingAtomicService.reconcileRecord).toHaveBeenCalledTimes(1);
  expect(alertSpy).not.toHaveBeenCalledWith(expect.stringContaining('저장에 실패했습니다'));
  expect(saveButton()).toBeDisabled();
});

it('rechecks the load generation after asynchronous save preflight before any write', async () => {
  await mount();
  const preflight = deferred<{ teamIds: Set<string>; teamNames: Set<string> }>();
  jest.mocked(teamSettlementProtectionService.getConfirmedTeamSettlementKeys).mockReturnValueOnce(preflight.promise);
  fireEvent.click(saveButton());
  await waitFor(() => expect(teamSettlementProtectionService.getConfirmedTeamSettlementKeys).toHaveBeenCalledTimes(1));
  load.mockResolvedValue([row('2026-08')]);
  act(() => rememberSupportManagementYearMonth('2026-08'));
  await act(async () => { preflight.resolve({ teamIds: new Set(), teamNames: new Set() }); });
  expectNoWrites();
});

it('refuses out-of-month saved candidates returned by save preflight', async () => {
  await mount();
  stored = [row('2026-06', '잘못된후보')];
  await forceSave();
  expectNoWrites();
});

it('rejects a ledger containing even one row outside the successfully loaded month', async () => {
  load.mockResolvedValue([row(), row('2026-06', '다른월숙소')]);
  await mount();
  await forceSave();
  expectNoWrites();
  expect(saveButton()).toBeDisabled();
});

it.each([false, true])('revokes the old handler synchronously on month navigation (round trip: %s)', async (roundTrip) => {
  await mount();
  const button = saveButton();
  const key = Object.keys(button).find(key => key.startsWith('__reactProps$'))!;
  const handler = (button as any)[key].onClick;
  await act(async () => {
    rememberSupportManagementYearMonth('2026-08');
    if (roundTrip) rememberSupportManagementYearMonth('2026-07');
    await handler();
  });
  expectNoWrites();
});

it.each(['success', 'failure'] as const)('ignores a late previous request %s after the current month succeeds', async (outcome) => {
  const old = deferred<UtilityRecord[]>();
  load.mockReturnValueOnce(old.promise);
  await mount();
  load.mockResolvedValue([row('2026-08', '현재숙소')]);
  act(() => rememberSupportManagementYearMonth('2026-08'));
  await screen.findByText('현재숙소');
  expect(saveButton()).toBeEnabled();
  await act(async () => {
    if (outcome === 'success') old.resolve([row('2026-07', '늦은숙소')]);
    else old.reject(Error('stale refusal'));
  });
  expect(screen.getByText('현재숙소')).toBeInTheDocument();
  expect(screen.queryByText('늦은숙소')).not.toBeInTheDocument();
  expect(saveButton()).toBeEnabled();
  expect(alertSpy).not.toHaveBeenCalled();
});

it('denies a forced save while the next month is pending, preserving the previous draft', async () => {
  await mount();
  const memo = screen.getByPlaceholderText('월별 메모 입력');
  fireEvent.change(memo, { target: { value: '보존할 초안' } });
  const pending = deferred<UtilityRecord[]>();
  load.mockReturnValueOnce(pending.promise);
  act(() => rememberSupportManagementYearMonth('2026-08'));
  await forceSave();
  expectNoWrites();
  expect(saveButton()).toBeDisabled();
  await act(async () => { pending.reject(Error('fixture denied')); });
  expect(screen.getByDisplayValue('보존할 초안')).toBeInTheDocument();
});

it('exports only visible rows and uses the same filtered rows for footer totals', async () => {
  const first = { ...row(), costs: { ...row().costs, rent: 1000, total: 1000 } };
  const second = { ...row('2026-07', '제외숙소'), id: 'second', accommodationId: 'second', costs: { ...row().costs, rent: 9000, total: 9000 } };
  load.mockResolvedValue([first, second]);
  const { rerender } = render(<UtilityLedger searchText="시험" />);
  await screen.findByText('시험숙소');
  expect(screen.getByRole('row', { name: /^합계/ })).toHaveTextContent('1,000');
  expect(screen.getByRole('row', { name: /^합계/ })).not.toHaveTextContent('10,000');
  fireEvent.click(screen.getByRole('button', { name: '엑셀 다운로드' }));
  await waitFor(() => expect(downloadAccommodationWorkbook).toHaveBeenCalledTimes(1));
  expect(buildAccommodationLedgerWorkbook).toHaveBeenCalledWith(expect.objectContaining({
    yearMonth: '2026-07', searchText: '시험', rows: [expect.objectContaining({ record: first })],
  }));
  expectNoWrites();
  rerender(<UtilityLedger searchText="없는숙소" />);
  expect(screen.getByRole('button', { name: '엑셀 다운로드' })).toBeDisabled();
  expect(screen.getByRole('row', { name: /^합계/ })).not.toHaveTextContent('1,000');
});

it('exports edited amounts and marks the workbook as unsaved without persisting them', async () => {
  await mount();
  const input = screen.getAllByPlaceholderText('0')[0];
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: '123000' } });
  fireEvent.blur(input);
  fireEvent.click(screen.getByRole('button', { name: '엑셀 다운로드' }));
  await waitFor(() => expect(downloadAccommodationWorkbook).toHaveBeenCalledTimes(1));
  expect(buildAccommodationLedgerWorkbook).toHaveBeenCalledWith(expect.objectContaining({
    hasUnsavedChanges: true,
    rows: [expect.objectContaining({ record: expect.objectContaining({ costs: expect.objectContaining({ rent: 123000, total: 123000 }) }) })],
  }));
  expectNoWrites();
});

it('blocks exports during loading and after a failed month change', async () => {
  const pending = deferred<UtilityRecord[]>();
  load.mockReturnValueOnce(pending.promise);
  await mount();
  expect(screen.getByRole('button', { name: '엑셀 다운로드' })).toBeDisabled();
  await act(async () => pending.resolve([row()]));
  expect(screen.getByRole('button', { name: '엑셀 다운로드' })).toBeEnabled();
  load.mockRejectedValueOnce(Error('fixture refusal'));
  await act(async () => rememberSupportManagementYearMonth('2026-08'));
  expect(screen.getByRole('button', { name: '엑셀 다운로드' })).toBeDisabled();
  expect(downloadAccommodationWorkbook).not.toHaveBeenCalled();
});

it('allows retrying an export after a download error', async () => {
  await mount();
  jest.mocked(downloadAccommodationWorkbook).mockRejectedValueOnce(Error('fixture export failure'));
  fireEvent.click(screen.getByRole('button', { name: '엑셀 다운로드' }));
  await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('엑셀 다운로드에 실패했습니다. 다시 시도해 주세요.'));
  expect(screen.getByRole('button', { name: '엑셀 다운로드' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: '엑셀 다운로드' }));
  await waitFor(() => expect(downloadAccommodationWorkbook).toHaveBeenCalledTimes(2));
  expectNoWrites();
});
