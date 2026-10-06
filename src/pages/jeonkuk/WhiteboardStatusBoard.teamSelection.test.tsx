import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import WhiteboardStatusBoard from './WhiteboardStatusBoard';
import { dailyReportService } from '../../services/dailyReportService';
import { teamSettlementService } from '../../services/teamSettlementService';

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
