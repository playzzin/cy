export async function requestGeminiContent(feature: string, body: unknown, signal?: AbortSignal): Promise<any> {
    const [{ httpsCallable }, { auth, functions }] = await Promise.all([import('firebase/functions'), import('../config/firebase')]);
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('AI 기능을 사용하려면 로그인해 주세요.');
    const aborted = () => { throw new DOMException('요청을 취소했습니다.', 'AbortError'); };
    if (signal?.aborted) return aborted();
    try {
        const request = httpsCallable(functions, 'geminiGateway', { timeout: 185000 });
        let onAbort: (() => void) | undefined;
        const pending = request({ feature, body });
        const result = await (signal ? Promise.race([pending, new Promise<never>((_resolve, reject) => {
            onAbort = () => reject(new DOMException('요청을 취소했습니다.', 'AbortError'));
            signal.addEventListener('abort', onAbort, { once: true });
            if (signal.aborted) onAbort();
        })]).finally(() => { if (onAbort) signal.removeEventListener('abort', onAbort); }) : pending);
        if (signal?.aborted) return aborted();
        if (auth.currentUser?.uid !== uid) throw new Error('로그인 계정이 변경되었습니다. 다시 요청해 주세요.');
        try { localStorage.removeItem('gemini_api_key'); localStorage.removeItem('geminiApiKey'); } catch { /* Browser storage may be unavailable. */ }
        return result.data;
    } catch (error) {
        if (signal?.aborted) return aborted();
        const code = (error as { code?: string }).code?.replace('functions/', '');
        if (code === 'not-found') throw new Error('AI 서버 업데이트가 필요합니다. 관리자에게 확인해 주세요.');
        if (code === 'unauthenticated' || code === 'permission-denied') throw new Error('현재 계정의 AI 사용 권한을 확인해 주세요.');
        if (code && ['failed-precondition', 'resource-exhausted', 'invalid-argument', 'deadline-exceeded', 'unavailable'].includes(code)) {
            throw new Error(code === 'failed-precondition' ? '서버 AI 설정을 확인해 주세요.' : 'AI 요청을 처리하지 못했습니다. 파일 크기와 사용 한도를 확인하고 다시 시도해 주세요.');
        }
        throw new Error('AI 서버 연결을 확인해 주세요.');
    }
}
