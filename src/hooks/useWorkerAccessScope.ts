import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import type { Team } from '../services/teamService';
import { userService, type UserData } from '../services/userService';
import type { Worker } from '../services/manpowerService';

export type WorkerAccessMode = 'all' | 'team' | 'self';

export interface WorkerAccessScope {
    loading: boolean;
    mode: WorkerAccessMode;
    label: string;
    profile: UserData | null;
    viewerWorker: Worker | null;
    workerIds: string[];
    workerUids: string[];
    workerNames: string[];
    workerNameKeys: string[];
    teamIds: string[];
    teamNames: string[];
    teamNameKeys: string[];
    teamWorkerIds: string[];
    teamWorkerNameKeys: string[];
}

const uniqueTexts = (values: unknown[]) =>
    Array.from(new Set(values.map(value => String(value ?? '').trim()).filter(Boolean)));

export const normalizeAccessText = (value?: unknown) =>
    String(value ?? '').replace(/\s+/g, '').trim().toLowerCase();

export const parseAccessLinkedIds = (raw?: unknown): string[] => {
    if (Array.isArray(raw)) return uniqueTexts(raw);

    const text = String(raw ?? '').trim();
    if (!text) return [];

    try {
        const parsed = JSON.parse(text);
        return Array.isArray(parsed) ? uniqueTexts(parsed) : [text];
    } catch {
        return [text];
    }
};

const EMPTY_SELF_SCOPE: WorkerAccessScope = {
    loading: false,
    mode: 'self',
    label: '내 정보',
    profile: null,
    viewerWorker: null,
    workerIds: [],
    workerUids: [],
    workerNames: [],
    workerNameKeys: [],
    teamIds: [],
    teamNames: [],
    teamNameKeys: [],
    teamWorkerIds: [],
    teamWorkerNameKeys: [],
};

const buildAllScope = (profile: UserData | null, loading = false): WorkerAccessScope => ({
    ...EMPTY_SELF_SCOPE,
    loading,
    mode: 'all',
    label: '전체',
    profile,
});

const profileBypassesWorkerScope = (profile: UserData | null) => {
    const accountType = normalizeAccessText(profile?.accountType);
    if (accountType === 'office') return true;

    const role = normalizeAccessText(profile?.role);
    return ['admin', 'administrator', '관리자', '사장', '실장', 'manager', '매니저', '메니저', '본사', '사무'].some(keyword =>
        role.includes(normalizeAccessText(keyword))
    );
};

const isTeamLeadLikeRole = (value?: unknown) => {
    const role = normalizeAccessText(value);
    if (!role) return false;
    return role.includes('팀장') || role.includes('반장') || role.includes('teamleader') || role.includes('foreman');
};

const getWorkerAssignedTeam = (worker: Worker | null | undefined, teams: Team[]) => {
    if (!worker) return null;

    const teamId = String(worker.teamId ?? '').trim();
    if (teamId) {
        const byId = teams.find(team =>
            String(team.id ?? '').trim() === teamId || String(team.legacyId ?? '').trim() === teamId
        );
        if (byId) return byId;
    }

    const teamNameKey = normalizeAccessText(worker.teamName);
    if (teamNameKey) {
        return teams.find(team => normalizeAccessText(team.name) === teamNameKey) ?? null;
    }

    return null;
};

const findViewerWorker = (
    uid: string | undefined,
    email: string | null | undefined,
    workers: Worker[],
    profile: UserData | null
) => {
    const cleanUid = String(uid ?? '').trim();
    const cleanEmail = normalizeAccessText(email);

    if (cleanUid) {
        const direct = workers.find(worker => String(worker.uid ?? '').trim() === cleanUid);
        if (direct) return direct;
    }

    const linkedWorkerIds = parseAccessLinkedIds(profile?.linkedWorkerIds);
    if (linkedWorkerIds.length > 0) {
        const linked = workers.find(worker => {
            const keys = uniqueTexts([worker.id, worker.legacyId]);
            return linkedWorkerIds.some(id => keys.includes(id));
        });
        if (linked) return linked;
    }

    if (cleanEmail) {
        return workers.find(worker => normalizeAccessText(worker.email) === cleanEmail) ?? null;
    }

    return null;
};

const buildWorkerScope = (
    mode: WorkerAccessMode,
    profile: UserData | null,
    viewerWorker: Worker,
    teams: Team[]
): WorkerAccessScope => {
    const team = getWorkerAssignedTeam(viewerWorker, teams);
    const workerIds = uniqueTexts([viewerWorker.id, viewerWorker.legacyId]);
    const workerUids = uniqueTexts([viewerWorker.uid]);
    const workerNames = uniqueTexts([viewerWorker.name]);
    const teamIds = uniqueTexts([viewerWorker.teamId, team?.id, team?.legacyId]);
    const teamNames = uniqueTexts([viewerWorker.teamName, team?.name]);
    const teamWorkerIds = uniqueTexts([
        ...(Array.isArray(team?.memberIds) ? team?.memberIds ?? [] : []),
        ...(Array.isArray(team?.assignedWorkers) ? team?.assignedWorkers ?? [] : []),
        ...(mode === 'self' ? workerIds : []),
    ]);
    const teamWorkerNames = uniqueTexts([
        ...(Array.isArray(team?.memberNames) ? team?.memberNames ?? [] : []),
        ...(mode === 'self' ? workerNames : []),
    ]);

    return {
        loading: false,
        mode,
        label: mode === 'team' ? (teamNames[0] || teamIds[0] || '내 팀') : (workerNames[0] || '내 정보'),
        profile,
        viewerWorker,
        workerIds,
        workerUids,
        workerNames,
        workerNameKeys: workerNames.map(normalizeAccessText),
        teamIds,
        teamNames,
        teamNameKeys: teamNames.map(normalizeAccessText),
        teamWorkerIds,
        teamWorkerNameKeys: teamWorkerNames.map(normalizeAccessText),
    };
};

export const useWorkerAccessScope = (workers: Worker[], teams: Team[] = []): WorkerAccessScope => {
    const { currentUser } = useAuth();
    const [profile, setProfile] = useState<UserData | null>(null);
    const [loadingProfile, setLoadingProfile] = useState(true);

    useEffect(() => {
        let mounted = true;

        const loadProfile = async () => {
            if (!currentUser?.uid) {
                if (mounted) {
                    setProfile(null);
                    setLoadingProfile(false);
                }
                return;
            }

            setLoadingProfile(true);
            try {
                const nextProfile = await userService.getUser(currentUser.uid);
                if (mounted) setProfile(nextProfile);
            } catch (error) {
                console.error('[useWorkerAccessScope] failed to load user profile', error);
                if (mounted) setProfile(null);
            } finally {
                if (mounted) setLoadingProfile(false);
            }
        };

        void loadProfile();

        return () => {
            mounted = false;
        };
    }, [currentUser?.uid]);

    return useMemo(() => {
        if (loadingProfile) {
            return { ...EMPTY_SELF_SCOPE, loading: true, profile };
        }

        if (!currentUser?.uid) {
            return { ...EMPTY_SELF_SCOPE, profile };
        }

        if (profileBypassesWorkerScope(profile)) {
            return buildAllScope(profile);
        }

        const viewerWorker = findViewerWorker(currentUser.uid, currentUser.email, workers, profile);
        const linkedWorkerIds = parseAccessLinkedIds(profile?.linkedWorkerIds);
        const isWorkerAccount = normalizeAccessText(profile?.accountType) === 'worker' || linkedWorkerIds.length > 0;

        if (!viewerWorker) {
            if (!isWorkerAccount) return buildAllScope(profile);

            return {
                ...EMPTY_SELF_SCOPE,
                profile,
                workerIds: linkedWorkerIds,
            };
        }

        const teamRoleSources = [
            viewerWorker.role,
            profile?.position,
            profile?.role,
            ...(Array.isArray(profile?.additionalPositions) ? profile?.additionalPositions ?? [] : []),
        ];
        const wantsTeamScope = teamRoleSources.some(isTeamLeadLikeRole);
        const provisionalTeamScope = buildWorkerScope('team', profile, viewerWorker, teams);

        if (wantsTeamScope && (provisionalTeamScope.teamIds.length > 0 || provisionalTeamScope.teamNames.length > 0)) {
            return provisionalTeamScope;
        }

        return buildWorkerScope('self', profile, viewerWorker, teams);
    }, [currentUser?.email, currentUser?.uid, loadingProfile, profile, teams, workers]);
};

const hasExactMatch = (candidates: string[], value?: unknown) => {
    const text = String(value ?? '').trim();
    return Boolean(text && candidates.includes(text));
};

const hasNormalizedMatch = (candidates: string[], value?: unknown) => {
    const text = normalizeAccessText(value);
    return Boolean(text && candidates.includes(text));
};

export const workerAccessCanViewWholeTeam = (scope: WorkerAccessScope) => scope.mode === 'all' || scope.mode === 'team';

export const workerAccessMatchesTeamRef = (scope: WorkerAccessScope, teamId?: unknown, teamName?: unknown) => {
    if (scope.mode === 'all') return true;
    return hasExactMatch(scope.teamIds, teamId) || hasNormalizedMatch(scope.teamNameKeys, teamName);
};

export const workerAccessMatchesTeam = (scope: WorkerAccessScope, team?: Team | null) => {
    if (scope.mode === 'all') return true;
    if (!team) return false;
    return (
        workerAccessMatchesTeamRef(scope, team.id, team.name) ||
        workerAccessMatchesTeamRef(scope, team.legacyId, team.name)
    );
};

export const workerAccessMatchesWorkerRef = (
    scope: WorkerAccessScope,
    workerId?: unknown,
    workerName?: unknown,
    workerUid?: unknown
) => {
    if (scope.mode === 'all') return true;
    return (
        hasExactMatch(scope.workerIds, workerId) ||
        hasExactMatch(scope.workerUids, workerUid) ||
        hasNormalizedMatch(scope.workerNameKeys, workerName)
    );
};

export const workerAccessMatchesWorker = (scope: WorkerAccessScope, worker?: Worker | null) => {
    if (scope.mode === 'all') return true;
    if (!worker) return false;

    if (scope.mode === 'self') {
        return workerAccessMatchesWorkerRef(scope, worker.id, worker.name, worker.uid) ||
            workerAccessMatchesWorkerRef(scope, worker.legacyId, worker.name, worker.uid);
    }

    return (
        workerAccessMatchesTeamRef(scope, worker.teamId, worker.teamName) ||
        hasExactMatch(scope.teamWorkerIds, worker.id) ||
        hasExactMatch(scope.teamWorkerIds, worker.legacyId) ||
        hasNormalizedMatch(scope.teamWorkerNameKeys, worker.name)
    );
};

export const workerAccessMatchesReportRow = (
    scope: WorkerAccessScope,
    row: {
        workerId?: unknown;
        workerName?: unknown;
        teamId?: unknown;
        teamName?: unknown;
        responsibleTeamId?: unknown;
        responsibleTeamName?: unknown;
        workerTeamId?: unknown;
        workerTeamName?: unknown;
    }
) => {
    if (scope.mode === 'all') return true;

    if (scope.mode === 'self') {
        return workerAccessMatchesWorkerRef(scope, row.workerId, row.workerName);
    }

    return (
        workerAccessMatchesTeamRef(scope, row.workerTeamId, row.workerTeamName) ||
        workerAccessMatchesTeamRef(scope, row.teamId, row.teamName) ||
        workerAccessMatchesTeamRef(scope, row.responsibleTeamId, row.responsibleTeamName) ||
        hasExactMatch(scope.teamWorkerIds, row.workerId) ||
        hasNormalizedMatch(scope.teamWorkerNameKeys, row.workerName)
    );
};
