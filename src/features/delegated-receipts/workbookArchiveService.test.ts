import { createHash } from 'crypto';
import { collection, doc, getDoc, getDocs, query, runTransaction, where } from 'firebase/firestore';
import { delegatedReceiptService } from './service';
import { workbookArchiveService } from './workbookArchiveService';
import type { DelegatedClaim } from './model';
import type { parseDelegatedWorkbook, UnclassifiedSourceRow } from './workbookImport';

jest.mock('../../config/firebase', () => ({ db: {} }));
jest.mock('./service', () => ({ DELEGATED_RECEIPTS_COLLECTION: 'delegated_receipt_claims', delegatedReceiptService: { importClaims: jest.fn() } }));
jest.mock('firebase/firestore', () => ({ collection: jest.fn(), doc: jest.fn(), getDoc: jest.fn(), getDocs: jest.fn(), query: jest.fn(), runTransaction: jest.fn(), where: jest.fn() }));

type Ref = { path: string; id: string };
type Json = Record<string, any>;
const root = 'delegated_receipt_claims';
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const claim: DelegatedClaim = { id: 'claim-test', month: '2026-09', siteName: '가상현장', workerName: '가상작업자', delegationType: 'unknown', paymentMethod: 'unknown', grossAmount: 100000, expectedAmount: null, receipts: [], sourceStatus: '', sourceLabel: '가상시트!A3', memo: '', updatedAt: '2026-10-11T00:00:00Z' };
const review: UnclassifiedSourceRow = { id: 'review-test', sourceLabel: '가상시트!A8', sourceTitle: '제목 없음', workerName: '가상미분류', grossAmount: null, sourceStatus: '확인 필요', reason: '월 확인 필요', rawCells: [{ address: 'A8', value: '가상미분류' }, { address: 'B8', value: 100, formula: 'SUM(B1:B2)', formattedText: '100', comment: '확인 메모' }] };
const parsed = (): ReturnType<typeof parseDelegatedWorkbook> => ({ claims: [clone(claim)], warnings: ['미분류 행을 확인해 주세요.'], unclassifiedRows: [clone(review)], sheetSummaries: [{ name: '가상시트', populatedCells: 10, claimCount: 1, reviewRowCount: 1 }] });
const bytes = () => Uint8Array.from({ length: 300000 }, (_, index) => index % 256);
let records: Map<string, Json>;

const snapshot = (ref: Ref) => ({ id: ref.id, exists: () => records.has(ref.path), data: () => clone(records.get(ref.path)) });
const transactionImplementation = async (_db: unknown, callback: (tx: unknown) => Promise<unknown>) => {
  const pending = new Map<string, Json>();
  const result = await callback({
    get: async (ref: Ref) => snapshot(ref),
    set: (ref: Ref, value: Json) => pending.set(ref.path, clone(value)),
    update: (ref: Ref, value: Json) => pending.set(ref.path, { ...clone(records.get(ref.path)), ...clone(value) }),
  });
  pending.forEach((value, path) => records.set(path, value));
  return result;
};

beforeEach(() => {
  jest.clearAllMocks(); records = new Map();
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: { subtle: {
    digest: async (_algorithm: string, input: ArrayBuffer) => Uint8Array.from(createHash('sha256').update(new Uint8Array(input)).digest()).buffer,
  } } });
  const makeRef = (_db: unknown, ...parts: string[]): Ref => ({ path: parts.join('/'), id: parts[parts.length - 1] });
  (doc as jest.Mock).mockImplementation(makeRef);
  (collection as jest.Mock).mockImplementation(makeRef);
  (where as jest.Mock).mockImplementation((field, op, value) => ({ field, op, value }));
  (query as jest.Mock).mockImplementation((ref, filter) => ({ ...ref, filter }));
  (getDoc as jest.Mock).mockImplementation(async ref => snapshot(ref));
  (getDocs as jest.Mock).mockImplementation(async (ref: Ref & { filter?: { field: string; value: unknown } }) => ({ docs: [...records.entries()]
    .filter(([path, value]) => path.startsWith(`${ref.path}/`) && path.split('/').length === ref.path.split('/').length + 1
      && (!ref.filter || value[ref.filter.field] === ref.filter.value))
    .map(([path]) => snapshot({ path, id: path.split('/').pop()! })) }));
  (runTransaction as jest.Mock).mockImplementation(transactionImplementation);
  (delegatedReceiptService.importClaims as jest.Mock).mockResolvedValue({ added: 1, skipped: 0 });
});

it('원본을 여러 조각과 미분류 행으로 보관하고 재조립 SHA 검증 후 완료 처리한다', async () => {
  const original = bytes();
  const result = await workbookArchiveService.importWorkbook(original, '가상원본.xlsx', parsed(), [claim]);
  expect(result).toEqual({ archiveId: `workbook-${createHash('sha256').update(original).digest('hex')}`, added: 1, skipped: 0, reviewRows: 1 });
  expect(records.get(`${root}/${result.archiveId}`)).toEqual(expect.objectContaining({ status: 'complete', byteLength: original.length, chunkCount: 2, claimCount: 1, reviewRowCount: 1 }));
  expect(records.get(`${root}/${result.archiveId}`)).not.toHaveProperty('month');
  expect(await workbookArchiveService.downloadOriginal(result.archiveId)).toEqual(original);
  expect(await workbookArchiveService.listReviewRows(result.archiveId)).toEqual([review]);
  expect(delegatedReceiptService.importClaims).toHaveBeenCalledWith([expect.objectContaining({ id: claim.id, sourceWorkbookId: result.archiveId, receipts: [] })]);
});

it('같은 원본을 이름을 바꾸어 재가져와도 최초 메타와 조각을 덮어쓰지 않는다', async () => {
  const result = await workbookArchiveService.importWorkbook(bytes(), '첫원본.xlsx', parsed(), [claim]);
  const before = clone([...records.entries()]);
  (delegatedReceiptService.importClaims as jest.Mock).mockResolvedValueOnce({ added: 0, skipped: 1 });
  expect(await workbookArchiveService.importWorkbook(bytes(), '다른이름.xlsx', parsed(), [claim])).toEqual({ archiveId: result.archiveId, added: 0, skipped: 1, reviewRows: 1 });
  expect([...records.entries()]).toEqual(before);
});

it('청구 저장 실패 시 원본과 미분류행은 보존하고 같은 파일 재시도로 완료한다', async () => {
  (delegatedReceiptService.importClaims as jest.Mock).mockRejectedValueOnce(new Error('unavailable'));
  await expect(workbookArchiveService.importWorkbook(bytes(), '가상.xlsx', parsed(), [claim])).rejects.toThrow('unavailable');
  const [archive] = await workbookArchiveService.listArchives();
  expect(archive.status).toBe('archiving');
  expect(await workbookArchiveService.downloadOriginal(archive.id)).toEqual(bytes());
  expect(await workbookArchiveService.listReviewRows(archive.id)).toEqual([review]);
  await workbookArchiveService.importWorkbook(bytes(), '가상.xlsx', parsed(), [claim]);
  expect((await workbookArchiveService.listArchives())[0].status).toBe('complete');
});

it('조각 저장 실패는 완료로 표시하지 않고 새 시도에서 복구한다', async () => {
  (runTransaction as jest.Mock).mockImplementationOnce(transactionImplementation).mockRejectedValueOnce(new Error('unavailable'));
  await expect(workbookArchiveService.importWorkbook(bytes(), '가상.xlsx', parsed(), [claim])).rejects.toThrow('unavailable');
  expect((await workbookArchiveService.listArchives())[0].status).toBe('archiving');
  expect(delegatedReceiptService.importClaims).not.toHaveBeenCalled();
  await workbookArchiveService.importWorkbook(bytes(), '가상.xlsx', parsed(), [claim]);
  expect((await workbookArchiveService.listArchives())[0].status).toBe('complete');
});

it('원본 조각 손상은 다운로드와 재가져오기에서 거부하며 손상본도 덮어쓰지 않는다', async () => {
  const { archiveId } = await workbookArchiveService.importWorkbook(bytes(), '가상.xlsx', parsed(), [claim]);
  const path = `${root}/${archiveId}/source_chunks/000000`;
  records.set(path, { ...records.get(path), data: btoa('changed') });
  await expect(workbookArchiveService.downloadOriginal(archiveId)).rejects.toThrow('조각 검증');
  await expect(workbookArchiveService.importWorkbook(bytes(), '가상.xlsx', parsed(), [claim])).rejects.toThrow('다른 보관 내용');
  expect(records.get(path)?.data).toBe(btoa('changed'));
});

it('누락된 원본 조각과 다른 전체 SHA를 통과시키지 않는다', async () => {
  const { archiveId } = await workbookArchiveService.importWorkbook(bytes(), '가상.xlsx', parsed(), [claim]);
  const path = `${root}/${archiveId}/source_chunks/000001`;
  const preserved = records.get(path)!;
  records.delete(path);
  await expect(workbookArchiveService.downloadOriginal(archiveId)).rejects.toThrow('누락');
  records.set(path, preserved);
  const metaPath = `${root}/${archiveId}`;
  records.set(metaPath, { ...records.get(metaPath), sha256: '0'.repeat(64) });
  await expect(workbookArchiveService.downloadOriginal(archiveId)).rejects.toThrow('보관 정보');
});

it('각 조각의 해시가 맞더라도 재조립 전체 원본 해시가 다르면 다운로드하지 않는다', async () => {
  const { archiveId } = await workbookArchiveService.importWorkbook(bytes(), '가상.xlsx', parsed(), [claim]);
  const path = `${root}/${archiveId}/source_chunks/000001`;
  const chunk = records.get(path)!;
  const altered = Uint8Array.from(atob(chunk.data), character => character.charCodeAt(0));
  altered[0] ^= 1;
  const data = Array.from(altered, value => String.fromCharCode(value)).join('');
  records.set(path, { ...chunk, data: btoa(data), sha256: createHash('sha256').update(altered).digest('hex') });
  await expect(workbookArchiveService.downloadOriginal(archiveId)).rejects.toThrow('원본 파일 검증');
});

it('누락된 준비 행은 원본 저장 전에 거부한다', async () => {
  await expect(workbookArchiveService.importWorkbook(bytes(), '가상.xlsx', parsed(), [])).rejects.toThrow('행 수');
  expect(runTransaction).not.toHaveBeenCalled();
});

it('월별 청구와 혼합된 컬렉션에서 보관 메타만 조회한다', async () => {
  await workbookArchiveService.importWorkbook(bytes(), '가상.xlsx', parsed(), [claim]);
  records.set(`${root}/${claim.id}`, claim);
  const archives = await workbookArchiveService.listArchives();
  expect(archives).toHaveLength(1);
  expect(where).toHaveBeenCalledWith('recordType', '==', 'source-workbook');
});
