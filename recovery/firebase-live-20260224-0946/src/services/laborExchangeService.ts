import app from '../config/firebase';
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createSystemConfig, listSystemConfigs, updateSystemConfig } from '../dataconnect-generated';
import { dailyReportService } from './dailyReportService';
import { siteService } from './siteService';
import { supportRateService } from './supportRateService';
import { teamService } from './teamService';

const dc = getDataConnect(app, connectorConfig);

type LaborExchangeSnapshot = {
    yearMonth: string;
    items: LaborExchangeItem[];
    confirmedAt: string | null;
    updatedAt: string;
};

const SYSTEM_CONFIG_ID_PREFIX = 'labor_exchange_settlement_';

const safeJsonParse = <T,>(value: unknown, fallback: T): T => {
    if (typeof value !== 'string') return fallback;
    const trimmed = value.trim();
    if (!trimmed) return fallback;
    try {
        return JSON.parse(trimmed) as T;
    } catch {
        return fallback;
    }
};

const buildYearMonth = (year: number, month: number): string => {
    return `${year}-${String(month).padStart(2, '0')}`;
};

const getSystemConfigIdForYearMonth = (yearMonth: string): string => {
    return `${SYSTEM_CONFIG_ID_PREFIX}${yearMonth}`;
};

const loadSnapshotForYearMonth = async (yearMonth: string): Promise<LaborExchangeSnapshot | null> => {
    const id = getSystemConfigIdForYearMonth(yearMonth);
    const response = await listSystemConfigs(dc);
    const rows = (response as unknown as { data?: { systemConfigs?: unknown } })?.data?.systemConfigs;
    if (!Array.isArray(rows)) return null;
    const row = rows.find((r: any) => String(r?.id ?? '') === id) as any;
    if (!row?.data) return null;
    const parsed = safeJsonParse<Partial<LaborExchangeSnapshot>>(row.data, {});
    if (!parsed || typeof parsed !== 'object') return null;
    if (String(parsed.yearMonth ?? '') !== yearMonth) return null;

    const items = Array.isArray(parsed.items) ? (parsed.items as LaborExchangeItem[]) : [];
    const confirmedAt = typeof parsed.confirmedAt === 'string' ? parsed.confirmedAt : null;
    const updatedAt = typeof parsed.updatedAt === 'string' ? parsed.updatedAt : '';

    return {
        yearMonth,
        items,
        confirmedAt,
        updatedAt
    };
};

const saveSnapshotForYearMonth = async (snapshot: LaborExchangeSnapshot): Promise<void> => {
    const id = getSystemConfigIdForYearMonth(snapshot.yearMonth);
    const payload = JSON.stringify(snapshot);

    try {
        const res = await updateSystemConfig(dc, { id, data: payload } as any);
        const didUpdate = (res as any)?.data?.systemConfig_update != null;
        if (!didUpdate) {
            await createSystemConfig(dc, { id, data: payload } as any);
        }
    } catch {
        try {
            await createSystemConfig(dc, { id, data: payload } as any);
        } catch {
            await updateSystemConfig(dc, { id, data: payload } as any);
        }
    }
};

// 인력 교류 데이터 타입
export interface LaborExchangeItem {
    date: string;
    siteId: string;
    siteName: string;
    reportTeamId: string;       // 일보 작성팀 (현장 담당팀)
    reportTeamName: string;
    workerTeamId: string;       // 작업자 실제 소속팀
    workerTeamName: string;
    workerId: string;
    workerName: string;
    manDay: number;
    unitPrice: number;
    supportRate: number;
    amount: number;
}

// 팀별 정산 요약
export interface TeamExchangeSummary {
    teamId: string;
    teamName: string;
    yearMonth: string;
    // 일하러 간 곳 (받을 돈)
    outgoing: {
        items: LaborExchangeItem[];
        totalManDay: number;
        totalAmount: number;
    };
    // 일하러 온 곳 (줄 돈)
    incoming: {
        items: LaborExchangeItem[];
        totalManDay: number;
        totalAmount: number;
    };
    // 순정산
    netAmount: number;
}

export const laborExchangeService = {
    /**
     * 특정 월의 인력 교류 데이터 조회
     * 인력 교류 조건: 일보 작성팀(teamId) ≠ 작업자 소속팀(worker.teamId)
     */
    async getExchangeReport(
        year: number,
        month: number,
        teamId?: string,
        options?: { preferSnapshot?: boolean }
    ): Promise<TeamExchangeSummary[]> {
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const endDay = new Date(year, month, 0).getDate();
        const endDate = `${year}-${String(month).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;

        const yearMonth = buildYearMonth(year, month);
        const [teams, sites] = await Promise.all([teamService.getTeams(), siteService.getSites()]);

        const teamUuidByAnyId = new Map<string, string>();
        const teamNameByUuid = new Map<string, string>();

        const siteUuidByAnyId = new Map<string, string>();

        const isUuidString = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

        teams.forEach((t) => {
            if (!t.id) return;
            const uuid = String(t.id);
            teamUuidByAnyId.set(uuid, uuid);
            if (t.legacyId) teamUuidByAnyId.set(String(t.legacyId), uuid);
            teamNameByUuid.set(uuid, t.name);
        });

        sites.forEach((s) => {
            if (!s.id) return;
            const uuid = String(s.id);
            siteUuidByAnyId.set(uuid, uuid);
            if (s.legacyId) siteUuidByAnyId.set(String(s.legacyId), uuid);
            if (s.name) siteUuidByAnyId.set(String(s.name), uuid);
        });

        let exchangeItems: LaborExchangeItem[] = [];

        const shouldLockToSnapshot = Boolean(options?.preferSnapshot);

        if (shouldLockToSnapshot) {
            const snapshot = await loadSnapshotForYearMonth(yearMonth);
            if (snapshot?.confirmedAt) {
                const snapshotItems = Array.isArray(snapshot.items) ? snapshot.items : [];
                exchangeItems = snapshotItems.map((item) => ({
                    ...item,
                    reportTeamName: item.reportTeamName || teamNameByUuid.get(String(item.reportTeamId)) || '',
                    workerTeamName: item.workerTeamName || teamNameByUuid.get(String(item.workerTeamId)) || ''
                }));
                // 확정된 스냅샷이 있으면(0건 포함) 라이브 재계산으로 떨어지지 않도록 잠금
                // exchangeItems.length === 0 이어도 그대로 진행
            }
        }

        const resolveTeamUuid = (id?: string | null): string | null => {
            if (!id) return null;
            const raw = String(id);
            const mapped = teamUuidByAnyId.get(raw);
            if (mapped) return mapped;
            if (isUuidString(raw)) return raw;
            return null;
        };

        const resolveSiteUuid = (id?: string | null): string | null => {
            if (!id) return null;
            const raw = String(id);
            const mapped = siteUuidByAnyId.get(raw);
            if (mapped) return mapped;
            if (isUuidString(raw)) return raw;
            return null;
        };

        if (!shouldLockToSnapshot && exchangeItems.length === 0) {
            const [reports, supportRates] = await Promise.all([
                dailyReportService.getReportsByRange(startDate, endDate),
                supportRateService.getAllSiteRates()
            ]);

            const supportRateBySiteUuid = new Map<string, number>();
            supportRates.forEach((rate) => {
                const uuid = resolveSiteUuid(rate.siteId);
                if (!uuid) return;
                const v = typeof rate.defaultRate === 'number' && Number.isFinite(rate.defaultRate) ? rate.defaultRate : 0;
                supportRateBySiteUuid.set(String(uuid), v);
            });

            for (const report of reports) {
                const responsibleTeamUuid = resolveTeamUuid(report.responsibleTeamId ?? null);
                const reportTeamUuid = responsibleTeamUuid ?? resolveTeamUuid(report.teamId);
                if (!reportTeamUuid) continue;

                const siteUuid = resolveSiteUuid(report.siteId);

                const reportTeamName =
                    report.responsibleTeamName ||
                    report.teamName ||
                    teamNameByUuid.get(String(reportTeamUuid)) ||
                    '';

                for (const worker of report.workers) {
                    const workerTeamUuid = resolveTeamUuid(worker.teamId);
                    if (!workerTeamUuid) continue;
                    if (String(workerTeamUuid) === String(reportTeamUuid)) continue;

                    const workerUnitPrice = typeof worker.unitPrice === 'number' ? worker.unitPrice : 0;
                    const siteRate = siteUuid ? (supportRateBySiteUuid.get(String(siteUuid)) ?? 0) : 0;
                    const applicableRate = Number.isFinite(siteRate) && siteRate > 0 ? siteRate : workerUnitPrice;

                    exchangeItems.push({
                        date: report.date,
                        siteId: report.siteId,
                        siteName: report.siteName,
                        reportTeamId: String(reportTeamUuid),
                        reportTeamName,
                        workerTeamId: String(workerTeamUuid),
                        workerTeamName: teamNameByUuid.get(String(workerTeamUuid)) || '',
                        workerId: worker.workerId,
                        workerName: worker.name,
                        manDay: worker.manDay,
                        unitPrice: workerUnitPrice,
                        supportRate: applicableRate,
                        amount: worker.manDay * applicableRate
                    });
                }
            }
        }

        // 팀별로 그룹화
        const teamIds = new Set<string>();
        exchangeItems.forEach(item => {
            teamIds.add(item.workerTeamId);
            teamIds.add(item.reportTeamId);
        });

        // 특정 팀만 필터링
        const targetTeamIds = teamId ? [teamId] : Array.from(teamIds);

        const summaries: TeamExchangeSummary[] = [];

        for (const tid of targetTeamIds) {
            const tidUuid = resolveTeamUuid(tid);
            if (!tidUuid) continue;
            // 일하러 간 곳: 이 팀 소속 작업자가 다른 팀 현장에서 일함 (받을 돈)
            const outgoingItems = exchangeItems.filter(
                item => String(item.workerTeamId) === String(tidUuid)
            );
            const outgoingManDay = outgoingItems.reduce((sum, i) => sum + i.manDay, 0);
            const outgoingAmount = outgoingItems.reduce((sum, i) => sum + i.amount, 0);

            // 일하러 온 곳: 다른 팀 작업자가 이 팀 현장에서 일함 (줄 돈)
            const incomingItems = exchangeItems.filter(
                item => String(item.reportTeamId) === String(tidUuid)
            );
            const incomingManDay = incomingItems.reduce((sum, i) => sum + i.manDay, 0);
            const incomingAmount = incomingItems.reduce((sum, i) => sum + i.amount, 0);

            // 교류 내역이 있는 경우만 추가
            if (outgoingItems.length > 0 || incomingItems.length > 0) {
                // Find team name from items
                const teamName =
                    teamNameByUuid.get(String(tidUuid)) ||
                    outgoingItems.find(i => String(i.workerTeamId) === String(tidUuid))?.workerTeamName ||
                    incomingItems.find(i => String(i.reportTeamId) === String(tidUuid))?.reportTeamName ||
                    'Unknown Team';

                summaries.push({
                    teamId: String(tidUuid),
                    teamName,
                    yearMonth,
                    outgoing: {
                        items: outgoingItems,
                        totalManDay: outgoingManDay,
                        totalAmount: outgoingAmount
                    },
                    incoming: {
                        items: incomingItems,
                        totalManDay: incomingManDay,
                        totalAmount: incomingAmount
                    },
                    netAmount: outgoingAmount - incomingAmount
                });
            }
        }

        return summaries;
    },

    async getMonthSnapshotInfo(year: number, month: number): Promise<{ yearMonth: string; confirmedAt: string | null; updatedAt: string; itemCount: number } | null> {
        const yearMonth = buildYearMonth(year, month);
        const snapshot = await loadSnapshotForYearMonth(yearMonth);
        if (!snapshot) return null;
        return {
            yearMonth,
            confirmedAt: snapshot.confirmedAt,
            updatedAt: snapshot.updatedAt,
            itemCount: Array.isArray(snapshot.items) ? snapshot.items.length : 0
        };
    },

    async confirmMonth(year: number, month: number): Promise<{ yearMonth: string; confirmedAt: string; itemCount: number }> {
        const yearMonth = buildYearMonth(year, month);
        const confirmedAt = new Date().toISOString();

        const summaries = await this.getExchangeReport(year, month, undefined, { preferSnapshot: false });
        const items: LaborExchangeItem[] = summaries.flatMap((s) => s.outgoing.items);

        const snapshot: LaborExchangeSnapshot = {
            yearMonth,
            items,
            confirmedAt,
            updatedAt: confirmedAt
        };

        await saveSnapshotForYearMonth(snapshot);
        return { yearMonth, confirmedAt, itemCount: items.length };
    },

    async unconfirmMonth(year: number, month: number): Promise<void> {
        const yearMonth = buildYearMonth(year, month);
        const updatedAt = new Date().toISOString();
        const snapshot: LaborExchangeSnapshot = {
            yearMonth,
            items: [],
            confirmedAt: null,
            updatedAt
        };
        await saveSnapshotForYearMonth(snapshot);
    },

    /**
     * 팀 간 정산 매트릭스
     */
    async getExchangeMatrix(year: number, month: number): Promise<{
        teams: { id: string; name: string }[];
        matrix: Record<string, Record<string, number>>;
    }> {
        const summary = await this.getExchangeReport(year, month, undefined, { preferSnapshot: true });

        const teams = summary.map(s => ({ id: s.teamId, name: s.teamName }));
        const matrix: Record<string, Record<string, number>> = {};

        for (const t1 of teams) {
            matrix[t1.id] = {};
            for (const t2 of teams) {
                matrix[t1.id][t2.id] = 0;
            }
        }

        for (const s of summary) {
            for (const item of s.incoming.items) {
                if (!matrix[s.teamId]) matrix[s.teamId] = {};
                matrix[s.teamId][item.workerTeamId] =
                    (matrix[s.teamId][item.workerTeamId] || 0) + item.amount;
            }
        }

        return { teams, matrix };
    }
};
