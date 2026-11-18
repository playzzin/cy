import { buildTeamSettlementAccommodationDetail as detail } from './teamSettlementAccommodationDetail';
import { buildTeamSettlementExpenseEntries as entries } from './teamSettlementExpenses';
import type { AccommodationBillingDocument, AccommodationBillingLineItem } from '../types/accommodationBilling';
import type { TeamSettlementDeductionItem } from '../types/teamSettlement';

const rooms = [{ id: 'a', name: '가상 101호', address: '검증시 첫길 1 101호' }, { id: 'b', name: '가상 201호', address: '검증시 둘길 2 201호' }];
const line = (field: string, amount: number, room = 'a', patch: Partial<AccommodationBillingLineItem> = {}): AccommodationBillingLineItem => ({
  id: `utility-${room}-${field}`, label: `${room === 'a' ? '가상 101호' : '가상 201호'} ${field === 'rent' ? '월세' : field === 'maintenance' ? '관리비' : '전기세'}`,
  targetField: field === 'electricity' ? 'electricity' : field === 'gas' ? 'gas' : field === 'water' ? 'water' : field === 'internet' ? 'internet' : 'accommodation',
  amount, sourceType: 'utility_ledger', sourceAccommodationId: room, ...patch
});
const bill = (id: string, lineItems: AccommodationBillingLineItem[]): AccommodationBillingDocument => ({
  id, yearMonth: '2026-10', teamId: 'team', teamName: '검증팀', issuedToType: 'team', issuedToWorkerId: '', issuedToWorkerName: '', status: 'confirmed', lineItems
});
function setup(docs: AccommodationBillingDocument[]) {
  const source = entries({ yearMonth: '2026-10', matchesTeam: id => id === 'team', accommodationDocs: docs, vehicleDocs: [], cardDocs: [], teamExpenseClaims: [] });
  return { source, saved: source.map(entry => ({ ...entry.item }) as TeamSettlementDeductionItem) };
}

test('여러 청구서와 배분 기간을 주소별로 합산하고 관리비를 월세와 구분한다', () => {
  const { source, saved } = setup([
    bill('one', [line('rent', 500000), line('electricity', 30000), line('gas', 20000), line('water', 10000), line('internet', 15000), line('maintenance', 25000), line('other', 5000), line('rent', 300000, 'b'), line('electricity', 5000, 'b')]),
    bill('two', [line('rent', 100000, 'a', { id: 'utility-a-rent-split-1' }), line('electricity', -5000), line('gas', 90000, 'a', { status: 'cancelled' })])
  ]);
  const before = JSON.stringify(saved);
  const result = detail(saved, source, rooms);
  expect(result.totalAmount).toBe(1005000);
  expect(result.addresses.map(row => [row.address, row.amount])).toEqual([['검증시 둘길 2 201호', 305000], ['검증시 첫길 1 101호', 700000]]);
  expect(result.addresses.find(row => row.names.includes('가상 101호'))!.costs.map(cost => [cost.category, cost.amount])).toEqual([['전기', 25000], ['가스', 20000], ['월세', 600000], ['공과금', 55000]]);
  expect(result.addresses.reduce((sum, row) => sum + row.costs.reduce((sum, cost) => sum + cost.amount, 0), 0)).toBe(result.totalAmount);
  expect(JSON.stringify(saved)).toBe(before);
});

test('같은 주소는 한 번 묶고 이름이 비슷한 다른 숙소와 합치지 않는다', () => {
  const { source, saved } = setup([bill('one', [line('rent', 100), line('rent', 200, 'b')])]);
  expect(detail(saved, source, [rooms[0], { ...rooms[1], address: rooms[0].address }]).addresses).toHaveLength(1);
  const legacy = setup([bill('legacy', [line('rent', 100, 'a', { sourceAccommodationId: undefined, label: '가상 101호 월세 2026-10-01~2026-10-15' })])]);
  const result = detail(legacy.saved, legacy.source, [...rooms, { id: 'other', name: '가상 101호 별관', address: '다른 주소' }]);
  expect(result.addresses[0].address).toBe(rooms[0].address);
});

test('원본과 저장 금액이 다르면 저장액을 유지하고 주소와 비용을 임의 배분하지 않는다', () => {
  const { source, saved } = setup([bill('one', [line('rent', 500)])]);
  saved[0].amount = 300;
  const result = detail(saved, source, rooms);
  expect(result.totalAmount).toBe(300);
  expect(result.addresses[0]).toMatchObject({ address: '주소 미확인', amount: 300 });
  expect(result.addresses[0].notes.join()).toContain('금액 차이');
  expect(result.addresses[0].costs.find(cost => cost.category === '기타')!.amount).toBe(300);
});

test('삭제된 주소와 보증금 환급도 누락하지 않으며 다른 숙소로 추측하지 않는다', () => {
  const { source, saved } = setup([bill('one', [line('rent', 1000, 'missing'), line('deposit', -100, 'missing', { targetField: 'deposit', label: '보증금 환급' })])]);
  const result = detail(saved, source, rooms);
  expect(result.addresses).toHaveLength(1);
  expect(result.addresses[0]).toMatchObject({ address: '주소 미확인', amount: 900 });
  expect(result.addresses[0].costs.find(cost => cost.category === '기타')!.amount).toBe(-100);
});
