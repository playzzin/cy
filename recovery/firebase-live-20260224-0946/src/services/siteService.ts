import { toast } from '../utils/swal';
import { dc } from '../config/firebase';
import {
    listSites,
    getSite,
    createSite,
    updateSite,
    deleteSite,
    Status
} from './dataconnectCompat';
import { Timestamp } from '../types/timestamp';

export interface Site {
    id?: string;
    legacyId?: string;
    name: string;
    code: string;
    address: string;
    startDate?: string; // 착공일
    endDate?: string; // 준공일
    status: 'active' | 'completed' | 'planned';
    responsibleTeamId?: string; // ID of the team managing this site
    responsibleTeamName?: string; // Denormalized name for display
    companyId?: string; // ID of the constructor company (시공사) - Main company
    companyName?: string; // Name of the constructor company
    clientCompanyId?: string; // ID of the client company (발주사) - New
    clientCompanyName?: string; // Name of the client company (발주사) - New
    constructorCompanyId?: string; // DEPRECATED: Use companyId for Constructor
    constructorCompanyName?: string; // DEPRECATED: Use companyName for Constructor
    partnerId?: string; // 협력사 ID (Partner) - New
    partnerName?: string; // 협력사 (Partner) - New
    siteType?: '도급' | '직영' | '지원';
    paymentMethod?: '계산서' | '노무';
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
    totalManDay?: number; // 누적 공수
    color?: string; // Site color for UI
    imageUrl?: string; // Representative image (Perspective/Bird's-eye view)
    photos?: string[]; // Gallery photos
}

const isUuidString = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) || /^[0-9a-f]{32}$/i.test(value);

const toNullableTrimmedString = (value: unknown): string | null => {
    if (value == null) return null;
    const trimmed = String(value).trim();
    return trimmed ? trimmed : null;
};

const toTimestamp = (value: unknown): Timestamp | undefined => {
    if (!value) return undefined;
    if (value instanceof Timestamp) return value;
    if (typeof value === 'string') {
        const d = new Date(value);
        if (!Number.isNaN(d.getTime())) return Timestamp.fromDate(d);
        return undefined;
    }
    if (typeof value === 'object') {
        const obj = value as any;
        const seconds = obj?._seconds ?? obj?.seconds;
        const nanos = obj?._nanoseconds ?? obj?.nanoseconds ?? 0;
        if (typeof seconds === 'number' && Number.isFinite(seconds)) {
            return Timestamp.fromMillis(seconds * 1000 + Math.floor((typeof nanos === 'number' ? nanos : 0) / 1_000_000));
        }
    }
    return undefined;
};

const mapStatusEnumToLegacy = (status: Status | null | undefined, statusText?: string | null): Site['status'] => {
    const st = typeof statusText === 'string' ? statusText : '';
    if (st === 'active' || st === 'completed' || st === 'planned') return st as Site['status'];

    if (status === Status.ARCHIVED) return 'completed';
    if (status === Status.INACTIVE) return 'planned';
    return 'active';
};

const mapLegacyStatusToEnum = (status: Site['status'] | undefined): Status => {
    if (status === 'completed') return Status.ARCHIVED;
    if (status === 'planned') return Status.INACTIVE;
    return Status.ACTIVE;
};

const mapSiteRowToModel = (row: any): Site => {
    const id = row?.id ? String(row.id) : undefined;
    const legacyId = row?.legacyId ? String(row.legacyId) : undefined;

    const responsibleTeamId = row?.responsibleTeam?.id
        ? String(row.responsibleTeam.id)
        : (row?.responsibleTeamLegacyId ? String(row.responsibleTeamLegacyId) : undefined);

    const companyId = row?.company?.id
        ? String(row.company.id)
        : (row?.companyLegacyId ? String(row.companyLegacyId) : undefined);

    const clientCompanyId = row?.clientCompany?.id
        ? String(row.clientCompany.id)
        : (row?.clientCompanyLegacyId ? String(row.clientCompanyLegacyId) : undefined);

    const partnerId = row?.partnerCompany?.id
        ? String(row.partnerCompany.id)
        : (row?.partnerCompanyLegacyId ? String(row.partnerCompanyLegacyId) : undefined);

    const companyName = row?.companyName ?? row?.company?.name ?? '';
    const clientCompanyName = row?.clientCompanyName ?? row?.clientCompany?.name ?? '';
    const responsibleTeamName = row?.responsibleTeamName ?? row?.responsibleTeam?.name ?? '';
    const partnerName = row?.partnerName ?? row?.partnerCompany?.name ?? '';

    return {
        id,
        legacyId,
        name: String(row?.name ?? ''),
        code: String(row?.code ?? ''),
        address: String(row?.address ?? ''),
        startDate: toNullableTrimmedString(row?.startDate) || undefined,
        endDate: toNullableTrimmedString(row?.endDate) || undefined,
        status: mapStatusEnumToLegacy(row?.status, row?.statusText),
        responsibleTeamId,
        responsibleTeamName: responsibleTeamName || undefined,
        companyId,
        companyName: companyName || undefined,
        clientCompanyId,
        clientCompanyName: clientCompanyName || undefined,
        constructorCompanyId: companyId,
        constructorCompanyName: companyName || undefined,
        partnerId,
        partnerName: partnerName || undefined,
        siteType: row?.siteType || undefined,
        paymentMethod: row?.paymentMethod || undefined,
        createdAt: toTimestamp(row?.createdAt),
        updatedAt: toTimestamp(row?.updatedAt),
        totalManDay: typeof row?.totalManDay === 'number' ? row.totalManDay : undefined,
        color: row?.color ?? undefined
    } as Site;
};

const extractSitesFromListSitesResult = (res: unknown): unknown[] => {
    if (!res || typeof res !== 'object') return [];
    const r = res as any;
    const a = r?.data?.sites;
    if (Array.isArray(a)) return a;
    const b = r?.data?.data?.sites;
    if (Array.isArray(b)) return b;
    const c = r?.result?.data?.sites;
    if (Array.isArray(c)) return c;
    return [];
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
    return Boolean(value) && typeof value === 'object';
};

const listAllSites = async (): Promise<Site[]> => {
    try {
        console.log('[DEBUG] Calling listSites(dc)...');
        const res = await listSites(dc);
        console.log('[DEBUG] listSites result:', res);
        const rows = extractSitesFromListSitesResult(res);
        const mapped = rows.map(mapSiteRowToModel);

        mapped.sort((a: Site, b: Site) => {
            const aMs = a.createdAt?.toMillis?.() ?? 0;
            const bMs = b.createdAt?.toMillis?.() ?? 0;
            return bMs - aMs;
        });

        return mapped;
    } catch (error) {
        console.error("DataConnect: listSites failed in listAllSites", error);
        return [];
    }
};

const resolveSiteUuid = async (legacyOrUuid: string): Promise<{ uuid: string | null; legacyId: string | null }> => {
    const v = String(legacyOrUuid);
    if (isUuidString(v)) return { uuid: v, legacyId: null };

    const res = await listSites(dc);
    const rows = extractSitesFromListSitesResult(res);
    const found = rows.find((row): row is Record<string, unknown> => isRecord(row) && String(row.legacyId ?? '') === v);
    if (!found) return { uuid: null, legacyId: v };
    const uuid = toNullableTrimmedString(found.id);
    if (!uuid) return { uuid: null, legacyId: v };
    return { uuid, legacyId: v };
};

const updateSiteInternal = async (
    id: string,
    site: Partial<Site>,
    options?: { silent?: boolean; skipWorkerSync?: boolean }
): Promise<void> => {
    const resolved = await resolveSiteUuid(id);
    if (!resolved.uuid) throw new Error('Site not found');

    let nameChanged = false;
    let legacyIdForWorkerSync: string | null = resolved.legacyId;
    if (!options?.skipWorkerSync && site.name) {
        try {
            const existingRes = await getSite(dc, { id: resolved.uuid } as any);
            const existing = (existingRes as any)?.data?.site;
            if (existing?.name && String(existing.name) !== site.name) {
                nameChanged = true;
            }
            if (!legacyIdForWorkerSync && existing?.legacyId) legacyIdForWorkerSync = String(existing.legacyId);
        } catch {
            // ignore
        }
    }

    const vars: any = { id: resolved.uuid };

    const setIfDefined = (key: string, value: unknown) => {
        if (value !== undefined) vars[key] = value;
    };

    setIfDefined('name', site.name ?? undefined);
    setIfDefined('code', site.code ?? undefined);
    setIfDefined('address', site.address ?? undefined);
    setIfDefined('startDate', site.startDate ?? undefined);
    setIfDefined('endDate', site.endDate ?? undefined);
    setIfDefined('color', site.color ?? undefined);
    setIfDefined('totalManDay', typeof site.totalManDay === 'number' ? site.totalManDay : (site.totalManDay as any));
    setIfDefined('siteType', site.siteType ?? undefined);
    setIfDefined('paymentMethod', site.paymentMethod ?? undefined);

    if (site.status !== undefined) {
        vars.status = mapLegacyStatusToEnum(site.status);
        vars.statusText = site.status;
    }

    if ((site as any).responsibleTeamId !== undefined) {
        const raw = (site as any).responsibleTeamId;
        if (raw === null) {
            vars.responsibleTeamId = null;
            vars.responsibleTeamLegacyId = null;
        } else if (typeof raw === 'string' && isUuidString(raw)) {
            vars.responsibleTeamId = raw;
            vars.responsibleTeamLegacyId = null;
        } else if (typeof raw === 'string') {
            vars.responsibleTeamId = null;
            vars.responsibleTeamLegacyId = raw;
        }
    }
    setIfDefined('responsibleTeamName', (site as any).responsibleTeamName ?? undefined);

    const companyRaw = site.companyId ?? site.constructorCompanyId;
    if (companyRaw !== undefined) {
        if (companyRaw === null) {
            vars.companyId = null;
            vars.companyLegacyId = null;
        } else if (typeof companyRaw === 'string' && isUuidString(companyRaw)) {
            vars.companyId = companyRaw;
            vars.companyLegacyId = null;
        } else if (typeof companyRaw === 'string') {
            vars.companyId = null;
            vars.companyLegacyId = companyRaw;
        }
    }
    if (site.companyName !== undefined || site.constructorCompanyName !== undefined) {
        vars.companyName = site.companyName ?? site.constructorCompanyName ?? null;
    }

    if ((site as any).clientCompanyId !== undefined) {
        const raw = (site as any).clientCompanyId;
        if (raw === null) {
            vars.clientCompanyId = null;
            vars.clientCompanyLegacyId = null;
        } else if (typeof raw === 'string' && isUuidString(raw)) {
            vars.clientCompanyId = raw;
            vars.clientCompanyLegacyId = null;
        } else if (typeof raw === 'string') {
            vars.clientCompanyId = null;
            vars.clientCompanyLegacyId = raw;
        }
    }
    setIfDefined('clientCompanyName', (site as any).clientCompanyName ?? undefined);

    if ((site as any).partnerId !== undefined) {
        const raw = (site as any).partnerId;
        if (raw === null) {
            vars.partnerCompanyId = null;
            vars.partnerCompanyLegacyId = null;
        } else if (typeof raw === 'string' && isUuidString(raw)) {
            vars.partnerCompanyId = raw;
            vars.partnerCompanyLegacyId = null;
        } else if (typeof raw === 'string') {
            vars.partnerCompanyId = null;
            vars.partnerCompanyLegacyId = raw;
        }
    }
    setIfDefined('partnerName', (site as any).partnerName ?? undefined);

    try {
        await updateSite(dc, vars);
    } catch (error) {
        console.error("DataConnect: updateSite failed in updateSiteInternal", error);
        throw error;
    }
    if (!options?.silent) toast.updated('현장');

    if (!options?.skipWorkerSync && nameChanged && site.name) {
        try {
            const { manpowerService } = await import('./manpowerService');
            await manpowerService.updateWorkersSiteName(resolved.uuid, site.name);
            if (legacyIdForWorkerSync && legacyIdForWorkerSync !== resolved.uuid) {
                await manpowerService.updateWorkersSiteName(legacyIdForWorkerSync, site.name);
            }
        } catch (e) {
            console.error("Failed to sync site name to workers:", e);
        }
    }
};

export const siteService = {
    addSite: async (site: Partial<Site> & Pick<Site, 'name' | 'code' | 'address' | 'status'>): Promise<string> => {
        try {
            const statusEnum = mapLegacyStatusToEnum(site.status);

            const legacyId = (site as any)?.legacyId;

            const responsibleTeamRaw = (site as any)?.responsibleTeamId ?? null;
            const responsibleTeamId = typeof responsibleTeamRaw === 'string' && isUuidString(responsibleTeamRaw) ? responsibleTeamRaw : null;
            const responsibleTeamLegacyId = typeof responsibleTeamRaw === 'string' && !isUuidString(responsibleTeamRaw) ? responsibleTeamRaw : null;

            const companyRaw = site.companyId ?? site.constructorCompanyId ?? null;
            const companyId = typeof companyRaw === 'string' && isUuidString(companyRaw) ? companyRaw : null;
            const companyLegacyId = typeof companyRaw === 'string' && !isUuidString(companyRaw) ? companyRaw : null;

            const clientCompanyRaw = (site as any)?.clientCompanyId ?? null;
            const clientCompanyId = typeof clientCompanyRaw === 'string' && isUuidString(clientCompanyRaw) ? clientCompanyRaw : null;
            const clientCompanyLegacyId = typeof clientCompanyRaw === 'string' && !isUuidString(clientCompanyRaw) ? clientCompanyRaw : null;

            const partnerRaw = (site as any)?.partnerId ?? null;
            const partnerCompanyId = typeof partnerRaw === 'string' && isUuidString(partnerRaw) ? partnerRaw : null;
            const partnerCompanyLegacyId = typeof partnerRaw === 'string' && !isUuidString(partnerRaw) ? partnerRaw : null;

            const res = await createSite(dc, {
                legacyId: legacyId ? String(legacyId) : null,
                name: site.name,
                code: site.code || null,
                address: site.address || null,
                startDate: site.startDate || null,
                endDate: site.endDate || null,
                status: statusEnum,
                statusText: site.status,

                responsibleTeamId,
                responsibleTeamLegacyId,
                responsibleTeamName: site.responsibleTeamName || null,

                companyId,
                companyLegacyId,
                companyName: site.companyName || site.constructorCompanyName || null,

                clientCompanyId,
                clientCompanyLegacyId,
                clientCompanyName: site.clientCompanyName || null,

                partnerCompanyId,
                partnerCompanyLegacyId,
                partnerName: site.partnerName || null,

                siteType: site.siteType || null,
                paymentMethod: site.paymentMethod || null,

                totalManDay: typeof site.totalManDay === 'number' ? site.totalManDay : null,
                color: site.color || null
            } as any);

            toast.saved('현장', 1);
            return String((res as any)?.data?.site_insert?.id);
        } catch (error) {
            console.error("DataConnect: createSite failed in addSite", error);
            throw error;
        }
    },

    updateSite: async (id: string, site: Partial<Site>): Promise<void> => {
        await updateSiteInternal(id, site);
    },

    deleteSite: async (id: string): Promise<void> => {
        try {
            const resolved = await resolveSiteUuid(id);
            if (!resolved.uuid) throw new Error('Site not found');
            await deleteSite(dc, { id: resolved.uuid } as any);
            toast.deleted('현장', 1);
        } catch (error) {
            console.error("DataConnect: deleteSite failed in deleteSite", error);
            throw error;
        }
    },

    // Update multiple sites specific fields
    updateSitesBatch: async (ids: string[], updates: Partial<Site>): Promise<void> => {
        try {
            await Promise.all(ids.map(siteId => updateSiteInternal(siteId, updates, { silent: true, skipWorkerSync: true })));
            toast.updated('현장');
        } catch (error) {
            console.error("Error updating sites batch:", error);
            throw error;
        }
    },

    // Get single site by ID
    getSite: async (id: string): Promise<Site | null> => {
        try {
            const resolved = await resolveSiteUuid(id);
            if (resolved.uuid) {
                const res = await getSite(dc, { id: resolved.uuid } as any);
                const row = (res as any)?.data?.site;
                if (!row) return null;
                return mapSiteRowToModel(row);
            }

            const allRes = await listSites(dc);
            const rows = extractSitesFromListSitesResult(allRes);
            const found = rows.find((row): row is Record<string, unknown> => isRecord(row) && String(row.legacyId ?? '') === String(id));
            if (!found) return null;
            return mapSiteRowToModel(found as any);
        } catch (e) {
            console.error(e);
            return null;
        }
    },

    getSites: async (): Promise<Site[]> => {
        try {
            return await listAllSites();
        } catch (e) {
            console.error(e);
            return [];
        }
    },

    // 현장명으로 조회
    getSiteByName: async (name: string): Promise<Site | null> => {
        try {
            const sites = await listAllSites();
            return sites.find(s => s.name === name) || null;
        } catch (e) {
            console.error(e);
            return null;
        }
    },

    // Get sites (Paginated)
    getSitesPaginated: async (limitCount: number, lastDoc: any = null): Promise<{ sites: Site[], lastDoc: any }> => {
        try {
            const all = await listAllSites();

            const cursorId = typeof lastDoc === 'string'
                ? lastDoc
                : (lastDoc?.id ? String(lastDoc.id) : null);

            let startIndex = 0;
            if (cursorId) {
                const idx = all.findIndex(s => s.id === cursorId);
                if (idx >= 0) startIndex = idx + 1;
            }

            const page = all.slice(startIndex, startIndex + limitCount);
            const newCursor = page.length > 0 ? page[page.length - 1].id : null;
            return { sites: page, lastDoc: newCursor };
        } catch (error) {
            console.error("Error fetching sites paginated:", error);
            throw error;
        }
    },

    // Increment total man-day for a site
    incrementManDay: async (siteId: string, amount: number): Promise<void> => {
        try {
            const site = await siteService.getSite(siteId);
            if (!site?.id) return;
            const next = (typeof site.totalManDay === 'number' ? site.totalManDay : 0) + amount;
            await updateSiteInternal(site.id, { totalManDay: next }, { silent: true, skipWorkerSync: true });
        } catch (error) {
            console.error(`Error incrementing man-day for site ${siteId}:`, error);
        }
    }
};
