import { saveAndCopyWindowsPhotos, WindowsPhotoClipboardError } from './windowsPhotoClipboard';
import { TextEncoder } from 'util';

const fetchMock = jest.fn();
const token = 'a'.repeat(64);
const saved = { batchId: 'b'.repeat(32), folderName: '신분증_사진_20261022_120000_abcdef12', savedCount: 2 };
const files = [new File(['jpeg'], 'one.jpg', { type: 'image/jpeg' }), new File(['png'], 'two.png', { type: 'image/png' })];
beforeEach(() => {
    jest.resetAllMocks();
    Object.assign(global, { fetch: fetchMock, TextEncoder });
    fetchMock.mockImplementation(async (url: string) => ({ ok: true, json: async () => url.endsWith('/session')
        ? { app: 'cy-photo-clipboard', protocol: 1, token } : url.endsWith('/copy') ? { ...saved, copied: true } : saved }));
});
test('세션 확인 후 원본 Blob을 저장하고 반환된 배치만 복사 요청한다', async () => {
    expect(await saveAndCopyWindowsPhotos(files, new AbortController().signal)).toEqual({ ...saved, copied: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const [url, request] = fetchMock.mock.calls[1];
    expect(url).toBe('http://127.0.0.1:43127/v1/save');
    expect(request.body).toBeInstanceOf(Blob);
    expect(request.headers.Authorization).toBe(`Bearer ${token}`);
    expect(request.credentials).toBe('omit');
    expect(fetchMock.mock.calls[2][1].body).toBe(JSON.stringify({ batchId: saved.batchId }));
});
test('잘못된 helper, 부분 저장 응답, 네트워크 실패에서는 후속 복사를 실행하지 않는다', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ app: 'unrelated', protocol: 1, token }) });
    await expect(saveAndCopyWindowsPhotos(files, new AbortController().signal)).rejects.toEqual(new WindowsPhotoClipboardError('version'));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockClear();
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ app: 'cy-photo-clipboard', protocol: 1, token }) });
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ ...saved, savedCount: 1 }) });
    await expect(saveAndCopyWindowsPhotos(files, new AbortController().signal)).rejects.toEqual(new WindowsPhotoClipboardError('helper-error'));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    fetchMock.mockRejectedValueOnce(new TypeError('network'));
    await expect(saveAndCopyWindowsPhotos(files, new AbortController().signal)).rejects.toEqual(new WindowsPhotoClipboardError('connection'));
});
test('저장 중 취소되면 파일 복사를 시작하지 않는다', async () => {
    const controller = new AbortController();
    fetchMock.mockImplementation(async (url: string) => ({ ok: true, json: async () => {
        if (url.endsWith('/session')) return { app: 'cy-photo-clipboard', protocol: 1, token };
        controller.abort(); return saved;
    } }));
    await expect(saveAndCopyWindowsPhotos(files, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
});
test('사진 개수·타입 제한은 로컬 전송 전에 검사한다', async () => {
    for (const input of [[], Array(101).fill(files[0]), [new File(['exe'], 'x.exe', { type: 'application/octet-stream' })]]) {
        await expect(saveAndCopyWindowsPhotos(input, new AbortController().signal)).rejects.toEqual(new WindowsPhotoClipboardError('size'));
    }
    expect(fetchMock).not.toHaveBeenCalled();
});
