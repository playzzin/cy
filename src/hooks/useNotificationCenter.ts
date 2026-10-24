import { useEffect, useState } from 'react';
import { notificationCenterService } from '../services/notificationCenterService';
import type { NotificationPreferences, NotificationUserState } from '../types/notificationCenter';
import { defaultNotificationPreferences } from '../utils/notificationCenter';

export function useNotificationCenter(uid?: string | null) {
    const [revision, setRevision] = useState(0);
    const [data, setData] = useState<{ owner?: string | null; preferences: NotificationPreferences; states: Record<string, NotificationUserState>; error: Error | null; loaded: number }>({
        owner: uid, preferences: defaultNotificationPreferences, states: {}, error: null, loaded: 0,
    });
    const [now, setNow] = useState(Date.now);
    useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), 30000);
        return () => window.clearInterval(timer);
    }, []);
    useEffect(() => {
        let active = true;
        setData({ owner: uid, preferences: defaultNotificationPreferences, states: {}, error: null, loaded: 0 });
        if (!uid) return;
        const failed = (error: Error) => { if (active) setData(d => ({ ...d, error })); };
        const a = notificationCenterService.subscribePreferences(uid, preferences => {
            if (active) setData(d => ({ ...d, preferences, loaded: d.loaded | 1 }));
        }, failed);
        const b = notificationCenterService.subscribeStates(uid, states => {
            if (active) setData(d => ({ ...d, states, loaded: d.loaded | 2 }));
        }, failed);
        return () => { active = false; a(); b(); };
    }, [uid, revision]);
    const current = data.owner === uid ? data : { preferences: defaultNotificationPreferences, states: {}, error: null, loaded: 0 };
    return { ...current, now, loading: !!uid && current.loaded !== 3, retry: () => setRevision(v => v + 1) };
}
