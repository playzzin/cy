import { httpsCallable } from 'firebase/functions';
import { auth } from '../config/firebase';
import { aiSettingsService } from './aiSettingsService';
import { requestDailyReportAnalytics } from './dailyReportAnalyticsClient';
jest.mock('firebase/functions', () => ({ httpsCallable: jest.fn() }));
jest.mock('../config/firebase', () => ({ auth: { currentUser: { uid: 'synthetic' } }, functions: {} }));
jest.mock('./aiSettingsService', () => ({ aiSettingsService: { assertCurrentPageEnabled: jest.fn(), getApiKey: jest.fn(() => { throw new Error('Browser key must not be read'); }) } }));
beforeEach(() => { jest.clearAllMocks(); Object.defineProperty(auth, 'currentUser', { value: { uid: 'synthetic' }, configurable: true }); });
test('uses authenticated server transport even if browser key is invalid and sends no credentials/model/prompt policy', async () => {
    const invoke = jest.fn().mockResolvedValue({ data: { text: '{}' } });
    (httpsCallable as jest.Mock).mockReturnValue(invoke);
    expect(await requestDailyReportAnalytics('parse', '합성 질문')).toBe('{}');
    expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), 'dailyReportAnalyticsAi', { timeout: 65000 });
    expect(invoke).toHaveBeenCalledWith({ task: 'parse', text: '합성 질문' });
    expect(invoke.mock.calls[0][0]).not.toHaveProperty('apiKey');
});
test('requires login and retains page switch enforcement', async () => {
    Object.defineProperty(auth, 'currentUser', { value: null, configurable: true });
    await expect(requestDailyReportAnalytics('parse', '질문')).rejects.toThrow('로그인');
    expect(httpsCallable).not.toHaveBeenCalled();
    (aiSettingsService.assertCurrentPageEnabled as jest.Mock).mockImplementationOnce(() => { throw new Error('AI 비활성화'); });
    await expect(requestDailyReportAnalytics('parse', '질문')).rejects.toThrow('비활성화');
});
test('discards results when the signed-in account changes', async () => {
    (httpsCallable as jest.Mock).mockReturnValue(async () => { Object.defineProperty(auth, 'currentUser', { value: { uid: 'changed' }, configurable: true }); return { data: { text: 'result' } }; });
    await expect(requestDailyReportAnalytics('insight', '합성 요약')).rejects.toThrow('계정이 변경');
});
test('shows safe server key guidance and hides unknown internal provider details', async () => {
    (httpsCallable as jest.Mock).mockReturnValue(jest.fn().mockRejectedValue({ code: 'functions/failed-precondition', message: '서버용 Gemini API 키를 확인해 주세요.' }));
    await expect(requestDailyReportAnalytics('parse', '질문')).rejects.toThrow('서버용 Gemini');
    (httpsCallable as jest.Mock).mockReturnValue(jest.fn().mockRejectedValue({ code: 'functions/internal', message: 'synthetic private provider details' }));
    await expect(requestDailyReportAnalytics('parse', '질문')).rejects.toThrow('서버 연결');
});
