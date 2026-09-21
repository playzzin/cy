import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';
import { readRequestPage } from './teamRequestPagination';

export const DRAFT_RETENTION_DAYS = 30;
const expired = (row: any, now: number) => {
    const time = Date.parse(row.updatedAt || row.createdAt || '');
    return Number.isFinite(time) && time <= now - DRAFT_RETENTION_DAYS * 86_400_000;
};

export async function maintainRequestDrafts(input: any, canReview: boolean, collection: string, folder: string) {
    if (!canReview) throw new functions.https.HttpsError('permission-denied', '임시 신청 정리는 사무실 직원만 할 수 있습니다.');
    const db = admin.firestore();
    if (input.action === 'drafts') {
        const page = await readRequestPage(db.collection(collection).where('status', 'in', ['uploading', 'discarding']), input);
        return { retentionDays: DRAFT_RETENTION_DAYS, nextCursor: page.nextCursor, drafts: page.docs.filter(doc => doc.data().status === 'discarding' || expired(doc.data(), Date.now())).map(doc => ({
            id: doc.id, lastActivityAt: doc.data().updatedAt || doc.data().createdAt, retry: doc.data().status === 'discarding'
        })) };
    }
    if (typeof input.id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(input.id)) throw new functions.https.HttpsError('invalid-argument', '임시 신청을 확인해 주세요.');
    const ref = db.collection(collection).doc(input.id);
    const ownerUid = await db.runTransaction(async transaction => {
        const row = (await transaction.get(ref)).data();
        if (!row || row.status === 'discarded') return null;
        if (row.status !== 'discarding' && (row.status !== 'uploading' || !expired(row, Date.now()))) throw new functions.https.HttpsError('failed-precondition', '최근 사용했거나 제출된 신청은 정리할 수 없습니다.');
        if (typeof row.ownerUid !== 'string' || !row.ownerUid || row.ownerUid.includes('/')) throw new functions.https.HttpsError('failed-precondition', '첨부 소유 정보를 확인해 주세요.');
        transaction.update(ref, { status: 'discarding' });
        return row.ownerUid;
    });
    if (!ownerUid) return { deleted: true };
    // The transaction prevents new uploads/submission before removing files.
    // A partial failure leaves a retryable marker; submitted requests never enter it.
    await admin.storage().bucket().deleteFiles({ prefix: `${folder}/${ownerUid}/${ref.id}/` });
    // Keep the parent as a permanent tombstone. Deleting it lets a retry reuse
    // the same ID while another cleanup is still deleting that storage prefix.
    for (const child of await ref.listCollections()) await db.recursiveDelete(child);
    await db.runTransaction(async transaction => {
        const row = (await transaction.get(ref)).data();
        if (row?.status === 'discarding') transaction.set(ref, { status: 'discarded', ownerUid, discardedAt: new Date().toISOString() });
    });
    return { deleted: true };
}
