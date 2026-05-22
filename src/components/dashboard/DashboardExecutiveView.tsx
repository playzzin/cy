import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { manpowerService } from '../../services/manpowerService';
import { siteService } from '../../services/siteService';
import { teamService } from '../../services/teamService';
import { dailyReportService } from '../../services/dailyReportService';
import { companyService } from '../../services/companyService';
import { taskService } from '../../services/taskService';
import { Task, STATUS_CONFIG } from '../../types/task';
import { DASHBOARD_MODES, DashboardModeConfig } from './roleDashboardConfig';
import { QuickMenuSettingsModal } from './QuickMenuSettingsModal';
import { useQuickMenuActionSettings } from './useQuickMenuActions';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faUsers, faBuilding, faClipboardList, faHardHat,
    faArrowRight, faChartLine, faSpinner, faRightLeft,
    faListCheck, faCog
} from '@fortawesome/free-solid-svg-icons';

interface DashboardExecutiveViewProps {
    modeConfig?: DashboardModeConfig;
}

const formatManDay = (value: number) =>
    Number(value || 0).toLocaleString('ko-KR', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
    });

export const DashboardExecutiveView: React.FC<DashboardExecutiveViewProps> = ({ modeConfig = DASHBOARD_MODES[0] }) => {
    const { currentUser } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        workers: { total: 0, active: 0 },
        sites: { total: 0, active: 0 },
        teams: { total: 0 },
        reports: { today: 0, thisMonth: 0, todayManDay: 0, thisMonthManDay: 0 },
        support: { inbound: 0, outbound: 0, total: 0 },
        recentReports: [] as any[],
        recentTasks: [] as Task[]
    });

    useEffect(() => {
        let isMounted = true;

        const initDashboard = async () => {
            if (!currentUser?.uid) {
                if (isMounted) setLoading(false);
                return;
            }

            try {
                // Fetch Stats Data
                const [workersData, sitesData, teamsData, reportsData, companiesData] = await Promise.all([
                    manpowerService.getWorkersPaginated(1000),
                    siteService.getSites(),
                    teamService.getTeams(),
                    dailyReportService.getAllReports(),
                    companyService.getCompanies()
                ]);

                if (!isMounted) return;

                const now = new Date();
                const todayStr = now.toISOString().split('T')[0];
                const thisMonthStr = todayStr.substring(0, 7);

                // Identify My Company (Default to '청연' or first one)
                const myCompany = companiesData.find(c => c.name.includes('청연')) || companiesData[0];
                const myCompanyId = myCompany?.id;

                // Calculate Support Man-days for This Month
                let inboundManDay = 0;
                let outboundManDay = 0;

                if (myCompanyId) {
                    const thisMonthReports = reportsData.filter(r => r.date.startsWith(thisMonthStr));
                    const siteMap = new Map(sitesData.map(s => [s.id, s]));
                    const teamMap = new Map(teamsData.map(t => [t.id, t]));

                    thisMonthReports.forEach(report => {
                        const site = siteMap.get(report.siteId);
                        const team = teamMap.get(report.teamId);

                        if (site && team) {
                            const manDay = Number(report.totalManDay) || 0;

                            // Inbound: My Site, Other Team (Received Support)
                            if (site.companyId === myCompanyId && team.companyId !== myCompanyId) {
                                inboundManDay += manDay;
                            }
                            // Outbound: Other Site, My Team (Sent Support)
                            if (site.companyId !== myCompanyId && team.companyId === myCompanyId) {
                                outboundManDay += manDay;
                            }
                        }
                    });
                }

                setStats(prev => ({
                    ...prev,
                    workers: {
                        total: workersData.workers.length,
                        active: workersData.workers.filter(w => w.status === '재직').length
                    },
                    sites: {
                        total: sitesData.length,
                        active: sitesData.filter(s => s.status === 'active').length
                    },
                    teams: {
                        total: teamsData.length
                    },
                    reports: {
                        today: reportsData.filter(r => r.date === todayStr).length,
                        thisMonth: reportsData.filter(r => r.date.startsWith(thisMonthStr)).length,
                        todayManDay: reportsData.filter(r => r.date === todayStr).reduce((sum, r) => sum + (Number(r.totalManDay) || 0), 0),
                        thisMonthManDay: reportsData.filter(r => r.date.startsWith(thisMonthStr)).reduce((sum, r) => sum + (Number(r.totalManDay) || 0), 0)
                    },
                    support: {
                        inbound: inboundManDay,
                        outbound: outboundManDay,
                        total: inboundManDay + outboundManDay
                    },
                    recentReports: reportsData
                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                        .slice(0, 5)
                }));

            } catch (error) {
                console.error("Dashboard data load failed", error);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        initDashboard();

        // Subscribe to Tasks (Real-time)
        const unsubscribeTasks = taskService.subscribe((tasksData) => {
            if (!isMounted) return;
            setStats(prev => ({
                ...prev,
                recentTasks: tasksData
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                    .slice(0, 5)
            }));
        });

        return () => {
            isMounted = false;
            unsubscribeTasks();
        };
    }, [currentUser]);

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <div className="text-center">
                    <FontAwesomeIcon icon={faSpinner} spin className="text-4xl text-brand-600 mb-4" />
                    <p className="text-slate-500 font-medium">시스템 데이터를 불러오는 중입니다...</p>
                </div>
            </div>
        );
    }

    return (
        <DashboardExecutiveViewContent stats={stats} modeConfig={modeConfig} />
    );
};

// Internal component to handle the displaying using the fetched stats
const DashboardExecutiveViewContent: React.FC<{ stats: any; modeConfig: DashboardModeConfig }> = ({ stats, modeConfig }) => {
    const navigate = useNavigate();
    const quickMenu = useQuickMenuActionSettings(modeConfig);
    const quickActions = quickMenu.actions;
    const [isQuickMenuSettingsOpen, setIsQuickMenuSettingsOpen] = useState(false);

    const handleQuickActionClick = (path: string, openInNewTab?: boolean) => {
        if (openInNewTab) {
            window.open(path, '_blank', 'noopener,noreferrer');
            return;
        }
        navigate(path);
    };

    return (
        <div>
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
                {/* Workers Card */}
                <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-center mb-4">
                        <div className="p-3 bg-blue-50 rounded-lg">
                            <FontAwesomeIcon icon={faUsers} className="text-2xl text-blue-600" />
                        </div>
                        <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-full">실시간</span>
                    </div>
                    <h3 className="text-slate-500 text-sm font-medium mb-1">총 등록 작업자</h3>
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-slate-800">{stats.workers.total}</span>
                        <span className="text-sm text-slate-400">명</span>
                    </div>
                    <div className="mt-4 pt-4 border-t border-slate-50 flex justify-between text-sm">
                        <span className="text-slate-500">현재 재직</span>
                        <span className="font-medium text-slate-800">{stats.workers.active}명</span>
                    </div>
                </div>

                {/* Sites Card */}
                <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-center mb-4">
                        <div className="p-3 bg-green-50 rounded-lg">
                            <FontAwesomeIcon icon={faBuilding} className="text-2xl text-green-600" />
                        </div>
                        <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">진행중</span>
                    </div>
                    <h3 className="text-slate-500 text-sm font-medium mb-1">관리 현장</h3>
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-slate-800">{stats.sites.total}</span>
                        <span className="text-sm text-slate-400">개소</span>
                    </div>
                    <div className="mt-4 pt-4 border-t border-slate-50 flex justify-between text-sm">
                        <span className="text-slate-500">활성 현장</span>
                        <span className="font-medium text-slate-800">{stats.sites.active}개소</span>
                    </div>
                </div>

                {/* Teams Card - 운영팀 */}
                <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-center mb-4">
                        <div className="p-3 bg-purple-50 rounded-lg">
                            <FontAwesomeIcon icon={faHardHat} className="text-2xl text-purple-600" />
                        </div>
                        <span className="text-xs font-medium text-purple-600 bg-purple-50 px-2 py-1 rounded-full">Teams</span>
                    </div>
                    <h3 className="text-slate-500 text-sm font-medium mb-1">운영 팀</h3>
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-slate-800">{stats.teams.total}</span>
                        <span className="text-sm text-slate-400">팀</span>
                    </div>
                    <div className="mt-4 pt-4 border-t border-slate-50 flex justify-between text-sm">
                        <span className="text-slate-500">시스템 등록</span>
                        <span className="font-medium text-slate-800">완료</span>
                    </div>
                </div>

                {/* Reports Card - 오늘의 공수 */}
                <div
                    onClick={() => {
                        const todayStr = new Date().toISOString().split('T')[0];
                        navigate(`/reports/daily?tab=list-v2&date=${todayStr}`);
                    }}
                    className="bg-white rounded-xl shadow-sm p-6 border border-slate-200 hover:shadow-md transition-all cursor-pointer group hover:border-orange-200"
                >
                    <div className="flex justify-between items-center mb-4">
                        <div className="p-3 bg-orange-50 rounded-lg group-hover:bg-orange-100 transition-colors">
                            <FontAwesomeIcon icon={faClipboardList} className="text-2xl text-orange-600" />
                        </div>
                        <span className="text-xs font-medium text-orange-600 bg-orange-50 px-2 py-1 rounded-full group-hover:bg-orange-100">Today</span>
                    </div>
                    <h3 className="text-slate-500 text-sm font-medium mb-1 group-hover:text-orange-600 transition-colors">오늘 총공수</h3>
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-slate-800 group-hover:text-orange-600 transition-colors">{formatManDay(stats.reports.todayManDay)}</span>
                        <span className="text-sm text-slate-400">공</span>
                    </div>
                    <div className="mt-4 pt-4 border-t border-slate-50 flex justify-between text-sm">
                        <span className="text-slate-500">이번 달 누적</span>
                        <span className="font-medium text-slate-800">{formatManDay(stats.reports.thisMonthManDay)}공</span>
                    </div>
                </div>

                {/* Support Man-days Card */}
                <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-center mb-4">
                        <div className="p-3 bg-teal-50 rounded-lg">
                            <FontAwesomeIcon icon={faRightLeft} className="text-2xl text-teal-600" />
                        </div>
                        <span className="text-xs font-medium text-teal-600 bg-teal-50 px-2 py-1 rounded-full">이번 달</span>
                    </div>
                    <h3 className="text-slate-500 text-sm font-medium mb-1">지원 현황</h3>
                    <div className="flex flex-col gap-2 mt-2">
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-slate-500">지원 공수</span>
                            <span className="font-bold text-slate-800 text-lg">{(stats.support.inbound + stats.support.outbound).toFixed(1)}공</span>
                        </div>
                        <div className="w-full h-px bg-slate-100 my-1"></div>
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-slate-400">지원온거</span>
                            <span className="font-bold text-teal-600">+{stats.support.inbound.toFixed(1)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-slate-400">지원간거</span>
                            <span className="font-bold text-orange-600">-{stats.support.outbound.toFixed(1)}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Quick Actions */}
                <div className="lg:col-span-2 space-y-8">
                    <section>
                        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <FontAwesomeIcon icon={faChartLine} className="text-brand-600" />
                                {modeConfig.shortLabel} 빠른 실행
                            </h2>
                            <button
                                type="button"
                                onClick={() => setIsQuickMenuSettingsOpen(true)}
                                disabled={quickMenu.loading}
                                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <FontAwesomeIcon icon={faCog} />
                                설정
                            </button>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {(() => {
                                const colorMap: Record<string, { bg: string, text: string, hover: string, iconBg: string }> = {
                                    brand: { bg: 'bg-brand-50', text: 'text-brand-600', hover: 'hover:border-brand-500', iconBg: 'group-hover:bg-brand-100' },
                                    blue: { bg: 'bg-blue-50', text: 'text-blue-600', hover: 'hover:border-blue-500', iconBg: 'group-hover:bg-blue-100' },
                                    green: { bg: 'bg-green-50', text: 'text-green-600', hover: 'hover:border-green-500', iconBg: 'group-hover:bg-green-100' },
                                    slate: { bg: 'bg-slate-50', text: 'text-slate-600', hover: 'hover:border-slate-500', iconBg: 'group-hover:bg-slate-100' },
                                    indigo: { bg: 'bg-indigo-50', text: 'text-indigo-600', hover: 'hover:border-indigo-500', iconBg: 'group-hover:bg-indigo-100' },
                                    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', hover: 'hover:border-emerald-500', iconBg: 'group-hover:bg-emerald-100' },
                                    sky: { bg: 'bg-sky-50', text: 'text-sky-600', hover: 'hover:border-sky-500', iconBg: 'group-hover:bg-sky-100' },
                                    rose: { bg: 'bg-rose-50', text: 'text-rose-600', hover: 'hover:border-rose-500', iconBg: 'group-hover:bg-rose-100' },
                                    purple: { bg: 'bg-purple-50', text: 'text-purple-600', hover: 'hover:border-purple-500', iconBg: 'group-hover:bg-purple-100' },
                                    violet: { bg: 'bg-violet-50', text: 'text-violet-600', hover: 'hover:border-violet-500', iconBg: 'group-hover:bg-violet-100' },
                                    orange: { bg: 'bg-orange-50', text: 'text-orange-600', hover: 'hover:border-orange-500', iconBg: 'group-hover:bg-orange-100' },
                                    amber: { bg: 'bg-amber-50', text: 'text-amber-600', hover: 'hover:border-amber-500', iconBg: 'group-hover:bg-amber-100' },
                                    cyan: { bg: 'bg-cyan-50', text: 'text-cyan-600', hover: 'hover:border-cyan-500', iconBg: 'group-hover:bg-cyan-100' },
                                    teal: { bg: 'bg-teal-50', text: 'text-teal-600', hover: 'hover:border-teal-500', iconBg: 'group-hover:bg-teal-100' },
                                    gray: { bg: 'bg-gray-100', text: 'text-gray-600', hover: 'hover:border-gray-500', iconBg: 'group-hover:bg-gray-200' }
                                };

                                if (quickActions.length === 0) {
                                    return (
                                        <div className="col-span-full rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
                                            등록된 빠른 실행 메뉴가 없습니다. 설정에서 메뉴를 선택하세요.
                                        </div>
                                    );
                                }

                                return quickActions
                                    .map((action) => {
                                        const theme = colorMap[action.color] || colorMap.slate;
                                        return (
                                            <button
                                                key={action.key}
                                                onClick={() => handleQuickActionClick(action.path, action.openInNewTab)}
                                                className={`p-6 bg-white rounded-xl border border-slate-200 ${theme.hover} hover:shadow-md transition-all text-left group`}
                                            >
                                                <div className={`w-10 h-10 ${theme.bg} rounded-lg flex items-center justify-center mb-3 ${theme.iconBg} transition-colors`}>
                                                    <FontAwesomeIcon icon={action.icon} className={`${theme.text} text-lg`} />
                                                </div>
                                                <h3 className="font-semibold text-slate-800 mb-1">{action.label}</h3>
                                                <p className="text-xs text-slate-500">{action.desc}</p>
                                            </button>
                                        );
                                    });
                            })()}
                        </div>
                    </section>

                    {/* Recent Tasks (Work Requests) */}
                    <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                            <h2 className="text-lg font-bold text-slate-800">최근 업무 요청</h2>
                            <button
                                onClick={() => navigate('/todo')}
                                className="text-sm text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1"
                            >
                                전체보기 <FontAwesomeIcon icon={faArrowRight} />
                            </button>
                        </div>
                        <div className="divide-y divide-slate-100">
                            {stats.recentTasks.length > 0 ? (
                                stats.recentTasks.map((task: Task, index: number) => {
                                    const statusInfo = STATUS_CONFIG[task.status] || STATUS_CONFIG['요청'];

                                    return (
                                        <div
                                            key={task.id || index}
                                            onClick={() => navigate('/todo')}
                                            className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between cursor-pointer"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
                                                    <FontAwesomeIcon icon={faListCheck} />
                                                </div>
                                                <div>
                                                    <h4 className="font-semibold text-slate-800 line-clamp-1">{task.title}</h4>
                                                    <p className="text-xs text-slate-500">{task.assignee} • {task.dueDate}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <span className={`inline-block px-2 py-1 ${statusInfo.color.split(' ').filter(c => !c.startsWith('border-')).join(' ')} text-[10px] rounded-md font-bold`}>
                                                    {statusInfo.label}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="p-8 text-center text-slate-500">
                                    등록된 업무 요청이 없습니다.
                                </div>
                            )}
                        </div>
                    </section>
                </div>

                {/* Side Panel */}
                <div className="space-y-6">
                    {/* System Status */}
                    <div className="bg-slate-800 rounded-xl p-6 text-white shadow-lg">
                        <h3 className="font-bold text-lg mb-4">시스템 상태</h3>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-slate-300 text-sm">서버 연결</span>
                                <span className="flex items-center gap-2 text-xs font-medium bg-green-500/20 text-green-400 px-2 py-1 rounded-full">
                                    <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                                    정상
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-slate-300 text-sm">데이터베이스</span>
                                <span className="flex items-center gap-2 text-xs font-medium bg-green-500/20 text-green-400 px-2 py-1 rounded-full">
                                    <span className="w-2 h-2 rounded-full bg-green-400"></span>
                                    연결됨
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-slate-300 text-sm">마지막 백업</span>
                                <span className="text-xs text-slate-400">오늘 03:00 AM</span>
                            </div>
                        </div>
                        <div className="mt-6 pt-6 border-t border-slate-700">
                            <button
                                onClick={() => navigate('/manual')}
                                className="w-full py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium transition-colors"
                            >
                                사용자 매뉴얼 확인
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <QuickMenuSettingsModal
                isOpen={isQuickMenuSettingsOpen}
                modeLabel={modeConfig.shortLabel}
                actions={quickMenu.availableActions}
                selectedKeys={quickMenu.selectedKeys}
                defaultSelectedKeys={quickMenu.defaultSelectedKeys}
                hasPersonalSelection={quickMenu.hasPersonalSelection}
                saving={quickMenu.saving}
                maxActions={quickMenu.maxActions}
                onClose={() => setIsQuickMenuSettingsOpen(false)}
                onSave={quickMenu.saveSelection}
                onReset={quickMenu.resetSelection}
            />
        </div>
    );
}
