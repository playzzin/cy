import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChartSimple, faList, faSpinner, faBuilding, faArrowRight, faCalendar } from '@fortawesome/free-solid-svg-icons';
import { teamService, Team } from '../../services/teamService';
import { siteService, Site } from '../../services/siteService';
import { companyService, Company } from '../../services/companyService';
import { dailyReportService } from '../../services/dailyReportService';
// @ts-ignore
import ReactDatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { ko } from 'date-fns/locale/ko';

interface SupportRecord {
    id: string; // Composite key
    date: string;
    providerTeamId: string;
    providerTeamName: string;
    providerCompanyId: string;
    receiverSiteId: string;
    receiverSiteName: string;
    receiverCompanyId: string; // Site's company
    manDay: number;
    teamRate: number;
    totalAmount: number;
    isExternal: boolean; // True if companies differ
}

interface MatrixCell {
    manDay: number;
    amount: number;
    records: SupportRecord[];
}

const SupportStatusPage: React.FC = () => {
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [viewMode, setViewMode] = useState<'matrix' | 'list'>('matrix');
    const [loading, setLoading] = useState(true);

    const [teams, setTeams] = useState<Team[]>([]);
    const [sites, setSites] = useState<Site[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [records, setRecords] = useState<SupportRecord[]>([]);

    useEffect(() => {
        fetchData();
    }, [selectedDate]);

    const pad2 = (n: number) => String(n).padStart(2, '0');
    const toYmd = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    const parseYmdLocal = (ymd: string): Date => {
        const [y, m, day] = String(ymd).split('-').map((v) => Number(v));
        if (!y || !m || !day) return new Date(ymd);
        return new Date(y, m - 1, day);
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Load Master Data
            const [teamsData, sitesData, companiesData] = await Promise.all([
                teamService.getTeams(),
                siteService.getSites(),
                companyService.getCompanies()
            ]);

            setTeams(teamsData);
            setSites(sitesData);
            setCompanies(companiesData);

            // 2. Load Daily Reports for the month
            const startOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
            const endOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
            const reports = await dailyReportService.getReportsByRange(toYmd(startOfMonth), toYmd(endOfMonth));
            const rawRecords: SupportRecord[] = [];

            const findTeam = (id: string | undefined) => {
                const raw = id ? String(id) : '';
                if (!raw) return undefined;
                return teamsData.find(t => String(t.id ?? '') === raw || String(t.legacyId ?? '') === raw);
            };

            const findSite = (id: string | undefined) => {
                const raw = id ? String(id) : '';
                if (!raw) return undefined;
                return sitesData.find(s => String(s.id ?? '') === raw || String(s.legacyId ?? '') === raw);
            };

            reports.forEach((report: any) => {
                const reportId = report?.id ? String(report.id) : '';
                const site = findSite(report?.siteId);
                const reportDate = report?.date ? String(report.date) : '';
                const displayDate = reportDate ? parseYmdLocal(reportDate).toLocaleDateString() : '';

                const workerList = Array.isArray(report?.workers) ? report.workers : [];
                workerList.forEach((entry: any) => {
                    const providerTeamIdRaw = entry?.teamId ? String(entry.teamId) : (report?.teamId ? String(report.teamId) : '');
                    const team = findTeam(providerTeamIdRaw);
                    if (!team || !site) return;

                    const providerCompanyId = team.companyId || 'unknown';
                    const receiverCompanyId = site.companyId || 'unknown';
                    const isExternal = providerCompanyId !== receiverCompanyId;

                    const rate = team.supportRate || 0;
                    const manDay = typeof entry?.manDay === 'number' ? entry.manDay : 0;
                    const amount = manDay * rate;

                    rawRecords.push({
                        id: `${reportId}_${String(entry?.workerId ?? '')}`,
                        date: displayDate,
                        providerTeamId: team.id!,
                        providerTeamName: team.name,
                        providerCompanyId: providerCompanyId,
                        receiverSiteId: site.id!,
                        receiverSiteName: site.name,
                        receiverCompanyId: receiverCompanyId,
                        manDay,
                        teamRate: rate,
                        totalAmount: amount,
                        isExternal
                    });
                });
            });

            console.log("Processed Records:", rawRecords.length);
            setRecords(rawRecords);

        } catch (error) {
            console.error("Error fetching support data:", error);
        } finally {
            setLoading(false);
        }
    };

    // --- Helpers ---
    const getCompany = (id: string) => companies.find(c => c.id === id);

    // Matrix Data Preparation
    // Rows: Teams (Provider), Columns: Sites/Companies (Receiver)
    // Actually, User wants "Which Team provided to Which Site/Company".
    // Columns should be grouped by Company -> Site ?? Too wide.
    // Let's make Columns = Sites (Grouped by Company in Header if possible, or just Site Name (Company Name))

    // Filter out records with 0 amount? or just show manDay?
    // User wants "Support". If Rate is 0, Amount is 0, but ManDay exists. Show it.

    const uniqueTeams = Array.from(new Set(records.map(r => r.providerTeamId)))
        .map(id => teams.find(t => t.id === id))
        .filter((t): t is Team => Boolean(t));
    const uniqueSites = Array.from(new Set(records.map(r => r.receiverSiteId)))
        .map(id => sites.find(s => s.id === id))
        .filter((s): s is Site => Boolean(s));

    // Group Sites by Company for sorting/display
    uniqueSites.sort((a, b) => (a.companyName || '').localeCompare(b.companyName || ''));

    const getCellData = (teamId: string, siteId: string): MatrixCell => {
        const matches = records.filter(r => r.providerTeamId === teamId && r.receiverSiteId === siteId);
        return {
            manDay: matches.reduce((sum, r) => sum + r.manDay, 0),
            amount: matches.reduce((sum, r) => sum + r.totalAmount, 0),
            records: matches
        };
    };

    return (
        <div className="p-6 bg-slate-50 min-h-screen">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <FontAwesomeIcon icon={faChartSimple} className="text-indigo-600" />
                        지원 현황판 (Support Status)
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">
                        팀별 지원(파견) 내역과 정산 예상 금액을 확인합니다.
                    </p>
                </div>

                <div className="flex gap-3">
                    <div className="bg-white border border-slate-200 rounded-lg flex items-center px-3 py-2 shadow-sm">
                        <FontAwesomeIcon icon={faCalendar} className="text-slate-400 mr-2" />
                        <ReactDatePicker
                            selected={selectedDate}
                            onChange={(date: Date | null) => date && setSelectedDate(date)}
                            dateFormat="yyyy년 MM월"
                            showMonthYearPicker
                            locale={ko}
                            className="bg-transparent outline-none font-medium w-24 text-center cursor-pointer"
                        />
                    </div>

                    <div className="bg-white border border-slate-200 rounded-lg p-1 flex shadow-sm">
                        <button
                            onClick={() => setViewMode('matrix')}
                            className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${viewMode === 'matrix' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                            <FontAwesomeIcon icon={faChartSimple} className="mr-2" />
                            매트릭스
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${viewMode === 'list' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                            <FontAwesomeIcon icon={faList} className="mr-2" />
                            상세 내역
                        </button>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center items-center h-64">
                    <FontAwesomeIcon icon={faSpinner} spin className="text-3xl text-indigo-500" />
                </div>
            ) : (
                <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm">
                            <h3 className="text-slate-500 text-sm font-medium mb-1">총 지원 공수</h3>
                            <p className="text-2xl font-bold text-slate-800">
                                {records.reduce((sum, r) => sum + r.manDay, 0).toFixed(1)} <span className="text-sm font-normal text-slate-400">공수</span>
                            </p>
                        </div>
                        <div className="bg-white p-5 rounded-xl border border-red-100 shadow-sm relative overflow-hidden">
                            <div className="absolute right-0 top-0 w-16 h-16 bg-red-500/10 rounded-bl-full"></div>
                            <h3 className="text-red-500 text-sm font-medium mb-1">외부 지원 정산 (청구 대상)</h3>
                            <p className="text-2xl font-bold text-slate-800">
                                {records.filter(r => r.isExternal).reduce((sum, r) => sum + r.totalAmount, 0).toLocaleString()} <span className="text-sm font-normal text-slate-400">원</span>
                            </p>
                            <p className="text-xs text-red-400 mt-1">* 타사 현장 파견 (세금계산서)</p>
                        </div>
                        <div className="bg-white p-5 rounded-xl border border-blue-100 shadow-sm">
                            <h3 className="text-blue-500 text-sm font-medium mb-1">내부 지원 정산 (원가 관리)</h3>
                            <p className="text-2xl font-bold text-slate-800">
                                {records.filter(r => !r.isExternal).reduce((sum, r) => sum + r.totalAmount, 0).toLocaleString()} <span className="text-sm font-normal text-slate-400">원</span>
                            </p>
                            <p className="text-xs text-blue-400 mt-1">* 자사 현장 파견 (내부 이체)</p>
                        </div>
                    </div>

                    {viewMode === 'matrix' ? (
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
                            <table className="w-full text-sm border-collapse">
                                <thead>
                                    <tr>
                                        <th className="p-3 border text-left bg-slate-50 min-w-[150px] sticky left-0 z-10 font-bold text-slate-700">
                                            현장 (Receiver) ↓ / 팀 (Provider) →
                                        </th>
                                        {uniqueTeams.map(team => (
                                            <th key={team.id} className="p-3 border bg-slate-50 min-w-[120px] text-center">
                                                <div className="font-semibold text-slate-700">{team.name}</div>
                                                <div className="text-xs text-indigo-500 font-normal">@{team.supportRate?.toLocaleString() || 0}원</div>
                                            </th>
                                        ))}
                                        <th className="p-3 border bg-slate-100 min-w-[100px] text-center font-bold">합계</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {uniqueSites.map(site => {
                                        let rowTotalAmount = 0;
                                        let rowTotalManDay = 0;

                                        return (
                                            <tr key={site.id} className="hover:bg-slate-50">
                                                <td className="p-3 border bg-white sticky left-0 z-10 font-medium text-slate-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                                    {site.name}
                                                    <div className="text-xs text-slate-400 font-normal mt-0.5">
                                                        {site.companyName || '미지정'}
                                                    </div>
                                                </td>
                                                {uniqueTeams.map(team => {
                                                    const cell = getCellData(team.id!, site.id!);
                                                    rowTotalAmount += cell.amount;
                                                    rowTotalManDay += cell.manDay;

                                                    // Determine color based on Internal/External logic
                                                    const isExt = (team.companyId || 'A') !== (site.companyId || 'B');

                                                    if (cell.manDay === 0) return <td key={team.id} className="p-3 border text-center text-slate-200">-</td>;

                                                    return (
                                                        <td key={team.id} className={`p-3 border text-center ${isExt ? 'bg-red-50/30' : 'bg-blue-50/30'}`}>
                                                            <div className="font-bold text-slate-700">{cell.amount.toLocaleString()}</div>
                                                            <div className="text-xs text-slate-500">({cell.manDay.toFixed(1)}공수)</div>
                                                            <div className={`text-[10px] mt-0.5 inline-block px-1.5 rounded ${isExt ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                                                                {isExt ? '외부' : '내부'}
                                                            </div>
                                                        </td>
                                                    );
                                                })}
                                                <td className="p-3 border bg-slate-50 text-center font-bold text-slate-800">
                                                    {rowTotalAmount.toLocaleString()}
                                                    <div className="text-xs text-slate-500 font-normal">({rowTotalManDay.toFixed(1)})</div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {records.map((record, idx) => (
                                <div key={idx} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-2 h-12 rounded-full ${record.isExternal ? 'bg-red-500' : 'bg-green-500'}`}></div>
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`text-xs px-2 py-0.5 rounded font-bold ${record.isExternal ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                                                    {record.isExternal ? '외부지원' : '내부지원'}
                                                </span>
                                                <span className="text-xs text-slate-400">{record.date}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-slate-800 font-medium">
                                                <span>{record.providerTeamName}</span>
                                                <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200">
                                                    {getCompany(record.providerCompanyId)?.name || '소속불명'}
                                                </span>
                                                <FontAwesomeIcon icon={faArrowRight} className="text-slate-300 text-xs" />
                                                <span>{record.receiverSiteName}</span>
                                                <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200">
                                                    {getCompany(record.receiverCompanyId)?.name || '소속불명'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="text-right">
                                        <div className="text-xl font-bold text-slate-800">
                                            {record.totalAmount.toLocaleString()}원
                                        </div>
                                        <div className="text-xs text-slate-500 mt-1 flex items-center justify-end gap-1 bg-slate-50 px-2 py-1 rounded">
                                            <span>산출공식:</span>
                                            <span className="font-semibold">{record.manDay.toFixed(1)} 공수</span>
                                            <span>×</span>
                                            <span className="font-semibold">{record.teamRate.toLocaleString()}원</span>
                                            <span>(단가)</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {records.length === 0 && (
                                <div className="text-center py-20 text-slate-400 bg-white rounded-xl border border-slate-200">
                                    데이터가 없습니다.
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default SupportStatusPage;
