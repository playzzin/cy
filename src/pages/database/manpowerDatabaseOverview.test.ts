import {
    buildDatabaseStats,
    buildOverviewSnapshot,
    buildReportStats,
    filterReportsByDateRange,
    formatDateKey,
} from './manpowerDatabaseOverview';

const worker = (overrides: Record<string, unknown>) => ({
    id: 'worker',
    name: 'worker',
    ...overrides,
}) as any;

const officeStaff = (overrides: Record<string, unknown>) => ({
    id: 'office',
    name: 'office',
    ...overrides,
}) as any;

const team = (overrides: Record<string, unknown>) => ({
    id: 'team',
    name: 'team',
    ...overrides,
}) as any;

const site = (overrides: Record<string, unknown>) => ({
    id: 'site',
    name: 'site',
    ...overrides,
}) as any;

const company = (overrides: Record<string, unknown>) => ({
    id: 'company',
    name: 'company',
    ...overrides,
}) as any;

const report = (date: string, overrides: Record<string, unknown> = {}) => ({
    id: `report-${date}`,
    date,
    workers: [],
    ...overrides,
}) as any;

describe('manpowerDatabaseOverview', () => {
    it('formats local date keys without UTC conversion', () => {
        expect(formatDateKey(new Date(2026, 6, 6))).toBe('2026-07-06');
    });

    it('builds daily report stats for today and the current month', () => {
        const stats = buildReportStats([
            report('2026-07-06'),
            report('2026-07-05'),
            report('2026-06-30'),
            report(''),
        ], new Date(2026, 6, 6));

        expect(stats).toEqual({
            total: 4,
            thisMonth: 2,
            today: 1,
        });
    });

    it('filters daily reports by an inclusive date range', () => {
        const reports = [
            report('2026-06-05'),
            report('2026-06-06'),
            report('2026-06-20'),
            report('2026-07-06'),
            report('2026-07-07'),
        ];

        expect(filterReportsByDateRange(reports, '2026-06-06', '2026-07-06').map(row => row.date))
            .toEqual(['2026-06-06', '2026-06-20', '2026-07-06']);
    });

    it('builds master data statistics from workers, offices, teams, sites and companies', () => {
        const stats = buildDatabaseStats(
            [
                worker({ id: 'w1', status: '재직', teamId: 't1', accountNumber: '111' }),
                worker({ id: 'w2', status: '퇴사' }),
                worker({ id: 'w3', status: '휴직', teamId: '' }),
            ],
            [
                officeStaff({ id: 'o1', status: '재직', uid: 'u1' }),
                officeStaff({ id: 'o2', status: '승인대기' }),
                officeStaff({ id: 'o3', status: '퇴사' }),
            ],
            [
                team({ id: 't1', status: 'active', accountNumber: '222' }),
                team({ id: 't2', status: 'waiting' }),
                team({ id: 't3', status: 'closed' }),
            ],
            [
                site({ id: 's1', status: 'active' }),
                site({ id: 's2', status: 'completed' }),
            ],
            [
                company({ id: 'c1', type: '시공사', accountNumber: '333' }),
                company({ id: 'c2', type: '협력사' }),
                company({ id: 'c3', type: '건설사' }),
                company({ id: 'c4', type: '임대사' }),
            ],
            { total: 10, thisMonth: 3, today: 1 }
        );

        expect(stats.workers).toEqual({ total: 3, active: 1, inactive: 2, unassigned: 2 });
        expect(stats.offices).toEqual({ total: 3, active: 2, pending: 1, linked: 1 });
        expect(stats.teams).toEqual({ total: 3, active: 1, inactive: 2 });
        expect(stats.sites).toEqual({ total: 2, active: 1, completed: 1 });
        expect(stats.companies).toEqual({ total: 4, contractor: 1, partner: 1, builder: 1, rental: 1 });
        expect(stats.accounts).toEqual({ workerMissing: 2, teamMissing: 2, companyMissing: 3 });
        expect(stats.reports).toEqual({ total: 10, thisMonth: 3, today: 1 });
    });

    it('builds an overview snapshot with recent reports and derived stats', () => {
        const snapshot = buildOverviewSnapshot({
            workers: [worker({ status: '재직', teamId: 't1' })],
            officeStaff: [],
            teams: [team({ status: 'active' })],
            sites: [],
            companies: [],
            allReports: [
                report('2026-06-05'),
                report('2026-06-06'),
                report('2026-07-06'),
            ],
            today: new Date(2026, 6, 6),
        });

        expect(snapshot.recentReports.map(row => row.date)).toEqual(['2026-06-06', '2026-07-06']);
        expect(snapshot.stats.reports).toEqual({ total: 3, thisMonth: 1, today: 1 });
    });
});
