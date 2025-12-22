import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { dailyReportService } from '../../services/dailyReportService';
import type { DailyReport, DailyReportWorker } from '../../services/dailyReportService';
import { manpowerService } from '../../services/manpowerService';
import type { Worker } from '../../services/manpowerService';
import { siteService } from '../../services/siteService';
import type { Site } from '../../services/siteService';
import { teamService } from '../../services/teamService';
import type { Team } from '../../services/teamService';

interface Filters {
    startDate: string;
    endDate: string;
    teamName: string;
    workerName: string;
    siteName: string;
    type: string;
    category: string;
    includeSupportNote: boolean;
}

interface ReportRow {
    date: string;
    siteId: string;
    siteName: string;
    siteCode: string;
    workerId: string;
    workerName: string;
    manDay: number;
    teamId: string;
    workTeamName: string;
    teamCategory: string;
    responsibleTeamName: string;
    salaryModel: string;
    type: string;
    note: string;
}

const normalizeText = (value: string): string => value.replace(/\s+/g, '').trim();

const isSupportNote = (note: string): boolean => normalizeText(note).includes('지원');

const toYyyyMmDd = (date: Date): string => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

const TeamPersonnelStatusReportPage: React.FC = () => {
    const today = useMemo(() => toYyyyMmDd(new Date()), []);

    const initialFilters = useMemo<Filters>(() => ({
        startDate: today,
        endDate: today,
        teamName: '',
        workerName: '',
        siteName: '',
        type: '',
        category: '',
        includeSupportNote: true
    }), [today]);

    const [filters, setFilters] = useState<Filters>(initialFilters);

    const [rows, setRows] = useState<ReportRow[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string>('');

    const [masterData, setMasterData] = useState<{ teams: Team[]; sites: Site[]; workers: Worker[] }>({
        teams: [],
        sites: [],
        workers: []
    });

    const masterDataRef = useRef<{ teams: Team[]; sites: Site[]; workers: Worker[] } | null>(null);

    const deriveSalaryModel = useCallback((reportWorker: DailyReportWorker, workerInfo: Worker | undefined): string => {
        if (typeof reportWorker.salaryModel === 'string' && reportWorker.salaryModel.trim().length > 0) return reportWorker.salaryModel;
        if (typeof reportWorker.payType === 'string' && reportWorker.payType.trim().length > 0) return reportWorker.payType;

        if (workerInfo) {
            if (workerInfo.teamType === '지원팀') return '지원팀';
            if (workerInfo.teamType === '용역팀') return '용역팀';
            if (typeof workerInfo.salaryModel === 'string' && workerInfo.salaryModel.trim().length > 0) return workerInfo.salaryModel;
            if (typeof workerInfo.payType === 'string' && workerInfo.payType.trim().length > 0) return workerInfo.payType;
        }

        return '일급제';
    }, []);

    const ensureMasterData = useCallback(async () => {
        if (masterDataRef.current) return masterDataRef.current;

        const [teams, sites, workers] = await Promise.all([
            teamService.getTeams(),
            siteService.getSites(),
            manpowerService.getWorkers()
        ]);

        const next = { teams, sites, workers };
        masterDataRef.current = next;
        setMasterData(next);
        return next;
    }, []);

    const fetchRows = useCallback(async (nextFilters: Filters) => {
        const start = nextFilters.startDate;
        const end = nextFilters.endDate;
        if (start.trim().length === 0 || end.trim().length === 0) {
            setErrorMessage('기간(시작/종료)을 입력해주세요.');
            setRows([]);
            return;
        }
        if (start > end) {
            setErrorMessage('검색시작일이 검색종료일보다 클 수 없습니다.');
            setRows([]);
            return;
        }

        setIsLoading(true);
        setErrorMessage('');

        try {
            const [reports, { teams, sites, workers }] = await Promise.all([
                dailyReportService.getReportsByRange(start, end),
                ensureMasterData()
            ]);

            const teamById = new Map<string, Team>();
            teams.forEach(team => {
                if (team.id) teamById.set(team.id, team);
            });

            const siteById = new Map<string, Site>();
            sites.forEach(site => {
                if (site.id) siteById.set(site.id, site);
            });

            const workerById = new Map<string, Worker>();
            workers.forEach(worker => {
                if (worker.id) workerById.set(worker.id, worker);
            });

            const baseRows: ReportRow[] = reports.flatMap((report: DailyReport) => {
                const site = siteById.get(report.siteId);
                const team = teamById.get(report.teamId);

                const teamCategory = typeof team?.type === 'string' ? team.type : '';
                const derivedType = typeof team?.role === 'string' && team.role.trim().length > 0
                    ? team.role
                    : typeof team?.type === 'string'
                        ? team.type
                        : '';

                return report.workers.map((reportWorker: DailyReportWorker) => {
                    const workerInfo = workerById.get(reportWorker.workerId);
                    const salaryModel = deriveSalaryModel(reportWorker, workerInfo);
                    const note = reportWorker.workContent || '';

                    return {
                        date: report.date,
                        siteId: report.siteId,
                        siteName: report.siteName || site?.name || '',
                        siteCode: site?.code || '',
                        workerId: reportWorker.workerId,
                        workerName: reportWorker.name,
                        manDay: reportWorker.manDay,
                        teamId: report.teamId,
                        workTeamName: report.teamName || team?.name || '',
                        teamCategory,
                        responsibleTeamName: report.responsibleTeamName || site?.responsibleTeamName || '',
                        salaryModel,
                        type: reportWorker.role || derivedType,
                        note
                    };
                });
            });

            const teamNameFilter = normalizeText(nextFilters.teamName);
            const workerNameFilter = normalizeText(nextFilters.workerName);
            const siteNameFilter = normalizeText(nextFilters.siteName);
            const typeFilter = normalizeText(nextFilters.type);

            const filtered = baseRows
                .filter(row => {
                    if (teamNameFilter.length > 0) {
                        const a = normalizeText(row.workTeamName);
                        const b = normalizeText(row.teamCategory);
                        if (!a.includes(teamNameFilter) && !b.includes(teamNameFilter)) return false;
                    }

                    if (workerNameFilter.length > 0) {
                        if (!normalizeText(row.workerName).includes(workerNameFilter)) return false;
                    }

                    if (siteNameFilter.length > 0) {
                        const a = normalizeText(row.siteName);
                        if (!a.includes(siteNameFilter)) return false;
                    }

                    if (nextFilters.category.trim().length > 0) {
                        if (row.salaryModel !== nextFilters.category) return false;
                    }

                    if (typeFilter.length > 0) {
                        const a = normalizeText(row.type);
                        if (!a.includes(typeFilter)) return false;
                    }

                    if (!nextFilters.includeSupportNote) {
                        if (isSupportNote(row.note)) return false;
                    }

                    return true;
                })
                .sort((a, b) => {
                    const dateCompare = a.date.localeCompare(b.date);
                    if (dateCompare !== 0) return dateCompare;

                    const siteCompare = a.siteName.localeCompare(b.siteName, 'ko');
                    if (siteCompare !== 0) return siteCompare;

                    const teamCompare = a.workTeamName.localeCompare(b.workTeamName, 'ko');
                    if (teamCompare !== 0) return teamCompare;

                    return a.workerName.localeCompare(b.workerName, 'ko');
                });

            setRows(filtered);
        } catch (error) {
            console.error(error);
            setErrorMessage('데이터 조회 중 오류가 발생했습니다.');
            setRows([]);
        } finally {
            setIsLoading(false);
        }
    }, [deriveSalaryModel, ensureMasterData]);

    const totalManDay = useMemo(() => rows.reduce((sum, row) => sum + row.manDay, 0), [rows]);

    useEffect(() => {
        fetchRows(initialFilters).catch(e => console.error(e));
    }, [fetchRows, initialFilters]);

    return (
        <div className="p-6 md:p-8 max-w-[1800px] mx-auto">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-slate-800">팀별/인원별 현황 조회</h1>
                    <div className="mt-2 text-sm text-slate-500">
                        구글시트 리포트(원장 기반) 기능을 웹으로 이식하는 개발중 페이지입니다.
                    </div>
                </div>
                <div className="text-xs text-slate-500">
                    Route: <span className="font-mono">/reports/team-personnel-status</span>
                </div>
            </div>

            <div className="mt-6 bg-white border border-slate-200 rounded-2xl shadow-sm p-4">
                <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                    <label className="flex flex-col gap-1">
                        <span className="text-xs font-bold text-slate-600">검색시작일</span>
                        <input
                            type="date"
                            value={filters.startDate}
                            onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                            className="border border-slate-200 rounded px-3 py-2 text-sm"
                        />
                    </label>

                    <label className="flex flex-col gap-1">
                        <span className="text-xs font-bold text-slate-600">검색종료일</span>
                        <input
                            type="date"
                            value={filters.endDate}
                            onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                            className="border border-slate-200 rounded px-3 py-2 text-sm"
                        />
                    </label>

                    <label className="flex flex-col gap-1">
                        <span className="text-xs font-bold text-slate-600">팀명(팀구분)</span>
                        <input
                            value={filters.teamName}
                            onChange={(e) => setFilters(prev => ({ ...prev, teamName: e.target.value }))}
                            placeholder="예: 이재욱팀"
                            className="border border-slate-200 rounded px-3 py-2 text-sm"
                        />
                    </label>

                    <label className="flex flex-col gap-1">
                        <span className="text-xs font-bold text-slate-600">이름</span>
                        <input
                            value={filters.workerName}
                            onChange={(e) => setFilters(prev => ({ ...prev, workerName: e.target.value }))}
                            placeholder="예: 김해용"
                            className="border border-slate-200 rounded px-3 py-2 text-sm"
                        />
                    </label>

                    <label className="flex flex-col gap-1">
                        <span className="text-xs font-bold text-slate-600">현장명</span>
                        <input
                            value={filters.siteName}
                            onChange={(e) => setFilters(prev => ({ ...prev, siteName: e.target.value }))}
                            placeholder="예: 여의도"
                            className="border border-slate-200 rounded px-3 py-2 text-sm"
                        />
                    </label>

                    <label className="flex flex-col gap-1">
                        <span className="text-xs font-bold text-slate-600">구분</span>
                        <select
                            value={filters.category}
                            onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
                            className="border border-slate-200 rounded px-3 py-2 text-sm bg-white"
                        >
                            <option value="">전체</option>
                            <option value="월급제">월급제</option>
                            <option value="일급제">일급제</option>
                            <option value="지원팀">지원팀</option>
                        </select>
                    </label>

                    <label className="flex flex-col gap-1">
                        <span className="text-xs font-bold text-slate-600">TYPE</span>
                        <input
                            value={filters.type}
                            onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value }))}
                            placeholder="예: A"
                            className="border border-slate-200 rounded px-3 py-2 text-sm"
                        />
                    </label>

                    <label className="flex items-center gap-2 mt-6">
                        <input
                            type="checkbox"
                            checked={filters.includeSupportNote}
                            onChange={(e) => setFilters(prev => ({ ...prev, includeSupportNote: e.target.checked }))}
                            className="w-4 h-4"
                        />
                        <span className="text-sm text-slate-700">비고=지원 포함</span>
                    </label>

                    <div className="md:col-span-4 flex items-center justify-end gap-2 mt-4 md:mt-6">
                        <button
                            type="button"
                            onClick={() => {
                                setFilters(prev => ({
                                    ...prev,
                                    ...initialFilters
                                }));
                                setRows([]);
                                setErrorMessage('');
                            }}
                            className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 text-sm font-bold"
                        >
                            초기화
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                fetchRows(filters).catch(e => console.error(e));
                            }}
                            className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 text-sm font-bold"
                        >
                            조회
                        </button>
                    </div>
                </div>
            </div>

            <div className="mt-6 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                    <div className="font-bold text-slate-700">결과</div>
                    <div className="text-sm text-slate-500">
                        총공수: <span className="font-bold">{totalManDay.toFixed(1)}</span>
                    </div>
                </div>

                <div className="overflow-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-500 uppercase bg-slate-50 sticky top-0 z-10">
                            <tr>
                                <th className="px-4 py-3 font-bold text-slate-600">날짜</th>
                                <th className="px-4 py-3 font-bold text-slate-600">현장명</th>
                                <th className="px-4 py-3 font-bold text-slate-600">이름</th>
                                <th className="px-4 py-3 font-bold text-slate-600 text-right">공수</th>
                                <th className="px-4 py-3 font-bold text-slate-600">팀구분</th>
                                <th className="px-4 py-3 font-bold text-slate-600">현장소속팀</th>
                                <th className="px-4 py-3 font-bold text-slate-600">현장번호</th>
                                <th className="px-4 py-3 font-bold text-slate-600">구분</th>
                                <th className="px-4 py-3 font-bold text-slate-600">TYPE</th>
                                <th className="px-4 py-3 font-bold text-slate-600">비고</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {errorMessage.trim().length > 0 ? (
                                <tr>
                                    <td colSpan={10} className="px-4 py-6 text-center text-rose-600">
                                        {errorMessage}
                                    </td>
                                </tr>
                            ) : isLoading ? (
                                <tr>
                                    <td colSpan={10} className="px-4 py-6 text-center text-slate-500">
                                        로딩 중...
                                    </td>
                                </tr>
                            ) : rows.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="px-4 py-6 text-center text-slate-500">
                                        조회된 데이터가 없습니다.
                                    </td>
                                </tr>
                            ) : (
                                rows.map(row => (
                                    <tr key={`${row.date}-${row.siteId}-${row.teamId}-${row.workerId}`} className="hover:bg-slate-50">
                                        <td className="px-4 py-3 font-mono text-xs text-slate-600">{row.date}</td>
                                        <td className="px-4 py-3 text-slate-800">{row.siteName}</td>
                                        <td className="px-4 py-3 text-slate-800 font-bold">{row.workerName}</td>
                                        <td className="px-4 py-3 text-right font-mono text-slate-800">{row.manDay.toFixed(1)}</td>
                                        <td className="px-4 py-3 text-slate-700">{row.teamCategory || '-'}</td>
                                        <td className="px-4 py-3 text-slate-700">{row.responsibleTeamName || '-'}</td>
                                        <td className="px-4 py-3 font-mono text-xs text-slate-600">{row.siteCode || '-'}</td>
                                        <td className="px-4 py-3 text-slate-700">{row.salaryModel || '-'}</td>
                                        <td className="px-4 py-3 text-slate-700">{row.type || '-'}</td>
                                        <td className="px-4 py-3 text-slate-600">{row.note || '-'}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default TeamPersonnelStatusReportPage;
