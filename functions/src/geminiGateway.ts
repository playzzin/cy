import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';
import { randomUUID } from 'crypto';
import { requireCallableAuth } from './auth';
import { canUseDailyReportAnalytics } from './dailyReportAnalyticsAi';
import { getServerGeminiSettings } from './serverAiSettings';
import { DEFAULT_GEMINI_IMAGE_MODEL } from './geminiModelPolicy';
import { trackedGeminiFetch, withGeminiUsageContext } from './geminiUsageLogging';

const FEATURES = new Set(['document-analysis', 'image-generation', 'drawing-estimate', 'analytics-agent', 'agent-orchestrator', 'tax-invoice-import', 'manpower-search']);
const MAX_BYTES = 8 * 1024 * 1024;
const fail = (code: functions.https.FunctionsErrorCode, message: string): never => { throw new functions.https.HttpsError(code, message); };
type Input = { feature: string; body: Record<string, any> };

export function validateGatewayInput(value: any): Input {
    if (!value || !FEATURES.has(value.feature) || !value.body || Array.isArray(value.body)
        || Object.keys(value).some(key => !['feature', 'body'].includes(key))
        || Buffer.byteLength(JSON.stringify(value)) > MAX_BYTES) return fail('invalid-argument', 'AI 요청 형식과 파일 크기(전체 8MB 이하)를 확인해 주세요.');
    const body = value.body;
    if (Object.keys(body).some(key => !['contents', 'generationConfig', 'systemInstruction'].includes(key))
        || !Array.isArray(body.contents) || !body.contents.length || body.contents.length > 20) return fail('invalid-argument', '지원하지 않는 AI 요청입니다.');
    const parts = [...body.contents, ...(body.systemInstruction ? [body.systemInstruction] : [])];
    for (const content of parts) {
        if (!content || (content.role && !['user', 'model', 'system'].includes(content.role))
            || !Array.isArray(content.parts) || !content.parts.length || content.parts.length > 40
            || Object.keys(content).some(key => !['role', 'parts'].includes(key))) return fail('invalid-argument', 'AI 입력 내용을 확인해 주세요.');
        for (const part of content.parts) {
            if (!part || Object.keys(part).length !== 1) return fail('invalid-argument', 'AI 입력 형식이 올바르지 않습니다.');
            if (typeof part.text === 'string' && part.text.length <= 200000) continue;
            const data = part.inlineData;
            if (!data || !['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'].includes(data.mimeType)
                || typeof data.data !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(data.data)
                || Object.keys(data).some(key => !['mimeType', 'data'].includes(key))) return fail('invalid-argument', '지원하는 이미지 또는 PDF를 첨부해 주세요.');
        }
    }
    const config = body.generationConfig || {};
    if (typeof config !== 'object' || Array.isArray(config) || Object.keys(config).some(key => ![
        'temperature', 'topP', 'topK', 'maxOutputTokens', 'responseMimeType', 'responseJsonSchema', 'responseSchema', 'responseModalities', 'thinkingConfig', 'imageConfig',
    ].includes(key))) return fail('invalid-argument', '지원하지 않는 AI 생성 설정입니다.');
    if (config.responseModalities && (!Array.isArray(config.responseModalities) || config.responseModalities.some((item: unknown) => !['TEXT', 'IMAGE'].includes(String(item))))) return fail('invalid-argument', '생성 형식을 확인해 주세요.');
    if (value.feature !== 'image-generation' && (config.responseModalities?.some((item: string) => item !== 'TEXT') || config.imageConfig)) return fail('invalid-argument', '이미지 생성은 이미지 도구에서 요청해 주세요.');
    return { feature: value.feature, body: { ...body, generationConfig: { ...config, candidateCount: 1,
        maxOutputTokens: Math.min(8192, Math.max(1, Number(config.maxOutputTokens) || 8192)) } } };
}

export function nextGatewayQuota(previous: any, now: number, id: string, image: boolean) {
    const minute = Math.floor(now / 60000);
    const day = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date(now));
    const leases = (Array.isArray(previous?.leases) ? previous.leases : []).filter((lease: any) => Number(lease.until) > now);
    const minuteCount = previous?.minute === minute ? Number(previous.minuteCount) || 0 : 0;
    const dayCount = previous?.day === day ? Number(previous.dayCount) || 0 : 0;
    const imageCount = previous?.day === day ? Number(previous.imageCount) || 0 : 0;
    if (leases.length >= 3 || minuteCount >= 20 || dayCount >= 300 || (image && imageCount >= 30)) return fail('resource-exhausted', 'AI 사용 한도에 도달했습니다. 진행 중인 작업이 끝난 뒤 다시 시도하거나 관리자에게 확인해 주세요.');
    return { minute, day, minuteCount: minuteCount + 1, dayCount: dayCount + 1, imageCount: imageCount + (image ? 1 : 0), leases: [...leases, { id, until: now + 180000 }] };
}

async function authorize(context: functions.https.CallableContext) {
    const { uid } = requireCallableAuth(context);
    const [account, profile, menu] = await Promise.all([admin.auth().getUser(uid), admin.firestore().doc(`users/${uid}`).get(), admin.firestore().doc('settings/menus_v12').get()]);
    if (account.disabled || !canUseDailyReportAnalytics(profile.data(), menu.data())) return fail('permission-denied', '활성 업무 계정의 AI 사용 권한을 확인해 주세요.');
    return uid;
}
async function claim(uid: string, image: boolean) {
    const db = admin.firestore(), ref = db.doc(`server_settings/ai/gateway_usage/${uid}`), id = randomUUID();
    await db.runTransaction(async transaction => {
        const snapshot = await transaction.get(ref);
        transaction.set(ref, nextGatewayQuota(snapshot.data(), Date.now(), id, image));
    });
    return async () => db.runTransaction(async transaction => {
        const snapshot = await transaction.get(ref);
        transaction.update(ref, { leases: (snapshot.data()?.leases || []).filter((lease: any) => lease.id !== id) });
    });
}

export async function generateGatewayContent(input: Input, settings: Awaited<ReturnType<typeof getServerGeminiSettings>>, request: typeof fetch = fetch) {
    if (!settings.apiKey) return fail('failed-precondition', 'AI 설정에서 서버용 Gemini 키를 등록해 주세요.');
    const model = input.feature === 'image-generation' ? DEFAULT_GEMINI_IMAGE_MODEL
        : ['document-analysis', 'tax-invoice-import', 'drawing-estimate'].includes(input.feature) ? settings.documentModel : settings.model;
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 120000);
    try {
        const response = await trackedGeminiFetch(input.feature, request)(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
            method: 'POST', signal: controller.signal,
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': settings.apiKey }, body: JSON.stringify(input.body),
        });
        if (!response.ok) return fail(response.status === 429 ? 'resource-exhausted' : 'unavailable', 'AI 서버 요청을 처리하지 못했습니다. 서버 설정과 사용 한도를 확인해 주세요.');
        const payload = await response.json();
        if (payload?.error || Buffer.byteLength(JSON.stringify(payload)) > MAX_BYTES) return fail('unavailable', 'AI 응답을 확인하지 못했습니다. 입력을 나누어 다시 시도해 주세요.');
        return { candidates: payload.candidates || [], usageMetadata: payload.usageMetadata || null, promptFeedback: payload.promptFeedback || null };
    } catch (error) {
        if (error instanceof functions.https.HttpsError) throw error;
        return fail(controller.signal.aborted ? 'deadline-exceeded' : 'unavailable', 'AI 서버 연결이 지연되고 있습니다. 잠시 후 다시 시도해 주세요.');
    } finally { clearTimeout(timeout); }
}
const defaults = { authorize, claim, settings: getServerGeminiSettings, generate: generateGatewayContent };
export async function handleGeminiGateway(value: unknown, context: functions.https.CallableContext, overrides: Partial<typeof defaults> = {}) {
    requireCallableAuth(context);
    const input = validateGatewayInput(value), deps = { ...defaults, ...overrides }, uid = await deps.authorize(context);
    const release = await deps.claim(uid, input.feature === 'image-generation');
    try {
        const result = await deps.generate(input, await deps.settings());
        if (await deps.authorize(context) !== uid) return fail('permission-denied', '계정 권한이 변경되었습니다.');
        return result;
    } finally { await release().catch(() => functions.logger.warn('gemini-gateway-lease-release-failed')); }
}
export const geminiGateway = functions.runWith({ timeoutSeconds: 180, memory: '512MB', maxInstances: 5 }).region('asia-northeast3')
    .https.onCall(withGeminiUsageContext((value, context) => handleGeminiGateway(value, context)));
