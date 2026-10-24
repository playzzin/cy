import { AiPlan } from './contract';
import { buildSettlementEvidence } from './settlementEvidence';
import { settlementCatalog, settlementDocument } from './settlementFixtures';
import { buildSettlementResult } from './settlements';
import { auditPlan } from './reconciliationFixtures';
export const evidencePlan = (): AiPlan => ({ ...auditPlan(), dataset: 'settlementEvidence', report: { ...auditPlan().report, title: '일보·지원비 저장 근거 점검 보고서' } });
export const evidenceDocuments = () => {
  const doc = settlementDocument();
  doc.data.sales = [{ id: 'support-sales', source: 'auto', origin: '내부지원간곳', siteId: 's1', siteName: '검증 현장', counterTeamId: 't2', manDay: 1.5, amount: 270000 }];
  doc.data.purchases = [{ id: 'support-purchase', source: 'auto', origin: '외부지원온곳', siteId: 's1', siteName: '검증 현장', counterTeamId: 'outside', manDay: 1, amount: 150000 }];
  doc.data.sourceSnapshot = { version: 2, capturedAt: '2026-08-31T00:00:00.000Z', dailyReports: [{ reportId: 'report-1', date: '2026-08-10' }],
    supportDetails: [{ id: 'private-worker-reference-1', direction: '내부지원간곳', siteId: 's1', siteName: '검증 현장', counterTeamId: 't2', date: '2026-08-10', manDay: 1.5, unitPrice: 180000, amount: 270000, workerName: '반환 금지 개인정보' },
      { id: 'private-worker-reference-2', direction: '외부지원온곳', siteId: 's1', siteName: '검증 현장', counterTeamId: 'outside', date: '2026-08-10', manDay: 1, unitPrice: 180000, amount: 180000 }] };
  return [doc, settlementDocument('t2', '2026-08', false)];
};
export const evidenceResult = () => {
  const docs = evidenceDocuments(), catalog = settlementCatalog();
  return buildSettlementEvidence(buildSettlementResult('synthetic-evidence', evidencePlan(), docs, catalog), docs, catalog);
};
