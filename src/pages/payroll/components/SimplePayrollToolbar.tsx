import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faCalendarDays,
    faChevronLeft,
    faChevronRight,
    faDownload,
    faFileExcel,
    faFileZipper,
    faFloppyDisk,
    faSearch,
    faSliders,
    faSpinner,
} from '@fortawesome/free-solid-svg-icons';

import { Team } from '../../../services/teamService';
import { Worker } from '../../../services/manpowerService';

export interface PayrollToolbarProps {
    hideHeader: boolean;
    rangeLabel: string;
    targetCount: number;
    monthRangeLength: number;
    totalLoadCount: number;
    monthSelectionMode: 'single' | 'range';
    handleMonthModeChange: (mode: 'single' | 'range') => void;
    yearCursor: string;
    setYearCursor: (ym: string) => void;
    shiftYearMonth: (ym: string, shift: number) => string;
    formatYearMonthParts: (ym: string) => { year: string; month: string };
    handleSelectPrevMonth: () => void;
    handleSelectCurrentMonth: () => void;
    monthRangeSet: Set<string>;
    startMonth: string;
    endMonth: string;
    rangeAnchorMonth: string | null;
    handleMonthButtonSelect: (ym: string) => void;
    teamDropdownRef: React.RefObject<HTMLDivElement>;
    teamDropdownOpen: boolean;
    setTeamDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
    selectedTeamLabel: string;
    selectedTeamId: string;
    setSelectedTeamId: (id: string) => void;
    teams: Team[];
    filterMode: 'team' | 'worker';
    setFilterMode: (mode: 'team' | 'worker') => void;
    selectedWorkerId: string;
    setSelectedWorkerId: (id: string) => void;
    workerOptions: Worker[];
    workerSearchText: string;
    setWorkerSearchText: (text: string) => void;
    pageViewMode: 'simple' | 'standard' | 'ledger';
    setPageViewMode: (mode: 'simple' | 'standard' | 'ledger') => void;
    ledgerSalaryModelFilter: 'all' | 'monthly' | 'daily' | 'service';
    setLedgerSalaryModelFilter: (filter: 'all' | 'monthly' | 'daily' | 'service') => void;
    ledgerVisibleSections: { utilities: boolean; advances: boolean; taxes: boolean };
    setLedgerVisibleSections: React.Dispatch<React.SetStateAction<{ utilities: boolean; advances: boolean; taxes: boolean }>>;
    showAccountColumns: boolean;
    setShowAccountColumns: (show: boolean) => void;
    showCalculationLabor: boolean;
    setShowCalculationLabor: (show: boolean) => void;
    insuranceApplied: boolean;
    insuranceTeamSiteOnly: boolean;
    businessIncomeApplied: boolean;
    utilitiesApplied: boolean;
    dailyFeeApplied: boolean;
    applyCalculatedDeductions: (params: {
        applyInsurance: boolean;
        applyBusinessIncome: boolean;
        applyUtilities: boolean;
        applyDailyFee: boolean;
        applyInsuranceTeamSiteOnly: boolean;
        immediate?: boolean;
    }) => void;
    insuranceThresholdDays: number;
    withholdingApplyAllLaborView: boolean;
    WITHHOLDING_MAX_MAN_DAY: number;
    withholdingBaseDeductionWonView: number;
    withholdingIncomeRatePercentView: number;
    withholdingTaxCreditPercentView: number;
    withholdingResidentRatePercentView: number;
    employmentApplyBelowThresholdView: boolean;
    dailyWorkerFeePerManDayView: number;
    fetchData: () => void;
    toolbarExpanded: boolean;
    setToolbarExpanded: React.Dispatch<React.SetStateAction<boolean>>;
    openInsuranceSettings: () => void;
    setShowKBPreview: (show: boolean) => void;
    isPaymentDataEmpty: boolean;
    openPayslipPreview: () => void;
    handleBatchDownload: () => void;
    batchDownloading: boolean;
    advanceLedgerRef: React.RefObject<any>;
    isLedgerRowsDataEmpty: boolean;
    currentYearMonth: string;
    handleSavePayrollSettlement: () => void;
    payrollSettlementSaving: boolean;
    payrollSettlementLoading: boolean;
    payrollSettlementFeedback: string;
    payrollSettlementDisabled: boolean;
}

const ToggleButton: React.FC<{
    active: boolean;
    children: React.ReactNode;
    onClick: () => void;
    disabled?: boolean;
}> = ({ active, children, onClick, disabled = false }) => (
    <button
        type="button"
        aria-pressed={active}
        disabled={disabled}
        onClick={onClick}
        className={`h-8 rounded-lg border px-3 text-[13px] font-semibold transition-colors ${
            active
                ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
        } disabled:cursor-not-allowed disabled:opacity-45`}
    >
        {children}
    </button>
);

export const PayrollToolbar: React.FC<PayrollToolbarProps> = ({
    rangeLabel,
    targetCount,
    monthRangeLength,
    totalLoadCount,
    monthSelectionMode,
    handleMonthModeChange,
    yearCursor,
    setYearCursor,
    shiftYearMonth,
    formatYearMonthParts,
    handleSelectPrevMonth,
    handleSelectCurrentMonth,
    monthRangeSet,
    startMonth,
    endMonth,
    rangeAnchorMonth,
    handleMonthButtonSelect,
    selectedTeamId,
    setSelectedTeamId,
    teams,
    filterMode,
    setFilterMode,
    selectedWorkerId,
    setSelectedWorkerId,
    workerOptions,
    workerSearchText,
    setWorkerSearchText,
    pageViewMode,
    setPageViewMode,
    ledgerSalaryModelFilter,
    setLedgerSalaryModelFilter,
    ledgerVisibleSections,
    setLedgerVisibleSections,
    showAccountColumns,
    setShowAccountColumns,
    showCalculationLabor,
    setShowCalculationLabor,
    insuranceApplied,
    insuranceTeamSiteOnly,
    businessIncomeApplied,
    utilitiesApplied,
    dailyFeeApplied,
    applyCalculatedDeductions,
    insuranceThresholdDays,
    withholdingApplyAllLaborView,
    WITHHOLDING_MAX_MAN_DAY,
    withholdingBaseDeductionWonView,
    withholdingIncomeRatePercentView,
    withholdingTaxCreditPercentView,
    withholdingResidentRatePercentView,
    employmentApplyBelowThresholdView,
    dailyWorkerFeePerManDayView,
    fetchData,
    toolbarExpanded,
    setToolbarExpanded,
    openInsuranceSettings,
    setShowKBPreview,
    isPaymentDataEmpty,
    openPayslipPreview,
    handleBatchDownload,
    batchDownloading,
    advanceLedgerRef,
    isLedgerRowsDataEmpty,
    currentYearMonth,
    handleSavePayrollSettlement,
    payrollSettlementSaving,
    payrollSettlementLoading,
    payrollSettlementFeedback,
    payrollSettlementDisabled,
}) => {
    const selectedWorker = workerOptions.find((worker) => worker.id === selectedWorkerId);
    const normalizedWorkerSearch = workerSearchText.trim();
    const showWorkerSuggestions = filterMode === 'worker'
        && normalizedWorkerSearch.length > 0
        && (!selectedWorker || (selectedWorker.name ?? '').trim() !== normalizedWorkerSearch);
    const workerSuggestions = showWorkerSuggestions ? workerOptions.slice(0, 8) : [];

    const applyRules = (overrides: Partial<{
        applyInsurance: boolean;
        applyBusinessIncome: boolean;
        applyUtilities: boolean;
        applyDailyFee: boolean;
        applyInsuranceTeamSiteOnly: boolean;
    }>) => {
        applyCalculatedDeductions({
            applyInsurance: insuranceApplied,
            applyBusinessIncome: businessIncomeApplied,
            applyUtilities: utilitiesApplied,
            applyDailyFee: dailyFeeApplied,
            applyInsuranceTeamSiteOnly: insuranceTeamSiteOnly,
            ...overrides,
        });
    };

    const activeRuleCount = [
        insuranceApplied,
        businessIncomeApplied,
        utilitiesApplied,
        dailyFeeApplied,
    ].filter(Boolean).length;

    return (
        <section className="mb-1.5 flex-shrink-0 rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 px-2.5 py-1.5">
                <div className="flex min-w-[180px] items-center gap-2">
                    <span className="flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-blue-50 text-[13px] text-blue-600">
                        <FontAwesomeIcon icon={faCalendarDays} />
                    </span>
                    <div className="flex min-w-0 items-baseline gap-2">
                        <h1 className="whitespace-nowrap text-[16px] font-bold leading-none text-slate-900">월 급여 정산</h1>
                        <p className="hidden whitespace-nowrap text-[11px] text-slate-500 xl:block">기간과 대상을 고른 뒤 조회하세요.</p>
                    </div>
                </div>

                <div className="flex items-center rounded-lg bg-slate-100 p-0.5">
                    <button
                        type="button"
                        onClick={() => setPageViewMode('simple')}
                        className={`h-7 rounded-md px-2.5 text-[12px] font-bold transition-colors ${
                            pageViewMode === 'simple' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                        }`}
                    >
                        간편 마감
                    </button>
                    <button
                        type="button"
                        onClick={() => setPageViewMode('ledger')}
                        className={`h-7 rounded-md px-2.5 text-[12px] font-bold transition-colors ${
                            pageViewMode === 'ledger' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                        }`}
                    >
                        가불대장
                    </button>
                    <button
                        type="button"
                        onClick={() => setPageViewMode('standard')}
                        className={`h-7 rounded-md px-2.5 text-[12px] font-bold transition-colors ${
                            pageViewMode === 'standard' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                        }`}
                    >
                        급여표
                    </button>
                </div>

                <div className="ml-auto flex flex-none items-center justify-end gap-1.5">
                    <span className="whitespace-nowrap rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">
                        {rangeLabel || '-'} · {targetCount}명
                    </span>
                    {payrollSettlementFeedback && (
                        <span
                            className="max-w-[240px] truncate whitespace-nowrap text-[11px] font-semibold text-emerald-700"
                            title={payrollSettlementFeedback}
                            aria-live="polite"
                        >
                            {payrollSettlementFeedback}
                        </span>
                    )}
                    <button
                        type="button"
                        onClick={handleSavePayrollSettlement}
                        disabled={payrollSettlementDisabled || payrollSettlementSaving || payrollSettlementLoading}
                        className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg bg-emerald-600 px-3 text-[12px] font-bold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                        title={payrollSettlementDisabled ? '팀 모드에서 조회된 정산을 저장할 수 있습니다.' : '팀 신고 결과와 작업자별 정산 입력을 함께 저장합니다.'}
                    >
                        <FontAwesomeIcon
                            icon={payrollSettlementSaving || payrollSettlementLoading ? faSpinner : faFloppyDisk}
                            spin={payrollSettlementSaving || payrollSettlementLoading}
                        />
                        {payrollSettlementSaving
                            ? '저장 중'
                            : payrollSettlementLoading
                                ? '불러오는 중'
                                : '초안 저장'}
                    </button>
                    <button
                        type="button"
                        onClick={() => setToolbarExpanded((prev) => !prev)}
                        aria-expanded={toolbarExpanded}
                        className={`inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 text-[12px] font-semibold transition-colors ${
                            toolbarExpanded
                                ? 'border-blue-200 bg-blue-50 text-blue-700'
                                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                        }`}
                    >
                        <FontAwesomeIcon icon={faSliders} />
                        설정 · 내보내기
                    </button>
                </div>
            </div>

            <div className="border-t border-slate-100 px-2.5 py-1.5">
                <div className="flex min-w-0 flex-nowrap items-center gap-2 overflow-x-auto">
                    <div className="flex flex-none items-center">
                        <span className="sr-only">기간</span>
                        <div className="flex items-center gap-1">
                            <div className="flex flex-none rounded-lg bg-slate-100 p-0.5">
                                <button
                                    type="button"
                                    onClick={() => handleMonthModeChange('single')}
                                    className={`h-7 rounded-md px-2.5 text-[12px] font-bold ${
                                        monthSelectionMode === 'single' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'
                                    }`}
                                >
                                    단일 월
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleMonthModeChange('range')}
                                    className={`h-7 rounded-md px-2.5 text-[12px] font-bold ${
                                        monthSelectionMode === 'range' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'
                                    }`}
                                >
                                    기간
                                </button>
                            </div>
                            <button
                                type="button"
                                aria-label="이전 연도"
                                onClick={() => setYearCursor(shiftYearMonth(yearCursor, -12))}
                                className="h-8 w-7 rounded-lg border border-slate-200 bg-white text-[12px] text-slate-500 hover:text-slate-900"
                            >
                                <FontAwesomeIcon icon={faChevronLeft} />
                            </button>
                            <span className="min-w-[54px] text-center text-[12px] font-bold text-slate-700">
                                {formatYearMonthParts(yearCursor).year}년
                            </span>
                            <button
                                type="button"
                                aria-label="다음 연도"
                                onClick={() => setYearCursor(shiftYearMonth(yearCursor, 12))}
                                className="h-8 w-7 rounded-lg border border-slate-200 bg-white text-[12px] text-slate-500 hover:text-slate-900"
                            >
                                <FontAwesomeIcon icon={faChevronRight} />
                            </button>
                        </div>
                    </div>

                    <div className="flex w-[420px] flex-none items-center gap-1">
                        <div className="flex flex-none items-center gap-0.5">
                            <span className="sr-only">월 선택</span>
                            <div className="flex items-center gap-1">
                                <button type="button" onClick={handleSelectPrevMonth} className="h-8 rounded-md px-1 text-[11px] font-semibold text-slate-500 hover:bg-slate-100 hover:text-blue-700">전달</button>
                                <button type="button" onClick={handleSelectCurrentMonth} className="h-8 rounded-md px-1 text-[11px] font-semibold text-slate-500 hover:bg-slate-100 hover:text-blue-700">이달</button>
                            </div>
                        </div>
                        <div className="grid min-w-0 flex-1 grid-cols-12 gap-0.5">
                            {Array.from({ length: 12 }, (_, index) => index + 1).map((monthNumber) => {
                                const year = formatYearMonthParts(yearCursor).year;
                                const ym = `${year}-${String(monthNumber).padStart(2, '0')}`;
                                const isInRange = monthRangeSet.has(ym);
                                const isEndpoint = startMonth === ym || endMonth === ym;
                                const isAnchor = monthSelectionMode === 'range' && rangeAnchorMonth === ym;
                                const isActive = isEndpoint || isAnchor;

                                return (
                                    <button
                                        key={ym}
                                        type="button"
                                        aria-label={`${monthNumber}월`}
                                        onClick={() => handleMonthButtonSelect(ym)}
                                        className={`h-8 min-w-0 rounded-md text-[11px] font-bold transition-colors ${
                                            isActive
                                                ? 'bg-blue-600 text-white shadow-sm'
                                                : isInRange
                                                    ? 'bg-blue-50 text-blue-700'
                                                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                                        }`}
                                    >
                                        {monthNumber}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="flex min-w-[280px] flex-1 items-center">
                        <span className="sr-only">대상</span>
                        <div className="flex min-w-0 flex-1 items-center gap-1">
                            <div className="flex flex-none rounded-lg bg-slate-100 p-0.5">
                                <button
                                    type="button"
                                    onClick={() => setFilterMode('team')}
                                    className={`h-7 rounded-md px-2.5 text-[12px] font-bold ${filterMode === 'team' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`}
                                >
                                    팀
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFilterMode('worker')}
                                    className={`h-7 rounded-md px-2.5 text-[12px] font-bold ${filterMode === 'worker' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`}
                                >
                                    개인
                                </button>
                            </div>

                            {filterMode === 'team' ? (
                                <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto rounded-lg border border-slate-200 bg-white p-0.5 custom-scrollbar">
                                    <button
                                        type="button"
                                        aria-pressed={selectedTeamId === ''}
                                        onClick={() => setSelectedTeamId('')}
                                        className={`h-7 flex-none rounded-md px-2.5 text-[12px] font-bold transition-colors ${
                                            selectedTeamId === ''
                                                ? 'bg-blue-600 text-white shadow-sm'
                                                : 'text-slate-600 hover:bg-slate-100'
                                        }`}
                                    >
                                        전체
                                    </button>
                                    {teams
                                        .filter((team): team is Team & { id: string } => typeof team.id === 'string' && team.id.trim().length > 0)
                                        .map((team) => (
                                            <button
                                                key={team.id}
                                                type="button"
                                                aria-pressed={selectedTeamId === team.id}
                                                onClick={() => setSelectedTeamId(team.id)}
                                                className={`h-7 flex-none rounded-md px-2.5 text-[12px] font-bold transition-colors ${
                                                    selectedTeamId === team.id
                                                        ? 'bg-blue-600 text-white shadow-sm'
                                                        : 'text-slate-600 hover:bg-slate-100'
                                                }`}
                                            >
                                                {team.name}
                                            </button>
                                        ))}
                                </div>
                            ) : (
                                <div className="relative min-w-[220px] flex-1">
                                    <input
                                        type="search"
                                        role="combobox"
                                        aria-label="개인 이름 검색"
                                        aria-expanded={showWorkerSuggestions}
                                        aria-controls="monthly-wage-worker-search-results"
                                        aria-autocomplete="list"
                                        value={workerSearchText}
                                        onChange={(event) => {
                                            const nextValue = event.target.value;
                                            setWorkerSearchText(nextValue);
                                            if (!selectedWorker || (selectedWorker.name ?? '').trim() !== nextValue.trim()) {
                                                setSelectedWorkerId('');
                                            }
                                        }}
                                        placeholder="이름을 입력하세요"
                                        className={`h-8 w-full rounded-lg border bg-white px-3 pr-9 text-[12px] font-semibold outline-none ${
                                            selectedWorkerId
                                                ? 'border-emerald-400 text-emerald-800'
                                                : 'border-slate-200 text-slate-700 focus:border-blue-400'
                                        }`}
                                    />
                                    {workerSearchText && (
                                        <button
                                            type="button"
                                            aria-label="개인 검색 지우기"
                                            onClick={() => {
                                                setWorkerSearchText('');
                                                setSelectedWorkerId('');
                                            }}
                                            className="absolute right-2 top-1/2 h-6 w-6 -translate-y-1/2 rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                                        >
                                            ×
                                        </button>
                                    )}
                                    {showWorkerSuggestions && (
                                        <div id="monthly-wage-worker-search-results" role="listbox" className="absolute left-0 right-0 z-[90] mt-1 max-h-64 overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
                                            {workerSuggestions.length > 0 ? workerSuggestions.map((worker) => (
                                                <button
                                                    key={worker.id}
                                                    type="button"
                                                    role="option"
                                                    aria-selected={selectedWorkerId === worker.id}
                                                    onClick={() => {
                                                        setSelectedWorkerId(worker.id ?? '');
                                                        setWorkerSearchText(worker.name ?? '');
                                                    }}
                                                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[13px] font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                                                >
                                                    <span>{worker.name}</span>
                                                    <span className="text-[11px] font-normal text-slate-400">{worker.payType || ''}</span>
                                                </button>
                                            )) : (
                                                <div className="px-3 py-3 text-center text-[12px] text-slate-500">검색 결과가 없습니다.</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            <button
                                type="button"
                                onClick={fetchData}
                                className="inline-flex h-8 flex-none items-center gap-1.5 whitespace-nowrap rounded-lg bg-slate-900 px-3 text-[12px] font-bold text-white shadow-sm transition-colors hover:bg-slate-700"
                            >
                                <FontAwesomeIcon icon={faSearch} />
                                조회
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {toolbarExpanded && (
                <div className="border-t border-slate-200 bg-slate-50/80 px-3 py-3">
                    <div className="grid gap-3 xl:grid-cols-3">
                        <div className="rounded-xl border border-slate-200 bg-white p-3">
                            <div className="mb-2 flex items-center justify-between">
                                <h2 className="text-[13px] font-bold text-slate-800">표시 항목</h2>
                                <span className="text-[11px] text-slate-400">{pageViewMode === 'ledger' ? '가불대장' : '급여표'}</span>
                            </div>
                            {pageViewMode === 'ledger' ? (
                                <>
                                    <div className="flex flex-wrap gap-1.5">
                                        <ToggleButton
                                            active={ledgerVisibleSections.advances}
                                            onClick={() => setLedgerVisibleSections((prev) => ({ ...prev, advances: !prev.advances }))}
                                        >
                                            가불
                                        </ToggleButton>
                                        <ToggleButton
                                            active={ledgerVisibleSections.utilities}
                                            onClick={() => setLedgerVisibleSections((prev) => ({ ...prev, utilities: !prev.utilities }))}
                                        >
                                            공과금
                                        </ToggleButton>
                                        <ToggleButton
                                            active={ledgerVisibleSections.taxes}
                                            onClick={() => setLedgerVisibleSections((prev) => ({ ...prev, taxes: !prev.taxes }))}
                                        >
                                            세금
                                        </ToggleButton>
                                    </div>
                                    <div className="mt-3 border-t border-slate-100 pt-3">
                                        <span className="mb-1.5 block text-[11px] font-semibold text-slate-400">급여 유형</span>
                                        <div className="flex flex-wrap gap-1.5">
                                            {([
                                                ['all', '전체'],
                                                ['monthly', '월급제'],
                                                ['daily', '일급제'],
                                                ['service', '용역팀'],
                                            ] as const).map(([value, label]) => (
                                                <ToggleButton key={value} active={ledgerSalaryModelFilter === value} onClick={() => setLedgerSalaryModelFilter(value)}>
                                                    {label}
                                                </ToggleButton>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="flex flex-wrap gap-1.5">
                                    <ToggleButton active={showAccountColumns} onClick={() => setShowAccountColumns(!showAccountColumns)}>계좌 정보</ToggleButton>
                                    <ToggleButton active={showCalculationLabor} onClick={() => setShowCalculationLabor(!showCalculationLabor)}>계산 노무</ToggleButton>
                                </div>
                            )}
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-white p-3">
                            <div className="mb-2 flex items-center justify-between">
                                <h2 className="text-[13px] font-bold text-slate-800">자동 공제</h2>
                                <span className="text-[11px] font-semibold text-blue-600">{activeRuleCount}개 적용</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                <ToggleButton active={insuranceApplied} onClick={() => applyRules({ applyInsurance: !insuranceApplied })}>4대보험</ToggleButton>
                                <ToggleButton
                                    active={insuranceTeamSiteOnly}
                                    disabled={!insuranceApplied}
                                    onClick={() => applyRules({ applyInsuranceTeamSiteOnly: !insuranceTeamSiteOnly })}
                                >
                                    해당팀만
                                </ToggleButton>
                                <ToggleButton active={businessIncomeApplied} onClick={() => applyRules({ applyBusinessIncome: !businessIncomeApplied })}>사업소득</ToggleButton>
                                <ToggleButton active={utilitiesApplied} onClick={() => applyRules({ applyUtilities: !utilitiesApplied })}>공과금 반영</ToggleButton>
                                <ToggleButton active={dailyFeeApplied} onClick={() => applyRules({ applyDailyFee: !dailyFeeApplied })}>일급 수수료</ToggleButton>
                            </div>
                            <p className="mt-3 text-[11px] leading-5 text-slate-500">
                                보험 {insuranceThresholdDays}공수 · 원천세 {withholdingApplyAllLaborView ? '노무 전체' : `${WITHHOLDING_MAX_MAN_DAY}공수 이하`}
                                {' '}· 기본공제 {withholdingBaseDeductionWonView.toLocaleString()}원 · 갑근세 {withholdingIncomeRatePercentView}%
                                {' '}· 세액공제 {withholdingTaxCreditPercentView}% · 지방세 {withholdingResidentRatePercentView}%
                                {' '}· 일급 수수료 {dailyWorkerFeePerManDayView.toLocaleString()}원
                                {employmentApplyBelowThresholdView ? ' · 고용보험 미달공수 포함' : ''}
                            </p>
                            <button
                                type="button"
                                onClick={openInsuranceSettings}
                                className="mt-2 text-[12px] font-bold text-blue-700 hover:text-blue-900"
                            >
                                요율 상세 설정
                            </button>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-white p-3">
                            <div className="mb-2 flex items-center justify-between">
                                <h2 className="text-[13px] font-bold text-slate-800">내보내기</h2>
                                <span className="text-[11px] text-slate-400">{totalLoadCount}건 · {monthRangeLength}개월</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                <button
                                    type="button"
                                    disabled={isPaymentDataEmpty}
                                    onClick={() => setShowKBPreview(true)}
                                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                                >
                                    <FontAwesomeIcon icon={faFileExcel} />
                                    은행 이체
                                </button>
                                <button
                                    type="button"
                                    disabled={isPaymentDataEmpty}
                                    onClick={openPayslipPreview}
                                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                                >
                                    <FontAwesomeIcon icon={faDownload} />
                                    명세서
                                </button>
                                <button
                                    type="button"
                                    disabled={isPaymentDataEmpty || batchDownloading}
                                    onClick={handleBatchDownload}
                                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                                >
                                    <FontAwesomeIcon icon={batchDownloading ? faSpinner : faFileZipper} spin={batchDownloading} />
                                    {batchDownloading ? '처리 중' : '일괄 저장'}
                                </button>
                                <button
                                    type="button"
                                    disabled={isLedgerRowsDataEmpty}
                                    onClick={() => advanceLedgerRef.current?.downloadExcel(rangeLabel || currentYearMonth)}
                                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                                >
                                    <FontAwesomeIcon icon={faFileExcel} />
                                    가불대장
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
};
