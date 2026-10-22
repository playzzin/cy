const ENDPOINT = 'http://127.0.0.1:43127/v1';
const APP = 'cy-photo-clipboard';
const MAX_FILE = 20 * 1024 * 1024;
const MAX_TOTAL = 200 * 1024 * 1024;
const TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp']);

type Session = { app: string; protocol: number; token: string };
export type WindowsPhotoBatch = { batchId: string; folderName: string; savedCount: number };
export type WindowsPhotoCopyResult = WindowsPhotoBatch & { copied: boolean };

export class WindowsPhotoClipboardError extends Error {
    constructor(public readonly code: string) { super(code); this.name = 'WindowsPhotoClipboardError'; }
}

const request = async (path: string, signal: AbortSignal, body?: Blob | string, token?: string): Promise<unknown> => {
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
    signal.addEventListener('abort', abort, { once: true });
    // Also bounds the local-network permission prompt / unavailable helper wait.
    const timer = window.setTimeout(abort, body instanceof Blob ? 120000 : 30000);
    try {
        const response = await fetch(`${ENDPOINT}${path}`, {
            method: body === undefined ? 'GET' : 'POST', mode: 'cors', credentials: 'omit', cache: 'no-store', redirect: 'error',
            headers: { 'X-CY-Photo-Protocol': '1', ...(token ? { Authorization: `Bearer ${token}` } : {}),
                ...(body !== undefined ? { 'Content-Type': body instanceof Blob ? 'application/octet-stream' : 'application/json' } : {}) },
            body, signal: controller.signal,
        });
        const result = await response.json();
        if (!response.ok) throw new WindowsPhotoClipboardError(result?.error === 'busy' ? 'busy' : 'helper-error');
        return result;
    } catch (error) {
        if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
        if (error instanceof WindowsPhotoClipboardError) throw error;
        // Do not claim no files were saved: a response can be lost after local saving.
        throw new WindowsPhotoClipboardError('connection');
    } finally {
        window.clearTimeout(timer);
        signal.removeEventListener('abort', abort);
    }
};

const connect = async (signal: AbortSignal): Promise<Session> => {
    const result = await request('/session', signal) as Session;
    if (result?.app !== APP || result.protocol !== 1 || !/^[a-f0-9]{64}$/.test(result.token)) {
        throw new WindowsPhotoClipboardError('version');
    }
    return result;
};

const validBatch = (batch: WindowsPhotoBatch, count: number): boolean =>
    !!batch && /^[a-f0-9]{32}$/.test(batch.batchId) && typeof batch.folderName === 'string' &&
    /^신분증_사진_[0-9_]+_[a-f0-9]{8}$/.test(batch.folderName) && batch.savedCount === count;

export const saveAndCopyWindowsPhotos = async (files: File[], signal: AbortSignal): Promise<WindowsPhotoCopyResult> => {
    if (!files.length || files.length > 100 || files.some(file => !file.size || file.size > MAX_FILE || !TYPES.has(file.type)) ||
        files.reduce((sum, file) => sum + file.size, 0) > MAX_TOTAL) throw new WindowsPhotoClipboardError('size');
    const session = await connect(signal);
    const manifest = new TextEncoder().encode(JSON.stringify({ files: files.map(file => ({ name: file.name, type: file.type, size: file.size })) }));
    const prefix = new Uint8Array(4);
    new DataView(prefix.buffer).setUint32(0, manifest.byteLength, true);
    const payload = new Blob([prefix, manifest, ...files], { type: 'application/octet-stream' });
    const saved = await request('/save', signal, payload, session.token) as WindowsPhotoBatch;
    if (!validBatch(saved, files.length)) throw new WindowsPhotoClipboardError('helper-error');
    if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
    // Save and clipboard commit are separate: a cancelled selection never starts a later copy.
    const result = await request('/copy', signal, JSON.stringify({ batchId: saved.batchId }), session.token) as WindowsPhotoCopyResult;
    if (!validBatch(result, files.length) || result.batchId !== saved.batchId || typeof result.copied !== 'boolean') {
        throw new WindowsPhotoClipboardError('helper-error');
    }
    return result;
};

export const windowsPhotoClipboardErrorMessage = (error: unknown): string => {
    const code = error instanceof WindowsPhotoClipboardError ? error.code : '';
    if (code === 'size') return '한 번에 사진 100장, 한 장당 20MB, 전체 200MB까지 저장·복사할 수 있습니다. 선택한 사진 수를 줄여 주세요.';
    if (code === 'busy') return '다른 사진을 저장·복사하고 있습니다. 잠시 뒤 다시 눌러 주세요.';
    if (code === 'version') return 'PC 보조 프로그램을 최신 버전으로 다시 설치해 주세요.';
    return 'PC 보조 프로그램과 연결하지 못했거나 처리가 중단됐습니다. 프로그램 실행 상태와 브라우저의 로컬 네트워크 접근 허용을 확인해 주세요. 이미 저장된 사진은 보조 프로그램의 저장 폴더에서 확인할 수 있습니다.';
};
