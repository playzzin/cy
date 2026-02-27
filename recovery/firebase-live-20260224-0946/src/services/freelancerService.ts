import app from '../config/firebase';
import { getDataConnect } from 'firebase/data-connect';
import {
    connectorConfig,
    listFreelancers,
    getFreelancer,
    createFreelancer,
    updateFreelancer,
    deleteFreelancer,
    listFreelancerPayments,
    createFreelancerPayment,
    updateFreelancerPayment,
    deleteFreelancerPayment,
    getFreelancerManagerData,
    getFreelancerPerformance,
    getMonthlyTeamPerformance,
    getFreelancerYearlyData,
    listTeams
} from './dataconnectCompat';
import { Freelancer, FreelancerPayment } from '../types/freelancer';
import { Timestamp } from '../types/timestamp';

const dc = getDataConnect(app, connectorConfig);

const toFirestoreTimestamp = (value?: string | null): Timestamp | null => {
    if (!value) return null;
    try {
        return Timestamp.fromDate(new Date(value));
    } catch {
        return null;
    }
};

export const freelancerService = {
    async getFreelancers(): Promise<Freelancer[]> {
        const res = await listFreelancers(dc);
        const rows = (res as any).data?.freelancers ?? [];
        return rows.map((row: any) => ({
            ...row,
            createdAt: toFirestoreTimestamp(row.createdAt),
            updatedAt: toFirestoreTimestamp(row.updatedAt)
        })) as Freelancer[];
    },

    async getFreelancer(id: string): Promise<Freelancer | null> {
        const res = await getFreelancer(dc, { id });
        const data = (res as any).data?.freelancer;
        if (!data) return null;
        return {
            ...data,
            createdAt: toFirestoreTimestamp(data.createdAt),
            updatedAt: toFirestoreTimestamp(data.updatedAt)
        } as Freelancer;
    },

    async createFreelancer(data: Omit<Freelancer, 'id' | 'createdAt' | 'updatedAt' | 'status'>): Promise<string> {
        const res = await createFreelancer(dc, {
            name: data.name,
            teamId: data.teamId ?? null,
            teamName: data.teamName ?? null,
            residentNumber: data.residentNumber ?? null,
            phone: data.phone ?? null,
            bankName: data.bankName ?? null,
            accountNumber: data.accountNumber ?? null,
            memo: data.memo ?? null
        });
        return (res as any).data.freelancer_insert.id;
    },

    async updateFreelancer(id: string, data: Partial<Freelancer>): Promise<void> {
        await updateFreelancer(dc, {
            id,
            name: data.name,
            teamId: data.teamId,
            teamName: data.teamName,
            residentNumber: data.residentNumber,
            phone: data.phone,
            bankName: data.bankName,
            accountNumber: data.accountNumber,
            status: data.status,
            memo: data.memo
        } as any);
    },

    async deleteFreelancer(id: string): Promise<void> {
        await deleteFreelancer(dc, { id });
    },

    // --- Payments ---

    async getPayments(freelancerId?: string, year?: number, month?: number): Promise<FreelancerPayment[]> {
        const res = await listFreelancerPayments(dc, { freelancerId, year, month });
        const rows = (res as any).data?.freelancerPayments ?? [];
        return rows.map((row: any) => ({
            ...row,
            createdAt: toFirestoreTimestamp(row.createdAt),
            updatedAt: toFirestoreTimestamp(row.updatedAt)
        })) as FreelancerPayment[];
    },

    async createPayment(data: Omit<FreelancerPayment, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
        const res = await createFreelancerPayment(dc, {
            freelancerId: data.freelancerId,
            year: data.year,
            month: data.month,
            dailyRate: data.dailyRate ?? null,
            manDays: data.manDays ?? null,
            amount: data.amount ?? null,
            performanceBonus: data.performanceBonus ?? null,
            reportingBalance: data.reportingBalance ?? null,
            reportableAmount: data.reportableAmount ?? null,
            depositDate: data.depositDate ?? null,
            memo: data.memo ?? null
        });
        return (res as any).data.freelancerPayment_insert.id;
    },

    async updatePayment(id: string, data: Partial<FreelancerPayment>): Promise<void> {
        await updateFreelancerPayment(dc, {
            id,
            dailyRate: data.dailyRate,
            manDays: data.manDays,
            amount: data.amount,
            performanceBonus: data.performanceBonus,
            reportingBalance: data.reportingBalance,
            reportableAmount: data.reportableAmount,
            depositDate: data.depositDate,
            memo: data.memo
        } as any);
    },

    async deletePayment(id: string): Promise<void> {
        await deleteFreelancerPayment(dc, { id });
    },

    /**
     * 특정 프리랜서의 특정 월 출력일보 실적을 가져와서 합산 공수를 반환합니다.
     */
    async getFreelancerPerformance(freelancerId: string, year: number, month: number): Promise<{ totalGongsu: number, totalAmount: number }> {
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;

        const res = await getFreelancerPerformance(dc, { freelancerId, startDate, endDate });
        const records = (res as any).data?.dailyReportWorkers ?? [];

        const totalGongsu = records.reduce((sum: number, rec: any) => sum + (rec.gongsu || 0), 0);
        const totalAmount = records.reduce((sum: number, rec: any) => sum + (rec.amount || 0), 0);

        return { totalGongsu, totalAmount };
    },

    /**
     * 특정 팀의 특정 월 전체 출력일보 실적을 가져옵니다. (세금 신고용 집계)
     */
    async getTeamMonthlyPerformance(teamId: string, year: number, month: number): Promise<Map<string, { totalGongsu: number, totalAmount: number }>> {
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;

        const res = await getMonthlyTeamPerformance(dc, { teamId, startDate, endDate });
        const records = (res as any).data?.dailyReportWorkers ?? [];

        const performanceMap = new Map<string, { totalGongsu: number, totalAmount: number }>();

        records.forEach((rec: any) => {
            const workerId = rec.worker.id;
            const current = performanceMap.get(workerId) || { totalGongsu: 0, totalAmount: 0 };
            performanceMap.set(workerId, {
                totalGongsu: current.totalGongsu + (rec.gongsu || 0),
                totalAmount: current.totalAmount + (rec.amount || 0)
            });
        });

        return performanceMap;
    },

    /**
     * Get aggregated data for the Freelancer Manager page including metadata for tabs.
     * Refactored to merge team, worker, and performance data for tax reporting.
     */
    async getFreelancerManagerData(year: number, month: number): Promise<{
        freelancers: any[];
        teams: any[];
        companies: any[];
    }> {
        const res = await getFreelancerManagerData(dc, { year, month });
        const freelancersRaw = (res as any).data?.freelancers ?? [];
        const teamsRaw = (res as any).data?.teams ?? [];

        // Pre-fetch all performance data if needed, or process after mapping
        // For efficiency, we map freelancers first
        const freelancers = freelancersRaw.map((f: any) => {
            const p = f.freelancerPayments_on_freelancer?.[0];

            // Basic financial calculations (Tax 3.3%)
            const amount = p?.amount || 0;
            const performanceBonus = p?.performanceBonus || 0;
            const total = amount + performanceBonus;
            const tax = Math.floor(total * 0.03);
            const localTax = Math.floor(tax * 0.1);
            const netPay = total - (tax + localTax);

            return {
                id: f.id,
                name: f.name,
                residentNumber: f.residentNumber,
                phone: f.phone,
                bankName: f.bankName,
                accountNumber: f.accountNumber,
                teamId: f.team?.id || null,
                teamName: f.team?.name || f.teamName || '소속 없음',
                companyId: f.team?.company?.id || null,
                companyName: f.team?.company?.name || '업체 미지정',
                paymentId: p?.id,
                dailyRate: p?.dailyRate ?? 0,
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

        // Extract unique companies and their teams
        const companyMap = new Map();
        teamsRaw.forEach((t: any) => {
            if (t.company) {
                if (!companyMap.has(t.company.id)) {
                    companyMap.set(t.company.id, {
                        id: t.company.id,
                        name: t.company.name,
                        teams: []
                    });
                }
                companyMap.get(t.company.id).teams.push({
                    id: t.id,
                    name: t.name
                });
            }
        });

        const companies = Array.from(companyMap.values());

        return {
            freelancers,
            teams: teamsRaw,
            companies: Array.from(companyMap.values())
        };
    },

    /**
     * 특정 연도의 전체 프리랜서 및 1~12월 지급 내역을 가져옵니다. (연간 대장용)
     */
    async getFreelancerYearlyData(year: number): Promise<{
        freelancers: any[];
        companies: any[];
    }> {
        try {
            const res = await getFreelancerYearlyData(dc, { year });
            const rawFreelancers = (res as any).data?.freelancers ?? [];
            const rawTeams = (res as any).data?.teams ?? [];

            const freelancers = rawFreelancers.map((f: any) => {
                const payments = f.freelancerPayments_on_freelancer ?? [];

                // 1~12월 데이터 초기화 및 ID 매핑
                const monthlyPayments: any = {};
                for (let i = 1; i <= 12; i++) {
                    const monthKey = `m${String(i).padStart(2, '0')}`;
                    const payment = payments.find((p: any) => p.month === i);
                    monthlyPayments[monthKey] = payment?.amount ?? 0;
                    monthlyPayments[`${monthKey}_id`] = payment?.id ?? null;
                }

                // 성과급 총합 (표시용 - 요약 데이터 기준)
                // const performanceBonus = payments.reduce((sum: number, p: any) => sum + (p.performanceBonus || 0), 0);

                // 연간 월 지급액 합계
                const monthlyTotal = Object.values(monthlyPayments).reduce((sum: any, val: any) =>
                    typeof val === 'number' ? sum + val : sum, 0);

                // [중요] 연간 요약 정보 (성과급, 신고잔액, 비고 등) 처리 로직 개선
                // - 월별 지급액 레코드가 늘어남에 따라 정합성이 깨지는 것을 방지하기 위해 12월 레코드를 기준으로 관리함
                const m12Payment = payments.find((p: any) => p.month === 12);

                // 12월 레코드가 없으면 가장 최근 달 레코드를 fallback으로 사용 (기존 데이터 호환성)
                const sortedPayments = [...payments].sort((a: any, b: any) => b.month - a.month);
                const latestPayment = sortedPayments.length > 0 ? sortedPayments[0] : null;
                const summarySource = m12Payment || latestPayment;

                return {
                    id: f.id,
                    name: f.name,
                    residentNumber: f.residentNumber,
                    phone: f.phone,
                    bankName: f.bankName,
                    accountNumber: f.accountNumber,
                    teamId: f.team?.id || null,
                    teamName: f.team?.name || f.teamName || '소속 없음',
                    companyId: f.team?.company?.id || null,
                    companyName: f.team?.company?.name || '업체 미지정',
                    total: monthlyTotal + (summarySource?.performanceBonus ?? 0),
                    ...monthlyPayments,
                    monthlyRate: summarySource?.dailyRate ?? 0,
                    performanceBonus: summarySource?.performanceBonus ?? 0,
                    reportingBalance: summarySource?.reportingBalance ?? 0,
                    reportableAmount: summarySource?.reportableAmount ?? 0,
                    depositDate: summarySource?.depositDate,
                    paymentMemo: summarySource?.memo,
                    latestPaymentId: summarySource?.id ?? null,
                    latestMonth: summarySource?.month ?? null
                };
            });

            // 회사 및 팀 구조 맵핑
            const companyMap = new Map();
            rawTeams.forEach((t: any) => {
                if (t.company) {
                    if (!companyMap.has(t.company.id)) {
                        companyMap.set(t.company.id, {
                            id: t.company.id,
                            name: t.company.name,
                            teams: []
                        });
                    }
                    companyMap.get(t.company.id).teams.push({
                        id: t.id,
                        name: t.name
                    });
                }
            });

            return {
                freelancers,
                companies: Array.from(companyMap.values())
            };
        } catch (error) {
            console.error('getFreelancerYearlyData Error:', error);
            throw error;
        }
    },

    /**
     * 프리랜서 연간 지급 내역 일괄 저장
     */
    async saveYearlyPayments(year: number, modifiedData: any[]) {
        // 모든 프리랜서 목록을 미리 가져와서 메모리에서 매핑 (성능 최적화)
        const existingFreelancers = await freelancerService.getFreelancers();

        for (const row of modifiedData) {
            let freelancerId = row.id;
            // temp_로 시작하는 임시 ID는 신규 생성을 위해 null로 처리
            if (freelancerId && freelancerId.toString().startsWith('temp_')) {
                freelancerId = null;
            }

            // 1. 프리랜서 마스터 정보 저장/수정 (Upsert 로직)
            const masterData = {
                name: row.name,
                residentNumber: row.residentNumber,
                bankName: row.bankName,
                accountNumber: row.accountNumber,
                teamId: row.teamId,
                teamName: row.teamName,
                unitPrice: Number(row.monthlyRate || 0)
            };

            // 기존 프리랜서 찾기 (ID 또는 이름+주민번호 기준)
            let existing = existingFreelancers.find(f =>
                f.id === freelancerId ||
                (f.name === masterData.name && f.residentNumber === masterData.residentNumber)
            );

            if (existing) {
                freelancerId = existing.id;
                // 기존 정보 업데이트
                await updateFreelancer(dc, {
                    id: freelancerId,
                    ...masterData
                } as any);
            } else if (masterData.name) {
                // 신규 생성
                try {
                    const res = await createFreelancer(dc, {
                        ...masterData,
                        phone: row.phone || null,
                        memo: row.memo || null
                    });
                    freelancerId = (res as any).data.freelancer_insert.id;
                } catch (err) {
                    console.error('Freelancer creation failed:', err);
                    continue;
                }
            }

            if (!freelancerId) continue;

            // 2. 월별 지급액 업데이트 (m01 ~ m12)
            for (let m = 1; m <= 12; m++) {
                const mk = `m${String(m).padStart(2, '0')}`;
                const amount = Number(row[mk] || 0);
                const paymentId = row[`${mk}_id`];

                if (paymentId) {
                    await updateFreelancerPayment(dc, {
                        id: paymentId,
                        amount: amount
                    });
                } else if (amount > 0) {
                    await createFreelancerPayment(dc, {
                        freelancerId: freelancerId,
                        year: year,
                        month: m,
                        amount: amount
                    });
                }
            }

            // 3. 성과급, 신고잔액, 비고 등 연간 정보 업데이트
            // - [중요] 연간 요약 정보는 항상 12월 레코드에 몰아서 저장함 (데이터 파편화 방지)
            const yearlyInfo = {
                performanceBonus: Number(row.performanceBonus || 0),
                reportingBalance: Number(row.reportingBalance || 0),
                reportableAmount: Number(row.reportableAmount || 0),
                depositDate: row.depositDate || null,
                memo: row.paymentMemo || ''
            };

            const m12Id = row.m12_id; // 이미 존재하는 12월 레코드 ID 확인

            if (m12Id) {
                // 12월 레코드가 이미 있으면 해당 레코드 업데이트
                await updateFreelancerPayment(dc, {
                    id: m12Id,
                    ...yearlyInfo,
                    dailyRate: Number(row.monthlyRate || 0)
                });
            } else {
                // 12월 레코드가 없으면 성과급/잔액 정보 보관을 위해 신규 생성 (금액은 0)
                await createFreelancerPayment(dc, {
                    freelancerId: freelancerId,
                    year: year,
                    month: 12,
                    amount: 0,
                    ...yearlyInfo,
                    dailyRate: Number(row.monthlyRate || 0)
                });
            }
        }

        return { success: true };
    },

    /**
     * 특정 년/월의 전체 프리랜서와 그들의 지급 내역을 병합하여 가져옵니다.
     */
    async getMonthlyFreelancerData(year: number, month: number): Promise<any[]> {
        const { freelancers } = await this.getFreelancerManagerData(year, month);
        return freelancers;
    },

    /**
     * Get monthly work amounts for monthly salary workers by team and year
     * Returns aggregated amounts per worker per month from daily reports
     */
    async getMonthlySalaryWorkAmountsByTeam(teamId: string, year: number): Promise<Map<string, { [month: number]: number }>> {
        try {
            const summary = await this.getTaxReportWorkSummaryByYear(year, teamId);
            return summary.workerMonthlyAmounts;
        } catch (error) {
            console.error('getMonthlySalaryWorkAmountsByTeam Error:', error);
            return new Map();
        }
    },

    /**
     * 연간 월별 급여 집계(일보 기반)
     * - 급여 = manDay * unitPrice
     * - 출력일보에 있는 모든 작업자 포함
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

            const normalizeText = (value: unknown): string => String(value ?? '').trim();
            const normalizeName = (value: unknown): string => normalizeText(value).replace(/\s+/g, '');
            const buildNameTeamKey = (name: unknown, teamKey: unknown): string => {
                const nameKey = normalizeName(name);
                const normalizedTeamKey = normalizeText(teamKey);
                if (!nameKey || !normalizedTeamKey) return '';
                return `${nameKey}::${normalizedTeamKey}`;
            };
            const toFiniteNumber = (value: unknown, fallback = 0): number => {
                if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
                if (typeof value === 'string') {
                    const cleaned = value.replace(/,/g, '').trim();
                    if (!cleaned) return fallback;
                    const numericCandidate = cleaned.replace(/[^0-9.-]/g, '');
                    if (!numericCandidate || numericCandidate === '-' || numericCandidate === '.' || numericCandidate === '-.') {
                        return fallback;
                    }
                    const parsed = Number(numericCandidate);
                    return Number.isFinite(parsed) ? parsed : fallback;
                }
                return fallback;
            };

            const workersMaster = await manpowerService.getWorkers();
            const workerMasterById = new Map<string, any>();
            const workerMasterByName = new Map<string, any>();
            const workerNameDuplicate = new Set<string>();
            const workerMasterByNameTeam = new Map<string, any>();
            const workerNameTeamDuplicate = new Set<string>();
            workersMaster.forEach((w: any) => {
                if (w?.id) workerMasterById.set(String(w.id), w);
                if (w?.legacyId) workerMasterById.set(String(w.legacyId), w);
                const nameKey = normalizeName(w?.name);
                if (!nameKey) return;

                if (workerMasterByName.has(nameKey)) {
                    workerNameDuplicate.add(nameKey);
                } else {
                    workerMasterByName.set(nameKey, w);
                }

                const teamIdKey = normalizeText(w?.teamId);
                const teamNameKey = normalizeName(w?.teamName);
                const nameTeamKeys = [teamIdKey, teamNameKey]
                    .filter((key) => !!key)
                    .map((teamKey) => buildNameTeamKey(w?.name, teamKey))
                    .filter((key): key is string => !!key);

                nameTeamKeys.forEach((nameTeamKey) => {
                    if (workerMasterByNameTeam.has(nameTeamKey)) {
                        workerNameTeamDuplicate.add(nameTeamKey);
                    } else {
                        workerMasterByNameTeam.set(nameTeamKey, w);
                    }
                });
            });

            const resolveUnitPrice = (candidates: unknown[]): number => {
                for (const candidate of candidates) {
                    const parsed = toFiniteNumber(candidate, Number.NaN);
                    if (Number.isFinite(parsed) && parsed > 0) return parsed;
                }
                return 0;
            };
            const ensureMonthlyBucket = (map: Map<string, { [month: number]: number }>, key: string) => {
                let bucket = map.get(key);
                if (!bucket) {
                    bucket = {};
                    for (let m = 1; m <= 12; m++) bucket[m] = 0;
                    map.set(key, bucket);
                }
                return bucket;
            };
            const addNameTeamMonthlyAmount = (name: unknown, teamKey: unknown, month: number, amount: number) => {
                const nameKey = normalizeName(name);
                const normalizedTeamKey = normalizeText(teamKey);
                if (!nameKey || !normalizedTeamKey) return;
                const key = `${nameKey}::${normalizedTeamKey}`;
                const bucket = ensureMonthlyBucket(workerMonthlyAmountsByNameTeam, key);
                bucket[month] = (bucket[month] || 0) + amount;
            };
            rows.forEach((row: any) => {
                const date = row.date ? String(row.date) : '';
                if (!date || date.length < 7) return;
                const month = Number(date.slice(5, 7));
                if (!month || month < 1 || month > 12) return;

                const workerId = row.workerId ? String(row.workerId) : '';
                const workerName = row.workerName ? String(row.workerName) : '';
                const workerNameKey = normalizeName(workerName);
                const rowTeamIdKey = normalizeText(row.workerTeamId ?? row.teamId);
                const rowTeamNameKey = normalizeName(row.workerTeamName ?? row.teamName);
                const rowTeamCandidates = Array.from(new Set([
                    rowTeamIdKey,
                    rowTeamNameKey,
                    normalizeText(row.teamId),
                    normalizeName(row.teamName),
                    normalizeText(row.responsibleTeamId),
                    normalizeName(row.responsibleTeamName)
                ].filter((value) => !!value)));
                const resolvedWorkerId = workerId || workerName;
                if (!resolvedWorkerId) return;

                let workerMaster = workerId ? workerMasterById.get(workerId) : null;
                if (!workerMaster && workerNameKey) {
                    const nameTeamCandidates = rowTeamCandidates
                        .map(teamKey => buildNameTeamKey(workerNameKey, teamKey))
                        .filter((key): key is string => !!key);

                    for (const nameTeamKey of nameTeamCandidates) {
                        if (workerNameTeamDuplicate.has(nameTeamKey)) continue;
                        const candidate = workerMasterByNameTeam.get(nameTeamKey);
                        if (candidate) {
                            workerMaster = candidate;
                            break;
                        }
                    }
                }
                if (!workerMaster && workerNameKey && !workerNameDuplicate.has(workerNameKey)) {
                    workerMaster = workerMasterByName.get(workerNameKey);
                }

                const workerTeamKey =
                    workerMaster?.teamId
                        ? String(workerMaster.teamId)
                        : (row.workerTeamId
                            ? String(row.workerTeamId)
                            : (row.teamId ? String(row.teamId) : (row.responsibleTeamId ? String(row.responsibleTeamId) : '')));
                const workerTeamName =
                    workerMaster?.teamName
                        ? String(workerMaster.teamName)
                        : (row.workerTeamName
                            ? String(row.workerTeamName)
                            : (row.teamName ? String(row.teamName) : (row.responsibleTeamName ? String(row.responsibleTeamName) : '')));
                const teamIdentityForKey = workerTeamKey || rowTeamNameKey || normalizeText(row.teamId) || normalizeName(row.teamName);
                const workerKey = workerMaster?.id
                    ? String(workerMaster.id)
                    : (workerId
                        ? workerId
                        : (workerNameKey
                            ? (teamIdentityForKey ? `name:${workerNameKey}::${teamIdentityForKey}` : `name:${workerNameKey}`)
                            : resolvedWorkerId));

                if (workerTeamKey && workerTeamName) {
                    teamNameById.set(workerTeamKey, workerTeamName);
                }

                if (!workerMonthlyAmounts.has(workerKey)) {
                    const monthlyAmounts: { [month: number]: number } = {};
                    for (let m = 1; m <= 12; m++) {
                        monthlyAmounts[m] = 0;
                    }
                    workerMonthlyAmounts.set(workerKey, monthlyAmounts);
                }

                if (!workerMetaById.has(workerKey)) {
                    workerMetaById.set(workerKey, {
                        id: workerKey,
                        name: workerMaster?.name ? String(workerMaster.name) : (workerName || workerKey),
                        teamId: workerTeamKey || undefined,
                        teamName: workerTeamName || undefined
                    });
                }

                const monthlyAmounts = workerMonthlyAmounts.get(workerKey);
                if (!monthlyAmounts) return;
                const rowAmount = toFiniteNumber(row.amount, Number.NaN);
                const manDay = toFiniteNumber(row.manDay ?? row.gongsu, 0);
                const unitPrice = resolveUnitPrice([row.unitPrice, workerMaster?.unitPrice]);
                // [Bug Fix] 급여 형태(salaryModel) 고려한 amount 재계산:
                // - 월급제: unitPrice가 월급이므로 manDay*unitPrice는 과대 계산됨 → rowAmount 그대로 사용
                // - 일급제/기타: amount > 0이면 신뢰, 아니면 manDay * unitPrice로 재계산
                const salaryModelRaw = normalizeName(row.salaryModel ?? workerMaster?.salaryModel ?? '');
                const isMonthly = salaryModelRaw.includes('월급');
                const amount = Number.isFinite(rowAmount)
                    ? (rowAmount > 0 ? rowAmount : (isMonthly ? rowAmount : (manDay * unitPrice)))
                    : (isMonthly ? 0 : (manDay * unitPrice));
                monthlyAmounts[month] = (monthlyAmounts[month] || 0) + amount;

                const resolvedName = workerMaster?.name ? String(workerMaster.name) : (workerName || workerKey);
                addNameTeamMonthlyAmount(resolvedName, workerTeamKey, month, amount);
                addNameTeamMonthlyAmount(resolvedName, normalizeName(workerTeamName), month, amount);
            });
        } catch (error) {
            console.error('getMonthlySalaryWorkSummaryByYear Error:', error);
        }

        const teams = Array.from(teamNameById.entries()).map(([id, name]) => ({ id, name }));
        teams.sort((a, b) => a.name.localeCompare(b.name, 'ko'));

        return {
            teams,
            workerMonthlyAmounts,
            workerMetaById,
            workerMonthlyAmountsByNameTeam
        };
    }
};
