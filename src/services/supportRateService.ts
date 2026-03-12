import { createSystemConfig, listSystemConfigs, updateSystemConfig } from '../services/firestoreCrudCompat';
import { Timestamp } from '../types/timestamp';
import { siteService } from './siteService';
import { teamService } from './teamService';
import { supportRateFirestoreService } from './supportRateFirestoreService';

// ?꾩옣蹂?吏?먮퉬 ?④?
export interface SupportRate {
    id?: string;                    // siteId
    siteId: string;
    siteName: string;
    defaultRate: number;            // 湲곕낯 吏?먮퉬 ?④? (??怨듭닔)
    updatedAt?: Timestamp;
}

// In-memory cache for support rates
let cachedRates: SupportRate[] | null = null;
let lastFetchTime: number = 0;
const CACHE_TTL = 1000 * 60 * 5; // 5 minutes cache

const SYSTEM_CONFIG_ID = 'support_site_rates';
const LEGACY_SYSTEM_CONFIG_ID = 'support_rates';

const safeJsonParse = <T>(value: unknown, fallback: T): T => {
    if (typeof value !== 'string') return fallback;
    const trimmed = value.trim();
    if (!trimmed) return fallback;
    try {
        return JSON.parse(trimmed) as T;
    } catch {
        return fallback;
    }
};

const isUuidString = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) || /^[0-9a-f]{32}$/i.test(value);

const toFiniteNumberOrNull = (value: unknown): number | null => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
        const n = Number(value);
        if (Number.isFinite(n)) return n;
    }
    return null;
};

const toFiniteNumberOrZero = (value: unknown): number => {
    const n = toFiniteNumberOrNull(value);
    return n ?? 0;
};

const normalizeSupportRate = (value: unknown): SupportRate | null => {
    if (!value || typeof value !== 'object') return null;
    const v = value as { id?: unknown; siteId?: unknown; siteName?: unknown; defaultRate?: unknown; updatedAt?: unknown };

    const rawSiteId = v.siteId ?? v.id;
    const siteId = rawSiteId != null ? String(rawSiteId) : '';
    if (!siteId.trim()) return null;

    const siteName = typeof v.siteName === 'string' ? v.siteName : '';
    const defaultRate = toFiniteNumberOrZero(v.defaultRate);
    const updatedAt = v.updatedAt as Timestamp | undefined;

    return {
        id: siteId,
        siteId,
        siteName,
        defaultRate,
        updatedAt
    };
};

type LegacyTeamRate = {
    teamId?: string;
    teamName?: string;
    defaultRate?: number;
};

const loadSystemConfigData = async (systemConfigId: string): Promise<unknown | null> => {
    const response = await listSystemConfigs();
    const rows = (response as any)?.data?.systemConfigs ?? [];
    const row = Array.isArray(rows) ? rows.find((r: any) => String(r?.id ?? '') === systemConfigId) : null;
    return row?.data ?? null;
};

const loadLegacyTeamRates = async (): Promise<LegacyTeamRate[]> => {
    const raw = await loadSystemConfigData(LEGACY_SYSTEM_CONFIG_ID);
    if (!raw) return [];

    const parsed = safeJsonParse<{ rates?: unknown }>(raw, {});
    const ratesRaw = (parsed as any)?.rates;
    if (!Array.isArray(ratesRaw)) return [];

    return ratesRaw
        .map((r: any) => {
            const teamId = r?.teamId ?? r?.id;
            const defaultRate = toFiniteNumberOrNull(r?.defaultRate);
            return {
                teamId: teamId != null ? String(teamId) : undefined,
                teamName: r?.teamName != null ? String(r.teamName) : undefined,
                defaultRate: defaultRate ?? undefined
            } satisfies LegacyTeamRate;
        })
        .filter((r: LegacyTeamRate) => Boolean(r.teamId));
};

const loadAllRates = async (forceRefresh: boolean = false): Promise<SupportRate[]> => {
    const now = Date.now();
    if (!forceRefresh && cachedRates && (now - lastFetchTime < CACHE_TTL)) {
        return cachedRates;
    }

    const response = await listSystemConfigs();
    const rows = (response as any)?.data?.systemConfigs ?? [];
    const row = Array.isArray(rows) ? rows.find((r: any) => String(r?.id ?? '') === SYSTEM_CONFIG_ID) : null;
    if (!row?.data) return [];
    const parsed = safeJsonParse<{ rates?: unknown }>(row.data, {});
    const rawRates = (parsed as { rates?: unknown }).rates;
    if (!Array.isArray(rawRates)) return [];

    const rates = rawRates.map(normalizeSupportRate).filter((x): x is SupportRate => x != null);
    cachedRates = rates;
    lastFetchTime = now;
    return rates;
};

const saveAllRates = async (rates: SupportRate[]): Promise<void> => {
    const payload = JSON.stringify({ rates });
    try {
        const res = await updateSystemConfig({ id: SYSTEM_CONFIG_ID, data: payload } as any);
        const didUpdate = (res as any)?.data?.systemConfig_update != null;
        if (!didUpdate) {
            await createSystemConfig({ id: SYSTEM_CONFIG_ID, data: payload } as any);
        }
    } catch {
        try {
            await createSystemConfig({ id: SYSTEM_CONFIG_ID, data: payload } as any);
        } catch {
            await updateSystemConfig({ id: SYSTEM_CONFIG_ID, data: payload } as any);
        }
    }
    // Invalidate cache after saving
    cachedRates = null;
    lastFetchTime = 0;
};

export const supportRateService = {
    // 紐⑤뱺 吏?먮퉬 ?④? 議고쉶(?꾩옣 湲곗?)
    async getAllSiteRates(): Promise<SupportRate[]> {
        try {
            return await loadAllRates();
        } catch (error) {
            console.error('Error fetching support rates:', error);
            throw error;
        }
    },

    // ?꾩옣蹂?吏?먮퉬 ?④? 議고쉶
    async getRateBySite(siteId: string): Promise<SupportRate | null> {
        try {
            const rates = await loadAllRates();
            return rates.find((r) => String(r.siteId) === String(siteId)) ?? null;
        } catch (error) {
            console.error('Error fetching support rate:', error);
            throw error;
        }
    },

    // 吏?먮퉬 ?④? ????섏젙
    async saveSiteRate(rate: SupportRate): Promise<void> {
        try {
            const rates = await loadAllRates();
            const next: SupportRate = {
                ...rate,
                id: rate.siteId,
                defaultRate: toFiniteNumberOrZero(rate.defaultRate),
                updatedAt: Timestamp.now()
            };

            const idx = rates.findIndex((r) => String(r.siteId) === String(rate.siteId));
            const nextRates = [...rates];
            if (idx >= 0) nextRates[idx] = { ...rates[idx], ...next };
            else nextRates.push(next);

            await saveAllRates(nextRates);
        } catch (error) {
            console.error('Error saving support rate:', error);
            throw error;
        }
    },

    // ?쇨큵 ?④? ?곸슜
    async applyBulkSiteRate(siteIds: string[], rate: number, siteNameBySiteId?: Record<string, string>): Promise<void> {
        try {
            const normalizedRate = toFiniteNumberOrZero(rate);
            const targetIds = Array.from(new Set(siteIds.map((x) => String(x).trim()).filter(Boolean)));
            if (targetIds.length === 0) return;

            const rates = await loadAllRates();
            const idxBySiteId = new Map<string, number>();
            rates.forEach((r, i) => idxBySiteId.set(String(r.siteId), i));

            const nextRates = [...rates];
            targetIds.forEach((siteId) => {
                const siteName = (siteNameBySiteId?.[siteId] ?? '').toString();
                const next: SupportRate = {
                    id: siteId,
                    siteId,
                    siteName,
                    defaultRate: normalizedRate,
                    updatedAt: Timestamp.now()
                };

                const idx = idxBySiteId.get(siteId);
                if (typeof idx === 'number') {
                    const prev = nextRates[idx];
                    nextRates[idx] = {
                        ...prev,
                        ...next,
                        siteName: next.siteName || prev.siteName
                    };
                } else {
                    nextRates.push(next);
                    idxBySiteId.set(siteId, nextRates.length - 1);
                }
            });

            await saveAllRates(nextRates);
        } catch (error) {
            console.error('Error applying bulk rate:', error);
            throw error;
        }
    },

    async migrateTeamRatesToSiteRates(options?: { overwriteExisting?: boolean }): Promise<{ migratedCount: number; skippedCount: number; missingRateCount: number }> {
        const overwriteExisting = options?.overwriteExisting ?? false;
        const [legacyTeamRates, sites, teams, existingSiteRates] = await Promise.all([
            loadLegacyTeamRates(),
            siteService.getSites(),
            teamService.getTeams(),
            loadAllRates()
        ]);

        const teamUuidByAnyId = new Map<string, string>();
        for (const t of teams) {
            if (t.id) teamUuidByAnyId.set(String(t.id), String(t.id));
            if (t.legacyId) teamUuidByAnyId.set(String(t.legacyId), String(t.id ?? t.legacyId));
        }

        const legacyRateByTeamUuid = new Map<string, number>();
        for (const r of legacyTeamRates) {
            const rawTeamId = r.teamId ? String(r.teamId) : '';
            if (!rawTeamId) continue;
            const rate = typeof r.defaultRate === 'number' && Number.isFinite(r.defaultRate) ? r.defaultRate : 0;
            if (rate <= 0) continue;

            const teamUuid = teamUuidByAnyId.get(rawTeamId) ?? rawTeamId;
            legacyRateByTeamUuid.set(teamUuid, rate);
        }

        const existingBySiteId = new Map<string, SupportRate>();
        for (const r of existingSiteRates) {
            existingBySiteId.set(String(r.siteId), r);
        }

        let migratedCount = 0;
        let skippedCount = 0;
        let missingRateCount = 0;

        const nextRates: SupportRate[] = [...existingSiteRates];
        const nextIndexBySiteId = new Map<string, number>();
        nextRates.forEach((r, i) => nextIndexBySiteId.set(String(r.siteId), i));

        for (const site of sites) {
            const siteId = site.id ? String(site.id) : '';
            if (!siteId) {
                skippedCount += 1;
                continue;
            }

            const responsibleRaw = site.responsibleTeamId ? String(site.responsibleTeamId) : '';
            if (!responsibleRaw) {
                skippedCount += 1;
                continue;
            }

            const responsibleTeamUuid = isUuidString(responsibleRaw)
                ? responsibleRaw
                : (teamUuidByAnyId.get(responsibleRaw) ?? responsibleRaw);

            const legacyRate = legacyRateByTeamUuid.get(responsibleTeamUuid);
            if (!legacyRate || legacyRate <= 0) {
                missingRateCount += 1;
                continue;
            }

            const already = existingBySiteId.get(siteId);
            if (already && !overwriteExisting) {
                skippedCount += 1;
                continue;
            }

            const next: SupportRate = {
                id: siteId,
                siteId,
                siteName: site.name,
                defaultRate: legacyRate,
                updatedAt: Timestamp.now()
            };

            const idx = nextIndexBySiteId.get(siteId);
            if (typeof idx === 'number') {
                nextRates[idx] = { ...nextRates[idx], ...next };
            } else {
                nextRates.push(next);
                nextIndexBySiteId.set(siteId, nextRates.length - 1);
            }

            migratedCount += 1;
        }

        await saveAllRates(nextRates);
        return { migratedCount, skippedCount, missingRateCount };
    },

    // Firestore濡??꾩껜 ?곗씠??留덉씠洹몃젅?댁뀡 ?ㅽ뻾
    async migrateToFirestore(): Promise<number> {
        try {
            const legacyRates = await loadAllRates();
            return await supportRateFirestoreService.migrateLegacyRates(legacyRates);
        } catch (error) {
            console.error('Error migrating support rates to Firestore:', error);
            throw error;
        }
    }
};

