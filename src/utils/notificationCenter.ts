import type { ErpMessage } from '../types/erpMessage';
import type { NotificationPreferences, NotificationSource, NotificationUserState } from '../types/notificationCenter';
import { noticeIdFromMessage } from './messageNavigation';

export const defaultNotificationPreferences: NotificationPreferences = {
    sound: true, sources: { notice: true, memo: true, task: true, message: true },
    quietEnabled: false, quietStart: '22:00', quietEnd: '08:00', digestMinutes: 0,
};
export const notificationSourceLabels: Record<NotificationSource, string> = { notice: '공지', memo: '메모', task: '할일', message: '업무·시스템' };
export const notificationSource = (m: ErpMessage): NotificationSource => noticeIdFromMessage(m) ? 'notice'
    : m.senderId === 'system:smart-memo-reminder' ? 'memo' : m.senderId === 'system:task-notification' ? 'task' : 'message';
export const notificationEnabled = (message: ErpMessage, prefs: NotificationPreferences) => !!message.requiresConfirmation || prefs.sources[notificationSource(message)] !== false;
export const isDeferred = (state: NotificationUserState | undefined, now: number) => (state?.snoozedUntil?.toMillis() || 0) > now;
export const needsConfirmation = (message: ErpMessage, state?: NotificationUserState) => !!message.requiresConfirmation && !state?.confirmedAt;
export const koreanDay = (time: number) => new Date(time + 9 * 3600000).toISOString().slice(0, 10);
export const isDueToday = (message: ErpMessage, now: number) => !!message.dueAt && koreanDay(message.dueAt.toMillis()) === koreanDay(now);
export const notificationTimeInput = (time: number) => new Date(time + 9 * 3600000).toISOString().slice(0, 16);
export const parseNotificationTime = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return NaN;
    const time = new Date(value + ':00+09:00').getTime();
    return Number.isFinite(time) && notificationTimeInput(time) === value ? time : NaN;
};
export const formatNotificationTime = (time: number) => new Intl.DateTimeFormat('ko-KR', {
    month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Seoul',
}).format(time);
export function isQuietTime(prefs: NotificationPreferences, now: number) {
    if (!prefs.quietEnabled) return false;
    const clock = notificationTimeInput(now).slice(11), start = prefs.quietStart, end = prefs.quietEnd;
    if (start === end) return true;
    return start < end ? clock >= start && clock < end : clock >= start || clock < end;
}
