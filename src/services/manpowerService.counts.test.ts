import { auth } from '../config/firebase';
import { manpowerService } from './manpowerService';
import { workerFirestoreService } from './workerFirestoreService';
import { getTeamScopedRows } from './teamScopedReadService';
import { isDevAdminSessionEnabled } from '../utils/devAdminSession';

jest.mock('../config/firebase', () => ({ auth: { currentUser: { uid: 'test' } }, db: {}, storage: {} }));
jest.mock('firebase/firestore', () => ({
  Timestamp: class Timestamp {},
}));
jest.mock('./workerFirestoreService', () => ({ workerFirestoreService: { getWorkers: jest.fn() } }));
jest.mock('./databaseLogService', () => ({ databaseLogService: {} }));
jest.mock('./identityDocumentLogService', () => ({ recordWorkerIdentityChange: jest.fn() }));
jest.mock('./teamScopedReadService', () => ({ getTeamScopedRows: jest.fn() }));
jest.mock('../utils/devAdminSession', () => ({ isDevAdminSessionEnabled: jest.fn() }));
jest.mock('../utils/devAdminFixtures', () => ({ devWorkers: [{ status: '재직' }, { status: '퇴사' }] }));

let session = 0;
beforeEach(() => {
  jest.clearAllMocks();
  (auth.currentUser as { uid: string }).uid = `test-${session++}`;
  (getTeamScopedRows as jest.Mock).mockResolvedValue(null);
  (isDevAdminSessionEnabled as jest.Mock).mockReturnValue(false);
});

it('counts the entire shared worker list, including legacy status aliases beyond the first page', async () => {
  const workers = Array.from({ length: 2501 }, (_, index) => ({ id: String(index), status: index < 1000 ? '재직' : index < 1700 ? 'active' : '퇴사' }));
  (workerFirestoreService.getWorkers as jest.Mock).mockResolvedValue(workers);
  await expect(manpowerService.getWorkerCounts()).resolves.toEqual({ total: 2501, active: 1700 });
  expect(workerFirestoreService.getWorkers).toHaveBeenCalledTimes(1);
  await manpowerService.getWorkers();
  expect(workerFirestoreService.getWorkers).toHaveBeenCalledTimes(1);
});

it.each([{ workers: [] }, { workers: [{ status: '재직' }, { status: '퇴사' }, {}] }])('keeps team-scoped counts within the allowed rows: %j', async ({ workers }) => {
  (getTeamScopedRows as jest.Mock).mockResolvedValue(workers);
  await expect(manpowerService.getWorkerCounts()).resolves.toEqual({ total: workers.length, active: workers.filter((worker: { status?: string }) => worker.status === '재직').length });
  expect(workerFirestoreService.getWorkers).not.toHaveBeenCalled();
});

it('uses local demo workers without an aggregate request', async () => {
  (isDevAdminSessionEnabled as jest.Mock).mockReturnValue(true);
  await expect(manpowerService.getWorkerCounts()).resolves.toEqual({ total: 2, active: 1 });
  expect(workerFirestoreService.getWorkers).not.toHaveBeenCalled();
});

it('propagates a failed retrieval instead of displaying a partial total', async () => {
  (workerFirestoreService.getWorkers as jest.Mock).mockRejectedValue(new Error('permission-denied'));
  await expect(manpowerService.getWorkerCounts()).rejects.toThrow('permission-denied');
});
