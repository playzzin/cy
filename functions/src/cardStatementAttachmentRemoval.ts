import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';
import { assertCardStatementStoragePath, getCardStatementFileAnalysisId, getCardStatementDetailAnalysisState, resolveCardStatementYearMonth } from './cardStatementFileDetails';

const paths = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

/** Remove one attachment registration atomically. Financial rows and source claims remain intact. */
export const removeCardStatementAttachment = async (db: FirebaseFirestore.Firestore, input: { storagePath?: unknown; yearMonth?: unknown }, actorUid: string) => {
    const storagePath = assertCardStatementStoragePath(input?.storagePath);
    const yearMonth = resolveCardStatementYearMonth(storagePath, input?.yearMonth);
    const analysisRef = db.collection('cardStatementFileAnalyses').doc(getCardStatementFileAnalysisId(storagePath));
    return db.runTransaction(async transaction => {
        const analysis = (await transaction.get(analysisRef)).data() || {};
        if (analysis.attachmentRemoved === true) return { ok: true, alreadyRemoved: true };
        if (getCardStatementDetailAnalysisState(analysis).analysisStatus === 'analyzing') {
            throw new functions.https.HttpsError('failed-precondition', '분석이 끝난 뒤 파일을 삭제해 주세요.');
        }
        const imports = await transaction.get(db.collection('cardStatementImportFiles').where('storagePath', '==', storagePath));
        const transactions = await transaction.get(db.collection('cardTransactions').where('yearMonth', '==', yearMonth));
        const billings = await transaction.get(db.collection('cardBillings').where('yearMonth', '==', yearMonth));
        const jobIds = [...new Set(imports.docs.map(file => String(file.data().jobId || '')).filter(Boolean))];
        for (const jobId of jobIds) {
            if (jobId.includes('/')) throw new functions.https.HttpsError('failed-precondition', '업로드 작업 정보를 확인해 주세요.');
            const job = await transaction.get(db.collection('cardStatementImportJobs').doc(jobId));
            if (['uploading', 'queued', 'analyzing', 'committing', 'reviewing'].includes(job.data()?.status)) {
                throw new functions.https.HttpsError('failed-precondition', '진행 중인 업로드 작업을 완료하거나 취소한 뒤 파일을 삭제해 주세요.');
            }
        }
        const linked = [...transactions.docs, ...billings.docs].filter(doc => doc.data().evidenceUrl === storagePath || paths(doc.data().statementAttachmentPaths).includes(storagePath));
        if (!linked.length && !imports.size && !analysis.storagePath) {
            throw new functions.https.HttpsError('not-found', '연결된 업로드 파일을 찾을 수 없습니다. 목록을 새로고침해 주세요.');
        }
        if (linked.length + imports.size > 440) throw new functions.https.HttpsError('failed-precondition', '연결된 내역이 많아 삭제할 수 없습니다. 관리자에게 문의해 주세요.');
        const now = admin.firestore.FieldValue.serverTimestamp();
        for (const doc of linked) {
            const data = doc.data();
            const remaining = paths(data.statementAttachmentPaths).filter(path => path !== storagePath);
            transaction.update(doc.ref, {
                statementAttachmentPaths: remaining,
                ...(data.evidenceUrl === storagePath ? { evidenceUrl: remaining[0] || admin.firestore.FieldValue.delete() } : {}),
                updatedAt: now,
            });
        }
        for (const doc of imports.docs) transaction.update(doc.ref, { attachmentRemoved: true, updatedAt: now });
        // Retain the immutable original and analysis for audit; hide it from active attachment lists.
        transaction.set(analysisRef, { storagePath, yearMonth, attachmentRemoved: true, attachmentRemovedAt: now,
            attachmentRemovedByUid: actorUid, updatedAt: now }, { merge: true });
        return { ok: true, alreadyRemoved: false };
    });
};
