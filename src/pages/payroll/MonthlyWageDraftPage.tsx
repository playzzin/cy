import { calculateWorkEntryTaxBreakdown, BUSINESS_INCOME_TAX_RATE, BUSINESS_RESIDENT_TAX_RATE } from './utils/workEntryTax';
import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { manpowerService, Worker } from '../../services/manpowerService';
import { teamService, Team } from '../../services/teamService';
import { companyService, Company } from '../../services/companyService';
import { siteService, Site } from '../../services/siteService';
import { usePagePrimaryAccount, ensurePagePrimaryAccountReady } from '../../hooks/usePagePrimaryAccount';
import PagePrimaryAccountCard from '../../components/accounts/PagePrimaryAccountCard';
import { statementOutputService } from '../../services/statementOutputService';
import type { StatementOutputRecord } from '../../types/statementOutput';
import { useAuth } from '../../contexts/AuthContext';
import { buildPayrollPreviewCandidates } from '../../features/bank-transfer/payrollTransferSource';
import { buildPayrollTransferDetail } from '../../features/bank-transfer/payrollTransferDetail';
import { storeTransferHandoff } from '../../features/bank-transfer/transferHandoff';
import type { TransferLoadResult } from '../../features/bank-transfer/types';
import { PayrollReviewCenter } from './components/PayrollReviewCenter';
import { reviewPayroll, reviewTransferTotals, type PayrollReviewRow } from './utils/payrollReview';
import { resolveKBSalaryFilterFromPaymentId } from './utils/kbTransferExport';
import { isFinalizedMonthlyPayrollRun, monthlyPayrollSettlementService, type MonthlyPayrollSavedManualInput, type MonthlyPayrollSettlement, type MonthlyPayrollSettlementSaveInput, type MonthlyPayrollRunStatus } from '../../services/monthlyPayrollSettlementService';
import { payrollConfigService, PayrollConfig, PayrollInsuranceConfig, DEFAULT_ADVANCE_ITEM_LABELS } from '../../services/payrollConfigService';
import * as XLSX from 'xlsx-js-style';
import html2canvas from 'html2canvas';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileExcel, faFilePdf, faSpinner, faExclamationTriangle, faCopy, faChevronUp, faChevronDown, faCheckCircle } from '@fortawesome/free-solid-svg-icons';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import { PayslipTemplate } from './components/PayslipTemplate';
import MonthlyAdvanceLedger from './components/MonthlyAdvanceLedger';
import { SimplePayrollClosingTable, type SimplePayrollClosingRow } from './components/SimplePayrollClosingTable';
import type { MonthlyAdvanceLedgerComputedAmount, MonthlyAdvanceLedgerHandle } from './components/MonthlyAdvanceLedger';
import { PayrollToolbar } from './components/SimplePayrollToolbar';
import './styles/MonthlyWageResponsive.css';
import { appendPayslipWorkbooksToZip, buildPayslipWorkbook, getPayslipWorkbookFileName } from './utils/payslipWorkbook';
import { filterKBPaymentRows, formatKBTransferMemo, getKBAmountTypeLabel, getKBSalaryModelFilterLabel, getKBValidationErrorLabel, summarizeKBTransferRows, validateKBTransferRow, type KBAmountType, type KBSalaryModelFilter } from './utils/kbTransferExport';
import { PAYSLIP_ISSUE_RULE_VERSION, buildMonthlyPayslipSnapshot, getPayslipIssueLabel, validateMonthlyPayslipRows, type PayslipIssueSummary } from './utils/payslipIssue';
import { filterRowsByWorkerName } from './utils/workerNameSearch';
import { calculatePayslipPrintScale } from './utils/payslipPrintLayout';
import { makePayrollCalculationOptionsSignature, resolveSavedPayrollCalculationOptions } from './utils/payrollCalculationOptions';
import { filterPayslipRowsBySalaryModel, resolvePayslipCalculationPolicy, resolvePayslipSalaryModel, type PayslipSalaryModelFilter } from './utils/payslipSalaryModel';
import { normalizePayrollBankKey, resolvePayrollBankCode } from './utils/payrollBankCode';
import { usePayrollData } from './hooks/usePayrollData';
import { PaymentData, MonthlyAdvanceLedgerRow, MonthlyAdvanceLedgerWorkEntry, LedgerManualInput, DeductionBreakdown, WorkerWorkEntry, DeductionLine, LedgerUtilityInputLike, InsuranceAppliedSiteSummary, WithholdingAppliedSiteSummary, BusinessIncomeAppliedSiteSummary } from './types/payroll';
import { isLedgerManualInputUnchanged, resolveInitialLedgerManualInput } from './utils/advanceLedgerInput';
import { BANK_CODES, WITHHOLDING_MAX_MAN_DAY } from './constants/payroll.constants';
import { ActionButton, ActionCluster, FieldCard, FieldLabel, KBPreviewCloseButton, KBPreviewControlsGrid, KBPreviewDescription, KBPreviewPanel, KBPreviewFieldCard, KBPreviewFieldLabel, KBPreviewFieldHint, KBPreviewFooter, KBPreviewHeader, KBPreviewInput, KBPreviewSelect, KBPreviewSummary, KBPreviewTable, KBPreviewTableArea, KBPreviewTitle, KBPreviewTitleBlock, KBPreviewTitleRow, MonthButton, MonthGrid, QuickRangeButton, QuickRangeGroup, SearchField, SegmentedButton, SegmentedGroup, SelectField, ToggleChipButton, ToggleChipGroup, ToolbarBadge, ToolbarCard, ToolbarCardBody, ToolbarCardDescription, ToolbarCardHeader, ToolbarCardTitle, ToolbarContainer, ToolbarGrid, ToolbarInline, ToolbarLead, ToolbarLeadMeta, ToolbarSectionDivider, YearButton, YearNavigator, YearText } from './MonthlyWageStyles';
import { CUSTOM_PAYSLIP_CONTRACTOR_VALUE, DEFAULT_PAYSLIP_CONTRACTOR_NAME, DEFAULT_PAYSLIP_CONTRACTOR_OPTIONS, buildAdvanceLabelSet, buildDailyFeeDeductionLines, buildDeductionBreakdownFromRecords, buildDeductionLabelMapFromConfig, buildStandardDeductionLabelMap, buildUtilityDeductionLines, buildVisibleUtilityDeductionLines, buildWorkEntriesForLedgerRow, createEmptyDeductionBreakdown, ensureAdvanceLinesInBreakdown, extractLedgerTaxAmountsFromItem, floorWon, formatKBPrimaryAccountLabel, getTaxLinesForItem, isAppliedUtilityOrFeeLabel, isBusinessSectionTaxLabel, isInsuranceSectionTaxLabel, isWithholdingSectionTaxLabel, mergeDeductionBreakdownWithLines, normalizeLineLabel, rebuildDeductionBreakdown, resolveTaxLineRateText, resolveWithholdingDetailText, stripTemporaryDeductionLines, stripTemporaryTaxLines, sumBusinessSectionTax, sumInsuranceSectionTax, sumWithholdingSectionTax, toNumber } from './MonthlyWageModel';
import type { KBExcludedTransferRow, KBPreviewSnapshot, KBPreviewSourceRow, KBTransferRow } from './MonthlyWageModel';
export * from './MonthlyWageStyles';
export * from './MonthlyWageModel';

void [
    ToolbarContainer,
    ToolbarLead,
    ToolbarLeadMeta,
    ToolbarBadge,
    ToolbarGrid,
    ToolbarCard,
    ToolbarCardHeader,
    ToolbarCardTitle,
    ToolbarCardDescription,
    ToolbarCardBody,
    ToolbarInline,
    ToolbarSectionDivider,
    YearNavigator,
    YearButton,
    YearText,
    MonthGrid,
    MonthButton,
    QuickRangeGroup,
    QuickRangeButton,
    SegmentedGroup,
    SegmentedButton,
    SelectField,
    SearchField,
    FieldCard,
    FieldLabel,
    ToggleChipGroup,
    ToggleChipButton,
];

interface Props {
    hideHeader?: boolean;
    transferPicker?: {
        period: string;
        onLoad: (result: TransferLoadResult) => void;
        onInvalidate: () => void;
        batchJob?: { teamId: string; salaryFilter: KBSalaryModelFilter; amountType: KBAmountType };
        onError?: (message: string) => void;
    };
}

const MonthlyWagePaymentPage: React.FC<Props> = ({ hideHeader, transferPicker }) => {
    const transferPickerMode = Boolean(transferPicker);
    const { currentUser } = useAuth();
    const [startMonth, setStartMonth] = useState<string>(transferPicker?.period ?? new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [endMonth, setEndMonth] = useState<string>(transferPicker?.period ?? new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [yearCursor, setYearCursor] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [monthSelectionMode, setMonthSelectionMode] = useState<'single' | 'range'>('single');
    const [rangeAnchorMonth, setRangeAnchorMonth] = useState<string>('');
    const [selectedTeamId, setSelectedTeamId] = useState<string>(transferPicker?.batchJob?.teamId ?? '');
    const [teamDropdownOpen, setTeamDropdownOpen] = useState<boolean>(false);
    const [selectedWorkerId, setSelectedWorkerId] = useState<string>('');
    
    // usePayrollData 훅 통합
    const { 
        loading, 
        loadError,
        paymentData, 
        basePaymentData,
        setPaymentData,
        ledgerRowsData, 
        errorCount, 
        refetch: refetchPayrollData
    } = usePayrollData(startMonth, endMonth, { 
        selectedTeamId: selectedTeamId || undefined, 
        selectedWorkerId: selectedWorkerId || undefined 
    });

    const [bulkDisplayContent, setBulkDisplayContent] = useState<string>('월급');
    const [showKBPreview, setShowKBPreview] = useState<boolean>(false); // 국민은행용 미리보기
    const kbPreviewTitleRef = useRef<HTMLHeadingElement>(null);
    useEffect(() => {
        if (!showKBPreview) return;
        const previousFocus = document.activeElement as HTMLElement | null;
        kbPreviewTitleRef.current?.focus({ preventScroll: true });
        return () => {
            requestAnimationFrame(() => {
                if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
            });
        };
    }, [showKBPreview]);
    const [showPayslipModal, setShowPayslipModal] = useState<boolean>(false);
    const [selectedPayslipRowKey, setSelectedPayslipRowKey] = useState<string>(''); // 
    const [payslipSalaryModelFilter, setPayslipSalaryModelFilter] = useState<PayslipSalaryModelFilter>('all');
    const [payslipContractorOption, setPayslipContractorOption] = useState<string>(DEFAULT_PAYSLIP_CONTRACTOR_NAME);
    const [customPayslipContractorName, setCustomPayslipContractorName] = useState<string>('');
    const [showBankCodes, setShowBankCodes] = useState<boolean>(false); // 은행코드표
    const [showAccountColumns, setShowAccountColumns] = useState<boolean>(false);
    const [teams, setTeams] = useState<Team[]>([]);
    const [allTeams, setAllTeams] = useState<Team[]>([]);
    const [allWorkers, setAllWorkers] = useState<Worker[]>([]);
    const [allSites, setAllSites] = useState<Site[]>([]);
    const [showCalculationLabor, setShowCalculationLabor] = useState<boolean>(false);
    const [companies, setCompanies] = useState<Company[]>([]);
    const pagePrimaryAccount = usePagePrimaryAccount('monthly-wage');
    const primaryAccount = pagePrimaryAccount.account;
    const [workerSearchText, setWorkerSearchText] = useState<string>('');
    const [filterMode, setFilterMode] = useState<'team' | 'worker'>('team');
    const [pageViewMode, setPageViewMode] = useState<'simple' | 'standard' | 'ledger'>('ledger');
    const [ledgerSalaryModelFilter, setLedgerSalaryModelFilter] = useState<KBSalaryModelFilter>(transferPicker?.batchJob?.salaryFilter ?? 'all');
    const [toolbarExpanded, setToolbarExpanded] = useState<boolean>(false);
    const [ledgerVisibleSections, setLedgerVisibleSections] = useState({
        utilities: false,
        advances: true,
        taxes: false,
    });

    const [filtersReady, setFiltersReady] = useState<boolean>(false);
    const [filtersLoadError, setFiltersLoadError] = useState<string>('');
    const [, setDeductionLabelMap] = useState<Record<string, string>>(buildStandardDeductionLabelMap());
    const [payrollConfig, setPayrollConfig] = useState<PayrollConfig | null>(null);
    const [payrollConfigLoadError, setPayrollConfigLoadError] = useState<string | null>(null);
    const [payrollConfigLoading, setPayrollConfigLoading] = useState(true);
    const advanceLabelSet = useMemo(() => buildAdvanceLabelSet(payrollConfig), [payrollConfig]);
    const [showInsuranceSettings, setShowInsuranceSettings] = useState<boolean>(false);
    const [insuranceConfigSaving, setInsuranceConfigSaving] = useState<boolean>(false);
    const insuranceDialogRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!showInsuranceSettings) return;
        const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        insuranceDialogRef.current?.focus({ preventScroll: true });
        return () => previousFocus?.focus({ preventScroll: true });
    }, [showInsuranceSettings]);

    const [insuranceThresholdManDayInput, setInsuranceThresholdManDayInput] = useState<string>('');
    const [pensionRatePercentInput, setPensionRatePercentInput] = useState<string>('');
    const [healthRatePercentInput, setHealthRatePercentInput] = useState<string>('');
    const [careRateOfHealthPercentInput, setCareRateOfHealthPercentInput] = useState<string>('');
    const [employmentRatePercentInput, setEmploymentRatePercentInput] = useState<string>('');
    const [dailyWorkerFeePerManDayInput, setDailyWorkerFeePerManDayInput] = useState<string>('');
    const [incomeTaxRatePercentInput, setIncomeTaxRatePercentInput] = useState<string>('');
    const [residentTaxRatePercentInput, setResidentTaxRatePercentInput] = useState<string>('');
    const [withholdingBaseDeductionInput, setWithholdingBaseDeductionInput] = useState<string>('');
    const [withholdingIncomeBaseMultiplierPercentInput, setWithholdingIncomeBaseMultiplierPercentInput] = useState<string>('');
    const [withholdingApplyAllLaborInput, setWithholdingApplyAllLaborInput] = useState<boolean>(true);
    const [employmentApplyBelowThresholdInput, setEmploymentApplyBelowThresholdInput] = useState<boolean>(true);

    const [deductionApplyInProgress, setDeductionApplyInProgress] = useState(false);
    const [deductionApplyError, setDeductionApplyError] = useState('');
    const [completedCalculationSequence, setCompletedCalculationSequence] = useState(0);

    const [insuranceApplied, setInsuranceApplied] = useState<boolean>(false);
    const [insuranceTeamSiteOnly, setInsuranceTeamSiteOnly] = useState<boolean>(false);
    const [businessIncomeApplied, setBusinessIncomeApplied] = useState<boolean>(false);
    const [utilitiesApplied, setUtilitiesApplied] = useState<boolean>(true);
    const [dailyFeeApplied, setDailyFeeApplied] = useState<boolean>(false);
    const [copying, setCopying] = useState(false);
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const [ledgerInputs, setLedgerInputs] = useState<Record<string, LedgerManualInput>>({});
    const [ledgerComputedAmounts, setLedgerComputedAmounts] = useState<MonthlyAdvanceLedgerComputedAmount[]>([]);
    const [savedPayrollSettlements, setSavedPayrollSettlements] = useState<MonthlyPayrollSettlement[]>([]);
    const [payrollSettlementSaving, setPayrollSettlementSaving] = useState<boolean>(false);
    const [payrollSettlementLoading, setPayrollSettlementLoading] = useState<boolean>(false);
    const [payrollSettlementLoadError, setPayrollSettlementLoadError] = useState<string | null>(null);
    const [payrollReloadKey, setPayrollReloadKey] = useState(0);
    const fetchData = useCallback(() => {
        setPayrollReloadKey(previous => previous + 1);
        void refetchPayrollData();
    }, [refetchPayrollData]);
    const [payrollSettlementFeedback, setPayrollSettlementFeedback] = useState<string>('');
    const payrollDataBlocked = loading || Boolean(loadError) || payrollSettlementLoading
        || Boolean(payrollSettlementLoadError) || payrollConfigLoading || Boolean(payrollConfigLoadError) || !payrollConfig || deductionApplyInProgress
        || (transferPickerMode && (!filtersReady || Boolean(filtersLoadError)));
    const ensurePayrollReady = useCallback(() => {
        if (!payrollDataBlocked) return true;
        alert(loadError || payrollSettlementLoadError || payrollConfigLoadError || filtersLoadError || '급여 조회와 계산이 완료된 뒤 다시 시도해 주세요.');
        return false;
    }, [filtersLoadError, loadError, payrollConfigLoadError, payrollDataBlocked, payrollSettlementLoadError]);
    const advanceLedgerRef = useRef<MonthlyAdvanceLedgerHandle>(null);
    const [kbReceiverDisplay, setKbReceiverDisplay] = useState<string>('㈜다원');
    const [kbMemoSuffix, setKbMemoSuffix] = useState<string>('{이름} 가불');
    const [kbAmountType, setKbAmountType] = useState<KBAmountType>(transferPicker?.batchJob?.amountType ?? 'totalAmount');
    const [transferBatch, setTransferBatch] = useState<{ id: number; teams: Array<{ id: string; name: string }>; warnings: string[] } | null>(null);
    const [transferBatchError, setTransferBatchError] = useState('');
    const transferBatchSequence = useRef(0);
    const [kbPreviewSnapshot, setKbPreviewSnapshot] = useState<KBPreviewSnapshot | null>(null);
    const [kbTransferError, setKbTransferError] = useState<string>('');
    const transferInvalidateRef = useRef(transferPicker?.onInvalidate);
    transferInvalidateRef.current = transferPicker?.onInvalidate;
    useEffect(() => {
        if (!transferPickerMode) return;
        transferBatchSequence.current += 1;
        setTransferBatch(null);
        setTransferBatchError('');
        transferInvalidateRef.current?.();
    }, [transferPickerMode, startMonth, endMonth, selectedTeamId, ledgerSalaryModelFilter, kbAmountType,
        insuranceApplied, insuranceTeamSiteOnly, businessIncomeApplied, utilitiesApplied, dailyFeeApplied, payrollReloadKey]);
    const [kbSelectedTransferRowIds, setKbSelectedTransferRowIds] = useState<Set<string>>(new Set());
    const [kbPrimaryAccountAppliedRowIds, setKbPrimaryAccountAppliedRowIds] = useState<Set<string>>(new Set());
    const [payslipOutputIds, setPayslipOutputIds] = useState<Record<string, string>>({});
    const [issuingPayslip, setIssuingPayslip] = useState<boolean>(false);
    const [payslipIssueMessage, setPayslipIssueMessage] = useState<string>('');
    const [payslipExportNotice, setPayslipExportNotice] = useState<string>('');
    const applyRunSeqRef = React.useRef(0);
    const applyWatchdogRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const restoredCalculationOptionsRef = React.useRef<string>('');
    useEffect(() => {
        if (!loading && !loadError && !payrollSettlementLoading && !payrollSettlementLoadError) return;
        setShowKBPreview(false);
        setKbPreviewSnapshot(null);
        setShowPayslipModal(false);
    }, [loading, loadError, payrollSettlementLoading, payrollSettlementLoadError]);

    const companyNameById = useMemo<Record<string, string>>(() => {
        const map: Record<string, string> = {};
        companies.forEach((company) => {
            const id = String(company.id ?? '').trim();
            if (!id) return;
            map[id] = String(company.name ?? '').trim() || id;
        });
        return map;
    }, [companies]);

    useEffect(() => {
        if (!showKBPreview) return;
        setKbPreviewSnapshot((current) => current
            ? buildKBPreviewSnapshot(
                current.sourceRows,
                kbAmountType,
                kbReceiverDisplay,
                kbMemoSuffix,
                current.createdAtIso,
                kbPrimaryAccountAppliedRowIds
            )
            : current);
    // 대표계좌 자체가 변경된 경우 현재 적용 행을 새 대표계좌 정보로 다시 계산한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [primaryAccount]);

    const workerTeamByWorkerId = useMemo(() => {
        const map = new Map<string, { teamId: string; teamName: string }>();
        allWorkers.forEach((worker) => {
            const workerId = String(worker.id ?? '').trim();
            if (!workerId) return;
            map.set(workerId, {
                teamId: String(worker.teamId ?? '').trim(),
                teamName: String(worker.teamName ?? '').trim(),
            });
        });
        return map;
    }, [allWorkers]);

    const normalizePersistedTeamId = useCallback((value: string | undefined): string => {
        const safe = String(value ?? '').trim();
        if (!safe) return '';
        if (safe === 'no-team' || safe === '__no_team__' || safe.startsWith('unresolved:')) return '';
        return safe;
    }, []);

    const normalizeTeamText = useCallback((value: string | undefined): string => {
        return (value ?? '')
            .toLowerCase()
            .replace(/\(.*?\)/g, '')
            .replace(/[^0-9a-z\u3131-\u318e\uac00-\ud7a3]/g, '')
            .trim();
    }, []);

    const teamIdAliasIndex = useMemo(() => {
        const aliasToCanonical = new Map<string, string>();

        allTeams.forEach((team) => {
            const id = normalizePersistedTeamId(String(team.id ?? ''));
            const legacyId = normalizePersistedTeamId(String(team.legacyId ?? ''));
            const canonical = id || legacyId;
            if (!canonical) return;

            aliasToCanonical.set(canonical, canonical);
            if (id) aliasToCanonical.set(id, canonical);
            if (legacyId) aliasToCanonical.set(legacyId, canonical);
        });

        return aliasToCanonical;
    }, [allTeams, normalizePersistedTeamId]);

    const resolveCanonicalTeamId = useCallback(
        (value: string | undefined): string => {
            const normalized = normalizePersistedTeamId(value);
            if (!normalized) return '';
            return teamIdAliasIndex.get(normalized) ?? normalized;
        },
        [normalizePersistedTeamId, teamIdAliasIndex]
    );

    const siteTeamOwnershipIndex = useMemo(() => {
        const bySiteId = new Map<string, { teamId: string; teamNameKey: string }>();
        const bySiteName = new Map<string, { teamId: string; teamNameKey: string }>();

        allSites.forEach((site) => {
            const teamId = resolveCanonicalTeamId(String(site.responsibleTeamId ?? ''));
            const teamNameKey = normalizeTeamText(site.responsibleTeamName ?? '');
            if (!teamId && !teamNameKey) return;

            const payload = { teamId, teamNameKey };

            const siteId = String(site.id ?? '').trim();
            if (siteId && !bySiteId.has(siteId)) {
                bySiteId.set(siteId, payload);
            }

            const legacyId = String(site.legacyId ?? '').trim();
            if (legacyId && !bySiteId.has(legacyId)) {
                bySiteId.set(legacyId, payload);
            }

            const siteNameKey = normalizeTeamText(site.name);
            if (siteNameKey && !bySiteName.has(siteNameKey)) {
                bySiteName.set(siteNameKey, payload);
            }
        });

        return { bySiteId, bySiteName };
    }, [allSites, normalizeTeamText, resolveCanonicalTeamId]);

    const isEntryInWorkerTeamSite = useCallback(
        (entry: WorkerWorkEntry, workerTeamId: string | undefined, workerTeamName: string | undefined): boolean => {
            const targetTeamId = resolveCanonicalTeamId(workerTeamId);
            const targetTeamNameKey = normalizeTeamText(workerTeamName);
            if (!targetTeamId && !targetTeamNameKey) return false;

            const siteId = String(entry.siteId ?? '').trim();
            const siteNameKey = normalizeTeamText(entry.siteName);
            const owner =
                (siteId ? siteTeamOwnershipIndex.bySiteId.get(siteId) : undefined) ??
                (siteNameKey ? siteTeamOwnershipIndex.bySiteName.get(siteNameKey) : undefined);

            if (!owner) return false;
            if (targetTeamId && owner.teamId && owner.teamId === targetTeamId) return true;
            if (targetTeamNameKey && owner.teamNameKey && owner.teamNameKey === targetTeamNameKey) return true;
            return false;
        },
        [normalizeTeamText, resolveCanonicalTeamId, siteTeamOwnershipIndex]
    );

    // Full-bleed: remove #main-content padding and lock overflow for internal scrolling
    useEffect(() => {
        if (transferPickerMode) return;
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
            const originalOverflow = mainContent.style.overflow;
            mainContent.style.overflow = 'hidden';
            mainContent.classList.add('page-full-bleed');
            return () => {
                mainContent.style.overflow = originalOverflow;
                mainContent.classList.remove('page-full-bleed');
            };
        }
    }, [transferPickerMode]);
    const printRef = useRef<HTMLDivElement>(null);
    const [payslipPrintRows, setPayslipPrintRows] = useState<PaymentData[]>([]);
    const [preparingPayslipPrint, setPreparingPayslipPrint] = useState<boolean>(false);
    const [batchExcelDownloading, setBatchExcelDownloading] = useState<boolean>(false);
    const teamDropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!teamDropdownOpen) return;

        const handleOutsideClick = (event: MouseEvent) => {
            if (!teamDropdownRef.current) return;
            const targetNode = event.target as Node;
            if (!teamDropdownRef.current.contains(targetNode)) {
                setTeamDropdownOpen(false);
            }
        };

        document.addEventListener('mousedown', handleOutsideClick);
        return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, [teamDropdownOpen]);

    // --- Copy Logic ---
    const handleCopyToClipboard = async () => {
        if (!ensurePayrollReady()) return;
        if (!printRef.current) return;
        if (resolvedPayslipTarget && !ensurePayslipIssueReady([resolvedPayslipTarget], '이미지 복사')) return;
        setCopying(true);

        try {
            // Force white background for the capture
            // Cast html2canvas to any because of version mismatch with @types/html2canvas (0.5.x vs 1.4.x)
            const canvas = await (html2canvas as any)(printRef.current, {
                scale: 1.5, // Reasonable scale for clipboard
                backgroundColor: '#ffffff',
                logging: false,
                useCORS: true
            });

            canvas.toBlob(async (blob: Blob | null) => {
                if (!blob) {
                    alert('이미지 생성에 실패했습니다.');
                    setCopying(false);
                    return;
                }

                try {
                    // Safe ClipboardItem usage
                    const ClipboardItem = (window as any).ClipboardItem;
                    if (!ClipboardItem) {
                        alert('이 브라우저는 이미지 복사를 지원하지 않습니다.');
                        setCopying(false);
                        return;
                    }

                    await navigator.clipboard.write([
                        new ClipboardItem({
                            'image/png': blob
                        })
                    ]);
                    alert('명세서가 이미지로 복사되었습니다.\nCtrl+V로 붙여넣으세요.');
                } catch (err) {
                    console.error('Clipboard write failed:', err);
                    alert('클립보드 복사에 실패했습니다. 권한을 확인해주세요.');
                }
                setCopying(false);
            }, 'image/png');

        } catch (error) {
            console.error('Capture failed:', error);
            alert('이미지 생성 중 오류가 발생했습니다.');
            setCopying(false);
        }
    };

    const normalizeValue = useCallback((value: string | undefined): string => {
        return (value ?? '').replace(/\s+/g, '').trim();
    }, []);

    const normalizeTeamName = useCallback((value: string | undefined): string => {
        return (value ?? '')
            .replace(/\(.*?\)/g, '')
            .replace(/\s+/g, '')
            .trim();
    }, []);

    const getYearMonthFromDate = useCallback((date: Date): string => {
        const yyyy = String(date.getFullYear());
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        return `${yyyy}-${mm}`;
    }, []);

    const compareYearMonth = useCallback((a: string, b: string): number => {
        const left = (a ?? '').trim();
        const right = (b ?? '').trim();
        if (left === right) return 0;
        return left < right ? -1 : 1;
    }, []);

    const shiftYearMonth = useCallback(
        (yearMonth: string, diffMonths: number): string => {
            const [yStr, mStr] = yearMonth.split('-');
            const y = Number(yStr);
            const m = Number(mStr);
            const safe = new Date(Number.isFinite(y) ? y : new Date().getFullYear(), (Number.isFinite(m) ? m : 1) - 1, 1);
            safe.setMonth(safe.getMonth() + diffMonths);
            return getYearMonthFromDate(safe);
        },
        [getYearMonthFromDate]
    );

    const buildMonthRange = useCallback(
        (rangeStart: string, rangeEnd: string): string[] => {
            const safeStart = (rangeStart ?? '').trim();
            const safeEnd = (rangeEnd ?? '').trim();
            if (!safeStart || !safeEnd) return [];

            const from = compareYearMonth(safeStart, safeEnd) <= 0 ? safeStart : safeEnd;
            const to = compareYearMonth(safeStart, safeEnd) <= 0 ? safeEnd : safeStart;

            const result: string[] = [];
            let cursor = from;
            for (let i = 0; i < 240; i += 1) {
                result.push(cursor);
                if (cursor === to) break;
                cursor = shiftYearMonth(cursor, 1);
            }
            return result;
        },
        [compareYearMonth, shiftYearMonth]
    );

    const currentYearMonth = useMemo(() => getYearMonthFromDate(new Date()), [getYearMonthFromDate]);
    const prevYearMonth = useMemo(() => shiftYearMonth(currentYearMonth, -1), [currentYearMonth, shiftYearMonth]);

    const handleSelectSingleMonth = useCallback((yearMonth: string) => {
        const safe = (yearMonth ?? '').trim();
        if (!safe) return;
        setStartMonth(safe);
        setEndMonth(safe);
        setYearCursor(safe);
        setRangeAnchorMonth('');
    }, []);

    const handleSelectPrevMonth = useCallback(() => {
        handleSelectSingleMonth(prevYearMonth);
    }, [handleSelectSingleMonth, prevYearMonth]);

    const handleSelectCurrentMonth = useCallback(() => {
        handleSelectSingleMonth(currentYearMonth);
    }, [currentYearMonth, handleSelectSingleMonth]);

    const handleMonthModeChange = useCallback(
        (nextMode: 'single' | 'range') => {
            setMonthSelectionMode(nextMode);
            setRangeAnchorMonth('');
            if (nextMode === 'single') {
                const safe = (endMonth || startMonth || currentYearMonth).trim();
                if (safe) {
                    setStartMonth(safe);
                    setEndMonth(safe);
                    setYearCursor(safe);
                }
            }
        },
        [currentYearMonth, endMonth, startMonth]
    );

    const handleMonthButtonSelect = useCallback(
        (yearMonth: string) => {
            const safe = (yearMonth ?? '').trim();
            if (!safe) return;
            setYearCursor(safe);

            if (monthSelectionMode === 'single') {
                handleSelectSingleMonth(safe);
                return;
            }

            if (!rangeAnchorMonth) {
                setRangeAnchorMonth('');
                setStartMonth(safe);
                setEndMonth(safe);
                return;
            }

            const from = compareYearMonth(rangeAnchorMonth, safe) <= 0 ? rangeAnchorMonth : safe;
            const to = compareYearMonth(rangeAnchorMonth, safe) <= 0 ? safe : rangeAnchorMonth;
            setStartMonth(from);
            setEndMonth(to);
            setRangeAnchorMonth('');
        },
        [compareYearMonth, handleSelectSingleMonth, monthSelectionMode, rangeAnchorMonth]
    );

    const monthRange = useMemo(() => buildMonthRange(startMonth, endMonth), [buildMonthRange, endMonth, startMonth]);
    const monthRangeSet = useMemo(() => new Set(monthRange), [monthRange]);

    useEffect(() => {
        let alive = true;
        const years = Array.from(new Set(
            monthRange
                .map((yearMonth) => Number(yearMonth.slice(0, 4)))
                .filter((year) => Number.isFinite(year) && year > 0)
        ));

        if (years.length === 0) {
            setSavedPayrollSettlements([]);
            return () => {
                alive = false;
            };
        }

        setPayrollSettlementLoading(true);
        setPayrollSettlementLoadError(null);
        Promise.all(years.map((year) => monthlyPayrollSettlementService.getSettlementsByYear(year)))
            .then((results) => {
                if (!alive) return;
                setSavedPayrollSettlements(
                    results
                        .flat()
                        .filter((settlement) => monthRangeSet.has(settlement.yearMonth))
                );
            })
            .catch((error) => {
                console.error('[MonthlyWageDraftPage] saved settlement load failed:', error);
                if (!alive) return;
                setSavedPayrollSettlements([]);
                setPayrollSettlementLoadError('저장된 정산을 불러오지 못했습니다. 다시 조회해 주세요.');
                setPayrollSettlementFeedback('저장된 정산을 불러오지 못했습니다.');
            })
            .finally(() => {
                if (alive) setPayrollSettlementLoading(false);
            });

        return () => {
            alive = false;
        };
    }, [monthRange, monthRangeSet, payrollReloadKey]);

    const selectedTeamLabel = useMemo(() => {
        if (!selectedTeamId) return '팀전체';
        const found = teams.find((team) => String(team.id ?? '').trim() === selectedTeamId);
        return (found?.name ?? '팀전체').trim() || '팀전체';
    }, [selectedTeamId, teams]);

    useEffect(() => {
        let alive = true;
        if (transferPickerMode) return;
        if (monthRange.length === 0) {
            setPayslipOutputIds({});
            return;
        }

        Promise.all(monthRange.map((month) =>
            statementOutputService.getOutputsByMonth(month).catch((error) => {
                console.error('[MonthlyWageDraftPage] payslip output load failed:', error);
                return [] as StatementOutputRecord[];
            })
        )).then((groups) => {
            if (!alive) return;
            const next: Record<string, string> = {};
            groups.flat()
                .filter((item) => item.source === 'monthly-wage' && item.kind === 'labor' && item.status === 'afterIssue')
                .forEach((item) => {
                    if (item.statementKey && item.id) next[item.statementKey] = item.id;
                });
            setPayslipOutputIds(next);
        });

        return () => {
            alive = false;
        };
    }, [monthRange, transferPickerMode]);

    const rangeLabel = useMemo(() => {
        if (!startMonth || !endMonth) return '';
        const from = compareYearMonth(startMonth, endMonth) <= 0 ? startMonth : endMonth;
        const to = compareYearMonth(startMonth, endMonth) <= 0 ? endMonth : startMonth;
        return from === to ? from : `${from}~${to}`;
    }, [compareYearMonth, endMonth, startMonth]);

        const formatYearMonthParts = useCallback((value: string) => {
            const [year = '-', month = '-'] = (value ?? '').split('-');
            return {
                year,
                month,
            };
        }, []);

    const tableColSpan = showAccountColumns ? 15 : 11;
    const filteredPaymentSourceData = useMemo(() => {
        const rows = paymentData;

        const sortRows = (list: PaymentData[]) => {
            const salaryRank = (item: PaymentData) => (item.id.endsWith('__월급제') ? 0 : 1);
            return [...list].sort((a, b) => {
                const monthCmp = String(a.month ?? '').localeCompare(String(b.month ?? ''));
                if (monthCmp !== 0) return monthCmp;

                const rankCmp = salaryRank(a) - salaryRank(b);
                if (rankCmp !== 0) return rankCmp;

                const workerCmp = String(a.workerName ?? '').localeCompare(String(b.workerName ?? ''));
                if (workerCmp !== 0) return workerCmp;

                const teamCmp = String(a.teamName ?? '').localeCompare(String(b.teamName ?? ''));
                if (teamCmp !== 0) return teamCmp;

                return String(a.id ?? '').localeCompare(String(b.id ?? ''));
            });
        };

        if (filterMode === 'team') {
            return sortRows(rows);
        }

        if (selectedWorkerId) {
            return sortRows(rows.filter((item) => item.workerId === selectedWorkerId));
        }
        return sortRows(filterRowsByWorkerName(rows, workerSearchText));
    }, [filterMode, paymentData, selectedWorkerId, workerSearchText]);

    // 확정/지급완료된 월·팀은 원천자료가 이후 변경되어도 당시 저장한
    // 급여 행을 사용한다. 기존 상세 화면과 출력 기능은 같은 목록을 보므로
    // 화면마다 다른 급여가 보이는 문제도 막을 수 있다.
    const finalizedSnapshotByPaymentId = useMemo(() => {
        const snapshots = new Map<string, {
            payment: PaymentData;
            row: MonthlyPayrollSettlement['rows'][number];
            settlementId: string;
        }>();

        savedPayrollSettlements
            .filter((settlement) => (
                monthRangeSet.has(settlement.yearMonth)
                && isFinalizedMonthlyPayrollRun(settlement.runStatus)
            ))
            .forEach((settlement) => {
                settlement.rows.forEach((row) => {
                    const snapshot = row.paymentSnapshot as PaymentData | undefined;
                    const paymentId = String(snapshot?.id ?? '').trim();
                    if (!snapshot || !paymentId) return;
                    snapshots.set(paymentId, {
                        payment: snapshot,
                        row,
                        settlementId: settlement.id || '',
                    });
                });
            });

        return snapshots;
    }, [monthRangeSet, savedPayrollSettlements]);

    const filteredPaymentData = useMemo(() => {
        const applyFinalizedSnapshot = (
            source: PaymentData | undefined,
            finalized: NonNullable<typeof finalizedSnapshotByPaymentId extends Map<string, infer T> ? T : never>
        ): PaymentData => ({
            ...(source ?? finalized.payment),
            ...finalized.payment,
            totalDeduction: toNumber(finalized.row.totalDeduction ?? finalized.payment.totalDeduction),
            totalAmount: toNumber(finalized.row.netAmount ?? finalized.payment.totalAmount),
            deductionBreakdown: finalized.payment.deductionBreakdown ?? source?.deductionBreakdown ?? createEmptyDeductionBreakdown(),
            taxBreakdown: finalized.payment.taxBreakdown ?? source?.taxBreakdown ?? createEmptyDeductionBreakdown(),
        });

        const sourceIds = new Set(filteredPaymentSourceData.map((item) => item.id));
        const rows = filteredPaymentSourceData.map((source) => {
            const finalized = finalizedSnapshotByPaymentId.get(source.id);
            return finalized ? applyFinalizedSnapshot(source, finalized) : source;
        });

        const workerSearch = workerSearchText.trim().toLowerCase();
        finalizedSnapshotByPaymentId.forEach((finalized, paymentId) => {
            if (sourceIds.has(paymentId)) return;
            const payment = finalized.payment;
            if (selectedTeamId && payment.teamId !== selectedTeamId) return;
            if (filterMode !== 'worker') {
                rows.push(applyFinalizedSnapshot(undefined, finalized));
                return;
            }
            if (selectedWorkerId) {
                if (payment.workerId === selectedWorkerId) rows.push(applyFinalizedSnapshot(undefined, finalized));
                return;
            }
            if (!workerSearch || payment.workerName.toLowerCase().includes(workerSearch)) {
                rows.push(applyFinalizedSnapshot(undefined, finalized));
            }
        });

        return rows.sort((a, b) => (
            String(a.month ?? '').localeCompare(String(b.month ?? ''))
            || String(a.workerName ?? '').localeCompare(String(b.workerName ?? ''))
            || String(a.teamName ?? '').localeCompare(String(b.teamName ?? ''))
            || String(a.id ?? '').localeCompare(String(b.id ?? ''))
        ));
    }, [
        filterMode,
        filteredPaymentSourceData,
        finalizedSnapshotByPaymentId,
        selectedTeamId,
        selectedWorkerId,
        workerSearchText,
    ]);

    const payslipPaymentData = useMemo(
        () => filterPayslipRowsBySalaryModel(filteredPaymentData, payslipSalaryModelFilter),
        [filteredPaymentData, payslipSalaryModelFilter]
    );

    const kbSourcePaymentData = useMemo(() => {
        return filterKBPaymentRows(filteredPaymentData, {
            pageViewMode: pageViewMode === 'ledger' ? 'ledger' : 'standard',
            ledgerSalaryModelFilter,
        });
    }, [filteredPaymentData, ledgerSalaryModelFilter, pageViewMode]);

    const filteredLedgerRows = useMemo<MonthlyAdvanceLedgerRow[]>(() => {
        const matchesSalaryModelFilter = (row: MonthlyAdvanceLedgerRow): boolean => {
            if (ledgerSalaryModelFilter === 'all') return true;
            const normalized = (row.salaryModel ?? '').trim();
            const filterValue = normalized === '일급제'
                ? 'daily'
                : normalized === '용역팀'
                    ? 'service'
                    : 'monthly';
            return filterValue === ledgerSalaryModelFilter;
        };

        const sourceRows = new Map(ledgerRowsData.map(row => [row.rowKey, row]));
        const visiblePaymentIds = new Set(filteredPaymentData.map(item => item.id));
        finalizedSnapshotByPaymentId.forEach(({ payment, row: saved }, paymentId) => {
            if (!visiblePaymentIds.has(paymentId)) return;
            const rowKey = saved.rowKey || paymentId;
            const source = sourceRows.get(rowKey);
            const corporateNet = toNumber(saved.invoiceNetAmount ?? payment.invoiceNetAmount);
            const netAmount = toNumber(saved.netAmount ?? payment.totalAmount);
            sourceRows.set(rowKey, {
                ...source,
                rowKey, id: paymentId, month: payment.month, date: payment.month, type: '월급',
                teamId: payment.teamId, teamName: payment.teamName,
                workerId: payment.workerId, workerName: payment.workerName,
                salaryModel: paymentId.endsWith('__일급제') ? '일급제' : paymentId.endsWith('__용역팀') ? '용역팀' : '월급제',
                unitPrice: payment.unitPrice,
                invoiceManDay: payment.invoiceManDay, laborManDay: payment.laborManDay,
                invoiceGrossAmount: payment.invoiceGrossAmount, laborGrossAmount: payment.laborGrossAmount,
                amount: payment.grossAmount, workEntries: payment.workEntries,
                manual: saved.manualInput as LedgerManualInput | undefined,
                finalizedAmounts: { corporateNet, personalNet: netAmount - corporateNet },
            });
        });
        const rows = Array.from(sourceRows.values()).filter(matchesSalaryModelFilter);
        if (filterMode === 'team') return rows;
        if (selectedWorkerId) {
            return rows.filter((item) => item.workerId === selectedWorkerId);
        }
        return filterRowsByWorkerName(rows, workerSearchText);
    }, [filterMode, filteredPaymentData, finalizedSnapshotByPaymentId, ledgerRowsData, ledgerSalaryModelFilter, selectedWorkerId, workerSearchText]);

    const paymentDataByLedgerKey = useMemo(() => {
        const map = new Map<string, PaymentData>();
        filteredPaymentData.forEach((item) => {
            const salaryModel = item.id.endsWith('__일급제') ? '일급제' : item.id.endsWith('__용역팀') ? '용역팀' : '월급제';
            map.set(`${item.month}__${item.workerId}__${item.teamId}__${salaryModel}`, item);
        });
        return map;
    }, [filteredPaymentData]);

    const paymentDataByWorkerMonthKey = useMemo(() => {
        const map = new Map<string, PaymentData[]>();
        filteredPaymentData.forEach((item) => {
            const key = `${item.month}__${item.workerId}`;
            const prev = map.get(key) ?? [];
            prev.push(item);
            map.set(key, prev);
        });
        return map;
    }, [filteredPaymentData]);

    const ledgerRows = useMemo<MonthlyAdvanceLedgerRow[]>(
        () =>
            filteredLedgerRows.map((row) => {
                const _rawModel = (row.salaryModel ?? '').trim();
                const rowSalaryModel = _rawModel === '일급제' ? '일급제' : _rawModel === '용역팀' ? '용역팀' : '월급제';
                const key = `${row.month}__${row.workerId}__${row.teamId}__${rowSalaryModel}`;
                let statementItem = paymentDataByLedgerKey.get(key);

                if (!statementItem) {
                    const looseKey = `${row.month}__${row.workerId}`;
                    const workerTeam = workerTeamByWorkerId.get(String(row.workerId ?? '').trim());
                    const normalizedRowTeam = normalizeTeamName(workerTeam?.teamName || row.teamName);
                    const targetCanonicalTeamId = resolveCanonicalTeamId(workerTeam?.teamId || row.teamId);
                    const candidates = (paymentDataByWorkerMonthKey.get(looseKey) ?? []).filter((candidate) => {
                        const candidateSalaryModel = candidate.id.endsWith('__일급제') ? '일급제' : candidate.id.endsWith('__용역팀') ? '용역팀' : '월급제';
                        return candidateSalaryModel === rowSalaryModel;
                    });

                    statementItem =
                        candidates.find((candidate) => {
                            if (!targetCanonicalTeamId) return false;
                            return resolveCanonicalTeamId(candidate.teamId) === targetCanonicalTeamId;
                        }) ??
                        candidates.find((candidate) => normalizeTeamName(candidate.teamName) === normalizedRowTeam) ??
                        (candidates.length === 1 ? candidates[0] : undefined);
                }

                if (statementItem) {
                    return {
                        ...row,
                        teamId: statementItem.teamId,
                        teamName: statementItem.teamName,
                        invoiceManDay: statementItem.invoiceManDay,
                        laborManDay: statementItem.laborManDay,
                        unitPrice: statementItem.unitPrice,
                        invoiceGrossAmount: statementItem.invoiceGrossAmount,
                        laborGrossAmount: statementItem.laborGrossAmount,
                        workEntries: [...(statementItem.workEntries ?? [])],
                        statementTaxAmounts: extractLedgerTaxAmountsFromItem(statementItem),
                    };
                }

                if (!payrollConfig) return row;

                const workerTeam = workerTeamByWorkerId.get(String(row.workerId ?? '').trim());
                const workerTeamIdForMatch = workerTeam?.teamId || row.teamId;
                const workerTeamNameForMatch = workerTeam?.teamName || row.teamName;

                const workEntriesForTax = buildWorkEntriesForLedgerRow(row);
                const applyInsuranceForRow = insuranceApplied;
                const applyBusinessIncomeForRow = businessIncomeApplied;
                const calculatedTax = calculateWorkEntryTaxBreakdown({
                    workEntries: workEntriesForTax,
                    payrollConfig,
                    applyInsurance: applyInsuranceForRow,
                    applyBusinessIncome: applyBusinessIncomeForRow,
                    normalizeSiteName: normalizeTeamName,
                    withholdingThreshold: WITHHOLDING_MAX_MAN_DAY,
                    isInsuranceEligibleEntry: insuranceTeamSiteOnly
                    ? (entry) => isEntryInWorkerTeamSite(entry, workerTeamIdForMatch, workerTeamNameForMatch)
                        : undefined,
                });

                const fallbackDailyFeePerManDay = Math.max(
                    0,
                    Math.floor(toNumber(payrollConfig?.insuranceConfig?.dailyWorkerFeePerManDay ?? 0))
                );
                const fallbackDailyFeeManDay = workEntriesForTax.reduce((sum, entry) => sum + toNumber(entry.manDay), 0);
                const fallbackDailyFee = rowSalaryModel === '일급제' && fallbackDailyFeePerManDay > 0
                    ? floorWon(fallbackDailyFeeManDay * fallbackDailyFeePerManDay)
                    : 0;

                return {
                    ...row,
                    statementTaxAmounts: {
                        ...calculatedTax.statementTaxAmounts,
                        dailyFee: fallbackDailyFee,
                    },
                };
            }),
        [
            businessIncomeApplied,
            filteredLedgerRows,
            insuranceApplied,
            insuranceTeamSiteOnly,
            isEntryInWorkerTeamSite,
            normalizeTeamName,
            paymentDataByLedgerKey,
            paymentDataByWorkerMonthKey,
            payrollConfig,
            resolveCanonicalTeamId,
            workerTeamByWorkerId,
        ]
    );

    const ledgerComputedAmountByRowKey = useMemo(() => {
        const map = new Map<string, MonthlyAdvanceLedgerComputedAmount>();
        ledgerComputedAmounts.forEach((row) => {
            const rowKey = String(row.rowKey ?? '').trim();
            if (rowKey) map.set(rowKey, row);
        });
        return map;
    }, [ledgerComputedAmounts]);

    const loadedLedgerInputsFromAdvance = useMemo<Record<string, { input: LedgerManualInput; updatedAt?: unknown }>>(() => {
        const next: Record<string, { input: LedgerManualInput; updatedAt?: unknown }> = {};
        ledgerRows.forEach((row) => {
            const key = String(row.rowKey || row.id || '').trim();
            if (!key || !row.manual) return;
            next[key] = { input: row.manual, updatedAt: row.sourceManualUpdatedAt };
        });
        return next;
    }, [ledgerRows]);

    const initialLedgerInputs = useMemo<Record<string, LedgerManualInput>>(() => {
        const next: Record<string, LedgerManualInput> = {};
        Object.entries(loadedLedgerInputsFromAdvance).forEach(([rowKey, source]) => {
            next[rowKey] = source.input;
        });

        savedPayrollSettlements.forEach((settlement) => {
            settlement.rows.forEach((row) => {
                const rowKey = String(row.rowKey ?? '').trim();
                if (!rowKey || !row.manualInput) return;
                const source = loadedLedgerInputsFromAdvance[rowKey];
                const resolved = resolveInitialLedgerManualInput({
                    advanceInput: source?.input,
                    advanceUpdatedAt: source?.updatedAt,
                    settlementInput: row.manualInput as LedgerManualInput,
                    settlementUpdatedAt: settlement.updatedAt,
                    settlementStatus: settlement.runStatus,
                });
                if (resolved) next[rowKey] = resolved;
            });
        });

        return next;
    }, [loadedLedgerInputsFromAdvance, savedPayrollSettlements]);

    // A result is ready only after the read-only ledger reports amounts for these exact inputs.
    const transferLedgerToken = useMemo(() => ({}), [ledgerRows, payrollConfig, initialLedgerInputs,
        insuranceApplied, insuranceTeamSiteOnly, businessIncomeApplied, utilitiesApplied, dailyFeeApplied, ledgerInputs]);
    const [transferLedgerReadyToken, setTransferLedgerReadyToken] = useState<object | null>(null);
    const handleTransferLedgerComputed = useCallback((rows: MonthlyAdvanceLedgerComputedAmount[]) => {
        setLedgerComputedAmounts(rows);
        setTransferLedgerReadyToken(transferLedgerToken);
    }, [transferLedgerToken]);

    const activeLedgerRowKeySet = useMemo<Set<string>>(() => {
        const set = new Set<string>();
        ledgerRows.forEach((row) => {
            const key = String(row.rowKey || row.id || '').trim();
            if (key) set.add(key);
        });
        return set;
    }, [ledgerRows]);

    const ledgerSideFieldNames: Array<keyof LedgerManualInput['invoice']> = useMemo(
        () => [
            'carry',
            'carrySecond',
            'currentAdvance',
            'currentAdvanceSecond',
            'lodging',
            'electricity',
            'gas',
            'water',
            'internet',
            'management',
            'fine',
            'other',
        ],
        []
    );

    const isLedgerManualInputEffectivelyEmpty = useCallback(
        (input: LedgerManualInput | undefined, baselineInput?: LedgerManualInput): boolean => {
            if (!input) return true;

            const resolveAssignmentType = (
                assignmentType: LedgerManualInput['assignmentType'] | undefined,
                fallback: 'corporate' | 'labor' = 'corporate'
            ): 'corporate' | 'labor' => {
                if (assignmentType === 'labor') return 'labor';
                if (assignmentType === 'corporate') return 'corporate';
                return fallback;
            };

            const isSideEmpty = (side: LedgerManualInput['invoice'] | undefined): boolean => {
                const safeSide = side ?? ({} as LedgerManualInput['invoice']);
                return ledgerSideFieldNames.every((field) => toNumber(safeSide[field]) === 0);
            };

            const memo = String(input.personalMemo ?? '').trim();
            const assignments = input.itemAssignments ?? {};
            const hasAssignment = Object.keys(assignments).some((key) => {
                const value = assignments[key];
                return (value === 'corporate' || value === 'labor') && String(key).trim().length > 0;
            });

            const baselineAllocationMode = baselineInput?.allocationMode ?? 'split';
            const currentAllocationMode = input.allocationMode ?? 'split';
            const hasCustomAllocationMode = currentAllocationMode !== baselineAllocationMode;
            const hasAnyValue = !isSideEmpty(input.invoice)
                || !isSideEmpty(input.labor)
                || memo.length > 0
                || hasAssignment
                || hasCustomAllocationMode;
            if (!hasAnyValue) return true;

            const baselineAssignment = resolveAssignmentType(baselineInput?.assignmentType, 'corporate');
            const currentAssignment = resolveAssignmentType(input.assignmentType, baselineAssignment);
            const hasCustomAssignment = currentAssignment !== baselineAssignment;

            return isSideEmpty(input.invoice)
                && isSideEmpty(input.labor)
                && memo.length === 0
                && !hasAssignment
                && !hasCustomAssignment
                && !hasCustomAllocationMode;
        },
        [ledgerSideFieldNames]
    );

    const previousInitialLedgerInputsRef = useRef(initialLedgerInputs);
    useEffect(() => {
        const previousInitialInputs = previousInitialLedgerInputsRef.current;
        previousInitialLedgerInputsRef.current = initialLedgerInputs;
        setLedgerInputs((prev) => {
            const next: Record<string, LedgerManualInput> = {};

            activeLedgerRowKeySet.forEach((key) => {
                const prevInput = prev[key];
                const loadedInput = initialLedgerInputs[key];

                const unchangedSinceLoad = isLedgerManualInputUnchanged(prevInput, previousInitialInputs[key]);
                const emptyBeforeLoad = !previousInitialInputs[key] && isLedgerManualInputEffectivelyEmpty(prevInput, loadedInput);
                if (loadedInput && (!prevInput || unchangedSinceLoad || emptyBeforeLoad)) {
                    next[key] = loadedInput;
                    return;
                }

                if (prevInput) {
                    next[key] = prevInput;
                    return;
                }

                if (loadedInput) {
                    next[key] = loadedInput;
                }
            });

            const prevKeys = Object.keys(prev);
            const nextKeys = Object.keys(next);
            if (prevKeys.length !== nextKeys.length) return next;

            const hasChanged = nextKeys.some((key) => prev[key] !== next[key]);
            return hasChanged ? next : prev;
        });
    }, [activeLedgerRowKeySet, initialLedgerInputs, isLedgerManualInputEffectivelyEmpty]);

    const utilityInputByPaymentRowKey = useMemo(() => {
        const map = new Map<string, LedgerUtilityInputLike>();
        const paymentRows = basePaymentData.length > 0 ? basePaymentData : paymentData;

        const upsertUtilityInput = (paymentRowKey: string, input: LedgerUtilityInputLike) => {
            const existing = map.get(paymentRowKey);
            if (!existing) {
                map.set(paymentRowKey, input);
                return;
            }

            const mergeSide = (side: 'invoice' | 'labor') => {
                const prevSide = existing[side];
                const nextSide = input[side];
                return {
                    ...prevSide,
                    ...nextSide,
                    lodging: toNumber(prevSide?.lodging) + toNumber(nextSide?.lodging),
                    electricity: toNumber(prevSide?.electricity) + toNumber(nextSide?.electricity),
                    gas: toNumber(prevSide?.gas) + toNumber(nextSide?.gas),
                    water: toNumber(prevSide?.water) + toNumber(nextSide?.water),
                    internet: toNumber(prevSide?.internet) + toNumber(nextSide?.internet),
                    management: toNumber(prevSide?.management) + toNumber(nextSide?.management),
                    fine: toNumber(prevSide?.fine) + toNumber(nextSide?.fine),
                    other: toNumber(prevSide?.other) + toNumber(nextSide?.other),
                };
            };

            map.set(paymentRowKey, {
                ...existing,
                ...input,
                invoice: mergeSide('invoice'),
                labor: mergeSide('labor'),
            });
        };

        Object.entries(ledgerInputs).forEach(([ledgerRowKey, manual]) => {
            const salaryModel = ledgerRowKey.endsWith('__일급제') ? '일급제' : ledgerRowKey.endsWith('__용역팀') ? '용역팀' : (ledgerRowKey.endsWith('__월급제') ? '월급제' : '');
            if (!salaryModel) return;

            const input = manual as LedgerUtilityInputLike;
            const parts = ledgerRowKey.split('__');
            if (parts.length < 4) return;
            const [month, workerId, teamId] = parts;

            const directPaymentKey = `${month}__${workerId}__${teamId}__${salaryModel}`;
            if (paymentRows.some((item) => item.id === directPaymentKey)) {
                upsertUtilityInput(directPaymentKey, input);
                return;
            }

            const candidates = paymentRows.filter((item) => item.month === month && item.workerId === workerId && item.id.endsWith(`__${salaryModel}`));
            if (candidates.length === 0) return;

            const ledgerRow = ledgerRowsData.find((row) => row.rowKey === ledgerRowKey);
            if (ledgerRow) {
                const normalizedLedgerTeam = normalizeTeamName(ledgerRow.teamName);
                const matched = candidates.find((candidate) => normalizeTeamName(candidate.teamName) === normalizedLedgerTeam);
                if (matched) {
                    upsertUtilityInput(matched.id, input);
                    return;
                }
            }

            if (candidates.length === 1) {
                upsertUtilityInput(candidates[0].id, input);
            }
        });

        return map;
    }, [basePaymentData, ledgerInputs, ledgerRowsData, normalizeTeamName, paymentData]);

    const utilityInputByWorkerMonthSingle = useMemo(() => {
        const grouped = new Map<string, LedgerUtilityInputLike[]>();

        Object.entries(ledgerInputs).forEach(([ledgerRowKey, manual]) => {
            const salaryModel = ledgerRowKey.endsWith('__일급제') ? '일급제' : ledgerRowKey.endsWith('__용역팀') ? '용역팀' : (ledgerRowKey.endsWith('__월급제') ? '월급제' : '');
            if (!salaryModel) return;
            const parts = ledgerRowKey.split('__');
            if (parts.length < 4) return;
            const [month, workerId] = parts;
            const key = `${month}__${workerId}__${salaryModel}`;
            const list = grouped.get(key) ?? [];
            list.push(manual as LedgerUtilityInputLike);
            grouped.set(key, list);
        });

        const singleMap = new Map<string, LedgerUtilityInputLike>();
        grouped.forEach((list, key) => {
            if (list.length === 1) {
                singleMap.set(key, list[0]);
            }
        });

        return singleMap;
    }, [ledgerInputs]);

    const mergeUtilityInput = useCallback((left: LedgerUtilityInputLike, right: LedgerUtilityInputLike): LedgerUtilityInputLike => {
        const mergeSide = (side: 'invoice' | 'labor') => ({
            ...left[side],
            ...right[side],
            lodging: toNumber(left[side]?.lodging) + toNumber(right[side]?.lodging),
            electricity: toNumber(left[side]?.electricity) + toNumber(right[side]?.electricity),
            gas: toNumber(left[side]?.gas) + toNumber(right[side]?.gas),
            water: toNumber(left[side]?.water) + toNumber(right[side]?.water),
            internet: toNumber(left[side]?.internet) + toNumber(right[side]?.internet),
            management: toNumber(left[side]?.management) + toNumber(right[side]?.management),
            fine: toNumber(left[side]?.fine) + toNumber(right[side]?.fine),
            other: toNumber(left[side]?.other) + toNumber(right[side]?.other),
        });

        return {
            ...left,
            ...right,
            invoice: mergeSide('invoice'),
            labor: mergeSide('labor'),
        };
    }, []);

    const resolveUtilityInputForPaymentItem = useCallback((item: PaymentData): LedgerUtilityInputLike | undefined => {
        const itemSalaryModel = item.id.endsWith('__일급제') ? '일급제' : item.id.endsWith('__용역팀') ? '용역팀' : '월급제';
        const itemRowKey = item.id;
        const direct = itemRowKey ? (ledgerInputsRef.current[itemRowKey] as LedgerUtilityInputLike | undefined) : undefined;
        const mapped = itemRowKey ? utilityInputByPaymentRowKeyRef.current.get(itemRowKey) : undefined;

        // 동일 행의 direct 입력이 있으면 우선 사용 (mapped와 합치면 2배 합산이 발생할 수 있음)
        if (direct) return direct;
        if (mapped) return mapped;

        const itemTeamNormalized = normalizeTeamNameRef.current(item.teamName);
        const monthWorkerKey = `${item.month}__${item.workerId}__${itemSalaryModel}`;
        const singleFallback = utilityInputByWorkerMonthSingleRef.current.get(monthWorkerKey);

        const monthWorkerEntries = Object.entries(ledgerInputsRef.current)
            .filter(([ledgerRowKey]) => ledgerRowKey.endsWith(`__${itemSalaryModel}`))
            .filter(([ledgerRowKey]) => {
                const parts = ledgerRowKey.split('__');
                if (parts.length < 4) return false;
                const [month, workerId] = parts;
                return month === item.month && workerId === item.workerId;
            })
            .map(([ledgerRowKey, manual]) => {
                const ledgerRow = ledgerRowsDataRef.current.find((row) => row.rowKey === ledgerRowKey);
                return {
                    team: normalizeTeamNameRef.current(ledgerRow?.teamName),
                    input: manual as LedgerUtilityInputLike,
                };
            });

        const teamMatchedInputs = monthWorkerEntries
            .filter((entry) => !itemTeamNormalized || !entry.team || entry.team === itemTeamNormalized)
            .map((entry) => entry.input);

        if (teamMatchedInputs.length > 1) {
            return teamMatchedInputs.reduce((acc, cur) => mergeUtilityInputRef.current(acc, cur));
        }

        if (teamMatchedInputs.length === 1) {
            return teamMatchedInputs[0];
        }

        if (singleFallback) {
            return singleFallback;
        }

        const paymentRows = (basePaymentDataRef.current.length > 0 ? basePaymentDataRef.current : paymentDataRef.current)
            .filter((row) => row.month === item.month && row.workerId === item.workerId);

        if (paymentRows.length === 1 && monthWorkerEntries.length > 0) {
            return monthWorkerEntries
                .map((entry) => entry.input)
                .reduce((acc, cur) => mergeUtilityInputRef.current(acc, cur));
        }

        return undefined;
    }, []);

    const payslipTarget = useMemo(() => {
        if (payslipPaymentData.length === 0) return null;
        const defaultTarget = payslipPaymentData.find((item) => item.id.endsWith('__월급제')) ?? payslipPaymentData[0];
        const targetKey = selectedPayslipRowKey || defaultTarget.id;
        const target = payslipPaymentData.find((item) => item.id === targetKey) ?? defaultTarget;
        return target;
    }, [payslipPaymentData, selectedPayslipRowKey]);

    useEffect(() => {
        let mounted = true;
        const fetchInitialData = async () => {
            setFiltersReady(false);
            setFiltersLoadError('');
            try {
                const [
                    fetchedTeams,
                    fetchedWorkers,
                    fetchedCompanies,
                    fetchedSites,
                ] = await Promise.all([
                    teamService.getTeams(),
                    manpowerService.getWorkers(),
                    companyService.getCompanies(),
                    siteService.getSites(),
                ]);
                if (!mounted) return;
                setAllTeams(fetchedTeams);
                setAllWorkers(fetchedWorkers);
                setCompanies(fetchedCompanies);
                setAllSites(fetchedSites);
            } catch (error) {
                if (!mounted) return;
                console.error('Failed to load initial data:', error);
                setFiltersLoadError('급여 팀·작업자 정보를 불러오지 못했습니다. 다시 조회해 주세요.');
                if (!transferPickerMode) alert('초기 데이터를 불러오는 중 오류가 발생했습니다.');
            } finally {
                if (mounted) {
                    setFiltersReady(true);
                }
            }
        };

        void fetchInitialData();
        return () => {
            mounted = false;
        };
    }, [payrollReloadKey, transferPickerMode]);

    useEffect(() => {
        let mounted = true;
        const loadPayrollConfig = async () => {
            setPayrollConfigLoading(true);
            setPayrollConfigLoadError(null);
            try {
                const config = await payrollConfigService.getConfig();
                if (!mounted) return;
                setDeductionLabelMap(buildDeductionLabelMapFromConfig(config?.deductionItems));
                setPayrollConfig(config);
            } catch (error) {
                console.error('Failed to load payroll deduction config:', error);
                if (mounted) setPayrollConfigLoadError('급여 계산 설정을 불러오지 못했습니다. 다시 조회해 주세요.');
            } finally {
                if (mounted) setPayrollConfigLoading(false);
            }
        };

        void loadPayrollConfig();
        return () => {
            mounted = false;
        };
    }, [payrollReloadKey]);

    const openInsuranceSettings = useCallback(() => {
        const config = payrollConfig;
        const insurance = config?.insuranceConfig;

        setInsuranceThresholdManDayInput(String(insurance?.thresholdDays ?? 8));
        setPensionRatePercentInput(String(Math.round(((insurance?.pensionRate ?? 0.045) * 10000)) / 100));
        setHealthRatePercentInput(String(Math.round(((insurance?.healthRate ?? 0.03545) * 100000)) / 1000));
        setCareRateOfHealthPercentInput(String(Math.round(((insurance?.careRateOfHealth ?? 0.1295) * 100000)) / 1000));
        setEmploymentRatePercentInput(String(Math.round(((insurance?.employmentRate ?? 0.009) * 100000)) / 1000));
        setDailyWorkerFeePerManDayInput(String(Math.floor(toNumber(insurance?.dailyWorkerFeePerManDay ?? 0))));
        setWithholdingBaseDeductionInput(String(Math.floor(toNumber(insurance?.withholdingBaseDeduction ?? 150000))));
        setWithholdingIncomeBaseMultiplierPercentInput(
            String(Math.round((toNumber(insurance?.withholdingIncomeBaseMultiplier ?? 0.55) * 10000)) / 100)
        );
        setIncomeTaxRatePercentInput(
            String(Math.round((toNumber(insurance?.withholdingIncomeTaxRate ?? config?.incomeTaxRate ?? 0.06) * 10000)) / 100)
        );
        setResidentTaxRatePercentInput(
            String(Math.round((toNumber(insurance?.withholdingResidentTaxRate ?? config?.residentTaxRate ?? 0.1) * 10000)) / 100)
        );
        setWithholdingApplyAllLaborInput(
            typeof insurance?.withholdingApplyAllLabor === 'boolean' ? insurance.withholdingApplyAllLabor : true
        );
        setEmploymentApplyBelowThresholdInput(
            typeof insurance?.employmentApplyBelowThreshold === 'boolean' ? insurance.employmentApplyBelowThreshold : true
        );

        setShowInsuranceSettings(true);
    }, [payrollConfig]);

    // useRef로 최신 상태 액세스 - 의존성 없이 항상 최신값 사용
    const basePaymentDataRef = React.useRef(basePaymentData);
    const paymentDataRef = React.useRef(paymentData);
    // 연속 토글 디바운스 타이머
    const applyDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const payrollConfigRef = React.useRef(payrollConfig);
    const normalizeTeamNameRef = React.useRef(normalizeTeamName);
    const buildUtilityDeductionLinesRef = React.useRef(buildVisibleUtilityDeductionLines);
    const mergeDeductionBreakdownWithLinesRef = React.useRef(mergeDeductionBreakdownWithLines);
    const calculateWorkEntryTaxBreakdownRef = React.useRef(calculateWorkEntryTaxBreakdown);
    const rebuildDeductionBreakdownRef = React.useRef(rebuildDeductionBreakdown);
    const stripTemporaryDeductionLinesRef = React.useRef(stripTemporaryDeductionLines);
    const stripTemporaryTaxLinesRef = React.useRef(stripTemporaryTaxLines);
    const ledgerInputsRef = React.useRef(ledgerInputs);
    const ledgerRowsDataRef = React.useRef(ledgerRowsData);
    const utilityInputByPaymentRowKeyRef = React.useRef(utilityInputByPaymentRowKey);
    const utilityInputByWorkerMonthSingleRef = React.useRef(utilityInputByWorkerMonthSingle);
    const mergeUtilityInputRef = React.useRef(mergeUtilityInput);

    const clearApplyWatchdog = useCallback(() => {
        if (applyWatchdogRef.current !== null) {
            clearTimeout(applyWatchdogRef.current);
            applyWatchdogRef.current = null;
        }
    }, []);

    const markApplyStarted = useCallback((seq: number) => {
        setDeductionApplyError('');
        setDeductionApplyInProgress(true);
        clearApplyWatchdog();
        // 비정상 루프가 생겨도 오버레이가 영구 고정되지 않도록 최대 표시시간을 둔다.
        applyWatchdogRef.current = setTimeout(() => {
            if (applyRunSeqRef.current === seq) {
                setDeductionApplyInProgress(false);
                setDeductionApplyError('급여 공제 계산이 지연되고 있습니다. 다시 조회해 주세요.');
            }
            applyWatchdogRef.current = null;
        }, 15000);
    }, [clearApplyWatchdog]);

    const markApplyFinished = useCallback((seq: number) => {
        if (applyRunSeqRef.current !== seq) return;
        clearApplyWatchdog();
        setCompletedCalculationSequence(seq);
        setDeductionApplyInProgress(false);
    }, [clearApplyWatchdog]);

    React.useEffect(() => {
        basePaymentDataRef.current = basePaymentData;
        paymentDataRef.current = paymentData;
        payrollConfigRef.current = payrollConfig;
        normalizeTeamNameRef.current = normalizeTeamName;
        buildUtilityDeductionLinesRef.current = buildVisibleUtilityDeductionLines;
        mergeDeductionBreakdownWithLinesRef.current = mergeDeductionBreakdownWithLines;
        calculateWorkEntryTaxBreakdownRef.current = calculateWorkEntryTaxBreakdown;
        rebuildDeductionBreakdownRef.current = rebuildDeductionBreakdown;
        stripTemporaryDeductionLinesRef.current = stripTemporaryDeductionLines;
        stripTemporaryTaxLinesRef.current = stripTemporaryTaxLines;
        ledgerInputsRef.current = ledgerInputs;
        ledgerRowsDataRef.current = ledgerRowsData;
        utilityInputByPaymentRowKeyRef.current = utilityInputByPaymentRowKey;
        utilityInputByWorkerMonthSingleRef.current = utilityInputByWorkerMonthSingle;
        mergeUtilityInputRef.current = mergeUtilityInput;
    }, [basePaymentData, paymentData, payrollConfig, normalizeTeamName, ledgerInputs, ledgerRowsData, utilityInputByPaymentRowKey, utilityInputByWorkerMonthSingle, mergeUtilityInput]);

    React.useEffect(() => {
        return () => {
            applyRunSeqRef.current += 1;
            if (applyDebounceRef.current !== null) {
                clearTimeout(applyDebounceRef.current);
                applyDebounceRef.current = null;
            }
            clearApplyWatchdog();
        };
    }, [clearApplyWatchdog]);

    // 계산 대기 중 재조회가 끝나도 사용자가 마지막으로 선택한 설정을 유지한다.
    const requestedCalculationOptionsRef = useRef({
        applyInsurance: false,
        applyBusinessIncome: false,
        applyUtilities: true,
        applyDailyFee: false,
        applyInsuranceTeamSiteOnly: false,
    });
    const calculationScope = [startMonth, endMonth, selectedTeamId || 'all'].join('|');
    const userCalculationOptionsByScopeRef = useRef(new Map<string, typeof requestedCalculationOptionsRef.current>());

    const applyCalculatedDeductions = useCallback((params: {
        applyInsurance: boolean;
        applyBusinessIncome: boolean;
        applyUtilities: boolean;
        applyDailyFee: boolean;
        applyInsuranceTeamSiteOnly: boolean;
        immediate?: boolean;
        automatic?: boolean;
    }) => {
        const effectiveApplyUtilities = true;
        const config = payrollConfigRef.current;
        if ((params.applyInsurance || params.applyBusinessIncome || params.applyDailyFee) && !config) {
            alert('설정(4대보험/세율)을 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
            return;
        }

        requestedCalculationOptionsRef.current = {
            applyInsurance: params.applyInsurance,
            applyBusinessIncome: params.applyBusinessIncome,
            applyUtilities: effectiveApplyUtilities,
            applyDailyFee: params.applyDailyFee,
            applyInsuranceTeamSiteOnly: params.applyInsuranceTeamSiteOnly,
        };
        if (!params.automatic) userCalculationOptionsByScopeRef.current.set(calculationScope, requestedCalculationOptionsRef.current);
        setInsuranceApplied(params.applyInsurance);
        setInsuranceTeamSiteOnly(params.applyInsuranceTeamSiteOnly);
        setBusinessIncomeApplied(params.applyBusinessIncome);
        setUtilitiesApplied(effectiveApplyUtilities);
        setDailyFeeApplied(params.applyDailyFee);

        const runSeq = applyRunSeqRef.current + 1;
        applyRunSeqRef.current = runSeq;
        markApplyStarted(runSeq);

        if (applyDebounceRef.current !== null) {
            clearTimeout(applyDebounceRef.current);
            applyDebounceRef.current = null;
        }

        const delay = params.immediate ? 0 : 150;
        applyDebounceRef.current = setTimeout(() => {
            if (runSeq !== applyRunSeqRef.current) return;
            applyDebounceRef.current = null;

            try {
                const basePD = basePaymentDataRef.current;
                const ledgerInputsMap = ledgerInputsRef.current;
                const dailyFeePerManDay = Math.max(0, Math.floor(toNumber(config?.insuranceConfig?.dailyWorkerFeePerManDay ?? 0)));

                const ledgerEntriesMergedByMonthWorker = new Map<string, { team: string | undefined, input: any }[]>();
                Object.entries(ledgerInputsMap).forEach(([ledgerRowKey, manual]) => {
                    const parts = ledgerRowKey.split('__');
                    if (parts.length < 4) return;
                    const [month, workerId, , salaryModelStr] = parts;
                    const ledgerRow = ledgerRowsDataRef.current.find((row) => row.rowKey === ledgerRowKey);
                    const team = normalizeTeamNameRef.current(ledgerRow?.teamName);

                    const groupKey = `${month}__${workerId}__${salaryModelStr}`;
                    let group = ledgerEntriesMergedByMonthWorker.get(groupKey);
                    if (!group) {
                        group = [];
                        ledgerEntriesMergedByMonthWorker.set(groupKey, group);
                    }
                    group.push({ team, input: manual });
                });

                const paymentRowsCountByMonthWorker = new Map<string, number>();
                basePD.forEach((row) => {
                    const key = `${row.month}__${row.workerId}`;
                    paymentRowsCountByMonthWorker.set(key, (paymentRowsCountByMonthWorker.get(key) || 0) + 1);
                });


                const newPaymentData = basePD.map((item) => {
                    const calculationPolicy = resolvePayslipCalculationPolicy(item, {
                        applyInsurance: params.applyInsurance,
                        applyBusinessIncome: params.applyBusinessIncome,
                        applyDailyFee: params.applyDailyFee,
                    });
                    const sourceDeductionBreakdownRaw = stripTemporaryDeductionLinesRef.current(item.deductionBreakdown);
                    const baseTaxBreakdown = stripTemporaryTaxLinesRef.current(item.taxBreakdown);

                    const itemRowKey = item.id;
                    const direct = itemRowKey ? (ledgerInputsMap[itemRowKey] as any) : undefined;
                    const mapped = itemRowKey ? utilityInputByPaymentRowKeyRef.current.get(itemRowKey) : undefined;

                    let utilityInput: any = undefined;
                    if (direct) {
                        utilityInput = direct;
                    } else if (mapped) {
                        utilityInput = mapped;
                    } else {
                        const itemSalaryModel = item.id.endsWith('__일급제') ? '일급제' : '월급제';
                        const itemTeamNormalized = normalizeTeamNameRef.current(item.teamName);
                        const monthWorkerKey = `${item.month}__${item.workerId}__${itemSalaryModel}`;
                        const singleFallback = utilityInputByWorkerMonthSingleRef.current.get(monthWorkerKey);

                        const monthWorkerEntries = ledgerEntriesMergedByMonthWorker.get(monthWorkerKey) || [];

                        const teamMatchedInputs = monthWorkerEntries
                            .filter((entry) => !itemTeamNormalized || !entry.team || entry.team === itemTeamNormalized)
                            .map((entry) => entry.input);

                        if (teamMatchedInputs.length > 1) {
                            utilityInput = teamMatchedInputs.reduce((acc, cur) => mergeUtilityInputRef.current(acc, cur));
                        } else if (teamMatchedInputs.length === 1) {
                            utilityInput = teamMatchedInputs[0];
                        } else if (singleFallback) {
                            utilityInput = singleFallback;
                        } else {
                            const pRowsCount = paymentRowsCountByMonthWorker.get(`${item.month}__${item.workerId}`) || 0;
                            if (pRowsCount === 1 && monthWorkerEntries.length > 0) {
                                utilityInput = monthWorkerEntries
                                    .map((entry) => entry.input)
                                    .reduce((acc, cur) => mergeUtilityInputRef.current(acc, cur));
                            }
                        }
                    }

                    const utilityLines = effectiveApplyUtilities && utilityInput
                        ? buildUtilityDeductionLinesRef.current(utilityInput)
                        : [];
                    const dailyFeeLines = buildDailyFeeDeductionLines({
                        item,
                        applyDailyFee: calculationPolicy.applyDailyFee,
                        dailyFeePerManDay,
                    });
                    const deductionAppliedLines = [...utilityLines, ...dailyFeeLines];
                    const sourceDeductionBreakdown = ensureAdvanceLinesInBreakdown(
                        sourceDeductionBreakdownRaw,
                        utilityInput,
                        config
                    );
                    const rebasedDeductionBreakdown = rebuildDeductionBreakdownRef.current({
                        standardLines: (sourceDeductionBreakdown.standardLines ?? []).filter((line: DeductionLine) => !isAppliedUtilityOrFeeLabel(String(line.label ?? '').trim())),
                        additionalLines: (sourceDeductionBreakdown.additionalLines ?? []).filter((line: DeductionLine) => !isAppliedUtilityOrFeeLabel(String(line.label ?? '').trim())),
                    });

                    const nextDeductionBreakdown = (effectiveApplyUtilities || params.applyDailyFee)
                        ? mergeDeductionBreakdownWithLinesRef.current(rebasedDeductionBreakdown, deductionAppliedLines)
                        : sourceDeductionBreakdown;

                    let nextTaxBreakdown = rebuildDeductionBreakdownRef.current({
                        standardLines: [],
                        additionalLines: [...(baseTaxBreakdown.additionalLines ?? [])],
                    });
                    let taxRateSnapshot: any = undefined;
                    let insuranceAppliedSummary: any = undefined;
                    let withholdingAppliedSummary: any = undefined;
                    let businessIncomeAppliedSummary: any = undefined;

                    if (config && (calculationPolicy.applyInsurance || calculationPolicy.applyBusinessIncome)) {
                        const calculatedTax = calculateWorkEntryTaxBreakdownRef.current({
                            workEntries: item.workEntries ?? [],
                            payrollConfig: config,
                            applyInsurance: calculationPolicy.applyInsurance,
                            applyBusinessIncome: calculationPolicy.applyBusinessIncome,
                            normalizeSiteName: normalizeTeamNameRef.current,
                            withholdingThreshold: WITHHOLDING_MAX_MAN_DAY,
                            isInsuranceEligibleEntry: params.applyInsuranceTeamSiteOnly
                                ? (entry) => isEntryInWorkerTeamSite(entry, item.teamId, item.teamName)
                                : undefined,
                        });

                        nextTaxBreakdown = rebuildDeductionBreakdownRef.current({
                            standardLines: [],
                            additionalLines: [...(baseTaxBreakdown.additionalLines ?? []), ...calculatedTax.taxAdditionalLines],
                        });
                        taxRateSnapshot = calculatedTax.taxRateSnapshot;
                        insuranceAppliedSummary = calculatedTax.insuranceAppliedSummary;
                        withholdingAppliedSummary = calculatedTax.withholdingAppliedSummary;
                        businessIncomeAppliedSummary = calculatedTax.businessIncomeAppliedSummary;
                    }

                    const nextTotalDeduction = nextDeductionBreakdown.total + nextTaxBreakdown.total;
                    const nextTotalAmount = item.grossAmount - nextTotalDeduction;

                    if (
                        item.totalDeduction === nextTotalDeduction &&
                        item.totalAmount === nextTotalAmount &&
                        item.deductionBreakdown === nextDeductionBreakdown &&
                        item.taxBreakdown === nextTaxBreakdown &&
                        item.taxRateSnapshot === taxRateSnapshot &&
                        item.insuranceAppliedSummary === insuranceAppliedSummary &&
                        item.withholdingAppliedSummary === withholdingAppliedSummary &&
                        item.businessIncomeAppliedSummary === businessIncomeAppliedSummary
                    ) {
                        return item;
                    }

                    return {
                        ...item,
                        deductionBreakdown: nextDeductionBreakdown,
                        taxBreakdown: nextTaxBreakdown,
                        taxRateSnapshot,
                        insuranceAppliedSummary,
                        withholdingAppliedSummary,
                        businessIncomeAppliedSummary,
                        totalDeduction: nextTotalDeduction,
                        totalAmount: nextTotalAmount,
                    };
                });

                if (runSeq !== applyRunSeqRef.current) return;

                setPaymentData(newPaymentData);

                requestAnimationFrame(() => {
                    setTimeout(() => {
                        markApplyFinished(runSeq);
                    }, 0);
                });
            } catch (error) {
                console.error('Failed to apply calculated deductions:', error);
                setDeductionApplyError('급여 공제 계산에 실패했습니다. 다시 조회해 주세요.');
                markApplyFinished(runSeq);
            }
        }, delay);
    }, [
        calculationScope,
        isEntryInWorkerTeamSite,
        markApplyFinished,
        markApplyStarted,
        setPaymentData,
    ]);

    const batchTeamId = transferPicker?.batchJob?.teamId;
    const savedCalculationOptions = useMemo(() => {
        const settlements = transferPickerMode ? savedPayrollSettlements.map(settlement => ({
            ...settlement, teamId: resolveCanonicalTeamId(settlement.teamId) || settlement.teamId,
        })) : savedPayrollSettlements;
        return resolveSavedPayrollCalculationOptions(
            batchTeamId === undefined ? settlements : settlements.filter(settlement => settlement.teamId === batchTeamId),
            monthRangeSet, selectedTeamId || undefined,
        );
    }, [monthRangeSet, savedPayrollSettlements, selectedTeamId, batchTeamId, resolveCanonicalTeamId, transferPickerMode]);

    const appliedCalculationSourceRef = useRef<{
        data: typeof basePaymentData;
        config: typeof payrollConfig;
        calculate: typeof applyCalculatedDeductions;
    } | null>(null);

    useEffect(() => {
        if (loading || loadError || payrollSettlementLoading || payrollSettlementLoadError || payrollConfigLoading || payrollConfigLoadError) {
            applyRunSeqRef.current += 1;
            if (applyDebounceRef.current !== null) {
                clearTimeout(applyDebounceRef.current);
                applyDebounceRef.current = null;
            }
            clearApplyWatchdog();
            setDeductionApplyInProgress(false);
            // 취소한 계산은 조회가 끝난 뒤 최신 원본으로 다시 실행한다.
            appliedCalculationSourceRef.current = null;
            return;
        }
        if (!payrollConfig) return;

        const restorationKey = savedCalculationOptions ? [
            startMonth,
            endMonth,
            selectedTeamId || 'all',
            makePayrollCalculationOptionsSignature(savedCalculationOptions),
        ].join('|') : '';
        const shouldRestore = Boolean(savedCalculationOptions
            && restoredCalculationOptionsRef.current !== restorationKey
            && !userCalculationOptionsByScopeRef.current.has(calculationScope));
        restoredCalculationOptionsRef.current = restorationKey;

        const previous = appliedCalculationSourceRef.current;
        if (!shouldRestore && previous?.data === basePaymentData
            && previous.config === payrollConfig && previous.calculate === applyCalculatedDeductions) return;
        appliedCalculationSourceRef.current = { data: basePaymentData, config: payrollConfig, calculate: applyCalculatedDeductions };

        // 조회 결과는 세금 계산 전 원본이다. 저장 설정 복원 여부와 별개로
        // 새 원본에는 현재 적용 중인 설정을 다시 계산해야 한다.
        const options = userCalculationOptionsByScopeRef.current.get(calculationScope) ?? (shouldRestore && savedCalculationOptions ? {
            applyInsurance: savedCalculationOptions.insuranceApplied,
            applyInsuranceTeamSiteOnly: savedCalculationOptions.insuranceTeamSiteOnly,
            applyBusinessIncome: savedCalculationOptions.businessIncomeApplied,
            applyUtilities: savedCalculationOptions.utilitiesApplied,
            applyDailyFee: savedCalculationOptions.dailyFeeApplied,
        } : requestedCalculationOptionsRef.current);
        applyCalculatedDeductions({
            ...options,
            immediate: true,
            automatic: true,
        });
    }, [
        applyCalculatedDeductions,
        basePaymentData,
        calculationScope,
        clearApplyWatchdog,
        endMonth,
        loading,
        loadError,
        payrollConfig,
        payrollConfigLoading,
        payrollConfigLoadError,
        payrollSettlementLoading,
        payrollSettlementLoadError,
        savedCalculationOptions,
        selectedTeamId,
        startMonth,
    ]);

    const payslipContractorOptions = useMemo(() => {
        const names = new Set<string>(DEFAULT_PAYSLIP_CONTRACTOR_OPTIONS);
        companies.forEach((company) => {
            if (normalizeValue(company.type) !== '시공사') return;
            const name = String(company.name ?? '').trim();
            if (name) names.add(name);
        });
        return Array.from(names);
    }, [companies, normalizeValue]);

    const resolvedPayslipContractorName = useMemo(() => {
        if (payslipContractorOption === CUSTOM_PAYSLIP_CONTRACTOR_VALUE) {
            return customPayslipContractorName.trim() || DEFAULT_PAYSLIP_CONTRACTOR_NAME;
        }
        return payslipContractorOption.trim() || DEFAULT_PAYSLIP_CONTRACTOR_NAME;
    }, [customPayslipContractorName, payslipContractorOption]);

    const openPayslipPreview = useCallback(() => {
        if (!ensurePayrollReady()) return;
        if (filteredPaymentData.length === 0) return;

        // 명세서 모달 오픈 직전 최신 공제/세금 상태를 강제로 반영해 미리보기 표시와 계산값을 동기화한다.
        if (insuranceApplied || businessIncomeApplied || utilitiesApplied || dailyFeeApplied) {
            applyCalculatedDeductions({
                applyInsurance: insuranceApplied,
                applyBusinessIncome: businessIncomeApplied,
                applyUtilities: utilitiesApplied,
                applyDailyFee: dailyFeeApplied,
                applyInsuranceTeamSiteOnly: insuranceTeamSiteOnly,
                immediate: true, // 모달 오픈 전 즉시 반영
                automatic: true,
            });
        }

        const previewRows = payslipPaymentData.length > 0 ? payslipPaymentData : filteredPaymentData;
        if (payslipPaymentData.length === 0) setPayslipSalaryModelFilter('all');
        const defaultTarget = previewRows.find((item) => item.id.endsWith('__월급제')) ?? previewRows[0];
        setSelectedPayslipRowKey(defaultTarget.id);
        setShowPayslipModal(true);
    }, [
        applyCalculatedDeductions,
        businessIncomeApplied,
        dailyFeeApplied,
        filteredPaymentData,
        ensurePayrollReady,
        insuranceApplied,
        insuranceTeamSiteOnly,
        payslipPaymentData,
        utilitiesApplied,
    ]);

    const resolvedPayslipTarget = useMemo(() => {
        if (!payslipTarget) return null;
        // 확정본은 현재 공제 옵션을 다시 적용하지 않는다.
        if (finalizedSnapshotByPaymentId.has(payslipTarget.id)) return payslipTarget;
        if (!utilitiesApplied && !dailyFeeApplied) return payslipTarget;

        const baseRows = basePaymentData.length > 0 ? basePaymentData : paymentData;
        const payslipRowKey = payslipTarget.id;
        const baseItem = payslipRowKey
            ? baseRows.find((item) => item.id === payslipRowKey)
            : baseRows.find((item) => (
                item.month === payslipTarget.month
                && item.workerId === payslipTarget.workerId
                && normalizeTeamName(item.teamName) === normalizeTeamName(payslipTarget.teamName)
            ));

        // 기준 원본 행을 찾지 못하면 현재 계산값을 그대로 사용해 중복 병합을 방지한다.
        if (!baseItem) {
            return payslipTarget;
        }

        const utilityInput = resolveUtilityInputForPaymentItem(payslipTarget);

        const utilityLines = utilitiesApplied ? buildVisibleUtilityDeductionLines(utilityInput) : [];
        const dailyFeePerManDay = Math.max(0, Math.floor(toNumber(payrollConfig?.insuranceConfig?.dailyWorkerFeePerManDay ?? 0)));
        const dailyFeeLines = buildDailyFeeDeductionLines({
            item: payslipTarget,
            applyDailyFee: dailyFeeApplied,
            dailyFeePerManDay,
        });
        const deductionAppliedLines = [...utilityLines, ...dailyFeeLines];
            const sourceDeductionBreakdownRaw = stripTemporaryDeductionLines(baseItem.deductionBreakdown);
            const sourceDeductionBreakdown = ensureAdvanceLinesInBreakdown(
                sourceDeductionBreakdownRaw,
                utilityInput,
                payrollConfig
            );
            const baseDeductionBreakdown = rebuildDeductionBreakdown({
                standardLines: (sourceDeductionBreakdown.standardLines ?? []).filter((line: DeductionLine) => !isAppliedUtilityOrFeeLabel(String(line.label ?? '').trim())),
                additionalLines: (sourceDeductionBreakdown.additionalLines ?? []).filter((line: DeductionLine) => !isAppliedUtilityOrFeeLabel(String(line.label ?? '').trim())),
        });
        const nextDeductionBreakdown = mergeDeductionBreakdownWithLines(baseDeductionBreakdown, deductionAppliedLines);
        const nextTaxBreakdown = rebuildDeductionBreakdown({
            standardLines: [...(payslipTarget.taxBreakdown?.standardLines ?? [])],
            additionalLines: [...(payslipTarget.taxBreakdown?.additionalLines ?? [])],
        });
        const nextTotalDeduction = nextDeductionBreakdown.total + nextTaxBreakdown.total;
        const nextTotalAmount = payslipTarget.grossAmount - nextTotalDeduction;

        return {
            ...payslipTarget,
            deductionBreakdown: nextDeductionBreakdown,
            taxBreakdown: nextTaxBreakdown,
            totalDeduction: nextTotalDeduction,
            totalAmount: nextTotalAmount,
        };
    }, [
        basePaymentData,
        dailyFeeApplied,
        finalizedSnapshotByPaymentId,
        normalizeTeamName,
        paymentData,
        payrollConfig,
        payslipTarget,
        resolveUtilityInputForPaymentItem,
        utilitiesApplied,
    ]);

    const payslipIssueSummary = useMemo<PayslipIssueSummary>(
        () => validateMonthlyPayslipRows(payslipPaymentData),
        [payslipPaymentData]
    );

    const selectedPayslipIssueSummary = useMemo<PayslipIssueSummary>(
        () => validateMonthlyPayslipRows(resolvedPayslipTarget ? [resolvedPayslipTarget] : []),
        [resolvedPayslipTarget]
    );

    const selectedPayslipOutputId = resolvedPayslipTarget ? (payslipOutputIds[resolvedPayslipTarget.id] ?? '') : '';

    useEffect(() => {
        setPayslipExportNotice('');
    }, [resolvedPayslipTarget, showPayslipModal]);

    const ensurePayslipIssueReady = useCallback((rows: PaymentData[], actionLabel: string, confirmWarnings = false): boolean => {
        if (!ensurePayrollReady()) return false;
        const summary = validateMonthlyPayslipRows(rows);
        const topIssues = summary.issues.slice(0, 8).map(getPayslipIssueLabel).join('\n');
        setPayslipExportNotice('');

        if (summary.errorCount > 0) {
            alert([
                `${actionLabel} 전에 오류 ${summary.errorCount}건을 먼저 수정해야 합니다.`,
                topIssues,
            ].filter(Boolean).join('\n\n'));
            return false;
        }

        if (summary.warningCount > 0 && confirmWarnings) {
            return window.confirm([
                `${actionLabel} 전 확인이 필요한 항목 ${summary.warningCount}건이 있습니다. 계속 진행할까요?`,
                topIssues,
            ].filter(Boolean).join('\n\n'));
        }

        if (summary.warningCount > 0) {
            const notices = Array.from(new Set(summary.issues.map((issue) => issue.message)));
            setPayslipExportNotice(`${notices.join(' ')} 입력된 내용으로 출력할 수 있습니다.`);
        }

        return true;
    }, [ensurePayrollReady]);

    const buildPayslipOutputRecord = useCallback((
        item: PaymentData,
        deliveryMethod: 'confirm' | 'reissue' | 'image' | 'excel' | 'batch' | 'print'
    ): StatementOutputRecord => {
        const outputItem = {
            ...item,
            companyName: resolvedPayslipContractorName,
        };
        const validationSummary = validateMonthlyPayslipRows([outputItem]);
        const snapshot = buildMonthlyPayslipSnapshot(outputItem, {
            deliveryMethod,
            validationSummary,
            context: {
                rangeLabel,
                teamLabel: selectedTeamLabel,
                insuranceApplied,
                insuranceTeamSiteOnly,
                businessIncomeApplied,
                utilitiesApplied,
                dailyFeeApplied,
            },
        });

        return {
            source: 'monthly-wage',
            kind: 'labor',
            status: 'afterIssue',
            yearMonth: item.month,
            statementKey: item.id,
            targetTitle: item.workerName || '작업자',
            targetSubtitle: `${item.teamName || '-'} · ${item.month || '-'}`,
            clientCompanyName: resolvedPayslipContractorName || undefined,
            teamName: item.teamName || undefined,
            documentTitle: `${resolvePayslipSalaryModel(item) === 'daily' ? '일급제' : '월급제'} 노임명세서`,
            payrollRunId: finalizedSnapshotByPaymentId.get(item.id)?.settlementId || undefined,
            amountSummary: {
                manDay: item.totalManDay,
                supplyAmount: item.grossAmount,
                totalAmount: item.totalAmount,
            },
            optionPreset: 'afterIssue',
            optionSnapshot: {
                ruleVersion: PAYSLIP_ISSUE_RULE_VERSION,
                deliveryMethod,
                insuranceApplied,
                insuranceTeamSiteOnly,
                businessIncomeApplied,
                utilitiesApplied,
                dailyFeeApplied,
            },
            snapshot,
            issuedAt: new Date().toISOString(),
        };
    }, [
        businessIncomeApplied,
        dailyFeeApplied,
        finalizedSnapshotByPaymentId,
        insuranceApplied,
        insuranceTeamSiteOnly,
        rangeLabel,
        resolvedPayslipContractorName,
        selectedTeamLabel,
        utilitiesApplied,
    ]);

    const recordPayslipOutput = useCallback(async (
        item: PaymentData,
        deliveryMethod: 'confirm' | 'reissue' | 'image' | 'excel' | 'batch' | 'print'
    ) => {
        const id = await statementOutputService.upsertOutput(buildPayslipOutputRecord(item, deliveryMethod));
        setPayslipOutputIds((prev) => ({ ...prev, [item.id]: id }));
        setPayslipIssueMessage(`${item.workerName || '작업자'} 명세서 발행 이력을 문서대장에 기록했습니다.`);
        return id;
    }, [buildPayslipOutputRecord]);

    const handleIssueCurrentPayslip = useCallback(async () => {
        if (!resolvedPayslipTarget) return;
        const method = selectedPayslipOutputId ? 'reissue' : 'confirm';
        const actionLabel = selectedPayslipOutputId ? '재발행 기록' : '발행 확정';
        if (!ensurePayslipIssueReady([resolvedPayslipTarget], actionLabel, true)) return;

        setIssuingPayslip(true);
        try {
            await recordPayslipOutput(resolvedPayslipTarget, method);
        } catch (error) {
            console.error('[MonthlyWageDraftPage] payslip output save failed:', error);
            alert('명세서 발행 이력 저장 중 오류가 발생했습니다.');
        } finally {
            setIssuingPayslip(false);
        }
    }, [
        ensurePayslipIssueReady,
        recordPayslipOutput,
        resolvedPayslipTarget,
        selectedPayslipOutputId,
    ]);

    const fitPayslipPrintPages = useCallback(() => {
        const printRoot = document.getElementById('monthly-payslip-print-root');
        if (!printRoot) return;

        printRoot.setAttribute('data-print-measuring', 'true');
        const pages = Array.from(
            printRoot.querySelectorAll<HTMLElement>('.monthly-payslip-print-page')
        );

        pages.forEach((page) => {
            page.style.setProperty('--payslip-print-scale', '1');
            page.style.setProperty('--payslip-print-source-width', '194mm');
        });

        // Force the hidden print portal to use the same geometry as the print stylesheet.
        void printRoot.offsetHeight;

        pages.forEach((page) => {
            const card = page.querySelector<HTMLElement>('.payslip-template-card');
            if (!card) return;

            const pageWidth = page.clientWidth;
            const pageHeight = page.clientHeight;
            const baseScale = calculatePayslipPrintScale({
                pageWidth,
                pageHeight,
                contentWidth: Math.max(card.scrollWidth, card.offsetWidth),
                contentHeight: Math.max(card.scrollHeight, card.offsetHeight),
            });

            if (baseScale < 1) {
                page.style.setProperty(
                    '--payslip-print-source-width',
                    `${pageWidth / baseScale}px`
                );
                void card.offsetHeight;
            }

            const finalScale = calculatePayslipPrintScale({
                pageWidth,
                pageHeight,
                contentWidth: Math.max(card.scrollWidth, card.offsetWidth),
                contentHeight: Math.max(card.scrollHeight, card.offsetHeight),
            });
            page.style.setProperty('--payslip-print-scale', finalScale.toFixed(4));
        });

        printRoot.removeAttribute('data-print-measuring');
    }, []);

    const printPayslipRows = useCallback(async (rows: PaymentData[], actionLabel: string, fileName: string) => {
        if (rows.length === 0 || preparingPayslipPrint) return;
        if (!ensurePayslipIssueReady(rows, actionLabel)) return;

        setPreparingPayslipPrint(true);
        setPayslipPrintRows(rows);

        const originalTitle = document.title;
        try {
            // 인쇄 전용 React 트리와 웹폰트가 실제 DOM에 반영된 다음 인쇄 대화상자를 연다.
            await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
            if (document.fonts?.ready) {
                await document.fonts.ready;
            }
            fitPayslipPrintPages();
            document.title = fileName;
            window.print();
        } finally {
            document.title = originalTitle;
            setPayslipPrintRows([]);
            setPreparingPayslipPrint(false);
        }
    }, [ensurePayslipIssueReady, fitPayslipPrintPages, preparingPayslipPrint]);

    const handlePrintPayslip = useCallback(() => {
        if (!resolvedPayslipTarget) return;
        const safeWorkerName = (resolvedPayslipTarget.workerName || '작업자').replace(/[\\/:*?"<>|]/g, '_');
        void printPayslipRows(
            [resolvedPayslipTarget],
            '개별 PDF',
            `노임명세서_${safeWorkerName}_${resolvedPayslipTarget.month}`
        );
    }, [printPayslipRows, resolvedPayslipTarget]);

    const handleBatchPrintPayslips = useCallback(() => {
        if (payslipPaymentData.length === 0) {
            alert('인쇄할 명세서가 없습니다.');
            return;
        }
        if (
            payslipPaymentData.length > 50
            && !window.confirm(`총 ${payslipPaymentData.length}명의 명세서를 인쇄합니다. 계속 진행하시겠습니까?`)
        ) {
            return;
        }

        void printPayslipRows(
            payslipPaymentData,
            '일괄 PDF',
            `노임명세서_${payslipSalaryModelFilter === 'all' ? '전체' : payslipSalaryModelFilter === 'daily' ? '일급제' : '월급제'}_${rangeLabel || currentYearMonth}`
        );
    }, [currentYearMonth, payslipPaymentData, payslipSalaryModelFilter, printPayslipRows, rangeLabel]);

    const handleSaveInsuranceSettings = useCallback(async () => {
        const config = payrollConfig;
        if (!config) return;

        const thresholdDays = Math.floor(Number(insuranceThresholdManDayInput));
        if (!Number.isFinite(thresholdDays) || thresholdDays <= 0) {
            alert('보험 적용 기준 공수는 1 이상의 숫자여야 합니다.');
            return;
        }

        const pensionPercent = Number(pensionRatePercentInput);
        const healthPercent = Number(healthRatePercentInput);
        const carePercent = Number(careRateOfHealthPercentInput);
        const employmentPercent = Number(employmentRatePercentInput);
        const dailyWorkerFeePerManDay = Math.floor(Number(dailyWorkerFeePerManDayInput));
        const incomeTaxPercent = Number(incomeTaxRatePercentInput);
        const residentTaxPercent = Number(residentTaxRatePercentInput);
        const withholdingBaseDeductionWon = Math.floor(Number(withholdingBaseDeductionInput));
        const withholdingIncomeBaseMultiplierPercent = Number(withholdingIncomeBaseMultiplierPercentInput);

        const percentValues = [
            pensionPercent,
            healthPercent,
            carePercent,
            employmentPercent,
            incomeTaxPercent,
            residentTaxPercent,
            withholdingIncomeBaseMultiplierPercent,
        ];
        if (percentValues.some((v) => !Number.isFinite(v) || v < 0)) {
            alert('요율은 0 이상의 숫자여야 합니다.');
            return;
        }
        if (!Number.isFinite(withholdingBaseDeductionWon) || withholdingBaseDeductionWon < 0) {
            alert('갑근세 단가 공제기준은 0 이상의 숫자여야 합니다.');
            return;
        }
        if (!Number.isFinite(dailyWorkerFeePerManDay) || dailyWorkerFeePerManDay < 0) {
            alert('일급제 수수료 공수당 금액은 0 이상의 숫자여야 합니다.');
            return;
        }

        const nextInsurance: PayrollInsuranceConfig = {
            thresholdDays,
            pensionRate: pensionPercent / 100,
            healthRate: healthPercent / 100,
            careRateOfHealth: carePercent / 100,
            employmentRate: employmentPercent / 100,
            dailyWorkerFeePerManDay,
            withholdingBaseDeduction: withholdingBaseDeductionWon,
            withholdingIncomeBaseMultiplier: withholdingIncomeBaseMultiplierPercent / 100,
            withholdingIncomeTaxRate: incomeTaxPercent / 100,
            withholdingResidentTaxRate: residentTaxPercent / 100,
            withholdingApplyAllLabor: withholdingApplyAllLaborInput,
            employmentApplyBelowThreshold: employmentApplyBelowThresholdInput,
        };

        setInsuranceConfigSaving(true);
        try {
            await payrollConfigService.saveConfig({
                ...config,
                insuranceConfig: nextInsurance,
            });
            const latest = await payrollConfigService.getConfigFromServer();
            // 상태 반영을 기다리지 않고 아래 즉시 재계산에도 새 설정을 사용한다.
            payrollConfigRef.current = latest;
            setPayrollConfig(latest);
            setDeductionLabelMap(buildDeductionLabelMapFromConfig(latest?.deductionItems));
            setShowInsuranceSettings(false);

            if (insuranceApplied || businessIncomeApplied || utilitiesApplied || dailyFeeApplied) {
                applyCalculatedDeductions({
                    applyInsurance: insuranceApplied,
                    applyBusinessIncome: businessIncomeApplied,
                    applyUtilities: utilitiesApplied,
                    applyDailyFee: dailyFeeApplied,
                    applyInsuranceTeamSiteOnly: insuranceTeamSiteOnly,
                    immediate: true, // 설정 저장 후 즉시 반영
                });
            }
        } catch (error) {
            console.error('Failed to save insurance settings:', error);
            alert('설정 저장 중 오류가 발생했습니다.');
        } finally {
            setInsuranceConfigSaving(false);
        }
    }, [
        applyCalculatedDeductions,
        businessIncomeApplied,
        careRateOfHealthPercentInput,
        dailyFeeApplied,
        dailyWorkerFeePerManDayInput,
        employmentApplyBelowThresholdInput,
        employmentRatePercentInput,
        healthRatePercentInput,
        incomeTaxRatePercentInput,
        insuranceApplied,
        insuranceTeamSiteOnly,
        insuranceThresholdManDayInput,
        payrollConfig,
        pensionRatePercentInput,
        residentTaxRatePercentInput,
        utilitiesApplied,
        withholdingApplyAllLaborInput,
        withholdingBaseDeductionInput,
        withholdingIncomeBaseMultiplierPercentInput,
    ]);

    const constructionCompanyIds = useMemo(() => {
        const ids = new Set<string>();
        companies.forEach((company) => {
            const id = (company.id ?? '').trim();
            if (!id) return;
            if (normalizeValue(company.type) !== '시공사') return;
            ids.add(id);
        });
        return ids;
    }, [companies, normalizeValue]);

    useEffect(() => {
        const companyIdByNameNormalized = new Map<string, string>();
        companies.forEach((company) => {
            const id = (company.id ?? '').trim();
            if (!id) return;
            const key = normalizeTeamName(company.name);
            if (!key) return;
            if (!companyIdByNameNormalized.has(key)) {
                companyIdByNameNormalized.set(key, id);
            }
        });

        const filtered = allTeams
            .filter((t): t is Team & { id: string } => typeof t.id === 'string' && t.id.trim().length > 0)
            .filter((team) => {
                const companyIdRaw = (team.companyId ?? '').trim();
                const companyNameKey = normalizeTeamName(team.companyName);
                const companyId = companyIdRaw || (companyNameKey ? (companyIdByNameNormalized.get(companyNameKey) ?? '') : '');
                if (!companyId) return false;
                return constructionCompanyIds.has(companyId);
            })
            .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'ko'));

        setTeams(filtered);

        if (batchTeamId === undefined && selectedTeamId && !filtered.some((t) => t.id === selectedTeamId)) {
            setSelectedTeamId('');
        }
    }, [allTeams, companies, constructionCompanyIds, normalizeTeamName, selectedTeamId, batchTeamId]);

    useEffect(() => {
        if (filterMode !== 'team') return;
        if (!selectedTeamId) {
            setSelectedWorkerId('');
            return;
        }

        const belongsToSelected = allWorkers.some((w) => (w.id ?? '').trim() === selectedWorkerId);
        if (!belongsToSelected) {
            setSelectedWorkerId('');
        }
    }, [allWorkers, filterMode, selectedTeamId, selectedWorkerId]);

    useEffect(() => {
        if (filterMode === 'team') {
            setSelectedWorkerId('');
            setWorkerSearchText('');
            return;
        }

        setSelectedTeamId('');
    }, [filterMode]);

    const handleResetFilters = useCallback(() => {
        if (filterMode === 'team') {
            setSelectedTeamId('');
        } else {
            setSelectedWorkerId('');
            setWorkerSearchText('');
        }
        setTeamDropdownOpen(false);
        setExpandedRows(new Set());
    }, [filterMode]);

    const isLedgerInsuranceEligibleEntry = useCallback(
        (
            entry: MonthlyAdvanceLedgerWorkEntry,
            ledgerRow: Pick<MonthlyAdvanceLedgerRow, 'workerId' | 'teamId' | 'teamName' | 'month'>
        ): boolean => {
            const workerTeam = workerTeamByWorkerId.get(String(ledgerRow.workerId ?? '').trim());
            const workerTeamIdForMatch = workerTeam?.teamId || ledgerRow.teamId;
            const workerTeamNameForMatch = workerTeam?.teamName || ledgerRow.teamName;
            const normalizedEntry: WorkerWorkEntry = {
                date: String(entry.date ?? ledgerRow.month ?? '').trim() || ledgerRow.month,
                siteId: entry.siteId,
                siteName: String(entry.siteName ?? '').trim(),
                clientCompanyId: entry.clientCompanyId,
                isLaborSite: Boolean(entry.isLaborSite),
                paymentMethod: entry.paymentMethod,
                manDay: toNumber(entry.manDay),
                unitPrice: toNumber(entry.unitPrice),
                amount:
                    toNumber(entry.amount) > 0
                        ? toNumber(entry.amount)
                        : floorWon(toNumber(entry.manDay) * toNumber(entry.unitPrice)),
            };

            return isEntryInWorkerTeamSite(normalizedEntry, workerTeamIdForMatch, workerTeamNameForMatch);
        },
        [isEntryInWorkerTeamSite, workerTeamByWorkerId]
    );

    const allowedTeamIdsForWorkerFilter = useMemo(() => {
        if (!selectedTeamId) return null;

        const selectedTeamName = allTeams.find(t => t.id === selectedTeamId)?.name ?? '';
        const selectedTeamNameNormalized = normalizeTeamName(selectedTeamName);

        const ids = new Set<string>();
        ids.add(selectedTeamId);

        allTeams.forEach(team => {
            if (!team.id) return;
            if (team.parentTeamId === selectedTeamId) {
                ids.add(team.id);
                return;
            }
            if (selectedTeamNameNormalized) {
                const parentNameNormalized = normalizeTeamName(team.parentTeamName ?? '');
                if (parentNameNormalized && parentNameNormalized === selectedTeamNameNormalized) {
                    ids.add(team.id);
                }
            }
        });

        return ids;
    }, [allTeams, normalizeTeamName, selectedTeamId]);

    const workerOptions = useMemo(() => {
        const text = workerSearchText.trim().toLowerCase();
        const shouldIncludeDailyWage = pageViewMode !== 'standard';
        const rows = allWorkers
            .filter((w): w is Worker & { id: string } => typeof w.id === 'string' && w.id.trim().length > 0)
            .filter((w) => {
                const model = (w.payType ?? '').trim(); // salaryModel 완전 제거
                if (model === '월급제') return true;
                if (model === '용역팀') return true;
                if (shouldIncludeDailyWage && model === '일급제') return true;
                return false;
            })
            .filter((w) => {
                if (!allowedTeamIdsForWorkerFilter) return true;
                const workerTeamId = (w.teamId ?? '').trim();
                if (!workerTeamId) return false;
                return allowedTeamIdsForWorkerFilter.has(workerTeamId);
            })
            .filter((w) => {
                if (!text) return true;
                const name = (w.name ?? '').toLowerCase();
                return name.includes(text);
            })
            .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'ko'));

        return rows;
    }, [allWorkers, allowedTeamIdsForWorkerFilter, pageViewMode, workerSearchText]);

    // ★ 행별 표시 데이터 캐시 - 렌더 루프 안에서 매번 재계산하던 수십 개의 계산값을
    //    여기서 한 번만 처리한다. expandedRows 토글 같은 무관한 상태 변경 시 완전히 건너뜀.
    const rowDisplayCache = useMemo(() => {
        const cache = new Map<string, {
            deductionBreakdownForDisplay: DeductionBreakdown;
            advanceLinesForDisplay: DeductionLine[];
            nonAdvanceDeductionLinesForDisplay: DeductionLine[];
            advanceTotalForDisplay: number;
            nonAdvanceDeductionTotalForDisplay: number;
            hasNonAdvanceDeductionLines: boolean;
            hasAdvanceLines: boolean;
            taxLinesForItem: DeductionLine[];
            taxTotalForDisplay: number;
            totalDeductionForDisplay: number;
            totalAmountForDisplay: number;
            insuranceTaxLines: DeductionLine[];
            withholdingTaxLines: DeductionLine[];
            businessTaxLines: DeductionLine[];
            otherTaxLines: DeductionLine[];
            insuranceSectionTaxTotal: number;
            withholdingSectionTaxTotal: number;
            businessSectionTaxTotal: number;
            otherTaxTotal: number;
            insuranceAfterTaxAmount: number;
            withholdingGrossAmount: number;
            withholdingAfterTaxAmount: number;
            businessAfterTaxAmount: number;
            showInsuranceSection: boolean;
            hasInsuranceTargetSummary: boolean;
            withholdingDetailText: string;
        }>();

        const baseRows = basePaymentData.length > 0 ? basePaymentData : paymentData;
        const baseRowsById = new Map<string, PaymentData>();
        baseRows.forEach((row) => {
            baseRowsById.set(row.id, row);
        });

        const dailyFeePerManDay = Math.max(0, Math.floor(toNumber(payrollConfig?.insuranceConfig?.dailyWorkerFeePerManDay ?? 0)));

        filteredPaymentData.forEach((item) => {
            const isFinalizedSnapshot = finalizedSnapshotByPaymentId.has(item.id);
            const baseItemForDisplay = isFinalizedSnapshot
                ? item
                : baseRowsById.get(item.id) ?? item;

            // utility input 해결 (state 값 직접 사용)
            const directUtility = ledgerInputs[item.id] as LedgerUtilityInputLike | undefined;
            const mappedUtility = utilityInputByPaymentRowKey.get(item.id);
            let utilityInputForDisplay: LedgerUtilityInputLike | undefined = directUtility ?? mappedUtility;
            if (!utilityInputForDisplay) {
                const itemSalaryModel = item.id.endsWith('__일급제') ? '일급제' : '월급제';
                const monthWorkerKey = `${item.month}__${item.workerId}__${itemSalaryModel}`;
                utilityInputForDisplay = utilityInputByWorkerMonthSingle.get(monthWorkerKey);
            }

            const utilityLinesForDisplay = !isFinalizedSnapshot && utilitiesApplied
                ? buildVisibleUtilityDeductionLines(utilityInputForDisplay)
                : [];
            const dailyFeeLinesForDisplay = buildDailyFeeDeductionLines({
                item,
                applyDailyFee: !isFinalizedSnapshot && dailyFeeApplied,
                dailyFeePerManDay,
            });
            const deductionAppliedLines = [...utilityLinesForDisplay, ...dailyFeeLinesForDisplay];

            const sourceDeduction = isFinalizedSnapshot
                ? (baseItemForDisplay.deductionBreakdown ?? createEmptyDeductionBreakdown())
                : ensureAdvanceLinesInBreakdown(
                    stripTemporaryDeductionLines(baseItemForDisplay.deductionBreakdown),
                    utilityInputForDisplay,
                    payrollConfig
                );
            const baseDeduction = rebuildDeductionBreakdown({
                standardLines: (sourceDeduction.standardLines ?? []).filter((line: DeductionLine) => !isAppliedUtilityOrFeeLabel(String(line.label ?? '').trim())),
                additionalLines: (sourceDeduction.additionalLines ?? []).filter((line: DeductionLine) => !isAppliedUtilityOrFeeLabel(String(line.label ?? '').trim())),
            });
            const deductionBreakdownForDisplay = isFinalizedSnapshot
                ? sourceDeduction
                : (utilitiesApplied || dailyFeeApplied)
                ? mergeDeductionBreakdownWithLines(baseDeduction, deductionAppliedLines)
                : sourceDeduction;

            const deductionLines = [
                ...(deductionBreakdownForDisplay.standardLines ?? []),
                ...(deductionBreakdownForDisplay.additionalLines ?? []),
            ];
            const advanceLinesForDisplay = deductionLines.filter((line) =>
                advanceLabelSet.has(normalizeLineLabel(String(line?.label ?? '')))
            );
            const nonAdvanceDeductionLinesForDisplay = deductionLines.filter((line) =>
                !advanceLabelSet.has(normalizeLineLabel(String(line?.label ?? '')))
            );
            const advanceTotalForDisplay = advanceLinesForDisplay.reduce((sum, l) => sum + toNumber(l.amount), 0);
            const nonAdvanceDeductionTotalForDisplay = nonAdvanceDeductionLinesForDisplay.reduce((sum, l) => sum + toNumber(l.amount), 0);

            const taxLinesForItem = isFinalizedSnapshot
                ? [
                    ...(item.taxBreakdown?.standardLines ?? []),
                    ...(item.taxBreakdown?.additionalLines ?? []),
                ]
                : getTaxLinesForItem(item);
            const taxTotalForDisplay = taxLinesForItem.reduce((sum, l) => sum + toNumber(l.amount), 0);
            const totalDeductionForDisplay = isFinalizedSnapshot
                ? toNumber(item.totalDeduction)
                : deductionBreakdownForDisplay.total + taxTotalForDisplay;
            const totalAmountForDisplay = isFinalizedSnapshot
                ? toNumber(item.totalAmount)
                : item.grossAmount - totalDeductionForDisplay;

            const insuranceTaxLines: DeductionLine[] = [];
            const withholdingTaxLines: DeductionLine[] = [];
            const businessTaxLines: DeductionLine[] = [];
            const otherTaxLines: DeductionLine[] = [];

            let insuranceSectionTaxTotal = 0;
            let withholdingSectionTaxTotal = 0;
            let businessSectionTaxTotal = 0;
            let otherTaxTotal = 0;

            taxLinesForItem.forEach((line) => {
                const amount = toNumber(line.amount);
                if (isInsuranceSectionTaxLabel(line.label)) {
                    insuranceTaxLines.push(line);
                    insuranceSectionTaxTotal += amount;
                    return;
                }
                if (isWithholdingSectionTaxLabel(line.label)) {
                    withholdingTaxLines.push(line);
                    withholdingSectionTaxTotal += amount;
                    return;
                }
                if (isBusinessSectionTaxLabel(line.label)) {
                    businessTaxLines.push(line);
                    businessSectionTaxTotal += amount;
                    return;
                }
                otherTaxLines.push(line);
                otherTaxTotal += amount;
            });

            const insuranceAfterTaxAmount = Math.max(0, Math.floor((item.insuranceAppliedSummary?.appliedAmount ?? 0) - insuranceSectionTaxTotal));
            const withholdingGrossAmount = item.withholdingAppliedSummary
                ? toNumber(item.withholdingAppliedSummary.grossAmount ?? item.withholdingAppliedSummary.appliedAmount)
                : 0;
            const withholdingAfterTaxAmount = Math.max(0, Math.floor(withholdingGrossAmount - withholdingSectionTaxTotal));
            const businessAfterTaxAmount = Math.max(0, Math.floor((item.businessIncomeAppliedSummary?.appliedAmount ?? 0) - businessSectionTaxTotal));

            cache.set(item.id, {
                deductionBreakdownForDisplay,
                advanceLinesForDisplay,
                nonAdvanceDeductionLinesForDisplay,
                advanceTotalForDisplay,
                nonAdvanceDeductionTotalForDisplay,
                hasNonAdvanceDeductionLines: nonAdvanceDeductionLinesForDisplay.length > 0,
                hasAdvanceLines: advanceLinesForDisplay.length > 0,
                taxLinesForItem,
                taxTotalForDisplay,
                totalDeductionForDisplay,
                totalAmountForDisplay,
                insuranceTaxLines,
                withholdingTaxLines,
                businessTaxLines,
                otherTaxLines,
                insuranceSectionTaxTotal,
                withholdingSectionTaxTotal,
                businessSectionTaxTotal,
                otherTaxTotal,
                insuranceAfterTaxAmount,
                withholdingGrossAmount,
                withholdingAfterTaxAmount,
                businessAfterTaxAmount,
                showInsuranceSection: insuranceTaxLines.length > 0,
                hasInsuranceTargetSummary: Boolean(item.insuranceAppliedSummary && item.insuranceAppliedSummary.appliedManDay > 0),
                withholdingDetailText: resolveWithholdingDetailText(item.taxRateSnapshot),
            });
        });

        return cache;
    }, [
        advanceLabelSet,
        basePaymentData,
        dailyFeeApplied,
        finalizedSnapshotByPaymentId,
        filteredPaymentData,
        ledgerInputs,
        paymentData,
        payrollConfig,
        utilityInputByPaymentRowKey,
        utilityInputByWorkerMonthSingle,
        utilitiesApplied,
    ]);

    const normalizeBankKey = useCallback(normalizePayrollBankKey, []);

    const bankCodeByName = useMemo(() => {
        const map = new Map<string, string>();

        Object.entries(BANK_CODES).forEach(([k, v]) => {
            const key = String(k ?? '').trim();
            const value = String(v ?? '').trim();

            if (/^\d{3}$/.test(key)) {
                // code -> name 형태
                const normalizedName = normalizeBankKey(value);
                if (normalizedName) map.set(normalizedName, key);
                return;
            }

            if (/^\d{3}$/.test(value)) {
                // name -> code 형태
                const normalizedName = normalizeBankKey(key);
                if (normalizedName) map.set(normalizedName, value);
            }
        });

        // 자주 입력되는 별칭 보정
        map.set('국민', '004');
        map.set('국민은행', '004');
        map.set('KB국민', '004');
        map.set('KB국민은행', '004');

        return map;
    }, [normalizeBankKey]);

    const bankNameKeyEntries = useMemo(() => {
        const entries: Array<{ nameKey: string; code: string }> = [];
        Object.entries(BANK_CODES).forEach(([k, v]) => {
            const code = String(k ?? '').trim();
            const name = String(v ?? '').trim();
            if (!/^\d{3}$/.test(code)) return;
            const normalizedName = normalizeBankKey(name);
            if (!normalizedName) return;
            entries.push({ nameKey: normalizedName, code });

            const withoutBank = normalizeBankKey(name.replace(/은행|증권|중앙회|저축은행/g, ''));
            if (withoutBank && withoutBank !== normalizedName) {
                entries.push({ nameKey: withoutBank, code });
            }
        });

        entries.sort((a, b) => b.nameKey.length - a.nameKey.length);
        return entries;
    }, [normalizeBankKey]);

    const resolveBankCode = useCallback(resolvePayrollBankCode, []);

    const analyzeBankMapping = useCallback((bankName?: string, bankCode?: string): {
        code: string;
        reason: string;
        candidates: string[];
    } => {
        const explicitCode = String(bankCode ?? '').trim();
        if (/^\d{3}$/.test(explicitCode)) {
            return { code: explicitCode, reason: '', candidates: [] };
        }

        const rawBankName = String(bankName ?? '').trim();
        if (/^\d{3}$/.test(rawBankName)) {
            return { code: rawBankName, reason: '', candidates: [] };
        }

        const normalizedName = normalizeBankKey(bankName);
        if (!normalizedName) {
            return {
                code: '',
                reason: '은행명이 비어있거나 형식이 올바르지 않습니다.',
                candidates: []
            };
        }

        const exact = bankCodeByName.get(normalizedName);
        if (exact) {
            return { code: exact, reason: '', candidates: [] };
        }

        const candidateCodes = new Set<string>();
        bankNameKeyEntries.forEach(({ nameKey, code }) => {
            if (!nameKey) return;
            if (normalizedName.includes(nameKey) || nameKey.includes(normalizedName)) {
                candidateCodes.add(code);
            }
        });

        if (candidateCodes.size === 1) {
            return { code: Array.from(candidateCodes)[0], reason: '', candidates: [] };
        }

        if (candidateCodes.size > 1) {
            const ranked = Array.from(candidateCodes)
                .map((code) => {
                    const officialName = String(BANK_CODES[code] ?? '');
                    const officialKey = normalizeBankKey(officialName);

                    let score = 0;
                    if (/은행|뱅크/.test(officialName)) score += 40;
                    if (/저축은행/.test(officialName)) score -= 15;
                    if (/증권|선물/.test(officialName)) score -= 20;

                    if (officialKey === normalizedName) score += 50;
                    else if (officialKey.startsWith(normalizedName)) score += 20;
                    else if (officialKey.includes(normalizedName)) score += 10;

                    return { code, score };
                })
                .sort((a, b) => b.score - a.score);

            if (ranked[0] && (ranked.length === 1 || ranked[0].score > ranked[1].score)) {
                return { code: ranked[0].code, reason: '', candidates: [] };
            }

            return {
                code: '',
                reason: '유사 은행 후보가 여러 개여서 자동 매핑을 보류했습니다.',
                candidates: ranked.slice(0, 4).map((r) => `${r.code}:${BANK_CODES[r.code]}`),
            };
        }

        return {
            code: '',
            reason: '등록된 은행명/별칭과 일치하는 코드가 없습니다.',
            candidates: []
        };
    }, [bankCodeByName, bankNameKeyEntries, normalizeBankKey]);





    const validateItem = useCallback((item: Partial<PaymentData>): { isValid: boolean, errors: PaymentData['errors'] } => {
        const errors: PaymentData['errors'] = {};
        let isValid = true;

        if (!item.bankName) {
            errors.bankName = true;
            isValid = false;
        }
        if (!resolveBankCode(item.bankName, item.bankCode)) {
            if (item.bankName) {
                errors.bankCode = true;
                isValid = false;
            }
        }
        if (!item.accountNumber) {
            errors.accountNumber = true;
            isValid = false;
        }
        if (!item.accountHolder) {
            errors.accountHolder = true;
            isValid = false;
        }

        return { isValid, errors };
    }, [resolveBankCode]);
    void [
        buildUtilityDeductionLines,
        sumInsuranceSectionTax,
        sumWithholdingSectionTax,
        sumBusinessSectionTax,
        buildDeductionBreakdownFromRecords,
        handleResetFilters,
        validateItem,
    ];

    const toggleRow = (itemId: string) => {
        const key = itemId;
        setExpandedRows(prev => {
            const next = new Set(prev);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            return next;
        });
    };

    const handleDisplayContentChange = (itemId: string, value: string) => {
        setPaymentData(prev => prev.map(item => {
            if (item.id !== itemId) return item;
            return { ...item, displayContent: value };
        }));
    };

    const handleBulkDisplayContentApply = () => {
        const visibleKeys = new Set(filteredPaymentData.map(item => item.id));
        setPaymentData(prev => prev.map(item => {
            if (!visibleKeys.has(item.id)) return item;
            return { ...item, displayContent: bulkDisplayContent };
        }));
    };

    const resolveDisplayTotalAmount = (item: PaymentData): number => {
        const rowDisplay = rowDisplayCache.get(item.id);
        return rowDisplay ? rowDisplay.totalAmountForDisplay : toNumber(item.totalAmount);
    };

    const resolveDisplayInvoiceNetAmount = (item: PaymentData): number => {
        const displayTotal = resolveDisplayTotalAmount(item);
        const invoiceNet = toNumber(item.invoiceNetAmount);
        const laborNet = toNumber(item.laborNetAmount);
        const splitBase = invoiceNet + laborNet;
        if (splitBase <= 0) return invoiceNet;
        return Math.round(displayTotal * (invoiceNet / splitBase));
    };

    const resolveDisplayLaborNetAmount = (item: PaymentData): number => {
        const displayTotal = resolveDisplayTotalAmount(item);
        return displayTotal - resolveDisplayInvoiceNetAmount(item);
    };

    // The simplified closing view only summarizes values already calculated by
    // the existing payroll screen. Once a run is confirmed, its saved payment
    // snapshot takes precedence so source-data edits cannot change this view.
    const simplePayrollClosingRows = useMemo<SimplePayrollClosingRow[]>(() => (
        filteredPaymentData.map((item) => {
            const finalized = finalizedSnapshotByPaymentId.get(item.id);
            if (finalized) {
                const { payment, row } = finalized;
                return {
                    id: payment.id,
                    month: String(payment.month ?? row.yearMonth ?? '').trim(),
                    workerName: String(payment.workerName ?? row.workerName ?? '').trim(),
                    teamName: String(payment.teamName ?? row.teamName ?? '').trim(),
                    totalManDay: Math.max(0, toNumber(row.totalManDay ?? payment.totalManDay)),
                    grossAmount: Math.max(0, toNumber(row.grossAmount ?? payment.grossAmount)),
                    personalDeduction: Math.max(0, toNumber(row.personalDeduction)),
                    taxDeduction: Math.max(0, toNumber(row.taxDeduction)),
                    totalDeduction: Math.max(0, toNumber(row.totalDeduction ?? payment.totalDeduction)),
                    netAmount: toNumber(row.netAmount ?? payment.totalAmount),
                    isValid: row.isValid !== false,
                    isSnapshot: true,
                };
            }

            const rowDisplay = rowDisplayCache.get(item.id);
            const personalDeduction = Math.max(
                0,
                toNumber(rowDisplay?.deductionBreakdownForDisplay.total ?? item.deductionBreakdown?.total)
            );
            const taxDeduction = Math.max(0, toNumber(rowDisplay?.taxTotalForDisplay));
            const totalDeduction = rowDisplay
                ? Math.max(0, toNumber(rowDisplay.totalDeductionForDisplay))
                : personalDeduction + taxDeduction;

            return {
                id: item.id,
                month: String(item.month ?? '').trim(),
                workerName: String(item.workerName ?? '').trim(),
                teamName: String(item.teamName ?? '').trim(),
                totalManDay: Math.max(0, toNumber(item.totalManDay)),
                grossAmount: Math.max(0, toNumber(item.grossAmount)),
                personalDeduction,
                taxDeduction,
                totalDeduction,
                netAmount: rowDisplay
                    ? toNumber(rowDisplay.totalAmountForDisplay)
                    : toNumber(item.totalAmount),
                isValid: Boolean(item.isValid),
                isSnapshot: false,
            };
        })
    ), [filteredPaymentData, finalizedSnapshotByPaymentId, rowDisplayCache]);

    const resolveLedgerComputedAmountForPaymentItem = (
        item: PaymentData
    ): MonthlyAdvanceLedgerComputedAmount | undefined => {
        const salaryModel = item.id.endsWith('__일급제')
            ? '일급제'
            : item.id.endsWith('__용역팀')
                ? '용역팀'
                : '월급제';
        const ledgerRow = ledgerRows.find((row) => (
            row.month === item.month
            && row.workerId === item.workerId
            && row.teamId === item.teamId
            && String(row.salaryModel ?? '월급제') === salaryModel
        ));
        const rowKey = String(ledgerRow?.rowKey ?? '').trim();
        return rowKey ? ledgerComputedAmountByRowKey.get(rowKey) : undefined;
    };

    const resolveKBAdvanceAmounts = (item: PaymentData) => {
        const manual = finalizedSnapshotByPaymentId.get(item.id)?.row.manualInput
            ?? resolveUtilityInputForPaymentItem(item);
        const toSafeNumber = (value: unknown): number => (
            typeof value === 'number' && Number.isFinite(value) ? value : 0
        );
        const sumSideAdvances = (side: LedgerManualInput['invoice'] | undefined): number => (
            toSafeNumber(side?.carry)
            + toSafeNumber(side?.carrySecond)
            + toSafeNumber(side?.currentAdvance)
            + toSafeNumber(side?.currentAdvanceSecond)
        );
        const getAdvanceItem = (
            side: LedgerManualInput['invoice'] | undefined,
            field: 'carry' | 'carrySecond' | 'currentAdvance' | 'currentAdvanceSecond'
        ): number => toSafeNumber(side?.[field]);

        return {
            invoiceAdvance: manual ? sumSideAdvances(manual.invoice) : 0,
            laborAdvance: manual ? sumSideAdvances(manual.labor) : 0,
            corporateAdvance1: manual ? getAdvanceItem(manual.invoice, 'carry') : 0,
            corporateAdvance2: manual ? getAdvanceItem(manual.invoice, 'carrySecond') : 0,
            corporateAdvance3: manual ? getAdvanceItem(manual.invoice, 'currentAdvance') : 0,
            corporateAdvance4: manual ? getAdvanceItem(manual.invoice, 'currentAdvanceSecond') : 0,
            laborAdvance1: manual ? getAdvanceItem(manual.labor, 'carry') : 0,
            laborAdvance2: manual ? getAdvanceItem(manual.labor, 'carrySecond') : 0,
            laborAdvance3: manual ? getAdvanceItem(manual.labor, 'currentAdvance') : 0,
            laborAdvance4: manual ? getAdvanceItem(manual.labor, 'currentAdvanceSecond') : 0,
        };
    };

    const buildKBPreviewSourceRows = (): KBPreviewSourceRow[] => {
        return kbSourcePaymentData.map((item) => {
            const finalized = finalizedSnapshotByPaymentId.get(item.id);
            const advances = resolveKBAdvanceAmounts(item);
            const ledgerAmount = resolveLedgerComputedAmountForPaymentItem(item);
            const display = rowDisplayCache.get(item.id);
            const salaryLabel = item.id.endsWith('__일급제')
                ? '일급제'
                : item.id.endsWith('__용역팀')
                    ? '용역팀'
                    : '월급제';

            return {
                sourceRowId: item.id,
                month: item.month,
                teamName: item.teamName,
                workerName: item.workerName,
                salaryLabel,
                bankCode: item.bankCode,
                bankName: item.bankName,
                accountNumber: item.accountNumber,
                accountHolder: item.accountHolder,
                totalAmount: resolveDisplayTotalAmount(item),
                payrollDetail: buildPayrollTransferDetail({
                    ...item,
                    totalAmount: resolveDisplayTotalAmount(item),
                    totalDeduction: display?.totalDeductionForDisplay ?? item.totalDeduction,
                    deductionBreakdown: display?.deductionBreakdownForDisplay ?? item.deductionBreakdown,
                    taxBreakdown: display ? { standardLines: display.taxLinesForItem, additionalLines: [] } : item.taxBreakdown,
                }, { salaryLabel, amountBasis: '현재 화면 실지급액', originalAmount: resolveDisplayTotalAmount(item), isFinalized: Boolean(finalized) }),
                invoiceNetAmount: finalized
                    ? toNumber(finalized.row.invoiceNetAmount)
                    : ledgerAmount
                    ? (ledgerAmount.allocationMode === 'corporate' ? ledgerAmount.corporateNet : 0)
                    : resolveDisplayInvoiceNetAmount(item),
                laborNetAmount: finalized
                    ? toNumber(finalized.row.laborNetAmount)
                    : ledgerAmount
                    ? (ledgerAmount.allocationMode === 'labor' ? ledgerAmount.personalNet : 0)
                    : resolveDisplayLaborNetAmount(item),
                ...advances,
            };
        });
    };

    const resolveKBSourceAmount = (row: KBPreviewSourceRow, amountType: KBAmountType): number => {
        if (amountType === 'invoiceNet') return row.invoiceNetAmount;
        if (amountType === 'laborNet') return row.laborNetAmount;
        if (amountType === 'invoiceAdvance') return row.invoiceAdvance;
        if (amountType === 'laborAdvance') return row.laborAdvance;
        if (amountType === 'corporateAdvance1') return row.corporateAdvance1;
        if (amountType === 'corporateAdvance2') return row.corporateAdvance2;
        if (amountType === 'corporateAdvance3') return row.corporateAdvance3;
        if (amountType === 'corporateAdvance4') return row.corporateAdvance4;
        if (amountType === 'laborAdvance1') return row.laborAdvance1;
        if (amountType === 'laborAdvance2') return row.laborAdvance2;
        if (amountType === 'laborAdvance3') return row.laborAdvance3;
        if (amountType === 'laborAdvance4') return row.laborAdvance4;
        return row.totalAmount;
    };

    const sanitizeKBExcelText = (value: unknown): string => String(value ?? '').replace(/\r?\n/g, ' ').trim();

    const formatKBGeneratedAt = (iso: string): string => {
        const date = new Date(iso);
        if (Number.isNaN(date.getTime())) return '-';
        return date.toLocaleString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });
    };

    const getKBDeductionStatusLabel = (): string => {
        return [
            `4대보험 ${insuranceApplied ? '적용' : '해제'}`,
            `해당팀 ${insuranceTeamSiteOnly ? '적용' : '해제'}`,
            `사업소득 ${businessIncomeApplied ? '적용' : '해제'}`,
            `공과금 ${utilitiesApplied ? '적용' : '해제'}`,
            `수수료 ${dailyFeeApplied ? '적용' : '해제'}`,
        ].join(' / ');
    };

    const getKBTargetLabel = (): string => {
        if (filterMode === 'worker') {
            if (!selectedWorkerId) return '개인전체';
            const worker = workerOptions.find((item) => item.id === selectedWorkerId);
            return worker?.name || '선택 개인';
        }
        return selectedTeamLabel || '팀전체';
    };

    const getKBAmountTypeDisplayLabel = (amountType: KBAmountType): string => {
        const labels = { ...DEFAULT_ADVANCE_ITEM_LABELS, ...(payrollConfig?.advanceItemLabels ?? {}) };
        if (amountType === 'corporateAdvance1') return labels.corporateAdvance1;
        if (amountType === 'corporateAdvance2') return labels.corporateAdvance2;
        if (amountType === 'corporateAdvance3') return labels.corporateAdvance3;
        if (amountType === 'corporateAdvance4') return labels.corporateAdvance4;
        if (amountType === 'laborAdvance1') return labels.laborAdvance1;
        if (amountType === 'laborAdvance2') return labels.laborAdvance2;
        if (amountType === 'laborAdvance3') return labels.laborAdvance3;
        if (amountType === 'laborAdvance4') return labels.laborAdvance4;
        return getKBAmountTypeLabel(amountType);
    };

    const buildKBTransferRowsFromSources = (
        sourceRows: KBPreviewSourceRow[],
        amountType: KBAmountType,
        receiverDisplay: string,
        memoSuffix: string,
        primaryAccountRowIds: Set<string>
    ): { rows: KBTransferRow[]; excludedRows: KBExcludedTransferRow[] } => {
        const rows: KBTransferRow[] = [];
        const excludedRows: KBExcludedTransferRow[] = [];

        sourceRows.forEach((sourceRow) => {
            const amount = resolveKBSourceAmount(sourceRow, amountType);
            if (!Number.isFinite(amount) || amount <= 0) {
                excludedRows.push({
                    sourceRowId: sourceRow.sourceRowId,
                    month: sourceRow.month,
                    teamName: sourceRow.teamName,
                    workerName: sourceRow.workerName,
                    salaryLabel: sourceRow.salaryLabel,
                    amount: Number.isFinite(amount) ? amount : 0,
                    reason: '이체금액 0원 이하',
                });
                return;
            }

            const usesPrimaryAccount = Boolean(primaryAccount && primaryAccountRowIds.has(sourceRow.sourceRowId));
            const bankName = usesPrimaryAccount ? primaryAccount?.bankName ?? '' : sourceRow.bankName;
            const accountNumber = usesPrimaryAccount ? primaryAccount?.accountNumber ?? '' : sourceRow.accountNumber;
            const accountHolder = usesPrimaryAccount ? primaryAccount?.accountHolder ?? '' : sourceRow.accountHolder;
            const bankCode = usesPrimaryAccount ? '' : sourceRow.bankCode;
            const analysis = analyzeBankMapping(bankName, bankCode);
            const rawBankName = String(bankName ?? '').trim();
            const bankCodeDisplay = analysis.code || rawBankName || '(은행명없음)';
            const validationErrors = validateKBTransferRow({
                bankCode: analysis.code,
                accountNumber,
                accountHolder,
                amount,
            }).filter((error) => error !== 'amount');

            rows.push({
                sourceRowId: sourceRow.sourceRowId,
                month: sourceRow.month,
                teamName: sourceRow.teamName,
                workerName: sourceRow.workerName,
                salaryLabel: sourceRow.salaryLabel,
                bankCode: analysis.code,
                bankCodeDisplay,
                bankCodeUnmapped: !analysis.code,
                bankCodeNeedsFix: validationErrors.includes('bankCode'),
                bankCodeReason: analysis.reason,
                bankCodeCandidates: analysis.candidates.join(', '),
                bankName,
                accountNumber,
                accountHolder,
                amount,
                receiverDisplay,
                senderMemo: formatKBTransferMemo(memoSuffix, sourceRow.workerName),
                usesPrimaryAccount,
                validationErrors,
                payrollDetail: sourceRow.payrollDetail ? { ...sourceRow.payrollDetail, amountBasis: getKBAmountTypeDisplayLabel(amountType), originalAmount: amount } : undefined,
            });
        });

        return { rows, excludedRows };
    };

    const buildKBPreviewSnapshot = (
        sourceRows: KBPreviewSourceRow[],
        amountType: KBAmountType,
        receiverDisplay: string,
        memoSuffix: string,
        createdAtIso = new Date().toISOString(),
        primaryAccountRowIds = kbPrimaryAccountAppliedRowIds
    ): KBPreviewSnapshot => {
        const { rows, excludedRows } = buildKBTransferRowsFromSources(
            sourceRows,
            amountType,
            receiverDisplay,
            memoSuffix,
            primaryAccountRowIds
        );
        const summary = summarizeKBTransferRows(rows, excludedRows.length);

        return {
            createdAtIso,
            primaryAccount,
            sourceRows,
            rows,
            excludedRows,
            criteria: {
                generatedAt: formatKBGeneratedAt(createdAtIso),
                rangeLabel: rangeLabel || currentYearMonth,
                teamLabel: selectedTeamLabel || '팀전체',
                targetLabel: getKBTargetLabel(),
                salaryFilterLabel: pageViewMode === 'ledger'
                    ? getKBSalaryModelFilterLabel(ledgerSalaryModelFilter)
                    : '기본목록 전체',
                deductionStatusLabel: getKBDeductionStatusLabel(),
                amountTypeLabel: getKBAmountTypeDisplayLabel(amountType),
                sourceCount: sourceRows.length,
                exportCount: summary.rowCount,
                excludedCount: summary.excludedCount,
                totalAmount: summary.totalAmount,
            },
        };
    };

    const updateKBPreviewSnapshotFromControls = (overrides: Partial<{
        amountType: KBAmountType;
        receiverDisplay: string;
        memoSuffix: string;
    }>) => {
        setKbPreviewSnapshot((prev) => {
            if (!prev) return prev;
            return buildKBPreviewSnapshot(
                prev.sourceRows,
                overrides.amountType ?? kbAmountType,
                overrides.receiverDisplay ?? kbReceiverDisplay,
                overrides.memoSuffix ?? kbMemoSuffix,
                prev.createdAtIso,
                kbPrimaryAccountAppliedRowIds
            );
        });
    };

    const rebuildKBPreviewWithPrimaryRows = (nextAppliedRowIds: Set<string>) => {
        setKbPrimaryAccountAppliedRowIds(nextAppliedRowIds);
        setKbPreviewSnapshot((current) => current
            ? buildKBPreviewSnapshot(
                current.sourceRows,
                kbAmountType,
                kbReceiverDisplay,
                kbMemoSuffix,
                current.createdAtIso,
                nextAppliedRowIds
            )
            : current);
    };

    const handleApplyPrimaryAccountToSelectedRows = () => {
        if (!primaryAccount) {
            alert('계좌 관리에서 대표계좌를 먼저 설정해 주세요.');
            return;
        }
        if (kbSelectedTransferRowIds.size === 0) {
            alert('대표계좌로 변경할 작업자를 선택해 주세요.');
            return;
        }

        rebuildKBPreviewWithPrimaryRows(new Set([
            ...kbPrimaryAccountAppliedRowIds,
            ...kbSelectedTransferRowIds,
        ]));
    };

    const handleRestoreSelectedWorkerAccounts = () => {
        if (kbSelectedTransferRowIds.size === 0) return;
        const nextAppliedRowIds = new Set(kbPrimaryAccountAppliedRowIds);
        kbSelectedTransferRowIds.forEach((rowId) => nextAppliedRowIds.delete(rowId));
        rebuildKBPreviewWithPrimaryRows(nextAppliedRowIds);
    };

    const getKBValidationMessages = (row: KBTransferRow): string => (
        row.validationErrors.map(getKBValidationErrorLabel).join(', ')
    );

    // 국민은행용 엑셀 다운로드 (미리보기 스냅샷 기준)
    const handleDownloadKBExcel = () => {
        if (!ensurePayrollReady()) return;
        if (kbPrimaryAccountAppliedRowIds.size > 0 && !ensurePagePrimaryAccountReady(pagePrimaryAccount)) return;
        const snapshot = kbPreviewSnapshot;
        if (!snapshot) {
            alert('먼저 국민은행 미리보기를 열어 출력 내용을 확인해주세요.');
            return;
        }

        const kbTransferRows = snapshot.rows;
        if (kbTransferRows.length === 0) {
            alert("다운로드할 이체금액 데이터가 없습니다.");
            return;
        }

        const invalidRows = kbTransferRows.filter((row) => row.validationErrors.length > 0);
        const validRows = kbTransferRows.filter((row) => row.validationErrors.length === 0);
        if (validRows.length === 0) {
            alert('은행코드와 계좌번호가 정상인 다운로드 가능 행이 없습니다.');
            return;
        }

        // 셀 스타일 정의 (연두색 배경 - KB은행 양식)
        const greenStyle = {
            fill: { fgColor: { rgb: 'C6EFCE' }, patternType: 'solid' },
            font: { name: '맑은 고딕', sz: 10 },
            alignment: { horizontal: 'left' as const, vertical: 'center' as const },
            border: {
                top: { style: 'thin' as const, color: { rgb: '000000' } },
                bottom: { style: 'thin' as const, color: { rgb: '000000' } },
                left: { style: 'thin' as const, color: { rgb: '000000' } },
                right: { style: 'thin' as const, color: { rgb: '000000' } }
            }
        };

        const greenNumberStyle = {
            fill: { fgColor: { rgb: 'C6EFCE' }, patternType: 'solid' },
            font: { name: '맑은 고딕', sz: 10 },
            alignment: { horizontal: 'right' as const, vertical: 'center' as const },
            border: {
                top: { style: 'thin' as const, color: { rgb: '000000' } },
                bottom: { style: 'thin' as const, color: { rgb: '000000' } },
                left: { style: 'thin' as const, color: { rgb: '000000' } },
                right: { style: 'thin' as const, color: { rgb: '000000' } }
            },
            numFmt: '#,##0'
        };

        const headerRow: (string | number)[] = [
            'A. 은행코드',
            'B. 계좌번호',
            'C. 이체금액',
            'D. 받는분통장표시',
            'E. 내통장메모',
        ];

        const rowData: (string | number)[][] = validRows.map(row => [
            sanitizeKBExcelText(row.bankCode),
            sanitizeKBExcelText(row.accountNumber),
            row.amount,
            sanitizeKBExcelText(row.receiverDisplay),
            sanitizeKBExcelText(row.senderMemo)
        ]);

        const ws = XLSX.utils.aoa_to_sheet([headerRow, ...rowData]);

        const headerStyle = {
            fill: { fgColor: { rgb: 'FDE68A' }, patternType: 'solid' },
            font: { name: '맑은 고딕', sz: 10, bold: true, color: { rgb: '7C2D12' } },
            alignment: { horizontal: 'center' as const, vertical: 'center' as const },
            border: {
                top: { style: 'thin' as const, color: { rgb: 'B45309' } },
                bottom: { style: 'thin' as const, color: { rgb: 'B45309' } },
                left: { style: 'thin' as const, color: { rgb: 'B45309' } },
                right: { style: 'thin' as const, color: { rgb: 'B45309' } }
            }
        };

        const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
        for (let R = range.s.r; R <= range.e.r; R++) {
            for (let C = range.s.c; C <= range.e.c; C++) {
                const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
                const cell = ws[cellAddress];
                if (!cell) continue;
                if (R === range.s.r) {
                    cell.s = headerStyle;
                    continue;
                }
                if (R > range.s.r && (C === 0 || C === 1 || C === 3 || C === 4)) {
                    cell.v = sanitizeKBExcelText(cell.v);
                    cell.t = 's';
                    cell.z = '@';
                }
                if (C === 2) {
                    cell.s = greenNumberStyle;
                    cell.t = 'n';
                } else {
                    cell.s = greenStyle;
                }
            }
        }

        ws['!cols'] = [
            { wch: 8 },
            { wch: 20 },
            { wch: 15 },
            { wch: 12 },
            { wch: 18 },
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, '국민은행용');

        const verificationRows: (string | number)[][] = [
            ['항목', '값'],
            ['생성일시', snapshot.criteria.generatedAt],
            ['적용 대표계좌', snapshot.primaryAccount ? formatKBPrimaryAccountLabel(snapshot.primaryAccount) : '미설정'],
            ['대표계좌 적용 인원', snapshot.rows.filter((row) => row.usesPrimaryAccount).length],
            ['기간', snapshot.criteria.rangeLabel],
            ['팀/대상', snapshot.criteria.targetLabel],
            ['구분 필터', snapshot.criteria.salaryFilterLabel],
            ['금액 기준', snapshot.criteria.amountTypeLabel],
            ['공제 적용 상태', snapshot.criteria.deductionStatusLabel],
            ['원본 대상', snapshot.criteria.sourceCount],
            ['다운로드 행', validRows.length],
            ['검증 오류 제외', invalidRows.length],
            ['기타 제외 행', snapshot.criteria.excludedCount],
            ['총 이체금액', validRows.reduce((sum, row) => sum + row.amount, 0)],
            [],
            ['다운로드 행 검증', '상태', '계좌 적용', '은행명', '은행코드', '계좌번호', '예금주', '이체금액'],
            ...snapshot.rows.map((row) => [
                `${row.month} ${row.teamName} ${row.workerName}`,
                row.validationErrors.length > 0 ? `다운로드 제외: ${getKBValidationMessages(row)}` : '정상',
                row.usesPrimaryAccount ? '대표계좌' : '작업자 원계좌',
                row.bankName || '-',
                row.bankCode || '-',
                row.accountNumber || '-',
                row.accountHolder || '-',
                row.amount,
            ]),
            [],
            ['다운로드 제외', '사유', '금액'],
            ...invalidRows.map((row) => [
                `${row.month} ${row.teamName} ${row.workerName}`,
                `검증 오류: ${getKBValidationMessages(row)}`,
                row.amount,
            ]),
            ...snapshot.excludedRows.map((row) => [
                `${row.month} ${row.teamName} ${row.workerName}`,
                row.reason,
                row.amount,
            ]),
        ];
        const verificationSheet = XLSX.utils.aoa_to_sheet(verificationRows);
        verificationSheet['!cols'] = [
            { wch: 28 },
            { wch: 42 },
            { wch: 16 },
            { wch: 18 },
            { wch: 12 },
            { wch: 24 },
            { wch: 16 },
            { wch: 14 },
        ];
        XLSX.utils.book_append_sheet(wb, verificationSheet, '검증');

        const fileName = `월급제_국민은행용_${rangeLabel || currentYearMonth}.xlsx`;
        XLSX.writeFile(wb, fileName);
    };

    const getKBPreviewData = () => {
        return kbPreviewSnapshot?.rows ?? [];
    };

    const handleKBPreviewVisibilityChange = useCallback((show: boolean) => {
        if (!show) {
            setShowKBPreview(false);
            setKbPreviewSnapshot(null);
            setKbSelectedTransferRowIds(new Set());
            setKbPrimaryAccountAppliedRowIds(new Set());
            return;
        }

        if (!ensurePayrollReady()) return;
        if (kbSourcePaymentData.length === 0) {
            alert('현재 조회 조건에 해당하는 국민은행 출력 대상이 없습니다.');
            return;
        }

        const nextAmountType: KBAmountType = 'totalAmount';
        const sourceRows = buildKBPreviewSourceRows();
        const emptyPrimaryAccountRowIds = new Set<string>();
        setKbAmountType(nextAmountType);
        setKbSelectedTransferRowIds(new Set());
        setKbPrimaryAccountAppliedRowIds(emptyPrimaryAccountRowIds);
        setKbPreviewSnapshot(buildKBPreviewSnapshot(
            sourceRows,
            nextAmountType,
            kbReceiverDisplay,
            kbMemoSuffix,
            new Date().toISOString(),
            emptyPrimaryAccountRowIds
        ));

        if (insuranceApplied || businessIncomeApplied || utilitiesApplied || dailyFeeApplied) {
            applyCalculatedDeductions({
                applyInsurance: insuranceApplied,
                applyBusinessIncome: businessIncomeApplied,
                applyUtilities: utilitiesApplied,
                applyDailyFee: dailyFeeApplied,
                applyInsuranceTeamSiteOnly: insuranceTeamSiteOnly,
                immediate: true,
            });
        }

        setShowKBPreview(true);
    }, [
        applyCalculatedDeductions,
        buildKBPreviewSnapshot,
        buildKBPreviewSourceRows,
        ensurePayrollReady,
        businessIncomeApplied,
        dailyFeeApplied,
        insuranceApplied,
        insuranceTeamSiteOnly,
        kbMemoSuffix,
        kbReceiverDisplay,
        kbSourcePaymentData.length,
        utilitiesApplied,
    ]);

    const kbPreviewRows = kbPreviewSnapshot?.rows ?? [];
    const kbPreviewExcludedRows = kbPreviewSnapshot?.excludedRows ?? [];
    const kbPreviewInvalidRows = kbPreviewRows.filter((row) => row.validationErrors.length > 0);
    const kbPreviewValidRows = kbPreviewRows.filter((row) => row.validationErrors.length === 0);
    const kbPreviewValidAmount = kbPreviewValidRows.reduce((sum, row) => sum + row.amount, 0);
    const kbTransferReview = kbPreviewSnapshot ? reviewTransferTotals(
        kbPreviewSnapshot.sourceRows.map(row => ({ sourceRowId: row.sourceRowId, amount: resolveKBSourceAmount(row, kbAmountType) })),
        kbPreviewRows,
    ) : null;
    const kbAllPreviewRowsSelected = kbPreviewRows.length > 0
        && kbPreviewRows.every((row) => kbSelectedTransferRowIds.has(row.sourceRowId));
    const kbAppliedPrimaryAccountCount = kbPreviewRows.filter((row) => row.usesPrimaryAccount).length;
    const canDownloadKBExcel = !payrollDataBlocked && Boolean(kbPreviewSnapshot && kbPreviewValidRows.length > 0);

    const handleAddKBPreviewToTransfer = () => {
        setKbTransferError('');
        const userId = currentUser?.uid;
        if (!userId) {
            setKbTransferError('로그인 후 송금 목록에 담아 주세요.');
            return;
        }
        if (!ensurePayrollReady() || !kbPreviewSnapshot || kbPreviewRows.length === 0) return;
        if (kbPreviewRows.some(row => row.usesPrimaryAccount) && !ensurePagePrimaryAccountReady(pagePrimaryAccount)) return;
        try {
            storeTransferHandoff(userId, buildPayrollPreviewCandidates(
                kbPreviewRows,
                kbAmountType,
                kbPreviewSnapshot.criteria.amountTypeLabel,
            ));
        } catch (error) {
            setKbTransferError(error instanceof Error ? error.message : '송금 목록에 담지 못했습니다. 다시 시도해 주세요.');
            return;
        }
        window.location.assign('/payroll/bank-transfer?import=payroll');
    };

    const toggleKBPreviewRowSelection = (sourceRowId: string) => {
        setKbSelectedTransferRowIds((current) => {
            const next = new Set(current);
            if (next.has(sourceRowId)) next.delete(sourceRowId);
            else next.add(sourceRowId);
            return next;
        });
    };

    const toggleAllKBPreviewRows = () => {
        setKbSelectedTransferRowIds(kbAllPreviewRowsSelected
            ? new Set()
            : new Set(kbPreviewRows.map((row) => row.sourceRowId)));
    };

    const bankMappingDiagnostics = useMemo(() => {
        const grouped = new Map<string, {
            inputNames: Set<string>;
            count: number;
            mappedCount: number;
            codes: Set<string>;
            reasons: Map<string, number>;
            candidates: Set<string>;
        }>();

        filteredPaymentData.forEach((item) => {
            const rawName = String(item.bankName ?? '').trim();
            const normalizedName = normalizeBankKey(rawName) || '(빈값)';
            const analysis = analyzeBankMapping(item.bankName, item.bankCode);

            if (!grouped.has(normalizedName)) {
                grouped.set(normalizedName, {
                    inputNames: new Set<string>(),
                    count: 0,
                    mappedCount: 0,
                    codes: new Set<string>(),
                    reasons: new Map<string, number>(),
                    candidates: new Set<string>(),
                });
            }

            const bucket = grouped.get(normalizedName)!;
            bucket.count += 1;
            bucket.inputNames.add(rawName || '(미입력)');

            if (analysis.code) {
                bucket.mappedCount += 1;
                bucket.codes.add(analysis.code);
            } else {
                const reason = analysis.reason || '미매핑 사유 없음';
                bucket.reasons.set(reason, (bucket.reasons.get(reason) || 0) + 1);
                analysis.candidates.forEach((c) => bucket.candidates.add(c));
            }
        });

        return Array.from(grouped.entries())
            .map(([normalized, bucket]) => {
                const unmappedCount = bucket.count - bucket.mappedCount;
                const topReason = Array.from(bucket.reasons.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
                const suggestedAction = !unmappedCount
                    ? '정상'
                    : topReason.includes('여러 개')
                        ? '은행명을 더 구체적으로 입력하세요. (예: 신한은행, 카카오뱅크)'
                        : topReason.includes('비어')
                            ? '은행명을 입력하세요.'
                            : '공식 은행명으로 수정하거나 3자리 은행코드를 직접 입력하세요.';

                return {
                    normalized,
                    inputNames: Array.from(bucket.inputNames).slice(0, 4).join(', '),
                    count: bucket.count,
                    mappedCount: bucket.mappedCount,
                    unmappedCount,
                    codes: Array.from(bucket.codes).join(', '),
                    reason: topReason,
                    candidates: Array.from(bucket.candidates).join(', '),
                    suggestedAction,
                };
            })
            .sort((a, b) => {
                if (a.unmappedCount !== b.unmappedCount) return b.unmappedCount - a.unmappedCount;
                return a.normalized.localeCompare(b.normalized, 'ko');
            });
    }, [analyzeBankMapping, filteredPaymentData, normalizeBankKey]);

    const bankDiagnosticSummary = useMemo(() => {
        const total = bankMappingDiagnostics.reduce((sum, row) => sum + row.count, 0);
        const unmapped = bankMappingDiagnostics.reduce((sum, row) => sum + row.unmappedCount, 0);
        return { total, unmapped };
    }, [bankMappingDiagnostics]);


    const handleDownloadIndividualPayslip = useCallback(() => {
        if (!resolvedPayslipTarget) return;
        if (!ensurePayslipIssueReady([resolvedPayslipTarget], '개별 명세서 다운로드')) return;

        const { workbook } = buildPayslipWorkbook(
            resolvedPayslipTarget,
            resolvedPayslipContractorName
        );
        XLSX.writeFile(
            workbook,
            getPayslipWorkbookFileName(resolvedPayslipTarget),
            { cellStyles: true }
        );
    }, [ensurePayslipIssueReady, resolvedPayslipContractorName, resolvedPayslipTarget]);

    const handleDownloadBatchIndividualPayslips = useCallback(async () => {
        if (payslipPaymentData.length === 0 || batchExcelDownloading) {
            if (payslipPaymentData.length === 0) alert('다운로드할 명세서가 없습니다.');
            return;
        }
        if (!ensurePayslipIssueReady(payslipPaymentData, '일괄 개별 Excel 다운로드')) return;
        if (
            payslipPaymentData.length > 50
            && !window.confirm(`총 ${payslipPaymentData.length}명의 개별 Excel 명세서를 생성합니다. 계속 진행하시겠습니까?`)
        ) {
            return;
        }

        setBatchExcelDownloading(true);
        try {
            const zip = new JSZip();
            const { fileNames } = appendPayslipWorkbooksToZip(
                zip,
                payslipPaymentData,
                resolvedPayslipContractorName
            );
            if (fileNames.length === 0) throw new Error('생성된 Excel 명세서가 없습니다.');

            const content = await zip.generateAsync({
                type: 'blob',
                compression: 'DEFLATE',
                compressionOptions: { level: 6 },
            });
            const selectedTeamName = selectedTeamId
                ? teams.find((team) => team.id === selectedTeamId)?.name || '선택팀'
                : '전체';
            const salaryLabel = payslipSalaryModelFilter === 'all' ? '전체' : payslipSalaryModelFilter === 'daily' ? '일급제' : '월급제';
            const safeArchiveName = `노임명세서_일괄개별Excel_${salaryLabel}_${rangeLabel || currentYearMonth}_${selectedTeamName}`
                .replace(/[\\/:*?"<>|]/g, '_');
            saveAs(content, `${safeArchiveName}.zip`);
        } catch (error) {
            console.error('[MonthlyWageDraftPage] batch individual Excel download failed:', error);
            alert('개별 Excel 일괄 다운로드 중 오류가 발생했습니다.');
        } finally {
            setBatchExcelDownloading(false);
        }
    }, [
        batchExcelDownloading,
        currentYearMonth,
        ensurePayslipIssueReady,
        payslipPaymentData,
        payslipSalaryModelFilter,
        rangeLabel,
        resolvedPayslipContractorName,
        selectedTeamId,
        teams,
    ]);

    const [batchDownloading, setBatchDownloading] = useState(false);
    const batchRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

    const handleBatchDownload = async () => {
        if (!ensurePayrollReady()) return;
        if (payslipPaymentData.length === 0) {
            alert('다운로드할 데이터가 없습니다.');
            return;
        }

        if (!ensurePayslipIssueReady(payslipPaymentData, '일괄 다운로드')) {
            return;
        }

        if (payslipPaymentData.length > 50 && !window.confirm(`총 ${payslipPaymentData.length}명의 명세서를 생성합니다. 시간이 다소 소요될 수 있습니다. 진행하시겠습니까?`)) {
            return;
        }

        setBatchDownloading(true);

        // batchDownloading=true 설정 후 React가 PayslipTemplate들을 마운트할 때까지 대기
        await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

        const zip = new JSZip();

        try {
            let processedCount = 0;

            // Process sequentially to avoid browser freeze
            for (const item of payslipPaymentData) {
                const elementKey = item.id;
                const element = batchRefs.current[elementKey];
                if (!element) continue;

                const canvas = await (html2canvas as any)(element, {
                    scale: 1.5,
                    backgroundColor: '#ffffff',
                    logging: false,
                    useCORS: true
                });

                const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
                if (blob) {
                    const cleanWorkerName = (item.workerName || '').replace(/[0-9]/g, '');
                    zip.file(`${cleanWorkerName}_${item.month}.png`, blob);
                    processedCount++;
                }
            }

            if (processedCount === 0) {
                alert('이미지 생성에 실패했습니다.');
                setBatchDownloading(false);
                return;
            }

            const content = await zip.generateAsync({ type: 'blob' });
            const salaryLabel = payslipSalaryModelFilter === 'all' ? '전체' : payslipSalaryModelFilter === 'daily' ? '일급제' : '월급제';
            saveAs(content, `노임명세서_${salaryLabel}_${rangeLabel || currentYearMonth}_${selectedTeamId ? teams.find(t => t.id === selectedTeamId)?.name : '전체'}.zip`);

        } catch (error) {
            console.error('Batch download failed:', error);
            alert('일괄 다운로드 중 오류가 발생했습니다.');
        } finally {
            setBatchDownloading(false);
        }
    };

    const normalizeManualInputForSettlement = (
        input: LedgerManualInput | undefined
    ): MonthlyPayrollSavedManualInput => {
        const emptySide = {
            carry: 0,
            carrySecond: 0,
            currentAdvance: 0,
            currentAdvanceSecond: 0,
            lodging: 0,
            electricity: 0,
            gas: 0,
            water: 0,
            internet: 0,
            management: 0,
            fine: 0,
            other: 0,
        };

        return {
            invoice: { ...emptySide, ...(input?.invoice ?? {}) },
            labor: { ...emptySide, ...(input?.labor ?? {}) },
            personalMemo: String(input?.personalMemo ?? ''),
            assignmentType: input?.assignmentType,
            allocationMode: input?.allocationMode ?? 'split',
            itemAssignments: { ...(input?.itemAssignments ?? {}) },
        };
    };

    const handleSavePayrollSettlement = async () => {
        if (!ensurePayrollReady()) return;
        if (filterMode === 'worker') {
            alert('정산 저장은 팀 모드에서 진행해 주세요. 개인 저장은 팀 전체 저장본을 덮어쓸 수 있어 제한됩니다.');
            return;
        }
        if (filteredPaymentData.length === 0) {
            alert('저장할 정산 데이터가 없습니다. 기간과 팀을 선택한 뒤 조회해 주세요.');
            return;
        }
        if (deductionApplyInProgress) {
            alert('급여 계산이 끝난 뒤 저장해 주세요.');
            return;
        }

        const grouped = new Map<string, {
            year: number;
            yearMonth: string;
            teamId: string;
            teamName: string;
            rows: MonthlyPayrollSettlementSaveInput['rows'];
            hasBusinessIncome: boolean;
            hasLaborTax: boolean;
        }>();

        filteredPaymentData.forEach((item) => {
            const yearMonth = String(item.month ?? '').trim();
            const teamId = String(item.teamId ?? '').trim();
            if (!yearMonth || !teamId || !monthRangeSet.has(yearMonth)) return;

            const salaryModel = item.id.endsWith('__일급제')
                ? '일급제'
                : item.id.endsWith('__용역팀')
                    ? '용역팀'
                    : '월급제';
            const ledgerRow = ledgerRows.find((row) => (
                row.month === yearMonth
                && row.workerId === item.workerId
                && row.teamId === teamId
                && String(row.salaryModel ?? '월급제') === salaryModel
            ));
            const rowKey = ledgerRow?.rowKey || item.id;
            const computedAmount = ledgerComputedAmountByRowKey.get(rowKey);
            const manualInput = normalizeManualInputForSettlement(
                ledgerInputs[rowKey]
                ?? initialLedgerInputs[rowKey]
                ?? ledgerRow?.manual
            );

            const businessIncomeAppliedAmount = Math.max(
                0,
                toNumber(item.businessIncomeAppliedSummary?.appliedAmount)
            );
            const businessIncomeAppliedManDay = Math.max(
                0,
                toNumber(item.businessIncomeAppliedSummary?.appliedManDay)
            );
            const incomeTaxRate = Math.max(
                0,
                toNumber(item.taxRateSnapshot?.businessIncomeTaxRate ?? BUSINESS_INCOME_TAX_RATE)
            );
            const residentTaxRate = Math.max(
                0,
                toNumber(item.taxRateSnapshot?.businessResidentTaxRate ?? BUSINESS_RESIDENT_TAX_RATE)
            );
            const incomeTax = floorWon(businessIncomeAppliedAmount * incomeTaxRate);
            const residentTax = floorWon(businessIncomeAppliedAmount * residentTaxRate);
            const rowDisplay = rowDisplayCache.get(item.id);
            const personalDeduction = Math.max(
                0,
                toNumber(rowDisplay?.deductionBreakdownForDisplay.total ?? item.deductionBreakdown?.total)
            );
            const taxDeduction = Math.max(0, toNumber(rowDisplay?.taxTotalForDisplay));
            const totalDeduction = rowDisplay
                ? Math.max(0, toNumber(rowDisplay.totalDeductionForDisplay))
                : personalDeduction + taxDeduction;
            const netAmount = rowDisplay
                ? toNumber(rowDisplay.totalAmountForDisplay)
                : toNumber(item.totalAmount);
            const paymentSnapshot = {
                ...item,
                totalDeduction,
                totalAmount: netAmount,
                deductionBreakdown: rowDisplay?.deductionBreakdownForDisplay ?? item.deductionBreakdown,
            };
            const groupKey = `${yearMonth}__${teamId}`;
            const group = grouped.get(groupKey) ?? {
                year: Number(yearMonth.slice(0, 4)),
                yearMonth,
                teamId,
                teamName: String(item.teamName ?? '').trim() || '미지정 팀',
                rows: [],
                hasBusinessIncome: false,
                hasLaborTax: false,
            };

            group.rows.push({
                rowKey,
                yearMonth,
                teamId,
                teamName: group.teamName,
                workerId: String(item.workerId ?? '').trim(),
                workerName: String(item.workerName ?? '').trim(),
                salaryModel,
                grossAmount: Math.max(0, toNumber(item.grossAmount)),
                netAmount,
                invoiceGrossAmount: computedAmount?.invoiceGrossAmount
                    ?? Math.max(0, toNumber(item.invoiceGrossAmount)),
                laborGrossAmount: computedAmount?.laborGrossAmount
                    ?? Math.max(0, toNumber(item.laborGrossAmount)),
                invoiceNetAmount: computedAmount?.corporateNet
                    ?? resolveDisplayInvoiceNetAmount(item),
                laborNetAmount: computedAmount?.personalNet
                    ?? resolveDisplayLaborNetAmount(item),
                totalManDay: Math.max(0, toNumber(item.totalManDay)),
                unitPrice: Math.max(0, toNumber(item.unitPrice)),
                personalDeduction,
                taxDeduction,
                totalDeduction,
                isValid: Boolean(item.isValid),
                paymentSnapshot,
                manualInput,
                businessIncome: {
                    appliedAmount: businessIncomeAppliedAmount,
                    appliedManDay: businessIncomeAppliedManDay,
                    incomeTax,
                    residentTax,
                    totalTax: incomeTax + residentTax,
                    incomeTaxRate,
                    residentTaxRate,
                },
            });
            group.hasBusinessIncome = group.hasBusinessIncome || businessIncomeAppliedAmount > 0;
            group.hasLaborTax = group.hasLaborTax
                || toNumber(item.insuranceAppliedSummary?.appliedAmount) > 0
                || toNumber(item.withholdingAppliedSummary?.appliedAmount) > 0;
            grouped.set(groupKey, group);
        });

        const settlements: MonthlyPayrollSettlementSaveInput[] = Array.from(grouped.values()).map((group) => {
            const businessIncomeAppliedAmount = group.rows.reduce(
                (sum, row) => sum + row.businessIncome.appliedAmount,
                0
            );
            const businessIncomeTaxAmount = group.rows.reduce(
                (sum, row) => sum + row.businessIncome.totalTax,
                0
            );
            return {
                year: group.year,
                yearMonth: group.yearMonth,
                teamId: group.teamId,
                teamName: group.teamName,
                reportingType: group.hasBusinessIncome
                    ? (group.hasLaborTax ? 'mixed' : 'business_income')
                    : 'labor',
                calculationOptions: {
                    insuranceApplied,
                    insuranceTeamSiteOnly,
                    businessIncomeApplied,
                    utilitiesApplied,
                    dailyFeeApplied,
                },
                businessIncomeAppliedAmount,
                businessIncomeTaxAmount,
                rows: group.rows,
            };
        });

        if (settlements.length === 0) {
            alert('저장 가능한 팀별 정산 데이터가 없습니다.');
            return;
        }

        setPayrollSettlementSaving(true);
        setPayrollSettlementFeedback('정산을 저장하고 있습니다...');
        try {
            await monthlyPayrollSettlementService.saveSettlements(settlements, {
                uid: currentUser?.uid,
                name: currentUser?.displayName || currentUser?.email,
            });

            const years = Array.from(new Set(settlements.map((settlement) => settlement.year)));
            const refreshed = (await Promise.all(
                years.map((year) => monthlyPayrollSettlementService.getSettlementsByYear(year))
            ))
                .flat()
                .filter((settlement) => monthRangeSet.has(settlement.yearMonth));
            setSavedPayrollSettlements(refreshed);

            const businessTotal = settlements.reduce(
                (sum, settlement) => sum + settlement.businessIncomeAppliedAmount,
                0
            );
            const savedAt = new Intl.DateTimeFormat('ko-KR', {
                hour: '2-digit',
                minute: '2-digit',
            }).format(new Date());
            setPayrollSettlementFeedback(
                `${settlements.length}개 팀 저장 완료 · 사업소득 적용 ${businessTotal.toLocaleString()}원 · ${savedAt}`
            );
        } catch (error) {
            console.error('[MonthlyWageDraftPage] settlement save failed:', error);
            setPayrollSettlementFeedback('정산 저장에 실패했습니다.');
            alert('정산 저장 중 오류가 발생했습니다. 권한과 네트워크 상태를 확인해 주세요.');
        } finally {
            setPayrollSettlementSaving(false);
        }
    };

    const payrollScopeKeys = useMemo(() => new Set(
        filteredPaymentData
            .map((item) => {
                const yearMonth = String(item.month ?? '').trim();
                const teamId = String(item.teamId ?? '').trim();
                return yearMonth && teamId ? `${yearMonth}__${teamId}` : '';
            })
            .filter(Boolean)
    ), [filteredPaymentData]);

    const scopedPayrollSettlements = useMemo(() => (
        savedPayrollSettlements.filter((settlement) => (
            payrollScopeKeys.has(`${settlement.yearMonth}__${settlement.teamId}`)
        ))
    ), [payrollScopeKeys, savedPayrollSettlements]);

    const simplePayrollRunStatus = useMemo(() => {
        if (payrollScopeKeys.size === 0 || scopedPayrollSettlements.length < payrollScopeKeys.size) {
            return 'unsaved' as const;
        }

        const statuses = new Set(scopedPayrollSettlements.map((settlement) => settlement.runStatus));
        if (statuses.size !== 1) return 'mixed' as const;
        return Array.from(statuses)[0] as MonthlyPayrollRunStatus;
    }, [payrollScopeKeys, scopedPayrollSettlements]);

    const payrollReviewRows = useMemo<PayrollReviewRow[]>(() => {
        const savedById = new Map(savedPayrollSettlements.flatMap(settlement => settlement.rows.map(row => [
            String(row.paymentSnapshot?.id ?? row.rowKey), row,
        ] as const)));
        return simplePayrollClosingRows.map((row, index) => {
            const payment = filteredPaymentData[index];
            const display = rowDisplayCache.get(row.id);
            const breakdown = display?.deductionBreakdownForDisplay ?? payment.deductionBreakdown;
            return {
                ...row,
                grossAmount: payment.grossAmount,
                personalDeduction: breakdown?.total ?? 0,
                taxDeduction: display?.taxTotalForDisplay ?? row.taxDeduction,
                totalDeduction: display?.totalDeductionForDisplay ?? payment.totalDeduction,
                netAmount: display?.totalAmountForDisplay ?? payment.totalAmount,
                workerId: payment.workerId,
                teamId: payment.teamId,
                salaryModel: resolveKBSalaryFilterFromPaymentId(payment.id),
                bankCode: analyzeBankMapping(payment.bankName, payment.bankCode).code,
                accountNumber: payment.accountNumber || '',
                accountHolder: payment.accountHolder || '',
                deductionLineTotal: [...(breakdown?.standardLines ?? []), ...(breakdown?.additionalLines ?? [])].reduce((sum, line) => sum + Number(line.amount), 0),
                saved: savedById.get(row.id),
            };
        });
    }, [simplePayrollClosingRows, filteredPaymentData, rowDisplayCache, savedPayrollSettlements]);
    const payrollReview = useMemo(() => reviewPayroll(payrollReviewRows), [payrollReviewRows]);

    const reloadPayrollSettlements = useCallback(async () => {
        const years = Array.from(new Set(
            monthRange
                .map((yearMonth) => Number(yearMonth.slice(0, 4)))
                .filter((year) => Number.isFinite(year) && year > 0)
        ));
        if (years.length === 0) {
            setSavedPayrollSettlements([]);
            return;
        }

        const refreshed = (await Promise.all(
            years.map((year) => monthlyPayrollSettlementService.getSettlementsByYear(year))
        ))
            .flat()
            .filter((settlement) => monthRangeSet.has(settlement.yearMonth));
        setSavedPayrollSettlements(refreshed);
    }, [monthRange, monthRangeSet]);

    const handlePayrollRunTransition = async (nextStatus: Exclude<MonthlyPayrollRunStatus, 'draft'>) => {
        if (!ensurePayrollReady()) return;
        if (filterMode === 'worker') {
            alert('급여 상태 변경은 팀 모드에서만 할 수 있습니다.');
            return;
        }
        if (simplePayrollRunStatus === 'mixed') {
            alert('선택 범위에 서로 다른 급여 상태가 있습니다. 월 또는 팀을 나누어 처리해 주세요.');
            return;
        }
        if (scopedPayrollSettlements.length === 0 || simplePayrollRunStatus === 'unsaved') {
            alert('선택한 모든 월·팀의 급여 초안을 먼저 저장해 주세요.');
            return;
        }
        if ((nextStatus === 'reviewed' || nextStatus === 'confirmed') && payrollReview.errorCount > 0) {
            alert(`정산 확인센터에 금액·중복·저장본 확인 항목이 ${payrollReview.errorCount}건 있습니다. 먼저 내용을 확인해 주세요.`);
            return;
        }
        if (nextStatus === 'confirmed') {
            const issues = simplePayrollClosingRows.filter((row) => !row.isValid || row.netAmount < 0);
            if (issues.length > 0) {
                alert(`계좌 정보 또는 실지급액을 확인해야 하는 작업자가 ${issues.length}명 있습니다.`);
                return;
            }
        }

        const actionLabel = nextStatus === 'reviewed'
            ? '검토 완료'
            : nextStatus === 'confirmed'
                ? '급여 확정'
                : '지급 완료';
        const message = nextStatus === 'confirmed'
            ? '급여를 확정하면 저장된 급여 스냅샷을 수정할 수 없습니다. 진행할까요?'
            : nextStatus === 'paid'
                ? '실제 지급이 완료되었습니까? 지급 완료 후에는 과거 급여를 수정할 수 없습니다.'
                : '현재 저장된 급여 초안을 검토 완료로 표시할까요?';
        if (!window.confirm(message)) return;

        setPayrollSettlementSaving(true);
        setPayrollSettlementFeedback(`${actionLabel} 처리 중...`);
        try {
            await monthlyPayrollSettlementService.transitionRunStatus(
                scopedPayrollSettlements.map((settlement) => settlement.id || ''),
                nextStatus,
                {
                    uid: currentUser?.uid,
                    name: currentUser?.displayName || currentUser?.email,
                }
            );
            await reloadPayrollSettlements();
            setPayrollSettlementFeedback(`${actionLabel} 처리 완료`);
        } catch (error) {
            console.error('[MonthlyWageDraftPage] payroll run transition failed:', error);
            const message = error instanceof Error ? error.message : '급여 상태 저장 중 오류가 발생했습니다.';
            setPayrollSettlementFeedback('급여 상태 저장에 실패했습니다.');
            alert(message);
        } finally {
            setPayrollSettlementSaving(false);
        }
    };

    const insuranceConfigView = payrollConfig?.insuranceConfig;
    const insuranceThresholdDays = Math.max(0, Math.floor(toNumber(insuranceConfigView?.thresholdDays ?? 8)));
    const withholdingApplyAllLaborView =
        typeof insuranceConfigView?.withholdingApplyAllLabor === 'boolean' ? insuranceConfigView.withholdingApplyAllLabor : true;
    const employmentApplyBelowThresholdView =
        typeof insuranceConfigView?.employmentApplyBelowThreshold === 'boolean' ? insuranceConfigView.employmentApplyBelowThreshold : true;
    const withholdingBaseDeductionWonView = Math.max(0, Math.floor(toNumber(insuranceConfigView?.withholdingBaseDeduction ?? 150000)));
    const withholdingIncomeRatePercentView = Math.round(
        toNumber(insuranceConfigView?.withholdingIncomeTaxRate ?? payrollConfig?.incomeTaxRate ?? 0.06) * 10000
    ) / 100;
    const withholdingResidentRatePercentView = Math.round(
        toNumber(insuranceConfigView?.withholdingResidentTaxRate ?? payrollConfig?.residentTaxRate ?? 0.1) * 10000
    ) / 100;
    const withholdingTaxCreditPercentView = Math.round(
        toNumber(insuranceConfigView?.withholdingIncomeBaseMultiplier ?? 0.55) * 10000
    ) / 100;
    const dailyWorkerFeePerManDayView = Math.max(0, Math.floor(toNumber(insuranceConfigView?.dailyWorkerFeePerManDay ?? 0)));

    if (transferPicker) {
        const scopedSaved = savedPayrollSettlements.filter(settlement => monthRangeSet.has(settlement.yearMonth));
        const mixedCalculationOptions = !transferPicker.batchJob && !selectedTeamId && new Set(scopedSaved.filter(settlement => settlement.runStatus !== 'paid').map(settlement => (
            makePayrollCalculationOptionsSignature(resolveSavedPayrollCalculationOptions([settlement], monthRangeSet)!)
        ))).size > 1;
        const scopeKeyFor = (month: string, teamId: string) => `${month}::${resolveCanonicalTeamId(teamId) || teamId}`;
        const paidScopes = new Set(scopedSaved.filter(settlement => settlement.runStatus === 'paid')
            .map(settlement => scopeKeyFor(settlement.yearMonth, settlement.teamId)));
        const paidIds = new Set(kbSourcePaymentData.filter(item => paidScopes.has(scopeKeyFor(item.month, item.teamId))).map(item => item.id));
        const currentCalculationApplied = appliedCalculationSourceRef.current?.data === basePaymentData
            && appliedCalculationSourceRef.current?.config === payrollConfig
            && appliedCalculationSourceRef.current?.calculate === applyCalculatedDeductions
            && completedCalculationSequence > 0 && completedCalculationSequence === applyRunSeqRef.current;
        const transferError = loadError || payrollSettlementLoadError || payrollConfigLoadError || filtersLoadError || deductionApplyError;
        const transferReady = !payrollDataBlocked && !transferError && currentCalculationApplied
            && transferLedgerReadyToken === transferLedgerToken && ledgerComputedAmounts.length === ledgerRows.length
            && startMonth === transferPicker.period && endMonth === transferPicker.period;
        const availableCount = kbSourcePaymentData.length - paidIds.size;
        const changeDeductions = (changes: Partial<Parameters<typeof applyCalculatedDeductions>[0]>) => {
            applyCalculatedDeductions({
                applyInsurance: insuranceApplied, applyInsuranceTeamSiteOnly: insuranceTeamSiteOnly,
                applyBusinessIncome: businessIncomeApplied, applyUtilities: true, applyDailyFee: dailyFeeApplied,
                ...changes, immediate: true,
            });
        };
        const collectTransferPayroll = (): TransferLoadResult => {
            const scopedIds = transferPicker.batchJob ? new Set(kbSourcePaymentData
                .filter(item => (resolveCanonicalTeamId(item.teamId) || item.teamId || '') === transferPicker.batchJob!.teamId)
                .map(item => item.id)) : null;
            const sourceRows = buildKBPreviewSourceRows().filter(row => !paidIds.has(row.sourceRowId) && (!scopedIds || scopedIds.has(row.sourceRowId)));
            const { rows, excludedRows } = buildKBTransferRowsFromSources(sourceRows, kbAmountType, '', '', new Set());
            const warnings: string[] = [];
            if (paidIds.size > 0) warnings.push(`지급완료된 급여 ${paidIds.size}건은 송금 대상에서 제외했습니다.`);
            if (excludedRows.length > 0) warnings.push(`선택한 금액 기준에서 0원 이하인 ${excludedRows.length}건은 제외했습니다.`);
            if (sourceRows.length === 0 && paidIds.size === 0) warnings.push('선택한 월·팀·급여 구분의 급여 내역이 없습니다.');
            if (rows.some(row => row.validationErrors.length > 0)) warnings.push('계좌 정보가 누락된 급여는 송금 목록에 담은 뒤 계좌를 선택해 주세요.');
            const candidates = buildPayrollPreviewCandidates(rows, kbAmountType, getKBAmountTypeDisplayLabel(kbAmountType)).map(candidate => {
                const { receiverDisplay, senderMemo, ...withoutMemo } = candidate;
                return withoutMemo;
            });
            return { candidates, warnings };
        };
        const loadTransferPayroll = () => {
            if (!transferReady || transferBatch) return;
            setTransferBatchError('');
            if (mixedCalculationOptions) {
                const targetTeams = new Map<string, string>();
                kbSourcePaymentData.filter(item => !paidIds.has(item.id)).forEach(item => {
                    const id = resolveCanonicalTeamId(item.teamId) || item.teamId || '';
                    targetTeams.set(id, item.teamName || '소속 미지정');
                });
                if (targetTeams.size) {
                    transferPicker.onInvalidate();
                    setTransferBatch({ id: ++transferBatchSequence.current, teams: [...targetTeams].map(([id, name]) => ({ id, name })),
                        warnings: paidIds.size ? [`지급완료된 급여 ${paidIds.size}건은 송금 대상에서 제외했습니다.`] : [] });
                    return;
                }
            }
            transferPicker.onLoad(collectTransferPayroll());
        };
        const ledgerCalculator = <MonthlyAdvanceLedger
            computeOnly rows={ledgerRows} payrollConfig={payrollConfig} advanceItemLabels={payrollConfig?.advanceItemLabels}
            withholdingThreshold={WITHHOLDING_MAX_MAN_DAY} applyUtilities={utilitiesApplied} applyInsurance={insuranceApplied}
            applyBusinessIncome={businessIncomeApplied} applyDailyFee={dailyFeeApplied} insuranceTeamSiteOnly={insuranceTeamSiteOnly}
            isInsuranceEligibleEntry={isLedgerInsuranceEligibleEntry} clientCompanyNameById={companyNameById}
            onInputsChange={setLedgerInputs} onComputedAmountsChange={handleTransferLedgerComputed} initialInputs={initialLedgerInputs}
        />;
        if (transferPicker.batchJob) return <>
            <TransferJobReporter ready={transferReady} error={transferError} collect={collectTransferPayroll} onLoad={transferPicker.onLoad} onError={transferPicker.onError!} />
            {ledgerCalculator}
        </>;
        return (
            <section className="bt-payroll-picker" aria-label="급여 직접 불러오기">
                <p className="bt-payroll-status">{transferPicker.period} 급여 · {mixedCalculationOptions ? '각 팀에 저장된 공제 기준으로 불러옵니다.' : '현재 공제 기준으로 계산합니다.'}</p>
                <div className="bt-payroll-fields">
                    <label>팀
                        <select aria-label="급여 조회 팀" value={selectedTeamId} onChange={event => setSelectedTeamId(event.target.value)} disabled={!filtersReady}>
                            <option value="">전체 팀</option>
                            {teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
                        </select>
                    </label>
                    <label>급여 구분
                        <select aria-label="급여 구분" value={ledgerSalaryModelFilter} onChange={event => setLedgerSalaryModelFilter(event.target.value as KBSalaryModelFilter)}>
                            <option value="all">전체</option><option value="monthly">월급제</option><option value="daily">일급제</option><option value="service">용역팀</option>
                        </select>
                    </label>
                </div>
                <label className="bt-payroll-amount">이체금액 기준
                    <select aria-label="급여 이체금액 기준" value={kbAmountType} onChange={event => setKbAmountType(event.target.value as KBAmountType)}>
                        {(['totalAmount', 'invoiceNet', 'laborNet', 'invoiceAdvance', 'laborAdvance', 'corporateAdvance1', 'corporateAdvance2', 'corporateAdvance3', 'corporateAdvance4', 'laborAdvance1', 'laborAdvance2', 'laborAdvance3', 'laborAdvance4'] as KBAmountType[])
                            .map(type => <option key={type} value={type}>{getKBAmountTypeDisplayLabel(type)}</option>)}
                    </select>
                </label>
                <details className="bt-payroll-options">
                    <summary>공제 설정</summary>
                    {mixedCalculationOptions ? <p>팀마다 저장된 설정을 각각 적용합니다. 공제 설정을 바꾸려면 해당 팀을 선택하세요.</p> : <>
                    <label><input type="checkbox" checked={insuranceApplied} onChange={event => changeDeductions({ applyInsurance: event.target.checked })} />4대보험</label>
                    <label><input type="checkbox" checked={insuranceTeamSiteOnly} onChange={event => changeDeductions({ applyInsuranceTeamSiteOnly: event.target.checked })} />해당 팀 현장만</label>
                    <label><input type="checkbox" checked={businessIncomeApplied} onChange={event => changeDeductions({ applyBusinessIncome: event.target.checked })} />사업소득세</label>
                    <label><input type="checkbox" checked={dailyFeeApplied} onChange={event => changeDeductions({ applyDailyFee: event.target.checked })} />일급 수수료</label>
                    <p>가불·공과금은 저장된 입력을 반영합니다. 확정 급여는 확정 당시 금액을 유지합니다.</p>
                    </>}
                </details>
                {transferError && <div role="alert" className="bt-payroll-status">{transferError}<button type="button" onClick={fetchData}>다시 조회</button></div>}
                {transferBatchError && <p role="alert" className="bt-payroll-status">{transferBatchError} 다시 급여 불러오기를 눌러 주세요.</p>}
                <p role="status" className="bt-payroll-status">{transferError ? '조회 조건을 확인해 주세요.' : transferBatch ? '팀별 급여를 한 목록으로 모으고 있습니다.' : transferReady ? `급여 ${availableCount}건 준비${paidIds.size > 0 ? ` · 지급완료 ${paidIds.size}건 제외` : ''}` : '급여와 가불·공제 내역을 계산하고 있습니다.'}</p>
                <button type="button" aria-label="급여 불러오기" className="bt-payroll-load" disabled={!transferReady || !!transferBatch} onClick={loadTransferPayroll}>{transferBatch ? '전체 팀 불러오는 중…' : '급여 불러오기'}</button>
                {transferBatch && <TransferBatchRunner key={transferBatch.id} teams={transferBatch.teams} period={transferPicker.period} salaryFilter={ledgerSalaryModelFilter} amountType={kbAmountType}
                    onLoad={result => {
                        if (transferBatchSequence.current !== transferBatch.id) return;
                        setTransferBatch(null);
                        transferPicker.onLoad({ candidates: result.candidates, warnings: [...transferBatch.warnings, ...result.warnings] });
                    }} onError={message => {
                        if (transferBatchSequence.current !== transferBatch.id) return;
                        setTransferBatch(null); setTransferBatchError(message);
                    }} />}
                {ledgerCalculator}
            </section>
        );
    }

    return (
        <div className="monthly-wage-page relative h-full flex flex-col p-2 w-full overflow-hidden">
            <style>{`
                #monthly-payslip-print-root[data-print-measuring="true"] {
                    display: block !important;
                    position: fixed !important;
                    left: -100000px !important;
                    top: 0 !important;
                    width: 194mm !important;
                    max-width: 194mm !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    visibility: hidden !important;
                    pointer-events: none !important;
                }

                #monthly-payslip-print-root[data-print-measuring="true"] .monthly-payslip-print-page {
                    display: block !important;
                    width: 194mm !important;
                    min-width: 194mm !important;
                    max-width: 194mm !important;
                    height: 281mm !important;
                    min-height: 281mm !important;
                    max-height: 281mm !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    overflow: hidden !important;
                    box-sizing: border-box !important;
                }

                #monthly-payslip-print-root[data-print-measuring="true"] .payslip-template-card {
                    width: var(--payslip-print-source-width, 194mm) !important;
                    min-width: var(--payslip-print-source-width, 194mm) !important;
                    max-width: var(--payslip-print-source-width, 194mm) !important;
                    min-height: 0 !important;
                    margin: 0 !important;
                    box-sizing: border-box !important;
                    transform: none !important;
                }

                #monthly-payslip-print-root[data-print-measuring="true"] .payslip-template-details-grid {
                    grid-template-columns: minmax(0, 1.12fr) minmax(0, 0.88fr) !important;
                    gap: 2.5mm !important;
                }

                #monthly-payslip-print-root[data-print-measuring="true"] .payslip-template-card .p-4 {
                    padding: 2.5mm !important;
                }

                #monthly-payslip-print-root[data-print-measuring="true"] .payslip-template-card .p-3 {
                    padding: 2mm !important;
                }

                #monthly-payslip-print-root[data-print-measuring="true"] .payslip-template-card .py-4 {
                    padding-top: 2.5mm !important;
                    padding-bottom: 2.5mm !important;
                }

                #monthly-payslip-print-root[data-print-measuring="true"] .payslip-template-card th,
                #monthly-payslip-print-root[data-print-measuring="true"] .payslip-template-card td {
                    padding-top: 1.2mm !important;
                    padding-bottom: 1.2mm !important;
                }

                @media screen {
                    #monthly-payslip-print-root {
                        display: none !important;
                    }
                }

                @media print {
                    @page {
                        size: A4 portrait;
                        margin: 8mm;
                    }

                    html,
                    body {
                        margin: 0 !important;
                        padding: 0 !important;
                        width: 100% !important;
                        min-width: 0 !important;
                        overflow: visible !important;
                        background: #fff !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }

                    body > *:not(#monthly-payslip-print-root) {
                        display: none !important;
                    }

                    #monthly-payslip-print-root {
                        display: block !important;
                        position: static !important;
                        width: 194mm !important;
                        max-width: 194mm !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        background: #fff !important;
                    }

                    .monthly-payslip-print-page {
                        display: block !important;
                        width: 194mm !important;
                        min-width: 194mm !important;
                        max-width: 194mm !important;
                        height: 281mm !important;
                        min-height: 281mm !important;
                        max-height: 281mm !important;
                        box-sizing: border-box !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        overflow: hidden !important;
                        break-inside: avoid !important;
                        page-break-inside: avoid !important;
                        break-after: page;
                        page-break-after: always;
                    }

                    .monthly-payslip-print-page:last-child {
                        break-after: auto;
                        page-break-after: auto;
                    }

                    .monthly-payslip-print-page .payslip-template-card {
                        width: var(--payslip-print-source-width, 194mm) !important;
                        min-width: var(--payslip-print-source-width, 194mm) !important;
                        max-width: var(--payslip-print-source-width, 194mm) !important;
                        min-height: 0 !important;
                        box-sizing: border-box !important;
                        margin: 0 !important;
                        border: 0.35mm solid #e2e8f0 !important;
                        border-radius: 2.5mm !important;
                        box-shadow: none !important;
                        color: #0f172a !important;
                        background: #fff !important;
                        font-family: "Malgun Gothic", "Noto Sans KR", sans-serif !important;
                        overflow-wrap: anywhere !important;
                        transform: scale(var(--payslip-print-scale, 1)) !important;
                        transform-origin: top left !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }

                    .monthly-payslip-print-page .payslip-template-details-grid {
                        grid-template-columns: minmax(0, 1.12fr) minmax(0, 0.88fr) !important;
                        gap: 2.5mm !important;
                    }

                    .monthly-payslip-print-page .payslip-template-card .p-4 {
                        padding: 2.5mm !important;
                    }

                    .monthly-payslip-print-page .payslip-template-card .p-3 {
                        padding: 2mm !important;
                    }

                    .monthly-payslip-print-page .payslip-template-card .py-4 {
                        padding-top: 2.5mm !important;
                        padding-bottom: 2.5mm !important;
                    }

                    .monthly-payslip-print-page .payslip-template-card th,
                    .monthly-payslip-print-page .payslip-template-card td {
                        padding-top: 1.2mm !important;
                        padding-bottom: 1.2mm !important;
                    }

                    .monthly-payslip-print-page table,
                    .monthly-payslip-print-page tr,
                    .monthly-payslip-print-page section {
                        break-inside: avoid !important;
                        page-break-inside: avoid !important;
                    }
                }
            `}</style>

            {payslipPrintRows.length > 0 && typeof document !== 'undefined' && createPortal(
                <div id="monthly-payslip-print-root" aria-hidden="true">
                    {payslipPrintRows.map((item, index) => (
                        <div
                            key={`print-${item.id}-${index}`}
                            className="monthly-payslip-print-page"
                            data-worker-name={item.workerName}
                        >
                            <PayslipTemplate
                                data={item}
                                month={item.month}
                                contractorName={resolvedPayslipContractorName}
                                applyUtilities={utilitiesApplied}
                                insuranceTeamSiteOnly={insuranceTeamSiteOnly}
                                isTeamResponsibleSiteEntry={isEntryInWorkerTeamSite}
                            />
                        </div>
                    ))}
                </div>,
                document.body
            )}

            {deductionApplyInProgress && (
                <div className="absolute inset-0 z-[100] pointer-events-none bg-white/50 backdrop-blur-sm flex items-center justify-center">
                    <div className="flex flex-col items-center gap-3 bg-white p-6 rounded-2xl shadow-xl border border-slate-100">
                        <FontAwesomeIcon icon={faSpinner} className="animate-spin text-4xl text-blue-600" />
                        <span className="text-slate-600 font-semibold text-lg">급여 계산을 적용하고 있습니다...</span>
                    </div>
                </div>
            )}


            {/* Keep the ledger mounted so returning from preview preserves its inputs and scroll position. */}
            <div className="monthly-payroll-workspace" hidden={showKBPreview} style={{ display: showKBPreview ? 'none' : 'contents' }}>
                <PayrollToolbar
                    primaryAccountSettings={<PagePrimaryAccountCard state={pagePrimaryAccount} />}
                    hideHeader={!!hideHeader}
                    rangeLabel={rangeLabel}
                    targetCount={pageViewMode === 'ledger' ? filteredLedgerRows.length : filteredPaymentData.length}
                    monthRangeLength={monthRange.length}
                    totalLoadCount={paymentData.length}
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
                    ledgerSalaryModelFilter={ledgerSalaryModelFilter}
                    setLedgerSalaryModelFilter={setLedgerSalaryModelFilter}
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
                    setShowKBPreview={handleKBPreviewVisibilityChange}
                    isPaymentDataEmpty={paymentData.length === 0}
                    openPayslipPreview={openPayslipPreview}
                    handleBatchDownload={handleBatchDownload}
                    batchDownloading={batchDownloading}
                    advanceLedgerRef={advanceLedgerRef}
                    isLedgerRowsDataEmpty={ledgerRowsData.length === 0}
                    currentYearMonth={currentYearMonth}
                    handleSavePayrollSettlement={handleSavePayrollSettlement}
                    payrollSettlementSaving={payrollSettlementSaving}
                    payrollSettlementLoading={payrollSettlementLoading}
                    payrollSettlementFeedback={payrollSettlementFeedback}
                    payrollSettlementDisabled={
                        payrollDataBlocked || filterMode === 'worker'
                        || filteredPaymentData.length === 0
                        || deductionApplyInProgress
                        || simplePayrollRunStatus === 'reviewed'
                        || simplePayrollRunStatus === 'confirmed'
                        || simplePayrollRunStatus === 'paid'
                        || simplePayrollRunStatus === 'mixed'
                    }
                    actionsDisabled={payrollDataBlocked}
                />
            {(loadError || payrollSettlementLoadError || payrollConfigLoadError) && (
                <div role="alert" className="my-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                    {loadError || payrollSettlementLoadError || payrollConfigLoadError}
                    <button type="button" onClick={fetchData} className="ml-3 underline">다시 조회</button>
                </div>
            )}
            <PayrollReviewCenter
                rows={payrollReviewRows}
                rangeLabel={rangeLabel}
                busy={loading || payrollSettlementLoading || deductionApplyInProgress}
                onInspect={issue => {
                    setPageViewMode(issue.target === 'ledger' ? 'ledger' : 'standard');
                    if (issue.target === 'account') setShowAccountColumns(true);
                    setExpandedRows(previous => new Set([...Array.from(previous), issue.rowId]));
                    if (issue.target !== 'ledger') requestAnimationFrame(() => {
                        document.getElementById(`payroll-review-${issue.rowId}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
                    });
                }}
            />

            {/* Hidden Batch Rendering Container - 다운로드 시에만 렌더링 (평소 불필요한 재렌더링 방지) */}
            {batchDownloading && (
                <div className="absolute left-[-9999px] top-0 pointer-events-none opacity-0 w-[1120px]">
                    {payslipPaymentData.map(item => (
                        <PayslipTemplate
                            key={`batch-${item.id}`}
                            ref={el => {
                                const elementKey = item.id;
                                batchRefs.current[elementKey] = el;
                            }}
                            data={item}
                            month={item.month}
                            contractorName={resolvedPayslipContractorName}
                            applyUtilities={utilitiesApplied}
                            insuranceTeamSiteOnly={insuranceTeamSiteOnly}
                            isTeamResponsibleSiteEntry={isEntryInWorkerTeamSite}
                        />
                    ))}
                </div>
            )}

            {errorCount > 0 && (
                <div className="flex-shrink-0 mb-2 bg-red-50 border border-red-200 text-red-700 px-2.5 py-2 rounded-lg flex items-center gap-1.5 text-base">
                    <FontAwesomeIcon icon={faExclamationTriangle} className="text-red-500" />
                    <span><strong>{errorCount}건</strong>의 계좌 정보가 누락되었습니다. 작업자 DB를 점검해주세요.</span>
                </div>
            )}

            {pageViewMode === 'standard' && (
                <div className="monthly-payroll-standard flex-1 min-h-0 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                    <div className="monthly-payroll-standard-heading p-2.5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                    <div className="flex items-center gap-2.5">
                        <h2 className="font-semibold text-lg text-slate-700">지급 대상자 목록</h2>
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={bulkDisplayContent}
                                onChange={(e) => setBulkDisplayContent(e.target.value)}
                                placeholder="표시내용 일괄입력"
                                className="border border-slate-300 rounded px-3 py-2 text-base w-40"
                            />
                            <button
                                onClick={handleBulkDisplayContentApply}
                                className="bg-slate-600 text-white px-3.5 py-2 rounded text-base hover:bg-slate-700"
                            >
                                일괄적용
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowBankCodes(true)}
                                className="bg-blue-600 text-white px-3.5 py-2 rounded text-base hover:bg-blue-700"
                                title="은행 코드 매핑표/미매핑 사유 확인"
                            >
                                은행 매핑 진단
                            </button>
                        </div>
                    </div>
                    <div className="text-base flex items-center gap-2.5">
                        <div>
                            <span className="text-slate-500 mr-2">총공수</span>
                            <span className="font-bold text-slate-800">{filteredPaymentData.reduce((sum, item) => sum + item.totalManDay, 0).toFixed(1)}</span>
                        </div>
                        <div>
                            <span className="text-slate-500 mr-2">지급전</span>
                            <span className="font-bold text-slate-800">{filteredPaymentData.reduce((sum, item) => sum + item.grossAmount, 0).toLocaleString()}원</span>
                        </div>
                        <div>
                            <span className="text-slate-500 mr-2">공제</span>
                            <span className="font-bold text-amber-700">{filteredPaymentData.reduce((sum, item) => sum + item.totalDeduction, 0).toLocaleString()}원</span>
                        </div>
                        <div>
                            <span className="text-slate-500 mr-2">실지급</span>
                            <span className="font-bold text-brand-600 text-lg">{filteredPaymentData.reduce((sum, item) => sum + item.totalAmount, 0).toLocaleString()}원</span>
                        </div>
                        <div className="mx-2 w-px h-8 bg-slate-200 hidden xl:block" />
                        <div className="bg-blue-50 px-2 py-1 rounded-lg border border-blue-100">
                            <span className="text-blue-600 text-base font-semibold mr-2">계산서용 입금</span>
                            <span className="font-bold text-blue-800">{filteredPaymentData.reduce((sum, item) => sum + item.invoiceNetAmount, 0).toLocaleString()}원</span>
                        </div>
                        <div className="bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-100">
                            <span className="text-indigo-600 text-base font-semibold mr-2">노무용 금액</span>
                            <span className="font-bold text-indigo-800">{filteredPaymentData.reduce((sum, item) => sum + item.laborNetAmount, 0).toLocaleString()}원</span>
                        </div>
                    </div>
                </div>

                    {filteredPaymentData.length > 0 && !loading && <p className="monthly-payroll-scroll-hint">좌우로 밀어 급여 항목을 확인하세요.</p>}
                    <div className="monthly-payroll-table-scroll flex-1 min-h-0 overflow-auto" role="region" aria-label="급여표 가로 스크롤" tabIndex={0}>
                    <table
                        className={`${loading || filteredPaymentData.length === 0 ? 'monthly-payroll-empty-table' : ''} w-full table-fixed text-[13px] text-left border-separate border-spacing-0`}
                    >
                        <thead className="text-slate-500 font-medium sticky top-0 z-40">
                            <tr className="border-b border-slate-200">
                                <th className="sticky top-0 left-0 z-50 bg-slate-50 px-2 py-1.5 text-center w-10 border-b border-slate-200 shadow-[inset_-1px_-1px_0_rgba(0,0,0,0.1)]"></th>
                                <th className="sticky top-0 left-[40px] z-50 bg-slate-50 px-2 py-1.5 border-b border-slate-200 w-16 shadow-[inset_0_-1px_0_rgba(0,0,0,0.1)]">월</th>
                                <th className="sticky top-0 left-[104px] z-50 bg-slate-50 px-2 py-1.5 border-b border-slate-200 w-32 shadow-[inset_-1px_-1px_0_rgba(0,0,0,0.1)]">이름</th>
                                <th className="sticky top-0 z-40 bg-slate-50 px-2 py-1.5 border-b border-slate-200 shadow-[inset_0_-1px_0_rgba(0,0,0,0.1)]">팀명</th>
                                <th className="sticky top-0 z-40 bg-slate-50 px-2 py-1.5 border-b border-slate-200 shadow-[inset_0_-1px_0_rgba(0,0,0,0.1)]">주민번호</th>
                                <th className="sticky top-0 z-40 bg-slate-50 px-2 py-1.5 border-b border-slate-200 shadow-[inset_0_-1px_0_rgba(0,0,0,0.1)]">시공사</th>
                                <th className="sticky top-0 z-40 bg-slate-50 px-2 py-1.5 border-b border-slate-200 shadow-[inset_0_-1px_0_rgba(0,0,0,0.1)]">총 공수</th>
                                <th className="sticky top-0 z-40 bg-slate-50 px-2 py-1.5 text-right border-b border-slate-200 shadow-[inset_0_-1px_0_rgba(0,0,0,0.1)]">단가</th>
                                <th className="sticky top-0 z-40 bg-slate-50 px-2 py-1.5 text-right border-b border-slate-200 shadow-[inset_0_-1px_0_rgba(0,0,0,0.1)]">지급전</th>
                                {showCalculationLabor && (
                                    <>
                                        <th className="sticky top-0 z-40 px-2 py-1.5 text-center bg-blue-50 text-blue-700 border-b border-slate-200 shadow-[inset_0_-1px_0_rgba(0,0,0,0.1)]">계산서 공수</th>
                                        <th className="sticky top-0 z-40 px-2 py-1.5 text-right bg-blue-50 text-blue-700 border-b border-slate-200 shadow-[inset_0_-1px_0_rgba(0,0,0,0.1)]">계산서 금액</th>
                                        <th className="sticky top-0 z-40 px-2 py-1.5 text-center bg-indigo-50 text-indigo-700 border-b border-slate-200 shadow-[inset_0_-1px_0_rgba(0,0,0,0.1)]">노무 공수</th>
                                        <th className="sticky top-0 z-40 px-2 py-1.5 text-right bg-indigo-50 text-indigo-700 border-b border-slate-200 shadow-[inset_0_-1px_0_rgba(0,0,0,0.1)]">노무 금액</th>
                                    </>
                                )}
                                <th className="sticky top-0 z-40 bg-slate-50 px-2 py-1.5 text-right border-b border-slate-200 shadow-[inset_0_-1px_0_rgba(0,0,0,0.1)]">공제</th>
                                <th className="sticky top-0 z-40 bg-slate-50 px-2 py-1.5 text-right border-b border-slate-200 shadow-[inset_0_-1px_0_rgba(0,0,0,0.1)]">실지급</th>
                                {showAccountColumns && (
                                    <>
                                        <th className="sticky top-0 z-40 bg-slate-50 px-2 py-1.5 border-b border-slate-200 shadow-[inset_0_-1px_0_rgba(0,0,0,0.1)]">
                                            코드
                                            <button
                                                type="button"
                                                onClick={() => setShowBankCodes(true)}
                                                className="ml-1 text-xs text-blue-600 hover:text-blue-800"
                                            >
                                                📋
                                            </button>
                                        </th>
                                        <th className="sticky top-0 z-40 bg-slate-50 px-2 py-1.5 border-b border-slate-200 shadow-[inset_0_-1px_0_rgba(0,0,0,0.1)]">은행명</th>
                                        <th className="sticky top-0 z-40 bg-slate-50 px-2 py-1.5 border-b border-slate-200 shadow-[inset_0_-1px_0_rgba(0,0,0,0.1)]">계좌번호</th>
                                        <th className="sticky top-0 z-40 bg-slate-50 px-2 py-1.5 border-b border-slate-200 shadow-[inset_0_-1px_0_rgba(0,0,0,0.1)]">예금주</th>
                                    </>
                                )}
                                <th className="sticky top-0 z-40 bg-slate-50 px-2 py-1.5 border-b border-slate-200 shadow-[inset_0_-1px_0_rgba(0,0,0,0.1)]">표시내용</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={tableColSpan} className="px-2 py-8 text-center text-slate-500">
                                        <FontAwesomeIcon icon={faSpinner} spin className="mr-2" />
                                        데이터를 불러오는 중입니다...
                                    </td>
                                </tr>
                            ) : filteredPaymentData.length === 0 ? (
                                <tr>
                                    <td colSpan={tableColSpan} className="px-2 py-8 text-center text-slate-500">
                                        해당 기간에 지급 대상자가 없습니다.
                                    </td>
                                </tr>
                            ) : (
                                filteredPaymentData.map(item => {
                                    const rowKey = item.id;
                                    const isExpanded = expandedRows.has(rowKey);
                                    // ★ 캐시에서 표시 데이터 조회 - O(1), 재계산 없음
                                    const rowDisplay = rowDisplayCache.get(item.id);
                                    if (!rowDisplay) return null;
                                    const {
                                        advanceLinesForDisplay,
                                        nonAdvanceDeductionLinesForDisplay,
                                        advanceTotalForDisplay,
                                        nonAdvanceDeductionTotalForDisplay,
                                        hasNonAdvanceDeductionLines,
                                        hasAdvanceLines,
                                        totalDeductionForDisplay,
                                        totalAmountForDisplay,
                                        insuranceTaxLines,
                                        withholdingTaxLines,
                                        businessTaxLines,
                                        otherTaxLines,
                                        insuranceSectionTaxTotal,
                                        withholdingSectionTaxTotal,
                                        businessSectionTaxTotal,
                                        otherTaxTotal,
                                        insuranceAfterTaxAmount,
                                        withholdingAfterTaxAmount,
                                        businessAfterTaxAmount,
                                        showInsuranceSection,
                                        hasInsuranceTargetSummary,
                                        withholdingDetailText,
                                    } = rowDisplay;

                                    const isMonthly = item.id.endsWith('__월급제');
                                    const isService = item.id.endsWith('__용역팀');
                                    const salaryLabel = isMonthly ? '월급제' : isService ? '용역팀' : '일급제';
                                    
                                    const rowBgClass = isMonthly 
                                        ? 'bg-blue-50/25 hover:bg-blue-50/40' 
                                        : isService 
                                            ? 'bg-orange-50/25 hover:bg-orange-50/40' 
                                            : 'bg-emerald-50/25 hover:bg-emerald-50/40';

                                    const badgeClass = isMonthly 
                                        ? 'bg-blue-100 text-blue-700' 
                                        : isService 
                                            ? 'bg-orange-100 text-orange-700' 
                                            : 'bg-emerald-100 text-emerald-700';

                                    return (
                                        <React.Fragment key={rowKey}>
                                            <tr id={`payroll-review-${item.id}`} className={`transition ${rowBgClass} ${!item.isValid ? 'bg-red-50' : ''} ${isExpanded ? 'ring-1 ring-indigo-200' : ''}`}>
                                                <td className="sticky left-0 z-20 bg-inherit px-2 py-1.5 text-center border-b border-slate-100 shadow-[inset_-1px_0_0_rgba(0,0,0,0.1)]">
                                                    <button
                                                        onClick={() => toggleRow(item.id)}
                                                        className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors ${isExpanded ? 'bg-brand-100 text-brand-600' : 'text-slate-400 hover:bg-slate-100'}`}
                                                    >
                                                        <FontAwesomeIcon icon={isExpanded ? faChevronUp : faChevronDown} className="text-xs" />
                                                    </button>
                                                </td>
                                                <td className="sticky left-[40px] z-20 bg-inherit px-2 py-1.5 font-mono text-slate-600 text-[11px] border-b border-slate-100">{item.month}</td>
                                                <td className="sticky left-[104px] z-20 bg-inherit px-2 py-1.5 font-medium text-slate-800 border-b border-slate-100 shadow-[inset_-1px_0_0_rgba(0,0,0,0.1)]">
                                                    <div className="flex items-center gap-1.5">
                                                        <span>{item.workerName}</span>
                                                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${badgeClass}`}>
                                                            {salaryLabel}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-2 py-1.5 text-slate-600 border-b border-slate-100">{item.teamName}</td>
                                                <td className="px-2 py-1.5 text-slate-600 font-mono text-[11px] border-b border-slate-100">{item.idNumber || '-'}</td>
                                                <td className="px-2 py-1.5 text-slate-600 border-b border-slate-100">{item.companyName || '-'}</td>
                                                <td className="px-2 py-1.5 text-slate-600 border-b border-slate-100">{Number(item.totalManDay).toFixed(1)}</td>
                                                <td className="px-2 py-1.5 text-right text-slate-600 border-b border-slate-100">{item.unitPrice.toLocaleString()}</td>
                                                <td className="px-2 py-1.5 text-right text-slate-600 border-b border-slate-100">{item.grossAmount.toLocaleString()}</td>
                                                {showCalculationLabor && (
                                                    <>
                                                        <td className="px-2 py-1.5 text-center text-blue-600 border-b border-slate-100 bg-blue-50/20">{item.invoiceManDay.toFixed(1)}</td>
                                                        <td className="px-2 py-1.5 text-right text-blue-600 border-b border-slate-100 bg-blue-50/20">{item.invoiceNetAmount.toLocaleString()}</td>
                                                        <td className="px-2 py-1.5 text-center text-indigo-600 border-b border-slate-100 bg-indigo-50/20">{item.laborManDay.toFixed(1)}</td>
                                                        <td className="px-2 py-1.5 text-right text-indigo-600 border-b border-slate-100 bg-indigo-50/20">{item.laborNetAmount.toLocaleString()}</td>
                                                    </>
                                                )}
                                                <td className="px-2 py-1.5 text-right text-amber-700 font-semibold border-b border-slate-100">{totalDeductionForDisplay.toLocaleString()}</td>
                                                <td className="px-2 py-1.5 text-right font-bold text-brand-600 border-b border-slate-100">{totalAmountForDisplay.toLocaleString()}</td>
                                                {showAccountColumns && (
                                                    <>
                                                        <td className={`px-2 py-1.5 border-b border-slate-100 ${item.errors.bankCode ? 'text-red-600 font-bold' : 'text-slate-600'}`}>
                                                            {resolveBankCode(item.bankName, item.bankCode) || `미매핑(${item.bankName || '은행명없음'})`}
                                                        </td>
                                                        <td className={`px-2 py-1.5 border-b border-slate-100 ${item.errors.bankName ? 'text-red-600 font-bold' : 'text-slate-600'}`}>{item.bankName || '(미입력)'}</td>
                                                        <td className={`px-2 py-1.5 border-b border-slate-100 ${item.errors.accountNumber ? 'text-red-600 font-bold' : 'text-slate-600'}`}>{item.accountNumber || '(미입력)'}</td>
                                                        <td className={`px-2 py-1.5 border-b border-slate-100 ${item.errors.accountHolder ? 'text-red-600 font-bold' : 'text-slate-600'}`}>{item.accountHolder || '(미입력)'}</td>
                                                    </>
                                                )}
                                                <td className="px-2 py-1.5 border-b border-slate-100">
                                                    <input
                                                        type="text"
                                                        value={item.displayContent}
                                                        onChange={(e) => handleDisplayContentChange(item.id, e.target.value)}
                                                        className="border border-slate-300 rounded px-2 py-1 text-xs w-full focus:border-brand-500 outline-none"
                                                    />
                                                </td>
                                            </tr>
                                            {isExpanded && (
                                                <tr>
                                                    <td colSpan={tableColSpan + 1} className="p-0 border-b border-slate-200 bg-slate-50/50">
                                                        <div className="p-4 pl-12">
                                                            <div className="flex flex-col xl:flex-row gap-6">
                                                                {/* 근무 내역 */}
                                                                <div className="flex-1 space-y-2">
                                                                    <div className="flex items-center justify-between">
                                                                        <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                                                            <span className="w-1 h-4 bg-brand-500 rounded-full"></span>
                                                                            근무내역
                                                                        </h4>
                                                                        <span className="text-xs text-slate-500 font-mono bg-white px-2 py-0.5 rounded border border-slate-200">
                                                                            총 {item.workEntries.length}건
                                                                        </span>
                                                                    </div>
                                                                    {item.workEntries.length > 0 ? (
                                                                        <div className="border border-slate-200 rounded-lg bg-white shadow-sm overflow-hidden">
                                                                            <table className="w-full text-xs">
                                                                                <thead className="bg-slate-50 text-slate-500">
                                                                                    <tr>
                                                                                        <th className="px-3 py-2 text-left font-medium border-b border-slate-100 w-24">일자</th>
                                                                                        <th className="px-3 py-2 text-left font-medium border-b border-slate-100 w-16">분류</th>
                                                                            <th className="px-3 py-2 text-left font-medium border-b border-slate-100">현장</th>
                                                                                        <th className="px-3 py-2 text-center font-medium border-b border-slate-100 w-16">구분</th>
                                                                                        <th className="px-3 py-2 text-right font-medium border-b border-slate-100 w-16">공수</th>
                                                                                        <th className="px-3 py-2 text-right font-medium border-b border-slate-100 w-24">단가</th>
                                                                                        <th className="px-3 py-2 text-right font-medium border-b border-slate-100 w-24">금액</th>
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody className="divide-y divide-slate-100">
                                                                                    {item.workEntries.map((entry: WorkerWorkEntry, idx: number) => (
                                                                                        <tr key={`${entry.date}-${idx}`} className="hover:bg-indigo-50/30">
                                                                                            <td className="px-3 py-2 font-mono text-slate-600">{entry.date}</td>
                                                                                            <td className="px-3 py-2">
                                                                                    {entry.assignmentType === 'corporate' ? (
                                                                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-800">
                                                                                            법인
                                                                                        </span>
                                                                                    ) : entry.assignmentType === 'labor' ? (
                                                                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-800">
                                                                                            노무
                                                                                        </span>
                                                                                    ) : (
                                                                                        <span className="text-slate-400 text-center block">-</span>
                                                                                    )}
                                                                                </td>
                                                                                <td className="px-3 py-2 text-slate-700">{entry.siteName}</td>
                                                                                            <td className="px-3 py-2 text-center text-slate-500">{entry.paymentMethod || '-'}</td>
                                                                                            <td className="px-3 py-2 text-right font-medium text-slate-700">{entry.manDay.toFixed(1)}</td>
                                                                                            <td className="px-3 py-2 text-right text-slate-600">{entry.unitPrice.toLocaleString()}</td>
                                                                                            <td className="px-3 py-2 text-right font-medium text-slate-800">{(entry.amount || 0).toLocaleString()}</td>
                                                                                        </tr>
                                                                                    ))}
                                                                                </tbody>
                                                                                <tfoot className="bg-slate-50 font-semibold text-slate-700">
                                                                                    <tr>
                                                                                        <td colSpan={4} className="px-3 py-2 text-right">합계</td>
                                                                                        <td className="px-3 py-2 text-right text-indigo-600">{item.totalManDay.toFixed(1)}</td>
                                                                                        <td className="px-3 py-2"></td>
                                                                                        <td className="px-3 py-2 text-right text-indigo-600">{item.grossAmount.toLocaleString()}</td>
                                                                                    </tr>
                                                                                    {(item.laborGrossAmount > 0 && item.invoiceGrossAmount > 0) && (
                                                                                        <tr className="text-[10px] font-normal text-slate-500 bg-white border-t border-slate-100">
                                                                                            <td colSpan={6} className="px-3 py-1 text-right">
                                                                                                (노무용: {item.laborGrossAmount.toLocaleString()} / 계산서용: {item.invoiceGrossAmount.toLocaleString()})
                                                                                            </td>
                                                                                            <td></td>
                                                                                        </tr>
                                                                                    )}
                                                                                </tfoot>
                                                                            </table>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="p-4 border border-dashed border-slate-300 rounded-lg text-center text-xs text-slate-500 bg-white">
                                                                            근무내역이 없습니다.
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                {/* 공제 내역 */}
                                                                <div className="flex-1 space-y-2">
                                                                    <div className="flex items-center justify-between">
                                                                        <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                                                            <span className="w-1 h-4 bg-amber-500 rounded-full"></span>
                                                                            공제내역
                                                                        </h4>
                                                                        <span className="text-xs text-slate-500 font-mono bg-white px-2 py-0.5 rounded border border-slate-200">
                                                                            총 {nonAdvanceDeductionLinesForDisplay.length}건
                                                                        </span>
                                                                    </div>
                                                                    {hasNonAdvanceDeductionLines ? (
                                                                        <div className="border border-slate-200 rounded-lg bg-white shadow-sm overflow-hidden">
                                                                            <table className="w-full text-xs">
                                                                                <thead className="bg-slate-50 text-slate-500">
                                                                                    <tr>
                                                                                        <th className="px-3 py-2 text-left font-medium border-b border-slate-100">항목</th>
                                                                                        <th className="px-3 py-2 text-right font-medium border-b border-slate-100 w-32">금액</th>
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody className="divide-y divide-slate-100">
                                                                                    {nonAdvanceDeductionLinesForDisplay.map((line, idx) => (
                                                                                        <tr key={`deduction-${line.label}-${idx}`} className="hover:bg-amber-50/30">
                                                                                            <td className="px-3 py-2 text-slate-700">{line.label}</td>
                                                                                            <td className="px-3 py-2 text-right text-red-600 font-medium">-{line.amount.toLocaleString()}</td>
                                                                                        </tr>
                                                                                    ))}
                                                                                </tbody>
                                                                                <tfoot className="bg-amber-50 font-bold text-amber-800">
                                                                                    <tr>
                                                                                        <td className="px-3 py-2 text-right">공제 합계</td>
                                                                                        <td className="px-3 py-2 text-right">-{nonAdvanceDeductionTotalForDisplay.toLocaleString()}</td>
                                                                                    </tr>
                                                                                </tfoot>
                                                                            </table>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="p-4 border border-dashed border-slate-300 rounded-lg text-center text-xs text-slate-500 bg-white">
                                                                            공제 내역이 없습니다.
                                                                        </div>
                                                                    )}

                                                                    <div className="flex items-center justify-between">
                                                                        <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                                                            <span className="w-1 h-4 bg-yellow-500 rounded-full"></span>
                                                                            가불내역
                                                                        </h4>
                                                                        <span className="text-xs text-slate-500 font-mono bg-white px-2 py-0.5 rounded border border-slate-200">
                                                                            총 {advanceLinesForDisplay.length}건
                                                                        </span>
                                                                    </div>
                                                                    {hasAdvanceLines ? (
                                                                        <div className="border border-yellow-200 rounded-lg bg-white shadow-sm overflow-hidden">
                                                                            <table className="w-full text-xs">
                                                                                <thead className="bg-yellow-50 text-yellow-800">
                                                                                    <tr>
                                                                                        <th className="px-3 py-2 text-left font-medium border-b border-yellow-100">항목</th>
                                                                                        <th className="px-3 py-2 text-right font-medium border-b border-yellow-100 w-32">금액</th>
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody className="divide-y divide-yellow-100">
                                                                                    {advanceLinesForDisplay.map((line, idx) => (
                                                                                        <tr key={`advance-${line.label}-${idx}`} className="hover:bg-yellow-50/40">
                                                                                            <td className="px-3 py-2 text-slate-700">{line.label}</td>
                                                                                            <td className="px-3 py-2 text-right text-red-600 font-medium">-{line.amount.toLocaleString()}</td>
                                                                                        </tr>
                                                                                    ))}
                                                                                </tbody>
                                                                                <tfoot className="bg-yellow-50 font-bold text-yellow-900">
                                                                                    <tr>
                                                                                        <td className="px-3 py-2 text-right">가불 합계</td>
                                                                                        <td className="px-3 py-2 text-right">-{advanceTotalForDisplay.toLocaleString()}</td>
                                                                                    </tr>
                                                                                </tfoot>
                                                                            </table>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="p-4 border border-dashed border-yellow-300 rounded-lg text-center text-xs text-slate-500 bg-white">
                                                                            가불 내역이 없습니다.
                                                                        </div>
                                                                    )}

                                                                    <div className="mt-4" />

                                                                    <div className="flex items-center justify-between">
                                                                        <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                                                            <span className="w-1 h-4 bg-rose-500 rounded-full"></span>
                                                                            세금내역
                                                                        </h4>
                                                                        <span className="text-xs text-slate-500 font-mono bg-white px-2 py-0.5 rounded border border-slate-200">
                                                                            총 {(item.taxBreakdown.standardLines.length + item.taxBreakdown.additionalLines.length)}건
                                                                        </span>
                                                                    </div>
                                                                    {showInsuranceSection && (
                                                                        <div className="border border-emerald-200 bg-emerald-50 rounded-lg p-3 text-xs">
                                                                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                                                                                <div className="text-emerald-800 font-bold">
                                                                                    {hasInsuranceTargetSummary
                                                                                        ? `4대보험 적용 공수 ${item.insuranceAppliedSummary!.appliedManDay.toFixed(1)} (기준 ${item.insuranceAppliedSummary!.thresholdManDay})`
                                                                                        : '4대보험 공제내역'}
                                                                                </div>
                                                                                <div className="text-emerald-700 font-mono">
                                                                                    {hasInsuranceTargetSummary
                                                                                        ? `대상금액 ${item.insuranceAppliedSummary!.appliedAmount.toLocaleString()}원`
                                                                                        : `공제금액 ${insuranceSectionTaxTotal.toLocaleString()}원`}
                                                                                </div>
                                                                            </div>
                                                                            {hasInsuranceTargetSummary && (
                                                                                <div className="mt-2 border border-emerald-200 rounded bg-white overflow-hidden">
                                                                                    <table className="w-full text-xs">
                                                                                        <thead className="bg-emerald-100 text-emerald-800">
                                                                                            <tr>
                                                                                                <th className="px-2 py-1 text-left font-bold">대상 현장</th>
                                                                                                <th className="px-2 py-1 text-center font-bold w-20">사유</th>
                                                                                                <th className="px-2 py-1 text-right font-bold w-16">공수</th>
                                                                                                <th className="px-2 py-1 text-right font-bold w-24">금액</th>
                                                                                            </tr>
                                                                                        </thead>
                                                                                        <tbody className="divide-y divide-emerald-100">
                                                                                            {(item.insuranceAppliedSummary?.appliedSites ?? []).map((s: InsuranceAppliedSiteSummary) => (
                                                                                                <tr key={`ins-site-${s.siteId}`}>
                                                                                                    <td className="px-2 py-1 text-slate-700">{s.siteName}</td>
                                                                                                    <td className="px-2 py-1 text-center text-emerald-700 font-semibold">
                                                                                                        {s.reason === 'site' ? '노무현장8+' : '발주8+'}
                                                                                                    </td>
                                                                                                    <td className="px-2 py-1 text-right font-mono text-slate-700">{s.manDay.toFixed(1)}</td>
                                                                                                    <td className="px-2 py-1 text-right font-mono text-slate-700">{s.amount.toLocaleString()}</td>
                                                                                                </tr>
                                                                                            ))}
                                                                                        </tbody>
                                                                                    </table>
                                                                                </div>
                                                                            )}
                                                                            <div className="mt-2 border border-emerald-200 rounded bg-white overflow-hidden">
                                                                                <table className="w-full text-xs">
                                                                                    <thead className="bg-emerald-100 text-emerald-800">
                                                                                        <tr>
                                                                                            <th className="px-2 py-1 text-left font-bold">공제내역</th>
                                                                                            <th className="px-2 py-1 text-center font-bold w-20">세액요율</th>
                                                                                            <th className="px-2 py-1 text-right font-bold w-24">금액</th>
                                                                                        </tr>
                                                                                    </thead>
                                                                                    <tbody className="divide-y divide-emerald-100">
                                                                                        {insuranceTaxLines.map((line, idx) => (
                                                                                            <tr key={`ins-tax-${idx}`}>
                                                                                                <td className="px-2 py-1 text-slate-700">{line.label}</td>
                                                                                                <td className="px-2 py-1 text-center font-mono text-slate-600">{resolveTaxLineRateText(line.label, item.taxRateSnapshot)}</td>
                                                                                                <td className="px-2 py-1 text-right font-mono text-slate-700">-{line.amount.toLocaleString()}</td>
                                                                                            </tr>
                                                                                        ))}
                                                                                    </tbody>
                                                                                    <tfoot className="bg-emerald-50 font-bold text-emerald-900">
                                                                                        <tr>
                                                                                            <td className="px-2 py-1 text-right" colSpan={2}>합계</td>
                                                                                            <td className="px-2 py-1 text-right">-{insuranceSectionTaxTotal.toLocaleString()}</td>
                                                                                        </tr>
                                                                                    </tfoot>
                                                                                </table>
                                                                            </div>
                                                                            {hasInsuranceTargetSummary && (
                                                                                <div className="mt-2 border border-emerald-200 rounded bg-white overflow-hidden">
                                                                                    <table className="w-full text-xs">
                                                                                        <tbody>
                                                                                            <tr className="bg-emerald-50">
                                                                                                <td className="px-2 py-1.5 text-center text-emerald-900 font-bold w-1/4">세전 금액</td>
                                                                                                <td className="px-2 py-1.5 text-right font-mono text-slate-800 w-1/4">{item.insuranceAppliedSummary!.appliedAmount.toLocaleString()}</td>
                                                                                                <td className="px-2 py-1.5 text-center text-emerald-900 font-bold w-1/4">세후 금액</td>
                                                                                                <td className="px-2 py-1.5 text-right font-mono text-emerald-700 font-bold w-1/4">{insuranceAfterTaxAmount.toLocaleString()}</td>
                                                                                            </tr>
                                                                                        </tbody>
                                                                                    </table>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                    {item.withholdingAppliedSummary && (item.withholdingAppliedSummary.appliedManDay ?? 0) > 0 && (
                                                                        <div className="border border-amber-200 bg-amber-50 rounded-lg p-3 text-xs mt-2">
                                                                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                                                                                <div className="text-amber-900 font-bold">
                                                                                    갑근세·지방세 적용공수 {(item.withholdingAppliedSummary.appliedManDay ?? 0).toFixed(1)}공수
                                                                                    {(item.withholdingAppliedSummary.thresholdManDay ?? item.withholdingAppliedSummary.thresholdDays ?? 0) > 0
                                                                                        ? ` (기준 ${item.withholdingAppliedSummary.thresholdManDay ?? item.withholdingAppliedSummary.thresholdDays ?? 0}공수 이하)`
                                                                                        : ' (노무 전체 공수 적용)'}
                                                                                </div>
                                                                                <div className="text-amber-800 font-mono">
                                                                                    과세대상금액 {item.withholdingAppliedSummary.appliedAmount.toLocaleString()}원
                                                                                </div>
                                                                            </div>
                                                                            <div className="mt-2 border border-amber-200 rounded bg-white overflow-hidden">
                                                                                <table className="w-full text-xs">
                                                                                    <thead className="bg-amber-100 text-amber-900">
                                                                                        <tr>
                                                                                            <th className="px-2 py-1 text-left font-bold">대상 현장</th>
                                                                                            <th className="px-2 py-1 text-center font-bold w-24">사유</th>
                                                                                            <th className="px-2 py-1 text-right font-bold w-16">공수</th>
                                                                                            <th className="px-2 py-1 text-right font-bold w-24">금액</th>
                                                                                        </tr>
                                                                                    </thead>
                                                                                    <tbody className="divide-y divide-amber-100">
                                                                                        {(item.withholdingAppliedSummary.appliedSites ?? []).map((s: WithholdingAppliedSiteSummary) => (
                                                                                            <tr key={`withholding-site-${s.siteId}`}>
                                                                                                <td className="px-2 py-1 text-slate-700">{s.siteName}</td>
                                                                                                <td className="px-2 py-1 text-center text-amber-700 font-semibold">
                                                                                                    {s.reason === '노무전체' ? '노무전체' : '노무-7'}
                                                                                                </td>
                                                                                                <td className="px-2 py-1 text-right font-mono text-slate-700">{s.manDay.toFixed(1)}</td>
                                                                                                <td className="px-2 py-1 text-right font-mono text-slate-700">{s.amount.toLocaleString()}</td>
                                                                                            </tr>
                                                                                        ))}
                                                                                    </tbody>
                                                                                </table>
                                                                            </div>
                                                                            <div className="mt-2 border border-amber-200 rounded bg-white overflow-hidden">
                                                                                <table className="w-full text-xs">
                                                                                    <thead className="bg-amber-100 text-amber-900">
                                                                                        <tr>
                                                                                            <th className="px-2 py-1 text-left font-bold">공제내역</th>
                                                                                            <th className="px-2 py-1 text-center font-bold w-20">세액요율</th>
                                                                                            <th className="px-2 py-1 text-right font-bold w-24">금액</th>
                                                                                        </tr>
                                                                                    </thead>
                                                                                    <tbody className="divide-y divide-amber-100">
                                                                                        {withholdingTaxLines.map((line, idx) => (
                                                                                            <tr key={`withholding-tax-${idx}`}>
                                                                                                <td className="px-2 py-1 text-slate-700">{line.label}</td>
                                                                                                <td className="px-2 py-1 text-center font-mono text-slate-600">{resolveTaxLineRateText(line.label, item.taxRateSnapshot)}</td>
                                                                                                <td className="px-2 py-1 text-right font-mono text-slate-700">-{line.amount.toLocaleString()}</td>
                                                                                            </tr>
                                                                                        ))}
                                                                                    </tbody>
                                                                                    <tfoot className="bg-amber-50 font-bold text-amber-900">
                                                                                        <tr>
                                                                                            <td className="px-2 py-1 text-right" colSpan={2}>합계</td>
                                                                                            <td className="px-2 py-1 text-right">-{withholdingSectionTaxTotal.toLocaleString()}</td>
                                                                                        </tr>
                                                                                        <tr className="font-normal text-[10px] text-amber-900/90">
                                                                                            <td className="px-2 py-1 text-left" colSpan={3}>{withholdingDetailText}</td>
                                                                                        </tr>
                                                                                    </tfoot>
                                                                                </table>
                                                                            </div>
                                                                            <div className="mt-2 border border-amber-200 rounded bg-white overflow-hidden">
                                                                                <table className="w-full text-xs">
                                                                                    <tbody>
                                                                                        <tr className="bg-amber-50">
                                                                                            <td className="px-2 py-1.5 text-center text-amber-900 font-bold w-1/4">세전 금액</td>
                                                                                            <td className="px-2 py-1.5 text-right font-mono text-slate-800 w-1/4">{toNumber(item.withholdingAppliedSummary.grossAmount ?? item.withholdingAppliedSummary.appliedAmount).toLocaleString()}</td>
                                                                                            <td className="px-2 py-1.5 text-center text-amber-900 font-bold w-1/4">세후 금액</td>
                                                                                            <td className="px-2 py-1.5 text-right font-mono text-amber-700 font-bold w-1/4">{withholdingAfterTaxAmount.toLocaleString()}</td>
                                                                                        </tr>
                                                                                    </tbody>
                                                                                </table>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                    {item.businessIncomeAppliedSummary && (item.businessIncomeAppliedSummary.appliedManDay ?? 0) > 0 && (
                                                                        <div className="border border-sky-200 bg-sky-50 rounded-lg p-3 text-xs mt-2">
                                                                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                                                                                <div className="text-sky-900 font-bold">
                                                                                    사업소득 3.3% 적용 공수 {(item.businessIncomeAppliedSummary.appliedManDay ?? 0).toFixed(1)}
                                                                                </div>
                                                                                <div className="text-sky-800 font-mono">
                                                                                    대상금액 {item.businessIncomeAppliedSummary.appliedAmount.toLocaleString()}원
                                                                                </div>
                                                                            </div>
                                                                            <div className="mt-2 border border-sky-200 rounded bg-white overflow-hidden">
                                                                                <table className="w-full text-xs">
                                                                                    <thead className="bg-sky-100 text-sky-900">
                                                                                        <tr>
                                                                                            <th className="px-2 py-1 text-left font-bold">대상 현장</th>
                                                                                            <th className="px-2 py-1 text-center font-bold w-24">사유</th>
                                                                                            <th className="px-2 py-1 text-right font-bold w-16">공수</th>
                                                                                            <th className="px-2 py-1 text-right font-bold w-24">금액</th>
                                                                                        </tr>
                                                                                    </thead>
                                                                                    <tbody className="divide-y divide-sky-100">
                                                                                        {(item.businessIncomeAppliedSummary.appliedSites ?? []).map((s: BusinessIncomeAppliedSiteSummary) => (
                                                                                            <tr key={`biz-site-${s.siteId}`}>
                                                                                                <td className="px-2 py-1 text-slate-700">{s.siteName}</td>
                                                                                                <td className="px-2 py-1 text-center text-sky-700 font-semibold">4대보험·갑근세 제외</td>
                                                                                                <td className="px-2 py-1 text-right font-mono text-slate-700">{s.manDay.toFixed(1)}</td>
                                                                                                <td className="px-2 py-1 text-right font-mono text-slate-700">{s.amount.toLocaleString()}</td>
                                                                                            </tr>
                                                                                        ))}
                                                                                    </tbody>
                                                                                </table>
                                                                            </div>
                                                                            <div className="mt-2 border border-sky-200 rounded bg-white overflow-hidden">
                                                                                <table className="w-full text-xs">
                                                                                    <thead className="bg-sky-100 text-sky-900">
                                                                                        <tr>
                                                                                            <th className="px-2 py-1 text-left font-bold">공제내역</th>
                                                                                            <th className="px-2 py-1 text-center font-bold w-20">세액요율</th>
                                                                                            <th className="px-2 py-1 text-right font-bold w-24">금액</th>
                                                                                        </tr>
                                                                                    </thead>
                                                                                    <tbody className="divide-y divide-sky-100">
                                                                                        {businessTaxLines.map((line, idx) => (
                                                                                            <tr key={`biz-tax-${idx}`}>
                                                                                                <td className="px-2 py-1 text-slate-700">{line.label}</td>
                                                                                                <td className="px-2 py-1 text-center font-mono text-slate-600">{resolveTaxLineRateText(line.label, item.taxRateSnapshot)}</td>
                                                                                                <td className="px-2 py-1 text-right font-mono text-slate-700">-{line.amount.toLocaleString()}</td>
                                                                                            </tr>
                                                                                        ))}
                                                                                    </tbody>
                                                                                    <tfoot className="bg-sky-50 font-bold text-sky-900">
                                                                                        <tr>
                                                                                            <td className="px-2 py-1 text-right" colSpan={2}>합계</td>
                                                                                            <td className="px-2 py-1 text-right">-{businessSectionTaxTotal.toLocaleString()}</td>
                                                                                        </tr>
                                                                                    </tfoot>
                                                                                </table>
                                                                            </div>
                                                                            <div className="mt-2 border border-sky-200 rounded bg-white overflow-hidden">
                                                                                <table className="w-full text-xs">
                                                                                    <tbody>
                                                                                        <tr className="bg-sky-50">
                                                                                            <td className="px-2 py-1.5 text-center text-sky-900 font-bold w-1/4">세전 금액</td>
                                                                                            <td className="px-2 py-1.5 text-right font-mono text-slate-800 w-1/4">{item.businessIncomeAppliedSummary.appliedAmount.toLocaleString()}</td>
                                                                                            <td className="px-2 py-1.5 text-center text-sky-900 font-bold w-1/4">세후 금액</td>
                                                                                            <td className="px-2 py-1.5 text-right font-mono text-sky-700 font-bold w-1/4">{businessAfterTaxAmount.toLocaleString()}</td>
                                                                                        </tr>
                                                                                    </tbody>
                                                                                </table>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                    {otherTaxLines.length > 0 ? (
                                                                        <div className="border border-slate-200 rounded-lg bg-white shadow-sm overflow-hidden">
                                                                            <table className="w-full text-xs">
                                                                                <thead className="bg-slate-50 text-slate-500">
                                                                                    <tr>
                                                                                        <th className="px-3 py-2 text-left font-medium border-b border-slate-100">항목</th>
                                                                                        <th className="px-3 py-2 text-center font-medium border-b border-slate-100 w-24">세액요율</th>
                                                                                        <th className="px-3 py-2 text-right font-medium border-b border-slate-100 w-32">금액</th>
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody className="divide-y divide-slate-100">
                                                                                    {otherTaxLines.map((line, idx) => (
                                                                                        <tr key={`tax-${line.label}-${idx}`} className="hover:bg-rose-50/30">
                                                                                            <td className="px-3 py-2 text-slate-700">{line.label}</td>
                                                                                            <td className="px-3 py-2 text-center font-mono text-slate-600">{resolveTaxLineRateText(line.label, item.taxRateSnapshot)}</td>
                                                                                            <td className="px-3 py-2 text-right text-red-600 font-medium">-{line.amount.toLocaleString()}</td>
                                                                                        </tr>
                                                                                    ))}
                                                                                </tbody>
                                                                                <tfoot className="bg-rose-50 font-bold text-rose-800">
                                                                                    <tr>
                                                                                        <td className="px-3 py-2 text-right" colSpan={2}>세금 합계</td>
                                                                                        <td className="px-3 py-2 text-right">-{otherTaxTotal.toLocaleString()}</td>
                                                                                    </tr>
                                                                                </tfoot>
                                                                            </table>
                                                                        </div>
                                                                    ) : null}

                                                                    <div className="mt-2 border-t border-slate-200 pt-2 text-xs text-slate-600 space-y-1">
                                                                        <div className="flex items-center justify-between">
                                                                            <span className="font-bold text-slate-700">세전 금액</span>
                                                                            <span className="font-mono text-slate-800 font-bold">{item.grossAmount.toLocaleString()}</span>
                                                                        </div>
                                                                        <div className="flex items-center justify-between">
                                                                            <span className="font-bold text-slate-700">세후 금액</span>
                                                                            <span className="font-mono text-emerald-700 font-bold">{item.totalAmount.toLocaleString()}</span>
                                                                        </div>
                                                                        <div className="flex items-center justify-between">
                                                                            <span className="font-bold text-slate-700">총 차감액(공제+세금)</span>
                                                                            <span className="font-mono text-red-700 font-bold">-{item.totalDeduction.toLocaleString()}</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            )}

            {pageViewMode === 'simple' && (
                <SimplePayrollClosingTable
                    rangeLabel={rangeLabel}
                    rows={simplePayrollClosingRows}
                    onOpenDetailed={() => setPageViewMode('standard')}
                    onOpenLedger={() => setPageViewMode('ledger')}
                    runStatus={simplePayrollRunStatus}
                    statusActionDisabled={payrollDataBlocked || filterMode === 'worker' || simplePayrollRunStatus === 'mixed'}
                    statusActionLoading={payrollSettlementSaving || payrollSettlementLoading}
                    onSaveDraft={handleSavePayrollSettlement}
                    onMarkReviewed={() => handlePayrollRunTransition('reviewed')}
                    onConfirm={() => handlePayrollRunTransition('confirmed')}
                    onMarkPaid={() => handlePayrollRunTransition('paid')}
                />
            )}

            {pageViewMode === 'ledger' && (
                <div className="monthly-payroll-ledger-panel flex-1 min-h-0 flex flex-col overflow-hidden">
                    <fieldset disabled={payrollDataBlocked} className="m-0 flex min-h-0 min-w-0 flex-1 flex-col border-0 p-0">
                    <MonthlyAdvanceLedger
                        ref={advanceLedgerRef}
                        rows={ledgerRows}
                        payrollConfig={payrollConfig}
                        advanceItemLabels={payrollConfig?.advanceItemLabels}
                        withholdingThreshold={WITHHOLDING_MAX_MAN_DAY}
                        applyUtilities={utilitiesApplied}
                        applyInsurance={insuranceApplied}
                        applyBusinessIncome={businessIncomeApplied}
                        applyDailyFee={dailyFeeApplied}
                        insuranceTeamSiteOnly={insuranceTeamSiteOnly}
                        isInsuranceEligibleEntry={isLedgerInsuranceEligibleEntry}
                        clientCompanyNameById={companyNameById}
                        onInputsChange={setLedgerInputs}
                        onComputedAmountsChange={setLedgerComputedAmounts}
                        initialInputs={initialLedgerInputs}
                        visibleSections={ledgerVisibleSections}
                    />
                    </fieldset>
                </div>
            )}

            </div>

            {showKBPreview && (
                    <KBPreviewPanel aria-labelledby="kb-preview-title">
                        <KBPreviewHeader>
                            <KBPreviewTitleRow>
                                <KBPreviewTitleBlock>
                                    <KBPreviewTitle id="kb-preview-title" ref={kbPreviewTitleRef} tabIndex={-1}>국민은행용 엑셀 미리보기</KBPreviewTitle>
                                    <KBPreviewDescription>현재 조회·공제 기준</KBPreviewDescription>
                                </KBPreviewTitleBlock>
                                <KBPreviewCloseButton type="button" onClick={() => handleKBPreviewVisibilityChange(false)}>
                                    ← 급여 화면으로
                                </KBPreviewCloseButton>
                            </KBPreviewTitleRow>

                            <div className="rounded-lg border border-amber-400/40 bg-amber-400/10 px-2 py-1.5">
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                <span className="shrink-0 text-xs font-bold text-amber-300">작업자 입금계좌 변경</span>
                                <div className="min-w-0 flex-[1_1_300px]">
                                    <PagePrimaryAccountCard state={pagePrimaryAccount} inline />
                                </div>
                                <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="whitespace-nowrap text-xs font-bold text-slate-200">
                                        선택 {kbSelectedTransferRowIds.size}명 · 적용 {kbAppliedPrimaryAccountCount}명
                                    </span>
                                    <button
                                        type="button"
                                        onClick={handleApplyPrimaryAccountToSelectedRows}
                                        disabled={!primaryAccount || kbSelectedTransferRowIds.size === 0}
                                        title="선택한 작업자의 이체용 계좌만 대표계좌로 변경합니다."
                                        aria-describedby="kb-account-hint"
                                        className="min-h-[28px] whitespace-nowrap rounded-md border border-amber-300 bg-amber-400 px-2 text-xs font-bold text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:border-slate-600 disabled:bg-slate-700 disabled:text-slate-400"
                                    >
                                        선택 → 대표계좌
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleRestoreSelectedWorkerAccounts}
                                        disabled={kbSelectedTransferRowIds.size === 0}
                                        title="선택한 작업자의 원래 입금계좌로 되돌립니다."
                                        className="min-h-[28px] whitespace-nowrap rounded-md border border-slate-600 bg-slate-800 px-2 text-xs font-bold text-slate-100 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                        원계좌 복원
                                    </button>
                                </div>
                                </div>
                                <p id="kb-account-hint" className="mt-1 text-[11px] leading-snug text-slate-300">아래 작업자를 선택한 뒤 대표계좌를 적용하면 해당 작업자의 국민은행 이체 계좌만 변경됩니다.</p>
                            </div>

                            <KBPreviewControlsGrid>
                                <KBPreviewFieldCard>
                                    <KBPreviewFieldLabel htmlFor="kb-receiver-display">받는분통장표시</KBPreviewFieldLabel>
                                    <KBPreviewInput
                                        id="kb-receiver-display"
                                        type="text"
                                        value={kbReceiverDisplay}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            setKbReceiverDisplay(value);
                                            updateKBPreviewSnapshotFromControls({ receiverDisplay: value });
                                        }}
                                        placeholder="㈜다원"
                                        aria-describedby="kb-receiver-display-hint"
                                    />
                                    <KBPreviewFieldHint id="kb-receiver-display-hint">은행 업로드 파일의 D열에 동일하게 들어갑니다.</KBPreviewFieldHint>
                                </KBPreviewFieldCard>

                                <KBPreviewFieldCard>
                                    <KBPreviewFieldLabel htmlFor="kb-memo-suffix">내통장메모 규칙</KBPreviewFieldLabel>
                                    <KBPreviewInput
                                        id="kb-memo-suffix"
                                        type="text"
                                        value={kbMemoSuffix}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            setKbMemoSuffix(value);
                                            updateKBPreviewSnapshotFromControls({ memoSuffix: value });
                                        }}
                                        placeholder="{이름} 가불"
                                        aria-describedby="kb-memo-suffix-hint"
                                    />
                                    <KBPreviewFieldHint id="kb-memo-suffix-hint">{'{이름}'} 치환자를 쓰면 작업자 이름 뒤에 자동으로 붙습니다.</KBPreviewFieldHint>
                                </KBPreviewFieldCard>

                                <KBPreviewFieldCard>
                                    <KBPreviewFieldLabel htmlFor="kb-amount-type">이체금액 적용 기준</KBPreviewFieldLabel>
                                    <KBPreviewSelect
                                        id="kb-amount-type"
                                        aria-describedby="kb-amount-type-hint"
                                        value={kbAmountType}
                                        onChange={(e) => {
                                            const value = e.target.value as KBAmountType;
                                            setKbAmountType(value);
                                            updateKBPreviewSnapshotFromControls({ amountType: value });
                                        }}
                                    >
                                        <option value="totalAmount">현재 화면 실지급액</option>
                                        <option value="invoiceNet">공제후 법인총액</option>
                                        <option value="laborNet">공제후 노무총액</option>
                                        <option value="invoiceAdvance">법인가불 총액</option>
                                        <option value="laborAdvance">노무가불 총액</option>
                                        {(() => {
                                            const al = { ...DEFAULT_ADVANCE_ITEM_LABELS, ...(payrollConfig?.advanceItemLabels ?? {}) };
                                            return (
                                                <>
                                                    <option disabled>── 법인가불 개별 ──</option>
                                                    <option value="corporateAdvance1">{al.corporateAdvance1}</option>
                                                    <option value="corporateAdvance2">{al.corporateAdvance2}</option>
                                                    <option value="corporateAdvance3">{al.corporateAdvance3}</option>
                                                    <option value="corporateAdvance4">{al.corporateAdvance4}</option>
                                                    <option disabled>── 노무가불 개별 ──</option>
                                                    <option value="laborAdvance1">{al.laborAdvance1}</option>
                                                    <option value="laborAdvance2">{al.laborAdvance2}</option>
                                                    <option value="laborAdvance3">{al.laborAdvance3}</option>
                                                    <option value="laborAdvance4">{al.laborAdvance4}</option>
                                                </>
                                            );
                                        })()}
                                    </KBPreviewSelect>
                                    <KBPreviewFieldHint id="kb-amount-type-hint">선택한 기준으로 C열 이체금액이 계산됩니다.</KBPreviewFieldHint>
                                </KBPreviewFieldCard>
                            </KBPreviewControlsGrid>

                            {kbPreviewSnapshot && (
                                <div className="space-y-1.5">
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300">
                                        <span>기간 <strong className="text-slate-100">{kbPreviewSnapshot.criteria.rangeLabel}</strong></span>
                                        <span>대상 <strong className="text-slate-100">{kbPreviewSnapshot.criteria.targetLabel}</strong></span>
                                        <span>구분 <strong className="text-slate-100">{kbPreviewSnapshot.criteria.salaryFilterLabel}</strong></span>
                                        <span>금액 기준 <strong className="text-slate-100">{kbPreviewSnapshot.criteria.amountTypeLabel}</strong></span>
                                        <span>{kbPreviewSnapshot.criteria.deductionStatusLabel}</span>
                                    </div>
                                    {kbTransferReview && <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-2 py-1.5 text-xs ${kbTransferReview.matches ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'}`}>
                                        <strong>이체 금액 대조 · {kbTransferReview.matches ? '일치' : '확인 필요'}</strong>
                                        <span>선택 기준 합계 {kbTransferReview.expected.toLocaleString()}원 · 다운로드 {kbTransferReview.downloadable.toLocaleString()}원 · 차이 {kbTransferReview.difference.toLocaleString()}원</span>
                                        {!kbTransferReview.matches && <span>계좌 오류로 제외된 대상과 아래 목록을 확인해 주세요. 같은 총액이어도 지급 대상이 다르면 확인이 필요합니다.</span>}
                                    </div>}
                                    {(kbPreviewInvalidRows.length > 0 || kbPreviewExcludedRows.length > 0) && (
                                        <div className="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                                            {kbPreviewInvalidRows.length > 0 && (
                                                <div className="font-bold">검증 오류로 다운로드 제외 {kbPreviewInvalidRows.length}건: {kbPreviewInvalidRows.slice(0, 5).map((row) => `${row.workerName}(${getKBValidationMessages(row)})`).join(', ')}</div>
                                            )}
                                            {kbPreviewExcludedRows.length > 0 && (
                                                <div className="mt-1">다운로드 제외 {kbPreviewExcludedRows.length}건: {kbPreviewExcludedRows.slice(0, 5).map((row) => `${row.workerName}(${row.reason})`).join(', ')}</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </KBPreviewHeader>
                        <KBPreviewTableArea>
                            <KBPreviewTable>
                                <thead className="bg-slate-800/95 sticky top-0">
                                    <tr>
                                        <th className="border border-slate-700 px-3 py-2 text-left font-bold text-slate-100">
                                            <label className="flex min-w-[150px] cursor-pointer items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    checked={kbAllPreviewRowsSelected}
                                                    onChange={toggleAllKBPreviewRows}
                                                    className="h-4 w-4 rounded border-slate-500 bg-slate-900 text-amber-400 focus:ring-amber-400"
                                                />
                                                작업자 선택
                                            </label>
                                        </th>
                                        <th className="border border-slate-700 px-3 py-2 text-left font-bold text-slate-100">A. 은행코드</th>
                                        <th className="border border-slate-700 px-3 py-2 text-left font-bold text-slate-100">B. 계좌번호</th>
                                        <th className="border border-slate-700 px-3 py-2 text-right font-bold text-slate-100">C. 이체금액</th>
                                        <th className="border border-slate-700 px-3 py-2 text-left font-bold text-slate-100">D. 받는분통장표시</th>
                                        <th className="border border-slate-700 px-3 py-2 text-left font-bold text-slate-100">E. 내통장메모</th>
                                        <th className="border border-slate-700 px-3 py-2 text-left font-bold text-slate-100">검증</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {getKBPreviewData().length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="border border-slate-700 px-3 py-8 text-center text-slate-400">
                                                다운로드할 이체금액 데이터가 없습니다.
                                            </td>
                                        </tr>
                                    ) : getKBPreviewData().map((row, idx) => (
                                        <tr key={row.sourceRowId || idx} className={`hover:bg-slate-800/60 ${row.usesPrimaryAccount ? 'bg-amber-950/30' : row.validationErrors.length > 0 ? 'bg-rose-950/30' : ''}`}>
                                            <td className="border border-slate-700 px-3 py-2">
                                                <label className="flex cursor-pointer items-start gap-2">
                                                    <input
                                                        type="checkbox"
                                                        checked={kbSelectedTransferRowIds.has(row.sourceRowId)}
                                                        onChange={() => toggleKBPreviewRowSelection(row.sourceRowId)}
                                                        aria-label={`${row.workerName} 계좌 선택`}
                                                        className="mt-0.5 h-4 w-4 rounded border-slate-500 bg-slate-900 text-amber-400 focus:ring-amber-400"
                                                    />
                                                    <span>
                                                        <span className="block font-bold text-slate-100">{row.workerName}</span>
                                                        <span className="block text-[11px] text-slate-400">{row.teamName || row.salaryLabel}</span>
                                                        {row.usesPrimaryAccount && (
                                                            <span className="mt-1 inline-flex rounded-full border border-amber-400/50 bg-amber-400/15 px-2 py-0.5 text-[10px] font-black text-amber-300">
                                                                대표계좌 적용
                                                            </span>
                                                        )}
                                                    </span>
                                                </label>
                                            </td>
                                            <td className={`border border-slate-700 px-3 py-2 ${row.bankCodeUnmapped ? 'text-rose-300 font-semibold' : ''}`}>
                                                <div className="flex items-center gap-1.5">
                                                    <span>{row.bankCodeDisplay}</span>
                                                    {row.bankCodeNeedsFix && (
                                                        <span className="inline-flex items-center rounded bg-rose-500/30 px-1.5 py-0.5 text-[10px] font-bold text-rose-100">
                                                            수정요망
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="border border-slate-700 px-3 py-2">{row.accountNumber || <span className="text-rose-300">미입력</span>}</td>
                                            <td className="border border-slate-700 px-3 py-2 text-right font-medium text-amber-300">{row.amount.toLocaleString()}</td>
                                            <td className="border border-slate-700 px-3 py-2">{row.receiverDisplay}</td>
                                            <td className="border border-slate-700 px-3 py-2">{row.senderMemo}</td>
                                            <td className={`border border-slate-700 px-3 py-2 ${row.validationErrors.length > 0 ? 'text-rose-300 font-semibold' : 'text-emerald-300'}`}>
                                                {row.validationErrors.length > 0 ? getKBValidationMessages(row) : '정상'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </KBPreviewTable>
                        </KBPreviewTableArea>
                        {kbTransferError && <p role="alert" className="px-3 py-2 text-sm text-rose-300">{kbTransferError}</p>}
                        <KBPreviewFooter>
                            <KBPreviewSummary>
                                다운로드 가능 {kbPreviewValidRows.length}명 · 이체금액 {kbPreviewValidAmount.toLocaleString()}원 · 제외 {kbPreviewInvalidRows.length + (kbPreviewSnapshot?.criteria.excludedCount ?? 0)}건
                            </KBPreviewSummary>
                            <ActionCluster>
                                <ActionButton
                                    type="button"
                                    $variant="outline"
                                    onClick={() => handleKBPreviewVisibilityChange(false)}
                                >
                                    급여 화면으로
                                </ActionButton>
                                <ActionButton
                                    type="button"
                                    $variant="outline"
                                    onClick={handleAddKBPreviewToTransfer}
                                    disabled={payrollDataBlocked || kbPreviewRows.length === 0}
                                    title="미리보기의 모든 행을 현재 계좌·금액·메모 그대로 송금 목록에 담습니다."
                                >
                                    송금 목록에 담기
                                </ActionButton>
                                <ActionButton
                                    type="button"
                                    $variant="warning"
                                    onClick={handleDownloadKBExcel}
                                    disabled={!canDownloadKBExcel}
                                    title={!canDownloadKBExcel ? '은행코드와 계좌번호가 정상인 행이 없습니다.' : `정상 ${kbPreviewValidRows.length}건을 다운로드합니다.`}
                                >
                                    <FontAwesomeIcon icon={faFileExcel} />
                                    국민은행용 다운로드
                                </ActionButton>
                            </ActionCluster>
                        </KBPreviewFooter>
                    </KBPreviewPanel>
            )}

            {showBankCodes && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full mx-4 max-h-[85vh] flex flex-col">
                        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-blue-50">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800">📊 은행 매핑 진단표</h3>
                                <p className="text-xs text-slate-600 mt-0.5">
                                    전체 입력 {bankDiagnosticSummary.total}건 · 미매핑 {bankDiagnosticSummary.unmapped}건
                                </p>
                            </div>
                            <button
                                onClick={() => setShowBankCodes(false)}
                                className="text-slate-400 hover:text-slate-600 text-2xl"
                            >
                                ×
                            </button>
                        </div>

                        <div className="flex-1 overflow-auto p-4 space-y-5 text-xs">
                            <div>
                                <h4 className="text-sm font-bold text-slate-700 mb-2 bg-blue-100 px-2 py-1 rounded">🏦 공식 은행코드 매핑표</h4>
                                <p className="text-slate-500 text-xs mb-2">기준 데이터: BANK_CODES 상수</p>
                                <table className="w-full text-xs border-collapse">
                                    <thead className="bg-slate-100 sticky top-0">
                                        <tr>
                                            <th className="border border-slate-300 px-2 py-1 text-left font-bold">코드</th>
                                            <th className="border border-slate-300 px-2 py-1 text-left font-bold">은행명</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Object.entries(BANK_CODES)
                                            .sort(([a], [b]) => Number(a) - Number(b))
                                            .map(([code, name]) => (
                                                <tr key={`${code}-${name}`}>
                                                    <td className="border px-2 py-1 font-mono">{code}</td>
                                                    <td className="border px-2 py-1">{name}</td>
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            </div>

                            <div>
                                <h4 className="text-sm font-bold text-slate-700 mb-2 bg-amber-100 px-2 py-1 rounded">🛠 입력 은행명 진단 (미매핑 사유)</h4>
                                <table className="w-full text-xs border-collapse">
                                    <thead className="bg-slate-100 sticky top-0">
                                        <tr>
                                            <th className="border border-slate-300 px-2 py-1 text-left font-bold">입력 은행명</th>
                                            <th className="border border-slate-300 px-2 py-1 text-right font-bold">건수</th>
                                            <th className="border border-slate-300 px-2 py-1 text-left font-bold">매핑 코드</th>
                                            <th className="border border-slate-300 px-2 py-1 text-left font-bold">미매핑 사유</th>
                                            <th className="border border-slate-300 px-2 py-1 text-left font-bold">후보</th>
                                            <th className="border border-slate-300 px-2 py-1 text-left font-bold">권장 조치</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {bankMappingDiagnostics.length === 0 && (
                                            <tr>
                                                <td colSpan={6} className="border px-2 py-4 text-center text-slate-500">진단할 데이터가 없습니다.</td>
                                            </tr>
                                        )}
                                        {bankMappingDiagnostics.map((row) => (
                                            <tr key={row.normalized} className={row.unmappedCount > 0 ? 'bg-rose-50/50' : ''}>
                                                <td className="border px-2 py-1">
                                                    <div className="font-medium">{row.inputNames}</div>
                                                    <div className="text-slate-400">정규화키: {row.normalized}</div>
                                                </td>
                                                <td className="border px-2 py-1 text-right tabular-nums">{row.count}</td>
                                                <td className="border px-2 py-1 font-mono">
                                                    {row.codes || '-'}
                                                </td>
                                                <td className={`border px-2 py-1 ${row.unmappedCount > 0 ? 'text-rose-700 font-semibold' : 'text-slate-500'}`}>
                                                    {row.reason || '-'}
                                                </td>
                                                <td className="border px-2 py-1 text-slate-600">{row.candidates || '-'}</td>
                                                <td className="border px-2 py-1 text-slate-700">{row.suggestedAction}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="p-4 border-t border-slate-200 bg-blue-50">
                            <button
                                onClick={() => setShowBankCodes(false)}
                                className="w-full px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold"
                            >
                                닫기
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showPayslipModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[1400px] max-h-[92vh] flex flex-col">
                        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="text-2xl">📄</span>
                                <div>
                                    <h3 className="text-lg font-bold text-slate-800">노임명세서 미리보기</h3>
                                    <p className="text-xs text-slate-500">
                                        {rangeLabel || '-'} · 총 {payslipPaymentData.length}명 · 발행가능 {payslipIssueSummary.readyRows}명 · 오류 {payslipIssueSummary.errorCount}건 · 확인 {payslipIssueSummary.warningCount}건
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowPayslipModal(false)}
                                className="text-slate-400 hover:text-slate-600 text-2xl"
                            >
                                ×
                            </button>
                        </div>
                        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                            <aside className="md:w-[170px] lg:w-[190px] xl:w-[210px] border-b md:border-b-0 md:border-r border-slate-200 flex-shrink-0 flex flex-col">
                                <div className="p-3 border-b border-slate-100">
                                    <div className="mb-2 text-xs font-semibold text-slate-500">지급 대상자</div>
                                    <div className="grid grid-cols-3 gap-1" role="group" aria-label="노임명세서 급여방식 필터">
                                        {([
                                            ['all', '전체'],
                                            ['daily', '일급제'],
                                            ['monthly', '월급제'],
                                        ] as const).map(([value, label]) => (
                                            <button
                                                key={value}
                                                type="button"
                                                onClick={() => setPayslipSalaryModelFilter(value)}
                                                className={`rounded-md px-2 py-1.5 text-[11px] font-bold transition ${payslipSalaryModelFilter === value
                                                    ? 'bg-blue-600 text-white'
                                                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                                            >
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto">
                                    {payslipPaymentData.map(worker => (
                                        <button
                                            key={worker.id}
                                            onClick={() => setSelectedPayslipRowKey(worker.id)}
                                            className={`w-full text-left px-4 py-3 border-b border-slate-100 text-sm transition flex flex-col ${payslipTarget?.id === worker.id
                                                ? (worker.id.endsWith('__월급제') ? 'bg-blue-50 text-blue-700 font-semibold' : 'bg-emerald-50 text-emerald-700 font-semibold')
                                                : (worker.id.endsWith('__월급제') ? 'hover:bg-blue-50/40' : 'hover:bg-emerald-50/40')}`}
                                        >
                                            <span>{worker.workerName}</span>
                                            <span className="text-xs text-slate-500">{worker.month} · {worker.teamName} · {resolvePayslipSalaryModel(worker) === 'daily' ? '일급제' : '월급제'}</span>
                                            {payslipOutputIds[worker.id] && (
                                                <span className="mt-1 inline-flex w-fit rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">발행완료</span>
                                            )}
                                        </button>
                                    ))}
                                    {payslipPaymentData.length === 0 && (
                                        <div className="px-4 py-6 text-sm text-slate-500 text-center">표시할 작업자가 없습니다.</div>
                                    )}
                                </div>
                            </aside>
                            <div className="min-w-0 flex-1 overflow-auto p-6 bg-slate-50">
                                <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50/70 p-4 shadow-sm">
                                    <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                                        <div className="min-w-[240px] flex-1">
                                            <label htmlFor="monthly-payslip-contractor" className="mb-1 block text-xs font-bold text-blue-900">
                                                노임명세서 시공사
                                            </label>
                                            <select
                                                id="monthly-payslip-contractor"
                                                aria-label="노임명세서 시공사"
                                                value={payslipContractorOption}
                                                onChange={(event) => setPayslipContractorOption(event.target.value)}
                                                className="h-10 w-full rounded-lg border border-blue-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-blue-500"
                                            >
                                                {payslipContractorOptions.map((name) => (
                                                    <option key={name} value={name}>{name}</option>
                                                ))}
                                                <option value={CUSTOM_PAYSLIP_CONTRACTOR_VALUE}>새 사업자 직접 입력</option>
                                            </select>
                                        </div>
                                        {payslipContractorOption === CUSTOM_PAYSLIP_CONTRACTOR_VALUE && (
                                            <div className="min-w-[240px] flex-1">
                                                <label htmlFor="monthly-payslip-custom-contractor" className="mb-1 block text-xs font-bold text-blue-900">
                                                    새 시공사 상호
                                                </label>
                                                <input
                                                    id="monthly-payslip-custom-contractor"
                                                    aria-label="새 시공사 상호"
                                                    type="text"
                                                    value={customPayslipContractorName}
                                                    onChange={(event) => setCustomPayslipContractorName(event.target.value)}
                                                    placeholder="사업자 상호를 입력하세요"
                                                    className="h-10 w-full rounded-lg border border-blue-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-blue-500"
                                                />
                                            </div>
                                        )}
                                        <p className="text-xs leading-5 text-blue-700 lg:max-w-[320px]">
                                            선택한 시공사는 미리보기, 이미지, 인쇄, 엑셀 및 발행 기록에 동일하게 반영됩니다.
                                        </p>
                                    </div>
                                </div>
                                <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                        <div>
                                            <div className="text-xs font-bold uppercase tracking-wide text-slate-500">발행 검증</div>
                                            <div className="mt-1 text-sm font-semibold text-slate-800">
                                                {resolvedPayslipTarget?.workerName ?? '-'} · {selectedPayslipOutputId ? '발행완료' : '작성중'}
                                            </div>
                                            {selectedPayslipOutputId && (
                                                <div className="mt-1 text-xs text-emerald-700">문서대장 ID: {selectedPayslipOutputId}</div>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-3 gap-2 text-center text-xs">
                                            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                                                <div className="font-bold text-emerald-700">{selectedPayslipIssueSummary.readyRows}</div>
                                                <div className="text-emerald-700/80">발행가능</div>
                                            </div>
                                            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
                                                <div className="font-bold text-rose-700">{selectedPayslipIssueSummary.errorCount}</div>
                                                <div className="text-rose-700/80">오류</div>
                                            </div>
                                            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                                                <div className="font-bold text-amber-700">{selectedPayslipIssueSummary.warningCount}</div>
                                                <div className="text-amber-700/80">확인</div>
                                            </div>
                                        </div>
                                    </div>
                                    {selectedPayslipIssueSummary.issues.length > 0 && (
                                        <div className="mt-3 grid gap-1 text-xs">
                                            {selectedPayslipIssueSummary.issues.map((issue, idx) => (
                                                <div
                                                    key={`${issue.code}-${idx}`}
                                                    className={issue.severity === 'error' ? 'text-rose-700' : 'text-amber-700'}
                                                >
                                                    {issue.severity === 'error' ? '오류' : '확인'} · {issue.message}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {payslipIssueMessage && (
                                        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                                            {payslipIssueMessage}
                                        </div>
                                    )}
                                </div>

                                {resolvedPayslipTarget ? (
                                    <PayslipTemplate
                                        ref={printRef}
                                        data={resolvedPayslipTarget}
                                        month={resolvedPayslipTarget.month}
                                        contractorName={resolvedPayslipContractorName}
                                        applyUtilities={utilitiesApplied}
                                        insuranceTeamSiteOnly={insuranceTeamSiteOnly}
                                        isTeamResponsibleSiteEntry={isEntryInWorkerTeamSite}
                                    />
                                ) : (
                                    <div className="text-center py-12 text-slate-500">
                                        표시할 명세서가 없습니다.
                                    </div>
                                )}

                                {payslipExportNotice && (
                                    <p role="status" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                                        {payslipExportNotice}
                                    </p>
                                )}
                                <div className="mt-4 overflow-x-auto pb-1">
                                    <div role="group" aria-label="명세서 출력 및 발행" className="flex w-max min-w-full flex-nowrap items-center justify-end gap-2 whitespace-nowrap">
                                        <button
                                            onClick={handleCopyToClipboard}
                                            disabled={!resolvedPayslipTarget || copying}
                                            className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-bold flex items-center gap-2 disabled:opacity-50"
                                        >
                                            {copying ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faCopy} />}
                                            이미지 복사
                                        </button>
                                        <button
                                            onClick={handlePrintPayslip}
                                            disabled={!resolvedPayslipTarget || preparingPayslipPrint}
                                            className="px-4 py-2 text-sm bg-white border border-rose-200 text-rose-700 rounded-lg hover:bg-rose-50 font-bold flex items-center gap-2 disabled:opacity-50"
                                        >
                                            {preparingPayslipPrint ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faFilePdf} />}
                                            개별 PDF
                                        </button>
                                        <button
                                            onClick={handleBatchPrintPayslips}
                                            disabled={payslipPaymentData.length === 0 || preparingPayslipPrint}
                                            className="px-4 py-2 text-sm bg-rose-600 text-white rounded-lg hover:bg-rose-700 font-bold flex items-center gap-2 disabled:opacity-50"
                                        >
                                            {preparingPayslipPrint ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faFilePdf} />}
                                            일괄 PDF ({payslipPaymentData.length}명)
                                        </button>
                                        <button
                                            onClick={handleDownloadIndividualPayslip}
                                            disabled={!resolvedPayslipTarget || batchExcelDownloading}
                                            className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-bold flex items-center gap-2 disabled:opacity-50"
                                        >
                                            <FontAwesomeIcon icon={faFileExcel} />
                                            개별 EXCEL
                                        </button>
                                        <button
                                            onClick={handleDownloadBatchIndividualPayslips}
                                            disabled={payslipPaymentData.length === 0 || batchExcelDownloading}
                                            className="px-4 py-2 text-sm bg-green-700 text-white rounded-lg hover:bg-green-800 font-bold flex items-center gap-2 disabled:opacity-50"
                                        >
                                            {batchExcelDownloading ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faFileExcel} />}
                                            일괄 EXCEL ({payslipPaymentData.length}명)
                                        </button>
                                        <button
                                            onClick={handleIssueCurrentPayslip}
                                            disabled={!resolvedPayslipTarget || issuingPayslip || selectedPayslipIssueSummary.errorCount > 0}
                                            className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-bold flex items-center gap-2 disabled:opacity-50"
                                        >
                                            {issuingPayslip ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faCheckCircle} />}
                                            {selectedPayslipOutputId ? '재발행 기록' : '발행 확정'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showInsuranceSettings && createPortal(
                <div className="monthly-payroll-insurance-overlay fixed inset-0 bg-black/50 flex items-center justify-center z-[10000] p-4">
                    <div ref={insuranceDialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="monthly-payroll-insurance-title" className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col outline-none"
                        onKeyDown={(event) => {
                            if (event.key === 'Escape' && !insuranceConfigSaving) {
                                event.stopPropagation();
                                setShowInsuranceSettings(false);
                            }
                            if (event.key === 'Tab') {
                                const controls = insuranceDialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)');
                                const first = controls?.[0];
                                const last = controls?.[controls.length - 1];
                                if (event.shiftKey && (document.activeElement === first || document.activeElement === insuranceDialogRef.current)) {
                                    event.preventDefault(); last?.focus();
                                } else if (!event.shiftKey && document.activeElement === last) {
                                    event.preventDefault(); first?.focus();
                                }
                            }
                        }}
                    >
                        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                            <div>
                                <h3 id="monthly-payroll-insurance-title" className="text-lg font-bold text-slate-800">4대보험/세율 설정</h3>
                                <p className="text-xs text-slate-500 mt-1">적용 기준(공수), 요율(%), 일급제 수수료 공수당(원)을 저장합니다.</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowInsuranceSettings(false)}
                                aria-label="요율 설정 닫기"
                                className="h-11 w-11 shrink-0 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 text-2xl"
                            >
                                ×
                            </button>
                        </div>

                        <div className="flex-1 overflow-auto p-4 space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <label className="text-sm">
                                    <div className="text-xs font-bold text-slate-600 mb-1">적용 기준 공수</div>
                                    <input
                                        type="number"
                                        value={insuranceThresholdManDayInput}
                                        onChange={(e) => setInsuranceThresholdManDayInput(e.target.value)}
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                                        min={1}
                                        step={1}
                                    />
                                </label>
                                <div className="text-xs text-slate-500 flex items-end">
                                    노무현장 공수 합이 기준 이상이면 4대보험 대상으로 판단합니다.
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <label className="text-sm">
                                    <div className="text-xs font-bold text-slate-600 mb-1">국민연금 (%)</div>
                                    <input
                                        type="number"
                                        value={pensionRatePercentInput}
                                        onChange={(e) => setPensionRatePercentInput(e.target.value)}
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                                        min={0}
                                        step={0.01}
                                    />
                                </label>
                                <label className="text-sm">
                                    <div className="text-xs font-bold text-slate-600 mb-1">건강보험 (%)</div>
                                    <input
                                        type="number"
                                        value={healthRatePercentInput}
                                        onChange={(e) => setHealthRatePercentInput(e.target.value)}
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                                        min={0}
                                        step={0.001}
                                    />
                                </label>
                                <label className="text-sm">
                                    <div className="text-xs font-bold text-slate-600 mb-1">장기요양(건강보험 대비 %) </div>
                                    <input
                                        type="number"
                                        value={careRateOfHealthPercentInput}
                                        onChange={(e) => setCareRateOfHealthPercentInput(e.target.value)}
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                                        min={0}
                                        step={0.001}
                                    />
                                </label>
                                <label className="text-sm">
                                    <div className="text-xs font-bold text-slate-600 mb-1">고용보험 (%)</div>
                                    <input
                                        type="number"
                                        value={employmentRatePercentInput}
                                        onChange={(e) => setEmploymentRatePercentInput(e.target.value)}
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                                        min={0}
                                        step={0.001}
                                    />
                                </label>
                                <label className="text-sm">
                                    <div className="text-xs font-bold text-slate-600 mb-1">일급제 수수료 공수당 금액 (원)</div>
                                    <input
                                        type="number"
                                        value={dailyWorkerFeePerManDayInput}
                                        onChange={(e) => setDailyWorkerFeePerManDayInput(e.target.value)}
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                                        min={0}
                                        step={1000}
                                    />
                                </label>
                                <label className="text-sm">
                                    <div className="text-xs font-bold text-slate-600 mb-1">갑근세 단가 공제기준 (원)</div>
                                    <input
                                        type="number"
                                        value={withholdingBaseDeductionInput}
                                        onChange={(e) => setWithholdingBaseDeductionInput(e.target.value)}
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                                        min={0}
                                        step={1000}
                                    />
                                </label>
                                <label className="text-sm">
                                    <div className="text-xs font-bold text-slate-600 mb-1">갑근세 세액공제율 (%)</div>
                                    <input
                                        type="number"
                                        value={withholdingIncomeBaseMultiplierPercentInput}
                                        onChange={(e) => setWithholdingIncomeBaseMultiplierPercentInput(e.target.value)}
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                                        min={0}
                                        step={0.01}
                                    />
                                </label>
                                <label className="text-sm">
                                    <div className="text-xs font-bold text-slate-600 mb-1">갑근세 세율 (%)</div>
                                    <input
                                        type="number"
                                        value={incomeTaxRatePercentInput}
                                        onChange={(e) => setIncomeTaxRatePercentInput(e.target.value)}
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                                        min={0}
                                        step={0.01}
                                    />
                                </label>
                                <label className="text-sm">
                                    <div className="text-xs font-bold text-slate-600 mb-1">지방세 (갑근세 대비 %)</div>
                                    <input
                                        type="number"
                                        value={residentTaxRatePercentInput}
                                        onChange={(e) => setResidentTaxRatePercentInput(e.target.value)}
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                                        min={0}
                                        step={0.01}
                                    />
                                </label>
                            </div>

                            <div className="space-y-2 border-t border-slate-200 pt-3">
                                <label className="flex items-center gap-2 text-xs text-slate-700">
                                    <input
                                        type="checkbox"
                                        checked={withholdingApplyAllLaborInput}
                                        onChange={(e) => setWithholdingApplyAllLaborInput(e.target.checked)}
                                    />
                                    갑근세/지방세를 노무 전체 공수(7공수 미만, 8공수 이상 포함)에 적용
                                </label>
                                <label className="flex items-center gap-2 text-xs text-slate-700">
                                    <input
                                        type="checkbox"
                                        checked={employmentApplyBelowThresholdInput}
                                        onChange={(e) => setEmploymentApplyBelowThresholdInput(e.target.checked)}
                                    />
                                    7공수 미만 노무현장에도 고용보험 공제 적용
                                </label>
                            </div>

                            <div className="text-xs text-slate-500 border-t border-slate-200 pt-3">
                                갑근세 계산식: <span className="font-semibold text-slate-700">(단가 - 공제기준) × 노무공수 × 갑근세율 × (1 - 세액공제율)</span><br />
                                지방세 계산식: <span className="font-semibold text-slate-700">갑근세 × 지방세율</span>
                            </div>
                        </div>

                        <div className="p-4 border-t border-slate-200 flex items-center justify-end gap-2 bg-slate-50">
                            <button
                                type="button"
                                onClick={() => setShowInsuranceSettings(false)}
                                className="px-4 py-2 text-sm text-slate-600 hover:bg-white rounded-lg"
                            >
                                닫기
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveInsuranceSettings}
                                disabled={insuranceConfigSaving}
                                className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-bold disabled:opacity-50 flex items-center gap-2"
                            >
                                {insuranceConfigSaving ? <FontAwesomeIcon icon={faSpinner} spin /> : null}
                                저장
                            </button>
                        </div>
                    </div>
                </div>, document.body
            )}
        </div>
    );
};

const ignoreTransferInvalidation = () => undefined;

/** A team job uses the same calculator and readiness checks as a manual team query. */
function TransferJobReporter({ ready, error, collect, onLoad, onError }: {
    ready: boolean;
    error: string | null;
    collect: () => TransferLoadResult;
    onLoad: (result: TransferLoadResult) => void;
    onError: (message: string) => void;
}) {
    const delivered = useRef(false);
    useEffect(() => {
        if (delivered.current || (!ready && !error)) return;
        delivered.current = true;
        if (error) { onError(error); return; }
        try { onLoad(collect()); }
        catch { onError('급여 내역을 만들지 못했습니다.'); }
    }, [ready, error, collect, onLoad, onError]);
    return null;
}

/** Keep one read-only team calculator mounted at a time; publish only the complete batch. */
function TransferBatchRunner({ teams, period, salaryFilter, amountType, onLoad, onError }: {
    teams: Array<{ id: string; name: string }>;
    period: string;
    salaryFilter: KBSalaryModelFilter;
    amountType: KBAmountType;
    onLoad: (result: TransferLoadResult) => void;
    onError: (message: string) => void;
}) {
    const [results, setResults] = useState<TransferLoadResult[]>([]);
    const finished = useRef(false);
    const current = teams[results.length];
    useEffect(() => {
        if (current || finished.current) return;
        finished.current = true;
        const candidates = results.flatMap(result => result.candidates);
        if (new Set(candidates.map(row => row.id)).size !== candidates.length) {
            onError('팀별 급여에 중복된 원본이 있어 전체 결과를 가져오지 않았습니다.');
            return;
        }
        onLoad({ candidates, warnings: [...new Set(results.flatMap(result => result.warnings))] });
    }, [current, results, onLoad, onError]);
    if (!current) return null;
    return <>
        <p className="bt-payroll-status" role="status">{results.length + 1}/{teams.length}팀 · {current.name} 계산 중</p>
        <MonthlyWagePaymentPage key={current.id} transferPicker={{
            period, batchJob: { teamId: current.id, salaryFilter, amountType },
            onInvalidate: ignoreTransferInvalidation,
            onLoad: result => setResults(previous => previous.length === results.length ? [...previous, result] : previous),
            onError: message => onError(`${current.name}: ${message} 전체 결과를 가져오지 않았습니다.`),
        }} />
    </>;
}

export default MonthlyWagePaymentPage;
