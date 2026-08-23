import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';
import {
    canonicalStringify,
    classifyConstructionPlanRoleAccess,
    isConstructionPlanParticipant,
    isUnknownRecord,
    readTrimmedString,
    sha256Hex,
    type ConstructionPlanRoleAccess,
    type UnknownRecord,
} from './domain';

const PLANS_COLLECTION = 'constructionPlans';
const LOCK_REQUESTS_COLLECTION = 'constructionPlanLockRequests';
const LIFECYCLE_RECEIPTS_COLLECTION = 'constructionPlanLifecycleMutationReceipts';
const DOWNLOAD_RECEIPTS_COLLECTION = 'constructionPlanPdfDownloadReceipts';
const DOWNLOAD_GRANTS_COLLECTION = 'constructionPlanPdfDownloadGrants';
const AUDIT_COLLECTION = 'constructionPlanAuditEvents';
const MAX_ISSUED_PDF_SIZE_BYTES = 100 * 1024 * 1024;
const MAX_LOCK_REQUESTERS = 50;
const PDF_DOWNLOAD_GRANT_TTL_MS = 5 * 60_000;

const runner = functions
    .runWith({ timeoutSeconds: 60, memory: '512MB', maxInstances: 10 })
    .region('asia-northeast3');

const downloadRunner = functions
    .runWith({ timeoutSeconds: 300, memory: '1GB', maxInstances: 3 })
    .region('asia-northeast3');

interface Actor {
    uid: string;
    name?: string;
    access: ConstructionPlanRoleAccess;
}

interface ActiveEditLock {
    userId: string;
    userName: string;
    acquiredAt: string;
    expiresAt: string;
    expiresAtEpochMs: number;
}

type LifecycleAction = 'withdraw_review' | 'void' | 'archive';

const db = (): admin.firestore.Firestore => admin.firestore();
const bucket = () => admin.storage().bucket();

const record = (value: unknown): UnknownRecord => {
    if (!isUnknownRecord(value)) {
        throw new functions.https.HttpsError('invalid-argument', '요청 본문이 올바르지 않습니다.');
    }
    return value;
};

const requiredString = (value: unknown, label: string, maximum: number): string => {
    if (typeof value !== 'string' || !value.trim() || value.trim().length > maximum) {
        throw new functions.https.HttpsError('invalid-argument', `${label} 값이 올바르지 않습니다.`);
    }
    return value.trim();
};

const documentId = (value: unknown, label: string): string => {
    const parsed = requiredString(value, label, 200);
    if (parsed.includes('/') || parsed === '.' || parsed === '..') {
        throw new functions.https.HttpsError('invalid-argument', `${label} 문서 ID가 올바르지 않습니다.`);
    }
    return parsed;
};

const expectedVersion = (value: unknown): number => {
    if (!Number.isInteger(value) || Number(value) < 0) {
        throw new functions.https.HttpsError('invalid-argument', 'expectedLockVersion이 필요합니다.');
    }
    return Number(value);
};

const optionalReason = (value: unknown, maximum = 500): string | undefined => {
    if (value === undefined || value === null || value === '') return undefined;
    return requiredReason(value, maximum);
};

const requiredReason = (value: unknown, maximum = 1000): string => {
    const reason = requiredString(value, 'reason', maximum)
        .replace(/[\u0000-\u001f\u007f]/g, ' ')
        .replace(/(?:https?|ftp):\/\/\S+|gs:\/\/\S+/gi, '[링크 제거]')
        .replace(/\s+/g, ' ')
        .trim();
    if (reason.length < 5) {
        throw new functions.https.HttpsError('invalid-argument', '사유를 5자 이상 입력해주세요.');
    }
    return reason;
};

const resolveActor = async (context: functions.https.CallableContext): Promise<Actor> => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', '로그인이 필요합니다.');
    const token = isUnknownRecord(context.auth.token) ? context.auth.token : {};
    const profileSnapshot = await db().collection('users').doc(context.auth.uid).get();
    const profile = profileSnapshot.exists && isUnknownRecord(profileSnapshot.data())
        ? profileSnapshot.data() as UnknownRecord
        : {};
    const roleFields = ['role', 'position', 'systemRole', 'accountType', 'roles', 'additionalPositions', 'erpRoleGroups'];
    const roleValues = roleFields.flatMap((key) => [token[key], profile[key]]);
    return {
        uid: context.auth.uid,
        access: classifyConstructionPlanRoleAccess(roleValues),
        ...(readTrimmedString(profile, ['name', 'displayName']) || readTrimmedString(token, ['name'])
            ? { name: readTrimmedString(profile, ['name', 'displayName']) || readTrimmedString(token, ['name']) }
            : {}),
    };
};

const planData = (snapshot: admin.firestore.DocumentSnapshot): UnknownRecord => {
    if (!snapshot.exists || !isUnknownRecord(snapshot.data())) {
        throw new functions.https.HttpsError('not-found', '시공계획서를 찾을 수 없습니다.');
    }
    return snapshot.data() as UnknownRecord;
};

const currentLockVersion = (plan: UnknownRecord): number => (
    Number.isInteger(plan.lockVersion) && Number(plan.lockVersion) >= 0 ? Number(plan.lockVersion) : 0
);

const assertExpectedVersion = (plan: UnknownRecord, expected: number): void => {
    if (currentLockVersion(plan) !== expected) {
        throw new functions.https.HttpsError('aborted', '문서 또는 편집 잠금이 변경되었습니다. 새로고침 후 다시 시도해주세요.');
    }
};

const assertParticipant = (plan: UnknownRecord, actor: Actor): void => {
    if (actor.access.isAdmin || actor.access.isOffice || isConstructionPlanParticipant(plan, actor.uid)) return;
    throw new functions.https.HttpsError('permission-denied', '계획서 참여자만 이 작업을 수행할 수 있습니다.');
};

const isAuthor = (plan: UnknownRecord, uid: string): boolean => {
    if (readTrimmedString(plan, ['createdBy']) === uid) return true;
    const participants = isUnknownRecord(plan.participants) ? plan.participants : {};
    return Array.isArray(participants.authorIds) && participants.authorIds.includes(uid);
};

const activeLock = (plan: UnknownRecord, nowEpochMs: number): ActiveEditLock | undefined => {
    if (!isUnknownRecord(plan.editLock)) return undefined;
    const lock = plan.editLock;
    const userId = readTrimmedString(lock, ['userId']);
    const userName = readTrimmedString(lock, ['userName']);
    const acquiredAt = readTrimmedString(lock, ['acquiredAt']);
    const expiresAt = readTrimmedString(lock, ['expiresAt']);
    const expiresAtEpochMs = Number(lock.expiresAtEpochMs);
    if (!userId || !userName || !acquiredAt || !expiresAt
        || !Number.isFinite(expiresAtEpochMs) || expiresAtEpochMs <= nowEpochMs) return undefined;
    return { userId, userName, acquiredAt, expiresAt, expiresAtEpochMs };
};

export const constructionPlanLockFingerprint = (planId: string, lock: ActiveEditLock): string => (
    sha256Hex(canonicalStringify({ planId, userId: lock.userId, acquiredAt: lock.acquiredAt }))
);

const lockRequestRef = (planId: string, lock: ActiveEditLock): admin.firestore.DocumentReference => (
    db().collection(LOCK_REQUESTS_COLLECTION).doc(`lock-${constructionPlanLockFingerprint(planId, lock).slice(0, 40)}`)
);

const requireExactLock = (request: UnknownRecord, planId: string, plan: UnknownRecord): ActiveEditLock => {
    const lock = activeLock(plan, Date.now());
    if (!lock) throw new functions.https.HttpsError('failed-precondition', '활성 편집 잠금이 없습니다.');
    const requestedOwner = documentId(request.expectedLockUserId, 'expectedLockUserId');
    const requestedAcquiredAt = requiredString(request.expectedLockAcquiredAt, 'expectedLockAcquiredAt', 100);
    if (lock.userId !== requestedOwner || lock.acquiredAt !== requestedAcquiredAt
        || request.expectedLockFingerprint !== constructionPlanLockFingerprint(planId, lock)) {
        throw new functions.https.HttpsError('aborted', '대상 편집 잠금이 변경되었습니다.');
    }
    return lock;
};

const workflowEvent = (
    eventId: string,
    plan: UnknownRecord,
    planId: string,
    action: string,
    actor: Actor,
    timestamp: string,
    extra: UnknownRecord = {},
): UnknownRecord => ({
    id: eventId,
    planId,
    ...(readTrimmedString(plan, ['seriesId']) ? { seriesId: readTrimmedString(plan, ['seriesId']) } : {}),
    type: action,
    action,
    actorId: actor.uid,
    ...(actor.name ? { actorName: actor.name } : {}),
    at: timestamp,
    createdAt: timestamp,
    ...extra,
});

const auditEvent = (
    eventId: string,
    plan: UnknownRecord,
    planId: string,
    action: string,
    actor: Actor,
    timestamp: string,
    metadata: UnknownRecord = {},
): UnknownRecord => ({
    id: eventId,
    schemaVersion: 1,
    type: 'construction_plan_control',
    action,
    planId,
    ...(readTrimmedString(plan, ['siteId']) ? { siteId: readTrimmedString(plan, ['siteId']) } : {}),
    actorId: actor.uid,
    ...(actor.name ? { actorName: actor.name } : {}),
    timestamp,
    createdAt: timestamp,
    source: 'construction_plan_server_control',
    metadata,
});

const safeLockResponse = (lock: ActiveEditLock | undefined): UnknownRecord | undefined => lock ? {
    userId: lock.userId,
    userName: lock.userName,
    acquiredAt: lock.acquiredAt,
    expiresAt: lock.expiresAt,
    expiresAtEpochMs: lock.expiresAtEpochMs,
    fingerprint: '',
} : undefined;

const zeroCommentSummary = (value: unknown): boolean => {
    if (!isUnknownRecord(value)) return false;
    return ['totalOpen', 'totalAddressed', 'totalResolved', 'requiredOpen', 'requiredAddressed', 'requiredResolved', 'unresolvedRequired']
        .every((key) => Number.isInteger(value[key]) && Number(value[key]) === 0);
};

const loadWithdrawalBoundary = async (
    planRef: admin.firestore.DocumentReference,
    plan: UnknownRecord,
): Promise<{ packageRef: admin.firestore.DocumentReference; cycleRef: admin.firestore.DocumentReference; round: number } | undefined> => {
    if (plan.status !== 'in_review') return undefined;
    const packageId = readTrimmedString(plan, ['activeReviewPackageId']);
    const cycleId = readTrimmedString(plan, ['activeReviewCycleId']);
    const round = Number(plan.reviewRound);
    if (!packageId || !cycleId || !Number.isInteger(round) || round < 1) return undefined;
    return {
        packageRef: planRef.collection('reviewPackages').doc(packageId),
        cycleRef: planRef.collection('reviewCycles').doc(cycleId),
        round,
    };
};

const assertWithdrawalBoundary = (
    plan: UnknownRecord,
    packageData: UnknownRecord,
    cycle: UnknownRecord,
    boundary: { packageRef: admin.firestore.DocumentReference; cycleRef: admin.firestore.DocumentReference; round: number },
): void => {
    if (plan.status !== 'in_review'
        || plan.activeReviewPackageId !== boundary.packageRef.id
        || plan.activeReviewCycleId !== boundary.cycleRef.id
        || Number(plan.reviewRound) !== boundary.round
        || packageData.status !== 'active'
        || packageData.reviewDecision !== 'pending'
        || Number(packageData.round) !== boundary.round
        || packageData.reviewCycleId !== boundary.cycleRef.id
        || packageData.completedBy !== undefined
        || packageData.changesRequestedBy !== undefined
        || cycle.activePackageId !== boundary.packageRef.id
        || cycle.status !== 'active'
        || cycle.frozen === true
        || Number(cycle.round) !== boundary.round
        || !zeroCommentSummary(packageData.commentSummary)
        || !zeroCommentSummary(cycle.commentSummary)
        || !zeroCommentSummary(plan.commentSummary)) {
        throw new functions.https.HttpsError(
            'failed-precondition',
            '검토자가 결정 또는 의견을 기록했거나 검토 Round가 변경되어 요청을 회수할 수 없습니다.',
        );
    }
};

export const getConstructionPlanControlCapabilitiesServer = runner.https.onCall(
    async (data: unknown, context): Promise<UnknownRecord> => {
        const request = record(data);
        const planId = documentId(request.planId, 'planId');
        const actor = await resolveActor(context);
        const planRef = db().collection(PLANS_COLLECTION).doc(planId);
        const plan = planData(await planRef.get());
        assertParticipant(plan, actor);
        const lock = activeLock(plan, Date.now());
        const lockResponse = safeLockResponse(lock);
        if (lock && lockResponse) lockResponse.fingerprint = constructionPlanLockFingerprint(planId, lock);
        const requestSnapshot = lock && lock.userId !== actor.uid
            ? await lockRequestRef(planId, lock).get()
            : undefined;
        const lockRequest = requestSnapshot?.exists && isUnknownRecord(requestSnapshot.data())
            ? requestSnapshot.data() as UnknownRecord
            : undefined;
        const requester = Array.isArray(lockRequest?.requesters)
            ? lockRequest?.requesters.find((item) => isUnknownRecord(item) && item.actorId === actor.uid)
            : undefined;

        const withdrawalBoundary = isAuthor(plan, actor.uid)
            ? await loadWithdrawalBoundary(planRef, plan)
            : undefined;
        let canWithdrawReview = false;
        if (withdrawalBoundary) {
            const [packageSnapshot, cycleSnapshot] = await Promise.all([
                withdrawalBoundary.packageRef.get(), withdrawalBoundary.cycleRef.get(),
            ]);
            try {
                if (packageSnapshot.exists && cycleSnapshot.exists
                    && isUnknownRecord(packageSnapshot.data()) && isUnknownRecord(cycleSnapshot.data())) {
                    assertWithdrawalBoundary(
                        plan,
                        packageSnapshot.data() as UnknownRecord,
                        cycleSnapshot.data() as UnknownRecord,
                        withdrawalBoundary,
                    );
                    canWithdrawReview = true;
                }
            } catch (_error) {
                canWithdrawReview = false;
            }
        }
        const central = actor.access.isAdmin || actor.access.isOffice;
        return {
            planId,
            lockVersion: currentLockVersion(plan),
            ...(lockResponse ? { lock: lockResponse } : {}),
            canRequestUnlock: Boolean(lock && lock.userId !== actor.uid),
            canForceUnlock: Boolean(central && lock),
            ...(requester && isUnknownRecord(requester) ? {
                unlockRequest: {
                    id: requestSnapshot?.id,
                    status: lockRequest?.status,
                    requestedAt: requester.requestedAt,
                    resolvedAt: lockRequest?.resolvedAt,
                },
            } : {}),
            canWithdrawReview,
            canVoid: central && ['draft', 'in_review', 'changes_requested', 'review_completed', 'approved_pending_issue'].includes(String(plan.status || '')),
            canArchive: central && ['draft', 'changes_requested', 'issued', 'superseded', 'void'].includes(String(plan.status || '')),
        };
    },
);

export const requestConstructionPlanUnlockServer = runner.https.onCall(
    async (data: unknown, context): Promise<UnknownRecord> => {
        const request = record(data);
        const planId = documentId(request.planId, 'planId');
        const expected = expectedVersion(request.expectedLockVersion);
        const reason = optionalReason(request.reason);
        const actor = await resolveActor(context);
        const planRef = db().collection(PLANS_COLLECTION).doc(planId);
        return db().runTransaction(async (transaction): Promise<UnknownRecord> => {
            const plan = planData(await transaction.get(planRef));
            assertParticipant(plan, actor);
            assertExpectedVersion(plan, expected);
            const lock = requireExactLock(request, planId, plan);
            if (lock.userId === actor.uid) {
                throw new functions.https.HttpsError('failed-precondition', '자신이 보유한 편집 잠금은 직접 해제해주세요.');
            }
            const requestRef = lockRequestRef(planId, lock);
            const existingSnapshot = await transaction.get(requestRef);
            const existing = existingSnapshot.exists && isUnknownRecord(existingSnapshot.data())
                ? existingSnapshot.data() as UnknownRecord
                : undefined;
            if (existing && existing.status !== 'pending') {
                throw new functions.https.HttpsError('aborted', '대상 편집 잠금 요청이 이미 종료되었습니다.');
            }
            const requesters = Array.isArray(existing?.requesters)
                ? existing?.requesters.filter(isUnknownRecord)
                : [];
            const alreadyRequested = requesters.find((item) => item.actorId === actor.uid);
            if (alreadyRequested) {
                return { requestId: requestRef.id, status: 'pending', requestedAt: alreadyRequested.requestedAt, idempotent: true };
            }
            if (requesters.length >= MAX_LOCK_REQUESTERS) {
                throw new functions.https.HttpsError('resource-exhausted', '이 잠금의 해제 요청 한도를 초과했습니다. 관리자에게 문의해주세요.');
            }
            const timestamp = new Date().toISOString();
            const requester = {
                actorId: actor.uid,
                ...(actor.name ? { actorName: actor.name } : {}),
                requestedAt: timestamp,
                ...(reason ? { reason } : {}),
            };
            const lockKey = constructionPlanLockFingerprint(planId, lock);
            const projection = {
                id: requestRef.id,
                planId,
                siteId: readTrimmedString(plan, ['siteId']) || null,
                lockKey,
                lockOwnerId: lock.userId,
                lockAcquiredAt: lock.acquiredAt,
                expectedLockVersion: expected,
                status: 'pending',
                requesters: [...requesters, requester],
                createdAt: existing?.createdAt || timestamp,
                updatedAt: timestamp,
            };
            if (existingSnapshot.exists) transaction.update(requestRef, projection);
            else transaction.create(requestRef, projection);
            const eventId = `unlock-request-${requestRef.id}-${sha256Hex(actor.uid).slice(0, 16)}`;
            transaction.create(planRef.collection('workflowEvents').doc(eventId), workflowEvent(
                eventId, plan, planId, 'request_unlock', actor, timestamp,
                { metadata: { lockFingerprint: lockKey, lockVersion: expected } },
            ));
            transaction.create(db().collection(AUDIT_COLLECTION).doc(eventId), auditEvent(
                eventId, plan, planId, 'request_unlock', actor, timestamp,
                { lockFingerprint: lockKey, lockVersion: expected },
            ));
            return { requestId: requestRef.id, status: 'pending', requestedAt: timestamp, idempotent: false };
        });
    },
);

const resolveLockRequest = (
    transaction: admin.firestore.Transaction,
    snapshot: admin.firestore.DocumentSnapshot,
    actor: Actor,
    timestamp: string,
    resolution: 'force_released' | 'expired',
): void => {
    if (!snapshot.exists || !isUnknownRecord(snapshot.data()) || snapshot.data()?.status !== 'pending') return;
    transaction.update(snapshot.ref, {
        status: 'resolved',
        resolution,
        resolvedBy: actor.uid,
        ...(actor.name ? { resolvedByName: actor.name } : {}),
        resolvedAt: timestamp,
        updatedAt: timestamp,
    });
};

export const forceReleaseConstructionPlanLockServer = runner.https.onCall(
    async (data: unknown, context): Promise<UnknownRecord> => {
        const request = record(data);
        const planId = documentId(request.planId, 'planId');
        const expected = expectedVersion(request.expectedLockVersion);
        const reason = requiredReason(request.reason, 500);
        const actor = await resolveActor(context);
        if (!actor.access.isAdmin && !actor.access.isOffice) {
            throw new functions.https.HttpsError('permission-denied', '관리자 또는 중앙 권한이 필요합니다.');
        }
        const planRef = db().collection(PLANS_COLLECTION).doc(planId);
        return db().runTransaction(async (transaction): Promise<UnknownRecord> => {
            const plan = planData(await transaction.get(planRef));
            assertParticipant(plan, actor);
            assertExpectedVersion(plan, expected);
            const lock = requireExactLock(request, planId, plan);
            const requestSnapshot = await transaction.get(lockRequestRef(planId, lock));
            const timestamp = new Date().toISOString();
            const nextLockVersion = expected + 1;
            transaction.update(planRef, {
                editLock: admin.firestore.FieldValue.delete(),
                lockVersion: nextLockVersion,
                updatedBy: actor.uid,
                updatedAt: timestamp,
            });
            resolveLockRequest(transaction, requestSnapshot, actor, timestamp, 'force_released');
            const eventId = `force-unlock-${sha256Hex(`${planId}:${lock.acquiredAt}:${nextLockVersion}`).slice(0, 32)}`;
            const metadata = {
                lockFingerprint: constructionPlanLockFingerprint(planId, lock),
                previousLockVersion: expected,
                nextLockVersion,
            };
            transaction.create(planRef.collection('workflowEvents').doc(eventId), workflowEvent(
                eventId, plan, planId, 'force_unlock', actor, timestamp,
                { reason, metadata },
            ));
            transaction.create(db().collection(AUDIT_COLLECTION).doc(eventId), auditEvent(
                eventId, plan, planId, 'force_unlock', actor, timestamp, { ...metadata, reason },
            ));
            return { planId, lockVersion: nextLockVersion, released: true };
        });
    },
);

const lifecycleReceiptId = (actorId: string, planId: string, action: LifecycleAction, idempotencyKey: string): string => (
    `lifecycle-${sha256Hex(canonicalStringify({ actorId, planId, action, idempotencyKey })).slice(0, 48)}`
);

const downloadGrantRef = (planId: string, actorId: string): admin.firestore.DocumentReference => (
    db().collection(DOWNLOAD_GRANTS_COLLECTION).doc(`${planId}__${actorId}`)
);

const lifecycleAllowed = (action: LifecycleAction, status: unknown): boolean => {
    if (action === 'withdraw_review') return status === 'in_review';
    if (action === 'void') return ['draft', 'in_review', 'changes_requested', 'review_completed', 'approved_pending_issue'].includes(String(status || ''));
    return ['draft', 'changes_requested', 'issued', 'superseded', 'void'].includes(String(status || ''));
};

export const transitionConstructionPlanLifecycleServer = runner.https.onCall(
    async (data: unknown, context): Promise<UnknownRecord> => {
        const request = record(data);
        const planId = documentId(request.planId, 'planId');
        const action = requiredString(request.action, 'action', 40) as LifecycleAction;
        if (!['withdraw_review', 'void', 'archive'].includes(action)) {
            throw new functions.https.HttpsError('invalid-argument', '지원하지 않는 상태 전이입니다.');
        }
        const expected = expectedVersion(request.expectedLockVersion);
        const reason = requiredReason(request.reason, 1000);
        const idempotencyKey = requiredString(request.idempotencyKey, 'idempotencyKey', 128);
        const actor = await resolveActor(context);
        const planRef = db().collection(PLANS_COLLECTION).doc(planId);
        const preflightPlan = planData(await planRef.get());
        assertParticipant(preflightPlan, actor);
        if (action === 'withdraw_review' ? !isAuthor(preflightPlan, actor.uid) : !(actor.access.isAdmin || actor.access.isOffice)) {
            throw new functions.https.HttpsError('permission-denied', action === 'withdraw_review'
                ? '작성자만 검토 요청을 회수할 수 있습니다.'
                : '관리자 또는 중앙 권한이 필요합니다.');
        }
        const receiptRef = db().collection(LIFECYCLE_RECEIPTS_COLLECTION)
            .doc(lifecycleReceiptId(actor.uid, planId, action, idempotencyKey));
        const eventId = `control-${receiptRef.id.slice('lifecycle-'.length)}`;
        const requestFingerprint = sha256Hex(canonicalStringify({ actorId: actor.uid, planId, action, expected, reason }));
        const earlyReceipt = await receiptRef.get();
        if (earlyReceipt.exists) {
            const existing = earlyReceipt.data();
            if (!isUnknownRecord(existing) || existing.requestFingerprint !== requestFingerprint
                || !isUnknownRecord(existing.response)) {
                throw new functions.https.HttpsError('already-exists', '같은 idempotencyKey가 다른 요청에 사용되었습니다.');
            }
            return { ...existing.response as UnknownRecord, idempotent: true };
        }
        if (!lifecycleAllowed(action, preflightPlan.status)) {
            throw new functions.https.HttpsError('failed-precondition', '현재 문서 상태에서는 요청한 전이를 수행할 수 없습니다.');
        }
        const withdrawal = action === 'withdraw_review'
            ? await loadWithdrawalBoundary(planRef, preflightPlan)
            : undefined;
        if (action === 'withdraw_review' && !withdrawal) {
            throw new functions.https.HttpsError('failed-precondition', '활성 검토 Round를 확인할 수 없습니다.');
        }
        return db().runTransaction(async (transaction): Promise<UnknownRecord> => {
            const reads = await Promise.all([
                transaction.get(planRef),
                transaction.get(receiptRef),
                ...(withdrawal ? [transaction.get(withdrawal.packageRef), transaction.get(withdrawal.cycleRef)] : []),
            ]);
            if (reads[1].exists) {
                const existing = reads[1].data();
                if (!isUnknownRecord(existing) || existing.requestFingerprint !== requestFingerprint
                    || !isUnknownRecord(existing.response)) {
                    throw new functions.https.HttpsError('already-exists', '같은 idempotencyKey가 다른 요청에 사용되었습니다.');
                }
                return { ...existing.response as UnknownRecord, idempotent: true };
            }
            const plan = planData(reads[0]);
            assertParticipant(plan, actor);
            assertExpectedVersion(plan, expected);
            if (!lifecycleAllowed(action, plan.status)) {
                throw new functions.https.HttpsError('failed-precondition', '현재 문서 상태에서는 요청한 전이를 수행할 수 없습니다.');
            }
            if (action === 'withdraw_review') {
                if (!isAuthor(plan, actor.uid) || !withdrawal
                    || !reads[2].exists || !reads[3].exists
                    || !isUnknownRecord(reads[2].data()) || !isUnknownRecord(reads[3].data())) {
                    throw new functions.https.HttpsError('failed-precondition', '검토 요청 회수 경계를 확인할 수 없습니다.');
                }
                assertWithdrawalBoundary(
                    plan,
                    reads[2].data() as UnknownRecord,
                    reads[3].data() as UnknownRecord,
                    withdrawal,
                );
            } else if (!actor.access.isAdmin && !actor.access.isOffice) {
                throw new functions.https.HttpsError('permission-denied', '관리자 또는 중앙 권한이 필요합니다.');
            }

            const fromStatus = String(plan.status || '');
            const toStatus = action === 'withdraw_review' ? 'draft' : action === 'void' ? 'void' : 'archived';
            const timestamp = new Date().toISOString();
            const nextLockVersion = expected + 1;
            const planUpdate: UnknownRecord = {
                status: toStatus,
                lockVersion: nextLockVersion,
                updatedBy: actor.uid,
                updatedAt: timestamp,
                editLock: admin.firestore.FieldValue.delete(),
            };
            if (action === 'withdraw_review') {
                Object.assign(planUpdate, {
                    activeReviewSnapshotId: admin.firestore.FieldValue.delete(),
                    activeReviewSnapshotHash: admin.firestore.FieldValue.delete(),
                    activeReviewSnapshotStoragePath: admin.firestore.FieldValue.delete(),
                    activeReviewSnapshotLockVersion: admin.firestore.FieldValue.delete(),
                    activeReviewPackageId: admin.firestore.FieldValue.delete(),
                    activeReviewCycleId: admin.firestore.FieldValue.delete(),
                    'releaseReadiness.requiredReviewsComplete': false,
                    'releaseReadiness.snapshotHashMatches': false,
                });
                // The submitted review snapshot, package and cycle are immutable
                // historical evidence. Ending the active pointers on the plan is
                // sufficient to make the package read-only; the append-only
                // workflow/audit event below records the withdrawal disposition.
            }
            transaction.update(planRef, planUpdate);
            const metadata: UnknownRecord = {
                previousLockVersion: expected,
                nextLockVersion,
                ...(action === 'withdraw_review' && withdrawal ? {
                    reviewPackageId: withdrawal.packageRef.id,
                    reviewCycleId: withdrawal.cycleRef.id,
                    reviewRound: withdrawal.round,
                    reviewSnapshotId: readTrimmedString(plan, ['activeReviewSnapshotId']) || null,
                    reviewSnapshotHash: readTrimmedString(plan, ['activeReviewSnapshotHash']) || null,
                } : {}),
            };
            const response = { planId, status: toStatus, lockVersion: nextLockVersion, idempotent: false };
            transaction.create(receiptRef, {
                id: receiptRef.id, actorId: actor.uid, planId, action, requestFingerprint, response, createdAt: timestamp,
            });
            transaction.create(planRef.collection('workflowEvents').doc(eventId), workflowEvent(
                eventId, plan, planId, action, actor, timestamp,
                { fromStatus, toStatus, reason, metadata },
            ));
            transaction.create(db().collection(AUDIT_COLLECTION).doc(eventId), auditEvent(
                eventId, plan, planId, action, actor, timestamp, { ...metadata, reason },
            ));
            return response;
        });
    },
);

const cleanupExpiredLock = async (
    planSnapshot: admin.firestore.DocumentSnapshot,
    nowEpochMs: number,
): Promise<boolean> => {
    const planRef = planSnapshot.ref;
    const cleanupActor: Actor = {
        uid: 'construction-plan-lock-cleanup',
        name: '시스템 만료 잠금 정리',
        access: { isAdmin: true, isOffice: true, isSite: true, canUseDirectory: true, canSubmitReview: true, canReviewApproveIssue: true },
    };
    return db().runTransaction(async (transaction): Promise<boolean> => {
        const plan = planData(await transaction.get(planRef));
        if (!isUnknownRecord(plan.editLock)) return false;
        const lockRecord = plan.editLock;
        const expiresAtEpochMs = Number(lockRecord.expiresAtEpochMs);
        const userId = readTrimmedString(lockRecord, ['userId']);
        const userName = readTrimmedString(lockRecord, ['userName']);
        const acquiredAt = readTrimmedString(lockRecord, ['acquiredAt']);
        const expiresAt = readTrimmedString(lockRecord, ['expiresAt']);
        if (!userId || !userName || !acquiredAt || !expiresAt || !Number.isFinite(expiresAtEpochMs)
            || expiresAtEpochMs > nowEpochMs) return false;
        const lock: ActiveEditLock = { userId, userName, acquiredAt, expiresAt, expiresAtEpochMs };
        const requestSnapshot = await transaction.get(lockRequestRef(planRef.id, lock));
        const timestamp = new Date(nowEpochMs).toISOString();
        const nextLockVersion = currentLockVersion(plan) + 1;
        transaction.update(planRef, {
            editLock: admin.firestore.FieldValue.delete(), lockVersion: nextLockVersion,
            updatedBy: cleanupActor.uid, updatedAt: timestamp,
        });
        resolveLockRequest(transaction, requestSnapshot, cleanupActor, timestamp, 'expired');
        const eventId = `expire-unlock-${sha256Hex(`${planRef.id}:${acquiredAt}:${nextLockVersion}`).slice(0, 32)}`;
        const metadata = { lockFingerprint: constructionPlanLockFingerprint(planRef.id, lock), nextLockVersion };
        transaction.create(planRef.collection('workflowEvents').doc(eventId), workflowEvent(
            eventId, plan, planRef.id, 'expire_unlock', cleanupActor, timestamp, { metadata },
        ));
        transaction.create(db().collection(AUDIT_COLLECTION).doc(eventId), auditEvent(
            eventId, plan, planRef.id, 'expire_unlock', cleanupActor, timestamp, metadata,
        ));
        return true;
    });
};

export const cleanupExpiredConstructionPlanLocksScheduled = functions
    .runWith({ timeoutSeconds: 300, memory: '512MB', maxInstances: 1 })
    .region('asia-northeast3')
    .pubsub.schedule('every 15 minutes')
    .timeZone('Asia/Seoul')
    .onRun(async () => {
        const nowEpochMs = Date.now();
        const snapshots = await db().collection(PLANS_COLLECTION)
            .where('editLock.expiresAtEpochMs', '<=', nowEpochMs)
            .limit(200)
            .get();
        const settled = await Promise.allSettled(snapshots.docs.map((snapshot) => (
            cleanupExpiredLock(snapshot, nowEpochMs)
        )));
        const failed = settled.filter((result) => result.status === 'rejected');
        if (failed.length) functions.logger.error('[constructionPlans] expired lock cleanup failures', { count: failed.length });
        return { scanned: snapshots.size, released: settled.filter((result) => result.status === 'fulfilled' && result.value).length, failed: failed.length };
    });

const issuedArtifact = (plan: UnknownRecord, exported: UnknownRecord): UnknownRecord => {
    if (!['issued', 'superseded', 'archived'].includes(String(plan.status || ''))
        || exported.kind !== 'issued' || exported.status !== 'ready' || exported.immutable !== true
        || exported.id !== plan.issuedExportId || exported.planId === undefined) {
        throw new functions.https.HttpsError('failed-precondition', '다운로드 가능한 불변 발행본이 아닙니다.');
    }
    const artifact = isUnknownRecord(exported.artifact) ? exported.artifact : exported;
    const storagePath = readTrimmedString(artifact, ['storagePath']);
    const storageGeneration = readTrimmedString(artifact, ['storageGeneration']);
    const sha256 = (readTrimmedString(artifact, ['sha256']) || '').toLowerCase();
    const fileName = readTrimmedString(artifact, ['fileName']);
    const sizeBytes = Number(artifact.sizeBytes);
    const pageCount = Number(artifact.pageCount);
    if (!storagePath || storagePath !== plan.issuedExportStoragePath
        || storagePath.includes('..') || storagePath.includes('\\') || storagePath.includes('?') || storagePath.includes('#')
        || !storageGeneration || !/^\d+$/.test(storageGeneration)
        || !/^[a-f0-9]{64}$/.test(sha256) || sha256 !== plan.issuedExportSha256
        || !fileName || !fileName.toLowerCase().endsWith('.pdf')
        || !Number.isInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > MAX_ISSUED_PDF_SIZE_BYTES
        || !Number.isInteger(pageCount) || pageCount < 42 || pageCount > 200) {
        throw new functions.https.HttpsError('data-loss', '발행 PDF 바인딩이 손상되었습니다.');
    }
    return { storagePath, storageGeneration, sha256, fileName, sizeBytes, pageCount };
};

const verifyIssuedArtifactBytes = async (artifact: UnknownRecord): Promise<void> => {
    const storagePath = String(artifact.storagePath);
    const file = bucket().file(storagePath);
    const [metadata, download] = await Promise.all([file.getMetadata(), file.download()]);
    const bytes = download[0];
    if (metadata[0].contentType !== 'application/pdf'
        || String(metadata[0].generation || '') !== artifact.storageGeneration
        || Number(metadata[0].size) !== artifact.sizeBytes
        || String(metadata[0].metadata?.sha256 || '').toLowerCase() !== artifact.sha256
        || bytes.length !== artifact.sizeBytes
        || bytes.subarray(0, 5).toString('ascii') !== '%PDF-'
        || sha256Hex(bytes) !== artifact.sha256) {
        throw new functions.https.HttpsError('data-loss', '발행 PDF 서버 재검증에 실패했습니다.');
    }
};

export const prepareConstructionPlanIssuedPdfDownloadServer = downloadRunner.https.onCall(
    async (data: unknown, context): Promise<UnknownRecord> => {
        const request = record(data);
        const planId = documentId(request.planId, 'planId');
        const expectedSha256 = requiredString(request.expectedSha256, 'expectedSha256', 64).toLowerCase();
        if (!/^[a-f0-9]{64}$/.test(expectedSha256)) {
            throw new functions.https.HttpsError('invalid-argument', 'expectedSha256 값이 올바르지 않습니다.');
        }
        const idempotencyKey = requiredString(request.idempotencyKey, 'idempotencyKey', 128);
        const actor = await resolveActor(context);
        const planRef = db().collection(PLANS_COLLECTION).doc(planId);
        const plan = planData(await planRef.get());
        assertParticipant(plan, actor);
        const exportId = documentId(plan.issuedExportId, 'issuedExportId');
        const exported = planData(await planRef.collection('exports').doc(exportId).get());
        if (exported.planId !== planId) throw new functions.https.HttpsError('data-loss', '발행본 계획서 바인딩이 손상되었습니다.');
        const artifact = issuedArtifact(plan, exported);
        if (artifact.sha256 !== expectedSha256) throw new functions.https.HttpsError('aborted', '요청한 발행 PDF SHA-256이 최신 발행본과 다릅니다.');
        await verifyIssuedArtifactBytes(artifact);
        const receiptId = `pdf-download-${sha256Hex(canonicalStringify({ actorId: actor.uid, planId, expectedSha256, idempotencyKey })).slice(0, 48)}`;
        const receiptRef = db().collection(DOWNLOAD_RECEIPTS_COLLECTION).doc(receiptId);
        const grantRef = downloadGrantRef(planId, actor.uid);
        const eventId = `pdf-download-intent-${receiptId.slice('pdf-download-'.length)}`;
        const timestamp = new Date().toISOString();
        const expiresAtEpochMs = Date.now() + PDF_DOWNLOAD_GRANT_TTL_MS;
        const grant = {
            id: grantRef.id,
            planId,
            actorId: actor.uid,
            receiptId,
            artifactId: exportId,
            artifactSha256: expectedSha256,
            storageGeneration: artifact.storageGeneration,
            status: 'active',
            grantedAt: timestamp,
            expiresAt: new Date(expiresAtEpochMs).toISOString(),
            expiresAtEpochMs,
            updatedAt: timestamp,
        };
        return db().runTransaction(async (transaction): Promise<UnknownRecord> => {
            const [latestPlanSnapshot, latestExportSnapshot, existingReceipt] = await Promise.all([
                transaction.get(planRef), transaction.get(planRef.collection('exports').doc(exportId)), transaction.get(receiptRef),
            ]);
            const latestPlan = planData(latestPlanSnapshot);
            assertParticipant(latestPlan, actor);
            const latestExport = planData(latestExportSnapshot);
            const latestArtifact = issuedArtifact(latestPlan, latestExport);
            if (canonicalStringify(latestArtifact) !== canonicalStringify(artifact)) {
                throw new functions.https.HttpsError('aborted', '발행 PDF가 재검증 중 변경되었습니다.');
            }
            if (existingReceipt.exists) {
                const existing = existingReceipt.data();
                if (!isUnknownRecord(existing) || existing.actorId !== actor.uid || existing.planId !== planId
                    || existing.artifactId !== exportId || existing.artifactSha256 !== expectedSha256
                    || !['intent_recorded', 'completed'].includes(String(existing.status || ''))) {
                    throw new functions.https.HttpsError('already-exists', '다운로드 idempotencyKey가 충돌했습니다.');
                }
                transaction.set(grantRef, grant);
                return { receiptId, artifact: latestArtifact, idempotent: true };
            }
            transaction.create(receiptRef, {
                id: receiptId, planId, artifactId: exportId, artifactSha256: expectedSha256,
                artifactProfile: 'issued', actorId: actor.uid, status: 'intent_recorded',
                intendedAt: timestamp, createdAt: timestamp,
            });
            transaction.set(grantRef, grant);
            const metadata = { artifactId: exportId, artifactSha256: expectedSha256, artifactProfile: 'issued' };
            transaction.create(planRef.collection('workflowEvents').doc(eventId), workflowEvent(
                eventId, latestPlan, planId, 'pdf_download_intent', actor, timestamp, { metadata },
            ));
            transaction.create(db().collection(AUDIT_COLLECTION).doc(eventId), auditEvent(
                eventId, latestPlan, planId, 'pdf_download_intent', actor, timestamp, metadata,
            ));
            return { receiptId, artifact: latestArtifact, idempotent: false };
        });
    },
);

export const completeConstructionPlanIssuedPdfDownloadServer = runner.https.onCall(
    async (data: unknown, context): Promise<UnknownRecord> => {
        const request = record(data);
        const receiptId = documentId(request.receiptId, 'receiptId');
        const downloadedSha256 = requiredString(request.downloadedSha256, 'downloadedSha256', 64).toLowerCase();
        const downloadedSizeBytes = Number(request.downloadedSizeBytes);
        if (!/^[a-f0-9]{64}$/.test(downloadedSha256)
            || !Number.isInteger(downloadedSizeBytes) || downloadedSizeBytes < 1 || downloadedSizeBytes > MAX_ISSUED_PDF_SIZE_BYTES) {
            throw new functions.https.HttpsError('invalid-argument', '다운로드 완료 무결성 값이 올바르지 않습니다.');
        }
        const actor = await resolveActor(context);
        const receiptRef = db().collection(DOWNLOAD_RECEIPTS_COLLECTION).doc(receiptId);
        return db().runTransaction(async (transaction): Promise<UnknownRecord> => {
            const receiptSnapshot = await transaction.get(receiptRef);
            if (!receiptSnapshot.exists || !isUnknownRecord(receiptSnapshot.data())) {
                throw new functions.https.HttpsError('not-found', '다운로드 접근 기록을 찾을 수 없습니다.');
            }
            const receipt = receiptSnapshot.data() as UnknownRecord;
            if (receipt.actorId !== actor.uid) throw new functions.https.HttpsError('permission-denied', '자신의 다운로드만 완료 처리할 수 있습니다.');
            if (receipt.artifactSha256 !== downloadedSha256) throw new functions.https.HttpsError('data-loss', '다운로드 PDF SHA-256이 서버 발행본과 다릅니다.');
            const planId = documentId(receipt.planId, 'planId');
            const planRef = db().collection(PLANS_COLLECTION).doc(planId);
            const grantRef = downloadGrantRef(planId, actor.uid);
            const exportId = documentId(receipt.artifactId, 'artifactId');
            const [planSnapshot, exportSnapshot, grantSnapshot] = await Promise.all([
                transaction.get(planRef),
                transaction.get(planRef.collection('exports').doc(exportId)),
                transaction.get(grantRef),
            ]);
            const plan = planData(planSnapshot);
            assertParticipant(plan, actor);
            const exported = planData(exportSnapshot);
            const artifact = issuedArtifact(plan, exported);
            if (artifact.sha256 !== downloadedSha256 || artifact.sizeBytes !== downloadedSizeBytes) {
                throw new functions.https.HttpsError('data-loss', '다운로드 완료 값이 현재 불변 발행본과 일치하지 않습니다.');
            }
            const grant = grantSnapshot.exists && isUnknownRecord(grantSnapshot.data())
                ? grantSnapshot.data() as UnknownRecord
                : undefined;
            const matchingGrant = Boolean(grant
                && grant.receiptId === receiptId
                && grant.planId === planId
                && grant.actorId === actor.uid
                && grant.artifactId === exportId
                && grant.artifactSha256 === downloadedSha256);
            if (receipt.status === 'completed') {
                // prepare() may have recreated the short-lived grant for a true
                // retry. Close it again even though the append-only completion
                // audit already exists.
                if (matchingGrant) {
                    transaction.set(grantRef, {
                        status: 'completed', completedAt: receipt.completedAt || receipt.updatedAt,
                        updatedAt: new Date().toISOString(), expiresAtEpochMs: 0,
                    }, { merge: true });
                }
                return { receiptId, completed: true, idempotent: true };
            }
            if (receipt.status !== 'intent_recorded') throw new functions.https.HttpsError('failed-precondition', '다운로드 접근 기록 상태가 올바르지 않습니다.');
            if (!matchingGrant || grant?.status !== 'active'
                || !Number.isFinite(Number(grant.expiresAtEpochMs))
                || Number(grant.expiresAtEpochMs) <= Date.now()) {
                throw new functions.https.HttpsError('failed-precondition', '다운로드 접근 승인이 만료되었거나 다른 요청으로 대체되었습니다.');
            }
            const timestamp = new Date().toISOString();
            transaction.update(receiptRef, { status: 'completed', completedAt: timestamp, updatedAt: timestamp });
            transaction.set(grantRef, {
                status: 'completed', completedAt: timestamp, updatedAt: timestamp, expiresAtEpochMs: 0,
            }, { merge: true });
            const eventId = `pdf-download-complete-${receiptId.slice('pdf-download-'.length)}`;
            const metadata = { artifactId: exportId, artifactSha256: downloadedSha256, artifactProfile: 'issued', sizeBytes: downloadedSizeBytes };
            transaction.create(planRef.collection('workflowEvents').doc(eventId), workflowEvent(
                eventId, plan, planId, 'pdf_download_complete', actor, timestamp, { metadata },
            ));
            transaction.create(db().collection(AUDIT_COLLECTION).doc(eventId), auditEvent(
                eventId, plan, planId, 'pdf_download_complete', actor, timestamp, metadata,
            ));
            return { receiptId, completed: true, idempotent: false };
        });
    },
);
