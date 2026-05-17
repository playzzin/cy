import React, { useEffect, useMemo, useState } from 'react';
import {
    Banknote,
    BriefcaseBusiness,
    Building2,
    CalendarDays,
    ChevronDown,
    ClipboardList,
    Download,
    FileText,
    MapPin,
    Printer,
    RefreshCw,
    Search,
    ShieldCheck,
    Users,
} from 'lucide-react';

import { dailyReportService, DailyReportWorkerRow } from '../../services/dailyReportService';
import { manpowerService, Worker } from '../../services/manpowerService';
import { siteService, Site } from '../../services/siteService';
import { teamService, Team } from '../../services/teamService';
import {
    useWorkerAccessScope,
    workerAccessMatchesReportRow,
    workerAccessMatchesTeamRef,
} from '../../hooks/useWorkerAccessScope';
import { resolveReportPayType } from '../../utils/payType';
import { toast } from '../../utils/swal';
import './TeamWorkerDetailPage.css';
import './SiteResponsibleDetailPage.css';

type SiteStatusFilter = 'all' | 'active' | 'completed' | 'planned';
type DetailView = 'siteInfo' | 'payslip' | 'dailyReport';

interface ResponsibleGroup {
    key: string;
    name: string;
    color: string;
    siteCount: number;
    totalManDay: number;
    totalAmount: number;
}

interface LaborStatementRow {
    key: string;
    index: number;
    workerId: string;
    workerName: string;
    workerSsn: string;
    workerPhone: string;
    workerAddress: string;
    bankName: string;
    bankOwner: string;
    bankAccount: string;
    teamName: string;
    days: number[];
    totalManDay: number;
    unitPrice: number;
    amount: number;
}

interface SiteListStats {
    totalManDay: number;
    totalAmount: number;
    rowCount: number;
}

const EMPTY_TEXT = '-';
const DEFAULT_COLOR = '#2563eb';
const EMPTY_SITE_LIST_STATS: SiteListStats = {
    totalManDay: 0,
    totalAmount: 0,
    rowCount: 0,
};

const getCurrentMonth = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const getMonthRange = (month: string) => {
    const [yearText, monthText] = month.split('-');
    const year = Number(yearText);
    const monthNumber = Number(monthText);
    if (!year || !monthNumber) {
        return getMonthRange(getCurrentMonth());
    }

    const lastDay = new Date(year, monthNumber, 0).getDate();
    return {
        startDate: `${yearText}-${monthText}-01`,
        endDate: `${yearText}-${monthText}-${String(lastDay).padStart(2, '0')}`,
    };
};

const getMonthLastDay = (month: string) => {
    const [yearText, monthText] = month.split('-');
    const year = Number(yearText);
    const monthNumber = Number(monthText);
    if (!year || !monthNumber) return 31;
    return new Date(year, monthNumber, 0).getDate();
};

const extractDayOfMonth = (dateValue?: string | null) => {
    const match = String(dateValue ?? '').match(/^\d{4}-\d{2}-(\d{2})/);
    if (!match) return null;
    const day = Number(match[1]);
    return Number.isFinite(day) ? day : null;
};

const normalizeText = (value?: string | number | null) =>
    String(value ?? '').replace(/\s+/g, '').trim().toLowerCase();

const isCheongyeonCompanyName = (value?: string | number | null) => {
    const normalized = normalizeText(value);
    return normalized.includes('청연이엔지') || normalized.includes('청연eng') || normalized.includes('청연');
};

const buildTeamTokens = (team?: Team | null) =>
    new Set([team?.id, team?.legacyId, team?.name].map(value => String(value ?? '').trim()).filter(Boolean));

const workerMatchesTeam = (worker: Worker, team?: Team | null) => {
    if (!team) return true;
    const tokens = buildTeamTokens(team);
    const teamId = String(worker.teamId ?? '').trim();
    const teamName = String(worker.teamName ?? '').trim();
    const workerId = String(worker.id ?? '').trim();

    if (teamId && tokens.has(teamId)) return true;
    if (teamName && tokens.has(teamName)) return true;
    if (workerId && Array.isArray(team.memberIds) && team.memberIds.includes(workerId)) return true;
    return false;
};

const isCheongyeonTeam = (team: Team, workers: Worker[]) => {
    if (isCheongyeonCompanyName(team.companyName)) return true;
    return workers.some(worker => workerMatchesTeam(worker, team) && isCheongyeonCompanyName(worker.companyName));
};

const asText = (value?: string | number | null) => {
    const text = String(value ?? '').trim();
    return text.length > 0 ? text : EMPTY_TEXT;
};

const asNumber = (value?: number | null) => {
    const numeric = Number(value ?? 0);
    return Number.isFinite(numeric) ? numeric : 0;
};

const formatCurrency = (value?: number | null) =>
    `${Math.round(asNumber(value)).toLocaleString('ko-KR')}원`;

const formatNumber = (value?: number | null) =>
    Math.round(asNumber(value)).toLocaleString('ko-KR');

const formatManDay = (value?: number | null) => {
    const numeric = asNumber(value);
    return Number.isInteger(numeric) ? numeric.toFixed(0) : numeric.toFixed(1);
};

const getReportRowAmount = (row: Pick<DailyReportWorkerRow, 'amount' | 'manDay' | 'unitPrice'>) => {
    const calculatedAmount = asNumber(row.manDay) * asNumber(row.unitPrice);
    return calculatedAmount > 0 ? calculatedAmount : asNumber(row.amount);
};

const getResponsibleName = (id?: string | null, name?: string | null, teamByKey?: Map<string, Team>) => {
    const cleanName = String(name ?? '').trim();
    if (cleanName) return cleanName;
    const cleanId = String(id ?? '').trim();
    if (cleanId) return teamByKey?.get(cleanId)?.name || cleanId;
    return '미지정';
};

const makeResponsibleKey = (id?: string | null, name?: string | null) => {
    const cleanId = String(id ?? '').trim();
    if (cleanId) return `id:${cleanId}`;
    const cleanName = String(name ?? '').trim();
    if (cleanName) return `name:${normalizeText(cleanName)}`;
    return 'unassigned';
};

const makeSiteKey = (siteId?: string | null, siteName?: string | null) => {
    const cleanId = String(siteId ?? '').trim();
    if (cleanId) return `id:${cleanId}`;
    const cleanName = String(siteName ?? '').trim();
    if (cleanName) return `name:${normalizeText(cleanName)}`;
    return '';
};

const getSitePrimaryKey = (site: Site) =>
    makeSiteKey(site.id || site.legacyId, site.name);

const getTeamColor = (teamByKey: Map<string, Team>, id?: string | null, name?: string | null, fallback?: string | null) => {
    const keys = [id, name].map(value => String(value ?? '').trim()).filter(Boolean);
    for (const key of keys) {
        const color = String((teamByKey.get(key) ?? teamByKey.get(normalizeText(key)))?.color ?? '').trim();
        if (color) return color;
    }
    return String(fallback ?? '').trim() || DEFAULT_COLOR;
};

const isCheongyeonResponsible = (id: string | null | undefined, name: string | null | undefined, teamByKey: Map<string, Team>) =>
    [id, name]
        .map(value => String(value ?? '').trim())
        .filter(Boolean)
        .some(value => Boolean(teamByKey.get(value) ?? teamByKey.get(normalizeText(value))));

const rowResponsibleKey = (row: DailyReportWorkerRow) =>
    makeResponsibleKey(row.responsibleTeamId ?? row.teamId, row.responsibleTeamName ?? row.teamName);

const siteResponsibleKey = (site: Site) =>
    makeResponsibleKey(site.responsibleTeamId, site.responsibleTeamName);

const rowMatchesSite = (row: DailyReportWorkerRow, site: Site | null) => {
    if (!site) return false;
    const rowSiteId = String(row.siteId ?? '').trim();
    const siteIds = [site.id, site.legacyId].map(value => String(value ?? '').trim()).filter(Boolean);
    if (rowSiteId && siteIds.includes(rowSiteId)) return true;
    return normalizeText(row.siteName) === normalizeText(site.name);
};

const statusLabel = (site: Site) => {
    const normalized = normalizeText(site.status);
    if (normalized === 'completed' || normalized === 'closed' || normalized === '마감') return '완료';
    if (normalized === 'planned' || normalized === '예정') return '예정';
    return '진행중';
};

const siteStatusMatches = (site: Site, filter: SiteStatusFilter) => {
    if (filter === 'all') return true;
    const normalized = normalizeText(site.status);
    if (filter === 'active') return normalized === 'active' || normalized === '진행중' || !normalized;
    if (filter === 'completed') return normalized === 'completed' || normalized === 'closed' || normalized === '마감';
    return normalized === 'planned' || normalized === '예정';
};

const DetailField: React.FC<{ label: string; value?: React.ReactNode; wide?: boolean }> = ({ label, value, wide }) => (
    <div className={wide ? 'tw-detail-field tw-detail-field--wide' : 'tw-detail-field'}>
        <span>{label}</span>
        <strong>{value ?? EMPTY_TEXT}</strong>
    </div>
);

const downloadCsv = (filename: string, rows: Array<Record<string, string | number>>) => {
    if (rows.length === 0) {
        toast.warning('내보낼 출력일보가 없습니다.');
        return;
    }

    const headers = Object.keys(rows[0]);
    const escape = (value: string | number) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const csv = [
        headers.map(escape).join(','),
        ...rows.map(row => headers.map(header => escape(row[header])).join(',')),
    ].join('\n');

    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

const SiteResponsibleDetailPage: React.FC = () => {
    const [sites, setSites] = useState<Site[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [outputRows, setOutputRows] = useState<DailyReportWorkerRow[]>([]);
    const [selectedResponsibleKey, setSelectedResponsibleKey] = useState('');
    const [selectedSiteKey, setSelectedSiteKey] = useState('');
    const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
    const [statusFilter, setStatusFilter] = useState<SiteStatusFilter>('active');
    const [searchQuery, setSearchQuery] = useState('');
    const [detailView, setDetailView] = useState<DetailView>('siteInfo');
    const [isResponsiblePickerOpen, setIsResponsiblePickerOpen] = useState(false);
    const [loadingMaster, setLoadingMaster] = useState(true);
    const [loadingOutput, setLoadingOutput] = useState(false);

    const { startDate, endDate } = useMemo(() => getMonthRange(selectedMonth), [selectedMonth]);
    const accessScope = useWorkerAccessScope(workers, teams);

    useEffect(() => {
        let mounted = true;

        const loadMaster = async () => {
            setLoadingMaster(true);
            try {
                const [nextSites, nextTeams, nextWorkers] = await Promise.all([
                    siteService.getSites(),
                    teamService.getTeams(),
                    manpowerService.getWorkers(),
                ]);
                if (!mounted) return;
                const cheongyeonTeams = nextTeams
                    .filter(team => isCheongyeonTeam(team, nextWorkers))
                    .sort((left, right) =>
                        String(left.name ?? '').localeCompare(String(right.name ?? ''), 'ko-KR')
                    );
                setSites(nextSites);
                setTeams(cheongyeonTeams);
                setWorkers(nextWorkers);
            } catch (error) {
                console.error(error);
                toast.error('현장/담당 데이터를 불러오지 못했습니다.');
            } finally {
                if (mounted) setLoadingMaster(false);
            }
        };

        loadMaster();
        return () => {
            mounted = false;
        };
    }, []);

    useEffect(() => {
        let mounted = true;

        const loadOutputRows = async () => {
            setLoadingOutput(true);
            try {
                const rows = await dailyReportService.getWorkerRows({ startDate, endDate });
                if (mounted) setOutputRows(rows);
            } catch (error) {
                console.error(error);
                toast.error('출력일보 데이터를 불러오지 못했습니다.');
                if (mounted) setOutputRows([]);
            } finally {
                if (mounted) setLoadingOutput(false);
            }
        };

        loadOutputRows();
        return () => {
            mounted = false;
        };
    }, [startDate, endDate]);

    const teamByKey = useMemo(() => {
        const map = new Map<string, Team>();
        teams.forEach(team => {
            [team.id, team.legacyId, team.name]
                .map(value => String(value ?? '').trim())
                .filter(Boolean)
                .forEach(key => {
                    map.set(key, team);
                    map.set(normalizeText(key), team);
                });
        });
        return map;
    }, [teams]);

    const siteByKey = useMemo(() => {
        const map = new Map<string, Site>();
        sites.forEach(site => {
            [site.id, site.legacyId]
                .map(value => String(value ?? '').trim())
                .filter(Boolean)
                .forEach(id => map.set(`id:${id}`, site));
            const nameKey = normalizeText(site.name);
            if (nameKey) map.set(`name:${nameKey}`, site);
        });
        return map;
    }, [sites]);

    const workerById = useMemo(() => {
        const map = new Map<string, Worker>();
        workers.forEach(worker => {
            [worker.id, worker.legacyId]
                .map(value => String(value ?? '').trim())
                .filter(Boolean)
                .forEach(id => map.set(id, worker));
        });
        return map;
    }, [workers]);

    const workerByName = useMemo(() => {
        const map = new Map<string, Worker>();
        workers.forEach(worker => {
            const name = normalizeText(worker.name);
            if (name) map.set(name, worker);
        });
        return map;
    }, [workers]);

    const scopedOutputRows = useMemo(
        () => outputRows.filter(row => workerAccessMatchesReportRow(accessScope, row)),
        [accessScope, outputRows]
    );

    const scopedOutputSiteKeys = useMemo(
        () => new Set(scopedOutputRows.map(row => makeSiteKey(row.siteId, row.siteName)).filter(Boolean)),
        [scopedOutputRows]
    );

    const visibleSites = useMemo(() => {
        if (accessScope.loading) return [];
        if (accessScope.mode === 'all') return sites;

        if (accessScope.mode === 'team') {
            return sites.filter(site =>
                workerAccessMatchesTeamRef(accessScope, site.responsibleTeamId, site.responsibleTeamName) ||
                scopedOutputSiteKeys.has(getSitePrimaryKey(site))
            );
        }

        return sites.filter(site => scopedOutputSiteKeys.has(getSitePrimaryKey(site)));
    }, [accessScope, scopedOutputSiteKeys, sites]);

    const responsibleGroups = useMemo<ResponsibleGroup[]>(() => {
        const groupMap = new Map<string, {
            key: string;
            name: string;
            color: string;
            siteKeys: Set<string>;
            totalManDay: number;
            totalAmount: number;
        }>();

        const ensureGroup = (key: string, name: string, color: string) => {
            const current = groupMap.get(key);
            if (current) {
                if (!current.color || current.color === DEFAULT_COLOR) current.color = color;
                return current;
            }
            const next = {
                key,
                name,
                color,
                siteKeys: new Set<string>(),
                totalManDay: 0,
                totalAmount: 0,
            };
            groupMap.set(key, next);
            return next;
        };

        visibleSites.forEach(site => {
            if (!isCheongyeonResponsible(site.responsibleTeamId, site.responsibleTeamName, teamByKey)) return;
            const key = siteResponsibleKey(site);
            const name = getResponsibleName(site.responsibleTeamId, site.responsibleTeamName, teamByKey);
            const color = getTeamColor(teamByKey, site.responsibleTeamId, site.responsibleTeamName, site.color);
            const group = ensureGroup(key, name, color);
            const siteKey = getSitePrimaryKey(site);
            if (siteKey) group.siteKeys.add(siteKey);
        });

        scopedOutputRows.forEach(row => {
            if (!isCheongyeonResponsible(row.responsibleTeamId ?? row.teamId, row.responsibleTeamName ?? row.teamName, teamByKey)) return;
            const key = rowResponsibleKey(row);
            const name = getResponsibleName(row.responsibleTeamId ?? row.teamId, row.responsibleTeamName ?? row.teamName, teamByKey);
            const color = getTeamColor(teamByKey, row.responsibleTeamId ?? row.teamId, row.responsibleTeamName ?? row.teamName);
            const group = ensureGroup(key, name, color);
            const siteKey = makeSiteKey(row.siteId, row.siteName);
            if (siteKey) group.siteKeys.add(siteKey);
            group.totalManDay += asNumber(row.manDay);
            group.totalAmount += getReportRowAmount(row);
        });

        return Array.from(groupMap.values())
            .map(group => ({
                key: group.key,
                name: group.name,
                color: group.color,
                siteCount: group.siteKeys.size,
                totalManDay: group.totalManDay,
                totalAmount: group.totalAmount,
            }))
            .sort((left, right) => {
                const leftUnassigned = left.key === 'unassigned';
                const rightUnassigned = right.key === 'unassigned';
                if (leftUnassigned !== rightUnassigned) return leftUnassigned ? 1 : -1;
                return left.name.localeCompare(right.name, 'ko-KR');
            });
    }, [scopedOutputRows, teamByKey, visibleSites]);

    useEffect(() => {
        if (responsibleGroups.length === 0) {
            setSelectedResponsibleKey('');
            return;
        }

        setSelectedResponsibleKey(current =>
            responsibleGroups.some(group => group.key === current)
                ? current
                : responsibleGroups[0].key
        );
    }, [responsibleGroups]);

    const selectedResponsible = useMemo(
        () => responsibleGroups.find(group => group.key === selectedResponsibleKey) ?? null,
        [responsibleGroups, selectedResponsibleKey]
    );

    const selectedResponsibleRows = useMemo(
        () => scopedOutputRows.filter(row => rowResponsibleKey(row) === selectedResponsibleKey),
        [scopedOutputRows, selectedResponsibleKey]
    );

    const selectedResponsibleSiteKeys = useMemo(
        () => new Set(selectedResponsibleRows.map(row => makeSiteKey(row.siteId, row.siteName)).filter(Boolean)),
        [selectedResponsibleRows]
    );

    const selectedResponsibleAllSites = useMemo(() => {
        if (!selectedResponsibleKey) return [];

        return visibleSites
            .filter(site => (
                siteResponsibleKey(site) === selectedResponsibleKey
                || selectedResponsibleSiteKeys.has(getSitePrimaryKey(site))
            ))
            .sort((left, right) => String(left.name ?? '').localeCompare(String(right.name ?? ''), 'ko-KR'));
    }, [selectedResponsibleKey, selectedResponsibleSiteKeys, visibleSites]);

    const selectedResponsibleStatusCounts = useMemo(() => ({
        all: selectedResponsibleAllSites.length,
        active: selectedResponsibleAllSites.filter(site => siteStatusMatches(site, 'active')).length,
        planned: selectedResponsibleAllSites.filter(site => siteStatusMatches(site, 'planned')).length,
        completed: selectedResponsibleAllSites.filter(site => siteStatusMatches(site, 'completed')).length,
    }), [selectedResponsibleAllSites]);

    const selectedResponsibleSites = useMemo(() => {
        const query = normalizeText(searchQuery);

        return selectedResponsibleAllSites
            .filter(site => siteStatusMatches(site, statusFilter))
            .filter(site => {
                if (!query) return true;
                return normalizeText([
                    site.name,
                    site.code,
                    site.address,
                    site.responsibleTeamName,
                    site.companyName,
                    site.clientCompanyName,
                    site.constructorCompanyName,
                ].join(' ')).includes(query);
            });
    }, [searchQuery, selectedResponsibleAllSites, statusFilter]);

    useEffect(() => {
        if (selectedResponsibleSites.length === 0) {
            setSelectedSiteKey('');
            return;
        }

        setSelectedSiteKey(current =>
            selectedResponsibleSites.some(site => getSitePrimaryKey(site) === current)
                ? current
                : getSitePrimaryKey(selectedResponsibleSites[0])
        );
    }, [selectedResponsibleSites]);

    const selectedSite = useMemo(
        () => siteByKey.get(selectedSiteKey) ?? null,
        [selectedSiteKey, siteByKey]
    );

    const selectedSiteRows = useMemo(() => (
        selectedSite
            ? scopedOutputRows
                .filter(row => rowMatchesSite(row, selectedSite))
                .sort((left, right) => String(right.date ?? '').localeCompare(String(left.date ?? '')))
            : []
    ), [scopedOutputRows, selectedSite]);

    const selectedSiteStatsByKey = useMemo(() => {
        const map = new Map<string, SiteListStats>();
        const ensureStats = (key: string) => {
            const current = map.get(key);
            if (current) return current;
            const next: SiteListStats = { totalManDay: 0, totalAmount: 0, rowCount: 0 };
            map.set(key, next);
            return next;
        };

        selectedResponsibleSites.forEach(site => {
            const key = getSitePrimaryKey(site);
            if (key) ensureStats(key);
        });

        selectedResponsibleRows.forEach(row => {
            const rowSiteKey = makeSiteKey(row.siteId, row.siteName);
            const site = siteByKey.get(rowSiteKey) ?? siteByKey.get(makeSiteKey(null, row.siteName));
            const key = site ? getSitePrimaryKey(site) : rowSiteKey;
            if (!key) return;

            const stats = ensureStats(key);
            stats.rowCount += 1;
            stats.totalManDay += asNumber(row.manDay);
            stats.totalAmount += getReportRowAmount(row);
        });

        return map;
    }, [selectedResponsibleRows, selectedResponsibleSites, siteByKey]);

    const selectedResponsibleStats = useMemo(() => {
        const totalManDay = selectedResponsibleRows.reduce((sum, row) => sum + asNumber(row.manDay), 0);
        const totalAmount = selectedResponsibleRows.reduce((sum, row) => sum + getReportRowAmount(row), 0);
        const workerCount = new Set(selectedResponsibleRows.map(row => String(row.workerId || row.workerName || '').trim()).filter(Boolean)).size;
        return {
            siteCount: selectedResponsibleSites.length,
            totalManDay,
            totalAmount,
            workerCount,
        };
    }, [selectedResponsibleRows, selectedResponsibleSites.length]);

    const selectedSiteStats = useMemo(() => {
        const totalManDay = selectedSiteRows.reduce((sum, row) => sum + asNumber(row.manDay), 0);
        const totalAmount = selectedSiteRows.reduce((sum, row) => sum + getReportRowAmount(row), 0);
        const workerCount = new Set(selectedSiteRows.map(row => String(row.workerId || row.workerName || '').trim()).filter(Boolean)).size;
        const workDays = new Set(selectedSiteRows.map(row => row.date).filter(Boolean)).size;
        const latestDate = selectedSiteRows[0]?.date || '';
        return {
            totalManDay,
            totalAmount,
            workerCount,
            workDays,
            latestDate,
        };
    }, [selectedSiteRows]);

    const statementLastDay = useMemo(() => getMonthLastDay(selectedMonth), [selectedMonth]);
    const primaryDayNumbers = useMemo(
        () => Array.from({ length: Math.min(15, statementLastDay) }, (_, index) => index + 1),
        [statementLastDay]
    );
    const secondaryDayNumbers = useMemo(
        () => Array.from({ length: Math.max(statementLastDay - 15, 0) }, (_, index) => index + 16),
        [statementLastDay]
    );

    const laborStatementRows = useMemo<LaborStatementRow[]>(() => {
        const map = new Map<string, LaborStatementRow>();

        selectedSiteRows.forEach(row => {
            const key = String(row.workerId || row.workerName || '').trim() || `${row.workerName}-${row.date}`;
            const workerMaster = workerById.get(String(row.workerId ?? '').trim()) ?? workerByName.get(normalizeText(row.workerName));
            const day = extractDayOfMonth(row.date);
            const current = map.get(key) ?? {
                key,
                index: 0,
                workerId: String(row.workerId ?? ''),
                workerName: row.workerName || row.name || workerMaster?.name || EMPTY_TEXT,
                workerSsn: workerMaster?.idNumber || '',
                workerPhone: workerMaster?.contact || '',
                workerAddress: workerMaster?.address || '',
                bankName: workerMaster?.bankName || '',
                bankOwner: workerMaster?.accountHolder || workerMaster?.name || row.workerName || '',
                bankAccount: workerMaster?.accountNumber || '',
                teamName: row.workerTeamName || workerMaster?.teamName || '',
                days: Array.from({ length: 31 }, () => 0),
                totalManDay: 0,
                unitPrice: 0,
                amount: 0,
            };

            const manDay = asNumber(row.manDay);
            const amount = getReportRowAmount(row);
            current.totalManDay += manDay;
            current.amount += amount;
            if (day && day >= 1 && day <= 31) {
                current.days[day - 1] += manDay;
            }
            if (manDay > 0 && amount > 0) {
                current.unitPrice = Math.round(current.amount / current.totalManDay);
            } else if (!current.unitPrice) {
                current.unitPrice = asNumber(row.unitPrice);
            }
            if (row.workerTeamName) current.teamName = row.workerTeamName;
            map.set(key, current);
        });

        return Array.from(map.values())
            .sort((left, right) => left.workerName.localeCompare(right.workerName, 'ko-KR'))
            .map((row, index) => ({ ...row, index: index + 1 }));
    }, [selectedSiteRows, workerById, workerByName]);

    const laborStatementSummary = useMemo(() => {
        const dailyTotals = Array.from({ length: statementLastDay }, (_, index) => (
            laborStatementRows.reduce((sum, row) => sum + asNumber(row.days[index]), 0)
        ));
        return {
            dailyTotals,
            totalManDay: laborStatementRows.reduce((sum, row) => sum + row.totalManDay, 0),
            totalAmount: laborStatementRows.reduce((sum, row) => sum + row.amount, 0),
        };
    }, [laborStatementRows, statementLastDay]);

    const siteDisplayColor = selectedSite
        ? getTeamColor(teamByKey, selectedSite.responsibleTeamId, selectedSite.responsibleTeamName, selectedSite.color)
        : selectedResponsible?.color || DEFAULT_COLOR;
    const selectedSiteCompanyName = selectedSite
        ? asText(selectedSite.companyName || selectedSite.constructorCompanyName || selectedSite.clientCompanyName || '청연')
        : '청연';

    const handleResponsibleSelect = (key: string) => {
        setSelectedResponsibleKey(key);
        setIsResponsiblePickerOpen(false);
    };

    const handleRefresh = async () => {
        setLoadingMaster(true);
        setLoadingOutput(true);
        try {
            const [nextSites, nextTeams, nextWorkers, rows] = await Promise.all([
                siteService.getSites(),
                teamService.getTeams(),
                manpowerService.getWorkers(true),
                dailyReportService.getWorkerRows({ startDate, endDate }),
            ]);
            const cheongyeonTeams = nextTeams
                .filter(team => isCheongyeonTeam(team, nextWorkers))
                .sort((left, right) =>
                    String(left.name ?? '').localeCompare(String(right.name ?? ''), 'ko-KR')
                );
            setSites(nextSites);
            setTeams(cheongyeonTeams);
            setWorkers(nextWorkers);
            setOutputRows(rows);
            toast.success('최신 현장 데이터로 새로고침했습니다.');
        } catch (error) {
            console.error(error);
            toast.error('새로고침 중 오류가 발생했습니다.');
        } finally {
            setLoadingMaster(false);
            setLoadingOutput(false);
        }
    };

    const handleCsvDownload = () => {
        const suffix = selectedSite?.name || selectedResponsible?.name || '현장';
        downloadCsv(`현장_출력일보_${suffix}_${selectedMonth}.csv`, selectedSiteRows.map(row => ({
            날짜: row.date,
            현장명: row.siteName || '',
            현장소속팀: getResponsibleName(row.responsibleTeamId ?? row.teamId, row.responsibleTeamName ?? row.teamName, teamByKey),
            성명: row.workerName || '',
            소속팀: row.workerTeamName || '',
            급여방식: resolveReportPayType(row) || '',
            공수: row.manDay,
            단가: row.unitPrice || 0,
            금액: getReportRowAmount(row),
        })));
    };

    const renderResponsibleItem = (group: ResponsibleGroup) => (
        <button
            key={group.key}
            type="button"
            className={group.key === selectedResponsibleKey ? 'tw-team-item tw-team-item--active' : 'tw-team-item'}
            onClick={() => handleResponsibleSelect(group.key)}
        >
            <span className="tw-team-item__color" style={{ background: group.color }} />
            <span className="tw-team-item__body">
                <strong>{group.name}</strong>
                <small>{group.siteCount.toLocaleString('ko-KR')}개 현장</small>
            </span>
            <span className="tw-team-item__meta">
                <strong>{formatManDay(group.totalManDay)}</strong>
                <small>{formatCurrency(group.totalAmount)}</small>
            </span>
        </button>
    );

    return (
        <div className="tw-page sr-page">
            <header className="tw-page__header">
                <div>
                    <div className="tw-page__eyebrow">
                        <Building2 size={16} />
                        월별 현장담당 현장 조회
                    </div>
                    <h1>현장별 노임명세서 · 출력일보</h1>
                </div>

                <div className="tw-header-actions">
                    <button type="button" className="tw-icon-button" onClick={handleCsvDownload} title="CSV 내보내기">
                        <Download size={18} />
                        <span>CSV</span>
                    </button>
                    <button type="button" className="tw-icon-button" onClick={() => window.print()} title="인쇄">
                        <Printer size={18} />
                        <span>인쇄</span>
                    </button>
                    <button type="button" className="tw-primary-button" onClick={handleRefresh} disabled={loadingMaster || loadingOutput || accessScope.loading}>
                        <RefreshCw size={18} className={loadingMaster || loadingOutput || accessScope.loading ? 'tw-spin' : ''} />
                        새로고침
                    </button>
                </div>
            </header>

            <section className="tw-toolbar">
                <label className="tw-control">
                    <span>조회월</span>
                    <input
                        type="month"
                        value={selectedMonth}
                        onChange={(event) => setSelectedMonth(event.target.value)}
                    />
                </label>

                <label className="tw-control tw-control--search">
                    <span>현장 검색</span>
                    <div className="tw-search">
                        <Search size={18} />
                        <input
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            placeholder="현장명, 주소, 담당, 업체"
                        />
                    </div>
                </label>

                <label className="tw-control">
                    <span>현장 상태</span>
                    <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as SiteStatusFilter)}>
                        <option value="active">진행중 ({selectedResponsibleStatusCounts.active})</option>
                        <option value="planned">예정 ({selectedResponsibleStatusCounts.planned})</option>
                        <option value="completed">완료 ({selectedResponsibleStatusCounts.completed})</option>
                        <option value="all">전체 ({selectedResponsibleStatusCounts.all})</option>
                    </select>
                </label>
            </section>

            <div className="sr-filter-summary" aria-live="polite">
                <span>전체 {selectedResponsibleStatusCounts.all.toLocaleString('ko-KR')}개</span>
                <span>진행 {selectedResponsibleStatusCounts.active.toLocaleString('ko-KR')}개</span>
                <span>예정 {selectedResponsibleStatusCounts.planned.toLocaleString('ko-KR')}개</span>
                <span>완료 {selectedResponsibleStatusCounts.completed.toLocaleString('ko-KR')}개</span>
                <strong>현재 표시 {selectedResponsibleSites.length.toLocaleString('ko-KR')}개</strong>
            </div>

            <section className="tw-kpi-grid" aria-label="현장담당 요약">
                <div className="tw-kpi">
                    <Building2 size={20} />
                    <span>현장</span>
                    <strong>{selectedResponsibleStats.siteCount.toLocaleString('ko-KR')}</strong>
                </div>
                <div className="tw-kpi">
                    <CalendarDays size={20} />
                    <span>{selectedMonth} 공수</span>
                    <strong>{formatManDay(selectedResponsibleStats.totalManDay)}</strong>
                </div>
                <div className="tw-kpi">
                    <Banknote size={20} />
                    <span>노무비</span>
                    <strong>{formatCurrency(selectedResponsibleStats.totalAmount)}</strong>
                </div>
                <div className="tw-kpi">
                    <Users size={20} />
                    <span>작업자</span>
                    <strong>{selectedResponsibleStats.workerCount.toLocaleString('ko-KR')}</strong>
                </div>
            </section>

            <main className="tw-workspace">
                <section className="tw-worker-panel">
                    <div className="tw-panel-heading">
                        <div>
                            <span>현장담당 / 현장</span>
                            <strong>{selectedResponsibleSites.length.toLocaleString('ko-KR')}개</strong>
                        </div>
                        <small>{selectedResponsible?.name || '청연이엔지 소속팀 선택'}</small>
                    </div>

                    <div className="tw-worker-list">
                        <div className={isResponsiblePickerOpen ? 'tw-merged-team-list tw-merged-team-list--open' : 'tw-merged-team-list'} aria-label="청연이엔지 현장담당 선택">
                            <button
                                type="button"
                                className="tw-team-picker-button"
                                onClick={() => setIsResponsiblePickerOpen(prev => !prev)}
                                aria-expanded={isResponsiblePickerOpen}
                                disabled={loadingMaster || accessScope.loading || responsibleGroups.length === 0}
                            >
                                <span className="tw-team-item__color" style={{ background: selectedResponsible?.color || DEFAULT_COLOR }} />
                                <span className="tw-team-picker-button__body">
                                    <small>청연이엔지 현장담당 선택</small>
                                    <strong>{selectedResponsible?.name || '소속팀 선택'}</strong>
                                </span>
                                <span className="tw-team-picker-button__meta">
                                    {selectedResponsibleStats.siteCount}개
                                </span>
                                <ChevronDown size={18} className={isResponsiblePickerOpen ? 'tw-team-picker-button__chevron tw-team-picker-button__chevron--open' : 'tw-team-picker-button__chevron'} />
                            </button>
                            {loadingMaster || accessScope.loading ? (
                                <div className="tw-empty-state">현장담당 데이터를 불러오는 중입니다.</div>
                            ) : responsibleGroups.length === 0 ? (
                                <div className="tw-empty-state">청연이엔지 소속 현장담당 팀이 없습니다.</div>
                            ) : isResponsiblePickerOpen && (
                                <div className="tw-team-picker-menu">
                                    {responsibleGroups.map(renderResponsibleItem)}
                                </div>
                            )}
                        </div>

                        <div className="tw-list-block-title tw-list-block-title--workers">현장 목록</div>
                        {loadingMaster || accessScope.loading ? (
                            <div className="tw-empty-state">현장 데이터를 불러오는 중입니다.</div>
                        ) : selectedResponsibleSites.length === 0 ? (
                            <div className="tw-empty-state">조건에 맞는 현장이 없습니다.</div>
                        ) : (
                            selectedResponsibleSites.map(site => {
                                const siteKey = getSitePrimaryKey(site);
                                const selected = siteKey === selectedSiteKey;
                                const stats = selectedSiteStatsByKey.get(siteKey) ?? EMPTY_SITE_LIST_STATS;
                                const color = getTeamColor(teamByKey, site.responsibleTeamId, site.responsibleTeamName, site.color);

                                return (
                                    <button
                                        key={siteKey || site.name}
                                        type="button"
                                        className={selected ? 'tw-worker-item tw-worker-item--active sr-site-item' : 'tw-worker-item sr-site-item'}
                                        onClick={() => setSelectedSiteKey(siteKey)}
                                    >
                                        <span className="tw-avatar" style={{ background: color }}>{String(site.name ?? '?').slice(0, 1)}</span>
                                        <span className="tw-worker-item__main">
                                            <strong>{site.name}</strong>
                                            <small>{site.responsibleTeamName || '담당 미지정'} · {asText(site.siteType)}</small>
                                        </span>
                                        <span className="tw-worker-item__badges">
                                            <small>{formatManDay(stats.totalManDay)}</small>
                                            <small>{formatCurrency(stats.totalAmount)}</small>
                                        </span>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </section>

                <section className="tw-detail-panel">
                    {!selectedSite ? (
                        <div className="tw-empty-detail">
                            <Building2 size={44} />
                            <strong>현장을 선택하세요.</strong>
                        </div>
                    ) : (
                        <>
                            <div className="tw-worker-hero">
                                <div className="tw-worker-hero__avatar" style={{ background: siteDisplayColor }}>{String(selectedSite.name ?? '?').slice(0, 1)}</div>
                                <div className="tw-worker-hero__content">
                                    <div className="tw-worker-hero__title">
                                        <h2>{selectedSite.name}</h2>
                                        <span className={`sr-site-status sr-site-status--${statusLabel(selectedSite)}`}>
                                            {statusLabel(selectedSite)}
                                        </span>
                                    </div>
                                    <div className="tw-worker-hero__meta">
                                        <span><Building2 size={15} />{selectedSite.responsibleTeamName || '담당 미지정'}</span>
                                        <span><MapPin size={15} />{asText(selectedSite.address)}</span>
                                        <span><CalendarDays size={15} />최근 {selectedSiteStats.latestDate || '-'}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="tw-worker-stat-grid">
                                <div>
                                    <span>월 공수</span>
                                    <strong>{formatManDay(selectedSiteStats.totalManDay)}</strong>
                                </div>
                                <div>
                                    <span>월 노무비</span>
                                    <strong>{formatCurrency(selectedSiteStats.totalAmount)}</strong>
                                </div>
                                <div>
                                    <span>작업자</span>
                                    <strong>{selectedSiteStats.workerCount.toLocaleString('ko-KR')}</strong>
                                </div>
                            </div>

                            <div className="tw-view-tabs" role="tablist" aria-label="월별 현장 문서">
                                <button
                                    type="button"
                                    className={detailView === 'siteInfo' ? 'tw-view-tab tw-view-tab--active' : 'tw-view-tab'}
                                    onClick={() => setDetailView('siteInfo')}
                                >
                                    현장정보
                                </button>
                                <button
                                    type="button"
                                    className={detailView === 'payslip' ? 'tw-view-tab tw-view-tab--active' : 'tw-view-tab'}
                                    onClick={() => setDetailView('payslip')}
                                >
                                    노임명세서
                                </button>
                                <button
                                    type="button"
                                    className={detailView === 'dailyReport' ? 'tw-view-tab tw-view-tab--active' : 'tw-view-tab'}
                                    onClick={() => setDetailView('dailyReport')}
                                >
                                    출력일보
                                </button>
                            </div>

                            {detailView === 'siteInfo' && (
                                <div
                                    className="tw-section-grid tw-section-grid--team-accent"
                                    style={{ '--team-color': siteDisplayColor } as React.CSSProperties}
                                >
                                    <section className="tw-detail-section">
                                        <h3><Building2 size={18} />현장정보</h3>
                                        <div className="tw-detail-grid">
                                            <DetailField label="현장명" value={asText(selectedSite.name)} />
                                            <DetailField label="현장코드" value={asText(selectedSite.code)} />
                                            <DetailField label="주소" value={<span className="tw-inline-icon"><MapPin size={15} />{asText(selectedSite.address)}</span>} wide />
                                            <DetailField label="현장유형" value={asText(selectedSite.siteType)} />
                                            <DetailField label="결제방식" value={asText(selectedSite.paymentMethod)} />
                                        </div>
                                    </section>

                                    <section className="tw-detail-section">
                                        <h3><BriefcaseBusiness size={18} />담당/업체</h3>
                                        <div className="tw-detail-grid">
                                            <DetailField label="현장담당" value={asText(selectedSite.responsibleTeamName)} />
                                            <DetailField label="시공사" value={asText(selectedSite.companyName || selectedSite.constructorCompanyName)} />
                                            <DetailField label="발주사" value={asText(selectedSite.clientCompanyName)} />
                                            <DetailField label="협력사" value={asText(selectedSite.partnerName)} />
                                        </div>
                                    </section>

                                    <section className="tw-detail-section">
                                        <h3><CalendarDays size={18} />일정</h3>
                                        <div className="tw-detail-grid">
                                            <DetailField label="시작일" value={asText(selectedSite.startDate)} />
                                            <DetailField label="종료일" value={asText(selectedSite.endDate)} />
                                            <DetailField label="상태" value={statusLabel(selectedSite)} />
                                            <DetailField label="월 출력일" value={`${selectedSiteStats.workDays.toLocaleString('ko-KR')}일`} />
                                        </div>
                                    </section>

                                    <section className="tw-detail-section">
                                        <h3><ShieldCheck size={18} />월간 요약</h3>
                                        <div className="tw-detail-grid">
                                            <DetailField label="총 공수" value={formatManDay(selectedSiteStats.totalManDay)} />
                                            <DetailField label="노무비" value={formatCurrency(selectedSiteStats.totalAmount)} />
                                            <DetailField label="작업자" value={`${selectedSiteStats.workerCount.toLocaleString('ko-KR')}명`} />
                                            <DetailField label="출력일보" value={`${selectedSiteRows.length.toLocaleString('ko-KR')}건`} />
                                        </div>
                                    </section>
                                </div>
                            )}

                            {detailView === 'payslip' && (
                                <section className="tw-document-panel sr-document-panel sr-labor-panel">
                                    <div className="sr-mobile-document-list" aria-label="노무내역서 모바일 요약">
                                        <div className="sr-mobile-document-list__summary">
                                            <FileText size={18} />
                                            <div>
                                                <strong>{selectedSite.name || EMPTY_TEXT}</strong>
                                                <span>{startDate} ~ {endDate}</span>
                                            </div>
                                        </div>

                                        {loadingOutput ? (
                                            <div className="tw-empty-state">출력일보 데이터를 불러오는 중입니다.</div>
                                        ) : laborStatementRows.length === 0 ? (
                                            <div className="tw-empty-state">선택한 기간의 노무내역서 데이터가 없습니다.</div>
                                        ) : (
                                            laborStatementRows.map(row => (
                                                <article key={row.key} className="sr-mobile-document-card">
                                                    <div className="sr-mobile-document-card__header">
                                                        <strong>{row.workerName}</strong>
                                                        <span>{formatManDay(row.totalManDay)}공수</span>
                                                    </div>
                                                    <dl>
                                                        <div>
                                                            <dt>소속팀</dt>
                                                            <dd>{row.teamName || EMPTY_TEXT}</dd>
                                                        </div>
                                                        <div>
                                                            <dt>단가</dt>
                                                            <dd>{formatNumber(row.unitPrice)}</dd>
                                                        </div>
                                                        <div>
                                                            <dt>금액</dt>
                                                            <dd>{formatNumber(row.amount)}</dd>
                                                        </div>
                                                        <div>
                                                            <dt>계좌</dt>
                                                            <dd>{[row.bankName, row.bankOwner, row.bankAccount].filter(Boolean).join(' / ') || EMPTY_TEXT}</dd>
                                                        </div>
                                                    </dl>
                                                </article>
                                            ))
                                        )}
                                    </div>

                                    <div className="sr-labor-statement-shell">
                                        <div className="sr-labor-statement-surface">
                                            <div className="sr-labor-header">
                                                <div className="sr-labor-header__spacer" />
                                                <div className="sr-labor-title-wrap">
                                                    <h3 className="sr-labor-title">노무내역서</h3>
                                                </div>
                                                <table className="sr-labor-meta" aria-label="노무내역서 기본 정보">
                                                    <tbody>
                                                        <tr>
                                                            <th rowSpan={2}>기<br />간</th>
                                                            <td>{startDate}</td>
                                                            <th>회사명</th>
                                                            <td>{selectedSiteCompanyName}</td>
                                                        </tr>
                                                        <tr>
                                                            <td>{endDate}</td>
                                                            <th>현장명</th>
                                                            <td>{selectedSite.name || EMPTY_TEXT}</td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </div>

                                            <table className="sr-labor-table">
                                                <thead>
                                                    <tr>
                                                        <th className="sr-labor-fixed-header sr-labor-col-no" rowSpan={2}>No</th>
                                                        <th className="sr-labor-fixed-header sr-labor-col-name" rowSpan={2}>
                                                            <span>성명</span>
                                                            <small>(소속팀)</small>
                                                        </th>
                                                        <th className="sr-labor-fixed-header sr-labor-col-ssn" rowSpan={2}>
                                                            <span>주민등록번호</span>
                                                            <small>(연락처)</small>
                                                        </th>
                                                        <th className="sr-labor-fixed-header sr-labor-col-address" rowSpan={2}>주소</th>
                                                        {primaryDayNumbers.map(dayNumber => (
                                                            <th key={dayNumber} className="sr-labor-day-primary sr-labor-col-day">
                                                                {String(dayNumber).padStart(2, '0')}
                                                            </th>
                                                        ))}
                                                        <th className="sr-labor-summary-header sr-labor-col-total" rowSpan={2}>출역합계</th>
                                                        <th className="sr-labor-summary-header sr-labor-col-rate" rowSpan={2}>단가</th>
                                                        <th className="sr-labor-summary-header sr-labor-col-amount" rowSpan={2}>인건비총액</th>
                                                        <th className="sr-labor-summary-header sr-labor-col-bank" rowSpan={2}>계좌번호 / 지급구분</th>
                                                    </tr>
                                                    <tr>
                                                        {secondaryDayNumbers.map(dayNumber => (
                                                            <th key={dayNumber} className="sr-labor-day-secondary sr-labor-col-day">
                                                                {String(dayNumber).padStart(2, '0')}
                                                            </th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {loadingOutput ? (
                                                        <tr>
                                                            <td colSpan={primaryDayNumbers.length + 8} className="sr-labor-empty">
                                                                출력일보 데이터를 불러오는 중입니다.
                                                            </td>
                                                        </tr>
                                                    ) : laborStatementRows.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={primaryDayNumbers.length + 8} className="sr-labor-empty">
                                                                선택한 기간의 노무내역서 데이터가 없습니다.
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        laborStatementRows.map(row => (
                                                            <React.Fragment key={row.key}>
                                                                <tr>
                                                                    <td className="sr-labor-index-cell" rowSpan={2}>{row.index}</td>
                                                                    <td className="sr-labor-name-cell" rowSpan={2}>
                                                                        <strong>{row.workerName}</strong>
                                                                        <span>{row.teamName || EMPTY_TEXT}</span>
                                                                    </td>
                                                                    <td className="sr-labor-worker-cell" rowSpan={2}>
                                                                        <strong>{row.workerSsn || EMPTY_TEXT}</strong>
                                                                        <span>{row.workerPhone || EMPTY_TEXT}</span>
                                                                    </td>
                                                                    <td className="sr-labor-address-cell" rowSpan={2}>
                                                                        {row.workerAddress || EMPTY_TEXT}
                                                                    </td>
                                                                    {primaryDayNumbers.map(dayNumber => {
                                                                        const value = row.days[dayNumber - 1];
                                                                        return (
                                                                            <td key={dayNumber} className="sr-labor-day-cell">
                                                                                {value > 0 ? formatManDay(value) : ''}
                                                                            </td>
                                                                        );
                                                                    })}
                                                                    <td className="sr-labor-total-cell" rowSpan={2}>{formatManDay(row.totalManDay)}</td>
                                                                    <td className="sr-labor-money-cell" rowSpan={2}>{formatNumber(row.unitPrice)}</td>
                                                                    <td className="sr-labor-total-cell sr-labor-money-cell" rowSpan={2}>{formatNumber(row.amount)}</td>
                                                                    <td className="sr-labor-bank-cell" rowSpan={2}>
                                                                        <div className="sr-labor-pay-type">직불</div>
                                                                        <div className="sr-labor-bank-lines">
                                                                            <span>{row.bankName || EMPTY_TEXT}</span>
                                                                            <span>{row.bankOwner || EMPTY_TEXT}</span>
                                                                            <span>{row.bankAccount || EMPTY_TEXT}</span>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                                <tr>
                                                                    {secondaryDayNumbers.map(dayNumber => {
                                                                        const value = row.days[dayNumber - 1];
                                                                        return (
                                                                            <td key={dayNumber} className="sr-labor-day-cell">
                                                                                {value > 0 ? formatManDay(value) : ''}
                                                                            </td>
                                                                        );
                                                                    })}
                                                                </tr>
                                                            </React.Fragment>
                                                        ))
                                                    )}
                                                </tbody>
                                                {laborStatementRows.length > 0 && (
                                                    <tfoot>
                                                        <tr>
                                                            <td colSpan={4} className="sr-labor-footer-label" rowSpan={2}>날짜별 공수합계</td>
                                                            {primaryDayNumbers.map(dayNumber => {
                                                                const value = laborStatementSummary.dailyTotals[dayNumber - 1];
                                                                return (
                                                                    <td key={dayNumber} className="sr-labor-footer-day">
                                                                        {value > 0 ? formatManDay(value) : ''}
                                                                    </td>
                                                                );
                                                            })}
                                                            <td className="sr-labor-footer-total" rowSpan={2}>{formatManDay(laborStatementSummary.totalManDay)}</td>
                                                            <td className="sr-labor-footer-blank" rowSpan={2} />
                                                            <td className="sr-labor-footer-money" rowSpan={2}>{formatNumber(laborStatementSummary.totalAmount)}</td>
                                                            <td className="sr-labor-footer-blank" rowSpan={2} />
                                                        </tr>
                                                        <tr>
                                                            {secondaryDayNumbers.map(dayNumber => {
                                                                const value = laborStatementSummary.dailyTotals[dayNumber - 1];
                                                                return (
                                                                    <td key={dayNumber} className="sr-labor-footer-day">
                                                                        {value > 0 ? formatManDay(value) : ''}
                                                                    </td>
                                                                );
                                                            })}
                                                        </tr>
                                                    </tfoot>
                                                )}
                                            </table>
                                        </div>
                                    </div>
                                </section>
                            )}

                            {detailView === 'dailyReport' && (
                                <section className="tw-output-section">
                                    <div className="tw-output-section__header">
                                        <h3><ClipboardList size={18} />출력일보 목록</h3>
                                        <span>{startDate} ~ {endDate}</span>
                                    </div>

                                    <div className="sr-mobile-daily-list" aria-label="출력일보 모바일 목록">
                                        {loadingOutput ? (
                                            <div className="tw-empty-state">출력일보를 불러오는 중입니다.</div>
                                        ) : selectedSiteRows.length === 0 ? (
                                            <div className="tw-empty-state">선택한 기간의 출력일보가 없습니다.</div>
                                        ) : (
                                            selectedSiteRows.map(row => (
                                                <article key={`${row.reportId}-${row.workerId}-${row.date}-${row.siteId}-mobile`} className="sr-mobile-daily-card">
                                                    <div className="sr-mobile-daily-card__header">
                                                        <strong>{row.workerName || EMPTY_TEXT}</strong>
                                                        <span>{row.date}</span>
                                                    </div>
                                                    <dl>
                                                        <div>
                                                            <dt>소속팀</dt>
                                                            <dd>{row.workerTeamName || EMPTY_TEXT}</dd>
                                                        </div>
                                                        <div>
                                                            <dt>급여방식</dt>
                                                            <dd>{resolveReportPayType(row) || EMPTY_TEXT}</dd>
                                                        </div>
                                                        <div>
                                                            <dt>공수</dt>
                                                            <dd>{formatManDay(row.manDay)}</dd>
                                                        </div>
                                                        <div>
                                                            <dt>금액</dt>
                                                            <dd>{formatCurrency(getReportRowAmount(row))}</dd>
                                                        </div>
                                                    </dl>
                                                </article>
                                            ))
                                        )}
                                    </div>

                                    <div className="tw-output-table-wrap tw-output-table-wrap--v2">
                                        <table className="tw-output-table tw-daily-v2-table">
                                            <thead>
                                                <tr>
                                                    <th className="tw-daily-v2-date">날짜</th>
                                                    <th>현장명</th>
                                                    <th>현장소속팀</th>
                                                    <th>성명</th>
                                                    <th>소속팀</th>
                                                    <th>급여방식</th>
                                                    <th className="tw-number">공수</th>
                                                    <th className="tw-number">단가</th>
                                                    <th className="tw-number">금액</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {loadingOutput ? (
                                                    <tr>
                                                        <td colSpan={9} className="tw-table-empty">출력일보를 불러오는 중입니다.</td>
                                                    </tr>
                                                ) : selectedSiteRows.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={9} className="tw-table-empty">선택한 기간의 출력일보가 없습니다.</td>
                                                    </tr>
                                                ) : (
                                                    selectedSiteRows.map(row => (
                                                        <tr key={`${row.reportId}-${row.workerId}-${row.date}-${row.siteId}`}>
                                                            <td className="tw-daily-v2-date">{row.date}</td>
                                                            <td className="tw-truncate" title={row.siteName || ''}>{row.siteName || selectedSite.name}</td>
                                                            <td className="tw-truncate" title={getResponsibleName(row.responsibleTeamId ?? row.teamId, row.responsibleTeamName ?? row.teamName, teamByKey)}>
                                                                {getResponsibleName(row.responsibleTeamId ?? row.teamId, row.responsibleTeamName ?? row.teamName, teamByKey)}
                                                            </td>
                                                            <td><strong>{row.workerName || EMPTY_TEXT}</strong></td>
                                                            <td className="tw-truncate" title={row.workerTeamName || ''}>{row.workerTeamName || EMPTY_TEXT}</td>
                                                            <td>{resolveReportPayType(row) || EMPTY_TEXT}</td>
                                                            <td className="tw-number">{formatManDay(row.manDay)}</td>
                                                            <td className="tw-number">{formatCurrency(row.unitPrice)}</td>
                                                            <td className="tw-number">{formatCurrency(getReportRowAmount(row))}</td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </section>
                            )}
                        </>
                    )}
                </section>
            </main>
        </div>
    );
};

export default SiteResponsibleDetailPage;
