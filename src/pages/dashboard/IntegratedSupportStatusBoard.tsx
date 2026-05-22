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

const normalizeTeamNameKey = (value?: string | null): string => {
    return String(value ?? '').trim().replace(/\s+/g, '').toLowerCase();
};

const resolveTeamNameFromSiteName = (siteName: string | undefined, teamNameMap: Map<string, string>): string | undefined => {
    const matches = Array.from(String(siteName ?? '').matchAll(/\(([^)]+)\)/g));
    for (let i = matches.length - 1; i >= 0; i--) {
        const candidate = String(matches[i][1] ?? '').trim();
        const matchedTeamName = teamNameMap.get(normalizeTeamNameKey(candidate));
        if (matchedTeamName) return matchedTeamName;
    }
    return undefined;
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
            const siteMap = new Map<string, Site>();
            sites.forEach(site => {
                const id = String(site.id ?? '').trim();
                const legacyId = String(site.legacyId ?? '').trim();
                if (id) siteMap.set(id, site);
                if (legacyId) siteMap.set(legacyId, site);
            });

            const teamMap = new Map<string, Team>();
            const teamByNameMap = new Map<string, Team>();
            teams.forEach(team => {
                const id = String(team.id ?? '').trim();
                const legacyId = String(team.legacyId ?? '').trim();
                const nameKey = normalizeTeamNameKey(team.name);
                if (id) teamMap.set(id, team);
                if (legacyId) teamMap.set(legacyId, team);
                if (nameKey && !teamByNameMap.has(nameKey)) {
                    teamByNameMap.set(nameKey, team);
                }
            });
            const companyMap = new Map(companies.map(c => [c.id, c]));
            const teamNameMap = new Map<string, string>();
            teams.forEach(team => {
                const nameKey = normalizeTeamNameKey(team.name);
                if (nameKey && !teamNameMap.has(nameKey)) {
                    teamNameMap.set(nameKey, team.name);
                }
            });

            const siteStatsMap = new Map<string, SupportSiteStats>();
            const siteResponsibleTeamPriorities = new Map<string, number>();

            reports.forEach(report => {
                const site = siteMap.get(report.siteId);

                if (!site) return;

                const reportResponsibleTeamName = String(report.responsibleTeamName ?? '').trim();
                const inferredResponsibleTeamName = resolveTeamNameFromSiteName(site.name, teamNameMap);
                const siteResponsibleTeamName = String(site.responsibleTeamName ?? '').trim();
                const responsibleTeamName = reportResponsibleTeamName || inferredResponsibleTeamName || siteResponsibleTeamName || undefined;
                const responsibleTeamPriority = reportResponsibleTeamName ? 2 : inferredResponsibleTeamName ? 1 : siteResponsibleTeamName ? 0 : -1;
                const siteStatsKey = String(site.id ?? report.siteId ?? '').trim() || report.siteId;

                report.workers.forEach(rw => {
                    const workerManDay = Number(rw.manDay ?? 0);
                    if (!Number.isFinite(workerManDay) || workerManDay <= 0) return;

                    const workerTeamId = String(rw.teamId ?? '').trim();
                    const workerTeamNameKey = normalizeTeamNameKey(rw.workerTeamName);
                    const reportTeamId = String(report.teamId ?? '').trim();
                    const reportTeamNameKey = normalizeTeamNameKey(report.teamName);
                    const team =
                        (workerTeamId ? teamMap.get(workerTeamId) : undefined) ??
                        (workerTeamNameKey ? teamByNameMap.get(workerTeamNameKey) : undefined) ??
                        (reportTeamId ? teamMap.get(reportTeamId) : undefined) ??
                        (reportTeamNameKey ? teamByNameMap.get(reportTeamNameKey) : undefined);

                    if (!team) return;

                    const teamCompanyId = String(team.companyId ?? '').trim();
                    const siteCompanyId = String(site.companyId ?? '').trim();
                    const isTarget = viewMode === 'inbound'
                        ? siteCompanyId === myCompanyId && teamCompanyId !== myCompanyId
                        : siteCompanyId !== myCompanyId && teamCompanyId === myCompanyId;

                    if (!isTarget) return;

                    let siteStat = siteStatsMap.get(siteStatsKey);
                    if (!siteStat) {
                        siteStat = {
                            siteId: siteStatsKey,
                            name: site.name,
                            siteCompanyId: site.companyId,
                            responsibleTeamName,
                            manDay: 0,
                            teams: []
                        };
                        siteStatsMap.set(siteStatsKey, siteStat);
                        siteResponsibleTeamPriorities.set(siteStatsKey, responsibleTeamPriority);
                    } else if (responsibleTeamName && responsibleTeamPriority > (siteResponsibleTeamPriorities.get(siteStatsKey) ?? -1)) {
                        siteStat.responsibleTeamName = responsibleTeamName;
                        siteResponsibleTeamPriorities.set(siteStatsKey, responsibleTeamPriority);
                    }

                    const providerTeamId = String(team.id ?? team.legacyId ?? workerTeamId ?? reportTeamId).trim();
                    let teamStat = siteStat.teams.find(t => t.teamId === providerTeamId);
                    if (!teamStat) {
                        const company = companyMap.get(team.companyId);
                        teamStat = {
                            teamId: providerTeamId,
                            name: team.name,
                            companyName: company?.name || 'Unknown',
                            companyId: team.companyId || undefined,
                            manDay: 0,
                            workers: []
                        };
                        siteStat.teams.push(teamStat);
                    }

                    total += workerManDay;
                    siteStat.manDay += workerManDay;
                    teamStat.manDay += workerManDay;

                    let workerStat = teamStat.workers.find(w => w.workerId === rw.workerId);
                    if (!workerStat) {
                        workerStat = {
                            workerId: rw.workerId,
                            name: rw.name,
                            manDay: 0
                        };
                        teamStat.workers.push(workerStat);
                    }
                    workerStat.manDay += workerManDay;
                });
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
        // [요청 반영] 공수가 0인 현장들은 필터링 단계에서 제거 (특히 이재욱팀 등 특정 팀 조회 시 유용)
        const activeStats = currentStats.filter(site => site.manDay > 0);

        if (!selectedTeamId) {
            // 선택된 팀이 없으면 선택된 회사 현장을 우선으로 정렬
            const sortedStats = [...activeStats].sort((a, b) => {
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

        const teamSitesList: typeof activeStats = [];
        const otherSitesList: typeof activeStats = [];

        activeStats.forEach(site => {
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

    // 외부 지원 나간 우리 팀들의 공수 합계 계산
    const outboundTeamSummary = useMemo(() => {
        if (viewMode !== 'outbound') return [];

        const teamMap = new Map<string, { teamName: string; companyName: string; totalManDay: number; sitesCount: number }>();

        outboundStats.forEach(site => {
            site.teams.forEach(team => {
                const existing = teamMap.get(team.teamId);
                if (existing) {
                    existing.totalManDay += team.manDay;
                    existing.sitesCount += 1;
                } else {
                    teamMap.set(team.teamId, {
                        teamName: team.name,
                        companyName: team.companyName,
                        totalManDay: team.manDay,
                        sitesCount: 1
                    });
                }
            });
        });

        return Array.from(teamMap.values()).sort((a, b) => b.totalManDay - a.totalManDay);
    }, [outboundStats, viewMode]);

    return (
        <div className="flex flex-col h-full bg-slate-100">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 p-4 shadow-sm">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-4">
                    <h1 className="text-2xl font-black text-slate-900 flex items-center gap-3 tracking-tighter">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg ${viewMode === 'inbound' ? 'bg-orange-600 text-white' : 'bg-teal-600 text-white'}`}>
                            <FontAwesomeIcon icon={viewMode === 'inbound' ? faUserTag : faTruckPlane} />
                        </div>
                        통합 지원 현황 리포트
                    </h1>

                    {/* View Mode Toggle */}
                    <div className="flex bg-slate-100 p-1.5 rounded-[14px] shadow-inner border border-slate-200">
                        <button
                            onClick={() => setViewMode('inbound')}
                            className={`px-6 py-2.5 rounded-lg text-sm font-black transition-all ${viewMode === 'inbound'
                                ? 'bg-white text-orange-600 shadow-md ring-1 ring-black/5'
                                : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            <FontAwesomeIcon icon={faUserTag} className="mr-2" />
                            지원받은 현황 (Inbound)
                        </button>
                        <button
                            onClick={() => setViewMode('outbound')}
                            className={`px-6 py-2.5 rounded-lg text-sm font-black transition-all ${viewMode === 'outbound'
                                ? 'bg-white text-teal-600 shadow-md ring-1 ring-black/5'
                                : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            <FontAwesomeIcon icon={faTruckPlane} className="mr-2" />
                            외부팀 지원 현황 (Outbound)
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
                                className="bg-slate-900 hover:bg-black text-white px-5 py-2.5 rounded-xl text-sm font-black transition-all flex items-center gap-2 shadow-xl active:scale-95"
                            >
                                💸 지원비 지급 정산
                            </button>
                        ) : (
                            <button
                                onClick={() => {
                                    setActionMessage('지원비 청구 기능이 준비중입니다');
                                    setTimeout(() => setActionMessage(''), 3000);
                                }}
                                className="bg-teal-700 hover:bg-teal-800 text-white px-5 py-2.5 rounded-xl text-sm font-black transition-all flex items-center gap-2 shadow-xl active:scale-95"
                            >
                                📋 외부 지원비 청구
                            </button>
                        )}
                    </div>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-end gap-4 bg-slate-50 p-5 rounded-2xl border border-slate-200 shadow-inner">
                    <div className="flex flex-col min-w-[220px]">
                        <label className="text-[10px] font-black text-slate-400 mb-1.5 flex items-center gap-1 uppercase tracking-widest">
                            <FontAwesomeIcon icon={faBuilding} className="text-indigo-500" /> 기준 소속 회사
                        </label>
                        <select
                            value={myCompanyId}
                            onChange={(e) => {
                                setMyCompanyId(e.target.value);
                                setSelectedTeamId('');
                            }}
                            className="border-2 border-white bg-white rounded-xl px-4 py-2.5 text-sm font-black text-slate-800 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 shadow-sm transition-all"
                        >
                            {companies
                                .filter(c => c.type === '시공사')
                                .map(company => (
                                    <option key={company.id} value={company.id}>{company.name}</option>
                                ))}
                        </select>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex flex-col">
                            <label className="text-[10px] font-black text-slate-400 mb-1.5 uppercase tracking-widest text-center">Year</label>
                            <select
                                value={year}
                                onChange={(e) => setYear(Number(e.target.value))}
                                className="border border-slate-200 bg-white rounded-xl px-4 py-2.5 text-sm font-bold focus:outline-none shadow-sm"
                            >
                                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
                                    <option key={y} value={y}>{y}년</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex flex-col">
                            <label className="text-[10px] font-black text-slate-400 mb-1.5 uppercase tracking-widest text-center">Month</label>
                            <select
                                value={month}
                                onChange={(e) => setMonth(Number(e.target.value))}
                                className="border border-slate-200 bg-white rounded-xl px-4 py-2.5 text-sm font-bold focus:outline-none shadow-sm"
                            >
                                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                    <option key={m} value={m}>{m}월</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 ml-auto">
                        <div className={`p-1 rounded-2xl bg-white border border-slate-200 flex items-center gap-1 shadow-sm`}>
                            <div className={`px-5 py-2.5 rounded-xl text-white shadow-lg text-center min-w-[140px] ${viewMode === 'inbound' ? 'bg-orange-600 shadow-orange-200' : 'bg-teal-600 shadow-teal-200'}`}>
                                <div className="text-[9px] font-black opacity-80 uppercase tracking-tighter">Total Support Man-Days</div>
                                <div className="text-2xl font-black">{totalManDay.toFixed(1)}</div>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <button onClick={fetchStats} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl text-sm font-black transition-all flex items-center gap-2 shadow-lg shadow-indigo-100 active:scale-95">
                            <FontAwesomeIcon icon={faSearch} />
                            현황 조회
                        </button>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-6 bg-[#f8fafc]">
                {loading ? (
                    <div className="flex flex-col justify-center items-center h-full gap-4 text-slate-400 font-black italic">
                        <div className={`animate-spin rounded-full h-12 w-12 border-b-4 ${viewMode === 'inbound' ? 'border-orange-600' : 'border-teal-600'}`}></div>
                        ANALYZING SUPPORT DATA...
                    </div>
                ) : (
                    <div className="space-y-12 max-w-[1600px] mx-auto">
                        
                        {/* [요청 사항 반영] 외부 지원 나간 우리 팀별 요약 그리드 */}
                        {viewMode === 'outbound' && outboundTeamSummary.length > 0 && (
                            <div>
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="bg-teal-600 text-white px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest shadow-md shadow-teal-100">Our Teams Summary</div>
                                    <h2 className="text-xl font-black text-slate-800 tracking-tight italic">팀별 외부 지원 실적 합계</h2>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                    {outboundTeamSummary.map((team, idx) => (
                                        <div key={idx} className="bg-white border-2 border-teal-50 rounded-[24px] p-5 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden">
                                            <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
                                                <FontAwesomeIcon icon={faUsers} size="3x" className="text-teal-900" />
                                            </div>
                                            <div className="flex items-center gap-4 mb-4">
                                                <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center text-xl font-black shadow-inner group-hover:bg-teal-600 group-hover:text-white transition-colors duration-300">
                                                    {team.teamName.charAt(0)}
                                                </div>
                                                <div>
                                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{team.companyName}</div>
                                                    <h3 className="text-lg font-black text-slate-800 leading-tight group-hover:text-teal-700">{team.teamName}</h3>
                                                </div>
                                            </div>
                                            <div className="flex justify-between items-end mt-6">
                                                <div>
                                                    <div className="text-[10px] font-bold text-slate-400">지원 현장수</div>
                                                    <div className="text-sm font-black text-slate-600 tracking-tighter">{team.sitesCount}개 현장</div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-[10px] font-bold text-teal-500 uppercase">Support Man-Day</div>
                                                    <div className="text-2xl font-black text-teal-600 tracking-tighter">{team.totalManDay.toFixed(1)}</div>
                                                </div>
                                            </div>
                                            <div className="mt-4 h-1 bg-teal-50 rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full bg-teal-500 transition-all duration-1000" 
                                                    style={{ width: `${(team.totalManDay / totalManDay) * 100}%` }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
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
