import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faCalendarDays, faChevronLeft, faChevronRight, faChevronDown, faChevronUp,
    faSearch, faFileExcel, faDownload, faFileZipper, faSpinner, faSave
} from '@fortawesome/free-solid-svg-icons';
import {
    ToolbarContainer, ToolbarLead, ToolbarLeadMeta, ToolbarBadge, ActionButton,
    ToolbarGrid, ToolbarCard, ToolbarCardHeader, ToolbarCardTitle, ToolbarCardDescription,
    ToolbarCardBody, ToolbarInline, ToolbarSectionDivider, YearNavigator, YearButton,
    YearText, QuickRangeGroup, QuickRangeButton, MonthGrid, MonthButton, SegmentedGroup,
    SegmentedButton, FieldCard, FieldLabel, ToggleChipGroup, ToggleChipButton,
    ActionCluster, SwitchWrapper, SwitchTextGroup, SwitchLabel, SwitchState, SwitchInput, Slider
} from '../styles/MonthlyWageDraft.styles';

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
    formatYearMonthParts: (ym: string) => { year: string, month: string };
    handleSelectPrevMonth: () => void;
    handleSelectCurrentMonth: () => void;
    monthRangeSet: Set<string>;
    startMonth: string;
    endMonth: string;
    rangeAnchorMonth: string | null;
    handleMonthButtonSelect: (ym: string) => void;

    // Team & Worker Filter
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

    pageViewMode: 'standard' | 'ledger';
    setPageViewMode: (mode: 'standard' | 'ledger') => void;

    ledgerVisibleSections: { utilities: boolean, advances: boolean, taxes: boolean };
    setLedgerVisibleSections: React.Dispatch<React.SetStateAction<{ utilities: boolean, advances: boolean, taxes: boolean }>>;

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
}

const ModernSwitch: React.FC<{
    label: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    compact?: boolean;
}> = ({ label, checked, onChange, compact = false }) => (
    <div style={compact ? { transform: 'scale(1)', transformOrigin: 'left center' } : undefined}>
        <SwitchWrapper $checked={checked}>
            <SwitchTextGroup>
                <SwitchLabel>{label}</SwitchLabel>
                <SwitchState $checked={checked}>{checked ? '적용' : '해제'}</SwitchState>
            </SwitchTextGroup>
            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                <SwitchInput type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
                <Slider $checked={checked} />
            </div>
        </SwitchWrapper>
    </div>
);

export const PayrollToolbar: React.FC<PayrollToolbarProps> = ({
    hideHeader,
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
    teamDropdownRef,
    teamDropdownOpen,
    setTeamDropdownOpen,
    selectedTeamLabel,
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
}) => {
    return (
        <>
            {!hideHeader && (
                <div className="flex-shrink-0 bg-white border border-slate-200 rounded-lg shadow-sm px-2 py-1.5 mb-1.5">
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-1.5">
                            <div className="bg-rose-100 text-rose-600 p-1 rounded-md">
                                <FontAwesomeIcon icon={faCalendarDays} className="text-sm" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-slate-800 leading-tight">통합급여관리</h1>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 text-base min-w-0 overflow-visible">
                            <div className="rounded-xl border border-slate-200 bg-slate-50 px-1.5 py-1">
                                <div className="flex flex-wrap items-center gap-1">
                                    <span className="font-semibold text-slate-700 mr-1">정산기간</span>

                                    <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
                                        <button
                                            type="button"
                                            onClick={() => handleMonthModeChange('single')}
                                            className={`px-3 h-8 rounded-md text-[14px] font-bold transition-colors ${monthSelectionMode === 'single' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                                        >
                                            해당달
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleMonthModeChange('range')}
                                            className={`px-3 h-8 rounded-md text-[14px] font-bold transition-colors ${monthSelectionMode === 'range' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                                        >
                                            기간
                                        </button>
                                    </div>

                                    <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-1.5 py-1">
                                        <button
                                            type="button"
                                            onClick={() => setYearCursor(shiftYearMonth(yearCursor, -12))}
                                            className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-800"
                                            aria-label="이전 연도"
                                        >
                                            <FontAwesomeIcon icon={faChevronLeft} className="text-[12px]" />
                                        </button>
                                        <span className="min-w-[66px] text-center text-[14px] font-bold text-slate-700">{formatYearMonthParts(yearCursor).year}년</span>
                                        <button
                                            type="button"
                                            onClick={() => setYearCursor(shiftYearMonth(yearCursor, 12))}
                                            className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-800"
                                            aria-label="다음 연도"
                                        >
                                            <FontAwesomeIcon icon={faChevronRight} className="text-[12px]" />
                                        </button>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={handleSelectPrevMonth}
                                        className={`h-8 rounded-md border px-3 text-[14px] font-bold transition-colors ${startMonth === (formatYearMonthParts(shiftYearMonth(currentYearMonth, -1)).year + "-" + formatYearMonthParts(shiftYearMonth(currentYearMonth, -1)).month) && endMonth === (formatYearMonthParts(shiftYearMonth(currentYearMonth, -1)).year + "-" + formatYearMonthParts(shiftYearMonth(currentYearMonth, -1)).month) ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'}`}
                                    >
                                        전달
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleSelectCurrentMonth}
                                        className={`h-8 rounded-md border px-3 text-[14px] font-bold transition-colors ${startMonth === currentYearMonth && endMonth === currentYearMonth ? 'border-blue-500 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'}`}
                                    >
                                        이달
                                    </button>

                                    <div className="flex flex-wrap items-center gap-1 px-1 border-l border-slate-200">
                                    {Array.from({ length: 12 }, (_, i) => i + 1).map((monthNumber) => {
                                        const year = formatYearMonthParts(yearCursor).year;
                                        const ym = `${year}-${String(monthNumber).padStart(2, '0')}`;
                                        const isInRange = monthRangeSet.has(ym);
                                        const isActive = startMonth === ym || endMonth === ym;
                                        const isAnchor = monthSelectionMode === 'range' && rangeAnchorMonth === ym;

                                        return (
                                            <button
                                                key={`top-month-${monthNumber}`}
                                                type="button"
                                                onClick={() => handleMonthButtonSelect(ym)}
                                                className={`h-7 min-w-[32px] rounded-md border px-2 text-[13px] font-bold transition-colors ${isActive || isAnchor ? 'border-blue-500 bg-blue-600 text-white' : isInRange ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'}`}
                                            >
                                                {monthNumber}
                                            </button>
                                        );
                                    })}
                                    </div>

                                    <span className="ml-1 rounded-md border border-slate-200 bg-white px-3 py-1 text-[14px] font-semibold text-slate-700">
                                        {rangeLabel || '-'}
                                    </span>
                                </div>
                            </div>

                            <span className="ml-1 font-semibold text-slate-700">팀선택</span>
                            <div className="relative shrink-0" ref={teamDropdownRef}>
                                <button
                                    type="button"
                                    onClick={() => setTeamDropdownOpen((prev) => !prev)}
                                    className="h-10 min-w-[152px] rounded-lg border border-slate-300 bg-white px-3 text-base font-semibold text-slate-700 inline-flex items-center justify-between gap-2"
                                    aria-haspopup="listbox"
                                    aria-expanded={teamDropdownOpen}
                                >
                                    <span className="truncate">{selectedTeamLabel}</span>
                                    <FontAwesomeIcon icon={faChevronDown} className={`text-[12px] text-slate-500 transition-transform ${teamDropdownOpen ? 'rotate-180' : ''}`} />
                                </button>

                                {teamDropdownOpen && (
                                    <div className="absolute z-[80] mt-1 w-52 max-h-64 overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg p-1" role="listbox">
                                        <button
                                            type="button"
                                            className={`w-full text-left px-3 py-2.5 rounded text-base font-semibold transition-colors ${selectedTeamId === '' ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'}`}
                                            onClick={() => {
                                                setSelectedTeamId('');
                                                setTeamDropdownOpen(false);
                                            }}
                                        >
                                            팀전체
                                        </button>
                                        {teams
                                            .filter((team): team is Team & { id: string } => typeof team.id === 'string' && team.id.trim().length > 0)
                                            .map((team) => (
                                                <button
                                                    key={team.id}
                                                    type="button"
                                                    className={`w-full text-left px-3 py-2.5 rounded text-base font-semibold transition-colors ${selectedTeamId === team.id ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'}`}
                                                    onClick={() => {
                                                        setSelectedTeamId(team.id);
                                                        setTeamDropdownOpen(false);
                                                    }}
                                                >
                                                    {team.name}
                                                </button>
                                            ))}
                                    </div>
                                )}
                            </div>

                            <span className="ml-1 w-px h-5 bg-slate-200" />

                            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
                                <button
                                    type="button"
                                    className={`px-3 h-8 rounded-md text-[14px] font-bold transition-colors ${filterMode === 'team' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                                    onClick={() => setFilterMode('team')}
                                >
                                    팀
                                </button>
                                <button
                                    type="button"
                                    className={`px-3 h-8 rounded-md text-[14px] font-bold transition-colors ${filterMode === 'worker' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                                    onClick={() => setFilterMode('worker')}
                                >
                                    개인
                                </button>
                            </div>

                            {filterMode === 'worker' && (
                                <>
                                    <select
                                        value={selectedWorkerId}
                                        onChange={(e) => setSelectedWorkerId(e.target.value)}
                                        className="h-10 min-w-[132px] rounded-lg border border-slate-300 bg-white px-3 text-base font-semibold text-slate-700"
                                    >
                                        <option value="">개인전체</option>
                                        {workerOptions.map((worker) => (
                                            <option key={worker.id} value={worker.id}>{worker.name}</option>
                                        ))}
                                    </select>
                                    <input
                                        type="text"
                                        value={workerSearchText}
                                        onChange={(e) => setWorkerSearchText(e.target.value)}
                                        placeholder="이름 검색"
                                        className="h-10 w-32 rounded-lg border border-slate-300 bg-white px-3 text-base font-semibold text-slate-700 placeholder-slate-400"
                                    />
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <ToolbarContainer>
                <ToolbarLead>
                    <ToolbarLeadMeta>
                        <ToolbarBadge>{rangeLabel || '-'}</ToolbarBadge>
                        <ToolbarBadge>대상 {targetCount}명</ToolbarBadge>
                        <ActionButton type="button" $variant="secondary" onClick={fetchData}>
                            <FontAwesomeIcon icon={faSearch} />
                            조회
                        </ActionButton>
                        <ActionButton
                            type="button"
                            $variant="outline"
                            onClick={() => setToolbarExpanded((prev) => !prev)}
                        >
                            <FontAwesomeIcon icon={toolbarExpanded ? faChevronUp : faChevronDown} />
                            {toolbarExpanded ? '간편 보기' : '상세 설정'}
                        </ActionButton>
                    </ToolbarLeadMeta>
                </ToolbarLead>

                {toolbarExpanded && (
                    <ToolbarGrid>
                        <ToolbarCard $span={7}>
                            <ToolbarCardHeader>
                                <div>
                                    <ToolbarCardTitle>정산 기간 선택</ToolbarCardTitle>
                                    <ToolbarCardDescription>연도 이동과 월 범위 선택을 한 카드 안에서 처리합니다.</ToolbarCardDescription>
                                </div>
                                <ToolbarBadge>{monthRangeLength}개월</ToolbarBadge>
                            </ToolbarCardHeader>
                            <ToolbarCardBody>
                                <ToolbarInline>
                                    <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
                                        <button
                                            type="button"
                                            onClick={() => handleMonthModeChange('single')}
                                            className={`px-2.5 h-7 rounded-md text-xs font-bold transition-colors ${monthSelectionMode === 'single' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                                        >
                                            해당달
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleMonthModeChange('range')}
                                            className={`px-2.5 h-7 rounded-md text-xs font-bold transition-colors ${monthSelectionMode === 'range' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                                        >
                                            기간
                                        </button>
                                    </div>

                                    <ToolbarSectionDivider />

                                    <YearNavigator>
                                        <YearButton
                                            type="button"
                                            onClick={() => setYearCursor(shiftYearMonth(yearCursor, -12))}
                                            title="이전 연도"
                                        >
                                            <FontAwesomeIcon icon={faChevronLeft} />
                                        </YearButton>
                                        <YearText>{parseInt(yearCursor.split('-')[0], 10)}년</YearText>
                                        <YearButton
                                            type="button"
                                            onClick={() => setYearCursor(shiftYearMonth(yearCursor, 12))}
                                            title="다음 연도"
                                        >
                                            <FontAwesomeIcon icon={faChevronRight} />
                                        </YearButton>
                                    </YearNavigator>

                                    <ToolbarSectionDivider />

                                    <QuickRangeGroup>
                                        <QuickRangeButton
                                            type="button"
                                            onClick={handleSelectPrevMonth}
                                        >
                                            전달
                                        </QuickRangeButton>
                                        <QuickRangeButton
                                            type="button"
                                            onClick={handleSelectCurrentMonth}
                                        >
                                            이달
                                        </QuickRangeButton>
                                    </QuickRangeGroup>
                                </ToolbarInline>

                                <MonthGrid>
                                    {Array.from({ length: 12 }, (_, i) => i + 1).map((monthNumber) => {
                                        const year = formatYearMonthParts(yearCursor).year;
                                        const ym = `${year}-${String(monthNumber).padStart(2, '0')}`;
                                        const isInRange = monthRangeSet.has(ym);
                                        const isActive = startMonth === ym || endMonth === ym || (monthSelectionMode === 'range' && rangeAnchorMonth === ym);

                                        return (
                                            <MonthButton
                                                key={monthNumber}
                                                type="button"
                                                $active={isActive}
                                                $inRange={isInRange}
                                                onClick={() => handleMonthButtonSelect(ym)}
                                            >
                                                {monthNumber}월
                                            </MonthButton>
                                        );
                                    })}
                                </MonthGrid>

                                <div className="text-[11px] text-slate-500">
                                    {monthSelectionMode === 'single'
                                        ? '해당달 모드: 월 버튼을 누르면 시작월/종료월이 같은 달로 설정됩니다.'
                                        : rangeAnchorMonth
                                            ? `기간 모드: 종료월을 선택하세요. (시작월 ${rangeAnchorMonth})`
                                            : '기간 모드: 시작월을 선택한 뒤 종료월을 선택하세요.'}
                                </div>
                            </ToolbarCardBody>
                        </ToolbarCard>

                        <ToolbarCard $span={5}>
                            <ToolbarCardHeader>
                                <div>
                                    <ToolbarCardTitle>표시 방식 제어</ToolbarCardTitle>
                                    <ToolbarCardDescription>기본 목록과 가불 대장 전환, 세부 섹션 노출을 한 카드로 묶었습니다.</ToolbarCardDescription>
                                </div>
                                <ToolbarBadge>{pageViewMode === 'ledger' ? '가불대장' : '기본목록'}</ToolbarBadge>
                            </ToolbarCardHeader>
                            <ToolbarCardBody>
                                <SegmentedGroup>
                                    <SegmentedButton type="button" $active={pageViewMode === 'standard'} onClick={() => setPageViewMode('standard')}>
                                        기본 목록
                                    </SegmentedButton>
                                    <SegmentedButton type="button" $active={pageViewMode === 'ledger'} onClick={() => setPageViewMode('ledger')}>
                                        가불 대장
                                    </SegmentedButton>
                                </SegmentedGroup>

                                {pageViewMode === 'ledger' ? (
                                    <FieldCard>
                                        <FieldLabel>가불대장 항목</FieldLabel>
                                        <ToggleChipGroup>
                                            <ToggleChipButton
                                                type="button"
                                                $active={ledgerVisibleSections.utilities}
                                                onClick={() => setLedgerVisibleSections((prev) => ({ ...prev, utilities: !prev.utilities }))}
                                            >
                                                공과금
                                            </ToggleChipButton>
                                            <ToggleChipButton
                                                type="button"
                                                $active={ledgerVisibleSections.advances}
                                                onClick={() => setLedgerVisibleSections((prev) => ({ ...prev, advances: !prev.advances }))}
                                            >
                                                가불
                                            </ToggleChipButton>
                                            <ToggleChipButton
                                                type="button"
                                                $active={ledgerVisibleSections.taxes}
                                                onClick={() => setLedgerVisibleSections((prev) => ({ ...prev, taxes: !prev.taxes }))}
                                            >
                                                세금
                                            </ToggleChipButton>
                                        </ToggleChipGroup>
                                    </FieldCard>
                                ) : (
                                    <FieldCard>
                                        <FieldLabel>표시 옵션</FieldLabel>
                                        <ActionCluster>
                                            <ModernSwitch compact label="계좌 컬럼 표시" checked={showAccountColumns} onChange={setShowAccountColumns} />
                                            <ModernSwitch compact label="계산노무 표시" checked={showCalculationLabor} onChange={setShowCalculationLabor} />
                                        </ActionCluster>
                                    </FieldCard>
                                )}
                            </ToolbarCardBody>
                        </ToolbarCard>

                        <ToolbarCard $span={5}>
                            <ToolbarCardHeader>
                                <div>
                                    <ToolbarCardTitle>정산 규칙 토글</ToolbarCardTitle>
                                    <ToolbarCardDescription>보험, 사업소득, 공과금, 일급제 수수료 적용 상태를 카드형 스위치로 즉시 제어합니다.</ToolbarCardDescription>
                                </div>
                            </ToolbarCardHeader>
                            <ToolbarCardBody>
                                <ActionCluster>
                                    <ModernSwitch
                                        label="4대보험 적용"
                                        checked={insuranceApplied}
                                        compact
                                        onChange={(value: boolean) => applyCalculatedDeductions({
                                            applyInsurance: value,
                                            applyBusinessIncome: businessIncomeApplied,
                                            applyUtilities: utilitiesApplied,
                                            applyDailyFee: dailyFeeApplied,
                                            applyInsuranceTeamSiteOnly: insuranceTeamSiteOnly,
                                        })}
                                    />
                                    <ModernSwitch
                                        label="해당팀 4대보험"
                                        checked={insuranceTeamSiteOnly}
                                        compact
                                        onChange={(value: boolean) => applyCalculatedDeductions({
                                            applyInsurance: insuranceApplied,
                                            applyBusinessIncome: businessIncomeApplied,
                                            applyUtilities: utilitiesApplied,
                                            applyDailyFee: dailyFeeApplied,
                                            applyInsuranceTeamSiteOnly: value,
                                        })}
                                    />
                                    <ModernSwitch
                                        label="사업소득 적용"
                                        checked={businessIncomeApplied}
                                        compact
                                        onChange={(value: boolean) => applyCalculatedDeductions({
                                            applyInsurance: insuranceApplied,
                                            applyBusinessIncome: value,
                                            applyUtilities: utilitiesApplied,
                                            applyDailyFee: dailyFeeApplied,
                                            applyInsuranceTeamSiteOnly: insuranceTeamSiteOnly,
                                        })}
                                    />
                                    <ModernSwitch
                                        label="공과금 적용"
                                        checked={utilitiesApplied}
                                        compact
                                        onChange={(value: boolean) => applyCalculatedDeductions({
                                            applyInsurance: insuranceApplied,
                                            applyBusinessIncome: businessIncomeApplied,
                                            applyUtilities: value,
                                            applyDailyFee: dailyFeeApplied,
                                            applyInsuranceTeamSiteOnly: insuranceTeamSiteOnly,
                                        })}
                                    />
                                    <ModernSwitch
                                        label="수수료 적용"
                                        checked={dailyFeeApplied}
                                        compact
                                        onChange={(value: boolean) => applyCalculatedDeductions({
                                            applyInsurance: insuranceApplied,
                                            applyBusinessIncome: businessIncomeApplied,
                                            applyUtilities: utilitiesApplied,
                                            applyDailyFee: value,
                                            applyInsuranceTeamSiteOnly: insuranceTeamSiteOnly,
                                        })}
                                    />
                                </ActionCluster>

                                {(insuranceApplied || businessIncomeApplied || utilitiesApplied || dailyFeeApplied) && (
                                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-700 space-y-1.5">
                                        <div className="font-bold text-slate-800">현재 적용되는 로직</div>

                                        {insuranceApplied && (
                                            <div>
                                                <span className="font-semibold text-slate-800">4대보험</span>
                                                {' '}
                                                노무 공수를 현장+발주사 그룹으로 합산해
                                                {' '}
                                                <span className="font-semibold">{insuranceThresholdDays}공수 이상</span>
                                                {' '}
                                                그룹에 국민연금/건강보험/장기요양을 적용합니다.
                                            </div>
                                        )}

                                        {insuranceApplied && (
                                            <div>
                                                <span className="font-semibold text-slate-800">갑근세/지방세</span>
                                                {' '}
                                                {withholdingApplyAllLaborView
                                                    ? '노무 전체 공수 대상'
                                                    : `노무 ${WITHHOLDING_MAX_MAN_DAY}공수 이하 대상`}
                                                {' '}
                                                · 계산식: ((단가 - {withholdingBaseDeductionWonView.toLocaleString()}원) x 노무공수 x {withholdingIncomeRatePercentView}%) x (1 - {withholdingTaxCreditPercentView}%)
                                                {' '}
                                                / 지방세 {withholdingResidentRatePercentView}%
                                            </div>
                                        )}

                                        {insuranceApplied && (
                                            <div>
                                                <span className="font-semibold text-slate-800">고용보험</span>
                                                {' '}
                                                기준 충족 그룹 + 갑근세 대상 그룹에 적용되며,
                                                {' '}
                                                공수미달 자동적용 설정은
                                                {' '}
                                                <span className="font-semibold">{employmentApplyBelowThresholdView ? 'ON' : 'OFF'}</span>
                                                입니다.
                                            </div>
                                        )}

                                        {insuranceApplied && insuranceTeamSiteOnly && (
                                            <div>
                                                <span className="font-semibold text-slate-800">팀 매칭 제한</span>
                                                {' '}
                                                작업자 팀과 현장 담당팀이 매칭되는 근무내역만 4대보험 판정에 포함합니다.
                                                {' '}
                                                해당 현장에서 4대보험 기준 미달이거나 팀 매칭에서 제외된 나머지 노무현장은
                                                {' '}
                                                {withholdingApplyAllLaborView
                                                    ? '갑근세/지방세 노무 전체 공수 대상으로 분류됩니다.'
                                                    : `갑근세/지방세 노무 ${WITHHOLDING_MAX_MAN_DAY}공수 이하 대상으로 분류됩니다.`}
                                            </div>
                                        )}

                                        {businessIncomeApplied && (
                                            <div>
                                                <span className="font-semibold text-slate-800">사업소득</span>
                                                {' '}
                                                4대보험/갑근세 대상에서 제외된 금액에 3.0% + 0.3%를 적용합니다.
                                            </div>
                                        )}

                                        {utilitiesApplied && (
                                            <div>
                                                <span className="font-semibold text-slate-800">공과금</span>
                                                {' '}
                                                가불대장 공과금 입력(숙소비/전기료/가스비/수도세/인터넷/관리비/과태료/기타)을 공제내역에 반영합니다.
                                            </div>
                                        )}

                                        {dailyFeeApplied && (
                                            <div>
                                                <span className="font-semibold text-slate-800">일급제 수수료</span>
                                                {' '}
                                                일급제 작업자에게 공수 x {dailyWorkerFeePerManDayView.toLocaleString()}원(공수당) 수수료를 공제합니다.
                                            </div>
                                        )}

                                        {(insuranceApplied && businessIncomeApplied) || (insuranceApplied && utilitiesApplied) || (insuranceApplied && dailyFeeApplied) || (businessIncomeApplied && utilitiesApplied) || (businessIncomeApplied && dailyFeeApplied) || (utilitiesApplied && dailyFeeApplied) ? (
                                            <div className="rounded-md border border-slate-200 bg-white px-2 py-1.5 space-y-1">
                                                <div className="font-semibold text-slate-800">겹침 적용 로직</div>
                                                {insuranceApplied && businessIncomeApplied && (
                                                    <div>4대보험/갑근세가 먼저 대상을 확정하고, 사업소득은 그 제외 금액에만 계산됩니다.</div>
                                                )}
                                                {insuranceApplied && utilitiesApplied && (
                                                    <div>세금 계산 결과(4대보험/갑근세/지방세)에 공과금 공제가 추가 합산됩니다.</div>
                                                )}
                                                {businessIncomeApplied && utilitiesApplied && (
                                                    <div>사업소득 3.3% 세금과 공과금 공제가 함께 총 공제액에 합산됩니다.</div>
                                                )}
                                                {dailyFeeApplied && (
                                                    <div>일급제 수수료는 공과금/세금과 함께 총 공제액에 합산됩니다.</div>
                                                )}
                                                {(insuranceApplied || businessIncomeApplied || utilitiesApplied || dailyFeeApplied) && (
                                                    <div className="font-medium text-slate-800">최종 실지급 = 세전금액 - (보험/세금 + 사업소득세 + 공과금 + 일급제 수수료)</div>
                                                )}
                                            </div>
                                        ) : null}
                                    </div>
                                )}

                                <ActionCluster>
                                    <ActionButton type="button" $variant="outline" onClick={openInsuranceSettings}>
                                        <FontAwesomeIcon icon={faSave} />
                                        요율 설정
                                    </ActionButton>
                                </ActionCluster>
                            </ToolbarCardBody>
                        </ToolbarCard>

                        <ToolbarCard $span={7}>
                            <ToolbarCardHeader>
                                <div>
                                    <ToolbarCardTitle>조회 및 문서 액션</ToolbarCardTitle>
                                    <ToolbarCardDescription>조회, 은행용 미리보기, 명세서, 일괄 다운로드를 작업 흐름에 맞게 정렬했습니다.</ToolbarCardDescription>
                                </div>
                                <ToolbarBadge>{totalLoadCount}건 로드됨</ToolbarBadge>
                            </ToolbarCardHeader>
                            <ToolbarCardBody>
                                <ActionCluster>
                                    <ActionButton type="button" $variant="secondary" onClick={fetchData}>
                                        <FontAwesomeIcon icon={faSearch} />
                                        조회
                                    </ActionButton>
                                    <ActionButton type="button" $variant="warning" onClick={() => setShowKBPreview(true)} disabled={isPaymentDataEmpty}>
                                        <FontAwesomeIcon icon={faFileExcel} />
                                        국민은행
                                    </ActionButton>
                                    <ActionButton
                                        type="button"
                                        $variant="accent"
                                        onClick={openPayslipPreview}
                                        disabled={isPaymentDataEmpty}
                                    >
                                        <FontAwesomeIcon icon={faDownload} />
                                        명세서
                                    </ActionButton>
                                    <ActionButton
                                        type="button"
                                        $variant="success"
                                        onClick={handleBatchDownload}
                                        disabled={isPaymentDataEmpty || batchDownloading}
                                    >
                                        {batchDownloading ? (
                                            <FontAwesomeIcon icon={faSpinner} spin />
                                        ) : (
                                            <FontAwesomeIcon icon={faFileZipper} />
                                        )}
                                        {batchDownloading ? '처리 중...' : '일괄 다운로드'}
                                    </ActionButton>
                                    <ActionButton
                                        type="button"
                                        $variant="secondary"
                                        onClick={() => advanceLedgerRef.current?.downloadExcel(rangeLabel || currentYearMonth)}
                                        disabled={isLedgerRowsDataEmpty}
                                    >
                                        <FontAwesomeIcon icon={faFileExcel} />
                                        가불대장 엑셀
                                    </ActionButton>
                                </ActionCluster>
                            </ToolbarCardBody>
                        </ToolbarCard>
                    </ToolbarGrid>
                )}
            </ToolbarContainer>
        </>
    );
};
