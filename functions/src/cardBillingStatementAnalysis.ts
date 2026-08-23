import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { requireCallableAuth } from './auth';
import { getServerGeminiSettings } from './serverAiSettings';
import {
    buildCardStatementSourceClaimDocumentId,
    buildCardStatementTransactionDocumentId,
    hashCardStatementSource,
    normalizeCardStatementSourceSha256,
} from './cardStatementImportIdentity';

declare const fetch: any;
const { PDFParse } = require('pdf-parse');

type CardStatementCategory = 'FUEL' | 'TOLL' | 'MEAL' | 'MATERIAL' | 'OTHER';

interface AnalyzeCardBillingStatementRequest {
    statementPath: string;
    billingId?: string;
    yearMonth?: string;
    cardLabel?: string;
}

interface CreateCardStatementImportFileInput {
    storagePath: string;
    originalFileName?: string;
    mimeType?: string;
    size?: number;
    sha256?: string;
}

interface CreateCardStatementImportJobRequest {
    yearMonth: string;
    bankName?: string;
    files: CreateCardStatementImportFileInput[];
}

interface CreateCardStatementImportUploadSessionFileInput {
    originalFileName?: string;
    mimeType?: string;
    size?: number;
    sha256?: string;
}

interface CreateCardStatementImportUploadSessionRequest {
    yearMonth: string;
    bankName?: string;
    files: CreateCardStatementImportUploadSessionFileInput[];
}

interface CompleteCardStatementImportUploadRequest {
    jobId: string;
    files: CreateCardStatementImportFileInput[];
}

interface CancelCardStatementImportUploadSessionRequest {
    jobId: string;
    reason?: string;
}

interface AnalyzeCardStatementImportJobRequest {
    jobId: string;
}

interface RecoverCardStatementImportJobAnalysisRequest {
    jobId: string;
}

interface GetCardStatementImportJobStatusRequest {
    jobId: string;
}

interface CommitCardStatementImportJobRequest {
    jobId: string;
}

interface UpdateCardStatementImportResultReviewRequest {
    resultId: string;
    matchedCardId?: string | null;
    exclude?: boolean;
    exclusionReason?: string;
}

interface GeminiCardStatementTransaction {
    date: string;
    merchant: string;
    amount: number;
    category: CardStatementCategory;
    memo?: string;
    confidence: number;
}

interface GeminiCardStatementCard {
    cardLast4: string;
    cardName?: string;
    holderName?: string;
    subtotalAmount: number;
    transactions: GeminiCardStatementTransaction[];
    warnings: string[];
    confidence: number;
}

interface GeminiKbCardStatementOutput {
    bankName: string;
    statementMonth: string;
    grandTotalAmount: number;
    cards: GeminiCardStatementCard[];
    warnings: string[];
}

interface CompatibleBillingStatementItem {
    label: string;
    amount: number;
    category: string;
    date?: string;
    merchant?: string;
    cardLast4?: string;
    confidence?: number;
}

interface CompatibleBillingStatementOutput extends GeminiKbCardStatementOutput {
    totalAmount: number;
    items: CompatibleBillingStatementItem[];
}

interface DownloadedStatementFile {
    base64: string;
    buffer: Buffer;
    mimeType: string;
    size: number;
    sha256: string;
}

type CardStatementAnalysisSource = 'fast_text' | 'gemini';

interface CardStatementAnalysisResult {
    rawText: string;
    parsed: CompatibleBillingStatementOutput;
    source: CardStatementAnalysisSource;
}

interface FirestoreCardRecord {
    id: string;
    name?: string;
    issuer?: string;
    last4?: string;
    maskedNumber?: string;
    currentAssigneeId?: string | null;
    currentAssigneeType?: string | null;
    currentAssigneeName?: string | null;
    billingTargetId?: string | null;
    billingTargetType?: string | null;
    billingTargetName?: string | null;
    memo?: string | null;
    status?: string;
}

interface ResolvedBillingTarget {
    assignedTeamId?: string;
    assignedTeamName?: string;
    teamId: string;
    teamName: string;
    issuedToType: 'team' | 'worker';
    issuedToWorkerId?: string;
    issuedToWorkerName?: string;
}

interface PreparedCommitResult {
    resultId: string;
    billingId: string;
    billingTarget: ResolvedBillingTarget;
    transactionUpserts: Array<Record<string, unknown> & { id: string }>;
    lineItems: Array<Record<string, unknown>>;
    statementPath: string;
}

interface CardStatementImportResultCommitMarker {
    transactionIds: string[];
    lineItemIds: string[];
    statementPath: string;
    sourceSha256: string;
    sourceFileId: string;
}

interface CardStatementImportBillingGroup {
    card: FirestoreCardRecord;
    target: PreparedCommitResult;
    resultIds: string[];
    resultMarkers: Map<string, CardStatementImportResultCommitMarker>;
    statementPaths: Set<string>;
    lineItems: Array<Record<string, unknown>>;
    transactionUpserts: Array<Record<string, unknown> & { id: string }>;
}

interface CommitCardStatementBillingGroupResult {
    committedResults: number;
    committedTransactions: number;
    skippedResults: number;
    committedBillingDocumentCount: number;
    protectedBillingIds: string[];
    affectedDocumentIds: string[];
}

interface CardMatchCandidate {
    cardId: string;
    cardLabel: string;
    cardLast4: string;
    score: number;
    reasons: string[];
}

interface CardMatchResult {
    matchedCardId?: string;
    matchedCardLabel?: string;
    matchConfidence: number;
    matchCandidates: CardMatchCandidate[];
    warnings: string[];
}

const MAX_INLINE_FILE_SIZE_BYTES = 18 * 1024 * 1024;
const MAX_STORAGE_IMPORT_FILE_SIZE_BYTES = 25 * 1024 * 1024;
const MAX_IMPORT_FILES_PER_JOB = 30;
const DEFAULT_MODEL = 'gemini-2.5-flash';
const ALLOWED_ROLE_GROUPS = new Set(['admin', 'support', 'finance', 'payroll', 'office']);
const ALLOWED_ROLE_KEYS = new Set([
    'admin',
    'administrator',
    'super_admin',
    'owner',
    'dev',
    'developer',
    'system_admin',
    'support',
    'support_manager',
    'manager1',
    'pos_manager1',
    'finance',
    'finance_manager',
    'accounting',
    'accounting_manager',
    'payroll_manager',
    'office',
    'office_staff',
    'settlement',
    'settlement_manager',
    'card_manager',
    'asset_manager',
    '관리자',
    '지원',
    '지원담당',
    '지원관리',
    '매니저1',
    '메니저1',
    '자산관리',
    '차량관리',
    '카드관리',
    '정산',
    '정산담당',
    '회계',
    '사무',
]);
const CATEGORY_VALUES: CardStatementCategory[] = ['FUEL', 'TOLL', 'MEAL', 'MATERIAL', 'OTHER'];
const RESULT_REVIEW_MUTABLE_JOB_STATUSES = new Set(['reviewing']);
const RESULT_REVIEW_ALLOWED_REQUEST_FIELDS = new Set([
    'resultId',
    'matchedCardId',
    'exclude',
    'exclusionReason',
]);
const COLLECTIONS = {
    cards: 'cards',
    workers: 'workers',
    teams: 'teams',
    billingTargets: 'cardBillingTargets',
    transactions: 'cardTransactions',
    billings: 'cardBillings',
    billingLogs: 'card_billing_logs',
    jobs: 'cardStatementImportJobs',
    files: 'cardStatementImportFiles',
    results: 'cardStatementImportResults',
    sourceClaims: 'cardStatementImportSourceClaims',
    supportWriteOperations: 'support_write_operations',
} as const;
const POSTED_BILLING_STATUSES = new Set(['CONFIRMED', 'PAID', 'OVERDUE']);
const PROTECTED_BILLING_IMPORT_MESSAGE = '확정/정산/연체 카드 청구문서가 있어 PDF 반영을 건너뛰었습니다.';
const OFFICE_TARGET_ID = '__office__';
const OFFICE_TARGET_NAME = '사무실';

const CARD_BILLING_STATEMENT_SCHEMA = {
    type: 'object',
    properties: {
        bankName: { type: 'string' },
        statementMonth: { type: 'string' },
        grandTotalAmount: { type: 'number' },
        cards: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    cardLast4: { type: 'string' },
                    cardName: { type: 'string' },
                    holderName: { type: 'string' },
                    subtotalAmount: { type: 'number' },
                    transactions: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                date: { type: 'string' },
                                merchant: { type: 'string' },
                                amount: { type: 'number' },
                                category: { type: 'string', enum: CATEGORY_VALUES },
                                memo: { type: 'string' },
                                confidence: { type: 'number' },
                            },
                            required: ['date', 'merchant', 'amount', 'category', 'memo', 'confidence'],
                            propertyOrdering: ['date', 'merchant', 'amount', 'category', 'memo', 'confidence'],
                        },
                    },
                    warnings: { type: 'array', items: { type: 'string' } },
                    confidence: { type: 'number' },
                },
                required: [
                    'cardLast4',
                    'cardName',
                    'holderName',
                    'subtotalAmount',
                    'transactions',
                    'warnings',
                    'confidence',
                ],
                propertyOrdering: [
                    'cardLast4',
                    'cardName',
                    'holderName',
                    'subtotalAmount',
                    'transactions',
                    'warnings',
                    'confidence',
                ],
            },
        },
        warnings: { type: 'array', items: { type: 'string' } },
    },
    required: ['bankName', 'statementMonth', 'grandTotalAmount', 'cards', 'warnings'],
    propertyOrdering: ['bankName', 'statementMonth', 'grandTotalAmount', 'cards', 'warnings'],
};

const asString = (value: unknown): string => String(value ?? '').trim();

const normalizeKey = (value: unknown): string => asString(value).toLowerCase();

const isValidYearMonth = (value: unknown): boolean => /^\d{4}-\d{2}$/.test(asString(value));

const sanitizeIdPart = (value: unknown): string => {
    const safe = asString(value)
        .replace(/[/#[\]?]/g, '_')
        .replace(/\s+/g, '_')
        .replace(/[^0-9A-Za-z_.:-]/g, '_');
    return safe || 'blank';
};

const asFiniteNumber = (value: unknown, fallback = 0): number => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
        const normalized = value.replace(/,/g, '').trim();
        if (!normalized) return fallback;
        const parsed = Number(normalized);
        return Number.isFinite(parsed) ? parsed : fallback;
    }
    return fallback;
};

const clampConfidence = (value: unknown): number => {
    const numeric = asFiniteNumber(value, 0);
    if (numeric < 0) return 0;
    if (numeric > 1) return 1;
    return Number(numeric.toFixed(3));
};

const asStringArray = (value: unknown): string[] => {
    if (!Array.isArray(value)) return [];
    return value.map(asString).filter(Boolean).slice(0, 50);
};

const safeTimestamp = () => admin.firestore.FieldValue.serverTimestamp();

const SUPPORT_WRITE_OPERATION_DOMAIN = 'card';
const CARD_BILLING_ACTION_LABELS: Record<string, string> = {
    created: '저장',
    updated: '수정',
    deleted: '삭제',
};
const CARD_BILLING_FIELD_LABELS: Record<string, string> = {
    yearMonth: '청구 월',
    cardId: '카드 ID',
    cardLabel: '카드',
    assignedTeamId: '배정팀 ID',
    assignedTeamName: '배정팀',
    teamId: '청구대상 팀 ID',
    teamName: '청구대상 팀',
    issuedToType: '청구 방식',
    issuedToWorkerId: '청구대상 개인 ID',
    issuedToWorkerName: '청구대상 개인',
    variableCost: '사용금액',
    totalAmount: '총 청구액',
    status: '상태',
    memo: '메모',
    statementAttachmentPaths: '명세서 첨부',
};
const CARD_BILLING_COMPARE_FIELDS = Object.keys(CARD_BILLING_FIELD_LABELS);
const LINE_ITEM_FIELD_LABELS: Record<string, string> = {
    label: '항목명',
    amount: '금액',
    type: '구분',
    category: '분류',
};
const LINE_ITEM_COMPARE_FIELDS = Object.keys(LINE_ITEM_FIELD_LABELS);

const stripUndefinedDeep = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(stripUndefinedDeep);
    if (value && typeof value === 'object') {
        if (value instanceof admin.firestore.Timestamp) return value;
        if (typeof (value as { toDate?: unknown }).toDate === 'function') return value;
        if (value instanceof admin.firestore.FieldValue) return value;
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>)
                .filter(([, entry]) => entry !== undefined)
                .map(([key, entry]) => [key, stripUndefinedDeep(entry)])
        );
    }
    return value === undefined ? null : value;
};

const normalizeComparableValue = (value: unknown): unknown => {
    if (value === undefined || value === '') return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof (value as { toDate?: unknown })?.toDate === 'function') {
        return (value as { toDate: () => Date }).toDate().toISOString();
    }
    return value;
};

const sameComparableValue = (left: unknown, right: unknown): boolean =>
    JSON.stringify(normalizeComparableValue(left)) === JSON.stringify(normalizeComparableValue(right));

const formatKoreanAmount = (value: unknown): string =>
    Number(value || 0).toLocaleString('ko-KR');

const uniqueStrings = (values: unknown[] = []): string[] =>
    Array.from(new Set(values.map(asString).filter(Boolean)));

const asStringList = (value: unknown): string[] =>
    Array.isArray(value) ? value.map(asString).filter(Boolean) : [];

const resolveCallableActor = (
    auth: NonNullable<functions.https.CallableContext['auth']>
): { uid: string; name: string; email: string | null } => {
    const token = (auth.token || {}) as Record<string, unknown>;
    const email = asString(token.email) || null;
    return {
        uid: auth.uid,
        name: asString(token.name) || email || auth.uid || 'ERP 시스템',
        email,
    };
};

const snapshotLineItemForLog = (item: Record<string, unknown>): Record<string, unknown> => stripUndefinedDeep({
    id: item.id,
    label: item.label,
    amount: Math.round(asFiniteNumber(item.amount, 0)),
    type: item.type,
    category: item.category,
    sourceType: item.sourceType,
}) as Record<string, unknown>;

const snapshotBillingForLog = (
    billing?: Record<string, unknown> | null
): Record<string, unknown> | null => {
    if (!billing) return null;
    const lineItems = Array.isArray(billing.lineItems)
        ? billing.lineItems.map((item) => snapshotLineItemForLog((item || {}) as Record<string, unknown>))
        : [];
    return stripUndefinedDeep({
        id: billing.id,
        yearMonth: billing.yearMonth,
        cardId: billing.cardId,
        cardLabel: billing.cardLabel,
        assignedTeamId: billing.assignedTeamId,
        assignedTeamName: billing.assignedTeamName,
        teamId: billing.teamId,
        teamName: billing.teamName,
        issuedToType: billing.issuedToType,
        issuedToWorkerId: billing.issuedToWorkerId,
        issuedToWorkerName: billing.issuedToWorkerName,
        variableCost: Math.round(asFiniteNumber(billing.variableCost, 0)),
        totalAmount: Math.round(asFiniteNumber(billing.totalAmount, 0)),
        status: billing.status,
        lineItems,
        statementAttachmentPaths: Array.isArray(billing.statementAttachmentPaths)
            ? billing.statementAttachmentPaths.map(asString).filter(Boolean)
            : [],
        memo: billing.memo,
        createdAt: billing.createdAt,
        updatedAt: billing.updatedAt,
        confirmedAt: billing.confirmedAt,
    }) as Record<string, unknown>;
};

const buildBillingFieldChanges = (
    before: Record<string, unknown> | null,
    after: Record<string, unknown> | null
): Array<Record<string, unknown>> => CARD_BILLING_COMPARE_FIELDS.reduce<Array<Record<string, unknown>>>((changes, field) => {
    const beforeValue = before?.[field] ?? null;
    const afterValue = after?.[field] ?? null;
    if (!sameComparableValue(beforeValue, afterValue)) {
        changes.push({
            field,
            label: CARD_BILLING_FIELD_LABELS[field] || field,
            before: normalizeComparableValue(beforeValue),
            after: normalizeComparableValue(afterValue),
        });
    }
    return changes;
}, []);

const getLineItemLogKey = (item: Record<string, unknown>): string =>
    asString(item.id) || `${asString(item.label)}-${asString(item.category)}`;

const buildLineItemChange = (
    item: Record<string, unknown>,
    before?: Record<string, unknown>,
    after?: Record<string, unknown>,
    changes?: Array<Record<string, unknown>>
): Record<string, unknown> => stripUndefinedDeep({
    key: getLineItemLogKey(item) || asString(item.label) || '항목',
    label: asString(item.label) || '항목',
    before,
    after,
    changes,
}) as Record<string, unknown>;

const buildLineItemChanges = (
    beforeItems: Array<Record<string, unknown>> = [],
    afterItems: Array<Record<string, unknown>> = []
): { added: Array<Record<string, unknown>>; removed: Array<Record<string, unknown>>; updated: Array<Record<string, unknown>> } => {
    const beforeByKey = new Map(beforeItems.map((item) => [getLineItemLogKey(item), item]));
    const afterByKey = new Map(afterItems.map((item) => [getLineItemLogKey(item), item]));
    const added: Array<Record<string, unknown>> = [];
    const removed: Array<Record<string, unknown>> = [];
    const updated: Array<Record<string, unknown>> = [];

    afterByKey.forEach((after, key) => {
        const before = beforeByKey.get(key);
        if (!before) {
            added.push(buildLineItemChange(after, undefined, after));
            return;
        }
        const changes = LINE_ITEM_COMPARE_FIELDS.reduce<Array<Record<string, unknown>>>((acc, field) => {
            const beforeValue = before[field] ?? null;
            const afterValue = after[field] ?? null;
            if (!sameComparableValue(beforeValue, afterValue)) {
                acc.push({
                    field,
                    label: LINE_ITEM_FIELD_LABELS[field] || field,
                    before: normalizeComparableValue(beforeValue),
                    after: normalizeComparableValue(afterValue),
                });
            }
            return acc;
        }, []);
        if (changes.length > 0) updated.push(buildLineItemChange(after, before, after, changes));
    });

    beforeByKey.forEach((before, key) => {
        if (!afterByKey.has(key)) removed.push(buildLineItemChange(before, before, undefined));
    });

    return { added, removed, updated };
};

const buildBillingLogSummaryLines = (
    action: 'created' | 'updated',
    anchor: Record<string, unknown>,
    fieldChanges: Array<Record<string, unknown>>,
    lineItemChanges: { added: unknown[]; removed: unknown[]; updated: unknown[] }
): string[] => {
    const lines: string[] = [];
    lines.push(action === 'created' ? '카드 청구서가 생성되었습니다.' : '카드 청구서 내용이 수정되었습니다.');
    lines.push(`카드: ${asString(anchor.cardLabel) || '카드 미지정'}`);
    lines.push(`청구대상: ${asString(anchor.teamName || anchor.assignedTeamName || anchor.issuedToWorkerName) || '청구대상 미지정'}`);
    lines.push(`청구월: ${asString(anchor.yearMonth) || '-'}`);
    lines.push(`총 청구액: ${formatKoreanAmount(anchor.totalAmount)}원`);
    if (anchor.status) lines.push(`상태: ${asString(anchor.status)}`);

    if (action === 'updated') {
        fieldChanges.slice(0, 5).forEach((change) => {
            lines.push(`${asString(change.label) || asString(change.field)}: ${asString(change.before) || '-'} -> ${asString(change.after) || '-'}`);
        });
        const lineItemCount = lineItemChanges.added.length + lineItemChanges.removed.length + lineItemChanges.updated.length;
        if (lineItemCount > 0) lines.push(`청구 항목 변경: ${lineItemCount}건`);
    }
    return lines;
};

const buildCardBillingLogPayload = (
    action: 'created' | 'updated',
    beforeInput: Record<string, unknown> | null,
    afterInput: Record<string, unknown>,
    actor: { uid: string; name: string; email: string | null },
    now: admin.firestore.Timestamp,
    source = 'cardStatementImport.commit'
): Record<string, unknown> => {
    const before = snapshotBillingForLog(beforeInput);
    const after = snapshotBillingForLog(afterInput);
    const anchor = after || before || {};
    const fieldChanges = action === 'updated' ? buildBillingFieldChanges(before, after) : [];
    const beforeLineItems = Array.isArray(before?.lineItems) ? before.lineItems as Array<Record<string, unknown>> : [];
    const afterLineItems = Array.isArray(after?.lineItems) ? after.lineItems as Array<Record<string, unknown>> : [];
    const lineItemChanges = action === 'updated'
        ? buildLineItemChanges(beforeLineItems, afterLineItems)
        : { added: afterLineItems.map((item) => buildLineItemChange(item, undefined, item)), removed: [], updated: [] };
    const changeCount = fieldChanges.length + lineItemChanges.added.length + lineItemChanges.removed.length + lineItemChanges.updated.length;
    const summaryLines = buildBillingLogSummaryLines(action, anchor, fieldChanges, lineItemChanges);

    return stripUndefinedDeep({
        action,
        actionLabel: CARD_BILLING_ACTION_LABELS[action],
        billingId: asString(anchor.id),
        yearMonth: asString(anchor.yearMonth),
        cardId: asString(anchor.cardId),
        cardLabel: asString(anchor.cardLabel) || '카드 미지정',
        teamId: asString(anchor.teamId) || undefined,
        teamName: asString(anchor.teamName || anchor.assignedTeamName) || undefined,
        issuedToType: asString(anchor.issuedToType) || undefined,
        issuedToWorkerId: asString(anchor.issuedToWorkerId) || undefined,
        issuedToWorkerName: asString(anchor.issuedToWorkerName) || undefined,
        status: asString(anchor.status) || undefined,
        actor,
        source,
        before,
        after,
        fieldChanges,
        lineItemChanges,
        summaryLines,
        summaryText: summaryLines.join('\n'),
        changeCount: Math.max(changeCount, action === 'updated' ? 0 : 1),
        createdAt: now,
        createdAtIso: now.toDate().toISOString(),
    }) as Record<string, unknown>;
};

const buildSupportWriteOperationId = (domain: string, operationId: string): string =>
    `${sanitizeIdPart(domain)}__${sanitizeIdPart(operationId)}`;

const buildSupportWriteOperationPayload = (
    input: {
        yearMonth: string;
        operationId: string;
        status: 'success' | 'failed';
        actor: { uid: string; name: string; email: string | null };
        affectedDocumentIds?: string[];
        errorMessage?: string;
        userMessage?: string;
        metadata?: Record<string, unknown>;
    },
    now: admin.firestore.Timestamp
): Record<string, unknown> => stripUndefinedDeep({
    id: buildSupportWriteOperationId(SUPPORT_WRITE_OPERATION_DOMAIN, input.operationId),
    domain: SUPPORT_WRITE_OPERATION_DOMAIN,
    yearMonth: input.yearMonth,
    operationId: input.operationId,
    status: input.status,
    affectedDocumentIds: uniqueStrings(input.affectedDocumentIds),
    errorMessage: input.errorMessage ? input.errorMessage.slice(0, 4000) : undefined,
    userMessage: input.userMessage,
    actor: input.actor,
    metadata: input.metadata,
    createdAt: now,
    createdAtIso: now.toDate().toISOString(),
    updatedAt: now,
    updatedAtIso: now.toDate().toISOString(),
}) as Record<string, unknown>;

const hasAllowedRoleValue = (value: unknown): boolean => {
    if (Array.isArray(value)) return value.some(hasAllowedRoleValue);
    const key = normalizeKey(value);
    if (!key) return false;
    return ALLOWED_ROLE_GROUPS.has(key) || ALLOWED_ROLE_KEYS.has(key);
};

const hasAllowedAccess = (source: Record<string, unknown>): boolean => (
    hasAllowedRoleValue(source.role) ||
    hasAllowedRoleValue(source.position) ||
    hasAllowedRoleValue(source.systemRole) ||
    hasAllowedRoleValue(source.accountType) ||
    hasAllowedRoleValue(source.roles) ||
    hasAllowedRoleValue(source.additionalPositions) ||
    hasAllowedRoleValue(source.erpRoleGroups)
);

const requireCardStatementAccess = async (
    context: functions.https.CallableContext
): Promise<functions.https.CallableContext['auth']> => {
    const auth = requireCallableAuth(context);
    const token = (auth.token || {}) as Record<string, unknown>;
    if (hasAllowedAccess(token)) return auth;

    const userSnap = await admin.firestore().collection('users').doc(auth.uid).get();
    const user = userSnap.data() || {};
    if (hasAllowedAccess(user)) return auth;

    throw new functions.https.HttpsError(
        'permission-denied',
        '카드 청구서 분석 권한이 없습니다.'
    );
};

const getGeminiSettingsOrThrow = async (): Promise<{ apiKey: string; model: string }> => {
    const settings = await getServerGeminiSettings();
    const apiKey = asString(settings.apiKey);
    if (!apiKey) {
        throw new functions.https.HttpsError(
            'failed-precondition',
            '/settings/ai에서 서버용 Gemini API Key를 설정해 주세요.'
        );
    }
    return {
        apiKey,
        model: asString(settings.model) || DEFAULT_MODEL,
    };
};

const getErrorMessage = (error: unknown): string =>
    error instanceof Error ? error.message : asString(error) || 'Unknown error';

const classifyExternalAnalysisError = (
    message: string,
    fallbackCode: functions.https.FunctionsErrorCode
): functions.https.FunctionsErrorCode => {
    const lower = message.toLowerCase();
    if (lower.includes('api key') || lower.includes('permission') || lower.includes('forbidden')) {
        return 'failed-precondition';
    }
    if (lower.includes('quota') || lower.includes('rate limit') || lower.includes('resource exhausted')) {
        return 'resource-exhausted';
    }
    if (lower.includes('timeout') || lower.includes('deadline')) {
        return 'deadline-exceeded';
    }
    if (lower.includes('unavailable') || lower.includes('503') || lower.includes('502')) {
        return 'unavailable';
    }
    if (
        lower.includes('invalid') ||
        lower.includes('unsupported') ||
        lower.includes('schema') ||
        lower.includes('mime') ||
        lower.includes('pdf')
    ) {
        return 'failed-precondition';
    }
    return fallbackCode;
};

const toHttpsError = (
    error: unknown,
    fallbackCode: functions.https.FunctionsErrorCode = 'internal'
): functions.https.HttpsError => {
    if (error instanceof functions.https.HttpsError) return error;
    const message = getErrorMessage(error);
    return new functions.https.HttpsError(classifyExternalAnalysisError(message, fallbackCode), message);
};

const inferMimeType = (storagePath: string, metadataContentType?: string): string => {
    const contentType = asString(metadataContentType);
    if (contentType) return contentType;
    const lower = storagePath.toLowerCase();
    if (lower.endsWith('.pdf')) return 'application/pdf';
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.webp')) return 'image/webp';
    if (lower.endsWith('.gif')) return 'image/gif';
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
    return 'application/pdf';
};

const validateMimeType = (mimeType: string): void => {
    if (mimeType === 'application/pdf' || mimeType.startsWith('image/')) return;
    throw new functions.https.HttpsError(
        'invalid-argument',
        `지원하지 않는 파일 형식입니다: ${mimeType}`
    );
};

const downloadStorageFileAsBase64 = async (
    storagePath: string,
    maxSizeBytes = MAX_INLINE_FILE_SIZE_BYTES,
): Promise<DownloadedStatementFile> => {
    const file = admin.storage().bucket().file(storagePath);
    const [metadata] = await file.getMetadata();
    const size = asFiniteNumber(metadata.size, 0);
    if (size > maxSizeBytes) {
        throw new functions.https.HttpsError(
            'failed-precondition',
            `PDF 파일이 너무 큽니다. ${Math.floor(maxSizeBytes / 1024 / 1024)}MB 이하 파일만 처리할 수 있습니다.`
        );
    }

    const mimeType = inferMimeType(storagePath, metadata.contentType);
    validateMimeType(mimeType);

    const [buffer] = await file.download();
    return {
        base64: buffer.toString('base64'),
        buffer,
        mimeType,
        size: buffer.length,
        sha256: hashCardStatementSource(buffer),
    };
};

const requireCardStatementSourceSha256 = (value: unknown, message: string): string => {
    const normalized = normalizeCardStatementSourceSha256(value);
    if (normalized) return normalized;
    throw new functions.https.HttpsError('failed-precondition', message);
};

const assertDownloadedCardStatementSource = (
    file: DownloadedStatementFile,
    expectedSha256: unknown,
    mismatchMessage: string,
): string => {
    const expected = requireCardStatementSourceSha256(
        expectedSha256,
        '원본 SHA-256 정보가 없습니다. PDF를 다시 업로드한 뒤 재분석해 주세요.',
    );
    if (file.sha256 !== expected) {
        throw new functions.https.HttpsError('failed-precondition', mismatchMessage);
    }
    return expected;
};

const verifyDownloadedCardStatementForAnalysis = async (
    fileRef: FirebaseFirestore.DocumentReference,
    fileData: Record<string, unknown>,
    file: DownloadedStatementFile,
): Promise<string> => {
    const expectedSha256 = normalizeCardStatementSourceSha256(fileData.sha256);
    if (!expectedSha256) {
        await fileRef.set({
            sha256: file.sha256,
            sourceHashVerificationStatus: 'recovered_requires_reanalysis',
            sourceHashVerifiedAt: safeTimestamp(),
            updatedAt: safeTimestamp(),
        }, { merge: true });
        throw new functions.https.HttpsError(
            'failed-precondition',
            '원본 SHA-256이 누락되어 서버 값으로 복구했습니다. 중복 방지를 위해 재분석해 주세요.',
        );
    }
    if (file.sha256 !== expectedSha256) {
        await fileRef.set({
            sourceHashVerificationStatus: 'mismatch',
            sourceHashObservedSha256: file.sha256,
            updatedAt: safeTimestamp(),
        }, { merge: true });
        throw new functions.https.HttpsError(
            'failed-precondition',
            'PDF 원본이 분석 준비 이후 변경되었습니다. 파일을 다시 업로드해 주세요.',
        );
    }
    return expectedSha256;
};

const normalizeExtractedPdfText = (text: unknown): string =>
    asString(text)
        .replace(/\u00a0/g, ' ')
        .replace(/[ \t]+/g, ' ')
        .replace(/\s*\n\s*/g, '\n')
        .trim();

const parseKrwAmountText = (value: unknown): number | null => {
    const normalized = asString(value).replace(/[^\d-]/g, '');
    if (!normalized || normalized === '-') return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? Math.round(parsed) : null;
};

const extractLabeledKrwAmount = (text: string): number | null => {
    const labels = [
        String.raw`총\s*정상\s*이용\s*금액`,
        String.raw`정상\s*이용\s*금액`,
        String.raw`총\s*청구\s*금액`,
        String.raw`청구\s*금액`,
        String.raw`이번\s*달\s*결제\s*금액`,
        String.raw`결제\s*예정\s*금액`,
        String.raw`최종\s*결제\s*금액`,
    ];

    for (const label of labels) {
        const match = new RegExp(`${label}[^0-9-]{0,120}\\[?\\s*(-?[0-9][0-9,\\s]*)\\s*원`, 'i').exec(text);
        const amount = parseKrwAmountText(match?.[1]);
        if (amount !== null) return amount;
    }

    return null;
};

const extractLast4FromText = (text: string): string => {
    const cardKeywordMatch = /(?:카드\s*(?:번호)?|card\s*(?:number)?|회원\s*번호)[^\d]{0,40}((?:\d[\s*-]?){12,19})/i.exec(text);
    const keywordDigits = asString(cardKeywordMatch?.[1]).replace(/\D/g, '');
    if (keywordDigits.length >= 4) return keywordDigits.slice(-4);

    const fullCardMatch = /(?:\d{4}[\s*-]){3}\d{4}/.exec(text);
    const fullCardDigits = asString(fullCardMatch?.[0]).replace(/\D/g, '');
    if (fullCardDigits.length >= 4) return fullCardDigits.slice(-4);

    return '';
};

const extractLast4FromFileName = (value: unknown): string => {
    const fileName = asString(value).split(/[\\/]/).pop() || '';
    const withoutExtension = fileName.replace(/\.[^.]+$/, '');
    const groups = withoutExtension.match(/(^|\D)(\d{4})(?=\D|$)/g) || [];
    if (groups.length === 0) return '';
    const last = groups[groups.length - 1].replace(/\D/g, '');
    return last.slice(-4);
};

const extractStatementMonthFromText = (text: string, fallbackYearMonth?: string): string => {
    if (isValidYearMonth(fallbackYearMonth)) return asString(fallbackYearMonth);
    const match = /(20\d{2})[.\-/년\s]+(0?[1-9]|1[0-2])\s*월?/.exec(text);
    if (!match) return '';
    return `${match[1]}-${match[2].padStart(2, '0')}`;
};

const buildFastTotalOnlyAnalysis = async (
    input: AnalyzeCardBillingStatementRequest,
    file: DownloadedStatementFile
): Promise<CardStatementAnalysisResult | null> => {
    if (file.mimeType !== 'application/pdf') return null;

    let parser: any = null;
    try {
        parser = new PDFParse({ data: file.buffer });
        const textResult = await parser.getText({ partial: [1] });
        const text = normalizeExtractedPdfText(textResult?.text);
        if (!text) return null;

        const amount = extractLabeledKrwAmount(text);
        const cardLast4 = extractLast4FromFileName(input.cardLabel)
            || extractLast4FromFileName(input.statementPath)
            || extractLast4FromText(text);
        if (amount === null || !cardLast4) return null;

        const statementMonth = extractStatementMonthFromText(text, input.yearMonth);
        const warnings = [
            '빠른 총액 모드: 거래 상세는 생략하고 총 정상이용금액/청구금액 기준 총액만 추출했습니다.',
        ];
        const output: GeminiKbCardStatementOutput = {
            bankName: 'KB국민카드',
            statementMonth,
            grandTotalAmount: amount,
            cards: [{
                cardLast4,
                cardName: 'KB국민카드',
                holderName: '',
                subtotalAmount: amount,
                transactions: [],
                warnings,
                confidence: 0.94,
            }],
            warnings,
        };
        const parsed = toCompatibleOutput(output);
        return {
            rawText: JSON.stringify(parsed),
            parsed,
            source: 'fast_text',
        };
    } catch (error) {
        functions.logger.warn('Fast KB card statement text extraction skipped', {
            statementPath: input.statementPath,
            message: getErrorMessage(error),
        });
        return null;
    } finally {
        if (parser) {
            await parser.destroy().catch(() => undefined);
        }
    }
};

const extractGeminiText = (payload: any): string => {
    const parts = payload?.candidates?.[0]?.content?.parts;
    if (!Array.isArray(parts)) return '';
    return parts.map((part: any) => typeof part?.text === 'string' ? part.text : '').join('').trim();
};

const parseJsonObject = (text: string): any => {
    try {
        return JSON.parse(text);
    } catch {
        const objectStart = text.indexOf('{');
        const objectEnd = text.lastIndexOf('}');
        if (objectStart >= 0 && objectEnd > objectStart) {
            return JSON.parse(text.slice(objectStart, objectEnd + 1));
        }
        throw new Error('Gemini 응답 JSON을 파싱할 수 없습니다.');
    }
};

const normalizeCategory = (value: unknown): CardStatementCategory => {
    const key = asString(value).toUpperCase();
    if ((CATEGORY_VALUES as string[]).includes(key)) return key as CardStatementCategory;
    return 'OTHER';
};

const sanitizeTransaction = (value: unknown): GeminiCardStatementTransaction => {
    const raw = (value || {}) as Record<string, unknown>;
    return {
        date: asString(raw.date),
        merchant: asString(raw.merchant),
        amount: Math.round(asFiniteNumber(raw.amount, 0)),
        category: normalizeCategory(raw.category),
        memo: asString(raw.memo) || undefined,
        confidence: clampConfidence(raw.confidence),
    };
};

const sanitizeCard = (value: unknown): GeminiCardStatementCard => {
    const raw = (value || {}) as Record<string, unknown>;
    const transactions = Array.isArray(raw.transactions)
        ? raw.transactions.map(sanitizeTransaction)
        : [];
    const transactionTotal = transactions.reduce((sum, item) => sum + item.amount, 0);
    const subtotalAmount = Math.round(asFiniteNumber(raw.subtotalAmount, transactionTotal));

    return {
        cardLast4: asString(raw.cardLast4).replace(/\D/g, '').slice(-4),
        cardName: asString(raw.cardName) || undefined,
        holderName: asString(raw.holderName) || undefined,
        subtotalAmount,
        transactions,
        warnings: asStringArray(raw.warnings),
        confidence: clampConfidence(raw.confidence),
    };
};

const sanitizeGeminiOutput = (value: unknown): GeminiKbCardStatementOutput => {
    const raw = (value || {}) as Record<string, unknown>;
    const cards = Array.isArray(raw.cards) ? raw.cards.map(sanitizeCard) : [];
    const cardTotal = cards.reduce((sum, card) => sum + card.subtotalAmount, 0);
    const grandTotalAmount = Math.round(asFiniteNumber(raw.grandTotalAmount, cardTotal));

    return {
        bankName: asString(raw.bankName) || 'KB국민은행',
        statementMonth: asString(raw.statementMonth),
        grandTotalAmount,
        cards,
        warnings: asStringArray(raw.warnings),
    };
};

const getCardLabel = (card: Pick<FirestoreCardRecord, 'name' | 'last4' | 'maskedNumber'>): string => {
    const name = asString(card.name) || '카드';
    const last4 = asString(card.last4) || asString(card.maskedNumber).replace(/\D/g, '').slice(-4);
    return last4 ? `${name} (${last4})` : name;
};

const normalizeMatchText = (value: unknown): string =>
    asString(value).replace(/\s+/g, '').toLowerCase();

const textIncludes = (source: unknown, needle: unknown): boolean => {
    const sourceText = normalizeMatchText(source);
    const needleText = normalizeMatchText(needle);
    return Boolean(sourceText && needleText && sourceText.includes(needleText));
};

const buildCardMatchCandidate = (
    statementCard: GeminiCardStatementCard,
    card: FirestoreCardRecord
): CardMatchCandidate | null => {
    const statementLast4 = asString(statementCard.cardLast4).replace(/\D/g, '').slice(-4);
    const cardLast4 = asString(card.last4).replace(/\D/g, '').slice(-4)
        || asString(card.maskedNumber).replace(/\D/g, '').slice(-4);
    const reasons: string[] = [];
    let score = 0;

    if (statementLast4 && cardLast4 && statementLast4 === cardLast4) {
        score += 0.72;
        reasons.push('last4_exact');
    } else if (statementLast4 && asString(card.maskedNumber).replace(/\D/g, '').endsWith(statementLast4)) {
        score += 0.68;
        reasons.push('masked_number_last4');
    }

    if (statementCard.cardName && (
        textIncludes(card.name, statementCard.cardName) ||
        textIncludes(statementCard.cardName, card.name) ||
        textIncludes(card.issuer, statementCard.cardName)
    )) {
        score += 0.14;
        reasons.push('card_name');
    }

    if (statementCard.holderName && (
        textIncludes(card.currentAssigneeName, statementCard.holderName) ||
        textIncludes(card.billingTargetName, statementCard.holderName) ||
        textIncludes(card.memo, statementCard.holderName)
    )) {
        score += 0.1;
        reasons.push('holder_name');
    }

    if (normalizeKey(card.status) === 'closed') {
        score -= 0.2;
        reasons.push('closed_card_penalty');
    }

    if (score <= 0) return null;

    return {
        cardId: card.id,
        cardLabel: getCardLabel(card),
        cardLast4,
        score: Number(Math.max(0, Math.min(score, 1)).toFixed(3)),
        reasons,
    };
};

const matchStatementCard = (
    statementCard: GeminiCardStatementCard,
    cards: FirestoreCardRecord[]
): CardMatchResult => {
    const statementLast4 = asString(statementCard.cardLast4).replace(/\D/g, '').slice(-4);
    const warnings: string[] = [];
    const candidates = cards
        .map((card) => buildCardMatchCandidate(statementCard, card))
        .filter((candidate): candidate is CardMatchCandidate => Boolean(candidate))
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

    if (!statementLast4) {
        warnings.push('카드번호 뒤 4자리를 읽지 못했습니다.');
    }

    if (candidates.length === 0) {
        return {
            matchConfidence: 0,
            matchCandidates: [],
            warnings: [...warnings, '등록된 카드와 자동 매칭되지 않았습니다.'],
        };
    }

    const best = candidates[0];
    const second = candidates[1];
    const exactLast4Count = candidates.filter((candidate) => (
        statementLast4 && candidate.cardLast4 === statementLast4
    )).length;
    const hasClearWinner = best.score >= 0.72 && (!second || best.score - second.score >= 0.15);
    const hasUniqueLast4 = exactLast4Count === 1 && best.cardLast4 === statementLast4 && best.score >= 0.72;

    if (hasUniqueLast4 || hasClearWinner) {
        return {
            matchedCardId: best.cardId,
            matchedCardLabel: best.cardLabel,
            matchConfidence: best.score,
            matchCandidates: candidates,
            warnings,
        };
    }

    return {
        matchConfidence: best.score,
        matchCandidates: candidates,
        warnings: [
            ...warnings,
            exactLast4Count > 1
                ? '같은 뒤 4자리 카드 후보가 여러 개입니다.'
                : '자동 매칭 신뢰도가 낮아 확인이 필요합니다.',
        ],
    };
};

const loadCardsForMatching = async (): Promise<FirestoreCardRecord[]> => {
    const snapshot = await admin.firestore().collection(COLLECTIONS.cards).get();
    return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<FirestoreCardRecord, 'id'>),
    }));
};

const addComputedWarnings = (
    output: GeminiKbCardStatementOutput,
    card: GeminiCardStatementCard,
    expectedYearMonth: string
): string[] => {
    const warnings = [...output.warnings, ...card.warnings];
    if (expectedYearMonth && output.statementMonth && output.statementMonth !== expectedYearMonth) {
        warnings.push(`청구월 불일치: 선택 월 ${expectedYearMonth}, PDF ${output.statementMonth}`);
    }

    const transactionTotal = card.transactions.reduce((sum, item) => sum + item.amount, 0);
    if (card.transactions.length > 0 && Math.abs(transactionTotal - card.subtotalAmount) > 1) {
        warnings.push(`카드 합계 불일치: 거래 합계 ${transactionTotal}, 카드 소계 ${card.subtotalAmount}, 차이 ${transactionTotal - card.subtotalAmount}`);
    }

    return Array.from(new Set(warnings.map(asString).filter(Boolean))).slice(0, 50);
};

const isBlockingAnalysisWarning = (warning: unknown): boolean => {
    const text = asString(warning);
    return text.includes('카드 합계 불일치') ||
        (text.includes('거래 합계') && text.includes('카드 소계'));
};

const getBlockingAnalysisReviewReason = (warnings: unknown[]): string =>
    asString(warnings.find(isBlockingAnalysisWarning));

const isBlockingAnalysisReviewUnresolved = (result: Record<string, unknown>): boolean =>
    Boolean(getBlockingAnalysisReviewReason(asStringArray(result.warnings))) &&
    result.analysisReviewRequired !== false;

const parseYmdDate = (value?: unknown): Date | null => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(asString(value));
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
    return date;
};

const getMonthStartText = (yearMonth: string): string => `${yearMonth}-01`;

const isBillingTargetActiveOnDate = (target: Record<string, unknown>, date: Date): boolean => {
    const start = parseYmdDate(target.startDate);
    if (!start || start.getTime() > date.getTime()) return false;
    const endText = asString(target.endDate);
    if (!endText) return true;
    const end = parseYmdDate(endText);
    return Boolean(end && end.getTime() >= date.getTime());
};

const loadDocByIdOrLegacy = async (
    collectionName: string,
    id?: unknown
): Promise<(Record<string, unknown> & { id: string }) | null> => {
    const key = asString(id);
    if (!key) return null;
    const db = admin.firestore();
    const direct = await db.collection(collectionName).doc(key).get();
    if (direct.exists) return { id: direct.id, ...direct.data() };
    const legacy = await db.collection(collectionName).where('legacyId', '==', key).limit(1).get();
    if (!legacy.empty) {
        const docSnap = legacy.docs[0];
        return { id: docSnap.id, ...docSnap.data() };
    }
    return null;
};

const resolveAssignedTeamForCard = async (card: FirestoreCardRecord): Promise<{
    assignedTeamId?: string;
    assignedTeamName?: string;
}> => {
    if (card.currentAssigneeType === 'TEAM') {
        return {
            assignedTeamId: asString(card.currentAssigneeId) || undefined,
            assignedTeamName: asString(card.currentAssigneeName) || undefined,
        };
    }

    if (card.currentAssigneeType === 'WORKER') {
        const worker = await loadDocByIdOrLegacy(COLLECTIONS.workers, card.currentAssigneeId);
        return {
            assignedTeamId: asString(worker?.teamId) || undefined,
            assignedTeamName: asString(worker?.teamName) || undefined,
        };
    }

    return {};
};

const resolveCardBillingTargetForMonth = async (
    card: FirestoreCardRecord,
    yearMonth: string
): Promise<ResolvedBillingTarget | null> => {
    const db = admin.firestore();
    const monthStart = parseYmdDate(getMonthStartText(yearMonth)) ?? new Date();
    const assigned = await resolveAssignedTeamForCard(card);
    const targetsSnapshot = await db.collection(COLLECTIONS.billingTargets)
        .where('cardId', '==', card.id)
        .get();
    const target = (targetsSnapshot.docs
        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Record<string, unknown> & { id: string }))
        .filter((item) => isBillingTargetActiveOnDate(item, monthStart))
        .sort((a, b) => asString(b.startDate).localeCompare(asString(a.startDate)))[0]) as Record<string, unknown> | undefined;

    const targetType = asString(target?.targetType || card.billingTargetType || card.currentAssigneeType);
    const targetId = asString(target?.targetId || card.billingTargetId || card.currentAssigneeId);
    const targetName = asString(target?.targetName || card.billingTargetName || card.currentAssigneeName);

    if (targetType === 'OFFICE') {
        return {
            ...assigned,
            teamId: OFFICE_TARGET_ID,
            teamName: targetName || OFFICE_TARGET_NAME,
            issuedToType: 'team',
        };
    }

    if (targetType === 'OFFICE_STAFF') {
        return {
            ...assigned,
            teamId: OFFICE_TARGET_ID,
            teamName: OFFICE_TARGET_NAME,
            issuedToType: 'worker',
            issuedToWorkerId: targetId || undefined,
            issuedToWorkerName: targetName || undefined,
        };
    }

    if (targetType === 'WORKER') {
        const worker = await loadDocByIdOrLegacy(COLLECTIONS.workers, targetId);
        const teamId = asString(worker?.teamId || assigned.assignedTeamId);
        const teamName = asString(worker?.teamName || assigned.assignedTeamName);
        if (!teamId && !teamName) return null;
        return {
            ...assigned,
            teamId: teamId || 'unassigned',
            teamName,
            issuedToType: 'worker',
            issuedToWorkerId: asString(worker?.id || targetId) || undefined,
            issuedToWorkerName: asString(worker?.name || targetName) || undefined,
        };
    }

    if (targetType === 'TEAM') {
        const team = await loadDocByIdOrLegacy(COLLECTIONS.teams, targetId);
        const teamId = asString(team?.id || targetId || assigned.assignedTeamId);
        const teamName = asString(team?.name || targetName || assigned.assignedTeamName);
        if (!teamId && !teamName) return null;
        return {
            ...assigned,
            teamId: teamId || 'unassigned',
            teamName,
            issuedToType: 'team',
        };
    }

    if (assigned.assignedTeamId || assigned.assignedTeamName) {
        return {
            ...assigned,
            teamId: assigned.assignedTeamId || 'unassigned',
            teamName: assigned.assignedTeamName || '',
            issuedToType: 'team',
        };
    }

    return null;
};

const buildBillingDocumentId = (params: {
    cardId: string;
    teamId: string;
    issuedToType: 'team' | 'worker';
    workerId?: string;
    yearMonth: string;
}): string => {
    const workerPart = params.workerId ? params.workerId : 'none';
    return `${params.cardId}_${params.teamId}_${params.issuedToType}_${workerPart}_${params.yearMonth}`;
};

const isPostedBillingStatus = (value: unknown): boolean => POSTED_BILLING_STATUSES.has(asString(value).toUpperCase());

const buildTransactionId = (
    yearMonth: string,
    cardId: string,
    result: Record<string, unknown>,
    transaction: Record<string, unknown>,
    transactionIndex: number
): string => {
    const sourceSha256 = normalizeCardStatementSourceSha256(result.sourceSha256);
    if (sourceSha256) {
        const analyzedTransactions = Array.isArray(result.transactions)
            ? result.transactions as Array<Record<string, unknown>>
            : [];
        const identityTransactions = analyzedTransactions.length > 0
            ? analyzedTransactions
            : [transaction];
        const deterministicId = buildCardStatementTransactionDocumentId({
            yearMonth,
            cardId,
            sourceSha256,
            result: {
                cardLast4: result.cardLast4,
                cardName: result.cardName,
                holderName: result.holderName,
                subtotalAmount: result.subtotalAmount,
                transactions: identityTransactions,
            },
            transactionIndex: analyzedTransactions.length > 0 ? transactionIndex : 0,
        });
        if (deterministicId) return deterministicId;
    }

    // Preserve the legacy id shape only for already-created hash-less results.
    return [
        'card-statement',
        yearMonth,
        cardId,
        result.fileId,
        Math.max(0, Math.round(asFiniteNumber(result.resultIndex, 0))),
        transaction.id || transactionIndex,
    ].map(sanitizeIdPart).join('__');
};

const buildCardStatementImportBillingLogId = (operationId: string, billingId: string): string =>
    ['card-statement-import-billing-log', operationId, billingId].map(sanitizeIdPart).join('__');

const summarizeCommittedImportResults = (
    resultDocs: Array<{ id: string; data: Record<string, unknown> }>
): { committedResults: number; committedTransactions: number } => {
    const committedDocs = resultDocs.filter(({ data }) => asString(data.status) === 'committed');
    const committedTransactionIds: string[] = [];
    let fallbackTransactionCount = 0;

    committedDocs.forEach(({ data }) => {
        const markerTransactionIds = asStringList(data.committedTransactionIds);
        if (markerTransactionIds.length > 0) {
            committedTransactionIds.push(...markerTransactionIds);
        } else {
            fallbackTransactionCount += Math.max(0, Math.round(asFiniteNumber(data.transactionCount, 0)));
        }
    });

    return {
        committedResults: committedDocs.length,
        committedTransactions: uniqueStrings(committedTransactionIds).length + fallbackTransactionCount,
    };
};

const collectCommitAffectedDocumentIds = (
    jobId: string,
    resultDocs: Array<{ id: string; data: Record<string, unknown> }>,
    extraIds: unknown[] = []
): string[] => uniqueStrings([
    jobId,
    ...extraIds,
    ...resultDocs.flatMap(({ id, data }) => [
        id,
        data.committedBillingId,
        data.committedBillingLogId,
        ...asStringList(data.committedTransactionIds),
    ]),
]);

const buildPreparedCommit = async (
    result: Record<string, unknown> & { id: string },
    card: FirestoreCardRecord,
    yearMonth: string
): Promise<PreparedCommitResult | null> => {
    const target = await resolveCardBillingTargetForMonth(card, yearMonth);
    if (!target) return null;

    const billingId = buildBillingDocumentId({
        cardId: card.id,
        teamId: target.teamId,
        issuedToType: target.issuedToType,
        workerId: target.issuedToType === 'worker' ? target.issuedToWorkerId : undefined,
        yearMonth,
    });
    const transactions = Array.isArray(result.transactions) ? result.transactions as Array<Record<string, unknown>> : [];
    const sourcePath = asString(result.sourceStoragePath);
    const sourceSha256 = normalizeCardStatementSourceSha256(result.sourceSha256);
    const originalFileName = asString(result.originalFileName);

    const transactionUpserts = transactions.map((transaction, index) => {
        const id = buildTransactionId(yearMonth, card.id, result, transaction, index);
        const date = parseYmdDate(transaction.date) ? asString(transaction.date) : getMonthStartText(yearMonth);
        return {
            id,
            cardId: card.id,
            cardLabel: getCardLabel(card),
            date,
            yearMonth,
            merchant: asString(transaction.merchant) || asString(result.originalFileName) || 'KB card statement',
            category: normalizeCategory(transaction.category),
            amount: Math.round(asFiniteNumber(transaction.amount, 0)),
            memo: asString(transaction.memo) || `PDF로 가져옴 · ${asString(result.originalFileName)}`,
            evidenceUrl: sourcePath || null,
            statementAttachmentPaths: sourcePath ? [sourcePath] : [],
            statementSourceSha256: sourceSha256 || undefined,
            statementOriginalFileName: originalFileName || undefined,
            status: 'ACTIVE',
            operationId: `card-statement-import:${result.jobId}`,
            lastOperationId: `card-statement-import:${result.jobId}`,
            createdAt: safeTimestamp(),
            updatedAt: safeTimestamp(),
        };
    });

    const lineItems = transactionUpserts.map((transaction) => ({
        id: transaction.id,
        label: `${transaction.merchant} - ${transaction.date}`,
        amount: transaction.amount,
        type: 'VARIABLE',
        category: transaction.category,
        sourceType: 'card_ledger',
        sourceLedgerRowId: transaction.id,
        sourceStartDate: transaction.date,
        sourceEndDate: transaction.date,
    }));

    if (lineItems.length === 0 && asFiniteNumber(result.subtotalAmount, 0) !== 0) {
        const fallbackId = buildTransactionId(yearMonth, card.id, result, { id: 'total' }, 0);
        const amount = Math.round(asFiniteNumber(result.subtotalAmount, 0));
        transactionUpserts.push({
            id: fallbackId,
            cardId: card.id,
            cardLabel: getCardLabel(card),
            date: getMonthStartText(yearMonth),
            yearMonth,
            merchant: asString(result.originalFileName) || 'KB card statement total',
            category: 'OTHER',
            amount,
            memo: 'PDF로 가져옴 · 청구서 총액',
            evidenceUrl: sourcePath || null,
            statementAttachmentPaths: sourcePath ? [sourcePath] : [],
            statementSourceSha256: sourceSha256 || undefined,
            statementOriginalFileName: originalFileName || undefined,
            status: 'ACTIVE',
            operationId: `card-statement-import:${result.jobId}`,
            lastOperationId: `card-statement-import:${result.jobId}`,
            createdAt: safeTimestamp(),
            updatedAt: safeTimestamp(),
        });
        lineItems.push({
            id: fallbackId,
            label: 'KB PDF 청구서 총액',
            amount,
            type: 'VARIABLE',
            category: 'OTHER',
            sourceType: 'card_ledger',
            sourceLedgerRowId: fallbackId,
            sourceStartDate: getMonthStartText(yearMonth),
            sourceEndDate: getMonthStartText(yearMonth),
        });
    }

    return {
        resultId: result.id,
        billingId,
        billingTarget: target,
        transactionUpserts,
        lineItems,
        statementPath: sourcePath,
    };
};

const commitCardStatementBillingGroupTransaction = async (params: {
    db: FirebaseFirestore.Firestore;
    billingId: string;
    group: CardStatementImportBillingGroup;
    jobId: string;
    yearMonth: string;
    operationId: string;
    actor: { uid: string; name: string; email: string | null };
}): Promise<CommitCardStatementBillingGroupResult> => {
    const { db, billingId, group, jobId, yearMonth, operationId, actor } = params;
    const billingRef = db.collection(COLLECTIONS.billings).doc(billingId);
    return db.runTransaction(async (transaction) => {
        const existingSnap = await transaction.get(billingRef);
        const existing = existingSnap.data() || {};
        const resultEntries = group.resultIds.map((resultId) => ({
            resultId,
            ref: db.collection(COLLECTIONS.results).doc(resultId),
            marker: group.resultMarkers.get(resultId) || {
                transactionIds: [],
                lineItemIds: [],
                statementPath: '',
                sourceSha256: '',
                sourceFileId: '',
            },
        }));
        const resultSnaps = await Promise.all(resultEntries.map((entry) => transaction.get(entry.ref)));
        const resultStates = resultEntries.map((entry, index) => ({
            ...entry,
            snap: resultSnaps[index],
            data: resultSnaps[index].data() || {},
        }));
        const pendingResultStates = resultStates.filter(({ data }) => asString(data.status) === 'matched');

        if (pendingResultStates.length === 0) {
            return {
                committedResults: 0,
                committedTransactions: 0,
                skippedResults: 0,
                committedBillingDocumentCount: 0,
                protectedBillingIds: [],
                affectedDocumentIds: [
                    billingId,
                    ...resultStates.map(({ resultId }) => resultId),
                    ...resultStates.flatMap(({ data }) => [
                        data.committedBillingId,
                        data.committedBillingLogId,
                        ...asStringList(data.committedTransactionIds),
                    ]),
                ],
            };
        }

        const claimEntries = Array.from(pendingResultStates.reduce((bySha256, resultState) => {
            const sourceSha256 = normalizeCardStatementSourceSha256(resultState.marker.sourceSha256);
            if (!sourceSha256) {
                throw new functions.https.HttpsError(
                    'failed-precondition',
                    '저장할 분석 결과의 원본 SHA-256이 없습니다. 재분석해 주세요.',
                );
            }
            if (!bySha256.has(sourceSha256)) {
                bySha256.set(sourceSha256, {
                    sourceSha256,
                    ref: db.collection(COLLECTIONS.sourceClaims).doc(
                        buildCardStatementSourceClaimDocumentId(sourceSha256),
                    ),
                    resultStates: [] as typeof pendingResultStates,
                });
            }
            bySha256.get(sourceSha256)!.resultStates.push(resultState);
            return bySha256;
        }, new Map<string, {
            sourceSha256: string;
            ref: FirebaseFirestore.DocumentReference;
            resultStates: typeof pendingResultStates;
        }>()).values());
        const claimSnapshots = await Promise.all(claimEntries.map((entry) => transaction.get(entry.ref)));
        claimEntries.forEach((entry, index) => {
            const claim = claimSnapshots[index].data() || {};
            if (!claimSnapshots[index].exists || asString(claim.ownerJobId) !== jobId) {
                throw new functions.https.HttpsError(
                    'already-exists',
                    '같은 원본 PDF를 다른 가져오기 작업이 이미 저장했습니다.',
                );
            }
            const ownerFileId = asString(claim.ownerFileId);
            if (ownerFileId && entry.resultStates.some(({ marker }) => marker.sourceFileId !== ownerFileId)) {
                throw new functions.https.HttpsError(
                    'already-exists',
                    '같은 작업 안에 중복 PDF가 있어 대표 원본만 저장할 수 있습니다.',
                );
            }
        });

        if (existingSnap.exists && isPostedBillingStatus(existing.status)) {
            pendingResultStates.forEach(({ ref }) => {
                transaction.set(ref, {
                    status: 'failed',
                    errorMessage: PROTECTED_BILLING_IMPORT_MESSAGE,
                    updatedAt: safeTimestamp(),
                }, { merge: true });
            });
            return {
                committedResults: 0,
                committedTransactions: 0,
                skippedResults: pendingResultStates.length,
                committedBillingDocumentCount: 0,
                protectedBillingIds: [billingId],
                affectedDocumentIds: [billingId, ...pendingResultStates.map(({ resultId }) => resultId)],
            };
        }

        const pendingTransactionIds = new Set(
            pendingResultStates.flatMap(({ marker }) => marker.transactionIds).filter(Boolean)
        );
        const pendingTransactionUpserts = Array.from(group.transactionUpserts.reduce((byId, item) => {
            const id = asString(item.id);
            if (id && pendingTransactionIds.has(id)) byId.set(id, item);
            return byId;
        }, new Map<string, Record<string, unknown>>()).values());

        pendingTransactionUpserts.forEach((transactionPayload) => {
            transaction.set(
                db.collection(COLLECTIONS.transactions).doc(asString(transactionPayload.id)),
                transactionPayload,
                { merge: true }
            );
        });
        pendingResultStates.forEach(({ resultId, ref, marker }) => {
            transaction.set(ref, {
                status: 'committed',
                commitOperationId: operationId,
                committedTransactionIds: marker.transactionIds,
                committedBillingId: admin.firestore.FieldValue.delete(),
                committedBillingLogId: admin.firestore.FieldValue.delete(),
                committedLineItemIds: admin.firestore.FieldValue.delete(),
                committedAt: safeTimestamp(),
                updatedAt: safeTimestamp(),
                errorMessage: admin.firestore.FieldValue.delete(),
            }, { merge: true });
        });
        claimEntries.forEach((entry, index) => {
            const claim = claimSnapshots[index].data() || {};
            const committedTransactionIds = uniqueStrings([
                ...asStringList(claim.committedTransactionIds),
                ...entry.resultStates.flatMap(({ marker }) => marker.transactionIds),
            ]);
            transaction.set(entry.ref, {
                state: 'committing',
                committedTransactionIds,
                lastCommitJobId: jobId,
                lastCommitOperationId: operationId,
                updatedAt: safeTimestamp(),
            }, { merge: true });
        });

        return {
            committedResults: pendingResultStates.length,
            committedTransactions: pendingTransactionUpserts.length,
            skippedResults: 0,
            committedBillingDocumentCount: 0,
            protectedBillingIds: [],
            affectedDocumentIds: [
                ...pendingResultStates.map(({ resultId }) => resultId),
                ...pendingTransactionUpserts.map((transactionPayload) => transactionPayload.id),
            ],
        };
    });
};

const toCompatibleOutput = (output: GeminiKbCardStatementOutput): CompatibleBillingStatementOutput => {
    const items = output.cards.flatMap((card) => (
        card.transactions.map((transaction): CompatibleBillingStatementItem => ({
            label: [
                transaction.merchant || '카드 사용',
                transaction.date,
                card.cardLast4 ? `카드 ${card.cardLast4}` : '',
            ].filter(Boolean).join(' - '),
            amount: transaction.amount,
            category: transaction.category,
            date: transaction.date,
            merchant: transaction.merchant,
            cardLast4: card.cardLast4,
            confidence: transaction.confidence,
        }))
    ));

    if (items.length === 0 && output.grandTotalAmount !== 0) {
        items.push({
            label: '청구서 총액',
            amount: output.grandTotalAmount,
            category: 'OTHER',
        });
    }

    return {
        ...output,
        totalAmount: output.grandTotalAmount || items.reduce((sum, item) => sum + item.amount, 0),
        items,
    };
};

const buildPrompt = (input: AnalyzeCardBillingStatementRequest): string => {
    const hints = [
        input.yearMonth ? `Expected statement month: ${input.yearMonth}` : '',
        input.cardLabel ? `Current billing document card label: ${input.cardLabel}` : '',
        input.billingId ? `Current billing document id: ${input.billingId}` : '',
    ].filter(Boolean).join('\n');

    return `
You extract structured data from Korean KB Kookmin Bank corporate card documents.
The attachment may be a monthly billing statement, an approval-detail export named "승인내역결과",
or an image/PDF of either format.

${hints}

Return only JSON matching the response schema.

Rules:
- bankName should be "KB국민은행" when the document is a KB/Kookmin statement.
- statementMonth must be yyyy-MM. If the statement month is not visible, return an empty string and add a warning.
- grandTotalAmount and all amounts must be integer KRW numbers without comma formatting.
- Use the actual billing/payable amount for the month. Prefer labels such as "청구금액", "이번달 결제금액",
  "총 청구금액", "결제예정금액", or the final amount column that includes VAT and reflects cancellations/refunds.
- Do not use "총 정상이용금액" as subtotalAmount or grandTotalAmount when the document also shows VAT,
  cancelled/refunded amounts, discounts, or a separate payable/billing total. In those cases calculate the
  billable total from the payable transaction rows and reconciliation totals.
- Transaction amount must be the amount that affects the monthly bill. Include VAT when VAT is charged in
  the row amount. Subtract cancelled/refunded/credited rows as negative amounts. Do not include a cancelled
  original charge and its reversal as two positive billable charges.
- For every card, the sum of transactions.amount should equal subtotalAmount. If the PDF total and visible
  transaction rows disagree, keep the line-level billable transaction amounts, set subtotalAmount to the
  best payable card total, and add a warning explaining which total was visible and why it differs.
- Negative, cancelled, or refunded transactions must be returned as negative amounts when visible.
- cardLast4 must contain only the visible last 4 digits of the card number. Do not invent hidden digits.
- Split the result by card when multiple cards are included in one PDF.
- subtotalAmount is the final billable/payable amount for that card section, not merely the normal-use total.
- For KB approval-detail exports, transaction rows often show merchant/payment/amount/tax fields in one visual column
  and approval date/time/card/approval number fields in another visual column. Align them by row order and visual layout.
- For file names such as "김군회팀 3906.pdf", use the visible or filename last 4 digits as cardLast4 only when the PDF
  itself does not show a clearer card number.
- transaction.date must be yyyy-MM-dd when visible. If the day is visible but year/month is implicit, infer it from statementMonth.
- category must be one of FUEL, TOLL, MEAL, MATERIAL, OTHER.
- Use FUEL for gas stations/charging/fuel, TOLL for highway toll/Hi-pass, MEAL for restaurants/cafes/food, MATERIAL for construction materials/tools/supplies, OTHER otherwise.
- confidence must be between 0 and 1.
- Do not guess unreadable merchant names or card numbers. Use empty strings and warnings.
- Add warnings for unreadable fields, subtotal mismatch, grand total mismatch, duplicate-looking rows, or uncertain card matching clues.
`;
};

const buildGeminiRequest = (
    input: AnalyzeCardBillingStatementRequest,
    file: { base64: string; mimeType: string }
): Record<string, unknown> => ({
    contents: [{
        role: 'user',
        parts: [
            { text: buildPrompt(input) },
            { inlineData: { mimeType: file.mimeType, data: file.base64 } },
        ],
    }],
    generationConfig: {
        temperature: 0.05,
        responseMimeType: 'application/json',
        responseJsonSchema: CARD_BILLING_STATEMENT_SCHEMA,
    },
});

const callGeminiCardStatementAnalysis = async (
    input: AnalyzeCardBillingStatementRequest,
    file: { base64: string; mimeType: string }
): Promise<{ rawText: string; parsed: CompatibleBillingStatementOutput }> => {
    const { apiKey, model } = await getGeminiSettingsOrThrow();
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildGeminiRequest(input, file)),
    });

    const rawResponseText = await response.text();
    let payload: any = null;
    try {
        payload = rawResponseText ? JSON.parse(rawResponseText) : null;
    } catch {
        payload = null;
    }

    if (!response.ok || payload?.error) {
        const message = payload?.error?.message || `${response.status} ${response.statusText}`;
        const code: functions.https.FunctionsErrorCode =
            response.status === 401 || response.status === 403 ? 'failed-precondition'
                : response.status === 429 ? 'resource-exhausted'
                    : response.status === 408 || response.status === 504 ? 'deadline-exceeded'
                        : response.status >= 500 ? 'unavailable'
                            : classifyExternalAnalysisError(message, 'failed-precondition');
        functions.logger.error('Gemini card billing statement analysis failed', {
            status: response.status,
            message,
            model,
            rawText: rawResponseText,
        });
        throw new functions.https.HttpsError(code, `Gemini analysis failed: ${message}`);
    }

    const rawText = extractGeminiText(payload);
    if (!rawText) {
        throw new functions.https.HttpsError('failed-precondition', 'Gemini analysis returned an empty response.');
    }

    const parsed = toCompatibleOutput(sanitizeGeminiOutput(parseJsonObject(rawText)));
    return { rawText, parsed };
};

const analyzeCardStatementImportFile = async (
    input: AnalyzeCardBillingStatementRequest,
    file: DownloadedStatementFile
): Promise<CardStatementAnalysisResult> => {
    const fast = await buildFastTotalOnlyAnalysis(input, file);
    if (fast) return fast;

    const gemini = await callGeminiCardStatementAnalysis(input, file);
    return {
        ...gemini,
        source: 'gemini',
    };
};

export const analyzeCardBillingStatement = functions
    .runWith({ timeoutSeconds: 120, memory: '512MB', maxInstances: 5 })
    .region('asia-northeast3')
    .https.onCall(async (data: AnalyzeCardBillingStatementRequest, context) => {
        try {
            await requireCardStatementAccess(context);

            const statementPath = asString(data?.statementPath);
            if (!statementPath || statementPath.includes('..')) {
                throw new functions.https.HttpsError(
                    'invalid-argument',
                    '분석할 청구서 파일 경로가 필요합니다.'
                );
            }

            const file = await downloadStorageFileAsBase64(statementPath);
            const gemini = await callGeminiCardStatementAnalysis(
                {
                    statementPath,
                    billingId: asString(data?.billingId) || undefined,
                    yearMonth: asString(data?.yearMonth) || undefined,
                    cardLabel: asString(data?.cardLabel) || undefined,
                },
                file
            );

            return {
                ok: true,
                analysis: {
                    status: 'completed',
                    message: 'Gemini 카드 청구서 분석이 완료되었습니다.',
                    file: {
                        statementPath,
                        mimeType: file.mimeType,
                        size: file.size,
                    },
                    gemini,
                },
            };
        } catch (error) {
            throw toHttpsError(error);
        }
    });

const getJobStatusPayload = async (jobId: string): Promise<Record<string, unknown>> => {
    const db = admin.firestore();
    const jobSnap = await db.collection(COLLECTIONS.jobs).doc(jobId).get();
    if (!jobSnap.exists) {
        throw new functions.https.HttpsError('not-found', '카드 청구서 가져오기 작업을 찾을 수 없습니다.');
    }

    const [filesSnap, resultsSnap] = await Promise.all([
        db.collection(COLLECTIONS.files).where('jobId', '==', jobId).get(),
        db.collection(COLLECTIONS.results).where('jobId', '==', jobId).get(),
    ]);

    const files = filesSnap.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .sort((a: any, b: any) => Number(a.fileIndex ?? 0) - Number(b.fileIndex ?? 0));
    const results = resultsSnap.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .sort((a: any, b: any) => (
            Number(a.fileIndex ?? 0) - Number(b.fileIndex ?? 0) ||
            Number(a.resultIndex ?? 0) - Number(b.resultIndex ?? 0)
        ));

    return {
        ok: true,
        job: { id: jobSnap.id, ...jobSnap.data() },
        files,
        results,
    };
};

const recomputeCardStatementImportJobReviewSummary = async (jobId: string): Promise<void> => {
    const db = admin.firestore();
    const resultsSnap = await db.collection(COLLECTIONS.results).where('jobId', '==', jobId).get();
    const activeResults = resultsSnap.docs
        .map((doc) => doc.data())
        .filter((result) => asString(result.status) !== 'excluded');
    const matchedResults = activeResults.filter((result) => (
        ['matched', 'committed'].includes(asString(result.status)) &&
        Boolean(asString(result.matchedCardId)) &&
        !isBlockingAnalysisReviewUnresolved(result)
    ));
    const totalAmount = activeResults.reduce((sum, result) => sum + asFiniteNumber(result.subtotalAmount, 0), 0);
    const matchedAmount = matchedResults.reduce((sum, result) => sum + asFiniteNumber(result.subtotalAmount, 0), 0);

    await db.collection(COLLECTIONS.jobs).doc(jobId).set({
        totalCards: activeResults.length,
        matchedCards: matchedResults.length,
        needsReviewCards: activeResults.length - matchedResults.length,
        totalTransactions: activeResults.reduce((sum, result) => sum + asFiniteNumber(result.transactionCount, 0), 0),
        totalAmount,
        matchedAmount,
        unconfirmedAmount: totalAmount - matchedAmount,
        warningCount: activeResults.reduce((sum, result) => sum + asStringArray(result.warnings).length, 0),
        updatedAt: safeTimestamp(),
    }, { merge: true });
};

const deleteResultsForJob = async (jobId: string): Promise<void> => {
    const db = admin.firestore();
    const snapshot = await db.collection(COLLECTIONS.results).where('jobId', '==', jobId).get();
    if (snapshot.empty) return;

    let batch = db.batch();
    let count = 0;
    for (const resultDoc of snapshot.docs) {
        batch.delete(resultDoc.ref);
        count += 1;
        if (count % 400 === 0) {
            await batch.commit();
            batch = db.batch();
        }
    }
    if (count % 400 !== 0) await batch.commit();
};

const validateStoragePath = (storagePath: string): void => {
    if (!storagePath || storagePath.includes('..')) {
        throw new functions.https.HttpsError('invalid-argument', '유효한 Storage 파일 경로가 필요합니다.');
    }
};

const sanitizeStorageFileName = (value: unknown): string => {
    const safe = asString(value)
        .replace(/[\\/\n\r\t]/g, '_')
        .replace(/\s+/g, '_')
        .replace(/[^0-9A-Za-z가-힣_.()-]/g, '_')
        .slice(0, 120);
    return safe || 'statement.pdf';
};

const assertImportUploadFile = (file: CreateCardStatementImportUploadSessionFileInput): void => {
    const originalFileName = asString(file.originalFileName);
    const mimeType = asString(file.mimeType) || 'application/pdf';
    const size = asFiniteNumber(file.size, 0);
    if (mimeType !== 'application/pdf' && !originalFileName.toLowerCase().endsWith('.pdf')) {
        throw new functions.https.HttpsError('invalid-argument', 'PDF 파일만 업로드할 수 있습니다.');
    }
    if (size <= 0) {
        throw new functions.https.HttpsError('invalid-argument', '파일 크기 정보가 필요합니다.');
    }
    if (size >= MAX_STORAGE_IMPORT_FILE_SIZE_BYTES) {
        throw new functions.https.HttpsError('failed-precondition', 'PDF 파일은 25MB 미만만 업로드할 수 있습니다.');
    }
    if (file.sha256 && !normalizeCardStatementSourceSha256(file.sha256)) {
        throw new functions.https.HttpsError('invalid-argument', '원본 SHA-256 형식이 올바르지 않습니다.');
    }
};

const buildImportUploadStoragePath = (params: {
    yearMonth: string;
    jobId: string;
    fileIndex: number;
    originalFileName?: string;
}): string => {
    const safeName = sanitizeStorageFileName(params.originalFileName || `statement-${params.fileIndex + 1}.pdf`);
    const suffix = safeName.toLowerCase().endsWith('.pdf') ? safeName : `${safeName}.pdf`;
    return `card-billing-statements/${params.yearMonth}/imports/${params.jobId}/${String(params.fileIndex + 1).padStart(3, '0')}_${suffix}`;
};

const deleteStorageFileIfExists = async (storagePath: string): Promise<void> => {
    const path = asString(storagePath);
    if (!path) return;
    try {
        await admin.storage().bucket().file(path).delete();
    } catch (error: any) {
        const code = asString(error?.code);
        if (code === '404' || code === 'not-found') return;
        throw error;
    }
};

const buildSyntheticCardWhenNeeded = (parsed: CompatibleBillingStatementOutput): GeminiCardStatementCard[] => {
    if (parsed.cards.length > 0) return parsed.cards;
    if (parsed.grandTotalAmount === 0 && parsed.items.length === 0) return [];
    return [{
        cardLast4: '',
        cardName: '',
        holderName: '',
        subtotalAmount: parsed.grandTotalAmount || parsed.items.reduce((sum, item) => sum + item.amount, 0),
        transactions: parsed.items.map((item) => ({
            date: asString(item.date),
            merchant: asString(item.merchant || item.label),
            amount: Math.round(asFiniteNumber(item.amount, 0)),
            category: normalizeCategory(item.category),
            confidence: clampConfidence(item.confidence),
        })),
        warnings: ['카드별 구간을 찾지 못해 파일 총액 기준 검수 항목을 생성했습니다.'],
        confidence: 0,
    }];
};

export const createCardStatementImportUploadSession = functions
    .runWith({ timeoutSeconds: 60, memory: '256MB', maxInstances: 10 })
    .region('asia-northeast3')
    .https.onCall(async (data: CreateCardStatementImportUploadSessionRequest, context) => {
        try {
            const auth = await requireCardStatementAccess(context);
            const yearMonth = asString(data?.yearMonth);
            if (!isValidYearMonth(yearMonth)) {
                throw new functions.https.HttpsError('invalid-argument', '가져오기 월은 yyyy-MM 형식이어야 합니다.');
            }

            const files = Array.isArray(data?.files) ? data.files : [];
            if (files.length === 0) {
                throw new functions.https.HttpsError('invalid-argument', '가져올 PDF 파일이 필요합니다.');
            }
            if (files.length > MAX_IMPORT_FILES_PER_JOB) {
                throw new functions.https.HttpsError(
                    'failed-precondition',
                    `한 번에 최대 ${MAX_IMPORT_FILES_PER_JOB}개 파일까지 분석할 수 있습니다.`
                );
            }
            files.forEach(assertImportUploadFile);

            const db = admin.firestore();
            const jobRef = db.collection(COLLECTIONS.jobs).doc();
            const batch = db.batch();
            const now = safeTimestamp();
            const actorName = asString(auth.token.name || auth.token.email);
            const sessionFiles: Array<Record<string, unknown>> = [];
            const fileIds: string[] = [];

            batch.set(jobRef, stripUndefinedDeep({
                yearMonth,
                status: 'uploading',
                bankName: asString(data?.bankName) || 'KB국민카드',
                totalFiles: files.length,
                uploadedFiles: 0,
                analyzedFiles: 0,
                totalCards: 0,
                matchedCards: 0,
                needsReviewCards: 0,
                totalTransactions: 0,
                committedTransactions: 0,
                totalAmount: 0,
                matchedAmount: 0,
                unconfirmedAmount: 0,
                errorCount: 0,
                warningCount: 0,
                createdByUid: auth.uid,
                createdByName: actorName || undefined,
                createdAt: now,
                updatedAt: now,
            }) as Record<string, unknown>);

            files.forEach((inputFile, fileIndex) => {
                const fileRef = db.collection(COLLECTIONS.files).doc();
                const storagePath = buildImportUploadStoragePath({
                    yearMonth,
                    jobId: jobRef.id,
                    fileIndex,
                    originalFileName: inputFile.originalFileName,
                });
                const filePayload = stripUndefinedDeep({
                    jobId: jobRef.id,
                    yearMonth,
                    fileIndex,
                    storagePath,
                    originalFileName: asString(inputFile.originalFileName) || storagePath.split('/').pop() || 'statement.pdf',
                    mimeType: asString(inputFile.mimeType) || 'application/pdf',
                    size: asFiniteNumber(inputFile.size, 0),
                    sha256: normalizeCardStatementSourceSha256(inputFile.sha256) || undefined,
                    status: 'uploading',
                    cardCount: 0,
                    transactionCount: 0,
                    warnings: [],
                    createdAt: now,
                    updatedAt: now,
                }) as Record<string, unknown>;
                fileIds.push(fileRef.id);
                sessionFiles.push({ id: fileRef.id, ...filePayload });
                batch.set(fileRef, filePayload);
            });

            await batch.commit();
            return {
                ok: true,
                jobId: jobRef.id,
                fileIds,
                status: 'uploading',
                files: sessionFiles,
            };
        } catch (error) {
            throw toHttpsError(error);
        }
    });

export const completeCardStatementImportUpload = functions
    .runWith({ timeoutSeconds: 300, memory: '512MB', maxInstances: 10 })
    .region('asia-northeast3')
    .https.onCall(async (data: CompleteCardStatementImportUploadRequest, context) => {
        try {
            await requireCardStatementAccess(context);
            const jobId = asString(data?.jobId);
            if (!jobId) {
                throw new functions.https.HttpsError('invalid-argument', '가져오기 작업 ID가 필요합니다.');
            }
            const uploadedFiles = Array.isArray(data?.files) ? data.files : [];
            if (uploadedFiles.length === 0) {
                throw new functions.https.HttpsError('invalid-argument', '업로드 완료 파일 정보가 필요합니다.');
            }

            const db = admin.firestore();
            const jobRef = db.collection(COLLECTIONS.jobs).doc(jobId);
            const jobSnap = await jobRef.get();
            if (!jobSnap.exists) {
                throw new functions.https.HttpsError('not-found', '카드 청구서 가져오기 작업을 찾을 수 없습니다.');
            }
            const job = jobSnap.data() || {};
            const jobStatus = asString(job.status);
            if (!['uploading', 'queued'].includes(jobStatus)) {
                throw new functions.https.HttpsError(
                    'failed-precondition',
                    `업로드 완료 처리할 수 없는 작업 상태입니다: ${jobStatus || 'unknown'}`
                );
            }

            const filesSnap = await db.collection(COLLECTIONS.files).where('jobId', '==', jobId).get();
            const fileDocs = filesSnap.docs.sort((a, b) => Number(a.data().fileIndex ?? 0) - Number(b.data().fileIndex ?? 0));
            if (fileDocs.length === 0 || fileDocs.length !== uploadedFiles.length) {
                throw new functions.https.HttpsError('failed-precondition', '업로드 세션 파일 수와 완료 파일 수가 다릅니다.');
            }

            const uploadedByPath = new Map(uploadedFiles.map((file) => [asString(file.storagePath), file]));
            const batch = db.batch();
            for (const fileDoc of fileDocs) {
                const expected = fileDoc.data() || {};
                const storagePath = asString(expected.storagePath);
                validateStoragePath(storagePath);
                const uploaded = uploadedByPath.get(storagePath);
                if (!uploaded) {
                    throw new functions.https.HttpsError('failed-precondition', '업로드 완료 정보에 누락된 파일이 있습니다.');
                }
                const uploadedSha256 = requireCardStatementSourceSha256(
                    uploaded.sha256,
                    '업로드 완료 정보에 원본 SHA-256이 없습니다. PDF를 다시 선택해 업로드해 주세요.',
                );
                const sessionSha256 = normalizeCardStatementSourceSha256(expected.sha256);
                if (sessionSha256 && sessionSha256 !== uploadedSha256) {
                    throw new functions.https.HttpsError(
                        'failed-precondition',
                        '업로드 전후 원본 SHA-256이 다릅니다. PDF를 다시 선택해 업로드해 주세요.',
                    );
                }
                const serverFile = await downloadStorageFileAsBase64(
                    storagePath,
                    MAX_STORAGE_IMPORT_FILE_SIZE_BYTES,
                ).catch((error) => {
                    if (error instanceof functions.https.HttpsError) throw error;
                    throw new functions.https.HttpsError(
                        'failed-precondition',
                        `Storage에 업로드된 PDF를 확인할 수 없습니다: ${storagePath}`,
                        error,
                    );
                });
                assertDownloadedCardStatementSource(
                    serverFile,
                    uploadedSha256,
                    '업로드된 PDF 바이트와 원본 SHA-256이 일치하지 않습니다. PDF를 다시 업로드해 주세요.',
                );
                const mimeType = serverFile.mimeType;
                const size = serverFile.size;
                if (mimeType !== 'application/pdf') {
                    throw new functions.https.HttpsError('failed-precondition', '업로드된 파일이 PDF가 아닙니다.');
                }
                if (size <= 0 || size >= MAX_STORAGE_IMPORT_FILE_SIZE_BYTES) {
                    throw new functions.https.HttpsError('failed-precondition', '업로드된 PDF 크기가 허용 범위를 벗어났습니다.');
                }
                batch.set(fileDoc.ref, stripUndefinedDeep({
                    mimeType,
                    size,
                    sha256: serverFile.sha256,
                    sourceHashVerificationStatus: 'verified',
                    sourceHashVerifiedAt: safeTimestamp(),
                    status: 'uploaded',
                    updatedAt: safeTimestamp(),
                    errorMessage: admin.firestore.FieldValue.delete(),
                }) as Record<string, unknown>, { merge: true });
            }

            batch.set(jobRef, stripUndefinedDeep({
                status: 'queued',
                uploadedFiles: fileDocs.length,
                updatedAt: safeTimestamp(),
                errorMessage: admin.firestore.FieldValue.delete(),
            }) as Record<string, unknown>, { merge: true });
            await batch.commit();
            return {
                ok: true,
                jobId,
                fileIds: fileDocs.map((doc) => doc.id),
                status: 'queued',
            };
        } catch (error) {
            throw toHttpsError(error);
        }
    });

export const cancelCardStatementImportUploadSession = functions
    .runWith({ timeoutSeconds: 120, memory: '256MB', maxInstances: 10 })
    .region('asia-northeast3')
    .https.onCall(async (data: CancelCardStatementImportUploadSessionRequest, context) => {
        try {
            const auth = await requireCardStatementAccess(context) as NonNullable<functions.https.CallableContext['auth']>;
            const actor = resolveCallableActor(auth);
            const jobId = asString(data?.jobId);
            if (!jobId) {
                throw new functions.https.HttpsError('invalid-argument', '취소할 가져오기 작업 ID가 필요합니다.');
            }
            const reason = asString(data?.reason) || '업로드가 완료되지 않아 세션을 정리했습니다.';
            const db = admin.firestore();
            const jobRef = db.collection(COLLECTIONS.jobs).doc(jobId);
            const jobSnap = await jobRef.get();
            if (!jobSnap.exists) {
                return { ok: true, jobId, deletedStoragePaths: [], status: 'not_found' };
            }
            const job = jobSnap.data() || {};
            const jobStatus = asString(job.status);
            if (!['uploading', 'queued', 'failed'].includes(jobStatus)) {
                throw new functions.https.HttpsError(
                    'failed-precondition',
                    `이미 처리 중이거나 완료된 작업은 업로드 세션 정리 대상이 아닙니다: ${jobStatus || 'unknown'}`
                );
            }

            const filesSnap = await db.collection(COLLECTIONS.files).where('jobId', '==', jobId).get();
            const deletedStoragePaths: string[] = [];
            const deleteErrors: string[] = [];
            for (const fileDoc of filesSnap.docs) {
                const storagePath = asString(fileDoc.data().storagePath);
                if (!storagePath) continue;
                try {
                    await deleteStorageFileIfExists(storagePath);
                    deletedStoragePaths.push(storagePath);
                } catch (deleteError) {
                    deleteErrors.push(`${storagePath}: ${getErrorMessage(deleteError)}`);
                }
            }

            const batch = db.batch();
            filesSnap.docs.forEach((fileDoc) => {
                batch.set(fileDoc.ref, {
                    status: 'failed',
                    errorMessage: reason,
                    updatedAt: safeTimestamp(),
                }, { merge: true });
            });
            batch.set(jobRef, stripUndefinedDeep({
                status: 'failed',
                uploadedFiles: 0,
                errorMessage: deleteErrors.length > 0
                    ? `${reason} 일부 Storage 파일 삭제에 실패했습니다.`
                    : reason,
                updatedAt: safeTimestamp(),
            }) as Record<string, unknown>, { merge: true });
            const operationLogPayload = buildSupportWriteOperationPayload({
                yearMonth: asString(job.yearMonth),
                operationId: `card-statement-import:${jobId}:upload`,
                status: 'failed',
                actor,
                affectedDocumentIds: [jobId, ...filesSnap.docs.map((doc) => doc.id)],
                errorMessage: deleteErrors.join('\n') || reason,
                userMessage: '카드 청구 PDF 업로드 세션을 정리했습니다.',
                metadata: {
                    jobId,
                    reason,
                    deletedStoragePaths,
                    deleteErrors,
                },
            }, admin.firestore.Timestamp.now());
            batch.set(
                db.collection(COLLECTIONS.supportWriteOperations).doc(asString(operationLogPayload.id)),
                operationLogPayload,
                { merge: true }
            );
            await batch.commit();

            if (deleteErrors.length > 0) {
                throw new functions.https.HttpsError(
                    'internal',
                    '업로드 세션은 실패 처리했지만 일부 Storage 파일 삭제에 실패했습니다.'
                );
            }
            return {
                ok: true,
                jobId,
                deletedStoragePaths,
                status: 'failed',
            };
        } catch (error) {
            throw toHttpsError(error);
        }
    });

export const createCardStatementImportJob = functions
    .runWith({ timeoutSeconds: 300, memory: '512MB', maxInstances: 10 })
    .region('asia-northeast3')
    .https.onCall(async (data: CreateCardStatementImportJobRequest, context) => {
        try {
            const auth = await requireCardStatementAccess(context);
            const yearMonth = asString(data?.yearMonth);
            if (!isValidYearMonth(yearMonth)) {
                throw new functions.https.HttpsError('invalid-argument', '가져오기 월은 yyyy-MM 형식이어야 합니다.');
            }

            const files = Array.isArray(data?.files) ? data.files : [];
            if (files.length === 0) {
                throw new functions.https.HttpsError('invalid-argument', '가져올 PDF 파일이 필요합니다.');
            }
            if (files.length > MAX_IMPORT_FILES_PER_JOB) {
                throw new functions.https.HttpsError(
                    'failed-precondition',
                    `한 번에 최대 ${MAX_IMPORT_FILES_PER_JOB}개 파일까지 분석할 수 있습니다.`
                );
            }

            const verifiedFiles: CreateCardStatementImportFileInput[] = [];
            for (const inputFile of files) {
                const storagePath = asString(inputFile.storagePath);
                validateStoragePath(storagePath);
                const declaredSha256 = requireCardStatementSourceSha256(
                    inputFile.sha256,
                    '원본 SHA-256 정보가 없습니다. PDF를 다시 업로드해 주세요.',
                );
                const serverFile = await downloadStorageFileAsBase64(
                    storagePath,
                    MAX_STORAGE_IMPORT_FILE_SIZE_BYTES,
                );
                assertDownloadedCardStatementSource(
                    serverFile,
                    declaredSha256,
                    'Storage의 PDF 바이트와 원본 SHA-256이 일치하지 않습니다. PDF를 다시 업로드해 주세요.',
                );
                if (serverFile.mimeType !== 'application/pdf') {
                    throw new functions.https.HttpsError('failed-precondition', '업로드된 파일이 PDF가 아닙니다.');
                }
                if (serverFile.size <= 0 || serverFile.size >= MAX_STORAGE_IMPORT_FILE_SIZE_BYTES) {
                    throw new functions.https.HttpsError('failed-precondition', '업로드된 PDF 크기가 허용 범위를 벗어났습니다.');
                }
                verifiedFiles.push({
                    ...inputFile,
                    storagePath,
                    mimeType: serverFile.mimeType,
                    size: serverFile.size,
                    sha256: serverFile.sha256,
                });
            }

            const db = admin.firestore();
            const jobRef = db.collection(COLLECTIONS.jobs).doc();
            const batch = db.batch();
            const now = safeTimestamp();
            const actorName = asString(auth.token.name || auth.token.email);
            const fileIds: string[] = [];

            batch.set(jobRef, stripUndefinedDeep({
                yearMonth,
                status: 'queued',
                bankName: asString(data?.bankName) || 'KB국민은행',
                totalFiles: verifiedFiles.length,
                uploadedFiles: verifiedFiles.length,
                analyzedFiles: 0,
                totalCards: 0,
                matchedCards: 0,
                needsReviewCards: 0,
                totalTransactions: 0,
                committedTransactions: 0,
                totalAmount: 0,
                matchedAmount: 0,
                unconfirmedAmount: 0,
                errorCount: 0,
                warningCount: 0,
                createdByUid: auth.uid,
                createdByName: actorName || undefined,
                createdAt: now,
                updatedAt: now,
            }) as Record<string, unknown>);

            verifiedFiles.forEach((inputFile, fileIndex) => {
                const storagePath = asString(inputFile.storagePath);
                validateStoragePath(storagePath);
                const fileRef = db.collection(COLLECTIONS.files).doc();
                fileIds.push(fileRef.id);
                batch.set(fileRef, stripUndefinedDeep({
                    jobId: jobRef.id,
                    yearMonth,
                    fileIndex,
                    storagePath,
                    originalFileName: asString(inputFile.originalFileName) || storagePath.split('/').pop() || 'statement.pdf',
                    mimeType: asString(inputFile.mimeType) || 'application/pdf',
                    size: asFiniteNumber(inputFile.size, 0),
                    sha256: inputFile.sha256,
                    sourceHashVerificationStatus: 'verified',
                    sourceHashVerifiedAt: now,
                    status: 'uploaded',
                    cardCount: 0,
                    transactionCount: 0,
                    warnings: [],
                    createdAt: now,
                    updatedAt: now,
                }) as Record<string, unknown>);
            });

            await batch.commit();
            return {
                ok: true,
                jobId: jobRef.id,
                fileIds,
                status: 'queued',
            };
        } catch (error) {
            throw toHttpsError(error);
        }
    });

const legacyAnalyzeCardStatementImportJob = functions
    .runWith({ timeoutSeconds: 540, memory: '1GB', maxInstances: 3 })
    .region('asia-northeast3')
    .https.onCall(async (data: AnalyzeCardStatementImportJobRequest, context) => {
        try {
            await requireCardStatementAccess(context);
            const jobId = asString(data?.jobId);
            if (!jobId) {
                throw new functions.https.HttpsError('invalid-argument', '분석할 가져오기 작업 ID가 필요합니다.');
            }

            const db = admin.firestore();
            const jobRef = db.collection(COLLECTIONS.jobs).doc(jobId);
            const jobSnap = await jobRef.get();
            if (!jobSnap.exists) {
                throw new functions.https.HttpsError('not-found', '카드 청구서 가져오기 작업을 찾을 수 없습니다.');
            }

            const job = jobSnap.data() || {};
            const yearMonth = asString(job.yearMonth);
            const jobStatus = asString(job.status);
            if (jobStatus === 'uploading') {
                throw new functions.https.HttpsError('failed-precondition', 'PDF 업로드가 완료되지 않은 작업은 분석할 수 없습니다.');
            }
            const filesSnap = await db.collection(COLLECTIONS.files).where('jobId', '==', jobId).get();
            const fileDocs = filesSnap.docs
                .map((doc) => ({ ref: doc.ref, id: doc.id, data: doc.data() }))
                .sort((a, b) => Number(a.data.fileIndex ?? 0) - Number(b.data.fileIndex ?? 0));

            if (fileDocs.length === 0) {
                throw new functions.https.HttpsError('failed-precondition', '분석할 파일이 없습니다.');
            }
            if (fileDocs.some((fileDoc) => asString(fileDoc.data.status) === 'uploading')) {
                throw new functions.https.HttpsError('failed-precondition', '아직 업로드가 완료되지 않은 PDF가 있습니다.');
            }

            await deleteResultsForJob(jobId);
            await jobRef.set({
                status: 'analyzing',
                analyzedFiles: 0,
                errorCount: 0,
                warningCount: 0,
                updatedAt: safeTimestamp(),
                errorMessage: admin.firestore.FieldValue.delete(),
            }, { merge: true });

            const cards = await loadCardsForMatching();
            const resultSummaries: Array<{
                status: 'matched' | 'needs_review' | 'failed';
                subtotalAmount: number;
                transactionCount: number;
                warningCount: number;
            }> = [];
            let analyzedFiles = 0;
            let failedFiles = 0;
            let resultIndex = 0;

            for (const fileDoc of fileDocs) {
                const fileData = fileDoc.data;
                const storagePath = asString(fileData.storagePath);
                try {
                    validateStoragePath(storagePath);
                    await fileDoc.ref.set({
                        status: 'analyzing',
                        updatedAt: safeTimestamp(),
                        errorMessage: admin.firestore.FieldValue.delete(),
                    }, { merge: true });

                    const file = await downloadStorageFileAsBase64(storagePath);
                    const verifiedSourceSha256 = await verifyDownloadedCardStatementForAnalysis(
                        fileDoc.ref,
                        fileData,
                        file,
                    );
                    const analysis = await analyzeCardStatementImportFile({
                        statementPath: storagePath,
                        yearMonth,
                        cardLabel: asString(fileData.originalFileName) || undefined,
                    }, file);
                    const parsed = analysis.parsed;
                    const statementCards = buildSyntheticCardWhenNeeded(parsed);
                    const fileWarnings = Array.from(new Set(parsed.warnings.map(asString).filter(Boolean)));
                    const fileTransactionCount = statementCards.reduce((sum, card) => sum + card.transactions.length, 0);
                    const fileTotalAmount = parsed.grandTotalAmount || statementCards.reduce((sum, card) => sum + card.subtotalAmount, 0);

                    await fileDoc.ref.set({
                        status: 'completed',
                        statementMonth: parsed.statementMonth || '',
                        grandTotalAmount: fileTotalAmount,
                        cardCount: statementCards.length,
                        transactionCount: fileTransactionCount,
                        warnings: fileWarnings,
                        analysisSource: analysis.source,
                        sha256: verifiedSourceSha256,
                        sourceHashVerificationStatus: 'verified',
                        sourceHashVerifiedAt: safeTimestamp(),
                        mimeType: file.mimeType,
                        size: file.size,
                        updatedAt: safeTimestamp(),
                    }, { merge: true });

                    let sourceBlockIndex = 0;
                    for (const statementCard of statementCards) {
                        const match = matchStatementCard(statementCard, cards);
                    const warnings = Array.from(new Set([
                        ...addComputedWarnings(parsed, statementCard, yearMonth),
                        ...match.warnings,
                    ].map(asString).filter(Boolean)));
                    const blockingReviewReason = getBlockingAnalysisReviewReason(warnings);
                    const status = match.matchedCardId && !blockingReviewReason ? 'matched' : 'needs_review';
                        const resultId = `${sanitizeIdPart(fileDoc.id)}_${String(resultIndex).padStart(3, '0')}`;
                        const transactions = statementCard.transactions.map((transaction, transactionIndex) => ({
                            id: `tx_${String(transactionIndex).padStart(4, '0')}`,
                            date: transaction.date,
                            merchant: transaction.merchant,
                            amount: transaction.amount,
                            category: transaction.category,
                            memo: transaction.memo || '',
                            confidence: transaction.confidence,
                        }));

                        await db.collection(COLLECTIONS.results).doc(resultId).set({
                            jobId,
                            fileId: fileDoc.id,
                            fileIndex: Number(fileData.fileIndex ?? 0),
                            resultIndex,
                            sourceBlockIndex,
                            yearMonth,
                            statementMonth: parsed.statementMonth || '',
                            cardLast4: statementCard.cardLast4 || '',
                            cardName: statementCard.cardName || '',
                            holderName: statementCard.holderName || '',
                            matchedCardId: match.matchedCardId || null,
                            matchedCardLabel: match.matchedCardLabel || null,
                            matchConfidence: match.matchConfidence,
                        matchCandidates: match.matchCandidates,
                        status,
                        analysisReviewRequired: Boolean(blockingReviewReason),
                        analysisReviewReason: blockingReviewReason || '',
                        subtotalAmount: statementCard.subtotalAmount,
                            transactionCount: transactions.length,
                            transactions,
                            warnings,
                            analysisSource: analysis.source,
                            sourceStoragePath: storagePath,
                            sourceSha256: verifiedSourceSha256,
                            originalFileName: asString(fileData.originalFileName),
                            createdAt: safeTimestamp(),
                            updatedAt: safeTimestamp(),
                        });

                        resultSummaries.push({
                            status,
                            subtotalAmount: statementCard.subtotalAmount,
                            transactionCount: transactions.length,
                            warningCount: warnings.length,
                        });
                        resultIndex += 1;
                        sourceBlockIndex += 1;
                    }

                    analyzedFiles += 1;
                } catch (fileError) {
                    failedFiles += 1;
                    const message = getErrorMessage(fileError);
                    functions.logger.error('Card statement import file analysis failed', {
                        jobId,
                        fileId: fileDoc.id,
                        storagePath,
                        message,
                    });
                    await fileDoc.ref.set({
                        status: 'failed',
                        errorMessage: message,
                        updatedAt: safeTimestamp(),
                    }, { merge: true });
                }
            }

            const matchedCards = resultSummaries.filter((result) => result.status === 'matched').length;
            const needsReviewCards = resultSummaries.filter((result) => result.status !== 'matched').length;
            const totalAmount = resultSummaries.reduce((sum, result) => sum + result.subtotalAmount, 0);
            const matchedAmount = resultSummaries
                .filter((result) => result.status === 'matched')
                .reduce((sum, result) => sum + result.subtotalAmount, 0);
            const warningCount = resultSummaries.reduce((sum, result) => sum + result.warningCount, 0);
            const finalStatus = resultSummaries.length > 0 ? 'reviewing' : 'failed';

            await jobRef.set({
                status: finalStatus,
                analyzedFiles,
                totalCards: resultSummaries.length,
                matchedCards,
                needsReviewCards,
                totalTransactions: resultSummaries.reduce((sum, result) => sum + result.transactionCount, 0),
                committedTransactions: 0,
                totalAmount,
                matchedAmount,
                unconfirmedAmount: totalAmount - matchedAmount,
                errorCount: failedFiles,
                warningCount,
                updatedAt: safeTimestamp(),
                ...(finalStatus === 'failed' ? { errorMessage: '분석 가능한 결과가 없습니다.' } : {}),
            }, { merge: true });

            return getJobStatusPayload(jobId);
        } catch (error) {
            throw toHttpsError(error);
        }
    });

type CardStatementImportAnalysisSummary = {
    status: 'matched' | 'needs_review';
    subtotalAmount: number;
    transactionCount: number;
    warningCount: number;
};

const buildAnalysisRunId = (): string =>
    `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

const getAnalysisSummaryPatch = (
    resultSummaries: CardStatementImportAnalysisSummary[],
    processedFiles: number,
    failedFiles: number
): Record<string, unknown> => {
    const matchedCards = resultSummaries.filter((result) => result.status === 'matched').length;
    const totalAmount = resultSummaries.reduce((sum, result) => sum + result.subtotalAmount, 0);
    const matchedAmount = resultSummaries
        .filter((result) => result.status === 'matched')
        .reduce((sum, result) => sum + result.subtotalAmount, 0);

    return {
        analyzedFiles: processedFiles,
        totalCards: resultSummaries.length,
        matchedCards,
        needsReviewCards: resultSummaries.length - matchedCards,
        totalTransactions: resultSummaries.reduce((sum, result) => sum + result.transactionCount, 0),
        committedTransactions: 0,
        totalAmount,
        matchedAmount,
        unconfirmedAmount: totalAmount - matchedAmount,
        errorCount: failedFiles,
        warningCount: resultSummaries.reduce((sum, result) => sum + result.warningCount, 0),
        updatedAt: safeTimestamp(),
    };
};

const getSortedImportFileDocs = async (jobId: string) => {
    const filesSnap = await admin.firestore().collection(COLLECTIONS.files).where('jobId', '==', jobId).get();
    return filesSnap.docs
        .map((doc) => ({ ref: doc.ref, id: doc.id, data: doc.data() }))
        .sort((a, b) => Number(a.data.fileIndex ?? 0) - Number(b.data.fileIndex ?? 0));
};

interface VerifiedCardStatementSourceFile {
    id: string;
    ref: FirebaseFirestore.DocumentReference;
    data: Record<string, unknown>;
    fileIndex: number;
    sourceSha256: string;
    storagePath: string;
}

interface CardStatementSourceClaimOwner {
    sourceSha256: string;
    ownerJobId: string;
    ownerFileId: string;
    state: string;
    committedTransactionIds: string[];
    legacy: boolean;
}

interface CardStatementSourceClaimResolution {
    ownedFileBySha256: Map<string, string>;
    ownerBySha256: Map<string, CardStatementSourceClaimOwner>;
}

const verifyCardStatementImportSourcesBeforeCommit = async (
    fileDocs: Array<{ ref: FirebaseFirestore.DocumentReference; id: string; data: Record<string, unknown> }>,
): Promise<VerifiedCardStatementSourceFile[]> => {
    const verified: VerifiedCardStatementSourceFile[] = [];
    for (const fileDoc of fileDocs) {
        const storagePath = asString(fileDoc.data.storagePath);
        validateStoragePath(storagePath);
        const expectedSha256 = requireCardStatementSourceSha256(
            fileDoc.data.sha256,
            '가져오기 파일의 원본 SHA-256이 없습니다. 이 작업을 재분석한 뒤 다시 저장해 주세요.',
        );
        const file = await downloadStorageFileAsBase64(storagePath);
        assertDownloadedCardStatementSource(
            file,
            expectedSha256,
            '분석 이후 PDF 원본이 변경되었습니다. 파일을 다시 업로드하고 재분석해 주세요.',
        );
        verified.push({
            id: fileDoc.id,
            ref: fileDoc.ref,
            data: fileDoc.data,
            fileIndex: Math.max(0, Math.round(asFiniteNumber(fileDoc.data.fileIndex, 0))),
            sourceSha256: expectedSha256,
            storagePath,
        });
    }
    return verified;
};

const parseImportJobIdFromOperation = (value: unknown): string => {
    const match = /^card-statement-import:([^:]+)(?::|$)/.exec(asString(value));
    return match?.[1] || '';
};

const findLegacyCardStatementSourceOwner = async (
    db: FirebaseFirestore.Firestore,
    sourceSha256: string,
    currentJobId: string,
): Promise<CardStatementSourceClaimOwner | null> => {
    const transactionSnap = await db.collection(COLLECTIONS.transactions)
        .where('statementSourceSha256', '==', sourceSha256)
        .limit(10)
        .get();
    for (const transactionDoc of transactionSnap.docs) {
        const data = transactionDoc.data() || {};
        const ownerJobId = parseImportJobIdFromOperation(data.operationId || data.lastOperationId);
        if (ownerJobId === currentJobId) continue;
        return {
            sourceSha256,
            ownerJobId: ownerJobId || `legacy-transaction-${transactionDoc.id}`,
            ownerFileId: '',
            state: 'committed',
            committedTransactionIds: [transactionDoc.id],
            legacy: true,
        };
    }

    const hashVariants = Array.from(new Set([sourceSha256, sourceSha256.toUpperCase()]));
    const filesQuery = hashVariants.length === 1
        ? db.collection(COLLECTIONS.files).where('sha256', '==', hashVariants[0])
        : db.collection(COLLECTIONS.files).where('sha256', 'in', hashVariants);
    const legacyFilesSnap = await filesQuery.limit(20).get();
    const legacyFiles = legacyFilesSnap.docs
        .filter((fileDoc) => asString(fileDoc.data().jobId) !== currentJobId)
        .sort((left, right) => left.id.localeCompare(right.id));

    for (const fileDoc of legacyFiles) {
        const resultSnap = await db.collection(COLLECTIONS.results)
            .where('fileId', '==', fileDoc.id)
            .get();
        const committedResults = resultSnap.docs.filter((resultDoc) => (
            asString(resultDoc.data().status) === 'committed'
        ));
        if (committedResults.length === 0) continue;
        return {
            sourceSha256,
            ownerJobId: asString(fileDoc.data().jobId) || `legacy-file-${fileDoc.id}`,
            ownerFileId: fileDoc.id,
            state: 'committed',
            committedTransactionIds: uniqueStrings(committedResults.flatMap((resultDoc) => (
                asStringList(resultDoc.data().committedTransactionIds)
            ))),
            legacy: true,
        };
    }

    for (const fileDoc of legacyFiles) {
        const legacyJobId = asString(fileDoc.data().jobId);
        const storagePath = asString(fileDoc.data().storagePath);
        if (!legacyJobId || !storagePath) continue;
        const legacyTransactionsSnap = await db.collection(COLLECTIONS.transactions)
            .where('operationId', '==', `card-statement-import:${legacyJobId}`)
            .get();
        const sourceTransactions = legacyTransactionsSnap.docs.filter((transactionDoc) => {
            const data = transactionDoc.data() || {};
            return asString(data.evidenceUrl) === storagePath ||
                asStringList(data.statementAttachmentPaths).includes(storagePath);
        });
        if (sourceTransactions.length === 0) continue;
        return {
            sourceSha256,
            ownerJobId: legacyJobId,
            ownerFileId: fileDoc.id,
            state: 'committed',
            committedTransactionIds: sourceTransactions.map((transactionDoc) => transactionDoc.id),
            legacy: true,
        };
    }
    return null;
};

const claimCardStatementImportSources = async (params: {
    db: FirebaseFirestore.Firestore;
    jobId: string;
    yearMonth: string;
    files: VerifiedCardStatementSourceFile[];
    actor: { uid: string; name: string; email: string | null };
}): Promise<CardStatementSourceClaimResolution> => {
    const { db, jobId, yearMonth, actor } = params;
    const canonicalFiles = Array.from(params.files.reduce((bySha256, file) => {
        const existing = bySha256.get(file.sourceSha256);
        if (!existing || file.fileIndex < existing.fileIndex || (
            file.fileIndex === existing.fileIndex && file.id.localeCompare(existing.id) < 0
        )) {
            bySha256.set(file.sourceSha256, file);
        }
        return bySha256;
    }, new Map<string, VerifiedCardStatementSourceFile>()).values())
        .sort((left, right) => left.sourceSha256.localeCompare(right.sourceSha256));

    const legacyOwners = new Map<string, CardStatementSourceClaimOwner | null>();
    for (const file of canonicalFiles) {
        legacyOwners.set(
            file.sourceSha256,
            await findLegacyCardStatementSourceOwner(db, file.sourceSha256, jobId),
        );
    }

    const owners = await db.runTransaction(async (transaction) => {
        const entries = canonicalFiles.map((file) => ({
            file,
            ref: db.collection(COLLECTIONS.sourceClaims).doc(
                buildCardStatementSourceClaimDocumentId(file.sourceSha256),
            ),
        }));
        const snapshots: FirebaseFirestore.DocumentSnapshot[] = [];
        for (const entry of entries) snapshots.push(await transaction.get(entry.ref));

        return entries.map((entry, index): CardStatementSourceClaimOwner => {
            const snapshot = snapshots[index];
            const existing = snapshot.data() || {};
            if (snapshot.exists) {
                const existingOwnerJobId = asString(existing.ownerJobId);
                const existingOwnerFileId = asString(existing.ownerFileId);
                const owner: CardStatementSourceClaimOwner = {
                    sourceSha256: entry.file.sourceSha256,
                    ownerJobId: existingOwnerJobId || 'unknown-existing-claim',
                    ownerFileId: existingOwnerFileId,
                    state: asString(existing.state) || 'claimed',
                    committedTransactionIds: asStringList(existing.committedTransactionIds),
                    legacy: Boolean(existing.legacy),
                };
                if (owner.ownerJobId === jobId) {
                    owner.ownerFileId = params.files.some((file) => file.id === owner.ownerFileId)
                        ? owner.ownerFileId
                        : entry.file.id;
                    transaction.set(entry.ref, {
                        ownerFileId: owner.ownerFileId,
                        lastSeenAt: safeTimestamp(),
                        updatedAt: safeTimestamp(),
                    }, { merge: true });
                }
                return owner;
            }

            const legacyOwner = legacyOwners.get(entry.file.sourceSha256);
            const owner: CardStatementSourceClaimOwner = legacyOwner || {
                sourceSha256: entry.file.sourceSha256,
                ownerJobId: jobId,
                ownerFileId: entry.file.id,
                state: 'claimed',
                committedTransactionIds: [],
                legacy: false,
            };
            transaction.set(entry.ref, stripUndefinedDeep({
                id: entry.ref.id,
                sourceSha256: entry.file.sourceSha256,
                ownerJobId: owner.ownerJobId,
                ownerFileId: owner.ownerFileId || undefined,
                ownerYearMonth: yearMonth,
                ownerStoragePath: entry.file.storagePath,
                ownerOriginalFileName: asString(entry.file.data.originalFileName) || undefined,
                ownerActorUid: actor.uid,
                ownerActorName: actor.name,
                state: owner.state,
                committedTransactionIds: owner.committedTransactionIds,
                legacy: owner.legacy,
                claimedAt: safeTimestamp(),
                updatedAt: safeTimestamp(),
            }) as Record<string, unknown>);
            return owner;
        });
    });

    const ownerBySha256 = new Map(owners.map((owner) => [owner.sourceSha256, owner]));
    const ownedFileBySha256 = new Map(
        owners
            .filter((owner) => owner.ownerJobId === jobId)
            .map((owner) => [owner.sourceSha256, owner.ownerFileId]),
    );
    return { ownerBySha256, ownedFileBySha256 };
};

const validateResultSourceHashes = (
    results: Array<{ id: string; data: Record<string, unknown> }>,
    files: VerifiedCardStatementSourceFile[],
): void => {
    const fileById = new Map(files.map((file) => [file.id, file]));
    results.forEach(({ data }) => {
        if (asString(data.status) === 'excluded') return;
        const file = fileById.get(asString(data.fileId));
        const resultSha256 = normalizeCardStatementSourceSha256(data.sourceSha256);
        if (!file || !resultSha256 || resultSha256 !== file.sourceSha256) {
            throw new functions.https.HttpsError(
                'failed-precondition',
                '분석 결과의 원본 SHA-256을 확인할 수 없습니다. 작업을 재분석한 뒤 다시 저장해 주세요.',
            );
        }
    });
};

const excludeDuplicateSourceResults = async (params: {
    db: FirebaseFirestore.Firestore;
    jobId: string;
    results: Array<{ id: string; ref: FirebaseFirestore.DocumentReference; data: Record<string, unknown> }>;
    claims: CardStatementSourceClaimResolution;
}): Promise<number> => {
    let batch = params.db.batch();
    let writes = 0;
    let excluded = 0;
    for (const result of params.results) {
        if (['committed', 'excluded'].includes(asString(result.data.status))) continue;
        const sourceSha256 = normalizeCardStatementSourceSha256(result.data.sourceSha256);
        const owner = params.claims.ownerBySha256.get(sourceSha256);
        const ownedFileId = params.claims.ownedFileBySha256.get(sourceSha256);
        if (owner?.ownerJobId === params.jobId && ownedFileId === asString(result.data.fileId)) continue;

        batch.set(result.ref, stripUndefinedDeep({
            status: 'excluded',
            exclusionReason: '같은 원본 PDF가 이미 저장되어 중복 반영을 건너뛰었습니다.',
            duplicateSourceSha256: sourceSha256,
            duplicateSourceOwnerJobId: owner?.ownerJobId || undefined,
            duplicateSourceOwnerFileId: owner?.ownerFileId || undefined,
            analysisReviewRequired: false,
            updatedAt: safeTimestamp(),
            errorMessage: admin.firestore.FieldValue.delete(),
        }) as Record<string, unknown>, { merge: true });
        result.data.status = 'excluded';
        excluded += 1;
        writes += 1;
        if (writes === 400) {
            await batch.commit();
            batch = params.db.batch();
            writes = 0;
        }
    }
    if (writes > 0) await batch.commit();
    return excluded;
};

const startCardStatementImportAnalysis = async (jobId: string): Promise<Record<string, unknown>> => {
    const db = admin.firestore();
    const jobRef = db.collection(COLLECTIONS.jobs).doc(jobId);
    const jobSnap = await jobRef.get();
    if (!jobSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Card statement import job was not found.');
    }

    const job = jobSnap.data() || {};
    const jobStatus = asString(job.status);
    if (jobStatus === 'uploading') {
        throw new functions.https.HttpsError('failed-precondition', 'PDF upload is not complete.');
    }
    if (jobStatus === 'analyzing') {
        return getJobStatusPayload(jobId);
    }
    if (jobStatus === 'committing') {
        throw new functions.https.HttpsError('failed-precondition', 'This job is currently committing.');
    }
    if (jobStatus === 'completed') {
        throw new functions.https.HttpsError('failed-precondition', 'Completed jobs cannot be analyzed again.');
    }

    const fileDocs = await getSortedImportFileDocs(jobId);
    if (fileDocs.length === 0) {
        throw new functions.https.HttpsError('failed-precondition', 'No PDF files are available for analysis.');
    }
    if (fileDocs.some((fileDoc) => asString(fileDoc.data.status) === 'uploading')) {
        throw new functions.https.HttpsError('failed-precondition', 'At least one PDF file is still uploading.');
    }

    await deleteResultsForJob(jobId);

    const analysisRunId = buildAnalysisRunId();
    const batch = db.batch();
    batch.set(jobRef, {
        status: 'analyzing',
        analysisRunId,
        analysisRequestedAt: safeTimestamp(),
        totalFiles: fileDocs.length,
        uploadedFiles: fileDocs.length,
        analyzedFiles: 0,
        totalCards: 0,
        matchedCards: 0,
        needsReviewCards: 0,
        totalTransactions: 0,
        committedTransactions: 0,
        totalAmount: 0,
        matchedAmount: 0,
        unconfirmedAmount: 0,
        errorCount: 0,
        warningCount: 0,
        completedAt: admin.firestore.FieldValue.delete(),
        errorMessage: admin.firestore.FieldValue.delete(),
        updatedAt: safeTimestamp(),
    }, { merge: true });

    for (const fileDoc of fileDocs) {
        batch.set(fileDoc.ref, {
            status: 'uploaded',
            statementMonth: admin.firestore.FieldValue.delete(),
            grandTotalAmount: admin.firestore.FieldValue.delete(),
            cardCount: 0,
            transactionCount: 0,
            warnings: [],
            errorMessage: admin.firestore.FieldValue.delete(),
            updatedAt: safeTimestamp(),
        }, { merge: true });
    }

    await batch.commit();
    return getJobStatusPayload(jobId);
};

const isCurrentAnalysisRun = async (jobId: string, analysisRunId: string): Promise<boolean> => {
    const jobSnap = await admin.firestore().collection(COLLECTIONS.jobs).doc(jobId).get();
    const job = jobSnap.data() || {};
    return jobSnap.exists &&
        asString(job.status) === 'analyzing' &&
        asString(job.analysisRunId) === analysisRunId;
};

const runCardStatementImportJobAnalysis = async (jobId: string, expectedRunId?: string): Promise<void> => {
    const db = admin.firestore();
    const jobRef = db.collection(COLLECTIONS.jobs).doc(jobId);
    const jobSnap = await jobRef.get();
    if (!jobSnap.exists) return;

    const job = jobSnap.data() || {};
    const yearMonth = asString(job.yearMonth);
    const analysisRunId = expectedRunId || asString(job.analysisRunId);
    if (asString(job.status) !== 'analyzing' || !analysisRunId || asString(job.analysisRunId) !== analysisRunId) {
        return;
    }

    const resultSummaries: CardStatementImportAnalysisSummary[] = [];
    let processedFiles = 0;
    let failedFiles = 0;
    let resultIndex = 0;
    const fileErrorMessages: string[] = [];

    try {
        const cards = await loadCardsForMatching();
        const fileDocs = await getSortedImportFileDocs(jobId);
        if (fileDocs.length === 0) {
            await jobRef.set({
                status: 'failed',
                errorMessage: 'No PDF files are available for analysis.',
                updatedAt: safeTimestamp(),
            }, { merge: true });
            return;
        }

        for (const fileDoc of fileDocs) {
            if (!(await isCurrentAnalysisRun(jobId, analysisRunId))) return;

            const fileData = fileDoc.data;
            const storagePath = asString(fileData.storagePath);
            const fileAnalysisStartedAt = Date.now();
            try {
                validateStoragePath(storagePath);
                await fileDoc.ref.set({
                    status: 'analyzing',
                    updatedAt: safeTimestamp(),
                    errorMessage: admin.firestore.FieldValue.delete(),
                }, { merge: true });

                const file = await downloadStorageFileAsBase64(storagePath);
                const verifiedSourceSha256 = await verifyDownloadedCardStatementForAnalysis(
                    fileDoc.ref,
                    fileData,
                    file,
                );
                const analysis = await analyzeCardStatementImportFile({
                    statementPath: storagePath,
                    yearMonth,
                    cardLabel: asString(fileData.originalFileName) || undefined,
                }, file);
                const parsed = analysis.parsed;
                const statementCards = buildSyntheticCardWhenNeeded(parsed);
                const fileWarnings = Array.from(new Set(parsed.warnings.map(asString).filter(Boolean)));
                const fileTransactionCount = statementCards.reduce((sum, card) => sum + card.transactions.length, 0);
                const fileTotalAmount = parsed.grandTotalAmount ||
                    statementCards.reduce((sum, card) => sum + card.subtotalAmount, 0);

                await fileDoc.ref.set({
                    status: 'completed',
                    statementMonth: parsed.statementMonth || '',
                    grandTotalAmount: fileTotalAmount,
                    cardCount: statementCards.length,
                    transactionCount: fileTransactionCount,
                    warnings: fileWarnings,
                    analysisSource: analysis.source,
                    sha256: verifiedSourceSha256,
                    sourceHashVerificationStatus: 'verified',
                    sourceHashVerifiedAt: safeTimestamp(),
                    mimeType: file.mimeType,
                    size: file.size,
                    updatedAt: safeTimestamp(),
                }, { merge: true });

                functions.logger.info('Card statement import file analysis completed', {
                    jobId,
                    fileId: fileDoc.id,
                    originalFileName: asString(fileData.originalFileName),
                    analysisRunId,
                    analysisSource: analysis.source,
                    elapsedMs: Date.now() - fileAnalysisStartedAt,
                    cardCount: statementCards.length,
                    transactionCount: fileTransactionCount,
                    totalAmount: fileTotalAmount,
                });

                let sourceBlockIndex = 0;
                for (const statementCard of statementCards) {
                    const match = matchStatementCard(statementCard, cards);
                    const warnings = Array.from(new Set([
                        ...addComputedWarnings(parsed, statementCard, yearMonth),
                        ...match.warnings,
                    ].map(asString).filter(Boolean)));
                    const blockingReviewReason = getBlockingAnalysisReviewReason(warnings);
                    const status = match.matchedCardId && !blockingReviewReason ? 'matched' : 'needs_review';
                    const resultId = `${sanitizeIdPart(fileDoc.id)}_${String(resultIndex).padStart(3, '0')}`;
                    const transactions = statementCard.transactions.map((transaction, transactionIndex) => ({
                        id: `tx_${String(transactionIndex).padStart(4, '0')}`,
                        date: transaction.date,
                        merchant: transaction.merchant,
                        amount: transaction.amount,
                        category: transaction.category,
                        memo: transaction.memo || '',
                        confidence: transaction.confidence,
                    }));

                    await db.collection(COLLECTIONS.results).doc(resultId).set({
                        jobId,
                        fileId: fileDoc.id,
                        fileIndex: Number(fileData.fileIndex ?? 0),
                        resultIndex,
                        sourceBlockIndex,
                        analysisRunId,
                        yearMonth,
                        statementMonth: parsed.statementMonth || '',
                        cardLast4: statementCard.cardLast4 || '',
                        cardName: statementCard.cardName || '',
                        holderName: statementCard.holderName || '',
                        matchedCardId: match.matchedCardId || null,
                        matchedCardLabel: match.matchedCardLabel || null,
                        matchConfidence: match.matchConfidence,
                        matchCandidates: match.matchCandidates,
                        status,
                        analysisReviewRequired: Boolean(blockingReviewReason),
                        analysisReviewReason: blockingReviewReason || '',
                        subtotalAmount: statementCard.subtotalAmount,
                        transactionCount: transactions.length,
                        transactions,
                        warnings,
                        analysisSource: analysis.source,
                        sourceStoragePath: storagePath,
                        sourceSha256: verifiedSourceSha256,
                        originalFileName: asString(fileData.originalFileName),
                        createdAt: safeTimestamp(),
                        updatedAt: safeTimestamp(),
                    });

                    resultSummaries.push({
                        status,
                        subtotalAmount: statementCard.subtotalAmount,
                        transactionCount: transactions.length,
                        warningCount: warnings.length,
                    });
                    resultIndex += 1;
                    sourceBlockIndex += 1;
                }
            } catch (fileError) {
                failedFiles += 1;
                const message = getErrorMessage(fileError);
                fileErrorMessages.push(`${asString(fileData.originalFileName) || fileDoc.id}: ${message}`);
                functions.logger.error('Card statement import file analysis failed', {
                    jobId,
                    fileId: fileDoc.id,
                    storagePath,
                    analysisRunId,
                    message,
                });
                await fileDoc.ref.set({
                    status: 'failed',
                    errorMessage: message,
                    updatedAt: safeTimestamp(),
                }, { merge: true });
            } finally {
                processedFiles += 1;
                await jobRef.set(
                    getAnalysisSummaryPatch(resultSummaries, processedFiles, failedFiles),
                    { merge: true }
                );
            }
        }

        if (!(await isCurrentAnalysisRun(jobId, analysisRunId))) return;

        const finalStatus = resultSummaries.length > 0 ? 'reviewing' : 'failed';
        const finalErrorMessage = Array.from(new Set(fileErrorMessages))
            .slice(0, 5)
            .join('\n') || 'Analysis completed, but no usable statement results were created.';
        await jobRef.set({
            ...getAnalysisSummaryPatch(resultSummaries, processedFiles, failedFiles),
            status: finalStatus,
            updatedAt: safeTimestamp(),
            ...(finalStatus === 'failed'
                ? { errorMessage: finalErrorMessage }
                : { errorMessage: admin.firestore.FieldValue.delete() }),
        }, { merge: true });
    } catch (error) {
        const message = getErrorMessage(error);
        functions.logger.error('Card statement import job analysis failed', {
            jobId,
            analysisRunId,
            message,
        });
        if (await isCurrentAnalysisRun(jobId, analysisRunId)) {
            await jobRef.set({
                status: 'failed',
                errorMessage: message,
                updatedAt: safeTimestamp(),
            }, { merge: true });
        }
    }
};

const recoverCardStatementImportJobAnalysisNow = async (jobId: string): Promise<Record<string, unknown>> => {
    const db = admin.firestore();
    const jobRef = db.collection(COLLECTIONS.jobs).doc(jobId);
    const jobSnap = await jobRef.get();
    if (!jobSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Card statement import job was not found.');
    }

    const job = jobSnap.data() || {};
    const jobStatus = asString(job.status);
    if (jobStatus === 'uploading') {
        throw new functions.https.HttpsError('failed-precondition', 'PDF upload is not complete.');
    }

    if (jobStatus !== 'analyzing') {
        return getJobStatusPayload(jobId);
    }

    const analysisRunId = asString(job.analysisRunId);
    if (!analysisRunId) {
        throw new functions.https.HttpsError('failed-precondition', 'Analysis run id is missing.');
    }

    await runCardStatementImportJobAnalysis(jobId, analysisRunId);
    return getJobStatusPayload(jobId);
};

export const analyzeCardStatementImportJob = functions
    .runWith({ timeoutSeconds: 60, memory: '256MB', maxInstances: 10 })
    .region('asia-northeast3')
    .https.onCall(async (data: AnalyzeCardStatementImportJobRequest, context) => {
        try {
            await requireCardStatementAccess(context);
            const jobId = asString(data?.jobId);
            if (!jobId) {
                throw new functions.https.HttpsError('invalid-argument', 'Card statement import job id is required.');
            }
            return await startCardStatementImportAnalysis(jobId);
        } catch (error) {
            throw toHttpsError(error);
        }
    });

export const recoverCardStatementImportJobAnalysis = functions
    .runWith({ timeoutSeconds: 540, memory: '1GB', maxInstances: 2 })
    .region('asia-northeast3')
    .https.onCall(async (data: RecoverCardStatementImportJobAnalysisRequest, context) => {
        try {
            await requireCardStatementAccess(context);
            const jobId = asString(data?.jobId);
            if (!jobId) {
                throw new functions.https.HttpsError('invalid-argument', 'Card statement import job id is required.');
            }
            return await recoverCardStatementImportJobAnalysisNow(jobId);
        } catch (error) {
            throw toHttpsError(error);
        }
    });

export const processCardStatementImportJobAnalysis = functions
    .runWith({ timeoutSeconds: 540, memory: '1GB', maxInstances: 3 })
    .region('asia-northeast3')
    .firestore.document(`${COLLECTIONS.jobs}/{jobId}`)
    .onUpdate(async (change, context) => {
        const before = change.before.data() || {};
        const after = change.after.data() || {};
        const afterRunId = asString(after.analysisRunId);
        if (asString(after.status) !== 'analyzing' || !afterRunId) {
            return;
        }
        if (asString(before.status) === 'analyzing' && asString(before.analysisRunId) === afterRunId) {
            return;
        }
        await runCardStatementImportJobAnalysis(context.params.jobId, afterRunId);
    });

export const getCardStatementImportJobStatus = functions
    .runWith({ timeoutSeconds: 60, memory: '256MB', maxInstances: 10 })
    .region('asia-northeast3')
    .https.onCall(async (data: GetCardStatementImportJobStatusRequest, context) => {
        try {
            await requireCardStatementAccess(context);
            const jobId = asString(data?.jobId);
            if (!jobId) {
                throw new functions.https.HttpsError('invalid-argument', '가져오기 작업 ID가 필요합니다.');
            }
            return await getJobStatusPayload(jobId);
        } catch (error) {
            throw toHttpsError(error);
        }
    });

export const updateCardStatementImportResultReview = functions
    .runWith({ timeoutSeconds: 60, memory: '256MB', maxInstances: 10 })
    .region('asia-northeast3')
    .https.onCall(async (data: UpdateCardStatementImportResultReviewRequest, context) => {
        try {
            const auth = await requireCardStatementAccess(context) as NonNullable<functions.https.CallableContext['auth']>;
            const actor = resolveCallableActor(auth);
            const request = (data || {}) as Record<string, unknown>;
            const unexpectedFields = Object.keys(request).filter((field) => (
                !RESULT_REVIEW_ALLOWED_REQUEST_FIELDS.has(field)
            ));
            if (unexpectedFields.length > 0) {
                throw new functions.https.HttpsError(
                    'invalid-argument',
                    `Unsupported review fields: ${unexpectedFields.join(', ')}`
                );
            }

            const resultId = asString(request.resultId);
            if (!resultId) {
                throw new functions.https.HttpsError('invalid-argument', 'Result id is required.');
            }

            if (request.exclude !== undefined && typeof request.exclude !== 'boolean') {
                throw new functions.https.HttpsError('invalid-argument', 'exclude must be a boolean.');
            }
            if (request.exclusionReason !== undefined && typeof request.exclusionReason !== 'string') {
                throw new functions.https.HttpsError('invalid-argument', 'exclusionReason must be a string.');
            }

            const hasMatchedCardId = Object.prototype.hasOwnProperty.call(request, 'matchedCardId');
            const exclude = request.exclude === true;
            if (exclude && hasMatchedCardId) {
                throw new functions.https.HttpsError(
                    'invalid-argument',
                    'matchedCardId and exclude cannot be updated together.'
                );
            }
            if (!exclude && !hasMatchedCardId) {
                throw new functions.https.HttpsError(
                    'invalid-argument',
                    'matchedCardId or exclude is required.'
                );
            }
            if (!exclude && request.exclusionReason !== undefined) {
                throw new functions.https.HttpsError(
                    'invalid-argument',
                    'exclusionReason is only allowed when exclude is true.'
                );
            }

            let matchedCardId: string | null | undefined;
            if (hasMatchedCardId) {
                const rawMatchedCardId = request.matchedCardId;
                if (rawMatchedCardId === null || rawMatchedCardId === undefined || asString(rawMatchedCardId) === '') {
                    matchedCardId = null;
                } else if (typeof rawMatchedCardId === 'string') {
                    matchedCardId = asString(rawMatchedCardId);
                } else {
                    throw new functions.https.HttpsError('invalid-argument', 'matchedCardId must be a string or null.');
                }
            }

            const db = admin.firestore();
            let jobId = '';
            await db.runTransaction(async (transaction) => {
                const resultRef = db.collection(COLLECTIONS.results).doc(resultId);
                const resultSnap = await transaction.get(resultRef);
                if (!resultSnap.exists) {
                    throw new functions.https.HttpsError('not-found', 'Import result was not found.');
                }

                const result = resultSnap.data() || {};
                jobId = asString(result.jobId);
                if (!jobId) {
                    throw new functions.https.HttpsError('failed-precondition', 'Import result has no job id.');
                }

                const jobRef = db.collection(COLLECTIONS.jobs).doc(jobId);
                const jobSnap = await transaction.get(jobRef);
                if (!jobSnap.exists) {
                    throw new functions.https.HttpsError('not-found', 'Import job was not found.');
                }

                const jobStatus = asString(jobSnap.data()?.status);
                if (!RESULT_REVIEW_MUTABLE_JOB_STATUSES.has(jobStatus)) {
                    throw new functions.https.HttpsError(
                        'failed-precondition',
                        `Import result review is not allowed while job status is ${jobStatus || 'unknown'}.`
                    );
                }
                if (asString(result.status) === 'committed') {
                    throw new functions.https.HttpsError(
                        'failed-precondition',
                        'Committed import results cannot be reviewed.'
                    );
                }

                if (exclude) {
                    const reason = asString(request.exclusionReason) || 'Excluded by reviewer';
                    const warnings = Array.from(new Set([
                        ...asStringArray(result.warnings),
                        reason,
                    ].map(asString).filter(Boolean))).slice(0, 50);
                    transaction.set(resultRef, {
                        status: 'excluded',
                        matchedCardId: null,
                        matchedCardLabel: null,
                        matchConfidence: 0,
                        warnings,
                        analysisReviewRequired: false,
                        analysisReviewReason: '',
                        errorMessage: admin.firestore.FieldValue.delete(),
                        updatedAt: safeTimestamp(),
                    }, { merge: true });
                    return;
                }

                if (matchedCardId) {
                    const cardRef = db.collection(COLLECTIONS.cards).doc(matchedCardId);
                    const cardSnap = await transaction.get(cardRef);
                    if (!cardSnap.exists) {
                        throw new functions.https.HttpsError('not-found', 'Matched card was not found.');
                    }
                    const card = {
                        id: cardSnap.id,
                        ...(cardSnap.data() as Omit<FirestoreCardRecord, 'id'>),
                    };
                    const blockingReviewReason = getBlockingAnalysisReviewReason(asStringArray(result.warnings));
                    transaction.set(resultRef, {
                        matchedCardId,
                        matchedCardLabel: getCardLabel(card),
                        matchConfidence: 1,
                        status: 'matched',
                        analysisReviewRequired: false,
                        analysisReviewReason: blockingReviewReason || asString(result.analysisReviewReason) || '',
                        analysisReviewResolvedAt: safeTimestamp(),
                        analysisReviewResolvedByUid: actor.uid,
                        analysisReviewResolvedByName: actor.name,
                        errorMessage: admin.firestore.FieldValue.delete(),
                        updatedAt: safeTimestamp(),
                    }, { merge: true });
                    return;
                }

                transaction.set(resultRef, {
                    matchedCardId: null,
                    matchedCardLabel: null,
                    matchConfidence: 0,
                    status: 'needs_review',
                    analysisReviewRequired: Boolean(getBlockingAnalysisReviewReason(asStringArray(result.warnings))),
                    analysisReviewResolvedAt: admin.firestore.FieldValue.delete(),
                    analysisReviewResolvedByUid: admin.firestore.FieldValue.delete(),
                    analysisReviewResolvedByName: admin.firestore.FieldValue.delete(),
                    errorMessage: admin.firestore.FieldValue.delete(),
                    updatedAt: safeTimestamp(),
                }, { merge: true });
            });

            await recomputeCardStatementImportJobReviewSummary(jobId);
            return await getJobStatusPayload(jobId);
        } catch (error) {
            throw toHttpsError(error);
        }
    });

export const commitCardStatementImportJob = functions
    .runWith({ timeoutSeconds: 540, memory: '1GB', maxInstances: 3 })
    .region('asia-northeast3')
    .https.onCall(async (data: CommitCardStatementImportJobRequest, context) => {
        let actorForOperationLog: { uid: string; name: string; email: string | null } = context.auth
            ? resolveCallableActor(context.auth as NonNullable<functions.https.CallableContext['auth']>)
            : { uid: 'system', name: 'ERP 시스템', email: null };
        let yearMonthForOperationLog = '';
        let operationIdForOperationLog = '';
        let committedResultsForOperationLog = 0;
        let committedTransactionsForOperationLog = 0;
        let skippedResultsForOperationLog = 0;
        let attemptedBillingDocumentCountForOperationLog = 0;
        let committedBillingDocumentCountForOperationLog = 0;
        const protectedBillingIdsForOperationLog: string[] = [];
        const affectedDocumentIdsForOperationLog: string[] = [];
        try {
            const auth = await requireCardStatementAccess(context) as NonNullable<functions.https.CallableContext['auth']>;
            actorForOperationLog = resolveCallableActor(auth);
            const jobId = asString(data?.jobId);
            if (!jobId) {
                throw new functions.https.HttpsError('invalid-argument', '저장할 가져오기 작업 ID가 필요합니다.');
            }
            const operationId = `card-statement-import:${jobId}:commit`;
            operationIdForOperationLog = operationId;

            const db = admin.firestore();
            const jobRef = db.collection(COLLECTIONS.jobs).doc(jobId);
            const jobSnap = await jobRef.get();
            if (!jobSnap.exists) {
                throw new functions.https.HttpsError('not-found', '카드 청구서 가져오기 작업을 찾을 수 없습니다.');
            }

            const job = jobSnap.data() || {};
            const yearMonth = asString(job.yearMonth);
            yearMonthForOperationLog = yearMonth;
            if (!isValidYearMonth(yearMonth)) {
                throw new functions.https.HttpsError('failed-precondition', '가져오기 작업의 월 정보가 올바르지 않습니다.');
            }

            const fileDocs = await getSortedImportFileDocs(jobId);
            if (fileDocs.length === 0) {
                throw new functions.https.HttpsError('failed-precondition', '저장할 PDF 원본 파일이 없습니다.');
            }
            const verifiedSourceFiles = await verifyCardStatementImportSourcesBeforeCommit(fileDocs);
            const resultsSnap = await db.collection(COLLECTIONS.results).where('jobId', '==', jobId).get();
            const resultDocs = resultsSnap.docs.map((docSnap) => ({
                id: docSnap.id,
                ref: docSnap.ref,
                data: docSnap.data(),
            }));
            validateResultSourceHashes(resultDocs, verifiedSourceFiles);
            const sourceClaims = await claimCardStatementImportSources({
                db,
                jobId,
                yearMonth,
                files: verifiedSourceFiles,
                actor: actorForOperationLog,
            });
            const duplicateSourceResultCount = await excludeDuplicateSourceResults({
                db,
                jobId,
                results: resultDocs,
                claims: sourceClaims,
            });

            await jobRef.set({
                status: 'committing',
                updatedAt: safeTimestamp(),
                errorMessage: admin.firestore.FieldValue.delete(),
            }, { merge: true });

            const candidates = resultDocs.filter(({ data: result }) => (
                asString(result.status) === 'matched' &&
                asString(result.matchedCardId) &&
                asString(result.yearMonth) === yearMonth &&
                !isBlockingAnalysisReviewUnresolved(result)
            ));

            const billingGroups = new Map<string, CardStatementImportBillingGroup>();
            let committedResults = 0;
            let committedTransactions = 0;
            let skippedResults = duplicateSourceResultCount;
            let committedBillingDocumentCount = 0;
            const protectedBillingIds: string[] = [];
            const affectedDocumentIds: string[] = [];

            for (const candidate of candidates) {
                const result = { id: candidate.id, ...candidate.data } as Record<string, unknown> & { id: string };
                const cardSnap = await db.collection(COLLECTIONS.cards).doc(asString(result.matchedCardId)).get();
                if (!cardSnap.exists) {
                    skippedResults += 1;
                    affectedDocumentIds.push(candidate.id);
                    skippedResultsForOperationLog = skippedResults;
                    affectedDocumentIdsForOperationLog.push(candidate.id);
                    await candidate.ref.set({
                        status: 'failed',
                        errorMessage: '매칭된 카드 문서를 찾을 수 없습니다.',
                        updatedAt: safeTimestamp(),
                    }, { merge: true });
                    continue;
                }

                const card: FirestoreCardRecord = { id: cardSnap.id, ...cardSnap.data() };
                const prepared = await buildPreparedCommit(result, card, yearMonth);
                if (!prepared) {
                    skippedResults += 1;
                    affectedDocumentIds.push(candidate.id);
                    skippedResultsForOperationLog = skippedResults;
                    affectedDocumentIdsForOperationLog.push(candidate.id);
                    await candidate.ref.set({
                        status: 'failed',
                        errorMessage: '카드 청구 대상을 확인할 수 없습니다.',
                        updatedAt: safeTimestamp(),
                    }, { merge: true });
                    continue;
                }

                const group = billingGroups.get(prepared.billingId) || {
                    card,
                    target: prepared,
                    resultIds: [],
                    resultMarkers: new Map<string, CardStatementImportResultCommitMarker>(),
                    statementPaths: new Set<string>(),
                    lineItems: [],
                    transactionUpserts: [],
                };
                group.resultIds.push(candidate.id);
                group.resultMarkers.set(candidate.id, {
                    transactionIds: prepared.transactionUpserts.map((transactionPayload) => transactionPayload.id),
                    lineItemIds: prepared.lineItems.map((lineItem) => asString(lineItem.id)).filter(Boolean),
                    statementPath: prepared.statementPath,
                    sourceSha256: normalizeCardStatementSourceSha256(result.sourceSha256),
                    sourceFileId: asString(result.fileId),
                });
                if (prepared.statementPath) group.statementPaths.add(prepared.statementPath);
                group.lineItems.push(...prepared.lineItems);
                group.transactionUpserts.push(...prepared.transactionUpserts);
                billingGroups.set(prepared.billingId, group);
            }

            attemptedBillingDocumentCountForOperationLog = 0;
            for (const [billingId, group] of billingGroups.entries()) {
                const groupResult = await commitCardStatementBillingGroupTransaction({
                    db,
                    billingId,
                    group,
                    jobId,
                    yearMonth,
                    operationId,
                    actor: actorForOperationLog,
                });
                committedResults += groupResult.committedResults;
                committedTransactions += groupResult.committedTransactions;
                skippedResults += groupResult.skippedResults;
                committedBillingDocumentCount += groupResult.committedBillingDocumentCount;
                protectedBillingIds.push(...groupResult.protectedBillingIds);
                affectedDocumentIds.push(...groupResult.affectedDocumentIds);
                committedResultsForOperationLog = committedResults;
                committedTransactionsForOperationLog = committedTransactions;
                skippedResultsForOperationLog = skippedResults;
                committedBillingDocumentCountForOperationLog = committedBillingDocumentCount;
                protectedBillingIdsForOperationLog.push(...groupResult.protectedBillingIds);
                affectedDocumentIdsForOperationLog.push(...groupResult.affectedDocumentIds);
            }

            committedResultsForOperationLog = committedResults;
            committedTransactionsForOperationLog = committedTransactions;
            skippedResultsForOperationLog = skippedResults;
            committedBillingDocumentCountForOperationLog = committedBillingDocumentCount;

            const remainingSnap = await db.collection(COLLECTIONS.results).where('jobId', '==', jobId).get();
            const remainingDocs = remainingSnap.docs.map((docSnap) => ({
                id: docSnap.id,
                data: docSnap.data(),
            }));
            const needsReview = remainingDocs.filter(({ data: result }) => (
                !['committed', 'excluded'].includes(asString(result.status)) &&
                (asString(result.status) !== 'matched' || isBlockingAnalysisReviewUnresolved(result))
            )).length;
            const failedResults = remainingDocs.filter(({ data: result }) => asString(result.status) === 'failed').length;
            const committedSummary = summarizeCommittedImportResults(remainingDocs);
            const finalStatus = needsReview > 0 || skippedResults > duplicateSourceResultCount ? 'reviewing' : 'completed';
            const finalAffectedDocumentIds = collectCommitAffectedDocumentIds(
                jobId,
                remainingDocs,
                [
                    ...affectedDocumentIds,
                    ...protectedBillingIds,
                    ...Array.from(sourceClaims.ownerBySha256.keys()).map(buildCardStatementSourceClaimDocumentId),
                    buildSupportWriteOperationId(SUPPORT_WRITE_OPERATION_DOMAIN, operationId),
                ]
            );
            const operationLogPayload = buildSupportWriteOperationPayload({
                yearMonth,
                operationId,
                status: 'success',
                actor: actorForOperationLog,
                affectedDocumentIds: finalAffectedDocumentIds,
                userMessage: duplicateSourceResultCount > 0
                    ? `카드 PDF 금액·증빙 ${committedSummary.committedResults}건 저장, 중복 원본 ${duplicateSourceResultCount}건 제외`
                    : `카드 PDF 금액·증빙 임시저장 ${committedSummary.committedResults}건 완료`,
                metadata: {
                    jobId,
                    committedResults: committedSummary.committedResults,
                    committedTransactions: committedSummary.committedTransactions,
                    newlyCommittedResults: committedResults,
                    newlyCommittedTransactions: committedTransactions,
                    skippedResults,
                    duplicateSourceResults: duplicateSourceResultCount,
                    attemptedBillingDocumentCount: 0,
                    ledgerGroupCount: billingGroups.size,
                    committedBillingDocumentCount,
                    protectedBillingIds: uniqueStrings(protectedBillingIds),
                    needsReview,
                    finalStatus,
                },
            }, admin.firestore.Timestamp.now());

            const finalBatch = db.batch();
            finalBatch.set(jobRef, {
                status: finalStatus,
                committedTransactions: committedSummary.committedTransactions,
                errorCount: failedResults,
                updatedAt: safeTimestamp(),
                ...(finalStatus === 'completed' ? { completedAt: safeTimestamp() } : {}),
            }, { merge: true });
            sourceClaims.ownedFileBySha256.forEach((ownerFileId, sourceSha256) => {
                const sourceResults = remainingDocs.filter(({ data: result }) => (
                    normalizeCardStatementSourceSha256(result.sourceSha256) === sourceSha256 &&
                    asString(result.fileId) === ownerFileId
                ));
                const committedSourceResults = sourceResults.filter(({ data: result }) => (
                    asString(result.status) === 'committed'
                ));
                const committedTransactionIds = uniqueStrings(committedSourceResults.flatMap(({ data: result }) => (
                    asStringList(result.committedTransactionIds)
                )));
                finalBatch.set(
                    db.collection(COLLECTIONS.sourceClaims).doc(
                        buildCardStatementSourceClaimDocumentId(sourceSha256),
                    ),
                    {
                        state: committedSourceResults.length > 0 ? 'committed' : 'claimed',
                        committedResultIds: committedSourceResults.map(({ id }) => id),
                        committedTransactionIds,
                        completedAt: committedSourceResults.length > 0
                            ? safeTimestamp()
                            : admin.firestore.FieldValue.delete(),
                        updatedAt: safeTimestamp(),
                    },
                    { merge: true },
                );
            });
            finalBatch.set(
                db.collection(COLLECTIONS.supportWriteOperations).doc(asString(operationLogPayload.id)),
                {
                    ...operationLogPayload,
                    errorMessage: admin.firestore.FieldValue.delete(),
                },
                { merge: true }
            );
            await finalBatch.commit();

            return {
                ...(await getJobStatusPayload(jobId)),
                commit: {
                    committedResults: committedSummary.committedResults,
                    committedTransactions: committedSummary.committedTransactions,
                    skippedResults,
                },
            };
        } catch (error) {
            const message = getErrorMessage(error);
            const jobId = asString((data as CommitCardStatementImportJobRequest)?.jobId);
            if (jobId) {
                const db = admin.firestore();
                const failureOperationId = operationIdForOperationLog || `card-statement-import:${jobId}:commit`;
                let failureAffectedDocumentIds = uniqueStrings([
                    jobId,
                    ...affectedDocumentIdsForOperationLog,
                    ...protectedBillingIdsForOperationLog,
                    buildSupportWriteOperationId(SUPPORT_WRITE_OPERATION_DOMAIN, failureOperationId),
                ]);
                try {
                    const failureResultsSnap = await db.collection(COLLECTIONS.results).where('jobId', '==', jobId).get();
                    const failureResultDocs = failureResultsSnap.docs.map((docSnap) => ({
                        id: docSnap.id,
                        data: docSnap.data(),
                    }));
                    failureAffectedDocumentIds = collectCommitAffectedDocumentIds(
                        jobId,
                        failureResultDocs,
                        failureAffectedDocumentIds
                    );
                } catch (collectError) {
                    functions.logger.warn('Failed to collect card statement import failure affected documents.', collectError);
                }
                const failureLogPayload = buildSupportWriteOperationPayload({
                    yearMonth: yearMonthForOperationLog,
                    operationId: failureOperationId,
                    status: 'failed',
                    actor: actorForOperationLog,
                    affectedDocumentIds: failureAffectedDocumentIds,
                    errorMessage: message,
                    userMessage: '카드 청구 PDF 일괄등록 반영에 실패했습니다.',
                    metadata: {
                        jobId,
                        committedResults: committedResultsForOperationLog,
                        committedTransactions: committedTransactionsForOperationLog,
                        skippedResults: skippedResultsForOperationLog,
                        attemptedBillingDocumentCount: attemptedBillingDocumentCountForOperationLog,
                        committedBillingDocumentCount: committedBillingDocumentCountForOperationLog,
                        protectedBillingIds: uniqueStrings(protectedBillingIdsForOperationLog),
                    },
                }, admin.firestore.Timestamp.now());
                const failureBatch = db.batch();
                failureBatch.set(db.collection(COLLECTIONS.jobs).doc(jobId), {
                    status: 'reviewing',
                    errorMessage: message,
                    updatedAt: safeTimestamp(),
                }, { merge: true });
                failureBatch.set(
                    db.collection(COLLECTIONS.supportWriteOperations).doc(asString(failureLogPayload.id)),
                    failureLogPayload,
                    { merge: true }
                );
                await failureBatch.commit().catch((logError) => {
                    functions.logger.warn('Failed to record card statement import operation failure.', logError);
                });
            }
            throw toHttpsError(error);
        }
    });
