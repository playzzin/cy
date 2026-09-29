import { runTransaction } from 'firebase/firestore';
import { dailyReportService } from './dailyReportService';
import { dailyReportLogService } from './dailyReportLogService';

jest.mock('../config/firebase', () => ({ db: {} }));
jest.mock('./teamScopedReadService', () => ({ getTeamScopedRows: jest.fn() }));
jest.mock('../utils/firestoreConverter', () => ({ createConverter: () => ({}) }));
jest.mock('../utils/swal', () => ({ toast: { updated: jest.fn() } }));
jest.mock('./dailyReportLogService', () => ({ dailyReportLogService: { createLog: jest.fn() } }));
jest.mock('./systemMessageService', () => ({ systemMessageService: { notifyDailyReportEvent: jest.fn() } }));
jest.mock('firebase/firestore', () => ({
    runTransaction: jest.fn(),
    doc: (_db: unknown, _collection: string, id: string) => ({ withConverter: () => ({ id }) }),
}));

let stored: any;
let version: number;
let attempts: number;
const clone = (value: any) => JSON.parse(JSON.stringify(value));

beforeEach(() => {
    jest.clearAllMocks();
    stored = { id: 'report', date: '2026-09-29', teamId: 'team', siteId: 'site', totalManDay: 2,
        workers: [{ workerId: 'a', name: '테스트 A', manDay: 1, unitPrice: 100 }, { workerId: 'b', name: '테스트 B', manDay: 1, unitPrice: 100 }] };
    version = 0;
    attempts = 0;
    jest.spyOn(dailyReportService, '_updateStatsDelta').mockResolvedValue(undefined);
    jest.spyOn(dailyReportService, '_updateStats').mockResolvedValue(undefined);
    // Model optimistic retries: only a transaction based on the latest version commits.
    (runTransaction as jest.Mock).mockImplementation(async (_db, callback) => {
        for (let retry = 0; retry < 10; retry++) {
            attempts++;
            const seen = version;
            const snapshot = clone(stored);
            let pending: any = undefined;
            const result = await callback({
                get: async () => ({ exists: () => snapshot !== null, data: () => snapshot }),
                set: (_ref: unknown, data: any) => { pending = clone(data); },
                delete: () => { pending = null; },
            });
            if (version !== seen) continue;
            stored = pending;
            version++;
            return result;
        }
        throw new Error('retry limit');
    });
});

afterEach(() => jest.restoreAllMocks());

test('서로 다른 행 동시 저장 시 변경과 합계를 모두 보존하고 후속 처리는 커밋당 한 번 실행한다', async () => {
    await Promise.all([
        dailyReportService.updateWorkerInReport('report', 'a', { manDay: 2 }, 0),
        dailyReportService.updateWorkerInReport('report', 'b', { manDay: 3 }, 1),
    ]);
    expect(stored.workers.map((worker: any) => worker.manDay)).toEqual([2, 3]);
    expect(stored.totalManDay).toBe(5);
    expect(stored.totalAmount).toBe(500);
    expect(attempts).toBeGreaterThan(2);
    expect(dailyReportService._updateStatsDelta).toHaveBeenCalledTimes(2);
    expect(dailyReportLogService.createLog).toHaveBeenCalledTimes(2);
});

test('일괄 수정과 행 수정이 겹쳐도 서로의 변경을 보존한다', async () => {
    const [bulk] = await Promise.all([
        dailyReportService.bulkUpdateWorkersInReports([{ reportId: 'report', workerId: 'a', workerIndex: 0, updates: { manDay: 2 } }]),
        dailyReportService.updateWorkerInReport('report', 'b', { manDay: 3 }, 1),
    ]);
    expect(stored.workers.map((worker: any) => worker.manDay)).toEqual([2, 3]);
    expect(bulk).toEqual({ updatedReportCount: 1, updatedWorkerCount: 1 });
});

test('헤더 변경과 작업자 수정이 겹쳐도 둘 다 보존한다', async () => {
    await Promise.all([
        dailyReportService.updateReport('report', { siteManagerName: '테스트 관리자' }),
        dailyReportService.updateWorkerInReport('report', 'b', { manDay: 3 }, 1),
    ]);
    expect(stored.siteManagerName).toBe('테스트 관리자');
    expect(stored.workers[1].manDay).toBe(3);
});

test('삭제 도중 다른 행이 갱신되면 최신 데이터를 기준으로 삭제한다', async () => {
    await Promise.all([
        dailyReportService.updateWorkerInReport('report', 'b', { manDay: 3 }, 1),
        dailyReportService.deleteWorkersFromReports([{ reportId: 'report', workerId: 'a', workerIndex: 0 }]),
    ]);
    expect(stored.workers.map((worker: any) => [worker.workerId, worker.manDay])).toEqual([['b', 3]]);
    expect(stored.totalManDay).toBe(3);
});

test('잘못된 공수와 다른 작업자로 바뀐 행은 커밋하지 않는다', async () => {
    await expect(dailyReportService.updateWorkerInReport('report', 'a', { manDay: -1 }, 0)).rejects.toThrow('Invalid manDay');
    await expect(dailyReportService.updateWorkerInReport('report', 'a', { manDay: 2 }, 1)).rejects.toThrow('no longer matches');
    expect(version).toBe(0);
    expect(dailyReportService._updateStatsDelta).not.toHaveBeenCalled();
});

test('마지막 작업자를 삭제할 때만 일보를 삭제한다', async () => {
    const result = await dailyReportService.deleteWorkersFromReports([
        { reportId: 'report', workerId: 'a', workerIndex: 0 },
        { reportId: 'report', workerId: 'b', workerIndex: 1 },
    ]);
    expect(stored).toBeNull();
    expect(result).toEqual({ deletedReportCount: 1, updatedReportCount: 0, deletedWorkerCount: 2 });
    expect(dailyReportService._updateStats).toHaveBeenCalledTimes(1);
});
