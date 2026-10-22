import { freelancerService } from './freelancerService';
import { freelancerFirestoreService } from './freelancerFirestoreService';
import { monthlyPayrollSettlementService } from './monthlyPayrollSettlementService';
import { manpowerService } from './manpowerService';
import { teamService } from './teamService';

jest.mock('./freelancerFirestoreService', () => ({ freelancerFirestoreService: { getFreelancers: jest.fn(), getPayments: jest.fn() } }));
jest.mock('./monthlyPayrollSettlementService', () => ({ monthlyPayrollSettlementService: { getSettlementsByYear: jest.fn() } }));
jest.mock('./manpowerService', () => ({ manpowerService: { getWorkers: jest.fn() } }));
jest.mock('./teamService', () => ({ teamService: { getTeams: jest.fn() } }));

const settlement = (month: number, teamId: string, amount: number, workerId = 'worker') => ({
    year: 2026, yearMonth: `2026-${String(month).padStart(2, '0')}`, teamId, teamName: teamId,
    rows: [{ workerId, workerName: '검증 작업자', teamId, teamName: teamId,
        invoiceGrossAmount: amount, grossAmount: amount, salaryModel: '일급제', manualInput: { allocationMode: 'corporate' } }],
});

beforeEach(() => {
    jest.clearAllMocks();
    (freelancerFirestoreService.getFreelancers as jest.Mock).mockResolvedValue([{ id: 'worker', legacyId: 'old-worker', name: '검증 작업자', teamId: 'a', status: 'active' }]);
    (freelancerFirestoreService.getPayments as jest.Mock).mockResolvedValue([]);
    (manpowerService.getWorkers as jest.Mock).mockResolvedValue([]);
    (teamService.getTeams as jest.Mock).mockResolvedValue([{ id: 'a', legacyId: 'old-a', name: '검증 A팀' }, { id: 'b', name: '검증 B팀' }]);
    (monthlyPayrollSettlementService.getSettlementsByYear as jest.Mock).mockResolvedValue([settlement(8, 'a', 100), settlement(9, 'b', 200)]);
});

it('팀 이동 전후 신고액을 저장 당시 팀에 귀속하고 이전 팀의 미신고 월은 0으로 둔다', async () => {
    const { freelancers } = await freelancerService.getFreelancerYearlyData(2026);
    expect(freelancers).toHaveLength(2);
    expect(freelancers.find(row => row.teamId === 'a')).toMatchObject({ m08: 100, m09: 0, total: 100 });
    expect(freelancers.find(row => row.teamId === 'b')).toMatchObject({ m08: 0, m09: 200, total: 200 });
});

it('한 달에 두 팀에서 신고해도 팀별 금액과 전체 합계가 보존된다', async () => {
    (monthlyPayrollSettlementService.getSettlementsByYear as jest.Mock).mockResolvedValue([settlement(9, 'a', 100), settlement(9, 'b', 200)]);
    const { freelancers } = await freelancerService.getFreelancerYearlyData(2026);
    expect(freelancers.find(row => row.teamId === 'a').m09).toBe(100);
    expect(freelancers.find(row => row.teamId === 'b').m09).toBe(200);
    expect(freelancers.reduce((sum, row) => sum + row.m09, 0)).toBe(300);
});

it('마스터 소속 변경과 저장본 순서에 관계없이 과거 팀 신고 이력을 유지한다', async () => {
    (freelancerFirestoreService.getFreelancers as jest.Mock).mockResolvedValue([{ id: 'worker', name: '검증 작업자', teamId: 'b', status: 'active' }]);
    (monthlyPayrollSettlementService.getSettlementsByYear as jest.Mock).mockResolvedValue([settlement(9, 'b', 200), settlement(8, 'a', 100)]);
    const { freelancers } = await freelancerService.getFreelancerYearlyData(2026);
    expect(freelancers.find(row => row.teamId === 'a')).toMatchObject({ m08: 100, m09: 0 });
    expect(freelancers.find(row => row.teamId === 'b')).toMatchObject({ m08: 0, m09: 200 });
});

it('현재 ID와 legacyId로 저장된 동일 작업자·팀 자료를 빠짐없이 한 행으로 합친다', async () => {
    (monthlyPayrollSettlementService.getSettlementsByYear as jest.Mock).mockResolvedValue([settlement(8, 'old-a', 100, 'old-worker'), settlement(9, 'a', 200)]);
    const { freelancers } = await freelancerService.getFreelancerYearlyData(2026);
    expect(freelancers).toHaveLength(1);
    expect(freelancers[0]).toMatchObject({ id: 'worker', teamId: 'a', m08: 100, m09: 200, total: 300 });
});

it('마스터에 없는 작업자도 여러 팀의 저장 이력을 따로 표시한다', async () => {
    (freelancerFirestoreService.getFreelancers as jest.Mock).mockResolvedValue([]);
    const { freelancers } = await freelancerService.getFreelancerYearlyData(2026);
    expect(freelancers).toHaveLength(2);
    expect(freelancers.every(row => row.isSettlementOnly)).toBe(true);
    expect(freelancers.find(row => row.teamId === 'b').m09).toBe(200);
});

it('팀별 수기 0원 수정과 연간 요약을 다른 팀에 복제하지 않는다', async () => {
    (monthlyPayrollSettlementService.getSettlementsByYear as jest.Mock).mockResolvedValue([settlement(9, 'a', 100), settlement(9, 'b', 200)]);
    (freelancerFirestoreService.getPayments as jest.Mock).mockResolvedValue([
        { id: 'override-a', freelancerId: 'worker', teamId: 'old-a', year: 2026, month: 9, amount: 0, isManualTaxOverride: true, performanceBonus: 10, reportableAmount: 500 },
        { id: 'override-b', freelancerId: 'old-worker', teamId: 'b', year: 2026, month: 9, amount: 250, isManualTaxOverride: true },
    ]);
    const { freelancers } = await freelancerService.getFreelancerYearlyData(2026);
    expect(freelancers.find(row => row.teamId === 'a')).toMatchObject({ m09: 0, m09_sourceAmount: 100, m09_id: 'override-a', total: 10, performanceBonus: 10, reportableAmount: 500 });
    expect(freelancers.find(row => row.teamId === 'b')).toMatchObject({ m09: 250, m09_sourceAmount: 200, m09_id: 'override-b', total: 250, performanceBonus: 0, reportableAmount: 0 });
});

it('팀 정보가 없는 기존 수기값은 해당 월 정산의 유일한 팀으로 보완한다', async () => {
    (freelancerFirestoreService.getPayments as jest.Mock).mockResolvedValue([
        { id: 'legacy', freelancerId: 'old-worker', year: 2026, month: 9, amount: 210, isManualTaxOverride: true },
    ]);
    const { freelancers } = await freelancerService.getFreelancerYearlyData(2026);
    expect(freelancers.find(row => row.teamId === 'a')).toMatchObject({ m08: 100, m09: 0, m09_id: null });
    expect(freelancers.find(row => row.teamId === 'b')).toMatchObject({ m09: 210, m09_id: 'legacy' });
});

it('기존 수기값의 귀속이 모호하면 임의 배분이나 중복 합산 없이 확인 오류를 반환한다', async () => {
    (monthlyPayrollSettlementService.getSettlementsByYear as jest.Mock).mockResolvedValue([settlement(9, 'a', 100), settlement(9, 'b', 200)]);
    (freelancerFirestoreService.getPayments as jest.Mock).mockResolvedValue([
        { id: 'legacy', freelancerId: 'worker', year: 2026, month: 9, amount: 350, isManualTaxOverride: true },
    ]);
    await expect(freelancerService.getFreelancerYearlyData(2026)).rejects.toThrow('9월 수기 신고 내역에 팀 정보가 없어');
});

it('다른 연도와 전체법인 이외 정산은 신고액에 포함하지 않고 0원 invoice도 존중한다', async () => {
    const excluded = settlement(9, 'a', 900);
    excluded.rows[0].manualInput.allocationMode = 'labor';
    const zero = settlement(9, 'a', 0);
    zero.rows[0].grossAmount = 999;
    (monthlyPayrollSettlementService.getSettlementsByYear as jest.Mock).mockResolvedValue([
        settlement(8, 'a', 100.5), excluded, zero, { ...settlement(9, 'a', 700), yearMonth: '2025-09' },
    ]);
    const { freelancers } = await freelancerService.getFreelancerYearlyData(2026);
    expect(freelancers[0]).toMatchObject({ m08: 100.5, m09: 0, total: 100.5 });
});

it('인력과 프리랜서 문서 ID가 달라도 공통 legacyId로 저장본을 연결한다', async () => {
    (manpowerService.getWorkers as jest.Mock).mockResolvedValue([{ id: 'manpower-worker', legacyId: 'old-worker', name: '검증 작업자' }]);
    (monthlyPayrollSettlementService.getSettlementsByYear as jest.Mock).mockResolvedValue([
        settlement(8, 'a', 100, 'manpower-worker'), settlement(9, 'a', 200, 'old-worker'),
    ]);
    const { freelancers } = await freelancerService.getFreelancerYearlyData(2026);
    expect(freelancers).toHaveLength(1);
    expect(freelancers[0]).toMatchObject({ id: 'worker', m08: 100, m09: 200, total: 300 });
});

it('수기값을 원본으로 되돌린 뒤에도 같은 팀 문서를 재사용하고 연간 요약을 보존한다', async () => {
    (freelancerFirestoreService.getPayments as jest.Mock).mockResolvedValue([
        { id: 'summary', freelancerId: 'worker', teamId: 'b', year: 2026, month: 9, amount: 200, isManualTaxOverride: false, performanceBonus: 50, reportableAmount: 1000 },
        { id: 'new-override', freelancerId: 'worker', teamId: 'b', year: 2026, month: 10, amount: 300, isManualTaxOverride: true },
    ]);
    const { freelancers } = await freelancerService.getFreelancerYearlyData(2026);
    expect(freelancers.find(row => row.teamId === 'b')).toMatchObject({ m09: 200, m09_id: 'summary', m10: 300, latestPaymentId: 'summary', performanceBonus: 50, reportableAmount: 1000, total: 550 });
    expect(freelancers.find(row => row.teamId === 'a')).toMatchObject({ total: 100, performanceBonus: 0 });
});
