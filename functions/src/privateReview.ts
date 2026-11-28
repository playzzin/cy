// This broker runs with the production Firebase issuer. The review web service
// only forwards IAP assertions and has no production service-account privileges.
import * as admin from 'firebase-admin';
import { allowedReviewEmail } from './privateReviewIdentity';
import { createHash } from 'node:crypto';
import { protectedRegion } from './auth';
import { normalizePreviewRole, PREVIEW_SECONDS, PREVIEW_UID_PREFIX } from './devPreviewPolicy';

export function ownReviewMembership(profile: any, positions: Array<{ id: string; name: string }>) {
    if (!profile || profile.status !== 'active') return null;
    const roles = [
        profile.position,
        profile.role,
        profile.systemRole,
        ...(Array.isArray(profile.additionalPositions) ? profile.additionalPositions : []),
        ...(Array.isArray(profile.roles) ? profile.roles : []),
    ];
    for (const role of roles) {
        if (typeof role !== 'string' || !role.trim()) continue;
        const position = positions.find((p) =>
            [p.id, p.name].some((v) => normalizePreviewRole(v) === normalizePreviewRole(role)),
        );
        if (position?.id) return { role, positionId: position.id };
    }
    return null;
}

export const privateReviewSession = protectedRegion.https.onRequest(async (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (req.method !== 'POST') {
        res.sendStatus(405);
        return;
    }
    if (process.env.GCLOUD_PROJECT !== 'cyee-9c1e4') {
        res.sendStatus(503);
        return;
    }
    try {
        const allowed = await allowedReviewEmail(req.get('X-Cy-Review-Assertion'));
        const user = await admin.auth().getUserByEmail(allowed);
        if (user.disabled || !user.emailVerified || user.uid.startsWith(PREVIEW_UID_PREFIX)) {
            res.sendStatus(403);
            return;
        }
        const db = admin.firestore();
        const [profile, menu] = await db.getAll(db.doc('users/' + user.uid), db.doc('settings/menus_v12'));
        const membership = ownReviewMembership(profile.data(), menu.data()?.admin?.positionConfig || []);
        if (!membership) {
            res.sendStatus(403);
            return;
        }
        const expiresAt = Math.floor(Date.now() / 1000) + PREVIEW_SECONDS;
        const uid =
            PREVIEW_UID_PREFIX + 'self-' + createHash('sha256').update(user.uid).digest('hex').slice(0, 40);
        const token = await admin.auth().createCustomToken(uid, {
            devPreview: true,
            previewSelf: true,
            previewActorUid: user.uid,
            previewTargetUid: user.uid,
            previewDevRole: membership.role,
            previewExpiresAt: expiresAt,
        });
        res.json({
            token,
            expiresAt,
            positionId: membership.positionId,
            target: {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName || profile.data()?.displayName || '',
                photoURL: user.photoURL || null,
            },
        });
    } catch {
        res.sendStatus(403);
    }
});
