import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Link, MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import Swal from 'sweetalert2';
import DailyReportListV2 from './DailyReportListV2';
import { dailyReportService } from '../../services/dailyReportService';

jest.mock('../../services/dailyReportService', () => ({ dailyReportService: { getReportWorkerRowsByRange: jest.fn(), updateWorkerInReport: jest.fn(), updateReport: jest.fn() } }));
jest.mock('../../services/teamService', () => ({ teamService: { getTeams: async () => [] } }));
jest.mock('../../services/siteService', () => ({ siteService: { getSites: async () => [] } }));
jest.mock('../../services/manpowerService', () => ({ manpowerService: { getWorkers: async () => [] } }));
jest.mock('../../services/companyService', () => ({ companyService: { getActiveCompanies: async () => [] } }));
jest.mock('../../services/dailyReportTransferService', () => ({ dailyReportTransferService: { exportRowsToExcel: jest.fn() } }));
jest.mock('../../services/fileTransferAuditService', () => ({ fileTransferAuditService: { log: jest.fn() } }));
jest.mock('../../utils/swal', () => ({ confirm: { save: async () => ({ isConfirmed: true }) }, toast: { success: jest.fn(), warning: jest.fn(), error: jest.fn(), info: jest.fn() } }));
jest.mock('sweetalert2', () => ({ fire: jest.fn() }));
jest.mock('framer-motion', () => ({ motion: { div: ({ children, variants, initial, animate, ...props }: any) => <div {...props}>{children}</div> } }));
jest.mock('../../hooks/useWorkerAccessScope', () => ({
    useWorkerAccessScope: () => ({ mode: 'all', loading: false, workerIds: [], workerUids: [], workerNames: [], teamIds: [] }),
    workerAccessMatchesReportRow: () => true, workerAccessMatchesSite: () => true,
    workerAccessMatchesTeam: () => true, workerAccessMatchesWorker: () => true,
}));

let rows: any[];
const makeRow = (index: number) => ({
    reportId: `report-${index}`, workerId: `worker-${index}`, workerIndex: 0,
    workerName: `테스트 작업자 ${String(index).padStart(3, '0')}`, date: '2026-09-29',
    siteId: 'site', siteName: '테스트 현장', teamId: 'team', teamName: '테스트 팀',
    salaryModel: '일급제', manDay: 1, unitPrice: 100, amount: 100, workContent: '',
});

const Location = () => <output data-testid="location">{useLocation().search}</output>;
const mount = (query = 'date=2026-09-29') => render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={[`/reports/daily?tab=list-v2&${query}`]}>
    <Location /><Link to="/other">다른 화면</Link>
    <Routes><Route path="/reports/daily" element={<DailyReportListV2 />} /><Route path="/other" element={<p>이동 완료</p>} /></Routes>
</MemoryRouter>);

beforeEach(() => {
    jest.clearAllMocks(); sessionStorage.clear(); rows = [makeRow(0), makeRow(1)];
    Object.defineProperty(window, 'matchMedia', { writable: true, value: jest.fn(() => ({ matches: false, addEventListener: jest.fn(), removeEventListener: jest.fn() })) });
    (dailyReportService.getReportWorkerRowsByRange as jest.Mock).mockImplementation(async () => rows.map(row => ({ ...row })));
    (dailyReportService.updateWorkerInReport as jest.Mock).mockImplementation(async (reportId, _worker, changes) => {
        rows = rows.map(row => row.reportId === reportId ? { ...row, ...changes } : row);
    });
});

test('날짜 링크는 세션의 월간 모드보다 우선하며 잘못된 입력으로 조회하지 않는다', async () => {
    sessionStorage.setItem('output-management:daily-report-list-v2:v1', JSON.stringify({ dateQueryMode: 'month', startDate: '2026-08-01', endDate: '2026-08-31' }));
    mount(); await screen.findByText('테스트 작업자 000');
    expect(screen.getByRole('button', { name: '기간별' })).toHaveAttribute('aria-pressed', 'true');
    expect(dailyReportService.getReportWorkerRowsByRange).toHaveBeenLastCalledWith(expect.objectContaining({ startDate: '2026-09-29', endDate: '2026-09-29' }));
    const calls = (dailyReportService.getReportWorkerRowsByRange as jest.Mock).mock.calls.length;
    fireEvent.change(screen.getByLabelText('조회 시작일'), { target: { value: '2026-02-30' } });
    fireEvent.blur(screen.getByLabelText('조회 시작일'));
    fireEvent.click(screen.getByRole('button', { name: '조회' }));
    expect(screen.getByLabelText('조회 시작일')).toHaveValue('2026-02-30');
    expect(screen.getByRole('alert')).toHaveTextContent('날짜');
    expect(dailyReportService.getReportWorkerRowsByRange).toHaveBeenCalledTimes(calls);
});

test('월간 모드와 월 변경은 한 달 전체를 조회하고 새 정렬은 기본 방향으로 시작한다', async () => {
    mount(); await screen.findByText('테스트 작업자 000');
    fireEvent.click(screen.getByRole('button', { name: '달별' }));
    await waitFor(() => expect(dailyReportService.getReportWorkerRowsByRange).toHaveBeenLastCalledWith(expect.objectContaining({ startDate: '2026-09-01', endDate: '2026-09-30' })));
    fireEvent.change(screen.getByLabelText('조회 월'), { target: { value: '2026-02' } });
    await waitFor(() => expect(dailyReportService.getReportWorkerRowsByRange).toHaveBeenLastCalledWith(expect.objectContaining({ startDate: '2026-02-01', endDate: '2026-02-28' })));
    fireEvent.click(screen.getByRole('button', { name: '이름순 오름차순 정렬' }));
    expect(screen.getByTestId('location')).toHaveTextContent('sort=name&order=asc');
});

test('전체 결과를 유지하며 표는 100행씩 표시하고 모바일에서는 표를 생성하지 않는다', async () => {
    rows = Array.from({ length: 205 }, (_, i) => makeRow(i));
    const view = mount(); await screen.findByText('테스트 작업자 000');
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(101);
    expect(screen.getByRole('region', { name: /조회 결과 205건/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '다음 페이지' }));
    expect(screen.getByText('테스트 작업자 100')).toBeInTheDocument();
    expect(screen.queryByText('테스트 작업자 000')).not.toBeInTheDocument();
    view.unmount();
    (window.matchMedia as jest.Mock).mockReturnValue({ matches: true, addEventListener: jest.fn(), removeEventListener: jest.fn() });
    mount(); await screen.findByText('테스트 작업자 000');
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getAllByRole('listitem')).toHaveLength(40);
});

test('미저장 입력은 종료 취소와 메뉴 이동 취소 후 유지하고 새 조회로 지워지지 않는다', async () => {
    mount(); await screen.findByText('테스트 작업자 000');
    fireEvent.click(screen.getByRole('button', { name: '수정모드' }));
    fireEvent.change(screen.getAllByLabelText('작업내용')[0], { target: { value: '보존할 입력' } });
    (Swal.fire as jest.Mock).mockResolvedValue({ isConfirmed: false, isDenied: false });
    fireEvent.click(screen.getByRole('button', { name: '수정 종료' }));
    await waitFor(() => expect(Swal.fire).toHaveBeenCalled());
    expect(screen.getAllByLabelText('작업내용')[0]).toHaveValue('보존할 입력');
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false);
    fireEvent.click(screen.getByText('다른 화면'));
    expect(confirm).toHaveBeenCalled();
    expect(screen.queryByText('이동 완료')).not.toBeInTheDocument();
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload); expect(unload.defaultPrevented).toBe(true);
    const count = (dailyReportService.getReportWorkerRowsByRange as jest.Mock).mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: '조회' }));
    expect(dailyReportService.getReportWorkerRowsByRange).toHaveBeenCalledTimes(count);
    confirm.mockRestore();
});

test('개별 행 저장 직후 재조회는 캐시 대신 최신 저장 데이터를 가져온다', async () => {
    mount(); await screen.findByText('테스트 작업자 000');
    fireEvent.click(screen.getByRole('button', { name: '수정모드' }));
    fireEvent.change(screen.getAllByLabelText('공수')[0], { target: { value: '2' } });
    const row = within(screen.getByRole('table')).getAllByRole('row')[1];
    fireEvent.click(within(row).getByTitle('저장'));
    await waitFor(() => expect(screen.getByRole('button', { name: '전체 저장 (0)' })).toBeDisabled());
    const count = (dailyReportService.getReportWorkerRowsByRange as jest.Mock).mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: '조회' }));
    await waitFor(() => expect(dailyReportService.getReportWorkerRowsByRange).toHaveBeenCalledTimes(count + 1));
    await waitFor(() => expect(screen.getAllByLabelText('공수')[0]).toHaveValue(2));
});

test('저장 후 종료가 실패하면 수정 모드와 입력을 유지한다', async () => {
    (dailyReportService.updateWorkerInReport as jest.Mock).mockRejectedValue(new Error('test write failure'));
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    mount(); await screen.findByText('테스트 작업자 000');
    fireEvent.click(screen.getByRole('button', { name: '수정모드' }));
    fireEvent.change(screen.getAllByLabelText('작업내용')[0], { target: { value: '다시 저장할 입력' } });
    (Swal.fire as jest.Mock).mockResolvedValue({ isConfirmed: true });
    fireEvent.click(screen.getByRole('button', { name: '수정 종료' }));
    await waitFor(() => expect(dailyReportService.updateWorkerInReport).toHaveBeenCalled());
    await waitFor(() => expect(screen.getAllByLabelText('작업내용')[0]).toHaveValue('다시 저장할 입력'));
    expect(screen.getByRole('button', { name: '수정 종료' })).toBeInTheDocument();
    error.mockRestore();
});
