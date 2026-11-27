import * as admin from 'firebase-admin';
import { FieldPath } from 'firebase-admin/firestore';
import * as functions from 'firebase-functions/v1';
import { protectedRegion, requireCallableAuth } from './auth';
import { activeNoticeUser, canManageNotice, canReadNotice, noticeBoardAccess, noticeLinkedWorkerIds } from './noticeAccess';

const rows = (snapshot: FirebaseFirestore.QuerySnapshot): FirebaseFirestore.DocumentData[] => snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
const serialize = (value: any): any => {
    if (value && typeof value.toMillis === 'function') return value.toMillis();
    if (Array.isArray(value)) return value.map(serialize);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, serialize(entry)]));
    return value;
};
// Include every possible match for the account, including inactive and ambiguous legacy links.
export async function readNoticeWorkers(db: FirebaseFirestore.Firestore, tx: FirebaseFirestore.Transaction,
    user: FirebaseFirestore.DocumentData, teams: FirebaseFirestore.DocumentData[]) {
    const directory = db.collection('workers').select('uid', 'legacyId', 'isActive', 'status', 'role', 'teamId', 'name');
    const ids = noticeLinkedWorkerIds(user);
    const all = async () => rows(await tx.get(directory));
    if (ids.length > 30) return all();
    const queries = [directory.where('uid', '==', user.uid)];
    if (ids.length) queries.push(directory.where('legacyId', 'in', ids));
    const docIds = ids.filter(id => !id.includes('/') && id !== '.' && id !== '..' && Buffer.byteLength(id) <= 1500);
    if (docIds.length) queries.push(directory.where(FieldPath.documentId(), 'in', docIds));
    const matches = (await Promise.all(queries.map(query => tx.get(query)))).flatMap(rows);
    // Old teams may identify their leader by name alone. Include every namesake
    // so the existing rule can still reject ambiguous matches on that team.
    const leaderNames = [...new Set(teams.filter(team => !team.leaderId && team.leaderName &&
        matches.some(worker => worker.name === team.leaderName && [team.id, team.legacyId].filter(Boolean).includes(worker.teamId)))
        .map(team => team.leaderName))];
    if (leaderNames.length > 30) return all();
    if (leaderNames.length) matches.push(...rows(await tx.get(directory.where('name', 'in', leaderNames))));
    return [...new Map(matches.map(worker => [worker.id, worker])).values()];
}

export async function readNoticeBoard(db: FirebaseFirestore.Firestore, uid: string) {
    return db.runTransaction(async tx => {
        const profile = await tx.get(db.doc('users/' + uid));
        if (!activeNoticeUser(profile.data())) throw new functions.https.HttpsError('permission-denied', '활성 계정이 필요합니다.');
        const user = { ...profile.data(), uid };
        const directory = tx.get(db.collection('teams').select('name', 'legacyId', 'isActive', 'leaderId', 'leaderName')).then(async snapshot => {
            const teamRows = rows(snapshot);
            return { teamRows, workerRows: await readNoticeWorkers(db, tx, user, teamRows) };
        });
        const [{ teamRows, workerRows }, menu, notices] = await Promise.all([
            directory, tx.get(db.doc('settings/menus_v12')), tx.get(db.collection('notices')),
        ]);
        return serialize({ access: noticeBoardAccess(user, workerRows, teamRows, menu.data()),
            notices: rows(notices).filter(notice => canReadNotice(notice, user, workerRows, teamRows, menu.data()))
                .map(notice => ({ ...notice, canManage: canManageNotice(notice, user, workerRows, teamRows, menu.data()) })) });
    }, { readOnly: true });
}
export async function deleteManagedNotice(db: FirebaseFirestore.Firestore, uid: string, noticeId: unknown) {
    if (typeof noticeId !== 'string' || !/^[a-zA-Z0-9:_-]{1,180}$/.test(noticeId)) throw new functions.https.HttpsError('invalid-argument', '공지 정보가 올바르지 않습니다.');
    return db.runTransaction(async tx => {
        const ref = db.doc('notices/' + noticeId);
        const [profile, notice, workers, teams, menu] = await Promise.all([
            tx.get(db.doc('users/' + uid)), tx.get(ref), tx.get(db.collection('workers')), tx.get(db.collection('teams')), tx.get(db.doc('settings/menus_v12')),
        ]);
        if (!notice.exists || !canManageNotice(notice.data()!, { ...profile.data(), uid }, rows(workers), rows(teams), menu.data()) || !profile.exists) {
            throw new functions.https.HttpsError('permission-denied', '삭제할 수 있는 공지가 아닙니다.');
        }
        const revision = notice.get('notificationRevision');
        const message = revision ? await tx.get(db.doc('erp_messages/notice-' + revision)) : null;
        if (message?.exists) tx.update(message.ref, { status: 'archived', updatedAt: admin.firestore.Timestamp.now() });
        tx.delete(ref);
        return { ok: true };
    });
}
export const getNoticeBoard = protectedRegion.https.onCall((_, context) => readNoticeBoard(admin.firestore(), requireCallableAuth(context).uid));
export const deleteNotice = protectedRegion.https.onCall((data, context) => deleteManagedNotice(admin.firestore(), requireCallableAuth(context).uid, data?.noticeId));
