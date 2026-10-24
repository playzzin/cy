import { AiPlan, AiSavedAnalysis } from './contract';
import { WorkspaceError } from './domain';
import { findSavedAnalysis } from './savedAnalyses';

export const isSavedCommand = (plan: AiPlan) => plan.operation === 'savedFind' || plan.operation === 'savedRun';
const normalize = (value: string) => value.normalize('NFKC').replace(/\s+/g, '').toLocaleLowerCase('ko-KR');
export type SavedSelection = { id: string; accessHash: string; expiresAt: string; refs: Array<{ id: string; revision: number }> };

// Names are matched on the server, never by sending the saved catalog to Gemini.
export function resolveSavedCommand(items: AiSavedAnalysis[], plan: AiPlan, selection?: unknown, contextId?: unknown, accessHash?: string, now = Date.now()) {
  if (!isSavedCommand(plan) || !plan.saved) throw new WorkspaceError('invalid-argument', '저장한 분석 요청을 확인해 주세요.');
  let matches: AiSavedAnalysis[], exact = false;
  if (plan.saved.usePrevious) {
    const value = selection as SavedSelection | undefined;
    if (!value || typeof contextId !== 'string' || !contextId || !accessHash || value.id !== contextId || value.accessHash !== accessHash
      || !Number.isFinite(Date.parse(value.expiresAt)) || Date.parse(value.expiresAt) <= now || !Array.isArray(value.refs) || value.refs.length > 20
      || !value.refs.every(ref => ref && typeof ref.id === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(ref.id) && Number.isSafeInteger(ref.revision) && ref.revision >= 1)
      || new Set(value.refs.map(ref => ref.id)).size !== value.refs.length)
      throw new WorkspaceError('failed-precondition', '이전 저장 목록 선택이 만료되었거나 변경되었습니다. 저장한 분석을 다시 찾아 주세요.');
    matches = value.refs.map(ref => findSavedAnalysis(items, ref.id, ref.revision));
    exact = matches.length === 1;
  } else {
    const query = normalize(plan.saved.query);
    const exactMatches = query ? items.filter(item => normalize(item.name) === query) : [];
    exact = exactMatches.length === 1;
    matches = exactMatches.length ? exactMatches : items.filter(item => !query || normalize(item.name).includes(query));
  }
  const run = plan.operation === 'savedRun' && exact ? matches[0] : null;
  const message = !matches.length ? '조건에 맞는 저장한 분석이 없습니다. 이름을 바꾸거나 저장 목록 전체를 요청해 주세요.'
    : plan.operation === 'savedRun' ? `실행할 저장한 분석을 선택해 주세요. 후보 ${matches.length}개를 찾았습니다.`
      : `저장한 분석 ${matches.length}개를 찾았습니다. 저장된 조건을 표시하며, 실행하면 최신 자료를 조회합니다.`;
  return { matches, run, message };
}
