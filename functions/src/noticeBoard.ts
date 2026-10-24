import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';
import { protectedRegion, requireCallableAuth } from './auth';
import { activeNoticeUser, canManageNotice, canReadNotice, noticeBoardAccess } from './noticeAccess';

const rows = (snapshot: FirebaseFirestore.QuerySnapshot) => snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
const serialize = (value: any): any => {
    if (value && typeof value.toMillis === 'function') return value.toMillis();
    if (Array.isArray(value)) return value.map(serialize);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, serialize(entry)]));
    return value;
};
export async function readNoticeBoard(db: FirebaseFirestore.Firestore, uid: string) {
    return db.runTransaction(async tx => {
        const profile = await tx.get(db.doc('users/' + uid));
        if (!activeNoticeUser(profile.data())) throw new functions.https.HttpsError('permission-denied', '활성 계정이 필요합니다.');
        const [workers, teams, menu, notices] = await Promise.all([
            tx.get(db.collection('workers')), tx.get(db.collection('teams')), tx.get(db.doc('settings/menus_v12')), tx.get(db.collection('notices')),
        ]);
        const user = { ...profile.data(), uid }, workerRows = rows(workers), teamRows = rows(teams);
        return serialize({ access: noticeBoardAccess(user, workerRows, teamRows, menu.data()),
            notices: rows(notices).filter(notice => canReadNotice(notice, user, workerRows, teamRows, menu.data()))
                .map(notice => ({ ...notice, canManage: canManageNotice(notice, user, workerRows, teamRows, menu.data()) })) });
    });
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
