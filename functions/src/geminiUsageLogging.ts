import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash } from 'node:crypto';
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';
import { estimateGeminiCost, GeminiUsageEvent, observeGeminiFetch } from './geminiUsage';
import { geminiProviderError } from './geminiProviderError';

type Actor = { uid: string; name: string };
const actors = new AsyncLocalStorage<Actor>();
export const withGeminiActor = <T>(actor: Actor, work: () => T): T => actors.run(actor, work);
export function withGeminiUsageContext<T, R>(handler: (data: T, context: functions.https.CallableContext) => R) {
  return (data: T, context: functions.https.CallableContext): R => actors.run({ uid: context.auth?.uid || '',
    name: String(context.auth?.token?.name || context.auth?.token?.email || '').slice(0, 160) }, () => handler(data, context));
}
export async function saveGeminiUsage(event: GeminiUsageEvent, options: { id?: string; actor?: Actor; source?: 'server' | 'browser'; path?: string } = {}) {
  // Pure request/response unit tests do not initialize Firebase Admin.
  if (!admin.apps.length) return false;
  if (String(admin.app().options.projectId || '').startsWith('demo-') && !process.env.FIRESTORE_EMULATOR_HOST) return false;
  const actor = options.actor || actors.getStore() || { uid: '', name: '서버 작업' };
  const now = new Date();
  const row = { ...event, ...estimateGeminiCost(event.model, event.usage, event.mode, now), actorUid: actor.uid,
    actorName: actor.name, source: options.source || 'server', path: options.path || '', createdAt: admin.firestore.Timestamp.fromDate(now) };
  try {
    const collection = admin.firestore().collection('gemini_usage_logs');
    if (options.id) await collection.doc(createHash('sha256').update(options.id).digest('hex')).create(row);
    else await collection.add(row);
    return true;
  } catch (error) {
    if ((error as { code?: number }).code === 6) return true;
    functions.logger.warn('gemini-usage-log-write-failed');
    return false;
  }
}
const isGeminiRequest = (input: unknown): boolean => {
  try {
    const url = new URL(String(input));
    return url.origin === 'https://generativelanguage.googleapis.com'
      && !url.username && !url.password
      && /^\/v1beta\/(?:models|batches)\//.test(url.pathname);
  } catch { return false; }
};

export const trackedGeminiFetch = (feature: string, request: (...args: any[]) => Promise<any> = fetch) => {
  const observed = observeGeminiFetch(feature, request, async event => { await saveGeminiUsage(event); });
  return async (url: any, init?: any): Promise<any> => {
    const response = await observed(url, init);
    // Record the original HTTP status before interpreting the provider body. All
    // menu callers receive the same safe error, including legacy text parsers.
    if (!response.ok && isGeminiRequest(url)) {
      if (response.status === 404 && new URL(String(url)).pathname.startsWith('/v1beta/batches/')) {
        throw new functions.https.HttpsError('not-found', 'Gemini 일괄 분석 작업을 찾을 수 없습니다. 작업이 만료되었거나 삭제되었는지 확인하고 새 분석을 시작해 주세요.');
      }
      throw await geminiProviderError(response);
    }
    return response;
  };
};
