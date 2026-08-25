import { createHash } from 'crypto';
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';
import { getServerGeminiSettings } from './serverAiSettings';

export type CardExpenseAuditSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type CardExpenseAuditReviewStatus = 'OPEN' | 'NORMAL' | 'NEEDS_EVIDENCE' | 'EXCEPTION' | 'ACKNOWLEDGED';

export interface CardExpenseAuditPolicy {
    highAmountThreshold: number;
    receiptRequiredAmount: number;
    splitPaymentTotalThreshold: number;
    unusualAmountRatio: number;
    unusualAmountMinimum: number;
    newMerchantMinimum: number;
    categoryLimits: Record<string, number>;
    geminiEnabled: boolean;
    geminiMinimumScore: number;
    geminiMaximumTransactions: number;
}

export interface CardExpenseAuditTransactionInput {
    id: string;
    cardId: string;
    cardLabel: string;
    date: string;
    yearMonth: string;
    merchant: string;
    category: string;
    amount: number;
    memo?: string;
    evidenceUrl?: string;
    statementAttachmentPaths?: string[];
    receiptAttachmentPaths?: string[];
    status?: string;
}

export interface CardExpenseAuditAssignmentInput {
    id: string;
    cardId: string;
    assigneeName: string;
    startDate: string;
    endDate?: string;
}

export interface CardExpenseAuditRuleHit {
    code: string;
    label: string;
    detail: string;
    score: number;
}

export interface CardExpenseAuditFindingDraft {
    transactionId: string;
    cardId: string;
    cardLabel: string;
    assignedTo: string;
    date: string;
    yearMonth: string;
    merchant: string;
    normalizedMerchant: string;
    category: string;
    amount: number;
    deterministicScore: number;
    riskScore: number;
    severity: CardExpenseAuditSeverity;
    ruleHits: CardExpenseAuditRuleHit[];
    baseline: {
        historicalCount: number;
        historicalMedian: number;
        amountRatio: number;
        merchantSeenCount: number;
    };
    hasReceipt: boolean;
    hasStatementEvidence: boolean;
    detectionHash: string;
}

type GeminiAuditReview = {
    transactionId: string;
    scoreAdjustment: number;
    summary: string;
    reasons: string[];
    confidence: number;
    suggestedAction: 'ACCEPT' | 'REVIEW' | 'REQUEST_EVIDENCE';
};

const COLLECTIONS = {
    cards: 'cards',
    transactions: 'cardTransactions',
    assignments: 'cardAssignments',
    policies: 'cardExpenseAuditPolicies',
    runs: 'cardExpenseAuditRuns',
    findings: 'cardExpenseAuditFindings',
    reviewLogs: 'cardExpenseAuditReviewLogs',
} as const;

const DEFAULT_POLICY: CardExpenseAuditPolicy = {
    highAmountThreshold: 500_000,
    receiptRequiredAmount: 100_000,
    splitPaymentTotalThreshold: 200_000,
    unusualAmountRatio: 3,
    unusualAmountMinimum: 100_000,
    newMerchantMinimum: 150_000,
    categoryLimits: {
        FUEL: 300_000,
        TOLL: 200_000,
        MEAL: 100_000,
        MATERIAL: 500_000,
        OTHER: 300_000,
    },
    geminiEnabled: true,
    geminiMinimumScore: 25,
    geminiMaximumTransactions: 50,
};

const STRICT_ROLE_KEYS = new Set([
    'ceo',
    '대표',
    '사장',
    'pos_ceo',
    'dev',
    'developer',
    '개발',
    '개발자',
]);

const asString = (value: unknown): string => String(value ?? '').trim();
const asNumber = (value: unknown, fallback = 0): number => {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
};
const normalizeKey = (value: unknown): string => asString(value).normalize('NFKC').toLowerCase();
const normalizeMerchant = (value: unknown): string => normalizeKey(value)
    .replace(/\([^)]*\)/g, ' ')
    .replace(/주식회사|\(주\)|㈜/g, ' ')
    .replace(/[^0-9a-z가-힣]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
const normalizePositiveInteger = (value: unknown, fallback: number, max = 100_000_000): number => {
    const number = Math.round(asNumber(value, fallback));
    return clamp(number > 0 ? number : fallback, 1, max);
};
const normalizeRatio = (value: unknown, fallback: number): number => clamp(asNumber(value, fallback), 1.1, 20);

export const normalizeCardExpenseAuditPolicy = (value: unknown): CardExpenseAuditPolicy => {
    const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {};
    const rawCategoryLimits = raw.categoryLimits && typeof raw.categoryLimits === 'object'
        ? raw.categoryLimits as Record<string, unknown>
        : {};
    const categoryLimits = Object.fromEntries(
        Object.entries(DEFAULT_POLICY.categoryLimits).map(([category, fallback]) => [
            category,
            normalizePositiveInteger(rawCategoryLimits[category], fallback),
        ]),
    );

    return {
        highAmountThreshold: normalizePositiveInteger(raw.highAmountThreshold, DEFAULT_POLICY.highAmountThreshold),
        receiptRequiredAmount: normalizePositiveInteger(raw.receiptRequiredAmount, DEFAULT_POLICY.receiptRequiredAmount),
        splitPaymentTotalThreshold: normalizePositiveInteger(raw.splitPaymentTotalThreshold, DEFAULT_POLICY.splitPaymentTotalThreshold),
        unusualAmountRatio: normalizeRatio(raw.unusualAmountRatio, DEFAULT_POLICY.unusualAmountRatio),
        unusualAmountMinimum: normalizePositiveInteger(raw.unusualAmountMinimum, DEFAULT_POLICY.unusualAmountMinimum),
        newMerchantMinimum: normalizePositiveInteger(raw.newMerchantMinimum, DEFAULT_POLICY.newMerchantMinimum),
        categoryLimits,
        geminiEnabled: raw.geminiEnabled === undefined ? DEFAULT_POLICY.geminiEnabled : raw.geminiEnabled === true,
        geminiMinimumScore: clamp(Math.round(asNumber(raw.geminiMinimumScore, DEFAULT_POLICY.geminiMinimumScore)), 0, 100),
        geminiMaximumTransactions: clamp(Math.round(asNumber(raw.geminiMaximumTransactions, DEFAULT_POLICY.geminiMaximumTransactions)), 1, 100),
    };
};

const collectRoleValues = (source: Record<string, unknown>): string[] => {
    const fields = ['role', 'position', 'systemRole', 'accountType', 'roles', 'additionalPositions', 'erpRoleGroups'];
    return fields.flatMap((field) => {
        const value = source[field];
        return Array.isArray(value) ? value.map(asString) : [asString(value)];
    }).filter(Boolean);
};

export const hasStrictCardExpenseAuditAccess = (source: Record<string, unknown>): boolean => (
    collectRoleValues(source).some((value) => STRICT_ROLE_KEYS.has(normalizeKey(value)))
);

const requireCardExpenseAuditAccess = async (
    context: functions.https.CallableContext,
): Promise<{ uid: string; name: string; email: string | null }> => {
    if (!context.auth?.uid) {
        throw new functions.https.HttpsError('unauthenticated', '로그인이 필요합니다.');
    }

    const token = (context.auth.token || {}) as Record<string, unknown>;
    const userSnap = await admin.firestore().collection('users').doc(context.auth.uid).get();
    const user = userSnap.data() || {};
    if (!hasStrictCardExpenseAuditAccess(token) && !hasStrictCardExpenseAuditAccess(user)) {
        throw new functions.https.HttpsError('permission-denied', '카드 AI 감사는 CEO와 DEV 직책만 이용할 수 있습니다.');
    }

    return {
        uid: context.auth.uid,
        name: asString(user.displayName || token.name || token.email || context.auth.uid),
        email: asString(user.email || token.email) || null,
    };
};

const parseYearMonth = (value: unknown): string => {
    const yearMonth = asString(value);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(yearMonth)) {
        throw new functions.https.HttpsError('invalid-argument', '감사월은 yyyy-MM 형식이어야 합니다.');
    }
    return yearMonth;
};

const addMonths = (yearMonth: string, delta: number): string => {
    const [year, month] = yearMonth.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1 + delta, 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
};

const severityForScore = (score: number): CardExpenseAuditSeverity => {
    if (score >= 75) return 'CRITICAL';
    if (score >= 55) return 'HIGH';
    if (score >= 35) return 'MEDIUM';
    return 'LOW';
};

const median = (values: number[]): number => {
    if (values.length === 0) return 0;
    const sorted = values.slice().sort((a, b) => a - b);
    const midpoint = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
        ? Math.round((sorted[midpoint - 1] + sorted[midpoint]) / 2)
        : sorted[midpoint];
};

const activeAssignmentForDate = (
    assignments: CardExpenseAuditAssignmentInput[],
    cardId: string,
    date: string,
): CardExpenseAuditAssignmentInput | undefined => assignments
    .filter((assignment) => assignment.cardId === cardId)
    .filter((assignment) => assignment.startDate <= date && (!assignment.endDate || assignment.endDate >= date))
    .sort((left, right) => right.startDate.localeCompare(left.startDate))[0];

const hashObject = (value: unknown): string => createHash('sha256')
    .update(JSON.stringify(value))
    .digest('hex');

export const evaluateCardExpenseTransactions = (input: {
    yearMonth: string;
    transactions: CardExpenseAuditTransactionInput[];
    historicalTransactions: CardExpenseAuditTransactionInput[];
    assignments: CardExpenseAuditAssignmentInput[];
    policy?: Partial<CardExpenseAuditPolicy> | null;
}): CardExpenseAuditFindingDraft[] => {
    const policy = normalizeCardExpenseAuditPolicy(input.policy);
    const activeTransactions = input.transactions.filter((transaction) => (
        transaction.yearMonth === input.yearMonth
        && transaction.status !== 'CANCELLED'
        && transaction.date.startsWith(input.yearMonth)
    ));
    const history = input.historicalTransactions.filter((transaction) => (
        transaction.yearMonth < input.yearMonth && transaction.status !== 'CANCELLED'
    ));

    const exactGroups = new Map<string, CardExpenseAuditTransactionInput[]>();
    const dailyMerchantGroups = new Map<string, CardExpenseAuditTransactionInput[]>();
    activeTransactions.forEach((transaction) => {
        const merchant = normalizeMerchant(transaction.merchant);
        const exactKey = [transaction.cardId, transaction.date, merchant, Math.round(transaction.amount)].join('|');
        const splitKey = [transaction.cardId, transaction.date, merchant].join('|');
        exactGroups.set(exactKey, [...(exactGroups.get(exactKey) || []), transaction]);
        if (transaction.amount > 0) {
            dailyMerchantGroups.set(splitKey, [...(dailyMerchantGroups.get(splitKey) || []), transaction]);
        }
    });

    const historyAmounts = new Map<string, number[]>();
    const historyMerchants = new Map<string, number>();
    const historyCardCounts = new Map<string, number>();
    history.forEach((transaction) => {
        const categoryKey = [transaction.cardId, transaction.category].join('|');
        const merchantKey = [transaction.cardId, normalizeMerchant(transaction.merchant)].join('|');
        if (transaction.amount > 0) {
            historyAmounts.set(categoryKey, [...(historyAmounts.get(categoryKey) || []), transaction.amount]);
        }
        historyMerchants.set(merchantKey, (historyMerchants.get(merchantKey) || 0) + 1);
        historyCardCounts.set(transaction.cardId, (historyCardCounts.get(transaction.cardId) || 0) + 1);
    });

    return activeTransactions.flatMap((transaction): CardExpenseAuditFindingDraft[] => {
        const amount = Math.round(transaction.amount);
        const absoluteAmount = Math.abs(amount);
        const normalizedMerchant = normalizeMerchant(transaction.merchant);
        const exactKey = [transaction.cardId, transaction.date, normalizedMerchant, amount].join('|');
        const splitKey = [transaction.cardId, transaction.date, normalizedMerchant].join('|');
        const exactMatches = exactGroups.get(exactKey) || [];
        const splitMatches = dailyMerchantGroups.get(splitKey) || [];
        const splitTotal = splitMatches.reduce((sum, item) => sum + item.amount, 0);
        const historicalValues = historyAmounts.get([transaction.cardId, transaction.category].join('|')) || [];
        const historicalMedian = median(historicalValues);
        const amountRatio = historicalMedian > 0 ? Number((absoluteAmount / historicalMedian).toFixed(2)) : 0;
        const merchantSeenCount = historyMerchants.get([transaction.cardId, normalizedMerchant].join('|')) || 0;
        const activeAssignment = activeAssignmentForDate(input.assignments, transaction.cardId, transaction.date);
        const hasReceipt = Array.isArray(transaction.receiptAttachmentPaths) && transaction.receiptAttachmentPaths.length > 0;
        const hasStatementEvidence = Boolean(transaction.evidenceUrl)
            || Boolean(transaction.statementAttachmentPaths?.length);
        const ruleHits: CardExpenseAuditRuleHit[] = [];

        if (exactMatches.length > 1 && absoluteAmount > 0) {
            ruleHits.push({
                code: 'DUPLICATE_TRANSACTION',
                label: '중복 결제 의심',
                detail: `같은 카드·날짜·가맹점·금액 거래가 ${exactMatches.length}건 있습니다.`,
                score: 35,
            });
        }
        if (splitMatches.length >= 2 && splitTotal >= policy.splitPaymentTotalThreshold) {
            ruleHits.push({
                code: 'SPLIT_PAYMENT',
                label: '분할 결제 의심',
                detail: `같은 날 같은 가맹점에서 ${splitMatches.length}회, 합계 ${Math.round(splitTotal).toLocaleString('ko-KR')}원이 결제되었습니다.`,
                score: 25,
            });
        }
        if (amount > 0 && amount >= policy.highAmountThreshold) {
            ruleHits.push({
                code: 'HIGH_AMOUNT',
                label: '고액 결제',
                detail: `설정된 고액 기준 ${policy.highAmountThreshold.toLocaleString('ko-KR')}원을 초과했습니다.`,
                score: 25,
            });
        }
        const categoryLimit = policy.categoryLimits[transaction.category];
        if (amount > 0 && categoryLimit && amount >= categoryLimit) {
            ruleHits.push({
                code: 'CATEGORY_LIMIT',
                label: '분류별 한도 초과',
                detail: `${transaction.category} 기준 ${categoryLimit.toLocaleString('ko-KR')}원을 초과했습니다.`,
                score: 20,
            });
        }
        if (amount > 0 && amount >= policy.receiptRequiredAmount && !hasReceipt) {
            ruleHits.push({
                code: 'MISSING_RECEIPT',
                label: '영수증 확인 필요',
                detail: `${policy.receiptRequiredAmount.toLocaleString('ko-KR')}원 이상 거래에 별도 영수증 증빙이 없습니다.`,
                score: 15,
            });
        }
        if (!activeAssignment) {
            ruleHits.push({
                code: 'ASSIGNMENT_MISMATCH',
                label: '배정기간 불일치',
                detail: '거래일에 유효한 카드 배정 기록을 찾지 못했습니다.',
                score: 45,
            });
        }
        if (
            amount > 0
            && historicalValues.length >= 5
            && amount >= policy.unusualAmountMinimum
            && amountRatio >= policy.unusualAmountRatio
        ) {
            ruleHits.push({
                code: 'UNUSUAL_AMOUNT',
                label: '평소 대비 이상금액',
                detail: `최근 동일 분류 중앙값의 ${amountRatio.toFixed(1)}배입니다.`,
                score: 25,
            });
        }
        if (
            amount > 0
            && amount >= policy.newMerchantMinimum
            && (historyCardCounts.get(transaction.cardId) || 0) >= 5
            && merchantSeenCount === 0
        ) {
            ruleHits.push({
                code: 'NEW_MERCHANT',
                label: '신규 가맹점',
                detail: '최근 6개월 카드 사용내역에 없는 가맹점의 고액 거래입니다.',
                score: 10,
            });
        }
        if (amount < 0) {
            const hasMatchingCharge = [...activeTransactions, ...history].some((candidate) => (
                candidate.cardId === transaction.cardId
                && normalizeMerchant(candidate.merchant) === normalizedMerchant
                && Math.round(candidate.amount) === absoluteAmount
            ));
            if (!hasMatchingCharge) {
                ruleHits.push({
                    code: 'UNPAIRED_REFUND',
                    label: '원거래 없는 취소·환불',
                    detail: '동일 카드·가맹점·금액의 원결제 거래를 찾지 못했습니다.',
                    score: 20,
                });
            }
        }

        if (ruleHits.length === 0) return [];
        const deterministicScore = clamp(ruleHits.reduce((sum, hit) => sum + hit.score, 0), 0, 100);
        const detectionHash = hashObject({
            transactionId: transaction.id,
            date: transaction.date,
            merchant: normalizedMerchant,
            amount,
            category: transaction.category,
            ruleHits: ruleHits.map((hit) => [hit.code, hit.score]),
        });

        return [{
            transactionId: transaction.id,
            cardId: transaction.cardId,
            cardLabel: transaction.cardLabel,
            assignedTo: activeAssignment?.assigneeName || '배정 확인 필요',
            date: transaction.date,
            yearMonth: transaction.yearMonth,
            merchant: transaction.merchant,
            normalizedMerchant,
            category: transaction.category,
            amount,
            deterministicScore,
            riskScore: deterministicScore,
            severity: severityForScore(deterministicScore),
            ruleHits,
            baseline: {
                historicalCount: historicalValues.length,
                historicalMedian,
                amountRatio,
                merchantSeenCount,
            },
            hasReceipt,
            hasStatementEvidence,
            detectionHash,
        }];
    });
};

const parseGeminiJson = (rawText: string): Record<string, unknown> => {
    const cleaned = rawText.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    const parsed = JSON.parse(cleaned);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Gemini 카드감사 응답 형식이 올바르지 않습니다.');
    }
    return parsed as Record<string, unknown>;
};

const extractGeminiText = (payload: any): string => {
    const parts = payload?.candidates?.[0]?.content?.parts;
    if (!Array.isArray(parts)) return '';
    return parts.map((part: any) => asString(part?.text)).filter(Boolean).join('\n');
};

const GEMINI_RESPONSE_SCHEMA = {
    type: 'object',
    properties: {
        executiveSummary: { type: 'string' },
        priorityActions: { type: 'array', items: { type: 'string' } },
        reviews: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    transactionId: { type: 'string' },
                    scoreAdjustment: { type: 'number' },
                    summary: { type: 'string' },
                    reasons: { type: 'array', items: { type: 'string' } },
                    confidence: { type: 'number' },
                    suggestedAction: { type: 'string', enum: ['ACCEPT', 'REVIEW', 'REQUEST_EVIDENCE'] },
                },
                required: ['transactionId', 'scoreAdjustment', 'summary', 'reasons', 'confidence', 'suggestedAction'],
            },
        },
    },
    required: ['executiveSummary', 'priorityActions', 'reviews'],
};

const callGeminiExpenseAudit = async (
    findings: CardExpenseAuditFindingDraft[],
): Promise<{ model: string; executiveSummary: string; priorityActions: string[]; reviews: GeminiAuditReview[] }> => {
    const settings = await getServerGeminiSettings();
    const apiKey = asString(settings.apiKey);
    const model = asString(settings.batchModel || settings.model) || 'gemini-2.5-flash';
    if (!apiKey) throw new Error('서버용 Gemini API Key가 설정되지 않았습니다.');

    const candidates = findings.map((finding) => ({
        transactionId: finding.transactionId,
        date: finding.date,
        merchant: finding.merchant,
        category: finding.category,
        amount: finding.amount,
        deterministicScore: finding.deterministicScore,
        ruleCodes: finding.ruleHits.map((hit) => hit.code),
        ruleEvidence: finding.ruleHits.map((hit) => hit.detail),
        baseline: finding.baseline,
        hasReceipt: finding.hasReceipt,
    }));
    const prompt = `당신은 건설회사 법인카드 내부감사 보조 AI입니다.
아래 거래는 결정론적 규칙 엔진이 먼저 선별한 예외입니다. 부정 사용을 단정하지 말고, 제공된 데이터만 근거로 감사 우선순위를 보정하세요.

규칙:
- scoreAdjustment는 -10부터 15 사이입니다.
- summary는 한국어 100자 이내입니다.
- reasons는 최대 3개이며 입력에 없는 사실을 만들지 않습니다.
- 영수증이 없거나 배정기간이 불명확하면 사람 확인을 권고합니다.
- 개인사용, 횡령, 부정행위를 확정적으로 표현하지 않습니다.
- ACCEPT는 위험 근거가 약한 경우, REVIEW는 추가 검토, REQUEST_EVIDENCE는 증빙 요청이 합리적인 경우입니다.
- executiveSummary는 CEO가 바로 이해할 수 있는 한국어 300자 이내 월간 요약입니다.
- priorityActions는 감사자가 먼저 확인할 조치 최대 5개입니다.

거래 JSON:
${JSON.stringify(candidates)}`;
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.05,
                responseMimeType: 'application/json',
                responseJsonSchema: GEMINI_RESPONSE_SCHEMA,
            },
        }),
    });
    const responseText = await response.text();
    let payload: any = null;
    try {
        payload = responseText ? JSON.parse(responseText) : null;
    } catch {
        payload = null;
    }
    if (!response.ok || payload?.error) {
        throw new Error(payload?.error?.message || `Gemini 요청 실패 (${response.status})`);
    }
    const parsed = parseGeminiJson(extractGeminiText(payload));
    const reviews = Array.isArray(parsed.reviews) ? parsed.reviews : [];
    return {
        model,
        executiveSummary: asString(parsed.executiveSummary).slice(0, 1000),
        priorityActions: (Array.isArray(parsed.priorityActions) ? parsed.priorityActions : [])
            .map(asString)
            .filter(Boolean)
            .slice(0, 5),
        reviews: reviews.map((review: any): GeminiAuditReview => ({
            transactionId: asString(review.transactionId),
            scoreAdjustment: clamp(Math.round(asNumber(review.scoreAdjustment)), -10, 15),
            summary: asString(review.summary).slice(0, 300),
            reasons: (Array.isArray(review.reasons) ? review.reasons : []).map(asString).filter(Boolean).slice(0, 3),
            confidence: clamp(asNumber(review.confidence), 0, 1),
            suggestedAction: ['ACCEPT', 'REVIEW', 'REQUEST_EVIDENCE'].includes(asString(review.suggestedAction))
                ? review.suggestedAction
                : 'REVIEW',
        })).filter((review: GeminiAuditReview) => review.transactionId),
    };
};

const toTransaction = (doc: FirebaseFirestore.QueryDocumentSnapshot): CardExpenseAuditTransactionInput => {
    const data = doc.data();
    return {
        id: doc.id,
        cardId: asString(data.cardId),
        cardLabel: asString(data.cardLabel) || '카드',
        date: asString(data.date),
        yearMonth: asString(data.yearMonth),
        merchant: asString(data.merchant) || '가맹점 미확인',
        category: asString(data.category) || 'OTHER',
        amount: Math.round(asNumber(data.amount)),
        memo: asString(data.memo),
        evidenceUrl: asString(data.evidenceUrl),
        statementAttachmentPaths: Array.isArray(data.statementAttachmentPaths) ? data.statementAttachmentPaths.map(asString).filter(Boolean) : [],
        receiptAttachmentPaths: Array.isArray(data.receiptAttachmentPaths) ? data.receiptAttachmentPaths.map(asString).filter(Boolean) : [],
        status: asString(data.status),
    };
};

const toAssignment = (doc: FirebaseFirestore.QueryDocumentSnapshot): CardExpenseAuditAssignmentInput => {
    const data = doc.data();
    return {
        id: doc.id,
        cardId: asString(data.cardId),
        assigneeName: asString(data.assigneeName) || '배정자 미확인',
        startDate: asString(data.startDate),
        endDate: asString(data.endDate) || undefined,
    };
};

const loadPolicy = async (): Promise<CardExpenseAuditPolicy> => {
    const snap = await admin.firestore().collection(COLLECTIONS.policies).doc('default').get();
    return normalizeCardExpenseAuditPolicy(snap.data());
};

const writeInChunks = async (
    writes: Array<{ ref: FirebaseFirestore.DocumentReference; data: Record<string, unknown> }>,
): Promise<void> => {
    for (let index = 0; index < writes.length; index += 400) {
        const batch = admin.firestore().batch();
        writes.slice(index, index + 400).forEach((write) => batch.set(write.ref, write.data, { merge: true }));
        await batch.commit();
    }
};

export const runCardExpenseAudit = functions
    .runWith({ timeoutSeconds: 540, memory: '1GB', maxInstances: 2 })
    .region('asia-northeast3')
    .https.onCall(async (data, context) => {
        const actor = await requireCardExpenseAuditAccess(context);
        const yearMonth = parseYearMonth(data?.yearMonth);
        const db = admin.firestore();
        const policy = await loadPolicy();
        const useGemini = data?.useGemini !== false && policy.geminiEnabled;
        const runRef = db.collection(COLLECTIONS.runs).doc();
        const now = admin.firestore.Timestamp.now();

        await runRef.set({
            id: runRef.id,
            yearMonth,
            status: 'RUNNING',
            useGemini,
            policySnapshot: policy,
            actor,
            createdAt: now,
            updatedAt: now,
        });

        try {
            const historyFrom = addMonths(yearMonth, -6);
            const [currentSnap, historySnap, assignmentsSnap, existingFindingsSnap] = await Promise.all([
                db.collection(COLLECTIONS.transactions).where('yearMonth', '==', yearMonth).get(),
                db.collection(COLLECTIONS.transactions)
                    .where('yearMonth', '>=', historyFrom)
                    .where('yearMonth', '<', yearMonth)
                    .get(),
                db.collection(COLLECTIONS.assignments).get(),
                db.collection(COLLECTIONS.findings).where('yearMonth', '==', yearMonth).get(),
            ]);
            const transactions = currentSnap.docs.map(toTransaction);
            const historicalTransactions = historySnap.docs.map(toTransaction);
            const assignments = assignmentsSnap.docs.map(toAssignment);
            let findings = evaluateCardExpenseTransactions({
                yearMonth,
                transactions,
                historicalTransactions,
                assignments,
                policy,
            });

            let geminiModel = '';
            let geminiStatus: 'SKIPPED' | 'COMPLETED' | 'FAILED' = 'SKIPPED';
            let geminiError = '';
            let geminiExecutiveSummary = '';
            let geminiPriorityActions: string[] = [];
            if (useGemini) {
                const candidates = findings
                    .filter((finding) => finding.deterministicScore >= policy.geminiMinimumScore)
                    .sort((left, right) => right.deterministicScore - left.deterministicScore)
                    .slice(0, policy.geminiMaximumTransactions);
                if (candidates.length > 0) {
                    try {
                        const result = await callGeminiExpenseAudit(candidates);
                        geminiModel = result.model;
                        geminiExecutiveSummary = result.executiveSummary;
                        geminiPriorityActions = result.priorityActions;
                        const reviewByTransactionId = new Map(result.reviews.map((review) => [review.transactionId, review]));
                        findings = findings.map((finding) => {
                            const review = reviewByTransactionId.get(finding.transactionId);
                            if (!review) return finding;
                            const riskScore = clamp(finding.deterministicScore + review.scoreAdjustment, 0, 100);
                            return {
                                ...finding,
                                riskScore,
                                severity: severityForScore(riskScore),
                                gemini: review,
                            } as CardExpenseAuditFindingDraft;
                        });
                        geminiStatus = 'COMPLETED';
                    } catch (error) {
                        geminiStatus = 'FAILED';
                        geminiError = error instanceof Error ? error.message : asString(error);
                        functions.logger.warn('Gemini card expense audit enrichment failed', { yearMonth, error: geminiError });
                    }
                }
            }

            const existingByTransactionId = new Map(existingFindingsSnap.docs.map((doc) => [asString(doc.data().transactionId), doc.data()]));
            const findingIds = new Set(findings.map((finding) => `${yearMonth}__${finding.transactionId}`));
            const writes: Array<{
                ref: FirebaseFirestore.DocumentReference;
                data: Record<string, unknown>;
            }> = findings.map((finding) => {
                const id = `${yearMonth}__${finding.transactionId}`;
                const existing = existingByTransactionId.get(finding.transactionId) || {};
                const preserveReview = asString(existing.detectionHash) === finding.detectionHash
                    && asString(existing.reviewStatus)
                    && asString(existing.reviewStatus) !== 'OPEN';
                return {
                    ref: db.collection(COLLECTIONS.findings).doc(id),
                    data: {
                        id,
                        runId: runRef.id,
                        ...finding,
                        cleared: false,
                        clearedAt: null,
                        reviewStatus: preserveReview ? existing.reviewStatus : 'OPEN',
                        reviewNote: preserveReview ? asString(existing.reviewNote) : '',
                        reviewedAt: preserveReview ? existing.reviewedAt || null : null,
                        reviewedBy: preserveReview ? existing.reviewedBy || null : null,
                        updatedAt: admin.firestore.Timestamp.now(),
                        createdAt: existing.createdAt || admin.firestore.Timestamp.now(),
                    },
                };
            });
            existingFindingsSnap.docs.forEach((doc) => {
                if (findingIds.has(doc.id)) return;
                writes.push({
                    ref: doc.ref,
                    data: {
                        runId: runRef.id,
                        cleared: true,
                        clearedAt: admin.firestore.Timestamp.now(),
                        updatedAt: admin.firestore.Timestamp.now(),
                    },
                });
            });
            await writeInChunks(writes);

            const activeFindings = findings.filter((finding) => !((finding as any).cleared));
            const severityCounts = activeFindings.reduce<Record<string, number>>((counts, finding) => {
                counts[finding.severity] = (counts[finding.severity] || 0) + 1;
                return counts;
            }, { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 });
            const completedAt = admin.firestore.Timestamp.now();
            const summary = {
                totalTransactions: transactions.length,
                findingCount: activeFindings.length,
                openAmount: activeFindings.reduce((sum, finding) => sum + Math.max(0, finding.amount), 0),
                severityCounts,
                missingReceiptCount: activeFindings.filter((finding) => finding.ruleHits.some((hit) => hit.code === 'MISSING_RECEIPT')).length,
                duplicateCount: activeFindings.filter((finding) => finding.ruleHits.some((hit) => hit.code === 'DUPLICATE_TRANSACTION')).length,
                assignmentMismatchCount: activeFindings.filter((finding) => finding.ruleHits.some((hit) => hit.code === 'ASSIGNMENT_MISMATCH')).length,
            };
            await runRef.set({
                status: 'COMPLETED',
                summary,
                geminiStatus,
                geminiModel,
                geminiError,
                geminiExecutiveSummary,
                geminiPriorityActions,
                completedAt,
                updatedAt: completedAt,
            }, { merge: true });

            return { ok: true, runId: runRef.id, yearMonth, summary, geminiStatus, geminiModel, geminiError };
        } catch (error) {
            const message = error instanceof Error ? error.message : asString(error);
            await runRef.set({
                status: 'FAILED',
                errorMessage: message.slice(0, 2000),
                updatedAt: admin.firestore.Timestamp.now(),
            }, { merge: true });
            if (error instanceof functions.https.HttpsError) throw error;
            throw new functions.https.HttpsError('internal', message || '카드감사 실행에 실패했습니다.');
        }
    });

export const getCardExpenseAuditDashboard = functions
    .runWith({ timeoutSeconds: 60, memory: '512MB', maxInstances: 10 })
    .region('asia-northeast3')
    .https.onCall(async (data, context) => {
        await requireCardExpenseAuditAccess(context);
        const yearMonth = parseYearMonth(data?.yearMonth);
        const db = admin.firestore();
        const [policy, runsSnap, findingsSnap] = await Promise.all([
            loadPolicy(),
            db.collection(COLLECTIONS.runs).where('yearMonth', '==', yearMonth).get(),
            db.collection(COLLECTIONS.findings).where('yearMonth', '==', yearMonth).get(),
        ]);
        const runs = runsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
            .sort((left: any, right: any) => asNumber(right.createdAt?.toMillis?.()) - asNumber(left.createdAt?.toMillis?.()));
        const findings = findingsSnap.docs
            .map((doc) => ({ id: doc.id, ...doc.data() }))
            .filter((finding: any) => finding.cleared !== true)
            .sort((left: any, right: any) => asNumber(right.riskScore) - asNumber(left.riskScore));
        return {
            ok: true,
            yearMonth,
            policy,
            latestRun: runs[0] || null,
            findings,
        };
    });

export const reviewCardExpenseAuditFinding = functions
    .runWith({ timeoutSeconds: 30, memory: '256MB', maxInstances: 10 })
    .region('asia-northeast3')
    .https.onCall(async (data, context) => {
        const actor = await requireCardExpenseAuditAccess(context);
        const findingId = asString(data?.findingId);
        const reviewStatus = asString(data?.reviewStatus) as CardExpenseAuditReviewStatus;
        const reviewNote = asString(data?.reviewNote).slice(0, 1000);
        const allowedStatuses: CardExpenseAuditReviewStatus[] = ['OPEN', 'NORMAL', 'NEEDS_EVIDENCE', 'EXCEPTION', 'ACKNOWLEDGED'];
        if (!findingId || !allowedStatuses.includes(reviewStatus)) {
            throw new functions.https.HttpsError('invalid-argument', '감사 결과와 처리상태를 확인해 주세요.');
        }

        const db = admin.firestore();
        const findingRef = db.collection(COLLECTIONS.findings).doc(findingId);
        const logRef = db.collection(COLLECTIONS.reviewLogs).doc();
        await db.runTransaction(async (transaction) => {
            const snap = await transaction.get(findingRef);
            if (!snap.exists || snap.data()?.cleared === true) {
                throw new functions.https.HttpsError('not-found', '감사 결과를 찾을 수 없습니다.');
            }
            const previousStatus = asString(snap.data()?.reviewStatus) || 'OPEN';
            const reviewedAt = admin.firestore.Timestamp.now();
            transaction.set(findingRef, {
                reviewStatus,
                reviewNote,
                reviewedAt,
                reviewedBy: actor,
                updatedAt: reviewedAt,
            }, { merge: true });
            transaction.set(logRef, {
                id: logRef.id,
                findingId,
                transactionId: asString(snap.data()?.transactionId),
                yearMonth: asString(snap.data()?.yearMonth),
                previousStatus,
                reviewStatus,
                reviewNote,
                actor,
                createdAt: reviewedAt,
            });
        });
        return { ok: true, findingId, reviewStatus };
    });

export const saveCardExpenseAuditPolicy = functions
    .runWith({ timeoutSeconds: 30, memory: '256MB', maxInstances: 5 })
    .region('asia-northeast3')
    .https.onCall(async (data, context) => {
        const actor = await requireCardExpenseAuditAccess(context);
        const policy = normalizeCardExpenseAuditPolicy(data?.policy);
        const now = admin.firestore.Timestamp.now();
        await admin.firestore().collection(COLLECTIONS.policies).doc('default').set({
            ...policy,
            updatedAt: now,
            updatedBy: actor,
        }, { merge: true });
        return { ok: true, policy };
    });
