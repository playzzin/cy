import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

export interface AdvancePaymentMemoChange {
    id: string;
    memo: string;
    expectedMemo: string;
}

export class AdvancePaymentMemoError extends Error {}

export const advancePaymentMemoService = {
    async save(changes: AdvancePaymentMemoChange[]): Promise<void> {
        if (!changes.length) return;
        if (new Set(changes.map(change => change.id)).size !== changes.length
            || changes.some(change => !change.id || change.id !== change.id.trim() || change.id.includes('/')
                || typeof change.memo !== 'string' || typeof change.expectedMemo !== 'string')) {
            throw new AdvancePaymentMemoError('저장할 가불내역을 확인할 수 없습니다. 화면을 새로고침해 주세요.');
        }
        if (changes.some(change => change.memo.length > 4000)) {
            throw new AdvancePaymentMemoError('비고는 내역별로 4,000자까지 입력할 수 있습니다.');
        }
        await runTransaction(db, async transaction => {
            const entries = changes.map(change => ({ ...change, ref: doc(db, 'advance_payments', change.id) }));
            // Read every source before writing so a merged worker row saves atomically.
            const snapshots = await Promise.all(entries.map(entry => transaction.get(entry.ref)));
            snapshots.forEach((snapshot, index) => {
                if (!snapshot.exists()) {
                    throw new AdvancePaymentMemoError('원본 가불내역이 삭제되었습니다. 입력 내용을 보관한 뒤 새로고침해 주세요.');
                }
                if (String(snapshot.data().memo ?? '') !== entries[index].expectedMemo) {
                    throw new AdvancePaymentMemoError('다른 화면에서 비고가 변경되었습니다. 입력 내용을 보관한 뒤 새로고침해 주세요.');
                }
            });
            entries.forEach(entry => transaction.update(entry.ref, { memo: entry.memo, memoUpdatedAt: serverTimestamp() }));
            // Financial updatedAt determines payroll draft precedence; a note must not advance it.
        });
    },
};
