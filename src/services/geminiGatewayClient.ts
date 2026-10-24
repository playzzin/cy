type GeminiFailureReason = 'billing' | 'rate-limit' | 'auth' | 'permission' | 'model' | 'request' | 'unavailable';
type GeminiBillingReason = 'prepay-balance' | 'spend-cap';
type GeminiQuotaPeriod = 'day' | 'minute';
type GeminiProviderFailure = {
    provider: 'gemini';
    providerStatus: number;
    reason: GeminiFailureReason;
    retryable: boolean;
    retryAfterSeconds?: number;
    billingReason?: GeminiBillingReason;
    quotaPeriod?: GeminiQuotaPeriod;
};

function billingMessage(status: number, billingReason?: GeminiBillingReason): string {
    const guidance = billingReason === 'prepay-balance'
        ? 'Google이 Gemini API 선불 잔액 부족을 알렸습니다. 미납 여부와 별개로 AI Studio에서 서버 키에 연결된 프로젝트의 결제 방식과 선불 잔액을 확인해 주세요.'
        : billingReason === 'spend-cap'
            ? 'Google이 Gemini API 지출 한도 도달을 알렸습니다. 미납 여부와 별개로 AI Studio에서 서버 키에 연결된 프로젝트와 결제 계정의 지출 한도를 확인해 주세요.'
            : 'Google이 Gemini API 요청을 결제 사유로 거절했습니다. 미납 여부와 별개로 AI Studio에서 서버 키에 연결된 프로젝트의 결제 상태(선불 전환 여부·잔액)와 지출 한도를 확인해 주세요.';
    return `${guidance} (HTTP ${status})`;
}

export const GEMINI_BILLING_SKIPPED_MESSAGE = 'Gemini API의 결제 관련 응답으로 분석을 중지했습니다. 이 파일은 요청하지 않았습니다. 미납 여부와 별개로 해당 프로젝트의 선불 잔액과 지출 한도를 확인한 뒤 다시 분석해 주세요.';

export class GeminiBillingError extends Error {
    readonly provider = 'gemini';
    readonly providerStatus: 402 | 429;
    readonly reason = 'billing';
    readonly retryable = false;
    readonly billingReason?: GeminiBillingReason;

    constructor(providerStatus: 402 | 429 = 402, billingReason?: GeminiBillingReason) {
        super(billingMessage(providerStatus, billingReason));
        this.name = 'GeminiBillingError';
        this.providerStatus = providerStatus;
        this.billingReason = billingReason;
    }
}

export const isGeminiBillingError = (error: unknown): error is GeminiBillingError => error instanceof GeminiBillingError;

const providerStatusMatches: Record<GeminiFailureReason, (status: number) => boolean> = {
    billing: status => status === 402 || status === 429,
    'rate-limit': status => status === 429,
    auth: status => [400, 401, 403].includes(status),
    permission: status => status === 403,
    model: status => status === 404,
    request: status => status >= 400 && status <= 499 && ![401, 402, 403, 404, 408, 429].includes(status),
    unavailable: status => status === 0 || status === 408 || (status >= 100 && status <= 199)
        || (status >= 300 && status <= 399) || (status >= 500 && status <= 599),
};

/** Read only the bounded provider contract; never retain arbitrary error details. */
function readGeminiProviderFailure(error: unknown): GeminiProviderFailure | undefined {
    if (!error || typeof error !== 'object') return undefined;
    const details = (error as { details?: unknown }).details;
    if (!details || typeof details !== 'object') return undefined;
    const { provider, providerStatus, reason, retryable, retryAfterSeconds, billingReason, quotaPeriod } = details as Record<string, unknown>;
    if (provider !== 'gemini' || typeof providerStatus !== 'number' || !Number.isInteger(providerStatus)
        || typeof reason !== 'string' || !Object.prototype.hasOwnProperty.call(providerStatusMatches, reason)
        || !providerStatusMatches[reason as GeminiFailureReason](providerStatus) || typeof retryable !== 'boolean'
        || (retryAfterSeconds !== undefined && (typeof retryAfterSeconds !== 'number'
            || !Number.isFinite(retryAfterSeconds) || retryAfterSeconds < 0 || retryAfterSeconds > 86400))
        || (billingReason !== undefined && (reason !== 'billing' || typeof billingReason !== 'string' || !['prepay-balance', 'spend-cap'].includes(billingReason)))
        || (quotaPeriod !== undefined && (reason !== 'rate-limit' || typeof quotaPeriod !== 'string' || !['day', 'minute'].includes(quotaPeriod)))
        || (reason === 'billing' && (retryable || retryAfterSeconds !== undefined || (providerStatus === 429 && billingReason === undefined)))
        || (quotaPeriod === 'day' && (retryable || retryAfterSeconds !== undefined))) return undefined;
    return { provider, providerStatus, reason: reason as GeminiFailureReason, retryable,
        retryAfterSeconds: retryAfterSeconds as number | undefined,
        billingReason: billingReason as GeminiBillingReason | undefined, quotaPeriod: quotaPeriod as GeminiQuotaPeriod | undefined };
}

function providerErrorMessage({ providerStatus, reason, retryAfterSeconds, billingReason, quotaPeriod }: GeminiProviderFailure): string {
    switch (reason) {
        case 'billing': return billingMessage(providerStatus, billingReason);
        case 'rate-limit': {
            if (quotaPeriod === 'day') return 'Gemini API 프로젝트의 일일 사용량 한도에 도달했습니다. AI Studio에서 해당 모델의 한도와 재설정 시점을 확인해 주세요.';
            const limit = quotaPeriod === 'minute' ? '분당 요청 또는 토큰 사용량' : '요청 또는 토큰 사용량';
            const retry = typeof retryAfterSeconds === 'number' && retryAfterSeconds > 0
                ? `${Math.ceil(retryAfterSeconds)}초 후 다시 시도해 주세요.` : '잠시 후 다시 시도해 주세요.';
            return `Gemini API 프로젝트의 ${limit} 한도에 도달했습니다. ${retry} 계속되면 AI Studio에서 해당 모델에 적용된 한도를 확인해 주세요.`;
        }
        case 'auth': return 'Gemini API 서버 키 인증에 실패했습니다. AI 설정에서 저장된 키를 확인해 주세요.';
        case 'permission': return 'Gemini API 서버 키에 이 요청을 실행할 권한이 없습니다. 키의 API 제한과 프로젝트 권한을 확인해 주세요.';
        case 'model': return '현재 서버 키로 요청한 Gemini 모델을 사용할 수 없습니다. AI 설정에서 사용 가능한 모델을 선택해 주세요.';
        case 'request': return 'Gemini API가 요청 형식을 처리하지 못했습니다. 입력 내용과 파일 형식을 확인해 주세요.';
        case 'unavailable': return [408, 504].includes(providerStatus)
            ? 'Gemini API 응답 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.'
            : 'Gemini API가 일시적으로 응답하지 않습니다. 잠시 후 다시 시도해 주세요.';
    }
}

/** Render only structured provider failures; raw provider messages may contain private data. */
export function getGeminiProviderErrorMessage(error: unknown): string | undefined {
    const failure = readGeminiProviderFailure(error);
    return failure ? providerErrorMessage(failure) : undefined;
}

export async function requestGeminiContent(feature: string, body: unknown, signal?: AbortSignal): Promise<any> {
    const [{ httpsCallable }, { auth, functions }] = await Promise.all([import('firebase/functions'), import('../config/firebase')]);
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('AI 기능을 사용하려면 로그인해 주세요.');
    const aborted = () => { throw new DOMException('요청을 취소했습니다.', 'AbortError'); };
    if (signal?.aborted) return aborted();
    try {
        const request = httpsCallable(functions, 'geminiGateway', { timeout: 185000 });
        let onAbort: (() => void) | undefined;
        const pending = request({ feature, body });
        const result = await (signal ? Promise.race([pending, new Promise<never>((_resolve, reject) => {
            onAbort = () => reject(new DOMException('요청을 취소했습니다.', 'AbortError'));
            signal.addEventListener('abort', onAbort, { once: true });
            if (signal.aborted) onAbort();
        })]).finally(() => { if (onAbort) signal.removeEventListener('abort', onAbort); }) : pending);
        if (signal?.aborted) return aborted();
        if (auth.currentUser?.uid !== uid) throw new Error('로그인 계정이 변경되었습니다. 다시 요청해 주세요.');
        try { localStorage.removeItem('gemini_api_key'); localStorage.removeItem('geminiApiKey'); } catch { /* Browser storage may be unavailable. */ }
        return result.data;
    } catch (error) {
        if (signal?.aborted) return aborted();
        if (auth.currentUser?.uid !== uid) throw new Error('로그인 계정이 변경되었습니다. 다시 요청해 주세요.');
        const providerFailure = readGeminiProviderFailure(error);
        if (providerFailure?.reason === 'billing') throw new GeminiBillingError(providerFailure.providerStatus as 402 | 429, providerFailure.billingReason);
        if (providerFailure) throw new Error(providerErrorMessage(providerFailure));
        const errorCode = (error as { code?: unknown } | null)?.code;
        const code = typeof errorCode === 'string' ? errorCode.replace(/^functions\//, '') : undefined;
        if (code === 'not-found') throw new Error('AI 서버 업데이트가 필요합니다. 관리자에게 확인해 주세요.');
        if (code === 'unauthenticated' || code === 'permission-denied') throw new Error('현재 계정의 AI 사용 권한을 확인해 주세요.');
        if (code === 'failed-precondition') throw new Error('서버 AI 설정을 확인해 주세요.');
        if (code === 'resource-exhausted') throw new Error('AI 요청 한도에 도달했습니다. 잠시 후 다시 시도하고, 계속되면 관리자에게 ERP 요청 제한과 Gemini 프로젝트 사용량을 확인해 달라고 요청해 주세요.');
        if (code === 'invalid-argument') throw new Error('AI 요청 내용을 확인해 주세요. 입력 내용이나 파일을 처리하지 못했습니다.');
        if (code === 'deadline-exceeded') throw new Error('AI 서버 응답 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.');
        if (code === 'unavailable') throw new Error('AI 서버가 일시적으로 응답하지 않습니다. 잠시 후 다시 시도해 주세요.');
        throw new Error('AI 서버 연결을 확인해 주세요.');
    }
}
