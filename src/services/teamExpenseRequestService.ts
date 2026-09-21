import type { DraftPage } from '../components/TeamRequestDraftMaintenance';
import { httpsCallable } from 'firebase/functions';
import { auth, functions } from '../config/firebase';
import { isDevAdminSessionEnabled } from '../utils/devAdminSession';
import type { TeamExpenseClaimAttachment } from '../types/teamExpenseLedger';
import type { ExpenseReceiptAnalysis, SubmitTeamExpenseRequest, TeamExpenseRequestData } from '../types/teamExpenseRequest';

const call = async <T>(input: Record<string, unknown>): Promise<T> => {
  if (isDevAdminSessionEnabled()) throw new Error('개발용 샘플 계정에서는 실제 경비를 조회하거나 등록할 수 없습니다. 프로필에서 실제 팀장 또는 사무실 계정으로 로그인해 주세요.');
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('로그인이 필요합니다.');
  const result = await httpsCallable<Record<string, unknown>, T>(functions, 'teamExpenseRequests', { timeout: 120_000 })(input);
  if (auth.currentUser?.uid !== uid) throw new Error('로그인 계정이 변경되었습니다. 다시 조회해 주세요.');
  return result.data;
};

export const validateRequestReceiptFiles = (files: File[]) => {
  if (files.length < 1 || files.length > 5) throw new Error('영수증을 1~5개 첨부해 주세요.');
  if (files.some(file => !['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type))) throw new Error('JPG, PNG, WEBP 이미지 또는 PDF만 첨부할 수 있습니다.');
  if (files.some(file => !file.size || file.size > 5 * 1024 * 1024)) throw new Error('영수증은 파일당 5MB 이하로 올려 주세요.');
};

const toBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result).split(',')[1]);
  reader.onerror = () => reject(new Error('영수증 파일을 읽지 못했습니다.'));
  reader.readAsDataURL(file);
});

export const teamExpenseRequestService = {
  receipt: async (fullPath: string) => {
    const parts = fullPath.split('/');
    if (parts.length !== 4 || parts[0] !== 'team-expense-receipts') throw new Error('영수증 경로를 확인해 주세요.');
    const result = await call<{ name: string; contentType: string; base64: string }>({ action: 'receipt', id: parts[2], receiptId: parts[3] });
    return new File([Uint8Array.from(atob(result.base64), char => char.charCodeAt(0))], result.name, { type: result.contentType });
  },
  listDrafts: (cursor?: string) => call<DraftPage>({ action: 'drafts', ...(cursor ? { cursor } : {}) }),
  discardDraft: (id: string) => call({ action: 'discardDraft', id }),
  analyze: async (teamId: string, file: File) => {
    const uid = auth.currentUser?.uid;
    validateRequestReceiptFiles([file]);
    const base64 = await toBase64(file);
    if (!uid || auth.currentUser?.uid !== uid) throw new Error('로그인 계정이 변경되었습니다. 다시 조회해 주세요.');
    return call<ExpenseReceiptAnalysis>({ action: 'analyze', teamId, contentType: file.type, base64 });
  },
  list: (yearMonth: string, cursor?: string) => call<TeamExpenseRequestData>({ action: 'list', yearMonth, includeBillingTeams: true, ...(cursor ? { cursor } : {}) }),
  upload: async (requestId: string, teamId: string, receiptId: string, file: File) => {
    const uid = auth.currentUser?.uid;
    validateRequestReceiptFiles([file]);
    const base64 = await toBase64(file);
    if (!uid || auth.currentUser?.uid !== uid) throw new Error('로그인 계정이 변경되었습니다. 다시 조회해 주세요.');
    return call<{ receipt: TeamExpenseClaimAttachment }>({ action: 'upload', requestId, teamId, receiptId, name: file.name, contentType: file.type, base64 });
  },
  submit: (input: SubmitTeamExpenseRequest) => call<{ id: string; status: string }>({ action: 'submit', ...input }),
  review: (id: string, decision: 'approved' | 'rejected', reason: string) => call({ action: 'review', id, decision, reason }),
};
