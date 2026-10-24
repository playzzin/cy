// Keep identical to functions/src/geminiUsage.ts; verified by the usage tests.
export const GEMINI_PRICING_URL = 'https://ai.google.dev/gemini-api/docs/pricing';
export const GEMINI_PRICING_VERSION = '2026-09-29';
export interface GeminiUsage {
  inputTokens: number | null;
  outputTokens: number | null;
  thinkingTokens: number;
  cachedTokens: number;
  totalTokens: number | null;
  imageOutputTokens: number | null;
}
export interface GeminiUsageEvent {
  model: string;
  feature: string;
  status: 'success' | 'failed' | 'blocked';
  usage: GeminiUsage;
  durationMs: number;
  errorCode: string;
  mode: 'standard' | 'batch';
}
export interface GeminiUsageLog extends GeminiUsageEvent {
  id: string;
  createdAt: string;
  actorUid: string;
  actorName: string;
  source: 'server' | 'browser' | 'development';
  path: string;
  estimatedUsd: number | null;
  priceStatus: 'estimated' | 'missing_usage' | 'unknown_model' | 'incomplete_usage';
  pricingVersion: string;
}
const token = (value: unknown): number | null => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 1e10 ? value : null;
export const readGeminiUsage = (metadata: any): GeminiUsage => ({
  inputTokens: token(metadata?.promptTokenCount), outputTokens: token(metadata?.candidatesTokenCount),
  thinkingTokens: token(metadata?.thoughtsTokenCount) ?? 0, cachedTokens: token(metadata?.cachedContentTokenCount) ?? 0,
  totalTokens: token(metadata?.totalTokenCount),
  imageOutputTokens: Array.isArray(metadata?.candidatesTokensDetails)
    ? metadata.candidatesTokensDetails.filter((item: any) => item?.modality === 'IMAGE').reduce((sum: number, item: any) => sum + (token(item.tokenCount) ?? 0), 0) : null,
});
export function estimateGeminiCost(model: string, usage: GeminiUsage, mode: 'standard' | 'batch' = 'standard', at = new Date()) {
  const unknown = (priceStatus: GeminiUsageLog['priceStatus']) => ({ estimatedUsd: null, priceStatus, pricingVersion: GEMINI_PRICING_VERSION });
  if (usage.inputTokens === null || usage.outputTokens === null) return unknown('missing_usage');
  const name = model.replace(/^models\//, '');
  let rates: [number, number, number, number?] | undefined;
  const promotional = at.getTime() < Date.parse('2027-01-01T00:00:00Z');
  if (['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash'].includes(name)) rates = promotional ? [0.75, 3.75, 0.075] : [1.5, 7.5, 0.15];
  if (name === 'gemini-3.5-flash') rates = [1.5, 9, 0.15];
  if (name === 'gemini-3.5-flash-lite') rates = [0.3, 2.5, 0.03];
  if (['gemini-3.1-pro-preview', 'gemini-3.1-pro-preview-customtools'].includes(name)) rates = usage.inputTokens > 200000 ? [4, 18, 0.4] : [2, 12, 0.2];
  if (['gemini-3.1-flash-image', 'gemini-3.1-flash-image-preview'].includes(name)) rates = [0.5, 3, 0, 60];
  if (!rates) return unknown('unknown_model');
  if (usage.cachedTokens > usage.inputTokens || (rates[3] && (usage.imageOutputTokens === null || usage.cachedTokens > 0))) return unknown('incomplete_usage');
  const imageTokens = usage.imageOutputTokens ?? 0;
  if (imageTokens > usage.outputTokens || (imageTokens > 0 && !rates[3])) return unknown('incomplete_usage');
  const factor = mode === 'batch' ? 0.5 : 1;
  // Pro Batch cache tokens retain the Standard rate; Flash-Lite Batch cache is $0.02.
  const cacheRate = mode === 'batch' && name.startsWith('gemini-3.1-pro') ? rates[2]
    : mode === 'batch' && name === 'gemini-3.5-flash-lite' ? 0.02 : rates[2] * factor;
  const usd = ((usage.inputTokens - usage.cachedTokens) * rates[0] * factor + usage.cachedTokens * cacheRate
    + (usage.outputTokens - imageTokens + usage.thinkingTokens) * rates[1] * factor + imageTokens * (rates[3] || 0) * factor) / 1e6;
  return { estimatedUsd: Math.round(usd * 1e9) / 1e9, priceStatus: 'estimated' as const, pricingVersion: GEMINI_PRICING_VERSION };
}
export function geminiEvent(model: string, feature: string, payload: any, durationMs: number, errorCode = '', mode: 'standard' | 'batch' = 'standard'): GeminiUsageEvent {
  const blocked = Boolean(payload?.promptFeedback?.blockReason) || ['SAFETY', 'RECITATION', 'BLOCKLIST', 'PROHIBITED_CONTENT'].includes(payload?.candidates?.[0]?.finishReason);
  return { model, feature, status: errorCode || payload?.error ? 'failed' : blocked ? 'blocked' : 'success',
    usage: readGeminiUsage(payload?.usageMetadata), durationMs, errorCode: errorCode || (payload?.error ? 'PROVIDER_ERROR' : ''), mode };
}

// Observe only metadata. Never persist a request body, key, prompt, or generated content.
// Reading through the original response methods avoids cloning large image payloads.
export function observeGeminiFetch(feature: string, request: (...args: any[]) => Promise<any>, write: (event: GeminiUsageEvent) => Promise<void>) {
  return async (url: any, init?: any): Promise<any> => {
    const match = String(url).match(/^https:\/\/generativelanguage\.googleapis\.com\/v1(?:beta)?\/models\/([^/:?]+):generateContent(?:\?|$)/);
    if (!match) return request(url, init);
    const model = decodeURIComponent(match[1]);
    const started = Date.now();
    let recorded = false;
    const record = async (payload: any, code = '') => {
      if (recorded) return;
      recorded = true;
      try { await write(geminiEvent(model, feature, payload, Date.now() - started, code)); }
      catch { /* Audit storage failures must not change the AI result. */ }
    };
    let response: any;
    try { response = await request(url, init); }
    catch (error) { await record(null, 'NETWORK_ERROR'); throw error; }
    if (!response.ok) { await record(null, `HTTP_${Number(response.status) || 0}`); return response; }
    for (const method of ['json', 'text'] as const) {
      if (typeof response[method] !== 'function') continue;
      const original = response[method].bind(response);
      response[method] = async () => {
        let value: any;
        try { value = await original(); }
        catch (error) { await record(null, 'RESPONSE_READ_ERROR'); throw error; }
        if (method === 'json') await record(value);
        else { let payload: any; try { payload = JSON.parse(value); } catch { /* Preserve the original body for its caller. */ } await record(payload, payload ? '' : 'INVALID_RESPONSE'); }
        return value;
      };
    }
    return response;
  };
}
