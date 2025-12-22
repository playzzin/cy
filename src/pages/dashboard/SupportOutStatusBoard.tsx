import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faEraser, faTruckPlane } from '@fortawesome/free-solid-svg-icons';
import { dailyReportService } from '../../services/dailyReportService';
import { manpowerService } from '../../services/manpowerService';
import { siteService, Site } from '../../services/siteService';

const SupportOutStatusBoard: React.FC = () => {
    const [year, setYear] = useState(new Date().getFullYear());
    const [month, setMonth] = useState(new Date().getMonth() + 1);

    const [sites, setSites] = useState<Site[]>([]);
    const [siteStats, setSiteStats] = useState<{ [siteId: string]: number }>({});
    const [totalManDay, setTotalManDay] = useState(0);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchInitialData();
    }, []);

    useEffect(() => {
        fetchStats();
    }, [year, month]);

    const fetchInitialData = async () => {
        try {
            const fetchedSites = await siteService.getSites();
            setSites(fetchedSites);
        } catch (error) {
            console.error("Error fetching initial data:", error);
        }
    };

    const fetchStats = async () => {
        setLoading(true);
        try {
            // 1. Identify Support Workers
            const allWorkers = await manpowerService.getWorkers();
            const supportWorkerIds = new Set(
                allWorkers
                    .filter(w => w.teamType === '지원팀')
                    .map(w => w.id!)
            );

            if (supportWorkerIds.size === 0) {
                setSiteStats({});
                setTotalManDay(0);
                setLoading(false);
                return;
            }

            const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
            const lastDay = new Date(year, month, 0).getDate();
            const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;

            // 2. Fetch Reports
            const reports = await dailyReportService.getReportsByRange(startDate, endDate);

            // 3. Aggregate Man-days by Site for Support Workers only
            const stats: { [siteId: string]: number } = {};
            let total = 0;

            reports.forEach(report => {
                let siteSupportManDay = 0;

                report.workers.forEach(rw => {
                    if (supportWorkerIds.has(rw.workerId)) {
                        siteSupportManDay += rw.manDay;
                    }
                });

                if (siteSupportManDay > 0) {
                    stats[report.siteId] = (stats[report.siteId] || 0) + siteSupportManDay;
                    total += siteSupportManDay;
                }
            });

            setSiteStats(stats);
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

    return (
        <div className="flex flex-col h-full bg-slate-100">
            {/* Header & Filters */}
            <div className="bg-white border-b border-slate-200 p-4 shadow-sm">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-4">
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <FontAwesomeIcon icon={faTruckPlane} className="text-teal-600" />
                        지원간 공수 현황판
                    </h1>
                </div>

                <div className="flex flex-wrap items-end gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
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
                        <div className="bg-teal-600 text-white px-4 py-2 rounded shadow-sm text-center min-w-[100px]">
                            <div className="text-xs font-bold opacity-80">지원간 총공수</div>
                            <div className="text-xl font-bold">{totalManDay.toFixed(1)}</div>
                        </div>
                    </div>

                    {/* Buttons */}
                    <div className="flex gap-2">
                        <button
                            onClick={fetchStats}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-bold transition-colors flex items-center gap-2"
                        >
                            <FontAwesomeIcon icon={faSearch} />
                            조회
                        </button>
                        <button
                            onClick={handleClear}
                            className="bg-slate-500 hover:bg-slate-600 text-white px-4 py-2 rounded text-sm font-bold transition-colors flex items-center gap-2"
                        >
                            <FontAwesomeIcon icon={faEraser} />
                            CLEAR
                        </button>
                    </div>
                </div>
            </div>

            {/* Grid Content */}
            <div className="flex-1 overflow-auto p-4">
                {loading ? (
                    <div className="flex justify-center items-center h-full text-slate-500">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mr-2"></div>
                        데이터를 불러오는 중입니다...
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-0 border-t border-l border-slate-300 bg-white">
                        {sites.map((site, index) => {
                            const manDay = siteStats[site.id!] || 0;

                            // Only show sites that received support? 
                            // Or show all sites to indicate zero support?
                            // Usually "Status Board" shows all entities.

                            return (
                                <div key={site.id} className="border-r border-b border-slate-300 flex flex-col h-24 relative group hover:bg-teal-50 transition-colors">
                                    <div className="absolute top-1 left-2 text-xs text-slate-400 font-mono">
                                        {index + 1}
                                    </div>
                                    <div className="flex-1 flex items-center justify-center p-2 text-center border-b border-slate-100">
                                        <span className="text-xs font-bold text-slate-700 line-clamp-2 leading-tight">
                                            {site.name}
                                        </span>
                                    </div>
                                    <div className="h-10 flex items-center justify-center bg-slate-50 group-hover:bg-teal-100 transition-colors">
                                        <span className={`text-lg font-bold ${manDay > 0 ? 'text-teal-600' : 'text-slate-300'}`}>
                                            {manDay.toFixed(1)}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default SupportOutStatusBoard;
