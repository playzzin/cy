import { act, renderHook, waitFor } from '@testing-library/react';
import { useAuth } from '../contexts/AuthContext';
import { dailyReportService, type DailyReportWorkerRow } from '../services/dailyReportService';
import { manpowerService, type Worker } from '../services/manpowerService';
import { teamService, type Team } from '../services/teamService';
import { useTeamWorkerDetailData } from './useTeamWorkerDetailData';

jest.mock('../contexts/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../services/teamService', () => ({ teamService: { getTeams: jest.fn() } }));
jest.mock('../services/manpowerService', () => ({ manpowerService: { getWorkers: jest.fn() } }));
jest.mock('../services/dailyReportService', () => ({ dailyReportService: { getWorkerRows: jest.fn() } }));

const month = { startDate: '2026-10-01', endDate: '2026-10-31' };
const previousMonth = { startDate: '2026-09-01', endDate: '2026-09-30' };
const teams = [{ id: 'team-a', name: '검증팀' }] as Team[];
const workers = [{ id: 'worker-a', name: '검증작업자', teamId: 'team-a' }] as Worker[];
const report = (id: string) => [{ reportId: id, workerId: 'worker-a', date: month.startDate, amount: 100000 }] as DailyReportWorkerRow[];
function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason: Error) => void;
    const promise = new Promise<T>((resolvePromise, rejectPromise) => { resolve = resolvePromise; reject = rejectPromise; });
    return { promise, resolve, reject };
}

beforeEach(() => {
    jest.resetAllMocks();
    (useAuth as jest.Mock).mockReturnValue({ currentUser: { uid: 'leader-a' } });
    (teamService.getTeams as jest.Mock).mockResolvedValue(teams);
    (manpowerService.getWorkers as jest.Mock).mockResolvedValue(workers);
    (dailyReportService.getWorkerRows as jest.Mock).mockResolvedValue(report('october'));
});

test('마스터 두 요청이 끝난 뒤 월간 조회를 시작하고 늦은 일보가 인원 목록을 막지 않는다', async () => {
    const teamRead = deferred<Team[]>();
    const workerRead = deferred<Worker[]>();
    const outputRead = deferred<DailyReportWorkerRow[]>();
    (teamService.getTeams as jest.Mock).mockReturnValue(teamRead.promise);
    (manpowerService.getWorkers as jest.Mock).mockReturnValue(workerRead.promise);
    (dailyReportService.getWorkerRows as jest.Mock).mockReturnValue(outputRead.promise);
    const { result } = renderHook(() => useTeamWorkerDetailData(month));
    expect(teamService.getTeams).toHaveBeenCalledTimes(1);
    expect(manpowerService.getWorkers).toHaveBeenCalledWith(true);
    expect(dailyReportService.getWorkerRows).not.toHaveBeenCalled();
    await act(async () => { teamRead.resolve(teams); });
    expect(dailyReportService.getWorkerRows).not.toHaveBeenCalled();
    await act(async () => { workerRead.resolve(workers); });
    expect(result.current.workers).toEqual(workers);
    expect(result.current.teams).toEqual(teams);
    expect(result.current.loadingMaster).toBe(false);
    expect(result.current.loadingOutput).toBe(true);
    expect(result.current.outputRows).toEqual([]);
    expect(dailyReportService.getWorkerRows).toHaveBeenCalledWith(month);
    await act(async () => { outputRead.resolve(report('ready')); });
    expect(result.current.loadingOutput).toBe(false);
    expect(result.current.outputRows).toEqual(report('ready'));
});

test('월간 조회 실패는 작업자 목록을 유지하고 유효한 빈 출력 결과로 취급하지 않는다', async () => {
    (dailyReportService.getWorkerRows as jest.Mock).mockRejectedValue(new Error('report unavailable'));
    const { result } = renderHook(() => useTeamWorkerDetailData(month));
    await waitFor(() => expect(result.current.outputError).toBe('출력 상세 데이터를 불러오지 못했습니다.'));
    expect(result.current.workers).toEqual(workers);
    expect(result.current.masterError).toBe('');
    expect(result.current.loadingOutput).toBe(false);
    expect(result.current.outputRows).toEqual([]);
});

test('마스터 실패 시 월간 조회를 하지 않고 새로고침으로 두 단계를 다시 조회한다', async () => {
    (teamService.getTeams as jest.Mock).mockRejectedValueOnce(new Error('directory unavailable'));
    const { result } = renderHook(() => useTeamWorkerDetailData(month));
    await waitFor(() => expect(result.current.masterError).toBe('팀/작업자 데이터를 불러오지 못했습니다.'));
    expect(dailyReportService.getWorkerRows).not.toHaveBeenCalled();
    expect(result.current.loadingMaster).toBe(false);
    expect(result.current.loadingOutput).toBe(false);
    act(() => { result.current.refresh(); });
    await waitFor(() => expect(result.current.outputRows).toEqual(report('october')));
    expect(teamService.getTeams).toHaveBeenCalledTimes(2);
    expect(manpowerService.getWorkers).toHaveBeenCalledTimes(2);
    expect(result.current.masterError).toBe('');
});

test('월 변경은 마스터를 재조회하지 않고 이전 월 결과를 즉시 가린다', async () => {
    const september = deferred<DailyReportWorkerRow[]>();
    const { result, rerender } = renderHook(props => useTeamWorkerDetailData(props), { initialProps: month });
    await waitFor(() => expect(result.current.outputRows).toEqual(report('october')));
    (dailyReportService.getWorkerRows as jest.Mock).mockReturnValueOnce(september.promise);
    rerender(previousMonth);
    expect(result.current.outputRows).toEqual([]);
    expect(result.current.loadingOutput).toBe(true);
    expect(result.current.workers).toEqual(workers);
    expect(teamService.getTeams).toHaveBeenCalledTimes(1);
    expect(manpowerService.getWorkers).toHaveBeenCalledTimes(1);
    await act(async () => { september.resolve(report('september')); });
    expect(result.current.outputRows).toEqual(report('september'));
});

test('이전 월 요청이 나중에 끝나도 현재 월 결과를 덮어쓰지 않는다', async () => {
    const october = deferred<DailyReportWorkerRow[]>();
    const september = deferred<DailyReportWorkerRow[]>();
    (dailyReportService.getWorkerRows as jest.Mock).mockReturnValueOnce(october.promise).mockReturnValueOnce(september.promise);
    const { result, rerender } = renderHook(props => useTeamWorkerDetailData(props), { initialProps: month });
    await waitFor(() => expect(dailyReportService.getWorkerRows).toHaveBeenCalledTimes(1));
    rerender(previousMonth);
    await act(async () => { september.resolve(report('september')); });
    await act(async () => { october.resolve(report('stale-october')); });
    expect(result.current.outputRows).toEqual(report('september'));
    expect(result.current.loadingOutput).toBe(false);
});

test('계정 변경 시 이전 목록을 즉시 가리고 이전 계정의 늦은 월간 응답을 폐기한다', async () => {
    const oldOutput = deferred<DailyReportWorkerRow[]>();
    const newWorkers = deferred<Worker[]>();
    (dailyReportService.getWorkerRows as jest.Mock).mockReturnValueOnce(oldOutput.promise);
    const { result, rerender } = renderHook(() => useTeamWorkerDetailData(month));
    await waitFor(() => expect(result.current.workers).toEqual(workers));
    (useAuth as jest.Mock).mockReturnValue({ currentUser: { uid: 'leader-b' } });
    (manpowerService.getWorkers as jest.Mock).mockReturnValueOnce(newWorkers.promise);
    rerender();
    expect(result.current.workers).toEqual([]);
    expect(result.current.teams).toEqual([]);
    expect(result.current.outputRows).toEqual([]);
    expect(result.current.loadingMaster).toBe(true);
    await act(async () => { oldOutput.resolve(report('previous-account')); });
    expect(result.current.outputRows).toEqual([]);
    const nextWorkers = [{ id: 'worker-b', name: '새계정작업자', teamId: 'team-b' }] as Worker[];
    await act(async () => { newWorkers.resolve(nextWorkers); });
    await waitFor(() => expect(result.current.loadingOutput).toBe(false));
    expect(result.current.workers).toEqual(nextWorkers);
    expect(result.current.outputRows).toEqual(report('october'));
});

test('계정 변경 이전의 마스터 응답은 새 계정의 목록과 월간 요청에 사용하지 않는다', async () => {
    const oldWorkers = deferred<Worker[]>();
    (manpowerService.getWorkers as jest.Mock).mockReturnValueOnce(oldWorkers.promise);
    const { result, rerender } = renderHook(() => useTeamWorkerDetailData(month));
    (useAuth as jest.Mock).mockReturnValue({ currentUser: { uid: 'leader-b' } });
    const nextWorkers = [{ id: 'worker-b', name: '새계정작업자', teamId: 'team-b' }] as Worker[];
    (manpowerService.getWorkers as jest.Mock).mockResolvedValueOnce(nextWorkers);
    rerender();
    await waitFor(() => expect(result.current.workers).toEqual(nextWorkers));
    await act(async () => { oldWorkers.resolve(workers); });
    expect(result.current.workers).toEqual(nextWorkers);
    expect(dailyReportService.getWorkerRows).toHaveBeenCalledTimes(1);
});

test('새로고침은 마스터부터 다시 조회하며 이전 출력 응답이 새 결과를 덮지 못한다', async () => {
    const oldOutput = deferred<DailyReportWorkerRow[]>();
    const refreshedWorkers = deferred<Worker[]>();
    (dailyReportService.getWorkerRows as jest.Mock).mockReturnValueOnce(oldOutput.promise);
    const { result } = renderHook(() => useTeamWorkerDetailData(month));
    await waitFor(() => expect(dailyReportService.getWorkerRows).toHaveBeenCalledTimes(1));
    (manpowerService.getWorkers as jest.Mock).mockReturnValueOnce(refreshedWorkers.promise);
    act(() => { result.current.refresh(); });
    expect(result.current.loadingMaster).toBe(true);
    expect(result.current.outputRows).toEqual([]);
    expect(dailyReportService.getWorkerRows).toHaveBeenCalledTimes(1);
    await act(async () => { refreshedWorkers.resolve(workers); });
    await waitFor(() => expect(result.current.outputRows).toEqual(report('october')));
    await act(async () => { oldOutput.resolve(report('stale-output')); });
    expect(result.current.outputRows).toEqual(report('october'));
    expect(teamService.getTeams).toHaveBeenCalledTimes(2);
});

test('서명 변경은 현재 작업자만 갱신하고 조회를 다시 하지 않는다', async () => {
    const { result } = renderHook(() => useTeamWorkerDetailData(month));
    await waitFor(() => expect(result.current.loadingOutput).toBe(false));
    act(() => { result.current.updateWorkerSignature('worker-a', 'signature-fixture.png'); });
    expect(result.current.workers).toEqual([{ ...workers[0], signatureUrl: 'signature-fixture.png' }]);
    expect(workers[0].signatureUrl).toBeUndefined();
    expect(teamService.getTeams).toHaveBeenCalledTimes(1);
    expect(dailyReportService.getWorkerRows).toHaveBeenCalledTimes(1);
});

test('로그아웃하면 자료를 즉시 가리고 새로운 조회를 하지 않는다', async () => {
    const { result, rerender } = renderHook(() => useTeamWorkerDetailData(month));
    await waitFor(() => expect(result.current.outputRows).toEqual(report('october')));
    (useAuth as jest.Mock).mockReturnValue({ currentUser: null });
    rerender();
    expect(result.current.workers).toEqual([]);
    expect(result.current.outputRows).toEqual([]);
    expect(result.current.loadingMaster).toBe(false);
    expect(result.current.loadingOutput).toBe(false);
    expect(teamService.getTeams).toHaveBeenCalledTimes(1);
});

test('같은 계정으로 다시 로그인해도 이전 자료를 재사용하지 않고 새 마스터를 기다린다', async () => {
    const { result, rerender } = renderHook(() => useTeamWorkerDetailData(month));
    await waitFor(() => expect(result.current.outputRows).toEqual(report('october')));
    (useAuth as jest.Mock).mockReturnValue({ currentUser: null });
    rerender();
    const freshWorkers = deferred<Worker[]>();
    (manpowerService.getWorkers as jest.Mock).mockReturnValueOnce(freshWorkers.promise);
    (useAuth as jest.Mock).mockReturnValue({ currentUser: { uid: 'leader-a' } });
    rerender();
    expect(result.current.workers).toEqual([]);
    expect(result.current.outputRows).toEqual([]);
    expect(result.current.loadingMaster).toBe(true);
    expect(dailyReportService.getWorkerRows).toHaveBeenCalledTimes(1);
    await act(async () => { freshWorkers.resolve(workers); });
    await waitFor(() => expect(result.current.loadingOutput).toBe(false));
    expect(dailyReportService.getWorkerRows).toHaveBeenCalledTimes(2);
});
