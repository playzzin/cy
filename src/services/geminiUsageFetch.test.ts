import { trackedGeminiFetch } from './geminiUsageFetch';
import { requestGeminiContent } from './geminiGatewayClient';
jest.mock('./geminiGatewayClient', () => ({ requestGeminiContent: jest.fn() }));
beforeEach(() => jest.clearAllMocks());
test('AI requests use the authenticated server, never browser provider fetch or keys', async () => {
    const provider = jest.fn();
    (requestGeminiContent as jest.Mock).mockResolvedValue({ candidates: [] });
    const body = { contents: [{ parts: [{ text: 'synthetic' }] }] };
    const response = await trackedGeminiFetch('document-analysis', provider)('https://generativelanguage.googleapis.com/v1beta/models/test:generateContent?key=synthetic-old-key', {
        method: 'POST', headers: { 'x-goog-api-key': 'synthetic-old-key' }, body: JSON.stringify(body),
    });
    expect(provider).not.toHaveBeenCalled();
    expect(requestGeminiContent).toHaveBeenCalledWith('document-analysis', body, undefined);
    expect(await response.json()).toEqual({ candidates: [] });
});
test('ordinary image downloads retain their original transport', async () => {
    const download = jest.fn().mockResolvedValue('image');
    expect(await trackedGeminiFetch('image-generation', download)('https://example.org/image.png')).toBe('image');
});

test('provider failures keep their safe error identity and never retry with a browser key', async () => {
    const failure = Object.assign(new Error('synthetic sanitized billing message'), {
        provider: 'gemini', providerStatus: 429, reason: 'billing', retryable: false, billingReason: 'spend-cap',
    });
    (requestGeminiContent as jest.Mock).mockRejectedValue(failure);
    const provider = jest.fn();
    const controller = new AbortController();
    await expect(trackedGeminiFetch('tax-invoice-import', provider)(
        'https://generativelanguage.googleapis.com/v1beta/models/test:generateContent?key=synthetic-old-key',
        { body: '{}', signal: controller.signal },
    )).rejects.toBe(failure);
    expect(requestGeminiContent).toHaveBeenCalledTimes(1);
    expect(requestGeminiContent).toHaveBeenCalledWith('tax-invoice-import', {}, controller.signal);
    expect(provider).not.toHaveBeenCalled();
});
