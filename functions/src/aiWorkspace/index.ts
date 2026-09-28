import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';
import { randomUUID } from 'crypto';
import { getServerGeminiSettings } from '../serverAiSettings';
import { authorizeWorkspace, WorkspaceAccess } from './data';
import { executeWorkspacePlan } from './execution';
import { AiPlan, AiResponse, AiResult, AiSavedAnalysis } from './contract';
import { text, validatePlan, WorkspaceError } from './domain';
import { planQuestion } from './planner';
import { generateWorkspaceExcel, generateWorkspacePdf } from './artifacts';
import { findSavedAnalysis, readSavedAnalyses, saveAnalysis, savedExecutionPlan } from './savedAnalyses';
import { isSavedCommand, resolveSavedCommand, SavedSelection } from './savedCommands';
import { requireWorkspaceRuntime } from './runtime';

const stateRef = (uid: string) => admin.firestore().collection('server_settings').doc('ai_workspace').collection('sessions').doc(uid);
const savedRef = (uid: string) => admin.firestore().collection('server_settings').doc('ai_workspace').collection('saved_analyses').doc(uid);
// This namespace is already locked against all direct client reads/writes by server_settings policy.
// Only the latest result is retained per user. It expires for access after one hour and is replaced on the next analysis.
export function requireCurrentResult(saved: any, access: WorkspaceAccess, id: unknown, now = Date.now()): AiResult {
  if (!id || saved?.result?.id !== id || saved?.accessHash !== access.hash || !Number.isFinite(Date.parse(saved?.result?.expiresAt)) || Date.parse(saved.result.expiresAt) <= now)
    throw new functions.https.HttpsError('failed-precondition', '분석 결과가 만료되었거나 권한·결과가 변경되었습니다. 다시 조회해 주세요.');
  return saved.result;
}
const semanticPlan = (plan: AiPlan) => {
  // Firestore may reorder map keys; canonicalize before comparing saved and new conditions.
  const normalized = validatePlan(plan);
  return JSON.stringify({ ...normalized, filters: [...normalized.filters].sort((a, b) => a.entity.localeCompare(b.entity)), operation: 'export', report: null, clarification: '' });
};
export const applyExportPlan = (result: AiResult, plan: AiPlan): AiResult => {
  if (semanticPlan(result.plan) !== semanticPlan(plan)) throw new WorkspaceError('invalid-argument', '조회 조건도 바뀌었습니다. 먼저 새 조건으로 분석한 뒤 출력해 주세요.');
  return { ...result, plan: { ...result.plan, report: plan.report }, summary: `같은 분석 결과의 보고서 구성을 변경했습니다. ${plan.report.includeAmount ? '금액을 포함합니다.' : '금액을 제외합니다.'}` };
};
export async function handleAiWorkspace(input: any, context: functions.https.CallableContext): Promise<AiResponse | { items: AiSavedAnalysis[] } | { fileName: string; contentType: string; base64: string }> {
  const startedAt = Date.now();
  const access = await authorizeWorkspace(context);
  const ref = stateRef(access.uid);
  const action = text(input?.action);
  const verifyAccess = async () => {
    if ((await authorizeWorkspace(context)).hash !== access.hash)
      throw new functions.https.HttpsError('permission-denied', '조회 중 권한이 변경되었습니다. 다시 로그인해 주세요.');
  };
  if (['saved-list', 'saved-save', 'saved-delete'].includes(action)) {
    const store = savedRef(access.uid);
    if (action === 'saved-list') {
      const items = readSavedAnalyses((await store.get()).data());
      await verifyAccess();
      return { items };
    }
    await verifyAccess();
    const items = await admin.firestore().runTransaction(async transaction => {
      await requireWorkspaceRuntime(access.uid, false, transaction, access.runtimeRevision);
      const existing = readSavedAnalyses((await transaction.get(store)).data());
      let updated: AiSavedAnalysis[];
      if (action === 'saved-save') {
        const saved = (await transaction.get(ref)).data();
        const result = requireCurrentResult(saved, access, input.resultId);
        if (saved?.busyUntil > Date.now()) throw new functions.https.HttpsError('already-exists', '분석이 끝난 뒤 조건을 저장해 주세요.');
        updated = saveAnalysis(existing, input, result.plan);
      } else {
        const item = findSavedAnalysis(existing, input.id, input.revision);
        updated = existing.filter(row => row.id !== item.id);
      }
      transaction.set(store, { version: 1, items: updated });
      return updated;
    });
    await verifyAccess();
    return { items };
  }
  let savedItem = action === 'saved-run'
    ? findSavedAnalysis(readSavedAnalyses((await savedRef(access.uid).get()).data()), input.id, input.revision) : null;
  if (action === 'export') {
    const saved = (await ref.get()).data();
    const result = requireCurrentResult(saved, access, input.resultId);
    if (!['pdf', 'xlsx'].includes(input.format)) throw new WorkspaceError('invalid-argument', '출력 형식을 확인해 주세요.');
    const bytes = input.format === 'pdf' ? await generateWorkspacePdf(result) : await generateWorkspaceExcel(result);
    if (bytes.length > 5 * 1024 * 1024) throw new WorkspaceError('resource-exhausted', '파일이 큽니다. 상세 내역 또는 조회 기간을 줄여 주세요.');
    // Recheck both account membership and snapshot version immediately before returning the file.
    requireCurrentResult((await ref.get()).data(), await authorizeWorkspace(context), result.id);
    return { fileName: `CY_${result.plan.range.startDate}_${result.id.slice(0, 8)}.${input.format}`,
      contentType: input.format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', base64: bytes.toString('base64') };
  }
  if (!savedItem && (action !== 'analyze' || typeof input.question !== 'string' || !input.question.trim() || input.question.length > 1200))
    throw new WorkspaceError('invalid-argument', '질문은 1~1,200자로 입력해 주세요.');
  if (!savedItem && input.plan !== undefined) validatePlan(input.plan);
  const contextPlan = savedItem || input.contextPlan === undefined ? null : validatePlan(input.contextPlan);
  const requestId = randomUUID();
  const previous = await admin.firestore().runTransaction(async transaction => {
    await requireWorkspaceRuntime(access.uid, false, transaction, access.runtimeRevision);
    const saved = (await transaction.get(ref)).data() || {};
    const now = Date.now();
    if (saved.busyUntil > now) throw new functions.https.HttpsError('already-exists', '이 계정의 분석이 진행 중입니다. 완료 후 다시 시도해 주세요.');
    const count = saved.windowStart > now - 60000 ? (saved.requestCount || 0) + 1 : 1;
    if (count > 10) throw new functions.https.HttpsError('resource-exhausted', '분당 요청 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.');
    let result: AiResult | null = null;
    // An expired displayed result must not prevent a fresh saved-list lookup or rerun.
    // Never send its private plan to the model unless it passes current access/expiry checks.
    if (!savedItem && input.previousId) {
      try { result = requireCurrentResult(saved, access, input.previousId); } catch { /* Validate again after routing ordinary queries. */ }
    }
    transaction.set(ref, { leaseId: requestId, busyUntil: now + 120000, requestCount: count,
      windowStart: count === 1 ? now : saved.windowStart }, { merge: true });
    return result;
  });
  try {
    const planned = savedItem ? { plan: savedExecutionPlan(savedItem), inputTokens: 0, outputTokens: 0 }
      : input.plan ? { plan: validatePlan(input.plan), inputTokens: 0, outputTokens: 0 }
      : await planQuestion(input.question.trim(), contextPlan || previous?.plan || null, await getServerGeminiSettings());
    let plan = planned.plan;
    if (isSavedCommand(plan)) {
      const items = readSavedAnalyses((await savedRef(access.uid).get()).data());
      const state = (await ref.get()).data();
      const resolved = resolveSavedCommand(items, plan, state?.savedSelection, input.savedContextId, access.hash);
      if (resolved.run) {
        savedItem = resolved.run;
        plan = savedExecutionPlan(savedItem);
      } else {
        await verifyAccess();
        const selection: SavedSelection = { id: randomUUID(), accessHash: access.hash, expiresAt: new Date(Date.now() + 3600000).toISOString(),
          refs: resolved.matches.map(item => ({ id: item.id, revision: item.revision })) };
        await admin.firestore().runTransaction(async transaction => {
          await requireWorkspaceRuntime(access.uid, false, transaction, access.runtimeRevision);
          const latest = (await transaction.get(ref)).data();
          if (latest?.leaseId !== requestId) throw new functions.https.HttpsError('aborted', '분석 요청이 변경되었습니다. 다시 시도해 주세요.');
          const currentItems = readSavedAnalyses((await transaction.get(savedRef(access.uid))).data());
          for (const item of resolved.matches) findSavedAnalysis(currentItems, item.id, item.revision);
          transaction.set(ref, { savedSelection: selection }, { merge: true });
        });
        await verifyAccess();
        functions.logger.info('ai-workspace-saved', { kind: plan.operation, inputTokens: planned.inputTokens, outputTokens: planned.outputTokens, matches: resolved.matches.length, elapsedMs: Date.now() - startedAt });
        return { status: 'saved', plan, savedMatches: { contextId: selection.id, items: resolved.matches }, message: resolved.message };
      }
    } else if (!savedItem && input.previousId && !previous) {
      requireCurrentResult((await ref.get()).data(), access, input.previousId);
    }
    if (plan.operation === 'clarify') {
      await verifyAccess();
      return { status: 'clarification', plan, message: plan.clarification || '기간과 집계 기준을 구체적으로 알려 주세요.', choices: [] };
    }
    let result: AiResult;
    if (plan.operation === 'export') {
      if (!previous) throw new WorkspaceError('failed-precondition', '먼저 자료를 조회한 뒤 보고서를 요청해 주세요.');
      result = applyExportPlan(previous, plan);
    } else {
      const response = await executeWorkspacePlan(plan, access, context, Boolean(savedItem));
      if (!response.result) return response;
      result = response.result;
    }
    const current = await authorizeWorkspace(context);
    if (current.hash !== access.hash) throw new functions.https.HttpsError('permission-denied', '조회 중 권한이 변경되었습니다. 다시 로그인해 주세요.');
    if (Buffer.byteLength(JSON.stringify(result), 'utf8') > 850000) throw new WorkspaceError('resource-exhausted', '분석 결과가 큽니다. 기간이나 대상을 좁혀 주세요.');
    await admin.firestore().runTransaction(async transaction => {
      await requireWorkspaceRuntime(access.uid, false, transaction, access.runtimeRevision);
      const saved = (await transaction.get(ref)).data();
      if (saved?.leaseId !== requestId) throw new functions.https.HttpsError('aborted', '분석 요청이 변경되었습니다. 다시 시도해 주세요.');
      if (savedItem) findSavedAnalysis(readSavedAnalyses((await transaction.get(savedRef(access.uid))).data()), savedItem.id, savedItem.revision);
      transaction.set(ref, { result, accessHash: access.hash, savedSelection: null }, { merge: true });
    });
    functions.logger.info('ai-workspace', { kind: result.plan.operation, inputTokens: planned.inputTokens,
      outputTokens: planned.outputTokens, rows: result.rows.length, reports: result.totals.reports, completeness: result.completeness, elapsedMs: Date.now() - startedAt });
    return { status: 'complete', plan: result.plan, result };
  } finally {
    await admin.firestore().runTransaction(async transaction => {
      const saved = (await transaction.get(ref)).data();
      if (saved?.leaseId === requestId) transaction.update(ref, { busyUntil: 0, leaseId: '' });
    });
  }
}
export const aiWorkspace = functions.runWith({ timeoutSeconds: 120, memory: '1GB', maxInstances: 3 }).region('asia-northeast3').https.onCall(async (input, context) => {
  try { return await handleAiWorkspace(input, context); }
  catch (error) {
    if (error instanceof WorkspaceError) throw new functions.https.HttpsError(error.code, error.message);
    if (error instanceof functions.https.HttpsError) throw error;
    functions.logger.error('ai-workspace-failed');
    throw new functions.https.HttpsError('internal', '요청을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.');
  }
});
