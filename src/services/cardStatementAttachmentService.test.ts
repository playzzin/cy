import { getBlob, getDownloadURL, ref } from 'firebase/storage';
import { cardStatementAttachmentService as service, getCardStatementAttachmentError, getCardStatementFileName } from './cardStatementAttachmentService';

jest.mock('firebase/storage', () => ({ getBlob: jest.fn(), getDownloadURL: jest.fn(), ref: jest.fn() }));
jest.mock('../config/firebase', () => ({ storage: 'fixture-storage' }));
const objectRef = { fullPath: 'statements/fixture.pdf' };
const createObjectURL = URL.createObjectURL;
const revokeObjectURL = URL.revokeObjectURL;

beforeEach(() => {
  jest.mocked(ref).mockReturnValue(objectRef as any);
  jest.mocked(getDownloadURL).mockResolvedValue('https://example.com/fixture.pdf');
  URL.createObjectURL = jest.fn().mockReturnValue('blob:fixture');
  URL.revokeObjectURL = jest.fn();
});
afterEach(() => { URL.createObjectURL = createObjectURL; URL.revokeObjectURL = revokeObjectURL; });

test('resolves Storage object paths without modifying the stored attachment', async () => {
  const link = await service.resolve(' statements/fixture.pdf ');
  expect(ref).toHaveBeenCalledWith('fixture-storage', 'statements/fixture.pdf');
  expect(getDownloadURL).toHaveBeenCalledWith(objectRef);
  expect(link.url).toBe('https://example.com/fixture.pdf');
  link.release();
  expect(getBlob).not.toHaveBeenCalled();
  expect(URL.revokeObjectURL).not.toHaveBeenCalled();
});

test('opens an existing HTTPS evidence link without treating it as a Storage path', async () => {
  const link = await service.resolve('https://example.com/fixture.pdf?download=1');
  expect(link.url).toBe('https://example.com/fixture.pdf?download=1');
  expect(ref).not.toHaveBeenCalled();
  expect(getDownloadURL).not.toHaveBeenCalled();
});

test('resolves an unsigned Firebase media URL through authenticated Storage access', async () => {
  const path = 'https://firebasestorage.googleapis.com/v0/b/fixture/o/statements%2Ffixture.pdf?alt=media';
  const link = await service.resolve(path);
  expect(ref).toHaveBeenCalledWith('fixture-storage', path);
  expect(getDownloadURL).toHaveBeenCalledWith(objectRef);
  expect(link.url).toBe('https://example.com/fixture.pdf');
});

test('preserves an existing Firebase download token URL', async () => {
  const path = 'https://firebasestorage.googleapis.com/v0/b/fixture/o/statements%2Ffixture.pdf?alt=media&token=fixture-token';
  expect((await service.resolve(path)).url).toBe(path);
  expect(ref).not.toHaveBeenCalled();
  expect(getDownloadURL).not.toHaveBeenCalled();
});

test('reads tokenless objects using existing authenticated access and releases the local URL', async () => {
  jest.mocked(getDownloadURL).mockRejectedValue({ code: 'storage/no-download-url' });
  const blob = new Blob(['fixture'], { type: 'application/pdf' });
  jest.mocked(getBlob).mockResolvedValue(blob);
  const link = await service.resolve('gs://fixture-bucket/statement.pdf');
  expect(getBlob).toHaveBeenCalledWith(objectRef);
  expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
  expect(link.url).toBe('blob:fixture');
  link.release();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fixture');
});

test.each(['storage/unauthorized', 'storage/unauthenticated', 'storage/object-not-found', 'storage/retry-limit-exceeded'])('preserves %s without trying to bypass it', async code => {
  jest.mocked(getDownloadURL).mockRejectedValue({ code });
  await expect(service.resolve('statements/fixture.pdf')).rejects.toEqual({ code });
  expect(getBlob).not.toHaveBeenCalled();
});

test('preserves an authenticated blob read failure', async () => {
  jest.mocked(getDownloadURL).mockRejectedValue({ code: 'storage/no-download-url' });
  jest.mocked(getBlob).mockRejectedValue({ code: 'storage/unauthorized' });
  await expect(service.resolve('statements/fixture.pdf')).rejects.toEqual({ code: 'storage/unauthorized' });
  expect(URL.createObjectURL).not.toHaveBeenCalled();
});

// eslint-disable-next-line no-script-url -- Verify that executable links are rejected.
test.each(['', '  ', 'javascript:alert(1)', 'data:text/html,fixture', '//example.com/file', 'https://user:pass@example.com/file', 'http://example.com/file', 'https://', 'folder/\u0000.pdf'])('rejects an invalid attachment address %j', async path => {
  await expect(service.resolve(path)).rejects.toMatchObject({ code: 'attachment/invalid-path' });
  expect(ref).not.toHaveBeenCalled();
});

test('file labels decode filenames without displaying URL query parameters', () => {
  expect(getCardStatementFileName('https://firebasestorage.googleapis.com/v0/b/fixture/o/folder%2F%EC%B2%AD%EA%B5%AC%EC%84%9C.pdf?alt=media&token=fixture')).toBe('청구서.pdf');
  expect(getCardStatementFileName('folder/statement.pdf')).toBe('statement.pdf');
  expect(getCardStatementFileName('folder/bad%name.pdf')).toBe('bad%name.pdf');
});

test.each([
  ['storage/object-not-found', '원본 파일을 찾을 수 없습니다'],
  ['storage/unauthenticated', '로그인 인증'],
  ['storage/unauthorized', '실제 계정으로 다시 로그인'],
  ['storage/retry-limit-exceeded', '연결이 지연'],
  ['attachment/invalid-path', '주소가 올바르지'],
  ['unknown', '불러오지 못했습니다'],
])('explains %s without exposing the raw error', (code, message) => {
  const text = getCardStatementAttachmentError({ code, message: 'private-fixture-details' });
  expect(text).toContain(message);
  expect(text).not.toContain('private-fixture-details');
});
