import { collection, getCountFromServer, query, where } from 'firebase/firestore';
import { manpowerService } from './manpowerService';
import { getTeamScopedRows } from './teamScopedReadService';
import { isDevAdminSessionEnabled } from '../utils/devAdminSession';

jest.mock('../config/firebase', () => ({ auth: { currentUser: { uid: 'test' } }, db: {}, storage: {} }));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(() => 'all-workers'),
  query: jest.fn(() => 'active-workers'),
  where: jest.fn(() => 'active-filter'),
  getCountFromServer: jest.fn(),
}));
jest.mock('./workerFirestoreService', () => ({ workerFirestoreService: {} }));
jest.mock('./databaseLogService', () => ({ databaseLogService: {} }));
jest.mock('./identityDocumentLogService', () => ({ recordWorkerIdentityChange: jest.fn() }));
jest.mock('./teamScopedReadService', () => ({ getTeamScopedRows: jest.fn() }));
jest.mock('../utils/devAdminSession', () => ({ isDevAdminSessionEnabled: jest.fn() }));
jest.mock('../utils/devAdminFixtures', () => ({ devWorkers: [{ status: '재직' }, { status: '퇴사' }] }));

beforeEach(() => {
  jest.clearAllMocks();
  (collection as jest.Mock).mockReturnValue('all-workers');
  (query as jest.Mock).mockReturnValue('active-workers');
  (where as jest.Mock).mockReturnValue('active-filter');
  (getTeamScopedRows as jest.Mock).mockResolvedValue(null);
  (isDevAdminSessionEnabled as jest.Mock).mockReturnValue(false);
});

it('counts all documents, including workers beyond the first page, without fetching a page', async () => {
  (getCountFromServer as jest.Mock).mockImplementation(async ref => ({ data: () => ({ count: ref === 'all-workers' ? 2501 : 1700 }) }));
  await expect(manpowerService.getWorkerCounts()).resolves.toEqual({ total: 2501, active: 1700 });
  expect(collection).toHaveBeenCalledWith({}, 'workers');
  expect(where).toHaveBeenCalledWith('status', '==', '재직');
  expect(query).toHaveBeenCalledWith('all-workers', 'active-filter');
  expect(getCountFromServer).toHaveBeenCalledTimes(2);
});

it.each([{ workers: [] }, { workers: [{ status: '재직' }, { status: '퇴사' }, {}] }])('keeps team-scoped counts within the allowed rows: %j', async ({ workers }) => {
  (getTeamScopedRows as jest.Mock).mockResolvedValue(workers);
  await expect(manpowerService.getWorkerCounts()).resolves.toEqual({ total: workers.length, active: workers.filter((worker: { status?: string }) => worker.status === '재직').length });
  expect(getCountFromServer).not.toHaveBeenCalled();
});

it('uses local demo workers without an aggregate request', async () => {
  (isDevAdminSessionEnabled as jest.Mock).mockReturnValue(true);
  await expect(manpowerService.getWorkerCounts()).resolves.toEqual({ total: 2, active: 1 });
  expect(getCountFromServer).not.toHaveBeenCalled();
});

it('propagates a failed aggregate instead of displaying a partial total', async () => {
  (getCountFromServer as jest.Mock).mockRejectedValue(new Error('permission-denied'));
  await expect(manpowerService.getWorkerCounts()).rejects.toThrow('permission-denied');
});
