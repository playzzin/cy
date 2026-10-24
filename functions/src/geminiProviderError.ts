import * as functions from 'firebase-functions/v1';

type ProviderResponse = {
    status: number;
    headers?: { get(name: string): string | null };
    json?: () => Promise<unknown>;
};
export type GeminiProviderErrorDetails = {
    provider: 'gemini';
    providerStatus: number;
    reason: 'billing' | 'rate-limit' | 'auth' | 'permission' | 'model' | 'request' | 'unavailable';
    retryable: boolean;
    retryAfterSeconds?: number;
    billingReason?: 'prepay-balance' | 'spend-cap';
    quotaPeriod?: 'day' | 'minute';
};

const KEY_REASONS = new Set(['API_KEY_INVALID', 'API_KEY_EXPIRED', 'API_KEY_NOT_FOUND']);
type ProviderError = { status?: unknown; message?: unknown; details?: unknown };

async function readProviderError(response: ProviderResponse): Promise<ProviderError> {
    try {
        const payload = await response.json?.() as { error?: unknown };
        return payload?.error && typeof payload.error === 'object' && !Array.isArray(payload.error)
            ? payload.error as ProviderError : {};
    } catch { return {}; }
}

function providerDetails(error: ProviderError, type: string): Record<string, unknown>[] {
    return Array.isArray(error.details) ? error.details.slice(0, 32).filter(detail =>
        detail && typeof detail === 'object' && !Array.isArray(detail)
        && detail['@type'] === `type.googleapis.com/google.rpc.${type}`) : [];
}

function providerMessage(error: ProviderError): string {
    return typeof error.message === 'string' ? error.message.slice(0, 2048) : '';
}

function invalidApiKey(error: ProviderError): boolean {
    if (error.status === 'UNAUTHENTICATED') return true;
    if (providerDetails(error, 'ErrorInfo').some(detail => typeof detail.reason === 'string' && KEY_REASONS.has(detail.reason))) return true;
    // Never return the provider body, metadata, URLs or credentials.
    return /api[ _-]?key (?:not valid|is (?:invalid|expired)|has expired)/i.test(providerMessage(error));
}

function billingReason(error: ProviderError): GeminiProviderErrorDetails['billingReason'] {
    const message = providerMessage(error);
    const prepay = '(?:pre[ -]?paid|prepay(?:ment)?) (?:credits?(?: balance)?|balance)';
    if (new RegExp(`\\b${prepay} (?:is |are |has been |have been )?(?:depleted|exhausted|insufficient|empty|zero|0\\b)`, 'i').test(message)
        || new RegExp(`\\b(?:insufficient|depleted|exhausted) ${prepay}\\b`, 'i').test(message)) return 'prepay-balance';
    // A short-window spend-based rate limit is still 429, not a billing failure.
    const cap = '(?:(?:monthly|project|billing account)[ -]+)?(?:spend(?:ing)? cap|monthly spending limit)';
    if (new RegExp(`\\b${cap} (?:is |has been )?(?:reached|exceeded|exhausted)\\b`, 'i').test(message)
        || new RegExp(`\\b(?:reached|exceeded|exhausted) (?:your |the )?${cap}\\b`, 'i').test(message)) return 'spend-cap';
    return undefined;
}

function quotaPeriod(error: ProviderError): GeminiProviderErrorDetails['quotaPeriod'] {
    let minute = false;
    for (const detail of providerDetails(error, 'QuotaFailure')) {
        if (!Array.isArray(detail.violations)) continue;
        for (const violation of detail.violations.slice(0, 32)) {
            if (!violation || typeof violation !== 'object') continue;
            for (const value of [violation.quotaId, violation.quotaMetric]) {
                if (typeof value !== 'string' || value.length > 256) continue;
                if (/PerDay|(?:^|[_/.-])per[_-]day(?:$|[_/.-])/i.test(value)) return 'day';
                if (/PerMinute|(?:^|[_/.-])per[_-]minute(?:$|[_/.-])/i.test(value)) minute = true;
            }
        }
    }
    return minute ? 'minute' : undefined;
}

function retryInfoSeconds(error: ProviderError): number | undefined {
    const delays = providerDetails(error, 'RetryInfo').map(detail => detail.retryDelay)
        .filter((value): value is string => typeof value === 'string' && value.length <= 32 && /^\d+(?:\.\d{1,9})?s$/.test(value))
        .map(value => Math.min(3600, Math.ceil(Number(value.slice(0, -1)))));
    return delays.length ? Math.max(...delays) : undefined;
}

function retryAfterSeconds(response: ProviderResponse): number | undefined {
    try {
        const value = response.headers?.get('retry-after')?.trim();
        if (!value || value.length > 80) return undefined;
        const seconds = /^\d+$/.test(value) ? Number(value)
            : /^[A-Za-z]{3}, /.test(value) ? Math.ceil((Date.parse(value) - Date.now()) / 1000) : NaN;
        return Number.isFinite(seconds) && seconds >= 0 ? Math.min(3600, seconds) : undefined;
    } catch { return undefined; }
}

export async function geminiProviderError(response: ProviderResponse): Promise<functions.https.HttpsError> {
    const status = Number.isInteger(response.status) && response.status >= 100 && response.status <= 599 ? response.status : 0;
    const error = await readProviderError(response);
    const billing = status === 402 || status === 429 ? billingReason(error) : undefined;
    const period = status === 429 && !billing ? quotaPeriod(error) : undefined;
    let code: functions.https.FunctionsErrorCode;
    let reason: GeminiProviderErrorDetails['reason'];
    let message: string;
    let retryable = false;

    // RESOURCE_EXHAUSTED alone does not imply billing. Only an explicit depleted
    // balance or spend cap can refine 429; a generic plan/billing help link cannot.
    if (status === 402 || billing) {
        code = 'failed-precondition'; reason = 'billing';
        message = billing === 'prepay-balance'
            ? 'Google이 Gemini API 선불 잔액 부족을 보고했습니다. AI Studio에서 해당 키의 프로젝트에 연결된 선불 전환 상태와 사용 가능한 잔액을 확인해 주세요.'
            : billing === 'spend-cap'
                ? 'Google이 Gemini API 지출 한도 도달을 보고했습니다. AI Studio에서 해당 프로젝트와 결제 계정의 지출 한도를 확인해 주세요.'
                : 'Google이 Gemini API 요청을 결제 상태로 인해 거절했습니다. 미납 여부와 별개로 AI Studio에서 해당 키의 프로젝트에 연결된 선불 전환 여부·잔액과 지출 한도를 확인해 주세요.';
    } else if (status === 429) {
        code = 'resource-exhausted'; reason = 'rate-limit'; retryable = period !== 'day';
        message = period === 'day'
            ? 'Google Gemini API의 일일 사용량 한도에 도달했습니다. AI Studio에서 해당 프로젝트·모델의 한도와 초기화 시점을 확인해 주세요.'
            : 'Google Gemini API의 요청 또는 사용량 한도에 도달했습니다. 잠시 후 다시 시도하고, 계속되면 AI Studio의 사용량 한도를 확인해 주세요.';
    } else if (status === 401 || ((status === 400 || status === 403) && invalidApiKey(error))) {
        code = 'failed-precondition'; reason = 'auth';
        message = 'Google이 ERP 서버의 Gemini API 키를 인증하지 못했습니다. AI 설정에서 서버 키의 유효 상태를 확인해 주세요.';
    } else if (status === 403) {
        code = 'permission-denied'; reason = 'permission';
        message = 'Google이 Gemini API 접근을 거절했습니다. 해당 키의 API 제한과 프로젝트의 Gemini API 사용 권한을 확인해 주세요.';
    } else if (status === 404) {
        code = 'failed-precondition'; reason = 'model';
        message = '설정된 Gemini 모델을 사용할 수 없습니다. AI 설정에서 해당 키가 사용할 수 있는 모델인지 확인해 주세요.';
    } else if (status >= 400 && status < 500 && status !== 408) {
        code = 'invalid-argument'; reason = 'request';
        message = 'Google이 Gemini 요청 형식을 처리하지 못했습니다. 입력 내용과 모델 설정을 확인해 주세요.';
    } else {
        code = 'unavailable'; reason = 'unavailable'; retryable = true;
        message = 'Google Gemini API가 일시적으로 응답하지 못했습니다. 잠시 후 다시 시도해 주세요.';
    }
    const details: GeminiProviderErrorDetails = { provider: 'gemini', providerStatus: status, reason, retryable };
    if (billing) details.billingReason = billing;
    if (period) details.quotaPeriod = period;
    const delay = retryable ? retryAfterSeconds(response) ?? retryInfoSeconds(error) : undefined;
    if (delay !== undefined) details.retryAfterSeconds = delay;
    return new functions.https.HttpsError(code, message, details);
}
