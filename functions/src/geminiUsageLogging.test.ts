import { strict as assert } from 'assert';
import { test } from 'node:test';
import * as functions from 'firebase-functions/v1';
import { trackedGeminiFetch } from './geminiUsageLogging';
import { GeminiProviderErrorDetails } from './geminiProviderError';

const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent';
const sensitive = 'synthetic-key-prompt-and-document';

test('all tracked Gemini menus receive sanitized provider errors with one request and one body read', async () => {
  for (const [status, expectedCode, reason] of [
    [402, 'failed-precondition', 'billing'],
    [429, 'resource-exhausted', 'rate-limit'],
    [403, 'permission-denied', 'permission'],
    [404, 'failed-precondition', 'model'],
  ] as const) {
    let requests = 0, bodyReads = 0;
    const request = async () => {
      requests++;
      return {
        ok: false, status,
        json: async () => {
          bodyReads++;
          assert.equal(bodyReads, 1, 'The provider body must not be consumed twice');
          return { error: { status: 'RESOURCE_EXHAUSTED', message: `${status === 402 ? 'Your prepayment credits are depleted. ' : ''}${sensitive}` } };
        },
        text: async () => { assert.fail('Legacy text parsers must not receive a rejected provider response'); },
      };
    };
    await assert.rejects(trackedGeminiFetch('document-analysis', request)(`${endpoint}?key=${sensitive}`), (error: unknown) => {
      assert.ok(error instanceof functions.https.HttpsError);
      assert.equal(error.code, expectedCode);
      const details = error.details as GeminiProviderErrorDetails;
      assert.equal(details.provider, 'gemini');
      assert.equal(details.providerStatus, status);
      assert.equal(details.reason, reason);
      if (status === 402) {
        assert.equal(details.billingReason, 'prepay-balance');
        assert.equal(details.retryable, false);
        assert.match(error.message, /선불 잔액 부족/);
      }
      assert.ok(!JSON.stringify(error.toJSON()).includes(sensitive));
      return true;
    });
    assert.equal(requests, 1, 'Provider failures must not trigger automatic retries');
    assert.equal(bodyReads, 1);
  }
});

test('tracked batch creation and status requests use the same provider classification', async () => {
  for (const url of [
    endpoint.replace(':generateContent', ':batchGenerateContent'),
    'https://generativelanguage.googleapis.com/v1beta/batches/synthetic-batch',
  ]) {
    await assert.rejects(trackedGeminiFetch('partner-recognition', async () => ({
      ok: false, status: 402, json: async () => ({ error: { message: 'Your prepayment credits are depleted.' } }),
    }))(url), (error: any) => error.code === 'failed-precondition' && error.details.billingReason === 'prepay-balance');
  }
});

test('successful JSON and text responses remain unchanged and unread until the menu consumes them', async () => {
  const payload = { candidates: [{ content: { parts: [{ text: 'synthetic result' }] } }], usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 2 } };
  for (const method of ['json', 'text'] as const) {
    let reads = 0;
    const original = { ok: true, status: 200,
      json: async () => { reads++; return payload; },
      text: async () => { reads++; return JSON.stringify(payload); },
    };
    const init = { method: 'POST', body: 'synthetic request' };
    const result = await trackedGeminiFetch('document-analysis', async (url, options) => {
      assert.equal(url, endpoint);
      assert.equal(options, init);
      return original;
    })(endpoint, init);
    assert.equal(result, original);
    assert.equal(reads, 0);
    assert.deepEqual(await result[method](), method === 'json' ? payload : JSON.stringify(payload));
    assert.equal(reads, 1);
  }
});

test('a missing batch is a missing job rather than an unavailable model', async () => {
  await assert.rejects(trackedGeminiFetch('partner-recognition', async () => ({
    ok: false, status: 404, json: async () => ({ error: { message: sensitive } }),
  }))('https://generativelanguage.googleapis.com/v1beta/batches/missing'), (error: unknown) => {
    assert.ok(error instanceof functions.https.HttpsError);
    assert.equal(error.code, 'not-found');
    assert.match(error.message, /일괄 분석 작업/);
    assert.doesNotMatch(error.message, /모델|synthetic/);
    return true;
  });
});

test('non-Gemini URLs and paths are forwarded without reading or reclassifying their failures', async () => {
  for (const url of [
    'https://example.test/v1beta/models/test:generateContent',
    'https://generativelanguage.googleapis.com.example.test/v1beta/models/test:generateContent',
    'http://generativelanguage.googleapis.com/v1beta/models/test:generateContent',
    'https://generativelanguage.googleapis.com:8443/v1beta/models/test:generateContent',
    'https://user@generativelanguage.googleapis.com/v1beta/models/test:generateContent',
    'https://generativelanguage.googleapis.com/v1beta-other/models/test:generateContent',
    'https://generativelanguage.googleapis.com/v1beta/files/test',
    'relative/path',
  ]) {
    const original = { ok: false, status: 402, json: async () => { assert.fail('Unrelated response must remain unread'); } };
    assert.equal(await trackedGeminiFetch('synthetic', async () => original)(url), original);
  }
});
