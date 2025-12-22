import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDownload, faExclamationTriangle, faSearch, faFileExcel, faSpinner, faInbox, faCalendarDay, faCalendarDays, faHandshake } from '@fortawesome/free-solid-svg-icons';
import { dailyReportService } from '../../services/dailyReportService';
import { manpowerService, Worker } from '../../services/manpowerService';
import { teamService, Team } from '../../services/teamService';
import { companyService, Company } from '../../services/companyService';
import { payrollConfigService, PayrollConfig } from '../../services/payrollConfigService';
import { advancePaymentService, AdvancePayment } from '../../services/advancePaymentService';
import { toast } from '../../utils/swal';
import { getIcon } from '../../utils/iconMapper';
import { calculatePayrollDeductions } from '../../utils/payrollCalculator';
import * as XLSX from 'xlsx-js-style';

const KB_MAX_DEPOSIT_DISPLAY_LENGTH = 10;
const KB_MAX_WITHDRAW_DISPLAY_LENGTH = 14;

const CONSTRUCTION_TEAM_TYPES = new Set<string>(['본팀', '관리팀', '새끼팀', '직영팀', '시공팀']);

const truncateToMaxLength = (value: string, maxLength: number): string => {
    if (typeof value !== 'string') return '';
    if (maxLength <= 0) return '';
    return value.length > maxLength ? value.slice(0, maxLength) : value;
};

const BASE_ADVANCE_DEDUCTION_ITEM_IDS = new Set<string>([
    'prevMonthCarryover',
    'accommodation',
    'privateRoom',
    'gloves',
    'deposit',
    'fines',
    'electricity',
    'gas',
    'internet',
    'water'
]);

const DEDUCTION_ID_TO_CANONICAL: Record<string, string> = {
    prevMonthCarryover: 'prevMonthCarryover',
    accommodation: 'accommodation',
    privateRoom: 'privateRoom',
    gloves: 'gloves',
    deposit: 'deposit',
    fines: 'fines',
    electricity: 'electricity',
    gas: 'gas',
    internet: 'internet',
    water: 'water',
    '전월이월': 'prevMonthCarryover',
    '숙소비': 'accommodation',
    '개인방': 'privateRoom',
    '장갑': 'gloves',
    '보증금': 'deposit',
    '과태료': 'fines',
    '전기료': 'electricity',
    '도시가스': 'gas',
    '인터넷': 'internet',
    '수도세': 'water'
};

const normalizeDeductionId = (rawId: string): string => {
    const trimmed = rawId.trim();
    return DEDUCTION_ID_TO_CANONICAL[trimmed] ?? trimmed;
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
    bankName: string;
    bankCode: string;
    accountNumber: string;
    accountHolder: string;
    displayContent: string;
    isValid: boolean;
    errors: {
        bankName?: boolean;
        bankCode?: boolean;
        accountNumber?: boolean;
        accountHolder?: boolean;
    };
}

type TeamWithId = Team & { id: string };
type WorkerWithId = Worker & { id: string };
type CompanyWithId = Company & { id: string };

const BANK_CODES: { [key: string]: string } = {
    '한국은행': '001',
    '산업은행': '002', '산업': '002', 'KDB': '002',
    '기업은행': '003', '기업': '003', 'IBK': '003',
    'KB국민은행': '004', '국민은행': '004', '국민': '004', 'KB': '004',
    '수협은행': '007', '수협': '007', 'Sh수협': '007',
    '수출입은행': '008',
    '농협은행': '011', '농협': '011', 'NH': '011', 'NH농협': '011',
    '농축협': '012', '지역농협': '012',
    '우리은행': '020', '우리': '020',
    'SC제일은행': '023', '제일은행': '023', 'SC': '023',
    '한국씨티은행': '027', '씨티': '027', '씨티은행': '027',
    '대구은행': '031', '대구': '031', 'iM뱅크': '031', 'DGB': '031',
    '부산은행': '032', '부산': '032', 'BNK부산': '032',
    '광주은행': '034', '광주': '034',
    '제주은행': '035', '제주': '035',
    '전북은행': '037', '전북': '037',
    '경남은행': '039', '경남': '039', 'BNK경남': '039',
    '새마을금고': '045', '새마을': '045', 'MG새마을': '045', 'MG': '045',
    '신협': '048', '신협중앙회': '048', '신용협동조합': '048',
    '상호저축은행': '050', '저축은행': '050',
    '우체국': '071', '우체국예금': '071',
    '하나은행': '081', '하나': '081', 'KEB하나': '081',
    '신한은행': '088', '신한': '088',
    '케이뱅크': '089', 'K뱅크': '089', '케이': '089',
    '카카오뱅크': '090', '카카오': '090', '카뱅': '090',
    '토스뱅크': '092', '토스': '092',
};

const TeamBasedPaymentDraftPage: React.FC = () => {
    // Date helpers
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const formatDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // State
    const [startDate, setStartDate] = useState(formatDate(firstDay));
    const [endDate, setEndDate] = useState(formatDate(lastDay));
    const [selectedTeamId, setSelectedTeamId] = useState<string>('');
    const [selectedWorkerId, setSelectedWorkerId] = useState<string>('');
    const [selectedType, setSelectedType] = useState<string>('');
    const [workerSearchQuery, setWorkerSearchQuery] = useState<string>('');
    const [paymentData, setPaymentData] = useState<TransferRow[]>([]);
    const [teams, setTeams] = useState<TeamWithId[]>([]);
    const [allTeams, setAllTeams] = useState<Team[]>([]);
    const [allWorkers, setAllWorkers] = useState<WorkerWithId[]>([]);
    const [companies, setCompanies] = useState<CompanyWithId[]>([]);
    const [companiesLoaded, setCompaniesLoaded] = useState<boolean>(false);
    const [loading, setLoading] = useState(false);
    const [bulkDisplayContent, setBulkDisplayContent] = useState<string>('급여');
    const [errorCount, setErrorCount] = useState<number>(0);
    const [showAccountInfo, setShowAccountInfo] = useState<boolean>(true);
    const [showKBPreview, setShowKBPreview] = useState<boolean>(false); // 국민은행용 미리보기
    const [showBankCodes, setShowBankCodes] = useState<boolean>(false); // 은행코드표
    const [showPayslipPreview, setShowPayslipPreview] = useState<boolean>(false); // 노임명세서 미리보기
    const [selectedPayslipWorker, setSelectedPayslipWorker] = useState<TransferRow | null>(null); // 선택된 작업자
    const [payslipSearchQuery, setPayslipSearchQuery] = useState<string>(''); // 작업자 검색어
    const [payrollConfig, setPayrollConfig] = useState<PayrollConfig | null>(null); // 4대보험/세금 요율
    const [advancePaymentsMap, setAdvancePaymentsMap] = useState<Map<string, AdvancePayment>>(new Map()); // 작업자별 가불/공제 정보
    const [revealedAccounts, setRevealedAccounts] = useState<Set<string>>(new Set()); // 마스킹 해제된 계좌번호 ID

    // 국민은행용 편집 필드
    const [kbReceiverDisplay, setKbReceiverDisplay] = useState<string>('㈜다원'); // 기본 받는분통장표시
    const [kbMemoSuffix, setKbMemoSuffix] = useState<string>(''); // 내통장메모 접미사 (기본: 이름 뒤에 붙음)
    const [kbMemoMap, setKbMemoMap] = useState<Map<string, string>>(new Map()); // 작업자별 개별 메모

    const normalizeTeamName = useCallback((value: string): string => {
        return value
            .replace(/\(.*?\)/g, '')
            .replace(/\s+/g, '')
            .trim();
    }, []);

    useEffect(() => {
        fetchInitialData();
    }, []);

    const normalizeCompanyType = useCallback((value: string | undefined): string => {
        return (value ?? '').replace(/\s+/g, '').trim();
    }, []);

    const normalizeCompanyName = useCallback((value: string | undefined): string => {
        return (value ?? '')
            .replace(/\(.*?\)/g, '')
            .replace(/\s+/g, '')
            .trim();
    }, []);

    const companyIdByNameNormalized = useMemo(() => {
        const map = new Map<string, string>();
        companies.forEach((company) => {
            const key = normalizeCompanyName(company.name);
            if (!key) return;
            if (!map.has(key)) map.set(key, company.id);
        });
        return map;
    }, [companies, normalizeCompanyName]);

    const constructionCompanyIds = useMemo(() => {
        const ids = new Set<string>();
        companies.forEach((company) => {
            if (normalizeCompanyType(company.type) !== '시공사') return;
            ids.add(company.id);
        });
        return ids;
    }, [companies, normalizeCompanyType]);

    const partnerCompanyIds = useMemo(() => {
        const ids = new Set<string>();
        companies.forEach((company) => {
            if (normalizeCompanyType(company.type) !== '협력사') return;
            ids.add(company.id);
        });
        return ids;
    }, [companies, normalizeCompanyType]);

    const companyTypeById = useMemo(() => {
        const map = new Map<string, string>();
        companies.forEach((company) => {
            map.set(company.id, normalizeCompanyType(company.type));
        });
        return map;
    }, [companies, normalizeCompanyType]);

    const supportTeamCompanyIdById = useMemo(() => {
        const normalizeValue = (value: string | undefined): string => {
            return (value ?? '').replace(/\s+/g, '').trim();
        };

        const map = new Map<string, string>();
        allTeams.forEach((team) => {
            if (normalizeValue(team.type) !== '지원팀') return;

            const companyIdRaw = (team.companyId ?? '').trim();
            const companyName = (team.companyName ?? '').trim();
            const companyIdByName = companyName ? (companyIdByNameNormalized.get(normalizeCompanyName(companyName)) ?? '') : '';
            const companyId = companyIdRaw || companyIdByName;
            const key = (team.id ?? '').trim() || `support_${companyId || companyName}`;
            if (!key) return;

            map.set(key, companyId);
        });
        return map;
    }, [allTeams, companyIdByNameNormalized, normalizeCompanyName]);

    type SupportCompanyIssueReason = 'missing_company' | 'company_not_found' | 'wrong_company_type';
    type SupportCompanyIssue = {
        teamKey: string;
        teamName: string;
        companyId: string;
        companyType: string;
        reason: SupportCompanyIssueReason;
    };

    const supportCompanyIssues = useMemo<SupportCompanyIssue[]>(() => {
        if (!companiesLoaded) return [];

        const normalizeValue = (value: string | undefined): string => {
            return (value ?? '').replace(/\s+/g, '').trim();
        };

        const issues: SupportCompanyIssue[] = [];
        allTeams.forEach((team) => {
            if (normalizeValue(team.type) !== '지원팀') return;

            const companyId = (team.companyId ?? '').trim();
            const companyName = (team.companyName ?? '').trim();
            const teamKey = (team.id ?? '').trim() || `support_${companyId || companyName}`;
            const teamName = (team.name ?? '').trim();

            if (!teamKey) return;

            if (!companyId) {
                issues.push({ teamKey, teamName, companyId: '', companyType: '', reason: 'missing_company' });
                return;
            }

            const companyType = (companyTypeById.get(companyId) ?? '').trim();
            if (!companyType) {
                issues.push({ teamKey, teamName, companyId, companyType: '', reason: 'company_not_found' });
                return;
            }

            if (companyType !== '협력사') {
                issues.push({ teamKey, teamName, companyId, companyType, reason: 'wrong_company_type' });
            }
        });

        return issues.sort((a, b) => `${a.teamName}_${a.teamKey}`.localeCompare(`${b.teamName}_${b.teamKey}`, 'ko'));
    }, [allTeams, companiesLoaded, companyTypeById]);

    type SupportRowIssueReason = 'missing_company_mapping' | 'company_not_partner';
    type SupportRowIssue = {
        rowKey: string;
        teamId: string;
        teamName: string;
        workerName: string;
        companyId: string;
        companyType: string;
        reason: SupportRowIssueReason;
    };

    const supportRowIssues = useMemo<SupportRowIssue[]>(() => {
        if (!companiesLoaded) return [];
        if (paymentData.length === 0) return [];

        const teamCompanyIdById = new Map<string, string>();
        const teamCompanyIdByNameNormalized = new Map<string, string>();
        allTeams.forEach((team) => {
            if (team.id) teamCompanyIdById.set(team.id, (team.companyId ?? '').trim());
            const key = normalizeTeamName(team.name ?? '');
            if (key && !teamCompanyIdByNameNormalized.has(key)) {
                teamCompanyIdByNameNormalized.set(key, (team.companyId ?? '').trim());
            }
        });

        const workerCompanyIdById = new Map<string, string>();
        allWorkers.forEach((worker) => {
            workerCompanyIdById.set(worker.id, (worker.companyId ?? '').trim());
        });

        const resolveCompanyId = (row: TransferRow): string => {
            const directTeamCompanyId = (teamCompanyIdById.get(row.teamId) ?? '').trim();
            if (directTeamCompanyId) return directTeamCompanyId;

            const teamNameNormalized = normalizeTeamName(row.teamName ?? '');
            const teamNameCompanyId = (teamNameNormalized ? (teamCompanyIdByNameNormalized.get(teamNameNormalized) ?? '') : '').trim();
            if (teamNameCompanyId) return teamNameCompanyId;

            const workerCompanyId = (workerCompanyIdById.get(row.workerId) ?? '').trim();
            if (workerCompanyId) return workerCompanyId;

            return (supportTeamCompanyIdById.get(row.teamId) ?? '').trim();
        };

        const issues: SupportRowIssue[] = [];
        paymentData
            .filter((row) => row.salaryModel === '지원팀')
            .forEach((row) => {
                const companyId = resolveCompanyId(row);
                if (!companyId) {
                    issues.push({
                        rowKey: row.rowKey,
                        teamId: row.teamId,
                        teamName: row.teamName,
                        workerName: row.workerName,
                        companyId: '',
                        companyType: '',
                        reason: 'missing_company_mapping'
                    });
                    return;
                }

                const companyType = (companyTypeById.get(companyId) ?? '').trim();
                if (companyType !== '협력사') {
                    issues.push({
                        rowKey: row.rowKey,
                        teamId: row.teamId,
                        teamName: row.teamName,
                        workerName: row.workerName,
                        companyId,
                        companyType,
                        reason: 'company_not_partner'
                    });
                }
            });

        return issues.sort((a, b) => `${a.teamName}_${a.workerName}`.localeCompare(`${b.teamName}_${b.workerName}`, 'ko'));
    }, [allTeams, allWorkers, companiesLoaded, companyTypeById, normalizeTeamName, paymentData, supportTeamCompanyIdById]);

    const supportIssueBuckets = useMemo(() => {
        const missingCompanyTeams = supportCompanyIssues.filter((item) => item.reason === 'missing_company');
        const companyNotFoundTeams = supportCompanyIssues.filter((item) => item.reason === 'company_not_found');
        const wrongCompanyTypeTeams = supportCompanyIssues.filter((item) => item.reason === 'wrong_company_type');

        const missingCompanyMappingRows = supportRowIssues.filter((item) => item.reason === 'missing_company_mapping');
        const companyNotPartnerRows = supportRowIssues.filter((item) => item.reason === 'company_not_partner');

        const totalCount =
            missingCompanyTeams.length +
            companyNotFoundTeams.length +
            wrongCompanyTypeTeams.length +
            missingCompanyMappingRows.length +
            companyNotPartnerRows.length;

        return {
            missingCompanyTeams,
            companyNotFoundTeams,
            wrongCompanyTypeTeams,
            missingCompanyMappingRows,
            companyNotPartnerRows,
            totalCount
        };
    }, [supportCompanyIssues, supportRowIssues]);

    useEffect(() => {
        if (!showPayslipPreview) return;

        let isCancelled = false;
        const refreshConfig = async () => {
            try {
                const latest = await payrollConfigService.getConfigFromServer();
                if (!isCancelled) setPayrollConfig(latest);
            } catch {
                try {
                    const fallback = await payrollConfigService.getConfig();
                    if (!isCancelled) setPayrollConfig(fallback);
                } catch {
                }
            }
        };

        void refreshConfig();
        return () => {
            isCancelled = true;
        };
    }, [showPayslipPreview]);

    useEffect(() => {
        if (!showPayslipPreview) return;

        const [yearStr, monthStr] = startDate.split('-');
        const year = Number(yearStr);
        const month = Number(monthStr);
        if (!Number.isFinite(year) || !Number.isFinite(month)) return;

        const buildVisibleMonthlyRows = (): TransferRow[] => {
            let rows = paymentData.filter((row) => row.salaryModel === '월급제');

            if (selectedWorkerId) {
                rows = rows.filter((row) => row.workerId === selectedWorkerId);
            }

            if (!selectedTeamId) return rows;

            const selectedTeamName = teams.find((t) => t.id === selectedTeamId)?.name ?? '';
            const selectedTeamNameNormalized = normalizeTeamName(selectedTeamName);

            const allowedTeamIds = new Set<string>();
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

            const allowedTeamNameNormalized = new Set<string>();
            allTeams.forEach((team) => {
                if (!team.id) return;
                if (!allowedTeamIds.has(team.id)) return;
                const normalized = normalizeTeamName(team.name ?? '');
                if (normalized) allowedTeamNameNormalized.add(normalized);
            });

            return rows.filter((row) => {
                if (allowedTeamIds.has(row.teamId)) return true;
                const normalized = normalizeTeamName(row.teamName ?? '');
                return normalized && allowedTeamNameNormalized.has(normalized);
            });
        };

        const visibleMonthlyRows = buildVisibleMonthlyRows();
        const preferredTeamIdByWorkerId = new Map<string, string>();
        visibleMonthlyRows.forEach((row) => {
            if (!row.workerId) return;
            const existing = preferredTeamIdByWorkerId.get(row.workerId) ?? '';
            if (existing) return;
            const teamId = (row.teamId ?? '').trim();
            if (teamId) preferredTeamIdByWorkerId.set(row.workerId, teamId);
        });

        const visibleWorkerIds = new Set<string>(visibleMonthlyRows.map((row) => row.workerId).filter(Boolean));

        let isCancelled = false;
        const fetchAdvances = async () => {
            if (visibleWorkerIds.size === 0) {
                if (!isCancelled) setAdvancePaymentsMap(new Map());
                return;
            }

            try {
                const advances = await advancePaymentService.getAdvancePaymentsByYearMonth(year, month);
                const nextMap = new Map<string, AdvancePayment>();

                const getScore = (item: AdvancePayment): number => {
                    const preferredTeamId = preferredTeamIdByWorkerId.get(item.workerId) ?? '';
                    if (preferredTeamId && item.teamId === preferredTeamId) return 2;
                    return 1;
                };

                advances
                    .filter((item) => visibleWorkerIds.has(item.workerId))
                    .forEach((item) => {
                        const prev = nextMap.get(item.workerId);
                        if (!prev) {
                            nextMap.set(item.workerId, item);
                            return;
                        }

                        const prevScore = getScore(prev);
                        const nextScore = getScore(item);
                        if (nextScore > prevScore) {
                            nextMap.set(item.workerId, item);
                            return;
                        }

                        if (nextScore < prevScore) return;

                        const prevUpdated = prev.updatedAt?.getTime() ?? 0;
                        const nextUpdated = item.updatedAt?.getTime() ?? 0;
                        if (nextUpdated > prevUpdated) {
                            nextMap.set(item.workerId, item);
                        }
                    });

                if (!isCancelled) setAdvancePaymentsMap(nextMap);
            } catch {
                if (!isCancelled) setAdvancePaymentsMap(new Map());
            }
        };

        void fetchAdvances();
        return () => {
            isCancelled = true;
        };
    }, [allTeams, normalizeTeamName, paymentData, selectedTeamId, selectedWorkerId, showPayslipPreview, startDate, teams]);

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

            const teamsWithId: TeamWithId[] = fetchedTeams
                .filter((t): t is TeamWithId => typeof t.id === 'string' && t.id.trim().length > 0)
                .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
            setTeams(teamsWithId);

            const workersWithId: WorkerWithId[] = fetchedWorkers
                .filter((w): w is WorkerWithId => typeof w.id === 'string' && w.id.trim().length > 0)
                .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
            setAllWorkers(workersWithId);

            const companiesWithId: CompanyWithId[] = fetchedCompanies
                .filter((c): c is CompanyWithId => typeof c.id === 'string' && c.id.trim().length > 0)
                .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
            setCompanies(companiesWithId);
        } catch (error) {
            console.error("Error fetching initial data:", error);
            toast.error('기초 데이터를 불러오는데 실패했습니다. 페이지를 새로고침 해주세요.');
        } finally {
            setCompaniesLoaded(true);
        }
    };

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

        const normalizeValue = (value: string | undefined): string => {
            return (value ?? '').replace(/\s+/g, '').trim();
        };

        // 작업자 필터
        if (selectedWorkerId) {
            rows = rows.filter(row => row.workerId === selectedWorkerId);
        }

        // 급여방식 필터
        if (selectedType) {
            rows = rows.filter(row => row.salaryModel === selectedType);

            const selected = normalizeValue(selectedType);
            if (selected === '지원팀') {
                const teamCompanyIdById = new Map<string, string>();
                const teamCompanyIdByNameNormalized = new Map<string, string>();
                allTeams.forEach((team) => {
                    if (team.id) teamCompanyIdById.set(team.id, (team.companyId ?? '').trim());
                    const key = normalizeTeamName(team.name ?? '');
                    if (key && !teamCompanyIdByNameNormalized.has(key)) {
                        teamCompanyIdByNameNormalized.set(key, (team.companyId ?? '').trim());
                    }
                });

                const workerCompanyIdById = new Map<string, string>();
                allWorkers.forEach((worker) => {
                    workerCompanyIdById.set(worker.id, (worker.companyId ?? '').trim());
                });

                rows = rows.filter((row) => {
                    if (!companiesLoaded) return true;
                    if (partnerCompanyIds.size === 0) return false;

                    const directTeamCompanyId = (teamCompanyIdById.get(row.teamId) ?? '').trim();
                    const teamNameNormalized = normalizeTeamName(row.teamName ?? '');
                    const teamNameCompanyId = (teamNameNormalized ? (teamCompanyIdByNameNormalized.get(teamNameNormalized) ?? '') : '').trim();
                    const workerCompanyId = (workerCompanyIdById.get(row.workerId) ?? '').trim();
                    const mappedSupportCompanyId = (supportTeamCompanyIdById.get(row.teamId) ?? '').trim();

                    const companyId = directTeamCompanyId || teamNameCompanyId || workerCompanyId || mappedSupportCompanyId;
                    if (!companyId) return false;
                    return partnerCompanyIds.has(companyId);
                });
            }
            if (selected === '일급제' || selected === '월급제') {
                const workerTeamTypeById = new Map<string, string>();
                const workerCompanyIdById = new Map<string, string>();
                allWorkers.forEach((w) => {
                    workerTeamTypeById.set(w.id, w.teamType);
                    workerCompanyIdById.set(w.id, w.companyId ?? '');
                });

                const teamCompanyIdById = new Map<string, string>();
                const teamCompanyIdByNameNormalized = new Map<string, string>();
                allTeams.forEach((t) => {
                    if (t.id) teamCompanyIdById.set(t.id, t.companyId ?? '');
                    const nameNormalized = normalizeTeamName(t.name ?? '');
                    if (nameNormalized && !teamCompanyIdByNameNormalized.has(nameNormalized)) {
                        teamCompanyIdByNameNormalized.set(nameNormalized, t.companyId ?? '');
                    }
                });

                rows = rows.filter((row) => {
                    const workerTeamType = normalizeValue(workerTeamTypeById.get(row.workerId));
                    if (!workerTeamType) return true;
                    if (!CONSTRUCTION_TEAM_TYPES.has(workerTeamType)) return false;

                    if (!companiesLoaded) return true;
                    if (constructionCompanyIds.size === 0) return false;

                    const teamCompanyId = (teamCompanyIdById.get(row.teamId) ?? '').trim();
                    const teamNameNormalized = normalizeTeamName(row.teamName ?? '');
                    const fallbackCompanyId = (teamNameNormalized ? (teamCompanyIdByNameNormalized.get(teamNameNormalized) ?? '') : '').trim();
                    const workerCompanyId = (workerCompanyIdById.get(row.workerId) ?? '').trim();

                    const companyId = teamCompanyId || fallbackCompanyId || workerCompanyId;
                    if (!companyId) return false;
                    return constructionCompanyIds.has(companyId);
                });
            }
        }

        // 팀 필터
        if (!selectedTeamId) return rows;

        const selectedTeamName = teams.find(t => t.id === selectedTeamId)?.name ?? '';
        const selectedTeamNameNormalized = normalizeTeamName(selectedTeamName);

        const allowedTeamIds = new Set<string>();
        allowedTeamIds.add(selectedTeamId);

        allTeams.forEach(team => {
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

        const allowedTeamNameNormalized = new Set<string>();
        allTeams.forEach(team => {
            if (!team.id) return;
            if (!allowedTeamIds.has(team.id)) return;
            const normalized = normalizeTeamName(team.name ?? '');
            if (normalized) allowedTeamNameNormalized.add(normalized);
        });

        return rows.filter(item => {
            if (allowedTeamIds.has(item.teamId)) return true;
            const itemTeamNameNormalized = normalizeTeamName(item.teamName ?? '');
            return itemTeamNameNormalized && allowedTeamNameNormalized.has(itemTeamNameNormalized);
        });
    }, [allTeams, allWorkers, companiesLoaded, constructionCompanyIds, normalizeTeamName, partnerCompanyIds, paymentData, selectedTeamId, selectedType, selectedWorkerId, supportTeamCompanyIdById, teams]);

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
        const normalizeValue = (value: string | undefined): string => {
            return (value ?? '').replace(/\s+/g, '').trim();
        };

        const selected = normalizeValue(selectedType);
        if (!selected) return teams;

        if (selected === '지원팀') {
            return teams.filter((t) => {
                if (normalizeValue(t.type) !== '지원팀') return false;

                if (!companiesLoaded) return true;
                if (partnerCompanyIds.size === 0) return false;
                const companyId = (t.companyId ?? '').trim();
                if (!companyId) return false;
                return partnerCompanyIds.has(companyId);
            });
        }

        if (selected === '일급제' || selected === '월급제') {
            return teams.filter((t) => {
                const teamType = normalizeValue(t.type);
                if (!teamType) return true;
                if (!CONSTRUCTION_TEAM_TYPES.has(teamType)) return false;

                if (!companiesLoaded) return true;
                if (constructionCompanyIds.size === 0) return false;
                const companyId = (t.companyId ?? '').trim();
                if (!companyId) return false;
                return constructionCompanyIds.has(companyId);
            });
        }

        return teams;
    }, [companiesLoaded, constructionCompanyIds, partnerCompanyIds, selectedType, teams]);

    const workerSelectOptions = useMemo(() => {
        const teamNameById = new Map<string, string>();
        allTeams.forEach((t) => {
            if (!t.id) return;
            teamNameById.set(t.id, t.name ?? '');
        });

        const normalizeValue = (value: string | undefined): string => {
            return (value ?? '').replace(/\s+/g, '').trim();
        };

        const query = workerSearchQuery.trim().toLowerCase();

        let workers = allWorkers;

        if (selectedTeamId) {
            workers = workers.filter((w) => {
                const teamId = (w.teamId ?? '').trim();
                if (teamId && teamScope.allowedTeamIds.has(teamId)) return true;

                const workerTeamNameNormalized = normalizeTeamName(w.teamName ?? '');
                return workerTeamNameNormalized && teamScope.allowedTeamNameNormalized.has(workerTeamNameNormalized);
            });
        }

        if (selectedType) {
            workers = workers.filter((w) => {
                const workerSalaryModel = normalizeValue(w.salaryModel ?? w.payType);
                const workerTeamType = normalizeValue(w.teamType);
                const selected = normalizeValue(selectedType);
                if (selected === '지원팀') {
                    if (!(workerSalaryModel === selected || workerTeamType === selected)) return false;

                    if (!companiesLoaded) return true;
                    if (partnerCompanyIds.size === 0) return false;
                    const companyId = (w.companyId ?? '').trim();
                    if (!companyId) return false;
                    return partnerCompanyIds.has(companyId);
                }
                if (workerTeamType && !CONSTRUCTION_TEAM_TYPES.has(workerTeamType)) return false;
                if (workerSalaryModel !== selected) return false;

                if (!companiesLoaded) return true;
                if (constructionCompanyIds.size === 0) return false;
                const companyId = (w.companyId ?? '').trim();
                if (!companyId) return false;
                return constructionCompanyIds.has(companyId);
            });
        }

        if (query) {
            workers = workers.filter((w) => (w.name ?? '').toLowerCase().includes(query));
        }

        return workers
            .map((w) => {
                const teamName = w.teamName ?? teamNameById.get(w.teamId ?? '') ?? '';
                return { workerId: w.id, workerName: w.name ?? '', teamName };
            })
            .sort((a, b) => {
                const left = `${a.workerName}_${a.teamName}`;
                const right = `${b.workerName}_${b.teamName}`;
                return left.localeCompare(right, 'ko');
            });
    }, [allTeams, allWorkers, companiesLoaded, constructionCompanyIds, normalizeTeamName, partnerCompanyIds, selectedTeamId, selectedType, teamScope.allowedTeamIds, teamScope.allowedTeamNameNormalized, workerSearchQuery]);

    useEffect(() => {
        if (!selectedWorkerId) return;
        const exists = workerSelectOptions.some((opt) => opt.workerId === selectedWorkerId);
        if (!exists) setSelectedWorkerId('');
    }, [selectedWorkerId, workerSelectOptions]);

    useEffect(() => {
        setWorkerSearchQuery('');
    }, [selectedTeamId]);

    useEffect(() => {
        if (!selectedTeamId) return;
        const exists = teamSelectOptions.some((t) => t.id === selectedTeamId);
        if (!exists) setSelectedTeamId('');
    }, [selectedTeamId, teamSelectOptions]);

    // 아이콘 매핑 (팀/작업자)
    const teamIconKeyById = useMemo(() => {
        const map = new Map<string, string>();
        allTeams.forEach(t => { if (t.id) map.set(t.id, t.iconKey ?? ''); });
        return map;
    }, [allTeams]);

    const workerIconKeyById = useMemo(() => {
        const map = new Map<string, string>();
        allWorkers.forEach(w => { if (w.id) map.set(w.id, w.iconKey ?? ''); });
        return map;
    }, [allWorkers]);

    // fetchData 함수
    const fetchData = useCallback(async () => {
        setLoading(true);

        try {
            const reports = await dailyReportService.getReportsByRange(startDate, endDate);

            const workerById = new Map<string, WorkerWithId>();
            allWorkers.forEach(worker => {
                workerById.set(worker.id, worker);
            });

            const teamById = new Map<string, Team>();
            allTeams.forEach((team) => {
                if (!team.id) return;
                teamById.set(team.id, team);
            });

            const rowByKey = new Map<string, TransferRow>();

            const normalizeValue = (value: string | undefined): string => {
                return (value ?? '').replace(/\s+/g, '').trim();
            };

            const supportTeams = allTeams.filter(t => normalizeValue(t.type) === '지원팀');
            const supportTeamByCompanyId = new Map<string, Team>();
            const supportTeamByCompanyNameNormalized = new Map<string, Team>();
            supportTeams.forEach(team => {
                const companyIdRaw = (team.companyId ?? '').trim();
                const companyNameRaw = (team.companyName ?? '').trim();
                const companyNameNormalized = normalizeCompanyName(companyNameRaw);
                const companyIdByName = companyNameNormalized ? (companyIdByNameNormalized.get(companyNameNormalized) ?? '') : '';
                const companyId = companyIdRaw || companyIdByName;

                if (companyId) supportTeamByCompanyId.set(companyId, team);
                if (team.companyName) {
                    if (companyNameNormalized && !supportTeamByCompanyNameNormalized.has(companyNameNormalized)) {
                        supportTeamByCompanyNameNormalized.set(companyNameNormalized, team);
                    }
                }
            });

            const workerByName = new Map<string, WorkerWithId>();
            allWorkers.forEach(worker => {
                workerByName.set(worker.name.trim(), worker);
            });

            reports.forEach(report => {
                report.workers.forEach(reportWorker => {
                    const workerId = reportWorker.workerId;
                    if (!workerId) return;

                    const worker = workerById.get(workerId);
                    const salaryModel = reportWorker.salaryModel ?? worker?.salaryModel ?? worker?.payType ?? reportWorker.payType ?? '일급제';
                    const manDay = typeof reportWorker.manDay === 'number' && Number.isFinite(reportWorker.manDay) ? reportWorker.manDay : 0;

                    const unitPrice =
                        typeof reportWorker.unitPrice === 'number' && Number.isFinite(reportWorker.unitPrice)
                            ? reportWorker.unitPrice
                            : (typeof worker?.unitPrice === 'number' && Number.isFinite(worker.unitPrice) ? worker.unitPrice : 0);

                    const isSupport =
                        normalizeValue(salaryModel) === '지원팀' ||
                        normalizeValue(reportWorker.salaryModel) === '지원팀' ||
                        normalizeValue(worker?.teamType) === '지원팀';

                    if (isSupport) {
                        const reportTeam = report.teamId ? teamById.get(report.teamId) : undefined;
                        const reportTeamCompanyId = (reportTeam?.companyId ?? '').trim();
                        const reportTeamCompanyName = (reportTeam?.companyName ?? '').trim();

                        const workerTeamId = (reportWorker.teamId ?? worker?.teamId ?? '').trim();
                        const workerTeam = workerTeamId ? teamById.get(workerTeamId) : undefined;
                        const workerTeamCompanyId = (workerTeam?.companyId ?? '').trim();
                        const workerTeamCompanyName = (workerTeam?.companyName ?? '').trim();

                        const rawCompanyId = (worker?.companyId ?? report.companyId ?? workerTeamCompanyId ?? reportTeamCompanyId ?? '').trim();
                        const companyNameRaw = (worker?.companyName ?? report.companyName ?? workerTeamCompanyName ?? reportTeamCompanyName ?? '').trim();
                        const companyNameNormalized = normalizeCompanyName(companyNameRaw);
                        const resolvedCompanyId = rawCompanyId || (companyNameNormalized ? (companyIdByNameNormalized.get(companyNameNormalized) ?? '') : '');

                        const supportTeam =
                            (resolvedCompanyId ? supportTeamByCompanyId.get(resolvedCompanyId) : undefined) ??
                            (companyNameNormalized ? supportTeamByCompanyNameNormalized.get(companyNameNormalized) : undefined);

                        if (supportTeam) {
                            const supportTeamId = supportTeam.id ?? `support_${resolvedCompanyId || companyNameRaw}`;
                            const supportRate = typeof supportTeam.supportRate === 'number' && Number.isFinite(supportTeam.supportRate) ? supportTeam.supportRate : 0;
                            const supportModel = supportTeam.supportModel ?? 'man_day';

                            const leaderIdRaw = (supportTeam.leaderId ?? '').trim();
                            const leaderId = leaderIdRaw && leaderIdRaw !== '0' ? leaderIdRaw : '';
                            const leaderWorker = (leaderId ? workerById.get(leaderId) : undefined) ?? (supportTeam.leaderName ? workerByName.get(supportTeam.leaderName.trim()) : undefined);

                            const recipientWorkerId = leaderWorker?.id ?? leaderId ?? '';
                            const recipientWorkerName = leaderWorker?.name ?? supportTeam.leaderName ?? `${companyNameRaw || '지원팀'} 팀장`;

                            const bankName = leaderWorker?.bankName ?? '';
                            const bankCode = bankName ? (BANK_CODES[bankName.trim()] ?? '') : '';
                            const accountNumber = leaderWorker?.accountNumber ?? '';
                            const accountHolder = leaderWorker?.accountHolder ?? recipientWorkerName;
                            const validation = validateTransferRow({ bankName, bankCode, accountNumber, accountHolder });

                            const rowKey = `지원팀_${supportTeamId}_${resolvedCompanyId || companyNameRaw}_${recipientWorkerId || recipientWorkerName}`;
                            const existing = rowByKey.get(rowKey);
                            const nextAmount = supportModel === 'fixed' ? supportRate : Math.round(manDay * supportRate);

                            if (existing) {
                                existing.totalManDay += manDay;
                                if (supportModel === 'fixed') {
                                    existing.totalAmount = supportRate;
                                } else {
                                    existing.totalAmount += nextAmount;
                                }
                                if (!validation.isValid) {
                                    existing.isValid = false;
                                    existing.errors = { ...existing.errors, ...validation.errors };
                                }
                                return;
                            }

                            rowByKey.set(rowKey, {
                                rowKey,
                                teamId: supportTeamId,
                                teamName: supportTeam.name ?? `${companyNameRaw || '지원팀'} 지원팀`,
                                workerId: recipientWorkerId,
                                workerName: recipientWorkerName,
                                salaryModel: '지원팀',
                                totalManDay: manDay,
                                unitPrice: supportRate,
                                totalAmount: supportModel === 'fixed' ? supportRate : nextAmount,
                                bankName,
                                bankCode,
                                accountNumber,
                                accountHolder,
                                displayContent: bulkDisplayContent,
                                isValid: validation.isValid,
                                errors: validation.errors
                            });
                            return;
                        }
                    }

                    const teamId = reportWorker.teamId ?? worker?.teamId ?? report.teamId ?? '';
                    const teamName = report.teamName ?? worker?.teamName ?? '';

                    const rowKey = `${salaryModel}_${teamId}_${workerId}`;
                    const existing = rowByKey.get(rowKey);
                    if (existing) {
                        existing.totalManDay += manDay;
                        existing.totalAmount += Math.round(manDay * unitPrice);
                        return;
                    }

                    const bankName = worker?.bankName ?? '';
                    const bankCode = bankName ? (BANK_CODES[bankName.trim()] ?? '') : '';
                    const accountNumber = worker?.accountNumber ?? '';
                    const accountHolder = worker?.accountHolder ?? worker?.name ?? '';
                    const validation = validateTransferRow({ bankName, bankCode, accountNumber, accountHolder });

                    rowByKey.set(rowKey, {
                        rowKey,
                        teamId,
                        teamName,
                        workerId,
                        workerName: reportWorker.name ?? worker?.name ?? '',
                        salaryModel,
                        totalManDay: manDay,
                        unitPrice,
                        totalAmount: Math.round(manDay * unitPrice),
                        bankName,
                        bankCode,
                        accountNumber,
                        accountHolder,
                        displayContent: bulkDisplayContent,
                        isValid: validation.isValid,
                        errors: validation.errors
                    });
                });
            });

            const rows = Array.from(rowByKey.values()).sort((a, b) => {
                const left = `${a.teamName}_${a.workerName}`;
                const right = `${b.teamName}_${b.workerName}`;
                return left.localeCompare(right);
            });

            setPaymentData(rows);
            setErrorCount(rows.filter(item => !item.isValid).length);

            const [yearStr, monthStr] = startDate.split('-');
            const year = Number(yearStr);
            const month = Number(monthStr);
            if (selectedTeamId && Number.isFinite(year) && Number.isFinite(month)) {
                const selectedTeamName = teams.find(t => t.id === selectedTeamId)?.name ?? '';
                const selectedTeamNameNormalized = normalizeTeamName(selectedTeamName);

                const allowedTeamIds = new Set<string>();
                allowedTeamIds.add(selectedTeamId);

                allTeams.forEach(team => {
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

                const allowedTeamNameNormalized = new Set<string>();
                allTeams.forEach(team => {
                    if (!team.id) return;
                    if (!allowedTeamIds.has(team.id)) return;
                    const normalized = normalizeTeamName(team.name ?? '');
                    if (normalized) allowedTeamNameNormalized.add(normalized);
                });

                allTeams.forEach(team => {
                    if (!team.id) return;
                    const normalized = normalizeTeamName(team.name ?? '');
                    if (!normalized) return;
                    if (allowedTeamNameNormalized.has(normalized)) {
                        allowedTeamIds.add(team.id);
                    }
                });

                const teamIdsToFetch = Array.from(allowedTeamIds);
                const advancesByTeam = await Promise.all(
                    teamIdsToFetch.map(teamId => advancePaymentService.getAdvancePayments(year, month, teamId))
                );
                const advances = advancesByTeam.flat();

                const nextMap = new Map<string, AdvancePayment>();
                advances.forEach(item => {
                    nextMap.set(item.workerId, item);
                });
                setAdvancePaymentsMap(nextMap);
            } else {
                setAdvancePaymentsMap(new Map());
            }

        } catch (error) {
            console.error('Error fetching payroll draft data:', error);
            toast.error('데이터 조회에 실패했습니다.');
        } finally {
            setLoading(false);
        }
    }, [allTeams, allWorkers, bulkDisplayContent, companyIdByNameNormalized, endDate, normalizeCompanyName, normalizeTeamName, selectedTeamId, startDate, teams, validateTransferRow]);

    const filteredErrorCount = useMemo(() => {
        return filteredPaymentData.filter(item => !item.isValid).length;
    }, [filteredPaymentData]);

    const tableColSpan = useMemo(() => {
        let cols = 0;
        cols += 6; // No, 팀, 이름, 급여방식, 공수, 단가
        if (showAccountInfo) cols += 3; // 은행, 계좌번호, 예금주
        if (selectedType === '월급제') cols += 2; // 총금액, 공제액
        cols += 2; // 실지급액/입금액, 메모
        return cols;
    }, [selectedType, showAccountInfo]);

    type AdvanceDeductionLine = {
        id: string;
        label: string;
        amount: number;
    };

    const getAdvanceDeductionLines = useCallback((advanceData?: AdvancePayment): AdvanceDeductionLine[] => {
        const configItems = (payrollConfig?.deductionItems ?? [])
            .filter(item => item.isActive)
            .slice()
            .sort((a, b) => a.order - b.order);

        const labelById = new Map<string, string>();
        const normalizedConfigIds: string[] = [];
        configItems.forEach(item => {
            const canonicalId = normalizeDeductionId(item.id);
            labelById.set(canonicalId, item.label);
            normalizedConfigIds.push(canonicalId);
        });

        const normalizedAdvanceItems = Object.entries(advanceData?.items ?? {}).reduce<Record<string, number>>((acc, [key, value]) => {
            const canonicalKey = normalizeDeductionId(key);
            const safeValue = typeof value === 'number' && Number.isFinite(value) ? value : 0;
            acc[canonicalKey] = (acc[canonicalKey] ?? 0) + safeValue;
            return acc;
        }, {});

        const baseIds = normalizedConfigIds.length > 0 ? normalizedConfigIds : Array.from(BASE_ADVANCE_DEDUCTION_ITEM_IDS);
        const extraIds = Object.keys(normalizedAdvanceItems)
            .filter(id => !labelById.has(id))
            .sort((a, b) => a.localeCompare(b, 'ko'));

        const allIds: string[] = [];
        const seenIds = new Set<string>();
        [...baseIds, ...extraIds].forEach(id => {
            if (seenIds.has(id)) return;
            seenIds.add(id);
            allIds.push(id);
        });

        const getAmount = (itemId: string): number => {
            if (!advanceData) return 0;
            switch (itemId) {
                case 'prevMonthCarryover': return advanceData.prevMonthCarryover ?? 0;
                case 'accommodation': return advanceData.accommodation ?? 0;
                case 'privateRoom': return advanceData.privateRoom ?? 0;
                case 'gloves': return advanceData.gloves ?? 0;
                case 'deposit': return advanceData.deposit ?? 0;
                case 'fines': return advanceData.fines ?? 0;
                case 'electricity': return advanceData.electricity ?? 0;
                case 'gas': return advanceData.gas ?? 0;
                case 'internet': return advanceData.internet ?? 0;
                case 'water': return advanceData.water ?? 0;
                default: return normalizedAdvanceItems[itemId] ?? 0;
            }
        };

        const lines = allIds.map(id => ({
            id,
            label: labelById.get(id) ?? id,
            amount: getAmount(id)
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

    const getKbTransferAmount = useCallback((row: TransferRow): number => {
        if (row.salaryModel !== '월급제') return row.totalAmount;

        const advanceData = advancePaymentsMap.get(row.workerId);
        const advanceDeduction = getAdvanceDeductionTotal(advanceData);
        const result = calculatePayrollDeductions({
            grossPay: row.totalAmount,
            insuranceConfig: payrollConfig?.insuranceConfig,
            taxRate: payrollConfig?.taxRate,
            advanceDeduction
        });
        return result.netPay;
    }, [advancePaymentsMap, getAdvanceDeductionTotal, payrollConfig?.insuranceConfig, payrollConfig?.taxRate]);

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

    const kbPreviewRows = useMemo((): KbPreviewRow[] => {
        const depositDisplay = truncateToMaxLength(kbReceiverDisplay ?? '', KB_MAX_DEPOSIT_DISPLAY_LENGTH);

        return filteredPaymentData.map(row => {
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
    }, [filteredPaymentData, getKbTransferAmount, kbMemoMap, kbMemoSuffix, kbReceiverDisplay]);

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
            ...kbPreviewRows.map(item => [
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

        ws['!cols'] = [
            { wch: 8 },
            { wch: 20 },
            { wch: 15 },
            { wch: 12 },
            { wch: 16 }
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, '국민은행용');
        const fileName = `팀별입금_국민은행용_${startDate}_${endDate}.xlsx`;
        XLSX.writeFile(wb, fileName);
    }, [endDate, kbPreviewRows, startDate]);

    return (
    <div className="flex flex-col h-full bg-gradient-to-br from-slate-50 to-blue-50 p-4 sm:p-6 gap-4 sm:gap-6">
    {/* 헤더 */ }
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800">📋 팀별 입금 리스트 (초안)</h1>
            <p className="text-sm text-slate-500 mt-1">일보 데이터 기반 급여 계산</p>
        </div>
    </div>

    {/* 필터 */ }
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

            {selectedType === '지원팀' && companiesLoaded && supportIssueBuckets.totalCount > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                        <FontAwesomeIcon icon={faExclamationTriangle} className="text-amber-600" />
                        지원팀은 협력사 회사 연결이 필수입니다. ({supportIssueBuckets.totalCount.toLocaleString()}건)
                    </div>

                    <div className="mt-2 text-xs text-amber-800 space-y-1">
                        {supportIssueBuckets.missingCompanyTeams.length > 0 && (
                            <div>
                                회사 미등록 지원팀: {supportIssueBuckets.missingCompanyTeams.length.toLocaleString()}건
                            </div>
                        )}
                        {supportIssueBuckets.companyNotFoundTeams.length > 0 && (
                            <div>
                                회사 문서 없음(teams.companyId 불일치): {supportIssueBuckets.companyNotFoundTeams.length.toLocaleString()}건
                            </div>
                        )}
                        {supportIssueBuckets.wrongCompanyTypeTeams.length > 0 && (
                            <div>
                                협력사 아님(type 불일치): {supportIssueBuckets.wrongCompanyTypeTeams.length.toLocaleString()}건
                            </div>
                        )}
                        {supportIssueBuckets.missingCompanyMappingRows.length > 0 && (
                            <div>
                                지원팀 지급 row 회사 매핑 누락: {supportIssueBuckets.missingCompanyMappingRows.length.toLocaleString()}건
                            </div>
                        )}
                        {supportIssueBuckets.companyNotPartnerRows.length > 0 && (
                            <div>
                                지원팀 지급 row 협력사 아님: {supportIssueBuckets.companyNotPartnerRows.length.toLocaleString()}건
                            </div>
                        )}
                    </div>

                    {(supportIssueBuckets.missingCompanyTeams.length > 0 || supportIssueBuckets.wrongCompanyTypeTeams.length > 0) && (
                        <div className="mt-2 text-xs text-amber-900">
                            {supportIssueBuckets.missingCompanyTeams.slice(0, 6).map((item) => (
                                <div key={`missing_${item.teamKey}`}>- {item.teamName || item.teamKey}</div>
                            ))}
                            {supportIssueBuckets.wrongCompanyTypeTeams.slice(0, 6).map((item) => (
                                <div key={`wrong_${item.teamKey}`}>- {item.teamName || item.teamKey} ({item.companyType})</div>
                            ))}
                        </div>
                    )}
                </div>
            )}

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
            <div className="flex-1 min-w-[150px]">
                <label className="block text-xs font-semibold text-slate-600 mb-1">팀</label>
                <select
                    value={selectedTeamId}
                    onChange={(e) => setSelectedTeamId(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                    <option value="">전체</option>
                    {teamSelectOptions.map(team => (
                        <option key={team.id} value={team.id}>{team.name}</option>
                    ))}
                </select>
            </div>
            <div className="flex-1 min-w-[150px]">
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

    {/* 결과 테이블 */ }
    <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex flex-wrap gap-2">
                <button
                    onClick={() => setShowKBPreview(true)}
                    disabled={filteredPaymentData.length === 0}
                    className="px-3 py-1.5 text-xs bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-bold flex items-center gap-1 disabled:opacity-50"
                >
                    <FontAwesomeIcon icon={faFileExcel} />
                    국민은행용
                </button>
                <button
                    onClick={() => setShowBankCodes(true)}
                    className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold"
                >
                    은행코드표
                </button>
                {selectedType === '월급제' && (
                    <button
                        onClick={() => setShowPayslipPreview(true)}
                        disabled={filteredPaymentData.length === 0}
                        className="px-3 py-1.5 text-xs bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-bold flex items-center gap-1 disabled:opacity-50"
                    >
                        노임명세서
                    </button>
                )}
            </div>
            <div className="flex items-center gap-4">
                <button
                    onClick={() => setShowAccountInfo(!showAccountInfo)}
                    className="text-xs text-blue-600 underline"
                >
                    {showAccountInfo ? '계좌정보 숨김' : '계좌정보 표시'}
                </button>
                <div className="text-sm font-semibold text-slate-600">
                    오류: {errorCount.toLocaleString()}건 / 필터: {filteredErrorCount.toLocaleString()}건
                </div>
            </div>
        </div>

        <div className="flex-1 overflow-auto">
            <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500 font-semibold sticky top-0 z-10 border-b border-slate-200">
                    <tr>
                        <th className="px-4 py-2 text-center w-12">No</th>
                        <th className="px-4 py-2">팀</th>
                        <th className="px-4 py-2">이름</th>
                        <th className="px-4 py-2">급여방식</th>
                        <th className="px-4 py-2 text-right">공수</th>
                        <th className="px-4 py-2 text-right">단가</th>
                        {showAccountInfo && <th className="px-4 py-2">은행</th>}
                        {showAccountInfo && <th className="px-4 py-2">계좌번호</th>}
                        {showAccountInfo && <th className="px-4 py-2">예금주</th>}
                        {selectedType === '월급제' && <th className="px-4 py-2 text-right">총금액</th>}
                        {selectedType === '월급제' && <th className="px-4 py-2 text-right text-red-600">공제액</th>}
                        <th className="px-4 py-2 text-right">{selectedType === '월급제' ? '실지급액' : '입금액'}</th>
                        <th className="px-4 py-2">메모</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {loading ? (
                        <tr>
                            <td colSpan={tableColSpan} className="px-4 py-12 text-center text-slate-500">
                                <div className="flex flex-col items-center gap-2">
                                    <FontAwesomeIcon icon={faSpinner} spin className="text-2xl text-blue-500" />
                                    <span>데이터 분석 중...</span>
                                </div>
                            </td>
                        </tr>
                    ) : filteredPaymentData.length === 0 ? (
                        <tr>
                            <td colSpan={tableColSpan} className="px-4 py-12 text-center text-slate-500 bg-slate-50/50">
                                <FontAwesomeIcon icon={faSearch} className="text-2xl text-slate-300 mb-2" />
                                <p className="font-medium">조회된 데이터가 없습니다.</p>
                                <p className="text-xs text-slate-400">검색 조건을 변경하여 다시 조회해보세요.</p>
                            </td>
                        </tr>
                    ) : (
                        filteredPaymentData.map((row, index) => (
                            <tr key={row.rowKey} className={`hover:bg-blue-50/50 transition-colors ${row.isValid ? '' : 'bg-amber-50/50'}`}>
                                <td className="px-4 py-3 text-center text-slate-400 text-xs">{index + 1}</td>
                                <td className="px-4 py-3 text-slate-600">
                                    <div className="flex items-center gap-2">
                                        <FontAwesomeIcon
                                            icon={getIcon(teamIconKeyById.get(row.teamId) ?? '')}
                                            className="text-slate-400 text-xs"
                                        />
                                        <span>{row.teamName || '-'}</span>
                                    </div>
                                </td>
                                <td className="px-4 py-3 font-bold text-slate-800">
                                    <div className="flex items-center gap-2">
                                        <FontAwesomeIcon
                                            icon={getIcon(workerIconKeyById.get(row.workerId) ?? '')}
                                            className="text-slate-500 text-xs"
                                        />
                                        <span>{row.workerName}</span>
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${row.salaryModel === '일급제' ? 'bg-blue-50 text-blue-600' :
                                        row.salaryModel === '월급제' ? 'bg-indigo-50 text-indigo-600' :
                                            'bg-slate-100 text-slate-600'}`}>
                                        {row.salaryModel}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-right font-mono text-slate-600">{row.totalManDay.toFixed(1)}</td>
                                <td className="px-4 py-3 text-right font-mono text-slate-600">{row.unitPrice.toLocaleString()}</td>
                                {showAccountInfo && (
                                    <td className={`px-4 py-3 ${row.errors.bankName || row.errors.bankCode ? 'text-amber-700 font-semibold' : 'text-slate-600'}`}>
                                        {row.bankName || '은행 누락'}
                                        {!row.isValid && <FontAwesomeIcon icon={faExclamationTriangle} className="ml-1 text-amber-500 text-xs" />}
                                    </td>
                                )}
                                {showAccountInfo && (
                                    <td className={`px-4 py-3 ${row.errors.accountNumber ? 'text-amber-700 font-semibold' : 'text-slate-600'}`}>
                                        <span className="font-mono text-xs">{row.accountNumber || '계좌 누락'}</span>
                                    </td>
                                )}
                                {showAccountInfo && (
                                    <td className={`px-4 py-3 ${row.errors.accountHolder ? 'text-amber-700 font-semibold' : 'text-slate-600'}`}>
                                        {row.accountHolder || '예금주 누락'}
                                    </td>
                                )}
                                {selectedType === '월급제' && (() => {
                                    const advanceData = advancePaymentsMap.get(row.workerId);
                                    const advanceDeduction = getAdvanceDeductionTotal(advanceData);
                                    const result = calculatePayrollDeductions({
                                        grossPay: row.totalAmount,
                                        insuranceConfig: payrollConfig?.insuranceConfig,
                                        taxRate: payrollConfig?.taxRate,
                                        advanceDeduction
                                    });
                                    return (
                                        <>
                                            <td className="px-4 py-3 text-right">
                                                <span className="font-mono text-slate-700">{row.totalAmount.toLocaleString()}</span>
                                                <span className="text-xs text-slate-400 ml-1">원</span>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <span className="font-mono text-red-600 font-semibold">{result.totalDeduction.toLocaleString()}</span>
                                                <span className="text-xs text-slate-400 ml-1">원</span>
                                            </td>
                                        </>
                                    );
                                })()}
                                <td className="px-4 py-3 text-right">
                                    {selectedType === '월급제' ? (() => {
                                        const advanceData = advancePaymentsMap.get(row.workerId);
                                        const advanceDeduction = getAdvanceDeductionTotal(advanceData);
                                        const result = calculatePayrollDeductions({
                                            grossPay: row.totalAmount,
                                            insuranceConfig: payrollConfig?.insuranceConfig,
                                            taxRate: payrollConfig?.taxRate,
                                            advanceDeduction
                                        });
                                        return (
                                            <>
                                                <span className="font-bold text-emerald-600 font-mono">{result.netPay.toLocaleString()}</span>
                                                <span className="text-xs text-slate-400 ml-1">원</span>
                                            </>
                                        );
                                    })() : (
                                        <>
                                            <span className="font-bold text-blue-600 font-mono">{row.totalAmount.toLocaleString()}</span>
                                            <span className="text-xs text-slate-400 ml-1">원</span>
                                        </>
                                    )}
                                </td>
                                <td className="px-4 py-3 text-slate-700 text-sm">{row.displayContent || '-'}</td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    </div>

    {
        showKBPreview && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[95vh] sm:h-auto sm:max-h-[80vh] flex flex-col">
                    <div className="p-3 sm:p-4 border-b border-slate-200 flex justify-between items-center bg-amber-50">
                        <div className="flex flex-col gap-1">
                            <h3 className="text-base sm:text-lg font-bold text-slate-800">🏦 국민은행용 엑셀 미리보기</h3>
                            <div className="text-xs text-slate-500">
                                D(입금통장표시) {KB_MAX_DEPOSIT_DISPLAY_LENGTH}자 / E(출금통장표시) {KB_MAX_WITHDRAW_DISPLAY_LENGTH}자 제한
                            </div>
                        </div>
                        <button
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
                        <div className="text-xs text-slate-400 sm:ml-auto">
                            {kbPreviewRows.length.toLocaleString()}건
                        </div>
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
                                                        setKbMemoMap(prev => {
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
                                onClick={() => setShowKBPreview(false)}
                                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                            >
                                닫기
                            </button>
                            <button
                                onClick={() => { handleDownloadKBExcel(); setShowKBPreview(false); }}
                                className="px-4 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-bold flex items-center gap-2"
                            >
                                <FontAwesomeIcon icon={faDownload} />
                                국민은행용 다운로드
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    {/* 은행코드표 모달 */ }
    {
        showBankCodes && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg h-[95vh] sm:h-auto sm:max-h-[80vh] flex flex-col">
                    <div className="p-3 sm:p-4 border-b border-slate-200 flex justify-between items-center bg-blue-50">
                        <h3 className="text-base sm:text-lg font-bold text-slate-800">📊 은행코드표</h3>
                        <button
                            onClick={() => setShowBankCodes(false)}
                            className="text-slate-400 hover:text-slate-600 text-2xl"
                            aria-label="은행코드표 닫기"
                        >
                            ×
                        </button>
                    </div>
                    <div className="flex-1 overflow-auto p-4">
                        <h4 className="text-sm font-bold text-slate-700 mb-2 bg-blue-100 px-2 py-1 rounded">🏦 은행</h4>
                        <table className="w-full text-xs border-collapse mb-4">
                            <thead className="bg-slate-100 sticky top-0">
                                <tr>
                                    <th className="border border-slate-300 px-2 py-1 text-left font-bold">코드</th>
                                    <th className="border border-slate-300 px-2 py-1 text-left font-bold">은행명</th>
                                    <th className="border border-slate-300 px-2 py-1 text-left font-bold">별칭</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr><td className="border px-2 py-1 font-mono">002</td><td className="border px-2 py-1">산업은행</td><td className="border px-2 py-1 text-slate-500">산업, KDB</td></tr>
                                <tr><td className="border px-2 py-1 font-mono">003</td><td className="border px-2 py-1">기업은행</td><td className="border px-2 py-1 text-slate-500">기업, IBK</td></tr>
                                <tr className="bg-amber-50"><td className="border px-2 py-1 font-mono font-bold">004</td><td className="border px-2 py-1 font-bold">KB국민은행</td><td className="border px-2 py-1 text-slate-500">국민, KB</td></tr>
                                <tr><td className="border px-2 py-1 font-mono">007</td><td className="border px-2 py-1">수협은행</td><td className="border px-2 py-1 text-slate-500">수협</td></tr>
                                <tr><td className="border px-2 py-1 font-mono">011</td><td className="border px-2 py-1">농협은행</td><td className="border px-2 py-1 text-slate-500">농협, NH</td></tr>
                                <tr><td className="border px-2 py-1 font-mono">012</td><td className="border px-2 py-1">농축협</td><td className="border px-2 py-1 text-slate-500">지역농협</td></tr>
                                <tr><td className="border px-2 py-1 font-mono">020</td><td className="border px-2 py-1">우리은행</td><td className="border px-2 py-1 text-slate-500">우리</td></tr>
                                <tr><td className="border px-2 py-1 font-mono">023</td><td className="border px-2 py-1">SC제일은행</td><td className="border px-2 py-1 text-slate-500">제일은행, SC</td></tr>
                                <tr><td className="border px-2 py-1 font-mono">027</td><td className="border px-2 py-1">한국씨티은행</td><td className="border px-2 py-1 text-slate-500">씨티</td></tr>
                                <tr><td className="border px-2 py-1 font-mono">031</td><td className="border px-2 py-1">대구은행</td><td className="border px-2 py-1 text-slate-500">대구, iM뱅크, DGB</td></tr>
                                <tr><td className="border px-2 py-1 font-mono">032</td><td className="border px-2 py-1">부산은행</td><td className="border px-2 py-1 text-slate-500">부산, BNK부산</td></tr>
                                <tr><td className="border px-2 py-1 font-mono">034</td><td className="border px-2 py-1">광주은행</td><td className="border px-2 py-1 text-slate-500">광주</td></tr>
                                <tr><td className="border px-2 py-1 font-mono">035</td><td className="border px-2 py-1">제주은행</td><td className="border px-2 py-1 text-slate-500">제주</td></tr>
                                <tr><td className="border px-2 py-1 font-mono">037</td><td className="border px-2 py-1">전북은행</td><td className="border px-2 py-1 text-slate-500">전북</td></tr>
                                <tr><td className="border px-2 py-1 font-mono">039</td><td className="border px-2 py-1">경남은행</td><td className="border px-2 py-1 text-slate-500">경남, BNK경남</td></tr>
                                <tr><td className="border px-2 py-1 font-mono">071</td><td className="border px-2 py-1">우체국</td><td className="border px-2 py-1 text-slate-500">-</td></tr>
                                <tr><td className="border px-2 py-1 font-mono">081</td><td className="border px-2 py-1">하나은행</td><td className="border px-2 py-1 text-slate-500">하나, KEB하나</td></tr>
                                <tr><td className="border px-2 py-1 font-mono">088</td><td className="border px-2 py-1">신한은행</td><td className="border px-2 py-1 text-slate-500">신한</td></tr>
                                <tr><td className="border px-2 py-1 font-mono">089</td><td className="border px-2 py-1">케이뱅크</td><td className="border px-2 py-1 text-slate-500">케이, K뱅크</td></tr>
                                <tr><td className="border px-2 py-1 font-mono">090</td><td className="border px-2 py-1">카카오뱅크</td><td className="border px-2 py-1 text-slate-500">카카오, 카뱅</td></tr>
                                <tr><td className="border px-2 py-1 font-mono">092</td><td className="border px-2 py-1">토스뱅크</td><td className="border px-2 py-1 text-slate-500">토스</td></tr>
                            </tbody>
                        </table>

                        <h4 className="text-sm font-bold text-slate-700 mb-2 bg-green-100 px-2 py-1 rounded">🏛️ 2금융권</h4>
                        <table className="w-full text-xs border-collapse mb-4">
                            <tbody>
                                <tr className="bg-green-50"><td className="border px-2 py-1 font-mono font-bold">045</td><td className="border px-2 py-1 font-bold">새마을금고</td><td className="border px-2 py-1 text-slate-500">새마을, MG</td></tr>
                                <tr className="bg-green-50"><td className="border px-2 py-1 font-mono font-bold">048</td><td className="border px-2 py-1 font-bold">신협</td><td className="border px-2 py-1 text-slate-500">신용협동조합</td></tr>
                                <tr><td className="border px-2 py-1 font-mono">050</td><td className="border px-2 py-1">상호저축은행</td><td className="border px-2 py-1 text-slate-500">저축은행</td></tr>
                            </tbody>
                        </table>
                    </div>
                    <div className="p-4 border-t border-slate-200 bg-blue-50">
                        <p className="text-xs text-slate-500 mb-2">💡 작업자 DB에서 "은행명"을 위 이름 또는 별칭으로 입력하면 자동으로 코드가 매핑됩니다.</p>
                        <button
                            onClick={() => setShowBankCodes(false)}
                            className="w-full px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold"
                        >
                            닫기
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    {/* 노임명세서 미리보기 모달 */ }
    {
        showPayslipPreview && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full mx-4 max-h-[90vh] flex flex-col">
                    <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-gradient-to-r from-green-600 to-green-700">
                        <h3 className="text-lg font-bold text-white">📋 월급제 노임명세서 (4대보험 포함)</h3>
                        <button
                            onClick={() => { setShowPayslipPreview(false); setSelectedPayslipWorker(null); }}
                            className="text-white/80 hover:text-white text-2xl"
                            aria-label="노임명세서 미리보기 닫기"
                        >
                            ×
                        </button>
                    </div>
                    <div className="flex-1 overflow-auto p-4">
                        <div className="mb-3 text-xs text-slate-500">
                            공제항목(사용): {(payrollConfig?.deductionItems ?? []).filter((item) => item.isActive).length}개 | 가불/공제 데이터: {advancePaymentsMap.size}명
                        </div>
                        {/* 작업자 검색 및 선택 */}
                        <div className="mb-4">
                            <div className="flex items-center gap-3 mb-2">
                                <label className="text-sm font-bold text-slate-700">작업자 검색:</label>
                                <input
                                    type="text"
                                    value={payslipSearchQuery}
                                    onChange={(e) => setPayslipSearchQuery(e.target.value)}
                                    placeholder="이름 또는 팀명으로 검색..."
                                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm flex-1 max-w-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                                />
                                {payslipSearchQuery && (
                                    <button
                                        onClick={() => setPayslipSearchQuery('')}
                                        className="text-slate-400 hover:text-slate-600 text-sm"
                                    >
                                        ✕ 초기화
                                    </button>
                                )}
                            </div>
                            {/* 필터된 작업자 목록 */}
                            <div className="border border-slate-200 rounded-lg max-h-48 overflow-y-auto bg-slate-50">
                                {filteredPaymentData
                                    .filter(w => {
                                        if (!payslipSearchQuery.trim()) return true;
                                        const query = payslipSearchQuery.toLowerCase();
                                        return w.workerName.toLowerCase().includes(query) ||
                                            w.teamName.toLowerCase().includes(query);
                                    })
                                    .map(worker => (
                                        <button
                                            key={worker.workerId}
                                            onClick={() => {
                                                setSelectedPayslipWorker(worker);
                                                setPayslipSearchQuery('');
                                            }}
                                            className={`w-full text-left px-3 py-2 text-sm hover:bg-emerald-50 border-b border-slate-100 last:border-b-0 flex justify-between items-center transition-colors ${selectedPayslipWorker?.workerId === worker.workerId ? 'bg-emerald-100 font-bold' : ''
                                                }`}
                                        >
                                            <span>{worker.workerName}</span>
                                            <span className="text-xs text-slate-500">{worker.teamName}</span>
                                        </button>
                                    ))
                                }
                                {filteredPaymentData.filter(w => {
                                    if (!payslipSearchQuery.trim()) return true;
                                    const query = payslipSearchQuery.toLowerCase();
                                    return w.workerName.toLowerCase().includes(query) ||
                                        w.teamName.toLowerCase().includes(query);
                                }).length === 0 && (
                                        <div className="px-3 py-4 text-center text-slate-400 text-sm">
                                            검색 결과가 없습니다
                                        </div>
                                    )}
                            </div>
                            {selectedPayslipWorker && (
                                <div className="mt-2 text-sm text-emerald-700 font-medium">
                                    ✅ 선택됨: {selectedPayslipWorker.workerName} ({selectedPayslipWorker.teamName})
                                </div>
                            )}
                        </div>

                        {selectedPayslipWorker ? (() => {
                            // 저장된 요율 사용 (없으면 기본값)
                            const insuranceConfig = payrollConfig?.insuranceConfig || {
                                pensionRate: 0.045,
                                healthRate: 0.03545,
                                careRateOfHealth: 0.1295,
                                employmentRate: 0.009
                            };
                            const taxRate = payrollConfig?.taxRate ?? 0.033;

                            // 가불/공제 정보 가져오기
                            const advanceData = advancePaymentsMap.get(selectedPayslipWorker.workerId);
                            const advanceLines = getAdvanceDeductionLines(advanceData);
                            const advanceTotalDeduction = getAdvanceDeductionTotal(advanceData);

                            const grossPay = selectedPayslipWorker.totalAmount;
                            const result = calculatePayrollDeductions({
                                grossPay,
                                insuranceConfig,
                                taxRate,
                                advanceDeduction: advanceTotalDeduction
                            });
                            const pension = result.pension;
                            const health = result.health;
                            const care = result.care;
                            const employment = result.employment;
                            const incomeTax = result.incomeTax;
                            const totalInsurance = result.totalInsurance;
                            const totalDeduction = result.totalDeduction;
                            const netPay = result.netPay;

                            const monthLabel = (() => {
                                const [year, month] = (startDate || '').split('-');
                                return year && month ? `${year}년 ${parseInt(month)}월` : '';
                            })();

                            // 요율을 퍼센트로 표시
                            const pensionPct = (insuranceConfig.pensionRate * 100).toFixed(1);
                            const healthPct = (insuranceConfig.healthRate * 100).toFixed(2);
                            const carePct = (insuranceConfig.careRateOfHealth * 100).toFixed(2);
                            const employmentPct = (insuranceConfig.employmentRate * 100).toFixed(1);
                            const taxPct = (taxRate * 100).toFixed(1);

                            return (
                                <div className="border-2 border-slate-300 rounded-lg overflow-hidden">
                                    {/* 명세서 헤더 */}
                                    <div className="bg-gradient-to-r from-green-600 to-green-700 text-white text-center py-3">
                                        <h2 className="text-xl font-bold">{monthLabel} 노임명세서</h2>
                                    </div>

                                    {/* 사원 정보 */}
                                    <div className="bg-slate-100 border-b border-slate-300">
                                        <div className="text-center py-2 font-bold text-slate-700 border-b border-slate-300">사원 정보</div>
                                        <div className="grid grid-cols-4 text-sm">
                                            <div className="border-r border-b border-slate-300 p-2 text-center font-medium bg-slate-50">직 위</div>
                                            <div className="border-r border-b border-slate-300 p-2 text-center">{selectedPayslipWorker.salaryModel}</div>
                                            <div className="border-r border-b border-slate-300 p-2 text-center font-medium bg-slate-50">성명</div>
                                            <div className="border-b border-slate-300 p-2 text-center font-bold">{selectedPayslipWorker.workerName}</div>
                                        </div>
                                    </div>

                                    {/* 노임 및 공제내역 */}
                                    <div className="text-center py-2 font-bold text-slate-700 border-b border-slate-300 bg-slate-100">노임 및 공제내역</div>
                                    <div className="grid grid-cols-4 text-sm">
                                        <div className="col-span-2 border-r border-b border-slate-300 p-2 text-center font-medium bg-slate-50">근무내역</div>
                                        <div className="col-span-2 border-b border-slate-300 p-2 text-center font-medium bg-slate-50">공제내역</div>
                                    </div>

                                    <div className="grid grid-cols-4 text-sm">
                                        {/* 근무내역 */}
                                        {(() => {
                                            const workRows: Array<{ label: string; value: string; valueClassName?: string }> = [
                                                { label: '공 수', value: selectedPayslipWorker.totalManDay.toFixed(1) },
                                                { label: '단 가', value: selectedPayslipWorker.unitPrice.toLocaleString() },
                                                { label: '본 봉', value: grossPay.toLocaleString(), valueClassName: 'font-bold bg-yellow-50' }
                                            ];

                                            const rowCount = Math.max(workRows.length, advanceLines.length + 1);
                                            return Array.from({ length: rowCount }).map((_, idx) => {
                                                const workRow = workRows[idx];
                                                const advanceLine = advanceLines[idx];
                                                const isSubtotal = idx === advanceLines.length;
                                                const deductLabel = isSubtotal ? '가불/공제 소계' : (advanceLine?.label ?? '');
                                                const deductValue = isSubtotal
                                                    ? (advanceTotalDeduction > 0 ? advanceTotalDeduction.toLocaleString() : '-')
                                                    : (advanceLine ? (advanceLine.amount > 0 ? advanceLine.amount.toLocaleString() : '-') : '');
                                                const isCustom = advanceLine ? !BASE_ADVANCE_DEDUCTION_ITEM_IDS.has(advanceLine.id) : false;

                                                return (
                                                    <React.Fragment key={idx}>
                                                        <div className="border-r border-b border-slate-300 p-2 font-medium bg-slate-50">{workRow?.label ?? ''}</div>
                                                        <div className={`border-r border-b border-slate-300 p-2 text-right ${workRow?.valueClassName ?? ''}`}>{workRow?.value ?? ''}</div>
                                                        <div className={`border-r border-b border-slate-300 p-2 font-medium ${isSubtotal ? 'bg-amber-100 font-bold' : (isCustom ? 'bg-purple-50' : 'bg-amber-50')}`}>{deductLabel}</div>
                                                        <div className={`border-b border-slate-300 p-2 text-right ${isSubtotal ? 'font-bold text-amber-700' : 'text-red-600'}`}>{deductValue}</div>
                                                    </React.Fragment>
                                                );
                                            });
                                        })()}
                                    </div>

                                    {/* 4대보험 영역 */}
                                    <div className="text-center py-2 font-bold text-slate-700 border-b border-slate-300 bg-blue-50">4대보험 및 세금</div>
                                    <div className="grid grid-cols-4 text-sm">
                                        <div className="border-r border-b border-slate-300 p-2 font-medium bg-blue-50">국민연금 ({pensionPct}%)</div>
                                        <div className="border-r border-b border-slate-300 p-2 text-right text-red-600">{pension > 0 ? pension.toLocaleString() : '-'}</div>
                                        <div className="border-r border-b border-slate-300 p-2 font-medium bg-blue-50">건강보험 ({healthPct}%)</div>
                                        <div className="border-b border-slate-300 p-2 text-right text-red-600">{health > 0 ? health.toLocaleString() : '-'}</div>

                                        <div className="border-r border-b border-slate-300 p-2 font-medium bg-blue-50">장기요양 ({carePct}%)</div>
                                        <div className="border-r border-b border-slate-300 p-2 text-right text-red-600">{care > 0 ? care.toLocaleString() : '-'}</div>
                                        <div className="border-r border-b border-slate-300 p-2 font-medium bg-blue-50">고용보험 ({employmentPct}%)</div>
                                        <div className="border-b border-slate-300 p-2 text-right text-red-600">{employment > 0 ? employment.toLocaleString() : '-'}</div>

                                        <div className="border-r border-b border-slate-300 p-2 font-bold bg-blue-100">4대보험 소계</div>
                                        <div className="border-r border-b border-slate-300 p-2 text-right font-bold text-blue-700">{totalInsurance.toLocaleString()}</div>
                                        <div className="border-r border-b border-slate-300 p-2 font-medium bg-orange-50">사업소득세 ({taxPct}%)</div>
                                        <div className="border-b border-slate-300 p-2 text-right text-red-600">{incomeTax.toLocaleString()}</div>
                                    </div>

                                    {/* 합계 영역 */}
                                    <div className="grid grid-cols-4 text-sm border-t-2 border-slate-400">
                                        <div className="col-span-2 border-r border-b border-slate-300 p-3 text-center font-bold bg-slate-100">총 공제금</div>
                                        <div className="col-span-2 border-b border-slate-300 p-3 text-right font-bold text-red-600">{totalDeduction.toLocaleString()}</div>
                                    </div>
                                    <div className="grid grid-cols-4 text-sm">
                                        <div className="col-span-2 border-r border-b border-slate-300 p-3 text-center font-bold bg-slate-100">세후본봉(본봉-총공제금)</div>
                                        <div className="col-span-2 border-b border-slate-300 p-3 text-right font-bold">{netPay.toLocaleString()}</div>
                                    </div>
                                    <div className="grid grid-cols-4 text-sm">
                                        <div className="col-span-2 border-r border-slate-300 p-4 text-center font-bold text-lg bg-green-100">실 지급액</div>
                                        <div className="col-span-2 p-4 text-right font-bold text-xl text-red-600 bg-green-50">{netPay.toLocaleString()}</div>
                                    </div>
                                </div>
                            );
                        })() : (
                            <div className="text-center py-12 text-slate-500">
                                <p className="text-lg mb-2">👆 작업자를 선택해주세요</p>
                                <p className="text-sm">월급제 근로자 {filteredPaymentData.length}명이 조회되었습니다.</p>
                            </div>
                        )}
                    </div>
                    <div className="p-4 border-t border-slate-200 flex justify-between items-center bg-slate-50">
                        <span className="text-sm text-slate-500">총 {filteredPaymentData.length}명 | 4대보험 기준요율 적용</span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => { setShowPayslipPreview(false); setSelectedPayslipWorker(null); }}
                                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                            >
                                닫기
                            </button>
                            <button
                                onClick={() => {
                                    // 전체 월급제 명세서 엑셀 다운로드 (미리보기와 동일한 형태)
                                    const monthLabel = (() => {
                                        const [year, month] = (startDate || '').split('-');
                                        return year && month ? `${year}년 ${parseInt(month)}월` : '';
                                    })();

                                    // 저장된 요율 사용
                                    const insuranceConfig = payrollConfig?.insuranceConfig || {
                                        pensionRate: 0.045,
                                        healthRate: 0.03545,
                                        careRateOfHealth: 0.1295,
                                        employmentRate: 0.009
                                    };
                                    const taxRate = payrollConfig?.taxRate ?? 0.033;

                                    // 요율을 퍼센트로 표시
                                    const pensionPct = (insuranceConfig.pensionRate * 100).toFixed(1);
                                    const healthPct = (insuranceConfig.healthRate * 100).toFixed(2);
                                    const carePct = (insuranceConfig.careRateOfHealth * 100).toFixed(2);
                                    const employmentPct = (insuranceConfig.employmentRate * 100).toFixed(1);
                                    const taxPct = (taxRate * 100).toFixed(1);

                                    // 스타일 정의
                                    const titleStyle = {
                                        font: { bold: true, sz: 16, color: { rgb: 'FFFFFF' } },
                                        fill: { fgColor: { rgb: '2E7D32' }, patternType: 'solid' },
                                        alignment: { horizontal: 'center' as const, vertical: 'center' as const },
                                        border: { top: { style: 'thin' as const }, bottom: { style: 'thin' as const }, left: { style: 'thin' as const }, right: { style: 'thin' as const } }
                                    };
                                    const sectionHeaderStyle = {
                                        font: { bold: true, sz: 11 },
                                        fill: { fgColor: { rgb: 'E0E0E0' }, patternType: 'solid' },
                                        alignment: { horizontal: 'center' as const, vertical: 'center' as const },
                                        border: { top: { style: 'thin' as const }, bottom: { style: 'thin' as const }, left: { style: 'thin' as const }, right: { style: 'thin' as const } }
                                    };
                                    const labelStyle = {
                                        font: { sz: 10 },
                                        fill: { fgColor: { rgb: 'F5F5F5' }, patternType: 'solid' },
                                        alignment: { horizontal: 'center' as const, vertical: 'center' as const },
                                        border: { top: { style: 'thin' as const }, bottom: { style: 'thin' as const }, left: { style: 'thin' as const }, right: { style: 'thin' as const } }
                                    };
                                    const valueStyle = {
                                        font: { sz: 10 },
                                        alignment: { horizontal: 'right' as const, vertical: 'center' as const },
                                        border: { top: { style: 'thin' as const }, bottom: { style: 'thin' as const }, left: { style: 'thin' as const }, right: { style: 'thin' as const } },
                                        numFmt: '#,##0'
                                    };
                                    const deductLabelStyle = {
                                        font: { sz: 10 },
                                        fill: { fgColor: { rgb: 'FFF8E1' }, patternType: 'solid' },
                                        alignment: { horizontal: 'center' as const, vertical: 'center' as const },
                                        border: { top: { style: 'thin' as const }, bottom: { style: 'thin' as const }, left: { style: 'thin' as const }, right: { style: 'thin' as const } }
                                    };
                                    const insuranceLabelStyle = {
                                        font: { sz: 10 },
                                        fill: { fgColor: { rgb: 'E3F2FD' }, patternType: 'solid' },
                                        alignment: { horizontal: 'center' as const, vertical: 'center' as const },
                                        border: { top: { style: 'thin' as const }, bottom: { style: 'thin' as const }, left: { style: 'thin' as const }, right: { style: 'thin' as const } }
                                    };
                                    const totalLabelStyle = {
                                        font: { bold: true, sz: 12 },
                                        fill: { fgColor: { rgb: 'C8E6C9' }, patternType: 'solid' },
                                        alignment: { horizontal: 'center' as const, vertical: 'center' as const },
                                        border: { top: { style: 'medium' as const }, bottom: { style: 'medium' as const }, left: { style: 'thin' as const }, right: { style: 'thin' as const } }
                                    };
                                    const totalValueStyle = {
                                        font: { bold: true, sz: 14, color: { rgb: 'D32F2F' } },
                                        fill: { fgColor: { rgb: 'E8F5E9' }, patternType: 'solid' },
                                        alignment: { horizontal: 'right' as const, vertical: 'center' as const },
                                        border: { top: { style: 'medium' as const }, bottom: { style: 'medium' as const }, left: { style: 'thin' as const }, right: { style: 'thin' as const } },
                                        numFmt: '#,##0'
                                    };

                                    const wb = XLSX.utils.book_new();

                                    // 각 작업자별로 명세서 시트 생성
                                    filteredPaymentData.forEach((worker, idx) => {
                                        const grossPay = worker.totalAmount;
                                        // 가불/공제 정보
                                        const advanceData = advancePaymentsMap.get(worker.workerId);
                                        const advanceLines = getAdvanceDeductionLines(advanceData);
                                        const advanceTotalDeduction = getAdvanceDeductionTotal(advanceData);

                                        const result = calculatePayrollDeductions({
                                            grossPay,
                                            insuranceConfig,
                                            taxRate,
                                            advanceDeduction: advanceTotalDeduction
                                        });
                                        const pension = result.pension;
                                        const health = result.health;
                                        const care = result.care;
                                        const employment = result.employment;
                                        const incomeTax = result.incomeTax;
                                        const totalInsurance = result.totalInsurance;
                                        const totalDeduction = result.totalDeduction;
                                        const netPay = result.netPay;

                                        const wsData: Array<Array<{ v: string | number; s?: unknown }>> = [];

                                        // 1. 제목
                                        wsData.push([{ v: `${monthLabel} 노임명세서`, s: titleStyle }, { v: '', s: titleStyle }, { v: '', s: titleStyle }, { v: '', s: titleStyle }]);
                                        wsData.push([{ v: '' }]);

                                        // 2. 사원 정보
                                        wsData.push([{ v: '사원 정보', s: sectionHeaderStyle }, { v: '', s: sectionHeaderStyle }, { v: '', s: sectionHeaderStyle }, { v: '', s: sectionHeaderStyle }]);
                                        wsData.push([{ v: '직 위', s: labelStyle }, { v: worker.salaryModel || '월급제', s: valueStyle }, { v: '성 명', s: labelStyle }, { v: worker.workerName, s: valueStyle }]);
                                        wsData.push([{ v: '팀', s: labelStyle }, { v: worker.teamName, s: valueStyle }, { v: '', s: labelStyle }, { v: '', s: valueStyle }]);
                                        wsData.push([{ v: '' }]);

                                        // 3. 근무내역 및 가불/공제
                                        wsData.push([{ v: '근무내역', s: sectionHeaderStyle }, { v: '', s: sectionHeaderStyle }, { v: '가불/공제', s: sectionHeaderStyle }, { v: '', s: sectionHeaderStyle }]);
                                        {
                                            const workRows: Array<{ label: string; value: string | number }> = [
                                                { label: '공 수', value: worker.totalManDay },
                                                { label: '단 가', value: worker.unitPrice },
                                                { label: '본 봉', value: grossPay }
                                            ];
                                            const rowCount = Math.max(workRows.length, advanceLines.length + 1);
                                            for (let i = 0; i < rowCount; i++) {
                                                const workRow = workRows[i];
                                                const advanceLine = advanceLines[i];
                                                const isSubtotal = i === advanceLines.length;

                                                const deductLabel = isSubtotal ? '가불 소계' : (advanceLine?.label ?? '');
                                                const deductValue = isSubtotal
                                                    ? advanceTotalDeduction
                                                    : (advanceLine ? (advanceLine.amount || '-') : '');

                                                wsData.push([
                                                    { v: workRow?.label ?? '', s: labelStyle },
                                                    { v: workRow?.value ?? '', s: valueStyle },
                                                    { v: deductLabel, s: isSubtotal ? { ...deductLabelStyle, font: { bold: true, sz: 10 } } : deductLabelStyle },
                                                    { v: deductValue, s: valueStyle }
                                                ]);
                                            }
                                        }
                                        wsData.push([{ v: '' }]);

                                        // 4. 4대보험 및 세금
                                        wsData.push([{ v: '4대보험 및 세금', s: sectionHeaderStyle }, { v: '', s: sectionHeaderStyle }, { v: '', s: sectionHeaderStyle }, { v: '', s: sectionHeaderStyle }]);
                                        wsData.push([{ v: `국민연금 (${pensionPct}%)`, s: insuranceLabelStyle }, { v: pension, s: valueStyle }, { v: `건강보험 (${healthPct}%)`, s: insuranceLabelStyle }, { v: health, s: valueStyle }]);
                                        wsData.push([{ v: `장기요양 (${carePct}%)`, s: insuranceLabelStyle }, { v: care, s: valueStyle }, { v: `고용보험 (${employmentPct}%)`, s: insuranceLabelStyle }, { v: employment, s: valueStyle }]);
                                        wsData.push([{ v: '4대보험 소계', s: { ...insuranceLabelStyle, font: { bold: true, sz: 10 } } }, { v: totalInsurance, s: valueStyle }, { v: `사업소득세 (${taxPct}%)`, s: insuranceLabelStyle }, { v: incomeTax, s: valueStyle }]);
                                        wsData.push([{ v: '' }]);

                                        // 5. 합계
                                        wsData.push([{ v: '총 공제금', s: totalLabelStyle }, { v: '', s: totalLabelStyle }, { v: totalDeduction, s: totalValueStyle }, { v: '', s: totalValueStyle }]);
                                        wsData.push([{ v: '실 지급액', s: totalLabelStyle }, { v: '', s: totalLabelStyle }, { v: netPay, s: totalValueStyle }, { v: '', s: totalValueStyle }]);

                                        const ws = XLSX.utils.aoa_to_sheet(wsData);
                                        ws['!cols'] = [{ wch: 18 }, { wch: 14 }, { wch: 18 }, { wch: 14 }];

                                        // 병합 설정
                                        ws['!merges'] = [
                                            { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }, // 제목
                                            { s: { r: 2, c: 0 }, e: { r: 2, c: 3 } }, // 사원 정보 섹션
                                            { s: { r: 6, c: 0 }, e: { r: 6, c: 1 } }, // 근무내역 섹션
                                            { s: { r: 6, c: 2 }, e: { r: 6, c: 3 } }, // 가불/공제 섹션
                                        ];

                                        // 시트 이름 (최대 31자)
                                        const sheetName = `${idx + 1}_${worker.workerName}`.slice(0, 31);
                                        XLSX.utils.book_append_sheet(wb, ws, sheetName);
                                    });

                                    XLSX.writeFile(wb, `월급제_노임명세서_${startDate}_${endDate}.xlsx`);
                                    setShowPayslipPreview(false);
                                }}
                                disabled={filteredPaymentData.length === 0}
                                className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-bold flex items-center gap-2 disabled:opacity-50"
                            >
                                <FontAwesomeIcon icon={faFileExcel} />
                                전체 명세서 다운로드
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )
    }
    </div>
    );
};

export default TeamBasedPaymentDraftPage;
