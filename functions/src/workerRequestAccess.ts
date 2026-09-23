import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';
import { resolvedRoleNames } from './teamExpenseRequests';
import { isTeamLeader, list, text } from './teamReadPolicy';

const activeWorker = (row: any) => row && row.isActive !== false
    && !['퇴사', 'inactive', 'retired', 'archived'].includes(text(row.status));

// Read membership inside the write transaction so transfers/revocations are
// checked again on retry. Never authorize by a supplied team ID or a name.
export async function requireWorkerRequestAccess(
    transaction: FirebaseFirestore.Transaction, profile: any, menu: any,
    workerId: string, worker: any, privileged = false,
) {
    const deny = (): never => { throw new functions.https.HttpsError('permission-denied', '본인 또는 현재 소속 팀원만 신청할 수 있습니다.'); };
    if (profile?.status !== 'active' || !activeWorker(worker)) deny();
    if (privileged) return;
    const links = [...new Set<string>(list(profile.linkedWorkerIds).map(text).filter(Boolean))];
    if (links.some(link => [workerId, text(worker.legacyId)].includes(link))) return;
    if (!links.length || links.length > 30 || links.some(link => link.includes('/'))) deny();
    const db = admin.firestore();
    const anchors = (await transaction.getAll(...links.map(link => db.collection('workers').doc(link))))
        .filter(doc => doc.exists && activeWorker(doc.data())).map(doc => doc.data()!);
    if (![...resolvedRoleNames(profile, menu), ...anchors.map(row => row.role)].some(isTeamLeader)) deny();
    const teamIds = [...new Set(anchors.map(row => text(row.teamId)).filter(Boolean))];
    if (!teamIds.length || teamIds.some(team => team.includes('/'))) deny();
    const [direct, legacy] = await Promise.all([
        transaction.getAll(...teamIds.map(team => db.collection('teams').doc(team))),
        transaction.get(db.collection('teams').where('legacyId', 'in', teamIds)),
    ]);
    const allowed = new Set([...direct, ...legacy.docs]
        .filter(doc => doc.exists && doc.data()?.isActive !== false)
        .flatMap(doc => [doc.id, text(doc.data()?.legacyId)]).filter(Boolean));
    if (!allowed.has(text(worker.teamId))) deny();
}
