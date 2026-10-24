import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { isAdvancePaymentDepositAccount, type AdvancePaymentDepositAccount } from '../types/advancePaymentDepositAccount';

export interface AdvancePaymentDepositAccountChange {
    id: string;
    depositAccount: AdvancePaymentDepositAccount;
    expectedDepositAccount: AdvancePaymentDepositAccount;
}

export class AdvancePaymentDepositAccountError extends Error {}

export const advancePaymentDepositAccountService = {
    async save(changes: AdvancePaymentDepositAccountChange[]): Promise<void> {
        if (!changes.length) return;
        if (new Set(changes.map(change => change.id)).size !== changes.length
            || changes.some(change => !change.id || change.id !== change.id.trim() || change.id.includes('/')
                || !isAdvancePaymentDepositAccount(change.depositAccount)
                || !isAdvancePaymentDepositAccount(change.expectedDepositAccount))) {
            throw new AdvancePaymentDepositAccountError('저장할 입금계좌와 가불내역을 확인해 주세요.');
        }
        await runTransaction(db, async transaction => {
            const entries = changes.map(change => ({ ...change, ref: doc(db, 'advance_payments', change.id) }));
            const snapshots = await Promise.all(entries.map(entry => transaction.get(entry.ref)));
            snapshots.forEach((snapshot, index) => {
                if (!snapshot.exists()) {
                    throw new AdvancePaymentDepositAccountError('원본 가불내역이 삭제되었습니다. 새로고침해 주세요.');
                }
                if ((snapshot.data().depositAccount ?? '') !== entries[index].expectedDepositAccount) {
                    throw new AdvancePaymentDepositAccountError('다른 화면에서 입금계좌가 변경되었습니다. 새로고침한 뒤 다시 선택해 주세요.');
                }
            });
            // Preserve amounts, notes, and the financial updatedAt used for payroll precedence.
            entries.forEach(entry => transaction.update(entry.ref, {
                depositAccount: entry.depositAccount, depositAccountUpdatedAt: serverTimestamp(),
            }));
        });
    },
};
