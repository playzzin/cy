import { httpsCallable } from 'firebase/functions';
import { auth, functions } from '../config/firebase';
import { aiSettingsService } from './aiSettingsService';

export async function requestDailyReportAnalytics(task: 'parse' | 'insight', text: string): Promise<string> {
    aiSettingsService.assertCurrentPageEnabled('AI 통계 분석');
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('로그인이 필요합니다.');
    try {
        const request = httpsCallable<{ task: 'parse' | 'insight'; text: string }, { text: string }>(functions, 'dailyReportAnalyticsAi', { timeout: 65000 });
        const result = await request({ task, text });
        if (auth.currentUser?.uid !== uid) throw new Error('로그인 계정이 변경되었습니다. 다시 분석해 주세요.');
        if (typeof result.data?.text !== 'string' || !result.data.text.trim()) throw new Error('AI 분석 응답을 확인하지 못했습니다. 다시 시도해 주세요.');
        return result.data.text;
    } catch (error) {
        const failure = error as { code?: string; message?: string };
        const code = failure.code?.replace('functions/', '');
        if (['failed-precondition', 'resource-exhausted', 'invalid-argument', 'deadline-exceeded', 'unavailable'].includes(code || '')
            && /[가-힣]/.test(failure.message || '') && (failure.message?.length || 0) < 500) throw new Error(failure.message);
        if (code === 'unauthenticated') throw new Error('로그인 시간이 만료되었습니다. 다시 로그인해 주세요.');
        if (code === 'permission-denied') throw new Error('현재 계정의 통계 분석 권한을 확인해 주세요.');
        if (code === 'not-found') throw new Error('통계 AI 서버가 준비되지 않았습니다. 관리자에게 확인해 주세요.');
        if (!code && error instanceof Error && /로그인 계정이 변경|AI 분석 응답을 확인/.test(error.message)) throw error;
        throw new Error('AI 통계 분석 서버 연결을 확인해 주세요.');
    }
}
