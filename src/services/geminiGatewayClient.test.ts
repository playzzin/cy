import { httpsCallable } from 'firebase/functions';
import { auth } from '../config/firebase';
import { requestGeminiContent } from './geminiGatewayClient';
jest.mock('firebase/functions', () => ({ httpsCallable: jest.fn() }));
jest.mock('../config/firebase', () => ({ auth: { currentUser: { uid: 'synthetic' } }, functions: {} }));
beforeEach(() => {
    jest.clearAllMocks(); localStorage.clear();
    Object.defineProperty(auth, 'currentUser', { configurable: true, value: { uid: 'synthetic' } });
});
test('sends only feature/body and removes legacy browser keys after server success', async () => {
    localStorage.setItem('gemini_api_key', 'synthetic-old-key');
    localStorage.setItem('geminiApiKey', 'synthetic-old-key');
    const invoke = jest.fn().mockResolvedValue({ data: { candidates: [] } });
    (httpsCallable as jest.Mock).mockReturnValue(invoke);
    expect(await requestGeminiContent('document-analysis', { contents: [] })).toEqual({ candidates: [] });
    expect(invoke).toHaveBeenCalledWith({ feature: 'document-analysis', body: { contents: [] } });
    expect(localStorage.getItem('gemini_api_key')).toBeNull();
    expect(localStorage.getItem('geminiApiKey')).toBeNull();
});
test('requires a session and never falls back to browser keys on server failure', async () => {
    (httpsCallable as jest.Mock).mockReturnValue(jest.fn().mockRejectedValue({ code: 'functions/not-found', message: 'private detail' }));
    await expect(requestGeminiContent('document-analysis', {})).rejects.toThrow('업데이트');
    Object.defineProperty(auth, 'currentUser', { configurable: true, value: null });
    await expect(requestGeminiContent('document-analysis', {})).rejects.toThrow('로그인');
});
test('cancellation returns promptly while the bounded server request finishes independently', async () => {
    const controller = new AbortController();
    (httpsCallable as jest.Mock).mockReturnValue(jest.fn(() => { controller.abort(); return new Promise(() => {}); }));
    await expect(requestGeminiContent('document-analysis', {}, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
});
