import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCalendarDay, faExclamationTriangle, faEye, faEyeSlash, faSearch, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { dailyReportService } from '../../services/dailyReportService';
import { companyService } from '../../services/companyService';
import { manpowerService, Worker } from '../../services/manpowerService';
import { teamService, Team } from '../../services/teamService';
import { BANK_CODES } from './team-payment/types';
import { toast } from '../../utils/swal';

type TeamWithId = Team & { id: string };

type DraftRow = {
    rowKey: string;
    date: string;
    workerId: string;
    workerName: string;
    teamId: string;
    teamName: string;
    manDay: number;
    originalUnitPrice: number;
    actualUnitPrice: number;
    billingUnitPrice: number;
    reportUnitPrice: number;
    bankName: string;
    bankCode: string;
    accountNumber: string;
    accountHolder: string;
    isValid: boolean;
    errors: {
        bankName?: boolean;
        bankCode?: boolean;
        accountNumber?: boolean;
        accountHolder?: boolean;
    };
};

type DraftRowTotals = {
    originalTotal: number;
    actualTotal: number;
    billingTotal: number;
    reportTotal: number;
};

const DailyWageDraftPage: React.FC = () => {
    const today = new Date().toISOString().split('T')[0];

    const [selectedDate, setSelectedDate] = useState<string>(today);
    const [selectedTeamId, setSelectedTeamId] = useState<string>('');

    const [teams, setTeams] = useState<TeamWithId[]>([]);
    const [allTeams, setAllTeams] = useState<Team[]>([]);
    const [filtersReady, setFiltersReady] = useState<boolean>(false);

    const [rows, setRows] = useState<DraftRow[]>([]);
    const [originalRows, setOriginalRows] = useState<DraftRow[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [errorCount, setErrorCount] = useState<number>(0);

    const [bulkActualDeductionUnitPrice, setBulkActualDeductionUnitPrice] = useState<number>(0);
    const [bulkBillingDeductionUnitPrice, setBulkBillingDeductionUnitPrice] = useState<number>(0);
    const [bulkReportDeductionUnitPrice, setBulkReportDeductionUnitPrice] = useState<number>(0);

    const [showAccountColumns, setShowAccountColumns] = useState<boolean>(false);

    const normalizeTeamName = useCallback((value: string): string => {
        return value.replace(/\(.*?\)/g, '').replace(/\s+/g, '').trim();
    }, []);

    const toYyyyMmDd = useCallback((date: Date): string => {
        const yyyy = String(date.getFullYear());
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }, []);

    const addDays = useCallback(
        (base: string, diffDays: number): string => {
            const [yyyy, mm, dd] = base.split('-').map((v) => Number(v));
            const safeDate = new Date(yyyy, (mm ?? 1) - 1, dd ?? 1);
            safeDate.setDate(safeDate.getDate() + diffDays);
            return toYyyyMmDd(safeDate);
        },
        [toYyyyMmDd]
    );

    useEffect(() => {
        const loadTeams = async () => {
            try {
                const fetchedTeams = await teamService.getTeams();
                setAllTeams(fetchedTeams);

                const normalizeCompanyType = (value: string | undefined): string => {
                    return (value ?? '').replace(/\s+/g, '').trim();
                };

                const companies = await companyService.getCompanies();
                const constructionCompanyIds = new Set<string>();
                const companyIdByNameNormalized = new Map<string, string>();

                companies.forEach((company) => {
                    const companyId = (company.id ?? '').trim();
                    if (!companyId) return;

                    const nameKey = normalizeTeamName(company.name ?? '');
                    if (nameKey && !companyIdByNameNormalized.has(nameKey)) {
                        companyIdByNameNormalized.set(nameKey, companyId);
                    }

                    if (normalizeCompanyType(company.type) === '시공사') {
                        constructionCompanyIds.add(companyId);
                    }
                });

                const filtered: TeamWithId[] = fetchedTeams
                    .filter((t): t is TeamWithId => typeof t.id === 'string' && t.id.trim().length > 0)
                    .filter((team) => {
                        const companyIdRaw = (team.companyId ?? '').trim();
                        const companyNameKey = normalizeTeamName(team.companyName ?? '');
                        const companyId = companyIdRaw || (companyNameKey ? (companyIdByNameNormalized.get(companyNameKey) ?? '') : '');
                        if (!companyId) return false;
                        return constructionCompanyIds.has(companyId);
                    })
                    .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'ko'));

                setTeams(filtered);
            } catch (error) {
                console.error(error);
                toast.error('팀 목록을 불러오는 중 오류가 발생했습니다.');
            } finally {
                setFiltersReady(true);
            }
        };

        void loadTeams();
    }, []);

    const teamScope = useMemo(() => {
        const allowedTeamIds = new Set<string>();
        const allowedTeamNameNormalized = new Set<string>();

        if (!selectedTeamId) {
            return { allowedTeamIds, allowedTeamNameNormalized };
        }

        allowedTeamIds.add(selectedTeamId);
        const selectedTeamName = allTeams.find((t) => t.id === selectedTeamId)?.name ?? '';
        const selectedTeamNameNormalized = normalizeTeamName(selectedTeamName);
        if (selectedTeamNameNormalized) {
            allowedTeamNameNormalized.add(selectedTeamNameNormalized);
        }

        return { allowedTeamIds, allowedTeamNameNormalized };
    }, [allTeams, normalizeTeamName, selectedTeamId, teams]);

    const scopedRows = useMemo(() => {
        if (teamScope.allowedTeamIds.size === 0 && teamScope.allowedTeamNameNormalized.size === 0) {
            return rows;
        }
        return rows.filter((row) => {
            if (teamScope.allowedTeamIds.has(row.teamId)) return true;
            const normalized = normalizeTeamName(row.teamName);
            return normalized ? teamScope.allowedTeamNameNormalized.has(normalized) : false;
        });
    }, [
        normalizeTeamName,
        rows,
        selectedTeamId,
        teamScope.allowedTeamIds,
        teamScope.allowedTeamNameNormalized,
    ]);

    const filteredRows = scopedRows;

    const getRowTotals = useCallback((row: DraftRow): DraftRowTotals => {
        return {
            originalTotal: row.originalUnitPrice * row.manDay,
            actualTotal: row.actualUnitPrice * row.manDay,
            billingTotal: row.billingUnitPrice * row.manDay,
            reportTotal: row.reportUnitPrice * row.manDay,
        };
    }, []);

    const summary = useMemo(() => {
        return scopedRows.reduce(
            (acc, row) => {
                const totals = getRowTotals(row);
                acc.totalManDay += row.manDay;
                acc.totalOriginal += totals.originalTotal;
                acc.totalActual += totals.actualTotal;
                acc.totalBilling += totals.billingTotal;
                acc.totalReport += totals.reportTotal;
                return acc;
            },
            { totalManDay: 0, totalOriginal: 0, totalActual: 0, totalBilling: 0, totalReport: 0 }
        );
    }, [getRowTotals, scopedRows]);

    const validateRow = useCallback((params: {
        bankName: string;
        bankCode: string;
        accountNumber: string;
        accountHolder: string;
    }): { isValid: boolean; errors: DraftRow['errors'] } => {
        const errors: DraftRow['errors'] = {};
        let isValid = true;

        if (!params.bankName) {
            errors.bankName = true;
            isValid = false;
        }
        if (params.bankName && !params.bankCode) {
            errors.bankCode = true;
            isValid = false;
        }
        if (!params.accountNumber) {
            errors.accountNumber = true;
            isValid = false;
        }
        if (!params.accountHolder) {
            errors.accountHolder = true;
            isValid = false;
        }

        return { isValid, errors };
    }, []);

    const fetchData = useCallback(async (overrideDate?: string) => {
        const date = (overrideDate ?? selectedDate).trim();

        if (!date) {
            toast.error('조회 날짜를 입력해 주세요.');
            return;
        }

        setLoading(true);
        try {
            const [reports, allWorkers] = await Promise.all([
                dailyReportService.getReports(date),
                manpowerService.getWorkers(),
            ]);

            const workerMap = new Map<string, Worker>();
            allWorkers.forEach((w) => {
                if (w.id) workerMap.set(w.id, w);
            });

            const teamMap = new Map<string, Team>();
            allTeams.forEach((t) => {
                if (t.id) teamMap.set(t.id, t);
            });

            const nextRows: DraftRow[] = [];
            let nextErrorCount = 0;

            reports.forEach((report) => {
                    const resolvedReportTeamIdFromName = (() => {
                        const normalized = normalizeTeamName(report.teamName ?? '');
                        if (!normalized) return '';
                        const matched = allTeams.find((t) => normalizeTeamName(t.name ?? '') === normalized);
                        return matched?.id ?? '';
                    })();

                    const reportTeamId = (report.teamId ?? '').trim() || resolvedReportTeamIdFromName;
                    const reportTeamName = report.teamName || teamMap.get(reportTeamId)?.name || '';

                    report.workers.forEach((reportWorker) => {
                        const workerDetails = workerMap.get(reportWorker.workerId);
                        if (!workerDetails) return;

                        const snapshotSalaryModel =
                            (typeof reportWorker.salaryModel === 'string' && reportWorker.salaryModel.trim().length > 0
                                ? reportWorker.salaryModel
                                : typeof reportWorker.payType === 'string' && reportWorker.payType.trim().length > 0
                                    ? reportWorker.payType
                                    : workerDetails.salaryModel || workerDetails.payType) ?? '';

                        if (snapshotSalaryModel && snapshotSalaryModel !== '일급제') return;

                        const originalUnitPrice = reportWorker.unitPrice ?? workerDetails.unitPrice ?? 0;
                        const actualUnitPrice = originalUnitPrice;
                        const billingUnitPrice = originalUnitPrice;
                        const reportUnitPrice = originalUnitPrice;

                        const bankName = workerDetails.bankName || '';
                        const bankCode = BANK_CODES[bankName] || '';
                        const accountNumber = workerDetails.accountNumber || '';
                        const accountHolder = workerDetails.accountHolder || '';

                        const validation = validateRow({ bankName, bankCode, accountNumber, accountHolder });
                        if (!validation.isValid) nextErrorCount += 1;

                        const resolvedTeamId = reportTeamId || reportWorker.teamId || '';
                        const safeTeamKey = resolvedTeamId || (normalizeTeamName(reportTeamName) ? `unresolved:${normalizeTeamName(reportTeamName)}` : 'no-team');
                        const reportKey = report.id ?? `${report.date}__${report.siteId}__${safeTeamKey}`;
                        const rowKey = `${reportKey}__${reportWorker.workerId}`;

                        nextRows.push({
                            rowKey,
                            date: report.date,
                            workerId: reportWorker.workerId,
                            workerName: reportWorker.name,
                            teamId: safeTeamKey,
                            teamName: reportTeamName,
                            manDay: reportWorker.manDay,
                            originalUnitPrice,
                            actualUnitPrice,
                            billingUnitPrice,
                            reportUnitPrice,
                            bankName,
                            bankCode,
                            accountNumber,
                            accountHolder,
                            isValid: validation.isValid,
                            errors: validation.errors,
                        });
                    });
                });

            setRows(nextRows);
            setOriginalRows(nextRows.map((row) => ({ ...row })));
            setErrorCount(nextErrorCount);

            if (nextRows.length === 0) {
                toast.info('조회 결과가 없습니다.');
            }
        } catch (error) {
            console.error(error);
            toast.error('데이터를 불러오는 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    }, [allTeams, normalizeTeamName, selectedDate, validateRow]);

    useEffect(() => {
        if (!filtersReady) return;
        void fetchData();
    }, [fetchData, filtersReady]);

    const updateRow = useCallback((rowKey: string, updater: (row: DraftRow) => DraftRow) => {
        setRows((prev) => prev.map((row) => (row.rowKey === rowKey ? updater(row) : row)));
    }, []);

    const applyBulk = useCallback(() => {
        setRows((prev) =>
            prev.map((row) => {
                if (selectedTeamId) {
                    const inScope =
                        teamScope.allowedTeamIds.has(row.teamId) ||
                        teamScope.allowedTeamNameNormalized.has(normalizeTeamName(row.teamName));
                    if (!inScope) return row;
                }

                const next: DraftRow = { ...row };

                next.actualUnitPrice = Math.max(0, row.originalUnitPrice - bulkActualDeductionUnitPrice);
                next.billingUnitPrice = Math.max(0, row.originalUnitPrice - bulkBillingDeductionUnitPrice);
                next.reportUnitPrice = Math.max(0, row.originalUnitPrice - bulkReportDeductionUnitPrice);

                return next;
            })
        );
    }, [
        bulkActualDeductionUnitPrice,
        bulkBillingDeductionUnitPrice,
        bulkReportDeductionUnitPrice,
        normalizeTeamName,
        selectedTeamId,
        teamScope.allowedTeamIds,
        teamScope.allowedTeamNameNormalized,
    ]);

    const resetRows = useCallback(() => {
        if (originalRows.length === 0) {
            void fetchData();
            return;
        }
        setRows(originalRows.map((row) => ({ ...row })));
    }, [fetchData, originalRows]);

    const formatNumber = useCallback((value: number) => {
        return new Intl.NumberFormat('ko-KR').format(value);
    }, []);

    const tableColSpan = showAccountColumns ? 11 : 8;

    return (
        <div className="flex flex-col h-full bg-[#f1f5f9]">
            <div className="bg-white border-b border-slate-200 px-6 py-4">
                <div className="flex items-center gap-3">
                    <div className="bg-blue-100 p-2 rounded-lg">
                        <FontAwesomeIcon icon={faCalendarDay} className="text-blue-600 text-xl" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">일급제</h1>
                        <p className="text-sm text-slate-500">일보 기반으로 일급제 지급/청구/신고 단가를 조정합니다.</p>
                    </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2 items-end">
                    <div>
                        <div className="text-xs text-slate-500 mb-1">날짜</div>
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="h-9 border border-slate-300 rounded-lg px-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        />
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                const base = selectedDate || today;
                                const next = addDays(base, -1);
                                setSelectedDate(next);
                                void fetchData(next);
                            }}
                            className="h-9 bg-slate-100 text-slate-700 hover:bg-slate-200 px-3 rounded-lg text-sm font-bold transition disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={loading}
                        >
                            어제
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setSelectedDate(today);
                                void fetchData(today);
                            }}
                            className="h-9 bg-slate-100 text-slate-700 hover:bg-slate-200 px-3 rounded-lg text-sm font-bold transition disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={loading}
                        >
                            오늘
                        </button>
                    </div>
                    <div>
                        <div className="text-xs text-slate-500 mb-1">팀</div>
                        <select
                            value={selectedTeamId}
                            onChange={(e) => setSelectedTeamId(e.target.value)}
                            className="h-9 border border-slate-300 rounded-lg px-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none min-w-[180px]"
                            disabled={!filtersReady}
                        >
                            <option value="">전체</option>
                            {teams.map((team) => (
                                <option key={team.id} value={team.id}>
                                    {team.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <button
                        type="button"
                        onClick={() => void fetchData()}
                        className="h-9 bg-slate-100 text-slate-700 hover:bg-slate-200 px-3 rounded-lg text-sm font-bold transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={loading}
                    >
                        <FontAwesomeIcon icon={faSearch} />
                        조회
                    </button>

                    <button
                        type="button"
                        onClick={() => setShowAccountColumns((prev) => !prev)}
                        className="h-9 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 px-3 rounded-lg text-sm font-bold transition flex items-center gap-2"
                    >
                        <FontAwesomeIcon icon={showAccountColumns ? faEyeSlash : faEye} />
                        {showAccountColumns ? '계좌숨기기' : '계좌보기'}
                    </button>
                </div>
            </div>

            <div className="p-6 max-w-7xl mx-auto w-full">
                {errorCount > 0 && (
                    <div className="mb-4 bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-lg flex items-center gap-2 text-sm">
                        <FontAwesomeIcon icon={faExclamationTriangle} className="text-amber-500" />
                        <span>
                            <strong>{errorCount.toLocaleString()}건</strong>의 데이터에 은행 정보가 누락되었습니다. (은행명/코드/계좌/예금주)
                        </span>
                    </div>
                )}

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 mb-4">
                    <div className="flex flex-col lg:flex-row gap-3 lg:items-end lg:justify-between">
                        <div className="flex flex-wrap items-end gap-3">
                            <div>
                                <div className="text-[11px] text-slate-500 mb-1">지급차감</div>
                                <input
                                    type="number"
                                    value={bulkActualDeductionUnitPrice}
                                    onChange={(e) => setBulkActualDeductionUnitPrice(Number(e.target.value))}
                                    step={5000}
                                    className="w-20 border border-slate-300 rounded-lg px-2 py-1 text-[11px] text-right"
                                    placeholder="0"
                                />
                            </div>
                            <div>
                                <div className="text-[11px] text-slate-500 mb-1">청구차감</div>
                                <input
                                    type="number"
                                    value={bulkBillingDeductionUnitPrice}
                                    onChange={(e) => setBulkBillingDeductionUnitPrice(Number(e.target.value))}
                                    step={5000}
                                    className="w-20 border border-slate-300 rounded-lg px-2 py-1 text-[11px] text-right"
                                    placeholder="0"
                                />
                            </div>
                            <div>
                                <div className="text-[11px] text-slate-500 mb-1">신고차감</div>
                                <input
                                    type="number"
                                    value={bulkReportDeductionUnitPrice}
                                    onChange={(e) => setBulkReportDeductionUnitPrice(Number(e.target.value))}
                                    step={5000}
                                    className="w-20 border border-slate-300 rounded-lg px-2 py-1 text-[11px] text-right"
                                    placeholder="0"
                                />
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                    type="button"
                                    onClick={applyBulk}
                                    className="bg-blue-600 text-white px-2.5 py-1 rounded-lg text-[11px] font-bold hover:bg-blue-700"
                                >
                                    일괄 적용
                                </button>
                                <button
                                    type="button"
                                    onClick={resetRows}
                                    className="bg-slate-500 text-white px-2.5 py-1 rounded-lg text-[11px] font-bold hover:bg-slate-600"
                                >
                                    초기화
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 text-sm shrink-0">
                            <div className="bg-slate-50 border border-slate-200 rounded-lg p-2">
                                <div className="text-[11px] text-slate-500">총 공수</div>
                                <div className="font-bold text-slate-800 mt-0.5 text-sm">{summary.totalManDay.toFixed(1)}</div>
                            </div>
                            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2">
                                <div className="text-[11px] text-emerald-700">지급 합계</div>
                                <div className="font-bold text-emerald-900 mt-0.5 text-sm">{formatNumber(summary.totalActual)}</div>
                            </div>
                            <div className="bg-orange-50 border border-orange-200 rounded-lg p-2">
                                <div className="text-[11px] text-orange-700">청구 합계</div>
                                <div className="font-bold text-orange-900 mt-0.5 text-sm">{formatNumber(summary.totalBilling)}</div>
                            </div>
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
                                <div className="text-[11px] text-blue-700">신고 합계</div>
                                <div className="font-bold text-blue-900 mt-0.5 text-sm">{formatNumber(summary.totalReport)}</div>
                            </div>
                            <div className="bg-slate-50 border border-slate-200 rounded-lg p-2">
                                <div className="text-[11px] text-slate-500">원 총액</div>
                                <div className="font-bold text-slate-800 mt-0.5 text-sm">{formatNumber(summary.totalOriginal)}</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                                <tr>
                                    <th className="px-3 py-3 text-left">날짜</th>
                                    <th className="px-3 py-3 text-left">이름</th>
                                    <th className="px-3 py-3 text-left">팀명</th>
                                    <th className="px-3 py-3 text-right">공수</th>
                                    <th className="px-3 py-3 text-right">원단가</th>
                                    <th className="px-3 py-3 text-right text-emerald-700">지급단가</th>
                                    <th className="px-3 py-3 text-right text-orange-700">청구단가</th>
                                    <th className="px-3 py-3 text-right text-blue-700">신고단가</th>
                                    {showAccountColumns && <th className="px-3 py-3 text-left">은행</th>}
                                    {showAccountColumns && <th className="px-3 py-3 text-left">계좌</th>}
                                    {showAccountColumns && <th className="px-3 py-3 text-left">예금주</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading && (
                                    <tr>
                                        <td colSpan={tableColSpan} className="px-4 py-10 text-center text-slate-500">
                                            <FontAwesomeIcon icon={faSpinner} className="animate-spin mr-2" />
                                            로딩 중...
                                        </td>
                                    </tr>
                                )}

                                {!loading && filteredRows.length === 0 && (
                                    <tr>
                                        <td colSpan={tableColSpan} className="px-4 py-10 text-center text-slate-400">
                                            조회 결과가 없습니다.
                                        </td>
                                    </tr>
                                )}

                                {!loading &&
                                    filteredRows.map((row) => {
                                        const invalidClass = row.isValid ? '' : 'bg-amber-50';
                                        const isActualChanged = row.actualUnitPrice !== row.originalUnitPrice;
                                        const isBillingChanged = row.billingUnitPrice !== row.originalUnitPrice;
                                        const isReportChanged = row.reportUnitPrice !== row.originalUnitPrice;

                                        return (
                                            <tr key={row.rowKey} className={`hover:bg-slate-50 ${invalidClass}`}>
                                                <td className="px-3 py-2 whitespace-nowrap font-mono text-xs text-slate-600">{row.date}</td>
                                                <td className="px-3 py-2 whitespace-nowrap font-semibold text-slate-800">{row.workerName}</td>
                                                <td className="px-3 py-2 whitespace-nowrap text-slate-700">{row.teamName}</td>
                                                <td className="px-3 py-2 text-right font-mono">{row.manDay.toFixed(1)}</td>
                                                <td className="px-3 py-2 text-right font-mono">{formatNumber(row.originalUnitPrice)}</td>
                                                <td className="px-3 py-2 text-right">
                                                    <input
                                                        type="number"
                                                        value={row.actualUnitPrice}
                                                        onChange={(e) =>
                                                            updateRow(row.rowKey, (prev) => ({ ...prev, actualUnitPrice: Number(e.target.value) }))
                                                        }
                                                        step={5000}
                                                        className={`w-20 rounded px-2 py-1 text-right font-mono text-xs focus:outline-none focus:ring-2 ${
                                                            isActualChanged
                                                                ? 'border border-emerald-300 bg-emerald-50 text-emerald-900 focus:ring-emerald-200'
                                                                : 'border border-slate-300 bg-white text-emerald-700 focus:ring-blue-200'
                                                        }`}
                                                    />
                                                </td>
                                                <td className="px-3 py-2 text-right">
                                                    <input
                                                        type="number"
                                                        value={row.billingUnitPrice}
                                                        onChange={(e) =>
                                                            updateRow(row.rowKey, (prev) => ({ ...prev, billingUnitPrice: Number(e.target.value) }))
                                                        }
                                                        step={5000}
                                                        className={`w-20 rounded px-2 py-1 text-right font-mono text-xs focus:outline-none focus:ring-2 ${
                                                            isBillingChanged
                                                                ? 'border border-orange-300 bg-orange-50 text-orange-900 focus:ring-orange-200'
                                                                : 'border border-slate-300 bg-white text-orange-700 focus:ring-blue-200'
                                                        }`}
                                                    />
                                                </td>
                                                <td className="px-3 py-2 text-right">
                                                    <input
                                                        type="number"
                                                        value={row.reportUnitPrice}
                                                        onChange={(e) =>
                                                            updateRow(row.rowKey, (prev) => ({ ...prev, reportUnitPrice: Number(e.target.value) }))
                                                        }
                                                        step={5000}
                                                        className={`w-20 rounded px-2 py-1 text-right font-mono text-xs focus:outline-none focus:ring-2 ${
                                                            isReportChanged
                                                                ? 'border border-blue-300 bg-blue-50 text-blue-900 focus:ring-blue-200'
                                                                : 'border border-slate-300 bg-white text-blue-700 focus:ring-blue-200'
                                                        }`}
                                                    />
                                                </td>
                                                {showAccountColumns && (
                                                    <td
                                                        className={`px-3 py-2 whitespace-nowrap ${
                                                            row.errors.bankName || row.errors.bankCode ? 'text-red-700 font-semibold' : ''
                                                        }`}
                                                    >
                                                        {row.bankName || '-'}
                                                    </td>
                                                )}
                                                {showAccountColumns && (
                                                    <td
                                                        className={`px-3 py-2 whitespace-nowrap font-mono ${
                                                            row.errors.accountNumber ? 'text-red-700 font-semibold' : ''
                                                        }`}
                                                    >
                                                        {row.accountNumber || '-'}
                                                    </td>
                                                )}
                                                {showAccountColumns && (
                                                    <td
                                                        className={`px-3 py-2 whitespace-nowrap ${
                                                            row.errors.accountHolder ? 'text-red-700 font-semibold' : ''
                                                        }`}
                                                    >
                                                        {row.accountHolder || '-'}

                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DailyWageDraftPage;
