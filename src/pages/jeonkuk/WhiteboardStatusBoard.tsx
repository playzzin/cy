import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faChartBar, faSearch, faBuilding, faUserGroup,
    faChevronDown, faChevronRight, faFileInvoice, faInfoCircle,
    faCalculator, faUsers, faIndustry, faSort, faHardHat
} from '@fortawesome/free-solid-svg-icons';
import { dailyReportService } from '../../services/dailyReportService';
import { Site } from '../../services/siteService';
import { Team } from '../../services/teamService';
import { Company } from '../../services/companyService';
import { useMasterData } from '../../contexts/MasterDataContext';
import OutputManagementTabs from '../../components/common/OutputManagementTabs';
import { loadSessionState, saveSessionState } from '../../utils/sessionStorage';

interface BoardItem {
    id: string;
    name: string;
    manDay?: number;
    totalManDay?: number;
    totalAmount?: number; // New: Total Cost
    workerCount?: number; // New: Cumulative Headcount
    code?: string;
    responsibleTeamName?: string;
    responsibleTeamId?: string;
    companyId?: string;
    type: 'site' | 'team';
    color?: string; // New: Site Color
    reportCount?: number;
    hasInternalSupport?: boolean; // New: Same Company, Not Responsible
    hasExternalSupport?: boolean; // New: Different Company
    workDetails?: {
        targetId: string;
        targetName: string;
        manDay: number;
        amount: number; // New
        workerCount: number; // New
        responsibleTeamId?: string;
        companyId?: string;
        workers?: {
            workerName: string;
            manDay: number;
            amount: number; // New
            dailyLogs: {
                date: string;
                manDay: number;
                amount: number; // New
            }[];
        }[];
    }[];
}

type CSSWithVars = React.CSSProperties & {
    [key: `--${string}`]: string | number | undefined;
};

type WhiteboardStatusViewState = {
    viewMode: 'site' | 'team';
    year: number;
    month: number;
    selectedCompanyId: string;
    searchQuery: string;
    sortBy: 'name-asc' | 'name-desc';
    selectedTeamId: string;
    mainCompanyId: string;
};

type TeamSelectorOption = {
    id: string;
    name: string;
    companyId?: string;
    isSupport?: boolean;
};

const WHITEBOARD_STATUS_VIEW_KEY = 'output-management:whiteboard-status:v1';

const normalizeHexColor = (value: string | undefined): string | undefined => {
    if (!value) return undefined;
    const trimmed = value.trim();
    return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed : undefined;
};

const hexToRgba = (hex: string, alpha: number): string => {
    const normalized = hex.replace('#', '');
    const r = parseInt(normalized.slice(0, 2), 16);
    const g = parseInt(normalized.slice(2, 4), 16);
    const b = parseInt(normalized.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const WhiteboardStatusBoard: React.FC = () => {
    // Context에서 마스터 데이터 가져오기 (Firebase 호출 없이 바로 사용!)
    const { companies, teams, sites, loading: masterDataLoading } = useMasterData();
    const today = React.useMemo(() => new Date(), []);
    const persistedViewState = React.useMemo(
        () => loadSessionState<WhiteboardStatusViewState>(WHITEBOARD_STATUS_VIEW_KEY, {
            viewMode: 'site',
            year: today.getFullYear(),
            month: today.getMonth() + 1,
            selectedCompanyId: '',
            searchQuery: '',
            sortBy: 'name-asc',
            selectedTeamId: '',
            mainCompanyId: ''
        }),
        [today]
    );

    const [viewMode, setViewMode] = useState<'site' | 'team'>(persistedViewState.viewMode === 'team' ? 'team' : 'site');
    const [year, setYear] = useState(persistedViewState.year);
    const [month, setMonth] = useState(persistedViewState.month);

    // Filter State
    const [selectedCompanyId, setSelectedCompanyId] = useState<string>(persistedViewState.selectedCompanyId);
    const [searchQuery, setSearchQuery] = useState<string>(persistedViewState.searchQuery);
    const [sortBy, setSortBy] = useState<'name-asc' | 'name-desc'>(persistedViewState.sortBy === 'name-desc' ? 'name-desc' : 'name-asc');
    const [selectedTeamId, setSelectedTeamId] = useState<string>(persistedViewState.selectedTeamId);
    const [mainCompanyId, setMainCompanyId] = useState<string>(persistedViewState.mainCompanyId);

    const [rawReports, setRawReports] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    // Accordion State
    const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
    const [expandedDetails, setExpandedDetails] = useState<Set<string>>(new Set());
    const [expandedWorkers, setExpandedWorkers] = useState<Set<string>>(new Set());

    const containerRef = useRef<HTMLDivElement>(null);
    const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());

    const normalizeName = React.useCallback((value: string | undefined | null) => String(value ?? '').replace(/\s+/g, '').trim(), []);

    const visibleCompanies = React.useMemo(
        () => companies.filter((company) => {
            const name = normalizeName(company.name);
            return name.includes('청연') || name.includes('다원');
        }),
        [companies, normalizeName]
    );

    const visibleCompanyIdSet = React.useMemo(
        () => new Set(visibleCompanies.map((company) => company.id).filter((id): id is string => Boolean(id))),
        [visibleCompanies]
    );

    const cheongyeonCompanyIdSet = React.useMemo(
        () => new Set(
            visibleCompanies
                .filter((company) => normalizeName(company.name).includes('청연'))
                .map((company) => company.id)
                .filter((id): id is string => Boolean(id))
        ),
        [visibleCompanies, normalizeName]
    );

    const isSupportTeam = React.useCallback((team: Team | undefined) => String(team?.type ?? '').trim() === '지원팀', []);

    const defaultVisibleTeams = React.useMemo(
        () => teams.filter((team) => team.companyId && cheongyeonCompanyIdSet.has(team.companyId) && !isSupportTeam(team)),
        [cheongyeonCompanyIdSet, isSupportTeam, teams]
    );

    const selectableSupportTeams = React.useMemo(
        () => teams.filter((team) => isSupportTeam(team) || (team.companyId ? !cheongyeonCompanyIdSet.has(team.companyId) : false)),
        [cheongyeonCompanyIdSet, isSupportTeam, teams]
    );

    const visibleTeamsForSelector = React.useMemo(() => {
        if (selectedCompanyId) {
            const internal = teams.filter((team) => team.companyId === selectedCompanyId && !isSupportTeam(team));
            const support = teams.filter((team) => team.companyId === selectedCompanyId && isSupportTeam(team));
            return { internal, support };
        }

        return {
            internal: defaultVisibleTeams,
            support: selectableSupportTeams
        };
    }, [defaultVisibleTeams, isSupportTeam, selectableSupportTeams, selectedCompanyId, teams]);

    const resolvedTeamByIdMap = React.useMemo(() => {
        const map = new Map<string, Team>();
        teams.forEach((team) => {
            const id = String(team.id ?? '').trim();
            const legacyId = String(team.legacyId ?? '').trim();
            if (id) map.set(id, team);
            if (legacyId) map.set(legacyId, team);
        });
        return map;
    }, [teams]);

    const resolvedTeamByNameMap = React.useMemo(() => {
        const map = new Map<string, Team>();
        teams.forEach((team) => {
            const key = normalizeName(team.name);
            if (key && !map.has(key)) {
                map.set(key, team);
            }
        });
        return map;
    }, [normalizeName, teams]);

    const resolvedSiteByIdMap = React.useMemo(() => {
        const map = new Map<string, Site>();
        sites.forEach((site) => {
            const id = String(site.id ?? '').trim();
            const legacyId = String(site.legacyId ?? '').trim();
            if (id) map.set(id, site);
            if (legacyId) map.set(legacyId, site);
        });
        return map;
    }, [sites]);

    const resolvedSiteByNameMap = React.useMemo(() => {
        const map = new Map<string, Site>();
        sites.forEach((site) => {
            const key = normalizeName(site.name);
            if (key && !map.has(key)) {
                map.set(key, site);
            }
        });
        return map;
    }, [normalizeName, sites]);

    const resolveDashboardTeam = React.useCallback((teamId?: string | null, teamName?: string | null) => {
        const normalizedId = String(teamId ?? '').trim();
        if (normalizedId) {
            const byId = resolvedTeamByIdMap.get(normalizedId);
            if (byId) return byId;
        }

        const normalizedTeamName = normalizeName(teamName);
        if (normalizedTeamName) {
            return resolvedTeamByNameMap.get(normalizedTeamName);
        }

        return undefined;
    }, [normalizeName, resolvedTeamByIdMap, resolvedTeamByNameMap]);

    const resolveDashboardSite = React.useCallback((siteId?: string | null, siteName?: string | null) => {
        const normalizedId = String(siteId ?? '').trim();
        if (normalizedId) {
            const byId = resolvedSiteByIdMap.get(normalizedId);
            if (byId) return byId;
        }

        const normalizedSiteName = normalizeName(siteName);
        if (normalizedSiteName) {
            return resolvedSiteByNameMap.get(normalizedSiteName);
        }

        return undefined;
    }, [normalizeName, resolvedSiteByIdMap, resolvedSiteByNameMap]);

    const extractTeamNameFromSiteLabel = React.useCallback((siteName?: string | null) => {
        const value = String(siteName ?? '').trim();
        if (!value) return undefined;

        const teamNamePattern = /\(([^)]+)\)/g;
        let match: RegExpExecArray | null;
        let lastTeamName: string | undefined;

        while ((match = teamNamePattern.exec(value)) !== null) {
            const teamName = String(match[1] ?? '').trim();
            if (teamName) lastTeamName = teamName;
        }

        return lastTeamName;
    }, []);

    const resolveReportResponsibleTeam = React.useCallback((report: any) => {
        const toResolvedValue = (team: Team | undefined, fallbackId?: string | null, fallbackName?: string | null) => ({
            id: String(team?.id ?? fallbackId ?? '').trim() || undefined,
            name: String(team?.name ?? fallbackName ?? '').trim() || undefined
        });

        const reportResponsibleName = String(report.responsibleTeamName ?? '').trim();
        const reportResponsibleId = String(report.responsibleTeamId ?? '').trim();

        if (reportResponsibleName) {
            const team = resolveDashboardTeam(undefined, reportResponsibleName) || resolveDashboardTeam(reportResponsibleId);
            return toResolvedValue(team, reportResponsibleId, reportResponsibleName);
        }

        if (reportResponsibleId) {
            const team = resolveDashboardTeam(reportResponsibleId);
            return toResolvedValue(team, reportResponsibleId);
        }

        const labelTeamName = extractTeamNameFromSiteLabel(report.siteName);
        if (labelTeamName) {
            const team = resolveDashboardTeam(undefined, labelTeamName);
            return toResolvedValue(team, undefined, labelTeamName);
        }

        return toResolvedValue(undefined);
    }, [extractTeamNameFromSiteLabel, resolveDashboardTeam]);

    const selectedDashboardTeam = React.useMemo(
        () => resolveDashboardTeam(selectedTeamId),
        [resolveDashboardTeam, selectedTeamId]
    );

    const selectedDashboardTeamIdentityKeys = React.useMemo(() => {
        const keys = new Set<string>();
        const addId = (value?: string | null) => {
            const normalized = String(value ?? '').trim();
            if (normalized) keys.add(`id:${normalized}`);
        };
        const addName = (value?: string | null) => {
            const normalized = normalizeName(value);
            if (normalized) keys.add(`name:${normalized}`);
        };

        addId(selectedTeamId);
        addId(selectedDashboardTeam?.id);
        addId(selectedDashboardTeam?.legacyId);
        addName(selectedDashboardTeam?.name);
        return keys;
    }, [normalizeName, selectedDashboardTeam, selectedTeamId]);

    const matchesSelectedDashboardTeam = React.useCallback((teamId?: string | null, teamName?: string | null) => {
        if (!selectedTeamId) return true;

        const candidateKeys = new Set<string>();
        const addId = (value?: string | null) => {
            const normalized = String(value ?? '').trim();
            if (normalized) candidateKeys.add(`id:${normalized}`);
        };
        const addName = (value?: string | null) => {
            const normalized = normalizeName(value);
            if (normalized) candidateKeys.add(`name:${normalized}`);
        };

        const resolvedTeam = resolveDashboardTeam(teamId, teamName);
        addId(teamId);
        addName(teamName);
        addId(resolvedTeam?.id);
        addId(resolvedTeam?.legacyId);
        addName(resolvedTeam?.name);

        return Array.from(candidateKeys).some((key) => selectedDashboardTeamIdentityKeys.has(key));
    }, [normalizeName, resolveDashboardTeam, selectedDashboardTeamIdentityKeys, selectedTeamId]);

    const siteModeTeamOptions = React.useMemo<TeamSelectorOption[]>(() => (
        teams
            .filter((team) => {
                if (isSupportTeam(team)) return false;
                const companyId = String(team.companyId ?? '').trim();
                if (!companyId) return false;
                return selectedCompanyId ? companyId === selectedCompanyId : visibleCompanyIdSet.has(companyId);
            })
            .map((team) => ({
                id: String(team.id ?? '').trim(),
                name: team.name,
                companyId: String(team.companyId ?? '').trim() || undefined,
                isSupport: false
            }))
            .filter((team) => Boolean(team.id))
            .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
    ), [isSupportTeam, selectedCompanyId, teams, visibleCompanyIdSet]);

    const teamModeTeamOptions = React.useMemo<TeamSelectorOption[]>(() => {
        const optionMap = new Map<string, TeamSelectorOption>();

        const registerTeam = (teamId?: string | null, teamName?: string | null, siteCompanyId?: string | null) => {
            const resolvedTeam = resolveDashboardTeam(teamId, teamName);
            const optionId = String(resolvedTeam?.id ?? teamId ?? '').trim();
            const optionName = String(resolvedTeam?.name ?? teamName ?? '').trim();
            if (!optionId || !optionName) return;

            const teamCompanyId = String(resolvedTeam?.companyId ?? '').trim();
            const normalizedSiteCompanyId = String(siteCompanyId ?? '').trim();
            const isInScope = selectedCompanyId
                ? teamCompanyId === selectedCompanyId || normalizedSiteCompanyId === selectedCompanyId
                : (teamCompanyId ? visibleCompanyIdSet.has(teamCompanyId) : false) ||
                (normalizedSiteCompanyId ? visibleCompanyIdSet.has(normalizedSiteCompanyId) : false);

            if (!isInScope) return;

            const isInternalVisibleTeam = teamCompanyId ? visibleCompanyIdSet.has(teamCompanyId) && !isSupportTeam(resolvedTeam) : false;
            optionMap.set(optionId, {
                id: optionId,
                name: optionName,
                companyId: teamCompanyId || undefined,
                isSupport: !isInternalVisibleTeam
            });
        };

        rawReports.forEach((report) => {
            const targetSite = resolveDashboardSite(report.siteId, report.siteName);
            const siteCompanyId = String(targetSite?.companyId ?? report.companyId ?? '').trim();

            registerTeam(report.teamId, report.teamName, siteCompanyId);
            (report.workers ?? []).forEach((worker: any) => {
                registerTeam(
                    worker.teamId || report.teamId,
                    worker.workerTeamName || (!worker.teamId || worker.teamId === report.teamId ? report.teamName : undefined),
                    siteCompanyId
                );
            });
        });

        return Array.from(optionMap.values()).sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    }, [isSupportTeam, rawReports, resolveDashboardSite, resolveDashboardTeam, selectedCompanyId, visibleCompanyIdSet]);

    const dashboardTeamSelectorOptions = React.useMemo(() => {
        if (viewMode === 'site') {
            return {
                internal: siteModeTeamOptions,
                support: [] as TeamSelectorOption[]
            };
        }

        return {
            internal: teamModeTeamOptions.filter((team) => !team.isSupport),
            support: teamModeTeamOptions.filter((team) => team.isSupport)
        };
    }, [siteModeTeamOptions, teamModeTeamOptions, viewMode]);

    const selectedDashboardTeamLabel = React.useMemo(
        () => [...dashboardTeamSelectorOptions.internal, ...dashboardTeamSelectorOptions.support].find((team) => team.id === selectedTeamId)?.name ?? selectedDashboardTeam?.name ?? '',
        [dashboardTeamSelectorOptions, selectedDashboardTeam, selectedTeamId]
    );

    const selectedCompany = selectedCompanyId
        ? companies.find(c => c.id === selectedCompanyId)
        : companies.find(c => c.id === mainCompanyId);
    const accentColor = normalizeHexColor(selectedCompany?.color) || '#4f46e5';
    const accentBg = hexToRgba(accentColor, 0.08);
    const accentBorder = hexToRgba(accentColor, 0.18);
    const accentTextMuted = hexToRgba(accentColor, 0.65);

    // 마스터 데이터 로드 시 기본 회사 설정
    useEffect(() => {
        if (visibleCompanies.length > 0 && !mainCompanyId) {
            const defaultCompany = visibleCompanies.find(c => normalizeName(c.name).includes('청연')) ?? visibleCompanies[0];
            if (defaultCompany && defaultCompany.id) {
                setSelectedCompanyId(defaultCompany.id);
                setMainCompanyId(defaultCompany.id);
            }
        }
    }, [mainCompanyId, normalizeName, visibleCompanies]);

    useEffect(() => {
        if (!selectedCompanyId) return;
        if (visibleCompanyIdSet.has(selectedCompanyId)) return;

        const defaultCompany = visibleCompanies.find((company) => normalizeName(company.name).includes('청연')) ?? visibleCompanies[0];
        setSelectedCompanyId(defaultCompany?.id ?? '');
    }, [normalizeName, selectedCompanyId, visibleCompanies, visibleCompanyIdSet]);

    useEffect(() => {
        if (!selectedTeamId) return;

        const selectableTeamIds = new Set(
            [...dashboardTeamSelectorOptions.internal, ...dashboardTeamSelectorOptions.support]
                .map((team) => team.id)
                .filter((id): id is string => Boolean(id))
        );

        if (!selectableTeamIds.has(selectedTeamId)) {
            setSelectedTeamId('');
        }
    }, [dashboardTeamSelectorOptions, selectedTeamId]);

    useEffect(() => {
        fetchReports();
    }, [year, month]);

    useEffect(() => {
        saveSessionState(WHITEBOARD_STATUS_VIEW_KEY, {
            viewMode,
            year,
            month,
            selectedCompanyId,
            searchQuery,
            sortBy,
            selectedTeamId,
            mainCompanyId
        } satisfies WhiteboardStatusViewState);
    }, [mainCompanyId, month, searchQuery, selectedCompanyId, selectedTeamId, sortBy, viewMode, year]);

    const fetchReports = async () => {
        setLoading(true);
        try {
            const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
            const lastDay = new Date(year, month, 0).getDate();
            const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;
            const reports = await dailyReportService.getReportsByRange(startDate, endDate);
            setRawReports(reports);
        } catch (error) {
            console.error("Error fetching reports:", error);
        } finally {
            setLoading(false);
        }
    };

    const dashboardItems = React.useMemo(() => {
        if (!sites.length && !teams.length) return [];

        const items: BoardItem[] = [];
        const itemMap = new Map<string, BoardItem>();

        const isWithinCompanyScope = (teamCompanyId?: string | null, siteCompanyId?: string | null) => {
            const normalizedTeamCompanyId = String(teamCompanyId ?? '').trim();
            const normalizedSiteCompanyId = String(siteCompanyId ?? '').trim();

            if (selectedCompanyId) {
                return normalizedTeamCompanyId === selectedCompanyId || normalizedSiteCompanyId === selectedCompanyId;
            }

            return (normalizedTeamCompanyId ? visibleCompanyIdSet.has(normalizedTeamCompanyId) : false) ||
                (normalizedSiteCompanyId ? visibleCompanyIdSet.has(normalizedSiteCompanyId) : false);
        };

        const siteResponsibleTeamByKey = new Map<string, { id?: string; name?: string }>();
        const buildSiteKeys = (siteId?: string | null, siteName?: string | null, site?: Site) => {
            const keys = new Set<string>();
            const addId = (value?: string | null) => {
                const normalized = String(value ?? '').trim();
                if (normalized) keys.add(`id:${normalized}`);
            };
            const addName = (value?: string | null) => {
                const normalized = normalizeName(value);
                if (normalized) keys.add(`name:${normalized}`);
            };

            addId(siteId);
            addId(site?.id);
            addId(site?.legacyId);
            addName(siteName);
            addName(site?.name);

            return Array.from(keys);
        };

        rawReports.forEach((report) => {
            const targetSite = resolveDashboardSite(report.siteId, report.siteName);
            const responsibleTeam = resolveReportResponsibleTeam(report);
            if (!responsibleTeam.id && !responsibleTeam.name) return;

            buildSiteKeys(report.siteId, report.siteName, targetSite).forEach((key) => {
                if (!siteResponsibleTeamByKey.has(key)) {
                    siteResponsibleTeamByKey.set(key, responsibleTeam);
                }
            });
        });

        const getReportResponsibleTeamForSite = (site: Site) => {
            for (const key of buildSiteKeys(site.id, site.name, site)) {
                const responsibleTeam = siteResponsibleTeamByKey.get(key);
                if (responsibleTeam) return responsibleTeam;
            }
            return undefined;
        };

        const getOrCreateItem = (nextItem: BoardItem) => {
            const existing = itemMap.get(nextItem.id);
            if (existing) return existing;
            itemMap.set(nextItem.id, nextItem);
            items.push(nextItem);
            return nextItem;
        };

        const getOrCreateDetail = (
            item: BoardItem,
            detailId: string,
            detailName: string,
            detailCompanyId?: string,
            responsibleTeamId?: string
        ) => {
            if (!item.workDetails) item.workDetails = [];
            let detail = item.workDetails.find((entry) => entry.targetId === detailId);
            if (!detail) {
                detail = {
                    targetId: detailId,
                    targetName: detailName,
                    manDay: 0,
                    amount: 0,
                    workerCount: 0,
                    responsibleTeamId,
                    companyId: detailCompanyId,
                    workers: []
                };
                item.workDetails.push(detail);
            }
            return detail;
        };

        const appendWorkerLog = (
            detail: NonNullable<BoardItem['workDetails']>[number],
            workerName: string,
            date: string,
            manDay: number,
            amount: number
        ) => {
            if (!detail.workers) detail.workers = [];
            let workerEntry = detail.workers.find((entry) => entry.workerName === workerName);
            if (!workerEntry) {
                workerEntry = { workerName, manDay: 0, amount: 0, dailyLogs: [] };
                detail.workers.push(workerEntry);
            }
            workerEntry.manDay += manDay;
            workerEntry.amount += amount;
            workerEntry.dailyLogs.push({ date, manDay, amount });
        };

        if (viewMode === 'site') {
            sites
                .filter((site) => site.status === 'active')
                .filter((site) => {
                    const companyId = String(site.companyId ?? '').trim();
                    if (selectedCompanyId) return companyId === selectedCompanyId;
                    return companyId ? visibleCompanyIdSet.has(companyId) : false;
                })
                .filter((site) => {
                    if (!selectedTeamId) return true;
                    const reportResponsibleTeam = getReportResponsibleTeamForSite(site);
                    return matchesSelectedDashboardTeam(
                        reportResponsibleTeam?.id ?? site.responsibleTeamId,
                        reportResponsibleTeam?.name ?? site.responsibleTeamName
                    );
                })
                .forEach((site) => {
                    const siteId = String(site.id ?? '').trim();
                    if (!siteId) return;
                    const reportResponsibleTeam = getReportResponsibleTeamForSite(site);
                    const masterResponsibleTeam = resolveDashboardTeam(site.responsibleTeamId, site.responsibleTeamName);
                    const responsibleTeamId = String(reportResponsibleTeam?.id ?? masterResponsibleTeam?.id ?? site.responsibleTeamId ?? '').trim() || undefined;
                    const responsibleTeamName = reportResponsibleTeam?.name ?? masterResponsibleTeam?.name ?? site.responsibleTeamName ?? undefined;
                    getOrCreateItem({
                        id: siteId,
                        name: site.name,
                        code: site.code,
                        responsibleTeamName,
                        responsibleTeamId,
                        companyId: String(site.companyId ?? '').trim() || undefined,
                        type: 'site',
                        color: site.color ?? undefined,
                        manDay: 0,
                        totalAmount: 0,
                        workerCount: 0,
                        workDetails: [],
                        reportCount: 0,
                        hasInternalSupport: false,
                        hasExternalSupport: false
                    });
                });
        }

        rawReports.forEach((report) => {
            const targetSite = resolveDashboardSite(report.siteId, report.siteName);
            const reportWriterTeam = resolveDashboardTeam(report.teamId, report.teamName);
            const responsibleTeam = resolveReportResponsibleTeam(report);
            const siteCompanyId = String(targetSite?.companyId ?? report.companyId ?? '').trim();
            const effectiveSiteId = String(targetSite?.id ?? report.siteId ?? '').trim()
                || `site:${normalizeName(targetSite?.name ?? report.siteName ?? 'unknown-site')}`;
            const effectiveSiteName = targetSite?.name || report.siteName || 'Unknown Site';
            const workers = Array.isArray(report.workers) ? report.workers : [];

            if (viewMode === 'site') {
                const siteResponsibleId = responsibleTeam.id;
                const siteResponsibleName = responsibleTeam.name;

                if (selectedTeamId && !matchesSelectedDashboardTeam(siteResponsibleId, siteResponsibleName)) {
                    return;
                }

                const siteItem = getOrCreateItem({
                    id: effectiveSiteId,
                    name: effectiveSiteName,
                    code: targetSite?.code,
                    responsibleTeamName: siteResponsibleName,
                    responsibleTeamId: siteResponsibleId,
                    companyId: siteCompanyId || undefined,
                    type: 'site',
                    color: targetSite?.color ?? undefined,
                    manDay: 0,
                    totalAmount: 0,
                    workerCount: 0,
                    workDetails: [],
                    reportCount: 0,
                    hasInternalSupport: false,
                    hasExternalSupport: false
                });

                if (siteResponsibleId || siteResponsibleName) {
                    siteItem.responsibleTeamId = siteResponsibleId;
                    siteItem.responsibleTeamName = siteResponsibleName;
                }

                let siteReportContributed = false;
                const markSiteReportContribution = () => {
                    if (siteReportContributed) return;
                    siteItem.reportCount = (siteItem.reportCount || 0) + 1;
                    siteReportContributed = true;
                };

                if (workers.length > 0) {
                    workers.forEach((worker: any) => {
                        const workerTeam = resolveDashboardTeam(
                            worker.teamId || report.teamId,
                            worker.workerTeamName || (!worker.teamId || worker.teamId === report.teamId ? report.teamName : undefined)
                        );
                        const detailId = String(workerTeam?.id ?? worker.teamId ?? report.teamId ?? '').trim();
                        const detailName = workerTeam?.name ?? worker.workerTeamName ?? report.teamName ?? 'Unknown Team';
                        if (!detailId || !detailName) return;

                        const detailCompanyId = String(workerTeam?.companyId ?? '').trim() || undefined;
                        if (!isWithinCompanyScope(detailCompanyId, siteCompanyId)) return;

                        const detail = getOrCreateDetail(siteItem, detailId, detailName, detailCompanyId, detailId);

                        const workerManDay = Number(worker.manDay ?? 0);
                        const workerAmount = workerManDay * Number(worker.unitPrice ?? 0);
                        if (workerManDay <= 0) return;

                        markSiteReportContribution();

                        detail.manDay += workerManDay;
                        detail.amount += workerAmount;
                        detail.workerCount += 1;

                        siteItem.manDay = (siteItem.manDay || 0) + workerManDay;
                        siteItem.totalAmount = (siteItem.totalAmount || 0) + workerAmount;
                        siteItem.workerCount = (siteItem.workerCount || 0) + 1;

                        appendWorkerLog(detail, worker.name || 'Unknown Worker', report.date, workerManDay, workerAmount);

                        const isResponsibleTeam = detailId === siteItem.responsibleTeamId;
                        if (detailCompanyId && siteItem.companyId && detailCompanyId !== siteItem.companyId) {
                            siteItem.hasExternalSupport = true;
                        } else if (!isResponsibleTeam) {
                            siteItem.hasInternalSupport = true;
                        }
                    });
                } else {
                    const detailId = String(reportWriterTeam?.id ?? report.teamId ?? '').trim();
                    const detailName = reportWriterTeam?.name ?? report.teamName ?? 'Unknown Team';
                    if (!detailId || !detailName) return;

                    const detailCompanyId = String(reportWriterTeam?.companyId ?? '').trim() || undefined;
                    if (!isWithinCompanyScope(detailCompanyId, siteCompanyId)) return;

                    const detail = getOrCreateDetail(siteItem, detailId, detailName, detailCompanyId, detailId);

                    const reportManDay = Number(report.totalManDay ?? 0);
                    const reportAmount = Number(report.totalAmount ?? 0);
                    if (reportManDay <= 0) return;

                    markSiteReportContribution();

                    detail.manDay += reportManDay;
                    detail.amount += reportAmount;
                    detail.workerCount += reportManDay > 0 ? 1 : 0;

                    siteItem.manDay = (siteItem.manDay || 0) + reportManDay;
                    siteItem.totalAmount = (siteItem.totalAmount || 0) + reportAmount;
                    siteItem.workerCount = (siteItem.workerCount || 0) + (reportManDay > 0 ? 1 : 0);

                    appendWorkerLog(detail, '작업자 정보 없음', report.date, reportManDay, reportAmount);

                    const isResponsibleTeam = detailId === siteItem.responsibleTeamId;
                    if (detailCompanyId && siteItem.companyId && detailCompanyId !== siteItem.companyId) {
                        siteItem.hasExternalSupport = true;
                    } else if (!isResponsibleTeam) {
                        siteItem.hasInternalSupport = true;
                    }
                }

                return;
            }

            const reportItemIds = new Set<string>();
            const appendTeamWork = (
                teamIdValue: string | undefined,
                teamNameValue: string,
                teamCompanyIdValue: string | undefined,
                workerName: string,
                manDay: number,
                amount: number
            ) => {
                const nextItemId = teamIdValue || `team:${normalizeName(teamNameValue)}`;
                if (!nextItemId || !teamNameValue) return;
                if (!isWithinCompanyScope(teamCompanyIdValue, siteCompanyId)) return;
                if (selectedTeamId && !matchesSelectedDashboardTeam(teamIdValue ?? nextItemId, teamNameValue)) return;

                const teamItem = getOrCreateItem({
                    id: nextItemId,
                    name: teamNameValue,
                    companyId: teamCompanyIdValue,
                    type: 'team',
                    manDay: 0,
                    totalAmount: 0,
                    workerCount: 0,
                    workDetails: [],
                    reportCount: 0,
                    hasInternalSupport: false,
                    hasExternalSupport: false
                });

                if (!reportItemIds.has(teamItem.id)) {
                    teamItem.reportCount = (teamItem.reportCount || 0) + 1;
                    reportItemIds.add(teamItem.id);
                }

                const detail = getOrCreateDetail(
                    teamItem,
                    effectiveSiteId,
                    effectiveSiteName,
                    siteCompanyId || undefined,
                    responsibleTeam.id
                );

                detail.manDay += manDay;
                detail.amount += amount;
                detail.workerCount += 1;

                teamItem.manDay = (teamItem.manDay || 0) + manDay;
                teamItem.totalAmount = (teamItem.totalAmount || 0) + amount;
                teamItem.workerCount = (teamItem.workerCount || 0) + 1;

                appendWorkerLog(detail, workerName, report.date, manDay, amount);
            };

            if (workers.length > 0) {
                workers.forEach((worker: any) => {
                    const workerTeam = resolveDashboardTeam(
                        worker.teamId || report.teamId,
                        worker.workerTeamName || (!worker.teamId || worker.teamId === report.teamId ? report.teamName : undefined)
                    );
                    const workerTeamId = String(workerTeam?.id ?? worker.teamId ?? report.teamId ?? '').trim() || undefined;
                    const workerTeamName = workerTeam?.name ?? worker.workerTeamName ?? report.teamName ?? 'Unknown Team';
                    const workerTeamCompanyId = String(workerTeam?.companyId ?? '').trim() || undefined;
                    const workerManDay = Number(worker.manDay ?? 0);
                    const workerAmount = workerManDay * Number(worker.unitPrice ?? 0);

                    appendTeamWork(
                        workerTeamId,
                        workerTeamName,
                        workerTeamCompanyId,
                        worker.name || 'Unknown Worker',
                        workerManDay,
                        workerAmount
                    );
                });
            } else {
                const reportTeamId = String(reportWriterTeam?.id ?? report.teamId ?? '').trim() || undefined;
                const reportTeamName = reportWriterTeam?.name ?? report.teamName ?? 'Unknown Team';
                const reportTeamCompanyId = String(reportWriterTeam?.companyId ?? '').trim() || undefined;
                const reportManDay = Number(report.totalManDay ?? 0);
                const reportAmount = Number(report.totalAmount ?? 0);

                appendTeamWork(
                    reportTeamId,
                    reportTeamName,
                    reportTeamCompanyId,
                    '작업자 정보 없음',
                    reportManDay,
                    reportAmount
                );
            }
        });

        return items
            .filter((item) => {
                return (item.manDay || 0) > 0;
            })
            .map((item) => {
                if (item.workDetails) {
                    item.workDetails.sort((a, b) => b.manDay - a.manDay);
                    item.workDetails.forEach((detail) => {
                        if (detail.workers) {
                            detail.workers.sort((left, right) => right.manDay - left.manDay);
                            detail.workers.forEach((worker) => {
                                worker.dailyLogs.sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime());
                            });
                        }
                    });
                }
                const totalFromDetails = item.workDetails?.reduce((sum, detail) => sum + detail.manDay, 0) || 0;
                item.totalManDay = totalFromDetails;
                if (Math.abs((item.manDay || 0) - totalFromDetails) > 0.1) {
                    item.manDay = totalFromDetails;
                }
                return item;
            })
            .sort((a, b) => {
                const isAExpanded = expandedItems.has(a.id);
                const isBExpanded = expandedItems.has(b.id);
                if (isAExpanded && !isBExpanded) return -1;
                if (!isAExpanded && isBExpanded) return 1;

                if (sortBy === 'name-desc') return b.name.localeCompare(a.name, 'ko');
                return a.name.localeCompare(b.name, 'ko');
            });
    }, [
        expandedItems,
        matchesSelectedDashboardTeam,
        normalizeName,
        rawReports,
        resolveReportResponsibleTeam,
        resolveDashboardSite,
        resolveDashboardTeam,
        selectedCompanyId,
        selectedTeamId,
        sites,
        sortBy,
        teams,
        viewMode,
        visibleCompanyIdSet
    ]);

    const toggleAccordion = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const newSet = new Set(expandedItems);
        // Exclusive Open Logic: Close all others when opening a new one
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.clear(); // Close others
            newSet.add(id);

            // Scroll Container to Top (Since item moves to #1 spot)
            setTimeout(() => {
                if (containerRef.current) {
                    containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
                }
            }, 100);
        }
        setExpandedItems(newSet);
    };

    // Level 2 Toggle (Exclusive)
    const toggleDetail = (itemId: string, detailKey: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const key = `${itemId}-${detailKey}`;
        const newSet = new Set(expandedDetails);
        if (newSet.has(key)) {
            newSet.delete(key);
        } else {
            // Close others for this specific item scope? Or global?
            // "Same way as Level 1" implies exclusive.
            // Level 1 logic clears EVERYTHING. 
            // For Level 2, we probably want to clear other DETAILS for this item.
            // BUT, since we only show one "Worker Grid" area below, it implies only one detail can be active anyway.
            // Let's clear all details for this Item context, or just clear the set entirely since Level 1 clears entirely.
            // To be safe and "Same way": Clear All Level 2s.
            newSet.clear();
            newSet.add(key);
        }
        setExpandedDetails(newSet);
        // Also clear Level 3 (Workers) when switching Level 2
        setExpandedWorkers(new Set());
    };

    // Level 3 Toggle (Exclusive)
    const toggleWorker = (detailKeyFull: string, workerName: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const key = `${detailKeyFull}-${workerName}`;
        const newSet = new Set(expandedWorkers);
        if (newSet.has(key)) {
            newSet.delete(key);
        } else {
            newSet.clear(); // Exclusive: Close other workers
            newSet.add(key);
        }
        setExpandedWorkers(newSet);
    };

    // Calculate Grand Total
    const grandTotalManDays = dashboardItems.reduce((sum, item) => sum + (item.manDay || 0), 0);
    const totalItems = dashboardItems.length;
    const totalInternalSupportSites =
        viewMode === 'site' ? dashboardItems.filter(item => item.hasInternalSupport).length : 0;
    const totalExternalSupportSites =
        viewMode === 'site' ? dashboardItems.filter(item => item.hasExternalSupport).length : 0;
    const maxItemManDay = dashboardItems.reduce((max, item) => Math.max(max, item.manDay || 0), 0);

    // 검색 필터링
    const searchFilteredItems = React.useMemo(() => {
        if (!searchQuery.trim()) return dashboardItems;
        const query = searchQuery.toLowerCase();
        return dashboardItems.filter(item =>
            item.name.toLowerCase().includes(query) ||
            item.code?.toLowerCase().includes(query)
        );
    }, [dashboardItems, searchQuery]);

    // 정렬 - 확장된 아이템은 항상 첫 번째로, 시공사 먼저 → 협력사 나중에
    const sortedItems = React.useMemo(() => {
        // 회사 타입 조회용 맵
        const companyTypeMap = new Map(companies.map(c => [c.id, c.type]));

        return [...searchFilteredItems].sort((a, b) => {
            // 1. 확장된 아이템은 항상 맨 위로
            const isAExpanded = expandedItems.has(a.id);
            const isBExpanded = expandedItems.has(b.id);
            if (isAExpanded && !isBExpanded) return -1;
            if (!isAExpanded && isBExpanded) return 1;

            // 2. 회사 타입별 정렬: 시공사 → 협력사 → 기타
            const aCompanyType = a.companyId ? companyTypeMap.get(a.companyId) : undefined;
            const bCompanyType = b.companyId ? companyTypeMap.get(b.companyId) : undefined;

            const getTypeOrder = (type: string | undefined) => {
                if (type === '시공사') return 0;
                if (type === '협력사') return 1;
                return 2;
            };

            const aTypeOrder = getTypeOrder(aCompanyType);
            const bTypeOrder = getTypeOrder(bCompanyType);

            if (aTypeOrder !== bTypeOrder) {
                return aTypeOrder - bTypeOrder;
            }

            // 3. 같은 회사 타입 내에서 선택된 정렬 기준 적용
            switch (sortBy) {
                case 'name-asc':
                    return a.name.localeCompare(b.name, 'ko');
                case 'name-desc':
                    return b.name.localeCompare(a.name, 'ko');
                default:
                    // 기본: 같은 타입 내에서 가나다순
                    return a.name.localeCompare(b.name, 'ko');
            }
        });
    }, [searchFilteredItems, sortBy, expandedItems, companies]);

    // 업데이트된 통계 (sortedItems 기반)
    const grandTotalManDaysFiltered = sortedItems.reduce((sum, item) => sum + (item.manDay || 0), 0);
    const totalItemsFiltered = sortedItems.length;

    return (
        <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
            <OutputManagementTabs activeTab="status" />

            {/* Header Controls */}
            <div className="bg-white border-b border-slate-200 p-6 flex flex-col gap-4 shadow-sm z-10">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-6">
                        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                            <FontAwesomeIcon icon={faChartBar} className="text-indigo-600" />
                            통합 현황판
                        </h1>

                        <div className="flex items-center gap-2">
                            {/* Company Filter - 청연/다원만 표시 */}
                            <select
                                value={selectedCompanyId}
                                onChange={(e) => { setSelectedCompanyId(e.target.value); setExpandedItems(new Set()); }}
                                className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg px-3 py-2 font-bold focus:outline-none focus:border-indigo-500"
                            >
                                <option value="">전체 회사 (All)</option>
                                {visibleCompanies.map(company => (
                                    <option key={company.id} value={company.id}>{company.name}</option>
                                ))}
                            </select>

                            {/* Team Filter */}
                            <select
                                value={selectedTeamId}
                                onChange={(e) => { setSelectedTeamId(e.target.value); setExpandedItems(new Set()); }}
                                className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg px-3 py-2 font-bold focus:outline-none focus:border-indigo-500 ml-2"
                            >
                                <option value="">전체 팀 (All Teams)</option>
                                {dashboardTeamSelectorOptions.internal.length > 0 && (
                                    <optgroup label={selectedCompanyId ? '소속팀' : '청연팀'}>
                                        {dashboardTeamSelectorOptions.internal.map(team => (
                                            <option key={team.id} value={team.id}>{team.name}</option>
                                        ))}
                                    </optgroup>
                                )}
                                {dashboardTeamSelectorOptions.support.length > 0 && (
                                    <optgroup label="지원팀">
                                        {dashboardTeamSelectorOptions.support.map(team => (
                                            <option key={team.id} value={team.id}>{team.name}</option>
                                        ))}
                                    </optgroup>
                                )}
                            </select>

                            {/* View Mode Toggle */}
                            <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 ml-2">
                                <button
                                    onClick={() => { setViewMode('site'); setExpandedItems(new Set()); }}
                                    className={`px-4 py-2 rounded-md text-sm font-bold transition-all flex items-center gap-2 ${viewMode === 'site'
                                        ? 'bg-white text-indigo-600 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                >
                                    <FontAwesomeIcon icon={faBuilding} />
                                    현장별
                                </button>
                                <button
                                    onClick={() => { setViewMode('team'); setExpandedItems(new Set()); }}
                                    className={`px-4 py-2 rounded-md text-sm font-bold transition-all flex items-center gap-2 ${viewMode === 'team'
                                        ? 'bg-white text-indigo-600 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                >
                                    <FontAwesomeIcon icon={faUserGroup} />
                                    팀별
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* 검색 입력 필드 */}
                        <div className="relative">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="현장/팀 검색..."
                                className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm w-48"
                            />
                            <FontAwesomeIcon
                                icon={faSearch}
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                            />
                        </div>

                        {/* 정렬 셀렉트 */}
                        <div className="flex items-center gap-2 bg-white border border-slate-300 rounded-lg px-3 py-2">
                            <FontAwesomeIcon icon={faSort} className="text-slate-400" />
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value as 'name-asc' | 'name-desc')}
                                className="bg-transparent text-sm font-medium text-slate-700 focus:outline-none cursor-pointer"
                            >
                                <option value="name-asc">이름 ㄱ-ㅎ</option>
                                <option value="name-desc">이름 ㅎ-ㄱ</option>
                            </select>
                        </div>

                        {/* Total Man Days Display */}
                        <div
                            className="flex items-center gap-2 px-4 py-2 rounded-xl border"
                            style={{ backgroundColor: accentBg, borderColor: accentBorder }}
                        >
                            <div className="text-xs font-bold uppercase tracking-wider" style={{ color: accentColor }}>Total</div>
                            <div className="text-xl font-black" style={{ color: accentColor }}>
                                {grandTotalManDaysFiltered.toFixed(1)} <span className="text-sm font-bold" style={{ color: accentTextMuted }}>공수</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 bg-slate-100 px-4 py-2 rounded-xl border border-slate-200">
                            <select
                                value={year}
                                onChange={(e) => setYear(Number(e.target.value))}
                                className="bg-transparent text-base font-bold text-slate-700 focus:outline-none cursor-pointer"
                            >
                                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
                                    <option key={y} value={y}>{y}년</option>
                                ))}
                            </select>
                            <span className="text-slate-300">|</span>
                            <select
                                value={month}
                                onChange={(e) => setMonth(Number(e.target.value))}
                                className="bg-transparent text-base font-bold text-slate-700 focus:outline-none cursor-pointer"
                            >
                                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                    <option key={m} value={m}>{m}월</option>
                                ))}
                            </select>
                        </div>
                        <button
                            onClick={fetchReports}
                            className={`p-2 rounded-full transition-colors ${loading ? 'text-slate-400' : 'text-indigo-600 hover:bg-indigo-50'}`}
                            title="새로고침"
                            disabled={loading}
                        >
                            <FontAwesomeIcon icon={faSearch} spin={loading} />
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div className="flex items-center justify-between bg-slate-900 text-slate-50 px-4 py-3 rounded-2xl shadow-sm">
                        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                            <FontAwesomeIcon icon={viewMode === 'site' ? faBuilding : faUserGroup} className="text-slate-300" />
                            <span>대상 {viewMode === 'site' ? '현장' : '팀'} 수</span>
                        </div>
                        <div className="text-2xl font-black">
                            {totalItemsFiltered}
                        </div>
                    </div>
                    <div
                        className="flex items-center justify-between px-4 py-3 rounded-2xl border"
                        style={{ backgroundColor: accentBg, borderColor: accentBorder }}
                    >
                        <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: accentTextMuted }}>
                            총 공수
                        </div>
                        <div className="text-2xl font-black" style={{ color: accentColor }}>
                            {grandTotalManDaysFiltered.toFixed(1)}
                            <span className="ml-1 text-sm font-bold" style={{ color: accentTextMuted }}>공수</span>
                        </div>
                    </div>
                    <div className="flex items-center justify-between bg-emerald-50 px-4 py-3 rounded-2xl border border-emerald-100">
                        <div className="text-xs font-semibold text-emerald-600 uppercase tracking-wide flex items-center gap-1">
                            <FontAwesomeIcon icon={faBuilding} className="text-emerald-500" />
                            <span>내부/외부 지원 현장</span>
                        </div>
                        <div className="text-right">
                            <div className="text-xs text-emerald-700">
                                내부 {totalInternalSupportSites}개
                            </div>
                            <div className="text-xs text-emerald-700">
                                외부 {totalExternalSupportSites}개
                            </div>
                        </div>
                    </div>
                </div>

                {/* Logic Explanation Text */}
                <div className="bg-slate-50 rounded-lg p-3 text-center border border-slate-100">
                    <p className="text-slate-600 text-sm font-medium">
                        <span className="font-bold mr-2 inline-flex items-center gap-1" style={{ color: accentColor }}>
                                    <FontAwesomeIcon icon={faBuilding} className="text-slate-400" />
                                    {companies.find(c => c.id === selectedCompanyId)?.name || '청연 · 다원'}
                        </span>
                        {selectedTeamId ? (
                            <>
                                <span className="font-bold text-slate-800 inline-flex items-center gap-1 mr-1">
                                    <FontAwesomeIcon icon={faUserGroup} className="text-slate-400" />
                                    {selectedDashboardTeamLabel || ''}
                                </span>
                                {viewMode === 'site' ? (
                                    <span>
                                                팀이 실제 출역한 현장이 아니라
                                                <span className="font-bold text-slate-800"> 담당 현장 기준</span>으로 정리한 공수 내역입니다.
                                    </span>
                                ) : (
                                    <span>
                                        팀이 수행한 <span className="font-bold text-slate-800">총 공수</span>와,
                                        해당 팀이 작업한 <span className="font-bold text-slate-800">현장별 공수</span> 내역입니다.
                                    </span>
                                )}
                            </>
                        ) : (
                            <>
                                <span className="font-bold text-slate-800 inline-flex items-center gap-1 mr-1">
                                    <FontAwesomeIcon icon={faUserGroup} className="text-slate-400" />
                                    청연 소속팀
                                </span>
                                {viewMode === 'site' ? (
                                    <span>
                                        청연/다원 현장의 <span className="font-bold text-slate-800">현장별 총 공수</span>와,
                                        각 현장에 들어온 <span className="font-bold text-slate-800">청연팀·지원팀 상세 공수</span> 내역입니다.
                                    </span>
                                ) : (
                                    <span>
                                        이 수행한 <span className="font-bold text-slate-800">총 공수</span>와,
                                        각 팀이 작업한 <span className="font-bold text-slate-800">현장별 상세 공수</span> 내역입니다.
                                    </span>
                                )}
                            </>
                        )}
                    </p>
                </div>
            </div>

            {/* Grid Area */}
            <div
                ref={containerRef}
                className="flex-1 overflow-y-auto p-8 bg-slate-100/50 relative scroll-smooth"
            >
                {/* Background Grid Pattern */}
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
                    style={{ backgroundImage: 'radial-gradient(#4f46e5 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
                </div>

                {dashboardItems.length > 0 ? (
                    <div className="flex flex-wrap gap-2 w-full px-2">
                        {sortedItems.map(item => {
                            // Check expansion state for dynamic sizing
                            const isItemExpanded = expandedItems.has(item.id);
                            // Check if any detail is expanded
                            const hasExpandedDetail = Array.from(expandedDetails).some(key => key.startsWith(`${item.id}-`));

                            // Determine Flex Class (Flexible width with min-width)
                            let colSpanClass = 'flex-1 min-w-[220px]';

                            // Only expand width if the main item is expanded
                            if (isItemExpanded) {
                                colSpanClass = 'w-full flex-none'; // Take full width
                            }

                            // Defensive check for totalManDay
                            const totalManDayDisplay = item.totalManDay !== undefined ? item.totalManDay : (item.manDay || 0);

                            // Check if item is from 'Other Company' (Not Main)
                            const isOtherCompany = item.companyId && item.companyId !== mainCompanyId;
                            // Determine Color Theme: Orange ONLY for Teams from other companies, Sites are always blue
                            const isOrangeTheme = item.type === 'team' && isOtherCompany;
                            const volumeRatio = maxItemManDay > 0 ? (item.manDay || 0) / maxItemManDay : 0;

                            const siteCompany = item.type === 'site'
                                ? companies.find(c => c.id === item.companyId)
                                : undefined;

                            const itemCompany = item.type === 'site'
                                ? siteCompany
                                : companies.find(c => c.id === item.companyId);
                            const itemCompanyColor = normalizeHexColor(itemCompany?.color);
                            const responsibleTeamForItem = item.type === 'site'
                                ? resolveDashboardTeam(item.responsibleTeamId, item.responsibleTeamName)
                                : undefined;
                            const responsibleTeamColor = normalizeHexColor(responsibleTeamForItem?.color);
                            const displayedResponsibleTeamColor = responsibleTeamColor || (item.responsibleTeamName ? '#8b5cf6' : undefined);
                            const externalSiteTeamColor = item.type === 'site' && isOtherCompany
                                ? displayedResponsibleTeamColor
                                : undefined;
                            const siteCompanyDisplayColor = item.type === 'site' && siteCompany
                                ? externalSiteTeamColor || itemCompanyColor || '#6b7280'
                                : undefined;
                            const fallbackColor = isOrangeTheme ? '#f97316' : '#4f46e5';
                            const brandColor = externalSiteTeamColor || itemCompanyColor || fallbackColor;
                            const ringStyle: CSSWithVars | undefined = isItemExpanded
                                ? { '--tw-ring-color': hexToRgba(brandColor, 0.7) }
                                : undefined;

                            return (
                                <motion.div
                                    layout
                                    transition={{ layout: { duration: 0.3, type: "spring", stiffness: 300, damping: 30 } }}
                                    key={item.id}
                                    ref={(el) => {
                                        if (el) itemRefs.current.set(item.id, el);
                                        else itemRefs.current.delete(item.id);
                                    }}
                                    className={`bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden transition-shadow duration-300 ease-in-out group cursor-pointer 
                                        ${colSpanClass} 
                                        ${isItemExpanded ? 'ring-1 shadow-xl z-20' : 'hover:shadow-lg hover:-translate-y-1'}
                                    `}
                                    style={ringStyle}
                                    onClick={(e) => toggleAccordion(item.id, e)}
                                >
                                    <div className="p-3 border-b border-slate-200 bg-gradient-to-br from-white to-slate-50/30">
                                        {/* 컨텐츠 영역 */}
                                        <div className="min-w-0 flex-1">
                                            <h3 className="font-bold text-base text-slate-800 truncate whitespace-nowrap flex items-center gap-2" title={item.name}>
                                                {item.type === 'site' && (
                                                    <span
                                                        className="inline-flex items-center justify-center w-6 h-6 rounded-full border border-slate-200 flex-shrink-0"
                                                        style={{ backgroundColor: item.color || '#F3F4F6' }}
                                                    >
                                                        <FontAwesomeIcon icon={faHardHat} className={`text-[10px] ${item.color ? 'text-white' : 'text-slate-400'}`} />
                                                    </span>
                                                )}
                                                {item.name}
                                            </h3>
                                            {/* 현장인 경우: 회사명과 담당팀을 바로 아래에 표시 */}
                                            {item.type === 'site' && (
                                                <div className="flex items-center gap-2 mt-0.5 mb-1.5 flex-wrap">
                                                    {siteCompany && (
                                                        <span
                                                            className="text-xs font-medium flex items-center gap-1.5"
                                                            style={{ color: siteCompanyDisplayColor }}
                                                        >
                                                            <span
                                                                className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                                                                style={{ backgroundColor: siteCompanyDisplayColor || '#3b82f6' }}
                                                            >
                                                                <FontAwesomeIcon icon={faBuilding} className="text-[8px] text-white" />
                                                            </span>
                                                            {siteCompany.name}
                                                        </span>
                                                    )}
                                                    {item.responsibleTeamName && (() => {
                                                        const teamColor = displayedResponsibleTeamColor || '#8b5cf6';
                                                        return (
                                                            <span
                                                                className="text-xs font-medium flex items-center gap-1.5"
                                                                style={{ color: teamColor }}
                                                            >
                                                                <span
                                                                    className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                                                                    style={{ backgroundColor: teamColor }}
                                                                >
                                                                    <FontAwesomeIcon icon={faUserGroup} className="text-[8px] text-white" />
                                                                </span>
                                                                {item.responsibleTeamName}
                                                            </span>
                                                        );
                                                    })()}
                                                </div>
                                            )}
                                            {item.type === 'team' && (
                                                <span className="text-xs font-bold text-indigo-700 bg-indigo-100 px-2.5 py-1 rounded-lg border border-indigo-200 inline-flex items-center gap-1.5 whitespace-nowrap shadow-sm">
                                                    <FontAwesomeIcon icon={faUserGroup} className="text-xs" />
                                                    Team
                                                </span>
                                            )}
                                        </div>
                                    </div>


                                    {!isItemExpanded && (
                                        <div className="p-3 flex flex-col gap-2 min-h-[96px] relative">
                                            <div className="flex items-baseline justify-between gap-4">
                                                <div>
                                                    <div className="text-[10px] font-extrabold text-indigo-700 uppercase tracking-wider whitespace-nowrap drop-shadow-sm">
                                                        총 공수
                                                    </div>
                                                    <div
                                                        className={`mt-1 text-3xl md:text-4xl font-extrabold whitespace-nowrap drop-shadow-lg ${item.manDay && item.manDay > 0 ? '' : 'text-slate-300'}`}
                                                        style={item.manDay && item.manDay > 0 ? { color: brandColor, textShadow: `0 2px 8px ${hexToRgba(brandColor, 0.18)}` } : undefined}
                                                    >
                                                        {(item.manDay || 0).toFixed(1)}
                                                        <span className="ml-1 text-lg font-bold text-indigo-400 align-top">공수</span>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end gap-1 text-[11px] text-slate-600 whitespace-nowrap">
                                                    <div className="flex items-center gap-1.5 mb-1">
                                                        <FontAwesomeIcon icon={viewMode === 'site' ? faUserGroup : faBuilding} className="text-slate-400" />
                                                        <span className="font-bold text-slate-700">
                                                            {viewMode === 'site' ? '참여 팀' : '진행 현장'} <span className="text-indigo-600 text-lg font-extrabold align-middle">{item.workDetails ? item.workDetails.length : 0}</span>개
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between text-[11px] text-slate-400 whitespace-nowrap">
                                                <span>
                                                    {year}년 {month}월 누적
                                                </span>
                                                <span className="flex items-center gap-1 text-slate-400">
                                                    <span>상세 보기</span>
                                                    <FontAwesomeIcon icon={faChevronRight} className="text-[10px]" />
                                                </span>
                                            </div>

                                        </div>
                                    )}

                                    {/* Accordion Content (Smart Dynamic Layout) */}
                                    <AnimatePresence>
                                        {isItemExpanded && item.workDetails && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                exit={{ opacity: 0, height: 0 }}
                                                className="bg-white border-t border-slate-100 text-sm p-4"
                                            >

                                                {/* 1. Header Summary Section */}
                                                <div className="flex flex-col md:flex-row justify-between items-end border-b border-slate-100 pb-4 mb-4">
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <span className="px-2 py-1 bg-indigo-50 text-indigo-600 text-xs font-bold rounded whitespace-nowrap">
                                                                {companies.find(c => c.id === selectedCompanyId)?.name || '전체 회사'}
                                                            </span>
                                                            <h2 className="text-xl md:text-2xl font-bold text-slate-800 whitespace-nowrap">
                                                                {viewMode === 'site' ? '참여 팀 현황' : '진행 현장 현황'}
                                                            </h2>
                                                        </div>
                                                        <p className="text-slate-500 mb-2 text-sm line-clamp-2 md:line-clamp-none">
                                                            <span className="font-bold text-slate-800">{item.name}</span>
                                                            {viewMode === 'site' ? ' 현장에 투입된 팀들의 상세 공수 내역입니다.' : ' 팀이 수행한 현장별 상세 공수 내역입니다.'}
                                                        </p>
                                                        {/* Level 1 Formula Explanation */}
                                                        <div className="flex items-start gap-2 bg-indigo-50/50 p-2 rounded-lg border border-indigo-100/50 text-xs text-indigo-800 max-w-lg">
                                                            <FontAwesomeIcon icon={faInfoCircle} className="mt-0.5 text-indigo-400 flex-shrink-0" />
                                                            <div>
                                                                <span className="font-bold mr-1">산출 공식:</span>
                                                                {viewMode === 'site'
                                                                    ? '해당 기간 동안 이 현장에 투입된 모든 팀의 작업 공수 합계 (Teams Sum)'
                                                                    : '해당 기간 동안 이 팀이 수행한 모든 현장의 작업 공수 합계 (Sites Sum)'
                                                                }
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="text-right mt-4 md:mt-0 flex-shrink-0">
                                                        <span className="text-sm text-slate-500 block mb-1">총 투입 공수</span>
                                                        <span className="text-3xl md:text-4xl font-black tracking-tight whitespace-nowrap" style={{ color: brandColor }}>
                                                            {totalManDayDisplay.toFixed(1)}
                                                            <span className="text-lg text-slate-400 font-medium ml-1">MD</span>
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* 2. Team Grid (Response to "30 Teams") */}
                                                <div className="mb-6 p-1 min-h-[300px] transition-all duration-500">
                                                    <div className="flex justify-between items-center mb-3">
                                                        <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                                            <FontAwesomeIcon icon={faCalculator} className="text-indigo-500" />
                                                            상세 목록 ({item.workDetails.length}건)
                                                        </h4>
                                                    </div>

                                                    {/* Smart Grid: Sequential Expansion logic - Responsive Cols Adjustment */}
                                                    <motion.div
                                                        variants={{
                                                            hidden: { opacity: 0 },
                                                            show: {
                                                                opacity: 1,
                                                                transition: {
                                                                    staggerChildren: 0.03
                                                                }
                                                            }
                                                        }}
                                                        initial="hidden"
                                                        animate="show"
                                                        className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2 auto-rows-min grid-flow-row-dense"
                                                    >
                                                        {item.workDetails
                                                            .map((detail, idx) => {
                                                                const isDetailSelected = expandedDetails.has(`${item.id}-${detail.targetId}`);

                                                                // Logic for Level 2 (Team in Site)
                                                                const isResponsibleTeam = item.responsibleTeamId === detail.targetId;
                                                                const isInternalSupport = viewMode === 'site' && detail.companyId === item.companyId && !isResponsibleTeam;
                                                                const isExternalSupport = viewMode === 'site' && detail.companyId !== item.companyId && detail.companyId !== undefined;
                                                                const detailTeam = viewMode === 'site'
                                                                    ? resolveDashboardTeam(detail.targetId, detail.targetName)
                                                                    : undefined;
                                                                const detailTeamColor = normalizeHexColor(detailTeam?.color) || '#8b5cf6';
                                                                const detailManDayColor = isExternalSupport ? detailTeamColor : '#4f46e5';
                                                                const externalSupportBadgeStyle: React.CSSProperties = {
                                                                    borderColor: hexToRgba(detailTeamColor, 0.28),
                                                                    backgroundColor: hexToRgba(detailTeamColor, 0.1),
                                                                    color: detailTeamColor
                                                                };
                                                                const detailStatusBadges = viewMode === 'site'
                                                                    ? [
                                                                        isResponsibleTeam ? { label: '담당팀', className: 'border-slate-200 bg-slate-100 text-slate-600' } : undefined,
                                                                        isInternalSupport ? { label: '내부지원', className: 'border-blue-200 bg-blue-50 text-blue-700' } : undefined,
                                                                        isExternalSupport ? { label: '외부지원', className: 'border-orange-200 bg-orange-50 text-orange-700' } : undefined
                                                                    ].filter((badge): badge is { label: string; className: string } => Boolean(badge))
                                                                    : [];

                                                                return (
                                                                    <motion.div
                                                                        key={idx}
                                                                        variants={{
                                                                            hidden: { opacity: 0, y: 20 },
                                                                            show: { opacity: 1, y: 0 }
                                                                        }}
                                                                        className={`
                                                                    relative rounded-xl transition-colors duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] overflow-hidden
                                                                    ${isDetailSelected
                                                                                ? 'col-span-full bg-slate-50 border border-indigo-200 shadow-xl z-20 my-2 ring-1 ring-indigo-100'
                                                                                : 'col-span-1 bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-md'
                                                                            }
                                                                `}
                                                                    >
                                                                        {/* Summary Header (Always Visible) */}
                                                                        <div
                                                                            onClick={(e) => toggleDetail(item.id, detail.targetId, e)}
                                                                            className={`
                                                                        cursor-pointer text-center flex flex-col items-center justify-center transition-all relative
                                                                        ${isDetailSelected ? 'p-4 border-b border-indigo-100 bg-white' : 'p-2 min-h-[80px] hover:bg-slate-50'}
                                                                    `}
                                                                        >
                                                                            <div className={`font-bold truncate w-full mb-0.5 transition-colors flex items-center justify-center gap-1.5 ${isDetailSelected ? 'text-lg text-indigo-900' : 'text-xs text-slate-800'}`}>
                                                                                {/* 팀/현장 아이콘 */}
                                                                                {(() => {
                                                                                    if (viewMode === 'site') {
                                                                                        // 현장별 보기 -> 상세는 팀
                                                                                        // Try lookup by ID or Name since targetId can be a Name now
                                                                                        return (
                                                                                            <span
                                                                                                className={`rounded-full flex items-center justify-center flex-shrink-0 ${isDetailSelected ? 'w-6 h-6' : 'w-4 h-4'}`}
                                                                                                style={{ backgroundColor: detailTeamColor }}
                                                                                            >
                                                                                                <FontAwesomeIcon icon={faUserGroup} className={`text-white ${isDetailSelected ? 'text-[10px]' : 'text-[7px]'}`} />
                                                                                            </span>
                                                                                        );
                                                                                    } else {
                                                                                        // 팀별 보기 -> 상세는 현장
                                                                                        const detailSite = sites.find(s => s.id === detail.targetId);
                                                                                        const siteComp = detailSite ? companies.find(c => c.id === detailSite.companyId) : null;
                                                                                        const siteColor = siteComp?.color || '#3b82f6';
                                                                                        return (
                                                                                            <span
                                                                                                className={`rounded-full flex items-center justify-center flex-shrink-0 ${isDetailSelected ? 'w-6 h-6' : 'w-4 h-4'}`}
                                                                                                style={{ backgroundColor: siteColor }}
                                                                                            >
                                                                                                <FontAwesomeIcon icon={faHardHat} className={`text-white ${isDetailSelected ? 'text-[10px]' : 'text-[7px]'}`} />
                                                                                            </span>
                                                                                        );
                                                                                    }
                                                                                })()}
                                                                                {detail.targetName}
                                                                            </div>

                                                                            {detailStatusBadges.length > 0 && (
                                                                                <div className="mt-1 flex flex-wrap items-center justify-center gap-1">
                                                                                    {detailStatusBadges.map((badge) => (
                                                                                        <span
                                                                                            key={badge.label}
                                                                                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold leading-none whitespace-nowrap ${badge.className}`}
                                                                                            style={badge.className.includes('orange') ? externalSupportBadgeStyle : undefined}
                                                                                        >
                                                                                            {badge.label}
                                                                                        </span>
                                                                                    ))}
                                                                                </div>
                                                                            )}

                                                                            <div
                                                                                className={`font-black transition-colors ${isDetailSelected ? 'text-3xl' : 'text-lg'}`}
                                                                                style={{ color: detailManDayColor }}
                                                                            >
                                                                                {(detail.manDay || 0).toFixed(1)}
                                                                            </div>
                                                                            {isDetailSelected && <span className="text-xs text-slate-400 mt-1 whitespace-nowrap">클릭하여 접기</span>}
                                                                        </div>

                                                                        {/* EXPANDED CONTENT: Worker List (Level 3) */}
                                                                        {isDetailSelected && (
                                                                            <div className="p-4 animate-fadeIn bg-slate-50/50">
                                                                                <div className="flex justify-between items-center mb-4">
                                                                                    <h4 className="text-sm font-bold text-slate-600 flex items-center gap-2 whitespace-nowrap">
                                                                                        <FontAwesomeIcon icon={faUsers} className="text-slate-400" />
                                                                                        작업자 상세 내역
                                                                                    </h4>
                                                                                    <span className="bg-white px-3 py-1 rounded-full border border-slate-200 text-xs font-bold text-slate-600 shadow-sm whitespace-nowrap">
                                                                                        총 {detail.workers?.length || 0}명
                                                                                    </span>
                                                                                </div>

                                                                                {/* Level 2 Formula Explanation */}
                                                                                <div className="flex items-center gap-2 mb-4 bg-white/60 p-2 rounded-lg border border-slate-200/60 text-xs text-slate-500">
                                                                                    <FontAwesomeIcon icon={faInfoCircle} className="text-slate-400 flex-shrink-0" />
                                                                                    <span>
                                                                                        <span className="font-bold text-slate-700 mr-1">산출 공식:</span>
                                                                                        선택된 기간동안 투입된 모든 작업자들의 개별 공수 합계
                                                                                    </span>
                                                                                </div>

                                                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 auto-rows-min grid-flow-row-dense">
                                                                                    {detail.workers && detail.workers.length > 0 ? (
                                                                                        detail.workers.map((worker, wIdx) => {
                                                                                            const isWorkerExpanded = expandedWorkers.has(`${item.id}-${detail.targetId}-${worker.workerName}`);
                                                                                            return (
                                                                                                <div
                                                                                                    key={wIdx}
                                                                                                    style={{ animationDelay: `${wIdx * 30}ms`, animationFillMode: 'forwards' }}
                                                                                                    className={`
                                                                                                rounded-xl overflow-hidden transition-all duration-300 border
                                                                                                ${isWorkerExpanded
                                                                                                            ? 'bg-white border-indigo-200 shadow-xl ring-2 ring-indigo-200 col-span-full z-10'
                                                                                                            : 'bg-white border-slate-200 hover:shadow-sm col-span-1'
                                                                                                        }
                                                                                            `}
                                                                                                >
                                                                                                    <div
                                                                                                        className={`p-3 flex justify-between items-center cursor-pointer hover:bg-slate-50 transition-colors ${isWorkerExpanded ? 'border-b border-indigo-50 p-4 bg-indigo-50/10' : ''}`}
                                                                                                        onClick={(e) => toggleWorker(`${item.id}-${detail.targetId}`, worker.workerName, e)}
                                                                                                    >
                                                                                                        <div className="flex items-center gap-2 min-w-0">
                                                                                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors flex-shrink-0 ${isWorkerExpanded ? 'bg-indigo-100 text-indigo-600 scale-110' : 'bg-slate-100 text-slate-500'}`}>
                                                                                                                {worker.workerName.charAt(0)}
                                                                                                            </div>
                                                                                                            <div className="min-w-0">
                                                                                                                <div className={`font-bold text-sm truncate whitespace-nowrap ${isWorkerExpanded ? 'text-indigo-900' : 'text-slate-800'}`}>{worker.workerName}</div>
                                                                                                                <div className="text-[10px] text-slate-400 whitespace-nowrap">
                                                                                                                    {worker.dailyLogs.length}일 출역
                                                                                                                </div>
                                                                                                            </div>
                                                                                                        </div>
                                                                                                        <div className="flex items-center gap-1.5 flex-shrink-0">
                                                                                                            <span className={`font-black tracking-tight whitespace-nowrap ${isWorkerExpanded ? 'text-indigo-600 text-xl' : 'text-indigo-600 text-lg'}`}>
                                                                                                                {(worker.manDay || 0).toFixed(1)}
                                                                                                            </span>
                                                                                                            <FontAwesomeIcon
                                                                                                                icon={isWorkerExpanded ? faChevronDown : faChevronRight}
                                                                                                                className={`text-xs transition-transform duration-300 ${isWorkerExpanded ? 'rotate-180 text-indigo-400' : 'text-slate-300'}`}
                                                                                                            />
                                                                                                        </div>
                                                                                                    </div>

                                                                                                    {isWorkerExpanded && (
                                                                                                        <div className="bg-slate-50 border-t border-indigo-100/30">
                                                                                                            {/* Level 3 Formula Explanation */}
                                                                                                            <div className="px-3 py-2 bg-indigo-50/30 border-b border-indigo-100/30 text-[10px] text-indigo-800 flex items-center gap-2">
                                                                                                                <FontAwesomeIcon icon={faInfoCircle} className="text-indigo-400 flex-shrink-0" />
                                                                                                                <span>
                                                                                                                    일별 출력 일보 공수 합계
                                                                                                                </span>
                                                                                                            </div>
                                                                                                            <div className="p-3 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                                                                                                                {worker.dailyLogs.map((log, lIdx) => (
                                                                                                                    <div
                                                                                                                        key={lIdx}
                                                                                                                        className="flex flex-col items-center justify-center p-2 bg-white border border-slate-100 rounded-lg shadow-sm hover:border-indigo-200 transition-colors"
                                                                                                                    >
                                                                                                                        <span className="text-slate-400 text-[10px] uppercase font-bold mb-0.5 tracking-wider whitespace-nowrap">{log.date}</span>
                                                                                                                        <span className="font-black text-indigo-600 text-base">{log.manDay.toFixed(1)}</span>
                                                                                                                    </div>
                                                                                                                ))}
                                                                                                            </div>
                                                                                                        </div>
                                                                                                    )}
                                                                                                </div>
                                                                                            );
                                                                                        })
                                                                                    ) : (
                                                                                        <div className="col-span-full py-8 text-center text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                                                                                            데이터가 없습니다.
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </motion.div>
                                                                );
                                                            })}
                                                    </motion.div>
                                                </div>

                                                {/* Close Button */}
                                                <div className="mt-8 flex justify-center">
                                                    <button
                                                        onClick={(e) => toggleAccordion(item.id, e)}
                                                        className="px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full text-sm font-bold transition-colors"
                                                    >
                                                        접기 <FontAwesomeIcon icon={faChevronDown} className="transform rotate-180 ml-2" />
                                                    </button>
                                                </div>

                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </motion.div>
                            );
                        })}
                    </div >
                ) : (

                    <div className="flex flex-col items-center justify-center h-full text-slate-400">
                        <FontAwesomeIcon icon={faChartBar} size="3x" className="mb-4 opacity-20" />
                        <p className="font-medium text-lg">
                            {viewMode === 'site' ? '진행 중인 현장이 없습니다.' : '등록된 팀이 없습니다.'}
                        </p>
                        <p className="text-sm mt-2">
                            {viewMode === 'site'
                                ? "현장 관리 메뉴에서 현장 상태를 '진행중'으로 변경해주세요."
                                : "팀 관리 메뉴에서 팀을 등록해주세요."}
                        </p>
                    </div>
                )
                }
            </div >
        </div >
    );
};

export default WhiteboardStatusBoard;
