import { AiPlan } from './contract';
import { SourceRow } from './domain';
import { settlementPlan, settlementDocument, settlementCatalog } from './settlementFixtures';
import { buildSettlementResult } from './settlements';
import { applyBillingReconciliation, reconciliationEntries } from './reconciliation';
export const auditPlan = (): AiPlan => ({ ...settlementPlan(), dataset: 'settlementAudit', comparison: null, sortBy: 'name', direction: 'asc', report: { ...settlementPlan().report, title: '정산 청구서 대사 보고서' } });
export const auditDocument = (teamId = 't1'): SourceRow => {
  const source = settlementDocument(teamId), suffix = teamId === 't1' ? '' : `-${teamId}`;
  source.data.deductions = [
    { id: `card_billing:2026-08:card${suffix}`, source: 'auto', origin: 'card_billing', amount: 50000 },
    { id: `accommodation_billing:2026-08:room${suffix}`, source: 'auto', origin: 'accommodation_billing', amount: 100000 },
    { id: `vehicle_billing:2026-08:car${suffix}`, source: 'auto', origin: 'vehicle_billing', amount: 30000 },
    { id: `card_billing:2026-08:missing${suffix}`, source: 'auto', origin: 'card_billing', amount: 15000 },
    { id: `accommodation_billing:2026-08:ledger:room${suffix}`, source: 'auto', origin: 'accommodation_billing', amount: 7000 },
  ];
  return source;
};
export const auditSources = (): Map<string, SourceRow> => new Map([
  ['cardBillings/card', { id: 'card', teamId: 't1', issuedToType: 'team', yearMonth: '2026-08', status: 'CONFIRMED', lineItems: [{ id: 'c1', amount: 70000 }], totalAmount: 999999 }],
  ['accommodation_billing_documents/room', { id: 'room', team: { id: 't1' }, issuedToType: 'team_leader', yearMonth: '2026-08', status: 'paid', lineItems: [{ id: 'r1', amount: 100000 }, { id: 'cancelled', amount: 999999, status: 'cancelled' }] }],
  ['vehicle_billing_documents/car', { id: 'car', assignedTeamId: 't1', issuedToType: 'team', yearMonth: '2026-08', status: 'DRAFT', lineItems: [], fixedCost: 30000, variableCost: 0, totalAmount: 30000 }],
]);
export const auditResult = () => {
  const docs = [auditDocument()], catalog = settlementCatalog();
  const result = buildSettlementResult('synthetic-audit', auditPlan(), docs, catalog);
  return applyBillingReconciliation(result, reconciliationEntries(result, docs), auditSources(), catalog);
};
