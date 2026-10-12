import { collection, doc, getDocs, runTransaction } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';
import { DelegatedClaim, DepositConfirmation } from './model';
import { getDepositState } from './depositState';
import { validateClaim, DELEGATED_RECEIPTS_COLLECTION } from './service';
import { recalculateSiteClaim, SiteTaxRequest, SiteTaxSetting, SiteTaxTarget } from './siteTax';

const settingsPath = `${DELEGATED_RECEIPTS_COLLECTION}/_settings/sites`;
function validateTarget(target: SiteTaxTarget): [string, string] {
  let parts: unknown;
  try { parts = JSON.parse(target.key); } catch { throw new Error('현장 설정 대상을 확인해 주세요.'); }
  if (!Array.isArray(parts) || parts.length !== 2 || !['id', 'name'].includes(parts[0]) || typeof parts[1] !== 'string' || !parts[1].trim() || parts[1].length > 500
    || target.key !== JSON.stringify(parts) || typeof target.name !== 'string' || !target.name.trim() || target.name.length > 500) throw new Error('현장 설정 대상을 확인해 주세요.');
  return parts as [string, string];
}
function validateSetting(setting: SiteTaxSetting): SiteTaxSetting {
  validateTarget(setting);
  if ((setting.taxRate !== null && (typeof setting.taxRate !== 'number' || !Number.isFinite(setting.taxRate) || setting.taxRate < 0 || setting.taxRate > 100))
    || !Number.isSafeInteger(setting.revision) || setting.revision < 1 || typeof setting.operationId !== 'string' || typeof setting.updatedAt !== 'string') throw new Error('저장된 현장 세율을 확인해 주세요.');
  return { key: setting.key, name: setting.name, taxRate: setting.taxRate, revision: setting.revision, operationId: setting.operationId, updatedAt: setting.updatedAt };
}
const idFor = async (key: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key))), byte => byte.toString(16).padStart(2, '0')).join('');

export const siteTaxService = {
  async list(): Promise<SiteTaxSetting[]> {
    const snapshot = await getDocs(collection(db, settingsPath));
    return snapshot.docs.map(row => validateSetting(row.data() as SiteTaxSetting));
  },
  async save(request: SiteTaxRequest): Promise<{ setting: SiteTaxSetting; claims: DelegatedClaim[] }> {
    const parts = validateTarget(request.target);
    const { taxRate, selected, operationId } = request;
    if ((taxRate !== null && (typeof taxRate !== 'number' || !Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100))
      || !Number.isSafeInteger(request.revision) || request.revision < 0 || typeof operationId !== 'string' || !operationId.trim() || operationId.length > 200
      || !/^20\d{2}-(0[1-9]|1[0-2])$/.test(request.month) || !Array.isArray(selected) || selected.length > 400 || (selected.length > 0 && taxRate === null)
      || new Set(selected.map(row => row.id)).size !== selected.length
      || selected.some(row => typeof row.id !== 'string' || !row.id || row.id.length > 500 || row.id.includes('/') || ['.', '..'].includes(row.id) || typeof row.updatedAt !== 'string')) throw new Error('현장 세율과 선택한 내역을 확인해 주세요.');
    const signature = JSON.stringify([request.target.key, taxRate, request.month, [...selected].sort((a, b) => a.id.localeCompare(b.id))]);
    const settingRef = doc(db, settingsPath, await idFor(request.target.key));
    const refs = selected.map(row => doc(db, DELEGATED_RECEIPTS_COLLECTION, row.id));
    return runTransaction(db, async transaction => {
      const settingsSnapshot = await transaction.get(settingRef);
      const snapshots = await Promise.all(refs.map(ref => transaction.get(ref)));
      const previous = settingsSnapshot.exists() ? validateSetting(settingsSnapshot.data() as SiteTaxSetting) : undefined;
      if (previous && previous.key !== request.target.key) throw new Error('현장 설정 연결을 확인해 주세요.');
      if (previous?.operationId === operationId) {
        if (settingsSnapshot.data()?.signature !== signature) throw new Error('같은 저장 요청의 내용이 다릅니다.');
        return { setting: previous, claims: snapshots.map((snapshot, index) => {
          if (!snapshot.exists()) throw new Error('입금 내역을 찾을 수 없습니다.');
          return validateClaim({ ...snapshot.data(), id: refs[index].id } as DelegatedClaim);
        }) };
      }
      if ((previous?.revision ?? 0) !== request.revision) throw new Error('다른 사용자가 현장 세율을 변경했습니다. 창을 닫고 새로고침한 뒤 다시 확인해 주세요.');
      const recordedAt = new Date().toISOString();
      const nextClaims = snapshots.map((snapshot, index) => {
        if (!snapshot.exists()) throw new Error('입금 내역을 찾을 수 없습니다. 새로고침해 주세요.');
        const current = validateClaim({ ...snapshot.data(), id: refs[index].id } as DelegatedClaim);
        // Linked legacy rows are explicitly matched against a supplied canonical site name.
        const normalize = (name: string) => name.normalize('NFKC').replace(/\s+/g, '').toLowerCase();
        const sameSite = parts[0] === 'id' ? (current.siteId ? current.siteId === parts[1] : normalize(current.siteName) === normalize(request.target.name))
          : !current.siteId && normalize(current.siteName) === parts[1];
        if (!sameSite || current.month !== request.month) throw new Error('선택한 내역의 월·현장이 다릅니다.');
        if (current.updatedAt !== selected[index].updatedAt) throw new Error('선택한 내역이 변경되었습니다. 창을 닫고 새로고침한 뒤 금액을 다시 확인해 주세요.');
        const state = getDepositState(current);
        const event: DepositConfirmation = { id: operationId, recordedAt, status: state.status, recipient: state.recipient,
          note: `현장 세율 ${taxRate}% 적용`, listChange: { field: 'taxRate', value: taxRate }, ...(auth?.currentUser ? { actorId: auth.currentUser.uid } : {}) };
        return validateClaim({ ...recalculateSiteClaim(current, taxRate!, recordedAt), confirmationHistory: [...(current.confirmationHistory ?? []), event] });
      });
      const setting: SiteTaxSetting = { ...request.target, taxRate, revision: request.revision + 1, operationId, updatedAt: recordedAt };
      transaction.set(settingRef, { ...setting, signature, previousTaxRate: previous?.taxRate ?? null, ...(auth?.currentUser ? { updatedBy: auth.currentUser.uid } : {}) });
      nextClaims.forEach((claim, index) => transaction.update(refs[index], { taxRate: claim.taxRate, taxAmount: claim.taxAmount, expectedAmount: claim.expectedAmount,
        originalGrossAmount: claim.originalGrossAmount, originalExpectedAmount: claim.originalExpectedAmount, confirmationHistory: claim.confirmationHistory, updatedAt: recordedAt }));
      return { setting, claims: nextClaims };
    });
  },
};
