import { collection, doc, getDocs, runTransaction } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';

export interface SiteMemoTarget { key: string; month: string; name: string; }
export interface SiteMemo extends SiteMemoTarget { memo: string; revision: number; operationId: string; updatedAt: string; }
export class SiteMemoConflictError extends Error {
  constructor() { super('다른 사용자가 현장 메모를 변경했습니다. 작성한 내용을 복사해 둔 뒤 새로고침하여 확인해 주세요.'); }
}
// Finance subcollections inherit existing access rules. No worker claim is created.
const pathFor = (month: string) => {
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('귀속월을 확인해 주세요.');
  return `delegated_receipt_claims/_site_memos/months/${month}/sites`;
};
const validateTarget = (target: SiteMemoTarget) => {
  pathFor(target.month);
  let parts: unknown;
  try { parts = JSON.parse(target.key); } catch { throw new Error('현장을 확인해 주세요.'); }
  if (!Array.isArray(parts) || parts.length !== 3 || parts[0] !== target.month || !['id', 'name'].includes(parts[1])
    || typeof parts[2] !== 'string' || !parts[2].trim() || parts[2].length > 500 || target.key !== JSON.stringify(parts)
    || typeof target.name !== 'string' || !target.name.trim() || target.name.length > 500) throw new Error('현장을 확인해 주세요.');
};
const validateMemo = (value: unknown, month: string): SiteMemo => {
  const memo = value as SiteMemo;
  validateTarget(memo);
  if (memo.month !== month || typeof memo.memo !== 'string' || memo.memo.length > 2000
    || !Number.isSafeInteger(memo.revision) || memo.revision < 1 || typeof memo.operationId !== 'string'
    || typeof memo.updatedAt !== 'string') throw new Error('현장 메모를 확인해 주세요.');
  return { key: memo.key, month: memo.month, name: memo.name, memo: memo.memo, revision: memo.revision, operationId: memo.operationId, updatedAt: memo.updatedAt };
};
const idFor = async (key: string) => {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
};
export const siteMemoService = {
  async list(month: string): Promise<SiteMemo[]> {
    const snapshot = await getDocs(collection(db, pathFor(month)));
    return snapshot.docs.map(row => validateMemo(row.data(), month));
  },
  async save(target: SiteMemoTarget, memo: string, expectedRevision: number, operationId: string): Promise<SiteMemo> {
    validateTarget(target);
    if (typeof memo !== 'string' || memo.length > 2000 || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0
      || !operationId || operationId.length > 200) throw new Error('메모 입력 내용을 확인해 주세요.');
    const value = memo.trim();
    const ref = doc(db, pathFor(target.month), await idFor(target.key));
    return runTransaction(db, async transaction => {
      const snapshot = await transaction.get(ref);
      const previous = snapshot.exists() ? validateMemo(snapshot.data(), target.month) : undefined;
      if (previous && previous.key !== target.key) throw new Error('현장 메모 연결을 확인해 주세요.');
      if (previous?.operationId === operationId) {
        if (previous.memo !== value) throw new Error('같은 저장 요청의 내용이 다릅니다.');
        return previous;
      }
      if ((previous?.revision ?? 0) !== expectedRevision) throw new SiteMemoConflictError();
      const next: SiteMemo = { ...target, name: target.name.trim(), memo: value, revision: expectedRevision + 1, operationId, updatedAt: new Date().toISOString() };
      transaction.set(ref, { ...next, previousMemo: previous?.memo ?? '', ...(auth?.currentUser ? { updatedBy: auth.currentUser.uid } : {}) });
      return next;
    });
  },
};
