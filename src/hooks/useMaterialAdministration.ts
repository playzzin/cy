import { useEffect, useState } from 'react';
import { usesTeamScopedReads } from '../services/teamScopedReadService';

// The server remains authoritative. Keep ungranted master/delete actions out of the team UI.
export function useMaterialAdministration(): boolean {
    const [allowed, setAllowed] = useState(false);
    useEffect(() => {
        let active = true;
        Promise.resolve(usesTeamScopedReads()).then(scoped => { if (active) setAllowed(!scoped); }).catch(() => { if (active) setAllowed(false); });
        return () => { active = false; };
    }, []);
    return allowed;
}
