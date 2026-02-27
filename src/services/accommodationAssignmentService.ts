import { toast } from '../utils/swal';
import { app } from '../firebase/config';
import { getDataConnect } from 'firebase/data-connect';
import {
    connectorConfig,
    listAllAccommodationAssignments,
    createAccommodationAssignment,
    updateAccommodationAssignment,
    deleteAccommodationAssignment,
    listAllWorkers,
    listAllTeams,
    listAllAccommodations,
} from '../dataconnect-generated';
import { Timestamp } from '../types/timestamp';
import { z } from 'zod';
import { format, parseISO, subDays } from 'date-fns';
import {
    AccommodationAssignment,
    AccommodationAssignmentSource,
    AccommodationAssignmentStatus
} from '../types/accommodationAssignment';

const dc = getDataConnect(app, connectorConfig);

const isUuidString = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

const toFirestoreTimestamp = (value?: unknown): Timestamp | undefined => {
    if (!value) return undefined;
    if (value instanceof Timestamp) return value;
    if (typeof (value as any)?.toDate === 'function') {
        try {
            return Timestamp.fromDate((value as any).toDate());
        } catch {
            // ignore
        }
    }
    if (typeof value === 'object') {
        const obj = value as any;
        const seconds = obj?._seconds ?? obj?.seconds;
        const nanos = obj?._nanoseconds ?? obj?.nanoseconds ?? 0;
        if (typeof seconds === 'number' && Number.isFinite(seconds)) {
            return Timestamp.fromMillis(seconds * 1000 + Math.floor((typeof nanos === 'number' ? nanos : 0) / 1_000_000));
        }
    }
    try {
        return Timestamp.fromDate(new Date(String(value)));
    } catch {
        return undefined;
    }
};

let dcWorkersLoaded = false;
let dcTeamsLoaded = false;
let dcAccommodationsLoaded = false;
let dcAssignmentsLoaded = false;

const dcWorkerLegacyIdToUuid = new Map<string, string>();
const dcTeamLegacyIdToUuid = new Map<string, string>();
const dcAccommodationLegacyIdToUuid = new Map<string, string>();
const dcAssignmentLegacyIdToUuid = new Map<string, string>();

let dcAssignmentsCache: any[] = [];

const loadDcWorkers = async (): Promise<void> => {
    if (dcWorkersLoaded) return;
    const res = await listAllWorkers(dc);
    const rows = (res as any)?.data?.workers ?? [];
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
    const res = await listAllTeams(dc);
    const rows = (res as any)?.data?.teams ?? [];
    dcTeamLegacyIdToUuid.clear();
    rows.forEach((t: any) => {
        const id = t?.id ? String(t.id) : '';
        const legacyId = t?.legacyId ? String(t.legacyId) : '';
        if (id) dcTeamLegacyIdToUuid.set(id, id);
        if (legacyId) dcTeamLegacyIdToUuid.set(legacyId, id);
    });
    dcTeamsLoaded = true;
};

const loadDcAccommodations = async (): Promise<void> => {
    if (dcAccommodationsLoaded) return;
    const res = await listAllAccommodations(dc);
    const rows = (res as any)?.data?.accommodations ?? [];
    dcAccommodationLegacyIdToUuid.clear();
    rows.forEach((a: any) => {
        const id = a?.id ? String(a.id) : '';
        const legacyId = a?.legacyId ? String(a.legacyId) : '';
        if (id) dcAccommodationLegacyIdToUuid.set(id, id);
        if (legacyId) dcAccommodationLegacyIdToUuid.set(legacyId, id);
    });
    dcAccommodationsLoaded = true;
};

const loadDcAssignments = async (): Promise<void> => {
    if (dcAssignmentsLoaded) return;
    const res = await listAllAccommodationAssignments(dc);
    const rows = (res as any)?.data?.accommodationAssignments ?? [];

    dcAssignmentsCache = rows;
    dcAssignmentLegacyIdToUuid.clear();
    rows.forEach((a: any) => {
        const id = a?.id ? String(a.id) : '';
        const legacyId = a?.legacyId ? String(a.legacyId) : '';
        if (id) dcAssignmentLegacyIdToUuid.set(id, id);
        if (legacyId) dcAssignmentLegacyIdToUuid.set(legacyId, id);
    });
    dcAssignmentsLoaded = true;
};

const resolveWorkerUuid = async (id: string): Promise<string | null> => {
    const raw = id ? String(id) : '';
    if (!raw) return null;
    if (isUuidString(raw)) return raw;
    await loadDcWorkers();
    return dcWorkerLegacyIdToUuid.get(raw) ?? null;
};

const resolveTeamUuid = async (id: string | undefined): Promise<string | null> => {
    const raw = id ? String(id) : '';
    if (!raw) return null;
    if (isUuidString(raw)) return raw;
    await loadDcTeams();
    return dcTeamLegacyIdToUuid.get(raw) ?? null;
};

const resolveAccommodationUuid = async (id: string): Promise<string | null> => {
    const raw = id ? String(id) : '';
    if (!raw) return null;
    if (isUuidString(raw)) return raw;
    await loadDcAccommodations();
    return dcAccommodationLegacyIdToUuid.get(raw) ?? null;
};

const resolveAssignmentUuid = async (id: string): Promise<string | null> => {
    const raw = id ? String(id) : '';
    if (!raw) return null;
    if (isUuidString(raw)) return raw;
    await loadDcAssignments();
    const found = dcAssignmentLegacyIdToUuid.get(raw);
    if (found) return found;

    dcAssignmentsLoaded = false;
    await loadDcAssignments();
    return dcAssignmentLegacyIdToUuid.get(raw) ?? null;
};

const normalizeStatus = (value?: string | null): AccommodationAssignmentStatus => {
    return value === 'ended' ? 'ended' : 'active';
};

const normalizeSource = (value?: string | null): AccommodationAssignmentSource | undefined => {
    if (value === 'team' || value === 'worker') return value;
    return undefined;
};

const mapAssignmentRow = (row: any): AccommodationAssignment => {
    const id = row?.legacyId ? String(row.legacyId) : String(row?.id ?? '');
    const workerId = row?.worker?.legacyId
        ? String(row.worker.legacyId)
        : (row?.worker?.id ? String(row.worker.id) : (row?.workerId ? String(row.workerId) : ''));
    const teamId = row?.team?.legacyId
        ? String(row.team.legacyId)
        : (row?.team?.id ? String(row.team.id) : (row?.teamId ? String(row.teamId) : undefined));
    const accommodationId = row?.accommodation?.id
        ? String(row.accommodation.id)
        : (row?.accommodation?.legacyId ? String(row.accommodation.legacyId) : (row?.accommodationId ? String(row.accommodationId) : ''));

    return {
        id,
        workerId,
        workerName: row?.workerName ? String(row.workerName) : (row?.worker?.name ? String(row.worker.name) : undefined),
        teamId,
        teamName: row?.teamName ? String(row.teamName) : (row?.team?.name ? String(row.team.name) : undefined),
        accommodationId,
        accommodationName: row?.accommodationName ? String(row.accommodationName) : (row?.accommodation?.name ? String(row.accommodation.name) : undefined),
        status: normalizeStatus(row?.status ?? null),
        startDate: String(row?.startDate ?? ''),
        endDate: row?.endDate ? String(row.endDate) : undefined,
        source: normalizeSource(row?.source ?? null),
        memo: row?.memo ? String(row.memo) : undefined,
        createdAt: toFirestoreTimestamp(row?.createdAt),
        updatedAt: toFirestoreTimestamp(row?.updatedAt)
    };
};

const omitUndefined = (value: Record<string, unknown>): Record<string, unknown> => {
    const entries = Object.entries(value).filter(([, v]) => v !== undefined);
    return Object.fromEntries(entries);
};

const DateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '날짜 형식은 YYYY-MM-DD 이어야 합니다.');

// Status and Source are validated as strings, type narrowing happens at runtime
const StatusSchema = z.string().refine(
    (val): val is AccommodationAssignmentStatus => val === 'active' || val === 'ended',
    { message: 'status는 active 또는 ended이어야 합니다.' }
);

const SourceSchema = z.string().refine(
    (val): val is AccommodationAssignmentSource => val === 'team' || val === 'worker',
    { message: 'source는 team 또는 worker이어야 합니다.' }
);

const AssignmentSchema = z.object({
    workerId: z.string().min(1),
    workerName: z.string().optional(),

    teamId: z.string().optional(),
    teamName: z.string().optional(),

    accommodationId: z.string().min(1),
    accommodationName: z.string().optional(),

    status: StatusSchema.default('active'),

    startDate: DateStringSchema,
    endDate: DateStringSchema.optional(),

    source: SourceSchema.optional(),
    memo: z.string().optional()
});

type AssignmentInput = z.infer<typeof AssignmentSchema>;

type AssignmentUpdate = Partial<AssignmentInput>;

const toMillis = (ts?: Timestamp): number => (ts ? ts.toMillis() : 0);

const isActive = (item: AccommodationAssignment): boolean => {
    return (item.status || 'active') === 'active' && !item.endDate;
};

const buildEndDateAsDayBefore = (startDate: string): string => {
    const dayBefore = subDays(parseISO(startDate), 1);
    return format(dayBefore, 'yyyy-MM-dd');
};

export const accommodationAssignmentService = {
    buildEndDateAsDayBefore,

    addAssignment: async (
        assignment: Omit<AccommodationAssignment, 'id' | 'createdAt' | 'updatedAt'>
    ): Promise<string> => {
        const parsed = AssignmentSchema.parse({
            ...assignment,
            status: assignment.status ?? 'active'
        });

        const workerUuid = await resolveWorkerUuid(String(parsed.workerId));
        if (!workerUuid) throw new Error('작업자를 찾을 수 없습니다.');
        const teamUuid = parsed.teamId ? await resolveTeamUuid(String(parsed.teamId)) : null;
        const accommodationUuid = await resolveAccommodationUuid(String(parsed.accommodationId));
        if (!accommodationUuid) throw new Error('숙소를 찾을 수 없습니다.');

        const legacyId = (assignment as any)?.legacyId;
        const res = await createAccommodationAssignment(dc, {
            legacyId: legacyId ? String(legacyId) : null,
            workerId: workerUuid,
            teamId: teamUuid ?? null,
            accommodationId: accommodationUuid,
            workerName: parsed.workerName ?? null,
            teamName: parsed.teamName ?? null,
            accommodationName: parsed.accommodationName ?? null,
            status: parsed.status ?? 'active',
            startDate: parsed.startDate,
            endDate: parsed.endDate ?? null,
            source: parsed.source ?? null,
            memo: parsed.memo ?? null
        } as any);

        const id = (res as any)?.data?.accommodationAssignment_insert?.id ? String((res as any).data.accommodationAssignment_insert.id) : '';
        if (!id) throw new Error('Failed to create accommodation assignment');

        dcAssignmentsLoaded = false;
        toast.saved('숙소 배정', 1);
        return id;
    },

    addAssignmentsBatch: async (
        assignments: Array<Omit<AccommodationAssignment, 'id' | 'createdAt' | 'updatedAt'>>
    ): Promise<string[]> => {
        if (assignments.length === 0) return [];

        const parsed = assignments
            .map((a) =>
                AssignmentSchema.parse({
                    ...a,
                    status: a.status ?? 'active'
                })
            )
            .map((item) => omitUndefined(item as unknown as Record<string, unknown>));

        const ids: string[] = [];

        // Preload FK maps once
        const responses = await Promise.all([
            listAllWorkers(dc),
            listAllTeams(dc),
            listAllAccommodations(dc)
        ]);

        const chunkSize = 50;
        for (let i = 0; i < parsed.length; i += chunkSize) {
            const chunk = parsed.slice(i, i + chunkSize);
            const results = await Promise.all(chunk.map(async (item) => {
                const workerUuid = await resolveWorkerUuid(String(item.workerId));
                if (!workerUuid) return null;
                const teamUuid = item.teamId ? await resolveTeamUuid(String(item.teamId)) : null;
                const accommodationUuid = await resolveAccommodationUuid(String(item.accommodationId));
                if (!accommodationUuid) return null;

                const res = await createAccommodationAssignment(dc, {
                    legacyId: null,
                    workerId: workerUuid,
                    teamId: teamUuid ?? null,
                    accommodationId: accommodationUuid,
                    workerName: item.workerName ?? null,
                    teamName: item.teamName ?? null,
                    accommodationName: item.accommodationName ?? null,
                    status: item.status ?? 'active',
                    startDate: item.startDate,
                    endDate: item.endDate ?? null,
                    source: item.source ?? null,
                    memo: item.memo ?? null
                } as any);

                const id = (res as any)?.data?.accommodationAssignment_insert?.id ? String((res as any).data.accommodationAssignment_insert.id) : '';
                return id || null;
            }));

            results.forEach((id) => {
                if (id) ids.push(id);
            });
        }

        dcAssignmentsLoaded = false;
        toast.saved('숙소 배정', assignments.length);
        return ids;
    },

    updateAssignment: async (id: string, updates: AssignmentUpdate): Promise<void> => {
        if (!id) throw new Error('배정 ID가 필요합니다.');

        const parsedUpdates = AssignmentSchema.partial().parse(updates);

        const uuid = await resolveAssignmentUuid(id);
        if (!uuid) throw new Error('배정을 찾을 수 없습니다.');

        const data = omitUndefined(parsedUpdates as unknown as Record<string, unknown>);
        if (Object.keys(data).length === 0) return;

        const vars: any = { id: uuid };
        if (data.workerId !== undefined) vars.workerId = data.workerId ? (await resolveWorkerUuid(String(data.workerId))) : null;
        if (data.workerName !== undefined) vars.workerName = data.workerName ?? null;
        if (data.teamId !== undefined) vars.teamId = data.teamId ? (await resolveTeamUuid(String(data.teamId))) : null;
        if (data.teamName !== undefined) vars.teamName = data.teamName ?? null;
        if (data.accommodationId !== undefined) vars.accommodationId = data.accommodationId ? (await resolveAccommodationUuid(String(data.accommodationId))) : null;
        if (data.accommodationName !== undefined) vars.accommodationName = data.accommodationName ?? null;
        if (data.status !== undefined) vars.status = data.status ?? null;
        if (data.startDate !== undefined) vars.startDate = data.startDate ?? null;
        if (data.endDate !== undefined) vars.endDate = data.endDate ?? null;
        if (data.source !== undefined) vars.source = data.source ?? null;
        if (data.memo !== undefined) vars.memo = data.memo ?? null;

        await updateAccommodationAssignment(dc, vars as any);

        dcAssignmentsLoaded = false;
        toast.updated('숙소 배정');
    },

    endAssignment: async (id: string, endDate: string): Promise<void> => {
        if (!id) throw new Error('배정 ID가 필요합니다.');
        const parsedEndDate = DateStringSchema.parse(endDate);

        const uuid = await resolveAssignmentUuid(id);
        if (!uuid) throw new Error('배정을 찾을 수 없습니다.');
        await updateAccommodationAssignment(dc, { id: uuid, status: 'ended', endDate: parsedEndDate } as any);
        dcAssignmentsLoaded = false;
        toast.updated('숙소 배정');
    },

    endAssignmentsBatch: async (ids: string[], endDate: string): Promise<void> => {
        if (ids.length === 0) return;
        const parsedEndDate = DateStringSchema.parse(endDate);

        const chunkSize = 50;
        for (let i = 0; i < ids.length; i += chunkSize) {
            const chunk = ids.slice(i, i + chunkSize);
            await Promise.all(chunk.map(async (id) => {
                const uuid = await resolveAssignmentUuid(id);
                if (!uuid) return;
                await updateAccommodationAssignment(dc, { id: uuid, status: 'ended', endDate: parsedEndDate } as any);
            }));
        }

        dcAssignmentsLoaded = false;
        toast.updated('숙소 배정');
    },

    deleteAssignment: async (id: string): Promise<void> => {
        if (!id) throw new Error('배정 ID가 필요합니다.');
        const uuid = await resolveAssignmentUuid(id);
        if (!uuid) return;
        await deleteAccommodationAssignment(dc, { id: uuid } as any);
        dcAssignmentsLoaded = false;
        toast.deleted('숙소 배정', 1);
    },

    getAssignment: async (id: string): Promise<AccommodationAssignment | null> => {
        if (!id) return null;
        await loadDcAssignments();
        const raw = String(id);
        const row = dcAssignmentsCache.find((a: any) => String(a?.id ?? '') === raw || (a?.legacyId && String(a.legacyId) === raw));
        if (!row) return null;
        return mapAssignmentRow(row);
    },

    getAssignmentsByWorker: async (workerId: string): Promise<AccommodationAssignment[]> => {
        await loadDcAssignments();
        const raw = workerId ? String(workerId) : '';
        const uuid = await resolveWorkerUuid(raw);

        return dcAssignmentsCache
            .filter((row: any) => {
                const rowWorkerId = row?.worker?.id ? String(row.worker.id) : '';
                const rowWorkerLegacyId = row?.worker?.legacyId ? String(row.worker.legacyId) : '';
                if (raw && (rowWorkerLegacyId === raw || rowWorkerId === raw)) return true;
                return uuid ? rowWorkerId === uuid : false;
            })
            .map(mapAssignmentRow)
            .sort((a, b) => toMillis(b.createdAt as Timestamp | undefined) - toMillis(a.createdAt as Timestamp | undefined));
    },

    getActiveAssignmentsByWorker: async (workerId: string): Promise<AccommodationAssignment[]> => {
        const items = await accommodationAssignmentService.getAssignmentsByWorker(workerId);
        return items.filter(isActive);
    },

    getAssignmentsByAccommodation: async (accommodationId: string): Promise<AccommodationAssignment[]> => {
        await loadDcAssignments();
        const raw = accommodationId ? String(accommodationId) : '';
        const uuid = await resolveAccommodationUuid(raw);

        return dcAssignmentsCache
            .filter((row: any) => {
                const rowId = row?.accommodation?.id
                    ? String(row.accommodation.id)
                    : (row?.accommodationId ? String(row.accommodationId) : '');
                const rowLegacyId = row?.accommodation?.legacyId ? String(row.accommodation.legacyId) : '';
                const rowName = row?.accommodationName
                    ? String(row.accommodationName)
                    : (row?.accommodation?.name ? String(row.accommodation.name) : '');
                if (raw && (rowLegacyId === raw || rowId === raw || rowName === raw)) return true;
                return uuid ? rowId === uuid : false;
            })
            .map(mapAssignmentRow)
            .sort((a, b) => toMillis(b.createdAt as Timestamp | undefined) - toMillis(a.createdAt as Timestamp | undefined));
    },

    getActiveAssignmentsByAccommodation: async (accommodationId: string): Promise<AccommodationAssignment[]> => {
        const items = await accommodationAssignmentService.getAssignmentsByAccommodation(accommodationId);
        return items.filter(isActive);
    },

    getAssignmentsByTeam: async (teamId: string): Promise<AccommodationAssignment[]> => {
        await loadDcAssignments();
        const raw = teamId ? String(teamId) : '';
        const uuid = await resolveTeamUuid(raw);

        return dcAssignmentsCache
            .filter((row: any) => {
                const rowTeamId = row?.team?.id
                    ? String(row.team.id)
                    : (row?.teamId ? String(row.teamId) : '');
                const rowTeamLegacyId = row?.team?.legacyId ? String(row.team.legacyId) : '';
                const rowTeamName = row?.teamName ? String(row.teamName) : (row?.team?.name ? String(row.team.name) : '');
                if (raw && (rowTeamLegacyId === raw || rowTeamId === raw || rowTeamName === raw)) return true;
                return uuid ? rowTeamId === uuid : false;
            })
            .map(mapAssignmentRow)
            .sort((a, b) => toMillis(b.createdAt as Timestamp | undefined) - toMillis(a.createdAt as Timestamp | undefined));
    },

    getActiveAssignmentsByTeam: async (teamId: string): Promise<AccommodationAssignment[]> => {
        const items = await accommodationAssignmentService.getAssignmentsByTeam(teamId);
        return items.filter(isActive);
    },

    getAllAssignments: async (): Promise<AccommodationAssignment[]> => {
        await loadDcAssignments();
        return dcAssignmentsCache
            .map(mapAssignmentRow)
            .sort((a, b) => toMillis(b.createdAt as Timestamp | undefined) - toMillis(a.createdAt as Timestamp | undefined));
    }
};
