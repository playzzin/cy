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
    let result: Session;
    try {
        result = await request('/session', signal) as Session;
    } catch (error) {
        if (error instanceof WindowsPhotoClipboardError && ['connection', 'timeout'].includes(error.code)) {
            // Permission names vary across Chromium releases. Check the one for loopback first.
            for (const name of ['loopback-network', 'local-network-access']) {
                let state: PermissionState | undefined;
                try { state = (await navigator.permissions?.query({ name: name as PermissionName }))?.state; }
                catch { continue; }
                if (state === 'denied') throw new WindowsPhotoClipboardError('network-permission');
                if (state) break;
            }
        }
        throw error;
    }
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
    if (!files.length || files.some(file => !file.size)) throw new WindowsPhotoClipboardError('empty-photo');
    if (files.some(file => !TYPES.has(file.type))) throw new WindowsPhotoClipboardError('image-format');
    if (files.length > 100) throw new WindowsPhotoClipboardError('file-count');
    if (files.some(file => file.size > MAX_FILE)) throw new WindowsPhotoClipboardError('file-bytes');
    if (files.reduce((sum, file) => sum + file.size, 0) > MAX_TOTAL) throw new WindowsPhotoClipboardError('total-bytes');
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

export const windowsPhotoClipboardErrorMessage = (error: unknown, origin = window.location.origin): string => {
    const code = error instanceof WindowsPhotoClipboardError ? error.code : '';
    if (code === 'network-permission') return '브라우저가 이 사이트의 로컬 네트워크 접근을 차단했습니다. 주소창의 사이트 설정에서 로컬 네트워크 접근을 허용하고 새로고침한 뒤 다시 눌러 주세요.';
    if (error instanceof WindowsPhotoClipboardError && error.stage === 'connect' && ['connection', 'timeout'].includes(code)) {
        if (origin !== 'https://cyee-9c1e4.web.app') return '이 주소는 Windows 보조 프로그램이 허용하는 작업자요약 주소가 아닙니다. 운영 작업자요약에서 다시 열어 주세요.';
    }
    if (code === 'empty-photo') return '사진이 없거나 비어 있는 원본이 있습니다. 등록한 원본 파일을 확인해 주세요.';
    if (code === 'file-count') return 'Windows 보조 프로그램이 한 번에 받는 100장을 초과했습니다. 원본 전체를 ZIP 또는 폴더로 저장해 첨부할 수 있습니다.';
    if (code === 'file-bytes') return '사진 한 장이 Windows 보조 프로그램의 20MiB 한도를 초과했습니다. 원본 전체를 ZIP 또는 폴더로 저장해 첨부할 수 있습니다.';
    if (code === 'total-bytes') return '선택한 사진 합계가 Windows 보조 프로그램의 200MiB 한도를 초과했습니다. 원본 전체를 ZIP 또는 폴더로 저장해 첨부할 수 있습니다.';
    if (code === 'busy') return '다른 사진을 처리하고 있습니다. 잠시 뒤 다시 눌러 주세요.';
    if (code === 'version') return '전체 복사 기능을 사용하려면 PC 보조 프로그램 1.2 이상이 필요합니다. 아래 설치 메뉴에서 새 설치 파일을 실행한 뒤 다시 눌러 주세요.';
    if (code === 'photo-window-version') return '사진을 한 번에 끌어놓으려면 PC 보조 프로그램 1.3 이상이 필요합니다. 아래 설치 메뉴에서 새 설치 파일을 실행한 뒤 다시 눌러 주세요.';
    if (code === 'photo-window-busy') return '사진창이 준비 중이거나 마우스를 사용 중입니다. 마우스를 놓고 잠시 뒤 다시 눌러 주세요. 계속되면 아래 설치 메뉴에서 PC 보조 프로그램을 1.4.2 이상으로 업데이트해 주세요. 기존 사진창은 자동으로 전환됩니다.';
    if (code === 'photo-window') return 'Windows 사진창을 열지 못했습니다. 보조 프로그램의 실행 상태를 확인한 뒤 다시 눌러 주세요.';
    if (code === 'image-format') return '사진 형식을 확인하지 못해 사진 준비를 중단했습니다. 해당 사진을 다시 등록하거나 개별 사진 복사를 이용해 주세요.';
    if (code === 'temporary-files') return '보조 프로그램에서 공유용 임시 사진을 준비하지 못했습니다. PC의 여유 공간을 확인해 주세요.';
    if (error instanceof WindowsPhotoClipboardError && error.stage === 'copy') return '사진 준비는 끝났지만 클립보드 복사 결과를 확인하지 못했습니다. Windows 알림 영역의 CY 사진 전체 복사에서 ‘마지막 사진 전체 다시 복사’를 눌러 주세요.';
    if (error instanceof WindowsPhotoClipboardError && error.stage === 'open') return '사진 준비는 끝났지만 Windows 사진창이 열렸는지 확인하지 못했습니다. 잠시 뒤 ‘한 번에 끌어놓기’를 다시 눌러 주세요. PC 보조 프로그램 1.4.2 이상에서는 기존 사진창을 자동으로 전환합니다.';
    if (error instanceof WindowsPhotoClipboardError && error.stage === 'prepare') return `사진 전달을 완료하지 못했습니다. 잠시 뒤 다시 눌러 주세요. PC 보조 프로그램이 1.4 이전이면 업데이트해 주세요. 1.4부터는 끊긴 부분을 자동 재시도합니다. 오류: ${code}`;
    return 'PC 보조 프로그램에 연결하지 못했습니다. 시작 메뉴에서 ‘CY 사진 전체 복사’를 실행하고 브라우저의 로컬 네트워크 접근을 허용한 뒤 다시 눌러 주세요.';
};
