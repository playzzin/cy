import React, { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faCalendarAlt,
    faCircleCheck,
    faCircleExclamation,
    faExclamationTriangle,
    faFileExcel,
    faSearch,
    faSpinner,
    faUsers,
    faXmark
} from '@fortawesome/free-solid-svg-icons';
import * as XLSX from 'xlsx-js-style';
import { saveAs } from 'file-saver';
import {
    generateLaborStatementExcel,
    MAX_DAY_COLUMNS,
    DAY_LABELS_FIRST,
    DAY_LABELS_SECOND
} from '../../utils/excel/SupportPaymentExcelGenerator';
import { Team, teamService } from '../../services/teamService';
import { Company, companyService } from '../../services/companyService';
import { Site, siteService } from '../../services/siteService';
import { manpowerService, Worker } from '../../services/manpowerService';
import { dailyReportService, DailyReport, DailyReportWorker } from '../../services/dailyReportService';
import { BANK_CODES } from './team-payment/types';
import html2canvas from 'html2canvas';

interface SupportLaborExcelRow {
    workerId: string;
    workerName: string;
    idNumber: string;
    address: string;
    siteAddress?: string;
    days: number[];
    totalManDay: number;
    unitPrice: number;
    totalAmount: number;
    displayContent: string;
    contact?: string;
    bankCode?: string;
    accountNumber?: string;
    accountHolder?: string;
    description?: string;
    teamId?: string;
    bankName?: string;
    siteName?: string;
    siteId?: string;
}

interface CompanyExcelSheet {
    aggregate: SupportCompanyAggregate;
    rows: SupportLaborExcelRow[];
}

interface SupportWorkerBreakdown {
    date: string;
    reportId?: string;
    workerId: string;
    workerName: string;
    role?: string;
    manDay: number;
    unitPrice: number;
    amount: number;
    siteId?: string;
    siteName?: string;
    teamId?: string;
    teamName?: string;
}

// Renamed from SupportTeamRow to SupportSiteRow
interface SupportSiteRow {
    siteId: string;
    siteName: string;
    totalManDay: number;
    totalAmount: number;
    unitPriceSamples: number[];
    displayContent: string;
    workers: SupportWorkerBreakdown[];
}

interface SupportCompanyAggregate {
    companyId: string;
    companyName: string;
    bankName: string;
    bankCode: string;
    accountNumber: string;
    accountHolder: string;
    totalManDay: number;
    totalAmount: number;
    sites: SupportSiteRow[]; // Changed from teams to sites
    errors: {
        bankName?: boolean;
        bankCode?: boolean;
        accountNumber?: boolean;
        accountHolder?: boolean;
    };
}

interface KBTransferRow {
    bankCode: string;
    accountNumber: string;
    accountHolder: string;
    amount: number;
    description: string;
}

type DetailTarget = SupportSiteRow | null;

interface SitePreviewBlock {
    aggregate: SupportCompanyAggregate;
    site: SupportSiteRow;
    rows: SupportLaborExcelRow[];
}

const normalize = (value: string | undefined | null): string => (value ?? '').replace(/\s+/g, '').trim();
const normalizeName = (value: string | undefined | null): string =>
    (value ?? '').replace(/\(.*?\)/g, '').replace(/\s+/g, '').trim();

const formatNumber = (value: number) => new Intl.NumberFormat('ko-KR').format(value);
const formatDayValue = (value: number): string => {
    if (!value) return '';
    const fixed = Number(value.toFixed(1));
    return fixed % 1 === 0 ? fixed.toFixed(0) : fixed.toFixed(1);
};

const formatDayLabel = (value: number): string => value.toString().padStart(2, '0');

const getMonthRange = (yearMonth: string): { start: string; end: string } => {
    const [yearStr, monthStr] = yearMonth.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    const safeYear = Number.isFinite(year) ? year : new Date().getFullYear();
    const safeMonth = Number.isFinite(month) ? month : new Date().getMonth() + 1;
    const startDate = new Date(safeYear, safeMonth - 1, 1);
    const endDate = new Date(safeYear, safeMonth, 0);

    const toISO = (date: Date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    return { start: toISO(startDate), end: toISO(endDate) };
};

const buildPeriodLabel = (yearMonth: string): string => {
    if (!yearMonth) return '';
    const { start, end } = getMonthRange(yearMonth);
    const format = (value: string) => {
        const [y, m, d] = value.split('-');
        const shortYear = y ? y.slice(-2) : '';
        return `${shortYear}.${m}.${d}`;
    };
    return `${format(start)}~${format(end)}`;
};

const maskIdNumber = (value: string): string => {
    if (!value) return '';
    const digits = value.replace(/[^0-9]/g, '');
    if (digits.length < 7) return value;
    return `${digits.slice(0, 6)}-${digits.slice(6, 7)}******`;
};

const SupportTeamPaymentPage: React.FC = () => {
    const today = new Date();
    const defaultMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    const [selectedMonth, setSelectedMonth] = useState<string>(defaultMonth);
    const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
    const [aggregates, setAggregates] = useState<SupportCompanyAggregate[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [sites, setSites] = useState<Site[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [errors, setErrors] = useState<string[]>([]);
    const [detailTarget, setDetailTarget] = useState<DetailTarget>(null);
    const [showLaborPreview, setShowLaborPreview] = useState<boolean>(false);
    const [showKBPreview, setShowKBPreview] = useState<boolean>(false);

    const fetchInitialData = useCallback(async () => {
        try {
            const [fetchedTeams, fetchedCompanies, fetchedWorkers, fetchedSites] = await Promise.all([
                teamService.getTeams(),
                companyService.getCompanies(),
                manpowerService.getWorkers(),
                siteService.getSites()
            ]);
            setTeams(fetchedTeams);
            setCompanies(fetchedCompanies);
            setWorkers(fetchedWorkers);
            setSites(fetchedSites);
        } catch (error) {
            console.error('지원팀 기준 데이터를 불러오지 못했습니다.', error);
            setErrors((prev) => [...prev, '기준 데이터를 불러오지 못했습니다. 관리자에게 문의해주세요.']);
        }
    }, []);

    useEffect(() => {
        void fetchInitialData();
    }, [fetchInitialData]);

    const getCompanyBankInfo = useCallback(
        (companyId: string, fallbackName: string): { bankName: string; accountNumber: string; accountHolder: string } => {
            const byId = companies.find((company) => normalize(company.id) === normalize(companyId));
            if (byId) {
                return {
                    bankName: byId.bankName ?? '',
                    accountNumber: byId.accountNumber ?? '',
                    accountHolder: byId.accountHolder ?? byId.ceoName ?? byId.name ?? fallbackName
                };
            }

            const normalizedName = normalizeName(fallbackName);
            if (!normalizedName) {
                return { bankName: '', accountNumber: '', accountHolder: '' };
            }

            const byName = companies.find((company) => normalizeName(company.name) === normalizedName);
            if (!byName) {
                return { bankName: '', accountNumber: '', accountHolder: '' };
            }

            return {
                bankName: byName.bankName ?? '',
                accountNumber: byName.accountNumber ?? '',
                accountHolder: byName.accountHolder ?? byName.ceoName ?? byName.name ?? fallbackName
            };
        },
        [companies]
    );

    const aggregateReports = useCallback(
        (reports: DailyReport[]): { aggregates: SupportCompanyAggregate[]; errorMessages: string[] } => {
            const teamById = new Map<string, Team>();
            teams.forEach((team) => {
                if (team.id) {
                    teamById.set(team.id, team);
                }
            });

            const aggregateMap = new Map<string, SupportCompanyAggregate>();
            const errorMessages: string[] = [];

            const ensureAggregate = (companyId: string, companyName: string) => {
                const key = companyId || `__${normalizeName(companyName) || 'unknown'}`;
                if (!aggregateMap.has(key)) {
                    const bankInfo = getCompanyBankInfo(companyId, companyName);
                    const trimmedBankName = bankInfo.bankName.trim();
                    const bankCode = trimmedBankName ? BANK_CODES[trimmedBankName] ?? '' : '';
                    const fieldErrors: SupportCompanyAggregate['errors'] = {};
                    if (!trimmedBankName) fieldErrors.bankName = true;
                    if (trimmedBankName && !bankCode) fieldErrors.bankCode = true;
                    if (!bankInfo.accountNumber) fieldErrors.accountNumber = true;
                    if (!bankInfo.accountHolder) fieldErrors.accountHolder = true;

                    if (Object.values(fieldErrors).some(Boolean)) {
                        errorMessages.push(`${companyName || '협력사 미지정'}의 계좌 정보를 확인해주세요.`);
                    }

                    aggregateMap.set(key, {
                        companyId,
                        companyName: companyName || '협력사 미지정',
                        bankName: trimmedBankName,
                        bankCode,
                        accountNumber: bankInfo.accountNumber,
                        accountHolder: bankInfo.accountHolder,
                        totalManDay: 0,
                        totalAmount: 0,
                        sites: [], // Changed from teams to sites
                        errors: fieldErrors
                    });
                }
                return aggregateMap.get(key)!;
            };

            reports.forEach((report) => {
                const reportId = report.id ?? '';
                const reportDate = report.date ?? '';
                report.workers.forEach((reportWorker: DailyReportWorker) => {
                    const normalizedSalary = normalize(reportWorker.salaryModel ?? reportWorker.payType);
                    const isSupportModel = normalizedSalary === '지원팀';
                    const workerTeamId = (reportWorker.teamId ?? report.teamId ?? '').trim();
                    const resolvedTeam = workerTeamId ? teamById.get(workerTeamId) : undefined;
                    const isSupportTeam = normalize(resolvedTeam?.type) === '지원팀';
                    if (!isSupportModel && !isSupportTeam) return;

                    const workerCompanyId = (resolvedTeam?.companyId ?? report.companyId ?? '').trim();
                    const fallbackCompanyName =
                        resolvedTeam?.companyName ??
                        report.companyName ??
                        (workerCompanyId ? companies.find((company) => company.id === workerCompanyId)?.name : '') ??
                        '';
                    const companyDisplayName = fallbackCompanyName || resolvedTeam?.name || report.teamName || '지원팀';
                    const aggregate = ensureAggregate(workerCompanyId, companyDisplayName);

                    const unitPrice =
                        typeof reportWorker.unitPrice === 'number' && Number.isFinite(reportWorker.unitPrice)
                            ? reportWorker.unitPrice
                            : resolvedTeam?.supportRate ?? 0;
                    const manDay =
                        typeof reportWorker.manDay === 'number' && Number.isFinite(reportWorker.manDay)
                            ? reportWorker.manDay
                            : 0;
                    const amount = Math.round(manDay * unitPrice);

                    aggregate.totalManDay += manDay;
                    aggregate.totalAmount += amount;

                    // Use siteId for grouping instead of teamId
                    const siteId = report.siteId ?? 'unknown-site';
                    const siteName = report.siteName ?? '현장 미지정';
                    const workerRecord: SupportWorkerBreakdown = {
                        date: reportDate,
                        reportId,
                        workerId: reportWorker.workerId ?? `${reportId}-${siteId}-${reportWorker.name ?? 'worker'}`,
                        workerName: reportWorker.name ?? '이름 미상',
                        role: reportWorker.role,
                        manDay,
                        unitPrice,
                        amount,
                        siteId: report.siteId,
                        siteName: report.siteName,
                        teamId: resolvedTeam?.id,
                        teamName: resolvedTeam?.name ?? report.teamName
                    };

                    // Group by siteId instead of teamId
                    const existingSite = aggregate.sites.find((site) => site.siteId === siteId);
                    if (existingSite) {
                        existingSite.totalManDay += manDay;
                        existingSite.totalAmount += amount;
                        if (unitPrice > 0) existingSite.unitPriceSamples.push(unitPrice);
                        existingSite.workers.push(workerRecord);
                    } else {
                        aggregate.sites.push({
                            siteId,
                            siteName,
                            totalManDay: manDay,
                            totalAmount: amount,
                            unitPriceSamples: unitPrice > 0 ? [unitPrice] : [],
                            displayContent: `${siteName} 지원비`,
                            workers: [workerRecord]
                        });
                    }
                });
            });

            const aggregatesList = Array.from(aggregateMap.values()).map((aggregate) => ({
                ...aggregate,
                sites: aggregate.sites
                    .map((site: SupportSiteRow) => ({
                        ...site,
                        workers: [...site.workers].sort((a: SupportWorkerBreakdown, b: SupportWorkerBreakdown) => a.workerName.localeCompare(b.workerName, 'ko-KR'))
                    }))
                    .sort((a: SupportSiteRow, b: SupportSiteRow) => a.siteName.localeCompare(b.siteName, 'ko-KR'))
            }));

            return { aggregates: aggregatesList, errorMessages };
        },
        [companies, getCompanyBankInfo, teams]
    );

    const fetchSupportData = useCallback(async () => {
        if (!selectedMonth) return;
        setLoading(true);
        try {
            const { start, end } = getMonthRange(selectedMonth);
            const reports = await dailyReportService.getReportsByRange(start, end);
            const { aggregates: nextAggregates, errorMessages } = aggregateReports(reports);
            setAggregates(nextAggregates);
            setErrors(errorMessages);
        } catch (error) {
            console.error('지원팀 데이터를 불러오는 중 오류가 발생했습니다.', error);
            setAggregates([]);
            setErrors(['지원팀 데이터를 불러오는 중 문제가 발생했습니다. 다시 시도해주세요.']);
        } finally {
            setLoading(false);
        }
    }, [aggregateReports, selectedMonth]);

    useEffect(() => {
        if (teams.length === 0 || companies.length === 0) return;
        void fetchSupportData();
    }, [companies.length, fetchSupportData, teams.length]);

    const filteredAggregates = useMemo(() => {
        if (!selectedCompanyId) return aggregates;
        return aggregates.filter((aggregate) => normalize(aggregate.companyId) === normalize(selectedCompanyId));
    }, [aggregates, selectedCompanyId]);

    const availableCompanyOptions = useMemo(() => {
        const optionMap = new Map<string, string>();
        aggregates.forEach((aggregate) => {
            if (aggregate.companyId) {
                optionMap.set(normalize(aggregate.companyId), aggregate.companyName);
            }
        });
        return Array.from(optionMap.entries())
            .map(([id, name]) => ({ id, name }))
            .sort((a, b) => a.name.localeCompare(b.name, 'ko-KR'));
    }, [aggregates]);

    useEffect(() => {
        if (!selectedCompanyId) return;
        const exists = availableCompanyOptions.some((option) => normalize(option.id) === normalize(selectedCompanyId));
        if (!exists) {
            setSelectedCompanyId('');
        }
    }, [availableCompanyOptions, selectedCompanyId]);

    const workerById = useMemo(() => {
        const map = new Map<string, Worker>();
        workers.forEach((worker) => {
            if (worker.id) {
                map.set(worker.id, worker);
            }
        });
        return map;
    }, [workers]);

    const siteById = useMemo(() => {
        const map = new Map<string, Site>();
        sites.forEach((site) => {
            if (site.id) {
                map.set(site.id, site);
            }
        });
        return map;
    }, [sites]);

    const companyExcelSheets = useMemo<CompanyExcelSheet[]>(() => {
        return filteredAggregates.map((aggregate) => {
            const rows: SupportLaborExcelRow[] = [];
            aggregate.sites.forEach((site: SupportSiteRow) => {
                const workerMap = new Map<string, SupportLaborExcelRow>();
                site.workers.forEach((entry: SupportWorkerBreakdown) => {
                    const key = entry.workerId ?? `${aggregate.companyId || 'unknown'}-${site.siteId}-${entry.workerName ?? entry.date}`;
                    if (!workerMap.has(key)) {
                        const workerInfo = entry.workerId ? workerById.get(entry.workerId) : undefined;
                        const siteInfo = entry.siteId ? siteById.get(entry.siteId) : undefined;
                        workerMap.set(key, {
                            workerId: entry.workerId ?? key,
                            workerName: entry.workerName ?? '이름 미상',
                            idNumber: workerInfo?.idNumber ?? '',
                            contact: workerInfo?.contact ?? '',
                            address: workerInfo?.address ?? siteInfo?.address ?? '',
                            siteAddress: siteInfo?.address ?? '',
                            siteId: entry.siteId ?? siteInfo?.id,
                            siteName: entry.siteName ?? siteInfo?.name ?? '',
                            days: Array.from({ length: MAX_DAY_COLUMNS }, () => 0),
                            totalManDay: 0,
                            unitPrice: entry.unitPrice,
                            totalAmount: 0,
                            displayContent: site.displayContent
                        });
                    }

                    const target = workerMap.get(key)!;
                    const reportDate = new Date(entry.date);
                    if (!Number.isNaN(reportDate.getTime())) {
                        const day = reportDate.getDate();
                        if (day >= 1 && day <= MAX_DAY_COLUMNS) {
                            target.days[day - 1] = Number(target.days[day - 1]) + entry.manDay;
                        }
                    }
                    target.totalManDay += entry.manDay;
                    target.totalAmount += entry.amount;
                    if (entry.unitPrice > 0) {
                        target.unitPrice = entry.unitPrice;
                    }
                    if (!target.address && entry.siteId) {
                        const info = siteById.get(entry.siteId);
                        if (info?.address) {
                            target.address = info.address;
                        }
                    }
                });

                rows.push(
                    ...Array.from(workerMap.values()).sort((a, b) => a.workerName.localeCompare(b.workerName, 'ko-KR'))
                );
            });
            return { aggregate, rows };
        });
    }, [filteredAggregates, siteById, workerById]);

    const supportExcelRows = useMemo(() => companyExcelSheets.flatMap((sheet) => sheet.rows), [companyExcelSheets]);

    const laborDayTotals = useMemo(() => {
        const totals = Array.from({ length: MAX_DAY_COLUMNS }, () => 0);
        supportExcelRows.forEach((row) => {
            row.days.forEach((value, idx) => {
                totals[idx] += value;
            });
        });
        return totals;
    }, [supportExcelRows]);

    const laborTotals = useMemo(
        () =>
            supportExcelRows.reduce(
                (acc, row) => ({
                    totalManDay: acc.totalManDay + row.totalManDay,
                    totalAmount: acc.totalAmount + row.totalAmount
                }),
                { totalManDay: 0, totalAmount: 0 }
            ),
        [supportExcelRows]
    );

    const totalSummary = useMemo(
        () =>
            filteredAggregates.reduce(
                (acc, aggregate) => ({
                    totalManDay: acc.totalManDay + aggregate.totalManDay,
                    totalAmount: acc.totalAmount + aggregate.totalAmount,
                    partnerCount: acc.partnerCount + 1,
                    siteCount: acc.siteCount + aggregate.sites.length
                }),
                { totalManDay: 0, totalAmount: 0, partnerCount: 0, siteCount: 0 }
            ),
        [filteredAggregates]
    );

    const handleDisplayContentChange = (siteId: string, value: string) => {
        setAggregates((prev) =>
            prev.map((aggregate) => ({
                ...aggregate,
                sites: aggregate.sites.map((site: SupportSiteRow) => (site.siteId === siteId ? { ...site, displayContent: value } : site))
            }))
        );
    };

    const kbRows = useMemo(() => {
        const label = `${parseInt(selectedMonth.split('-')[1] ?? '0', 10)}월`;
        const rows: KBTransferRow[] = [];
        filteredAggregates.forEach((aggregate) => {
            aggregate.sites.forEach((site: SupportSiteRow) => {
                rows.push({
                    bankCode: aggregate.bankCode,
                    accountNumber: aggregate.accountNumber,
                    accountHolder: aggregate.accountHolder,
                    amount: site.totalAmount,
                    description: `${site.displayContent} ${label}`
                });
            });
        });
        return rows;
    }, [filteredAggregates, selectedMonth]);

    const previewRefs = useRef<Record<string, HTMLDivElement | null>>({});

    const sitePreviews: SitePreviewBlock[] = useMemo(
        () =>
            filteredAggregates.flatMap((aggregate) =>
                aggregate.sites.map((site) => {
                    const rows = supportExcelRows.filter((row) => row.siteId === site.siteId || row.siteName === site.siteName);
                    return { aggregate, site, rows };
                })
            ),
        [filteredAggregates, supportExcelRows]
    );

    const capturePreview = useCallback(
        async (key: string) => {
            const node = previewRefs.current[key];
            if (!node) return;
            const canvas = await html2canvas(node, { scale: 2 } as any);
            const blob: Blob | null = await new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
            if (!blob) {
                window.alert('캡처에 실패했습니다.');
                return;
            }
            if (navigator.clipboard && 'write' in navigator.clipboard && typeof ClipboardItem !== 'undefined') {
                try {
                    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
                    window.alert('클립보드에 이미지로 복사했습니다.');
                    return;
                } catch (err) {
                    console.error(err);
                }
            }
            saveAs(blob, `노무내역서_${key}.png`);
        },
        []
    );

    const handleOpenLaborPreview = () => {
        if (supportExcelRows.length === 0) {
            window.alert('다운로드할 데이터가 없습니다.');
            return;
        }
        setShowLaborPreview(true);
    };

    const handleDownloadKB = () => {
        if (kbRows.length === 0) {
            window.alert('다운로드할 데이터가 없습니다.');
            return;
        }

        const header = ['A. 은행코드', 'B. 계좌번호', 'C. 이체금액', 'D. 받는분통장표시', 'E. 내통장메모'];
        const rows = kbRows.map((row) => [row.bankCode, row.accountNumber, row.amount, row.accountHolder, row.description]);

        const worksheet = XLSX.utils.aoa_to_sheet([header, ...rows]);
        worksheet['!cols'] = [{ wch: 8 }, { wch: 20 }, { wch: 14 }, { wch: 16 }, { wch: 20 }];

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, '국민은행용');
        XLSX.writeFile(workbook, `support-team-kb-${selectedMonth}.xlsx`);
    };

    return (
        <div className="flex flex-col h-full bg-slate-50">
            <div className="border-b border-slate-200 bg-white px-6 py-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                    <div className="bg-amber-100 text-amber-600 rounded-xl px-3 py-2 text-xl">
                        <FontAwesomeIcon icon={faUsers} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">지원팀 지급 관리</h1>
                        <p className="text-sm text-slate-500">지원팀 공수 집계 및 노무내역서/국민은행 엑셀 출력</p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    <ActionButton variant="solid-green" disabled={supportExcelRows.length === 0} onClick={handleOpenLaborPreview}>
                        <FontAwesomeIcon icon={faFileExcel} />
                        노무내역서 미리보기
                    </ActionButton>
                    <ActionButton variant="outline-amber" disabled={kbRows.length === 0} onClick={() => setShowKBPreview(true)}>
                        <FontAwesomeIcon icon={faSearch} />
                        국민은행 미리보기
                    </ActionButton>
                    <ActionButton variant="solid-amber" disabled={kbRows.length === 0} onClick={handleDownloadKB}>
                        <FontAwesomeIcon icon={faFileExcel} />
                        국민은행 다운로드
                    </ActionButton>
                </div>
            </div>

            <div className="flex-1 overflow-auto p-4 space-y-4">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <label className="text-sm font-medium text-slate-600 flex items-center gap-2">
                            <FontAwesomeIcon icon={faCalendarAlt} />
                            지급 월
                        </label>
                        <input
                            type="month"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                        />
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <label className="text-sm font-medium text-slate-600">협력사 필터</label>
                        <select
                            value={selectedCompanyId}
                            onChange={(e) => setSelectedCompanyId(e.target.value)}
                            className="border border-slate-300 rounded-lg px-3 py-2 min-w-[220px] focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                            disabled={availableCompanyOptions.length === 0}
                        >
                            <option value="">전체</option>
                            {availableCompanyOptions.map((company) => (
                                <option key={company.id} value={company.id}>
                                    {company.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <SummaryCard label="총 공수" value={`${formatNumber(totalSummary.totalManDay)} 공`} icon={faCalendarAlt} tone="violet" />
                    <SummaryCard label="총 지급액" value={`${formatNumber(totalSummary.totalAmount)} 원`} icon={faCircleCheck} tone="emerald" />
                    <SummaryCard label="협력사 수" value={`${formatNumber(totalSummary.partnerCount)} 곳`} icon={faUsers} tone="sky" />
                    <SummaryCard label="현장 수" value={`${formatNumber(totalSummary.siteCount)} 곳`} icon={faCircleExclamation} tone="orange" />
                </div>

                {errors.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 rounded-lg">
                        <h2 className="font-semibold mb-2 flex items-center gap-2">
                            <FontAwesomeIcon icon={faExclamationTriangle} />
                            확인이 필요한 항목
                        </h2>
                        <ul className="text-sm list-disc pl-5 space-y-1">
                            {errors.map((message, idx) => (
                                <li key={`${message}-${idx}`}>{message}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {loading ? (
                    <div className="bg-white border border-slate-200 rounded-2xl py-16 flex flex-col items-center gap-3 text-slate-500">
                        <FontAwesomeIcon icon={faSpinner} spin className="text-2xl text-amber-500" />
                        데이터를 불러오는 중입니다...
                    </div>
                ) : filteredAggregates.length === 0 ? (
                    <div className="bg-white border border-dashed border-slate-300 rounded-2xl py-12 text-center text-slate-500">
                        조회된 데이터가 없습니다.
                    </div>
                ) : (
                    filteredAggregates.map((aggregate) => {
                        const previewBlocks = sitePreviews.filter(
                            (item: SitePreviewBlock) => item.aggregate.companyId === aggregate.companyId
                        );
                        const hasAccountError = Object.values(aggregate.errors).some(Boolean);
                        return (
                            <div key={aggregate.companyId || aggregate.companyName} className="bg-white rounded-2xl border border-slate-200 shadow-sm">
                                <div className="px-6 py-4 border-b border-slate-100 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                    <div>
                                        <div className="text-sm text-slate-500">협력사</div>
                                        <div className="text-xl font-semibold text-slate-800 flex items-center gap-2">
                                            {aggregate.companyName}
                                            {hasAccountError && (
                                                <span className="text-xs text-amber-600 bg-amber-50 border border-amber-300 rounded px-2 py-0.5">
                                                    계좌정보 확인
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="grid gap-2 text-sm text-slate-600 sm:grid-cols-2 lg:auto-cols-fr lg:grid-flow-col">
                                        <div>은행명: <span className="font-medium">{aggregate.bankName || '-'}</span></div>
                                        <div>계좌번호: <span className="font-mono">{aggregate.accountNumber || '-'}</span></div>
                                        <div>예금주: <span className="font-medium">{aggregate.accountHolder || '-'}</span></div>
                                        <div>총 지급액: <span className="font-bold text-emerald-600">{formatNumber(aggregate.totalAmount)} 원</span></div>
                                    </div>
                                </div>
                                <div className="overflow-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wide">
                                            <tr>
                                                <th className="px-4 py-3 text-left">현장명</th>
                                                <th className="px-4 py-3 text-right">총 공수</th>
                                                <th className="px-4 py-3 text-right">지급액</th>
                                                <th className="px-4 py-3 text-left">표시 내용</th>
                                                <th className="px-4 py-3 text-center">세부</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {aggregate.sites.map((site: SupportSiteRow) => (
                                                <tr key={site.siteId} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                                                    <td className="px-4 py-3 font-medium text-slate-700">{site.siteName}</td>
                                                    <td className="px-4 py-3 text-right font-mono text-slate-600">{site.totalManDay.toFixed(1)}</td>
                                                    <td className="px-4 py-3 text-right font-mono font-medium text-slate-800">{formatNumber(site.totalAmount)}</td>
                                                    <td className="px-4 py-3">
                                                        <input
                                                            type="text"
                                                            value={site.displayContent}
                                                            onChange={(e) => handleDisplayContentChange(site.siteId, e.target.value)}
                                                            className="w-full px-2 py-1 border border-slate-200 rounded text-sm focus:border-indigo-500 outline-none"
                                                            placeholder="내용 입력"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <button
                                                            type="button"
                                                            onClick={() => setDetailTarget(site)}
                                                            className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                                                        >
                                                            상세
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {detailTarget && (
                <Modal title={`${detailTarget.siteName} 상세 내역`} onClose={() => setDetailTarget(null)} widthClass="max-w-4xl">
                    <div className="flex-1 overflow-auto p-6">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 text-slate-500 text-xs uppercase sticky top-0 z-10">
                                <tr>
                                    <th className="px-3 py-2 border-b border-slate-200 text-left">성명</th>
                                    <th className="px-3 py-2 border-b border-slate-200 text-left">직책</th>
                                    <th className="px-3 py-2 border-b border-slate-200 text-center">공수</th>
                                    <th className="px-3 py-2 border-b border-slate-200 text-right">단가</th>
                                    <th className="px-3 py-2 border-b border-slate-200 text-right">금액</th>
                                    <th className="px-3 py-2 border-b border-slate-200 text-center">보고일</th>
                                </tr>
                            </thead>
                            <tbody>
                                {detailTarget.workers.map((worker) => (
                                    <tr key={`${worker.workerId}-${worker.date}`} className="border-b border-slate-100">
                                        <td className="px-3 py-2">{worker.workerName}</td>
                                        <td className="px-3 py-2 text-slate-500">{worker.role || '-'}</td>
                                        <td className="px-3 py-2 text-center font-mono">{worker.manDay.toFixed(1)}</td>
                                        <td className="px-3 py-2 text-right font-mono">{formatNumber(worker.unitPrice)}</td>
                                        <td className="px-3 py-2 text-right font-mono text-slate-800">{formatNumber(worker.amount)}</td>
                                        <td className="px-3 py-2 text-center text-slate-500">{worker.date}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Modal>
            )}

            {showLaborPreview && (
                <Modal title="지원팀 노무내역서 미리보기" onClose={() => setShowLaborPreview(false)} widthClass="max-w-[1600px]">
                    <div className="flex flex-col gap-6">
                        <div className="text-sm text-slate-500">
                            노무내역서 미리보기입니다. 캡처 버튼으로 이미지 복사/다운로드가 가능합니다.
                        </div>
                        <div className="flex flex-col gap-6">
                            {sitePreviews.length === 0 && (
                                <div className="text-center text-slate-500 border border-dashed border-slate-300 rounded-lg py-6">
                                    표시할 현장이 없습니다.
                                </div>
                            )}
                            {sitePreviews.map(({ aggregate, site, rows }: SitePreviewBlock) => {
                                const key = `${normalize(aggregate.companyId || aggregate.companyName)}-${normalize(site.siteId)}`;
                                const displayCompanyName = aggregate.companyName || '-';
                                const displaySiteName = site.siteName || rows[0]?.siteName || '현장 미지정';
                                const monthRange = getMonthRange(selectedMonth);
                                const dayTotals = Array.from({ length: MAX_DAY_COLUMNS }, () => 0);
                                rows.forEach((row) => {
                                    row.days.forEach((value, idx) => {
                                        dayTotals[idx] += value;
                                    });
                                });
                                const totalManDayLocal = rows.reduce((acc, row) => acc + row.totalManDay, 0);
                                const totalAmountLocal = rows.reduce((acc, row) => acc + row.totalAmount, 0);
                                const avgUnitPrice = rows.length
                                    ? rows.reduce((acc, r) => acc + r.unitPrice, 0) / rows.length
                                    : 0;
                                return (
                                    <div key={key} className="border border-slate-300 rounded-lg overflow-hidden shadow-sm">
                                        <div className="flex items-center justify-between bg-slate-100 px-4 py-2 border-b border-slate-300">
                                            <div className="text-sm font-semibold text-slate-700">
                                                {displayCompanyName} / {displaySiteName}
                                            </div>
                                            <ActionButton
                                                variant="outline-amber"
                                                onClick={() => capturePreview(key)}
                                                className="text-xs"
                                            >
                                                사진찍기 (복사/다운)
                                            </ActionButton>
                                        </div>
                                        <div ref={(el) => (previewRefs.current[key] = el)} className="bg-white">
                                            <table className="w-full text-[11px] whitespace-nowrap border-collapse">
                                                <thead>
                                                    <tr className="bg-slate-50">
                                                        <th className="border border-slate-300 p-1.5 text-center bg-slate-100 font-bold w-10">기</th>
                                                        <td colSpan={2} className="border border-slate-300 p-1.5 text-left font-mono">
                                                            {monthRange.start}
                                                        </td>
                                                        <th colSpan={17} className="border border-slate-300 p-1.5 text-center font-bold bg-slate-100">
                                                            현장명
                                                        </th>
                                                        <th colSpan={2} className="border border-slate-300 p-1.5 text-center font-bold bg-slate-100">
                                                            협력사
                                                        </th>
                                                    </tr>
                                                    <tr className="bg-slate-50">
                                                        <th className="border border-slate-300 p-1.5 text-center bg-slate-100 font-bold">간</th>
                                                        <td colSpan={2} className="border border-slate-300 p-1.5 text-left font-mono">
                                                            {monthRange.end}
                                                        </td>
                                                        <td colSpan={17} className="border border-slate-300 p-1.5 text-center font-semibold">
                                                            {displaySiteName}
                                                        </td>
                                                        <td colSpan={2} className="border border-slate-300 p-1.5 text-center font-semibold">
                                                            {displayCompanyName}
                                                        </td>
                                                    </tr>
                                                    <tr className="bg-slate-100 text-slate-700">
                                                        <th rowSpan={2} className="border border-slate-300 p-1.5 text-center min-w-[40px] bg-slate-200">번호</th>
                                                        <th rowSpan={2} className="border border-slate-300 p-1.5 text-center min-w-[80px]">이름</th>
                                                        <th className="border border-slate-300 p-1.5 text-center min-w-[120px]">주민번호</th>
                                                        <th rowSpan={2} className="border border-slate-300 p-1.5 text-center min-w-[140px]">주 소</th>
                                                        {DAY_LABELS_FIRST.map((day) => (
                                                            <th key={`header-first-${day}`} className="border border-slate-300 p-1 w-[24px] text-center bg-sky-600 text-white text-[10px]">
                                                                {String(day).padStart(2, '0')}
                                                            </th>
                                                        ))}
                                                        <th className="border border-slate-300 p-1 w-[24px] text-center bg-slate-400 text-white text-[10px]">X</th>
                                                        <th rowSpan={2} className="border border-slate-300 p-1.5 text-center min-w-[50px] bg-slate-200">출역</th>
                                                        <th className="border border-slate-300 p-1.5 text-center min-w-[80px] bg-slate-200">노무비 단가</th>
                                                    </tr>
                                                    <tr className="bg-slate-100 text-slate-600">
                                                        <th className="border border-slate-300 p-1.5 text-center">전화번호</th>
                                                        {[16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30].map((day) => (
                                                            <th key={`header-second-${day}`} className="border border-slate-300 p-1 w-[24px] text-center bg-red-600 text-white text-[10px]">
                                                                {String(day).padStart(2, '0')}
                                                            </th>
                                                        ))}
                                                        <th className="border border-slate-300 p-1 w-[24px] text-center bg-red-600 text-white text-[10px]">31</th>
                                                        <th className="border border-slate-300 p-1.5 text-center bg-emerald-100 text-emerald-800 font-bold min-w-[90px]">노무비 총액</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {rows.map((row, index) => (
                                                        <React.Fragment key={row.workerId}>
                                                            <tr className="bg-white hover:bg-slate-50">
                                                                <td rowSpan={2} className="border border-slate-200 p-1.5 text-center align-middle font-semibold bg-slate-50">
                                                                    {index + 1}
                                                                </td>
                                                                <td rowSpan={2} className="border border-slate-200 p-1.5 text-center font-semibold align-middle">
                                                                    {row.workerName}
                                                                </td>
                                                                <td className="border border-slate-200 p-1.5 text-center font-mono align-middle">
                                                                    {maskIdNumber(row.idNumber)}
                                                                </td>
                                                                <td rowSpan={2} className="border border-slate-200 p-1.5 text-left align-middle text-[10px]">
                                                                    {row.address || row.siteAddress || '-'}
                                                                </td>
                                                                {DAY_LABELS_FIRST.map((day) => (
                                                                    <td key={`${row.workerId}-first-${day}`} className="border border-slate-200 p-0.5 text-center bg-sky-50 text-[10px]">
                                                                        {row.days && row.days[day - 1] ? formatDayValue(row.days[day - 1]) : ''}
                                                                    </td>
                                                                ))}
                                                                <td className="border border-slate-200 p-0.5 text-center bg-slate-100 text-[10px]"></td>
                                                                <td rowSpan={2} className="border border-slate-200 p-1.5 text-center font-mono align-middle font-semibold bg-slate-50">
                                                                    {row.totalManDay.toFixed(1)}
                                                                </td>
                                                                <td className="border border-slate-200 p-1.5 text-right font-mono align-middle">
                                                                    {formatNumber(row.unitPrice)}
                                                                </td>
                                                            </tr>
                                                            <tr className="bg-white hover:bg-slate-50">
                                                                <td className="border border-slate-200 p-1.5 text-center text-slate-600 font-mono">
                                                                    {row.contact || '-'}
                                                                </td>
                                                                {[16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30].map((day) => (
                                                                    <td key={`${row.workerId}-second-${day}`} className="border border-slate-200 p-0.5 text-center bg-red-50 text-[10px]">
                                                                        {row.days && row.days[day - 1] ? formatDayValue(row.days[day - 1]) : ''}
                                                                    </td>
                                                                ))}
                                                                <td className="border border-slate-200 p-0.5 text-center bg-red-50 text-[10px]">
                                                                    {row.days && row.days[30] ? formatDayValue(row.days[30]) : ''}
                                                                </td>
                                                                <td className="border border-slate-200 p-1.5 text-right font-mono font-bold align-middle bg-emerald-50 text-emerald-700">
                                                                    {formatNumber(row.totalAmount)}
                                                                </td>
                                                            </tr>
                                                        </React.Fragment>
                                                    ))}
                                                    <tr className="bg-slate-100 font-semibold">
                                                        <td colSpan={4} className="border border-slate-300 p-2 text-center bg-slate-200">
                                                            합 계
                                                        </td>
                                                        {DAY_LABELS_FIRST.map((day) => (
                                                            <td key={`total-first-${day}`} className="border border-slate-300 p-1 text-center text-[10px]">
                                                                {dayTotals[day - 1] ? formatDayValue(dayTotals[day - 1]) : ''}
                                                            </td>
                                                        ))}
                                                        <td className="border border-slate-300 p-1 text-center text-[10px] bg-slate-50"></td>
                                                        <td rowSpan={2} className="border border-slate-300 p-1.5 text-center font-mono font-semibold bg-slate-200">
                                                            {totalManDayLocal.toFixed(1)}
                                                        </td>
                                                        <td className="border border-slate-300 p-1.5 text-right font-mono font-semibold bg-slate-200">
                                                            {formatNumber(avgUnitPrice)}
                                                        </td>
                                                    </tr>
                                                    <tr className="bg-slate-100 font-semibold">
                                                        <td colSpan={4} className="border border-slate-300 p-2 text-center bg-slate-200">
                                                            총액
                                                        </td>
                                                        {[16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30].map((day) => (
                                                            <td key={`total-second-${day}`} className="border border-slate-300 p-1 text-center text-[10px]">
                                                                {dayTotals[day - 1] ? formatDayValue(dayTotals[day - 1]) : ''}
                                                            </td>
                                                        ))}
                                                        <td className="border border-slate-300 p-1 text-center text-[10px]">
                                                            {dayTotals[30] ? formatDayValue(dayTotals[30]) : ''}
                                                        </td>
                                                        <td className="border border-slate-300 p-1.5 text-right font-mono font-bold align-middle bg-emerald-100 text-emerald-800">
                                                            {formatNumber(totalAmountLocal)}
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </Modal>
            )}

            {showKBPreview && (
                <Modal title="국민은행용 미리보기" onClose={() => setShowKBPreview(false)} widthClass="max-w-4xl">
                    <div className="text-sm text-slate-500 mb-3">A~E 항목 순서를 국민은행 양식과 동일하게 맞췄습니다.</div>
                    <div className="overflow-auto max-h-[60vh]">
                        <table className="w-full text-sm border border-slate-200">
                            <thead className="bg-amber-100">
                                <tr>
                                    <th className="px-3 py-2 border-b border-slate-300 text-left font-bold">A. 은행코드</th>
                                    <th className="px-3 py-2 border-b border-slate-300 text-left font-bold">B. 계좌번호</th>
                                    <th className="px-3 py-2 border-b border-slate-300 text-right font-bold">C. 이체금액</th>
                                    <th className="px-3 py-2 border-b border-slate-300 text-left font-bold">D. 받는분통장표시</th>
                                    <th className="px-3 py-2 border-b border-slate-300 text-left font-bold">E. 내통장메모</th>
                                </tr>
                            </thead>
                            <tbody>
                                {kbRows.map((row, idx) => (
                                    <tr key={`kb-row-${idx}`} className="border-b border-slate-200">
                                        <td className="px-3 py-2">{row.bankCode}</td>
                                        <td className="px-3 py-2">{row.accountNumber}</td>
                                        <td className="px-3 py-2 text-right font-mono">{formatNumber(row.amount)}</td>
                                        <td className="px-3 py-2">{row.accountHolder}</td>
                                        <td className="px-3 py-2">{row.description}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="flex justify-end mt-4">
                        <ActionButton variant="solid-amber" disabled={kbRows.length === 0} onClick={handleDownloadKB}>
                            <FontAwesomeIcon icon={faFileExcel} />
                            국민은행용 다운로드
                        </ActionButton>
                    </div>
                </Modal>
            )}
        </div>
    );
};

// --- Sub Components ---
interface ActionButtonProps {
    children: React.ReactNode;
    variant: 'outline-green' | 'outline-amber' | 'solid-green' | 'solid-amber';
    disabled?: boolean;
    onClick?: () => void | Promise<void>;
    className?: string;
}

const ActionButton: React.FC<ActionButtonProps> = ({ children, variant, disabled, onClick, className }) => {
    const base = 'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60';
    const variants: Record<ActionButtonProps['variant'], string> = {
        'outline-green': 'border border-emerald-600 text-emerald-700 hover:bg-emerald-50 focus-visible:ring-emerald-500',
        'outline-amber': 'border border-amber-500 text-amber-600 hover:bg-amber-50 focus-visible:ring-amber-400',
        'solid-green': 'bg-emerald-600 text-white hover:bg-emerald-500 focus-visible:ring-emerald-500',
        'solid-amber': 'bg-amber-500 text-white hover:bg-amber-400 focus-visible:ring-amber-400'
    };
    return (
        <button type="button" className={`${base} ${variants[variant]} ${className ?? ''}`} disabled={disabled} onClick={onClick}>
            {children}
        </button>
    );
};

interface SummaryCardProps {
    label: string;
    value: React.ReactNode;
    icon: any;
    tone: 'emerald' | 'sky' | 'orange' | 'violet';
}

const SummaryCard: React.FC<SummaryCardProps> = ({ label, value, icon, tone }) => {
    const toneMap: Record<SummaryCardProps['tone'], { bg: string; text: string }> = {
        emerald: { bg: 'bg-emerald-50 text-emerald-600', text: 'text-emerald-700' },
        sky: { bg: 'bg-sky-50 text-sky-600', text: 'text-sky-700' },
        orange: { bg: 'bg-orange-50 text-orange-600', text: 'text-orange-700' },
        violet: { bg: 'bg-violet-50 text-violet-600', text: 'text-violet-700' }
    };
    return (
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className={`mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl ${toneMap[tone].bg}`}>
                <FontAwesomeIcon icon={icon} className="text-lg" />
            </div>
            <p className="text-sm text-gray-500">{label}</p>
            <p className={`text-xl font-semibold ${toneMap[tone].text}`}>{value}</p>
        </div>
    );
};

interface ModalProps {
    title: string;
    onClose: () => void;
    widthClass?: string;
    children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ title, onClose, widthClass = 'max-w-2xl', children }) => (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4">
        <div className={`w-full rounded-2xl bg-white shadow-xl ${widthClass} flex flex-col max-h-[90vh]`}>
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
                <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
                <button
                    type="button"
                    className="text-gray-400 transition-colors hover:text-gray-600"
                    aria-label="닫기"
                    onClick={onClose}
                >
                    <FontAwesomeIcon icon={faXmark} className="text-xl" />
                </button>
            </div>
            {children}
        </div>
    </div>
);

export default SupportTeamPaymentPage;
