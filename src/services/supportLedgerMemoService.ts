import { doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

const refFor = (key: string) => doc(db, 'support_shared_data', `ledger_memo_${encodeURIComponent(key)}`);
export const supportLedgerMemoService = {
  async read(key: string): Promise<string | null> {
    const snapshot = await getDoc(refFor(key));
    return snapshot.exists() ? String(snapshot.data().memo ?? '') : null;
  },
  async save(key: string, memo: string, expected: string | null): Promise<void> {
    if (memo.length > 4000) throw new Error('비고는 4,000자까지 입력할 수 있습니다.');
    await runTransaction(db, async transaction => {
      const ref = refFor(key);
      const current = await transaction.get(ref);
      const value = current.exists() ? String(current.data().memo ?? '') : null;
      if (value !== expected) throw new Error('다른 사용자가 비고를 수정했습니다. 입력 내용을 복사한 뒤 화면을 다시 열어 주세요.');
      transaction.set(ref, { kind: 'support_ledger_memo', memo, updatedAt: serverTimestamp() });
    });
  }
};
