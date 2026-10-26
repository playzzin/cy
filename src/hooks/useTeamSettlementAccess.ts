import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { userService, type UserData } from '../services/userService';
import { canWriteTeamSettlement } from '../utils/teamSettlementAccess';

export function useTeamSettlementAccess() {
  const { currentUser } = useAuth();
  const uid = currentUser?.uid;
  const [result, setResult] = useState<{ uid: string; profile: UserData | null } | null>(null);
  useEffect(() => {
    if (!uid) return;
    let active = true;
    userService.getUser(uid, true).then(profile => {
      if (active) setResult({ uid, profile });
    }).catch(() => { if (active) setResult({ uid, profile: null }); });
    return () => { active = false; };
  }, [uid]);
  const current = result?.uid === uid ? result : null;
  return {
    loading: Boolean(uid && !current),
    canWrite: Boolean(uid && canWriteTeamSettlement(current?.profile)),
  };
}
