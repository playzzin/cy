import type { DraftPage } from '../components/TeamRequestDraftMaintenance';
import { httpsCallable } from 'firebase/functions';
import { auth, functions } from '../config/firebase';
import { isDevAdminSessionEnabled } from '../utils/devAdminSession';
import { invalidateWorkerCache } from '../utils/workerCacheRevision';
import type { TeamWorkerRequestData, WorkerDocumentAnalysis, WorkerDocumentKind, WorkerRegistrationFields } from '../types/teamWorkerRequest';

const call = async <T>(input: Record<string, unknown>): Promise<T> => {
  if (isDevAdminSessionEnabled()) throw new Error('개발용 샘플 계정에서는 실제 신규자를 조회하거나 등록할 수 없습니다. 프로필에서 실제 팀장 또는 사무실 계정으로 로그인해 주세요.');
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('로그인이 필요합니다.');
  const result = await httpsCallable<Record<string, unknown>, T>(functions, 'teamWorkerRequests', { timeout: 120_000 })(input);
  if (auth.currentUser?.uid !== uid) throw new Error('로그인 계정이 변경되었습니다. 다시 조회해 주세요.');
  return result.data;
};
export const validateWorkerDocument = (file: File) => {
  if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type) || !file.size || file.size > 5 * 1024 * 1024) throw new Error('JPG·PNG·WEBP·PDF 파일을 5MB 이하로 첨부해 주세요.');
};
const encode = async (file: File): Promise<string> => {
  validateWorkerDocument(file);
  const uid = auth.currentUser?.uid;
  const encoded = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = () => reject(new Error('서류를 읽지 못했습니다.')); reader.readAsDataURL(file); });
  if (!uid || auth.currentUser?.uid !== uid) throw new Error('로그인 계정이 변경되었습니다.');
  return encoded;
};
export const teamWorkerRequestService = {
  listDrafts: (cursor?: string) => call<DraftPage>({ action: 'drafts', ...(cursor ? { cursor } : {}) }),
  discardDraft: (id: string) => call({ action: 'discardDraft', id }),
  list: (yearMonth: string, cursor?: string) => call<TeamWorkerRequestData>({ action: 'list', yearMonth, ...(cursor ? { cursor } : {}) }),
  analyze: async (teamId: string, kind: WorkerDocumentKind, file: File) => call<WorkerDocumentAnalysis>({ action: 'analyze', teamId, kind, contentType: file.type, base64: await encode(file) }),
  upload: async (requestId: string, teamId: string, kind: WorkerDocumentKind, fileId: string, file: File) => call({ action: 'upload', requestId, teamId, kind, fileId, name: file.name, contentType: file.type, base64: await encode(file) }),
  submit: (requestId: string, teamId: string, fields: WorkerRegistrationFields, identityId: string, bankId?: string) => call<{ id: string; status: string }>({ action: 'submit', requestId, teamId, fields, identityId, bankId: bankId || '' }),
  review: async (id: string, decision: 'approved' | 'rejected', reason: string, payroll?: { payType: string; unitPrice: number }) => {
    const result = await call({ action: 'review', id, decision, reason, ...(payroll ? { payroll } : {}) });
    if (decision === 'approved') invalidateWorkerCache();
    return result;
  },
  document: async (id: string, fileId: string) => {
    const result = await call<{ name: string; contentType: string; base64: string }>({ action: 'document', id, fileId });
    const bytes = Uint8Array.from(atob(result.base64), character => character.charCodeAt(0));
    return new File([bytes], result.name, { type: result.contentType });
  },
};
