import { buildOverviewSnapshot } from '../../pages/database/manpowerDatabaseOverview';

export const MANPOWER_DB_TEST_TODAY = new Date(2026, 6, 7);

const worker = (overrides: Record<string, unknown>) => ({
    id: 'worker',
    name: 'worker',
    status: '재직',
    ...overrides,
}) as any;

const team = (overrides: Record<string, unknown>) => ({
    id: 'team',
    name: 'team',
    type: '직영',
    status: 'active',
    memberIds: [],
    memberNames: [],
    siteNames: [],
    ...overrides,
}) as any;

const site = (overrides: Record<string, unknown>) => ({
    id: 'site',
    name: 'site',
    code: 'SITE',
    status: 'active',
    ...overrides,
}) as any;

const company = (overrides: Record<string, unknown>) => ({
    id: 'company',
    name: 'company',
    code: 'COMP',
    type: '협력사',
    status: 'active',
    siteNames: [],
    ...overrides,
}) as any;

const report = (date: string, overrides: Record<string, unknown> = {}) => ({
    id: `report-${date}-${String(overrides.siteId || 's1')}`,
    date,
    teamId: 't1',
    teamName: '1팀',
    siteId: 's1',
    siteName: '과천 A현장',
    workers: [],
    ...overrides,
}) as any;

export const createManpowerDbSearchFixture = () => buildOverviewSnapshot({
    today: MANPOWER_DB_TEST_TODAY,
    workers: [
        worker({
            id: 'w1',
            name: '김철수',
            role: '반장',
            status: '재직',
            teamId: 't1',
            teamName: '1팀',
            siteId: 's1',
            siteName: '과천 A현장',
            companyId: 'c1',
            companyName: '청연건설',
            contact: '010-1234-5678',
            bankName: '국민',
            accountNumber: '123456789012',
            accountHolder: '김철수',
            idNumber: '900101-1234567',
        }),
        worker({
            id: 'w2',
            name: '이영희',
            role: '작업자',
            status: '재직',
            teamId: 't1',
            teamName: '1팀',
            siteId: 's1',
            siteName: '과천 A현장',
            companyId: 'c1',
            companyName: '청연건설',
            contact: '01099991234',
            accountNumber: '',
        }),
        worker({
            id: 'w3',
            name: '박미배',
            status: '재직',
            teamId: '',
            teamName: '',
        }),
        worker({
            id: 'w4',
            name: '최퇴사',
            status: '퇴사',
            teamId: 't2',
            teamName: '2팀',
            accountNumber: '987654321',
        }),
        worker({
            id: 'w5',
            name: '정미출',
            status: '재직',
            teamId: 't2',
            teamName: '2팀',
            accountNumber: '222333444',
        }),
    ],
    officeStaff: [],
    teams: [
        team({
            id: 't1',
            name: '1팀',
            companyId: 'c1',
            companyName: '청연건설',
            memberIds: ['w1', 'w2'],
            memberNames: ['김철수', '이영희'],
            siteNames: ['과천 A현장'],
            accountNumber: '111222333',
        }),
        team({
            id: 't2',
            name: '2팀',
            companyId: 'c2',
            companyName: '현대건설',
            memberIds: ['w4', 'w5'],
            memberNames: ['최퇴사', '정미출'],
            accountNumber: '',
        }),
        team({
            id: 't3',
            name: '청연특수팀',
            companyId: 'c1',
            companyName: '청연건설',
            accountNumber: '',
        }),
    ],
    sites: [
        site({
            id: 's1',
            name: '과천 A현장',
            code: 'GC-A',
            status: 'active',
            responsibleTeamId: 't1',
            responsibleTeamName: '1팀',
            companyId: 'c2',
            companyName: '현대건설',
            partnerId: 'c1',
            partnerName: '청연건설',
        }),
        site({
            id: 's2',
            name: '과천 B현장',
            code: 'GC-B',
            status: 'active',
            responsibleTeamId: '',
            responsibleTeamName: '',
            companyId: 'c2',
            companyName: '현대건설',
        }),
        site({
            id: 's3',
            name: '판교 C현장',
            code: 'PG-C',
            status: 'active',
            responsibleTeamId: 't1',
            responsibleTeamName: '1팀',
            companyId: 'c1',
            companyName: '청연건설',
        }),
    ],
    companies: [
        company({
            id: 'c1',
            name: '청연건설',
            code: 'CY',
            type: '협력사',
            phone: '010-2222-3333',
            accountNumber: '333444555',
            siteNames: ['과천 A현장'],
        }),
        company({
            id: 'c2',
            name: '현대건설',
            code: 'HD',
            type: '시공사',
            accountNumber: '',
            siteNames: ['과천 A현장', '과천 B현장'],
        }),
    ],
    allReports: [
        report('2026-07-02', {
            workers: [
                { workerId: 'w1', name: '김철수', manDay: 1, role: '반장' },
                { workerId: 'w4', name: '최퇴사', manDay: 1, role: '작업자' },
            ],
        }),
        report('2026-07-03', {
            siteId: 's2',
            siteName: '과천 B현장',
            teamId: 't2',
            teamName: '2팀',
            workers: [{ workerId: 'w2', name: '이영희', manDay: 1, role: '작업자' }],
        }),
        report('2026-06-20', {
            siteId: 's1',
            siteName: '과천 A현장',
            workers: [{ workerId: 'w2', name: '이영희', manDay: 1, role: '작업자' }],
        }),
        report('2026-06-10', {
            teamId: 't2',
            teamName: '2팀',
            siteId: 's2',
            siteName: '과천 B현장',
            workers: [
                { workerId: 'w4', name: '최퇴사', manDay: 1, role: '작업자' },
                { workerId: 'w5', name: '정미출', manDay: 1, role: '작업자' },
            ],
        }),
        report('2026-07-04', {
            teamId: 't1',
            teamName: '1팀',
            siteId: 's3',
            siteName: '판교 C현장',
            workers: [
                { workerId: 'w4', name: '최퇴사', teamId: 't2', workerTeamName: '2팀', manDay: 1, role: '작업자', salaryModel: '지원팀', unitPrice: 180000 },
            ],
        }),
        report('2026-07-05', {
            teamId: 't1',
            teamName: '1팀',
            siteId: 's3',
            siteName: '판교 C현장',
            workers: [
                { workerId: 'w1', name: '김철수', teamId: 't3', workerTeamName: '청연특수팀', manDay: 0.5, role: '반장', unitPrice: 220000 },
            ],
        }),
    ],
});
