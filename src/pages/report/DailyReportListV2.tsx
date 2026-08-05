import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faPenToSquare,
    faSave,
    faFilter,
    faSpinner,
    faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { dailyReportService, DailyReportWorker, DailyReportWorkerRow } from '../../services/dailyReportService';
import { dailyReportTransferService } from '../../services/dailyReportTransferService';
import { fileTransferAuditService } from '../../services/fileTransferAuditService';
import { teamService, Team } from '../../services/teamService';
import { manpowerService, Worker } from '../../services/manpowerService';
import { siteService, Site } from '../../services/siteService';
import { companyService, Company } from '../../services/companyService';
import { confirm, toast } from '../../utils/swal';
import { normalizeTypedDateInput, sanitizeTypedDateInput } from '../../utils/typedDateInput';
import { loadSessionState, saveSessionState } from '../../utils/sessionStorage';
import { resolveReportPayType, resolveWorkerPayType } from '../../utils/payType';
import SingleSelectPopover, { InputPopover } from '../../components/common/SingleSelectPopover';
import DailyReportListSummary from './components/DailyReportListSummary';
import DailyReportMobileList, { DailyReportMobileRow } from './components/DailyReportMobileList';
import {
    DailyReportListEmptyState,
    DailyReportListErrorState,
    DailyReportListLoadingState,
} from './components/DailyReportListStates';
import DailyReportListToolbar, {
    DailyReportDatePresetKey,
    DailyReportSortMode,
} from './components/DailyReportListToolbar';
import { buildDailyReportListSummary } from './dailyReportListMetrics';
import {
    useWorkerAccessScope,
    workerAccessMatchesReportRow,
    workerAccessMatchesSite,
    workerAccessMatchesTeam,
    workerAccessMatchesWorker,
} from '../../hooks/useWorkerAccessScope';
import '../taxinvoice/WorkbookLedgerPage.css';
import './DailyReportListV2.css';

interface DailyReportListV2Props {
    initialDate?: string;
    initialSiteId?: string;
    targetReportId?: string;
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

const INLINE_EDIT_ALL_ROW_LIMIT = 80;
const VIRTUAL_ROW_LIMIT = 160;
const VIRTUAL_ROW_HEIGHT = 42;
const VIRTUAL_OVERSCAN_ROWS = 12;

type RowDraft = {
    siteId: string;
    companyId: string;
    companyName: string;
    constructorCompanyId: string;
    constructorCompanyName: string;
    partnerId: string;
    partnerName: string;
    teamId: string;
    responsibleTeamId: string;
    responsibleTeamName: string;
    siteManagerId: string;
    siteManagerName: string;
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

type WorkerDraftValidation =
    | { ok: true; manDay: number; unitPrice: number }
    | { ok: false; message: string };

const parseNonNegativeDraftNumber = (value: unknown, label: string): { ok: true; value: number } | { ok: false; message: string } => {
    const text = String(value ?? '').trim();
    if (text === '') {
        return { ok: false, message: `${label} 값을 입력해 주세요.` };
    }

    const numberValue = Number(text);
    if (!Number.isFinite(numberValue) || numberValue < 0) {
        return { ok: false, message: `${label}은 0 이상 숫자로 입력해 주세요.` };
    }

    return { ok: true, value: numberValue };
};

type ColumnFilterKey =
    | 'date'
    | 'siteName'
    | 'companyName'
    | 'constructorCompanyName'
    | 'partnerName'
    | 'siteType'
    | 'paymentType'
    | 'teamName'
    | 'siteManagerName'
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
const SITE_NAME_FILTER_PREFIX = '__site_name__:';

const clearDailyReportBoardDrafts = (dates: Iterable<string>) => {
    if (typeof window === 'undefined') return;
    Array.from(new Set(Array.from(dates).filter(Boolean))).forEach((date) => {
        window.localStorage.removeItem(`${DAILY_REPORT_BOARD_DRAFT_STORAGE_PREFIX}:${date}`);
    });
};

type DatePresetKey = DailyReportDatePresetKey;

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

const normalizeDateParam = (value?: string | null): string | null => {
    return value ? normalizeTypedDateInput(value) : null;
};

const parseSortModeParam = (value?: string | null): DailyReportListViewState['sortMode'] | null => {
    return value === 'date' || value === 'name' || value === 'site' ? value : null;
};

const parseSortOrderParam = (value?: string | null): 'asc' | 'desc' | null => {
    return value === 'asc' || value === 'desc' ? value : null;
};

const DailyReportListV2: React.FC<DailyReportListV2Props> = ({ initialDate, initialSiteId, targetReportId }) => {
    const [searchParams, setSearchParams] = useSearchParams();
    const lastSyncedSearchRef = useRef(searchParams.toString());
    const todayStr = formatYmd(new Date());
    const hasUrlListState = searchParams.has('date')
        || searchParams.has('startDate')
        || searchParams.has('endDate')
        || searchParams.has('siteId')
        || searchParams.has('teamId')
        || searchParams.has('workerTeamId')
        || searchParams.has('q')
        || searchParams.has('workerSearch')
        || searchParams.has('sort')
        || searchParams.has('order');
    const urlDate = normalizeDateParam(searchParams.get('date') ?? initialDate);
    const urlStartDate = normalizeDateParam(searchParams.get('startDate')) ?? urlDate;
    const urlEndDate = normalizeDateParam(searchParams.get('endDate')) ?? urlDate ?? urlStartDate;
    const hasUrlDateRange = !!(urlStartDate && urlEndDate);
    const urlSelectedSiteId = searchParams.has('siteId') ? (searchParams.get('siteId') ?? '') : (hasUrlListState ? '' : (initialSiteId ?? ''));
    const urlSelectedTeamId = searchParams.has('teamId') ? (searchParams.get('teamId') ?? '') : (hasUrlListState ? '' : null);
    const urlSelectedWorkerTeamId = searchParams.has('workerTeamId') ? (searchParams.get('workerTeamId') ?? '') : (hasUrlListState ? '' : null);
    const urlWorkerSearch = searchParams.has('q')
        ? (searchParams.get('q') ?? '')
        : (searchParams.has('workerSearch') ? (searchParams.get('workerSearch') ?? '') : (hasUrlListState ? '' : null));
    const urlSortMode = parseSortModeParam(searchParams.get('sort'));
    const urlSortOrder = parseSortOrderParam(searchParams.get('order'));
    const defaultDate = urlStartDate || initialDate || todayStr;
    const persistedViewState = useMemo(() => {
        const fallback: DailyReportListViewState = {
            startDate: defaultDate,
            endDate: defaultDate,
            startDateInput: defaultDate,
            endDateInput: defaultDate,
            selectedTeamId: urlSelectedTeamId ?? '',
            selectedWorkerTeamId: urlSelectedWorkerTeamId ?? '',
            selectedSiteId: urlSelectedSiteId,
            workerSearch: urlWorkerSearch ?? '',
            dateSortOrder: 'desc',
            sortMode: urlSortMode ?? 'date',
            nameSortOrder: 'asc',
            siteSortOrder: 'asc',
            columnFilters: {}
        };
        const persisted = loadSessionState<DailyReportListViewState>(DAILY_REPORT_LIST_VIEW_KEY, fallback);

        const nextState: DailyReportListViewState = {
            ...persisted,
            ...(hasUrlDateRange && urlStartDate && urlEndDate ? {
                startDate: urlStartDate,
                endDate: urlEndDate,
                startDateInput: urlStartDate,
                endDateInput: urlEndDate
            } : {}),
            ...(hasUrlListState || initialSiteId ? { selectedSiteId: urlSelectedSiteId } : {}),
            ...(urlSelectedTeamId !== null ? { selectedTeamId: urlSelectedTeamId } : {}),
            ...(urlSelectedWorkerTeamId !== null ? { selectedWorkerTeamId: urlSelectedWorkerTeamId } : {}),
            ...(urlWorkerSearch !== null ? { workerSearch: urlWorkerSearch } : {}),
            ...(urlSortMode ? { sortMode: urlSortMode } : {})
        };

        if (urlSortMode && urlSortOrder) {
            if (urlSortMode === 'date') nextState.dateSortOrder = urlSortOrder;
            if (urlSortMode === 'name') nextState.nameSortOrder = urlSortOrder;
            if (urlSortMode === 'site') nextState.siteSortOrder = urlSortOrder;
        }

        return nextState;
    }, [
        defaultDate,
        hasUrlListState,
        hasUrlDateRange,
        initialSiteId,
        searchParams,
        urlEndDate,
        urlSelectedSiteId,
        urlSelectedTeamId,
        urlSelectedWorkerTeamId,
        urlSortMode,
        urlSortOrder,
        urlStartDate,
        urlWorkerSearch
    ]);

    const [rows, setRows] = useState<DailyReportWorkerRow[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [sites, setSites] = useState<Site[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [allWorkers, setAllWorkers] = useState<Worker[]>([]);
    const workerAccessScope = useWorkerAccessScope(allWorkers, teams);
    const isScopedReadOnly = !workerAccessScope.loading && workerAccessScope.mode !== 'all';
    const siteOptions = useMemo(() => {
        return sites
            .filter((site) => !workerAccessScope.loading && workerAccessMatchesSite(workerAccessScope, site))
            .sort((a, b) => compareKo(a.name ?? '', b.name ?? ''));
    }, [sites, workerAccessScope]);
    const sortedTeamsByName = useMemo(() => {
        return teams
            .filter((team) => !workerAccessScope.loading && workerAccessMatchesTeam(workerAccessScope, team))
            .sort((a, b) => compareKo(a.name ?? '', b.name ?? ''));
    }, [teams, workerAccessScope]);
    const companyOptions = useMemo(() => {
        if (workerAccessScope.loading || workerAccessScope.mode !== 'all') return [];
        return [...companies].sort((a, b) => compareKo(a.name ?? '', b.name ?? ''));
    }, [companies, workerAccessScope.loading, workerAccessScope.mode]);
    const [isQueryLoading, setIsQueryLoading] = useState(false);
    const [isMutationLoading, setIsMutationLoading] = useState(false);
    const [queryLoadingMessage, setQueryLoadingMessage] = useState('');
    const [queryError, setQueryError] = useState<string | null>(null);
    const [dateRangeError, setDateRangeError] = useState<string | null>(null);
    const [referenceDataError, setReferenceDataError] = useState<string | null>(null);
    const queryRequestIdRef = useRef(0);

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
    const [showSiteDetailColumns, setShowSiteDetailColumns] = useState(false);
    const [mobileViewMode, setMobileViewMode] = useState<'cards' | 'table'>('cards');
    const isFixed = true;

    const [selectedRowKeys, setSelectedRowKeys] = useState<Set<string>>(new Set());
    const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);

    const [rowDrafts, setRowDrafts] = useState<Record<string, RowDraft>>({});
    const [rowSavingKeys, setRowSavingKeys] = useState<Set<string>>(new Set());
    const [activeEditRowKey, setActiveEditRowKey] = useState<string | null>(null);
    const tableScrollRef = useRef<HTMLDivElement | null>(null);
    const [tableViewport, setTableViewport] = useState({ scrollTop: 0, height: 0 });

    const [bulkManDay, setBulkManDay] = useState('');
    const [bulkUnitPrice, setBulkUnitPrice] = useState('');
    const [bulkSalaryModel, setBulkSalaryModel] = useState('');
    const [bulkWorkContent, setBulkWorkContent] = useState('');
    const [bulkSiteType, setBulkSiteType] = useState('');
    const [bulkPaymentType, setBulkPaymentType] = useState('');
    const [bulkWorkerTeamName, setBulkWorkerTeamName] = useState('');
    const [bulkCompanyName, setBulkCompanyName] = useState('');
    const [bulkConstructorCompanyName, setBulkConstructorCompanyName] = useState('');
    const [bulkPartnerName, setBulkPartnerName] = useState('');
    const [bulkResponsibleTeamName, setBulkResponsibleTeamName] = useState('');
    const [bulkSiteManagerName, setBulkSiteManagerName] = useState('');
    const [columnFilters, setColumnFilters] = useState<ColumnFilterState>(persistedViewState.columnFilters);
    const [openColumnFilter, setOpenColumnFilter] = useState<ColumnFilterKey | null>(null);
    const [columnFilterSearch, setColumnFilterSearch] = useState('');
    const [pendingColumnFilterValues, setPendingColumnFilterValues] = useState<string[] | null>(null);
    const filterMenuRef = React.useRef<HTMLDivElement | null>(null);
    const [isDownloadingExcel, setIsDownloadingExcel] = useState(false);

    const appliedRangeRef = useRef({ startDate, endDate });
    appliedRangeRef.current = { startDate, endDate };

    const loadReferenceData = useCallback(async () => {
        setReferenceDataError(null);
        const results = await Promise.allSettled([
            teamService.getTeams(),
            siteService.getSites(),
            manpowerService.getWorkers(),
            companyService.getActiveCompanies(),
        ] as const);

        const [teamsResult, sitesResult, workersResult, companiesResult] = results;
        if (teamsResult.status === 'fulfilled') setTeams(teamsResult.value);
        else console.error('[DailyReportListV2] Failed to fetch teams', teamsResult.reason);

        if (sitesResult.status === 'fulfilled') setSites(sitesResult.value);
        else console.error('[DailyReportListV2] Failed to fetch sites', sitesResult.reason);

        if (workersResult.status === 'fulfilled') setAllWorkers(workersResult.value);
        else console.error('[DailyReportListV2] Failed to fetch workers', workersResult.reason);

        if (companiesResult.status === 'fulfilled') setCompanies(companiesResult.value);
        else console.error('[DailyReportListV2] Failed to fetch companies', companiesResult.reason);

        const failedCount = results.filter((result) => result.status === 'rejected').length;
        if (failedCount > 0) {
            setReferenceDataError(`필터 기준정보 ${failedCount}개를 불러오지 못했습니다.`);
        }
    }, []);

    useEffect(() => {
        void loadReferenceData();
    }, [loadReferenceData]);

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

    const teamScopeIdsKey = JSON.stringify(
        workerAccessScope.mode === 'team' ? [...workerAccessScope.teamIds].sort() : []
    );
    const effectiveTeamScopeIds = useMemo<string[]>(() => JSON.parse(teamScopeIdsKey), [teamScopeIdsKey]);
    const selfScopeIdentityKey = JSON.stringify([
        ...workerAccessScope.workerIds,
        ...workerAccessScope.workerUids,
        ...workerAccessScope.workerNames,
    ].sort());
    const hasSelfScopeIdentity = selfScopeIdentityKey !== '[]';

    const runRowsQuery = useCallback(async (queryStartDate: string, queryEndDate: string): Promise<void> => {
        const requestId = ++queryRequestIdRef.current;
        if (workerAccessScope.loading) return;
        if (
            workerAccessScope.mode === 'self' &&
            !hasSelfScopeIdentity
        ) {
            setRows([]);
            setQueryError(null);
            setIsQueryLoading(false);
            setQueryLoadingMessage('');
            return;
        }
        setQueryLoadingMessage('출력일보 목록을 불러오는 중');
        setQueryError(null);
        setIsQueryLoading(true);
        try {
            const teamIds = workerAccessScope.mode === 'team'
                ? effectiveTeamScopeIds
                : undefined;
            const data = await dailyReportService.getReportWorkerRowsByRange({
                startDate: queryStartDate,
                endDate: queryEndDate,
                teamIds,
            });
            if (requestId !== queryRequestIdRef.current) return;
            setRows(data);
        } catch (error) {
            console.error('[DailyReportListV2] Failed to fetch rows', error);
            if (requestId !== queryRequestIdRef.current) return;
            setQueryError('네트워크 상태를 확인한 뒤 다시 시도해 주세요.');
        } finally {
            if (requestId === queryRequestIdRef.current) {
                setIsQueryLoading(false);
                setQueryLoadingMessage('');
            }
        }
    }, [effectiveTeamScopeIds, hasSelfScopeIdentity, workerAccessScope.loading, workerAccessScope.mode]);

    const fetchRows = useCallback(async (): Promise<void> => {
        const range = appliedRangeRef.current;
        await runRowsQuery(range.startDate, range.endDate);
    }, [runRowsQuery]);

    useEffect(() => {
        void runRowsQuery(startDate, endDate);
    }, [endDate, runRowsQuery, selfScopeIdentityKey, startDate, teamScopeIdsKey]);

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
            return normalizedValue;
        }

        setEndDateInput(normalizedValue);
        return normalizedValue;
    }, [endDate, endDateInput, startDate, startDateInput]);

    const applyDateRange = useCallback((nextStartDate: string, nextEndDate: string) => {
        setStartDateInput(nextStartDate);
        setEndDateInput(nextEndDate);
        setStartDate(nextStartDate);
        setEndDate(nextEndDate);
    }, []);

    useEffect(() => {
        const currentSearch = searchParams.toString();
        if (currentSearch === lastSyncedSearchRef.current) return;

        lastSyncedSearchRef.current = currentSearch;

        if (urlStartDate && urlEndDate) {
            applyDateRange(urlStartDate, urlEndDate);
        }

        if (hasUrlListState || initialSiteId) {
            setSelectedSiteId(urlSelectedSiteId);
        }

        if (urlSelectedTeamId !== null) {
            setSelectedTeamId(urlSelectedTeamId);
        }

        if (urlSelectedWorkerTeamId !== null) {
            setSelectedWorkerTeamId(urlSelectedWorkerTeamId);
        }

        if (urlWorkerSearch !== null) {
            setWorkerSearch(urlWorkerSearch);
        }

        if (urlSortMode) {
            setSortMode(urlSortMode);
        }

        if (urlSortMode && urlSortOrder) {
            if (urlSortMode === 'date') setDateSortOrder(urlSortOrder);
            if (urlSortMode === 'name') setNameSortOrder(urlSortOrder);
            if (urlSortMode === 'site') setSiteSortOrder(urlSortOrder);
        }
    }, [
        hasUrlListState,
        initialSiteId,
        applyDateRange,
        searchParams,
        urlEndDate,
        urlSelectedSiteId,
        urlSelectedTeamId,
        urlSelectedWorkerTeamId,
        urlSortMode,
        urlSortOrder,
        urlStartDate,
        urlWorkerSearch
    ]);

    useEffect(() => {
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            next.set('tab', 'list-v2');

            if (startDate === endDate) {
                next.set('date', startDate);
                next.delete('startDate');
                next.delete('endDate');
            } else {
                next.delete('date');
                next.set('startDate', startDate);
                next.set('endDate', endDate);
            }

            if (selectedSiteId) next.set('siteId', selectedSiteId);
            else next.delete('siteId');

            if (selectedTeamId) next.set('teamId', selectedTeamId);
            else next.delete('teamId');

            if (selectedWorkerTeamId) next.set('workerTeamId', selectedWorkerTeamId);
            else next.delete('workerTeamId');

            const trimmedWorkerSearch = workerSearch.trim();
            if (trimmedWorkerSearch) next.set('q', trimmedWorkerSearch);
            else {
                next.delete('q');
                next.delete('workerSearch');
            }

            next.set('sort', sortMode);
            next.set('order', sortMode === 'date' ? dateSortOrder : sortMode === 'name' ? nameSortOrder : siteSortOrder);

            const nextSearch = next.toString();
            if (nextSearch !== prev.toString()) {
                lastSyncedSearchRef.current = nextSearch;
                return next;
            }
            return prev;
        }, { replace: true });
    }, [
        dateSortOrder,
        endDate,
        nameSortOrder,
        selectedSiteId,
        selectedTeamId,
        selectedWorkerTeamId,
        setSearchParams,
        siteSortOrder,
        sortMode,
        startDate,
        workerSearch
    ]);

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
        setDateRangeError(null);
        if (preset.start === startDate && preset.end === endDate) {
            void fetchRows();
            return;
        }
        applyDateRange(preset.start, preset.end);
    }, [applyDateRange, datePresets, endDate, fetchRows, startDate]);

    const handleSearch = useCallback(() => {
        const normalizedStart = normalizeTypedDateInput(startDateInput) ?? startDate;
        const normalizedEnd = normalizeTypedDateInput(endDateInput) ?? endDate;

        setStartDateInput(normalizedStart);
        setEndDateInput(normalizedEnd);

        if (normalizedStart > normalizedEnd) {
            setDateRangeError('조회 시작일은 종료일보다 늦을 수 없습니다.');
            return;
        }

        setDateRangeError(null);
        if (normalizedStart === startDate && normalizedEnd === endDate) {
            void fetchRows();
            return;
        }

        applyDateRange(normalizedStart, normalizedEnd);
    }, [applyDateRange, endDate, endDateInput, fetchRows, startDate, startDateInput]);

    const handleToggleSort = useCallback((mode: DailyReportSortMode) => {
        setSortMode(mode);
        if (mode === 'date') setDateSortOrder((previous) => previous === 'desc' ? 'asc' : 'desc');
        if (mode === 'name') setNameSortOrder((previous) => previous === 'asc' ? 'desc' : 'asc');
        if (mode === 'site') setSiteSortOrder((previous) => previous === 'asc' ? 'desc' : 'asc');
    }, []);

    const getRowKey = useCallback((r: DailyReportWorkerRow) => {
        const workerIndex = typeof r.workerIndex === 'number' ? String(r.workerIndex) : 'none';
        return `${String(r.reportId)}::${String(r.workerId)}::${workerIndex}`;
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

    const normalizeCompanyName = useCallback((value?: string | null) => {
        return String(value ?? '').trim().replace(/\s+/g, '').toLowerCase();
    }, []);

    const resolveCompanySelection = useCallback((params: { companyId?: string; companyName?: string }) => {
        const rawId = String(params.companyId ?? '').trim();
        const rawName = String(params.companyName ?? '').trim();
        const matchedById = rawId
            ? companyOptions.find((company) => String(company.id ?? '') === rawId || String(company.legacyId ?? '') === rawId)
            : undefined;
        const matchedByName = rawName
            ? companyOptions.find((company) => normalizeCompanyName(company.name) === normalizeCompanyName(rawName))
            : undefined;
        const matched = matchedById || matchedByName;

        return {
            id: matched?.id ? String(matched.id) : '',
            name: matched?.name ?? rawName,
        };
    }, [companyOptions, normalizeCompanyName]);

    const getSiteDetailValuesFromSite = useCallback((site?: Site | null) => ({
        companyId: String(site?.clientCompanyId || '').trim(),
        companyName: String(site?.clientCompanyName || '').trim(),
        constructorCompanyId: String(site?.companyId || site?.constructorCompanyId || '').trim(),
        constructorCompanyName: String(site?.companyName || site?.constructorCompanyName || '').trim(),
        partnerId: String(site?.partnerId || '').trim(),
        partnerName: String(site?.partnerName || '').trim(),
        siteManagerId: String((site as any)?.siteManagerId || '').trim(),
        siteManagerName: String((site as any)?.siteManagerName || '').trim(),
    }), []);

    const getRowSiteDetailValues = useCallback((row: DailyReportWorkerRow) => {
        return {
            companyId: String(row.companyId || '').trim(),
            companyName: String(row.companyName || '').trim(),
            constructorCompanyId: String(row.constructorCompanyId || '').trim(),
            constructorCompanyName: String(row.constructorCompanyName || '').trim(),
            partnerId: String(row.partnerId || '').trim(),
            partnerName: String(row.partnerName || '').trim(),
        };
    }, []);

    const getColumnFilterValue = useCallback((row: DailyReportWorkerRow, key: ColumnFilterKey): string => {
        switch (key) {
            case 'date':
                return row.date ?? '';
            case 'siteName':
                return row.siteName ?? '';
            case 'companyName':
                return getRowSiteDetailValues(row).companyName;
            case 'constructorCompanyName':
                return getRowSiteDetailValues(row).constructorCompanyName;
            case 'partnerName':
                return getRowSiteDetailValues(row).partnerName;
            case 'siteType':
                return row.siteType ?? '';
            case 'paymentType':
                return row.paymentType ?? '';
            case 'teamName':
                return resolveResponsibleTeamDisplayName({
                    responsibleTeamId: row.responsibleTeamId ?? row.teamId,
                    responsibleTeamName: row.responsibleTeamName ?? row.teamName
                });
            case 'siteManagerName':
                return row.siteManagerName ?? '';
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
    }, [getRowSiteDetailValues, resolveWorkerTeamDisplayName, resolveResponsibleTeamDisplayName]);

    const getSiteManagerOptionsForRow = useCallback((row: Pick<DailyReportWorkerRow, 'responsibleTeamId' | 'responsibleTeamName' | 'teamId' | 'teamName'>) => {
        const responsibleTeamId = resolveResponsibleTeamCanonicalId({
            responsibleTeamId: row.responsibleTeamId ?? row.teamId,
            responsibleTeamName: row.responsibleTeamName ?? row.teamName,
        });
        const responsibleTeamName = resolveResponsibleTeamDisplayName({
            responsibleTeamId: row.responsibleTeamId ?? row.teamId,
            responsibleTeamName: row.responsibleTeamName ?? row.teamName,
        });
        const roleRank: Record<string, number> = { '팀장': 0, '반장': 1 };

        return allWorkers
            .filter((worker) => {
                if (workerAccessScope.loading || !workerAccessMatchesWorker(workerAccessScope, worker)) return false;
                const role = String(worker.role ?? '').trim();
                if (role !== '팀장' && role !== '반장') return false;

                const workerTeamId = normalizeTeamId(worker.teamId ?? '');
                const workerTeamName = String(worker.teamName ?? '').trim();
                return (!!responsibleTeamId && workerTeamId === responsibleTeamId) ||
                    (!!responsibleTeamName && workerTeamName === responsibleTeamName);
            })
            .sort((a, b) => {
                const rankA = roleRank[String(a.role ?? '').trim()] ?? 99;
                const rankB = roleRank[String(b.role ?? '').trim()] ?? 99;
                if (rankA !== rankB) return rankA - rankB;
                return String(a.name ?? '').localeCompare(String(b.name ?? ''), 'ko');
            });
    }, [allWorkers, normalizeTeamId, resolveResponsibleTeamCanonicalId, resolveResponsibleTeamDisplayName, workerAccessScope]);

    const getFiltered = useCallback((criteria: { teamId?: string; siteId?: string; workerTeamId?: string }) => {
        const wantTeam = criteria.teamId ? normalizeTeamId(criteria.teamId) : '';
        const wantTeamNameKey = criteria.teamId
            ? normalizeTeamNameKey(
                teams.find((team) => normalizeTeamId(team.id ?? team.legacyId ?? '') === wantTeam)?.name
                ?? criteria.teamId
            )
            : '';
        const rawWantSite = criteria.siteId ? String(criteria.siteId) : '';
        const wantSiteNameKey = rawWantSite.startsWith(SITE_NAME_FILTER_PREFIX)
            ? rawWantSite.slice(SITE_NAME_FILTER_PREFIX.length)
            : '';
        const wantSiteIds = new Set<string>();
        let wantSiteDisplayNameKey = '';
        if (rawWantSite && !wantSiteNameKey) {
            const normalizedSiteId = normalizeSiteId(rawWantSite);
            if (normalizedSiteId) wantSiteIds.add(normalizedSiteId);
            const matchedSite = sites.find((site) => {
                const siteId = normalizeSiteId(site.id ?? '');
                const legacyId = normalizeSiteId(site.legacyId ?? '');
                return siteId === normalizedSiteId || legacyId === normalizedSiteId;
            });
            if (matchedSite) {
                const siteId = normalizeSiteId(matchedSite.id ?? '');
                const legacyId = normalizeSiteId(matchedSite.legacyId ?? '');
                if (siteId) wantSiteIds.add(siteId);
                if (legacyId) wantSiteIds.add(legacyId);
                wantSiteDisplayNameKey = normalizeTeamNameKey(matchedSite.name);
            }
        }
        const wantWorkerTeam = criteria.workerTeamId ? normalizeTeamId(criteria.workerTeamId) : '';

        return rows.filter(r => {
            if (workerAccessScope.loading || !workerAccessMatchesReportRow(workerAccessScope, r)) return false;
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
            if (wantSiteIds.size > 0) {
                const rowSiteId = normalizeSiteId(r.siteId);
                const rowSiteNameKey = normalizeTeamNameKey(r.siteName);
                if (!wantSiteIds.has(rowSiteId) && (!wantSiteDisplayNameKey || rowSiteNameKey !== wantSiteDisplayNameKey)) {
                    return false;
                }
            }
            if (wantSiteNameKey && normalizeTeamNameKey(r.siteName) !== wantSiteNameKey) return false;
            
            if (wantWorkerTeam) {
                const rowWorkerTeamId = resolveWorkerTeamCanonicalId({
                    workerTeamId: r.workerTeamId,
                    workerTeamName: r.workerTeamName
                });
                if (!rowWorkerTeamId || rowWorkerTeamId !== wantWorkerTeam) return false;
            }
            return true;
        });
    }, [rows, normalizeTeamId, normalizeSiteId, resolveResponsibleTeamCanonicalId, resolveResponsibleTeamDisplayName, resolveWorkerTeamCanonicalId, sites, teams, workerAccessScope]);

    useEffect(() => {
        if (!selectedSiteId || sites.length === 0) return;

        const normalizedSelectedSiteId = normalizeSiteId(selectedSiteId);
        const matchedSite = sites.find((site) => {
            const siteId = normalizeSiteId(site.id ?? '');
            const legacyId = normalizeSiteId(site.legacyId ?? '');
            return siteId === normalizedSelectedSiteId || legacyId === normalizedSelectedSiteId;
        });
        const canonicalSiteId = matchedSite?.id
            ? String(matchedSite.id)
            : (matchedSite?.legacyId ? String(matchedSite.legacyId) : '');

        if (canonicalSiteId && canonicalSiteId !== selectedSiteId) {
            setSelectedSiteId(canonicalSiteId);
        }
    }, [normalizeSiteId, selectedSiteId, sites]);

    const availableSites = useMemo(() => {
        const filtered = getFiltered({ teamId: selectedTeamId });
        const optionMap = new Map<string, Site>();

        filtered.forEach((row) => {
            const rowSiteId = normalizeSiteId(row.siteId);
            const rowSiteName = String(row.siteName ?? '').trim();
            const rowSiteNameKey = normalizeTeamNameKey(rowSiteName);
            if (!rowSiteId && !rowSiteNameKey) return;

            const matchedSite = sites.find((site) => {
                const siteId = normalizeSiteId(site.id ?? '');
                const legacyId = normalizeSiteId(site.legacyId ?? '');
                const siteNameKey = normalizeTeamNameKey(site.name);
                return (!!rowSiteId && (siteId === rowSiteId || legacyId === rowSiteId)) ||
                    (!!rowSiteNameKey && siteNameKey === rowSiteNameKey);
            });

            if (matchedSite) {
                const optionId = String(matchedSite.id ?? matchedSite.legacyId ?? rowSiteId ?? rowSiteNameKey);
                if (optionId && !optionMap.has(optionId)) optionMap.set(optionId, matchedSite);
                return;
            }

            if (rowSiteId) {
                optionMap.set(rowSiteId, {
                    id: rowSiteId,
                    legacyId: rowSiteId,
                    name: rowSiteName || rowSiteId,
                    code: '',
                    status: 'active',
                } as Site);
                return;
            }

            const virtualSiteId = `${SITE_NAME_FILTER_PREFIX}${rowSiteNameKey}`;
            optionMap.set(virtualSiteId, {
                id: virtualSiteId,
                name: rowSiteName,
                code: '',
                status: 'active',
            } as Site);
        });

        if (selectedSiteId) {
            const normalizedSelectedSiteId = normalizeSiteId(selectedSiteId);
            const selectedSite = sites.find((site) => {
                const siteId = normalizeSiteId(site.id ?? '');
                const legacyId = normalizeSiteId(site.legacyId ?? '');
                return siteId === normalizedSelectedSiteId || legacyId === normalizedSelectedSiteId;
            });

            if (selectedSite) {
                const optionId = String(selectedSite.id ?? selectedSite.legacyId ?? selectedSiteId);
                if (optionId && !optionMap.has(optionId)) optionMap.set(optionId, selectedSite);
            }
        }

        return Array.from(optionMap.values())
            .sort((a, b) => compareKo(a.name ?? '', b.name ?? ''));
    }, [getFiltered, normalizeSiteId, selectedSiteId, selectedTeamId, sites]);

    useEffect(() => {
        if (!selectedSiteId) return;
        const hasSelectedSite = availableSites.some((site) => (
            String(site.id ?? '') === selectedSiteId || String(site.legacyId ?? '') === selectedSiteId
        ));
        if (!hasSelectedSite) {
            if (rows.length === 0 && availableSites.length === 0) return;
            setSelectedSiteId('');
        }
    }, [availableSites, rows.length, selectedSiteId]);

    const availableReportTeams = useMemo(() => {
        if (rows.length === 0) {
            return teams
                .filter((team) => !workerAccessScope.loading && workerAccessMatchesTeam(workerAccessScope, team))
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
    }, [getFiltered, normalizeTeamId, resolveResponsibleTeamCanonicalId, resolveResponsibleTeamDisplayName, teams, selectedSiteId, rows.length, workerAccessScope]);

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
                .filter((team) => !workerAccessScope.loading && workerAccessMatchesTeam(workerAccessScope, team))
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
    }, [getFiltered, selectedSiteId, selectedTeamId, teams, normalizeTeamId, resolveWorkerTeamDisplayName, workerAccessScope]);

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
        const selectedSite = availableSites.find((site) => {
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
        availableSites,
        availableReportTeams,
        availableWorkerTeams,
        selectedSiteId,
        selectedTeamId,
        selectedWorkerTeamId,
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
            const site = compareKo(a.siteName ?? '', b.siteName ?? '');
            if (site !== 0) return site;
            const team = compareKo(a.teamName ?? '', b.teamName ?? '');
            if (team !== 0) return team;
            return compareKo(a.workerName ?? '', b.workerName ?? '');
        });
        return copied;
    }, [filteredRows, dateSortOrder, sortMode, nameSortOrder, siteSortOrder]);

    const mobileRows = useMemo<DailyReportMobileRow[]>(() => {
        return sortedRows.map((row) => ({
            key: getRowKey(row),
            date: row.date ?? '',
            siteName: row.siteName ?? '',
            siteType: row.siteType ?? '',
            paymentType: row.paymentType ?? '',
            responsibleTeamName: resolveResponsibleTeamDisplayName({
                responsibleTeamId: row.responsibleTeamId ?? row.teamId,
                responsibleTeamName: row.responsibleTeamName ?? row.teamName,
            }),
            workerName: row.workerName ?? '',
            workerTeamName: resolveWorkerTeamDisplayName({
                workerTeamId: row.workerTeamId,
                workerTeamName: row.workerTeamName,
            }),
            salaryModel: resolveReportPayType(row) ?? '',
            manDay: Number.isFinite(row.manDay) ? row.manDay : 0,
            unitPrice: Number.isFinite(row.unitPrice) ? row.unitPrice : 0,
            amount: Number.isFinite(row.amount) ? row.amount : 0,
            workContent: row.workContent ?? '',
            isEmptyReport: !!row.isEmptyReport,
            isTargetReport: !!targetReportId && row.reportId === targetReportId,
        }));
    }, [getRowKey, resolveResponsibleTeamDisplayName, resolveWorkerTeamDisplayName, sortedRows, targetReportId]);

    const effectiveMobileViewMode = isEditMode ? 'table' : mobileViewMode;

    const isLightEditMode = isEditMode && sortedRows.length > INLINE_EDIT_ALL_ROW_LIMIT;
    const shouldVirtualizeRows = sortedRows.length > VIRTUAL_ROW_LIMIT;
    const tableColumnCount = 12 + (showSiteDetailColumns ? 4 : 0) + (isEditMode ? 2 : 0);
    const virtualViewportHeight = tableViewport.height || 720;
    const virtualStartIndex = shouldVirtualizeRows
        ? Math.max(0, Math.floor(tableViewport.scrollTop / VIRTUAL_ROW_HEIGHT) - VIRTUAL_OVERSCAN_ROWS)
        : 0;
    const virtualEndIndex = shouldVirtualizeRows
        ? Math.min(
            sortedRows.length,
            Math.ceil((tableViewport.scrollTop + virtualViewportHeight) / VIRTUAL_ROW_HEIGHT) + VIRTUAL_OVERSCAN_ROWS
        )
        : sortedRows.length;
    const renderedRows = useMemo(() => {
        return shouldVirtualizeRows ? sortedRows.slice(virtualStartIndex, virtualEndIndex) : sortedRows;
    }, [shouldVirtualizeRows, sortedRows, virtualStartIndex, virtualEndIndex]);
    const topVirtualSpacerHeight = shouldVirtualizeRows ? virtualStartIndex * VIRTUAL_ROW_HEIGHT : 0;
    const bottomVirtualSpacerHeight = shouldVirtualizeRows
        ? Math.max(0, (sortedRows.length - virtualEndIndex) * VIRTUAL_ROW_HEIGHT)
        : 0;

    const syncTableViewport = useCallback((element: HTMLDivElement | null) => {
        if (!element) return;
        const nextScrollTop = element.scrollTop;
        const nextHeight = element.clientHeight;
        setTableViewport(prev => (
            prev.scrollTop === nextScrollTop && prev.height === nextHeight
                ? prev
                : { scrollTop: nextScrollTop, height: nextHeight }
        ));
    }, []);

    const handleTableScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
        syncTableViewport(event.currentTarget);
    }, [syncTableViewport]);

    useEffect(() => {
        const element = tableScrollRef.current;
        if (!element) return;

        syncTableViewport(element);

        const handleResize = () => syncTableViewport(element);
        const resizeObserver = typeof ResizeObserver !== 'undefined'
            ? new ResizeObserver(handleResize)
            : null;
        resizeObserver?.observe(element);
        window.addEventListener('resize', handleResize);

        return () => {
            resizeObserver?.disconnect();
            window.removeEventListener('resize', handleResize);
        };
    }, [syncTableViewport, sortedRows.length, isEditMode, showSiteDetailColumns]);

    const workerNameOptions = useMemo(() => {
        return allWorkers
            .filter((worker) => !workerAccessScope.loading && workerAccessMatchesWorker(workerAccessScope, worker))
            .map((worker, index) => ({
            id: String(worker.id ?? worker.legacyId ?? `${worker.name ?? 'worker'}-${index}`),
            name: worker.name ?? '',
            teamName: worker.teamName ?? '',
        }));
    }, [allWorkers, workerAccessScope]);

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

    useEffect(() => {
        if (!activeEditRowKey) return;
        if (!visibleRowKeys.includes(activeEditRowKey)) {
            setActiveEditRowKey(null);
        }
    }, [activeEditRowKey, visibleRowKeys]);

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
        if (isScopedReadOnly) {
            toast.info('팀장·반장·작업자 계정은 범위 내 일보를 조회할 수 있습니다. 수정 권한은 별도로 부여하세요.');
            return;
        }
        setIsEditMode((prev) => {
            const next = !prev;
            if (!next) {
                setSelectedRowKeys(new Set());
                setIsBulkEditOpen(false);
                setRowDrafts({});
                setRowSavingKeys(new Set());
                setActiveEditRowKey(null);
            }
            return next;
        });
    };

    useEffect(() => {
        if (!isScopedReadOnly) return;
        setIsEditMode(false);
        setSelectedRowKeys(new Set());
        setIsBulkEditOpen(false);
        setRowDrafts({});
        setRowSavingKeys(new Set());
        setActiveEditRowKey(null);
    }, [isScopedReadOnly]);

    const handleToggleSiteDetailColumns = useCallback(() => {
        setShowSiteDetailColumns((prev) => !prev);
    }, []);

    useEffect(() => {
        if (showSiteDetailColumns) return;

        setColumnFilters((prev) => {
            if (!prev.companyName && !prev.constructorCompanyName && !prev.partnerName) return prev;
            const {
                companyName: _companyName,
                constructorCompanyName: _constructorCompanyName,
                partnerName: _partnerName,
                ...rest
            } = prev;
            return rest;
        });
    }, [showSiteDetailColumns]);

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
        const siteDetailValues = getRowSiteDetailValues(r);
        return {
            siteId: normalizeSiteId(r.siteId),
            companyId: siteDetailValues.companyId,
            companyName: siteDetailValues.companyName,
            constructorCompanyId: siteDetailValues.constructorCompanyId,
            constructorCompanyName: siteDetailValues.constructorCompanyName,
            partnerId: siteDetailValues.partnerId,
            partnerName: siteDetailValues.partnerName,
            teamId: normalizeTeamId(r.teamId),
            responsibleTeamId: resolveResponsibleTeamOptionId({
                responsibleTeamId: r.responsibleTeamId,
                responsibleTeamName: r.responsibleTeamName
            }),
            responsibleTeamName: resolveResponsibleTeamDisplayName({
                responsibleTeamId: r.responsibleTeamId,
                responsibleTeamName: r.responsibleTeamName
            }),
            siteManagerId: String(r.siteManagerId ?? '').trim(),
            siteManagerName: String(r.siteManagerName ?? '').trim(),
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
    }, [getRowSiteDetailValues, normalizeSiteId, normalizeTeamId, resolveWorkerTeamCanonicalId, resolveWorkerTeamDisplayName, resolveResponsibleTeamOptionId, resolveResponsibleTeamDisplayName]);

    const isRowDirty = useCallback((original: DailyReportWorkerRow, draft?: RowDraft) => {
        if (!draft) return false;
        const initialDraft = getRowInitialDraft(original);

        if (draft.workerId && String(draft.workerId) !== String(original.workerId)) return true;
        if (draft.workerName !== undefined && draft.workerName !== original.workerName) return true;
        if (draft.siteId !== initialDraft.siteId) return true;
        if (draft.companyId !== initialDraft.companyId) return true;
        if (draft.companyName !== initialDraft.companyName) return true;
        if (draft.constructorCompanyId !== initialDraft.constructorCompanyId) return true;
        if (draft.constructorCompanyName !== initialDraft.constructorCompanyName) return true;
        if (draft.partnerId !== initialDraft.partnerId) return true;
        if (draft.partnerName !== initialDraft.partnerName) return true;
        if (draft.teamId !== initialDraft.teamId) return true;
        if (draft.responsibleTeamId !== initialDraft.responsibleTeamId) return true;
        if (draft.responsibleTeamName !== initialDraft.responsibleTeamName) return true;
        if (draft.siteManagerId !== initialDraft.siteManagerId) return true;
        if (draft.siteManagerName !== initialDraft.siteManagerName) return true;
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
    }, [getRowInitialDraft, resolveWorkerTeamDisplayName]);

    const setRowDraft = useCallback((r: DailyReportWorkerRow, changes: Partial<RowDraft>) => {
        const key = getRowKey(r);
        setRowDrafts(prev => {
            const current = prev[key] || getRowInitialDraft(r);
            return {
                ...prev,
                [key]: { ...current, ...changes }
            };
        });
    }, [getRowInitialDraft, getRowKey]);

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
        const siteWideKeys = new Set([
            'responsibleTeamId',
            'responsibleTeamName',
            'siteManagerId',
            'siteManagerName',
            'companyId',
            'companyName',
            'constructorCompanyId',
            'constructorCompanyName',
            'partnerId',
            'partnerName',
        ]);

        Object.entries(updates).forEach(([key, value]) => {
            if (siteWideKeys.has(key)) {
                (responsibleUpdates as any)[key] = value;
                return;
            }
            (otherUpdates as any)[key] = value;
        });

        return { responsibleUpdates, otherUpdates };
    }, []);

    const buildReportLevelUpdates = useCallback((original: DailyReportWorkerRow, draft: RowDraft) => {
        const reportLevelUpdates: Partial<DailyReportWorkerRow> & { siteId?: string; siteName?: string } = {};
        const initialDraft = getRowInitialDraft(original);

        if (
            draft.responsibleTeamId !== initialDraft.responsibleTeamId ||
            draft.responsibleTeamName !== initialDraft.responsibleTeamName
        ) {
            const matchedTeam = teams.find((team) => {
                const canonicalId = normalizeTeamId(team.id ?? team.legacyId ?? '');
                const nameKey = normalizeTeamNameKey(team.name);
                return canonicalId === draft.responsibleTeamId || nameKey === normalizeTeamNameKey(draft.responsibleTeamName);
            });

            reportLevelUpdates.responsibleTeamId = matchedTeam?.id ? String(matchedTeam.id) : '';
            reportLevelUpdates.responsibleTeamName = matchedTeam?.name ?? draft.responsibleTeamName ?? '';
        }

        if (draft.siteManagerId !== initialDraft.siteManagerId || draft.siteManagerName !== initialDraft.siteManagerName) {
            const matchedWorker = draft.siteManagerId
                ? allWorkers.find(worker => String(worker.id ?? '') === draft.siteManagerId || String(worker.legacyId ?? '') === draft.siteManagerId)
                : undefined;
            reportLevelUpdates.siteManagerId = matchedWorker?.id ? String(matchedWorker.id) : '';
            reportLevelUpdates.siteManagerName = matchedWorker?.name ?? draft.siteManagerName ?? '';
        }

        if (draft.companyId !== initialDraft.companyId || draft.companyName !== initialDraft.companyName) {
            const company = resolveCompanySelection({
                companyId: draft.companyId,
                companyName: draft.companyName,
            });
            reportLevelUpdates.companyId = company.id;
            reportLevelUpdates.companyName = company.name;
        }

        if (
            draft.constructorCompanyId !== initialDraft.constructorCompanyId ||
            draft.constructorCompanyName !== initialDraft.constructorCompanyName
        ) {
            const constructorCompany = resolveCompanySelection({
                companyId: draft.constructorCompanyId,
                companyName: draft.constructorCompanyName,
            });
            reportLevelUpdates.constructorCompanyId = constructorCompany.id;
            reportLevelUpdates.constructorCompanyName = constructorCompany.name;
        }

        if (draft.partnerId !== initialDraft.partnerId || draft.partnerName !== initialDraft.partnerName) {
            const partnerCompany = resolveCompanySelection({
                companyId: draft.partnerId,
                companyName: draft.partnerName,
            });
            reportLevelUpdates.partnerId = partnerCompany.id;
            reportLevelUpdates.partnerName = partnerCompany.name;
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
    }, [allWorkers, getRowInitialDraft, normalizeSiteId, normalizeTeamId, resolveCompanySelection, siteOptions, teams]);

    const validateWorkerDraft = useCallback((r: DailyReportWorkerRow, draft: RowDraft): WorkerDraftValidation => {
        const workerName = String(draft.workerName ?? '').trim();
        if (!workerName) {
            return { ok: false, message: '작업자 이름을 입력해 주세요.' };
        }

        const manDay = parseNonNegativeDraftNumber(draft.manDay, '공수');
        if (!manDay.ok) return { ok: false, message: manDay.message };

        const unitPrice = parseNonNegativeDraftNumber(draft.unitPrice, '단가');
        if (!unitPrice.ok) return { ok: false, message: unitPrice.message };

        const normalizedName = workerName.replace(/\s+/g, '');
        const matchedWorker = allWorkers.find(worker => worker.name === workerName)
            || (normalizedName ? allWorkers.find(worker => worker.name.replace(/\s+/g, '') === normalizedName) : undefined);
        const nextWorkerId = draft.workerId
            ? String(draft.workerId)
            : (matchedWorker?.id ? String(matchedWorker.id) : '');

        if (nextWorkerId && String(nextWorkerId) !== String(r.workerId)) {
            const currentRowKey = getRowKey(r);
            const isDuplicate = rows.some(existingRow => {
                if (existingRow.reportId !== r.reportId) return false;
                const existingKey = getRowKey(existingRow);
                if (existingKey === currentRowKey) return false;
                const existingDraft = rowDrafts[existingKey];
                const existingWorkerId = existingDraft?.workerId ?? existingRow.workerId;
                return String(existingWorkerId) === nextWorkerId;
            });

            if (isDuplicate) {
                return { ok: false, message: `같은 일보에 이미 등록된 작업자입니다: ${workerName}` };
            }
        }

        return { ok: true, manDay: manDay.value, unitPrice: unitPrice.value };
    }, [allWorkers, getRowKey, rowDrafts, rows]);

    const saveEmptyReportDraft = useCallback(async (r: DailyReportWorkerRow, draft: RowDraft) => {
        if (!r.reportId) {
            throw new Error('Empty report is missing reportId');
        }

        const reportLevelUpdates = buildReportLevelUpdates(r, draft);
        const { responsibleUpdates, otherUpdates } = splitResponsibleTeamUpdates(reportLevelUpdates);
        const updates: Record<string, unknown> = {
            ...otherUpdates,
            ...responsibleUpdates
        };

        if (draft.siteType !== (r.siteType ?? '')) {
            updates.siteType = draft.siteType;
        }
        if (draft.paymentType !== (r.paymentType ?? '')) {
            updates.paymentType = draft.paymentType;
        }
        if (draft.workContent !== (r.workContent ?? '')) {
            updates.workContent = draft.workContent;
        }

        if (Object.keys(updates).length === 0) {
            return;
        }

        await dailyReportService.updateReport(r.reportId, updates as any);
        setRows(prev => prev.map(row => {
            if (row.reportId !== r.reportId) return row;
            return {
                ...row,
                ...updates,
                siteType: typeof updates.siteType === 'string' ? updates.siteType : row.siteType,
                paymentType: typeof updates.paymentType === 'string' ? updates.paymentType : row.paymentType,
                workContent: typeof updates.workContent === 'string' ? updates.workContent : row.workContent,
            } as DailyReportWorkerRow;
        }));
    }, [buildReportLevelUpdates, splitResponsibleTeamUpdates]);

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
                    workerName: newName
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
        let validatedWorker: { manDay: number; unitPrice: number } | null = null;

        if (!r.isEmptyReport) {
            const validation = validateWorkerDraft(r, draft);
            if (!validation.ok) {
                toast.warning(validation.message);
                return false;
            }
            validatedWorker = {
                manDay: validation.manDay,
                unitPrice: validation.unitPrice,
            };
        }

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
            if (r.isEmptyReport) {
                await saveEmptyReportDraft(r, draft);
                if (successMessage) {
                    toast.success(successMessage);
                }
                clearRowDraft(key);
                return true;
            }

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
            updates.manDay = validatedWorker?.manDay ?? 0;
            updates.unitPrice = validatedWorker?.unitPrice ?? 0;
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

            await dailyReportService.updateWorkerInReport(
                r.reportId,
                r.workerId,
                updates,
                r.workerIndex,
                otherUpdates as any
            );
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
                const isTargetRow = getRowKey(row) === key;
                const isSameDateSite = row.date === r.date && normalizeSiteId(row.siteId) === normalizeSiteId(r.siteId);

                if (isTargetRow) {
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
    }, [allWorkers, buildReportLevelUpdates, clearRowDraft, confirm, getRowKey, getSameDateSiteReportIds, normalizeSiteId, normalizeTeamId, resolveWorkerTeamCanonicalId, resolveWorkerTeamDisplayName, saveEmptyReportDraft, splitResponsibleTeamUpdates, toast, validateWorkerDraft]);

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
                    workerName
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

    const buildBulkReportLevelUpdates = (): Partial<DailyReportWorkerRow> & { siteId?: string; siteName?: string } => {
        const updates: Partial<DailyReportWorkerRow> & { siteId?: string; siteName?: string } = {};

        const applyCompany = (
            name: string,
            idKey: 'companyId' | 'constructorCompanyId' | 'partnerId',
            nameKey: 'companyName' | 'constructorCompanyName' | 'partnerName'
        ) => {
            const trimmed = name.trim();
            if (!trimmed) return;
            const resolved = resolveCompanySelection({ companyName: trimmed });
            (updates as any)[idKey] = resolved.id;
            (updates as any)[nameKey] = resolved.name;
        };

        applyCompany(bulkCompanyName, 'companyId', 'companyName');
        applyCompany(bulkConstructorCompanyName, 'constructorCompanyId', 'constructorCompanyName');
        applyCompany(bulkPartnerName, 'partnerId', 'partnerName');

        const responsibleTeamText = bulkResponsibleTeamName.trim();
        if (responsibleTeamText) {
            const matchedTeam = teams.find((team) => {
                const id = String(team.id ?? team.legacyId ?? '').trim();
                return id === responsibleTeamText || normalizeTeamNameKey(team.name) === normalizeTeamNameKey(responsibleTeamText);
            });
            updates.responsibleTeamId = matchedTeam?.id ? String(matchedTeam.id) : resolveResponsibleTeamCanonicalId({ responsibleTeamName: responsibleTeamText });
            updates.responsibleTeamName = matchedTeam?.name ?? responsibleTeamText;
        }

        const siteManagerText = bulkSiteManagerName.trim();
        if (siteManagerText) {
            const normalizedSiteManagerName = siteManagerText.replace(/\s+/g, '');
            const matchedWorker = allWorkers.find((worker) => String(worker.id ?? '') === siteManagerText || String(worker.legacyId ?? '') === siteManagerText)
                || allWorkers.find((worker) => String(worker.name ?? '').trim() === siteManagerText)
                || (normalizedSiteManagerName
                    ? allWorkers.find((worker) => String(worker.name ?? '').replace(/\s+/g, '') === normalizedSiteManagerName)
                    : undefined);
            updates.siteManagerId = matchedWorker?.id ? String(matchedWorker.id) : '';
            updates.siteManagerName = matchedWorker?.name ?? siteManagerText;
        }

        return updates;
    };

    const handleBulkApply = async () => {
        const selected = Array.from(selectedRowKeys)
            .map((k) => rowByKey.get(k))
            .filter((r): r is DailyReportWorkerRow => !!r);

        if (selected.length === 0) return;

        const parsedManDay = bulkManDay.trim() === '' ? null : Number(bulkManDay);
        const parsedUnitPrice = bulkUnitPrice.trim() === '' ? null : Number(bulkUnitPrice);
        const nextSalaryModel = bulkSalaryModel.trim() === '' ? null : bulkSalaryModel.trim();
        const nextWorkContent = bulkWorkContent.trim() === '' ? null : bulkWorkContent.trim();
        const bulkReportLevelUpdates = buildBulkReportLevelUpdates();
        const hasBulkReportLevelUpdates = Object.keys(bulkReportLevelUpdates).length > 0;

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
            !bulkWorkerTeamName.trim() &&
            !hasBulkReportLevelUpdates
        ) {
            toast.info('변경할 값이 없습니다.');
            return;
        }

        const ok = await confirm.batch('일보', selected.length);
        if (!ok.isConfirmed) return;

        setIsMutationLoading(true);
        try {
            const reportUpdatesById = new Map<string, Record<string, unknown>>();
            const workerUpdateTargets: Parameters<typeof dailyReportService.bulkUpdateWorkersInReports>[0] = [];
            const mergeReportUpdates = (reportId: string, updates: Record<string, unknown>) => {
                if (!reportId || Object.keys(updates).length === 0) return;
                reportUpdatesById.set(reportId, {
                    ...(reportUpdatesById.get(reportId) ?? {}),
                    ...updates
                });
            };

            for (const r of selected) {
                if (r.isEmptyReport) {
                    const reportUpdates: Record<string, unknown> = { ...bulkReportLevelUpdates };
                    if (nextWorkContent != null) reportUpdates.workContent = nextWorkContent;
                    if (bulkSiteType) reportUpdates.siteType = bulkSiteType;
                    if (bulkPaymentType) reportUpdates.paymentType = bulkPaymentType;

                    mergeReportUpdates(r.reportId, reportUpdates);
                    continue;
                }

                if (hasBulkReportLevelUpdates) {
                    getSameDateSiteReportIds(r).forEach((reportId) => {
                        mergeReportUpdates(reportId, bulkReportLevelUpdates as Record<string, unknown>);
                    });
                }

                const updates: Partial<DailyReportWorker> = {};
                if (parsedManDay != null) updates.manDay = parsedManDay;
                if (parsedUnitPrice != null) updates.unitPrice = parsedUnitPrice;
                if (nextSalaryModel != null) updates.salaryModel = nextSalaryModel;
                if (nextWorkContent != null) updates.workContent = nextWorkContent;
                if (bulkSiteType) updates.siteType = bulkSiteType;
                if (bulkPaymentType) updates.paymentType = bulkPaymentType;
                if (bulkWorkerTeamName.trim()) updates.workerTeamName = bulkWorkerTeamName.trim();
                
                if (Object.keys(updates).length > 0) {
                    workerUpdateTargets.push({ reportId: r.reportId, workerId: r.workerId, workerIndex: r.workerIndex, updates });
                }
            }

            for (const [reportId, reportUpdates] of reportUpdatesById.entries()) {
                await dailyReportService.updateReport(reportId, reportUpdates as any);
            }

            if (workerUpdateTargets.length > 0) {
                await dailyReportService.bulkUpdateWorkersInReports(workerUpdateTargets);
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
            setBulkCompanyName('');
            setBulkConstructorCompanyName('');
            setBulkPartnerName('');
            setBulkResponsibleTeamName('');
            setBulkSiteManagerName('');
            await fetchRows();
        } catch (error) {
            console.error('[DailyReportListV2] bulk update failed', error);
            toast.error('일괄 수정에 실패했습니다.');
        } finally {
            setIsMutationLoading(false);
        }
    };

    const handleBulkDelete = async () => {
        const selected = Array.from(selectedRowKeys)
            .map((k) => rowByKey.get(k))
            .filter((r): r is DailyReportWorkerRow => !!r);

        if (selected.length === 0) return;

        const ok = await confirm.delete(`선택한 ${selected.length}건 삭제`);
        if (!ok.isConfirmed) return;

        setIsMutationLoading(true);
        try {
            const selectedDates = new Set(selected.map((row) => row.date).filter(Boolean));
            const emptyReportIds = Array.from(new Set(
                selected
                    .filter((row) => row.isEmptyReport)
                    .map((row) => row.reportId)
            ));
            const workerDeleteTargets = selected
                .filter((row) => !row.isEmptyReport)
                .map((row) => ({
                    reportId: row.reportId,
                    workerId: row.workerId,
                    workerIndex: row.workerIndex
                }));

            let successCount = 0;

            if (workerDeleteTargets.length > 0) {
                const result = await dailyReportService.deleteWorkersFromReports(workerDeleteTargets);
                successCount += result.deletedWorkerCount;
            }

            if (emptyReportIds.length > 0) {
                await dailyReportService.deleteReports(emptyReportIds);
                successCount += selected.filter((row) => row.isEmptyReport).length;
            }

            if (selectedDates.size > 0) {
                clearDailyReportBoardDrafts(selectedDates);
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
            setIsMutationLoading(false);
        }
    };

    const summaryMetrics = useMemo(() => buildDailyReportListSummary(sortedRows), [sortedRows]);

    const getTableGroupKey = useCallback((row: DailyReportWorkerRow) => {
        return `${row.date ?? ''}::${String(row.siteId || row.siteName || '').trim()}`;
    }, []);

    const tableGroupMetrics = useMemo(() => {
        const metrics = new Map<string, { rowCount: number; totalManDay: number }>();
        sortedRows.forEach((row) => {
            const key = getTableGroupKey(row);
            const current = metrics.get(key) ?? { rowCount: 0, totalManDay: 0 };
            current.rowCount += 1;
            current.totalManDay += Number.isFinite(row.manDay) ? row.manDay : 0;
            metrics.set(key, current);
        });
        return metrics;
    }, [getTableGroupKey, sortedRows]);

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

        setIsMutationLoading(true);
        try {
            const dirtyKeys = Object.keys(rowDrafts).filter(key => {
                const original = rowByKey.get(key);
                return original && isRowDirty(original, rowDrafts[key]);
            });

            let successCount = 0;
            let failCount = 0;
            const failedDraftKeys = new Set<string>();

            for (const key of dirtyKeys) {
                const r = rowByKey.get(key)!;
                const draft = rowDrafts[key];

                try {
                    if (r.isEmptyReport) {
                        await saveEmptyReportDraft(r, draft);
                        successCount++;
                        continue;
                    }

                    const validation = validateWorkerDraft(r, draft);
                    if (!validation.ok) {
                        failedDraftKeys.add(key);
                        failCount++;
                        console.warn('[SaveAll] Row validation failed:', validation.message);
                        continue;
                    }

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
                    updates.manDay = validation.manDay;
                    updates.unitPrice = validation.unitPrice;
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

                    await dailyReportService.updateWorkerInReport(
                        r.reportId,
                        r.workerId,
                        updates,
                        r.workerIndex,
                        otherUpdates as any
                    );
                    for (const reportId of responsibleReportIds) {
                        await dailyReportService.updateReport(reportId, responsibleUpdates as any);
                    }

                    successCount++;
                } catch (error) {
                    failCount++;
                    failedDraftKeys.add(key);
                    console.error('[SaveAll] Row save failed:', error);
                }
            }

            if (failCount === 0) {
                toast.success(`${successCount}건 저장 완료`);
            } else {
                toast.warning(`${successCount}건 저장, ${failCount}건 실패 (중복 등 확인 필요)`);
            }

            setRowDrafts(prev => {
                const next = { ...prev };
                dirtyKeys.forEach(key => {
                    if (!failedDraftKeys.has(key)) {
                        delete next[key];
                    }
                });
                return next;
            });
            await fetchRows();
        } catch (error) {
            console.error('[DailyReportListV2] Save All Failed (Critical)', error);
            toast.error('일괄 저장 중 시스템 오류가 발생했습니다.');
        } finally {
            setIsMutationLoading(false);
        }
    };

    const isTransferBusy = isQueryLoading
        || isMutationLoading
        || isDownloadingExcel
        || !!queryError
        || sortedRows.length === 0;

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

            const rangeLabel = `조회일보목록_${startDate}_${endDate}`;
            const outputFileName = `일보목록V2_${rangeLabel}.xlsx`;
            await dailyReportTransferService.exportRowsToExcel(exportRows, rangeLabel);
            void fileTransferAuditService.log({
                kind: 'excel',
                direction: 'download',
                status: 'success',
                source: '일보 목록 V2',
                operation: 'report_export',
                fileName: outputFileName,
                recordCount: exportRows.length,
                details: { startDate, endDate },
            });
            toast.success('조회 목록 엑셀 다운로드 완료');
        } catch (error) {
            console.error('[DailyReportListV2] Excel download failed', error);
            void fileTransferAuditService.log({
                kind: 'excel',
                direction: 'download',
                status: 'failure',
                source: '일보 목록 V2',
                operation: 'report_export',
                error,
                details: { startDate, endDate, recordCount: sortedRows.length },
            });
            toast.error('조회 목록 엑셀 다운로드에 실패했습니다.');
        } finally {
            setIsDownloadingExcel(false);
        }
    }, [endDate, resolveWorkerTeamDisplayName, sortedRows, startDate]);

    const emptyTitle = rows.length > 0
        ? '현재 필터에 맞는 작업자가 없습니다'
        : '조회된 작업자 내역이 없습니다';
    const emptyDescription = rows.length > 0
        ? '현장, 소속팀, 작업자 검색 또는 표 필터를 줄여서 다시 확인하세요.'
        : '선택한 기간에 등록된 출력일보가 없거나 아직 조회되지 않았습니다.';

    return (
        <div className="daily-report-v2-page flex flex-col flex-1 min-h-0 gap-3 p-0 pb-1">
            {queryLoadingMessage && (
                <div className="flex flex-shrink-0 items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700" role="status" aria-live="polite">
                    <FontAwesomeIcon icon={faSpinner} spin />
                    <span>{queryLoadingMessage}</span>
                </div>
            )}
            {dateRangeError && (
                <div className="daily-report-v2-inline-alert daily-report-v2-inline-alert--error" role="alert">
                    <span>{dateRangeError}</span>
                </div>
            )}
            {referenceDataError && (
                <div className="daily-report-v2-inline-alert daily-report-v2-inline-alert--warning" role="status">
                    <span>{referenceDataError} 조회 결과는 표시되지만 일부 필터 항목이 누락될 수 있습니다.</span>
                    <button type="button" onClick={() => { void loadReferenceData(); }}>다시 불러오기</button>
                </div>
            )}
            {isScopedReadOnly && (
                <div className="flex flex-shrink-0 items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700" role="status">
                    <FontAwesomeIcon icon={faFilter} />
                    <span>
                        {workerAccessScope.mode === 'team'
                            ? `${workerAccessScope.label} 팀 일보만 표시합니다.`
                            : `${workerAccessScope.label} 본인 일보만 표시합니다.`}
                    </span>
                </div>
            )}
            <DailyReportListToolbar
                startDateInput={startDateInput}
                endDateInput={endDateInput}
                presets={(Object.keys(datePresets) as DatePresetKey[]).map((key) => ({
                    key,
                    ...datePresets[key],
                    active: activeDatePreset === key,
                }))}
                siteOptions={[
                    { value: '', label: '전체 현장' },
                    ...[...availableSites]
                        .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
                        .map((site) => ({ value: String(site.id), label: site.name })),
                ]}
                reportTeamOptions={[
                    { value: '', label: '전체 현장소속팀' },
                    ...availableReportTeams.map((team) => ({
                        value: String(team.id ?? team.legacyId ?? team.name),
                        label: team.name ?? '',
                    })),
                ]}
                workerTeamOptions={[
                    { value: '', label: '전체 작업자 소속팀' },
                    ...availableWorkerTeams.map((team) => ({
                        value: String(team.id),
                        label: team.name ?? '',
                    })),
                ]}
                selectedSiteId={selectedSiteId}
                selectedTeamId={selectedTeamId}
                selectedWorkerTeamId={selectedWorkerTeamId}
                workerSearch={workerSearch}
                activeFilterLabels={activeFilterLabels}
                sortMode={sortMode}
                dateSortOrder={dateSortOrder}
                nameSortOrder={nameSortOrder}
                siteSortOrder={siteSortOrder}
                isEditMode={isEditMode}
                showSiteDetailColumns={showSiteDetailColumns}
                selectedRowCount={selectedRowKeys.size}
                dirtyRowCount={dirtyRowCount}
                isSearchDisabled={isQueryLoading || isMutationLoading}
                isTransferBusy={isTransferBusy}
                isDownloadingExcel={isDownloadingExcel}
                onStartDateChange={(value) => setStartDateInput(sanitizeTypedDateInput(value))}
                onEndDateChange={(value) => setEndDateInput(sanitizeTypedDateInput(value))}
                onDateBlur={(field) => { commitDateInput(field); }}
                onPresetSelect={handleDatePresetClick}
                onSiteChange={setSelectedSiteId}
                onReportTeamChange={setSelectedTeamId}
                onWorkerTeamChange={setSelectedWorkerTeamId}
                onWorkerSearchChange={setWorkerSearch}
                onClearFilters={handleClearListFilters}
                onToggleSort={handleToggleSort}
                onToggleEditMode={handleToggleEditMode}
                onToggleSiteDetails={handleToggleSiteDetailColumns}
                onOpenBulkEdit={() => setIsBulkEditOpen(true)}
                onBulkDelete={() => { void handleBulkDelete(); }}
                onSearch={handleSearch}
                onDownloadExcel={() => { void handleDownloadExcel(); }}
                onSaveAll={() => { void handleSaveAllDirtyRows(); }}
            />

            {!isQueryLoading && !queryError && (
                <DailyReportListSummary metrics={summaryMetrics} formatNumber={formatNumber} />
            )}

            {isEditMode && isBulkEditOpen && (
                <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200 flex flex-wrap gap-3 items-end">
                    <div className="text-sm font-bold text-slate-700">선택 항목 일괄 수정</div>

                    <div className="flex flex-col">
                        <label className="text-[11px] text-slate-500">발주사</label>
                        <input
                            type="text"
                            list="company-list-v2"
                            value={bulkCompanyName}
                            onChange={(e) => setBulkCompanyName(e.target.value)}
                            placeholder="(미입력 변경없음)"
                            className="px-3 py-2 border-slate-300 rounded-lg text-sm w-[170px]"
                        />
                    </div>

                    <div className="flex flex-col">
                        <label className="text-[11px] text-slate-500">시공사</label>
                        <input
                            type="text"
                            list="company-list-v2"
                            value={bulkConstructorCompanyName}
                            onChange={(e) => setBulkConstructorCompanyName(e.target.value)}
                            placeholder="(미입력 변경없음)"
                            className="px-3 py-2 border-slate-300 rounded-lg text-sm w-[170px]"
                        />
                    </div>

                    <div className="flex flex-col">
                        <label className="text-[11px] text-slate-500">협력사</label>
                        <input
                            type="text"
                            list="company-list-v2"
                            value={bulkPartnerName}
                            onChange={(e) => setBulkPartnerName(e.target.value)}
                            placeholder="(미입력 변경없음)"
                            className="px-3 py-2 border-slate-300 rounded-lg text-sm w-[170px]"
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
                        <label className="text-[11px] text-slate-500">현장소속팀</label>
                        <input
                            type="text"
                            list="responsible-team-list-v2"
                            value={bulkResponsibleTeamName}
                            onChange={(e) => setBulkResponsibleTeamName(e.target.value)}
                            placeholder="(미입력 변경없음)"
                            className="px-3 py-2 border-slate-300 rounded-lg text-sm w-[150px]"
                        />
                    </div>

                    <div className="flex flex-col">
                        <label className="text-[11px] text-slate-500">현장책임자</label>
                        <input
                            type="text"
                            list="worker-list-v2"
                            value={bulkSiteManagerName}
                            onChange={(e) => setBulkSiteManagerName(e.target.value)}
                            placeholder="(미입력 변경없음)"
                            className="px-3 py-2 border-slate-300 rounded-lg text-sm w-[150px]"
                        />
                    </div>

                    <div className="flex flex-col">
            <label className="text-[11px] text-slate-500">소속팀</label>
                        <input
                            type="text"
                            value={bulkWorkerTeamName}
                            onChange={(e) => setBulkWorkerTeamName(e.target.value)}
                            placeholder="(미입력=변경없음)"
                            className="px-3 py-2 border-slate-300 rounded-lg text-sm w-[150px]"
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
                {isEditMode && (
                    <>
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
                        <datalist id="responsible-team-list-v2">
                            {sortedTeamsByName.map((team) => (
                                <option key={String(team.id ?? team.legacyId ?? team.name)} value={team.name ?? ''} />
                            ))}
                        </datalist>
                        <datalist id="company-list-v2">
                            {companyOptions.map((company) => (
                                <option key={String(company.id ?? company.legacyId ?? company.name)} value={company.name ?? ''} />
                            ))}
                        </datalist>
                    </>
                )}
                {isQueryLoading ? (
                    <DailyReportListLoadingState />
                ) : queryError ? (
                    <DailyReportListErrorState
                        message={queryError}
                        startDate={startDate}
                        endDate={endDate}
                        onRetry={() => { void fetchRows(); }}
                    />
                ) : sortedRows.length === 0 ? (
                    <DailyReportListEmptyState
                        title={emptyTitle}
                        description={emptyDescription}
                        startDate={startDate}
                        endDate={endDate}
                        activeFilterLabels={activeFilterLabels}
                        hasActiveListFilters={hasActiveListFilters}
                        onClearFilters={handleClearListFilters}
                        onToday={() => handleDatePresetClick('today')}
                    />
                ) : (
                    <>
                    <div className="daily-report-v2-mobile-view-switch md:hidden" role="group" aria-label="목록 표시 방식">
                        <button
                            type="button"
                            onClick={() => setMobileViewMode('cards')}
                            disabled={isEditMode}
                            aria-pressed={effectiveMobileViewMode === 'cards'}
                            className={effectiveMobileViewMode === 'cards' ? 'is-active' : ''}
                            title={isEditMode ? '수정 모드에서는 표 보기를 사용합니다.' : '카드형 목록으로 보기'}
                        >
                            카드
                        </button>
                        <button
                            type="button"
                            onClick={() => setMobileViewMode('table')}
                            aria-pressed={effectiveMobileViewMode === 'table'}
                            className={effectiveMobileViewMode === 'table' ? 'is-active' : ''}
                        >
                            표
                        </button>
                        {isEditMode && <span>수정 중에는 표로 표시됩니다.</span>}
                    </div>
                    {effectiveMobileViewMode === 'cards' && (
                        <DailyReportMobileList rows={mobileRows} sortMode={sortMode} formatNumber={formatNumber} />
                    )}
                    <div
                        ref={tableScrollRef}
                        onScroll={handleTableScroll}
                        role="region"
                        aria-label="일보 상세 표, 좌우로 스크롤 가능"
                        tabIndex={0}
                        className={`sheet-table-wrapper workbook-frozen-table-wrapper daily-report-v2-wrapper ${effectiveMobileViewMode === 'cards' ? 'hidden md:block' : 'block'}`}
                        style={{ flex: 1 }}
                    >
                    <table className={`sheet-table daily-report-workbook-table ${showSiteDetailColumns ? 'min-w-[1730px]' : 'min-w-[1310px]'} text-left text-slate-700`}>
                        <colgroup>
                            {isEditMode && <col className="daily-report-col-select" />}
                            <col className="daily-report-col-date" />
                            <col className="daily-report-col-site" />
                            {showSiteDetailColumns && (
                                <>
                                    <col className="daily-report-col-company" />
                                    <col className="daily-report-col-company" />
                                    <col className="daily-report-col-company" />
                                </>
                            )}
                            <col className="daily-report-col-site-type" />
                            <col className="daily-report-col-payment-type" />
                            <col className="daily-report-col-team" />
                            {showSiteDetailColumns && <col className="daily-report-col-name" />}
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
                                    'px-2.5 py-2 whitespace-nowrap w-[150px] daily-report-header-purple'
                                )}
                                {showSiteDetailColumns && (
                                    <>
                                        {renderFilterHeader(
                                            'companyName',
                                            '발주',
                                            'px-2.5 py-2 whitespace-nowrap w-[110px] daily-report-header-purple'
                                        )}
                                        {renderFilterHeader(
                                            'constructorCompanyName',
                                            '시공',
                                            'px-2.5 py-2 whitespace-nowrap w-[110px] daily-report-header-purple'
                                        )}
                                        {renderFilterHeader(
                                            'partnerName',
                                            '협력',
                                            'px-2.5 py-2 whitespace-nowrap w-[110px] daily-report-header-purple'
                                        )}
                                    </>
                                )}
                                {renderFilterHeader(
                                    'siteType',
                                    '구분',
                                    'px-2.5 py-2 whitespace-nowrap w-[60px] daily-report-header-purple'
                                )}
                                {renderFilterHeader(
                                    'paymentType',
                                    '결제',
                                    'px-2.5 py-2 whitespace-nowrap w-[60px] daily-report-header-purple'
                                )}
                                {renderFilterHeader(
                                    'teamName',
                                    '현장소속팀',
                                    'px-2.5 py-2 whitespace-nowrap w-[120px] daily-report-header-purple'
                                )}
                                {showSiteDetailColumns && renderFilterHeader(
                                    'siteManagerName',
                                    '현장책임자',
                                    'px-2.5 py-2 whitespace-nowrap w-[90px] daily-report-header-purple'
                                )}
                                {renderFilterHeader(
                                    'workerName',
                                    '성명',
                                    'px-2.5 py-2 whitespace-nowrap w-[80px] daily-report-header-navy'
                                )}
                                {renderFilterHeader(
                                    'workerTeamName',
                                    '소속팀',
                                    'px-2.5 py-2 whitespace-nowrap w-[120px] daily-report-header-navy'
                                )}
                                {renderFilterHeader(
                                    'salaryModel',
                                    '급여방식',
                                    'px-2.5 py-2 whitespace-nowrap w-[80px] daily-report-header-navy'
                                )}
                                {renderFilterHeader(
                                    'manDay',
                                    '공수',
                                    'px-2.5 py-2 whitespace-nowrap w-[60px] text-right daily-report-header-green',
                                    'right'
                                )}
                                {renderFilterHeader(
                                    'unitPrice',
                                    '단가',
                                    'px-2.5 py-2 whitespace-nowrap w-[90px] text-right daily-report-header-green',
                                    'right'
                                )}
                                {renderFilterHeader(
                                    'amount',
                                    '금액',
                                    'px-2.5 py-2 whitespace-nowrap w-[100px] text-right daily-report-header-green',
                                    'right'
                                )}
                                <th className="px-2.5 py-2 whitespace-nowrap min-w-[150px] daily-report-header-green">비고(내용)</th>
                                {isEditMode && (
                                    <th className="px-2.5 py-2 whitespace-nowrap w-[80px] text-center">작업</th>
                                )}
                            </tr>
                        </thead>
                        <tbody className="bg-white">
                            {shouldVirtualizeRows && topVirtualSpacerHeight > 0 && (
                                <tr className="daily-report-v2-virtual-spacer" aria-hidden="true">
                                    <td colSpan={tableColumnCount} style={{ height: topVirtualSpacerHeight }} />
                                </tr>
                            )}
                            {renderedRows.map((row, renderedIndex) => {
                                const key = getRowKey(row);
                                const absoluteRowIndex = shouldVirtualizeRows ? virtualStartIndex + renderedIndex : renderedIndex;
                                const previousRow = absoluteRowIndex > 0 ? sortedRows[absoluteRowIndex - 1] : undefined;
                                const groupingEnabled = sortMode !== 'name';
                                const isDateGroupStart = groupingEnabled && (!previousRow || previousRow.date !== row.date);
                                const isSiteGroupStart = groupingEnabled && (!previousRow || getTableGroupKey(previousRow) !== getTableGroupKey(row));
                                const groupMetrics = tableGroupMetrics.get(getTableGroupKey(row));
                                const isSelected = selectedRowKeys.has(key);
                                const draft = rowDrafts[key];
                                const isDirty = isRowDirty(row, draft);
                                const isSaving = rowSavingKeys.has(key);
                                const isInlineEditing = isEditMode && (!isLightEditMode || activeEditRowKey === key || !!draft || isSaving);
                                const isEmptyReport = !!row.isEmptyReport;
                                const isTargetReport = !!targetReportId && row.reportId === targetReportId;

                                const initialDraft = draft ? getRowInitialDraft(row) : null;
                                const rowSiteDetail = getRowSiteDetailValues(row);
                                const displayRow = draft ? { ...row, ...draft } : row;
                                const displaySiteDetail = {
                                    companyName: draft ? draft.companyName : rowSiteDetail.companyName,
                                    constructorCompanyName: draft ? draft.constructorCompanyName : rowSiteDetail.constructorCompanyName,
                                    partnerName: draft ? draft.partnerName : rowSiteDetail.partnerName,
                                };
                                const displayResponsibleTeamName = resolveResponsibleTeamDisplayName({
                                    responsibleTeamId: displayRow.responsibleTeamId ?? displayRow.teamId,
                                    responsibleTeamName: displayRow.responsibleTeamName ?? displayRow.teamName
                                });
                                const displaySiteManagerName = String(displayRow.siteManagerName ?? '').trim();
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
                                        className={`sheet-row hover:bg-slate-50 transition-colors border-b border-slate-100 ${isDateGroupStart ? 'daily-report-v2-date-group-start' : ''} ${isSiteGroupStart ? 'daily-report-v2-site-group-start' : ''} ${isSelected ? 'bg-indigo-50/50' : ''} ${isDirty ? 'bg-amber-50/50' : ''} ${isTargetReport ? 'ring-2 ring-rose-300 bg-rose-50/60' : ''}`}
                                        style={shouldVirtualizeRows ? { height: VIRTUAL_ROW_HEIGHT } : undefined}
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
                                        <td className={`daily-report-col-date px-2.5 py-1.5 font-mono text-slate-500 ${isFixed ? `sticky z-30 bg-inherit border-r border-slate-200 ${isEditMode ? 'left-[48px]' : 'left-0'}` : ''}`}>
                                            {row.date}
                                        </td>
                                        <td className="px-2.5 py-1.5">
                                            {isInlineEditing ? (
                                                <div className="space-y-1">
                                                    <select
                                                        value={displayRow.siteId}
                                                        onChange={(e) => {
                                                            const nextSiteId = e.target.value;
                                                            const normalizedNextSiteId = normalizeSiteId(nextSiteId);
                                                            const matchedSite = siteOptions.find((site) => normalizeSiteId(site.id ?? site.legacyId ?? '') === normalizedNextSiteId);
                                                            setRowDraft(row, {
                                                                siteId: nextSiteId,
                                                                ...getSiteDetailValuesFromSite(matchedSite),
                                                            });
                                                        }}
                                                        className={`w-full px-1 py-0.5 border rounded text-sm ${isDirty && draft?.siteId !== normalizeSiteId(row.siteId) ? 'border-amber-500 bg-amber-50' : 'border-slate-200'}`}
                                                    >
                                                        <option value="">현장 선택</option>
                                                        {siteOptions.map(s => <option key={String(s.id)} value={String(s.id)}>{s.name}</option>)}
                                                    </select>
                                                </div>
                                            ) : (
                                                <span className="daily-report-v2-site-cell" title={isSiteGroupStart && groupMetrics
                                                    ? `${row.siteName ?? ''} · ${groupMetrics.rowCount}건 · ${groupMetrics.totalManDay.toFixed(1)}공수`
                                                    : (row.siteName ?? '')}
                                                >
                                                    <span>{row.siteName}</span>
                                                    {isSiteGroupStart && groupMetrics && (
                                                        <small>{groupMetrics.rowCount}건</small>
                                                    )}
                                                </span>
                                            )}
                                        </td>
                                        {showSiteDetailColumns && (
                                            <>
                                                <td className="px-2.5 py-1.5">
                                                    {isInlineEditing ? (
                                                        <input
                                                            type="text"
                                                            list="company-list-v2"
                                                            value={displaySiteDetail.companyName}
                                                            onChange={(e) => setRowDraft(row, { companyName: e.target.value, companyId: '' })}
                                                            placeholder="발주"
                                                            className={`w-full px-2 py-0.5 border rounded text-sm ${isDirty && draft?.companyName !== initialDraft?.companyName ? 'border-amber-500 bg-amber-50' : 'border-slate-200'}`}
                                                        />
                                                    ) : displaySiteDetail.companyName ? (
                                                        <span className="truncate block" title={displaySiteDetail.companyName}>{displaySiteDetail.companyName}</span>
                                                    ) : (
                                                        <span className="text-slate-300">-</span>
                                                    )}
                                                </td>
                                                <td className="px-2.5 py-1.5">
                                                    {isInlineEditing ? (
                                                        <input
                                                            type="text"
                                                            list="company-list-v2"
                                                            value={displaySiteDetail.constructorCompanyName}
                                                            onChange={(e) => setRowDraft(row, { constructorCompanyName: e.target.value, constructorCompanyId: '' })}
                                                            placeholder="시공"
                                                            className={`w-full px-2 py-0.5 border rounded text-sm ${isDirty && draft?.constructorCompanyName !== initialDraft?.constructorCompanyName ? 'border-amber-500 bg-amber-50' : 'border-slate-200'}`}
                                                        />
                                                    ) : displaySiteDetail.constructorCompanyName ? (
                                                        <span className="truncate block" title={displaySiteDetail.constructorCompanyName}>{displaySiteDetail.constructorCompanyName}</span>
                                                    ) : (
                                                        <span className="text-slate-300">-</span>
                                                    )}
                                                </td>
                                                <td className="px-2.5 py-1.5">
                                                    {isInlineEditing ? (
                                                        <input
                                                            type="text"
                                                            list="company-list-v2"
                                                            value={displaySiteDetail.partnerName}
                                                            onChange={(e) => setRowDraft(row, { partnerName: e.target.value, partnerId: '' })}
                                                            placeholder="협력"
                                                            className={`w-full px-2 py-0.5 border rounded text-sm ${isDirty && draft?.partnerName !== initialDraft?.partnerName ? 'border-amber-500 bg-amber-50' : 'border-slate-200'}`}
                                                        />
                                                    ) : displaySiteDetail.partnerName ? (
                                                        <span className="truncate block" title={displaySiteDetail.partnerName}>{displaySiteDetail.partnerName}</span>
                                                    ) : (
                                                        <span className="text-slate-300">-</span>
                                                    )}
                                                </td>
                                            </>
                                        )}
                                        <td className="px-2.5 py-1.5">
                                            {isInlineEditing ? (
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
                                            {isInlineEditing ? (
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
                                            {isInlineEditing ? (
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
                                                            responsibleTeamName: matchedTeam?.name ?? val,
                                                            siteManagerId: '',
                                                            siteManagerName: ''
                                                        });
                                                    }}
                                                    className={`w-full px-1 py-0.5 border rounded text-sm ${isDirty && draft?.responsibleTeamId !== resolveResponsibleTeamOptionId(row) ? 'border-amber-500 bg-amber-50' : 'border-slate-200'}`}
                                                >
                                                    <option value="">팀 선택</option>
                                                    {sortedTeamsByName.map(t => <option key={String(t.id ?? t.legacyId ?? t.name)} value={String(t.id ?? t.legacyId ?? t.name)}>{t.name}</option>)}
                                                </select>
                                            ) : (
                                                <span className="truncate block" title={displayResponsibleTeamName}>{displayResponsibleTeamName}</span>
                                            )}
                                        </td>
                                        {showSiteDetailColumns && (
                                            <td className="px-2.5 py-1.5">
                                                {isInlineEditing ? (
                                                    <select
                                                        value={displayRow.siteManagerId ?? ''}
                                                        onChange={(e) => {
                                                            const managerId = e.target.value;
                                                            const manager = getSiteManagerOptionsForRow(displayRow).find(worker => String(worker.id ?? '') === managerId);
                                                            setRowDraft(row, {
                                                                siteManagerId: managerId,
                                                                siteManagerName: manager?.name ?? ''
                                                            });
                                                        }}
                                                        className={`w-full px-1 py-0.5 border rounded text-sm ${isDirty && draft?.siteManagerId !== initialDraft?.siteManagerId ? 'border-amber-500 bg-amber-50' : 'border-slate-200'}`}
                                                    >
                                                        <option value="">-</option>
                                                        {getSiteManagerOptionsForRow(displayRow).map(worker => (
                                                            <option key={String(worker.id ?? worker.legacyId ?? worker.name)} value={String(worker.id ?? '')}>
                                                                {worker.name}{worker.role ? ` (${worker.role})` : ''}
                                                            </option>
                                                        ))}
                                                    </select>
                                                ) : displaySiteManagerName ? (
                                                    <span className="truncate block" title={displaySiteManagerName}>{displaySiteManagerName}</span>
                                                ) : (
                                                    <span className="text-slate-300">-</span>
                                                )}
                                            </td>
                                        )}
                                        <td className="px-2.5 py-1.5">
                                            {isInlineEditing && !isEmptyReport ? (
                                                <input
                                                    type="text"
                                                    list="worker-list-v2"
                                                    value={displayRow.workerName}
                                                    onChange={(e) => handleWorkerNameChange(row, e.target.value)}
                                                    className={`w-full px-2 py-0.5 border rounded text-sm font-bold ${isDirty && draft?.workerName !== row.workerName ? 'border-amber-500 bg-amber-50' : 'border-slate-200'}`}
                                                />
                                            ) : isEmptyReport ? (
                                                <span className="inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-700">
                                                    작업자 행 없음
                                                </span>
                                            ) : (
                                                <span className="font-bold text-slate-900">{row.workerName}</span>
                                            )}
                                        </td>
                                        <td className="px-2.5 py-1.5">
                                            {isInlineEditing && !isEmptyReport ? (
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
                                            ) : isEmptyReport ? (
                                                <span className="text-slate-300">-</span>
                                            ) : (
                                                <span className="truncate block text-slate-500" title={displayWorkerTeamName}>{displayWorkerTeamName}</span>
                                            )}
                                        </td>
                                        <td className="px-2.5 py-1.5">
                                            {isInlineEditing && !isEmptyReport ? (
                                                <input
                                                    type="text"
                                                    list="daily-report-v2-salary-model-options"
                                                    value={displayRow.salaryModel}
                                                    onChange={(e) => setRowDraft(row, { salaryModel: e.target.value })}
                                                    className={`w-full px-2 py-0.5 border rounded text-sm ${isDirty && draft?.salaryModel !== resolveReportPayType(row) ? 'border-amber-500 bg-amber-50' : 'border-slate-200'}`}
                                                />
                                            ) : isEmptyReport ? (
                                                <span className="text-slate-300">-</span>
                                            ) : (
                                                <span className="text-slate-500">{resolveReportPayType(row)}</span>
                                            )}
                                        </td>
                                        <td className="px-2.5 py-1.5 text-right font-mono">
                                            {isInlineEditing && !isEmptyReport ? (
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    value={displayRow.manDay}
                                                    onChange={(e) => setRowDraft(row, { manDay: e.target.value })}
                                                    className={`w-full px-1 py-0.5 border rounded text-sm text-right font-bold ${isDirty && Number(draft?.manDay) !== row.manDay ? 'border-amber-500 bg-amber-50' : 'border-slate-200'}`}
                                                />
                                            ) : isEmptyReport ? (
                                                <span className="text-slate-300">-</span>
                                            ) : (
                                                <span className="font-bold">{formatManDay(row.manDay)}</span>
                                            )}
                                        </td>
                                        <td className="px-2.5 py-1.5 text-right font-mono">
                                            {isInlineEditing && !isEmptyReport ? (
                                                <input
                                                    type="number"
                                                    value={displayRow.unitPrice}
                                                    onChange={(e) => setRowDraft(row, { unitPrice: e.target.value })}
                                                    className={`w-full px-1 py-0.5 border rounded text-sm text-right ${isDirty && Number(draft?.unitPrice) !== row.unitPrice ? 'border-amber-500 bg-amber-50' : 'border-slate-200'}`}
                                                />
                                            ) : isEmptyReport ? (
                                                <span className="text-slate-300">-</span>
                                            ) : (
                                                formatNumber(Math.round(row.unitPrice))
                                            )}
                                        </td>
                                        <td className="px-2.5 py-1.5 text-right font-mono font-bold text-indigo-600">
                                            {isEmptyReport ? '-' : formatNumber(Math.round((Number(displayRow.manDay) || 0) * (Number(displayRow.unitPrice) || 0)))}
                                        </td>
                                        <td className="px-2.5 py-1.5">
                                            {isInlineEditing ? (
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
                                                                onClick={() => {
                                                                    clearRowDraft(key);
                                                                    if (isLightEditMode) setActiveEditRowKey(null);
                                                                }}
                                                                disabled={isSaving}
                                                                className="w-7 h-7 flex items-center justify-center bg-slate-200 text-slate-600 rounded hover:bg-slate-300"
                                                                title="취소"
                                                            >
                                                                <FontAwesomeIcon icon={faXmark} />
                                                            </button>
                                                        </>
                                                    ) : isLightEditMode && !isInlineEditing ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => setActiveEditRowKey(key)}
                                                            className="w-7 h-7 flex items-center justify-center bg-white text-slate-600 border border-slate-200 rounded hover:bg-indigo-50 hover:text-indigo-600"
                                                            title="Edit row"
                                                        >
                                                            <FontAwesomeIcon icon={faPenToSquare} />
                                                        </button>
                                                    ) : isLightEditMode ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => setActiveEditRowKey(null)}
                                                            className="w-7 h-7 flex items-center justify-center bg-slate-100 text-slate-500 border border-slate-200 rounded hover:bg-slate-200"
                                                            title="Close edit"
                                                        >
                                                            <FontAwesomeIcon icon={faXmark} />
                                                        </button>
                                                    ) : (
                                                        <span className="text-[10px] text-slate-300 font-bold">저장됨</span>
                                                    )}
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                            {shouldVirtualizeRows && bottomVirtualSpacerHeight > 0 && (
                                <tr className="daily-report-v2-virtual-spacer" aria-hidden="true">
                                    <td colSpan={tableColumnCount} style={{ height: bottomVirtualSpacerHeight }} />
                                </tr>
                            )}
                        </tbody>
                    </table>
                    </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default DailyReportListV2;
