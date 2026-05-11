"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseBoundedLimit = exports.requireHttpAuth = exports.requireCallableAuth = exports.protectedRegion = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
exports.protectedRegion = functions
    .runWith({
    timeoutSeconds: 30,
    memory: '256MB',
    maxInstances: 5,
})
    .region('asia-northeast3');
function requireCallableAuth(context) {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication is required.');
    }
    return context.auth;
}
exports.requireCallableAuth = requireCallableAuth;
async function requireHttpAuth(req, res) {
    const authHeader = String(req.get?.('authorization') || req.headers?.authorization || '');
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) {
        res.status(401).json({ success: false, error: 'Authentication is required.' });
        return null;
    }
    try {
        return await admin.auth().verifyIdToken(match[1]);
    }
    catch (error) {
        functions.logger.warn('Invalid Firebase ID token.', error);
        res.status(401).json({ success: false, error: 'Invalid authentication token.' });
        return null;
    }
}
exports.requireHttpAuth = requireHttpAuth;
function parseBoundedLimit(value, defaultLimit = 50, maxLimit = 100) {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    if (!Number.isFinite(parsed) || parsed <= 0)
        return defaultLimit;
    return Math.min(parsed, maxLimit);
}
exports.parseBoundedLimit = parseBoundedLimit;
//# sourceMappingURL=auth.js.map