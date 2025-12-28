import React, { useEffect, useState, useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faExchangeAlt, faSpinner, faFileExcel,
    faArrowUp, faArrowDown, faCalendarDays, faUser, faBuilding
} from '@fortawesome/free-solid-svg-icons';
import { laborExchangeService, LaborExchangeItem } from '../../services/laborExchangeService';
import { teamService, Team } from '../../services/teamService';
import { dailyReportService } from '../../services/dailyReportService';
import { manpowerService } from '../../services/manpowerService';
import { toast } from '../../utils/swal';
import Swal from 'sweetalert2';

// 근로자별 일별 데이터
interface WorkerDailyRow {
    workerId: string;
    workerName: string;
    workerTeamId: string;
    workerTeamName: string;
    dailyManDay: Record<number, number>;
    totalManDay: number;
    unitPrice: number;
    totalAmount: number;
}

// 현장별 그룹 데이터
interface SiteGroup {
    siteId: string;
    siteName: string;
    targetTeamId: string;
    targetTeamName: string;
    workers: WorkerDailyRow[];
    totalManDay: number;
    totalAmount: number;
}

const LaborExchangePage: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [teams, setTeams] = useState<Team[]>([]);
    const [selectedTeamId, setSelectedTeamId] = useState<string>('');
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
    const [outgoingSites, setOutgoingSites] = useState<SiteGroup[]>([]);
    const [incomingSites, setIncomingSites] = useState<SiteGroup[]>([]);
    const [activeTab, setActiveTab] = useState<'outgoing' | 'incoming'>('outgoing');

    // 해당 월의 일수 계산
    const daysInMonth = useMemo(() => {
        return new Date(selectedYear, selectedMonth, 0).getDate();
    }, [selectedYear, selectedMonth]);

    // 날짜 배열 생성 (1~말일)
    const dates = useMemo(() => {
        return Array.from({ length: daysInMonth }, (_, i) => i + 1);
    }, [daysInMonth]);

    // Load teams
    useEffect(() => {
        const loadTeams = async () => {
            try {
                const teamsData = await teamService.getTeams();
                setTeams(teamsData);
                if (teamsData.length > 0) {
                    setSelectedTeamId(teamsData[0].id!);
                }
            } catch (error) {
                console.error('Failed to load teams:', error);
                toast.error('팀 목록 로드 실패');
            }
        };
        loadTeams();
    }, []);

    // Load exchange report
    useEffect(() => {
        if (!selectedTeamId) return;

        const loadReport = async () => {
            setLoading(true);
            try {
                const reports = await laborExchangeService.getExchangeReport(
                    selectedYear,
                    selectedMonth,
                    selectedTeamId
                );

                // getExchangeReport already filters by teamId, so use the first result
                const teamSummary = reports.length > 0 ? reports[0] : null;

                if (!teamSummary) {
                    setOutgoingSites([]);
                    setIncomingSites([]);
                    setLoading(false);
                    return;
                }

                // 일하러 간 곳 (Outgoing) - 현장별로 그룹화
                const outgoing = groupBySite(teamSummary.outgoing.items, 'outgoing');

                // 일하러 온 곳 (Incoming) - 현장별로 그룹화
                const incoming = groupBySite(teamSummary.incoming.items, 'incoming');

                setOutgoingSites(outgoing);
                setIncomingSites(incoming);
            } catch (error) {
                console.error('Failed to load report:', error);
                toast.error('리포트 로드 실패');
            } finally {
                setLoading(false);
            }
        };

        const groupBySite = (items: LaborExchangeItem[], direction: 'outgoing' | 'incoming'): SiteGroup[] => {
            const siteMap: Record<string, {
                siteId: string;
                siteName: string;
                targetTeamId: string;
                targetTeamName: string;
                workers: Record<string, WorkerDailyRow>;
            }> = {};

            items.forEach(item => {
                const siteKey = item.siteId;
                const dateParts = item.date.split('-');
                const day = parseInt(dateParts[2], 10);

                if (!siteMap[siteKey]) {
                    siteMap[siteKey] = {
                        siteId: item.siteId,
                        siteName: item.siteName,
                        targetTeamId: direction === 'outgoing' ? item.reportTeamId : item.workerTeamId,
                        targetTeamName: direction === 'outgoing'
                            ? (teams.find(t => t.id === item.reportTeamId)?.name || item.reportTeamId)
                            : (teams.find(t => t.id === item.workerTeamId)?.name || item.workerTeamId),
                        workers: {}
                    };
                }

                const workerKey = item.workerId;
                if (!siteMap[siteKey].workers[workerKey]) {
                    siteMap[siteKey].workers[workerKey] = {
                        workerId: item.workerId,
                        workerName: item.workerName,
                        workerTeamId: item.workerTeamId,
                        workerTeamName: teams.find(t => t.id === item.workerTeamId)?.name || item.workerTeamId,
                        dailyManDay: {},
                        totalManDay: 0,
                        unitPrice: item.supportRate || item.unitPrice,
                        totalAmount: 0
                    };
                }

                const worker = siteMap[siteKey].workers[workerKey];
                worker.dailyManDay[day] = (worker.dailyManDay[day] || 0) + item.manDay;
                worker.totalManDay += item.manDay;
                worker.totalAmount += item.amount;
            });

            // Convert to array and calculate totals
            return Object.values(siteMap).map(site => ({
                siteId: site.siteId,
                siteName: site.siteName,
                targetTeamId: site.targetTeamId,
                targetTeamName: site.targetTeamName,
                workers: Object.values(site.workers).sort((a, b) => a.workerName.localeCompare(b.workerName)),
                totalManDay: Object.values(site.workers).reduce((sum, w) => sum + w.totalManDay, 0),
                totalAmount: Object.values(site.workers).reduce((sum, w) => sum + w.totalAmount, 0)
            })).sort((a, b) => a.siteName.localeCompare(b.siteName));
        };

        loadReport();
    }, [selectedTeamId, selectedYear, selectedMonth, teams]);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('ko-KR').format(amount);
    };

    const handleExcelDownload = () => {
        if (!outgoingSites.length && !incomingSites.length) {
            toast.warning('다운로드할 데이터가 없습니다.');
            return;
        }

        const csvRows = [];
        // Header
        csvRows.push(['구분', '현장명', '대상팀', '작업자', '총공수', '단가', '총액']);

        // Outgoing
        outgoingSites.forEach(site => {
            site.workers.forEach(w => {
                csvRows.push([
                    '일하러 간 곳',
                    site.siteName,
                    site.targetTeamName,
                    w.workerName,
                    w.totalManDay,
                    w.unitPrice,
                    w.totalAmount
                ]);
            });
        });

        // Incoming
        incomingSites.forEach(site => {
            site.workers.forEach(w => {
                csvRows.push([
                    '일하러 온 곳',
                    site.siteName,
                    site.targetTeamName,
                    w.workerName,
                    w.totalManDay,
                    w.unitPrice,
                    w.totalAmount
                ]);
            });
        });

        const csvContent = "\uFEFF" + csvRows.map(e => e.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `인력교류정산_${selectedYear}_${selectedMonth}_${teams.find(t => t.id === selectedTeamId)?.name}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleMigration = async () => {
        const result = await Swal.fire({
            title: '데이터 마이그레이션',
            text: '2024년 1월 1일부터 현재까지의 일보 데이터에 대해 작업자 소속팀 정보를 업데이트하시겠습니까?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: '실행',
            cancelButtonText: '취소'
        });

        if (result.isConfirmed) {
            setLoading(true);
            try {
                const startDate = '2024-01-01';
                const endDate = new Date().toISOString().split('T')[0];

                const workers = await manpowerService.getWorkers();
                const workerMap = new Map<string, { teamId?: string }>();
                workers.forEach(w => {
                    if (w.id) workerMap.set(w.id, { teamId: w.teamId });
                });

                const migrationResult = await dailyReportService.migrateWorkerTeamIds(startDate, endDate, workerMap);
                toast.success(`마이그레이션 완료: ${migrationResult.updated}건 업데이트됨`);
            } catch (error) {
                console.error(error);
                toast.error('마이그레이션 실패');
            } finally {
                setLoading(false);
            }
        }
    };

    // 총합계 계산
    const outgoingTotal = useMemo(() => ({
        manDay: outgoingSites.reduce((sum, s) => sum + s.totalManDay, 0),
        amount: outgoingSites.reduce((sum, s) => sum + s.totalAmount, 0),
        workers: outgoingSites.reduce((sum, s) => sum + s.workers.length, 0)
    }), [outgoingSites]);

    const incomingTotal = useMemo(() => ({
        manDay: incomingSites.reduce((sum, s) => sum + s.totalManDay, 0),
        amount: incomingSites.reduce((sum, s) => sum + s.totalAmount, 0),
        workers: incomingSites.reduce((sum, s) => sum + s.workers.length, 0)
    }), [incomingSites]);

    const currentSites = activeTab === 'outgoing' ? outgoingSites : incomingSites;
    const currentTotal = activeTab === 'outgoing' ? outgoingTotal : incomingTotal;

    return (
        <div className="h-full flex flex-col bg-slate-50">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 p-4">
                <div className="flex items-center justify-between">
                    <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <FontAwesomeIcon icon={faExchangeAlt} className="text-indigo-600" />
                        팀 인력 교류 정산
                    </h1>
                    <button
                        onClick={handleExcelDownload}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium flex items-center gap-2"
                    >
                        <FontAwesomeIcon icon={faFileExcel} />
                        엑셀 다운로드
                        <FontAwesomeIcon icon={faFileExcel} />
                        엑셀 다운로드
                    </button>
                    <button
                        onClick={handleMigration}
                        className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg text-sm font-medium flex items-center gap-2"
                    >
                        DB 마이그레이션
                    </button>
                </div>

                {/* Filters */}
                <div className="flex items-center gap-4 mt-4">
                    <select
                        value={selectedTeamId}
                        onChange={(e) => setSelectedTeamId(e.target.value)}
                        className="px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium"
                    >
                        {teams.map(team => (
                            <option key={team.id} value={team.id}>{team.name}</option>
                        ))}
                    </select>

                    <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                        className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
                    >
                        {[2024, 2025, 2026].map(year => (
                            <option key={year} value={year}>{year}년</option>
                        ))}
                    </select>

                    <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(Number(e.target.value))}
                        className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
                    >
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                            <option key={month} value={month}>{month}월</option>
                        ))}
                    </select>

                    <div className="flex items-center gap-2 text-sm text-slate-500">
                        <FontAwesomeIcon icon={faCalendarDays} />
                        {selectedYear}-{String(selectedMonth).padStart(2, '0')}-01 ~ {selectedYear}-{String(selectedMonth).padStart(2, '0')}-{daysInMonth}
                    </div>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="p-4 grid grid-cols-3 gap-4">
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                    <div className="text-sm text-green-600 mb-1 flex items-center gap-1">
                        <FontAwesomeIcon icon={faArrowUp} />
                        일하러 간 곳 (받을 돈)
                    </div>
                    <div className="text-2xl font-bold text-green-700">
                        {formatCurrency(outgoingTotal.amount)}원
                    </div>
                    <div className="text-sm text-green-600">{outgoingTotal.manDay.toFixed(1)}공 / {outgoingSites.length}현장 / {outgoingTotal.workers}명</div>
                </div>

                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                    <div className="text-sm text-red-600 mb-1 flex items-center gap-1">
                        <FontAwesomeIcon icon={faArrowDown} />
                        일하러 온 곳 (줄 돈)
                    </div>
                    <div className="text-2xl font-bold text-red-700">
                        {formatCurrency(incomingTotal.amount)}원
                    </div>
                    <div className="text-sm text-red-600">{incomingTotal.manDay.toFixed(1)}공 / {incomingSites.length}현장 / {incomingTotal.workers}명</div>
                </div>

                <div className={`${outgoingTotal.amount - incomingTotal.amount >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'} border rounded-xl p-4`}>
                    <div className={`text-sm ${outgoingTotal.amount - incomingTotal.amount >= 0 ? 'text-blue-600' : 'text-orange-600'} mb-1`}>
                        순정산
                    </div>
                    <div className={`text-2xl font-bold ${outgoingTotal.amount - incomingTotal.amount >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
                        {outgoingTotal.amount - incomingTotal.amount >= 0 ? '+' : ''}{formatCurrency(outgoingTotal.amount - incomingTotal.amount)}원
                    </div>
                    <div className={`text-sm ${outgoingTotal.amount - incomingTotal.amount >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                        {outgoingTotal.amount - incomingTotal.amount >= 0 ? '받을 금액' : '줄 금액'}
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="px-4 border-b border-slate-200">
                <div className="flex gap-1">
                    <button
                        onClick={() => setActiveTab('outgoing')}
                        className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${activeTab === 'outgoing'
                            ? 'bg-green-600 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                    >
                        📤 일하러 간 곳 ({outgoingSites.length}현장)
                    </button>
                    <button
                        onClick={() => setActiveTab('incoming')}
                        className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${activeTab === 'incoming'
                            ? 'bg-red-600 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                    >
                        📥 일하러 온 곳 ({incomingSites.length}현장)
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-4">
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <FontAwesomeIcon icon={faSpinner} className="text-4xl text-indigo-600 animate-spin" />
                    </div>
                ) : currentSites.length === 0 ? (
                    <div className="text-center text-slate-500 py-12">
                        이번 달 {activeTab === 'outgoing' ? '지원 간' : '지원 온'} 내역이 없습니다.
                    </div>
                ) : (
                    <div className="space-y-6">
                        {currentSites.map((site, siteIdx) => (
                            <div key={site.siteId} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                                {/* Site Header */}
                                <div className={`px-4 py-3 ${activeTab === 'outgoing' ? 'bg-green-50 border-b border-green-200' : 'bg-red-50 border-b border-red-200'}`}>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${activeTab === 'outgoing' ? 'bg-green-600' : 'bg-red-600'} text-white font-bold text-sm`}>
                                                {siteIdx + 1}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <FontAwesomeIcon icon={faBuilding} className="text-slate-500" />
                                                    <span className="font-bold text-slate-800">{site.siteName}</span>
                                                </div>
                                                <div className="text-sm text-slate-500">
                                                    {activeTab === 'outgoing' ? '현장팀' : '협력사'}: {site.targetTeamName}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className={`text-lg font-bold ${activeTab === 'outgoing' ? 'text-green-700' : 'text-red-700'}`}>
                                                {formatCurrency(site.totalAmount)}원
                                            </div>
                                            <div className="text-sm text-slate-500">
                                                {site.totalManDay.toFixed(1)}공 / {site.workers.length}명
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Workers Table */}
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs border-collapse">
                                        <thead className="bg-yellow-50">
                                            <tr className="border-b border-slate-200">
                                                <th className="py-2 px-2 text-center font-medium text-slate-600 border-r border-slate-200 w-10 sticky left-0 bg-yellow-50 z-10">No</th>
                                                <th className="py-2 px-2 text-left font-medium text-slate-600 border-r border-slate-200 min-w-[80px] sticky left-10 bg-yellow-50 z-10">이름</th>
                                                {dates.map(day => (
                                                    <th key={day} className="py-2 px-1 text-center font-medium text-slate-500 border-r border-slate-100 min-w-[28px]">
                                                        {String(day).padStart(2, '0')}
                                                    </th>
                                                ))}
                                                <th className="py-2 px-2 text-center font-medium text-slate-600 border-r border-slate-200 bg-green-50 min-w-[45px]">출역</th>
                                                <th className="py-2 px-2 text-right font-medium text-slate-600 border-r border-slate-200 bg-blue-50 min-w-[70px]">단가</th>
                                                <th className="py-2 px-2 text-right font-medium text-slate-600 bg-pink-50 min-w-[90px]">총액</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {site.workers.map((worker, workerIdx) => (
                                                <tr key={worker.workerId} className="border-b border-slate-100 hover:bg-slate-50">
                                                    <td className="py-1.5 px-2 text-center text-slate-500 border-r border-slate-100 sticky left-0 bg-white z-10">
                                                        {workerIdx + 1}
                                                    </td>
                                                    <td className="py-1.5 px-2 font-medium text-slate-800 border-r border-slate-100 sticky left-10 bg-white z-10">
                                                        <div className="flex items-center gap-1">
                                                            <FontAwesomeIcon icon={faUser} className="text-slate-300 text-[10px]" />
                                                            {worker.workerName}
                                                        </div>
                                                    </td>
                                                    {dates.map(day => {
                                                        const manDay = worker.dailyManDay[day];
                                                        return (
                                                            <td
                                                                key={day}
                                                                className={`py-1.5 px-1 text-center border-r border-slate-50 ${manDay
                                                                    ? activeTab === 'outgoing'
                                                                        ? 'bg-green-100 text-green-800 font-medium'
                                                                        : 'bg-red-100 text-red-800 font-medium'
                                                                    : 'text-slate-200'
                                                                    }`}
                                                            >
                                                                {manDay ? manDay.toFixed(1) : '0.0'}
                                                            </td>
                                                        );
                                                    })}
                                                    <td className="py-1.5 px-2 text-center font-bold text-slate-700 border-r border-slate-100 bg-green-50">
                                                        {worker.totalManDay.toFixed(1)}
                                                    </td>
                                                    <td className="py-1.5 px-2 text-right text-slate-600 border-r border-slate-100 bg-blue-50">
                                                        {formatCurrency(worker.unitPrice)}
                                                    </td>
                                                    <td className={`py-1.5 px-2 text-right font-bold ${activeTab === 'outgoing' ? 'text-green-700 bg-green-50' : 'text-red-700 bg-red-50'
                                                        }`}>
                                                        {formatCurrency(worker.totalAmount)}
                                                    </td>
                                                </tr>
                                            ))}
                                            {/* Site subtotal */}
                                            <tr className={`font-bold ${activeTab === 'outgoing' ? 'bg-green-100' : 'bg-red-100'}`}>
                                                <td colSpan={2} className="py-2 px-2 text-center sticky left-0 z-10" style={{ backgroundColor: activeTab === 'outgoing' ? '#dcfce7' : '#fee2e2' }}>
                                                    소계
                                                </td>
                                                {dates.map(day => {
                                                    const dayTotal = site.workers.reduce((sum, w) => sum + (w.dailyManDay[day] || 0), 0);
                                                    return (
                                                        <td key={day} className={`py-2 px-1 text-center ${dayTotal > 0 ? 'text-slate-700' : 'text-slate-300'}`}>
                                                            {dayTotal > 0 ? dayTotal.toFixed(1) : '-'}
                                                        </td>
                                                    );
                                                })}
                                                <td className="py-2 px-2 text-center text-slate-800 bg-green-200">
                                                    {site.totalManDay.toFixed(1)}
                                                </td>
                                                <td className="py-2 px-2 text-right text-slate-600 bg-blue-100">-</td>
                                                <td className={`py-2 px-2 text-right ${activeTab === 'outgoing' ? 'text-green-800' : 'text-red-800'}`}>
                                                    {formatCurrency(site.totalAmount)}
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ))}

                        {/* Grand Total */}
                        <div className={`rounded-xl p-4 ${activeTab === 'outgoing' ? 'bg-green-600' : 'bg-red-600'} text-white`}>
                            <div className="flex items-center justify-between">
                                <div className="font-bold text-lg">
                                    총합계 ({currentSites.length}현장 / {currentTotal.workers}명)
                                </div>
                                <div className="text-right">
                                    <div className="text-2xl font-bold">
                                        {formatCurrency(currentTotal.amount)}원
                                    </div>
                                    <div className="text-sm opacity-80">
                                        {currentTotal.manDay.toFixed(1)}공
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LaborExchangePage;
