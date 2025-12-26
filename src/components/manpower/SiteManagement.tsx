import React, { useState, useEffect } from 'react';
import { siteService, Site } from '../../services/siteService';
import { teamService, Team } from '../../services/teamService';
import { companyService, Company } from '../../services/companyService';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faPenToSquare, faTrash, faBuilding, faFileExcel, faFileImport, faFileExport } from '@fortawesome/free-solid-svg-icons';
import * as XLSX from 'xlsx';
import SiteForm from './SiteForm';


const SiteManagement: React.FC = () => {
    const [sites, setSites] = useState<Site[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentSite, setCurrentSite] = useState<Partial<Site>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [lastDoc, setLastDoc] = useState<any>(null);
    const [hasMore, setHasMore] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const LIMIT = 100;

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [sitesData, teamsData, companiesData] = await Promise.all([
                siteService.getSitesPaginated(LIMIT),
                teamService.getTeams(),
                companyService.getCompanies()
            ]);
            setSites(sitesData.sites);
            setLastDoc(sitesData.lastDoc);
            setHasMore(sitesData.sites.length === LIMIT);
            setTeams(teamsData);
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
            const result = await siteService.getSitesPaginated(LIMIT, lastDoc);
            setSites(prev => [...prev, ...result.sites]);
            setLastDoc(result.lastDoc);
            setHasMore(result.sites.length === LIMIT);
        } catch (error) {
            console.error("Failed to load more sites", error);
        } finally {
            setIsLoadingMore(false);
        }
    };



    const handleDelete = async (id: string) => {
        if (window.confirm('정말 삭제하시겠습니까?')) {
            try {
                await siteService.deleteSite(id);
                fetchData();
            } catch (error) {
                console.error("Failed to delete site", error);
                alert("삭제에 실패했습니다.");
            }
        }
    };

    const openModal = (site?: Site) => {
        setCurrentSite(site || { status: 'active' });
        setIsModalOpen(true);
    };



    // ... existing useEffect ...

    const handleExcelDownload = () => {
        const data = sites.map(site => ({
            '현장명': site.name,
            '담당팀': site.responsibleTeamName || '',
            '현장코드': site.code || '',
            '주소': site.address || '',
            '상태': site.status === 'active' ? '진행중' : site.status === 'completed' ? '완료' : '예정'
        }));

        if (data.length === 0) {
            data.push({
                '현장명': '예시현장',
                '담당팀': '예시팀',
                '현장코드': 'SITE-001',
                '주소': '서울시 강남구',
                '상태': '진행중'
            });
        }

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "현장목록");
        XLSX.writeFile(wb, `현장목록_${new Date().toISOString().slice(0, 10)}.xlsx`);
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
                    const teamName = row['담당팀'];
                    let teamId = '';
                    let responsibleTeamName = '';

                    if (teamName) {
                        const team = teams.find(t => t.name === teamName);
                        if (team) {
                            teamId = team.id!;
                            responsibleTeamName = team.name;
                        }
                    }

                    const statusMap: { [key: string]: 'active' | 'planned' | 'completed' } = {
                        '진행중': 'active',
                        '예정': 'planned',
                        '완료': 'completed'
                    };

                    const newSite: Site = {
                        name: row['현장명'],
                        responsibleTeamId: teamId,
                        responsibleTeamName: responsibleTeamName,
                        code: row['현장코드'],
                        address: row['주소'],
                        status: statusMap[row['상태']] || 'active'
                    };

                    if (newSite.name) {
                        await siteService.addSite(newSite);
                        successCount++;
                    }
                }

                alert(`${successCount}건의 현장이 등록되었습니다.`);
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

    // ... existing fetchData, handleSave, handleDelete, openModal ...



    return (
        <div className="flex flex-col h-full">
            {/* Toolbar */}
            <div className="bg-white border-b border-slate-200 p-4 flex items-center justify-between flex-shrink-0">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <FontAwesomeIcon icon={faBuilding} className="text-brand-600" /> 현장 목록
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
                        <FontAwesomeIcon icon={faPlus} className="mr-2" /> 현장 등록
                    </button>
                </div>
            </div>



            {/* Content Area: Table or Form */}
            <div className="flex-1 overflow-auto p-4">
                {isModalOpen ? (
                    <SiteForm
                        initialData={currentSite}
                        teams={teams}
                        companies={companies}
                        onSave={() => {
                            fetchData();
                            setIsModalOpen(false);
                        }}
                        onCancel={() => setIsModalOpen(false)}
                    />
                ) : (
                    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                <tr>
                                    <th className="px-6 py-3 border-b border-slate-200">현장명</th>
                                    <th className="px-6 py-3 border-b border-slate-200">담당팀</th>
                                    <th className="px-6 py-3 border-b border-slate-200">회사명</th>
                                    <th className="px-6 py-3 border-b border-slate-200">현장코드</th>
                                    <th className="px-6 py-3 border-b border-slate-200">주소</th>


                                    <th className="px-6 py-3 border-b border-slate-200">상태</th>
                                    <th className="px-6 py-3 border-b border-slate-200 text-right">관리</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-sm">
                                {isLoading ? (
                                    <tr><td colSpan={8} className="text-center py-10">로딩중...</td></tr>
                                ) : sites.length === 0 ? (
                                    <tr><td colSpan={8} className="text-center py-10 text-slate-400">등록된 현장이 없습니다.</td></tr>
                                ) : (
                                    sites.map((site) => {
                                        const company = companies.find(c => c.id === site.companyId);
                                        const siteColor = company?.color || '#e5e7eb';
                                        return (
                                            <tr key={site.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-6 py-4 font-bold text-slate-800">
                                                    <div className="flex items-center gap-2">
                                                        <span
                                                            className="inline-block w-1.5 h-6 rounded-full border border-slate-200"
                                                            style={{ backgroundColor: siteColor }}
                                                        />
                                                        <span>{site.name}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-slate-600">
                                                    {site.responsibleTeamName ? (
                                                        <span className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded text-xs font-bold">
                                                            {site.responsibleTeamName}
                                                        </span>
                                                    ) : '-'}
                                                </td>
                                                <td className="px-6 py-4 text-slate-600">
                                                    {site.companyName ? (
                                                        <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-bold">
                                                            {site.companyName}
                                                        </span>
                                                    ) : '-'}
                                                </td>
                                                <td className="px-6 py-4 text-slate-600 font-mono">{site.code}</td>
                                                <td className="px-6 py-4 text-slate-600">{site.address}</td>


                                                <td className="px-6 py-4">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${site.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                                                        site.status === 'completed' ? 'bg-slate-100 text-slate-500' :
                                                            'bg-orange-100 text-orange-700'
                                                        }`}>
                                                        {site.status === 'active' ? '진행중' :
                                                            site.status === 'completed' ? '완료' : '예정'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <button onClick={() => openModal(site)} className="text-slate-400 hover:text-brand-600 mr-2 transition"><FontAwesomeIcon icon={faPenToSquare} /></button>
                                                    <button onClick={() => handleDelete(site.id!)} className="text-slate-400 hover:text-red-600 transition"><FontAwesomeIcon icon={faTrash} /></button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div >
    );
};


export default SiteManagement;
