import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';
import { protectedRegion, requireCallableAuth } from './auth';
import { resolvedRoleNames } from './teamExpenseRequests';
import { list, text } from './teamReadPolicy';

const key = (value: unknown) => text(value).toLowerCase().replace(/[\s_-]/g, '');
const ordinary = (value: unknown) => ['', 'user', 'worker', '일반', '작업자', '팀원', '기공', '조공'].includes(key(value));
const leader = (value: unknown) => ['팀장', 'teamlead', 'teamleader'].includes(key(value));
const active = (row: any) => row && row.isActive !== false && !['퇴사', 'inactive', 'retired', 'archived', '출입금지'].includes(text(row.status));
const deny = (): never => { throw new functions.https.HttpsError('permission-denied', '현재 자기 팀에 소속된 일반 작업자의 연결 요청만 승인할 수 있습니다.'); };
const id = (value: unknown) => {
    const result = text(value);
    if (!result || result.length > 500 || result.includes('/') || result === '.' || result === '..') {
        throw new functions.https.HttpsError('invalid-argument', '요청 식별자를 확인해 주세요.');
    }
    return result;
};

async function scopeFor(tx: FirebaseFirestore.Transaction, uid: string) {
    const db = admin.firestore();
    const [profileDoc, menuDoc] = await tx.getAll(db.doc(`users/${uid}`), db.doc('settings/menus_v12'));
    const profile = profileDoc.data();
    if (profile?.status !== 'active' || !resolvedRoleNames(profile, menuDoc.data()).some(leader)) deny();
    const links = [...new Set<string>(list(profile?.linkedWorkerIds).map(text).filter(Boolean))];
    if (!links.length || links.length > 15) deny();
    const anchors = await tx.getAll(...links.map(value => db.collection('workers').doc(id(value))));
    // Both the current account role and its actual worker role must still be team leader.
    const teamIds = [...new Set(anchors.filter(doc => active(doc.data()) && doc.data()?.uid === uid && leader(doc.data()?.role))
        .map(doc => text(doc.data()?.teamId)).filter(Boolean))];
    if (!teamIds.length) deny();
    const [direct, legacy] = await Promise.all([
        tx.getAll(...teamIds.map(value => db.collection('teams').doc(id(value)))),
        tx.get(db.collection('teams').where('legacyId', 'in', teamIds)),
    ]);
    const teams = [...new Map([...direct, ...legacy.docs].filter(doc => doc.exists && active(doc.data())).map(doc => [doc.id, doc])).values()];
    const allowed = [...new Set(teams.flatMap(doc => [doc.id, text(doc.data()?.legacyId)]).filter(Boolean))];
    if (!allowed.length || allowed.length > 30) deny();
    return { allowed, teams: teams.map(doc => ({ id: doc.id, name: text(doc.data()?.name) })) };
}

export function eligibleTeamAccount(actorUid: string, allowed: string[], link: any, worker: any, user: any): boolean {
    return Boolean(link && worker && user && link.uid !== actorUid && link.entityType === 'worker' && link.accountType === 'worker'
        && ['pending', 'active'].includes(link.status) && ['pending', 'active'].includes(user.status)
        && active(worker) && allowed.includes(text(worker.teamId)) && ordinary(worker.role)
        && (!worker.uid || worker.uid === link.uid)
        && [user.role, user.position, user.systemRole, ...list(user.roles), ...list(user.additionalPositions)].every(ordinary)
        && (!user.accountType || user.accountType === 'worker') && (!user.requestedAccountType || user.requestedAccountType === 'worker')
        && list(user.linkedWorkerIds).every(value => value === link.entityId)
        && !list(user.linkedOfficeStaffIds).length && !list(user.linkedCompanyIds).length
        && (!user.primaryLinkId || user.primaryLinkId === link.id)
        && (link.status !== 'active' || (user.status === 'active' && worker.uid === link.uid && list(user.linkedWorkerIds).includes(link.entityId))));
}

async function approveOne(uid: string, linkId: string) {
    const db = admin.firestore();
    const approved = await db.runTransaction(async tx => {
        const scope = await scopeFor(tx, uid);
        const linkRef = db.collection('account_links').doc(linkId);
        const linkDoc = await tx.get(linkRef);
        const link = { ...linkDoc.data(), id: linkId } as any;
        if (!linkDoc.exists || link.entityType !== 'worker' || text(link.entityId).startsWith('new_')) deny();
        const userRef = db.collection('users').doc(id(link.uid));
        const workerRef = db.collection('workers').doc(id(link.entityId));
        const [userDoc, workerDoc, positionsDoc] = await tx.getAll(userRef, workerRef, db.doc('settings/user_menu_positions'));
        const user = userDoc.data();
        const worker = workerDoc.data();
        if (!eligibleTeamAccount(uid, scope.allowed, link, worker, user)) deny();
        // Claims also derive roles from linked records and menu/position settings.
        let assignments: any = {};
        try { assignments = JSON.parse(positionsDoc.data()?.data || '{}'); } catch { deny(); }
        if (list(assignments[link.uid]).length) deny();
        const [office, otherWorkers, positions] = await Promise.all([
            tx.get(db.collection('office_staff').where('uid', '==', link.uid).limit(1)),
            tx.get(db.collection('workers').where('uid', '==', link.uid).limit(2)),
            tx.get(db.collection('positions')),
        ]);
        if (!office.empty || otherWorkers.docs.some(doc => doc.id !== link.entityId)) deny();
        const roles = [user?.position, worker?.role, '일반'].map(key).filter(Boolean);
        if (positions.docs.some(doc => [doc.id, doc.data().id, doc.data().name].map(key).filter(Boolean).some(value => roles.includes(value))
            && !ordinary(doc.data().systemRole))) deny();
        if (link.status === 'active') return { targetUid: link.uid, reused: true };
        const now = admin.firestore.FieldValue.serverTimestamp();
        tx.update(workerRef, { uid: link.uid, updatedAt: now });
        tx.update(userRef, {
            accountType: 'worker', requestedAccountType: admin.firestore.FieldValue.delete(), status: 'active',
            primaryLinkId: linkId, linkedWorkerIds: [link.entityId], position: text(worker?.role) || '일반',
            department: text(worker?.teamName), updatedAt: now,
        });
        tx.update(linkRef, { status: 'active', approvalMode: 'team_leader', approvedBy: uid, approvedAt: now, updatedAt: now });
        tx.create(db.collection('audit_logs').doc(), {
            action: 'APPROVE_TEAM_ACCOUNT_LINK', category: 'AUTH', actorId: uid, targetId: link.uid,
            linkId, workerId: link.entityId, teamId: worker?.teamId, result: 'approved', createdAt: now,
        });
        return { targetUid: link.uid, reused: false };
    });
    let claimsPending = false;
    try { const { refreshAccessClaimsForUid } = await import('./roleClaims'); await refreshAccessClaimsForUid(approved.targetUid); }
    catch { claimsPending = true; } // The user-write trigger retries; selecting this active row retries without approving again.
    return { linkId, status: 'active', reused: approved.reused, claimsPending };
}

export async function handleTeamAccountApprovals(input: any, context: functions.https.CallableContext) {
    const auth = requireCallableAuth(context);
    const db = admin.firestore();
    if (input?.action === 'list') {
        return db.runTransaction(async tx => {
            const scope = await scopeFor(tx, auth.uid);
            // Cursor is a worker ID, not an offset. Every own-team worker is visited once across pages.
            let query = db.collection('workers').where('teamId', 'in', scope.allowed).orderBy(admin.firestore.FieldPath.documentId()).limit(51);
            if (input.cursor) query = query.startAfter(id(input.cursor));
            const page = await tx.get(query);
            const workers = page.docs.slice(0, 50);
            const rows: any[] = [];
            for (let offset = 0; offset < workers.length; offset += 25) {
                const group = workers.slice(offset, offset + 25);
                const links = await tx.get(db.collection('account_links').where('entityId', 'in', group.map(doc => doc.id)));
                const candidates = links.docs.filter(doc => doc.data().entityType === 'worker' && ['pending', 'active'].includes(doc.data().status));
                for (const linkDoc of candidates) {
                    const link = { ...linkDoc.data(), id: linkDoc.id } as any;
                    const worker = group.find(doc => doc.id === link.entityId)?.data();
                    if (!text(link.uid) || text(link.uid).includes('/')) continue;
                    const user = (await tx.get(db.collection('users').doc(link.uid))).data();
                    if (!eligibleTeamAccount(auth.uid, scope.allowed, link, worker, user)) continue;
                    rows.push({ linkId: link.id, workerId: link.entityId, name: text(worker?.name), teamId: text(worker?.teamId),
                        teamName: text(worker?.teamName), status: link.status });
                }
            }
            return { rows, teams: scope.teams, nextCursor: page.size > 50 ? workers[49].id : null };
        });
    }
    if (input?.action === 'approve') {
        const ids = [...new Set<string>((Array.isArray(input.linkIds) ? input.linkIds : []).map(id))];
        if (!ids.length || ids.length > 20) throw new functions.https.HttpsError('invalid-argument', '한 번에 1~20건을 선택해 주세요.');
        const results = [];
        for (const linkId of ids) {
            try { results.push(await approveOne(auth.uid, linkId)); }
            catch (error) {
                const code = error instanceof functions.https.HttpsError ? error.code : 'internal';
                await db.collection('audit_logs').add({ action: 'APPROVE_TEAM_ACCOUNT_LINK_FAILED', category: 'AUTH', actorId: auth.uid, linkId, result: code, createdAt: admin.firestore.FieldValue.serverTimestamp() });
                results.push({ linkId, status: 'failed', code, message: code === 'permission-denied' ? '현재 팀 소속 또는 승인 권한을 확인해 주세요.' : '처리하지 못했습니다. 목록을 새로고침하고 다시 시도해 주세요.' });
            }
        }
        return { results };
    }
    throw new functions.https.HttpsError('invalid-argument', '지원하지 않는 계정 승인 작업입니다.');
}

export const teamAccountApprovals = protectedRegion.https.onCall(handleTeamAccountApprovals);
