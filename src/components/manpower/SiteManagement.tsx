import React, { useState, useEffect } from 'react';
import { siteService, Site } from '../../services/siteService';
import { teamService, Team } from '../../services/teamService';
import { companyService, Company } from '../../services/companyService';
import { toast } from '../../utils/swal';
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

    // ... existing functions ...

    const handleUpdateSite = async (siteId: string, field: 'clientCompanyId' | 'companyId' | 'partnerId', value: string) => {
        const company = companies.find(c => c.id === value);
        let updates: Partial<Site> = { [field]: value };

        if (field === 'clientCompanyId') updates.clientCompanyName = company?.name || '';
        if (field === 'companyId') updates.companyName = company?.name || '';
        if (field === 'partnerId') updates.partnerName = company?.name || '';

        try {
            await siteService.updateSite(siteId, updates);
            setSites(prev => prev.map(s => s.id === siteId ? { ...s, ...updates } : s));
        } catch (error) {
            console.error("Failed to update site", error);
            alert("수정 실패");
        }
    };

    const refreshSites = async () => {
        try {
            const fetchedSites = await siteService.getSites();
            setSites(fetchedSites);
        } catch (error) {
            console.error("Failed to refresh sites", error);
        }
    };

    const handleTeamChange = async (siteId: string, teamId: string) => {
        // 1. Fetch Fresh Team Data from DB
        let freshTeam: Team | null = null;
        try {
            freshTeam = await teamService.getTeam(teamId);
        } catch (e) {
            console.error("Failed to fetch fresh team", e);
            freshTeam = teams.find(t => t.id === teamId) || null;
        }

        const team = freshTeam || teams.find(t => t.id === teamId);
        if (!team) return;

        // 2. Resolve Company (Smart Match Logic - Self Healing)
        let targetCompany: Company | undefined = undefined;
        let matchMethod = 'id';

        const normalize = (s: string) => s ? s.replace(/\s+/g, '').trim() : '';
        const teamCompName = normalize(team.companyName || '');

        // A. Try ID Match
        if (team.companyId) {
            targetCompany = companies.find(c => c.id === team.companyId);
        }

        // B. Check for Data Drift & Fuzzy Search
        // If ID Match failed OR Name Mismatch (Drift)
        let isDrift = false;
        if (targetCompany && teamCompName && normalize(targetCompany.name) !== teamCompName) {
            isDrift = true;
            console.warn(`[SmartMatch] Name Mismatch! Team says '${team.companyName}', ID points to '${targetCompany.name}'`);
        }

        if (!targetCompany || isDrift) {
            // Priority 1: Exact Name Match
            let candidate = companies.find(c => c.name === team.companyName);

            // Priority 2: Normalized Name Match
            if (!candidate && teamCompName) {
                candidate = companies.find(c => normalize(c.name) === teamCompName);
            }

            // Priority 3: Partial Match (Team name inside Company name or vice versa)
            // Only if string is long enough to avoid false positives
            if (!candidate && teamCompName.length > 2) {
                candidate = companies.find(c => {
                    const cName = normalize(c.name);
                    return cName.includes(teamCompName) || teamCompName.includes(cName);
                });
            }

            if (candidate) {
                targetCompany = candidate;
                matchMethod = 'fuzzy_fix';
                console.log(`[SmartMatch] Found Company by Name/Fuzzy: ${candidate.name}`);

                // *** SELF HEALING ***
                // Update the Team's broken link so it works next time
                try {
                    await teamService.updateTeam(team.id!, {
                        companyId: candidate.id,
                        companyName: candidate.name
                    });
                    console.log("[SmartMatch] Auto-Repaired Team Data.");
                } catch (err) {
                    console.error("Failed to auto-repair team", err);
                }
            }
        }

        let updates: Partial<Site> = {
            responsibleTeamId: teamId,
            responsibleTeamName: team.name || ''
        };

        let typeLabel = '';
        if (targetCompany) {
            const companyType = targetCompany.type?.trim();
            if (companyType === '협력사') {
                updates.partnerId = targetCompany.id;
                updates.partnerName = targetCompany.name;
                updates.companyId = '';
                updates.companyName = '';
                updates.clientCompanyId = '';
                updates.clientCompanyName = '';
                typeLabel = '협력사';
            } else {
                updates.companyId = targetCompany.id;
                updates.companyName = targetCompany.name;
                updates.partnerId = '';
                updates.partnerName = '';
                typeLabel = companyType || '시공사(기본)';
            }
        } else if (teamId) {
            updates.companyId = '';
            updates.companyName = '';
            updates.partnerId = '';
            updates.partnerName = '';
        }

        try {
            await siteService.updateSite(siteId, updates);
            setSites(prev => prev.map(s => s.id === siteId ? { ...s, ...updates } : s));
            await refreshSites();

            if (targetCompany) {
                let msg = `[${team.name}] → ${targetCompany.name} (${typeLabel}) 적용 완료`;
                if (matchMethod === 'fuzzy_fix') msg += ' (자동 보정됨)';
                if (isDrift) msg += ' (데이터 오류 수정됨)';
                toast.success(msg);
            } else if (teamId) {
                // Diagnose WHY it failed
                const reason = team.companyName
                    ? `회사명 '${team.companyName}'을(를) DB에서 찾을 수 없습니다.`
                    : '팀에 연결된 회사가 없습니다.';
                toast.error(`[${team.name}] 회사 연동 실패: ${reason}`);
            }
        } catch (error) {
            console.error("Failed to update site team", error);
            alert("팀 수정 실패");
        }
    };

    // ... existing useEffect ...



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
                                    <th className="px-4 py-3 border-b border-slate-200">발주사</th>
                                    <th className="px-4 py-3 border-b border-slate-200">시공사</th>
                                    <th className="px-4 py-3 border-b border-slate-200">협력사</th>
                                    <th className="px-6 py-3 border-b border-slate-200">현장코드</th>
                                    <th className="px-6 py-3 border-b border-slate-200">주소</th>


                                    <th className="px-6 py-3 border-b border-slate-200">상태</th>
                                    <th className="px-6 py-3 border-b border-slate-200 text-right">관리</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-sm">
                                {isLoading ? (
                                    <tr><td colSpan={10} className="text-center py-10">로딩중...</td></tr>
                                ) : sites.length === 0 ? (
                                    <tr><td colSpan={10} className="text-center py-10 text-slate-400">등록된 현장이 없습니다.</td></tr>
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
                                                    <select
                                                        value={site.responsibleTeamId || ''}
                                                        onChange={(e) => handleTeamChange(site.id!, e.target.value)}
                                                        className="text-xs border border-slate-200 rounded px-2 py-1 w-full cursor-pointer hover:border-brand-500 transition-colors bg-indigo-50 text-indigo-700 font-bold"
                                                        style={{ minWidth: '100px' }}
                                                    >
                                                        <option value="">-</option>
                                                        {teams.map(t => (
                                                            <option key={t.id} value={t.id}>{t.name}</option>
                                                        ))}
                                                    </select>
                                                </td>

                                                {/* Client (발주사) Editable */}
                                                <td className="px-4 py-4">
                                                    <select
                                                        value={site.clientCompanyId || ''}
                                                        onChange={(e) => handleUpdateSite(site.id!, 'clientCompanyId', e.target.value)}
                                                        className={`text-xs border rounded px-2 py-1 w-32 cursor-pointer hover:border-brand-500 transition-colors ${site.clientCompanyId && companies.find(c => c.id === site.clientCompanyId)?.type !== '건설사'
                                                            ? 'border-red-500 text-red-600 bg-red-50 font-bold'
                                                            : 'border-slate-200'
                                                            }`}
                                                    >
                                                        <option value="">-</option>
                                                        {companies.map(c => (
                                                            <option key={c.id} value={c.id}>
                                                                {c.type !== '건설사' ? '⚠️ ' : ''}{c.name}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </td>

                                                {/* Constructor (시공사) Editable */}
                                                <td className="px-4 py-4">
                                                    <select
                                                        value={site.companyId || ''}
                                                        onChange={(e) => handleUpdateSite(site.id!, 'companyId', e.target.value)}
                                                        className={`text-xs border rounded px-2 py-1 w-32 cursor-pointer hover:border-brand-500 transition-colors ${site.companyId && !['시공사', '건설사', '미지정'].includes(companies.find(c => c.id === site.companyId)?.type || '')
                                                            ? 'border-red-500 text-red-600 bg-red-50 font-bold'
                                                            : 'border-slate-200'
                                                            }`}
                                                    >
                                                        <option value="">-</option>
                                                        {companies.map(c => (
                                                            <option key={c.id} value={c.id}>
                                                                {c.type === '협력사' ? '⚠️ ' : ''}{c.name}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </td>

                                                {/* Partner (협력사) Editable */}
                                                <td className="px-4 py-4">
                                                    <select
                                                        value={site.partnerId || ''}
                                                        onChange={(e) => handleUpdateSite(site.id!, 'partnerId', e.target.value)}
                                                        className={`text-xs border rounded px-2 py-1 w-32 cursor-pointer hover:border-brand-500 transition-colors ${site.partnerId && companies.find(c => c.id === site.partnerId)?.type !== '협력사'
                                                            ? 'border-red-500 text-red-600 bg-red-50 font-bold'
                                                            : 'border-slate-200'
                                                            }`}
                                                    >
                                                        <option value="">-</option>
                                                        {companies.map(c => (
                                                            <option key={c.id} value={c.id}>
                                                                {c.type !== '협력사' ? '⚠️ ' : ''}{c.name}
                                                            </option>
                                                        ))}
                                                    </select>
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
