import { httpsCallable } from 'firebase/functions';
import { auth } from '../../config/firebase';
import { workspaceClient, workspaceError } from './service';
jest.mock('firebase/functions', () => ({ httpsCallable: jest.fn() }));
jest.mock('../../config/firebase', () => ({ auth: { currentUser: { uid: 'synthetic-user' } }, functions: {} }));
jest.mock('../../services/aiSettingsService', () => ({ aiSettingsService: { assertCurrentPageEnabled: jest.fn() } }));
beforeEach(() => { Object.defineProperty(auth, 'currentUser', { value: { uid: 'synthetic-user' }, configurable: true }); });

test('calls the server endpoint without passing model credentials or receiving them', async () => {
  const invoke = jest.fn().mockResolvedValue({ data: { status: 'complete' } });
  (httpsCallable as jest.Mock).mockReturnValue(invoke);
  await workspaceClient.analyze({ question: '합성 자료 조회' });
  expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), 'aiWorkspace', { timeout: 125000 });
  expect(invoke).toHaveBeenCalledWith({ action: 'analyze', question: '합성 자료 조회' });
});
test('a response for a previous account is discarded', async () => {
  (httpsCallable as jest.Mock).mockReturnValue(async () => {
    Object.defineProperty(auth, 'currentUser', { value: { uid: 'changed-user' }, configurable: true });
    return { data: { private: true } };
  });
  await expect(workspaceClient.exportFile('result', 'xlsx')).rejects.toThrow();
});
test('errors show safe actionable text without raw provider responses', () => {
  expect(workspaceError({ code: 'functions/permission-denied', message: 'raw failure details' })).toContain('조회 권한');
  expect(workspaceError({ code: 'functions/resource-exhausted', message: '기간을 줄여 주세요.' })).toBe('기간을 줄여 주세요.');
  expect(workspaceError({ code: 'functions/internal', message: 'sensitive response' })).not.toContain('sensitive');
});
test('saved analysis operations send IDs and revisions through the authenticated server endpoint', async () => {
  const invoke = jest.fn().mockResolvedValue({ data: { items: [] } }); (httpsCallable as jest.Mock).mockReturnValue(invoke);
  await workspaceClient.listSaved();
  await workspaceClient.saveAnalysis({ resultId: 'result', name: '월간', period: 'lastMonth' });
  await workspaceClient.runSaved('saved', 2); await workspaceClient.deleteSaved('saved', 2);
  expect(invoke.mock.calls).toEqual([[{ action: 'saved-list' }], [{ action: 'saved-save', resultId: 'result', name: '월간', period: 'lastMonth' }],
    [{ action: 'saved-run', id: 'saved', revision: 2 }], [{ action: 'saved-delete', id: 'saved', revision: 2 }]]);
});

test('natural saved follow-ups forward only a selection token through the authenticated endpoint', async () => {
  const invoke = jest.fn().mockResolvedValue({ data: { status: 'saved' } }); (httpsCallable as jest.Mock).mockReturnValue(invoke);
  await workspaceClient.analyze({ question: '그 분석 실행해줘', savedContextId: 'server-selection' });
  expect(invoke).toHaveBeenCalledWith({ action: 'analyze', question: '그 분석 실행해줘', savedContextId: 'server-selection' });
});

test('scheduled reports use an authenticated endpoint with revisions and server run IDs', async () => {
  const invoke = jest.fn().mockResolvedValue({ data: { schedules: [], runs: [] } }); (httpsCallable as jest.Mock).mockReturnValue(invoke);
  const cadence = { frequency: 'monthly' as const, time: '09:00', weekday: null, monthDay: 1 };
  await workspaceClient.reports.list();
  await workspaceClient.reports.save({ savedId: 'saved', savedRevision: 3, cadence });
  await workspaceClient.reports.pause('schedule', 2); await workspaceClient.reports.delete('schedule', 3);
  await workspaceClient.reports.retry('run'); await workspaceClient.reports.exportFile('run', 'xlsx');
  expect(httpsCallable).toHaveBeenLastCalledWith(expect.anything(), 'aiWorkspaceReports', { timeout: 125000 });
  expect(invoke.mock.calls).toEqual([[{ action: 'list' }], [{ action: 'save', savedId: 'saved', savedRevision: 3, cadence }],
    [{ action: 'pause', id: 'schedule', revision: 2 }], [{ action: 'delete', id: 'schedule', revision: 3 }], [{ action: 'retry', runId: 'run' }], [{ action: 'export', runId: 'run', format: 'xlsx' }]]);
});
