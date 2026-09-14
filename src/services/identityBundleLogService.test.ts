import { doc, getDocs, setDoc, where, orderBy } from 'firebase/firestore';
import { auth } from '../config/firebase';
import { isDevAdminSessionEnabled, createDevAdminUser } from '../utils/devAdminSession';
import { buildIdentityLogDetails, identityBundleLogService, IDENTITY_LOG_CATEGORY } from './identityBundleLogService';

jest.mock('../config/firebase', () => ({ db: {}, auth: { currentUser: { uid: 'actor-1', displayName: '테스트 관리자', email: 'actor@example.test' } } }));
jest.mock('../utils/devAdminSession', () => ({ isDevAdminSessionEnabled: jest.fn(() => false), createDevAdminUser: jest.fn(() => ({ uid: 'dev-admin', displayName: '개발자 관리자' })) }));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn((_db, path) => path), doc: jest.fn(() => ({ id: 'identity-log-1' })), setDoc: jest.fn(),
  getDocs: jest.fn(), where: jest.fn(), orderBy: jest.fn(), limit: jest.fn(), query: jest.fn(),
}));
beforeEach(() => {
  jest.clearAllMocks();
  (isDevAdminSessionEnabled as jest.Mock).mockReturnValue(false);
  (auth as any).currentUser = { uid: 'actor-1', displayName: '테스트 관리자', email: 'actor@example.test' };
  (setDoc as jest.Mock).mockResolvedValue(undefined);
  (doc as jest.Mock).mockReturnValue({ id: 'identity-log-1' });
  (createDevAdminUser as jest.Mock).mockReturnValue({ uid: 'dev-admin', displayName: '개발자 관리자' });
  window.localStorage.clear();
});

it('appends to the existing audit collection without requiring a read first', async () => {
  expect(await identityBundleLogService.log({ action: 'worker_created', status: 'success', workerId: 'worker-1', personNames: ['테스트 대상'] })).toBe(true);
  expect(getDocs).not.toHaveBeenCalled();
  expect(setDoc).toHaveBeenCalledWith({ id: 'identity-log-1' }, expect.objectContaining({
    category: IDENTITY_LOG_CATEGORY, actorId: 'actor-1', targetId: 'worker-1', action: 'IDENTITY_WORKER_CREATED_SUCCESS',
  }));
});

it('keeps only metadata and masks identity numbers and image URLs in filenames', () => {
  const number = ['010101', '3000000'].join('-'); // Synthetic fixture, not a person's identifier.
  const details = buildIdentityLogDetails({ action: 'analysis', status: 'success', fileNames: [`test_${number}.jpg`, 'data:image/png;base64,TEST'], personNames: ['테스트'],
    identityNumber: number, address: 'private address', image: 'private image', rawOcr: 'private OCR', error: new Error('private error'),
  } as any);
  expect(JSON.stringify(details)).not.toContain(number);
  expect(JSON.stringify(details)).not.toContain('private');
  expect(details.fileNames).toEqual(['test_[식별번호 숨김].jpg', '[주소 숨김]']);
});

it('returns a failed logging result without interrupting the successful business action', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  (setDoc as jest.Mock).mockRejectedValue(new Error('offline'));
  await expect(identityBundleLogService.log({ action: 'download_image', status: 'success' })).resolves.toBe(false);
  warn.mockRestore();
});

it('never attributes an unauthenticated action to a system user', async () => {
  (auth as any).currentUser = null;
  expect(await identityBundleLogService.log({ action: 'analysis', status: 'failure' })).toBe(false);
  expect(setDoc).not.toHaveBeenCalled();
});

it('queries only identity history and propagates read failures instead of showing an empty history', async () => {
  (getDocs as jest.Mock).mockRejectedValue(new Error('permission-denied'));
  await expect(identityBundleLogService.getLogs()).rejects.toThrow('permission-denied');
  expect(where).toHaveBeenCalledWith('category', '==', IDENTITY_LOG_CATEGORY);
  expect(orderBy).toHaveBeenCalledWith('timestamp', 'desc');
});

it('round-trips DEV history locally without writing production data', async () => {
  (isDevAdminSessionEnabled as jest.Mock).mockReturnValue(true);
  await identityBundleLogService.log({ action: 'files_added', status: 'success', fileNames: ['sample.png'] });
  expect(setDoc).not.toHaveBeenCalled();
  expect(await identityBundleLogService.getLogs()).toEqual([expect.objectContaining({ action: 'files_added', fileNames: ['sample.png'], actorId: 'dev-admin', fileCount: 1 })]);
  expect(getDocs).not.toHaveBeenCalled();
});
