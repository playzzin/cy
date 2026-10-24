import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { userService, type UserData } from '../services/userService';
import { isMessageReadOnlyProfile } from '../utils/messageAccess';

export function useMessageAccess() {
    const { currentUser } = useAuth();
    const uid = currentUser?.uid;
    const [result, setResult] = useState<{ uid: string; profile: UserData | null; error: boolean } | null>(null);
    useEffect(() => {
        if (!uid) return;
        let active = true;
        userService.getUser(uid).then(profile => {
            if (active) setResult({ uid, profile, error: !profile });
        }).catch(() => { if (active) setResult({ uid, profile: null, error: true }); });
        return () => { active = false; };
    }, [uid]);
    const current = result?.uid === uid ? result : null;
    const profile = current?.profile || null;
    return {
        profile,
        loading: Boolean(uid && !current),
        error: Boolean(current?.error),
        canSend: Boolean(profile && (!profile.status || profile.status === 'active') && !isMessageReadOnlyProfile(profile)),
    };
}
