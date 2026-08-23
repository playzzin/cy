import * as functions from 'firebase-functions/v1';
import { createHash } from 'crypto';
import { requireCallableAuth } from './auth';
import { getServerGeminiSettings } from './serverAiSettings';

declare const fetch: any;

type DocumentType =
    | 'RESIDENT_CARD'
    | 'DRIVERS_LICENSE'
    | 'PASSPORT'
    | 'SAFETY_EDUCATION'
    | 'SCAFFOLD_TRAINING'
    | 'FOREIGN_REGISTRATION'
    | 'CONSTRUCTION_WORKER_CARD'
    | 'OTHER_ID';

interface IdentityFileInput {
    fileIndex: number;
    originalFileName: string;
    mimeType: string;
    base64: string;
}

const MAX_FILES_PER_REQUEST = 4;
const MAX_FILE_BASE64_LENGTH = 4_000_000;
const MAX_TOTAL_BASE64_LENGTH = 9_000_000;
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_DOCUMENT_TYPES = new Set<DocumentType>([
    'RESIDENT_CARD',
    'DRIVERS_LICENSE',
    'PASSPORT',
    'SAFETY_EDUCATION',
    'SCAFFOLD_TRAINING',
    'FOREIGN_REGISTRATION',
    'CONSTRUCTION_WORKER_CARD',
    'OTHER_ID',
]);

const DOCUMENT_LABELS: Record<DocumentType, string> = {
    RESIDENT_CARD: '주민등록증',
    DRIVERS_LICENSE: '운전면허증',
    PASSPORT: '여권',
    SAFETY_EDUCATION: '안전교육이수증',
    SCAFFOLD_TRAINING: '비계교육이수증',
    FOREIGN_REGISTRATION: '외국인등록증',
    CONSTRUCTION_WORKER_CARD: '건설근로자 카드',
    OTHER_ID: '기타 신분·자격증',
};

const GROUPING_RESPONSE_SCHEMA = {
    type: 'object',
    properties: {
        documents: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    fileIndex: { type: 'integer' },
                    personName: { type: 'string' },
                    documentType: {
                        type: 'string',
                        enum: Array.from(ALLOWED_DOCUMENT_TYPES),
                    },
                    documentLabel: { type: 'string' },
                    cropYMin: { type: 'integer' },
                    cropXMin: { type: 'integer' },
                    cropYMax: { type: 'integer' },
                    cropXMax: { type: 'integer' },
                    confidence: { type: 'number' },
                    matchingConfidence: { type: 'number' },
                    warnings: { type: 'array', items: { type: 'string' } },
                },
                required: [
                    'fileIndex', 'personName', 'documentType', 'documentLabel',
                    'cropYMin', 'cropXMin', 'cropYMax',
                    'cropXMax', 'confidence', 'matchingConfidence', 'warnings',
                ],
                propertyOrdering: [
                    'fileIndex', 'personName', 'documentType', 'documentLabel',
                    'cropYMin', 'cropXMin', 'cropYMax',
                    'cropXMax', 'confidence', 'matchingConfidence', 'warnings',
                ],
            },
        },
    },
    required: ['documents'],
    propertyOrdering: ['documents'],
};

const REGISTRATION_RESPONSE_SCHEMA = {
    type: 'object',
    properties: {
        registration: {
            type: 'object',
            properties: {
                name: { type: 'string' },
                idNumber: { type: 'string' },
                address: { type: 'string' },
            },
            required: ['name', 'idNumber', 'address'],
            propertyOrdering: ['name', 'idNumber', 'address'],
        },
    },
    required: ['registration'],
    propertyOrdering: ['registration'],
};

const asString = (value: unknown): string => String(value ?? '').trim();
const asNumber = (value: unknown): number => {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
};
const clamp01 = (value: unknown): number => Number(Math.max(0, Math.min(1, asNumber(value))).toFixed(3));
const clampBoxCoordinate = (value: unknown): number => Math.max(0, Math.min(1000, Math.round(asNumber(value))));

const normalizeBirthDate = (value: unknown): string => {
    const digits = asString(value).replace(/[^0-9]/g, '').slice(0, 8);
    if (digits.length !== 8) return '';
    const year = Number(digits.slice(0, 4));
    const month = Number(digits.slice(4, 6));
    const day = Number(digits.slice(6, 8));
    if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return '';
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
};

const sanitizeSessionId = (value: unknown): string => {
    const sessionId = asString(value).replace(/[^0-9A-Za-z_-]/g, '').slice(0, 100);
    if (sessionId.length < 16) {
        throw new functions.https.HttpsError('invalid-argument', '분석 세션 정보가 올바르지 않습니다.');
    }
    return sessionId;
};

const sanitizeFile = (value: unknown): IdentityFileInput => {
    const source = (value || {}) as Record<string, unknown>;
    const fileIndex = Math.floor(asNumber(source.fileIndex));
    const originalFileName = asString(source.originalFileName).slice(0, 180);
    const mimeType = asString(source.mimeType).toLowerCase();
    const base64 = asString(source.base64).replace(/^data:[^,]+,/, '');
    if (!Number.isInteger(fileIndex) || fileIndex < 0 || fileIndex > 9999) {
        throw new functions.https.HttpsError('invalid-argument', '첨부 파일 순번이 올바르지 않습니다.');
    }
    if (!originalFileName || !ALLOWED_MIME_TYPES.has(mimeType)) {
        throw new functions.https.HttpsError('invalid-argument', '지원하지 않는 신분증 이미지 형식입니다.');
    }
    if (!base64 || base64.length > MAX_FILE_BASE64_LENGTH || !/^[A-Za-z0-9+/=\s]+$/.test(base64)) {
        throw new functions.https.HttpsError('invalid-argument', `${originalFileName}: 분석 이미지 용량 또는 형식이 올바르지 않습니다.`);
    }
    return { fileIndex, originalFileName, mimeType, base64 };
};

const buildGroupingPrompt = (files: IdentityFileInput[]): string => `
당신은 한국 건설 현장의 신분·교육증 사진을 빠르게 묶는 도우미입니다.
첨부된 ${files.length}장의 이미지를 각각 독립적으로 분석하세요.

목표:
1. 이미지 안의 실제 신분증/자격증/교육이수증/여권 문서 영역만 정확히 찾습니다.
2. 문서 종류와 소유자 이름을 읽어 동일인 문서를 묶을 수 있게 합니다.
3. 사진 배경, 손, 책상, 그림자, 다른 종이는 결과 crop에서 제외합니다.
4. 이 단계에서는 속도가 중요합니다. 주민번호, 주소, 문서번호 등 상세 인적정보는 읽거나 반환하지 않습니다.

판독 규칙:
- FILE_INDEX를 반드시 그대로 반환하세요. 입력마다 결과가 정확히 하나 있어야 합니다.
- personName은 문서의 소유자 이름만 반환합니다. 기관명이나 교육 담당자 이름을 넣지 마세요.
- documentType은 허용된 enum 중 하나입니다. 안전보건교육 수료증은 SAFETY_EDUCATION, 비계/시스템비계 교육증은 SCAFFOLD_TRAINING입니다.
- documentLabel은 실제 문서의 짧은 한글 명칭입니다.
- crop 좌표는 이미지 전체를 0~1000으로 본 [Y_MIN, X_MIN, Y_MAX, X_MAX]입니다. 물리적 문서의 네 모서리, 둥근 모서리, 하단 색띠, 로고, 직인, 마지막 글자까지 모두 포함하세요. 실제 문서 경계를 기준으로 하고 경계가 불확실하면 더 넓게 잡으세요. 클라이언트가 잘림 방지 여백을 별도로 확장합니다.
- 문서가 이미지 전체를 차지하면 0,0,1000,1000을 사용합니다.
- confidence와 matchingConfidence는 0~1입니다.
- 흐림, 반사, 잘림, 이름 불명확 등 사람이 확인할 사항만 warnings에 짧게 적습니다.
- 이미지에 지원 문서가 없어도 OTHER_ID로 결과를 만들고 낮은 confidence와 경고를 반환합니다.
`;

const buildRegistrationPrompt = (): string => `
당신은 한국 건설 현장 작업자의 통합 인사DB 등록을 돕는 문서 판독 도우미입니다.
첨부된 이미지는 한 사람의 여러 신분증·자격증을 합친 최종 묶음사진입니다.

목표:
1. 묶음사진 전체에서 작업자의 이름, 주민등록번호 또는 외국인등록번호, 주소를 읽습니다.
2. 같은 사람의 여러 문서가 있을 때 가장 선명하고 완전한 값을 사용합니다.

판독 규칙:
- name은 문서 소유자의 이름만 반환합니다. 기관명이나 교육 담당자 이름은 제외합니다.
- idNumber는 주민등록번호 또는 외국인등록번호를 원문 형식 그대로 반환합니다. 마스킹하거나 추측하지 마세요.
- address는 문서에 표시된 소유자 주소를 원문 그대로 반환합니다.
- 값이 없거나 확실하지 않으면 빈 문자열을 반환합니다.
- 서로 다른 사람의 문서가 섞인 것으로 보이면 가장 확실한 주인공의 값만 반환하고 추측하지 마세요.
`;

const extractGeminiText = (payload: any): string => {
    const parts = payload?.candidates?.[0]?.content?.parts;
    if (!Array.isArray(parts)) return '';
    return parts.map((part: any) => asString(part?.text)).filter(Boolean).join('\n');
};

const parseJsonObject = (text: string): Record<string, any> => {
    const trimmed = asString(text).replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    if (firstBrace < 0 || lastBrace <= firstBrace) throw new Error('Gemini 응답 JSON을 파싱할 수 없습니다.');
    return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
};

const protectIdentifier = (sessionId: string, value: unknown): string => {
    const normalized = asString(value).normalize('NFKC').toUpperCase().replace(/[^0-9A-Z]/g, '');
    if (normalized.length < 5) return '';
    return createHash('sha256').update(`${sessionId}:${normalized}`).digest('hex');
};

const sanitizeDocument = (
    value: Record<string, unknown>,
    file: IdentityFileInput,
    sessionId: string,
) => {
    const rawType = asString(value.documentType) as DocumentType;
    const documentType: DocumentType = ALLOWED_DOCUMENT_TYPES.has(rawType) ? rawType : 'OTHER_ID';
    const rawXMin = clampBoxCoordinate(value.cropXMin);
    const rawYMin = clampBoxCoordinate(value.cropYMin);
    const rawXMax = Math.max(rawXMin + 20, clampBoxCoordinate(value.cropXMax));
    const rawYMax = Math.max(rawYMin + 20, clampBoxCoordinate(value.cropYMax));
    // Client-side composition applies the deterministic safety expansion so
    // the crop is padded exactly once.
    const padding = 0;
    const xMin = Math.max(0, rawXMin - padding);
    const yMin = Math.max(0, rawYMin - padding);
    const xMax = Math.min(1000, rawXMax + padding);
    const yMax = Math.min(1000, rawYMax + padding);
    const warnings = Array.isArray(value.warnings)
        ? value.warnings.map(asString).filter(Boolean).map((warning) => warning.slice(0, 180)).slice(0, 8)
        : [];

    return {
        fileIndex: file.fileIndex,
        originalFileName: file.originalFileName,
        personName: asString(value.personName).replace(/[\r\n]/g, ' ').slice(0, 80),
        birthDate: normalizeBirthDate(value.birthDate),
        identityNumber: asString(value.identityNumberForMatching).replace(/[\r\n]/g, ' ').slice(0, 40),
        address: asString(value.address).replace(/[\r\n]/g, ' ').slice(0, 240),
        nationality: asString(value.nationality).replace(/[\r\n]/g, ' ').slice(0, 80),
        documentNumber: asString(value.documentNumber).replace(/[\r\n]/g, ' ').slice(0, 60),
        expirationDate: normalizeBirthDate(value.expirationDate),
        identityHash: protectIdentifier(sessionId, value.identityNumberForMatching),
        documentType,
        documentLabel: asString(value.documentLabel).slice(0, 80) || DOCUMENT_LABELS[documentType],
        crop: {
            x: Number((xMin / 1000).toFixed(4)),
            y: Number((yMin / 1000).toFixed(4)),
            width: Number(((xMax - xMin) / 1000).toFixed(4)),
            height: Number(((yMax - yMin) / 1000).toFixed(4)),
        },
        confidence: clamp01(value.confidence),
        matchingConfidence: clamp01(value.matchingConfidence),
        warnings,
    };
};

const sanitizeRegistration = (value: unknown) => {
    const source = (value || {}) as Record<string, unknown>;
    return {
        name: asString(source.name).replace(/[\r\n]/g, ' ').slice(0, 80),
        idNumber: asString(source.idNumber).replace(/[\r\n]/g, ' ').slice(0, 40),
        address: asString(source.address).replace(/[\r\n]/g, ' ').slice(0, 240),
    };
};

const toHttpsError = (error: unknown): functions.https.HttpsError => {
    if (error instanceof functions.https.HttpsError) return error;
    const message = error instanceof Error ? error.message : asString(error);
    const lower = message.toLowerCase();
    if (lower.includes('api key') || lower.includes('permission') || lower.includes('forbidden')) {
        return new functions.https.HttpsError('failed-precondition', `/settings/ai 서버 Gemini 설정을 확인해 주세요. ${message}`);
    }
    if (lower.includes('quota') || lower.includes('rate limit') || lower.includes('resource exhausted')) {
        return new functions.https.HttpsError('resource-exhausted', `Gemini 사용량 한도에 도달했습니다. ${message}`);
    }
    return new functions.https.HttpsError('internal', `신분증 AI 분석에 실패했습니다. ${message}`);
};

export const analyzeIdentityDocuments = functions
    .runWith({ timeoutSeconds: 300, memory: '1GB', maxInstances: 5 })
    .region('asia-northeast3')
    .https.onCall(async (data: { sessionId?: unknown; files?: unknown[]; mode?: unknown }, context) => {
        try {
            requireCallableAuth(context);
            const sessionId = sanitizeSessionId(data?.sessionId);
            const mode = asString(data?.mode).toUpperCase() === 'REGISTRATION' ? 'REGISTRATION' : 'GROUPING';
            const rawFiles = Array.isArray(data?.files) ? data.files : [];
            if (rawFiles.length === 0 || rawFiles.length > MAX_FILES_PER_REQUEST) {
                throw new functions.https.HttpsError('invalid-argument', `한 번에 1~${MAX_FILES_PER_REQUEST}개 이미지를 분석할 수 있습니다.`);
            }
            const files = rawFiles.map(sanitizeFile);
            if (mode === 'REGISTRATION' && files.length !== 1) {
                throw new functions.https.HttpsError('invalid-argument', 'DB 등록용 상세 분석은 묶음사진 1장씩 처리합니다.');
            }
            if (new Set(files.map((file) => file.fileIndex)).size !== files.length) {
                throw new functions.https.HttpsError('invalid-argument', '첨부 파일 순번이 중복되었습니다.');
            }
            if (files.reduce((sum, file) => sum + file.base64.length, 0) > MAX_TOTAL_BASE64_LENGTH) {
                throw new functions.https.HttpsError('invalid-argument', '분석 이미지 전체 용량이 너무 큽니다.');
            }

            const settings = await getServerGeminiSettings();
            const apiKey = asString(settings.apiKey);
            if (!apiKey) {
                throw new functions.https.HttpsError('failed-precondition', '/settings/ai에서 서버 Gemini API Key를 먼저 설정해 주세요.');
            }
            const model = asString(settings.documentModel) || asString(settings.model) || 'gemini-2.5-flash';
            const parts: Array<Record<string, unknown>> = [{
                text: mode === 'REGISTRATION' ? buildRegistrationPrompt() : buildGroupingPrompt(files),
            }];
            files.forEach((file) => {
                parts.push({ text: `FILE_INDEX=${file.fileIndex}\nFILE_NAME=${file.originalFileName}` });
                parts.push({ inlineData: { mimeType: file.mimeType, data: file.base64 } });
            });
            const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ role: 'user', parts }],
                    generationConfig: {
                        temperature: 0.05,
                        responseMimeType: 'application/json',
                        responseJsonSchema: mode === 'REGISTRATION'
                            ? REGISTRATION_RESPONSE_SCHEMA
                            : GROUPING_RESPONSE_SCHEMA,
                    },
                }),
            });
            const rawResponse = await response.text();
            let payload: any = null;
            try { payload = rawResponse ? JSON.parse(rawResponse) : null; } catch { payload = null; }
            if (!response.ok) {
                const message = asString(payload?.error?.message) || `${response.status} ${response.statusText}`;
                functions.logger.error('Identity document Gemini analysis failed', {
                    status: response.status,
                    model,
                    fileCount: files.length,
                    message,
                });
                throw new Error(message);
            }

            const text = extractGeminiText(payload);
            if (!text) throw new Error('Gemini 분석 결과가 비어 있습니다.');
            const parsed = parseJsonObject(text);
            if (mode === 'REGISTRATION') {
                const registration = sanitizeRegistration(parsed.registration);
                functions.logger.info('Identity bundle registration analysis completed', {
                    model,
                    hasName: Boolean(registration.name),
                    hasIdNumber: Boolean(registration.idNumber),
                    hasAddress: Boolean(registration.address),
                });
                return { ok: true, model, documents: [], registration };
            }
            const rawDocuments = Array.isArray(parsed.documents) ? parsed.documents : [];
            const byFileIndex = new Map<number, Record<string, unknown>>();
            rawDocuments.forEach((value) => {
                const fileIndex = Math.floor(asNumber(value?.fileIndex));
                if (files.some((file) => file.fileIndex === fileIndex) && !byFileIndex.has(fileIndex)) {
                    byFileIndex.set(fileIndex, value as Record<string, unknown>);
                }
            });
            const documents = files.map((file) => sanitizeDocument(byFileIndex.get(file.fileIndex) || {
                documentType: 'OTHER_ID',
                documentLabel: '미인식 문서',
                cropXMin: 0,
                cropYMin: 0,
                cropXMax: 1000,
                cropYMax: 1000,
                warnings: ['Gemini가 이 이미지의 문서를 인식하지 못했습니다.'],
            }, file, sessionId));

            functions.logger.info('Identity document analysis completed', {
                model,
                fileCount: files.length,
                recognizedCount: documents.filter((document) => document.confidence >= 0.5).length,
            });
            return { ok: true, model, documents };
        } catch (error) {
            throw toHttpsError(error);
        }
    });
