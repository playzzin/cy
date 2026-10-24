import { PagePrimaryAccountSettings } from '../../components/accounts/PagePrimaryAccountManager';
import PayrollIssueTopTabs from '../../components/payroll/PayrollIssueTopTabs';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faBuilding, faCalendarAlt, faChevronLeft, faChevronRight, faCircleCheck, faDownload, faFileInvoiceDollar, faMapLocationDot, faReceipt, faSearch, faShareNodes, faSpinner, faTriangleExclamation, faUsers } from '@fortawesome/free-solid-svg-icons';
import * as XLSX from 'xlsx-js-style';
import { teamService } from '../../services/teamService';
import { Company, companyService } from '../../services/companyService';
import { siteService } from '../../services/siteService';
import { dailyReportService } from '../../services/dailyReportService';
import { manpowerService, type Worker } from '../../services/manpowerService';
import { SupportRate, supportRateService } from '../../services/supportRateService';
import { teamExpenseLedgerService } from '../../services/teamExpenseLedgerService';
import { settlementTargetService, SettlementTarget } from '../../services/settlementTargetService';
import { supportClientSiteAllocationService, SupportClientAllocation, SupportClientAllocationLine } from '../../services/supportClientSiteAllocationService';
import { estimateService, Estimate } from '../../services/estimateService';
import type { TeamExpenseClaim } from '../../types/teamExpenseLedger';
import { DIRECTION_OPTIONS, EXTERNAL_CLIENT_GROUP_DISPLAY_NAME, OWN_SITE_OUTPUT_LABEL, STANDARD_CLIENT_GROUP_DISPLAY_NAME, SUPPORT_PROGRESS_OPTIONS, SUPPORT_TRANSACTION_STATEMENT_SOURCE, applyExpenseClaimsToClientGroups, buildSupportRows, calculateSupportClientBillingAmount, clientKeyForRow, formatCurrencyInputValue, formatManDay, formatNumber, formatYearMonthLabel, getAllocationStatus, getBillingRateStorageKey, getBillingRowRateKey, getClientCompanyName, getCurrentYearMonth, getIssuedAmountStorageKey, getMonthRange, getOutputTypeDisplayName, getProgressStatusStorageKey, getRowNoteStorageKey, getSettlementAmountStorageKey, getSiteDefaultIssuedAmount, getSiteExpenseClaims, getSiteVatAmount, getSitesExpenseClaims, getSourceTeamDisplayName, getSupportProgressLabel, getSupportProgressOption, groupRowsByClientAndSite, groupSitesByResponsibleTeam, isEstimateTransactionMode, isExternalClientSummary, isSupportProgressStatus, loadBillingRates, loadIssuedAmounts, loadProgressStatuses, loadRowNotes, loadSettlementAmounts, normalizeBillingRateInput, normalizeIssuedAmountInput, normalizeSettlementAmountInput, parseBillingRate, parseIssuedAmount, parseSettlementAmount, shiftYearMonth, siteKeyForRow, summarizeNames, summarizeOutputTypeDisplayNames, summarizeSourceTeamDisplayNames, uniqueValues } from './SupportClientSiteModel';
import type { SiteAllocationMetrics, SupportClientAllocationModalTarget, SupportClientSiteWorkerRow, SupportClientSummary, SupportDirection, SupportProgressStatus, SupportSiteSummary, SupportStatementTarget, SupportTransactionStatementMode } from './SupportClientSiteModel';
import { AccordionChevron, OutputTypeBadge, ResponsibleTeamChips, SiteMetaBadge, StatementActionButtons, SummaryCard, SupportClientAllocationModal, SupportClientExpenseStatementModal, SupportClientLaborStatementPanel, SupportClientTransactionStatementPanel } from './SupportClientStatementPanels';
export * from './SupportClientSiteModel';
export * from './SupportClientStatementPanels';

const SupportClientSitePage: React.FC = () => {
    const navigate = useNavigate();
    const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentYearMonth());
    const [selectedDirection, setSelectedDirection] = useState<'all' | SupportDirection>('all');
    const [selectedClientKey, setSelectedClientKey] = useState<string>('');
    const [selectedSiteKey, setSelectedSiteKey] = useState<string>('');
    const [rows, setRows] = useState<SupportClientSiteWorkerRow[]>([]);
    const [expenseClaims, setExpenseClaims] = useState<TeamExpenseClaim[]>([]);
    const [settlementTargets, setSettlementTargets] = useState<SettlementTarget[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [allocationLoading, setAllocationLoading] = useState<boolean>(false);
    const [allocationSaving, setAllocationSaving] = useState<boolean>(false);
    const [errors, setErrors] = useState<string[]>([]);
    const [laborStatementPanel, setLaborStatementPanel] = useState<{ key: string; target: SupportStatementTarget } | null>(null);
    const [transactionStatementPanel, setTransactionStatementPanel] = useState<{ key: string; target: SupportStatementTarget; mode: SupportTransactionStatementMode } | null>(null);
    const [transactionStatements, setTransactionStatements] = useState<Estimate[]>([]);
    const [transactionStatementsLoading, setTransactionStatementsLoading] = useState<boolean>(false);
    const [expenseStatementTarget, setExpenseStatementTarget] = useState<SupportStatementTarget | null>(null);
    const [allocationModalTarget, setAllocationModalTarget] = useState<SupportClientAllocationModalTarget | null>(null);
    const [showAllocationColumns, setShowAllocationColumns] = useState<boolean>(false);
    const [expandedClientKeys, setExpandedClientKeys] = useState<Set<string>>(new Set());
    const [expandedResponsibleTeamKeys, setExpandedResponsibleTeamKeys] = useState<Set<string>>(new Set());
    const [expandedSiteKeys, setExpandedSiteKeys] = useState<Set<string>>(new Set());
    const [issuedAmountState, setIssuedAmountState] = useState<{ month: string; amounts: Record<string, string> }>(() => {
        const initialMonth = getCurrentYearMonth();
        return {
            month: initialMonth,
            amounts: loadIssuedAmounts(initialMonth)
        };
    });
    const [settlementAmountState, setSettlementAmountState] = useState<{ month: string; amounts: Record<string, string> }>(() => {
        const initialMonth = getCurrentYearMonth();
        return {
            month: initialMonth,
            amounts: loadSettlementAmounts(initialMonth)
        };
    });
    const [rowNoteState, setRowNoteState] = useState<{ month: string; notes: Record<string, string> }>(() => {
        const initialMonth = getCurrentYearMonth();
        return {
            month: initialMonth,
            notes: loadRowNotes(initialMonth)
        };
    });
    const [progressStatusState, setProgressStatusState] = useState<{ month: string; statuses: Record<string, SupportProgressStatus> }>(() => {
        const initialMonth = getCurrentYearMonth();
        return {
            month: initialMonth,
            statuses: loadProgressStatuses(initialMonth)
        };
    });
    const [billingRateState, setBillingRateState] = useState<{ month: string; rates: Record<string, string> }>(() => {
        const initialMonth = getCurrentYearMonth();
        return {
            month: initialMonth,
            rates: loadBillingRates(initialMonth)
        };
    });
    const [bulkBillingRateInput, setBulkBillingRateInput] = useState<string>(() => {
        const initialMonth = getCurrentYearMonth();
        const storedRate = loadBillingRates(initialMonth).bulkRate || '';
        return storedRate ? formatNumber(parseBillingRate(storedRate)) : '';
    });
    const [allocationState, setAllocationState] = useState<{ month: string; allocations: Record<string, SupportClientAllocation> }>(() => ({
        month: getCurrentYearMonth(),
        allocations: {}
    }));
    const issuedAmounts = issuedAmountState.month === selectedMonth
        ? issuedAmountState.amounts
        : loadIssuedAmounts(selectedMonth);
    const settlementAmounts = settlementAmountState.month === selectedMonth
        ? settlementAmountState.amounts
        : loadSettlementAmounts(selectedMonth);
    const rowNotes = rowNoteState.month === selectedMonth
        ? rowNoteState.notes
        : loadRowNotes(selectedMonth);
    const progressStatuses = progressStatusState.month === selectedMonth
        ? progressStatusState.statuses
        : loadProgressStatuses(selectedMonth);
    const billingRates = billingRateState.month === selectedMonth ? billingRateState.rates : loadBillingRates(selectedMonth);
    const appliedBulkBillingRate = parseBillingRate(billingRates.bulkRate);
    const siteAllocations = allocationState.month === selectedMonth ? allocationState.allocations : {};

    const fetchData = useCallback(async () => {
        if (!selectedMonth) return;
        setLoading(true);
        setErrors([]);
        try {
            const { start, end } = getMonthRange(selectedMonth);
            const [reports, teams, companies, sites, supportRates, workers, teamExpenseClaims] = await Promise.all([
                dailyReportService.getReportsByRange(start, end),
                teamService.getTeams(),
                companyService.getCompanies(),
                siteService.getSites(),
                supportRateService.getAllSiteRates().catch((error) => {
                    console.error('[SupportClientSitePage] support rate load failed:', error);
                    return [] as SupportRate[];
                }),
                manpowerService.getWorkers().catch((error) => {
                    console.error('[SupportClientSitePage] worker master load failed:', error);
                    return [] as Worker[];
                }),
                teamExpenseLedgerService.getClaimsByMonth(selectedMonth).catch((error) => {
                    console.error('[SupportClientSitePage] expense claim load failed:', error);
                    return [] as TeamExpenseClaim[];
                })
            ]);

            setRows(buildSupportRows(reports, teams, companies, sites, supportRates, workers));
            setCompanies(companies);
            setExpenseClaims(teamExpenseClaims);
        } catch (error) {
            console.error('[SupportClientSitePage] support client-site data load failed:', error);
            setRows([]);
            setCompanies([]);
            setExpenseClaims([]);
            setErrors(['발주사별/현장별 지원 정산 데이터를 불러오지 못했습니다. 일보, 현장, 팀 데이터 권한을 확인해주세요.']);
        } finally {
            setLoading(false);
        }
    }, [selectedMonth]);

    useEffect(() => {
        void fetchData();
    }, [fetchData]);

    const fetchTransactionStatements = useCallback(async () => {
        setTransactionStatementsLoading(true);
        try {
            const statements = await estimateService.getEstimates();
            setTransactionStatements(statements.filter((statement) => statement.documentType === 'transaction'));
        } catch (error) {
            console.error('[SupportClientSitePage] transaction statement load failed:', error);
            setTransactionStatements([]);
        } finally {
            setTransactionStatementsLoading(false);
        }
    }, []);

    useEffect(() => {
        void fetchTransactionStatements();
    }, [fetchTransactionStatements]);

    useEffect(() => {
        settlementTargetService.getTargets(true)
            .then(setSettlementTargets)
            .catch((error) => {
                console.error('[SupportClientSitePage] settlement target load failed:', error);
                setSettlementTargets([]);
            });
    }, []);

    useEffect(() => {
        if (!selectedMonth) return;
        let alive = true;
        setAllocationLoading(true);
        supportClientSiteAllocationService.getAllocationsByMonth(selectedMonth)
            .then((allocationRows) => {
                if (!alive) return;
                const allocations = Object.fromEntries(allocationRows.map((allocation) => [allocation.siteKey, allocation]));
                setAllocationState({
                    month: selectedMonth,
                    allocations
                });
                setIssuedAmountState((prev) => {
                    const base = prev.month === selectedMonth ? prev.amounts : loadIssuedAmounts(selectedMonth);
                    const next = { ...base };
                    allocationRows.forEach((allocation) => {
                        if (Number(allocation.issuedAmount || 0) > 0) {
                            next[allocation.siteKey] = String(Math.round(Number(allocation.issuedAmount || 0)));
                        }
                    });
                    return {
                        month: selectedMonth,
                        amounts: next
                    };
                });
                setSettlementAmountState((prev) => {
                    const base = prev.month === selectedMonth ? prev.amounts : loadSettlementAmounts(selectedMonth);
                    const next = { ...base };
                    allocationRows.forEach((allocation) => {
                        if (Number(allocation.settlementAmount || 0) > 0) {
                            next[allocation.siteKey] = String(Math.round(Number(allocation.settlementAmount || 0)));
                        }
                    });
                    return {
                        month: selectedMonth,
                        amounts: next
                    };
                });
            })
            .catch((error) => {
                console.error('[SupportClientSitePage] allocation load failed:', error);
                if (alive) setAllocationState({ month: selectedMonth, allocations: {} });
            })
            .finally(() => {
                if (alive) setAllocationLoading(false);
            });
        return () => {
            alive = false;
        };
    }, [selectedMonth]);

    useEffect(() => {
        setIssuedAmountState({
            month: selectedMonth,
            amounts: loadIssuedAmounts(selectedMonth)
        });
        setSettlementAmountState({
            month: selectedMonth,
            amounts: loadSettlementAmounts(selectedMonth)
        });
        setRowNoteState({
            month: selectedMonth,
            notes: loadRowNotes(selectedMonth)
        });
        setProgressStatusState({
            month: selectedMonth,
            statuses: loadProgressStatuses(selectedMonth)
        });
        const nextBillingRates = loadBillingRates(selectedMonth);
        setBillingRateState({
            month: selectedMonth,
            rates: nextBillingRates
        });
        setBulkBillingRateInput(nextBillingRates.bulkRate ? formatNumber(parseBillingRate(nextBillingRates.bulkRate)) : '');
    }, [selectedMonth]);

    useEffect(() => {
        if (issuedAmountState.month !== selectedMonth || typeof window === 'undefined') return;
        try {
            window.localStorage.setItem(
                getIssuedAmountStorageKey(selectedMonth),
                JSON.stringify(issuedAmountState.amounts)
            );
        } catch (error) {
            console.warn('[SupportClientSitePage] issued amount save failed:', error);
        }
    }, [issuedAmountState, selectedMonth]);

    useEffect(() => {
        if (settlementAmountState.month !== selectedMonth || typeof window === 'undefined') return;
        try {
            window.localStorage.setItem(
                getSettlementAmountStorageKey(selectedMonth),
                JSON.stringify(settlementAmountState.amounts)
            );
        } catch (error) {
            console.warn('[SupportClientSitePage] settlement amount save failed:', error);
        }
    }, [settlementAmountState, selectedMonth]);

    useEffect(() => {
        if (rowNoteState.month !== selectedMonth || typeof window === 'undefined') return;
        try {
            window.localStorage.setItem(
                getRowNoteStorageKey(selectedMonth),
                JSON.stringify(rowNoteState.notes)
            );
        } catch (error) {
            console.warn('[SupportClientSitePage] row note save failed:', error);
        }
    }, [rowNoteState, selectedMonth]);

    useEffect(() => {
        if (progressStatusState.month !== selectedMonth || typeof window === 'undefined') return;
        try {
            window.localStorage.setItem(
                getProgressStatusStorageKey(selectedMonth),
                JSON.stringify(progressStatusState.statuses)
            );
        } catch (error) {
            console.warn('[SupportClientSitePage] progress status save failed:', error);
        }
    }, [progressStatusState, selectedMonth]);

    useEffect(() => {
        if (billingRateState.month !== selectedMonth || typeof window === 'undefined') return;
        try {
            window.localStorage.setItem(
                getBillingRateStorageKey(selectedMonth),
                JSON.stringify(billingRateState.rates)
            );
        } catch (error) {
            console.warn('[SupportClientSitePage] billing rate save failed:', error);
        }
    }, [billingRateState, selectedMonth]);

    useEffect(() => {
        setExpandedResponsibleTeamKeys(new Set());
        setExpandedSiteKeys(new Set());
    }, [selectedMonth, selectedDirection, selectedClientKey, selectedSiteKey]);

    const displayRows = useMemo(
        () => rows.filter((row) => !isExternalClientSummary(row)),
        [rows]
    );

    useEffect(() => {
        if (selectedDirection === '외부지원간곳') {
            setSelectedDirection('all');
        }
    }, [selectedDirection]);

    const directionFilteredRows = useMemo(() => (
        displayRows.filter((row) => selectedDirection === 'all' || row.direction === selectedDirection)
    ), [displayRows, selectedDirection]);

    const clientOptions = useMemo(() => groupRowsByClientAndSite(directionFilteredRows), [directionFilteredRows]);

    const clientFilteredRows = useMemo(() => (
        directionFilteredRows.filter((row) => !selectedClientKey || clientKeyForRow(row) === selectedClientKey)
    ), [directionFilteredRows, selectedClientKey]);

    const siteOptions = useMemo(() => {
        const siteMap = new Map<string, { key: string; name: string; clientCompanyName: string }>();
        clientFilteredRows.forEach((row) => {
            const key = siteKeyForRow(row);
            if (!siteMap.has(key)) {
                siteMap.set(key, {
                    key,
                    name: row.siteName || '현장 미지정',
                    clientCompanyName: getClientCompanyName(row)
                });
            }
        });
        return Array.from(siteMap.values()).sort((a, b) =>
            a.clientCompanyName.localeCompare(b.clientCompanyName, 'ko-KR') ||
            a.name.localeCompare(b.name, 'ko-KR')
        );
    }, [clientFilteredRows]);

    const filteredRows = useMemo(() => (
        clientFilteredRows.filter((row) => !selectedSiteKey || siteKeyForRow(row) === selectedSiteKey)
    ), [clientFilteredRows, selectedSiteKey]);

    const clientGroups = useMemo(
        () => applyExpenseClaimsToClientGroups(groupRowsByClientAndSite(filteredRows), expenseClaims),
        [filteredRows, expenseClaims]
    );

    const getRowBillingOverrideRate = (row: SupportClientSiteWorkerRow): number =>
        parseBillingRate(billingRates[getBillingRowRateKey(row)]);

    const getRowBillingUnitPrice = (row: SupportClientSiteWorkerRow): number => {
        const rowBillingRate = getRowBillingOverrideRate(row);
        if (rowBillingRate > 0) return rowBillingRate;
        return appliedBulkBillingRate > 0 ? appliedBulkBillingRate : Math.max(0, Math.round(row.unitPrice || 0));
    };

    const getRowBillingAmount = (row: SupportClientSiteWorkerRow): number =>
        getRowBillingOverrideRate(row) > 0 || appliedBulkBillingRate > 0
            ? calculateSupportClientBillingAmount(row.manDay, getRowBillingUnitPrice(row))
            : Math.max(0, Math.round(row.amount || 0));

    const getSiteBillingAmount = (site: SupportSiteSummary): number =>
        site.rows.reduce((sum, row) => sum + getRowBillingAmount(row), 0);

    const getSiteBillingUnitPrice = (site: SupportSiteSummary): number =>
        site.totalManDay > 0 ? Math.round(getSiteBillingAmount(site) / site.totalManDay) : 0;

    const getSitesBillingMetrics = (sites: SupportSiteSummary[]): { billingUnitPrice: number; billingAmount: number } => {
        const billingAmount = sites.reduce((sum, site) => sum + getSiteBillingAmount(site), 0);
        const totalManDay = sites.reduce((sum, site) => sum + site.totalManDay, 0);
        return {
            billingUnitPrice: totalManDay > 0 ? Math.round(billingAmount / totalManDay) : 0,
            billingAmount
        };
    };

    const getBillingRateBySiteKey = (sites: SupportSiteSummary[]): Record<string, number> =>
        appliedBulkBillingRate > 0
            ? Object.fromEntries(sites.map((site) => [site.key, getSiteBillingUnitPrice(site)]))
            : {};

    const getBillingRateByRowId = (rows: SupportClientSiteWorkerRow[]): Record<string, number> =>
        Object.fromEntries(rows.map((row) => [row.rowId, getRowBillingUnitPrice(row)]));

    useEffect(() => {
        const initiallyOpenClient = clientGroups[0];
        setExpandedClientKeys(initiallyOpenClient ? new Set([initiallyOpenClient.key]) : new Set());
        setExpandedResponsibleTeamKeys(new Set());
        setExpandedSiteKeys(new Set());
    }, [clientGroups]);

    const totalSummary = useMemo(() => {
        const siteKeys = new Set(filteredRows.map(siteKeyForRow));
        const clientKeys = new Set(filteredRows.map(clientKeyForRow));
        const workerKeys = new Set(filteredRows.map((row) => row.workerId || row.workerName));
        return {
            totalManDay: filteredRows.reduce((sum, row) => sum + row.manDay, 0),
            totalAmount: filteredRows.reduce((sum, row) => sum + row.amount, 0),
            totalBillingAmount: filteredRows.reduce((sum, row) => sum + getRowBillingAmount(row), 0),
            clientCount: clientKeys.size,
            siteCount: siteKeys.size,
            workerCount: workerKeys.size
        };
    }, [filteredRows, appliedBulkBillingRate, billingRates]);

    const resolveSiteIssuedAmount = (site: SupportSiteSummary, value?: string): number => {
        const rawValue = value ?? issuedAmounts[site.key];
        const hasManualValue = String(rawValue ?? '').trim() !== '';
        return hasManualValue ? parseIssuedAmount(rawValue) : getSiteDefaultIssuedAmount(site);
    };

    const getSiteAllocationMetrics = (site: SupportSiteSummary): SiteAllocationMetrics => {
        const issuedAmount = resolveSiteIssuedAmount(site);
        const settlementAmount = parseSettlementAmount(settlementAmounts[site.key]);
        const distributableAmount = Math.max(issuedAmount - settlementAmount, 0);
        const allocatedAmount = (siteAllocations[site.key]?.lines || []).reduce((sum, line) => sum + Number(line.amount || 0), 0);
        const unallocatedAmount = distributableAmount - allocatedAmount;
        return {
            issuedAmount,
            settlementAmount,
            distributableAmount,
            allocatedAmount,
            unallocatedAmount,
            vatAmount: getSiteVatAmount(site, issuedAmount),
            isOverAllocated: unallocatedAmount < 0
        };
    };

    const getSitesAllocationMetrics = (sites: SupportSiteSummary[]): SiteAllocationMetrics =>
        sites.reduce<SiteAllocationMetrics>((acc, site) => {
            const metrics = getSiteAllocationMetrics(site);
            return {
                issuedAmount: acc.issuedAmount + metrics.issuedAmount,
                settlementAmount: acc.settlementAmount + metrics.settlementAmount,
                distributableAmount: acc.distributableAmount + metrics.distributableAmount,
                allocatedAmount: acc.allocatedAmount + metrics.allocatedAmount,
                unallocatedAmount: acc.unallocatedAmount + metrics.unallocatedAmount,
                vatAmount: acc.vatAmount + metrics.vatAmount,
                isOverAllocated: acc.isOverAllocated || metrics.isOverAllocated
            };
        }, {
            issuedAmount: 0,
            settlementAmount: 0,
            distributableAmount: 0,
            allocatedAmount: 0,
            unallocatedAmount: 0,
            vatAmount: 0,
            isOverAllocated: false
        });

    const persistSiteSettlementSnapshot = async (
        site: SupportSiteSummary,
        overrides: { issuedValue?: string; settlementValue?: string } = {}
    ) => {
        const existing = siteAllocations[site.key];
        const lines = existing?.lines || [];
        const issuedAmount = resolveSiteIssuedAmount(site, overrides.issuedValue ?? issuedAmounts[site.key]);
        const settlementAmount = parseSettlementAmount(overrides.settlementValue ?? settlementAmounts[site.key]);
        const distributableAmount = Math.max(issuedAmount - settlementAmount, 0);
        const allocatedAmount = lines.reduce((sum, line) => sum + Number(line.amount || 0), 0);

        if (!existing && issuedAmount <= 0 && settlementAmount <= 0 && lines.length === 0) return;

        try {
            if (issuedAmount <= 0 && settlementAmount <= 0 && lines.length === 0) {
                await supportClientSiteAllocationService.deleteAllocation(selectedMonth, site.key);
                setAllocationState((prev) => {
                    const base = prev.month === selectedMonth ? prev.allocations : {};
                    const next = { ...base };
                    delete next[site.key];
                    return { month: selectedMonth, allocations: next };
                });
                return;
            }

            const allocation: SupportClientAllocation = {
                id: existing?.id || supportClientSiteAllocationService.getDocumentId(selectedMonth, site.key),
                yearMonth: selectedMonth,
                siteKey: site.key,
                siteId: site.siteId || '',
                siteName: site.siteName,
                clientCompanyId: site.clientCompanyId || '',
                clientCompanyName: site.clientCompanyName || '',
                issuedAmount,
                settlementAmount,
                distributableAmount,
                allocatedAmount,
                status: getAllocationStatus(distributableAmount, allocatedAmount),
                lines,
            };

            await supportClientSiteAllocationService.upsertAllocation(allocation);
            setAllocationState((prev) => ({
                month: selectedMonth,
                allocations: {
                    ...(prev.month === selectedMonth ? prev.allocations : {}),
                    [site.key]: allocation,
                }
            }));
        } catch (error) {
            console.error('[SupportClientSitePage] settlement snapshot save failed:', error);
            setErrors(['정산금액 저장 중 오류가 발생했습니다. 다시 시도해주세요.']);
        }
    };

    const amountSummary = useMemo(() => {
        const sites = clientGroups.flatMap((client) => client.sites);
        const siteMetrics = sites.map((site) => getSiteAllocationMetrics(site));
        const totalIssuedAmount = siteMetrics.reduce((sum, metrics) => sum + metrics.issuedAmount, 0);
        const totalSettlementAmount = sites.reduce((sum, site) => sum + parseSettlementAmount(settlementAmounts[site.key]), 0);
        const totalAllocatedAmount = sites.reduce((sum, site) => sum + (siteAllocations[site.key]?.lines || []).reduce((lineSum, line) => lineSum + Number(line.amount || 0), 0), 0);
        const totalDistributableAmount = Math.max(totalIssuedAmount - totalSettlementAmount, 0);
        const totalVatAmount = siteMetrics.reduce((sum, metrics) => sum + metrics.vatAmount, 0);
        const totalManDay = sites.reduce((sum, site) => sum + site.totalManDay, 0);
        return {
            totalIssuedAmount,
            totalSettlementAmount,
            totalDistributableAmount,
            totalAllocatedAmount,
            totalUnallocatedAmount: totalDistributableAmount - totalAllocatedAmount,
            totalVatAmount,
            avgSsukkumi: totalSettlementAmount > 0 && totalManDay > 0 ? Math.round(totalSettlementAmount / totalManDay) : 0
        };
    }, [clientGroups, issuedAmounts, settlementAmounts, siteAllocations]);

    const toggleSite = (siteKey: string) => {
        setExpandedSiteKeys((prev) => {
            if (prev.has(siteKey)) return new Set();
            return new Set([siteKey]);
        });
    };

    const toggleResponsibleTeam = (teamKey: string) => {
        setExpandedResponsibleTeamKeys((prev) => {
            if (prev.has(teamKey)) return new Set();
            return new Set([teamKey]);
        });
        setExpandedSiteKeys(new Set());
    };

    const toggleClient = (clientKey: string) => {
        setExpandedClientKeys((prev) => {
            if (prev.has(clientKey)) return new Set();
            return new Set([clientKey]);
        });
        setExpandedResponsibleTeamKeys(new Set());
        setExpandedSiteKeys(new Set());
    };

    const handleIssuedAmountChange = (siteKey: string, value: string) => {
        const normalizedValue = normalizeIssuedAmountInput(value);
        setIssuedAmountState((prev) => {
            const base = prev.month === selectedMonth ? prev.amounts : loadIssuedAmounts(selectedMonth);
            const next = { ...base };
            if (normalizedValue) next[siteKey] = normalizedValue;
            else delete next[siteKey];
            return {
                month: selectedMonth,
                amounts: next
            };
        });
    };

    const handleSettlementAmountChange = (siteKey: string, value: string) => {
        const normalizedValue = normalizeSettlementAmountInput(value);
        setSettlementAmountState((prev) => {
            const base = prev.month === selectedMonth ? prev.amounts : loadSettlementAmounts(selectedMonth);
            const next = { ...base };
            if (normalizedValue) next[siteKey] = normalizedValue;
            else delete next[siteKey];
            return {
                month: selectedMonth,
                amounts: next
            };
        });
    };

    const handleApplyBulkBillingRate = () => {
        const billingRate = parseBillingRate(bulkBillingRateInput);
        if (billingRate <= 0) {
            window.alert('적용할 청구단가를 입력해주세요.');
            return;
        }
        setBulkBillingRateInput(formatNumber(billingRate));
        setBillingRateState((prev) => {
            const base = prev.month === selectedMonth ? prev.rates : loadBillingRates(selectedMonth);
            return {
                month: selectedMonth,
                rates: {
                    ...base,
                    bulkRate: String(billingRate)
                }
            };
        });
    };

    const handleRowBillingRateChange = (row: SupportClientSiteWorkerRow, value: string) => {
        const normalizedValue = normalizeBillingRateInput(value);
        setBillingRateState((prev) => {
            const base = prev.month === selectedMonth ? prev.rates : loadBillingRates(selectedMonth);
            const next = { ...base };
            const key = getBillingRowRateKey(row);
            if (normalizedValue) {
                next[key] = normalizedValue;
            } else {
                delete next[key];
            }
            return {
                month: selectedMonth,
                rates: next
            };
        });
    };

    const handleSiteBillingRateChange = (site: SupportSiteSummary, value: string) => {
        const normalizedValue = normalizeBillingRateInput(value);
        setBillingRateState((prev) => {
            const base = prev.month === selectedMonth ? prev.rates : loadBillingRates(selectedMonth);
            const next = { ...base };
            site.rows.forEach((row) => {
                const key = getBillingRowRateKey(row);
                if (normalizedValue) {
                    next[key] = normalizedValue;
                } else {
                    delete next[key];
                }
            });
            return {
                month: selectedMonth,
                rates: next
            };
        });
    };

    const openAllocationModal = (site: SupportSiteSummary) => {
        const metrics = getSiteAllocationMetrics(site);
        setAllocationModalTarget({
            site,
            issuedAmount: metrics.issuedAmount,
            settlementAmount: metrics.settlementAmount,
            distributableAmount: metrics.distributableAmount,
            vatAmount: metrics.vatAmount,
            allocation: siteAllocations[site.key]
        });
    };

    const saveAllocationLines = async (lines: SupportClientAllocationLine[]) => {
        if (!allocationModalTarget) return;
        const { site, issuedAmount, settlementAmount, distributableAmount } = allocationModalTarget;
        const allocatedAmount = lines.reduce((sum, line) => sum + Number(line.amount || 0), 0);
        setAllocationSaving(true);
        try {
            if (lines.length === 0 && issuedAmount <= 0 && settlementAmount <= 0) {
                await supportClientSiteAllocationService.deleteAllocation(selectedMonth, site.key);
                setAllocationState((prev) => {
                    const base = prev.month === selectedMonth ? prev.allocations : {};
                    const next = { ...base };
                    delete next[site.key];
                    return { month: selectedMonth, allocations: next };
                });
                setAllocationModalTarget(null);
                return;
            }
            const allocation: SupportClientAllocation = {
                id: allocationModalTarget.allocation?.id || supportClientSiteAllocationService.getDocumentId(selectedMonth, site.key),
                yearMonth: selectedMonth,
                siteKey: site.key,
                siteId: site.siteId || '',
                siteName: site.siteName,
                clientCompanyId: site.clientCompanyId || '',
                clientCompanyName: site.clientCompanyName || '',
                issuedAmount,
                settlementAmount,
                distributableAmount,
                allocatedAmount,
                status: getAllocationStatus(distributableAmount, allocatedAmount),
                lines,
            };
            await supportClientSiteAllocationService.upsertAllocation(allocation);
            setAllocationState((prev) => ({
                month: selectedMonth,
                allocations: {
                    ...(prev.month === selectedMonth ? prev.allocations : {}),
                    [site.key]: allocation,
                }
            }));
            setAllocationModalTarget(null);
        } catch (error) {
            console.error('[SupportClientSitePage] allocation save failed:', error);
            setErrors(['차액 배분 저장 중 오류가 발생했습니다. 다시 시도해주세요.']);
        } finally {
            setAllocationSaving(false);
        }
    };

    const getClientNoteKey = (clientKey: string): string => `client:${clientKey}`;
    const getResponsibleTeamNoteKey = (clientKey: string, teamKey: string): string => `team:${clientKey}:${teamKey}`;
    const getSiteNoteKey = (siteKey: string): string => `site:${siteKey}`;
    const summaryDetailColSpan = showAllocationColumns ? 15 : 10;

    const toggleLaborStatementPanel = useCallback((key: string, target: SupportStatementTarget) => {
        setTransactionStatementPanel(null);
        setLaborStatementPanel((prev) => prev?.key === key ? null : { key, target });
    }, []);

    const closeLaborStatementPanel = useCallback(() => {
        setLaborStatementPanel(null);
    }, []);

    const isLaborStatementPanelOpen = useCallback((key: string): boolean =>
        laborStatementPanel?.key === key,
    [laborStatementPanel]);

    const toggleTransactionStatementPanel = useCallback((key: string, target: SupportStatementTarget, mode: SupportTransactionStatementMode = 'standard') => {
        setLaborStatementPanel(null);
        setTransactionStatementPanel((prev) => prev?.key === key && prev.mode === mode ? null : { key, target, mode });
    }, []);

    const closeTransactionStatementPanel = useCallback(() => {
        setTransactionStatementPanel(null);
    }, []);

    const isTransactionStatementPanelOpen = useCallback((key: string, mode?: SupportTransactionStatementMode): boolean =>
        transactionStatementPanel?.key === key && (!mode || transactionStatementPanel.mode === mode),
    [transactionStatementPanel]);

    const getLinkedTransactionStatements = useCallback((key: string, mode?: SupportTransactionStatementMode): Estimate[] =>
        transactionStatements.filter((statement) =>
            statement.documentType === 'transaction' &&
            statement.supportStatementSource === SUPPORT_TRANSACTION_STATEMENT_SOURCE &&
            statement.supportStatementKey === key &&
            statement.supportStatementYearMonth === selectedMonth &&
            (!mode || isEstimateTransactionMode(statement, mode))
        ),
    [selectedMonth, transactionStatements]);

    useEffect(() => {
        setLaborStatementPanel(null);
        setTransactionStatementPanel(null);
    }, [selectedMonth, selectedDirection, selectedClientKey, selectedSiteKey]);

    const handleRowNoteChange = (noteKey: string, value: string) => {
        setRowNoteState((prev) => {
            const base = prev.month === selectedMonth ? prev.notes : loadRowNotes(selectedMonth);
            const next = { ...base };
            if (value.trim()) next[noteKey] = value;
            else delete next[noteKey];
            return {
                month: selectedMonth,
                notes: next
            };
        });
    };

    const handleProgressStatusChange = (progressKey: string, value: SupportProgressStatus) => {
        setProgressStatusState((prev) => {
            const base = prev.month === selectedMonth ? prev.statuses : loadProgressStatuses(selectedMonth);
            const next = { ...base };
            if (value) next[progressKey] = value;
            else delete next[progressKey];
            return {
                month: selectedMonth,
                statuses: next
            };
        });
    };

    const renderProgressCell = (progressKey: string, label: string) => {
        const progressStatus = progressStatuses[progressKey] || '';
        const progressOption = getSupportProgressOption(progressStatus);

        return (
            <td className="border border-slate-900 px-1 py-1 text-center font-medium text-slate-900" onClick={(event) => event.stopPropagation()}>
                <select
                    aria-label={`${label} 진행구분`}
                    value={progressStatus}
                    onChange={(event) => handleProgressStatusChange(
                        progressKey,
                        isSupportProgressStatus(event.target.value) ? event.target.value : ''
                    )}
                    className="h-7 w-full border border-slate-900/20 px-1 text-center text-[12px] font-black text-slate-950 outline-none transition focus:bg-white focus:ring-1 focus:ring-emerald-400"
                    style={{ backgroundColor: progressOption?.color ?? '#ffffff' }}
                >
                    <option value="">선택</option>
                    {SUPPORT_PROGRESS_OPTIONS.map((option) => (
                        <option
                            key={option.value}
                            value={option.value}
                            style={{ backgroundColor: option.color, color: '#111827' }}
                        >
                            {option.label}
                        </option>
                    ))}
                </select>
            </td>
        );
    };

    const renderNoteCell = (noteKey: string, label: string) => (
        <td className="border border-slate-900 px-1.5 py-1" onClick={(event) => event.stopPropagation()}>
            <textarea
                value={rowNotes[noteKey] || ''}
                onChange={(event) => handleRowNoteChange(noteKey, event.target.value)}
                aria-label={`${label} 비고 입력`}
                placeholder="비고 입력"
                rows={2}
                className="block min-h-[46px] w-full resize-y rounded border border-transparent bg-slate-50 px-2 py-1.5 text-xs font-bold leading-4 text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-amber-300 focus:bg-white focus:ring-1 focus:ring-amber-300"
            />
        </td>
    );

    const renderLaborStatementPanelRow = (panelKey: string) => {
        if (!laborStatementPanel || laborStatementPanel.key !== panelKey) return null;

        return (
            <tr>
                <td colSpan={summaryDetailColSpan} className="border border-slate-900 bg-emerald-50 p-4">
                    <SupportClientLaborStatementPanel
                        target={laborStatementPanel.target}
                        yearMonth={selectedMonth}
                        statementKey={panelKey}
                        outputSource="support-client-site"
                        onClose={closeLaborStatementPanel}
                    />
                </td>
            </tr>
        );
    };

    const renderTransactionStatementPanelRow = (panelKey: string) => {
        if (!transactionStatementPanel || transactionStatementPanel.key !== panelKey) return null;

        return (
            <tr>
                <td colSpan={summaryDetailColSpan} className="border border-slate-900 bg-teal-50 p-4">
                    <SupportClientTransactionStatementPanel
                        panelKey={panelKey}
                        target={transactionStatementPanel.target}
                        yearMonth={selectedMonth}
                        mode={transactionStatementPanel.mode}
                        linkedStatements={getLinkedTransactionStatements(panelKey, transactionStatementPanel.mode)}
                        allStatements={transactionStatements}
                        loading={transactionStatementsLoading}
                        onSaved={fetchTransactionStatements}
                        outputSource="support-client-site"
                        onClose={closeTransactionStatementPanel}
                    />
                </td>
            </tr>
        );
    };

    const handleDownloadExcel = () => {
        const siteAmountMetrics = new Map<string, SiteAllocationMetrics & { ssukkumi: number }>();
        clientGroups.forEach((client) => {
            client.sites.forEach((site) => {
                const metrics = getSiteAllocationMetrics(site);
                siteAmountMetrics.set(site.key, {
                    ...metrics,
                    ssukkumi: metrics.settlementAmount > 0 && site.totalManDay > 0 ? Math.round(metrics.settlementAmount / site.totalManDay) : 0
                });
            });
        });

        const summaryRows = clientGroups.flatMap((client) =>
            client.sites.map((site) => {
                const amountMetric = siteAmountMetrics.get(site.key) || { issuedAmount: 0, settlementAmount: 0, distributableAmount: 0, allocatedAmount: 0, unallocatedAmount: 0, vatAmount: 0, isOverAllocated: false, ssukkumi: 0 };
                return {
                    발주사: client.clientCompanyName,
                    현장: site.siteName,
                    현장구분: summarizeNames(site.siteTypes),
                    결제방식: summarizeNames(site.paymentTypes),
                    시공사: site.constructorCompanyName || '',
                    지원구분: summarizeOutputTypeDisplayNames(site.rows),
                    현장담당팀: summarizeNames(site.responsibleTeamNames),
                    작업팀: summarizeSourceTeamDisplayNames(site.rows),
                    정산주체: summarizeNames(site.settlementNames),
                    투입일수: site.activeDates.length,
                    인원수: site.workerCount,
                    공수: Number(site.totalManDay.toFixed(1)),
                    평균단가: site.avgUnitPrice,
                    노무금액: site.totalAmount,
                    청구단가: getSiteBillingUnitPrice(site),
                    청구금액: getSiteBillingAmount(site),
                    발행금액: amountMetric.issuedAmount || '',
                    정산금액: amountMetric.settlementAmount || '',
                    차액: amountMetric.distributableAmount || '',
                    배분합계: amountMetric.allocatedAmount || '',
                    미배분: amountMetric.unallocatedAmount || '',
                    쓰꾸미: amountMetric.ssukkumi || '',
                    진행구분: getSupportProgressLabel(progressStatuses[getSiteNoteKey(site.key)]),
                    비고: rowNotes[getSiteNoteKey(site.key)] || ''
                };
            })
        );

        const detailRows = filteredRows.map((row) => {
            const siteKey = `${clientKeyForRow(row)}::${siteKeyForRow(row)}`;
            const amountMetric = siteAmountMetrics.get(siteKey) || { issuedAmount: 0, settlementAmount: 0, distributableAmount: 0, allocatedAmount: 0, unallocatedAmount: 0, vatAmount: 0, isOverAllocated: false, ssukkumi: 0 };
            return {
                일자: row.date,
                발주사: getClientCompanyName(row),
                시공사: row.constructorCompanyName,
                현장: row.siteName,
                현장구분: row.siteType,
                결제방식: row.paymentType,
                지원구분: getOutputTypeDisplayName(row),
                작업자: row.workerName,
                직종: row.role || '',
                작업팀: getSourceTeamDisplayName(row),
                현장담당팀: row.responsibleTeamName,
                정산주체: row.settlementName,
                공수: Number(row.manDay.toFixed(1)),
                단가: row.unitPrice,
                노무금액: row.amount,
                청구단가: getRowBillingUnitPrice(row),
                청구금액: getRowBillingAmount(row),
                발행금액: amountMetric.issuedAmount || '',
                정산금액: amountMetric.settlementAmount || '',
                차액: amountMetric.distributableAmount || '',
                배분합계: amountMetric.allocatedAmount || '',
                미배분: amountMetric.unallocatedAmount || '',
                쓰꾸미: amountMetric.ssukkumi || '',
                진행구분: getSupportProgressLabel(progressStatuses[getSiteNoteKey(siteKey)]),
                근거: row.evidenceNote,
                비고: rowNotes[getSiteNoteKey(siteKey)] || ''
            };
        });

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summaryRows), '발주사별_현장요약');
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(detailRows), '작업자상세');
        XLSX.writeFile(workbook, `support-client-site-${selectedMonth}.xlsx`);
    };

    const hasRows = filteredRows.length > 0;

    const renderSiteRows = (site: SupportSiteSummary, indentClass = 'pl-5', siteLevelLabel?: string) => {
        const isSiteExpanded = expandedSiteKeys.has(site.key);
        const issuedAmountInputValue = issuedAmounts[site.key] || '';
        const settlementAmountInputValue = settlementAmounts[site.key] || '';
        const allocationMetrics = getSiteAllocationMetrics(site);
        const siteVatAmount = allocationMetrics.vatAmount;
        const siteBillingUnitPrice = getSiteBillingUnitPrice(site);
        const siteBillingAmount = getSiteBillingAmount(site);
        const defaultIssuedAmount = getSiteDefaultIssuedAmount(site);
        const ssukkumi = allocationMetrics.settlementAmount > 0 && site.totalManDay > 0
            ? Math.round(allocationMetrics.settlementAmount / site.totalManDay)
            : 0;
        const siteTypeDisplay = summarizeNames(site.siteTypes);
        const paymentTypeDisplay = summarizeNames(site.paymentTypes);
        const siteStatementTarget: SupportStatementTarget = {
            title: site.siteName,
            subtitle: `${site.clientCompanyName} · 현장`,
            rows: site.rows,
            expenseClaims: getSiteExpenseClaims(site),
            billingRateBySiteKey: getBillingRateBySiteKey([site]),
            billingRateByRowId: getBillingRateByRowId(site.rows)
        };
        const siteProgressKey = getSiteNoteKey(site.key);
        const siteProgressOption = getSupportProgressOption(progressStatuses[siteProgressKey]);
        const siteOutputTypeLabels = uniqueValues(site.rows.map((row) => getOutputTypeDisplayName(row)))
            .filter((label) => label !== OWN_SITE_OUTPUT_LABEL);

        return (
            <React.Fragment key={site.key}>
                <tr
                    onClick={() => toggleSite(site.key)}
                    className={`cursor-pointer transition-colors ${siteProgressOption ? '' : 'bg-white hover:bg-slate-50'}`}
                    style={siteProgressOption ? { backgroundColor: siteProgressOption.rowColor } : undefined}
                >
                    <td className={`border border-slate-900 px-2 py-2 ${indentClass}`}>
                        <div className="flex min-w-0 items-start gap-2">
                            <AccordionChevron expanded={isSiteExpanded} className="mt-1 text-[11px] text-slate-500" />
                            <div className="min-w-0">
                                {siteOutputTypeLabels.length > 0 && (
                                    <div className="mb-1 flex flex-wrap items-center gap-1">
                                        {siteOutputTypeLabels.map((label) => (
                                            <OutputTypeBadge key={label} label={label} />
                                        ))}
                                    </div>
                                )}
                                <div className="flex min-w-0 items-center gap-2 font-black text-slate-900">
                                    {siteLevelLabel && (
                                        <span className="shrink-0 rounded bg-slate-700 px-1.5 py-0.5 text-[10px] font-black text-white">
                                            {siteLevelLabel}
                                        </span>
                                    )}
                                    <FontAwesomeIcon icon={faMapLocationDot} className="shrink-0 text-slate-400" />
                                    <span className="truncate">{site.siteName}</span>
                                </div>
                                <div className="mt-1 flex flex-wrap gap-1.5">
                                    <SiteMetaBadge label="구분" value={siteTypeDisplay} tone="violet" />
                                    <SiteMetaBadge label="결제" value={paymentTypeDisplay} tone="sky" />
                                </div>
                                <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                                    <span className="text-[10px] font-black text-slate-500">현장담당</span>
                                    <ResponsibleTeamChips teams={site.responsibleTeams} />
                                </div>
                            </div>
                        </div>
                    </td>
                    <td className="border border-slate-900 px-2 py-2 text-center font-mono font-black">{formatManDay(site.totalManDay)}</td>
                    <td className="border border-slate-900 px-2 py-2 text-right font-mono">{formatNumber(site.avgUnitPrice)}</td>
                    <td className="border border-slate-900 px-2 py-2 text-right font-mono font-black">{formatNumber(site.totalAmount)}</td>
                    {showAllocationColumns && (
                        <>
                    <td className="border border-slate-900 bg-emerald-50 px-1 py-1 text-right font-mono font-black text-emerald-800" onClick={(event) => event.stopPropagation()}>
                        <input
                            type="text"
                            inputMode="numeric"
                            aria-label={`${site.siteName} 청구단가`}
                            value={siteBillingUnitPrice > 0 ? formatNumber(siteBillingUnitPrice) : ''}
                            onChange={(event) => handleSiteBillingRateChange(site, event.target.value)}
                            onFocus={(event) => event.currentTarget.select()}
                            placeholder="0"
                            className="h-7 w-full bg-transparent px-1 text-right font-mono font-black text-emerald-800 outline-none transition focus:bg-emerald-100 focus:ring-1 focus:ring-emerald-400"
                        />
                    </td>
                    <td className="border border-slate-900 bg-emerald-50 px-2 py-2 text-right font-mono font-black text-emerald-900">{siteBillingAmount > 0 ? formatNumber(siteBillingAmount) : '-'}</td>
                        </>
                    )}
                    <td className="border border-slate-900 bg-yellow-50 px-1 py-1 text-right font-mono" onClick={(event) => event.stopPropagation()}>
                        <div className="flex items-center">
                            <input
                                type="text"
                                inputMode="numeric"
                                aria-label={`${site.siteName} 발행금액 입력`}
                                value={formatCurrencyInputValue(issuedAmountInputValue)}
                                onChange={(event) => handleIssuedAmountChange(site.key, event.target.value)}
                                onBlur={(event) => void persistSiteSettlementSnapshot(site, { issuedValue: event.currentTarget.value })}
                                placeholder={defaultIssuedAmount > 0 ? formatNumber(defaultIssuedAmount) : '0'}
                                className="h-7 min-w-0 flex-1 bg-transparent px-1 text-right font-mono font-black text-amber-900 outline-none transition focus:bg-amber-100 focus:ring-1 focus:ring-amber-400"
                            />
                            <span className="ml-1 text-[11px] font-black text-slate-500">원</span>
                        </div>
                        {siteVatAmount > 0 && (
                            <div className="mt-0.5 text-[10px] font-black leading-none text-amber-700">
                                부가세 +{formatNumber(siteVatAmount)} 포함
                            </div>
                        )}
                    </td>
                    <td className="border border-slate-900 bg-amber-100 px-1 py-1 text-right font-mono" onClick={(event) => event.stopPropagation()}>
                        <div className="flex items-center">
                            <input
                                type="text"
                                inputMode="numeric"
                                aria-label={`${site.siteName} 정산금액 입력`}
                                value={formatCurrencyInputValue(settlementAmountInputValue)}
                                onChange={(event) => handleSettlementAmountChange(site.key, event.target.value)}
                                onBlur={(event) => void persistSiteSettlementSnapshot(site, { settlementValue: event.currentTarget.value })}
                                placeholder="0"
                                className="h-7 min-w-0 flex-1 bg-transparent px-1 text-right font-mono font-black text-amber-950 outline-none transition focus:bg-amber-200 focus:ring-1 focus:ring-amber-500"
                            />
                            <span className="ml-1 text-[11px] font-black text-slate-500">원</span>
                        </div>
                    </td>
                    {showAllocationColumns && (
                        <>
                            <td className="border border-slate-900 px-2 py-2 text-right font-mono font-black text-slate-900">
                                {allocationMetrics.distributableAmount > 0 ? formatNumber(allocationMetrics.distributableAmount) : '-'}
                            </td>
                            <td className="border border-slate-900 px-2 py-2 text-right font-mono font-black text-indigo-700">
                                {allocationMetrics.allocatedAmount > 0 ? formatNumber(allocationMetrics.allocatedAmount) : '-'}
                            </td>
                            <td className={`border border-slate-900 px-2 py-2 text-right font-mono font-black ${allocationMetrics.isOverAllocated ? 'text-rose-700' : allocationMetrics.unallocatedAmount === 0 && allocationMetrics.distributableAmount > 0 ? 'text-emerald-700' : 'text-amber-800'}`}>
                                {allocationMetrics.distributableAmount > 0 || allocationMetrics.allocatedAmount > 0 ? formatNumber(allocationMetrics.unallocatedAmount) : '-'}
                            </td>
                        </>
                    )}
                    <td className="border border-slate-900 px-2 py-2 text-right font-mono font-black text-amber-800">{ssukkumi > 0 ? formatNumber(ssukkumi) : '-'}</td>
                    {renderProgressCell(siteProgressKey, site.siteName)}
                    {renderNoteCell(siteProgressKey, site.siteName)}
                    <td className="border border-slate-900 px-1 py-1 text-center" onClick={(event) => event.stopPropagation()}>
                        <div className="flex flex-wrap items-center justify-center gap-1">
                            <StatementActionButtons
                                target={siteStatementTarget}
                                onOpenLabor={(target) => toggleLaborStatementPanel(siteProgressKey, target)}
                                onOpenTransaction={(target) => toggleTransactionStatementPanel(siteProgressKey, target, 'standard')}
                                onOpenRentalTransaction={(target) => toggleTransactionStatementPanel(siteProgressKey, target, 'rental')}
                                onOpenExpense={setExpenseStatementTarget}
                                laborOpen={isLaborStatementPanelOpen(siteProgressKey)}
                                transactionOpen={isTransactionStatementPanelOpen(siteProgressKey, 'standard')}
                                rentalTransactionOpen={isTransactionStatementPanelOpen(siteProgressKey, 'rental')}
                                transactionCount={getLinkedTransactionStatements(siteProgressKey, 'standard').length}
                                rentalTransactionCount={getLinkedTransactionStatements(siteProgressKey, 'rental').length}
                            />
                            {showAllocationColumns && (
                                <button
                                    type="button"
                                    onClick={() => openAllocationModal(site)}
                                    className="rounded border border-indigo-200 bg-indigo-50 px-1.5 py-1 text-[11px] font-black text-indigo-700 hover:bg-indigo-100"
                                >
                                    배분
                                </button>
                            )}
                        </div>
                    </td>
                </tr>

                {renderLaborStatementPanelRow(siteProgressKey)}
                {renderTransactionStatementPanelRow(siteProgressKey)}

                {isSiteExpanded && (
                    <tr>
                        <td colSpan={summaryDetailColSpan} className="border border-slate-900 bg-slate-50 p-4">
                            <div className="mb-3">
                                <h3 className="flex flex-wrap items-center gap-2 text-sm font-black text-slate-800">
                                    {siteLevelLabel && (
                                        <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-black text-white">
                                            4단
                                        </span>
                                    )}
                                    <span>{site.siteName} 작업자 상세</span>
                                </h3>
                                <p className="mt-1 text-[11px] font-semibold text-slate-500">
                                    {formatNumber(site.rows.length)}개 투입 행 · {formatManDay(site.totalManDay)}공수 · 노무 {formatNumber(site.totalAmount)}원
                                    {showAllocationColumns && ` · 청구 ${formatNumber(siteBillingAmount)}원`}
                                </p>
                            </div>
                            <div className="overflow-x-auto border border-slate-900 bg-white">
                                <table className={`w-full border-collapse text-xs ${showAllocationColumns ? 'min-w-[1120px]' : 'min-w-[940px]'}`}>
                                    <thead className="bg-slate-100 text-slate-700">
                                    <tr>
                                        <th className="border border-slate-900 px-4 py-2.5 text-left">일자</th>
                                        <th className="border border-slate-900 px-4 py-2.5 text-left">구분</th>
                                        <th className="border border-slate-900 px-4 py-2.5 text-left">작업자</th>
                                        <th className="border border-slate-900 px-4 py-2.5 text-left">작업팀</th>
                                        <th className="border border-slate-900 px-4 py-2.5 text-left">현장담당팀</th>
                                        <th className="border border-slate-900 px-4 py-2.5 text-left">정산주체</th>
                                        <th className="border border-slate-900 px-4 py-2.5 text-right">공수</th>
                                        <th className="border border-slate-900 px-4 py-2.5 text-right">단가</th>
                                        <th className="border border-slate-900 px-4 py-2.5 text-right">금액</th>
                                        {showAllocationColumns && (
                                            <>
                                        <th className="border border-slate-900 bg-emerald-100 px-4 py-2.5 text-right text-emerald-950">청구단가</th>
                                        <th className="border border-slate-900 bg-emerald-100 px-4 py-2.5 text-right text-emerald-950">청구금액</th>
                                            </>
                                        )}
                                        <th className="border border-slate-900 px-4 py-2.5 text-left">근거</th>
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {site.rows.map((row) => (
                                        <tr key={row.rowId}>
                                            <td className="border border-slate-900 px-4 py-2.5 font-mono text-slate-500">{row.date}</td>
                                            <td className="border border-slate-900 px-4 py-2.5"><OutputTypeBadge label={getOutputTypeDisplayName(row)} /></td>
                                            <td className="border border-slate-900 px-4 py-2.5 font-black text-slate-800">{row.workerName}</td>
                                            <td className="border border-slate-900 px-4 py-2.5 font-bold text-slate-600">
                                                {getSourceTeamDisplayName(row) || '-'}
                                            </td>
                                            <td className="border border-slate-900 px-4 py-2.5 font-bold text-slate-600">{row.responsibleTeamName || '-'}</td>
                                            <td className="border border-slate-900 px-4 py-2.5 font-bold text-slate-600">{row.settlementName || '-'}</td>
                                            <td className="border border-slate-900 px-4 py-2.5 text-right font-mono font-bold">{formatManDay(row.manDay)}</td>
                                            <td className="border border-slate-900 px-4 py-2.5 text-right font-mono text-slate-500">{formatNumber(row.unitPrice)}</td>
                                            <td className="border border-slate-900 px-4 py-2.5 text-right font-mono font-black text-slate-800">{formatNumber(row.amount)}</td>
                                            {showAllocationColumns && (
                                                <>
                                            <td className="border border-slate-900 bg-emerald-50 px-1 py-1 text-right font-mono text-emerald-700" onClick={(event) => event.stopPropagation()}>
                                                <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    aria-label={`${row.workerName} 청구단가`}
                                                    value={formatNumber(getRowBillingUnitPrice(row))}
                                                    onChange={(event) => handleRowBillingRateChange(row, event.target.value)}
                                                    onFocus={(event) => event.currentTarget.select()}
                                                    className="h-7 w-full bg-transparent px-1 text-right font-mono text-emerald-700 outline-none transition focus:bg-emerald-100 focus:ring-1 focus:ring-emerald-400"
                                                    placeholder="0"
                                                />
                                            </td>
                                            <td className="border border-slate-900 bg-emerald-50 px-4 py-2.5 text-right font-mono font-black text-emerald-800">{formatNumber(getRowBillingAmount(row))}</td>
                                                </>
                                            )}
                                            <td className="border border-slate-900 px-4 py-2.5 text-slate-500">{row.evidenceNote}</td>
                                        </tr>
                                    ))}
                                    </tbody>
                                </table>
                            </div>
                        </td>
                    </tr>
                )}
            </React.Fragment>
        );
    };

    const getClientVisibleRowCount = (client: SupportClientSummary): number => {
        const clientPanelKey = getClientNoteKey(client.key);
        const clientPanelCount =
            (isLaborStatementPanelOpen(clientPanelKey) ? 1 : 0) +
            (isTransactionStatementPanelOpen(clientPanelKey) ? 1 : 0);
        const isClientExpanded = expandedClientKeys.has(client.key);
        if (!isClientExpanded) return 1 + clientPanelCount;

        const getVisibleSiteExtraRowCount = (site: SupportSiteSummary): number => {
            const sitePanelKey = getSiteNoteKey(site.key);
            return (
                (isLaborStatementPanelOpen(sitePanelKey) ? 1 : 0) +
                (isTransactionStatementPanelOpen(sitePanelKey) ? 1 : 0) +
                (expandedSiteKeys.has(site.key) ? 1 : 0)
            );
        };
        if (isExternalClientSummary(client)) {
            const responsibleTeamGroups = groupSitesByResponsibleTeam(client.sites);
            const teamPanelCount = responsibleTeamGroups.reduce((sum, teamGroup) => {
                const teamPanelKey = getResponsibleTeamNoteKey(client.key, teamGroup.key);
                return sum +
                    (isLaborStatementPanelOpen(teamPanelKey) ? 1 : 0) +
                    (isTransactionStatementPanelOpen(teamPanelKey) ? 1 : 0);
            }, 0);
            const expandedResponsibleTeamSiteRowCount = responsibleTeamGroups
                .filter((teamGroup) => expandedResponsibleTeamKeys.has(teamGroup.key))
                .reduce((sum, teamGroup) =>
                    sum + teamGroup.sites.length + teamGroup.sites.reduce((siteSum, site) => siteSum + getVisibleSiteExtraRowCount(site), 0),
                0);
            return 1 + clientPanelCount + responsibleTeamGroups.length + teamPanelCount + expandedResponsibleTeamSiteRowCount;
        }

        return 1 + clientPanelCount + client.sites.length + client.sites.reduce((sum, site) => sum + getVisibleSiteExtraRowCount(site), 0);
    };

    const standardClientGroups = clientGroups.filter((client) => !isExternalClientSummary(client));
    const orderedClientGroups = standardClientGroups;
    const standardClientGroupRowSpan = standardClientGroups.reduce((sum, client) => sum + getClientVisibleRowCount(client), 0);

    return (
        <div className="support-team-font w-full min-w-0 max-w-none space-y-2 p-2 font-['Pretendard'] sm:px-3">
            <PayrollIssueTopTabs />
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
                <div className="flex min-w-0 items-center gap-2">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                        <FontAwesomeIcon icon={faBuilding} />
                    </div>
                    <div>
                        <h1 className="text-lg font-black tracking-tight text-slate-800" title="지원팀 지급 관리 데이터를 발주사와 현장 단위로 재집계합니다.">발주사별 현장별 지원 정산</h1>
                    </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                    <button
                        type="button"
                        onClick={() => navigate('/payroll/support-team')}
                        className="inline-flex min-h-8 items-center gap-2 rounded-lg border border-slate-200 px-3 py-1 text-sm font-black text-slate-600 transition hover:bg-slate-50"
                    >
                        <FontAwesomeIcon icon={faArrowLeft} />
                        지원팀 지급 관리
                    </button>
                    <button
                        type="button"
                        onClick={handleDownloadExcel}
                        disabled={!hasRows}
                        className="inline-flex min-h-8 items-center gap-2 rounded-lg bg-emerald-600 px-3 py-1 text-sm font-black text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <FontAwesomeIcon icon={faDownload} />
                        엑셀 다운로드
                    </button>
                </div>
            </div>

            <PagePrimaryAccountSettings compact scope="support-client-site" />

            <div className="flex w-full flex-col gap-3 lg:flex-row">
                <aside className="hidden">
                    <div className="sticky top-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3.5">
                            <span className="text-sm font-black text-slate-700">발주사 필터</span>
                            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-black text-slate-600">{clientOptions.length}</span>
                        </div>
                        <div className="max-h-[calc(100vh-300px)] space-y-1.5 overflow-y-auto p-2">
                            <button
                                type="button"
                                onClick={() => setSelectedClientKey('')}
                                className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-bold transition-all ${
                                    selectedClientKey === '' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'
                                }`}
                            >
                                <FontAwesomeIcon icon={faBuilding} className={selectedClientKey === '' ? 'opacity-100' : 'opacity-40'} />
                                <span className="flex-1 truncate">전체 발주사</span>
                            </button>
                            <div className="mx-2 my-2 h-px bg-slate-100" />
                            {clientOptions.map((client) => (
                                <button
                                    key={client.key}
                                    type="button"
                                    onClick={() => setSelectedClientKey(client.key)}
                                    className={`flex w-full items-center justify-between gap-2 rounded-xl px-4 py-3 text-left text-sm font-bold transition-all ${
                                        selectedClientKey === client.key ? 'bg-emerald-700 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'
                                    }`}
                                >
                                    <span className="min-w-0 flex-1 truncate">{client.clientCompanyName}</span>
                                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                                        selectedClientKey === client.key ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                                    }`}>
                                        {client.siteCount}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                </aside>

                <main className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
                        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
                            <div className="flex items-center gap-2">
                                <FontAwesomeIcon icon={faCalendarAlt} className="text-emerald-500" />
                                <span className="text-sm font-bold text-slate-500">집계 기준월</span>
                                <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-1 shadow-sm" aria-label="집계 기준월 선택">
                                    <button
                                        type="button"
                                        onClick={() => setSelectedMonth((current) => shiftYearMonth(current, -1))}
                                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-50 hover:text-emerald-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                                        aria-label="이전 달 보기"
                                        title="이전 달"
                                    >
                                        <FontAwesomeIcon icon={faChevronLeft} className="text-xs" />
                                    </button>
                                    <span className="min-w-[92px] px-2 text-center text-sm font-black text-slate-800" aria-live="polite">
                                        {formatYearMonthLabel(selectedMonth)}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedMonth((current) => shiftYearMonth(current, 1))}
                                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-50 hover:text-emerald-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                                        aria-label="다음 달 보기"
                                        title="다음 달"
                                    >
                                        <FontAwesomeIcon icon={faChevronRight} className="text-xs" />
                                    </button>
                                </div>
                            </div>
                            {showAllocationColumns && (
                                <>
                            <div className="hidden h-6 w-px bg-slate-200 sm:block" />
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-bold text-slate-500">청구단가</span>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={bulkBillingRateInput}
                                    onChange={(event) => setBulkBillingRateInput(event.target.value)}
                                    onFocus={(event) => event.currentTarget.select()}
                                    aria-label="일괄 적용 청구단가"
                                    className="h-9 w-32 rounded-lg border border-slate-200 bg-slate-50 px-3 text-right text-sm font-black text-slate-900 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                                />
                                <span className="text-sm font-bold text-slate-500">원</span>
                                <button
                                    type="button"
                                    onClick={handleApplyBulkBillingRate}
                                    disabled={loading || filteredRows.length === 0}
                                    className="inline-flex h-9 items-center gap-2 rounded-lg bg-slate-900 px-3 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                                >
                                    <FontAwesomeIcon icon={faCircleCheck} />
                                    월 적용
                                </button>
                                {appliedBulkBillingRate > 0 && (
                                    <span className="text-[11px] font-bold text-emerald-600">{selectedMonth} 적용됨</span>
                                )}
                            </div>
                                </>
                            )}
                            <button
                                type="button"
                                onClick={() => setShowAllocationColumns((prev) => !prev)}
                                aria-pressed={showAllocationColumns}
                                className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-black transition ${
                                    showAllocationColumns
                                        ? 'border-indigo-500 bg-indigo-600 text-white shadow-sm'
                                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                }`}
                            >
                                <FontAwesomeIcon icon={faShareNodes} />
                                분배
                            </button>
                            <div className="hidden h-6 w-px bg-slate-200 sm:block" />
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                                <FontAwesomeIcon icon={loading ? faSpinner : faCircleCheck} spin={loading} />
                                {loading ? '집계 중' : `${formatNumber(displayRows.length)}건 로드`}
                            </div>
                        </div>

                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <select
                                value={selectedDirection}
                                onChange={(event) => setSelectedDirection(event.target.value as 'all' | SupportDirection)}
                                className="max-w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-black outline-none focus:ring-2 focus:ring-emerald-500"
                            >
                                {DIRECTION_OPTIONS.map((option) => (
                                    <option key={option.id} value={option.id}>{option.label}</option>
                                ))}
                            </select>
                            <select
                                value={selectedSiteKey}
                                onChange={(event) => setSelectedSiteKey(event.target.value)}
                                className="max-w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-black outline-none focus:ring-2 focus:ring-emerald-500 sm:max-w-[260px]"
                            >
                                <option value="">모든 현장</option>
                                {siteOptions.map((site) => (
                                    <option key={site.key} value={site.key}>{site.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {errors.length > 0 && (
                        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">
                            <FontAwesomeIcon icon={faTriangleExclamation} className="mr-2" />
                            {errors[0]}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7">
                        <SummaryCard compact label="총 투입 공수" value={`${formatManDay(totalSummary.totalManDay)} 공수`} icon={faCalendarAlt} tone="violet" />
                        <SummaryCard compact label="총 노무금액" value={`${formatNumber(totalSummary.totalAmount)} 원`} icon={faCircleCheck} tone="emerald" />
                        {showAllocationColumns && (
                            <SummaryCard compact label="총 청구금액" value={`${formatNumber(totalSummary.totalBillingAmount)} 원`} icon={faFileInvoiceDollar} tone="orange" />
                        )}
                        <SummaryCard compact label="총 발행금액" value={`${formatNumber(amountSummary.totalIssuedAmount)} 원`} icon={faDownload} tone="sky" />
                        <SummaryCard compact label="총 정산금액" value={`${formatNumber(amountSummary.totalSettlementAmount)} 원`} icon={faReceipt} tone="emerald" />
                        {showAllocationColumns && (
                            <>
                        <SummaryCard compact label="총 차액" value={`${formatNumber(amountSummary.totalDistributableAmount)} 원`} icon={faShareNodes} tone="violet" />
                        <SummaryCard compact label="배분합계" value={`${formatNumber(amountSummary.totalAllocatedAmount)} 원`} icon={faFileInvoiceDollar} tone="sky" />
                        <SummaryCard compact label="미배분" value={`${formatNumber(amountSummary.totalUnallocatedAmount)} 원`} icon={faTriangleExclamation} tone={amountSummary.totalUnallocatedAmount < 0 ? 'orange' : 'violet'} />
                            </>
                        )}
                        <SummaryCard compact label="평균 쓰꾸미" value={amountSummary.avgSsukkumi > 0 ? `${formatNumber(amountSummary.avgSsukkumi)} 원` : '-'} icon={faCircleCheck} tone="orange" />
                        <SummaryCard compact label="발주사 / 현장" value={`${formatNumber(totalSummary.clientCount)} / ${formatNumber(totalSummary.siteCount)}`} icon={faBuilding} tone="sky" />
                        <SummaryCard compact label="투입 인원" value={`${formatNumber(totalSummary.workerCount)} 명`} icon={faUsers} tone="orange" />
                    </div>

                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-black text-amber-800">
                        계산서 현장 부가세 합계: {formatNumber(amountSummary.totalVatAmount)}원
                    </div>

                    <div className="overflow-hidden border border-slate-900 bg-white shadow-sm">
                        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-slate-900 bg-white px-3 py-2">
                            <h2 className="text-base font-black text-slate-900">
                                {selectedClientKey
                                    ? clientOptions.find((client) => client.key === selectedClientKey)?.clientCompanyName || '선택 발주사'
                                    : '전체 발주사'} 현장별 지원 요약
                            </h2>
                            <span className="text-[11px] font-bold text-slate-500">도급 직영 현장은 2단 발주사 · 3단 현장 · 4단 작업자 상세로 표시합니다.</span>
                        </div>

                        {loading ? (
                            <div className="px-4 py-16 text-center font-bold text-slate-400">
                                <FontAwesomeIcon icon={faSpinner} spin className="mr-2" />
                                지원 정산 데이터를 집계하고 있습니다.
                            </div>
                        ) : !hasRows ? (
                            <div className="px-4 py-16 text-center font-bold text-slate-400">
                                <FontAwesomeIcon icon={faSearch} className="mr-2" />
                                해당 조건의 발주사별/현장별 지원 내역이 없습니다.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className={`w-full table-fixed border-collapse text-[13px] ${showAllocationColumns ? 'min-w-[2120px]' : 'min-w-[1460px]'}`}>
                                    <thead>
                                        <tr className="text-center font-black text-slate-950">
                                            <th className="w-14 border border-slate-900 bg-gradient-to-br from-yellow-100 via-yellow-400 to-white p-2"></th>
                                            <th className="w-64 border border-slate-900 bg-gradient-to-br from-white via-slate-200 to-slate-500 p-2 tracking-[0.2em]">발주사 / 담당팀 / 현장</th>
                                            <th className="w-20 border border-slate-900 bg-gradient-to-br from-white via-slate-200 to-slate-500 p-2 tracking-[0.35em]">공수</th>
                                            <th className="w-28 border border-slate-900 bg-gradient-to-br from-white via-slate-200 to-slate-500 p-2 tracking-[0.2em]">평균단가</th>
                                            <th className="w-32 border border-slate-900 bg-gradient-to-br from-white via-slate-200 to-slate-500 p-2 tracking-[0.2em]">노무금액</th>
                                            {showAllocationColumns && (
                                                <>
                                            <th className="w-28 border border-slate-900 bg-gradient-to-br from-white via-emerald-100 to-emerald-300 p-2 tracking-[0.05em] text-emerald-950">청구단가</th>
                                            <th className="w-32 border border-slate-900 bg-gradient-to-br from-white via-emerald-100 to-emerald-300 p-2 tracking-[0.05em] text-emerald-950">청구금액</th>
                                                </>
                                            )}
                                            <th className="w-28 border border-slate-900 bg-gradient-to-br from-yellow-50 via-yellow-300 to-yellow-500 p-2 tracking-[0.2em] text-slate-950">발행금액</th>
                                            <th className="w-28 border border-slate-900 bg-gradient-to-br from-amber-100 via-amber-300 to-amber-500 p-2 tracking-[0.2em] text-slate-950">정산금액</th>
                                            {showAllocationColumns && (
                                                <>
                                            <th className="w-32 border border-slate-900 bg-gradient-to-br from-white via-slate-200 to-slate-500 p-2 tracking-[0.35em]">차액</th>
                                            <th className="w-36 border border-slate-900 bg-gradient-to-br from-white via-slate-200 to-slate-500 p-2 tracking-[0.2em]">배분합계</th>
                                            <th className="w-32 border border-slate-900 bg-gradient-to-br from-white via-slate-200 to-slate-500 p-2 tracking-[0.35em]">미배분</th>
                                                </>
                                            )}
                                            <th className="w-28 border border-slate-900 bg-gradient-to-br from-white via-slate-200 to-slate-500 p-2 tracking-[0.35em]">쓰꾸미</th>
                                            <th className="w-36 border border-slate-900 bg-gradient-to-br from-white via-slate-200 to-slate-500 p-2 tracking-[0.2em]">진행구분</th>
                                            <th className="w-72 border border-slate-900 bg-gradient-to-br from-white via-slate-200 to-slate-500 p-2 tracking-[0.35em]">비고</th>
                                            <th className="w-64 border border-slate-900 bg-gradient-to-br from-white via-slate-200 to-slate-500 p-2 tracking-[0.35em]">기타</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                {orderedClientGroups.map((client) => {
                                    const isClientExpanded = expandedClientKeys.has(client.key);
                                    const isExternalClient = isExternalClientSummary(client);
                                    const isFirstStandardClient = !isExternalClient && standardClientGroups[0]?.key === client.key;
                                    const responsibleTeamGroups = isExternalClient ? groupSitesByResponsibleTeam(client.sites) : [];
                                    const clientAllocationMetrics = getSitesAllocationMetrics(client.sites);
                                    const clientBillingMetrics = getSitesBillingMetrics(client.sites);
                                    const clientSsukkumi = clientAllocationMetrics.settlementAmount > 0 && client.totalManDay > 0
                                        ? Math.round(clientAllocationMetrics.settlementAmount / client.totalManDay)
                                        : 0;
                                    const clientAverageUnitPrice = client.totalManDay > 0
                                        ? Math.round(client.totalAmount / client.totalManDay)
                                        : 0;
                                    const clientRowSpan = getClientVisibleRowCount(client);
                                    const firstLevelRowSpan = isExternalClient ? clientRowSpan : standardClientGroupRowSpan;
                                    const firstLevelLabel = isExternalClient ? EXTERNAL_CLIENT_GROUP_DISPLAY_NAME : STANDARD_CLIENT_GROUP_DISPLAY_NAME;
                                    const clientDisplayName = isExternalClient ? '지원현장 전체' : client.clientCompanyName;
                                    const clientStatementTarget: SupportStatementTarget = {
                                        title: clientDisplayName,
                                        subtitle: isExternalClient ? EXTERNAL_CLIENT_GROUP_DISPLAY_NAME : STANDARD_CLIENT_GROUP_DISPLAY_NAME,
                                        rows: client.sites.flatMap((site) => site.rows),
                                        expenseClaims: getSitesExpenseClaims(client.sites),
                                        billingRateBySiteKey: getBillingRateBySiteKey(client.sites),
                                        billingRateByRowId: getBillingRateByRowId(client.sites.flatMap((site) => site.rows))
                                    };
                                    const clientProgressKey = getClientNoteKey(client.key);
                                    const clientProgressOption = getSupportProgressOption(progressStatuses[clientProgressKey]);
                                    return (
                                        <React.Fragment key={client.key}>
                                            <tr
                                                onClick={() => toggleClient(client.key)}
                                                className={`cursor-pointer transition-colors ${clientProgressOption ? '' : 'bg-white hover:bg-emerald-50'}`}
                                                style={clientProgressOption ? { backgroundColor: clientProgressOption.rowColor } : undefined}
                                            >
                                                {(isExternalClient || isFirstStandardClient) && (
                                                    <td
                                                        rowSpan={firstLevelRowSpan}
                                                        className={`border border-slate-900 text-center align-middle text-lg font-black text-slate-950 ${
                                                            isExternalClient
                                                                ? 'bg-gradient-to-br from-yellow-100 via-yellow-400 to-white'
                                                                : 'bg-gradient-to-br from-emerald-100 via-emerald-400 to-white'
                                                        }`}
                                                    >
                                                        <div className="mx-auto leading-8" style={{ writingMode: 'vertical-rl', textOrientation: 'upright' }}>
                                                            {firstLevelLabel}
                                                        </div>
                                                    </td>
                                                )}
                                                <td className={`border border-slate-900 px-2 py-2 font-black ${isExternalClient ? 'text-slate-950' : 'pl-4 text-slate-900'}`}>
                                                    <span className={`inline-flex min-w-0 items-center ${isExternalClient ? 'gap-2' : 'gap-2.5'}`}>
                                                        <AccordionChevron expanded={isClientExpanded} className={`${isExternalClient ? 'text-[11px]' : 'text-sm'} text-emerald-700`} />
                                                        {!isExternalClient && (
                                                            <span className="shrink-0 rounded bg-emerald-700 px-2 py-1 text-[12px] font-black text-white">2단</span>
                                                        )}
                                                        <span className={`truncate ${isExternalClient ? '' : 'text-sm'}`}>{clientDisplayName}</span>
                                                    </span>
                                                </td>
                                                <td className="border border-slate-900 px-2 py-2 text-center font-mono font-black">{formatManDay(client.totalManDay)}</td>
                                                <td className="border border-slate-900 px-2 py-2 text-right font-mono">{clientAverageUnitPrice > 0 ? formatNumber(clientAverageUnitPrice) : '-'}</td>
                                                <td className="border border-slate-900 px-2 py-2 text-right font-mono font-black text-slate-950">{formatNumber(client.totalAmount)}</td>
                                                {showAllocationColumns && (
                                                    <>
                                                <td className="border border-slate-900 bg-emerald-50 px-2 py-2 text-right font-mono font-black text-emerald-800">{clientBillingMetrics.billingUnitPrice > 0 ? formatNumber(clientBillingMetrics.billingUnitPrice) : '-'}</td>
                                                <td className="border border-slate-900 bg-emerald-50 px-2 py-2 text-right font-mono font-black text-emerald-900">{clientBillingMetrics.billingAmount > 0 ? formatNumber(clientBillingMetrics.billingAmount) : '-'}</td>
                                                    </>
                                                )}
                                                <td className="border border-slate-900 bg-yellow-50 px-2 py-2 text-right font-mono font-black text-amber-900">{clientAllocationMetrics.issuedAmount > 0 ? formatNumber(clientAllocationMetrics.issuedAmount) : '-'}</td>
                                                <td className="border border-slate-900 bg-amber-100 px-2 py-2 text-right font-mono font-black text-amber-950">{clientAllocationMetrics.settlementAmount > 0 ? formatNumber(clientAllocationMetrics.settlementAmount) : '-'}</td>
                                                {showAllocationColumns && (
                                                    <>
                                                        <td className="border border-slate-900 px-2 py-2 text-right font-mono font-black text-slate-950">{clientAllocationMetrics.distributableAmount > 0 ? formatNumber(clientAllocationMetrics.distributableAmount) : '-'}</td>
                                                <td className="border border-slate-900 px-2 py-2 text-right font-mono font-black text-indigo-700">{clientAllocationMetrics.allocatedAmount > 0 ? formatNumber(clientAllocationMetrics.allocatedAmount) : '-'}</td>
                                                        <td className={`border border-slate-900 px-2 py-2 text-right font-mono font-black ${clientAllocationMetrics.isOverAllocated ? 'text-rose-700' : 'text-amber-800'}`}>{clientAllocationMetrics.distributableAmount > 0 || clientAllocationMetrics.allocatedAmount > 0 ? formatNumber(clientAllocationMetrics.unallocatedAmount) : '-'}</td>
                                                    </>
                                                )}
                                                <td className="border border-slate-900 px-2 py-2 text-right font-mono font-black text-amber-800">{clientSsukkumi > 0 ? formatNumber(clientSsukkumi) : '-'}</td>
                                                {renderProgressCell(clientProgressKey, clientDisplayName)}
                                                {renderNoteCell(clientProgressKey, clientDisplayName)}
                                                <td className="border border-slate-900 px-1 py-1 text-center" onClick={(event) => event.stopPropagation()}>
                                                    <StatementActionButtons
                                                        target={clientStatementTarget}
                                                        onOpenLabor={(target) => toggleLaborStatementPanel(clientProgressKey, target)}
                                                        onOpenTransaction={(target) => toggleTransactionStatementPanel(clientProgressKey, target, 'standard')}
                                                        onOpenRentalTransaction={(target) => toggleTransactionStatementPanel(clientProgressKey, target, 'rental')}
                                                        onOpenExpense={setExpenseStatementTarget}
                                                        laborOpen={isLaborStatementPanelOpen(clientProgressKey)}
                                                        transactionOpen={isTransactionStatementPanelOpen(clientProgressKey, 'standard')}
                                                        rentalTransactionOpen={isTransactionStatementPanelOpen(clientProgressKey, 'rental')}
                                                        transactionCount={getLinkedTransactionStatements(clientProgressKey, 'standard').length}
                                                        rentalTransactionCount={getLinkedTransactionStatements(clientProgressKey, 'rental').length}
                                                    />
                                                </td>
                                            </tr>

                                            {renderLaborStatementPanelRow(clientProgressKey)}
                                            {renderTransactionStatementPanelRow(clientProgressKey)}

                                            {isClientExpanded && (
                                                <>
                                                    {isExternalClient ? (
                                                        responsibleTeamGroups.map((teamGroup) => {
                                                            const isTeamExpanded = expandedResponsibleTeamKeys.has(teamGroup.key);
                                                            const teamAllocationMetrics = getSitesAllocationMetrics(teamGroup.sites);
                                                            const teamBillingMetrics = getSitesBillingMetrics(teamGroup.sites);
                                                            const teamSsukkumi = teamAllocationMetrics.settlementAmount > 0 && teamGroup.totalManDay > 0
                                                                ? Math.round(teamAllocationMetrics.settlementAmount / teamGroup.totalManDay)
                                                                : 0;
                                                            const teamStatementTarget: SupportStatementTarget = {
                                                                title: teamGroup.team.name,
                                                                subtitle: `${EXTERNAL_CLIENT_GROUP_DISPLAY_NAME} · 현장담당팀`,
                                                                rows: teamGroup.rows,
                                                                expenseClaims: getSitesExpenseClaims(teamGroup.sites),
                                                                billingRateBySiteKey: getBillingRateBySiteKey(teamGroup.sites),
                                                                billingRateByRowId: getBillingRateByRowId(teamGroup.rows)
                                                            };
                                                            const teamProgressKey = getResponsibleTeamNoteKey(client.key, teamGroup.key);
                                                            const teamProgressOption = getSupportProgressOption(progressStatuses[teamProgressKey]);

                                                            return (
                                                                <React.Fragment key={teamGroup.key}>
                                                                    <tr
                                                                        onClick={() => toggleResponsibleTeam(teamGroup.key)}
                                                                        className={`cursor-pointer transition-colors ${teamProgressOption ? '' : 'bg-emerald-50 hover:bg-emerald-100'}`}
                                                                        style={teamProgressOption ? { backgroundColor: teamProgressOption.rowColor } : undefined}
                                                                    >
                                                                        <td className="border border-slate-900 px-2 py-2 pl-4 font-black text-slate-900">
                                                                            <div className="flex min-w-0 items-center gap-2.5">
                                                                                <AccordionChevron expanded={isTeamExpanded} className="text-sm text-emerald-700" />
                                                                                <span className="shrink-0 rounded bg-emerald-700 px-2 py-1 text-[12px] font-black text-white">2단</span>
                                                                                <ResponsibleTeamChips teams={[teamGroup.team]} size="lg" />
                                                                            </div>
                                                                        </td>
                                                                        <td className="border border-slate-900 px-2 py-2 text-center font-mono font-black">{formatManDay(teamGroup.totalManDay)}</td>
                                                                        <td className="border border-slate-900 px-2 py-2 text-right font-mono">{teamGroup.avgUnitPrice > 0 ? formatNumber(teamGroup.avgUnitPrice) : '-'}</td>
                                                                        <td className="border border-slate-900 px-2 py-2 text-right font-mono font-black">{formatNumber(teamGroup.totalAmount)}</td>
                                                                        {showAllocationColumns && (
                                                                            <>
                                                                                <td className="border border-slate-900 bg-emerald-50 px-2 py-2 text-right font-mono font-black text-emerald-800">{teamBillingMetrics.billingUnitPrice > 0 ? formatNumber(teamBillingMetrics.billingUnitPrice) : '-'}</td>
                                                                        <td className="border border-slate-900 bg-emerald-50 px-2 py-2 text-right font-mono font-black text-emerald-900">{teamBillingMetrics.billingAmount > 0 ? formatNumber(teamBillingMetrics.billingAmount) : '-'}</td>
                                                                            </>
                                                                        )}
                                                                        <td className="border border-slate-900 bg-yellow-50 px-2 py-2 text-right font-mono font-black text-amber-900">{teamAllocationMetrics.issuedAmount > 0 ? formatNumber(teamAllocationMetrics.issuedAmount) : '-'}</td>
                                                                        <td className="border border-slate-900 bg-amber-100 px-2 py-2 text-right font-mono font-black text-amber-950">{teamAllocationMetrics.settlementAmount > 0 ? formatNumber(teamAllocationMetrics.settlementAmount) : '-'}</td>
                                                                        {showAllocationColumns && (
                                                                            <>
                                                                        <td className="border border-slate-900 px-2 py-2 text-right font-mono font-black">{teamAllocationMetrics.distributableAmount > 0 ? formatNumber(teamAllocationMetrics.distributableAmount) : '-'}</td>
                                                                        <td className="border border-slate-900 px-2 py-2 text-right font-mono font-black text-indigo-700">{teamAllocationMetrics.allocatedAmount > 0 ? formatNumber(teamAllocationMetrics.allocatedAmount) : '-'}</td>
                                                                        <td className={`border border-slate-900 px-2 py-2 text-right font-mono font-black ${teamAllocationMetrics.isOverAllocated ? 'text-rose-700' : 'text-amber-800'}`}>{teamAllocationMetrics.distributableAmount > 0 || teamAllocationMetrics.allocatedAmount > 0 ? formatNumber(teamAllocationMetrics.unallocatedAmount) : '-'}</td>
                                                                            </>
                                                                        )}
                                                                        <td className="border border-slate-900 px-2 py-2 text-right font-mono font-black text-amber-800">{teamSsukkumi > 0 ? formatNumber(teamSsukkumi) : '-'}</td>
                                                                        {renderProgressCell(teamProgressKey, teamGroup.team.name)}
                                                                        {renderNoteCell(teamProgressKey, teamGroup.team.name)}
                                                                        <td className="border border-slate-900 px-1 py-1 text-center" onClick={(event) => event.stopPropagation()}>
                                                                            <StatementActionButtons
                                                                                target={teamStatementTarget}
                                                                                onOpenLabor={(target) => toggleLaborStatementPanel(teamProgressKey, target)}
                                                                                onOpenTransaction={(target) => toggleTransactionStatementPanel(teamProgressKey, target, 'standard')}
                                                                                onOpenRentalTransaction={(target) => toggleTransactionStatementPanel(teamProgressKey, target, 'rental')}
                                                                                onOpenExpense={setExpenseStatementTarget}
                                                                                laborOpen={isLaborStatementPanelOpen(teamProgressKey)}
                                                                                transactionOpen={isTransactionStatementPanelOpen(teamProgressKey, 'standard')}
                                                                                rentalTransactionOpen={isTransactionStatementPanelOpen(teamProgressKey, 'rental')}
                                                                                transactionCount={getLinkedTransactionStatements(teamProgressKey, 'standard').length}
                                                                                rentalTransactionCount={getLinkedTransactionStatements(teamProgressKey, 'rental').length}
                                                                            />
                                                                        </td>
                                                                    </tr>
                                                                    {renderLaborStatementPanelRow(teamProgressKey)}
                                                                    {renderTransactionStatementPanelRow(teamProgressKey)}
                                                                    {isTeamExpanded && teamGroup.sites.map((site) => renderSiteRows(site, 'pl-9', '3단'))}
                                                                </React.Fragment>
                                                            );
                                                        })
                                                    ) : (
                                                        client.sites.map((site) => renderSiteRows(site, 'pl-9', '3단'))
                                                    )}
                                                </>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </main>
            </div>
            {expenseStatementTarget && (
                <SupportClientExpenseStatementModal
                    target={expenseStatementTarget}
                    yearMonth={selectedMonth}
                    onClose={() => setExpenseStatementTarget(null)}
                />
            )}
            {allocationModalTarget && (
                <SupportClientAllocationModal
                    target={allocationModalTarget}
                    settlementTargets={settlementTargets}
                    companies={companies}
                    saving={allocationSaving}
                    onClose={() => setAllocationModalTarget(null)}
                    onSave={saveAllocationLines}
                />
            )}
        </div>
    );
};

export default SupportClientSitePage;
