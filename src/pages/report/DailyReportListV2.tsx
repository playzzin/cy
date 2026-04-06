import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import Swal from 'sweetalert2';
import {
    faCalendarAlt,
    faSearch,
    faSortAmountDown,
    faSortAmountUp,
    faPenToSquare,
    faTrash,
    faSave,
    faThumbtack,
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

const SALARY_MODEL_OPTIONS = ['일급제', '일급', '월급제', '월급', '지원팀', '용역팀', '도급', '팀기성'];

type RowDraft = {
    siteId: string;
    workerId?: string; // New Worker ID if changed
    workerName?: string;
    workerTeamName?: string;
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
    isFixed: boolean;
    columnFilters: ColumnFilterState;
};

const DAILY_REPORT_LIST_VIEW_KEY = 'output-management:daily-report-list-v2:v1';

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
            isFixed: false,
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

    const [isEditMode, setIsEditMode] = useState(true);
    const [isFixed, setIsFixed] = useState(persistedViewState.isFixed); // 가로 틀고정 상태

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
    const [isResettingDb, setIsResettingDb] = useState(false);
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
            isFixed,
            columnFilters
        } satisfies DailyReportListViewState);
    }, [
        columnFilters,
        dateSortOrder,
        endDate,
        endDateInput,
        isFixed,
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
    }, [fetchRows]);

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

    const handleSearch = useCallback(() => {
        const startChanged = commitDateInput('start');
        const endChanged = commitDateInput('end');
        if (!startChanged && !endChanged) {
            fetchRows();
        }
    }, [commitDateInput, fetchRows]);

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
                return row.teamName ?? '';
            case 'workerName':
                return row.workerName ?? '';
            case 'workerTeamName':
                return row.workerTeamName ?? '';
            case 'salaryModel':
                return String(row.salaryModel ?? row.payType ?? '');
            case 'manDay':
                return formatManDay(row.manDay);
            case 'unitPrice':
                return formatNumber(Math.round(Number.isFinite(row.unitPrice) ? row.unitPrice : 0));
            case 'amount':
                return formatNumber(Math.round(Number.isFinite(row.amount) ? row.amount : 0));
            default:
                return '';
        }
    }, []);

    const getFiltered = useCallback((criteria: { teamId?: string; siteId?: string; workerTeamId?: string }) => {
        const wantTeam = criteria.teamId ? normalizeTeamId(criteria.teamId) : '';
        const wantSite = criteria.siteId ? normalizeSiteId(criteria.siteId) : '';
        const wantWorkerTeam = criteria.workerTeamId ? normalizeTeamId(criteria.workerTeamId) : '';

        return rows.filter(r => {
            if (wantTeam && normalizeTeamId(r.teamId) !== wantTeam) return false;
            if (wantSite && normalizeSiteId(r.siteId) !== wantSite) return false;
            if (wantWorkerTeam && normalizeTeamId(r.workerTeamId) !== wantWorkerTeam) return false;
            return true;
        });
    }, [rows, normalizeTeamId, normalizeSiteId]);

    // 1. Available Sites (Filtered by Report Team ONLY) - Worker Team selection does NOT constrain sites
    const availableSites = useMemo(() => {
        const filtered = getFiltered({ teamId: selectedTeamId });
        const siteIds = new Set(filtered.map(r => r.siteId ? String(r.siteId) : null).filter((id): id is string => !!id));
        return sites
            .filter(s => siteIds.has(String(s.id)) || (s.legacyId ? siteIds.has(String(s.legacyId)) : false))
            .slice()
            .sort((a, b) => compareKo(a.name ?? '', b.name ?? ''));
    }, [getFiltered, sites, selectedTeamId]);

    // 2. Available Report Teams (Filtered by Site ONLY) - Worker Team selection does NOT constrain report teams
    const availableReportTeams = useMemo(() => {
        const filtered = getFiltered({ siteId: selectedSiteId });
        const teamIds = new Set(filtered.map(r => r.teamId ? String(r.teamId) : null).filter((id): id is string => !!id));
        return teams
            .filter(t => teamIds.has(String(t.id)) || (t.legacyId ? teamIds.has(String(t.legacyId)) : false))
            .slice()
            .sort((a, b) => compareKo(a.name ?? '', b.name ?? ''));
    }, [getFiltered, teams, selectedSiteId]);

    // 3. Available Worker Teams (Filtered by Site & Report Team)
    const availableWorkerTeams = useMemo(() => {
        const filtered = getFiltered({ siteId: selectedSiteId, teamId: selectedTeamId });
        const teamIds = new Set(filtered.map(r => r.workerTeamId ? String(r.workerTeamId) : null).filter((id): id is string => !!id));
        return teams
            .filter(t => teamIds.has(String(t.id)) || (t.legacyId ? teamIds.has(String(t.legacyId)) : false))
            .slice()
            .sort((a, b) => compareKo(a.name ?? '', b.name ?? ''));
    }, [getFiltered, teams, selectedSiteId, selectedTeamId]);

    // 4. Base Display Rows (Filtered by ALL selection + Search)
    const baseFilteredRows = useMemo(() => {
        let result = getFiltered({
            siteId: selectedSiteId,
            teamId: selectedTeamId,
            workerTeamId: selectedWorkerTeamId
        });

        // Text Search (Worker Name Only)
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

    const siteOptions = useMemo(() => {
        return sites
            .filter((site) => Boolean(site.id))
            .slice()
            .sort((a, b) => compareKo(a.name ?? '', b.name ?? ''));
    }, [sites]);

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
        return {
            siteId: normalizeSiteId(r.siteId),
            workerName: r.workerName ?? '',
            workerTeamName: r.workerTeamName ?? '',
            salaryModel: String(r.salaryModel ?? r.payType ?? ''),
            manDay: baseManDay,
            unitPrice: baseUnitPrice,
            workContent: String(r.workContent ?? ''),
            siteType: String(r.siteType ?? ''),
            paymentType: String(r.paymentType ?? '')
        };
    }, [normalizeSiteId]);

    const isRowDirty = useCallback((original: DailyReportWorkerRow, draft?: RowDraft) => {
        if (!draft) return false;

        // 1. Check Worker Change
        if (draft.workerId && String(draft.workerId) !== String(original.workerId)) return true;

        // 2. Check Name Change (Typo fix)
        if (draft.workerName !== undefined && draft.workerName !== original.workerName) return true;

        if (draft.siteId !== normalizeSiteId(original.siteId)) return true;
        if (draft.salaryModel !== String(original.salaryModel ?? original.payType ?? '')) return true;
        if (Number(draft.manDay) !== (Number.isFinite(original.manDay) ? original.manDay : 0)) return true;
        if (Number(draft.unitPrice) !== (Number.isFinite(original.unitPrice) ? original.unitPrice : 0)) return true;
        if (draft.workContent !== (original.workContent ?? '')) return true;
        if (draft.siteType !== (original.siteType ?? '')) return true;
        if (draft.paymentType !== (original.paymentType ?? '')) return true;

        // Check workerTeamName change
        if (draft.workerTeamName !== undefined && draft.workerTeamName !== (original.workerTeamName ?? '')) return true;

        return false;
    }, [normalizeSiteId]);

    const setRowDraft = useCallback((r: DailyReportWorkerRow, changes: Partial<RowDraft>) => {
        const key = getRowKey(r);
        setRowDrafts(prev => {
            const current = prev[key] || {
                siteId: normalizeSiteId(r.siteId),
                workerName: r.workerName ?? '',
                workerTeamName: r.workerTeamName ?? '',
                salaryModel: String(r.salaryModel ?? r.payType ?? ''),
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
    }, [getRowKey, normalizeSiteId]);

    const clearRowDraft = useCallback((rowKey: string) => {
        setRowDrafts((prev) => {
            if (!prev[rowKey]) return prev;
            const { [rowKey]: _, ...rest } = prev;
            return rest;
        });
    }, []);

    const buildReportLevelUpdates = useCallback((original: DailyReportWorkerRow, draft: RowDraft) => {
        const reportLevelUpdates: Partial<DailyReportWorkerRow> & { siteId?: string; siteName?: string } = {};

        if (draft.siteId !== normalizeSiteId(original.siteId)) {
            const matchedSite = siteOptions.find((site) => String(site.id ?? '') === draft.siteId)
                ?? siteOptions.find((site) => String(site.legacyId ?? '') === draft.siteId);

            if (matchedSite?.id) {
                reportLevelUpdates.siteId = String(matchedSite.id);
                reportLevelUpdates.siteName = matchedSite.name ?? '';
            }
        }

        if (draft.siteType !== (original.siteType ?? '')) {
            reportLevelUpdates.siteType = draft.siteType;
        }

        if (draft.paymentType !== (original.paymentType ?? '')) {
            reportLevelUpdates.paymentType = draft.paymentType;
        }

        return reportLevelUpdates;
    }, [normalizeSiteId, siteOptions]);

    // Worker Change Logic
    // Worker Change Logic
    const handleWorkerNameChange = useCallback((r: DailyReportWorkerRow, newName: string) => {
        // 1. Try to find match in allWorkers (exact first, then normalized without spaces - same as input tab)
        const trimmedName = newName.trim();
        const normalizedName = trimmedName.replace(/\s+/g, '');
        const matched = allWorkers.find(w => w.name === trimmedName)
            || (normalizedName ? allWorkers.find(w => w.name.replace(/\s+/g, '') === normalizedName) : undefined);

        if (matched) {
            // Check for duplicates ONLY within the same report (same reportId)
            // 같은 일보(reportId) 내에서만 중복 체크 (다른 날짜/현장에 같은 작업자가 있는 것은 정상)
            const isDuplicate = rows.some(existingRow => {
                // 같은 리포트 내에서만 체크
                if (existingRow.reportId !== r.reportId) return false;
                // 자신이 아닌 행 중에서
                if (getRowKey(existingRow) === getRowKey(r)) return false;
                // workerId가 같은 행이 있는지 확인 (draft가 있으면 draft 우선)
                const existingKey = getRowKey(existingRow);
                const existingDraft = rowDrafts[existingKey];
                const currentId = existingDraft?.workerId ?? existingRow.workerId;
                return String(currentId) === String(matched.id);
            });

            if (isDuplicate) {
                toast.warning(`'${newName}' 작업자는 같은 일보에 이미 포함되어 있습니다. (이름만 변경됨)`);
                setRowDraft(r, {
                    workerName: newName,
                    workerId: undefined, // 중복 방지를 위해 ID 매칭 해제
                    workerTeamName: '',
                    unitPrice: '0',
                    salaryModel: ''
                });
                return;
            }

            // 2. Lookup team from teams array
            // Try by teamId (checking both UUID and legacyId), then fallback to teamName
            let team = matched.teamId
                ? teams.find(t => t.id === matched.teamId || t.legacyId === matched.teamId)
                : undefined;

            // Fallback: if no team found by ID, try finding by name (try exact, then relaxed)
            if (!team && matched.teamName) {
                team = teams.find(t => t.name === matched.teamName);
                if (!team) {
                    const searchName = matched.teamName.replace(/\s+/g, '');
                    team = teams.find(t => t.name.replace(/\s+/g, '') === searchName);
                }
            }

            const resolvedTeamName = team?.name ?? matched.teamName ?? '';

            // Worker Found -> Auto-fill (단가, 급여방식, 작업팀 모두 채움)
            const draftUpdate = {
                workerName: newName,
                workerId: matched.id ? String(matched.id) : undefined,
                // 우선순위: 1. 팀 매칭 결과(resolvedTeamName) 2. 작업자 정보의 팀명(matched.teamName) 3. 작업자 정보의 팀유형(matched.teamType - 지원팀 등)
                workerTeamName: resolvedTeamName || matched.teamName || (matched.teamType === '지원팀' ? '지원팀' : ''),
                unitPrice: String(matched.unitPrice ?? 0),
                salaryModel: matched.payType || matched.salaryModel || '일급'
            };
            setRowDraft(r, draftUpdate);
        } else {
            // Worker Not Found -> Just update name only (타이핑 중에는 다른 필드 초기화하지 않음)
            setRowDraft(r, {
                workerName: newName
            });
        }
    }, [allWorkers, teams, setRowDraft, rows, rowDrafts, getRowKey]);

    const handleSaveRow = useCallback(async (r: DailyReportWorkerRow) => {
        const key = getRowKey(r);
        const draft = rowDrafts[key];
        if (!draft) return;

        const result = await confirm.save('저장하시겠습니까?');
        if (!result.isConfirmed) return;

        setRowSavingKeys(prev => {
            const next = new Set(prev);
            next.add(key);
            return next;
        });

        try {
            // Prepare updates
            const updates: any = {};

            if (draft.workerId && String(draft.workerId) !== String(r.workerId)) {
                updates.workerId = draft.workerId;
            }
            if (draft.workerName !== undefined && draft.workerName !== r.workerName) {
                updates.name = draft.workerName;
            }
            // Resolve teamId from worker master when worker is changed
            if (draft.workerId) {
                const matchedWorker = allWorkers.find(w => String(w.id) === String(draft.workerId));
                if (matchedWorker?.teamId) {
                    updates.teamId = matchedWorker.teamId;
                }
            }

            updates.salaryModel = draft.salaryModel;
            updates.payType = draft.salaryModel; // sync
            updates.manDay = Number(draft.manDay);
            updates.unitPrice = Number(draft.unitPrice);
            updates.workContent = draft.workContent;
            updates.workerTeamName = draft.workerTeamName ?? '';
            updates.siteType = draft.siteType;
            updates.paymentType = draft.paymentType;
            updates.amount = updates.manDay * updates.unitPrice;
            const reportLevelUpdates = buildReportLevelUpdates(r, draft);

            await dailyReportService.updateWorkerInReport(r.reportId, r.workerId, updates);
            if (Object.keys(reportLevelUpdates).length > 0) {
                await dailyReportService.updateReport(r.reportId, reportLevelUpdates as any);
            }
            toast.success('저장되었습니다.');
            clearRowDraft(key);

            // Optimistic Update
            setRows(prev => prev.map(row => {
                const isSameReport = row.reportId === r.reportId;
                const isSameWorker = row.workerId === r.workerId;

                if (isSameWorker) {
                    return { ...row, ...updates, ...reportLevelUpdates };
                }

                if (isSameReport) {
                    if (Object.keys(reportLevelUpdates).length > 0) {
                        return { ...row, ...reportLevelUpdates };
                    }
                }

                return row;
            }));
        } catch (error) {
            console.error(error);
            toast.error('저장 실패');
        } finally {
            setRowSavingKeys(prev => {
                const next = new Set(prev);
                next.delete(key);
                return next;
            });
        }
    }, [allWorkers, buildReportLevelUpdates, clearRowDraft, getRowKey, rowDrafts, confirm, toast]);

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

        if (parsedManDay == null && parsedUnitPrice == null && nextSalaryModel == null && nextWorkContent == null) {
            alert('변경할 값이 없습니다.');
            return;
        }

        const ok = await confirm.batch('일보', selected.length);
        if (!ok.isConfirmed) return;

        setIsLoading(true);
        try {
            const tasks = selected.map((r) => {
                const updates: Partial<DailyReportWorker> = {};
                if (parsedManDay != null) updates.manDay = parsedManDay;
                if (parsedUnitPrice != null) updates.unitPrice = parsedUnitPrice;
                if (nextSalaryModel != null) updates.salaryModel = nextSalaryModel;
                if (nextWorkContent != null) updates.workContent = nextWorkContent;
                if (bulkSiteType) updates.siteType = bulkSiteType;
                if (bulkPaymentType) updates.paymentType = bulkPaymentType;
                if (bulkWorkerTeamName.trim()) updates.workerTeamName = bulkWorkerTeamName.trim();
                return dailyReportService.updateWorkerInReport(r.reportId, r.workerId, updates);
            });

            const batchSize = 10;
            for (let i = 0; i < tasks.length; i += batchSize) {
                await Promise.all(tasks.slice(i, i + batchSize));
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
            // Execute sequentially to prevent race conditions on Report Header Stats (Total ManDay updates)
            // Parallel execution causes multiple requests to read the same initial Total and overwrite each other's decrements.
            let successCount = 0;
            for (const r of selected) {
                try {
                    await dailyReportService.removeWorkerFromReport(r.reportId, r.workerId);
                    successCount++;
                } catch (e) {
                    console.error(`Failed to delete worker ${r.workerName} `, e);
                }
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
                    if (draft.workerId) {
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
                    updates.workerTeamName = draft.workerTeamName ?? '';
                    updates.siteType = draft.siteType;
                    updates.paymentType = draft.paymentType;
                    updates.amount = updates.manDay * updates.unitPrice;

                    const reportLevelUpdates = buildReportLevelUpdates(r, draft);

                    await dailyReportService.updateWorkerInReport(r.reportId, r.workerId, updates);
                    if (Object.keys(reportLevelUpdates).length > 0) {
                        await dailyReportService.updateReport(r.reportId, reportLevelUpdates as any);
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

            setRowDrafts({}); // Clear all drafts (Successful ones are updated via fetchRows, failed ones lost but safer than inconsistent state)
            await fetchRows();
        } catch (error) {
            console.error('[DailyReportListV2] Save All Failed (Critical)', error);
            toast.error('일괄 저장 중 시스템 오류가 발생했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    const isTransferBusy = isLoading || isResettingDb || isDownloadingExcel;

    const handleResetDb = useCallback(async () => {
        const confirmed = await Swal.fire({
            icon: 'warning',
            title: '일보 DB 초기화',
            html: '<div class="text-sm text-slate-600">`daily_reports`와 `daily_report_workers`를 모두 비웁니다.<br />계속하려면 <strong>일보DB초기화</strong>를 입력하세요.</div>',
            input: 'text',
            inputPlaceholder: '일보DB초기화',
            showCancelButton: true,
            confirmButtonText: '초기화',
            cancelButtonText: '취소',
            confirmButtonColor: '#dc2626',
            preConfirm: (value) => {
                if (String(value ?? '').trim() !== '일보DB초기화') {
                    Swal.showValidationMessage('확인 문구가 일치하지 않습니다.');
                }
                return value;
            },
        });
        if (!confirmed.isConfirmed) return;

        setIsResettingDb(true);
        try {
            const result = await dailyReportTransferService.resetDb();
            setSelectedRowKeys(new Set());
            setRowDrafts({});
            await fetchRows();
            toast.success(`DB 초기화 완료 (일보 ${result.reports} / 상세 ${result.legacyRows})`);
        } catch (error) {
            console.error('[DailyReportListV2] DB reset failed', error);
            toast.error('일보 DB 초기화에 실패했습니다.');
        } finally {
            setIsResettingDb(false);
        }
    }, [fetchRows]);

    const handleDownloadExcel = useCallback(async () => {
        if (sortedRows.length === 0) {
            toast.info('다운로드할 행이 없습니다.');
            return;
        }

        setIsDownloadingExcel(true);
        try {
            await dailyReportTransferService.exportRowsToExcel(sortedRows, `${startDate}_${endDate}`);
            toast.success('조회 목록 엑셀 다운로드 완료');
        } catch (error) {
            console.error('[DailyReportListV2] Excel download failed', error);
            toast.error('조회 목록 엑셀 다운로드에 실패했습니다.');
        } finally {
            setIsDownloadingExcel(false);
        }
    }, [endDate, sortedRows, startDate]);

    return (
        <div className="flex h-full flex-col flex-1 min-h-0 gap-3 p-0">
            <div className="flex-shrink-0 bg-white px-3 py-2.5 rounded-xl shadow-sm border border-slate-200 flex flex-wrap gap-2 items-end">
                <div className="flex items-center gap-2 flex-wrap w-full">
                    <div className="flex items-center gap-2">
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
                            placeholder="YYYY-MM-DD"
                            className="px-3 py-2 border-slate-300 rounded-lg text-sm w-[130px]"
                            />

                        <div className="flex gap-1">
                            <button
                                onClick={() => {
                                    const d = new Date();
                                    d.setMonth(d.getMonth() - 1);
                                    d.setDate(1);
                                    const start = formatYmd(d);

                                    const endD = new Date(d.getFullYear(), d.getMonth() + 1, 0);
                                    const end = formatYmd(endD);
                                    applyDateRange(start, end);
                                }}
                                className="px-2 py-1.5 text-xs bg-slate-50 text-slate-600 rounded-lg font-medium hover:bg-slate-100 transition-colors border border-slate-200"
                            >
                                전달
                            </button>
                            <button
                                onClick={() => {
                                    const d = new Date();
                                    d.setDate(1);
                                    const start = formatYmd(d);

                                    const endD = new Date(d.getFullYear(), d.getMonth() + 1, 0);
                                    const end = formatYmd(endD);
                                    applyDateRange(start, end);
                                }}
                                className="px-2 py-1.5 text-xs bg-blue-50 text-blue-600 rounded-lg font-medium hover:bg-blue-100 transition-colors border border-blue-100"
                            >
                                이달
                            </button>
                            <button
                                onClick={() => {
                                    const y = new Date();
                                    y.setDate(y.getDate() - 1);
                                    const yStr = formatYmd(y);
                                    applyDateRange(yStr, yStr);
                                }}
                                className="px-2 py-1.5 text-xs bg-slate-50 text-slate-600 rounded-lg font-medium hover:bg-slate-100 transition-colors border border-slate-200"
                            >
                                어제
                            </button>
                            <button
                                onClick={() => {
                                    applyDateRange(todayStr, todayStr);
                                }}
                                className="px-2 py-1.5 text-xs bg-slate-50 text-slate-600 rounded-lg font-medium hover:bg-slate-100 transition-colors border border-slate-200"
                            >
                                오늘
                            </button>
                        </div>

                        <button
                            onClick={() => {
                                setSortMode('date');
                                setDateSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'));
                            }}
                            className={`px-3 py-2 text-sm rounded-lg font-medium flex items-center gap-2 transition-colors border ${dateSortOrder === 'desc'
                                ? 'bg-indigo-50 text-indigo-600 border-indigo-100'
                                : 'bg-amber-50 text-amber-600 border-amber-100'
                                }`}
                            title="날짜 정렬"
                        >
                            <FontAwesomeIcon icon={dateSortOrder === 'desc' ? faSortAmountDown : faSortAmountUp} />
                        </button>

                        <button
                            onClick={() => {
                                setSortMode('name');
                                setNameSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
                            }}
                            className={`px-3 py-2 text-sm rounded-lg font-medium flex items-center gap-2 transition-colors border ${sortMode === 'name'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                : 'bg-slate-50 text-slate-600 border-slate-200'
                                }`}
                            title="가나다(이름) 정렬"
                        >
                            <span className="text-xs font-bold">이름순</span>
                            <FontAwesomeIcon icon={nameSortOrder === 'asc' ? faSortAmountUp : faSortAmountDown} />
                        </button>

                        <button
                            onClick={() => {
                                setSortMode('site');
                                setSiteSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
                            }}
                            className={`px-3 py-2 text-sm rounded-lg font-medium flex items-center gap-2 transition-colors border ${sortMode === 'site'
                                ? 'bg-amber-50 text-amber-700 border-amber-100'
                                : 'bg-slate-50 text-slate-600 border-slate-200'
                                }`}
                            title="현장명 정렬"
                        >
                            <span className="text-xs font-bold">현장순</span>
                            <FontAwesomeIcon icon={siteSortOrder === 'asc' ? faSortAmountUp : faSortAmountDown} />
                        </button>
                    </div>

                    <div className="flex gap-2 flex-wrap">
                        <select
                            value={selectedSiteId}
                            onChange={(e) => setSelectedSiteId(e.target.value)}
                            className="px-3 py-2 border-slate-300 rounded-lg text-sm min-w-[120px]"
                        >
                            <option value="">전체 현장</option>
                            {[...availableSites].sort((a, b) => a.name.localeCompare(b.name, 'ko')).map((s) => (
                                <option key={String(s.id)} value={String(s.id)}>{s.name}</option>
                            ))}
                        </select>

                        <select
                            value={selectedTeamId}
                            onChange={(e) => setSelectedTeamId(e.target.value)}
                            className="px-3 py-2 border-slate-300 rounded-lg text-sm min-w-[120px]"
                        >
                            <option value="">전체 현장담당팀</option>
                            {availableReportTeams.map((t) => (
                                <option key={String(t.id)} value={String(t.id)}>{t.name}</option>
                            ))}
                        </select>

                        <select
                            value={selectedWorkerTeamId}
                            onChange={(e) => setSelectedWorkerTeamId(e.target.value)}
                            className="px-3 py-2 border-slate-300 rounded-lg text-sm min-w-[120px] bg-slate-50"
                        >
                            <option value="">전체 소속팀</option>
                            {availableWorkerTeams.map((t) => (
                                <option key={String(t.id)} value={String(t.id)}>{t.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="relative w-48">
                        <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={workerSearch}
                            onChange={(e) => setWorkerSearch(e.target.value)}
                            placeholder="작업자 검색"
                            className="w-full pl-10 pr-4 py-2 border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all"
                        />
                    </div>

                    <button
                        onClick={handleToggleEditMode}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold shadow-sm whitespace-nowrap border transition-colors ${isEditMode
                            ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                            }`}
                    >
                        <FontAwesomeIcon icon={faPenToSquare} />
                        {isEditMode ? '수정 종료' : '수정모드'}
                    </button>

                    <button
                        onClick={() => setIsFixed(!isFixed)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold shadow-sm whitespace-nowrap border transition-colors ${isFixed
                            ? 'bg-amber-500 text-white border-amber-500 hover:bg-amber-600'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                            }`}
                    >
                        <FontAwesomeIcon icon={faThumbtack} className={isFixed ? 'rotate-45' : ''} />
                        {isFixed ? '틀고정 해제' : '틀고정 활성'}
                    </button>

                    {isEditMode && (
                        <>
                            <button
                                onClick={() => setIsBulkEditOpen(true)}
                                disabled={selectedRowKeys.size === 0}
                                className={`px-4 py-2 rounded-lg text-sm font-bold shadow-sm whitespace-nowrap border transition-colors ${selectedRowKeys.size > 0
                                    ? 'bg-indigo-100 text-indigo-700 border-indigo-200 hover:bg-indigo-200'
                                    : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                                    }`}
                                title="선택 항목 일괄 수정"
                            >
                                일괄수정 ({selectedRowKeys.size})
                            </button>

                            <button
                                onClick={handleBulkDelete}
                                disabled={selectedRowKeys.size === 0}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold shadow-sm whitespace-nowrap border transition-colors ${selectedRowKeys.size > 0
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

                    <button
                        onClick={handleSearch}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg text-sm font-bold shadow-sm flex items-center gap-2 transition-transform active:scale-95 ml-auto"
                    >
                        <FontAwesomeIcon icon={faSearch} />
                        조회
                    </button>

                    <button
                        onClick={() => { void handleResetDb(); }}
                        disabled={isTransferBusy}
                            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-bold shadow-sm whitespace-nowrap border transition-colors ${isTransferBusy
                            ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                            : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                            }`}
                    >
                        <FontAwesomeIcon icon={isResettingDb ? faSpinner : faTrashCan} spin={isResettingDb} />
                        DB초기화
                    </button>

                    <button
                        onClick={() => { void handleDownloadExcel(); }}
                        disabled={isTransferBusy}
                            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-bold shadow-sm whitespace-nowrap border transition-colors ${isTransferBusy
                            ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                            }`}
                    >
                        <FontAwesomeIcon icon={isDownloadingExcel ? faSpinner : faDownload} spin={isDownloadingExcel} />
                        조회목록 엑셀다운로드
                    </button>

                    {dirtyRowCount > 0 && (
                        <button
                            onClick={handleSaveAllDirtyRows}
                            disabled={isLoading}
                            className="bg-red-500 hover:bg-red-600 text-white px-4 py-1.5 rounded-lg text-sm font-bold shadow-sm flex items-center gap-2 transition-transform active:scale-95 ml-2 animate-pulse"
                            title="변경된 모든 항목 저장"
                        >
                            <FontAwesomeIcon icon={faSave} />
                            전체 저장 ({dirtyRowCount})
                        </button>
                    )}

                    <div className="bg-slate-800 text-white px-4 py-2 rounded-lg shadow-sm flex items-center gap-2 ml-2">
                        <span className="text-xs font-light text-slate-300">Total</span>
                        <span className="font-bold text-lg">{totals.totalManDay.toFixed(1)}</span>
                        <span className="text-xs">공수</span>
                        <span className="ml-2 text-xs font-light text-slate-300">|</span>
                        <span className="font-bold text-lg">{formatNumber(Math.round(totals.totalAmount))}</span>
                        <span className="text-xs">원</span>
                    </div>
                </div>
                {isEditMode && (
                    <div className="w-full flex items-center gap-2 text-xs text-slate-500">
                        <span className="px-2 py-1 rounded-full bg-indigo-50 text-indigo-600 font-semibold">수정중</span>
                        <span>급여방식, 공수, 단가, 비고를 수정한 뒤 각 행 오른쪽 저장 또는 상단 전체 저장을 사용하세요.</span>
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

            <div className="flex-1 min-h-0 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
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
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600 mb-2"></div>
                        <span className="text-sm font-medium">불러오는 중...</span>
                    </div>
                ) : sortedRows.length === 0 ? (
                    <div className="sheet-table-wrapper workbook-frozen-table-wrapper">
                        <table className="sheet-table daily-report-workbook-table">
                            <tbody>
                                <tr>
                                    <td
                                        colSpan={isEditMode ? 14 : 12}
                                        className="sheet-empty-state"
                                    >
                                        조건에 맞는 작업자 내역이 없습니다.
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="sheet-table-wrapper workbook-frozen-table-wrapper">
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
                                    `px-2.5 py-2 whitespace-nowrap w-[86px] ${isFixed ? `sticky z-40 bg-[#2e75b6] border-r border-[#255e94] ${isEditMode ? 'left-[48px]' : 'left-0'}` : ''}`
                                )}
                                {renderFilterHeader(
                                    'siteName',
                                    '현장',
                                    `px-2.5 py-2 whitespace-nowrap w-[168px] ${isFixed ? `sticky z-40 bg-[#2e75b6] border-r border-[#255e94] ${isEditMode ? 'left-[134px]' : 'left-[86px]'}` : ''}`
                                )}
                                {renderFilterHeader('siteType', '현장구분', 'px-2.5 py-2 whitespace-nowrap')}
                                {renderFilterHeader('paymentType', '결제구분', 'px-2.5 py-2 whitespace-nowrap')}
                                {renderFilterHeader('teamName', '현장담당팀', 'px-2.5 py-2 whitespace-nowrap')}
                                {renderFilterHeader(
                                    'workerName',
                                    '이름',
                                    `px-2.5 py-2 whitespace-nowrap w-[112px] ${isFixed ? `sticky z-40 bg-[#2e75b6] border-r-2 border-[#255e94] shadow-[2px_0_5px_rgba(0,0,0,0.05)] ${isEditMode ? 'left-[302px]' : 'left-[254px]'}` : ''}`
                                )}
                                {renderFilterHeader('workerTeamName', '소속팀', 'px-2.5 py-2 whitespace-nowrap')}
                                {renderFilterHeader('salaryModel', '급여방식', 'px-2.5 py-2 whitespace-nowrap')}
                                {renderFilterHeader('manDay', '공수', 'px-2.5 py-2 whitespace-nowrap text-right', 'right')}
                                {renderFilterHeader('unitPrice', '단가', 'px-2.5 py-2 whitespace-nowrap text-right', 'right')}
                                {renderFilterHeader('amount', '금액', 'px-2.5 py-2 whitespace-nowrap text-right', 'right')}
                                <th className="px-2.5 py-2 whitespace-nowrap">비고</th>
                                {isEditMode && (
                                    <th className="px-2.5 py-2 whitespace-nowrap text-center sticky right-0 z-40 bg-[#2e75b6] border-l border-[#255e94]">
                                        관리
                                    </th>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {sortedRows.map((r) => (
                                (() => {
                                    const rowKey = getRowKey(r);
                                    const draft = rowDrafts[rowKey];
                                    const saving = rowSavingKeys.has(rowKey);
                                    const dirty = isRowDirty(r, draft);

                                    const effectiveManDay = draft ? Number(draft.manDay) : (Number.isFinite(r.manDay) ? r.manDay : 0);
                                    const effectiveUnitPrice = draft ? Number(draft.unitPrice) : (Number.isFinite(r.unitPrice) ? r.unitPrice : 0);
                                    const previewAmount = Number.isFinite(effectiveManDay) && Number.isFinite(effectiveUnitPrice)
                                        ? effectiveManDay * effectiveUnitPrice
                                        : (Number.isFinite(r.amount) ? r.amount : 0);

                                    const effectiveSalaryModel = draft ? draft.salaryModel : String(r.salaryModel ?? r.payType ?? '');
                                    const effectiveWorkContent = draft ? draft.workContent : String(r.workContent ?? '');
                                    const effectiveSiteId = draft ? draft.siteId : normalizeSiteId(r.siteId);
                                    const stickyActionCellBg = selectedRowKeys.has(rowKey) ? 'bg-indigo-50' : 'bg-white';

                                    return (
                                        <tr
                                            key={rowKey}
                                            className={`border-b border-slate-100 hover:bg-slate-50 ${selectedRowKeys.has(rowKey) ? 'bg-indigo-50/50' : ''} ${dirty ? 'ring-1 ring-indigo-200' : ''} transition-colors`}
                                        >
                                            {isEditMode && (
                                                <td className={`px-2.5 py-2 whitespace-nowrap w-[48px] ${isFixed ? 'sticky left-0 z-20 bg-white border-r border-slate-100' : ''}`}>
                                                    <input
                                                        type="checkbox"
                                                        className="w-4 h-4 text-brand-600 bg-gray-100 border-gray-300 rounded focus:ring-brand-500"
                                                        checked={selectedRowKeys.has(rowKey)}
                                                        onChange={() => toggleSelectRow(rowKey)}
                                                        title="선택"
                                                    />
                                                </td>
                                            )}
                                            <td className={`px-2.5 py-2 whitespace-nowrap text-slate-500 w-[86px] ${isFixed ? `sticky z-20 bg-white border-r border-slate-100 ${isEditMode ? 'left-[48px]' : 'left-0'}` : ''}`}>{r.date ?? ''}</td>
                                            <td className={`px-2.5 py-2 whitespace-nowrap w-[168px] ${isFixed ? `sticky z-20 bg-white border-r border-slate-100 ${isEditMode ? 'left-[134px]' : 'left-[86px]'}` : ''}`}>
                                                {isEditMode ? (
                                                    <select
                                                        value={effectiveSiteId}
                                                        onChange={(e) => setRowDraft(r, { siteId: e.target.value })}
                                                        disabled={saving}
                                                        className="px-2 py-1 border border-slate-300 rounded text-sm w-[146px] bg-white"
                                                    >
                                                        <option value="">-</option>
                                                        {siteOptions.map((site) => (
                                                            <option key={String(site.id)} value={String(site.id)}>
                                                                {site.name}
                                                            </option>
                                                        ))}
                                                    </select>
                                                ) : (
                                                    (r.siteName ?? '')
                                                )}
                                            </td>
                                            <td className="px-2.5 py-2 whitespace-nowrap">
                                                {isEditMode ? (
                                                    <select
                                                        value={draft ? draft.siteType : (r.siteType ?? '')}
                                                        onChange={(e) => setRowDraft(r, { siteType: e.target.value })}
                                                        disabled={saving}
                                                        className="px-2 py-1 border border-slate-300 rounded text-sm w-[94px] bg-white"
                                                    >
                                                        <option value="">-</option>
                                                        <option value="도급">도급</option>
                                                        <option value="직영">직영</option>
                                                        <option value="지원">지원</option>
                                                    </select>
                                                ) : (
                                                    (r.siteType ?? '')
                                                )}
                                            </td>
                                            <td className="px-2.5 py-2 whitespace-nowrap">
                                                {isEditMode ? (
                                                    <select
                                                        value={draft ? draft.paymentType : (r.paymentType ?? '')}
                                                        onChange={(e) => setRowDraft(r, { paymentType: e.target.value })}
                                                        disabled={saving}
                                                        className="px-2 py-1 border border-slate-300 rounded text-sm w-[94px] bg-white"
                                                    >
                                                        <option value="">-</option>
                                                        <option value="노무">노무</option>
                                                        <option value="계산서">계산서</option>
                                                    </select>
                                                ) : (
                                                    (r.paymentType ?? '')
                                                )}
                                            </td>
                                            <td className="px-2.5 py-2 whitespace-nowrap">{r.teamName ?? ''}</td>
                                            <td className={`px-2.5 py-2 whitespace-nowrap font-semibold w-[112px] ${isFixed ? `sticky z-20 bg-white border-r-2 border-slate-300 shadow-[2px_0_5px_rgba(0,0,0,0.05)] ${isEditMode ? 'left-[302px]' : 'left-[254px]'}` : ''}`}>
                                                {isEditMode ? (
                                                    <>
                                                        <input
                                                            list="worker-list-v2"
                                                            type="text"
                                                            value={draft ? (draft.workerName ?? r.workerName) : r.workerName}
                                                            onChange={(e) => handleWorkerNameChange(r, e.target.value)}
                                                            disabled={saving}
                                                            className="px-2 py-1 border border-slate-300 rounded text-sm w-[94px] bg-white"
                                                        />
                                                    </>
                                                ) : (
                                                    r.workerName
                                                )}
                                            </td>
                                            <td className="px-2.5 py-2 whitespace-nowrap">
                                                {isEditMode ? (
                                                    <input
                                                        type="text"
                                                        value={draft ? (draft.workerTeamName ?? r.workerTeamName ?? '') : (r.workerTeamName ?? '')}
                                                        onChange={(e) => setRowDraft(r, { workerTeamName: e.target.value })}
                                                        disabled={saving}
                                                        className="px-2 py-1 border border-slate-300 rounded text-sm w-[104px] bg-white"
                                                        placeholder="소속팀"
                                                    />
                                                ) : (
                                                    (r.workerTeamName ?? '')
                                                )}
                                            </td>
                                            <td className="px-2.5 py-2 whitespace-nowrap">
                                                {isEditMode ? (
                                                    <input
                                                        type="text"
                                                        list="daily-report-v2-salary-model-options"
                                                        value={effectiveSalaryModel}
                                                        onChange={(e) => setRowDraft(r, { salaryModel: e.target.value })}
                                                        disabled={saving}
                                                        className="px-2 py-1 border border-slate-300 rounded text-sm w-[112px] bg-white"
                                                        placeholder="급여방식"
                                                    />
                                                ) : (
                                                    (r.salaryModel ?? r.payType ?? '')
                                                )}
                                            </td>
                                            <td className="px-2.5 py-2 whitespace-nowrap text-right">
                                                {isEditMode ? (
                                                    <input
                                                        type="number"
                                                        value={draft ? draft.manDay : (Number.isFinite(r.manDay) ? String(r.manDay) : '0')}
                                                        onChange={(e) => setRowDraft(r, { manDay: e.target.value })}
                                                        disabled={saving}
                                                        className="px-2 py-1 border border-slate-300 rounded text-sm w-[72px] text-right bg-white"
                                                    />
                                                ) : (
                                                    (Number.isFinite(r.manDay) ? r.manDay : 0).toFixed(1)
                                                )}
                                            </td>
                                            <td className="px-2.5 py-2 whitespace-nowrap text-right">
                                                {isEditMode ? (
                                                    <input
                                                        type="number"
                                                        value={draft ? draft.unitPrice : (Number.isFinite(r.unitPrice) ? String(r.unitPrice) : '0')}
                                                        onChange={(e) => setRowDraft(r, { unitPrice: e.target.value })}
                                                        disabled={saving}
                                                        className="px-2 py-1 border border-slate-300 rounded text-sm w-[92px] text-right bg-white"
                                                    />
                                                ) : (
                                                    formatNumber(Math.round(Number.isFinite(r.unitPrice) ? r.unitPrice : 0))
                                                )}
                                            </td>
                                            <td className="px-2.5 py-2 whitespace-nowrap text-right font-bold">
                                                {formatNumber(Math.round(previewAmount))}
                                            </td>
                                            <td className="px-2.5 py-2 min-w-[240px]">
                                                {isEditMode ? (
                                                    <div className="flex flex-col gap-2">
                                                        <textarea
                                                            value={effectiveWorkContent}
                                                            onChange={(e) => setRowDraft(r, { workContent: e.target.value })}
                                                            disabled={saving}
                                                            className="px-2 py-1 border border-slate-300 rounded text-sm w-full bg-white min-h-[54px] resize-y"
                                                            placeholder="작업 내용 입력"
                                                        />
                                                    </div>
                                                ) : (
                                                    <div className="max-h-[60px] overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed scrollbar-thin scrollbar-thumb-slate-200">
                                                        {(r.workContent ?? '') || <span className="text-slate-300 italic">내역 없음</span>}
                                                    </div>
                                                )}
                                            </td>
                                            {isEditMode && (
                                                <td className={`px-2.5 py-2 whitespace-nowrap sticky right-0 z-20 border-l border-slate-100 ${stickyActionCellBg}`}>
                                                    <div className="flex items-center gap-1.5 min-w-[82px]">
                                                        <button
                                                            onClick={() => handleSaveRow(r)}
                                                            disabled={!dirty || saving}
                                                            className={`flex-1 px-2 py-1 rounded text-[11px] font-bold border ${(!dirty || saving)
                                                                ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                                                                : 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700'
                                                                }`}
                                                        >
                                                            {saving ? '저장중' : '저장'}
                                                        </button>
                                                        <button
                                                            onClick={() => clearRowDraft(rowKey)}
                                                            disabled={saving || !draft}
                                                            className={`flex-1 px-2 py-1 rounded text-[11px] font-bold border ${(saving || !draft)
                                                                ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                                                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                                                }`}
                                                        >
                                                            취소
                                                        </button>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })()
                            ))}
                        </tbody>
                        <tfoot>
                            <tr>
                                {isEditMode && <td />}
                                <td colSpan={8}>합계</td>
                                <td className="align-right">{totals.totalManDay.toFixed(1)}</td>
                                <td />
                                <td className="align-right">{formatNumber(Math.round(totals.totalAmount))}</td>
                                <td />
                                {isEditMode && <td />}
                            </tr>
                        </tfoot>
                    </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DailyReportListV2;
