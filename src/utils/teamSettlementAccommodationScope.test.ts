import { filterTeamSettlementAccommodationBillings as filter } from './teamSettlementAccommodationScope';
import { buildTeamSettlementExpenseEntries } from './teamSettlementExpenses';
import type { AccommodationBillingDocument, AccommodationBillingLineItem } from '../types/accommodationBilling';
import type { AccommodationBillingTarget } from '../types/accommodationBillingTarget';
import type { AccommodationAssignment } from '../types/accommodationAssignment';

const rooms = [{ id: 'room', legacyId: 'old-room', name: '가상 101호' }];
const teams = [{ id: 'team', legacyId: 'old-team', name: '검증팀' }, { id: 'other', name: '다른팀' }];
const line = (patch: Partial<AccommodationBillingLineItem> = {}): AccommodationBillingLineItem => ({ id: 'utility-room-rent', label: '가상 101호 월세',
  amount: 300000, targetField: 'accommodation', sourceType: 'utility_ledger', sourceAccommodationId: 'room', ...patch });
const bill = (patch: Partial<AccommodationBillingDocument> = {}): AccommodationBillingDocument => ({
  id: 'bill', yearMonth: '2026-11', teamId: 'team', teamName: '검증팀', issuedToType: 'team', issuedToWorkerId: '', issuedToWorkerName: '',
  status: 'confirmed', lineItems: [line()], ...patch
});
const target = (patch: Partial<AccommodationBillingTarget> = {}): AccommodationBillingTarget => ({ id: 'target', accommodationId: 'room', targetType: 'team', teamId: 'team', ...patch });
const assignment = (patch: Partial<AccommodationAssignment> = {}): AccommodationAssignment => ({ id: 'assignment', accommodationId: 'room', teamId: 'team', source: 'team', workerId: 'occupant', status: 'active', startDate: '2026-10-01', ...patch });
const scope = (targets: AccommodationBillingTarget[] = [], assignments: AccommodationAssignment[] = []) => ({ targets, assignments, rooms, teams });

test.each(['worker', 'office_staff', 'office'] as const)('%s 청구 숙소는 팀 청구서에 남아 있어도 정산에서 제외한다', targetType => {
  expect(filter([bill()], scope([target({ targetType, workerId: 'person' })], [assignment()]))).toEqual([]);
});
test('현재 팀·현재 월 부담분만 남기고 주소가 같은 다른 호수의 개인 청구도 제외한다', () => {
  const original = bill({ lineItems: [line(), line({ id: 'personal-rent', sourceAccommodationId: 'personal-room', amount: 900000 })] });
  const before = JSON.stringify(original);
  const result = filter([original, bill({ id: 'worker-bill', issuedToType: 'worker', issuedToWorkerId: 'person' })], {
    ...scope([target(), target({ id: 'personal', accommodationId: 'personal-room', targetType: 'worker', workerId: 'person' })]),
    rooms: [...rooms, { id: 'personal-room', name: '가상 201호' }]
  });
  expect(result).toHaveLength(1);
  expect(result[0].lineItems).toEqual([line()]);
  const entries = buildTeamSettlementExpenseEntries({ yearMonth: '2026-11', matchesTeam: id => id === 'team', accommodationDocs: result, vehicleDocs: [], cardDocs: [], teamExpenseClaims: [] });
  expect(entries.map(entry => entry.item.amount)).toEqual([300000]);
  expect(JSON.stringify(original)).toBe(before);
});
test('다른 팀 ID는 표시 이름이 같아도 제외하고 구 ID는 같은 팀으로 해석한다', () => {
  expect(filter([bill()], scope([target({ teamId: 'other', teamName: '검증팀' })]))).toEqual([]);
  expect(filter([bill()], scope([target({ teamId: 'old-team', accommodationId: 'old-room' })]))).toHaveLength(1);
});
test('월중 개인청구 전환은 팀 부담 기간이 명시된 분할 행만 보존한다', () => {
  const targets = [target({ startDate: '2026-10-01' }), target({ id: 'person', targetType: 'worker', workerId: 'person', startDate: '2026-11-16' })];
  const lines = [line({ id: 'whole-month' }), line({ id: 'team-half', label: '가상 101호 월세 2026-11-01~2026-11-15', amount: 150000 }),
    line({ id: 'person-half', label: '가상 101호 월세 2026-11-16~2026-11-30', amount: 150000 })];
  expect(filter([bill({ lineItems: lines })], scope(targets))[0].lineItems.map(item => item.id)).toEqual(['team-half']);
  expect(filter([bill({ yearMonth: '2026-10' })], scope(targets))).toHaveLength(1);
});
test('개인청구 종료·미래 팀 배정·청구대상 미지정으로 팀 부담을 추측하지 않는다', () => {
  for (const targets of [[], [target({ startDate: '2026-12-01' })], [target({ endDate: '2026-10-31' })]]) {
    expect(filter([bill()], scope(targets))).toEqual([]);
  }
  expect(filter([bill({ issuedToWorkerId: 'person' })], scope([target()]))).toEqual([]);
});
test('별도 청구대상이 없을 때 숙소 화면의 팀 배정만 인정하고 개인 배정은 제외한다', () => {
  expect(filter([bill()], scope([], [assignment()]))).toHaveLength(1);
  for (const patch of [{ source: 'worker' as const }, { source: 'office_staff' as const }, { teamId: 'other' }, { status: 'ended' as const, endDate: undefined }]) {
    expect(filter([bill()], scope([], [assignment(patch)]))).toEqual([]);
  }
});
test('연결 ID가 없는 구 청구행은 고유한 숙소명만 인정하고 수기·동명이름은 추측하지 않는다', () => {
  const legacy = bill({ lineItems: [line({ sourceAccommodationId: undefined })] });
  expect(filter([legacy], scope([target()]))).toHaveLength(1);
  expect(filter([legacy], { ...scope([target()]), rooms: [...rooms, { id: 'duplicate', name: rooms[0].name }] })).toEqual([]);
  expect(filter([bill({ lineItems: [line({ sourceAccommodationId: undefined, sourceType: 'manual', id: 'manual' })] })], scope([target()]))).toEqual([]);
});
