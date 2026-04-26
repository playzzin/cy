import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
    DAY_LABELS_FIRST
} from '../../utils/excel/SupportPaymentExcelGenerator';
import { Team, teamService } from '../../services/teamService';
import { Company, companyService } from '../../services/companyService';
import { Site, siteService } from '../../services/siteService';
import { manpowerService, Worker } from '../../services/manpowerService';
import { dailyReportService, DailyReport, DailyReportWorker } from '../../services/dailyReportService';
import { BANK_CODES } from './team-payment/types';
import html2canvas from 'html2canvas';

interface SupportLaborExcelRow {
    aggregateId: string;
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
    direction: SupportDirection;
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
    sourceTeamName?: string;
    targetTeamName?: string;
    sourceCompanyName?: string;
    targetCompanyName?: string;
    counterpartyName?: string;
    evidenceNote?: string;
}

type SupportDirection = '내부지원간곳' | '내부지원온곳' | '외부지원간곳' | '외부지원온곳';

interface SupportSiteRow {
    siteId: string;
    siteName: string;
    direction: SupportDirection;
    sourceTeamName: string;
    counterpartyName: string;
    evidenceNote: string;
    totalManDay: number;
    totalAmount: number;
    unitPriceSamples: number[];
    displayContent: string;
    workers: SupportWorkerBreakdown[];
}

interface SupportCompanyAggregate {
    aggregateId: string;
    direction: SupportDirection;
    companyId: string;
    companyName: string;
    sourceTeamId: string;
    sourceTeamName: string;
    counterpartyName: string;
    evidenceNote: string;
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

type DetailTarget = { aggregate: SupportCompanyAggregate; site: SupportSiteRow } | null;

interface SitePreviewBlock {
    aggregate: SupportCompanyAggregate;
    site: SupportSiteRow;
    rows: SupportLaborExcelRow[];
}

interface SupportExchangeSummaryRow {
    aggregateId: string;
    direction: SupportDirection;
    sourceTeamName: string;
    counterpartyName: string;
    supportOutTeamName: string;
    supportInTeamName: string;
    siteResponsibleTeamName: string;
    companyName: string;
    bankName: string;
    accountNumber: string;
    accountHolder: string;
    siteId: string;
    siteName: string;
    workerCount: number;
    totalManDay: number;
    totalAmount: number;
    evidenceNote: string;
}

const normalize = (value: string | undefined | null): string => (value ?? '').replace(/\s+/g, '').trim();
const normalizeName = (value: string | undefined | null): string =>
    (value ?? '').replace(/\(.*?\)/g, '').replace(/\s+/g, '').trim();
const normalizeSalaryModel = (value: unknown): string => {
    const raw = String(value ?? '').trim();
    if (!raw) return '';
    if (raw.includes('지원')) return '지원팀';
    if (raw.includes('월급')) return '월급제';
    if (raw.includes('일급')) return '일급제';
    if (raw.includes('용역')) return '용역팀';
    return raw;
};

const formatNumber = (value: number) => new Intl.NumberFormat('ko-KR').format(value);
const formatDayValue = (value: number): string => {
    if (!value) return '';
    const fixed = Number(value.toFixed(1));
    return fixed % 1 === 0 ? fixed.toFixed(0) : fixed.toFixed(1);
};

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
    const [selectedDirection, setSelectedDirection] = useState<'all' | '내부지원간곳' | '내부지원온곳' | '외부지원간곳' | '외부지원온곳'>('all');
    const [selectedSourceTeamId, setSelectedSourceTeamId] = useState<string>('');
    const [selectedSiteId, setSelectedSiteId] = useState<string>('');
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
            const teamByName = new Map<string, Team>();
            teams.forEach((team) => {
                const key = normalizeName(team.name);
                if (key && !teamByName.has(key)) {
                    teamByName.set(key, team);
                }
            });

            const companyById = new Map<string, Company>();
            companies.forEach((company) => {
                if (company.id) {
                    companyById.set(company.id, company);
                }
            });

            const siteById = new Map<string, Site>();
            sites.forEach((site) => {
                if (site.id) {
                    siteById.set(site.id, site);
                }
            });

            const cheongyeonNameKeys = [normalizeName('청연이엔지'), normalizeName('청연')].filter(Boolean);
            const isCheongyeonCompany = (companyId?: string, companyName?: string): boolean => {
                const isCheongyeonName = (name?: string): boolean => {
                    const normalized = normalizeName(name);
                    if (!normalized) return false;
                    return cheongyeonNameKeys.some((key) =>
                        normalized.includes(key) || (normalized.length >= 2 && key.includes(normalized))
                    );
                };

                const normalizedCompanyId = normalize(companyId);
                if (normalizedCompanyId) {
                    const company = companyById.get(normalizedCompanyId);
                    if (company) {
                        if (company.isMyCompany) return true;
                        if (isCheongyeonName(company.name)) return true;
                    }
                }
                return isCheongyeonName(companyName);
            };

            const aggregateMap = new Map<string, SupportCompanyAggregate>();
            const errorMessages: string[] = [];

            const ensureAggregate = (params: {
                aggregateId: string;
                direction: SupportDirection;
                companyId: string;
                companyName: string;
                sourceTeamId: string;
                sourceTeamName: string;
                counterpartyName: string;
                evidenceNote: string;
            }) => {
                const key = params.aggregateId;
                if (!aggregateMap.has(key)) {
                    const bankInfo = getCompanyBankInfo(params.companyId, params.companyName);
                    const trimmedBankName = bankInfo.bankName.trim();
                    const bankCode = trimmedBankName ? BANK_CODES[trimmedBankName] ?? '' : '';
                    const fieldErrors: SupportCompanyAggregate['errors'] = {};
                    if (!trimmedBankName) fieldErrors.bankName = true;
                    if (trimmedBankName && !bankCode) fieldErrors.bankCode = true;
                    if (!bankInfo.accountNumber) fieldErrors.accountNumber = true;
                    if (!bankInfo.accountHolder) fieldErrors.accountHolder = true;

                    if (Object.values(fieldErrors).some(Boolean)) {
                        errorMessages.push(`${params.companyName || '청구 대상 미지정'}의 계좌 정보를 확인해주세요.`);
                    }

                    aggregateMap.set(key, {
                        aggregateId: params.aggregateId,
                        direction: params.direction,
                        companyId: params.companyId,
                        companyName: params.companyName || '청구 대상 미지정',
                        sourceTeamId: params.sourceTeamId,
                        sourceTeamName: params.sourceTeamName || '팀 미지정',
                        counterpartyName: params.counterpartyName || '상대 미지정',
                        evidenceNote: params.evidenceNote,
                        bankName: trimmedBankName,
                        bankCode,
                        accountNumber: bankInfo.accountNumber,
                        accountHolder: bankInfo.accountHolder,
                        totalManDay: 0,
                        totalAmount: 0,
                        sites: [],
                        errors: fieldErrors
                    });
                }
                return aggregateMap.get(key)!;
            };

            reports.forEach((report) => {
                const reportId = report.id ?? '';
                const reportDate = report.date ?? '';
                const reportSite = report.siteId ? siteById.get(report.siteId) : undefined;

                const siteConstructorCompanyId =
                    reportSite?.constructorCompanyId ??
                    reportSite?.companyId ??
                    report.companyId ??
                    '';
                const siteConstructorCompanyName =
                    reportSite?.constructorCompanyName ??
                    reportSite?.companyName ??
                    report.companyName ??
                    '';
                const siteClassification: '청연' | '외부' =
                    isCheongyeonCompany(siteConstructorCompanyId, siteConstructorCompanyName) ? '청연' : '외부';

                report.workers.forEach((reportWorker: DailyReportWorker) => {
                    const normalizedSalary = normalizeSalaryModel(reportWorker.salaryModel ?? reportWorker.payType);
                    const isSupportModel = normalizedSalary === '지원팀';
                    const workerTeamId = (reportWorker.teamId ?? report.teamId ?? '').trim();
                    const fallbackSourceTeam = teamByName.get(normalizeName(reportWorker.workerTeamName));
                    const resolvedTeam = (workerTeamId ? teamById.get(workerTeamId) : undefined) ?? fallbackSourceTeam;
                    const isSupportTeam = normalize(resolvedTeam?.type) === '지원팀';

                    const workerCompanyId = (resolvedTeam?.companyId ?? report.companyId ?? '').trim();
                    const fallbackCompanyName =
                        resolvedTeam?.companyName ??
                        report.companyName ??
                        (workerCompanyId ? companyById.get(workerCompanyId)?.name : '') ??
                        '';
                    const workerIsCheongyeon = isCheongyeonCompany(workerCompanyId, fallbackCompanyName);

                    const sourceTeamId = (resolvedTeam?.id ?? workerTeamId ?? '').trim();
                    const sourceTeamName = resolvedTeam?.name ?? reportWorker.workerTeamName ?? report.teamName ?? '팀 미지정';

                    const targetTeamNameRaw = report.responsibleTeamName ?? reportSite?.responsibleTeamName ?? report.teamName ?? '';
                    const targetTeamIdRaw = (report.responsibleTeamId ?? reportSite?.responsibleTeamId ?? report.teamId ?? '').trim();
                    const fallbackTargetTeamByName = teamByName.get(normalizeName(targetTeamNameRaw));
                    const resolvedTargetTeam = (targetTeamIdRaw ? teamById.get(targetTeamIdRaw) : undefined) ?? fallbackTargetTeamByName;
                    const targetTeamId = (resolvedTargetTeam?.id ?? targetTeamIdRaw).trim();
                    const targetTeamName =
                        resolvedTargetTeam?.name ??
                        report.responsibleTeamName ??
                        reportSite?.responsibleTeamName ??
                        report.teamName ??
                        '팀 미지정';
                    const targetCompanyId =
                        (resolvedTargetTeam?.companyId ?? siteConstructorCompanyId ?? report.companyId ?? '').trim();
                    const targetCompanyName =
                        resolvedTargetTeam?.companyName ??
                        siteConstructorCompanyName ??
                        report.companyName ??
                        '';
                    const targetIsCheongyeon = isCheongyeonCompany(targetCompanyId, targetCompanyName);

                    type ClassifiedEntry = {
                        direction: SupportDirection;
                        companyId: string;
                        companyName: string;
                        sourceTeamId: string;
                        sourceTeamName: string;
                        counterpartyName: string;
                        evidenceNote: string;
                    };
                    const classifiedEntries: ClassifiedEntry[] = [];

                    if (workerIsCheongyeon && targetIsCheongyeon && sourceTeamId && targetTeamId && sourceTeamId !== targetTeamId) {
                        // 청연 팀 간 교차지원은 간곳/온곳을 각각 분리해 양방향 정리한다.
                        classifiedEntries.push({
                            direction: '내부지원간곳',
                            companyId: workerCompanyId || targetCompanyId,
                            companyName: fallbackCompanyName || targetCompanyName || sourceTeamName,
                            sourceTeamId,
                            sourceTeamName,
                            counterpartyName: targetTeamName || '청연 수신팀 미지정',
                            evidenceNote: '청연이엔지 소속 팀이 다른 청연이엔지 현장/팀으로 지원 나간 건'
                        });
                        classifiedEntries.push({
                            direction: '내부지원온곳',
                            companyId: targetCompanyId || workerCompanyId,
                            companyName: targetCompanyName || fallbackCompanyName || targetTeamName,
                            sourceTeamId: targetTeamId,
                            sourceTeamName: targetTeamName,
                            counterpartyName: sourceTeamName || '청연 지원팀 미지정',
                            evidenceNote: '다른 청연이엔지 팀이 우리 청연이엔지 현장/팀으로 지원 온 건'
                        });
                    } else if (siteClassification === '외부' && workerIsCheongyeon) {
                        classifiedEntries.push({
                            direction: '외부지원간곳',
                            companyId: workerCompanyId,
                            companyName: fallbackCompanyName || sourceTeamName || '청구 대상',
                            sourceTeamId,
                            sourceTeamName,
                            counterpartyName: siteConstructorCompanyName || report.siteName || '외부 현장',
                            evidenceNote: '청연이엔지 소속 팀이 외부 시공사 현장으로 지원 나간 건'
                        });
                    } else if (siteClassification === '청연' && !workerIsCheongyeon) {
                        // 외부 팀이 청연 현장으로 지원온 경우는 수신 팀(청연)을 기준으로 묶는다.
                        classifiedEntries.push({
                            direction: '외부지원온곳',
                            companyId: workerCompanyId,
                            companyName: fallbackCompanyName || '외부팀',
                            sourceTeamId: targetTeamId || sourceTeamId,
                            sourceTeamName: targetTeamName || sourceTeamName,
                            counterpartyName: sourceTeamName || fallbackCompanyName || '외부 지원팀',
                            evidenceNote: '외부팀이 청연이엔지 현장/팀으로 지원 온 건'
                        });
                    } else if (siteClassification === '청연' && (isSupportModel || isSupportTeam)) {
                        classifiedEntries.push({
                            direction: '외부지원온곳',
                            companyId: workerCompanyId,
                            companyName: fallbackCompanyName || sourceTeamName || '청구 대상',
                            sourceTeamId: targetTeamId || sourceTeamId,
                            sourceTeamName: targetTeamName || sourceTeamName,
                            counterpartyName: sourceTeamName || fallbackCompanyName || '외부 지원팀',
                            evidenceNote: '지원팀 소속 또는 외부팀이 청연이엔지 현장/팀으로 지원 온 건'
                        });
                    }
                    if (classifiedEntries.length === 0) return;

                    const unitPrice =
                        typeof reportWorker.unitPrice === 'number' && Number.isFinite(reportWorker.unitPrice)
                            ? reportWorker.unitPrice
                            : resolvedTeam?.supportRate ?? 0;
                    const manDay =
                        typeof reportWorker.manDay === 'number' && Number.isFinite(reportWorker.manDay)
                            ? reportWorker.manDay
                            : 0;
                    const amount = Math.round(manDay * unitPrice);

                    const siteId = report.siteId ?? 'unknown-site';
                    const siteName = report.siteName ?? '현장 미지정';
                    classifiedEntries.forEach((entry) => {
                        const workerRecord: SupportWorkerBreakdown = {
                            date: reportDate,
                            reportId,
                            direction: entry.direction,
                            workerId: reportWorker.workerId ?? `${reportId}-${siteId}-${reportWorker.name ?? 'worker'}`,
                            workerName: reportWorker.name ?? '이름 미상',
                            role: reportWorker.role,
                            manDay,
                            unitPrice,
                            amount,
                            siteId: report.siteId,
                            siteName: report.siteName,
                            teamId: resolvedTeam?.id ?? sourceTeamId,
                            teamName: resolvedTeam?.name ?? sourceTeamName,
                            sourceTeamName: entry.sourceTeamName,
                            targetTeamName,
                            sourceCompanyName: fallbackCompanyName,
                            targetCompanyName,
                            counterpartyName: entry.counterpartyName,
                            evidenceNote: entry.evidenceNote
                        };

                        const companyDisplayName = entry.companyName || entry.sourceTeamName || '청구 대상';
                        const aggregateId = [
                            entry.direction,
                            normalize(entry.companyId) || normalizeName(companyDisplayName) || 'unknown',
                            normalize(entry.sourceTeamId) || normalizeName(entry.sourceTeamName) || 'unknown',
                            normalizeName(entry.counterpartyName) || 'counterparty'
                        ].join('::');

                        const aggregate = ensureAggregate({
                            aggregateId,
                            direction: entry.direction,
                            companyId: entry.companyId,
                            companyName: companyDisplayName,
                            sourceTeamId: entry.sourceTeamId,
                            sourceTeamName: entry.sourceTeamName,
                            counterpartyName: entry.counterpartyName,
                            evidenceNote: entry.evidenceNote
                        });

                        aggregate.totalManDay += manDay;
                        aggregate.totalAmount += amount;

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
                                direction: entry.direction,
                                sourceTeamName: entry.sourceTeamName,
                                counterpartyName: entry.counterpartyName,
                                evidenceNote: entry.evidenceNote,
                                totalManDay: manDay,
                                totalAmount: amount,
                                unitPriceSamples: unitPrice > 0 ? [unitPrice] : [],
                                displayContent: `${siteName} ${entry.direction}`,
                                workers: [workerRecord]
                            });
                        }
                    });
                });
            });

            const aggregatesList = Array.from(aggregateMap.values()).map((aggregate) => ({
                ...aggregate,
                sites: aggregate.sites
                    .map((site: SupportSiteRow) => ({
                        ...site,
                        workers: [...site.workers].sort((a: SupportWorkerBreakdown, b: SupportWorkerBreakdown) =>
                            a.workerName.localeCompare(b.workerName, 'ko-KR')
                        )
                    }))
                    .sort((a: SupportSiteRow, b: SupportSiteRow) => a.siteName.localeCompare(b.siteName, 'ko-KR'))
            }));

            return { aggregates: aggregatesList, errorMessages };
        },
        [companies, getCompanyBankInfo, sites, teams]
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
        let rows = aggregates;
        if (selectedCompanyId) {
            rows = rows.filter((aggregate) => normalize(aggregate.aggregateId) === normalize(selectedCompanyId));
        }
        if (selectedDirection !== 'all') {
            rows = rows.filter((aggregate) => aggregate.direction === selectedDirection);
        }
        if (selectedSourceTeamId) {
            rows = rows.filter((aggregate) => normalize(aggregate.sourceTeamId) === normalize(selectedSourceTeamId));
        }
        if (selectedSiteId) {
            rows = rows
                .map((aggregate) => ({
                    ...aggregate,
                    sites: aggregate.sites.filter((site) => normalize(site.siteId) === normalize(selectedSiteId))
                }))
                .filter((aggregate) => aggregate.sites.length > 0);
        }
        return rows;
    }, [aggregates, selectedCompanyId, selectedDirection, selectedSiteId, selectedSourceTeamId]);

    const availableCompanyOptions = useMemo(() => {
        const optionMap = new Map<string, string>();
        aggregates.forEach((aggregate) => {
            optionMap.set(
                normalize(aggregate.aggregateId),
                `${aggregate.direction} · ${aggregate.sourceTeamName} · ${aggregate.companyName}`
            );
        });
        return Array.from(optionMap.entries())
            .map(([id, name]) => ({ id, name }))
            .sort((a, b) => a.name.localeCompare(b.name, 'ko-KR'));
    }, [aggregates]);

    const directionOptions = useMemo(
        () => [
            { id: 'all', name: '전체' },
            { id: '내부지원간곳', name: '내부지원간곳' },
            { id: '내부지원온곳', name: '내부지원온곳' },
            { id: '외부지원간곳', name: '외부지원간곳' },
            { id: '외부지원온곳', name: '외부지원온곳' }
        ],
        []
    );

    const sourceTeamOptions = useMemo(() => {
        const map = new Map<string, string>();
        aggregates.forEach((aggregate) => {
            const teamId = normalize(aggregate.sourceTeamId);
            if (!teamId) return;
            if (!map.has(teamId)) {
                map.set(teamId, aggregate.sourceTeamName || '팀 미지정');
            }
        });
        return Array.from(map.entries())
            .map(([id, name]) => ({ id, name }))
            .sort((a, b) => a.name.localeCompare(b.name, 'ko-KR'));
    }, [aggregates]);

    const siteOptions = useMemo(() => {
        const map = new Map<string, string>();
        aggregates.forEach((aggregate) => {
            aggregate.sites.forEach((site) => {
                const id = normalize(site.siteId);
                if (!id) return;
                if (!map.has(id)) {
                    map.set(id, site.siteName || '현장 미지정');
                }
            });
        });
        return Array.from(map.entries())
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

    useEffect(() => {
        if (!selectedSourceTeamId) return;
        const exists = sourceTeamOptions.some((option) => normalize(option.id) === normalize(selectedSourceTeamId));
        if (!exists) {
            setSelectedSourceTeamId('');
        }
    }, [selectedSourceTeamId, sourceTeamOptions]);

    useEffect(() => {
        if (!selectedSiteId) return;
        const exists = siteOptions.some((option) => normalize(option.id) === normalize(selectedSiteId));
        if (!exists) {
            setSelectedSiteId('');
        }
    }, [selectedSiteId, siteOptions]);

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
                            aggregateId: aggregate.aggregateId,
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

    const directionSummaries = useMemo(() => {
        const directions: SupportDirection[] = ['내부지원간곳', '내부지원온곳', '외부지원간곳', '외부지원온곳'];
        return directions.map((direction) => {
            const matched = filteredAggregates.filter((aggregate) => aggregate.direction === direction);
            return {
                direction,
                aggregateCount: matched.length,
                totalManDay: matched.reduce((sum, aggregate) => sum + aggregate.totalManDay, 0),
                totalAmount: matched.reduce((sum, aggregate) => sum + aggregate.totalAmount, 0)
            };
        });
    }, [filteredAggregates]);

    const exchangeSummaryRows = useMemo<SupportExchangeSummaryRow[]>(() => {
        return filteredAggregates
            .flatMap((aggregate) =>
                aggregate.sites.map((site) => {
                    const siteInfo = siteById.get(site.siteId);
                    const siteResponsibleTeamName =
                        siteInfo?.responsibleTeamName ??
                        site.workers.find((worker) => worker.targetTeamName)?.targetTeamName ??
                        '-';

                    const isIncoming = aggregate.direction.endsWith('온곳');
                    const supportOutTeamName = (isIncoming ? aggregate.counterpartyName : aggregate.sourceTeamName) || '-';
                    const supportInTeamName = (isIncoming ? aggregate.sourceTeamName : aggregate.counterpartyName) || '-';

                    return {
                        aggregateId: aggregate.aggregateId,
                        direction: aggregate.direction,
                        sourceTeamName: aggregate.sourceTeamName,
                        counterpartyName: aggregate.counterpartyName,
                        supportOutTeamName,
                        supportInTeamName,
                        siteResponsibleTeamName,
                        companyName: aggregate.companyName,
                        bankName: aggregate.bankName,
                        accountNumber: aggregate.accountNumber,
                        accountHolder: aggregate.accountHolder,
                        siteId: site.siteId,
                        siteName: site.siteName,
                        workerCount: new Set(site.workers.map((worker) => worker.workerId)).size,
                        totalManDay: site.totalManDay,
                        totalAmount: site.totalAmount,
                        evidenceNote: aggregate.evidenceNote
                    };
                })
            )
            .sort((left, right) => {
                const directionCompare = left.direction.localeCompare(right.direction, 'ko-KR');
                if (directionCompare !== 0) return directionCompare;
                const teamCompare = left.sourceTeamName.localeCompare(right.sourceTeamName, 'ko-KR');
                if (teamCompare !== 0) return teamCompare;
                return left.siteName.localeCompare(right.siteName, 'ko-KR');
            });
    }, [filteredAggregates, siteById]);

    const photoStyleSummaryGroups = useMemo(() => {
        const orderedDirections: SupportDirection[] = ['외부지원간곳', '외부지원온곳', '내부지원간곳', '내부지원온곳'];
        const toneMap: Record<SupportDirection, { label: string; cellClass: string }> = {
            '외부지원간곳': { label: '외부지원간곳', cellClass: 'bg-yellow-100 text-yellow-900' },
            '외부지원온곳': { label: '외부지원온곳', cellClass: 'bg-orange-100 text-orange-900' },
            '내부지원간곳': { label: '내부지원간곳', cellClass: 'bg-sky-100 text-sky-900' },
            '내부지원온곳': { label: '내부지원온곳', cellClass: 'bg-indigo-100 text-indigo-900' }
        };

        return orderedDirections
            .map((direction) => ({
                direction,
                label: toneMap[direction].label,
                cellClass: toneMap[direction].cellClass,
                rows: exchangeSummaryRows.filter((row) => row.direction === direction)
            }));
    }, [exchangeSummaryRows]);

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
                    description: `${aggregate.direction} ${aggregate.sourceTeamName} ${site.displayContent} ${label}`
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
                    const rows = supportExcelRows.filter(
                        (row) =>
                            row.aggregateId === aggregate.aggregateId &&
                            (row.siteId === site.siteId || row.siteName === site.siteName)
                    );
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

    const handleDownloadLabor = async () => {
        if (filteredAggregates.length === 0) {
            window.alert('다운로드할 데이터가 없습니다.');
            return;
        }

        const exportAggregates = filteredAggregates.map((aggregate) => ({
            ...aggregate,
            companyName: `${aggregate.direction}_${aggregate.sourceTeamName}_${aggregate.companyName}`
        }));

        await generateLaborStatementExcel(exportAggregates as any, selectedMonth);
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
        <div className="p-6 max-w-[1600px] w-full mx-auto">
            <div className="border-b border-slate-200 bg-white px-6 py-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                    <div className="bg-amber-100 text-amber-600 rounded-xl px-3 py-2 text-xl">
                        <FontAwesomeIcon icon={faUsers} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">지원팀 지급 관리</h1>
                        <p className="text-sm text-slate-500">지원간곳/지원온곳 규칙 기반 팀별 청구 집계 및 출력</p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    <ActionButton variant="solid-green" disabled={supportExcelRows.length === 0} onClick={handleOpenLaborPreview}>
                        <FontAwesomeIcon icon={faFileExcel} />
                        노무내역서 미리보기
                    </ActionButton>
                    <ActionButton variant="outline-green" disabled={supportExcelRows.length === 0} onClick={handleDownloadLabor}>
                        <FontAwesomeIcon icon={faFileExcel} />
                        노무내역서 다운로드
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

            <div className="space-y-4">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center flex-wrap">
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

                        <select
                            value={selectedDirection}
                            onChange={(e) => setSelectedDirection(e.target.value as 'all' | '내부지원간곳' | '내부지원온곳' | '외부지원간곳' | '외부지원온곳')}
                            className="border border-slate-300 rounded-lg px-3 py-2 min-w-[140px] focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                        >
                            {directionOptions.map((option) => (
                                <option key={option.id} value={option.id}>
                                    분류: {option.name}
                                </option>
                            ))}
                        </select>

                        <select
                            value={selectedSourceTeamId}
                            onChange={(e) => setSelectedSourceTeamId(e.target.value)}
                            className="border border-slate-300 rounded-lg px-3 py-2 min-w-[180px] focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                            disabled={sourceTeamOptions.length === 0}
                        >
                            <option value="">팀: 전체</option>
                            {sourceTeamOptions.map((team) => (
                                <option key={team.id} value={team.id}>
                                    팀: {team.name}
                                </option>
                            ))}
                        </select>

                        <select
                            value={selectedSiteId}
                            onChange={(e) => setSelectedSiteId(e.target.value)}
                            className="border border-slate-300 rounded-lg px-3 py-2 min-w-[180px] focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                            disabled={siteOptions.length === 0}
                        >
                            <option value="">현장: 전체</option>
                            {siteOptions.map((site) => (
                                <option key={site.id} value={site.id}>
                                    현장: {site.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <label className="text-sm font-medium text-slate-600">팀별 청구 필터</label>
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
                    <SummaryCard label="팀 청구 묶음" value={`${formatNumber(totalSummary.partnerCount)} 건`} icon={faUsers} tone="sky" />
                    <SummaryCard label="현장 수" value={`${formatNumber(totalSummary.siteCount)} 곳`} icon={faCircleExclamation} tone="orange" />
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {directionSummaries.map((summary) => (
                        <DirectionSummaryCard
                            key={summary.direction}
                            direction={summary.direction}
                            aggregateCount={summary.aggregateCount}
                            totalManDay={summary.totalManDay}
                            totalAmount={summary.totalAmount}
                        />
                    ))}
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100">
                        <h2 className="text-lg font-semibold text-slate-800">사진형 정리표</h2>
                        <p className="text-sm text-slate-500 mt-1">분류별로 좌측 라벨을 고정해 한눈에 확인할 수 있도록 정리했습니다.</p>
                    </div>
                    <div className="overflow-auto">
                        <table className="w-full text-sm border-collapse">
                            <thead className="bg-amber-100 text-slate-800">
                                <tr>
                                    <th className="px-4 py-3 border border-slate-300 text-center min-w-[120px]">분류</th>
                                    <th className="px-4 py-3 border border-slate-300 text-left min-w-[160px]">현장</th>
                                    <th className="px-4 py-3 border border-slate-300 text-left min-w-[120px]">담당</th>
                                    <th className="px-4 py-3 border border-slate-300 text-left min-w-[140px]">시공사</th>
                                    <th className="px-4 py-3 border border-slate-300 text-left min-w-[140px]">팀</th>
                                    <th className="px-4 py-3 border border-slate-300 text-right min-w-[90px]">공수</th>
                                    <th className="px-4 py-3 border border-slate-300 text-right min-w-[120px]">금액</th>
                                    <th className="px-4 py-3 border border-slate-300 text-left min-w-[220px]">계좌</th>
                                </tr>
                            </thead>
                            <tbody>
                                {photoStyleSummaryGroups.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="px-4 py-8 text-center text-slate-500 border border-slate-200">
                                            표시할 데이터가 없습니다.
                                        </td>
                                    </tr>
                                ) : (
                                    photoStyleSummaryGroups.map((group) =>
                                        group.rows.length === 0 ? (
                                            <tr key={`${group.direction}-empty`} className="hover:bg-slate-50">
                                                <td className={`px-3 py-3 border border-slate-300 text-center font-semibold align-middle ${group.cellClass}`}>
                                                    {group.label}
                                                </td>
                                                <td className="px-4 py-3 border border-slate-200 text-slate-400" colSpan={7}>
                                                    해당 분류 데이터 없음
                                                </td>
                                            </tr>
                                        ) : (
                                            group.rows.map((row, index) => {
                                                const accountText = [row.bankName, row.accountNumber, row.accountHolder ? `(예금주:${row.accountHolder})` : '']
                                                    .filter(Boolean)
                                                    .join(' ');

                                                return (
                                                    <tr key={`${group.direction}-${row.aggregateId}-${row.siteId}`} className="hover:bg-slate-50">
                                                        {index === 0 && (
                                                            <td
                                                                rowSpan={group.rows.length}
                                                                className={`px-3 py-3 border border-slate-300 text-center font-semibold align-middle ${group.cellClass}`}
                                                            >
                                                                {group.label}
                                                            </td>
                                                        )}
                                                        <td className="px-4 py-3 border border-slate-200 text-slate-700">{row.siteName}</td>
                                                        <td className="px-4 py-3 border border-slate-200 font-medium text-slate-800">{row.siteResponsibleTeamName}</td>
                                                        <td className="px-4 py-3 border border-slate-200 text-slate-700">{row.companyName}</td>
                                                        <td className="px-4 py-3 border border-slate-200 text-slate-700">
                                                            <div className="font-medium">{row.supportOutTeamName} → {row.supportInTeamName}</div>
                                                            <div className="text-[11px] text-slate-500">지원간팀 → 지원온팀</div>
                                                        </td>
                                                        <td className="px-4 py-3 border border-slate-200 text-right font-mono">{row.totalManDay.toFixed(1)}</td>
                                                        <td className="px-4 py-3 border border-slate-200 text-right font-mono font-semibold text-slate-800">{formatNumber(row.totalAmount)}</td>
                                                        <td className="px-4 py-3 border border-slate-200 text-slate-600 text-xs">{accountText || '-'}</td>
                                                    </tr>
                                                );
                                            })
                                        )
                                    )
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100">
                        <h2 className="text-lg font-semibold text-slate-800">주고받은 내역 요약</h2>
                        <p className="text-sm text-slate-500 mt-1">분류별로 어떤 팀이 누구와 어떤 현장에서 주고받았는지 한 줄씩 검증할 수 있습니다.</p>
                    </div>
                    <div className="overflow-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wide">
                                <tr>
                                    <th className="px-4 py-3 text-left">분류</th>
                                    <th className="px-4 py-3 text-left">기준 팀</th>
                                    <th className="px-4 py-3 text-left">상대</th>
                                    <th className="px-4 py-3 text-left">청구대상</th>
                                    <th className="px-4 py-3 text-left">현장</th>
                                    <th className="px-4 py-3 text-right">인원</th>
                                    <th className="px-4 py-3 text-right">공수</th>
                                    <th className="px-4 py-3 text-right">금액</th>
                                    <th className="px-4 py-3 text-left">판정근거</th>
                                </tr>
                            </thead>
                            <tbody>
                                {exchangeSummaryRows.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="px-4 py-8 text-center text-slate-500">표시할 주고받은 내역이 없습니다.</td>
                                    </tr>
                                ) : (
                                    exchangeSummaryRows.map((row) => (
                                        <tr key={`${row.aggregateId}-${row.siteId}`} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                                            <td className="px-4 py-3">
                                                <span className="inline-flex items-center rounded bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                                                    {row.direction}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 font-medium text-slate-700">{row.sourceTeamName}</td>
                                            <td className="px-4 py-3 text-slate-600">{row.counterpartyName}</td>
                                            <td className="px-4 py-3 text-slate-600">{row.companyName}</td>
                                            <td className="px-4 py-3 text-slate-600">{row.siteName}</td>
                                            <td className="px-4 py-3 text-right font-mono">{formatNumber(row.workerCount)}</td>
                                            <td className="px-4 py-3 text-right font-mono">{row.totalManDay.toFixed(1)}</td>
                                            <td className="px-4 py-3 text-right font-mono font-semibold text-slate-800">{formatNumber(row.totalAmount)}</td>
                                            <td className="px-4 py-3 text-xs text-slate-500">{row.evidenceNote}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
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
                        const hasAccountError = Object.values(aggregate.errors).some(Boolean);
                        return (
                            <div key={aggregate.aggregateId} className="bg-white rounded-2xl border border-slate-200 shadow-sm">
                                <div className="px-6 py-4 border-b border-slate-100 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                    <div>
                                        <div className="text-sm text-slate-500">분류 / 팀 / 청구대상</div>
                                        <div className="text-xl font-semibold text-slate-800 flex items-center gap-2">
                                            <span className="inline-flex items-center rounded bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                                                {aggregate.direction}
                                            </span>
                                            <span>{aggregate.sourceTeamName}</span>
                                            <span className="text-sm text-slate-500">({aggregate.companyName})</span>
                                            {hasAccountError && (
                                                <span className="text-xs text-amber-600 bg-amber-50 border border-amber-300 rounded px-2 py-0.5">
                                                    계좌정보 확인
                                                </span>
                                            )}
                                        </div>
                                        <div className="mt-2 text-sm text-slate-500">
                                            상대: <span className="font-medium text-slate-700">{aggregate.counterpartyName}</span>
                                            <span className="mx-2 text-slate-300">|</span>
                                            판정근거: <span className="text-slate-600">{aggregate.evidenceNote}</span>
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
                                                            onClick={() => setDetailTarget({ aggregate, site })}
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
                <Modal title={`${detailTarget.site.siteName} 상세 내역`} onClose={() => setDetailTarget(null)} widthClass="max-w-5xl">
                    <div className="flex-1 overflow-auto p-6">
                        <div className="mb-4 grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 md:grid-cols-2">
                            <div>분류: <span className="font-semibold text-slate-800">{detailTarget.aggregate.direction}</span></div>
                            <div>기준 팀: <span className="font-semibold text-slate-800">{detailTarget.aggregate.sourceTeamName}</span></div>
                            <div>상대: <span className="font-semibold text-slate-800">{detailTarget.aggregate.counterpartyName}</span></div>
                            <div>청구대상: <span className="font-semibold text-slate-800">{detailTarget.aggregate.companyName}</span></div>
                            <div className="md:col-span-2">판정근거: <span className="text-slate-700">{detailTarget.aggregate.evidenceNote}</span></div>
                        </div>
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 text-slate-500 text-xs uppercase sticky top-0 z-10">
                                <tr>
                                    <th className="px-3 py-2 border-b border-slate-200 text-left">분류</th>
                                    <th className="px-3 py-2 border-b border-slate-200 text-left">성명</th>
                                    <th className="px-3 py-2 border-b border-slate-200 text-left">직책</th>
                                    <th className="px-3 py-2 border-b border-slate-200 text-left">상대</th>
                                    <th className="px-3 py-2 border-b border-slate-200 text-center">공수</th>
                                    <th className="px-3 py-2 border-b border-slate-200 text-right">단가</th>
                                    <th className="px-3 py-2 border-b border-slate-200 text-right">금액</th>
                                    <th className="px-3 py-2 border-b border-slate-200 text-center">보고일</th>
                                </tr>
                            </thead>
                            <tbody>
                                {detailTarget.site.workers.map((worker) => (
                                    <tr key={`${worker.workerId}-${worker.date}`} className="border-b border-slate-100">
                                        <td className="px-3 py-2">
                                            <span className="inline-flex items-center rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                                                {worker.direction}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2">{worker.workerName}</td>
                                        <td className="px-3 py-2 text-slate-500">{worker.role || '-'}</td>
                                        <td className="px-3 py-2 text-slate-500">{worker.counterpartyName || '-'}</td>
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
                                const key = `${normalize(aggregate.aggregateId)}-${normalize(site.siteId)}`;
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
                                                {aggregate.direction} / {aggregate.sourceTeamName} / {displayCompanyName} / {displaySiteName}
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

interface DirectionSummaryCardProps {
    direction: SupportDirection;
    aggregateCount: number;
    totalManDay: number;
    totalAmount: number;
}

const DirectionSummaryCard: React.FC<DirectionSummaryCardProps> = ({ direction, aggregateCount, totalManDay, totalAmount }) => {
    const toneMap: Record<SupportDirection, string> = {
        '내부지원간곳': 'border-violet-200 bg-violet-50 text-violet-700',
        '내부지원온곳': 'border-sky-200 bg-sky-50 text-sky-700',
        '외부지원간곳': 'border-emerald-200 bg-emerald-50 text-emerald-700',
        '외부지원온곳': 'border-amber-200 bg-amber-50 text-amber-700'
    };

    return (
        <div className={`rounded-2xl border p-4 shadow-sm ${toneMap[direction]}`}>
            <div className="text-sm font-semibold">{direction}</div>
            <div className="mt-2 text-sm">청구 묶음 {formatNumber(aggregateCount)}건</div>
            <div className="mt-1 text-sm">공수 {formatNumber(totalManDay)}공</div>
            <div className="mt-1 text-base font-bold">{formatNumber(totalAmount)}원</div>
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
