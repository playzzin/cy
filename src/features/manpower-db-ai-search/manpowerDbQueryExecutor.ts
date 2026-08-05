import type { IntegratedDatabaseOverviewSnapshot } from '../../pages/database/manpowerDatabaseOverview';
import { ManpowerDbPlanStep } from './manpowerDbQueryPlanner';
import { ManpowerDbSearchQuery } from './manpowerDbSearchTypes';
import {
    filterReports,
    findSitesWithoutResponsibleTeamWithReports,
    findWorkersFromReports,
} from './manpowerDbAnalysisEngine';

export interface ManpowerDbExecutionResult {
    plan: ManpowerDbPlanStep[];
    outputCount: number;
    refs: Array<{ entity: string; id: string; name: string }>;
}

const text = (value: unknown): string => String(value ?? '').trim();

export const executeManpowerDbPlan = (
    plan: ManpowerDbPlanStep[],
    snapshot: IntegratedDatabaseOverviewSnapshot,
    query: ManpowerDbSearchQuery
): ManpowerDbExecutionResult => {
    let refs: Array<{ entity: string; id: string; name: string }> = [];
    const executed = plan.map((step) => {
        if (step.op === 'filter_reports') {
            const reports = filterReports(snapshot, query.filters.dateRange);
            refs = reports.map((report) => ({ entity: 'daily_report', id: text(report.id), name: text(report.date) }));
        }

        if (step.op === 'extract_workers_from_reports') {
            const reports = filterReports(snapshot, query.filters.dateRange);
            refs = findWorkersFromReports(snapshot, reports).map((worker) => ({ entity: 'worker', id: text(worker.id), name: text(worker.name) }));
        }

        if (step.op === 'filter_missing_field' && step.input === 'accountNumber') {
            refs = refs.filter((ref) => {
                if (ref.entity === 'worker') {
                    const worker = snapshot.workers.find((item) => text(item.id) === ref.id || text(item.name) === ref.name);
                    return !text(worker?.accountNumber);
                }
                if (ref.entity === 'team') {
                    const team = snapshot.teams.find((item) => text(item.id) === ref.id || text(item.name) === ref.name);
                    return !text(team?.accountNumber);
                }
                if (ref.entity === 'company') {
                    const company = snapshot.companies.find((item) => text(item.id) === ref.id || text(item.name) === ref.name);
                    return !text(company?.accountNumber);
                }
                return true;
            });
        }

        if (step.op === 'filter_sites_without_responsible_team' && query.filters.dateRange) {
            refs = findSitesWithoutResponsibleTeamWithReports(snapshot, query.filters.dateRange)
                .map((site) => ({ entity: 'site', id: text(site.id), name: text(site.name) }));
        }

        return {
            ...step,
            outputCount: refs.length || step.outputCount,
        };
    });

    return {
        plan: executed,
        outputCount: refs.length,
        refs,
    };
};
