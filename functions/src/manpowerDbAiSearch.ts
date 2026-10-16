import * as functions from 'firebase-functions/v1';
import { requireCallableAuth } from './auth';
import { getServerGeminiSettings } from './serverAiSettings';

const ENTITIES = [
    'worker',
    'team',
    'site',
    'company',
    'account',
    'integrity',
    'support',
    'mixed',
] as const;

const INTENTS = [
    'lookup',
    'list',
    'relation',
    'missing_field',
    'status',
    'recent_activity',
    'duplicate',
    'data_quality',
    'trend',
    'comparison',
] as const;

const SUPPORT_DIRECTIONS = ['외부지원간곳', '외부지원온곳', '내부지원간곳', '내부지원온곳'] as const;
const SUPPORT_SCOPES = ['외부', '내부'] as const;
const SUPPORT_FLOW_TYPES = ['간곳', '온곳'] as const;
const ALLOWED_MISSING_FIELDS = new Set([
    'accountNumber',
    'teamId',
    'teamName',
    'responsibleTeamId',
    'responsibleTeamName',
]);
const MAX_QUESTION_LENGTH = 500;

type Entity = typeof ENTITIES[number];
type Intent = typeof INTENTS[number];

interface DateRange {
    startDate: string;
    endDate: string;
}

interface SearchFilters {
    keyword?: string;
    name?: string;
    teamName?: string;
    siteName?: string;
    companyName?: string;
    status?: string;
    missingFields?: string[];
    dateRange?: DateRange;
    compareDateRange?: DateRange;
    supportDirection?: typeof SUPPORT_DIRECTIONS[number];
    supportScope?: typeof SUPPORT_SCOPES[number];
    supportFlowType?: typeof SUPPORT_FLOW_TYPES[number];
}

interface SearchQuery {
    domain: 'manpower_db';
    entity: Entity;
    intent: Intent;
    filters: SearchFilters;
    limit?: number;
    confidence?: number;
    clarificationNeeded?: boolean;
}

const RESPONSE_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    properties: {
        domain: { type: 'string', enum: ['manpower_db'] },
        entity: { type: 'string', enum: [...ENTITIES] },
        intent: { type: 'string', enum: [...INTENTS] },
        filters: {
            type: 'object',
            additionalProperties: false,
            properties: {
                keyword: { type: 'string' },
                name: { type: 'string' },
                teamName: { type: 'string' },
                siteName: { type: 'string' },
                companyName: { type: 'string' },
                status: { type: 'string' },
                missingFields: {
                    type: 'array',
                    items: {
                        type: 'string',
                        enum: [...ALLOWED_MISSING_FIELDS],
                    },
                    maxItems: 5,
                },
                dateRange: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        startDate: { type: 'string', format: 'date' },
                        endDate: { type: 'string', format: 'date' },
                    },
                    required: ['startDate', 'endDate'],
                },
                compareDateRange: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        startDate: { type: 'string', format: 'date' },
                        endDate: { type: 'string', format: 'date' },
                    },
                    required: ['startDate', 'endDate'],
                },
                supportDirection: { type: 'string', enum: [...SUPPORT_DIRECTIONS] },
                supportScope: { type: 'string', enum: [...SUPPORT_SCOPES] },
                supportFlowType: { type: 'string', enum: [...SUPPORT_FLOW_TYPES] },
            },
        },
        limit: { type: 'integer', minimum: 1, maximum: 50 },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
        clarificationNeeded: { type: 'boolean' },
    },
    required: ['domain', 'entity', 'intent', 'filters', 'limit', 'confidence', 'clarificationNeeded'],
};

const asRecord = (value: unknown): Record<string, unknown> =>
    value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {};

const asBoundedString = (value: unknown, maxLength = 120): string | undefined => {
    const normalized = String(value ?? '').trim().replace(/[\u0000-\u001f\u007f]/g, ' ');
    return normalized ? normalized.slice(0, maxLength) : undefined;
};

const asEnum = <T extends readonly string[]>(value: unknown, values: T): T[number] | undefined => {
    const normalized = String(value ?? '').trim();
    return values.includes(normalized as T[number]) ? normalized as T[number] : undefined;
};

const asDateRange = (value: unknown): DateRange | undefined => {
    const record = asRecord(value);
    const startDate = asBoundedString(record.startDate, 10);
    const endDate = asBoundedString(record.endDate, 10);
    if (!startDate || !endDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
        return undefined;
    }
    if (startDate > endDate) return undefined;
    return { startDate, endDate };
};

const sanitizeQuery = (value: unknown): SearchQuery => {
    const record = asRecord(value);
    const entity = asEnum(record.entity, ENTITIES);
    const intent = asEnum(record.intent, INTENTS);
    if (record.domain !== 'manpower_db' || !entity || !intent) {
        throw new functions.https.HttpsError('internal', 'Gemini 검색계획 형식이 올바르지 않습니다.');
    }

    const rawFilters = asRecord(record.filters);
    const filters: SearchFilters = {};
    (['keyword', 'name', 'teamName', 'siteName', 'companyName', 'status'] as const).forEach((key) => {
        const next = asBoundedString(rawFilters[key]);
        if (next) filters[key] = next;
    });

    if (Array.isArray(rawFilters.missingFields)) {
        const missingFields = Array.from(new Set(
            rawFilters.missingFields
                .map((field) => String(field || '').trim())
                .filter((field) => ALLOWED_MISSING_FIELDS.has(field))
        )).slice(0, 5);
        if (missingFields.length > 0) filters.missingFields = missingFields;
    }

    const dateRange = asDateRange(rawFilters.dateRange);
    const compareDateRange = asDateRange(rawFilters.compareDateRange);
    const supportDirection = asEnum(rawFilters.supportDirection, SUPPORT_DIRECTIONS);
    const supportScope = asEnum(rawFilters.supportScope, SUPPORT_SCOPES);
    const supportFlowType = asEnum(rawFilters.supportFlowType, SUPPORT_FLOW_TYPES);
    if (dateRange) filters.dateRange = dateRange;
    if (compareDateRange) filters.compareDateRange = compareDateRange;
    if (supportDirection) filters.supportDirection = supportDirection;
    if (supportScope) filters.supportScope = supportScope;
    if (supportFlowType) filters.supportFlowType = supportFlowType;

    const limitValue = Number(record.limit);
    const confidenceValue = Number(record.confidence);
    return {
        domain: 'manpower_db',
        entity,
        intent,
        filters,
        limit: Number.isFinite(limitValue) ? Math.max(1, Math.min(50, Math.round(limitValue))) : 50,
        confidence: Number.isFinite(confidenceValue) ? Math.max(0, Math.min(1, confidenceValue)) : 0.8,
        clarificationNeeded: record.clarificationNeeded === true,
    };
};

const todayInKorea = (): string => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
}).format(new Date());

const buildPrompt = (question: string): string => [
    '당신은 건설 ERP 통합 인력 DB의 자연어 검색 파서입니다.',
    '사용자 질문을 제공된 JSON schema에 맞는 검색계획으로만 변환하세요.',
    `대한민국 기준 오늘 날짜는 ${todayInKorea()}입니다.`,
    '실제 작업자·팀·현장·회사 데이터는 제공되지 않았으므로 존재 여부를 추측하지 마세요.',
    '일반 명사(작업자, 팀, 현장, 회사, 보여줘, 목록)는 name/teamName/siteName/companyName/keyword 필터로 넣지 마세요.',
    '고유명사가 명시된 경우에만 해당 이름 필터를 설정하세요.',
    '"작업자 보여줘"는 entity=worker, intent=list, filters={} 입니다.',
    '"재직 작업자"는 entity=worker, intent=list, filters.status="재직" 입니다.',
    '"김철수 정보 보여줘"는 entity=worker, intent=lookup, filters.name="김철수" 입니다.',
    '"계좌 없는 작업자"는 entity=worker, intent=missing_field, filters.missingFields=["accountNumber"] 입니다.',
    '"담당팀 없는 진행중 현장"은 entity=site, intent=missing_field, filters.status="active", filters.missingFields=["responsibleTeamId","responsibleTeamName"] 입니다.',
    '지원온곳/지원간곳/외부팀/내부팀/용역팀 질문은 entity=support, intent=relation으로 분류하세요.',
    '이번 달·지난달·최근 N일은 YYYY-MM-DD dateRange로 계산하세요.',
    '질문이 모호하면 clarificationNeeded=true로 설정하고 confidence를 0.7 이하로 낮추세요.',
    `사용자 질문: ${question}`,
].join('\n');

const extractResponseText = (data: any): string =>
    String(data?.candidates?.[0]?.content?.parts?.map((part: any) => part?.text || '').join('') || '').trim();

export const parseManpowerDbQuestionWithGemini = functions
    .runWith({ timeoutSeconds: 30, memory: '256MB', maxInstances: 20 })
    .region('asia-northeast3')
    .https.onCall(async (data, context) => {
        const auth = requireCallableAuth(context);
        const question = asBoundedString(data?.question, MAX_QUESTION_LENGTH);
        if (!question || question.length < 2) {
            throw new functions.https.HttpsError('invalid-argument', '검색 질문을 입력해 주세요.');
        }

        const settings = await getServerGeminiSettings();
        if (!settings.apiKey) {
            throw new functions.https.HttpsError('failed-precondition', '서버 Gemini API가 설정되지 않았습니다.');
        }

        const model = settings.model;
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
        const startedAt = Date.now();

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': settings.apiKey,
                },
                body: JSON.stringify({
                    contents: [{
                        role: 'user',
                        parts: [{ text: buildPrompt(question) }],
                    }],
                    generationConfig: {
                        temperature: 0,
                        responseMimeType: 'application/json',
                        responseJsonSchema: RESPONSE_SCHEMA,
                    },
                }),
            });

            if (!response.ok) {
                const providerMessage = (await response.text()).slice(0, 500);
                functions.logger.warn('Gemini manpower DB parser request failed.', {
                    uid: auth.uid,
                    model,
                    status: response.status,
                    providerMessage,
                });
                throw new functions.https.HttpsError('unavailable', `Gemini 검색 해석에 실패했습니다. (${response.status})`);
            }

            const responseData = await response.json();
            const responseText = extractResponseText(responseData);
            if (!responseText) {
                throw new functions.https.HttpsError('internal', 'Gemini가 빈 검색계획을 반환했습니다.');
            }

            const query = sanitizeQuery(JSON.parse(responseText));
            return {
                query,
                source: 'gemini',
                model,
                latencyMs: Date.now() - startedAt,
            };
        } catch (error) {
            if (error instanceof functions.https.HttpsError) throw error;
            functions.logger.error('Gemini manpower DB parser failed.', {
                uid: auth.uid,
                model,
                error: error instanceof Error ? error.message : String(error),
            });
            throw new functions.https.HttpsError('internal', 'Gemini 검색계획을 처리하지 못했습니다.');
        }
    });
