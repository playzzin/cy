import {
    listAllAdvancePayments,
    createAdvancePayment,
    updateAdvancePayment,
    deleteAdvancePayment,
    listAllWorkers,
    listAllTeams
} from '../services/firestoreCrudCompat';

export interface AdvancePayment {
    id?: string;
    workerId: string;
    workerName: string;
    teamId: string;
    teamName: string;
    yearMonth: string; // "YYYY-MM"

    // Dynamic deduction items (custom fields)
    items?: Record<string, number>;
    
    // Per-item assignment types: item key -> 'corporate' | 'labor'
    itemAssignments?: Record<string, 'corporate' | 'labor'>;

    // Explicit Columns
    prevMonthCarryover: number; // 전월이월
    accommodation: number;      // 숙소비
    privateRoom: number;        // 개인방
    gloves: number;            // 장갑
    deposit: number;           // 보증금
    fines: number;             // 과태료
    electricity: number;       // 전기료
    gas: number;               // 도시가스
    internet: number;          // 인터넷
    water: number;             // 수도료

    totalDeduction: number;    // 공제 합계 (Calculated)
    assignmentType?: 'corporate' | 'labor'; // 분류: 법인(corporate) / 노무(labor) - Legacy row-level field
    memo?: string;
    updatedAt?: Date;
}

const isUuidString = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

let dcWorkersLoaded = false;
let dcTeamsLoaded = false;

const dcWorkerLegacyIdToUuid = new Map<string, string>();
const dcTeamLegacyIdToUuid = new Map<string, string>();

const loadDcWorkers = async (): Promise<void> => {
    if (dcWorkersLoaded) return;

    const limit = 500;
    let offset = 0;
    const rows: any[] = [];

    while (true) {
        const res = await listAllWorkers({ limit, offset } as any);
        const pageRows = (res as any)?.data?.workers ?? [];
        if (Array.isArray(pageRows)) rows.push(...pageRows);
        if (!Array.isArray(pageRows) || pageRows.length < limit) break;
        offset += limit;
    }

    if (rows.length === 0) {
        const fallbackRes = await listAllWorkers();
        const fallbackRows = (fallbackRes as any)?.data?.workers ?? [];
        if (Array.isArray(fallbackRows)) rows.push(...fallbackRows);
    }

    dcWorkerLegacyIdToUuid.clear();
    rows.forEach((w: any) => {
        const id = w?.id ? String(w.id) : '';
        const legacyId = w?.legacyId ? String(w.legacyId) : '';
        if (id) dcWorkerLegacyIdToUuid.set(id, id);
        if (legacyId) dcWorkerLegacyIdToUuid.set(legacyId, id);
    });
    dcWorkersLoaded = true;
};

const loadDcTeams = async (): Promise<void> => {
    if (dcTeamsLoaded) return;

    const limit = 500;
    let offset = 0;
    const rows: any[] = [];

    while (true) {
        const res = await listAllTeams({ limit, offset } as any);
        const pageRows = (res as any)?.data?.teams ?? [];
        if (Array.isArray(pageRows)) rows.push(...pageRows);
        if (!Array.isArray(pageRows) || pageRows.length < limit) break;
        offset += limit;
    }

    if (rows.length === 0) {
        const fallbackRes = await listAllTeams();
        const fallbackRows = (fallbackRes as any)?.data?.teams ?? [];
        if (Array.isArray(fallbackRows)) rows.push(...fallbackRows);
    }

    dcTeamLegacyIdToUuid.clear();
    rows.forEach((t: any) => {
        const id = t?.id ? String(t.id) : '';
        const legacyId = t?.legacyId ? String(t.legacyId) : '';
        if (id) dcTeamLegacyIdToUuid.set(id, id);
        if (legacyId) dcTeamLegacyIdToUuid.set(legacyId, id);
    });
    dcTeamsLoaded = true;
};

const resolveWorkerUuid = async (id: string): Promise<string | null> => {
    const raw = id ? String(id) : '';
    if (!raw) return null;
    if (isUuidString(raw)) return raw;
    await loadDcWorkers();
    const found = dcWorkerLegacyIdToUuid.get(raw);
    if (found) return found;
    dcWorkersLoaded = false;
    await loadDcWorkers();
    return dcWorkerLegacyIdToUuid.get(raw) ?? null;
};

const resolveTeamUuid = async (id: string): Promise<string | null> => {
    const raw = id ? String(id) : '';
    if (!raw) return null;
    if (isUuidString(raw)) return raw;
    await loadDcTeams();
    const found = dcTeamLegacyIdToUuid.get(raw);
    if (found) return found;
    dcTeamsLoaded = false;
    await loadDcTeams();
    return dcTeamLegacyIdToUuid.get(raw) ?? null;
};

const safeJsonParseAssignmentRecord = (value: unknown): Record<string, 'corporate' | 'labor'> => {
    if (!value || typeof value !== 'string') return {};
    const raw = value.trim();
    if (!raw) return {};
    try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
        return Object.fromEntries(
            Object.entries(parsed as Record<string, unknown>)
                .filter(([k, v]) => typeof k === 'string' && k.trim().length > 0 && (v === 'corporate' || v === 'labor'))
                .map(([k, v]) => [k, v as 'corporate' | 'labor'] as const)
        );
    } catch {
        return {};
    }
};

const safeJsonParseRecord = (value: unknown): Record<string, number> => {
    if (!value || typeof value !== 'string') return {};
    const raw = value.trim();
    if (!raw) return {};
    try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
        return Object.fromEntries(
            Object.entries(parsed as Record<string, unknown>)
                .filter(([k]) => typeof k === 'string' && k.trim().length > 0)
                .map(([k, v]) => [k, typeof v === 'number' && Number.isFinite(v) ? v : 0] as const)
        );
    } catch {
        return {};
    }
};

const normalizeItems = (items?: Record<string, number>): Record<string, number> => {
    if (!items) return {};
    return Object.fromEntries(
        Object.entries(items)
            .filter(([k]) => typeof k === 'string' && k.trim().length > 0)
            .map(([k, v]) => [k, Number.isFinite(v) ? v : 0] as const)
    );
};

const parseAdvancePaymentCompositeId = (
    rawId: string
): { teamId: string; workerId: string; yearMonth: string } | null => {
    const id = String(rawId ?? '').trim();
    if (!id) return null;

    const parts = id.split('_');
    if (parts.length < 3) return null;

    const yearMonth = parts[parts.length - 1];
    const workerId = parts[parts.length - 2];
    const teamId = parts.slice(0, parts.length - 2).join('_');

    if (!yearMonth || !workerId || !teamId) return null;
    if (!/^\d{4}-\d{2}$/.test(yearMonth)) return null;

    return { teamId, workerId, yearMonth };
};

const toDate = (value?: string | null): Date | undefined => {
    const raw = value ? String(value) : '';
    if (!raw) return undefined;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return undefined;
    return d;
};

const isAlreadyExistsError = (error: unknown): boolean => {
    if (!error) return false;
    const asAny = error as any;
    const messageFromError = error instanceof Error ? error.message : '';
    const messageFromField = typeof asAny?.message === 'string' ? asAny.message : '';
    const normalized = `${messageFromError} | ${messageFromField}`.toLowerCase();
    return normalized.includes('already') && normalized.includes('exists') || normalized.includes('duplicate');
};

const isOpaqueSqlFailureOnAdvancePaymentInsert = (error: unknown): boolean => {
    const message = error instanceof Error ? error.message : '';
    const normalized = String(message).toLowerCase();
    return (normalized.includes('partial-error') || normalized.includes('sql execution failed'))
        && (normalized.includes('advancepayment') || normalized.includes('insert'));
};

export const advancePaymentService = {
    getAdvancePayments: async (year: number, month: number, teamId: string): Promise<AdvancePayment[]> => {
        try {
            const yearMonth = `${year}-${String(month).padStart(2, '0')}`;
            const safeTeamId = String(teamId ?? '').trim();
            const teamUuid = await resolveTeamUuid(safeTeamId);
            const res = await listAllAdvancePayments();
            const rows = (res as any)?.data?.advancePayments ?? [];

            return rows
                .filter((row: any) => {
                    if (String(row?.yearMonth ?? '') !== String(yearMonth)) return false;

                    const parsed = parseAdvancePaymentCompositeId(String(row?.id ?? ''));
                    const dcTeamId = row?.team?.id ? String(row.team.id).trim() : '';
                    const dcTeamLegacyId = row?.team?.legacyId ? String(row.team.legacyId).trim() : '';
                    const flatTeamId = row?.teamId ? String(row.teamId).trim() : '';
                    const parsedTeamId = parsed?.teamId ? String(parsed.teamId).trim() : '';

                    const candidateTeamIds = new Set<string>(
                        [dcTeamId, dcTeamLegacyId, flatTeamId, parsedTeamId].filter((v) => Boolean(v))
                    );

                    if (!safeTeamId && !teamUuid) return true;
                    if (safeTeamId && candidateTeamIds.has(safeTeamId)) return true;
                    if (teamUuid && candidateTeamIds.has(teamUuid)) return true;
                    return false;
                })
                .map((row: any) => {
                    const parsed = parseAdvancePaymentCompositeId(String(row?.id ?? ''));
                    const rawItems = safeJsonParseRecord(row?.items);
                    return {
                        id: String(row?.id ?? ''),
                        workerId:
                            row?.worker?.legacyId
                                ? String(row.worker.legacyId)
                                : String(row?.worker?.id ?? row?.workerId ?? (parsed?.workerId ?? '')),
                        workerName: row?.workerName ? String(row.workerName) : (row?.worker?.name ? String(row.worker.name) : ''),
                        teamId:
                            row?.team?.legacyId
                                ? String(row.team.legacyId)
                                : String(row?.team?.id ?? row?.teamId ?? (parsed?.teamId ?? '')),
                        teamName: row?.teamName ? String(row.teamName) : (row?.team?.name ? String(row.team.name) : ''),
                        yearMonth: String(row?.yearMonth ?? (parsed?.yearMonth ?? '')),
                        items: rawItems,
                        prevMonthCarryover: typeof row?.prevMonthCarryover === 'number' ? row.prevMonthCarryover : 0,
                        accommodation: typeof row?.accommodation === 'number' ? row.accommodation : 0,
                        privateRoom: typeof row?.privateRoom === 'number' ? row.privateRoom : 0,
                        gloves: typeof row?.gloves === 'number' ? row.gloves : 0,
                        deposit: typeof row?.deposit === 'number' ? row.deposit : 0,
                        fines: typeof row?.fines === 'number' ? row.fines : 0,
                        electricity: typeof row?.electricity === 'number' ? row.electricity : 0,
                        gas: typeof row?.gas === 'number' ? row.gas : 0,
                        internet: typeof row?.internet === 'number' ? row.internet : 0,
                        water: typeof row?.water === 'number' ? row.water : 0,
                        totalDeduction: typeof row?.totalDeduction === 'number' ? row.totalDeduction : 0,
                        itemAssignments: safeJsonParseAssignmentRecord(row?.itemAssignments),
                        assignmentType: row?.assignmentType ? (String(row.assignmentType) as 'corporate' | 'labor') : 'labor',
                        memo: row?.memo ? String(row.memo) : '',
                        updatedAt: toDate(row?.updatedAt)
                    } as AdvancePayment;
                });
        } catch (error) {
            console.error("Error fetching advance payments:", error);
            throw error;
        }
    },

    getAdvancePaymentsByYearMonth: async (year: number, month: number): Promise<AdvancePayment[]> => {
        try {
            const yearMonth = `${year}-${String(month).padStart(2, '0')}`;
            const res = await listAllAdvancePayments();
            const rows = (res as any)?.data?.advancePayments ?? [];

            return rows
                .filter((row: any) => String(row?.yearMonth ?? '') === String(yearMonth))
                .map((row: any) => {
                    const parsed = parseAdvancePaymentCompositeId(String(row?.id ?? ''));
                    const rawItems = safeJsonParseRecord(row?.items);
                    return {
                        id: String(row?.id ?? ''),
                        workerId:
                            row?.worker?.legacyId
                                ? String(row.worker.legacyId)
                                : String(row?.worker?.id ?? row?.workerId ?? (parsed?.workerId ?? '')),
                        workerName: row?.workerName ? String(row.workerName) : (row?.worker?.name ? String(row.worker.name) : ''),
                        teamId:
                            row?.team?.legacyId
                                ? String(row.team.legacyId)
                                : String(row?.team?.id ?? row?.teamId ?? (parsed?.teamId ?? '')),
                        teamName: row?.teamName ? String(row.teamName) : (row?.team?.name ? String(row.team.name) : ''),
                        yearMonth: String(row?.yearMonth ?? (parsed?.yearMonth ?? '')),
                        items: rawItems,
                        prevMonthCarryover: typeof row?.prevMonthCarryover === 'number' ? row.prevMonthCarryover : 0,
                        accommodation: typeof row?.accommodation === 'number' ? row.accommodation : 0,
                        privateRoom: typeof row?.privateRoom === 'number' ? row.privateRoom : 0,
                        gloves: typeof row?.gloves === 'number' ? row.gloves : 0,
                        deposit: typeof row?.deposit === 'number' ? row.deposit : 0,
                        fines: typeof row?.fines === 'number' ? row.fines : 0,
                        electricity: typeof row?.electricity === 'number' ? row.electricity : 0,
                        gas: typeof row?.gas === 'number' ? row.gas : 0,
                        internet: typeof row?.internet === 'number' ? row.internet : 0,
                        water: typeof row?.water === 'number' ? row.water : 0,
                        totalDeduction: typeof row?.totalDeduction === 'number' ? row.totalDeduction : 0,
                        itemAssignments: safeJsonParseAssignmentRecord(row?.itemAssignments),
                        assignmentType: row?.assignmentType ? (String(row.assignmentType) as 'corporate' | 'labor') : 'labor',
                        memo: row?.memo ? String(row.memo) : '',
                        updatedAt: toDate(row?.updatedAt)
                    } as AdvancePayment;
                });
        } catch (error) {
            console.error("Error fetching advance payments by yearMonth:", error);
            throw error;
        }
    },

    saveAdvancePayment: async (data: AdvancePayment) => {
        try {
            const safeTeamId = String(data.teamId ?? '').trim();
            const safeWorkerId = String(data.workerId ?? '').trim();
            const safeYearMonth = String(data.yearMonth ?? '').trim();
            const docId = `${safeTeamId}_${safeWorkerId}_${safeYearMonth}`;
            const [teamUuid, workerUuid] = await Promise.all([
                resolveTeamUuid(safeTeamId),
                resolveWorkerUuid(safeWorkerId)
            ]);

            const resolvedTeamId = teamUuid ?? safeTeamId;
            const resolvedWorkerId = workerUuid ?? safeWorkerId;

            if (!resolvedTeamId) {
                throw new Error('팀 ID가 비어 있어 저장할 수 없습니다.');
            }

            if (!teamUuid) {
                console.warn('[advancePaymentService.saveAdvancePayment] Team UUID resolve failed. Fallback to raw teamId.', {
                    teamId: safeTeamId,
                    yearMonth: safeYearMonth,
                });
            }

            if (!workerUuid) {
                console.warn('[advancePaymentService.saveAdvancePayment] Worker UUID resolve failed. Fallback to raw workerId.', {
                    workerId: safeWorkerId,
                    yearMonth: safeYearMonth,
                });
            }
            
            const normalizedItems = normalizeItems(data.items);

            const payload: any = {
                id: docId,
                yearMonth: safeYearMonth,
                workerId: resolvedWorkerId || null,
                workerName: data.workerName ?? null,
                teamId: resolvedTeamId,
                teamName: data.teamName ?? null,
                items: JSON.stringify(normalizedItems),
                prevMonthCarryover: data.prevMonthCarryover ?? 0,
                accommodation: data.accommodation ?? 0,
                privateRoom: data.privateRoom ?? 0,
                gloves: data.gloves ?? 0,
                deposit: data.deposit ?? 0,
                fines: data.fines ?? 0,
                electricity: data.electricity ?? 0,
                gas: data.gas ?? 0,
                internet: data.internet ?? 0,
                water: data.water ?? 0,
                totalDeduction: data.totalDeduction ?? 0,
                itemAssignments: JSON.stringify(data.itemAssignments ?? {}),
                assignmentType: data.assignmentType ?? 'labor',
                memo: data.memo ?? null,
                updatedAt: new Date().toISOString()
            };

            try {
                await createAdvancePayment(payload);
            } catch (error) {
                if (isAlreadyExistsError(error) || isOpaqueSqlFailureOnAdvancePaymentInsert(error)) {
                    await updateAdvancePayment(payload);
                } else {
                    throw error;
                }
            }
            return docId;
        } catch (error) {
            console.error("Error saving advance payment:", error);
            throw error;
        }
    },

    deleteAdvancePayment: async (id: string) => {
        try {
            if (!id) return;
            await deleteAdvancePayment({ id } as any);
        } catch (error) {
            console.error("Error deleting advance payment:", error);
            throw error;
        }
    }
};
