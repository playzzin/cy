import { createHash } from 'crypto';
import { TextEncoder } from 'util';
import { collection, doc, getDocs, runTransaction } from 'firebase/firestore';
import { siteMemoService, SiteMemoConflictError, SiteMemoTarget } from './siteMemoService';

jest.mock('../../config/firebase', () => ({ db: {}, auth: { currentUser: { uid: 'test-user' } } }));
jest.mock('firebase/firestore', () => ({ collection: jest.fn(), doc: jest.fn(), getDocs: jest.fn(), runTransaction: jest.fn() }));
const target: SiteMemoTarget = { key: '["2026-09","id","site-a"]', month: '2026-09', name: '가상 현장' };
let records: Map<string, any>;
beforeEach(() => {
  records = new Map();
  Object.defineProperty(globalThis, 'TextEncoder', { configurable: true, value: TextEncoder });
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: { subtle: { digest: async (_: string, bytes: Uint8Array) => Uint8Array.from(createHash('sha256').update(bytes).digest()).buffer } } });
  const makeRef = (_: unknown, ...parts: string[]) => ({ path: parts.join('/') });
  (doc as jest.Mock).mockImplementation(makeRef); (collection as jest.Mock).mockImplementation(makeRef);
  (getDocs as jest.Mock).mockImplementation(async (ref: { path: string }) => ({ docs: [...records].filter(([path]) => path.startsWith(ref.path + '/')).map(([, value]) => ({ data: () => value })) }));
  (runTransaction as jest.Mock).mockImplementation(async (_: unknown, callback) => {
    const pending = new Map();
    const result = await callback({ get: async (ref: { path: string }) => ({ exists: () => records.has(ref.path), data: () => records.get(ref.path) }), set: (ref: { path: string }, value: unknown) => pending.set(ref.path, value) });
    pending.forEach((value, path) => records.set(path, value)); return result;
  });
});
it('현장 메모는 재무 권한을 상속하는 월별 하위 경로에 저장하고 작업자 내역을 건드리지 않는다', async () => {
  const worker = { memo: '개인 메모', grossAmount: 100000 };
  records.set('delegated_receipt_claims/worker-1', worker);
  const saved = await siteMemoService.save(target, ' 현장 메모 ', 0, 'op-1');
  expect(saved).toMatchObject({ memo: '현장 메모', revision: 1 });
  expect(records.get('delegated_receipt_claims/worker-1')).toEqual(worker);
  expect([...records.keys()].filter(path => path.includes('/_site_memos/months/2026-09/sites/'))).toHaveLength(1);
  expect(await siteMemoService.list('2026-09')).toEqual([expect.objectContaining(saved)]);
  expect(await siteMemoService.list('2026-10')).toEqual([]);
});
it('등록된 현장이 이름을 바꿔도 같은 메모를 수정하고 같은 이름의 다른 현장은 별도로 저장한다', async () => {
  await siteMemoService.save(target, '첫 메모', 0, 'a');
  await siteMemoService.save({ ...target, name: '변경한 이름' }, '수정', 1, 'b');
  await siteMemoService.save({ ...target, key: '["2026-09","id","site-b"]' }, '다른 현장', 0, 'c');
  expect(records.size).toBe(2);
  expect((await siteMemoService.list('2026-09')).map(value => value.memo).sort()).toEqual(['다른 현장', '수정']);
});
it('응답 유실 뒤 같은 요청은 중복 저장하지 않고 다른 내용으로 재사용할 수 없다', async () => {
  const first = await siteMemoService.save(target, '내용', 0, 'same');
  expect(await siteMemoService.save(target, '내용', 0, 'same')).toEqual(first);
  await expect(siteMemoService.save(target, '다른 내용', 0, 'same')).rejects.toThrow('같은 저장 요청');
  expect(records.size).toBe(1);
});
it('동시 수정된 메모를 덮어쓰지 않으며 삭제도 빈 메모와 새 버전으로 저장한다', async () => {
  await siteMemoService.save(target, '첫 메모', 0, 'first');
  await expect(siteMemoService.save(target, '오래된 초안', 0, 'stale')).rejects.toBeInstanceOf(SiteMemoConflictError);
  const cleared = await siteMemoService.save(target, '', 1, 'delete');
  expect(cleared).toMatchObject({ memo: '', revision: 2 });
  expect([...records.values()][0].previousMemo).toBe('첫 메모');
});
it('월·현장 식별자 오류나 2천 자를 넘는 입력은 쓰기 전에 거부한다', async () => {
  await expect(siteMemoService.save({ ...target, month: '2026-13' }, '내용', 0, 'bad')).rejects.toThrow();
  await expect(siteMemoService.save({ ...target, key: '["2026-10","id","site-a"]' }, '내용', 0, 'bad')).rejects.toThrow();
  await expect(siteMemoService.save(target, 'a'.repeat(2001), 0, 'long')).rejects.toThrow();
  expect(runTransaction).not.toHaveBeenCalled();
});
