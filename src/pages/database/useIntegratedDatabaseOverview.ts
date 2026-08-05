import { useCallback, useEffect, useState } from 'react';
import { manpowerService } from '../../services/manpowerService';
import { teamService } from '../../services/teamService';
import { siteService } from '../../services/siteService';
import { companyService } from '../../services/companyService';
import { officeStaffService } from '../../services/officeStaffService';
import { dailyReportService, type DailyReport } from '../../services/dailyReportService';
import {
    buildOverviewSnapshot,
    createEmptyDatabaseStats,
    type DatabaseStats,
    type IntegratedDatabaseOverviewSnapshot,
} from './manpowerDatabaseOverview';

const REPORT_LOAD_WARNING = '출력일보 데이터를 불러오지 못해 일보 통계와 무결성 항목은 제외했습니다.';
const OVERVIEW_LOAD_WARNING = '통합 DB 현황을 불러오지 못했습니다. 잠시 후 새로고침해 주세요.';

export interface UseIntegratedDatabaseOverviewResult {
    loading: boolean;
    loadWarning: string | null;
    stats: DatabaseStats;
    snapshot: IntegratedDatabaseOverviewSnapshot | null;
    reload: () => Promise<void>;
}

export const loadIntegratedDatabaseOverviewSnapshot = async (
    today = new Date()
): Promise<{ snapshot: IntegratedDatabaseOverviewSnapshot; warning: string | null }> => {
    const [
        workers,
        officeStaff,
        teams,
        sites,
        companies,
        reportsResult
    ] = await Promise.all([
        manpowerService.getWorkers(),
        officeStaffService.getOfficeStaff(),
        teamService.getTeams(),
        siteService.getSites(),
        companyService.getCompanies(),
        dailyReportService.getAllReports()
            .then((reports) => ({ reports, error: null as unknown }))
            .catch((error) => ({ reports: [] as DailyReport[], error }))
    ]);

    if (reportsResult.error) {
        console.warn('Failed to load daily reports for database overview:', reportsResult.error);
    }

    return {
        snapshot: buildOverviewSnapshot({
            workers,
            officeStaff,
            teams,
            sites,
            companies,
            allReports: reportsResult.reports,
            today
        }),
        warning: reportsResult.error ? REPORT_LOAD_WARNING : null
    };
};

export const useIntegratedDatabaseOverview = (): UseIntegratedDatabaseOverviewResult => {
    const [loading, setLoading] = useState(false);
    const [loadWarning, setLoadWarning] = useState<string | null>(null);
    const [stats, setStats] = useState<DatabaseStats>(() => createEmptyDatabaseStats());
    const [snapshot, setSnapshot] = useState<IntegratedDatabaseOverviewSnapshot | null>(null);

    const reload = useCallback(async () => {
        setLoading(true);
        setLoadWarning(null);

        try {
            const result = await loadIntegratedDatabaseOverviewSnapshot();
            setSnapshot(result.snapshot);
            setStats(result.snapshot.stats);
            setLoadWarning(result.warning);
        } catch (error) {
            console.error('Failed to load stats:', error);
            setLoadWarning(OVERVIEW_LOAD_WARNING);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        reload();
    }, [reload]);

    return {
        loading,
        loadWarning,
        stats,
        snapshot,
        reload
    };
};
