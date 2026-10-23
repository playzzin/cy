import { httpsCallable } from 'firebase/functions';
import { auth } from '../config/firebase';
import { GeminiBillingError, getGeminiProviderErrorMessage, isGeminiBillingError, requestGeminiContent } from './geminiGatewayClient';
jest.mock('firebase/functions', () => ({ httpsCallable: jest.fn() }));
jest.mock('../config/firebase', () => ({ auth: { currentUser: { uid: 'synthetic' } }, functions: {} }));
beforeEach(() => {
    jest.clearAllMocks(); localStorage.clear();
    Object.defineProperty(auth, 'currentUser', { configurable: true, value: { uid: 'synthetic' } });
});
test('sends only feature/body and removes legacy browser keys after server success', async () => {
    localStorage.setItem('gemini_api_key', 'synthetic-old-key');
    localStorage.setItem('geminiApiKey', 'synthetic-old-key');
    const invoke = jest.fn().mockResolvedValue({ data: { candidates: [] } });
    (httpsCallable as jest.Mock).mockReturnValue(invoke);
    expect(await requestGeminiContent('document-analysis', { contents: [] })).toEqual({ candidates: [] });
    expect(invoke).toHaveBeenCalledWith({ feature: 'document-analysis', body: { contents: [] } });
    expect(localStorage.getItem('gemini_api_key')).toBeNull();
    expect(localStorage.getItem('geminiApiKey')).toBeNull();
});
test('requires a session and never falls back to browser keys on server failure', async () => {
    (httpsCallable as jest.Mock).mockReturnValue(jest.fn().mockRejectedValue({ code: 'functions/not-found', message: 'private detail' }));
    await expect(requestGeminiContent('document-analysis', {})).rejects.toThrow('업데이트');
    Object.defineProperty(auth, 'currentUser', { configurable: true, value: null });
    await expect(requestGeminiContent('document-analysis', {})).rejects.toThrow('로그인');
});
test('cancellation returns promptly while the bounded server request finishes independently', async () => {
    const controller = new AbortController();
    (httpsCallable as jest.Mock).mockReturnValue(jest.fn(() => { controller.abort(); return new Promise(() => {}); }));
    await expect(requestGeminiContent('document-analysis', {}, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
});

test('reports provider billing rejection without assuming unpaid invoices or a depleted balance', async () => {
    (httpsCallable as jest.Mock).mockReturnValue(jest.fn().mockRejectedValue({
        code: 'functions/failed-precondition', message: 'private provider message',
        details: { provider: 'gemini', providerStatus: 402, reason: 'billing', retryable: false },
    }));
    const error = await requestGeminiContent('document-analysis', {}).catch(reason => reason);
    expect(error.message).toContain('결제 상태');
    expect(error.message).toContain('HTTP 402');
    expect(error.message).toContain('미납 여부와 별개');
    expect(error.message).toContain('선불 전환');
    expect(error.message).not.toMatch(/파일 크기|사용 한도|소진|충전|private provider/);
    expect(isGeminiBillingError(error)).toBe(true);
    expect(error).toMatchObject({ provider: 'gemini', providerStatus: 402, reason: 'billing', retryable: false });
    expect(error.details).toBeUndefined();
});

test.each([
    [402, 'prepay-balance', '선불 잔액 부족'],
    [429, 'prepay-balance', '선불 잔액 부족'],
    [402, 'spend-cap', '지출 한도 도달'],
    [429, 'spend-cap', '지출 한도 도달'],
])('preserves the explicit billing cause and original HTTP status (%i, %s)', async (providerStatus, billingReason, expectedMessage) => {
    (httpsCallable as jest.Mock).mockReturnValue(jest.fn().mockRejectedValue({
        code: 'functions/resource-exhausted', message: 'synthetic-private-provider-body',
        details: { provider: 'gemini', providerStatus, reason: 'billing', retryable: false,
            billingReason, metadata: { apiKey: 'synthetic-private-key' }, project: 'synthetic-private-project' },
    }));
    const error = await requestGeminiContent('document-analysis', {}).catch(reason => reason);
    expect(isGeminiBillingError(error)).toBe(true);
    expect(error).toMatchObject({ providerStatus, billingReason, reason: 'billing', retryable: false });
    expect(error.message).toContain(expectedMessage);
    expect(error.message).toContain(`HTTP ${providerStatus}`);
    expect(error.message).toContain('미납 여부와 별개');
    expect(error.message).not.toMatch(/잠시 후|synthetic-private/);
    expect(error.details).toBeUndefined();
    expect(JSON.stringify(error)).not.toContain('synthetic-private');
});

test('does not mistake arbitrary message text or object properties for a typed billing failure', () => {
    expect(isGeminiBillingError(new Error('HTTP 402'))).toBe(false);
    expect(isGeminiBillingError({ provider: 'gemini', providerStatus: 402, reason: 'billing' })).toBe(false);
    expect(isGeminiBillingError(new GeminiBillingError())).toBe(true);
});

test('distinguishes provider rate limiting and displays the bounded retry delay', async () => {
    (httpsCallable as jest.Mock).mockReturnValue(jest.fn().mockRejectedValue({
        code: 'functions/resource-exhausted', message: 'private provider message',
        details: { provider: 'gemini', providerStatus: 429, reason: 'rate-limit', retryable: true, retryAfterSeconds: 31 },
    }));
    await expect(requestGeminiContent('document-analysis', {})).rejects.toThrow('31초 후');
});

test('does not tell a daily quota failure to retry after a short delay', async () => {
    (httpsCallable as jest.Mock).mockReturnValue(jest.fn().mockRejectedValue({
        code: 'functions/resource-exhausted', message: 'private provider message',
        details: { provider: 'gemini', providerStatus: 429, reason: 'rate-limit', retryable: false, quotaPeriod: 'day' },
    }));
    const error = await requestGeminiContent('document-analysis', {}).catch(reason => reason);
    expect(error.message).toContain('일일 사용량 한도');
    expect(error.message).toContain('재설정 시점');
    expect(error.message).not.toMatch(/잠시 후|초 후|결제|미납|private/);
    expect(isGeminiBillingError(error)).toBe(false);
});

test('names the minute quota separately from billing and rounds up the safe retry delay', () => {
    const message = getGeminiProviderErrorMessage({ details: {
        provider: 'gemini', providerStatus: 429, reason: 'rate-limit', retryable: true, quotaPeriod: 'minute', retryAfterSeconds: 4.1,
    } });
    expect(message).toContain('분당 요청 또는 토큰 사용량');
    expect(message).toContain('5초 후');
    expect(message).not.toMatch(/결제|미납/);
});

test('generic quota errors stay separate from billing even if raw provider text mentions a billing plan', async () => {
    const invoke = jest.fn().mockRejectedValue({
        code: 'functions/resource-exhausted', message: 'Please check your plan and billing details: synthetic-private-body',
        details: { provider: 'gemini', providerStatus: 429, reason: 'rate-limit', retryable: true },
    });
    (httpsCallable as jest.Mock).mockReturnValue(invoke);
    const error = await requestGeminiContent('document-analysis', {}).catch(reason => reason);
    expect(isGeminiBillingError(error)).toBe(false);
    expect(error.message).toContain('Gemini API 프로젝트');
    expect(error.message).not.toMatch(/결제|미납|billing|synthetic-private/);
    expect(invoke).toHaveBeenCalledTimes(1);
});

test('unclassified callable limits point to both ERP and provider limits without assuming provider billing', async () => {
    (httpsCallable as jest.Mock).mockReturnValue(jest.fn().mockRejectedValue({
        code: 'functions/resource-exhausted', message: 'private provider message',
    }));
    const error = await requestGeminiContent('document-analysis', {}).catch(reason => reason);
    expect(error.message).toContain('ERP 요청 제한');
    expect(error.message).toContain('Gemini 프로젝트 사용량');
    expect(error.message).not.toMatch(/결제|미납|private/);
});

test('distinguishes provider key permission from the signed-in user permission', async () => {
    const invoke = jest.fn()
        .mockRejectedValueOnce({
            code: 'functions/permission-denied', message: 'private provider message',
            details: { provider: 'gemini', providerStatus: 403, reason: 'permission', retryable: false },
        })
        .mockRejectedValueOnce({ code: 'functions/permission-denied', message: 'private user detail' });
    (httpsCallable as jest.Mock).mockReturnValue(invoke);
    await expect(requestGeminiContent('document-analysis', {})).rejects.toThrow('Gemini API 서버 키');
    await expect(requestGeminiContent('document-analysis', {})).rejects.toThrow('현재 계정의 AI 사용 권한');
});

test.each([400, 401, 403])('reports Google key authentication errors returned with status %i', async providerStatus => {
    (httpsCallable as jest.Mock).mockReturnValue(jest.fn().mockRejectedValue({
        code: 'functions/failed-precondition', message: 'private provider message',
        details: { provider: 'gemini', providerStatus, reason: 'auth', retryable: false },
    }));
    await expect(requestGeminiContent('document-analysis', {})).rejects.toThrow('서버 키 인증에 실패');
});

test.each([
    { provider: 'another-provider', providerStatus: 402, reason: 'billing', retryable: false },
    { provider: 'gemini', providerStatus: 403, reason: 'billing', retryable: false },
    { provider: 'gemini', providerStatus: 402, reason: 'billing', retryable: 'false' },
    { provider: 'gemini', providerStatus: 429, reason: 'rate-limit', retryable: true, retryAfterSeconds: Infinity },
    { provider: 'gemini', providerStatus: 429, reason: 'rate-limit', retryable: true, retryAfterSeconds: -1 },
    { provider: 'gemini', providerStatus: 429, reason: 'rate-limit', retryable: true, retryAfterSeconds: 86401 },
    { provider: 'gemini', providerStatus: 402, reason: 'constructor', retryable: false },
    { provider: 'gemini', providerStatus: 429, reason: 'billing', retryable: false },
    { provider: 'gemini', providerStatus: 402, reason: 'billing', retryable: true },
    { provider: 'gemini', providerStatus: 402, reason: 'billing', retryable: false, retryAfterSeconds: 10 },
    { provider: 'gemini', providerStatus: 402, reason: 'billing', retryable: false, billingReason: 'private-provider-detail' },
    { provider: 'gemini', providerStatus: 429, reason: 'billing', retryable: false, billingReason: ['prepay-balance'] },
    { provider: 'gemini', providerStatus: 403, reason: 'permission', retryable: false, billingReason: 'spend-cap' },
    { provider: 'gemini', providerStatus: 429, reason: 'rate-limit', retryable: false, quotaPeriod: 'private-provider-detail' },
    { provider: 'gemini', providerStatus: 429, reason: 'rate-limit', retryable: false, quotaPeriod: ['day'] },
    { provider: 'gemini', providerStatus: 402, reason: 'billing', retryable: false, quotaPeriod: 'day' },
    { provider: 'gemini', providerStatus: 429, reason: 'rate-limit', retryable: true, quotaPeriod: 'day' },
    { provider: 'gemini', providerStatus: 429, reason: 'rate-limit', retryable: false, quotaPeriod: 'day', retryAfterSeconds: 10 },
])('rejects inconsistent provider details without displaying arbitrary messages: %o', async details => {
    const error = { code: 'functions/failed-precondition', message: 'private detail', details };
    expect(getGeminiProviderErrorMessage(error)).toBeUndefined();
    (httpsCallable as jest.Mock).mockReturnValue(jest.fn().mockRejectedValue(error));
    await expect(requestGeminiContent('document-analysis', {})).rejects.toThrow('서버 AI 설정');
});

test.each([
    ['functions/deadline-exceeded', '응답 시간이 초과'],
    ['functions/unavailable', '일시적으로 응답하지'],
])('does not misreport %s as billing or quota', async (code, expectedMessage) => {
    (httpsCallable as jest.Mock).mockReturnValue(jest.fn().mockRejectedValue({ code, message: 'private detail' }));
    await expect(requestGeminiContent('document-analysis', {})).rejects.toThrow(expectedMessage);
});

test.each(['success', 'failure'])('does not show a result or provider error after account change (%s)', async outcome => {
    (httpsCallable as jest.Mock).mockReturnValue(jest.fn(async () => {
        Object.defineProperty(auth, 'currentUser', { configurable: true, value: { uid: 'another-user' } });
        if (outcome === 'failure') throw Object.assign(new Error('private provider message'), {
            code: 'functions/failed-precondition',
            details: { provider: 'gemini', providerStatus: 402, reason: 'billing', retryable: false },
        });
        return { data: { candidates: [{ content: 'previous account result' }] } };
    }));
    await expect(requestGeminiContent('document-analysis', {})).rejects.toThrow('로그인 계정이 변경');
});

test('does not begin a callable request when already cancelled', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(requestGeminiContent('document-analysis', {}, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(httpsCallable).not.toHaveBeenCalled();
});
