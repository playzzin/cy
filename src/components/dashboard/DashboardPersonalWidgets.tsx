import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCog, faExclamationTriangle, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { dailyReportService, type DailyReport } from '../../services/dailyReportService';
import { manpowerService } from '../../services/manpowerService';
import { siteService } from '../../services/siteService';
import { useAuth } from '../../contexts/AuthContext';
import { DASHBOARD_MODES, type DashboardModeConfig } from './roleDashboardConfig';
import { DashboardWidgetSettingsModal } from './DashboardWidgetSettingsModal';
import {
    isOverallDashboardWidgetScope,
    useDashboardWidgetSettings,
    type DashboardWidgetDefinition,
} from './useDashboardWidgetSettings';

interface DashboardPersonalWidgetsProps {
    modeConfig?: DashboardModeConfig;
}

interface SummaryWidgetData {
    value: string;
    unit: string;
    metaLabel: string;
    metaValue: string;
}

interface RankingRow {
    id: string;
    label: string;
    value: number;
    meta: string;
}

interface DashboardWidgetData {
    recentTotalManDay: SummaryWidgetData;
    registeredWorkers: SummaryWidgetData;
    registeredSites: SummaryWidgetData;
    teamMonthManDay: SummaryWidgetData;
    siteMonthRows: RankingRow[];
    workerMonthRows: RankingRow[];
}

interface TeamContext {
    teamId: string;
    teamName: string;
}

interface TeamReportAggregate {
    reportId: string;
    date: string;
    siteId: string;
    siteName: string;
    manDay: number;
    workerRows: Array<{
        workerId: string;
        workerName: string;
        manDay: number;
    }>;
}

const themeMap: Record<DashboardWidgetDefinition['color'], {
    icon: string;
    iconBg: string;
    accent: string;
    bar: string;
}> = {
    blue: {
        icon: 'text-blue-600',
        iconBg: 'bg-blue-50',
        accent: 'text-blue-700',
        bar: 'bg-blue-500',
    },
    emerald: {
        icon: 'text-emerald-600',
        iconBg: 'bg-emerald-50',
        accent: 'text-emerald-700',
        bar: 'bg-emerald-500',
    },
    amber: {
        icon: 'text-amber-600',
        iconBg: 'bg-amber-50',
        accent: 'text-amber-700',
        bar: 'bg-amber-500',
    },
    violet: {
        icon: 'text-violet-600',
        iconBg: 'bg-violet-50',
        accent: 'text-violet-700',
        bar: 'bg-violet-500',
    },
    cyan: {
        icon: 'text-cyan-600',
        iconBg: 'bg-cyan-50',
        accent: 'text-cyan-700',
        bar: 'bg-cyan-500',
    },
    rose: {
        icon: 'text-rose-600',
        iconBg: 'bg-rose-50',
        accent: 'text-rose-700',
        bar: 'bg-rose-500',
    },
};

const formatManDay = (value: number): string => (
    Number(value || 0).toLocaleString('ko-KR', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
    })
);

const formatDateLabel = (date?: string): string => {
    if (!date) return '-';
    return format(new Date(`${date}T00:00:00`), 'M월 d일');
};

const isActiveWorker = (status: unknown): boolean => {
    const normalized = String(status || '').trim().toLowerCase();
    return normalized === '재직' || normalized === 'active' || normalized === '근무';
};

const normalizeText = (value: unknown): string => String(value ?? '').trim();

const normalizeKey = (value: unknown): string => normalizeText(value).toLowerCase();

const matchesTeam = (
    teamId: unknown,
    teamName: unknown,
    teamContext: TeamContext
): boolean => {
    const targetId = normalizeText(teamId);
    const targetName = normalizeKey(teamName);
    const ownTeamId = normalizeText(teamContext.teamId);
    const ownTeamName = normalizeKey(teamContext.teamName);

    if (ownTeamId && targetId && targetId === ownTeamId) return true;
    if (ownTeamName && targetName && targetName === ownTeamName) return true;
    return false;
};

const getMonthRange = () => {
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    return {
        label: format(today, 'yyyy년 M월'),
        start: format(monthStart, 'yyyy-MM-dd'),
        end: format(today, 'yyyy-MM-dd'),
    };
};

const getWorkerTeamName = (worker: any): string => (
    normalizeText(worker.workerTeamName || worker.teamName)
);

const getTeamAggregates = (
    reports: DailyReport[],
    teamContext: TeamContext
): TeamReportAggregate[] => {
    return reports.flatMap((report) => {
        const workers = Array.isArray(report.workers) ? report.workers : [];
        const isOwnTeamReport = matchesTeam(report.teamId, report.teamName, teamContext);
        const workerRows = workers
            .filter((worker: any) => {
                if (matchesTeam(worker.teamId, getWorkerTeamName(worker), teamContext)) return true;
                return isOwnTeamReport && !normalizeText(worker.teamId) && !getWorkerTeamName(worker);
            })
            .map((worker: any) => ({
                workerId: normalizeText(worker.workerId) || `${normalizeText(worker.name) || '미지정'}:${report.id || report.date}`,
                workerName: normalizeText(worker.name) || '미지정 작업자',
                manDay: Number(worker.manDay) || 0,
            }))
            .filter((worker) => worker.manDay > 0);

        const workerManDay = workerRows.reduce((sum, worker) => sum + worker.manDay, 0);
        const fallbackManDay = isOwnTeamReport && workers.length === 0
            ? Number(report.totalManDay) || 0
            : 0;
        const manDay = workerManDay || fallbackManDay;

        if (manDay <= 0) return [];

        return [{
            reportId: normalizeText(report.id) || `${report.date}:${report.siteId}:${report.teamId}`,
            date: normalizeText(report.date),
            siteId: normalizeText(report.siteId) || normalizeText(report.siteName) || 'unknown-site',
            siteName: normalizeText(report.siteName) || '미지정 현장',
            manDay,
            workerRows,
        }];
    });
};

const getOverallAggregates = (reports: DailyReport[]): TeamReportAggregate[] => {
    return reports.flatMap((report) => {
        const workers = Array.isArray(report.workers) ? report.workers : [];
        const workerRows = workers
            .map((worker: any) => ({
                workerId: normalizeText(worker.workerId) || `${normalizeText(worker.name) || '미지정'}:${report.id || report.date}`,
                workerName: normalizeText(worker.name) || '미지정 작업자',
                manDay: Number(worker.manDay) || 0,
            }))
            .filter((worker) => worker.manDay > 0);

        const workerManDay = workerRows.reduce((sum, worker) => sum + worker.manDay, 0);
        const reportManDay = Number(report.totalManDay) || 0;
        const manDay = reportManDay > 0 ? reportManDay : workerManDay;

        if (manDay <= 0) return [];

        return [{
            reportId: normalizeText(report.id) || `${report.date}:${report.siteId}:${report.teamId}`,
            date: normalizeText(report.date),
            siteId: normalizeText(report.siteId) || normalizeText(report.siteName) || 'unknown-site',
            siteName: normalizeText(report.siteName) || '미지정 현장',
            manDay,
            workerRows,
        }];
    });
};

const getRecentTotal = (aggregates: TeamReportAggregate[]) => {
    const latestDate = aggregates.reduce<string | undefined>((latest, report) => {
        const date = normalizeText(report.date);
        if (!date) return latest;
        if (!latest || date > latest) return date;
        return latest;
    }, undefined);

    const latestReports = latestDate ? aggregates.filter((report) => report.date === latestDate) : [];
    return {
        latestDate,
        reportCount: latestReports.length,
        totalManDay: latestReports.reduce((sum, report) => sum + report.manDay, 0),
    };
};

const buildSiteRows = (aggregates: TeamReportAggregate[]): RankingRow[] => {
    const siteMap = new Map<string, {
        siteName: string;
        totalManDay: number;
        workerIds: Set<string>;
        dates: Set<string>;
    }>();

    aggregates.forEach((report) => {
        if (!siteMap.has(report.siteId)) {
            siteMap.set(report.siteId, {
                siteName: report.siteName,
                totalManDay: 0,
                workerIds: new Set(),
                dates: new Set(),
            });
        }

        const site = siteMap.get(report.siteId)!;
        site.totalManDay += report.manDay;
        if (report.date) site.dates.add(report.date);
        report.workerRows.forEach((worker) => {
            if (worker.workerId) site.workerIds.add(worker.workerId);
        });
    });

    return Array.from(siteMap.entries())
        .map(([siteId, site]) => ({
            id: siteId,
            label: site.siteName,
            value: site.totalManDay,
            meta: `${site.workerIds.size.toLocaleString('ko-KR')}명 · ${site.dates.size.toLocaleString('ko-KR')}일`,
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);
};

const buildWorkerRows = (aggregates: TeamReportAggregate[]): RankingRow[] => {
    const workerMap = new Map<string, {
        workerName: string;
        totalManDay: number;
        dates: Set<string>;
        sites: Set<string>;
    }>();

    aggregates.forEach((report) => {
        report.workerRows.forEach((worker) => {
            if (!workerMap.has(worker.workerId)) {
                workerMap.set(worker.workerId, {
                    workerName: worker.workerName,
                    totalManDay: 0,
                    dates: new Set(),
                    sites: new Set(),
                });
            }

            const entry = workerMap.get(worker.workerId)!;
            entry.totalManDay += worker.manDay;
            if (report.date) entry.dates.add(report.date);
            if (report.siteName) entry.sites.add(report.siteName);
        });
    });

    return Array.from(workerMap.entries())
        .map(([workerId, worker]) => ({
            id: workerId,
            label: worker.workerName,
            value: worker.totalManDay,
            meta: `${worker.dates.size.toLocaleString('ko-KR')}일 · ${Array.from(worker.sites).slice(0, 2).join(', ') || '현장 없음'}`,
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);
};

const buildEmptyData = (): DashboardWidgetData => ({
    recentTotalManDay: {
        value: '0.0',
        unit: '공수',
        metaLabel: '최근 출력일',
        metaValue: '-',
    },
    registeredWorkers: {
        value: '0',
        unit: '명',
        metaLabel: '재직',
        metaValue: '0명',
    },
    registeredSites: {
        value: '0',
        unit: '개소',
        metaLabel: '진행',
        metaValue: '0개소',
    },
    teamMonthManDay: {
        value: '0.0',
        unit: '공수',
        metaLabel: '출력일',
        metaValue: '0일',
    },
    siteMonthRows: [],
    workerMonthRows: [],
});

const SummaryCard: React.FC<{
    widget: DashboardWidgetDefinition;
    data: SummaryWidgetData;
}> = ({ widget, data }) => {
    const theme = themeMap[widget.color];

    return (
        <article className="min-h-[178px] rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                    <h3 className="text-sm font-bold text-slate-700">{widget.label}</h3>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{widget.desc}</p>
                </div>
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${theme.iconBg} ${theme.icon}`}>
                    <FontAwesomeIcon icon={widget.icon} />
                </span>
            </div>
            <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-slate-900">{data.value}</span>
                <span className="text-sm font-bold text-slate-400">{data.unit}</span>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-sm">
                <span className="text-slate-500">{data.metaLabel}</span>
                <span className={`font-bold ${theme.accent}`}>{data.metaValue}</span>
            </div>
        </article>
    );
};

const RankingCard: React.FC<{
    widget: DashboardWidgetDefinition;
    rows: RankingRow[];
}> = ({ widget, rows }) => {
    const theme = themeMap[widget.color];
    const maxValue = Math.max(...rows.map((row) => row.value), 1);

    return (
        <article className="min-h-[278px] rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                    <h3 className="text-sm font-bold text-slate-700">{widget.label}</h3>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{widget.desc}</p>
                </div>
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${theme.iconBg} ${theme.icon}`}>
                    <FontAwesomeIcon icon={widget.icon} />
                </span>
            </div>

            {rows.length > 0 ? (
                <div className="space-y-3">
                    {rows.map((row, index) => (
                        <div key={row.id} className="min-w-0">
                            <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                                <div className="flex min-w-0 items-center gap-2">
                                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-slate-100 text-[11px] font-bold text-slate-500">
                                        {index + 1}
                                    </span>
                                    <span className="truncate font-semibold text-slate-800">{row.label}</span>
                                </div>
                                <span className="shrink-0 font-bold text-slate-900">{formatManDay(row.value)}공</span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                                <div
                                    className={`h-full rounded-full ${theme.bar}`}
                                    style={{ width: `${Math.max(6, (row.value / maxValue) * 100)}%` }}
                                />
                            </div>
                            <div className="mt-1 truncate text-xs text-slate-400">{row.meta}</div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="flex h-[172px] items-center justify-center rounded-lg border border-dashed border-slate-200 text-sm text-slate-400">
                    이달 집계 데이터가 없습니다.
                </div>
            )}
        </article>
    );
};

const SkeletonCard: React.FC<{ kind: DashboardWidgetDefinition['kind'] }> = ({ kind }) => (
    <article className={`${kind === 'ranking' ? 'min-h-[278px]' : 'min-h-[178px]'} rounded-lg border border-slate-200 bg-white p-5 shadow-sm`}>
        <div className="mb-5 flex items-center justify-between">
            <div className="space-y-2">
                <div className="h-4 w-36 animate-pulse rounded bg-slate-200" />
                <div className="h-3 w-48 animate-pulse rounded bg-slate-100" />
            </div>
            <div className="h-10 w-10 animate-pulse rounded-lg bg-slate-100" />
        </div>
        <div className="space-y-3">
            <div className="h-8 w-24 animate-pulse rounded bg-slate-200" />
            <div className="h-3 w-full animate-pulse rounded bg-slate-100" />
            {kind === 'ranking' && (
                <>
                    <div className="h-3 w-4/5 animate-pulse rounded bg-slate-100" />
                    <div className="h-3 w-2/3 animate-pulse rounded bg-slate-100" />
                </>
            )}
        </div>
    </article>
);

export const DashboardPersonalWidgets: React.FC<DashboardPersonalWidgetsProps> = ({
    modeConfig = DASHBOARD_MODES[0],
}) => {
    const { currentUser } = useAuth();
    const widgetSettings = useDashboardWidgetSettings(modeConfig);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [data, setData] = useState<DashboardWidgetData>(buildEmptyData);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [teamLabel, setTeamLabel] = useState('');

    const monthRange = useMemo(() => getMonthRange(), []);
    const isOverallScope = isOverallDashboardWidgetScope(modeConfig);

    useEffect(() => {
        let isMounted = true;

        const fetchWidgetData = async () => {
            if (!currentUser?.uid) {
                setLoading(false);
                return;
            }

            setLoading(true);
            setError(null);

            try {
                const [
                    workers,
                    sites,
                    monthReports,
                    allReports,
                ] = await Promise.all([
                    manpowerService.getWorkers(),
                    siteService.getSites(),
                    dailyReportService.getReports({ startDate: monthRange.start, endDate: monthRange.end }),
                    dailyReportService.getAllReports(),
                ]);

                if (!isMounted) return;

                let scopedWorkers = workers;
                let scopedSites = sites;
                let monthAggregates = getOverallAggregates(monthReports);
                let allAggregates = getOverallAggregates(allReports);
                let nextScopeLabel = '전체';

                if (!isOverallScope) {
                    const linkedWorker = await manpowerService.getWorkerByUid(currentUser.uid);
                    const teamContext: TeamContext = {
                        teamId: normalizeText(linkedWorker?.teamId),
                        teamName: normalizeText(linkedWorker?.teamName),
                    };

                    if (!teamContext.teamId && !teamContext.teamName) {
                        if (isMounted) {
                            setTeamLabel('소속 팀 미지정');
                            setData(buildEmptyData());
                            setError('소속 팀 정보가 없어 팀 기준 위젯을 표시할 수 없습니다.');
                        }
                        return;
                    }

                    scopedWorkers = workers.filter((worker) => matchesTeam(worker.teamId, worker.teamName, teamContext));
                    scopedSites = sites.filter((site) => matchesTeam(site.responsibleTeamId, site.responsibleTeamName, teamContext));
                    monthAggregates = getTeamAggregates(monthReports, teamContext);
                    allAggregates = getTeamAggregates(allReports, teamContext);
                    nextScopeLabel = teamContext.teamName || '내 팀';
                }

                const recent = getRecentTotal(allAggregates);
                const activeWorkers = scopedWorkers.filter((worker) => isActiveWorker(worker.status)).length;
                const activeSites = scopedSites.filter((site) => normalizeText(site.status) === 'active').length;
                const monthTotalManDay = monthAggregates.reduce((sum, report) => sum + report.manDay, 0);
                const monthWorkDays = new Set(monthAggregates.map((report) => report.date).filter(Boolean));

                setTeamLabel(nextScopeLabel);

                setData({
                    recentTotalManDay: {
                        value: formatManDay(recent.totalManDay),
                        unit: '공수',
                        metaLabel: '최근 출력일',
                        metaValue: recent.latestDate
                            ? `${formatDateLabel(recent.latestDate)} · ${recent.reportCount}건`
                            : '출력일보 없음',
                    },
                    registeredWorkers: {
                        value: scopedWorkers.length.toLocaleString('ko-KR'),
                        unit: '명',
                        metaLabel: '재직',
                        metaValue: `${activeWorkers.toLocaleString('ko-KR')}명`,
                    },
                    registeredSites: {
                        value: scopedSites.length.toLocaleString('ko-KR'),
                        unit: '개소',
                        metaLabel: '진행',
                        metaValue: `${activeSites.toLocaleString('ko-KR')}개소`,
                    },
                    teamMonthManDay: {
                        value: formatManDay(monthTotalManDay),
                        unit: '공수',
                        metaLabel: '출력일',
                        metaValue: `${monthWorkDays.size.toLocaleString('ko-KR')}일`,
                    },
                    siteMonthRows: buildSiteRows(monthAggregates),
                    workerMonthRows: buildWorkerRows(monthAggregates),
                });
            } catch (fetchError: any) {
                console.error('[DashboardPersonalWidgets] Failed to load widget data:', fetchError);
                if (isMounted) {
                    setError(fetchError?.message || '위젯 데이터를 불러오지 못했습니다.');
                }
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchWidgetData();

        return () => {
            isMounted = false;
        };
    }, [currentUser?.uid, isOverallScope, monthRange.end, monthRange.start]);

    const renderWidget = (widget: DashboardWidgetDefinition) => {
        if (loading) return <SkeletonCard key={widget.key} kind={widget.kind} />;

        switch (widget.key) {
            case 'recent-total-manday':
                return <SummaryCard key={widget.key} widget={widget} data={data.recentTotalManDay} />;
            case 'registered-workers':
                return <SummaryCard key={widget.key} widget={widget} data={data.registeredWorkers} />;
            case 'registered-sites':
                return <SummaryCard key={widget.key} widget={widget} data={data.registeredSites} />;
            case 'site-month-manday':
                return <RankingCard key={widget.key} widget={widget} rows={data.siteMonthRows} />;
            case 'worker-month-manday':
                return <RankingCard key={widget.key} widget={widget} rows={data.workerMonthRows} />;
            case 'team-month-manday':
                return <SummaryCard key={widget.key} widget={widget} data={data.teamMonthManDay} />;
            default:
                return null;
        }
    };

    return (
        <section className="mb-8">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <div className="flex items-center gap-2">
                        <h2 className="text-xl font-extrabold text-slate-900">내 대시보드 위젯</h2>
                        {loading && <FontAwesomeIcon icon={faSpinner} spin className="text-sm text-slate-400" />}
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                        {monthRange.label} · {teamLabel || (isOverallScope ? '전체' : '소속 팀')} 기준 공수와 운영 현황을 표시합니다.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => setIsSettingsOpen(true)}
                    disabled={widgetSettings.loading}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <FontAwesomeIcon icon={faCog} />
                    위젯 설정
                </button>
            </div>

            {error && (
                <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
                    <FontAwesomeIcon icon={faExclamationTriangle} className="mr-2" />
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {widgetSettings.widgets.map(renderWidget)}
            </div>

            <DashboardWidgetSettingsModal
                isOpen={isSettingsOpen}
                modeLabel={modeConfig.shortLabel}
                widgets={widgetSettings.availableWidgets}
                selectedKeys={widgetSettings.selectedKeys}
                defaultSelectedKeys={widgetSettings.defaultSelectedKeys}
                hasPersonalSelection={widgetSettings.hasPersonalSelection}
                saving={widgetSettings.saving}
                maxWidgets={widgetSettings.maxWidgets}
                onClose={() => setIsSettingsOpen(false)}
                onSave={widgetSettings.saveSelection}
                onReset={widgetSettings.resetSelection}
            />
        </section>
    );
};
