import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faCalendarAlt,
    faSearch,
    faSortAmountDown,
    faSortAmountUp,
    faPenToSquare,
    faTrash,
    faSave,
    faFilter,
    faDownload,
    faSpinner,
    faTrashCan,
} from '@fortawesome/free-solid-svg-icons';
import { dailyReportService, DailyReportWorker, DailyReportWorkerRow } from '../../services/dailyReportService';
import { dailyReportTransferService } from '../../services/dailyReportTransferService';
import { teamService, Team } from '../../services/teamService';
import { manpowerService, Worker } from '../../services/manpowerService';
import { siteService, Site } from '../../services/siteService';
import { confirm, toast } from '../../utils/swal';
import { normalizeTypedDateInput, sanitizeTypedDateInput } from '../../utils/typedDateInput';
import { loadSessionState, saveSessionState } from '../../utils/sessionStorage';
import { resolveReportPayType, resolveWorkerPayType } from '../../utils/payType';
import SingleSelectPopover, { InputPopover } from '../../components/common/SingleSelectPopover';
import '../taxinvoice/WorkbookLedgerPage.css';
import './DailyReportListV2.css';

interface DailyReportListV2Props {
    initialDate?: string;
}

const formatYmd = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

const formatNumber = (value: number): string => {
    return new Intl.NumberFormat('ko-KR').format(value);
};

const compareKo = (a: string, b: string): number => {
    return a.localeCompare(b, 'ko');
};

const normalizeTeamNameKey = (value?: string | null): string => {
    return String(value ?? '').trim().replace(/\s+/g, '').toLowerCase();
};

const compareTeamsWithPriority = (a: string, b: string): number => {
    const isAPriority = a.includes('청연');
    const isBPriority = b.includes('청연');

    if (isAPriority && !isBPriority) return -1;
    if (!isAPriority && isBPriority) return 1;

    return a.localeCompare(b, 'ko');
};

const SALARY_MODEL_OPTIONS = ['일급제', '일급', '월급제', '월급', '지원팀', '용역팀', '도급', '팀기성'];

type RowDraft = {
    siteId: string;
    teamId: string;
    responsibleTeamId: string;
    responsibleTeamName: string;
    workerId?: string; // New Worker ID if changed
    workerName?: string;
    workerTeamName?: string;
    workerTeamId?: string; // 소속팀 ID 추가
    salaryModel: string;
    manDay: string;
    unitPrice: string;
    workContent: string;
    siteType: string;
    paymentType: string;
};

type ColumnFilterKey =
    | 'date'
    | 'siteName'
    | 'siteType'
    | 'paymentType'
    | 'teamName'
    | 'workerName'
    | 'workerTeamName'
    | 'salaryModel'
    | 'manDay'
    | 'unitPrice'
    | 'amount';

type ColumnFilterState = Partial<Record<ColumnFilterKey, string[]>>;

const EMPTY_COLUMN_FILTER_VALUE = '__EMPTY__';

type DailyReportListViewState = {
    startDate: string;
    endDate: string;
    startDateInput: string;
    endDateInput: string;
    selectedTeamId: string;
    selectedWorkerTeamId: string;
    selectedSiteId: string;
    workerSearch: string;
    dateSortOrder: 'asc' | 'desc';
    sortMode: 'date' | 'name' | 'site';
    nameSortOrder: 'asc' | 'desc';
    siteSortOrder: 'asc' | 'desc';
    columnFilters: ColumnFilterState;
};

const DAILY_REPORT_LIST_VIEW_KEY = 'output-management:daily-report-list-v2:v1';
const DAILY_REPORT_BOARD_DRAFT_STORAGE_PREFIX = 'dailyReportBoardInputDraft';

const clearDailyReportBoardDrafts = (dates: Iterable<string>) => {
    if (typeof window === 'undefined') return;
    Array.from(new Set(Array.from(dates).filter(Boolean))).forEach((date) => {
        window.localStorage.removeItem(`${DAILY_REPORT_BOARD_DRAFT_STORAGE_PREFIX}:${date}`);
    });
};

type DatePresetKey = 'prevMonth' | 'thisMonth' | 'yesterday' | 'today';

const getMonthDateRange = (monthOffset: number): { start: string; end: string } => {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() + monthOffset);
    startDate.setDate(1);

    const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
    return {
        start: formatYmd(startDate),
        end: formatYmd(endDate)
    };
};

const getRelativeDateString = (dayOffset: number): string => {
    const date = new Date();
    date.setDate(date.getDate() + dayOffset);
    return formatYmd(date);
};

const formatManDay = (value: number): string => {
    return (Number.isFinite(value) ? value : 0).toFixed(1);
};

const toColumnFilterValue = (value: string): string => {
    return value === '' ? EMPTY_COLUMN_FILTER_VALUE : value;
};

const fromColumnFilterValue = (value: string): string => {
    return value === EMPTY_COLUMN_FILTER_VALUE ? '(빈값)' : value;
};

const DailyReportListV2: React.FC<DailyReportListV2Props> = ({ initialDate }) => {
    const todayStr = formatYmd(new Date());
    const defaultDate = initialDate || todayStr;
    const persistedViewState = useMemo(() => {
        const fallback: DailyReportListViewState = {
            startDate: defaultDate,
            endDate: defaultDate,
            startDateInput: defaultDate,
            endDateInput: defaultDate,
            selectedTeamId: '',
            selectedWorkerTeamId: '',
            selectedSiteId: '',
            workerSearch: '',
            dateSortOrder: 'desc',
            sortMode: 'date',
            nameSortOrder: 'asc',
            siteSortOrder: 'asc',
            columnFilters: {}
        };
        const persisted = loadSessionState<DailyReportListViewState>(DAILY_REPORT_LIST_VIEW_KEY, fallback);

        if (!initialDate) {
            return persisted;
        }

        return {
            ...persisted,
            startDate: initialDate,
            endDate: initialDate,
            startDateInput: initialDate,
            endDateInput: initialDate
        };
    }, [defaultDate, initialDate]);

    const [rows, setRows] = useState<DailyReportWorkerRow[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [sites, setSites] = useState<Site[]>([]);
    const siteOptions = useMemo(() => {
        return [...sites].sort((a, b) => compareKo(a.name ?? '', b.name ?? ''));
    }, [sites]);
    const [allWorkers, setAllWorkers] = useState<Worker[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const [startDate, setStartDate] = useState(persistedViewState.startDate);
    const [endDate, setEndDate] = useState(persistedViewState.endDate);
    const [startDateInput, setStartDateInput] = useState(persistedViewState.startDateInput);
    const [endDateInput, setEndDateInput] = useState(persistedViewState.endDateInput);
    const [selectedTeamId, setSelectedTeamId] = useState(persistedViewState.selectedTeamId); // 해당팀 (Report Team)
    const [selectedWorkerTeamId, setSelectedWorkerTeamId] = useState(persistedViewState.selectedWorkerTeamId); // 소속팀 (Worker Team)
    const [selectedSiteId, setSelectedSiteId] = useState(persistedViewState.selectedSiteId);
    const [workerSearch, setWorkerSearch] = useState(persistedViewState.workerSearch);
    const [dateSortOrder, setDateSortOrder] = useState<'asc' | 'desc'>(persistedViewState.dateSortOrder === 'asc' ? 'asc' : 'desc');

    const [sortMode, setSortMode] = useState<'date' | 'name' | 'site'>(persistedViewState.sortMode);
    const [nameSortOrder, setNameSortOrder] = useState<'asc' | 'desc'>(persistedViewState.nameSortOrder === 'desc' ? 'desc' : 'asc');
    const [siteSortOrder, setSiteSortOrder] = useState<'asc' | 'desc'>(persistedViewState.siteSortOrder === 'desc' ? 'desc' : 'asc');

    const [isEditMode, setIsEditMode] = useState(false);
    const isFixed = true;

    const [selectedRowKeys, setSelectedRowKeys] = useState<Set<string>>(new Set());
    const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);

    const [rowDrafts, setRowDrafts] = useState<Record<string, RowDraft>>({});
    const [rowSavingKeys, setRowSavingKeys] = useState<Set<string>>(new Set());

    const [bulkManDay, setBulkManDay] = useState('');
    const [bulkUnitPrice, setBulkUnitPrice] = useState('');
    const [bulkSalaryModel, setBulkSalaryModel] = useState('');
    const [bulkWorkContent, setBulkWorkContent] = useState('');
    const [bulkSiteType, setBulkSiteType] = useState('');
    const [bulkPaymentType, setBulkPaymentType] = useState('');
    const [bulkWorkerTeamName, setBulkWorkerTeamName] = useState('');
    const [columnFilters, setColumnFilters] = useState<ColumnFilterState>(persistedViewState.columnFilters);
    const [openColumnFilter, setOpenColumnFilter] = useState<ColumnFilterKey | null>(null);
    const [columnFilterSearch, setColumnFilterSearch] = useState('');
    const [pendingColumnFilterValues, setPendingColumnFilterValues] = useState<string[] | null>(null);
    const filterMenuRef = React.useRef<HTMLDivElement | null>(null);
    const [isDownloadingExcel, setIsDownloadingExcel] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const [teamsData, sitesData, workersData] = await Promise.all([
                    teamService.getTeams(),
                    siteService.getSites(),
                    manpowerService.getWorkers()
                ]);
                setTeams(teamsData);
                setSites(sitesData);
                setAllWorkers(workersData);
            } catch (error) {
                console.error('[DailyReportListV2] Failed to fetch initial data', error);
            }
        })();
    }, []);

    useEffect(() => {
        setStartDateInput(startDate);
    }, [startDate]);

    useEffect(() => {
        setEndDateInput(endDate);
    }, [endDate]);

    useEffect(() => {
        saveSessionState(DAILY_REPORT_LIST_VIEW_KEY, {
            startDate,
            endDate,
            startDateInput,
            endDateInput,
            selectedTeamId,
            selectedWorkerTeamId,
            selectedSiteId,
            workerSearch,
            dateSortOrder,
            sortMode,
            nameSortOrder,
            siteSortOrder,
            columnFilters
        } satisfies DailyReportListViewState);
    }, [
        columnFilters,
        dateSortOrder,
        endDate,
        endDateInput,
        nameSortOrder,
        selectedSiteId,
        selectedTeamId,
        selectedWorkerTeamId,
        siteSortOrder,
        sortMode,
        startDate,
        startDateInput,
        workerSearch
    ]);

    const fetchRows = useCallback(async (): Promise<void> => {
        setIsLoading(true);
        try {
            const data = await dailyReportService.getReportWorkerRowsByRange({
                startDate,
                endDate
            });
            setRows(data);
        } catch (error) {
            console.error('[DailyReportListV2] Failed to fetch rows', error);
        } finally {
            setIsLoading(false);
        }
    }, [startDate, endDate]);

    useEffect(() => {
        fetchRows();
    }, []);

    useEffect(() => {
        if (!openColumnFilter) return;

        const handlePointerDown = (event: MouseEvent) => {
            if (!filterMenuRef.current?.contains(event.target as Node)) {
                setOpenColumnFilter(null);
            }
        };

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setOpenColumnFilter(null);
            }
        };

        document.addEventListener('mousedown', handlePointerDown);
        document.addEventListener('keydown', handleEscape);

        return () => {
            document.removeEventListener('mousedown', handlePointerDown);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [openColumnFilter]);

    const commitDateInput = useCallback((field: 'start' | 'end') => {
        const currentValue = field === 'start' ? startDate : endDate;
        const draftValue = field === 'start' ? startDateInput : endDateInput;
        const normalizedValue = normalizeTypedDateInput(draftValue) ?? currentValue;

        if (field === 'start') {
            setStartDateInput(normalizedValue);
            if (normalizedValue !== startDate) {
                setStartDate(normalizedValue);
                return true;
            }
            return false;
        }

        setEndDateInput(normalizedValue);
        if (normalizedValue !== endDate) {
            setEndDate(normalizedValue);
            return true;
        }
        return false;
    }, [endDate, endDateInput, startDate, startDateInput]);

    const applyDateRange = useCallback((nextStartDate: string, nextEndDate: string) => {
        setStartDateInput(nextStartDate);
        setEndDateInput(nextEndDate);
        setStartDate(nextStartDate);
        setEndDate(nextEndDate);
    }, []);

    const searchRowsByRange = useCallback((normalizedStart: string, normalizedEnd: string) => {
        setStartDate(normalizedStart);
        setEndDate(normalizedEnd);
        setStartDateInput(normalizedStart);
        setEndDateInput(normalizedEnd);

        setIsLoading(true);
        dailyReportService.getReportWorkerRowsByRange({
            startDate: normalizedStart,
            endDate: normalizedEnd
        }).then(data => {
            setRows(data);
        }).catch(error => {
            console.error('[DailyReportListV2] Search fetch failed', error);
        }).finally(() => {
            setIsLoading(false);
        });
    }, []);

    const datePresets = useMemo<Record<DatePresetKey, { label: string; start: string; end: string }>>(() => {
        const prevMonth = getMonthDateRange(-1);
        const thisMonth = getMonthDateRange(0);
        const yesterday = getRelativeDateString(-1);

        return {
            prevMonth: { label: '전달', ...prevMonth },
            thisMonth: { label: '이달', ...thisMonth },
            yesterday: { label: '어제', start: yesterday, end: yesterday },
            today: { label: '오늘', start: todayStr, end: todayStr }
        };
    }, [todayStr]);

    const normalizedStartForPreset = normalizeTypedDateInput(startDateInput) ?? startDate;
    const normalizedEndForPreset = normalizeTypedDateInput(endDateInput) ?? endDate;

    const activeDatePreset = useMemo<DatePresetKey | null>(() => {
        const matchingPreset = (Object.keys(datePresets) as DatePresetKey[]).find((key) => {
            const preset = datePresets[key];
            return preset.start === normalizedStartForPreset && preset.end === normalizedEndForPreset;
        });
        return matchingPreset ?? null;
    }, [datePresets, normalizedStartForPreset, normalizedEndForPreset]);

    const handleDatePresetClick = useCallback((key: DatePresetKey) => {
        const preset = datePresets[key];
        applyDateRange(preset.start, preset.end);
    }, [applyDateRange, datePresets]);

    const handleSearch = useCallback(() => {
        const normalizedStart = normalizeTypedDateInput(startDateInput) ?? startDate;
        const normalizedEnd = normalizeTypedDateInput(endDateInput) ?? endDate;

        searchRowsByRange(normalizedStart, normalizedEnd);
    }, [startDateInput, endDateInput, startDate, endDate, searchRowsByRange]);

    const getRowKey = useCallback((r: DailyReportWorkerRow) => {
        return `${String(r.reportId)}::${String(r.workerId)}`;
    }, []);

    const rowByKey = useMemo(() => {
        const map = new Map<string, DailyReportWorkerRow>();
        for (const r of rows) {
            map.set(getRowKey(r), r);
        }
        return map;
    }, [rows, getRowKey]);

    const teamCanonicalIdMap = useMemo(() => {
        const map = new Map<string, string>();
        for (const t of teams) {
            const id = t.id ? String(t.id) : '';
            const legacyId = t.legacyId ? String(t.legacyId) : '';
            if (id) map.set(id, id);
            if (legacyId && id) map.set(legacyId, id);
            if (legacyId && !map.has(legacyId)) map.set(legacyId, legacyId);
        }
        return map;
    }, [teams]);

    const siteCanonicalIdMap = useMemo(() => {
        const map = new Map<string, string>();
        for (const s of sites) {
            const id = s.id ? String(s.id) : '';
            const legacyId = s.legacyId ? String(s.legacyId) : '';
            if (id) map.set(id, id);
            if (legacyId && id) map.set(legacyId, id);
            if (legacyId && !map.has(legacyId)) map.set(legacyId, legacyId);
        }
        return map;
    }, [sites]);

    const normalizeTeamId = useCallback((id?: string | null) => {
        const raw = id ? String(id) : '';
        if (!raw) return '';
        return teamCanonicalIdMap.get(raw) ?? raw;
    }, [teamCanonicalIdMap]);

    const teamNameCanonicalIdMap = useMemo(() => {
        const map = new Map<string, string>();
        for (const team of teams) {
            const canonicalId = normalizeTeamId(team.id ? String(team.id) : (team.legacyId ? String(team.legacyId) : ''));
            const nameKey = normalizeTeamNameKey(team.name);
            if (canonicalId && nameKey && !map.has(nameKey)) {
                map.set(nameKey, canonicalId);
            }
        }
        return map;
    }, [teams, normalizeTeamId]);

    const resolveWorkerTeamCanonicalId = useCallback((params: { workerTeamId?: string | null; workerTeamName?: string | null }) => {
        const nameKey = normalizeTeamNameKey(params.workerTeamName);
        if (nameKey) {
            const byName = teamNameCanonicalIdMap.get(nameKey);
            if (byName) return byName;
        }

        const byId = normalizeTeamId(params.workerTeamId);
        if (byId) return byId;
        return '';
    }, [normalizeTeamId, teamNameCanonicalIdMap]);

    const resolveWorkerTeamDisplayName = useCallback((params: { workerTeamId?: string | null; workerTeamName?: string | null }) => {
        const rawName = String(params.workerTeamName ?? '').trim();
        if (rawName) return rawName;

        const canonicalId = resolveWorkerTeamCanonicalId(params);
        if (!canonicalId) return '';

        return teams.find((team) => normalizeTeamId(team.id ?? team.legacyId ?? '') === canonicalId)?.name ?? '';
    }, [normalizeTeamId, resolveWorkerTeamCanonicalId, teams]);

    const resolveResponsibleTeamCanonicalId = useCallback((params: { responsibleTeamId?: string | null; responsibleTeamName?: string | null }) => {
        const nameKey = normalizeTeamNameKey(params.responsibleTeamName);
        if (nameKey) {
            const byName = teamNameCanonicalIdMap.get(nameKey);
            if (byName) return byName;
        }

        const byId = normalizeTeamId(params.responsibleTeamId);
        if (byId) return byId;

        const rawName = String(params.responsibleTeamName ?? '').trim();
        if (rawName) return rawName;

        return '';
    }, [normalizeTeamId, teamNameCanonicalIdMap]);

    const resolveResponsibleTeamOptionId = useCallback((params: { responsibleTeamId?: string | null; responsibleTeamName?: string | null }) => {
        return resolveResponsibleTeamCanonicalId(params) || String(params.responsibleTeamName ?? '').trim();
    }, [resolveResponsibleTeamCanonicalId]);

    const resolveResponsibleTeamDisplayName = useCallback((params: { responsibleTeamId?: string | null; responsibleTeamName?: string | null }) => {
        const rawName = String(params.responsibleTeamName ?? '').trim();
        if (rawName) return rawName;

        const canonicalId = resolveResponsibleTeamCanonicalId(params);
        if (!canonicalId) return '';

        return teams.find((team) => normalizeTeamId(team.id ?? team.legacyId ?? '') === canonicalId)?.name ?? '';
    }, [normalizeTeamId, resolveResponsibleTeamCanonicalId, teams]);

    const normalizeSiteId = useCallback((id?: string | null) => {
        const raw = id ? String(id) : '';
        if (!raw) return '';
        return siteCanonicalIdMap.get(raw) ?? raw;
    }, [siteCanonicalIdMap]);

    const getColumnFilterValue = useCallback((row: DailyReportWorkerRow, key: ColumnFilterKey): string => {
        switch (key) {
            case 'date':
                return row.date ?? '';
            case 'siteName':
                return row.siteName ?? '';
            case 'siteType':
                return row.siteType ?? '';
            case 'paymentType':
                return row.paymentType ?? '';
            case 'teamName':
                return resolveResponsibleTeamDisplayName({
                    responsibleTeamId: row.responsibleTeamId ?? row.teamId,
                    responsibleTeamName: row.responsibleTeamName ?? row.teamName
                });
            case 'workerName':
                return row.workerName ?? '';
            case 'workerTeamName':
                return resolveWorkerTeamDisplayName({
                    workerTeamId: row.workerTeamId,
                    workerTeamName: row.workerTeamName
                });
            case 'salaryModel':
                return resolveReportPayType(row);
            case 'manDay':
                return formatManDay(row.manDay);
            case 'unitPrice':
                return formatNumber(Math.round(Number.isFinite(row.unitPrice) ? row.unitPrice : 0));
            case 'amount':
                return formatNumber(Math.round(Number.isFinite(row.amount) ? row.amount : 0));
            default:
                return '';
        }
    }, [resolveWorkerTeamDisplayName, resolveResponsibleTeamDisplayName]);

    const getFiltered = useCallback((criteria: { teamId?: string; siteId?: string; workerTeamId?: string }) => {
        const wantTeam = criteria.teamId ? normalizeTeamId(criteria.teamId) : '';
        const wantTeamNameKey = criteria.teamId
            ? normalizeTeamNameKey(
                teams.find((team) => normalizeTeamId(team.id ?? team.legacyId ?? '') === wantTeam)?.name
                ?? criteria.teamId
            )
            : '';
        const wantSite = criteria.siteId ? normalizeSiteId(criteria.siteId) : '';
        const wantWorkerTeam = criteria.workerTeamId ? normalizeTeamId(criteria.workerTeamId) : '';

        return rows.filter(r => {
            if (wantTeam) {
                const rowResponsibleTeamId = resolveResponsibleTeamCanonicalId({
                    responsibleTeamId: r.responsibleTeamId ?? r.teamId,
                    responsibleTeamName: r.responsibleTeamName ?? r.teamName
                });
                const rowResponsibleTeamNameKey = normalizeTeamNameKey(resolveResponsibleTeamDisplayName({
                    responsibleTeamId: r.responsibleTeamId ?? r.teamId,
                    responsibleTeamName: r.responsibleTeamName ?? r.teamName
                }));

                if (rowResponsibleTeamId !== wantTeam && (!wantTeamNameKey || rowResponsibleTeamNameKey !== wantTeamNameKey)) {
                    return false;
                }
            }
            if (wantSite && normalizeSiteId(r.siteId) !== wantSite) return false;
            
            if (wantWorkerTeam) {
                const rowWorkerTeamId = resolveWorkerTeamCanonicalId({
                    workerTeamId: r.workerTeamId,
                    workerTeamName: r.workerTeamName
                });
                if (!rowWorkerTeamId || rowWorkerTeamId !== wantWorkerTeam) return false;
            }
            return true;
        });
    }, [rows, normalizeTeamId, normalizeSiteId, resolveResponsibleTeamCanonicalId, resolveResponsibleTeamDisplayName, resolveWorkerTeamCanonicalId, teams]);

    const availableSites = useMemo(() => {
        if (rows.length === 0) {
            return sites
                .slice()
                .sort((a, b) => compareKo(a.name ?? '', b.name ?? ''));
        }

        const filtered = getFiltered({ teamId: selectedTeamId });
        const siteIds = new Set(filtered.map(r => r.siteId ? String(r.siteId) : null).filter((id): id is string => !!id));
        return sites
            .filter(s => siteIds.has(String(s.id)) || (s.legacyId ? siteIds.has(String(s.legacyId)) : false))
            .slice()
            .sort((a, b) => compareKo(a.name ?? '', b.name ?? ''));
    }, [getFiltered, sites, selectedTeamId, rows.length]);

    const availableReportTeams = useMemo(() => {
        if (rows.length === 0) {
            return teams
                .slice()
                .sort((a, b) => compareTeamsWithPriority(a.name ?? '', b.name ?? ''));
        }

        const filtered = getFiltered({ siteId: selectedSiteId });
        const foundTeamIds = new Set<string>();
        const foundTeamNames = new Set<string>();

        filtered.forEach((row) => {
            const responsibleTeamId = resolveResponsibleTeamCanonicalId({
                responsibleTeamId: row.responsibleTeamId ?? row.teamId,
                responsibleTeamName: row.responsibleTeamName ?? row.teamName
            });
            const responsibleTeamName = resolveResponsibleTeamDisplayName({
                responsibleTeamId: row.responsibleTeamId ?? row.teamId,
                responsibleTeamName: row.responsibleTeamName ?? row.teamName
            });

            if (responsibleTeamId) foundTeamIds.add(responsibleTeamId);
            if (responsibleTeamName) foundTeamNames.add(responsibleTeamName);
        });

        const matchedTeams = teams.filter((team) => {
            const canonicalId = normalizeTeamId(team.id ?? team.legacyId ?? '');
            return (canonicalId && foundTeamIds.has(canonicalId)) || foundTeamNames.has(team.name ?? '');
        });

        const matchedTeamNames = new Set(matchedTeams.map((team) => team.name ?? ''));
        const virtualTeams: Team[] = [];

        foundTeamNames.forEach((name) => {
            if (!matchedTeamNames.has(name)) {
                virtualTeams.push({
                    id: name,
                    name,
                    active: true,
                } as any);
            }
        });

        return [...matchedTeams, ...virtualTeams]
            .sort((a, b) => compareTeamsWithPriority(a.name ?? '', b.name ?? ''));
    }, [getFiltered, normalizeTeamId, resolveResponsibleTeamCanonicalId, resolveResponsibleTeamDisplayName, teams, selectedSiteId, rows.length]);

    const availableWorkerTeams = useMemo(() => {
        const scopedRows = getFiltered({ siteId: selectedSiteId, teamId: selectedTeamId });

        const foundTeamIds = new Set<string>();
        const foundTeamNames = new Set<string>();
        
        scopedRows.forEach(r => {
            if (r.workerTeamId) foundTeamIds.add(normalizeTeamId(r.workerTeamId));
            const displayName = resolveWorkerTeamDisplayName({
                workerTeamId: r.workerTeamId,
                workerTeamName: r.workerTeamName
            });
            if (displayName) foundTeamNames.add(displayName);
        });

        if (scopedRows.length === 0) {
            return teams
                .slice()
                .sort((a, b) => compareTeamsWithPriority(a.name ?? '', b.name ?? ''));
        }

        const matchedTeams = teams.filter(t => 
            foundTeamIds.has(String(t.id)) || 
            (t.legacyId ? foundTeamIds.has(String(t.legacyId)) : false) || 
            foundTeamNames.has(t.name ?? '')
        );

        const matchedTeamNamesSet = new Set(matchedTeams.map(t => t.name));
        const virtualTeams: Team[] = [];
        
        foundTeamNames.forEach(name => {
            if (!matchedTeamNamesSet.has(name)) {
                virtualTeams.push({
                    id: name,
                    name: name,
                    active: true,
                } as any);
            }
        });

        return [...matchedTeams, ...virtualTeams]
            .sort((a, b) => compareTeamsWithPriority(a.name ?? '', b.name ?? ''));
    }, [getFiltered, selectedSiteId, selectedTeamId, teams, normalizeTeamId, resolveWorkerTeamDisplayName]);

    const baseFilteredRows = useMemo(() => {
        let result = getFiltered({
            siteId: selectedSiteId,
            teamId: selectedTeamId,
            workerTeamId: selectedWorkerTeamId
        });

        const q = workerSearch.trim().toLowerCase();
        if (q) {
            result = result.filter((r) => {
                const name = (r.workerName ?? '').toLowerCase();
                return name.includes(q);
            });
        }

        return result;
    }, [getFiltered, selectedSiteId, selectedTeamId, selectedWorkerTeamId, workerSearch]);

    const filteredRows = useMemo(() => {
        const activeKeys = Object.keys(columnFilters) as ColumnFilterKey[];
        if (activeKeys.length === 0) {
            return baseFilteredRows;
        }

        return baseFilteredRows.filter((row) => {
            return activeKeys.every((key) => {
                const selectedValues = columnFilters[key] ?? [];
                return selectedValues.includes(toColumnFilterValue(getColumnFilterValue(row, key)));
            });
        });
    }, [baseFilteredRows, columnFilters, getColumnFilterValue]);

    const activeColumnFilterCount = useMemo(() => {
        return Object.keys(columnFilters).length;
    }, [columnFilters]);

    const activeFilterLabels = useMemo(() => {
        const labels: string[] = [];
        const selectedSite = siteOptions.find((site) => {
            return String(site.id ?? '') === selectedSiteId || String(site.legacyId ?? '') === selectedSiteId;
        });
        const selectedReportTeam = availableReportTeams.find((team) => {
            const id = String(team.id ?? team.legacyId ?? team.name ?? '');
            return id === selectedTeamId;
        });
        const selectedWorkerTeam = availableWorkerTeams.find((team) => {
            const id = String(team.id ?? team.legacyId ?? team.name ?? '');
            return id === selectedWorkerTeamId;
        });

        if (selectedSiteId) labels.push(`현장: ${selectedSite?.name ?? '선택됨'}`);
        if (selectedTeamId) labels.push(`현장소속팀: ${selectedReportTeam?.name ?? '선택됨'}`);
        if (selectedWorkerTeamId) labels.push(`소속팀: ${selectedWorkerTeam?.name ?? '선택됨'}`);
        if (workerSearch.trim()) labels.push(`작업자: ${workerSearch.trim()}`);
        if (activeColumnFilterCount > 0) labels.push(`표 필터 ${activeColumnFilterCount}개`);

        return labels;
    }, [
        activeColumnFilterCount,
        availableReportTeams,
        availableWorkerTeams,
        selectedSiteId,
        selectedTeamId,
        selectedWorkerTeamId,
        siteOptions,
        workerSearch
    ]);

    const hasActiveListFilters = activeFilterLabels.length > 0;

    const handleClearListFilters = useCallback(() => {
        setSelectedSiteId('');
        setSelectedTeamId('');
        setSelectedWorkerTeamId('');
        setWorkerSearch('');
        setColumnFilters({});
        setOpenColumnFilter(null);
    }, []);

    const sortedRows = useMemo(() => {
        const copied = [...filteredRows];
        copied.sort((a, b) => {
            if (sortMode === 'name') {
                const nameDiff = nameSortOrder === 'asc'
                    ? compareKo(a.workerName ?? '', b.workerName ?? '')
                    : compareKo(b.workerName ?? '', a.workerName ?? '');
                if (nameDiff !== 0) return nameDiff;

                const dateDiff = (b.date ?? '').localeCompare(a.date ?? '', 'en');
                if (dateDiff !== 0) return dateDiff;

                const teamDiff = compareKo(a.teamName ?? '', b.teamName ?? '');
                if (teamDiff !== 0) return teamDiff;

                return compareKo(a.siteName ?? '', b.siteName ?? '');
            }

            if (sortMode === 'site') {
                const siteDiff = siteSortOrder === 'asc'
                    ? compareKo(a.siteName ?? '', b.siteName ?? '')
                    : compareKo(b.siteName ?? '', a.siteName ?? '');
                if (siteDiff !== 0) return siteDiff;

                const dateDiff = (b.date ?? '').localeCompare(a.date ?? '', 'en');
                if (dateDiff !== 0) return dateDiff;

                const teamDiff = compareKo(a.teamName ?? '', b.teamName ?? '');
                if (teamDiff !== 0) return teamDiff;

                return compareKo(a.workerName ?? '', b.workerName ?? '');
            }

            const diff = dateSortOrder === 'asc'
                ? (a.date ?? '').localeCompare(b.date ?? '', 'en')
                : (b.date ?? '').localeCompare(a.date ?? '', 'en');
            if (diff !== 0) return diff;
            const team = compareKo(a.teamName ?? '', b.teamName ?? '');
            if (team !== 0) return team;
            return compareKo(a.workerName ?? '', b.workerName ?? '');
        });
        return copied;
    }, [filteredRows, dateSortOrder, sortMode, nameSortOrder, siteSortOrder]);

    const workerNameOptions = useMemo(() => {
        return allWorkers.map((worker, index) => ({
            id: String(worker.id ?? worker.legacyId ?? `${worker.name ?? 'worker'}-${index}`),
            name: worker.name ?? '',
            teamName: worker.teamName ?? '',
        }));
    }, [allWorkers]);

    const openColumnFilterOptions = useMemo(() => {
        if (!openColumnFilter) return [];

        const candidateRows = baseFilteredRows.filter((row) => {
            return (Object.keys(columnFilters) as ColumnFilterKey[]).every((key) => {
                if (key === openColumnFilter) return true;
                const selectedValues = columnFilters[key] ?? [];
                return selectedValues.includes(toColumnFilterValue(getColumnFilterValue(row, key)));
            });
        });

        const values = Array.from(new Set(
            candidateRows.map((row) => toColumnFilterValue(getColumnFilterValue(row, openColumnFilter)))
        ));

        values.sort((a, b) => compareKo(fromColumnFilterValue(a), fromColumnFilterValue(b)));
        return values;
    }, [baseFilteredRows, columnFilters, getColumnFilterValue, openColumnFilter]);

    const visibleOpenColumnFilterOptions = useMemo(() => {
        const keyword = columnFilterSearch.trim().toLowerCase();
        if (!keyword) return openColumnFilterOptions;

        return openColumnFilterOptions.filter((value) => {
            return fromColumnFilterValue(value).toLowerCase().includes(keyword);
        });
    }, [columnFilterSearch, openColumnFilterOptions]);

    useEffect(() => {
        if (!openColumnFilter) {
            setPendingColumnFilterValues(null);
            return;
        }

        const appliedValues = Object.prototype.hasOwnProperty.call(columnFilters, openColumnFilter)
            ? (columnFilters[openColumnFilter] ?? [])
            : openColumnFilterOptions;

        setPendingColumnFilterValues(appliedValues);
    }, [columnFilters, openColumnFilter, openColumnFilterOptions]);

    const hasColumnFilter = useCallback((key: ColumnFilterKey) => {
        return Object.prototype.hasOwnProperty.call(columnFilters, key);
    }, [columnFilters]);

    const handleToggleColumnFilterMenu = useCallback((key: ColumnFilterKey) => {
        setColumnFilterSearch('');
        setOpenColumnFilter((prev) => prev === key ? null : key);
    }, []);

    const handleResetColumnFilter = useCallback((key: ColumnFilterKey) => {
        if (openColumnFilter === key) {
            setPendingColumnFilterValues(openColumnFilterOptions);
            return;
        }

        setColumnFilters((prev) => {
            if (!Object.prototype.hasOwnProperty.call(prev, key)) return prev;
            const { [key]: _, ...rest } = prev;
            return rest;
        });
    }, [openColumnFilter, openColumnFilterOptions]);

    const handleResetAllColumnFilters = useCallback(() => {
        setColumnFilters({});
        setOpenColumnFilter(null);
        setColumnFilterSearch('');
    }, []);

    const isColumnFilterValueChecked = useCallback((_key: ColumnFilterKey, value: string, options: string[]) => {
        const values = pendingColumnFilterValues ?? options;
        return values.includes(value);
    }, [pendingColumnFilterValues]);

    const handleToggleColumnFilterValue = useCallback((_key: ColumnFilterKey, value: string, options: string[]) => {
        setPendingColumnFilterValues((prev) => {
            const baseValues = prev ?? options;
            const hasValue = baseValues.includes(value);
            const nextValues = hasValue
                ? baseValues.filter((item) => item !== value)
                : [...baseValues, value];
            return options.filter((item) => nextValues.includes(item));
        });
    }, []);

    const handleSelectAllColumnFilterValues = useCallback((_key: ColumnFilterKey) => {
        setPendingColumnFilterValues(openColumnFilterOptions);
    }, [openColumnFilterOptions]);

    const handleApplyColumnFilter = useCallback((key: ColumnFilterKey, options: string[]) => {
        const sourceValues = pendingColumnFilterValues ?? options;
        const orderedValues = options.filter((item) => sourceValues.includes(item));

        setColumnFilters((prev) => {
            if (orderedValues.length === options.length) {
                const { [key]: _, ...rest } = prev;
                return rest;
            }

            return {
                ...prev,
                [key]: orderedValues
            };
        });

        setOpenColumnFilter(null);
        setColumnFilterSearch('');
    }, [pendingColumnFilterValues]);

    const handleCloseColumnFilterMenu = useCallback(() => {
        setOpenColumnFilter(null);
        setColumnFilterSearch('');
    }, []);

    const handleClearColumnFilterValues = useCallback((key: ColumnFilterKey) => {
        if (openColumnFilter === key) {
            setPendingColumnFilterValues([]);
            return;
        }

        setColumnFilters((prev) => ({
            ...prev,
            [key]: []
        }));
    }, [openColumnFilter]);

    const renderFilterHeader = useCallback((
        key: ColumnFilterKey,
        label: string,
        className: string,
        menuAlign: 'left' | 'right' = 'left'
    ) => {
        const isOpen = openColumnFilter === key;
        const isActive = hasColumnFilter(key);
        const stagedValues = isOpen
            ? (pendingColumnFilterValues ?? openColumnFilterOptions)
            : (isActive ? (columnFilters[key] ?? []) : openColumnFilterOptions);
        const checkedCount = isOpen
            ? stagedValues.length
            : (isActive ? (columnFilters[key] ?? []).length : openColumnFilterOptions.length);
        const allCount = openColumnFilter === key ? openColumnFilterOptions.length : undefined;
        const previewValues = stagedValues.slice(0, 4);
        const isAllSelected = typeof allCount === 'number' && checkedCount === allCount;
        const isSelectionEmpty = checkedCount === 0;

        return (
            <th className={`${className} relative`}>
                <div className={`flex items-center gap-1 ${menuAlign === 'right' ? 'justify-end' : 'justify-between'}`}>
                    <span>{label}</span>
                    <button
                        type="button"
                        onClick={(event) => {
                            event.stopPropagation();
                            handleToggleColumnFilterMenu(key);
                        }}
                        className={`inline-flex h-6 w-6 items-center justify-center rounded border transition-colors ${
                            isActive || isOpen
                                ? 'border-white/50 bg-white/15 text-white'
                                : 'border-transparent text-white/80 hover:border-white/35 hover:bg-white/10 hover:text-white'
                        }`}
                        title={`${label} 필터`}
                    >
                        <FontAwesomeIcon icon={faFilter} className="text-[11px]" />
                    </button>
                </div>
                {isOpen && (
                    <div
                        ref={filterMenuRef}
                        onClick={(event) => event.stopPropagation()}
                        className={`absolute top-full mt-2 w-[240px] rounded-xl border border-slate-200 bg-white p-3 shadow-xl ${
                            menuAlign === 'right' ? 'right-0' : 'left-0'
                        } z-50`}
                    >
                        <div className="mb-2 flex items-center justify-between gap-2">
                            <div className="text-xs font-semibold text-slate-700">{label} 필터</div>
                            <button
                                type="button"
                                onClick={() => handleResetColumnFilter(key)}
                                className="text-[11px] text-slate-500 hover:text-slate-700"
                            >
                                초기화
                            </button>
                        </div>
                        <input
                            type="text"
                            value={columnFilterSearch}
                            onChange={(event) => setColumnFilterSearch(event.target.value)}
                            placeholder="값 검색"
                            className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                        />
                        <div className="mb-2 flex items-center justify-between text-[11px] text-slate-500">
                            <span>
                                {isAllSelected
                                    ? '전체 선택 상태'
                                    : (isSelectionEmpty ? '선택 없음' : `${checkedCount}개 선택`)}
                            </span>
                            {typeof allCount === 'number' && (
                                <span>전체 {allCount}개</span>
                            )}
                        </div>
                        <div className="mb-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
                            <div className="mb-1 text-[11px] font-medium text-slate-500">현재 선택</div>
                            {isAllSelected ? (
                                <div className="text-xs font-semibold text-sky-700">전체 선택</div>
                            ) : (isSelectionEmpty ? (
                                <div className="text-xs font-semibold text-rose-600">선택된 값이 없습니다.</div>
                            ) : (
                                <div className="flex flex-wrap gap-1">
                                    {previewValues.map((value) => (
                                        <span
                                            key={`${key}-preview-${value}`}
                                            className="inline-flex max-w-full items-center rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-700"
                                        >
                                            <span className="truncate">{fromColumnFilterValue(value)}</span>
                                        </span>
                                    ))}
                                    {checkedCount > previewValues.length && (
                                        <span className="inline-flex items-center rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                                            +{checkedCount - previewValues.length}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                        <div className="mb-2 flex gap-2">
                            <button
                                type="button"
                                onClick={() => handleSelectAllColumnFilterValues(key)}
                                className="rounded border border-slate-200 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50"
                            >
                                전체선택
                            </button>
                            <button
                                type="button"
                                onClick={() => handleClearColumnFilterValues(key)}
                                className="rounded border border-slate-200 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50"
                            >
                                전체해제
                            </button>
                        </div>
                        <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-100">
                            {visibleOpenColumnFilterOptions.length === 0 ? (
                                <div className="px-3 py-6 text-center text-xs text-slate-400">선택 가능한 값이 없습니다.</div>
                            ) : (
                                visibleOpenColumnFilterOptions.map((value) => {
                                    const isChecked = isColumnFilterValueChecked(key, value, openColumnFilterOptions);

                                    return (
                                        <label
                                            key={`${key}-${value}`}
                                            className={`flex cursor-pointer items-center gap-2 border-b border-slate-100 px-3 py-2 text-xs last:border-b-0 ${
                                                isChecked
                                                    ? 'bg-sky-50 text-slate-900'
                                                    : 'text-slate-600 hover:bg-slate-50'
                                            }`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={isChecked}
                                                onChange={() => handleToggleColumnFilterValue(key, value, openColumnFilterOptions)}
                                                className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-sky-600 focus:ring-2 focus:ring-sky-500"
                                                style={{ accentColor: '#0284c7' }}
                                            />
                                            <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                                                <span className={`truncate ${isChecked ? 'font-semibold text-slate-900' : ''}`}>
                                                    {fromColumnFilterValue(value)}
                                                </span>
                                                {isChecked && (
                                                    <span className="shrink-0 rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700">
                                                        선택
                                                    </span>
                                                )}
                                            </div>
                                        </label>
                                    );
                                })
                            )}
                        </div>
                        <div className="mt-3 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={handleCloseColumnFilterMenu}
                                className="rounded border border-slate-200 px-3 py-1.5 text-[11px] text-slate-600 hover:bg-slate-50"
                            >
                                닫기
                            </button>
                            <button
                                type="button"
                                onClick={() => handleApplyColumnFilter(key, openColumnFilterOptions)}
                                className="rounded border border-indigo-600 bg-indigo-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-indigo-700"
                            >
                                적용
                            </button>
                        </div>
                    </div>
                )}
            </th>
        );
    }, [
        columnFilters,
        columnFilterSearch,
        handleApplyColumnFilter,
        handleClearColumnFilterValues,
        handleCloseColumnFilterMenu,
        handleResetColumnFilter,
        handleSelectAllColumnFilterValues,
        handleToggleColumnFilterMenu,
        handleToggleColumnFilterValue,
        hasColumnFilter,
        isColumnFilterValueChecked,
        openColumnFilter,
        openColumnFilterOptions,
        pendingColumnFilterValues,
        visibleOpenColumnFilterOptions
    ]);

    const visibleRowKeys = useMemo(() => {
        return sortedRows.map(getRowKey);
    }, [sortedRows, getRowKey]);

    useEffect(() => {
        setSelectedRowKeys((prev) => {
            if (prev.size === 0) return prev;
            const visibleSet = new Set(visibleRowKeys);
            const nextKeys = Array.from(prev).filter((k) => visibleSet.has(k));
            if (nextKeys.length === prev.size) return prev;
            return new Set(nextKeys);
        });
    }, [visibleRowKeys]);

    const isAllSelected = useMemo(() => {
        return visibleRowKeys.length > 0 && visibleRowKeys.every(k => selectedRowKeys.has(k));
    }, [visibleRowKeys, selectedRowKeys]);

    const toggleSelectAll = useCallback(() => {
        setSelectedRowKeys((prev) => {
            const next = new Set(prev);
            const allSelected = visibleRowKeys.length > 0 && visibleRowKeys.every(k => next.has(k));
            if (allSelected) {
                visibleRowKeys.forEach(k => next.delete(k));
                return next;
            }

            visibleRowKeys.forEach(k => next.add(k));
            return next;
        });
    }, [visibleRowKeys]);

    const toggleSelectRow = useCallback((rowKey: string) => {
        setSelectedRowKeys((prev) => {
            const next = new Set(prev);
            if (next.has(rowKey)) next.delete(rowKey);
            else next.add(rowKey);
            return next;
        });
    }, []);

    const handleToggleEditMode = () => {
        setIsEditMode((prev) => {
            const next = !prev;
            if (!next) {
                setSelectedRowKeys(new Set());
                setIsBulkEditOpen(false);
                setRowDrafts({});
                setRowSavingKeys(new Set());
            }
            return next;
        });
    };

    const getRowInitialDraft = useCallback((r: DailyReportWorkerRow): RowDraft => {
        const baseManDay = Number.isFinite(r.manDay) ? String(r.manDay) : '0';
        const baseUnitPrice = Number.isFinite(r.unitPrice) ? String(r.unitPrice) : '0';
        const canonicalWorkerTeamId = resolveWorkerTeamCanonicalId({
            workerTeamId: r.workerTeamId,
            workerTeamName: r.workerTeamName
        });
        const fallbackWorkerTeamName = resolveWorkerTeamDisplayName({
            workerTeamId: r.workerTeamId,
            workerTeamName: r.workerTeamName
        });
        return {
            siteId: normalizeSiteId(r.siteId),
            teamId: normalizeTeamId(r.teamId),
            responsibleTeamId: resolveResponsibleTeamOptionId({
                responsibleTeamId: r.responsibleTeamId,
                responsibleTeamName: r.responsibleTeamName
            }),
            responsibleTeamName: resolveResponsibleTeamDisplayName({
                responsibleTeamId: r.responsibleTeamId,
                responsibleTeamName: r.responsibleTeamName
            }),
            workerName: r.workerName ?? '',
            workerTeamName: fallbackWorkerTeamName,
            workerTeamId: canonicalWorkerTeamId || undefined,
            salaryModel: resolveReportPayType(r),
            manDay: baseManDay,
            unitPrice: baseUnitPrice,
            workContent: String(r.workContent ?? ''),
            siteType: String(r.siteType ?? ''),
            paymentType: String(r.paymentType ?? '')
        };
    }, [normalizeSiteId, normalizeTeamId, resolveWorkerTeamCanonicalId, resolveWorkerTeamDisplayName, resolveResponsibleTeamOptionId, resolveResponsibleTeamDisplayName]);

    const isRowDirty = useCallback((original: DailyReportWorkerRow, draft?: RowDraft) => {
        if (!draft) return false;

        if (draft.workerId && String(draft.workerId) !== String(original.workerId)) return true;
        if (draft.workerName !== undefined && draft.workerName !== original.workerName) return true;
        if (draft.siteId !== normalizeSiteId(original.siteId)) return true;
        if (draft.teamId !== normalizeTeamId(original.teamId)) return true;
        if (draft.responsibleTeamId !== resolveResponsibleTeamOptionId({
            responsibleTeamId: original.responsibleTeamId,
            responsibleTeamName: original.responsibleTeamName
        })) return true;
        if (draft.responsibleTeamName !== resolveResponsibleTeamDisplayName({
            responsibleTeamId: original.responsibleTeamId,
            responsibleTeamName: original.responsibleTeamName
        })) return true;
        if (draft.salaryModel !== resolveReportPayType(original)) return true;
        if (Number(draft.manDay) !== (Number.isFinite(original.manDay) ? original.manDay : 0)) return true;
        if (Number(draft.unitPrice) !== (Number.isFinite(original.unitPrice) ? original.unitPrice : 0)) return true;
        if (draft.workContent !== (original.workContent ?? '')) return true;
        if (draft.siteType !== (original.siteType ?? '')) return true;
        if (draft.paymentType !== (original.paymentType ?? '')) return true;
        if (draft.workerTeamName !== undefined && draft.workerTeamName !== resolveWorkerTeamDisplayName({
            workerTeamId: original.workerTeamId,
            workerTeamName: original.workerTeamName
        })) return true;

        return false;
    }, [normalizeSiteId, normalizeTeamId, resolveResponsibleTeamDisplayName, resolveResponsibleTeamOptionId, resolveWorkerTeamDisplayName]);

    const setRowDraft = useCallback((r: DailyReportWorkerRow, changes: Partial<RowDraft>) => {
        const key = getRowKey(r);
        setRowDrafts(prev => {
            const current = prev[key] || {
                siteId: normalizeSiteId(r.siteId),
                teamId: normalizeTeamId(r.teamId),
                responsibleTeamId: resolveResponsibleTeamOptionId({
                    responsibleTeamId: r.responsibleTeamId,
                    responsibleTeamName: r.responsibleTeamName
                }),
                responsibleTeamName: resolveResponsibleTeamDisplayName({
                    responsibleTeamId: r.responsibleTeamId,
                    responsibleTeamName: r.responsibleTeamName
                }),
                workerName: r.workerName ?? '',
                workerTeamName: resolveWorkerTeamDisplayName({
                    workerTeamId: r.workerTeamId,
                    workerTeamName: r.workerTeamName
                }),
                workerTeamId: resolveWorkerTeamCanonicalId({
                    workerTeamId: r.workerTeamId,
                    workerTeamName: r.workerTeamName
                }) || undefined,
                salaryModel: resolveReportPayType(r),
                manDay: String(Number.isFinite(r.manDay) ? r.manDay : 0),
                unitPrice: String(Number.isFinite(r.unitPrice) ? r.unitPrice : 0),
                workContent: r.workContent ?? '',
                siteType: r.siteType ?? '',
                paymentType: r.paymentType ?? ''
            };
            return {
                ...prev,
                [key]: { ...current, ...changes }
            };
        });
    }, [getRowKey, normalizeSiteId, resolveResponsibleTeamDisplayName, resolveResponsibleTeamOptionId, resolveWorkerTeamCanonicalId, resolveWorkerTeamDisplayName]);

    const mergeRowDraft = useCallback((r: DailyReportWorkerRow, changes: Partial<RowDraft>): RowDraft => {
        const key = getRowKey(r);
        return {
            ...getRowInitialDraft(r),
            ...(rowDrafts[key] ?? {}),
            ...changes
        };
    }, [getRowInitialDraft, getRowKey, rowDrafts]);

    const clearRowDraft = useCallback((rowKey: string) => {
        setRowDrafts((prev) => {
            if (!prev[rowKey]) return prev;
            const { [rowKey]: _, ...rest } = prev;
            return rest;
        });
    }, []);

    const getSameDateSiteReportIds = useCallback((target: DailyReportWorkerRow) => {
        const targetSiteId = normalizeSiteId(target.siteId);
        const reportIds = new Set<string>();

        rows.forEach((row) => {
            if (row.date !== target.date) return;
            if (normalizeSiteId(row.siteId) !== targetSiteId) return;
            if (row.reportId) reportIds.add(row.reportId);
        });

        if (target.reportId) reportIds.add(target.reportId);
        return Array.from(reportIds);
    }, [normalizeSiteId, rows]);

    const splitResponsibleTeamUpdates = useCallback((updates: Partial<DailyReportWorkerRow> & { siteId?: string; siteName?: string }) => {
        const responsibleUpdates: Partial<DailyReportWorkerRow> = {};
        const otherUpdates: Partial<DailyReportWorkerRow> & { siteId?: string; siteName?: string } = {};

        Object.entries(updates).forEach(([key, value]) => {
            if (key === 'responsibleTeamId' || key === 'responsibleTeamName') {
                (responsibleUpdates as any)[key] = value;
                return;
            }
            (otherUpdates as any)[key] = value;
        });

        return { responsibleUpdates, otherUpdates };
    }, []);

    const buildReportLevelUpdates = useCallback((original: DailyReportWorkerRow, draft: RowDraft) => {
        const reportLevelUpdates: Partial<DailyReportWorkerRow> & { siteId?: string; siteName?: string } = {};

        if (
            draft.responsibleTeamId !== resolveResponsibleTeamOptionId({
                responsibleTeamId: original.responsibleTeamId,
                responsibleTeamName: original.responsibleTeamName
            }) ||
            draft.responsibleTeamName !== resolveResponsibleTeamDisplayName({
                responsibleTeamId: original.responsibleTeamId,
                responsibleTeamName: original.responsibleTeamName
            })
        ) {
            const matchedTeam = teams.find((team) => {
                const canonicalId = normalizeTeamId(team.id ?? team.legacyId ?? '');
                const nameKey = normalizeTeamNameKey(team.name);
                return canonicalId === draft.responsibleTeamId || nameKey === normalizeTeamNameKey(draft.responsibleTeamName);
            });

            reportLevelUpdates.responsibleTeamId = matchedTeam?.id ? String(matchedTeam.id) : '';
            reportLevelUpdates.responsibleTeamName = matchedTeam?.name ?? draft.responsibleTeamName ?? '';
        }

        if (draft.siteId !== normalizeSiteId(original.siteId)) {
            const matchedSite = siteOptions.find((site) => String(site.id ?? '') === draft.siteId)
                ?? siteOptions.find((site) => String(site.legacyId ?? '') === draft.siteId);

            if (matchedSite?.id) {
                reportLevelUpdates.siteId = String(matchedSite.id);
                reportLevelUpdates.siteName = matchedSite.name ?? '';
            }
        }

        return reportLevelUpdates;
    }, [normalizeSiteId, normalizeTeamId, resolveResponsibleTeamDisplayName, resolveResponsibleTeamOptionId, siteOptions, teams]);

    const handleWorkerNameChange = useCallback((r: DailyReportWorkerRow, newName: string) => {
        const trimmedName = newName.trim();
        const normalizedName = trimmedName.replace(/\s+/g, '');
        const matched = allWorkers.find(w => w.name === trimmedName)
            || (normalizedName ? allWorkers.find(w => w.name.replace(/\s+/g, '') === normalizedName) : undefined);

        if (matched) {
            const isDuplicate = rows.some(existingRow => {
                if (existingRow.reportId !== r.reportId) return false;
                if (getRowKey(existingRow) === getRowKey(r)) return false;
                const existingKey = getRowKey(existingRow);
                const existingDraft = rowDrafts[existingKey];
                const currentId = existingDraft?.workerId ?? existingRow.workerId;
                return String(currentId) === String(matched.id);
            });

            if (isDuplicate) {
                toast.warning(`'${newName}' 작업자는 같은 일보에 이미 포함되어 있습니다. (이름만 변경됨)`);
                setRowDraft(r, {
                    workerName: newName,
                    workerId: undefined,
                    workerTeamName: '',
                    unitPrice: '0',
                    salaryModel: ''
                });
                return;
            }

            let team = matched.teamId
                ? teams.find(t => t.id === matched.teamId || t.legacyId === matched.teamId)
                : undefined;

            if (!team && matched.teamName) {
                team = teams.find(t => t.name === matched.teamName);
                if (!team) {
                    const searchName = matched.teamName.replace(/\s+/g, '');
                    team = teams.find(t => t.name.replace(/\s+/g, '') === searchName);
                }
            }

            const resolvedTeamName = team?.name ?? matched.teamName ?? '';

            const draftUpdate = {
                workerName: newName,
                workerId: matched.id ? String(matched.id) : undefined,
                workerTeamName: resolvedTeamName || matched.teamName || (matched.teamType === '지원팀' ? '지원팀' : ''),
                workerTeamId: normalizeTeamId(team?.id ? String(team.id) : (matched.teamId ? String(matched.teamId) : '')) || undefined,
                unitPrice: String(matched.unitPrice ?? 0),
                salaryModel: resolveWorkerPayType(matched) || '일급제'
            };
            setRowDraft(r, draftUpdate);
        } else {
            setRowDraft(r, {
                workerName: newName
            });
        }
    }, [allWorkers, teams, setRowDraft, rows, rowDrafts, getRowKey, normalizeTeamId]);

    const saveRowDraft = useCallback(async (
        r: DailyReportWorkerRow,
        draft: RowDraft,
        options?: { confirmSave?: boolean; successMessage?: string }
    ) => {
        const key = getRowKey(r);
        const { confirmSave = true, successMessage = '저장되었습니다.' } = options ?? {};

        if (confirmSave) {
            const result = await confirm.save('저장하시겠습니까?');
            if (!result.isConfirmed) return false;
        }

        setRowSavingKeys(prev => {
            const next = new Set(prev);
            next.add(key);
            return next;
        });

        try {
            const updates: any = {};

            if (draft.workerId && String(draft.workerId) !== String(r.workerId)) {
                updates.workerId = draft.workerId;
            }
            if (draft.workerName !== undefined && draft.workerName !== r.workerName) {
                updates.name = draft.workerName;
            }

            const originalWorkerTeamName = resolveWorkerTeamDisplayName({
                workerTeamId: r.workerTeamId,
                workerTeamName: r.workerTeamName
            });
            const workerTeamNameChanged = draft.workerTeamName !== undefined && draft.workerTeamName !== originalWorkerTeamName;
            const resolvedWorkerTeamIdFromName = resolveWorkerTeamCanonicalId({ workerTeamName: draft.workerTeamName });
            const resolvedWorkerTeamId = workerTeamNameChanged
                ? resolvedWorkerTeamIdFromName
                : (draft.workerTeamId ? normalizeTeamId(draft.workerTeamId) : resolvedWorkerTeamIdFromName);

            if (draft.workerId) {
                const matchedWorker = allWorkers.find(w => String(w.id) === String(draft.workerId));
                if (matchedWorker?.teamId) {
                    updates.teamId = matchedWorker.teamId;
                }
            }
            if (!updates.teamId && resolvedWorkerTeamId) {
                updates.teamId = resolvedWorkerTeamId;
            }

            updates.salaryModel = draft.salaryModel;
            updates.payType = draft.salaryModel;
            updates.manDay = Number(draft.manDay);
            updates.unitPrice = Number(draft.unitPrice);
            updates.workContent = draft.workContent;
            updates.workerTeamName = draft.workerTeamName ?? originalWorkerTeamName;
            updates.siteType = draft.siteType;
            updates.paymentType = draft.paymentType;
            updates.amount = updates.manDay * updates.unitPrice;
            const reportLevelUpdates = buildReportLevelUpdates(r, draft);
            const { responsibleUpdates, otherUpdates } = splitResponsibleTeamUpdates(reportLevelUpdates);
            const responsibleReportIds = Object.keys(responsibleUpdates).length > 0
                ? getSameDateSiteReportIds(r)
                : [];

            await dailyReportService.updateWorkerInReport(r.reportId, r.workerId, updates);
            if (Object.keys(otherUpdates).length > 0) {
                await dailyReportService.updateReport(r.reportId, otherUpdates as any);
            }
            for (const reportId of responsibleReportIds) {
                await dailyReportService.updateReport(reportId, responsibleUpdates as any);
            }
            if (successMessage) {
                toast.success(successMessage);
            }
            clearRowDraft(key);

            const rowLevelWorkerUpdates: Partial<DailyReportWorkerRow> = { ...updates };
            if (updates.name !== undefined) {
                rowLevelWorkerUpdates.workerName = updates.name;
                delete (rowLevelWorkerUpdates as any).name;
            }
            if (updates.teamId !== undefined) {
                rowLevelWorkerUpdates.workerTeamId = updates.teamId;
                delete (rowLevelWorkerUpdates as any).teamId;
            }

            setRows(prev => prev.map(row => {
                const isSameReport = row.reportId === r.reportId;
                const isSameWorker = row.workerId === r.workerId;
                const isSameDateSite = row.date === r.date && normalizeSiteId(row.siteId) === normalizeSiteId(r.siteId);

                if (isSameWorker) {
                    return { ...row, ...rowLevelWorkerUpdates, ...otherUpdates, ...(isSameDateSite ? responsibleUpdates : {}) };
                }

                if (isSameReport) {
                    if (Object.keys(otherUpdates).length > 0) {
                        return { ...row, ...otherUpdates, ...(isSameDateSite ? responsibleUpdates : {}) };
                    }
                }

                if (isSameDateSite && Object.keys(responsibleUpdates).length > 0) {
                    return { ...row, ...responsibleUpdates };
                }

                return row;
            }));
            return true;
        } catch (error) {
            console.error(error);
            toast.error('저장 실패');
            return false;
        } finally {
            setRowSavingKeys(prev => {
                const next = new Set(prev);
                next.delete(key);
                return next;
            });
        }
    }, [allWorkers, buildReportLevelUpdates, clearRowDraft, confirm, getRowKey, getSameDateSiteReportIds, normalizeSiteId, normalizeTeamId, resolveWorkerTeamCanonicalId, resolveWorkerTeamDisplayName, splitResponsibleTeamUpdates, toast]);

    const handleSaveRow = useCallback(async (r: DailyReportWorkerRow) => {
        const key = getRowKey(r);
        const draft = rowDrafts[key];
        if (!draft) return;
        await saveRowDraft(r, draft, { confirmSave: true, successMessage: '저장되었습니다.' });
    }, [getRowKey, rowDrafts, saveRowDraft]);

    const handleQuickRowUpdate = useCallback(async (r: DailyReportWorkerRow, changes: Partial<RowDraft>) => {
        const key = getRowKey(r);
        const nextDraft = mergeRowDraft(r, changes);

        setRowDrafts((prev) => ({
            ...prev,
            [key]: nextDraft
        }));

        if (!isRowDirty(r, nextDraft)) {
            clearRowDraft(key);
            return;
        }

        await saveRowDraft(r, nextDraft, { confirmSave: false, successMessage: '수정되었습니다.' });
    }, [clearRowDraft, getRowKey, isRowDirty, mergeRowDraft, saveRowDraft]);

    const handleQuickWorkerNameUpdate = useCallback(async (r: DailyReportWorkerRow, workerName: string) => {
        const trimmedName = workerName.trim();
        const normalizedName = trimmedName.replace(/\s+/g, '');
        const matched = allWorkers.find(w => w.name === trimmedName)
            || (normalizedName ? allWorkers.find(w => w.name.replace(/\s+/g, '') === normalizedName) : undefined);

        let nextChanges: Partial<RowDraft> = {
            workerName
        };

        if (matched) {
            const isDuplicate = rows.some(existingRow => {
                if (existingRow.reportId !== r.reportId) return false;
                if (getRowKey(existingRow) === getRowKey(r)) return false;
                const existingKey = getRowKey(existingRow);
                const existingDraft = rowDrafts[existingKey];
                const currentId = existingDraft?.workerId ?? existingRow.workerId;
                return String(currentId) === String(matched.id);
            });

            if (isDuplicate) {
                toast.warning(`'${workerName}' 작업자는 같은 일보에 이미 포함되어 있습니다. (이름만 변경됨)`);
                nextChanges = {
                    workerName,
                    workerId: undefined,
                    workerTeamName: '',
                    unitPrice: '0',
                    salaryModel: ''
                };
            } else {
                let team = matched.teamId
                    ? teams.find(t => t.id === matched.teamId || t.legacyId === matched.teamId)
                    : undefined;

                if (!team && matched.teamName) {
                    team = teams.find(t => t.name === matched.teamName);
                    if (!team) {
                        const searchName = matched.teamName.replace(/\s+/g, '');
                        team = teams.find(t => t.name.replace(/\s+/g, '') === searchName);
                    }
                }

                const resolvedTeamName = team?.name ?? matched.teamName ?? '';
                nextChanges = {
                    workerName,
                    workerId: matched.id ? String(matched.id) : undefined,
                    workerTeamName: resolvedTeamName || matched.teamName || (matched.teamType === '지원팀' ? '지원팀' : ''),
                    workerTeamId: normalizeTeamId(team?.id ? String(team.id) : (matched.teamId ? String(matched.teamId) : '')) || undefined,
                    unitPrice: String(matched.unitPrice ?? 0),
                    salaryModel: resolveWorkerPayType(matched) || '일급제'
                };
            }
        }

        await handleQuickRowUpdate(r, nextChanges);
    }, [allWorkers, getRowKey, handleQuickRowUpdate, normalizeTeamId, rowDrafts, rows, teams, toast]);

    const handleBulkApply = async () => {
        const selected = Array.from(selectedRowKeys)
            .map((k) => rowByKey.get(k))
            .filter((r): r is DailyReportWorkerRow => !!r);

        if (selected.length === 0) return;

        const parsedManDay = bulkManDay.trim() === '' ? null : Number(bulkManDay);
        const parsedUnitPrice = bulkUnitPrice.trim() === '' ? null : Number(bulkUnitPrice);
        const nextSalaryModel = bulkSalaryModel.trim() === '' ? null : bulkSalaryModel.trim();
        const nextWorkContent = bulkWorkContent.trim() === '' ? null : bulkWorkContent.trim();

        if (parsedManDay != null && (!Number.isFinite(parsedManDay) || parsedManDay < 0)) {
            alert('공수 값이 올바르지 않습니다.');
            return;
        }
        if (parsedUnitPrice != null && (!Number.isFinite(parsedUnitPrice) || parsedUnitPrice < 0)) {
            alert('단가 값이 올바르지 않습니다.');
            return;
        }

        if (
            parsedManDay == null && 
            parsedUnitPrice == null && 
            nextSalaryModel == null && 
            nextWorkContent == null && 
            !bulkSiteType && 
            !bulkPaymentType && 
            !bulkWorkerTeamName.trim()
        ) {
            toast.info('변경할 값이 없습니다.');
            return;
        }

        const ok = await confirm.batch('일보', selected.length);
        if (!ok.isConfirmed) return;

        setIsLoading(true);
        try {
            for (const r of selected) {
                const updates: Partial<DailyReportWorker> = {};
                if (parsedManDay != null) updates.manDay = parsedManDay;
                if (parsedUnitPrice != null) updates.unitPrice = parsedUnitPrice;
                if (nextSalaryModel != null) updates.salaryModel = nextSalaryModel;
                if (nextWorkContent != null) updates.workContent = nextWorkContent;
                if (bulkSiteType) updates.siteType = bulkSiteType;
                if (bulkPaymentType) updates.paymentType = bulkPaymentType;
                if (bulkWorkerTeamName.trim()) updates.workerTeamName = bulkWorkerTeamName.trim();
                
                await dailyReportService.updateWorkerInReport(r.reportId, r.workerId, updates);
            }

            toast.updated('일보');
            setSelectedRowKeys(new Set());
            setIsBulkEditOpen(false);
            setBulkManDay('');
            setBulkUnitPrice('');
            setBulkSalaryModel('');
            setBulkWorkContent('');
            setBulkSiteType('');
            setBulkPaymentType('');
            setBulkWorkerTeamName('');
            await fetchRows();
        } catch (error) {
            console.error('[DailyReportListV2] bulk update failed', error);
            toast.error('일괄 수정에 실패했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleBulkDelete = async () => {
        const selected = Array.from(selectedRowKeys)
            .map((k) => rowByKey.get(k))
            .filter((r): r is DailyReportWorkerRow => !!r);

        if (selected.length === 0) return;

        const ok = await confirm.delete(`선택한 ${selected.length}건 삭제`);
        if (!ok.isConfirmed) return;

        setIsLoading(true);
        try {
            let successCount = 0;
            const successDates = new Set<string>();
            for (const r of selected) {
                try {
                    await dailyReportService.removeWorkerFromReport(r.reportId, r.workerId);
                    successCount++;
                    successDates.add(r.date);
                } catch (e) {
                    console.error(`Failed to delete worker ${r.workerName} `, e);
                }
            }

            if (successDates.size > 0) {
                clearDailyReportBoardDrafts(successDates);
            }

            if (successCount === selected.length) {
                toast.deleted('일보', successCount);
            } else {
                toast.updated(`일보 ${successCount}건 삭제 완료(실패 ${selected.length - successCount}건)`);
            }

            setSelectedRowKeys(new Set());
            setIsBulkEditOpen(false);
            await fetchRows();
        } catch (error) {
            console.error('[DailyReportListV2] bulk delete failed', error);
            toast.error('삭제 중 오류가 발생했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    const totals = useMemo(() => {
        const totalManDay = sortedRows.reduce((sum, r) => sum + (Number.isFinite(r.manDay) ? r.manDay : 0), 0);
        const totalAmount = sortedRows.reduce((sum, r) => sum + (Number.isFinite(r.amount) ? r.amount : 0), 0);
        return { totalManDay, totalAmount };
    }, [sortedRows]);

    const dirtyRowCount = useMemo(() => {
        let count = 0;
        const keys = Object.keys(rowDrafts);
        for (const key of keys) {
            const draft = rowDrafts[key];
            const original = rowByKey.get(key);
            if (original && isRowDirty(original, draft)) {
                count++;
            }
        }
        return count;
    }, [rowDrafts, rowByKey, isRowDirty]);

    const handleSaveAllDirtyRows = async () => {
        if (dirtyRowCount === 0) return;

        const result = await confirm.save(`변경된 ${dirtyRowCount}건의 항목을 일괄 저장하시겠습니까?`);
        if (!result.isConfirmed) return;

        setIsLoading(true);
        try {
            const dirtyKeys = Object.keys(rowDrafts).filter(key => {
                const original = rowByKey.get(key);
                return original && isRowDirty(original, rowDrafts[key]);
            });

            let successCount = 0;
            let failCount = 0;

            for (const key of dirtyKeys) {
                const r = rowByKey.get(key)!;
                const draft = rowDrafts[key];

                try {
                    const updates: any = {};
                    if (draft.workerId && String(draft.workerId) !== String(r.workerId)) updates.workerId = draft.workerId;
                    if (draft.workerName !== undefined && draft.workerName !== r.workerName) updates.name = draft.workerName;
                    
                    const originalWorkerTeamName = resolveWorkerTeamDisplayName({
                        workerTeamId: r.workerTeamId,
                        workerTeamName: r.workerTeamName
                    });
                    const workerTeamNameChanged = draft.workerTeamName !== undefined && draft.workerTeamName !== originalWorkerTeamName;
                    const resolvedWorkerTeamIdFromName = resolveWorkerTeamCanonicalId({ workerTeamName: draft.workerTeamName });

                    if (workerTeamNameChanged) {
                        if (resolvedWorkerTeamIdFromName) updates.teamId = resolvedWorkerTeamIdFromName;
                    } else if (draft.workerTeamId !== undefined) {
                        updates.teamId = normalizeTeamId(draft.workerTeamId);
                    } else if (resolvedWorkerTeamIdFromName) {
                        updates.teamId = resolvedWorkerTeamIdFromName;
                    }

                    if (!updates.teamId && draft.workerId) {
                        const matchedWorker = allWorkers.find(w => String(w.id) === String(draft.workerId));
                        if (matchedWorker?.teamId) {
                            updates.teamId = matchedWorker.teamId;
                        }
                    }

                    updates.salaryModel = draft.salaryModel;
                    updates.payType = draft.salaryModel;
                    updates.manDay = Number(draft.manDay);
                    updates.unitPrice = Number(draft.unitPrice);
                    updates.workContent = draft.workContent;
                    updates.workerTeamName = draft.workerTeamName ?? originalWorkerTeamName;
                    updates.siteType = draft.siteType;
                    updates.paymentType = draft.paymentType;
                    updates.amount = updates.manDay * updates.unitPrice;

                    const reportLevelUpdates = buildReportLevelUpdates(r, draft);
                    const { responsibleUpdates, otherUpdates } = splitResponsibleTeamUpdates(reportLevelUpdates);
                    const responsibleReportIds = Object.keys(responsibleUpdates).length > 0
                        ? getSameDateSiteReportIds(r)
                        : [];

                    await dailyReportService.updateWorkerInReport(r.reportId, r.workerId, updates);
                    if (Object.keys(otherUpdates).length > 0) {
                        await dailyReportService.updateReport(r.reportId, otherUpdates as any);
                    }
                    for (const reportId of responsibleReportIds) {
                        await dailyReportService.updateReport(reportId, responsibleUpdates as any);
                    }

                    successCount++;
                } catch (error) {
                    failCount++;
                    console.error('[SaveAll] Row save failed:', error);
                }
            }

            if (failCount === 0) {
                toast.success(`${successCount}건 저장 완료`);
            } else {
                toast.warning(`${successCount}건 저장, ${failCount}건 실패 (중복 등 확인 필요)`);
            }

            setRowDrafts({});
            await fetchRows();
        } catch (error) {
            console.error('[DailyReportListV2] Save All Failed (Critical)', error);
            toast.error('일괄 저장 중 시스템 오류가 발생했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    const isTransferBusy = isLoading || isDownloadingExcel;

    const handleDownloadExcel = useCallback(async () => {
        if (sortedRows.length === 0) {
            toast.info('다운로드할 행이 없습니다.');
            return;
        }

        setIsDownloadingExcel(true);
        try {
            const exportRows = sortedRows.map((row) => ({
                ...row,
                teamName: resolveResponsibleTeamDisplayName({
                    responsibleTeamId: row.responsibleTeamId,
                    responsibleTeamName: row.responsibleTeamName
                }),
                workerTeamName: resolveWorkerTeamDisplayName({
                    workerTeamId: row.workerTeamId,
                    workerTeamName: row.workerTeamName
                })
            }));

            await dailyReportTransferService.exportRowsToExcel(exportRows, `조회일보목록_${startDate}_${endDate}`);
            toast.success('조회 목록 엑셀 다운로드 완료');
        } catch (error) {
            console.error('[DailyReportListV2] Excel download failed', error);
            toast.error('조회 목록 엑셀 다운로드에 실패했습니다.');
        } finally {
            setIsDownloadingExcel(false);
        }
    }, [endDate, resolveWorkerTeamDisplayName, sortedRows, startDate]);

    const renderDatePresetButton = (key: DatePresetKey) => {
        const preset = datePresets[key];
        const isActive = activeDatePreset === key;

        return (
            <button
                key={key}
                type="button"
                onClick={() => handleDatePresetClick(key)}
                aria-pressed={isActive}
                title={`${preset.label} 기간 선택: ${preset.start} ~ ${preset.end}`}
                className={`daily-report-v2-preset-btn px-2.5 py-1.5 text-xs rounded-lg font-semibold border transition-colors ${isActive
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
            >
                {preset.label}
            </button>
        );
    };

    const emptyTitle = rows.length > 0
        ? '현재 필터에 맞는 작업자가 없습니다'
        : '조회된 작업자 내역이 없습니다';
    const emptyDescription = rows.length > 0
        ? '현장, 소속팀, 작업자 검색 또는 표 필터를 줄여서 다시 확인하세요.'
        : '선택한 기간에 등록된 출력일보가 없거나 아직 조회되지 않았습니다.';

    return (
        <div className="daily-report-v2-page flex flex-col flex-1 min-h-0 gap-3 p-0 pb-1">
            <div className="daily-report-v2-toolbar flex-shrink-0 bg-white px-3 py-2.5 rounded-xl shadow-sm border border-slate-200">
                <div className="daily-report-v2-toolbar-main">
                    <section className="daily-report-v2-toolbar-section daily-report-v2-date-section" aria-label="조회 기간">
                        <div className="daily-report-v2-date-inputs">
                            <div className="relative">
                                <FontAwesomeIcon icon={faCalendarAlt} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={startDateInput}
                                    onChange={(e) => setStartDateInput(sanitizeTypedDateInput(e.target.value))}
                                    onBlur={() => { commitDateInput('start'); }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            commitDateInput('start');
                                        }
                                    }}
                                    aria-label="조회 시작일"
                                    title="조회 시작일"
                                    placeholder="YYYY-MM-DD"
                                    className="pl-10 pr-3 py-2 border-slate-300 rounded-lg text-sm w-[130px]"
                                />
                            </div>
                            <span className="text-slate-400">~</span>
                            <input
                                type="text"
                                inputMode="numeric"
                                value={endDateInput}
                                onChange={(e) => setEndDateInput(sanitizeTypedDateInput(e.target.value))}
                                onBlur={() => { commitDateInput('end'); }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        commitDateInput('end');
                                    }
                                }}
                                aria-label="조회 종료일"
                                title="조회 종료일"
                                placeholder="YYYY-MM-DD"
                                className="px-3 py-2 border-slate-300 rounded-lg text-sm w-[130px]"
                            />
                        </div>

                        <div className="daily-report-v2-preset-group" role="group" aria-label="빠른 날짜 선택">
                            {renderDatePresetButton('prevMonth')}
                            {renderDatePresetButton('thisMonth')}
                            {renderDatePresetButton('yesterday')}
                            {renderDatePresetButton('today')}
                        </div>
                    </section>

                    <section className="daily-report-v2-toolbar-section daily-report-v2-filter-section" aria-label="목록 필터">
                        <select
                            value={selectedSiteId}
                            onChange={(e) => setSelectedSiteId(e.target.value)}
                            aria-label="현장 필터"
                            title="현장 필터"
                            className="daily-report-v2-select px-3 py-2 border-slate-300 rounded-lg text-sm"
                        >
                            <option value="">전체 현장</option>
                            {[...availableSites].sort((a, b) => a.name.localeCompare(b.name, 'ko')).map((s) => (
                                <option key={String(s.id)} value={String(s.id)}>{s.name}</option>
                            ))}
                        </select>

                        <select
                            value={selectedTeamId}
                            onChange={(e) => setSelectedTeamId(e.target.value)}
                            aria-label="현장소속팀 필터"
                            title="현장소속팀 필터"
                            className="daily-report-v2-select px-3 py-2 border-slate-300 rounded-lg text-sm"
                        >
                            <option value="">전체 현장소속팀</option>
                            {availableReportTeams.map((t) => (
                                <option key={String(t.id ?? t.legacyId ?? t.name)} value={String(t.id ?? t.legacyId ?? t.name)}>{t.name}</option>
                            ))}
                        </select>

                        <select
                            value={selectedWorkerTeamId}
                            onChange={(e) => setSelectedWorkerTeamId(e.target.value)}
                            aria-label="작업자 소속팀 필터"
                            title="작업자 소속팀 필터"
                            className="daily-report-v2-select px-3 py-2 border-slate-300 rounded-lg text-sm bg-slate-50"
                        >
                            <option value="">전체 소속팀</option>
                            {availableWorkerTeams.map((t) => (
                                <option key={String(t.id)} value={String(t.id)}>{t.name}</option>
                            ))}
                        </select>

                        <div className="relative daily-report-v2-worker-search">
                            <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                value={workerSearch}
                                onChange={(e) => setWorkerSearch(e.target.value)}
                                aria-label="작업자 이름 검색"
                                title="작업자 이름 검색"
                                placeholder="작업자 검색"
                                className="w-full pl-10 pr-4 py-2 border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all"
                            />
                        </div>
                    </section>

                    <section className="daily-report-v2-toolbar-section daily-report-v2-sort-section" aria-label="정렬 및 수정 도구">
                        <button
                            type="button"
                            onClick={() => {
                                setSortMode('date');
                                setDateSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'));
                            }}
                            aria-label={`날짜 ${dateSortOrder === 'desc' ? '최신순' : '오래된순'} 정렬`}
                            title={`날짜 ${dateSortOrder === 'desc' ? '최신순' : '오래된순'} 정렬`}
                            className={`daily-report-v2-sort-btn px-3 py-2 text-sm rounded-lg font-semibold flex items-center gap-2 transition-colors border ${sortMode === 'date'
                                ? 'bg-indigo-50 text-indigo-600 border-indigo-100'
                                : 'bg-slate-50 text-slate-600 border-slate-200'
                                }`}
                        >
                            <FontAwesomeIcon icon={dateSortOrder === 'desc' ? faSortAmountDown : faSortAmountUp} />
                            <span className="text-xs font-bold">날짜</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                setSortMode('name');
                                setNameSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
                            }}
                            aria-label={`이름 ${nameSortOrder === 'asc' ? '오름차순' : '내림차순'} 정렬`}
                            title={`이름 ${nameSortOrder === 'asc' ? '오름차순' : '내림차순'} 정렬`}
                            className={`daily-report-v2-sort-btn px-3 py-2 text-sm rounded-lg font-semibold flex items-center gap-2 transition-colors border ${sortMode === 'name'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                : 'bg-slate-50 text-slate-600 border-slate-200'
                                }`}
                        >
                            <span className="text-xs font-bold">이름순</span>
                            <FontAwesomeIcon icon={nameSortOrder === 'asc' ? faSortAmountUp : faSortAmountDown} />
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                setSortMode('site');
                                setSiteSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
                            }}
                            aria-label={`현장 ${siteSortOrder === 'asc' ? '오름차순' : '내림차순'} 정렬`}
                            title={`현장 ${siteSortOrder === 'asc' ? '오름차순' : '내림차순'} 정렬`}
                            className={`daily-report-v2-sort-btn px-3 py-2 text-sm rounded-lg font-semibold flex items-center gap-2 transition-colors border ${sortMode === 'site'
                                ? 'bg-amber-50 text-amber-700 border-amber-100'
                                : 'bg-slate-50 text-slate-600 border-slate-200'
                                }`}
                        >
                            <span className="text-xs font-bold">현장순</span>
                            <FontAwesomeIcon icon={siteSortOrder === 'asc' ? faSortAmountUp : faSortAmountDown} />
                        </button>

                        <button
                            type="button"
                            onClick={handleToggleEditMode}
                            aria-pressed={isEditMode}
                            title={isEditMode ? '수정모드 종료' : '수정모드 시작'}
                            className={`daily-report-v2-tool-btn flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold shadow-sm border transition-colors ${isEditMode
                                ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                }`}
                        >
                            <FontAwesomeIcon icon={faPenToSquare} />
                            {isEditMode ? '수정 종료' : '수정모드'}
                        </button>

                        {isEditMode && (
                            <>
                                <button
                                    type="button"
                                    onClick={() => setIsBulkEditOpen(true)}
                                    disabled={selectedRowKeys.size === 0}
                                    className={`daily-report-v2-tool-btn px-4 py-2 rounded-lg text-sm font-bold shadow-sm border transition-colors ${selectedRowKeys.size > 0
                                        ? 'bg-indigo-100 text-indigo-700 border-indigo-200 hover:bg-indigo-200'
                                        : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                                        }`}
                                    title="선택 항목 일괄 수정"
                                >
                                    일괄수정 ({selectedRowKeys.size})
                                </button>

                                <button
                                    type="button"
                                    onClick={handleBulkDelete}
                                    disabled={selectedRowKeys.size === 0}
                                    className={`daily-report-v2-tool-btn flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold shadow-sm border transition-colors ${selectedRowKeys.size > 0
                                        ? 'bg-red-100 text-red-700 border-red-200 hover:bg-red-200'
                                        : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                                        }`}
                                    title="선택 항목 삭제"
                                >
                                    <FontAwesomeIcon icon={faTrash} />
                                    삭제
                                </button>
                            </>
                        )}
                    </section>

                    <section className="daily-report-v2-toolbar-actions" aria-label="조회 작업">
                        <button
                            type="button"
                            onClick={handleSearch}
                            className="daily-report-v2-primary-action bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-bold shadow-sm flex items-center gap-2 transition-transform active:scale-95"
                            title="현재 조건으로 조회"
                        >
                            <FontAwesomeIcon icon={faSearch} />
                            조회
                        </button>

                        <button
                            type="button"
                            onClick={() => { void handleDownloadExcel(); }}
                            disabled={isTransferBusy}
                            className={`daily-report-v2-secondary-action flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold shadow-sm border transition-colors ${isTransferBusy
                                ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                }`}
                            title="현재 조회 목록을 엑셀로 다운로드"
                        >
                            <FontAwesomeIcon icon={isDownloadingExcel ? faSpinner : faDownload} spin={isDownloadingExcel} />
                            엑셀 다운로드
                        </button>

                        {isEditMode && (
                            <button
                                type="button"
                                onClick={handleSaveAllDirtyRows}
                                disabled={isLoading || dirtyRowCount === 0}
                                className={`daily-report-v2-secondary-action px-4 py-2 rounded-lg text-sm font-bold shadow-sm flex items-center gap-2 border transition-colors ${dirtyRowCount > 0
                                    ? 'bg-red-500 hover:bg-red-600 text-white border-red-500 animate-pulse'
                                    : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                                    }`}
                                title="변경된 모든 항목 저장"
                            >
                                <FontAwesomeIcon icon={faSave} />
                                전체 저장 ({dirtyRowCount})
                            </button>
                        )}

                        <div className="daily-report-v2-total-chip bg-slate-800 text-white px-4 py-2 rounded-lg shadow-sm flex items-center gap-2" aria-label={`총 공수 ${totals.totalManDay.toFixed(1)}, 총 금액 ${formatNumber(Math.round(totals.totalAmount))}원`}>
                            <span className="text-xs font-light text-slate-300">Total</span>
                            <span className="font-bold text-lg">{totals.totalManDay.toFixed(1)}</span>
                            <span className="text-xs">공수</span>
                            <span className="ml-2 text-xs font-light text-slate-300">|</span>
                            <span className="font-bold text-lg">{formatNumber(Math.round(totals.totalAmount))}</span>
                            <span className="text-xs">원</span>
                        </div>
                    </section>
                </div>
                {isEditMode && (
                    <div className="w-full flex items-center gap-2 text-xs text-slate-500">
                        <span className="px-2 py-1 rounded-full bg-indigo-50 text-indigo-600 font-semibold">수정중</span>
                        <span>조회된 행은 모두 바로 수정할 수 있고, 변경분은 각 행 저장 또는 상단 전체 저장으로 반영됩니다.</span>
                    </div>
                )}
            </div>

            {isEditMode && isBulkEditOpen && (
                <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200 flex flex-wrap gap-3 items-end">
                    <div className="text-sm font-bold text-slate-700">선택 항목 일괄 수정</div>

                    <div className="flex flex-col">
                        <label className="text-[11px] text-slate-500">공수</label>
                        <input
                            type="number"
                            value={bulkManDay}
                            onChange={(e) => setBulkManDay(e.target.value)}
                            placeholder="(미입력=변경없음)"
                            className="px-3 py-2 border-slate-300 rounded-lg text-sm w-[160px]"
                        />
                    </div>

                    <div className="flex flex-col">
                        <label className="text-[11px] text-slate-500">단가</label>
                        <input
                            type="number"
                            value={bulkUnitPrice}
                            onChange={(e) => setBulkUnitPrice(e.target.value)}
                            placeholder="(미입력=변경없음)"
                            className="px-3 py-2 border-slate-300 rounded-lg text-sm w-[160px]"
                        />
                    </div>

                    <div className="flex flex-col">
                        <label className="text-[11px] text-slate-500">급여방식</label>
                        <input
                            type="text"
                            list="daily-report-v2-salary-model-options"
                            value={bulkSalaryModel}
                            onChange={(e) => setBulkSalaryModel(e.target.value)}
                            placeholder="(미입력=변경없음)"
                            className="px-3 py-2 border-slate-300 rounded-lg text-sm w-[200px]"
                        />
                    </div>

                    <div className="flex flex-col">
                        <label className="text-[11px] text-slate-500">현장구분</label>
                        <select
                            value={bulkSiteType}
                            onChange={(e) => setBulkSiteType(e.target.value)}
                            className="px-3 py-2 border-slate-300 rounded-lg text-sm w-[120px]"
                        >
                            <option value="">(변경없음)</option>
                            <option value="도급">도급</option>
                            <option value="직영">직영</option>
                            <option value="지원">지원</option>
                        </select>
                    </div>

                    <div className="flex flex-col">
                        <label className="text-[11px] text-slate-500">결제구분</label>
                        <select
                            value={bulkPaymentType}
                            onChange={(e) => setBulkPaymentType(e.target.value)}
                            className="px-3 py-2 border-slate-300 rounded-lg text-sm w-[120px]"
                        >
                            <option value="">(변경없음)</option>
                            <option value="노무">노무</option>
                            <option value="계산서">계산서</option>
                        </select>
                    </div>

                    <div className="flex flex-col">
                        <label className="text-[11px] text-slate-500">소속팀명</label>
                        <input
                            type="text"
                            value={bulkWorkerTeamName}
                            onChange={(e) => setBulkWorkerTeamName(e.target.value)}
                            placeholder="(미입력=변경없음)"
                            className="px-3 py-2 border-slate-300 rounded-lg text-sm w-[150px]"
                        />
                    </div>

                    <div className="flex flex-col flex-1 min-w-[240px]">
                        <label className="text-[11px] text-slate-500">비고</label>
                        <input
                            type="text"
                            value={bulkWorkContent}
                            onChange={(e) => setBulkWorkContent(e.target.value)}
                            placeholder="(미입력=변경없음)"
                            className="px-3 py-2 border-slate-300 rounded-lg text-sm"
                        />
                    </div>

                    <button
                        onClick={handleBulkApply}
                        disabled={selectedRowKeys.size === 0}
                        className={`px-5 py-2 rounded-lg text-sm font-bold shadow-sm whitespace-nowrap transition-colors ${selectedRowKeys.size > 0
                            ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                            : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            }`}
                    >
                        적용
                    </button>

                    <button
                        onClick={() => setIsBulkEditOpen(false)}
                        className="px-5 py-2 rounded-lg text-sm font-bold shadow-sm whitespace-nowrap bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                    >
                        닫기
                    </button>
                </div>
            )}

            {activeColumnFilterCount > 0 && (
                <div className="mb-3 flex items-center justify-between rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-2 text-xs text-indigo-700">
                    <span>열 필터 {activeColumnFilterCount}개 적용 중</span>
                    <button
                        type="button"
                        onClick={handleResetAllColumnFilters}
                        className="font-semibold text-indigo-700 hover:text-indigo-900"
                    >
                        열 필터 초기화
                    </button>
                </div>
            )}

            <div className="daily-report-v2-panel flex-1 min-h-0 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                <datalist id="daily-report-v2-salary-model-options">
                    {SALARY_MODEL_OPTIONS.map((option) => (
                        <option key={option} value={option} />
                    ))}
                </datalist>
                <datalist id="worker-list-v2">
                    {workerNameOptions.map((worker) => (
                        <option key={worker.id} value={worker.name}>
                            {worker.teamName ? `(${worker.teamName})` : ''}
                        </option>
                    ))}
                </datalist>
                <datalist id="worker-team-list-v2">
                    {availableWorkerTeams.map((team) => (
                        <option key={String(team.id ?? team.name)} value={team.name ?? ''} />
                    ))}
                </datalist>
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600 mb-2"></div>
                        <span className="text-sm font-medium">불러오는 중...</span>
                    </div>
                ) : sortedRows.length === 0 ? (
                    <div className="daily-report-v2-empty-state" role="status" aria-live="polite">
                        <div className="daily-report-v2-empty-icon" aria-hidden="true">
                            <FontAwesomeIcon icon={faFilter} />
                        </div>
                        <div className="daily-report-v2-empty-copy">
                            <h2>{emptyTitle}</h2>
                            <p>{emptyDescription}</p>
                        </div>
                        <div className="daily-report-v2-empty-meta" aria-label="현재 조회 조건">
                            <span>기간: {startDate} ~ {endDate}</span>
                            {activeFilterLabels.length > 0 ? (
                                activeFilterLabels.map((label) => (
                                    <span key={label}>{label}</span>
                                ))
                            ) : (
                                <span>추가 필터 없음</span>
                            )}
                        </div>
                        <div className="daily-report-v2-empty-actions">
                            {hasActiveListFilters && (
                                <button
                                    type="button"
                                    onClick={handleClearListFilters}
                                    className="px-4 py-2 rounded-lg text-sm font-bold bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                                    title="현장, 팀, 작업자 검색, 표 필터를 모두 초기화"
                                >
                                    필터 초기화
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => searchRowsByRange(todayStr, todayStr)}
                                className="px-4 py-2 rounded-lg text-sm font-bold bg-blue-600 text-white border border-blue-600 hover:bg-blue-700"
                                title="오늘 날짜로 다시 조회"
                            >
                                오늘 날짜로 조회
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="sheet-table-wrapper workbook-frozen-table-wrapper daily-report-v2-wrapper" style={{ flex: 1 }}>
                    <table className="sheet-table daily-report-workbook-table min-w-[1310px] text-left text-slate-700">
                        <colgroup>
                            {isEditMode && <col className="daily-report-col-select" />}
                            <col className="daily-report-col-date" />
                            <col className="daily-report-col-site" />
                            <col className="daily-report-col-site-type" />
                            <col className="daily-report-col-payment-type" />
                            <col className="daily-report-col-team" />
                            <col className="daily-report-col-name" />
                            <col className="daily-report-col-worker-team" />
                            <col className="daily-report-col-salary" />
                            <col className="daily-report-col-man-day" />
                            <col className="daily-report-col-unit-price" />
                            <col className="daily-report-col-amount" />
                            <col className="daily-report-col-note" />
                            {isEditMode && <col className="daily-report-col-action" />}
                        </colgroup>
                        <thead className="border-b border-[#255e94]">
                            <tr>
                                {isEditMode && (
                                    <th className={`px-2.5 py-2 whitespace-nowrap w-[48px] ${isFixed ? 'sticky left-0 z-40 bg-[#2e75b6] border-r border-[#255e94]' : ''}`}>
                                        <input
                                            type="checkbox"
                                            className="w-4 h-4 text-brand-600 bg-gray-100 border-gray-300 rounded focus:ring-brand-500"
                                            checked={isAllSelected}
                                            onChange={toggleSelectAll}
                                            title="전체 선택"
                                        />
                                    </th>
                                )}
                                {renderFilterHeader(
                                    'date',
                                    '날짜',
                                    `px-2.5 py-2 whitespace-nowrap w-[86px] daily-report-col-date ${isFixed ? `sticky z-40 border-r border-[#255e94] ${isEditMode ? 'left-[48px]' : 'left-0'}` : ''}`
                                )}
                                {renderFilterHeader(
                                    'siteName',
                                    '현장명',
                                    'px-2.5 py-2 whitespace-nowrap w-[150px]'
                                )}
                                {renderFilterHeader(
                                    'siteType',
                                    '구분',
                                    'px-2.5 py-2 whitespace-nowrap w-[60px]'
                                )}
                                {renderFilterHeader(
                                    'paymentType',
                                    '결제',
                                    'px-2.5 py-2 whitespace-nowrap w-[60px]'
                                )}
                                {renderFilterHeader(
                                    'teamName',
                                    '현장소속팀',
                                    'px-2.5 py-2 whitespace-nowrap w-[120px]'
                                )}
                                {renderFilterHeader(
                                    'workerName',
                                    '성명',
                                    'px-2.5 py-2 whitespace-nowrap w-[80px]'
                                )}
                                {renderFilterHeader(
                                    'workerTeamName',
                                    '소속팀',
                                    'px-2.5 py-2 whitespace-nowrap w-[120px]'
                                )}
                                {renderFilterHeader(
                                    'salaryModel',
                                    '급여방식',
                                    'px-2.5 py-2 whitespace-nowrap w-[80px]'
                                )}
                                {renderFilterHeader(
                                    'manDay',
                                    '공수',
                                    'px-2.5 py-2 whitespace-nowrap w-[60px] text-right',
                                    'right'
                                )}
                                {renderFilterHeader(
                                    'unitPrice',
                                    '단가',
                                    'px-2.5 py-2 whitespace-nowrap w-[90px] text-right',
                                    'right'
                                )}
                                {renderFilterHeader(
                                    'amount',
                                    '금액',
                                    'px-2.5 py-2 whitespace-nowrap w-[100px] text-right',
                                    'right'
                                )}
                                <th className="px-2.5 py-2 whitespace-nowrap min-w-[150px]">비고(내용)</th>
                                {isEditMode && (
                                    <th className="px-2.5 py-2 whitespace-nowrap w-[80px] text-center">작업</th>
                                )}
                            </tr>
                        </thead>
                        <tbody className="bg-white">
                            {sortedRows.map((row) => {
                                const key = getRowKey(row);
                                const isSelected = selectedRowKeys.has(key);
                                const draft = rowDrafts[key];
                                const isDirty = isRowDirty(row, draft);
                                const isSaving = rowSavingKeys.has(key);

                                const displayRow = draft ? { ...row, ...draft } : row;
                                const displayResponsibleTeamName = resolveResponsibleTeamDisplayName({
                                    responsibleTeamId: displayRow.responsibleTeamId ?? displayRow.teamId,
                                    responsibleTeamName: displayRow.responsibleTeamName ?? displayRow.teamName
                                });
                                const displayWorkerTeamName = resolveWorkerTeamDisplayName({
                                    workerTeamId: displayRow.workerTeamId,
                                    workerTeamName: displayRow.workerTeamName
                                });
                                const originalWorkerTeamName = resolveWorkerTeamDisplayName({
                                    workerTeamId: row.workerTeamId,
                                    workerTeamName: row.workerTeamName
                                });

                                return (
                                    <tr
                                        key={key}
                                        className={`sheet-row hover:bg-slate-50 transition-colors border-b border-slate-100 ${isSelected ? 'bg-indigo-50/50' : ''} ${isDirty ? 'bg-amber-50/50' : ''}`}
                                    >
                                        {isEditMode && (
                                            <td className={`px-2.5 py-1.5 text-center ${isFixed ? 'sticky left-0 z-30 bg-inherit border-r border-slate-200' : ''}`}>
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => toggleSelectRow(key)}
                                                    className="w-4 h-4 text-brand-600 bg-gray-100 border-gray-300 rounded focus:ring-brand-500"
                                                />
                                            </td>
                                        )}
                                        <td className={`px-2.5 py-1.5 font-mono text-slate-500 ${isFixed ? `sticky z-30 bg-inherit border-r border-slate-200 ${isEditMode ? 'left-[48px]' : 'left-0'}` : ''}`}>
                                            {row.date}
                                        </td>
                                        <td className="px-2.5 py-1.5">
                                            {isEditMode ? (
                                                <select
                                                    value={displayRow.siteId}
                                                    onChange={(e) => setRowDraft(row, { siteId: e.target.value })}
                                                    className={`w-full px-1 py-0.5 border rounded text-sm ${isDirty && draft?.siteId !== normalizeSiteId(row.siteId) ? 'border-amber-500 bg-amber-50' : 'border-slate-200'}`}
                                                >
                                                    <option value="">현장 선택</option>
                                                    {siteOptions.map(s => <option key={String(s.id)} value={String(s.id)}>{s.name}</option>)}
                                                </select>
                                            ) : (
                                                <span className="truncate block" title={row.siteName ?? ''}>{row.siteName}</span>
                                            )}
                                        </td>
                                        <td className="px-2.5 py-1.5">
                                            {isEditMode ? (
                                                <select
                                                    value={displayRow.siteType}
                                                    onChange={(e) => setRowDraft(row, { siteType: e.target.value })}
                                                    className={`w-full px-1 py-0.5 border rounded text-sm ${isDirty && draft?.siteType !== (row.siteType ?? '') ? 'border-amber-500 bg-amber-50' : 'border-slate-200'}`}
                                                >
                                                    <option value="">선택</option>
                                                    <option value="도급">도급</option>
                                                    <option value="직영">직영</option>
                                                    <option value="지원">지원</option>
                                                </select>
                                            ) : (
                                                row.siteType
                                            )}
                                        </td>
                                        <td className="px-2.5 py-1.5">
                                            {isEditMode ? (
                                                <select
                                                    value={displayRow.paymentType}
                                                    onChange={(e) => setRowDraft(row, { paymentType: e.target.value })}
                                                    className={`w-full px-1 py-0.5 border rounded text-sm ${isDirty && draft?.paymentType !== (row.paymentType ?? '') ? 'border-amber-500 bg-amber-50' : 'border-slate-200'}`}
                                                >
                                                    <option value="">선택</option>
                                                    <option value="노무">노무</option>
                                                    <option value="계산서">계산서</option>
                                                </select>
                                            ) : (
                                                row.paymentType
                                            )}
                                        </td>
                                        <td className="px-2.5 py-1.5">
                                            {isEditMode ? (
                                                <select
                                                    value={resolveResponsibleTeamOptionId({
                                                        responsibleTeamId: displayRow.responsibleTeamId,
                                                        responsibleTeamName: displayRow.responsibleTeamName ?? displayRow.teamName
                                                    })}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        const matchedTeam = teams.find(t => String(t.id ?? t.legacyId ?? '') === val);
                                                        setRowDraft(row, {
                                                            responsibleTeamId: val,
                                                            responsibleTeamName: matchedTeam?.name ?? val
                                                        });
                                                    }}
                                                    className={`w-full px-1 py-0.5 border rounded text-sm ${isDirty && draft?.responsibleTeamId !== resolveResponsibleTeamOptionId(row) ? 'border-amber-500 bg-amber-50' : 'border-slate-200'}`}
                                                >
                                                    <option value="">팀 선택</option>
                                                    {teams.map(t => <option key={String(t.id ?? t.legacyId ?? t.name)} value={String(t.id ?? t.legacyId ?? t.name)}>{t.name}</option>)}
                                                </select>
                                            ) : (
                                                <span className="truncate block" title={displayResponsibleTeamName}>{displayResponsibleTeamName}</span>
                                            )}
                                        </td>
                                        <td className="px-2.5 py-1.5">
                                            {isEditMode ? (
                                                <input
                                                    type="text"
                                                    list="worker-list-v2"
                                                    value={displayRow.workerName}
                                                    onChange={(e) => handleWorkerNameChange(row, e.target.value)}
                                                    className={`w-full px-2 py-0.5 border rounded text-sm font-bold ${isDirty && draft?.workerName !== row.workerName ? 'border-amber-500 bg-amber-50' : 'border-slate-200'}`}
                                                />
                                            ) : (
                                                <span className="font-bold text-slate-900">{row.workerName}</span>
                                            )}
                                        </td>
                                        <td className="px-2.5 py-1.5">
                                            {isEditMode ? (
                                                <input
                                                    type="text"
                                                    list="worker-team-list-v2"
                                                    value={displayWorkerTeamName}
                                                    onChange={(e) => {
                                                        const nextWorkerTeamName = e.target.value;
                                                        setRowDraft(row, {
                                                            workerTeamName: nextWorkerTeamName,
                                                            workerTeamId: resolveWorkerTeamCanonicalId({ workerTeamName: nextWorkerTeamName }) || undefined
                                                        });
                                                    }}
                                                    className={`w-full px-2 py-0.5 border rounded text-sm ${isDirty && draft?.workerTeamName !== originalWorkerTeamName ? 'border-amber-500 bg-amber-50' : 'border-slate-200'}`}
                                                />
                                            ) : (
                                                <span className="truncate block text-slate-500" title={displayWorkerTeamName}>{displayWorkerTeamName}</span>
                                            )}
                                        </td>
                                        <td className="px-2.5 py-1.5">
                                            {isEditMode ? (
                                                <input
                                                    type="text"
                                                    list="daily-report-v2-salary-model-options"
                                                    value={displayRow.salaryModel}
                                                    onChange={(e) => setRowDraft(row, { salaryModel: e.target.value })}
                                                    className={`w-full px-2 py-0.5 border rounded text-sm ${isDirty && draft?.salaryModel !== resolveReportPayType(row) ? 'border-amber-500 bg-amber-50' : 'border-slate-200'}`}
                                                />
                                            ) : (
                                                <span className="text-slate-500">{resolveReportPayType(row)}</span>
                                            )}
                                        </td>
                                        <td className="px-2.5 py-1.5 text-right font-mono">
                                            {isEditMode ? (
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    value={displayRow.manDay}
                                                    onChange={(e) => setRowDraft(row, { manDay: e.target.value })}
                                                    className={`w-full px-1 py-0.5 border rounded text-sm text-right font-bold ${isDirty && Number(draft?.manDay) !== row.manDay ? 'border-amber-500 bg-amber-50' : 'border-slate-200'}`}
                                                />
                                            ) : (
                                                <span className="font-bold">{formatManDay(row.manDay)}</span>
                                            )}
                                        </td>
                                        <td className="px-2.5 py-1.5 text-right font-mono">
                                            {isEditMode ? (
                                                <input
                                                    type="number"
                                                    value={displayRow.unitPrice}
                                                    onChange={(e) => setRowDraft(row, { unitPrice: e.target.value })}
                                                    className={`w-full px-1 py-0.5 border rounded text-sm text-right ${isDirty && Number(draft?.unitPrice) !== row.unitPrice ? 'border-amber-500 bg-amber-50' : 'border-slate-200'}`}
                                                />
                                            ) : (
                                                formatNumber(Math.round(row.unitPrice))
                                            )}
                                        </td>
                                        <td className="px-2.5 py-1.5 text-right font-mono font-bold text-indigo-600">
                                            {formatNumber(Math.round((Number(displayRow.manDay) || 0) * (Number(displayRow.unitPrice) || 0)))}
                                        </td>
                                        <td className="px-2.5 py-1.5">
                                            {isEditMode ? (
                                                <input
                                                    type="text"
                                                    value={displayRow.workContent}
                                                    onChange={(e) => setRowDraft(row, { workContent: e.target.value })}
                                                    className={`w-full px-2 py-0.5 border rounded text-sm ${isDirty && draft?.workContent !== (row.workContent ?? '') ? 'border-amber-500 bg-amber-50' : 'border-slate-200'}`}
                                                />
                                            ) : (
                                                <span className="truncate block text-slate-400 text-xs" title={row.workContent ?? ''}>{row.workContent}</span>
                                            )}
                                        </td>
                                        {isEditMode && (
                                            <td className="px-2.5 py-1.5 text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                    {isDirty ? (
                                                        <>
                                                            <button
                                                                onClick={() => handleSaveRow(row)}
                                                                disabled={isSaving}
                                                                className="w-7 h-7 flex items-center justify-center bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:bg-slate-300"
                                                                title="저장"
                                                            >
                                                                <FontAwesomeIcon icon={isSaving ? faSpinner : faSave} spin={isSaving} />
                                                            </button>
                                                            <button
                                                                onClick={() => clearRowDraft(key)}
                                                                disabled={isSaving}
                                                                className="w-7 h-7 flex items-center justify-center bg-slate-200 text-slate-600 rounded hover:bg-slate-300"
                                                                title="취소"
                                                            >
                                                                <FontAwesomeIcon icon={faTrashCan} />
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <span className="text-[10px] text-slate-300 font-bold italic">CLEAN</span>
                                                    )}
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DailyReportListV2;
