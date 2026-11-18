import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { TeamSettlementPage } from './TeamSettlementPage';
import { teamSettlementService } from '../../services/teamSettlementService';
import type { TeamSettlementDeductionItem, TeamSettlementDocument } from '../../types/teamSettlement';
import { teamService } from '../../services/teamService';
import { companyService } from '../../services/companyService';
import { teamExpenseCategoryService } from '../../services/teamExpenseCategoryService';
import { useTeamSettlementAccess } from '../../hooks/useTeamSettlementAccess';

jest.mock('../../hooks/useTeamSettlementAccess', () => ({ useTeamSettlementAccess: jest.fn() }));

jest.mock('../../components/common/CompanyTeamSelector', () => ({ __esModule: true, default: () => null, readCompanyTeamOrder: () => [] }));
jest.mock('../../services/teamService', () => ({ teamService: { getTeams: jest.fn().mockResolvedValue([{ id: 'own', name: '조회팀', companyId: 'company', type: '시공팀' }]) } }));
jest.mock('../../services/companyService', () => ({ companyService: { getCompaniesByType: jest.fn().mockResolvedValue([{ id: 'company', name: '시공사' }]) } }));
// The leader's ordinary report query has no visiting workers or other teams.
jest.mock('../../services/dailyReportService', () => ({ dailyReportService: { getReportWorkerRowsByRange: jest.fn().mockResolvedValue([]), getWorkerRows: jest.fn().mockResolvedValue([]) } }));
jest.mock('../../services/dailyAdvanceWorkbookProfileService', () => ({ dailyAdvanceWorkbookProfileService: { getProfiles: async () => [] } }));
jest.mock('../../services/dailyAdvanceStatementRecruiterFeeService', () => ({ dailyAdvanceStatementRecruiterFeeService: { getFeesByMonth: async () => [], subscribeFeesByMonth: () => () => {} } }));
jest.mock('../../services/storageService', () => ({ storageService: {} }));
jest.mock('html2canvas', () => jest.fn());
jest.mock('../../services/teamSettlementService', () => ({ teamSettlementService: {
  getTeamSettlement: jest.fn(), getTeamDisplayOrder: jest.fn().mockResolvedValue([]),
  getSupportRateOverrides: jest.fn().mockResolvedValue({}), getSupportSettlementDetailRows: jest.fn().mockResolvedValue([]),
  saveTeamSettlement: jest.fn(), recalculateAndSaveTeamSettlement: jest.fn()
} }));
jest.mock('../../services/laborExchangeService', () => ({ laborExchangeService: { getMonthSnapshotInfo: jest.fn().mockResolvedValue(null), getExchangeReport: jest.fn().mockResolvedValue([]) } }));
jest.mock('../../services/supportRateService', () => ({ supportRateService: { getAllSiteRates: jest.fn().mockResolvedValue([]) } }));
jest.mock('../../services/accommodationBillingService', () => ({ accommodationBillingService: { getBillingDocuments: jest.fn().mockResolvedValue([]) } }));
jest.mock('../../services/accommodationAssignmentService', () => ({ accommodationAssignmentService: { getAllAssignments: jest.fn().mockResolvedValue([]) } }));
jest.mock('../../services/accommodationService', () => ({ accommodationService: { getMonthlyLedger: jest.fn().mockResolvedValue([]) } }));
jest.mock('../../services/vehicleBillingService', () => ({ vehicleBillingService: { getBillingsByMonth: jest.fn().mockResolvedValue([]) } }));
jest.mock('../../services/vehicleService', () => ({ vehicleService: { getVehicles: jest.fn().mockResolvedValue([]), getExpensesByMonth: jest.fn().mockResolvedValue([]) } }));
jest.mock('../../services/cardBillingService', () => ({ cardBillingService: { getBillingsByMonth: jest.fn().mockResolvedValue([]) } }));
jest.mock('../../services/cardService', () => ({ cardService: { getCards: jest.fn().mockResolvedValue([]), getTransactionsByMonth: jest.fn().mockResolvedValue([]) } }));
jest.mock('../../services/teamExpenseLedgerService', () => ({ teamExpenseLedgerService: { getClaimsByMonth: jest.fn().mockResolvedValue([]) } }));
jest.mock('../../services/teamExpenseCategoryService', () => ({ teamExpenseCategoryService: { getCategories: jest.fn() } }));
jest.mock('../../services/manpowerService', () => ({ manpowerService: { getWorkers: jest.fn().mockResolvedValue([]) } }));
jest.mock('../../services/officeService', () => ({ officeService: {} }));
jest.mock('../../utils/swal', () => ({ toast: { error: jest.fn(), success: jest.fn(), warning: jest.fn() } }));
jest.mock('sweetalert2', () => ({ fire: jest.fn() }));

const document = (): TeamSettlementDocument => ({
  teamId: 'own', teamName: '조회팀', yearMonth: '2026-08', sales: [],
  purchases: [{ id: 'purchase', source: 'auto', kind: '지원', origin: '내부지원온곳',
    siteId: 'site', siteName: '담당 현장', counterTeamId: 'visitor', counterTeamName: '지원 방문팀', manDay: 2, amount: 540000 }],
  deductions: [], additions: [], summary: { prevCarryover: 0, deposit: 0 },
  confirmedAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z',
  sourceSnapshot: { version: 2, capturedAt: '2026-09-01T00:00:00.000Z', dailyReports: [], supportDetails: [],
    totals: { sales: 0, purchases: 540000, deductions: 0, additions: 0, net: -540000 } }
});

it('CEO 새로고침은 최신 일보 구분을 요청하고 정산 표를 도급에서 직영으로 갱신한다', async () => {
  const saved = document();
  saved.confirmedAt = null;
  saved.purchases = [];
  saved.sourceSnapshot = undefined;
  saved.sales = [{ id: 'contract', source: 'auto', origin: 'daily_report', kind: '도급',
    siteId: 'test-site', siteName: '구분 변경 검증 현장', manDay: 2, amount: 900000, amountOverridden: true }];
  jest.mocked(teamSettlementService.getTeamSettlement).mockResolvedValue(saved);
  render(<TeamSettlementPage />);
  const table = await screen.findByRole('table', { name: '도급/직영 매출' });
  const row = within(table).getByRole('row', { name: /구분 변경 검증 현장/ });
  expect(within(row).getByText('도급', { exact: true })).toBeVisible();
  expect(screen.getByText(/도급·직영 구분과 공수는 최신 일보 기준입니다/)).toBeVisible();
  jest.mocked(teamSettlementService.getTeamSettlement).mockResolvedValue({ ...saved,
    sales: [{ ...saved.sales[0], id: 'direct', kind: '직영' }]
  });
  fireEvent.click(screen.getByRole('button', { name: '새로고침' }));
  await waitFor(() => {
    const refreshed = within(screen.getByRole('table', { name: '도급/직영 매출' })).getByRole('row', { name: /구분 변경 검증 현장/ });
    expect(within(refreshed).getByText('직영', { exact: true })).toBeVisible();
  });
  expect(teamSettlementService.getTeamSettlement).toHaveBeenLastCalledWith(expect.objectContaining({ refreshDraft: true }));
  expect(teamSettlementService.recalculateAndSaveTeamSettlement).not.toHaveBeenCalled();
  expect(teamSettlementService.saveTeamSettlement).not.toHaveBeenCalled();
});
beforeAll(() => {
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
});
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useTeamSettlementAccess).mockReturnValue({ loading: false, canWrite: true });
  jest.mocked(teamExpenseCategoryService.getCategories).mockResolvedValue([]);
  localStorage.clear();
  for (const name of ['dailyReportService', 'laborExchangeService', 'supportRateService',
    'accommodationBillingService', 'accommodationAssignmentService', 'accommodationService',
    'vehicleBillingService', 'vehicleService', 'cardBillingService', 'cardService',
    'teamExpenseLedgerService', 'manpowerService', 'teamSettlementService']) {
    const service = require(`../../services/${name}`)[name];
    Object.values(service).forEach(method => (method as jest.Mock).mockResolvedValue([]));
  }
  jest.mocked(teamService.getTeams).mockResolvedValue([{ id: 'own', name: '조회팀', companyId: 'company', type: '시공팀' } as any]);
  jest.mocked(companyService.getCompaniesByType).mockResolvedValue([{ id: 'company', name: '시공사' } as any]);
  jest.mocked(teamSettlementService.getSupportRateOverrides).mockResolvedValue({} as any);
  jest.mocked(teamSettlementService.getTeamSettlement).mockResolvedValue(document());
  jest.mocked(teamSettlementService.getSupportSettlementDetailRows).mockResolvedValue([
    { id: 'first', direction: '내부지원온곳', date: '2026-08-03', siteId: 'site', siteName: '담당 현장',
      counterTeamId: 'visitor', counterTeamName: '지원 방문팀', workerId: 'worker-a', workerName: '방문 작업자 A',
      workerTeamId: 'visitor', workerTeamName: '지원 방문팀', manDay: 1.5, unitPrice: 230000, amount: 345000 },
    { id: 'second', direction: '내부지원온곳', date: '2026-08-03', siteId: 'site', siteName: '담당 현장',
      counterTeamId: 'visitor', counterTeamName: '지원 방문팀', workerId: 'worker-b', workerName: '방문 작업자 B',
      workerTeamId: 'visitor', workerTeamName: '지원 방문팀', manDay: 0.5, unitPrice: 230000, amount: 115000 }
  ]);
});

async function expandOriginalDetails(siteName: string) {
  fireEvent.click(await screen.findByRole('button', { name: /^상세$/ }));
  expect(await screen.findByText('인력교류 상세')).toBeVisible();
  await screen.findByRole('columnheader', { name: '작업자수' });
  fireEvent.click(screen.getByRole('button', { name: /^상세$/ }));
  expect(await screen.findByText('작업자 상세 (' + siteName + ')')).toBeVisible();
}

it('소개비는 급여에서 차감하며 대납청구서는 현재 팀의 대납출력부 청구서를 연다', async () => {
  const saved = document();
  saved.confirmedAt = null;
  saved.sales = [{ id: 'sale', source: 'manual', origin: 'manual', kind: '직영', siteName: '청구 현장', amount: 1000000, manDay: 5 }];
  saved.deductions = [
    { id: 'payroll', source: 'auto', origin: 'daily_wage_payroll', category: '일급제 급여', amount: 100000 },
    { id: 'expense', source: 'manual', origin: 'manual', category: '청구 공제', amount: 50000 },
  ];
  saved.summary = { prevCarryover: 10000, deposit: 20000 };
  saved.deductions.push({ id: 'fee', source: 'auto', origin: 'daily_advance_recruiter_fee', category: '인력소개비', amount: 120000,
    recruiterFeeDetails: [{ workerId: 'person-a', workerName: '가상인력 A', amount: 80000 }, { workerId: 'person-b', workerName: '가상인력 B', amount: 40000 }] });
  jest.mocked(teamSettlementService.getTeamSettlement).mockImplementation(async ({ yearMonth }) => ({ ...saved, yearMonth }));
  render(<TeamSettlementPage />);
  const preview = await screen.findByRole('button', { name: '대납청구서 보기' });
  await waitFor(() => expect(preview).toBeEnabled());
  expect(within(screen.getByRole('group', { name: '급여 합계' })).getByRole('button', { name: '대납청구서 보기' })).toBe(preview);
  expect(within(screen.getByRole('region', { name: '추가 내역' })).queryByRole('button', { name: '대납청구서 보기' })).not.toBeInTheDocument();
  const row = screen.getByRole('row', { name: /급여 인력소개비/ });
  expect(within(row).getByRole('textbox', { name: '금액' })).toHaveValue('120,000');
  expect(within(row).getByRole('button', { name: '삭제' })).toBeDisabled();
  expect(screen.getByRole('region', { name: '추가 내역' })).not.toHaveTextContent('인력소개비');
  fireEvent.click(within(row).getByRole('button', { name: '상세' }));
  const feeDetails = screen.getByRole('table', { name: '인력소개비 상세 내역' });
  expect(within(feeDetails).getByRole('row', { name: '가상인력 A 80,000원' })).toBeVisible();
  expect(within(feeDetails).getByRole('row', { name: '가상인력 B 40,000원' })).toBeVisible();
  expect(within(feeDetails).getByRole('row', { name: '소개비 합계 120,000원' })).toBeVisible();
  expect(feeDetails).not.toHaveTextContent('person-a');
  fireEvent.change(screen.getByLabelText('전월 이월'), { target: { value: '15000' } });
  fireEvent.blur(screen.getByLabelText('전월 이월'));
  fireEvent.click(preview);
  const invoice = await screen.findByRole('dialog', { name: '조회팀 청구서' });
  expect(await within(invoice).findByRole('region', { name: '대납출력부 팀 청구서' })).toBeVisible();
  expect(await within(invoice).findByRole('columnheader', { name: '인력소개비' })).toBeVisible();
  expect(within(invoice).getByRole('columnheader', { name: '청구금액' })).toBeVisible();
  expect(within(invoice).queryByRole('table', { name: '매출 내역' })).not.toBeInTheDocument();
  expect(within(invoice).queryByText('청구 현장')).not.toBeInTheDocument();
  expect(teamSettlementService.saveTeamSettlement).not.toHaveBeenCalled();
  expect(teamSettlementService.recalculateAndSaveTeamSettlement).not.toHaveBeenCalled();
  fireEvent.click(within(invoice).getByRole('button', { name: '상세 닫기' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});

it('03 추가에는 경비 구분 이름을 표시하고 내부 코드는 노출하지 않는다', async () => {
  const key = 'custom_1700000000000_a1b2c3';
  const saved = document();
  saved.additions = [{ id: 'claim', source: 'auto', origin: 'team_expense_claim', category: `경비 환급(${key} - 장비 2대)`, amount: 50000 }];
  jest.mocked(teamExpenseCategoryService.getCategories).mockResolvedValue([{ id: key, label: '장비 대여' }] as any);
  jest.mocked(teamSettlementService.getTeamSettlement).mockImplementation(async ({ yearMonth }) => ({ ...saved, yearMonth }));
  render(<TeamSettlementPage />);
  await screen.findByRole('button', { name: '대납청구서 보기' });
  const additions = screen.getByRole('region', { name: '추가 내역' });
  await waitFor(() => expect(additions).toHaveTextContent('경비 환급(장비 대여 - 장비 2대)'));
  expect(additions).not.toHaveTextContent(key);
  expect(within(additions).getByRole('textbox', { name: '항목' })).toHaveValue('경비 환급(장비 대여 - 장비 2대)');
  expect(within(additions).getByRole('textbox', { name: '금액' })).toHaveValue('50,000');
  expect(saved.additions[0].category).toContain(key);
  expect(teamSettlementService.saveTeamSettlement).not.toHaveBeenCalled();
});

it('다른 월의 이전 정산이 남아 있는 동안에는 청구서를 만들 수 없다', async () => {
  jest.mocked(teamSettlementService.getTeamSettlement).mockResolvedValue({ ...document(), yearMonth: '2000-01' });
  render(<TeamSettlementPage />);
  expect(await screen.findByRole('button', { name: '대납청구서 보기' })).toBeDisabled();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it.each([false, true])('조회자는 정산의 확정 여부와 관계없이 모든 쓰기가 잠기고 새로고침은 가능하다 (확정=%s)', async confirmed => {
  jest.mocked(useTeamSettlementAccess).mockReturnValue({ loading: false, canWrite: false });
  jest.mocked(teamSettlementService.getTeamSettlement).mockResolvedValue({ ...document(), confirmedAt: confirmed ? document().confirmedAt : null });
  render(<TeamSettlementPage />);
  await screen.findByText(/조회 전용입니다/);
  await waitFor(() => expect(teamSettlementService.getTeamSettlement).toHaveBeenCalledWith(expect.objectContaining({ persistSnapshot: false, refreshDraft: false })));
  const refresh = screen.getByRole('button', { name: '새로고침' });
  await waitFor(() => expect(refresh).toBeEnabled());
  expect(screen.getByRole('button', { name: '재집계' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '변경사항 없음' })).toBeDisabled();
  expect(screen.getByRole('button', { name: confirmed ? '확정 취소' : '저장 후 확정' })).toBeDisabled();
  for (const button of screen.getAllByRole('button', { name: /수기.*추가|일괄.*적용/ })) expect(button).toBeDisabled();
  fireEvent.click(refresh);
  await waitFor(() => expect(teamSettlementService.getTeamSettlement).toHaveBeenCalledTimes(2));
  expect(teamSettlementService.saveTeamSettlement).not.toHaveBeenCalled();
  expect(teamSettlementService.recalculateAndSaveTeamSettlement).not.toHaveBeenCalled();
});

function getAdjustmentRow(category: string) {
  return screen.getAllByRole('row').find(row => within(row).queryByDisplayValue(category))!;
}

it('누락된 카드와 주고받는 경비를 알리고 조회만으로 저장 금액을 바꾸지 않는다', async () => {
  const saved = document();
  saved.purchases = [];
  const original = JSON.stringify(saved);
  jest.mocked(teamSettlementService.getTeamSettlement).mockResolvedValue(saved);
  require('../../services/cardBillingService').cardBillingService.getBillingsByMonth.mockResolvedValue([{
    id: 'missing-card', yearMonth: '2026-08', cardId: 'card', cardLabel: '검증 카드', teamId: '조회팀', status: 'DRAFT',
    issuedToType: 'team', lineItems: [{ label: '사용액', amount: 1000, sourceType: 'card_ledger' }]
  }, {
    id: 'other-team-card', yearMonth: '2026-08', cardId: 'other-card', cardLabel: '다른 카드', teamId: 'other-team', teamName: '조회팀', status: 'DRAFT',
    issuedToType: 'team', lineItems: [{ label: '사용액', amount: 2000, sourceType: 'card_ledger' }]
  }]);
  require('../../services/teamExpenseLedgerService').teamExpenseLedgerService.getClaimsByMonth.mockResolvedValue([
    { id: 'out', yearMonth: '2026-08', status: 'charged', claimType: 'teamCharge', payerTeamId: 'other', chargeToTeamId: 'own', amount: 500, category: 'meal' },
    { id: 'in', yearMonth: '2026-08', status: 'charged', claimType: 'teamCharge', payerTeamId: 'own', chargeToTeamId: 'other', amount: 500, category: 'meal' }
  ]);
  render(<TeamSettlementPage />);
  fireEvent.click(await screen.findByRole('button', { name: '8월' }));
  const status = within(await screen.findByRole('status', { name: '경비 원본 검증' }));
  await waitFor(() => expect(status.getByText('카드비 낼 금액 1건이 저장 정산에 없습니다.')).toBeVisible());
  expect(status.getByText('경비 낼 금액 1건이 저장 정산에 없습니다.')).toBeVisible();
  expect(status.getByText('경비 받을 금액 1건이 저장 정산에 없습니다.')).toBeVisible();
  expect(JSON.stringify(saved)).toBe(original);
  expect(teamSettlementService.saveTeamSettlement).not.toHaveBeenCalled();
});

it('경비 조회 실패를 0원으로 처리하지 않고 재조회로 복구한다', async () => {
  const read = require('../../services/cardBillingService').cardBillingService.getBillingsByMonth;
  read.mockRejectedValue(new Error('unavailable'));
  render(<TeamSettlementPage />);
  const status = within(await screen.findByRole('status', { name: '경비 원본 검증' }));
  await waitFor(() => expect(status.getByText(/경비 원본 조회 또는 금액 검증에 실패/)).toBeVisible());
  expect(status.queryByText(/내역이 일치/)).not.toBeInTheDocument();
  read.mockResolvedValue([]);
  fireEvent.click(status.getByRole('button', { name: '경비 원본 다시 조회' }));
  await waitFor(() => expect(status.getByText('경비 원본과 저장 내역이 일치합니다.')).toBeVisible());
  expect(teamSettlementService.saveTeamSettlement).not.toHaveBeenCalled();
});

it('같은 차량의 청구 두 건을 상세에서 한 번씩만 합산해 차량 전체 금액과 일치시킨다', async () => {
  const saved = document();
  saved.purchases = [];
  const billings = [1000000, 623380].map((amount, index) => ({
    id: `2026-08_car-a__row_${index}`, yearMonth: '2026-08',
    vehicleId: 'car-a', vehiclePlate: '검증차량', teamId: 'own', teamName: '조회팀',
    issuedToType: 'team', status: 'CONFIRMED', fixedCost: amount, variableCost: 0, totalAmount: amount,
    lineItems: [{ id: `cost-${index}`, label: `차량 비용 ${index + 1}`, amount, type: 'FIXED', sourceType: 'vehicle_ledger' }]
  }));
  saved.deductions = billings.map(billing => ({
    id: `vehicle_billing:2026-08:${billing.id}`, source: 'auto', origin: 'vehicle_billing',
    category: '차량비 (검증차량)', amount: billing.totalAmount
  }));
  jest.mocked(teamSettlementService.getTeamSettlement).mockResolvedValue(saved);
  require('../../services/vehicleBillingService').vehicleBillingService.getBillingsByMonth.mockResolvedValue(billings);
  render(<TeamSettlementPage />);
  fireEvent.click(await screen.findByRole('button', { name: '8월' }));
  await waitFor(() => expect(within(screen.getByRole('status', { name: '경비 원본 검증' })).getByText('경비 원본과 저장 내역이 일치합니다.')).toBeVisible());
  await screen.findByRole('group', { name: '경비 합계' });
  const row = getAdjustmentRow('차량 전체');
  expect(within(row).getByDisplayValue('1,623,380')).toBeVisible();
  fireEvent.click(within(row).getByRole('button', { name: '상세' }));
  const detail = within(await screen.findByRole('region', { name: '경비 상세' }));
  await waitFor(() => expect(detail.getByText('1,623,380원')).toBeVisible());
  fireEvent.click(detail.getByRole('button', { name: '더상세' }));
  expect(detail.getAllByText('차량 비용 1')).toHaveLength(1);
  expect(detail.getAllByText('차량 비용 2')).toHaveLength(1);
  expect(detail.queryByText('3,246,760원')).not.toBeInTheDocument();
  expect(teamSettlementService.saveTeamSettlement).not.toHaveBeenCalled();
  expect(teamSettlementService.recalculateAndSaveTeamSettlement).not.toHaveBeenCalled();
});

it('배정 기간별 차량 정산액을 현재 차량의 월 전체 비용으로 바꾸지 않는다', async () => {
  const saved = document();
  saved.purchases = [];
  saved.deductions = [{ id: 'vehicle_billing:2026-08:car-a:ledger:assignment-a', source: 'auto',
    origin: 'vehicle_billing', category: '차량비 (검증차량)', amount: 300000,
    memo: '월별 차량 대장 배정일 자동배분 (10일)' }];
  jest.mocked(teamSettlementService.getTeamSettlement).mockResolvedValue(saved);
  require('../../services/vehicleService').vehicleService.getVehicles.mockResolvedValue([
    { id: 'car-a', licensePlate: '검증차량', type: 'RENT', contract: { monthlyFee: 900000 },
      currentAssigneeType: 'TEAM', currentAssigneeId: 'own' }
  ]);
  render(<TeamSettlementPage />);
  await screen.findByRole('group', { name: '경비 합계' });
  fireEvent.click(within(getAdjustmentRow('차량 전체')).getByRole('button', { name: '상세' }));
  const detail = within(await screen.findByRole('region', { name: '경비 상세' }));
  await waitFor(() => expect(detail.getByText('300,000원')).toBeVisible());
  expect(detail.queryByText('900,000원')).not.toBeInTheDocument();
  expect(detail.getByText(/당시 세부 내역을 확인할 수 없어/)).toBeVisible();
  expect(teamSettlementService.saveTeamSettlement).not.toHaveBeenCalled();
});

it('팀장도 기존 인력교류 상세의 현장별 표와 작업자별 표에서 방문팀을 본다', async () => {
  render(<TeamSettlementPage />);
  await expandOriginalDetails('담당 현장');
  expect(screen.getByText('방문 작업자 A')).toBeVisible();
  expect(screen.getByText('방문 작업자 B')).toBeVisible();
  expect(screen.getAllByText('지원 방문팀').length).toBeGreaterThanOrEqual(2);
  const workerRow = screen.getByRole('row', { name: /^26-08-03 방문 작업자 A / });
  expect(within(workerRow).getByText('1.5')).toBeVisible();
  expect(within(workerRow).getByText(/270,000/)).toBeVisible();
  expect(within(workerRow).getByText(/405,000/)).toBeVisible();
  expect(screen.queryByText(/내 현장에 지원 온 팀/)).not.toBeInTheDocument();
  expect(screen.queryByRole('region', { name: '지원 온 팀 상세' })).not.toBeInTheDocument();
  expect(teamSettlementService.saveTeamSettlement).not.toHaveBeenCalled();
  expect(teamSettlementService.recalculateAndSaveTeamSettlement).not.toHaveBeenCalled();
});

it('우리 팀이 상대 현장에 지원 간 공수도 같은 기존 작업자 표에서 표시한다', async () => {
  const saved = document(); saved.purchases = [];
  saved.sales = [{ id: 'sale', source: 'auto', origin: '내부지원간곳', kind: '지원', siteId: 'site-b',
    siteName: '상대팀 현장', counterTeamId: 'host', counterTeamName: '상대 시공팀', manDay: 3, amount: 810000 }];
  delete saved.sourceSnapshot!.supportDetails;
  jest.mocked(teamSettlementService.getTeamSettlement).mockResolvedValue(saved);
  jest.mocked(teamSettlementService.getSupportSettlementDetailRows).mockResolvedValue([
    { id: 'sent', direction: '내부지원간곳', date: '2026-08-05', siteId: 'site-b', siteName: '상대팀 현장',
      counterTeamId: 'host', counterTeamName: '상대 시공팀', workerId: 'own-worker', workerName: '우리 작업자',
      workerTeamId: 'own', workerTeamName: '조회팀', manDay: 3, unitPrice: 230000, amount: 690000 }
  ]);
  render(<TeamSettlementPage />);
  await expandOriginalDetails('상대팀 현장');
  const row = screen.getByRole('row', { name: /^26-08-05 우리 작업자 / });
  expect(within(row).getByText('3.0')).toBeVisible();
  expect(within(row).getByText(/270,000/)).toBeVisible();
  expect(within(row).getByText(/810,000/)).toBeVisible();
  expect(teamSettlementService.saveTeamSettlement).not.toHaveBeenCalled();
});

it.each(['sales', 'purchase'] as const)('%s 작업자 상세는 날짜별로 분리하고 날짜순으로 표시하며 현장 합계를 유지한다', async direction => {
  const saved = document();
  const supportDirection = direction === 'sales' ? '내부지원간곳' : '내부지원온곳';
  const line = { ...saved.purchases[0], manDay: 3, amount: 810000 };
  saved.sales = direction === 'sales' ? [{ ...line, origin: '내부지원간곳' }] : [];
  saved.purchases = direction === 'purchase' ? [{ ...line, origin: '내부지원온곳' }] : [];
  saved.sourceSnapshot!.supportDetails = [
    { id: 'later', date: '2026-08-05', manDay: 1.5 },
    { id: 'earlier', date: '2026-08-03', manDay: 1 },
    { id: 'same-day', date: '2026-08-03', manDay: 0.5 }
  ].map(row => ({ ...row, direction: supportDirection, siteId: 'site', siteName: '담당 현장',
    counterTeamId: 'visitor', counterTeamName: '지원 방문팀', workerId: 'worker-a', workerName: '날짜 검증자',
    workerTeamName: '지원 방문팀', unitPrice: 270000, amount: row.manDay * 270000 }));
  jest.mocked(teamSettlementService.getTeamSettlement).mockResolvedValue(saved);
  const original = JSON.stringify(saved);
  render(<TeamSettlementPage />);
  await expandOriginalDetails('담당 현장');
  const table = within(screen.getByRole('table', { name: '작업자 상세 (담당 현장)' }));
  expect(table.getAllByRole('columnheader').map(cell => cell.textContent).slice(0, 2)).toEqual(['날짜', '작업자']);
  const rows = table.getAllByRole('row').slice(1);
  expect(rows.map(row => within(row).getAllByRole('cell').map(cell => cell.textContent))).toEqual([
    ['26-08-03', '날짜 검증자', '지원 방문팀', '1.5', '270,000원', '405,000'],
    ['26-08-05', '날짜 검증자', '지원 방문팀', '1.5', '270,000원', '405,000']
  ]);
  const siteRow = screen.getAllByRole('row').find(row => within(row).queryAllByRole('cell')[0]?.textContent === '담당 현장')!;
  expect(within(siteRow).getByRole('cell', { name: '1' })).toBeVisible();
  expect(within(siteRow).getByRole('cell', { name: '3.0' })).toBeVisible();
  expect(within(siteRow).getByRole('cell', { name: '810,000' })).toBeVisible();
  expect(JSON.stringify(saved)).toBe(original);
  expect(teamSettlementService.saveTeamSettlement).not.toHaveBeenCalled();
});

it('정상 저장된 상세는 유지하고 일반 일보 조회 실패가 지원 상세를 지우지 않는다', async () => {
  const saved = document();
  saved.sourceSnapshot!.supportDetails = [{ id: 'snap', direction: '내부지원온곳', date: '2026-08-03',
    siteId: 'site', siteName: '담당 현장', counterTeamId: 'visitor', workerId: 'saved', workerName: '저장된 작업자',
    workerTeamName: '지원 방문팀', manDay: 2, unitPrice: 270000, amount: 540000 }];
  jest.mocked(teamSettlementService.getTeamSettlement).mockResolvedValue(saved);
  require('../../services/dailyReportService').dailyReportService.getReportWorkerRowsByRange.mockRejectedValue(new Error('denied'));
  render(<TeamSettlementPage />);
  await expandOriginalDetails('담당 현장');
  expect(screen.getByText('저장된 작업자')).toBeVisible();
  expect(teamSettlementService.getSupportSettlementDetailRows).not.toHaveBeenCalled();
});

it('기존 상세 안에서 오류를 알리고 재시도로 작업자 상세를 복구한다', async () => {
  jest.mocked(teamSettlementService.getSupportSettlementDetailRows).mockRejectedValueOnce(new Error('unavailable'));
  render(<TeamSettlementPage />);
  fireEvent.click(await screen.findByRole('button', { name: /^상세$/ }));
  const alert = await screen.findByRole('alert');
  fireEvent.click(within(alert).getByRole('button', { name: '다시 조회' }));
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  await screen.findByRole('columnheader', { name: '작업자수' });
  fireEvent.click(screen.getByRole('button', { name: /^상세$/ }));
  expect(await screen.findByText('방문 작업자 A')).toBeVisible();
});

it('급여 세 종류를 매입 지원 아래에 표시하고 중복 차감 없이 매입 합계에 포함한다', async () => {
  const saved = document();
  saved.sales = [{ id: 'sale', source: 'manual', origin: 'manual', kind: '직영',
    siteName: '검증 현장', manDay: 10, amount: 5000000 }];
  saved.deductions = [
    { id: 'monthly', source: 'auto', origin: 'monthly_wage_payroll', category: '월급제 급여', amount: 1000000 },
    { id: 'daily', source: 'auto', origin: 'daily_wage_payroll', category: '일급제 급여', amount: 2000000 },
    { id: 'service', source: 'auto', origin: 'service_team_payroll', category: '용역팀 급여', amount: 300000 },
    { id: 'office', source: 'auto', origin: 'office_expense', category: '사무실비', amount: 50000 },
    { id: 'manual', source: 'manual', origin: 'manual', category: '기타 차감', amount: 10000 }
  ];
  saved.additions = [{ id: 'addition', source: 'manual', origin: 'manual', category: '추가 지급', amount: 20000 }];
  saved.summary = { prevCarryover: 100000, deposit: 200000 };
  const unchanged = JSON.parse(JSON.stringify(saved));
  jest.mocked(teamSettlementService.getTeamSettlement).mockResolvedValue(saved);
  require('../../services/dailyReportService').dailyReportService.getReportWorkerRowsByRange.mockResolvedValue([
    { workerId: 'monthly-worker', workerName: '월급 검증자', workerTeamId: 'own', salaryModel: '월급제', manDay: 2, amount: 1000000 },
    { workerId: 'daily-worker', workerName: '일급 검증자', workerTeamId: 'own', salaryModel: '일급제', manDay: 4, amount: 2000000 },
    { workerId: 'service-worker', workerName: '용역 검증자', responsibleTeamId: 'own', siteType: '직영', salaryModel: '용역팀', manDay: 2, amount: 300000 }
  ]);
  render(<TeamSettlementPage />);
  const purchases = await screen.findByRole('region', { name: '매입 내역' });
  const payroll = within(purchases).getByRole('heading', { name: '급여' });
  const support = within(purchases).getByText('지원', { exact: true });
  expect(support.compareDocumentPosition(payroll) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(within(purchases).getByText('3,300,000원')).toBeVisible();
  for (const category of ['월급제 급여', '일급제 급여', '용역팀 급여']) {
    expect(within(purchases).getByDisplayValue(category)).toBeDisabled();
  }
  const deductions = screen.getByRole('region', { name: '공제 내역' });
  expect(within(deductions).queryByText('급여', { exact: true })).not.toBeInTheDocument();
  expect(within(deductions).getByDisplayValue('기타 차감')).toBeVisible();
  expect(screen.getByLabelText('매입 - 3,840,000원 (2공수)')).toBeVisible();
  const summary = screen.getByRole('region', { name: '정산 요약' });
  expect(within(summary).getByText('3,840,000원')).toBeVisible();
  expect(within(summary).getByText('60,000원')).toBeVisible();
  expect(within(summary).getByText('1,420,000원')).toBeVisible();
  for (const [category, workerName, manDay, wage, total] of [
    ['월급제 급여', '월급 검증자', '2.0', '500,000원', '1,000,000'],
    ['일급제 급여', '일급 검증자', '4.0', '500,000원', '2,000,000'],
    ['용역팀 급여', '용역 검증자', '2.0', '150,000원', '300,000']
  ]) {
    const row = within(purchases).getAllByRole('row')
      .find(candidate => within(candidate).queryByDisplayValue(category))!;
    fireEvent.click(within(row).getByRole('button', { name: '상세' }));
    expect(within(purchases).getByText('급여 상세')).toBeVisible();
    const detail = within(purchases).getByRole('table', { name: '급여 상세 내역' });
    expect(within(detail).getAllByRole('columnheader').map(header => header.textContent)).toEqual(['작업자', '공수', '급여', '총급여']);
    const workerRow = await within(detail).findByRole('row', { name: new RegExp('^' + workerName + ' ') });
    expect(within(workerRow).getAllByRole('cell').map(cell => cell.textContent)).toEqual([workerName, manDay, wage, total]);
    expect(within(workerRow).getByText(wage)).toHaveAttribute('data-label', '급여');
    expect(within(workerRow).getByText(total)).toHaveAttribute('data-label', '총급여');
    fireEvent.click(within(row).getByRole('button', { name: '닫기' }));
  }
  expect(saved).toEqual(unchanged);
  expect(teamSettlementService.saveTeamSettlement).not.toHaveBeenCalled();
  expect(teamSettlementService.recalculateAndSaveTeamSettlement).not.toHaveBeenCalled();
});

it.each(['검증 1팀', '검증 2팀'])('현장별 쓰꾸미는 금액이 아닌 %s의 도급/직영 매출 현장 순서를 따른다', async teamName => {
  const saved = document();
  saved.teamName = teamName;
  saved.sales = [
    { id: 'direct-b', source: 'auto', origin: 'support_client_site', kind: '직영', siteName: '나 직영', manDay: 4, amount: 800000 },
    { id: 'contract-b', source: 'auto', origin: 'daily_report', kind: '도급', siteName: '라 도급', manDay: 2, amount: 600000 },
    { id: 'direct-a', source: 'auto', origin: 'daily_report', kind: '직영', siteName: '가 직영', manDay: 1, amount: 100000 },
    { id: 'contract-a', source: 'auto', origin: 'daily_report', kind: '도급', siteName: '다 도급', manDay: 3, amount: 300000 }
  ];
  if (teamName === '검증 2팀') saved.sales.reverse();
  const unchanged = JSON.parse(JSON.stringify(saved));
  jest.mocked(teamService.getTeams).mockResolvedValue([{ id: 'own', name: teamName, companyId: 'company', type: '시공팀' } as any]);
  jest.mocked(teamSettlementService.getTeamSettlement).mockResolvedValue(saved);
  render(<TeamSettlementPage />);
  const sales = await screen.findByRole('table', { name: '도급/직영 매출' });
  const skkumi = screen.getByRole('table', { name: '현장별 쓰꾸미' });
  const salesOrder = within(sales).getAllByRole('row').slice(1).map(row => within(row).getAllByRole('cell')[1].textContent);
  const skkumiRows = within(skkumi).getAllByRole('row').slice(1);
  const skkumiOrder = skkumiRows.map(row => within(row).getAllByRole('cell')[0].textContent);
  expect(salesOrder).toEqual(['다 도급', '라 도급', '가 직영', '나 직영']);
  expect(skkumiOrder).toEqual(salesOrder);
  expect(skkumiRows.map(row => within(row).getAllByRole('cell')[2].textContent))
    .toEqual(['300,000', '600,000', '100,000', '800,000']);
  expect(saved).toEqual(unchanged);
  expect(teamSettlementService.saveTeamSettlement).not.toHaveBeenCalled();
  expect(teamSettlementService.recalculateAndSaveTeamSettlement).not.toHaveBeenCalled();
});

it('도급·직영 금액은 빈칸으로 시작하고 직접 입력 후 저장해도 원천 금액 오류가 생기지 않는다', async () => {
  const saved = document();
  saved.confirmedAt = null;
  saved.purchases = [];
  saved.sales = [
    { id: 'contract', source: 'auto', origin: 'daily_report', kind: '도급', siteName: '도급 입력 현장', manDay: 2, amount: 0 },
    { id: 'direct', source: 'auto', origin: 'daily_report', kind: '직영', siteName: '직영 입력 현장', manDay: 3, amount: 0 }
  ];
  saved.sourceSnapshot!.manualContractDirectAmounts = true;
  saved.sourceSnapshot!.totals = { sales: 0, purchases: 0, deductions: 0, additions: 0, net: 0 };
  jest.mocked(teamSettlementService.getTeamSettlement).mockResolvedValue(saved);
  render(<TeamSettlementPage />);
  const sales = await screen.findByRole('table', { name: '도급/직영 매출' });
  const inputs = within(sales).getAllByRole('textbox', { name: '금액' });
  expect(inputs).toHaveLength(2);
  inputs.forEach(input => { expect(input).toHaveValue(''); expect(input).toHaveAttribute('placeholder', '금액 입력'); });
  fireEvent.change(inputs[0], { target: { value: '600000' } });
  fireEvent.change(inputs[1], { target: { value: '900000' } });
  expect(screen.getByText('정산 검증 완료')).toBeVisible();
  expect(screen.getByRole('table', { name: '현장별 쓰꾸미' })).toHaveTextContent('300,000원');
  fireEvent.click(screen.getByRole('button', { name: '변경사항 저장' }));
  await waitFor(() => expect(teamSettlementService.saveTeamSettlement).toHaveBeenCalledWith(expect.objectContaining({
    sales: [expect.objectContaining({ amount: 600000, amountOverridden: true }), expect.objectContaining({ amount: 900000, amountOverridden: true })]
  })));
  expect(saved.sales.map(row => row.amount)).toEqual([0, 0]);
});

it.each(['도급', '직영'] as const)('수기 %s 매출을 상세에서 삭제하면 합계와 저장 내용에 반영하고 원천 및 다른 행을 보존한다', async kind => {
  const saved = document();
  saved.confirmedAt = null;
  saved.purchases = [];
  saved.sales = [
    { id: 'automatic', source: 'auto', origin: 'daily_report', kind: '직영', siteName: '자동 현장', manDay: 1, amount: 100000, amountOverridden: true },
    { id: 'remove', source: 'manual', origin: 'manual', kind, siteName: '삭제할 수기 현장', manDay: 1, amount: 230000 },
    { id: 'keep', source: 'manual', origin: 'manual', kind: '직영', siteName: '남길 수기 현장', manDay: 1, amount: 70000 }
  ];
  saved.sourceSnapshot!.manualContractDirectAmounts = true;
  saved.sourceSnapshot!.totals = { sales: 0, purchases: 0, deductions: 0, additions: 0, net: 0 };
  jest.mocked(teamSettlementService.getTeamSettlement).mockResolvedValue(saved);
  render(<TeamSettlementPage />);
  expect(await screen.findByRole('button', { name: '+ 수기 도급/직영 매출' })).toBeEnabled();
  const sales = screen.getByRole('table', { name: '도급/직영 매출' });
  const automatic = within(sales).getByRole('row', { name: /자동 현장/ });
  fireEvent.click(within(automatic).getByRole('button', { name: '상세' }));
  expect(screen.queryByRole('button', { name: '수기 매출 삭제' })).not.toBeInTheDocument();
  const manual = within(sales).getAllByRole('row').find(row => within(row).queryByDisplayValue('삭제할 수기 현장'))!;
  fireEvent.click(within(manual).getByRole('button', { name: '상세' }));
  fireEvent.click(screen.getByRole('button', { name: '수기 매출 삭제' }));
  expect(within(sales).queryByDisplayValue('삭제할 수기 현장')).not.toBeInTheDocument();
  expect(within(sales).getByDisplayValue('남길 수기 현장')).toBeVisible();
  expect(within(sales).getByText('자동 현장')).toBeVisible();
  expect(screen.getByLabelText('매출 - 170,000원 (2공수)')).toBeVisible();
  expect(teamSettlementService.saveTeamSettlement).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '변경사항 저장' }));
  await waitFor(() => expect(teamSettlementService.saveTeamSettlement).toHaveBeenCalledWith(expect.objectContaining({
    sales: [saved.sales[0], saved.sales[2]]
  })));
  expect(saved.sales).toHaveLength(3);
});

it.each([
  { confirmed: true, canWrite: true },
  { confirmed: false, canWrite: false }
])('확정 정산 또는 조회 권한에서는 수기 매출을 삭제할 수 없다 (%j)', async ({ confirmed, canWrite }) => {
  const saved = document();
  saved.confirmedAt = confirmed ? saved.confirmedAt : null;
  saved.sales = [{ id: 'manual', source: 'manual', origin: 'manual', kind: '직영', siteName: '잠긴 수기 현장', manDay: 1, amount: 100000 }];
  jest.mocked(useTeamSettlementAccess).mockReturnValue({ loading: false, canWrite });
  jest.mocked(teamSettlementService.getTeamSettlement).mockResolvedValue(saved);
  render(<TeamSettlementPage />);
  const sales = await screen.findByRole('table', { name: '도급/직영 매출' });
  fireEvent.click(within(sales).getByRole('button', { name: '상세' }));
  const remove = screen.getByRole('button', { name: '수기 매출 삭제' });
  expect(remove).toBeDisabled();
  fireEvent.click(remove);
  expect(within(sales).getByText('잠긴 수기 현장')).toBeVisible();
  expect(teamSettlementService.saveTeamSettlement).not.toHaveBeenCalled();
});

it('쓰꾸미의 중복 현장 합계와 집계 대상은 유지하고 매출에서 먼저 나오는 현장을 먼저 표시한다', async () => {
  const saved = document();
  saved.sales = [
    { id: 'shared-direct', source: 'auto', origin: 'daily_report', kind: '직영', siteName: '공통 현장', manDay: 2, amount: 600000 },
    { id: 'other', source: 'auto', origin: 'support_client_site', kind: '직영', siteName: '가 직영', manDay: 4, amount: 2000000 },
    { id: 'shared-contract', source: 'auto', origin: 'daily_report', kind: '도급', siteName: '공통 현장', manDay: 1, amount: 300000 },
    { id: 'empty', source: 'auto', origin: 'daily_report', kind: '도급', siteName: '공수 없는 현장', manDay: 0, amount: 0 },
    { id: 'manual', source: 'manual', origin: 'manual', kind: '직영', siteName: '수기 현장', manDay: 1, amount: 5000000 },
    { id: 'support', source: 'auto', origin: '내부지원간곳', kind: '지원', siteName: '지원 현장', manDay: 1, amount: 7000000 }
  ];
  const unchanged = JSON.parse(JSON.stringify(saved));
  jest.mocked(teamSettlementService.getTeamSettlement).mockResolvedValue(saved);
  render(<TeamSettlementPage />);
  const skkumi = await screen.findByRole('table', { name: '현장별 쓰꾸미' });
  const rows = within(skkumi).getAllByRole('row').slice(1);
  expect(rows.map(row => within(row).getAllByRole('cell').map(cell => cell.textContent))).toEqual([
    ['공수 없는 현장', '0.0', '0', '-'],
    ['공통 현장', '3.0', '900,000', '300,000원'],
    ['가 직영', '4.0', '2,000,000', '500,000원']
  ]);
  expect(saved).toEqual(unchanged);
  expect(teamSettlementService.saveTeamSettlement).not.toHaveBeenCalled();
  expect(teamSettlementService.recalculateAndSaveTeamSettlement).not.toHaveBeenCalled();
});

it('급여가 없는 정산도 매입에 빈 급여 영역을 유지한다', async () => {
  render(<TeamSettlementPage />);
  const purchases = await screen.findByRole('region', { name: '매입 내역' });
  expect(within(purchases).getByText('급여', { exact: true })).toBeVisible();
  expect(within(purchases).getByText('내역 없음')).toBeVisible();
  expect(screen.getByLabelText('매입 - 540,000원 (2공수)')).toBeVisible();
  expect(screen.getByRole('region', { name: '공제 내역' })).not.toHaveTextContent('급여');
});

it('급여와 경비 상단은 제목과 총액만 표시하고 표의 구분 및 상세는 유지한다', async () => {
  const saved = document();
  saved.deductions = [
    { id: 'monthly', source: 'auto', origin: 'monthly_wage_payroll', category: '월급제 급여', amount: 1000000 },
    { id: 'daily', source: 'auto', origin: 'daily_wage_payroll', category: '일급제 급여', amount: 2000000 },
    { id: 'service', source: 'auto', origin: 'service_team_payroll', category: '용역팀 급여', amount: 300000 },
    { id: 'room-a', source: 'auto', origin: 'accommodation_billing', category: '숙소 A', amount: 400000 },
    { id: 'room-b', source: 'auto', origin: 'accommodation_billing', category: '숙소 B', amount: 200000 },
    { id: 'car', source: 'auto', origin: 'vehicle_billing', category: '차량', amount: 100000 },
    { id: 'card', source: 'auto', origin: 'card_billing', category: '카드', amount: 50000 }
  ];
  jest.mocked(teamSettlementService.getTeamSettlement).mockResolvedValue(saved);
  render(<TeamSettlementPage />);
  expect(within(await screen.findByRole('group', { name: '급여 합계' })).getByText('3,300,000원', { exact: true })).toBeVisible();
  expect(screen.getByRole('group', { name: '경비 합계' })).toHaveTextContent(/^경비750,000원$/);
  for (const category of ['월급제 급여', '일급제 급여', '용역팀 급여', '숙소 전체', '차량 전체', '카드 전체']) {
    const row = getAdjustmentRow(category);
    expect(within(row).getByRole('button', { name: '상세' })).toBeVisible();
  }
  expect(within(getAdjustmentRow('숙소 전체')).getByDisplayValue('600,000')).toBeVisible();
});

it.each<[TeamSettlementDeductionItem['officeExpenseRates'], number, number]>([
  [{ contract: 10000, direct: 5000 }, 40000, 140000],
  [undefined, 80000, 180000]
])('저장된 단가 %j 기준으로 사무실비를 직영·도급으로 나누고 해당 현장 상세만 표시한다', async (rates, directAmount, totalAmount) => {
  const saved = document();
  saved.sales = [
    { id: 'contract', source: 'auto', origin: 'daily_report', kind: '도급', siteName: '도급 검증 현장', manDay: 10, amount: 900000 },
    { id: 'direct', source: 'auto', origin: 'support_client_site', kind: '직영', siteName: '직영 검증 현장', manDay: 8, amount: 800000 },
    { id: 'support', source: 'auto', origin: '내부지원간곳', kind: '지원', siteName: '지원 검증 현장', manDay: 3, amount: 600000 }
  ];
  saved.deductions = [{ id: 'office', source: 'auto', origin: 'office_expense', category: '사무실비', amount: totalAmount, officeExpenseRates: rates }];
  const unchanged = JSON.parse(JSON.stringify(saved));
  jest.mocked(teamSettlementService.getTeamSettlement).mockResolvedValue(saved);
  render(<TeamSettlementPage />);
  const deductions = await screen.findByRole('region', { name: '공제 내역' });
  const directRow = getAdjustmentRow('직영 사무실비');
  const contractRow = getAdjustmentRow('도급 사무실비');
  expect(await within(directRow).findByDisplayValue(directAmount.toLocaleString('ko-KR'))).toBeVisible();
  expect(await within(contractRow).findByDisplayValue('100,000')).toBeVisible();
  expect(within(deductions).getByRole('group', { name: '사무실비 합계' })).toHaveTextContent(totalAmount.toLocaleString('ko-KR') + '원');
  for (const [row, site, excludedSite] of [[directRow, '직영 검증 현장', '도급 검증 현장'], [contractRow, '도급 검증 현장', '직영 검증 현장']] as const) {
    fireEvent.click(within(row).getByRole('button', { name: '상세' }));
    const detail = within(deductions).getByRole('table', { name: '현장별 사무실비' });
    expect(within(detail).getByText(site)).toBeVisible();
    expect(within(detail).queryByText(excludedSite)).not.toBeInTheDocument();
    expect(within(detail).queryByText('지원 검증 현장')).not.toBeInTheDocument();
    fireEvent.click(within(row).getByRole('button', { name: '닫기' }));
  }
  expect(within(screen.getByRole('region', { name: '정산 요약' })).getByText((1760000 - totalAmount).toLocaleString('ko-KR') + '원')).toBeVisible();
  expect(saved).toEqual(unchanged);
  expect(teamSettlementService.saveTeamSettlement).not.toHaveBeenCalled();
  expect(teamSettlementService.recalculateAndSaveTeamSettlement).not.toHaveBeenCalled();
});

it('사무실비 저장 금액이 계산과 달라도 차액을 표시해 행 합계와 정산 총액을 보존한다', async () => {
  const saved = document();
  saved.sales = [{ id: 'direct', source: 'auto', origin: 'daily_report', kind: '직영', siteName: '직영 현장', manDay: 8, amount: 800000 }];
  saved.deductions = [{ id: 'office', source: 'auto', origin: 'office_expense', category: '사무실비', amount: 35000, officeExpenseRates: { contract: 10000, direct: 5000 } }];
  jest.mocked(teamSettlementService.getTeamSettlement).mockResolvedValue(saved);
  render(<TeamSettlementPage />);
  await screen.findByRole('region', { name: '공제 내역' });
  const amounts = ['직영 사무실비', '도급 사무실비', '저장 금액 차이'].map(category => {
    const row = getAdjustmentRow(category);
    return Number((within(row).getByLabelText('금액') as HTMLInputElement).value.replace(/,/g, ''));
  });
  expect(amounts).toEqual([40000, 0, -5000]);
  expect(amounts.reduce((sum, amount) => sum + amount, 0)).toBe(35000);
  expect(within(screen.getByRole('region', { name: '정산 요약' })).getByText('225,000원')).toBeVisible();
  expect(teamSettlementService.saveTeamSettlement).not.toHaveBeenCalled();
});
