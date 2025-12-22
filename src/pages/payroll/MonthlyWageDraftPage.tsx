import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { dailyReportService } from '../../services/dailyReportService';
import { manpowerService, Worker } from '../../services/manpowerService';
import { teamService, Team } from '../../services/teamService';
import { companyService, Company } from '../../services/companyService';
import { siteService, Site } from '../../services/siteService';
import { advancePaymentService, AdvancePayment } from '../../services/advancePaymentService';
import { payrollConfigService, PayrollDeductionItem } from '../../services/payrollConfigService';
import * as XLSX from 'xlsx-js-style';
import html2canvas from 'html2canvas';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faChevronRight, faEye, faEyeSlash, faFileExcel, faSearch, faSpinner, faExclamationTriangle, faCalendarAlt, faCalendarDays, faCopy } from '@fortawesome/free-solid-svg-icons';

interface WorkerWorkEntry {
    date: string;
    siteName: string;
    manDay: number;
    unitPrice: number;
    description?: string;
}

interface DeductionLine {
    label: string;
    amount: number;
}

interface DeductionBreakdown {
    standardLines: DeductionLine[];
    additionalLines: DeductionLine[];
    totalStandard: number;
    totalAdditional: number;
    total: number;
    hasData: boolean;
}

interface PaymentData {
    workerId: string;
    workerName: string;
    idNumber: string;
    companyId: string;
    companyName: string;
    teamId: string;
    teamName: string;
    month: string;
    totalManDay: number;
    unitPrice: number;
    grossAmount: number;
    totalDeduction: number;
    totalAmount: number;
    bankName: string;
    bankCode: string;
    accountNumber: string;
    accountHolder: string;
    displayContent: string;
    workEntries: WorkerWorkEntry[];
    deductionBreakdown: DeductionBreakdown;
    isValid: boolean;
    errors: {
        bankName?: boolean;
        bankCode?: boolean;
        accountNumber?: boolean;
        accountHolder?: boolean;
    };
}

const BANK_CODES: { [key: string]: string } = {
    // 은행
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

    // 저축은행 (개별)
    '대신저축은행': '102',
    'SBI저축은행': '103', 'SBI': '103',
    'HK저축은행': '104',
    '웰컴저축은행': '105', '웰컴': '105',
    '신한저축은행': '106',

    // 증권사
    '유안타증권': '209', '유안타': '209',
    'KB증권': '218',
    '상상인증권': '221',
    '한양증권': '222',
    '리딩투자증권': '223', '리딩': '223',
    'BNK투자증권': '224',
    'IBK투자증권': '225',
    '다올투자증권': '227', '다올증권': '227',
    '미래에셋증권': '238', '미래에셋': '238',
    '삼성증권': '240', '삼성': '240',
    '한국투자증권': '243', '한투': '243',
    'NH투자증권': '247', 'NH증권': '247',
    '교보증권': '261', '교보': '261',
    '하이투자증권': '262', '아이엠증권': '262', '하이증권': '262',
    '현대차증권': '263', '현대증권': '263',
    '키움증권': '264', '키움': '264',
    '이베스트투자증권': '265', 'LS증권': '265', '이베스트': '265',
    'SK증권': '266',
    '대신증권': '267', '대신': '267',
    '한화투자증권': '269', '한화증권': '269',
    '하나증권': '270',
    '토스증권': '271',
    'NH선물': '272',
    '코리아에셋투자증권': '273',
    'DS투자증권': '274',
    '흥국증권': '275',
    '유화증권': '276',
    '에스아이증권': '277',
    '신한투자증권': '278', '신한증권': '278',
    'DB금융투자': '279', 'DB증권': '279',
    '유진투자증권': '280', '유진증권': '280',
    '메리츠증권': '287', '메리츠': '287',
    '카카오페이증권': '288',
    '부국증권': '290',
    '신영증권': '291',
};

type AdvancePaymentStandardField =
    | 'prevMonthCarryover'
    | 'accommodation'
    | 'privateRoom'
    | 'gloves'
    | 'deposit'
    | 'fines'
    | 'electricity'
    | 'gas'
    | 'internet'
    | 'water';

const STANDARD_DEDUCTION_FIELDS: Array<{ key: AdvancePaymentStandardField; label: string }> = [
    { key: 'prevMonthCarryover', label: '전월 이월' },
    { key: 'accommodation', label: '숙소비' },
    { key: 'privateRoom', label: '개인방' },
    { key: 'gloves', label: '장갑' },
    { key: 'deposit', label: '보증금' },
    { key: 'fines', label: '과태료' },
    { key: 'electricity', label: '전기료' },
    { key: 'gas', label: '도시가스' },
    { key: 'internet', label: '인터넷' },
    { key: 'water', label: '수도세' },
];

const buildStandardDeductionLabelMap = (): Record<string, string> =>
    STANDARD_DEDUCTION_FIELDS.reduce<Record<string, string>>((acc, { key, label }) => {
        acc[key] = label;
        return acc;
    }, {});

const buildDeductionLabelMapFromConfig = (items?: PayrollDeductionItem[]): Record<string, string> => {
    const base = buildStandardDeductionLabelMap();
    (items ?? []).forEach((item) => {
        const safeId = item.id?.trim();
        if (!safeId) return;
        const safeLabel = item.label?.trim();
        base[safeId] = safeLabel && safeLabel.length > 0 ? safeLabel : safeId;
    });
    return base;
};

const createEmptyDeductionBreakdown = (): DeductionBreakdown => ({
    standardLines: [],
    additionalLines: [],
    totalStandard: 0,
    totalAdditional: 0,
    total: 0,
    hasData: false,
});

const toNumber = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

const deduplicateAdvanceRecords = (records: AdvancePayment[]): AdvancePayment[] => {
    const map = new Map<string, AdvancePayment>();
    records.forEach((record) => {
        const teamKey = (record.teamId ?? '').trim() || '__no_team__';
        const currentScore = toNumber(record.totalDeduction);
        const prev = map.get(teamKey);
        const prevScore = toNumber(prev?.totalDeduction);
        if (!prev || currentScore >= prevScore) {
            map.set(teamKey, record);
        }
    });
    return Array.from(map.values());
};

const buildDeductionBreakdownFromRecords = (
    records: AdvancePayment[],
    deductionLabelMap: Record<string, string> = {}
): DeductionBreakdown => {
    if (!records || records.length === 0) {
        return createEmptyDeductionBreakdown();
    }

    const deduped = deduplicateAdvanceRecords(records);

    const standardLines: DeductionLine[] = [];
    STANDARD_DEDUCTION_FIELDS.forEach(({ key, label }) => {
        const sum = deduped.reduce((acc, record) => acc + toNumber(record[key]), 0);
        if (sum > 0) {
            standardLines.push({ label, amount: sum });
        }
    });

    const additionalTotals = new Map<string, number>();
    deduped.forEach((record) => {
        Object.entries(record.items ?? {}).forEach(([itemLabel, rawAmount]) => {
            const amount = toNumber(rawAmount);
            if (amount <= 0) return;
            additionalTotals.set(itemLabel, (additionalTotals.get(itemLabel) ?? 0) + amount);
        });
    });

    const additionalLines: DeductionLine[] = Array.from(additionalTotals.entries())
        .map(([labelKey, amount]) => {
            const friendlyLabel = deductionLabelMap[labelKey] ?? labelKey;
            return { label: friendlyLabel, amount };
        })
        .sort((a, b) => b.amount - a.amount);

    const totalStandard = standardLines.reduce((sum, line) => sum + line.amount, 0);
    const totalAdditional = additionalLines.reduce((sum, line) => sum + line.amount, 0);
    const total = totalStandard + totalAdditional;

    return {
        standardLines,
        additionalLines,
        totalStandard,
        totalAdditional,
        total,
        hasData: total > 0,
    };
};

interface Props {
    hideHeader?: boolean;
}

const MonthlyWagePaymentPage: React.FC<Props> = ({ hideHeader }) => {
    const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [paymentData, setPaymentData] = useState<PaymentData[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [bulkDisplayContent, setBulkDisplayContent] = useState<string>('월급');
    const [bulkSender, setBulkSender] = useState<string>('㈜다원'); // 보내는사람
    const [errorCount, setErrorCount] = useState<number>(0);
    const [showKBPreview, setShowKBPreview] = useState<boolean>(false); // 국민은행용 미리보기
    const [showPayslipModal, setShowPayslipModal] = useState<boolean>(false);
    const [selectedPayslipWorkerId, setSelectedPayslipWorkerId] = useState<string>(''); // 
    const [showBankCodes, setShowBankCodes] = useState<boolean>(false); // 은행코드표
    const [showAccountColumns, setShowAccountColumns] = useState<boolean>(false);
    const [teams, setTeams] = useState<Team[]>([]);
    const [allTeams, setAllTeams] = useState<Team[]>([]);
    const [allWorkers, setAllWorkers] = useState<Worker[]>([]);
    const [allSites, setAllSites] = useState<Site[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [selectedTeamId, setSelectedTeamId] = useState<string>('');
    const [selectedWorkerId, setSelectedWorkerId] = useState<string>('');
    const [filtersReady, setFiltersReady] = useState<boolean>(false);
    const [deductionLabelMap, setDeductionLabelMap] = useState<Record<string, string>>(buildStandardDeductionLabelMap());
    const [copying, setCopying] = useState(false);
    const printRef = useRef<HTMLDivElement>(null);

    // --- Copy Logic ---
    const handleCopyToClipboard = async () => {
        if (!printRef.current) return;
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

    const currentYearMonth = useMemo(() => getYearMonthFromDate(new Date()), [getYearMonthFromDate]);
    const prevYearMonth = useMemo(() => shiftYearMonth(currentYearMonth, -1), [currentYearMonth, shiftYearMonth]);

    const tableColSpan = showAccountColumns ? 14 : 10;

    const filteredPaymentData = useMemo(() => {
        if (!selectedWorkerId) return paymentData;
        return paymentData.filter((item) => item.workerId === selectedWorkerId);
    }, [paymentData, selectedWorkerId]);

    const payslipTarget = useMemo(() => {
        if (filteredPaymentData.length === 0) return null;
        const targetId = selectedPayslipWorkerId || filteredPaymentData[0].workerId;
        const target = filteredPaymentData.find((item) => item.workerId === targetId) ?? filteredPaymentData[0];
        return target;
    }, [filteredPaymentData, selectedPayslipWorkerId]);

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const [fetchedTeams, fetchedWorkers, fetchedCompanies] = await Promise.all([
                    teamService.getTeams(),
                    manpowerService.getWorkers(),
                    companyService.getCompanies(),
                ]);

                setAllTeams(fetchedTeams);
                setAllWorkers(fetchedWorkers);
                setCompanies(fetchedCompanies);
            } catch (error) {
                console.error('Failed to load initial data:', error);
                alert('초기 데이터를 불러오는 중 오류가 발생했습니다.');
            } finally {
                setFiltersReady(true);
            }
        };

        void fetchInitialData();
    }, []);

    useEffect(() => {
        let mounted = true;
        const loadPayrollConfig = async () => {
            try {
                const config = await payrollConfigService.getConfig();
                if (!mounted) return;
                setDeductionLabelMap(buildDeductionLabelMapFromConfig(config?.deductionItems));
            } catch (error) {
                console.error('Failed to load payroll deduction config:', error);
            }
        };

        void loadPayrollConfig();
        return () => {
            mounted = false;
        };
    }, []);

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

        if (selectedTeamId && !filtered.some((t) => t.id === selectedTeamId)) {
            setSelectedTeamId('');
        }
    }, [allTeams, companies, constructionCompanyIds, normalizeTeamName, selectedTeamId]);

    useEffect(() => {
        setSelectedWorkerId('');
    }, [selectedTeamId]);

    const monthlyWorkersForSelectedTeam = useMemo(() => {
        if (!selectedTeamId) return [] as Worker[];

        const selectedTeamNameNormalized = normalizeTeamName(allTeams.find((t) => t.id === selectedTeamId)?.name);
        const allowedTeamIds = new Set<string>();
        allowedTeamIds.add(selectedTeamId);
        allTeams.forEach((team) => {
            if (!team.id) return;
            if (team.parentTeamId === selectedTeamId) {
                allowedTeamIds.add(team.id);
                return;
            }
            if (selectedTeamNameNormalized) {
                const parentNameNormalized = normalizeTeamName(team.parentTeamName);
                if (parentNameNormalized && parentNameNormalized === selectedTeamNameNormalized) {
                    allowedTeamIds.add(team.id);
                }
            }
        });

        return allWorkers
            .filter((worker) => {
                const salaryModel = normalizeValue(worker.salaryModel ?? worker.payType);
                if (salaryModel !== '월급제') return false;
                const workerTeamId = (worker.teamId ?? '').trim();
                return workerTeamId ? allowedTeamIds.has(workerTeamId) : false;
            })
            .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'ko'));
    }, [allTeams, allWorkers, normalizeTeamName, normalizeValue, selectedTeamId]);

    const validateItem = useCallback((item: Partial<PaymentData>): { isValid: boolean, errors: PaymentData['errors'] } => {
        const errors: PaymentData['errors'] = {};
        let isValid = true;

        if (!item.bankName) {
            errors.bankName = true;
            isValid = false;
        }
        if (!item.bankCode && item.bankName) {
            if (!BANK_CODES[item.bankName]) {
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
    }, []);

    const fetchData = useCallback(async () => {
        if (!selectedMonth) return;

        setLoading(true);
        try {
            const [yearStr, monthStr] = selectedMonth.split('-');
            const year = Number(yearStr);
            const month = Number(monthStr);
            const startDate = `${selectedMonth}-01`;
            const lastDay = new Date(year, month, 0).getDate();
            const endDate = `${selectedMonth}-${String(lastDay).padStart(2, '0')}`;

            const monthlyReports = await dailyReportService.getReportsByRange(startDate, endDate);

            const advances = await advancePaymentService.getAdvancePaymentsByYearMonth(year, month);
            const advanceByWorkerTeamKey = new Map<string, AdvancePayment[]>();
            const advanceListByWorkerId = new Map<string, AdvancePayment[]>();
            advances.forEach((item) => {
                const workerId = (item.workerId ?? '').trim();
                const teamId = (item.teamId ?? '').trim();
                if (!workerId) return;
                if (teamId) {
                    const listByTeam = advanceByWorkerTeamKey.get(`${workerId}__${teamId}`) ?? [];
                    listByTeam.push(item);
                    advanceByWorkerTeamKey.set(`${workerId}__${teamId}`, listByTeam);
                }
                const list = advanceListByWorkerId.get(workerId) ?? [];
                list.push(item);
                advanceListByWorkerId.set(workerId, list);
            });

            const workers = allWorkers.length > 0 ? allWorkers : await manpowerService.getWorkers();
            if (allWorkers.length === 0) {
                setAllWorkers(workers);
            }
            const workerMap = new Map<string, Worker>();
            workers.forEach(w => {
                if (w.id) workerMap.set(w.id, w);
            });

            const sites = allSites.length > 0 ? allSites : await siteService.getSites();
            if (allSites.length === 0) {
                setAllSites(sites);
            }
            const siteMap = new Map<string, Site>();
            sites.forEach(s => {
                if (s.id) siteMap.set(s.id, s);
            });

            const teamMap = new Map<string, Team>();
            allTeams.forEach(t => {
                if (t.id) teamMap.set(t.id, t);
            });

            const allowedTeamIds = (() => {
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
            })();

            const allowedTeamNameNormalized = (() => {
                if (!allowedTeamIds) return null;

                const names = new Set<string>();
                allTeams.forEach(team => {
                    if (!team.id) return;
                    if (!allowedTeamIds.has(team.id)) return;
                    const normalized = normalizeTeamName(team.name ?? '');
                    if (normalized) names.add(normalized);
                });

                return names;
            })();

            type WorkerAggregate = {
                workerId: string;
                companyId: string;
                companyName: string;
                manDay: number;
                teamId: string;
                teamName: string;
                totalAmount: number;
                unitPrices: number[];
                workEntries: WorkerWorkEntry[];
            };
            const workerAggregates: Record<string, WorkerAggregate> = {};

            monthlyReports.forEach(report => {
                const reportSite = siteMap.get(report.siteId);

                const resolvedReportTeamIdFromName = (() => {
                    const normalized = normalizeTeamName(report.teamName ?? '');
                    if (!normalized) return '';
                    const matched = allTeams.find(t => normalizeTeamName(t.name ?? '') === normalized);
                    return matched?.id ?? '';
                })();

                const reportTeamId = report.teamId || resolvedReportTeamIdFromName;
                const reportTeamName = report.teamName || teamMap.get(reportTeamId)?.name || '';

                report.workers.forEach(reportWorker => {
                    const workerDetails = workerMap.get(reportWorker.workerId);
                    if (!workerDetails) return;

                    const snapshotSalaryModel =
                        typeof reportWorker.salaryModel === 'string' && reportWorker.salaryModel.trim().length > 0
                            ? reportWorker.salaryModel
                            : typeof reportWorker.payType === 'string' && reportWorker.payType.trim().length > 0
                                ? reportWorker.payType
                                : workerDetails.salaryModel;

                    if (snapshotSalaryModel !== '월급제') return;

                    if (selectedTeamId && allowedTeamIds) {
                        const workerTeamId = (workerDetails.teamId ?? '').trim();
                        if (!workerTeamId || !allowedTeamIds.has(workerTeamId)) {
                            return;
                        }
                    }

                    const resolvedTeamIdFromName = (() => {
                        const normalized = normalizeTeamName(reportTeamName);
                        if (!normalized) return '';
                        const matched = allTeams.find(t => normalizeTeamName(t.name ?? '') === normalized);
                        return matched?.id ?? '';
                    })();

                    const resolvedTeamId = (workerDetails.teamId ?? '').trim() || reportTeamId || resolvedTeamIdFromName || reportWorker.teamId || '';
                    const resolvedTeamName = (workerDetails.teamName ?? '').trim() || reportTeamName || teamMap.get(resolvedTeamId)?.name || '';

                    const safeTeamKey = resolvedTeamId || (normalizeTeamName(resolvedTeamName) ? `unresolved:${normalizeTeamName(resolvedTeamName)}` : 'no-team');
                    const aggregateKey = `${reportWorker.workerId}__${safeTeamKey}`;

                    if (!workerAggregates[aggregateKey]) {
                        workerAggregates[aggregateKey] = {
                            workerId: reportWorker.workerId,
                            companyId: workerDetails.companyId || teamMap.get(resolvedTeamId)?.companyId || report.companyId || reportSite?.constructorCompanyId || '',
                            companyName: workerDetails.companyName || teamMap.get(resolvedTeamId)?.companyName || report.companyName || '',
                            manDay: 0,
                            teamId: safeTeamKey,
                            teamName: resolvedTeamName,
                            totalAmount: 0,
                            unitPrices: [],
                            workEntries: []
                        };
                    }
                    const snapshotUnitPrice = reportWorker.unitPrice ?? workerDetails.unitPrice ?? 0;
                    workerAggregates[aggregateKey].manDay += reportWorker.manDay;
                    workerAggregates[aggregateKey].totalAmount += reportWorker.manDay * snapshotUnitPrice;
                    if (!workerAggregates[aggregateKey].unitPrices.includes(snapshotUnitPrice)) {
                        workerAggregates[aggregateKey].unitPrices.push(snapshotUnitPrice);
                    }
                    workerAggregates[aggregateKey].workEntries.push({
                        date: report.date,
                        siteName: report.siteName || reportSite?.name || '-',
                        manDay: reportWorker.manDay,
                        unitPrice: snapshotUnitPrice,
                        description: reportWorker.workContent || report.workContent || ''
                    });
                });
            });

            const processedData: PaymentData[] = [];
            let errCount = 0;

            Object.keys(workerAggregates).forEach(key => {
                const agg = workerAggregates[key];
                const workerDetails = workerMap.get(agg.workerId);

                if (workerDetails) {
                    const grossAmount = agg.totalAmount;
                    const unitPrice = agg.unitPrices.length === 1
                        ? agg.unitPrices[0]
                        : (agg.manDay > 0 ? Math.round(grossAmount / agg.manDay) : (workerDetails.unitPrice || 0));
                    const bankName = workerDetails.bankName || '';
                    const bankCode = BANK_CODES[bankName] || '';
                    const accountNumber = workerDetails.accountNumber || '';
                    const accountHolder = workerDetails.accountHolder || '';

                    const canonicalTeamId = (() => {
                        const raw = (agg.teamId ?? '').trim();
                        if (!raw) return (workerDetails.teamId ?? '').trim();
                        if (raw.startsWith('unresolved:') || raw === 'no-team') {
                            return (workerDetails.teamId ?? '').trim();
                        }
                        return raw;
                    })();

                    const advanceRecords = (() => {
                        if (canonicalTeamId) {
                            const primaryList = advanceByWorkerTeamKey.get(`${agg.workerId}__${canonicalTeamId}`) ?? [];
                            if (primaryList.length > 0) return primaryList;
                        }
                        return advanceListByWorkerId.get(agg.workerId) ?? [];
                    })();

                    const deductionBreakdown = buildDeductionBreakdownFromRecords(advanceRecords, deductionLabelMap);
                    const totalDeduction = deductionBreakdown.total;
                    const netAmount = grossAmount - totalDeduction;

                    const validation = validateItem({ bankName, bankCode, accountNumber, accountHolder });
                    if (!validation.isValid) errCount++;

                    processedData.push({
                        workerId: agg.workerId,
                        workerName: workerDetails.name,
                        idNumber: workerDetails.idNumber,
                        companyId: agg.companyId,
                        companyName: agg.companyName,
                        teamId: agg.teamId,
                        teamName: agg.teamName,
                        month: selectedMonth,
                        totalManDay: agg.manDay,
                        unitPrice: unitPrice,
                        grossAmount,
                        totalDeduction,
                        totalAmount: netAmount,
                        bankName: bankName,
                        bankCode: bankCode,
                        accountNumber: accountNumber,
                        accountHolder: accountHolder,
                        displayContent: '월급',
                        workEntries: agg.workEntries.sort((a, b) => a.date.localeCompare(b.date)),
                        deductionBreakdown,
                        isValid: validation.isValid,
                        errors: validation.errors
                    });
                }
            });

            setPaymentData(processedData);
            setErrorCount(errCount);

        } catch (error) {
            console.error("Error fetching payment data:", error);
            alert("데이터를 불러오는 중 오류가 발생했습니다.");
        } finally {
            setLoading(false);
        }
    }, [allSites, allTeams, allWorkers, deductionLabelMap, normalizeTeamName, selectedMonth, selectedTeamId, validateItem]);

    useEffect(() => {
        if (!filtersReady) return;
        void fetchData();
    }, [fetchData, filtersReady]);

    const handleDisplayContentChange = (workerId: string, teamId: string, value: string) => {
        setPaymentData(prev => prev.map(item => {
            if (item.workerId !== workerId) return item;
            if (item.teamId !== teamId) return item;
            return { ...item, displayContent: value };
        }));
    };

    const handleBulkDisplayContentApply = () => {
        const visibleKeys = new Set(filteredPaymentData.map(item => `${item.workerId}__${item.teamId}`));
        setPaymentData(prev => prev.map(item => {
            const key = `${item.workerId}__${item.teamId}`;
            if (!visibleKeys.has(key)) return item;
            return { ...item, displayContent: bulkDisplayContent };
        }));
    };

    // 국민은행용 엑셀 다운로드 (연두색 스타일 적용)
    const handleDownloadKBExcel = () => {
        if (filteredPaymentData.length === 0) {
            alert("출력할 데이터가 없습니다.");
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

        const rowData: (string | number)[][] = filteredPaymentData.map(item => [
            item.bankCode,
            item.accountNumber,
            item.totalAmount,
            '㈜다원',
            `${item.workerName} 가불`
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
                if (C === 2) {
                    cell.s = greenNumberStyle;
                    cell.t = 'n';
                } else {
                    cell.s = greenStyle;
                }
            }
        }

        // 열 너비 설정
        ws['!cols'] = [
            { wch: 8 },  // A: 은행코드
            { wch: 20 }, // B: 계좌번호
            { wch: 15 }, // C: 이체금액
            { wch: 12 }, // D: 받는분 통장 표시
            { wch: 18 }, // E: 내 통장 메모
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "국민은행용");

        const fileName = `월급제_국민은행용_${selectedMonth}.xlsx`;
        XLSX.writeFile(wb, fileName);
    };

    const getKBPreviewData = () => {
        return filteredPaymentData.map(item => ({
            은행코드: item.bankCode,
            계좌번호: item.accountNumber,
            이체금액: item.totalAmount,
            받는분통장표시: '㈜다원',
            내통장메모: `${item.workerName} 가불`
        }));
    };


    const handleDownloadIndividualPayslip = useCallback(() => {
        if (!payslipTarget) return;

        const workEntries = payslipTarget.workEntries ?? [];
        const deductionBreakdown = payslipTarget.deductionBreakdown ?? createEmptyDeductionBreakdown();
        const combinedDeductions = [...deductionBreakdown.standardLines, ...deductionBreakdown.additionalLines];

        const rows: (string | number)[][] = [];
        const merges: XLSX.Range[] = [];
        const pushRow = (row: (string | number)[]) => {
            rows.push(row);
            return rows.length - 1;
        };

        const titleRow = pushRow(['월급제 노임명세서', '', '', '', '', '']);
        merges.push({ s: { r: titleRow, c: 0 }, e: { r: titleRow, c: 5 } });
        pushRow([]);
        pushRow(['성명', payslipTarget.workerName, '팀', payslipTarget.teamName, '지급월', selectedMonth]);
        pushRow([
            '주민등록번호',
            payslipTarget.idNumber || '-',
            '시공사',
            payslipTarget.companyName || '-',
            '은행',
            payslipTarget.bankName || '-',
        ]);
        pushRow([
            '총 공수',
            Number(payslipTarget.totalManDay.toFixed(1)),
            '지급전',
            payslipTarget.grossAmount,
            '실지급',
            payslipTarget.totalAmount,
        ]);
        pushRow([]);

        const dualSectionRow = pushRow(['근무내역', '', '', '', '공제내역', '']);
        merges.push({ s: { r: dualSectionRow, c: 0 }, e: { r: dualSectionRow, c: 2 } });
        merges.push({ s: { r: dualSectionRow, c: 4 }, e: { r: dualSectionRow, c: 5 } });

        const tableHeaderRow = pushRow(['일자', '현장', '공수', '단가', '항목', '금액']);
        const maxRows = Math.max(workEntries.length, combinedDeductions.length, 1);
        for (let i = 0; i < maxRows; i += 1) {
            const workEntry = workEntries[i];
            const deductionEntry = combinedDeductions[i];
            rows.push([
                workEntry ? workEntry.date : '',
                workEntry ? workEntry.siteName : '',
                workEntry ? Number(workEntry.manDay.toFixed(1)) : '',
                workEntry ? workEntry.unitPrice : '',
                deductionEntry ? deductionEntry.label : i === 0 && combinedDeductions.length === 0 ? '등록된 공제 항목이 없습니다.' : '',
                deductionEntry ? deductionEntry.amount : '',
            ]);
        }

        const workSummaryRow = pushRow([
            '근무 합계',
            '',
            Number(workEntries.reduce((sum, entry) => sum + entry.manDay, 0).toFixed(1)),
            payslipTarget.grossAmount,
            '총 공제금',
            payslipTarget.totalDeduction,
        ]);
        pushRow([]);
        const netRow = pushRow(['실 지급액', payslipTarget.totalAmount, '', '', '', '']);

        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws['!merges'] = merges;
        ws['!cols'] = [
            { wch: 16 },
            { wch: 22 },
            { wch: 14 },
            { wch: 18 },
            { wch: 14 },
            { wch: 18 },
        ];

        const applyStyle = (rowIndex: number, colIndex: number, style: XLSX.CellObject['s']) => {
            const cellAddress = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
            if (!ws[cellAddress]) return;
            ws[cellAddress].s = style;
        };

        const titleStyle: XLSX.CellObject['s'] = {
            font: { bold: true, sz: 16, color: { rgb: 'FFFFFF' } },
            alignment: { horizontal: 'center', vertical: 'center' },
            fill: { fgColor: { rgb: '6B21A8' } },
        };
        applyStyle(titleRow, 0, titleStyle);

        const infoKeyStyle: XLSX.CellObject['s'] = {
            font: { bold: true, color: { rgb: '475569' } },
            alignment: { horizontal: 'left', vertical: 'center' },
            fill: { fgColor: { rgb: 'F8FAFC' } },
        };
        const infoValueStyle: XLSX.CellObject['s'] = {
            alignment: { horizontal: 'left', vertical: 'center' },
        };
        const infoRows = [2, 3, 4];
        infoRows.forEach((rowIdx) => {
            [0, 2, 4].forEach((colIdx) => applyStyle(rowIdx, colIdx, infoKeyStyle));
            [1, 3, 5].forEach((colIdx) => applyStyle(rowIdx, colIdx, infoValueStyle));
        });

        const sectionHeaderStyle: XLSX.CellObject['s'] = {
            font: { bold: true, color: { rgb: '4338CA' } },
            alignment: { horizontal: 'left', vertical: 'center' },
            fill: { fgColor: { rgb: 'EEF2FF' } },
        };
        [0, 4].forEach((colIdx) => applyStyle(dualSectionRow, colIdx, sectionHeaderStyle));

        const tableHeaderStyle: XLSX.CellObject['s'] = {
            font: { bold: true, color: { rgb: '475569' } },
            alignment: { horizontal: 'center', vertical: 'center' },
            fill: { fgColor: { rgb: 'E2E8F0' } },
            border: {
                top: { style: 'thin', color: { rgb: 'CBD5F5' } },
                bottom: { style: 'thin', color: { rgb: 'CBD5F5' } },
                left: { style: 'thin', color: { rgb: 'CBD5F5' } },
                right: { style: 'thin', color: { rgb: 'CBD5F5' } },
            },
        };
        [0, 1, 2, 3, 4, 5].forEach((colIdx) => applyStyle(tableHeaderRow, colIdx, tableHeaderStyle));

        const numberStyle: XLSX.CellObject['s'] = {
            alignment: { horizontal: 'right', vertical: 'center' },
            numFmt: '#,##0.0',
        };
        const currencyStyle: XLSX.CellObject['s'] = {
            alignment: { horizontal: 'right', vertical: 'center' },
            numFmt: '#,##0',
        };

        for (let i = 0; i < maxRows; i += 1) {
            const rowIdx = tableHeaderRow + 1 + i;
            applyStyle(rowIdx, 2, numberStyle);
            applyStyle(rowIdx, 3, currencyStyle);
            applyStyle(rowIdx, 5, currencyStyle);
        }
        applyStyle(workSummaryRow, 2, numberStyle);
        applyStyle(workSummaryRow, 3, currencyStyle);
        applyStyle(workSummaryRow, 5, currencyStyle);

        const summaryStyle: XLSX.CellObject['s'] = {
            font: { bold: true },
            alignment: { horizontal: 'left', vertical: 'center' },
        };
        applyStyle(workSummaryRow, 0, summaryStyle);
        applyStyle(workSummaryRow, 4, summaryStyle);
        applyStyle(netRow, 0, summaryStyle);
        applyStyle(netRow, 1, currencyStyle);

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, '노임명세서');
        const safeName = (payslipTarget.workerName || 'worker').replace(/[\\/:*?"<>|]/g, '_');
        XLSX.writeFile(wb, `노임명세서_${safeName}_${selectedMonth}.xlsx`);
    }, [payslipTarget, selectedMonth]);

    return (
        <div className="p-6 max-w-[1600px] w-full mx-auto">
            {!hideHeader && (
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm px-6 py-4 mb-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-rose-100 text-rose-600 p-2 rounded-xl">
                            <FontAwesomeIcon icon={faCalendarDays} className="text-xl" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-800">월급제</h1>
                            <p className="text-sm text-slate-500 mt-1">월별 공수·단가·공제를 한 화면에서 검토하고 엑셀 출력까지 진행합니다.</p>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 mb-6">
                <div className="flex flex-wrap gap-3 items-center justify-between">
                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 shadow-sm">
                        <button
                            type="button"
                            onClick={() => setSelectedMonth(shiftYearMonth(selectedMonth, -1))}
                            className="px-2 py-1.5 text-slate-500 hover:text-slate-900 rounded-md transition"
                            title="이전 달"
                        >
                            <FontAwesomeIcon icon={faChevronLeft} />
                        </button>
                        <FontAwesomeIcon icon={faCalendarAlt} className="text-slate-400" />
                        <input
                            type="month"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="text-sm outline-none bg-transparent"
                        />
                        <button
                            type="button"
                            onClick={() => setSelectedMonth(shiftYearMonth(selectedMonth, 1))}
                            className="px-2 py-1.5 text-slate-500 hover:text-slate-900 rounded-md transition"
                            title="다음 달"
                        >
                            <FontAwesomeIcon icon={faChevronRight} />
                        </button>
                    </div>

                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => setSelectedMonth(prevYearMonth)}
                            className="px-3 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-sm font-semibold transition"
                            title="전달 이동"
                        >
                            전달
                        </button>
                        <button
                            type="button"
                            onClick={() => setSelectedMonth(currentYearMonth)}
                            className="px-3 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-sm font-semibold transition"
                            title="현재월 이동"
                        >
                            이달
                        </button>
                    </div>

                    <select
                        value={selectedTeamId}
                        onChange={(e) => setSelectedTeamId(e.target.value)}
                        className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                    >
                        <option value="">팀전체</option>
                        {teams
                            .filter((team): team is Team & { id: string } => typeof team.id === 'string' && team.id.trim().length > 0)
                            .map(team => (
                                <option key={team.id} value={team.id}>{team.name}</option>
                            ))}
                    </select>

                    <select
                        value={selectedWorkerId}
                        onChange={(e) => setSelectedWorkerId(e.target.value)}
                        disabled={!selectedTeamId}
                        className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <option value="">월급개인</option>
                        {monthlyWorkersForSelectedTeam
                            .filter((worker): worker is Worker & { id: string } => typeof worker.id === 'string' && worker.id.trim().length > 0)
                            .map(worker => (
                                <option key={worker.id} value={worker.id}>
                                    {worker.name}
                                </option>
                            ))}
                    </select>

                    <div className="flex items-center gap-2 bg-white border border-slate-300 rounded-lg px-3 py-2 shadow-sm">
                        <span className="text-xs text-slate-500">보내는사람</span>
                        <input
                            type="text"
                            value={bulkSender}
                            onChange={(e) => setBulkSender(e.target.value)}
                            className="text-sm outline-none w-24"
                            placeholder="㈜다원"
                        />
                    </div>

                    <button
                        type="button"
                        onClick={() => setShowAccountColumns(prev => !prev)}
                        className="px-3 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-sm font-semibold transition flex items-center gap-2"
                    >
                        <FontAwesomeIcon icon={showAccountColumns ? faEyeSlash : faEye} />
                        {showAccountColumns ? '계좌 숨기기' : '계좌 보기'}
                    </button>

                    <div className="flex gap-2">
                        <button
                            onClick={fetchData}
                            className="bg-slate-100 text-slate-600 hover:bg-slate-200 px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2"
                        >
                            <FontAwesomeIcon icon={faSearch} />
                            <span>조회</span>
                        </button>
                        <button
                            onClick={() => setShowKBPreview(true)}
                            disabled={paymentData.length === 0}
                            className="bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2 disabled:opacity-50"
                        >
                            🏦 국민은행용
                        </button>
                        <button
                            onClick={() => {
                                if (filteredPaymentData.length === 0) return;
                                setSelectedPayslipWorkerId(filteredPaymentData[0].workerId);
                                setShowPayslipModal(true);
                            }}
                            disabled={paymentData.length === 0}
                            className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2 disabled:opacity-50"
                        >
                            📄 명세서
                        </button>
                    </div>
                </div>
            </div>

            {errorCount > 0 && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2 text-sm">
                    <FontAwesomeIcon icon={faExclamationTriangle} className="text-red-500" />
                    <span><strong>{errorCount}건</strong>의 계좌 정보가 누락되었습니다. 작업자 DB를 점검해주세요.</span>
                </div>
            )}

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <h2 className="font-semibold text-slate-700">지급 대상자 목록 (월급제)</h2>
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={bulkDisplayContent}
                                onChange={(e) => setBulkDisplayContent(e.target.value)}
                                placeholder="표시내용 일괄입력"
                                className="border border-slate-300 rounded px-2 py-1 text-xs w-32"
                            />
                            <button
                                onClick={handleBulkDisplayContentApply}
                                className="bg-slate-600 text-white px-3 py-1 rounded text-xs hover:bg-slate-700"
                            >
                                일괄적용
                            </button>
                        </div>
                    </div>
                    <div className="text-sm flex items-center gap-4">
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
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                            <tr>
                                <th className="px-4 py-3">이름</th>
                                <th className="px-4 py-3">주민번호</th>
                                <th className="px-4 py-3">팀명</th>
                                <th className="px-4 py-3">시공사</th>
                                <th className="px-4 py-3">총 공수</th>
                                <th className="px-4 py-3 text-right">단가</th>
                                <th className="px-4 py-3 text-right">지급전</th>
                                <th className="px-4 py-3 text-right">공제</th>
                                <th className="px-4 py-3 text-right">실지급</th>
                                {showAccountColumns && (
                                    <>
                                        <th className="px-4 py-3">
                                            코드
                                            <button
                                                type="button"
                                                onClick={() => setShowBankCodes(true)}
                                                className="ml-1 text-xs text-blue-600 hover:text-blue-800"
                                            >
                                                📋
                                            </button>
                                        </th>
                                        <th className="px-4 py-3">은행명</th>
                                        <th className="px-4 py-3">계좌번호</th>
                                        <th className="px-4 py-3">예금주</th>
                                    </>
                                )}
                                <th className="px-4 py-3">표시내용</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={tableColSpan} className="px-4 py-12 text-center text-slate-500">
                                        <FontAwesomeIcon icon={faSpinner} spin className="mr-2" />
                                        데이터를 불러오는 중입니다...
                                    </td>
                                </tr>
                            ) : filteredPaymentData.length === 0 ? (
                                <tr>
                                    <td colSpan={tableColSpan} className="px-4 py-12 text-center text-slate-500">
                                        해당 기간에 지급 대상자가 없습니다.
                                    </td>
                                </tr>
                            ) : (
                                filteredPaymentData.map(item => (
                                    <tr key={`${item.workerId}__${item.teamId}`} className={`hover:bg-slate-50 transition ${!item.isValid ? 'bg-red-50' : ''}`}>
                                        <td className="px-4 py-3 font-medium text-slate-800">{item.workerName}</td>
                                        <td className="px-4 py-3 text-slate-600 font-mono text-xs">{item.idNumber || '-'}</td>
                                        <td className="px-4 py-3 text-slate-600">{item.teamName}</td>
                                        <td className="px-4 py-3 text-slate-600">{item.companyName || '-'}</td>
                                        <td className="px-4 py-3 text-slate-600">{item.totalManDay}</td>
                                        <td className="px-4 py-3 text-right text-slate-600">{item.unitPrice.toLocaleString()}</td>
                                        <td className="px-4 py-3 text-right text-slate-600">{item.grossAmount.toLocaleString()}</td>
                                        <td className="px-4 py-3 text-right text-amber-700 font-semibold">{item.totalDeduction.toLocaleString()}</td>
                                        <td className="px-4 py-3 text-right font-bold text-brand-600">{item.totalAmount.toLocaleString()}</td>
                                        {showAccountColumns && (
                                            <>
                                                <td className={`px-4 py-3 ${item.errors.bankCode ? 'text-red-600 font-bold' : 'text-slate-600'}`}>{item.bankCode || '-'}</td>
                                                <td className={`px-4 py-3 ${item.errors.bankName ? 'text-red-600 font-bold' : 'text-slate-600'}`}>{item.bankName || '(미입력)'}</td>
                                                <td className={`px-4 py-3 ${item.errors.accountNumber ? 'text-red-600 font-bold' : 'text-slate-600'}`}>{item.accountNumber || '(미입력)'}</td>
                                                <td className={`px-4 py-3 ${item.errors.accountHolder ? 'text-red-600 font-bold' : 'text-slate-600'}`}>{item.accountHolder || '(미입력)'}</td>
                                            </>
                                        )}
                                        <td className="px-4 py-3">
                                            <input
                                                type="text"
                                                value={item.displayContent}
                                                onChange={(e) => handleDisplayContentChange(item.workerId, item.teamId, e.target.value)}
                                                className="border border-slate-300 rounded px-2 py-1 text-xs w-full focus:border-brand-500 outline-none"
                                            />
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {showKBPreview && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full mx-4 max-h-[80vh] flex flex-col">
                        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-amber-50">
                            <h3 className="text-lg font-bold text-slate-800">🏦 국민은행용 엑셀 미리보기</h3>
                            <button
                                onClick={() => setShowKBPreview(false)}
                                className="text-slate-400 hover:text-slate-600 text-2xl"
                            >
                                ×
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto p-4">
                            <table className="w-full text-sm border-collapse">
                                <thead className="bg-amber-100 sticky top-0">
                                    <tr>
                                        <th className="border border-slate-300 px-3 py-2 text-left font-bold">A. 은행코드</th>
                                        <th className="border border-slate-300 px-3 py-2 text-left font-bold">B. 계좌번호</th>
                                        <th className="border border-slate-300 px-3 py-2 text-right font-bold">C. 이체금액</th>
                                        <th className="border border-slate-300 px-3 py-2 text-left font-bold">D. 받는분통장표시</th>
                                        <th className="border border-slate-300 px-3 py-2 text-left font-bold">E. 내통장메모</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {getKBPreviewData().map((row, idx) => (
                                        <tr key={idx} className="hover:bg-amber-50">
                                            <td className="border border-slate-300 px-3 py-2">{row.은행코드}</td>
                                            <td className="border border-slate-300 px-3 py-2">{row.계좌번호}</td>
                                            <td className="border border-slate-300 px-3 py-2 text-right font-medium">{row.이체금액.toLocaleString()}</td>
                                            <td className="border border-slate-300 px-3 py-2">{row.받는분통장표시}</td>
                                            <td className="border border-slate-300 px-3 py-2">{row.내통장메모}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="p-4 border-t border-slate-200 flex justify-between items-center bg-amber-50">
                            <span className="text-sm text-slate-600">
                                총 {getKBPreviewData().length}명 · 총 이체금액 {getKBPreviewData().reduce((sum, row) => sum + row.이체금액, 0).toLocaleString()}원
                            </span>
                            <div className="flex gap-2">
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
                                    <FontAwesomeIcon icon={faFileExcel} />
                                    국민은행용 다운로드
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showBankCodes && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full mx-4 max-h-[85vh] flex flex-col">
                        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-blue-50">
                            <h3 className="text-lg font-bold text-slate-800">📊 은행코드표</h3>
                            <button
                                onClick={() => setShowBankCodes(false)}
                                className="text-slate-400 hover:text-slate-600 text-2xl"
                            >
                                ×
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto p-4 space-y-4 text-xs">
                            <div>
                                <h4 className="text-sm font-bold text-slate-700 mb-2 bg-blue-100 px-2 py-1 rounded">🏦 은행</h4>
                                <p className="text-slate-500 text-xs mb-2">대표 은행명 또는 별칭을 입력하면 코드가 자동 매핑됩니다.</p>
                            </div>
                            <table className="w-full text-xs border-collapse">
                                <thead className="bg-slate-100 sticky top-0">
                                    <tr>
                                        <th className="border border-slate-300 px-2 py-1 text-left font-bold">코드</th>
                                        <th className="border border-slate-300 px-2 py-1 text-left font-bold">은행명</th>
                                        <th className="border border-slate-300 px-2 py-1 text-left font-bold">별칭</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {Object.entries(BANK_CODES)
                                        .filter(([name]) => name.length <= 6) // 대표명만 대략 노출
                                        .slice(0, 30)
                                        .map(([name, code]) => (
                                            <tr key={`${code}-${name}`}>
                                                <td className="border px-2 py-1 font-mono">{code}</td>
                                                <td className="border px-2 py-1">{name}</td>
                                                <td className="border px-2 py-1 text-slate-500">자동인식</td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
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
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col">
                        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="text-2xl">📄</span>
                                <div>
                                    <h3 className="text-lg font-bold text-slate-800">월급제 노임명세서 미리보기</h3>
                                    <p className="text-xs text-slate-500">{selectedMonth} · 총 {filteredPaymentData.length}명</p>
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
                                <div className="p-3 border-b border-slate-100 text-xs font-semibold text-slate-500">지급 대상자</div>
                                <div className="flex-1 overflow-y-auto">
                                    {filteredPaymentData.map(worker => (
                                        <button
                                            key={worker.workerId}
                                            onClick={() => setSelectedPayslipWorkerId(worker.workerId)}
                                            className={`w-full text-left px-4 py-3 border-b border-slate-100 text-sm transition flex flex-col ${payslipTarget?.workerId === worker.workerId ? 'bg-purple-50 text-purple-700 font-semibold' : 'hover:bg-slate-50'}`}
                                        >
                                            <span>{worker.workerName}</span>
                                            <span className="text-xs text-slate-500">{worker.teamName}</span>
                                        </button>
                                    ))}
                                    {filteredPaymentData.length === 0 && (
                                        <div className="px-4 py-6 text-sm text-slate-500 text-center">표시할 작업자가 없습니다.</div>
                                    )}
                                </div>
                            </aside>
                            <div className="flex-1 overflow-auto p-6 bg-slate-50">
                                {payslipTarget ? (
                                    (() => {
                                        const workEntries = payslipTarget.workEntries ?? [];
                                        const deductionBreakdown = payslipTarget.deductionBreakdown ?? createEmptyDeductionBreakdown();
                                        const totalWorkManDay = workEntries.reduce((sum, entry) => sum + entry.manDay, 0);

                                        return (
                                            <div ref={printRef} className="bg-white border-2 border-slate-200 rounded-xl shadow-sm">
                                                <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white text-center py-4 rounded-t-xl">
                                                    <h2 className="text-xl font-bold">{selectedMonth} 노임명세서</h2>
                                                    <p className="text-xs mt-1 font-medium text-white/80">근무내역 · 가불항목 · 총공제까지 한 번에 확인</p>
                                                </div>

                                                <section className="border-b border-slate-200">
                                                    <div className="text-center py-2 font-semibold text-slate-700 bg-slate-50 border-b border-slate-200">사원 정보</div>
                                                    <div className="grid grid-cols-4 text-sm">
                                                        <div className="border-r border-b border-slate-200 p-2 text-center font-medium bg-slate-50">성명</div>
                                                        <div className="border-r border-b border-slate-200 p-2 text-center font-bold">{payslipTarget.workerName}</div>
                                                        <div className="border-r border-b border-slate-200 p-2 text-center font-medium bg-slate-50">팀</div>
                                                        <div className="border-b border-slate-200 p-2 text-center">{payslipTarget.teamName}</div>
                                                    </div>
                                                    <div className="grid grid-cols-4 text-sm">
                                                        <div className="border-r border-b border-slate-200 p-2 text-center font-medium bg-slate-50">주민번호</div>
                                                        <div className="border-r border-b border-slate-200 p-2 text-center font-mono">{payslipTarget.idNumber || '-'}</div>
                                                        <div className="border-r border-b border-slate-200 p-2 text-center font-medium bg-slate-50">시공사</div>
                                                        <div className="border-b border-slate-200 p-2 text-center">{payslipTarget.companyName || '-'}</div>
                                                    </div>
                                                </section>

                                                <section className="grid grid-cols-3 text-sm divide-x divide-slate-200 bg-white">
                                                    <div className="p-4 text-center">
                                                        <p className="text-xs text-slate-500 mb-1">총 공수</p>
                                                        <p className="text-lg font-bold text-slate-800">{payslipTarget.totalManDay.toFixed(1)}</p>
                                                    </div>
                                                    <div className="p-4 text-center">
                                                        <p className="text-xs text-slate-500 mb-1">지급전</p>
                                                        <p className="text-lg font-bold text-slate-800">{payslipTarget.grossAmount.toLocaleString()}원</p>
                                                    </div>
                                                    <div className="p-4 text-center">
                                                        <p className="text-xs text-slate-500 mb-1">실 지급</p>
                                                        <p className="text-lg font-bold text-emerald-600">{payslipTarget.totalAmount.toLocaleString()}원</p>
                                                    </div>
                                                </section>

                                                <section className="p-4 border-t border-slate-200">
                                                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                                        <div className="space-y-2 bg-slate-50 rounded-xl border border-slate-200 p-4">
                                                            <div className="flex items-center justify-between">
                                                                <h4 className="text-sm font-bold text-slate-700">근무내역</h4>
                                                                <span className="text-xs text-slate-500">총 {workEntries.length}건</span>
                                                            </div>
                                                            {workEntries.length > 0 ? (
                                                                <div className="border border-slate-200 rounded-lg bg-white">
                                                                    <table className="w-full text-xs">
                                                                        <thead className="bg-slate-50">
                                                                            <tr>
                                                                                <th className="px-3 py-2 text-left font-semibold text-slate-600 border-b border-slate-200">일자</th>
                                                                                <th className="px-3 py-2 text-left font-semibold text-slate-600 border-b border-slate-200">현장</th>
                                                                                <th className="px-3 py-2 text-right font-semibold text-slate-600 border-b border-slate-200">공수</th>
                                                                                <th className="px-3 py-2 text-right font-semibold text-slate-600 border-b border-slate-200">단가</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody>
                                                                            {workEntries.map((entry, index) => (
                                                                                <tr key={`${entry.date}-${index}`} className="odd:bg-white even:bg-slate-50/60">
                                                                                    <td className="px-3 py-2 border-b border-slate-100 font-mono">{entry.date}</td>
                                                                                    <td className="px-3 py-2 border-b border-slate-100">{entry.siteName}</td>
                                                                                    <td className="px-3 py-2 border-b border-slate-100 text-right">{entry.manDay.toFixed(1)}</td>
                                                                                    <td className="px-3 py-2 border-b border-slate-100 text-right">{entry.unitPrice.toLocaleString()}</td>
                                                                                </tr>
                                                                            ))}
                                                                        </tbody>
                                                                        <tfoot>
                                                                            <tr className="bg-purple-50 font-semibold text-purple-700">
                                                                                <td className="px-3 py-2 border-t border-slate-200" colSpan={2}>근무 합계</td>
                                                                                <td className="px-3 py-2 border-t border-slate-200 text-right">{totalWorkManDay.toFixed(1)}</td>
                                                                                <td className="px-3 py-2 border-t border-slate-200 text-right">{payslipTarget.grossAmount.toLocaleString()}원</td>
                                                                            </tr>
                                                                        </tfoot>
                                                                    </table>
                                                                </div>
                                                            ) : (
                                                                <div className="p-4 border border-dashed border-slate-300 rounded-lg text-center text-xs text-slate-500 bg-white">근무내역이 없습니다.</div>
                                                            )}
                                                        </div>

                                                        <div className="space-y-2 bg-slate-50 rounded-xl border border-slate-200 p-4">
                                                            <div className="flex items-center justify-between">
                                                                <h4 className="text-sm font-bold text-slate-700">공제내역</h4>
                                                                <span className="text-xs text-slate-500">
                                                                    총 {(deductionBreakdown.standardLines.length + deductionBreakdown.additionalLines.length)}건
                                                                </span>
                                                            </div>
                                                            {deductionBreakdown.hasData ? (
                                                                <div className="border border-slate-200 rounded-lg bg-white">
                                                                    <table className="w-full text-xs">
                                                                        <thead className="bg-slate-50">
                                                                            <tr>
                                                                                <th className="px-3 py-2 text-left font-semibold text-slate-600 border-b border-slate-200">항목</th>
                                                                                <th className="px-3 py-2 text-right font-semibold text-slate-600 border-b border-slate-200">금액</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody>
                                                                            {[...deductionBreakdown.standardLines, ...deductionBreakdown.additionalLines].map((line, idx) => (
                                                                                <tr key={`deduction-${line.label}-${idx}`} className="odd:bg-white even:bg-slate-50/60">
                                                                                    <td className="px-3 py-2 border-b border-slate-100">{line.label}</td>
                                                                                    <td className="px-3 py-2 border-b border-slate-100 text-right text-red-600">{line.amount.toLocaleString()}원</td>
                                                                                </tr>
                                                                            ))}
                                                                        </tbody>
                                                                        <tfoot>
                                                                            <tr className="bg-amber-100 font-bold text-amber-800">
                                                                                <td className="px-3 py-2 border-t border-slate-200">총 공제금</td>
                                                                                <td className="px-3 py-2 border-t border-slate-200 text-right">{payslipTarget.totalDeduction.toLocaleString()}원</td>
                                                                            </tr>
                                                                        </tfoot>
                                                                    </table>
                                                                </div>
                                                            ) : (
                                                                <div className="p-4 border border-dashed border-slate-300 rounded-lg text-center text-xs text-slate-500 bg-white">등록된 공제 항목이 없습니다.</div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </section>

                                                <section className="p-4 border-t border-slate-200 bg-gradient-to-r from-emerald-50 to-emerald-100 rounded-b-xl">
                                                    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                                                        <div>
                                                            <p className="text-xs text-emerald-600 font-semibold">총 공제금</p>
                                                            <p className="text-lg font-bold text-emerald-700">{payslipTarget.totalDeduction.toLocaleString()}원</p>
                                                        </div>
                                                        <div className="text-center">
                                                            <p className="text-sm text-slate-500">실 지급액</p>
                                                            <p className="text-3xl font-black text-emerald-700">{payslipTarget.totalAmount.toLocaleString()}원</p>
                                                            <p className="text-xs text-slate-400 mt-1">지급전 {payslipTarget.grossAmount.toLocaleString()}원 - 공제 {payslipTarget.totalDeduction.toLocaleString()}원</p>
                                                        </div>
                                                    </div>
                                                </section>
                                            </div>
                                        );
                                    })()
                                ) : (
                                    <div className="text-center py-12 text-slate-500">
                                        표시할 명세서가 없습니다.
                                    </div>
                                )}

                                <div className="mt-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                    <p className="text-sm text-slate-600">
                                        <span className="font-semibold text-slate-800">{payslipTarget?.workerName ?? '-'}</span>
                                        {' · 실지급 '}
                                        <span className="text-brand-600 font-bold">{payslipTarget ? payslipTarget.totalAmount.toLocaleString() : 0}원</span>
                                    </p>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleCopyToClipboard}
                                            disabled={!payslipTarget || copying}
                                            className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-bold flex items-center gap-2 disabled:opacity-50"
                                        >
                                            {copying ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faCopy} />}
                                            이미지 복사
                                        </button>
                                        <button
                                            onClick={handleDownloadIndividualPayslip}
                                            disabled={!payslipTarget}
                                            className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-bold flex items-center gap-2 disabled:opacity-50"
                                        >
                                            <FontAwesomeIcon icon={faFileExcel} />
                                            개별 명세서 다운로드
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MonthlyWagePaymentPage;
