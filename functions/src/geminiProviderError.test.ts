import { strict as assert } from 'assert';
import { test } from 'node:test';
import { geminiProviderError, GeminiProviderErrorDetails } from './geminiProviderError';

const sensitive = 'synthetic-private-key-and-prompt';
const details = (error: Awaited<ReturnType<typeof geminiProviderError>>) => error.details as GeminiProviderErrorDetails;
const response = (status: number, error: unknown = {}, retryAfter?: string) => ({
    status, json: async () => ({ error }), headers: { get: () => retryAfter ?? null },
});

test('402 remains a non-retryable billing rejection even when Google labels it RESOURCE_EXHAUSTED', async () => {
    const result = await geminiProviderError(response(402, {
        status: 'RESOURCE_EXHAUSTED', message: `prepayment credits are depleted ${sensitive}`,
        details: [{ reason: 'RATE_LIMIT_EXCEEDED', metadata: { apiKey: sensitive } }],
    }, '10'));
    assert.equal(result.code, 'failed-precondition');
    assert.deepEqual(result.details, { provider: 'gemini', providerStatus: 402, reason: 'billing', retryable: false, billingReason: 'prepay-balance' });
    assert.ok(result.message.includes('선불 잔액 부족'));
    assert.ok(!result.message.includes('충전'));
    assert.ok(!JSON.stringify(result.toJSON()).includes(sensitive));
});

test('billing details cannot override unrelated HTTP statuses', async () => {
    const error = { status: 'RESOURCE_EXHAUSTED', code: 402, message: 'prepayment credits are depleted' };
    for (const [status, code, reason, retryable] of [
        [403, 'permission-denied', 'permission', false],
        [404, 'failed-precondition', 'model', false],
        [503, 'unavailable', 'unavailable', true],
    ] as const) {
        const result = await geminiProviderError(response(status, error));
        assert.equal(result.code, code);
        assert.deepEqual(result.details, { provider: 'gemini', providerStatus: status, reason, retryable });
    }
});

test('generic 402 explains possible prepay and spend controls without assuming arrears', async () => {
    const result = await geminiProviderError(response(402));
    assert.deepEqual(result.details, { provider: 'gemini', providerStatus: 402, reason: 'billing', retryable: false });
    assert.ok(result.message.includes('미납 여부와 별개'));
    assert.ok(result.message.includes('선불 전환 여부·잔액'));
    assert.ok(result.message.includes('지출 한도'));
});

test('429 is billing only with explicit exhausted prepay balance or spend cap evidence', async () => {
    for (const [message, billingReason] of [
        ['Your prepayment credits are depleted', 'prepay-balance'],
        ['Your prepaid credit balance has been exhausted', 'prepay-balance'],
        ['Insufficient prepay balance', 'prepay-balance'],
        ['Your monthly spend cap has been exceeded', 'spend-cap'],
        ['You have reached your project spending cap', 'spend-cap'],
    ] as const) {
        const result = await geminiProviderError(response(429, { status: 'RESOURCE_EXHAUSTED', message: `${message}. ${sensitive}` }, '10'));
        assert.equal(result.code, 'failed-precondition');
        assert.deepEqual(result.details, { provider: 'gemini', providerStatus: 429, reason: 'billing', retryable: false, billingReason });
        assert.ok(!JSON.stringify(result.toJSON()).includes(sensitive));
    }
});

test('generic quota instructions and short-window spend limits are not billing evidence', async () => {
    for (const error of [
        { status: 'RESOURCE_EXHAUSTED', code: 402, message: 'You exceeded your current quota, please check your plan and billing details.' },
        { message: 'Spend-based rate limit exceeded in the rolling 10-minute window.' },
        { message: 'Quota exceeded; see https://ai.google.dev/gemini-api/docs/billing' },
        { message: 'Your prepay balance is sufficient. Check usage limits.' },
        { message: 'Your monthly spend cap has not been exceeded.' },
        { message: `${'x'.repeat(2048)} prepayment credits are depleted` },
        { details: [{ reason: 'BILLING_DISABLED', metadata: { private: sensitive } }] },
    ]) {
        const result = await geminiProviderError(response(429, error));
        assert.equal(result.code, 'resource-exhausted');
        assert.deepEqual(result.details, { provider: 'gemini', providerStatus: 429, reason: 'rate-limit', retryable: true });
        assert.ok(!JSON.stringify(result.toJSON()).includes(sensitive));
    }
});

const quotaFailure = (...quotaIds: string[]) => ({
    '@type': 'type.googleapis.com/google.rpc.QuotaFailure',
    violations: quotaIds.map(quotaId => ({ quotaId, quotaDimensions: { project: sensitive }, description: sensitive })),
});
const retryInfo = (retryDelay: unknown) => ({ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay });

test('structured daily quota takes precedence over minute quotas and retry hints', async () => {
    const result = await geminiProviderError(response(429, {
        message: sensitive,
        details: [quotaFailure('GenerateRequestsPerMinutePerProjectPerModel', 'GenerateRequestsPerDayPerProjectPerModel'), retryInfo('45s')],
    }, '30'));
    assert.deepEqual(result.details, { provider: 'gemini', providerStatus: 429, reason: 'rate-limit', retryable: false, quotaPeriod: 'day' });
    assert.ok(result.message.includes('일일'));
    assert.ok(!result.message.includes('잠시 후'));
    assert.ok(!JSON.stringify(result.toJSON()).includes(sensitive));
});

test('structured minute quotas retain bounded retry guidance', async () => {
    const result = await geminiProviderError(response(429, {
        details: [quotaFailure('GenerateRequestsPerMinutePerProjectPerModel'), retryInfo('42.1s')],
    }));
    assert.deepEqual(result.details, { provider: 'gemini', providerStatus: 429, reason: 'rate-limit', retryable: true, quotaPeriod: 'minute', retryAfterSeconds: 43 });
    const metric = await geminiProviderError(response(429, {
        details: [{ '@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: [{ quotaMetric: 'generativelanguage.googleapis.com/requests_per_day' }] }],
    }));
    assert.equal(details(metric).quotaPeriod, 'day');
});

test('quota metadata is read only from recognized structured failures on 429', async () => {
    for (const error of [
        { message: 'daily quota exhausted' },
        { details: [{ violations: [{ quotaId: 'GenerateRequestsPerDay' }] }] },
        { details: [{ '@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: [{ description: 'GenerateRequestsPerDay' }] }] },
        { details: [quotaFailure('x'.repeat(256) + 'PerDay')] },
        { details: [null, [], false, { '@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: [null, false, 'PerDay'] }] },
    ]) assert.equal(details(await geminiProviderError(response(429, error))).quotaPeriod, undefined);
    for (const status of [402, 403, 503]) {
        assert.equal(details(await geminiProviderError(response(status, { details: [quotaFailure('GenerateRequestsPerDay')] }))).quotaPeriod, undefined);
    }
});

test('RetryInfo is a sanitized fallback to Retry-After only for retryable failures', async () => {
    for (const [value, expected] of [['0s', 0], ['0.000000001s', 1], ['42.1s', 43], ['86400s', 3600]] as const) {
        assert.equal(details(await geminiProviderError(response(503, { details: [retryInfo(value)] }))).retryAfterSeconds, expected);
    }
    assert.equal(details(await geminiProviderError(response(429, { details: [retryInfo('42s')] }, '10'))).retryAfterSeconds, 10);
    assert.equal(details(await geminiProviderError(response(429, { details: [retryInfo('42s')] }, 'invalid'))).retryAfterSeconds, 42);
    for (const value of ['-1s', '1e3s', 'Infinitys', '1.1234567890s', '9'.repeat(40) + 's', sensitive, 42, { seconds: 42 }, null]) {
        assert.equal(details(await geminiProviderError(response(429, { details: [retryInfo(value)] }))).retryAfterSeconds, undefined);
    }
    assert.equal(details(await geminiProviderError(response(429, { details: [{ retryDelay: '42s' }] }))).retryAfterSeconds, undefined);
    assert.equal(details(await geminiProviderError(response(402, { details: [retryInfo('42s')] }))).retryAfterSeconds, undefined);
});

test('provider body is parsed once and never forwarded', async () => {
    let reads = 0;
    const result = await geminiProviderError({ status: 429, json: async () => {
        reads++;
        return { error: { details: [quotaFailure('GenerateRequestsPerMinute'), retryInfo('42s')], message: sensitive }, private: sensitive };
    } });
    assert.equal(reads, 1);
    assert.equal(details(result).quotaPeriod, 'minute');
    assert.equal(details(result).retryAfterSeconds, 42);
    assert.ok(!JSON.stringify(result.toJSON()).includes(sensitive));
});

test('provider authentication failure identifies the server key without asking for ERP login', async () => {
    for (const input of [response(401), response(400, { status: 'UNAUTHENTICATED' }),
        response(403, { details: [{ '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason: 'API_KEY_EXPIRED', metadata: { key: sensitive } }] }),
        response(400, { message: `API key not valid. Please pass a valid API key. ${sensitive}` }),
    ]) {
        const result = await geminiProviderError(input);
        assert.equal(result.code, 'failed-precondition');
        assert.equal(details(result).reason, 'auth');
        assert.equal(details(result).retryable, false);
        assert.ok(result.message.includes('ERP 서버'));
        assert.ok(!result.message.includes('로그인'));
        assert.ok(!JSON.stringify(result.toJSON()).includes(sensitive));
    }
});

test('only recognized authentication details affect 400/403 classification', async () => {
    for (const error of [null, { status: 'API_KEY_INVALID' },
        { details: [{ reason: 'API_KEY_INVALID' }] },
        { details: [{ '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason: 'API_KEY_SERVICE_BLOCKED' }] },
        { message: sensitive, arbitraryPrivateData: sensitive },
    ]) {
        const result = await geminiProviderError(response(403, error));
        assert.equal(details(result).reason, 'permission');
        assert.ok(!JSON.stringify(result.toJSON()).includes(sensitive));
    }
});

test('malformed or absent provider JSON keeps useful status-based errors', async () => {
    for (const status of [400, 402, 403, 429, 500]) {
        for (const input of [{ status }, { status, json: async () => { throw new Error(sensitive); } }]) {
            const result = await geminiProviderError(input);
            assert.equal(details(result).providerStatus, status);
            assert.ok(!JSON.stringify(result.toJSON()).includes(sensitive));
        }
    }
    const invalidStatus = await geminiProviderError({ status: NaN });
    assert.deepEqual(invalidStatus.details, { provider: 'gemini', providerStatus: 0, reason: 'unavailable', retryable: true });
});

test('Retry-After is bounded and exposed only for retryable provider failures', async () => {
    for (const [header, expected] of [['0', 0], ['45', 45], ['86400', 3600]] as const) {
        const result = await geminiProviderError(response(429, {}, header));
        assert.equal(details(result).retryAfterSeconds, expected);
    }
    for (const header of ['-10', '0.5', 'Infinity', '1e3', sensitive, '999'.repeat(40), 'Wed, 01 Jan 2020 00:00:00 GMT']) {
        assert.equal(details(await geminiProviderError(response(503, {}, header))).retryAfterSeconds, undefined);
    }
    const future = new Date(Date.now() + 60000).toUTCString();
    const seconds = details(await geminiProviderError(response(503, {}, future))).retryAfterSeconds;
    assert.ok(seconds >= 59 && seconds <= 60);
    assert.equal(details(await geminiProviderError(response(402, {}, '10'))).retryAfterSeconds, undefined);
    assert.equal(details(await geminiProviderError({ status: 503, headers: { get: () => { throw new Error(sensitive); } } })).retryAfterSeconds, undefined);
});

test('request rejection and transient failures remain distinct', async () => {
    for (const status of [400, 409, 413, 422]) {
        const result = await geminiProviderError(response(status));
        assert.equal(result.code, 'invalid-argument');
        assert.equal(details(result).reason, 'request');
        assert.equal(details(result).retryable, false);
    }
    for (const status of [408, 500, 502, 503, 504]) {
        const result = await geminiProviderError(response(status));
        assert.equal(result.code, 'unavailable');
        assert.equal(details(result).reason, 'unavailable');
        assert.equal(details(result).retryable, true);
    }
});
