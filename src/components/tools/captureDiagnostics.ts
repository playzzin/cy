export type CaptureStage = 'permission' | 'video' | 'identity' | 'frame' | 'selection' | 'encoding' | 'clipboard' | 'scroll';
export type CaptureOutcome = 'success' | 'failed' | 'cancelled';
export const CAPTURE_STAGE_LABELS: Record<CaptureStage, string> = {
    permission: '공유 허용', video: '영상 준비', identity: '현재 탭 확인', frame: '화면 고정',
    selection: '영역 선택', encoding: '이미지 생성', clipboard: '클립보드 복사', scroll: '긴 화면 캡처'
};
const ERROR_CODES = new Set([
    'capture-aborted', 'capture-paint-timeout', 'video-load-timeout', 'video-frame-timeout',
    'video-load-failed', 'screen-browser-only', 'screen-tab-mismatch', 'screen-aspect-mismatch',
    'capture-viewport-changed', 'capture-viewport-unsettled', 'no-track', 'track-ended', 'canvas-context-failed', 'png-timeout',
    'clipboard-timeout', 'scroll-content-changing', 'scroll-frame-gap', 'scroll-frame-unchanged',
    'scroll-range-too-long', 'scroll-tab-hidden', 'unsupported', 'insecure-context',
    'NotAllowedError', 'NotReadableError', 'InvalidStateError', 'AbortError', 'SecurityError',
    'NotFoundError', 'OverconstrainedError'
]);
export const getCaptureErrorCode = (error: unknown): string => {
    if (!(error instanceof Error)) return 'unknown';
    if (ERROR_CODES.has(error.message)) return error.message;
    if (ERROR_CODES.has(error.name)) return error.name;
    return 'unknown';
};
export type CaptureDiagnostic = {
    startedAt: string;
    mode: 'screen' | 'scroll' | 'copy';
    quality: 'standard' | 'high';
    browser: string;
    viewport: { width: number; height: number; pixelRatio: number };
    stages: Array<{ stage: CaptureStage; elapsedMs: number }>;
    outcome?: CaptureOutcome;
    errorCode?: string;
    durationMs?: number;
};

export const createCaptureDiagnostics = () => {
    const records: CaptureDiagnostic[] = [];
    return {
        start(mode: CaptureDiagnostic['mode'], quality: CaptureDiagnostic['quality']) {
            const started = performance.now();
            const browserMatch = navigator.userAgent.match(/(?:Edg|Firefox|Chrome|Version)\/[\d.]+/g);
            const record: CaptureDiagnostic = {
                startedAt: new Date().toISOString(), mode, quality,
                browser: browserMatch?.slice(-1)[0] || 'unknown',
                viewport: { width: window.innerWidth, height: window.innerHeight, pixelRatio: window.devicePixelRatio || 1 },
                stages: []
            };
            records.push(record);
            if (records.length > 20) records.shift();
            return {
                mark(stage: CaptureStage) {
                    if (!record.outcome && record.stages.length < 32) {
                        record.stages.push({ stage, elapsedMs: Math.round(performance.now() - started) });
                    }
                },
                finish(outcome: CaptureOutcome, error?: unknown) {
                    if (record.outcome) return;
                    record.outcome = outcome;
                    record.durationMs = Math.round(performance.now() - started);
                    if (error !== undefined) record.errorCode = getCaptureErrorCode(error);
                }
            };
        },
        snapshot: () => JSON.parse(JSON.stringify({ version: 1, records })) as { version: number; records: CaptureDiagnostic[] }
    };
};
export type CaptureDiagnosticRun = ReturnType<ReturnType<typeof createCaptureDiagnostics>['start']>;
