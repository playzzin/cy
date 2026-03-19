const fs = require('fs');
const path = 'c:/Users/playz/cy/src/pages/payroll/MonthlyWageDraftPage.tsx';
let content = fs.readFileSync(path, 'utf8');

try {
    // 1. Remove styled components and replace with imports
    const startStyleStr = '// --- Premium UI Styled Components ---';
    const endStyleStr = 'const buildStandardDeductionLabelMap';

    const startStyleIdx = content.indexOf(startStyleStr);
    const endStyleIdx = content.indexOf(endStyleStr);

    if (startStyleIdx !== -1 && endStyleIdx !== -1) {
        const newImports = `import { PayrollToolbar } from './components/PayrollToolbar';
import {
    KBPreviewOverlay, KBPreviewDialog, KBPreviewHeader, KBPreviewTitleRow,
    KBPreviewTitleBlock, KBPreviewEyebrow, KBPreviewTitle, KBPreviewDescription,
    KBPreviewCloseButton, KBPreviewControlsGrid, KBPreviewFieldCard, KBPreviewFieldLabel,
    KBPreviewFieldHint, KBPreviewInput, KBPreviewSelect, KBPreviewTableArea,
    KBPreviewTable, KBPreviewFooter, KBPreviewSummary, TableContainer,
    StyledTable, Th, Td, TableRow
} from './styles/MonthlyWageDraft.styles';

`;
        content = content.substring(0, startStyleIdx) + newImports + content.substring(endStyleIdx);
    } else {
        throw new Error("Could not find styled components range");
    }

    // 2. Insert inline functions right before "return ("
    const returnMarker = '    return (\n        <div className="relative h-full flex flex-col p-2 w-full overflow-hidden">';
    const newFunctionsAndReturn = `
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

${returnMarker}`;

    if (content.indexOf(returnMarker) !== -1) {
        content = content.replace(returnMarker, newFunctionsAndReturn);
    } else {
        throw new Error("Could not find return marker");
    }

    // 3. Replace the Toolbar rendering with PayrollToolbar component
    const tsIdx = content.indexOf('{!hideHeader && (');
    const endStr = '</ToolbarContainer>';
    const teIdx = content.indexOf(endStr, tsIdx);

    if (tsIdx !== -1 && teIdx !== -1) {
        // Find the beginning of the line for tsIdx
        const lineStartIdx = content.lastIndexOf('\\n', tsIdx) + 1;
        
        // Find the end of the line for teIdx
        const endLineEndIdx = content.indexOf('\\n', teIdx + endStr.length);
        const actualEndIdx = endLineEndIdx !== -1 ? endLineEndIdx : teIdx + endStr.length;

        const newToolbar = `            {!hideHeader && (
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
        content = content.substring(0, lineStartIdx) + newToolbar + content.substring(actualEndIdx);
    } else {
        throw new Error("Could not find toolbar bounds. tsIdx: " + tsIdx + " teIdx: " + teIdx);
    }

    fs.writeFileSync(path, content);
    console.log('Update Complete!');

} catch (e) {
    console.error(e.message);
}
