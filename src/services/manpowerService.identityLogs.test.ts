import { manpowerService } from './manpowerService';
import { workerFirestoreService } from './workerFirestoreService';
import { identityBundleLogService } from './identityBundleLogService';
import { recordWorkerIdentityChange } from './identityDocumentLogService';
import { toast } from '../utils/swal';

jest.mock('../config/firebase', () => ({ auth: { currentUser: { uid: 'test-actor' } }, db: {}, storage: {} }));
jest.mock('./workerFirestoreService', () => ({ workerFirestoreService: { addWorker: jest.fn(), updateWorker: jest.fn() } }));
jest.mock('./databaseLogService', () => ({ databaseLogService: { safeCreateLog: jest.fn() } }));
jest.mock('./identityBundleLogService', () => ({ identityBundleLogService: { log: jest.fn() } }));
jest.mock('./teamScopedReadService', () => ({ getTeamScopedRows: jest.fn() }));
jest.mock('../utils/devAdminSession', () => ({ isDevAdminSessionEnabled: () => false }));
jest.mock('../utils/swal', () => ({ toast: { warning: jest.fn() } }));

const log = identityBundleLogService.log as jest.Mock;
beforeEach(() => {
  jest.clearAllMocks();
  log.mockResolvedValue(true);
  (workerFirestoreService.addWorker as jest.Mock).mockResolvedValue('worker-1');
  (workerFirestoreService.updateWorker as jest.Mock).mockResolvedValue(undefined);
});
afterEach(() => jest.restoreAllMocks());

it('records a new identity document only after the worker write commits, with no OCR or storage data', async () => {
  let commit!: (id: string) => void;
  (workerFirestoreService.addWorker as jest.Mock).mockReturnValue(new Promise((resolve) => { commit = resolve; }));
  const pending = manpowerService.addWorker({ name: '테스트', fileNameSaved: 'id_cards/private.jpg', address: 'private-address', idNumber: 'private-number' });
  expect(log).not.toHaveBeenCalled();
  commit('worker-1');
  await pending;
  expect(log).toHaveBeenCalledWith(expect.objectContaining({ action: 'document_registered', status: 'success', workerId: 'worker-1' }));
  expect(JSON.stringify(log.mock.calls)).not.toContain('private');
  expect(log).toHaveBeenCalledTimes(1);
});

it('records photo-only replacement and ignores unrelated edits or an unchanged attachment', async () => {
  jest.spyOn(manpowerService, 'getWorker').mockResolvedValue({ id: 'worker-1', name: '테스트', fileNameSaved: 'id_cards/old.jpg' } as any);
  await manpowerService.updateWorker('worker-1', { fileNameSaved: 'id_cards/new.jpg' });
  expect(log).toHaveBeenCalledWith(expect.objectContaining({ action: 'document_replaced', workerId: 'worker-1', personNames: ['테스트'] }));
  log.mockClear();
  await manpowerService.updateWorker('worker-1', { contact: 'test' });
  await manpowerService.updateWorker('worker-1', { fileNameSaved: 'id_cards/old.jpg' });
  expect(log).not.toHaveBeenCalled();
});

it('does not claim a registration or replacement when the database write fails', async () => {
  (workerFirestoreService.addWorker as jest.Mock).mockRejectedValue(new Error('write failed'));
  await expect(manpowerService.addWorker({ name: '테스트', fileNameSaved: 'test.jpg' })).rejects.toThrow('write failed');
  jest.spyOn(manpowerService, 'getWorker').mockResolvedValue({ id: 'worker-1', fileNameSaved: 'old.jpg' } as any);
  (workerFirestoreService.updateWorker as jest.Mock).mockRejectedValue(new Error('write failed'));
  await expect(manpowerService.updateWorker('worker-1', { fileNameSaved: 'new.jpg' })).rejects.toThrow('write failed');
  expect(log).not.toHaveBeenCalled();
});

it('distinguishes document removal from deleting a worker without any document', async () => {
  await recordWorkerIdentityChange({ id: 'worker-1', name: '테스트', fileNameSaved: 'old.jpg' }, null);
  expect(log).toHaveBeenCalledWith(expect.objectContaining({ action: 'document_removed', workerId: 'worker-1' }));
  log.mockClear();
  await recordWorkerIdentityChange({ id: 'worker-2', name: '테스트' }, null);
  expect(log).not.toHaveBeenCalled();
});

it('warns about a failed audit write without turning a committed worker into a failed registration', async () => {
  log.mockResolvedValue(false);
  await expect(manpowerService.addWorker({ name: '테스트', fileNameSaved: 'test.jpg' })).resolves.toBe('worker-1');
  expect(toast.warning).toHaveBeenCalledWith(expect.stringContaining('로그를 저장하지 못했습니다'));
});
