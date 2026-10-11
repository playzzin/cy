import { collection, doc, getDocs, query, runTransaction, where } from 'firebase/firestore';
import { delegatedReceiptService } from './service';
import type { DelegatedClaim, DepositConfirmation, Receipt } from './model';
import { getDelegation, getDepositState } from './depositState';

jest.mock('../../config/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn((_db: unknown, path: string) => ({ path })),
  doc: jest.fn((_db: unknown, _path: string, id: string) => ({ id })),
  where: jest.fn((field: string, op: string, value: string) => ({ field, op, value })),
  query: jest.fn((...parts: unknown[]) => parts), getDocs: jest.fn(), runTransaction: jest.fn(),
}));

const receipt = (overrides: Partial<Receipt> = {}): Receipt => ({
  id: 'receipt-a', amount: 250000, date: '2026-10-09', method: 'transfer', memo: '',
  createdAt: '2026-10-09T09:00:00.000Z', ...overrides,
});
const claim = (overrides: Partial<DelegatedClaim> = {}): DelegatedClaim => ({
  id: 'claim-a', month: '2026-09', siteName: '테스트 현장', workerName: '테스트 작업자',
  delegationType: 'delegate', paymentMethod: 'unknown', grossAmount: null, expectedAmount: null,
  receipts: [], sourceStatus: '', sourceLabel: '테스트', memo: '', updatedAt: '', ...overrides,
});
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
let records: Map<string, DelegatedClaim>;

const createTransaction = () => {
  const pending = new Map<string, DelegatedClaim>();
  return {
    get: jest.fn(async (ref: { id: string }) => {
      if (pending.size) throw new Error('Transaction reads must precede all writes');
      const value = records.get(ref.id);
      return { exists: () => Boolean(value), data: () => value && clone(value) };
    }),
    set: jest.fn((ref: { id: string }, value: DelegatedClaim, options?: { merge: boolean }) => pending.set(ref.id, { ...(options?.merge ? clone(records.get(ref.id) || {} as DelegatedClaim) : {}), ...clone(value) })),
    update: jest.fn((ref: { id: string }, value: Partial<DelegatedClaim>) => {
      pending.set(ref.id, { ...clone(records.get(ref.id)!), ...clone(value) });
    }),
    commit: () => pending.forEach((value, id) => records.set(id, value)),
  };
};

beforeEach(() => {
  jest.clearAllMocks();
  records = new Map();
  // CRA enables resetMocks, so restore reference/query builders for every test.
  (collection as jest.Mock).mockImplementation((_db: unknown, path: string) => ({ path }));
  (doc as jest.Mock).mockImplementation((_db: unknown, _path: string, id: string) => ({ id }));
  (where as jest.Mock).mockImplementation((field: string, op: string, value: string) => ({ field, op, value }));
  (query as jest.Mock).mockImplementation((...parts: unknown[]) => parts);
  (runTransaction as jest.Mock).mockImplementation(async (_db, callback) => {
    const transaction = createTransaction();
    const result = await callback(transaction);
    transaction.commit();
    return result;
  });
});

it('해당 월만 조회하고 금액 미확정과 0원을 구분한다', async () => {
  const values = [claim({ id: 'zero', expectedAmount: 0 }), claim({ id: 'unknown', expectedAmount: null })];
  (getDocs as jest.Mock).mockResolvedValue({ docs: values.map(value => ({ id: value.id, data: () => value })) });
  const result = await delegatedReceiptService.list('2026-09');
  expect(where).toHaveBeenCalledWith('month', '==', '2026-09');
  expect(query).toHaveBeenCalledTimes(1);
  expect(result.find(value => value.id === 'zero')?.expectedAmount).toBe(0);
  expect(result.find(value => value.id === 'unknown')?.expectedAmount).toBeNull();
});

it('잘못된 월로 전체 조회를 시도하지 않는다', async () => {
  await expect(delegatedReceiptService.list('2026-13')).rejects.toThrow('조회 월');
  expect(getDocs).not.toHaveBeenCalled();
});

it('재가져오기 및 같은 파일의 중복 행은 기존 수정값과 입금을 보존한다', async () => {
  const saved = claim({ expectedAmount: 500000, memo: '확인함', receipts: [receipt()] });
  records.set(saved.id, saved);
  const result = await delegatedReceiptService.importClaims([claim(), claim(), claim({ id: 'claim-b' })]);
  expect(result).toEqual({ added: 1, skipped: 2 });
  expect(records.get(saved.id)).toEqual(saved);
  expect(records.get('claim-b')?.expectedAmount).toBeNull();
});

it('가져오기 전체를 검증한 뒤 저장을 시작한다', async () => {
  await expect(delegatedReceiptService.importClaims([claim(), claim({ id: 'invalid', expectedAmount: -1 })]))
    .rejects.toThrow('금액');
  expect(runTransaction).not.toHaveBeenCalled();
});

it('이미 저장된 세후 366건을 다시 가져오면 ID·입금·사용자 설정을 모두 보존한다', async () => {
  const incoming = Array.from({ length: 366 }, (_, index) => claim({
    id: `net-${index.toString(16).padStart(16, '0')}`, workerName: `가상 작업자 ${index}`,
    grossAmount: null, expectedAmount: 100000, sourceLabel: `가상시트!A${index + 4}`,
  }));
  const saved = incoming.map(value => ({ ...value, expectedAmount: 90000, memo: '사용자 확인', receipts: [receipt()] }));
  saved.forEach(value => records.set(value.id, clone(value)));
  expect(await delegatedReceiptService.importClaims(incoming)).toEqual({ added: 0, skipped: 366 });
  expect([...records.values()]).toEqual(saved);
});

it.each([
  { month: '2026-10' },
  { workerName: '다른 가상 작업자' },
  { siteName: '다른 가상 현장' },
])('같은 세후 셀 ID에 다른 월·작업자·현장이 오면 대체 ID로 저장하고 재시도는 건너뛴다: %s', async identityChange => {
  const saved = claim({ id: 'net-legacy', expectedAmount: 90000, sourceLabel: '가상시트!A4', receipts: [receipt()], memo: '기존 확인값' });
  records.set(saved.id, clone(saved));
  const incoming = claim({ ...saved, ...identityChange, expectedAmount: 200000, receipts: [], memo: '' });
  expect(await delegatedReceiptService.importClaims([incoming])).toEqual({ added: 1, skipped: 0 });
  const added = [...records.values()].find(value => value.id !== saved.id)!;
  expect(added.id).toMatch(/^import-collision-[a-f0-9]{16}$/);
  expect(added).toEqual(expect.objectContaining({ ...identityChange, expectedAmount: 200000, receipts: [] }));
  const edited = { ...added, expectedAmount: 180000, memo: '새 내역 확인', receipts: [receipt({ id: 'new-receipt' })] };
  records.set(added.id, edited);
  expect(await delegatedReceiptService.importClaims([incoming])).toEqual({ added: 0, skipped: 1 });
  expect(records.size).toBe(2);
  expect(records.get(saved.id)).toEqual(saved);
  expect(records.get(added.id)).toEqual(edited);
});

it('같은 묶음의 동일 ID·다른 identity를 미리 제거하지 않고 모두 저장한다', async () => {
  const first = claim({ id: 'net-shared' });
  const nextMonth = claim({ id: 'net-shared', month: '2026-10' });
  const nextWorker = claim({ id: 'net-shared', workerName: '다른 가상 작업자' });
  expect(await delegatedReceiptService.importClaims([first, nextMonth, nextWorker, nextMonth])).toEqual({ added: 3, skipped: 1 });
  expect(records.size).toBe(3);
  expect(records.get('net-shared')).toEqual(expect.objectContaining({ month: first.month, workerName: first.workerName }));
  expect(await delegatedReceiptService.importClaims([nextWorker, nextMonth, first])).toEqual({ added: 0, skipped: 3 });
  expect(records.size).toBe(3);
});

it('충돌이 100건 묶음 경계를 넘어도 추가와 재시도 집계가 정확하다', async () => {
  const values = Array.from({ length: 105 }, (_, index) => claim({ id: 'net-shared', workerName: `가상 작업자 ${index}` }));
  expect(await delegatedReceiptService.importClaims(values)).toEqual({ added: 105, skipped: 0 });
  expect(records.size).toBe(105);
  expect(await delegatedReceiptService.importClaims([...values].reverse())).toEqual({ added: 0, skipped: 105 });
});

it('동시 가져오기 재실행에서 먼저 저장된 다른 내역을 보존하고 대체 ID를 선택한다', async () => {
  const incoming = claim({ id: 'net-race', month: '2026-10' });
  const other = claim({ id: 'net-race', month: '2026-09', receipts: [receipt()] });
  (runTransaction as jest.Mock).mockImplementationOnce(async (_db, callback) => {
    await callback(createTransaction());
    records.set(other.id, other);
    const retry = createTransaction();
    const result = await callback(retry);
    retry.commit();
    return result;
  });
  expect(await delegatedReceiptService.importClaims([incoming])).toEqual({ added: 1, skipped: 0 });
  expect(records.size).toBe(2);
  expect(records.get(other.id)).toEqual(other);
  expect([...records.values()].find(value => value.id !== other.id)?.month).toBe('2026-10');
});

it('같은 원본 셀의 작업자·월을 사용자가 수정한 경우 재가져오기에서 복제하지 않는다', async () => {
  const original = claim({ id: 'net-edited', sourceLabel: '가상시트!A4', sourceWorkbookId: `workbook-${'a'.repeat(64)}` });
  const edited = { ...original, month: '2026-10', workerName: '수정한 가상 이름', receipts: [receipt()] };
  records.set(edited.id, clone(edited));
  expect(await delegatedReceiptService.importClaims([original])).toEqual({ added: 0, skipped: 1 });
  expect(records.get(edited.id)).toEqual(edited);
  const differentWorkbook = { ...original, sourceWorkbookId: `workbook-${'b'.repeat(64)}` };
  expect(await delegatedReceiptService.importClaims([differentWorkbook])).toEqual({ added: 1, skipped: 0 });
});

it('대체 ID에도 다른 내역이 있으면 기존 자료와 묶음 전체를 보존하고 실패를 알린다', async () => {
  const legacy = claim({ id: 'net-legacy' });
  const incoming = claim({ id: 'net-legacy', month: '2026-10' });
  records.set(legacy.id, legacy);
  await delegatedReceiptService.importClaims([incoming]);
  const alternative = [...records.values()].find(value => value.id !== legacy.id)!;
  records.set(alternative.id, { ...alternative, workerName: '다른 내역으로 변경', receipts: [receipt()] });
  const before = clone([...records.entries()]);
  await expect(delegatedReceiptService.importClaims([claim({ id: 'new-before-conflict' }), incoming]))
    .rejects.toMatchObject({ added: 0, skipped: 0, remaining: 2, originalError: expect.objectContaining({ message: expect.stringContaining('충돌') }) });
  expect([...records.entries()]).toEqual(before);
  expect(records.has('new-before-conflict')).toBe(false);
});

it('대량 가져오기는 100건씩 처리하며 일부 실패 시 저장 건수를 알리고 재시도로 회복한다', async () => {
  const values = Array.from({ length: 250 }, (_, index) => claim({ id: `claim-${index}` }));
  let attempt = 0;
  (runTransaction as jest.Mock).mockImplementation(async (_db, callback) => {
    attempt += 1;
    if (attempt === 2) throw new Error('unavailable');
    const transaction = createTransaction();
    const result = await callback(transaction);
    transaction.commit();
    return result;
  });
  await expect(delegatedReceiptService.importClaims(values)).rejects.toMatchObject({ added: 100, skipped: 0, remaining: 150 });
  expect(records.size).toBe(100);
  expect(await delegatedReceiptService.importClaims(values)).toEqual({ added: 150, skipped: 100 });
  expect(records.size).toBe(250);
});

it('입금 메모가 많아 문서 크기 제한을 넘으면 쓰기 전에 거부한다', async () => {
  const receipts = Array.from({ length: 200 }, (_, index) => receipt({ id: `receipt-${index}`, memo: '가'.repeat(1500) }));
  await expect(delegatedReceiptService.saveClaim(claim({ receipts }))).rejects.toThrow('크기');
  expect(runTransaction).not.toHaveBeenCalled();
});

it('신규 수동 내역을 저장한다', async () => {
  await delegatedReceiptService.saveClaim(claim({ grossAmount: 600000, expectedAmount: 580000 }));
  expect(records.get('claim-a')).toEqual(expect.objectContaining({ grossAmount: 600000, expectedAmount: 580000, receipts: [] }));
  expect(records.get('claim-a')?.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
});

it('원본 보관 식별자를 가져오기 및 조회에서 보존한다', async () => {
  const archived = claim({ sourceWorkbookId: `workbook-${'a'.repeat(64)}` });
  await delegatedReceiptService.importClaims([archived]);
  expect(records.get(archived.id)?.sourceWorkbookId).toBe(archived.sourceWorkbookId);
  (getDocs as jest.Mock).mockResolvedValue({ docs: [{ id: archived.id, data: () => records.get(archived.id) }] });
  expect((await delegatedReceiptService.list(archived.month))[0].sourceWorkbookId).toBe(archived.sourceWorkbookId);
});

it('세율과 세금을 저장하고 세금이 노무비를 넘으면 거부한다', async () => {
  await delegatedReceiptService.saveClaim(claim({ grossAmount: 600000, taxRate: 3.3, taxAmount: 19800, expectedAmount: 580200 }));
  expect(records.get('claim-a')).toEqual(expect.objectContaining({ taxRate: 3.3, taxAmount: 19800 }));
  await expect(delegatedReceiptService.saveClaim(claim({ grossAmount: 1000, taxAmount: 1001 }))).rejects.toThrow('세금');
  await expect(delegatedReceiptService.saveClaim(claim({ taxRate: 101 }))).rejects.toThrow('세율');
  await expect(delegatedReceiptService.saveClaim(claim({ taxRate: Number.NaN }))).rejects.toThrow('세율');
});

it('오래된 편집 화면에서 저장해도 최신 입금 이력이 사라지지 않는다', async () => {
  records.set('claim-a', claim({ receipts: [receipt()] }));
  await delegatedReceiptService.saveClaim(claim({ expectedAmount: 500000, receipts: [] }));
  expect(records.get('claim-a')?.receipts).toEqual([receipt()]);
  expect(records.get('claim-a')?.expectedAmount).toBe(500000);
});

it('동시 입금에 따른 transaction 재실행 시 두 입금을 모두 보존한다', async () => {
  records.set('claim-a', claim());
  const other = receipt({ id: 'receipt-b', amount: 100000 });
  (runTransaction as jest.Mock).mockImplementationOnce(async (_db, callback) => {
    await callback(createTransaction()); // Firestore discards this attempt after a competing write.
    records.set('claim-a', claim({ receipts: [other] }));
    const retry = createTransaction();
    const result = await callback(retry);
    retry.commit();
    return result;
  });
  await delegatedReceiptService.addReceipt('claim-a', receipt());
  expect(records.get('claim-a')?.receipts).toEqual([other, receipt()]);
});

it('같은 입금의 재시도는 중복 금액을 만들지 않는다', async () => {
  records.set('claim-a', claim());
  await delegatedReceiptService.addReceipt('claim-a', receipt());
  await delegatedReceiptService.addReceipt('claim-a', receipt());
  expect(records.get('claim-a')?.receipts).toHaveLength(1);
});

it('같은 입금 식별자의 다른 내용은 오류로 알려준다', async () => {
  records.set('claim-a', claim({ receipts: [receipt()] }));
  await expect(delegatedReceiptService.addReceipt('claim-a', receipt({ amount: 999999 })))
    .rejects.toThrow('같은 입금 식별자');
  expect(records.get('claim-a')?.receipts).toEqual([receipt()]);
});

it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])('잘못된 입금액 %s는 저장하지 않는다', async amount => {
  await expect(delegatedReceiptService.addReceipt('claim-a', receipt({ amount }))).rejects.toThrow('입금액');
  expect(runTransaction).not.toHaveBeenCalled();
});

it('존재하지 않는 날짜 및 청구 내역을 거부한다', async () => {
  await expect(delegatedReceiptService.addReceipt('claim-a', receipt({ date: '2026-02-30' }))).rejects.toThrow('입금일');
  await expect(delegatedReceiptService.addReceipt('missing', receipt())).rejects.toThrow('찾을 수 없습니다');
});

it('Firestore 실패를 성공한 저장이나 빈 조회로 처리하지 않는다', async () => {
  (getDocs as jest.Mock).mockRejectedValueOnce(new Error('permission-denied'));
  await expect(delegatedReceiptService.list('2026-09')).rejects.toThrow('permission-denied');
  (runTransaction as jest.Mock).mockRejectedValueOnce(new Error('unavailable'));
  await expect(delegatedReceiptService.saveClaim(claim())).rejects.toThrow('unavailable');
});

const confirmation = (changes: Partial<DepositConfirmation> = {}): DepositConfirmation => ({ id: 'confirmation-a', status: 'complete', recipient: 'personal', note: '', recordedAt: '2026-10-12T01:00:00Z', ...changes });
it('일괄 확인은 실제 입금액 없이 완료를 저장하고 계좌 구분을 유지한다', async () => {
  records.set('claim-a', claim({ sourceStatus: '개인 통장' }));
  records.set('claim-b', claim({ id: 'claim-b', sourceStatus: '이재욱 위임 입금 전' }));
  await delegatedReceiptService.confirmClaims(['claim-a', 'claim-b'], confirmation(), true);
  expect(records.get('claim-a')).toMatchObject({ confirmation: { status: 'complete', recipient: 'personal' }, receipts: [], expectedAmount: null });
  expect(records.get('claim-b')?.confirmation?.recipient).toBe('jaewook_leader');
  await delegatedReceiptService.confirmClaims(['claim-a', 'claim-b'], confirmation(), true);
  expect(records.get('claim-a')?.confirmationHistory).toHaveLength(1);
});
it('재시도는 이후 확인을 되돌리지 않고 같은 식별자의 다른 내용은 거부한다', async () => {
  records.set('claim-a', claim());
  await delegatedReceiptService.confirmClaims(['claim-a'], confirmation());
  await delegatedReceiptService.confirmClaims(['claim-a'], confirmation({ id: 'confirmation-b', status: 'pending' }));
  await delegatedReceiptService.confirmClaims(['claim-a'], confirmation());
  expect(records.get('claim-a')?.confirmation?.status).toBe('pending');
  await expect(delegatedReceiptService.confirmClaims(['claim-a'], confirmation({ status: 'unknown' }))).rejects.toThrow('같은 확인 식별자');
});
it('기준 금액 수정과 입금 기록 추가는 최신 확인 이력과 팀 연결을 지우지 않는다', async () => {
  records.set('claim-a', claim({ confirmation: confirmation(), confirmationHistory: [confirmation()], assignedTeamId: 'team-a' }));
  await delegatedReceiptService.saveClaim(claim({ expectedAmount: 100, confirmation: confirmation({ status: 'unknown' }) }));
  await delegatedReceiptService.addReceipt('claim-a', receipt());
  expect(records.get('claim-a')).toMatchObject({ confirmation: confirmation(), confirmationHistory: [confirmation()], assignedTeamId: 'team-a', expectedAmount: 100 });
  expect(records.get('claim-a')?.receipts).toHaveLength(1);
});
it('누락 행이 있거나 확인 이력 한도를 넘으면 일괄 작업을 전부 거부한다', async () => {
  records.set('claim-a', claim());
  await expect(delegatedReceiptService.confirmClaims(['claim-a', 'missing'], confirmation())).rejects.toThrow();
  expect(records.get('claim-a')?.confirmation).toBeUndefined();
  records.set('claim-b', claim({ id: 'claim-b', confirmationHistory: Array.from({ length: 500 }, (_, i) => confirmation({ id: `old-${i}` })) }));
  await expect(delegatedReceiptService.confirmClaims(['claim-a', 'claim-b'], confirmation())).rejects.toThrow('최대 건수');
  expect(records.get('claim-a')?.confirmation).toBeUndefined();
});
it('팀 일괄 연결은 월과 현장이 같은 내역에만 적용한다', async () => {
  records.set('claim-a', claim());
  records.set('claim-b', claim({ id: 'claim-b', month: '2026-08' }));
  await expect(delegatedReceiptService.assignSiteTeam(['claim-a', 'claim-b'], '2026-09', '테스트 현장', 'team-a')).rejects.toThrow('월·현장');
  expect(records.get('claim-a')?.assignedTeamId).toBeUndefined();
  await delegatedReceiptService.assignSiteTeam(['claim-a'], '2026-09', '테스트 현장', 'team-a');
  expect(records.get('claim-a')?.assignedTeamId).toBe('team-a');
});

it('목록 계좌와 입금여부 수정은 최신 반대 항목과 원본·금액·팀 정보를 보존한다', async () => {
  const original = claim({ sourceStatus: '개인통장', receipts: [receipt()], assignedTeamId: 'team-a', expectedAmount: 300000 });
  records.set('claim-a', original);
  await delegatedReceiptService.confirmClaims(['claim-a'], confirmation({ status: 'pending' }));
  const account = await delegatedReceiptService.updateListField('claim-a', { id: 'account', recordedAt: confirmation().recordedAt, change: { field: 'recipient', value: 'site_leader' } });
  expect(getDepositState(account)).toMatchObject({ status: 'pending', recipient: 'site_leader' });
  const status = await delegatedReceiptService.updateListField('claim-a', { id: 'status', recordedAt: confirmation().recordedAt, change: { field: 'status', value: 'complete' } });
  expect(getDepositState(status)).toMatchObject({ status: 'complete', recipient: 'site_leader' });
  expect(status).toMatchObject({ receipts: original.receipts, expectedAmount: 300000, sourceStatus: original.sourceStatus, sourceLabel: original.sourceLabel, assignedTeamId: 'team-a' });
  expect(status.confirmationHistory).toHaveLength(3);
});

it('목록에서 미확인을 명시하면 원본 위임 추론을 덮어쓰고 입금여부는 건드리지 않는다', async () => {
  const original = claim({ delegationType: 'unknown', sourceStatus: '이재욱 위임 입금완료' });
  records.set('claim-a', original);
  const updated = await delegatedReceiptService.updateListField('claim-a', { id: 'delegation', recordedAt: confirmation().recordedAt, change: { field: 'delegation', value: 'unknown' } });
  expect(getDelegation(updated)).toBe('unknown');
  expect(updated.confirmation).toBeUndefined();
  expect(getDepositState(updated)).toEqual(getDepositState(original));
  await delegatedReceiptService.saveClaim({ ...original, expectedAmount: 200000 });
  expect(getDelegation(records.get('claim-a')!)).toBe('unknown');
  expect(records.get('claim-a')?.confirmationHistory).toHaveLength(1);
});

it('목록 저장 재시도는 이후 변경을 되돌리거나 이력을 중복 생성하지 않는다', async () => {
  records.set('claim-a', claim());
  const edit = { id: 'list-a', recordedAt: confirmation().recordedAt, change: { field: 'status' as const, value: 'complete' as const } };
  await delegatedReceiptService.updateListField('claim-a', edit);
  await delegatedReceiptService.confirmClaims(['claim-a'], confirmation({ status: 'pending' }));
  const retried = await delegatedReceiptService.updateListField('claim-a', edit);
  expect(getDepositState(retried).status).toBe('pending');
  expect(retried.confirmationHistory).toHaveLength(2);
  await expect(delegatedReceiptService.updateListField('claim-a', { ...edit, change: { field: 'recipient', value: 'personal' } })).rejects.toThrow('같은 확인 식별자');
});

it('목록 수정은 잘못된 값과 누락 행을 저장하지 않는다', async () => {
  const edit = { id: 'list-a', recordedAt: confirmation().recordedAt, change: { field: 'status' as const, value: 'complete' as const } };
  await expect(delegatedReceiptService.updateListField('missing', edit)).rejects.toThrow('찾을 수 없습니다');
  records.set('claim-a', claim());
  await expect(delegatedReceiptService.updateListField('claim-a', { ...edit, change: { field: 'status', value: 'invalid' as 'complete' } })).rejects.toThrow('변경할 입금 정보');
  expect(records.get('claim-a')?.confirmationHistory).toBeUndefined();
});

it.each([0, null, 290000])('예정액 %s 직접 입력은 세율 계산을 해제하고 원본과 최신 확인·실제 입금액을 보존한다', async amount => {
  const original = claim({ grossAmount: 300000, expectedAmount: 290100, taxRate: 3.3, taxAmount: 9900, receipts: [receipt()], confirmation: confirmation(), confirmationHistory: [confirmation()], assignedTeamId: 'team-a' });
  records.set('claim-a', original);
  const updated = await delegatedReceiptService.updateListField('claim-a', { id: 'amount-a', recordedAt: confirmation().recordedAt, change: { field: 'expectedAmount', value: amount } });
  expect(updated).toMatchObject({ expectedAmount: amount, originalExpectedAmount: 290100, grossAmount: 300000, taxRate: null, taxAmount: null, confirmation: original.confirmation, receipts: original.receipts, assignedTeamId: 'team-a', sourceLabel: original.sourceLabel });
  const next = await delegatedReceiptService.updateListField('claim-a', { id: 'amount-b', recordedAt: confirmation().recordedAt, change: { field: 'expectedAmount', value: 280000 } });
  expect(next.originalExpectedAmount).toBe(290100);
  expect(next.confirmationHistory).toHaveLength(3);
  await delegatedReceiptService.saveClaim(original);
  expect(records.get('claim-a')?.originalExpectedAmount).toBe(290100);
});

it.each([-1, 0.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1])('잘못된 예정액 %s를 목록에서 저장하지 않는다', async amount => {
  await expect(delegatedReceiptService.updateListField('claim-a', { id: 'amount-a', recordedAt: confirmation().recordedAt, change: { field: 'expectedAmount', value: amount } })).rejects.toThrow('금액');
  expect(runTransaction).not.toHaveBeenCalled();
});

it('스티커 메모 등록·수정·삭제·복원은 원본과 금액·입금여부·계좌·팀을 보존한다', async () => {
  const original = claim({ expectedAmount: 290100, grossAmount: 300000, taxRate: 3.3, taxAmount: 9900, receipts: [receipt()], confirmation: confirmation(), assignedTeamId: 'team-a', sourceStatus: '개인통장' });
  records.set(original.id, original);
  const edit = (id: string, value: string) => delegatedReceiptService.updateListField(original.id, { id, recordedAt: confirmation().recordedAt, change: { field: 'memo', value } });
  const created = await edit('memo-create', '  정산 확인\n금요일 다시 확인  ');
  expect(created.memo).toBe('정산 확인\n금요일 다시 확인');
  const modified = await edit('memo-edit', '확인 완료');
  expect(modified.confirmationHistory?.[1]).toMatchObject({ previousMemo: created.memo, note: '메모 수정' });
  const deleted = await edit('memo-delete', '');
  expect(deleted.memo).toBe('');
  expect(deleted.confirmationHistory?.[2]).toMatchObject({ previousMemo: modified.memo, note: '메모 삭제' });
  const restored = await edit('memo-restore', deleted.confirmationHistory![2].previousMemo!);
  expect(restored.memo).toBe('확인 완료');
  expect(restored).toMatchObject({ grossAmount: original.grossAmount, expectedAmount: original.expectedAmount, taxRate: original.taxRate, taxAmount: original.taxAmount, receipts: original.receipts, confirmation: original.confirmation, assignedTeamId: original.assignedTeamId, sourceStatus: original.sourceStatus, sourceLabel: original.sourceLabel });
  (getDocs as jest.Mock).mockResolvedValue({ docs: [{ id: original.id, data: () => records.get(original.id) }] });
  expect((await delegatedReceiptService.list(original.month))[0].confirmationHistory?.[2].previousMemo).toBe('확인 완료');
});

it('메모 삭제 재시도와 오래된 기준 정보 저장은 이후 메모를 덮어쓰지 않는다', async () => {
  records.set('claim-a', claim({ memo: '기존 메모' }));
  const deletion = { id: 'delete-memo', recordedAt: confirmation().recordedAt, change: { field: 'memo' as const, value: '' } };
  await delegatedReceiptService.updateListField('claim-a', deletion);
  await delegatedReceiptService.updateListField('claim-a', { ...deletion, id: 'new-memo', change: { field: 'memo', value: '새 메모' } });
  await delegatedReceiptService.updateListField('claim-a', deletion);
  await delegatedReceiptService.saveClaim(claim({ memo: '오래된 내용', expectedAmount: 1000 }));
  expect(records.get('claim-a')).toMatchObject({ memo: '새 메모', expectedAmount: 1000 });
  expect(records.get('claim-a')?.confirmationHistory).toHaveLength(2);
  await expect(delegatedReceiptService.updateListField('claim-a', { ...deletion, change: { field: 'memo', value: '다른 내용' } })).rejects.toThrow('같은 확인 식별자');
});

it('메모는 2,000자까지 저장하고 초과 내용은 쓰기 전에 거부한다', async () => {
  const edit = { id: 'memo-limit', recordedAt: confirmation().recordedAt, change: { field: 'memo' as const, value: '가'.repeat(2001) } };
  await expect(delegatedReceiptService.updateListField('claim-a', edit)).rejects.toThrow('메모');
  expect(runTransaction).not.toHaveBeenCalled();
  records.set('claim-a', claim());
  expect((await delegatedReceiptService.updateListField('claim-a', { ...edit, change: { field: 'memo', value: '가'.repeat(2000) } })).memo).toHaveLength(2000);
});
