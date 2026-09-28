import { observeGeminiFetch } from '../utils/geminiUsage';

export const trackedGeminiFetch = (feature: string, request: (...args: any[]) => Promise<any> = fetch) =>
  observeGeminiFetch(feature, request, async event => {
    try {
      const { geminiUsageLogService } = await import('./geminiUsageLogService');
      await geminiUsageLogService.record(event);
    } catch { console.warn('[GeminiUsage] 사용량 기록을 저장하지 못했습니다.'); }
  });
