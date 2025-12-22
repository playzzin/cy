import React, { useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faSearch, faPenToSquare, faPlus, faTable, faTrash, faPalette,
    faChevronDown, faChevronRight, faHardHat, faBuilding, faUsers, faTimes,
    faUserGear, faUserShield, faUser
} from '@fortawesome/free-solid-svg-icons';
import { teamService, Team } from '../../services/teamService';
import { manpowerService, Worker } from '../../services/manpowerService';
import { siteService, Site } from '../../services/siteService';
import { companyService, Company } from '../../services/companyService';
import { statisticsService } from '../../services/statisticsService';
import TeamForm from '../../components/manpower/TeamForm';
import { Timestamp } from 'firebase/firestore';
import MultiSelectPopover from '../../components/common/MultiSelectPopover';
import SingleSelectPopover from '../../components/common/SingleSelectPopover';
import { useColumnSettings } from '../../hooks/useColumnSettings';
import { positionService, Position } from '../../services/positionService';
import { getIcon } from '../../utils/iconMapper';

// 직책별 아이콘 매핑 (positions DB 기반)
const getPositionIcon = (role: string | undefined, positions: Position[]) => {
    if (!role) return faUser;
    const pos = positions.find(p => p.name === role);
    if (pos?.iconKey) {
        return getIcon(pos.iconKey);
    }
    // 폴백: 기본 매핑
    if (role.includes('사장') || role.includes('대표')) return faUserShield;
    if (role.includes('팀장') || role.includes('반장')) return faUserGear;
    return faUser;
};

const TEAM_COLUMNS = [
    { key: 'name', label: '팀명' },
    { key: 'status', label: '상태' },
    { key: 'leaderName', label: '팀장' },
    { key: 'companyName', label: '소속사' },
    { key: 'siteCount', label: '배정 현장' },
    { key: 'memberCount', label: '팀원' },
    { key: 'totalManDay', label: '누적공수' }
];

interface TeamDatabaseProps {
    hideHeader?: boolean;
    highlightedId?: string | null;
}

const TeamDatabase: React.FC<TeamDatabaseProps> = ({ hideHeader = false, highlightedId }) => {
    const [teams, setTeams] = useState<Team[]>([]);
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [sites, setSites] = useState<Site[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [positions, setPositions] = useState<Position[]>([]);
    const [teamStats, setTeamStats] = useState<{ [id: string]: number }>({});
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [showInactive, setShowInactive] = useState(false);

    // Highlight scroll control
    const highlightScrolledRef = useRef(false);
    const lastHighlightIdRef = useRef<string | null>(null);
    const partnerColorInputRef = useRef<HTMLInputElement>(null);
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Selection & Edit State
    const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
    const [expandedTeamIds, setExpandedTeamIds] = useState<string[]>([]);
    const [isEditMode, setIsEditMode] = useState(false);
    const [showTeamModal, setShowTeamModal] = useState(false);
    const [editingTeam, setEditingTeam] = useState<Team | null>(null);

    // Column Settings Hook
    const {
        visibleColumns,
        toggleColumn,
        showColumnSettings,
        setShowColumnSettings
    } = useColumnSettings('team_db', TEAM_COLUMNS);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [teamsData, workersData, sitesData, companiesData, statsData, positionsData] = await Promise.all([
                teamService.getTeams(),
                manpowerService.getWorkers(),
                siteService.getSites(),
                companyService.getCompanies(),
                statisticsService.getCumulativeManpower(),
                positionService.getPositions()
            ]);
            setTeams(teamsData);
            setWorkers(workersData);
            setSites(sitesData);
            setCompanies(companiesData);
            setTeamStats(statsData.teamStats);
            setPositions(positionsData);
        } catch (error) {
            console.error("Failed to load team data:", error);
        } finally {
            setLoading(false);
        }
    };

    const renderCellValue = (team: Team, column: any) => {
        if (column.key === 'totalManDay') {
            const gongsu = teamStats[team.id!] || 0;
            return (
                <span className="font-bold text-blue-600">
                    {gongsu.toFixed(1)}공수
                </span>
            );
        }

        const value = team[column.key as keyof Team];
        if (value === undefined || value === null) return '';
        if (typeof value === 'object' && 'toDate' in value) {
            return (value as any).toDate().toLocaleDateString();
        }
        if (typeof value === 'object') return JSON.stringify(value);
        return String(value);
    };

    const toggleSelectAll = () => {
        if (selectedTeamIds.length === teams.length) setSelectedTeamIds([]);
        else setSelectedTeamIds(teams.map(t => t.id!).filter(Boolean));
    };

    const toggleSelect = (id: string) => {
        setSelectedTeamIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const toggleTeamExpand = (id: string) => {
        setExpandedTeamIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const handleBulkDelete = async () => {
        if (selectedTeamIds.length === 0) return;
        if (!window.confirm(`${selectedTeamIds.length}개의 팀을 삭제 하시겠습니까?`)) return;

        try {
            setLoading(true);
            await Promise.all(selectedTeamIds.map(id => teamService.deleteTeam(id)));
            await loadData();
            setSelectedTeamIds([]);
            alert('삭제되었습니다.');
        } catch (error) {
            console.error("Bulk delete failed:", error);
            alert('삭제 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const handleTeamChange = (id: string, field: keyof Team, value: any) => {
        setTeams(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
    };

    const handleTeamBlur = async (id: string, field: keyof Team, value: any) => {
        try {
            await teamService.updateTeam(id, { [field]: value });
            if (field === 'name') {
                await manpowerService.updateWorkersTeamName(id, value);
            }
        } catch (error) {
            console.error("Failed to update team", error);
            loadData();
        }
    };

    const handleTeamSelectChange = async (id: string, updates: Partial<Team>) => {
        setTeams(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
        try {
            await teamService.updateTeam(id, updates);
        } catch (error) {
            console.error("Failed to update team select", error);
            loadData();
        }
    };

    const handleTeamSiteSelect = async (id: string, selectedIds: string[]) => {
        const targetTeam = teams.find(t => t.id === id);
        if (!targetTeam) return;

        const currentAssignedSites = sites.filter(s => s.responsibleTeamId === id);
        const currentSiteIds = currentAssignedSites.map(s => s.id!);
        const addedIds = selectedIds.filter(sid => !currentSiteIds.includes(sid));
        const removedIds = currentSiteIds.filter(cid => !selectedIds.includes(cid));
        const selectedNames = sites.filter(s => selectedIds.includes(s.id!)).map(s => s.name);

        setSites(prev => prev.map(s => {
            if (addedIds.includes(s.id!)) return { ...s, responsibleTeamId: id, responsibleTeamName: targetTeam.name };
            if (removedIds.includes(s.id!)) return { ...s, responsibleTeamId: undefined, responsibleTeamName: undefined };
            return s;
        }));

        setTeams(prev => prev.map(t => t.id === id ? { ...t, siteIds: selectedIds, siteNames: selectedNames, assignedSiteId: selectedIds[0] || '' } : t));

        try {
            if (addedIds.length > 0) {
                await siteService.updateSitesBatch(addedIds, { responsibleTeamId: id, responsibleTeamName: targetTeam.name });
            }
            if (removedIds.length > 0) {
                await siteService.updateSitesBatch(removedIds, { responsibleTeamId: null as any, responsibleTeamName: null as any });
            }
            await teamService.updateTeam(id, {
                siteIds: selectedIds,
                siteNames: selectedNames,
                assignedSiteId: selectedIds.length > 0 ? selectedIds[0] : '',
                assignedSiteName: selectedNames.length > 0 ? selectedNames[0] + (selectedNames.length > 1 ? ` 외 ${selectedNames.length - 1}곳` : '') : ''
            });
        } catch (error) {
            console.error("Failed to update team sites", error);
            loadData();
        }
    };

    const handleTeamMemberSelect = async (id: string, selectedIds: string[]) => {
        const targetTeam = teams.find(t => t.id === id);
        if (!targetTeam) return;

        const currentMembers = workers.filter(w => w.teamId === id);
        const currentMemberIds = currentMembers.map(w => w.id!);
        const addedIds = selectedIds.filter(sid => !currentMemberIds.includes(sid));
        const removedIds = currentMemberIds.filter(cid => !selectedIds.includes(cid));
        const selectedNames = workers.filter(w => selectedIds.includes(w.id!)).map(w => w.name);

        setWorkers(prev => prev.map(w => {
            if (addedIds.includes(w.id!)) return { ...w, teamId: id, teamName: targetTeam.name };
            if (removedIds.includes(w.id!)) return { ...w, teamId: undefined, teamName: undefined };
            return w;
        }));

        setTeams(prev => prev.map(t => t.id === id ? { ...t, memberIds: selectedIds, memberNames: selectedNames, memberCount: selectedIds.length } : t));

        try {
            if (addedIds.length > 0) {
                await manpowerService.updateWorkersBatch(addedIds, { teamId: id, teamName: targetTeam.name });
            }
            if (removedIds.length > 0) {
                await manpowerService.updateWorkersBatch(removedIds, { teamId: null as any, teamName: null as any });
            }
            await teamService.updateTeam(id, {
                memberIds: selectedIds,
                memberNames: selectedNames,
                memberCount: selectedIds.length,
                assignedWorkers: selectedIds
            });
        } catch (error) {
            console.error("Failed to update team members", error);
            loadData();
        }
    };

    const handleTeamSave = async () => {
        await loadData();
        setShowTeamModal(false);
        setEditingTeam(null);
        alert('팀 정보가 저장되었습니다.');
    };

    const handleLeaderUpdate = async (teamId: string, leaderId: string) => {
        try {
            const currentTeam = teams.find(t => t.id === teamId);
            const oldLeaderId = currentTeam?.leaderId;
            const selectedWorker = workers.find(w => w.id === leaderId);
            const leaderName = selectedWorker ? selectedWorker.name : '';

            setTeams(prev => prev.map(t =>
                t.id === teamId ? { ...t, leaderId, leaderName } : t
            ));

            // 1. Team Update
            await teamService.updateTeam(teamId, { leaderId, leaderName });

            // 2. Worker Role Update
            // New Leader -> 팀장
            if (leaderId) {
                await manpowerService.updateWorker(leaderId, { role: '팀장' });
            }
            // Old Leader -> 팀원 (if exists and different from new leader)
            if (oldLeaderId && oldLeaderId !== leaderId) {
                await manpowerService.updateWorker(oldLeaderId, { role: '팀원' });
            }

            // 3. Update local workers state to reflect role changes immediately
            setWorkers(prev => prev.map(w => {
                if (w.id === leaderId) return { ...w, role: '팀장' };
                if (w.id === oldLeaderId && oldLeaderId !== leaderId) return { ...w, role: '팀원' };
                return w;
            }));

        } catch (error) {
            console.error("Failed to update leader", error);
            loadData();
        }
    };

    const filteredTeams = teams.filter(team => {
        if (!showInactive && (team.status === 'waiting' || team.status === 'closed')) return false;
        if (searchTerm) {
            const searchLower = searchTerm.toLowerCase();
            return (
                team.name.toLowerCase().includes(searchLower) ||
                team.leaderName?.toLowerCase().includes(searchLower) ||
                team.companyName?.toLowerCase().includes(searchLower)
            );
        }
        return true;
    });

    const companyOptions = companies.filter(c => c.type === '시공사' || c.type === '협력사');

    return (
        <div className="flex flex-col h-full bg-slate-50">
            {!hideHeader && (
                <>
                    <div className="flex justify-between items-center p-6 border-b border-slate-200 bg-white">
                        <h1 className="text-2xl font-bold text-slate-800">팀 관리</h1>
                        <div className="flex gap-2">
                            <button onClick={() => setShowColumnSettings(true)} className="p-2 text-slate-500 hover:text-slate-700 bg-white border border-slate-200 rounded">
                                <FontAwesomeIcon icon={faTable} />
                            </button>
                            <button onClick={() => { setEditingTeam(null); setShowTeamModal(true); }} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded flex items-center gap-2">
                                <FontAwesomeIcon icon={faPlus} />
                                <span>팀 등록</span>
                            </button>
                        </div>
                    </div>
                    <div className="p-6 bg-white border-b border-slate-200 flex flex-wrap gap-4 items-center">
                        <div className="relative">
                            <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="팀명, 팀장, 소속사 검색"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 pr-4 py-2 border border-slate-200 rounded w-64 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={showInactive}
                                    onChange={(e) => setShowInactive(e.target.checked)}
                                    className="rounded text-indigo-600 focus:ring-indigo-500"
                                />
                                <span className="text-sm text-slate-600">폐업/대기 포함</span>
                            </label>
                        </div>
                        <div className="flex-1" />
                        <div className="flex gap-2">
                            {selectedTeamIds.length > 0 && (
                                <button onClick={handleBulkDelete} className="px-3 py-1.5 rounded text-sm font-medium bg-red-50 text-red-600 hover:bg-red-100 border border-red-200">
                                    <FontAwesomeIcon icon={faTrash} className="mr-1" /> 삭제 ({selectedTeamIds.length})
                                </button>
                            )}
                            <button onClick={() => setIsEditMode(!isEditMode)} className={`px-3 py-1.5 rounded text-sm font-medium border ${isEditMode ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                                {isEditMode ? '편집 종료' : '편집 모드'}
                            </button>
                        </div>
                    </div>
                </>
            )}

            <div className={`flex-1 overflow-auto ${!hideHeader ? 'p-6 pb-[400px]' : 'pb-[400px]'}`}>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-slate-500">
                        <thead className="text-xs text-slate-700 uppercase bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-3 w-4">
                                    <input
                                        type="checkbox"
                                        checked={teams.length > 0 && selectedTeamIds.length === teams.length}
                                        onChange={toggleSelectAll}
                                        className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                                    />
                                </th>
                                <th className="px-2 py-3 w-8"></th>
                                {TEAM_COLUMNS.filter(col => visibleColumns.includes(col.key)).map(col => (
                                    <th key={col.key} className="px-6 py-3 font-semibold">{col.label}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredTeams.length > 0 ? (
                                filteredTeams.map((team) => {
                                    const isHighlighted = team.id === highlightedId;
                                    const teamCompany = team.companyId ? companies.find(c => c.id === team.companyId) : undefined;
                                    const assignedSites = sites.filter(s => s.responsibleTeamId === team.id);

                                    return (
                                        <React.Fragment key={team.id}>
                                            <tr
                                                onClick={() => toggleSelect(team.id!)}
                                                className={`transition-colors border-b cursor-pointer
                                                    ${isHighlighted ? 'bg-red-50 border border-red-300 ring-1 ring-red-300 z-10 relative' :
                                                        expandedTeamIds.includes(team.id!) ? 'bg-slate-50' :
                                                            selectedTeamIds.includes(team.id!) ? 'bg-indigo-50/50' :
                                                                'bg-white hover:bg-slate-50'} 
                                                    ${!isHighlighted && (team.status === 'waiting' || team.status === 'closed') ? 'opacity-75 bg-slate-50' : ''}
                                                `}
                                                ref={isHighlighted
                                                    ? (el) => {
                                                        if (!el) return;
                                                        const currentId = highlightedId || null;
                                                        if (lastHighlightIdRef.current !== currentId) {
                                                            lastHighlightIdRef.current = currentId;
                                                            highlightScrolledRef.current = false;
                                                        }
                                                        if (!highlightScrolledRef.current) {
                                                            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                            highlightScrolledRef.current = true;
                                                        }
                                                    }
                                                    : null}
                                            >
                                                <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedTeamIds.includes(team.id!)}
                                                        onChange={() => toggleSelect(team.id!)}
                                                        className="rounded text-indigo-600 focus:ring-indigo-500"
                                                    />
                                                </td>
                                                <td className="px-2 py-4 text-center cursor-pointer" onClick={() => toggleTeamExpand(team.id!)}>
                                                    <FontAwesomeIcon
                                                        icon={expandedTeamIds.includes(team.id!) ? faChevronDown : faChevronRight}
                                                        className="text-slate-400 hover:text-indigo-600 transition-colors"
                                                    />
                                                </td>
                                                {TEAM_COLUMNS.filter(col => visibleColumns.includes(col.key)).map(col => (
                                                    <td key={`${team.id}-${col.key}`} className="px-6 py-4">
                                                        {isEditMode && team.id ? (
                                                            col.key === 'totalManDay' ? (
                                                                <span className="font-bold text-blue-600">
                                                                    {(teamStats[team.id!] || 0).toFixed(1)}공수
                                                                </span>
                                                            ) : col.key === 'status' ? (
                                                                <select
                                                                    value={team.status || 'active'}
                                                                    onChange={(e) => team.id && handleTeamChange(team.id, 'status', e.target.value)}
                                                                    onBlur={(e) => team.id && handleTeamBlur(team.id, 'status', e.target.value)}
                                                                    className="border rounded px-2 py-1 w-full text-sm"
                                                                >
                                                                    <option value="active">협업중</option>
                                                                    <option value="waiting">대기</option>
                                                                    <option value="closed">폐업</option>
                                                                </select>
                                                            ) : col.key === 'leaderName' ? (
                                                                <SingleSelectPopover
                                                                    options={workers.sort((a, b) => a.name.localeCompare(b.name)).map(w => ({
                                                                        id: w.id!,
                                                                        name: w.name,
                                                                        icon: <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500">{w.name[0]}</div>
                                                                    }))}
                                                                    selectedId={team.leaderId || null}
                                                                    onSelect={(id: string) => handleLeaderUpdate(team.id!, id)}
                                                                    placeholder="팀장 선택"
                                                                    renderSelected={(opt: any) => {
                                                                        const leaderWorker = workers.find(w => w.id === team.leaderId);
                                                                        const leaderPosition = positions.find(p => p.name === leaderWorker?.role);
                                                                        const posColor = leaderPosition?.color || 'blue';
                                                                        const colorClass = {
                                                                            red: 'bg-red-500', orange: 'bg-orange-500', yellow: 'bg-yellow-500',
                                                                            green: 'bg-emerald-500', blue: 'bg-blue-500', indigo: 'bg-indigo-500',
                                                                            purple: 'bg-purple-500', pink: 'bg-pink-500', gray: 'bg-slate-500',
                                                                            slate: 'bg-slate-500', black: 'bg-slate-900',
                                                                        }[posColor] || 'bg-blue-500';
                                                                        return (
                                                                            <div className="flex items-center gap-2">
                                                                                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-md ${colorClass}`}>
                                                                                    <FontAwesomeIcon icon={getPositionIcon(leaderWorker?.role, positions)} className="text-white text-xs" />
                                                                                </span>
                                                                                <span className="font-medium text-slate-700">{opt.name}</span>
                                                                            </div>
                                                                        );
                                                                    }}
                                                                />
                                                            ) : col.key === 'companyName' ? (
                                                                <select
                                                                    value={team.companyId || ''}
                                                                    onChange={(e) => {
                                                                        const selectedCompany = companies.find(c => c.id === e.target.value);
                                                                        if (team.id) {
                                                                            handleTeamSelectChange(team.id, {
                                                                                companyId: e.target.value,
                                                                                companyName: selectedCompany ? selectedCompany.name : ''
                                                                            });
                                                                        }
                                                                    }}
                                                                    className="border rounded px-2 py-1 w-full text-sm"
                                                                >
                                                                    <option value="">미소속</option>
                                                                    {companyOptions.map(company => (
                                                                        <option key={company.id} value={company.id}>{company.name}</option>
                                                                    ))}
                                                                </select>
                                                            ) : col.key === 'siteCount' ? (
                                                                <MultiSelectPopover
                                                                    options={sites.map(s => ({ ...s, id: s.id || '' }))}
                                                                    selectedIds={assignedSites.map(s => s.id!)}
                                                                    placeholder={`${assignedSites.length}개 담당`}
                                                                    onSelect={(id) => {
                                                                        const currentIds = assignedSites.map(s => s.id!);
                                                                        const newIds = currentIds.includes(id)
                                                                            ? currentIds.filter(x => x !== id)
                                                                            : [...currentIds, id];
                                                                        if (team.id) handleTeamSiteSelect(team.id, newIds);
                                                                    }}
                                                                    onSelectAll={() => {
                                                                        const currentLen = assignedSites.length;
                                                                        const totalLen = sites.length;
                                                                        if (currentLen === totalLen) {
                                                                            if (team.id) handleTeamSiteSelect(team.id, []);
                                                                        } else {
                                                                            const allIds = sites.map(s => s.id || '').filter(Boolean);
                                                                            if (team.id) handleTeamSiteSelect(team.id, allIds);
                                                                        }
                                                                    }}
                                                                />
                                                            ) : col.key === 'memberCount' ? (
                                                                <MultiSelectPopover
                                                                    options={workers.map(w => ({ ...w, id: w.id || '' }))}
                                                                    selectedIds={team.memberIds || []}
                                                                    placeholder={`${(team.memberIds || []).length}명`}
                                                                    onSelect={(id) => {
                                                                        const current = team.memberIds || [];
                                                                        const newIds = current.includes(id) ? current.filter(x => x !== id) : [...current, id];
                                                                        if (team.id) handleTeamMemberSelect(team.id, newIds);
                                                                    }}
                                                                    onSelectAll={() => {
                                                                        const newIds: string[] = [];
                                                                        if (team.id) handleTeamMemberSelect(team.id, newIds);
                                                                    }}
                                                                />
                                                            ) : col.key === 'name' ? (
                                                                <div className="flex items-center gap-2">
                                                                    <input
                                                                        type="color"
                                                                        value={team.color || '#2563eb'}
                                                                        onChange={(e) => team.id && handleTeamChange(team.id, 'color', e.target.value)}
                                                                        onBlur={(e) => team.id && handleTeamBlur(team.id, 'color', e.target.value)}
                                                                        className="h-8 w-8 rounded border border-slate-300 cursor-pointer"
                                                                    />
                                                                    <input
                                                                        type="text"
                                                                        value={team.name || ''}
                                                                        onChange={(e) => team.id && handleTeamChange(team.id, 'name', e.target.value)}
                                                                        onBlur={(e) => team.id && handleTeamBlur(team.id, 'name', e.target.value)}
                                                                        className="flex-1 border rounded px-2 py-1 w-full text-sm"
                                                                    />
                                                                </div>
                                                            ) : (
                                                                <input
                                                                    type="text"
                                                                    value={String(team[col.key as keyof Team] || '')}
                                                                    onChange={(e) => team.id && handleTeamChange(team.id, col.key as keyof Team, e.target.value)}
                                                                    onBlur={(e) => team.id && handleTeamBlur(team.id, col.key as keyof Team, e.target.value)}
                                                                    className="border rounded px-2 py-1 w-full text-sm"
                                                                />
                                                            )
                                                        ) : (
                                                            col.key === 'name' ? (
                                                                <div className="flex items-center gap-2">
                                                                    <span
                                                                        className="inline-flex items-center justify-center w-7 h-7 rounded-full border border-slate-200 flex-shrink-0"
                                                                        style={{ backgroundColor: team.color || '#e5e7eb' }}
                                                                    >
                                                                        <FontAwesomeIcon icon={faUsers} className="text-white text-xs" />
                                                                    </span>
                                                                    <span>{team.name}</span>
                                                                </div>
                                                            ) : col.key === 'totalManDay' ? (
                                                                <span className="font-bold text-blue-600">
                                                                    {(teamStats[team.id!] || 0).toFixed(1)}공수
                                                                </span>
                                                            ) : col.key === 'status' ? (
                                                                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${team.status === 'active' || !team.status ? 'bg-green-100 text-green-800 border border-green-200' :
                                                                    team.status === 'waiting' ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' :
                                                                        'bg-slate-100 text-slate-800 border border-slate-200'
                                                                    }`}>
                                                                    {team.status === 'active' || !team.status ? '협업중' : team.status === 'waiting' ? '대기' : '폐업'}
                                                                </span>
                                                            ) : col.key === 'leaderName' ? (
                                                                <SingleSelectPopover
                                                                    options={workers.sort((a, b) => a.name.localeCompare(b.name)).map(w => ({
                                                                        id: w.id!,
                                                                        name: w.name,
                                                                        icon: <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500">{w.name[0]}</div>
                                                                    }))}
                                                                    selectedId={team.leaderId || null}
                                                                    onSelect={(id: string) => handleLeaderUpdate(team.id!, id)}
                                                                    placeholder="미지정"
                                                                    minimal={true}
                                                                    renderSelected={(opt: any) => {
                                                                        const leaderWorker = workers.find(w => w.id === team.leaderId);
                                                                        const leaderPosition = positions.find(p => p.name === leaderWorker?.role);
                                                                        const posColor = leaderPosition?.color || 'blue';
                                                                        const colorClass = {
                                                                            red: 'bg-red-500', orange: 'bg-orange-500', yellow: 'bg-yellow-500',
                                                                            green: 'bg-emerald-500', blue: 'bg-blue-500', indigo: 'bg-indigo-500',
                                                                            purple: 'bg-purple-500', pink: 'bg-pink-500', gray: 'bg-slate-500',
                                                                            slate: 'bg-slate-500', black: 'bg-slate-900',
                                                                        }[posColor] || 'bg-blue-500';
                                                                        return (
                                                                            <div className="flex items-center gap-2">
                                                                                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-md ${colorClass}`}>
                                                                                    <FontAwesomeIcon icon={getPositionIcon(leaderWorker?.role, positions)} className="text-white text-xs" />
                                                                                </span>
                                                                                <span className="font-medium text-slate-700">{opt.name}</span>
                                                                            </div>
                                                                        );
                                                                    }}
                                                                />
                                                            ) : col.key === 'companyName' ? (
                                                                <div className="flex items-center gap-2">
                                                                    <span
                                                                        className="inline-flex items-center justify-center w-7 h-7 rounded-full border border-slate-200 flex-shrink-0"
                                                                        style={{ backgroundColor: teamCompany?.color || '#e5e7eb' }}
                                                                    >
                                                                        <FontAwesomeIcon icon={faBuilding} className="text-white text-xs" />
                                                                    </span>
                                                                    <span>{teamCompany?.name || team.companyName || '-'}</span>
                                                                </div>
                                                            ) : col.key === 'siteCount' ? (
                                                                <MultiSelectPopover
                                                                    options={sites.map(s => ({ ...s, id: s.id || '' }))}
                                                                    selectedIds={assignedSites.map(s => s.id!)}
                                                                    placeholder={`${assignedSites.length}개 담당`}
                                                                    minimal={true}
                                                                    onSelect={(id: string) => {
                                                                        const currentIds = assignedSites.map(s => s.id!);
                                                                        const newIds = currentIds.includes(id)
                                                                            ? currentIds.filter(x => x !== id)
                                                                            : [...currentIds, id];
                                                                        if (team.id) handleTeamSiteSelect(team.id, newIds);
                                                                    }}
                                                                    onSelectAll={() => {
                                                                        const currentLen = assignedSites.length;
                                                                        const totalLen = sites.length;
                                                                        if (currentLen === totalLen) {
                                                                            if (team.id) handleTeamSiteSelect(team.id, []);
                                                                        } else {
                                                                            const allIds = sites.map(s => s.id || '').filter(Boolean);
                                                                            if (team.id) handleTeamSiteSelect(team.id, allIds);
                                                                        }
                                                                    }}
                                                                />
                                                            ) : col.key === 'memberCount' ? (
                                                                <MultiSelectPopover
                                                                    options={workers.map(w => ({ ...w, id: w.id || '' }))}
                                                                    selectedIds={workers.filter(w => w.teamId === team.id).map(w => w.id!)}
                                                                    placeholder={`${workers.filter(w => w.teamId === team.id).length}명`}
                                                                    minimal={true}
                                                                    onSelect={(id: string) => {
                                                                        const currentIds = workers.filter(w => w.teamId === team.id).map(w => w.id!);
                                                                        const newIds = currentIds.includes(id)
                                                                            ? currentIds.filter(x => x !== id)
                                                                            : [...currentIds, id];
                                                                        if (team.id) handleTeamMemberSelect(team.id, newIds);
                                                                    }}
                                                                    onSelectAll={() => {
                                                                        const currentLen = workers.filter(w => w.teamId === team.id).length;
                                                                        const totalLen = workers.length;
                                                                        if (currentLen === totalLen) {
                                                                            if (team.id) handleTeamMemberSelect(team.id, []);
                                                                        } else {
                                                                            const allIds = workers.map(w => w.id || '').filter(Boolean);
                                                                            if (team.id) handleTeamMemberSelect(team.id, allIds);
                                                                        }
                                                                    }}
                                                                />
                                                            ) : col.key === 'name' ? (
                                                                <div className="flex items-center gap-2">
                                                                    <span
                                                                        className="inline-block w-1.5 h-6 rounded-full border border-slate-200"
                                                                        style={{ backgroundColor: team.color || '#e5e7eb' }}
                                                                    />
                                                                    <span className="font-semibold text-slate-800">{team.name}</span>
                                                                </div>
                                                            ) : (
                                                                renderCellValue(team, col)
                                                            )
                                                        )}
                                                    </td>
                                                ))}
                                            </tr>
                                            {
                                                expandedTeamIds.includes(team.id!) && (
                                                    <tr className="bg-slate-50/50">
                                                        <td colSpan={visibleColumns.length + 2} className="px-6 py-4">
                                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                                                {/* Assigned Sites (via Site.responsibleTeamId) */}
                                                                {assignedSites.map(site => (
                                                                    <div key={site.id} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex items-center gap-3">
                                                                        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                                                                            <FontAwesomeIcon icon={faBuilding} />
                                                                        </div>
                                                                        <div>
                                                                            <div className="text-sm font-semibold text-slate-800">{site.name}</div>
                                                                            <div className="text-xs text-slate-500">{site.address}</div>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                                {/* Assigned Workers */}
                                                                {workers.filter(w => w.teamId === team.id).map(worker => (
                                                                    <div key={worker.id} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex items-center gap-3">
                                                                        <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 text-xs">
                                                                            <FontAwesomeIcon icon={faHardHat} />
                                                                        </div>
                                                                        <div className="min-w-0">
                                                                            <div className="text-sm font-semibold text-slate-800 truncate">{worker.name}</div>
                                                                            <div className="text-xs text-slate-500 truncate">{worker.role || '팀원'}</div>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                                {(!team.siteIds?.length && !workers.some(w => w.teamId === team.id)) && (
                                                                    <div className="col-span-full py-8 text-center text-slate-400 text-sm bg-white rounded-lg border border-dashed border-slate-300">
                                                                        배정된 현장이나 작업자가 없습니다.
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )
                                            }
                                        </React.Fragment>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={visibleColumns.length + 2} className="px-6 py-12 text-center text-slate-500">
                                        <div className="flex flex-col items-center gap-2">
                                            <FontAwesomeIcon icon={faUsers} className="text-4xl text-slate-300 mb-2" />
                                            <p>{searchTerm ? '검색 결과가 없습니다.' : '등록된 팀이 없습니다.'}</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modals */}
            {
                showTeamModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
                        <div className="bg-white p-6 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-bold text-slate-800">팀 등록</h2>
                                <button onClick={() => setShowTeamModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                                    <FontAwesomeIcon icon={faTimes} className="text-lg" />
                                </button>
                            </div>
                            <TeamForm
                                initialData={editingTeam || undefined}
                                teams={teams}
                                workers={workers}
                                companies={companyOptions}
                                onSave={handleTeamSave}
                                onCancel={() => setShowTeamModal(false)}
                            />
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default TeamDatabase;
