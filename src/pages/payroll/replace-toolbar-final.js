const fs = require('fs');
const path = 'c:/Users/playz/cy/src/pages/payroll/MonthlyWageDraftPage.tsx';
let content = fs.readFileSync(path, 'utf8');
let lines = content.split('\n');

const hLine = lines.findIndex(l => l.includes('{!hideHeader && ('));
const tLine = lines.findIndex(l => l.includes('</ToolbarContainer>'));

if (hLine !== -1 && tLine !== -1) {
    const newToolbar = `
    const handleSelectPrevMonth = useCallback(() => {
        const prevMonth = format(subMonths(new Date(), 1), 'yyyy-MM');
        setMonthSelectionMode('single');
        setYearCursor(prevMonth);
        setStartMonth(prevMonth);
        setEndMonth(prevMonth);
    }, []);

    const handleSelectCurrentMonth = useCallback(() => {
        const currMonth = format(new Date(), 'yyyy-MM');
        setMonthSelectionMode('single');
        setYearCursor(currMonth);
        setStartMonth(currMonth);
        setEndMonth(currMonth);
    }, []);

    const handleMonthButtonSelect = useCallback((ym: string) => {
        if (monthSelectionMode === 'single') {
            setStartMonth(ym);
            setEndMonth(ym);
        } else {
            if (!rangeAnchorMonth) {
                setRangeAnchorMonth(ym);
                setStartMonth(ym);
                setEndMonth(ym);
            } else {
                if (ym < rangeAnchorMonth) {
                    setStartMonth(ym);
                    setEndMonth(rangeAnchorMonth);
                } else {
                    setStartMonth(rangeAnchorMonth);
                    setEndMonth(ym);
                }
                setRangeAnchorMonth(null);
            }
        }
    }, [monthSelectionMode, rangeAnchorMonth]);

    const currentYearMonth = format(new Date(), 'yyyy-MM');

            {!hideHeader && (
                <PayrollToolbar
                    hideHeader={hideHeader}
                    rangeLabel={rangeLabel}
                    targetCount={paymentData.length + ledgerRowsData.filter(r => r.salaryModel === '일급제').length}
                    monthRangeLength={monthRangeLength}
                    totalLoadCount={paymentRowsCount}
                    monthSelectionMode={monthSelectionMode}
                    handleMonthModeChange={handleMonthModeChange}
                    yearCursor={yearCursor}
                    setYearCursor={setYearCursor}
                    shiftYearMonth={shiftYearMonth}
                    formatYearMonthParts={formatYearMonthParts}
                    handleSelectPrevMonth={handleSelectPrevMonth}
                    handleSelectCurrentMonth={handleSelectCurrentMonth}
                    monthRangeSet={monthRangeSet}
                    startMonth={startMonth}
                    endMonth={endMonth}
                    rangeAnchorMonth={rangeAnchorMonth}
                    handleMonthButtonSelect={handleMonthButtonSelect}
                    teamDropdownRef={teamDropdownRef}
                    teamDropdownOpen={teamDropdownOpen}
                    setTeamDropdownOpen={setTeamDropdownOpen}
                    selectedTeamLabel={selectedTeamLabel}
                    selectedTeamId={selectedTeamId}
                    setSelectedTeamId={setSelectedTeamId}
                    teams={teams}
                    filterMode={filterMode}
                    setFilterMode={setFilterMode}
                    selectedWorkerId={selectedWorkerId}
                    setSelectedWorkerId={setSelectedWorkerId}
                    workerOptions={workerOptions}
                    workerSearchText={workerSearchText}
                    setWorkerSearchText={setWorkerSearchText}
                    pageViewMode={pageViewMode}
                    setPageViewMode={setPageViewMode}
                    ledgerVisibleSections={ledgerVisibleSections}
                    setLedgerVisibleSections={setLedgerVisibleSections}
                    showAccountColumns={showAccountColumns}
                    setShowAccountColumns={setShowAccountColumns}
                    showCalculationLabor={showCalculationLabor}
                    setShowCalculationLabor={setShowCalculationLabor}
                    insuranceApplied={insuranceApplied}
                    insuranceTeamSiteOnly={insuranceTeamSiteOnly}
                    businessIncomeApplied={businessIncomeApplied}
                    utilitiesApplied={utilitiesApplied}
                    dailyFeeApplied={dailyFeeApplied}
                    applyCalculatedDeductions={applyCalculatedDeductions}
                    insuranceThresholdDays={insuranceThresholdDays}
                    withholdingApplyAllLaborView={withholdingApplyAllLaborView}
                    WITHHOLDING_MAX_MAN_DAY={WITHHOLDING_MAX_MAN_DAY}
                    withholdingBaseDeductionWonView={withholdingBaseDeductionWonView}
                    withholdingIncomeRatePercentView={withholdingIncomeRatePercentView}
                    withholdingTaxCreditPercentView={withholdingTaxCreditPercentView}
                    withholdingResidentRatePercentView={withholdingResidentRatePercentView}
                    employmentApplyBelowThresholdView={employmentApplyBelowThresholdView}
                    dailyWorkerFeePerManDayView={dailyWorkerFeePerManDayView}
                    fetchData={fetchData}
                    toolbarExpanded={toolbarExpanded}
                    setToolbarExpanded={setToolbarExpanded}
                    openInsuranceSettings={openInsuranceSettings}
                    setShowKBPreview={setShowKBPreview}
                    isPaymentDataEmpty={paymentData.length === 0}
                    openPayslipPreview={openPayslipPreview}
                    handleBatchDownload={handleBatchDownload}
                    batchDownloading={batchDownloading}
                    advanceLedgerRef={advanceLedgerRef}
                    isLedgerRowsDataEmpty={ledgerRowsData.length === 0}
                    currentYearMonth={currentYearMonth}
                />
            )}`;

    lines.splice(hLine, tLine - hLine + 1, newToolbar);
    
    // Check if PayrollToolbar is already imported
    const hasImport = lines.some(l => l.includes('PayrollToolbar'));
    if (!hasImport) {
        lines.splice(1, 0, "import { PayrollToolbar } from './components/PayrollToolbar';");
    }
    
    fs.writeFileSync(path, lines.join('\n'));
    console.log('Success: Replaced lines ' + hLine + ' to ' + tLine);
} else {
    console.log('Failed: Could not find markers. hLine=' + hLine + ', tLine=' + tLine);
}
