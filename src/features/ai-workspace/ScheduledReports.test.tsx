import React from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ScheduledReports } from './ScheduledReports';
import { AiReportOverview, AiReportSchedule, AiSavedAnalysis } from './contract';
import type { WorkspaceClient } from './service';
const item: AiSavedAnalysis = { id: 'saved', name: '월간 보고', revision: 2, period: 'lastMonth', createdAt: '', updatedAt: '', plan: {
  operation: 'aggregate', entity: 'worker', range: { startDate: '2026-08-01', endDate: '2026-08-31' }, comparison: null, groupBy: 'site', filters: [], missingAccount: false, status: '', sortBy: 'name', direction: 'asc',
  report: { format: 'both', title: '월간 보고', includeAmount: false, includeDetails: true, splitByGroup: true }, clarification: '',
} };
const schedule: AiReportSchedule = { id: 'schedule', revision: 3, savedId: item.id, savedRevision: item.revision, name: item.name, cadence: { frequency: 'monthly', time: '09:00', weekday: null, monthDay: 1 },
  enabled: true, nextRunAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-09-28T00:00:00.000Z', lastMessage: '' };
const view = (): AiReportOverview => ({ schedules: [schedule], runs: [] });
const client = () => ({ listSaved: jest.fn().mockResolvedValue({ items: [item] }),
  reports: { list: jest.fn().mockResolvedValue(view()), save: jest.fn().mockResolvedValue(view()), pause: jest.fn().mockResolvedValue(view()), delete: jest.fn().mockResolvedValue({ schedules: [], runs: [] }),
    retry: jest.fn().mockResolvedValue(view()), exportFile: jest.fn().mockResolvedValue({ fileName: 'report.xlsx', contentType: 'application/xlsx', base64: 'dGVzdA==' }) },
} as unknown as WorkspaceClient);
const open = async () => { fireEvent.click(screen.getByRole('button', { name: '정기 보고 열기' })); await screen.findByRole('button', { name: '월간 보고 예약 수정' }); };
beforeEach(() => { URL.createObjectURL = jest.fn().mockReturnValue('blob:report'); URL.revokeObjectURL = jest.fn(); });
test('loads on opening, explains Korean time and requires a concrete review before saving', async () => {
  const api = client(); render(<ScheduledReports client={api} disabled={false} onManaging={() => {}} />);
  expect(api.reports.list).not.toHaveBeenCalled(); await open();
  fireEvent.change(screen.getByLabelText('보고할 저장 분석'), { target: { value: 'saved' } });
  fireEvent.change(screen.getByLabelText('실행 주기'), { target: { value: 'weekly' } });
  fireEvent.change(screen.getByLabelText('실행 요일'), { target: { value: '5' } });
  fireEvent.change(screen.getByLabelText('실행 시간 (한국 시간)'), { target: { value: '17:30' } });
  fireEvent.click(screen.getByRole('button', { name: '예약 내용 확인' }));
  expect(api.reports.save).not.toHaveBeenCalled(); expect(screen.getByLabelText('예약 내용 확인')).toHaveTextContent('매주 금요일 17:30 (한국 시간)');
  expect(screen.getByText(/실행 시 지난달/)).toBeInTheDocument(); expect(screen.getByText(/금액 제외/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '이 내용으로 예약 저장' }));
  await waitFor(() => expect(api.reports.save).toHaveBeenCalledWith({ savedId: 'saved', savedRevision: 2, cadence: { frequency: 'weekly', time: '17:30', weekday: 5, monthDay: null } }));
});
test('edits and pauses use the current schedule revision and refreshing dismisses stale review', async () => {
  const api = client(); render(<ScheduledReports client={api} disabled={false} onManaging={() => {}} />); await open();
  fireEvent.click(screen.getByRole('button', { name: '월간 보고 예약 수정' }));
  fireEvent.click(screen.getByRole('button', { name: '예약 내용 확인' }));
  fireEvent.click(screen.getByRole('button', { name: '이 내용으로 예약 저장' }));
  await waitFor(() => expect(api.reports.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'schedule', revision: 3, savedRevision: 2 })));
  await screen.findByText('정기 보고를 예약했습니다.');
  fireEvent.click(screen.getByRole('button', { name: '월간 보고 예약 중지' }));
  await waitFor(() => expect(api.reports.pause).toHaveBeenCalledWith('schedule', 3));
  await screen.findByText('예약을 중지했습니다.');
  fireEvent.click(screen.getByRole('button', { name: '예약 내용 확인' }));
  fireEvent.click(screen.getByRole('button', { name: '정기 보고 새로고침' }));
  await screen.findByText('목록을 새로고침했습니다.'); expect(screen.queryByRole('button', { name: '이 내용으로 예약 저장' })).not.toBeInTheDocument();
});
test('deleting a reservation needs an explicit confirmation and preserves report-history explanation', async () => {
  const api = client(); render(<ScheduledReports client={api} disabled={false} onManaging={() => {}} />); await open();
  fireEvent.click(screen.getByRole('button', { name: '월간 보고 예약 삭제' }));
  expect(api.reports.delete).not.toHaveBeenCalled(); expect(screen.getByText(/이미 생성한 보고서는 보관 기한/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '예약 삭제 확인' }));
  await waitFor(() => expect(api.reports.delete).toHaveBeenCalledWith('schedule', 3));
});
test('partial report files use the run ID, show expiry, and revoke local downloads on close', async () => {
  const api = client(); (api.reports.list as jest.Mock).mockResolvedValue({ ...view(), runs: [{ id: 'run', scheduleId: 'schedule', scheduleRevision: 3, name: '부분 보고',
    dueAt: '2026-10-01T00:00:00Z', createdAt: '2026-10-01T00:00:00Z', expiresAt: '2026-10-08T00:00:00Z', completedAt: '2026-10-01T00:01:00Z', attempts: 1, status: 'partial', retryable: false, message: '일부 자료 확인 필요' }] });
  render(<ScheduledReports client={api} disabled={false} onManaging={() => {}} />); await open();
  expect(screen.getByText(/부분 결과/)).toBeInTheDocument(); expect(screen.getByText(/1회 시도 · 만료/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '부분 보고 XLSX 만들기' }));
  expect(await screen.findByRole('link', { name: '정기 보고 파일 다운로드' })).toHaveAttribute('download', 'report.xlsx');
  expect(api.reports.exportFile).toHaveBeenCalledWith('run', 'xlsx');
  fireEvent.click(screen.getByRole('button', { name: '정기 보고 접기' })); expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:report');
});
test('only retryable failures offer retry and duplicate clicks do not submit twice', async () => {
  const api = client(); let finish!: (value: AiReportOverview) => void;
  (api.reports.retry as jest.Mock).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  (api.reports.list as jest.Mock).mockResolvedValue({ ...view(), runs: [{ id: 'failed', name: '실패 보고', status: 'failed', attempts: 1, retryable: true, dueAt: schedule.nextRunAt, expiresAt: schedule.nextRunAt }] });
  render(<ScheduledReports client={api} disabled={false} onManaging={() => {}} />); await open();
  const button = screen.getByRole('button', { name: '실패 보고 실패한 보고 다시 시도' }); fireEvent.click(button); fireEvent.click(button);
  expect(api.reports.retry).toHaveBeenCalledTimes(1); expect(api.reports.retry).toHaveBeenCalledWith('failed');
  await act(async () => finish(view()));
});
test('schedule save errors are visible and do not claim success', async () => {
  const api = client(); (api.reports.save as jest.Mock).mockRejectedValue(new Error('예약이 변경되었습니다.'));
  const { unmount } = render(<ScheduledReports client={api} disabled={false} onManaging={() => {}} />); await open();
  fireEvent.change(screen.getByLabelText('보고할 저장 분석'), { target: { value: 'saved' } });
  fireEvent.click(screen.getByRole('button', { name: '예약 내용 확인' })); fireEvent.click(screen.getByRole('button', { name: '이 내용으로 예약 저장' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('예약이 변경되었습니다.');
  expect(screen.queryByText('정기 보고를 예약했습니다.')).not.toBeInTheDocument(); unmount();
});

test('late exports after unmount create no retained download', async () => {
  const api = client(); let finish!: (value: unknown) => void;
  (api.reports.list as jest.Mock).mockResolvedValue({ ...view(), runs: [{ id: 'complete', name: '완료 보고', status: 'complete', attempts: 1, retryable: false, dueAt: schedule.nextRunAt, expiresAt: schedule.nextRunAt }] });
  (api.reports.exportFile as jest.Mock).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const { unmount } = render(<ScheduledReports client={api} disabled={false} onManaging={() => {}} />); await open();
  fireEvent.click(screen.getByRole('button', { name: '완료 보고 PDF 만들기' })); unmount();
  await act(async () => finish({ fileName: 'late.pdf', contentType: 'application/pdf', base64: 'dGVzdA==' }));
  expect(URL.createObjectURL).not.toHaveBeenCalled();
});

test('a server scheduler stop disables new schedules and retries while keeping pause and downloads available', async () => {
  const api = client(); (api.reports.list as jest.Mock).mockResolvedValue({ ...view(), schedulerEnabled: false, runs: [
    { id: 'failed', name: '실패 보고', status: 'failed', attempts: 1, retryable: true, dueAt: schedule.nextRunAt, expiresAt: schedule.nextRunAt },
    { id: 'done', name: '완료 보고', status: 'complete', attempts: 1, retryable: false, dueAt: schedule.nextRunAt, expiresAt: schedule.nextRunAt },
  ] });
  render(<ScheduledReports client={api} disabled={false} onManaging={() => {}} />); await open();
  expect(screen.getByText(/관리자가 정기 보고 실행을 중지했습니다/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('보고할 저장 분석'), { target: { value: 'saved' } });
  expect(screen.getByRole('button', { name: '예약 내용 확인' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '실패 보고 실패한 보고 다시 시도' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '월간 보고 예약 중지' })).toBeEnabled();
  expect(screen.getByRole('button', { name: '완료 보고 PDF 만들기' })).toBeEnabled();
});
