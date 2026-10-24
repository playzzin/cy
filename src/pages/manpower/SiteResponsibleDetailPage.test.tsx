import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import SiteResponsibleDetailPage from './SiteResponsibleDetailPage';
import { dailyReportService } from '../../services/dailyReportService';
import { useRestrictedTeamWorkflow } from '../../routes/TeamWorkflowGate';
import { siteService } from '../../services/siteService';
import { teamResourceStatusService } from '../../services/teamResourceStatusService';
import { showConfirmAlert } from '../../utils/swal';

jest.mock('../../services/siteService', () => ({ siteService: { getSites: jest.fn() } }));
jest.mock('../../services/teamService', () => ({ teamService: { getTeams: async () => [
    { id: 'a', name: '검증팀', companyName: '청연이엔지' },
] } }));
jest.mock('../../services/manpowerService', () => ({ manpowerService: { getWorkers: async () => [] } }));
jest.mock('../../services/dailyReportService', () => ({ dailyReportService: { getWorkerRows: jest.fn() } }));
jest.mock('../../routes/TeamWorkflowGate', () => ({ useRestrictedTeamWorkflow: jest.fn() }));
jest.mock('../../hooks/useWorkerAccessScope', () => ({
    useWorkerAccessScope: () => ({ mode: 'team', loading: false }),
    workerAccessMatchesReportRow: (_scope: unknown, row: { teamId: string }) => row.teamId === 'a',
    workerAccessMatchesTeamRef: (_scope: unknown, teamId: string) => teamId === 'a',
}));
jest.mock('../../services/teamResourceStatusService', () => ({ teamResourceStatusService: { update: jest.fn() } }));
jest.mock('../../utils/swal', () => ({ showConfirmAlert: jest.fn(), toast: { error: jest.fn(), success: jest.fn(), warning: jest.fn() } }));

beforeEach(() => {
    jest.clearAllMocks();
    (siteService.getSites as jest.Mock).mockResolvedValue([
        { id: 'site-a', name: '가상 가현장', responsibleTeamId: 'a', responsibleTeamName: '검증팀', status: 'active' },
        { id: 'site-b', name: '가상 나현장', responsibleTeamId: 'a', responsibleTeamName: '검증팀', status: 'active' },
    ]);
    (showConfirmAlert as jest.Mock).mockResolvedValue({ isConfirmed: true });
    (teamResourceStatusService.update as jest.Mock).mockImplementation(async input => ({ id: input.id, status: input.status }));
    window.matchMedia = jest.fn().mockReturnValue({ matches: false });
    (useRestrictedTeamWorkflow as jest.Mock).mockReturnValue(true);
    (dailyReportService.getWorkerRows as jest.Mock).mockImplementation(async ({ startDate }) => [
        { reportId: 'r1', date: startDate, siteId: 'site-a', siteName: '가상 가현장', workerId: 'one', workerName: '동명작업자', teamId: 'a', workerTeamName: '검증팀', manDay: 0.25, unitPrice: 100000 },
        { reportId: 'r2', date: startDate, siteId: 'site-a', siteName: '가상 가현장', workerId: 'two', workerName: '동명작업자', teamId: 'a', workerTeamName: '지원팀', manDay: 0.5, unitPrice: 200000 },
        { reportId: 'r3', date: startDate, siteId: 'site-b', siteName: '가상 나현장', workerId: 'three', workerName: '다른현장작업자', teamId: 'a', manDay: 1, unitPrice: 300000 },
    ]);
});

test('현장정보에서 종료 처리와 진행중 복귀를 하고 목록·건수·선택을 즉시 갱신한다', async () => {
    render(<SiteResponsibleDetailPage view="siteInfo" />);
    await screen.findByRole('heading', { name: '가상 가현장' });
    fireEvent.click(screen.getByRole('button', { name: '현장 종료' }));
    await waitFor(() => expect(teamResourceStatusService.update).toHaveBeenCalledWith({ kind: 'site', id: 'site-a', status: 'completed', expectedStatus: 'active', expectedIsActive: null }));
    expect(await screen.findByRole('button', { name: '진행중으로 변경' })).toBeEnabled();
    expect(screen.getByLabelText('현장 상태')).toHaveValue('completed');
    expect(screen.getByRole('heading', { name: '가상 가현장' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /가상 나현장.*진행중/ })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: '종료 현장 (1)' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '진행중으로 변경' }));
    await waitFor(() => expect(teamResourceStatusService.update).toHaveBeenLastCalledWith({ kind: 'site', id: 'site-a', status: 'active', expectedStatus: 'completed', expectedIsActive: null }));
    expect(await screen.findByRole('button', { name: '현장 종료' })).toBeEnabled();
    expect(screen.getByLabelText('현장 상태')).toHaveValue('active');
    expect(screen.getByRole('option', { name: '진행중 현장 (2)' })).toBeInTheDocument();
});

test('현장 출력일보에서 기존 종료 상태 표기를 모두 모아 보며 설정 버튼은 표시하지 않는다', async () => {
    (siteService.getSites as jest.Mock).mockResolvedValueOnce(['completed', 'closed', '종료', '완료', '마감'].map((status, index) => ({ id: `closed-${index}`, name: `종료검증${index}`, responsibleTeamId: 'a', responsibleTeamName: '검증팀', status } as any)));
    render(<SiteResponsibleDetailPage view="dailyReport" />);
    await screen.findByRole('option', { name: '종료 현장 (5)' });
    expect(screen.queryByRole('button', { name: /종료검증0/ })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('현장 상태'), { target: { value: 'completed' } });
    expect(await screen.findByRole('heading', { name: '종료검증0' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '현장 상태 설정' })).not.toBeInTheDocument();
});

test('현장 상태 저장 실패 시 진행중 목록과 상태를 유지한다', async () => {
    (teamResourceStatusService.update as jest.Mock).mockRejectedValueOnce(new Error('담당 현장만 변경할 수 있습니다.'));
    render(<SiteResponsibleDetailPage view="siteInfo" />);
    fireEvent.click(await screen.findByRole('button', { name: '현장 종료' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('담당 현장만');
    expect(screen.getByLabelText('현장 상태')).toHaveValue('active');
    expect(screen.getByRole('button', { name: '현장 종료' })).toBeEnabled();
});

test('별도 현장 출력일보 화면에서 달력 합계와 작업자별 상세를 연결한다', async () => {
    render(<SiteResponsibleDetailPage view="dailyReport" />);
    await screen.findByRole('heading', { name: '가상 가현장' });
    expect(screen.queryByRole('button', { name: '노임명세서' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '현장 출력일보' })).toBeInTheDocument();
    expect(screen.queryByRole('tablist', { name: '월별 현장 문서' })).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '달력보기' })).toHaveAttribute('aria-selected', 'true');
    const calendar = await screen.findByLabelText(/가상 가현장의 .* 출력일보 달력/);
    const day = within(calendar).getByRole('button', { name: /근무내역 0.75공수/ });
    expect(within(day).getByText('2명')).toBeInTheDocument();
    fireEvent.click(day);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getAllByRole('heading', { name: '동명작업자' })).toHaveLength(2);
    expect(within(dialog).getByText('0.25공수')).toBeInTheDocument();
    expect(within(dialog).getByText('25,000원')).toBeInTheDocument();
    expect(within(dialog).queryByText('다른현장작업자')).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: '상세 닫기' }));
    fireEvent.click(screen.getByRole('tab', { name: '목록보기' }));
    expect(within(screen.getByLabelText('현장 출력일보')).getAllByText('125,000원').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: /가상 나현장.*진행중/ }));
    expect(await screen.findByLabelText(/가상 나현장의 .* 출력일보 달력/)).toBeInTheDocument();
    expect(screen.queryByText('0.75공수')).not.toBeInTheDocument();
});

test('월을 바꾸면 새 달을 조회하고 실패 시 이전 날짜 내역을 표시하지 않는다', async () => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    render(<SiteResponsibleDetailPage view="dailyReport" />);
    await screen.findByRole('heading', { name: '가상 가현장' });
    fireEvent.click(await screen.findByRole('button', { name: /근무내역 0.75공수/ }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '상세 닫기' }));
    const month = (dailyReportService.getWorkerRows as jest.Mock).mock.calls[0][0].startDate;
    (dailyReportService.getWorkerRows as jest.Mock).mockRejectedValueOnce(new Error('test failure'));
    fireEvent.click(screen.getByRole('button', { name: '이전 달' }));
    const history = within(screen.getByRole('region', { name: '현장 출력일보' }));
    expect(await history.findByRole('alert')).toHaveTextContent('새로고침해 주세요');
    expect((dailyReportService.getWorkerRows as jest.Mock).mock.calls[1][0].startDate).not.toBe(month);
    expect(screen.queryByRole('button', { name: /근무내역 0.75공수/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '새로고침' }));
    await waitFor(() => expect(screen.queryAllByRole('alert')).toHaveLength(0));
    expect(await screen.findByRole('button', { name: /근무내역 0.75공수/ })).toBeInTheDocument();
    log.mockRestore();
});

test('팀장 현장정보는 출력일보와 팀·지원팀별 공수 영역을 포함하지 않는다', async () => {
    render(<SiteResponsibleDetailPage />);
    await screen.findByRole('heading', { name: '가상 가현장' });
    expect(screen.getByRole('heading', { name: '현장정보', level: 1 })).toBeInTheDocument();
    expect(screen.queryByRole('tablist', { name: '월별 현장 문서' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('현장 출력일보')).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '현장 팀·작업자별 공수' })).not.toBeInTheDocument();
    expect(screen.queryByText(/노무비/)).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: '월별 누적공수' })).toBeInTheDocument();
});

test('사무실의 기존 현장 노임명세서와 출력일보 목록은 유지한다', async () => {
    (useRestrictedTeamWorkflow as jest.Mock).mockReturnValue(false);
    render(<SiteResponsibleDetailPage />);
    await screen.findByRole('heading', { name: '가상 가현장' });
    fireEvent.click(screen.getByRole('button', { name: '노임명세서' }));
    expect(screen.getByLabelText('노무내역서 모바일 요약')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '출력일보' }));
    expect(screen.getByRole('heading', { name: '출력일보 목록' })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('출력일보를 불러오는 중입니다.')).not.toBeInTheDocument());
    expect(screen.queryByLabelText('현장 출력일보')).not.toBeInTheDocument();
});

test('현장 출력일보에 지원 온 타 팀과 작업자 공수를 표시하고 다른 현장은 제외한다', async () => {
    (dailyReportService.getWorkerRows as jest.Mock).mockImplementation(async ({ startDate }) => [
        { reportId: 'own', date: startDate, siteId: 'site-a', siteName: '가상 가현장', teamId: 'a', responsibleTeamId: 'a', workerId: 'one', workerName: '동명', workerTeamId: 'a', workerTeamName: '검증팀', manDay: 1, unitPrice: 100 },
        { reportId: 'support', date: startDate, siteId: 'site-a', siteName: '가상 가현장', teamId: 'b', responsibleTeamId: 'a', workerId: 'two', workerName: '동명', workerTeamId: 'b', workerTeamName: '외부지원팀', isSiteSupport: true, manDay: 0.5, unitPrice: 0 },
        { reportId: 'support-2', date: startDate.replace(/01$/, '02'), siteId: 'site-a', siteName: '가상 가현장', teamId: 'b', responsibleTeamId: 'a', workerId: 'two', workerName: '동명', workerTeamId: 'b', workerTeamName: '외부지원팀', isSiteSupport: true, manDay: 0.25, unitPrice: 0 },
        { reportId: 'unrelated', date: startDate, siteId: 'other-site', siteName: '가상 가현장', teamId: 'b', workerId: 'other', workerName: '차단대상', manDay: 99 },
    ]);
    render(<SiteResponsibleDetailPage view="dailyReport" />);
    const history = await screen.findByRole('region', { name: '현장 출력일보' });
    const firstDay = await within(history).findByRole('button', { name: /근무내역 1.5공수/ });
    expect(within(firstDay).getByText('외부지원팀')).toBeInTheDocument();
    expect(within(firstDay).getByText('0.5')).toBeInTheDocument();
    expect((dailyReportService.getWorkerRows as jest.Mock).mock.calls[0][0].includeSiteSupport).toBe(true);
    expect(within(history).queryByText('· 지원 0.75공수 포함')).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '현장 팀·작업자별 공수' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: '목록보기' }));
    expect(within(history).getByText('· 지원 0.75공수 포함')).toBeInTheDocument();
    expect(within(history).queryByRole('list', { name: '외부지원팀 작업자 공수' })).not.toBeInTheDocument();
    const secondDay = within(history).getByRole('button', { name: /-02 근무내역$/, expanded: false });
    fireEvent.click(secondDay);
    expect(within(within(history).getByRole('list', { name: '외부지원팀 작업자 공수' })).getByText('0.25공수')).toBeInTheDocument();
    fireEvent.click(within(history).getByRole('button', { name: /-01 근무내역$/, expanded: false }));
    expect(secondDay).toHaveAttribute('aria-expanded', 'false');
    expect(within(history).getAllByRole('list', { name: '외부지원팀 작업자 공수' })).toHaveLength(1);
    expect(within(within(history).getByRole('list', { name: '외부지원팀 작업자 공수' })).getByText('0.5공수')).toBeInTheDocument();
    expect(within(history).getAllByText('동명')).toHaveLength(2);
    expect(screen.queryByText('차단대상')).not.toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: '현장담당 요약' })).getByText('1.75')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /가상 나현장.*진행중/ }));
    await screen.findByLabelText(/가상 나현장의 .* 출력일보 달력/);
    expect(screen.queryByText('외부지원팀')).not.toBeInTheDocument();
});

test('현장정보는 급여 없이 연도별 월 공수와 누적공수를 표시하고 현장·연도 변경을 반영한다', async () => {
    (dailyReportService.getWorkerRows as jest.Mock).mockImplementation(async ({ startDate, endDate }) => {
        if (Date.parse(endDate) - Date.parse(startDate) > 31 * 86400000) throw new Error('monthly range required');
        const year = startDate.slice(0, 4);
        return [
            { reportId: 'jan', date: `${year}-01-01`, siteId: 'site-a', teamId: 'a', manDay: 1.25, unitPrice: 100000 },
            { reportId: 'feb', date: `${year}-02-01`, siteId: 'site-a', teamId: 'b', responsibleTeamId: 'a', isSiteSupport: true, manDay: 0.5 },
            { reportId: 'other', date: `${year}-01-01`, siteId: 'site-b', teamId: 'a', manDay: 9 },
            { reportId: 'private', date: `${year}-01-01`, siteId: 'private-site', teamId: 'b', manDay: 99 },
        ].filter(row => row.date >= startDate && row.date <= endDate);
    });
    render(<SiteResponsibleDetailPage view="siteInfo" />);
    for (let month = new Date().getMonth(); month > 0; month--) fireEvent.click(screen.getByRole('button', { name: '이전 달' }));
    const summary = await screen.findByRole('region', { name: '월별 누적공수' });
    await waitFor(() => expect(within(summary).getByRole('row', { name: /^1월/ })).toHaveTextContent('1.25'));
    const february = within(summary).getByRole('row', { name: /^2월/ });
    expect(within(february).getByText('0.5')).toBeInTheDocument();
    expect(within(february).getByText('1.75')).toBeInTheDocument();
    expect(screen.queryByText(/노무비|125,000원/)).not.toBeInTheDocument();
    const firstQuery = (dailyReportService.getWorkerRows as jest.Mock).mock.calls[0][0];
    expect(firstQuery.startDate).toMatch(/-01-01$/);
    expect(firstQuery.endDate).toMatch(/-01-31$/);
    expect(firstQuery.includeSiteSupport).toBe(true);
    expect((dailyReportService.getWorkerRows as jest.Mock).mock.calls).toHaveLength(12);
    fireEvent.click(screen.getByRole('button', { name: /가상 나현장.*진행중/ }));
    expect(within(summary).getByRole('row', { name: /^2월/ })).toHaveTextContent('9');
    expect(within(summary).queryByText('1.75')).not.toBeInTheDocument();
    for (let index = 0; index < 12; index++) fireEvent.click(screen.getByRole('button', { name: '이전 달' }));
    await waitFor(() => expect((dailyReportService.getWorkerRows as jest.Mock).mock.calls).toHaveLength(24));
    await within(summary).findByRole('table');
    expect((dailyReportService.getWorkerRows as jest.Mock).mock.calls[12][0].startDate).toBe(`${Number(firstQuery.startDate.slice(0, 4)) - 1}-01-01`);
});

test('현장정보 연간 조회 실패 시 이전 누적공수를 숨긴다', async () => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    render(<SiteResponsibleDetailPage view="siteInfo" />);
    const summary = await screen.findByRole('region', { name: '월별 누적공수' });
    await within(summary).findByRole('table');
    (dailyReportService.getWorkerRows as jest.Mock).mockRejectedValueOnce(new Error('test failure'));
    fireEvent.click(screen.getByRole('button', { name: '새로고침' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('새로고침해 주세요');
    expect(screen.queryByRole('region', { name: '월별 누적공수' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /가상 가현장.*진행중/ })).not.toBeInTheDocument();
    log.mockRestore();
});

test('팀장 현장정보는 조회월의 실제 내 팀 투입 현장만 세고 0공수·이전월·타팀 지원만 있는 현장은 제외한다', async () => {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const previous = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousMonth = `${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, '0')}`;
    (siteService.getSites as jest.Mock).mockResolvedValue([
        { id: 'site-a', name: '이번달현장', responsibleTeamId: 'a', status: 'active' },
        { id: 'old', name: '지난달현장', responsibleTeamId: 'a', status: 'active' },
        { id: 'zero', name: '영공수현장', responsibleTeamId: 'a', status: 'active' },
        { id: 'closed', name: '종료현장', responsibleTeamId: 'a', status: 'completed' },
        { id: 'support', name: '타팀만투입현장', responsibleTeamId: 'a', status: 'active' },
        { id: 'modern', legacyId: 'legacy', name: '이전코드현장', responsibleTeamId: 'a', status: 'active' },
    ]);
    const rows = [
        { siteId: 'site-a', date: `${month}-01`, manDay: 1 },
        { siteId: 'old', date: `${previousMonth}-01`, manDay: 2 },
        { siteId: 'zero', date: `${month}-01`, manDay: 0 },
        { siteId: 'closed', date: `${month}-01`, manDay: 1 },
        { siteId: 'support', date: `${month}-01`, manDay: 3, isSiteSupport: true },
        { siteId: 'legacy', date: `${month}-01`, manDay: 0.5 },
    ].map(row => ({ teamId: 'a', responsibleTeamId: 'a', ...row }));
    (dailyReportService.getWorkerRows as jest.Mock).mockImplementation(async ({ startDate, endDate }) => rows.filter(row => row.date >= startDate && row.date <= endDate));
    render(<SiteResponsibleDetailPage view="siteInfo" />);
    await screen.findByRole('button', { name: /이번달현장.*진행중/ });
    expect(screen.getByRole('button', { name: /이전코드현장.*진행중/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '진행중 현장 (2)' })).toBeInTheDocument();
    for (const name of ['지난달현장', '영공수현장', '종료현장', '타팀만투입현장']) {
        expect(screen.queryByRole('button', { name: new RegExp(`${name}.*(진행중|종료)`) })).not.toBeInTheDocument();
    }
    fireEvent.click(screen.getByRole('button', { name: '이전 달' }));
    await screen.findByRole('button', { name: /지난달현장.*진행중/ });
    expect(screen.queryByRole('button', { name: /이번달현장.*진행중/ })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: '진행중 현장 (1)' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '이전 달' }));
    expect(await screen.findByText('선택한 달에 조건에 맞는 투입 현장이 없습니다.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /지난달현장.*진행중/ })).not.toBeInTheDocument();
});

test('사무실 현장정보는 투입 전 현장도 관리할 수 있다', async () => {
    (useRestrictedTeamWorkflow as jest.Mock).mockReturnValue(false);
    (dailyReportService.getWorkerRows as jest.Mock).mockResolvedValue([]);
    render(<SiteResponsibleDetailPage view="siteInfo" />);
    await screen.findByRole('button', { name: /가상 가현장.*진행중/ });
    expect(screen.getByRole('button', { name: /가상 나현장.*진행중/ })).toBeInTheDocument();
});

test('지원 인원은 현장 달력에 포함되며 지원 개인 급여를 0원으로 표시하지 않는다', async () => {
    (dailyReportService.getWorkerRows as jest.Mock).mockImplementation(async ({ startDate }) => [
        { reportId: 'support', date: startDate, siteId: 'site-a', teamId: 'a', workerId: 'two', workerName: '지원인원', workerTeamName: '외부지원팀', isSiteSupport: true, manDay: 0.5, unitPrice: 0 },
    ]);
    render(<SiteResponsibleDetailPage view="dailyReport" />);
    fireEvent.click(await screen.findByRole('button', { name: /근무내역 0.5공수/ }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('지원인원')).toBeInTheDocument();
    expect(within(dialog).getByText('외부지원팀')).toBeInTheDocument();
    expect(within(dialog).queryByText('단가')).not.toBeInTheDocument();
    expect(within(dialog).queryByText('0원')).not.toBeInTheDocument();
});
