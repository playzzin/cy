import { freelancerFirestoreService } from './freelancerFirestoreService';
import { Freelancer, FreelancerPayment } from '../types/freelancer';
import { DailyReportWorkerRow } from './dailyReportService';

/**
 * FreelancerService - Firestore 통합 버전
 * 모든 요청을 freelancerFirestoreService로 위임합니다.
 */
export const freelancerService = {
    async getFreelancers(): Promise<Freelancer[]> {
        return freelancerFirestoreService.getFreelancers();
    },

    async getFreelancer(id: string): Promise<Freelancer | null> {
        return freelancerFirestoreService.getFreelancer(id);
    },

    async createFreelancer(data: Omit<Freelancer, 'id' | 'createdAt' | 'updatedAt' | 'status'>): Promise<string> {
        return freelancerFirestoreService.createFreelancer(data as any);
    },

    async updateFreelancer(id: string, data: Partial<Freelancer>): Promise<void> {
        return freelancerFirestoreService.updateFreelancer(id, data);
    },

    async deleteFreelancer(id: string): Promise<void> {
        return freelancerFirestoreService.deleteFreelancer(id);
    },

    // --- Payments ---

    async getPayments(freelancerId?: string, year?: number, month?: number): Promise<FreelancerPayment[]> {
        return freelancerFirestoreService.getPayments(freelancerId, year, month);
    },

    async createPayment(data: Omit<FreelancerPayment, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
        return freelancerFirestoreService.createPayment(data);
    },

    async updatePayment(id: string, data: Partial<FreelancerPayment>): Promise<void> {
        return freelancerFirestoreService.updatePayment(id, data);
    },

    async deletePayment(id: string): Promise<void> {
        return freelancerFirestoreService.deletePayment(id);
    },

    /**
     * 특정 프리랜서의 특정 월 출력일보 실적을 합산합니다.
     */
    async getFreelancerPerformance(freelancerId: string, year: number, month: number): Promise<{ totalGongsu: number, totalAmount: number }> {
        const { dailyReportService } = await import('./dailyReportService');
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;

        const rows = await dailyReportService.getReportWorkerRowsByRange({
            startDate,
            endDate
        });

        const freelancer = await this.getFreelancer(freelancerId);
        const targetIds = [freelancerId];
        if (freelancer?.legacyId) targetIds.push(freelancer.legacyId);

        const filtered = rows.filter((r: DailyReportWorkerRow) => targetIds.includes(r.workerId));

        const totalGongsu = filtered.reduce((sum: number, r: DailyReportWorkerRow) => sum + (Number(r.manDay) || 0), 0);
        const totalAmount = filtered.reduce((sum: number, r: DailyReportWorkerRow) => sum + (Number(r.amount) || 0), 0);

        return { totalGongsu, totalAmount };
    },

    async getTeamMonthlyPerformance(teamId: string, year: number, month: number): Promise<Map<string, { totalGongsu: number, totalAmount: number }>> {
        const { dailyReportService } = await import('./dailyReportService');
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;

        const rows = await dailyReportService.getReportWorkerRowsByRange({
            startDate,
            endDate,
            teamId
        });

        const performanceMap = new Map<string, { totalGongsu: number, totalAmount: number }>();
        rows.forEach((r: DailyReportWorkerRow) => {
            const wId = r.workerId;
            if (!wId) return;
            const current = performanceMap.get(wId) || { totalGongsu: 0, totalAmount: 0 };
            performanceMap.set(wId, {
                totalGongsu: current.totalGongsu + (Number(r.manDay) || 0),
                totalAmount: current.totalAmount + (Number(r.amount) || 0)
            });
        });

        return performanceMap;
    },

    async getFreelancerManagerData(year: number, month: number): Promise<{
        freelancers: any[];
        teams: any[];
        companies: any[];
    }> {
        const [freelancersRaw, paymentsRaw] = await Promise.all([
            this.getFreelancers(),
            this.getPayments(undefined, year, month)
        ]);

        const { teamService } = await import('./teamService');
        const allTeams = await teamService.getTeams();

        const freelancers = freelancersRaw.map(f => {
            const p = paymentsRaw.find(pay => pay.freelancerId === f.id);
            const team = allTeams.find(t => t.id === f.teamId || (f.legacyId && t.legacyId === f.teamId));

            const amount = p?.amount || 0;
            const performanceBonus = p?.performanceBonus || 0;
            const total = amount + performanceBonus;
            const tax = Math.floor(total * 0.03);
            const localTax = Math.floor(tax * 0.1);
            const netPay = total - (tax + localTax);

            return {
                ...f,
                teamName: team?.name || f.teamName || '소속 없음',
                companyName: team?.companyName || '업체 미지정',
                paymentId: p?.id,
                dailyRate: p?.dailyRate ?? f.unitPrice ?? 0,
                manDays: p?.manDays ?? 0,
                amount,
                performanceBonus,
                total,
                tax,
                localTax,
                netPay,
                reportingBalance: p?.reportingBalance ?? 0,
                reportableAmount: p?.reportableAmount ?? 0,
                depositDate: p?.depositDate,
                paymentMemo: p?.memo
            };
        });

        const companyMap = new Map();
        allTeams.forEach(t => {
            if (t.companyId) {
                if (!companyMap.has(t.companyId)) {
                    companyMap.set(t.companyId, { id: t.companyId, name: t.companyName, teams: [] });
                }
                companyMap.get(t.companyId).teams.push({ id: t.id, name: t.name });
            }
        });

        return {
            freelancers,
            teams: allTeams,
            companies: Array.from(companyMap.values())
        };
    },

    async getFreelancerYearlyData(year: number): Promise<{
        freelancers: any[];
        companies: any[];
    }> {
        const [freelancersRaw, paymentsRaw] = await Promise.all([
            this.getFreelancers(),
            this.getPayments(undefined, year)
        ]);

        const { teamService } = await import('./teamService');
        const allTeams = await teamService.getTeams();

        const freelancers = freelancersRaw.map(f => {
            const fPayments = paymentsRaw.filter(p => p.freelancerId === f.id);

            const monthlyPayments: any = {};
            for (let i = 1; i <= 12; i++) {
                const monthKey = `m${String(i).padStart(2, '0')}`;
                const payment = fPayments.find(p => p.month === i);
                monthlyPayments[monthKey] = payment?.amount ?? 0;
                monthlyPayments[`${monthKey}_id`] = payment?.id ?? null;
            }

            const monthlyTotal = Object.values(monthlyPayments).reduce((sum: any, val: any) =>
                typeof val === 'number' ? sum + val : sum, 0);

            const m12Payment = fPayments.find(p => p.month === 12);
            const sortedPayments = [...fPayments].sort((a, b) => b.month - a.month);
            const latestPayment = sortedPayments.length > 0 ? sortedPayments[0] : null;
            const summarySource = m12Payment || latestPayment;

            const team = allTeams.find(t => t.id === f.teamId || (f.legacyId && t.legacyId === f.teamId));

            return {
                ...f,
                teamName: team?.name || f.teamName || '소속 없음',
                companyName: team?.companyName || '업체 미지정',
                total: (monthlyTotal as number) + (summarySource?.performanceBonus ?? 0),
                ...monthlyPayments,
                monthlyRate: summarySource?.dailyRate ?? f.unitPrice ?? 0,
                performanceBonus: summarySource?.performanceBonus ?? 0,
                reportingBalance: summarySource?.reportingBalance ?? 0,
                reportableAmount: summarySource?.reportableAmount ?? 0,
                depositDate: summarySource?.depositDate,
                paymentMemo: summarySource?.memo,
                latestPaymentId: summarySource?.id ?? null,
                latestMonth: summarySource?.month ?? null
            };
        });

        const companyMap = new Map();
        allTeams.forEach(t => {
            if (t.companyId) {
                if (!companyMap.has(t.companyId)) {
                    companyMap.set(t.companyId, { id: t.companyId, name: t.companyName, teams: [] });
                }
                companyMap.get(t.companyId).teams.push({ id: t.id, name: t.name });
            }
        });

        return {
            freelancers,
            companies: Array.from(companyMap.values())
        };
    },

    async saveYearlyPayments(year: number, modifiedData: any[]) {
        await freelancerFirestoreService.saveYearlyPaymentsBatch(year, modifiedData);
        return { success: true };
    },

    async getMonthlyFreelancerData(year: number, month: number): Promise<any[]> {
        const { freelancers } = await this.getFreelancerManagerData(year, month);
        return freelancers;
    },

    async getMonthlySalaryWorkAmountsByTeam(teamId: string, year: number): Promise<Map<string, { [month: number]: number }>> {
        const summary = await this.getTaxReportWorkSummaryByYear(year, teamId);
        return summary.workerMonthlyAmounts;
    },

    /**
     * 연간 월별 급여 집계(일보 기반) - Firestore 연동 버전
     */
    async getTaxReportWorkSummaryByYear(year: number, teamId?: string): Promise<{
        teams: Array<{ id: string; name: string }>;
        workerMonthlyAmounts: Map<string, { [month: number]: number }>;
        workerMetaById: Map<string, { id: string; name: string; teamId?: string; teamName?: string }>;
        workerMonthlyAmountsByNameTeam: Map<string, { [month: number]: number }>;
    }> {
        const workerMonthlyAmounts = new Map<string, { [month: number]: number }>();
        const workerMetaById = new Map<string, { id: string; name: string; teamId?: string; teamName?: string }>();
        const workerMonthlyAmountsByNameTeam = new Map<string, { [month: number]: number }>();
        const teamNameById = new Map<string, string>();

        try {
            const { dailyReportService } = await import('./dailyReportService');
            const { manpowerService } = await import('./manpowerService');
            const startDate = `${year}-01-01`;
            const endDate = `${year}-12-31`;

            const rows = await dailyReportService.getReportWorkerRowsByRange({
                startDate,
                endDate,
                teamId
            });

            const toFiniteNumber = (value: unknown, fallback = 0): number => {
                if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
                if (typeof value === 'string') {
                    const cleaned = value.replace(/,/g, '').trim();
                    if (!cleaned) return fallback;
                    const parsed = Number(cleaned.replace(/[^0-9.-]/g, ''));
                    return Number.isFinite(parsed) ? parsed : fallback;
                }
                return fallback;
            };

            const workersMaster = await manpowerService.getWorkers();
            const freelancersMaster = await this.getFreelancers();

            // 모든 작업자/프리랜서 마스터 정보 통합 맵핑
            const workerMasterById = new Map<string, any>();
            const addWorkerToMap = (w: any) => {
                if (w?.id) workerMasterById.set(String(w.id), w);
                if (w?.legacyId) workerMasterById.set(String(w.legacyId), w);
            };
            workersMaster.forEach(addWorkerToMap);
            freelancersMaster.forEach(addWorkerToMap);

            rows.forEach((row: DailyReportWorkerRow) => {
                const date = row.date ? String(row.date) : '';
                if (!date || date.length < 7) return;
                const month = Number(date.slice(5, 7));
                if (!month || month < 1 || month > 12) return;

                const workerId = row.workerId ? String(row.workerId) : '';
                const workerMaster = workerId ? workerMasterById.get(workerId) : null;
                const workerName = row.workerName || workerMaster?.name || 'Unknown';
                const workerKey = workerId || workerName;

                if (!workerMonthlyAmounts.has(workerKey)) {
                    const bucket: { [m: number]: number } = {};
                    for (let m = 1; m <= 12; m++) bucket[m] = 0;
                    workerMonthlyAmounts.set(workerKey, bucket);
                }

                if (!workerMetaById.has(workerKey)) {
                    workerMetaById.set(workerKey, {
                        id: workerKey,
                        name: workerName,
                        teamId: row.workerTeamId || row.teamId,
                        teamName: row.workerTeamName || row.teamName
                    });
                }

                const monthlyAmounts = workerMonthlyAmounts.get(workerKey)!;
                const rowAmount = toFiniteNumber(row.amount, 0);
                const manDay = toFiniteNumber(row.manDay, 0);
                const unitPrice = toFiniteNumber(row.unitPrice || workerMaster?.unitPrice, 0);

                // 정산 로직: 명시적 amount가 있으면 우선, 없으면 공수*단가
                const amount = rowAmount > 0 ? rowAmount : (manDay * unitPrice);
                monthlyAmounts[month] += amount;

                if (row.workerTeamId && row.workerTeamName) {
                    teamNameById.set(row.workerTeamId, row.workerTeamName);
                }
            });

            return {
                teams: Array.from(teamNameById.entries()).map(([id, name]) => ({ id, name })),
                workerMonthlyAmounts,
                workerMetaById,
                workerMonthlyAmountsByNameTeam: new Map() // 레거시 호환용 빈 맵
            };
        } catch (error) {
            console.error('getTaxReportWorkSummaryByYear Error:', error);
            throw error;
        }
    }
};
