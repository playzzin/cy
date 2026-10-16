import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import WhiteboardStatusBoard from './WhiteboardStatusBoard';
import { dailyReportService } from '../../services/dailyReportService';
import { teamSettlementService } from '../../services/teamSettlementService';
import { getTeamScopedRows } from '../../services/teamScopedReadService';

let mockUid = 'admin';
let mockCompaniesMissing = false;
let mockMasterLoading = false;
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
    return { useMasterData: () => ({ ...master, loading: mockMasterLoading, companies: mockCompaniesMissing ? [] : master.companies }) };
});

const originalElementScrollTo = HTMLElement.prototype.scrollTo;
beforeAll(() => {
    jest.spyOn(window, 'scrollTo').mockImplementation(() => {});
    HTMLElement.prototype.scrollTo = jest.fn();
});
afterAll(() => {
    jest.restoreAllMocks();
    if (originalElementScrollTo) HTMLElement.prototype.scrollTo = originalElementScrollTo;
    else delete (HTMLElement.prototype as Partial<HTMLElement>).scrollTo;
});

beforeEach(() => {
    mockUid = 'admin';
    mockCompaniesMissing = false;
    mockMasterLoading = false;
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
        { workerId: 'other-worker', name: '다른 작업자', manDay: 7, unitPrice: 100 },
    ] },
];
const allowOwnTeam = () => {
    mockUid = 'worker';
    (getTeamScopedRows as jest.Mock).mockImplementation(async collection => ({
        teams: [ownTeam],
        sites: [ownSite],
        workers: [{ id: 'own-worker', name: '우리 작업자', teamId: 'legacy-a' }],
        daily_reports: teamReports,
        whiteboard_participation: [{ mode: 'own-workers' }],
    }[collection as string]));
};

test.each(['site', 'team'])('개인 공수 조회는 %s 보기에서도 URL과 저장된 타 팀 선택을 무시한다', async view => {
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

test('개인 일보 조회가 실패하면 전체 조회로 전환하지 않는다', async () => {
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

test.each(['site', 'team'])('개인 공수의 %s 보기에서 회사 목록이 비어 있어도 허용된 공수를 집계한다', async view => {
    allowOwnTeam();
    mockCompaniesMissing = true;
    renderPage(`view=${view}`);
    await screen.findByRole('heading', { name: view === 'site' ? '첫 번째 현장' : '가팀' });
    expect(screen.getAllByText('2.0').length).toBeGreaterThan(0);
    expect(dailyReportService.getReportsByRange).not.toHaveBeenCalled();
});

test('팀 권한 확인이 끝나면 공용 마스터 로딩에 막히지 않고 참여 현황을 표시한다', async () => {
    allowOwnTeam();
    mockMasterLoading = true;
    renderPage('view=site');
    await screen.findByRole('heading', { name: '첫 번째 현장' });
    expect(screen.queryByText('조회 권한을 확인하는 중입니다.')).not.toBeInTheDocument();
});

test('개인 공수 조회에서 현장과 일보가 없으면 참여 현황 안내를 표시한다', async () => {
    allowOwnTeam();
    const read = (getTeamScopedRows as jest.Mock).getMockImplementation()!;
    (getTeamScopedRows as jest.Mock).mockImplementation(collection => ['sites', 'daily_reports'].includes(collection) ? Promise.resolve([]) : read(collection));
    renderPage('view=site');
    await screen.findByText('선택한 조건에 해당하는 내 팀 참여 현황이 없습니다.');
    expect(screen.queryByText(/현장 관리 메뉴에서/)).not.toBeInTheDocument();
});

const participantReports = [
    { id: 'own', date: '2026-10-01', siteId: 'site-a', siteName: '첫 번째 현장', responsibleTeamId: 'a', responsibleTeamName: '가팀', teamId: 'a', teamName: '가팀', teamCompanyId: 'company', totalManDay: 2 },
    { id: 'support', date: '2026-10-01', siteId: 'site-a', siteName: '첫 번째 현장', responsibleTeamId: 'a', responsibleTeamName: '가팀', teamId: 'b', teamName: '나팀', teamCompanyId: 'company', totalManDay: 3.5 },
    { id: 'external', date: '2026-10-01', siteId: 'site-a', siteName: '첫 번째 현장', responsibleTeamId: 'a', responsibleTeamName: '가팀', teamId: 'external', teamName: '외부 참여팀', teamCompanyId: 'external-company', totalManDay: 4 },
];
const allowResponsibleSites = (reports = participantReports) => {
    allowOwnTeam();
    mockUid = 'leader';
    const read = (getTeamScopedRows as jest.Mock).getMockImplementation()!;
    (getTeamScopedRows as jest.Mock).mockImplementation(collection => collection === 'whiteboard_participation'
        ? Promise.resolve([{ mode: 'responsible-sites', reports }]) : read(collection));
};

test('팀장은 내 담당 현장에 투입된 모든 팀의 공수를 보고 개인 일보 필터를 적용하지 않는다', async () => {
    allowResponsibleSites();
    mockCompaniesMissing = true;
    renderPage('view=site&teamId=b');
    fireEvent.click(await screen.findByRole('heading', { name: '첫 번째 현장' }));
    await screen.findByRole('heading', { name: '참여 팀 현황' });
    expect(screen.getByText('상세 목록 (3건)')).toBeInTheDocument();
    expect(screen.getAllByText('9.5').length).toBeGreaterThan(0);
    expect(screen.getByText('나팀')).toBeInTheDocument();
    expect(screen.getByText('외부 참여팀')).toBeInTheDocument();
    expect(screen.getByText('3.5')).toBeInTheDocument();
    expect(screen.getByText('4.0')).toBeInTheDocument();
    fireEvent.click(screen.getByText('외부 참여팀'));
    expect(screen.queryByText('작업자 상세 내역')).not.toBeInTheDocument();
    expect(getTeamScopedRows).toHaveBeenCalledWith('whiteboard_participation', { yearMonth: '2026-10' });
    expect((getTeamScopedRows as jest.Mock).mock.calls.some(([name]) => name === 'daily_reports')).toBe(false);
    expect(dailyReportService.getReportsByRange).not.toHaveBeenCalled();
});

test('팀별 보기에서도 내 담당 현장에 지원 온 팀들의 공수가 유지된다', async () => {
    allowResponsibleSites();
    renderPage('view=team');
    await screen.findByRole('heading', { name: '외부 참여팀' });
    expect(screen.getByRole('heading', { name: '나팀' })).toBeInTheDocument();
    expect(screen.getAllByText('9.5').length).toBeGreaterThan(0);
});

test('담당 현장 참여 조회가 실패하면 소속 팀원만의 합계를 정상 결과로 대체하지 않는다', async () => {
    allowResponsibleSites();
    const read = (getTeamScopedRows as jest.Mock).getMockImplementation()!;
    (getTeamScopedRows as jest.Mock).mockImplementation(collection => collection === 'whiteboard_participation' ? Promise.reject(new Error('unavailable')) : read(collection));
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
        renderPage('view=site');
        await screen.findByText(/현황 데이터를 불러오지 못했습니다/);
        expect((getTeamScopedRows as jest.Mock).mock.calls.some(([name]) => name === 'daily_reports')).toBe(false);
    } finally { log.mockRestore(); }
});

test('담당 현장에 일보가 없으면 담당팀 설정과 참여 일보 안내를 표시한다', async () => {
    allowResponsibleSites([]);
    renderPage('view=site');
    await screen.findByText('선택한 조건에 해당하는 담당 현장의 참여 공수가 없습니다.');
});

test('담당 현장 목록에 없는 지원 현장도 소속 작업자의 참여 내역만 표시한다', async () => {
    allowOwnTeam();
    const read = (getTeamScopedRows as jest.Mock).getMockImplementation()!;
    (getTeamScopedRows as jest.Mock).mockImplementation(collection => {
        if (collection === 'sites') return Promise.resolve([ownSite]);
        if (collection === 'daily_reports') return Promise.resolve([...teamReports, {
            id: 'support', date: '2026-10-02', siteId: 'support-site', siteName: '지원 참여 현장',
            responsibleTeamId: 'b', responsibleTeamName: '나팀', companyId: 'other-company',
            teamId: 'b', teamName: '나팀', totalManDay: 99,
            workers: [
                { workerId: 'own-worker', name: '우리 작업자', teamId: 'b', manDay: 3, unitPrice: 100 },
                { workerId: 'other-worker', name: '다른 작업자', teamId: 'a', manDay: 96, unitPrice: 900 },
            ],
        }]);
        return read(collection);
    });
    renderPage('view=site&teamId=b');
    const heading = await screen.findByRole('heading', { name: '지원 참여 현장' });
    fireEvent.click(heading);
    await screen.findByRole('heading', { name: '참여 팀 현황' });
    expect(screen.getByText('상세 목록 (1건)')).toBeInTheDocument();
    expect(screen.getAllByText('3.0').length).toBeGreaterThan(0);
    expect(screen.queryByText('96.0')).not.toBeInTheDocument();
    expect(screen.queryByText('다른 작업자')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '두 번째 현장' })).not.toBeInTheDocument();
    expect(dailyReportService.getReportsByRange).not.toHaveBeenCalled();
});
