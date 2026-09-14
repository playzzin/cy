import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';
import { buildCardStatementSourceClaimDocumentId, normalizeCardStatementSourceSha256 } from './cardStatementImportIdentity';

type RecordData = Record<string, any>;
const text = (value: unknown): string => String(value ?? '').trim();
const paths = (value: unknown): string[] => Array.isArray(value) ? value.map(text).filter(Boolean) : [];
const activeJobs = new Set(['uploading', 'queued', 'analyzing', 'committing']);
const postedBillings = new Set(['CONFIRMED', 'PAID', 'OVERDUE']);
const hasAmount = (value: unknown): boolean => !Number.isFinite(Number(value ?? 0)) || Number(value ?? 0) !== 0;

/** Pure guard shared by the transaction and regression tests. Never removes money. */
export const assertCardStatementCancellationSafe = (
    jobStatus: string,
    transactions: RecordData[],
    billings: RecordData[],
): void => {
    if (activeJobs.has(jobStatus)) {
        throw new functions.https.HttpsError('failed-precondition', '파일을 처리 중입니다. 분석 또는 저장이 끝난 뒤 다시 시도해 주세요.');
    }
    if (billings.some((billing) => postedBillings.has(text(billing.status).toUpperCase()))) {
        throw new functions.https.HttpsError('failed-precondition', '이미 확정된 청구 내역이 있어 취소할 수 없습니다. 청구 담당자에게 확인해 주세요.');
    }
    if (transactions.some((tx) => text(tx.status).toUpperCase() !== 'CANCELLED' && hasAmount(tx.amount)) ||
        billings.some((billing) => text(billing.status).toUpperCase() !== 'CANCELLED' && (
            hasAmount(billing.totalAmount) || hasAmount(billing.variableCost) ||
            (Array.isArray(billing.lineItems) && billing.lineItems.some((item: RecordData) => hasAmount(item.amount)))
        ))) {
        throw new functions.https.HttpsError('failed-precondition', '저장된 카드 금액이 남아 있습니다. 이 월의 해당 카드 금액을 0으로 바꾸고 전체 저장한 뒤 업로드를 취소해 주세요.');
    }
};

export const cancelStoredCardStatementFile = async (
    db: FirebaseFirestore.Firestore,
    fileId: string,
    actorUid: string,
): Promise<{ ok: true; alreadyCancelled: boolean }> => {
    if (!fileId || fileId.includes('/') || fileId.length > 200) {
        throw new functions.https.HttpsError('invalid-argument', '취소할 업로드 파일을 선택해 주세요.');
    }
    const fileRef = db.collection('cardStatementImportFiles').doc(fileId);
    return db.runTransaction(async (transaction) => {
        const fileSnap = await transaction.get(fileRef);
        if (!fileSnap.exists) throw new functions.https.HttpsError('not-found', '업로드 내역을 찾을 수 없습니다.');
        const file = fileSnap.data() || {};
        if (file.status === 'cancelled') return { ok: true, alreadyCancelled: true };
        const jobId = text(file.jobId);
        const yearMonth = text(file.yearMonth);
        const sourcePath = text(file.storagePath);
        if (!jobId || jobId.includes('/') || !/^\d{4}-(0[1-9]|1[0-2])$/.test(yearMonth) || !sourcePath) {
            throw new functions.https.HttpsError('failed-precondition', '파일의 월 또는 연결 정보를 확인할 수 없습니다. 관리자에게 문의해 주세요.');
        }
        const jobRef = db.collection('cardStatementImportJobs').doc(jobId);
        const jobSnap = await transaction.get(jobRef);
        if (!jobSnap.exists || text(jobSnap.data()?.yearMonth) !== yearMonth) {
            throw new functions.https.HttpsError('failed-precondition', '업로드 작업의 월이 일치하지 않습니다.');
        }
        const hash = normalizeCardStatementSourceSha256(file.sha256);
        const claimRef = hash ? db.collection('cardStatementImportSourceClaims').doc(buildCardStatementSourceClaimDocumentId(hash)) : null;
        const claimSnap = claimRef ? await transaction.get(claimRef) : null;
        const claim = claimSnap?.data() || {};
        const ownsClaim = claim.ownerJobId === jobId && (!claim.ownerFileId || claim.ownerFileId === fileId);
        const results = await transaction.get(db.collection('cardStatementImportResults').where('fileId', '==', fileId));
        const cardIds = new Set(results.docs.map((doc) => text(doc.data().matchedCardId)).filter(Boolean));
        const committedIds = new Set(results.docs.flatMap((doc) => paths(doc.data().committedTransactionIds)));
        const monthTransactions = await transaction.get(db.collection('cardTransactions').where('yearMonth', '==', yearMonth));
        const monthBillings = await transaction.get(db.collection('cardBillings').where('yearMonth', '==', yearMonth));
        const hashTransactions = hash && ownsClaim
            ? await transaction.get(db.collection('cardTransactions').where('statementSourceSha256', '==', hash)) : null;
        const linkedPath = (data: RecordData): boolean => text(data.evidenceUrl) === sourcePath || paths(data.statementAttachmentPaths).includes(sourcePath);
        const linkedTransactions = [...new Map([
            ...monthTransactions.docs.filter((doc) => linkedPath(doc.data()) || cardIds.has(text(doc.data().cardId)) || committedIds.has(doc.id)),
            ...(hashTransactions?.docs || []),
        ].map((doc) => [doc.id, doc])).values()];
        const linkedBillings = monthBillings.docs.filter((doc) => linkedPath(doc.data()) || cardIds.has(text(doc.data().cardId)));
        assertCardStatementCancellationSafe(text(jobSnap.data()?.status), linkedTransactions.map((doc) => doc.data()), linkedBillings.map((doc) => doc.data()));
        const attachments = [...linkedTransactions, ...linkedBillings].filter((doc) => linkedPath(doc.data()));
        if (results.size + attachments.length > 440) {
            throw new functions.https.HttpsError('failed-precondition', '연결된 내역이 많아 자동 취소할 수 없습니다. 관리자에게 문의해 주세요.');
        }
        const now = admin.firestore.FieldValue.serverTimestamp();
        for (const doc of attachments) {
            const data = doc.data();
            transaction.update(doc.ref, {
                statementAttachmentPaths: paths(data.statementAttachmentPaths).filter((path) => path !== sourcePath),
                ...(text(data.evidenceUrl) === sourcePath ? { evidenceUrl: admin.firestore.FieldValue.delete() } : {}),
                updatedAt: now,
            });
        }
        for (const result of results.docs) {
            transaction.update(result.ref, {
                status: 'excluded', exclusionReason: '업로드가 취소되었습니다.',
                cancelledAt: now, cancelledByUid: actorUid, updatedAt: now,
            });
        }
        if (claimRef && ownsClaim) {
            transaction.update(claimRef, { state: 'released', releasedAt: now, releasedByUid: actorUid, updatedAt: now });
        }
        // Keep the source PDF and provenance for audit. Only its active registration is cancelled.
        transaction.update(fileRef, { status: 'cancelled', cancelledAt: now, cancelledByUid: actorUid, updatedAt: now });
        transaction.update(jobRef, { updatedAt: now });
        transaction.set(db.collection('cardStatementImportCancellations').doc(fileId), {
            fileId, jobId, yearMonth, actorUid, cancelledAt: now,
            releasedSourceClaim: ownsClaim, affectedAttachmentDocuments: attachments.map((doc) => doc.ref.path),
        });
        return { ok: true, alreadyCancelled: false };
    });
};
