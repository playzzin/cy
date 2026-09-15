import { useEffect, useState } from 'react';
import { MemoReminder, memoReminderService } from '../services/memoReminderService';

export function useMemoReminders(uid?: string | null) {
    const [state, setState] = useState<{ uid: string; reminders: MemoReminder[]; error: boolean }>({ uid: '', reminders: [], error: false });
    useEffect(() => {
        setState({ uid: '', reminders: [], error: false });
        if (!uid || uid === 'dev-admin') return;
        let active = true;
        const unsubscribe = memoReminderService.subscribe(uid, reminders => {
            if (active) setState({ uid, reminders, error: false });
        }, () => {
            if (active) setState({ uid, reminders: [], error: true });
        });
        return () => { active = false; unsubscribe(); };
    }, [uid]);
    return state.uid === uid ? state : { uid: '', reminders: [], error: false };
}
