import { httpsCallable } from 'firebase/functions';
import { auth, functions } from '../../config/firebase';
import { aiSettingsService } from '../../services/aiSettingsService';
import { AiPlan, AiResponse, AiSavedAnalysis, AiSaveAnalysisInput, AiReportOverview, AiReportScheduleInput } from './contract';

export type WorkspaceQuery = { question: string; previousId?: string; plan?: AiPlan; contextPlan?: AiPlan; savedContextId?: string };
export type WorkspaceFile = { fileName: string; contentType: string; base64: string };
export interface WorkspaceReportClient {
  list(): Promise<AiReportOverview>;
  save(input: AiReportScheduleInput): Promise<AiReportOverview>;
  pause(id: string, revision: number): Promise<AiReportOverview>;
  delete(id: string, revision: number): Promise<AiReportOverview>;
  retry(runId: string): Promise<AiReportOverview>;
  exportFile(runId: string, format: 'pdf' | 'xlsx'): Promise<WorkspaceFile>;
}
export interface WorkspaceClient {
  reports: WorkspaceReportClient;
  analyze(input: WorkspaceQuery): Promise<AiResponse>;
  exportFile(resultId: string, format: 'pdf' | 'xlsx'): Promise<WorkspaceFile>;
  listSaved(): Promise<{ items: AiSavedAnalysis[] }>;
  saveAnalysis(input: AiSaveAnalysisInput): Promise<{ items: AiSavedAnalysis[] }>;
  deleteSaved(id: string, revision: number): Promise<{ items: AiSavedAnalysis[] }>;
  runSaved(id: string, revision: number): Promise<AiResponse>;
}
export const workspaceError = (error: unknown): string => {
  const { code = '', message = '' } = (error || {}) as { code?: string; message?: string };
  const key = code.replace('functions/', '');
  if (['invalid-argument', 'failed-precondition', 'resource-exhausted', 'already-exists'].includes(key) && /[가-힣]/.test(message) && message.length < 500) return message;
  const messages: Record<string, string> = {
    unauthenticated: '로그인 시간이 만료되었습니다. 다시 로그인해 주세요.',
    'permission-denied': '조회 권한을 확인해 주세요. 첫 버전은 활성 관리자와 작업자가 연결된 팀장 계정을 지원합니다.',
    'not-found': 'AI 업무 도우미 서버가 아직 준비되지 않았습니다. 관리자에게 서버 배포를 요청해 주세요.',
    'deadline-exceeded': '응답이 지연되고 있습니다. 잠시 후 다시 시도해 주세요.',
  };
  return messages[key] || '요청을 완료하지 못했습니다. 서버 연결과 AI 설정을 확인해 주세요.';
};
const call = async <T>(input: object, endpoint = 'aiWorkspace'): Promise<T> => {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('로그인이 필요합니다.');
  aiSettingsService.assertCurrentPageEnabled('AI 업무 도우미');
  try {
    const response = await httpsCallable<object, T>(functions, endpoint, { timeout: 125000 })(input);
    if (auth.currentUser?.uid !== uid) throw new Error('로그인 계정이 변경되었습니다. 다시 조회해 주세요.');
    return response.data;
  } catch (error) { throw new Error(workspaceError(error)); }
};
export const workspaceClient: WorkspaceClient = {
  reports: {
    list: () => call({ action: 'list' }, 'aiWorkspaceReports'),
    save: input => call({ action: 'save', ...input }, 'aiWorkspaceReports'),
    pause: (id, revision) => call({ action: 'pause', id, revision }, 'aiWorkspaceReports'),
    delete: (id, revision) => call({ action: 'delete', id, revision }, 'aiWorkspaceReports'),
    retry: runId => call({ action: 'retry', runId }, 'aiWorkspaceReports'),
    exportFile: (runId, format) => call({ action: 'export', runId, format }, 'aiWorkspaceReports'),
  },
  analyze: input => call<AiResponse>({ action: 'analyze', ...input }),
  exportFile: (resultId, format) => call<WorkspaceFile>({ action: 'export', resultId, format }),
  listSaved: () => call({ action: 'saved-list' }),
  saveAnalysis: input => call({ action: 'saved-save', ...input }),
  deleteSaved: (id, revision) => call({ action: 'saved-delete', id, revision }),
  runSaved: (id, revision) => call({ action: 'saved-run', id, revision }),
};
