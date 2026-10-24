import { httpsCallable } from 'firebase/functions';
import { auth, functions } from '../config/firebase';
import { createDevAdminUser, isDevAdminSessionEnabled } from '../utils/devAdminSession';
import { estimateGeminiCost, GeminiUsageEvent, GeminiUsageLog } from '../utils/geminiUsage';

export type UsageCursor = { id: string; seconds: number; nanoseconds: number };
export type UsagePage = { logs: GeminiUsageLog[]; nextCursor: UsageCursor | null };
const DEV_KEY = 'cy_dev_gemini_usage_v1';
export const GEMINI_USAGE_CHANGED = 'cy:gemini-usage-changed';
const readLocal = (): GeminiUsageLog[] => JSON.parse(localStorage.getItem(DEV_KEY) || '[]');
export const geminiUsageLogService = {
  async record(event: GeminiUsageEvent) {
    const requestId = crypto.randomUUID();
    if (isDevAdminSessionEnabled()) {
      const actor = createDevAdminUser(), now = new Date();
      const log: GeminiUsageLog = { ...event, ...estimateGeminiCost(event.model, event.usage, event.mode, now), id: requestId,
        createdAt: now.toISOString(), actorUid: actor?.uid || '', actorName: actor?.displayName || '개발용 계정', source: 'development', path: window.location.pathname };
      localStorage.setItem(DEV_KEY, JSON.stringify([log, ...readLocal()].slice(0, 2000)));
      window.dispatchEvent(new Event(GEMINI_USAGE_CHANGED));
      return;
    }
    if (!auth.currentUser) return;
    const record = httpsCallable(functions, 'recordGeminiClientUsage', { timeout: 10000 });
    await record({ ...event, requestId, path: window.location.pathname });
  },
  async list(startDate: string, endDate: string, cursor?: UsageCursor | null): Promise<UsagePage> {
    if (isDevAdminSessionEnabled()) {
      const start = Date.parse(`${startDate}T00:00:00+09:00`), end = Date.parse(`${endDate}T00:00:00+09:00`) + 86400000;
      return { logs: readLocal().filter(log => Date.parse(log.createdAt) >= start && Date.parse(log.createdAt) < end).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), nextCursor: null };
    }
    const result = await httpsCallable<unknown, UsagePage>(functions, 'listGeminiUsageLogs')({ startDate, endDate, cursor: cursor || null });
    return result.data;
  },
};
