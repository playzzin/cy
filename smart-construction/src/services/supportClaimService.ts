import { dailyReportService, DailyReport, DailyReportWorker } from './dailyReportService';
import { manpowerService, Worker } from './manpowerService';
import { teamService, Team } from './teamService';
import { companyService, Company } from './companyService';

interface MonthRange {
    start: string;
    end: string;
    daysInMonth: number;
}

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

export type SupportClaimIssueType = 'MISSING_ID_NUMBER' | 'MISSING_ADDRESS' | 'MISSING_UNIT_PRICE';

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

const buildWorkerMaps = (workers: Worker[]) => {
    const byId = new Map<string, Worker>();
    const byName = new Map<string, Worker>();

    workers.forEach((worker) => {
        if (worker.id) {
            byId.set(worker.id, worker);
        }
        const normalized = normalizeName(worker.name);
        if (normalized && !byName.has(normalized)) {
            byName.set(normalized, worker);
        }
    });

    return { byId, byName };
};

const buildTeamMap = (teams: Team[]) => {
    const map = new Map<string, Team>();
    teams.forEach((team) => {
        if (team.id) {
            map.set(team.id, team);
        }
    });
    return map;
};

const buildCompanyMap = (companies: Company[]) => {
    const map = new Map<string, Company>();
    companies.forEach((company) => {
        if (company.id) {
            map.set(company.id, company);
        }
    });
    return map;
};

const isSupportEntry = (worker: DailyReportWorker, team?: Team) => {
    const normalizedSalary = normalize(worker.salaryModel ?? worker.payType);
    const isSupportModel = normalizedSalary === '지원팀';
    const normalizedTeamType = normalize(team?.type);
    const isSupportTeam = normalizedTeamType === '지원팀';
    return isSupportModel || isSupportTeam;
};

export const supportClaimService = {
    fetchClaims: async (filters: SupportClaimFilters): Promise<SupportClaimResult> => {
        const period = getMonthRange(filters.month);
        const [reports, workers, teams, companies] = await Promise.all([
            dailyReportService.getReportsByRange(period.start, period.end),
            manpowerService.getWorkers(),
            teamService.getTeams(),
            companyService.getCompanies()
        ]);

        const workerMaps = buildWorkerMaps(workers);
        const teamMap = buildTeamMap(teams);
        const companyMap = buildCompanyMap(companies);

        const sheetMap = new Map<string, InternalSheet>();
        const issues: SupportClaimIssue[] = [];
        const issueSet = new Set<string>();

        const contractorFilter = filters.contractorCompanyIds?.map((id) => normalize(id));
        const teamFilter = filters.teamIds?.map((id) => normalize(id));
        const siteFilter = filters.siteIds?.map((id) => normalize(id));

        const daysInMonth = period.daysInMonth;

        const shouldInclude = (contractorId: string, teamId: string, siteId: string) => {
            if (contractorFilter?.length && !contractorFilter.includes(normalize(contractorId))) {
                return false;
            }
            if (teamFilter?.length && !teamFilter.includes(normalize(teamId))) {
                return false;
            }
            if (siteFilter?.length && !siteFilter.includes(normalize(siteId))) {
                return false;
            }
            return true;
        };

        const ensureSheet = (
            contractorId: string,
            contractorName: string,
            siteId: string,
            siteName: string,
            teamId: string,
            teamName: string
        ): InternalSheet => {
            const key = `${contractorId || contractorName || 'no-contractor'}__${siteId || 'no-site'}__${teamId || 'no-team'}`;
            const existing = sheetMap.get(key);
            if (existing) {
                return existing;
            }
            const meta: SupportClaimSheet = {
                sheetId: key,
                contractorId,
                contractorName: contractorName || '시공사 미지정',
                siteId,
                siteName: siteName || '현장 미지정',
                teamId,
                teamName: teamName || '팀 미지정',
                period: {
                    start: period.start,
                    end: period.end,
                    month: filters.month
                },
                rows: [],
                stats: {
                    totalWorkers: 0,
                    totalManDay: 0,
                    totalAmount: 0
                }
            };
            const internal: InternalSheet = {
                meta,
                rowMap: new Map<string, InternalRow>()
            };
            sheetMap.set(key, internal);
            return internal;
        };

        const getWorkerProfile = (workerId?: string, workerName?: string): Worker | undefined => {
            if (workerId) {
                const byId = workerMaps.byId.get(workerId);
                if (byId) return byId;
            }
            const normalized = normalizeName(workerName);
            if (!normalized) return undefined;
            return workerMaps.byName.get(normalized);
        };

        const recordIssue = (type: SupportClaimIssueType, context: { workerName: string; contractorName: string; teamName: string; siteName: string }) => {
            const key = `${type}-${context.workerName}-${context.teamName}-${context.siteName}-${context.contractorName}`;
            if (issueSet.has(key)) return;
            issueSet.add(key);
            let message = '';
            switch (type) {
                case 'MISSING_ID_NUMBER':
                    message = '주민등록번호가 누락되었습니다.';
                    break;
                case 'MISSING_ADDRESS':
                    message = '주소가 누락되었습니다.';
                    break;
                case 'MISSING_UNIT_PRICE':
                    message = '단가 정보가 없어 총액 계산이 불완전합니다.';
                    break;
                default:
                    message = '필수 정보가 누락되었습니다.';
            }
            issues.push({ type, message, ...context });
        };

        const getUnitPrice = (workerEntry: DailyReportWorker, team?: Team, workerProfile?: Worker) => {
            if (typeof workerEntry.unitPrice === 'number' && Number.isFinite(workerEntry.unitPrice)) {
                return workerEntry.unitPrice;
            }
            if (typeof workerProfile?.unitPrice === 'number' && Number.isFinite(workerProfile.unitPrice)) {
                return workerProfile.unitPrice;
            }
            if (typeof team?.supportRate === 'number' && Number.isFinite(team.supportRate)) {
                return team.supportRate;
            }
            return 0;
        };

        reports.forEach((report: DailyReport) => {
            report.workers.forEach((reportWorker) => {
                const workerTeamId = reportWorker.teamId || report.teamId || '';
                const team = workerTeamId ? teamMap.get(workerTeamId) : undefined;

                if (!isSupportEntry(reportWorker, team)) {
                    return;
                }

                const contractorId = team?.companyId || report.companyId || '';
                const contractorName = team?.companyName || report.companyName || (contractorId ? companyMap.get(contractorId)?.name : '') || '시공사 미지정';
                const siteId = report.siteId || '';
                const siteName = report.siteName || '';

                if (!shouldInclude(contractorId, workerTeamId, siteId)) {
                    return;
                }

                const workerProfile = getWorkerProfile(reportWorker.workerId, reportWorker.name);
                const sheet = ensureSheet(contractorId, contractorName, siteId, siteName, workerTeamId, team?.name || report.teamName || '팀 미지정');

                const rowKey = reportWorker.workerId || `${workerTeamId}-${reportWorker.name}`;
                let row = sheet.rowMap.get(rowKey);
                if (!row) {
                    row = {
                        workerId: reportWorker.workerId || rowKey,
                        name: reportWorker.name || workerProfile?.name || '이름 미상',
                        idNumber: workerProfile?.idNumber,
                        contact: workerProfile?.contact,
                        address: workerProfile?.address,
                        role: reportWorker.role || workerProfile?.role,
                        teamName: team?.name || report.teamName || '팀 미지정',
                        unitPrice: 0,
                        totalManDay: 0,
                        totalAmount: 0,
                        dailyManDays: Array.from({ length: daysInMonth }, () => 0),
                        flags: {},
                        amountAccumulator: 0,
                        unitSamples: []
                    };
                    sheet.rowMap.set(rowKey, row);
                }

                const reportDay = Number(report.date?.split('-')[2]);
                if (Number.isFinite(reportDay) && reportDay >= 1 && reportDay <= daysInMonth) {
                    row.dailyManDays[reportDay - 1] += reportWorker.manDay || 0;
                }

                const unitPrice = getUnitPrice(reportWorker, team, workerProfile);
                const manDay = typeof reportWorker.manDay === 'number' && Number.isFinite(reportWorker.manDay) ? reportWorker.manDay : 0;
                const amount = manDay * unitPrice;

                if (unitPrice > 0) {
                    row.unitSamples.push(unitPrice);
                }

                row.totalManDay += manDay;
                row.amountAccumulator += amount;

                if (!row.idNumber) {
                    row.flags.missingIdNumber = true;
                    recordIssue('MISSING_ID_NUMBER', {
                        workerName: row.name,
                        contractorName,
                        teamName: row.teamName,
                        siteName
                    });
                }
                if (!row.address) {
                    row.flags.missingAddress = true;
                    recordIssue('MISSING_ADDRESS', {
                        workerName: row.name,
                        contractorName,
                        teamName: row.teamName,
                        siteName
                    });
                }
                if (unitPrice === 0) {
                    row.flags.missingUnitPrice = true;
                    recordIssue('MISSING_UNIT_PRICE', {
                        workerName: row.name,
                        contractorName,
                        teamName: row.teamName,
                        siteName
                    });
                }
            });
        });

        const sheets: SupportClaimSheet[] = Array.from(sheetMap.values()).map((internal) => {
            const rows: SupportClaimWorkerRow[] = Array.from(internal.rowMap.values())
                .map((row) => {
                    const unitPrice = row.totalManDay > 0
                        ? Math.round(row.amountAccumulator / row.totalManDay)
                        : row.unitSamples[row.unitSamples.length - 1] || 0;
                    return {
                        workerId: row.workerId,
                        name: row.name,
                        idNumber: row.idNumber,
                        contact: row.contact,
                        address: row.address,
                        role: row.role,
                        teamName: row.teamName,
                        unitPrice,
                        totalManDay: Number(row.totalManDay.toFixed(2)),
                        totalAmount: Math.round(row.amountAccumulator),
                        dailyManDays: row.dailyManDays,
                        flags: row.flags
                    };
                })
                .sort((a, b) => a.name.localeCompare(b.name, 'ko-KR'));

            const stats = rows.reduce(
                (acc, row) => {
                    acc.totalWorkers += 1;
                    acc.totalManDay += row.totalManDay;
                    acc.totalAmount += row.totalAmount;
                    return acc;
                },
                { totalWorkers: 0, totalManDay: 0, totalAmount: 0 }
            );

            return {
                ...internal.meta,
                rows,
                stats
            };
        });

        const globalStats = sheets.reduce(
            (acc, sheet) => {
                acc.totalSheets += 1;
                acc.totalWorkers += sheet.stats.totalWorkers;
                acc.totalManDay += sheet.stats.totalManDay;
                acc.totalAmount += sheet.stats.totalAmount;
                return acc;
            },
            { totalSheets: 0, totalWorkers: 0, totalManDay: 0, totalAmount: 0 }
        );

        return {
            month: filters.month,
            period,
            sheets,
            stats: globalStats,
            issues
        };
    }
};
