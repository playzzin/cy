import { randomUUID } from 'crypto';
import { AI_SAVED_LIMIT, AiPlan, AiSavedAnalysis, AiSavedPeriod, aiMonthRange, canUseRollingMonth } from './contract';
import { validatePlan, WorkspaceError } from './domain';

const fail = (message: string): never => { throw new WorkspaceError('invalid-argument', message); };
export const savedId = (value: unknown): string => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(value)
  ? value : fail('저장 항목을 다시 선택해 주세요.');
export const savedName = (value: unknown): string => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 60
  && ![...value].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127) ? value.trim() : fail('저장 이름은 줄바꿈 없이 1~60자로 입력해 주세요.');
export function savedPeriod(value: unknown, plan: AiPlan): AiSavedPeriod {
  if (!['fixed', 'thisMonth', 'lastMonth'].includes(value as string)) fail('저장 기간 방식을 선택해 주세요.');
  if (value !== 'fixed' && !canUseRollingMonth(plan)) fail('월 자동 변경은 한 달 전체 조회와 전월 비교에서만 사용할 수 있습니다.');
  return value as AiSavedPeriod;
}
export function reusablePlan(value: unknown): AiPlan {
  const plan = validatePlan(value);
  if (!['aggregate', 'search'].includes(plan.operation) || plan.filters.some(filter => !filter.id))
    throw new WorkspaceError('failed-precondition', '대상이 확정된 분석 결과만 저장할 수 있습니다. 먼저 조회해 주세요.');
  return { ...plan, clarification: '' };
}
// A bounded private document contains conditions only: never a result, raw question or download bytes.
export function readSavedAnalyses(data: any): AiSavedAnalysis[] {
  if (data === undefined) return [];
  if (data?.version !== 1 || !Array.isArray(data.items) || data.items.length > AI_SAVED_LIMIT)
    throw new WorkspaceError('failed-precondition', '저장 목록 형식을 확인할 수 없습니다. 관리자에게 문의해 주세요.');
  const items: AiSavedAnalysis[] = data.items.map((item: any): AiSavedAnalysis => {
    const plan = reusablePlan(item.plan);
    if (!Number.isSafeInteger(item.revision) || item.revision < 1 || ![item.createdAt, item.updatedAt].every(value => typeof value === 'string' && Number.isFinite(Date.parse(value))))
      throw new WorkspaceError('failed-precondition', '저장 항목 버전을 확인할 수 없습니다.');
    return { id: savedId(item.id), revision: item.revision, name: savedName(item.name), period: savedPeriod(item.period, plan), plan,
      createdAt: item.createdAt, updatedAt: item.updatedAt };
  });
  if (new Set(items.map(item => item.id)).size !== items.length) throw new WorkspaceError('failed-precondition', '저장 항목이 중복되었습니다.');
  return items.sort((a: AiSavedAnalysis, b: AiSavedAnalysis) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id));
}
export function findSavedAnalysis(items: AiSavedAnalysis[], id: unknown, revision: unknown): AiSavedAnalysis {
  const item = items.find(row => row.id === savedId(id));
  if (!item || item.revision !== revision) throw new WorkspaceError('failed-precondition', '저장 항목이 변경되었거나 삭제되었습니다. 목록을 새로고침해 주세요.');
  return item;
}
export function saveAnalysis(items: AiSavedAnalysis[], input: any, resultPlan: AiPlan, now = new Date()): AiSavedAnalysis[] {
  const plan = reusablePlan(resultPlan), name = savedName(input.name), period = savedPeriod(input.period, plan);
  const previous = input.id === undefined ? null : findSavedAnalysis(items, input.id, input.revision);
  if (!previous && items.length >= AI_SAVED_LIMIT) throw new WorkspaceError('resource-exhausted', `최대 ${AI_SAVED_LIMIT}개까지 저장할 수 있습니다. 기존 항목을 바꾸거나 정리해 주세요.`);
  const item: AiSavedAnalysis = { id: previous?.id || randomUUID(), revision: (previous?.revision || 0) + 1, name, period, plan,
    createdAt: previous?.createdAt || now.toISOString(), updatedAt: now.toISOString() };
  return [item, ...items.filter(row => row.id !== item.id)];
}
export function savedExecutionPlan(item: AiSavedAnalysis, now = new Date()): AiPlan {
  const plan = reusablePlan(item.plan), period = savedPeriod(item.period, plan);
  if (period === 'fixed') return plan;
  const koreaDate = new Date(now.getTime() + 9 * 3600000).toISOString().slice(0, 10);
  const range = aiMonthRange(koreaDate, period === 'lastMonth' ? -1 : 0);
  return validatePlan({ ...plan, range, comparison: plan.comparison ? aiMonthRange(range.startDate, -1) : null });
}
