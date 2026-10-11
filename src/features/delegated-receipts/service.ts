import { collection, doc, getDocs, query, runTransaction, where } from 'firebase/firestore';
import { db } from '../../config/firebase';
import type { DelegatedClaim, PaymentMethod, Receipt } from './model';

export const DELEGATED_RECEIPTS_COLLECTION = 'delegated_receipt_claims';
const IMPORT_CHUNK_SIZE = 100;
const MAX_RECEIPTS_PER_CLAIM = 500;
// Leave room under Firestore's 1 MiB document limit for field/index encoding overhead.
const MAX_DOCUMENT_JSON_BYTES = 700_000;
const MAX_IMPORT_CHUNK_JSON_BYTES = 4_000_000;
const paymentMethods: PaymentMethod[] = ['transfer', 'cash', 'other', 'unknown'];

export class DelegatedReceiptImportError extends Error {
  constructor(readonly added: number, readonly skipped: number, readonly remaining: number, readonly originalError: unknown) {
    super(`가져오기를 완료하지 못했습니다. 저장 ${added}건, 중복 제외 ${skipped}건, 미처리 ${remaining}건입니다. 다시 가져오면 이미 저장된 내역은 건너뜁니다.`);
    this.name = 'DelegatedReceiptImportError';
  }
}

const assertDocumentSize = (value: unknown): void => {
  if (new Blob([JSON.stringify(value)]).size > MAX_DOCUMENT_JSON_BYTES) {
    throw new Error('저장 가능한 내역 크기를 넘었습니다. 메모 길이와 입금 기록 수를 확인해 주세요.');
  }
};

const requireText = (value: unknown, label: string, maxLength: number, required = false): string => {
  if (typeof value !== 'string') throw new Error(`${label}을 확인해 주세요.`);
  const result = value.trim();
  if ((required && !result) || result.length > maxLength) throw new Error(`${label}을 확인해 주세요.`);
  return result;
};

const validateId = (value: unknown): string => {
  const id = requireText(value, '저장 식별자', 500, true);
  if (id.includes('/') || id === '.' || id === '..' || /^__.*__$/.test(id)) {
    throw new Error('저장 식별자를 확인해 주세요.');
  }
  return id;
};

const validateMonth = (value: unknown): string => {
  if (typeof value !== 'string' || !/^20\d{2}-(0[1-9]|1[0-2])$/.test(value)) {
    throw new Error('조회 월을 확인해 주세요.');
  }
  return value;
};

const validateAmount = (value: unknown, nullable: boolean, positive = false): number | null => {
  if (value === null && nullable) return null;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < (positive ? 1 : 0)) {
    throw new Error(positive ? '입금액은 1원 이상의 정수로 입력해 주세요.' : '금액은 0원 이상의 정수로 입력해 주세요.');
  }
  return value;
};

const validateMethod = (value: unknown): PaymentMethod => {
  if (!paymentMethods.includes(value as PaymentMethod)) throw new Error('입금 방법을 확인해 주세요.');
  return value as PaymentMethod;
};

const validateReceipt = (value: Receipt): Receipt => {
  if (!value || typeof value !== 'object') throw new Error('입금 내역을 확인해 주세요.');
  const date = requireText(value.date, '입금일', 10, true);
  const parsedDate = new Date(`${date}T00:00:00Z`);
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsedDate.getTime())
    || parsedDate.toISOString().slice(0, 10) !== date) throw new Error('올바른 입금일을 입력해 주세요.');
  const createdAt = requireText(value.createdAt, '입금 기록 시각', 40, true);
  if (!Number.isFinite(Date.parse(createdAt))) throw new Error('입금 기록 시각을 확인해 주세요.');
  return {
    id: validateId(value.id), amount: validateAmount(value.amount, false, true) as number,
    date, method: validateMethod(value.method), memo: requireText(value.memo, '입금 메모', 2000), createdAt,
  };
};

const validateReceipts = (values: Receipt[]): Receipt[] => {
  if (!Array.isArray(values) || values.length > MAX_RECEIPTS_PER_CLAIM) throw new Error('입금 내역을 확인해 주세요.');
  const receipts = values.map(validateReceipt);
  if (new Set(receipts.map(receipt => receipt.id)).size !== receipts.length) throw new Error('중복된 입금 식별자가 있습니다.');
  if (!Number.isSafeInteger(receipts.reduce((sum, receipt) => sum + receipt.amount, 0))) throw new Error('입금 합계가 허용 범위를 넘었습니다.');
  return receipts;
};

const validateClaim = (claim: DelegatedClaim): DelegatedClaim => {
  if (!claim || typeof claim !== 'object') throw new Error('위임금 내역을 확인해 주세요.');
  if (!['delegate', 'direct', 'unknown'].includes(claim.delegationType)) throw new Error('위임 구분을 확인해 주세요.');
  const grossAmount = validateAmount(claim.grossAmount, true);
  const taxAmount = claim.taxAmount === undefined ? undefined : validateAmount(claim.taxAmount, true);
  if (claim.taxRate !== undefined && claim.taxRate !== null
    && (typeof claim.taxRate !== 'number' || !Number.isFinite(claim.taxRate) || claim.taxRate < 0 || claim.taxRate > 100)) {
    throw new Error('세율은 0%에서 100% 사이로 입력해 주세요.');
  }
  if (grossAmount !== null && taxAmount !== undefined && taxAmount !== null && taxAmount > grossAmount) {
    throw new Error('세금은 노무비를 넘을 수 없습니다.');
  }
  const validated: DelegatedClaim = {
    id: validateId(claim.id), month: validateMonth(claim.month),
    siteName: requireText(claim.siteName, '현장명', 200, true),
    workerName: requireText(claim.workerName, '작업자명', 120, true),
    delegationType: claim.delegationType, paymentMethod: validateMethod(claim.paymentMethod),
    grossAmount, expectedAmount: validateAmount(claim.expectedAmount, true),
    ...(claim.taxRate !== undefined ? { taxRate: claim.taxRate } : {}),
    ...(taxAmount !== undefined ? { taxAmount } : {}),
    receipts: validateReceipts(claim.receipts),
    sourceStatus: requireText(claim.sourceStatus, '원본 상태', 200),
    sourceLabel: requireText(claim.sourceLabel, '원본 위치', 500),
    ...(claim.sourceWorkbookId !== undefined ? { sourceWorkbookId: validateId(claim.sourceWorkbookId) } : {}),
    memo: requireText(claim.memo, '메모', 2000), updatedAt: requireText(claim.updatedAt, '수정 시각', 40),
  };
  assertDocumentSize(validated);
  return validated;
};

const refFor = (id: string) => doc(db, DELEGATED_RECEIPTS_COLLECTION, validateId(id));
const sameReceipt = (first: Receipt, second: Receipt) => first.amount === second.amount
  && first.date === second.date && first.method === second.method && first.memo === second.memo;

const importIdentity = (claim: Pick<DelegatedClaim, 'month' | 'siteName' | 'workerName'>): string =>
  JSON.stringify([claim.month, claim.siteName.normalize('NFKC').trim(), claim.workerName.normalize('NFKC').trim()]);

const sameImportedClaim = (value: unknown, incoming: DelegatedClaim): boolean => {
  if (!value || typeof value !== 'object') return false;
  const existing = value as Partial<DelegatedClaim>;
  // An edited row still belongs to its immutable original workbook and source cell.
  if (incoming.sourceWorkbookId && incoming.sourceLabel && existing.sourceWorkbookId === incoming.sourceWorkbookId
    && existing.sourceLabel === incoming.sourceLabel) return true;
  return typeof existing.month === 'string' && typeof existing.siteName === 'string' && typeof existing.workerName === 'string'
    && importIdentity(existing as DelegatedClaim) === importIdentity(incoming);
};

const collisionImportId = (claim: DelegatedClaim): string => {
  const identity = JSON.stringify([claim.id, importIdentity(claim)]);
  let first = 2166136261;
  let second = 5381;
  for (let index = 0; index < identity.length; index += 1) {
    const code = identity.charCodeAt(index);
    first = Math.imul(first ^ code, 16777619);
    second = Math.imul(second, 33) ^ code;
  }
  return `import-collision-${(first >>> 0).toString(16).padStart(8, '0')}${(second >>> 0).toString(16).padStart(8, '0')}`;
};

export const delegatedReceiptService = {
  async list(month: string): Promise<DelegatedClaim[]> {
    const snapshot = await getDocs(query(collection(db, DELEGATED_RECEIPTS_COLLECTION), where('month', '==', validateMonth(month))));
    return snapshot.docs.map(row => validateClaim({ ...row.data(), id: row.id } as DelegatedClaim))
      .sort((first, second) => first.siteName.localeCompare(second.siteName, 'ko')
        || first.workerName.localeCompare(second.workerName, 'ko') || first.id.localeCompare(second.id));
  },

  async importClaims(claims: DelegatedClaim[]): Promise<{ added: number; skipped: number }> {
    // Validate the entire import before the first write. Stable source IDs make retries safe.
    const validated = claims.map(validateClaim);
    // Legacy net IDs use a sheet/cell address. Preserve different people/months that share that ID.
    const unique = [...new Map(validated.map(claim => [JSON.stringify([claim.id, importIdentity(claim)]), claim])).values()];
    let added = 0;
    let skipped = validated.length - unique.length;
    let offset = 0;
    while (offset < unique.length) {
      const chunk: DelegatedClaim[] = [];
      let bytes = 0;
      while (offset + chunk.length < unique.length && chunk.length < IMPORT_CHUNK_SIZE) {
        const candidate = unique[offset + chunk.length];
        const size = new Blob([JSON.stringify(candidate)]).size;
        if (chunk.length && bytes + size > MAX_IMPORT_CHUNK_JSON_BYTES) break;
        chunk.push(candidate);
        bytes += size;
      }
      let result: number;
      try {
        result = await runTransaction(db, async transaction => {
          const candidates = chunk.map(claim => ({ claim, alternativeId: collisionImportId(claim) }));
          const ids = [...new Set(candidates.flatMap(({ claim, alternativeId }) => [claim.id, alternativeId]))];
          const refs = new Map(ids.map(id => [id, refFor(id)]));
          // Firestore requires every read, including alternative IDs, before the first write.
          const snapshots = await Promise.all(ids.map(id => transaction.get(refs.get(id)!)));
          const existing = new Map<string, unknown>();
          snapshots.forEach((snapshot, index) => { if (snapshot.exists()) existing.set(ids[index], snapshot.data()); });
          const pending = new Map<string, DelegatedClaim>();
          for (const { claim, alternativeId } of candidates) {
            if (sameImportedClaim(existing.get(claim.id), claim) || sameImportedClaim(existing.get(alternativeId), claim)) continue;
            const id = existing.has(claim.id) ? alternativeId : claim.id;
            if (existing.has(id)) throw new Error('가져오기 식별자가 다른 내역과 충돌했습니다. 기존 내역은 보존했습니다.');
            const next = { ...claim, id, updatedAt: new Date().toISOString() };
            // Include planned writes when resolving another colliding row in this same chunk.
            existing.set(id, next);
            pending.set(id, next);
          }
          for (const [id, value] of pending) transaction.set(refs.get(id)!, value);
          return pending.size;
        });
      } catch (error) {
        throw new DelegatedReceiptImportError(added, skipped, unique.length - offset, error);
      }
      added += result;
      skipped += chunk.length - result;
      offset += chunk.length;
    }
    return { added, skipped };
  },

  async saveClaim(claim: DelegatedClaim): Promise<void> {
    const validated = validateClaim(claim);
    await runTransaction(db, async transaction => {
      const ref = refFor(validated.id);
      const current = await transaction.get(ref);
      const receipts = current.exists() ? validateReceipts(current.data().receipts) : validated.receipts;
      assertDocumentSize({ ...(current.exists() ? current.data() : {}), ...validated, receipts });
      transaction.set(ref, { ...validated, receipts, updatedAt: new Date().toISOString() }, { merge: true });
    });
  },

  async addReceipt(claimId: string, receipt: Receipt): Promise<void> {
    const validated = validateReceipt(receipt);
    await runTransaction(db, async transaction => {
      const ref = refFor(claimId);
      const current = await transaction.get(ref);
      if (!current.exists()) throw new Error('위임금 내역을 찾을 수 없습니다. 목록을 다시 불러와 주세요.');
      const receipts = validateReceipts(current.data().receipts);
      const duplicate = receipts.find(item => item.id === validated.id);
      if (duplicate) {
        if (!sameReceipt(duplicate, validated)) throw new Error('같은 입금 식별자로 다른 금액이나 내용이 저장되어 있습니다.');
        return;
      }
      const next = validateReceipts([...receipts, validated]);
      assertDocumentSize({ ...current.data(), receipts: next });
      transaction.update(ref, { receipts: next, updatedAt: new Date().toISOString() });
    });
  },
};
