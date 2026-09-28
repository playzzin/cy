import { estimateGeminiCost, geminiEvent, observeGeminiFetch, readGeminiUsage } from './geminiUsage';
const now = new Date('2026-09-29T00:00:00Z');
const usage = readGeminiUsage({ promptTokenCount: 1000, candidatesTokenCount: 200, thoughtsTokenCount: 100, cachedContentTokenCount: 400, totalTokenCount: 1300 });
const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=synthetic-secret';

it('bills cached input once and includes thinking at the output rate', () => {
  expect(estimateGeminiCost('gemini-3.8-flash', usage, 'standard', now).estimatedUsd).toBeCloseTo(0.001605, 9);
  expect(estimateGeminiCost('gemini-3.8-flash', usage, 'batch', now).estimatedUsd).toBeCloseTo(0.0008025, 9);
  expect(estimateGeminiCost('gemini-3.8-flash', usage, 'standard', new Date('2027-01-01T00:00:00Z')).estimatedUsd).toBeCloseTo(0.00321, 9);
});
it('applies the long-context Pro rate to both input and output, and the Batch cache exception', () => {
  const long = { ...usage, inputTokens: 200001, cachedTokens: 0 };
  expect(estimateGeminiCost('gemini-3.1-pro-preview', long, 'standard', now).estimatedUsd).toBeCloseTo((200001 * 4 + 300 * 18) / 1e6, 9);
  expect(estimateGeminiCost('gemini-3.1-pro-preview', usage, 'batch', now).estimatedUsd).toBeCloseTo((600 + 400 * 0.2 + 300 * 6) / 1e6, 9);
});
it('prices image tokens separately and refuses an image estimate without modality metadata', () => {
  const image = { ...usage, inputTokens: 100, cachedTokens: 0, outputTokens: 1130, imageOutputTokens: 1120 };
  expect(estimateGeminiCost('gemini-3.1-flash-image', image, 'standard', now).estimatedUsd).toBeCloseTo((100 * 0.5 + 110 * 3 + 1120 * 60) / 1e6, 9);
  expect(estimateGeminiCost('gemini-3.1-flash-image', { ...image, imageOutputTokens: null }, 'standard', now).estimatedUsd).toBeNull();
});
it('keeps unknown prices and absent usage distinct from a measured zero', () => {
  expect(estimateGeminiCost('gemini-future', usage, 'standard', now).priceStatus).toBe('unknown_model');
  expect(estimateGeminiCost('gemini-3.8-flash', readGeminiUsage(null), 'standard', now).priceStatus).toBe('missing_usage');
  expect(estimateGeminiCost('gemini-3.8-flash', readGeminiUsage({ promptTokenCount: 0, candidatesTokenCount: 0 }), 'standard', now).estimatedUsd).toBe(0);
  expect(readGeminiUsage({ promptTokenCount: -1, candidatesTokenCount: Infinity }).inputTokens).toBeNull();
});
it.each(['json', 'text'] as const)('records %s responses without storing private content or changing their value', async method => {
  const body = { usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 20 }, candidates: [{ content: { parts: [{ text: 'private-response' }] } }] };
  const original = method === 'json' ? body : JSON.stringify(body);
  const request = jest.fn(async () => ({ ok: true, [method]: async () => original })), write = jest.fn(async () => undefined);
  const response = await observeGeminiFetch('document-analysis', request, write)(url, { body: 'private-prompt' });
  expect(await response[method]()).toEqual(original);
  expect(write).toHaveBeenCalledTimes(1);
  expect(write).toHaveBeenCalledWith(expect.objectContaining({ model: 'gemini-3.8-flash', usage: expect.objectContaining({ inputTokens: 100 }) }));
  expect(JSON.stringify(write.mock.calls)).not.toMatch(/private|synthetic-secret/);
});
it('records provider and network failures even when no response body is consumed', async () => {
  const write = jest.fn(async () => undefined);
  await observeGeminiFetch('test', async () => ({ ok: false, status: 429 }), write)(url);
  expect(write).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'failed', errorCode: 'HTTP_429' }));
  const error = new Error('private-network-detail');
  await expect(observeGeminiFetch('test', async () => { throw error; }, write)(url)).rejects.toBe(error);
  expect(write).toHaveBeenLastCalledWith(expect.objectContaining({ errorCode: 'NETWORK_ERROR' }));
});
it('keeps generation working when audit persistence fails and ignores unrelated downloads', async () => {
  const write = jest.fn(async () => { throw new Error('storage unavailable'); });
  const request = async () => ({ ok: true, json: async () => ({ usageMetadata: {} }) });
  await expect((await observeGeminiFetch('test', request, write)(url)).json()).resolves.toEqual({ usageMetadata: {} });
  write.mockClear();
  await observeGeminiFetch('test', request, write)('https://example.test/image.png');
  expect(write).not.toHaveBeenCalled();
});
it('distinguishes blocked provider responses', () => {
  expect(geminiEvent('gemini-3.8-flash', 'test', { promptFeedback: { blockReason: 'SAFETY' } }, 1).status).toBe('blocked');
});
