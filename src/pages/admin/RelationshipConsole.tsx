import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faProjectDiagram, faUser, faBuilding, faSync, faUsers, faMapMarkerAlt,
    faUserGroup, faIndustry, faSearch, faFilter, faExclamationTriangle,
    faCheckCircle, faChartLine, faNetworkWired, faInfoCircle, faTimes,
    faSave, faUndo, faExpand, faCompress
} from '@fortawesome/free-solid-svg-icons';
import { manpowerService, Worker } from '../../services/manpowerService';
import { teamService, Team } from '../../services/teamService';
import { siteService, Site } from '../../services/siteService';
import { companyService, Company } from '../../services/companyService';
import { workerSiteAssignmentService, WorkerSiteAssignment } from '../../services/workerSiteAssignmentService';
import Swal from 'sweetalert2';

type ActiveView = 'worker' | 'team' | 'site' | 'company';
type FilterPreset = 'all' | 'incomplete' | 'orphaned' | 'active';

interface DashboardMetrics {
    totalWorkers: number;
    totalTeams: number;
    totalSites: number;
    totalCompanies: number;
    incompleteRelationships: number;
    orphanedRecords: number;
    healthScore: number;
}

const RelationshipConsolePage: React.FC = () => {
    const [activeView, setActiveView] = useState<ActiveView>('worker');
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterPreset, setFilterPreset] = useState<FilterPreset>('all');
    const [showGraphView, setShowGraphView] = useState(false);

    const [workers, setWorkers] = useState<Worker[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [sites, setSites] = useState<Site[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [assignments, setAssignments] = useState<WorkerSiteAssignment[]>([]);

    const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
    const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
    const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
    const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [workerData, teamData, siteData, companyData, assignmentData] = await Promise.all([
                manpowerService.getWorkers(),
                teamService.getTeams(),
                siteService.getSites(),
                companyService.getCompanies(),
                workerSiteAssignmentService.getAllAssignments()
            ]);
            setWorkers(workerData);
            setTeams(teamData);
            setSites(siteData);
            setCompanies(companyData);
            setAssignments(assignmentData);
        } catch (error) {
            console.error('Failed to load relationship data', error);
        } finally {
            setLoading(false);
        }
    };

    const openWorkerView = (workerId?: string | null) => {
        if (!workerId) return;
        setSelectedWorkerId(workerId);
        setActiveView('worker');
    };

    const openTeamView = (teamId?: string | null) => {
        if (!teamId) return;
        setSelectedTeamId(teamId);
        setActiveView('team');
    };

    const openSiteView = (siteId?: string | null) => {
        if (!siteId) return;
        setSelectedSiteId(siteId);
        setActiveView('site');
    };

    const openCompanyView = (companyId?: string | null) => {
        if (!companyId) return;
        setSelectedCompanyId(companyId);
        setActiveView('company');
    };

    const selectedWorker = useMemo(
        () => workers.find(w => w.id === selectedWorkerId) || null,
        [workers, selectedWorkerId]
    );

    const selectedTeam = useMemo(
        () => teams.find(t => t.id === selectedTeamId) || null,
        [teams, selectedTeamId]
    );

    const selectedSite = useMemo(
        () => sites.find(s => s.id === selectedSiteId) || null,
        [sites, selectedSiteId]
    );

    const selectedCompany = useMemo(
        () => companies.find(c => c.id === selectedCompanyId) || null,
        [companies, selectedCompanyId]
    );

    const handleWorkerTeamChange = async (worker: Worker, newTeamId: string) => {
        if (!worker.id) return;
        const team = teams.find(t => t.id === newTeamId) || null;
        try {
            await manpowerService.updateWorker(worker.id, {
                teamId: newTeamId,
                teamName: team?.name || '',
                companyId: team?.companyId || '',
                companyName: companies.find(c => c.id === team?.companyId)?.name || ''
            });
            setWorkers(prev => prev.map(w =>
                w.id === worker.id
                    ? {
                        ...w,
                        teamId: newTeamId,
                        teamName: team?.name || '',
                        companyId: team?.companyId || '',
                        companyName: companies.find(c => c.id === team?.companyId)?.name || ''
                    }
                    : w
            ));

            Swal.fire({
                icon: 'success',
                title: '팀 배정 성공',
                text: `${worker.name}님이 ${team?.name || '미배정'}팀에 배정되었습니다.`,
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000,
                timerProgressBar: true
            });
        } catch (error) {
            console.error('Failed to update worker team', error);
            Swal.fire({
                icon: 'error',
                title: '팀 배정 실패',
                text: '작업자 팀 배정 중 오류가 발생했습니다.',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000
            });
        }
    };

    const handleSiteCompanyChange = async (site: Site, newCompanyId: string) => {
        if (!site.id) return;
        const company = companies.find(c => c.id === newCompanyId) || null;
        try {
            await siteService.updateSite(site.id, {
                companyId: newCompanyId,
                companyName: company?.name || ''
            });
            setSites(prev => prev.map(s =>
                s.id === site.id
                    ? { ...s, companyId: newCompanyId, companyName: company?.name || '' }
                    : s
            ));

            Swal.fire({
                icon: 'success',
                title: '회사 변경 성공',
                text: `${site.name} 현장이 ${company?.name || '미지정'}에 배정되었습니다.`,
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000,
                timerProgressBar: true
            });
        } catch (error) {
            console.error('Failed to update site company', error);
            Swal.fire({
                icon: 'error',
                title: '회사 변경 실패',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000
            });
        }
    };

    const handleSiteTeamChange = async (site: Site, newTeamId: string) => {
        if (!site.id) return;
        const team = teams.find(t => t.id === newTeamId) || null;
        try {
            await siteService.updateSite(site.id, {
                responsibleTeamId: newTeamId,
                responsibleTeamName: team?.name || ''
            });
            setSites(prev => prev.map(s =>
                s.id === site.id
                    ? { ...s, responsibleTeamId: newTeamId, responsibleTeamName: team?.name || '' }
                    : s
            ));

            Swal.fire({
                icon: 'success',
                title: '담당 팀 변경 성공',
                text: `${site.name} 현장의 담당 팀이 ${team?.name || '미지정'}으로 변경되었습니다.`,
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000,
                timerProgressBar: true
            });
        } catch (error) {
            console.error('Failed to update site team', error);
            Swal.fire({
                icon: 'error',
                title: '담당 팀 변경 실패',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000
            });
        }
    };

    const workerList = useMemo(
        () => workers.slice().sort((a, b) => a.name.localeCompare(b.name)),
        [workers]
    );

    const teamList = useMemo(
        () => teams.slice().sort((a, b) => a.name.localeCompare(b.name)),
        [teams]
    );

    const siteList = useMemo(
        () => sites.slice().sort((a, b) => a.name.localeCompare(b.name)),
        [sites]
    );

    const companyList = useMemo(
        () => companies.slice().sort((a, b) => a.name.localeCompare(b.name)),
        [companies]
    );

    // Dashboard Metrics Calculation
    const dashboardMetrics = useMemo((): DashboardMetrics => {
        const totalWorkers = workers.length;
        const totalTeams = teams.length;
        const totalSites = sites.length;
        const totalCompanies = companies.length;

        // Calculate incomplete relationships
        const incompleteWorkers = workers.filter(w => !w.teamId || !w.companyId).length;
        const incompleteTeams = teams.filter(t => !t.companyId).length;
        const incompleteSites = sites.filter(s => !s.companyId || !s.responsibleTeamId).length;
        const incompleteRelationships = incompleteWorkers + incompleteTeams + incompleteSites;

        // Calculate orphaned records (entities without valid parent relationships)
        const orphanedWorkers = workers.filter(w =>
            w.teamId && !teams.find(t => t.id === w.teamId)
        ).length;
        const orphanedTeams = teams.filter(t =>
            t.companyId && !companies.find(c => c.id === t.companyId)
        ).length;
        const orphanedSites = sites.filter(s =>
            (s.companyId && !companies.find(c => c.id === s.companyId)) ||
            (s.responsibleTeamId && !teams.find(t => t.id === s.responsibleTeamId))
        ).length;
        const orphanedRecords = orphanedWorkers + orphanedTeams + orphanedSites;

        // Calculate health score (0-100)
        const totalRequiredFields = (workers.length * 2) + (teams.length * 1) + (sites.length * 2);
        const completedFields = (workers.length * 2 - incompleteWorkers) +
            (teams.length - incompleteTeams) +
            (sites.length * 2 - incompleteSites);
        const healthScore = totalRequiredFields > 0 ? Math.round((completedFields / totalRequiredFields) * 100) : 100;

        return {
            totalWorkers,
            totalTeams,
            totalSites,
            totalCompanies,
            incompleteRelationships,
            orphanedRecords,
            healthScore
        };
    }, [workers, teams, sites, companies]);

    // Filter functions based on preset
    const filterEntities = useCallback((entities: any[], entityType: string) => {
        let filtered = entities;

        // Apply search filter
        if (searchTerm) {
            filtered = filtered.filter(entity =>
                entity.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                entity.companyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                entity.teamName?.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        // Apply preset filters
        switch (filterPreset) {
            case 'incomplete':
                if (entityType === 'worker') {
                    filtered = filtered.filter((w: Worker) => !w.teamId || !w.companyId);
                } else if (entityType === 'team') {
                    filtered = filtered.filter((t: Team) => !t.companyId);
                } else if (entityType === 'site') {
                    filtered = filtered.filter((s: Site) => !s.companyId || !s.responsibleTeamId);
                }
                break;
            case 'orphaned':
                if (entityType === 'worker') {
                    filtered = filtered.filter((w: Worker) =>
                        w.teamId && !teams.find(t => t.id === w.teamId)
                    );
                } else if (entityType === 'team') {
                    filtered = filtered.filter((t: Team) =>
                        t.companyId && !companies.find(c => c.id === t.companyId)
                    );
                } else if (entityType === 'site') {
                    filtered = filtered.filter((s: Site) =>
                        (s.companyId && !companies.find(c => c.id === s.companyId)) ||
                        (s.responsibleTeamId && !teams.find(t => t.id === s.responsibleTeamId))
                    );
                }
                break;
            case 'active':
                if (entityType === 'team') {
                    filtered = filtered.filter((t: Team) => t.status === 'active');
                } else if (entityType === 'site') {
                    filtered = filtered.filter((s: Site) => s.status === 'active');
                }
                break;
        }

        return filtered;
    }, [searchTerm, filterPreset, teams, companies]);

    // Get health status for an entity
    const getEntityHealthStatus = useCallback((entity: any, entityType: string) => {
        if (entityType === 'worker') {
            const worker = entity as Worker;
            if (!worker.teamId || !worker.companyId) return 'error';
            if (worker.teamId && !teams.find(t => t.id === worker.teamId)) return 'warning';
            return 'healthy';
        } else if (entityType === 'team') {
            const team = entity as Team;
            if (!team.companyId) return 'error';
            if (team.companyId && !companies.find(c => c.id === team.companyId)) return 'warning';
            return 'healthy';
        } else if (entityType === 'site') {
            const site = entity as Site;
            if (!site.companyId || !site.responsibleTeamId) return 'error';
            if ((site.companyId && !companies.find(c => c.id === site.companyId)) ||
                (site.responsibleTeamId && !teams.find(t => t.id === site.responsibleTeamId))) {
                return 'warning';
            }
            return 'healthy';
        }
        return 'unknown';
    }, [teams, companies]);

    // Get health color and icon
    const getHealthIndicator = useCallback((status: string) => {
        switch (status) {
            case 'healthy':
                return { color: 'text-green-500', bg: 'bg-green-50', icon: faCheckCircle };
            case 'warning':
                return { color: 'text-yellow-500', bg: 'bg-yellow-50', icon: faExclamationTriangle };
            case 'error':
                return { color: 'text-red-500', bg: 'bg-red-50', icon: faExclamationTriangle };
            default:
                return { color: 'text-gray-400', bg: 'bg-gray-50', icon: faInfoCircle };
        }
    }, []);

    return (
        <div className="p-6 max-w-[1800px] mx-auto h-screen flex flex-col bg-gradient-to-br from-slate-50 to-white">
            {/* Header with Title and Actions */}
            <div className="flex justify-between items-center mb-6 flex-shrink-0">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
                        <FontAwesomeIcon icon={faProjectDiagram} className="text-indigo-600" />
                        <span>관계 관리 콘솔</span>
                        <span className="text-sm font-normal text-slate-500">(Worker → Team → Site → Company)</span>
                    </h1>
                    <p className="text-slate-500 mt-2 text-sm">
                        상용화급 관계 관리: 시각적 분석, 데이터 무결성, 실시간 모니터링
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowGraphView(!showGraphView)}
                        className={`px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors ${showGraphView
                                ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                            }`}
                    >
                        <FontAwesomeIcon icon={showGraphView ? faCompress : faExpand} />
                        {showGraphView ? '리스트 뷰' : '관계 그래프'}
                    </button>
                    <button
                        onClick={loadData}
                        className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200 bg-white"
                        title="새로고침"
                    >
                        <FontAwesomeIcon icon={faSync} spin={loading} />
                    </button>
                </div>
            </div>

            {/* Dashboard Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6 flex-shrink-0">
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <FontAwesomeIcon icon={faUsers} className="text-indigo-500" />
                        <span className="text-xs text-slate-500">작업자</span>
                    </div>
                    <div className="text-2xl font-bold text-slate-800">{dashboardMetrics.totalWorkers}</div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <FontAwesomeIcon icon={faUserGroup} className="text-sky-500" />
                        <span className="text-xs text-slate-500">팀</span>
                    </div>
                    <div className="text-2xl font-bold text-slate-800">{dashboardMetrics.totalTeams}</div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <FontAwesomeIcon icon={faMapMarkerAlt} className="text-emerald-500" />
                        <span className="text-xs text-slate-500">현장</span>
                    </div>
                    <div className="text-2xl font-bold text-slate-800">{dashboardMetrics.totalSites}</div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <FontAwesomeIcon icon={faIndustry} className="text-slate-600" />
                        <span className="text-xs text-slate-500">회사</span>
                    </div>
                    <div className="text-2xl font-bold text-slate-800">{dashboardMetrics.totalCompanies}</div>
                </div>

                <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl border border-red-200 p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <FontAwesomeIcon icon={faExclamationTriangle} className="text-red-500" />
                        <span className="text-xs text-red-600 font-medium">미완성</span>
                    </div>
                    <div className="text-2xl font-bold text-red-700">{dashboardMetrics.incompleteRelationships}</div>
                </div>

                <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl border border-yellow-200 p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <FontAwesomeIcon icon={faExclamationTriangle} className="text-yellow-600" />
                        <span className="text-xs text-yellow-600 font-medium">고립</span>
                    </div>
                    <div className="text-2xl font-bold text-yellow-700">{dashboardMetrics.orphanedRecords}</div>
                </div>

                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl border border-green-200 p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <FontAwesomeIcon icon={faChartLine} className="text-green-600" />
                        <span className="text-xs text-green-600 font-medium">건강도</span>
                    </div>
                    <div className="text-2xl font-bold text-green-700">{dashboardMetrics.healthScore}%</div>
                </div>
            </div>

            {/* Search and Filter Bar */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 flex-shrink-0 shadow-sm">
                <div className="flex flex-col lg:flex-row gap-4 items-center">
                    <div className="flex-1 relative">
                        <FontAwesomeIcon
                            icon={faSearch}
                            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400"
                        />
                        <input
                            type="text"
                            placeholder="이름, 회사, 팀으로 검색..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <FontAwesomeIcon icon={faFilter} className="text-slate-500" />
                        <select
                            value={filterPreset}
                            onChange={(e) => setFilterPreset(e.target.value as FilterPreset)}
                            className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm bg-white"
                        >
                            <option value="all">모든 항목</option>
                            <option value="incomplete">미완성 관계</option>
                            <option value="orphaned">고립된 레코드</option>
                            <option value="active">활성 항목만</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="flex-shrink-0 mb-4">
                <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 overflow-hidden text-xs md:text-sm">
                    <button
                        className={`px-3 md:px-4 py-2 font-medium flex items-center gap-1.5 md:gap-2 ${activeView === 'worker' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
                        onClick={() => setActiveView('worker')}
                    >
                        <FontAwesomeIcon icon={faUser} />
                        <span>작업자 기준</span>
                    </button>
                    <button
                        className={`px-3 md:px-4 py-2 font-medium flex items-center gap-1.5 md:gap-2 ${activeView === 'team' ? 'bg-white text-sky-600 shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
                        onClick={() => setActiveView('team')}
                    >
                        <FontAwesomeIcon icon={faUserGroup} />
                        <span>팀 기준</span>
                    </button>
                    <button
                        className={`px-3 md:px-4 py-2 font-medium flex items-center gap-1.5 md:gap-2 ${activeView === 'site' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
                        onClick={() => setActiveView('site')}
                    >
                        <FontAwesomeIcon icon={faMapMarkerAlt} />
                        <span>현장 기준</span>
                    </button>
                    <button
                        className={`px-3 md:px-4 py-2 font-medium flex items-center gap-1.5 md:gap-2 ${activeView === 'company' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
                        onClick={() => setActiveView('company')}
                    >
                        <FontAwesomeIcon icon={faBuilding} />
                        <span>회사 기준</span>
                    </button>
                </div>
            </div>

            <div className="flex-1 flex gap-4 overflow-hidden">
                {activeView === 'worker' && (
                    <>
                        <div className="w-1/3 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
                            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-white">
                                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                                    <FontAwesomeIcon icon={faUsers} className="text-indigo-500" />
                                    <span>작업자 목록</span>
                                </div>
                                <span className="text-xs bg-indigo-100 text-indigo-600 px-2 py-1 rounded-full font-medium">
                                    {filterEntities(workers, 'worker').length}개
                                </span>
                            </div>
                            <div className="flex-1 overflow-auto">
                                {filterEntities(workers, 'worker').map(worker => {
                                    const healthStatus = getEntityHealthStatus(worker, 'worker');
                                    const healthIndicator = getHealthIndicator(healthStatus);
                                    return (
                                        <button
                                            key={worker.id}
                                            onClick={() => setSelectedWorkerId(worker.id || null)}
                                            className={`w-full text-left px-4 py-3 text-sm border-b border-slate-100 flex items-center justify-between transition-all ${selectedWorkerId === worker.id ? 'bg-indigo-50 text-indigo-700 border-l-4 border-l-indigo-500' : 'hover:bg-slate-50 hover:border-l-4 hover:border-l-slate-300'}`}
                                        >
                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                                <div className={`p-1.5 rounded-lg ${healthIndicator.bg}`}>
                                                    <FontAwesomeIcon
                                                        icon={healthIndicator.icon}
                                                        className={`text-xs ${healthIndicator.color}`}
                                                        title={healthStatus === 'healthy' ? '정상' : healthStatus === 'warning' ? '경고' : '오류'}
                                                    />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-medium text-slate-800 truncate">{worker.name}</div>
                                                    <div className="text-xs text-slate-500 truncate">{worker.teamName || '팀 미지정'}</div>
                                                </div>
                                            </div>
                                            <div className="text-xs text-slate-400 text-right">
                                                <div className="truncate max-w-[80px]">{worker.companyName || '회사 미지정'}</div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm p-4 overflow-auto">
                            {selectedWorker ? (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <FontAwesomeIcon icon={faUser} className="text-indigo-500" />
                                                <h2 className="text-lg font-bold text-slate-800">{selectedWorker.name}</h2>
                                            </div>
                                            <p className="text-xs text-slate-500 mt-1">작업자의 소속 팀과 회사를 관리합니다.</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <div className="text-xs font-semibold text-slate-500">소속 팀</div>
                                            <select
                                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                                                value={selectedWorker.teamId || ''}
                                                onChange={e => handleWorkerTeamChange(selectedWorker, e.target.value)}
                                            >
                                                <option value="">팀 미배정</option>
                                                {teams
                                                    .slice()
                                                    .sort((a, b) => a.name.localeCompare(b.name))
                                                    .map(team => (
                                                        <option key={team.id} value={team.id}>{team.name}</option>
                                                    ))}
                                            </select>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="text-xs font-semibold text-slate-500">소속 회사</div>
                                            <button
                                                type="button"
                                                disabled={!selectedWorker.companyId}
                                                onClick={() => openCompanyView(selectedWorker.companyId || null)}
                                                className={`w-full px-3 py-2 rounded-lg border text-sm flex items-center justify-between ${selectedWorker.companyId
                                                    ? 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 transition-colors'
                                                    : 'border-dashed border-slate-200 bg-slate-50 text-slate-400 cursor-default'}`}
                                            >
                                                <span className="truncate mr-2">
                                                    {selectedWorker.companyName || '팀을 선택하면 회사가 자동 지정됩니다.'}
                                                </span>
                                                {selectedWorker.companyId && (
                                                    <span className="text-[10px] font-semibold text-slate-400 whitespace-nowrap">회사 탭으로 보기</span>
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="mt-4 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div className="text-xs font-semibold text-slate-500">배정 현장 (N:M)</div>
                                            <div className="text-[10px] text-slate-400">주현장은 자동 동기화됩니다.</div>
                                        </div>
                                        <div className="border border-slate-200 rounded-lg bg-slate-50/40 max-h-48 overflow-auto">
                                            {(() => {
                                                const activeAssignments = assignments
                                                    .filter(a => a.workerId === selectedWorker.id && (a.status || 'active') === 'active')
                                                    .slice()
                                                    .sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0));

                                                if (activeAssignments.length === 0) {
                                                    return (
                                                        <div className="px-3 py-2 text-[11px] text-slate-400">배정된 현장이 없습니다.</div>
                                                    );
                                                }

                                                return (
                                                    <ul className="divide-y divide-slate-100 text-xs">
                                                        {activeAssignments.map(assignment => {
                                                            const isPrimary =
                                                                assignment.isPrimary ||
                                                                (!!selectedWorker.siteId && assignment.siteId === selectedWorker.siteId);

                                                            return (
                                                                <li key={assignment.id || `${assignment.workerId}-${assignment.siteId}`}
                                                                    className="px-3 py-2 flex items-center justify-between"
                                                                >
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => openSiteView(assignment.siteId)}
                                                                        className="flex-1 min-w-0 text-left hover:underline"
                                                                    >
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="truncate">{assignment.siteName || '현장명 미지정'}</span>
                                                                            {isPrimary && (
                                                                                <span className="text-[10px] px-2 py-0.5 rounded-full border border-indigo-200 bg-indigo-50 text-indigo-700 whitespace-nowrap">주현장</span>
                                                                            )}
                                                                        </div>
                                                                        {assignment.teamName && (
                                                                            <div className="text-[11px] text-slate-500 truncate">팀: {assignment.teamName}</div>
                                                                        )}
                                                                    </button>
                                                                    <span className="text-[10px] text-slate-400 whitespace-nowrap ml-2">현장 탭으로</span>
                                                                </li>
                                                            );
                                                        })}
                                                    </ul>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                                    왼쪽에서 작업자를 선택하세요.
                                </div>
                            )}
                        </div>
                    </>
                )}

                {activeView === 'team' && (
                    <>
                        <div className="w-1/3 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
                            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-sky-50 to-white">
                                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                                    <FontAwesomeIcon icon={faUserGroup} className="text-sky-500" />
                                    <span>팀 목록</span>
                                </div>
                                <span className="text-xs bg-sky-100 text-sky-600 px-2 py-1 rounded-full font-medium">
                                    {filterEntities(teams, 'team').length}개
                                </span>
                            </div>
                            <div className="flex-1 overflow-auto">
                                {filterEntities(teams, 'team').map(team => {
                                    const healthStatus = getEntityHealthStatus(team, 'team');
                                    const healthIndicator = getHealthIndicator(healthStatus);
                                    return (
                                        <button
                                            key={team.id}
                                            onClick={() => setSelectedTeamId(team.id || null)}
                                            className={`w-full text-left px-4 py-3 text-sm border-b border-slate-100 flex items-center justify-between transition-all ${selectedTeamId === team.id ? 'bg-sky-50 text-sky-700 border-l-4 border-l-sky-500' : 'hover:bg-slate-50 hover:border-l-4 hover:border-l-slate-300'}`}
                                        >
                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                                <div className={`p-1.5 rounded-lg ${healthIndicator.bg}`}>
                                                    <FontAwesomeIcon
                                                        icon={healthIndicator.icon}
                                                        className={`text-xs ${healthIndicator.color}`}
                                                        title={healthStatus === 'healthy' ? '정상' : healthStatus === 'warning' ? '경고' : '오류'}
                                                    />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-medium text-slate-800 truncate">{team.name}</div>
                                                    <div className="text-xs text-slate-500 truncate">{team.leaderName || '리더 미지정'}</div>
                                                </div>
                                            </div>
                                            <div className="text-xs text-slate-400 text-right">
                                                <div className="truncate max-w-[80px]">{team.companyName || '회사 미지정'}</div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm p-4 overflow-auto">
                            {selectedTeam ? (
                                <div className="space-y-4">
                                    {(() => {
                                        const teamWorkers = workers.filter(w => w.teamId === selectedTeam.id);
                                        const teamSites = sites.filter(s => s.responsibleTeamId === selectedTeam.id);

                                        const company = selectedTeam.companyId
                                            ? companies.find(c => c.id === selectedTeam.companyId) || null
                                            : null;

                                        return (
                                            <>
                                                <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
                                                    <div>
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <FontAwesomeIcon icon={faUserGroup} className="text-sky-500" />
                                                            <h2 className="text-lg font-bold text-slate-800 whitespace-nowrap">{selectedTeam.name}</h2>
                                                            {selectedTeam.status && (
                                                                <span className="text-[10px] px-2 py-0.5 rounded-full border border-slate-200 bg-slate-50 text-slate-500 whitespace-nowrap">
                                                                    상태: {selectedTeam.status}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-slate-500 mt-1">
                                                            이 팀과 연결된 회사, 담당 현장, 팀원을 한 곳에서 확인합니다.
                                                        </p>
                                                    </div>
                                                    <div className="flex flex-col items-end text-[11px] text-slate-500 gap-1 flex-shrink-0">
                                                        <div className="flex items-center gap-1">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                                                            <span>팀원 {teamWorkers.length}명</span>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                                                            <span>담당 현장 {teamSites.length}개</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                                                    <div className="space-y-2">
                                                        <div className="text-xs font-semibold text-slate-500 flex items-center justify-between">
                                                            <span>소속 회사</span>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            disabled={!selectedTeam.companyId}
                                                            onClick={() => openCompanyView(selectedTeam.companyId || null)}
                                                            className={`w-full px-3 py-2 rounded-lg border text-sm flex items-center justify-between ${selectedTeam.companyId
                                                                ? 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 transition-colors'
                                                                : 'border-dashed border-slate-200 bg-slate-50 text-slate-400 cursor-default'}`}
                                                        >
                                                            <span className="truncate mr-2">
                                                                {company?.name || selectedTeam.companyName || '회사 미지정'}
                                                            </span>
                                                            {selectedTeam.companyId && (
                                                                <span className="text-[10px] font-semibold text-slate-400 whitespace-nowrap">회사 탭으로 보기</span>
                                                            )}
                                                        </button>
                                                    </div>

                                                    <div className="space-y-2">
                                                        <div className="text-xs font-semibold text-slate-500">팀장 / 기본 정보</div>
                                                        <div className="px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-700 space-y-1">
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-slate-500">팀장</span>
                                                                <span className="font-semibold">{selectedTeam.leaderName || '미지정'}</span>
                                                            </div>
                                                            {selectedTeam.type && (
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-slate-500">유형</span>
                                                                    <span className="font-semibold">{selectedTeam.type}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                                    <div className="space-y-2">
                                                        <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                                                            <span>팀원 ({teamWorkers.length}명)</span>
                                                        </div>
                                                        <div className="border border-slate-200 rounded-lg bg-slate-50/40 max-h-60 overflow-auto">
                                                            {teamWorkers.length > 0 ? (
                                                                <ul className="divide-y divide-slate-100 text-xs">
                                                                    {teamWorkers.map(worker => (
                                                                        <li key={worker.id}>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => openWorkerView(worker.id)}
                                                                                className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-white transition-colors text-left"
                                                                            >
                                                                                <span className="truncate mr-2">{worker.name}</span>
                                                                                <span className="text-[10px] text-slate-400 whitespace-nowrap">작업자 탭으로</span>
                                                                            </button>
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            ) : (
                                                                <div className="px-3 py-2 text-[11px] text-slate-400">등록된 팀원이 없습니다.</div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="space-y-2">
                                                        <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                                                            <span>담당 현장 ({teamSites.length}개)</span>
                                                        </div>
                                                        <div className="border border-slate-200 rounded-lg bg-slate-50/40 max-h-60 overflow-auto">
                                                            {teamSites.length > 0 ? (
                                                                <ul className="divide-y divide-slate-100 text-xs">
                                                                    {teamSites.map(site => (
                                                                        <li key={site.id}>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => openSiteView(site.id)}
                                                                                className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-white transition-colors text-left"
                                                                            >
                                                                                <span className="truncate mr-2">{site.name}</span>
                                                                                <span className="text-[10px] text-slate-400 whitespace-nowrap">현장 탭으로</span>
                                                                            </button>
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            ) : (
                                                                <div className="px-3 py-2 text-[11px] text-slate-400">담당 현장이 없습니다.</div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </>
                                        );
                                    })()}
                                </div>
                            ) : (
                                <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                                    왼쪽에서 팀을 선택하세요.
                                </div>
                            )}
                        </div>
                    </>
                )}

                {activeView === 'site' && (
                    <>
                        <div className="w-1/3 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
                            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-emerald-50 to-white">
                                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                                    <FontAwesomeIcon icon={faMapMarkerAlt} className="text-emerald-500" />
                                    <span>현장 목록</span>
                                </div>
                                <span className="text-xs bg-emerald-100 text-emerald-600 px-2 py-1 rounded-full font-medium">
                                    {filterEntities(sites, 'site').length}개
                                </span>
                            </div>
                            <div className="flex-1 overflow-auto">
                                {filterEntities(sites, 'site').map(site => {
                                    const healthStatus = getEntityHealthStatus(site, 'site');
                                    const healthIndicator = getHealthIndicator(healthStatus);
                                    return (
                                        <button
                                            key={site.id}
                                            onClick={() => setSelectedSiteId(site.id || null)}
                                            className={`w-full text-left px-4 py-3 text-sm border-b border-slate-100 flex items-center justify-between transition-all ${selectedSiteId === site.id ? 'bg-emerald-50 text-emerald-700 border-l-4 border-l-emerald-500' : 'hover:bg-slate-50 hover:border-l-4 hover:border-l-slate-300'}`}
                                        >
                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                                <div className={`p-1.5 rounded-lg ${healthIndicator.bg}`}>
                                                    <FontAwesomeIcon
                                                        icon={healthIndicator.icon}
                                                        className={`text-xs ${healthIndicator.color}`}
                                                        title={healthStatus === 'healthy' ? '정상' : healthStatus === 'warning' ? '경고' : '오류'}
                                                    />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-medium text-slate-800 truncate">{site.name}</div>
                                                    <div className="text-xs text-slate-500 truncate">{site.responsibleTeamName || '담당팀 미지정'}</div>
                                                </div>
                                            </div>
                                            <div className="text-xs text-slate-400 text-right">
                                                <div className="truncate max-w-[80px]">{site.companyName || '회사 미지정'}</div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm p-4 overflow-auto">
                            {selectedSite ? (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <FontAwesomeIcon icon={faMapMarkerAlt} className="text-emerald-500" />
                                                <h2 className="text-lg font-bold text-slate-800">{selectedSite.name}</h2>
                                            </div>
                                            <p className="text-xs text-slate-500 mt-1">현장의 소속 회사와 담당 팀을 관리합니다.</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <div className="text-xs font-semibold text-slate-500">소속 회사</div>
                                            <div className="flex gap-2">
                                                <select
                                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500"
                                                    value={selectedSite.companyId || ''}
                                                    onChange={e => handleSiteCompanyChange(selectedSite, e.target.value)}
                                                >
                                                    <option value="">회사 미지정</option>
                                                    {companies
                                                        .slice()
                                                        .sort((a, b) => a.name.localeCompare(b.name))
                                                        .map(company => (
                                                            <option key={company.id} value={company.id}>{company.name}</option>
                                                        ))}
                                                </select>
                                                {selectedSite.companyId && (
                                                    <button
                                                        type="button"
                                                        onClick={() => openCompanyView(selectedSite.companyId || null)}
                                                        className="px-2 py-2 text-[10px] rounded-lg border border-slate-200 bg-slate-50 text-slate-500 whitespace-nowrap hover:bg-slate-100"
                                                    >
                                                        회사 탭
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="text-xs font-semibold text-slate-500">담당 팀</div>
                                            <div className="flex gap-2">
                                                <select
                                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500"
                                                    value={selectedSite.responsibleTeamId || ''}
                                                    onChange={e => handleSiteTeamChange(selectedSite, e.target.value)}
                                                >
                                                    <option value="">담당팀 미지정</option>
                                                    {teams
                                                        .slice()
                                                        .sort((a, b) => a.name.localeCompare(b.name))
                                                        .map(team => (
                                                            <option key={team.id} value={team.id}>{team.name}</option>
                                                        ))}
                                                </select>
                                                {selectedSite.responsibleTeamId && (
                                                    <button
                                                        type="button"
                                                        onClick={() => openTeamView(selectedSite.responsibleTeamId || null)}
                                                        className="px-2 py-2 text-[10px] rounded-lg border border-slate-200 bg-slate-50 text-slate-500 whitespace-nowrap hover:bg-slate-100"
                                                    >
                                                        팀 탭
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                                    왼쪽에서 현장을 선택하세요.
                                </div>
                            )}
                        </div>
                    </>
                )}

                {activeView === 'company' && (
                    <>
                        <div className="w-1/3 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
                            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
                                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                                    <FontAwesomeIcon icon={faBuilding} className="text-slate-600" />
                                    <span>회사 목록</span>
                                </div>
                                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full font-medium">
                                    {filterEntities(companies, 'company').length}개
                                </span>
                            </div>
                            <div className="flex-1 overflow-auto">
                                {filterEntities(companies, 'company').map(company => (
                                    <button
                                        key={company.id}
                                        onClick={() => setSelectedCompanyId(company.id || null)}
                                        className={`w-full text-left px-4 py-3 text-sm border-b border-slate-100 flex items-center justify-between transition-all ${selectedCompanyId === company.id ? 'bg-slate-50 text-slate-800 border-l-4 border-l-slate-500' : 'hover:bg-slate-50 hover:border-l-4 hover:border-l-slate-300'}`}
                                    >
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                            <div className="p-1.5 rounded-lg bg-green-50">
                                                <FontAwesomeIcon
                                                    icon={faCheckCircle}
                                                    className="text-xs text-green-500"
                                                    title="정상"
                                                />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-medium text-slate-800 truncate">{company.name}</div>
                                                <div className="text-xs text-slate-500 truncate">{company.type || '유형 미지정'}</div>
                                            </div>
                                        </div>
                                        <div className="text-xs text-slate-400 text-right">
                                            <div className="truncate max-w-[80px]">최상위</div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm p-4 overflow-auto">
                            {selectedCompany ? (
                                <div className="space-y-4">
                                    {(() => {
                                        const companyTeams = teams.filter(t => t.companyId === selectedCompany.id);
                                        const companySites = sites.filter(s => s.companyId === selectedCompany.id);
                                        const companyWorkers = workers.filter(w => w.companyId === selectedCompany.id);

                                        return (
                                            <>
                                                <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
                                                    <div>
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <FontAwesomeIcon icon={faBuilding} className="text-slate-700" />
                                                            <h2 className="text-lg font-bold text-slate-800 whitespace-nowrap">{selectedCompany.name}</h2>
                                                            {selectedCompany.type && (
                                                                <span className="text-[10px] px-2 py-0.5 rounded-full border border-slate-200 bg-slate-50 text-slate-500 whitespace-nowrap">
                                                                    유형: {selectedCompany.type}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-slate-500 mt-1">
                                                            이 회사와 연결된 팀, 현장, 작업자를 한 곳에서 확인합니다.
                                                        </p>
                                                    </div>
                                                    <div className="flex flex-col items-end text-[11px] text-slate-500 gap-1 flex-shrink-0">
                                                        <div className="flex items-center gap-1">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                                                            <span>팀 {companyTeams.length}개</span>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                                                            <span>현장 {companySites.length}개</span>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                                                            <span>작업자 {companyWorkers.length}명</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
                                                    <div className="space-y-2">
                                                        <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                                                            <span>소속 팀 ({companyTeams.length}개)</span>
                                                        </div>
                                                        <div className="border border-slate-200 rounded-lg bg-slate-50/40 max-h-64 overflow-auto">
                                                            {companyTeams.length > 0 ? (
                                                                <ul className="divide-y divide-slate-100 text-xs">
                                                                    {companyTeams.map(team => (
                                                                        <li key={team.id}>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => openTeamView(team.id)}
                                                                                className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-white transition-colors text-left"
                                                                            >
                                                                                <span className="truncate mr-2">{team.name}</span>
                                                                                <span className="text-[10px] text-slate-400 whitespace-nowrap">팀 탭으로</span>
                                                                            </button>
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            ) : (
                                                                <div className="px-3 py-2 text-[11px] text-slate-400">등록된 팀이 없습니다.</div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="space-y-2">
                                                        <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                                                            <span>소속 현장 ({companySites.length}개)</span>
                                                        </div>
                                                        <div className="border border-slate-200 rounded-lg bg-slate-50/40 max-h-64 overflow-auto">
                                                            {companySites.length > 0 ? (
                                                                <ul className="divide-y divide-slate-100 text-xs">
                                                                    {companySites.map(site => (
                                                                        <li key={site.id}>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => openSiteView(site.id)}
                                                                                className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-white transition-colors text-left"
                                                                            >
                                                                                <span className="truncate mr-2">{site.name}</span>
                                                                                <span className="text-[10px] text-slate-400 whitespace-nowrap">현장 탭으로</span>
                                                                            </button>
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            ) : (
                                                                <div className="px-3 py-2 text-[11px] text-slate-400">등록된 현장이 없습니다.</div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="space-y-2">
                                                        <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                                                            <span>소속 작업자 ({companyWorkers.length}명)</span>
                                                        </div>
                                                        <div className="border border-slate-200 rounded-lg bg-slate-50/40 max-h-64 overflow-auto">
                                                            {companyWorkers.length > 0 ? (
                                                                <ul className="divide-y divide-slate-100 text-xs">
                                                                    {companyWorkers.map(worker => (
                                                                        <li key={worker.id}>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => openWorkerView(worker.id)}
                                                                                className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-white transition-colors text-left"
                                                                            >
                                                                                <span className="truncate mr-2">{worker.name}</span>
                                                                                <span className="text-[10px] text-slate-400 whitespace-nowrap">작업자 탭으로</span>
                                                                            </button>
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            ) : (
                                                                <div className="px-3 py-2 text-[11px] text-slate-400">등록된 작업자가 없습니다.</div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </>
                                        );
                                    })()}
                                </div>
                            ) : (
                                <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                                    왼쪽에서 회사를 선택하세요.
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default RelationshipConsolePage;
