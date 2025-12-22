import React, { useState, useEffect, useMemo } from 'react';
import { manpowerService, Worker } from '../../services/manpowerService';
import { teamService, Team } from '../../services/teamService';
import { siteService, Site } from '../../services/siteService';
import { companyService, Company } from '../../services/companyService';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faBuilding, faUsers, faUser, faHardHat, faMapMarkerAlt,
    faChevronDown, faChevronRight, faSearch, faSitemap, faExclamationTriangle, faProjectDiagram, faArrowDown, faCheck, faTimes, faRobot, faIdCard, faCommentDots, faDatabase, faDiagramProject, faCrown
} from '@fortawesome/free-solid-svg-icons';
import D3TreeOrgChart, { OrgNode } from '../../components/structure/D3TreeOrgChart';
import D3RadialOrgChart from '../../components/structure/D3RadialOrgChart';
import PremiumOrgChart from '../../components/structure/PremiumOrgChart';

const OrganizationChartPage: React.FC = () => {
    const [viewMode, setViewMode] = useState<'company' | 'site' | 'team' | 'logic' | 'ai' | 'd3tree' | 'premium' | 'radial'>('team');
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const [workers, setWorkers] = useState<Worker[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [sites, setSites] = useState<Site[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);

    // Expansion states
    const [expandedCompanies, setExpandedCompanies] = useState<Set<string>>(new Set());
    const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());
    const [expandedSites, setExpandedSites] = useState<Set<string>>(new Set());

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [w, t, s, c] = await Promise.all([
                manpowerService.getWorkers(),
                teamService.getTeams(),
                siteService.getSites(),
                companyService.getCompanies()
            ]);
            setWorkers(w);
            setTeams(t);
            setSites(s);
            setCompanies(c);
        } catch (error) {
            console.error("Failed to load data", error);
        } finally {
            setLoading(false);
        }
    };

    // Build hierarchical data for D3 Tree
    const treeData = useMemo((): OrgNode => {
        // Root node
        const root: OrgNode = {
            id: 'root',
            name: '청연SITE',
            type: 'root',
            children: []
        };

        // Group teams by company
        const companyMap = new Map<string, { company: Company; teams: Team[] }>();
        companies.forEach(c => {
            if (c.id) companyMap.set(c.id, { company: c, teams: [] });
        });

        // Assign teams to companies
        const unassignedTeams: Team[] = [];
        teams.forEach(team => {
            if (team.companyId && companyMap.has(team.companyId)) {
                companyMap.get(team.companyId)!.teams.push(team);
            } else {
                unassignedTeams.push(team);
            }
        });

        // Build company nodes with team children
        companyMap.forEach(({ company, teams: companyTeams }) => {
            const companyNode: OrgNode = {
                id: company.id!,
                name: company.name,
                type: 'company',
                count: companyTeams.length,
                children: []
            };

            // Add teams to company
            companyTeams.forEach(team => {
                const teamWorkers = workers.filter(w => w.teamId === team.id);
                const teamNode: OrgNode = {
                    id: team.id!,
                    name: team.name,
                    type: 'team',
                    role: team.leaderName ? `대표: ${team.leaderName}` : undefined,
                    count: teamWorkers.length,
                    children: teamWorkers.map(w => ({
                        id: w.id!,
                        name: w.name,
                        type: 'worker' as const,
                        role: w.role || w.teamType
                    }))
                };
                companyNode.children!.push(teamNode);
            });

            if (companyNode.children!.length > 0 || companyTeams.length > 0) {
                root.children!.push(companyNode);
            }
        });

        // Add unassigned teams
        if (unassignedTeams.length > 0) {
            const unassignedNode: OrgNode = {
                id: 'unassigned',
                name: '미배정 팀',
                type: 'company',
                count: unassignedTeams.length,
                children: []
            };

            unassignedTeams.forEach(team => {
                const teamWorkers = workers.filter(w => w.teamId === team.id);
                const teamNode: OrgNode = {
                    id: team.id!,
                    name: team.name,
                    type: 'team',
                    count: teamWorkers.length,
                    children: teamWorkers.map(w => ({
                        id: w.id!,
                        name: w.name,
                        type: 'worker' as const,
                        role: w.role || w.teamType
                    }))
                };
                unassignedNode.children!.push(teamNode);
            });

            root.children!.push(unassignedNode);
        }

        // Add workers without teams
        const orphanWorkers = workers.filter(w => !w.teamId);
        if (orphanWorkers.length > 0) {
            const orphanNode: OrgNode = {
                id: 'orphan-workers',
                name: '미배정 근로자',
                type: 'team',
                count: orphanWorkers.length,
                children: orphanWorkers.map(w => ({
                    id: w.id!,
                    name: w.name,
                    type: 'worker' as const,
                    role: w.role || '미지정'
                }))
            };
            root.children!.push(orphanNode);
        }

        return root;
    }, [companies, teams, workers]);

    const toggleCompany = (id: string) => {
        const newSet = new Set(expandedCompanies);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setExpandedCompanies(newSet);
    };

    const toggleTeam = (id: string) => {
        const newSet = new Set(expandedTeams);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setExpandedTeams(newSet);
    };

    const toggleSite = (id: string) => {
        const newSet = new Set(expandedSites);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setExpandedSites(newSet);
    };

    // Filtering
    const filterNode = (name: string | undefined) => (name || '').toLowerCase().includes(searchTerm.toLowerCase());

    // Render Helpers
    const renderWorkerNode = (worker: Worker) => (
        <div key={worker.id} className="ml-6 p-2 border-l-2 border-slate-200 hover:bg-slate-50 flex items-center gap-2 text-sm">
            <FontAwesomeIcon icon={faUser} className="text-slate-400" />
            <span className="font-medium text-slate-700">{worker.name}</span>
            <span className="text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{worker.role}</span>
            {worker.leaderName && <span className="text-xs text-orange-500 border border-orange-200 px-1.5 py-0.5 rounded">대표</span>}
        </div>
    );

    const renderTeamNode = (team: Team) => {
        if (!team.id) return null;
        const teamWorkers = workers.filter(w => w.teamId === team.id);
        const isExpanded = expandedTeams.has(team.id);
        const hasChildren = teamWorkers.length > 0;

        if (searchTerm && !filterNode(team.name) && !teamWorkers.some(w => filterNode(w.name))) return null;

        return (
            <div key={team.id} className="ml-6 mt-1">
                <div
                    className="p-2 bg-white border border-slate-200 rounded-lg shadow-sm flex items-center justify-between cursor-pointer hover:border-indigo-300 transition-colors"
                    onClick={() => toggleTeam(team.id!)}
                >
                    <div className="flex items-center gap-2">
                        <FontAwesomeIcon icon={isExpanded ? faChevronDown : faChevronRight} className="text-slate-400 text-xs w-4" />
                        <FontAwesomeIcon icon={faUsers} className="text-indigo-500" />
                        <span className="font-bold text-slate-700">{team.name}</span>
                        <span className="text-xs text-slate-500">({teamWorkers.length}명)</span>
                    </div>
                    {team.leaderName && <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-1 rounded">대표: {team.leaderName}</span>}
                </div>
                {isExpanded && (
                    <div className="mt-1 border-l-2 border-indigo-100 ml-3 pl-3">
                        {teamWorkers.map(renderWorkerNode)}
                        {teamWorkers.length === 0 && <div className="text-xs text-slate-400 p-2">소속된 작업자가 없습니다.</div>}
                    </div>
                )}
            </div>
        );
    };

    const renderTeamView = () => {
        return (
            <div className="space-y-4">
                {teams.map(team => {
                    if (!team.id) return null;
                    const teamWorkers = workers.filter(w => w.teamId === team.id);
                    const linkedCompany = companies.find(c => c.id === team.companyId);
                    const isExpanded = expandedTeams.has(team.id);

                    // Filter
                    if (searchTerm && !filterNode(team.name) && !teamWorkers.some(w => filterNode(w.name)) && !(linkedCompany && filterNode(linkedCompany.name))) return null;

                    return (
                        <div key={team.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <div
                                className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-colors"
                                onClick={() => toggleTeam(team.id!)}
                            >
                                <div className="flex items-center gap-3">
                                    <FontAwesomeIcon icon={isExpanded ? faChevronDown : faChevronRight} className="text-slate-400" />
                                    <div className="p-2 bg-white rounded-lg border border-slate-200 text-indigo-600">
                                        <FontAwesomeIcon icon={faUsers} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                            {team.name}
                                            {team.leaderName && <span className="text-xs font-normal text-slate-500 bg-slate-200 px-1.5 py-0.5 rounded">대표: {team.leaderName}</span>}
                                        </h3>
                                        <p className="text-xs text-slate-500">
                                            작업자 {teamWorkers.length}명
                                            {linkedCompany && <span className="ml-2 text-blue-600">@ {linkedCompany.name}</span>}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    {/* Team Type Badge */}
                                    <span className={`text-xs px-2 py-1 rounded font-medium ${team.name.includes('지원') ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-600'}`}>
                                        {team.name.includes('지원') ? '지원팀' : '일반팀'}
                                    </span>
                                </div>
                            </div>
                            {isExpanded && (
                                <div className="p-4 bg-slate-50/50 space-y-4">
                                    {/* Upward Link: Company */}
                                    <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                                        <div className="text-blue-500"><FontAwesomeIcon icon={faBuilding} /></div>
                                        <div className="flex-1">
                                            <div className="text-xs text-blue-400 font-bold uppercase tracking-wider">소속 회사 (Company)</div>
                                            {linkedCompany ? (
                                                <div className="font-bold text-blue-800">{linkedCompany.name}</div>
                                            ) : (
                                                <div className="text-sm text-slate-400 italic">연결된 회사가 없습니다.</div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Downward Link: Workers */}
                                    <div>
                                        <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2 ml-1">소속 작업자 (Workers)</div>
                                        <div className="space-y-1">
                                            {teamWorkers.map(renderWorkerNode)}
                                            {teamWorkers.length === 0 && <div className="text-sm text-slate-400 p-2 bg-white rounded border border-slate-100 text-center">소속된 작업자가 없습니다.</div>}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    };

    const renderCompanyView = () => {
        return (
            <div className="space-y-4">
                {companies.map(company => {
                    if (!company.id) return null;
                    const companyTeams = teams.filter(t => t.companyId === company.id);
                    const isExpanded = expandedCompanies.has(company.id);

                    if (searchTerm && !filterNode(company.name) && !companyTeams.some(t => filterNode(t.name))) return null;

                    return (
                        <div key={company.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <div
                                className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-colors"
                                onClick={() => toggleCompany(company.id!)}
                            >
                                <div className="flex items-center gap-3">
                                    <FontAwesomeIcon icon={isExpanded ? faChevronDown : faChevronRight} className="text-slate-400" />
                                    <div className="p-2 bg-white rounded-lg border border-slate-200 text-blue-600">
                                        <FontAwesomeIcon icon={faBuilding} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-800">{company.name}</h3>
                                        <p className="text-xs text-slate-500">{company.type} • 팀 {companyTeams.length}개</p>
                                    </div>
                                </div>
                            </div>
                            {isExpanded && (
                                <div className="p-4 bg-slate-50/50 space-y-2">
                                    {companyTeams.map(renderTeamNode)}
                                    {companyTeams.length === 0 && <div className="text-sm text-slate-400 p-4 text-center">소속된 팀이 없습니다.</div>}
                                </div>
                            )}
                        </div>
                    );
                })}

                {/* Unassigned Teams */}
                {teams.filter(t => !t.companyId).length > 0 && (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden border-l-4 border-l-gray-400">
                        <div className="p-4 bg-gray-50 border-b border-gray-100 flex items-center gap-3">
                            <div className="p-2 bg-white rounded-lg border border-gray-200 text-gray-500">
                                <FontAwesomeIcon icon={faExclamationTriangle} />
                            </div>
                            <h3 className="font-bold text-gray-700">미배정 팀 (소속사 없음)</h3>
                        </div>
                        <div className="p-4 space-y-2">
                            {teams.filter(t => !t.companyId).map(renderTeamNode)}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const renderSiteView = () => {
        return (
            <div className="space-y-4">
                {sites.map(site => {
                    if (!site.id) return null;
                    // Find teams working at this site (responsibleTeamId)
                    // Note: Current schema only links Site -> ResponsibleTeam (1:1). 
                    // Ideally, multiple teams work at a site. 
                    // But for now, let's show the responsible team, AND any workers assigned to this site directly (if any).
                    const responsibleTeam = teams.find(t => t.id === site.responsibleTeamId);
                    const isExpanded = expandedSites.has(site.id);

                    if (searchTerm && !filterNode(site.name)) return null;

                    return (
                        <div key={site.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <div
                                className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-colors"
                                onClick={() => toggleSite(site.id!)}
                            >
                                <div className="flex items-center gap-3">
                                    <FontAwesomeIcon icon={isExpanded ? faChevronDown : faChevronRight} className="text-slate-400" />
                                    <div className="p-2 bg-white rounded-lg border border-slate-200 text-emerald-600">
                                        <FontAwesomeIcon icon={faMapMarkerAlt} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-800">{site.name}</h3>
                                        <p className="text-xs text-slate-500">{site.address}</p>
                                    </div>
                                </div>
                                {responsibleTeam && (
                                    <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded">
                                        담당: {responsibleTeam.name}
                                    </span>
                                )}
                            </div>
                            {isExpanded && (
                                <div className="p-4 bg-slate-50/50 space-y-2">
                                    {responsibleTeam ? (
                                        renderTeamNode(responsibleTeam)
                                    ) : (
                                        <div className="text-sm text-slate-400 p-4 text-center">담당 팀이 지정되지 않았습니다.</div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    };

    const renderLogicView = () => {
        return (
            <div className="space-y-8">
                {/* Logic Card: Salary Model Resolution */}
                <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
                    <div className="p-4 bg-slate-800 text-white flex items-center justify-between">
                        <h3 className="font-bold text-lg flex items-center gap-2">
                            <FontAwesomeIcon icon={faProjectDiagram} className="text-yellow-400" />
                            급여방식 판단 로직 (Salary Model Reasoning)
                        </h3>
                        <span className="text-xs bg-slate-700 px-2 py-1 rounded text-slate-300">Updated: Today</span>
                    </div>
                    <div className="p-8 bg-slate-50 min-h-[400px] flex justify-center">
                        <div className="flex flex-col items-center relative gap-8 w-full max-w-2xl">

                            {/* Start Node */}
                            <div className="bg-green-100 border-2 border-green-500 text-green-800 px-6 py-3 rounded-full font-bold shadow-sm z-10 flex items-col items-center gap-2">
                                <span className="text-xs uppercase tracking-wider text-green-600">Trigger</span>
                                인원 내역 조회
                            </div>

                            {/* Arrow Down */}
                            <FontAwesomeIcon icon={faArrowDown} className="text-slate-300 text-xl" />

                            {/* Process Node */}
                            <div className="bg-white border-2 border-blue-200 text-slate-700 px-8 py-4 rounded-lg shadow-sm w-64 text-center z-10 relative">
                                <div className="text-xs text-blue-500 font-bold mb-1">Step 1</div>
                                <div className="font-bold">데이터 확인</div>
                                <div className="text-xs text-slate-400 mt-1 font-mono">Check: worker.salaryModel</div>
                            </div>

                            {/* Arrow Down */}
                            <FontAwesomeIcon icon={faArrowDown} className="text-slate-300 text-xl" />

                            {/* Decision Diamond */}
                            <div className="bg-amber-50 border-2 border-amber-400 text-amber-800 w-48 h-48 rounded-full flex flex-col items-center justify-center shadow-sm z-10 text-center relative aspect-square rotate-45 transform scale-75 origin-center">
                                <div className="-rotate-45 flex flex-col items-center">
                                    <div className="text-xs font-bold text-amber-600 mb-1">Decision 1</div>
                                    <div className="font-bold leading-tight">값이 있는가?<br /><span className="text-xs opacity-75">(salaryModel?)</span></div>
                                </div>
                            </div>

                            {/* Logic Branches container */}
                            <div className="absolute top-[320px] w-full flex justify-between px-10 h-64 pointer-events-none">
                                {/* YES Branch (Left) */}
                                <div className="flex-1 flex flex-col items-start relative pointer-events-auto">
                                    {/* Connector Line */}
                                    <div className="absolute top-[-40px] right-1/2 w-[55%] h-[60px] border-l-2 border-b-2 border-slate-300 rounded-bl-3xl -translate-y-full transform -translate-x-[2px]"></div>
                                    <div className="absolute top-[-60px] left-[0%] bg-white px-2 text-xs font-bold text-green-600 z-20">YES</div>

                                    {/* Result Node */}
                                    <div className="mt-8 bg-blue-600 text-white px-6 py-4 rounded-lg shadow-md w-48 text-center ml-4">
                                        <div className="font-bold mb-1"><FontAwesomeIcon icon={faCheck} className="mr-2" />값 사용</div>
                                        <div className="text-xs opacity-75">기존 salaryModel 적용</div>
                                    </div>
                                </div>

                                {/* NO Branch (Right) */}
                                <div className="flex-1 flex flex-col items-end relative pointer-events-auto">
                                    {/* Connector Line */}
                                    <div className="absolute top-[-40px] left-1/2 w-[55%] h-[60px] border-r-2 border-b-2 border-slate-300 rounded-br-3xl -translate-y-full transform translate-x-[2px]"></div>
                                    <div className="absolute top-[-60px] right-[0%] bg-white px-2 text-xs font-bold text-red-500 z-20">NO</div>

                                    {/* Sub Process: Check Team Type */}
                                    <div className="mt-8 flex flex-col items-center w-full max-w-[280px]">
                                        <div className="bg-white border-2 border-purple-200 text-slate-700 px-6 py-3 rounded-lg shadow-sm w-full text-center mb-6 relative">
                                            <div className="text-xs text-purple-500 font-bold mb-1">Step 2</div>
                                            <div className="font-bold">팀 유형 확인 (Team Type)</div>
                                            <div className="text-xs text-slate-400 mt-1 font-mono">Check: worker.teamType</div>
                                            <FontAwesomeIcon icon={faArrowDown} className="text-slate-300 absolute -bottom-8 left-1/2 -translate-x-1/2" />
                                        </div>

                                        {/* Decision 2 */}
                                        <div className="bg-amber-50 border-2 border-amber-400 text-amber-800 w-40 h-40 rounded-sm rotate-45 flex flex-col items-center justify-center shadow-sm z-10 text-center relative mt-4">
                                            <div className="-rotate-45 flex flex-col items-center">
                                                <div className="font-bold text-sm leading-tight">지원/용역팀<br />인가?</div>
                                            </div>
                                        </div>

                                        {/* Final Outcomes */}
                                        <div className="flex gap-4 mt-12 w-full justify-center relative">
                                            {/* Yes -> Support/Service */}
                                            <div className="flex flex-col items-center relative">
                                                <div className="absolute -top-10 h-10 border-l-2 border-slate-300"></div>
                                                <div className="bg-purple-600 text-white px-4 py-3 rounded-lg shadow-md w-32 text-center text-sm">
                                                    <div className="font-bold mb-1">매핑 적용</div>
                                                    <div className="text-[10px] opacity-80">지원팀/용역팀으로<br />데이터 보정</div>
                                                </div>
                                                <div className="absolute -top-12 bg-white text-[10px] font-bold text-green-600 px-1">YES</div>
                                            </div>

                                            {/* No -> Daily */}
                                            <div className="flex flex-col items-center relative">
                                                <div className="absolute -top-10 h-10 border-l-2 border-slate-300"></div>
                                                <div className="bg-slate-500 text-white px-4 py-3 rounded-lg shadow-md w-32 text-center text-sm">
                                                    <div className="font-bold mb-1">기본값 적용</div>
                                                    <div className="text-[10px] opacity-80">'일급제'로 설정<br />(Fallback)</div>
                                                </div>
                                                <div className="absolute -top-12 bg-white text-[10px] font-bold text-red-500 px-1">NO</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderAiView = () => {
        return (
            <div className="space-y-8">
                <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
                    <div className="p-4 bg-gradient-to-r from-indigo-900 to-purple-900 text-white flex items-center justify-between">
                        <h3 className="font-bold text-lg flex items-center gap-2">
                            <FontAwesomeIcon icon={faRobot} className="text-cyan-400" />
                            AI 통합 구조도 (Artificial Intelligence Architecture)
                        </h3>
                        <span className="text-xs bg-white/10 px-2 py-1 rounded text-cyan-200">Powered by Gemini 1.5 Flash</span>
                    </div>
                    <div className="p-12 bg-slate-50 min-h-[500px] flex justify-center items-center">
                        <div className="relative w-full max-w-4xl flex flex-col items-center gap-16">

                            {/* Central Brain Node */}
                            <div className="relative z-20">
                                <div className="w-48 h-48 bg-white rounded-full shadow-[0_0_40px_rgba(139,92,246,0.3)] flex flex-col items-center justify-center border-4 border-indigo-500 relative z-20 animate-pulse-slow">
                                    <div className="text-4xl text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-purple-600 mb-2">
                                        <FontAwesomeIcon icon={faRobot} />
                                    </div>
                                    <h2 className="text-xl font-bold text-slate-800">Gemini AI</h2>
                                    <p className="text-xs text-slate-500 font-mono mt-1">1.5 Flash Model</p>
                                </div>
                                {/* Connecting Rings */}
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 border border-indigo-200 rounded-full animate-spin-slow z-10 opacity-50"></div>
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 border border-purple-100 rounded-full animate-reverse-spin-slow z-0 opacity-30"></div>
                            </div>

                            {/* Left/Right Container */}
                            <div className="flex justify-between w-full relative -mt-32 pt-32">

                                {/* Left Branch: Vision (OCR) */}
                                <div className="flex-1 flex flex-col items-center relative group">
                                    {/* Connection Line */}
                                    <div className="absolute top-0 right-1/2 w-1/2 h-24 border-t-2 border-l-2 border-indigo-300 rounded-tl-3xl translate-y-[-50px]"></div>

                                    {/* Input Node */}
                                    <div className="bg-white border text-center p-4 rounded-xl shadow-sm w-48 relative z-20 mb-8 border-l-4 border-l-blue-500">
                                        <div className="text-blue-500 text-2xl mb-2"><FontAwesomeIcon icon={faIdCard} /></div>
                                        <div className="font-bold text-slate-700">신분증 이미지</div>
                                        <div className="text-xs text-slate-400">Worker Registration</div>
                                    </div>

                                    {/* Arrow */}
                                    <FontAwesomeIcon icon={faArrowDown} className="text-slate-300 text-xl mb-8" />

                                    {/* Action Node */}
                                    <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-xl text-center w-56 relative z-20 mb-8">
                                        <div className="text-xs font-bold text-indigo-500 uppercase tracking-widest mb-1">Vision Analysis</div>
                                        <div className="font-bold text-slate-700">OCR & Data Extraction</div>
                                        <div className="text-xs text-slate-500 mt-1">이름, 주민번호, 주소 추출</div>
                                    </div>

                                    {/* Arrow */}
                                    <FontAwesomeIcon icon={faArrowDown} className="text-slate-300 text-xl mb-8" />

                                    {/* Result Node */}
                                    <div className="bg-green-50 border border-green-200 p-3 rounded-lg flex items-center gap-3 w-48 shadow-sm">
                                        <div className="bg-green-500 text-white w-8 h-8 rounded flex items-center justify-center"><FontAwesomeIcon icon={faDatabase} /></div>
                                        <div className="text-sm font-bold text-green-800">자동 입력 완료</div>
                                    </div>
                                </div>

                                {/* Right Branch: NLP (Report) */}
                                <div className="flex-1 flex flex-col items-center relative group">
                                    {/* Connection Line */}
                                    <div className="absolute top-0 left-1/2 w-1/2 h-24 border-t-2 border-r-2 border-purple-300 rounded-tr-3xl translate-y-[-50px]"></div>

                                    {/* Input Node */}
                                    <div className="bg-white border text-center p-4 rounded-xl shadow-sm w-48 relative z-20 mb-8 border-l-4 border-l-purple-500">
                                        <div className="text-purple-500 text-2xl mb-2"><FontAwesomeIcon icon={faCommentDots} /></div>
                                        <div className="font-bold text-slate-700">작업 내용 (텍스트)</div>
                                        <div className="text-xs text-slate-400">Daily Report Typing</div>
                                    </div>

                                    {/* Arrow */}
                                    <FontAwesomeIcon icon={faArrowDown} className="text-slate-300 text-xl mb-8" />

                                    {/* Action Node */}
                                    <div className="bg-purple-50 border border-purple-200 p-4 rounded-xl text-center w-56 relative z-20 mb-8">
                                        <div className="text-xs font-bold text-purple-500 uppercase tracking-widest mb-1">NLP Parsing</div>
                                        <div className="font-bold text-slate-700">Context Understanding</div>
                                        <div className="text-xs text-slate-500 mt-1">인원, 공수, 작업내용 구조화</div>
                                    </div>

                                    {/* Arrow */}
                                    <FontAwesomeIcon icon={faArrowDown} className="text-slate-300 text-xl mb-8" />

                                    {/* Result Node */}
                                    <div className="bg-green-50 border border-green-200 p-3 rounded-lg flex items-center gap-3 w-48 shadow-sm">
                                        <div className="bg-green-500 text-white w-8 h-8 rounded flex items-center justify-center"><FontAwesomeIcon icon={faDatabase} /></div>
                                        <div className="text-sm font-bold text-green-800">일보 자동 생성</div>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full bg-slate-50">
            <div className="bg-white border-b border-slate-200 p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <FontAwesomeIcon icon={faSitemap} className="text-indigo-600" />
                    조직도 (Structure Map)
                </h2>
                <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
                    <button
                        onClick={() => setViewMode('team')}
                        className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${viewMode === 'team' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <FontAwesomeIcon icon={faUsers} className="mr-2" />
                        팀 기준
                    </button>
                    <button
                        onClick={() => setViewMode('company')}
                        className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${viewMode === 'company' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <FontAwesomeIcon icon={faBuilding} className="mr-2" />
                        회사별 보기
                    </button>
                    <button
                        onClick={() => setViewMode('site')}
                        className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${viewMode === 'site' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <FontAwesomeIcon icon={faMapMarkerAlt} className="mr-2" />
                        현장별 보기
                    </button>
                    <button
                        onClick={() => setViewMode('logic')}
                        className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${viewMode === 'logic' ? 'bg-white text-slate-800 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <FontAwesomeIcon icon={faProjectDiagram} className="mr-2" />
                        로직 기록
                    </button>
                    <button
                        onClick={() => setViewMode('ai')}
                        className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${viewMode === 'ai' ? 'bg-white text-indigo-900 shadow-sm ring-1 ring-indigo-200' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <FontAwesomeIcon icon={faRobot} className="mr-2" />
                        AI 구조도
                    </button>
                    <button
                        onClick={() => setViewMode('d3tree')}
                        className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${viewMode === 'd3tree' ? 'bg-white text-cyan-600 shadow-sm ring-1 ring-cyan-200' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <FontAwesomeIcon icon={faDiagramProject} className="mr-2" />
                        트리 조직도
                    </button>
                    <button
                        onClick={() => setViewMode('radial')}
                        className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${viewMode === 'radial' ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg ring-2 ring-violet-300' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <FontAwesomeIcon icon={faDiagramProject} className="mr-2" />
                        방사형 🌐
                    </button>
                    <button
                        onClick={() => setViewMode('premium')}
                        className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${viewMode === 'premium' ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg ring-2 ring-purple-300' : 'text-slate-500 hover:text-slate-700 bg-gradient-to-r from-purple-100 to-blue-100'}`}
                    >
                        <FontAwesomeIcon icon={faCrown} className="mr-2" />
                        프리미엄 ✨
                    </button>
                </div>
            </div>

            <div className="p-4 border-b border-slate-200 bg-white">
                <div className="relative max-w-md mx-auto">
                    <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="이름, 팀명, 회사명 검색..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                </div>
            </div>

            {/* Premium chart rendered outside the max-w-5xl container */}
            {viewMode === 'premium' && (
                <div className="fixed inset-0 z-40">
                    <PremiumOrgChart />
                </div>
            )}

            <div className="flex-1 overflow-y-auto p-6 max-w-5xl mx-auto w-full">
                {loading ? (
                    <div className="text-center py-20 text-slate-500">
                        <FontAwesomeIcon icon={faSitemap} spin className="text-4xl mb-4 text-indigo-200" />
                        <p>조직도를 불러오는 중입니다...</p>
                    </div>
                ) : (
                    <>
                        {viewMode === 'team' && renderTeamView()}
                        {viewMode === 'company' && renderCompanyView()}
                        {viewMode === 'site' && renderSiteView()}
                        {viewMode === 'logic' && renderLogicView()}
                        {viewMode === 'ai' && renderAiView()}
                        {viewMode === 'd3tree' && (
                            <div className="w-full" style={{ maxWidth: '100%' }}>
                                <D3TreeOrgChart data={treeData} width={1400} height={700} />
                            </div>
                        )}
                        {viewMode === 'radial' && (
                            <div className="w-full flex justify-center" style={{ maxWidth: '100%' }}>
                                <D3RadialOrgChart data={treeData} width={1000} height={800} />
                            </div>
                        )}
                    </>
                )}
            </div>
        </div >
    );
};



export default OrganizationChartPage;
