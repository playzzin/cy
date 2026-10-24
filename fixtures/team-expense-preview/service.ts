import type { SubmitTeamExpenseRequest, TeamExpenseRequest, TeamExpenseRequestData } from '../../src/types/teamExpenseRequest';
import { fixtureUser } from './auth';

const options = new URLSearchParams(window.location.search);
const wait = (ms: number) => new Promise(resolve => window.setTimeout(resolve, ms));
const date = new Date().toLocaleDateString('sv-SE');
const payer = { id: 'payer', name: '가상 시공팀', color: '#2563eb', icon: 'fa-users' };
const teams = [payer, { id: 'billing', name: '가상 지원팀', color: '#059669', icon: 'fa-users' }];
const categories = [{ id: 'meal', label: '식대' }, { id: 'fuel', label: '유류비' }, { id: 'transport', label: '교통비' }];
const files = new Map<string, File>();
const uploaded = new Map<string, Set<string>>();
const metrics = { listCalls: 0, uploadCalls: 0, submitCalls: 0, analysisCalls: 0, activeUploads: 0, maxConcurrentUploads: 0, events: [] as { action: string; at: number; detail?: string }[] };
(window as any).__expenseFixture = metrics;
const event = (action: string, detail?: string) => metrics.events.push({ action, at: performance.now(), detail });
let requests: TeamExpenseRequest[] = [{
  id: 'existing-request', ownerUid: fixtureUser.uid, submitterName: fixtureUser.displayName,
  teamId: payer.id, teamName: payer.name, teamColor: payer.color, chargeToTeamId: 'billing', chargeToTeamName: teams[1].name, chargeToTeamColor: teams[1].color,
  date, yearMonth: date.slice(0, 7), category: 'meal', categoryLabel: '식대', description: '가상 현장 점심 식대', amount: 25000,
  paymentMethod: '현찰', memo: '', attachments: [], status: 'pending', createdAt: `${date}T09:00:00.000Z`,
}];

export const validateRequestReceiptFiles = (receipts: File[]) => {
  if (receipts.length < 1 || receipts.length > 5) throw new Error('영수증을 1~5개 첨부해 주세요.');
  if (receipts.some(file => !['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type))) throw new Error('JPG, PNG, WEBP 이미지 또는 PDF만 첨부할 수 있습니다.');
  if (receipts.some(file => !file.size || file.size > 5 * 1024 * 1024)) throw new Error('영수증은 파일당 5MB 이하로 올려 주세요.');
};

export const teamExpenseRequestService = {
  list: async (yearMonth: string): Promise<TeamExpenseRequestData> => {
    metrics.listCalls++; event('list:start');
    await wait(metrics.listCalls === 1 ? 500 : 3000);
    if (options.has('reloadFail') && metrics.listCalls > 1) { event('list:fail'); throw new Error('가상 조회 오류: 다시 조회해 주세요.'); }
    event('list:end');
    return { canReview: options.has('review'), teams, payerTeams: [payer], paymentCards: [{ id: 'fixture-card', label: '가상 현장 경비 · 테스트카드 · •••• 1234', teamId: payer.id }], categories, requests: requests.filter(row => row.yearMonth === yearMonth), nextCursor: null };
  },
  upload: async (requestId: string, teamId: string, receiptId: string, file: File) => {
    validateRequestReceiptFiles([file]);
    metrics.uploadCalls++; metrics.activeUploads++;
    metrics.maxConcurrentUploads = Math.max(metrics.maxConcurrentUploads, metrics.activeUploads);
    event('upload:start', file.name);
    try {
      await wait(400);
      if (options.has('uploadFail') && file.name.includes('fail')) throw new Error('가상 업로드 실패');
      files.set(`${requestId}/${receiptId}`, file);
      if (!uploaded.has(requestId)) uploaded.set(requestId, new Set());
      uploaded.get(requestId)!.add(receiptId);
      event('upload:end', file.name);
      return { receipt: { id: receiptId, name: file.name, fullPath: `team-expense-receipts/${teamId}/${requestId}/${receiptId}`, size: file.size, contentType: file.type } };
    } finally { metrics.activeUploads--; }
  },
  submit: async (input: SubmitTeamExpenseRequest) => {
    metrics.submitCalls++; event('submit:start');
    await wait(300);
    if (options.has('submitFail')) throw new Error('가상 제출 실패');
    if (input.receiptIds.some(id => !uploaded.get(input.requestId)?.has(id))) throw new Error('가상 영수증 업로드가 끝나지 않았습니다.');
    const billing = teams.find(team => team.id === input.chargeToTeamId)!;
    const request: TeamExpenseRequest = {
      ...input, id: input.requestId, ownerUid: fixtureUser.uid, submitterName: fixtureUser.displayName,
      teamName: payer.name, teamColor: payer.color, chargeToTeamName: billing.name, chargeToTeamColor: billing.color,
      yearMonth: input.date.slice(0, 7), categoryLabel: categories.find(category => category.id === input.category)!.label,
      status: 'pending', createdAt: new Date().toISOString(),
      attachments: input.receiptIds.map(id => ({ id, name: files.get(`${input.requestId}/${id}`)!.name, fullPath: `team-expense-receipts/${input.teamId}/${input.requestId}/${id}` })),
    };
    requests = [request, ...requests.filter(row => row.id !== request.id)];
    event('submit:end');
    return { id: request.id, status: request.status };
  },
  analyze: async () => {
    metrics.analysisCalls++; event('analyze:start'); await wait(1500); event('analyze:end');
    return { date, amount: 18000, paymentMethod: '현찰', category: 'meal', isReceipt: true, warnings: ['가상 영수증 분석 결과입니다.'] };
  },
  receipt: async (fullPath: string) => {
    const [, , requestId, receiptId] = fullPath.split('/');
    const file = files.get(`${requestId}/${receiptId}`);
    if (!file) throw new Error('가상 영수증을 찾지 못했습니다.');
    return file;
  },
  review: async (id: string, decision: 'approved' | 'rejected', reason: string) => {
    await wait(300); requests = requests.map(row => row.id === id ? { ...row, status: decision, reviewReason: reason, reviewedAt: new Date().toISOString(), reviewerName: '가상 사무실' } : row);
  },
  listDrafts: async () => ({ retentionDays: 30, nextCursor: null, drafts: [] }),
  discardDraft: async () => {},
};
