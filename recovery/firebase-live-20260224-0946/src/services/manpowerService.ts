import app, { storage } from '../config/firebase';
import { toast } from '../utils/swal';
import { getDataConnect } from 'firebase/data-connect';
import {
    connectorConfig,
    createAppUser,
    listAllWorkers,
    createWorker,
    deleteAppUser as deleteAppUserDc,
    deleteWorker as deleteWorkerDc,
    getWorker,
    listAppUsers,
    listCompanies,
    listTeams,
    listWorkers,
    updateAppUser,
    updateWorker
} from './dataconnectCompat';
import { Timestamp } from '../types/timestamp';
import { deleteObject, ref } from 'firebase/storage';

export interface Worker {
    id?: string;
    legacyId?: string;
    uid?: string; // Firebase Auth UID
    name: string;
    idNumber: string;
    address?: string;
    contact?: string;
    email?: string;
    role?: string;
    teamId?: string; // Reference to Team
    teamType: string;
    teamName?: string;
    status: string;

    unitPrice: number;
    payType?: string; // 급여 형태 (일급제 등)
    bankName?: string;
    accountNumber?: string;
    accountHolder?: string;
    fileNameSaved?: string;
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
    needsApproval?: boolean; // 관리자 승인 필요 여부
    totalManDay?: number; // 누적 공수
    salaryModel?: string; // 급여 형태 (일급제, 주급제, 월급제, 지원팀, 용역팀, 가지급)
    employmentType?: string; // 고용 형태 (일용직, 상용직 등)
    rank?: string; // 직급/숙련도
    siteId?: string; // 현장 ID
    siteName?: string; // 현장명
    companyId?: string; // 소속 회사 ID
    companyName?: string; // 소속 회사명
    leaderName?: string; // 팀장명 (임시 저장용, 동기화 시 사용)
    color?: string; // 작업자 식별용 색상 (HEX)
    iconKey?: string;
    signatureUrl?: string; // 전자 서명 이미지 URL
    bloodType?: string; // 혈액형
}

const dc = getDataConnect(app, connectorConfig);

const isUuidString = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

const dcWorkerLegacyIdToUuid = new Map<string, string>();
let dcWorkersLoaded = false;

const dcWorkerDetailById = new Map<string, any>();
let dcWorkerDetailsLoaded = false;
let dcWorkerDetailsLoading: Promise<void> | null = null;

type TeamMeta = {
    uuid: string;
    legacyId?: string;
    name?: string;
    type?: string;
    companyUuid?: string;
    companyName?: string;
};

const dcTeamByUuid = new Map<string, TeamMeta>();
const dcTeamLegacyIdToUuid = new Map<string, string>();
let dcTeamsLoaded = false;

const dcCompanyUuidToLegacyId = new Map<string, string>();
let dcCompaniesLoaded = false;

const toNullableTrimmedString = (value: unknown): string | null => {
    if (value == null) return null;
    const trimmed = String(value).trim();
    return trimmed ? trimmed : null;
};

const loadDcWorkerDetails = async (): Promise<void> => {
    if (dcWorkerDetailsLoaded) return;
    if (dcWorkerDetailsLoading) return dcWorkerDetailsLoading;

    dcWorkerDetailsLoading = (async () => {
        try {
            const rows: any[] = [];
            const limit = 500;
            let offset = 0;

            while (true) {
                const res = await listAllWorkers(dc, { limit, offset } as any);
                const pageRows = (res as any)?.data?.workers ?? [];
                if (Array.isArray(pageRows)) rows.push(...pageRows);
                if (!Array.isArray(pageRows) || pageRows.length < limit) break;
                offset += limit;
            }

            if (rows.length === 0) {
                // Fallback: 일부 환경에서 listAllWorkers가 제약될 수 있으므로 기본 목록으로 보완
                try {
                    const fallbackRes = await listWorkers(dc);
                    const fallbackRows = (fallbackRes as any)?.data?.workers ?? [];
                    if (Array.isArray(fallbackRows)) rows.push(...fallbackRows);
                } catch (fallbackError) {
                    console.warn('DataConnect: listWorkers fallback failed in loadDcWorkerDetails', fallbackError);
                }
            }

            dcWorkerDetailById.clear();
            for (const row of rows) {
                const id = row?.id ? String(row.id) : '';
                if (!id) continue;
                dcWorkerDetailById.set(id, row);
            }
            dcWorkerDetailsLoaded = true;
        } catch (error) {
            // 상세 로딩 실패 시에도 기본 workers 목록으로 동작할 수 있게 치명 실패로 만들지 않는다.
            console.warn('DataConnect: listAllWorkers failed in loadDcWorkerDetails. Continuing with base worker rows.', error);
            dcWorkerDetailById.clear();
            dcWorkerDetailsLoaded = true;
        } finally {
            dcWorkerDetailsLoading = null;
        }
    })();

    return dcWorkerDetailsLoading;
};

const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    if (typeof error === 'object' && error && 'message' in error) {
        const maybeMessage = (error as { message?: unknown }).message;
        if (typeof maybeMessage === 'string') return maybeMessage;
    }
    return 'Unknown error';
};

const loadDcWorkers = async (): Promise<void> => {
    if (dcWorkersLoaded) return;
    const res = await listWorkers(dc);
    const rows = (res as any)?.data?.workers ?? [];
    dcWorkerLegacyIdToUuid.clear();
    for (const row of rows) {
        const legacyId = row?.legacyId ? String(row.legacyId).trim() : '';
        const id = row?.id ? String(row.id).trim() : '';
        if (id) {
            dcWorkerLegacyIdToUuid.set(id, id);
        }
        if (legacyId && id) {
            dcWorkerLegacyIdToUuid.set(legacyId, id);
        }
    }
    dcWorkersLoaded = true;
};

const resolveWorkerUuid = async (id: string): Promise<string | null> => {
    const raw = id ? String(id).trim() : '';
    if (!raw) return null;
    if (isUuidString(raw)) return raw;
    await loadDcWorkers();
    const existing = dcWorkerLegacyIdToUuid.get(raw);
    if (existing) return existing;

    dcWorkersLoaded = false;
    await loadDcWorkers();
    return dcWorkerLegacyIdToUuid.get(raw) ?? null;
};

const parseLinkedWorkerIds = (value?: string | null): string[] => {
    if (!value) return [];
    const raw = String(value).trim();
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.map(v => String(v)).filter(Boolean);
    } catch {
        // ignore
    }
    return raw.split(',').map(v => v.trim()).filter(Boolean);
};

const loadDcCompanies = async (): Promise<void> => {
    if (dcCompaniesLoaded) return;
    const res = await listCompanies(dc);
    const rows = (res as any)?.data?.companies ?? [];
    dcCompanyUuidToLegacyId.clear();
    for (const row of rows) {
        const uuid = row?.id ? String(row.id) : '';
        if (!uuid) continue;
        const legacyId = row?.legacyId ? String(row.legacyId) : '';
        dcCompanyUuidToLegacyId.set(uuid, legacyId || uuid);
    }
    dcCompaniesLoaded = true;
};

const loadDcTeams = async (): Promise<void> => {
    if (dcTeamsLoaded) return;
    const res = await listTeams(dc);
    const rows = (res as any)?.data?.teams ?? [];
    dcTeamByUuid.clear();
    dcTeamLegacyIdToUuid.clear();
    for (const row of rows) {
        const uuid = row?.id ? String(row.id) : '';
        if (!uuid) continue;
        const legacyId = row?.legacyId ? String(row.legacyId) : '';
        if (legacyId) dcTeamLegacyIdToUuid.set(legacyId, uuid);
        dcTeamLegacyIdToUuid.set(uuid, uuid);
        dcTeamByUuid.set(uuid, {
            uuid,
            legacyId: legacyId || undefined,
            name: row?.name ? String(row.name) : undefined,
            type: row?.type ? String(row.type) : undefined,
            companyUuid: row?.company?.id ? String(row.company.id) : undefined,
            companyName: row?.company?.name ? String(row.company.name) : undefined
        });
    }
    dcTeamsLoaded = true;
};

const resolveTeamUuid = async (teamId: string | undefined): Promise<string | null> => {
    const raw = teamId ? String(teamId) : '';
    if (!raw) return null;
    if (isUuidString(raw)) return raw;
    await loadDcTeams();
    return dcTeamLegacyIdToUuid.get(raw) ?? null;
};

const findAppUserBy = async (params: { uid?: string; email?: string }): Promise<any | null> => {
    const uid = params.uid ? String(params.uid) : '';
    const email = params.email ? String(params.email) : '';
    if (!uid && !email) return null;
    try {
        const res = await listAppUsers(dc);
        const rows = (res as any)?.data?.appUsers ?? [];
        return (
            rows.find((r: any) => uid && (String(r?.uid ?? '') === uid || String(r?.id ?? '') === uid))
            ?? rows.find((r: any) => email && String(r?.email ?? '') === email)
            ?? null
        );
    } catch (error) {
        console.error("DataConnect: listAppUsers failed in findAppUserBy", error);
        // This is a workaround for a backend issue.
        return null;
    }
};

const serializeLinkedWorkerIds = (ids: string[]): string => {
    const uniq = Array.from(new Set(ids.map(v => String(v)).filter(Boolean)));
    return JSON.stringify(uniq);
};

const upsertAppUserLink = async (params: { uid?: string; email?: string; workerId: string; displayName?: string }): Promise<void> => {
    const uid = params.uid ? String(params.uid) : '';
    const email = params.email ? String(params.email) : '';
    const workerId = String(params.workerId);
    if (!uid && !email) return;

    const existing = await findAppUserBy({ uid, email });
    const existingLinked = parseLinkedWorkerIds(existing?.linkedWorkerIds);
    const nextLinked = serializeLinkedWorkerIds([...existingLinked, workerId]);
    const nowIso = new Date().toISOString();

    if (existing?.id) {
        await updateAppUser(dc, {
            id: String(existing.id),
            uid: uid || (existing?.uid ?? null),
            email: email || (existing?.email ?? null),
            displayName: params.displayName ?? (existing?.displayName ?? null),
            linkedWorkerIds: nextLinked,
            lastLogin: nowIso
        } as any);
        return;
    }

    await createAppUser(dc, {
        id: uid || email,
        uid: uid || null,
        email: email || null,
        displayName: params.displayName ?? null,
        linkedWorkerIds: nextLinked,
        lastLogin: nowIso
    } as any);
};

const unlinkWorkerFromAppUsers = async (workerId: string, rawId?: string): Promise<void> => {
    let rows = [];
    try {
        const res = await listAppUsers(dc);
        rows = (res as any)?.data?.appUsers ?? [];
    } catch (error) {
        console.error("DataConnect: listAppUsers failed in unlinkWorkerFromAppUsers", error);
        return; // Exit gracefully
    }

    for (const u of rows) {
        const current = parseLinkedWorkerIds(u?.linkedWorkerIds);
        if (current.length === 0) continue;
        const next = current.filter((id) => id !== workerId && (rawId ? id !== rawId : true));
        if (next.length === current.length) continue;

        if (next.length === 0) {
            try {
                await deleteAppUserDc(dc, { id: String(u?.id) } as any);
            } catch {
                await updateAppUser(dc, { id: String(u?.id), linkedWorkerIds: '' } as any);
            }
        } else {
            await updateAppUser(dc, { id: String(u?.id), linkedWorkerIds: serializeLinkedWorkerIds(next) } as any);
        }
    }
};

const toFirestoreTimestamp = (value: any): Timestamp | undefined => {
    const raw = value ? String(value) : '';
    if (!raw) return undefined;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return undefined;
    return Timestamp.fromDate(d);
};

const getWorkerIdentityMap = async (): Promise<Map<string, { uid?: string; email?: string }>> => {
    await loadDcWorkers();
    let rows = [];
    try {
        const res = await listAppUsers(dc);
        rows = (res as any)?.data?.appUsers ?? [];
    } catch (error) {
        console.error("DataConnect: listAppUsers failed in getWorkerIdentityMap", error);
        return new Map(); // Return empty map on error
    }
    const map = new Map<string, { uid?: string; email?: string }>();

    for (const u of rows) {
        const uid = u?.uid ? String(u.uid) : undefined;
        const email = u?.email ? String(u.email) : undefined;
        const linked = parseLinkedWorkerIds(u?.linkedWorkerIds);
        for (const linkedId of linked) {
            const raw = String(linkedId);
            const uuid = isUuidString(raw) ? raw : (dcWorkerLegacyIdToUuid.get(raw) ?? raw);
            if (!uuid) continue;
            map.set(uuid, { uid, email });
        }
    }
    return map;
};

const mapWorkerFromDc = (row: any, identity?: { uid?: string; email?: string }): Worker => {
    const uuid = row?.id ? String(row.id) : '';

    const teamUuid = row?.team?.id ? String(row.team.id) : (row?.teamId ? String(row.teamId) : '');
    const teamMeta = teamUuid ? dcTeamByUuid.get(teamUuid) : undefined;
    const teamId = teamMeta?.legacyId ?? teamUuid ?? undefined;
    const teamName = teamMeta?.name ?? (row?.team?.name ? String(row.team.name) : undefined);
    const teamTypeFromRow = row?.teamType ? String(row.teamType) : undefined;
    const teamType = teamTypeFromRow ?? teamMeta?.type ?? (teamId ? '' : '미배정');

    const companyUuid = teamMeta?.companyUuid;
    const companyId = companyUuid ? (dcCompanyUuidToLegacyId.get(companyUuid) ?? companyUuid) : undefined;
    const companyName = row?.companyName
        ? String(row.companyName)
        : (teamMeta?.companyName ?? undefined);

    const isActive = row?.isActive;
    const statusFromRow = row?.statusText ? String(row.statusText) : '';
    const derivedStatus = isActive === false
        ? '퇴사'
        : (identity?.uid && !teamId ? '대기중' : (teamId ? '재직' : '미배정'));
    const status = statusFromRow || derivedStatus;

    const email = identity?.email ?? (row?.email ? String(row.email) : undefined);
    const salaryModel = row?.salaryModel
        ? String(row.salaryModel)
        : (row?.payType ? String(row.payType) : undefined);
    const color = row?.color ? String(row.color) : undefined;

    return {
        id: uuid,
        legacyId: row?.legacyId ? String(row.legacyId) : undefined,
        uid: identity?.uid,
        name: row?.name ? String(row.name) : '',
        idNumber: row?.residentNumber ? String(row.residentNumber) : '',
        address: row?.address ? String(row.address) : undefined,
        contact: row?.phone ? String(row.phone) : undefined,
        email,
        role: row?.role ? String(row.role) : undefined,
        teamId,
        teamType: teamType || '미배정',
        teamName,
        status,
        unitPrice: typeof row?.unitPrice === 'number' ? row.unitPrice : 0,
        payType: row?.payType ? String(row.payType) : undefined,
        bankName: row?.bankName ? String(row.bankName) : undefined,
        accountNumber: row?.bankAccount ? String(row.bankAccount) : undefined,
        accountHolder: row?.accountHolder ? String(row.accountHolder) : undefined,
        fileNameSaved: row?.fileNameSaved ? String(row.fileNameSaved) : undefined,
        createdAt: toFirestoreTimestamp(row?.createdAt),
        updatedAt: toFirestoreTimestamp(row?.updatedAt),
        needsApproval: !!identity?.uid,
        totalManDay: typeof row?.totalManDay === 'number' ? row.totalManDay : undefined,
        salaryModel,
        employmentType: undefined,
        rank: undefined,
        siteId: undefined,
        siteName: undefined,
        companyId,
        companyName,
        leaderName: undefined,
        color,
        iconKey: undefined,
        signatureUrl: row?.signatureUrl ? String(row.signatureUrl) : undefined,
        bloodType: row?.bloodType ? String(row.bloodType) : undefined
    };
};

export const manpowerService = {
    // Get all workers (Paginated)
    getWorkersPaginated: async (limitCount: number, lastDoc: any = null): Promise<{ workers: Worker[], lastDoc: any }> => {
        try {
            await Promise.all([loadDcTeams(), loadDcCompanies(), loadDcWorkers()]);
            await loadDcWorkerDetails();
            const [workersRes, identityMap] = await Promise.all([listWorkers(dc), getWorkerIdentityMap()]);
            const rows = (workersRes as any)?.data?.workers ?? [];
            const mergedRows = rows.map((r: any) => ({
                ...(dcWorkerDetailById.get(String(r?.id ?? '')) ?? {}),
                ...r
            }));

            const mapped = mergedRows.map((r: any) => mapWorkerFromDc(r, identityMap.get(String(r?.id ?? ''))));
            mapped.sort((a: Worker, b: Worker) => {
                const at = a.createdAt?.toDate?.()?.getTime?.() ?? 0;
                const bt = b.createdAt?.toDate?.()?.getTime?.() ?? 0;
                return bt - at;
            });

            const lastId = typeof lastDoc === 'string'
                ? lastDoc
                : (lastDoc?.id ? String(lastDoc.id) : '');
            const startIndex = lastId ? Math.max(0, mapped.findIndex((w: Worker) => String(w.id) === lastId) + 1) : 0;
            const page = mapped.slice(startIndex, startIndex + limitCount);
            const nextLastDoc = page.length > 0 ? { id: page[page.length - 1].id } : null;

            return { workers: page, lastDoc: nextLastDoc };
        } catch (error) {
            console.error("Error fetching workers paginated:", error);
            throw error;
        }
    },

    // Find worker for manual linking
    findWorkerForLinking: async (name: string, idNumber: string): Promise<Worker | null> => {
        try {
            const normalizedName = String(name ?? '').trim();
            const normalizedId = String(idNumber ?? '').trim();
            if (!normalizedName || !normalizedId) return null;

            await Promise.all([loadDcTeams(), loadDcCompanies(), loadDcWorkers()]);
            await loadDcWorkerDetails();

            const [workersRes, identityMap] = await Promise.all([listWorkers(dc), getWorkerIdentityMap()]);
            const rows = (workersRes as any)?.data?.workers ?? [];
            const found = rows.find((r: any) =>
                String(r?.name ?? '').trim() === normalizedName && String(r?.residentNumber ?? '').trim() === normalizedId
            );
            if (!found) return null;

            const uuid = String(found?.id ?? '');
            if (!uuid) return null;

            const merged = { ...(dcWorkerDetailById.get(uuid) ?? {}), ...found };
            return mapWorkerFromDc(merged, identityMap.get(uuid));
        } catch (error) {
            console.error('Error finding worker for linking:', error);
            throw error;
        }
    },

    retireWorker: async (id: string): Promise<void> => {
        try {
            const uuid = await resolveWorkerUuid(id);
            if (!uuid) return;

            await updateWorker(dc, { id: uuid, isActive: false } as any);
            dcWorkersLoaded = false;
            dcWorkerDetailsLoaded = false;
            toast.updated('작업자');
        } catch (error) {
            console.error('Error retiring worker:', error);
            throw error;
        }
    },

    retireWorkers: async (ids: string[]): Promise<void> => {
        try {
            for (const id of ids) {
                const uuid = await resolveWorkerUuid(id);
                if (!uuid) continue;
                await updateWorker(dc, { id: uuid, isActive: false } as any);
            }
            dcWorkersLoaded = false;
            dcWorkerDetailsLoaded = false;
            toast.updated('작업자');
        } catch (error) {
            console.error('Error retiring workers batch:', error);
            throw error;
        }
    },

    // Get a single worker by ID
    getWorker: async (id: string): Promise<Worker | null> => {
        try {
            const uuid = await resolveWorkerUuid(id);
            if (!uuid) return null;

            await Promise.all([loadDcTeams(), loadDcCompanies(), loadDcWorkers()]);
            await loadDcWorkerDetails();
            const [res, identityMap] = await Promise.all([
                getWorker(dc, { id: uuid } as any),
                getWorkerIdentityMap()
            ]);
            const row = (res as any)?.data?.worker;
            if (!row) return null;

            const detail = dcWorkerDetailById.get(String(uuid)) ?? null;
            const merged = { ...(detail ?? {}), ...row };
            return mapWorkerFromDc(merged, identityMap.get(uuid));
        } catch (error) {
            console.error('Error fetching worker:', error);
            throw error;
        }
    },

    // Get all workers (Legacy - kept for compatibility if needed, but ideally replaced)
    getWorkers: async (): Promise<Worker[]> => {
        try {
            await Promise.all([loadDcTeams(), loadDcCompanies(), loadDcWorkers()]);
            await loadDcWorkerDetails();
            const [workersRes, identityMap] = await Promise.all([listWorkers(dc), getWorkerIdentityMap()]);
            const rows = (workersRes as any)?.data?.workers ?? [];
            const mergedRows = rows.map((r: any) => ({
                ...(dcWorkerDetailById.get(String(r?.id ?? '')) ?? {}),
                ...r
            }));

            const mapped = mergedRows.map((r: any) => mapWorkerFromDc(r, identityMap.get(String(r?.id ?? ''))));
            mapped.sort((a: Worker, b: Worker) => {
                const at = a.createdAt?.toDate?.()?.getTime?.() ?? 0;
                const bt = b.createdAt?.toDate?.()?.getTime?.() ?? 0;
                return bt - at;
            });
            return mapped;
        } catch (error) {
            console.error("Error fetching workers:", error);
            throw error;
        }
    },

    // Get workers by team for tax reporting
    getTaxReportWorkersByTeams: async (teamIds: string[]): Promise<Worker[]> => {
        try {
            if (!teamIds || teamIds.length === 0) return [];

            // 1. 기본 메타/Identity Map 확보
            await Promise.all([loadDcTeams(), loadDcCompanies()]);
            const [identityMap, workersRes] = await Promise.all([
                getWorkerIdentityMap(),
                listWorkers(dc)
            ]);

            const teamIdSet = new Set(
                teamIds
                    .map((id) => String(id ?? '').trim())
                    .filter((id) => id.length > 0)
            );
            const rows = (workersRes as any)?.data?.workers ?? [];

            const allWorkers: Worker[] = [];
            rows.forEach((row: any) => {
                const candidateTeamIds = [
                    row?.team?.id ? String(row.team.id).trim() : '',
                    row?.team?.legacyId ? String(row.team.legacyId).trim() : '',
                    row?.teamId ? String(row.teamId).trim() : '',
                    row?.legacyTeamId ? String(row.legacyTeamId).trim() : ''
                ].filter((id) => id.length > 0);
                const matchesTeam = candidateTeamIds.some((id) => teamIdSet.has(id));
                if (!matchesTeam) return;

                // 기본 정보 매핑
                allWorkers.push(mapWorkerFromDc(row, identityMap.get(String(row.id))));
            });

            return allWorkers;
        } catch (error) {
            console.error("Error fetching salary based workers by teams:", error);
            throw error;
        }
    },

    // 이메일로 Worker 조회
    getWorkerByEmail: async (email: string): Promise<Worker | null> => {
        try {
            const appUser = await findAppUserBy({ email });
            if (!appUser) return null;

            const linked = parseLinkedWorkerIds(appUser?.linkedWorkerIds);
            if (linked.length === 0) return null;

            const uuid = await resolveWorkerUuid(linked[0]);
            if (!uuid) return null;

            const worker = await manpowerService.getWorker(uuid);
            if (!worker) return null;
            return {
                ...worker,
                uid: appUser?.uid ? String(appUser.uid) : worker.uid,
                email: appUser?.email ? String(appUser.email) : worker.email
            };
        } catch (error) {
            console.error("Error finding worker by email:", error);
            throw error;
        }
    },

    // 이름으로 Worker 조회
    getWorkerByName: async (name: string): Promise<Worker | null> => {
        try {
            await Promise.all([loadDcTeams(), loadDcCompanies(), loadDcWorkers()]);
            const [workersRes, allWorkersRes, identityMap] = await Promise.all([
                listWorkers(dc),
                listAllWorkers(dc, { limit: 5000, offset: 0 } as any),
                getWorkerIdentityMap()
            ]);
            const rows = (workersRes as any)?.data?.workers ?? [];
            const found = rows.find((r: any) => String(r?.name ?? '') === String(name));
            if (!found) return null;
            const uuid = String(found?.id ?? '');

            const detailRows = (allWorkersRes as any)?.data?.workers ?? [];
            const detailById = new Map(detailRows.map((r: any) => [String(r?.id ?? ''), r] as const));
            const merged = { ...(detailById.get(uuid) ?? {}), ...found };

            return mapWorkerFromDc(merged, identityMap.get(uuid));
        } catch (error) {
            console.error("Error finding worker by name:", error);
            throw error;
        }
    },

    // Add a new worker with email validation
    addWorker: async (worker: Omit<Worker, 'id'>, checkEmail = true): Promise<string> => {
        try {
            const normalizedWorker: Omit<Worker, 'id'> = { ...worker };
            const mergedSalaryModel = normalizedWorker.salaryModel ?? normalizedWorker.payType;
            if (mergedSalaryModel !== undefined) {
                normalizedWorker.salaryModel = mergedSalaryModel;
                normalizedWorker.payType = mergedSalaryModel;
            }

            if (typeof normalizedWorker.iconKey !== 'string') {
                normalizedWorker.iconKey = '';
            }

            if (checkEmail && normalizedWorker.email) {
                const existingWorker = await manpowerService.getWorkerByEmail(normalizedWorker.email);
                if (existingWorker) {
                    throw new Error('이미 등록된 이메일입니다.');
                }
            }

            const teamUuid = await resolveTeamUuid(normalizedWorker.teamId);
            const status = normalizedWorker.status ? String(normalizedWorker.status) : '';
            const isActive = status === '퇴사' || status === 'inactive' || status === '출입금지' ? false : true;

            const legacyId = (normalizedWorker as any)?.legacyId;

            const name = String(normalizedWorker.name ?? '').trim();
            if (!name) {
                throw new Error('작업자 이름은 필수입니다.');
            }

            // Duplicate Check (Name, ResidentNumber, Phone MUST be unique)
            try {
                // Ensure latest list is loaded
                await loadDcWorkers();
                const workersRes = await listWorkers(dc);
                const existingRows = (workersRes as any)?.data?.workers ?? [];

                // 1. Name Check
                const nameConflict = existingRows.find((r: any) => String(r.name ?? '').trim() === name);
                if (nameConflict) {
                    throw new Error(`이미 등록된 이름입니다: ${name}`);
                }

                // 2. Resident Number Check
                const newIdNum = toNullableTrimmedString(normalizedWorker.idNumber);
                if (newIdNum) {
                    const conflict = existingRows.find((r: any) => String(r.residentNumber ?? '').trim() === newIdNum);
                    if (conflict) {
                        throw new Error(`이미 등록된 주민번호입니다: ${conflict.name || '이름없음'} (${newIdNum})`);
                    }
                }

                // 3. Phone Check
                const newContact = toNullableTrimmedString(normalizedWorker.contact);
                if (newContact) {
                    const conflict = existingRows.find((r: any) => String(r.phone ?? '').trim() === newContact);
                    if (conflict) {
                        throw new Error(`이미 등록된 연락처입니다: ${conflict.name || '이름없음'} (${newContact})`);
                    }
                }

            } catch (e: any) {
                if (e.message && e.message.startsWith('이미 등록된')) throw e;
                console.warn("Duplicate check failed, proceeding cautiously:", e);
            }


            const created = await createWorker(dc, {
                name,
                legacyId: legacyId ? String(legacyId) : null,
                teamId: teamUuid ?? null,
                role: toNullableTrimmedString(normalizedWorker.role),
                payType: toNullableTrimmedString(mergedSalaryModel),
                salaryModel: toNullableTrimmedString(normalizedWorker.salaryModel),
                unitPrice: typeof normalizedWorker.unitPrice === 'number' ? normalizedWorker.unitPrice : 0,
                totalManDay: typeof normalizedWorker.totalManDay === 'number' ? normalizedWorker.totalManDay : null,
                residentNumber: toNullableTrimmedString(normalizedWorker.idNumber),
                phone: toNullableTrimmedString(normalizedWorker.contact),
                address: toNullableTrimmedString(normalizedWorker.address),
                email: toNullableTrimmedString(normalizedWorker.email),
                bankAccount: toNullableTrimmedString(normalizedWorker.accountNumber),
                bankName: toNullableTrimmedString(normalizedWorker.bankName),
                accountHolder: toNullableTrimmedString(normalizedWorker.accountHolder),
                fileNameSaved: toNullableTrimmedString(normalizedWorker.fileNameSaved),
                signatureUrl: toNullableTrimmedString(normalizedWorker.signatureUrl),
                bloodType: toNullableTrimmedString(normalizedWorker.bloodType),
                statusText: toNullableTrimmedString(normalizedWorker.status),
                teamType: toNullableTrimmedString(normalizedWorker.teamType),
                companyName: toNullableTrimmedString(normalizedWorker.companyName),
                color: toNullableTrimmedString(normalizedWorker.color),
                isActive
            } as any);

            const workerId = (created as any)?.data?.worker_insert?.id ? String((created as any).data.worker_insert.id) : '';
            if (!workerId) throw new Error('Failed to create worker');

            if (normalizedWorker.uid || normalizedWorker.email) {
                await upsertAppUserLink({ uid: normalizedWorker.uid, email: normalizedWorker.email, workerId, displayName: normalizedWorker.name });
            }

            // Audit Log
            try {
                const { auditService } = await import('./auditService');
                await auditService.log({
                    action: 'CREATE_WORKER',
                    category: 'MANPOWER',
                    actorId: 'manager', // Placeholder
                    actorEmail: 'system', // Placeholder
                    targetId: workerId,
                    details: { name: worker.name }
                });
            } catch (e) { console.warn(e); }

            toast.saved('작업자', 1);
            dcWorkersLoaded = false;
            dcWorkerDetailsLoaded = false;
            return workerId;
        } catch (error) {
            console.error("Error adding worker:", error);
            throw new Error(getErrorMessage(error));
        }
    },

    // Update a worker with email validation
    updateWorker: async (id: string, updates: Partial<Worker>): Promise<void> => {
        try {
            const rawInputId = id ? String(id).trim() : '';
            // 이메일이 변경되는 경우 중복 체크
            if (updates.email) {
                const existingWorker = await manpowerService.getWorkerByEmail(updates.email);
                if (existingWorker && existingWorker.id !== id) {
                    throw new Error('이미 다른 계정에 등록된 이메일입니다.');
                }
            }

            const normalizedUpdates: Partial<Worker> = { ...updates };
            const mergedSalaryModel = normalizedUpdates.salaryModel ?? normalizedUpdates.payType;
            if (mergedSalaryModel !== undefined) {
                normalizedUpdates.salaryModel = mergedSalaryModel;
                normalizedUpdates.payType = mergedSalaryModel;
            }

            const uuid = await resolveWorkerUuid(rawInputId);
            if (!uuid) throw new Error(`존재하지 않는 근로자입니다. (id=${rawInputId || 'empty'})`);

            const teamUuid = normalizedUpdates.teamId !== undefined ? await resolveTeamUuid(normalizedUpdates.teamId) : undefined;
            const status = normalizedUpdates.status !== undefined ? String(normalizedUpdates.status) : undefined;
            const isActive = status === undefined
                ? undefined
                : (status === '퇴사' || status === 'inactive' || status === '출입금지' ? false : true);

            const vars: any = { id: uuid };
            if (normalizedUpdates.name !== undefined) {
                const trimmedName = String(normalizedUpdates.name).trim();
                if (!trimmedName) {
                    throw new Error('작업자 이름은 필수입니다.');
                }
                vars.name = trimmedName;
            }
            if (teamUuid !== undefined) vars.teamId = teamUuid ?? null;
            if (normalizedUpdates.role !== undefined) vars.role = toNullableTrimmedString(normalizedUpdates.role);
            if (mergedSalaryModel !== undefined) {
                vars.payType = toNullableTrimmedString(mergedSalaryModel);
                vars.salaryModel = toNullableTrimmedString(mergedSalaryModel);
            }
            if (normalizedUpdates.unitPrice !== undefined) vars.unitPrice = normalizedUpdates.unitPrice;
            if (normalizedUpdates.totalManDay !== undefined) vars.totalManDay = normalizedUpdates.totalManDay;
            if (normalizedUpdates.idNumber !== undefined) vars.residentNumber = toNullableTrimmedString(normalizedUpdates.idNumber);
            if (normalizedUpdates.contact !== undefined) vars.phone = toNullableTrimmedString(normalizedUpdates.contact);
            if (normalizedUpdates.address !== undefined) vars.address = toNullableTrimmedString(normalizedUpdates.address);
            if (normalizedUpdates.email !== undefined) vars.email = toNullableTrimmedString(normalizedUpdates.email);
            if (normalizedUpdates.accountNumber !== undefined) vars.bankAccount = toNullableTrimmedString(normalizedUpdates.accountNumber);
            if (normalizedUpdates.bankName !== undefined) vars.bankName = toNullableTrimmedString(normalizedUpdates.bankName);
            if (normalizedUpdates.accountHolder !== undefined) vars.accountHolder = toNullableTrimmedString(normalizedUpdates.accountHolder);
            if (normalizedUpdates.fileNameSaved !== undefined) vars.fileNameSaved = toNullableTrimmedString(normalizedUpdates.fileNameSaved);
            if (normalizedUpdates.signatureUrl !== undefined) vars.signatureUrl = toNullableTrimmedString(normalizedUpdates.signatureUrl);
            if (normalizedUpdates.bloodType !== undefined) vars.bloodType = toNullableTrimmedString(normalizedUpdates.bloodType);
            if (normalizedUpdates.status !== undefined) vars.statusText = toNullableTrimmedString(normalizedUpdates.status);
            if (normalizedUpdates.teamType !== undefined) vars.teamType = toNullableTrimmedString(normalizedUpdates.teamType);
            if (normalizedUpdates.companyName !== undefined) vars.companyName = toNullableTrimmedString(normalizedUpdates.companyName);
            if (normalizedUpdates.color !== undefined) vars.color = toNullableTrimmedString(normalizedUpdates.color);
            if (isActive !== undefined) vars.isActive = isActive;

            const hasMutationFields = Object.keys(vars).some((k) => k !== 'id');
            if (!hasMutationFields) {
                return;
            }

            await updateWorker(dc, vars as any);

            if (normalizedUpdates.uid || normalizedUpdates.email) {
                await upsertAppUserLink({ uid: normalizedUpdates.uid, email: normalizedUpdates.email, workerId: uuid, displayName: normalizedUpdates.name });
            }

            dcWorkersLoaded = false;
            dcWorkerDetailsLoaded = false;
        } catch (error) {
            console.error("Error updating worker:", error);
            throw error;
        }
    },

    // UID로 Worker 조회
    getWorkerByUid: async (uid: string): Promise<Worker | null> => {
        try {
            const appUser = await findAppUserBy({ uid });
            if (!appUser) return null;

            const linked = parseLinkedWorkerIds(appUser?.linkedWorkerIds);
            if (linked.length === 0) return null;

            const uuid = await resolveWorkerUuid(linked[0]);
            if (!uuid) return null;

            const worker = await manpowerService.getWorker(uuid);
            if (!worker) return null;
            return {
                ...worker,
                uid: appUser?.uid ? String(appUser.uid) : String(uid),
                email: appUser?.email ? String(appUser.email) : worker.email
            };
        } catch (error) {
            console.error("Error finding worker by UID:", error);
            throw error;
        }
    },

    // Link a worker to a UID
    linkWorkerToUid: async (workerId: string, uid: string): Promise<void> => {
        try {
            const uuid = await resolveWorkerUuid(workerId);
            if (!uuid) {
                throw new Error('존재하지 않는 근로자입니다.');
            }

            const existingLink = await manpowerService.getWorkerByUid(uid);
            if (existingLink && String(existingLink.id) !== String(workerId)) {
                throw new Error('이미 다른 근로자 프로필이 연결되어 있습니다.');
            }

            await upsertAppUserLink({ uid, workerId: uuid });
        } catch (error) {
            console.error("Error linking worker:", error);
            throw error;
        }
    },
    deleteWorker: async (id: string): Promise<void> => {
        try {
            const uuid = await resolveWorkerUuid(id);
            if (!uuid) return;

            // Storage cleanup: file path is stored in Data Connect now.
            try {
                const res = await getWorker(dc, { id: uuid } as any);
                const row = (res as any)?.data?.worker;
                const path = row?.fileNameSaved ? String(row.fileNameSaved) : '';
                if (path) {
                    await deleteObject(ref(storage, path));
                }
            } catch (e) {
                console.warn('Failed to delete worker file from storage:', e);
            }

            await unlinkWorkerFromAppUsers(uuid, id);
            await deleteWorkerDc(dc, { id: uuid } as any);
            dcWorkersLoaded = false;
            dcWorkerDetailsLoaded = false;
            toast.deleted('작업자', 1);

            // Audit Log
            try {
                const { auditService } = await import('./auditService');
                await auditService.log({
                    action: 'DELETE_WORKER',
                    category: 'MANPOWER',
                    actorId: 'manager', // Placeholder
                    actorEmail: 'system', // Placeholder
                    targetId: id,
                    details: { deletedFile: false }
                });
            } catch (e) { console.warn(e); }

        } catch (error) {
            console.error("Error deleting worker:", error);
            throw error;
        }
    },

    // Increment total man-day for a worker
    incrementManDay: async (workerId: string, amount: number): Promise<void> => {
        try {
            if (!workerId) return;
            if (!Number.isFinite(amount) || amount === 0) return;

            const uuid = await resolveWorkerUuid(workerId);
            if (!uuid) {
                console.warn('[DataConnect] Worker not found for incrementManDay', { workerId, amount });
                return;
            }

            const res = await getWorker(dc, { id: uuid } as any);
            const row = (res as any)?.data?.worker;
            const current = typeof row?.totalManDay === 'number' ? row.totalManDay : 0;
            await updateWorker(dc, { id: uuid, totalManDay: current + amount } as any);
        } catch (error) {
            console.error(`Error incrementing man-day for worker ${workerId}:`, error);
            // We don't throw here to prevent failing the entire batch if one fails, 
            // but in a real app we might want better error handling/rollback.
        }
    },

    // Delete multiple workers
    deleteWorkers: async (ids: string[]): Promise<void> => {
        try {
            for (const id of ids) {
                const uuid = await resolveWorkerUuid(id);
                if (!uuid) continue;

                try {
                    const res = await getWorker(dc, { id: uuid } as any);
                    const row = (res as any)?.data?.worker;
                    const path = row?.fileNameSaved ? String(row.fileNameSaved) : '';
                    if (path) {
                        await deleteObject(ref(storage, path));
                    }
                } catch (e) {
                    console.warn('Failed to delete worker file from storage:', e);
                }

                await unlinkWorkerFromAppUsers(uuid, id);
                await deleteWorkerDc(dc, { id: uuid } as any);
            }

            dcWorkersLoaded = false;
            dcWorkerDetailsLoaded = false;
            toast.deleted('작업자', ids.length);

            // Audit Log (Batch log or individual logs? For simplicity, one log entry for the batch)
            try {
                const { auditService } = await import('./auditService');
                await auditService.log({
                    action: 'DELETE_WORKER_BATCH',
                    category: 'MANPOWER',
                    actorId: 'manager', // Placeholder
                    actorEmail: 'system', // Placeholder
                    targetId: 'batch',
                    details: { count: ids.length, ids }
                });
            } catch (e) { console.warn(e); }

        } catch (error) {
            console.error("Error deleting workers batch:", error);
            throw error;
        }
    },

    // Update multiple workers
    updateWorkersBatch: async (ids: string[], updates: Partial<Worker>): Promise<void> => {
        try {
            const normalizedUpdates: Partial<Worker> = { ...updates };
            const mergedSalaryModel = normalizedUpdates.salaryModel ?? normalizedUpdates.payType;
            if (mergedSalaryModel !== undefined) {
                normalizedUpdates.salaryModel = mergedSalaryModel;
                normalizedUpdates.payType = mergedSalaryModel;
            }

            const teamUuid = normalizedUpdates.teamId !== undefined ? await resolveTeamUuid(normalizedUpdates.teamId) : undefined;
            const status = normalizedUpdates.status !== undefined ? String(normalizedUpdates.status) : undefined;
            const isActive = status === undefined
                ? undefined
                : (status === '퇴사' || status === 'inactive' || status === '출입금지' ? false : true);

            for (const id of ids) {
                const uuid = await resolveWorkerUuid(id);
                if (!uuid) continue;

                const vars: any = { id: uuid };
                if (normalizedUpdates.name !== undefined) vars.name = normalizedUpdates.name;
                if (teamUuid !== undefined) vars.teamId = teamUuid ?? null;
                if (normalizedUpdates.role !== undefined) vars.role = normalizedUpdates.role;
                if (mergedSalaryModel !== undefined) vars.payType = mergedSalaryModel;
                if (normalizedUpdates.unitPrice !== undefined) vars.unitPrice = normalizedUpdates.unitPrice;
                if (normalizedUpdates.totalManDay !== undefined) vars.totalManDay = normalizedUpdates.totalManDay;
                if (normalizedUpdates.idNumber !== undefined) vars.residentNumber = normalizedUpdates.idNumber;
                if (normalizedUpdates.contact !== undefined) vars.phone = normalizedUpdates.contact;
                if (normalizedUpdates.address !== undefined) vars.address = normalizedUpdates.address;
                if (normalizedUpdates.accountNumber !== undefined) vars.bankAccount = normalizedUpdates.accountNumber;
                if (normalizedUpdates.bankName !== undefined) vars.bankName = normalizedUpdates.bankName;
                if (normalizedUpdates.accountHolder !== undefined) vars.accountHolder = normalizedUpdates.accountHolder;
                if (normalizedUpdates.fileNameSaved !== undefined) vars.fileNameSaved = normalizedUpdates.fileNameSaved;
                if (normalizedUpdates.signatureUrl !== undefined) vars.signatureUrl = normalizedUpdates.signatureUrl;
                if (normalizedUpdates.bloodType !== undefined) vars.bloodType = normalizedUpdates.bloodType;
                if (isActive !== undefined) vars.isActive = isActive;

                const hasMutationFields = Object.keys(vars).some((k) => k !== 'id');
                if (!hasMutationFields) continue;

                await updateWorker(dc, vars as any);
            }

            dcWorkersLoaded = false;
            dcWorkerDetailsLoaded = false;
            toast.updated('작업자');

            // Audit Log
            try {
                const { auditService } = await import('./auditService');
                await auditService.log({
                    action: 'UPDATE_WORKER_BATCH',
                    category: 'MANPOWER',
                    actorId: 'manager', // Placeholder
                    actorEmail: 'system', // Placeholder
                    targetId: 'batch',
                    details: { count: ids.length, ids, updates }
                });
            } catch (e) { console.warn(e); }

        } catch (error) {
            console.error("Error updating workers batch:", error);
            throw error;
        }
    },

    // --- Data Synchronization Methods ---

    // Helper: Batch update workers based on a query
    batchUpdateByQuery: async (q: any, updates: Partial<Worker>): Promise<void> => {
        try {
            // Data Connect로 전환되면서 Firestore Query 기반 배치 업데이트는 더 이상 지원하지 않습니다.
            // 기존 API 호환을 위해 no-op로 유지합니다.
            void q;
            void updates;
            return;
        } catch (error) {
            console.error("Error in batchUpdateByQuery:", error);
            throw error; // Propagate error or handle silently? Propagate for now.
        }
    },

    // Update Team Name for all related workers
    updateWorkersTeamName: async (teamId: string, teamName: string) => {
        // Data Connect에서는 Worker.teamName을 denormalize하지 않고 Team 관계로 표시합니다.
        void teamId;
        void teamName;
    },

    updateWorkersSalaryModelByTeam: async (teamId: string, salaryModel: string) => {
        const teamUuid = await resolveTeamUuid(teamId);
        if (!teamUuid) return;
        const res = await listWorkers(dc);
        const rows = (res as any)?.data?.workers ?? [];
        const targets = rows.filter((w: any) => String(w?.team?.id ?? '') === String(teamUuid));
        for (const w of targets) {
            const workerUuid = w?.id ? String(w.id) : '';
            if (!workerUuid) continue;
            await updateWorker(dc, { id: workerUuid, payType: salaryModel } as any);
        }
        dcWorkersLoaded = false;
        dcWorkerDetailsLoaded = false;
    },

    // Update Site Name for all related workers
    updateWorkersSiteName: async (siteId: string, siteName: string) => {
        // 현재 Data Connect Worker 스키마에는 siteId/siteName이 없어 동기화할 수 없습니다.
        void siteId;
        void siteName;
    },

    // Update Company Name for all related workers
    updateWorkersCompanyName: async (companyId: string, companyName: string) => {
        // Data Connect에서는 Worker.companyName을 denormalize하지 않고 Team->Company 관계로 표시합니다.
        void companyId;
        void companyName;
    },

    // Sync all workers in partner company teams to have teamType='지원팀'
    syncPartnerCompanyWorkersTeamType: async (): Promise<{ updated: number, errors: string[] }> => {
        const errors: string[] = [];
        let updatedCount = 0;

        try {
            const companiesRes = await listCompanies(dc);
            const companies = (companiesRes as any)?.data?.companies ?? [];
            const partnerCompanyUuids = companies
                .filter((c: any) => String(c?.type ?? '') === '협력사')
                .map((c: any) => String(c?.id ?? ''))
                .filter(Boolean);

            if (partnerCompanyUuids.length === 0) {
                return { updated: 0, errors: ['협력사가 없습니다.'] };
            }

            const teamsRes = await listTeams(dc);
            const teams = (teamsRes as any)?.data?.teams ?? [];
            const partnerTeamUuids = new Set(
                teams
                    .filter((t: any) => partnerCompanyUuids.includes(String(t?.company?.id ?? '')))
                    .map((t: any) => String(t?.id ?? ''))
                    .filter(Boolean)
            );

            if (partnerTeamUuids.size === 0) {
                return { updated: 0, errors: ['협력사 소속 팀이 없습니다.'] };
            }

            const workersRes = await listWorkers(dc);
            const workers = (workersRes as any)?.data?.workers ?? [];
            const targets = workers.filter((w: any) => partnerTeamUuids.has(String(w?.team?.id ?? '')));

            for (const w of targets) {
                const workerUuid = w?.id ? String(w.id) : '';
                if (!workerUuid) continue;
                const currentPayType = w?.payType ? String(w.payType) : '';
                if (currentPayType === '지원팀') continue;
                await updateWorker(dc, { id: workerUuid, payType: '지원팀' } as any);
                updatedCount += 1;
            }

            dcWorkersLoaded = false;
            dcWorkerDetailsLoaded = false;
            return { updated: updatedCount, errors };
        } catch (error) {
            console.error('Error syncing partner company workers:', error);
            errors.push(`동기화 중 오류 발생: ${error}`);
            return { updated: updatedCount, errors };
        }
    }
};
