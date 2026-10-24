import { collection, doc, getDocsFromServer, query, runTransaction, where } from 'firebase/firestore';
import { auth } from '../config/firebase';
import { supportBillingClosingService as service } from './supportBillingClosingService';
import type { SupportBillingDomain } from './supportBillingClosingService';

jest.mock('../config/firebase', () => ({ db: {}, auth: { currentUser: { uid: 'operator', displayName: '담당자' } } }));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn((_db, path) => ({ path })),
  doc: jest.fn((dbOrCollection, path, id) => id ? ({ id, path: `${path}/${id}` }) : ({ id: 'audit', path: `${dbOrCollection.path}/audit` })),
  getDocsFromServer: jest.fn(), query: jest.fn((...args) => args), where: jest.fn((...args) => args),
  runTransaction: jest.fn(), Timestamp: { now: () => ({ toDate: () => new Date('2026-09-27T00:00:00Z'), toMillis: () => 1790467200000 }) },
}));
jest.mock('./monthlyPayrollSettlementService', () => ({ makeMonthlyPayrollSettlementId: (month: string, team: string) => `${month}__${team}` }));

type Data = Record<string, any>;
const month = '2026-09';
const paths = { card: 'cardBillings/bill', vehicle: 'vehicle_billing_documents/bill', accommodation: 'accommodation_billing_documents/bill' };
const teamLock = 'system_configs/team_settlement_2026-09__team-a';
const payrollLock = 'monthly_payroll_settlements/2026-09__team-a';
const bill = (patch: Data = {}): Data => ({
  yearMonth: month, teamId: 'team-a', teamName: 'A팀', issuedToType: 'team',
  status: 'DRAFT', cardLabel: '업무 카드', vehiclePlate: '테스트 차량', totalAmount: 100,
  lineItems: [{ id: 'line', label: '이용료', amount: 100 }], memo: '기존 메모', ...patch,
});

const harness = (initial: Record<string, Data>, failAudit = false) => {
  const store = new Map<string, Data>(Object.entries({ 'teams/team-a': { name: 'A팀' }, ...initial }));
  const committed: Array<{ path: string; patch: Data }> = [];
  (runTransaction as jest.Mock).mockImplementation(async (_db, callback) => {
    const pending: Array<{ path: string; patch: Data; update: boolean }> = [];
    const transaction = {
      get: async (ref: { path: string; id: string }) => {
        if (pending.length) throw new Error('read-after-write');
        return { id: ref.id, exists: () => store.has(ref.path), data: () => store.get(ref.path) };
      },
      update: (ref: { path: string }, patch: Data) => pending.push({ path: ref.path, patch, update: true }),
      set: (ref: { path: string }, patch: Data) => {
        if (failAudit && ref.path.includes('_billing_logs/')) throw new Error('audit-denied');
        pending.push({ path: ref.path, patch, update: false });
      },
    };
    const result = await callback(transaction);
    pending.forEach(write => {
      store.set(write.path, write.update ? { ...store.get(write.path), ...write.patch } : write.patch);
      committed.push(write);
    });
    return result;
  });
  return { store, committed };
};

beforeEach(() => {
  jest.clearAllMocks();
  (collection as jest.Mock).mockImplementation((_db, path) => ({ path }));
  (doc as jest.Mock).mockImplementation((dbOrCollection, path, id) => id ? ({ id, path: `${path}/${id}` }) : ({ id: 'audit', path: `${dbOrCollection.path}/audit` }));
  (query as jest.Mock).mockImplementation((...args) => args);
  (where as jest.Mock).mockImplementation((...args) => args);
  (auth as any).currentUser = { uid: 'operator', displayName: '담당자' };
});

it.each<SupportBillingDomain>(['card', 'vehicle', 'accommodation'])('confirms %s without changing amounts or memo and atomically records its history', async domain => {
  const original = bill(domain === 'accommodation' ? { status: 'draft', lineItemIds: ['line'] } : {});
  const { store, committed } = harness({
    [paths[domain]]: original,
    'accommodation_billing_line_items/line': { billingDocumentId: 'bill', label: '월세', amount: 100, status: 'active' },
  });
  const preview = await service.preview(domain, 'bill', month);
  expect(preview.blockedReason).toBeNull();
  expect(committed).toHaveLength(0);
  await service.apply(preview, '');
  const updated = store.get(paths[domain])!;
  expect(updated.totalAmount).toBe(100);
  expect(updated.memo).toBe('기존 메모');
  expect(updated.lineItems).toEqual(original.lineItems);
  expect(updated.status.toUpperCase()).toBe('CONFIRMED');
  expect(committed).toHaveLength(2);
  expect(store.get(`${domain}_billing_logs/audit`)).toMatchObject({ actor: { uid: 'operator' }, actionLabel: '확정', before: { status: original.status }, after: { status: updated.status } });
});

it('requires a reason and reopens a confirmed bill while preserving the financial snapshot', async () => {
  const { store, committed } = harness({ [paths.card]: bill({ status: 'CONFIRMED', confirmedAt: 'before' }) });
  const preview = await service.preview('card', 'bill', month);
  await expect(service.apply(preview, '  ')).rejects.toThrow('사유');
  expect(committed).toHaveLength(0);
  await service.apply(preview, '청구 대상 확인');
  expect(store.get(paths.card)).toMatchObject({ status: 'DRAFT', totalAmount: 100, memo: '기존 메모', confirmedAt: null, confirmationCancelReason: '청구 대상 확인', confirmationCancelledById: 'operator' });
});

it.each(['PAID', 'OVERDUE', 'CANCELLED', 'UNKNOWN'])('blocks %s instead of silently reopening it', async status => {
  const { committed } = harness({ [paths.card]: bill({ status }) });
  const preview = await service.preview('card', 'bill', month);
  expect(preview.action).toBeNull();
  await expect(service.apply(preview, '수정')).rejects.toThrow();
  expect(committed).toHaveLength(0);
});

it.each(['reviewed', 'confirmed', 'paid', 'unknown'])('blocks payroll in %s state without financial writes', async runStatus => {
  const { committed } = harness({ [paths.vehicle]: bill(), [payrollLock]: { yearMonth: month, runStatus } });
  const preview = await service.preview('vehicle', 'bill', month);
  expect(preview.blockedReason).toContain('급여');
  await expect(service.apply(preview, '')).rejects.toThrow('급여');
  expect(committed).toHaveLength(0);
});

it('blocks a team settlement finalized after the preview', async () => {
  const { store, committed } = harness({ [paths.card]: bill() });
  const preview = await service.preview('card', 'bill', month);
  store.set(teamLock, { data: JSON.stringify({ yearMonth: month, confirmedAt: 'now' }) });
  await expect(service.apply(preview, '')).rejects.toThrow('팀정산');
  expect(committed).toHaveLength(0);
});

it('checks settlement locks stored under the legacy team ID', async () => {
  harness({ [paths.card]: bill(), 'teams/team-a': { legacyId: 'old-team' }, 'system_configs/team_settlement_2026-09__old-team': { data: { yearMonth: month, confirmedAt: 'now' } } });
  expect((await service.preview('card', 'bill', month)).blockedReason).toContain('팀정산');
});

it('fails closed for malformed settlement data and missing team links', async () => {
  harness({ [paths.card]: bill(), [teamLock]: { data: '{invalid' } });
  expect((await service.preview('card', 'bill', month)).blockedReason).toContain('팀정산 상태');
  harness({ [paths.card]: bill({ teamId: '' }) });
  expect((await service.preview('card', 'bill', month)).blockedReason).toContain('대상 팀');
});

it('does not assume an unresolved legacy team has no finalized settlements', async () => {
  const { store, committed } = harness({ [paths.card]: bill() });
  store.delete('teams/team-a');
  const preview = await service.preview('card', 'bill', month);
  expect(preview.blockedReason).toContain('팀의 원본 자료');
  await expect(service.apply(preview, '')).rejects.toThrow('팀의 원본 자료');
  expect(committed).toHaveLength(0);
});

it('rejects changes made after preview and double submission', async () => {
  const { store, committed } = harness({ [paths.card]: bill() });
  const preview = await service.preview('card', 'bill', month);
  store.set(paths.card, bill({ totalAmount: 200 }));
  await expect(service.apply(preview, '')).rejects.toThrow('자료가 변경');
  expect(committed).toHaveLength(0);
  store.set(paths.card, bill());
  await service.apply(preview, '');
  await expect(service.apply(preview, '')).rejects.toThrow('자료가 변경');
  expect(committed).toHaveLength(2);
});

it('does not commit the status when history cannot be saved', async () => {
  const { store, committed } = harness({ [paths.card]: bill() }, true);
  const preview = await service.preview('card', 'bill', month);
  await expect(service.apply(preview, '')).rejects.toThrow('audit-denied');
  expect(store.get(paths.card)?.status).toBe('DRAFT');
  expect(committed).toHaveLength(0);
});

it('never changes accommodation worker deductions or legacy bills with incomplete links', async () => {
  const { committed } = harness({
    [paths.accommodation]: bill({ issuedToType: 'worker', lineItemIds: ['line'], postedAdvancePaymentId: 'advance' }),
    'accommodation_billing_line_items/line': { billingDocumentId: 'bill', label: '월세', amount: 100 },
    'advance_payments/advance': { accommodation: 100, items: { other: 50 } },
  });
  const preview = await service.preview('accommodation', 'bill', month);
  expect(preview.blockedReason).toContain('개인 공제');
  await expect(service.apply(preview, '')).rejects.toThrow('개인 공제');
  expect(committed).toHaveLength(0);
  harness({ [paths.accommodation]: bill() });
  expect((await service.preview('accommodation', 'bill', month)).blockedReason).toContain('연결정보');
});

it('requires a fresh preview after an account change', async () => {
  const { committed } = harness({ [paths.card]: bill() });
  const preview = await service.preview('card', 'bill', month);
  (auth as any).currentUser = { uid: 'someone-else' };
  await expect(service.apply(preview, '')).rejects.toThrow('로그인');
  expect(committed).toHaveLength(0);
});

it('propagates read failures instead of returning an empty successful list', async () => {
  (getDocsFromServer as jest.Mock).mockRejectedValue(new Error('offline'));
  await expect(service.list('card', month)).rejects.toThrow('offline');
});
