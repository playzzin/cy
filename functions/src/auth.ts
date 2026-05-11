import * as functions from 'firebase-functions';
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
