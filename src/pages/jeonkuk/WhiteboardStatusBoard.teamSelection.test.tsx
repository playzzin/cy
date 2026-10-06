import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import WhiteboardStatusBoard from './WhiteboardStatusBoard';
import { dailyReportService } from '../../services/dailyReportService';
import { teamSettlementService } from '../../services/teamSettlementService';
import { getTeamScopedRows } from '../../services/teamScopedReadService';

let mockUid = 'admin';
jest.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: { uid: mockUid } }) }));
jest.mock('../../services/teamScopedReadService', () => ({ getTeamScopedRows: jest.fn() }));

jest.mock('../../services/dailyReportService', () => ({ dailyReportService: { getReportsByRange: jest.fn() } }));
jest.mock('../../services/teamSettlementService', () => ({ teamSettlementService: { getTeamDisplayOrder: jest.fn().mockResolvedValue([]) } }));
jest.mock('../../components/common/OutputManagementTabs', () => () => null);
jest.mock('../../contexts/MasterDataContext', () => {
    const master = {
        loading: false,
        companies: [{ id: 'company', name: '청연 테스트' }],
        teams: [
            { id: 'a', name: '가팀', companyId: 'company', color: '#ffcc00' },
            { id: 'b', name: '나팀', companyId: 'company', color: '#000080' }
        ],
        sites: [
            { id: 'site-a', name: '첫 번째 현장', companyId: 'company', responsibleTeamId: 'a', status: 'active' },
            { id: 'site-b', name: '두 번째 현장', companyId: 'company', responsibleTeamId: 'b', status: 'active' }
        ]
    };
    return { useMasterData: () => master };
});

beforeEach(() => {
    mockUid = 'admin';
    (getTeamScopedRows as jest.Mock).mockReset().mockResolvedValue(null);
    sessionStorage.clear();
    localStorage.clear();
    sessionStorage.setItem('output-management:whiteboard-status:v1', JSON.stringify({ mainCompanyId: 'company' }));
    (dailyReportService.getReportsByRange as jest.Mock).mockReset();
    (teamSettlementService.getTeamDisplayOrder as jest.Mock).mockResolvedValue([]);
});

const renderPage = (query: string) => render(
    <MemoryRouter initialEntries={[`/jeonkuk/integrated-status?year=2026&month=10&companyId=company&${query}`]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <WhiteboardStatusBoard />
    </MemoryRouter>
);

test('팀별 조회 URL의 선택은 일보 로딩이 끝나도 유지된다', async () => {
    (dailyReportService.getReportsByRange as jest.Mock).mockResolvedValue([
        { id: 'report', siteId: 'site-b', siteName: '두 번째 현장', companyId: 'company', teamId: 'b', teamName: '나팀', totalManDay: 2, workers: [] }
    ]);
    renderPage('view=team&teamId=b');
    await waitFor(() => expect(screen.getByRole('button', { name: '나팀 선택' })).toHaveAttribute('aria-pressed', 'true'));
    expect(screen.getByRole('button', { name: '전체 팀' })).toHaveAttribute('aria-pressed', 'false');
    expect(JSON.parse(sessionStorage.getItem('output-management:whiteboard-status:v1')!).selectedTeamId).toBe('b');
});

test('현장별 조회에서 팀 버튼으로 담당 현장을 필터하고 전체 팀으로 복귀한다', async () => {
    (dailyReportService.getReportsByRange as jest.Mock).mockResolvedValue([
        { id: 'report-a', siteId: 'site-a', siteName: '첫 번째 현장', companyId: 'company', responsibleTeamId: 'a', teamId: 'a', teamName: '가팀', totalManDay: 1, workers: [] },
        { id: 'report-b', siteId: 'site-b', siteName: '두 번째 현장', companyId: 'company', responsibleTeamId: 'b', teamId: 'b', teamName: '나팀', totalManDay: 2, workers: [] }
    ]);
    renderPage('view=site');
    await waitFor(() => expect(screen.getByRole('button', { name: '새로고침' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: '나팀 선택' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: '첫 번째 현장' })).not.toBeInTheDocument());
    expect(screen.getByRole('heading', { name: '두 번째 현장' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '전체 팀' }));
    expect(await screen.findByRole('heading', { name: '첫 번째 현장' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '두 번째 현장' })).toBeInTheDocument();
});

const ownTeam = { id: 'a', legacyId: 'legacy-a', name: '가팀', companyId: 'company' };
const ownSite = { id: 'site-a', legacyId: 'legacy-site-a', name: '첫 번째 현장', companyId: 'company', responsibleTeamId: 'legacy-a', status: 'active' };
const teamReports = [
    { id: 'mixed', date: '2026-10-01', siteId: 'legacy-site-a', siteName: '첫 번째 현장', teamId: 'b', teamName: '나팀', totalManDay: 99, workers: [
        { workerId: 'own-worker', name: '우리 작업자', manDay: 2, unitPrice: 100, teamId: 'b' },
        { workerId: 'other-worker', name: '다른 작업자', manDay: 97, unitPrice: 100, teamId: 'a' },
    ] },
    { id: 'other-site', date: '2026-10-01', siteId: 'site-b', siteName: '두 번째 현장', teamId: 'a', teamName: '가팀', workers: [
        { workerId: 'own-worker', name: '우리 작업자', manDay: 7, unitPrice: 100 },
    ] },
];
const allowOwnTeam = () => {
    mockUid = 'leader';
    (getTeamScopedRows as jest.Mock).mockImplementation(async collection => ({
        teams: [ownTeam],
        sites: [ownSite, { id: 'site-b', name: '두 번째 현장', responsibleTeamId: 'b' }],
        workers: [{ id: 'own-worker', name: '우리 작업자', teamId: 'legacy-a' }],
        daily_reports: teamReports,
    }[collection as string]));
};

test.each(['site', 'team'])('팀장은 %s 보기에서도 URL과 저장된 타 팀 선택을 무시하고 자기 팀만 본다', async view => {
    allowOwnTeam();
    sessionStorage.setItem('output-management:whiteboard-status:v1', JSON.stringify({ selectedTeamId: 'b', selectedCompanyId: 'other-company' }));
    renderPage(`view=${view}&teamId=b`);
    await screen.findByRole('heading', { name: view === 'site' ? '첫 번째 현장' : '가팀' });
    expect(screen.queryByRole('heading', { name: '두 번째 현장' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '나팀' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '전체 팀' })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: '회사 선택' })).not.toBeInTheDocument();
    expect(screen.queryByText('다른 작업자')).not.toBeInTheDocument();
    expect(screen.getAllByText('2.0').length).toBeGreaterThan(0);
    expect(dailyReportService.getReportsByRange).not.toHaveBeenCalled();
    expect(getTeamScopedRows).toHaveBeenCalledWith('daily_reports', { startDate: '2026-10-01', endDate: '2026-10-31' });
    expect(JSON.parse(sessionStorage.getItem('output-management:whiteboard-status:v1')!).selectedTeamId).toBe('a');
});

test('팀 연결 실패 시 전체 현황을 조회하지 않고 재시도 안내를 보여준다', async () => {
    (getTeamScopedRows as jest.Mock).mockRejectedValue(new Error('permission-denied'));
    renderPage('view=site');
    expect(await screen.findByRole('alert')).toHaveTextContent('소속 팀과 조회 권한을 확인하지 못했습니다');
    expect(dailyReportService.getReportsByRange).not.toHaveBeenCalled();
    expect(screen.queryByRole('heading', { name: '통합 현황판' })).not.toBeInTheDocument();
    allowOwnTeam();
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    await screen.findByRole('heading', { name: '첫 번째 현장' });
});

test('권한 확인 중에는 이전 계정이나 마스터 데이터의 현황을 표시하지 않는다', async () => {
    (getTeamScopedRows as jest.Mock).mockReturnValue(new Promise(() => {}));
    renderPage('view=site');
    expect(screen.getByRole('status')).toHaveTextContent('조회 권한을 확인하는 중');
    expect(screen.queryByRole('heading', { name: '통합 현황판' })).not.toBeInTheDocument();
    expect(dailyReportService.getReportsByRange).not.toHaveBeenCalled();
});

test('팀장 일보 조회가 실패하면 전체 조회로 전환하지 않는다', async () => {
    allowOwnTeam();
    const read = (getTeamScopedRows as jest.Mock).getMockImplementation()!;
    (getTeamScopedRows as jest.Mock).mockImplementation(collection => collection === 'daily_reports'
        ? Promise.reject(new Error('permission-denied')) : read(collection));
    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
        renderPage('view=site');
        await screen.findByText(/현황 데이터를 불러오지 못했습니다/);
        expect(screen.queryByRole('heading', { name: '첫 번째 현장' })).not.toBeInTheDocument();
        expect(dailyReportService.getReportsByRange).not.toHaveBeenCalled();
    } finally { errorLog.mockRestore(); }
});
