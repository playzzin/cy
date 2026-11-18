import type { TeamSettlementSalesItem } from '../types/teamSettlement';
import { mergeTeamSettlementSales } from './teamSettlementSalesMerge';

const sale = (kind: '도급' | '직영', changes: Partial<TeamSettlementSalesItem> = {}): TeamSettlementSalesItem => ({
  id: `daily_report_sales:2026-11:${kind}__site__`, source: 'auto', origin: 'daily_report',
  siteId: 'site', siteName: '검증 현장', kind, manDay: 3, amount: 0, ...changes
});

test.each([['도급', '직영'], ['직영', '도급']] as const)('일보 %s→%s 변경 시 새 구분·공수와 기존 수기금액·수량·메모를 유지한다', (before, after) => {
  const saved = sale(before, { manDay: 2, amount: 900000, amountOverridden: true, quantity: 12, memo: '입력 메모' });
  const result = mergeTeamSettlementSales([sale(after)], [saved]);
  expect(result).toEqual([{ ...sale(after), amount: 900000, amountOverridden: true, quantity: 12, memo: '입력 메모' }]);
  expect(saved.kind).toBe(before);
});

test('한 현장의 도급·직영을 직영으로 합칠 때 입력 금액과 수량을 한 번씩 합산한다', () => {
  expect(mergeTeamSettlementSales([sale('직영', { manDay: 5 })], [
    sale('도급', { amount: 600000, amountOverridden: true, quantity: 2, memo: '도급분' }),
    sale('직영', { amount: 300000, amountOverridden: true, quantity: 3, memo: '직영분' })
  ])).toEqual([expect.objectContaining({ kind: '직영', manDay: 5, amount: 900000, quantity: 5, memo: '도급분\n직영분' })]);
});

test('일보 일부만 바뀌면 기존 구분에 금액을 보존하고 새 구분에 중복 배분하지 않는다', () => {
  const result = mergeTeamSettlementSales([sale('도급'), sale('직영')], [sale('도급', { amount: 900000, amountOverridden: true })]);
  expect(result.map(row => row.amount)).toEqual([900000, 0]);
  expect(result[1].amountOverridden).toBeUndefined();
});

test('동명이지만 ID가 다른 현장이나 다른 매출 원천의 금액을 가져오지 않는다', () => {
  const generated = sale('직영');
  expect(mergeTeamSettlementSales([generated], [
    sale('도급', { siteId: 'other', amount: 900000, amountOverridden: true }),
    sale('도급', { origin: 'support_client_site', amount: 500000, amountOverridden: true })
  ])).toEqual([generated]);
});

test('현장 ID가 없는 구형 행은 동일 원천·현장명으로 연결하고 자동급여는 수기금액으로 옮기지 않는다', () => {
  const generated = sale('직영', { siteId: undefined });
  const previous = sale('도급', { siteId: undefined, amount: 900000, memo: '기존 메모' });
  expect(mergeTeamSettlementSales([generated], [previous])[0]).toMatchObject({ amount: 0, memo: '기존 메모' });
  expect(mergeTeamSettlementSales([generated], [{ ...previous, amountOverridden: true }])[0].amount).toBe(900000);
});

test('지원 매출 수정과 수기 행을 보존하며 명시적으로 입력한 0원도 유지한다', () => {
  const support: TeamSettlementSalesItem = { ...sale('직영'), id: 'support', kind: '지원', origin: '내부지원간곳', amount: 270000 };
  const manual: TeamSettlementSalesItem = { ...sale('직영'), id: 'manual', source: 'manual', origin: 'manual', amount: 7000 };
  expect(mergeTeamSettlementSales([support, sale('직영')], [
    { ...support, amount: 300000, amountOverridden: true, memo: '지원 메모' },
    sale('도급', { amount: 0, amountOverridden: true }), manual
  ])).toEqual([
    expect.objectContaining({ id: 'support', amount: 300000, memo: '지원 메모' }),
    expect.objectContaining({ kind: '직영', amount: 0, amountOverridden: true }), manual
  ]);
});
