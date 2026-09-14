interface WorkedTeamRowSource {
    workerId?: unknown;
    workerTeamId?: unknown;
    workerTeamName?: unknown;
    manDay?: unknown;
}

interface WorkedTeamSource {
    id?: unknown;
    legacyId?: unknown;
    name?: unknown;
}

interface WorkedTeamWorkerSource {
    id?: unknown;
    legacyId?: unknown;
    teamId?: unknown;
    teamName?: unknown;
}

const normalizeId = (value: unknown): string => String(value ?? '').trim();
const normalizeName = (value: unknown): string => normalizeId(value).replace(/\s+/g, '');

/**
 * 조회 기간의 일보에서 공수가 실제로 발생한 작업자 소속팀만 반환합니다.
 * 과거 일보에 저장된 팀 스냅샷을 우선하고, 스냅샷이 없는 구형 데이터만
 * 현재 작업자 소속팀으로 보완합니다.
 */
export const buildWorkedTeamIds = (
    rows: WorkedTeamRowSource[],
    teams: WorkedTeamSource[],
    workers: WorkedTeamWorkerSource[]
): Set<string> => {
    const canonicalTeamIdByAnyId = new Map<string, string>();
    const canonicalTeamIdByName = new Map<string, string>();

    teams.forEach((team) => {
        const canonicalId = normalizeId(team.id) || normalizeId(team.legacyId);
        if (!canonicalId) return;

        [team.id, team.legacyId]
            .map(normalizeId)
            .filter(Boolean)
            .forEach((id) => canonicalTeamIdByAnyId.set(id, canonicalId));

        const nameKey = normalizeName(team.name);
        if (nameKey && !canonicalTeamIdByName.has(nameKey)) {
            canonicalTeamIdByName.set(nameKey, canonicalId);
        }
    });

    const workerByAnyId = new Map<string, WorkedTeamWorkerSource>();
    workers.forEach((worker) => {
        [worker.id, worker.legacyId]
            .map(normalizeId)
            .filter(Boolean)
            .forEach((id) => workerByAnyId.set(id, worker));
    });

    const resolveTeamId = (idValue: unknown, nameValue?: unknown): string => {
        const rawId = normalizeId(idValue);
        if (rawId) return canonicalTeamIdByAnyId.get(rawId) ?? rawId;

        const nameKey = normalizeName(nameValue);
        return nameKey ? (canonicalTeamIdByName.get(nameKey) ?? '') : '';
    };

    const workedTeamIds = new Set<string>();
    rows.forEach((row) => {
        const manDay = Number(row.manDay ?? 0);
        if (!Number.isFinite(manDay) || manDay <= 0) return;

        const worker = workerByAnyId.get(normalizeId(row.workerId));
        const snapshotTeamId = resolveTeamId(row.workerTeamId, row.workerTeamName);
        const teamId = snapshotTeamId || resolveTeamId(worker?.teamId, worker?.teamName);
        if (teamId) workedTeamIds.add(teamId);
    });

    return workedTeamIds;
};
