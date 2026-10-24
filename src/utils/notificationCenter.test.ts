import { Timestamp } from 'firebase/firestore';
import { defaultNotificationPreferences, isQuietTime, isDeferred, isDueToday, notificationTimeInput, parseNotificationTime, needsConfirmation } from './notificationCenter';
import type { ErpMessage } from '../types/erpMessage';
it('handles quiet hours across midnight in Korean time, including exact boundaries', () => {
    const prefs = { ...defaultNotificationPreferences, quietEnabled: true };
    expect(isQuietTime(prefs, Date.parse('2026-09-28T21:59:00+09:00'))).toBe(false);
    expect(isQuietTime(prefs, Date.parse('2026-09-28T22:00:00+09:00'))).toBe(true);
    expect(isQuietTime(prefs, Date.parse('2026-09-29T07:59:00+09:00'))).toBe(true);
    expect(isQuietTime(prefs, Date.parse('2026-09-29T08:00:00+09:00'))).toBe(false);
    expect(isQuietTime({ ...prefs, quietStart: '08:00', quietEnd: '08:00' }, Date.now())).toBe(true);
});
it('parses local reminder times independent of the device timezone and rejects invalid dates', () => {
    const time = Date.parse('2026-10-01T09:15:00+09:00');
    expect(notificationTimeInput(time)).toBe('2026-10-01T09:15');
    expect(parseNotificationTime('2026-10-01T09:15')).toBe(time);
    expect(parseNotificationTime('2026-02-30T09:15')).toBeNaN();
    expect(parseNotificationTime('')).toBeNaN();
});
it('keeps read and confirmed distinct and releases a snooze exactly at its deadline', () => {
    const now = Date.now(), message = { requiresConfirmation: true, readBy: ['viewer'], dueAt: Timestamp.fromMillis(now) } as ErpMessage;
    expect(needsConfirmation(message)).toBe(true);
    expect(needsConfirmation(message, { userId: 'viewer', messageId: 'a', confirmedAt: Timestamp.fromMillis(now) })).toBe(false);
    expect(isDeferred({ userId: 'viewer', messageId: 'a', snoozedUntil: Timestamp.fromMillis(now) }, now)).toBe(false);
    expect(isDueToday(message, now)).toBe(true);
});
