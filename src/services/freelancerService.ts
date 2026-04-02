import { freelancerFirestoreService } from './freelancerFirestoreService';
import { Freelancer, FreelancerPayment } from '../types/freelancer';
import { DailyReportWorkerRow } from './dailyReportService';

const normalizeKoreanToken = (value: unknown): string =>
    String(value ?? '').trim().replace(/\s+/g, '');

const isCorporateInvoiceSiteRow = (row: Partial<DailyReportWorkerRow>): boolean => {
    const paymentType = normalizeKoreanToken(row.paymentType);
    const siteType = normalizeKoreanToken(row.siteType);

    const isInvoicePayment = paymentType.includes('계산서');
    const isSiteWork = siteType.includes('현장');

    return isInvoicePayment && isSiteWork;
};

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
        const { dailyReportService } = await import('./dailyReportService');
        const { teamService } = await import('./teamService');
        const { manpowerService } = await import('./manpowerService');

        // 모든 데이터 병렬 로드 (단일 진실의 원천)
        const [freelancersRaw, paymentsRaw, allTeams, workersRaw, reportRows] = await Promise.all([
            this.getFreelancers(),
            this.getPayments(undefined, year),
            teamService.getTeams(),
            manpowerService.getWorkers(true),
            dailyReportService.getReportWorkerRowsByRange({
                startDate: `${year}-01-01`,
                endDate: `${year}-12-31`
            })
        ]);

        const toNum = (v: unknown): number => {
            if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
            if (typeof v === 'string') {
                const n = Number(v.replace(/,/g, '').replace(/[^0-9.-]/g, ''));
                return Number.isFinite(n) ? n : 0;
            }
            return 0;
        };

        const normalizeSalaryModel = (value: unknown): string => {
            const raw = typeof value === 'string' ? value.trim() : '';
            if (!raw) return '';
            if (raw.includes('월급')) return '월급제';
            if (raw.includes('일급')) return '일급제';
            return raw;
        };

        const resolveSalaryModel = (...values: unknown[]): string => {
            for (const value of values) {
                const normalized = normalizeSalaryModel(value);
                if (normalized) return normalized;
            }
            return '';
        };

        const getLatestMonthlySalaryModel = (
            salaryModels: { [m: number]: string } | undefined,
            fallback: string
        ): string => {
            if (salaryModels) {
                for (let i = 12; i >= 1; i--) {
                    const normalized = normalizeSalaryModel(salaryModels[i]);
                    if (normalized) return normalized;
                }
            }
            return fallback;
        };

        // ── Step 1: FreelancerPayment → 월별 금액 맵 ──────────────────────
        const paymentMap = new Map<string, {
            amounts: { [m: number]: number };
            ids: { [m: number]: string };
            allPayments: FreelancerPayment[];
        }>();

        paymentsRaw.forEach(p => {
            const key = p.freelancerId;
            if (!key) return;
            if (!paymentMap.has(key)) {
                paymentMap.set(key, { amounts: {}, ids: {}, allPayments: [] });
            }
            const entry = paymentMap.get(key)!;
            entry.allPayments.push(p);
            const m = p.month;
            if (m >= 1 && m <= 12) {
                // 월급제/일급제 구별없이: amount > 0이면 사용, 아니면 dailyRate × manDays
                const payAmt = toNum(p.amount);
                const calcAmt = toNum(p.dailyRate) > 0 && toNum(p.manDays) > 0
                    ? toNum(p.dailyRate) * toNum(p.manDays) : 0;
                const resolved = payAmt > 0 ? payAmt : calcAmt;
                entry.amounts[m] = Math.max(entry.amounts[m] || 0, resolved);
                if (!entry.ids[m] && p.id) entry.ids[m] = p.id;
            }
        });

        // ── Step 2: 일보 작업자 행 → 월별 금액 맵 ───────────────────────
        const reportMap = new Map<string, {
            amounts: { [m: number]: number };
            meta: { name: string; teamId: string; teamName: string; salaryModel: string; salaryModels: { [m: number]: string } };
        }>();

        const workerMasterById = new Map<string, any>();
        const addWorkerMaster = (worker: any) => {
            if (!worker) return;
            if (worker.id) workerMasterById.set(String(worker.id), worker);
            if (worker.legacyId) workerMasterById.set(String(worker.legacyId), worker);
        };

        workersRaw.forEach(addWorkerMaster);
        freelancersRaw.forEach(addWorkerMaster);

        (reportRows as DailyReportWorkerRow[]).forEach(row => {
            // 세무 프리랜서 집계는 "법인 계산서 현장" 금액만 반영한다.
            if (!isCorporateInvoiceSiteRow(row)) return;

            const date = String(row.date || '');
            if (date.length < 7) return;
            const month = Number(date.slice(5, 7));
            if (month < 1 || month > 12) return;
            const workerId = String(row.workerId || '').trim();
            if (!workerId) return;

            if (!reportMap.has(workerId)) {
                reportMap.set(workerId, {
                    amounts: {},
                    meta: {
                        name: row.workerName || '',
                        teamId: row.workerTeamId || row.teamId || '',
                        teamName: row.workerTeamName || row.teamName || '',
                        salaryModel: normalizeSalaryModel(row.salaryModel || row.payType),
                        salaryModels: {}
                    }
                });
            }
            const entry = reportMap.get(workerId)!;
            const amt = toNum(row.amount) > 0 ? toNum(row.amount) : (toNum(row.manDay) * toNum(row.unitPrice));
            const rowSalaryModel = resolveSalaryModel(row.salaryModel, row.payType);
            if (rowSalaryModel) {
                entry.meta.salaryModels[month] = rowSalaryModel;
                if (!entry.meta.salaryModel) {
                    entry.meta.salaryModel = rowSalaryModel;
                }
            }
            entry.amounts[month] = (entry.amounts[month] || 0) + amt;
        });

        // ── Step 3: 팀 조회 맵 ──────────────────────────────────────────
        const teamById = new Map<string, any>();
        allTeams.forEach(t => {
            if (t.id) teamById.set(String(t.id), t);
            if ((t as any).legacyId) teamById.set(String((t as any).legacyId), t);
        });

        // ── Step 4: 프리랜서마다 최적 월별 금액 계산 (Payment + 일보 MAX) ──
        const freelancers: any[] = [];
        const coveredWorkerIds = new Set<string>();

        freelancersRaw.forEach(f => {
            const fId = String(f.id || '').trim();
            const fLegacyId = String(f.legacyId || '').trim();

            if (fId) coveredWorkerIds.add(fId);
            if (fLegacyId) coveredWorkerIds.add(fLegacyId);

            // id 또는 legacyId로 결제/일보 데이터 조회
            const payData = paymentMap.get(fId) || paymentMap.get(fLegacyId);
            const reportData = reportMap.get(fId) || reportMap.get(fLegacyId);

            const team = teamById.get(String(f.teamId || ''));
            const workerMaster = workerMasterById.get(fId) || workerMasterById.get(fLegacyId);
            const baseSalaryModel = resolveSalaryModel(
                (f as any).salaryModel
                || (f as any).payType
                || workerMaster?.salaryModel
                || workerMaster?.payType
                || reportData?.meta.salaryModel
            );
            const salaryModel = getLatestMonthlySalaryModel(reportData?.meta.salaryModels, baseSalaryModel);

            const monthlyPayments: any = {};
            let monthlyTotal = 0;

            for (let i = 1; i <= 12; i++) {
                const mk = `m${String(i).padStart(2, '0')}`;
                const payAmt = payData?.amounts[i] || 0;
                const reportAmt = reportData?.amounts[i] || 0;
                const finalAmt = Math.max(payAmt, reportAmt); // 두 소스 중 큰 값
                monthlyPayments[mk] = finalAmt;
                monthlyPayments[`${mk}_id`] = payData?.ids[i] || null;
                monthlyPayments[`${mk}_salaryModel`] = finalAmt > 0
                    ? resolveSalaryModel(reportData?.meta.salaryModels[i], baseSalaryModel)
                    : '';
                monthlyTotal += finalAmt;
            }

            // 성과급/신고 등 요약 소스 (12월 → 최신 월 순)
            const allPmts = payData?.allPayments || [];
            const m12 = allPmts.find(p => p.month === 12);
            const latest = [...allPmts].sort((a, b) => b.month - a.month)[0] || null;
            const src = m12 || latest;

            freelancers.push({
                ...f,
                teamName: (team as any)?.name || f.teamName || '소속 없음',
                companyName: (team as any)?.companyName || '업체 미지정',
                ...monthlyPayments,
                total: monthlyTotal + toNum(src?.performanceBonus),
                monthlyRate: toNum(src?.dailyRate) || toNum(f.unitPrice),
                performanceBonus: toNum(src?.performanceBonus),
                salaryModel,
                reportingBalance: toNum(src?.reportingBalance),
                reportableAmount: toNum(src?.reportableAmount),
                depositDate: src?.depositDate || null,
                paymentMemo: src?.memo || null,
                latestPaymentId: src?.id || null,
                latestMonth: src?.month || null,
            });
        });

        // ── Step 5: 일보에만 있는 작업자 추가 ────────────────────────────
        reportMap.forEach((data, workerId) => {
            if (coveredWorkerIds.has(workerId)) return;

            const team = teamById.get(data.meta.teamId);
            const monthlyPayments: any = {};
            let monthlyTotal = 0;

            for (let i = 1; i <= 12; i++) {
                const mk = `m${String(i).padStart(2, '0')}`;
                const amt = data.amounts[i] || 0;
                monthlyPayments[mk] = amt;
                monthlyPayments[`${mk}_id`] = null;
                monthlyPayments[`${mk}_salaryModel`] = amt > 0
                    ? resolveSalaryModel(data.meta.salaryModels[i], data.meta.salaryModel)
                    : '';
                monthlyTotal += amt;
            }

            if (monthlyTotal > 0) { // 실적이 있는 작업자만 추가
                freelancers.push({
                    id: workerId,
                    name: data.meta.name,
                    teamId: data.meta.teamId,
                    teamName: data.meta.teamName || (team as any)?.name || '소속 없음',
                    companyName: (team as any)?.companyName || '업체 미지정',
                    ...monthlyPayments,
                    total: monthlyTotal,
                    salaryModel: getLatestMonthlySalaryModel(data.meta.salaryModels, normalizeSalaryModel(data.meta.salaryModel)),
                    performanceBonus: 0,
                    reportingBalance: 0,
                    reportableAmount: 0,
                    depositDate: null,
                    paymentMemo: '출력일보 자동로드',
                });
            }
        });

        // 팀별 회사 맵 구성
        const companyMap = new Map();
        allTeams.forEach(t => {
            if ((t as any).companyId) {
                if (!companyMap.has((t as any).companyId)) {
                    companyMap.set((t as any).companyId, { id: (t as any).companyId, name: (t as any).companyName, teams: [] });
                }
                companyMap.get((t as any).companyId).teams.push({ id: t.id, name: t.name });
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
            const paymentsAll = await this.getPayments(undefined, year);

            // 모든 작업자/프리랜서 마스터 정보 통합 맵핑
            const workerMasterById = new Map<string, any>();
            const addWorkerToMap = (w: any) => {
                if (w?.id) workerMasterById.set(String(w.id), w);
                if (w?.legacyId) workerMasterById.set(String(w.legacyId), w);
            };
            workersMaster.forEach(addWorkerToMap);
            freelancersMaster.forEach(addWorkerToMap);

            rows.forEach((row: DailyReportWorkerRow) => {
                // 세무 프리랜서 집계는 "법인 계산서 현장" 금액만 반영한다.
                if (!isCorporateInvoiceSiteRow(row)) return;

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

            // FreelancerPayment 직접 입력 급여 반영 (legacyId 매칭 포함)
            freelancersMaster.forEach((f: any) => {
                const fId = String(f.id);
                const fLegacyId = String(f.legacyId ?? '').trim();
                const fPayments = paymentsAll.filter((p: any) =>
                    p.freelancerId === fId ||
                    (fLegacyId && p.freelancerId === fLegacyId)
                );
                if (fPayments.length === 0) return;

                // 일보에서 이미 legacyId로 추가된 항목이 있으면 그 키 재사용 (id 중복 방지)
                const targetKey = (fLegacyId && workerMonthlyAmounts.has(fLegacyId) && !workerMonthlyAmounts.has(fId))
                    ? fLegacyId
                    : fId;

                if (!workerMonthlyAmounts.has(targetKey)) {
                    const bucket: { [m: number]: number } = {};
                    for (let m = 1; m <= 12; m++) bucket[m] = 0;
                    workerMonthlyAmounts.set(targetKey, bucket);
                }
                if (!workerMetaById.has(targetKey)) {
                    workerMetaById.set(targetKey, {
                        id: targetKey,
                        name: f.name,
                        teamId: f.teamId,
                        teamName: f.teamName
                    });
                }

                const monthlyAmounts = workerMonthlyAmounts.get(targetKey)!;
                fPayments.forEach((p: any) => {
                    const m = Number(p.month);
                    if (!m || m < 1 || m > 12) return;
                    const payAmt = toFiniteNumber(p.amount, 0);
                    const payDaily = toFiniteNumber(p.dailyRate, 0);
                    const payDays = toFiniteNumber(p.manDays, 0);
                    const resolved = payAmt > 0 ? payAmt : (payDaily > 0 && payDays > 0 ? payDaily * payDays : 0);
                    if (resolved > 0) monthlyAmounts[m] = resolved;
                });
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
