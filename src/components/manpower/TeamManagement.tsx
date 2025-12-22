import React, { useState, useEffect } from 'react';
import { teamService, Team } from '../../services/teamService';
import { manpowerService, Worker } from '../../services/manpowerService';
import { siteService, Site } from '../../services/siteService';
import { companyService, Company } from '../../services/companyService';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faPenToSquare, faTrash, faUsers, faChevronDown, faChevronRight, faBuilding, faFileExcel, faFileImport, faFileExport } from '@fortawesome/free-solid-svg-icons';
import * as XLSX from 'xlsx';
import TeamForm from './TeamForm';

interface TeamManagementProps {
    onDataChange?: () => void;
}

const TeamManagement: React.FC<TeamManagementProps> = ({ onDataChange }) => {
    const [teams, setTeams] = useState<Team[]>([]);
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [sites, setSites] = useState<Site[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentTeam, setCurrentTeam] = useState<Partial<Team>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [lastDoc, setLastDoc] = useState<any>(null);
    const [hasMore, setHasMore] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const LIMIT = 100;

    const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [teamsData, workersData, sitesData, companiesData] = await Promise.all([
                teamService.getTeamsPaginated(LIMIT),
                manpowerService.getWorkers(),
                siteService.getSites(),
                companyService.getCompanies()
            ]);
            setTeams(teamsData.teams);
            setLastDoc(teamsData.lastDoc);
            setHasMore(teamsData.teams.length === LIMIT);
            setWorkers(workersData);
            setSites(sitesData);
            setCompanies(companiesData);
        } catch (error) {
            console.error("Failed to fetch data", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleLoadMore = async () => {
        if (!lastDoc || isLoadingMore) return;
        setIsLoadingMore(true);
        try {
            const result = await teamService.getTeamsPaginated(LIMIT, lastDoc);
            setTeams(prev => [...prev, ...result.teams]);
            setLastDoc(result.lastDoc);
            setHasMore(result.teams.length === LIMIT);
        } catch (error) {
            console.error("Failed to load more teams", error);
        } finally {
            setIsLoadingMore(false);
        }
    };

    const handleUpdateLeader = async (teamId: string, leaderId: string) => {
        try {
            const leader = workers.find(w => w.id === leaderId);
            const leaderName = leader ? leader.name : '';

            await teamService.updateTeam(teamId, { leaderId, leaderName });

            // Local update for immediate feedback
            setTeams(prev => prev.map(t =>
                t.id === teamId
                    ? { ...t, leaderId, leaderName }
                    : t
            ));
        } catch (error) {
            console.error("Failed to update team leader", error);
            alert("팀장 수정에 실패했습니다.");
        }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('정말 삭제하시겠습니까?')) {
            try {
                await teamService.deleteTeam(id);
                fetchData();
                if (onDataChange) onDataChange();
            } catch (error) {
                console.error("Failed to delete team", error);
                alert("삭제에 실패했습니다.");
            }
        }
    };

    const openModal = (team?: Team) => {
        setCurrentTeam(team || { type: '본팀' });
        setIsModalOpen(true);
    };

    const toggleExpand = (teamId: string) => {

        if (expandedTeamId === teamId) {
            setExpandedTeamId(null);
        } else {
            setExpandedTeamId(teamId);
        }
    };

    // Helper to count members
    const getMemberCount = (teamId?: string) => {
        if (!teamId) return 0;
        return workers.filter(w => (w as any).teamId === teamId).length;
    };

    // Helper to count sites
    const getSiteCount = (teamId?: string) => {
        if (!teamId) return 0;
        return sites.filter(s => s.responsibleTeamId === teamId).length;
    };

    const handleExcelDownload = () => {
        const data = teams.map(team => ({
            '팀명': team.name,
            '회사명': team.companyName || '',
            '팀유형': team.type,
            '팀장명': team.leaderName || ''
        }));

        if (data.length === 0) {
            data.push({
                '팀명': '예시팀',
                '회사명': '예시건설',
                '팀유형': '관리팀',
                '팀장명': '홍길동'
            });
        }

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "팀목록");
        XLSX.writeFile(wb, `팀목록_${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws) as any[];

                if (data.length === 0) {
                    alert('엑셀 파일에 데이터가 없습니다.');
                    return;
                }

                setIsLoading(true);
                let successCount = 0;

                for (const row of data) {
                    const leaderName = row['팀장명'];
                    let leaderId = '';

                    if (leaderName) {
                        const leader = workers.find(w => w.name === leaderName);
                        if (leader) {
                            leaderId = leader.id!;
                        }
                    }

                    const newTeam: Team = {
                        name: row['팀명'],
                        companyName: row['회사명'],
                        type: row['팀유형'] || '관리팀',
                        leaderId: leaderId,
                        leaderName: leaderName
                    };

                    if (newTeam.name) {
                        await teamService.addTeam(newTeam);
                        successCount++;
                    }
                }

                alert(`${successCount}건의 팀이 등록되었습니다.`);
                fetchData();

            } catch (error) {
                console.error("Excel upload failed", error);
                alert("엑셀 업로드 중 오류가 발생했습니다.");
            } finally {
                setIsLoading(false);
                e.target.value = '';
            }
        };
        reader.readAsBinaryString(file);
    };

    return (
        <div className="flex flex-col h-full">
            {/* Toolbar */}
            <div className="bg-white border-b border-slate-200 p-4 flex items-center justify-between flex-shrink-0">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <FontAwesomeIcon icon={faUsers} className="text-brand-600" /> 팀 목록
                </h2>
                <div className="flex gap-2">
                    <button
                        onClick={handleExcelDownload}
                        className="bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 transition font-bold shadow-sm text-sm flex items-center"
                        title="엑셀 다운로드"
                    >
                        <FontAwesomeIcon icon={faFileExport} className="mr-2" /> 엑셀
                    </button>
                    <label className="bg-blue-500 text-white px-3 py-2 rounded-lg hover:bg-blue-600 transition font-bold shadow-sm text-sm flex items-center cursor-pointer" title="엑셀 업로드">
                        <input
                            type="file"
                            accept=".xlsx, .xls"
                            className="hidden"
                            onChange={handleExcelUpload}
                            disabled={isLoading}
                        />
                        <FontAwesomeIcon icon={faFileImport} className="mr-2" /> 업로드
                    </label>
                    <button onClick={() => openModal()} className="bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700 transition font-bold shadow-sm text-sm">
                        <FontAwesomeIcon icon={faPlus} className="mr-2" /> 팀 등록
                    </button>
                </div>
            </div>

            {/* Content Area: Table or Form */}
            <div className="flex-1 overflow-auto p-4">
                {isModalOpen ? (
                    <TeamForm
                        initialData={currentTeam}
                        teams={teams}
                        workers={workers}
                        companies={companies}
                        onSave={() => {
                            fetchData();
                            if (onDataChange) onDataChange();
                            setIsModalOpen(false);
                        }}
                        onCancel={() => setIsModalOpen(false)}
                    />
                ) : (
                    <>
                        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                    <tr>
                                        <th className="px-6 py-3 border-b border-slate-200 w-10"></th>
                                        <th className="px-6 py-3 border-b border-slate-200">팀명</th>
                                        <th className="px-6 py-3 border-b border-slate-200">회사명</th>
                                        <th className="px-6 py-3 border-b border-slate-200">팀유형</th>
                                        <th className="px-6 py-3 border-b border-slate-200">팀장</th>
                                        <th className="px-6 py-3 border-b border-slate-200">팀원 수</th>
                                        <th className="px-6 py-3 border-b border-slate-200">담당 현장</th>

                                        <th className="px-6 py-3 border-b border-slate-200 text-right">관리</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-sm">
                                    {isLoading ? (
                                        <tr><td colSpan={8} className="text-center py-10">로딩중...</td></tr>
                                    ) : teams.length === 0 ? (
                                        <tr><td colSpan={8} className="text-center py-10 text-slate-400">등록된 팀이 없습니다.</td></tr>
                                    ) : (
                                        teams.map((team) => {
                                            const isExpanded = expandedTeamId === team.id;
                                            const teamSites = sites.filter(s => s.responsibleTeamId === team.id);
                                            const teamWorkers = workers.filter(w => (w as any).teamId === team.id);

                                            return (
                                                <React.Fragment key={team.id}>
                                                    <tr
                                                        className={`hover:bg-slate-50 transition-colors cursor-pointer ${isExpanded ? 'bg-slate-50' : ''}`}
                                                        onClick={() => toggleExpand(team.id!)}
                                                    >
                                                        <td className="px-6 py-4 text-slate-400">
                                                            <FontAwesomeIcon icon={isExpanded ? faChevronDown : faChevronRight} />
                                                        </td>
                                                        <td className="px-6 py-4 font-bold text-slate-800">
                                                            <div className="flex items-center gap-2">
                                                                <span
                                                                    className="inline-block w-1.5 h-6 rounded-full border border-slate-200"
                                                                    style={{ backgroundColor: team.color || '#e5e7eb' }}
                                                                />
                                                                <span>
                                                                    {team.name}
                                                                    {team.parentTeamName && (
                                                                        <span className="ml-2 text-xs text-slate-400 font-normal">
                                                                            (상위: {team.parentTeamName})
                                                                        </span>
                                                                    )}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-slate-600">{team.companyName || '-'}</td>
                                                        <td className="px-6 py-4 text-slate-600">
                                                            <span className="bg-slate-100 px-2 py-1 rounded text-xs font-bold text-slate-600">{team.type}</span>
                                                        </td>
                                                        <td className="px-6 py-4 text-slate-600" onClick={(e) => e.stopPropagation()}>
                                                            <select
                                                                value={team.leaderId || ''}
                                                                onChange={(e) => handleUpdateLeader(team.id!, e.target.value)}
                                                                className="w-full max-w-[150px] bg-white border border-slate-300 rounded px-2 py-1 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 transition-colors cursor-pointer"
                                                            >
                                                                <option value="">(미지정)</option>
                                                                {workers
                                                                    .sort((a, b) => a.name.localeCompare(b.name))
                                                                    .map(worker => (
                                                                        <option key={worker.id} value={worker.id!}>
                                                                            {worker.name} {worker.role && `(${worker.role})`}
                                                                        </option>
                                                                    ))}
                                                            </select>
                                                        </td>
                                                        <td className="px-6 py-4 text-slate-600">
                                                            {teamWorkers.length}명
                                                        </td>
                                                        <td className="px-6 py-4 text-slate-600">
                                                            {teamSites.length}개
                                                        </td>

                                                        <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                                                            <button onClick={() => openModal(team)} className="text-slate-400 hover:text-brand-600 mr-2 transition"><FontAwesomeIcon icon={faPenToSquare} /></button>
                                                            <button onClick={() => handleDelete(team.id!)} className="text-slate-400 hover:text-red-600 transition"><FontAwesomeIcon icon={faTrash} /></button>
                                                        </td>
                                                    </tr>
                                                    {isExpanded && (
                                                        <tr className="bg-slate-50">
                                                            <td colSpan={8} className="p-4 border-b border-slate-200">
                                                                <div className="flex gap-6">
                                                                    {/* Assigned Sites */}
                                                                    <div className="flex-1 bg-white rounded-lg border border-slate-200 p-4">
                                                                        <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
                                                                            <FontAwesomeIcon icon={faBuilding} className="text-slate-400" />
                                                                            담당 현장 ({teamSites.length})
                                                                        </h3>
                                                                        {teamSites.length === 0 ? (
                                                                            <div className="text-slate-400 text-sm text-center py-4">담당하는 현장이 없습니다.</div>
                                                                        ) : (
                                                                            <ul className="space-y-2">
                                                                                {teamSites.map(site => (
                                                                                    <li key={site.id} className="flex justify-between items-center text-sm p-2 hover:bg-slate-50 rounded border border-transparent hover:border-slate-100">
                                                                                        <span className="font-medium text-slate-700">{site.name}</span>
                                                                                        <span className={`px-2 py-0.5 rounded text-xs ${site.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                                                                                            site.status === 'completed' ? 'bg-slate-100 text-slate-500' : 'bg-orange-100 text-orange-700'
                                                                                            }`}>
                                                                                            {site.status === 'active' ? '진행중' : site.status === 'completed' ? '완료' : '예정'}
                                                                                        </span>
                                                                                    </li>
                                                                                ))}
                                                                            </ul>
                                                                        )}
                                                                    </div>

                                                                    {/* Team Members */}
                                                                    <div className="flex-1 bg-white rounded-lg border border-slate-200 p-4">
                                                                        <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
                                                                            <FontAwesomeIcon icon={faUsers} className="text-slate-400" />
                                                                            소속 팀원 ({teamWorkers.length})
                                                                        </h3>
                                                                        {teamWorkers.length === 0 ? (
                                                                            <div className="text-slate-400 text-sm text-center py-4">소속된 팀원이 없습니다.</div>
                                                                        ) : (
                                                                            <ul className="space-y-2 max-h-60 overflow-y-auto pr-2">
                                                                                {teamWorkers.map(worker => (
                                                                                    <li key={worker.id} className="flex justify-between items-center text-sm p-2 hover:bg-slate-50 rounded border border-transparent hover:border-slate-100">
                                                                                        <div className="flex items-center gap-2">
                                                                                            <span className="w-6 h-6 bg-slate-100 text-slate-500 rounded-full flex items-center justify-center text-xs font-bold">
                                                                                                {worker.name[0]}
                                                                                            </span>
                                                                                            <span className="font-medium text-slate-700">{worker.name}</span>
                                                                                        </div>
                                                                                        <span className="text-slate-500 text-xs">{worker.role || '작업자'}</span>
                                                                                    </li>
                                                                                ))}
                                                                            </ul>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </React.Fragment>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                        {/* Load More Button */}
                        {hasMore && (
                            <div className="flex justify-center py-4">
                                <button
                                    onClick={handleLoadMore}
                                    disabled={isLoadingMore}
                                    className="px-6 py-2 bg-white border border-slate-200 rounded-full text-slate-600 font-bold hover:bg-slate-50 transition shadow-sm disabled:opacity-50"
                                >
                                    {isLoadingMore ? '로딩 중...' : '더보기 (100개)'}
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div >
    );
};

export default TeamManagement;
