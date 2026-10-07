import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { TeamSettlementPage } from './TeamSettlementPage';
import { teamSettlementService } from '../../services/teamSettlementService';
import type { TeamSettlementDocument } from '../../types/teamSettlement';
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

it('팀장도 기존 인력교류 상세의 현장별 표와 작업자별 표에서 방문팀을 본다', async () => {
  render(<TeamSettlementPage />);
  await expandOriginalDetails('담당 현장');
  expect(screen.getByText('방문 작업자 A')).toBeVisible();
  expect(screen.getByText('방문 작업자 B')).toBeVisible();
  expect(screen.getAllByText('지원 방문팀').length).toBeGreaterThanOrEqual(2);
  const workerRow = screen.getByRole('row', { name: /방문 작업자 A/ });
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
  const row = screen.getByRole('row', { name: /우리 작업자/ });
  expect(within(row).getByText('3.0')).toBeVisible();
  expect(within(row).getByText(/270,000/)).toBeVisible();
  expect(within(row).getByText(/810,000/)).toBeVisible();
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
