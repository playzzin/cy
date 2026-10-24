import { requestGeminiContent } from './geminiGatewayClient';

export const trackedGeminiFetch = (feature: string, request: (...args: any[]) => Promise<any> = (url, init) => fetch(url, init)) =>
  async (url: string, init?: RequestInit): Promise<any> => {
    if (!/^https:\/\/generativelanguage\.googleapis\.com\/v1(?:beta)?\/models\/[^/:?]+:generateContent(?:\?|$)/.test(url)) return request(url, init);
    // Credentials, URLs and client model choices never cross the server boundary.
    // Usage is recorded once by the server alongside the authenticated caller.
    const payload = await requestGeminiContent(feature, JSON.parse(String(init?.body || '{}')), init?.signal || undefined);
    return { ok: true, status: 200, statusText: 'OK', json: async () => payload, text: async () => JSON.stringify(payload) };
  };
