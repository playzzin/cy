import { manpowerService } from '../../services/manpowerService';
import { teamService, type Team } from '../../services/teamService';
import { companyService, type Company } from '../../services/companyService';
import { accountDirectoryService } from '../../services/accountDirectoryService';
import { accommodationService } from '../../services/accommodationService';
import { siteService, type Site } from '../../services/siteService';
import { dailyReportService, type DailyReport } from '../../services/dailyReportService';
import { supportRateService } from '../../services/supportRateService';
import { teamExpenseLedgerService } from '../../services/teamExpenseLedgerService';
import type { Accommodation, UtilityRecord } from '../../types/accommodation';
import type { TeamExpenseClaim } from '../../types/teamExpenseLedger';
import {
    buildRentTransferCandidates, buildSupportTransferCandidates,
    loadAccountTransferCandidates, loadRentTransferCandidates, loadSupportTransferCandidates,
} from './transferSources';

jest.mock('../../services/manpowerService', () => ({ manpowerService: { getWorkers: jest.fn() } }));
jest.mock('../../services/teamService', () => ({ teamService: { getTeams: jest.fn() } }));
jest.mock('../../services/companyService', () => ({ companyService: { getCompanies: jest.fn() } }));
jest.mock('../../services/accountDirectoryService', () => ({ accountDirectoryService: { getEntries: jest.fn() } }));
jest.mock('../../services/accommodationService', () => ({ accommodationService: { getAccommodations: jest.fn(), listAllUtilityRecords: jest.fn() } }));
jest.mock('../../services/siteService', () => ({ siteService: { getSites: jest.fn() } }));
jest.mock('../../services/dailyReportService', () => ({ dailyReportService: { getReportsByRange: jest.fn() } }));
jest.mock('../../services/supportRateService', () => ({ supportRateService: { getAllSiteRates: jest.fn() } }));
jest.mock('../../services/teamExpenseLedgerService', () => ({ teamExpenseLedgerService: { getClaimsByMonth: jest.fn() } }));

const bank = { bankName: 'KB국민은행', accountNumber: '000-123-456', accountHolder: '테스트 예금주' };
const room = (id: string, startDate = '2026-01-01', endDate = '', status: Accommodation['status'] = 'active'): Accommodation => ({
    id, name: `테스트 숙소 ${id}`, address: '테스트 주소', type: 'OneRoom', ownership: 'Cheongyeon', status,
    contract: { startDate, endDate, monthlyRent: 500000, deposit: 1000000, paymentDay: 5, landlordName: '테스트 임대인', landlordContact: '', isReported: false, ...bank },
    costProfile: { electricity: 'variable', gas: 'variable', water: 'variable', internet: 'included', maintenance: 'included' },
});
const ledger = (accommodationId: string, yearMonth: string, rent: number): UtilityRecord => ({
    id: `${accommodationId}-${yearMonth}`, accommodationId, accommodationName: `테스트 숙소 ${accommodationId}`, yearMonth,
    costs: { rent, electricity: 70000, gas: 0, water: 0, internet: 0, maintenance: 30000, other: 0, total: rent + 100000 }, paymentStatus: 'unpaid',
});
const companies: Company[] = [
    { id: 'own', name: '청연이엔지', code: 'OWN', isMyCompany: true },
    { id: 'external', name: '테스트 외부회사', code: 'EXT', ...bank },
];
const teams: Team[] = [
    { id: 'our-team', name: '테스트 담당팀', companyId: 'own', type: '시공팀' },
    { id: 'our-team-2', name: '테스트 담당팀2', companyId: 'own', type: '시공팀' },
    { id: 'supplier', name: '테스트 외부팀', companyId: 'external', type: '지원팀', supportRate: 210000, ...bank },
];
const sites: Site[] = [
    { id: 'site', name: '테스트 현장', code: 'S', constructorCompanyId: 'own', responsibleTeamId: 'our-team', paymentMethod: '계산서' },
    { id: 'external-site', name: '테스트 외부현장', code: 'E', constructorCompanyId: 'external', responsibleTeamId: 'supplier' },
];
const report = (patch: Partial<DailyReport> = {}): DailyReport => ({
    id: 'report', date: '2026-10-10', teamId: 'our-team', siteId: 'site', siteName: '테스트 현장', totalManDay: 1.5,
    workers: [{ workerId: 'worker', name: '테스트 작업자', teamId: 'supplier', workerTeamName: '테스트 외부팀', manDay: 1.5, status: 'attendance', unitPrice: 200000 }], ...patch,
});
const supportData = () => ({ teams, companies, sites, reports: [report()], rates: [], claims: [] });
const claim = (patch: Partial<TeamExpenseClaim> = {}): TeamExpenseClaim => ({
    id: 'claim', yearMonth: '2026-10', date: '2026-10-12', claimType: 'teamCharge', payerTeamId: 'supplier', payerTeamName: '테스트 외부팀',
    chargeToTeamId: 'our-team', siteId: 'site', category: '식비', description: '테스트 경비', amount: 10000, status: 'charged', ...patch,
});

beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    (teamService.getTeams as jest.Mock).mockResolvedValue(teams);
    (companyService.getCompanies as jest.Mock).mockResolvedValue(companies);
    (siteService.getSites as jest.Mock).mockResolvedValue(sites);
    (dailyReportService.getReportsByRange as jest.Mock).mockResolvedValue([report()]);
    (supportRateService.getAllSiteRates as jest.Mock).mockResolvedValue([]);
    (teamExpenseLedgerService.getClaimsByMonth as jest.Mock).mockResolvedValue([]);
});

it('계좌가 없는 작업자도 급여의 재직 상태 조회에 포함한다', async () => {
    (manpowerService.getWorkers as jest.Mock).mockResolvedValue([
        { id: 'active', name: '재직 검증', status: '재직', ...bank },
        { id: 'retired', legacyId: 'old-retired', name: '퇴사 검증', status: '퇴사' },
        { id: 'inactive', name: '비활성 검증', status: '재직', isActive: false, ...bank },
    ]);
    (accountDirectoryService.getEntries as jest.Mock).mockResolvedValue([]);
    const result = await loadAccountTransferCandidates();
    expect(result.workerEmployment).toEqual({ active: 'active', retired: 'retired', 'old-retired': 'retired', inactive: 'retired' });
    expect(result.candidates.some(row => row.sourceId === 'retired')).toBe(false);
});

it('계좌관리의 다섯 분류와 원본 ID·앞자리 0을 보존하고 금액을 임의 생성하지 않는다', async () => {
    (manpowerService.getWorkers as jest.Mock).mockResolvedValue([{ id: 'worker', name: '테스트 작업자', teamId: 'supplier', ...bank }]);
    (accountDirectoryService.getEntries as jest.Mock).mockResolvedValue([
        { id: 'purchase', name: '테스트 매입', category: 'purchase', ...bank }, { id: 'other', name: '테스트 기타', category: 'other', ...bank },
    ]);
    const result = await loadAccountTransferCandidates();
    expect(new Set(result.candidates.map(row => row.category))).toEqual(new Set(['worker', 'team', 'company', 'purchase', 'other']));
    expect(result.candidates.find(row => row.sourceId === 'worker')).toMatchObject({ bankCode: '004', accountNumber: bank.accountNumber, amount: 0, groupName: '테스트 외부팀' });
    expect(manpowerService.getWorkers).toHaveBeenCalledWith(true);
});

it('일부 조회 실패와 계좌번호 미등록 건수를 알리고 번호가 있는 부분등록 계좌는 유지한다', async () => {
    (manpowerService.getWorkers as jest.Mock).mockRejectedValue(new Error('fixture read failed'));
    (accountDirectoryService.getEntries as jest.Mock).mockResolvedValue([
        { id: 'empty', name: '테스트 미등록', category: 'other' },
        { id: 'partial', name: '테스트 부분등록', category: 'other', accountNumber: bank.accountNumber },
    ]);
    const result = await loadAccountTransferCandidates();
    expect(result.warnings.join(' ')).toContain('작업자 계좌');
    expect(result.warnings).toContain('기타 1건은 계좌번호가 등록되지 않아 제외했습니다.');
    expect(result.candidates.find(row => row.sourceId === 'empty')).toBeUndefined();
    expect(result.candidates.find(row => row.sourceId === 'partial')?.warning).toBe('은행·예금주 확인 필요');
    expect(result.candidates.some(row => row.category === 'team')).toBe(true);
});

it('작업자 팀은 현재·이전 ID를 연결하고 동명 팀과 미배정 계좌를 구분한다', async () => {
    (teamService.getTeams as jest.Mock).mockResolvedValue([
        { id: 'team-a', legacyId: 'old-team-a', name: '동명팀', companyId: 'old-own' },
        { id: 'team-b', name: '동명팀', companyId: 'external' },
        { id: 'unique', name: '이름연결팀' },
    ]);
    (companyService.getCompanies as jest.Mock).mockResolvedValue([{ ...companies[0], legacyId: 'old-own' }, companies[1]]);
    (manpowerService.getWorkers as jest.Mock).mockResolvedValue([
        { id: 'a', name: '검증작업자 가', teamId: 'old-team-a', teamName: '변경전팀명', ...bank },
        { id: 'b', name: '검증작업자 나', teamId: 'team-b', teamName: '동명팀', ...bank },
        { id: 'c', name: '검증작업자 다', teamName: '이름연결팀', ...bank },
        { id: 'd', name: '검증작업자 라', teamName: '동명팀', ...bank },
        { id: 'e', name: '검증작업자 마', ...bank },
    ]);
    (accountDirectoryService.getEntries as jest.Mock).mockResolvedValue([]);
    const { candidates } = await loadAccountTransferCandidates();
    const worker = (id: string) => candidates.find(row => row.sourceId === id);
    expect(worker('a')).toMatchObject({ accountTeamKey: 'team:team-a', groupName: '동명팀', accountTeamLabel: '동명팀 · 청연이엔지' });
    expect(worker('b')).toMatchObject({ accountTeamKey: 'team:team-b', accountTeamLabel: '동명팀 · 테스트 외부회사' });
    expect(worker('c')?.accountTeamKey).toBe('team:unique');
    expect(worker('d')?.accountTeamKey).toBe('name:동명팀');
    expect(worker('e')).toMatchObject({ accountTeamKey: 'unassigned', accountTeamLabel: '미배정' });
});

it('팀 계좌는 기존 회사명·코드·이전 ID 기준으로 청연이엔지와 외부팀을 구분한다', async () => {
    (companyService.getCompanies as jest.Mock).mockResolvedValue([
        { id: 'coded', legacyId: 'old-coded', name: '검증법인', code: 'CYENG' }, companies[1],
    ]);
    (teamService.getTeams as jest.Mock).mockResolvedValue([
        { id: 'own', name: '검증청연팀', companyId: 'old-coded', ...bank },
        { id: 'named', name: '검증이름팀', companyName: '(주) 청연이엔지', ...bank },
        { id: 'external', name: '검증외부팀', companyId: 'external', type: '시공팀', ...bank },
        { id: 'support', name: '검증지원팀', type: '지원팀', ...bank },
        { id: 'unknown', name: '검증미소속팀', ...bank },
    ]);
    (manpowerService.getWorkers as jest.Mock).mockResolvedValue([]);
    (accountDirectoryService.getEntries as jest.Mock).mockResolvedValue([]);
    const { candidates } = await loadAccountTransferCandidates();
    expect(candidates.filter(row => row.category === 'team').map(row => [row.sourceId, row.teamAffiliation])).toEqual([
        ['own', 'cheongyeon'], ['named', 'cheongyeon'], ['external', 'external'], ['support', 'external'], ['unknown', 'unassigned'],
    ]);
    expect(candidates.find(row => row.sourceId === 'own')?.groupName).toBe('검증법인');
});

it('계좌번호가 없는 다섯 분류는 각각 요약하고 공백뿐인 번호도 제외한다', async () => {
    (manpowerService.getWorkers as jest.Mock).mockResolvedValue([{ id: 'worker', name: '테스트 작업자', accountNumber: '   ' }]);
    (teamService.getTeams as jest.Mock).mockResolvedValue([{ id: 'team', name: '테스트 팀' }]);
    (companyService.getCompanies as jest.Mock).mockResolvedValue([{ id: 'company', name: '테스트 회사' }]);
    (accountDirectoryService.getEntries as jest.Mock).mockResolvedValue([
        { id: 'purchase', name: '테스트 매입', category: 'purchase' }, { id: 'other', name: '테스트 기타', category: 'other' },
    ]);
    const result = await loadAccountTransferCandidates();
    expect(result.candidates).toEqual([]);
    expect(result.warnings).toEqual(['작업자', '팀', '회사', '매입', '기타'].map(label => `${label} 1건은 계좌번호가 등록되지 않아 제외했습니다.`));
});

it('선택 월 월세는 해당월 대장 금액만 사용하며 관리비와 공과금을 제외한다', () => {
    const result = buildRentTransferCandidates('2026-10', [room('a')], [ledger('a', '2026-09', 900000), ledger('a', '2026-10', 250000)]);
    expect(result.candidates[0]).toMatchObject({ amount: 250000, period: '2026-10', sourceId: 'a', bankCode: '004' });
    expect(result.candidates[0].detail).toContain('관리비·공과금 제외');
});

it.each([250000, 0])('숙소 legacyId로 연결된 대장의 %i원과 지급완료 상태를 보존한다', rent => {
    const migratedRoom = { ...room('new-room'), legacyId: 'old-room' };
    const paidRecord = { ...ledger(' old-room ', '2026-10', rent), paymentStatus: 'paid' as const };
    const result = buildRentTransferCandidates('2026-10', [migratedRoom], [paidRecord]);
    expect(result.candidates[0]).toMatchObject({ sourceId: 'new-room', amount: rent });
    expect(result.candidates[0].warning).toContain('대장 지급완료');
    expect(result.candidates[0].warning).not.toContain('계약 월세 사용');
});

it('숙소 ID 없는 대장만 이름으로 연결하고 다른 ID의 동명 대장은 연결하지 않는다', () => {
    const target = room('current');
    const namelessIdRecord = { ...ledger('', '2026-10', 125000), accommodationName: ` ${target.name} `, paymentStatus: 'paid' as const };
    const namedResult = buildRentTransferCandidates('2026-10', [target], [namelessIdRecord]);
    expect(namedResult.candidates[0].amount).toBe(125000);
    expect(namedResult.candidates[0].warning).toContain('대장 지급완료');
    const differentIdResult = buildRentTransferCandidates('2026-10', [target], [{ ...namelessIdRecord, accommodationId: 'different-room' }]);
    expect(differentIdResult.candidates[0].amount).toBe(500000);
    expect(differentIdResult.candidates[0].warning).not.toContain('대장 지급완료');
});

it('대장 0원을 계약 월세로 대체하지 않으며 계약 시작 전·종료 후 숙소는 제외한다', () => {
    const result = buildRentTransferCandidates('2026-10', [room('zero'), room('future', '2026-11-01'), room('ended', '2026-01-01', '2026-09-30', 'inactive')], [ledger('zero', '2026-10', 0)]);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].amount).toBe(0);
});

it('해당 월 종료된 계약을 포함하고 대장 없는 계약 월세 및 자동이체를 설명한다', () => {
    const target = room('ended', '2026-01-01', '2026-10-15', 'inactive');
    target.contract.isAutoTransfer = true;
    const result = buildRentTransferCandidates('2026-10', [target], []);
    expect(result.candidates[0].amount).toBe(500000);
    expect(result.candidates[0].warning).toContain('일할 금액 확인');
    expect(result.candidates[0].warning).toContain('자동이체');
});

it('월세 대장 조회 실패를 대장 부재로 취급하여 계약금액으로 대체하지 않는다', async () => {
    (accommodationService.getAccommodations as jest.Mock).mockResolvedValue([room('a')]);
    (accommodationService.listAllUtilityRecords as jest.Mock).mockRejectedValue(new Error('fixture read failed'));
    expect((await loadRentTransferCandidates('2026-10')).candidates).toEqual([]);
    expect(accommodationService.listAllUtilityRecords).toHaveBeenCalledWith('2026-10');
});

it('외부지원온곳은 외부 작업팀에게 지급하며 내부지원·외부지원간곳·다른 월은 제외한다', () => {
    const outgoing = report({ id: 'out', siteId: 'external-site', responsibleTeamId: 'supplier', workers: [{ ...report().workers[0], teamId: 'our-team', workerTeamName: '테스트 담당팀' }] });
    const internal = report({ id: 'internal', workers: [{ ...report().workers[0], teamId: 'our-team-2', workerTeamName: '테스트 담당팀2' }] });
    const result = buildSupportTransferCandidates('2026-10', { ...supportData(), reports: [report(), outgoing, internal, report({ id: 'other-month', date: '2026-09-10' })] });
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]).toMatchObject({ sourceId: 'supplier', name: '테스트 외부팀', amount: 315000, accountNumber: bank.accountNumber });
});

it('현장 설정단가를 팀·일보 단가보다 우선하고 계산서 현장에도 VAT를 더하지 않는다', () => {
    const result = buildSupportTransferCandidates('2026-10', { ...supportData(), rates: [{ siteId: 'site', siteName: '테스트 현장', defaultRate: 250000 }] });
    expect(result.candidates[0].amount).toBe(375000);
    expect(result.candidates[0].supportDetail).toMatchObject({
        originalAmount: 375000, billingAmount: 375000, additionalAmount: 0, expenseAmount: 0, totalManDay: 1.5, siteCount: 1,
        workEntries: [{ date: '2026-10-10', siteName: '테스트 현장', targetTeamName: '테스트 담당팀', workerName: '테스트 작업자', manDay: 1.5, unitPrice: 250000, amount: 375000, rateSource: '현장 설정단가' }],
        expenseEntries: [],
    });
});

it('소수 공수를 유지하고 원본처럼 각 작업자별 청구금액만 원 단위로 반올림한다', () => {
    const fractionalReport = report({ workers: [
        { ...report().workers[0], workerId: 'fraction-one', manDay: 0.25 },
        { ...report().workers[0], workerId: 'fraction-two', manDay: 0.25 },
    ] });
    const result = buildSupportTransferCandidates('2026-10', {
        ...supportData(), reports: [fractionalReport], rates: [{ siteId: 'site', siteName: '테스트 현장', defaultRate: 210001 }],
    });
    expect(result.candidates[0].amount).toBe(105000);
    expect(result.candidates[0].detail).toContain('0.5공수');
    expect(result.candidates[0].supportDetail?.workEntries.map(entry => entry.amount)).toEqual([52500, 52500]);
});

it('은행 파일은 지원단가 변경과 별개인 월별 청구단가 우선순위를 적용한다', () => {
    const aggregateId = '외부지원온곳::our-team::supplier';
    const overrides = {
        bulkSupportRate: 999999, bulkRate: 220000,
        teamRates: { '외부지원온곳::supplier': 230000 }, aggregateRates: { [aggregateId]: 240000 },
        siteRates: { [`${aggregateId}::site`]: 260000 },
    };
    const candidate = buildSupportTransferCandidates('2026-10', { ...supportData(), overrides }).candidates[0];
    expect(candidate.amount).toBe(390000);
    expect(candidate.supportDetail?.workEntries[0]).toMatchObject({ unitPrice: 260000, rateSource: '월별 청구단가', amount: 390000 });
});

it('다른 담당팀에 지원한 동일 외부팀을 병합하고 병합 추가금액과 경비를 중복 없이 합산한다', () => {
    const reports = [report(), report({ id: 'second', responsibleTeamId: 'our-team-2', responsibleTeamName: '테스트 담당팀2' })];
    const result = buildSupportTransferCandidates('2026-10', {
        ...supportData(), reports, claims: [claim(), claim(), claim({ id: 'draft', status: 'draft', amount: 900000 }), claim({ id: 'wrong-team', payerTeamId: 'our-team', payerTeamName: '담당팀' })],
        adjustments: { 'merged::외부지원온곳::supplier': { additionalAmount: 20000 }, '외부지원온곳::our-team::supplier': { additionalAmount: 500000 } },
    });
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].amount).toBe(660000);
    expect(result.candidates[0].groupName).toContain('테스트 담당팀2');
    const detail = result.candidates[0].supportDetail!;
    expect(detail).toMatchObject({ originalAmount: 660000, billingAmount: 630000, additionalAmount: 20000, expenseAmount: 10000, totalManDay: 3, adjustmentScope: 'merged' });
    expect(detail.workEntries.map(entry => entry.targetTeamName)).toEqual(['테스트 담당팀', '테스트 담당팀2']);
    expect(detail.expenseEntries).toEqual([{ date: '2026-10-12', siteName: '테스트 현장', category: '식비', description: '테스트 경비', amount: 10000, status: 'charged' }]);
    expect(detail.workEntries.reduce((sum, entry) => sum + entry.amount, 0) + detail.additionalAmount + detail.expenseEntries.reduce((sum, entry) => sum + entry.amount, 0)).toBe(result.candidates[0].amount);
});

it('기존 지원비 기본단가 사용과 입금완료 내역을 표시한다', () => {
    const noRateTeams = teams.map(team => ({ ...team, supportRate: undefined }));
    const noRateReport = report({ workers: [{ ...report().workers[0], unitPrice: undefined }] });
    const result = buildSupportTransferCandidates('2026-10', { ...supportData(), teams: noRateTeams, reports: [noRateReport], adjustments: { '외부지원온곳::our-team::supplier': { progressStatus: 'depositComplete' } } });
    expect(result.candidates[0].amount).toBe(345000);
    expect(result.candidates[0].warning).toContain('기본단가 230,000원');
    expect(result.candidates[0].warning).toContain('입금완료');
    expect(result.candidates[0].supportDetail?.workEntries[0]).toMatchObject({ unitPrice: 230000, rateSource: '기본단가' });
});

it('경비의 팀·현장 ID가 다르면 이름이 같아도 지급액에 합치지 않는다', () => {
    const result = buildSupportTransferCandidates('2026-10', { ...supportData(), claims: [
        claim({ id: 'correct', siteName: '테스트 현장' }),
        claim({ id: 'wrong-team', payerTeamId: 'another-supplier', siteName: '테스트 현장', amount: 900000 }),
        claim({ id: 'wrong-site', siteId: 'another-site', siteName: '테스트 현장', amount: 800000 }),
    ] });
    expect(result.candidates[0].amount).toBe(325000);
    expect(result.candidates[0].supportDetail?.expenseEntries).toHaveLength(1);
    expect(result.warnings.join(' ')).toContain('식별정보가 달라');
});

it('이전 ID로 연결되는 경비는 포함하고 동명 팀의 이름만 있는 경비는 제외한다', () => {
    const migratedTeams = teams.map(team => team.id === 'supplier' ? { ...team, legacyId: 'old-supplier' } : team);
    const result = buildSupportTransferCandidates('2026-10', { ...supportData(), teams: [...migratedTeams, { ...teams[2], id: 'same-name' }],
        sites: sites.map(site => site.id === 'site' ? { ...site, legacyId: 'old-site' } : site), claims: [
            claim({ id: 'legacy', payerTeamId: 'old-supplier', siteId: 'old-site', siteName: '테스트 현장' }),
            claim({ id: 'ambiguous', payerTeamId: '', siteName: '테스트 현장', amount: 900000 }),
        ] });
    expect(result.candidates[0].amount).toBe(325000);
    expect(result.candidates[0].supportDetail?.expenseEntries).toHaveLength(1);
});

it('이름만 있는 경비는 팀과 현장이 하나로 식별될 때만 연결한다', () => {
    const result = buildSupportTransferCandidates('2026-10', { ...supportData(), claims: [claim({ payerTeamId: '', siteId: '', siteName: '테스트 현장' })] });
    expect(result.candidates[0].amount).toBe(325000);
});

it('잘못된 팀 ID에 동명 팀의 계좌를 연결하지 않는다', () => {
    const result = buildSupportTransferCandidates('2026-10', { ...supportData(), reports: [report({ workers: [{ ...report().workers[0], teamId: 'unknown-id' }] })] });
    expect(result.candidates[0]).toMatchObject({ sourceId: 'unknown-id', accountNumber: '', bankCode: '' });
    expect(result.candidates[0].warning).toContain('원본 등록정보 확인');
});

it('현장 이름이 없을 때 무관한 무명 단가를 가져오지 않는다', () => {
    const result = buildSupportTransferCandidates('2026-10', { ...supportData(), sites: sites.map(site => ({ ...site, name: '' })),
        reports: [report({ siteName: '' })], rates: [{ siteId: 'another-site', siteName: '', defaultRate: 900000 }] });
    expect(result.candidates[0].amount).toBe(315000);
});

it('이름이 같은 다른 현장의 단가를 가져오지 않고 이전 현장 ID는 연결한다', () => {
    const sameNameSites = [...sites, { ...sites[0], id: 'same-name-site' }];
    const wrongRate = buildSupportTransferCandidates('2026-10', { ...supportData(), sites: sameNameSites,
        rates: [{ siteId: 'same-name-site', siteName: '테스트 현장', defaultRate: 900000 }] });
    expect(wrongRate.candidates[0].amount).toBe(315000);
    const migrated = buildSupportTransferCandidates('2026-10', { ...supportData(), sites: sites.map(site => site.id === 'site' ? { ...site, legacyId: 'old-site' } : site),
        rates: [{ siteId: 'old-site', siteName: '이전 현장명', defaultRate: 250000 }] });
    expect(migrated.candidates[0].amount).toBe(375000);
});

it('팀의 은행과 회사의 계좌번호를 섞어 잘못된 은행 계좌를 만들지 않는다', () => {
    const partialTeams = teams.map(team => team.id === 'supplier' ? { ...team, bankName: '신한은행', accountNumber: '' } : team);
    const result = buildSupportTransferCandidates('2026-10', { ...supportData(), teams: partialTeams });
    expect(result.candidates[0].bankCode).toBe('088');
    expect(result.candidates[0].accountNumber).toBe('');
    expect(result.candidates[0].warning).toContain('계좌번호');
});

it('선택월의 마지막 날짜로 조회하고 저장된 해당월 청구단가·추가금액만 반영한다', async () => {
    window.localStorage.setItem('support-team-payment-rate-overrides-v1:2026-10', JSON.stringify({ bulkRate: 300000 }));
    window.localStorage.setItem('support-team-payment-manual-v1:2026-10', JSON.stringify({ '외부지원온곳::our-team::supplier': { additionalAmount: 25000 } }));
    window.localStorage.setItem('support-team-payment-rate-overrides-v1:2026-09', JSON.stringify({ bulkRate: 900000 }));
    window.localStorage.setItem('support-team-payment-manual-v1:2026-09', JSON.stringify({ '외부지원온곳::our-team::supplier': { additionalAmount: 999999 } }));
    const result = await loadSupportTransferCandidates('2026-10');
    expect(dailyReportService.getReportsByRange).toHaveBeenCalledWith('2026-10-01', '2026-10-31');
    expect(result.candidates[0].amount).toBe(475000);
});

it('지원단가/후청구 조회 실패 시 불완전한 이체금액을 제공하지 않는다', async () => {
    (supportRateService.getAllSiteRates as jest.Mock).mockRejectedValue(new Error('fixture read failed'));
    (teamExpenseLedgerService.getClaimsByMonth as jest.Mock).mockRejectedValue(new Error('fixture read failed'));
    const result = await loadSupportTransferCandidates('2026-10');
    expect(result.candidates).toEqual([]);
    expect(result.warnings).toHaveLength(2);
});

it('손상된 월별 저장 설정을 기본값으로 대체하지 않는다', async () => {
    window.localStorage.setItem('support-team-payment-rate-overrides-v1:2026-10', 'broken');
    const result = await loadSupportTransferCandidates('2026-10');
    expect(result.candidates).toEqual([]);
    expect(result.warnings.join(' ')).toContain('월별 지원단가');
});

it('유효하지 않은 월은 원본을 조회하지 않으며 변환은 원본 객체를 변경하지 않는다', async () => {
    expect((await loadSupportTransferCandidates('2026-13')).warnings).not.toHaveLength(0);
    expect(dailyReportService.getReportsByRange).not.toHaveBeenCalled();
    const data = supportData();
    const before = JSON.stringify(data);
    buildSupportTransferCandidates('2026-10', data);
    expect(JSON.stringify(data)).toBe(before);
});
