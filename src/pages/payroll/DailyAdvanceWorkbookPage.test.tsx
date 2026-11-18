import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import * as XLSX from 'xlsx-js-style';
import DailyAdvanceWorkbookPage from './DailyAdvanceWorkbookPage';
import { renderDayLookupCanvas } from './utils/dayLookupImage';
import { dailyReportService } from '../../services/dailyReportService';
import { manpowerService } from '../../services/manpowerService';
import { teamService } from '../../services/teamService';
import { teamSettlementService } from '../../services/teamSettlementService';
import { dailyAdvanceStatementRecruiterFeeService } from '../../services/dailyAdvanceStatementRecruiterFeeService';

jest.mock('../../services/dailyReportService', () => ({ dailyReportService: { getWorkerRows: jest.fn() } }));
jest.mock('../../services/manpowerService', () => ({ manpowerService: { getWorkers: jest.fn() } }));
jest.mock('../../services/teamService', () => ({ teamService: { getTeams: jest.fn() } }));
jest.mock('../../services/teamSettlementService', () => ({
  teamSettlementService: { getTeamDisplayOrder: jest.fn() },
}));
jest.mock('../../services/dailyAdvanceWorkbookProfileService', () => ({
  dailyAdvanceWorkbookProfileService: { getProfiles: async () => [] },
}));
jest.mock('../../services/dailyAdvanceStatementRecruiterFeeService', () => ({
  dailyAdvanceStatementRecruiterFeeService: {
    getFeesByMonth: jest.fn(),
    subscribeFeesByMonth: () => () => {},
    saveFees: jest.fn().mockResolvedValue(undefined),
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

const openDailyTeams = async () => {
  (dailyReportService.getWorkerRows as jest.Mock).mockResolvedValue(
    fixtureRows.slice(0, 4).map(row => ({ ...row, salaryModel: '일급제' }))
  );
  (manpowerService.getWorkers as jest.Mock).mockResolvedValue([
    { id: 'a', name: '검증가', teamId: 'team-a', salaryModel: '일급제' },
    { id: 'b', name: '검증나', teamId: 'team-b', salaryModel: '일급제' },
  ]);
  (teamService.getTeams as jest.Mock).mockResolvedValue([
    { id: 'team-a', name: '검증팀 A', color: '#2563eb' },
    { id: 'team-b', name: '검증팀 B', color: '#16a34a' },
  ]);
  render(<DailyAdvanceWorkbookPage />);
  await screen.findByText('검증가');
  fireEvent.change(screen.getByLabelText('조회월'), { target: { value: fixtureMonth } });
  await screen.findByText('검증가');
};

describe('대납출력부', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(dailyAdvanceStatementRecruiterFeeService.getFeesByMonth).mockResolvedValue([]);
    window.localStorage.clear();
    (teamSettlementService.getTeamDisplayOrder as jest.Mock).mockResolvedValue([]);
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

  it('팀청구 미리보기는 지정한 월·팀의 대납출력부 청구서를 만들고 소개비를 별도로 보여주며 청구액에 포함한다', async () => {
    jest.mocked(dailyAdvanceStatementRecruiterFeeService.getFeesByMonth).mockResolvedValue([
      { month: fixtureMonth, teamKey: 'team-daily', workerId: 'daily', amount: 120000 },
      { month: fixtureMonth, teamKey: 'team-a', workerId: 'a', amount: 999000 },
    ]);
    (dailyReportService.getWorkerRows as jest.Mock).mockImplementation(async (params?: { startDate?: string }) => {
      if (params?.startDate !== '2026-02-01') throw new Error('선택 월 밖의 근무 이력 조회 실패');
      return fixtureRows;
    });
    render(<DailyAdvanceWorkbookPage statementContext={{ month: fixtureMonth, teamId: 'team-daily', teamName: '일급팀' }} />);
    const row = await screen.findByRole('row', { name: /^1 일급검증/ });
    const cells = within(row).getAllByRole('cell');
    expect(cells[cells.length - 2]).toHaveTextContent('120,000');
    expect(cells[cells.length - 1]).toHaveTextContent('1,020,000');
    expect(screen.getByLabelText('인력소개비 합계')).toHaveTextContent('120,000원');
    expect(screen.getByLabelText('청구금액 합계')).toHaveTextContent('1,020,000원');
    expect(screen.getByText('2026년 2월 일급팀 청구서')).toBeVisible();
    expect(screen.queryByText('검증가')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /인력소개비 저장/ })).not.toBeInTheDocument();
    expect(dailyAdvanceStatementRecruiterFeeService.saveFees).not.toHaveBeenCalled();
    expect(dailyReportService.getWorkerRows).toHaveBeenCalledWith({ startDate: '2026-02-01', endDate: '2026-02-28' });
    fireEvent.click(screen.getByRole('button', { name: '엑셀 다운로드' }));
    const workbook = (XLSX.writeFile as jest.Mock).mock.calls[0][0] as XLSX.WorkBook;
    const exported = XLSX.utils.sheet_to_json(workbook.Sheets['청구서'], { header: 1 });
    expect(JSON.stringify(exported)).toContain('120000');
    expect(JSON.stringify(exported)).toContain('1020000');
  });

  it('대납출력부에 내역이 없는 팀도 지정한 팀의 빈 청구서를 보여주고 다른 팀으로 바꾸지 않는다', async () => {
    render(<DailyAdvanceWorkbookPage statementContext={{ month: fixtureMonth, teamId: 'empty-team', teamName: '자료없는 팀' }} />);
    expect(await screen.findByText('2026년 2월 자료없는 팀 청구서')).toBeVisible();
    expect(screen.getByText('청구서로 만들 데이터가 없습니다.')).toBeVisible();
    expect(screen.queryByText('일급검증')).not.toBeInTheDocument();
    expect(screen.getByLabelText('인력소개비 합계')).toHaveTextContent('0원');
  });

  it('용역 청구 미리보기는 현재 팀만 표시하고 이전 달을 포함한 소개비와 엑셀 금액이 일치한다', async () => {
    const history = [27, 28, 29, 30].map(day => ({ ...fixtureRows[0], date: `2026-01-${day}` }));
    jest.mocked(dailyReportService.getWorkerRows).mockImplementation(async params => (params?.startDate === '1900-01-01' ? [...history, ...fixtureRows] : fixtureRows) as any);
    jest.mocked(teamService.getTeams).mockResolvedValue([{ id: 'team-a', legacyId: 'old-a', name: '검증팀 A' }] as any);
    render(<DailyAdvanceWorkbookPage statementContext={{ month: fixtureMonth, teamId: 'old-a', teamName: '검증팀 A', kind: 'service' }} />);
    expect(await screen.findByText('2026-02 검증팀 A 용역비 청구서')).toBeVisible();
    expect(screen.queryByText('검증나')).not.toBeInTheDocument();
    expect(screen.queryByText('일급검증')).not.toBeInTheDocument();
    const cells = totalCells();
    expect(cells[29]).toHaveTextContent('2.5');
    expect(cells[30]).toHaveTextContent('60,000');
    expect(cells[31]).toHaveTextContent('310,000');
    fireEvent.click(screen.getByRole('button', { name: '엑셀 다운로드' }));
    const rows = XLSX.utils.sheet_to_json<Array<string | number>>(exportedSheet(), { header: 1 });
    expect(rows[rows.length - 1].slice(-4)).toEqual([2.5, 60000, 310000, '']);
  });

  it('용역 내역이 없는 팀은 다른 팀 자료로 바뀌지 않는다', async () => {
    render(<DailyAdvanceWorkbookPage statementContext={{ month: fixtureMonth, teamId: 'empty-team', teamName: '빈 팀', kind: 'service' }} />);
    expect(await screen.findByText(/용역팀 데이터가 없습니다/)).toBeVisible();
    expect(screen.queryByText('검증가')).not.toBeInTheDocument();
    expect(screen.queryByText('검증나')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '화면복사' })).toBeDisabled();
  });

  it('용역 이력 조회가 실패하면 부정확한 청구서와 다운로드를 막는다', async () => {
    const warning = jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.mocked(dailyReportService.getWorkerRows).mockImplementation(async params => {
      if (params?.startDate === '1900-01-01') throw new Error('history-unavailable');
      return fixtureRows as any;
    });
    render(<DailyAdvanceWorkbookPage statementContext={{ month: fixtureMonth, teamId: 'team-a', teamName: '검증팀 A', kind: 'service' }} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('용역팀 누적 근무일');
    expect(screen.getByRole('button', { name: '엑셀 다운로드' })).toBeDisabled();
    expect(screen.queryByRole('table', { name: '용역비 청구 내역' })).not.toBeInTheDocument();
    warning.mockRestore();
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

    fireEvent.click(screen.getByRole('button', { name: '검증팀 A 선택' }));
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

    fireEvent.click(screen.getByRole('button', { name: '검증팀 B 선택' }));
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

  it('색상 팀 버튼의 선택을 청구서와 다른 시트, 엑셀에서 함께 사용한다', async () => {
    await openDailyTeams();
    expect(screen.queryByLabelText('청구서 팀')).not.toBeInTheDocument();
    const teamB = screen.getByRole('button', { name: '검증팀 B 선택' });
    expect(teamB.style.getPropertyValue('--advance-team-color')).toBe('#16a34a');
    fireEvent.click(teamB);
    fireEvent.click(screen.getByRole('button', { name: '청구서' }));
    expect(teamB).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('2026년 2월 검증팀 B 청구서')).toBeInTheDocument();
    expect(screen.getByText('검증나')).toBeInTheDocument();
    expect(screen.queryByText('검증가')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '전체 보기' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '엑셀 다운로드' }));
    const [book, filename] = (XLSX.writeFile as jest.Mock).mock.calls[0];
    const rows = XLSX.utils.sheet_to_json<Array<string | number>>(book.Sheets['청구서'], { header: 1 });
    expect(filename).toContain('검증팀_B');
    expect(rows[0][0]).toContain('검증팀 B');
    expect(rows[2][1]).toBe('검증나');
    expect(rows[rows.length - 1].slice(-3)).toEqual([0.5, 0, 100000]);
    expect(rows.flat()).not.toContain('검증가');

    fireEvent.click(screen.getByRole('button', { name: '검증팀 A 선택' }));
    expect(screen.getByText('2026년 2월 검증팀 A 청구서')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '인원DB' }));
    expect(screen.getByText('검증가')).toBeInTheDocument();
    expect(screen.queryByText('검증나')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '전체 보기' }));
    expect(screen.getByText('검증나')).toBeInTheDocument();
  });

  it('전체 팀에서 청구서를 열면 회사 공통 순서의 첫 팀을 선택한다', async () => {
    (teamSettlementService.getTeamDisplayOrder as jest.Mock).mockResolvedValue(['team-b', 'team-a']);
    await openDailyTeams();
    fireEvent.click(screen.getByRole('button', { name: '청구서' }));
    await screen.findByText('2026년 2월 검증팀 B 청구서');
    const buttons = within(screen.getByRole('group', { name: '팀 선택' })).getAllByRole('button');
    expect(buttons.map(button => button.getAttribute('aria-label'))).toEqual(['검증팀 B 선택', '검증팀 A 선택']);
    expect(buttons[0]).toHaveAttribute('aria-pressed', 'true');

    (dailyReportService.getWorkerRows as jest.Mock).mockResolvedValue([]);
    fireEvent.change(screen.getByLabelText('조회월'), { target: { value: '2026-03' } });
    await screen.findByText('선택한 조회월에 청구서로 만들 데이터가 없습니다.');
    expect(screen.queryByText('검증나')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '엑셀 다운로드' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /인력소개비 저장/ })).not.toBeInTheDocument();
  });

  it('실제 소개비 청구일만 선택·해제하고 금액을 바꾸지 않아도 날짜를 저장한다', async () => {
    const alert = jest.spyOn(window, 'alert').mockImplementation(() => {});
    try {
      jest.mocked(dailyAdvanceStatementRecruiterFeeService.getFeesByMonth).mockResolvedValue([{ month: fixtureMonth, teamKey: 'team-a', workerId: 'a', amount: 120000, chargeDates: [`${fixtureMonth}-03`] }]);
      await openDailyTeams();
      fireEvent.click(screen.getByRole('button', { name: '검증팀 A 선택' }));
      fireEvent.click(screen.getByRole('button', { name: '청구서' }));
      fireEvent.click(screen.getByRole('button', { name: '검증가 소개비 발생일 지정' }));
      const dialog = within(screen.getByRole('dialog', { name: '검증가 소개비 발생일' }));
      expect(dialog.getByRole('button', { name: `${fixtureMonth}-03 소개비 발생일` })).toHaveAttribute('aria-pressed', 'true');
      fireEvent.click(dialog.getByRole('button', { name: `${fixtureMonth}-03 소개비 발생일` }));
      fireEvent.click(dialog.getByRole('button', { name: `${fixtureMonth}-05 소개비 발생일` }));
      fireEvent.click(dialog.getByRole('button', { name: '선택 완료' }));
      expect(screen.getByRole('button', { name: '검증가 소개비 발생일 지정' })).toHaveTextContent('발생 1일');
      fireEvent.click(screen.getByRole('button', { name: '인력소개비 저장 (1)' }));
      await waitFor(() => expect(dailyAdvanceStatementRecruiterFeeService.saveFees).toHaveBeenCalledWith([
        expect.objectContaining({ month: fixtureMonth, teamKey: 'team-a', workerId: 'a', amount: 120000, chargeDates: [`${fixtureMonth}-05`] })
      ]));
      await waitFor(() => expect(screen.queryByRole('button', { name: '인력소개비 저장 (1)' })).not.toBeInTheDocument());
      fireEvent.click(screen.getByRole('button', { name: '검증팀 B 선택' }));
      expect(screen.getByRole('button', { name: '검증나 소개비 발생일 지정' })).toHaveTextContent('발생일 지정');
      fireEvent.click(screen.getByRole('button', { name: '검증팀 A 선택' }));
      expect(screen.getByRole('button', { name: '검증가 소개비 발생일 지정' })).toHaveTextContent('발생 1일');
    } finally { alert.mockRestore(); }
  });

  it('팀을 전환해도 소개비 초안이 섞이지 않고 선택한 팀의 소개비만 저장한다', async () => {
    const alert = jest.spyOn(window, 'alert').mockImplementation(() => {});
    try {
      await openDailyTeams();
      fireEvent.click(screen.getByRole('button', { name: '검증팀 A 선택' }));
      fireEvent.click(screen.getByRole('button', { name: '청구서' }));
      fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '12000' } });
      fireEvent.click(screen.getByRole('button', { name: '검증팀 B 선택' }));
      expect(screen.getByPlaceholderText('0')).toHaveValue('');
      fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '34000' } });
      fireEvent.click(screen.getByRole('button', { name: /인력소개비 저장/ }));
      await waitFor(() => expect(dailyAdvanceStatementRecruiterFeeService.saveFees).toHaveBeenCalledWith([
        expect.objectContaining({ month: fixtureMonth, teamKey: 'team-b', workerId: 'b', amount: 34000 }),
      ]));
      await waitFor(() => expect(alert).toHaveBeenCalledWith('청구서 인력소개비를 저장했습니다.'));
      fireEvent.click(screen.getByRole('button', { name: '검증팀 A 선택' }));
      expect(screen.getByPlaceholderText('0')).toHaveValue('12000');
      expect(screen.getByRole('button', { name: '인력소개비 저장 (1)' })).toBeInTheDocument();
    } finally {
      alert.mockRestore();
    }
  });

  it('일자별조회 이미지는 스크롤 밖의 열, 수정된 공수와 금액, 빈 날짜 안내를 포함한다', async () => {
    const note = '마지막 열 비고';
    (dailyReportService.getWorkerRows as jest.Mock).mockResolvedValue(
      fixtureRows.map(row => ({ ...row, workContent: note }))
    );
    await openServiceTab();
    fireEvent.click(screen.getByRole('button', { name: '일자별조회' }));
    fireEvent.click(screen.getByRole('button', { name: '일급팀 선택' }));
    fireEvent.change(screen.getByLabelText('일자'), { target: { value: `${fixtureMonth}-01` } });
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '1.5' } });

    const root = screen.getByRole('region', { name: '일자별조회' });
    const drawText = jest.fn();
    const context = {
      fillText: drawText, scale: jest.fn(), fillRect: jest.fn(), strokeRect: jest.fn(),
      measureText: (value: string) => ({ width: value.length * 8 }),
    };
    const getContext = jest.spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(context as unknown as CanvasRenderingContext2D);
    const cellBounds = jest.spyOn(HTMLTableCellElement.prototype, 'getBoundingClientRect')
      .mockReturnValue({ x: -300, width: 120 } as DOMRect);
    try {
      expect(renderDayLookupCanvas(root, () => 1).width).toBe(1200);
      const text = drawText.mock.calls.map(([value]) => value);
      expect(text).toEqual(expect.arrayContaining([
        '일자', `${fixtureMonth}-01`, '선택일 공수', '선택일 실지급금', '선택일 청구금 합계',
        '일급검증', '1.5', '127,500', '150,000', '비고', note,
      ]));
      expect(text).not.toContain('검증가');
      expect(drawText.mock.calls.find(([value]) => value === note)?.[1]).toBeGreaterThan(1080);

      fireEvent.change(screen.getByLabelText('일자'), { target: { value: `${fixtureMonth}-02` } });
      drawText.mockClear();
      renderDayLookupCanvas(root, () => 1);
      expect(drawText.mock.calls.map(([value]) => value)).toEqual(expect.arrayContaining([
        `${fixtureMonth}-02`, '0', '선택한 일자에 조회 결과가 없습니다.',
      ]));
    } finally {
      cellBounds.mockRestore();
      getContext.mockRestore();
    }
  });
});
