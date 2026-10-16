import React, { createContext, useContext, useEffect, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { invalidateTeamScopedCache } from '../services/teamScopedReadService';
import { isRestrictedTeamLeader, teamWorkflowDestination } from '../utils/teamWorkflowPolicy';
import type { UserData } from '../services/userService';

const RestrictedTeamContext = createContext(false);
export const useRestrictedTeamWorkflow = () => useContext(RestrictedTeamContext);
export default function TeamWorkflowGate({ profile, children }: { profile: UserData | null; children: React.ReactNode }) {
    const location = useLocation();
    const [workers, setWorkers] = useState<Record<string, any>>({});
    const [positions, setPositions] = useState<Array<{id: string; name: string}>>([]);
    const [ready, setReady] = useState(false);
    const [failed, setFailed] = useState(false);
    const linked = JSON.stringify(profile?.linkedWorkerIds || []);
    useEffect(() => {
        let alive = true;
        setReady(false); setWorkers({}); setFailed(false);
        if (!profile?.uid) { setReady(true); return; }
        const stops: Array<() => void> = [];
        const ids: string[] = JSON.parse(linked);
        const waiting = new Set(['menu', ...ids]);
        const complete = (id: string) => { waiting.delete(id); if (alive && !waiting.size) setReady(true); };
        stops.push(onSnapshot(doc(db, 'settings', 'menus_v12'), snapshot => {
            if (!alive) return;
            setPositions(snapshot.data()?.admin?.positionConfig || []); complete('menu');
        }, () => { if (alive) setFailed(true); complete('menu'); }));
        ids.forEach(id => {
            if (!id || id.includes('/')) { complete(id); return; }
            stops.push(onSnapshot(doc(db, 'workers', id), snapshot => {
                if (!alive) return;
                const worker = snapshot.data();
                invalidateTeamScopedCache();
                setWorkers(previous => ({ ...previous, [id]: worker ? { role: worker.role, teamId: worker.teamId, status: worker.status, isActive: worker.isActive } : null })); complete(id);
            }, () => { if (alive) { setFailed(true); setWorkers(previous => ({ ...previous, [id]: null })); } complete(id); }));
        });
        return () => { alive = false; stops.forEach(stop => stop()); };
    }, [profile?.uid, linked]);
    const workerRows = Object.values(workers).filter(Boolean);
    const restricted = isRestrictedTeamLeader(profile, positions, workerRows);
    const accessProfile = profile as (UserData & { systemRole?: string; roles?: string[] }) | null;
    const revision = JSON.stringify([profile?.role, profile?.position, profile?.status, profile?.accountType,
        accessProfile?.systemRole, accessProfile?.roles, linked, profile?.additionalPositions, workers, positions]);
    useEffect(() => { invalidateTeamScopedCache(); }, [revision]);
    if (failed) return <p role="alert">현재 업무 권한을 확인하지 못했습니다. 연결을 확인한 뒤 새로고침해 주세요.</p>;
    if (!ready) return <p role="status">현재 업무 권한을 확인하는 중입니다.</p>;
    const destination = restricted && teamWorkflowDestination(location.pathname);
    if (destination === 'work') return <Navigate to="/manpower/team-worker-detail?section=work" replace />;
    if (destination === 'blocked') return <div className="p-6"><h1 className="text-xl font-bold">팀장 조회 메뉴를 이용해 주세요</h1><p className="my-3">일보 입력·수정과 전체 인원 관리는 사무실에서 처리합니다.</p><Link to="/manpower/team-worker-detail?section=work">작업자 근무내역 보기</Link></div>;
    return <RestrictedTeamContext.Provider value={restricted}><React.Fragment key={revision}>{children}</React.Fragment></RestrictedTeamContext.Provider>;
}
