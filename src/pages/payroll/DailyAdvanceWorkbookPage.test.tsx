import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import * as XLSX from 'xlsx-js-style';
import DailyAdvanceWorkbookPage from './DailyAdvanceWorkbookPage';
import { dailyReportService } from '../../services/dailyReportService';
import { manpowerService } from '../../services/manpowerService';
import { teamService } from '../../services/teamService';

jest.mock('../../services/dailyReportService', () => ({ dailyReportService: { getWorkerRows: jest.fn() } }));
jest.mock('../../services/manpowerService', () => ({ manpowerService: { getWorkers: jest.fn() } }));
jest.mock('../../services/teamService', () => ({ teamService: { getTeams: jest.fn() } }));
jest.mock('../../services/dailyAdvanceWorkbookProfileService', () => ({
  dailyAdvanceWorkbookProfileService: { getProfiles: async () => [] },
}));
jest.mock('../../services/dailyAdvanceStatementRecruiterFeeService', () => ({
  dailyAdvanceStatementRecruiterFeeService: {
    getFeesByMonth: async () => [],
    subscribeFeesByMonth: () => () => {},
  },
}));
jest.mock('../../services/storageService', () => ({ storageService: {} }));
jest.mock('../../utils/swal', () => ({ toast: {} }));
jest.mock('html2canvas', () => jest.fn());
jest.mock('xlsx-js-style', () => ({ ...jest.requireActual('xlsx-js-style'), writeFile: jest.fn() }));

const fixtureMonth = '2026-02';
const fixtureRows = [
  { reportId: 'a-1', workerId: 'a', workerName: '검증가', teamId: 'team-a', date: `${fixtureMonth}-01`, manDay: 1, unitPrice: 100000, salaryModel: '용역팀' },
  { reportId: 'a-2', workerId: 'a', workerName: '검증가', teamId: 'team-a', date: `${fixtureMonth}-01`, manDay: 0.5, unitPrice: 100000, salaryModel: '용역팀' },
  { reportId: 'a-3', workerId: 'a', workerName: '검증가', teamId: 'team-a', date: `${fixtureMonth}-28`, manDay: 1, unitPrice: 100000, salaryModel: '용역팀' },
  { reportId: 'b-1', workerId: 'b', workerName: '검증나', teamId: 'team-b', date: `${fixtureMonth}-01`, manDay: 0.5, unitPrice: 200000, salaryModel: '용역팀' },
  { reportId: 'daily-1', workerId: 'daily', workerName: '일급검증', teamId: 'team-daily', date: `${fixtureMonth}-01`, manDay: 9, unitPrice: 100000, salaryModel: '일급제' },
];

const openServiceTab = async () => {
  render(<DailyAdvanceWorkbookPage />);
  await screen.findByText('일급검증');
  fireEvent.change(screen.getByLabelText('조회월'), { target: { value: fixtureMonth } });
  await screen.findByText('일급검증');
  fireEvent.click(screen.getByRole('button', { name: /^용역팀$/ }));
  await screen.findByText('용역팀 정산 관리 (인력소개비 자동계산)');
};

const totalCells = () => within(screen.getByRole('row', { name: /^일자별 공수합계 / })).getAllByRole('cell');

const exportedSheet = () => {
  const calls = (XLSX.writeFile as jest.Mock).mock.calls;
  const workbook = calls[calls.length - 1][0] as XLSX.WorkBook;
  return workbook.Sheets['용역팀'];
};

describe('용역팀 날짜별 합계', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    (dailyReportService.getWorkerRows as jest.Mock).mockResolvedValue(fixtureRows);
    (manpowerService.getWorkers as jest.Mock).mockResolvedValue([
      { id: 'a', name: '검증가', teamId: 'team-a', salaryModel: '용역팀' },
      { id: 'b', name: '검증나', teamId: 'team-b', salaryModel: '용역팀' },
      { id: 'daily', name: '일급검증', teamId: 'team-daily', salaryModel: '일급제' },
    ]);
    (teamService.getTeams as jest.Mock).mockResolvedValue([
      { id: 'team-a', name: '검증팀 A', type: '용역' },
      { id: 'team-b', name: '검증팀 B', type: '용역' },
      { id: 'team-daily', name: '일급팀' },
    ]);
  });

  it('같은 날 여러 일보와 소수 공수를 합산하고 일급제는 제외하며 선택한 팀만 집계한다', async () => {
    await openServiceTab();
    const cells = totalCells();
    expect(cells).toHaveLength(33); // 병합 제목 + 28일 + 월 합계 3칸 + 비고
    expect(cells[1]).toHaveTextContent(/^2$/);
    expect(cells[2]).toHaveTextContent(/^-$/);
    expect(cells[28]).toHaveTextContent(/^1$/);
    expect(cells[29]).toHaveTextContent(/^3$/);
    expect(cells[30]).toHaveTextContent('180,000');
    expect(cells[31]).toHaveTextContent('530,000');

    fireEvent.change(screen.getByLabelText('팀 필터'), { target: { value: 'team-a' } });
    const filtered = totalCells();
    expect(filtered[1]).toHaveTextContent(/^1.5$/);
    expect(filtered[29]).toHaveTextContent(/^2.5$/);
    expect(filtered[30]).toHaveTextContent('120,000');
    expect(filtered[31]).toHaveTextContent('370,000');
    expect(screen.queryByText('검증나')).not.toBeInTheDocument();
  });

  it('엑셀에도 같은 합계와 병합·강조 서식을 포함한다', async () => {
    await openServiceTab();
    fireEvent.click(screen.getByRole('button', { name: '엑셀 다운로드' }));
    const sheet = exportedSheet();
    const rows = XLSX.utils.sheet_to_json<Array<string | number>>(sheet, { header: 1 });
    const totals = rows[rows.length - 1];
    expect(totals).toEqual(['일자별 공수합계', '', 2, ...Array(26).fill('-'), 1, 3, 180000, 530000, '']);
    expect(sheet['!merges']).toContainEqual({ s: { r: 3, c: 0 }, e: { r: 3, c: 1 } });
    expect(sheet.A4.s.fill.fgColor.rgb).toBe('E6B9B8');

    fireEvent.change(screen.getByLabelText('팀 필터'), { target: { value: 'team-b' } });
    fireEvent.click(screen.getByRole('button', { name: '엑셀 다운로드' }));
    const filteredRows = XLSX.utils.sheet_to_json<Array<string | number>>(exportedSheet(), { header: 1 });
    expect(filteredRows[filteredRows.length - 1]).toEqual([
      '일자별 공수합계', '', 0.5, ...Array(27).fill('-'), 0.5, 60000, 160000, '',
    ]);
  });

  it('용역팀 데이터가 없으면 빈 상태만 표시한다', async () => {
    (dailyReportService.getWorkerRows as jest.Mock).mockResolvedValue([fixtureRows[4]]);
    await openServiceTab();
    expect(screen.getByText(/용역팀 데이터가 없습니다/)).toBeInTheDocument();
    expect(screen.queryByText('일자별 공수합계')).not.toBeInTheDocument();
  });
});
