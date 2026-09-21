import { FieldPath } from 'firebase-admin/firestore';
import * as functions from 'firebase-functions/v1';

export async function readRequestPage(scope: FirebaseFirestore.Query, input: any) {
    const pageSize = input.pageSize === undefined ? 100 : input.pageSize;
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) throw new functions.https.HttpsError('invalid-argument', '조회 건수는 1~100건이어야 합니다.');
    const cursor = input.cursor;
    if (cursor !== undefined && (typeof cursor !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(cursor))) throw new functions.https.HttpsError('invalid-argument', '조회 위치를 확인해 주세요.');
    // Document ID order remains stable when an approval changes the row.
    let query = scope.orderBy(FieldPath.documentId());
    if (cursor) query = query.startAfter(cursor);
    const snapshot = await query.limit(pageSize + 1).get();
    const docs = snapshot.docs.slice(0, pageSize);
    return { docs, nextCursor: snapshot.size > pageSize ? docs[docs.length - 1].id : null };
}
