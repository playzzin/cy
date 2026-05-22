import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faArrowLeft,
    faBuilding,
    faCalendarAlt,
    faCaretDown,
    faCaretRight,
    faCircleCheck,
    faDownload,
    faMapLocationDot,
    faSearch,
    faSpinner,
    faTriangleExclamation,
    faUsers,
} from '@fortawesome/free-solid-svg-icons';
import * as XLSX from 'xlsx-js-style';
import { Team, teamService } from '../../services/teamService';
import { Company, companyService } from '../../services/companyService';
import { Site, siteService } from '../../services/siteService';
import { dailyReportService, DailyReport, DailyReportWorker } from '../../services/dailyReportService';
import { SupportRate, supportRateService } from '../../services/supportRateService';

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
    clientCompanyId: string;
    clientCompanyName: string;
    constructorCompanyId: string;
    constructorCompanyName: string;
    sourceTeamId: string;
    sourceTeamName: string;
    responsibleTeamId: string;
    responsibleTeamName: string;
    settlementName: string;
    counterpartyName: string;
    evidenceNote: string;
}

interface SupportSiteSummary {
    key: string;
    siteId: string;
    siteName: string;
    siteAddress?: string;
    clientCompanyId: string;
    clientCompanyName: string;
    constructorCompanyId: string;
    constructorCompanyName: string;
    responsibleTeamNames: string[];
    sourceTeamNames: string[];
    settlementNames: string[];
    directions: SupportDirection[];
    activeDates: string[];
    workerCount: number;
    totalManDay: number;
    totalAmount: number;
    avgUnitPrice: number;
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
    supportRates: SupportRate[]
): SupportClientSiteWorkerRow[] => {
    const teamById = new Map<string, Team>();
    const teamByName = new Map<string, Team>();
    teams.forEach((team) => {
        if (team.id) teamById.set(String(team.id), team);
        const nameKey = normalizeName(team.name);
        if (nameKey && !teamByName.has(nameKey)) teamByName.set(nameKey, team);
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

    const normalizeClientCompany = (companyId?: string | null, companyName?: string | null): { id: string; name: string } => {
        const rawId = String(companyId ?? '').trim();
        const rawName = String(companyName ?? '').trim();
        const companyByIdValue = rawId ? companyById.get(rawId) : undefined;
        const companyByNameValue = findCompanyByName(rawName);
        const resolvedId = String(companyByIdValue?.id || companyByNameValue?.id || rawId || '').trim();
        const resolvedName = String(companyByIdValue?.name || companyByNameValue?.name || rawName || '발주사 미지정').trim();
        const isTeamName = Boolean(findTeam('', resolvedName) || /팀$/.test(resolvedName));

        if (resolvedName === EXTERNAL_CLIENT_GROUP_NAME) {
            return {
                id: EXTERNAL_CLIENT_GROUP_ID,
                name: EXTERNAL_CLIENT_GROUP_NAME
            };
        }

        if (isTeamName && !companyByIdValue && !companyByNameValue) {
            return {
                id: EXTERNAL_CLIENT_GROUP_ID,
                name: EXTERNAL_CLIENT_GROUP_NAME
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
        const targetCompanyId = String(targetTeam?.companyId || constructorCompanyId || report.companyId || '').trim();
        const targetCompanyName = String(targetTeam?.companyName || constructorCompanyName || report.companyName || '').trim();
        const targetIsMyCompany = isMyCompany(targetCompanyId, targetCompanyName);

        const reportWorkers = Array.isArray(report.workers) ? report.workers : [];
        reportWorkers.forEach((reportWorker: DailyReportWorker, workerIndex) => {
            const normalizedSalary = normalizeSalaryModel(reportWorker.salaryModel || reportWorker.payType);
            const isSupportModel = normalizedSalary === '지원팀';
            const reportWorkerTeamId = String(reportWorker.teamId || '').trim();
            const reportWorkerTeamName = String(reportWorker.workerTeamName || '').trim();
            const fallbackTeamId = reportWorkerTeamName ? '' : String(report.teamId || '').trim();
            const sourceTeam = findTeam(reportWorkerTeamId || fallbackTeamId, reportWorkerTeamName || report.teamName);
            const sourceTeamId = String(sourceTeam?.id || reportWorkerTeamId || fallbackTeamId || normalizeName(reportWorkerTeamName) || '').trim();
            const sourceTeamName = String(sourceTeam?.name || reportWorkerTeamName || report.teamName || '작업팀 미지정').trim();
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
            const workerId = String(reportWorker.workerId || `${report.id || 'report'}-${workerIndex}`).trim();
            const workerName = String(reportWorker.name || '이름 미상').trim();

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
                    clientCompanyId,
                    clientCompanyName,
                    constructorCompanyId,
                    constructorCompanyName,
                    sourceTeamId,
                    sourceTeamName,
                    responsibleTeamId,
                    responsibleTeamName,
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
                clientCompanyId: row.clientCompanyId,
                clientCompanyName: getClientCompanyName(row),
                constructorCompanyId: row.constructorCompanyId,
                constructorCompanyName: row.constructorCompanyName,
                responsibleTeamNames: [],
                sourceTeamNames: [],
                settlementNames: [],
                directions: [],
                activeDates: [],
                workerCount: 0,
                totalManDay: 0,
                totalAmount: 0,
                avgUnitPrice: 0,
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
                        responsibleTeamNames: uniqueValues(sortedRows.map((row) => row.responsibleTeamName)),
                        sourceTeamNames: uniqueValues(sortedRows.map((row) => row.sourceTeamName)),
                        settlementNames: uniqueValues(sortedRows.map((row) => row.settlementName)),
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
    const [loading, setLoading] = useState<boolean>(false);
    const [errors, setErrors] = useState<string[]>([]);
    const [expandedClientKeys, setExpandedClientKeys] = useState<Set<string>>(new Set());
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
            const [reports, teams, companies, sites, supportRates] = await Promise.all([
                dailyReportService.getReportsByRange(start, end),
                teamService.getTeams(),
                companyService.getCompanies(),
                siteService.getSites(),
                supportRateService.getAllSiteRates().catch((error) => {
                    console.error('[SupportClientSitePage] support rate load failed:', error);
                    return [] as SupportRate[];
                })
            ]);

            setRows(buildSupportRows(reports, teams, companies, sites, supportRates));
        } catch (error) {
            console.error('[SupportClientSitePage] support client-site data load failed:', error);
            setRows([]);
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

    const clientGroups = useMemo(() => groupRowsByClientAndSite(filteredRows), [filteredRows]);

    useEffect(() => {
        setExpandedClientKeys(new Set(clientGroups.map((client) => client.key)));
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
            const next = new Set(prev);
            if (next.has(siteKey)) next.delete(siteKey);
            else next.add(siteKey);
            return next;
        });
    };

    const toggleClient = (clientKey: string) => {
        setExpandedClientKeys((prev) => {
            const next = new Set(prev);
            if (next.has(clientKey)) next.delete(clientKey);
            else next.add(clientKey);
            return next;
        });
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
                    시공사: site.constructorCompanyName || '',
                    지원구분: site.directions.join(', '),
                    현장담당팀: summarizeNames(site.responsibleTeamNames),
                    작업팀: summarizeNames(site.sourceTeamNames),
                    정산주체: summarizeNames(site.settlementNames),
                    투입일수: site.activeDates.length,
                    인원수: site.workerCount,
                    공수: Number(site.totalManDay.toFixed(1)),
                    평균단가: site.avgUnitPrice,
                    금액: site.totalAmount,
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
                지원구분: row.direction,
                작업자: row.workerName,
                직종: row.role || '',
                작업팀: row.sourceTeamName,
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

                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                        <div className="flex flex-col gap-2 border-b border-slate-100 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                            <h2 className="text-base font-black text-slate-900">
                                {selectedClientKey
                                    ? clientOptions.find((client) => client.key === selectedClientKey)?.clientCompanyName || '선택 발주사'
                                    : '전체 발주사'} 현장별 지원 요약
                            </h2>
                            <span className="text-[11px] font-bold text-slate-500">1단 발주사를 열고, 2단 현장을 다시 열면 3단 작업자 상세가 표시됩니다.</span>
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
                            <div className="space-y-3 bg-slate-50/60 p-4">
                                {clientGroups.map((client) => {
                                    const isClientExpanded = expandedClientKeys.has(client.key);
                                    const clientIssuedAmount = client.sites.reduce(
                                        (sum, site) => sum + parseIssuedAmount(issuedAmounts[site.key]),
                                        0
                                    );
                                    const clientSsukkumi = clientIssuedAmount > 0 && client.totalManDay > 0
                                        ? Math.round(clientIssuedAmount / client.totalManDay)
                                        : 0;
                                    return (
                                        <section key={client.key} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                                            <button
                                                type="button"
                                                onClick={() => toggleClient(client.key)}
                                                className="flex w-full flex-col gap-3 px-5 py-4 text-left transition hover:bg-emerald-50/50 md:flex-row md:items-center md:justify-between"
                                            >
                                                <div className="flex min-w-0 items-start gap-3">
                                                    <div className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                                                        <FontAwesomeIcon icon={isClientExpanded ? faCaretDown : faCaretRight} />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="mb-1 inline-flex rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-black text-white">
                                                            1단 발주사
                                                        </div>
                                                        <h3 className="truncate text-lg font-black text-slate-900">{client.clientCompanyName}</h3>
                                                        <p className="mt-1 text-xs font-bold text-slate-500">
                                                            {formatNumber(client.siteCount)}개 현장 · {formatNumber(client.workerCount)}명 · {formatManDay(client.totalManDay)}공수
                                                            {clientIssuedAmount > 0 && (
                                                                <> · 발행 {formatNumber(clientIssuedAmount)}원 · 쓰꾸미 {formatNumber(clientSsukkumi)}원</>
                                                            )}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2 text-right sm:grid-cols-3 xl:min-w-[640px] xl:grid-cols-5">
                                                    <div className="rounded-lg bg-slate-50 px-3 py-2">
                                                        <div className="text-[10px] font-black text-slate-400">현장</div>
                                                        <div className="font-mono text-sm font-black text-slate-900">{formatNumber(client.siteCount)}</div>
                                                    </div>
                                                    <div className="rounded-lg bg-violet-50 px-3 py-2">
                                                        <div className="text-[10px] font-black text-violet-500">공수</div>
                                                        <div className="font-mono text-sm font-black text-violet-800">{formatManDay(client.totalManDay)}</div>
                                                    </div>
                                                    <div className="rounded-lg bg-emerald-50 px-3 py-2">
                                                        <div className="text-[10px] font-black text-emerald-500">정산</div>
                                                        <div className="font-mono text-sm font-black text-emerald-800">{formatNumber(client.totalAmount)}</div>
                                                    </div>
                                                    <div className="rounded-lg bg-sky-50 px-3 py-2">
                                                        <div className="text-[10px] font-black text-sky-500">발행합계</div>
                                                        <div className="font-mono text-sm font-black text-sky-800">{formatNumber(clientIssuedAmount)}</div>
                                                    </div>
                                                    <div className="rounded-lg bg-amber-50 px-3 py-2">
                                                        <div className="text-[10px] font-black text-amber-600">쓰꾸미</div>
                                                        <div className="font-mono text-sm font-black text-amber-900">
                                                            {clientSsukkumi > 0 ? formatNumber(clientSsukkumi) : '-'}
                                                        </div>
                                                    </div>
                                                </div>
                                            </button>

                                            {isClientExpanded && (
                                                <div className="border-t border-emerald-100 bg-emerald-50/30 p-3">
                                                    <div className="mb-2 flex items-center gap-2 px-2 text-[11px] font-black text-slate-500">
                                                        <span className="h-px w-6 bg-emerald-300" />
                                                        2단 현장
                                                    </div>
                                                    <div className="space-y-2">
                                                        {client.sites.map((site) => {
                                                            const isSiteExpanded = expandedSiteKeys.has(site.key);
                                                            const issuedAmountInputValue = issuedAmounts[site.key] || '';
                                                            const issuedAmount = parseIssuedAmount(issuedAmountInputValue);
                                                            const ssukkumi = issuedAmount > 0 && site.totalManDay > 0
                                                                ? Math.round(issuedAmount / site.totalManDay)
                                                                : 0;
                                                            return (
                                                                <div key={site.key} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => toggleSite(site.key)}
                                                                        className="flex w-full flex-col gap-3 px-4 py-3 text-left transition hover:bg-slate-50 xl:flex-row xl:items-center xl:justify-between"
                                                                    >
                                                                        <div className="flex min-w-0 items-start gap-3">
                                                                            <div className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                                                                                <FontAwesomeIcon icon={isSiteExpanded ? faCaretDown : faCaretRight} />
                                                                            </div>
                                                                            <div className="min-w-0">
                                                                                <div className="mb-1 flex flex-wrap items-center gap-1.5">
                                                                                    {site.directions.map((direction) => (
                                                                                        <DirectionBadge key={direction} direction={direction} />
                                                                                    ))}
                                                                                </div>
                                                                                <h4 className="flex min-w-0 items-center gap-2 text-sm font-black text-slate-900">
                                                                                    <FontAwesomeIcon icon={faMapLocationDot} className="text-slate-400" />
                                                                                    <span className="truncate">{site.siteName}</span>
                                                                                </h4>
                                                                                {site.siteAddress && (
                                                                                    <p className="mt-1 truncate text-[11px] font-semibold text-slate-400">{site.siteAddress}</p>
                                                                                )}
                                                                                <p className="mt-1 text-[11px] font-bold text-slate-500">
                                                                                    현장담당팀 {summarizeNames(site.responsibleTeamNames)} · 작업팀 {summarizeNames(site.sourceTeamNames)}
                                                                                </p>
                                                                            </div>
                                                                        </div>
                                                                        <div className="grid grid-cols-5 gap-2 text-right xl:min-w-[520px]">
                                                                            <div className="rounded-lg bg-slate-50 px-2 py-2">
                                                                                <div className="text-[10px] font-black text-slate-400">일수</div>
                                                                                <div className="font-mono text-sm font-black text-slate-800">{formatNumber(site.activeDates.length)}</div>
                                                                            </div>
                                                                            <div className="rounded-lg bg-slate-50 px-2 py-2">
                                                                                <div className="text-[10px] font-black text-slate-400">인원</div>
                                                                                <div className="font-mono text-sm font-black text-slate-800">{formatNumber(site.workerCount)}</div>
                                                                            </div>
                                                                            <div className="rounded-lg bg-violet-50 px-2 py-2">
                                                                                <div className="text-[10px] font-black text-violet-500">공수</div>
                                                                                <div className="font-mono text-sm font-black text-violet-800">{formatManDay(site.totalManDay)}</div>
                                                                            </div>
                                                                            <div className="rounded-lg bg-slate-50 px-2 py-2">
                                                                                <div className="text-[10px] font-black text-slate-400">평균단가</div>
                                                                                <div className="font-mono text-sm font-black text-slate-800">{formatNumber(site.avgUnitPrice)}</div>
                                                                            </div>
                                                                            <div className="rounded-lg bg-emerald-50 px-2 py-2">
                                                                                <div className="text-[10px] font-black text-emerald-500">금액</div>
                                                                                <div className="font-mono text-sm font-black text-emerald-800">{formatNumber(site.totalAmount)}</div>
                                                                            </div>
                                                                        </div>
                                                                    </button>

                                                                    <div className="grid gap-3 border-t border-slate-100 bg-white px-4 py-3 md:grid-cols-[minmax(220px,1fr)_minmax(130px,auto)_minmax(150px,auto)] md:items-end">
                                                                        <label className="block">
                                                                            <span className="mb-1 block text-[11px] font-black text-slate-500">발행금액 입력</span>
                                                                            <div className="flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 focus-within:ring-2 focus-within:ring-emerald-500">
                                                                                <input
                                                                                    type="text"
                                                                                    inputMode="numeric"
                                                                                    value={issuedAmountInputValue}
                                                                                    onChange={(event) => handleIssuedAmountChange(site.key, event.target.value)}
                                                                                    placeholder="0"
                                                                                    className="min-w-0 flex-1 bg-transparent text-right font-mono text-sm font-black text-slate-900 outline-none"
                                                                                />
                                                                                <span className="ml-2 text-xs font-black text-slate-400">원</span>
                                                                            </div>
                                                                        </label>
                                                                        <div className="rounded-lg bg-violet-50 px-3 py-2 text-right">
                                                                            <div className="text-[10px] font-black text-violet-500">공수</div>
                                                                            <div className="font-mono text-sm font-black text-violet-800">{formatManDay(site.totalManDay)}</div>
                                                                        </div>
                                                                        <div className="rounded-lg bg-amber-50 px-3 py-2 text-right">
                                                                            <div className="text-[10px] font-black text-amber-600">발행금액 / 공수 = 쓰꾸미</div>
                                                                            <div className="font-mono text-sm font-black text-amber-900">
                                                                                {ssukkumi > 0 ? `${formatNumber(ssukkumi)} 원` : '-'}
                                                                            </div>
                                                                            {issuedAmount > 0 && (
                                                                                <div className="mt-0.5 text-[10px] font-bold text-amber-700">
                                                                                    발행금액 {formatNumber(issuedAmount)}원
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>

                                                                    {isSiteExpanded && (
                                                                        <div className="border-t border-slate-100 bg-slate-50 p-4">
                                                                            <div className="mb-3">
                                                                                <h3 className="text-sm font-black text-slate-800">{site.siteName} 작업자 상세</h3>
                                                                                <p className="mt-1 text-[11px] font-semibold text-slate-500">
                                                                                    {formatNumber(site.rows.length)}개 투입 행 · {formatManDay(site.totalManDay)}공수 · {formatNumber(site.totalAmount)}원
                                                                                </p>
                                                                            </div>
                                                                            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                                                                                <table className="w-full min-w-[980px] text-xs">
                                                                                    <thead className="border-b border-slate-100 bg-slate-50 text-slate-500">
                                                                                        <tr>
                                                                                            <th className="px-4 py-2.5 text-left">일자</th>
                                                                                            <th className="px-4 py-2.5 text-left">구분</th>
                                                                                            <th className="px-4 py-2.5 text-left">작업자</th>
                                                                                            <th className="px-4 py-2.5 text-left">작업팀</th>
                                                                                            <th className="px-4 py-2.5 text-left">현장담당팀</th>
                                                                                            <th className="px-4 py-2.5 text-left">정산주체</th>
                                                                                            <th className="px-4 py-2.5 text-right">공수</th>
                                                                                            <th className="px-4 py-2.5 text-right">단가</th>
                                                                                            <th className="px-4 py-2.5 text-right">금액</th>
                                                                                            <th className="px-4 py-2.5 text-left">근거</th>
                                                                                        </tr>
                                                                                    </thead>
                                                                                    <tbody>
                                                                                        {site.rows.map((row) => (
                                                                                            <tr key={row.rowId} className="border-b border-slate-50 last:border-0">
                                                                                                <td className="px-4 py-2.5 font-mono text-slate-500">{row.date}</td>
                                                                                                <td className="px-4 py-2.5"><DirectionBadge direction={row.direction} /></td>
                                                                                                <td className="px-4 py-2.5 font-black text-slate-800">{row.workerName}</td>
                                                                                                <td className="px-4 py-2.5 font-bold text-slate-600">{row.sourceTeamName || '-'}</td>
                                                                                                <td className="px-4 py-2.5 font-bold text-slate-600">{row.responsibleTeamName || '-'}</td>
                                                                                                <td className="px-4 py-2.5 font-bold text-slate-600">{row.settlementName || '-'}</td>
                                                                                                <td className="px-4 py-2.5 text-right font-mono font-bold">{formatManDay(row.manDay)}</td>
                                                                                                <td className="px-4 py-2.5 text-right font-mono text-slate-500">{formatNumber(row.unitPrice)}</td>
                                                                                                <td className="px-4 py-2.5 text-right font-mono font-black text-slate-800">{formatNumber(row.amount)}</td>
                                                                                                <td className="px-4 py-2.5 text-slate-500">{row.evidenceNote}</td>
                                                                                            </tr>
                                                                                        ))}
                                                                                    </tbody>
                                                                                </table>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </section>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
};

export default SupportClientSitePage;
