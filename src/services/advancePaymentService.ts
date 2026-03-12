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

    // Explicit Columns from Image
    prevMonthCarryover: number; // ?꾩썡?댁썡
    accommodation: number;      // ?숈냼鍮?
    privateRoom: number;        // 媛쒖씤諛?
    gloves: number;            // ?κ컩
    deposit: number;           // 蹂댁쬆湲?
    fines: number;             // 怨쇳깭猷?
    electricity: number;       // ?꾧린猷?
    gas: number;               // ?꾩떆媛??
    internet: number;          // ?명꽣??
    water: number;             // ?섎룄??

    totalDeduction: number;    // 怨듭젣 ?⑷퀎 (Calculated)
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
        // fallback: generated query媛 ?섍꼍???곕씪 ?쒗븳???덉쓣 ???덉쑝誘濡?湲곗〈 listWorkers???쒕룄
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
        // fallback
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

    // Expected: {teamId}_{workerId}_{YYYY-MM}
    // teamId/workerId ?먯껜??'_'媛 ?ы븿??媛?μ꽦????떎???꾩젣(?꾪뻾 ?앹꽦 濡쒖쭅 湲곗?)
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
    const codeFromField = typeof asAny?.code === 'string' ? asAny.code : (typeof asAny?.code === 'number' ? String(asAny.code) : '');
    const detailsFromField = typeof asAny?.details === 'string' ? asAny.details : '';

    // Backend / GraphQL ?먮윭 ?곸꽭 (errors 諛곗뿴) ?뺤씤
    const errorsFromField = Array.isArray(asAny?.errors) ? (asAny.errors as any[]) : [];
    const errorDetails = errorsFromField
        .map(err => {
            const msg = err?.message || '';
            const extCode = err?.extensions?.code || '';
            const extDetails = err?.extensions?.details ? JSON.stringify(err.extensions.details) : '';
            return `${msg} | ${extCode} | ${extDetails}`;
        })
        .join(' || ');

    const fallback = (() => {
        try {
            return JSON.stringify(error);
        } catch {
            return String(error ?? '');
        }
    })();

    const normalized = [
        messageFromError,
        messageFromField,
        detailsFromField,
        codeFromField,
        errorDetails,
        fallback
    ]
        .filter(Boolean)
        .join(' | ')
        .toLowerCase();

    // 以묐났 愿???ㅼ썙??????뺤옣
    const hasAlreadyExists = normalized.includes('already') && normalized.includes('exists');
    const hasDuplicate = normalized.includes('duplicate');
    const hasUnique = normalized.includes('unique');
    const hasPrimaryKey = normalized.includes('primary') && normalized.includes('key');
    const hasConstraint = normalized.includes('constraint');
    const hasViolation = normalized.includes('violation');
    const hasConflict = normalized.includes('409') || normalized.includes('conflict');

    return hasAlreadyExists || hasDuplicate || hasUnique || hasPrimaryKey || hasConstraint || hasViolation || hasConflict;
};

const isOpaqueSqlFailureOnAdvancePaymentInsert = (error: unknown): boolean => {
    const message = error instanceof Error ? error.message : '';

    const fallback = (() => {
        try {
            return JSON.stringify(error);
        } catch {
            return String(error ?? '');
        }
    })();

    const normalized = `${message} | ${fallback}`.toLowerCase();

    // 백엔드媛 DB ?곸꽭瑜??④만 ???뱀? SQL ?ㅽ뻾 ?먯껜媛 ?ㅽ뙣?덉쓣 ??
    return (normalized.includes('partial-error') || normalized.includes('sql execution failed'))
        && (normalized.includes('advancepayment') || normalized.includes('insert'));
};

export const advancePaymentService = {
    // Get list by Year-Month and Team
    getAdvancePayments: async (year: number, month: number, teamId: string): Promise<AdvancePayment[]> => {
        try {
            const yearMonth = `${year}-${String(month).padStart(2, '0')}`;
            const teamUuid = await resolveTeamUuid(teamId);
            const res = await listAllAdvancePayments();
            const rows = (res as any)?.data?.advancePayments ?? [];

            return rows
                .filter((row: any) => {
                    if (String(row?.yearMonth ?? '') !== String(yearMonth)) return false;
                    const dcTeamId = row?.team?.id ? String(row.team.id) : '';
                    const dcTeamLegacyId = row?.team?.legacyId ? String(row.team.legacyId) : '';
                    if (teamId && (dcTeamId === teamId || dcTeamLegacyId === teamId)) return true;
                    return teamUuid ? dcTeamId === teamUuid : false;
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
                        memo: row?.memo ? String(row.memo) : '',
                        updatedAt: toDate(row?.updatedAt)
                    } as AdvancePayment;
                });
        } catch (error) {
            console.error("Error fetching advance payments by yearMonth:", error);
            throw error;
        }
    },

    // Save (Update/Insert) Logic
    // Using a composite ID (teamId_workerId_yearMonth) to prevent duplicates per worker per month
    saveAdvancePayment: async (data: AdvancePayment) => {
        try {
            // Create a unique ID if not provided, or ensure uniqueness
            // Format: {teamId}_{workerId}_{yearMonth}
            const docId = `${data.teamId}_${data.workerId}_${data.yearMonth}`;
            const [teamUuid, workerUuid] = await Promise.all([
                resolveTeamUuid(data.teamId),
                resolveWorkerUuid(data.workerId)
            ]);
            if (!teamUuid) throw new Error('議댁옱?섏? ?딅뒗 ??낅땲??');
            if (!workerUuid) {
                // 백엔드??Worker UUID 留ㅽ븨???꾨씫?섏뼱??legacyId 誘몄씠愿/limit ?? ?댁쁺????μ씠 源⑥?吏 ?딅룄濡??덉슜
                // workerId FK??nullable?대?濡?null濡???ν븯怨? ?붾㈃/議고쉶??composite id?먯꽌 legacy workerId瑜?蹂듭썝?쒕떎.
                console.warn('[advancePaymentService.saveAdvancePayment] Worker UUID resolve failed. Saving with workerId=null.', {
                    legacyWorkerId: data.workerId,
                    docId
                });
            }

            const normalizedItems = normalizeItems(data.items);

            const payload: any = {
                id: docId,
                yearMonth: data.yearMonth,
                workerId: workerUuid,
                workerName: data.workerName ?? null,
                teamId: teamUuid,
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
                memo: data.memo ?? null,
                updatedAt: new Date().toISOString()
            };

            if (!workerUuid) {
                payload.workerId = null;
            }

            try {
                await createAdvancePayment(payload);
            } catch (error) {
                const shouldTryUpdate = isAlreadyExistsError(error) || isOpaqueSqlFailureOnAdvancePaymentInsert(error);
                if (!shouldTryUpdate) throw error;

                try {
                    await updateAdvancePayment(payload);
                } catch (updateError) {
                    // update源뚯? ?ㅽ뙣?섎㈃ 以묐났???꾨땲???곗씠???쒖빟 臾몄젣???뺣쪧???믪쑝誘濡????먮윭瑜??좎??섎릺 濡쒓렇瑜??④?
                    console.error('[advancePaymentService.saveAdvancePayment] Fallback update also failed.', {
                        originalError: error,
                        updateError: updateError,
                        payload
                    });
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

