import { buildOverviewSnapshot } from '../../pages/database/manpowerDatabaseOverview';
import { searchManpowerDbSnapshot } from './manpowerDbAiSearch';

const today = new Date(2026, 6, 7);

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
    id: `report-${date}`,
    date,
    teamId: 't1',
    teamName: '1팀',
    siteId: 's1',
    siteName: '과천 A현장',
    workers: [],
    ...overrides,
}) as any;

const createSnapshot = () => buildOverviewSnapshot({
    today,
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
            name: '판교 B현장',
            code: 'PG-B',
            status: 'active',
            responsibleTeamId: '',
            responsibleTeamName: '',
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
            siteNames: ['과천 A현장'],
        }),
    ],
    allReports: [
        report('2026-07-02', {
            workers: [
                { workerId: 'w1', name: '김철수', manDay: 1, role: '반장' },
                { workerId: 'w4', name: '최퇴사', manDay: 1, role: '작업자' },
            ],
        }),
        report('2026-06-20', {
            siteId: 's1',
            siteName: '과천 A현장',
            workers: [{ workerId: 'w2', name: '이영희', manDay: 1, role: '작업자' }],
        }),
    ],
});
describe('manpowerDbAiSearch', () => {
    it('searches workers by name and masks sensitive fields', () => {
        const result = searchManpowerDbSnapshot('김철수 정보 보여줘', createSnapshot(), today);

        expect(result.success).toBe(true);
        expect(result.resultType).toBe('worker_list');
        expect(result.rows).toHaveLength(1);
        expect(result.rows[0].name).toBe('김철수');

        const serialized = JSON.stringify(result);
        expect(serialized).toContain('010-****-5678');
        expect(serialized).toContain('123-****-012');
        expect(serialized).not.toContain('900101-1234567');
    });

    it('searches workers by team name', () => {
        const result = searchManpowerDbSnapshot('1팀 소속 작업자', createSnapshot(), today);

        expect(result.resultType).toBe('worker_list');
        expect(result.rows.map(row => row.name)).toEqual(['김철수', '이영희']);
        expect(result.related?.teams?.[0].name).toBe('1팀');
    });

    it('searches workers missing account numbers', () => {
        const result = searchManpowerDbSnapshot('계좌 없는 작업자', createSnapshot(), today);

        expect(result.resultType).toBe('worker_list');
        expect(result.rows.map(row => row.name)).toEqual(['이영희', '박미배']);
    });

    it('searches active workers with no recent attendance in the last 30 days', () => {
        const result = searchManpowerDbSnapshot('최근 30일 출역 없는 재직자', createSnapshot(), today);

        expect(result.resultType).toBe('integrity');
        expect(result.rows.map(row => row.name)).toEqual(['박미배', '정미출']);
    });

    it('searches retired workers that appear in this month reports', () => {
        const result = searchManpowerDbSnapshot('퇴사자인데 이번 달 일보에 나온 사람', createSnapshot(), today);

        expect(result.resultType).toBe('integrity');
        expect(result.rows.map(row => row.name)).toEqual(['최퇴사']);
    });

    it('searches site team and company relations by site name', () => {
        const result = searchManpowerDbSnapshot('과천 현장 담당팀', createSnapshot(), today);

        expect(result.resultType).toBe('site_list');
        expect(result.rows[0].name).toBe('과천 A현장');
        expect(result.related?.teams?.map(row => row.name)).toContain('1팀');
        expect(result.related?.companies?.map(row => row.name)).toEqual(expect.arrayContaining(['현대건설', '청연건설']));
    });
});
