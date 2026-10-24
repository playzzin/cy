import { doc, getDoc, runTransaction } from 'firebase/firestore';
import { corporateTaxService } from './corporateTaxService';
import { emptyManual } from '../pages/tax/corporateTaxModel';
import { workbookLedgerService } from './workbookLedgerService';
import { freelancerService } from './freelancerService';
import { officeStaffService } from './officeStaffService';
import { officeStaffPayrollService } from './officeStaffPayrollService';
import { teamService } from './teamService';
import { companyService } from './companyService';
import { cardService } from './cardService';
import { accommodationService } from './accommodationService';

jest.mock('../config/firebase', () => ({ db: {}, auth: { currentUser: { uid: 'test-user' } } }));
jest.mock('firebase/firestore', () => ({ doc: jest.fn((_db, collection, id) => `${collection}/${id}`), getDoc: jest.fn(), runTransaction: jest.fn(), serverTimestamp: jest.fn(() => 'timestamp') }));
jest.mock('./workbookLedgerService', () => ({ workbookLedgerService: { getEntries: jest.fn() } }));
jest.mock('./freelancerService', () => ({ freelancerService: { getFreelancerYearlyData: jest.fn() } }));
jest.mock('./officeStaffService', () => ({ officeStaffService: { getOfficeStaff: jest.fn() } }));
jest.mock('./officeStaffPayrollService', () => ({ officeStaffPayrollService: { loadYear: jest.fn() } }));
jest.mock('./teamService', () => ({ teamService: { getTeams: jest.fn(async () => []) } }));
jest.mock('./companyService', () => ({ companyService: { getCompanies: jest.fn(async () => []) } }));
jest.mock('./cardService', () => ({ cardService: { getTransactionsByMonth: jest.fn() } }));
jest.mock('./accommodationService', () => ({ accommodationService: { getMonthlyLedger: jest.fn() } }));
beforeEach(() => {
    jest.clearAllMocks(); localStorage.clear();
    (doc as jest.Mock).mockImplementation((_db, collection, id) => `${collection}/${id}`);
    (teamService.getTeams as jest.Mock).mockResolvedValue([]);
    (companyService.getCompanies as jest.Mock).mockResolvedValue([]);
    (cardService.getTransactionsByMonth as jest.Mock).mockResolvedValue([]);
    (accommodationService.getMonthlyLedger as jest.Mock).mockResolvedValue([]);
    (officeStaffPayrollService.loadYear as jest.Mock).mockResolvedValue({});
});

it('없는 연도는 초기값을 사용하지만 읽기 실패를 빈 정산으로 바꾸지 않는다', async () => {
    (getDoc as jest.Mock).mockResolvedValue({ exists: () => false });
    await expect(corporateTaxService.loadManual(2026)).resolves.toEqual({ revision: 0, manual: emptyManual() });
    (getDoc as jest.Mock).mockRejectedValue(new Error('permission-denied'));
    await expect(corporateTaxService.loadManual(2026)).rejects.toThrow('permission');
});

it('연도별 문서에 트랜잭션으로 수기 값만 저장한다', async () => {
    const transaction = { get: jest.fn(async () => ({ exists: () => true, data: () => ({ revision: 2 }) })), set: jest.fn() };
    (runTransaction as jest.Mock).mockImplementation((_db, callback) => callback(transaction));
    await expect(corporateTaxService.saveManual(2026, emptyManual(), 2)).resolves.toBe(3);
    expect(transaction.set).toHaveBeenCalledWith('corporate_tax_settlements/cheongyeon-2026', expect.objectContaining({ year: 2026, revision: 3, manual: emptyManual(), updatedBy: 'test-user' }));
});

it('다른 화면에서 변경한 자료를 덮어쓰지 않는다', async () => {
    const transaction = { get: jest.fn(async () => ({ exists: () => true, data: () => ({ revision: 4 }) })), set: jest.fn() };
    (runTransaction as jest.Mock).mockImplementation((_db, callback) => callback(transaction));
    await expect(corporateTaxService.saveManual(2026, emptyManual(), 3)).rejects.toThrow('다른 화면');
    expect(transaction.set).not.toHaveBeenCalled();
});

it('일부 자료 조회 실패는 분리 표시하고 정상 조회 자료를 유지한다', async () => {
    (workbookLedgerService.getEntries as jest.Mock).mockRejectedValue(new Error('denied'));
    (freelancerService.getFreelancerYearlyData as jest.Mock).mockResolvedValue({ freelancers: [{ id: 'a', m01: 500 }] });
    (officeStaffService.getOfficeStaff as jest.Mock).mockResolvedValue([]);
    const result = await corporateTaxService.loadSources(2026);
    expect(result.errors).toEqual({ ledger: expect.any(String) });
    expect(result.evidence).toEqual([expect.objectContaining({ month: 1, field: 'labor', amount: 500 })]);
    expect(result.missingSalaryMonths).toHaveLength(12);
    expect(workbookLedgerService.getEntries).toHaveBeenCalledWith({ startDate: '2026-01-01', endDate: '2026-12-31', force: true });
    expect(cardService.getTransactionsByMonth).toHaveBeenCalledTimes(12);
    expect(accommodationService.getMonthlyLedger).toHaveBeenCalledTimes(12);
    expect(cardService.getTransactionsByMonth).toHaveBeenCalledWith('2026-01');
    expect(accommodationService.getMonthlyLedger).toHaveBeenCalledWith('2026-12');
});

it('카드나 숙소의 한 달 조회 실패도 연간 비용을 0으로 처리하지 않는다', async () => {
    (workbookLedgerService.getEntries as jest.Mock).mockResolvedValue([]);
    (freelancerService.getFreelancerYearlyData as jest.Mock).mockResolvedValue({ freelancers: [] });
    (officeStaffService.getOfficeStaff as jest.Mock).mockResolvedValue([]);
    (cardService.getTransactionsByMonth as jest.Mock).mockRejectedValueOnce(new Error('denied'));
    (accommodationService.getMonthlyLedger as jest.Mock).mockRejectedValueOnce(new Error('denied'));
    expect((await corporateTaxService.loadSources(2026)).errors).toEqual({ card: expect.any(String), lodging: expect.any(String) });
});

it('선택 연도의 프리랜서 신고 원본에서 모든 팀의 월 합계를 가져온다', async () => {
    (workbookLedgerService.getEntries as jest.Mock).mockResolvedValue([]);
    (officeStaffService.getOfficeStaff as jest.Mock).mockResolvedValue([]);
    (companyService.getCompanies as jest.Mock).mockResolvedValue([{ id: 'company', name: '청연이엔지' }]);
    (teamService.getTeams as jest.Mock).mockResolvedValue([
        { id: 'a', name: '검증A팀', companyId: 'company' }, { id: 'b', name: '검증B팀', companyId: 'company' },
    ]);
    (freelancerService.getFreelancerYearlyData as jest.Mock).mockResolvedValue({ freelancers: [
        { teamId: 'a', m01: 100 }, { teamId: 'a', m01: 200 }, { teamId: 'b', m01: 400, m12: 500 },
    ] });
    const result = await corporateTaxService.loadSources(2025);
    expect(freelancerService.getFreelancerYearlyData).toHaveBeenCalledWith(2025);
    expect(result.errors).toEqual({});
    expect(result.evidence.filter(row => row.field === 'labor')).toEqual([
        expect.objectContaining({ month: 1, label: '검증A팀', amount: 300 }),
        expect.objectContaining({ month: 1, label: '검증B팀', amount: 400 }),
        expect.objectContaining({ month: 12, label: '검증B팀', amount: 500 }),
    ]);
});

it('6~8월 소수점 신고금액이 있어도 연간 조회가 성공하며 원본 합계를 유지한다', async () => {
    (workbookLedgerService.getEntries as jest.Mock).mockResolvedValue([]);
    (officeStaffService.getOfficeStaff as jest.Mock).mockResolvedValue([]);
    (freelancerService.getFreelancerYearlyData as jest.Mock).mockResolvedValue({ freelancers: [
        { teamId: 'a', m06: 100.5, m07: 200.25, m08: 0.1 + 0.2 },
    ] });
    const result = await corporateTaxService.loadSources(2026);
    expect(result.errors).toEqual({});
    expect(result.evidence.map(row => row.amount)).toEqual([100.5, 200.25, 0.1 + 0.2]);
});

it('권한 오류와 원본 금액 오류를 구분해 전달하고 다른 정상 자료는 유지한다', async () => {
    (workbookLedgerService.getEntries as jest.Mock).mockRejectedValue({ code: 'permission-denied' });
    (officeStaffService.getOfficeStaff as jest.Mock).mockResolvedValue([]);
    (freelancerService.getFreelancerYearlyData as jest.Mock).mockResolvedValue({ freelancers: [{ teamId: 'a', m01: Infinity }] });
    (cardService.getTransactionsByMonth as jest.Mock).mockImplementation(async yearMonth => [{ id: yearMonth, yearMonth, category: 'MEAL', amount: 100 }]);
    const result = await corporateTaxService.loadSources(2026);
    expect(result.errors.ledger).toContain('permission-denied');
    expect(result.errors.labor).toContain('invalid-source-amount');
    expect(result.evidence.filter(row => row.field === 'card')).toHaveLength(12);
});

it('한 달 조회 실패가 나머지 월의 카드·숙소 증빙을 없애지 않는다', async () => {
    (workbookLedgerService.getEntries as jest.Mock).mockResolvedValue([]);
    (freelancerService.getFreelancerYearlyData as jest.Mock).mockResolvedValue({ freelancers: [] });
    (officeStaffService.getOfficeStaff as jest.Mock).mockResolvedValue([]);
    (cardService.getTransactionsByMonth as jest.Mock).mockImplementation(async yearMonth => {
        if (yearMonth.endsWith('-01')) throw Object.assign(new Error('서버 연결 오류'), { code: 'unavailable' });
        return [{ id: yearMonth, yearMonth, category: 'MEAL', amount: 100 }];
    });
    (accommodationService.getMonthlyLedger as jest.Mock).mockImplementation(async yearMonth => {
        if (yearMonth.endsWith('-02')) throw Object.assign(new Error('조회 권한 오류'), { code: 'permission-denied' });
        return [{ id: yearMonth, accommodationId: 'room', accommodationName: '검증 숙소', yearMonth, costs: { rent: 1000, total: 1000 } }];
    });
    const result = await corporateTaxService.loadSources(2026);
    expect(result.evidence.filter(row => row.field === 'card')).toHaveLength(11);
    expect(result.evidence.filter(row => row.field === 'lodging')).toHaveLength(11);
    expect(result).toMatchObject({ failedMonths: { card: [1], lodging: [2] } });
    expect(result.errors.card).toContain('1월');
    expect(result.errors.lodging).toContain('2월');
});

it('월 급여 저장본이 있으면 직원 목록 서버 장애에도 저장된 총급여를 조회한다', async () => {
    (officeStaffPayrollService.loadYear as jest.Mock).mockResolvedValue({ '2026-01': { grossPaySnapshot: ['이재욱', '김정혜', '이창순', '고정은'].map((name, i) => ({ id: String(i), name, baseSalary: 1000, bonus: 0, grossPay: 1000, payBasis: 'gross' })) } });
    localStorage.setItem('cy-office-staff-payroll-v1', 'broken legacy value');
    (workbookLedgerService.getEntries as jest.Mock).mockResolvedValue([]);
    (freelancerService.getFreelancerYearlyData as jest.Mock).mockResolvedValue({ freelancers: [] });
    (officeStaffService.getOfficeStaff as jest.Mock).mockRejectedValue(new Error('서버 장애'));
    const result = await corporateTaxService.loadSources(2026);
    expect(result.errors.salary).toBeUndefined();
    expect(result.evidence.filter(row => row.field === 'salary')).toHaveLength(4);
    expect(officeStaffService.getOfficeStaff).not.toHaveBeenCalled();
    expect(officeStaffPayrollService.loadYear).toHaveBeenCalledWith(2026);
});

it('공용 급여 조회 실패를 브라우저 급여나 0원으로 대체하지 않는다', async () => {
    (workbookLedgerService.getEntries as jest.Mock).mockResolvedValue([]);
    (freelancerService.getFreelancerYearlyData as jest.Mock).mockResolvedValue({ freelancers: [] });
    (officeStaffPayrollService.loadYear as jest.Mock).mockRejectedValue({ code: 'permission-denied' });
    const result = await corporateTaxService.loadSources(2026);
    expect(result.errors.salary).toContain('permission-denied');
    expect(result.evidence.filter(row => row.field === 'salary')).toHaveLength(0);
});
