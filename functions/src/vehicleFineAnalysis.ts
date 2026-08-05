import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { createHash } from 'crypto';
import { requireCallableAuth } from './auth';
import { getServerGeminiSettings } from './serverAiSettings';

declare const fetch: any;

interface FineFileInput {
    fileIndex: number;
    originalFileName: string;
    mimeType: string;
    base64: string;
}

interface FineNoticeAnalysis {
    fileIndex: number;
    originalFileName: string;
    issuer: string;
    noticeType: 'PARKING_FINE' | 'TRAFFIC_FINE' | 'OTHER';
    violationVehiclePlate: string;
    chargedTargetPlate: string;
    plateImagePlate: string;
    licensePlate: string;
    licensePlateCandidates: string[];
    plateSource: 'VIOLATION_VEHICLE' | 'CHARGED_VEHICLE' | 'PLATE_IMAGE' | 'UNKNOWN';
    plateEvidence: string;
    plateConfidence: number;
    violationDateTime: string;
    violationDate: string;
    violationLocation: string;
    violationDescription: string;
    dueDate: string;
    noticeNumber: string;
    electronicPaymentNumber: string;
    originalAmount: number;
    reductionAmount: number;
    payableAmount: number;
    driverPenaltyAmount: number;
    ownerFineAmount: number;
    confidence: number;
    warnings: string[];
    dedupeKey: string;
    duplicate: boolean;
    existingExpenseId: string;
}

interface CommitFineItem {
    fileIndex: number;
    vehicleId: string;
    manualMatch: boolean;
    expenseDate: string;
    payableAmount: number;
    analysis: FineNoticeAnalysis;
}

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
const MAX_FILES_PER_REQUEST = 6;
const MAX_ITEMS_PER_COMMIT = 20;
const MAX_FILE_BASE64_LENGTH = 11_000_000;
const MAX_TOTAL_BASE64_LENGTH = 8_000_000;
const VEHICLE_EXPENSE_COLLECTION = 'vehicleExpenses';
const SUPPORT_OPERATION_COLLECTION = 'support_write_operations';

const ALLOWED_ROLES = new Set([
    'admin', 'administrator', 'superadmin', 'owner', 'dev', 'developer', 'systemadmin',
    'support', 'supportmanager', 'office', 'officestaff', 'finance', 'financemanager',
    'accounting', 'accountingmanager', 'manager1', 'posmanager1',
    '관리자', '사장', '실장', '개발', '개발자', '지원담당', '지원담당자', '자산관리',
    '사무', '사무직원', '회계', '경리', '정산담당', '정산관리자',
]);

const FINE_NOTICE_SCHEMA = {
    type: 'object',
    properties: {
        notices: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    fileIndex: { type: 'integer' },
                    issuer: { type: 'string' },
                    noticeType: { type: 'string', enum: ['PARKING_FINE', 'TRAFFIC_FINE', 'OTHER'] },
                    violationVehiclePlate: { type: 'string' },
                    chargedTargetPlate: { type: 'string' },
                    plateImagePlate: { type: 'string' },
                    licensePlate: { type: 'string' },
                    licensePlateCandidates: { type: 'array', items: { type: 'string' } },
                    plateSource: { type: 'string', enum: ['VIOLATION_VEHICLE', 'CHARGED_VEHICLE', 'PLATE_IMAGE', 'UNKNOWN'] },
                    plateEvidence: { type: 'string' },
                    plateConfidence: { type: 'number' },
                    violationDateTime: { type: 'string' },
                    violationDate: { type: 'string' },
                    violationLocation: { type: 'string' },
                    violationDescription: { type: 'string' },
                    dueDate: { type: 'string' },
                    noticeNumber: { type: 'string' },
                    electronicPaymentNumber: { type: 'string' },
                    originalAmount: { type: 'number' },
                    reductionAmount: { type: 'number' },
                    payableAmount: { type: 'number' },
                    driverPenaltyAmount: { type: 'number' },
                    ownerFineAmount: { type: 'number' },
                    confidence: { type: 'number' },
                    warnings: { type: 'array', items: { type: 'string' } },
                },
                required: [
                    'fileIndex', 'issuer', 'noticeType', 'violationVehiclePlate', 'chargedTargetPlate',
                    'plateImagePlate', 'licensePlate', 'licensePlateCandidates',
                    'plateSource', 'plateEvidence', 'plateConfidence', 'violationDateTime',
                    'violationDate', 'violationLocation', 'violationDescription', 'dueDate',
                    'noticeNumber', 'electronicPaymentNumber', 'originalAmount', 'reductionAmount',
                    'payableAmount', 'driverPenaltyAmount', 'ownerFineAmount', 'confidence', 'warnings',
                ],
                propertyOrdering: [
                    'fileIndex', 'issuer', 'noticeType', 'violationVehiclePlate', 'chargedTargetPlate',
                    'plateImagePlate', 'licensePlate', 'licensePlateCandidates',
                    'plateSource', 'plateEvidence', 'plateConfidence', 'violationDateTime',
                    'violationDate', 'violationLocation', 'violationDescription', 'dueDate',
                    'noticeNumber', 'electronicPaymentNumber', 'originalAmount', 'reductionAmount',
                    'payableAmount', 'driverPenaltyAmount', 'ownerFineAmount', 'confidence', 'warnings',
                ],
            },
        },
    },
    required: ['notices'],
    propertyOrdering: ['notices'],
};

const PLATE_FOCUS_SCHEMA = {
    type: 'object',
    properties: {
        readings: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    fileIndex: { type: 'integer' },
                    chargedTargetPlate: { type: 'string' },
                    violationVehiclePlate: { type: 'string' },
                    plateImagePlate: { type: 'string' },
                    licensePlateCandidates: { type: 'array', items: { type: 'string' } },
                    rawPlateReadings: { type: 'array', items: { type: 'string' } },
                    plateEvidence: { type: 'string' },
                    plateConfidence: { type: 'number' },
                },
                required: [
                    'fileIndex', 'chargedTargetPlate', 'violationVehiclePlate', 'plateImagePlate',
                    'licensePlateCandidates', 'rawPlateReadings', 'plateEvidence', 'plateConfidence',
                ],
                propertyOrdering: [
                    'fileIndex', 'chargedTargetPlate', 'violationVehiclePlate', 'plateImagePlate',
                    'licensePlateCandidates', 'rawPlateReadings', 'plateEvidence', 'plateConfidence',
                ],
            },
        },
    },
    required: ['readings'],
    propertyOrdering: ['readings'],
};

const asString = (value: unknown): string => String(value ?? '').trim();
const asNumber = (value: unknown): number => {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
};
const clampAmount = (value: unknown): number => Math.max(0, Math.min(100_000_000, Math.round(asNumber(value))));
const clampConfidence = (value: unknown): number => Number(Math.max(0, Math.min(1, asNumber(value))).toFixed(3));
const normalizeRole = (value: unknown): string => asString(value).toLowerCase().replace(/[\s_-]+/g, '');
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
const sanitizeVehiclePlateHints = (value: unknown): string[] => Array.from(new Set(
    (Array.isArray(value) ? value : [])
        .map(normalizePlateCandidate)
        .filter(Boolean),
)).slice(0, 300);
const PLATE_SOURCES = new Set(['VIOLATION_VEHICLE', 'CHARGED_VEHICLE', 'PLATE_IMAGE', 'UNKNOWN']);
const normalizeIdentifier = (value: unknown): string => asString(value).replace(/[^0-9A-Za-z가-힣]/g, '').toUpperCase();
const normalizeIsoDate = (value: unknown): string => {
    const text = asString(value);
    const match = /^(\d{4})[-./년\s]+(\d{1,2})[-./월\s]+(\d{1,2})/.exec(text);
    if (!match) return '';
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return '';
    return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};
const normalizeDateTime = (value: unknown): string => {
    const text = asString(value);
    const date = normalizeIsoDate(text);
    if (!date) return '';
    const match = /(?:\d{1,2})\D+(?:\d{1,2})\D+(?:\d{1,2})[^0-9]+(\d{1,2})[:시\s]+(\d{1,2})(?:[:분\s]+(\d{1,2}))?/.exec(text);
    if (!match) return `${date}T00:00:00`;
    const hour = Math.min(23, Number(match[1]));
    const minute = Math.min(59, Number(match[2]));
    const second = Math.min(59, Number(match[3] || 0));
    return `${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
};
const asWarnings = (value: unknown): string[] => Array.isArray(value)
    ? Array.from(new Set(value.map(asString).filter(Boolean))).slice(0, 20)
    : [];

const hasAllowedRole = (value: unknown): boolean => {
    if (Array.isArray(value)) return value.some(hasAllowedRole);
    return ALLOWED_ROLES.has(normalizeRole(value));
};

const hasVehicleFineAccess = (source: Record<string, unknown>): boolean => (
    source.isAdmin === true
    || source.admin === true
    || hasAllowedRole(source.role)
    || hasAllowedRole(source.position)
    || hasAllowedRole(source.systemRole)
    || hasAllowedRole(source.accountType)
    || hasAllowedRole(source.roles)
    || hasAllowedRole(source.additionalPositions)
    || hasAllowedRole(source.erpRoleGroups)
);

const requireVehicleFineAccess = async (
    context: functions.https.CallableContext,
): Promise<NonNullable<functions.https.CallableContext['auth']>> => {
    const auth = requireCallableAuth(context);
    if (hasVehicleFineAccess((auth.token || {}) as Record<string, unknown>)) return auth;
    const user = await admin.firestore().collection('users').doc(auth.uid).get();
    if (hasVehicleFineAccess(user.data() || {})) return auth;
    throw new functions.https.HttpsError('permission-denied', '차량 과태료 분석 및 등록 권한이 없습니다.');
};

const sanitizeFile = (value: unknown): FineFileInput => {
    const source = (value || {}) as Record<string, unknown>;
    const fileIndex = Math.floor(asNumber(source.fileIndex));
    const originalFileName = asString(source.originalFileName).slice(0, 180);
    const mimeType = asString(source.mimeType).toLowerCase();
    const base64 = asString(source.base64);
    if (!Number.isInteger(fileIndex) || fileIndex < 0) {
        throw new functions.https.HttpsError('invalid-argument', '첨부 파일 순번이 올바르지 않습니다.');
    }
    if (!originalFileName || !ALLOWED_MIME_TYPES.has(mimeType)) {
        throw new functions.https.HttpsError('invalid-argument', '첨부 파일 이름 또는 형식이 올바르지 않습니다.');
    }
    if (!base64 || base64.length > MAX_FILE_BASE64_LENGTH || !/^[A-Za-z0-9+/=]+$/.test(base64)) {
        throw new functions.https.HttpsError('invalid-argument', `${originalFileName}: 파일 데이터가 올바르지 않습니다.`);
    }
    return { fileIndex, originalFileName, mimeType, base64 };
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

const buildDedupeKey = (notice: Pick<FineNoticeAnalysis,
    'electronicPaymentNumber' | 'noticeNumber' | 'issuer' | 'licensePlate' |
    'violationDateTime' | 'violationDate' | 'payableAmount' | 'violationLocation'>): string => {
    const payment = normalizeIdentifier(notice.electronicPaymentNumber);
    if (payment) return `payment:${payment}`;
    const noticeNumber = normalizeIdentifier(notice.noticeNumber);
    if (noticeNumber) return `notice:${normalizeIdentifier(notice.issuer)}:${noticeNumber}`;
    return [
        'fallback',
        normalizePlate(notice.licensePlate),
        notice.violationDateTime || notice.violationDate,
        String(Math.round(notice.payableAmount || 0)),
        asString(notice.violationLocation).replace(/\s+/g, ''),
    ].join(':');
};

const buildExpenseId = (dedupeKey: string): string => `vehicle_fine_${createHash('sha256').update(dedupeKey).digest('hex').slice(0, 36)}`;
const buildOperationDocumentId = (operationId: string): string => `vehicle_${createHash('sha256').update(operationId).digest('hex').slice(0, 36)}`;

const sanitizeNotice = (value: unknown, file: FineFileInput): FineNoticeAnalysis => {
    const source = (value || {}) as Record<string, unknown>;
    const warnings = asWarnings(source.warnings);
    const violationVehiclePlate = normalizePlateCandidate(source.violationVehiclePlate);
    const chargedTargetPlate = normalizePlateCandidate(source.chargedTargetPlate);
    const plateImagePlate = normalizePlateCandidate(source.plateImagePlate);
    const explicitPlate = normalizePlateCandidate(source.licensePlate);
    const licensePlateCandidates = extractPlateCandidates([
        source.chargedTargetPlate,
        source.violationVehiclePlate,
        source.plateImagePlate,
        source.licensePlate,
        ...(Array.isArray(source.licensePlateCandidates) ? source.licensePlateCandidates : []),
        source.plateEvidence,
    ]);
    const labelPlateCandidates = [chargedTargetPlate, violationVehiclePlate].filter(Boolean);
    const hasPlateConflict = new Set([chargedTargetPlate, violationVehiclePlate, plateImagePlate].filter(Boolean)).size > 1;
    const licensePlate = (chargedTargetPlate || violationVehiclePlate || plateImagePlate || explicitPlate || licensePlateCandidates[0] || '').slice(0, 30);
    const plateSourceText = asString(source.plateSource);
    const inferredPlateSource = chargedTargetPlate
        ? 'CHARGED_VEHICLE'
        : violationVehiclePlate
            ? 'VIOLATION_VEHICLE'
            : plateImagePlate
                ? 'PLATE_IMAGE'
                : 'UNKNOWN';
    const plateSource = (inferredPlateSource !== 'UNKNOWN'
        ? inferredPlateSource
        : PLATE_SOURCES.has(plateSourceText) ? plateSourceText : 'UNKNOWN') as FineNoticeAnalysis['plateSource'];
    const evidenceParts = [
        chargedTargetPlate ? `부과대상: ${chargedTargetPlate}` : '',
        violationVehiclePlate ? `위반차량: ${violationVehiclePlate}` : '',
        plateImagePlate ? `차량 사진 번호판: ${plateImagePlate}` : '',
    ].filter(Boolean);
    const plateEvidence = (evidenceParts.join(' / ') || asString(source.plateEvidence)).slice(0, 180);
    const rawPlateConfidence = asNumber(source.plateConfidence ?? source.confidence);
    const plateConfidence = clampConfidence(hasPlateConflict ? Math.min(rawPlateConfidence, 0.6) : rawPlateConfidence);
    const violationDateTime = normalizeDateTime(source.violationDateTime);
    const violationDate = normalizeIsoDate(source.violationDate) || violationDateTime.slice(0, 10);
    const dueDate = normalizeIsoDate(source.dueDate);
    let payableAmount = clampAmount(source.payableAmount);
    const originalAmount = clampAmount(source.originalAmount);
    const reductionAmount = clampAmount(source.reductionAmount);
    const ownerFineAmount = clampAmount(source.ownerFineAmount);
    const driverPenaltyAmount = clampAmount(source.driverPenaltyAmount);
    const noticeTypeText = asString(source.noticeType);
    const noticeType: FineNoticeAnalysis['noticeType'] = noticeTypeText === 'PARKING_FINE' || noticeTypeText === 'TRAFFIC_FINE'
        ? noticeTypeText
        : 'OTHER';
    if (noticeType === 'TRAFFIC_FINE' && ownerFineAmount > 0 && payableAmount !== ownerFineAmount) {
        payableAmount = ownerFineAmount;
        warnings.push(`운전자 범칙금이 아닌 차량 소유자 과태료 ${ownerFineAmount.toLocaleString('ko-KR')}원을 적용했습니다.`);
    }
    if (!normalizePlate(licensePlate)) warnings.push('차량번호를 읽지 못했습니다.');
    if (labelPlateCandidates.length === 0 && plateImagePlate) warnings.push('부과대상 또는 위반차량 항목을 읽지 못해 차량 사진 번호판을 보조 기준으로 사용했습니다.');
    if (chargedTargetPlate && violationVehiclePlate && chargedTargetPlate !== violationVehiclePlate) warnings.push('부과대상과 위반차량 번호가 서로 달라 차량 연결 전 수동 검수가 필요합니다.');
    if (hasPlateConflict && plateImagePlate && (plateImagePlate !== chargedTargetPlate && plateImagePlate !== violationVehiclePlate)) warnings.push('차량 사진 번호판과 문서의 차량번호가 달라 수동 검수가 필요합니다.');
    if (licensePlateCandidates.length > 1) warnings.push('위반차량/부과대상에서 차량번호 후보가 여러 개 확인되어 수동 검수가 필요합니다.');
    if (plateSource === 'UNKNOWN' && licensePlate) warnings.push('위반차량 또는 부과대상 라벨의 판독 근거가 명확하지 않습니다.');
    if (!violationDate) warnings.push('위반일자를 읽지 못했습니다.');
    if (payableAmount <= 0) warnings.push('실제 납부할 과태료 금액을 읽지 못했습니다.');
    if (ownerFineAmount > 0 && driverPenaltyAmount > 0 && ownerFineAmount !== driverPenaltyAmount) {
        warnings.push(`차량 소유자 과태료 ${ownerFineAmount.toLocaleString('ko-KR')}원과 운전자 범칙금 ${driverPenaltyAmount.toLocaleString('ko-KR')}원이 다릅니다. 과태료 금액을 우선했습니다.`);
    }

    const result: FineNoticeAnalysis = {
        fileIndex: file.fileIndex,
        originalFileName: file.originalFileName,
        issuer: asString(source.issuer).slice(0, 120),
        noticeType,
        violationVehiclePlate,
        chargedTargetPlate,
        plateImagePlate,
        licensePlate,
        licensePlateCandidates,
        plateSource,
        plateEvidence,
        plateConfidence,
        violationDateTime,
        violationDate,
        violationLocation: asString(source.violationLocation).slice(0, 300),
        violationDescription: asString(source.violationDescription).slice(0, 200),
        dueDate,
        noticeNumber: asString(source.noticeNumber).slice(0, 120),
        electronicPaymentNumber: asString(source.electronicPaymentNumber).slice(0, 120),
        originalAmount,
        reductionAmount,
        payableAmount,
        driverPenaltyAmount,
        ownerFineAmount,
        confidence: clampConfidence(source.confidence),
        warnings: Array.from(new Set(warnings)),
        dedupeKey: '',
        duplicate: false,
        existingExpenseId: '',
    };
    result.dedupeKey = buildDedupeKey(result);
    return result;
};

const buildPrompt = (files: FineFileInput[], vehiclePlateHints: string[]): string => `
You extract Korean vehicle traffic and parking fine notices into structured JSON.
There are ${files.length} attachments. Each attachment is preceded by FILE_INDEX. Return exactly one notices[] item for every FILE_INDEX.

Known vehicle-ledger plates for OCR disambiguation only:
${vehiclePlateHints.length > 0 ? vehiclePlateHints.join(', ') : '(none provided)'}

Critical rules:
- Treat a vehicle plate as a strict Korean plate pattern: 2 or 3 digits + one Korean Hangul vehicle letter (or a Latin letter when visibly printed) + 4 digits, for example 198하3585, 198하5969, or 141하8983. Never return a bank account, barcode, electronic payment number, notice number, phone number, postal code, or date as a plate.
- Extract the three plate evidence fields independently and do not copy one into another: violationVehiclePlate is only the value beside "위반차량" or "위반차량번호"; chargedTargetPlate is only the value beside "부과대상" or "부과대상 차량"; plateImagePlate is only the clearly visible plate in the violation/evidence vehicle photo. Return the canonical plate only, with no label, spaces, or punctuation. Return an empty string when that evidence is absent or unreadable.
- Read the blue "부과내역" box and the exact value to the right of "부과대상" before reading any other numbers. For police notices, read the exact value in the violation table beside "위반차량". Do not treat the recipient, payer, company, address, or handwritten memo as the vehicle.
- If the document field is blurred but a vehicle photo clearly shows the plate, use plateImagePlate as a secondary value. If document text and photo disagree, preserve both values and lower plateConfidence; never choose by guessing.
- First read the printed plate independently. Then compare it with the known vehicle-ledger plates only to resolve a single visually ambiguous character such as 하/허/호, 0/8, 1/7, or OCR letters O/I/S/B. Never select a ledger plate when the document does not provide matching visual evidence. When a ledger hint resolves an ambiguous character, transcribe the raw visual reading in plateEvidence and return the canonical ledger plate in the corresponding plate field.
- Vehicle identification is the highest-priority extraction task. First locate the penalty-detail fields labelled "위반차량", "부과대상", "부과대상 차량", "위반차량번호", or "차량번호". The value in those fields is the plate to connect to the vehicle ledger.
- For a local-government notice, inspect the blue "부과내역" box and read the value beside "부과대상". For a police notice, inspect the violation table and read the value beside "위반차량". Use the plate printed in the violation photo only as a secondary cross-check.
- licensePlate must be the best plate from those labelled fields. licensePlateCandidates must contain every distinct, legible plate found only in the labelled violation/charged-vehicle fields or the plate photo, with a maximum of 3 values. If the labelled fields disagree, preserve both candidates and lower confidence instead of guessing.
- plateSource must be one of VIOLATION_VEHICLE, CHARGED_VEHICLE, PLATE_IMAGE, or UNKNOWN. plateEvidence must be a short transcription such as "부과대상: 198하3585" or "위반차량: 198하5969". plateConfidence is the confidence for the plate only, from 0 to 1.
- Never use the postal recipient, leasing-company name, payer, address, barcode, electronic payment number, bank account number, document identifier, or handwritten memo as a plate. Do not infer a plate from a company name.
- licensePlate is the vehicle plate in the penalty details, usually labelled "부과대상", "위반차량", or shown in the violation table. Do not use the postal recipient, leasing-company name, address, barcode, account number, or handwritten memo as the plate.
- For local-government parking notices, payableAmount is the discounted current amount labelled "최종금액" or "납기내금액". originalAmount is "최초과태료" and reductionAmount is "감경금액".
- For police "위반사실 통지 및 과태료부과 사전통지서", this workflow registers a vehicle-owner 과태료. payableAmount must be the current "과태료 사전납부 금액". Do not use the driver-confirmed 범칙금/벌점 amount and do not use the higher amount payable after the prepayment deadline.
- ownerFineAmount is the owner 과태료 amount; driverPenaltyAmount is the alternative driver-confirmed 범칙금 only when both are printed. Add a Korean warning when they differ.
- dueDate is the deadline for payableAmount. violationDateTime must be YYYY-MM-DDTHH:mm:ss and violationDate YYYY-MM-DD. Use empty strings when unreadable.
- electronicPaymentNumber is "전자납부번호". noticeNumber is a unique 과태료고지번호, 일반번호, 납부번호, or equivalent notice identifier, excluding bank accounts.
- violationLocation and violationDescription must come from the violation details, not the recipient address or handwritten notes.
- noticeType is PARKING_FINE for parking/stopping violations, TRAFFIC_FINE for signal/speed/traffic violations, otherwise OTHER.
- confidence is 0..1. Never guess unreadable identifiers, dates, plate, or amount. Use empty string/0 and add Korean warnings.
- Return JSON only, matching the response schema.
`;

const buildPlateFocusPrompt = (files: FineFileInput[], vehiclePlateHints: string[]): string => `
Perform a second, plate-only OCR inspection of ${files.length} Korean vehicle fine notice attachment(s).
Return exactly one readings[] item for every FILE_INDEX. Ignore amounts, dates, addresses, account numbers, barcodes, and notice numbers.

Known vehicle-ledger plates for visual disambiguation only:
${vehiclePlateHints.length > 0 ? vehiclePlateHints.join(', ') : '(none provided)'}

Inspection sequence for every file:
1. Zoom mentally into the printed penalty-detail box and independently read the value beside "부과대상", "부과대상 차량", "위반차량", "위반차량번호", or "차량번호".
2. Separately inspect every evidence photo containing the front or rear license plate.
3. Transcribe each visible reading into rawPlateReadings before correcting OCR ambiguity.
4. A valid target has 2 or 3 leading digits, one Hangul vehicle letter, and 4 trailing digits. Carefully distinguish 하/허/호 and 0/8, 1/7, 3/8, 5/6. OCR letters O/I/S/B in numeric positions may represent 0/1/5/8.
5. Compare with the known ledger list only after visual reading. Canonicalize to a ledger plate only when all but one visually ambiguous character agree. Never invent a ledger plate solely because it is in the list.
6. chargedTargetPlate comes only from a labelled 부과대상 field; violationVehiclePlate only from a labelled 위반차량 field; plateImagePlate only from a visible vehicle photo. Keep empty strings for absent evidence.
7. Preserve disagreements as separate candidates and lower plateConfidence. plateEvidence must briefly state where each reading came from.
Return JSON only.
`;

const requestPlateFocusReadings = async (
    endpoint: string,
    files: FineFileInput[],
    vehiclePlateHints: string[],
): Promise<Map<number, Record<string, unknown>>> => {
    const parts: Array<Record<string, unknown>> = [{ text: buildPlateFocusPrompt(files, vehiclePlateHints) }];
    files.forEach((file) => {
        parts.push({ text: `FILE_INDEX=${file.fileIndex}\nFILE_NAME=${file.originalFileName}` });
        parts.push({ inlineData: { mimeType: file.mimeType, data: file.base64 } });
    });
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ role: 'user', parts }],
            generationConfig: {
                temperature: 0,
                responseMimeType: 'application/json',
                responseJsonSchema: PLATE_FOCUS_SCHEMA,
            },
        }),
    });
    const rawResponse = await response.text();
    let payload: any = null;
    try { payload = rawResponse ? JSON.parse(rawResponse) : null; } catch { payload = null; }
    if (!response.ok) {
        throw new Error(asString(payload?.error?.message) || `${response.status} ${response.statusText}`);
    }
    const text = extractGeminiText(payload);
    if (!text) throw new Error('차량번호 집중 판독 결과가 비어 있습니다.');
    const parsed = parseJsonObject(text);
    const readings = Array.isArray(parsed.readings) ? parsed.readings : [];
    const byIndex = new Map<number, Record<string, unknown>>();
    readings.forEach((value) => {
        const fileIndex = Math.floor(asNumber(value?.fileIndex));
        if (files.some((file) => file.fileIndex === fileIndex) && !byIndex.has(fileIndex)) {
            byIndex.set(fileIndex, value as Record<string, unknown>);
        }
    });
    return byIndex;
};

const toHttpsError = (error: unknown, fallback: string): functions.https.HttpsError => {
    if (error instanceof functions.https.HttpsError) return error;
    const message = error instanceof Error ? error.message : asString(error) || fallback;
    const lower = message.toLowerCase();
    if (lower.includes('api key') || lower.includes('permission') || lower.includes('forbidden')) {
        return new functions.https.HttpsError('failed-precondition', `/settings/ai 서버 Gemini 설정을 확인해 주세요. ${message}`);
    }
    if (lower.includes('quota') || lower.includes('rate limit') || lower.includes('resource exhausted')) {
        return new functions.https.HttpsError('resource-exhausted', `Gemini 사용량 한도에 도달했습니다. ${message}`);
    }
    return new functions.https.HttpsError('internal', `${fallback} ${message}`);
};

export const analyzeVehicleFineNotices = functions
    .runWith({ timeoutSeconds: 300, memory: '1GB', maxInstances: 5 })
    .region('asia-northeast3')
    .https.onCall(async (data: { files?: unknown[]; vehiclePlates?: unknown[] }, context) => {
        try {
            await requireVehicleFineAccess(context);
            const rawFiles = Array.isArray(data?.files) ? data.files : [];
            if (rawFiles.length === 0 || rawFiles.length > MAX_FILES_PER_REQUEST) {
                throw new functions.https.HttpsError('invalid-argument', `한 번에 1~${MAX_FILES_PER_REQUEST}개 파일을 분석할 수 있습니다.`);
            }
            const files = rawFiles.map(sanitizeFile);
            const vehiclePlateHints = sanitizeVehiclePlateHints(data?.vehiclePlates);
            if (new Set(files.map((file) => file.fileIndex)).size !== files.length) {
                throw new functions.https.HttpsError('invalid-argument', '첨부 파일 순번이 중복되었습니다.');
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
            const parts: Array<Record<string, unknown>> = [{ text: buildPrompt(files, vehiclePlateHints) }];
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
                        responseJsonSchema: FINE_NOTICE_SCHEMA,
                    },
                }),
            });
            const rawResponse = await response.text();
            let payload: any = null;
            try { payload = rawResponse ? JSON.parse(rawResponse) : null; } catch { payload = null; }
            if (!response.ok) {
                const message = asString(payload?.error?.message) || `${response.status} ${response.statusText}`;
                functions.logger.error('Vehicle fine Gemini analysis failed', { status: response.status, model, fileCount: files.length, message });
                throw new Error(message);
            }

            const text = extractGeminiText(payload);
            if (!text) throw new Error('Gemini 분석 결과가 비어 있습니다.');
            const parsed = parseJsonObject(text);
            const parsedNotices = Array.isArray(parsed.notices) ? parsed.notices : [];
            const rawByIndex = new Map<number, Record<string, unknown>>();
            parsedNotices.forEach((value) => {
                const fileIndex = Math.floor(asNumber(value?.fileIndex));
                const file = files.find((item) => item.fileIndex === fileIndex);
                if (file && !rawByIndex.has(fileIndex)) rawByIndex.set(fileIndex, value as Record<string, unknown>);
            });
            let notices = files.map((file) => sanitizeNotice(rawByIndex.get(file.fileIndex) || {
                fileIndex: file.fileIndex,
                warnings: ['Gemini가 이 파일의 분석 결과를 반환하지 않았습니다. 다시 분석해 주세요.'],
            }, file));

            try {
                const focusedByIndex = await requestPlateFocusReadings(endpoint, files, vehiclePlateHints);
                notices = files.map((file, index) => {
                    const focused = focusedByIndex.get(file.fileIndex);
                    if (!focused) return notices[index];
                    const primary = rawByIndex.get(file.fileIndex) || {};
                    const primaryCandidates = Array.isArray(primary.licensePlateCandidates)
                        ? primary.licensePlateCandidates
                        : [];
                    const focusedCandidates = Array.isArray(focused.licensePlateCandidates)
                        ? focused.licensePlateCandidates
                        : [];
                    const rawPlateReadings = Array.isArray(focused.rawPlateReadings)
                        ? focused.rawPlateReadings
                        : [];
                    const mergedWarnings = asWarnings(primary.warnings);
                    mergedWarnings.push('차량번호를 별도 집중 판독으로 교차 확인했습니다.');
                    return sanitizeNotice({
                        ...primary,
                        chargedTargetPlate: focused.chargedTargetPlate || primary.chargedTargetPlate,
                        violationVehiclePlate: focused.violationVehiclePlate || primary.violationVehiclePlate,
                        plateImagePlate: focused.plateImagePlate || primary.plateImagePlate,
                        licensePlateCandidates: [
                            focused.chargedTargetPlate,
                            focused.violationVehiclePlate,
                            focused.plateImagePlate,
                            ...focusedCandidates,
                            ...rawPlateReadings,
                            primary.chargedTargetPlate,
                            primary.violationVehiclePlate,
                            primary.plateImagePlate,
                            primary.licensePlate,
                            ...primaryCandidates,
                        ],
                        plateEvidence: [primary.plateEvidence, focused.plateEvidence]
                            .map(asString)
                            .filter(Boolean)
                            .join(' / '),
                        plateConfidence: Math.max(
                            asNumber(primary.plateConfidence ?? primary.confidence),
                            asNumber(focused.plateConfidence),
                        ),
                        warnings: mergedWarnings,
                    }, file);
                });
            } catch (plateFocusError) {
                functions.logger.warn('Vehicle fine plate-focused analysis failed; using primary result', {
                    model,
                    fileCount: files.length,
                    message: plateFocusError instanceof Error ? plateFocusError.message : asString(plateFocusError),
                });
            }

            const refs = Array.from(new Set(notices.map((notice) => buildExpenseId(notice.dedupeKey))))
                .map((id) => admin.firestore().collection(VEHICLE_EXPENSE_COLLECTION).doc(id));
            const existingSnaps = refs.length > 0 ? await admin.firestore().getAll(...refs) : [];
            const existingIds = new Set(existingSnaps.filter((snap) => snap.exists).map((snap) => snap.id));
            const seenIds = new Set<string>();
            notices.forEach((notice) => {
                const expenseId = buildExpenseId(notice.dedupeKey);
                const duplicateInBatch = seenIds.has(expenseId);
                seenIds.add(expenseId);
                notice.duplicate = existingIds.has(expenseId) || duplicateInBatch;
                notice.existingExpenseId = notice.duplicate ? expenseId : '';
                if (duplicateInBatch) notice.warnings.push('같은 분석 묶음에 동일한 고지서가 중복 첨부되었습니다.');
                if (existingIds.has(expenseId)) notice.warnings.push('이미 차량 과태료 대장에 등록된 고지서입니다.');
            });

            functions.logger.info('Vehicle fine analysis completed', {
                model,
                fileCount: files.length,
                vehiclePlateHintCount: vehiclePlateHints.length,
            });
            return { ok: true, model, notices };
        } catch (error) {
            throw toHttpsError(error, '차량 과태료 고지서 분석에 실패했습니다.');
        }
    });

const sanitizeCommitItem = (value: unknown): CommitFineItem => {
    const source = (value || {}) as Record<string, unknown>;
    const analysisSource = (source.analysis || {}) as Record<string, unknown>;
    const fileIndex = Math.floor(asNumber(source.fileIndex));
    const vehicleId = asString(source.vehicleId);
    const expenseDate = normalizeIsoDate(source.expenseDate);
    const payableAmount = clampAmount(source.payableAmount);
    const analysis = sanitizeNotice(analysisSource, {
        fileIndex,
        originalFileName: asString(analysisSource.originalFileName).slice(0, 180) || `file-${fileIndex}`,
        mimeType: 'image/jpeg',
        base64: 'AA==',
    });
    if (!Number.isInteger(fileIndex) || fileIndex < 0 || !vehicleId || !expenseDate || payableAmount <= 0) {
        throw new functions.https.HttpsError('invalid-argument', '과태료 확정 항목의 차량, 일자 또는 금액이 올바르지 않습니다.');
    }
    if (!analysis.dedupeKey || (!normalizePlate(analysis.licensePlate) && source.manualMatch !== true)) {
        throw new functions.https.HttpsError('invalid-argument', '차량번호를 확인하거나 수동 매칭으로 지정해 주세요.');
    }
    return {
        fileIndex,
        vehicleId,
        manualMatch: source.manualMatch === true,
        expenseDate,
        payableAmount,
        analysis,
    };
};

const buildFineNote = (item: CommitFineItem): string => [
    item.analysis.violationDescription,
    item.analysis.violationLocation,
    item.analysis.dueDate ? `납부기한 ${item.analysis.dueDate}` : '',
    item.analysis.noticeNumber ? `고지번호 ${item.analysis.noticeNumber}` : '',
    item.analysis.electronicPaymentNumber ? `전자납부번호 ${item.analysis.electronicPaymentNumber}` : '',
].filter(Boolean).join(' · ').slice(0, 900);

export const commitVehicleFineImports = functions
    .runWith({ timeoutSeconds: 120, memory: '512MB', maxInstances: 10 })
    .region('asia-northeast3')
    .https.onCall(async (data: { operationId?: unknown; items?: unknown[] }, context) => {
        const auth = await requireVehicleFineAccess(context);
        const operationId = asString(data?.operationId).slice(0, 220);
        const rawItems = Array.isArray(data?.items) ? data.items : [];
        if (!operationId || rawItems.length === 0 || rawItems.length > MAX_ITEMS_PER_COMMIT) {
            throw new functions.https.HttpsError('invalid-argument', `확정 항목은 1~${MAX_ITEMS_PER_COMMIT}건이어야 하며 operationId가 필요합니다.`);
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
                const vehicleSnaps = await Promise.all(vehicleRefs.map((ref) => transaction.get(ref)));
                const expenseSnaps = await Promise.all(expenseRefs.map((ref) => transaction.get(ref)));
                const operationSnap = await transaction.get(operationRef);
                const vehicleById = new Map(vehicleSnaps.map((snap) => [snap.id, snap]));
                const existingExpenseIds = new Set(expenseSnaps.filter((snap) => snap.exists).map((snap) => snap.id));
                const createdIds = new Set<string>();
                const results: Array<{ fileIndex: number; expenseId: string; status: 'created' | 'duplicate' }> = [];
                const now = admin.firestore.FieldValue.serverTimestamp();

                items.forEach((item, index) => {
                    const vehicleSnap = vehicleById.get(item.vehicleId);
                    if (!vehicleSnap?.exists) {
                        throw new functions.https.HttpsError('not-found', `선택한 차량을 찾을 수 없습니다: ${item.vehicleId}`);
                    }
                    const vehicle = vehicleSnap.data() || {};
                    const registeredPlate = normalizePlate(vehicle.licensePlate);
                    const extractedPlates = extractPlateCandidates([
                        item.analysis.licensePlate,
                        ...item.analysis.licensePlateCandidates,
                    ]);
                    if (!item.manualMatch && (!registeredPlate || !extractedPlates.includes(registeredPlate))) {
                        throw new functions.https.HttpsError('failed-precondition', `${item.analysis.originalFileName}: 추출 차량번호와 선택 차량이 다릅니다. 수동 매칭으로 다시 검수해 주세요.`);
                    }

                    const expenseId = expenseIds[index];
                    if (existingExpenseIds.has(expenseId) || createdIds.has(expenseId)) {
                        results.push({ fileIndex: item.fileIndex, expenseId, status: 'duplicate' });
                        return;
                    }
                    createdIds.add(expenseId);
                    const fineChargeTarget = vehicle.fineChargeTarget === 'DRIVER' ? 'DRIVER' : 'BILLING_TARGET';
                    transaction.set(db.collection(VEHICLE_EXPENSE_COLLECTION).doc(expenseId), {
                        id: expenseId,
                        vehicleId: item.vehicleId,
                        vehiclePlate: asString(vehicle.licensePlate),
                        date: item.expenseDate,
                        type: 'FINE',
                        amount: item.payableAmount,
                        payer: fineChargeTarget === 'DRIVER' ? 'DRIVER' : 'COMPANY',
                        fineChargeTarget,
                        status: 'ACTIVE',
                        note: buildFineNote(item),
                        operationId,
                        lastOperationId: operationId,
                        importSource: 'GEMINI_FINE_NOTICE',
                        fineNotice: {
                            sourceFileName: item.analysis.originalFileName,
                            issuer: item.analysis.issuer,
                            noticeType: item.analysis.noticeType,
                            violationVehiclePlate: item.analysis.violationVehiclePlate,
                            chargedTargetPlate: item.analysis.chargedTargetPlate,
                            plateImagePlate: item.analysis.plateImagePlate,
                            extractedLicensePlate: item.analysis.licensePlate,
                             licensePlateCandidates: item.analysis.licensePlateCandidates,
                             plateSource: item.analysis.plateSource,
                             plateEvidence: item.analysis.plateEvidence,
                             plateConfidence: item.analysis.plateConfidence,
                             violationDateTime: item.analysis.violationDateTime,
                            violationLocation: item.analysis.violationLocation,
                            violationDescription: item.analysis.violationDescription,
                            dueDate: item.analysis.dueDate,
                            noticeNumber: item.analysis.noticeNumber,
                            electronicPaymentNumber: item.analysis.electronicPaymentNumber,
                            originalAmount: item.analysis.originalAmount,
                            reductionAmount: item.analysis.reductionAmount,
                            payableAmount: item.payableAmount,
                            driverPenaltyAmount: item.analysis.driverPenaltyAmount,
                            ownerFineAmount: item.analysis.ownerFineAmount,
                            confidence: item.analysis.confidence,
                            warnings: item.analysis.warnings,
                            dedupeKey: item.analysis.dedupeKey,
                            manualMatch: item.manualMatch,
                        },
                        createdAt: now,
                        updatedAt: now,
                        cancelledAt: null,
                    }, { merge: false });
                    results.push({ fileIndex: item.fileIndex, expenseId, status: 'created' });
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
                        action: 'vehicle-fine-import',
                        requestedCount: items.length,
                        createdCount: affectedDocumentIds.length,
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
                    userMessage: '저장되지 않았습니다. 내용을 확인한 뒤 다시 시도해 주세요.',
                    actor: {
                        uid: auth.uid,
                        name: asString(auth.token.name) || asString(auth.token.email) || auth.uid,
                        email: asString(auth.token.email) || null,
                    },
                    metadata: { action: 'vehicle-fine-import', requestedCount: items.length },
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAtIso: new Date().toISOString(),
                }, { merge: true });
            } catch (logError) {
                functions.logger.error('Vehicle fine failure log write failed', logError);
            }
            throw toHttpsError(error, '차량 과태료 등록에 실패했습니다.');
        }
    });
