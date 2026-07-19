import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { protectedRegion, requireCallableAdmin } from './auth';

type RoleGroup = 'admin' | 'payroll' | 'finance' | 'office' | 'site' | 'support' | 'audit' | 'user';

interface SyncClaimsResult {
    uid: string;
    role: string;
    position: string;
    systemRole: string;
    accountType: string;
    additionalPositions: string[];
    roles: string[];
    erpRoleGroups: RoleGroup[];
    syncedAt: string;
}

const db = admin.firestore();

const CLAIM_KEYS = [
    'role',
    'position',
    'systemRole',
    'accountType',
    'additionalPositions',
    'roles',
    'erpRoleGroups',
    'accessClaimsVersion',
    'accessClaimsSyncedAt',
];

const ROLE_GROUPS: Record<RoleGroup, string[]> = {
    admin: [
        'admin',
        'super_admin',
        'administrator',
        'owner',
        'dev',
        'developer',
        'system_admin',
        'jhl2vtnk9v3c4eiz4qqi',
        'pos_jhl2vtnk9v3c4eiz4qqi',
        '관리자',
        '사장',
        '실장',
        '개발',
        '개발자',
        '시스템관리자',
        '愿由ъ옄',
        '?ъ옣',
        '?ㅼ옣',
        '媛쒕컻',
        '媛쒕컻??',
        '?쒖뒪?쒓?由ъ옄',
    ],
    payroll: [
        'payroll_manager',
        '급여담당',
        '정산담당',
        '정산관리자',
        '湲됱뿬?대떦',
        '?뺤궛?대떦',
        '?뺤궛愿由ъ옄',
    ],
    finance: [
        'finance',
        'finance_manager',
        'accounting',
        'accounting_manager',
        '회계',
        '재무',
        '경리',
        '회계담당',
        '재무담당',
    ],
    office: [
        'office_staff',
        'office',
        '사무실직원',
        '사무직원',
        '사무',
        '?щТ?ㅼ쭅??',
        '?щТ吏곸썝',
    ],
    site: [
        'site_manager',
        'manager',
        'manager1',
        'manager2',
        'manager3',
        'pos_manager1',
        'pos_manager2',
        'pos_manager3',
        '매니저',
        '매니저1',
        '매니저2',
        '매니저3',
        '메니저1',
        '메니저2',
        '메니저3',
        '현장관리자',
        '현장소장',
        '留ㅻ땲?',
        '?꾩옣愿由ъ옄',
        '?꾩옣?뚯옣',
    ],
    support: [
        'support',
        'support_manager',
        'manager1',
        'pos_manager1',
        '매니저1',
        '메니저1',
        '지원담당',
        '지원 담당',
        '자산관리',
        '자산 관리',
        '숙소관리',
        '숙소 관리',
        '차량관리',
        '차량 관리',
    ],
    audit: [
        'audit',
        'auditor',
        'compliance',
        '감사',
        '감사자',
        '준법',
    ],
    user: ['user', 'general', '일반', '?쇰컲'],
};

const normalize = (value: unknown): string => String(value || '').trim();
const normalizeKey = (value: unknown): string => normalize(value).toLowerCase();

const asList = (value: unknown): string[] => {
    if (Array.isArray(value)) return value.map(normalize).filter(Boolean);
    const normalized = normalize(value);
    return normalized ? [normalized] : [];
};

const unique = (values: unknown[]): string[] => {
    const seen = new Set<string>();
    const result: string[] = [];

    values.flatMap(asList).forEach((value) => {
        const key = normalizeKey(value);
        if (!key || seen.has(key)) return;
        seen.add(key);
        result.push(value.slice(0, 80));
    });

    return result.slice(0, 30);
};

const getRoleGroups = (roles: string[]): RoleGroup[] => {
    const actual = new Set(roles.map(normalizeKey));
    const groups = (Object.keys(ROLE_GROUPS) as RoleGroup[]).filter((group) => {
        return ROLE_GROUPS[group].some((role) => actual.has(normalizeKey(role)));
    });

    return groups.includes('admin')
        ? ['admin', ...groups.filter((group) => group !== 'admin')]
        : groups;
};

const readAdditionalMenuPositions = async (uid: string): Promise<string[]> => {
    const snapshot = await db.collection('system_configs').doc('user_menu_positions').get();
    const raw = snapshot.data()?.data;
    if (typeof raw !== 'string' || !raw.trim()) return [];

    try {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        return asList(parsed[uid]);
    } catch (error) {
        functions.logger.warn('[roleClaims] Failed to parse user_menu_positions.', error);
        return [];
    }
};

const readLinkedEntityRoles = async (uid: string): Promise<string[]> => {
    const [workerSnapshot, officeStaffSnapshot] = await Promise.all([
        db.collection('workers').where('uid', '==', uid).limit(1).get(),
        db.collection('office_staff').where('uid', '==', uid).limit(1).get(),
    ]);

    return unique([
        workerSnapshot.docs[0]?.data()?.role,
        officeStaffSnapshot.docs[0]?.data()?.role,
    ]);
};

const readPositionSystemRoles = async (positions: string[]): Promise<string[]> => {
    const normalizedPositions = new Set(positions.map(normalizeKey));
    if (normalizedPositions.size === 0) return [];

    const snapshot = await db.collection('positions').get();
    const systemRoles: string[] = [];

    snapshot.docs.forEach((doc) => {
        const data = doc.data();
        const candidates = unique([doc.id, data.id, data.name]);
        if (!candidates.some((candidate) => normalizedPositions.has(normalizeKey(candidate)))) return;
        systemRoles.push(...asList(data.systemRole));
    });

    return unique(systemRoles);
};

const buildAccessClaims = async (uid: string): Promise<SyncClaimsResult> => {
    const userSnapshot = await db.collection('users').doc(uid).get();
    if (!userSnapshot.exists) {
        throw new functions.https.HttpsError('not-found', 'User profile was not found.');
    }

    const user = userSnapshot.data() || {};
    const additionalMenuPositions = await readAdditionalMenuPositions(uid);
    const profileAdditionalPositions = asList(user.additionalPositions);
    const additionalPositions = unique([profileAdditionalPositions, additionalMenuPositions]);
    const linkedRoles = await readLinkedEntityRoles(uid);
    const positionCandidates = unique([
        user.position,
        additionalPositions,
        linkedRoles,
    ]);
    const positionSystemRoles = await readPositionSystemRoles(positionCandidates);

    const roles = unique([
        user.role || 'user',
        user.position,
        user.systemRole,
        user.accountType,
        user.roles,
        additionalPositions,
        linkedRoles,
        positionSystemRoles,
        'user',
    ]);
    const erpRoleGroups = getRoleGroups(roles);
    const syncedAt = new Date().toISOString();

    return {
        uid,
        role: normalize(user.role || 'user'),
        position: normalize(user.position || linkedRoles[0] || ''),
        systemRole: normalize(user.systemRole || positionSystemRoles[0] || ''),
        accountType: normalize(user.accountType || ''),
        additionalPositions,
        roles,
        erpRoleGroups,
        syncedAt,
    };
};

const stripUndefined = (value: Record<string, unknown>): Record<string, unknown> => {
    return Object.fromEntries(
        Object.entries(value).filter(([, entry]) => entry !== undefined)
    );
};

const writeAccessClaims = async (claims: SyncClaimsResult): Promise<void> => {
    const userRecord = await admin.auth().getUser(claims.uid);
    const nextClaims: Record<string, unknown> = { ...(userRecord.customClaims || {}) };
    CLAIM_KEYS.forEach((key) => {
        delete nextClaims[key];
    });

    Object.assign(nextClaims, stripUndefined({
        role: claims.role || 'user',
        position: claims.position || undefined,
        systemRole: claims.systemRole || undefined,
        accountType: claims.accountType || undefined,
        additionalPositions: claims.additionalPositions,
        roles: claims.roles,
        erpRoleGroups: claims.erpRoleGroups,
        accessClaimsVersion: 1,
        accessClaimsSyncedAt: claims.syncedAt,
    }));

    await admin.auth().setCustomUserClaims(claims.uid, nextClaims);
};

const clearAccessClaims = async (uid: string): Promise<void> => {
    const userRecord = await admin.auth().getUser(uid);
    const nextClaims: Record<string, unknown> = { ...(userRecord.customClaims || {}) };
    CLAIM_KEYS.forEach((key) => {
        delete nextClaims[key];
    });
    await admin.auth().setCustomUserClaims(uid, nextClaims);
};

export const syncUserAccessClaims = protectedRegion.https.onCall(async (data, context) => {
    const actor = await requireCallableAdmin(context);
    const uid = normalize((data as { uid?: unknown } | undefined)?.uid);
    if (!uid) {
        throw new functions.https.HttpsError('invalid-argument', 'uid is required.');
    }

    const claims = await buildAccessClaims(uid);
    await writeAccessClaims(claims);

    await db.collection('audit_logs').doc(`claims:${uid}:${Date.now()}`).set({
        action: 'SYNC_USER_ACCESS_CLAIMS',
        category: 'AUTH',
        actorId: actor.uid,
        targetId: uid,
        roleGroups: claims.erpRoleGroups,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }).catch((error) => functions.logger.warn('[roleClaims] Audit log failed.', error));

    return claims;
});

export const syncAllUserAccessClaims = protectedRegion.https.onCall(async (data, context) => {
    const actor = await requireCallableAdmin(context);
    const requestedLimit = Number((data as { limit?: unknown } | undefined)?.limit || 100);
    const limit = Number.isFinite(requestedLimit)
        ? Math.min(Math.max(Math.floor(requestedLimit), 1), 500)
        : 100;
    const snapshot = await db.collection('users').limit(limit).get();
    const results: SyncClaimsResult[] = [];

    for (const doc of snapshot.docs) {
        const claims = await buildAccessClaims(doc.id);
        await writeAccessClaims(claims);
        results.push(claims);
    }

    await db.collection('audit_logs').doc(`claims:bulk:${Date.now()}`).set({
        action: 'SYNC_ALL_USER_ACCESS_CLAIMS',
        category: 'AUTH',
        actorId: actor.uid,
        targetCount: results.length,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }).catch((error) => functions.logger.warn('[roleClaims] Bulk audit log failed.', error));

    return {
        count: results.length,
        limit,
        users: results.map((result) => ({
            uid: result.uid,
            roleGroups: result.erpRoleGroups,
            syncedAt: result.syncedAt,
        })),
    };
});

export const syncUserAccessClaimsOnUserWrite = protectedRegion.firestore
    .document('users/{uid}')
    .onWrite(async (change, context) => {
        const uid = normalize(context.params.uid);
        if (!uid) return;

        try {
            if (!change.after.exists) {
                await clearAccessClaims(uid);
                return;
            }

            const claims = await buildAccessClaims(uid);
            await writeAccessClaims(claims);
        } catch (error) {
            functions.logger.warn('[roleClaims] User write claim sync failed.', { uid, error });
        }
    });
