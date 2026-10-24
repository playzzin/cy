import { collection, doc, getDoc, getDocs, query, runTransaction, where } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { DELEGATED_RECEIPTS_COLLECTION, delegatedReceiptService } from './service';
import type { DelegatedClaim } from './model';
import type { parseDelegatedWorkbook, UnclassifiedSourceRow } from './workbookImport';

type ParsedWorkbook = ReturnType<typeof parseDelegatedWorkbook>;
export interface WorkbookArchive {
  id: string;
  recordType: 'source-workbook';
  fileName: string;
  sha256: string;
  byteLength: number;
  chunkCount: number;
  claimCount: number;
  reviewRowCount: number;
  months: string[];
  status: 'archiving' | 'complete';
  createdAt: string;
  sheetSummaries: ParsedWorkbook['sheetSummaries'];
  warnings: string[];
}

export interface WorkbookSourceChunk {
  index: number;
  byteLength: number;
  sha256: string;
  encoding: 'base64';
  data: string;
}

const CHUNK_BYTES = 256 * 1024;
const MAX_WORKBOOK_BYTES = 10 * 1024 * 1024;
const MAX_DOCUMENT_BYTES = 700_000;
const archiveRef = (id: string) => doc(db, DELEGATED_RECEIPTS_COLLECTION, validateArchiveId(id));
const validateArchiveId = (id: string): string => {
  if (!/^workbook-[a-f0-9]{64}$/.test(id)) throw new Error('원본 보관 식별자를 확인해 주세요.');
  return id;
};
const validateRowId = (id: string): string => {
  if (!id || id.length > 500 || id.includes('/') || id === '.' || id === '..' || /^__.*__$/.test(id)) {
    throw new Error('분류 대기 행 식별자를 확인해 주세요.');
  }
  return id;
};
const clean = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const assertDocumentSize = (value: unknown): void => {
  if (new Blob([JSON.stringify(value)]).size > MAX_DOCUMENT_BYTES) throw new Error('원본 보관 정보가 문서 크기 제한을 넘었습니다.');
};
const stableJson = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(',')}}`;
  return JSON.stringify(value);
};
const hashBytes = async (bytes: Uint8Array): Promise<string> => {
  if (!globalThis.crypto?.subtle) throw new Error('원본 검증을 위해 보안 연결(HTTPS)로 접속해 주세요.');
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes.slice().buffer);
  return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
};
const encodeBytes = (bytes: Uint8Array): string => {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...Array.from(bytes.subarray(offset, offset + 8192)));
  }
  return btoa(binary);
};
const decodeBytes = (value: string): Uint8Array => {
  try { return Uint8Array.from(atob(value), character => character.charCodeAt(0)); }
  catch { throw new Error('보관된 원본 조각이 손상되었습니다.'); }
};

const readArchive = (id: string, value: unknown): WorkbookArchive => {
  validateArchiveId(id);
  const archive = value as WorkbookArchive;
  if (!archive || archive.recordType !== 'source-workbook' || archive.sha256 !== id.slice(9)
    || !Number.isSafeInteger(archive.byteLength) || archive.byteLength < 1 || archive.byteLength > MAX_WORKBOOK_BYTES
    || archive.chunkCount !== Math.ceil(archive.byteLength / CHUNK_BYTES)
    || !['archiving', 'complete'].includes(archive.status) || !Array.isArray(archive.months)
    || !Array.isArray(archive.sheetSummaries) || !Array.isArray(archive.warnings)) {
    throw new Error('원본 보관 정보가 올바르지 않습니다.');
  }
  return { ...archive, id };
};

const createSnapshots = async (archiveId: string, subcollection: string, rows: Array<{ id: string; value: unknown }>): Promise<void> => {
  let offset = 0;
  while (offset < rows.length) {
    const chunk: typeof rows = [];
    let bytes = 0;
    while (offset + chunk.length < rows.length && chunk.length < 100) {
      const row = rows[offset + chunk.length];
      const size = new Blob([JSON.stringify(row.value)]).size;
      if (chunk.length && bytes + size > 4_000_000) break;
      chunk.push(row); bytes += size;
    }
    await runTransaction(db, async transaction => {
      const refs = chunk.map(row => doc(db, DELEGATED_RECEIPTS_COLLECTION, archiveId, subcollection, row.id));
      const snapshots = await Promise.all(refs.map(ref => transaction.get(ref)));
      snapshots.forEach((snapshot, index) => {
        if (snapshot.exists()) {
          if (stableJson(snapshot.data()) !== stableJson(chunk[index].value)) throw new Error('같은 원본 식별자에 다른 보관 내용이 있습니다. 기존 원본을 보존했습니다.');
        } else transaction.set(refs[index], chunk[index].value as Record<string, unknown>);
      });
    });
    offset += chunk.length;
  }
};

export const workbookArchiveService = {
  async importWorkbook(bytes: Uint8Array, fileName: string, parsed: ParsedWorkbook, preparedClaims: DelegatedClaim[]): Promise<{ archiveId: string; added: number; skipped: number; reviewRows: number }> {
    if (!bytes.length || bytes.length > MAX_WORKBOOK_BYTES) throw new Error('10MB 이하의 원본 Excel 파일을 선택해 주세요.');
    if (!fileName.trim() || fileName.length > 255) throw new Error('원본 파일명을 확인해 주세요.');
    const sourceIds = new Set(parsed.claims.map(claim => claim.id));
    if (sourceIds.size !== parsed.claims.length || preparedClaims.length !== parsed.claims.length
      || new Set(preparedClaims.map(claim => claim.id)).size !== sourceIds.size
      || preparedClaims.some(claim => !sourceIds.has(claim.id))) throw new Error('원본과 저장 대상 행 수가 다릅니다. 파일을 다시 선택해 주세요.');
    const reviewRows = clean(parsed.unclassifiedRows);
    if (new Set(reviewRows.map(row => row.id)).size !== reviewRows.length) throw new Error('분류 대기 행 식별자가 중복되었습니다.');
    reviewRows.forEach(row => { validateRowId(row.id); assertDocumentSize(row); });
    const original = bytes.slice();
    const sha256 = await hashBytes(original);
    const archiveId = `workbook-${sha256}`;
    const chunks: WorkbookSourceChunk[] = [];
    for (let offset = 0; offset < original.length; offset += CHUNK_BYTES) {
      const part = original.subarray(offset, offset + CHUNK_BYTES);
      chunks.push({ index: chunks.length, byteLength: part.length, sha256: await hashBytes(part), encoding: 'base64', data: encodeBytes(part) });
    }
    const archive: WorkbookArchive = clean({
      id: archiveId, recordType: 'source-workbook', fileName: fileName.trim(), sha256, byteLength: original.length,
      chunkCount: chunks.length, claimCount: parsed.claims.length, reviewRowCount: reviewRows.length,
      months: [...new Set(parsed.claims.map(claim => claim.month))].sort(), status: 'archiving',
      createdAt: new Date().toISOString(), sheetSummaries: parsed.sheetSummaries, warnings: parsed.warnings,
    });
    assertDocumentSize(archive);
    await runTransaction(db, async transaction => {
      const ref = archiveRef(archiveId);
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists()) { transaction.set(ref, archive); return; }
      const current = readArchive(archiveId, snapshot.data());
      if (current.byteLength !== archive.byteLength || current.claimCount !== archive.claimCount
        || current.reviewRowCount !== archive.reviewRowCount || stableJson(current.sheetSummaries) !== stableJson(archive.sheetSummaries)) {
        throw new Error('이미 보관한 원본의 분류 정보와 다릅니다. 기존 원본을 보존했습니다.');
      }
    });
    await createSnapshots(archiveId, 'source_chunks', chunks.map(chunk => ({ id: String(chunk.index).padStart(6, '0'), value: chunk })));
    await createSnapshots(archiveId, 'unclassified_rows', reviewRows.map(row => ({ id: row.id, value: row })));
    // Verify the remotely stored original and review rows before declaring the import complete.
    await workbookArchiveService.downloadOriginal(archiveId);
    const storedReviewRows = await workbookArchiveService.listReviewRows(archiveId);
    if (storedReviewRows.length !== reviewRows.length || stableJson([...storedReviewRows].sort((a, b) => a.id.localeCompare(b.id)))
      !== stableJson([...reviewRows].sort((a, b) => a.id.localeCompare(b.id)))) throw new Error('분류 대기 행 보관 검증에 실패했습니다. 다시 가져오기를 시도해 주세요.');
    const result = await delegatedReceiptService.importClaims(preparedClaims.map(claim => ({ ...claim, sourceWorkbookId: archiveId })));
    await runTransaction(db, async transaction => {
      const ref = archiveRef(archiveId);
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists()) throw new Error('원본 보관 정보를 찾을 수 없습니다.');
      const current = readArchive(archiveId, snapshot.data());
      if (current.status !== 'complete') transaction.update(ref, { status: 'complete' });
    });
    return { archiveId, ...result, reviewRows: reviewRows.length };
  },

  async listArchives(): Promise<WorkbookArchive[]> {
    const snapshots = await getDocs(query(collection(db, DELEGATED_RECEIPTS_COLLECTION), where('recordType', '==', 'source-workbook')));
    return snapshots.docs.map(snapshot => readArchive(snapshot.id, snapshot.data()))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async listReviewRows(archiveId: string): Promise<UnclassifiedSourceRow[]> {
    validateArchiveId(archiveId);
    const snapshot = await getDocs(collection(db, DELEGATED_RECEIPTS_COLLECTION, archiveId, 'unclassified_rows'));
    return snapshot.docs.map(row => ({ ...row.data(), id: row.id } as UnclassifiedSourceRow))
      .sort((a, b) => a.sourceLabel.localeCompare(b.sourceLabel, 'ko', { numeric: true }));
  },

  async downloadOriginal(archiveId: string): Promise<Uint8Array> {
    const snapshot = await getDoc(archiveRef(archiveId));
    if (!snapshot.exists()) throw new Error('보관된 원본을 찾을 수 없습니다.');
    const archive = readArchive(archiveId, snapshot.data());
    const stored = await getDocs(collection(db, DELEGATED_RECEIPTS_COLLECTION, archiveId, 'source_chunks'));
    if (stored.docs.length !== archive.chunkCount) throw new Error('원본 보관이 아직 완료되지 않았거나 조각이 누락되었습니다.');
    const chunks = stored.docs.map(row => ({ id: row.id, ...row.data() } as WorkbookSourceChunk & { id: string }))
      .sort((a, b) => a.index - b.index);
    const original = new Uint8Array(archive.byteLength);
    let offset = 0;
    for (let index = 0; index < chunks.length; index += 1) {
      const chunk = chunks[index];
      if (chunk.index !== index || chunk.id !== String(index).padStart(6, '0') || chunk.encoding !== 'base64' || typeof chunk.data !== 'string') {
        throw new Error('원본 조각의 순서 또는 형식이 올바르지 않습니다.');
      }
      const bytes = decodeBytes(chunk.data);
      const expectedLength = Math.min(CHUNK_BYTES, archive.byteLength - offset);
      if (bytes.length !== expectedLength || chunk.byteLength !== bytes.length || await hashBytes(bytes) !== chunk.sha256) {
        throw new Error('원본 조각 검증에 실패했습니다.');
      }
      original.set(bytes, offset); offset += bytes.length;
    }
    if (offset !== archive.byteLength || await hashBytes(original) !== archive.sha256) throw new Error('원본 파일 검증에 실패했습니다.');
    return original;
  },
};
