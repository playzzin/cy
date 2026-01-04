import React, { useState, useEffect, useMemo } from 'react';
import { dailyReportService, DailyReport, DailyReportWorker } from '../../services/dailyReportService';
import { teamService, Team } from '../../services/teamService';
import { siteService, Site } from '../../services/siteService';
import { companyService, Company } from '../../services/companyService';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faSearch, faCalendarAlt, faSortAmountDown, faSortAmountUp
} from '@fortawesome/free-solid-svg-icons';
import DailyReportCard from './components/DailyReportCard';

interface DailyReportListProps {
    initialDate?: string;
}

const DailyReportList: React.FC<DailyReportListProps> = ({ initialDate }) => {
    const [reports, setReports] = useState<DailyReport[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [sites, setSites] = useState<Site[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
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

    useEffect(() => { fetchInitialData(); }, []);
    useEffect(() => { fetchReports(); }, [startDate, endDate, selectedTeamId, selectedSiteId]);

    const fetchInitialData = async () => {
        try {
            const [teamsData, sitesData, companiesData] = await Promise.all([
                teamService.getTeams(), siteService.getSites(), companyService.getCompanies()
            ]);
            setTeams(teamsData);
            setSites(sitesData);
            setCompanies(companiesData);
        } catch (error) { console.error("Failed to fetch initial data", error); }
    };

    const fetchReports = async () => {
        setIsLoading(true);
        try {
            const data = await dailyReportService.getReportsByRange(startDate, endDate, selectedTeamId);
            // Apply Site Filter locally
            let filtered = selectedSiteId ? data.filter(r => r.siteId === selectedSiteId) : data;
            setReports(filtered);
        } catch (error) { console.error("Failed to fetch reports", error); }
        finally { setIsLoading(false); }
    };

    // --- Actions ---

    const handleUpdateWorker = async (reportId: string, workerId: string, field: keyof DailyReportWorker, value: any) => {
        try {
            await dailyReportService.updateWorkerInReport(reportId, workerId, { [field]: value });
            // Optimistic update or fetch? Small scale, fetch is safer for consistent totals
            fetchReports();
        } catch (error) { throw error; }
    };

    const handleDeleteWorker = async (reportId: string, workerId: string, workerName: string) => {
        if (!window.confirm(`"${workerName}"를 삭제하시겠습니까?`)) return;
        try {
            await dailyReportService.removeWorkerFromReport(reportId, workerId);
            fetchReports();
        } catch (error) { throw error; }
    };

    const handleUpdateReport = async (reportId: string, field: keyof DailyReport, value: any) => {
        try {
            const report = reports.find(r => r.id === reportId);
            if (!report) return;

            // Using updateReport to ensure consistency, even though it's heavy
            await dailyReportService.updateReport(reportId, { ...report, [field]: value, workers: report.workers });
            fetchReports();
        } catch (error) { console.error("Update report failed", error); }
    };


    // --- Filtering & Grouping ---

    const filteredReports = useMemo(() => {
        let result = reports;

        // 1. Worker Search
        if (workerSearch.trim()) {
            const lower = workerSearch.toLowerCase();
            result = result.filter(r =>
                r.workers.some(w => w.name.toLowerCase().includes(lower) || w.role.includes(lower))
            );
        }

        // 2. Company Type Filter
        if (companyTypeFilter !== 'all') {
            result = result.filter(r => {
                const team = teams.find(t => t.id === r.teamId);
                if (!team?.companyId) return true; // Keep if unknown
                const company = companies.find(c => c.id === team.companyId);
                if (!company) return true;
                return company.type === (companyTypeFilter === 'construction' ? '시공사' : '협력사');
            });
        }

        return result;
    }, [reports, workerSearch, companyTypeFilter, teams, companies]);

    // Group by Date
    const groupedReports = useMemo(() => {
        const groups: { [date: string]: DailyReport[] } = {};
        filteredReports.forEach(r => {
            if (!groups[r.date]) groups[r.date] = [];
            groups[r.date].push(r);
        });
        return groups;
    }, [filteredReports]);

    const sortedDates = useMemo(() => {
        const dates = Object.keys(groupedReports);
        return dates.sort((a, b) => dateSortOrder === 'asc' ? a.localeCompare(b) : b.localeCompare(a));
    }, [groupedReports, dateSortOrder]);

    // Calculate Totals
    const totalManDays = useMemo(() => filteredReports.reduce((sum, r) => sum + r.totalManDay, 0), [filteredReports]);


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

                    <button onClick={() => setDateSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                        className={`px-3 py-2 text-sm rounded-lg font-medium flex items-center gap-2 transition-colors ${dateSortOrder === 'desc' ? 'bg-indigo-50 text-indigo-600' : 'bg-amber-50 text-amber-600'}`}>
                        <FontAwesomeIcon icon={dateSortOrder === 'desc' ? faSortAmountDown : faSortAmountUp} />
                    </button>
                </div>

                {/* Site Select */}
                <select value={selectedSiteId} onChange={e => setSelectedSiteId(e.target.value)}
                    className="px-3 py-2 border-slate-300 rounded-lg text-sm min-w-[120px]">
                    <option value="">전체 현장</option>
                    {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>

                {/* Company Type Filter */}
                <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
                    <button onClick={() => setCompanyTypeFilter('all')}
                        className={`px-3 py-1.5 text-xs rounded-md font-bold transition-all ${companyTypeFilter === 'all' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>전체</button>
                    <button onClick={() => setCompanyTypeFilter('construction')}
                        className={`px-3 py-1.5 text-xs rounded-md font-bold transition-all ${companyTypeFilter === 'construction' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-blue-600'}`}>시공팀</button>
                    <button onClick={() => setCompanyTypeFilter('partner')}
                        className={`px-3 py-1.5 text-xs rounded-md font-bold transition-all ${companyTypeFilter === 'partner' ? 'bg-white text-green-600 shadow-sm' : 'text-slate-500 hover:text-green-600'}`}>협력사</button>
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
                        placeholder="작업자 검색" className="w-full pl-10 pr-4 py-2 border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all" />
                </div>

                <div className="bg-slate-800 text-white px-4 py-2 rounded-lg shadow-sm flex items-center gap-2">
                    <span className="text-xs font-light text-slate-300">Total</span>
                    <span className="font-bold text-lg">{totalManDays.toFixed(1)}</span>
                    <span className="text-xs">공수</span>
                </div>
            </div>

            {/* List Content */}
            <div className="flex-1 overflow-y-auto pr-2 pb-10 custom-scrollbar">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center h-64 opacity-50">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600 mb-2"></div>
                        <span className="text-sm font-medium text-slate-500">불러오는 중...</span>
                    </div>
                ) : filteredReports.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                        <FontAwesomeIcon icon={faSearch} className="text-4xl mb-3 opacity-20" />
                        <span className="text-sm">조건에 맞는 일보가 없습니다.</span>
                    </div>
                ) : (
                    <div className="flex flex-col gap-8">
                        {sortedDates.map(date => (
                            <div key={date} className="flex flex-col gap-4">
                                {/* Date Divider */}
                                <div className="flex items-center gap-4">
                                    <div className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold border border-slate-200 shadow-sm">
                                        {date}
                                        <span className="ml-2 px-1.5 py-0.5 bg-slate-200 rounded-full text-[10px] text-slate-500">
                                            {new Date(date).toLocaleDateString('ko-KR', { weekday: 'long' })}
                                        </span>
                                    </div>
                                    <div className="h-px bg-slate-200 flex-1"></div>
                                </div>

                                {/* Cards Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 items-start">
                                    {groupedReports[date].map(report => (
                                        <DailyReportCard
                                            key={report.id}
                                            report={report}
                                            onUpdateWorker={handleUpdateWorker}
                                            onDeleteWorker={handleDeleteWorker}
                                            onUpdateReport={handleUpdateReport}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent; 
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #cbd5e1; 
                    border-radius: 3px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #94a3b8; 
                }
            `}</style>
        </div>
    );
};

export default DailyReportList;
