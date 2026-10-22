import { copyWindowsPhotos, openWindowsPhotoWindow, WindowsPhotoClipboardError, windowsPhotoClipboardErrorMessage } from './windowsPhotoClipboard';
import { TextEncoder } from 'util';
import { webcrypto } from 'crypto';

const fetchMock = jest.fn();
const token = 'a'.repeat(64);
const session = { app: 'cy-photo-clipboard', protocol: 2, clipboardMode: 'shell-files-v1', token };
const windowSession = { ...session, version: '1.3.0', photoWindowMode: 'shell-view-v1' };
const saved = { batchId: 'b'.repeat(32), folderName: '신분증_사진_20261022_120000_abcdef12', photoCount: 2 };
const files = [new File(['jpeg'], 'one.jpg', { type: 'image/jpeg' }), new File(['png'], 'two.png', { type: 'image/png' })];
beforeEach(() => {
    jest.resetAllMocks();
    Object.assign(global, { fetch: fetchMock, TextEncoder, crypto: webcrypto });
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

const photoWindowResponse = (url: string) => ({ ok: true, json: async () => url.endsWith('/session')
    ? windowSession : url.endsWith('/open-photo-window') ? { ...saved, opened: true } : saved });

test('사진창 지원 확인 후 원본 바이트를 준비하고 같은 배치의 창만 연다', async () => {
    fetchMock.mockImplementation(async (url: string) => photoWindowResponse(url));
    expect(await openWindowsPhotoWindow(files, new AbortController().signal)).toEqual({ ...saved, opened: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const [prepareUrl, prepareRequest] = fetchMock.mock.calls[1];
    expect(prepareUrl).toBe('http://127.0.0.1:43127/v1/prepare');
    const payload = await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(prepareRequest.body);
    });
    const manifestLength = new DataView(payload).getUint32(0, true);
    expect(Array.from(new Uint8Array(payload).slice(4 + manifestLength))).toEqual(Array.from(new TextEncoder().encode('jpegpng')));
    expect(fetchMock.mock.calls[2]).toEqual(['http://127.0.0.1:43127/v1/open-photo-window', expect.objectContaining({
        method: 'POST', body: JSON.stringify({ batchId: saved.batchId }), credentials: 'omit', redirect: 'error',
        headers: expect.objectContaining({ Authorization: `Bearer ${token}`, 'X-CY-Photo-Protocol': '2' }),
    })]);
    expect(fetchMock.mock.calls.some(([url]) => url.endsWith('/copy'))).toBe(false);
});

test.each([
    { ...session, version: '1.2.0' },
    { ...windowSession, version: '1.2.0' },
    { ...windowSession, version: undefined },
    { ...windowSession, version: 'invalid' },
    { ...windowSession, photoWindowMode: 'unsupported' },
])('사진창 미지원 보조 프로그램은 원본 전달 전에 1.3 업데이트를 안내한다 (%j)', async olderSession => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => olderSession });
    const error = await openWindowsPhotoWindow(files, new AbortController().signal).catch(failure => failure);
    expect(error).toMatchObject({ code: 'photo-window-version', stage: 'connect' });
    expect(windowsPhotoClipboardErrorMessage(error)).toContain('1.3 이상');
    expect(fetchMock).toHaveBeenCalledTimes(1);
});

test('기존 1.2 보조 프로그램의 전체 복사는 계속 사용할 수 있다', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ ...session, version: '1.2.0' }) });
    await expect(copyWindowsPhotos(files, new AbortController().signal)).resolves.toMatchObject({ copied: true, photoCount: 2 });
});

test.each([
    { ...saved, opened: true, batchId: 'c'.repeat(32) },
    { ...saved, opened: true, photoCount: 1 },
    { ...saved, opened: 'true' },
    { ...saved },
])('다른 배치·일부 사진·잘못된 opened 응답을 창 성공으로 수락하지 않는다 (%j)', async result => {
    fetchMock.mockImplementation(async (url: string) => url.endsWith('/open-photo-window')
        ? { ok: true, json: async () => result } : photoWindowResponse(url));
    await expect(openWindowsPhotoWindow(files, new AbortController().signal)).rejects.toMatchObject({ code: 'helper-error', stage: 'open' });
});

test.each(['photo-window-busy', 'photo-window'])('사진창 오류 %s는 복사 오류와 구분한다', async code => {
    fetchMock.mockImplementation(async (url: string) => url.endsWith('/open-photo-window')
        ? { ok: false, json: async () => ({ error: code }) } : photoWindowResponse(url));
    const error = await openWindowsPhotoWindow(files, new AbortController().signal).catch(failure => failure);
    expect(error).toMatchObject({ code, stage: 'open' });
    expect(windowsPhotoClipboardErrorMessage(error)).toContain(code === 'photo-window-busy' ? '사진창을 닫은 뒤' : '사진창을 열지 못했습니다');
});

test('사진 준비 중 취소되면 Windows 사진창을 열지 않는다', async () => {
    const controller = new AbortController();
    fetchMock.mockImplementation(async (url: string) => ({ ok: true, json: async () => {
        if (url.endsWith('/session')) return windowSession;
        controller.abort(); return saved;
    } }));
    await expect(openWindowsPhotoWindow(files, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
});

test('사진창 응답 유실은 이미 열렸을 가능성을 안내한다', async () => {
    fetchMock.mockImplementation(async (url: string) => {
        if (url.endsWith('/open-photo-window')) throw new TypeError('network');
        return photoWindowResponse(url);
    });
    const error = await openWindowsPhotoWindow(files, new AbortController().signal).catch(failure => failure);
    expect(error).toMatchObject({ code: 'connection', stage: 'open' });
    expect(windowsPhotoClipboardErrorMessage(error)).toContain('사진창이 열렸는지 확인하지 못했습니다');
});

const blobBytes = (blob: Blob): Promise<ArrayBuffer> => new Promise((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(reader.result as ArrayBuffer); reader.onerror = reject; reader.readAsArrayBuffer(blob);
});
const metadata = async (blob: Blob): Promise<{ batchId: string; index: number; offset: number }> => {
    const bytes = await blobBytes(blob); const length = new DataView(bytes).getUint32(0, true);
    return JSON.parse(String.fromCharCode(...Array.from(new Uint8Array(bytes, 4, length))));
};

function chunkHelper() {
    let batchId = '';
    fetchMock.mockImplementation(async (url: string, options: RequestInit) => {
        let result: unknown;
        if (url.endsWith('/session')) result = { ...windowSession, version: '1.4.0', transferMode: 'chunks-v1' };
        else if (url.endsWith('/start')) { batchId = JSON.parse(options.body as string).batchId; result = { batchId, chunkSize: 1024 * 1024 }; }
        else if (url.endsWith('/chunk')) {
            const meta = await metadata(options.body as Blob);
            const data = await blobBytes(options.body as Blob);
            result = { ...meta, nextOffset: meta.offset + data.byteLength - 4 - new DataView(data).getUint32(0, true) };
        } else result = { batchId, photoCount: 2, opened: true, cancelled: true };
        return { ok: true, json: async () => result };
    });
    return fetchMock.getMockImplementation()!;
}

test('1.4는 큰 원본을 1MB 단위로 나누며 모든 사진 확인 후 창을 연다', async () => {
    chunkHelper();
    const progress = jest.fn();
    const originals = [new File([new Uint8Array(1024 * 1024 + 19)], 'large.jpg', { type: 'image/jpeg' }), files[1]];
    await expect(openWindowsPhotoWindow(originals, new AbortController().signal, progress)).resolves.toMatchObject({ opened: true, photoCount: 2 });
    const chunks = fetchMock.mock.calls.filter(([url]) => url.endsWith('/chunk'));
    expect(chunks).toHaveLength(3);
    expect(await Promise.all(chunks.map(([, options]) => metadata(options.body)))).toEqual([
        expect.objectContaining({ index: 0, offset: 0 }), expect.objectContaining({ index: 0, offset: 1024 * 1024 }), expect.objectContaining({ index: 1, offset: 0 }),
    ]);
    expect(progress).toHaveBeenLastCalledWith({ completed: 2, total: 2, sentBytes: originals[0].size + files[1].size, totalBytes: originals[0].size + files[1].size, retrying: false });
    expect(fetchMock.mock.calls.some(([url]) => url.endsWith('/prepare'))).toBe(false);
    expect(fetchMock.mock.calls[fetchMock.mock.calls.length - 2][0]).toContain('/prepare/finish');
    expect(fetchMock.mock.calls[fetchMock.mock.calls.length - 1][0]).toContain('/open-photo-window');
});

test('중간 응답이 끊기면 같은 chunk만 재시도하며 중복 사진을 추가하지 않는다', async () => {
    const normal = chunkHelper(); let failed = false;
    fetchMock.mockImplementation(async (url: string, options: RequestInit) => {
        const response = await normal(url, options);
        if (url.endsWith('/chunk') && !failed) { failed = true; throw new TypeError('response lost'); }
        return response;
    });
    const progress = jest.fn();
    await expect(openWindowsPhotoWindow(files, new AbortController().signal, progress)).resolves.toMatchObject({ opened: true });
    const chunks = fetchMock.mock.calls.filter(([url]) => url.endsWith('/chunk'));
    expect(chunks).toHaveLength(3);
    expect(chunks[0][1].body).toBe(chunks[1][1].body);
    expect(progress).toHaveBeenCalledWith(expect.objectContaining({ retrying: true, completed: 0 }));
    expect(fetchMock.mock.calls.filter(([url]) => url.endsWith('/open-photo-window'))).toHaveLength(1);
});

test('잘못된 chunk 확인이나 지속 실패 시 사진창을 열지 않고 미완료 배치를 취소한다', async () => {
    const normal = chunkHelper();
    fetchMock.mockImplementation(async (url: string, options: RequestInit) => url.endsWith('/chunk')
        ? { ok: true, json: async () => ({ batchId: 'b'.repeat(32), index: 0, nextOffset: 999 }) } : normal(url, options));
    await expect(openWindowsPhotoWindow(files, new AbortController().signal)).rejects.toMatchObject({ code: 'upload-state', stage: 'prepare' });
    expect(fetchMock.mock.calls.some(([url]) => url.endsWith('/cancel'))).toBe(true);
    expect(fetchMock.mock.calls.some(([url]) => url.endsWith('/finish') || url.endsWith('/open-photo-window'))).toBe(false);
});

test('재시도 대기 중 닫으면 남은 사진 전달과 사진창 열기를 중단한다', async () => {
    const normal = chunkHelper(), controller = new AbortController();
    fetchMock.mockImplementation(async (url: string, options: RequestInit) => { if (url.endsWith('/chunk')) throw new TypeError('offline'); return normal(url, options); });
    await expect(openWindowsPhotoWindow(files, controller.signal, p => { if (p.retrying) controller.abort(); })).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchMock.mock.calls.filter(([url]) => url.endsWith('/chunk'))).toHaveLength(1);
    expect(fetchMock.mock.calls.some(([url]) => url.endsWith('/open-photo-window'))).toBe(false);
});
