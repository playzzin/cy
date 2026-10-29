import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SupportTeamPaymentPage from './SupportTeamPaymentPage';
import { hierarchyCompanies as mockCompanies, hierarchyReports as mockReports, hierarchySites as mockSites, hierarchyTeams as mockTeams } from './__fixtures__/supportTeamHierarchy';

jest.mock('../../services/teamService', () => ({ teamService: { getTeams: async () => mockTeams } }));
jest.mock('../../services/companyService', () => ({ companyService: { getCompanies: async () => mockCompanies, getCompanyByName: async () => null } }));
jest.mock('../../services/siteService', () => ({ siteService: { getSites: async () => mockSites } }));
jest.mock('../../services/dailyReportService', () => ({ dailyReportService: { getReportsByRange: async () => mockReports } }));
jest.mock('../../services/manpowerService', () => ({ manpowerService: { getWorkers: async () => [] } }));
jest.mock('../../services/supportRateService', () => ({ supportRateService: { getAllSiteRates: async () => [] } }));
jest.mock('../../services/teamExpenseLedgerService', () => ({ teamExpenseLedgerService: { getClaimsByMonth: async () => [] } }));
jest.mock('../../services/statementOutputService', () => ({ statementOutputService: {} }));
jest.mock('../../components/accounts/PagePrimaryAccountManager', () => ({ PagePrimaryAccountSettings: () => null }));
jest.mock('../../components/accounts/PagePrimaryAccountCard', () => () => null);
jest.mock('../../hooks/usePagePrimaryAccount', () => ({ usePagePrimaryAccount: () => ({ account: null }), ensurePagePrimaryAccountReady: () => true }));
jest.mock('../../config/firebase', () => ({ db: {}, storage: {} }));
jest.mock('firebase/firestore', () => ({ doc: jest.fn(), onSnapshot: () => () => undefined }));
jest.mock('firebase/storage', () => ({ ref: jest.fn(), getDownloadURL: async () => '' }));
jest.mock('file-saver', () => ({ saveAs: jest.fn() }));
jest.mock('html2canvas', () => jest.fn());

const renderScope = (scope: 'external' | 'incoming' | 'internalOut' | 'internalIn') =>
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><SupportTeamPaymentPage scope={scope} /></MemoryRouter>);
const rowFor = (button: HTMLElement) => within(screen.getAllByRole('row').reverse().find(row =>
    within(row).queryByRole('button', { name: button.getAttribute('aria-label')! }) === button
)!);

beforeEach(() => localStorage.clear());

it.each([
    { scope: 'internalOut' as const, direction: '내부지원간곳', team: '가상지원팀', teamManDay: '4.5', siteCount: 3, label: '현장담당팀', counterTeam: '가상담당팀' },
    { scope: 'internalIn' as const, direction: '내부지원온곳', team: '가상담당팀', teamManDay: '3.5', siteCount: 2, label: '작업팀', counterTeam: '가상지원팀' },
])('$direction: 기준팀 → 상대팀 → 현장 → 작업자를 구분하고 합계를 유지한다', async ({ scope, direction, team, teamManDay, siteCount, label, counterTeam }) => {
    renderScope(scope);
    const group = await screen.findByRole('button', { name: `${direction} 팀 목록` });
    expect(group).toHaveAttribute('aria-expanded', 'true');
    expect(rowFor(group).getByText('5')).toBeInTheDocument();
    expect(rowFor(group).getAllByRole('cell')[5]).toHaveTextContent('1,150,000');

    const teamButton = screen.getByRole('button', { name: `${team} ${label} 목록` });
    expect(teamButton).toHaveTextContent(`현장 ${siteCount}개`);
    expect(rowFor(teamButton).getByText(teamManDay)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: `${team}의 ${label} ${counterTeam} 현장 목록` })).not.toBeInTheDocument();
    fireEvent.click(teamButton);
    expect(teamButton).toHaveAttribute('aria-expanded', 'true');

    const counterTeamButton = screen.getByRole('button', { name: `${team}의 ${label} ${counterTeam} 현장 목록` });
    expect(counterTeamButton).toHaveTextContent('현장 2개');
    expect(rowFor(counterTeamButton).getByText('3')).toBeInTheDocument();
    expect(rowFor(counterTeamButton).getAllByRole('cell')[3]).toHaveTextContent('690,000');
    expect(screen.queryByRole('button', { name: `${team} ${counterTeam} 가상 1현장 작업자 상세` })).not.toBeInTheDocument();
    fireEvent.click(counterTeamButton);
    const site = screen.getByRole('button', { name: `${team} ${counterTeam} 가상 1현장 작업자 상세` });
    expect(rowFor(site).getByText('1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: `${team} ${counterTeam} 가상 2현장 작업자 상세` })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /본인현장 작업자 상세|외부현장 작업자 상세/ })).not.toBeInTheDocument();
    fireEvent.click(site);
    const detail = screen.getByRole('table', { name: `${counterTeam} 가상 1현장 작업자` });
    expect(within(detail).getAllByText(/가상작업자/)).toHaveLength(1);
    expect(within(detail).getByText('가상작업자1')).toBeInTheDocument();
    expect(within(detail).queryByText('가상작업자3')).not.toBeInTheDocument();
    expect(within(detail).queryByText('가상작업자6')).not.toBeInTheDocument();
    expect(rowFor(group).getAllByRole('cell')[0]).toHaveAttribute('rowspan', '4');

    const other = scope === 'internalOut' ? '가상다른담당팀' : '가상협력팀';
    fireEvent.click(screen.getByRole('button', { name: `${team}의 ${label} ${other} 현장 목록` }));
    expect(counterTeamButton).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('table', { name: `${counterTeam} 가상 1현장 작업자` })).not.toBeInTheDocument();
    const otherSiteName = scope === 'internalOut' ? '가상 3현장' : '가상 1현장';
    const otherSite = screen.getByRole('button', { name: `${team} ${other} ${otherSiteName} 작업자 상세` });
    expect(rowFor(otherSite).getByText(scope === 'internalOut' ? '1.5' : '0.5')).toBeInTheDocument();
    fireEvent.click(otherSite);
    expect(within(screen.getByRole('table', { name: `${other} ${otherSiteName} 작업자` })).getByText(scope === 'internalOut' ? '가상작업자7' : '가상작업자3')).toBeInTheDocument();

    fireEvent.click(teamButton);
    expect(screen.queryByRole('heading', { name: /가상 1현장 작업자 상세/ })).not.toBeInTheDocument();
    fireEvent.click(group);
    expect(screen.queryByRole('button', { name: `${team} ${label} 목록` })).not.toBeInTheDocument();
    expect(rowFor(group).getAllByRole('cell')[5]).toHaveTextContent('1,150,000');
    fireEvent.click(group);
    expect(screen.getByRole('button', { name: `${team} ${label} 목록` })).toHaveAttribute('aria-expanded', 'false');
});

it('다른 팀을 펼치면 그 팀의 현장과 공수만 표시한다', async () => {
    renderScope('internalOut');
    fireEvent.click(await screen.findByRole('button', { name: '가상지원팀 현장담당팀 목록' }));
    fireEvent.click(screen.getByRole('button', { name: '가상협력팀 현장담당팀 목록' }));
    expect(screen.getByRole('button', { name: '가상지원팀 현장담당팀 목록' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('table', { name: '가상지원팀 현장담당팀별 현장' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '가상협력팀의 현장담당팀 가상담당팀 현장 목록' }));
    const site = screen.getByRole('button', { name: '가상협력팀 가상담당팀 가상 1현장 작업자 상세' });
    expect(rowFor(site).getByText('0.5')).toBeInTheDocument();
});

it('작업팀으로 나눈 현장에서도 기존 현장 전체 정산을 열어 단가와 명세서를 적용할 수 있다', async () => {
    renderScope('internalIn');
    fireEvent.click(await screen.findByRole('button', { name: '가상담당팀 작업팀 목록' }));
    fireEvent.click(screen.getByRole('button', { name: '가상담당팀의 작업팀 가상지원팀 현장 목록' }));
    fireEvent.click(screen.getByRole('button', { name: '가상담당팀 가상지원팀 가상 1현장 현장 전체 정산' }));
    expect(screen.getByText(/가상 1현장 전체 정산/)).toBeInTheDocument();
    const wholeSite = screen.getByRole('button', { name: '가상담당팀 가상 1현장 작업자 상세' });
    expect(rowFor(wholeSite).getByText('1.5')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: '가상 1현장 지원단가' }), { target: { value: '240000' } });
    const splitSite = screen.getByRole('button', { name: '가상담당팀 가상지원팀 가상 1현장 작업자 상세' });
    expect(rowFor(splitSite).getAllByRole('cell')[3]).toHaveTextContent('240,000');
    expect(rowFor(wholeSite).getAllByRole('cell')[4]).toHaveTextContent('360,000');
    fireEvent.click(screen.getByRole('button', { name: '가상 1현장 노임명세서' }));
    expect(screen.getByRole('checkbox', { name: 'DB 직불여부 적용' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '현장 정산 닫기' }));
    expect(screen.queryByRole('textbox', { name: '가상 1현장 지원단가' })).not.toBeInTheDocument();
});

it.each([
    { scope: 'external' as const, direction: '외부지원간곳', site: '가상 외부현장', teamDays: '3.5', siteDays: '1.5', workerCount: 2, worker: '가상작업자5', excludedWorker: '가상작업자10' },
    { scope: 'incoming' as const, direction: '외부지원온곳', site: '가상 1현장', teamDays: '4.5', siteDays: '1', workerCount: 1, worker: '가상작업자6', excludedWorker: '가상작업자11' },
])('$direction: 기존 정산 팀 → 현장 순서로 복원한다', async ({ scope, direction, site, teamDays, siteDays, workerCount, worker, excludedWorker }) => {
    renderScope(scope);
    const primary = await screen.findByRole('button', { name: '가상외부팀 현장 목록' });
    expect(rowFor(primary).getByText(teamDays)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '가상다른외부팀 현장 목록' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '가상외부팀 노임명세서' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: `${direction} 팀별 조회` })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /가상지원팀 현장담당팀 목록|가상담당팀 작업팀 목록/ })).not.toBeInTheDocument();
    fireEvent.click(primary);
    const siteButton = screen.getByRole('button', { name: `가상외부팀 ${site} 작업자 상세` });
    expect(rowFor(siteButton).getByText(siteDays)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: `${site} 지원단가` })).toBeInTheDocument();
    fireEvent.click(siteButton);
    const workers = within(screen.getByRole('cell', { name: new RegExp(`4단 ${site} 작업자 상세`) }));
    expect(workers.getByText(worker)).toBeInTheDocument();
    expect(workers.queryByText(excludedWorker)).not.toBeInTheDocument();
    expect(workers.getAllByText(/가상작업자/)).toHaveLength(workerCount);
    fireEvent.click(screen.getByRole('button', { name: '가상다른외부팀 현장 목록' }));
    expect(primary).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('heading', { name: new RegExp(`${site} 작업자 상세`) })).not.toBeInTheDocument();
});

it.each([
    { scope: 'external' as const, site: '가상 외부현장', wholeSiteDays: '1.5', wholeSiteAmount: '360,000' },
    { scope: 'incoming' as const, site: '가상 1현장', wholeSiteDays: '1', wholeSiteAmount: '240,000' },
])('$scope: 원래 화면에서 현장 단가·명세서를 바로 사용할 수 있다', async ({ scope, site, wholeSiteDays, wholeSiteAmount }) => {
    renderScope(scope);
    fireEvent.click(await screen.findByRole('button', { name: '가상외부팀 현장 목록' }));
    const settlementSite = screen.getByRole('button', { name: `가상외부팀 ${site} 작업자 상세` });
    expect(rowFor(settlementSite).getByText(wholeSiteDays)).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: `${site} 지원단가` }), { target: { value: '240000' } });
    expect(rowFor(settlementSite).getAllByRole('cell')[4]).toHaveTextContent(wholeSiteAmount);
    fireEvent.click(screen.getByRole('button', { name: `${site} 노임명세서` }));
    expect(screen.getByRole('checkbox', { name: 'DB 직불여부 적용' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '현장 정산 닫기' })).not.toBeInTheDocument();
});

it('외부지원 현장 필터가 기존 정산 대상 팀과 합계를 갱신한다', async () => {
    renderScope('external');
    fireEvent.click(await screen.findByRole('button', { name: '가상외부팀 현장 목록' }));
    const filter = screen.getAllByRole('combobox').find(select => within(select).queryByRole('option', { name: '모든 현장' }))!;
    fireEvent.change(filter, { target: { value: 'outside-three' } });
    expect(screen.queryByRole('button', { name: '가상외부팀 현장 목록' })).not.toBeInTheDocument();
    const primary = screen.getByRole('button', { name: '가상다른외부팀 현장 목록' });
    expect(rowFor(primary).getByText('1.5')).toBeInTheDocument();
    expect(rowFor(primary).getAllByRole('cell')[4]).toHaveTextContent('345,000');
});
