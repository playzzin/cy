import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';
import { requireCallableAdmin, requireCallableAuth } from './auth';
import { GeminiUsageEvent, readGeminiUsage } from './geminiUsage';
import { saveGeminiUsage } from './geminiUsageLogging';

const region = functions.runWith({ timeoutSeconds: 30, memory: '256MB', maxInstances: 10 }).region('asia-northeast3');
export function validateClientUsage(data: any): GeminiUsageEvent {
  if (!/^[a-zA-Z0-9_-]{16,100}$/.test(String(data?.requestId || '')) || !/^gemini-[a-zA-Z0-9._-]{1,90}$/.test(String(data?.model || ''))
    || !/^[a-zA-Z0-9_-]{1,80}$/.test(String(data?.feature || '')) || !['success', 'failed', 'blocked'].includes(data?.status))
    throw new functions.https.HttpsError('invalid-argument', '사용량 기록 형식을 확인해 주세요.');
  const u = data.usage || {};
  const usage = readGeminiUsage({ promptTokenCount: u.inputTokens, candidatesTokenCount: u.outputTokens, thoughtsTokenCount: u.thinkingTokens,
    cachedContentTokenCount: u.cachedTokens, totalTokenCount: u.totalTokens,
    ...(typeof u.imageOutputTokens === 'number' ? { candidatesTokensDetails: [{ modality: 'IMAGE', tokenCount: u.imageOutputTokens }] } : {}) });
  return { model: data.model, feature: data.feature, status: data.status, usage, mode: 'standard',
    durationMs: Math.min(600000, Math.max(0, Number(data.durationMs) || 0)), errorCode: /^(HTTP_\d{1,3}|NETWORK_ERROR|RESPONSE_READ_ERROR|INVALID_RESPONSE|PROVIDER_ERROR)$/.test(data.errorCode) ? data.errorCode : '' };
}
export const recordGeminiClientUsage = region.https.onCall(async (data, context) => {
  const auth = requireCallableAuth(context);
  const event = validateClientUsage(data);
  const saved = await saveGeminiUsage(event, { id: `browser:${auth.uid}:${data.requestId}`, source: 'browser',
    actor: { uid: auth.uid, name: String(auth.token.name || auth.token.email || '').slice(0, 160) },
    path: typeof data.path === 'string' && data.path.startsWith('/') ? data.path.split(/[?#]/)[0].slice(0, 200) : '' });
  if (!saved) throw new functions.https.HttpsError('unavailable', '사용량 기록을 저장하지 못했습니다.');
  return { saved };
});
export function usageDateRange(data: any) {
  const start = Date.parse(`${data?.startDate}T00:00:00+09:00`), end = Date.parse(`${data?.endDate}T00:00:00+09:00`) + 86400000;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data?.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(data?.endDate) || !Number.isFinite(start + end) || end <= start || end - start > 366 * 86400000)
    throw new functions.https.HttpsError('invalid-argument', '조회 기간은 1일부터 366일까지 선택해 주세요.');
  return { start, end };
}
export const listGeminiUsageLogs = region.https.onCall(async (data, context) => {
  await requireCallableAdmin(context);
  const { start, end } = usageDateRange(data);
  let query = admin.firestore().collection('gemini_usage_logs')
    .where('createdAt', '>=', admin.firestore.Timestamp.fromMillis(start)).where('createdAt', '<', admin.firestore.Timestamp.fromMillis(end))
    .orderBy('createdAt', 'desc').orderBy(admin.firestore.FieldPath.documentId(), 'desc').limit(201);
  if (data?.cursor) {
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(data.cursor.id) || !Number.isSafeInteger(data.cursor.seconds) || !Number.isInteger(data.cursor.nanoseconds) || data.cursor.nanoseconds < 0 || data.cursor.nanoseconds >= 1e9)
      throw new functions.https.HttpsError('invalid-argument', '조회 위치를 확인해 주세요.');
    query = query.startAfter(new admin.firestore.Timestamp(data.cursor.seconds, data.cursor.nanoseconds), data.cursor.id);
  }
  const snapshot = await query.get(), docs = snapshot.docs.slice(0, 200), last = docs[docs.length - 1];
  const time = last?.get('createdAt') as admin.firestore.Timestamp | undefined;
  return { logs: docs.map(doc => ({ ...doc.data(), id: doc.id, createdAt: doc.get('createdAt').toDate().toISOString() })),
    nextCursor: snapshot.docs.length > 200 && time ? { id: last.id, seconds: time.seconds, nanoseconds: time.nanoseconds } : null };
});
