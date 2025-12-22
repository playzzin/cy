import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCalendarDay, faCalendarDays, faDownload, faFileExcel, faHandshake, faSearch, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { dailyReportService } from '../../services/dailyReportService';
import { manpowerService, Worker } from '../../services/manpowerService';
import { teamService, Team } from '../../services/teamService';
import { companyService, Company } from '../../services/companyService';
import { advancePaymentService, AdvancePayment } from '../../services/advancePaymentService';
import { payrollConfigService, PayrollConfig } from '../../services/payrollConfigService';
import { toast } from '../../utils/swal';
import * as XLSX from 'xlsx-js-style';
import { BANK_CODES } from './team-payment/types';
import { calculatePayrollDeductions } from '../../utils/payrollCalculator';

type CompanyWithId = Company & { id: string };
type TeamWithId = Team & { id: string };
type WorkerWithId = Worker & { id: string };

type CompanyTypeFilter = 'all' | 'construction' | 'partner';

const CONSTRUCTION_TEAM_TYPES = new Set<string>(['본팀', '관리팀', '새끼팀', '직영팀', '시공팀']);

const KB_MAX_DEPOSIT_DISPLAY_LENGTH = 10;
const KB_MAX_WITHDRAW_DISPLAY_LENGTH = 14;

type AdvanceDeductionLine = {
    id: string;
    label: string;
    amount: number;
};

interface TransferRow {
    rowKey: string;
    teamId: string;
    teamName: string;
    workerId: string;
    workerName: string;
    salaryModel: string;
    totalManDay: number;
    unitPrice: number;
    totalAmount: number;
    amountByYearMonth: Record<string, number>;
    companyId: string;
    companyName: string;
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
}

const TeamBasedPaymentDraftPageV2: React.FC = () => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const formatDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const [startDate, setStartDate] = useState(formatDate(firstDay));
    const [endDate, setEndDate] = useState(formatDate(lastDay));
    const navigate = useNavigate();

    const [selectedType, setSelectedType] = useState<string>('');
    const [companyTypeFilter, setCompanyTypeFilter] = useState<CompanyTypeFilter>('all');

    const [selectedTeamId, setSelectedTeamId] = useState<string>('');
    const [selectedWorkerId, setSelectedWorkerId] = useState<string>('');
    const [workerSearchQuery, setWorkerSearchQuery] = useState<string>('');

    const [teams, setTeams] = useState<TeamWithId[]>([]);
    const [allTeams, setAllTeams] = useState<Team[]>([]);
    const [workers, setWorkers] = useState<WorkerWithId[]>([]);
    const [companies, setCompanies] = useState<CompanyWithId[]>([]);
    const [companiesLoaded, setCompaniesLoaded] = useState(false);

    const [loading, setLoading] = useState(false);
    const [paymentData, setPaymentData] = useState<TransferRow[]>([]);

    const [payrollConfig, setPayrollConfig] = useState<PayrollConfig | null>(null);
    const [advancePaymentsByTeamWorkerYearMonth, setAdvancePaymentsByTeamWorkerYearMonth] = useState<Map<string, AdvancePayment>>(new Map());
    const [advancePaymentsByWorkerYearMonth, setAdvancePaymentsByWorkerYearMonth] = useState<Map<string, AdvancePayment>>(new Map());

    const [showAccountInfo, setShowAccountInfo] = useState<boolean>(true);
    const [revealedAccounts, setRevealedAccounts] = useState<Set<string>>(new Set());

    const [showKBPreview, setShowKBPreview] = useState<boolean>(false);
    const [kbReceiverDisplay, setKbReceiverDisplay] = useState<string>('㈜다원');
    const [kbMemoSuffix, setKbMemoSuffix] = useState<string>('');
    const [kbMemoMap, setKbMemoMap] = useState<Map<string, string>>(new Map());

    const [showPayslipPreview, setShowPayslipPreview] = useState<boolean>(false);
    const [selectedPayslipRowKey, setSelectedPayslipRowKey] = useState<string>('');
    const [selectedPayslipYearMonth, setSelectedPayslipYearMonth] = useState<string>('');
    const [payslipSearchQuery, setPayslipSearchQuery] = useState<string>('');

    const normalizeValue = useCallback((value: string | undefined): string => {
        return (value ?? '').replace(/\s+/g, '').trim();
    }, []);

    const normalizeTeamName = useCallback((value: string): string => {
        return value.replace(/\(.*?\)/g, '').replace(/\s+/g, '').trim();
    }, []);

    const normalizeCompanyName = useCallback((value: string | undefined): string => {
        return (value ?? '').replace(/\(.*?\)/g, '').replace(/\s+/g, '').trim();
    }, []);

    const normalizeCompanyType = useCallback((value: string | undefined): string => {
        return (value ?? '').replace(/\s+/g, '').trim();
    }, []);

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const configPromise = payrollConfigService.getConfigFromServer().catch(() => payrollConfigService.getConfig());
                const [fetchedTeams, fetchedWorkers, fetchedCompanies, config] = await Promise.all([
                    teamService.getTeams(),
                    manpowerService.getWorkers(),
                    companyService.getCompanies(),
                    configPromise
                ]);

                setPayrollConfig(config);
                setAllTeams(fetchedTeams);

                const nextTeams: TeamWithId[] = fetchedTeams
                    .filter((t): t is TeamWithId => typeof t.id === 'string' && t.id.trim().length > 0)
                    .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'ko'));
                setTeams(nextTeams);

                const nextWorkers: WorkerWithId[] = fetchedWorkers
                    .filter((w): w is WorkerWithId => typeof w.id === 'string' && w.id.trim().length > 0)
                    .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'ko'));
                setWorkers(nextWorkers);

                const nextCompanies: CompanyWithId[] = fetchedCompanies
                    .filter((c): c is CompanyWithId => typeof c.id === 'string' && c.id.trim().length > 0)
                    .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'ko'));
                setCompanies(nextCompanies);
            } catch (error) {
                console.error(error);
                toast.error('기초 데이터를 불러오는데 실패했습니다.');
            } finally {
                setCompaniesLoaded(true);
            }
        };

        void fetchInitialData();
    }, []);

    const yearMonthsInRange = useMemo(() => {
        const start = startDate.trim();
        const end = endDate.trim();
        if (start.length < 7 || end.length < 7) return [] as string[];

        const startYm = start.slice(0, 7);
        const endYm = end.slice(0, 7);

        const [syStr, smStr] = startYm.split('-');
        const [eyStr, emStr] = endYm.split('-');
        const sy = Number(syStr);
        const sm = Number(smStr);
        const ey = Number(eyStr);
        const em = Number(emStr);
        if (![sy, sm, ey, em].every((n) => Number.isFinite(n))) return [] as string[];

        const result: string[] = [];
        let y = sy;
        let m = sm;
        while (y < ey || (y === ey && m <= em)) {
            result.push(`${String(y)}-${String(m).padStart(2, '0')}`);
            m += 1;
            if (m > 12) {
                m = 1;
                y += 1;
            }
            if (result.length > 24) break;
        }
        return result;
    }, [endDate, startDate]);

    useEffect(() => {
        if (yearMonthsInRange.length === 0) {
            setAdvancePaymentsByTeamWorkerYearMonth(new Map());
            setAdvancePaymentsByWorkerYearMonth(new Map());
            return;
        }

        const visibleMonthlyRows = paymentData.filter((row) => normalizeValue(row.salaryModel) === '월급제');
        const visibleWorkerIds = new Set<string>(visibleMonthlyRows.map((row) => row.workerId).filter(Boolean));
        if (visibleWorkerIds.size === 0) {
            setAdvancePaymentsByTeamWorkerYearMonth(new Map());
            setAdvancePaymentsByWorkerYearMonth(new Map());
            return;
        }

        const preferredTeamIdByWorkerYearMonth = new Map<string, string>();
        visibleMonthlyRows.forEach((row) => {
            const teamId = (row.teamId ?? '').trim();
            if (!row.workerId || !teamId) return;
            Object.keys(row.amountByYearMonth ?? {}).forEach((ym) => {
                const key = `${row.workerId}_${ym}`;
                if (!preferredTeamIdByWorkerYearMonth.has(key)) preferredTeamIdByWorkerYearMonth.set(key, teamId);
            });
        });

        let isCancelled = false;
        const fetchAdvances = async () => {
            try {
                const perMonth = await Promise.all(
                    yearMonthsInRange.map(async (ym) => {
                        const [yStr, mStr] = ym.split('-');
                        const y = Number(yStr);
                        const m = Number(mStr);
                        if (!Number.isFinite(y) || !Number.isFinite(m)) return [] as AdvancePayment[];
                        return advancePaymentService.getAdvancePaymentsByYearMonth(y, m);
                    })
                );

                const advances = perMonth.flat().filter((item) => visibleWorkerIds.has(item.workerId));

                const exactMap = new Map<string, AdvancePayment>();
                const fallbackMap = new Map<string, AdvancePayment>();

                const pickLatest = (prev: AdvancePayment, next: AdvancePayment): AdvancePayment => {
                    const prevUpdated = prev.updatedAt?.getTime() ?? 0;
                    const nextUpdated = next.updatedAt?.getTime() ?? 0;
                    return nextUpdated > prevUpdated ? next : prev;
                };

                advances.forEach((item) => {
                    const ym = (item.yearMonth ?? '').trim();
                    if (!ym) return;

                    const teamId = (item.teamId ?? '').trim();
                    if (teamId) {
                        const exactKey = `${teamId}_${item.workerId}_${ym}`;
                        const prevExact = exactMap.get(exactKey);
                        exactMap.set(exactKey, prevExact ? pickLatest(prevExact, item) : item);
                    }

                    const fallbackKey = `${item.workerId}_${ym}`;
                    const prevFallback = fallbackMap.get(fallbackKey);
                    if (!prevFallback) {
                        fallbackMap.set(fallbackKey, item);
                        return;
                    }

                    const preferredTeamId = preferredTeamIdByWorkerYearMonth.get(fallbackKey) ?? '';
                    const prevScore = preferredTeamId && (prevFallback.teamId ?? '') === preferredTeamId ? 2 : 1;
                    const nextScore = preferredTeamId && (item.teamId ?? '') === preferredTeamId ? 2 : 1;
                    if (nextScore > prevScore) {
                        fallbackMap.set(fallbackKey, item);
                        return;
                    }
                    if (nextScore < prevScore) return;

                    fallbackMap.set(fallbackKey, pickLatest(prevFallback, item));
                });

                if (!isCancelled) {
                    setAdvancePaymentsByTeamWorkerYearMonth(exactMap);
                    setAdvancePaymentsByWorkerYearMonth(fallbackMap);
                }
            } catch {
                if (!isCancelled) {
                    setAdvancePaymentsByTeamWorkerYearMonth(new Map());
                    setAdvancePaymentsByWorkerYearMonth(new Map());
                }
            }
        };

        void fetchAdvances();
        return () => {
            isCancelled = true;
        };
    }, [normalizeValue, paymentData, yearMonthsInRange]);

    const teamById = useMemo(() => {
        const map = new Map<string, Team>();
        allTeams.forEach((team) => {
            if (team.id) map.set(team.id, team);
        });
        return map;
    }, [allTeams]);

    const companyIdByNameNormalized = useMemo(() => {
        const map = new Map<string, string>();
        companies.forEach((company) => {
            const key = normalizeCompanyName(company.name);
            if (!key) return;
            if (!map.has(key)) map.set(key, company.id);
        });
        return map;
    }, [companies, normalizeCompanyName]);

    const effectiveCompanyTypeFilter = useMemo<CompanyTypeFilter>(() => {
        const selected = normalizeValue(selectedType);
        if (selected === '일급제' || selected === '월급제') return 'construction';
        if (selected === '지원팀') return 'partner';
        return companyTypeFilter;
    }, [companyTypeFilter, normalizeValue, selectedType]);

    const isCompanyFilterLocked = useMemo(() => {
        const selected = normalizeValue(selectedType);
        return selected === '일급제' || selected === '월급제' || selected === '지원팀';
    }, [normalizeValue, selectedType]);

    const allowedCompanyIds = useMemo(() => {
        const ids = new Set<string>();
        if (!companiesLoaded) return ids;

        companies.forEach((company) => {
            const type = normalizeCompanyType(company.type);
            if (effectiveCompanyTypeFilter === 'construction') {
                if (type !== '시공사') return;
                ids.add(company.id);
                return;
            }
            if (effectiveCompanyTypeFilter === 'partner') {
                if (type !== '협력사') return;
                ids.add(company.id);
                return;
            }
            ids.add(company.id);
        });

        return ids;
    }, [companies, companiesLoaded, effectiveCompanyTypeFilter, normalizeCompanyType]);

    const teamScope = useMemo(() => {
        const allowedTeamIds = new Set<string>();
        const allowedTeamNameNormalized = new Set<string>();

        if (!selectedTeamId) {
            return { allowedTeamIds, allowedTeamNameNormalized };
        }

        const selectedTeamName = teams.find((t) => t.id === selectedTeamId)?.name ?? '';
        const selectedTeamNameNormalized = normalizeTeamName(selectedTeamName);

        allowedTeamIds.add(selectedTeamId);

        allTeams.forEach((team) => {
            if (!team.id) return;
            if (team.parentTeamId === selectedTeamId) {
                allowedTeamIds.add(team.id);
                return;
            }
            if (selectedTeamNameNormalized) {
                const parentNameNormalized = normalizeTeamName(team.parentTeamName ?? '');
                if (parentNameNormalized && parentNameNormalized === selectedTeamNameNormalized) {
                    allowedTeamIds.add(team.id);
                }
            }
        });

        allTeams.forEach((team) => {
            if (!team.id) return;
            if (!allowedTeamIds.has(team.id)) return;
            const normalized = normalizeTeamName(team.name ?? '');
            if (normalized) allowedTeamNameNormalized.add(normalized);
        });

        return { allowedTeamIds, allowedTeamNameNormalized };
    }, [allTeams, normalizeTeamName, selectedTeamId, teams]);

    const teamSelectOptions = useMemo(() => {
        const selected = normalizeValue(selectedType);

        return teams.filter((team) => {
            const companyId = (team.companyId ?? '').trim();
            const teamType = normalizeValue(team.type);

            if (effectiveCompanyTypeFilter !== 'all') {
                if (!companyId) return false;
                if (!allowedCompanyIds.has(companyId)) return false;
            }

            if (effectiveCompanyTypeFilter === 'construction') {
                if (teamType && !CONSTRUCTION_TEAM_TYPES.has(teamType)) return false;
            }

            if (effectiveCompanyTypeFilter === 'partner') {
                if (teamType !== '지원팀') return false;
            }

            if (!selected) return true;
            if (selected === '지원팀') return teamType === '지원팀';
            return true;
        });
    }, [allowedCompanyIds, effectiveCompanyTypeFilter, normalizeValue, selectedType, teams]);

    const workerSelectOptions = useMemo(() => {
        const query = workerSearchQuery.trim().toLowerCase();
        const selected = normalizeValue(selectedType);

        let filtered = workers;

        if (selectedTeamId) {
            filtered = filtered.filter((worker) => {
                const teamId = (worker.teamId ?? '').trim();
                if (teamId && teamScope.allowedTeamIds.has(teamId)) return true;

                const workerTeamNameNormalized = normalizeTeamName(worker.teamName ?? '');
                return workerTeamNameNormalized && teamScope.allowedTeamNameNormalized.has(workerTeamNameNormalized);
            });
        }

        filtered = filtered.filter((worker) => {
            const companyId = (worker.companyId ?? '').trim();
            const workerTeamType = normalizeValue(worker.teamType);
            const workerSalaryModel = normalizeValue(worker.salaryModel ?? worker.payType);

            if (effectiveCompanyTypeFilter !== 'all') {
                if (!companyId) return false;
                if (!allowedCompanyIds.has(companyId)) return false;
            }

            if (effectiveCompanyTypeFilter === 'construction') {
                if (workerTeamType && !CONSTRUCTION_TEAM_TYPES.has(workerTeamType)) return false;
            }

            if (effectiveCompanyTypeFilter === 'partner') {
                if (workerTeamType !== '지원팀' && workerSalaryModel !== '지원팀') return false;
            }

            if (!selected) return true;
            if (selected === '지원팀') return workerSalaryModel === '지원팀' || workerTeamType === '지원팀';
            return workerSalaryModel === selected;
        });

        if (query) {
            filtered = filtered.filter((worker) => (worker.name ?? '').toLowerCase().includes(query));
        }

        const teamNameById = new Map<string, string>();
        allTeams.forEach((team) => {
            if (!team.id) return;
            teamNameById.set(team.id, team.name ?? '');
        });

        return filtered
            .map((worker) => {
                const teamName = worker.teamName ?? teamNameById.get(worker.teamId ?? '') ?? '';
                return { workerId: worker.id, workerName: worker.name ?? '', teamName };
            })
            .sort((a, b) => `${a.workerName}_${a.teamName}`.localeCompare(`${b.workerName}_${b.teamName}`, 'ko'));
    }, [allTeams, allowedCompanyIds, effectiveCompanyTypeFilter, normalizeTeamName, normalizeValue, selectedTeamId, selectedType, teamScope.allowedTeamIds, teamScope.allowedTeamNameNormalized, workerSearchQuery, workers]);

    useEffect(() => {
        if (!selectedWorkerId) return;
        const exists = workerSelectOptions.some((opt) => opt.workerId === selectedWorkerId);
        if (!exists) setSelectedWorkerId('');
    }, [selectedWorkerId, workerSelectOptions]);

    useEffect(() => {
        if (!selectedTeamId) return;
        const exists = teamSelectOptions.some((team) => team.id === selectedTeamId);
        if (!exists) setSelectedTeamId('');
    }, [selectedTeamId, teamSelectOptions]);

    const maskedAccountNumber = useCallback((value: string): string => {
        const digits = value.replace(/\s+/g, '').trim();
        if (!digits) return '';
        if (digits.length <= 4) return '*'.repeat(digits.length);
        return `${'*'.repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
    }, []);

    const truncateToMaxLength = useCallback((value: string, maxLength: number): string => {
        if (!value) return '';
        const trimmed = value.trim();
        if (trimmed.length <= maxLength) return trimmed;
        return trimmed.slice(0, maxLength);
    }, []);

    const validateTransferRow = useCallback((params: {
        bankName: string;
        bankCode: string;
        accountNumber: string;
        accountHolder: string;
    }): { isValid: boolean; errors: TransferRow['errors'] } => {
        const errors: TransferRow['errors'] = {};
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

    const filteredPaymentData = useMemo(() => {
        let rows = paymentData;

        const selected = normalizeValue(selectedType);
        if (selected) {
            rows = rows.filter((row) => normalizeValue(row.salaryModel) === selected);
        }

        if (selectedWorkerId) {
            rows = rows.filter((row) => row.workerId === selectedWorkerId);
        }

        if (effectiveCompanyTypeFilter !== 'all' && companiesLoaded) {
            rows = rows.filter((row) => {
                const companyId = (row.companyId ?? '').trim() || (teamById.get(row.teamId)?.companyId ?? '').trim();
                if (!companyId) return false;
                return allowedCompanyIds.has(companyId);
            });
        }

        if (!selectedTeamId) return rows;

        return rows.filter((row) => {
            if (teamScope.allowedTeamIds.has(row.teamId)) return true;
            const normalized = normalizeTeamName(row.teamName ?? '');
            return normalized && teamScope.allowedTeamNameNormalized.has(normalized);
        });
    }, [
        allowedCompanyIds,
        companiesLoaded,
        effectiveCompanyTypeFilter,
        normalizeTeamName,
        normalizeValue,
        paymentData,
        selectedTeamId,
        selectedType,
        selectedWorkerId,
        teamById,
        teamScope.allowedTeamIds,
        teamScope.allowedTeamNameNormalized
    ]);

    const getAdvanceDeductionLines = useCallback((advanceData?: AdvancePayment): AdvanceDeductionLine[] => {
        const configItems = (payrollConfig?.deductionItems ?? [])
            .filter((item) => item.isActive)
            .slice()
            .sort((a, b) => a.order - b.order);

        const labelById = new Map<string, string>();
        configItems.forEach((item) => {
            labelById.set(item.id, item.label);
        });

        const getAmount = (id: string): number => {
            if (!advanceData) return 0;
            const record = advanceData as unknown as Record<string, unknown>;
            const direct = record[id];
            if (typeof direct === 'number' && Number.isFinite(direct)) return direct;
            const fromItems = advanceData.items?.[id];
            if (typeof fromItems === 'number' && Number.isFinite(fromItems)) return fromItems;
            return 0;
        };

        const lines = configItems.map((item) => ({
            id: item.id,
            label: labelById.get(item.id) ?? item.id,
            amount: getAmount(item.id)
        }));

        const computedTotal = lines.reduce((sum, line) => sum + (line.amount || 0), 0);
        const storedTotal = advanceData?.totalDeduction ?? 0;
        const missing = storedTotal > computedTotal ? storedTotal - computedTotal : 0;
        if (missing > 0) {
            lines.push({ id: '__unmapped_totalDeduction', label: '기타 공제', amount: missing });
        }

        return lines;
    }, [payrollConfig?.deductionItems]);

    const getAdvanceDeductionTotal = useCallback((advanceData?: AdvancePayment): number => {
        const lines = getAdvanceDeductionLines(advanceData);
        return lines.reduce((sum, line) => sum + (line.amount || 0), 0);
    }, [getAdvanceDeductionLines]);

    const getMonthlyNetPaySummary = useCallback((row: TransferRow): { totalDeduction: number; netPay: number } => {
        const isMonthly = normalizeValue(row.salaryModel) === '월급제';
        if (!isMonthly) {
            return { totalDeduction: 0, netPay: row.totalAmount };
        }

        const monthEntries = Object.entries(row.amountByYearMonth ?? {});
        if (monthEntries.length === 0) {
            return { totalDeduction: 0, netPay: row.totalAmount };
        }

        let totalDeduction = 0;
        let netPay = 0;

        monthEntries.forEach(([ym, grossPay]) => {
            if (!ym) return;
            const exactKey = `${(row.teamId ?? '').trim()}_${row.workerId}_${ym}`;
            const fallbackKey = `${row.workerId}_${ym}`;
            const advanceData = advancePaymentsByTeamWorkerYearMonth.get(exactKey) ?? advancePaymentsByWorkerYearMonth.get(fallbackKey);

            const advanceDeduction = getAdvanceDeductionTotal(advanceData);
            const result = calculatePayrollDeductions({
                grossPay,
                insuranceConfig: payrollConfig?.insuranceConfig,
                taxRate: payrollConfig?.taxRate,
                advanceDeduction
            });
            totalDeduction += result.totalDeduction;
            netPay += result.netPay;
        });

        return { totalDeduction, netPay };
    }, [
        advancePaymentsByTeamWorkerYearMonth,
        advancePaymentsByWorkerYearMonth,
        getAdvanceDeductionTotal,
        normalizeValue,
        payrollConfig?.insuranceConfig,
        payrollConfig?.taxRate
    ]);

    type KbPreviewRow = {
        rowKey: string;
        workerName: string;
        bankCode: string;
        accountNumber: string;
        transferAmount: number;
        depositDisplay: string;
        withdrawDisplay: string;
        isValid: boolean;
    };

    const getKbTransferAmount = useCallback((row: TransferRow): number => {
        const isMonthly = normalizeValue(row.salaryModel) === '월급제';
        if (!isMonthly) return row.totalAmount;
        return getMonthlyNetPaySummary(row).netPay;
    }, [getMonthlyNetPaySummary, normalizeValue]);

    const monthlyRowsForPayslip = useMemo(() => {
        return filteredPaymentData.filter((row) => normalizeValue(row.salaryModel) === '월급제');
    }, [filteredPaymentData, normalizeValue]);

    const selectedPayslipRow = useMemo(() => {
        if (!selectedPayslipRowKey) return null;
        return monthlyRowsForPayslip.find((row) => row.rowKey === selectedPayslipRowKey) ?? null;
    }, [monthlyRowsForPayslip, selectedPayslipRowKey]);

    const payslipYearMonthOptions = useMemo(() => {
        if (!selectedPayslipRow) return [] as string[];
        return Object.keys(selectedPayslipRow.amountByYearMonth ?? {}).sort((a, b) => a.localeCompare(b, 'en'));
    }, [selectedPayslipRow]);

    useEffect(() => {
        if (!showPayslipPreview) return;
        if (monthlyRowsForPayslip.length === 0) return;

        if (!selectedPayslipRowKey) {
            setSelectedPayslipRowKey(monthlyRowsForPayslip[0].rowKey);
        }
    }, [monthlyRowsForPayslip, selectedPayslipRowKey, showPayslipPreview]);

    useEffect(() => {
        if (!showPayslipPreview) return;
        if (!selectedPayslipRow) return;

        if (selectedPayslipYearMonth && selectedPayslipRow.amountByYearMonth[selectedPayslipYearMonth] !== undefined) return;

        const startYm = startDate.trim().slice(0, 7);
        if (startYm && selectedPayslipRow.amountByYearMonth[startYm] !== undefined) {
            setSelectedPayslipYearMonth(startYm);
            return;
        }

        const options = Object.keys(selectedPayslipRow.amountByYearMonth ?? {}).sort((a, b) => a.localeCompare(b, 'en'));
        setSelectedPayslipYearMonth(options[0] ?? '');
    }, [selectedPayslipRow, selectedPayslipYearMonth, showPayslipPreview, startDate]);

    const selectedPayslipComputed = useMemo(() => {
        if (!selectedPayslipRow) return null;
        if (!selectedPayslipYearMonth) return null;
        if (!payrollConfig) return null;

        const grossPay = selectedPayslipRow.amountByYearMonth[selectedPayslipYearMonth] ?? 0;
        const exactKey = `${(selectedPayslipRow.teamId ?? '').trim()}_${selectedPayslipRow.workerId}_${selectedPayslipYearMonth}`;
        const fallbackKey = `${selectedPayslipRow.workerId}_${selectedPayslipYearMonth}`;
        const advanceData = advancePaymentsByTeamWorkerYearMonth.get(exactKey) ?? advancePaymentsByWorkerYearMonth.get(fallbackKey);

        const advanceLines = getAdvanceDeductionLines(advanceData);
        const advanceDeduction = getAdvanceDeductionTotal(advanceData);

        const result = calculatePayrollDeductions({
            grossPay,
            insuranceConfig: payrollConfig.insuranceConfig,
            taxRate: payrollConfig.taxRate,
            advanceDeduction
        });

        return {
            grossPay,
            advanceLines,
            result
        };
    }, [
        advancePaymentsByTeamWorkerYearMonth,
        advancePaymentsByWorkerYearMonth,
        getAdvanceDeductionLines,
        getAdvanceDeductionTotal,
        payrollConfig,
        selectedPayslipRow,
        selectedPayslipYearMonth
    ]);

    const kbPreviewRows = useMemo((): KbPreviewRow[] => {
        const depositDisplay = truncateToMaxLength(kbReceiverDisplay ?? '', KB_MAX_DEPOSIT_DISPLAY_LENGTH);
        return filteredPaymentData.map((row) => {
            const transferAmount = getKbTransferAmount(row);
            const defaultWithdrawDisplay = `${row.workerName}${kbMemoSuffix ?? ''}`;
            const withdrawDisplayRaw = kbMemoMap.get(row.rowKey) ?? defaultWithdrawDisplay;
            const withdrawDisplay = truncateToMaxLength(withdrawDisplayRaw, KB_MAX_WITHDRAW_DISPLAY_LENGTH);

            return {
                rowKey: row.rowKey,
                workerName: row.workerName,
                bankCode: row.bankCode,
                accountNumber: row.accountNumber,
                transferAmount,
                depositDisplay,
                withdrawDisplay,
                isValid: row.isValid
            };
        });
    }, [filteredPaymentData, getKbTransferAmount, kbMemoMap, kbMemoSuffix, kbReceiverDisplay, truncateToMaxLength]);

    const handleIssueTaxInvoice = useCallback((row: TransferRow) => {
        const isMonthly = normalizeValue(row.salaryModel) === '월급제';
        const netPay = isMonthly ? getMonthlyNetPaySummary(row).netPay : row.totalAmount;

        const prefillData = {
            companyId: row.companyId,
            companyName: row.companyName || row.teamName.replace(' 지원팀', ''),
            ceoName: row.accountHolder,
            businessNumber: '', // 알 수 없음 (DB에서 가져와야 함)
            amount: netPay,
            itemName: `${row.teamName} ${startDate}~${endDate} 기성 청구`,
        };

        navigate('/tax-invoice', { state: { prefillData } });
    }, [endDate, getMonthlyNetPaySummary, navigate, normalizeValue, startDate]);

    const handleDownloadPayslipExcel = useCallback(() => {
        if (!selectedPayslipRow) {
            toast.error('작업자를 선택해 주세요.');
            return;
        }

        if (!selectedPayslipYearMonth) {
            toast.error('월을 선택해 주세요.');
            return;
        }

        if (!selectedPayslipComputed) {
            toast.error('노임명세서 데이터를 계산할 수 없습니다.');
            return;
        }

        const headerStyle = {
            fill: { fgColor: { rgb: 'E2E8F0' }, patternType: 'solid' },
            font: { name: '맑은 고딕', sz: 10, bold: true },
            alignment: { horizontal: 'left' as const, vertical: 'center' as const },
            border: {
                top: { style: 'thin' as const, color: { rgb: '000000' } },
                bottom: { style: 'thin' as const, color: { rgb: '000000' } },
                left: { style: 'thin' as const, color: { rgb: '000000' } },
                right: { style: 'thin' as const, color: { rgb: '000000' } }
            }
        };

        const baseStyle = {
            font: { name: '맑은 고딕', sz: 10 },
            alignment: { horizontal: 'left' as const, vertical: 'center' as const },
            border: {
                top: { style: 'thin' as const, color: { rgb: '000000' } },
                bottom: { style: 'thin' as const, color: { rgb: '000000' } },
                left: { style: 'thin' as const, color: { rgb: '000000' } },
                right: { style: 'thin' as const, color: { rgb: '000000' } }
            }
        };

        const numberStyle = {
            ...baseStyle,
            alignment: { horizontal: 'right' as const, vertical: 'center' as const },
            numFmt: '#,##0'
        };

        const summaryHeaderRowIndex = 0;

        const summaryRows: (string | number)[][] = [
            ['항목', '값'],
            ['이름', selectedPayslipRow.workerName],
            ['팀', selectedPayslipRow.teamName],
            ['월', selectedPayslipYearMonth],
            ['총급여(gross)', selectedPayslipComputed.grossPay],
            ['국민연금', selectedPayslipComputed.result.pension],
            ['건강보험', selectedPayslipComputed.result.health],
            ['장기요양', selectedPayslipComputed.result.care],
            ['고용보험', selectedPayslipComputed.result.employment],
            ['세금(3.3%)', selectedPayslipComputed.result.incomeTax],
            ['가불/기타공제', selectedPayslipComputed.result.advanceDeduction],
            ['총 공제', selectedPayslipComputed.result.totalDeduction],
            ['실지급액(net)', selectedPayslipComputed.result.netPay],
            ['', ''],
            ['공제 상세', '금액'],
            ...selectedPayslipComputed.advanceLines.map((line) => [line.label, line.amount || 0])
        ];

        const detailHeaderRowIndex = summaryRows.findIndex((row) => row[0] === '공제 상세');

        const ws = XLSX.utils.aoa_to_sheet(summaryRows);
        ws['!cols'] = [{ wch: 22 }, { wch: 20 }];

        const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
        for (let R = range.s.r; R <= range.e.r; R++) {
            for (let C = range.s.c; C <= range.e.c; C++) {
                const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
                const cell = ws[cellAddress] as (XLSX.CellObject & { s?: unknown }) | undefined;
                if (!cell) continue;

                const isHeader = R === summaryHeaderRowIndex || (detailHeaderRowIndex >= 0 && R === detailHeaderRowIndex);
                if (isHeader) {
                    cell.s = headerStyle;
                    continue;
                }

                if (typeof cell.v === 'number') {
                    cell.s = numberStyle;
                    continue;
                }

                cell.s = baseStyle;
            }
        }

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, '노임명세서');
        const safeName = (selectedPayslipRow.workerName || 'worker').replace(/[\\/:*?"<>|]/g, '_');
        const fileName = `노임명세서_${safeName}_${selectedPayslipYearMonth}.xlsx`;
        XLSX.writeFile(wb, fileName);
    }, [selectedPayslipComputed, selectedPayslipRow, selectedPayslipYearMonth]);

    const handleDownloadKBExcel = useCallback(() => {
        if (kbPreviewRows.length === 0) {
            toast.error('출력할 데이터가 없습니다.');
            return;
        }

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

        const greenHeaderStyle = {
            ...greenStyle,
            font: { name: '맑은 고딕', sz: 10, bold: true }
        };

        const greenNumberStyle = {
            ...greenStyle,
            alignment: { horizontal: 'right' as const, vertical: 'center' as const },
            numFmt: '#,##0'
        };

        const rawData: (string | number)[][] = [
            ['은행코드', '계좌번호', '이체금액', '입금통장표시', '출금통장표시'],
            ...kbPreviewRows.map((item) => [
                item.bankCode,
                item.accountNumber,
                item.transferAmount,
                item.depositDisplay,
                item.withdrawDisplay
            ])
        ];

        const ws = XLSX.utils.aoa_to_sheet(rawData);
        const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
        for (let R = range.s.r; R <= range.e.r; R++) {
            for (let C = range.s.c; C <= range.e.c; C++) {
                const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
                const cell = ws[cellAddress] as (XLSX.CellObject & { s?: unknown }) | undefined;
                if (!cell) continue;

                if (R === 0) {
                    cell.s = greenHeaderStyle;
                    continue;
                }

                if (C === 2) {
                    cell.s = greenNumberStyle;
                    cell.t = 'n';
                    continue;
                }

                cell.s = greenStyle;
            }
        }

        ws['!cols'] = [{ wch: 8 }, { wch: 20 }, { wch: 15 }, { wch: 12 }, { wch: 16 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, '국민은행용');
        const fileName = `팀별입금_국민은행용_${startDate}_${endDate}.xlsx`;
        XLSX.writeFile(wb, fileName);
    }, [endDate, kbPreviewRows, startDate]);

    const fetchData = useCallback(async () => {
        setLoading(true);

        try {
            const reports = await dailyReportService.getReportsByRange(startDate, endDate);
            const reportsSorted = [...reports].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '', 'en'));

            const resolveExplicitSalaryModel = (raw: string | undefined): string => {
                const normalized = normalizeValue(raw);
                if (!normalized) return '';

                if (normalized === '월급제' || normalized === '월급') return '월급제';
                if (normalized === '일급제' || normalized === '일급' || normalized === '일당') return '일급제';
                if (normalized === '지원팀' || normalized === '지원') return '지원팀';
                if (normalized === '용역팀' || normalized === '용역') return '용역팀';

                return '';
            };

            const workerById = new Map<string, WorkerWithId>();
            workers.forEach((worker) => {
                workerById.set(worker.id, worker);
            });

            const lastSalaryModelByWorkerYearMonth = new Map<string, string>();

            const supportTeams = allTeams.filter((team) => normalizeValue(team.type) === '지원팀');
            const supportTeamByCompanyId = new Map<string, Team>();
            const supportTeamByCompanyNameNormalized = new Map<string, Team>();

            supportTeams.forEach((team) => {
                const companyIdRaw = (team.companyId ?? '').trim();
                const companyNameRaw = (team.companyName ?? '').trim();
                const companyNameNormalized = normalizeCompanyName(companyNameRaw);
                const companyIdByName = companyNameNormalized ? (companyIdByNameNormalized.get(companyNameNormalized) ?? '') : '';
                const companyId = companyIdRaw || companyIdByName;

                if (companyId) supportTeamByCompanyId.set(companyId, team);
                if (companyNameNormalized && !supportTeamByCompanyNameNormalized.has(companyNameNormalized)) {
                    supportTeamByCompanyNameNormalized.set(companyNameNormalized, team);
                }
            });

            const workerByName = new Map<string, WorkerWithId>();
            workers.forEach((worker) => {
                workerByName.set(worker.name.trim(), worker);
            });

            const rowByKey = new Map<string, TransferRow>();

            reportsSorted.forEach((report) => {
                const reportYearMonth = typeof report.date === 'string' && report.date.length >= 7 ? report.date.slice(0, 7) : '';
                report.workers.forEach((reportWorker) => {
                    const workerId = reportWorker.workerId;
                    if (!workerId) return;

                    const worker = workerById.get(workerId);
                    if (!worker) return;

                    const monthKey = reportYearMonth ? `${workerId}_${reportYearMonth}` : workerId;
                    const explicitModel = resolveExplicitSalaryModel(reportWorker.salaryModel) || resolveExplicitSalaryModel(reportWorker.payType);

                    const resolvedSalaryModel = (() => {
                        if (explicitModel) {
                            lastSalaryModelByWorkerYearMonth.set(monthKey, explicitModel);
                            return explicitModel;
                        }

                        const prev = lastSalaryModelByWorkerYearMonth.get(monthKey);
                        if (prev) return prev;

                        const workerTeamType = resolveExplicitSalaryModel(worker.teamType);
                        if (workerTeamType === '지원팀') {
                            lastSalaryModelByWorkerYearMonth.set(monthKey, '지원팀');
                            return '지원팀';
                        }
                        if (workerTeamType === '용역팀') {
                            lastSalaryModelByWorkerYearMonth.set(monthKey, '용역팀');
                            return '용역팀';
                        }

                        lastSalaryModelByWorkerYearMonth.set(monthKey, '일급제');
                        return '일급제';
                    })();

                    const manDay = typeof reportWorker.manDay === 'number' && Number.isFinite(reportWorker.manDay) ? reportWorker.manDay : 0;

                    const unitPrice =
                        typeof reportWorker.unitPrice === 'number' && Number.isFinite(reportWorker.unitPrice)
                            ? reportWorker.unitPrice
                            : (typeof worker.unitPrice === 'number' && Number.isFinite(worker.unitPrice) ? worker.unitPrice : 0);

                    const isSupport = normalizeValue(resolvedSalaryModel) === '지원팀' || normalizeValue(worker.teamType) === '지원팀';

                    if (isSupport) {
                        const companyIdRaw = (worker.companyId ?? report.companyId ?? '').trim();
                        const companyNameRaw = (worker.companyName ?? report.companyName ?? '').trim();
                        const companyNameNormalized = normalizeCompanyName(companyNameRaw);
                        const companyIdResolved = companyIdRaw || (companyNameNormalized ? (companyIdByNameNormalized.get(companyNameNormalized) ?? '') : '');

                        const supportTeam =
                            (companyIdResolved ? supportTeamByCompanyId.get(companyIdResolved) : undefined) ??
                            (companyNameNormalized ? supportTeamByCompanyNameNormalized.get(companyNameNormalized) : undefined);

                        if (supportTeam) {
                            const supportTeamId = supportTeam.id ?? `support_${companyIdResolved || companyNameRaw}`;
                            const supportRate = typeof supportTeam.supportRate === 'number' && Number.isFinite(supportTeam.supportRate) ? supportTeam.supportRate : 0;
                            const supportModel = supportTeam.supportModel ?? 'man_day';

                            const leaderIdRaw = (supportTeam.leaderId ?? '').trim();
                            const leaderId = leaderIdRaw && leaderIdRaw !== '0' ? leaderIdRaw : '';
                            const leaderWorker =
                                (leaderId ? workerById.get(leaderId) : undefined) ??
                                (supportTeam.leaderName ? workerByName.get(supportTeam.leaderName.trim()) : undefined);

                            const recipientWorkerId = leaderWorker?.id ?? leaderId;
                            const recipientWorkerName = leaderWorker?.name ?? supportTeam.leaderName ?? `${companyNameRaw || '지원팀'} 팀장`;

                            const bankName = leaderWorker?.bankName ?? '';
                            const bankCode = bankName ? (BANK_CODES[bankName.trim()] ?? '') : '';
                            const accountNumber = leaderWorker?.accountNumber ?? '';
                            const accountHolder = leaderWorker?.accountHolder ?? recipientWorkerName;

                            const validation = validateTransferRow({ bankName, bankCode, accountNumber, accountHolder });

                            const rowKey = `지원팀_${supportTeamId}_${companyIdResolved || companyNameRaw}_${recipientWorkerId || recipientWorkerName}`;
                            const existing = rowByKey.get(rowKey);

                            const nextAmount = supportModel === 'fixed' ? supportRate : Math.round(manDay * supportRate);

                            if (existing) {
                                existing.totalManDay += manDay;
                                existing.totalAmount = supportModel === 'fixed' ? supportRate : existing.totalAmount + nextAmount;
                                if (reportYearMonth) {
                                    existing.amountByYearMonth[reportYearMonth] = supportModel === 'fixed'
                                        ? supportRate
                                        : (existing.amountByYearMonth[reportYearMonth] ?? 0) + nextAmount;
                                }
                                return;
                            }

                            rowByKey.set(rowKey, {
                                rowKey,
                                teamId: supportTeamId,
                                teamName: supportTeam.name ?? `${companyNameRaw || '지원팀'} 지원팀`,
                                workerId: recipientWorkerId || '',
                                workerName: recipientWorkerName,
                                salaryModel: '지원팀',
                                totalManDay: manDay,
                                unitPrice: supportRate,
                                totalAmount: supportModel === 'fixed' ? supportRate : nextAmount,
                                amountByYearMonth: reportYearMonth ? { [reportYearMonth]: supportModel === 'fixed' ? supportRate : nextAmount } : {},
                                companyId: companyIdResolved,
                                companyName: companyNameRaw,
                                bankName,
                                bankCode,
                                accountNumber,
                                accountHolder,
                                isValid: validation.isValid,
                                errors: validation.errors
                            });

                            return;
                        }
                    }

                    const teamId = (reportWorker.teamId ?? worker.teamId ?? report.teamId ?? '').trim();
                    const teamName = (report.teamName ?? worker.teamName ?? '').trim();
                    const companyId = (worker.companyId ?? report.companyId ?? '').trim();
                    const companyName = (worker.companyName ?? report.companyName ?? '').trim();

                    const bankName = worker.bankName ?? '';
                    const bankCode = bankName ? (BANK_CODES[bankName.trim()] ?? '') : '';
                    const accountNumber = worker.accountNumber ?? '';
                    const accountHolder = worker.accountHolder ?? worker.name ?? '';
                    const validation = validateTransferRow({ bankName, bankCode, accountNumber, accountHolder });

                    const rowKey = `${normalizeValue(resolvedSalaryModel)}_${teamId}_${workerId}`;
                    const existing = rowByKey.get(rowKey);
                    const grossPay = Math.round(manDay * unitPrice);
                    if (existing) {
                        existing.totalManDay += manDay;
                        existing.totalAmount += grossPay;
                        if (reportYearMonth) {
                            existing.amountByYearMonth[reportYearMonth] = (existing.amountByYearMonth[reportYearMonth] ?? 0) + grossPay;
                        }
                        return;
                    }

                    rowByKey.set(rowKey, {
                        rowKey,
                        teamId,
                        teamName,
                        workerId,
                        workerName: reportWorker.name ?? worker.name ?? '',
                        salaryModel: resolvedSalaryModel,
                        totalManDay: manDay,
                        unitPrice,
                        totalAmount: grossPay,
                        amountByYearMonth: reportYearMonth ? { [reportYearMonth]: grossPay } : {},
                        companyId,
                        companyName,
                        bankName,
                        bankCode,
                        accountNumber,
                        accountHolder: accountHolder,
                        isValid: validation.isValid,
                        errors: validation.errors
                    });
                });
            });

            const nextRows = Array.from(rowByKey.values()).sort((a, b) => {
                const left = `${a.teamName}_${a.workerName}`;
                const right = `${b.teamName}_${b.workerName}`;
                return left.localeCompare(right, 'ko');
            });

            setPaymentData(nextRows);
        } catch (error) {
            console.error(error);
            toast.error('데이터 조회에 실패했습니다.');
        } finally {
            setLoading(false);
        }
    }, [allTeams, companyIdByNameNormalized, endDate, normalizeCompanyName, normalizeValue, startDate, validateTransferRow, workers]);

    const lockCompanyFilterLabel = useMemo(() => {
        const selected = normalizeValue(selectedType);
        if (selected === '일급제' || selected === '월급제') return '시공사 고정';
        if (selected === '지원팀') return '협력사 고정';
        return '';
    }, [normalizeValue, selectedType]);

    return (
        <div className="flex flex-col h-full bg-gradient-to-br from-slate-50 to-blue-50 p-4 sm:p-6 gap-4 sm:gap-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-800">📋 팀별 입금 리스트 (V2)</h1>
                    <p className="text-sm text-slate-500 mt-1">인원전체내역 기반으로 재작성 중 (1차)</p>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                <div className="flex flex-col gap-4">
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-2">급여방식</label>
                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => setSelectedType('')}
                                className={`px-3 py-1 rounded text-xs font-bold border ${selectedType === '' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}
                            >
                                전체
                            </button>
                            <button
                                type="button"
                                onClick={() => setSelectedType('일급제')}
                                className={`px-3 py-1 rounded text-xs font-bold border ${selectedType === '일급제' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}
                            >
                                <FontAwesomeIcon icon={faCalendarDay} className="mr-1" />
                                일급
                            </button>
                            <button
                                type="button"
                                onClick={() => setSelectedType('월급제')}
                                className={`px-3 py-1 rounded text-xs font-bold border ${selectedType === '월급제' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}
                            >
                                <FontAwesomeIcon icon={faCalendarDays} className="mr-1" />
                                월급
                            </button>
                            <button
                                type="button"
                                onClick={() => setSelectedType('지원팀')}
                                className={`px-3 py-1 rounded text-xs font-bold border ${selectedType === '지원팀' ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}
                            >
                                <FontAwesomeIcon icon={faHandshake} className="mr-1" />
                                지원
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2 items-center">
                        <button
                            type="button"
                            onClick={() => setCompanyTypeFilter('all')}
                            disabled={isCompanyFilterLocked}
                            className={`px-3 py-1 rounded text-xs font-bold border ${effectiveCompanyTypeFilter === 'all' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'} ${isCompanyFilterLocked ? 'opacity-40 cursor-not-allowed' : ''}`}
                        >
                            전체
                        </button>
                        <button
                            type="button"
                            onClick={() => setCompanyTypeFilter('construction')}
                            disabled={isCompanyFilterLocked}
                            className={`px-3 py-1 rounded text-xs font-bold border ${effectiveCompanyTypeFilter === 'construction' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'} ${isCompanyFilterLocked ? 'opacity-40 cursor-not-allowed' : ''}`}
                        >
                            시공팀
                        </button>
                        <button
                            type="button"
                            onClick={() => setCompanyTypeFilter('partner')}
                            disabled={isCompanyFilterLocked}
                            className={`px-3 py-1 rounded text-xs font-bold border ${effectiveCompanyTypeFilter === 'partner' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'} ${isCompanyFilterLocked ? 'opacity-40 cursor-not-allowed' : ''}`}
                        >
                            협력사
                        </button>
                        {lockCompanyFilterLabel && <span className="text-xs text-slate-400">({lockCompanyFilterLabel})</span>}
                    </div>

                    <div className="flex flex-wrap gap-4 items-end">
                        <div className="flex-1 min-w-[150px]">
                            <label className="block text-xs font-semibold text-slate-600 mb-1">시작일</label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            />
                        </div>
                        <div className="flex-1 min-w-[150px]">
                            <label className="block text-xs font-semibold text-slate-600 mb-1">종료일</label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            />
                        </div>
                        <div className="flex-1 min-w-[160px]">
                            <label className="block text-xs font-semibold text-slate-600 mb-1">팀</label>
                            <select
                                value={selectedTeamId}
                                onChange={(e) => setSelectedTeamId(e.target.value)}
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            >
                                <option value="">전체</option>
                                {teamSelectOptions.map((team) => (
                                    <option key={team.id} value={team.id}>
                                        {team.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="flex-1 min-w-[200px]">
                            <label className="block text-xs font-semibold text-slate-600 mb-1">작업자</label>
                            <input
                                value={workerSearchQuery}
                                onChange={(e) => setWorkerSearchQuery(e.target.value)}
                                placeholder="이름 검색"
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none mb-2"
                            />
                            <select
                                value={selectedWorkerId}
                                onChange={(e) => setSelectedWorkerId(e.target.value)}
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            >
                                <option value="">전체</option>
                                {workerSelectOptions.map((opt) => (
                                    <option key={opt.workerId} value={opt.workerId}>
                                        {opt.workerName}{opt.teamName ? ` (${opt.teamName})` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <button
                            type="button"
                            onClick={fetchData}
                            disabled={loading}
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold text-sm flex items-center gap-2 disabled:opacity-50"
                        >
                            {loading ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faSearch} />}
                            조회
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
                <div className="p-4 border-b border-slate-200 flex justify-between items-center">
                    <div className="text-sm font-semibold text-slate-600">
                        총 {filteredPaymentData.length.toLocaleString()}건
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => setShowAccountInfo((prev) => !prev)}
                            className="text-xs text-blue-600 underline"
                        >
                            {showAccountInfo ? '계좌정보 숨김' : '계좌정보 표시'}
                        </button>
                        {normalizeValue(selectedType) === '월급제' && (
                            <button
                                type="button"
                                onClick={() => {
                                    setPayslipSearchQuery('');
                                    setShowPayslipPreview(true);
                                }}
                                disabled={monthlyRowsForPayslip.length === 0}
                                className="px-3 py-1.5 text-xs bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-bold flex items-center gap-1 disabled:opacity-50"
                            >
                                노임명세서
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => setShowKBPreview(true)}
                            disabled={filteredPaymentData.length === 0}
                            className="px-3 py-1.5 text-xs bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-bold flex items-center gap-1 disabled:opacity-50"
                        >
                            <FontAwesomeIcon icon={faFileExcel} />
                            국민은행용
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-auto">
                    <table className="min-w-[1100px] w-full text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                            <tr className="text-slate-600 text-xs">
                                <th className="px-4 py-2 text-center w-12">No</th>
                                <th className="px-4 py-2">회사</th>
                                <th className="px-4 py-2">팀</th>
                                <th className="px-4 py-2">이름</th>
                                <th className="px-4 py-2">급여방식</th>
                                <th className="px-4 py-2 text-right">공수</th>
                                <th className="px-4 py-2 text-right">단가</th>
                                <th className="px-4 py-2 text-right">총금액</th>
                                <th className="px-4 py-2 text-right">공제액</th>
                                <th className="px-4 py-2 text-right">입금액</th>
                                {showAccountInfo && <th className="px-4 py-2">은행</th>}
                                {showAccountInfo && <th className="px-4 py-2">계좌번호</th>}
                                {showAccountInfo && <th className="px-4 py-2">예금주</th>}
                                <th className="px-4 py-2 w-24">관리</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredPaymentData.map((row, idx) => (
                                <tr key={row.rowKey} className="hover:bg-slate-50">
                                    <td className="px-4 py-3 text-center text-slate-400">{idx + 1}</td>
                                    <td className="px-4 py-3 text-slate-700">{row.companyName || '-'}</td>
                                    <td className="px-4 py-3 text-slate-700">{row.teamName || '-'}</td>
                                    <td className="px-4 py-3 font-semibold text-slate-800">{row.workerName || '-'}</td>
                                    <td className="px-4 py-3 text-slate-600">{row.salaryModel || '-'}</td>
                                    <td className="px-4 py-3 text-right font-mono text-slate-700">{row.totalManDay.toFixed(2)}</td>
                                    <td className="px-4 py-3 text-right font-mono text-slate-700">{row.unitPrice.toLocaleString()}</td>
                                    <td className="px-4 py-3 text-right font-mono font-bold text-blue-700">{row.totalAmount.toLocaleString()}</td>
                                    {(() => {
                                        const summary = getMonthlyNetPaySummary(row);
                                        const isMonthly = normalizeValue(row.salaryModel) === '월급제';
                                        const deduction = isMonthly ? summary.totalDeduction : 0;
                                        return (
                                            <>
                                                <td className="px-4 py-3 text-right font-mono text-slate-700">{deduction ? deduction.toLocaleString() : '-'}</td>
                                                <td className="px-4 py-3 text-right font-mono font-bold text-emerald-700">{summary.netPay.toLocaleString()}</td>
                                            </>
                                        );
                                    })()}
                                    {showAccountInfo && <td className="px-4 py-3 text-slate-600">{row.bankName || '-'}</td>}
                                    {showAccountInfo && (
                                        <td className="px-4 py-3 font-mono text-slate-600">
                                            <div className="flex items-center gap-2">
                                                <span>
                                                    {revealedAccounts.has(row.rowKey)
                                                        ? row.accountNumber || '-'
                                                        : maskedAccountNumber(row.accountNumber || '') || '-'}
                                                </span>
                                                {row.accountNumber && (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setRevealedAccounts((prev) => {
                                                                const next = new Set(prev);
                                                                if (next.has(row.rowKey)) next.delete(row.rowKey);
                                                                else next.add(row.rowKey);
                                                                return next;
                                                            })
                                                        }
                                                        className="text-[11px] text-blue-600 underline"
                                                    >
                                                        {revealedAccounts.has(row.rowKey) ? '숨김' : '보기'}
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    )}
                                    {showAccountInfo && <td className="px-4 py-3 text-slate-600">{row.accountHolder || '-'}</td>}
                                    <td className="px-4 py-3 text-center">
                                        <button
                                            type="button"
                                            onClick={() => handleIssueTaxInvoice(row)}
                                            className="px-2 py-1 text-xs bg-blue-100 text-blue-600 hover:bg-blue-200 rounded font-medium transition-colors"
                                        >
                                            세금계산서
                                        </button>
                                    </td>
                                </tr>
                            ))}

                            {!loading && filteredPaymentData.length === 0 && (
                                <tr>
                                    <td colSpan={showAccountInfo ? 14 : 11} className="px-4 py-16 text-center text-slate-400">
                                        조회 결과가 없습니다.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {showPayslipPreview && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[95vh] sm:h-auto sm:max-h-[85vh] flex flex-col">
                        <div className="p-3 sm:p-4 border-b border-slate-200 flex justify-between items-center bg-emerald-50">
                            <div className="flex flex-col gap-1">
                                <h3 className="text-base sm:text-lg font-bold text-slate-800">🧾 노임명세서 미리보기</h3>
                                <div className="text-xs text-slate-500">월급제만 지원 (월 선택 가능)</div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowPayslipPreview(false)}
                                className="text-slate-400 hover:text-slate-600 text-2xl"
                                aria-label="노임명세서 닫기"
                            >
                                ×
                            </button>
                        </div>

                        <div className="p-3 sm:p-4 border-b border-slate-200 flex flex-col sm:flex-row gap-3 sm:items-center">
                            <div className="flex-1">
                                <label className="block text-xs font-semibold text-slate-600 mb-1">작업자 검색</label>
                                <input
                                    value={payslipSearchQuery}
                                    onChange={(e) => setPayslipSearchQuery(e.target.value)}
                                    placeholder="이름 검색"
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                                />
                            </div>
                            <div className="flex-[2]">
                                <label className="block text-xs font-semibold text-slate-600 mb-1">작업자 선택</label>
                                <select
                                    value={selectedPayslipRowKey}
                                    onChange={(e) => setSelectedPayslipRowKey(e.target.value)}
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                                >
                                    {monthlyRowsForPayslip
                                        .filter((row) => {
                                            const q = payslipSearchQuery.trim().toLowerCase();
                                            if (!q) return true;
                                            return (row.workerName ?? '').toLowerCase().includes(q);
                                        })
                                        .map((row) => (
                                            <option key={row.rowKey} value={row.rowKey}>
                                                {row.workerName} ({row.teamName})
                                            </option>
                                        ))}
                                </select>
                            </div>
                            <div className="w-full sm:w-40">
                                <label className="block text-xs font-semibold text-slate-600 mb-1">월</label>
                                <select
                                    value={selectedPayslipYearMonth}
                                    onChange={(e) => setSelectedPayslipYearMonth(e.target.value)}
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                                    disabled={payslipYearMonthOptions.length === 0}
                                >
                                    {payslipYearMonthOptions.map((ym) => (
                                        <option key={ym} value={ym}>
                                            {ym}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="flex-1 overflow-auto p-3 sm:p-4">
                            {!payrollConfig && (
                                <div className="text-center text-slate-400 py-16">급여 설정(payrollConfig)을 불러오는 중입니다.</div>
                            )}

                            {payrollConfig && !selectedPayslipRow && (
                                <div className="text-center text-slate-400 py-16">작업자를 선택해 주세요.</div>
                            )}

                            {payrollConfig && selectedPayslipRow && !selectedPayslipYearMonth && (
                                <div className="text-center text-slate-400 py-16">월을 선택해 주세요.</div>
                            )}

                            {selectedPayslipComputed && selectedPayslipRow && (
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                    <div className="rounded-lg border border-slate-200 p-4">
                                        <div className="text-sm font-bold text-slate-800">기본 정보</div>
                                        <div className="mt-2 text-sm text-slate-700 space-y-1">
                                            <div>
                                                이름: <span className="font-semibold">{selectedPayslipRow.workerName}</span>
                                            </div>
                                            <div>
                                                팀: <span className="font-semibold">{selectedPayslipRow.teamName}</span>
                                            </div>
                                            <div>
                                                기간(월): <span className="font-mono font-semibold">{selectedPayslipYearMonth}</span>
                                            </div>
                                            <div>
                                                총급여(gross): <span className="font-mono font-bold">{selectedPayslipComputed.grossPay.toLocaleString()}</span>원
                                            </div>
                                            <div>
                                                은행/계좌: <span className="font-mono">{selectedPayslipRow.bankName || '-'}</span> / <span className="font-mono">{selectedPayslipRow.accountNumber || '-'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="rounded-lg border border-slate-200 p-4">
                                        <div className="text-sm font-bold text-slate-800">공제 및 실지급</div>
                                        <div className="mt-2 text-sm text-slate-700 space-y-1">
                                            <div>국민연금: <span className="font-mono">{selectedPayslipComputed.result.pension.toLocaleString()}</span>원</div>
                                            <div>건강보험: <span className="font-mono">{selectedPayslipComputed.result.health.toLocaleString()}</span>원</div>
                                            <div>장기요양: <span className="font-mono">{selectedPayslipComputed.result.care.toLocaleString()}</span>원</div>
                                            <div>고용보험: <span className="font-mono">{selectedPayslipComputed.result.employment.toLocaleString()}</span>원</div>
                                            <div className="pt-2 border-t border-slate-200">세금(3.3%): <span className="font-mono">{selectedPayslipComputed.result.incomeTax.toLocaleString()}</span>원</div>
                                            <div>가불/기타공제: <span className="font-mono">{selectedPayslipComputed.result.advanceDeduction.toLocaleString()}</span>원</div>
                                            <div className="pt-2 border-t border-slate-200 font-bold">총 공제: <span className="font-mono">{selectedPayslipComputed.result.totalDeduction.toLocaleString()}</span>원</div>
                                            <div className="font-bold text-emerald-700">실지급액(net): <span className="font-mono">{selectedPayslipComputed.result.netPay.toLocaleString()}</span>원</div>
                                        </div>
                                    </div>

                                    <div className="lg:col-span-2 rounded-lg border border-slate-200 p-4">
                                        <div className="text-sm font-bold text-slate-800 mb-2">공제 상세(advance_payments)</div>
                                        <div className="overflow-auto">
                                            <table className="w-full text-sm border-collapse">
                                                <thead className="bg-slate-50">
                                                    <tr>
                                                        <th className="border border-slate-200 px-3 py-2 text-left">항목</th>
                                                        <th className="border border-slate-200 px-3 py-2 text-right">금액</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {selectedPayslipComputed.advanceLines.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={2} className="border border-slate-200 px-3 py-6 text-center text-slate-400">
                                                                공제 항목이 없습니다.
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        selectedPayslipComputed.advanceLines.map((line) => (
                                                            <tr key={line.id}>
                                                                <td className="border border-slate-200 px-3 py-2">{line.label}</td>
                                                                <td className="border border-slate-200 px-3 py-2 text-right font-mono">{(line.amount || 0).toLocaleString()}</td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-3 sm:p-4 border-t border-slate-200 flex justify-end bg-emerald-50">
                            <button
                                type="button"
                                onClick={handleDownloadPayslipExcel}
                                disabled={!selectedPayslipComputed || !selectedPayslipRow || !selectedPayslipYearMonth}
                                className="px-4 py-2 mr-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-bold flex items-center gap-2 disabled:opacity-50"
                            >
                                <FontAwesomeIcon icon={faDownload} />
                                다운로드
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowPayslipPreview(false)}
                                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                            >
                                닫기
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showKBPreview && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[95vh] sm:h-auto sm:max-h-[80vh] flex flex-col">
                        <div className="p-3 sm:p-4 border-b border-slate-200 flex justify-between items-center bg-amber-50">
                            <div className="flex flex-col gap-1">
                                <h3 className="text-base sm:text-lg font-bold text-slate-800">🏦 국민은행용 엑셀 미리보기</h3>
                                <div className="text-xs text-slate-500">D {KB_MAX_DEPOSIT_DISPLAY_LENGTH}자 / E {KB_MAX_WITHDRAW_DISPLAY_LENGTH}자 제한</div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowKBPreview(false)}
                                className="text-slate-400 hover:text-slate-600 text-2xl"
                                aria-label="국민은행 미리보기 닫기"
                            >
                                ×
                            </button>
                        </div>

                        <div className="p-3 sm:p-4 border-b border-slate-200 flex flex-col sm:flex-row gap-3 sm:items-center">
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-500">입금통장표시(D)</span>
                                <input
                                    value={kbReceiverDisplay}
                                    onChange={(e) => setKbReceiverDisplay(truncateToMaxLength(e.target.value, KB_MAX_DEPOSIT_DISPLAY_LENGTH))}
                                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-40 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-500">출금통장표시 접미사</span>
                                <input
                                    value={kbMemoSuffix}
                                    onChange={(e) => setKbMemoSuffix(e.target.value)}
                                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-40 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                                    placeholder="예) 급여"
                                />
                            </div>
                            <div className="text-xs text-slate-400 sm:ml-auto">{kbPreviewRows.length.toLocaleString()}건</div>
                        </div>

                        <div className="flex-1 overflow-auto p-3 sm:p-4">
                            <table className="w-full text-sm border-collapse">
                                <thead className="bg-amber-100 sticky top-0">
                                    <tr>
                                        <th className="border border-slate-300 px-3 py-2 text-left font-bold">A. 은행코드</th>
                                        <th className="border border-slate-300 px-3 py-2 text-left font-bold">B. 계좌번호</th>
                                        <th className="border border-slate-300 px-3 py-2 text-right font-bold">C. 이체금액</th>
                                        <th className="border border-slate-300 px-3 py-2 text-left font-bold">D. 입금통장표시</th>
                                        <th className="border border-slate-300 px-3 py-2 text-left font-bold">E. 출금통장표시</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {kbPreviewRows.map((row) => (
                                        <tr key={row.rowKey} className={`hover:bg-amber-50 ${row.isValid ? '' : 'bg-amber-50/50'}`}>
                                            <td className="border border-slate-300 px-3 py-2">{row.bankCode}</td>
                                            <td className="border border-slate-300 px-3 py-2">{row.accountNumber}</td>
                                            <td className="border border-slate-300 px-3 py-2 text-right font-medium">{row.transferAmount.toLocaleString()}</td>
                                            <td className="border border-slate-300 px-3 py-2">
                                                <div className="flex items-center gap-2">
                                                    <span>{row.depositDisplay}</span>
                                                    <span className="text-xs text-slate-400">({row.depositDisplay.length}/{KB_MAX_DEPOSIT_DISPLAY_LENGTH})</span>
                                                </div>
                                            </td>
                                            <td className="border border-slate-300 px-3 py-2">
                                                <div className="flex items-center gap-2">
                                                    {(() => {
                                                        const baseWithdrawDisplay = truncateToMaxLength(`${row.workerName}${kbMemoSuffix ?? ''}`, KB_MAX_WITHDRAW_DISPLAY_LENGTH);
                                                        const overrideValue = kbMemoMap.get(row.rowKey);
                                                        const inputValue = overrideValue ?? baseWithdrawDisplay;
                                                        return (
                                                            <input
                                                                value={inputValue}
                                                                onChange={(e) => {
                                                                    const nextValue = truncateToMaxLength(e.target.value, KB_MAX_WITHDRAW_DISPLAY_LENGTH);
                                                                    setKbMemoMap((prev) => {
                                                                        const next = new Map(prev);
                                                                        if (!nextValue || nextValue === baseWithdrawDisplay) {
                                                                            next.delete(row.rowKey);
                                                                        } else {
                                                                            next.set(row.rowKey, nextValue);
                                                                        }
                                                                        return next;
                                                                    });
                                                                }}
                                                                className="border border-slate-300 rounded px-2 py-1 text-sm w-full min-w-[160px] focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                                                            />
                                                        );
                                                    })()}
                                                    <span className="text-xs text-slate-400">({row.withdrawDisplay.length}/{KB_MAX_WITHDRAW_DISPLAY_LENGTH})</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="p-3 sm:p-4 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-amber-50">
                            <div className="text-sm text-slate-600">
                                총 {kbPreviewRows.length.toLocaleString()}건 | 총 이체금액: {kbPreviewRows.reduce((sum, r) => sum + r.transferAmount, 0).toLocaleString()}원
                            </div>
                            <div className="flex gap-2 w-full sm:w-auto">
                                <button
                                    type="button"
                                    onClick={() => setShowKBPreview(false)}
                                    className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                                >
                                    닫기
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        handleDownloadKBExcel();
                                        setShowKBPreview(false);
                                    }}
                                    className="px-4 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-bold flex items-center gap-2"
                                >
                                    <FontAwesomeIcon icon={faDownload} />
                                    국민은행용 다운로드
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TeamBasedPaymentDraftPageV2;
