import { groupTeamSettlementAdditions } from './teamSettlementAdditionGroups';
import type { TeamSettlementAdditionItem } from '../types/teamSettlement';
const item = (id: string, category: string, amount: number): TeamSettlementAdditionItem => ({ id, category, amount, source: 'auto', origin: 'team_expense_claim' });
test('설명이 달라도 같은 항목은 묶고 원본별 금액과 전체 합계를 유지한다', () => {
  const items = [item('a', '경비 환급(식대 - 점심)', 10000), item('b', '경비 환급(식대 - 저녁)', 20000), item('c', '경비 차감(식대 - 취소)', 5000), item('d', '경비 환급(유류 - 주유)', 40000)];
  const original = JSON.stringify(items);
  const groups = groupTeamSettlementAdditions(items);
  expect(groups.map(group => [group.category, group.amount])).toEqual([['식대', 35000], ['유류', 40000]]);
  expect(groups[0].items).toEqual(items.slice(0, 3));
  expect(groups.reduce((sum, group) => sum + group.amount, 0)).toBe(75000);
  expect(JSON.stringify(items)).toBe(original);
});
test('등록한 사용자 항목명을 표시하고 삭제된 서로 다른 항목은 잘못 합치지 않는다', () => {
  const a = 'custom_1700000000000_a1b2c3';
  const b = 'custom_1700000000000_d4e5f6';
  const items = [item('a', `경비 환급(${a} - A)`, 10), item('b', `경비 환급(${b} - B)`, 20)];
  expect(groupTeamSettlementAdditions(items).map(group => group.amount)).toEqual([10, 20]);
  expect(groupTeamSettlementAdditions(items, new Map([[a, '장비 대여']]))[0].category).toBe('장비 대여');
});
