import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';

export const protectedRegion = functions
    .runWith({
        timeoutSeconds: 30,
        memory: '256MB',
        maxInstances: 5,
    })
    .region('asia-northeast3');

export function requireCallableAuth(context: functions.https.CallableContext): functions.https.CallableContext['auth'] {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication is required.');
    }
    return context.auth;
}

const ADMIN_ROLES = new Set([
    'ADMIN',
    'admin',
    'administrator',
    'super_admin',
    'owner',
    'DEV',
    'dev',
    'DEVELOPER',
    'developer',
    'SYSTEM_ADMIN',
    'system_admin',
    '관리자',
    '사장',
    '실장',
    '개발',
    '개발자',
    '시스템관리자',
]);

const hasAdminRoleValue = (value: unknown): boolean => {
    if (Array.isArray(value)) return value.some(hasAdminRoleValue);
    return ADMIN_ROLES.has(String(value || '').trim());
};

export async function requireCallableAdmin(context: functions.https.CallableContext): Promise<functions.https.CallableContext['auth']> {
    const auth = requireCallableAuth(context);
    const token = (auth.token || {}) as Record<string, unknown>;

    if (
        hasAdminRoleValue(token.role)
        || hasAdminRoleValue(token.position)
        || hasAdminRoleValue(token.systemRole)
        || hasAdminRoleValue(token.additionalPositions)
    ) {
        return auth;
    }

    const userSnap = await admin.firestore().collection('users').doc(auth.uid).get();
    const user = userSnap.data() || {};
    if (
        hasAdminRoleValue(user.role)
        || hasAdminRoleValue(user.position)
        || hasAdminRoleValue(user.systemRole)
        || hasAdminRoleValue(user.additionalPositions)
    ) {
        return auth;
    }

    throw new functions.https.HttpsError('permission-denied', '관리자 권한이 필요합니다.');
}

export async function requireHttpAuth(req: any, res: any): Promise<admin.auth.DecodedIdToken | null> {
    const authHeader = String(req.get?.('authorization') || req.headers?.authorization || '');
    const match = authHeader.match(/^Bearer\s+(.+)$/i);

    if (!match) {
        res.status(401).json({ success: false, error: 'Authentication is required.' });
        return null;
    }

    try {
        return await admin.auth().verifyIdToken(match[1]);
    } catch (error) {
        functions.logger.warn('Invalid Firebase ID token.', error);
        res.status(401).json({ success: false, error: 'Invalid authentication token.' });
        return null;
    }
}

export function parseBoundedLimit(value: unknown, defaultLimit = 50, maxLimit = 100): number {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return defaultLimit;
    return Math.min(parsed, maxLimit);
}
