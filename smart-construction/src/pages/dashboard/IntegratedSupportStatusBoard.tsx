import React, { useState, useEffect, useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faSearch, faEraser, faUserTag, faTruckPlane, faBuilding,
    faChevronDown, faChevronRight, faUser, faUsers, faMapMarkerAlt,
    faFilter, faEye, faEyeSlash, faIndustry, faStar
} from '@fortawesome/free-solid-svg-icons';
import { dailyReportService } from '../../services/dailyReportService';
import { manpowerService, Worker } from '../../services/manpowerService';
import { siteService, Site } from '../../services/siteService';
import { companyService, Company } from '../../services/companyService';
import { teamService, Team } from '../../services/teamService';

type ViewMode = 'inbound' | 'outbound';

interface SupportWorkerStats {
    workerId: string;
    name: string;
    manDay: number;
}

interface SupportTeamStats {
    teamId: string;
    name: string;
    companyName: string;
    companyId: string | undefined;
    manDay: number;
    workers: SupportWorkerStats[];
}

interface SupportSiteStats {
    siteId: string;
    name: string;
    siteCompanyId?: string; // 현장 소속 회사 ID
    responsibleTeamName?: string;
    manDay: number;
    teams: SupportTeamStats[];
}

// 회사별 색상 매핑
const COMPANY_COLORS: { [key: string]: { bg: string; text: string; border: string; icon: string } } = {
    default: { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-300', icon: 'text-slate-500' },
    blue: { bg: 'bg-blue-100', text: 'text-blue-600', border: 'border-blue-300', icon: 'text-blue-500' },
    green: { bg: 'bg-green-100', text: 'text-green-600', border: 'border-green-300', icon: 'text-green-500' },
    purple: { bg: 'bg-purple-100', text: 'text-purple-600', border: 'border-purple-300', icon: 'text-purple-500' },
    orange: { bg: 'bg-orange-100', text: 'text-orange-600', border: 'border-orange-300', icon: 'text-orange-500' },
    red: { bg: 'bg-red-100', text: 'text-red-600', border: 'border-red-300', icon: 'text-red-500' },
    teal: { bg: 'bg-teal-100', text: 'text-teal-600', border: 'border-teal-300', icon: 'text-teal-500' },
    indigo: { bg: 'bg-indigo-100', text: 'text-indigo-600', border: 'border-indigo-300', icon: 'text-indigo-500' },
    amber: { bg: 'bg-amber-100', text: 'text-amber-600', border: 'border-amber-300', icon: 'text-amber-500' },
    pink: { bg: 'bg-pink-100', text: 'text-pink-600', border: 'border-pink-300', icon: 'text-pink-500' }
};

const getCompanyColor = (companyName: string, index: number) => {
    const colorKeys = Object.keys(COMPANY_COLORS).filter(key => key !== 'default');
    const colorIndex = index % colorKeys.length;

    // 특정 회사 이름에 대한 색상 매핑
    if (companyName.includes('삼성')) return COMPANY_COLORS.purple;
    if (companyName.includes('현대')) return COMPANY_COLORS.green;
    if (companyName.includes('LG')) return COMPANY_COLORS.red;
    if (companyName.includes('SK')) return COMPANY_COLORS.teal;
    if (companyName.includes('롯데')) return COMPANY_COLORS.amber;
    if (companyName.includes('GS')) return COMPANY_COLORS.indigo;

    return COMPANY_COLORS[colorKeys[colorIndex]];
};

const IntegratedSupportStatusBoard: React.FC = () => {
    const [viewMode, setViewMode] = useState<ViewMode>('inbound');
    const [year, setYear] = useState(new Date().getFullYear());
    const [month, setMonth] = useState(new Date().getMonth() + 1);

    // 기준 회사 (우리 회사)
    const [myCompanyId, setMyCompanyId] = useState<string>('');

    // 팀 필터링을 위한 상태
    const [selectedTeamId, setSelectedTeamId] = useState<string>('');
    const [showOtherSites, setShowOtherSites] = useState(true);

    // Data
    const [companies, setCompanies] = useState<Company[]>([]);
    const [sites, setSites] = useState<Site[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);

    // Stats
    const [inboundStats, setInboundStats] = useState<SupportSiteStats[]>([]);
    const [outboundStats, setOutboundStats] = useState<SupportSiteStats[]>([]);
    const [totalManDay, setTotalManDay] = useState(0);
    const [loading, setLoading] = useState(false);

    // Accordion State
    const [expandedSites, setExpandedSites] = useState<Set<string>>(new Set());
    const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());

    // Action Message State
    const [actionMessage, setActionMessage] = useState<string>('');

    useEffect(() => {
        fetchInitialData();
    }, []);

    useEffect(() => {
        if (companies.length > 0 && !myCompanyId) {
            // 시공사 중에서 청연이 있으면 선택, 없으면 첫 번째 시공사
            const constructionCompanies = companies.filter(c => c.type === '시공사');
            const defaultCompany = constructionCompanies.find(c => c.name.includes('청연')) || constructionCompanies[0];
            if (defaultCompany) {
                setMyCompanyId(defaultCompany.id!);
            }
        }
    }, [companies]);

    useEffect(() => {
        fetchStats();
    }, [year, month, myCompanyId, viewMode, sites, teams]);

    const fetchInitialData = async () => {
        try {
            const [fetchedCompanies, fetchedSites, fetchedTeams] = await Promise.all([
                companyService.getCompanies(),
                siteService.getSites(),
                teamService.getTeams()
            ]);
            setCompanies(fetchedCompanies);
            setSites(fetchedSites);
            setTeams(fetchedTeams);
        } catch (error) {
            console.error("Error fetching initial data:", error);
        }
    };

    const fetchStats = async () => {
        if (!myCompanyId) return;

        setLoading(true);
        try {
            const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
            const lastDay = new Date(year, month, 0).getDate();
            const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;

            // Fetch reports
            const reports = await dailyReportService.getReportsByRange(startDate, endDate);

            let total = 0;

            // Helper Maps for fast lookup
            const siteMap = new Map(sites.map(s => [s.id, s]));
            const teamMap = new Map(teams.map(t => [t.id, t]));
            const companyMap = new Map(companies.map(c => [c.id, c]));

            const siteStatsMap = new Map<string, SupportSiteStats>();

            reports.forEach(report => {
                const site = siteMap.get(report.siteId);
                const team = teamMap.get(report.teamId);

                if (!site || !team) return;

                let isTarget = false;

                if (viewMode === 'inbound') {
                    // 지원온 현황: (우리 회사 현장) AND (타 회사 팀 투입)
                    if (site.companyId === myCompanyId && team.companyId !== myCompanyId) {
                        isTarget = true;
                    }
                } else {
                    // 지원간 현황: (타 회사 현장) AND (우리 회사 팀 투입)
                    if (site.companyId !== myCompanyId && team.companyId === myCompanyId) {
                        isTarget = true;
                    }
                }

                if (isTarget) {
                    // 1. Get or Create Site Stats
                    let siteStat = siteStatsMap.get(report.siteId);
                    if (!siteStat) {
                        siteStat = {
                            siteId: report.siteId,
                            name: site.name,
                            siteCompanyId: site.companyId, // 현장 소속 회사
                            responsibleTeamName: site.responsibleTeamName,
                            manDay: 0,
                            teams: []
                        };
                        siteStatsMap.set(report.siteId, siteStat);
                    }

                    // 2. Get or Create Team Stats within Site
                    let teamStat = siteStat.teams.find(t => t.teamId === report.teamId);
                    if (!teamStat) {
                        const company = companyMap.get(team.companyId);
                        teamStat = {
                            teamId: report.teamId,
                            name: team.name,
                            companyName: company?.name || 'Unknown',
                            companyId: team.companyId || undefined,
                            manDay: 0,
                            workers: []
                        };
                        siteStat.teams.push(teamStat);
                    }

                    // 3. Process Workers
                    report.workers.forEach(rw => {
                        if (rw.manDay > 0) {
                            // Update Totals
                            total += rw.manDay;
                            siteStat!.manDay += rw.manDay;
                            teamStat!.manDay += rw.manDay;

                            // Update Worker Stats
                            let workerStat = teamStat!.workers.find(w => w.workerId === rw.workerId);
                            if (!workerStat) {
                                workerStat = {
                                    workerId: rw.workerId,
                                    name: rw.name,
                                    manDay: 0
                                };
                                teamStat!.workers.push(workerStat);
                            }
                            workerStat.manDay += rw.manDay;
                        }
                    });
                }
            });

            // Convert Map to Array and Sort
            const sortedStats = Array.from(siteStatsMap.values())
                .sort((a, b) => b.manDay - a.manDay)
                .map(site => ({
                    ...site,
                    teams: site.teams
                        .sort((a, b) => b.manDay - a.manDay)
                        .map(team => ({
                            ...team,
                            workers: team.workers.sort((a, b) => b.manDay - a.manDay)
                        }))
                }));

            if (viewMode === 'inbound') {
                setInboundStats(sortedStats);
            } else {
                setOutboundStats(sortedStats);
            }

            setTotalManDay(total);
        } catch (error) {
            console.error("Error fetching stats:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleClear = () => {
        setYear(new Date().getFullYear());
        setMonth(new Date().getMonth() + 1);
    };

    const toggleSite = (siteId: string) => {
        const newSet = new Set(expandedSites);
        if (newSet.has(siteId)) {
            newSet.delete(siteId);
        } else {
            newSet.add(siteId);
        }
        setExpandedSites(newSet);
    };

    const toggleTeam = (teamId: string) => {
        const newSet = new Set(expandedTeams);
        if (newSet.has(teamId)) {
            newSet.delete(teamId);
        } else {
            newSet.add(teamId);
        }
        setExpandedTeams(newSet);
    };

    const currentStats = viewMode === 'inbound' ? inboundStats : outboundStats;
    const themeColor = viewMode === 'inbound' ? 'orange' : 'teal';
    const bgHover = viewMode === 'inbound' ? 'hover:bg-orange-50' : 'hover:bg-teal-50';
    const textTheme = viewMode === 'inbound' ? 'text-orange-600' : 'text-teal-600';
    const bgThemeLight = viewMode === 'inbound' ? 'bg-orange-100' : 'bg-teal-100';
    const textThemeDark = viewMode === 'inbound' ? 'text-orange-700' : 'text-teal-700';

    // 회사 정보 가져오기 (함수 정의를 먼저 이동)
    const getCompanyInfo = (companyId: string) => {
        return companies.find(c => c.id === companyId);
    };

    // 선택된 팀이 있는 현장과 없는 현장을 분리 (선택된 회사 우선 정렬)
    const { teamSites, otherSites } = useMemo(() => {
        if (!selectedTeamId) {
            // 선택된 팀이 없으면 선택된 회사 현장을 우선으로 정렬
            const sortedStats = [...currentStats].sort((a, b) => {
                const aCompany = getCompanyInfo(a.teams[0]?.companyId || '');
                const bCompany = getCompanyInfo(b.teams[0]?.companyId || '');

                // 선택된 회사 현장을 우선으로
                const aIsMyCompany = aCompany?.id === myCompanyId;
                const bIsMyCompany = bCompany?.id === myCompanyId;

                if (aIsMyCompany && !bIsMyCompany) return -1;
                if (!aIsMyCompany && bIsMyCompany) return 1;

                // 공수 순으로 정렬
                return b.manDay - a.manDay;
            });
            return { teamSites: sortedStats, otherSites: [] };
        }

        const teamSitesList: typeof currentStats = [];
        const otherSitesList: typeof currentStats = [];

        currentStats.forEach(site => {
            const hasSelectedTeam = site.teams.some(team => team.teamId === selectedTeamId);
            if (hasSelectedTeam) {
                teamSitesList.push(site);
            } else {
                otherSitesList.push(site);
            }
        });

        // 선택된 팀 현장도 선택된 회사 우선으로 정렬
        teamSitesList.sort((a, b) => {
            const aCompany = getCompanyInfo(a.teams[0]?.companyId || '');
            const bCompany = getCompanyInfo(b.teams[0]?.companyId || '');

            const aIsMyCompany = aCompany?.id === myCompanyId;
            const bIsMyCompany = bCompany?.id === myCompanyId;

            if (aIsMyCompany && !bIsMyCompany) return -1;
            if (!aIsMyCompany && bIsMyCompany) return 1;

            return b.manDay - a.manDay;
        });

        otherSitesList.sort((a, b) => b.manDay - a.manDay);

        return { teamSites: teamSitesList, otherSites: otherSitesList };
    }, [currentStats, selectedTeamId, myCompanyId]);

    // 선택된 팀 정보
    const selectedTeam = useMemo(() => {
        return teams.find(t => t.id === selectedTeamId);
    }, [teams, selectedTeamId]);

    return (
        <div className="flex flex-col h-full bg-slate-100">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 p-4 shadow-sm">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-4">
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <FontAwesomeIcon icon={viewMode === 'inbound' ? faUserTag : faTruckPlane} className={textTheme} />
                        통합 지원 현황판
                    </h1>

                    {/* View Mode Toggle */}
                    <div className="flex bg-slate-100 p-1 rounded-lg">
                        <button
                            onClick={() => setViewMode('inbound')}
                            className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${viewMode === 'inbound'
                                ? 'bg-white text-orange-600 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            <FontAwesomeIcon icon={faUserTag} className="mr-2" />
                            지원온 현황 (타사 → 우리현장)
                        </button>
                        <button
                            onClick={() => setViewMode('outbound')}
                            className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${viewMode === 'outbound'
                                ? 'bg-white text-teal-600 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            <FontAwesomeIcon icon={faTruckPlane} className="mr-2" />
                            지원간 현황 (우리팀 → 타사현장)
                        </button>
                    </div>

                    {/* Action Button with Message */}
                    <div className="flex items-center gap-2">
                        {viewMode === 'inbound' ? (
                            <button
                                onClick={() => {
                                    setActionMessage('지원비 지급 기능이 준비중입니다');
                                    setTimeout(() => setActionMessage(''), 3000);
                                }}
                                className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-2 shadow-sm"
                            >
                                💸 지원비 지급
                            </button>
                        ) : (
                            <button
                                onClick={() => {
                                    setActionMessage('지원비 청구 기능이 준비중입니다');
                                    setTimeout(() => setActionMessage(''), 3000);
                                }}
                                className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-2 shadow-sm"
                            >
                                📋 지원비 청구
                            </button>
                        )}
                        {actionMessage && (
                            <span className={`text-xs px-2 py-1 rounded-full animate-pulse ${viewMode === 'inbound' ? 'bg-orange-100 text-orange-700' : 'bg-teal-100 text-teal-700'}`}>
                                {actionMessage}
                            </span>
                        )}
                    </div>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-end gap-4 bg-gradient-to-r from-slate-50 to-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    {/* My Company Selector - 시공사만 표시 */}
                    <div className="flex flex-col min-w-[200px]">
                        <label className="text-xs font-bold text-slate-500 mb-1 flex items-center gap-1">
                            <FontAwesomeIcon icon={faBuilding} /> 기준 시공사
                        </label>
                        <select
                            value={myCompanyId}
                            onChange={(e) => {
                                setMyCompanyId(e.target.value);
                                setSelectedTeamId(''); // 회사 변경 시 팀 선택 초기화
                            }}
                            className="border-2 border-blue-100 bg-blue-50 rounded-lg px-3 py-2 text-sm font-bold text-blue-900 focus:outline-none focus:border-blue-500 shadow-sm"
                        >
                            {companies
                                .filter(c => c.type === '시공사')
                                .map(company => (
                                    <option key={company.id} value={company.id}>{company.name}</option>
                                ))}
                        </select>
                    </div>

                    {/* Date Filter */}
                    <div className="flex items-center gap-2">
                        <div className="flex flex-col">
                            <label className="text-xs font-bold text-slate-500 mb-1">검색년도</label>
                            <select
                                value={year}
                                onChange={(e) => setYear(Number(e.target.value))}
                                className="border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                            >
                                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
                                    <option key={y} value={y}>{y}년</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex flex-col">
                            <label className="text-xs font-bold text-slate-500 mb-1">검색월</label>
                            <select
                                value={month}
                                onChange={(e) => setMonth(Number(e.target.value))}
                                className="border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                            >
                                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                    <option key={m} value={m}>{m}월</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Summary Box */}
                    <div className="flex items-center gap-2 ml-auto">
                        <div className={`text-white px-4 py-2 rounded shadow-sm text-center min-w-[100px] ${viewMode === 'inbound' ? 'bg-orange-600' : 'bg-teal-600'}`}>
                            <div className="text-xs font-bold opacity-80">
                                {viewMode === 'inbound' ? '지원받은 총공수' : '지원나간 총공수'}
                            </div>
                            <div className="text-xl font-bold">{totalManDay.toFixed(1)}</div>
                        </div>
                    </div>

                    {/* Other Sites Toggle */}
                    {selectedTeamId && otherSites.length > 0 && (
                        <div className="flex items-center gap-2 ml-auto">
                            <button
                                onClick={() => setShowOtherSites(!showOtherSites)}
                                className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium text-slate-600 transition-colors"
                            >
                                <FontAwesomeIcon icon={showOtherSites ? faEye : faEyeSlash} />
                                기타 현장 {showOtherSites ? '숨기기' : '보기'}
                                <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full text-xs font-bold">
                                    {otherSites.length}
                                </span>
                            </button>
                        </div>
                    )}

                    {/* Buttons */}
                    <div className="flex gap-2">
                        <button
                            onClick={fetchStats}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-2 shadow-sm"
                        >
                            <FontAwesomeIcon icon={faSearch} />
                            조회
                        </button>
                        <button
                            onClick={handleClear}
                            className="bg-slate-500 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-2 shadow-sm"
                        >
                            <FontAwesomeIcon icon={faEraser} />
                            CLEAR
                        </button>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-4 bg-gradient-to-br from-slate-50 to-white">
                {loading ? (
                    <div className="flex justify-center items-center h-full text-slate-500">
                        <div className={`animate-spin rounded-full h-8 w-8 border-b-2 mr-2 ${viewMode === 'inbound' ? 'border-orange-600' : 'border-teal-600'}`}></div>
                        데이터를 불러오는 중입니다...
                    </div>
                ) : (
                    <div className="space-y-8">
                        {/* All Sites - Large Cards */}
                        {currentStats.length > 0 && (
                            <div>
                                <div className="flex items-center gap-3 mb-6">
                                    <div className={`${viewMode === 'inbound' ? 'bg-orange-100 text-orange-700' : 'bg-teal-100 text-teal-700'} px-4 py-2 rounded-lg`}>
                                        <FontAwesomeIcon icon={viewMode === 'inbound' ? faUserTag : faTruckPlane} className="mr-2" />
                                        <span className="font-bold">{viewMode === 'inbound' ? '지원온 현장' : '지원간 현장'}</span>
                                    </div>
                                    <div className="text-slate-500 text-sm">
                                        {currentStats.length}개 현장 • 총 {currentStats.reduce((sum, site) => sum + site.manDay, 0).toFixed(1)} 공수
                                    </div>
                                </div>
                                <div className="grid gap-6 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 auto-rows-min">
                                    {currentStats.map((site, siteIndex) => {
                                        // 현장 소유 회사 정보 (지원온: 시공사, 지원간: 협력사)
                                        const siteOwnerCompany = getCompanyInfo(site.siteCompanyId || '');
                                        const companyColor = siteOwnerCompany ? getCompanyColor(siteOwnerCompany.name, siteIndex) : COMPANY_COLORS.default;

                                        return (
                                            <div key={site.siteId} className={`bg-white rounded-xl ${companyColor.border} border-2 shadow-lg overflow-hidden h-fit transform hover:scale-105 transition-all duration-200`}>
                                                {/* Site Header */}
                                                <div className={`${companyColor.bg} p-6 border-b border-slate-100 relative`}>
                                                    <div className="flex items-start justify-between mb-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`p-3 rounded-lg ${companyColor.bg} border ${companyColor.border}`}>
                                                                <FontAwesomeIcon icon={faIndustry} className={`text-xl ${companyColor.icon}`} />
                                                            </div>
                                                            <div className="flex-1">
                                                                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                                                    {site.name}
                                                                </h3>
                                                                <div className="flex items-center gap-2 mt-1">
                                                                    <div className={`p-1 rounded ${companyColor.bg}`}>
                                                                        <FontAwesomeIcon icon={faBuilding} className={`text-xs ${companyColor.icon}`} />
                                                                    </div>
                                                                    <span className={`text-sm font-medium ${companyColor.text}`}>
                                                                        {siteOwnerCompany?.name || '알 수 없음'}
                                                                        <span className="text-xs ml-1 opacity-70">
                                                                            ({viewMode === 'inbound' ? '시공사' : '협력사'})
                                                                        </span>
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className={`text-2xl font-bold ${companyColor.text}`}>
                                                            {site.manDay.toFixed(1)}
                                                            <span className="text-sm text-slate-500 font-normal ml-1">공수</span>
                                                        </div>
                                                    </div>

                                                    {/* 회사 정보 - 건설사(inbound) 또는 협력사(outbound) */}
                                                    <div className="space-y-2">
                                                        {siteOwnerCompany && (
                                                            <div className={`flex items-center gap-2 ${companyColor.bg} rounded-lg px-3 py-2`}>
                                                                <div className={`p-1.5 rounded ${companyColor.bg} border ${companyColor.border}`}>
                                                                    <FontAwesomeIcon icon={faIndustry} className={`text-sm ${companyColor.icon}`} />
                                                                </div>
                                                                <div className="flex-1">
                                                                    <div className={`text-xs font-medium ${companyColor.text}`}>
                                                                        {viewMode === 'inbound' ? '건설사' : '협력사'}
                                                                    </div>
                                                                    <div className="text-sm font-bold text-slate-800">{siteOwnerCompany.name}</div>
                                                                    {siteOwnerCompany.type && (
                                                                        <div className="text-xs text-slate-500">{siteOwnerCompany.type}</div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {site.responsibleTeamName && (
                                                            <div className="bg-white/80 rounded-lg px-3 py-2 border border-slate-200">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="p-1.5 rounded bg-purple-100">
                                                                        <FontAwesomeIcon icon={faUsers} className="text-sm text-purple-600" />
                                                                    </div>
                                                                    <div className="flex-1">
                                                                        <div className="text-xs font-medium text-purple-600">담당팀</div>
                                                                        <div className="text-sm font-bold text-slate-800">{site.responsibleTeamName}</div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Teams List */}
                                                <div className="p-4">
                                                    <div className="flex items-center gap-2 mb-3">
                                                        <FontAwesomeIcon icon={faUsers} className="text-slate-400 text-sm" />
                                                        <span className="text-sm font-bold text-slate-700">투입 팀 ({site.teams.length}개)</span>
                                                    </div>
                                                    <div className="space-y-2">
                                                        {site.teams.map(team => (
                                                            <div key={team.teamId} className={`p-3 rounded-lg ${team.teamId === selectedTeamId ? 'bg-purple-100 border border-purple-200' : 'bg-slate-50 border border-slate-200'}`}>
                                                                <div className="flex items-center justify-between">
                                                                    <div>
                                                                        <div className="font-bold text-slate-800">{team.name}</div>
                                                                        <div className="text-xs text-slate-500">{team.companyName}</div>
                                                                    </div>
                                                                    <div className={`font-bold ${team.teamId === selectedTeamId ? 'text-purple-700' : 'text-slate-700'}`}>
                                                                        {team.manDay.toFixed(1)} <span className="text-xs text-slate-400 font-normal">공수</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Site Action Button */}
                                                <div className="px-4 pb-4">
                                                    <button
                                                        onClick={() => {
                                                            setActionMessage(`${site.name} - ${viewMode === 'inbound' ? '지원비 지급' : '지원비 청구'} 준비중`);
                                                            setTimeout(() => setActionMessage(''), 3000);
                                                        }}
                                                        className={`w-full py-2 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-2 ${viewMode === 'inbound'
                                                            ? 'bg-orange-100 hover:bg-orange-200 text-orange-700 border border-orange-200'
                                                            : 'bg-teal-100 hover:bg-teal-200 text-teal-700 border border-teal-200'}`}
                                                    >
                                                        {viewMode === 'inbound' ? '💸 지원비 지급' : '📋 지원비 청구'}
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Other Sites - Small Cards */}
                        {showOtherSites && otherSites.length > 0 && (
                            <div>
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="bg-slate-100 text-slate-600 px-4 py-2 rounded-lg">
                                        <FontAwesomeIcon icon={faEyeSlash} className="mr-2" />
                                        <span className="font-bold">기타 현장</span>
                                    </div>
                                    <div className="text-slate-500 text-sm">
                                        {otherSites.length}개 현장 • 총 {otherSites.reduce((sum, site) => sum + site.manDay, 0).toFixed(1)} 공수
                                    </div>
                                </div>
                                <div className="grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
                                    {otherSites.map((site, siteIndex) => {
                                        const siteCompany = getCompanyInfo(site.teams[0]?.companyId || '');
                                        const isMyCompany = siteCompany?.id === myCompanyId;
                                        const companyColor = siteCompany ? getCompanyColor(siteCompany.name, siteIndex) : COMPANY_COLORS.default;
                                        const isPriority = isMyCompany;

                                        return (
                                            <div key={site.siteId} className={`bg-white rounded-lg ${companyColor.border} border p-3 hover:shadow-md transition-all cursor-pointer group ${isPriority ? 'ring-1 ring-offset-1 ring-blue-300' : ''}`}>
                                                {/* 회사 아이콘과 이름 */}
                                                <div className="flex items-center gap-2 mb-2">
                                                    <div className={`p-1 rounded ${companyColor.bg} border ${companyColor.border}`}>
                                                        <FontAwesomeIcon icon={faIndustry} className={`text-xs ${companyColor.icon}`} />
                                                    </div>
                                                    <div className={`text-xs font-medium ${companyColor.text} truncate flex-1`}>{siteCompany?.name}</div>
                                                    {isPriority && (
                                                        <FontAwesomeIcon icon={faStar} className="text-blue-500 text-xs" title="우선 현장" />
                                                    )}
                                                </div>

                                                {/* 현장 이름 */}
                                                <div className="font-bold text-sm text-slate-800 truncate mb-1 group-hover:text-purple-600 transition-colors">
                                                    {site.name}
                                                </div>

                                                {/* 담당팀 정보 */}
                                                {site.responsibleTeamName && (
                                                    <div className="flex items-center gap-1 mb-1">
                                                        <FontAwesomeIcon icon={faUsers} className="text-xs text-purple-400" />
                                                        <div className="text-xs text-purple-600 truncate">{site.responsibleTeamName}</div>
                                                    </div>
                                                )}

                                                {/* 통계 정보 */}
                                                <div className="text-xs text-slate-500">
                                                    {site.teams.length}개 팀 • {site.manDay.toFixed(1)} 공수
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* No Data State */}
                        {currentStats.length === 0 && (
                            <div className="text-center py-20 text-slate-400">
                                <FontAwesomeIcon icon={viewMode === 'inbound' ? faUserTag : faTruckPlane} className="text-4xl mb-4 opacity-20" />
                                <p className="text-lg font-bold">{viewMode === 'inbound' ? '지원받은' : '지원나간'} 내역이 없습니다.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div >
    );
};

export default IntegratedSupportStatusBoard;
