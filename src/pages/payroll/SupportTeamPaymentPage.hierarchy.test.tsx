import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { statementOutputService } from '../../services/statementOutputService';
import { MemoryRouter } from 'react-router-dom';
import SupportTeamPaymentPage from './SupportTeamPaymentPage';
import { hierarchyCompanies as mockCompanies, hierarchyReports as mockReports, hierarchySites as mockSites, hierarchyTeams as mockTeams } from './__fixtures__/supportTeamHierarchy';

jest.mock('../../services/teamService', () => ({ teamService: { getTeams: async () => mockTeams } }));
jest.mock('../../services/companyService', () => ({ companyService: { getCompanies: async () => mockCompanies, getCompanyByName: async () => null } }));
jest.mock('../../services/siteService', () => ({ siteService: { getSites: async () => mockSites } }));
jest.mock('../../services/dailyReportService', () => ({ dailyReportService: { getReportsByRange: async () => mockReports } }));
jest.mock('../../services/manpowerService', () => ({ manpowerService: { getWorkers: async () => [] } }));
jest.mock('../../services/teamExpenseLedgerService', () => ({ teamExpenseLedgerService: { getClaimsByMonth: async () => [] } }));
jest.mock('../../services/statementOutputService', () => ({ statementOutputService: { upsertOutput: jest.fn() } }));
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

it('팀·현장 명세서는 선택한 행 바로 아래에서 열리고 전체 미리보기는 정산표의 첫 행에서 열린다', async () => {
    renderScope('external');
    const team = await screen.findByRole('button', { name: '가상외부팀 노임명세서' });
    const tbody = screen.getAllByRole('rowgroup').find(body =>
        within(body).queryByRole('button', { name: '가상외부팀 노임명세서' }) === team
    ) as HTMLTableSectionElement;
    const rowBelow = (button: HTMLElement) => {
        const index = Array.from(tbody.rows).findIndex(row => row.contains(button));
        return tbody.rows[index + 1];
    };
    const groupCell = tbody.rows[0].cells[0];
    const preview = screen.getByRole('button', { name: '노무내역서 미리보기' });
    const editor = () => screen.getByRole('region', { name: '노임명세서 편집' });

    fireEvent.click(team);
    expect(rowBelow(team).cells[0]).toContainElement(editor());
    expect(rowBelow(team).cells[0].colSpan).toBe(12);
    expect(groupCell.rowSpan).toBe(tbody.rows.length);
    expect(team).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(screen.getByRole('button', { name: '가상외부팀 현장 목록' }));
    const site = screen.getByRole('button', { name: '가상 외부현장 노임명세서' });
    fireEvent.click(site);
    expect(rowBelow(site).cells[0]).toContainElement(editor());
    expect(groupCell.rowSpan).toBe(tbody.rows.length);
    expect(team).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(preview);
    expect(tbody.rows[0]).toContainElement(editor());
    expect(tbody.rows[0].cells[0].colSpan).toBe(13);
    expect(groupCell.rowSpan).toBe(tbody.rows.length - 1);
    expect(site).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(site);
    expect(preview).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(site);
    expect(screen.queryByRole('region', { name: '노임명세서 편집' })).not.toBeInTheDocument();
    expect(groupCell.rowSpan).toBe(tbody.rows.length);
    expect(site).toBeVisible();
});

it('팀 명세서는 선택한 현장의 월 청구단가로 시작하고 현장을 오가도 편집값을 전체 엑셀과 문서대장에 반영한다', async () => {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    localStorage.setItem(`support-team-payment-rate-overrides-v1:${month}`, JSON.stringify({
        bulkRate: 250000, siteRates: { '외부지원간곳::external::outside': 260000 },
    }));
    renderScope('external');
    fireEvent.click(await screen.findByRole('button', { name: '가상외부팀 노임명세서' }));
    expect(screen.getByRole('heading', { name: '명세서 생성기' })).toBeVisible();
    const chooseSite = (name: string) => {
        fireEvent.click(screen.getByRole('button', { name: /^가상외부팀 ·/ }));
        expect(within(screen.getByRole('listbox')).getAllByRole('option')).toHaveLength(2);
        fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name }));
    };
    chooseSite('가상외부팀 · 가상 외부현장');
    expect(screen.getByLabelText('가상작업자5 단가')).toHaveValue('260,000');
    fireEvent.change(screen.getByLabelText('가상작업자5 1일 공수'), { target: { value: '2' } });
    chooseSite('가상외부팀 · 가상 외부2현장');
    expect(screen.getByLabelText('가상작업자9 단가')).toHaveValue('250,000');
    chooseSite('가상외부팀 · 가상 외부현장');
    expect(screen.getByLabelText('가상작업자5 1일 공수')).toHaveValue('2');
    fireEvent.click(screen.getByRole('button', { name: '전체 현장 엑셀 저장' }));
    await waitFor(() => expect(saveAs).toHaveBeenCalled());
    const blob = (saveAs as unknown as jest.Mock).mock.calls[0][0];
    const bytes = await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = reject; reader.readAsArrayBuffer(blob);
    });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(bytes);
    expect(workbook.worksheets).toHaveLength(2);
    const first = workbook.worksheets.find(sheet => sheet.name.endsWith('가상 외부현장'))!;
    expect(first.getCell('E6').value).toBe(2);
    expect(JSON.stringify(first.getSheetValues())).toContain('"result":520000');
    expect(JSON.stringify(workbook.worksheets.map(sheet => sheet.getSheetValues()))).not.toContain('가상작업자10');
    fireEvent.click(screen.getByRole('button', { name: '옵션 저장' }));
    await waitFor(() => expect(statementOutputService.upsertOutput).toHaveBeenCalledWith(expect.objectContaining({
        yearMonth: month, amountSummary: { manDay: 4.5, supplyAmount: 1150000, totalAmount: 1150000 },
    })));
}, 20000);

it('월 단가는 첫 조회부터 각각 23만 원이며 변경한 월과 현장만 새 금액을 사용한다', async () => {
    const { unmount } = renderScope('external');
    const teamButton = () => screen.findByRole('button', { name: '가상외부팀 현장 목록' });
    const siteInput = (rate: string) => screen.getByRole('textbox', { name: `가상 외부현장 ${rate}` });
    const bulkInput = (rate: string) => screen.getByRole('textbox', { name: `일괄 적용 ${rate}` });
    fireEvent.click(await teamButton());
    expect(screen.getAllByText('월 적용됨')).toHaveLength(2);
    expect(siteInput('지원단가')).toHaveValue('230,000');
    expect(siteInput('청구단가')).toHaveValue('230,000');

    fireEvent.change(siteInput('지원단가'), { target: { value: '245000' } });
    fireEvent.change(bulkInput('지원단가'), { target: { value: '240000' } });
    fireEvent.click(screen.getByRole('button', { name: '일괄적용' }));
    fireEvent.change(bulkInput('청구단가'), { target: { value: '260000' } });
    expect(screen.getByText('현재 230,000원 적용 중')).toBeInTheDocument();
    expect(siteInput('청구단가')).toHaveValue('230,000');
    fireEvent.click(screen.getByRole('button', { name: '월 적용' }));
    const siteButton = screen.getByRole('button', { name: '가상외부팀 가상 외부현장 작업자 상세' });
    expect(rowFor(siteButton).getByText('367,500')).toBeInTheDocument(); // 1.5 × 현장 지원단가
    expect(rowFor(siteButton).getAllByText('390,000').length).toBeGreaterThan(0); // 1.5 × 월 청구단가

    fireEvent.click(screen.getByRole('button', { name: '다음 달 보기' }));
    await teamButton();
    expect(bulkInput('지원단가')).toHaveValue('230,000');
    expect(bulkInput('청구단가')).toHaveValue('230,000');
    expect(siteInput('지원단가')).toHaveValue('230,000');
    expect(siteInput('청구단가')).toHaveValue('230,000');
    unmount();
    renderScope('external');
    fireEvent.click(await teamButton());
    expect(bulkInput('지원단가')).toHaveValue('240,000');
    expect(bulkInput('청구단가')).toHaveValue('260,000');
    expect(siteInput('지원단가')).toHaveValue('245,000');
    expect(siteInput('청구단가')).toHaveValue('260,000');
});

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
    fireEvent.click(screen.getByRole('button', { name: '노임명세서 닫기' }));
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
