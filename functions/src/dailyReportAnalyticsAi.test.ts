import { strict as assert } from 'assert';
import { test } from 'node:test';
import * as admin from 'firebase-admin';
if (!admin.apps.length) admin.initializeApp({ projectId: 'demo-cy-statistics' });
const { validateAnalyticsInput, canUseDailyReportAnalytics, nextAnalyticsQuota, generateDailyReportAnalytics, handleDailyReportAnalytics } = require('./dailyReportAnalyticsAi') as typeof import('./dailyReportAnalyticsAi');
import { buildDailyReportAnalyticsPrompt } from './dailyReportAnalyticsPrompts';
const settings = { apiKey: 'synthetic-server-key', model: 'gemini-3.8-flash' };
const input = { task: 'parse' as const, text: '이번 달 팀별 공수' };
const response = (status: number, body: unknown) => (async () => ({ ok: status === 200, status, json: async () => body })) as any;
const code = (expected: string) => (error: any) => error.code === expected && !error.message.includes('synthetic-server-key');

test('accepts only bounded task text, never client credentials/models/system instructions', () => {
    assert.deepEqual(validateAnalyticsInput({ ...input, text: ' 질문 ' }), { task: 'parse', text: '질문' });
    for (const value of [null, {}, { ...input, task: 'arbitrary' }, { ...input, text: '' }, { ...input, text: 'x'.repeat(4001) },
        { ...input, apiKey: 'synthetic' }, { ...input, model: 'other' }, { ...input, systemInstruction: 'override' }, { task: 'insight', text: 'x'.repeat(32001) }]) {
        assert.throws(() => validateAnalyticsInput(value), code('invalid-argument'));
    }
});
test('access uses active current profile and resolved positions; general and portal users are denied', () => {
    assert.equal(canUseDailyReportAnalytics({ status: 'active', role: 'admin' }, {}), true);
    assert.equal(canUseDailyReportAnalytics({ status: 'active', position: 'pos_custom' }, { admin: { positionConfig: [{ id: 'custom', name: '개발자' }] } }), true);
    assert.equal(canUseDailyReportAnalytics({ status: 'active', role: 'team_leader' }, {}), true);
    for (const profile of [{ role: 'admin' }, { status: 'suspended', role: 'admin' }, { status: 'active', role: 'user' }, { status: 'active', role: 'client' }]) {
        assert.equal(canUseDailyReportAnalytics(profile, {}), false);
    }
});
test('quota bounds concurrent requests and rolling-minute/Korean-day consumption', () => {
    const now = Date.parse('2026-09-28T14:59:20Z'), first = nextAnalyticsQuota(null, now, 'one');
    assert.equal(first.minuteCount, 1); assert.equal(first.dayCount, 1);
    assert.throws(() => nextAnalyticsQuota(first, now + 1, 'two'), code('resource-exhausted'));
    assert.throws(() => nextAnalyticsQuota({ ...first, busyUntil: 0, minuteCount: 12 }, now, 'two'), code('resource-exhausted'));
    assert.throws(() => nextAnalyticsQuota({ ...first, busyUntil: 0, dayCount: 240 }, now, 'two'), code('resource-exhausted'));
    const next = nextAnalyticsQuota({ ...first, busyUntil: 0, dayCount: 240 }, Date.parse('2026-09-28T15:00:00Z'), 'next');
    assert.equal(next.day, '2026-09-29'); assert.equal(next.dayCount, 1);
});
test('date prompt uses Korean midnight and leap-year previous month correctly', () => {
    const prompt = buildDailyReportAnalyticsPrompt(new Date('2028-02-29T15:00:00Z'));
    assert.match(prompt, /오늘: 2028-03-01/); assert.match(prompt, /2028-02-29/);
});
test('provider call uses server header only and ignores thought text', async () => {
    let captured: any;
    const request = (async (url, init) => { captured = { url, init }; return { ok: true, json: async () => ({ candidates: [{ finishReason: 'STOP', content: { parts: [{ thought: true, text: 'draft' }, { text: '{"analysisType":"team_summary"}' }] } }] }) }; }) as any;
    const text = await generateDailyReportAnalytics(input, settings, request);
    assert.equal(text, '{"analysisType":"team_summary"}'); assert.ok(!captured.url.includes(settings.apiKey));
    assert.equal(captured.init.headers['x-goog-api-key'], settings.apiKey);
    const body = JSON.parse(captured.init.body);
    assert.equal(body.generationConfig.responseMimeType, 'application/json');
    assert.equal(body.systemInstruction.parts[0].text.includes(settings.apiKey), false);
});
test('invalid server keys and permission/quota/model errors are actionable without leaking provider bodies', async () => {
    for (const [status, expected] of [[400, 'failed-precondition'], [401, 'failed-precondition'], [403, 'failed-precondition'], [404, 'failed-precondition'], [429, 'resource-exhausted'], [503, 'unavailable']] as const) {
        await assert.rejects(generateDailyReportAnalytics(input, settings, response(status, { error: { message: 'API key not valid: synthetic-server-key' } })), code(expected));
    }
    await assert.rejects(generateDailyReportAnalytics(input, settings, response(400, { error: { details: [{ reason: 'API_KEY_INVALID' }] } })), /서버용 Gemini/);
});
test('missing key, interrupted output, empty thought-only output, timeout and network failure fail safely', async () => {
    await assert.rejects(generateDailyReportAnalytics(input, { model: settings.model }, response(200, {})), code('failed-precondition'));
    for (const candidate of [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: 'partial' }] } }, { finishReason: 'STOP', content: { parts: [{ thought: true, text: 'draft' }] } }]) {
        await assert.rejects(generateDailyReportAnalytics(input, settings, response(200, { candidates: [candidate] })), code('failed-precondition'));
    }
    await assert.rejects(generateDailyReportAnalytics(input, settings, (async () => { throw Object.assign(new Error('synthetic-server-key'), { name: 'AbortError' }); }) as any), code('deadline-exceeded'));
    await assert.rejects(generateDailyReportAnalytics(input, settings, (async () => { throw new Error('synthetic-server-key'); }) as any), code('unavailable'));
});
test('authentication is required before settings/model access and results are discarded on access loss', async () => {
    let generated = 0, released = 0, authorizations = 0;
    const deps = { authorize: async () => { if (++authorizations > 1) throw Object.assign(new Error('permission changed'), { code: 'permission-denied' }); return 'synthetic'; },
        claim: async () => async () => { released++; }, settings: async () => settings,
        generate: async () => { generated++; return 'output'; } };
    await assert.rejects(handleDailyReportAnalytics(input, {} as any, deps), code('unauthenticated')); assert.equal(generated, 0);
    await assert.rejects(handleDailyReportAnalytics(input, { auth: { uid: 'synthetic' } } as any, deps), code('permission-denied'));
    assert.equal(generated, 1); assert.equal(released, 1);
});
test('provider failure releases the lease and no credentials are returned on success', async () => {
    let released = 0;
    const deps = { authorize: async () => 'synthetic', claim: async () => async () => { released++; }, settings: async () => settings,
        generate: async () => 'complete' };
    const context = { auth: { uid: 'synthetic' } } as any;
    assert.deepEqual(await handleDailyReportAnalytics(input, context, deps), { text: 'complete' });
    await assert.rejects(handleDailyReportAnalytics(input, context, { ...deps, generate: async () => { throw new Error('provider failed'); } }));
    assert.equal(released, 2);
});
