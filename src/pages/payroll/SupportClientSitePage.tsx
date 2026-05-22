import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faArrowLeft,
    faBuilding,
    faCalendarAlt,
    faChevronRight,
    faCircleCheck,
    faDownload,
    faFileInvoiceDollar,
    faMapLocationDot,
    faReceipt,
    faSearch,
    faSpinner,
    faTriangleExclamation,
    faUsers,
    faXmark,
} from '@fortawesome/free-solid-svg-icons';
import * as XLSX from 'xlsx-js-style';
import { resolveIcon } from '../../constants/iconMap';
import { Team, teamService } from '../../services/teamService';
import { Company, companyService } from '../../services/companyService';
import { Site, siteService } from '../../services/siteService';
import { dailyReportService, DailyReport, DailyReportWorker } from '../../services/dailyReportService';
import { manpowerService, type Worker } from '../../services/manpowerService';
import { SupportRate, supportRateService } from '../../services/supportRateService';
import { teamExpenseLedgerService } from '../../services/teamExpenseLedgerService';
import type { TeamExpenseClaim } from '../../types/teamExpenseLedger';
import { hexToRgba, normalizeHexColor } from '../../utils/color';

type SupportDirection = '내부지원간곳' | '내부지원온곳' | '외부지원간곳' | '외부지원온곳';

interface SupportClientSiteWorkerRow {
    rowId: string;
    reportId: string;
    date: string;
    direction: SupportDirection;
    workerId: string;
    workerName: string;
    role?: string;
    manDay: number;
    unitPrice: number;
    amount: number;
    siteId: string;
    siteName: string;
    siteAddress?: string;
    siteType: string;
    paymentType: string;
    clientCompanyId: string;
    clientCompanyName: string;
    constructorCompanyId: string;
    constructorCompanyName: string;
    sourceTeamId: string;
    sourceTeamName: string;
    workerTeamId: string;
    workerTeamName: string;
    responsibleTeamId: string;
    responsibleTeamName: string;
    responsibleTeamColor: string;
    responsibleTeamIcon: string;
    settlementName: string;
    counterpartyName: string;
    evidenceNote: string;
}

interface SupportTeamBadge {
    key: string;
    name: string;
    color: string;
    icon: string;
}

interface SupportSiteSummary {
    key: string;
    siteId: string;
    siteName: string;
    siteAddress?: string;
    siteTypes: string[];
    paymentTypes: string[];
    clientCompanyId: string;
    clientCompanyName: string;
    constructorCompanyId: string;
    constructorCompanyName: string;
    responsibleTeams: SupportTeamBadge[];
    responsibleTeamNames: string[];
    sourceTeamNames: string[];
    settlementNames: string[];
    directions: SupportDirection[];
    activeDates: string[];
    workerCount: number;
    totalManDay: number;
    totalAmount: number;
    avgUnitPrice: number;
    expenseClaimAmount: number;
    expenseClaimCount: number;
    expenseClaims: TeamExpenseClaim[];
    rows: SupportClientSiteWorkerRow[];
}

interface SupportStatementTarget {
    title: string;
    subtitle?: string;
    rows: SupportClientSiteWorkerRow[];
    expenseClaims: TeamExpenseClaim[];
}

interface SupportResponsibleTeamSummary {
    key: string;
    team: SupportTeamBadge;
    siteCount: number;
    workerCount: number;
    totalManDay: number;
    totalAmount: number;
    avgUnitPrice: number;
    directions: SupportDirection[];
    activeDates: string[];
    sourceTeamNames: string[];
    settlementNames: string[];
    sites: SupportSiteSummary[];
    rows: SupportClientSiteWorkerRow[];
}

interface SupportClientSummary {
    key: string;
    clientCompanyId: string;
    clientCompanyName: string;
    siteCount: number;
    workerCount: number;
    totalManDay: number;
    totalAmount: number;
    directions: SupportDirection[];
    sites: SupportSiteSummary[];
}

const DEFAULT_SUPPORT_UNIT_PRICE = 230000;
const EXTERNAL_CLIENT_GROUP_ID = 'external-client-group';
const EXTERNAL_CLIENT_GROUP_NAME = '외부팀';
const EXTERNAL_CLIENT_GROUP_DISPLAY_NAME = '외부지원간곳';
const OWN_SITE_OUTPUT_LABEL = '본인현장출력';
const SUPPORT_DIRECTION_ORDER: SupportDirection[] = ['외부지원간곳', '외부지원온곳', '내부지원간곳', '내부지원온곳'];
const DIRECTION_META: Record<SupportDirection, { label: string; badgeClass: string; rowClass: string }> = {
    외부지원간곳: {
        label: '외부지원간곳',
        badgeClass: 'border-yellow-200 bg-yellow-100 text-yellow-800',
        rowClass: 'bg-yellow-50 text-yellow-900'
    },
    외부지원온곳: {
        label: '외부지원온곳',
        badgeClass: 'border-orange-200 bg-orange-100 text-orange-800',
        rowClass: 'bg-orange-50 text-orange-900'
    },
    내부지원간곳: {
        label: '내부지원간곳',
        badgeClass: 'border-sky-200 bg-sky-100 text-sky-800',
        rowClass: 'bg-sky-50 text-sky-900'
    },
    내부지원온곳: {
        label: '내부지원온곳',
        badgeClass: 'border-indigo-200 bg-indigo-100 text-indigo-800',
        rowClass: 'bg-indigo-50 text-indigo-900'
    }
};

const DIRECTION_OPTIONS: Array<{ id: 'all' | SupportDirection; label: string }> = [
    { id: 'all', label: '전체 구분' },
    ...SUPPORT_DIRECTION_ORDER.map((direction) => ({ id: direction, label: direction }))
];

const normalize = (value: unknown): string => String(value ?? '').replace(/\s+/g, '').trim();
const normalizeName = (value: unknown): string =>
    String(value ?? '').replace(/\(.*?\)/g, '').replace(/\s+/g, '').trim();
const normalizeTeamComparisonName = (value: unknown): string =>
    normalizeName(value).replace(/(?:현장담당|작업|지원)?팀$/g, '');

const formatNumber = (value: number): string => new Intl.NumberFormat('ko-KR').format(Math.round(value || 0));

const formatManDay = (value: number): string => {
    const fixed = Number((value || 0).toFixed(1));
    return fixed % 1 === 0 ? fixed.toFixed(0) : fixed.toFixed(1);
};

const getCurrentYearMonth = (): string => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
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

const ISSUED_AMOUNT_STORAGE_PREFIX = 'support-client-site-issued-amounts';

const getIssuedAmountStorageKey = (yearMonth: string): string =>
    `${ISSUED_AMOUNT_STORAGE_PREFIX}:${yearMonth || 'unknown-month'}`;

const parseIssuedAmount = (value?: string): number => {
    const parsed = Number(String(value ?? '').replace(/[^0-9]/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeIssuedAmountInput = (value: string): string =>
    value.replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, '');

const loadIssuedAmounts = (yearMonth: string): Record<string, string> => {
    if (typeof window === 'undefined') return {};
    try {
        const raw = window.localStorage.getItem(getIssuedAmountStorageKey(yearMonth));
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
        return Object.fromEntries(
            Object.entries(parsed)
                .map(([key, value]) => [key, normalizeIssuedAmountInput(String(value ?? ''))])
                .filter(([, value]) => value)
        );
    } catch (error) {
        console.warn('[SupportClientSitePage] issued amount load failed:', error);
        return {};
    }
};

const toPositiveRate = (value: unknown): number | null => {
    const parsed = typeof value === 'number'
        ? value
        : typeof value === 'string'
            ? Number(value.replace(/,/g, ''))
            : NaN;
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return Math.round(parsed);
};

const getIdentityKey = (id: unknown, name: unknown, fallback: string): string =>
    normalize(id) || normalizeName(name) || fallback;

const uniqueValues = (values: Array<string | undefined | null>): string[] => {
    const seen = new Set<string>();
    values.forEach((value) => {
        const trimmed = String(value ?? '').trim();
        if (trimmed) seen.add(trimmed);
    });
    return Array.from(seen);
};

const summarizeNames = (values: Array<string | undefined | null>, fallback = '-'): string => {
    const unique = uniqueValues(values);
    return unique.length > 0 ? unique.join(', ') : fallback;
};

const isSameIdentity = (a?: string | null, b?: string | null): boolean =>
    !!normalize(a) && normalize(a) === normalize(b);

const matchesTeamReference = (
    leftId?: string | null,
    leftName?: string | null,
    rightId?: string | null,
    rightName?: string | null
): boolean => (
    isSameIdentity(leftId, rightId) ||
    (!!normalizeName(leftName) && normalizeName(leftName) === normalizeName(rightName))
);

const matchesSiteReference = (
    claim: Pick<TeamExpenseClaim, 'siteId' | 'siteName'>,
    site: Pick<SupportSiteSummary, 'siteId' | 'siteName'>
): boolean => (
    isSameIdentity(claim.siteId, site.siteId) ||
    (!!normalizeName(claim.siteName) && normalizeName(claim.siteName) === normalizeName(site.siteName))
);

const isPostedTeamChargeClaim = (claim: TeamExpenseClaim): boolean =>
    claim.claimType === 'teamCharge' &&
    (claim.status === 'charged' || claim.status === 'settled') &&
    Number(claim.amount || 0) > 0;

const getExpenseClaimAmount = (claim: TeamExpenseClaim): number =>
    Math.max(0, Math.round(Number(claim.amount || 0)));

const getExpenseClaimStatusLabel = (status: TeamExpenseClaim['status']): string => {
    if (status === 'charged') return '청구완료';
    if (status === 'settled') return '정산완료';
    return '작성중';
};

const getExpenseClaimKey = (claim: TeamExpenseClaim): string =>
    claim.id || [
        claim.yearMonth,
        claim.date,
        claim.payerTeamId,
        claim.payerTeamName,
        claim.chargeToTeamId,
        claim.chargeToTeamName,
        claim.siteId,
        claim.siteName,
        claim.category,
        claim.description,
        claim.amount
    ].map(value => String(value ?? '').trim()).join('::');

const sortExpenseClaims = (claims: TeamExpenseClaim[]): TeamExpenseClaim[] =>
    [...claims].sort((a, b) =>
        (a.date || '').localeCompare(b.date || '') ||
        (a.siteName || '').localeCompare(b.siteName || '', 'ko-KR') ||
        (a.description || '').localeCompare(b.description || '', 'ko-KR')
    );

const dedupeExpenseClaims = (claims: TeamExpenseClaim[]): TeamExpenseClaim[] => {
    const claimMap = new Map<string, TeamExpenseClaim>();
    claims.forEach((claim) => {
        claimMap.set(getExpenseClaimKey(claim), claim);
    });
    return sortExpenseClaims(Array.from(claimMap.values()));
};

const getExpenseClaimsTotal = (claims: TeamExpenseClaim[]): number =>
    claims.reduce((sum, claim) => sum + getExpenseClaimAmount(claim), 0);

type OwnSiteOutputComparableRow = Pick<
    SupportClientSiteWorkerRow,
    'sourceTeamId' | 'sourceTeamName' | 'responsibleTeamId' | 'responsibleTeamName'
> & Partial<Pick<SupportClientSiteWorkerRow, 'workerTeamId' | 'workerTeamName'>>;

const isOwnSiteOutputRow = (
    row: OwnSiteOutputComparableRow
): boolean => {
    const sourceTeamId = normalize(row.sourceTeamId);
    const responsibleTeamId = normalize(row.responsibleTeamId);
    const sourceTeamName = normalizeTeamComparisonName(row.sourceTeamName);
    const responsibleTeamName = normalizeTeamComparisonName(row.responsibleTeamName);
    const workerTeamId = normalize(row.workerTeamId);
    const workerTeamName = normalizeTeamComparisonName(row.workerTeamName);

    const sourceMatchesResponsible =
        (sourceTeamId && responsibleTeamId && sourceTeamId === responsibleTeamId) ||
        (sourceTeamName && responsibleTeamName && sourceTeamName === responsibleTeamName);

    const workerMatchesResponsible =
        (workerTeamId && responsibleTeamId && workerTeamId === responsibleTeamId) ||
        (workerTeamName && responsibleTeamName && workerTeamName === responsibleTeamName);

    return Boolean(sourceMatchesResponsible || workerMatchesResponsible);
};

const getSourceTeamDisplayName = (
    row: OwnSiteOutputComparableRow
): string => (isOwnSiteOutputRow(row) ? OWN_SITE_OUTPUT_LABEL : String(row.sourceTeamName || '').trim());

const summarizeSourceTeamDisplayNames = (rows: SupportClientSiteWorkerRow[], fallback = '-'): string =>
    summarizeNames(rows.map((row) => getSourceTeamDisplayName(row)), fallback);

const getOutputTypeDisplayName = (row: SupportClientSiteWorkerRow): string =>
    isOwnSiteOutputRow(row) ? OWN_SITE_OUTPUT_LABEL : row.direction;

const summarizeOutputTypeDisplayNames = (rows: SupportClientSiteWorkerRow[], fallback = '-'): string =>
    summarizeNames(rows.map((row) => getOutputTypeDisplayName(row)), fallback);

const uniqueResponsibleTeams = (rows: SupportClientSiteWorkerRow[]): SupportTeamBadge[] => {
    const map = new Map<string, SupportTeamBadge>();

    rows.forEach((row) => {
        const name = String(row.responsibleTeamName || '').trim();
        if (!name) return;

        const key = normalize(row.responsibleTeamId) || normalizeName(name) || name;
        if (map.has(key)) return;

        map.set(key, {
            key,
            name,
            color: normalizeHexColor(row.responsibleTeamColor),
            icon: row.responsibleTeamIcon || 'fa-users'
        });
    });

    return Array.from(map.values());
};

const getPrimaryResponsibleTeam = (site: SupportSiteSummary): SupportTeamBadge => {
    const existing = site.responsibleTeams[0];
    if (existing) return existing;

    const row = site.rows[0];
    const name = String(row?.responsibleTeamName || '현장담당팀 미지정').trim();
    const key = normalize(row?.responsibleTeamId) || normalizeName(name) || `${site.key}:responsible-team`;
    return {
        key,
        name,
        color: normalizeHexColor(row?.responsibleTeamColor),
        icon: row?.responsibleTeamIcon || 'fa-users'
    };
};

const groupSitesByResponsibleTeam = (sites: SupportSiteSummary[]): SupportResponsibleTeamSummary[] => {
    const groupMap = new Map<string, { team: SupportTeamBadge; sites: SupportSiteSummary[] }>();

    sites.forEach((site) => {
        const team = getPrimaryResponsibleTeam(site);
        const key = team.key || normalizeName(team.name) || `${site.key}:responsible-team`;
        if (!groupMap.has(key)) {
            groupMap.set(key, { team: { ...team, key }, sites: [] });
        }
        groupMap.get(key)!.sites.push(site);
    });

    return Array.from(groupMap.values())
        .map((group) => {
            const rows = group.sites.flatMap((site) => site.rows);
            const totalManDay = group.sites.reduce((sum, site) => sum + site.totalManDay, 0);
            const totalAmount = group.sites.reduce((sum, site) => sum + site.totalAmount, 0);
            const workerKeys = new Set(rows.map((row) => row.workerId || row.workerName));

            return {
                key: group.team.key,
                team: group.team,
                siteCount: group.sites.length,
                workerCount: workerKeys.size,
                totalManDay,
                totalAmount,
                avgUnitPrice: totalManDay > 0 ? Math.round(totalAmount / totalManDay) : 0,
                directions: uniqueValues(rows.map((row) => row.direction)) as SupportDirection[],
                activeDates: uniqueValues(rows.map((row) => row.date)).sort(),
                sourceTeamNames: uniqueValues(rows.map((row) => row.sourceTeamName)),
                settlementNames: uniqueValues(rows.map((row) => row.settlementName)),
                sites: group.sites,
                rows
            };
        })
        .sort((a, b) => b.totalAmount - a.totalAmount || a.team.name.localeCompare(b.team.name, 'ko-KR'));
};

const isExternalClientSummary = (client: Pick<SupportClientSummary, 'clientCompanyId' | 'clientCompanyName'>): boolean =>
    client.clientCompanyId === EXTERNAL_CLIENT_GROUP_ID ||
    client.clientCompanyName === EXTERNAL_CLIENT_GROUP_NAME ||
    client.clientCompanyName === EXTERNAL_CLIENT_GROUP_DISPLAY_NAME;

const claimMatchesSiteSettlement = (claim: TeamExpenseClaim, site: SupportSiteSummary): boolean =>
    site.rows.some((row) => {
        if (row.direction.endsWith('간곳')) {
            return matchesTeamReference(claim.chargeToTeamId, claim.chargeToTeamName, row.responsibleTeamId, row.responsibleTeamName);
        }
        return matchesTeamReference(claim.payerTeamId, claim.payerTeamName, row.sourceTeamId, row.sourceTeamName);
    });

const applyExpenseClaimsToClientGroups = (
    clients: SupportClientSummary[],
    claims: TeamExpenseClaim[]
): SupportClientSummary[] => {
    const postedClaims = claims.filter(isPostedTeamChargeClaim);

    return clients.map((client) => ({
        ...client,
        sites: client.sites.map((site) => {
            const expenseClaims = dedupeExpenseClaims(postedClaims.filter((claim) =>
                matchesSiteReference(claim, site) && claimMatchesSiteSettlement(claim, site)
            ));
            const expenseClaimAmount = getExpenseClaimsTotal(expenseClaims);

            return {
                ...site,
                expenseClaims,
                expenseClaimAmount,
                expenseClaimCount: expenseClaims.length
            };
        })
    }));
};

const getSiteExpenseClaims = (site: SupportSiteSummary): TeamExpenseClaim[] =>
    dedupeExpenseClaims(site.expenseClaims ?? []);

const getSitesExpenseClaims = (sites: SupportSiteSummary[]): TeamExpenseClaim[] =>
    dedupeExpenseClaims(sites.flatMap((site) => getSiteExpenseClaims(site)));

const getSitesExpenseClaimAmount = (sites: SupportSiteSummary[]): number =>
    getExpenseClaimsTotal(getSitesExpenseClaims(sites));

const isCheongyeonCompanyName = (name?: string | null): boolean => {
    const normalized = normalizeName(name);
    return Boolean(normalized && (normalized.includes('청연') || normalized.includes('청연이엔지')));
};

const normalizeSalaryModel = (value: unknown): string => {
    const raw = String(value ?? '').trim();
    if (!raw) return '';
    if (raw.includes('지원') || raw.toLowerCase().includes('support')) return '지원팀';
    if (raw.includes('월급')) return '월급제';
    if (raw.includes('일급')) return '일급제';
    if (raw.includes('용역')) return '용역팀';
    return raw;
};

const getClientCompanyName = (row: Pick<SupportClientSiteWorkerRow, 'clientCompanyName'>): string =>
    String(row.clientCompanyName || '발주사 미지정').trim();

const clientKeyForRow = (row: Pick<SupportClientSiteWorkerRow, 'clientCompanyId' | 'clientCompanyName'>): string =>
    getIdentityKey(row.clientCompanyId, getClientCompanyName(row), 'client:unknown');

const siteKeyForRow = (row: Pick<SupportClientSiteWorkerRow, 'siteId' | 'siteName'>): string =>
    getIdentityKey(row.siteId, row.siteName, 'site:unknown');

const buildSupportRows = (
    reports: DailyReport[],
    teams: Team[],
    companies: Company[],
    sites: Site[],
    supportRates: SupportRate[],
    workers: Worker[] = []
): SupportClientSiteWorkerRow[] => {
    const teamById = new Map<string, Team>();
    const teamByName = new Map<string, Team>();
    const teamByMemberId = new Map<string, Team>();
    const teamByMemberName = new Map<string, Team>();
    teams.forEach((team) => {
        if (team.id) teamById.set(String(team.id), team);
        if (team.legacyId) teamById.set(String(team.legacyId), team);
        const nameKey = normalizeName(team.name);
        if (nameKey && !teamByName.has(nameKey)) teamByName.set(nameKey, team);
        (team.memberIds || []).forEach((value) => {
            const id = String(value ?? '').trim();
            if (!id || teamByMemberId.has(id)) return;
            teamByMemberId.set(id, team);
            const normalizedId = normalize(id);
            if (normalizedId && !teamByMemberId.has(normalizedId)) teamByMemberId.set(normalizedId, team);
        });
        (team.memberNames || []).forEach((value) => {
            const nameKeyByMember = normalizeName(value);
            if (nameKeyByMember && !teamByMemberName.has(nameKeyByMember)) teamByMemberName.set(nameKeyByMember, team);
        });
    });

    const workerByAnyId = new Map<string, Worker>();
    const workerByName = new Map<string, Worker>();
    workers.forEach((worker) => {
        [worker.id, worker.legacyId].forEach((value) => {
            const id = String(value ?? '').trim();
            if (!id) return;
            if (!workerByAnyId.has(id)) workerByAnyId.set(id, worker);
            const normalizedId = normalize(id);
            if (normalizedId && !workerByAnyId.has(normalizedId)) workerByAnyId.set(normalizedId, worker);
        });

        const nameKey = normalizeName(worker.name);
        if (nameKey && !workerByName.has(nameKey)) workerByName.set(nameKey, worker);
    });

    const companyById = new Map<string, Company>();
    companies.forEach((company) => {
        if (company.id) companyById.set(String(company.id), company);
    });

    const siteById = new Map<string, Site>();
    const siteByName = new Map<string, Site>();
    sites.forEach((site) => {
        if (site.id) siteById.set(String(site.id), site);
        const nameKey = normalizeName(site.name);
        if (nameKey && !siteByName.has(nameKey)) siteByName.set(nameKey, site);
    });

    const supportRateBySiteId = new Map<string, number>();
    const supportRateBySiteName = new Map<string, number>();
    supportRates.forEach((rate) => {
        const configuredRate = toPositiveRate(rate.defaultRate);
        if (!configuredRate) return;
        const siteId = normalize(rate.siteId || rate.id);
        const siteName = normalizeName(rate.siteName);
        if (siteId) supportRateBySiteId.set(siteId, configuredRate);
        if (siteName) supportRateBySiteName.set(siteName, configuredRate);
    });

    const findCompanyByName = (companyName?: string | null): Company | undefined => {
        const key = normalizeName(companyName);
        if (!key) return undefined;
        return companies.find((company) => normalizeName(company.name) === key);
    };

    const isMyCompany = (companyId?: string | null, companyName?: string | null): boolean => {
        const id = String(companyId ?? '').trim();
        const company = id ? companyById.get(id) : undefined;
        if (company?.isMyCompany) return true;
        if (company && isCheongyeonCompanyName(company.name)) return true;
        const byName = findCompanyByName(companyName);
        if (byName?.isMyCompany) return true;
        return isCheongyeonCompanyName(companyName);
    };

    const findTeam = (teamId?: string | null, teamName?: string | null): Team | undefined => {
        const id = String(teamId ?? '').trim();
        if (id) {
            const byId = teamById.get(id);
            if (byId) return byId;
        }
        const nameKey = normalizeName(teamName);
        return nameKey ? teamByName.get(nameKey) : undefined;
    };

    const findWorker = (workerId?: string | null, workerName?: string | null): Worker | undefined => {
        const id = String(workerId ?? '').trim();
        const byId = id ? (workerByAnyId.get(id) || workerByAnyId.get(normalize(id))) : undefined;
        if (byId) return byId;
        const nameKey = normalizeName(workerName);
        return nameKey ? workerByName.get(nameKey) : undefined;
    };

    const findTeamByMember = (workerId?: string | null, workerName?: string | null): Team | undefined => {
        const id = String(workerId ?? '').trim();
        const byId = id ? (teamByMemberId.get(id) || teamByMemberId.get(normalize(id))) : undefined;
        if (byId) return byId;
        const nameKey = normalizeName(workerName);
        return nameKey ? teamByMemberName.get(nameKey) : undefined;
    };

    const normalizeClientCompany = (companyId?: string | null, companyName?: string | null): { id: string; name: string } => {
        const rawId = String(companyId ?? '').trim();
        const rawName = String(companyName ?? '').trim();
        const companyByIdValue = rawId ? companyById.get(rawId) : undefined;
        const companyByNameValue = findCompanyByName(rawName);
        const resolvedId = String(companyByIdValue?.id || companyByNameValue?.id || rawId || '').trim();
        const resolvedName = String(companyByIdValue?.name || companyByNameValue?.name || rawName || '발주사 미지정').trim();
        const isTeamName = Boolean(findTeam('', resolvedName) || /팀$/.test(resolvedName));

        if (resolvedName === EXTERNAL_CLIENT_GROUP_NAME || resolvedName === EXTERNAL_CLIENT_GROUP_DISPLAY_NAME) {
            return {
                id: EXTERNAL_CLIENT_GROUP_ID,
                name: EXTERNAL_CLIENT_GROUP_DISPLAY_NAME
            };
        }

        if (isTeamName && !companyByIdValue && !companyByNameValue) {
            return {
                id: EXTERNAL_CLIENT_GROUP_ID,
                name: EXTERNAL_CLIENT_GROUP_DISPLAY_NAME
            };
        }

        return {
            id: resolvedId,
            name: resolvedName
        };
    };

    const resolveConfiguredSiteRate = (siteId?: string | null, siteName?: string | null): number | null => {
        const normalizedSiteId = normalize(siteId);
        if (normalizedSiteId) {
            const direct = supportRateBySiteId.get(normalizedSiteId);
            if (direct) return direct;
            const site = siteById.get(normalizedSiteId);
            const byResolvedName = site ? supportRateBySiteName.get(normalizeName(site.name)) : undefined;
            if (byResolvedName) return byResolvedName;
        }
        const normalizedSiteName = normalizeName(siteName);
        return normalizedSiteName ? (supportRateBySiteName.get(normalizedSiteName) ?? null) : null;
    };

    const rows: SupportClientSiteWorkerRow[] = [];

    reports.forEach((report) => {
        const reportSite = report.siteId
            ? siteById.get(String(report.siteId))
            : siteByName.get(normalizeName(report.siteName));
        const siteId = String(report.siteId || reportSite?.id || 'unknown-site').trim();
        const siteName = String(report.siteName || reportSite?.name || '현장 미지정').trim();
        const siteAddress = String(reportSite?.address || '').trim();
        const siteType = String(report.siteType || reportSite?.siteType || '').trim();
        const paymentType = String(report.paymentType || reportSite?.paymentMethod || '').trim();
        const rawClientCompanyId = String(
            reportSite?.clientCompanyId ||
            report.companyId ||
            ''
        ).trim();
        const rawClientCompanyName = String(
            reportSite?.clientCompanyName ||
            report.companyName ||
            '발주사 미지정'
        ).trim();
        const normalizedClientCompany = normalizeClientCompany(rawClientCompanyId, rawClientCompanyName);
        const clientCompanyId = normalizedClientCompany.id;
        const clientCompanyName = normalizedClientCompany.name;
        const constructorCompanyId = String(
            reportSite?.constructorCompanyId ||
            reportSite?.companyId ||
            report.constructorCompanyId ||
            report.companyId ||
            ''
        ).trim();
        const constructorCompanyName = String(
            reportSite?.constructorCompanyName ||
            reportSite?.companyName ||
            report.constructorCompanyName ||
            report.companyName ||
            '시공사 미지정'
        ).trim();
        const siteIsMyCompany = isMyCompany(constructorCompanyId, constructorCompanyName);

        const targetTeamNameRaw = String(report.responsibleTeamName || reportSite?.responsibleTeamName || report.teamName || '').trim();
        const targetTeamIdRaw = String(report.responsibleTeamId || reportSite?.responsibleTeamId || report.teamId || '').trim();
        const targetTeam = findTeam(targetTeamIdRaw, targetTeamNameRaw);
        const responsibleTeamId = String(targetTeam?.id || targetTeamIdRaw || '').trim();
        const responsibleTeamName = String(targetTeam?.name || targetTeamNameRaw || '현장담당팀 미지정').trim();
        const responsibleTeamColor = normalizeHexColor(targetTeam?.color);
        const responsibleTeamIcon = String(targetTeam?.iconKey || targetTeam?.icon || 'fa-users').trim();
        const targetCompanyId = String(targetTeam?.companyId || constructorCompanyId || report.companyId || '').trim();
        const targetCompanyName = String(targetTeam?.companyName || constructorCompanyName || report.companyName || '').trim();
        const targetIsMyCompany = isMyCompany(targetCompanyId, targetCompanyName);

        const reportWorkers = Array.isArray(report.workers) ? report.workers : [];
        reportWorkers.forEach((reportWorker: DailyReportWorker, workerIndex) => {
            const normalizedSalary = normalizeSalaryModel(reportWorker.salaryModel || reportWorker.payType);
            const isSupportModel = normalizedSalary === '지원팀';
            const workerId = String(reportWorker.workerId || `${report.id || 'report'}-${workerIndex}`).trim();
            const workerName = String(reportWorker.name || '이름 미상').trim();
            const workerSiteType = String(reportWorker.siteType || siteType || '').trim();
            const workerPaymentType = String(reportWorker.paymentType || paymentType || '').trim();
            const workerProfile = findWorker(workerId, workerName);
            const profileTeamId = String(workerProfile?.teamId || '').trim();
            const profileTeamName = String(workerProfile?.teamName || '').trim();
            const memberTeam = findTeamByMember(workerId, workerName);
            const reportWorkerTeamId = String(reportWorker.teamId || '').trim();
            const reportWorkerTeamName = String(reportWorker.workerTeamName || '').trim();
            const fallbackTeamId = reportWorkerTeamName ? '' : String(report.teamId || '').trim();
            const sourceTeam = findTeam(reportWorkerTeamId || fallbackTeamId, reportWorkerTeamName || report.teamName);
            const sourceTeamId = String(sourceTeam?.id || reportWorkerTeamId || fallbackTeamId || normalizeName(reportWorkerTeamName) || '').trim();
            const sourceTeamName = String(sourceTeam?.name || reportWorkerTeamName || report.teamName || '작업팀 미지정').trim();
            const workerTeam =
                findTeam(profileTeamId, profileTeamName) ||
                memberTeam ||
                findTeam(reportWorkerTeamId || fallbackTeamId, reportWorkerTeamName || report.teamName);
            const workerTeamId = String(workerTeam?.id || profileTeamId || reportWorkerTeamId || fallbackTeamId || normalizeName(profileTeamName || reportWorkerTeamName) || '').trim();
            const workerTeamName = String(workerTeam?.name || profileTeamName || reportWorkerTeamName || report.teamName || sourceTeamName || '작업팀 미지정').trim();
            const sourceCompanyId = String(sourceTeam?.companyId || '').trim();
            const sourceCompanyName = String(sourceTeam?.companyName || (sourceCompanyId ? companyById.get(sourceCompanyId)?.name : '') || '').trim();
            const sourceIsMyCompany = isMyCompany(sourceCompanyId, sourceCompanyName);
            const isSupportTeam = normalize(sourceTeam?.type).includes('지원');

            const classifiedEntries: Array<{
                direction: SupportDirection;
                settlementName: string;
                counterpartyName: string;
                evidenceNote: string;
            }> = [];

            if (sourceIsMyCompany && targetIsMyCompany && sourceTeamId && responsibleTeamId && sourceTeamId !== responsibleTeamId) {
                classifiedEntries.push({
                    direction: '내부지원간곳',
                    settlementName: responsibleTeamName,
                    counterpartyName: responsibleTeamName,
                    evidenceNote: '청연 소속 작업팀이 다른 청연 담당 현장으로 지원 나간 건'
                });
                classifiedEntries.push({
                    direction: '내부지원온곳',
                    settlementName: sourceTeamName,
                    counterpartyName: sourceTeamName,
                    evidenceNote: '다른 청연 소속 작업팀이 청연 담당 현장으로 지원 온 건'
                });
            } else if (!siteIsMyCompany && sourceIsMyCompany) {
                classifiedEntries.push({
                    direction: '외부지원간곳',
                    settlementName: responsibleTeamName || constructorCompanyName,
                    counterpartyName: constructorCompanyName || siteName,
                    evidenceNote: '청연 소속 작업팀이 외부 현장으로 지원 나간 건'
                });
            } else if (siteIsMyCompany && targetIsMyCompany && !sourceIsMyCompany) {
                classifiedEntries.push({
                    direction: '외부지원온곳',
                    settlementName: sourceTeamName || sourceCompanyName || '외부 지원팀',
                    counterpartyName: sourceTeamName || sourceCompanyName || '외부 지원팀',
                    evidenceNote: '외부 작업팀이 청연 담당 현장으로 지원 온 건'
                });
            } else if (siteIsMyCompany && targetIsMyCompany && (isSupportModel || isSupportTeam)) {
                classifiedEntries.push({
                    direction: '외부지원온곳',
                    settlementName: sourceTeamName || sourceCompanyName || '지원팀',
                    counterpartyName: sourceTeamName || sourceCompanyName || '지원팀',
                    evidenceNote: '지원팀 소속 인원이 청연 담당 현장으로 지원 온 건'
                });
            }

            if (classifiedEntries.length === 0) return;

            const rawManDay = Number(reportWorker.manDay || 0);
            const manDay = Number.isFinite(rawManDay) ? rawManDay : 0;
            if (manDay <= 0) return;

            const unitPrice =
                resolveConfiguredSiteRate(siteId, siteName) ??
                toPositiveRate(sourceTeam?.supportRate) ??
                toPositiveRate(reportWorker.unitPrice) ??
                DEFAULT_SUPPORT_UNIT_PRICE;
            const amount = Math.round(manDay * unitPrice);

            classifiedEntries.forEach((entry) => {
                rows.push({
                    rowId: [
                        report.id || 'report',
                        workerIndex,
                        entry.direction,
                        workerId,
                        siteId
                    ].join('::'),
                    reportId: String(report.id || ''),
                    date: String(report.date || ''),
                    direction: entry.direction,
                    workerId,
                    workerName,
                    role: reportWorker.role || undefined,
                    manDay,
                    unitPrice,
                    amount,
                    siteId,
                    siteName,
                    siteAddress,
                    siteType: workerSiteType,
                    paymentType: workerPaymentType,
                    clientCompanyId,
                    clientCompanyName,
                    constructorCompanyId,
                    constructorCompanyName,
                    sourceTeamId,
                    sourceTeamName,
                    workerTeamId,
                    workerTeamName,
                    responsibleTeamId,
                    responsibleTeamName,
                    responsibleTeamColor,
                    responsibleTeamIcon,
                    settlementName: entry.settlementName,
                    counterpartyName: entry.counterpartyName,
                    evidenceNote: entry.evidenceNote
                });
            });
        });
    });

    return rows.sort((a, b) =>
        getClientCompanyName(a).localeCompare(getClientCompanyName(b), 'ko-KR') ||
        a.siteName.localeCompare(b.siteName, 'ko-KR') ||
        SUPPORT_DIRECTION_ORDER.indexOf(a.direction) - SUPPORT_DIRECTION_ORDER.indexOf(b.direction) ||
        a.date.localeCompare(b.date)
    );
};

const groupRowsByClientAndSite = (rows: SupportClientSiteWorkerRow[]): SupportClientSummary[] => {
    const clientMap = new Map<string, {
        key: string;
        clientCompanyId: string;
        clientCompanyName: string;
        siteMap: Map<string, SupportSiteSummary>;
    }>();

    rows.forEach((row) => {
        const clientKey = clientKeyForRow(row);
        if (!clientMap.has(clientKey)) {
            clientMap.set(clientKey, {
                key: clientKey,
                clientCompanyId: row.clientCompanyId,
                clientCompanyName: getClientCompanyName(row),
                siteMap: new Map<string, SupportSiteSummary>()
            });
        }

        const client = clientMap.get(clientKey)!;
        const siteKey = `${clientKey}::${siteKeyForRow(row)}`;
        if (!client.siteMap.has(siteKey)) {
            client.siteMap.set(siteKey, {
                key: siteKey,
                siteId: row.siteId,
                siteName: row.siteName,
                siteAddress: row.siteAddress,
                siteTypes: [],
                paymentTypes: [],
                clientCompanyId: row.clientCompanyId,
                clientCompanyName: getClientCompanyName(row),
                constructorCompanyId: row.constructorCompanyId,
                constructorCompanyName: row.constructorCompanyName,
                responsibleTeams: [],
                responsibleTeamNames: [],
                sourceTeamNames: [],
                settlementNames: [],
                directions: [],
                activeDates: [],
                workerCount: 0,
                totalManDay: 0,
                totalAmount: 0,
                avgUnitPrice: 0,
                expenseClaimAmount: 0,
                expenseClaimCount: 0,
                expenseClaims: [],
                rows: []
            });
        }

        client.siteMap.get(siteKey)!.rows.push(row);
    });

    return Array.from(clientMap.values())
        .map((client) => {
            const sites = Array.from(client.siteMap.values())
                .map((site) => {
                    const sortedRows = [...site.rows].sort((a, b) =>
                        a.date.localeCompare(b.date) ||
                        a.workerName.localeCompare(b.workerName, 'ko-KR') ||
                        SUPPORT_DIRECTION_ORDER.indexOf(a.direction) - SUPPORT_DIRECTION_ORDER.indexOf(b.direction)
                    );
                    const totalManDay = sortedRows.reduce((sum, row) => sum + row.manDay, 0);
                    const totalAmount = sortedRows.reduce((sum, row) => sum + row.amount, 0);
                    const workerKeys = new Set(sortedRows.map((row) => row.workerId || row.workerName));

                    return {
                        ...site,
                        rows: sortedRows,
                        responsibleTeams: uniqueResponsibleTeams(sortedRows),
                        responsibleTeamNames: uniqueValues(sortedRows.map((row) => row.responsibleTeamName)),
                        sourceTeamNames: uniqueValues(sortedRows.map((row) => row.sourceTeamName)),
                        settlementNames: uniqueValues(sortedRows.map((row) => row.settlementName)),
                        siteTypes: uniqueValues(sortedRows.map((row) => row.siteType)),
                        paymentTypes: uniqueValues(sortedRows.map((row) => row.paymentType)),
                        directions: uniqueValues(sortedRows.map((row) => row.direction)) as SupportDirection[],
                        activeDates: uniqueValues(sortedRows.map((row) => row.date)).sort(),
                        workerCount: workerKeys.size,
                        totalManDay,
                        totalAmount,
                        avgUnitPrice: totalManDay > 0 ? Math.round(totalAmount / totalManDay) : 0
                    };
                })
                .sort((a, b) => b.totalAmount - a.totalAmount || a.siteName.localeCompare(b.siteName, 'ko-KR'));

            const allRows = sites.flatMap((site) => site.rows);
            return {
                key: client.key,
                clientCompanyId: client.clientCompanyId,
                clientCompanyName: client.clientCompanyName,
                siteCount: sites.length,
                workerCount: new Set(allRows.map((row) => row.workerId || row.workerName)).size,
                totalManDay: sites.reduce((sum, site) => sum + site.totalManDay, 0),
                totalAmount: sites.reduce((sum, site) => sum + site.totalAmount, 0),
                directions: uniqueValues(allRows.map((row) => row.direction)) as SupportDirection[],
                sites
            };
        })
        .sort((a, b) => b.totalAmount - a.totalAmount || a.clientCompanyName.localeCompare(b.clientCompanyName, 'ko-KR'));
};

const DirectionBadge: React.FC<{ direction: SupportDirection }> = ({ direction }) => (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-black ${DIRECTION_META[direction].badgeClass}`}>
        {DIRECTION_META[direction].label}
    </span>
);

const OwnSiteOutputBadge: React.FC = () => (
    <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-black text-emerald-700">
        {OWN_SITE_OUTPUT_LABEL}
    </span>
);

const OutputTypeBadge: React.FC<{ label: string }> = ({ label }) =>
    label === OWN_SITE_OUTPUT_LABEL ? <OwnSiteOutputBadge /> : <DirectionBadge direction={label as SupportDirection} />;

const AccordionChevron: React.FC<{ expanded: boolean; className?: string }> = ({ expanded, className = '' }) => (
    <FontAwesomeIcon
        icon={faChevronRight}
        className={`shrink-0 transition-transform duration-300 ${expanded ? 'rotate-90' : ''} ${className}`}
    />
);

const ResponsibleTeamChips: React.FC<{ teams: SupportTeamBadge[]; size?: 'sm' | 'lg' }> = ({ teams, size = 'sm' }) => {
    if (teams.length === 0) {
        return <span className="text-[11px] font-bold text-slate-400">미지정</span>;
    }

    const isLarge = size === 'lg';

    return (
        <span className={`inline-flex min-w-0 flex-wrap items-center ${isLarge ? 'gap-2' : 'gap-1.5'}`}>
            {teams.map((team) => {
                const color = normalizeHexColor(team.color);
                return (
                    <span
                        key={team.key}
                        className={`inline-flex max-w-full items-center rounded-full border font-black ${
                            isLarge ? 'gap-2 px-3 py-1.5 text-sm' : 'gap-1.5 px-2 py-1 text-[11px]'
                        }`}
                        style={{
                            borderColor: hexToRgba(color, 0.28),
                            backgroundColor: hexToRgba(color, 0.08),
                            color
                        }}
                        title={team.name}
                    >
                        <span
                            className={`flex shrink-0 items-center justify-center rounded-full text-white shadow-sm ${
                                isLarge ? 'h-6 w-6' : 'h-5 w-5'
                            }`}
                            style={{ backgroundColor: color }}
                        >
                            <FontAwesomeIcon icon={resolveIcon(team.icon, faUsers)} className={isLarge ? 'text-xs' : 'text-[10px]'} />
                        </span>
                        <span className="truncate">{team.name}</span>
                    </span>
                );
            })}
        </span>
    );
};

const SiteMetaBadge: React.FC<{ label: string; value: string; tone: 'violet' | 'sky' }> = ({ label, value, tone }) => {
    if (!value || value === '-') return null;

    const toneClass = tone === 'violet'
        ? 'border-violet-200 bg-violet-50 text-violet-700'
        : 'border-sky-200 bg-sky-50 text-sky-700';

    return (
        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black ${toneClass}`}>
            <span className="text-slate-400">{label}</span>
            <span>{value}</span>
        </span>
    );
};

const StatementActionButtons: React.FC<{
    target: SupportStatementTarget;
    onOpenLabor: (target: SupportStatementTarget) => void;
    onOpenExpense: (target: SupportStatementTarget) => void;
}> = ({ target, onOpenLabor, onOpenExpense }) => {
    const expenseAmount = getExpenseClaimsTotal(target.expenseClaims);

    return (
        <div className={`grid gap-1 ${expenseAmount > 0 ? 'grid-cols-2' : 'grid-cols-1'}`}>
            <button
                type="button"
                aria-label={`${target.title} 노임명세서`}
                title="노임명세서"
                onClick={(event) => {
                    event.stopPropagation();
                    onOpenLabor(target);
                }}
                className="inline-flex h-7 items-center justify-center gap-1 rounded bg-emerald-600 px-2 text-[10px] font-black text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            >
                <FontAwesomeIcon icon={faFileInvoiceDollar} />
                <span>노임명세</span>
            </button>
            {expenseAmount > 0 && (
                <button
                    type="button"
                    aria-label={`${target.title} 경비내역서`}
                    title="경비내역서"
                    onClick={(event) => {
                        event.stopPropagation();
                        onOpenExpense(target);
                    }}
                    className="inline-flex h-7 items-center justify-center gap-1 rounded bg-teal-600 px-2 text-[10px] font-black text-white shadow-sm transition hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-400"
                >
                    <FontAwesomeIcon icon={faReceipt} />
                    <span>경비내역</span>
                </button>
            )}
        </div>
    );
};

const SupportClientStatementModalShell: React.FC<{
    title: string;
    onClose: () => void;
    children: React.ReactNode;
}> = ({ title, onClose, children }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
        <div className="flex max-h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <h2 className="text-base font-black text-slate-900">{title}</h2>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="닫기"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                >
                    <FontAwesomeIcon icon={faXmark} />
                </button>
            </div>
            <div className="min-h-0 overflow-auto p-5">
                {children}
            </div>
        </div>
    </div>
);

const SupportClientLaborStatementModal: React.FC<{
    target: SupportStatementTarget;
    onClose: () => void;
}> = ({ target, onClose }) => {
    const sortedRows = useMemo(() => [...target.rows].sort((a, b) =>
        a.date.localeCompare(b.date) ||
        a.siteName.localeCompare(b.siteName, 'ko-KR') ||
        a.workerName.localeCompare(b.workerName, 'ko-KR')
    ), [target.rows]);
    const totalManDay = sortedRows.reduce((sum, row) => sum + row.manDay, 0);
    const totalAmount = sortedRows.reduce((sum, row) => sum + row.amount, 0);

    return (
        <SupportClientStatementModalShell title="노임명세서" onClose={onClose}>
            <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="text-[11px] font-black text-slate-500">대상</div>
                        <div className="mt-1 text-sm font-black text-slate-900">{target.title}</div>
                        {target.subtitle && <div className="mt-1 text-[11px] font-bold text-slate-500">{target.subtitle}</div>}
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="text-[11px] font-black text-slate-500">총공수</div>
                        <div className="mt-1 text-sm font-black text-slate-900">{formatManDay(totalManDay)}</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-emerald-50 p-4">
                        <div className="text-[11px] font-black text-emerald-700">노임합계</div>
                        <div className="mt-1 text-sm font-black text-emerald-800">{formatNumber(totalAmount)}원</div>
                    </div>
                </div>

                <div className="overflow-auto rounded-xl border border-slate-900 bg-white">
                    <table className="w-full min-w-[1120px] border-collapse text-xs">
                        <thead className="bg-slate-100 text-slate-700">
                        <tr>
                            <th className="border border-slate-900 px-3 py-2 text-left">일자</th>
                            <th className="border border-slate-900 px-3 py-2 text-left">현장</th>
                            <th className="border border-slate-900 px-3 py-2 text-left">구분</th>
                            <th className="border border-slate-900 px-3 py-2 text-left">결제</th>
                            <th className="border border-slate-900 px-3 py-2 text-left">작업자</th>
                            <th className="border border-slate-900 px-3 py-2 text-left">작업팀</th>
                            <th className="border border-slate-900 px-3 py-2 text-left">현장담당팀</th>
                            <th className="border border-slate-900 px-3 py-2 text-right">공수</th>
                            <th className="border border-slate-900 px-3 py-2 text-right">단가</th>
                            <th className="border border-slate-900 px-3 py-2 text-right">금액</th>
                        </tr>
                        </thead>
                        <tbody>
                        {sortedRows.map((row) => (
                            <tr key={`${row.rowId}:labor`}>
                                <td className="border border-slate-900 px-3 py-2 font-mono text-slate-500">{row.date}</td>
                                <td className="border border-slate-900 px-3 py-2 font-bold text-slate-700">{row.siteName}</td>
                                <td className="border border-slate-900 px-3 py-2">{row.siteType || '-'}</td>
                                <td className="border border-slate-900 px-3 py-2">{row.paymentType || '-'}</td>
                                <td className="border border-slate-900 px-3 py-2 font-black text-slate-900">{row.workerName}</td>
                                <td className="border border-slate-900 px-3 py-2 font-bold text-slate-600">{getSourceTeamDisplayName(row) || '-'}</td>
                                <td className="border border-slate-900 px-3 py-2 font-bold text-slate-600">{row.responsibleTeamName || '-'}</td>
                                <td className="border border-slate-900 px-3 py-2 text-right font-mono font-bold">{formatManDay(row.manDay)}</td>
                                <td className="border border-slate-900 px-3 py-2 text-right font-mono">{formatNumber(row.unitPrice)}</td>
                                <td className="border border-slate-900 px-3 py-2 text-right font-mono font-black">{formatNumber(row.amount)}</td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </SupportClientStatementModalShell>
    );
};

const SupportClientExpenseStatementModal: React.FC<{
    target: SupportStatementTarget;
    onClose: () => void;
}> = ({ target, onClose }) => {
    const sortedClaims = useMemo(() => sortExpenseClaims(target.expenseClaims), [target.expenseClaims]);
    const totalAmount = getExpenseClaimsTotal(sortedClaims);

    return (
        <SupportClientStatementModalShell title="경비내역서" onClose={onClose}>
            <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="text-[11px] font-black text-slate-500">대상</div>
                        <div className="mt-1 text-sm font-black text-slate-900">{target.title}</div>
                        {target.subtitle && <div className="mt-1 text-[11px] font-bold text-slate-500">{target.subtitle}</div>}
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="text-[11px] font-black text-slate-500">후청구 건수</div>
                        <div className="mt-1 text-sm font-black text-slate-900">{formatNumber(sortedClaims.length)}건</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-teal-50 p-4">
                        <div className="text-[11px] font-black text-teal-700">후청구 합계</div>
                        <div className="mt-1 text-sm font-black text-teal-800">{formatNumber(totalAmount)}원</div>
                    </div>
                </div>

                <div className="overflow-auto rounded-xl border border-slate-900 bg-white">
                    <table className="w-full min-w-[1120px] border-collapse text-xs">
                        <thead className="bg-slate-100 text-slate-700">
                        <tr>
                            <th className="border border-slate-900 px-3 py-2 text-left">일자</th>
                            <th className="border border-slate-900 px-3 py-2 text-left">현장</th>
                            <th className="border border-slate-900 px-3 py-2 text-left">사용팀</th>
                            <th className="border border-slate-900 px-3 py-2 text-left">청구대상</th>
                            <th className="border border-slate-900 px-3 py-2 text-left">구분</th>
                            <th className="border border-slate-900 px-3 py-2 text-left">내용</th>
                            <th className="border border-slate-900 px-3 py-2 text-left">상태</th>
                            <th className="border border-slate-900 px-3 py-2 text-right">금액</th>
                            <th className="border border-slate-900 px-3 py-2 text-left">메모</th>
                        </tr>
                        </thead>
                        <tbody>
                        {sortedClaims.length > 0 ? sortedClaims.map((claim) => (
                            <tr key={getExpenseClaimKey(claim)}>
                                <td className="border border-slate-900 px-3 py-2 font-mono text-slate-500">{claim.date}</td>
                                <td className="border border-slate-900 px-3 py-2 font-bold text-slate-700">{claim.siteName || '-'}</td>
                                <td className="border border-slate-900 px-3 py-2">{claim.payerTeamName || '-'}</td>
                                <td className="border border-slate-900 px-3 py-2">{claim.chargeToTeamName || '-'}</td>
                                <td className="border border-slate-900 px-3 py-2">{claim.category || '-'}</td>
                                <td className="border border-slate-900 px-3 py-2 font-bold text-slate-700">{claim.description || '-'}</td>
                                <td className="border border-slate-900 px-3 py-2">{getExpenseClaimStatusLabel(claim.status)}</td>
                                <td className="border border-slate-900 px-3 py-2 text-right font-mono font-black">{formatNumber(getExpenseClaimAmount(claim))}</td>
                                <td className="border border-slate-900 px-3 py-2 text-slate-500">{claim.memo || '-'}</td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan={9} className="border border-slate-900 px-3 py-10 text-center font-bold text-slate-400">
                                    등록된 후청구 경비내역이 없습니다.
                                </td>
                            </tr>
                        )}
                        </tbody>
                    </table>
                </div>
            </div>
        </SupportClientStatementModalShell>
    );
};

const SummaryCard: React.FC<{
    label: string;
    value: React.ReactNode;
    icon: any;
    tone: 'emerald' | 'sky' | 'orange' | 'violet';
}> = ({ label, value, icon, tone }) => {
    const toneMap = {
        emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-500', text: 'text-emerald-700' },
        sky: { bg: 'bg-sky-50', icon: 'text-sky-500', text: 'text-sky-700' },
        orange: { bg: 'bg-orange-50', icon: 'text-orange-500', text: 'text-orange-700' },
        violet: { bg: 'bg-violet-50', icon: 'text-violet-500', text: 'text-violet-700' }
    } as const;

    return (
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className={`mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl ${toneMap[tone].bg}`}>
                <FontAwesomeIcon icon={icon} className={`text-lg ${toneMap[tone].icon}`} />
            </div>
            <p className="text-[12px] font-black uppercase tracking-wider text-slate-400">{label}</p>
            <p className={`mt-1 text-2xl font-black ${toneMap[tone].text}`}>{value}</p>
        </div>
    );
};

const SupportClientSitePage: React.FC = () => {
    const navigate = useNavigate();
    const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentYearMonth());
    const [selectedDirection, setSelectedDirection] = useState<'all' | SupportDirection>('all');
    const [selectedClientKey, setSelectedClientKey] = useState<string>('');
    const [selectedSiteKey, setSelectedSiteKey] = useState<string>('');
    const [rows, setRows] = useState<SupportClientSiteWorkerRow[]>([]);
    const [expenseClaims, setExpenseClaims] = useState<TeamExpenseClaim[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [errors, setErrors] = useState<string[]>([]);
    const [laborStatementTarget, setLaborStatementTarget] = useState<SupportStatementTarget | null>(null);
    const [expenseStatementTarget, setExpenseStatementTarget] = useState<SupportStatementTarget | null>(null);
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
    const issuedAmounts = issuedAmountState.amounts;

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
            setExpenseClaims(teamExpenseClaims);
        } catch (error) {
            console.error('[SupportClientSitePage] support client-site data load failed:', error);
            setRows([]);
            setExpenseClaims([]);
            setErrors(['발주사별/현장별 지원 정산 데이터를 불러오지 못했습니다. 일보, 현장, 팀 데이터 권한을 확인해주세요.']);
        } finally {
            setLoading(false);
        }
    }, [selectedMonth]);

    useEffect(() => {
        void fetchData();
    }, [fetchData]);

    useEffect(() => {
        setIssuedAmountState({
            month: selectedMonth,
            amounts: loadIssuedAmounts(selectedMonth)
        });
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
        setExpandedResponsibleTeamKeys(new Set());
        setExpandedSiteKeys(new Set());
    }, [selectedMonth, selectedDirection, selectedClientKey, selectedSiteKey]);

    const directionFilteredRows = useMemo(() => (
        rows.filter((row) => selectedDirection === 'all' || row.direction === selectedDirection)
    ), [rows, selectedDirection]);

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

    useEffect(() => {
        const initiallyOpenClient = clientGroups.find((client) => isExternalClientSummary(client)) || clientGroups[0];
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
            clientCount: clientKeys.size,
            siteCount: siteKeys.size,
            workerCount: workerKeys.size
        };
    }, [filteredRows]);

    const issuedSummary = useMemo(() => {
        const sites = clientGroups.flatMap((client) => client.sites);
        const totalIssuedAmount = sites.reduce((sum, site) => sum + parseIssuedAmount(issuedAmounts[site.key]), 0);
        const totalManDay = sites.reduce((sum, site) => sum + site.totalManDay, 0);
        return {
            totalIssuedAmount,
            avgSsukkumi: totalIssuedAmount > 0 && totalManDay > 0 ? Math.round(totalIssuedAmount / totalManDay) : 0
        };
    }, [clientGroups, issuedAmounts]);

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

    const handleDownloadExcel = () => {
        const siteIssuedMetrics = new Map<string, { issuedAmount: number; ssukkumi: number }>();
        clientGroups.forEach((client) => {
            client.sites.forEach((site) => {
                const issuedAmount = parseIssuedAmount(issuedAmounts[site.key]);
                siteIssuedMetrics.set(site.key, {
                    issuedAmount,
                    ssukkumi: issuedAmount > 0 && site.totalManDay > 0 ? Math.round(issuedAmount / site.totalManDay) : 0
                });
            });
        });

        const summaryRows = clientGroups.flatMap((client) =>
            client.sites.map((site) => {
                const issuedMetric = siteIssuedMetrics.get(site.key) || { issuedAmount: 0, ssukkumi: 0 };
                return {
                    발주사: client.clientCompanyName,
                    현장: site.siteName,
                    주소: site.siteAddress || '',
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
                    금액: site.totalAmount,
                    후청구경비: getExpenseClaimsTotal(site.expenseClaims),
                    발행금액: issuedMetric.issuedAmount || '',
                    쓰꾸미: issuedMetric.ssukkumi || ''
                };
            })
        );

        const detailRows = filteredRows.map((row) => {
            const siteKey = `${clientKeyForRow(row)}::${siteKeyForRow(row)}`;
            const issuedMetric = siteIssuedMetrics.get(siteKey) || { issuedAmount: 0, ssukkumi: 0 };
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
                금액: row.amount,
                발행금액: issuedMetric.issuedAmount || '',
                쓰꾸미: issuedMetric.ssukkumi || '',
                근거: row.evidenceNote
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
        const issuedAmount = parseIssuedAmount(issuedAmountInputValue);
        const ssukkumi = issuedAmount > 0 && site.totalManDay > 0
            ? Math.round(issuedAmount / site.totalManDay)
            : 0;
        const sourceTeamDisplayNames = summarizeSourceTeamDisplayNames(site.rows);
        const siteTypeDisplay = summarizeNames(site.siteTypes);
        const paymentTypeDisplay = summarizeNames(site.paymentTypes);
        const siteStatementTarget: SupportStatementTarget = {
            title: site.siteName,
            subtitle: `${site.clientCompanyName} · 현장`,
            rows: site.rows,
            expenseClaims: getSiteExpenseClaims(site)
        };

        return (
            <React.Fragment key={site.key}>
                <tr
                    onClick={() => toggleSite(site.key)}
                    className="cursor-pointer bg-white transition-colors hover:bg-slate-50"
                >
                    <td className={`border border-slate-900 px-2 py-2 ${indentClass}`}>
                        <div className="flex min-w-0 items-start gap-2">
                            <AccordionChevron expanded={isSiteExpanded} className="mt-1 text-[11px] text-slate-500" />
                            <div className="min-w-0">
                                <div className="mb-1 flex flex-wrap items-center gap-1">
                                    {uniqueValues(site.rows.map((row) => getOutputTypeDisplayName(row))).map((label) => (
                                        <OutputTypeBadge key={label} label={label} />
                                    ))}
                                </div>
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
                                {site.siteAddress && (
                                    <div className="mt-1 truncate text-[11px] font-semibold text-slate-500">{site.siteAddress}</div>
                                )}
                            </div>
                        </div>
                    </td>
                    <td className="border border-slate-900 px-2 py-2 text-center font-mono">{formatNumber(site.activeDates.length)}</td>
                    <td className="border border-slate-900 px-2 py-2 text-center font-mono">{formatNumber(site.workerCount)}</td>
                    <td className="border border-slate-900 px-2 py-2 text-center font-mono font-black">{formatManDay(site.totalManDay)}</td>
                    <td className="border border-slate-900 px-2 py-2 text-right font-mono">{formatNumber(site.avgUnitPrice)}</td>
                    <td className="border border-slate-900 px-2 py-2 text-right font-mono font-black">{formatNumber(site.totalAmount)}</td>
                    <td className="border border-slate-900 px-1 py-1 text-right font-mono" onClick={(event) => event.stopPropagation()}>
                        <div className="flex items-center">
                            <input
                                type="text"
                                inputMode="numeric"
                                aria-label={`${site.siteName} 발행금액 입력`}
                                value={issuedAmountInputValue}
                                onChange={(event) => handleIssuedAmountChange(site.key, event.target.value)}
                                placeholder="0"
                                className="h-7 min-w-0 flex-1 bg-transparent px-1 text-right font-mono text-slate-900 outline-none transition focus:bg-amber-50 focus:ring-1 focus:ring-amber-400"
                            />
                            <span className="ml-1 text-[11px] font-black text-slate-500">원</span>
                        </div>
                    </td>
                    <td className="border border-slate-900 px-2 py-2 text-right font-mono font-black text-amber-800">{ssukkumi > 0 ? formatNumber(ssukkumi) : '-'}</td>
                    <td className="border border-slate-900 px-2 py-2">
                        <div className="space-y-1">
                            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                                <span className="text-[10px] font-black text-slate-500">담당</span>
                                <ResponsibleTeamChips teams={site.responsibleTeams} />
                            </div>
                            <div className="text-[11px] font-bold leading-4 text-slate-500">
                                작업팀 {sourceTeamDisplayNames === OWN_SITE_OUTPUT_LABEL ? (
                                    <span className="ml-1 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-emerald-700">
                                        {OWN_SITE_OUTPUT_LABEL}
                                    </span>
                                ) : sourceTeamDisplayNames}
                            </div>
                        </div>
                    </td>
                    <td className="border border-slate-900 px-1 py-1 text-center" onClick={(event) => event.stopPropagation()}>
                        <StatementActionButtons
                            target={siteStatementTarget}
                            onOpenLabor={setLaborStatementTarget}
                            onOpenExpense={setExpenseStatementTarget}
                        />
                    </td>
                </tr>

                {isSiteExpanded && (
                    <tr>
                        <td colSpan={10} className="border border-slate-900 bg-slate-50 p-4">
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
                                    {formatNumber(site.rows.length)}개 투입 행 · {formatManDay(site.totalManDay)}공수 · {formatNumber(site.totalAmount)}원
                                </p>
                            </div>
                            <div className="overflow-x-auto border border-slate-900 bg-white">
                                <table className="w-full min-w-[980px] border-collapse text-xs">
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
                                                {isOwnSiteOutputRow(row) ? (
                                                    <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-black text-emerald-700">
                                                        {OWN_SITE_OUTPUT_LABEL}
                                                    </span>
                                                ) : row.sourceTeamName || '-'}
                                            </td>
                                            <td className="border border-slate-900 px-4 py-2.5 font-bold text-slate-600">{row.responsibleTeamName || '-'}</td>
                                            <td className="border border-slate-900 px-4 py-2.5 font-bold text-slate-600">{row.settlementName || '-'}</td>
                                            <td className="border border-slate-900 px-4 py-2.5 text-right font-mono font-bold">{formatManDay(row.manDay)}</td>
                                            <td className="border border-slate-900 px-4 py-2.5 text-right font-mono text-slate-500">{formatNumber(row.unitPrice)}</td>
                                            <td className="border border-slate-900 px-4 py-2.5 text-right font-mono font-black text-slate-800">{formatNumber(row.amount)}</td>
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
        const isClientExpanded = expandedClientKeys.has(client.key);
        if (!isClientExpanded) return 1;

        const expandedSiteDetailCount = client.sites.filter((site) => expandedSiteKeys.has(site.key)).length;
        if (isExternalClientSummary(client)) {
            const responsibleTeamGroups = groupSitesByResponsibleTeam(client.sites);
            const expandedResponsibleTeamSiteRowCount = responsibleTeamGroups
                .filter((teamGroup) => expandedResponsibleTeamKeys.has(teamGroup.key))
                .reduce((sum, teamGroup) => sum + teamGroup.sites.length, 0);
            return 1 + responsibleTeamGroups.length + expandedResponsibleTeamSiteRowCount + expandedSiteDetailCount;
        }

        return 1 + client.sites.length + expandedSiteDetailCount;
    };

    const externalClientGroups = clientGroups.filter((client) => isExternalClientSummary(client));
    const standardClientGroups = clientGroups.filter((client) => !isExternalClientSummary(client));
    const orderedClientGroups = [...externalClientGroups, ...standardClientGroups];
    const standardClientGroupRowSpan = standardClientGroups.reduce((sum, client) => sum + getClientVisibleRowCount(client), 0);

    return (
        <div className="support-team-font w-full max-w-none space-y-6 p-6 font-['Pretendard']">
            <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4">
                    <div className="rounded-xl bg-emerald-100 p-3 text-emerald-600 shadow-inner">
                        <FontAwesomeIcon icon={faBuilding} size="lg" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black tracking-tight text-slate-800">발주사별 현장별 지원 정산</h1>
                        <p className="mt-0.5 flex items-center gap-2 text-[13px] font-bold text-slate-500">
                            <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-700">BETA</span>
                            지원팀 지급 관리 데이터를 발주사와 현장 단위로 재집계합니다.
                        </p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2.5">
                    <button
                        type="button"
                        onClick={() => navigate('/payroll/support-team')}
                        className="inline-flex items-center gap-2 rounded-xl border-2 border-slate-200 px-4 py-2.5 text-sm font-black text-slate-600 transition hover:bg-slate-50"
                    >
                        <FontAwesomeIcon icon={faArrowLeft} />
                        지원팀 지급 관리
                    </button>
                    <button
                        type="button"
                        onClick={handleDownloadExcel}
                        disabled={!hasRows}
                        className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <FontAwesomeIcon icon={faDownload} />
                        엑셀 다운로드
                    </button>
                </div>
            </div>

            <section className="grid gap-3 lg:grid-cols-3">
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-4">
                    <div className="text-[11px] font-black text-emerald-700">발주사 그룹</div>
                    <div className="mt-1 text-sm font-black text-slate-900">1단 발주사 기준</div>
                    <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">
                        같은 발주사에 속한 현장을 묶고, 그 아래 현장 단위로 상세를 연결합니다.
                    </p>
                </div>
                <div className="rounded-xl border border-sky-100 bg-sky-50/70 p-4">
                    <div className="text-[11px] font-black text-sky-700">현장 상세</div>
                    <div className="mt-1 text-sm font-black text-slate-900">현장별 투입자와 정산 주체</div>
                    <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">
                        행을 열면 일자, 작업자, 작업팀, 현장담당팀, 단가와 금액까지 내려봅니다.
                    </p>
                </div>
                <div className="rounded-xl border border-violet-100 bg-violet-50/70 p-4">
                    <div className="text-[11px] font-black text-violet-700">지원팀 방식</div>
                    <div className="mt-1 text-sm font-black text-slate-900">간곳/온곳 분류 유지</div>
                    <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">
                        기존 지원팀 지급 관리와 같은 내부/외부 지원 방향을 유지해 금액을 집계합니다.
                    </p>
                </div>
            </section>

            <div className="flex w-full flex-col gap-6 lg:flex-row">
                <aside className="w-full flex-none space-y-4 lg:w-72">
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

                <main className="min-w-0 flex-1 space-y-6">
                    <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:flex-row xl:items-center xl:justify-between">
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="flex items-center gap-3">
                                <FontAwesomeIcon icon={faCalendarAlt} className="text-emerald-500" />
                                <span className="text-sm font-bold text-slate-500">집계 기준월</span>
                                <input
                                    type="month"
                                    value={selectedMonth}
                                    onChange={(event) => setSelectedMonth(event.target.value)}
                                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-black outline-none transition focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>
                            <div className="hidden h-6 w-px bg-slate-200 sm:block" />
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                                <FontAwesomeIcon icon={loading ? faSpinner : faCircleCheck} spin={loading} />
                                {loading ? '집계 중' : `${formatNumber(rows.length)}건 로드`}
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            <select
                                value={selectedDirection}
                                onChange={(event) => setSelectedDirection(event.target.value as 'all' | SupportDirection)}
                                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-black outline-none focus:ring-2 focus:ring-emerald-500"
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

                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                        <SummaryCard label="총 투입 공수" value={`${formatManDay(totalSummary.totalManDay)} 공수`} icon={faCalendarAlt} tone="violet" />
                        <SummaryCard label="총 정산 금액" value={`${formatNumber(totalSummary.totalAmount)} 원`} icon={faCircleCheck} tone="emerald" />
                        <SummaryCard label="총 발행금액" value={`${formatNumber(issuedSummary.totalIssuedAmount)} 원`} icon={faDownload} tone="sky" />
                        <SummaryCard label="평균 쓰꾸미" value={issuedSummary.avgSsukkumi > 0 ? `${formatNumber(issuedSummary.avgSsukkumi)} 원` : '-'} icon={faCircleCheck} tone="orange" />
                        <SummaryCard label="발주사 / 현장" value={`${formatNumber(totalSummary.clientCount)} / ${formatNumber(totalSummary.siteCount)}`} icon={faBuilding} tone="sky" />
                        <SummaryCard label="투입 인원" value={`${formatNumber(totalSummary.workerCount)} 명`} icon={faUsers} tone="orange" />
                    </div>

                    <div className="overflow-hidden border border-slate-900 bg-white shadow-sm">
                        <div className="flex flex-col gap-2 border-b border-slate-900 bg-white px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                            <h2 className="text-base font-black text-slate-900">
                                {selectedClientKey
                                    ? clientOptions.find((client) => client.key === selectedClientKey)?.clientCompanyName || '선택 발주사'
                                    : '전체 발주사'} 현장별 지원 요약
                            </h2>
                            <span className="text-[11px] font-bold text-slate-500">외부지원간곳은 담당팀 기준, 발주사별현장은 2단 발주사 · 3단 현장 · 4단 작업자 상세로 표시합니다.</span>
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
                                <table className="w-full min-w-[1460px] border-collapse text-[13px]">
                                    <thead>
                                        <tr className="text-center font-black text-slate-950">
                                            <th className="w-14 border border-slate-900 bg-gradient-to-br from-yellow-100 via-yellow-400 to-white p-2"></th>
                                            <th className="w-64 border border-slate-900 bg-gradient-to-br from-white via-slate-200 to-slate-500 p-2 tracking-[0.2em]">발주사 / 담당팀 / 현장</th>
                                            <th className="w-24 border border-slate-900 bg-gradient-to-br from-white via-slate-200 to-slate-500 p-2 tracking-[0.2em]">현장/일수</th>
                                            <th className="w-20 border border-slate-900 bg-gradient-to-br from-white via-slate-200 to-slate-500 p-2 tracking-[0.35em]">인원</th>
                                            <th className="w-20 border border-slate-900 bg-gradient-to-br from-white via-slate-200 to-slate-500 p-2 tracking-[0.35em]">공수</th>
                                            <th className="w-28 border border-slate-900 bg-gradient-to-br from-white via-slate-200 to-slate-500 p-2 tracking-[0.2em]">평균단가</th>
                                            <th className="w-32 border border-slate-900 bg-gradient-to-br from-white via-slate-200 to-slate-500 p-2 tracking-[0.2em]">정산금액</th>
                                            <th className="w-32 border border-slate-900 bg-gradient-to-br from-white via-slate-200 to-slate-500 p-2 tracking-[0.2em]">발행금액</th>
                                            <th className="w-28 border border-slate-900 bg-gradient-to-br from-white via-slate-200 to-slate-500 p-2 tracking-[0.35em]">쓰꾸미</th>
                                            <th className="w-72 border border-slate-900 bg-gradient-to-br from-white via-slate-200 to-slate-500 p-2 tracking-[0.2em]">팀 정보</th>
                                            <th className="w-36 border border-slate-900 bg-gradient-to-br from-white via-slate-200 to-slate-500 p-2 tracking-[0.35em]">기타</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                {orderedClientGroups.map((client) => {
                                    const isClientExpanded = expandedClientKeys.has(client.key);
                                    const isExternalClient = isExternalClientSummary(client);
                                    const isFirstStandardClient = !isExternalClient && standardClientGroups[0]?.key === client.key;
                                    const responsibleTeamGroups = isExternalClient ? groupSitesByResponsibleTeam(client.sites) : [];
                                    const clientIssuedAmount = client.sites.reduce(
                                        (sum, site) => sum + parseIssuedAmount(issuedAmounts[site.key]),
                                        0
                                    );
                                    const clientSsukkumi = clientIssuedAmount > 0 && client.totalManDay > 0
                                        ? Math.round(clientIssuedAmount / client.totalManDay)
                                        : 0;
                                    const clientAverageUnitPrice = client.totalManDay > 0
                                        ? Math.round(client.totalAmount / client.totalManDay)
                                        : 0;
                                    const clientRowSpan = getClientVisibleRowCount(client);
                                    const firstLevelRowSpan = isExternalClient ? clientRowSpan : standardClientGroupRowSpan;
                                    const firstLevelLabel = isExternalClient ? EXTERNAL_CLIENT_GROUP_DISPLAY_NAME : '발주사별현장';
                                    const clientDisplayName = isExternalClient ? '외부 현장 전체' : client.clientCompanyName;
                                    const clientStatementTarget: SupportStatementTarget = {
                                        title: clientDisplayName,
                                        subtitle: isExternalClient ? EXTERNAL_CLIENT_GROUP_DISPLAY_NAME : '발주사별현장',
                                        rows: client.sites.flatMap((site) => site.rows),
                                        expenseClaims: getSitesExpenseClaims(client.sites)
                                    };
                                    return (
                                        <React.Fragment key={client.key}>
                                            <tr
                                                onClick={() => toggleClient(client.key)}
                                                className="cursor-pointer bg-white transition-colors hover:bg-emerald-50"
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
                                                <td className="border border-slate-900 px-2 py-2 font-black text-slate-950">
                                                    <span className="inline-flex min-w-0 items-center gap-2">
                                                        <AccordionChevron expanded={isClientExpanded} className="text-[11px] text-emerald-700" />
                                                        {!isExternalClient && (
                                                            <span className="shrink-0 rounded bg-emerald-700 px-1.5 py-0.5 text-[10px] font-black text-white">2단</span>
                                                        )}
                                                        <span className="truncate">{clientDisplayName}</span>
                                                    </span>
                                                </td>
                                                <td className="border border-slate-900 px-2 py-2 text-center font-mono font-black">{formatNumber(client.siteCount)}</td>
                                                <td className="border border-slate-900 px-2 py-2 text-center font-mono">{formatNumber(client.workerCount)}</td>
                                                <td className="border border-slate-900 px-2 py-2 text-center font-mono font-black">{formatManDay(client.totalManDay)}</td>
                                                <td className="border border-slate-900 px-2 py-2 text-right font-mono">{clientAverageUnitPrice > 0 ? formatNumber(clientAverageUnitPrice) : '-'}</td>
                                                <td className="border border-slate-900 px-2 py-2 text-right font-mono font-black text-slate-950">{formatNumber(client.totalAmount)}</td>
                                                <td className="border border-slate-900 px-2 py-2 text-right font-mono text-sky-700">{clientIssuedAmount > 0 ? formatNumber(clientIssuedAmount) : '-'}</td>
                                                <td className="border border-slate-900 px-2 py-2 text-right font-mono font-black text-amber-800">{clientSsukkumi > 0 ? formatNumber(clientSsukkumi) : '-'}</td>
                                                <td className="border border-slate-900 px-2 py-2">
                                                    <div className="flex flex-wrap items-center gap-1.5">
                                                        {uniqueValues(client.sites.flatMap((site) => site.rows.map((row) => getOutputTypeDisplayName(row)))).map((label) => (
                                                            <OutputTypeBadge key={label} label={label} />
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="border border-slate-900 px-1 py-1 text-center" onClick={(event) => event.stopPropagation()}>
                                                    <StatementActionButtons
                                                        target={clientStatementTarget}
                                                        onOpenLabor={setLaborStatementTarget}
                                                        onOpenExpense={setExpenseStatementTarget}
                                                    />
                                                </td>
                                            </tr>

                                            {isClientExpanded && (
                                                <>
                                                    {isExternalClient ? (
                                                        responsibleTeamGroups.map((teamGroup) => {
                                                            const isTeamExpanded = expandedResponsibleTeamKeys.has(teamGroup.key);
                                                            const teamIssuedAmount = teamGroup.sites.reduce(
                                                                (sum, site) => sum + parseIssuedAmount(issuedAmounts[site.key]),
                                                                0
                                                            );
                                                            const teamSsukkumi = teamIssuedAmount > 0 && teamGroup.totalManDay > 0
                                                                ? Math.round(teamIssuedAmount / teamGroup.totalManDay)
                                                                : 0;
                                                            const teamStatementTarget: SupportStatementTarget = {
                                                                title: teamGroup.team.name,
                                                                subtitle: `${EXTERNAL_CLIENT_GROUP_DISPLAY_NAME} · 현장담당팀`,
                                                                rows: teamGroup.rows,
                                                                expenseClaims: getSitesExpenseClaims(teamGroup.sites)
                                                            };

                                                            return (
                                                                <React.Fragment key={teamGroup.key}>
                                                                    <tr
                                                                        onClick={() => toggleResponsibleTeam(teamGroup.key)}
                                                                        className="cursor-pointer bg-emerald-50 transition-colors hover:bg-emerald-100"
                                                                    >
                                                                        <td className="border border-slate-900 px-2 py-2 pl-4 font-black text-slate-900">
                                                                            <div className="flex min-w-0 items-center gap-2.5">
                                                                                <AccordionChevron expanded={isTeamExpanded} className="text-sm text-emerald-700" />
                                                                                <span className="shrink-0 rounded bg-emerald-700 px-2 py-1 text-[12px] font-black text-white">2단</span>
                                                                                <ResponsibleTeamChips teams={[teamGroup.team]} size="lg" />
                                                                            </div>
                                                                        </td>
                                                                        <td className="border border-slate-900 px-2 py-2 text-center font-mono font-black">{formatNumber(teamGroup.siteCount)}</td>
                                                                        <td className="border border-slate-900 px-2 py-2 text-center font-mono">{formatNumber(teamGroup.workerCount)}</td>
                                                                        <td className="border border-slate-900 px-2 py-2 text-center font-mono font-black">{formatManDay(teamGroup.totalManDay)}</td>
                                                                        <td className="border border-slate-900 px-2 py-2 text-right font-mono">{teamGroup.avgUnitPrice > 0 ? formatNumber(teamGroup.avgUnitPrice) : '-'}</td>
                                                                        <td className="border border-slate-900 px-2 py-2 text-right font-mono font-black">{formatNumber(teamGroup.totalAmount)}</td>
                                                                        <td className="border border-slate-900 px-2 py-2 text-right font-mono text-sky-700">{teamIssuedAmount > 0 ? formatNumber(teamIssuedAmount) : '-'}</td>
                                                                        <td className="border border-slate-900 px-2 py-2 text-right font-mono font-black text-amber-800">{teamSsukkumi > 0 ? formatNumber(teamSsukkumi) : '-'}</td>
                                                                        <td className="border border-slate-900 px-2 py-2">
                                                                            <div className="flex flex-wrap items-center gap-1.5">
                                                                                {uniqueValues(teamGroup.rows.map((row) => getOutputTypeDisplayName(row))).map((label) => (
                                                                                    <OutputTypeBadge key={label} label={label} />
                                                                                ))}
                                                                            </div>
                                                                            <div className="mt-1 text-[11px] font-bold text-slate-500">
                                                                                3단 현장 {formatNumber(teamGroup.siteCount)}개
                                                                            </div>
                                                                        </td>
                                                                        <td className="border border-slate-900 px-1 py-1 text-center" onClick={(event) => event.stopPropagation()}>
                                                                            <StatementActionButtons
                                                                                target={teamStatementTarget}
                                                                                onOpenLabor={setLaborStatementTarget}
                                                                                onOpenExpense={setExpenseStatementTarget}
                                                                            />
                                                                        </td>
                                                                    </tr>
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
            {laborStatementTarget && (
                <SupportClientLaborStatementModal
                    target={laborStatementTarget}
                    onClose={() => setLaborStatementTarget(null)}
                />
            )}
            {expenseStatementTarget && (
                <SupportClientExpenseStatementModal
                    target={expenseStatementTarget}
                    onClose={() => setExpenseStatementTarget(null)}
                />
            )}
        </div>
    );
};

export default SupportClientSitePage;
