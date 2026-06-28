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
import { DashboardModeConfig } from './roleDashboardConfig';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faUsers, faBuilding, faClipboardList, faHardHat,
    faArrowRight, faSpinner, faRightLeft,
    faListCheck
} from '@fortawesome/free-solid-svg-icons';

interface DashboardExecutiveViewProps {
    modeConfig?: DashboardModeConfig;
}

const formatManDay = (value: number) =>
    Number(value || 0).toLocaleString('ko-KR', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
    });

export const DashboardExecutiveView: React.FC<DashboardExecutiveViewProps> = () => {
    const { currentUser } = useAuth();
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
        <DashboardExecutiveViewContent stats={stats} />
    );
};

// Internal component to handle the displaying using the fetched stats
const DashboardExecutiveViewContent: React.FC<{ stats: any }> = ({ stats }) => {
    const navigate = useNavigate();

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
                <div className="lg:col-span-2 space-y-8">
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

        </div>
    );
}
