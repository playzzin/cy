import { dailyReportService } from './dailyReportService';
import { getTeamScopedRows } from './teamScopedReadService';

jest.mock('../config/firebase', () => ({ db: {} }));
jest.mock('./teamScopedReadService', () => ({ getTeamScopedRows: jest.fn() }));
jest.mock('./dailyReportFirestoreService', () => ({ dailyReportFirestoreService: {} }));

afterEach(() => jest.restoreAllMocks());
beforeEach(() => jest.clearAllMocks());
const range = { startDate: '2026-10-01', endDate: '2026-10-31' };
const report = { id: 'r', date: '2026-10-17', siteId: 's', teamId: 'a', workers: [
    { workerId: 'b', name: '지원인원', teamId: 'b', workerTeamName: '지원팀', workerTeamColorHex: '#d96cbd', manDay: 0.25, isSiteSupport: true },
] };

test('현장 전용 조회의 지원 표시와 분수 공수를 보존하고 일반 급여 조회와 분리한다', async () => {
    (getTeamScopedRows as jest.Mock).mockResolvedValue([report]);
    const normal = jest.spyOn(dailyReportService, 'getReports').mockResolvedValue([]);
    const rows = await dailyReportService.getWorkerRows({ ...range, includeSiteSupport: true });
    expect(getTeamScopedRows).toHaveBeenCalledWith('site_work_reports', range);
    expect(rows[0]).toMatchObject({ workerName: '지원인원', manDay: 0.25, workerTeamId: 'b', workerTeamColorHex: '#d96cbd', isSiteSupport: true, unitPrice: 0 });
    expect(normal).not.toHaveBeenCalled();
    await dailyReportService.getWorkerRows(range);
    expect(normal).toHaveBeenCalledTimes(1);
});

test('사무실 계정은 기존 현장 보고서 조회를 사용한다', async () => {
    (getTeamScopedRows as jest.Mock).mockResolvedValue(null);
    const normal = jest.spyOn(dailyReportService, 'getReports').mockResolvedValue([]);
    expect(await dailyReportService.getWorkerRows({ ...range, includeSiteSupport: true })).toEqual([]);
    expect(normal).toHaveBeenCalledTimes(1);
});

test('현장 조회 권한 오류를 빈 공수나 일반 조회로 대체하지 않는다', async () => {
    (getTeamScopedRows as jest.Mock).mockRejectedValue(new Error('permission-denied'));
    const normal = jest.spyOn(dailyReportService, 'getReports').mockResolvedValue([]);
    await expect(dailyReportService.getWorkerRows({ ...range, includeSiteSupport: true })).rejects.toThrow('permission-denied');
    expect(normal).not.toHaveBeenCalled();
});
