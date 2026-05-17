"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.playWelfarePointGame = exports.saveWelfareGameConfig = exports.getWelfareGameConfig = exports.seedWelfareAssetMasters = exports.saveWelfareAdminPermissions = exports.deleteWelfareCategory = exports.upsertWelfareCategory = exports.createWelfareLedgerTransaction = void 0;
const crypto = require("crypto");
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const auth_1 = require("../auth");
const db = admin.firestore();
const fieldValue = admin.firestore.FieldValue;
const assetKinds = ['cash', 'point'];
const OCEAN_REEL_ALGORITHM_VERSION = 'ocean-reel-v3-cumulative-probability';
const POINT_ROULETTE_ALGORITHM_VERSION = 'point-roulette-v1-configurable-probability';
const DEFAULT_CATEGORIES = [
    { id: 'birthday', name: '생일 축하', assetKind: 'point', source: 'manual_adjustment', direction: 'credit', active: true, expiresAfterDays: 365 },
    { id: 'top-performer', name: '우수 사원', assetKind: 'both', source: 'manual_adjustment', direction: 'credit', active: true, approvalRequired: true },
    { id: 'store', name: '사내 매점 이용', assetKind: 'point', source: 'store_purchase', direction: 'debit', active: true },
    { id: 'payroll-sync', name: '급여 정산 연동', assetKind: 'cash', source: 'payroll_sync', direction: 'both', active: true },
    { id: 'cash-credit', name: '캐시/크레딧 수동 조정', assetKind: 'cash', source: 'manual_adjustment', direction: 'both', active: true },
    { id: 'point-adjustment', name: '포인트 수동 조정', assetKind: 'point', source: 'manual_adjustment', direction: 'both', active: true, expiresAfterDays: 365 },
    { id: 'expiry', name: '포인트 소멸', assetKind: 'point', source: 'point_expiry', direction: 'debit', active: true },
];
const DEFAULT_ADMIN_PERMISSIONS = [
    {
        id: 'viewer',
        grade: 'viewer',
        label: '조회자',
        roleAliases: ['viewer', 'user', '일반'],
        ledger: true,
        adjustCash: false,
        adjustPoint: false,
        game: false,
        bulk: false,
        categories: false,
        permissions: false,
        active: true,
    },
    {
        id: 'operator',
        grade: 'operator',
        label: '운영자',
        roleAliases: ['operator', 'manager', '매니저', '운영자'],
        ledger: true,
        adjustCash: false,
        adjustPoint: true,
        game: true,
        bulk: false,
        categories: false,
        permissions: false,
        active: true,
    },
    {
        id: 'asset_manager',
        grade: 'asset_manager',
        label: '자산 관리자',
        roleAliases: ['asset_manager', '자산관리자', '자산 관리자', '정산관리자', '정산 관리자'],
        ledger: true,
        adjustCash: true,
        adjustPoint: true,
        game: true,
        bulk: true,
        categories: true,
        permissions: false,
        active: true,
    },
    {
        id: 'super_admin',
        grade: 'super_admin',
        label: '최고 관리자',
        roleAliases: ['super_admin', 'admin', 'administrator', 'owner', '관리자', '사장', '실장'],
        ledger: true,
        adjustCash: true,
        adjustPoint: true,
        game: true,
        bulk: true,
        categories: true,
        permissions: true,
        active: true,
    },
];
const ADMIN_GRADE_ORDER = {
    viewer: 10,
    operator: 20,
    asset_manager: 30,
    super_admin: 40,
};
const toIntegerAmount = (value) => {
    const parsed = typeof value === 'number' ? value : Number(String(value ?? '').replace(/,/g, ''));
    if (!Number.isFinite(parsed))
        return 0;
    return Math.trunc(parsed);
};
const cleanText = (value, fallback = '') => String(value ?? fallback).trim();
const createId = (prefix) => `${prefix}_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
const stripUndefined = (value) => {
    if (Array.isArray(value)) {
        return value.map(stripUndefined);
    }
    if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
        return Object.entries(value).reduce((acc, [key, nestedValue]) => {
            if (nestedValue !== undefined) {
                acc[key] = stripUndefined(nestedValue);
            }
            return acc;
        }, {});
    }
    return value;
};
const normalizeDocId = (value) => value.replace(/\//g, ':').slice(0, 1400);
const normalizeComparable = (value) => cleanText(value).toLowerCase().replace(/\s+/g, '');
const normalizeRoleValues = (values) => Array.from(new Set(values
    .flatMap((value) => Array.isArray(value) ? value : [value])
    .map((value) => cleanText(value))
    .filter(Boolean)));
const normalizePermission = (raw, fallback) => ({
    id: cleanText(raw.id || raw.grade || fallback.id, fallback.id),
    grade: cleanText(raw.grade || raw.id || fallback.grade, fallback.grade),
    label: cleanText(raw.label, fallback.label),
    roleAliases: normalizeRoleValues(raw.roleAliases || fallback.roleAliases),
    ledger: raw.ledger ?? fallback.ledger,
    adjustCash: raw.adjustCash ?? fallback.adjustCash,
    adjustPoint: raw.adjustPoint ?? fallback.adjustPoint,
    game: raw.game ?? fallback.game,
    bulk: raw.bulk ?? fallback.bulk,
    categories: raw.categories ?? fallback.categories,
    permissions: raw.permissions ?? fallback.permissions,
    active: raw.active ?? fallback.active,
});
const getSuperAdminAccess = () => ({
    ...DEFAULT_ADMIN_PERMISSIONS.find((row) => row.id === 'super_admin'),
});
const isBuiltInSuperAdminRole = (value) => {
    const normalized = normalizeComparable(value);
    return ['admin', 'super_admin', 'administrator', 'owner', '관리자', '사장', '실장'].includes(normalized);
};
const loadAdminPermissions = async () => {
    const snapshot = await db.collection('welfare_admin_permissions').get();
    if (snapshot.empty)
        return DEFAULT_ADMIN_PERMISSIONS;
    const defaultsById = new Map(DEFAULT_ADMIN_PERMISSIONS.map((row) => [row.id, row]));
    return snapshot.docs.map((doc) => {
        const data = doc.data();
        const id = cleanText(data.id || data.grade || doc.id, doc.id);
        const fallback = defaultsById.get(id) || DEFAULT_ADMIN_PERMISSIONS[0];
        return normalizePermission({ ...data, id }, fallback);
    });
};
const resolveWelfareAdminAccess = async (auth) => {
    const actorId = auth?.uid;
    if (!actorId) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication is required.');
    }
    const userSnap = await db.collection('users').doc(actorId).get();
    const userData = userSnap.exists ? userSnap.data() || {} : {};
    const actorRoles = normalizeRoleValues([
        userData.role,
        userData.position,
        userData.additionalPositions,
        auth.token?.role,
        auth.token?.email,
    ]);
    if (actorRoles.some(isBuiltInSuperAdminRole)) {
        return getSuperAdminAccess();
    }
    const actorRoleSet = new Set(actorRoles.map(normalizeComparable));
    const permissions = await loadAdminPermissions();
    const matched = permissions
        .filter((row) => row.active !== false)
        .find((row) => {
        const aliases = normalizeRoleValues([row.id, row.grade, row.label, row.roleAliases]);
        return aliases.some((alias) => actorRoleSet.has(normalizeComparable(alias)));
    });
    return matched || DEFAULT_ADMIN_PERMISSIONS.find((row) => row.id === 'viewer');
};
const requireAccess = (access, key, message) => {
    if (!access[key]) {
        throw new functions.https.HttpsError('permission-denied', message);
    }
};
const getKoreanBusinessDate = () => {
    const now = new Date();
    const koreanTime = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    return koreanTime.toISOString().slice(0, 10);
};
const getActorName = (auth) => {
    const token = auth?.token;
    return cleanText(token?.name || token?.email || auth?.uid, 'system');
};
const writeAuditLog = (action, auth, targetId, targetName, details = {}) => db.collection('welfare_audit_logs').doc(createId('wal')).set({
    action,
    actorId: auth?.uid || 'system',
    actorName: getActorName(auth),
    targetId,
    targetName,
    createdAt: fieldValue.serverTimestamp(),
    details,
});
const normalizePostings = (raw) => {
    if (!Array.isArray(raw))
        return [];
    return raw.map((posting) => {
        const normalized = {
            accountId: cleanText(posting?.accountId),
            accountName: cleanText(posting?.accountName),
            accountScope: cleanText(posting?.accountScope, 'system'),
            assetKind: cleanText(posting?.assetKind, 'point'),
            amount: toIntegerAmount(posting?.amount),
        };
        const userId = cleanText(posting?.userId);
        const userName = cleanText(posting?.userName);
        const memo = cleanText(posting?.memo);
        if (userId)
            normalized.userId = userId;
        if (userName)
            normalized.userName = userName;
        if (memo)
            normalized.memo = memo;
        return normalized;
    });
};
const validateLedgerInput = (input) => {
    if (!cleanText(input.title)) {
        throw new functions.https.HttpsError('invalid-argument', 'title is required.');
    }
    if (!cleanText(input.categoryName)) {
        throw new functions.https.HttpsError('invalid-argument', 'categoryName is required.');
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanText(input.businessDate))) {
        throw new functions.https.HttpsError('invalid-argument', 'businessDate must be YYYY-MM-DD.');
    }
    const postings = normalizePostings(input.postings);
    if (postings.length < 2) {
        throw new functions.https.HttpsError('invalid-argument', 'At least two postings are required.');
    }
    const totals = assetKinds.reduce((acc, assetKind) => {
        acc[assetKind] = 0;
        return acc;
    }, {});
    postings.forEach((posting, index) => {
        if (!posting.accountId) {
            throw new functions.https.HttpsError('invalid-argument', `posting[${index}].accountId is required.`);
        }
        if (!posting.accountName) {
            throw new functions.https.HttpsError('invalid-argument', `posting[${index}].accountName is required.`);
        }
        if (!assetKinds.includes(posting.assetKind)) {
            throw new functions.https.HttpsError('invalid-argument', `posting[${index}].assetKind is invalid.`);
        }
        if (posting.amount === 0) {
            throw new functions.https.HttpsError('invalid-argument', `posting[${index}].amount must not be zero.`);
        }
        totals[posting.assetKind] += posting.amount;
    });
    const unbalancedAsset = assetKinds.find((assetKind) => totals[assetKind] !== 0);
    if (unbalancedAsset) {
        throw new functions.https.HttpsError('failed-precondition', `Double-entry validation failed. ${unbalancedAsset} total is ${totals[unbalancedAsset]}.`);
    }
    return postings;
};
const assertLedgerAccess = (input, postings, access) => {
    if (input.source === 'game_play')
        return;
    requireAccess(access, 'ledger', 'Ledger access is required.');
    if (input.source === 'bulk_action') {
        requireAccess(access, 'bulk', 'Bulk welfare asset permission is required.');
    }
    const userAssetKinds = new Set(postings
        .filter((posting) => posting.accountScope === 'user')
        .map((posting) => posting.assetKind));
    if (userAssetKinds.has('cash')) {
        requireAccess(access, 'adjustCash', 'Cash/credit adjustment permission is required.');
    }
    if (userAssetKinds.has('point')) {
        requireAccess(access, 'adjustPoint', 'Point adjustment permission is required.');
    }
};
const assertNoNegativeUserBalances = async (tx, postings) => {
    const userDeltas = new Map();
    postings.forEach((posting) => {
        if (posting.accountScope !== 'user')
            return;
        userDeltas.set(posting.accountId, (userDeltas.get(posting.accountId) || 0) + posting.amount);
    });
    for (const [accountId, delta] of userDeltas.entries()) {
        if (delta >= 0)
            continue;
        const snapshotRef = db.collection('welfare_account_snapshots').doc(normalizeDocId(accountId));
        const snapshot = await tx.get(snapshotRef);
        const currentBalance = toIntegerAmount(snapshot.get('balance'));
        if (currentBalance + delta < 0) {
            throw new functions.https.HttpsError('failed-precondition', `Insufficient balance for ${accountId}. Current balance is ${currentBalance}.`);
        }
    }
};
const writeLedgerTransaction = async (tx, input, auth) => {
    const postings = validateLedgerInput(input);
    const actorId = auth?.uid || 'system';
    const actorName = getActorName(auth);
    const idempotencyKey = cleanText(input.idempotencyKey);
    if (idempotencyKey) {
        const idempotencyRef = db.collection('welfare_idempotency_keys').doc(normalizeDocId(idempotencyKey));
        const existing = await tx.get(idempotencyRef);
        if (existing.exists) {
            const transactionId = cleanText(existing.get('transactionId'));
            if (transactionId)
                return { transactionId, reused: true };
        }
    }
    await assertNoNegativeUserBalances(tx, postings);
    const sanitizedPostings = stripUndefined(postings);
    const sanitizedMetadata = stripUndefined(input.metadata || {});
    const transactionId = createId('wlt');
    const ledgerRef = db.collection('welfare_ledger_transactions').doc(transactionId);
    const participantUserIds = Array.from(new Set(postings.map((posting) => posting.userId).filter(Boolean)));
    const now = fieldValue.serverTimestamp();
    tx.set(ledgerRef, {
        id: transactionId,
        title: cleanText(input.title),
        categoryId: cleanText(input.categoryId, 'uncategorized'),
        categoryName: cleanText(input.categoryName),
        source: cleanText(input.source, 'manual_adjustment'),
        status: 'posted',
        businessDate: cleanText(input.businessDate),
        transactionAt: now,
        postings: sanitizedPostings,
        participantUserIds,
        idempotencyKey: idempotencyKey || null,
        createdBy: actorId,
        createdByName: actorName,
        createdAt: now,
        updatedAt: now,
        metadata: sanitizedMetadata,
    });
    postings.forEach((posting) => {
        const accountId = normalizeDocId(posting.accountId);
        const snapshotRef = db.collection('welfare_account_snapshots').doc(accountId);
        tx.set(snapshotRef, {
            id: accountId,
            accountName: posting.accountName,
            accountScope: posting.accountScope,
            assetKind: posting.assetKind,
            userId: posting.userId || null,
            userName: posting.userName || null,
            balance: fieldValue.increment(posting.amount),
            ledgerCount: fieldValue.increment(1),
            updatedAt: now,
        }, { merge: true });
    });
    tx.set(db.collection('welfare_audit_logs').doc(createId('wal')), {
        action: 'CREATE_LEDGER_TRANSACTION',
        actorId,
        actorName,
        targetId: transactionId,
        targetName: cleanText(input.title),
        createdAt: now,
        details: {
            source: input.source,
            categoryName: input.categoryName,
            postingCount: postings.length,
            businessDate: input.businessDate,
        },
    });
    if (idempotencyKey) {
        tx.set(db.collection('welfare_idempotency_keys').doc(normalizeDocId(idempotencyKey)), {
            transactionId,
            createdAt: now,
            actorId,
        });
    }
    return { transactionId };
};
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const defaultOceanReelStages = [
    { stage: 1, symbol: '해파리', minMultiplier: 5, maxMultiplier: 5, oddsDenominator: 10 },
    { stage: 2, symbol: '물고기', minMultiplier: 10, maxMultiplier: 10, oddsDenominator: 100 },
    { stage: 3, symbol: '상어', minMultiplier: 30, maxMultiplier: 50, oddsDenominator: 1000 },
    { stage: 4, symbol: '고래', minMultiplier: 100, maxMultiplier: 1000, oddsDenominator: 10000 },
];
const defaultOceanReelMissPatterns = [
    { pattern: '1-2-3', stages: [1, 2, 3], weight: 18 },
    { pattern: '2-3-1', stages: [2, 3, 1], weight: 16 },
    { pattern: '4-2-1', stages: [4, 2, 1], weight: 12 },
    { pattern: '1-3-4', stages: [1, 3, 4], weight: 12 },
    { pattern: '3-1-2', stages: [3, 1, 2], weight: 12 },
    { pattern: '2-4-3', stages: [2, 4, 3], weight: 10 },
    { pattern: '4-1-3', stages: [4, 1, 3], weight: 8 },
    { pattern: '3-2-4', stages: [3, 2, 4], weight: 6 },
    { pattern: '1-4-2', stages: [1, 4, 2], weight: 4 },
    { pattern: '4-3-2', stages: [4, 3, 2], weight: 2 },
];
const defaultPointRouletteSegments = [
    { id: 'miss-1', label: 'MISS', subLabel: '다음 기회', multiplier: 0, probability: 0.27, color: '#1e293b' },
    { id: 'base-1', label: '원금', subLabel: '원금 보전', multiplier: 1, probability: 0.15, color: '#0891b2' },
    { id: 'bonus', label: '2배', subLabel: '2배', multiplier: 2, probability: 0.12, color: '#16a34a' },
    { id: 'miss-2', label: 'MISS', subLabel: '다음 기회', multiplier: 0, probability: 0.27, color: '#334155' },
    { id: 'jackpot', label: '5배', subLabel: '5배', multiplier: 5, probability: 0.04, color: '#f59e0b' },
    { id: 'base-2', label: '원금', subLabel: '원금 보전', multiplier: 1, probability: 0.15, color: '#2563eb' },
];
const defaultGameRules = {
    'point-roulette': { stake: 100, dailyLimit: 3 },
    'ocean-reel': { stake: 100, dailyLimit: 0 },
};
const clampInteger = (value, fallback, min, max) => {
    const parsed = toIntegerAmount(value);
    if (!Number.isFinite(parsed))
        return fallback;
    return Math.min(Math.max(parsed || fallback, min), max);
};
const clampIntegerIncludingZero = (value, fallback, min, max) => {
    if (value === undefined || value === null || String(value).trim() === '')
        return fallback;
    const parsed = toIntegerAmount(value);
    if (!Number.isFinite(parsed))
        return fallback;
    return Math.min(Math.max(parsed, min), max);
};
const normalizeGameStake = (gameId, rawConfig) => (clampInteger(rawConfig?.stake, defaultGameRules[gameId]?.stake || 100, 1, 1000000));
const normalizeGameDailyLimit = (gameId, rawConfig) => (clampIntegerIncludingZero(rawConfig?.dailyLimit, defaultGameRules[gameId]?.dailyLimit || 0, 0, 10000));
const normalizeProbability = (value, fallback) => {
    if (value === undefined || value === null || String(value).trim() === '')
        return fallback;
    const parsed = typeof value === 'number'
        ? value
        : Number(String(value ?? '').replace(/[%\s,]/g, ''));
    if (!Number.isFinite(parsed))
        return fallback;
    const probability = parsed > 1 ? parsed / 100 : parsed;
    return Math.min(Math.max(probability, 0), 1);
};
const normalizeOceanReelStages = (rawStages) => {
    const rows = Array.isArray(rawStages) ? rawStages : [];
    return defaultOceanReelStages.map((fallback) => {
        const raw = rows.find((item) => toIntegerAmount(item?.stage) === fallback.stage);
        const minMultiplier = clampInteger(raw?.minMultiplier, fallback.minMultiplier, 1, 10000);
        const maxMultiplier = clampInteger(raw?.maxMultiplier, fallback.maxMultiplier, 1, 10000);
        return {
            stage: fallback.stage,
            symbol: fallback.symbol,
            minMultiplier: Math.min(minMultiplier, maxMultiplier),
            maxMultiplier: Math.max(minMultiplier, maxMultiplier),
            oddsDenominator: clampInteger(raw?.oddsDenominator, fallback.oddsDenominator, 1, 10000000),
        };
    });
};
const normalizeOceanReelMissPatterns = (rawPatterns) => {
    const rows = Array.isArray(rawPatterns) ? rawPatterns : [];
    const patterns = defaultOceanReelMissPatterns.map((fallback) => {
        const raw = rows.find((item) => cleanText(item?.pattern) === fallback.pattern);
        return {
            ...fallback,
            weight: clampInteger(raw?.weight, fallback.weight, 0, 1000000),
        };
    });
    const totalWeight = patterns.reduce((sum, pattern) => sum + pattern.weight, 0);
    return totalWeight > 0 ? patterns : defaultOceanReelMissPatterns;
};
const normalizePointRouletteSegments = (rawSegments) => {
    const rows = Array.isArray(rawSegments) ? rawSegments : [];
    return defaultPointRouletteSegments.map((fallback) => {
        const raw = rows.find((item) => cleanText(item?.id) === fallback.id);
        return {
            id: fallback.id,
            label: cleanText(raw?.label, fallback.label),
            subLabel: cleanText(raw?.subLabel, fallback.subLabel),
            color: cleanText(raw?.color, fallback.color || ''),
            multiplier: clampIntegerIncludingZero(raw?.multiplier, fallback.multiplier, 0, 10000),
            probability: normalizeProbability(raw?.probability ?? raw?.probabilityPercent, fallback.probability),
        };
    });
};
const calculateOceanExpectedReturnRate = (stages) => (stages.reduce((sum, stage) => {
    const averageMultiplier = (stage.minMultiplier + stage.maxMultiplier) / 2;
    return sum + (averageMultiplier / Math.max(stage.oddsDenominator, 1));
}, 0));
const calculateOceanHitRate = (stages) => (stages.reduce((sum, stage) => sum + (1 / Math.max(stage.oddsDenominator, 1)), 0));
const calculatePointRouletteExpectedReturnRate = (segments) => (segments.reduce((sum, segment) => sum + (segment.probability * segment.multiplier), 0));
const calculatePointRouletteHitRate = (segments) => (segments.reduce((sum, segment) => sum + (segment.multiplier > 0 ? segment.probability : 0), 0));
const buildOceanReelRuntimeConfig = (rawConfig) => {
    const stages = normalizeOceanReelStages(rawConfig?.oceanReelStages);
    const missPatterns = normalizeOceanReelMissPatterns(rawConfig?.oceanReelMissPatterns);
    const hitRate = calculateOceanHitRate(stages);
    return {
        stages,
        missPatterns,
        hitRate,
        missRate: Math.max(0, 1 - hitRate),
        expectedReturnRate: calculateOceanExpectedReturnRate(stages),
    };
};
const buildPointRouletteRuntimeConfig = (rawConfig) => {
    const segments = normalizePointRouletteSegments(rawConfig?.pointRouletteSegments);
    const hitRate = calculatePointRouletteHitRate(segments);
    return {
        segments,
        hitRate,
        missRate: Math.max(0, 1 - hitRate),
        expectedReturnRate: calculatePointRouletteExpectedReturnRate(segments),
    };
};
const assertOceanReelRuntimeConfig = (runtime) => {
    if (runtime.hitRate >= 1) {
        throw new functions.https.HttpsError('invalid-argument', 'Ocean reel hit probability must be below 100%. Increase one or more odds denominators.');
    }
    if (runtime.missPatterns.reduce((sum, pattern) => sum + pattern.weight, 0) <= 0) {
        throw new functions.https.HttpsError('invalid-argument', 'At least one miss pattern weight must be greater than 0.');
    }
};
const assertPointRouletteRuntimeConfig = (runtime) => {
    const probabilityTotal = runtime.segments.reduce((sum, segment) => sum + segment.probability, 0);
    if (runtime.segments.length === 0 || probabilityTotal <= 0) {
        throw new functions.https.HttpsError('invalid-argument', 'At least one roulette segment probability must be greater than 0.');
    }
    if (Math.abs(probabilityTotal - 1) > 0.0001) {
        throw new functions.https.HttpsError('invalid-argument', 'Point roulette probabilities must add up to 100%.');
    }
};
const buildOceanReelConfigResponse = (gameId, rawConfig) => {
    const runtime = buildOceanReelRuntimeConfig(rawConfig);
    return {
        gameId,
        type: 'ocean_reel',
        algorithmVersion: OCEAN_REEL_ALGORITHM_VERSION,
        stake: normalizeGameStake(gameId, rawConfig),
        dailyLimit: normalizeGameDailyLimit(gameId, rawConfig),
        oceanReelStages: runtime.stages,
        oceanReelMissPatterns: runtime.missPatterns,
        expectedReturnRate: runtime.expectedReturnRate,
        hitRate: runtime.hitRate,
        missRate: runtime.missRate,
    };
};
const buildPointRouletteConfigResponse = (gameId, rawConfig) => {
    const runtime = buildPointRouletteRuntimeConfig(rawConfig);
    return {
        gameId,
        type: 'roulette',
        algorithmVersion: POINT_ROULETTE_ALGORITHM_VERSION,
        stake: normalizeGameStake(gameId, rawConfig),
        dailyLimit: normalizeGameDailyLimit(gameId, rawConfig),
        pointRouletteSegments: runtime.segments,
        expectedReturnRate: runtime.expectedReturnRate,
        hitRate: runtime.hitRate,
        missRate: runtime.missRate,
    };
};
const readWelfareGameRuntimeConfig = async (gameId) => {
    const snap = await db.collection('welfare_game_configs').doc(normalizeDocId(gameId)).get();
    const data = snap.exists ? snap.data() || {} : null;
    if (gameId === 'ocean-reel')
        return buildOceanReelConfigResponse(gameId, data);
    if (gameId === 'point-roulette')
        return buildPointRouletteConfigResponse(gameId, data);
    return null;
};
const pickStageMultiplier = (stage) => (stage.minMultiplier === stage.maxMultiplier
    ? stage.minMultiplier
    : randomInt(stage.minMultiplier, stage.maxMultiplier));
const pickMissPattern = (patterns) => {
    const totalWeight = patterns.reduce((sum, pattern) => sum + pattern.weight, 0);
    if (totalWeight <= 0)
        return defaultOceanReelMissPatterns[0];
    let ticket = randomInt(1, totalWeight);
    for (const pattern of patterns) {
        ticket -= pattern.weight;
        if (ticket <= 0)
            return pattern;
    }
    return patterns[patterns.length - 1] || defaultOceanReelMissPatterns[0];
};
const pickMissReels = (stages, patterns) => {
    const missPattern = pickMissPattern(patterns);
    const reelStops = missPattern.stages.map((stageNumber) => {
        const stage = stages.find((item) => item.stage === stageNumber) || stages[0];
        return { stage: stage.stage, symbol: stage.symbol };
    });
    return { reelStops, missPattern };
};
const pickOceanReelOutcome = (stake, config) => {
    const runtime = buildOceanReelRuntimeConfig(config);
    assertOceanReelRuntimeConfig(runtime);
    const roll = Math.random();
    let matchedStage = null;
    let cumulativeProbability = 0;
    for (const stage of runtime.stages) {
        cumulativeProbability += 1 / Math.max(stage.oddsDenominator, 1);
        if (roll < cumulativeProbability) {
            matchedStage = stage;
            break;
        }
    }
    if (matchedStage) {
        const multiplier = pickStageMultiplier(matchedStage);
        return {
            reward: stake * multiplier,
            resultLabel: `${matchedStage.symbol} 이벤트 ${multiplier}배`,
            metadata: {
                gameType: 'ocean_reel',
                algorithmVersion: OCEAN_REEL_ALGORITHM_VERSION,
                unitStake: stake,
                attempts: 1,
                hit: true,
                roll,
                oddsDenominator: matchedStage.oddsDenominator,
                probability: 1 / Math.max(matchedStage.oddsDenominator, 1),
                hitRate: runtime.hitRate,
                missRate: runtime.missRate,
                finalStage: matchedStage.stage,
                finalSymbol: matchedStage.symbol,
                multiplier,
                expectedReturnRate: runtime.expectedReturnRate,
                missPatternWeights: runtime.missPatterns,
                reelStops: [
                    { stage: matchedStage.stage, symbol: matchedStage.symbol },
                    { stage: matchedStage.stage, symbol: matchedStage.symbol },
                    { stage: matchedStage.stage, symbol: matchedStage.symbol },
                ],
                settledBy: 'event_hit',
            },
        };
    }
    const { reelStops, missPattern } = pickMissReels(runtime.stages, runtime.missPatterns);
    return {
        reward: 0,
        resultLabel: '미당첨',
        metadata: {
            gameType: 'ocean_reel',
            algorithmVersion: OCEAN_REEL_ALGORITHM_VERSION,
            unitStake: stake,
            attempts: 1,
            hit: false,
            roll,
            hitRate: runtime.hitRate,
            missRate: runtime.missRate,
            finalStage: 0,
            finalSymbol: '미당첨',
            multiplier: 0,
            expectedReturnRate: runtime.expectedReturnRate,
            missPattern: missPattern.pattern,
            missPatternWeight: missPattern.weight,
            missPatternWeights: runtime.missPatterns,
            reelStops,
            settledBy: 'miss',
        },
    };
};
const formatPointRouletteAmount = (value) => `${Math.trunc(Math.max(value, 0)).toLocaleString('ko-KR')}P`;
const formatPointRouletteMultiplier = (value) => `${Number.isFinite(value) ? Number(value.toFixed(2)) : 0}배`;
const buildPointRouletteSegmentDisplay = (segment, stake) => {
    if (segment.multiplier <= 0) {
        return {
            label: 'MISS',
            subLabel: cleanText(segment.subLabel, '다음 기회'),
        };
    }
    return {
        label: formatPointRouletteAmount(stake * segment.multiplier),
        subLabel: segment.multiplier === 1 ? '원금 보전' : formatPointRouletteMultiplier(segment.multiplier),
    };
};
const pickPointRouletteOutcome = (stake, config) => {
    const runtime = buildPointRouletteRuntimeConfig(config);
    assertPointRouletteRuntimeConfig(runtime);
    const roll = Math.random();
    let cumulativeProbability = 0;
    let selectedSegment = runtime.segments[runtime.segments.length - 1];
    let selectedIndex = runtime.segments.length - 1;
    for (let index = 0; index < runtime.segments.length; index += 1) {
        const segment = runtime.segments[index];
        cumulativeProbability += segment.probability;
        if (roll < cumulativeProbability) {
            selectedSegment = segment;
            selectedIndex = index;
            break;
        }
    }
    const reward = stake * selectedSegment.multiplier;
    const display = buildPointRouletteSegmentDisplay(selectedSegment, stake);
    return {
        reward,
        resultLabel: display.label,
        metadata: {
            gameType: 'point_roulette',
            algorithmVersion: POINT_ROULETTE_ALGORITHM_VERSION,
            unitStake: stake,
            roll,
            segmentId: selectedSegment.id,
            segmentIndex: selectedIndex,
            segmentLabel: display.label,
            segmentSubLabel: display.subLabel,
            configuredSegmentLabel: selectedSegment.label,
            configuredSegmentSubLabel: selectedSegment.subLabel,
            multiplier: selectedSegment.multiplier,
            probability: selectedSegment.probability,
            hit: selectedSegment.multiplier > 0,
            hitRate: runtime.hitRate,
            missRate: runtime.missRate,
            expectedReturnRate: runtime.expectedReturnRate,
            segments: runtime.segments.map((segment) => {
                const segmentDisplay = buildPointRouletteSegmentDisplay(segment, stake);
                return {
                    ...segment,
                    label: segmentDisplay.label,
                    subLabel: segmentDisplay.subLabel,
                    configuredLabel: segment.label,
                    configuredSubLabel: segment.subLabel,
                };
            }),
        },
    };
};
const pickGameOutcome = (gameId, stake, runtimeConfig) => {
    if (gameId === 'ocean-reel') {
        return pickOceanReelOutcome(stake, runtimeConfig);
    }
    if (gameId === 'point-roulette') {
        return pickPointRouletteOutcome(stake, runtimeConfig);
    }
    const roll = Math.random();
    if (roll < 0.04)
        return { reward: stake * 5, resultLabel: '잭팟 5배' };
    if (roll < 0.16)
        return { reward: stake * 2, resultLabel: '보너스 2배' };
    if (roll < 0.46)
        return { reward: stake, resultLabel: '원금 보전' };
    return { reward: 0, resultLabel: '다음 기회' };
};
exports.createWelfareLedgerTransaction = auth_1.protectedRegion.https.onCall(async (data, context) => {
    const auth = (0, auth_1.requireCallableAuth)(context);
    const input = data;
    const postings = validateLedgerInput(input);
    const access = await resolveWelfareAdminAccess(auth);
    assertLedgerAccess(input, postings, access);
    return db.runTransaction((tx) => writeLedgerTransaction(tx, input, auth));
});
exports.upsertWelfareCategory = auth_1.protectedRegion.https.onCall(async (data, context) => {
    const auth = (0, auth_1.requireCallableAuth)(context);
    const access = await resolveWelfareAdminAccess(auth);
    requireAccess(access, 'categories', 'Welfare category management permission is required.');
    const input = data;
    const name = cleanText(input.name);
    const assetKind = cleanText(input.assetKind, 'point');
    const source = cleanText(input.source, 'manual_adjustment');
    const direction = cleanText(input.direction, 'both');
    if (!name) {
        throw new functions.https.HttpsError('invalid-argument', 'Category name is required.');
    }
    if (!['cash', 'point', 'both'].includes(assetKind)) {
        throw new functions.https.HttpsError('invalid-argument', 'assetKind is invalid.');
    }
    if (!['credit', 'debit', 'both'].includes(direction)) {
        throw new functions.https.HttpsError('invalid-argument', 'direction is invalid.');
    }
    const categoryId = normalizeDocId(cleanText(input.id) || `cat_${crypto.randomBytes(8).toString('hex')}`);
    const now = fieldValue.serverTimestamp();
    const categoryRef = db.collection('welfare_categories').doc(categoryId);
    const existingCategory = await categoryRef.get();
    await categoryRef.set({
        id: categoryId,
        name,
        assetKind,
        source,
        direction,
        active: input.active !== false,
        expiresAfterDays: input.expiresAfterDays ? toIntegerAmount(input.expiresAfterDays) : null,
        approvalRequired: Boolean(input.approvalRequired),
        updatedAt: now,
        createdAt: existingCategory.exists ? existingCategory.get('createdAt') || now : now,
    }, { merge: true });
    await writeAuditLog('UPSERT_WELFARE_CATEGORY', auth, categoryId, name, { assetKind, source, direction });
    return { categoryId };
});
exports.deleteWelfareCategory = auth_1.protectedRegion.https.onCall(async (data, context) => {
    const auth = (0, auth_1.requireCallableAuth)(context);
    const access = await resolveWelfareAdminAccess(auth);
    requireAccess(access, 'categories', 'Welfare category management permission is required.');
    const categoryId = normalizeDocId(cleanText(data?.categoryId));
    if (!categoryId) {
        throw new functions.https.HttpsError('invalid-argument', 'categoryId is required.');
    }
    await db.collection('welfare_categories').doc(categoryId).set({
        active: false,
        updatedAt: fieldValue.serverTimestamp(),
    }, { merge: true });
    await writeAuditLog('DELETE_WELFARE_CATEGORY', auth, categoryId, categoryId);
    return { categoryId };
});
exports.saveWelfareAdminPermissions = auth_1.protectedRegion.https.onCall(async (data, context) => {
    const auth = (0, auth_1.requireCallableAuth)(context);
    const access = await resolveWelfareAdminAccess(auth);
    requireAccess(access, 'permissions', 'Welfare permission management permission is required.');
    const rows = Array.isArray(data?.permissions) ? data.permissions : [];
    if (rows.length === 0) {
        throw new functions.https.HttpsError('invalid-argument', 'permissions are required.');
    }
    const batch = db.batch();
    rows.forEach((row) => {
        const grade = cleanText(row.grade || row.id);
        const fallback = DEFAULT_ADMIN_PERMISSIONS.find((item) => item.id === grade);
        if (!fallback) {
            throw new functions.https.HttpsError('invalid-argument', `Unsupported permission grade: ${grade}`);
        }
        const normalized = normalizePermission(row, fallback);
        const ref = db.collection('welfare_admin_permissions').doc(normalized.id);
        batch.set(ref, {
            ...normalized,
            gradeOrder: ADMIN_GRADE_ORDER[normalized.grade] || 999,
            updatedAt: fieldValue.serverTimestamp(),
        }, { merge: true });
    });
    await batch.commit();
    await writeAuditLog('SAVE_WELFARE_ADMIN_PERMISSIONS', auth, 'welfare_admin_permissions', '복지 자산 권한', { count: rows.length });
    return { count: rows.length };
});
exports.seedWelfareAssetMasters = auth_1.protectedRegion.https.onCall(async (_data, context) => {
    const auth = (0, auth_1.requireCallableAuth)(context);
    const access = await resolveWelfareAdminAccess(auth);
    requireAccess(access, 'permissions', 'Welfare master seed permission is required.');
    const batch = db.batch();
    DEFAULT_CATEGORIES.forEach((category) => {
        const categoryId = normalizeDocId(cleanText(category.id) || `cat_${crypto.randomBytes(8).toString('hex')}`);
        batch.set(db.collection('welfare_categories').doc(categoryId), {
            ...category,
            id: categoryId,
            updatedAt: fieldValue.serverTimestamp(),
            createdAt: fieldValue.serverTimestamp(),
        }, { merge: true });
    });
    DEFAULT_ADMIN_PERMISSIONS.forEach((permission) => {
        batch.set(db.collection('welfare_admin_permissions').doc(permission.id), {
            ...permission,
            gradeOrder: ADMIN_GRADE_ORDER[permission.grade],
            updatedAt: fieldValue.serverTimestamp(),
        }, { merge: true });
    });
    await batch.commit();
    await writeAuditLog('SEED_WELFARE_ASSET_MASTERS', auth, 'welfare_asset_masters', '복지 자산 기본 마스터', {
        categories: DEFAULT_CATEGORIES.length,
        permissions: DEFAULT_ADMIN_PERMISSIONS.length,
    });
    return {
        categories: DEFAULT_CATEGORIES.length,
        permissions: DEFAULT_ADMIN_PERMISSIONS.length,
    };
});
exports.getWelfareGameConfig = auth_1.protectedRegion.https.onCall(async (data, context) => {
    (0, auth_1.requireCallableAuth)(context);
    const gameId = normalizeDocId(cleanText(data?.gameId, 'ocean-reel'));
    if (!gameId) {
        throw new functions.https.HttpsError('invalid-argument', 'gameId is required.');
    }
    const snap = await db.collection('welfare_game_configs').doc(gameId).get();
    const rawConfig = snap.exists ? snap.data() || {} : null;
    if (gameId === 'point-roulette') {
        return {
            config: buildPointRouletteConfigResponse(gameId, rawConfig),
        };
    }
    return {
        config: buildOceanReelConfigResponse(gameId, rawConfig),
    };
});
exports.saveWelfareGameConfig = auth_1.protectedRegion.https.onCall(async (data, context) => {
    const auth = (0, auth_1.requireCallableAuth)(context);
    const access = await resolveWelfareAdminAccess(auth);
    requireAccess(access, 'game', 'Welfare game management permission is required.');
    const gameId = normalizeDocId(cleanText(data?.gameId, 'ocean-reel'));
    const config = gameId === 'point-roulette'
        ? buildPointRouletteConfigResponse(gameId, {
            stake: data?.stake,
            dailyLimit: data?.dailyLimit,
            pointRouletteSegments: data?.pointRouletteSegments,
        })
        : buildOceanReelConfigResponse(gameId, {
            stake: data?.stake,
            dailyLimit: data?.dailyLimit,
            oceanReelStages: data?.oceanReelStages,
            oceanReelMissPatterns: data?.oceanReelMissPatterns,
        });
    if (gameId === 'point-roulette') {
        assertPointRouletteRuntimeConfig(buildPointRouletteRuntimeConfig(config));
    }
    else if (gameId === 'ocean-reel') {
        assertOceanReelRuntimeConfig(buildOceanReelRuntimeConfig(config));
    }
    else {
        throw new functions.https.HttpsError('invalid-argument', 'Unsupported game config.');
    }
    await db.collection('welfare_game_configs').doc(gameId).set({
        ...config,
        updatedAt: fieldValue.serverTimestamp(),
        updatedBy: auth.uid,
        updatedByName: getActorName(auth),
    }, { merge: true });
    await writeAuditLog('SAVE_WELFARE_GAME_CONFIG', auth, gameId, gameId === 'point-roulette' ? '포인트 룰렛' : '해양 릴게임', {
        stake: config.stake,
        dailyLimit: config.dailyLimit,
        expectedReturnRate: config.expectedReturnRate,
        oceanReelStages: config.oceanReelStages,
        oceanReelMissPatterns: config.oceanReelMissPatterns,
        pointRouletteSegments: config.pointRouletteSegments,
    });
    return { config };
});
exports.playWelfarePointGame = auth_1.protectedRegion.https.onCall(async (data, context) => {
    const auth = (0, auth_1.requireCallableAuth)(context);
    const userId = cleanText(data?.userId || auth.uid);
    if (userId !== auth.uid) {
        throw new functions.https.HttpsError('permission-denied', 'Users can only play games for their own account.');
    }
    const gameId = cleanText(data?.gameId);
    const gameName = cleanText(data?.gameName, '포인트 게임');
    const userName = cleanText(data?.userName, getActorName(auth));
    const businessDate = getKoreanBusinessDate();
    const idempotencyKey = cleanText(data?.idempotencyKey);
    if (!gameId) {
        throw new functions.https.HttpsError('invalid-argument', 'gameId is required.');
    }
    const runtimeConfig = ['ocean-reel', 'point-roulette'].includes(gameId)
        ? await readWelfareGameRuntimeConfig(gameId)
        : null;
    const requestedStake = toIntegerAmount(data?.stake);
    const requestedDailyLimit = toIntegerAmount(data?.dailyLimit);
    const stake = runtimeConfig?.stake && runtimeConfig.stake > 0 ? runtimeConfig.stake : requestedStake;
    const dailyLimit = runtimeConfig && typeof runtimeConfig.dailyLimit === 'number'
        ? Math.min(Math.max(runtimeConfig.dailyLimit, 0), 10000)
        : requestedDailyLimit > 0 ? Math.min(Math.max(requestedDailyLimit, 1), 10000) : 0;
    if (stake <= 0) {
        throw new functions.https.HttpsError('invalid-argument', 'stake must be positive.');
    }
    const outcome = pickGameOutcome(gameId, stake, runtimeConfig);
    return db.runTransaction(async (tx) => {
        if (idempotencyKey) {
            const gameIdempotencyRef = db.collection('welfare_game_idempotency_keys').doc(normalizeDocId(idempotencyKey));
            const existingGame = await tx.get(gameIdempotencyRef);
            if (existingGame.exists) {
                return {
                    gamePlayId: cleanText(existingGame.get('gamePlayId')),
                    transactionId: cleanText(existingGame.get('transactionId')),
                    reward: toIntegerAmount(existingGame.get('reward')),
                    resultLabel: cleanText(existingGame.get('resultLabel')),
                    remainingPlays: toIntegerAmount(existingGame.get('remainingPlays')),
                    metadata: existingGame.get('metadata') || {},
                    reused: true,
                };
            }
        }
        const usageRef = db.collection('welfare_game_daily_usage').doc(normalizeDocId(`${userId}:${gameId}:${businessDate}`));
        const usageSnap = await tx.get(usageRef);
        const currentCount = toIntegerAmount(usageSnap.get('count'));
        if (dailyLimit > 0 && currentCount >= dailyLimit) {
            throw new functions.https.HttpsError('resource-exhausted', 'Daily game limit reached.');
        }
        const userPointAccountId = normalizeDocId(`user:${userId}:point`);
        const accountSnap = await tx.get(db.collection('welfare_account_snapshots').doc(userPointAccountId));
        const pointBalance = toIntegerAmount(accountSnap.get('balance'));
        if (pointBalance < stake) {
            throw new functions.https.HttpsError('failed-precondition', 'Not enough point balance.');
        }
        const postings = [
            {
                accountId: userPointAccountId,
                accountName: `${userName} 포인트`,
                accountScope: 'user',
                assetKind: 'point',
                userId,
                userName,
                amount: -stake,
                memo: `${gameName} 참여`,
            },
            {
                accountId: 'game:point_pool',
                accountName: '게임 포인트 풀',
                accountScope: 'game',
                assetKind: 'point',
                amount: stake,
                memo: `${gameName} 배팅 수령`,
            },
        ];
        if (outcome.reward > 0) {
            postings.push({
                accountId: 'game:point_pool',
                accountName: '게임 포인트 풀',
                accountScope: 'game',
                assetKind: 'point',
                amount: -outcome.reward,
                memo: `${gameName} 보상 지급`,
            }, {
                accountId: userPointAccountId,
                accountName: `${userName} 포인트`,
                accountScope: 'user',
                assetKind: 'point',
                userId,
                userName,
                amount: outcome.reward,
                memo: outcome.resultLabel,
            });
        }
        const ledger = await writeLedgerTransaction(tx, {
            title: `${gameName} 참여`,
            categoryId: 'game-play',
            categoryName: gameName,
            source: 'game_play',
            businessDate,
            postings,
            idempotencyKey: idempotencyKey || undefined,
            metadata: {
                gameId,
                stake,
                reward: outcome.reward,
                resultLabel: outcome.resultLabel,
                ...(outcome.metadata || {}),
            },
        }, auth);
        const gamePlayId = createId('wgp');
        const now = fieldValue.serverTimestamp();
        tx.set(db.collection('welfare_game_plays').doc(gamePlayId), {
            id: gamePlayId,
            gameId,
            gameName,
            userId,
            userName,
            businessDate,
            stake,
            reward: outcome.reward,
            resultLabel: outcome.resultLabel,
            ledgerTransactionId: ledger.transactionId,
            metadata: outcome.metadata || {},
            createdAt: now,
        });
        tx.set(usageRef, {
            userId,
            gameId,
            businessDate,
            count: fieldValue.increment(1),
            updatedAt: now,
        }, { merge: true });
        const result = {
            gamePlayId,
            transactionId: ledger.transactionId,
            reward: outcome.reward,
            resultLabel: outcome.resultLabel,
            remainingPlays: dailyLimit > 0 ? Math.max(dailyLimit - currentCount - 1, 0) : -1,
            metadata: outcome.metadata || {},
        };
        if (idempotencyKey) {
            tx.set(db.collection('welfare_game_idempotency_keys').doc(normalizeDocId(idempotencyKey)), {
                ...result,
                createdAt: now,
                userId,
                gameId,
            });
        }
        return result;
    });
});
//# sourceMappingURL=welfareAssetLedger.js.map