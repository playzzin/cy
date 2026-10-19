import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import SiteResponsibleDetailPage from './SiteResponsibleDetailPage';
import { dailyReportService } from '../../services/dailyReportService';
import { useRestrictedTeamWorkflow } from '../../routes/TeamWorkflowGate';

jest.mock('../../services/siteService', () => ({ siteService: { getSites: async () => [
    { id: 'site-a', name: '가상 가현장', responsibleTeamId: 'a', responsibleTeamName: '검증팀', status: 'active' },
    { id: 'site-b', name: '가상 나현장', responsibleTeamId: 'a', responsibleTeamName: '검증팀', status: 'active' },
] } }));
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
jest.mock('../../utils/swal', () => ({ toast: { error: jest.fn(), success: jest.fn(), warning: jest.fn() } }));

beforeEach(() => {
    jest.clearAllMocks();
    window.matchMedia = jest.fn().mockReturnValue({ matches: false });
    (useRestrictedTeamWorkflow as jest.Mock).mockReturnValue(true);
    (dailyReportService.getWorkerRows as jest.Mock).mockImplementation(async ({ startDate }) => [
        { reportId: 'r1', date: startDate, siteId: 'site-a', siteName: '가상 가현장', workerId: 'one', workerName: '동명작업자', teamId: 'a', workerTeamName: '검증팀', manDay: 0.25, unitPrice: 100000 },
        { reportId: 'r2', date: startDate, siteId: 'site-a', siteName: '가상 가현장', workerId: 'two', workerName: '동명작업자', teamId: 'a', workerTeamName: '지원팀', manDay: 0.5, unitPrice: 200000 },
        { reportId: 'r3', date: startDate, siteId: 'site-b', siteName: '가상 나현장', workerId: 'three', workerName: '다른현장작업자', teamId: 'a', manDay: 1, unitPrice: 300000 },
    ]);
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
    expect(within(firstDay).getByText('지원 외부지원팀')).toBeInTheDocument();
    expect(within(firstDay).getByText('0.5')).toBeInTheDocument();
    expect((dailyReportService.getWorkerRows as jest.Mock).mock.calls[0][0].includeSiteSupport).toBe(true);
    expect(within(history).getByText('· 지원 0.75공수 포함')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '현장 팀·작업자별 공수' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: '목록보기' }));
    const supportLists = within(history).getAllByRole('list', { name: '외부지원팀 작업자 공수' });
    expect(supportLists).toHaveLength(2);
    expect(within(supportLists[0]).getByText('0.25공수')).toBeInTheDocument();
    expect(within(supportLists[1]).getByText('0.5공수')).toBeInTheDocument();
    expect(within(history).getAllByText('동명')).toHaveLength(3);
    expect(screen.queryByText('차단대상')).not.toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: '현장담당 요약' })).getByText('1.75')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /가상 나현장.*진행중/ }));
    await screen.findByLabelText(/가상 나현장의 .* 출력일보 달력/);
    expect(screen.queryByText('외부지원팀')).not.toBeInTheDocument();
});

test('현장정보는 급여 없이 연도별 월 공수와 누적공수를 표시하고 현장·연도 변경을 반영한다', async () => {
    (dailyReportService.getWorkerRows as jest.Mock).mockImplementation(async ({ startDate }) => {
        const year = startDate.slice(0, 4);
        return [
            { reportId: 'jan', date: `${year}-01-01`, siteId: 'site-a', teamId: 'a', manDay: 1.25, unitPrice: 100000 },
            { reportId: 'feb', date: `${year}-02-01`, siteId: 'site-a', teamId: 'b', responsibleTeamId: 'a', isSiteSupport: true, manDay: 0.5 },
            { reportId: 'other', date: `${year}-01-01`, siteId: 'site-b', teamId: 'a', manDay: 9 },
            { reportId: 'private', date: `${year}-01-01`, siteId: 'private-site', teamId: 'b', manDay: 99 },
        ];
    });
    render(<SiteResponsibleDetailPage view="siteInfo" />);
    const summary = await screen.findByRole('region', { name: '월별 누적공수' });
    await waitFor(() => expect(within(summary).getByRole('row', { name: /^1월/ })).toHaveTextContent('1.25'));
    const february = within(summary).getByRole('row', { name: /^2월/ });
    expect(within(february).getByText('0.5')).toBeInTheDocument();
    expect(within(february).getByText('1.75')).toBeInTheDocument();
    expect(screen.queryByText(/노무비|125,000원/)).not.toBeInTheDocument();
    const firstQuery = (dailyReportService.getWorkerRows as jest.Mock).mock.calls[0][0];
    expect(firstQuery.startDate).toMatch(/-01-01$/);
    expect(firstQuery.endDate).toMatch(/-12-31$/);
    expect(firstQuery.includeSiteSupport).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /가상 나현장.*진행중/ }));
    expect(within(summary).getByRole('row', { name: /^2월/ })).toHaveTextContent('9');
    expect(within(summary).queryByText('1.75')).not.toBeInTheDocument();
    for (let index = 0; index < 12; index++) fireEvent.click(screen.getByRole('button', { name: '이전 달' }));
    await waitFor(() => expect((dailyReportService.getWorkerRows as jest.Mock).mock.calls).toHaveLength(2));
    await within(summary).findByRole('table');
    expect((dailyReportService.getWorkerRows as jest.Mock).mock.calls[1][0].startDate).toBe(`${Number(firstQuery.startDate.slice(0, 4)) - 1}-01-01`);
});

test('현장정보 연간 조회 실패 시 이전 누적공수를 숨긴다', async () => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    render(<SiteResponsibleDetailPage view="siteInfo" />);
    const summary = await screen.findByRole('region', { name: '월별 누적공수' });
    await within(summary).findByRole('table');
    (dailyReportService.getWorkerRows as jest.Mock).mockRejectedValueOnce(new Error('test failure'));
    fireEvent.click(screen.getByRole('button', { name: '새로고침' }));
    expect(await within(summary).findByRole('alert')).toHaveTextContent('새로고침해 주세요');
    expect(within(summary).queryByRole('table')).not.toBeInTheDocument();
    log.mockRestore();
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
