import { toast } from '../utils/swal';
import { dc } from '../config/firebase';
import { z } from 'zod';
import {
    Status,
    createTeam as createTeamDc,
    deleteTeam as deleteTeamDc,
    getTeam as getTeamDc,
    listAllCompanies as listCompaniesDc,
    listAllTeams as listTeamsDc,
    listAllWorkers as listWorkersDc,
    updateTeam as updateTeamDc
} from '../dataconnect-generated';
import { Timestamp } from '../types/timestamp';

export interface Team {
    id?: string;
    legacyId?: string;
    name: string;
    type: string;
    leaderId: string; // Worker ID
    leaderName: string; // Denormalized
    companyId?: string; // 소속 회사 ID
    companyName?: string; // 회사명
    parentTeamId?: string; // 상위 팀 ID (새끼팀일 경우)
    parentTeamName?: string; // 상위 팀명
    memberCount?: number;
    assignedWorkers?: string[]; // 배정된 작업자 ID 배열 (Legacy)
    memberIds?: string[]; // 팀원 IDs
    memberNames?: string[]; // 팀원 이름들
    assignedSiteId?: string; // 배정된 현장 ID (Legacy)
    assignedSiteName?: string; // 배정된 현장명 (Legacy)
    siteIds?: string[]; // 배정된 현장 IDs
    siteNames?: string[]; // 배정된 현장 이름들
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
    totalManDay?: number; // 누적 공수
    status?: 'active' | 'waiting' | 'closed'; // 협업중 | 대기 | 폐업
    supportRate?: number; // 지원비 단가
    supportModel?: 'man_day' | 'fixed'; // 지원비 방식 (공수제 | 고정급)
    supportDescription?: string; // 지원비 비고
    serviceRate?: number; // 용역비 단가
    serviceModel?: 'man_day' | 'fixed'; // 용역비 방식 (공수제 | 고정급)
    serviceDescription?: string; // 용역비 비고
    defaultSalaryModel?: string; // 팀 기본 급여방식/지급구분
    color?: string; // 팀 식별용 색상 (HEX)
    icon?: string; // 팀 아이콘 (FontAwesome 아이콘명)
    iconKey?: string;
    role?: string; // 직종 (e.g., 목수, 철근)
}

const isUuidString = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    if (typeof error === 'object' && error && 'message' in error) {
        const maybeMessage = (error as { message?: unknown }).message;
        if (typeof maybeMessage === 'string') return maybeMessage;
    }
    return 'Unknown error';
};

const toNullableTrimmedString = (value: unknown): string | null => {
    if (value == null) return null;
    const trimmed = String(value).trim();
    return trimmed.length > 0 ? trimmed : null;
};

const CreateTeamInputSchema = z.object({
    name: z.string().trim().min(1, '팀명을 입력해주세요.'),
    type: z.string().optional(),
    leaderId: z.string().optional(),
    companyId: z.string().optional(),
    parentTeamId: z.string().optional(),
    parentTeamName: z.string().optional(),
    role: z.string().optional(),
    defaultSalaryModel: z.string().optional(),
    status: z.enum(['active', 'waiting', 'closed']).optional(),
    totalManDay: z.number().optional(),
    color: z.string().optional()
});

const dcTeamLegacyIdToUuid = new Map<string, string>();
let dcTeamsLoaded = false;

const dcWorkerLegacyIdToUuid = new Map<string, string>();
let dcWorkersLoaded = false;

const dcCompanyLegacyIdToUuid = new Map<string, string>();
let dcCompaniesLoaded = false;

const toFirestoreTimestamp = (value: any): Timestamp | undefined => {
    const raw = value ? String(value) : '';
    if (!raw) return undefined;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return undefined;
    return Timestamp.fromDate(d);
};

const toDcStatus = (value?: Team['status']): Status | null => {
    const v = value ? String(value) : '';
    if (v === 'active') return Status.ACTIVE;
    if (v === 'waiting') return Status.INACTIVE;
    if (v === 'closed') return Status.ARCHIVED;
    return null;
};

const fromDcStatus = (value: any): Team['status'] => {
    const v = value ? String(value) : '';
    if (v === Status.ACTIVE) return 'active';
    if (v === Status.INACTIVE) return 'waiting';
    if (v === Status.ARCHIVED) return 'closed';
    return 'active';
};

const loadDcTeams = async (): Promise<void> => {
    if (dcTeamsLoaded) return;
    const res = await listTeamsDc(dc);
    const rows = (res as any)?.data?.teams ?? [];
    dcTeamLegacyIdToUuid.clear();
    for (const row of rows) {
        const legacyId = row?.legacyId ? String(row.legacyId) : '';
        const id = row?.id ? String(row.id) : '';
        if (legacyId && id) {
            dcTeamLegacyIdToUuid.set(legacyId, id);
        }
        if (id) {
            dcTeamLegacyIdToUuid.set(id, id);
        }
    }
    dcTeamsLoaded = true;
};

const loadDcWorkers = async (): Promise<void> => {
    if (dcWorkersLoaded) return;
    const res = await listWorkersDc(dc);
    const rows = (res as any)?.data?.workers ?? [];
    dcWorkerLegacyIdToUuid.clear();
    for (const row of rows) {
        const legacyId = row?.legacyId ? String(row.legacyId) : '';
        const id = row?.id ? String(row.id) : '';
        if (legacyId && id) dcWorkerLegacyIdToUuid.set(legacyId, id);
        if (id) dcWorkerLegacyIdToUuid.set(id, id);
    }
    dcWorkersLoaded = true;
};

const loadDcCompanies = async (): Promise<void> => {
    if (dcCompaniesLoaded) return;
    const res = await listCompaniesDc(dc);
    const rows = (res as any)?.data?.companies ?? [];
    dcCompanyLegacyIdToUuid.clear();
    for (const row of rows) {
        const legacyId = row?.legacyId ? String(row.legacyId) : '';
        const id = row?.id ? String(row.id) : '';
        if (legacyId && id) dcCompanyLegacyIdToUuid.set(legacyId, id);
        if (id) dcCompanyLegacyIdToUuid.set(id, id);
    }
    dcCompaniesLoaded = true;
};

const resolveTeamUuid = async (id: string): Promise<string | null> => {
    const raw = id ? String(id) : '';
    if (!raw) return null;
    if (isUuidString(raw)) return raw;
    await loadDcTeams();
    const existing = dcTeamLegacyIdToUuid.get(raw);
    if (existing) return existing;

    dcTeamsLoaded = false;
    await loadDcTeams();
    return dcTeamLegacyIdToUuid.get(raw) ?? null;
};

const resolveWorkerUuid = async (id: string | undefined): Promise<string | null> => {
    const raw = id ? String(id) : '';
    if (!raw) return null;
    if (isUuidString(raw)) return raw;
    await loadDcWorkers();
    return dcWorkerLegacyIdToUuid.get(raw) ?? null;
};

const resolveCompanyUuid = async (id: string | undefined): Promise<string | null> => {
    const raw = id ? String(id) : '';
    if (!raw) return null;
    if (isUuidString(raw)) return raw;
    await loadDcCompanies();
    return dcCompanyLegacyIdToUuid.get(raw) ?? null;
};

const mapTeamFromDc = (row: any): Team => {
    const parentTeamId = row?.parentTeam?.id
        ? String(row.parentTeam.id)
        : (row?.parentTeamLegacyId ? String(row.parentTeamLegacyId) : undefined);

    const parentTeamName = row?.parentTeamName
        ? String(row.parentTeamName)
        : (row?.parentTeam?.name ? String(row.parentTeam.name) : undefined);

    return {
        id: row?.id ? String(row.id) : undefined,
        legacyId: row?.legacyId ? String(row.legacyId) : undefined,
        name: row?.name ? String(row.name) : '',
        type: row?.type ? String(row.type) : '',
        leaderId: row?.leader?.id ? String(row.leader.id) : '',
        leaderName: row?.leader?.name ? String(row.leader.name) : '',
        companyId: row?.company?.id ? String(row.company.id) : undefined,
        companyName: row?.company?.name ? String(row.company.name) : undefined,
        parentTeamId,
        parentTeamName,
        createdAt: toFirestoreTimestamp(row?.createdAt),
        updatedAt: toFirestoreTimestamp(row?.createdAt),
        totalManDay: typeof row?.totalManDay === 'number' ? row.totalManDay : undefined,
        status: fromDcStatus(row?.status),
        role: row?.role ? String(row.role) : undefined,
        defaultSalaryModel: row?.defaultSalaryModel ? String(row.defaultSalaryModel) : undefined,
        color: row?.color ? String(row.color) : undefined,
        siteNames: row?.sites_on_responsibleTeam ? row.sites_on_responsibleTeam.map((s: any) => s.name) : undefined,
        assignedSiteName: row?.sites_on_responsibleTeam && row.sites_on_responsibleTeam.length > 0 ? row.sites_on_responsibleTeam[0].name : (row?.assignedSiteName ? String(row.assignedSiteName) : undefined)
    } as Team;
};

export const teamService = {
    addTeam: async (team: Team): Promise<string> => {
        try {
            const parsed = CreateTeamInputSchema.safeParse(team);
            if (!parsed.success) {
                throw new Error(parsed.error.issues[0]?.message ?? '팀 입력값이 올바르지 않습니다.');
            }

            const normalizedTeam: Team = {
                ...team,
                name: parsed.data.name
            };
            if (typeof normalizedTeam.iconKey !== 'string') {
                normalizedTeam.iconKey = '';
            }
            if (!normalizedTeam.iconKey && typeof normalizedTeam.icon === 'string') {
                normalizedTeam.iconKey = normalizedTeam.icon;
            }

            const rawCompanyId = typeof normalizedTeam.companyId === 'string' ? normalizedTeam.companyId.trim() : '';
            const rawLeaderId = typeof normalizedTeam.leaderId === 'string' ? normalizedTeam.leaderId.trim() : '';

            const companyUuid = rawCompanyId ? await resolveCompanyUuid(rawCompanyId) : null;
            const leaderUuid = rawLeaderId ? await resolveWorkerUuid(rawLeaderId) : null;
            const status = toDcStatus(normalizedTeam.status);

            const rawParentTeamId = normalizedTeam.parentTeamId ? String(normalizedTeam.parentTeamId).trim() : '';
            const parentTeamUuid = rawParentTeamId ? await resolveTeamUuid(rawParentTeamId) : null;
            const parentTeamLegacyId = rawParentTeamId && !isUuidString(rawParentTeamId) ? rawParentTeamId : null;

            const legacyId = (normalizedTeam as any)?.legacyId;

            const created = await createTeamDc(dc, {
                name: normalizedTeam.name,
                legacyId: toNullableTrimmedString(legacyId),
                companyId: companyUuid,
                leaderId: leaderUuid,
                type: toNullableTrimmedString(normalizedTeam.type),
                role: toNullableTrimmedString(normalizedTeam.role),
                defaultSalaryModel: toNullableTrimmedString(normalizedTeam.defaultSalaryModel),
                parentTeamId: parentTeamUuid,
                parentTeamLegacyId,
                parentTeamName: toNullableTrimmedString(normalizedTeam.parentTeamName),
                status: status ?? Status.ACTIVE,
                totalManDay: typeof normalizedTeam.totalManDay === 'number' ? normalizedTeam.totalManDay : null,
                color: toNullableTrimmedString(normalizedTeam.color)
            } as any);

            const id = (created as any)?.data?.team_insert?.id ? String((created as any).data.team_insert.id) : '';
            if (!id) throw new Error('Failed to create team');

            dcTeamsLoaded = false;
            toast.saved('팀', 1);
            return id;
        } catch (error) {
            console.error("DataConnect: createTeam failed in addTeam", error);
            throw new Error(getErrorMessage(error));
        }
    },

    updateTeam: async (id: string, team: Partial<Team>): Promise<void> => {
        try {
            const normalizedUpdates: Partial<Team> = { ...team };
            if (typeof normalizedUpdates.iconKey !== 'string') {
                delete normalizedUpdates.iconKey; // undefined 대신 삭제
            }
            if (!normalizedUpdates.iconKey && typeof normalizedUpdates.icon === 'string') {
                normalizedUpdates.iconKey = normalizedUpdates.icon;
            }

            if (normalizedUpdates.name !== undefined) {
                const trimmed = String(normalizedUpdates.name).trim();
                if (!trimmed) {
                    throw new Error('팀명을 입력해주세요.');
                }
                normalizedUpdates.name = trimmed;
            }

            // 1. Check if name is changing
            // To be strictly safe and avoid extra reads if not needed, we could just check if 'team.name' exists.
            // But comparing with old name is better to avoid redundant batch writes.
            const uuid = await resolveTeamUuid(id);
            if (!uuid) throw new Error('존재하지 않는 팀입니다.');

            let nameChanged = false;
            if (team.name) {
                const snap = await getTeamDc(dc, { id: uuid } as any);
                const prev = (snap as any)?.data?.team;
                if (prev?.name !== team.name) nameChanged = true;
            }

            // undefined 필드 제거
            const cleanUpdates: any = {};
            Object.keys(normalizedUpdates).forEach(key => {
                const value = (normalizedUpdates as any)[key];
                if (value !== undefined) {
                    cleanUpdates[key] = value;
                }
            });

            const vars: any = { id: uuid };
            if (cleanUpdates.name !== undefined) vars.name = cleanUpdates.name;
            if (cleanUpdates.type !== undefined) vars.type = cleanUpdates.type;
            if (cleanUpdates.totalManDay !== undefined) vars.totalManDay = cleanUpdates.totalManDay;
            if (cleanUpdates.status !== undefined) {
                const mapped = toDcStatus(cleanUpdates.status);
                if (mapped !== null) {
                    vars.status = mapped;
                }
            }
            if (cleanUpdates.companyId !== undefined) vars.companyId = (await resolveCompanyUuid(cleanUpdates.companyId)) ?? null;
            if (cleanUpdates.leaderId !== undefined) vars.leaderId = (await resolveWorkerUuid(cleanUpdates.leaderId)) ?? null;

            if (cleanUpdates.role !== undefined) vars.role = cleanUpdates.role;
            if (cleanUpdates.defaultSalaryModel !== undefined) vars.defaultSalaryModel = cleanUpdates.defaultSalaryModel;
            if (cleanUpdates.color !== undefined) vars.color = cleanUpdates.color;
            if (cleanUpdates.parentTeamName !== undefined) vars.parentTeamName = cleanUpdates.parentTeamName;

            if (cleanUpdates.parentTeamId !== undefined) {
                const rawParent = cleanUpdates.parentTeamId ? String(cleanUpdates.parentTeamId).trim() : '';
                if (!rawParent) {
                    vars.parentTeamId = null;
                    vars.parentTeamLegacyId = null;
                } else {
                    vars.parentTeamId = (await resolveTeamUuid(rawParent)) ?? null;
                    vars.parentTeamLegacyId = !isUuidString(rawParent) ? rawParent : null;
                }
            }
            await updateTeamDc(dc, vars as any);

            dcTeamsLoaded = false;
            toast.updated('팀');

            // 2. Sync
            if (nameChanged && team.name) {
                try {
                    const { manpowerService } = await import('./manpowerService');
                    await manpowerService.updateWorkersTeamName(id, team.name);
                } catch (e) {
                    console.error("Failed to sync team name to workers:", e);
                }
            }
        } catch (error) {
            console.error("DataConnect: updateTeam failed in updateTeam", error);
            throw new Error(getErrorMessage(error));
        }
    },

    deleteTeam: async (id: string): Promise<void> => {
        try {
            const uuid = await resolveTeamUuid(id);
            if (!uuid) return;
            await deleteTeamDc(dc, { id: uuid } as any);
            dcTeamsLoaded = false;
            toast.deleted('팀', 1);
        } catch (error) {
            console.error("DataConnect: deleteTeam failed in deleteTeam", error);
            throw error;
        }
    },

    getTeams: async (): Promise<Team[]> => {
        try {
            const res = await listTeamsDc(dc);
            const rows = (res as any)?.data?.teams ?? [];
            const mapped = rows.map((r: any) => mapTeamFromDc(r));
            mapped.sort((a: any, b: any) => {
                const at = a.createdAt?.toDate?.()?.getTime?.() ?? 0;
                const bt = b.createdAt?.toDate?.()?.getTime?.() ?? 0;
                return bt - at;
            });
            return mapped;
        } catch (error) {
            console.error("DataConnect: listTeamsDc failed in getTeams", error);
            return [];
        }
    },

    // 팀명으로 조회
    getTeamByName: async (name: string): Promise<Team | null> => {
        const res = await listTeamsDc(dc);
        const rows = (res as any)?.data?.teams ?? [];
        const found = rows.find((r: any) => String(r?.name ?? '') === String(name));
        if (!found) return null;
        return mapTeamFromDc(found);
    },

    getTeam: async (id: string): Promise<Team | null> => {
        const uuid = await resolveTeamUuid(id);
        if (!uuid) return null;
        const res = await getTeamDc(dc, { id: uuid } as any);
        const row = (res as any)?.data?.team;
        if (!row) return null;
        return mapTeamFromDc(row);
    },

    // Get teams (Paginated)
    getTeamsPaginated: async (limitCount: number, lastDoc: any = null): Promise<{ teams: Team[], lastDoc: any }> => {
        try {
            const res = await listTeamsDc(dc);
            const rows = (res as any)?.data?.teams ?? [];
            const mapped = rows.map((r: any) => mapTeamFromDc(r));
            mapped.sort((a: any, b: any) => {
                const at = a.createdAt?.toDate?.()?.getTime?.() ?? 0;
                const bt = b.createdAt?.toDate?.()?.getTime?.() ?? 0;
                return bt - at;
            });

            const lastId = typeof lastDoc === 'string'
                ? lastDoc
                : (lastDoc?.id ? String(lastDoc.id) : '');
            const startIndex = lastId ? Math.max(0, mapped.findIndex((t: Team) => String(t.id) === lastId) + 1) : 0;
            const page = mapped.slice(startIndex, startIndex + limitCount);
            const nextLastDoc = page.length > 0 ? { id: page[page.length - 1].id } : null;
            return { teams: page, lastDoc: nextLastDoc };
        } catch (error) {
            console.error("Error fetching teams paginated:", error);
            throw error;
        }
    },

    // Increment total man-day for a team
    incrementManDay: async (teamId: string, amount: number): Promise<void> => {
        try {
            if (!teamId) return;
            if (!Number.isFinite(amount) || amount === 0) return;

            const uuid = await resolveTeamUuid(teamId);
            if (!uuid) {
                console.warn('[DataConnect] Team not found for incrementManDay', { teamId, amount });
                return;
            }

            const res = await getTeamDc(dc, { id: uuid } as any);
            const row = (res as any)?.data?.team;
            const current = typeof row?.totalManDay === 'number' ? row.totalManDay : 0;
            await updateTeamDc(dc, { id: uuid, totalManDay: current + amount } as any);
        } catch (error) {
            console.error(`Error incrementing man-day for team ${teamId}:`, error);
        }
    },

    // Update multiple teams
    updateTeamsBatch: async (ids: string[], updates: Partial<Team>): Promise<void> => {
        try {
            for (const id of ids) {
                await teamService.updateTeam(id, updates);
            }
            toast.updated('팀');
        } catch (error) {
            console.error("Error updating teams batch:", error);
            throw error;
        }
    },

    // Delete multiple teams
    deleteTeamsBatch: async (ids: string[]): Promise<void> => {
        try {
            const promises = ids.map(async (id) => {
                const uuid = await resolveTeamUuid(id);
                if (uuid) {
                    await deleteTeamDc(dc, { id: uuid } as any);
                }
            });
            await Promise.all(promises);
            dcTeamsLoaded = false;
            toast.deleted('팀', ids.length);
        } catch (error) {
            console.error("Error deleting teams batch:", error);
            throw error;
        }
    }
};
