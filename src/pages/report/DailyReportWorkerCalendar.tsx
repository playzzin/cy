import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faCalendarAlt,
    faChevronLeft,
    faChevronRight,
    faFilter,
    faRotateRight,
    faSearch,
    faSpinner,
} from '@fortawesome/free-solid-svg-icons';
import { dailyReportService, DailyReportWorkerRow } from '../../services/dailyReportService';
import {
    fieldScheduleRequestService,
    FieldScheduleRequest,
    isOffDutyOnlyFieldScheduleRequest,
} from '../../services/fieldScheduleRequestService';
import { siteService, Site } from '../../services/siteService';
import { teamService, Team } from '../../services/teamService';
import { resolveReportPayType } from '../../utils/payType';
import { normalizeTypedDateInput } from '../../utils/typedDateInput';

interface DailyReportWorkerCalendarProps {
    initialDate?: string;
    initialSiteId?: string;
}

type SelectOption = {
    value: string;
    label: string;
};

type WorkerColor = {
    base: string;
    bg: string;
    border: string;
    text: string;
};

type CalendarEntry = DailyReportWorkerRow & {
    entryKey: string;
    workerKey: string;
    workerTeamLabel: string;
    workerTeamColor: WorkerColor;
    responsibleTeamLabel: string;
    responsibleTeamColor: WorkerColor | null;
    salaryModelLabel: string;
};

type WorkerChecklistItem = {
    workerKey: string;
    workerId: string;
    workerName: string;
    workerTeamLabel: string;
    workerTeamColor: WorkerColor;
    salaryModelLabel: string;
    salaryModelSortRank: number;
    totalManDay: number;
    totalAmount: number;
    workDayCount: number;
    entryCount: number;
};

const WEEKDAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'];

const WORKER_COLORS: WorkerColor[] = [
    { base: '#2563eb', bg: '#dbeafe', border: '#60a5fa', text: '#1d4ed8' },
    { base: '#059669', bg: '#d1fae5', border: '#34d399', text: '#047857' },
    { base: '#d97706', bg: '#fef3c7', border: '#f59e0b', text: '#b45309' },
    { base: '#7c3aed', bg: '#ede9fe', border: '#a78bfa', text: '#6d28d9' },
    { base: '#dc2626', bg: '#fee2e2', border: '#f87171', text: '#b91c1c' },
    { base: '#0891b2', bg: '#cffafe', border: '#22d3ee', text: '#0e7490' },
    { base: '#c026d3', bg: '#fae8ff', border: '#e879f9', text: '#a21caf' },
    { base: '#4f46e5', bg: '#e0e7ff', border: '#818cf8', text: '#4338ca' },
];

const OFF_DUTY_DATE_COLOR: WorkerColor = {
    base: '#d97706',
    bg: '#fef3c7',
    border: '#f59e0b',
    text: '#92400e',
};

const formatYmd = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const formatMonth = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
};

const getMondayFirstWeekdayIndex = (date: Date): number => {
    return (date.getDay() + 6) % 7;
};

const getWeekdayLabel = (date: Date): string => {
    return WEEKDAY_LABELS[getMondayFirstWeekdayIndex(date)];
};

const normalizeMonth = (value?: string | null): string | null => {
    const text = String(value ?? '').trim();
    if (/^\d{4}-\d{2}$/.test(text)) return text;

    const normalizedDate = normalizeTypedDateInput(text);
    return normalizedDate ? normalizedDate.slice(0, 7) : null;
};

const getMonthRange = (month: string): { startDate: string; endDate: string } => {
    const [yearText, monthText] = month.split('-');
    const year = Number(yearText);
    const monthIndex = Number(monthText) - 1;
    return {
        startDate: formatYmd(new Date(year, monthIndex, 1)),
        endDate: formatYmd(new Date(year, monthIndex + 1, 0)),
    };
};

const getMonthWeeks = (month: string): Date[][] => {
    const [yearText, monthText] = month.split('-');
    const year = Number(yearText);
    const monthIndex = Number(monthText) - 1;
    const monthStart = new Date(year, monthIndex, 1);
    const monthEnd = new Date(year, monthIndex + 1, 0);
    const gridStart = new Date(monthStart);
    gridStart.setDate(monthStart.getDate() - getMondayFirstWeekdayIndex(monthStart));
    const gridEnd = new Date(monthEnd);
    gridEnd.setDate(monthEnd.getDate() + (6 - getMondayFirstWeekdayIndex(monthEnd)));

    const weeks: Date[][] = [];
    let cursor = new Date(gridStart);
    while (cursor <= gridEnd) {
        const week: Date[] = [];
        for (let index = 0; index < 7; index += 1) {
            week.push(new Date(cursor));
            cursor.setDate(cursor.getDate() + 1);
        }
        weeks.push(week);
    }
    return weeks;
};

const addMonths = (month: string, offset: number): string => {
    const [yearText, monthText] = month.split('-');
    const date = new Date(Number(yearText), Number(monthText) - 1 + offset, 1);
    return formatMonth(date);
};

const compareKo = (a: string, b: string): number => a.localeCompare(b, 'ko');

const getWeekdayHeaderClassName = (index: number): string => {
    if (index === 5) return 'border-blue-500 bg-blue-700';
    if (index === 6) return 'border-red-500 bg-red-700';
    return 'border-slate-700 bg-slate-900';
};

const normalizeTextKey = (value?: string | null): string => {
    return String(value ?? '').trim().replace(/\s+/g, '').toLowerCase();
};

const TEAM_COLOR_OVERRIDES: Record<string, string> = {
    [normalizeTextKey('김동혁팀')]: '#ca8a04',
};

const getPayTypeSortRank = (value?: string | null): number => {
    const normalized = normalizeTextKey(value);
    if (normalized.includes('월급')) return 0;
    if (normalized.includes('일급')) return 1;
    if (normalized.includes('용역')) return 2;
    return 99;
};

const getSortLabel = (value?: string | null): string => {
    const text = String(value ?? '').trim();
    return text && text !== '-' ? text : '';
};

const compareNullableKo = (a?: string | null, b?: string | null): number => {
    const left = getSortLabel(a);
    const right = getSortLabel(b);
    if (left && !right) return -1;
    if (!left && right) return 1;
    return compareKo(left, right);
};

const compareCalendarEntries = (a: CalendarEntry, b: CalendarEntry): number => {
    const teamDiff = compareNullableKo(a.workerTeamLabel, b.workerTeamLabel);
    if (teamDiff !== 0) return teamDiff;

    const nameDiff = compareNullableKo(a.workerName, b.workerName);
    if (nameDiff !== 0) return nameDiff;

    const payTypeDiff = getPayTypeSortRank(a.salaryModelLabel) - getPayTypeSortRank(b.salaryModelLabel);
    if (payTypeDiff !== 0) return payTypeDiff;

    const siteDiff = compareNullableKo(a.siteName, b.siteName);
    if (siteDiff !== 0) return siteDiff;

    return 0;
};

const compareWorkerChecklistItems = (a: WorkerChecklistItem, b: WorkerChecklistItem): number => {
    const teamDiff = compareNullableKo(a.workerTeamLabel, b.workerTeamLabel);
    if (teamDiff !== 0) return teamDiff;

    const nameDiff = compareNullableKo(a.workerName, b.workerName);
    if (nameDiff !== 0) return nameDiff;

    const payTypeDiff = a.salaryModelSortRank - b.salaryModelSortRank;
    if (payTypeDiff !== 0) return payTypeDiff;

    return compareNullableKo(a.salaryModelLabel, b.salaryModelLabel);
};

const formatManDay = (value: number): string => {
    return (Number.isFinite(value) ? value : 0).toFixed(1);
};

const formatCurrency = (value: number): string => {
    const amount = Number.isFinite(value) ? value : 0;
    return new Intl.NumberFormat('ko-KR').format(amount);
};

const toLabel = (value?: string | null, fallback = '-'): string => {
    const text = String(value ?? '').trim();
    return text || fallback;
};

const buildNameOptionValue = (prefix: string, name?: string | null): string => {
    return `${prefix}:${normalizeTextKey(name)}`;
};

const buildWorkerColor = (baseColor?: string | null, fallback: WorkerColor = WORKER_COLORS[0]): WorkerColor => {
    const base = String(baseColor ?? '').trim();
    if (!base) return fallback;

    return {
        base,
        bg: `color-mix(in srgb, ${base} 14%, white)`,
        border: `color-mix(in srgb, ${base} 45%, white)`,
        text: `color-mix(in srgb, ${base} 90%, black)`,
    };
};

const DailyReportWorkerCalendar: React.FC<DailyReportWorkerCalendarProps> = ({ initialDate, initialSiteId }) => {
    const [searchParams] = useSearchParams();
    const todayMonth = formatMonth(new Date());
    const initialMonth = normalizeMonth(searchParams.get('month'))
        ?? normalizeMonth(searchParams.get('date'))
        ?? normalizeMonth(initialDate)
        ?? todayMonth;

    const [selectedMonth, setSelectedMonth] = useState(initialMonth);
    const [selectedSiteId, setSelectedSiteId] = useState(
        searchParams.get('siteId') ?? initialSiteId ?? ''
    );
    const [selectedWorkerTeam, setSelectedWorkerTeam] = useState(searchParams.get('workerTeamId') ?? '');
    const [selectedSalaryModel, setSelectedSalaryModel] = useState(searchParams.get('salaryModel') ?? '');
    const [workerSearch, setWorkerSearch] = useState(searchParams.get('q') ?? searchParams.get('workerSearch') ?? '');
    const requestedWorkerId = String(searchParams.get('workerId') ?? '').trim();
    const requestedWorkerName = normalizeTextKey(searchParams.get('workerName'));
    const [rows, setRows] = useState<DailyReportWorkerRow[]>([]);
    const [offDutyRequests, setOffDutyRequests] = useState<FieldScheduleRequest[]>([]);
    const [sites, setSites] = useState<Site[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [selectedWorkerKeys, setSelectedWorkerKeys] = useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState(false);
    const [loadMessage, setLoadMessage] = useState('');

    const { startDate, endDate } = useMemo(() => getMonthRange(selectedMonth), [selectedMonth]);
    const weeks = useMemo(() => getMonthWeeks(selectedMonth), [selectedMonth]);
    const selectedMonthNumber = Number(selectedMonth.slice(5, 7));

    const teamLookup = useMemo(() => {
        const map = new Map<string, Team>();
        teams.forEach((team) => {
            const id = String(team.id ?? '').trim();
            const legacyId = String(team.legacyId ?? '').trim();
            if (id) map.set(id, team);
            if (legacyId) map.set(legacyId, team);
        });
        return map;
    }, [teams]);

    const teamNameLookup = useMemo(() => {
        const map = new Map<string, Team>();
        teams.forEach((team) => {
            const name = normalizeTextKey(team.name);
            if (name && !map.has(name)) map.set(name, team);
        });
        return map;
    }, [teams]);

    const resolveTeamLabel = useCallback((teamId?: string | null, teamName?: string | null): string => {
        const explicitName = String(teamName ?? '').trim();
        if (explicitName) return explicitName;

        const id = String(teamId ?? '').trim();
        return id ? String(teamLookup.get(id)?.name ?? '').trim() : '';
    }, [teamLookup]);

    const resolveTeamColor = useCallback((teamId?: string | null, teamName?: string | null): WorkerColor => {
        const id = String(teamId ?? '').trim();
        const nameKey = normalizeTextKey(teamName);
        const team = (id ? teamLookup.get(id) : undefined) ?? (nameKey ? teamNameLookup.get(nameKey) : undefined);
        return buildWorkerColor(TEAM_COLOR_OVERRIDES[nameKey] ?? team?.color);
    }, [teamLookup, teamNameLookup]);

    const getWorkerTeamLabel = useCallback((row: DailyReportWorkerRow): string => {
        return resolveTeamLabel(row.workerTeamId, row.workerTeamName);
    }, [resolveTeamLabel]);

    const getWorkerKey = useCallback((row: DailyReportWorkerRow): string => {
        const workerId = String(row.workerId ?? '').trim();
        if (workerId && !workerId.startsWith('unknown')) return workerId;
        return `${normalizeTextKey(row.workerName)}:${normalizeTextKey(getWorkerTeamLabel(row))}`;
    }, [getWorkerTeamLabel]);

    const getSiteOptionValue = useCallback((row: DailyReportWorkerRow): string => {
        const siteId = String(row.siteId ?? '').trim();
        return siteId || buildNameOptionValue('site', row.siteName);
    }, []);

    const getWorkerTeamOptionValue = useCallback((row: DailyReportWorkerRow): string => {
        const teamId = String(row.workerTeamId ?? '').trim();
        return teamId || buildNameOptionValue('worker-team', getWorkerTeamLabel(row));
    }, [getWorkerTeamLabel]);

    const buildEntry = useCallback((row: DailyReportWorkerRow): CalendarEntry => {
        const workerIndex = typeof row.workerIndex === 'number' ? row.workerIndex : 'none';
        const workerKey = getWorkerKey(row);
        const workerTeamLabel = toLabel(getWorkerTeamLabel(row));
        const resolvedResponsibleTeamLabel = resolveTeamLabel(row.responsibleTeamId, row.responsibleTeamName);
        const responsibleTeamLabel = toLabel(resolvedResponsibleTeamLabel);
        const responsibleTeamColor = row.responsibleTeamId || resolvedResponsibleTeamLabel
            ? resolveTeamColor(row.responsibleTeamId, resolvedResponsibleTeamLabel)
            : null;
        return {
            ...row,
            workerKey,
            entryKey: `${row.reportId}:${row.workerId}:${workerIndex}:${row.date}`,
            workerTeamLabel,
            workerTeamColor: resolveTeamColor(row.workerTeamId, workerTeamLabel),
            responsibleTeamLabel,
            responsibleTeamColor,
            salaryModelLabel: toLabel(resolveReportPayType(row)),
        };
    }, [getWorkerKey, getWorkerTeamLabel, resolveTeamColor, resolveTeamLabel]);

    const fetchRows = useCallback(async () => {
        setLoadMessage('개인별 달력 데이터를 불러오는 중');
        setIsLoading(true);
        try {
            const [data, requestData] = await Promise.all([
                dailyReportService.getReportWorkerRowsByRange({ startDate, endDate }),
                fieldScheduleRequestService.listByDateRange(startDate, endDate),
            ]);
            setRows(data.filter((row) => !row.isEmptyReport));
            setOffDutyRequests(requestData.filter((request) =>
                request.status !== 'cancelled' && isOffDutyOnlyFieldScheduleRequest(request)
            ));
        } catch (error) {
            console.error('[DailyReportWorkerCalendar] Failed to fetch rows', error);
            setRows([]);
            setOffDutyRequests([]);
        } finally {
            setIsLoading(false);
            setLoadMessage('');
        }
    }, [endDate, startDate]);

    useEffect(() => {
        (async () => {
            try {
                const [sitesData, teamsData] = await Promise.all([
                    siteService.getSites(),
                    teamService.getTeams(),
                ]);
                setSites(sitesData);
                setTeams(teamsData);
            } catch (error) {
                console.error('[DailyReportWorkerCalendar] Failed to fetch master data', error);
            }
        })();
    }, []);

    useEffect(() => {
        void fetchRows();
    }, [fetchRows]);

    const handleMonthMove = useCallback((offset: number) => {
        setSelectedMonth((prev) => addMonths(prev, offset));
        setSelectedWorkerKeys(new Set());
    }, []);

    const handleResetFilters = useCallback(() => {
        setSelectedSiteId('');
        setSelectedWorkerTeam('');
        setSelectedSalaryModel('');
        setWorkerSearch('');
        setSelectedWorkerKeys(new Set());
    }, []);

    const siteOptions = useMemo<SelectOption[]>(() => {
        const optionMap = new Map<string, string>();

        sites.forEach((site) => {
            const id = String(site.id ?? site.legacyId ?? '').trim();
            const name = String(site.name ?? '').trim();
            if (id && name) optionMap.set(id, name);
        });

        rows.forEach((row) => {
            const value = getSiteOptionValue(row);
            const label = String(row.siteName ?? '').trim();
            if (value && label && !optionMap.has(value)) optionMap.set(value, label);
        });

        return Array.from(optionMap, ([value, label]) => ({ value, label }))
            .sort((a, b) => compareKo(a.label, b.label));
    }, [getSiteOptionValue, rows, sites]);

    const workerTeamOptions = useMemo<SelectOption[]>(() => {
        const optionMap = new Map<string, string>();

        rows.forEach((row) => {
            const value = getWorkerTeamOptionValue(row);
            const label = getWorkerTeamLabel(row);
            if (value && label && !optionMap.has(value)) optionMap.set(value, label);
        });

        return Array.from(optionMap, ([value, label]) => ({ value, label }))
            .sort((a, b) => compareKo(a.label, b.label));
    }, [getWorkerTeamLabel, getWorkerTeamOptionValue, rows]);

    const salaryModelOptions = useMemo<SelectOption[]>(() => {
        const values = new Set<string>();
        rows.forEach((row) => {
            const value = resolveReportPayType(row);
            if (value) values.add(value);
        });
        return Array.from(values).sort(compareKo).map((value) => ({ value, label: value }));
    }, [rows]);

    const filteredRows = useMemo(() => {
        const normalizedSearch = workerSearch.trim().toLowerCase();

        return rows.filter((row) => {
            if (selectedSiteId) {
                const selectedSiteName = siteOptions.find((option) => option.value === selectedSiteId)?.label ?? '';
                const selectedSiteNameKey = normalizeTextKey(selectedSiteName);
                const rowSiteKey = normalizeTextKey(row.siteName);
                const matchesSite = getSiteOptionValue(row) === selectedSiteId
                    || String(row.siteId ?? '') === selectedSiteId
                    || (!!selectedSiteNameKey && rowSiteKey === selectedSiteNameKey);
                if (!matchesSite) return false;
            }

            if (selectedWorkerTeam && getWorkerTeamOptionValue(row) !== selectedWorkerTeam) {
                return false;
            }

            if (selectedSalaryModel && resolveReportPayType(row) !== selectedSalaryModel) {
                return false;
            }

            if (normalizedSearch && !String(row.workerName ?? '').toLowerCase().includes(normalizedSearch)) {
                return false;
            }

            return true;
        });
    }, [
        getSiteOptionValue,
        getWorkerTeamOptionValue,
        rows,
        selectedSalaryModel,
        selectedSiteId,
        selectedWorkerTeam,
        siteOptions,
        workerSearch,
    ]);

    const entries = useMemo(() => {
        return filteredRows.map(buildEntry).sort(compareCalendarEntries);
    }, [buildEntry, filteredRows]);

    const selectedWorkerKey = useMemo(
        () => Array.from(selectedWorkerKeys)[0] ?? '',
        [selectedWorkerKeys]
    );

    const displayEntries = useMemo(() => {
        return selectedWorkerKey ? entries.filter((entry) => entry.workerKey === selectedWorkerKey) : [];
    }, [entries, selectedWorkerKey]);

    const entriesByDate = useMemo(() => {
        const map = new Map<string, CalendarEntry[]>();
        displayEntries.forEach((entry) => {
            const dateEntries = map.get(entry.date) ?? [];
            dateEntries.push(entry);
            map.set(entry.date, dateEntries);
        });

        map.forEach((dateEntries) => {
            dateEntries.sort(compareCalendarEntries);
        });

        return map;
    }, [displayEntries]);

    const workerChecklist = useMemo<WorkerChecklistItem[]>(() => {
        const workerMap = new Map<string, WorkerChecklistItem & { dateSet: Set<string> }>();

        entries.forEach((entry) => {
            const current = workerMap.get(entry.workerKey) ?? {
                workerKey: entry.workerKey,
                workerId: String(entry.workerId ?? ''),
                workerName: String(entry.workerName ?? '').trim() || '이름 없음',
                workerTeamLabel: toLabel(entry.workerTeamLabel),
                workerTeamColor: entry.workerTeamColor,
                salaryModelLabel: toLabel(entry.salaryModelLabel),
                salaryModelSortRank: getPayTypeSortRank(entry.salaryModelLabel),
                totalManDay: 0,
                totalAmount: 0,
                workDayCount: 0,
                entryCount: 0,
                dateSet: new Set<string>(),
            };
            const entryPayTypeSortRank = getPayTypeSortRank(entry.salaryModelLabel);
            if (entryPayTypeSortRank < current.salaryModelSortRank) {
                current.salaryModelLabel = toLabel(entry.salaryModelLabel);
                current.salaryModelSortRank = entryPayTypeSortRank;
            }
            current.totalManDay += Number.isFinite(entry.manDay) ? entry.manDay : 0;
            current.totalAmount += Number.isFinite(entry.amount) ? entry.amount : 0;
            current.entryCount += 1;
            current.dateSet.add(entry.date);
            current.workDayCount = current.dateSet.size;
            workerMap.set(entry.workerKey, current);
        });

        return Array.from(workerMap.values())
            .map(({ dateSet: _dateSet, ...item }) => item)
            .sort(compareWorkerChecklistItems);
    }, [entries]);

    useEffect(() => {
        setSelectedWorkerKeys((previous) => {
            const selectedKey = Array.from(previous)[0];
            if (!selectedKey || workerChecklist.some((worker) => worker.workerKey === selectedKey)) {
                return previous;
            }
            return new Set();
        });
    }, [workerChecklist]);

    useEffect(() => {
        if (!requestedWorkerId && !requestedWorkerName) return;

        const requestedWorker = (
            requestedWorkerId
                ? workerChecklist.find((worker) => worker.workerId === requestedWorkerId)
                : undefined
        ) ?? (
            requestedWorkerName
                ? workerChecklist.find((worker) => normalizeTextKey(worker.workerName) === requestedWorkerName)
                : undefined
        );
        if (!requestedWorker) return;

        const requestedEntry = entries.find((entry) => entry.workerKey === requestedWorker.workerKey);
        const requestedTeam = requestedEntry ? getWorkerTeamOptionValue(requestedEntry) : '';

        if (requestedTeam) {
            setSelectedWorkerTeam((current) => current === requestedTeam ? current : requestedTeam);
        }
        setSelectedWorkerKeys((current) => (
            current.size === 1 && current.has(requestedWorker.workerKey)
                ? current
                : new Set([requestedWorker.workerKey])
        ));
    }, [entries, getWorkerTeamOptionValue, requestedWorkerId, requestedWorkerName, workerChecklist]);

    const offDutyDateSet = useMemo(() => {
        const selectedWorker = workerChecklist.find((worker) => worker.workerKey === selectedWorkerKey);
        if (!selectedWorker) return new Set<string>();

        const workerId = String(selectedWorker.workerId ?? '').trim();
        const workerNameKey = normalizeTextKey(selectedWorker.workerName);
        const isMatchingWorker = (request: FieldScheduleRequest) =>
            (workerId && request.offDutyWorkerIds.includes(workerId))
            || request.offDutyWorkerNames.some((name) => normalizeTextKey(name) === workerNameKey);

        return new Set(
            offDutyRequests
                .filter(isMatchingWorker)
                .map((request) => request.date)
        );
    }, [offDutyRequests, selectedWorkerKey, workerChecklist]);

    const totals = useMemo(() => {
        const totalManDay = displayEntries.reduce((sum, entry) => {
            return sum + (Number.isFinite(entry.manDay) ? entry.manDay : 0);
        }, 0);
        const totalAmount = displayEntries.reduce((sum, entry) => {
            return sum + (Number.isFinite(entry.amount) ? entry.amount : 0);
        }, 0);
        const workDateCount = new Set(displayEntries.map((entry) => entry.date)).size;
        const workerCount = new Set(displayEntries.map((entry) => entry.workerKey)).size;

        return {
            workerCount,
            entryCount: displayEntries.length,
            totalManDay,
            totalAmount,
            workDateCount,
        };
    }, [displayEntries]);

    const activeFilterCount = [
        selectedSiteId,
        selectedSalaryModel,
        workerSearch.trim(),
    ].filter(Boolean).length;

    const toggleWorker = useCallback((workerKey: string) => {
        setSelectedWorkerKeys((prev) => {
            return prev.has(workerKey) ? new Set() : new Set([workerKey]);
        });
    }, []);

    const handleClearSelectedWorkers = useCallback(() => {
        setSelectedWorkerKeys(new Set());
    }, []);

    const handleWorkerTeamChange = useCallback((teamId: string) => {
        setSelectedWorkerTeam(teamId);
        setSelectedWorkerKeys(new Set());
    }, []);

    const renderEntry = (entry: CalendarEntry) => {
        return (
            <div
                key={entry.entryKey}
                className="rounded-md border border-l-4 border-slate-200 bg-white px-2 py-1.5 text-[11px] shadow-sm"
                style={{ borderLeftColor: entry.responsibleTeamColor?.base }}
                title={[
                    `작업자: ${entry.workerName || '-'}`,
                    `현장: ${entry.siteName || '-'}`,
                    `공수: ${formatManDay(entry.manDay)}`,
                    entry.salaryModelLabel,
                    `단가: ${formatCurrency(entry.unitPrice)}원`,
                    `금액: ${formatCurrency(entry.amount)}원`,
                    `현장담당: ${entry.responsibleTeamLabel}`,
                    `소속팀: ${entry.workerTeamLabel}`,
                ].join('\n')}
            >
                <div className="flex items-start gap-1">
                    <span className="min-w-0 flex-1 truncate font-bold text-slate-900">
                        {entry.workerName || '-'}
                    </span>
                    <span
                        className="max-w-[88px] flex-shrink-0 truncate rounded border px-1.5 py-0.5 text-[10px] font-bold"
                        style={{
                            backgroundColor: entry.workerTeamColor.bg,
                            borderColor: entry.workerTeamColor.border,
                            color: entry.workerTeamColor.text,
                        }}
                    >
                        {entry.workerTeamLabel}
                    </span>
                    <span className="max-w-[104px] truncate rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                        {entry.salaryModelLabel}
                    </span>
                </div>
                <div
                    className="mt-1 truncate rounded border border-slate-200 bg-slate-50 px-1.5 py-1 font-bold text-slate-800"
                    style={entry.responsibleTeamColor ? {
                        backgroundColor: entry.responsibleTeamColor.bg,
                        borderColor: entry.responsibleTeamColor.border,
                        color: entry.responsibleTeamColor.text,
                    } : undefined}
                >
                    {entry.siteName || '-'}
                </div>
                <div className="mt-1 grid grid-cols-2 gap-1 text-[9px] font-semibold text-slate-600">
                    <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">
                        {formatManDay(entry.manDay)}공수
                    </span>
                    <span className="truncate rounded bg-slate-100 px-1.5 py-0.5 text-right">
                        단가 {formatCurrency(entry.unitPrice)}원
                    </span>
                </div>
                <div className="mt-1 truncate text-[10px] font-bold text-emerald-700">
                    금액 {formatCurrency(entry.amount)}원
                </div>
                <div
                    className="mt-1 flex min-w-0 items-center gap-1 truncate text-[10px] font-semibold text-slate-600"
                    style={{ color: entry.responsibleTeamColor?.text }}
                >
                    {entry.responsibleTeamColor && (
                        <span
                            className="h-2 w-2 flex-shrink-0 rounded-full"
                            style={{ backgroundColor: entry.responsibleTeamColor.base }}
                        />
                    )}
                    현장담당 {entry.responsibleTeamLabel}
                </div>
            </div>
        );
    };

    const renderDayCell = (day: Date) => {
        const ymd = formatYmd(day);
        const isCurrentMonth = day.getMonth() + 1 === selectedMonthNumber;
        const weekdayIndex = getMondayFirstWeekdayIndex(day);
        const isSaturday = day.getDay() === 6;
        const isSunday = day.getDay() === 0;
        const dayEntries = entriesByDate.get(ymd) ?? [];
        const isOffDuty = isCurrentMonth && offDutyDateSet.has(ymd);
        const highlightColor = isOffDuty ? OFF_DUTY_DATE_COLOR : null;
        const defaultBackgroundColor = isCurrentMonth
            ? (isSaturday ? '#eff6ff' : isSunday ? '#fef2f2' : '#ffffff')
            : (isSaturday ? '#dbeafe' : isSunday ? '#fee2e2' : '#f8fafc');
        const dayNumberClassName = isCurrentMonth
            ? (isSaturday ? 'text-blue-700' : isSunday ? 'text-red-700' : 'text-slate-900')
            : (isSaturday ? 'text-blue-300' : isSunday ? 'text-red-300' : 'text-slate-400');
        const weekdayClassName = isSaturday
            ? 'text-blue-500'
            : isSunday ? 'text-red-500' : 'text-slate-400';
        const borderColor = highlightColor
            ? highlightColor.border
            : (weekdayIndex === 5 ? '#bfdbfe' : weekdayIndex === 6 ? '#fecaca' : undefined);
        return (
            <div
                key={ymd}
                className="min-h-[198px] border-r border-b p-2 align-top transition-colors"
                style={{
                    backgroundColor: highlightColor ? highlightColor.bg : defaultBackgroundColor,
                    borderColor,
                    boxShadow: highlightColor ? `inset 0 0 0 1px ${highlightColor.border}` : undefined,
                }}
            >
                <div className="mb-2 flex flex-col items-stretch gap-2">
                    <div>
                        <div className={`text-sm font-black ${dayNumberClassName}`}>
                            {day.getDate()}일
                        </div>
                        <div className={`text-[10px] font-bold ${weekdayClassName}`}>{getWeekdayLabel(day)}</div>
                    </div>
                    {isOffDuty && (
                        <span className="w-fit rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-black text-amber-900">
                            휴무
                        </span>
                    )}
                </div>

                {dayEntries.length > 0 ? (
                    <div className="space-y-1.5">
                        {dayEntries.slice(0, 5).map(renderEntry)}
                        {dayEntries.length > 5 && (
                            <div className="rounded-md bg-slate-100 px-2 py-1 text-center text-[11px] font-bold text-slate-500">
                                +{dayEntries.length - 5}건
                            </div>
                        )}
                    </div>
                ) : (
                    isCurrentMonth ? <div className="h-20 rounded-md bg-slate-50/70" /> : null
                )}
            </div>
        );
    };

    return (
        <div className="flex h-full min-h-0 flex-col gap-3">
            {loadMessage && (
                <div className="flex flex-shrink-0 items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700" role="status" aria-live="polite">
                    <FontAwesomeIcon icon={faSpinner} spin />
                    <span>{loadMessage}</span>
                </div>
            )}

            <div className="flex flex-shrink-0 flex-col gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={() => handleMonthMove(-1)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50"
                        title="이전 달"
                        aria-label="이전 달"
                    >
                        <FontAwesomeIcon icon={faChevronLeft} />
                    </button>
                    <div className="relative">
                        <FontAwesomeIcon icon={faCalendarAlt} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="month"
                            value={selectedMonth}
                            onChange={(event) => {
                                setSelectedMonth(event.target.value || todayMonth);
                                setSelectedWorkerKeys(new Set());
                            }}
                            className="h-9 rounded-lg border-slate-300 pl-10 pr-3 text-sm font-semibold text-slate-700"
                            aria-label="조회 월"
                            title="조회 월"
                        />
                    </div>
                    <button
                        type="button"
                        onClick={() => handleMonthMove(1)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50"
                        title="다음 달"
                        aria-label="다음 달"
                    >
                        <FontAwesomeIcon icon={faChevronRight} />
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setSelectedMonth(todayMonth);
                            setSelectedWorkerKeys(new Set());
                        }}
                        className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-600 hover:bg-slate-100"
                        title="이번 달로 이동"
                    >
                        이번 달
                    </button>
                    <div className="mx-1 hidden h-6 w-px bg-slate-200 md:block" />
                    <select
                        value={selectedSiteId}
                        onChange={(event) => setSelectedSiteId(event.target.value)}
                        className="h-9 min-w-[150px] rounded-lg border-slate-300 px-3 text-sm"
                        aria-label="현장 필터"
                        title="현장 필터"
                    >
                        <option value="">전체 현장</option>
                        {siteOptions.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </select>
                    <select
                        value={selectedSalaryModel}
                        onChange={(event) => setSelectedSalaryModel(event.target.value)}
                        className="h-9 min-w-[130px] rounded-lg border-slate-300 px-3 text-sm"
                        aria-label="급여방식 필터"
                        title="급여방식 필터"
                    >
                        <option value="">전체 급여방식</option>
                        {salaryModelOptions.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </select>
                    <div className="relative min-w-[180px] flex-1">
                        <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={workerSearch}
                            onChange={(event) => setWorkerSearch(event.target.value)}
                            placeholder="작업자 검색"
                            className="h-9 w-full rounded-lg border-slate-300 pl-9 pr-3 text-sm"
                            aria-label="작업자 이름 검색"
                            title="작업자 이름 검색"
                        />
                    </div>
                    <button
                        type="button"
                        onClick={handleResetFilters}
                        disabled={activeFilterCount === 0 && selectedWorkerKeys.size === 0}
                        className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-bold shadow-sm ${
                            activeFilterCount > 0 || selectedWorkerKeys.size > 0
                                ? 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                : 'border-slate-200 bg-slate-100 text-slate-400'
                        }`}
                        title="필터 초기화"
                    >
                        <FontAwesomeIcon icon={faRotateRight} />
                        초기화
                    </button>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full bg-slate-900 px-3 py-1.5 font-bold text-white">
                        {startDate} ~ {endDate}
                    </span>
                    <span className="rounded-full bg-blue-50 px-3 py-1.5 font-semibold text-blue-700">
                        {selectedWorkerKey ? `작업자 ${totals.workerCount}명` : '작업자 선택 필요'}
                    </span>
                    <span className="rounded-full bg-emerald-50 px-3 py-1.5 font-semibold text-emerald-700">
                        총 {formatManDay(totals.totalManDay)}공수
                    </span>
                    <span className="rounded-full bg-amber-50 px-3 py-1.5 font-semibold text-amber-700">
                        입력 {totals.entryCount}건
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1.5 font-semibold text-slate-600">
                        근무일 {totals.workDateCount}일
                    </span>
                    {activeFilterCount > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-3 py-1.5 font-semibold text-indigo-700">
                            <FontAwesomeIcon icon={faFilter} />
                            필터 {activeFilterCount}개
                        </span>
                    )}
                    {selectedWorkerKeys.size > 0 && (
                        <span className="rounded-full bg-blue-100 px-3 py-1.5 font-semibold text-blue-800">
                            선택 {totals.workerCount}명 표시
                        </span>
                    )}
                </div>
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[260px_minmax(0,1fr)]">
                <aside className="min-h-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-200 px-3 py-3">
                        <div className="text-sm font-black text-slate-900">작업자 선택</div>
                        <p className="mt-1 text-xs font-medium text-slate-500">팀을 먼저 선택한 뒤 작업자 1명을 선택하세요.</p>
                        <select
                            value={selectedWorkerTeam}
                            onChange={(event) => handleWorkerTeamChange(event.target.value)}
                            className="mt-3 h-9 w-full rounded-lg border-slate-300 bg-slate-50 px-3 text-sm font-semibold text-slate-700"
                            aria-label="작업자 팀 선택"
                            title="작업자 팀 선택"
                        >
                            <option value="">팀 선택</option>
                            {workerTeamOptions.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                        <button
                            type="button"
                            onClick={handleClearSelectedWorkers}
                            disabled={!selectedWorkerKey}
                            className="mt-2 h-8 w-full rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400"
                        >
                            선택 해제
                        </button>
                    </div>
                    <div className="h-full min-h-0 overflow-auto px-2 py-2">
                        {!selectedWorkerTeam ? (
                            <div className="px-2 py-10 text-center text-sm font-semibold text-slate-400">
                                먼저 팀을 선택하세요
                            </div>
                        ) : workerChecklist.length === 0 ? (
                            <div className="px-2 py-10 text-center text-sm font-semibold text-slate-400">
                                작업자 없음
                            </div>
                        ) : (
                            <div className="space-y-1.5 pb-20">
                                {workerChecklist.map((worker) => {
                                    const checked = selectedWorkerKeys.has(worker.workerKey);
                                    const color = worker.workerTeamColor;
                                    return (
                                        <label
                                            key={worker.workerKey}
                                            className="flex cursor-pointer items-start gap-2 rounded-lg border px-2.5 py-2 transition-colors"
                                            style={{
                                                borderColor: checked ? color.border : '#e2e8f0',
                                                backgroundColor: checked ? color.bg : '#ffffff',
                                            }}
                                        >
                                            <input
                                                type="radio"
                                                name="daily-report-calendar-worker"
                                                checked={checked}
                                                onChange={() => toggleWorker(worker.workerKey)}
                                                className="mt-1 h-4 w-4 border-slate-300"
                                                style={{ accentColor: color.base }}
                                            />
                                            <span className="mt-1 h-3 w-3 flex-shrink-0 rounded-full" style={{ backgroundColor: color.base }} />
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-sm font-bold text-slate-900">{worker.workerName}</span>
                                                <span className="mt-1 flex min-w-0 items-center gap-1 text-[11px] font-bold text-slate-500">
                                                    <span className="min-w-0 truncate">
                                                        {formatManDay(worker.totalManDay)}공수 · {worker.workDayCount}일 · {worker.entryCount}건 · {formatCurrency(worker.totalAmount)}원
                                                    </span>
                                                    <span className="flex-shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                                                        {worker.salaryModelLabel}
                                                    </span>
                                                </span>
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </aside>

                <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                    <div className="min-h-0 flex-1 overflow-hidden">
                        {isLoading ? (
                            <div className="flex h-full min-h-64 flex-col items-center justify-center text-slate-400">
                                <FontAwesomeIcon icon={faSpinner} spin className="mb-3 text-2xl text-blue-500" />
                                <span className="text-sm font-semibold">불러오는 중...</span>
                            </div>
                        ) : displayEntries.length === 0 ? (
                            <div className="flex h-full min-h-64 flex-col items-center justify-center gap-3 px-4 text-center">
                                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                                    <FontAwesomeIcon icon={faCalendarAlt} />
                                </div>
                                <div>
                                    <h2 className="text-base font-bold text-slate-800">
                                        {selectedWorkerKeys.size > 0 ? '선택한 작업자의 출력일보가 없습니다' : '좌측에서 작업자를 선택하세요'}
                                    </h2>
                                    <p className="mt-1 text-sm text-slate-500">
                                        {selectedWorkerKeys.size > 0 ? '현장 또는 급여방식 필터를 조정해서 다시 확인하세요.' : '작업자를 선택하면 달력에 바로 표시됩니다.'}
                                    </p>
                                </div>
                                {(activeFilterCount > 0 || selectedWorkerKeys.size > 0) && (
                                    <button
                                        type="button"
                                        onClick={handleResetFilters}
                                        className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                                    >
                                        필터/선택 초기화
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="h-full overflow-auto">
                                <div className="min-w-[980px]">
                                    <div className="grid grid-cols-7 border-b border-slate-200 text-center text-xs font-black text-white">
                                        {WEEKDAY_LABELS.map((weekday, index) => (
                                            <div
                                                key={weekday}
                                                className={`px-3 py-3 ${getWeekdayHeaderClassName(index)} ${index < 6 ? 'border-r' : ''}`}
                                            >
                                                {weekday}
                                            </div>
                                        ))}
                                    </div>
                                    <div className="grid grid-cols-7">
                                        {weeks.flatMap((week) => week.map(renderDayCell))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <footer
                        data-testid="daily-worker-calendar-summary"
                        className="flex flex-shrink-0 flex-col gap-3 border-t border-slate-700 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 px-4 py-3 text-white sm:flex-row sm:items-center sm:justify-between sm:px-5"
                        role="status"
                        aria-live="polite"
                        aria-label={`조회 합계: 출력일수 ${totals.workDateCount}일, 총공수 ${formatManDay(totals.totalManDay)}공수, 총금액 ${formatCurrency(totals.totalAmount)}원`}
                    >
                        <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white/10 text-blue-300 ring-1 ring-inset ring-white/10">
                                <FontAwesomeIcon icon={faCalendarAlt} />
                            </div>
                            <div className="min-w-0">
                                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Monthly total</div>
                                <div className="mt-0.5 text-sm font-black text-white">조회 합계</div>
                                <div className="mt-0.5 truncate text-[11px] font-medium text-slate-400">
                                    {selectedWorkerKey ? `${startDate} ~ ${endDate} · 선택 작업자 기준` : '작업자를 선택하면 합계가 표시됩니다.'}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 overflow-hidden rounded-xl border border-white/10 bg-white/[0.06] sm:min-w-[470px]">
                            <div className="px-4 py-2.5">
                                <div className="flex items-center gap-1.5 text-[11px] font-bold text-violet-300">
                                    <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
                                    출력일수
                                </div>
                                <div className="mt-1 flex items-baseline gap-1">
                                    <span className="text-xl font-black tracking-tight text-white sm:text-2xl">
                                        {totals.workDateCount}
                                    </span>
                                    <span className="text-xs font-bold text-slate-400">일</span>
                                </div>
                            </div>
                            <div className="border-l border-white/10 px-4 py-2.5">
                                <div className="flex items-center gap-1.5 text-[11px] font-bold text-blue-300">
                                    <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                                    총공수
                                </div>
                                <div className="mt-1 flex items-baseline gap-1">
                                    <span className="text-xl font-black tracking-tight text-white sm:text-2xl">
                                        {formatManDay(totals.totalManDay)}
                                    </span>
                                    <span className="text-xs font-bold text-slate-400">공수</span>
                                </div>
                            </div>
                            <div className="border-l border-white/10 px-4 py-2.5">
                                <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-300">
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                    총금액
                                </div>
                                <div className="mt-1 flex items-baseline gap-1">
                                    <span className="text-xl font-black tracking-tight text-white sm:text-2xl">
                                        {formatCurrency(totals.totalAmount)}
                                    </span>
                                    <span className="text-xs font-bold text-slate-400">원</span>
                                </div>
                            </div>
                        </div>
                    </footer>
                </section>
            </div>
        </div>
    );
};

export default DailyReportWorkerCalendar;
