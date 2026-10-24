import { buildTeamSettlementExpenseEntries as build, compareTeamSettlementExpenses, getTeamSettlementExpenseDetail, type SettlementExpenseSources } from './teamSettlementExpenses';
import type { CardBillingDocument } from '../types/cardBilling';
import type { TeamExpenseClaim } from '../types/teamExpenseLedger';
import { TeamSettlementDocumentSchema } from '../types/teamSettlement';

const card = (patch: Partial<CardBillingDocument> = {}): CardBillingDocument => ({
  id: 'card-a', yearMonth: '2026-08', cardId: 'asset-a', cardLabel: '검증 카드', teamId: 'team', teamName: '검증팀',
  issuedToType: 'team', status: 'DRAFT', variableCost: 1000, totalAmount: 1000, statementAttachmentPaths: [],
  lineItems: [{ label: '사용액', amount: 1000, sourceType: 'card_ledger' }], ...patch
});
const sources = (patch: Partial<SettlementExpenseSources> = {}): SettlementExpenseSources => ({
  yearMonth: '2026-08', matchesTeam: id => id === 'team', accommodationDocs: [], vehicleDocs: [], cardDocs: [], teamExpenseClaims: [], ...patch
});
const document = () => TeamSettlementDocumentSchema.parse({ yearMonth: '2026-08', teamId: 'team', teamName: '검증팀',
  sales: [], purchases: [], deductions: [], additions: [], summary: { prevCarryover: 0, deposit: 0 }, confirmedAt: null, updatedAt: '2026-09-01T00:00:00.000Z' });
const claim = (patch: Partial<TeamExpenseClaim> = {}): TeamExpenseClaim => ({
  id: 'claim', yearMonth: '2026-08', date: '2026-08-03', status: 'charged', claimType: 'teamCharge',
  payerTeamId: 'payer', payerTeamName: '지급팀', chargeToTeamId: 'team', chargeToTeamName: '검증팀',
  category: 'meal', amount: 500, description: '식사', ...patch
} as TeamExpenseClaim);

test('다른 카드의 확정 청구 때문에 유효한 대장 청구를 누락시키지 않는다', () => {
  const rows = build(sources({ cardDocs: [card(), card({ id: 'card-b', cardId: 'asset-b', cardLabel: '다른 카드', status: 'CONFIRMED' })] }));
  expect(rows).toHaveLength(2);
  expect(rows.reduce((sum, entry) => sum + entry.item.amount, 0)).toBe(2000);
});
test.each(['CANCELLED', 'DRAFT'] as const)('취소·수기 행 청구(%s)가 기존 대장 청구를 가리지 않는다', status => {
  const rows = build(sources({ cardDocs: [card(), card({ id: 'card-a__row_1', status,
    lineItems: [{ label: '수기', amount: 3000, sourceType: status === 'DRAFT' ? 'manual' : 'card_ledger' }] })] }));
  expect(rows.map(row => row.item.id)).toEqual(['card_billing:2026-08:card-a']);
});
test('분리된 대장 청구가 기존 전체 청구를 대체해 중복을 막는다', () => {
  const rows = build(sources({ cardDocs: [card(), card({ id: 'card-a__row_1' }), card({ id: 'card-a__row_2' })] }));
  expect(rows.map(row => row.item.id)).toEqual(['card_billing:2026-08:card-a__row_1', 'card_billing:2026-08:card-a__row_2']);
});
test('부분 환급을 포함한 상세 합계와 정산 금액이 같다', () => {
  const rows = build(sources({ cardDocs: [card({ lineItems: [{ label: '사용', amount: 1000, sourceType: 'card_ledger' }, { label: '환급', amount: -200 }] })] }));
  expect(rows[0].item.amount).toBe(800);
  expect(getTeamSettlementExpenseDetail(rows[0].item, rows).rows.reduce((sum, row) => sum + row.amount, 0)).toBe(800);
});
test('전액 환급 시 과거 totalAmount를 다시 공제하지 않는다', () => {
  expect(build(sources({ cardDocs: [card({ lineItems: [{ label: '사용', amount: 1000, sourceType: 'card_ledger' }, { label: '환급', amount: -1000 }] })] }))).toEqual([]);
});
test('중복 원본은 한 번 반영하며 내용이 충돌하면 집계하지 않는다', () => {
  expect(build(sources({ cardDocs: [card(), card()] }))).toHaveLength(1);
  expect(() => build(sources({ cardDocs: [card(), card({ lineItems: [{ label: '사용', amount: 2000, sourceType: 'card_ledger' }] })] }))).toThrow(/충돌/);
});
test('다른 월·개인·취소·미청구 경비를 정산에 넣지 않는다', () => {
  expect(build(sources({ cardDocs: [card({ yearMonth: '2026-07' }), card({ issuedToType: 'worker' }), card({ status: 'CANCELLED' })], teamExpenseClaims: [claim({ status: 'draft' })] }))).toEqual([]);
});
test('주고받는 경비 양쪽에 동일한 금액을 한 번씩 반영한다', () => {
  const claims = [claim(), claim(), claim({ id: 'other', claimType: 'otherExpense' })];
  const outgoing = build(sources({ teamExpenseClaims: claims }));
  const incoming = build(sources({ matchesTeam: id => id === 'payer', teamExpenseClaims: claims }));
  expect(outgoing).toHaveLength(1);
  expect(outgoing[0].direction).toBe('deduction');
  expect(incoming.filter(row => row.direction === 'addition')).toHaveLength(1);
  expect(incoming.filter(row => row.direction === 'deduction')).toHaveLength(1);
  expect(incoming[0].item.amount).toBe(outgoing[0].item.amount);
});
test('저장본을 바꾸지 않고 누락·변경·중복·원본 부재를 구분한다', () => {
  const entries = build(sources({ cardDocs: [card(), card({ id: 'b', cardLabel: 'B' })] }));
  const saved = document();
  saved.deductions = [{ ...entries[0].item, amount: 500 }, { ...entries[0].item, amount: 500 }, { ...entries[0].item, id: 'old' }] as typeof saved.deductions;
  const before = JSON.stringify(saved);
  const result = compareTeamSettlementExpenses(saved, entries);
  expect(result.missing).toHaveLength(1); expect(result.changed).toHaveLength(1);
  expect(result.unexpected).toHaveLength(1); expect(result.duplicate).toHaveLength(1);
  expect(JSON.stringify(saved)).toBe(before);
  const detail = getTeamSettlementExpenseDetail(saved.deductions[0], entries);
  expect(detail.rows.reduce((sum, row) => sum + row.amount, 0)).toBe(500);
  expect(detail.memo).toMatch(/금액 차이/);
});
test('상세가 없거나 원본이 삭제된 경우에도 저장 금액을 유지한다', () => {
  const saved = build(sources({ cardDocs: [card()] }))[0].item;
  expect(getTeamSettlementExpenseDetail(saved, []).rows[0].amount).toBe(1000);
});
test('유효하지 않은 금액과 음수 순청구를 조용히 누락하지 않는다', () => {
  for (const amount of [NaN, -100]) expect(() => build(sources({ cardDocs: [card({ lineItems: [{ label: '사용', amount, sourceType: 'card_ledger' }] })] }))).toThrow();
});

test('숙소 취소 행은 제외하고 환급 행은 포함한다', () => {
  const rows = build(sources({ accommodationDocs: [{ id: 'room', yearMonth: '2026-08', teamId: 'team', teamName: '검증팀',
    issuedToType: 'team', issuedToWorkerId: '', issuedToWorkerName: '', status: 'confirmed', lineItems: [
      { id: 'a', label: '숙소비', targetField: 'accommodation', amount: 1000, sourceType: 'utility_ledger' },
      { id: 'b', label: '취소', targetField: 'electricity', amount: 500, status: 'cancelled' },
      { id: 'c', label: '환급', targetField: 'deposit', amount: -200 }
    ] }] }));
  expect(rows[0].item.amount).toBe(800);
  expect(rows[0].details.map(row => row.label)).toEqual(['숙소비', '환급']);
});

test('차량 부분 환급 및 반올림 후에도 상세 합계가 정산과 일치한다', () => {
  const vehicle = { id: 'vehicle', yearMonth: '2026-08', vehicleId: 'asset', vehiclePlate: '검증 차량', teamId: 'team',
    issuedToType: 'team' as const, status: 'CONFIRMED' as const, fixedCost: 1000, variableCost: 0, totalAmount: 1000,
    lineItems: [{ id: 'rent', type: 'FIXED' as const, label: '임대료', amount: 1000.4, sourceType: 'vehicle_ledger' as const }, { id: 'credit', type: 'FIXED' as const, label: '환급', amount: -100 }] };
  const rows = build(sources({ vehicleDocs: [vehicle] }));
  expect(rows[0].item.amount).toBe(900);
  expect(rows[0].details.reduce((sum, row) => sum + row.amount, 0)).toBe(900);
  expect(build(sources({ vehicleDocs: [{ ...vehicle, lineItems: [...vehicle.lineItems, { id: 'full-credit', type: 'FIXED', label: '잔액 환급', amount: -900.4 }] }] }))).toEqual([]);
});
