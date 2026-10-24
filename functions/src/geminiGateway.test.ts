import { strict as assert } from 'assert';
import { test } from 'node:test';
import * as admin from 'firebase-admin';
if (!admin.apps.length) admin.initializeApp({ projectId: 'demo-cy-gateway' });
const { validateGatewayInput, nextGatewayQuota, generateGatewayContent, handleGeminiGateway } = require('./geminiGateway') as typeof import('./geminiGateway');
const input = { feature: 'document-analysis', body: { contents: [{ parts: [{ text: 'synthetic fixture' }] }] } };
const settings = { apiKey: 'synthetic-server-key', model: 'gemini-3.8-flash', documentModel: 'gemini-3.8-flash' } as any;
const errorCode = (code: string) => (error: any) => error.code === code && !error.message.includes(settings.apiKey);

test('rejects client keys/models, remote files, tools and oversized prompts', () => {
    for (const value of [{ ...input, apiKey: 'client' }, { ...input, model: 'custom' }, { ...input, feature: 'unknown' },
        { ...input, body: { ...input.body, tools: [] } }, { ...input, body: { contents: [{ parts: [{ fileData: { fileUri: 'https://example.org' } }] }] } },
        { ...input, body: { contents: [{ parts: [{ text: 'x'.repeat(200001) }] }] } },
        { ...input, body: { ...input.body, generationConfig: { responseModalities: 'IMAGE' } } }]) {
        assert.throws(() => validateGatewayInput(value), errorCode('invalid-argument'));
    }
    assert.equal(validateGatewayInput(input).body.generationConfig.maxOutputTokens, 8192);
});
test('limits per-user concurrent, minute, day and image use', () => {
    const now = Date.now(), first = nextGatewayQuota({}, now, '1', true);
    assert.equal(first.imageCount, 1);
    for (const previous of [{ ...first, leases: [first.leases[0], first.leases[0], first.leases[0]] }, { ...first, minuteCount: 20 },
        { ...first, dayCount: 300 }, { ...first, imageCount: 30 }]) assert.throws(() => nextGatewayQuota(previous, now, '2', true), errorCode('resource-exhausted'));
    assert.equal(nextGatewayQuota({ ...first, leases: [{ id: 'old', until: 0 }] }, now, '2', false).leases.length, 1);
});
test('keeps credentials server-side and uses the configured model', async () => {
    const request = (async (url: string, options: any) => {
        assert.ok(!url.includes(settings.apiKey));
        assert.equal(options.headers['x-goog-api-key'], settings.apiKey);
        assert.ok(!options.body.includes(settings.apiKey));
        return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: 'done' }] } }] }) };
    }) as any;
    assert.equal((await generateGatewayContent(validateGatewayInput(input), settings, request)).candidates.length, 1);
});
test('does not forward provider failures or expose keys', async () => {
    await assert.rejects(generateGatewayContent(validateGatewayInput(input), settings, (async () => ({ ok: false, status: 503, text: async () => settings.apiKey })) as any), errorCode('unavailable'));
    await assert.rejects(generateGatewayContent(validateGatewayInput(input), {} as any), errorCode('failed-precondition'));
});

test('preserves safe provider billing and rate-limit details for gateway callers', async () => {
    for (const [status, code, reason, retryable] of [[402, 'failed-precondition', 'billing', false], [429, 'resource-exhausted', 'rate-limit', true]] as const) {
        const request = (async () => ({ ok: false, status,
            json: async () => ({ error: { status: 'RESOURCE_EXHAUSTED', message: settings.apiKey } }),
        })) as any;
        await assert.rejects(generateGatewayContent(validateGatewayInput(input), settings, request), (error: any) => {
            assert.equal(error.code, code);
            assert.deepEqual(error.details, { provider: 'gemini', providerStatus: status, reason, retryable });
            assert.ok(!JSON.stringify(error.toJSON()).includes(settings.apiKey));
            return true;
        });
    }
});
test('requires authentication, current access and releases usage on failure', async () => {
    await assert.rejects(handleGeminiGateway(input, {} as any), errorCode('unauthenticated'));
    let released = 0, called = 0;
    const deps = { authorize: async () => 'user', claim: async () => async () => { released++; }, settings: async () => settings,
        generate: async () => { called++; throw new Error('synthetic failure'); } };
    await assert.rejects(handleGeminiGateway(input, { auth: { uid: 'user' } } as any, deps));
    assert.equal(called, 1); assert.equal(released, 1);
    await assert.rejects(handleGeminiGateway(input, { auth: { uid: 'user' } } as any, { ...deps, authorize: async () => { throw new Error('denied'); } }));
    assert.equal(called, 1);
});
