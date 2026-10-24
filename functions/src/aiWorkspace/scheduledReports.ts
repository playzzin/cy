import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';
import { randomUUID } from 'crypto';
import { AI_REPORT_RETENTION_DAYS, AI_SCHEDULE_LIMIT, AiReportOverview, AiReportRun, AiReportSchedule, AiResult } from './contract';
import { authorizeWorkspace, WorkspaceAccess } from './data';
import { WorkspaceError } from './domain';
import { executeWorkspacePlan } from './execution';
import { findSavedAnalysis, readSavedAnalyses, savedExecutionPlan, savedId } from './savedAnalyses';
import { generateWorkspaceExcel, generateWorkspacePdf } from './artifacts';
import { nextReportAt, PAUSED_REPORT_DATE, REPORT_LEASE_MS, REPORT_MAX_ATTEMPTS, reportFailure, reportRunId, validateCadence } from './reportSchedule';
import { readWorkspaceRuntime, requireWorkspaceRuntime, workspaceRuntimeAllows, WorkspaceUnavailableError } from './runtime';

const root = () => admin.firestore().doc('server_settings/ai_workspace');
const schedules = () => root().collection('ai_report_schedules');
const runs = () => root().collection('ai_report_runs');
const results = () => root().collection('ai_report_results');
const ownerRef = (uid: string) => root().collection('report_owners').doc(uid);
const savedRef = (uid: string) => root().collection('saved_analyses').doc(uid);
type Lease = { token: string; runId: string; dueAt: string; until: string; resumeAt?: string };
type Schedule = Omit<AiReportSchedule, 'nextRunAt'> & { uid: string; accessHash: string; nextRunAt: string; lease: Lease | null };
type Run = AiReportRun & { uid: string; accessHash: string };
const expiredAt = (now: Date) => new Date(now.getTime() + AI_REPORT_RETENTION_DAYS * 86400000).toISOString();
const precondition = (message: string): never => { throw new WorkspaceError('failed-precondition', message); };
const assertOwner = (value: any, uid: string): void => {
  if (!value || value.uid !== uid) throw new functions.https.HttpsError('permission-denied', '내 계정의 정기 보고만 사용할 수 있습니다.');
};
const publicSchedule = (value: Schedule): AiReportSchedule => ({ id: value.id, revision: value.revision, savedId: value.savedId,
  savedRevision: value.savedRevision, name: value.name, cadence: value.cadence, enabled: value.enabled,
  nextRunAt: value.enabled ? value.nextRunAt : null, updatedAt: value.updatedAt, lastMessage: value.lastMessage });
const publicRun = (value: Run): AiReportRun => ({ id: value.id, scheduleId: value.scheduleId, scheduleRevision: value.scheduleRevision,
  name: value.name, dueAt: value.dueAt, createdAt: value.createdAt, completedAt: value.completedAt, expiresAt: value.expiresAt,
  status: value.status, attempts: value.attempts, message: value.message, retryable: value.retryable });
async function accessFor(context: functions.https.CallableContext): Promise<WorkspaceAccess> {
  return authorizeWorkspace(context);
}
// Only server-owned schedule UIDs reach this adapter. All authorization uses current profiles.
const backgroundContext = (uid: string) => ({ auth: { uid, token: {} } } as functions.https.CallableContext);
async function verifyAccess(context: functions.https.CallableContext, hash: string) {
  const access = await accessFor(context);
  if (access.hash !== hash) throw new functions.https.HttpsError('permission-denied', '정기 보고의 조회 권한이 변경되었습니다. 예약을 다시 확인해 주세요.');
  return access;
}
async function overview(uid: string): Promise<AiReportOverview> {
  const [items, history] = await Promise.all([
    schedules().where('uid', '==', uid).limit(AI_SCHEDULE_LIMIT).get(),
    runs().where('uid', '==', uid).orderBy('createdAt', 'desc').limit(30).get(),
  ]);
  return { schedulerEnabled: workspaceRuntimeAllows(await readWorkspaceRuntime(), uid, true), schedules: items.docs.map(doc => publicSchedule(doc.data() as Schedule)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    runs: history.docs.map(doc => doc.data() as Run).filter(run => Date.parse(run.expiresAt) > Date.now()).map(publicRun) };
}

export async function handleWorkspaceReports(input: any, context: functions.https.CallableContext): Promise<any> {
  const access = await accessFor(context), uid = access.uid;
  const action = input?.action;
  if (action === 'list') {
    const response = await overview(uid); await verifyAccess(context, access.hash); return response;
  }
  if (action === 'export') {
    const id = savedId(input.runId), format = input.format;
    if (!['pdf', 'xlsx'].includes(format)) throw new WorkspaceError('invalid-argument', '출력 형식을 확인해 주세요.');
    const getResult = async (): Promise<AiResult> => {
      const [runDoc, resultDoc] = await Promise.all([runs().doc(id).get(), results().doc(id).get()]);
      const run = runDoc.data() as Run, stored = resultDoc.data();
      assertOwner(run, uid);
      if (!['complete', 'partial'].includes(run.status) || Date.parse(run.expiresAt) <= Date.now() || !stored?.result || stored.uid !== uid || stored.accessHash !== access.hash || run.accessHash !== access.hash)
        precondition('보고서가 만료되었거나 조회 권한이 변경되었습니다. 현재 조건으로 다시 조회해 주세요.');
      return stored!.result;
    };
    const result = await getResult();
    const bytes = format === 'pdf' ? await generateWorkspacePdf(result) : await generateWorkspaceExcel(result);
    if (bytes.length > 5 * 1024 * 1024) throw new WorkspaceError('resource-exhausted', '파일이 큽니다. 저장 조건의 기간이나 상세 내역을 줄여 주세요.');
    await verifyAccess(context, access.hash); await getResult();
    return { fileName: `CY_정기보고_${result.plan.range.startDate}_${id.slice(0, 8)}.${format}`,
      contentType: format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', base64: bytes.toString('base64') };
  }
  if (action === 'retry') {
    await requireWorkspaceRuntime(uid, true);
    const run = (await runs().doc(savedId(input.runId)).get()).data() as Run;
    assertOwner(run, uid);
    await verifyAccess(context, run.accessHash);
    await processReportSchedule(run.scheduleId, new Date(), { uid, runId: run.id });
    const response = await overview(uid); await verifyAccess(context, access.hash); return response;
  }
  if (!['save', 'pause', 'delete'].includes(action)) throw new WorkspaceError('invalid-argument', '정기 보고 요청을 확인해 주세요.');
  if (action === 'save') await requireWorkspaceRuntime(uid, true);
  const cadence = action === 'save' ? validateCadence(input.cadence) : null;
  const id = input.id === undefined && action === 'save' ? randomUUID() : savedId(input.id);
  const ref = schedules().doc(id), now = new Date();
  await admin.firestore().runTransaction(async transaction => {
    await requireWorkspaceRuntime(uid, action === 'save', transaction, access.runtimeRevision);
    // All schedule mutations serialize on the owner document, including concurrent creates.
    const owner = (await transaction.get(ownerRef(uid))).data() || { ids: [] };
    const previous = (await transaction.get(ref)).data() as Schedule | undefined;
    if (previous) {
      assertOwner(previous, uid);
      if (previous.revision !== input.revision) precondition('예약이 변경되었습니다. 목록을 새로고침해 주세요.');
    } else if (input.id !== undefined || action !== 'save') precondition('예약이 삭제되었습니다. 목록을 새로고침해 주세요.');
    const items = action === 'save' ? readSavedAnalyses((await transaction.get(savedRef(uid))).data()) : [];
    const oldRun = previous?.lease ? (await transaction.get(runs().doc(previous.lease.runId))).data() as Run : null;
    const ids: string[] = Array.isArray(owner.ids) ? owner.ids : [];
    if (action === 'save') {
      const item = findSavedAnalysis(items, input.savedId, input.savedRevision);
      if (!previous && ids.length >= AI_SCHEDULE_LIMIT) throw new WorkspaceError('resource-exhausted', `정기 보고는 계정당 ${AI_SCHEDULE_LIMIT}개까지 등록할 수 있습니다.`);
      const value: Schedule = { id, uid, revision: (previous?.revision || 0) + 1, savedId: item.id, savedRevision: item.revision, name: item.name,
        cadence: cadence!, enabled: true, accessHash: access.hash, nextRunAt: nextReportAt(cadence!, now), updatedAt: now.toISOString(), lease: null, lastMessage: '' };
      transaction.set(ref, value);
    } else if (action === 'pause') {
      transaction.update(ref, { enabled: false, revision: previous!.revision + 1, nextRunAt: PAUSED_REPORT_DATE,
        lease: null, updatedAt: now.toISOString(), lastMessage: '사용자가 예약을 중지했습니다.' });
    } else transaction.delete(ref);
    if (oldRun?.status === 'running') transaction.update(runs().doc(oldRun.id), { status: 'failed', completedAt: now.toISOString(), retryable: false, message: '예약이 변경되거나 중지되어 결과를 보관하지 않았습니다.' });
    transaction.set(ownerRef(uid), { ids: action === 'delete' ? ids.filter(value => value !== id) : [...new Set([...ids, id])] });
  });
  const response = await overview(uid); await verifyAccess(context, access.hash); return response;
}

// A slot has one deterministic ID. Known failures require explicit retry; a lost worker
// becomes a visible failure after its lease, rather than silently executing twice.
export async function processReportSchedule(id: string, now = new Date(), retry?: { uid: string; runId: string }): Promise<string> {
  const startedAt = Date.now();
  const ref = schedules().doc(savedId(id));
  const claim = await admin.firestore().runTransaction(async transaction => {
    const runtime = await readWorkspaceRuntime(transaction);
    const value = (await transaction.get(ref)).data() as Schedule | undefined;
    if (retry) assertOwner(value, retry.uid);
    if (value && !workspaceRuntimeAllows(runtime, value.uid, true)) { if (retry) throw new WorkspaceUnavailableError(); return null; }
    if (!value || !value.enabled) { if (retry) precondition('예약을 다시 저장한 뒤 실행해 주세요.'); return null; }
    if (value.lease) {
      if (Date.parse(value.lease.until) > now.getTime()) {
        if (retry) throw new functions.https.HttpsError('already-exists', '이 예약의 보고서를 생성 중입니다.');
        return null;
      }
      const lost = (await transaction.get(runs().doc(value.lease.runId))).data() as Run | undefined;
      if (lost?.status === 'running') transaction.update(runs().doc(lost.id), { status: 'failed', completedAt: now.toISOString(),
        message: lost.attempts < REPORT_MAX_ATTEMPTS ? '실행 응답이 중단되었습니다. 다시 시도하면 같은 예정 시각의 조건으로 조회합니다.' : '3회 시도 후 실행 응답이 중단되었습니다. 다음 예약 때 다시 실행합니다.', retryable: lost.attempts < REPORT_MAX_ATTEMPTS });
      transaction.update(ref, { lease: null, nextRunAt: value.lease.resumeAt || nextReportAt(value.cadence, now), lastMessage: '지난 실행이 중단되었습니다. 실행 내역을 확인해 주세요.' });
      return null;
    }
    if (!retry && Date.parse(value.nextRunAt) > now.getTime()) return null;
    const runId = retry?.runId || reportRunId(value.id, value.revision, value.nextRunAt);
    const existing = (await transaction.get(runs().doc(runId))).data() as Run | undefined;
    if (retry) {
      assertOwner(existing, retry.uid);
      if (existing!.scheduleId !== id || existing!.scheduleRevision !== value.revision || existing!.accessHash !== value.accessHash || existing!.status !== 'failed' || !existing!.retryable || existing!.attempts >= REPORT_MAX_ATTEMPTS || Date.parse(existing!.expiresAt) <= now.getTime())
        precondition('이 실행은 다시 시도할 수 없습니다. 예약과 실행 내역을 새로고침해 주세요.');
    } else if (existing) {
      transaction.update(ref, { nextRunAt: nextReportAt(value.cadence, now) }); return null;
    }
    const dueAt = existing?.dueAt || value.nextRunAt;
    const lease: Lease = { runId, dueAt, token: randomUUID(), until: new Date(now.getTime() + REPORT_LEASE_MS).toISOString(),
      ...(retry ? { resumeAt: value.nextRunAt } : {}) };
    const run: Run = { id: runId, uid: value.uid, accessHash: value.accessHash, scheduleId: id, scheduleRevision: value.revision, name: value.name,
      dueAt, createdAt: existing?.createdAt || now.toISOString(), completedAt: null, expiresAt: existing?.expiresAt || expiredAt(now),
      attempts: (existing?.attempts || 0) + 1, status: 'running', message: '', retryable: false };
    transaction.set(runs().doc(runId), run);
    transaction.update(ref, { lease, nextRunAt: lease.until });
    return { schedule: value, lease, run };
  });
  if (!claim) return 'skipped';
  const { schedule, lease, run } = claim, context = backgroundContext(schedule.uid);
  try {
    await requireWorkspaceRuntime(schedule.uid, true);
    const access = await verifyAccess(context, schedule.accessHash);
    const item = findSavedAnalysis(readSavedAnalyses((await savedRef(schedule.uid).get()).data()), schedule.savedId, schedule.savedRevision);
    // Rolling periods use the intended business date, even after a month-boundary retry.
    const response = await executeWorkspacePlan(savedExecutionPlan(item, new Date(lease.dueAt)), access, context, true);
    if (!response.result) precondition('저장 조건의 대상을 다시 확인해 주세요.');
    const result: AiResult = { ...response.result!, expiresAt: run.expiresAt };
    await verifyAccess(context, schedule.accessHash);
    await requireWorkspaceRuntime(schedule.uid, true);
    const completedAt = new Date().toISOString();
    const stored = await admin.firestore().runTransaction(async transaction => {
      await requireWorkspaceRuntime(schedule.uid, true, transaction, access.runtimeRevision);
      const current = (await transaction.get(ref)).data() as Schedule | undefined;
      const items = readSavedAnalyses((await transaction.get(savedRef(schedule.uid))).data());
      if (!current?.enabled || current.revision !== schedule.revision || current.lease?.token !== lease.token || Date.parse(lease.until) <= Date.now()) return false;
      findSavedAnalysis(items, item.id, item.revision);
      transaction.set(results().doc(run.id), { uid: schedule.uid, accessHash: access.hash, expiresAt: run.expiresAt, result });
      transaction.update(runs().doc(run.id), { status: result.completeness === 'partial' ? 'partial' : 'complete', completedAt,
        message: result.completeness === 'partial' ? '일부 자료를 확인하지 못했습니다. 보고서의 경고를 확인해 주세요.' : '보고서 생성 완료', retryable: false });
      transaction.update(ref, { lease: null, nextRunAt: lease.resumeAt || nextReportAt(schedule.cadence, new Date(Math.max(now.getTime(), Date.now()))),
        lastMessage: result.completeness === 'partial' ? '부분 결과가 있습니다. 보고서의 경고를 확인해 주세요.' : '최근 보고서를 생성했습니다.' });
      return true;
    });
    functions.logger.info('ai-workspace-report', { status: stored ? result.completeness : 'discarded', attempts: run.attempts, elapsedMs: Date.now() - startedAt, delayMs: Math.max(0, startedAt - Date.parse(lease.dueAt)) });
    return stored ? result.completeness : 'discarded';
  } catch (error) {
    const failure = error instanceof WorkspaceUnavailableError
      ? { message: '운영 설정으로 이번 실행이 중지되었습니다. 예약은 유지되며 운영 재개 후 다시 시도할 수 있습니다.', retryable: true, pause: false }
      : reportFailure(error);
    const message = failure.retryable && run.attempts >= REPORT_MAX_ATTEMPTS ? '3회 시도했지만 생성하지 못했습니다. 다음 예약 때 다시 실행합니다.' : failure.message;
    await admin.firestore().runTransaction(async transaction => {
      const current = (await transaction.get(ref)).data() as Schedule | undefined;
      if (current?.revision !== schedule.revision || current.lease?.token !== lease.token) return;
      transaction.update(runs().doc(run.id), { status: 'failed', completedAt: new Date().toISOString(), message,
        retryable: failure.retryable && run.attempts < REPORT_MAX_ATTEMPTS });
      transaction.update(ref, { lease: null, enabled: !failure.pause, nextRunAt: failure.pause ? PAUSED_REPORT_DATE : lease.resumeAt || nextReportAt(schedule.cadence, new Date(Math.max(now.getTime(), Date.now()))), lastMessage: message });
    });
    functions.logger.warn('ai-workspace-report', { status: 'failed', retryable: failure.retryable && run.attempts < REPORT_MAX_ATTEMPTS, attempts: run.attempts, elapsedMs: Date.now() - startedAt });
    return 'failed';
  }
}

export async function sweepWorkspaceReports(now = new Date()): Promise<{ processed: number; deleted: number }> {
  // Limited sequential work; repeated scheduler delivery is safe because claims are transactional.
  const expired = await runs().where('expiresAt', '<=', now.toISOString()).limit(100).get();
  if (expired.size) {
    const batch = admin.firestore().batch();
    expired.docs.forEach(doc => { batch.delete(doc.ref); batch.delete(results().doc(doc.id)); });
    await batch.commit();
  }
  const runtime = await readWorkspaceRuntime();
  if (runtime.mode === 'off' || !runtime.schedulerEnabled || (runtime.mode === 'pilot' && !runtime.pilotUids.length)) return { processed: 0, deleted: expired.size };
  let query = schedules().where('nextRunAt', '<=', now.toISOString()).orderBy('nextRunAt');
  // Filter before limiting so an older, non-pilot queue cannot starve approved accounts.
  if (runtime.mode === 'pilot') query = query.where('uid', 'in', runtime.pilotUids);
  const due = await query.limit(10).get();
  let processed = 0;
  const started = Date.now();
  for (const doc of due.docs) {
    if (Date.now() - started > 240000) break;
    if (!workspaceRuntimeAllows(runtime, doc.get('uid'), true)) continue;
    try { await processReportSchedule(doc.id, now); processed++; }
    catch { functions.logger.warn('ai-workspace-report-claim-failed'); }
  }
  return { processed, deleted: expired.size };
}
export const aiWorkspaceReports = functions.runWith({ timeoutSeconds: 120, memory: '1GB', maxInstances: 3 }).region('asia-northeast3').https.onCall(async (input, context) => {
  try { return await handleWorkspaceReports(input, context); }
  catch (error) {
    if (error instanceof WorkspaceError) throw new functions.https.HttpsError(error.code, error.message);
    if (error instanceof functions.https.HttpsError) throw error;
    functions.logger.error('ai-workspace-reports-failed');
    throw new functions.https.HttpsError('internal', '정기 보고 요청을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.');
  }
});
export const generateScheduledWorkspaceReports = functions.runWith({ timeoutSeconds: 540, memory: '1GB', maxInstances: 1 }).region('asia-northeast3')
  .pubsub.schedule('every 5 minutes').timeZone('Asia/Seoul').onRun(async () => { await sweepWorkspaceReports(); });
