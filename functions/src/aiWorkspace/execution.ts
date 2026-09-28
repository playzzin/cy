import { randomUUID } from 'crypto';
import * as functions from 'firebase-functions/v1';
import { AiPlan, AiResponse } from './contract';
import { authorizeWorkspace, loadCatalog, loadReports, loadSettlements, loadReconciliationSources, loadMissingBills, WorkspaceAccess } from './data';
import { buildResult, resolveFilters, WorkspaceError } from './domain';
import { buildSettlementResult } from './settlements';
import { applyBillingReconciliation, reconciliationEntries } from './reconciliation';
import { buildSettlementEvidence } from './settlementEvidence';
import { buildMissingBillingResult, missingTeams } from './missingBilling';

// Shared deterministic executor: no model call, session mutation or source-data writes.
export async function executeWorkspacePlan(plan: AiPlan, access: WorkspaceAccess, context: functions.https.CallableContext, saved = false): Promise<AiResponse> {
  const verifyAccess = async () => {
    if ((await authorizeWorkspace(context)).hash !== access.hash)
      throw new functions.https.HttpsError('permission-denied', '조회 중 권한이 변경되었습니다. 다시 로그인해 주세요.');
  };
  const catalog = await loadCatalog(access, plan, context);
  const resolution = resolveFilters(plan, catalog);
  if (saved && resolution.message) throw new WorkspaceError('failed-precondition', '저장한 조회 대상에 접근할 수 없거나 대상이 변경되었습니다. 새로 조회한 뒤 저장 조건을 바꿔 주세요.');
  if (resolution.message) {
    // Candidate names and IDs are protected data, even when no result was calculated.
    await verifyAccess();
    return { status: 'clarification', plan: resolution.plan, message: resolution.message, choices: resolution.choices };
  }
  let result;
  if (['teamSettlements', 'settlementAudit', 'settlementMissing', 'settlementEvidence'].includes(resolution.plan.dataset || '')) {
    if (resolution.plan.dataset === 'settlementMissing') missingTeams(resolution.plan, catalog);
    const documents = await loadSettlements(resolution.plan, catalog);
    result = buildSettlementResult(randomUUID(), resolution.plan, documents, catalog);
    if (resolution.plan.dataset === 'settlementEvidence') result = buildSettlementEvidence(result, documents, catalog);
    if (resolution.plan.dataset === 'settlementAudit') {
      const entries = reconciliationEntries(result, documents);
      result = applyBillingReconciliation(result, entries, await loadReconciliationSources(entries, catalog), catalog);
    }
    if (resolution.plan.dataset === 'settlementMissing') {
      const { bills, excludedUnconfirmed } = await loadMissingBills(resolution.plan, catalog);
      result = buildMissingBillingResult(result, documents, bills, catalog, excludedUnconfirmed);
    }
  } else result = buildResult(randomUUID(), resolution.plan, await loadReports(access, resolution.plan, context), catalog);
  if (!access.all) result.warnings.push('현재 연결된 팀의 조회 가능한 자료만 포함합니다.');
  await verifyAccess();
  if (Buffer.byteLength(JSON.stringify(result), 'utf8') > 850000) throw new WorkspaceError('resource-exhausted', '분석 결과가 큽니다. 기간이나 대상을 좁혀 주세요.');
  return { status: 'complete', plan: result.plan, result };
}
