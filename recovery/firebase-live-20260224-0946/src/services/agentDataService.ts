// 에이전트를 위한 Firebase 데이터 조회 서비스
import { DailyReport, dailyReportService } from '../services/dailyReportService';
import { manpowerService, Worker } from '../services/manpowerService';
import { siteService, Site } from '../services/siteService';
import { teamService, Team } from '../services/teamService';
import { workerSiteAssignmentService } from './workerSiteAssignmentService';

/**
 * 일보 데이터 조회
 */
export async function queryDailyReports(params: {
    startDate?: string;  // YYYY-MM-DD
    endDate?: string;    // YYYY-MM-DD
    siteId?: string;
    teamId?: string;
    limitCount?: number;
}): Promise<DailyReport[]> {
    try {
        const start = params.startDate ?? '0000-01-01';
        const end = params.endDate ?? '9999-12-31';

        let reports = await dailyReportService.getReportsByRange(start, end, params.teamId, params.siteId);

        if (params.limitCount) {
            reports = reports.slice(0, params.limitCount);
        }

        return reports;
    } catch (error) {
        console.error('Error querying daily reports:', error);
        throw error;
    }
}

/**
 * 작업자 데이터 조회
 */
export async function queryWorkers(params: {
    status?: string;      // '재직', '퇴사', '미배정'
    teamId?: string;
    siteId?: string;
    role?: string;
    limitCount?: number;
}): Promise<Worker[]> {
    try {
        let workers = await manpowerService.getWorkers();

        if (params.status) {
            workers = workers.filter(w => String(w.status ?? '') === String(params.status));
        }

        if (params.teamId) {
            const key = String(params.teamId);
            workers = workers.filter(w => String(w.teamId ?? '') === key);
        }

        if (params.role) {
            const key = String(params.role);
            workers = workers.filter(w => String(w.role ?? '') === key);
        }

        if (params.siteId) {
            const assignments = await workerSiteAssignmentService.getActiveAssignmentsBySite(String(params.siteId));
            const allowed = new Set<string>();
            assignments.forEach(a => {
                if (a.workerId) allowed.add(String(a.workerId));
                if ((a as any).workerLegacyId) allowed.add(String((a as any).workerLegacyId));
            });
            workers = workers.filter(w => {
                const id = w.id ? String(w.id) : '';
                const legacy = (w as any).legacyId ? String((w as any).legacyId) : '';
                return (id && allowed.has(id)) || (legacy && allowed.has(legacy));
            });
        }

        if (params.limitCount) {
            workers = workers.slice(0, params.limitCount);
        }

        return workers;
    } catch (error) {
        console.error('Error querying workers:', error);
        throw error;
    }
}

/**
 * 현장 데이터 조회
 */
export async function querySites(params: {
    companyId?: string;
    active?: boolean;
    limitCount?: number;
}): Promise<Site[]> {
    try {
        let sites = await siteService.getSites();

        if (params.companyId) {
            const key = String(params.companyId);
            sites = sites.filter(s => String(s.companyId ?? '') === key);
        }

        if (params.active === true) {
            sites = sites.filter(s => String(s.status ?? '') === 'active');
        }
        if (params.active === false) {
            sites = sites.filter(s => String(s.status ?? '') !== 'active');
        }

        if (params.limitCount) {
            sites = sites.slice(0, params.limitCount);
        }

        return sites;
    } catch (error) {
        console.error('Error querying sites:', error);
        throw error;
    }
}

/**
 * 팀 데이터 조회
 */
export async function queryTeams(params: {
    companyId?: string;
    type?: string;
    limitCount?: number;
}): Promise<Team[]> {
    try {
        let teams = await teamService.getTeams();

        if (params.companyId) {
            const key = String(params.companyId);
            teams = teams.filter(t => String(t.companyId ?? '') === key);
        }

        if (params.type) {
            const key = String(params.type);
            teams = teams.filter(t => String(t.type ?? '') === key);
        }

        if (params.limitCount) {
            teams = teams.slice(0, params.limitCount);
        }

        return teams;
    } catch (error) {
        console.error('Error querying teams:', error);
        throw error;
    }
}

/**
 * 통계 데이터 생성
 */
export async function getStatistics(params: {
    startDate?: string;
    endDate?: string;
}): Promise<{
    totalManDays: number;
    totalWorkers: number;
    totalSites: number;
    totalTeams: number;
}> {
    try {
        const [reports, workers, sites, teams] = await Promise.all([
            queryDailyReports({ startDate: params.startDate, endDate: params.endDate }),
            queryWorkers({ status: '재직' }),
            querySites({}),
            queryTeams({})
        ]);

        const totalManDays = reports.reduce((sum, report) => {
            const workers = report.workers || [];
            return sum + workers.reduce((s, w) => s + (w.manDay || 0), 0);
        }, 0);

        return {
            totalManDays,
            totalWorkers: workers.length,
            totalSites: sites.length,
            totalTeams: teams.length
        };
    } catch (error) {
        console.error('Error getting statistics:', error);
        throw error;
    }
}

/**
 * 팀 간 공수 이동 분석
 * 예: "김봉수팀이 이재욱팀으로 일하러간 공수"
 */
export async function analyzeCrossTeamManDays(params: {
    fromTeamName: string;  // 출발 팀 (소속 팀)
    toTeamName: string;    // 도착 팀 (일한 팀)
    startDate?: string;
    endDate?: string;
}): Promise<{
    totalManDays: number;
    workerDetails: Array<{
        workerName: string;
        manDays: number;
        dates: string[];
    }>;
}> {
    try {
        console.log('[Cross Team Analysis] Analyzing:', params);

        // 1. 팀 찾기
        const allTeams = await queryTeams({});
        const fromTeam = allTeams.find(t => t.name.includes(params.fromTeamName));
        const toTeam = allTeams.find(t => t.name.includes(params.toTeamName));

        if (!fromTeam) {
            throw new Error(`"${params.fromTeamName}" 팀을 찾을 수 없습니다`);
        }
        if (!toTeam) {
            throw new Error(`"${params.toTeamName}" 팀을 찾을 수 없습니다`);
        }

        console.log('[Cross Team] From:', fromTeam.name, '/', 'To:', toTeam.name);

        // 2. 출발 팀 소속 작업자 목록
        const fromTeamWorkers = await queryWorkers({ teamId: fromTeam.id });
        const workerIds = fromTeamWorkers.map(w => w.id);
        const workerMap = new Map(fromTeamWorkers.map(w => [w.id, w.name]));

        console.log('[Cross Team] Workers from source team:', workerIds.length);

        // 3. 도착 팀의 일보 조회 (날짜 필터 없이 전체 조회 후 메모리 필터링)
        let toTeamReports = await queryDailyReports({ teamId: toTeam.id });

        // 메모리에서 날짜 필터링
        if (params.startDate || params.endDate) {
            const startTime = params.startDate ? new Date(params.startDate).getTime() : 0;
            const endTime = params.endDate ? new Date(params.endDate).getTime() : Date.now();

            toTeamReports = toTeamReports.filter(report => {
                if (!report.date) return false;
                const reportTime = new Date(report.date).getTime();
                return reportTime >= startTime && reportTime <= endTime;
            });
        }

        console.log('[Cross Team] Daily reports from target team:', toTeamReports.length);

        // 4. 크로스 공수 집계
        const workerManDays = new Map<string, { manDays: number; dates: string[] }>();

        toTeamReports.forEach(report => {
            const reportWorkers = report.workers || [];
            reportWorkers.forEach(w => {
                // 출발 팀 소속 작업자가 도착 팀 일보에 있는 경우
                if (workerIds.includes(w.workerId)) {
                    const current = workerManDays.get(w.workerId) || { manDays: 0, dates: [] };
                    current.manDays += w.manDay || 0;
                    if (report.date) {
                        const dateStr = new Date(report.date).toLocaleDateString('ko-KR');
                        current.dates.push(dateStr);
                    }
                    workerManDays.set(w.workerId, current);
                }
            });
        });

        // 5. 결과 정리
        const workerDetails = Array.from(workerManDays.entries()).map(([workerId, data]) => ({
            workerName: workerMap.get(workerId) || workerId,
            manDays: data.manDays,
            dates: data.dates
        }));

        const totalManDays = workerDetails.reduce((sum, w) => sum + w.manDays, 0);

        console.log('[Cross Team] Total man-days:', totalManDays);

        return {
            totalManDays,
            workerDetails
        };

    } catch (error) {
        console.error('Error analyzing cross team man-days:', error);
        throw error;
    }
}

/**
 * 작업자 급여 조회
 */
export async function queryWorkerSalary(params: {
    workerName: string;
    month: string;  // "2024-11" 형식
}): Promise<{
    workerInfo: {
        name: string;
        team: string;
        unitPrice: number;
    };
    workDays: {
        totalDays: number;
        totalManDays: number;
        dates: string[];
    };
    salary: {
        grossPay: number;
        advances: number;
        tax: number;
        netPay: number;
    };
    breakdown: Array<{
        date: string;
        siteName: string;
        manDay: number;
        amount: number;
    }>;
}> {
    try {
        console.log('[Salary Query] Worker:', params.workerName, 'Month:', params.month);

        // 1. 작업자 찾기
        const allWorkers = await queryWorkers({ status: '재직', limitCount: 500 });
        const worker = allWorkers.find(w => w.name.includes(params.workerName));

        if (!worker) {
            throw new Error(`"${params.workerName}" 작업자를 찾을 수 없습니다`);
        }

        console.log('[Salary Query] Found worker:', worker.name, worker.id);

        // 2. 날짜 범위 계산
        const [year, month] = params.month.split('-').map(Number);
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0); // 해당 월의 마지막 날

        const startStr = startDate.toISOString().split('T')[0];
        const endStr = endDate.toISOString().split('T')[0];

        console.log('[Salary Query] Date range:', startStr, '~', endStr);

        // 3. 해당 월 일보 조회
        const allReports = await queryDailyReports({
            startDate: startStr,
            endDate: endStr,
            limitCount: 1000
        });

        // 4. 해당 작업자 공수만 필터링
        const workerReports: Array<{
            date: string;
            siteName: string;
            manDay: number;
            unitPrice: number;
        }> = [];

        let totalManDays = 0;
        const workDates = new Set<string>();

        allReports.forEach(report => {
            const workers = report.workers || [];
            const workerData = workers.find(w => w.workerId === worker.id);

            if (workerData && workerData.manDay > 0) {
                const dateStr = new Date(report.date).toLocaleDateString('ko-KR');
                workDates.add(dateStr);
                totalManDays += workerData.manDay;

                workerReports.push({
                    date: dateStr,
                    siteName: report.siteName,
                    manDay: workerData.manDay,
                    unitPrice: workerData.unitPrice || worker.unitPrice || 0
                });
            }
        });

        console.log('[Salary Query] Total man-days:', totalManDays);

        // 5. 급여 계산
        const unitPrice = worker.unitPrice || 0;
        const grossPay = Math.round(totalManDays * unitPrice);

        // 6. 가불 (임시로 0 - 실제로는 별도 조회 필요)
        const advances = 0;

        // 7. 세금 계산 (3.3%)
        const tax = Math.round(grossPay * 0.033);

        // 8. 실수령액
        const netPay = grossPay - advances - tax;

        // 9. 상세 내역
        const breakdown = workerReports.map(r => ({
            date: r.date,
            siteName: r.siteName,
            manDay: r.manDay,
            amount: Math.round(r.manDay * r.unitPrice)
        }));

        // 10. 팀 정보 조회
        let teamName = '미배정';
        if (worker.teamId) {
            const teams = await queryTeams({});
            const team = teams.find(t => t.id === worker.teamId);
            if (team) teamName = team.name;
        }

        return {
            workerInfo: {
                name: worker.name,
                team: teamName,
                unitPrice: unitPrice
            },
            workDays: {
                totalDays: workDates.size,
                totalManDays: totalManDays,
                dates: Array.from(workDates).sort()
            },
            salary: {
                grossPay,
                advances,
                tax,
                netPay
            },
            breakdown
        };

    } catch (error) {
        console.error('[Salary Query] Error:', error);
        throw error;
    }
}

// 에이전트가 사용 가능한 함수 목록
export const agentDataTools = {
    queryDailyReports,
    queryWorkers,
    querySites,
    queryTeams,
    getStatistics,
    analyzeCrossTeamManDays,
    queryWorkerSalary
};
