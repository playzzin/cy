/**
 * DRAFT ONLY — not executed, not a valid failing-test record yet.
 * Run only after evidence/ui-integration/HANDOFF.ko.md boundary approval.
 * Full VehicleMonthlyLedger + SupportSaveFeedback JSX, real coordinator and
 * real monthly billing helper; virtual transport/SDK/icons/import modals.
 * buildBillingDocumentId and Timestamp are TEST DOUBLES: no real builder/SDK
 * interoperability, financial persistence, browser CSS or end-to-end claim.
 * No extracted-hook substitute and no product UI implementation in this task.
 */
import React from 'react';
import { Timestamp } from 'firebase/firestore';
import { manpowerService } from '../../services/manpowerService';
import { officeStaffService } from '../../services/officeStaffService';
import { render, screen, fireEvent, waitFor, within, cleanup, act } from '@testing-library/react';
import { VehicleMonthlyLedger } from './VehicleMonthlyLedger';
import { vehicleService } from '../../services/vehicleService';
import { vehicleBillingService, isPostedVehicleBillingStatus } from '../../services/vehicleBillingService';
import { vehicleMonthlyLedgerMutationService } from '../../services/vehicleMonthlyLedgerMutationService';
import { teamSettlementProtectionService } from '../../services/teamSettlementProtectionService';
import { saveVehicleMonthlyLedgerWithBilling } from '../../services/vehicleMonthlyLedgerSaveCoordinator';
import type { Vehicle, VehicleExpenseRecord } from '../../types/vehicle';
import type { VehicleBillingDocument } from '../../types/vehicleBilling';
import { SUPPORT_WRITE_RETRY_USER_MESSAGE } from '../../utils/supportWriteErrorReporting';

jest.mock('../../services/vehicleService', () => ({ vehicleService: {
  getExpensesByMonth: jest.fn(), listAllVehicleAssignments: jest.fn(),
  listAllVehicleBillingTargets: jest.fn(),
  getExpensesByVehicle: jest.fn(() => { throw new Error('unapproved vehicle read'); }),
  applyVehicleExpenseChanges: jest.fn(() => { throw new Error('unapproved fine correction'); })
} }));
jest.mock('../../services/vehicleBillingService', () => ({
  isPostedVehicleBillingStatus: jest.fn(),
  vehicleBillingService: {
    getBillingsByMonth: jest.fn(), replaceMonthlyLedgerDrafts: jest.fn(),
    // Explicit fake identity, NOT a copy/verification of the real ID builder.
    buildBillingDocumentId: jest.fn(({ vehicleId }: { vehicleId: string }) => `TEST-ONLY-${vehicleId}`)
  }
}));
jest.mock('../../services/vehicleMonthlyLedgerMutationService', () => ({
  vehicleMonthlyLedgerMutationService: { saveMonthlyLedger: jest.fn() }
}));
jest.mock('../../services/teamSettlementProtectionService', () => ({
  teamSettlementProtectionService: {
    getConfirmedTeamSettlementKeys: jest.fn(),
    isConfirmedTarget: jest.fn(() => false)
  }
}));
jest.mock('../../services/manpowerService', () => ({ manpowerService: {
  getWorkers: jest.fn(async () => [])
} }));
jest.mock('../../services/officeStaffService', () => ({ officeStaffService: {
  getOfficeStaff: jest.fn(async () => [])
} }));
jest.mock('../../services/teamService', () => ({}));
jest.mock('firebase/firestore', () => ({
  Timestamp: { now: jest.fn() }, FieldValue: class FieldValue {}
}));
jest.mock('@fortawesome/react-fontawesome', () => ({ FontAwesomeIcon: () => null }));
jest.mock('@fortawesome/free-solid-svg-icons', () => ({
  faBuilding: {}, faCar: {}, faChevronLeft: {}, faChevronRight: {},
  faFileInvoiceDollar: {}, faSave: {}, faExclamationTriangle: {}, faUsers: {}, faUser: {}
}));
jest.mock('lucide-react', () => ({ Route: () => null, Sparkles: () => null, TriangleAlert: () => null }));
jest.mock('../../constants/iconMap', () => ({ iconMap: {} }));
jest.mock('./VehicleFineImportModal', () => ({ __esModule: true, default: () => null }));
jest.mock('./VehicleTollImportModal', () => ({ __esModule: true, default: () => null }));
jest.mock('../../services/vehicleMonthlyLedgerSaveCoordinator', () => {
  const actual = jest.requireActual<typeof import('../../services/vehicleMonthlyLedgerSaveCoordinator')>(
    '../../services/vehicleMonthlyLedgerSaveCoordinator'
  );
  return { ...actual, saveVehicleMonthlyLedgerWithBilling: jest.fn(actual.saveVehicleMonthlyLedgerWithBilling) };
});

const coordinator = jest.mocked(saveVehicleMonthlyLedgerWithBilling);
const expenses = jest.mocked(vehicleService.getExpensesByMonth);
const billings = jest.mocked(vehicleBillingService.getBillingsByMonth);
const ledger = jest.mocked(vehicleMonthlyLedgerMutationService.saveMonthlyLedger);
const replacement = jest.mocked(vehicleBillingService.replaceMonthlyLedgerDrafts);
const settlements = jest.mocked(teamSettlementProtectionService.getConfirmedTeamSettlementKeys);
const confirmed = jest.mocked(teamSettlementProtectionService.isConfirmedTarget);
const vehicle = (id: string): Vehicle => ({
  id, licensePlate: `TEST-${id}`, model: 'SYNTHETIC', type: 'RENT', status: 'AVAILABLE',
  currentAssigneeId: `team-${id}`, currentAssigneeName: `TEST-TEAM-${id}`, currentAssigneeType: 'TEAM',
  contract: { type: 'RENT', startDate: '2026-01-01', endDate: '2026-12-31',
    deposit: 0, monthlyFee: 100, paymentDay: 1, financeCompany: { name: '', contact: '' } }
});
const receipt = {
  operationId: 'TEST-ONLY-ACK', upsertedExpenseCount: 0, cancelledExpenseCount: 0,
  expenseUpsertIds: [], expenseCancelIds: []
};
let acknowledged = false;
let successfulExpenseReads = 0;
let successfulBillingReads = 0;
let successfulAssignmentReads = 0;
let successfulTargetReads = 0;
let snapshotFailure = false;
let failedReplacementVehicle = '';
let stored: VehicleExpenseRecord[] = [];
let documents: VehicleBillingDocument[] = [];

// Test-only epoch instance contract. The virtual SDK remains closed; no SDK JS runs.
// Signatures follow @firebase/firestore/dist/index.d.ts Timestamp declaration.
class TestEpochTimestamp implements Timestamp {
  readonly seconds: number = 0;
  readonly nanoseconds: number = 0;

  toDate(): Date { return new Date(this.toMillis()); }
  toMillis(): number { return this.seconds * 1000 + this.nanoseconds / 1e6; }
  isEqual(other: Timestamp): boolean {
    return this.seconds === other.seconds && this.nanoseconds === other.nanoseconds;
  }
  toString(): string {
    return `Timestamp(seconds=${this.seconds}, nanoseconds=${this.nanoseconds})`;
  }
  toJSON(): ReturnType<Timestamp['toJSON']> {
    return { seconds: this.seconds, nanoseconds: this.nanoseconds, type: 'firestore/timestamp/1.0' };
  }
  valueOf(): string {
    // Official sortable representation offsets the minimum supported UTC second.
    return `${String(this.seconds + 62135596800).padStart(12, '0')}.${String(this.nanoseconds).padStart(9, '0')}`;
  }
}

function expectEpochFixtureContract() {
  // Direct fixture checks do not call SDK mocks or change service call counts.
  const epoch = new TestEpochTimestamp();
  expect([epoch.seconds, epoch.nanoseconds, epoch.toMillis()]).toEqual([0, 0, 0]);
  expect(epoch.toDate().toISOString()).toBe('1970-01-01T00:00:00.000Z');
  const date = epoch.toDate();
  date.setTime(1000);
  expect(epoch.toDate().getTime()).toBe(0);
  expect(epoch.isEqual(new TestEpochTimestamp())).toBe(true);
  const nextSecond = new (class extends TestEpochTimestamp { readonly seconds = 1; })();
  const nextNanosecond = new (class extends TestEpochTimestamp { readonly nanoseconds = 1; })();
  expect(epoch.isEqual(nextSecond)).toBe(false);
  expect(epoch.isEqual(nextNanosecond)).toBe(false);
  expect(epoch.toString()).toBe('Timestamp(seconds=0, nanoseconds=0)');
  expect(epoch.toJSON()).toEqual({ seconds: 0, nanoseconds: 0, type: 'firestore/timestamp/1.0' });
  expect(JSON.stringify(epoch)).toBe(JSON.stringify(epoch.toJSON()));
  expect(epoch.valueOf()).toBe('062135596800.000000000');
  expect(epoch.valueOf() < nextNanosecond.valueOf()).toBe(true);
  expect(nextNanosecond.valueOf() < nextSecond.valueOf()).toBe(true);
}

beforeEach(() => {
  expectEpochFixtureContract();
  jest.clearAllMocks();
  const actual = jest.requireActual<typeof import('../../services/vehicleMonthlyLedgerSaveCoordinator')>(
    '../../services/vehicleMonthlyLedgerSaveCoordinator'
  );
  coordinator.mockImplementation(actual.saveVehicleMonthlyLedgerWithBilling);
  jest.mocked(Timestamp.now).mockImplementation(() => new TestEpochTimestamp());
  jest.mocked(vehicleBillingService.buildBillingDocumentId).mockImplementation(({ vehicleId }) => `TEST-ONLY-${vehicleId}`);
  jest.mocked(isPostedVehicleBillingStatus).mockImplementation((status: Parameters<typeof isPostedVehicleBillingStatus>[0]) =>
    typeof status === 'string' && ['CONFIRMED', 'PAID', 'OVERDUE'].includes(status.trim().toUpperCase()));
  jest.mocked(manpowerService.getWorkers).mockImplementation(async () => []);
  jest.mocked(officeStaffService.getOfficeStaff).mockImplementation(async () => []);
  jest.mocked(vehicleService.getExpensesByVehicle).mockImplementation(() => { throw new Error('unapproved vehicle read'); });
  jest.mocked(vehicleService.applyVehicleExpenseChanges).mockImplementation(() => { throw new Error('unapproved fine correction'); });
  acknowledged = false;
  successfulExpenseReads = successfulBillingReads = successfulAssignmentReads = successfulTargetReads = 0;
  snapshotFailure = false;
  failedReplacementVehicle = '';
  stored = [];
  documents = [];
  window.sessionStorage.setItem('cy.support-management.year-month', '2026-09');
  expenses.mockImplementation(async () => {
    if (acknowledged && snapshotFailure) { snapshotFailure = false; throw new Error('TEST snapshot read failure'); }
    successfulExpenseReads += 1;
    return stored;
  });
  billings.mockImplementation(async () => { successfulBillingReads += 1; return documents; });
  jest.mocked(vehicleService.listAllVehicleAssignments).mockImplementation(async () => {
    successfulAssignmentReads += 1; return [];
  });
  jest.mocked(vehicleService.listAllVehicleBillingTargets).mockImplementation(async () => {
    successfulTargetReads += 1; return [];
  });
  settlements.mockImplementation(async () => ({ teamIds: new Set<string>(), teamNames: new Set<string>() }));
  confirmed.mockImplementation(() => false);
  ledger.mockImplementation(async () => { acknowledged = true; return receipt; });
  replacement.mockImplementation(async ({ desiredDocuments }) => {
    if (desiredDocuments.some(doc => doc.vehicleId === failedReplacementVehicle)) throw new Error('TEST row failure');
    return { savedIds: desiredDocuments.map(doc => doc.id), deletedDraftIds: [] };
  });
});
afterEach(() => { cleanup(); window.sessionStorage.clear(); });

async function ready(vehicles: Vehicle[] = [vehicle('A')]) {
  render(<VehicleMonthlyLedger vehicles={vehicles} teams={[]} loadingVehicles={false} />);
  expect(await screen.findByText(vehicles[0].licensePlate)).toBeTruthy();
  await waitFor(() => expect([
    successfulExpenseReads, successfulBillingReads, successfulAssignmentReads, successfulTargetReads
  ].every(count => count > 0)).toBe(true));
  expect(screen.queryByText('데이터를 불러오는 중입니다...')).toBeNull();
  expect(screen.queryByRole('columnheader', { name: /메모/ })).toBeNull();
}
function editAmount(id = 'A') {
  // eslint-disable-next-line testing-library/no-node-access -- Verify the structural layout or hidden upload input directly.
  const row = screen.getByText(`TEST-${id}`).closest('tr');
  if (!row) throw new Error('fixture row absent');
  const inputs = within(row).getAllByRole('textbox');
  fireEvent.change(inputs[0], { target: { value: '25' } });
  fireEvent.blur(inputs[0]);
  expect(screen.getByText('● 수정사항 있음')).toBeTruthy();
}
async function save() {
  fireEvent.click(screen.getByRole('button', { name: /^저장$/ }));
  await waitFor(() => expect(screen.queryByRole('button', { name: '저장 중...' })).toBeNull());
}
function resolvedReadCounts() {
  return [successfulExpenseReads, successfulBillingReads, successfulAssignmentReads, successfulTargetReads];
}
function expectResolvedRefresh(previous: number[]) {
  resolvedReadCounts().forEach((count, index) => expect(count).toBeGreaterThan(previous[index]));
  expect(screen.queryByText('데이터를 불러오는 중입니다...')).toBeNull();
  expect(screen.getByText('TEST-A')).toBeTruthy();
}
function noCompleteNotice() {
  expect(screen.queryByText('저장 및 팀 경비 반영 완료')).toBeNull();
}

it('successful reads: full real screen delegates once and preserves normal completion feedback', async () => {
  await ready();
  const previousReads = resolvedReadCounts();
  editAmount();
  await save();
  expect(coordinator).toHaveBeenCalledTimes(1); // baseline lacks wiring: intended valid failure
  expect(ledger).toHaveBeenCalledTimes(1);
  expect(billings).toHaveBeenCalledWith('2026-09', { throwOnError: true });
  expectResolvedRefresh(previousReads);
  expect(screen.getByText('저장 및 팀 경비 반영 완료')).toBeTruthy();
  expect(screen.getByText('1대의 저장된 금액을 팀별 경비에 반영했습니다.')).toBeTruthy();
  expect(screen.queryByText('● 수정사항 있음')).toBeNull();
  expect(screen.queryByText(/팀 경비 재시도/)).toBeNull();
  expect(replacement).toHaveBeenCalledTimes(1);
  expect(replacement.mock.calls[0][0].desiredDocuments[0]).toMatchObject({
    vehicleId: 'A', totalAmount: 100, status: 'DRAFT',
    lineItems: [expect.objectContaining({ sourceType: 'vehicle_ledger', amount: 100 })]
  });
});

it('partial snapshot response preserves ledger acknowledgement and forbids total completion', async () => {
  await ready(); editAmount();
  const previousReads = resolvedReadCounts();
  snapshotFailure = true;
  await save();
  expect(coordinator).toHaveBeenCalledTimes(1);
  await expect(coordinator.mock.results[0].value).resolves.toMatchObject({
    status: 'partial', ledgerStatus: 'acknowledged', billingStatus: 'snapshot-failed', ledgerResult: receipt
  });
  expect(screen.getByText('대장은 저장됐지만 팀 경비 반영에 실패했습니다.')).toBeTruthy();
  expect(screen.getByText('대장 금액은 저장되어 있습니다. 중복되지 않으니 저장을 다시 눌러 팀별 경비 반영을 재시도해 주세요.')).toBeTruthy();
  expect(screen.getByText('팀 경비 재시도 1건')).toBeTruthy();
  expect(screen.queryByText('● 수정사항 있음')).toBeNull();
  expect(replacement).not.toHaveBeenCalled();
  expectResolvedRefresh(previousReads); // actual resolved refresh, not catch
  noCompleteNotice();
});

it('successful snapshot with row failure and newly protected row retains existing count and retry display', async () => {
  await ready([vehicle('A'), vehicle('B'), vehicle('C')]);
  failedReplacementVehicle = 'B';
  confirmed.mockImplementation((_keys, target) => acknowledged && target.teamId === 'team-C');
  const previousReads = resolvedReadCounts();
  await save();
  expect(coordinator).toHaveBeenCalledTimes(1);
  await expect(coordinator.mock.results[0].value).resolves.toMatchObject({
    billingStatus: 'rows-partial', syncedCount: 1,
    failedRowIds: ['B:snapshot-B'], newlyProtectedRowIds: ['C:snapshot-C']
  });
  expect(screen.getByText('대장은 저장됐지만 팀 경비 확인이 필요합니다.')).toBeTruthy();
  expect(screen.getByText(/반영 실패 1대, 보호·수기 확인 1대/)).toBeTruthy();
  expect(screen.getByText('팀 경비 재시도 2건')).toBeTruthy();
  expectResolvedRefresh(previousReads);
  expect(replacement).toHaveBeenCalledTimes(2);
  noCompleteNotice();
});

it('dirty preflight settlement protection keeps coordinator and ledger uncalled', async () => {
  await ready(); editAmount();
  confirmed.mockImplementation(() => true);
  await save();
  expect(screen.getByText('저장을 중단했습니다.')).toBeTruthy();
  expect(screen.getByText(/해당 팀의 2026-09 정산이 이미 확정되어 변경할 수 없습니다/)).toBeTruthy();
  expect(coordinator).not.toHaveBeenCalled();
  expect(ledger).not.toHaveBeenCalled();
  expect(replacement).not.toHaveBeenCalled();
  expect(screen.getByText('● 수정사항 있음')).toBeTruthy();
  noCompleteNotice();
});

it('preflight target validation remains ahead of coordinator', async () => {
  const unassigned = vehicle('A');
  delete unassigned.currentAssigneeId; delete unassigned.currentAssigneeName; delete unassigned.currentAssigneeType;
  await ready([unassigned]); editAmount(); await save();
  expect(screen.getByText(/청구대상을 먼저 지정해 주세요/)).toBeTruthy();
  expect(coordinator).not.toHaveBeenCalled();
  expect(ledger).not.toHaveBeenCalled();
  noCompleteNotice();
});

it('strict preflight read rejection is not treated as successful empty query', async () => {
  await ready(); editAmount();
  billings.mockRejectedValueOnce(new Error('TEST strict read failure'));
  await save();
  expect(billings).toHaveBeenCalledWith('2026-09', { throwOnError: true });
  expect(screen.getByText('저장 실패')).toBeTruthy();
  expect(screen.getByText(SUPPORT_WRITE_RETRY_USER_MESSAGE)).toBeTruthy();
  expect(coordinator).not.toHaveBeenCalled();
  expect(ledger).not.toHaveBeenCalled();
  expect(replacement).not.toHaveBeenCalled();
  noCompleteNotice();
});

// Existing contract regression; no intentional product failure and no real commit claim.
it('ledger rejection preserves the original error, failure feedback and zero post-ledger work', async () => {
  await ready(); editAmount();
  const originalError = new Error('TEST ledger rejection');
  let readsAtLedger: number[] = [];
  ledger.mockImplementationOnce(async () => {
    readsAtLedger = [expenses.mock.calls.length, billings.mock.calls.length,
      settlements.mock.calls.length, jest.mocked(vehicleService.listAllVehicleAssignments).mock.calls.length,
      jest.mocked(vehicleService.listAllVehicleBillingTargets).mock.calls.length];
    throw originalError;
  });
  await save();
  expect(coordinator).toHaveBeenCalledTimes(1);
  expect(ledger).toHaveBeenCalledTimes(1);
  await expect(coordinator.mock.results[0].value).rejects.toBe(originalError);
  expect(readsAtLedger).toHaveLength(5);
  expect([expenses.mock.calls.length, billings.mock.calls.length,
    settlements.mock.calls.length, jest.mocked(vehicleService.listAllVehicleAssignments).mock.calls.length,
    jest.mocked(vehicleService.listAllVehicleBillingTargets).mock.calls.length]).toEqual(readsAtLedger);
  expect(replacement).not.toHaveBeenCalled();
  expect(vehicleService.getExpensesByVehicle).not.toHaveBeenCalled();
  expect(vehicleService.applyVehicleExpenseChanges).not.toHaveBeenCalled();
  expect(screen.getByText('저장 실패')).toBeTruthy();
  expect(screen.getByText(SUPPORT_WRITE_RETRY_USER_MESSAGE)).toBeTruthy();
  expect(screen.getByText('● 수정사항 있음')).toBeTruthy();
  noCompleteNotice();
  expect(screen.queryByText('대장은 저장됐지만 팀 경비 반영에 실패했습니다.')).toBeNull();
  expect(screen.queryByText('대장은 저장됐지만 팀 경비 확인이 필요합니다.')).toBeNull();
  expect(screen.queryByText('대장 금액은 저장되어 있습니다. 중복되지 않으니 저장을 다시 눌러 팀별 경비 반영을 재시도해 주세요.')).toBeNull();
  expect(screen.queryByText(/팀 경비 재시도/)).toBeNull();
});
