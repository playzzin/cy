import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { createHash } from 'crypto';
import { getServerGeminiSettings } from './serverAiSettings';
import { requireVehicleFineAccess } from './vehicleFineAnalysis';
import {
    buildVehicleImportIdentityDocumentId,
    buildVehicleImportIdentityKey,
    hashVehicleImportSource,
    normalizeVehicleImportSourceSha256,
    resolveVehicleImportDuplicateExpenseId,
} from './vehicleImportIdentity';

declare const fetch: any;

interface TollFileInput {
    fileIndex: number;
    originalFileName: string;
    mimeType: string;
    base64: string;
    sourceSha256: string;
}

interface TollUsageAnalysis {
    fileIndex: number;
    entryIndex: number;
    originalFileName: string;
    sourceSha256: string;
    fileNameVehicleSuffix: string;
    provider: string;
    licensePlate: string;
    licensePlateCandidates: string[];
    transactionDate: string;
    transactionTime: string;
    transactionDateTime: string;
    entryTollgate: string;
    exitTollgate: string;
    routeName: string;
    transactionNumber: string;
    approvalNumber: string;
    statementPeriod: string;
    totalCount: number;
    cardNumber: string;
    amount: number;
    confidence: number;
    warnings: string[];
    dedupeKey: string;
    duplicate: boolean;
    existingExpenseId: string;
}

interface CommitTollItem {
    fileIndex: number;
    entryIndex: number;
    vehicleId: string;
    manualMatch: boolean;
    expenseDate: string;
    amount: number;
    analysis: TollUsageAnalysis;
}

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
const MAX_FILES_PER_REQUEST = 2;
const MAX_ITEMS_PER_COMMIT = 20;
const MAX_FILE_BASE64_LENGTH = 11_000_000;
const MAX_TOTAL_BASE64_LENGTH = 8_000_000;
const VEHICLE_EXPENSE_COLLECTION = 'vehicleExpenses';
const VEHICLE_IMPORT_IDENTITY_COLLECTION = 'vehicleExpenseImportIdentities';
const SUPPORT_OPERATION_COLLECTION = 'support_write_operations';

const TOLL_USAGE_SCHEMA = {
    type: 'object',
    properties: {
        usages: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    fileIndex: { type: 'integer' },
                    entryIndex: { type: 'integer' },
                    provider: { type: 'string' },
                    licensePlate: { type: 'string' },
                    licensePlateCandidates: { type: 'array', items: { type: 'string' } },
                    transactionDate: { type: 'string' },
                    transactionTime: { type: 'string' },
                    transactionDateTime: { type: 'string' },
                    entryTollgate: { type: 'string' },
                    exitTollgate: { type: 'string' },
                    routeName: { type: 'string' },
                    transactionNumber: { type: 'string' },
                    approvalNumber: { type: 'string' },
                    statementPeriod: { type: 'string' },
                    totalCount: { type: 'integer' },
                    cardNumber: { type: 'string' },
                    amount: { type: 'number' },
                    confidence: { type: 'number' },
                    warnings: { type: 'array', items: { type: 'string' } },
                },
                required: [
                    'fileIndex', 'entryIndex', 'provider', 'licensePlate', 'licensePlateCandidates',
                    'transactionDate', 'transactionTime', 'transactionDateTime', 'entryTollgate',
                    'exitTollgate', 'routeName', 'transactionNumber', 'approvalNumber', 'statementPeriod',
                    'totalCount', 'cardNumber', 'amount',
                    'confidence', 'warnings',
                ],
                propertyOrdering: [
                    'fileIndex', 'entryIndex', 'provider', 'licensePlate', 'licensePlateCandidates',
                    'transactionDate', 'transactionTime', 'transactionDateTime', 'entryTollgate',
                    'exitTollgate', 'routeName', 'transactionNumber', 'approvalNumber', 'statementPeriod',
                    'totalCount', 'cardNumber', 'amount',
                    'confidence', 'warnings',
                ],
            },
        },
    },
    required: ['usages'],
    propertyOrdering: ['usages'],
};

const asString = (value: unknown): string => String(value ?? '').trim();
const asNumber = (value: unknown): number => {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
};
const clampAmount = (value: unknown): number => Math.max(0, Math.min(10_000_000, Math.round(asNumber(value))));
const clampConfidence = (value: unknown): number => Number(Math.max(0, Math.min(1, asNumber(value))).toFixed(3));
const normalizePlate = (value: unknown): string => asString(value).normalize('NFKC').toUpperCase().replace(/[^0-9A-Z\uAC00-\uD7A3]/g, '');
const PLATE_PATTERN = /\d{2,3}[\s-]*[\uAC00-\uD7A3A-Z][\s-]*\d{4}/giu;
const OCR_PLATE_PATTERN = /[0-9A-Z]{2,3}[\s-]*[\uAC00-\uD7A3A-Z][\s-]*[0-9A-Z]{4}/giu;
const NORMALIZED_PLATE_PATTERN = /^\d{2,3}[\uAC00-\uD7A3A-Z]\d{4}$/u;
const OCR_DIGIT_REPLACEMENTS: Record<string, string> = {
    O: '0', Q: '0', D: '0', I: '1', L: '1', Z: '2', S: '5', G: '6', T: '7', B: '8',
};

const repairNumericSegment = (value: string): string => Array.from(value).map((character) => (
    /\d/.test(character) ? character : OCR_DIGIT_REPLACEMENTS[character] || ''
)).join('');

const normalizePlateCandidate = (value: unknown): string => {
    const text = asString(value).normalize('NFKC').toUpperCase();
    const strictMatch = text.match(PLATE_PATTERN)?.[0];
    if (strictMatch) return normalizePlate(strictMatch);

    const embedded = text.match(OCR_PLATE_PATTERN)?.[0] || text;
    const compact = normalizePlate(embedded);
    const prefixLength = compact.length - 5;
    if (prefixLength !== 2 && prefixLength !== 3) return '';
    const prefix = repairNumericSegment(compact.slice(0, prefixLength));
    const vehicleLetter = compact.slice(prefixLength, prefixLength + 1);
    const suffix = repairNumericSegment(compact.slice(prefixLength + 1));
    if (prefix.length !== prefixLength || suffix.length !== 4) return '';
    const normalized = `${prefix}${vehicleLetter}${suffix}`;
    return NORMALIZED_PLATE_PATTERN.test(normalized) ? normalized : '';
};

const extractPlateCandidates = (value: unknown): string[] => {
    const values = Array.isArray(value) ? value : [value];
    return Array.from(new Set(values
        .flatMap((item) => {
            const text = asString(item).normalize('NFKC');
            const matches = text.match(PLATE_PATTERN) || text.match(OCR_PLATE_PATTERN);
            return matches && matches.length > 0 ? matches : [text];
        })
        .map(normalizePlateCandidate)
        .filter(Boolean)))
        .slice(0, 3);
};

const normalizeIdentifier = (value: unknown): string => asString(value).replace(/[^0-9A-Za-z\uAC00-\uD7A3]/g, '').toUpperCase();
const extractFileNameVehicleSuffix = (value: unknown): string => {
    const baseName = asString(value).replace(/\.[^.]+$/, '');
    const suffixes = Array.from(baseName.matchAll(/-\s*(\d{4})(?=$|[^0-9])/g), (match) => match[1]);
    return suffixes.at(-1) || '';
};
const normalizeIsoDate = (value: unknown): string => {
    const text = asString(value);
    const match = /^(\d{4})[-./\s]+(\d{1,2})[-./\s]+(\d{1,2})/.exec(text);
    if (!match) return '';
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return '';
    return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const normalizeStatementPeriod = (value: unknown): string => {
    const text = asString(value);
    const compactDates = text.match(/\b\d{8}\b/g) || [];
    const dates = compactDates
        .map((date) => normalizeIsoDate(`${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`))
        .filter(Boolean);
    if (dates.length >= 2) return `${dates[0]}~${dates[1]}`;

    const separatedDates = Array.from(text.matchAll(/\d{4}\s*[-./년]\s*\d{1,2}\s*[-./월]\s*\d{1,2}/g))
        .map((match) => normalizeIsoDate(match[0]))
        .filter(Boolean);
    if (separatedDates.length >= 2) return `${separatedDates[0]}~${separatedDates[1]}`;
    return separatedDates[0] || text.slice(0, 80);
};

const normalizeTime = (value: unknown): string => {
    const match = /(?:^|\s)(\d{1,2})\s*[:시]\s*(\d{1,2})(?:\s*[:분]\s*(\d{1,2}))?/.exec(asString(value));
    if (!match) return '';
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    const second = Number(match[3] || 0);
    if (hour > 23 || minute > 59 || second > 59) return '';
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
};

const asWarnings = (value: unknown): string[] => Array.isArray(value)
    ? Array.from(new Set(value.map(asString).filter(Boolean))).slice(0, 20)
    : [];

const sanitizeFile = (value: unknown): TollFileInput => {
    const source = (value || {}) as Record<string, unknown>;
    const fileIndex = Math.floor(asNumber(source.fileIndex));
    const originalFileName = asString(source.originalFileName).slice(0, 180);
    const mimeType = asString(source.mimeType).toLowerCase();
    const base64 = asString(source.base64);
    if (!Number.isInteger(fileIndex) || fileIndex < 0 || !originalFileName || !ALLOWED_MIME_TYPES.has(mimeType)) {
        throw new functions.https.HttpsError('invalid-argument', '첨부 파일 정보가 올바르지 않습니다.');
    }
    if (!base64 || base64.length > MAX_FILE_BASE64_LENGTH || !/^[A-Za-z0-9+/=]+$/.test(base64)) {
        throw new functions.https.HttpsError('invalid-argument', `${originalFileName}: 파일 데이터가 올바르지 않습니다.`);
    }
    return {
        fileIndex,
        originalFileName,
        mimeType,
        base64,
        sourceSha256: hashVehicleImportSource(base64),
    };
};

const parseJsonObject = (value: string): Record<string, any> => {
    const cleaned = value.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start < 0 || end < start) throw new Error('Gemini JSON 응답 형식이 올바르지 않습니다.');
    return JSON.parse(cleaned.slice(start, end + 1));
};

const extractGeminiText = (payload: any): string => {
    const parts = payload?.candidates?.[0]?.content?.parts;
    if (!Array.isArray(parts)) return '';
    return parts.map((part: any) => asString(part?.text)).filter(Boolean).join('\n');
};

const buildDedupeKey = (usage: Pick<TollUsageAnalysis,
    'provider' | 'statementPeriod' | 'cardNumber' | 'originalFileName' | 'amount'>): string => {
    const provider = normalizeIdentifier(usage.provider) || 'UNKNOWN';
    const statementPeriod = normalizeIdentifier(usage.statementPeriod);
    const cardNumber = normalizeIdentifier(usage.cardNumber);
    if (statementPeriod && cardNumber) {
        return ['statement', provider, cardNumber, statementPeriod, String(Math.round(usage.amount || 0))].join(':');
    }
    return [
        'statement-fallback',
        provider,
        statementPeriod,
        normalizeIdentifier(usage.originalFileName),
        String(Math.round(usage.amount || 0)),
    ].join(':');
};

const buildExpenseId = (dedupeKey: string): string => `vehicle_toll_${createHash('sha256').update(dedupeKey).digest('hex').slice(0, 36)}`;
const buildOperationDocumentId = (operationId: string): string => `vehicle_toll_${createHash('sha256').update(operationId).digest('hex').slice(0, 36)}`;

const sanitizeUsage = (value: unknown, file: TollFileInput, fallbackEntryIndex: number): TollUsageAnalysis => {
    const source = (value || {}) as Record<string, unknown>;
    const transactionDateTimeText = asString(source.transactionDateTime);
    const transactionDate = normalizeIsoDate(source.transactionDate) || normalizeIsoDate(transactionDateTimeText);
    const transactionTime = normalizeTime(source.transactionTime) || normalizeTime(transactionDateTimeText);
    const licensePlateCandidates = extractPlateCandidates([
        source.licensePlate,
        ...(Array.isArray(source.licensePlateCandidates) ? source.licensePlateCandidates : []),
    ]);
    const licensePlate = normalizePlateCandidate(source.licensePlate) || licensePlateCandidates[0] || '';
    const warnings = asWarnings(source.warnings);
    const amount = clampAmount(source.amount);
    const statementPeriod = normalizeStatementPeriod(source.statementPeriod);
    const totalCount = Math.max(0, Math.min(100_000, Math.floor(asNumber(source.totalCount))));
    const cardNumber = asString(source.cardNumber).slice(0, 80);
    if (!licensePlate) warnings.push('명세서에 차량번호가 없으므로 차량을 직접 선택해 주세요.');
    if (!statementPeriod) warnings.push('명세서 조회기간을 읽지 못했습니다. 대장 반영일을 확인해 주세요.');
    if (amount <= 0) warnings.push('통행료 금액을 읽지 못했습니다. 금액을 확인해 주세요.');
    const usage: TollUsageAnalysis = {
        fileIndex: file.fileIndex,
        // Keep the server-assigned order unique even when the model repeats or
        // skips an entryIndex in a multi-row statement.
        entryIndex: fallbackEntryIndex,
        originalFileName: file.originalFileName,
        sourceSha256: file.sourceSha256,
        fileNameVehicleSuffix: extractFileNameVehicleSuffix(file.originalFileName),
        provider: asString(source.provider).slice(0, 120),
        licensePlate,
        licensePlateCandidates,
        transactionDate,
        transactionTime,
        transactionDateTime: transactionDate && transactionTime ? `${transactionDate}T${transactionTime}` : '',
        entryTollgate: asString(source.entryTollgate).slice(0, 160),
        exitTollgate: asString(source.exitTollgate).slice(0, 160),
        routeName: asString(source.routeName).slice(0, 200),
        transactionNumber: asString(source.transactionNumber).slice(0, 120),
        approvalNumber: asString(source.approvalNumber).slice(0, 120),
        statementPeriod,
        totalCount,
        cardNumber,
        amount,
        confidence: clampConfidence(source.confidence),
        warnings: Array.from(new Set(warnings)),
        dedupeKey: '',
        duplicate: false,
        existingExpenseId: '',
    };
    usage.dedupeKey = buildDedupeKey(usage);
    return usage;
};

const buildPrompt = (files: TollFileInput[]): string => `
You extract Korean vehicle toll / Hi-Pass usage statements, receipts, and invoices into structured JSON.
There are ${files.length} attachments. Every result must use its matching FILE_INDEX.

Rules:
- Return exactly one usages[] item per file, regardless of how many individual toll rows appear in the file. Set entryIndex to 0. Never calculate or register separate individual toll rows.
- For a Korean transportation-card monthly statement, amount must be the header's 총 금액 in KRW. Read the header labels 조회기간, 총 건수(건), 총 금액(원), 카드번호, 이용수단.
- statementPeriod must be the visible statement period as YYYY-MM-DD~YYYY-MM-DD. totalCount is the visible header total count as an integer. cardNumber is the masked card number exactly as printed (for example 941049******7).
- The user will directly choose the vehicle for every statement. Never infer a vehicle or a license plate from file name, card number, subscriber, account, payment number, or known vehicle list. Set licensePlate and licensePlateCandidates to empty for monthly statements.
- Set transactionDate, transactionTime, transactionDateTime, entryTollgate, exitTollgate, routeName, transactionNumber, and approvalNumber to empty for a statement total.
- licensePlate is only a clearly printed vehicle number from the toll statement/receipt. It must be 2 or 3 digits + one Hangul vehicle letter (or visible Latin letter) + 4 digits. Do not mistake an account, card, approval, transaction, or customer number for a vehicle plate. licensePlateCandidates contains every distinct legible candidate, maximum 3.
- Use empty licensePlate if there is no clearly printed vehicle number. Do not use a card, account, subscriber, approval, payment, or file-name number as a plate.
- transactionDate is YYYY-MM-DD. transactionTime is HH:mm:ss when visible, otherwise empty. transactionDateTime is YYYY-MM-DDTHH:mm:ss only when both values are visible.
- amount is the single statement total in KRW as a number. Exclude a statement balance, prepaid-card recharge, and service fee.
- provider is the issuer or payment provider (for example 한국도로공사, 하이패스, 카드사). entryTollgate and exitTollgate are gate/place names when visible. routeName is an optional route/road name.
- transactionNumber and approvalNumber must be unique charge identifiers when visible; leave them empty when unreadable. Never use an account number as either identifier.
- confidence is 0..1. Do not guess an unreadable date, plate, or amount: return empty/0 and add a Korean warning.
- IMPORTANT: This feature registers a statement total only. For every monthly statement, transactionDate, transactionTime, transactionDateTime, entryTollgate, exitTollgate, routeName, transactionNumber, and approvalNumber MUST be empty strings, even if individual rows are visible.
- IMPORTANT: The statement header's total amount, total count, period, and masked card number take precedence over every individual row.
- Return JSON only, matching the response schema.
`;

const toHttpsError = (error: unknown, fallback: string): functions.https.HttpsError => {
    if (error instanceof functions.https.HttpsError) return error;
    const message = error instanceof Error ? error.message : asString(error) || fallback;
    const lower = message.toLowerCase();
    if (lower.includes('api key') || lower.includes('permission') || lower.includes('forbidden')) {
        return new functions.https.HttpsError('failed-precondition', `/settings/ai 서버 Gemini 설정을 확인해 주세요. ${message}`);
    }
    if (lower.includes('quota') || lower.includes('rate limit') || lower.includes('resource exhausted')) {
        return new functions.https.HttpsError('resource-exhausted', `Gemini 사용 요청 한도에 도달했습니다. ${message}`);
    }
    return new functions.https.HttpsError('internal', `${fallback} ${message}`);
};

export const analyzeVehicleTollUsages = functions
    .runWith({ timeoutSeconds: 300, memory: '1GB', maxInstances: 5 })
    .region('asia-northeast3')
    .https.onCall(async (data: { files?: unknown[] }, context) => {
        try {
            await requireVehicleFineAccess(context);
            const rawFiles = Array.isArray(data?.files) ? data.files : [];
            if (rawFiles.length === 0 || rawFiles.length > MAX_FILES_PER_REQUEST) {
                throw new functions.https.HttpsError('invalid-argument', `한 번에 1~${MAX_FILES_PER_REQUEST}개 파일만 분석할 수 있습니다.`);
            }
            const files = rawFiles.map(sanitizeFile);
            if (new Set(files.map((file) => file.fileIndex)).size !== files.length) {
                throw new functions.https.HttpsError('invalid-argument', '첨부 파일 번호가 중복되었습니다.');
            }
            if (files.reduce((sum, file) => sum + file.base64.length, 0) > MAX_TOTAL_BASE64_LENGTH) {
                throw new functions.https.HttpsError('invalid-argument', '분석 요청 파일의 전체 용량이 너무 큽니다.');
            }

            const settings = await getServerGeminiSettings();
            const apiKey = asString(settings.apiKey);
            if (!apiKey) {
                throw new functions.https.HttpsError('failed-precondition', '/settings/ai에서 서버 Gemini API Key를 먼저 설정해 주세요.');
            }
            const model = asString(settings.documentModel) || asString(settings.model) || 'gemini-2.5-flash';
            const parts: Array<Record<string, unknown>> = [{ text: buildPrompt(files) }];
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
                        responseJsonSchema: TOLL_USAGE_SCHEMA,
                    },
                }),
            });
            const rawResponse = await response.text();
            let payload: any = null;
            try { payload = rawResponse ? JSON.parse(rawResponse) : null; } catch { payload = null; }
            if (!response.ok) {
                const message = asString(payload?.error?.message) || `${response.status} ${response.statusText}`;
                functions.logger.error('Vehicle toll Gemini analysis failed', { status: response.status, model, fileCount: files.length, message });
                throw new Error(message);
            }

            const text = extractGeminiText(payload);
            if (!text) throw new Error('Gemini 분석 결과가 비어 있습니다.');
            const parsed = parseJsonObject(text);
            const rawUsages = Array.isArray(parsed.usages) ? parsed.usages : [];
            const usages = files.flatMap((file) => {
                const fileRows = rawUsages.filter((value) => Math.floor(asNumber(value?.fileIndex)) === file.fileIndex);
                if (fileRows.length === 0) {
                    return [sanitizeUsage({
                        entryIndex: 0,
                        warnings: ['이 파일에서 통행료 이용내역을 찾지 못했습니다. 다른 파일을 선택하거나 직접 입력해 주세요.'],
                    }, file, 0)];
                }
                const firstUsage = (fileRows[0] || {}) as Record<string, unknown>;
                const warnings = asWarnings(firstUsage.warnings);
                if (fileRows.length > 1) warnings.push('파일별 통행료 총액 한 건만 등록하도록 나머지 개별 내역은 제외했습니다.');
                return [sanitizeUsage({ ...firstUsage, entryIndex: 0, warnings }, file, 0)];
            });

            const refs = Array.from(new Set(usages.map((usage) => buildExpenseId(usage.dedupeKey))))
                .map((id) => admin.firestore().collection(VEHICLE_EXPENSE_COLLECTION).doc(id));
            const identityRefs = Array.from(new Set(usages
                .map((usage) => buildVehicleImportIdentityDocumentId(
                    buildVehicleImportIdentityKey('toll', usage.sourceSha256, usage.entryIndex),
                ))
                .filter(Boolean)))
                .map((id) => admin.firestore().collection(VEHICLE_IMPORT_IDENTITY_COLLECTION).doc(id));
            const existingSnaps = refs.length > 0 ? await admin.firestore().getAll(...refs) : [];
            const existingIdentitySnaps = identityRefs.length > 0
                ? await admin.firestore().getAll(...identityRefs)
                : [];
            const existingIds = new Set(existingSnaps.filter((snap) => snap.exists).map((snap) => snap.id));
            const identityExpenseRefs = Array.from(new Set(existingIdentitySnaps
                .filter((snap) => snap.exists)
                .map((snap) => asString(snap.data()?.expenseId))
                .filter(Boolean)))
                .map((id) => admin.firestore().collection(VEHICLE_EXPENSE_COLLECTION).doc(id));
            const identityExpenseSnaps = identityExpenseRefs.length > 0
                ? await admin.firestore().getAll(...identityExpenseRefs)
                : [];
            const validIdentityExpenseIds = new Set(identityExpenseSnaps
                .filter((snap) => snap.exists)
                .map((snap) => snap.id));
            const existingIdentityExpenseIds = new Map<string, string>(existingIdentitySnaps
                .filter((snap) => snap.exists)
                .map((snap): [string, string] => [snap.id, asString(snap.data()?.expenseId)])
                .filter(([, expenseId]) => validIdentityExpenseIds.has(expenseId)));
            const danglingIdentityIds = existingIdentitySnaps
                .filter((snap) => snap.exists && !existingIdentityExpenseIds.has(snap.id))
                .map((snap) => snap.id);
            if (danglingIdentityIds.length > 0) {
                functions.logger.warn('Vehicle toll dangling import identities ignored', { danglingIdentityIds });
            }
            const seenIds = new Set<string>();
            const seenIdentityExpenseIds = new Map<string, string>();
            usages.forEach((usage) => {
                const expenseId = buildExpenseId(usage.dedupeKey);
                const identityId = buildVehicleImportIdentityDocumentId(
                    buildVehicleImportIdentityKey('toll', usage.sourceSha256, usage.entryIndex),
                );
                const duplicateInBatch = seenIds.has(expenseId);
                const duplicateSourceInBatch = Boolean(identityId && seenIdentityExpenseIds.has(identityId));
                const existingSourceExpenseId = identityId ? existingIdentityExpenseIds.get(identityId) : '';
                seenIds.add(expenseId);
                if (identityId && !seenIdentityExpenseIds.has(identityId)) {
                    seenIdentityExpenseIds.set(identityId, expenseId);
                }
                usage.duplicate = existingIds.has(expenseId)
                    || duplicateInBatch
                    || Boolean(existingSourceExpenseId)
                    || duplicateSourceInBatch;
                usage.existingExpenseId = usage.duplicate
                    ? existingSourceExpenseId || seenIdentityExpenseIds.get(identityId) || expenseId
                    : '';
                if (duplicateInBatch) usage.warnings.push('같은 분석 묶음에 중복된 통행료 이용내역이 있습니다.');
                if (existingIds.has(expenseId)) usage.warnings.push('이미 차량 통합관리대장에 등록된 통행료 이용내역입니다.');
                if (duplicateSourceInBatch) usage.warnings.push('같은 원본 파일이 분석 묶음에 중복 첨부되었습니다.');
                if (existingSourceExpenseId) usage.warnings.push('동일한 원본 파일이 이미 차량 통합관리대장에 등록되었습니다.');
            });

            functions.logger.info('Vehicle toll analysis completed', { model, fileCount: files.length, usageCount: usages.length });
            return { ok: true, model, usages };
        } catch (error) {
            throw toHttpsError(error, '차량 통행료 이용내역 분석에 실패했습니다.');
        }
    });

const sanitizeCommitItem = (value: unknown): CommitTollItem => {
    const source = (value || {}) as Record<string, unknown>;
    const analysisSource = (source.analysis || {}) as Record<string, unknown>;
    const fileIndex = Math.floor(asNumber(source.fileIndex));
    const entryIndex = Math.floor(asNumber(source.entryIndex));
    const vehicleId = asString(source.vehicleId);
    const expenseDate = normalizeIsoDate(source.expenseDate);
    const amount = clampAmount(source.amount);
    const analysis = sanitizeUsage(analysisSource, {
        fileIndex,
        originalFileName: asString(analysisSource.originalFileName).slice(0, 180) || `file-${fileIndex}`,
        mimeType: 'image/jpeg',
        base64: 'AA==',
        sourceSha256: normalizeVehicleImportSourceSha256(analysisSource.sourceSha256),
    }, entryIndex);
    if (!Number.isInteger(fileIndex) || fileIndex < 0 || !Number.isInteger(entryIndex) || entryIndex < 0 || !vehicleId || !expenseDate || amount <= 0) {
        throw new functions.https.HttpsError('invalid-argument', '통행료 등록 항목의 차량, 날짜 또는 금액이 올바르지 않습니다.');
    }
    if (!analysis.dedupeKey || (!normalizePlate(analysis.licensePlate) && source.manualMatch !== true)) {
        throw new functions.https.HttpsError('invalid-argument', '차량번호를 확인하거나 차량을 수동으로 지정해 주세요.');
    }
    if (!analysis.sourceSha256) {
        throw new functions.https.HttpsError('failed-precondition', '원본 파일 식별정보가 없습니다. 통행료 파일을 다시 분석해 주세요.');
    }
    return { fileIndex, entryIndex, vehicleId, manualMatch: source.manualMatch === true, expenseDate, amount, analysis };
};

const buildTollNote = (item: CommitTollItem): string => [
    item.analysis.fileNameVehicleSuffix ? `파일 차량끝번호 ${item.analysis.fileNameVehicleSuffix}` : '',
    item.analysis.statementPeriod ? `조회기간 ${item.analysis.statementPeriod}` : '',
    item.analysis.totalCount > 0 ? `${item.analysis.totalCount}건` : '',
    item.analysis.cardNumber ? `카드 ${item.analysis.cardNumber}` : '',
    item.analysis.provider,
    item.analysis.routeName,
    [item.analysis.entryTollgate, item.analysis.exitTollgate].filter(Boolean).join(' → '),
    item.analysis.transactionDateTime || item.analysis.transactionDate,
    item.analysis.transactionNumber ? `거래번호 ${item.analysis.transactionNumber}` : '',
    item.analysis.approvalNumber ? `승인번호 ${item.analysis.approvalNumber}` : '',
].filter(Boolean).join(' · ').slice(0, 900);

export const commitVehicleTollImports = functions
    .runWith({ timeoutSeconds: 120, memory: '512MB', maxInstances: 10 })
    .region('asia-northeast3')
    .https.onCall(async (data: { operationId?: unknown; items?: unknown[] }, context) => {
        const auth = await requireVehicleFineAccess(context);
        const operationId = asString(data?.operationId).slice(0, 220);
        const rawItems = Array.isArray(data?.items) ? data.items : [];
        if (!operationId || rawItems.length === 0 || rawItems.length > MAX_ITEMS_PER_COMMIT) {
            throw new functions.https.HttpsError('invalid-argument', `등록 항목은 1~${MAX_ITEMS_PER_COMMIT}건이어야 하며 operationId가 필요합니다.`);
        }

        const items = rawItems.map(sanitizeCommitItem);
        const db = admin.firestore();
        const operationRef = db.collection(SUPPORT_OPERATION_COLLECTION).doc(buildOperationDocumentId(operationId));
        try {
            const transactionResult = await db.runTransaction(async (transaction) => {
                const vehicleIds = Array.from(new Set(items.map((item) => item.vehicleId)));
                const vehicleRefs = vehicleIds.map((id) => db.collection('vehicles').doc(id));
                const expenseIds = items.map((item) => buildExpenseId(item.analysis.dedupeKey));
                const expenseRefs = Array.from(new Set(expenseIds)).map((id) => db.collection(VEHICLE_EXPENSE_COLLECTION).doc(id));
                const identityKeys = items.map((item) => buildVehicleImportIdentityKey(
                    'toll',
                    item.analysis.sourceSha256,
                    item.entryIndex,
                ));
                const identityIds = identityKeys.map(buildVehicleImportIdentityDocumentId);
                const identityRefs = Array.from(new Set(identityIds.filter(Boolean)))
                    .map((id) => db.collection(VEHICLE_IMPORT_IDENTITY_COLLECTION).doc(id));
                const vehicleSnaps = await Promise.all(vehicleRefs.map((ref) => transaction.get(ref)));
                const expenseSnaps = await Promise.all(expenseRefs.map((ref) => transaction.get(ref)));
                const identitySnaps = await Promise.all(identityRefs.map((ref) => transaction.get(ref)));
                const identityTargetExpenseIds = Array.from(new Set(identitySnaps
                    .filter((snap) => snap.exists)
                    .map((snap) => asString(snap.data()?.expenseId))
                    .filter(Boolean)));
                const identityTargetRefs = identityTargetExpenseIds
                    .filter((id) => !expenseIds.includes(id))
                    .map((id) => db.collection(VEHICLE_EXPENSE_COLLECTION).doc(id));
                const identityTargetSnaps = await Promise.all(identityTargetRefs.map((ref) => transaction.get(ref)));
                const operationSnap = await transaction.get(operationRef);
                const vehicleById = new Map(vehicleSnaps.map((snap) => [snap.id, snap]));
                const existingExpenseIds = new Set([
                    ...expenseSnaps.filter((snap) => snap.exists).map((snap) => snap.id),
                    ...identityTargetSnaps.filter((snap) => snap.exists).map((snap) => snap.id),
                ]);
                const identityRefById = new Map(identityRefs.map((ref) => [ref.id, ref]));
                const existingIdentityExpenseIds = new Map<string, string>(identitySnaps
                    .filter((snap) => snap.exists)
                    .map((snap): [string, string] => [snap.id, asString(snap.data()?.expenseId)])
                    .filter(([, linkedExpenseId]) => existingExpenseIds.has(linkedExpenseId)));
                const existingIdentityIds = new Set(existingIdentityExpenseIds.keys());
                const danglingIdentityExpenseIds = new Map<string, string>(identitySnaps
                    .filter((snap) => snap.exists && !existingIdentityIds.has(snap.id))
                    .map((snap): [string, string] => [snap.id, asString(snap.data()?.expenseId)]));
                const createdIds = new Set<string>();
                const claimedIdentityExpenseIds = new Map<string, string>();
                const results: Array<{ fileIndex: number; entryIndex: number; expenseId: string; status: 'created' | 'duplicate' }> = [];
                const now = admin.firestore.FieldValue.serverTimestamp();

                items.forEach((item, index) => {
                    const vehicleSnap = vehicleById.get(item.vehicleId);
                    if (!vehicleSnap?.exists) {
                        throw new functions.https.HttpsError('not-found', `선택한 차량을 찾을 수 없습니다: ${item.vehicleId}`);
                    }
                    const vehicle = vehicleSnap.data() || {};
                    const registeredPlate = normalizePlate(vehicle.licensePlate);
                    const extractedPlates = extractPlateCandidates([item.analysis.licensePlate, ...item.analysis.licensePlateCandidates]);
                    const fileNameSuffix = item.analysis.fileNameVehicleSuffix;
                    const matchesFileNameSuffix = Boolean(fileNameSuffix && registeredPlate.endsWith(fileNameSuffix));
                    if (!item.manualMatch && (!registeredPlate || (!extractedPlates.includes(registeredPlate) && !matchesFileNameSuffix))) {
                        throw new functions.https.HttpsError('failed-precondition', `${item.analysis.originalFileName}: 추출 차량번호와 선택 차량이 다릅니다. 차량을 수동으로 지정한 뒤 다시 확인해 주세요.`);
                    }

                    const expenseId = expenseIds[index];
                    const identityKey = identityKeys[index];
                    const identityId = identityIds[index];
                    const duplicateExpenseId = resolveVehicleImportDuplicateExpenseId({
                        expenseId,
                        identityId,
                        existingExpenseIds,
                        createdExpenseIds: createdIds,
                        existingIdentityIds,
                        existingIdentityExpenseIds,
                        claimedIdentityExpenseIds,
                    });
                    if (duplicateExpenseId) {
                        if (identityId && !existingIdentityIds.has(identityId) && !claimedIdentityExpenseIds.has(identityId)) {
                            claimedIdentityExpenseIds.set(identityId, duplicateExpenseId);
                            transaction.set(identityRefById.get(identityId)!, {
                                id: identityId,
                                kind: 'toll',
                                identityKey,
                                sourceSha256: item.analysis.sourceSha256,
                                entryIndex: item.entryIndex,
                                expenseId: duplicateExpenseId,
                                operationId,
                                recoveredDanglingExpenseId: danglingIdentityExpenseIds.get(identityId) || null,
                                createdAt: now,
                                updatedAt: now,
                            }, { merge: false });
                        }
                        results.push({ fileIndex: item.fileIndex, entryIndex: item.entryIndex, expenseId: duplicateExpenseId, status: 'duplicate' });
                        return;
                    }
                    createdIds.add(expenseId);
                    if (identityId) {
                        claimedIdentityExpenseIds.set(identityId, expenseId);
                        transaction.set(identityRefById.get(identityId)!, {
                            id: identityId,
                            kind: 'toll',
                            identityKey,
                            sourceSha256: item.analysis.sourceSha256,
                            entryIndex: item.entryIndex,
                            expenseId,
                            operationId,
                            recoveredDanglingExpenseId: danglingIdentityExpenseIds.get(identityId) || null,
                            createdAt: now,
                            updatedAt: now,
                        }, { merge: false });
                    }
                    transaction.set(db.collection(VEHICLE_EXPENSE_COLLECTION).doc(expenseId), {
                        id: expenseId,
                        vehicleId: item.vehicleId,
                        vehiclePlate: asString(vehicle.licensePlate),
                        date: item.expenseDate,
                        type: 'TOLL',
                        amount: item.amount,
                        payer: 'COMPANY',
                        status: 'ACTIVE',
                        note: buildTollNote(item),
                        operationId,
                        lastOperationId: operationId,
                        importSource: 'GEMINI_TOLL_USAGE',
                        tollUsage: {
                            sourceFileName: item.analysis.originalFileName,
                            sourceSha256: item.analysis.sourceSha256,
                            fileNameVehicleSuffix: item.analysis.fileNameVehicleSuffix,
                            provider: item.analysis.provider,
                            extractedLicensePlate: item.analysis.licensePlate,
                            licensePlateCandidates: item.analysis.licensePlateCandidates,
                            transactionDate: item.analysis.transactionDate,
                            transactionTime: item.analysis.transactionTime,
                            transactionDateTime: item.analysis.transactionDateTime,
                            entryTollgate: item.analysis.entryTollgate,
                            exitTollgate: item.analysis.exitTollgate,
                            routeName: item.analysis.routeName,
                            transactionNumber: item.analysis.transactionNumber,
                            approvalNumber: item.analysis.approvalNumber,
                            statementPeriod: item.analysis.statementPeriod,
                            totalCount: item.analysis.totalCount,
                            cardNumber: item.analysis.cardNumber,
                            amount: item.amount,
                            confidence: item.analysis.confidence,
                            warnings: item.analysis.warnings,
                            dedupeKey: item.analysis.dedupeKey,
                            manualMatch: item.manualMatch,
                        },
                        createdAt: now,
                        updatedAt: now,
                        cancelledAt: null,
                    }, { merge: false });
                    results.push({ fileIndex: item.fileIndex, entryIndex: item.entryIndex, expenseId, status: 'created' });
                });

                const previousAffectedDocumentIds = Array.isArray(operationSnap.data()?.affectedDocumentIds)
                    ? operationSnap.data()!.affectedDocumentIds.map(asString).filter(Boolean)
                    : [];
                const affectedDocumentIds = Array.from(new Set([
                    ...previousAffectedDocumentIds,
                    ...results.filter((result) => result.status === 'created').map((result) => result.expenseId),
                ]));
                transaction.set(operationRef, {
                    id: operationRef.id,
                    domain: 'vehicle',
                    yearMonth: items[0]?.expenseDate.slice(0, 7) || '',
                    operationId,
                    status: 'success',
                    affectedDocumentIds,
                    actor: {
                        uid: auth.uid,
                        name: asString(auth.token.name) || asString(auth.token.email) || auth.uid,
                        email: asString(auth.token.email) || null,
                    },
                    metadata: {
                        action: 'vehicle-toll-import',
                        requestedCount: items.length,
                        createdCount: results.filter((result) => result.status === 'created').length,
                        duplicateCount: results.filter((result) => result.status === 'duplicate').length,
                    },
                    createdAt: now,
                    createdAtIso: new Date().toISOString(),
                    updatedAt: now,
                    updatedAtIso: new Date().toISOString(),
                }, { merge: true });
                return results;
            });

            return {
                ok: true,
                operationId,
                createdCount: transactionResult.filter((result) => result.status === 'created').length,
                duplicateCount: transactionResult.filter((result) => result.status === 'duplicate').length,
                results: transactionResult,
            };
        } catch (error) {
            try {
                await operationRef.set({
                    id: operationRef.id,
                    domain: 'vehicle',
                    yearMonth: items[0]?.expenseDate.slice(0, 7) || '',
                    operationId,
                    status: 'failed',
                    affectedDocumentIds: [],
                    errorMessage: error instanceof Error ? error.message : asString(error),
                    userMessage: '등록되지 않았습니다. 내용을 확인한 뒤 다시 시도해 주세요.',
                    actor: {
                        uid: auth.uid,
                        name: asString(auth.token.name) || asString(auth.token.email) || auth.uid,
                        email: asString(auth.token.email) || null,
                    },
                    metadata: { action: 'vehicle-toll-import', requestedCount: items.length },
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAtIso: new Date().toISOString(),
                }, { merge: true });
            } catch (logError) {
                functions.logger.error('Vehicle toll failure log write failed', logError);
            }
            throw toHttpsError(error, '차량 통행료 등록에 실패했습니다.');
        }
    });
