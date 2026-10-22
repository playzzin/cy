import { copyWindowsPhotos, WindowsPhotoClipboardError, windowsPhotoClipboardErrorMessage } from './windowsPhotoClipboard';
import { TextEncoder } from 'util';

const fetchMock = jest.fn();
const token = 'a'.repeat(64);
const session = { app: 'cy-photo-clipboard', protocol: 2, clipboardMode: 'shell-files-v1', token };
const saved = { batchId: 'b'.repeat(32), folderName: '신분증_사진_20261022_120000_abcdef12', photoCount: 2 };
const files = [new File(['jpeg'], 'one.jpg', { type: 'image/jpeg' }), new File(['png'], 'two.png', { type: 'image/png' })];
beforeEach(() => {
    jest.resetAllMocks();
    Object.assign(global, { fetch: fetchMock, TextEncoder });
    fetchMock.mockImplementation(async (url: string) => ({ ok: true, json: async () => url.endsWith('/session')
        ? session : url.endsWith('/copy') ? { ...saved, copied: true } : saved }));
});
test('세션 확인 후 원본 Blob을 저장하고 반환된 배치만 복사 요청한다', async () => {
    expect(await copyWindowsPhotos(files, new AbortController().signal)).toEqual({ ...saved, copied: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const [url, request] = fetchMock.mock.calls[1];
    expect(url).toBe('http://127.0.0.1:43127/v1/prepare');
    expect(request.body).toBeInstanceOf(Blob);
    expect(request.headers.Authorization).toBe(`Bearer ${token}`);
    expect(request.credentials).toBe('omit');
    expect(fetchMock.mock.calls[2][1].body).toBe(JSON.stringify({ batchId: saved.batchId }));
});
test('잘못된 helper, 부분 저장 응답, 네트워크 실패에서는 후속 복사를 실행하지 않는다', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ app: 'unrelated', protocol: 2, token }) });
    await expect(copyWindowsPhotos(files, new AbortController().signal)).rejects.toEqual(new WindowsPhotoClipboardError('version'));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockClear();
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => session });
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ ...saved, photoCount: 1 }) });
    await expect(copyWindowsPhotos(files, new AbortController().signal)).rejects.toMatchObject({ code: 'helper-error' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    fetchMock.mockRejectedValueOnce(new TypeError('network'));
    await expect(copyWindowsPhotos(files, new AbortController().signal)).rejects.toEqual(new WindowsPhotoClipboardError('connection'));
});

test.each([1, 2])('Shell 복사를 지원하지 않는 구버전(protocol %i)에는 사진을 보내지 않고 업데이트를 안내한다', async (protocol) => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ app: 'cy-photo-clipboard', protocol, token }) });
    await expect(copyWindowsPhotos(files, new AbortController().signal)).rejects.toMatchObject({ code: 'version' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(windowsPhotoClipboardErrorMessage(new WindowsPhotoClipboardError('version'))).toContain('1.2 이상');
});

test('사진 준비 뒤 복사 응답이 끊기면 연결 실패와 구분해서 안내한다', async () => {
    fetchMock.mockImplementation(async (url: string) => {
        if (url.endsWith('/copy')) throw new TypeError('network');
        return { ok: true, json: async () => url.endsWith('/session') ? session : saved };
    });
    const error = await copyWindowsPhotos(files, new AbortController().signal).catch(failure => failure);
    expect(error).toMatchObject({ code: 'connection', stage: 'copy' });
    expect(windowsPhotoClipboardErrorMessage(error)).toContain('사진 준비는 끝났지만');
});
test('저장 중 취소되면 파일 복사를 시작하지 않는다', async () => {
    const controller = new AbortController();
    fetchMock.mockImplementation(async (url: string) => ({ ok: true, json: async () => {
        if (url.endsWith('/session')) return session;
        controller.abort(); return saved;
    } }));
    await expect(copyWindowsPhotos(files, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
});
test('사진 개수·타입 제한은 로컬 전송 전에 검사한다', async () => {
    for (const input of [[], Array(101).fill(files[0]), [new File(['exe'], 'x.exe', { type: 'application/octet-stream' })]]) {
        await expect(copyWindowsPhotos(input, new AbortController().signal)).rejects.toEqual(new WindowsPhotoClipboardError('size'));
    }
    expect(fetchMock).not.toHaveBeenCalled();
});
