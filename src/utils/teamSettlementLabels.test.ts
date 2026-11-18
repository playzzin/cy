import { formatTeamSettlementCategory } from './teamSettlementLabels';

const item = { source: 'auto', origin: 'team_expense_claim', category: '경비 환급(custom_1700000000000_a1b2c3 - 장비 2대)' };
test('자동 경비의 내부 코드만 등록된 구분명으로 바꾸고 원본은 보존한다', () => {
  expect(formatTeamSettlementCategory(item, new Map([['custom_1700000000000_a1b2c3', '장비 대여']])))
    .toBe('경비 환급(장비 대여 - 장비 2대)');
  expect(item.category).toContain('custom_1700000000000_a1b2c3');
});
test('삭제되거나 조회하지 못한 구분도 내부 코드를 노출하지 않는다', () => {
  expect(formatTeamSettlementCategory(item)).toBe('경비 환급(기타 - 장비 2대)');
  expect(formatTeamSettlementCategory(item, new Map([['custom_1700000000000_a1b2c3', 'custom_1700000000000_a1b2c3']])))
    .toBe('경비 환급(기타 - 장비 2대)');
});
test('일반 영문 품명·숫자와 수기 입력 내용은 숨기지 않는다', () => {
  expect(formatTeamSettlementCategory({ ...item, category: '경비 환급(USB-C M12 장비 2대 2026년)' }))
    .toBe('경비 환급(USB-C M12 장비 2대 2026년)');
  expect(formatTeamSettlementCategory({ ...item, source: 'manual' })).toBe(item.category);
});
