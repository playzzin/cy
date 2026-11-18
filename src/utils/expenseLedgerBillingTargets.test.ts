import { resolveExpenseLedgerBillingTargets } from './expenseLedgerBillingTargets';
import type { CardBillingDocument } from '../types/cardBilling';
import type { AccommodationBillingDocument } from '../types/accommodationBilling';

const card: CardBillingDocument = {
  id: 'card-billing__row_segment', cardId: 'card', cardLabel: '가상카드', yearMonth: '2026-09',
  teamId: 'old', teamName: '가상기존팀', assignedTeamId: 'assigned', assignedTeamName: '가상배정팀',
  issuedToType: 'team', status: 'DRAFT', totalAmount: 300, variableCost: 300, statementAttachmentPaths: ['fixture.pdf'],
  lineItems: [{ id: 'cost', label: '식대', amount: 300, sourceType: 'card_ledger' }]
};
const accommodation: AccommodationBillingDocument = {
  id: 'room-billing', yearMonth: '2026-09', teamId: 'old', teamName: '가상기존팀',
  issuedToType: 'team', issuedToWorkerId: '', issuedToWorkerName: '', status: 'draft',
  lineItems: [{ id: 'rent', label: '가상숙소 월세', amount: 600, targetField: 'accommodation', sourceType: 'utility_ledger', sourceAccommodationId: 'room' }]
};
const base: Parameters<typeof resolveExpenseLedgerBillingTargets>[0] = {
  teams: [{ id: 'new', legacyId: 'legacy-new', name: '가상새팀' } as any],
  cardDocs: [card], accommodationDocs: [accommodation],
  cardTargets: [{ id: 'target', cardId: 'card', cardLabel: '가상카드', targetId: 'legacy-new', targetType: 'TEAM', targetName: '가상새팀', startDate: '2026-01-01' }],
  accommodationTargets: [{ id: 'target', accommodationId: 'room', targetType: 'worker', workerId: 'worker', workerName: '가상개인', startDate: '2026-01-01' }]
};

it('대상 변경을 조회에 반영하면서 원본 데이터와 배정팀·첨부파일을 보존한다', () => {
  const before = JSON.stringify(base);
  const result = resolveExpenseLedgerBillingTargets(base);
  expect(result.cardDocs[0]).toMatchObject({ teamId: 'new', assignedTeamId: 'assigned', totalAmount: 300, statementAttachmentPaths: ['fixture.pdf'] });
  expect(result.accommodationDocs[0]).toMatchObject({ issuedToType: 'worker', issuedToWorkerId: 'worker' });
  expect(JSON.stringify(base)).toBe(before);
  expect(result.reviewCount).toBe(0);
});

it.each(['CONFIRMED', 'PAID', 'OVERDUE'] as const)('%s 청구서는 금액과 수신자를 그대로 유지하고 확인 대상으로 표시한다', status => {
  const postedCard = { ...card, status, totalAmount: 350 };
  const postedRoom = { ...accommodation, status };
  const result = resolveExpenseLedgerBillingTargets({ ...base, cardDocs: [postedCard], accommodationDocs: [postedRoom] });
  expect(result.cardDocs[0]).toBe(postedCard);
  expect(result.accommodationDocs[0]).toBe(postedRoom);
  expect(result.reviewCount).toBe(2);
});

it('미래·종료된 기간의 대상 변경은 과거 경비에 적용하지 않는다', () => {
  const result = resolveExpenseLedgerBillingTargets({ ...base,
    cardTargets: [{ ...base.cardTargets[0], startDate: '2026-10-01' }],
    accommodationTargets: [{ ...base.accommodationTargets[0], endDate: '2026-08-31' }]
  });
  expect(result.cardDocs[0]).toBe(card);
  expect(result.accommodationDocs[0]).toBe(accommodation);
  expect(result.reviewCount).toBe(0);
});

it('월 중간에 대상이 바뀌면 월 합계를 임의 분할하지 않고 원장 재저장을 안내한다', () => {
  const result = resolveExpenseLedgerBillingTargets({ ...base,
    cardTargets: [{ ...base.cardTargets[0], startDate: '2026-09-16' }],
    accommodationTargets: [{ ...base.accommodationTargets[0], startDate: '2026-09-16' }]
  });
  expect(result.cardDocs[0]).toBe(card);
  expect(result.accommodationDocs[0]).toBe(accommodation);
  expect(result.reviewCount).toBe(2);
});

it('이미 분할 저장된 카드·숙소 항목에는 각 항목 기간의 대상만 반영한다', () => {
  const result = resolveExpenseLedgerBillingTargets({ ...base,
    cardDocs: [{ ...card, lineItems: [
      { ...card.lineItems[0], amount: 100, sourceStartDate: '2026-09-01', sourceEndDate: '2026-09-15' },
      { ...card.lineItems[0], id: 'second', amount: 200, sourceStartDate: '2026-09-16', sourceEndDate: '2026-09-30' }
    ] }],
    accommodationDocs: [{ ...accommodation, lineItems: [
      { ...accommodation.lineItems[0], label: '가상숙소 월세 2026-09-01 ~ 2026-09-15' },
      { ...accommodation.lineItems[0], id: 'second', label: '가상숙소 월세 2026-09-16 ~ 2026-09-30' }
    ] }],
    cardTargets: [{ ...base.cardTargets[0], startDate: '2026-09-16' }],
    accommodationTargets: [{ ...base.accommodationTargets[0], startDate: '2026-09-16' }]
  });
  expect(result.cardDocs.map(doc => [doc.teamId, doc.totalAmount])).toEqual([['old', 100], ['new', 200]]);
  expect(result.accommodationDocs.map(doc => doc.issuedToType)).toEqual(['team', 'worker']);
  expect(result.reviewCount).toBe(0);
});

it('수동 항목은 작성자가 지정한 대상에 남기고 자동 원장 항목만 옮긴다', () => {
  const result = resolveExpenseLedgerBillingTargets({ ...base, cardDocs: [{ ...card, lineItems: [
    ...card.lineItems, { id: 'manual', label: '수동 조정', amount: -50, sourceType: 'manual' }
  ] }] });
  expect(result.cardDocs.map(doc => [doc.teamId, doc.totalAmount])).toEqual([['new', 300], ['old', -50]]);
  expect(new Set(result.cardDocs.map(doc => doc.id)).size).toBe(2);
});

it('같은 팀의 종료·재개 이력 사이 공백을 새 청구대상으로 잘못 채우지 않는다', () => {
  const result = resolveExpenseLedgerBillingTargets({ ...base, cardTargets: [
    { ...base.cardTargets[0], endDate: '2026-09-10' },
    { ...base.cardTargets[0], id: 'restart', startDate: '2026-09-20' }
  ] });
  expect(result.cardDocs[0]).toBe(card);
  expect(result.reviewCount).toBe(1);
});

it('사무실 청구와 개인 청구의 구분을 보존한다', () => {
  const office = resolveExpenseLedgerBillingTargets({ ...base, cardTargets: [{ ...base.cardTargets[0], targetType: 'OFFICE' }] });
  expect(office.cardDocs[0]).toMatchObject({ teamId: '__office__', teamName: '사무실', issuedToType: 'team' });
  const worker = resolveExpenseLedgerBillingTargets({ ...base, cardTargets: [{ ...base.cardTargets[0], targetType: 'WORKER', targetId: 'worker' }] });
  expect(worker.cardDocs[0]).toMatchObject({ issuedToType: 'worker', issuedToWorkerId: 'worker' });
});
