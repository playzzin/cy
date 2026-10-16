import * as admin from 'firebase-admin';
import { createHash } from 'crypto';
import { protectedRegion, requireCallableAuth } from './auth';
import * as functions from 'firebase-functions/v1';
import { isPreviewIdentity, normalizePreviewRole, PREVIEW_SECONDS, PREVIEW_UID_PREFIX, previewDevRole } from './devPreviewPolicy';

const fail = (message: string): never => { throw new functions.https.HttpsError('permission-denied', message); };
async function requireDev(context: functions.https.CallableContext) {
    const actor = requireCallableAuth(context);
    if (isPreviewIdentity(context.auth?.uid, context.auth?.token)) fail('미리보기 안에서는 다른 세션을 시작할 수 없습니다.');
    const db = admin.firestore();
    const [profile, menu] = await db.getAll(db.doc(`users/${actor!.uid}`), db.doc('settings/menus_v12'));
    const positions = menu.data()?.admin?.positionConfig || [];
    const rawRole = previewDevRole(profile.data(), positions);
    if (!rawRole) fail('활성 DEV 계정만 사용자 시점을 확인할 수 있습니다.');
    return { actor: actor!, rawRole: rawRole!, positions, db };
}
function accountSummary(uid: string, profile: any, positions: any[], workers: any[] = []) {
    const roles = [profile.role, profile.position, ...(profile.additionalPositions || []), ...workers.map(worker => worker.role)].map(normalizePreviewRole);
    return {
        uid, displayName: String(profile.displayName || workers[0]?.name || '이름 없는 계정'),
        positionIds: positions.filter(position => roles.includes(normalizePreviewRole(position.id)) || roles.includes(normalizePreviewRole(position.name))).map(position => position.id),
        scopeLabel: [...new Set(workers.map(worker => String(worker.teamName || '')).filter(Boolean))].join(', ') || String(profile.department || '계정 연결 기준'),
        additionalPositions: profile.additionalPositions || [],
        linked: Boolean(profile.linkedWorkerIds?.length || profile.linkedOfficeStaffIds?.length || profile.linkedCompanyIds?.length),
    };
}
export const getDevPreviewAccounts = protectedRegion.https.onCall(async (_data, context) => {
    const { db, positions } = await requireDev(context);
    const users = await db.collection('users').where('status', '==', 'active')
        .select('displayName', 'role', 'position', 'additionalPositions', 'linkedWorkerIds', 'linkedOfficeStaffIds', 'linkedCompanyIds', 'department').get();
    const links: string[] = [...new Set<string>(users.docs.flatMap(doc => doc.data().linkedWorkerIds || []))].filter(id => typeof id === 'string' && id && !id.includes('/'));
    const workers = new Map<string, any>();
    for (let offset = 0; offset < links.length; offset += 100) {
        const docs = await db.getAll(...links.slice(offset, offset + 100).map(id => db.doc(`workers/${id}`)), { fieldMask: ['name', 'role', 'teamName'] });
        docs.forEach(doc => workers.set(doc.id, doc.data()));
    }
    return { accounts: users.docs.filter(doc => !doc.id.startsWith(PREVIEW_UID_PREFIX)).map(doc => accountSummary(doc.id, doc.data(), positions, (doc.data().linkedWorkerIds || []).map((id: string) => workers.get(id)).filter(Boolean))) };
});
export const createDevPreviewSession = protectedRegion.https.onCall(async (data, context) => {
    const { db, actor, rawRole } = await requireDev(context);
    const targetUid = String(data?.targetUid || '');
    if (!targetUid || targetUid.length > 128 || targetUid.includes('/') || targetUid.startsWith(PREVIEW_UID_PREFIX)) fail('미리보기 계정을 선택해 주세요.');
    const target = (await db.doc(`users/${targetUid}`).get()).data();
    if (!target || target.status !== 'active') fail('활성 사용자 계정만 미리볼 수 있습니다.');
    const authUser = await admin.auth().getUser(targetUid);
    if (authUser.disabled) fail('비활성 계정은 미리볼 수 없습니다.');
    const expiresAt = Math.floor(Date.now() / 1000) + PREVIEW_SECONDS;
    // Never mint the target user's credentials. A reserved identity cannot write,
    // including after its preview claims are removed or its session is refreshed.
    const previewUid = PREVIEW_UID_PREFIX + createHash('sha256').update(actor.uid).digest('hex').slice(0, 40);
    const token = await admin.auth().createCustomToken(previewUid, {
        devPreview: true, previewActorUid: actor.uid, previewTargetUid: targetUid,
        previewDevRole: rawRole, previewExpiresAt: expiresAt,
    });
    return { token, expiresAt, target: { uid: targetUid, displayName: String(target.displayName || ''), email: target.email || null, photoURL: target.photoURL || null } };
});
