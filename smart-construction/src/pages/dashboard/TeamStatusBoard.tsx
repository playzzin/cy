import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faEraser, faChartBar, faUserGroup } from '@fortawesome/free-solid-svg-icons';
import { dailyReportService } from '../../services/dailyReportService';
import { teamService, Team } from '../../services/teamService';
import { siteService, Site } from '../../services/siteService';

const TeamStatusBoard: React.FC = () => {
    const [year, setYear] = useState(new Date().getFullYear());
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [selectedSiteId, setSelectedSiteId] = useState<string>('');
    const [teams, setTeams] = useState<Team[]>([]);
    const [sites, setSites] = useState<Site[]>([]);
    const [teamStats, setTeamStats] = useState<{ [teamId: string]: number }>({});
    const [totalManDay, setTotalManDay] = useState(0);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchInitialData();
    }, []);

    useEffect(() => {
        fetchStats();
    }, [year, month, selectedSiteId, teams]);

    const fetchInitialData = async () => {
        try {
            const [fetchedTeams, fetchedSites] = await Promise.all([
                teamService.getTeams(),
                siteService.getSites()
            ]);
            setTeams(fetchedTeams);
            setSites(fetchedSites);
        } catch (error) {
            console.error("Error fetching initial data:", error);
        }
    };

    const fetchStats = async () => {
        setLoading(true);
        try {
            const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
            const lastDay = new Date(year, month, 0).getDate();
            const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;

            // Fetch reports for the date range
            // Pass siteId filter if selected
            const reports = await dailyReportService.getReportsByRange(startDate, endDate, undefined, selectedSiteId || undefined);

            // Aggregate stats
            const stats: { [teamId: string]: number } = {};
            let total = 0;

            reports.forEach(report => {
                const teamId = report.teamId;
                const manDay = report.totalManDay || 0;

                stats[teamId] = (stats[teamId] || 0) + manDay;
                total += manDay;
            });

            setTeamStats(stats);
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
        setSelectedSiteId('');
    };

    return (
        <div className="flex flex-col h-full bg-slate-100">
            {/* Header & Filters */}
            <div className="bg-white border-b border-slate-200 p-4 shadow-sm">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-4">
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <FontAwesomeIcon icon={faUserGroup} className="text-indigo-600" />
                        팀별 공수 현황카드
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

                    {/* Site Filter */}
                    <div className="flex flex-col min-w-[200px]">
                        <label className="text-xs font-bold text-slate-500 mb-1">현장 선택</label>
                        <select
                            value={selectedSiteId}
                            onChange={(e) => setSelectedSiteId(e.target.value)}
                            className="border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                        >
                            <option value="">전체 현장</option>
                            {sites.map(site => (
                                <option key={site.id} value={site.id}>{site.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Summary Box */}
                    <div className="flex items-center gap-2 ml-auto">
                        <div className="bg-indigo-600 text-white px-4 py-2 rounded shadow-sm text-center min-w-[100px]">
                            <div className="text-xs font-bold opacity-80">총공수</div>
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
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mr-2"></div>
                        데이터를 불러오는 중입니다...
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-0 border-t border-l border-slate-300 bg-white">
                        {teams.map((team, index) => {
                            const manDay = teamStats[team.id!] || 0;
                            return (
                                <div key={team.id} className="border-r border-b border-slate-300 flex flex-col h-24 relative group hover:bg-indigo-50 transition-colors">
                                    <div className="absolute top-1 left-2 text-xs text-slate-400 font-mono">
                                        {index + 1}
                                    </div>
                                    <div className="flex-1 flex items-center justify-center p-2 text-center border-b border-slate-100">
                                        <span className="text-xs font-bold text-slate-700 line-clamp-2 leading-tight">
                                            {team.name}
                                        </span>
                                    </div>
                                    <div className="h-10 flex items-center justify-center bg-slate-50 group-hover:bg-indigo-100 transition-colors">
                                        <span className={`text-lg font-bold ${manDay > 0 ? 'text-indigo-600' : 'text-slate-300'}`}>
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

export default TeamStatusBoard;
