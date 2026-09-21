import { httpsCallable } from 'firebase/functions';
import { isDevAdminSessionEnabled } from '../utils/devAdminSession';
import { teamExpenseRequestService } from './teamExpenseRequestService';

jest.mock('../config/firebase', () => ({ auth: { currentUser: { uid: 'office' } }, functions: {} }));
jest.mock('firebase/functions', () => ({ httpsCallable: jest.fn() }));
jest.mock('../utils/devAdminSession', () => ({ isDevAdminSessionEnabled: jest.fn() }));

beforeEach(() => jest.resetAllMocks());

test('sample mode never invokes a real expense endpoint even if an auth session remains', async () => {
  (isDevAdminSessionEnabled as jest.Mock).mockReturnValue(true);
  await expect(teamExpenseRequestService.list('2026-09')).rejects.toThrow('개발용 샘플 계정');
  await expect(teamExpenseRequestService.review('request-a', 'approved', '')).rejects.toThrow('실제 팀장 또는 사무실 계정');
  expect(httpsCallable).not.toHaveBeenCalled();
});

test('authenticated list keeps the selected month and billing directory request', async () => {
  const invoke = jest.fn().mockResolvedValue({ data: { requests: [] } });
  (httpsCallable as jest.Mock).mockReturnValue(invoke);
  await expect(teamExpenseRequestService.list('2026-09')).resolves.toEqual({ requests: [] });
  expect(invoke).toHaveBeenCalledWith({ action: 'list', yearMonth: '2026-09', includeBillingTeams: true });
});
