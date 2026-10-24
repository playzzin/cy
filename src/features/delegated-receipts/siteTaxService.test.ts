import { createHash } from 'crypto';
import { TextEncoder } from 'util';
import { collection, doc, getDocs, runTransaction } from 'firebase/firestore';
import { siteTaxService } from './siteTaxService';
import { DelegatedClaim } from './model';
import { parseSiteTax, SiteTaxRequest, siteTaxRate, siteTaxTarget } from './siteTax';

jest.mock('../../config/firebase', () => ({ db: {}, auth: { currentUser: { uid: 'test-user' } } }));
jest.mock('firebase/firestore', () => ({ collection: jest.fn(), doc: jest.fn(), getDocs: jest.fn(), runTransaction: jest.fn() }));
const base: DelegatedClaim = { id: 'a', month: '2026-10', siteId: 's1', siteName: '가상 현장', workerName: '가상 작업자', grossAmount: 1000000, expectedAmount: 950000, paymentMethod: 'transfer', delegationType: 'delegate', receipts: [{ id: 'received', amount: 123000, date: '2026-10-01', method: 'transfer', memo: '', createdAt: '2026-10-01T00:00:00Z' }], sourceStatus: '입금완료', sourceLabel: '원본', memo: '기존 메모', updatedAt: '2026-10-01T00:00:00Z' };
const request = (patch: Partial<SiteTaxRequest> = {}): SiteTaxRequest => ({ target: { key: '["id","s1"]', name: '가상 현장' }, taxRate: 3.3, revision: 0, operationId: 'op-a', month: '2026-10', selected: [{ id: 'a', updatedAt: base.updatedAt }], ...patch });
let records: Map<string, any>;
const claimPath = (id: string) => `delegated_receipt_claims/${id}`;
beforeEach(() => {
  records = new Map([[claimPath('a'), { ...base }], [claimPath('b'), { ...base, id: 'b', workerName: '별도 계산서', entryKind: 'invoice' }]]);
  Object.defineProperty(globalThis, 'TextEncoder', { configurable: true, value: TextEncoder });
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: { subtle: { digest: async (_: string, bytes: Uint8Array) => Uint8Array.from(createHash('sha256').update(bytes).digest()).buffer } } });
  const ref = (_: unknown, ...parts: string[]) => ({ path: parts.join('/'), id: parts[parts.length - 1] });
  (doc as jest.Mock).mockImplementation(ref); (collection as jest.Mock).mockImplementation(ref);
  (getDocs as jest.Mock).mockImplementation(async (target: { path: string }) => ({ docs: [...records].filter(([path]) => path.startsWith(target.path + '/')).map(([, value]) => ({ data: () => value })) }));
  (runTransaction as jest.Mock).mockImplementation(async (_: unknown, callback) => {
    const pending = new Map(); const result = await callback({ get: async (target: { path: string }) => ({ exists: () => records.has(target.path), data: () => records.get(target.path) }), set: (target: { path: string }, value: unknown) => pending.set(target.path, value), update: (target: { path: string }, value: object) => pending.set(target.path, { ...records.get(target.path), ...value }) });
    pending.forEach((value, path) => records.set(path, value)); return result;
  });
});
it('기본 세율은 월과 독립적으로 보관하고 선택하지 않은 기존 내역은 변경하지 않는다', async () => {
  await siteTaxService.save(request({ selected: [] }));
  expect(records.get(claimPath('a'))).toEqual(base);
  expect(siteTaxRate('s1', await siteTaxService.list())).toBe('3.3');
  expect([...records.keys()].some(path => path.includes('/_settings/sites/'))).toBe(true);
});
it('선택한 금액만 재계산하고 원본·입금·메모를 보존하며 같은 요청을 재적용하지 않는다', async () => {
  const saved = await siteTaxService.save(request());
  expect(saved.claims[0]).toMatchObject({ grossAmount: 1000000, expectedAmount: 967000, taxAmount: 33000, taxRate: 3.3, originalExpectedAmount: 950000, receipts: base.receipts, sourceStatus: base.sourceStatus, memo: base.memo });
  expect(records.get(claimPath('b')).expectedAmount).toBe(950000);
  const repeated = await siteTaxService.save(request());
  expect(repeated).toEqual(saved);
  expect(repeated.claims[0].confirmationHistory).toHaveLength(1);
  await expect(siteTaxService.save(request({ taxRate: 5 }))).rejects.toThrow('같은 저장 요청');
});
it('0%는 미설정과 구분하고 계산서에도 선택한 세율만 반영한다', async () => {
  await siteTaxService.save(request({ taxRate: 0, selected: [{ id: 'b', updatedAt: base.updatedAt }] }));
  expect(records.get(claimPath('b'))).toMatchObject({ entryKind: 'invoice', taxRate: 0, expectedAmount: 1000000, taxAmount: 0 });
  await siteTaxService.save(request({ revision: 1, operationId: 'clear', taxRate: null, selected: [] }));
  expect(siteTaxRate('s1', await siteTaxService.list())).toBe('');
  expect(records.get(claimPath('b')).taxRate).toBe(0);
});
it.each(['changed', 'wrong-site', 'wrong-month', 'missing-amount', 'missing-row'])('재계산 대상 오류 %s가 있으면 세율과 모든 내역을 함께 보존한다', async reason => {
  const second = records.get(claimPath('b'));
  if (reason === 'changed') second.updatedAt = 'later';
  if (reason === 'wrong-site') second.siteId = 's2';
  if (reason === 'wrong-month') second.month = '2026-09';
  if (reason === 'missing-amount') second.grossAmount = null;
  if (reason === 'missing-row') records.delete(claimPath('b'));
  const before = JSON.stringify([...records]);
  await expect(siteTaxService.save(request({ selected: [{ id: 'a', updatedAt: base.updatedAt }, { id: 'b', updatedAt: base.updatedAt }] }))).rejects.toThrow();
  expect(JSON.stringify([...records])).toBe(before);
});
it('다른 사용자의 세율 변경을 덮어쓰지 않는다', async () => {
  await siteTaxService.save(request({ selected: [] }));
  await expect(siteTaxService.save(request({ operationId: 'stale', taxRate: 5 }))).rejects.toThrow('다른 사용자');
  expect(records.get(claimPath('a'))).toEqual(base);
});
it.each([null, -1, 101, Number.NaN])('선택 재계산의 잘못된 세율 %s는 저장 전에 거부한다', async taxRate => {
  await expect(siteTaxService.save(request({ taxRate }))).rejects.toThrow();
  expect(runTransaction).not.toHaveBeenCalled();
});
it('등록 현장 ID와 미연결 이름을 구분하고 0%를 해석한다', () => {
  expect(siteTaxTarget({ siteName: '가상 현장' }, { teams: [], sites: [{ id: 's1', name: '가상현장' }] }).key).toBe('["id","s1"]');
  expect(siteTaxTarget({ siteName: '가상 현장' }, { teams: [], sites: [{ id: 's1', name: '가상현장' }, { id: 's2', name: '가상현장' }] }).key).toBe('["name","가상현장"]');
  expect(parseSiteTax('0')).toBe(0); expect(parseSiteTax('')).toBeNull(); expect(() => parseSiteTax('1e2')).toThrow();
});
