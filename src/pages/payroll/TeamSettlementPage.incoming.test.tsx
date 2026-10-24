import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { TeamSettlementPage } from './TeamSettlementPage';
import { teamSettlementService } from '../../services/teamSettlementService';
import type { TeamSettlementDeductionItem, TeamSettlementDocument } from '../../types/teamSettlement';
import { teamService } from '../../services/teamService';
import { companyService } from '../../services/companyService';

jest.mock('../../components/common/CompanyTeamSelector', () => ({ __esModule: true, default: () => null, readCompanyTeamOrder: () => [] }));
jest.mock('../../services/teamService', () => ({ teamService: { getTeams: jest.fn().mockResolvedValue([{ id: 'own', name: '조회팀', companyId: 'company', type: '시공팀' }]) } }));
jest.mock('../../services/companyService', () => ({ companyService: { getCompaniesByType: jest.fn().mockResolvedValue([{ id: 'company', name: '시공사' }]) } }));
// The leader's ordinary report query has no visiting workers or other teams.
jest.mock('../../services/dailyReportService', () => ({ dailyReportService: { getReportWorkerRowsByRange: jest.fn().mockResolvedValue([]) } }));
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
beforeAll(() => {
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
});
beforeEach(() => {
  jest.clearAllMocks();
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
  expect(await screen.findByRole('group', { name: '급여 합계' })).toHaveTextContent(/^급여3,300,000원$/);
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
  expect(within(directRow).getByDisplayValue(directAmount.toLocaleString('ko-KR'))).toBeVisible();
  expect(within(contractRow).getByDisplayValue('100,000')).toBeVisible();
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
