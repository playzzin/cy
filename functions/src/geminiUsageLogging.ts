import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash } from 'node:crypto';
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';
import { estimateGeminiCost, GeminiUsageEvent, observeGeminiFetch } from './geminiUsage';

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
export const trackedGeminiFetch = (feature: string, request: (...args: any[]) => Promise<any> = fetch) =>
  observeGeminiFetch(feature, request, async event => { await saveGeminiUsage(event); });
