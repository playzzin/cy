import React, { useState, useEffect } from 'react';
import { dailyReportService, DailyReport, DailyReportWorker } from '../../services/dailyReportService';
import { teamService, Team } from '../../services/teamService';
import { siteService, Site } from '../../services/siteService';
import { companyService, Company } from '../../services/companyService';
import { manpowerService, Worker } from '../../services/manpowerService';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faSearch, faCalendarAlt, faUsers, faTrash, faUser, faUserShield, faUserGear, faBuilding,
    faCrown, faUserTie, faHardHat, faUserPlus, faHelmetSafety, faPersonDigging, faWrench, faScrewdriverWrench
} from '@fortawesome/free-solid-svg-icons';

// Icon Map for Team/Worker types
import { resolveIcon } from '../../constants/iconMap';

// Local ICON_MAP removed in favor of safe resolveIcon

interface DailyReportListProps {
    initialDate?: string;
}

const DailyReportList: React.FC<DailyReportListProps> = ({ initialDate }) => {
    const [reports, setReports] = useState<DailyReport[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [sites, setSites] = useState<Site[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [allWorkers, setAllWorkers] = useState<Worker[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const today = new Date();
    const formatDate = (d: Date) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    const todayStr = formatDate(today);
    const [startDate, setStartDate] = useState(initialDate || todayStr);
    const [endDate, setEndDate] = useState(initialDate || todayStr);
    const [selectedTeamId, setSelectedTeamId] = useState('');
    const [selectedSiteId, setSelectedSiteId] = useState('');
    const [workerSearch, setWorkerSearch] = useState('');
    const [dateSortOrder, setDateSortOrder] = useState<'asc' | 'desc'>('desc');
    const [companyTypeFilter, setCompanyTypeFilter] = useState<'all' | 'construction' | 'partner'>('all');
    const [openPopoverId, setOpenPopoverId] = useState<string | null>(null);
    const [popoverSearch, setPopoverSearch] = useState('');
    const [editingCell, setEditingCell] = useState<string | null>(null); // "reportId-workerId-field"
    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => { fetchInitialData(); }, []);
    useEffect(() => { fetchReports(); }, [startDate, endDate, selectedTeamId, selectedSiteId]);

    const fetchInitialData = async () => {
        try {
            const [teamsData, sitesData, companiesData, workersData] = await Promise.all([
                teamService.getTeams(), siteService.getSites(), companyService.getCompanies(), manpowerService.getWorkers()
            ]);
            setTeams(teamsData);
            setSites(sitesData);
            setCompanies(companiesData);
            setAllWorkers(workersData.filter(w => w.status !== '퇴사'));
        } catch (error) { console.error("Failed to fetch initial data", error); }
    };

    const fetchReports = async () => {
        setIsLoading(true);
        try {
            const data = await dailyReportService.getReportsByRange(startDate, endDate, selectedTeamId);
            let filtered = selectedSiteId ? data.filter(r => r.siteId === selectedSiteId) : data;
            filtered.sort((a, b) => dateSortOrder === 'asc' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date));
            setReports(filtered);
        } catch (error) { console.error("Failed to fetch reports", error); }
        finally { setIsLoading(false); }
    };

    const handleDeleteWorker = async (reportId: string, workerId: string, workerName: string) => {
        if (!window.confirm(`"${workerName}"를 삭제하시겠습니까?`)) return;
        try {
            await dailyReportService.removeWorkerFromReport(reportId, workerId);
            await fetchReports();
        } catch (error) { console.error("Failed to delete worker", error); alert("삭제 중 오류가 발생했습니다."); }
    };

    // Bulk delete
    const handleBulkDelete = async () => {
        if (selectedRows.size === 0) {
            alert('삭제할 항목을 선택해주세요.');
            return;
        }
        if (!window.confirm(`선택한 ${selectedRows.size}개 항목을 삭제하시겠습니까?`)) return;

        setIsDeleting(true);
        try {
            for (const key of selectedRows) {
                const [reportId, workerId] = key.split('|');
                await dailyReportService.removeWorkerFromReport(reportId, workerId);
            }
            setSelectedRows(new Set());
            await fetchReports();
            alert(`${selectedRows.size}개 항목이 삭제되었습니다.`);
        } catch (error) {
            console.error("Bulk delete failed", error);
            alert('일부 항목 삭제 중 오류가 발생했습니다.');
        } finally {
            setIsDeleting(false);
        }
    };

    // Toggle select all
    const handleSelectAll = () => {
        if (selectedRows.size === workerRows.length) {
            setSelectedRows(new Set());
        } else {
            const allKeys = workerRows.map(row => `${row.reportId}|${row.workerId}`);
            setSelectedRows(new Set(allKeys));
        }
    };

    // Toggle single row
    const handleToggleRow = (reportId: string, workerId: string) => {
        const key = `${reportId}|${workerId}`;
        const newSelected = new Set(selectedRows);
        if (newSelected.has(key)) {
            newSelected.delete(key);
        } else {
            newSelected.add(key);
        }
        setSelectedRows(newSelected);
    };

    const getPartnerType = (teamId: string | undefined): '시공사' | '협력사' | undefined => {
        if (!teamId) return undefined;
        const team = teams.find(t => t.id === teamId);
        if (!team?.companyId) return undefined;
        const company = companies.find(c => c.id === team.companyId);
        return company?.type === '시공사' || company?.type === '협력사' ? company.type : undefined;
    };

    const getRoleIcon = (role?: string) => {
        if (!role) return faUser;
        if (role.includes('사장') || role.includes('대표')) return faUserShield;
        if (role.includes('팀장') || role.includes('반장')) return faUserGear;
        return faUser;
    };

    // Direct inline save on blur
    const handleInlineSave = async (reportId: string, workerId: string, field: keyof DailyReportWorker, value: any) => {
        try {
            await dailyReportService.updateWorkerInReport(reportId, workerId, { [field]: value });
        } catch (error) { console.error("Save failed", error); alert('수정 저장 중 오류가 발생했습니다.'); }
    };

    // Handle worker change with full data update
    const handleWorkerChange = async (reportId: string, oldWorkerId: string, newWorkerId: string) => {
        const newWorker = allWorkers.find(w => w.id === newWorkerId);
        if (!newWorker) return;

        // Determine salaryModel
        let salaryModel = '일급제';
        if (newWorker.teamType === '지원팀') salaryModel = '지원팀';
        else if (newWorker.teamType === '용역팀') salaryModel = '용역팀';
        else if (newWorker.salaryModel) salaryModel = newWorker.salaryModel;

        try {
            await dailyReportService.updateWorkerInReport(reportId, oldWorkerId, {
                workerId: newWorkerId,
                name: newWorker.name,
                role: newWorker.role,
                unitPrice: newWorker.unitPrice || 0,
                salaryModel
            });
            await fetchReports();
        } catch (error) { console.error("Worker change failed", error); alert('작업자 변경 중 오류가 발생했습니다.'); }
    };

    // Flatten reports to worker level with filtering
    const workerRows = reports.flatMap(report => {
        const partnerType = getPartnerType(report.teamId);
        return report.workers.map(worker => ({
            ...worker, date: report.date, siteId: report.siteId, siteName: report.siteName,
            teamId: report.teamId, teamName: report.teamName, responsibleTeamId: report.responsibleTeamId,
            responsibleTeamName: report.responsibleTeamName, reportId: report.id, partnerType
        }));
    }).filter(row => {
        const matchesSearch = row.name.includes(workerSearch) || (row.role && row.role.includes(workerSearch));
        if (companyTypeFilter === 'all') return matchesSearch;
        const team = teams.find(t => t.id === row.teamId);
        if (!team) return matchesSearch;
        const company = companies.find(c => c.id === team.companyId);
        if (!company) return matchesSearch;
        if (companyTypeFilter === 'construction' && company.type !== '시공사') return false;
        if (companyTypeFilter === 'partner' && company.type !== '협력사') return false;
        return matchesSearch;
    }).sort((a, b) => {
        // 1. 날짜 정렬 (선택된 순서에 따라)
        const dateCompare = dateSortOrder === 'desc'
            ? b.date.localeCompare(a.date)
            : a.date.localeCompare(b.date);
        if (dateCompare !== 0) return dateCompare;

        // 2. 현장명 가나다순
        const siteCompare = (a.siteName || '').localeCompare(b.siteName || '', 'ko');
        if (siteCompare !== 0) return siteCompare;

        // 3. 팀명 가나다순
        const teamCompare = (a.teamName || '').localeCompare(b.teamName || '', 'ko');
        if (teamCompare !== 0) return teamCompare;

        // 4. 작업자명 가나다순
        return a.name.localeCompare(b.name, 'ko');
    });

    const totalManDays = workerRows.reduce((sum, r) => sum + r.manDay, 0);

    return (
        <div className="flex flex-col h-full gap-4">
            {/* Filters */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap gap-3 items-end">
                {/* Date Inputs */}
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <FontAwesomeIcon icon={faCalendarAlt} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                            className="pl-10 pr-3 py-2 border-slate-300 rounded-lg text-sm" />
                    </div>
                    <span className="text-slate-400">~</span>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                        className="px-3 py-2 border-slate-300 rounded-lg text-sm" />
                    {/* Quick Date Buttons */}
                    <button onClick={() => { setStartDate(todayStr); setEndDate(todayStr); }}
                        className="px-2 py-1.5 text-xs bg-blue-500 text-white rounded-lg font-medium">오늘</button>
                    <button onClick={() => { const y = new Date(); y.setDate(y.getDate() - 1); setStartDate(formatDate(y)); setEndDate(formatDate(y)); }}
                        className="px-2 py-1.5 text-xs bg-slate-500 text-white rounded-lg font-medium">어제</button>
                    <button onClick={() => { const t = new Date(); setStartDate(formatDate(new Date(t.getFullYear(), t.getMonth() - 1, 1))); setEndDate(formatDate(new Date(t.getFullYear(), t.getMonth(), 0))); }}
                        className="px-2 py-1.5 text-xs bg-slate-100 text-slate-600 rounded-lg font-medium">전달</button>
                    <button onClick={() => { const t = new Date(); setStartDate(formatDate(new Date(t.getFullYear(), t.getMonth(), 1))); setEndDate(formatDate(t)); }}
                        className="px-2 py-1.5 text-xs bg-slate-100 text-slate-600 rounded-lg font-medium">이달</button>
                    <button onClick={() => { setDateSortOrder(prev => prev === 'desc' ? 'asc' : 'desc'); fetchReports(); }}
                        className={`px-2 py-1.5 text-xs rounded-lg font-medium ${dateSortOrder === 'desc' ? 'bg-indigo-500 text-white' : 'bg-amber-500 text-white'}`}>
                        {dateSortOrder === 'desc' ? '최신순 ↓' : '오래된순 ↑'}
                    </button>
                </div>

                {/* Site Select */}
                <select value={selectedSiteId} onChange={e => setSelectedSiteId(e.target.value)}
                    className="px-3 py-2 border-slate-300 rounded-lg text-sm min-w-[120px]">
                    <option value="">전체 현장</option>
                    {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>

                {/* Company Type Filter */}
                <div className="flex gap-1">
                    <button onClick={() => setCompanyTypeFilter('all')}
                        className={`px-2 py-1.5 text-xs rounded-lg font-medium ${companyTypeFilter === 'all' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600'}`}>전체</button>
                    <button onClick={() => setCompanyTypeFilter('construction')}
                        className={`px-2 py-1.5 text-xs rounded-lg font-medium ${companyTypeFilter === 'construction' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-600'}`}>시공팀</button>
                    <button onClick={() => setCompanyTypeFilter('partner')}
                        className={`px-2 py-1.5 text-xs rounded-lg font-medium ${companyTypeFilter === 'partner' ? 'bg-green-600 text-white' : 'bg-green-50 text-green-600'}`}>협력사</button>
                </div>

                {/* Team Select */}
                <select value={selectedTeamId} onChange={e => setSelectedTeamId(e.target.value)}
                    className="px-3 py-2 border-slate-300 rounded-lg text-sm min-w-[120px]">
                    <option value="">전체 팀</option>
                    {teams.filter(t => {
                        if (companyTypeFilter === 'all') return true;
                        const company = companies.find(c => c.id === t.companyId);
                        if (!company) return true;
                        if (companyTypeFilter === 'construction') return company.type === '시공사';
                        if (companyTypeFilter === 'partner') return company.type === '협력사';
                        return true;
                    }).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>

                {/* Worker Search */}
                <div className="relative flex-1 min-w-[150px]">
                    <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input type="text" value={workerSearch} onChange={e => setWorkerSearch(e.target.value)}
                        placeholder="작업자 검색" className="w-full pl-10 pr-4 py-2 border-slate-300 rounded-lg text-sm" />
                </div>

                <button onClick={fetchReports} className="px-4 py-2 bg-brand-600 text-white rounded-lg font-bold text-sm flex items-center gap-2">
                    <FontAwesomeIcon icon={faSearch} /> 조회
                </button>
            </div>

            {/* Summary */}
            <div className="flex items-center gap-4 justify-between">
                <div className="flex items-center gap-4">
                    <div className="bg-white px-4 py-2 rounded-lg shadow-sm border border-slate-200 flex items-center gap-3">
                        <span className="text-xs text-slate-500 font-bold">총 공수</span>
                        <span className="text-xl font-bold text-slate-800">{totalManDays.toFixed(1)} <span className="text-sm font-normal text-slate-500">공수</span></span>
                    </div>
                    {selectedRows.size > 0 && (
                        <div className="bg-red-50 px-4 py-2 rounded-lg border border-red-200 flex items-center gap-3">
                            <span className="text-xs text-red-600 font-bold">{selectedRows.size}개 선택됨</span>
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleSelectAll}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition"
                    >
                        {selectedRows.size === workerRows.length && workerRows.length > 0 ? '전체 해제' : '전체 선택'}
                    </button>
                    <button
                        onClick={handleBulkDelete}
                        disabled={selectedRows.size === 0 || isDeleting}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg flex items-center gap-1.5 transition ${selectedRows.size > 0 ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                    >
                        <FontAwesomeIcon icon={faTrash} />
                        {isDeleting ? '삭제 중...' : `선택 삭제 (${selectedRows.size})`}
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex-1 overflow-hidden flex flex-col">
                <div className="overflow-auto flex-1">
                    <table className="w-full text-left border-collapse text-sm">
                        <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase sticky top-0 z-10">
                            <tr>
                                <th className="px-3 py-2 border-b border-slate-200 w-10">
                                    <input
                                        type="checkbox"
                                        checked={selectedRows.size === workerRows.length && workerRows.length > 0}
                                        onChange={handleSelectAll}
                                        className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                                    />
                                </th>
                                <th className="px-3 py-2 border-b border-slate-200">날짜</th>
                                <th className="px-3 py-2 border-b border-slate-200">현장명</th>
                                <th className="px-3 py-2 border-b border-slate-200">담당팀</th>
                                <th className="px-3 py-2 border-b border-slate-200">작업팀</th>
                                <th className="px-3 py-2 border-b border-slate-200">구분</th>
                                <th className="px-3 py-2 border-b border-slate-200">작업자</th>
                                <th className="px-3 py-2 border-b border-slate-200 text-right">단가</th>
                                <th className="px-3 py-2 border-b border-slate-200 text-right">공수</th>
                                <th className="px-3 py-2 border-b border-slate-200">급여방식</th>
                                <th className="px-3 py-2 border-b border-slate-200">작업내용</th>
                                <th className="px-3 py-2 border-b border-slate-200 w-12"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {isLoading ? (
                                <tr><td colSpan={12} className="px-4 py-12 text-center text-slate-400">로딩 중...</td></tr>
                            ) : workerRows.length === 0 ? (
                                <tr><td colSpan={12} className="px-4 py-12 text-center text-slate-400">조회된 데이터가 없습니다.</td></tr>
                            ) : workerRows.map((row, idx) => {
                                const workTeam = teams.find(t => t.id === row.teamId);
                                const site = sites.find(s => s.id === row.siteId);
                                return (
                                    <tr key={`${row.reportId}-${row.workerId}-${idx}`} className={`hover:bg-slate-50 ${selectedRows.has(`${row.reportId}|${row.workerId}`) ? 'bg-red-50' : ''}`}>
                                        <td className="px-3 py-2">
                                            <input
                                                type="checkbox"
                                                checked={selectedRows.has(`${row.reportId}|${row.workerId}`)}
                                                onChange={() => handleToggleRow(row.reportId!, row.workerId)}
                                                className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                                            />
                                        </td>
                                        <td className="px-3 py-2 font-mono text-xs text-slate-600">{row.date}</td>
                                        <td className="px-3 py-2">
                                            <div className="flex items-center gap-1.5">
                                                <FontAwesomeIcon icon={faBuilding} className="text-blue-500" />
                                                <span className="font-medium text-slate-800">{row.siteName || site?.name || '-'}</span>
                                            </div>
                                        </td>
                                        <td className="px-3 py-2">
                                            <div className="flex items-center gap-1.5">
                                                <FontAwesomeIcon icon={faUsers} className="text-emerald-500" />
                                                <span className="text-slate-700">{row.responsibleTeamName || '-'}</span>
                                            </div>
                                        </td>
                                        <td className="px-3 py-2">
                                            <div className="flex items-center gap-1.5">
                                                <FontAwesomeIcon icon={resolveIcon(workTeam?.icon, faUsers)} className="text-indigo-500" />
                                                <span className="text-slate-700">{row.teamName || '-'}</span>
                                            </div>
                                        </td>
                                        <td className="px-3 py-2">
                                            {row.partnerType && (
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${row.partnerType === '시공사' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'}`}>
                                                    {row.partnerType}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-3 py-2">
                                            <div className="flex items-center gap-2">
                                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100">
                                                    <FontAwesomeIcon icon={getRoleIcon(row.role)} className="text-indigo-600 text-xs" />
                                                </span>
                                                <span className="font-medium text-slate-800">{row.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-3 py-2 text-right">
                                            {editingCell === `${row.reportId}-${row.workerId}-unitPrice` ? (
                                                <input type="number" defaultValue={row.unitPrice || 0} autoFocus
                                                    onBlur={e => {
                                                        handleInlineSave(row.reportId!, row.workerId, 'unitPrice', parseInt(e.target.value) || 0);
                                                        setEditingCell(null);
                                                    }}
                                                    onKeyDown={e => { if (e.key === 'Enter') { e.currentTarget.blur(); } }}
                                                    className="w-24 px-2 py-1 text-right bg-white border-2 border-blue-500 rounded-lg text-sm font-medium focus:outline-none" />
                                            ) : (
                                                <button
                                                    onClick={() => setEditingCell(`${row.reportId}-${row.workerId}-unitPrice`)}
                                                    className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-sm hover:bg-white hover:border-blue-300 transition-all min-w-[70px]"
                                                >
                                                    {(row.unitPrice || 0).toLocaleString()}
                                                </button>
                                            )}
                                        </td>
                                        <td className="px-3 py-2 text-right">
                                            {editingCell === `${row.reportId}-${row.workerId}-manDay` ? (
                                                <input type="number" step="0.1" defaultValue={row.manDay} autoFocus
                                                    onBlur={e => {
                                                        handleInlineSave(row.reportId!, row.workerId, 'manDay', parseFloat(e.target.value) || 0);
                                                        setEditingCell(null);
                                                    }}
                                                    onKeyDown={e => { if (e.key === 'Enter') { e.currentTarget.blur(); } }}
                                                    className="w-16 px-2 py-1 text-right bg-white border-2 border-brand-500 rounded-lg text-sm font-bold text-brand-600 focus:outline-none" />
                                            ) : (
                                                <button
                                                    onClick={() => setEditingCell(`${row.reportId}-${row.workerId}-manDay`)}
                                                    className="px-2 py-1 bg-blue-50 border border-blue-200 rounded-lg text-sm font-bold text-brand-600 hover:bg-blue-100 hover:border-brand-400 transition-all min-w-[50px]"
                                                >
                                                    {row.manDay.toFixed(1)}
                                                </button>
                                            )}
                                        </td>
                                        <td className="px-3 py-2">
                                            <select
                                                value={row.salaryModel || (row.partnerType === '협력사' ? '지원팀' : '일급제')}
                                                onChange={e => handleInlineSave(row.reportId!, row.workerId, 'salaryModel', e.target.value)}
                                                className={`px-2 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer ${row.salaryModel === '일급제' ? 'bg-blue-50 text-blue-600 border-blue-200' :
                                                    row.salaryModel === '월급제' ? 'bg-purple-50 text-purple-600 border-purple-200' :
                                                        row.salaryModel === '지원팀' ? 'bg-green-50 text-green-600 border-green-200' :
                                                            row.salaryModel === '용역팀' ? 'bg-orange-50 text-orange-600 border-orange-200' : 'bg-slate-100 text-slate-600 border-slate-200'
                                                    }`}
                                            >
                                                {row.partnerType === '협력사' ? (
                                                    <>
                                                        <option value="지원팀">지원팀</option>
                                                        <option value="용역팀">용역팀</option>
                                                    </>
                                                ) : (
                                                    <>
                                                        <option value="일급제">일급제</option>
                                                        <option value="월급제">월급제</option>
                                                    </>
                                                )}
                                            </select>
                                        </td>
                                        <td className="px-3 py-2">
                                            <input type="text" defaultValue={row.workContent || ''} placeholder="작업내용 입력"
                                                onBlur={e => handleInlineSave(row.reportId!, row.workerId, 'workContent', e.target.value)}
                                                className="w-full min-w-[150px] px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-all hover:bg-white" />
                                        </td>
                                        <td className="px-3 py-2 text-right">
                                            <button onClick={() => handleDeleteWorker(row.reportId!, row.workerId, row.name)}
                                                className="text-slate-400 hover:text-red-600 p-1 rounded hover:bg-slate-100">
                                                <FontAwesomeIcon icon={faTrash} />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default DailyReportList;
