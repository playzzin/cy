import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { TeamSettlementPage } from './TeamSettlementPage';
import { teamSettlementService } from '../../services/teamSettlementService';
import { getTeamSettlementIncomingRows } from '../../services/teamSettlementIncomingService';
import type { TeamSettlementDocument } from '../../types/teamSettlement';
import { teamService } from '../../services/teamService';
import { companyService } from '../../services/companyService';

jest.mock('../../components/common/CompanyTeamSelector', () => ({ __esModule: true, default: () => null, readCompanyTeamOrder: () => [] }));
jest.mock('../../services/teamService', () => ({ teamService: { getTeams: jest.fn().mockResolvedValue([{ id: 'own', name: '조회팀', companyId: 'company', type: '시공팀' }]) } }));
jest.mock('../../services/companyService', () => ({ companyService: { getCompaniesByType: jest.fn().mockResolvedValue([{ id: 'company', name: '시공사' }]) } }));
// The leader's ordinary report query has no visiting workers or other teams.
jest.mock('../../services/dailyReportService', () => ({ dailyReportService: { getReportWorkerRowsByRange: jest.fn().mockResolvedValue([]) } }));
jest.mock('../../services/teamSettlementIncomingService', () => ({ getTeamSettlementIncomingRows: jest.fn() }));
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
  jest.mocked(getTeamSettlementIncomingRows).mockResolvedValue([{ id: 'incoming', date: '2026-08-03',
    siteId: 'site', siteName: '담당 현장', teamId: 'visitor', teamName: '지원 방문팀', manDay: 2,
    supportRate: 230000, supportAmount: 460000 }]);
});

it('팀장 조회에서 저장된 빈 상세와 관계없이 지원 온 팀의 공수·정산 지원단가를 펼쳐 보여준다', async () => {
  const saved = document();
  jest.mocked(teamSettlementService.getTeamSettlement).mockResolvedValue(saved);
  render(<TeamSettlementPage />);
  const overview = await screen.findByRole('region', { name: '지원 온 팀 상세' });
  fireEvent.click(screen.getByRole('button', { name: '상세', exact: true }));
  await waitFor(() => expect(screen.getAllByRole('region', { name: '지원 온 팀 상세' })).toHaveLength(2));
  expect(within(overview).getByText('지원 방문팀')).toBeVisible();
  expect(within(overview).getByText('270,000원')).toBeVisible();
  const detail = screen.getAllByRole('region', { name: '지원 온 팀 상세' })[0];
  expect(within(detail).getByText('지원 방문팀')).toBeVisible();
  expect(within(detail).getByText('270,000원')).toBeVisible();
  expect(within(detail).getAllByText('2공')).toHaveLength(2);
  expect(saved).toEqual(document());
  expect(teamSettlementService.saveTeamSettlement).not.toHaveBeenCalled();
  expect(teamSettlementService.recalculateAndSaveTeamSettlement).not.toHaveBeenCalled();
});

it('지원팀 조회 오류를 0건으로 표시하지 않고 재시도하면 권한이 허용한 팀 집계를 보여준다', async () => {
  jest.mocked(getTeamSettlementIncomingRows).mockRejectedValueOnce(new Error('unavailable'));
  render(<TeamSettlementPage />);
  const alert = await screen.findByRole('alert');
  expect(screen.queryByText(/내 현장에 지원 온 팀 · 0개 팀/)).not.toBeInTheDocument();
  fireEvent.click(within(alert).getByRole('button', { name: '다시 조회' }));
  const incoming = await screen.findByRole('region', { name: '지원 온 팀 상세' });
  expect(within(incoming).getByText('지원 방문팀')).toBeVisible();
});
