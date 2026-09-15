import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../../config/firebase';

export type ReminderRepeat = 'none' | 'daily' | 'weekdays' | 'weekly' | 'monthly';
export const reminderRepeatLabels: Record<ReminderRepeat, string> = {
    none: '반복 없음', daily: '매일', weekdays: '평일마다', weekly: '매주', monthly: '매월'
};
export type MemoReminder = {
    id: string;
    memoId: string;
    remindAt: number;
    repeat: ReminderRepeat;
    status: 'scheduled' | 'sent' | 'cancelled' | 'unavailable';
};

export const reminderDateInput = (time: number) => new Date(time + 9 * 3600000).toISOString().slice(0, 16);
export const parseReminderDateInput = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return NaN;
    const time = Date.parse(`${value}:00+09:00`);
    return Number.isFinite(time) && reminderDateInput(time) === value ? time : NaN;
};
export const formatReminderTime = (time: number) => new Date(time).toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
});

export const memoReminderService = {
    subscribe(uid: string, next: (reminders: MemoReminder[]) => void, error: () => void) {
        return onSnapshot(query(collection(db, 'smart_memo_reminders'), where('userId', '==', uid)), snapshot => {
            next(snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id, memoId: String(data.memoId || ''), remindAt: data.remindAt?.toMillis?.() || 0,
                    repeat: data.repeat in reminderRepeatLabels ? data.repeat : 'none', status: data.status
                } as MemoReminder;
            }).filter(reminder => ['scheduled', 'sent'].includes(reminder.status)));
        }, error);
    },
    async save(memoId: string, remindAt: number | null, repeat: ReminderRepeat = 'none') {
        const callable = httpsCallable(functions, 'setSmartMemoReminder');
        await callable({ memoId, remindAt, repeat });
    }
};
