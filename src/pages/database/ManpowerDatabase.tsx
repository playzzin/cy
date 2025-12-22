import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { manpowerService, Worker } from '../../services/manpowerService';
import { teamService, Team } from '../../services/teamService';
import { siteService, Site } from '../../services/siteService';
import { companyService, Company } from '../../services/companyService';
import { dailyReportService, DailyReport } from '../../services/dailyReportService';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faDatabase, faUsers, faBuilding, faHardHat, faCalendar, faChartBar,
    faExclamationTriangle, faUserSlash, faIdBadge, faCreditCard, faChevronDown, faChevronUp, faLink, faUserClock,
    faUserXmark, faStoreSlash
} from '@fortawesome/free-solid-svg-icons';

// Sub-components
import WorkerDatabase from './WorkerDatabase';
import TeamDatabase from './TeamDatabase';
import SiteDatabase from './SiteDatabase';
import CompanyDatabase from './CompanyDatabase';
import ConstructionCompanyDatabase from './ConstructionCompanyDatabase';

interface DatabaseStats {
    workers: {
        total: number;
        active: number;
        inactive: number;
        unassigned: number;
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
        contractor: number; // 시공팀
        partner: number;
        builder: number; // 건설사
    };
    reports: {
        total: number;
        thisMonth: number;
        today: number;
    };
}

interface IssueStats {
    unassignedWorkers: Worker[];
    noIdCardWorkers: Worker[];
    noAccountWorkers: Worker[];
    unassignedSites: Site[];
    unassignedBuilders: Company[];
    unassignedTeamLeaders: Worker[];
    isolatedWorkers: Worker[];
    duplicateWorkers: { list: Worker[], label: string }[]; // Groups of duplicates
    ghostWorkers: Worker[]; // Active but no work in 30 days
    retiredWorkers: Worker[];
    closedTeams: Team[];
}

function IntegratedDatabase() {
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'overview' | 'workers' | 'teams' | 'sites' | 'companies' | 'partner-companies' | 'construction-companies' | 'reports'>('overview');

    // Stats State
    const [stats, setStats] = useState<DatabaseStats>({
        workers: { total: 0, active: 0, inactive: 0, unassigned: 0 },
        teams: { total: 0, active: 0, inactive: 0 },
        sites: { total: 0, active: 0, completed: 0 },
        companies: { total: 0, contractor: 0, partner: 0, builder: 0 },
        reports: { total: 0, thisMonth: 0, today: 0 }
    });

    // Issue State
    const [issues, setIssues] = useState<IssueStats>({
        unassignedWorkers: [],
        noIdCardWorkers: [],
        noAccountWorkers: [],
        unassignedSites: [],
        unassignedBuilders: [],
        unassignedTeamLeaders: [],
        isolatedWorkers: [],
        duplicateWorkers: [],
        ghostWorkers: [],
        retiredWorkers: [],
        closedTeams: []
    });

    const [expandedIssue, setExpandedIssue] = useState<keyof IssueStats | null>(null);
    const [highlightedId, setHighlightedId] = useState<string | null>(null);

    useEffect(() => {
        loadStats();
    }, []);

    const loadStats = async () => {
        setLoading(true);
        try {
            // Calculate date range for Ghost Worker check (last 30 days)
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - 30);

            const startDateStr = startDate.toISOString().split('T')[0];
            const endDateStr = endDate.toISOString().split('T')[0];

            // Parallel Fetch: Replaced getAllReports with getDBStats
            const [workersData, teamsData, sitesData, companiesData, reportStats, recentReports] = await Promise.all([
                manpowerService.getWorkers(),
                teamService.getTeams(),
                siteService.getSites(),
                companyService.getCompanies(),
                dailyReportService.getDBStats(), // Optimized: Count only
                dailyReportService.getReportsByRange(startDateStr, endDateStr)
            ]);

            calculateStats(workersData, teamsData, sitesData, companiesData, reportStats);
            calculateIssues(workersData, teamsData, sitesData, companiesData, recentReports);
        } catch (error) {
            console.error('Failed to load stats:', error);
        } finally {
            setLoading(false);
        }
    };

    const calculateStats = (
        workers: Worker[],
        teams: Team[],
        sites: Site[],
        companies: Company[],
        reportStats: { total: number; thisMonth: number; today: number }
    ) => {
        setStats({
            workers: {
                total: workers.length,
                active: workers.filter(w => w.status === '재직').length,
                inactive: workers.filter(w => w.status === '퇴사' || w.status === '휴직').length,
                unassigned: workers.filter(w => !w.teamId).length
            },
            teams: {
                total: teams.length,
                active: teams.filter(t => t.status === 'active' || !t.status).length,
                inactive: teams.filter(t => t.status === 'waiting' || t.status === 'closed').length
            },
            sites: {
                total: sites.length,
                active: sites.filter(s => s.status === 'active').length,
                completed: sites.filter(s => s.status === 'completed').length
            },
            companies: {
                total: companies.length,
                contractor: companies.filter(c => c.type === '시공사').length,
                partner: companies.filter(c => c.type === '협력사').length,
                builder: companies.filter(c => c.type === '건설사').length
            },
            reports: reportStats // Use pre-calculated stats directly
        });
    };

    const calculateIssues = (workers: Worker[], teams: Team[], sites: Site[], companies: Company[], recentReports: DailyReport[]) => {
        const newIssues: IssueStats = {
            unassignedWorkers: [],
            noIdCardWorkers: [],
            noAccountWorkers: [],
            unassignedSites: [],
            unassignedBuilders: [],
            unassignedTeamLeaders: [],
            isolatedWorkers: [],
            duplicateWorkers: [],
            ghostWorkers: [],
            retiredWorkers: workers.filter(w => w.status === '퇴사'),
            closedTeams: teams.filter(t => t.status === 'closed' || t.status === 'waiting')
        };

        // Helper sets
        const activeTeamLeaderIds = new Set(teams.map(t => t.leaderId).filter(Boolean));
        const recentWorkerIds = new Set<string>();
        recentReports.forEach(r => {
            r.workers.forEach(w => {
                if (w.manDay > 0) recentWorkerIds.add(w.workerId);
            });
        });

        // Worker Checks
        workers.forEach(w => {
            // Unassigned (No Team)
            if (!w.teamId) newIssues.unassignedWorkers.push(w);

            // Missing Info
            if (!w.fileNameSaved) newIssues.noIdCardWorkers.push(w);
            if (!w.accountNumber) newIssues.noAccountWorkers.push(w);

            // Unassigned Team Leader
            if (w.role === '팀장' && !activeTeamLeaderIds.has(w.id || '')) {
                newIssues.unassignedTeamLeaders.push(w);
            }

            // Isolated
            if (!w.teamId && !w.siteId && !w.companyId) {
                newIssues.isolatedWorkers.push(w);
            }

            // Ghost Worker (Active but no work in 30 days)
            if (w.status === '재직' && !recentWorkerIds.has(w.id || '')) {
                newIssues.ghostWorkers.push(w);
            }
        });

        // Sites Checks
        newIssues.unassignedSites = sites.filter(s => !s.responsibleTeamId);

        // Company Checks (Builders without any assigned sites via Site.companyId)
        newIssues.unassignedBuilders = companies.filter(c => {
            if (c.type !== '건설사') return false;
            const hasSite = sites.some(s => s.companyId === c.id);
            return !hasSite;
        });

        // Duplicate Functionality
        const idMap = new Map<string, Worker[]>();
        const phoneMap = new Map<string, Worker[]>();

        workers.forEach(w => {
            if (w.idNumber) {
                const list = idMap.get(w.idNumber) || [];
                list.push(w);
                idMap.set(w.idNumber, list);
            }
            if (w.contact) {
                const list = phoneMap.get(w.contact) || [];
                list.push(w);
                phoneMap.set(w.contact, list);
            }
        });

        idMap.forEach((list, key) => {
            if (list.length > 1) newIssues.duplicateWorkers.push({ list, label: `주민번호 중복: ${key}` });
        });
        phoneMap.forEach((list, key) => {
            // Only add if not already added by ID number to avoid noise
            const isAlreadyAdded = newIssues.duplicateWorkers.some(d => d.label.includes(key));
            if (!isAlreadyAdded && list.length > 1) newIssues.duplicateWorkers.push({ list, label: `연락처 중복: ${key}` });
        });

        setIssues(newIssues);
    };

    const toggleIssue = (issueKey: keyof IssueStats) => {
        if (expandedIssue === issueKey) {
            setExpandedIssue(null);
        } else {
            setExpandedIssue(issueKey);
        }
    };

    const renderIssueCard = (
        key: keyof IssueStats,
        title: string,
        count: number,
        icon: any,
        colorClass: string,
        unit: string = '명'
    ) => {


        const isSelected = expandedIssue === key;

        return (
            <div
                onClick={() => toggleIssue(key)}
                className={`p-4 rounded-xl border cursor-pointer transition-all duration-200 relative overflow-hidden group
                    ${isSelected
                        ? 'bg-white border-slate-400 ring-2 ring-slate-200 shadow-md transform -translate-y-1'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
                    }
                `}
            >
                <div className={`absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity ${colorClass}`}>
                    <FontAwesomeIcon icon={icon} className="text-4xl" />
                </div>

                <div className="flex items-center gap-2 mb-2">
                    <div className={`p-1.5 rounded-lg text-xs ${colorClass.replace('text-', 'bg-').replace('600', '50').replace('500', '50')} ${colorClass}`}>
                        <FontAwesomeIcon icon={icon} />
                    </div>
                    <span className="text-slate-600 font-bold text-sm">{title}</span>
                </div>

                <div className="flex items-end gap-1 relative z-10">
                    <span className={`text-2xl font-bold ${colorClass}`}>{count}</span>
                    <span className="text-xs text-slate-400 mb-1">{unit}</span>
                </div>

                <div className="mt-2 flex justify-between items-center text-xs text-slate-400">
                    <span>상세보기</span>
                    <FontAwesomeIcon icon={isSelected ? faChevronUp : faChevronDown} />
                </div>
            </div>
        );
    };

    return (
        <div className="bg-slate-50 min-h-screen pb-20">
            <div className="bg-white border-b border-slate-200">
                <div className="p-6">
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-3">
                            <div className="bg-indigo-600 p-2 rounded-lg">
                                <FontAwesomeIcon icon={faDatabase} className="text-white text-xl" />
                            </div>
                            <h1 className="text-2xl font-bold text-slate-800">통합 데이터베이스</h1>
                        </div>
                    </div>

                    {/* Main Stats Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-4">
                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm cursor-pointer hover:border-indigo-300 transition-colors" onClick={() => setActiveTab('workers')}>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-slate-500 font-medium text-sm">총 작업자</span>
                                <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs">
                                    <FontAwesomeIcon icon={faHardHat} />
                                </div>
                            </div>
                            <div className="flex items-end gap-2">
                                <h3 className="text-2xl font-bold text-slate-800">{stats.workers.total}</h3>
                                <span className="text-xs text-slate-500 mb-1">명</span>
                            </div>
                            <div className="mt-2 text-xs text-slate-400 flex justify-between">
                                <span>재직 {stats.workers.active}</span>
                                <span>미배정 {stats.workers.unassigned}</span>
                            </div>
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm cursor-pointer hover:border-indigo-300 transition-colors" onClick={() => setActiveTab('teams')}>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-slate-500 font-medium text-sm">등록 팀</span>
                                <div className="p-1.5 bg-purple-50 text-purple-600 rounded-lg text-xs">
                                    <FontAwesomeIcon icon={faUsers} />
                                </div>
                            </div>
                            <div className="flex items-end gap-2">
                                <h3 className="text-2xl font-bold text-slate-800">{stats.teams.total}</h3>
                                <span className="text-xs text-slate-500 mb-1">팀</span>
                            </div>
                            <div className="mt-2 text-xs text-slate-400">
                                <span>협업 {stats.teams.active} · 대기/폐업 {stats.teams.inactive}</span>
                            </div>
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm cursor-pointer hover:border-indigo-300 transition-colors" onClick={() => setActiveTab('sites')}>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-slate-500 font-medium text-sm">현장 현황</span>
                                <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-xs">
                                    <FontAwesomeIcon icon={faBuilding} />
                                </div>
                            </div>
                            <div className="flex items-end gap-2">
                                <h3 className="text-2xl font-bold text-slate-800">{stats.sites.total}</h3>
                                <span className="text-xs text-slate-500 mb-1">곳</span>
                            </div>
                            <div className="mt-2 text-xs text-slate-400">
                                <span>진행중 {stats.sites.active} · 종료 {stats.sites.completed}</span>
                            </div>
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm cursor-pointer hover:border-indigo-300 transition-colors" onClick={() => setActiveTab('companies')}>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-slate-500 font-medium text-sm">거래처</span>
                                <div className="p-1.5 bg-orange-50 text-orange-600 rounded-lg text-xs">
                                    <FontAwesomeIcon icon={faBuilding} />
                                </div>
                            </div>
                            <div className="flex items-end gap-2">
                                <h3 className="text-2xl font-bold text-slate-800">{stats.companies.total}</h3>
                                <span className="text-xs text-slate-500 mb-1">개사</span>
                            </div>
                            <div className="mt-2 text-xs text-slate-400">
                                <span>시공사 {stats.companies.contractor} · 협력사 {stats.companies.partner} · 건설사 {stats.companies.builder}</span>
                            </div>
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-slate-500 font-medium text-sm">일일 보고서</span>
                                <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs">
                                    <FontAwesomeIcon icon={faCalendar} />
                                </div>
                            </div>
                            <div className="flex items-end gap-2">
                                <h3 className="text-2xl font-bold text-slate-800">{stats.reports.total}</h3>
                                <span className="text-xs text-slate-500 mb-1">건</span>
                            </div>
                            <div className="mt-2 text-xs text-slate-400">
                                <span>금일 {stats.reports.today} · 이번달 {stats.reports.thisMonth}</span>
                            </div>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b border-slate-200 mt-8 overflow-x-auto">
                        <button
                            onClick={() => setActiveTab('overview')}
                            className={`px-6 py-4 text-sm font-medium whitespace-nowrap transition-colors ${activeTab === 'overview' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                        >
                            데이터베이스 현황
                        </button>
                        <button
                            onClick={() => setActiveTab('workers')}
                            className={`px-6 py-4 text-sm font-medium whitespace-nowrap transition-colors ${activeTab === 'workers' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                        >
                            작업자 목록
                        </button>
                        <button
                            onClick={() => setActiveTab('teams')}
                            className={`px-6 py-4 text-sm font-medium whitespace-nowrap transition-colors ${activeTab === 'teams' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                        >
                            팀 목록
                        </button>
                        <button
                            onClick={() => setActiveTab('sites')}
                            className={`px-6 py-4 text-sm font-medium whitespace-nowrap transition-colors ${activeTab === 'sites' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                        >
                            현장 목록
                        </button>
                        <button
                            onClick={() => setActiveTab('companies')}
                            className={`px-6 py-4 text-sm font-medium whitespace-nowrap transition-colors ${activeTab === 'companies' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                        >
                            회사 목록
                        </button>
                        <button
                            onClick={() => setActiveTab('partner-companies')}
                            className={`px-6 py-4 text-sm font-medium whitespace-nowrap transition-colors ${activeTab === 'partner-companies' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                        >
                            협력사 관리
                        </button>
                        <button
                            onClick={() => setActiveTab('construction-companies')}
                            className={`px-6 py-4 text-sm font-medium whitespace-nowrap transition-colors ${activeTab === 'construction-companies' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                        >
                            건설사 관리
                        </button>
                    </div>
                </div>

                <div className="p-6">
                    {activeTab === 'overview' && (
                        <div className="space-y-6">
                            {/* Data Integrity Board */}
                            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200">
                                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                                    <FontAwesomeIcon icon={faExclamationTriangle} className="text-amber-500" />
                                    데이터 무결성 현황 (Data Integrity)
                                </h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
                                    {renderIssueCard('unassignedWorkers', '미배정 작업자', issues.unassignedWorkers.length, faUserSlash, 'text-rose-500')}
                                    {renderIssueCard('noIdCardWorkers', '신분증 미등록', issues.noIdCardWorkers.length, faIdBadge, 'text-orange-500')}
                                    {renderIssueCard('noAccountWorkers', '계좌 미등록', issues.noAccountWorkers.length, faCreditCard, 'text-amber-600')}
                                    {renderIssueCard('unassignedSites', '미배정 현장', issues.unassignedSites.length, faBuilding, 'text-rose-500', '곳')}
                                    {renderIssueCard('unassignedBuilders', '미배정 건설사', issues.unassignedBuilders.length, faBuilding, 'text-orange-500', '개')}
                                    {renderIssueCard('unassignedTeamLeaders', '미배정 팀장', issues.unassignedTeamLeaders.length, faUserSlash, 'text-rose-600')}
                                    {renderIssueCard('isolatedWorkers', '고립된 작업자', issues.isolatedWorkers.length, faLink, 'text-slate-600')}
                                    {renderIssueCard('duplicateWorkers', '중복 데이터', issues.duplicateWorkers.length, faUsers, 'text-purple-600', '건')}
                                    {renderIssueCard('ghostWorkers', '유령 작업자', issues.ghostWorkers.length, faUserClock, 'text-slate-500')}
                                    {renderIssueCard('retiredWorkers', '퇴사자', issues.retiredWorkers.length, faUserXmark, 'text-slate-500')}
                                    {renderIssueCard('closedTeams', '폐업/대기 팀', issues.closedTeams.length, faStoreSlash, 'text-slate-500', '팀')}
                                </div>

                                {/* Accordion Detail View */}
                                {expandedIssue && (
                                    <div className="mt-4 bg-white rounded-xl border border-slate-200 shadow-sm animate-fade-in-down">
                                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-xl">
                                            <h4 className="font-bold text-slate-700">
                                                {expandedIssue === 'unassignedWorkers' && '미배정 작업자 목록 (팀 정보 없음)'}
                                                {expandedIssue === 'noIdCardWorkers' && '신분증 미등록 작업자 목록'}
                                                {expandedIssue === 'noAccountWorkers' && '계좌번호 누락 작업자 목록'}
                                                {expandedIssue === 'unassignedSites' && '담당 팀이 없는 현장 목록'}
                                                {expandedIssue === 'unassignedBuilders' && '담당 현장이 없는 건설사 목록'}
                                                {expandedIssue === 'unassignedTeamLeaders' && '직책이 팀장이지만 팀을 맡고 있지 않은 인원'}
                                                {expandedIssue === 'isolatedWorkers' && '팀, 현장, 회사 어디에도 소속되지 않은 작업자'}
                                                {expandedIssue === 'duplicateWorkers' && '중복 의심 데이터 (주민번호/연락처)'}
                                                {expandedIssue === 'ghostWorkers' && '최근 30일간 작업 기록이 없는 재직자 (유령 작업자)'}
                                                {expandedIssue === 'retiredWorkers' && '퇴사자 목록 (히스토리)'}
                                                {expandedIssue === 'closedTeams' && '폐업 또는 대기 상태인 팀 목록'}
                                            </h4>
                                            <button onClick={() => setExpandedIssue(null)} className="text-slate-400 hover:text-slate-600">
                                                닫기
                                            </button>
                                        </div>
                                        <div className="p-4 max-h-96 overflow-y-auto">
                                            {/* Worker Lists */}
                                            {['unassignedWorkers', 'noIdCardWorkers', 'noAccountWorkers', 'unassignedTeamLeaders', 'isolatedWorkers', 'ghostWorkers', 'retiredWorkers'].includes(expandedIssue) && (
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                                    {(issues[expandedIssue as keyof IssueStats] as Worker[])?.map((worker) => (
                                                        <div key={worker.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                                                            <div>
                                                                <div className="font-bold text-slate-800">{worker.name}</div>
                                                                <div className="text-xs text-slate-500">{worker.idNumber} / {worker.role}</div>
                                                            </div>
                                                            <button
                                                                onClick={() => {
                                                                    setActiveTab('workers');
                                                                    setHighlightedId(worker.id || null);
                                                                }}
                                                                className="text-xs text-indigo-600 hover:underline"
                                                            >
                                                                관리
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Site List */}
                                            {expandedIssue === 'unassignedSites' && (
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                                    {(issues.unassignedSites).map((site) => (
                                                        <div key={site.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                                                            <div>
                                                                <div className="font-bold text-slate-800">{site.name}</div>
                                                                <div className="text-xs text-slate-500">{site.code}</div>
                                                            </div>
                                                            <button onClick={() => { setActiveTab('sites'); setHighlightedId(site.id || null); }} className="text-xs text-indigo-600 hover:underline">관리</button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Company List */}
                                            {expandedIssue === 'unassignedBuilders' && (
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                                    {(issues.unassignedBuilders).map((comp) => (
                                                        <div key={comp.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                                                            <div>
                                                                <div className="font-bold text-slate-800">{comp.name}</div>
                                                                <div className="text-xs text-slate-500">{comp.ceoName}</div>
                                                            </div>
                                                            <button onClick={() => { setActiveTab('construction-companies'); setHighlightedId(comp.id || null); }} className="text-xs text-indigo-600 hover:underline">관리</button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Closed Teams List */}
                                            {expandedIssue === 'closedTeams' && (
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                                    {(issues.closedTeams).map((team) => (
                                                        <div key={team.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                                                            <div>
                                                                <div className="font-bold text-slate-800">{team.name}</div>
                                                                <div className="text-xs text-slate-500">{team.leaderName} / {team.status === 'closed' ? '폐업' : '대기'}</div>
                                                            </div>
                                                            <button onClick={() => { setActiveTab('teams'); setHighlightedId(team.id || null); }} className="text-xs text-indigo-600 hover:underline">관리</button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Duplicate List */}
                                            {expandedIssue === 'duplicateWorkers' && (
                                                <div className="space-y-3">
                                                    {issues.duplicateWorkers.map((group, idx) => (
                                                        <div key={idx} className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                                                            <div className="text-sm font-bold text-rose-600 mb-2">{group.label} ({group.list.length}명)</div>
                                                            <div className="flex flex-wrap gap-2">
                                                                {group.list.map(w => (
                                                                    <div key={w.id} className="bg-white px-3 py-1.5 rounded border border-slate-300 text-sm">
                                                                        {w.name} <span className="text-slate-400 text-xs">({w.status})</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'workers' && (
                        <WorkerDatabase hideHeader={true} highlightedId={highlightedId} />
                    )}
                    {activeTab === 'teams' && (
                        <TeamDatabase hideHeader={true} highlightedId={highlightedId} />
                    )}
                    {activeTab === 'sites' && (
                        <SiteDatabase hideHeader={true} highlightedId={highlightedId} />
                    )}
                    {activeTab === 'companies' && (
                        <CompanyDatabase
                            hideHeader={true}
                            highlightedId={highlightedId}
                            excludeTypes={['협력사', '건설사']}
                            entityLabel="회사"
                            defaultType="시공사"
                        />
                    )}
                    {activeTab === 'partner-companies' && (
                        <CompanyDatabase
                            hideHeader={true}
                            highlightedId={highlightedId}
                            includeTypes={['협력사']}
                            entityLabel="협력사"
                            defaultType="협력사"
                        />
                    )}
                    {activeTab === 'construction-companies' && (
                        <ConstructionCompanyDatabase hideHeader={true} highlightedId={highlightedId} />
                    )}
                </div>
            </div>
        </div>
    );
}

export default IntegratedDatabase;
