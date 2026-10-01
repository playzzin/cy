import React from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import * as XLSX from 'xlsx-js-style';
import TotalPersonnelHistoryPage from './TotalPersonnelHistoryPage';
import { dailyReportService } from '../../services/dailyReportService';
import { companyService } from '../../services/companyService';
import { manpowerService } from '../../services/manpowerService';
import { teamService } from '../../services/teamService';

jest.mock('../../services/dailyReportService', () => ({ dailyReportService: { getReportWorkerRowsByRange: jest.fn() } }));
jest.mock('../../services/companyService', () => ({ companyService: { getCompanies: jest.fn() } }));
jest.mock('../../services/manpowerService', () => ({ manpowerService: { getWorkers: jest.fn() } }));
jest.mock('../../services/teamService', () => ({ teamService: { getTeams: jest.fn() } }));
jest.mock('../../components/common/OutputManagementTabs', () => () => null);
jest.mock('xlsx-js-style', () => ({ ...jest.requireActual('xlsx-js-style'), writeFile: jest.fn() }));

const workers = [
    { id: 'monthly-a', name: '가상작업자', teamId: 'team-a', salaryModel: '월급제', idNumber: '0000003000000' },
    { id: 'monthly-b', name: '나머지작업자', teamId: 'team-a', salaryModel: '월급제' },
    { id: 'daily', name: '일급작업자', teamId: 'team-a', salaryModel: '일급제' },
    { id: 'other', name: '타팀작업자', teamId: 'team-b', salaryModel: '월급제' },
];
const reportRows = workers.map(worker => ({
    workerId: worker.id, workerName: worker.name, workerTeamId: worker.teamId, salaryModel: worker.salaryModel,
    manDay: 1, unitPrice: 200000, amount: 200000, paymentType: '노무',
}));

beforeEach(() => {
    jest.clearAllMocks();
    (teamService.getTeams as jest.Mock).mockResolvedValue([
        { id: 'team-a', name: '검증팀', companyId: 'company' },
        { id: 'team-b', name: '다른팀', companyId: 'company' },
    ]);
    (companyService.getCompanies as jest.Mock).mockResolvedValue([{ id: 'company', name: '청연이엔지' }]);
    (manpowerService.getWorkers as jest.Mock).mockResolvedValue(workers);
    (dailyReportService.getReportWorkerRowsByRange as jest.Mock).mockResolvedValue(reportRows);
});

const renderPage = async () => {
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><TotalPersonnelHistoryPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByRole('button', { name: '조회' })).toBeEnabled());
};

const searchMonthlyTeam = async () => {
    fireEvent.change(screen.getByLabelText('팀'), { target: { value: 'team-a' } });
    fireEvent.change(screen.getByLabelText('급여방식'), { target: { value: '월급제' } });
    fireEvent.change(screen.getByLabelText('조회 시작일'), { target: { value: '2026-09-01' } });
    fireEvent.change(screen.getByLabelText('조회 종료일'), { target: { value: '2026-09-30' } });
    fireEvent.click(screen.getByRole('button', { name: '조회' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '조회화면 Excel' })).toBeEnabled());
};

const downloadedSheet = () => (XLSX.writeFile as jest.Mock).mock.calls.at(-1)[0].Sheets['인원전체내역'] as XLSX.WorkSheet;

test('팀·월급제 조회 결과와 정렬·전체 합계를 그대로 내려받고 세무용은 유지한다', async () => {
    await renderPage();
    expect(screen.getByRole('button', { name: '조회화면 Excel' })).toBeDisabled();
    await searchMonthlyTeam();
    expect(screen.queryByText('일급작업자')).not.toBeInTheDocument();
    expect(screen.queryByText('타팀작업자')).not.toBeInTheDocument();
    expect(within(screen.getByRole('table')).getByText('000000-3000000')).toBeInTheDocument();
    expect(within(screen.getByRole('table')).queryByText(/\*{6}/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '이름 ㄱ→ㅎ' }));
    fireEvent.click(screen.getByRole('button', { name: '조회화면 Excel' }));
    const sheet = downloadedSheet();
    const tableRows = within(screen.getByRole('table')).getAllByRole('row');
    // Every displayed data cell must match Excel's formatted value, including full resident numbers and units.
    tableRows.slice(2, -1).forEach((row, r) => {
        within(row).getAllByRole('cell').forEach((cell, c) => {
            expect(XLSX.utils.format_cell(sheet[XLSX.utils.encode_cell({ r: r + 2, c })])).toBe(cell.textContent);
        });
    });
    expect(sheet.B3.v).toBe('나머지작업자');
    expect(sheet.B4.v).toBe('가상작업자');
    expect(sheet.L5.v).toBe(400000);
    expect(dailyReportService.getReportWorkerRowsByRange).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: '세무용 Excel' }));
    expect(downloadedSheet()['!ref']).toBe('A1:D3');
    expect(downloadedSheet().C3.v).toBe('000000-3000000');
});

test('조회 후 조건만 바꿔도 다운로드는 현재 표와 실제 조회 기간을 사용한다', async () => {
    await renderPage();
    await searchMonthlyTeam();
    fireEvent.change(screen.getByLabelText('팀'), { target: { value: 'team-b' } });
    fireEvent.change(screen.getByLabelText('급여방식'), { target: { value: '일급제' } });
    fireEvent.change(screen.getByLabelText('조회 시작일'), { target: { value: '2026-08-01' } });
    fireEvent.click(screen.getByRole('button', { name: '조회화면 Excel' }));
    expect(XLSX.writeFile).toHaveBeenLastCalledWith(expect.anything(), '인원전체내역_조회화면_2026-09-01_2026-09-30.xlsx');
    expect(downloadedSheet().B3.v).toBe('가상작업자');
    expect(downloadedSheet().E3.v).toBe('월급제');
    expect(dailyReportService.getReportWorkerRowsByRange).toHaveBeenCalledTimes(1);
});

test('재조회 중이거나 조회 결과가 없으면 다운로드할 수 없다', async () => {
    await renderPage();
    await searchMonthlyTeam();
    let resolveRows!: (value: never[]) => void;
    (dailyReportService.getReportWorkerRowsByRange as jest.Mock).mockReturnValueOnce(new Promise(resolve => { resolveRows = resolve; }));
    fireEvent.click(screen.getByRole('button', { name: '조회' }));
    expect(screen.getByRole('button', { name: '조회화면 Excel' })).toBeDisabled();
    await act(async () => { resolveRows([]); });
    expect(screen.getByText('조회된 데이터가 없습니다.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '조회화면 Excel' })).toBeDisabled();
    expect(XLSX.writeFile).not.toHaveBeenCalled();
});
