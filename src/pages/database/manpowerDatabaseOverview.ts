import type { Worker } from '../../services/manpowerService';
import type { Team } from '../../services/teamService';
import type { Site } from '../../services/siteService';
import type { Company } from '../../services/companyService';
import type { OfficeStaff } from '../../services/officeStaffService';
import type { DailyReport } from '../../services/dailyReportService';

export interface DatabaseStats {
    workers: {
        total: number;
        active: number;
        inactive: number;
        unassigned: number;
    };
    offices: {
        total: number;
        active: number;
        pending: number;
        linked: number;
    };
    teams: {
        total: number;
        active: number;
        inactive: number;
    };
    sites: {
        total: number;
        active: number;
        completed: number;
    };
    companies: {
        total: number;
        contractor: number;
        partner: number;
        builder: number;
        rental: number;
    };
    accounts: {
        workerMissing: number;
        teamMissing: number;
        companyMissing: number;
    };
    reports: {
        total: number;
        thisMonth: number;
        today: number;
    };
}

export interface IntegratedDatabaseOverviewSnapshot {
    workers: Worker[];
    officeStaff: OfficeStaff[];
    teams: Team[];
    sites: Site[];
    companies: Company[];
    allReports: DailyReport[];
    recentReports: DailyReport[];
    stats: DatabaseStats;
}

const ACTIVE_WORKER_STATUS = '\uC7AC\uC9C1';
const RETIRED_WORKER_STATUS = '\uD1F4\uC0AC';
const ON_LEAVE_WORKER_STATUS = '\uD734\uC9C1';
const OFFICE_PENDING_STATUS = '\uC2B9\uC778\uB300\uAE30';
const CONTRACTOR_COMPANY_TYPE = '\uC2DC\uACF5\uC0AC';
const PARTNER_COMPANY_TYPE = '\uD611\uB825\uC0AC';
const BUILDER_COMPANY_TYPE = '\uAC74\uC124\uC0AC';
const RENTAL_COMPANY_TYPE = '\uC784\uB300\uC0AC';

const toText = (value: unknown): string => String(value ?? '').trim();

export const createEmptyDatabaseStats = (): DatabaseStats => ({
    workers: { total: 0, active: 0, inactive: 0, unassigned: 0 },
    offices: { total: 0, active: 0, pending: 0, linked: 0 },
    teams: { total: 0, active: 0, inactive: 0 },
    sites: { total: 0, active: 0, completed: 0 },
    companies: { total: 0, contractor: 0, partner: 0, builder: 0, rental: 0 },
    accounts: { workerMissing: 0, teamMissing: 0, companyMissing: 0 },
    reports: { total: 0, thisMonth: 0, today: 0 }
});

export const formatDateKey = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export const buildReportStats = (
    reports: DailyReport[],
    today = new Date()
): DatabaseStats['reports'] => {
    const todayKey = formatDateKey(today);
    const monthKey = todayKey.slice(0, 7);

    return {
        total: reports.length,
        thisMonth: reports.filter(report => toText(report.date).startsWith(monthKey)).length,
        today: reports.filter(report => toText(report.date) === todayKey).length
    };
};

export const filterReportsByDateRange = (
    reports: DailyReport[],
    startDate: string,
    endDate: string
): DailyReport[] => reports.filter((report) => {
    const date = toText(report.date);
    return date >= startDate && date <= endDate;
});

export const buildDatabaseStats = (
    workers: Worker[],
    officeStaff: OfficeStaff[],
    teams: Team[],
    sites: Site[],
    companies: Company[],
    reportStats: DatabaseStats['reports']
): DatabaseStats => ({
    workers: {
        total: workers.length,
        active: workers.filter(worker => worker.status === ACTIVE_WORKER_STATUS).length,
        inactive: workers.filter(worker => worker.status === RETIRED_WORKER_STATUS || worker.status === ON_LEAVE_WORKER_STATUS).length,
        unassigned: workers.filter(worker => !worker.teamId).length
    },
    offices: {
        total: officeStaff.length,
        active: officeStaff.filter((staff) => (staff.status || ACTIVE_WORKER_STATUS) !== RETIRED_WORKER_STATUS).length,
        pending: officeStaff.filter((staff) => staff.status === OFFICE_PENDING_STATUS).length,
        linked: officeStaff.filter((staff) => !!staff.uid).length,
    },
    teams: {
        total: teams.length,
        active: teams.filter(team => team.status === 'active' || !team.status).length,
        inactive: teams.filter(team => team.status === 'waiting' || team.status === 'closed').length
    },
    sites: {
        total: sites.length,
        active: sites.filter(site => site.status === 'active').length,
        completed: sites.filter(site => site.status === 'completed').length
    },
    companies: {
        total: companies.length,
        contractor: companies.filter(company => company.type === CONTRACTOR_COMPANY_TYPE).length,
        partner: companies.filter(company => company.type === PARTNER_COMPANY_TYPE).length,
        builder: companies.filter(company => company.type === BUILDER_COMPANY_TYPE).length,
        rental: companies.filter(company => company.type === RENTAL_COMPANY_TYPE).length
    },
    accounts: {
        workerMissing: workers.filter(worker => !worker.accountNumber).length,
        teamMissing: teams.filter(team => !team.accountNumber).length,
        companyMissing: companies.filter(company => !company.accountNumber).length,
    },
    reports: reportStats
});

export const buildOverviewSnapshot = (params: {
    workers: Worker[];
    officeStaff: OfficeStaff[];
    teams: Team[];
    sites: Site[];
    companies: Company[];
    allReports: DailyReport[];
    today?: Date;
}): IntegratedDatabaseOverviewSnapshot => {
    const today = params.today ?? new Date();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 30);

    const startDateStr = formatDateKey(startDate);
    const endDateStr = formatDateKey(today);
    const reportStats = buildReportStats(params.allReports, today);
    const recentReports = filterReportsByDateRange(params.allReports, startDateStr, endDateStr);

    return {
        workers: params.workers,
        officeStaff: params.officeStaff,
        teams: params.teams,
        sites: params.sites,
        companies: params.companies,
        allReports: params.allReports,
        recentReports,
        stats: buildDatabaseStats(
            params.workers,
            params.officeStaff,
            params.teams,
            params.sites,
            params.companies,
            reportStats
        )
    };
};
