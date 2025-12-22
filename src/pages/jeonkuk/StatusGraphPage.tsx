import React, { useState, useEffect, useMemo } from 'react';
import {
    LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    AreaChart, Area
} from 'recharts';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faChartPie, faCalendarAlt, faBuilding, faUserGroup,
    faSearch, faDownload, faChartLine, faChartBar
} from '@fortawesome/free-solid-svg-icons';
import { dailyReportService } from '../../services/dailyReportService';
import { siteService, Site } from '../../services/siteService';
import { teamService, Team } from '../../services/teamService';
import { companyService, Company } from '../../services/companyService';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#8dd1e1'];

const StatusGraphPage: React.FC = () => {
    const [year, setYear] = useState(new Date().getFullYear());
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [loading, setLoading] = useState(false);

    // Filters
    const [selectedCompanyId, setSelectedCompanyId] = useState('');
    const [selectedTeamId, setSelectedTeamId] = useState('');

    // Data
    const [companies, setCompanies] = useState<Company[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [sites, setSites] = useState<Site[]>([]);
    const [rawReports, setRawReports] = useState<any[]>([]);

    useEffect(() => {
        loadInitialData();
    }, []);

    useEffect(() => {
        fetchReports();
    }, [year, month]);

    const loadInitialData = async () => {
        try {
            const [fetchedSites, fetchedCompanies, fetchedTeams] = await Promise.all([
                siteService.getSites(),
                companyService.getCompanies(),
                teamService.getTeams()
            ]);
            setSites(fetchedSites);
            setCompanies(fetchedCompanies);
            setTeams(fetchedTeams);

            // Set default company if "청연" exists
            const defaultCompany = fetchedCompanies.find(c => c.name.includes('청연'));
            if (defaultCompany) setSelectedCompanyId(defaultCompany.id!);
        } catch (error) {
            console.error("Error loading metadata:", error);
        }
    };

    const fetchReports = async () => {
        setLoading(true);
        try {
            const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
            const lastDay = new Date(year, month, 0).getDate();
            const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;
            const reports = await dailyReportService.getReportsByRange(startDate, endDate);
            setRawReports(reports);
        } catch (error) {
            console.error("Error fetching reports:", error);
        } finally {
            setLoading(false);
        }
    };

    // Process Data for Charts
    const { dailyTrend, siteComparison, teamDistribution, kpi } = useMemo(() => {
        if (!rawReports.length) return { dailyTrend: [], siteComparison: [], teamDistribution: [], kpi: { totalManDay: 0, totalAmount: 0, distinctWorkers: 0 } };

        let filtered = rawReports;

        // Apply Filters
        if (selectedCompanyId) {
            const companyTeams = teams.filter(t => t.companyId === selectedCompanyId).map(t => t.id);
            const companySites = sites.filter(s => s.companyId === selectedCompanyId).map(s => s.id);
            filtered = filtered.filter(r => companyTeams.includes(r.teamId) || companySites.includes(r.siteId));
        }
        if (selectedTeamId) {
            filtered = filtered.filter(r => r.teamId === selectedTeamId);
        }

        // 1. KPI Calculation
        let totalManDay = 0;
        let totalAmount = 0;
        const workerSet = new Set<string>();

        filtered.forEach(r => {
            totalManDay += (r.totalManDay || 0);
            totalAmount += (r.totalAmount || 0);
            if (r.workers) {
                r.workers.forEach((w: any) => workerSet.add(w.name)); // Ideally use ID
            }
        });

        // 2. Daily Trend (Line Chart)
        const daysInMonth = new Date(year, month, 0).getDate();
        const dailyMap = new Map<number, number>();
        for (let i = 1; i <= daysInMonth; i++) dailyMap.set(i, 0);

        filtered.forEach(r => {
            const day = new Date(r.date).getDate();
            dailyMap.set(day, (dailyMap.get(day) || 0) + (r.totalManDay || 0));
        });

        const dailyTrend = Array.from(dailyMap.entries()).map(([day, value]) => ({
            name: `${day}일`,
            공수: value
        }));

        // 3. Site Comparison (Bar Chart)
        const siteMap = new Map<string, number>();
        filtered.forEach(r => {
            const siteName = r.siteName || 'Unknown Site';
            siteMap.set(siteName, (siteMap.get(siteName) || 0) + (r.totalManDay || 0));
        });

        const siteComparison = Array.from(siteMap.entries())
            .map(([name, value]) => ({ name, 공수: value }))
            .sort((a, b) => b.공수 - a.공수)
            .slice(0, 10); // Top 10

        // 4. Team Distribution (Pie Chart)
        const teamMap = new Map<string, number>();
        filtered.forEach(r => {
            const teamName = r.teamName || 'Unknown Team';
            teamMap.set(teamName, (teamMap.get(teamName) || 0) + (r.totalManDay || 0));
        });

        const teamDistribution = Array.from(teamMap.entries())
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);

        return {
            dailyTrend,
            siteComparison,
            teamDistribution,
            kpi: {
                totalManDay,
                totalAmount,
                distinctWorkers: workerSet.size
            }
        };
    }, [rawReports, selectedCompanyId, selectedTeamId, year, month, teams, sites]);

    return (
        <div className="flex flex-col h-full bg-slate-50 overflow-y-auto">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 p-6 shadow-sm">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                            <FontAwesomeIcon icon={faChartPie} className="text-indigo-600" />
                            현황 그래프 대시보드
                        </h1>
                        <p className="text-slate-500 text-sm mt-1 ml-9">
                            {year}년 {month}월 통합 작업 현황을 시각적으로 확인합니다.
                        </p>
                    </div>

                    <div className="flex items-center gap-3 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
                        <select
                            value={year}
                            onChange={(e) => setYear(Number(e.target.value))}
                            className="bg-transparent font-bold text-slate-700 px-2 py-1 focus:outline-none"
                        >
                            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
                                <option key={y} value={y}>{y}년</option>
                            ))}
                        </select>
                        <span className="text-slate-300">|</span>
                        <select
                            value={month}
                            onChange={(e) => setMonth(Number(e.target.value))}
                            className="bg-transparent font-bold text-slate-700 px-2 py-1 focus:outline-none"
                        >
                            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                <option key={m} value={m}>{m}월</option>
                            ))}
                        </select>
                        <button
                            onClick={fetchReports}
                            className="bg-white text-indigo-600 w-8 h-8 rounded-lg shadow-sm flex items-center justify-center hover:bg-indigo-50 transition-colors"
                        >
                            <FontAwesomeIcon icon={faSearch} spin={loading} />
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap gap-3">
                    <select
                        value={selectedCompanyId}
                        onChange={(e) => setSelectedCompanyId(e.target.value)}
                        className="bg-white border border-slate-300 text-slate-700 text-sm rounded-lg px-3 py-2 w-48 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                        <option value="">전체 회사</option>
                        {companies.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>

                    <select
                        value={selectedTeamId}
                        onChange={(e) => setSelectedTeamId(e.target.value)}
                        className="bg-white border border-slate-300 text-slate-700 text-sm rounded-lg px-3 py-2 w-48 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                        <option value="">전체 팀</option>
                        {teams
                            .filter(t => !selectedCompanyId || t.companyId === selectedCompanyId)
                            .map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))
                        }
                    </select>
                </div>
            </div>

            {/* Content */}
            <div className="p-6 md:p-8 space-y-6 max-w-[1920px] mx-auto w-full">

                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500 mb-1">총 투입 공수</p>
                            <h3 className="text-3xl font-black text-slate-800 tracking-tight">
                                {kpi.totalManDay.toFixed(1)}
                                <span className="text-lg text-slate-400 ml-1 font-bold">MD</span>
                            </h3>
                        </div>
                        <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-xl flex items-center justify-center text-xl">
                            <FontAwesomeIcon icon={faChartLine} />
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500 mb-1">총 노무비 (추정)</p>
                            <h3 className="text-3xl font-black text-slate-800 tracking-tight">
                                {(kpi.totalAmount / 10000).toLocaleString()}
                                <span className="text-lg text-slate-400 ml-1 font-bold">만원</span>
                            </h3>
                        </div>
                        <div className="w-12 h-12 bg-emerald-50 text-emerald-500 rounded-xl flex items-center justify-center text-xl">
                            <i className="fa-solid fa-won-sign"></i>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500 mb-1">참여 작업자</p>
                            <h3 className="text-3xl font-black text-slate-800 tracking-tight">
                                {kpi.distinctWorkers}
                                <span className="text-lg text-slate-400 ml-1 font-bold">명</span>
                            </h3>
                        </div>
                        <div className="w-12 h-12 bg-orange-50 text-orange-500 rounded-xl flex items-center justify-center text-xl">
                            <FontAwesomeIcon icon={faUserGroup} />
                        </div>
                    </div>
                </div>

                {/* Charts Area */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[500px]">
                    {/* Left: Daily Trend */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
                        <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                            <FontAwesomeIcon icon={faCalendarAlt} className="text-indigo-500" />
                            월간 일별 공수 추이
                        </h3>
                        <div className="flex-1 w-full min-h-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={dailyTrend}>
                                    <defs>
                                        <linearGradient id="colorManDay" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8} />
                                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        formatter={(value: number) => [value.toFixed(1) + ' MD', '공수']}
                                    />
                                    <Area type="monotone" dataKey="공수" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorManDay)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Right: Site Comparison */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
                        <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                            <FontAwesomeIcon icon={faBuilding} className="text-indigo-500" />
                            현장별 투입 공수 Top 10
                        </h3>
                        <div className="flex-1 w-full min-h-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={siteComparison} layout="vertical" margin={{ left: 40 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#E2E8F0" />
                                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} />
                                    <YAxis dataKey="name" type="category" width={100} axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        cursor={{ fill: '#F1F5F9' }}
                                        formatter={(value: number) => [value.toFixed(1) + ' MD', '공수']}
                                    />
                                    <Bar dataKey="공수" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* Bottom: Team Distribution */}
                <div className="grid grid-cols-1 gap-6 h-[400px]">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
                        <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                            <FontAwesomeIcon icon={faChartPie} className="text-indigo-500" />
                            팀별 공수 점유율
                        </h3>
                        <div className="flex-1 w-full min-h-0 flex items-center justify-center">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={teamDistribution}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        label={({ name, percent }: any) => (percent && percent > 0.05) ? `${name} ${(percent * 100).toFixed(0)}%` : ''}
                                        outerRadius={140}
                                        fill="#8884d8"
                                        dataKey="value"
                                    >
                                        {teamDistribution.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        formatter={(value: number) => [value.toFixed(1) + ' MD', '공수']}
                                    />
                                    <Legend layout="vertical" verticalAlign="middle" align="right" />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default StatusGraphPage;
