import { dailyReportService, DailyReport, DailyReportWorker } from './dailyReportService';
import { manpowerService, Worker } from './manpowerService';
import { teamService, Team } from './teamService';
import { companyService, Company } from './companyService';
import { siteService, Site } from './siteService';

interface MonthRange {
    start: string;
    end: string;
    daysInMonth: number;
}

type ClaimCategory = 'support_site' | 'incoming_support';
type ClaimSiteType = '지원' | '도급' | '직영';

const INTERNAL_CONSTRUCTOR_TEAM_NAMES = [
    '이재욱팀',
    '김봉수팀',
    '김세흔팀',
    '김덕기팀',
    '박상국팀',
    '김군회팀',
    '임효재팀',
    '김진민팀',
    '김동혁팀'
];

const normalize = (value?: string | null): string => (value ?? '').replace(/\s+/g, '').trim();
const normalizeName = (value?: string | null): string => (value ?? '').replace(/\(.*?\)/g, '').replace(/\s+/g, '').trim();

const getMonthRange = (yearMonth: string): MonthRange => {
    const [yearStr, monthStr] = yearMonth.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    const safeYear = Number.isFinite(year) ? year : new Date().getFullYear();
    const safeMonth = Number.isFinite(month) ? month : new Date().getMonth() + 1;
    const startDate = new Date(safeYear, safeMonth - 1, 1);
    const endDate = new Date(safeYear, safeMonth, 0);

    const toISO = (date: Date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    return {
        start: toISO(startDate),
        end: toISO(endDate),
        daysInMonth: endDate.getDate()
    };
};

const normalizeSiteType = (value?: string | null): ClaimSiteType | '' => {
    const text = normalize(value);
    if (!text) return '';
    if (text.includes('지원')) return '지원';
    if (text.includes('도급')) return '도급';
    if (text.includes('직영')) return '직영';
    return '';
};

const getClaimCategory = (siteType: ClaimSiteType): ClaimCategory => (
    siteType === '지원' ? 'support_site' : 'incoming_support'
);

const getClaimCategoryLabel = (category: ClaimCategory) => (
    category === 'support_site' ? '지원현장 담당 지원팀' : '청연 담당현장 지원 투입팀'
);

const isInternalConstructorTeamName = (teamName?: string | null) => {
    const normalized = normalizeName(teamName);
    return normalized ? INTERNAL_CONSTRUCTOR_TEAM_NAMES.map(normalizeName).includes(normalized) : false;
};

export type SupportClaimIssueType =
    | 'MISSING_ID_NUMBER'
    | 'MISSING_ADDRESS'
    | 'MISSING_UNIT_PRICE'
    | 'MISSING_COUNTERPARTY';

export interface SupportClaimIssue {
    type: SupportClaimIssueType;
    workerName: string;
    contractorName: string;
    teamName: string;
    siteName: string;
    message: string;
}

export interface SupportClaimWorkerRow {
    workerId: string;
    name: string;
    idNumber?: string;
    contact?: string;
    address?: string;
    role?: string;
    teamName: string;
    unitPrice: number;
    totalManDay: number;
    totalAmount: number;
    dailyManDays: number[];
    flags: {
        missingIdNumber?: boolean;
        missingAddress?: boolean;
        missingUnitPrice?: boolean;
    };
}

export interface SupportClaimSheet {
    sheetId: string;
    contractorId: string;
    contractorName: string;
    siteId: string;
    siteName: string;
    teamId: string;
    teamName: string;
    siteType: ClaimSiteType;
    claimCategory: ClaimCategory;
    claimCategoryLabel: string;
    period: {
        start: string;
        end: string;
        month: string;
    };
    rows: SupportClaimWorkerRow[];
    stats: {
        totalWorkers: number;
        totalManDay: number;
        totalAmount: number;
    };
}

export interface SupportClaimFilters {
    month: string;
    contractorCompanyIds?: string[];
    teamIds?: string[];
    siteIds?: string[];
}

export interface SupportClaimResult {
    month: string;
    period: MonthRange;
    sheets: SupportClaimSheet[];
    stats: {
        totalSheets: number;
        totalWorkers: number;
        totalManDay: number;
        totalAmount: number;
    };
    issues: SupportClaimIssue[];
}

interface InternalRow extends SupportClaimWorkerRow {
    amountAccumulator: number;
    unitSamples: number[];
}

interface InternalSheet {
    meta: SupportClaimSheet;
    rowMap: Map<string, InternalRow>;
}

interface TeamContext {
    team?: Team;
    company?: Company;
    teamId: string;
    teamName: string;
    teamType: string;
    companyId: string;
    companyName: string;
}

interface SiteContext {
    site?: Site;
    siteId: string;
    siteName: string;
    siteType: ClaimSiteType | '';
}

const buildWorkerMaps = (workers: Worker[]) => {
    const byId = new Map<string, Worker>();
    const byName = new Map<string, Worker>();
    workers.forEach((worker) => {
        if (worker.id) byId.set(worker.id, worker);
        const normalized = normalizeName(worker.name);
        if (normalized && !byName.has(normalized)) byName.set(normalized, worker);
    });
    return { byId, byName };
};

const buildTeamMaps = (teams: Team[]) => {
    const byId = new Map<string, Team>();
    const byName = new Map<string, Team>();
    teams.forEach((team) => {
        if (team.id) byId.set(team.id, team);
        const normalized = normalizeName(team.name);
        if (normalized && !byName.has(normalized)) byName.set(normalized, team);
    });
    return { byId, byName };
};

const buildCompanyMaps = (companies: Company[]) => {
    const byId = new Map<string, Company>();
    const byName = new Map<string, Company>();
    companies.forEach((company) => {
        if (company.id) byId.set(company.id, company);
        const normalized = normalizeName(company.name);
        if (normalized && !byName.has(normalized)) byName.set(normalized, company);
    });
    return { byId, byName };
};

const buildSiteMaps = (sites: Site[]) => {
    const byId = new Map<string, Site>();
    const byName = new Map<string, Site>();
    sites.forEach((site) => {
        if (site.id) byId.set(site.id, site);
        const normalized = normalizeName(site.name);
        if (normalized && !byName.has(normalized)) byName.set(normalized, site);
    });
    return { byId, byName };
};

const findCompany = (companyId: string, companyName: string, companyMaps: ReturnType<typeof buildCompanyMaps>) => {
    if (companyId) {
        const byId = companyMaps.byId.get(companyId);
        if (byId) return byId;
    }
    const normalized = normalizeName(companyName);
    return normalized ? companyMaps.byName.get(normalized) : undefined;
};

const getWorkerProfile = (workerId: string | undefined, workerName: string | undefined, workerMaps: ReturnType<typeof buildWorkerMaps>) => {
    if (workerId) {
        const byId = workerMaps.byId.get(workerId);
        if (byId) return byId;
    }
    const normalized = normalizeName(workerName);
    return normalized ? workerMaps.byName.get(normalized) : undefined;
};

const resolveTeamContextFromCandidates = (
    candidateTeamIds: string[],
    candidateTeamNames: string[],
    fallbackCompanyId: string,
    fallbackCompanyName: string,
    fallbackTeamType: string,
    teamMaps: ReturnType<typeof buildTeamMaps>,
    companyMaps: ReturnType<typeof buildCompanyMaps>
): TeamContext => {
    let team = candidateTeamIds
        .map((teamId) => teamMaps.byId.get(teamId))
        .find((value): value is Team => Boolean(value));

    if (!team) {
        team = candidateTeamNames
            .map((teamName) => teamMaps.byName.get(normalizeName(teamName)))
            .find((value): value is Team => Boolean(value));
    }

    const companyId = String(team?.companyId ?? fallbackCompanyId ?? '').trim();
    const companyName = String(team?.companyName ?? fallbackCompanyName ?? '').trim();
    const company = findCompany(companyId, companyName, companyMaps);

    return {
        team,
        company,
        teamId: String(team?.id ?? candidateTeamIds[0] ?? '').trim(),
        teamName: String(team?.name ?? candidateTeamNames[0] ?? '').trim(),
        teamType: String(team?.type ?? fallbackTeamType ?? '').trim(),
        companyId: String(company?.id ?? companyId).trim(),
        companyName: String(company?.name ?? companyName).trim()
    };
};

const resolveSiteContext = (report: DailyReport, siteMaps: ReturnType<typeof buildSiteMaps>): SiteContext => {
    const rawSiteId = String(report.siteId ?? '').trim();
    const rawSiteName = String(report.siteName ?? '').trim();
    const site = (rawSiteId ? siteMaps.byId.get(rawSiteId) : undefined)
        ?? (rawSiteName ? siteMaps.byName.get(normalizeName(rawSiteName)) : undefined);

    return {
        site,
        siteId: site?.id ? String(site.id) : rawSiteId,
        siteName: site?.name ? String(site.name) : (rawSiteName || '현장 미지정'),
        siteType: normalizeSiteType(report.siteType ?? site?.siteType)
    };
};

const resolveReportWorkerTeamContext = (
    report: DailyReport,
    reportWorker: DailyReportWorker,
    workerProfile: Worker | undefined,
    teamMaps: ReturnType<typeof buildTeamMaps>,
    companyMaps: ReturnType<typeof buildCompanyMaps>
) => resolveTeamContextFromCandidates(
    [
        String(reportWorker.teamId ?? '').trim(),
        String(workerProfile?.teamId ?? '').trim(),
        String(report.teamId ?? '').trim()
    ].filter(Boolean),
    [
        String(reportWorker.workerTeamName ?? '').trim(),
        String(workerProfile?.teamName ?? '').trim(),
        String(report.teamName ?? '').trim()
    ].filter(Boolean),
    String(workerProfile?.companyId ?? report.companyId ?? '').trim(),
    String(workerProfile?.companyName ?? report.companyName ?? '').trim(),
    String(workerProfile?.teamType ?? '').trim(),
    teamMaps,
    companyMaps
);

const resolveResponsibleTeamContext = (
    report: DailyReport,
    siteContext: SiteContext,
    teamMaps: ReturnType<typeof buildTeamMaps>,
    companyMaps: ReturnType<typeof buildCompanyMaps>
) => resolveTeamContextFromCandidates(
    [
        String(siteContext.site?.responsibleTeamId ?? '').trim(),
        String(report.responsibleTeamId ?? '').trim(),
        String(report.teamId ?? '').trim()
    ].filter(Boolean),
    [
        String(siteContext.site?.responsibleTeamName ?? '').trim(),
        String(report.responsibleTeamName ?? '').trim(),
        String(report.teamName ?? '').trim()
    ].filter(Boolean),
    String(siteContext.site?.companyId ?? report.companyId ?? '').trim(),
    String(siteContext.site?.companyName ?? report.companyName ?? '').trim(),
    '',
    teamMaps,
    companyMaps
);

const isSupportResponsibleTeam = (teamContext: TeamContext) => {
    const normalizedType = normalize(teamContext.teamType || teamContext.team?.type);
    if (normalizedType.includes('지원')) return true;
    const normalizedName = normalizeName(teamContext.teamName || teamContext.team?.name);
    return normalizedName.includes('지원');
};

const getUnitPrice = (workerEntry: DailyReportWorker, teamContext: TeamContext, workerProfile?: Worker) => {
    if (typeof workerEntry.unitPrice === 'number' && Number.isFinite(workerEntry.unitPrice)) {
        return workerEntry.unitPrice;
    }
    if (typeof workerProfile?.unitPrice === 'number' && Number.isFinite(workerProfile.unitPrice)) {
        return workerProfile.unitPrice;
    }
    if (typeof teamContext.team?.serviceRate === 'number' && Number.isFinite(teamContext.team.serviceRate)) {
        return teamContext.team.serviceRate;
    }
    if (typeof teamContext.team?.supportRate === 'number' && Number.isFinite(teamContext.team.supportRate)) {
        return teamContext.team.supportRate;
    }
    return 0;
};

export const supportClaimService = {
    fetchClaims: async (filters: SupportClaimFilters): Promise<SupportClaimResult> => {
        const period = getMonthRange(filters.month);
        const [reports, workers, teams, companies, sites] = await Promise.all([
            dailyReportService.getReportsByRange(period.start, period.end),
            manpowerService.getWorkers(),
            teamService.getTeams(),
            companyService.getCompanies(),
            siteService.getSites()
        ]);

        const workerMaps = buildWorkerMaps(workers);
        const teamMaps = buildTeamMaps(teams);
        const companyMaps = buildCompanyMaps(companies);
        const siteMaps = buildSiteMaps(sites);

        const contractorFilter = filters.contractorCompanyIds?.map((id) => normalize(id));
        const teamFilter = filters.teamIds?.map((id) => normalize(id));
        const siteFilter = filters.siteIds?.map((id) => normalize(id));
        const issueSet = new Set<string>();
        const issues: SupportClaimIssue[] = [];
        const sheetMap = new Map<string, InternalSheet>();

        const shouldInclude = (contractorId: string, teamId: string, siteId: string) => {
            if (contractorFilter?.length && !contractorFilter.includes(normalize(contractorId))) return false;
            if (teamFilter?.length && !teamFilter.includes(normalize(teamId))) return false;
            if (siteFilter?.length && !siteFilter.includes(normalize(siteId))) return false;
            return true;
        };

        const ensureSheet = (
            contractorId: string,
            contractorName: string,
            siteId: string,
            siteName: string,
            teamId: string,
            teamName: string,
            siteType: ClaimSiteType
        ) => {
            const claimCategory = getClaimCategory(siteType);
            const key = [claimCategory, contractorId || 'support-site', siteId || siteName, teamId || teamName].join('__');
            const existing = sheetMap.get(key);
            if (existing) return existing;

            const meta: SupportClaimSheet = {
                sheetId: key,
                contractorId,
                contractorName,
                siteId,
                siteName,
                teamId,
                teamName,
                siteType,
                claimCategory,
                claimCategoryLabel: getClaimCategoryLabel(claimCategory),
                period: { start: period.start, end: period.end, month: filters.month },
                rows: [],
                stats: { totalWorkers: 0, totalManDay: 0, totalAmount: 0 }
            };

            const internal: InternalSheet = { meta, rowMap: new Map<string, InternalRow>() };
            sheetMap.set(key, internal);
            return internal;
        };

        const recordIssue = (type: SupportClaimIssueType, context: { workerName: string; contractorName: string; teamName: string; siteName: string }) => {
            const key = `${type}-${context.workerName}-${context.contractorName}-${context.teamName}-${context.siteName}`;
            if (issueSet.has(key)) return;
            issueSet.add(key);

            const messageMap: Record<SupportClaimIssueType, string> = {
                MISSING_ID_NUMBER: '주민등록번호가 누락되었습니다.',
                MISSING_ADDRESS: '주소가 누락되었습니다.',
                MISSING_UNIT_PRICE: '단가 정보가 없어 청구 금액 계산이 불완전합니다.',
                MISSING_COUNTERPARTY: '지원팀 또는 시공사 담당팀 매핑이 없어 집계에서 제외되었습니다.'
            };

            issues.push({ type, message: messageMap[type], ...context });
        };

        reports.forEach((report) => {
            const siteContext = resolveSiteContext(report, siteMaps);
            if (!siteContext.siteType) return;

            const responsibleTeamContext = resolveResponsibleTeamContext(report, siteContext, teamMaps, companyMaps);
            const responsibleTeamName = responsibleTeamContext.teamName || report.responsibleTeamName || report.teamName || '';

            report.workers.forEach((reportWorker) => {
                const manDay = typeof reportWorker.manDay === 'number' && Number.isFinite(reportWorker.manDay) ? reportWorker.manDay : 0;
                if (manDay <= 0) return;

                const workerProfile = getWorkerProfile(reportWorker.workerId, reportWorker.name, workerMaps);
                const reportWorkerTeamContext = resolveReportWorkerTeamContext(report, reportWorker, workerProfile, teamMaps, companyMaps);
                const reportWorkerTeamName = reportWorkerTeamContext.teamName || reportWorker.workerTeamName || '';

                let contractorId = '';
                let contractorName = '';
                let supportTeamContext: TeamContext | null = null;

                if (siteContext.siteType === '지원') {
                    if (!isSupportResponsibleTeam(responsibleTeamContext)) return;
                    supportTeamContext = responsibleTeamContext;
                    contractorName = '지원현장';
                } else if (
                    (siteContext.siteType === '도급' || siteContext.siteType === '직영')
                    && isInternalConstructorTeamName(responsibleTeamName)
                ) {
                    if (!reportWorkerTeamName || normalizeName(reportWorkerTeamName) === normalizeName(responsibleTeamName)) {
                        return;
                    }
                    supportTeamContext = reportWorkerTeamContext;
                    contractorId = responsibleTeamContext.teamId || normalize(responsibleTeamName);
                    contractorName = responsibleTeamName || '시공사 미지정';
                } else {
                    return;
                }

                if (!supportTeamContext || !supportTeamContext.teamName) {
                    recordIssue('MISSING_COUNTERPARTY', {
                        workerName: reportWorker.name || workerProfile?.name || '이름 미상',
                        contractorName: contractorName || '시공사 미지정',
                        teamName: responsibleTeamName || '담당팀 미지정',
                        siteName: siteContext.siteName
                    });
                    return;
                }

                const teamId = supportTeamContext.teamId || normalize(supportTeamContext.teamName);
                const teamName = supportTeamContext.teamName;
                const siteId = siteContext.siteId || normalize(siteContext.siteName);

                if (!shouldInclude(contractorId, teamId, siteId)) return;

                const sheet = ensureSheet(
                    contractorId,
                    contractorName,
                    siteId,
                    siteContext.siteName,
                    teamId,
                    teamName,
                    siteContext.siteType
                );

                const rowKey = reportWorker.workerId || `${teamId}-${siteId}-${normalizeName(reportWorker.name || workerProfile?.name) || 'worker'}`;
                let row = sheet.rowMap.get(rowKey);
                if (!row) {
                    row = {
                        workerId: reportWorker.workerId || rowKey,
                        name: reportWorker.name || workerProfile?.name || '이름 미상',
                        idNumber: workerProfile?.idNumber,
                        contact: workerProfile?.contact,
                        address: workerProfile?.address,
                        role: reportWorker.role || workerProfile?.role,
                        teamName,
                        unitPrice: 0,
                        totalManDay: 0,
                        totalAmount: 0,
                        dailyManDays: Array.from({ length: period.daysInMonth }, () => 0),
                        flags: {},
                        amountAccumulator: 0,
                        unitSamples: []
                    };
                    sheet.rowMap.set(rowKey, row);
                }

                const reportDay = Number(report.date?.split('-')[2]);
                if (Number.isFinite(reportDay) && reportDay >= 1 && reportDay <= period.daysInMonth) {
                    row.dailyManDays[reportDay - 1] += manDay;
                }

                const unitPrice = getUnitPrice(reportWorker, supportTeamContext, workerProfile);
                if (unitPrice > 0) {
                    row.unitSamples.push(unitPrice);
                }

                row.totalManDay += manDay;
                row.amountAccumulator += manDay * unitPrice;

                if (!row.idNumber) {
                    row.flags.missingIdNumber = true;
                    recordIssue('MISSING_ID_NUMBER', { workerName: row.name, contractorName: contractorName || '지원현장', teamName, siteName: siteContext.siteName });
                }
                if (!row.address) {
                    row.flags.missingAddress = true;
                    recordIssue('MISSING_ADDRESS', { workerName: row.name, contractorName: contractorName || '지원현장', teamName, siteName: siteContext.siteName });
                }
                if (unitPrice === 0) {
                    row.flags.missingUnitPrice = true;
                    recordIssue('MISSING_UNIT_PRICE', { workerName: row.name, contractorName: contractorName || '지원현장', teamName, siteName: siteContext.siteName });
                }
            });
        });

        const sheets = Array.from(sheetMap.values())
            .map((internal) => {
                const rows: SupportClaimWorkerRow[] = Array.from(internal.rowMap.values())
                    .map((row) => ({
                        workerId: row.workerId,
                        name: row.name,
                        idNumber: row.idNumber,
                        contact: row.contact,
                        address: row.address,
                        role: row.role,
                        teamName: row.teamName,
                        unitPrice: row.totalManDay > 0
                            ? Math.round(row.amountAccumulator / row.totalManDay)
                            : (row.unitSamples[row.unitSamples.length - 1] || 0),
                        totalManDay: Number(row.totalManDay.toFixed(2)),
                        totalAmount: Math.round(row.amountAccumulator),
                        dailyManDays: row.dailyManDays,
                        flags: row.flags
                    }))
                    .sort((a, b) => a.name.localeCompare(b.name, 'ko-KR'));

                const stats = rows.reduce(
                    (acc, row) => ({
                        totalWorkers: acc.totalWorkers + 1,
                        totalManDay: acc.totalManDay + row.totalManDay,
                        totalAmount: acc.totalAmount + row.totalAmount
                    }),
                    { totalWorkers: 0, totalManDay: 0, totalAmount: 0 }
                );

                return { ...internal.meta, rows, stats };
            })
            .sort((left, right) => {
                const contractorCompare = left.contractorName.localeCompare(right.contractorName, 'ko-KR');
                if (contractorCompare !== 0) return contractorCompare;
                const siteCompare = left.siteName.localeCompare(right.siteName, 'ko-KR');
                if (siteCompare !== 0) return siteCompare;
                return left.teamName.localeCompare(right.teamName, 'ko-KR');
            });

        const stats = sheets.reduce(
            (acc, sheet) => ({
                totalSheets: acc.totalSheets + 1,
                totalWorkers: acc.totalWorkers + sheet.stats.totalWorkers,
                totalManDay: acc.totalManDay + sheet.stats.totalManDay,
                totalAmount: acc.totalAmount + sheet.stats.totalAmount
            }),
            { totalSheets: 0, totalWorkers: 0, totalManDay: 0, totalAmount: 0 }
        );

        return {
            month: filters.month,
            period,
            sheets,
            stats,
            issues
        };
    }
};
