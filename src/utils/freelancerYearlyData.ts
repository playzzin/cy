import type { Freelancer, FreelancerPayment } from '../types/freelancer';
import type { MonthlyPayrollSettlement } from '../services/monthlyPayrollSettlementService';

interface WorkerMaster extends Partial<Omit<Freelancer, 'status'>> {
    status?: string;
    salaryModel?: string;
    payType?: string;
    idNumber?: string;
    gridNo?: number;
}
interface TeamMaster {
    id?: string;
    legacyId?: string;
    name: string;
    companyName?: string;
}
interface TeamBucket {
    workerId: string;
    teamId: string;
    teamName: string;
    name: string;
    amounts: Record<number, number>;
    salaryModels: Record<number, string>;
    payments: FreelancerPayment[];
}

export const freelancerReportRowKey = (row: { id?: string; teamId?: string }): string =>
    JSON.stringify([row.id || '', row.teamId || '']);

const text = (value: unknown): string => String(value ?? '').trim();
const amount = (value: unknown): number => {
    const parsed = typeof value === 'number' ? value : Number(text(value).replace(/,/g, '').replace(/[^0-9.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
};
const salaryModel = (...values: unknown[]): string => {
    const raw = values.map(text).find(Boolean) || '';
    return raw.includes('월급') ? '월급제' : raw.includes('일급') ? '일급제' : raw;
};

/** 신고 귀속은 현재 인사 소속이 아니라 월 정산에 저장된 작업자 + 팀으로 결정한다. */
export function buildFreelancerYearlyRows(
    year: number,
    freelancers: Freelancer[],
    workers: WorkerMaster[],
    teams: TeamMaster[],
    settlements: MonthlyPayrollSettlement[],
    payments: FreelancerPayment[],
): any[] {
    const teamById = new Map<string, TeamMaster>();
    teams.forEach(team => {
        if (team.id) teamById.set(team.id, team);
        if (team.legacyId) teamById.set(team.legacyId, team);
    });
    const normalizeTeam = (id: unknown) => text(teamById.get(text(id))?.id || id);
    const masterById = new Map<string, WorkerMaster>();
    const workerAliases = new Map<string, string>();
    // 프리랜서의 문서 ID를 저장 시 사용하되, 인력 마스터의 옛 ID도 함께 연결한다.
    [...workers, ...freelancers].forEach(worker => {
        const id = text(worker.id || worker.legacyId);
        if (!id) return;
        const previous = masterById.get(id) || masterById.get(text(worker.legacyId));
        const merged = { ...previous, ...worker };
        masterById.set(id, merged);
        workerAliases.set(id, id);
        if (previous?.id && previous.id !== id) workerAliases.set(previous.id, id);
        if (worker.legacyId) {
            masterById.set(worker.legacyId, merged);
            workerAliases.set(worker.legacyId, id);
        }
    });
    const normalizeWorker = (id: unknown) => {
        let normalized = text(id);
        const visited = new Set<string>();
        while (workerAliases.has(normalized) && !visited.has(normalized)) {
            visited.add(normalized);
            normalized = workerAliases.get(normalized)!;
        }
        return normalized;
    };
    const freelancerIds = new Set(freelancers.map(worker => normalizeWorker(worker.id)));
    const buckets = new Map<string, TeamBucket>();
    const ensureBucket = (workerId: string, teamId: string, name = '', teamName = '') => {
        const key = freelancerReportRowKey({ id: workerId, teamId });
        let bucket = buckets.get(key);
        if (!bucket) {
            bucket = { workerId, teamId, name, teamName, amounts: {}, salaryModels: {}, payments: [] };
            buckets.set(key, bucket);
        }
        return bucket;
    };

    settlements.forEach(settlement => settlement.rows.forEach(row => {
        if (row.manualInput?.allocationMode !== 'corporate') return;
        const period = text(row.yearMonth || settlement.yearMonth);
        if (!new RegExp(`^${year}-(0[1-9]|1[0-2])$`).test(period)) return;
        const month = Number(period.slice(5, 7));
        const workerId = normalizeWorker(row.workerId);
        const sourceAmount = amount(row.invoiceGrossAmount === undefined ? row.grossAmount : row.invoiceGrossAmount);
        if (!workerId || sourceAmount <= 0) return;
        const teamId = normalizeTeam(row.teamId || settlement.teamId);
        const bucket = ensureBucket(workerId, teamId, row.workerName, row.teamName || settlement.teamName);
        bucket.amounts[month] = (bucket.amounts[month] || 0) + sourceAmount;
        bucket.salaryModels[month] = salaryModel(row.salaryModel, bucket.salaryModels[month]);
    }));

    const savedBuckets = Array.from(buckets.values());
    const resolvePaymentTeam = (payment: FreelancerPayment, workerId: string): string => {
        if (text(payment.teamId)) return normalizeTeam(payment.teamId);
        const history = savedBuckets.filter(bucket => bucket.workerId === workerId);
        const monthly = history.filter(bucket => bucket.amounts[payment.month] !== undefined);
        const candidates = monthly.length > 0 ? monthly : history;
        if (candidates.length === 1) return candidates[0].teamId;
        // 옛 수기값은 팀 구분이 없다. 여러 팀에 복제하거나 임의 배분하지 않는다.
        if (candidates.length > 1) {
            throw new Error(`${masterById.get(workerId)?.name || workerId} · ${payment.month}월 수기 신고 내역에 팀 정보가 없어 귀속을 확인해야 합니다. 해당 월의 팀별 금액을 확인해 주세요.`);
        }
        return normalizeTeam(masterById.get(workerId)?.teamId);
    };

    payments.filter(payment => payment.year === year && payment.month >= 1 && payment.month <= 12).forEach(payment => {
        const workerId = normalizeWorker(payment.freelancerId);
        if (!workerId) return;
        // 자동 생성된 금액은 정산 저장본이 원본이다. 요약값/수기 수정만 병합한다.
        const hasSummary = amount(payment.performanceBonus) !== 0 || amount(payment.reportableAmount) !== 0
            || amount(payment.reportingBalance) !== 0 || amount(payment.dailyRate) !== 0
            || Boolean(payment.depositDate || payment.memo);
        if (!payment.isManualTaxOverride && !hasSummary && !text(payment.teamId)) return;
        const teamId = resolvePaymentTeam(payment, workerId);
        ensureBucket(workerId, teamId).payments.push(payment);
    });

    // 신고가 없는 등록 인원도 해당 팀에서 계속 조회/입력할 수 있다.
    freelancers.forEach(worker => ensureBucket(normalizeWorker(worker.id), normalizeTeam(worker.teamId)));

    return Array.from(buckets.values()).map(bucket => {
        const master = masterById.get(bucket.workerId);
        const team = teamById.get(bucket.teamId);
        const baseSalaryModel = salaryModel(master?.salaryModel, master?.payType);
        const sortedPayments = [...bucket.payments].sort((a, b) => b.month - a.month || a.id.localeCompare(b.id));
        const summaries = sortedPayments.filter(payment => ['performanceBonus', 'reportingBalance', 'reportableAmount', 'depositDate', 'memo', 'dailyRate']
            .some(key => Object.prototype.hasOwnProperty.call(payment, key)));
        const summary = summaries.find(payment => payment.month === 12) || summaries[0] || sortedPayments[0];
        const row: any = {
            ...master,
            id: bucket.workerId,
            teamId: bucket.teamId,
            teamName: team?.name || bucket.teamName || master?.teamName || '소속 없음',
            name: master?.name || bucket.name,
            residentNumber: master?.residentNumber || master?.idNumber || '',
            companyName: team?.companyName || '업체 미지정',
            isSettlementOnly: !freelancerIds.has(bucket.workerId),
            monthlyRate: amount(summary?.dailyRate) || amount(master?.unitPrice),
            performanceBonus: amount(summary?.performanceBonus),
            reportingBalance: amount(summary?.reportingBalance),
            reportableAmount: amount(summary?.reportableAmount),
            depositDate: summary?.depositDate || null,
            paymentMemo: summary?.memo || null,
            latestPaymentId: summary?.id || null,
            latestMonth: summary?.month || null,
            salaryModel: baseSalaryModel,
            total: amount(summary?.performanceBonus),
        };
        for (let month = 1; month <= 12; month++) {
            const key = `m${String(month).padStart(2, '0')}`;
            const overrides = sortedPayments.filter(payment => payment.month === month && payment.isManualTaxOverride);
            if (overrides.length > 1) throw new Error(`${month}월 동일 작업자·팀의 수기 신고 내역이 중복되어 확인이 필요합니다.`);
            const override = overrides[0];
            const sourceAmount = bucket.amounts[month] || 0;
            row[key] = override ? amount(override.amount) : sourceAmount;
            row[`${key}_sourceAmount`] = sourceAmount;
            row[`${key}_id`] = override?.id || sortedPayments.find(payment => payment.month === month)?.id || null;
            row[`${key}_salaryModel`] = row[key] > 0 ? salaryModel(bucket.salaryModels[month], baseSalaryModel) : '';
            if (bucket.salaryModels[month]) row.salaryModel = bucket.salaryModels[month];
            row.total += row[key];
        }
        return row;
    });
}
