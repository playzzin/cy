import { buildFreelancerYearlyRows } from '../../src/utils/freelancerYearlyData';
import type { FreelancerPayment } from '../../src/types/freelancer';
import type { MonthlyPayrollSettlement } from '../../src/services/monthlyPayrollSettlementService';

const teams = [
    { id: 'a', name: '검증 A팀', color: '#000000', companyId: 'company', companyName: '청연 검증' },
    { id: 'b', name: '검증 B팀', color: '#7c3aed', companyId: 'company', companyName: '청연 검증' },
    { id: 'c', name: '검증 C팀', color: '#0f766e', companyId: 'company', companyName: '청연 검증' },
];
const master = { teams, companies: [{ id: 'company', name: '청연 검증' }], loading: false };
export const useMasterData = () => master;
const payments: FreelancerPayment[] = [];
const saved = (year: number, month: number, teamId: string, value: number, workerId: string, name: string) => ({
    year, yearMonth: `${year}-${String(month).padStart(2, '0')}`, teamId, teamName: teamId,
    rows: [{ workerId, workerName: name, teamId, teamName: teamId, invoiceGrossAmount: value, grossAmount: value,
        salaryModel: '일급제', manualInput: { allocationMode: 'corporate' } }],
} as MonthlyPayrollSettlement);

export const freelancerService = {
    async getFreelancerYearlyData(year: number) {
        if (new URLSearchParams(window.location.search).has('error')) throw new Error('9월 수기 신고 내역에 팀 정보가 없어 귀속을 확인해야 합니다.');
        return { freelancers: buildFreelancerYearlyRows(year, [
            { id: 'moved', name: '검증 이동자', teamId: 'b', status: 'active' },
            { id: 'shared', name: '검증 복수팀', teamId: 'b', status: 'active' },
            { id: 'purple', name: '검증 보라팀이동', teamId: 'c', status: 'active' },
            { id: 'stable', name: '검증 이동없음', teamId: 'c', status: 'active' },
        ], [], teams, [
            saved(year, 8, 'a', 1000000, 'moved', '검증 이동자'), saved(year, 9, 'b', 2000000, 'moved', '검증 이동자'),
            saved(year, 9, 'a', 300000, 'shared', '검증 복수팀'), saved(year, 9, 'b', 400000, 'shared', '검증 복수팀'),
            saved(year, 8, 'b', 500000, 'purple', '검증 보라팀이동'), saved(year, 10, 'c', 600000, 'purple', '검증 보라팀이동'),
        ], payments), companies: [] };
    },
    async saveYearlyPayments(year: number, rows: any[]) {
        for (const row of rows) for (let month = 1; month <= 12; month++) {
            const key = `m${String(month).padStart(2, '0')}`;
            if (Number(row[key] || 0) === Number(row[`${key}_sourceAmount`] || 0)) continue;
            const id = `${row.id}-${row.teamId}-${month}`;
            const payment = { id, freelancerId: row.id, teamId: row.teamId, teamName: row.teamName, year, month, amount: Number(row[key] || 0), isManualTaxOverride: true };
            const index = payments.findIndex(item => item.id === id);
            if (index < 0) payments.push(payment); else payments[index] = payment;
        }
        document.body.dataset.savedPayments = JSON.stringify(payments.map(({ freelancerId, teamId, month, amount }) => ({ freelancerId, teamId, month, amount })));
        return { success: true };
    },
};
