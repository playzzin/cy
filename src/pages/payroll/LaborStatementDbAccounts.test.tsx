import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import LaborCostStatementGeneratorPage from './LaborCostStatementGeneratorPage';
import SupportTeamPaymentPage from './SupportTeamPaymentPage';
import { SupportClientLaborStatementPanel } from './SupportClientStatementPanels';
import { buildSupportRows } from './SupportClientSiteModel';
import { manpowerService, Worker } from '../../services/manpowerService';
import type { DailyReport } from '../../services/dailyReportService';
import type { Team } from '../../services/teamService';
import type { Site } from '../../services/siteService';
import type { Company } from '../../services/companyService';

jest.mock('../../services/manpowerService', () => ({ manpowerService: { getWorkers: jest.fn() } }));
jest.mock('../../services/teamService', () => ({ teamService: { getTeams: async () => mockTeams } }));
jest.mock('../../services/siteService', () => ({ siteService: { getSites: async () => mockSites } }));
jest.mock('../../services/companyService', () => ({ companyService: { getCompanies: async () => mockCompanies, getCompanyByName: async () => null } }));
jest.mock('../../services/dailyReportService', () => ({ dailyReportService: { getReportsByRange: async () => mockReports } }));
jest.mock('../../services/supportRateService', () => ({ supportRateService: { getAllSiteRates: async () => [] } }));
jest.mock('../../services/teamExpenseLedgerService', () => ({ teamExpenseLedgerService: { getClaimsByMonth: async () => [] } }));
jest.mock('../../services/statementOutputService', () => ({ statementOutputService: {} }));
jest.mock('../../services/estimateService', () => ({ estimateService: {} }));
jest.mock('../../services/materialService', () => ({ __esModule: true, default: {} }));
jest.mock('../../components/accounts/PagePrimaryAccountManager', () => ({ PagePrimaryAccountSettings: () => null }));
jest.mock('../../components/accounts/PagePrimaryAccountCard', () => () => null);
jest.mock('../../hooks/usePagePrimaryAccount', () => ({
    usePagePrimaryAccount: () => ({ account: { bankName: '위임검증은행', accountHolder: '위임검증예금주', accountNumber: 'TEST-DELEGATE' } }),
    ensurePagePrimaryAccountReady: () => true,
}));
jest.mock('../../config/firebase', () => ({ db: {}, storage: {} }));
jest.mock('firebase/firestore', () => ({ doc: jest.fn(), onSnapshot: () => () => undefined }));
jest.mock('firebase/storage', () => ({ ref: jest.fn(), getDownloadURL: async () => '' }));
jest.mock('file-saver', () => ({ saveAs: jest.fn() }));
jest.mock('html2canvas', () => jest.fn());

const mockWorker: Worker = {
    id: 'test-worker', name: '가상작업자', teamId: 'own-team', teamName: '가상작업팀',
    bankName: '기본검증은행', accountHolder: '기본검증예금주', accountNumber: 'TEST-BASIC',
    directPayBankName: '이전직불은행', directPayAccountHolder: '', directPayAccountNumber: '',
    laborStatementPayType: 'delegate',
};
const freshWorker: Worker = { ...mockWorker, laborStatementPayType: 'direct',
    directPayBankName: '최신직불은행', directPayAccountHolder: '최신직불예금주', directPayAccountNumber: 'TEST-DIRECT-NEW' };
const mockTeams = [
    { id: 'own-team', name: '가상작업팀', companyId: 'own', companyName: '청연', type: '시공팀' },
    { id: 'outside-team', name: '가상외부팀', companyId: 'outside', companyName: '가상외부회사', type: '시공팀' },
] as Team[];
const mockCompanies = [{ id: 'own', name: '청연' }, { id: 'outside', name: '가상외부회사' }] as Company[];
const mockSites = [{ id: 'test-site', name: '가상현장', constructorCompanyId: 'outside', constructorCompanyName: '가상외부회사',
    responsibleTeamId: 'outside-team', responsibleTeamName: '가상외부팀' }] as Site[];
const mockReports = [{ id: 'test-report', date: '2026-10-01', siteId: 'test-site', siteName: '가상현장',
    teamId: 'own-team', teamName: '가상작업팀', workers: [{ workerId: mockWorker.id, name: mockWorker.name, manDay: 1, unitPrice: 100000 }] }] as DailyReport[];

const views = ['generator', 'team', 'client'] as const;
const openStatement = async (view: typeof views[number]) => {
    const content = view === 'generator' ? <LaborCostStatementGeneratorPage /> : view === 'team' ? <SupportTeamPaymentPage /> :
        <SupportClientLaborStatementPanel yearMonth="2026-10" target={{ title: '가상현장', expenseClaims: [],
            rows: buildSupportRows(mockReports, mockTeams, mockCompanies, mockSites, [], [mockWorker]) }} onClose={() => undefined} />;
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={['/payroll/labor-cost-statement-generator?month=2026-10']}>{content}</MemoryRouter>);
    if (view === 'generator') {
        await screen.findByRole('option', { name: new RegExp(mockWorker.name) });
        fireEvent.click(screen.getByRole('button', { name: '자동채우기' }));
        await screen.findByDisplayValue(mockWorker.name);
        fireEvent.click(screen.getByLabelText('계좌/지급구분'));
    } else if (view === 'team') {
        fireEvent.click(await screen.findByRole('button', { name: '가상외부팀 노임명세서' }));
    }
    expect(screen.getByRole('checkbox', { name: 'DB 직불여부 적용' })).not.toBeChecked();
};

beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('payroll-labor-statement-defaults', JSON.stringify({ useWorkerMasterPayType: false }));
    (manpowerService.getWorkers as jest.Mock).mockImplementation(async (forceRefresh?: boolean) => [forceRefresh ? freshWorker : mockWorker]);
});

it.each(views.flatMap(view => [false, true].map(applyDb => ({ view, applyDb }))))('$view: DB 적용 $applyDb에 따라 기본/직불 계좌를 화면과 엑셀에 반영한다', async ({ view, applyDb }) => {
    await openStatement(view);
    if (applyDb) {
        fireEvent.click(screen.getByRole('checkbox', { name: 'DB 직불여부 적용' }));
    } else {
        fireEvent.click(screen.getByRole('checkbox', { name: /계좌\/지급구분/ }));
    }
    await waitFor(() => expect((screen.getByRole('checkbox', { name: 'DB 직불여부 적용' }) as HTMLInputElement).checked).toBe(applyDb));
    const expectedNumber = applyDb ? 'TEST-DIRECT-NEW' : 'TEST-BASIC';
    const expectedBank = applyDb ? '최신직불은행' : '기본검증은행';
    const expectedHolder = applyDb ? '최신직불예금주' : '기본검증예금주';
    const expectedPurpose = applyDb ? '직불계좌' : '기본계좌';
    const accountNumber = view === 'generator' ? screen.getByDisplayValue(expectedNumber) : screen.getByText(new RegExp(expectedNumber));
    const bank = view === 'generator' ? screen.getByDisplayValue(expectedBank) : screen.getByText(new RegExp(expectedBank));
    const holder = view === 'generator' ? screen.getByDisplayValue(expectedHolder) : screen.getByText(new RegExp(expectedHolder));
    expect(accountNumber).toBeVisible();
    expect(bank).toBeVisible();
    expect(holder).toBeVisible();
    expect(screen.getByText(new RegExp(expectedPurpose))).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: view === 'generator' ? '엑셀 저장' : '노무비 지급 명세서 엑셀 다운로드' }));
    await waitFor(() => expect(saveAs).toHaveBeenCalledTimes(1));
    const bytes = await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = reject; reader.readAsArrayBuffer((saveAs as unknown as jest.Mock).mock.calls[0][0]);
    });
    const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(bytes);
    const values = JSON.stringify(workbook.worksheets.map(sheet => sheet.getSheetValues()));
    expect(values).toContain(expectedNumber);
    expect(values).toContain(expectedBank);
    expect(values).toContain(expectedHolder);
    expect(values).toContain(expectedPurpose);
    expect(values).not.toContain(applyDb ? 'TEST-BASIC' : 'TEST-DIRECT-NEW');
    expect(values).not.toContain('이전직불은행');
});

it.each(views)('%s: DB 조회 실패 시 적용 상태를 바꾸지 않고 재시도를 안내한다', async view => {
    await openStatement(view);
    (manpowerService.getWorkers as jest.Mock).mockRejectedValueOnce(new Error('test read failure'));
    fireEvent.click(screen.getByRole('checkbox', { name: 'DB 직불여부 적용' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('다시 적용해 주세요');
    expect(screen.getByRole('checkbox', { name: 'DB 직불여부 적용' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'DB 직불여부 적용' })).toBeEnabled();
});

it.each(views)('%s: DB 위임 적용 후 해제하면 작업자 기본계좌를 복원한다', async view => {
    await openStatement(view);
    (manpowerService.getWorkers as jest.Mock).mockResolvedValueOnce([{ ...freshWorker, laborStatementPayType: 'delegate' }]);
    fireEvent.click(screen.getByRole('checkbox', { name: 'DB 직불여부 적용' }));
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'DB 직불여부 적용' })).toBeChecked());
    const delegated = view === 'generator' ? screen.getByDisplayValue('TEST-DELEGATE') : screen.getByText(/TEST-DELEGATE/);
    expect(delegated).toBeVisible();
    expect(screen.getByText(/대표계좌\(위임\)/)).toBeVisible();
    fireEvent.click(screen.getByRole('checkbox', { name: 'DB 직불여부 적용' }));
    const basic = view === 'generator' ? screen.getByDisplayValue('TEST-BASIC') : screen.getByText(/TEST-BASIC/);
    expect(basic).toBeVisible();
    expect(screen.getByText(/기본계좌/)).toBeVisible();
    expect(screen.queryByText(/대표계좌\(위임\)/)).not.toBeInTheDocument();
});

it('지원팀 명세서의 기본 상태는 작업자 기본계좌를 사용한다', async () => {
    await openStatement('team');
    fireEvent.click(screen.getByRole('checkbox', { name: '계좌/지급구분 표시' }));
    expect(screen.getByText(/TEST-BASIC/)).toBeVisible();
    expect(screen.queryByText(/이전직불은행/)).not.toBeInTheDocument();
});

it('생성기의 기본·직불 선택은 각각의 작업자 계좌를 가져온다', async () => {
    (manpowerService.getWorkers as jest.Mock).mockResolvedValue([freshWorker]);
    await openStatement('generator');
    fireEvent.click(screen.getByRole('checkbox', { name: /계좌\/지급구분/ }));
    expect(screen.getByDisplayValue('TEST-BASIC')).toBeVisible();
    fireEvent.click(screen.getAllByRole('radio', { name: '직불' })[0]);
    expect(screen.getByDisplayValue('TEST-DIRECT-NEW')).toBeVisible();
    fireEvent.click(screen.getAllByRole('radio', { name: '위임' })[0]);
    expect(screen.getByDisplayValue('TEST-DELEGATE')).toBeVisible();
    fireEvent.click(screen.getAllByRole('radio', { name: '기본' })[0]);
    expect(screen.getByDisplayValue('TEST-BASIC')).toBeVisible();
    fireEvent.click(screen.getAllByRole('radio', { name: '직불' })[0]);
    expect(screen.getByDisplayValue('TEST-DIRECT-NEW')).toBeVisible();
});
