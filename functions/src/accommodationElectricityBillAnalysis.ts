import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { createHash } from 'crypto';
import { requireCallableAuth } from './auth';
import { getServerGeminiSettings } from './serverAiSettings';

declare const fetch: any;

interface ElectricityBillFileInput {
    fileIndex: number;
    originalFileName: string;
    mimeType: string;
    base64: string;
    sourceFileSha256: string;
}

interface AnalyzeElectricityBillsRequest {
    yearMonth: string;
    files: ElectricityBillFileInput[];
}

interface ElectricityBillAnalysis {
    fileIndex: number;
    originalFileName: string;
    sourceFileSha256: string;
    provider: string;
    customerName: string;
    customerNumber: string;
    billingYearMonth: string;
    dueDate: string;
    usagePeriodStart: string;
    usagePeriodEnd: string;
    address: string;
    housingName: string;
    electricityAmount: number;
    usageKwh: number;
    confidence: number;
    warnings: string[];
}

interface GasBillAnalysis {
    fileIndex: number;
    originalFileName: string;
    sourceFileSha256: string;
    provider: string;
    customerName: string;
    payerNumber: string;
    billingYearMonth: string;
    dueDate: string;
    usagePeriodStart: string;
    usagePeriodEnd: string;
    address: string;
    housingName: string;
    gasAmount: number;
    usageCubicMeters: number;
    confidence: number;
    warnings: string[];
}

interface WaterBillAnalysis {
    fileIndex: number;
    originalFileName: string;
    sourceFileSha256: string;
    provider: string;
    customerName: string;
    consumerNumber: string;
    billingYearMonth: string;
    dueDate: string;
    usagePeriodStart: string;
    usagePeriodEnd: string;
    address: string;
    housingName: string;
    waterAmount: number;
    usageCubicMeters: number;
    confidence: number;
    warnings: string[];
}

const ALLOWED_MIME_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
]);
const MAX_FILES_PER_REQUEST = 8;
const MAX_FILE_BASE64_LENGTH = 10_700_000;
const MAX_TOTAL_BASE64_LENGTH = 8_000_000;

const ADMIN_ROLES = new Set([
    'admin', 'administrator', 'super_admin', 'owner', 'dev', 'developer', 'system_admin',
    '관리자', '사장', '실장', '개발', '개발자', '시스템관리자',
]);
const ACCOMMODATION_BILLING_ROLES = new Set([
    'support', 'support_manager', 'office_staff', 'office', 'finance', 'finance_manager',
    'accounting', 'accounting_manager', 'payroll_manager', 'manager1', 'pos_manager1',
    '매니저1', '메니저1', '지원담당', '지원 담당', '자산관리', '자산 관리',
    '숙소관리', '숙소 관리', '사무실직원', '사무직원', '사무',
    '회계', '재무', '경리', '회계담당', '재무담당', '급여담당', '정산담당', '정산관리자',
]);

const ELECTRICITY_BILL_SCHEMA = {
    type: 'object',
    properties: {
        bills: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    fileIndex: { type: 'integer' },
                    provider: { type: 'string' },
                    customerName: { type: 'string' },
                    customerNumber: { type: 'string' },
                    billingYearMonth: { type: 'string' },
                    dueDate: { type: 'string' },
                    usagePeriodStart: { type: 'string' },
                    usagePeriodEnd: { type: 'string' },
                    address: { type: 'string' },
                    housingName: { type: 'string' },
                    electricityAmount: { type: 'number' },
                    usageKwh: { type: 'number' },
                    confidence: { type: 'number' },
                    warnings: { type: 'array', items: { type: 'string' } },
                },
                required: [
                    'fileIndex', 'provider', 'customerName', 'customerNumber', 'billingYearMonth',
                    'dueDate', 'usagePeriodStart', 'usagePeriodEnd', 'address', 'housingName',
                    'electricityAmount', 'usageKwh', 'confidence', 'warnings',
                ],
                propertyOrdering: [
                    'fileIndex', 'provider', 'customerName', 'customerNumber', 'billingYearMonth',
                    'dueDate', 'usagePeriodStart', 'usagePeriodEnd', 'address', 'housingName',
                    'electricityAmount', 'usageKwh', 'confidence', 'warnings',
                ],
            },
        },
    },
    required: ['bills'],
    propertyOrdering: ['bills'],
};

const GAS_BILL_SCHEMA = {
    type: 'object',
    properties: {
        bills: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    fileIndex: { type: 'integer' },
                    provider: { type: 'string' },
                    customerName: { type: 'string' },
                    payerNumber: { type: 'string' },
                    billingYearMonth: { type: 'string' },
                    dueDate: { type: 'string' },
                    usagePeriodStart: { type: 'string' },
                    usagePeriodEnd: { type: 'string' },
                    address: { type: 'string' },
                    housingName: { type: 'string' },
                    gasAmount: { type: 'number' },
                    usageCubicMeters: { type: 'number' },
                    confidence: { type: 'number' },
                    warnings: { type: 'array', items: { type: 'string' } },
                },
                required: [
                    'fileIndex', 'provider', 'customerName', 'payerNumber', 'billingYearMonth',
                    'dueDate', 'usagePeriodStart', 'usagePeriodEnd', 'address', 'housingName',
                    'gasAmount', 'usageCubicMeters', 'confidence', 'warnings',
                ],
                propertyOrdering: [
                    'fileIndex', 'provider', 'customerName', 'payerNumber', 'billingYearMonth',
                    'dueDate', 'usagePeriodStart', 'usagePeriodEnd', 'address', 'housingName',
                    'gasAmount', 'usageCubicMeters', 'confidence', 'warnings',
                ],
            },
        },
    },
    required: ['bills'],
    propertyOrdering: ['bills'],
};

const WATER_BILL_SCHEMA = {
    type: 'object',
    properties: {
        bills: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    fileIndex: { type: 'integer' },
                    provider: { type: 'string' },
                    customerName: { type: 'string' },
                    consumerNumber: { type: 'string' },
                    billingYearMonth: { type: 'string' },
                    dueDate: { type: 'string' },
                    usagePeriodStart: { type: 'string' },
                    usagePeriodEnd: { type: 'string' },
                    address: { type: 'string' },
                    housingName: { type: 'string' },
                    waterAmount: { type: 'number' },
                    usageCubicMeters: { type: 'number' },
                    confidence: { type: 'number' },
                    warnings: { type: 'array', items: { type: 'string' } },
                },
                required: [
                    'fileIndex', 'provider', 'customerName', 'consumerNumber', 'billingYearMonth',
                    'dueDate', 'usagePeriodStart', 'usagePeriodEnd', 'address', 'housingName',
                    'waterAmount', 'usageCubicMeters', 'confidence', 'warnings',
                ],
                propertyOrdering: [
                    'fileIndex', 'provider', 'customerName', 'consumerNumber', 'billingYearMonth',
                    'dueDate', 'usagePeriodStart', 'usagePeriodEnd', 'address', 'housingName',
                    'waterAmount', 'usageCubicMeters', 'confidence', 'warnings',
                ],
            },
        },
    },
    required: ['bills'],
    propertyOrdering: ['bills'],
};

const asString = (value: unknown): string => String(value ?? '').trim();
const normalizeRole = (value: unknown): string => asString(value).toLowerCase();
const asFiniteNumber = (value: unknown, fallback = 0): number => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const parsed = Number(asString(value).replace(/[^0-9.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : fallback;
};
const clampConfidence = (value: unknown): number => Number(
    Math.min(1, Math.max(0, asFiniteNumber(value, 0))).toFixed(3),
);
const asWarnings = (value: unknown): string[] => Array.isArray(value)
    ? value.map(asString).filter(Boolean).slice(0, 20)
    : [];

const hasRole = (value: unknown): boolean => {
    if (Array.isArray(value)) return value.some(hasRole);
    const role = normalizeRole(value);
    return ADMIN_ROLES.has(role) || ACCOMMODATION_BILLING_ROLES.has(role);
};

const hasAccommodationBillingAccess = (source: Record<string, unknown>): boolean => (
    hasRole(source.role)
    || hasRole(source.position)
    || hasRole(source.systemRole)
    || hasRole(source.accountType)
    || hasRole(source.roles)
    || hasRole(source.additionalPositions)
    || hasRole(source.erpRoleGroups)
);

const requireAccommodationBillingAccess = async (
    context: functions.https.CallableContext,
): Promise<functions.https.CallableContext['auth']> => {
    const auth = requireCallableAuth(context);
    if (hasAccommodationBillingAccess((auth.token || {}) as Record<string, unknown>)) return auth;

    const userSnap = await admin.firestore().collection('users').doc(auth.uid).get();
    if (hasAccommodationBillingAccess(userSnap.data() || {})) return auth;

    throw new functions.https.HttpsError('permission-denied', '숙소 전기요금 청구서 분석 권한이 없습니다.');
};

const parseJsonObject = (text: string): Record<string, unknown> => {
    try {
        return JSON.parse(text);
    } catch {
        const start = text.indexOf('{');
        const end = text.lastIndexOf('}');
        if (start >= 0 && end > start) return JSON.parse(text.slice(start, end + 1));
        throw new Error('Gemini 응답 JSON을 파싱할 수 없습니다.');
    }
};

const extractGeminiText = (payload: any): string => {
    const parts = payload?.candidates?.[0]?.content?.parts;
    if (!Array.isArray(parts)) return '';
    return parts.map((part: any) => asString(part?.text)).filter(Boolean).join('').trim();
};

const normalizeYearMonth = (value: unknown): string => {
    const source = asString(value);
    const matched = /^(\d{4})[-./년\s]+(\d{1,2})/.exec(source);
    if (!matched) return '';
    const month = Number(matched[2]);
    return month >= 1 && month <= 12 ? `${matched[1]}-${String(month).padStart(2, '0')}` : '';
};

const normalizeIsoDate = (value: unknown): string => {
    const source = asString(value);
    const matched = /^(\d{4})[-./년\s]+(\d{1,2})[-./월\s]+(\d{1,2})/.exec(source);
    if (!matched) return '';
    return `${matched[1]}-${String(Number(matched[2])).padStart(2, '0')}-${String(Number(matched[3])).padStart(2, '0')}`;
};

const sanitizeFile = (value: unknown): ElectricityBillFileInput => {
    const source = (value || {}) as Record<string, unknown>;
    const fileIndex = Math.floor(asFiniteNumber(source.fileIndex, -1));
    const originalFileName = asString(source.originalFileName).slice(0, 240);
    const mimeType = asString(source.mimeType).toLowerCase();
    const base64 = asString(source.base64).replace(/^data:[^;]+;base64,/, '');
    const requestedSha256 = asString(source.sourceFileSha256).trim().toLowerCase();

    if (fileIndex < 0 || fileIndex > 9999) {
        throw new functions.https.HttpsError('invalid-argument', '첨부파일 순번이 올바르지 않습니다.');
    }
    if (!originalFileName) {
        throw new functions.https.HttpsError('invalid-argument', '첨부파일 이름이 필요합니다.');
    }
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
        throw new functions.https.HttpsError('invalid-argument', `${originalFileName}: 지원하지 않는 파일 형식입니다.`);
    }
    if (!base64 || base64.length > MAX_FILE_BASE64_LENGTH || !/^[A-Za-z0-9+/=\r\n]+$/.test(base64)) {
        throw new functions.https.HttpsError('invalid-argument', `${originalFileName}: 파일 데이터가 없거나 너무 큽니다.`);
    }
    if (requestedSha256 && !/^[a-f0-9]{64}$/.test(requestedSha256)) {
        throw new functions.https.HttpsError('invalid-argument', `${originalFileName}: SHA-256 파일 지문 형식이 올바르지 않습니다.`);
    }
    const sourceFileSha256 = createHash('sha256')
        .update(Buffer.from(base64, 'base64'))
        .digest('hex');
    if (requestedSha256 && requestedSha256 !== sourceFileSha256) {
        throw new functions.https.HttpsError('invalid-argument', `${originalFileName}: 파일 데이터와 SHA-256 지문이 일치하지 않습니다.`);
    }
    return { fileIndex, originalFileName, mimeType, base64, sourceFileSha256 };
};

const assertUniqueFiles = (files: ElectricityBillFileInput[]): void => {
    const indexes = new Set(files.map((file) => file.fileIndex));
    if (indexes.size !== files.length) {
        throw new functions.https.HttpsError('invalid-argument', '첨부파일 순번이 중복되었습니다.');
    }
    const hashes = new Set(files.map((file) => file.sourceFileSha256));
    if (hashes.size !== files.length) {
        throw new functions.https.HttpsError('already-exists', '동일한 청구서 파일이 두 번 첨부되었습니다. 같은 파일은 한 번만 등록해 주세요.');
    }
};

const sanitizeBill = (
    value: unknown,
    inputFiles: Map<number, ElectricityBillFileInput>,
    expectedYearMonth: string,
): ElectricityBillAnalysis | null => {
    const source = (value || {}) as Record<string, unknown>;
    const fileIndex = Math.floor(asFiniteNumber(source.fileIndex, -1));
    const inputFile = inputFiles.get(fileIndex);
    if (!inputFile) return null;

    const warnings = asWarnings(source.warnings);
    const billingYearMonth = normalizeYearMonth(source.billingYearMonth);
    if (!billingYearMonth) warnings.push('청구월을 읽지 못했습니다.');
    else if (expectedYearMonth && billingYearMonth !== expectedYearMonth) {
        warnings.push(`청구월 불일치: 선택 월 ${expectedYearMonth}, 청구서 ${billingYearMonth}`);
    }

    const electricityAmount = Math.max(0, Math.min(100_000_000, Math.round(asFiniteNumber(source.electricityAmount, 0))));
    if (electricityAmount <= 0) warnings.push('청구금액을 읽지 못했습니다.');

    return {
        fileIndex,
        originalFileName: inputFile.originalFileName,
        sourceFileSha256: inputFile.sourceFileSha256,
        provider: asString(source.provider).slice(0, 80),
        customerName: asString(source.customerName).slice(0, 120),
        customerNumber: asString(source.customerNumber).slice(0, 60),
        billingYearMonth,
        dueDate: normalizeIsoDate(source.dueDate),
        usagePeriodStart: normalizeIsoDate(source.usagePeriodStart),
        usagePeriodEnd: normalizeIsoDate(source.usagePeriodEnd),
        address: asString(source.address).slice(0, 300),
        housingName: asString(source.housingName).slice(0, 120),
        electricityAmount,
        usageKwh: Math.max(0, Math.min(10_000_000, Math.round(asFiniteNumber(source.usageKwh, 0)))),
        confidence: clampConfidence(source.confidence),
        warnings: Array.from(new Set(warnings)),
    };
};

const sanitizeGasBill = (
    value: unknown,
    inputFiles: Map<number, ElectricityBillFileInput>,
    expectedYearMonth: string,
): GasBillAnalysis | null => {
    const source = (value || {}) as Record<string, unknown>;
    const fileIndex = Math.floor(asFiniteNumber(source.fileIndex, -1));
    const inputFile = inputFiles.get(fileIndex);
    if (!inputFile) return null;

    const warnings = asWarnings(source.warnings);
    const billingYearMonth = normalizeYearMonth(source.billingYearMonth);
    if (!billingYearMonth) warnings.push('납기월을 읽지 못했습니다.');
    else if (expectedYearMonth && billingYearMonth !== expectedYearMonth) {
        warnings.push(`납기월 불일치: 선택 월 ${expectedYearMonth}, 청구서 ${billingYearMonth}`);
    }

    const gasAmount = Math.max(0, Math.min(100_000_000, Math.round(asFiniteNumber(source.gasAmount, 0))));
    if (gasAmount <= 0) warnings.push('총 고지금액을 읽지 못했습니다.');
    const usageCubicMeters = Math.max(0, Math.min(10_000_000, asFiniteNumber(source.usageCubicMeters, 0)));

    return {
        fileIndex,
        originalFileName: inputFile.originalFileName,
        sourceFileSha256: inputFile.sourceFileSha256,
        provider: asString(source.provider).slice(0, 80),
        customerName: asString(source.customerName).slice(0, 120),
        payerNumber: asString(source.payerNumber).slice(0, 60),
        billingYearMonth,
        dueDate: normalizeIsoDate(source.dueDate),
        usagePeriodStart: normalizeIsoDate(source.usagePeriodStart),
        usagePeriodEnd: normalizeIsoDate(source.usagePeriodEnd),
        address: asString(source.address).slice(0, 300),
        housingName: asString(source.housingName).slice(0, 120),
        gasAmount,
        usageCubicMeters: Number(usageCubicMeters.toFixed(3)),
        confidence: clampConfidence(source.confidence),
        warnings: Array.from(new Set(warnings)),
    };
};

const sanitizeWaterBill = (
    value: unknown,
    inputFiles: Map<number, ElectricityBillFileInput>,
    expectedYearMonth: string,
): WaterBillAnalysis | null => {
    const source = (value || {}) as Record<string, unknown>;
    const fileIndex = Math.floor(asFiniteNumber(source.fileIndex, -1));
    const inputFile = inputFiles.get(fileIndex);
    if (!inputFile) return null;

    const warnings = asWarnings(source.warnings);
    const billingYearMonth = normalizeYearMonth(source.billingYearMonth);
    if (!billingYearMonth) warnings.push('청구월을 읽지 못했습니다.');
    else if (expectedYearMonth && billingYearMonth !== expectedYearMonth) {
        warnings.push(`청구월 불일치: 선택 월 ${expectedYearMonth}, 청구서 ${billingYearMonth}`);
    }

    const waterAmount = Math.max(0, Math.min(100_000_000, Math.round(asFiniteNumber(source.waterAmount, 0))));
    if (waterAmount <= 0) warnings.push('현재 납부금액을 읽지 못했습니다.');
    const usageCubicMeters = Math.max(0, Math.min(10_000_000, asFiniteNumber(source.usageCubicMeters, 0)));

    return {
        fileIndex,
        originalFileName: inputFile.originalFileName,
        sourceFileSha256: inputFile.sourceFileSha256,
        provider: asString(source.provider).slice(0, 80),
        customerName: asString(source.customerName).slice(0, 120),
        consumerNumber: asString(source.consumerNumber).slice(0, 80),
        billingYearMonth,
        dueDate: normalizeIsoDate(source.dueDate),
        usagePeriodStart: normalizeIsoDate(source.usagePeriodStart),
        usagePeriodEnd: normalizeIsoDate(source.usagePeriodEnd),
        address: asString(source.address).slice(0, 300),
        housingName: asString(source.housingName).slice(0, 120),
        waterAmount,
        usageCubicMeters: Number(usageCubicMeters.toFixed(3)),
        confidence: clampConfidence(source.confidence),
        warnings: Array.from(new Set(warnings)),
    };
};

const buildPrompt = (yearMonth: string, files: ElectricityBillFileInput[]): string => `
You extract structured fields from Korean electricity bills, especially KEPCO (한국전력공사) email bills.
The user is importing bills into the accommodation utility ledger for ${yearMonth}.

There are ${files.length} attachments. Every image/PDF is preceded by a FILE_INDEX marker. Return exactly one bills[] item for every FILE_INDEX and preserve that fileIndex.
Return only JSON matching the response schema.

Extraction rules:
- billingYearMonth is the bill month printed in the main heading, for example "고객님의 2026년 06월". Return yyyy-MM.
- Do not infer billingYearMonth from the due date, tax invoice issue date, usage-period end date, scan date, or the previous receipt month.
- electricityAmount is the final current bill amount labelled "청구금액". It may include TV reception fees.
- Do not use "당월요금계", "전기요금계", supply value, VAT, previous "영수금액", or any bank account number as electricityAmount when a final "청구금액" is visible.
- address is the complete current service address near the customer details. Include road name, lot number, building/unit text, and parentheses when visible.
- housingName is the value printed beside "공동주택명". Do not replace it with the customer name.
- customerNumber is the full visible customer number including hyphens.
- dueDate, usagePeriodStart, and usagePeriodEnd must be yyyy-MM-dd when visible, otherwise an empty string.
- usageKwh is the current "사용량" in kWh, not previous-month or last-year usage.
- confidence must be 0..1. Add Korean warnings for unreadable, ambiguous, missing, or conflicting fields.
- Never guess an unreadable amount, address, customer number, housing name, or date. Use 0/empty string and add a warning.
`;

const buildGasPrompt = (yearMonth: string, files: ElectricityBillFileInput[]): string => `
You extract structured fields from Korean city-gas bills, especially Samchully (삼천리) 도시가스요금 청구서.
The user is importing bills into the accommodation utility ledger for ${yearMonth}.

There are ${files.length} attachments. Every image/PDF is preceded by a FILE_INDEX marker. Return exactly one bills[] item for every FILE_INDEX and preserve that fileIndex.
Return only JSON matching the response schema.

Critical extraction rules:
- billingYearMonth is the payment/billing month printed at the top as "YYYY년 MM월 납기분". Return yyyy-MM.
- Do NOT use the usage-period month, scan date, lower "고지월 YYYY/MM" in the automatic-transfer receipt, or a previous debit month as billingYearMonth.
- gasAmount is the current final amount labelled "총 고지금액" near the top. "당월사용요금" may be used only as a cross-check when it is the same current amount.
- Do NOT use any amount from "전자자동이체 영수내역", "청구금액/인출금액", previous bill history, arrears, supply value, VAT, bank account, or graph as gasAmount.
- If "총 고지금액" and "당월사용요금" differ, keep "총 고지금액" and add a Korean warning describing the discrepancy.
- address is the complete current service address in the upper customer section. Include road/lot and all building/unit text such as "(10)203" or "(4)401" and bracketed lot text when visible.
- housingName is the concise unit identifier derived only from the service address, such as "203호", "401호", or the visible building plus unit when necessary. Never use the customer name.
- payerNumber is the value labelled "납부자 번호", not 지로번호, bank account, receipt account, or meter number.
- dueDate is "납부마감일". usagePeriodStart and usagePeriodEnd come from the upper "사용기간". Return yyyy-MM-dd when visible, otherwise empty string.
- usageCubicMeters is the current "검침량" in m³. Do not use current/previous meter reading, corrected usage, previous month, same month last year, MJ, or graph values.
- confidence must be 0..1. Add Korean warnings for unreadable, ambiguous, missing, or conflicting fields.
- Never guess an unreadable amount, address, payer number, unit, usage, or date. Use 0/empty string and add a warning.
`;

const buildWaterPrompt = (yearMonth: string, files: ElectricityBillFileInput[]): string => `
You extract structured fields from Korean water and sewer bills, especially 안산시 상·하수도 사용료 자동납부 청구서.
The user is importing bills into the accommodation utility ledger for ${yearMonth}.

There are ${files.length} attachments. Every image/PDF is preceded by a FILE_INDEX marker. Return exactly one bills[] item for every FILE_INDEX and preserve that fileIndex.
Return only JSON matching the response schema.

Critical extraction rules:
- billingYearMonth is the current bill month printed in the main title as "상·하수도 사용료 자동납부 청구서 (YYYY년 MM월분)". Return yyyy-MM.
- Do NOT use the email sent date, meter-reading date, usage-period month, due date, or the lower previous-month "자동납부 영수증" month as billingYearMonth.
- waterAmount is the large current amount labelled "납부금액" in the upper customer section. It should equal the current fee table's final "고지금액/계" after reductions.
- Do NOT use any "영수금액", "납부할 세액", bank account, previous-month automatic-payment receipt, or individual 상수도/하수도/물이용부담금 component as waterAmount.
- If the upper "납부금액" and current fee table's final total differ, keep the upper "납부금액" and add a Korean warning.
- consumerNumber is the complete value labelled "수용가번호", including hyphens. Do not use 수전번호, bank account, or masked account number.
- customerName is the value labelled "성명" in 수용가정보. housingName is the room/unit extracted from that name, for example "402호", "203호", or "101호". A person name may precede the room; use the bracketed room as housingName.
- address is the current value labelled "주소" in 수용가정보. Preserve bracketed position text such as "초당4길 18[좌11]" exactly when visible.
- dueDate is the upper "납부기한". usagePeriodStart and usagePeriodEnd come from the current "사용기간". Return yyyy-MM-dd when visible, otherwise empty string.
- usageCubicMeters is the current 상수도 "사용량(m³)" in 사용내역. Do not use current/previous meter readings, 하수도 zero, 수전번호, prior-month receipt, or fee amounts.
- confidence must be 0..1. Add Korean warnings for unreadable, ambiguous, missing, or conflicting fields.
- Never guess an unreadable amount, address, consumer number, unit, usage, or date. Use 0/empty string and add a warning.
`;

const toUtilityHttpsError = (
    error: unknown,
    utilityLabel: string,
): functions.https.HttpsError => {
    if (error instanceof functions.https.HttpsError) return error;
    const message = error instanceof Error ? error.message : asString(error) || '알 수 없는 오류';
    const lower = message.toLowerCase();
    if (lower.includes('api key') || lower.includes('permission') || lower.includes('forbidden')) {
        return new functions.https.HttpsError('failed-precondition', `/settings/ai 서버 Gemini 설정을 확인해 주세요. ${message}`);
    }
    if (lower.includes('quota') || lower.includes('rate limit') || lower.includes('resource exhausted')) {
        return new functions.https.HttpsError('resource-exhausted', `Gemini 사용량 한도에 도달했습니다. ${message}`);
    }
    return new functions.https.HttpsError('internal', `${utilityLabel} 청구서 분석에 실패했습니다. ${message}`);
};

const toHttpsError = (error: unknown): functions.https.HttpsError => toUtilityHttpsError(error, '전기요금');
const toGasHttpsError = (error: unknown): functions.https.HttpsError => toUtilityHttpsError(error, '가스요금');
const toWaterHttpsError = (error: unknown): functions.https.HttpsError => toUtilityHttpsError(error, '수도요금');

export const analyzeAccommodationElectricityBills = functions
    .runWith({ timeoutSeconds: 300, memory: '1GB', maxInstances: 5 })
    .region('asia-northeast3')
    .https.onCall(async (data: AnalyzeElectricityBillsRequest, context) => {
        try {
            await requireAccommodationBillingAccess(context);
            const yearMonth = normalizeYearMonth(data?.yearMonth);
            if (!yearMonth || yearMonth !== asString(data?.yearMonth)) {
                throw new functions.https.HttpsError('invalid-argument', '대장 월은 yyyy-MM 형식이어야 합니다.');
            }

            const rawFiles = Array.isArray(data?.files) ? data.files : [];
            if (rawFiles.length === 0 || rawFiles.length > MAX_FILES_PER_REQUEST) {
                throw new functions.https.HttpsError(
                    'invalid-argument',
                    `한 번에 1~${MAX_FILES_PER_REQUEST}개 파일을 분석할 수 있습니다.`,
                );
            }
            const files = rawFiles.map(sanitizeFile);
            assertUniqueFiles(files);
            const totalBase64Length = files.reduce((sum, file) => sum + file.base64.length, 0);
            if (totalBase64Length > MAX_TOTAL_BASE64_LENGTH) {
                throw new functions.https.HttpsError('invalid-argument', '분석 요청 파일의 전체 용량이 너무 큽니다.');
            }

            const settings = await getServerGeminiSettings();
            const apiKey = asString(settings.apiKey);
            if (!apiKey) {
                throw new functions.https.HttpsError(
                    'failed-precondition',
                    '/settings/ai에서 서버용 Gemini API Key를 먼저 설정해 주세요.',
                );
            }
            const model = asString(settings.documentModel) || asString(settings.model) || 'gemini-2.5-flash';
            const parts: Array<Record<string, unknown>> = [{ text: buildPrompt(yearMonth, files) }];
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
                        responseJsonSchema: ELECTRICITY_BILL_SCHEMA,
                    },
                }),
            });

            const rawResponse = await response.text();
            let payload: any = null;
            try {
                payload = rawResponse ? JSON.parse(rawResponse) : null;
            } catch {
                payload = null;
            }
            if (!response.ok) {
                const message = asString(payload?.error?.message) || `${response.status} ${response.statusText}`;
                functions.logger.error('Accommodation electricity bill Gemini analysis failed', {
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
            const parsedBills = Array.isArray(parsed.bills) ? parsed.bills : [];
            const fileMap = new Map(files.map((file) => [file.fileIndex, file]));
            const byFileIndex = new Map<number, ElectricityBillAnalysis>();
            parsedBills.forEach((value) => {
                const sanitized = sanitizeBill(value, fileMap, yearMonth);
                if (sanitized && !byFileIndex.has(sanitized.fileIndex)) byFileIndex.set(sanitized.fileIndex, sanitized);
            });

            const bills = files.map((file) => byFileIndex.get(file.fileIndex) || ({
                fileIndex: file.fileIndex,
                originalFileName: file.originalFileName,
                sourceFileSha256: file.sourceFileSha256,
                provider: '',
                customerName: '',
                customerNumber: '',
                billingYearMonth: '',
                dueDate: '',
                usagePeriodStart: '',
                usagePeriodEnd: '',
                address: '',
                housingName: '',
                electricityAmount: 0,
                usageKwh: 0,
                confidence: 0,
                warnings: ['Gemini가 이 파일의 분석 결과를 반환하지 않았습니다. 다시 분석해 주세요.'],
            }));

            functions.logger.info('Accommodation electricity bill analysis completed', {
                model,
                fileCount: files.length,
                completedCount: bills.filter((bill) => bill.electricityAmount > 0).length,
            });
            return { ok: true, model, bills };
        } catch (error) {
            throw toHttpsError(error);
        }
    });

export const analyzeAccommodationGasBills = functions
    .runWith({ timeoutSeconds: 300, memory: '1GB', maxInstances: 5 })
    .region('asia-northeast3')
    .https.onCall(async (data: AnalyzeElectricityBillsRequest, context) => {
        try {
            await requireAccommodationBillingAccess(context);
            const yearMonth = normalizeYearMonth(data?.yearMonth);
            if (!yearMonth || yearMonth !== asString(data?.yearMonth)) {
                throw new functions.https.HttpsError('invalid-argument', '대장 월은 yyyy-MM 형식이어야 합니다.');
            }

            const rawFiles = Array.isArray(data?.files) ? data.files : [];
            if (rawFiles.length === 0 || rawFiles.length > MAX_FILES_PER_REQUEST) {
                throw new functions.https.HttpsError(
                    'invalid-argument',
                    `한 번에 1~${MAX_FILES_PER_REQUEST}개 파일을 분석할 수 있습니다.`,
                );
            }
            const files = rawFiles.map(sanitizeFile);
            assertUniqueFiles(files);
            const totalBase64Length = files.reduce((sum, file) => sum + file.base64.length, 0);
            if (totalBase64Length > MAX_TOTAL_BASE64_LENGTH) {
                throw new functions.https.HttpsError('invalid-argument', '분석 요청 파일의 전체 용량이 너무 큽니다.');
            }

            const settings = await getServerGeminiSettings();
            const apiKey = asString(settings.apiKey);
            if (!apiKey) {
                throw new functions.https.HttpsError(
                    'failed-precondition',
                    '/settings/ai에서 서버 Gemini API Key를 먼저 설정해 주세요.',
                );
            }
            const model = asString(settings.documentModel) || asString(settings.model) || 'gemini-2.5-flash';
            const parts: Array<Record<string, unknown>> = [{ text: buildGasPrompt(yearMonth, files) }];
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
                        responseJsonSchema: GAS_BILL_SCHEMA,
                    },
                }),
            });

            const rawResponse = await response.text();
            let payload: any = null;
            try {
                payload = rawResponse ? JSON.parse(rawResponse) : null;
            } catch {
                payload = null;
            }
            if (!response.ok) {
                const message = asString(payload?.error?.message) || `${response.status} ${response.statusText}`;
                functions.logger.error('Accommodation gas bill Gemini analysis failed', {
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
            const parsedBills = Array.isArray(parsed.bills) ? parsed.bills : [];
            const fileMap = new Map(files.map((file) => [file.fileIndex, file]));
            const byFileIndex = new Map<number, GasBillAnalysis>();
            parsedBills.forEach((value) => {
                const sanitized = sanitizeGasBill(value, fileMap, yearMonth);
                if (sanitized && !byFileIndex.has(sanitized.fileIndex)) byFileIndex.set(sanitized.fileIndex, sanitized);
            });

            const bills = files.map((file) => byFileIndex.get(file.fileIndex) || ({
                fileIndex: file.fileIndex,
                originalFileName: file.originalFileName,
                sourceFileSha256: file.sourceFileSha256,
                provider: '',
                customerName: '',
                payerNumber: '',
                billingYearMonth: '',
                dueDate: '',
                usagePeriodStart: '',
                usagePeriodEnd: '',
                address: '',
                housingName: '',
                gasAmount: 0,
                usageCubicMeters: 0,
                confidence: 0,
                warnings: ['Gemini가 이 파일의 분석 결과를 반환하지 않았습니다. 다시 분석해 주세요.'],
            }));

            functions.logger.info('Accommodation gas bill analysis completed', {
                model,
                fileCount: files.length,
                completedCount: bills.filter((bill) => bill.gasAmount > 0).length,
            });
            return { ok: true, model, bills };
        } catch (error) {
            throw toGasHttpsError(error);
        }
    });

export const analyzeAccommodationWaterBills = functions
    .runWith({ timeoutSeconds: 300, memory: '1GB', maxInstances: 5 })
    .region('asia-northeast3')
    .https.onCall(async (data: AnalyzeElectricityBillsRequest, context) => {
        try {
            await requireAccommodationBillingAccess(context);
            const yearMonth = normalizeYearMonth(data?.yearMonth);
            if (!yearMonth || yearMonth !== asString(data?.yearMonth)) {
                throw new functions.https.HttpsError('invalid-argument', '대장 월은 yyyy-MM 형식이어야 합니다.');
            }

            const rawFiles = Array.isArray(data?.files) ? data.files : [];
            if (rawFiles.length === 0 || rawFiles.length > MAX_FILES_PER_REQUEST) {
                throw new functions.https.HttpsError(
                    'invalid-argument',
                    `한 번에 1~${MAX_FILES_PER_REQUEST}개 파일을 분석할 수 있습니다.`,
                );
            }
            const files = rawFiles.map(sanitizeFile);
            assertUniqueFiles(files);
            const totalBase64Length = files.reduce((sum, file) => sum + file.base64.length, 0);
            if (totalBase64Length > MAX_TOTAL_BASE64_LENGTH) {
                throw new functions.https.HttpsError('invalid-argument', '분석 요청 파일의 전체 용량이 너무 큽니다.');
            }

            const settings = await getServerGeminiSettings();
            const apiKey = asString(settings.apiKey);
            if (!apiKey) {
                throw new functions.https.HttpsError(
                    'failed-precondition',
                    '/settings/ai에서 서버 Gemini API Key를 먼저 설정해 주세요.',
                );
            }
            const model = asString(settings.documentModel) || asString(settings.model) || 'gemini-2.5-flash';
            const parts: Array<Record<string, unknown>> = [{ text: buildWaterPrompt(yearMonth, files) }];
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
                        responseJsonSchema: WATER_BILL_SCHEMA,
                    },
                }),
            });

            const rawResponse = await response.text();
            let payload: any = null;
            try {
                payload = rawResponse ? JSON.parse(rawResponse) : null;
            } catch {
                payload = null;
            }
            if (!response.ok) {
                const message = asString(payload?.error?.message) || `${response.status} ${response.statusText}`;
                functions.logger.error('Accommodation water bill Gemini analysis failed', {
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
            const parsedBills = Array.isArray(parsed.bills) ? parsed.bills : [];
            const fileMap = new Map(files.map((file) => [file.fileIndex, file]));
            const byFileIndex = new Map<number, WaterBillAnalysis>();
            parsedBills.forEach((value) => {
                const sanitized = sanitizeWaterBill(value, fileMap, yearMonth);
                if (sanitized && !byFileIndex.has(sanitized.fileIndex)) byFileIndex.set(sanitized.fileIndex, sanitized);
            });

            const bills = files.map((file) => byFileIndex.get(file.fileIndex) || ({
                fileIndex: file.fileIndex,
                originalFileName: file.originalFileName,
                sourceFileSha256: file.sourceFileSha256,
                provider: '',
                customerName: '',
                consumerNumber: '',
                billingYearMonth: '',
                dueDate: '',
                usagePeriodStart: '',
                usagePeriodEnd: '',
                address: '',
                housingName: '',
                waterAmount: 0,
                usageCubicMeters: 0,
                confidence: 0,
                warnings: ['Gemini가 이 파일의 분석 결과를 반환하지 않았습니다. 다시 분석해 주세요.'],
            }));

            functions.logger.info('Accommodation water bill analysis completed', {
                model,
                fileCount: files.length,
                completedCount: bills.filter((bill) => bill.waterAmount > 0).length,
            });
            return { ok: true, model, bills };
        } catch (error) {
            throw toWaterHttpsError(error);
        }
    });
