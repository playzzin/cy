const ENDPOINT = 'http://127.0.0.1:43127/v1';
const APP = 'cy-photo-clipboard';
const MAX_FILE = 20 * 1024 * 1024;
const MAX_TOTAL = 200 * 1024 * 1024;
const TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp']);

type Session = { app: string; protocol: number; clipboardMode: string; photoWindowMode?: string; transferMode?: string; version?: string; token: string };
export type WindowsPhotoProgress = { completed: number; total: number; sentBytes: number; totalBytes: number; retrying: boolean };
type Progress = (progress: WindowsPhotoProgress) => void;
export type WindowsPhotoBatch = { batchId: string; photoCount: number };
export type WindowsPhotoCopyResult = WindowsPhotoBatch & { copied: boolean };
export type WindowsPhotoWindowResult = WindowsPhotoBatch & { opened: boolean };

export class WindowsPhotoClipboardError extends Error {
    constructor(public readonly code: string, public readonly stage: 'connect' | 'prepare' | 'copy' | 'open' = 'connect') { super(code); this.name = 'WindowsPhotoClipboardError'; }
}

const request = async (path: string, signal: AbortSignal, body?: Blob | string, token?: string): Promise<unknown> => {
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
    signal.addEventListener('abort', abort, { once: true });
    // Also bounds the local-network permission prompt / unavailable helper wait.
    const timer = window.setTimeout(abort, path === '/prepare' ? 120000 : 30000);
    const stage = path === '/session' ? 'connect' : path.startsWith('/prepare') ? 'prepare' : path === '/open-photo-window' ? 'open' : 'copy';
    try {
        const response = await fetch(`${ENDPOINT}${path}`, {
            method: body === undefined ? 'GET' : 'POST', mode: 'cors', credentials: 'omit', cache: 'no-store', redirect: 'error',
            headers: { 'X-CY-Photo-Protocol': path === '/session' ? '1' : '2', ...(token ? { Authorization: `Bearer ${token}` } : {}),
                ...(body !== undefined ? { 'Content-Type': body instanceof Blob ? 'application/octet-stream' : 'application/json' } : {}) },
            body, signal: controller.signal,
        });
        const result = await response.json();
        if (!response.ok) {
            const code = ['busy', 'image-format', 'temporary-files', 'version', 'photo-window-busy', 'photo-window', 'upload-manifest', 'upload-state', 'upload-chunk', 'upload-incomplete', 'upload-expired', 'session-expired', 'transfer-interrupted'].includes(result?.error) ? result.error : 'helper-error';
            throw new WindowsPhotoClipboardError(code, stage);
        }
        return result;
    } catch (error) {
        if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
        if (error instanceof WindowsPhotoClipboardError) throw error;
        // Do not claim no files were saved: a response can be lost after local saving.
        throw new WindowsPhotoClipboardError(controller.signal.aborted ? 'timeout' : 'connection', stage);
    } finally {
        window.clearTimeout(timer);
        signal.removeEventListener('abort', abort);
    }
};

const connect = async (signal: AbortSignal, photoWindow: boolean): Promise<Session> => {
    const result = await request('/session', signal) as Session;
    if (result?.app !== APP || result.protocol !== 2 || result.clipboardMode !== 'shell-files-v1' || !/^[a-f0-9]{64}$/.test(result.token)) {
        throw new WindowsPhotoClipboardError(photoWindow ? 'photo-window-version' : 'version');
    }
    const version = typeof result.version === 'string' ? result.version.match(/^(\d+)\.(\d+)\.(\d+)$/) : null;
    if (photoWindow && (result.photoWindowMode !== 'shell-view-v1' || !version ||
        !(Number(version[1]) > 1 || (Number(version[1]) === 1 && Number(version[2]) >= 3)))) {
        throw new WindowsPhotoClipboardError('photo-window-version');
    }
    return result;
};

const validBatch = (batch: WindowsPhotoBatch, count: number): boolean =>
    !!batch && /^[a-f0-9]{32}$/.test(batch.batchId) && batch.photoCount === count;

const pack = (metadata: unknown, blobs: Blob[]): Blob => {
    const manifest = new TextEncoder().encode(JSON.stringify(metadata));
    const prefix = new Uint8Array(4);
    new DataView(prefix.buffer).setUint32(0, manifest.byteLength, true);
    return new Blob([prefix, manifest, ...blobs], { type: 'application/octet-stream' });
};

const pause = (signal: AbortSignal, milliseconds: number): Promise<void> => new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException('Cancelled', 'AbortError')); return; }
    const abort = () => { window.clearTimeout(timer); reject(new DOMException('Cancelled', 'AbortError')); };
    const timer = window.setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, milliseconds);
    signal.addEventListener('abort', abort, { once: true });
});

const prepareChunks = async (files: File[], session: Session, signal: AbortSignal, progress?: Progress): Promise<WindowsPhotoBatch> => {
    const batchId = Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
    let completed = 0, sentBytes = 0;
    const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
    const report = (retrying = false) => { if (!signal.aborted) progress?.({ completed, total: files.length, sentBytes, totalBytes, retrying }); };
    // Only these idempotent preparation operations are retried. Copy/window
    // actions must not be replayed after an ambiguous response.
    const transfer = async (path: string, body: Blob | string): Promise<unknown> => {
        for (let attempt = 0; ; attempt++) {
            try { return await request(path, signal, body, session.token); }
            catch (error) {
                if (!(error instanceof WindowsPhotoClipboardError) || !['connection', 'timeout', 'busy', 'transfer-interrupted'].includes(error.code) || attempt >= 2 || signal.aborted) throw error;
                report(true); await pause(signal, 400 * (attempt + 1));
            }
        }
    };
    report();
    try {
        const started = await transfer('/prepare/start', JSON.stringify({ batchId, files: files.map(file => ({ name: file.name, type: file.type, size: file.size })) })) as { batchId: string; chunkSize: number };
        if (started?.batchId !== batchId || started.chunkSize !== 1024 * 1024) throw new WindowsPhotoClipboardError('helper-error', 'prepare');
        for (let index = 0; index < files.length; index++) {
            const file = files[index];
            for (let offset = 0; offset < file.size;) {
                const end = Math.min(file.size, offset + started.chunkSize);
                const ack = await transfer('/prepare/chunk', pack({ batchId, index, offset }, [file.slice(offset, end)])) as { batchId: string; index: number; nextOffset: number };
                if (ack?.batchId !== batchId || ack.index !== index || ack.nextOffset !== end) throw new WindowsPhotoClipboardError('upload-state', 'prepare');
                sentBytes += end - offset; offset = end;
                if (end === file.size) completed++;
                report();
            }
        }
        const saved = await transfer('/prepare/finish', JSON.stringify({ batchId })) as WindowsPhotoBatch;
        if (!validBatch(saved, files.length) || saved.batchId !== batchId) throw new WindowsPhotoClipboardError('helper-error', 'prepare');
        return saved;
    } catch (error) {
        // Best effort removal of only this unfinished batch. A completed batch
        // is preserved when its final response was lost.
        void request('/prepare/cancel', new AbortController().signal, JSON.stringify({ batchId }), session.token).catch(() => {});
        throw error;
    }
};

const prepareWindowsPhotos = async (files: File[], signal: AbortSignal, photoWindow: boolean, progress?: Progress): Promise<{ session: Session; saved: WindowsPhotoBatch }> => {
    if (!files.length || files.length > 100 || files.some(file => !file.size || file.size > MAX_FILE || !TYPES.has(file.type)) ||
        files.reduce((sum, file) => sum + file.size, 0) > MAX_TOTAL) throw new WindowsPhotoClipboardError('size');
    // Check the capability before sending any original photo bytes to an older helper.
    const session = await connect(signal, photoWindow);
    const saved = session.transferMode === 'chunks-v1'
        ? await prepareChunks(files, session, signal, progress)
        : await request('/prepare', signal, pack({ files: files.map(file => ({ name: file.name, type: file.type, size: file.size })) }, files), session.token) as WindowsPhotoBatch;
    if (!validBatch(saved, files.length)) throw new WindowsPhotoClipboardError('helper-error', 'prepare');
    if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
    return { session, saved };
};

export const copyWindowsPhotos = async (files: File[], signal: AbortSignal, progress?: Progress): Promise<WindowsPhotoCopyResult> => {
    const { session, saved } = await prepareWindowsPhotos(files, signal, false, progress);
    // Temporary preparation and clipboard commit are separate so cancellation stops a later copy.
    const result = await request('/copy', signal, JSON.stringify({ batchId: saved.batchId }), session.token) as WindowsPhotoCopyResult;
    if (!validBatch(result, files.length) || result.batchId !== saved.batchId || typeof result.copied !== 'boolean') {
        throw new WindowsPhotoClipboardError('helper-error', 'copy');
    }
    return result;
};

export const openWindowsPhotoWindow = async (files: File[], signal: AbortSignal, progress?: Progress): Promise<WindowsPhotoWindowResult> => {
    const { session, saved } = await prepareWindowsPhotos(files, signal, true, progress);
    const result = await request('/open-photo-window', signal, JSON.stringify({ batchId: saved.batchId }), session.token) as WindowsPhotoWindowResult;
    if (!validBatch(result, files.length) || result.batchId !== saved.batchId || typeof result.opened !== 'boolean') {
        throw new WindowsPhotoClipboardError('helper-error', 'open');
    }
    return result;
};

export const windowsPhotoClipboardErrorMessage = (error: unknown): string => {
    const code = error instanceof WindowsPhotoClipboardError ? error.code : '';
    if (code === 'size') return '한 번에 사진 100장, 한 장당 20MB, 전체 200MB까지 준비할 수 있습니다. 선택한 사진 수를 줄여 주세요.';
    if (code === 'busy') return '다른 사진을 처리하고 있습니다. 잠시 뒤 다시 눌러 주세요.';
    if (code === 'version') return '전체 복사 기능을 사용하려면 PC 보조 프로그램 1.2 이상이 필요합니다. 아래 설치 메뉴에서 새 설치 파일을 실행한 뒤 다시 눌러 주세요.';
    if (code === 'photo-window-version') return '사진을 한 번에 끌어놓으려면 PC 보조 프로그램 1.3 이상이 필요합니다. 아래 설치 메뉴에서 새 설치 파일을 실행한 뒤 다시 눌러 주세요.';
    if (code === 'photo-window-busy') return '이미 열려 있는 Windows 사진창을 닫은 뒤 다시 눌러 주세요. 끌어놓는 중이라면 먼저 작업을 마쳐 주세요.';
    if (code === 'photo-window') return 'Windows 사진창을 열지 못했습니다. 보조 프로그램의 실행 상태를 확인한 뒤 다시 눌러 주세요.';
    if (code === 'image-format') return '사진 형식을 확인하지 못해 사진 준비를 중단했습니다. 해당 사진을 다시 등록하거나 개별 사진 복사를 이용해 주세요.';
    if (code === 'temporary-files') return '보조 프로그램에서 공유용 임시 사진을 준비하지 못했습니다. PC의 여유 공간을 확인해 주세요.';
    if (error instanceof WindowsPhotoClipboardError && error.stage === 'copy') return '사진 준비는 끝났지만 클립보드 복사 결과를 확인하지 못했습니다. Windows 알림 영역의 CY 사진 전체 복사에서 ‘마지막 사진 전체 다시 복사’를 눌러 주세요.';
    if (error instanceof WindowsPhotoClipboardError && error.stage === 'open') return '사진 준비는 끝났지만 Windows 사진창이 열렸는지 확인하지 못했습니다. 작업 표시줄에서 사진창을 확인하고, 열려 있다면 닫은 뒤 다시 눌러 주세요.';
    if (error instanceof WindowsPhotoClipboardError && error.stage === 'prepare') return `사진 전달을 완료하지 못했습니다. 잠시 뒤 다시 눌러 주세요. PC 보조 프로그램이 1.4 이전이면 업데이트해 주세요. 1.4부터는 끊긴 부분을 자동 재시도합니다. 오류: ${code}`;
    return 'PC 보조 프로그램에 연결하지 못했습니다. 시작 메뉴에서 ‘CY 사진 전체 복사’를 실행하고 브라우저의 로컬 네트워크 접근을 허용한 뒤 다시 눌러 주세요.';
};
