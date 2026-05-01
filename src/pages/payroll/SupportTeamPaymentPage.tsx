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
    faXmark,
    faCamera,
    faChevronRight
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
    workerTeamId?: string;
    workerTeamName?: string;
    viewTeamId?: string;
    viewTeamName?: string;
    sourceTeamName?: string;
    targetTeamName?: string;
    siteResponsibleTeamId?: string;
    siteResponsibleTeamName?: string;
    settlementTeamId?: string;
    settlementTeamName?: string;
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
    viewTeamId: string;
    viewTeamName: string;
    sourceTeamIds: string[];
    sourceTeamNames: string[];
    sourceTeamName: string;
    counterpartyName: string;
    evidenceNote: string;
    settlementRule: string;
    totalManDay: number;
    totalAmount: number;
    unitPriceSamples: number[];
    displayContent: string;
    workers: SupportWorkerBreakdown[];
}

interface SupportCompanyAggregate {
    aggregateId: string;
    direction: SupportDirection;
    settlementTeamId: string;
    settlementTeamName: string;
    settlementRole: 'charge' | 'pay';
    settlementRule: string;
    viewTeamId: string;
    viewTeamName: string;
    companyId: string;
    companyName: string;
    sourceTeamIds: string[];
    sourceTeamNames: string[];
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
    targetTeamName?: string; // 지원을 받는 팀 (현장 담당팀)
    sites: SupportSiteRow[];
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

interface SupportManualAdjustment {
    additionalAmount: number;
    remark: string;
    etc: string;
}

type SupportManualAdjustments = Record<string, SupportManualAdjustment>;

const normalize = (value: string | undefined | null): string => (value ?? '').replace(/\s+/g, '').trim();
const normalizeName = (value: string | undefined | null): string =>
    (value ?? '').replace(/\(.*?\)/g, '').replace(/\s+/g, '').trim();
const CHEONGYEON_COMPANY_NAME_KEYS = [normalizeName('청연이엔지'), normalizeName('청연')].filter(Boolean);
const isCheongyeonCompanyName = (name?: string | null): boolean => {
    const normalized = normalizeName(name);
    if (!normalized) return false;
    return CHEONGYEON_COMPANY_NAME_KEYS.some((key) =>
        normalized.includes(key) || (normalized.length >= 2 && key.includes(normalized))
    );
};
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

const SUPPORT_MANUAL_STORAGE_PREFIX = 'support-team-payment-manual-v1';

const getManualStorageKey = (yearMonth: string): string => `${SUPPORT_MANUAL_STORAGE_PREFIX}:${yearMonth}`;

const normalizeManualAdjustment = (value: Partial<SupportManualAdjustment> | undefined): SupportManualAdjustment => ({
    additionalAmount: typeof value?.additionalAmount === 'number' && Number.isFinite(value.additionalAmount)
        ? Math.max(0, Math.round(value.additionalAmount))
        : 0,
    remark: String(value?.remark ?? ''),
    etc: String(value?.etc ?? '')
});

const loadManualAdjustments = (yearMonth: string): SupportManualAdjustments => {
    if (typeof window === 'undefined' || !yearMonth) return {};
    try {
        const raw = window.localStorage.getItem(getManualStorageKey(yearMonth));
        if (!raw) return {};
        const parsed = JSON.parse(raw) as Record<string, Partial<SupportManualAdjustment>>;
        return Object.entries(parsed).reduce<SupportManualAdjustments>((acc, [key, value]) => {
            acc[key] = normalizeManualAdjustment(value);
            return acc;
        }, {});
    } catch (error) {
        console.warn('[SupportTeamPaymentPage] manual adjustment load failed:', error);
        return {};
    }
};

const saveManualAdjustments = (yearMonth: string, adjustments: SupportManualAdjustments): void => {
    if (typeof window === 'undefined' || !yearMonth) return;
    try {
        window.localStorage.setItem(getManualStorageKey(yearMonth), JSON.stringify(adjustments));
    } catch (error) {
        console.warn('[SupportTeamPaymentPage] manual adjustment save failed:', error);
    }
};

const parseMoneyInput = (value: string): number => {
    const normalized = value.replace(/[^0-9.-]/g, '');
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, Math.round(parsed));
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

const SUPPORT_DIRECTION_ORDER: SupportDirection[] = ['외부지원간곳', '외부지원온곳', '내부지원간곳', '내부지원온곳'];

const SUPPORT_DIRECTION_META: Record<SupportDirection, { label: string; cellClass: string; badgeClass: string; rule: string }> = {
    외부지원간곳: {
        label: '외부지원간곳',
        cellClass: 'bg-yellow-100 text-yellow-900',
        badgeClass: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        rule: '지원간곳은 현장담당팀(현장을 맡은 팀)을 정산 주체로 묶어 청구합니다.'
    },
    외부지원온곳: {
        label: '외부지원온곳',
        cellClass: 'bg-orange-100 text-orange-900',
        badgeClass: 'bg-orange-100 text-orange-800 border-orange-200',
        rule: '지원온곳은 작업팀(현장에서 일한 작업자의 소속팀)을 정산 주체로 묶어 지급합니다.'
    },
    내부지원간곳: {
        label: '내부지원간곳',
        cellClass: 'bg-sky-100 text-sky-900',
        badgeClass: 'bg-sky-100 text-sky-800 border-sky-200',
        rule: '지원간곳은 상대 현장담당팀 기준으로 여러 현장을 통합 청구합니다.'
    },
    내부지원온곳: {
        label: '내부지원온곳',
        cellClass: 'bg-indigo-100 text-indigo-900',
        badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-200',
        rule: '지원온곳은 작업팀별로 분리해 입금 대상을 명확히 합니다.'
    }
};

const getSettlementRole = (direction: SupportDirection): 'charge' | 'pay' =>
    direction.endsWith('간곳') ? 'charge' : 'pay';

const getSettlementBasisLabel = (direction: SupportDirection): '현장담당팀' | '작업팀' =>
    direction.endsWith('간곳') ? '현장담당팀' : '작업팀';

const uniqueValues = (values: Array<string | undefined | null>): string[] => {
    const seen = new Set<string>();
    values.forEach((value) => {
        const trimmed = String(value ?? '').trim();
        if (trimmed) seen.add(trimmed);
    });
    return Array.from(seen);
};

const summarizeNames = (names: Array<string | undefined | null>, fallback = '팀 미지정'): string => {
    const unique = uniqueValues(names);
    return unique.length > 0 ? unique.join(', ') : fallback;
};

const isSameIdentity = (a?: string | null, b?: string | null): boolean =>
    !!normalize(a) && normalize(a) === normalize(b);

const matchesViewTeamIdentity = (aggregate: SupportCompanyAggregate, teamIdOrName: string): boolean =>
    isSameIdentity(aggregate.viewTeamId, teamIdOrName) ||
    (!!normalizeName(teamIdOrName) && normalizeName(aggregate.viewTeamName) === normalizeName(teamIdOrName));

const recalcSiteFromWorkers = (site: SupportSiteRow, workers: SupportWorkerBreakdown[]): SupportSiteRow => {
    const sourceTeamIds = uniqueValues(workers.map((worker) => worker.workerTeamId ?? worker.teamId));
    const sourceTeamNames = uniqueValues(workers.map((worker) => worker.workerTeamName ?? worker.teamName));
    return {
        ...site,
        sourceTeamIds,
        sourceTeamNames,
        sourceTeamName: summarizeNames(sourceTeamNames),
        totalManDay: workers.reduce((sum, worker) => sum + worker.manDay, 0),
        totalAmount: workers.reduce((sum, worker) => sum + worker.amount, 0),
        unitPriceSamples: workers.map((worker) => worker.unitPrice).filter((unitPrice) => unitPrice > 0),
        workers
    };
};

const recalcAggregateFromSites = (aggregate: SupportCompanyAggregate, sites: SupportSiteRow[]): SupportCompanyAggregate => {
    const allWorkers = sites.flatMap((site) => site.workers);
    const sourceTeamIds = uniqueValues(allWorkers.map((worker) => worker.workerTeamId ?? worker.teamId));
    const sourceTeamNames = uniqueValues(allWorkers.map((worker) => worker.workerTeamName ?? worker.teamName));
    return {
        ...aggregate,
        sourceTeamIds,
        sourceTeamNames,
        sourceTeamId: sourceTeamIds[0] ?? '',
        sourceTeamName: summarizeNames(sourceTeamNames),
        totalManDay: sites.reduce((sum, site) => sum + site.totalManDay, 0),
        totalAmount: sites.reduce((sum, site) => sum + site.totalAmount, 0),
        sites
    };
};

const getSettlementMergeKey = (aggregate: SupportCompanyAggregate): string => [
    aggregate.direction,
    normalize(aggregate.settlementTeamId) ||
        normalize(aggregate.companyId) ||
        normalizeName(aggregate.settlementTeamName) ||
        normalizeName(aggregate.companyName) ||
        'unknown-settlement'
].join('::');

const mergeSitesByIdentity = (sites: SupportSiteRow[]): SupportSiteRow[] => {
    const siteMap = new Map<string, SupportSiteRow>();

    sites.forEach((site) => {
        const key = normalize(site.siteId) || normalizeName(site.siteName) || `unknown-site-${siteMap.size}`;
        const existing = siteMap.get(key);
        if (!existing) {
            siteMap.set(key, {
                ...site,
                sourceTeamIds: [...site.sourceTeamIds],
                sourceTeamNames: [...site.sourceTeamNames],
                unitPriceSamples: [...site.unitPriceSamples],
                workers: [...site.workers]
            });
            return;
        }

        existing.workers = [...existing.workers, ...site.workers];
        existing.unitPriceSamples = [...existing.unitPriceSamples, ...site.unitPriceSamples];
        existing.sourceTeamIds = uniqueValues([...existing.sourceTeamIds, ...site.sourceTeamIds]);
        existing.sourceTeamNames = uniqueValues([...existing.sourceTeamNames, ...site.sourceTeamNames]);
        existing.viewTeamName = summarizeNames([existing.viewTeamName, site.viewTeamName]);
        existing.sourceTeamName = summarizeNames([...existing.sourceTeamNames]);
    });

    return Array.from(siteMap.values())
        .map((site) => {
            const workers = [...site.workers].sort((a, b) => a.workerName.localeCompare(b.workerName, 'ko-KR'));
            const recalculated = recalcSiteFromWorkers(site, workers);
            return {
                ...recalculated,
                viewTeamName: summarizeNames(workers.map((worker) => worker.viewTeamName), site.viewTeamName),
                viewTeamId: uniqueValues(workers.map((worker) => worker.viewTeamId))[0] ?? site.viewTeamId
            };
        })
        .sort((a, b) => a.siteName.localeCompare(b.siteName, 'ko-KR'));
};

const mergeAggregatesBySettlementTeam = (rows: SupportCompanyAggregate[]): SupportCompanyAggregate[] => {
    const grouped = new Map<string, SupportCompanyAggregate[]>();
    rows.forEach((aggregate) => {
        const key = getSettlementMergeKey(aggregate);
        grouped.set(key, [...(grouped.get(key) ?? []), aggregate]);
    });

    return Array.from(grouped.entries())
        .map(([key, group]) => {
            if (group.length === 1) return group[0];

            const base = group[0];
            const viewTeamIds = uniqueValues(group.map((aggregate) => aggregate.viewTeamId));
            const viewTeamNames = uniqueValues(group.map((aggregate) => aggregate.viewTeamName));
            const sourceTeamIds = uniqueValues(group.flatMap((aggregate) => aggregate.sourceTeamIds));
            const sourceTeamNames = uniqueValues(group.flatMap((aggregate) => aggregate.sourceTeamNames));
            const sites = mergeSitesByIdentity(group.flatMap((aggregate) => aggregate.sites));
            const mergedErrors = group.reduce<SupportCompanyAggregate['errors']>((acc, aggregate) => ({
                bankName: acc.bankName || aggregate.errors.bankName,
                bankCode: acc.bankCode || aggregate.errors.bankCode,
                accountNumber: acc.accountNumber || aggregate.errors.accountNumber,
                accountHolder: acc.accountHolder || aggregate.errors.accountHolder
            }), {});

            const merged = recalcAggregateFromSites({
                ...base,
                aggregateId: `merged::${key}`,
                viewTeamId: viewTeamIds[0] ?? '',
                viewTeamName: summarizeNames(viewTeamNames, '기준팀 복수'),
                sourceTeamIds,
                sourceTeamNames,
                sourceTeamId: sourceTeamIds[0] ?? '',
                sourceTeamName: summarizeNames(sourceTeamNames),
                errors: mergedErrors
            }, sites);

            return {
                ...merged,
                viewTeamId: viewTeamIds[0] ?? '',
                viewTeamName: summarizeNames(viewTeamNames, '기준팀 복수'),
                sourceTeamIds,
                sourceTeamNames,
                sourceTeamId: sourceTeamIds[0] ?? '',
                sourceTeamName: summarizeNames(sourceTeamNames)
            };
        })
        .sort((a, b) =>
            SUPPORT_DIRECTION_ORDER.indexOf(a.direction) - SUPPORT_DIRECTION_ORDER.indexOf(b.direction) ||
            a.companyName.localeCompare(b.companyName, 'ko-KR')
        );
};

const getWorkerFlowLabel = (worker: SupportWorkerBreakdown, site: SupportSiteRow): string => {
    const from = worker.workerTeamName || worker.teamName || '작업팀 미지정';
    const to = worker.siteResponsibleTeamName || worker.targetTeamName || '현장담당팀 미지정';
    return `작업팀 ${from} → 현장담당팀 ${to}`;
};

const getAggregateUnitPrice = (aggregate: SupportCompanyAggregate): number => {
    if (aggregate.totalManDay > 0) return Math.round(aggregate.totalAmount / aggregate.totalManDay);
    const sample = aggregate.sites.flatMap((site) => site.unitPriceSamples)[0];
    return Math.round(sample ?? 0);
};

const getAdjustment = (adjustments: SupportManualAdjustments, aggregateId: string): SupportManualAdjustment =>
    normalizeManualAdjustment(adjustments[aggregateId]);

const getAggregateAdditionalAmount = (aggregate: SupportCompanyAggregate, adjustments: SupportManualAdjustments): number =>
    getAdjustment(adjustments, aggregate.aggregateId).additionalAmount;

const getAggregateTotalWithAdditional = (aggregate: SupportCompanyAggregate, adjustments: SupportManualAdjustments): number =>
    aggregate.totalAmount + getAggregateAdditionalAmount(aggregate, adjustments);

const getAggregateRemarkFallback = (aggregate: SupportCompanyAggregate): string =>
    aggregate.accountHolder || aggregate.bankName || '';

const getAggregateEtcFallback = (aggregate: SupportCompanyAggregate): string => {
    if (Object.values(aggregate.errors).some(Boolean)) return '계좌 확인 필요';
    if (aggregate.sites.length > 1) return `${aggregate.sites.length}개 현장`;
    return '';
};

const formatOptionalMoney = (value: number): string => (value > 0 ? formatNumber(value) : '');

const getTeamCellClass = (direction: SupportDirection): string => {
    if (direction === '외부지원간곳') return 'bg-yellow-300 text-slate-950';
    if (direction === '외부지원온곳') return 'bg-orange-300 text-slate-950';
    if (direction === '내부지원간곳') return 'bg-sky-200 text-slate-950';
    return 'bg-lime-300 text-slate-950';
};

const SupportTeamPaymentPage: React.FC = () => {
    const today = new Date();
    const defaultMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    const [selectedMonth, setSelectedMonth] = useState<string>(defaultMonth);
    const [selectedDirection, setSelectedDirection] = useState<'all' | SupportDirection>('all');
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
    const [manualAdjustmentState, setManualAdjustmentState] = useState<{ month: string; data: SupportManualAdjustments }>(() => ({
        month: defaultMonth,
        data: loadManualAdjustments(defaultMonth)
    }));
    
    // 계층형 펼침 상태 관리
    const [expandedAggregates, setExpandedAggregates] = useState<Set<string>>(new Set());

    const manualAdjustments = manualAdjustmentState.month === selectedMonth ? manualAdjustmentState.data : {};

    useEffect(() => {
        setManualAdjustmentState({
            month: selectedMonth,
            data: loadManualAdjustments(selectedMonth)
        });
    }, [selectedMonth]);

    useEffect(() => {
        saveManualAdjustments(manualAdjustmentState.month, manualAdjustmentState.data);
    }, [manualAdjustmentState]);

    const updateManualAdjustment = useCallback((
        aggregateId: string,
        patch: Partial<SupportManualAdjustment>
    ) => {
        setManualAdjustmentState((prev) => {
            const month = prev.month === selectedMonth ? prev.month : selectedMonth;
            const baseData = prev.month === selectedMonth ? prev.data : loadManualAdjustments(selectedMonth);
            const current = normalizeManualAdjustment(baseData[aggregateId]);
            return {
                month,
                data: {
                    ...baseData,
                    [aggregateId]: normalizeManualAdjustment({ ...current, ...patch })
                }
            };
        });
    }, [selectedMonth]);

    const toggleAggregateExpand = (aggKey: string) => {
        setExpandedAggregates(prev => {
            const next = new Set(prev);
            if (next.has(aggKey)) next.delete(aggKey);
            else next.add(aggKey);
            return next;
        });
    };

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

    const aggregateReports = useCallback(
        (reports: DailyReport[]): { aggregates: SupportCompanyAggregate[]; errorMessages: string[] } => {
            const teamById = new Map<string, Team>();
            teams.forEach((team) => {
                if (team.id) teamById.set(team.id, team);
            });
            const teamByName = new Map<string, Team>();
            teams.forEach((team) => {
                const key = normalizeName(team.name);
                if (key && !teamByName.has(key)) teamByName.set(key, team);
            });

            const companyById = new Map<string, Company>();
            companies.forEach((company) => {
                if (company.id) companyById.set(company.id, company);
            });

            const siteById = new Map<string, Site>();
            sites.forEach((site) => {
                if (site.id) siteById.set(site.id, site);
            });

            const isCheongyeonCompany = (companyId?: string, companyName?: string): boolean => {
                const normalizedCompanyId = normalize(companyId);
                if (normalizedCompanyId) {
                    const company = companyById.get(normalizedCompanyId);
                    if (company) {
                        if (company.isMyCompany) return true;
                        if (isCheongyeonCompanyName(company.name)) return true;
                    }
                }
                return isCheongyeonCompanyName(companyName);
            };

            const aggregateMap = new Map<string, SupportCompanyAggregate>();
            const errorMessages: string[] = [];
            const errorMessageSet = new Set<string>();

            const findCompanyByIdentity = (companyId?: string, companyName?: string): Company | undefined => {
                const normalizedId = normalize(companyId);
                if (normalizedId) {
                    const byId = companyById.get(normalizedId);
                    if (byId) return byId;
                }

                const normalizedName = normalizeName(companyName);
                if (!normalizedName) return undefined;
                return companies.find((company) => normalizeName(company.name) === normalizedName);
            };

            const findTeamByIdentity = (teamId?: string, teamName?: string): Team | undefined => {
                const normalizedId = normalize(teamId);
                if (normalizedId) {
                    const byId = teamById.get(normalizedId);
                    if (byId) return byId;
                }

                const normalizedName = normalizeName(teamName);
                return normalizedName ? teamByName.get(normalizedName) : undefined;
            };

            const isCheongyeonTeamIdentity = (team?: Team, teamId?: string, teamName?: string): boolean => {
                const resolved = team ?? findTeamByIdentity(teamId, teamName);
                if (!resolved) return false;
                const companyId = (resolved.companyId ?? '').trim();
                const companyName = (resolved.companyName ?? (companyId ? companyById.get(companyId)?.name : '') ?? '').trim();
                return isCheongyeonCompany(companyId, companyName);
            };

            const getSettlementBankInfo = (params: {
                settlementTeamId: string;
                settlementTeamName: string;
                settlementCompanyId: string;
                settlementCompanyName: string;
            }): { bankName: string; accountNumber: string; accountHolder: string } => {
                const team = findTeamByIdentity(params.settlementTeamId, params.settlementTeamName);
                const company = findCompanyByIdentity(
                    team?.companyId ?? params.settlementCompanyId,
                    team?.companyName ?? params.settlementCompanyName
                );

                return {
                    bankName: (team?.bankName || company?.bankName || '').trim(),
                    accountNumber: (team?.accountNumber || company?.accountNumber || '').trim(),
                    accountHolder: (
                        team?.accountHolder ||
                        team?.leaderName ||
                        company?.accountHolder ||
                        company?.ceoName ||
                        params.settlementTeamName ||
                        company?.name ||
                        ''
                    ).trim()
                };
            };

            const ensureAggregate = (params: {
                aggregateId: string;
                direction: SupportDirection;
                viewTeamId: string;
                viewTeamName: string;
                companyId: string;
                companyName: string;
                settlementTeamId: string;
                settlementTeamName: string;
                settlementCompanyId: string;
                settlementCompanyName: string;
                sourceTeamId: string;
                sourceTeamName: string;
                counterpartyName: string;
                evidenceNote: string;
                settlementRule: string;
                targetTeamName?: string;
            }) => {
                const key = params.aggregateId;
                if (!aggregateMap.has(key)) {
                    const bankInfo = getSettlementBankInfo(params);
                    const trimmedBankName = bankInfo.bankName.trim();
                    const bankCode = trimmedBankName ? BANK_CODES[trimmedBankName] ?? '' : '';
                    const fieldErrors: SupportCompanyAggregate['errors'] = {};
                    if (!trimmedBankName) fieldErrors.bankName = true;
                    if (trimmedBankName && !bankCode) fieldErrors.bankCode = true;
                    if (!bankInfo.accountNumber) fieldErrors.accountNumber = true;
                    if (!bankInfo.accountHolder) fieldErrors.accountHolder = true;

                    if (Object.values(fieldErrors).some(Boolean)) {
                        const message = `${params.companyName || '정산 주체 미지정'}의 계좌 정보를 확인해주세요.`;
                        if (!errorMessageSet.has(message)) {
                            errorMessageSet.add(message);
                            errorMessages.push(message);
                        }
                    }

                    const initialSourceTeamIds = uniqueValues([params.sourceTeamId]);
                    const initialSourceTeamNames = uniqueValues([params.sourceTeamName]);
                    aggregateMap.set(key, {
                        aggregateId: params.aggregateId,
                        direction: params.direction,
                        settlementTeamId: params.settlementTeamId,
                        settlementTeamName: params.settlementTeamName || params.companyName || '정산 주체 미지정',
                        settlementRole: getSettlementRole(params.direction),
                        settlementRule: params.settlementRule,
                        viewTeamId: params.viewTeamId,
                        viewTeamName: params.viewTeamName || '기준팀 미지정',
                        companyId: params.companyId,
                        companyName: params.companyName || '정산 주체 미지정',
                        sourceTeamIds: initialSourceTeamIds,
                        sourceTeamNames: initialSourceTeamNames,
                        sourceTeamId: params.sourceTeamId,
                        sourceTeamName: params.sourceTeamName || '팀 미지정',
                        targetTeamName: params.targetTeamName,
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

                const siteConstructorCompanyId = reportSite?.constructorCompanyId ?? reportSite?.companyId ?? report.companyId ?? '';
                const siteConstructorCompanyName = reportSite?.constructorCompanyName ?? reportSite?.companyName ?? report.companyName ?? '';
                const siteClassification: '청연' | '외부' = isCheongyeonCompany(siteConstructorCompanyId, siteConstructorCompanyName) ? '청연' : '외부';

                report.workers.forEach((reportWorker: DailyReportWorker) => {
                    const normalizedSalary = normalizeSalaryModel(reportWorker.salaryModel ?? reportWorker.payType);
                    const isSupportModel = normalizedSalary === '지원팀';
                    const reportWorkerTeamId = (reportWorker.teamId ?? '').trim();
                    const reportWorkerTeamName = (reportWorker.workerTeamName ?? '').trim();
                    const fallbackSourceTeam = teamByName.get(normalizeName(reportWorkerTeamName));
                    const fallbackReportTeamId = reportWorkerTeamName ? '' : (report.teamId ?? '').trim();
                    const workerTeamId = reportWorkerTeamId || fallbackSourceTeam?.id || fallbackReportTeamId;
                    const resolvedTeam = (workerTeamId ? teamById.get(workerTeamId) : undefined) ?? fallbackSourceTeam;
                    const isSupportTeam = normalize(resolvedTeam?.type) === '지원팀';

                    const sourceTeamName = resolvedTeam?.name ?? reportWorkerTeamName ?? report.teamName ?? '팀 미지정';
                    const sourceTeamId = (resolvedTeam?.id || reportWorkerTeamId || normalizeName(reportWorkerTeamName) || fallbackReportTeamId || '').trim();
                    const workerCompanyId = (resolvedTeam?.companyId ?? '').trim();
                    const fallbackCompanyName = (resolvedTeam?.companyName ?? (workerCompanyId ? companyById.get(workerCompanyId)?.name : '') ?? '').trim();
                    const workerIsCheongyeon = isCheongyeonTeamIdentity(resolvedTeam, sourceTeamId, sourceTeamName);

                    const targetTeamNameRaw = report.responsibleTeamName ?? reportSite?.responsibleTeamName ?? report.teamName ?? '';
                    const targetTeamIdRaw = (report.responsibleTeamId ?? reportSite?.responsibleTeamId ?? report.teamId ?? '').trim();
                    const fallbackTargetTeamByName = teamByName.get(normalizeName(targetTeamNameRaw));
                    const resolvedTargetTeam = (targetTeamIdRaw ? teamById.get(targetTeamIdRaw) : undefined) ?? fallbackTargetTeamByName;
                    const targetTeamId = (resolvedTargetTeam?.id ?? targetTeamIdRaw).trim();
                    const targetTeamName = resolvedTargetTeam?.name ?? report.responsibleTeamName ?? reportSite?.responsibleTeamName ?? report.teamName ?? '팀 미지정';
                    const targetCompanyId = (resolvedTargetTeam?.companyId ?? siteConstructorCompanyId ?? report.companyId ?? '').trim();
                    const targetCompanyName = resolvedTargetTeam?.companyName ?? siteConstructorCompanyName ?? report.companyName ?? '';
                    const targetIsCheongyeon = isCheongyeonTeamIdentity(resolvedTargetTeam, targetTeamId, targetTeamName);

                    type ClassifiedEntry = {
                        direction: SupportDirection;
                        viewTeamId: string;
                        viewTeamName: string;
                        settlementTeamId: string;
                        settlementTeamName: string;
                        settlementCompanyId: string;
                        settlementCompanyName: string;
                        sourceTeamId: string;
                        sourceTeamName: string;
                        counterpartyName: string;
                        evidenceNote: string;
                        settlementRule: string;
                    };
                    const classifiedEntries: ClassifiedEntry[] = [];

                    if (workerIsCheongyeon && targetIsCheongyeon && sourceTeamId && targetTeamId && sourceTeamId !== targetTeamId) {
                        // 내부지원간곳: 우리(청연) 팀이 다른 청연 팀 현장으로 지원
                        // 정산 대상 = 현장을 담당하는 "팀" (돈을 청구해야 함)
                        classifiedEntries.push({
                            direction: '내부지원간곳',
                            viewTeamId: sourceTeamId,
                            viewTeamName: sourceTeamName,
                            settlementTeamId: targetTeamId,
                            settlementTeamName: targetTeamName,
                            settlementCompanyId: targetCompanyId,
                            settlementCompanyName: targetCompanyName,
                            sourceTeamId,
                            sourceTeamName,
                            counterpartyName: targetTeamName || '청연 수신팀 미지정',
                            evidenceNote: '청연이엔지 소속 팀이 다른 청연이엔지 현장/팀으로 지원 나간 건',
                            settlementRule: SUPPORT_DIRECTION_META.내부지원간곳.rule
                        });
                        // 내부지원온곳: 다른 청연 팀이 우리 청연 현장/팀으로 지원
                        // 정산 대상 = 인원을 보내준 "팀" (돈을 정산해줘야 함)
                        classifiedEntries.push({
                            direction: '내부지원온곳',
                            viewTeamId: targetTeamId,
                            viewTeamName: targetTeamName,
                            settlementTeamId: sourceTeamId,
                            settlementTeamName: sourceTeamName,
                            settlementCompanyId: workerCompanyId,
                            settlementCompanyName: fallbackCompanyName,
                            sourceTeamId,
                            sourceTeamName,
                            counterpartyName: sourceTeamName || '청연 지원팀 미지정',
                            evidenceNote: '다른 청연이엔지 팀이 우리 청연이엔지 현장/팀으로 지원 온 건',
                            settlementRule: SUPPORT_DIRECTION_META.내부지원온곳.rule
                        });
                    } else if (siteClassification === '외부' && workerIsCheongyeon) {
                        // 외부지원간곳: 우리 팀이 외부 시공사 현장으로 지원
                        // 정산 대상 = 외부 현장담당팀 (팀이 없으면 현장/업체명 보조)
                        classifiedEntries.push({
                            direction: '외부지원간곳',
                            viewTeamId: sourceTeamId,
                            viewTeamName: sourceTeamName,
                            settlementTeamId: targetTeamId || targetCompanyId,
                            settlementTeamName: targetTeamName || targetCompanyName || siteConstructorCompanyName || '외부 시공사',
                            settlementCompanyId: targetCompanyId,
                            settlementCompanyName: targetCompanyName || siteConstructorCompanyName,
                            sourceTeamId,
                            sourceTeamName,
                            counterpartyName: siteConstructorCompanyName || report.siteName || '외부 현장',
                            evidenceNote: '청연이엔지 소속 팀이 외부 시공사 현장으로 지원 나간 건',
                            settlementRule: SUPPORT_DIRECTION_META.외부지원간곳.rule
                        });
                    } else if (siteClassification === '청연' && targetIsCheongyeon && !workerIsCheongyeon) {
                        // 외부지원온곳: 외부 팀(용역 등)이 우리 청연 현장으로 지원
                        // 정산 대상 = 외부 "팀" (돈을 정산해줘야 함)
                        classifiedEntries.push({
                            direction: '외부지원온곳',
                            viewTeamId: targetTeamId,
                            viewTeamName: targetTeamName,
                            settlementTeamId: sourceTeamId || workerCompanyId,
                            settlementTeamName: sourceTeamName || fallbackCompanyName || '외부 지원팀',
                            settlementCompanyId: workerCompanyId,
                            settlementCompanyName: fallbackCompanyName,
                            sourceTeamId,
                            sourceTeamName,
                            counterpartyName: sourceTeamName || fallbackCompanyName || '외부 지원팀',
                            evidenceNote: '외부팀이 청연이엔지 현장/팀으로 지원 온 건',
                            settlementRule: SUPPORT_DIRECTION_META.외부지원온곳.rule
                        });
                    } else if (siteClassification === '청연' && targetIsCheongyeon && (isSupportModel || isSupportTeam)) {
                        // 외부지원온곳 (지원팀 모델): 지원팀 소속 인원이 우리 청연 현장으로 지원
                        // 정산 대상 = 해당 "지원팀" (돈을 정산해줘야 함)
                        classifiedEntries.push({
                            direction: '외부지원온곳',
                            viewTeamId: targetTeamId,
                            viewTeamName: targetTeamName,
                            settlementTeamId: sourceTeamId || workerCompanyId,
                            settlementTeamName: sourceTeamName || fallbackCompanyName || '지원팀',
                            settlementCompanyId: workerCompanyId,
                            settlementCompanyName: fallbackCompanyName,
                            sourceTeamId,
                            sourceTeamName,
                            counterpartyName: sourceTeamName || fallbackCompanyName || '외부 지원팀',
                            evidenceNote: '지원팀 소속 또는 외부팀이 청연이엔지 현장/팀으로 지원 온 건',
                            settlementRule: SUPPORT_DIRECTION_META.외부지원온곳.rule
                        });
                    }
                    if (classifiedEntries.length === 0) return;

                    const unitPrice = typeof reportWorker.unitPrice === 'number' && Number.isFinite(reportWorker.unitPrice)
                        ? reportWorker.unitPrice
                        : resolvedTeam?.supportRate ?? 0;
                    const manDay = typeof reportWorker.manDay === 'number' && Number.isFinite(reportWorker.manDay)
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
                            teamId: sourceTeamId,
                            teamName: sourceTeamName,
                            workerTeamId: sourceTeamId,
                            workerTeamName: sourceTeamName,
                            viewTeamId: entry.viewTeamId,
                            viewTeamName: entry.viewTeamName,
                            sourceTeamName: entry.sourceTeamName,
                            targetTeamName,
                            siteResponsibleTeamId: targetTeamId,
                            siteResponsibleTeamName: targetTeamName,
                            settlementTeamId: entry.settlementTeamId,
                            settlementTeamName: entry.settlementTeamName,
                            sourceCompanyName: fallbackCompanyName,
                            targetCompanyName,
                            counterpartyName: entry.counterpartyName,
                            evidenceNote: entry.evidenceNote
                        };

                        const companyDisplayName = entry.settlementTeamName || entry.sourceTeamName || '정산 주체';
                        const aggregateId = [
                            entry.direction,
                            normalize(entry.viewTeamId) || normalizeName(entry.viewTeamName) || 'unknown-view',
                            normalize(entry.settlementTeamId) || normalizeName(companyDisplayName) || 'unknown'
                        ].join('::');

                        const aggregate = ensureAggregate({
                            aggregateId,
                            direction: entry.direction,
                            viewTeamId: entry.viewTeamId,
                            viewTeamName: entry.viewTeamName,
                            companyId: entry.settlementTeamId,
                            companyName: companyDisplayName,
                            settlementTeamId: entry.settlementTeamId,
                            settlementTeamName: companyDisplayName,
                            settlementCompanyId: entry.settlementCompanyId,
                            settlementCompanyName: entry.settlementCompanyName,
                            sourceTeamId: entry.sourceTeamId,
                            sourceTeamName: entry.sourceTeamName,
                            counterpartyName: entry.counterpartyName,
                            evidenceNote: entry.evidenceNote,
                            settlementRule: entry.settlementRule,
                            targetTeamName: targetTeamName
                        });

                        aggregate.totalManDay += manDay;
                        aggregate.totalAmount += amount;
                        if (entry.sourceTeamId && !aggregate.sourceTeamIds.includes(entry.sourceTeamId)) {
                            aggregate.sourceTeamIds.push(entry.sourceTeamId);
                        }
                        if (entry.sourceTeamName && !aggregate.sourceTeamNames.includes(entry.sourceTeamName)) {
                            aggregate.sourceTeamNames.push(entry.sourceTeamName);
                        }
                        aggregate.sourceTeamName = summarizeNames(aggregate.sourceTeamNames);

                        const existingSite = aggregate.sites.find((s) => s.siteId === siteId);
                        if (existingSite) {
                            existingSite.totalManDay += manDay;
                            existingSite.totalAmount += amount;
                            if (unitPrice > 0) existingSite.unitPriceSamples.push(unitPrice);
                            existingSite.workers.push(workerRecord);
                            if (entry.sourceTeamId && !existingSite.sourceTeamIds.includes(entry.sourceTeamId)) {
                                existingSite.sourceTeamIds.push(entry.sourceTeamId);
                            }
                            if (entry.sourceTeamName && !existingSite.sourceTeamNames.includes(entry.sourceTeamName)) {
                                existingSite.sourceTeamNames.push(entry.sourceTeamName);
                            }
                            existingSite.sourceTeamName = summarizeNames(existingSite.sourceTeamNames);
                        } else {
                            aggregate.sites.push({
                                siteId,
                                siteName,
                                direction: entry.direction,
                                viewTeamId: entry.viewTeamId,
                                viewTeamName: entry.viewTeamName,
                                sourceTeamIds: uniqueValues([entry.sourceTeamId]),
                                sourceTeamNames: uniqueValues([entry.sourceTeamName]),
                                sourceTeamName: entry.sourceTeamName,
                                counterpartyName: entry.counterpartyName,
                                evidenceNote: entry.evidenceNote,
                                settlementRule: entry.settlementRule,
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

            const aggregatesList = Array.from(aggregateMap.values()).map((aggregate) => {
                const sites = aggregate.sites
                    .map((site: SupportSiteRow) =>
                        recalcSiteFromWorkers(
                            site,
                            [...site.workers].sort((a, b) => a.workerName.localeCompare(b.workerName, 'ko-KR'))
                        )
                    )
                    .sort((a, b) => a.siteName.localeCompare(b.siteName, 'ko-KR'));
                return recalcAggregateFromSites(aggregate, sites);
            });

            return { aggregates: aggregatesList, errorMessages };
        },
        [companies, sites, teams]
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
    }, [fetchSupportData, teams.length, companies.length]);

    const filteredAggregates = useMemo(() => {
        let rows = aggregates;
        if (selectedDirection !== 'all') {
            rows = rows.filter((aggregate) => aggregate.direction === selectedDirection);
        }
        if (selectedSourceTeamId) {
            rows = rows.filter((aggregate) => matchesViewTeamIdentity(aggregate, selectedSourceTeamId));
        }
        if (selectedSiteId) {
            rows = rows
                .map((aggregate) =>
                    recalcAggregateFromSites(
                        aggregate,
                        aggregate.sites.filter((site) => normalize(site.siteId) === normalize(selectedSiteId))
                    )
                )
                .filter((aggregate) => aggregate.sites.length > 0);
        }
        return rows;
    }, [aggregates, selectedDirection, selectedSourceTeamId, selectedSiteId]);

    const displayAggregates = useMemo(
        () => selectedSourceTeamId ? filteredAggregates : mergeAggregatesBySettlementTeam(filteredAggregates),
        [filteredAggregates, selectedSourceTeamId]
    );

    const directionOptions = useMemo(() => [
        { id: 'all', name: '전체' },
        { id: '내부지원간곳', name: '내부지원간곳' },
        { id: '내부지원온곳', name: '내부지원온곳' },
        { id: '외부지원간곳', name: '외부지원간곳' },
        { id: '외부지원온곳', name: '외부지원온곳' }
    ], []);

    const siteOptions = useMemo(() => {
        const map = new Map<string, string>();
        aggregates.forEach((aggregate) => {
            aggregate.sites.forEach((site) => {
                const id = normalize(site.siteId);
                if (id && !map.has(id)) map.set(id, site.siteName || '현장 미지정');
            });
        });
        return Array.from(map.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'ko-KR'));
    }, [aggregates]);

    const workerById = useMemo(() => {
        const map = new Map<string, Worker>();
        workers.forEach((worker) => { if (worker.id) map.set(worker.id, worker); });
        return map;
    }, [workers]);

    const siteById = useMemo(() => {
        const map = new Map<string, Site>();
        sites.forEach((site) => { if (site.id) map.set(site.id, site); });
        return map;
    }, [sites]);

    const supportExcelRows = useMemo<SupportLaborExcelRow[]>(() => {
        return displayAggregates.flatMap(aggregate => 
            aggregate.sites.flatMap(site => {
                const workerMap = new Map<string, SupportLaborExcelRow>();
                site.workers.forEach(entry => {
                    const key = entry.workerId ?? `${aggregate.companyId || 'unknown'}-${site.siteId}-${entry.workerName}`;
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
                            siteId: entry.siteId,
                            siteName: entry.siteName ?? siteInfo?.name ?? '',
                            days: Array.from({ length: MAX_DAY_COLUMNS }, () => 0),
                            totalManDay: 0,
                            unitPrice: entry.unitPrice,
                            totalAmount: 0,
                            displayContent: site.displayContent
                        });
                    }
                    const target = workerMap.get(key)!;
                    const day = new Date(entry.date).getDate();
                    if (day >= 1 && day <= MAX_DAY_COLUMNS) target.days[day - 1] += entry.manDay;
                    target.totalManDay += entry.manDay;
                    target.totalAmount += entry.amount;
                });
                return Array.from(workerMap.values());
            })
        );
    }, [displayAggregates, workerById, siteById]);

    const exchangeSummaryRows = useMemo<SupportExchangeSummaryRow[]>(() => {
        return displayAggregates.flatMap(aggregate =>
            aggregate.sites.map(site => {
                const siteInfo = siteById.get(site.siteId);
                const supportOutTeamName = summarizeNames(site.workers.map(w => w.workerTeamName ?? w.teamName));
                const supportInTeamName = summarizeNames(
                    site.workers.map(w => w.siteResponsibleTeamName ?? w.targetTeamName),
                    siteInfo?.responsibleTeamName ?? '-'
                );
                return {
                    aggregateId: aggregate.aggregateId,
                    direction: aggregate.direction,
                    sourceTeamName: aggregate.sourceTeamName,
                    counterpartyName: aggregate.companyName,
                    supportOutTeamName,
                    supportInTeamName,
                    siteResponsibleTeamName: supportInTeamName || siteInfo?.responsibleTeamName || '-',
                    companyName: aggregate.companyName,
                    bankName: aggregate.bankName,
                    accountNumber: aggregate.accountNumber,
                    accountHolder: aggregate.accountHolder,
                    siteId: site.siteId,
                    siteName: site.siteName,
                    workerCount: new Set(site.workers.map(w => w.workerId)).size,
                    totalManDay: site.totalManDay,
                    totalAmount: site.totalAmount,
                    evidenceNote: aggregate.evidenceNote
                };
            })
        ).sort((a, b) => a.direction.localeCompare(b.direction) || a.sourceTeamName.localeCompare(b.sourceTeamName));
    }, [displayAggregates, siteById]);

    const photoStyleSummaryGroups = useMemo(() => {
        return SUPPORT_DIRECTION_ORDER.map(dir => ({
            direction: dir,
            label: SUPPORT_DIRECTION_META[dir].label,
            cellClass: SUPPORT_DIRECTION_META[dir].cellClass,
            aggregates: displayAggregates.filter(a => a.direction === dir)
        }));
    }, [displayAggregates]);

    const totalSummary = useMemo(() => displayAggregates.reduce((acc, agg) => {
        const additionalAmount = getAggregateAdditionalAmount(agg, manualAdjustments);
        return {
            totalManDay: acc.totalManDay + agg.totalManDay,
            totalAmount: acc.totalAmount + getAggregateTotalWithAdditional(agg, manualAdjustments),
            additionalAmount: acc.additionalAmount + additionalAmount,
            partnerCount: acc.partnerCount + 1,
            siteCount: acc.siteCount + agg.sites.length
        };
    }, { totalManDay: 0, totalAmount: 0, additionalAmount: 0, partnerCount: 0, siteCount: 0 }), [displayAggregates, manualAdjustments]);

    const handleDisplayContentChange = (aggregateId: string, siteId: string, value: string) => {
        setAggregates(prev => prev.map(agg => ({
            ...agg,
            sites: agg.sites.map(s => agg.aggregateId === aggregateId && s.siteId === siteId ? { ...s, displayContent: value } : s)
        })));
    };

    const kbRows = useMemo(() => {
        const label = `${parseInt(selectedMonth.split('-')[1] ?? '0', 10)}월`;
        return displayAggregates.map(agg => ({
            bankCode: agg.bankCode,
            accountNumber: agg.accountNumber,
            accountHolder: agg.accountHolder,
            amount: getAggregateTotalWithAdditional(agg, manualAdjustments),
            description: `${agg.direction} ${agg.viewTeamName} ${agg.companyName} ${label} ${agg.sites.length}개 현장`
        }));
    }, [displayAggregates, manualAdjustments, selectedMonth]);

    const previewRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const capturePreview = useCallback(async (key: string) => {
        const node = previewRefs.current[key];
        if (!node) return;
        const canvas = await html2canvas(node, { scale: 2 } as any);
        const blob: Blob | null = await new Promise(r => canvas.toBlob(r, 'image/png'));
        if (!blob) return window.alert('캡처 실패');
        if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
            try {
                await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
                return window.alert('클립보드 복사 완료');
            } catch (e) { console.error(e); }
        }
        saveAs(blob, `노무내역서_${key}.png`);
    }, []);

    const handleDownloadLabor = async () => {
        if (displayAggregates.length === 0) return window.alert('데이터 없음');
        const exportAggs = displayAggregates.map(agg => ({
            ...agg,
            companyName: `${agg.direction}_${agg.viewTeamName}_${agg.companyName}`
        }));
        await generateLaborStatementExcel(exportAggs as any, selectedMonth);
    };

    const handleDownloadKB = () => {
        if (kbRows.length === 0) return window.alert('데이터 없음');
        const header = ['A. 은행코드', 'B. 계좌번호', 'C. 이체금액', 'D. 받는분통장표시', 'E. 내통장메모'];
        const rows = kbRows.map(r => [r.bankCode, r.accountNumber, r.amount, r.accountHolder, r.description]);
        const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
        ws['!cols'] = [{ wch: 8 }, { wch: 20 }, { wch: 14 }, { wch: 16 }, { wch: 20 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, '국민은행용');
        XLSX.writeFile(wb, `support-team-kb-${selectedMonth}.xlsx`);
    };

    const sidebarTeams = useMemo(() => {
        const map = new Map<string, { id: string; name: string; error: boolean; count: number }>();
        const companyById = new Map<string, Company>();
        companies.forEach(company => {
            if (company.id) companyById.set(normalize(company.id), company);
        });
        const teamById = new Map<string, Team>();
        const teamByName = new Map<string, Team>();
        teams.forEach(team => {
            if (team.id) teamById.set(normalize(team.id), team);
            const nameKey = normalizeName(team.name);
            if (nameKey && !teamByName.has(nameKey)) teamByName.set(nameKey, team);
        });
        const isCheongyeonViewTeam = (teamId?: string, teamName?: string): boolean => {
            const team =
                teamById.get(normalize(teamId)) ??
                teamByName.get(normalizeName(teamName));
            if (!team) return false;
            const companyId = normalize(team.companyId);
            const company = companyId ? companyById.get(companyId) : undefined;
            return Boolean(company?.isMyCompany) ||
                isCheongyeonCompanyName(team.companyName) ||
                isCheongyeonCompanyName(company?.name);
        };

        aggregates.forEach(agg => {
            if (!isCheongyeonViewTeam(agg.viewTeamId, agg.viewTeamName)) return;
            const err = Object.values(agg.errors).some(Boolean);
            const id = agg.viewTeamId || normalizeName(agg.viewTeamName) || 'unknown-view-team';
            const name = agg.viewTeamName || '기준팀 미지정';
            const ex = map.get(id);
            if (!ex) map.set(id, { id, name, error: err, count: 1 });
            else { ex.count++; if (err) ex.error = true; }
        });
        return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'ko-KR'));
    }, [aggregates, companies, teams]);

    useEffect(() => {
        if (selectedSourceTeamId && !sidebarTeams.some(team => team.id === selectedSourceTeamId)) {
            setSelectedSourceTeamId('');
        }
    }, [selectedSourceTeamId, sidebarTeams]);

    const sitePreviews: SitePreviewBlock[] = useMemo(() => 
        displayAggregates.flatMap(agg => agg.sites.map(s => ({
            aggregate: agg,
            site: s,
            rows: supportExcelRows.filter(r => r.aggregateId === agg.aggregateId && (r.siteId === s.siteId || r.siteName === s.siteName))
        }))), [displayAggregates, supportExcelRows]);

    if (loading && aggregates.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
                <FontAwesomeIcon icon={faSpinner} spin className="text-4xl text-amber-500" />
                <p className="text-slate-500 font-bold">정산 데이터를 집계하고 있습니다...</p>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-[1600px] w-full mx-auto space-y-6">
            {/* 상단 헤더 영역 */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-6 py-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="bg-amber-100 text-amber-600 rounded-xl p-3 shadow-inner">
                        <FontAwesomeIcon icon={faUsers} size="lg" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-800 tracking-tight">지원팀 지급 관리</h1>
                        <p className="text-[13px] text-slate-500 font-bold mt-0.5 flex items-center gap-2">
                            <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">BETA</span>
                            팀별 간곳/온곳 기준 자동 정산 대시보드
                        </p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2.5">
                    <ActionButton variant="solid-green" disabled={supportExcelRows.length === 0} onClick={() => setShowLaborPreview(true)}>
                        <FontAwesomeIcon icon={faFileExcel} /> 노무내역서 미리보기
                    </ActionButton>
                    <ActionButton variant="outline-green" disabled={supportExcelRows.length === 0} onClick={handleDownloadLabor}>
                        <FontAwesomeIcon icon={faFileExcel} /> 엑셀 다운로드
                    </ActionButton>
                    <ActionButton variant="outline-amber" disabled={kbRows.length === 0} onClick={() => setShowKBPreview(true)}>
                        <FontAwesomeIcon icon={faSearch} /> 국민은행 미리보기
                    </ActionButton>
                    <ActionButton variant="solid-amber" disabled={kbRows.length === 0} onClick={handleDownloadKB}>
                        <FontAwesomeIcon icon={faFileExcel} /> 국민은행용 다운로드
                    </ActionButton>
                </div>
            </div>

            <section className="grid gap-3 lg:grid-cols-3">
                <div className="rounded-xl border border-sky-100 bg-sky-50/70 p-4">
                    <div className="text-[11px] font-black text-sky-700">지원간곳</div>
                    <div className="mt-1 text-sm font-black text-slate-900">현장담당팀으로 통합 청구</div>
                    <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">
                        우리 작업팀(작업자 소속팀)이 A팀이 담당하는 현장 여러 곳에 나가면 정산 주체는 현장담당팀 A팀입니다.
                    </p>
                </div>
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 p-4">
                    <div className="text-[11px] font-black text-indigo-700">지원온곳</div>
                    <div className="mt-1 text-sm font-black text-slate-900">작업팀별 지급</div>
                    <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">
                        우리 현장에 B팀과 C팀 작업자가 들어오면 작업자 소속팀인 B팀, C팀을 각각 정산 주체로 분리합니다.
                    </p>
                </div>
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-4">
                    <div className="text-[11px] font-black text-emerald-700">정산 단위</div>
                    <div className="mt-1 text-sm font-black text-slate-900">업체가 아니라 팀 기준</div>
                    <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">
                        현장담당팀은 현장을 맡은 팀, 작업팀은 실제 일한 작업자의 소속팀입니다. 같은 회사라도 팀이 다르면 별도로 집계합니다.
                    </p>
                </div>
            </section>

            <div className="flex flex-col lg:flex-row gap-6">
                {/* 좌측 사이드바 */}
                <aside className="w-full lg:w-72 flex-none space-y-4">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden sticky top-6">
                        <div className="px-4 py-3.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                            <span className="text-sm font-black text-slate-700">기준팀 필터</span>
                            <span className="bg-slate-200 text-slate-600 text-[10px] px-2 py-0.5 rounded-full font-black">{sidebarTeams.length}</span>
                        </div>
                        <div className="max-h-[calc(100vh-300px)] overflow-y-auto p-2 space-y-1.5">
                            <button
                                onClick={() => setSelectedSourceTeamId('')}
                                className={`w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-3 ${
                                    selectedSourceTeamId === '' ? 'bg-amber-500 text-white shadow-lg' : 'text-slate-600 hover:bg-slate-50'
                                }`}
                            >
                                <FontAwesomeIcon icon={faUsers} className={selectedSourceTeamId === '' ? 'opacity-100' : 'opacity-40'} />
                                전체 현황판
                            </button>
                            <div className="h-px bg-slate-100 my-2 mx-2"></div>
                            {sidebarTeams.map(team => (
                                <button
                                    key={team.id}
                                    onClick={() => setSelectedSourceTeamId(team.id)}
                                    className={`w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-between group ${
                                        selectedSourceTeamId === team.id ? 'bg-amber-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'
                                    }`}
                                >
                                    <span className="truncate">{team.name}</span>
                                    <div className="flex items-center gap-2">
                                        {team.error && <FontAwesomeIcon icon={faExclamationTriangle} className={selectedSourceTeamId === team.id ? 'text-white' : 'text-rose-500 animate-pulse'} />}
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                                            selectedSourceTeamId === team.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                                        }`}>
                                            {team.count}
                                        </span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </aside>

                {/* 우측 메인 */}
                <div className="flex-1 space-y-6">
                    {/* 상단 요약 카드 및 필터 */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col lg:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <FontAwesomeIcon icon={faCalendarAlt} className="text-amber-500" />
                            <span className="text-sm font-bold text-slate-500">집계 기준월</span>
                            <input
                                type="month"
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(e.target.value)}
                                className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-black focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                            />
                        </div>
                        <div className="flex items-center gap-3">
                            <select
                                value={selectedDirection}
                                onChange={(e) => setSelectedDirection(e.target.value as any)}
                                className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-black focus:ring-2 focus:ring-amber-500 outline-none"
                            >
                                {directionOptions.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                            </select>
                            <select
                                value={selectedSiteId}
                                onChange={(e) => setSelectedSiteId(e.target.value)}
                                className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-black focus:ring-2 focus:ring-amber-500 outline-none"
                            >
                                <option value="">모든 현장</option>
                                {siteOptions.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <SummaryCard label="총 투입 공수" value={`${formatNumber(totalSummary.totalManDay)} 공`} icon={faCalendarAlt} tone="violet" />
                        <SummaryCard label="총 정산 금액" value={`${formatNumber(totalSummary.totalAmount)} 원`} icon={faCircleCheck} tone="emerald" />
                        <SummaryCard label="정산 주체" value={`${formatNumber(totalSummary.partnerCount)} 팀`} icon={faUsers} tone="sky" />
                        <SummaryCard label="관련 지원 현장" value={`${formatNumber(totalSummary.siteCount)} 개`} icon={faCircleExclamation} tone="orange" />
                    </div>

                    <div className="bg-white border border-slate-900 shadow-sm overflow-hidden">
                        <div className="px-5 py-3 border-b border-slate-900 bg-white flex items-center justify-between">
                            <h2 className="text-base font-black text-slate-900">
                                {selectedSourceTeamId ? sidebarTeams.find(t => t.id === selectedSourceTeamId)?.name : '전체 기준팀'} 1단계 정산 요약
                            </h2>
                            <span className="text-[11px] font-bold text-slate-500">팀 행을 클릭하면 현장 상세가 열립니다.</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[980px] border-collapse text-[13px]">
                                <thead>
                                    <tr className="text-center font-black text-slate-950">
                                        <th className="w-14 border border-slate-900 bg-gradient-to-br from-yellow-100 via-yellow-400 to-white p-2"></th>
                                        <th className="w-36 border border-slate-900 bg-gradient-to-br from-white via-slate-200 to-slate-500 p-2 tracking-[0.35em]">팀 명</th>
                                        <th className="w-20 border border-slate-900 bg-gradient-to-br from-white via-slate-200 to-slate-500 p-2 tracking-[0.35em]">공 수</th>
                                        <th className="w-28 border border-slate-900 bg-gradient-to-br from-white via-slate-200 to-slate-500 p-2 tracking-[0.35em]">단 가</th>
                                        <th className="w-32 border border-slate-900 bg-gradient-to-br from-white via-slate-200 to-slate-500 p-2 tracking-[0.35em]">금 액</th>
                                        <th className="w-24 border border-slate-900 bg-gradient-to-br from-white via-slate-200 to-slate-500 p-2 tracking-[0.35em]">추 가</th>
                                        <th className="w-32 border border-slate-900 bg-gradient-to-br from-white via-slate-200 to-slate-500 p-2 tracking-[0.35em]">합 계</th>
                                        <th className="w-44 border border-slate-900 bg-gradient-to-br from-white via-slate-200 to-slate-500 p-2 tracking-[0.35em]">비 고</th>
                                        <th className="w-44 border border-slate-900 bg-gradient-to-br from-white via-slate-200 to-slate-500 p-2 tracking-[0.35em]">기 타</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {photoStyleSummaryGroups.every(group => group.aggregates.length === 0) ? (
                                        <tr>
                                            <td colSpan={9} className="border border-slate-900 px-4 py-16 text-center font-bold text-slate-400">
                                                해당 조건의 정산 내역이 없습니다.
                                            </td>
                                        </tr>
                                    ) : (
                                        photoStyleSummaryGroups.map(group => {
                                            if (group.aggregates.length === 0) return null;
                                            const groupManDay = group.aggregates.reduce((sum, agg) => sum + agg.totalManDay, 0);
                                            const groupAmount = group.aggregates.reduce((sum, agg) => sum + agg.totalAmount, 0);
                                            const groupAdditional = group.aggregates.reduce((sum, agg) => sum + getAggregateAdditionalAmount(agg, manualAdjustments), 0);
                                            const groupTotal = group.aggregates.reduce((sum, agg) => sum + getAggregateTotalWithAdditional(agg, manualAdjustments), 0);
                                            const groupExpandedSiteCount = group.aggregates.reduce(
                                                (sum, agg) => sum + (expandedAggregates.has(agg.aggregateId) ? agg.sites.length : 0),
                                                0
                                            );
                                            const groupRowSpan = group.aggregates.length + groupExpandedSiteCount + 1;

                                            return (
                                                <React.Fragment key={group.label}>
                                                    {group.aggregates.map((agg, index) => {
                                                        const aggKey = agg.aggregateId;
                                                        const isExpanded = expandedAggregates.has(aggKey);
                                                        const manualAdjustment = getAdjustment(manualAdjustments, aggKey);
                                                        const additionalAmount = manualAdjustment.additionalAmount;
                                                        const aggregateTotal = getAggregateTotalWithAdditional(agg, manualAdjustments);
                                                        const remarkPlaceholder = getAggregateRemarkFallback(agg) || '비고 입력';
                                                        const etcPlaceholder = getAggregateEtcFallback(agg) || '기타 입력';

                                                        return (
                                                            <React.Fragment key={aggKey}>
                                                                <tr
                                                                    onClick={() => toggleAggregateExpand(aggKey)}
                                                                    className={`cursor-pointer ${isExpanded ? 'bg-slate-50' : 'bg-white'} hover:bg-slate-50`}
                                                                >
                                                                    {index === 0 && (
                                                                        <td
                                                                            rowSpan={groupRowSpan}
                                                                            className={`border border-slate-900 text-center align-middle text-lg font-black ${getTeamCellClass(group.direction)}`}
                                                                        >
                                                                            <div className="mx-auto leading-8" style={{ writingMode: 'vertical-rl', textOrientation: 'upright' }}>
                                                                                {group.label}
                                                                            </div>
                                                                        </td>
                                                                    )}
                                                                    <td className={`border border-slate-900 px-2 py-1.5 text-center font-black ${getTeamCellClass(agg.direction)}`}>
                                                                        <span className="inline-flex items-center gap-1">
                                                                            <FontAwesomeIcon icon={faChevronRight} className={`text-[10px] ${isExpanded ? 'rotate-90' : ''}`} />
                                                                            {agg.companyName}
                                                                        </span>
                                                                    </td>
                                                                    <td className="border border-slate-900 px-2 py-1.5 text-center font-mono">{formatDayValue(agg.totalManDay)}</td>
                                                                    <td className="border border-slate-900 px-2 py-1.5 text-right font-mono">{formatNumber(getAggregateUnitPrice(agg))}</td>
                                                                    <td className="border border-slate-900 px-2 py-1.5 text-right font-mono">{formatNumber(agg.totalAmount)}</td>
                                                                    <td className="border border-slate-900 px-1 py-1 text-right font-mono" onClick={(event) => event.stopPropagation()}>
                                                                        <input
                                                                            type="text"
                                                                            inputMode="numeric"
                                                                            aria-label={`${agg.companyName} 추가 금액`}
                                                                            value={formatOptionalMoney(additionalAmount)}
                                                                            onChange={(event) => updateManualAdjustment(aggKey, { additionalAmount: parseMoneyInput(event.target.value) })}
                                                                            onFocus={(event) => event.currentTarget.select()}
                                                                            className="h-7 w-full bg-transparent px-1 text-right font-mono text-blue-700 outline-none transition focus:bg-amber-50 focus:ring-1 focus:ring-amber-400"
                                                                            placeholder="0"
                                                                        />
                                                                    </td>
                                                                    <td className="border border-slate-900 px-2 py-1.5 text-right font-mono">{formatNumber(aggregateTotal)}</td>
                                                                    <td className="border border-slate-900 px-1 py-1 text-center font-medium text-slate-900" onClick={(event) => event.stopPropagation()}>
                                                                        <input
                                                                            type="text"
                                                                            aria-label={`${agg.companyName} 비고`}
                                                                            value={manualAdjustment.remark}
                                                                            onChange={(event) => updateManualAdjustment(aggKey, { remark: event.target.value })}
                                                                            className="h-7 w-full bg-transparent px-1 text-center text-[12px] font-bold text-slate-900 outline-none transition placeholder:text-slate-400 focus:bg-amber-50 focus:ring-1 focus:ring-amber-400"
                                                                            placeholder={remarkPlaceholder}
                                                                        />
                                                                    </td>
                                                                    <td className="border border-slate-900 px-1 py-1 text-center font-medium text-slate-900" onClick={(event) => event.stopPropagation()}>
                                                                        <input
                                                                            type="text"
                                                                            aria-label={`${agg.companyName} 기타`}
                                                                            value={manualAdjustment.etc}
                                                                            onChange={(event) => updateManualAdjustment(aggKey, { etc: event.target.value })}
                                                                            className="h-7 w-full bg-transparent px-1 text-center text-[12px] font-bold text-slate-900 outline-none transition placeholder:text-slate-400 focus:bg-amber-50 focus:ring-1 focus:ring-amber-400"
                                                                            placeholder={etcPlaceholder}
                                                                        />
                                                                    </td>
                                                                </tr>
                                                                {isExpanded && agg.sites.map(site => (
                                                                    <tr key={`${aggKey}-${site.siteId}`} className="bg-slate-50">
                                                                        <td className="border border-slate-900 px-3 py-1 text-left text-[12px] font-bold text-slate-600">
                                                                            ㄴ {site.siteName}
                                                                        </td>
                                                                        <td className="border border-slate-900 px-2 py-1 text-center font-mono text-slate-600">{formatDayValue(site.totalManDay)}</td>
                                                                        <td className="border border-slate-900 px-2 py-1 text-right font-mono text-slate-500"></td>
                                                                        <td className="border border-slate-900 px-2 py-1 text-right font-mono text-slate-600">{formatNumber(site.totalAmount)}</td>
                                                                        <td className="border border-slate-900 px-2 py-1"></td>
                                                                        <td className="border border-slate-900 px-2 py-1 text-right font-mono text-slate-600">{formatNumber(site.totalAmount)}</td>
                                                                        <td className="border border-slate-900 px-2 py-1 text-center text-[12px] text-slate-500">
                                                                            현장담당팀: {summarizeNames(site.workers.map(worker => worker.siteResponsibleTeamName ?? worker.targetTeamName), '미지정')}
                                                                        </td>
                                                                        <td className="border border-slate-900 px-2 py-1 text-center">
                                                                            <button
                                                                                type="button"
                                                                                onClick={(event) => { event.stopPropagation(); setDetailTarget({ aggregate: agg, site }); }}
                                                                                className="rounded bg-white px-2 py-1 text-[11px] font-black text-indigo-700 hover:bg-indigo-50"
                                                                            >
                                                                                상세보기
                                                                            </button>
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </React.Fragment>
                                                        );
                                                    })}
                                                    <tr className="bg-white font-black">
                                                        <td className="border border-slate-900 px-2 py-1.5 text-center tracking-[0.35em]">합 계</td>
                                                        <td className="border border-slate-900 px-2 py-1.5 text-center font-mono">{formatDayValue(groupManDay)}</td>
                                                        <td className="border border-slate-900 px-2 py-1.5"></td>
                                                        <td className="border border-slate-900 px-2 py-1.5 text-right font-mono">{formatNumber(groupAmount)}</td>
                                                        <td className="border border-slate-900 px-2 py-1.5 text-right font-mono">{formatOptionalMoney(groupAdditional)}</td>
                                                        <td className="border border-slate-900 px-2 py-1.5 text-right font-mono">{formatNumber(groupTotal)}</td>
                                                        <td className="border border-slate-900 px-2 py-1.5"></td>
                                                        <td className="border border-slate-900 px-2 py-1.5"></td>
                                                    </tr>
                                                </React.Fragment>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {errors.length > 0 && (
                        <div className="bg-rose-50 border border-rose-100 p-6 rounded-3xl flex items-start gap-4 shadow-sm">
                            <div className="bg-rose-100 text-rose-600 p-3 rounded-2xl shadow-inner">
                                <FontAwesomeIcon icon={faExclamationTriangle} />
                            </div>
                            <div className="flex-1">
                                <h4 className="text-base font-black text-rose-800">정산 계좌 정보 누락 확인 필요</h4>
                                <p className="text-sm text-rose-600 font-bold opacity-70 mt-0.5">아래 팀들의 계좌 정보가 마스터 데이터에 등록되어 있지 않습니다.</p>
                                <ul className="mt-3 grid grid-cols-2 gap-x-8 gap-y-1">
                                    {errors.slice(0, 10).map((e, i) => (
                                        <li key={i} className="text-[12px] text-rose-600 font-bold flex items-center gap-2">
                                            <div className="w-1 h-1 bg-rose-300 rounded-full"></div>
                                            {e}
                                        </li>
                                    ))}
                                    {errors.length > 10 && <li className="text-[11px] text-rose-400 mt-2 font-black italic">외 {errors.length - 10}개 팀 추가 누락...</li>}
                                </ul>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {detailTarget && (
                <DetailModal 
                    aggregate={detailTarget.aggregate} 
                    site={detailTarget.site} 
                    onClose={() => setDetailTarget(null)} 
                    capturePreview={capturePreview}
                    previewRefs={previewRefs}
                />
            )}

            {showLaborPreview && (
                <Modal title="노무내역서 미리보기" onClose={() => setShowLaborPreview(false)} widthClass="max-w-7xl">
                    <div className="sticky top-0 bg-white z-10 px-6 py-4 border-b flex items-center justify-between">
                        <p className="text-sm text-slate-500 font-bold">총 {sitePreviews.length}건의 내역서가 집계되었습니다.</p>
                        <ActionButton variant="solid-green" onClick={handleDownloadLabor}>
                            <FontAwesomeIcon icon={faFileExcel} /> 전체 엑셀 저장
                        </ActionButton>
                    </div>
                    <div className="p-6 space-y-20">
                        {sitePreviews.map(p => {
                            const key = `${p.aggregate.aggregateId}-${p.site.siteId}`;
                            return (
                                <div key={key} className="relative group">
                                    <div className="absolute -top-10 right-0 opacity-0 group-hover:opacity-100 transition-all flex gap-2">
                                        <button onClick={() => capturePreview(key)} className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-black shadow-xl hover:bg-indigo-700">
                                            <FontAwesomeIcon icon={faCamera} className="mr-2" /> 이미지로 저장
                                        </button>
                                    </div>
                                    <div ref={el => { if (el) previewRefs.current[key] = el; }}>
                                        <LaborStatementPreview aggregate={p.aggregate} site={p.site} rows={p.rows} yearMonth={selectedMonth} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </Modal>
            )}

            {showKBPreview && (
                <Modal title="국민은행 이체 정보 미리보기" onClose={() => setShowKBPreview(false)} widthClass="max-w-4xl">
                    <div className="p-6">
                        <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl mb-6 flex items-center gap-3">
                            <FontAwesomeIcon icon={faCircleExclamation} className="text-amber-500" />
                            <span className="text-sm font-bold text-amber-800">이 내역은 국민은행 기업뱅킹의 '대량이체' 양식에 최적화되어 있습니다.</span>
                        </div>
                        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                                    <tr>
                                        <th className="px-4 py-2.5 text-left">A. 은행</th>
                                        <th className="px-4 py-2.5 text-left">B. 계좌번호</th>
                                        <th className="px-4 py-2.5 text-right">C. 이체금액</th>
                                        <th className="px-4 py-2.5 text-left">D. 받는분</th>
                                        <th className="px-4 py-2.5 text-left">E. 메모</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {kbRows.map((r, i) => (
                                        <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                                            <td className="px-4 py-3 font-mono text-slate-500">{r.bankCode}</td>
                                            <td className="px-4 py-3 font-black text-slate-700 font-mono">{r.accountNumber}</td>
                                            <td className="px-4 py-3 text-right font-black text-amber-600 font-mono">{formatNumber(r.amount)}</td>
                                            <td className="px-4 py-3 font-bold text-slate-800">{r.accountHolder}</td>
                                            <td className="px-4 py-3 text-slate-400 text-[11px] truncate max-w-[150px]">{r.description}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="mt-6 flex justify-end">
                            <ActionButton variant="solid-amber" onClick={handleDownloadKB}>
                                <FontAwesomeIcon icon={faFileExcel} /> 엑셀 파일 다운로드
                            </ActionButton>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

// --- Sub Components ---

const DetailModal: React.FC<{
    aggregate: SupportCompanyAggregate;
    site: SupportSiteRow;
    onClose: () => void;
    capturePreview: (key: string) => void;
    previewRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
}> = ({ aggregate, site, onClose, capturePreview, previewRefs }) => {
    const key = `${aggregate.aggregateId}-${site.siteId}`;
    return (
        <Modal title={`${site.siteName} 상세 내역 및 미리보기`} onClose={onClose} widthClass="max-w-6xl">
            <div className="flex-1 overflow-auto bg-slate-50">
                <div className="p-6 space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                            <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">분류</div>
                            <div className="text-sm font-black text-indigo-600">{aggregate.direction}</div>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                            <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">기준팀</div>
                            <div className="text-sm font-black text-slate-800">{aggregate.viewTeamName}</div>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                            <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">작업팀(작업자 소속)</div>
                            <div className="text-sm font-black text-slate-800">{aggregate.sourceTeamName}</div>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                            <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">정산 주체({getSettlementBasisLabel(aggregate.direction)})</div>
                            <div className="text-sm font-black text-slate-800">{aggregate.companyName}</div>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                            <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">총액</div>
                            <div className="text-sm font-black text-amber-600">{formatNumber(site.totalAmount)}원</div>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                            <div>
                                <h4 className="text-sm font-black text-slate-800">투입 인원 명단 ({site.workers.length}명)</h4>
                                <p className="mt-1 text-[11px] font-semibold text-slate-500">{aggregate.settlementRule}</p>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => capturePreview(key)} className="bg-amber-500 text-white px-3 py-1.5 rounded-lg text-xs font-black shadow-md hover:bg-amber-600">
                                    <FontAwesomeIcon icon={faCamera} className="mr-2" /> 이미지 캡처
                                </button>
                            </div>
                        </div>
                        <div className="p-0">
                            <table className="w-full text-xs">
                                <thead className="bg-slate-50 text-slate-400 border-b border-slate-100">
                                    <tr>
                                        <th className="px-4 py-2.5 text-left">날짜</th>
                                        <th className="px-4 py-2.5 text-left">성명</th>
                                        <th className="px-4 py-2.5 text-left">작업팀(작업자 소속)</th>
                                        <th className="px-4 py-2.5 text-left">현장담당팀</th>
                                        <th className="px-4 py-2.5 text-left">지원 흐름</th>
                                        <th className="px-4 py-2.5 text-right">공수</th>
                                        <th className="px-4 py-2.5 text-right">단가</th>
                                        <th className="px-4 py-2.5 text-right">소계</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {site.workers.map((w, i) => (
                                        <tr key={i} className="border-b border-slate-50 last:border-0">
                                            <td className="px-4 py-2.5 font-mono text-slate-500">{w.date}</td>
                                            <td className="px-4 py-2.5 font-black text-slate-800">{w.workerName}</td>
                                            <td className="px-4 py-2.5 font-bold text-slate-600">{w.workerTeamName || w.teamName || '-'}</td>
                                            <td className="px-4 py-2.5 font-bold text-slate-600">{w.siteResponsibleTeamName || w.targetTeamName || '-'}</td>
                                            <td className="px-4 py-2.5 text-slate-500">{getWorkerFlowLabel(w, site)}</td>
                                            <td className="px-4 py-2.5 text-right font-mono font-bold">{w.manDay.toFixed(1)}</td>
                                            <td className="px-4 py-2.5 text-right font-mono text-slate-400">{formatNumber(w.unitPrice)}</td>
                                            <td className="px-4 py-2.5 text-right font-mono font-black text-slate-700">{formatNumber(w.amount)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

const LaborStatementPreview: React.FC<{ 
    aggregate: SupportCompanyAggregate; 
    site: SupportSiteRow; 
    rows: SupportLaborExcelRow[];
    yearMonth: string;
}> = ({ aggregate, site, rows, yearMonth }) => {
    const month = parseInt(yearMonth.split('-')[1] ?? '0', 10);
    const dayTotals = Array.from({ length: MAX_DAY_COLUMNS }, () => 0);
    rows.forEach(r => r.days.forEach((v, i) => { dayTotals[i] += v; }));
    const totalManDay = rows.reduce((acc, r) => acc + r.totalManDay, 0);
    const totalAmount = rows.reduce((acc, r) => acc + r.totalAmount, 0);
    const avgPrice = totalManDay > 0 ? Math.round(totalAmount / totalManDay) : 0;

    return (
        <div className="bg-white p-10 shadow-2xl border border-slate-200 inline-block min-w-full">
            <h2 className="text-3xl font-black text-center mb-8 tracking-widest text-slate-800 underline underline-offset-8 decoration-4 decoration-amber-500">
                노 무 비 지 급 명 세 서 ({month}월분)
            </h2>
            <div className="flex justify-between items-end mb-4 px-2">
                <div className="space-y-1">
                    <p className="text-sm font-bold text-slate-600">현장명: <span className="text-slate-900 border-b-2 border-slate-300 px-2">{site.siteName}</span></p>
                    <p className="text-sm font-bold text-slate-600">정산 주체: <span className="text-slate-900 border-b-2 border-slate-300 px-2">{aggregate.companyName}</span></p>
                </div>
                <p className="text-sm font-black text-amber-600">※ {aggregate.direction} 기준 집계</p>
            </div>
            <table className="w-full border-collapse border-2 border-slate-800 text-[10px]">
                <thead>
                    <tr className="bg-slate-100 text-slate-800 font-black">
                        <th className="border-2 border-slate-800 p-1.5 w-10" rowSpan={2}>NO</th>
                        <th className="border-2 border-slate-800 p-1.5 min-w-[80px]" rowSpan={2}>성명</th>
                        <th className="border-2 border-slate-800 p-1.5 min-w-[110px]">주민번호</th>
                        <th className="border-2 border-slate-800 p-1.5 min-w-[150px]" rowSpan={2}>주 소</th>
                        {DAY_LABELS_FIRST.map(d => <th key={d} className="border-2 border-slate-800 w-6 bg-sky-50 text-sky-700">{String(d).padStart(2, '0')}</th>)}
                        <th className="border-2 border-slate-800 w-6 bg-slate-50">X</th>
                        <th className="border-2 border-slate-800 p-1.5 w-16" rowSpan={2}>출역</th>
                        <th className="border-2 border-slate-800 p-1.5 w-24">단가</th>
                    </tr>
                    <tr className="bg-slate-100 text-slate-800 font-black">
                        <th className="border-2 border-slate-800 p-1.5">전화번호</th>
                        {[16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30].map(d => <th key={d} className="border-2 border-slate-800 w-6 bg-rose-50 text-rose-700">{d}</th>)}
                        <th className="border-2 border-slate-800 w-6 bg-rose-50 text-rose-700">31</th>
                        <th className="border-2 border-slate-800 p-1.5">총액</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((r, i) => (
                        <React.Fragment key={i}>
                            <tr className="font-bold">
                                <td rowSpan={2} className="border-2 border-slate-800 text-center bg-slate-50">{i + 1}</td>
                                <td rowSpan={2} className="border-2 border-slate-800 text-center text-xs">{r.workerName}</td>
                                <td className="border-2 border-slate-800 text-center font-mono">{maskIdNumber(r.idNumber)}</td>
                                <td rowSpan={2} className="border-2 border-slate-800 px-2 text-[9px] leading-tight">{r.address || '-'}</td>
                                {DAY_LABELS_FIRST.map(d => <td key={d} className="border-2 border-slate-800 text-center bg-sky-50/30">{formatDayValue(r.days[d - 1])}</td>)}
                                <td className="border-2 border-slate-800 bg-slate-50"></td>
                                <td rowSpan={2} className="border-2 border-slate-800 text-center font-mono text-xs bg-slate-50">{r.totalManDay.toFixed(1)}</td>
                                <td className="border-2 border-slate-800 text-right px-2 font-mono">{formatNumber(r.unitPrice)}</td>
                            </tr>
                            <tr className="font-bold">
                                <td className="border-2 border-slate-800 text-center font-mono text-slate-500">{r.contact || '-'}</td>
                                {[16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31].map(d => <td key={d} className="border-2 border-slate-800 text-center bg-rose-50/30">{formatDayValue(r.days[d - 1])}</td>)}
                                <td className="border-2 border-slate-800 text-right px-2 font-mono text-indigo-700 bg-emerald-50">{formatNumber(r.totalAmount)}</td>
                            </tr>
                        </React.Fragment>
                    ))}
                    <tr className="bg-slate-200 font-black text-xs">
                        <td colSpan={4} className="border-2 border-slate-800 text-center py-2">합 계</td>
                        {DAY_LABELS_FIRST.map(d => <td key={d} className="border-2 border-slate-800 text-center">{formatDayValue(dayTotals[d - 1])}</td>)}
                        <td className="border-2 border-slate-800"></td>
                        <td rowSpan={2} className="border-2 border-slate-800 text-center font-mono">{totalManDay.toFixed(1)}</td>
                        <td className="border-2 border-slate-800 text-right px-2 font-mono">{formatNumber(avgPrice)}</td>
                    </tr>
                    <tr className="bg-slate-200 font-black text-xs">
                        <td colSpan={4} className="border-2 border-slate-800 text-center py-2">총 액</td>
                        {[16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31].map(d => <td key={d} className="border-2 border-slate-800 text-center">{formatDayValue(dayTotals[d - 1])}</td>)}
                        <td className="border-2 border-slate-800 text-right px-2 font-mono text-indigo-800 bg-emerald-100">{formatNumber(totalAmount)}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
};

interface ActionButtonProps {
    children: React.ReactNode;
    variant: 'outline-green' | 'outline-amber' | 'solid-green' | 'solid-amber';
    disabled?: boolean;
    onClick?: () => void | Promise<void>;
    className?: string;
}

const ActionButton: React.FC<ActionButtonProps> = ({ children, variant, disabled, onClick, className }) => {
    const base = 'inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black transition-all focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 shadow-sm hover:translate-y-[-1px] active:translate-y-[0px]';
    const variants: Record<ActionButtonProps['variant'], string> = {
        'outline-green': 'border-2 border-emerald-500 text-emerald-600 hover:bg-emerald-50',
        'outline-amber': 'border-2 border-amber-500 text-amber-600 hover:bg-amber-50',
        'solid-green': 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-emerald-200',
        'solid-amber': 'bg-amber-500 text-white hover:bg-amber-400 shadow-amber-200'
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
    const toneMap: Record<SummaryCardProps['tone'], { bg: string; text: string; icon: string }> = {
        emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', icon: 'text-emerald-500' },
        sky: { bg: 'bg-sky-50', text: 'text-sky-700', icon: 'text-sky-500' },
        orange: { bg: 'bg-orange-50', text: 'text-orange-700', icon: 'text-orange-500' },
        violet: { bg: 'bg-violet-50', text: 'text-violet-700', icon: 'text-violet-500' }
    };
    return (
        <div className={`rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-all hover:shadow-md group`}>
            <div className={`mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl ${toneMap[tone].bg} transition-transform group-hover:scale-110`}>
                <FontAwesomeIcon icon={icon} className={`text-xl ${toneMap[tone].icon}`} />
            </div>
            <p className="text-[12px] font-black text-slate-400 uppercase tracking-wider">{label}</p>
            <p className={`text-2xl font-black mt-1 ${toneMap[tone].text}`}>{value}</p>
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={onClose} />
        <div className={`relative w-full rounded-3xl bg-white shadow-2xl ${widthClass} flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in duration-200`}>
            <div className="flex items-center justify-between border-b border-slate-100 px-8 py-5">
                <h3 className="text-xl font-black text-slate-800">{title}</h3>
                <button
                    type="button"
                    className="w-10 h-10 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all"
                    onClick={onClose}
                >
                    <FontAwesomeIcon icon={faXmark} className="text-xl" />
                </button>
            </div>
            <div className="flex-1 overflow-y-auto">
                {children}
            </div>
        </div>
    </div>
);

export default SupportTeamPaymentPage;
