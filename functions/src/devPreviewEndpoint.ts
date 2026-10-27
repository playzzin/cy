import * as admin from 'firebase-admin';
import { assertPreviewClaims, isPreviewIdentity, permitsPreviewCall, previewActorRole } from './devPreviewPolicy';

// Wrap the actual deployment entrypoint, including endpoints that do not use auth.ts.
// Function metadata is retained so Firebase discovers the same triggers and options.
export function guardDevPreviewEndpoint<T>(name: string, endpoint: T): T {
    if (typeof endpoint !== 'function' || !(endpoint as any).__endpoint?.callableTrigger) return endpoint;
    const guarded = async (req: any, res: any) => {
        const authorization = String(req.headers?.authorization || '');
        const bearer = authorization.match(/^Bearer (.+)$/i)?.[1];
        let hint: any = {};
        try { if (bearer) hint = JSON.parse(Buffer.from(bearer.split('.')[1], 'base64url').toString()); } catch { /* SDK handles invalid tokens. */ }
        if (isPreviewIdentity(hint.sub || hint.user_id, hint)) {
            try {
                const token = await admin.auth().verifyIdToken(bearer!, true);
                assertPreviewClaims(token.uid, token);
                if (!permitsPreviewCall(name, req.body?.data)) throw new Error('readonly');
                const db = admin.firestore();
                const [actor, target, menu] = await db.getAll(db.doc(`users/${token.previewActorUid}`), db.doc(`users/${token.previewTargetUid}`), db.doc('settings/menus_v12'));
                if (!previewActorRole(actor.data(), menu.data()?.admin?.positionConfig) || target.data()?.status !== 'active') throw new Error('revoked');
            } catch {
                res.set('Access-Control-Allow-Origin', String(req.headers?.origin || '*'));
                res.set('Vary', 'Origin');
                res.status(403).json({ error: { status: 'PERMISSION_DENIED', message: '미리보기에서 지원하지 않는 작업이거나 세션이 만료되었습니다. 저장·승인·발송은 차단됩니다.' } });
                return;
            }
        }
        return (endpoint as any)(req, res);
    };
    Object.assign(guarded, endpoint);
    return guarded as T;
}
