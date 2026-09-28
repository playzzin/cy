import { AiPlan } from './contract';
import { buildMissingBillingResult, ScopedBill } from './missingBilling';
import { buildSettlementResult } from './settlements';
import { settlementCatalog, settlementDocument } from './settlementFixtures';
import { auditPlan } from './reconciliationFixtures';
export const missingPlan = (): AiPlan => ({ ...auditPlan(), dataset: 'settlementMissing', report: { ...auditPlan().report, title: '정산 미연결 청구서 점검 보고서' } });
export const missingDocuments = () => {
  const first = settlementDocument(); first.data.deductions = [
    { id: 'card_billing:2026-08:linked-card', amount: 50000, origin: 'card_billing', source: 'auto' },
    { id: 'accommodation_billing:2026-08:ledger:room', amount: 7000, origin: 'accommodation_billing', source: 'auto' },
  ];
  return [first, settlementDocument('t2', '2026-08', false)];
};
export const missingBills = (): ScopedBill[] => [
  { origin: 'card_billing', teamId: 't1', source: { id: 'linked-card', teamId: 't1', cardId: 'c1', yearMonth: '2026-08', issuedToType: 'team', status: 'CONFIRMED', lineItems: [{ amount: 70000 }], totalAmount: 1 } },
  { origin: 'card_billing', teamId: 't1', source: { id: 'new-card', teamId: 't1', cardId: 'c2', yearMonth: '2026-08', issuedToType: 'team', status: 'PAID', lineItems: [{ amount: 90000 }], totalAmount: 1 } },
  { origin: 'accommodation_billing', teamId: 't1', source: { id: 'room', team: { id: 't1' }, yearMonth: '2026-08', issuedToType: 'team_leader', status: 'CONFIRMED', lineItems: [{ id: 'room-line', amount: 100000 }] } },
  { origin: 'vehicle_billing', teamId: 't1', source: { id: 'new-car', assignedTeamId: 't1', vehicleId: 'v1', yearMonth: '2026-08', issuedToType: 'team', status: 'OVERDUE', lineItems: [], fixedCost: 30000, variableCost: 10000, totalAmount: 1 } },
  { origin: 'vehicle_billing', teamId: 't1', source: { id: 'bad-car', teamId: 't1', vehicleId: 'v2', yearMonth: '2026-08', issuedToType: 'team', status: 'CONFIRMED', lineItems: [{ amount: '1234' }] } },
  { origin: 'card_billing', teamId: 't1', source: { id: 'zero-card', teamId: 't1', cardId: 'c3', yearMonth: '2026-08', issuedToType: 'team', status: '확정', lineItems: [], totalAmount: 0 } },
  { origin: 'card_billing', teamId: 't2', source: { id: 'unconfirmed-team', teamId: 't2', cardId: 'c4', yearMonth: '2026-08', issuedToType: 'team', status: 'CONFIRMED', lineItems: [{ amount: 60000 }] } },
];
export const missingResult = () => {
  const docs = missingDocuments(), catalog = settlementCatalog();
  return buildMissingBillingResult(buildSettlementResult('synthetic-missing', missingPlan(), docs, catalog), docs, missingBills(), catalog, 2);
};
