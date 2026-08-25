import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faDownload, faFileInvoiceDollar, faSearch, faSync, faTimes, faUser } from '@fortawesome/free-solid-svg-icons';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx-js-style';
import { dailyReportService } from '../../services/dailyReportService';
import { companyService, Company } from '../../services/companyService';
import { manpowerService, Worker } from '../../services/manpowerService';
import { teamService, Team } from '../../services/teamService';
import { normalizeTypedDateInput, sanitizeTypedDateInput } from '../../utils/typedDateInput';
import { resolveReportPayType, resolveWorkerPayType } from '../../utils/payType';
import { buildTeamIdsByAffiliation } from '../../utils/cheongyeonTeams';
import OutputManagementTabs from '../../components/common/OutputManagementTabs';
import MonthNavigator from '../../components/common/MonthNavigator';
import { useSearchParams } from 'react-router-dom';

type CompanyTypeFilter = 'construction' | 'partner';
type SalaryModelFilter = '전체' | '일급제' | '월급제' | '지원팀' | '용역팀';
type DateMode = 'period' | 'monthly';

const TABLE_COLUMN_COUNT = 12;

interface PersonnelHistoryRow {
    workerId: string;
    name: string;
    idNumber: string;
    salaryModel: SalaryModelFilter;
    teamId: string;
    teamName: string;
    totalManDay: number;
    laborManDay: number;
    invoiceManDay: number;
    unitPrice: number;
    unitPriceBreakdown: Array<{
        unitPrice: number;
        manDay: number;
        amount: number;
    }>;
    laborAmount: number;
    invoiceAmount: number;
    totalAmount: number;
}

const resolveWorkerSalaryModel = (worker: Worker): SalaryModelFilter => {
    const payType = resolveWorkerPayType(worker);
    if (payType === '일급제') return '일급제';
    if (payType === '월급제') return '월급제';
    if (payType === '지원팀') return '지원팀';
    if (payType === '용역팀') return '용역팀';
    return '전체';
};

const resolveSnapshotSalaryModel = (params: {
    worker: Worker;
    reportSalaryModel?: string;
    reportPayType?: string;
}): SalaryModelFilter => {
    const payType = resolveReportPayType({
        salaryModel: params.reportSalaryModel,
        payType: params.reportPayType
    }, params.worker);
    if (payType === '일급제') return '일급제';
    if (payType === '월급제') return '월급제';
    if (payType === '지원팀') return '지원팀';
    if (payType === '용역팀') return '용역팀';
    return '전체';
};

const matchesSalaryModelFilter = (
    model: SalaryModelFilter,
    filter: SalaryModelFilter
): boolean => {
    if (filter === '전체') {
        return model === '일급제'
            || model === '월급제'
            || model === '지원팀'
            || model === '용역팀';
    }
    return model === filter;
};

const normalizeCategoryKey = (value: unknown): string => {
    return String(value ?? '')
        .replace(/\s+/g, '')
        .trim();
};

const classifyInvoiceBySiteContext = (params: {
    paymentType?: unknown;
    siteType?: unknown;
    salaryModel: SalaryModelFilter;
}): boolean => {
    const paymentKey = normalizeCategoryKey(params.paymentType);
    const siteTypeKey = normalizeCategoryKey(params.siteType);

    if (paymentKey.includes('노무')) return false;
    if (paymentKey.includes('계산서') || paymentKey.includes('계산')) return true;

    if (siteTypeKey.includes('직영')) return false;
    if (siteTypeKey.includes('도급') || siteTypeKey.includes('지원')) return true;

    if (params.salaryModel === '지원팀') return true;
    return false;
};

const formatResidentNumberForDisplay = (rawValue: string): string => {
    const raw = String(rawValue ?? '').trim();
    if (!raw) return '';

    const digits = raw.replace(/[^0-9]/g, '');
    if (digits.length === 13) {
        return `${digits.slice(0, 6)}-${digits.slice(6)}`;
    }
    return raw;
};

const maskResidentNumberForDisplay = (rawValue: string): string => {
    const formatted = formatResidentNumberForDisplay(rawValue);
    if (!formatted) return '-';

    const digits = formatted.replace(/[^0-9]/g, '');
    if (digits.length === 13) {
        return `${digits.slice(0, 6)}-${digits.slice(6, 7)}******`;
    }
    if (formatted.length > 8) {
        return `${formatted.slice(0, 8)}******`;
    }
    return formatted;
};

const formatManDay = (value: number): string => {
    return Number.isFinite(value) ? value.toFixed(2) : '0.00';
};

const escapeRegExp = (value: string): string => {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const normalizeDateParam = (value?: string | null): string | null => {
    return value ? normalizeTypedDateInput(value) : null;
};

const parseCompanyTypeParam = (value?: string | null): CompanyTypeFilter | null => {
    return value === 'construction' || value === 'partner' ? value : null;
};

const parseSalaryModelParam = (value?: string | null): SalaryModelFilter | null => {
    return value === '전체'
        || value === '일급제'
        || value === '월급제'
        || value === '지원팀'
        || value === '용역팀'
        ? value
        : null;
};

const parseSortOrderParam = (value?: string | null): 'asc' | 'desc' | null => {
    return value === 'asc' || value === 'desc' ? value : null;
};

const parseDateModeParam = (value?: string | null): DateMode | null => {
    return value === 'period' || value === 'monthly' ? value : null;
};

const normalizeYearMonth = (value?: string | null): string | null => {
    const normalized = String(value ?? '').trim();
    return /^\d{4}-(0[1-9]|1[0-2])$/.test(normalized) ? normalized : null;
};

const getCalendarMonthRange = (yearMonth: string): { startDate: string; endDate: string } => {
    const [year, month] = yearMonth.split('-').map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    return {
        startDate: `${yearMonth}-01`,
        endDate: `${yearMonth}-${String(lastDay).padStart(2, '0')}`,
    };
};


const TotalPersonnelHistoryPage: React.FC = () => {
    return (
        <div className="flex flex-col overflow-hidden" style={{ height: 'calc(100vh - var(--header-height))' }}>
            <OutputManagementTabs activeTab="history" title="인원관리" />
            <div className="flex flex-col overflow-hidden flex-1" style={{ minHeight: 0 }}>
                <TotalPersonnelHistoryInner />
            </div>
        </div>
    );
};

const TotalPersonnelHistoryInner: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const searchParamsKey = searchParams.toString();
    const initialUrlSearchRef = useRef(searchParams.toString());
    const didAutoSearchFromUrlRef = useRef(false);
    const didRunCompanyTypeEffectRef = useRef(false);
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const formatDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const initialDateMode = parseDateModeParam(searchParams.get('dateMode')) ?? 'period';
    const requestedStartDate = normalizeDateParam(searchParams.get('startDate')) ?? formatDate(firstDay);
    const requestedEndDate = normalizeDateParam(searchParams.get('endDate')) ?? formatDate(lastDay);
    const initialYearMonth = normalizeYearMonth(searchParams.get('month')) ?? requestedStartDate.slice(0, 7);
    const initialMonthRange = getCalendarMonthRange(initialYearMonth);
    const initialStartDate = initialDateMode === 'monthly' ? initialMonthRange.startDate : requestedStartDate;
    const initialEndDate = initialDateMode === 'monthly' ? initialMonthRange.endDate : requestedEndDate;
    const initialCompanyType = parseCompanyTypeParam(searchParams.get('companyType')) ?? 'construction';
    const initialSalaryModel = parseSalaryModelParam(searchParams.get('salaryModel')) ?? '전체';
    const initialSortOrder = parseSortOrderParam(searchParams.get('sortOrder') ?? searchParams.get('sort')) ?? 'asc';

    const [dateMode, setDateMode] = useState<DateMode>(initialDateMode);
    const [selectedMonth, setSelectedMonth] = useState(initialYearMonth);
    const [startDate, setStartDate] = useState(initialStartDate);
    const [endDate, setEndDate] = useState(initialEndDate);
    const [startDateInput, setStartDateInput] = useState(initialStartDate);
    const [endDateInput, setEndDateInput] = useState(initialEndDate);

    const [companyType, setCompanyType] = useState<CompanyTypeFilter>(initialCompanyType);
    const [salaryModel, setSalaryModel] = useState<SalaryModelFilter>(initialSalaryModel);

    const [selectedTeamId, setSelectedTeamId] = useState<string>(searchParams.get('teamId') ?? '');
    const [selectedWorkerId, setSelectedWorkerId] = useState<string>(searchParams.get('workerId') ?? '');
    const [workerSearchTerm, setWorkerSearchTerm] = useState<string>(searchParams.get('q') ?? searchParams.get('search') ?? '');
    const [isWorkerDropdownOpen, setIsWorkerDropdownOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);

    const [historyData, setHistoryData] = useState<PersonnelHistoryRow[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [allWorkers, setAllWorkers] = useState<Worker[]>([]);
    const [initialLoading, setInitialLoading] = useState(true);
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [hasSearched, setHasSearched] = useState(false);
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(initialSortOrder);
    const [isFixed, setIsFixed] = useState<boolean>(true);

    // Lock parent scroll for internal scrolling
    useEffect(() => {
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
            const originalOverflow = mainContent.style.overflow;
            mainContent.style.overflow = 'hidden';
            return () => {
                mainContent.style.overflow = originalOverflow;
            };
        }
    }, []);

    const fetchInitialData = async () => {
        setInitialLoading(true);
        try {
            const [fetchedTeams, fetchedCompanies, fetchedWorkers] = await Promise.all([
                teamService.getTeams(),
                companyService.getCompanies(),
                manpowerService.getWorkers()
            ]);
            setTeams(fetchedTeams);
            setCompanies(fetchedCompanies);
            setAllWorkers(fetchedWorkers);
        } catch (error) {
            console.error('Error fetching initial data:', error);
            setErrorMessage('기초 데이터를 불러오지 못했습니다. 네트워크 또는 권한 상태를 확인한 뒤 다시 시도해주세요.');
        } finally {
            setInitialLoading(false);
        }
    };

    useEffect(() => {
        void fetchInitialData();
    }, []);

    useEffect(() => {
        setStartDateInput(startDate);
    }, [startDate]);

    useEffect(() => {
        setEndDateInput(endDate);
    }, [endDate]);

    useEffect(() => {
        const nextStartDate = normalizeDateParam(searchParams.get('startDate'));
        const nextEndDate = normalizeDateParam(searchParams.get('endDate'));
        const nextDateMode = parseDateModeParam(searchParams.get('dateMode'));
        const nextSelectedMonth = normalizeYearMonth(searchParams.get('month'));
        const nextCompanyType = parseCompanyTypeParam(searchParams.get('companyType'));
        const nextSalaryModel = parseSalaryModelParam(searchParams.get('salaryModel'));
        const nextSortOrder = parseSortOrderParam(searchParams.get('sortOrder') ?? searchParams.get('sort'));
        const nextTeamId = searchParams.has('teamId') ? (searchParams.get('teamId') ?? '') : null;
        const nextWorkerId = searchParams.has('workerId') ? (searchParams.get('workerId') ?? '') : null;
        const nextWorkerSearch = searchParams.has('q')
            ? (searchParams.get('q') ?? '')
            : (searchParams.has('search') ? (searchParams.get('search') ?? '') : null);

        if (nextStartDate && nextStartDate !== startDate) {
            setStartDate(nextStartDate);
            setStartDateInput(nextStartDate);
        }
        if (nextEndDate && nextEndDate !== endDate) {
            setEndDate(nextEndDate);
            setEndDateInput(nextEndDate);
        }
        if (nextDateMode && nextDateMode !== dateMode) setDateMode(nextDateMode);
        if (nextSelectedMonth && nextSelectedMonth !== selectedMonth) setSelectedMonth(nextSelectedMonth);
        if (nextCompanyType && nextCompanyType !== companyType) setCompanyType(nextCompanyType);
        if (nextSalaryModel && nextSalaryModel !== salaryModel) setSalaryModel(nextSalaryModel);
        if (nextSortOrder && nextSortOrder !== sortOrder) setSortOrder(nextSortOrder);
        if (nextTeamId !== null && nextTeamId !== selectedTeamId) setSelectedTeamId(nextTeamId);
        if (nextWorkerId !== null && nextWorkerId !== selectedWorkerId) setSelectedWorkerId(nextWorkerId);
        if (nextWorkerSearch !== null && nextWorkerSearch !== workerSearchTerm) setWorkerSearchTerm(nextWorkerSearch);
    }, [searchParamsKey]);

    useEffect(() => {
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            next.set('startDate', startDate);
            next.set('endDate', endDate);
            next.set('dateMode', dateMode);
            if (dateMode === 'monthly') next.set('month', selectedMonth);
            else next.delete('month');
            next.set('companyType', companyType);
            next.set('salaryModel', salaryModel);
            next.set('sortOrder', sortOrder);
            next.delete('sort');

            if (selectedTeamId) next.set('teamId', selectedTeamId);
            else next.delete('teamId');

            if (selectedWorkerId) next.set('workerId', selectedWorkerId);
            else next.delete('workerId');

            const trimmedSearch = workerSearchTerm.trim();
            if (trimmedSearch) next.set('q', trimmedSearch);
            else {
                next.delete('q');
                next.delete('search');
            }

            return next.toString() === prev.toString() ? prev : next;
        }, { replace: true });
    }, [companyType, dateMode, endDate, salaryModel, selectedMonth, selectedTeamId, selectedWorkerId, setSearchParams, sortOrder, startDate, workerSearchTerm]);

    useEffect(() => {
        if (!didRunCompanyTypeEffectRef.current) {
            didRunCompanyTypeEffectRef.current = true;
            return;
        }

        setSelectedTeamId('');
        setSelectedWorkerId('');
        setWorkerSearchTerm('');
    }, [companyType]);

    const teamById = useMemo(() => {
        const map = new Map<string, Team>();
        teams.forEach((team) => {
            if (team.id) map.set(String(team.id).trim(), team);
            if ((team as any).legacyId) map.set(String((team as any).legacyId).trim(), team);
        });
        return map;
    }, [teams]);

    const teamByName = useMemo(() => {
        const map = new Map<string, Team>();
        teams.forEach((team) => {
            const nameKey = String(team.name ?? '').replace(/\s+/g, '').trim();
            if (nameKey && !map.has(nameKey)) {
                map.set(nameKey, team);
            }
        });
        return map;
    }, [teams]);

    const allowedTeamIds = useMemo(() => {
        return buildTeamIdsByAffiliation(
            teams,
            companies,
            companyType === 'construction' ? 'cheongyeon' : 'external'
        );
    }, [companies, companyType, teams]);

    const teamOptions = useMemo(() => {
        return teams
            .filter((team) => Boolean(team.id) && team.id && allowedTeamIds.has(team.id))
            .slice()
            .sort((a, b) => String(a.name ?? '').localeCompare(String(b.name ?? ''), 'ko'));
    }, [allowedTeamIds, teams]);

    const workerOptions = useMemo(() => {
        const filtered = allWorkers
            .filter((worker) => Boolean(worker.id))
            .filter((worker) => {
                if (!workerSearchTerm) return true;
                const nameMatch = String(worker.name ?? '').includes(workerSearchTerm);
                const idMatch = String(worker.idNumber ?? '').includes(workerSearchTerm);
                return nameMatch || idMatch;
            })
            .filter((worker) => {
                const rawTeamId = String(worker.teamId ?? '').trim();
                const teamId = String(teamById.get(rawTeamId)?.id ?? rawTeamId).trim();
                if (!teamId || (!allowedTeamIds.has(teamId) && !allowedTeamIds.has(rawTeamId))) return false;
                if (selectedTeamId && teamId !== selectedTeamId) return false;
                return true;
            })
            .filter((worker) => {
                const model = resolveWorkerSalaryModel(worker);
                return matchesSalaryModelFilter(model, salaryModel);
            })
            .slice()
            .sort((a, b) => String(a.name ?? '').localeCompare(String(b.name ?? ''), 'ko'));

        return filtered;
    }, [allWorkers, allowedTeamIds, salaryModel, selectedTeamId, teamById, workerSearchTerm]);

    // Reset active index when search term changes or dropdown opens
    useEffect(() => {
        setActiveIndex(0);
    }, [workerSearchTerm, isWorkerDropdownOpen]);

    // Handle Keyboard Navigation
    const handleWorkerKeyDown = (e: React.KeyboardEvent) => {
        if (!isWorkerDropdownOpen) {
            if (e.key === 'ArrowDown' || e.key === 'Enter') {
                setIsWorkerDropdownOpen(true);
            }
            return;
        }

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setActiveIndex(prev => (prev < workerOptions.length - 1 ? prev + 1 : prev));
                break;
            case 'ArrowUp':
                e.preventDefault();
                setActiveIndex(prev => (prev > 0 ? prev - 1 : prev));
                break;
            case 'Enter':
                e.preventDefault();
                if (workerOptions.length > 0 && activeIndex >= 0) {
                    const selected = workerOptions[activeIndex];
                    setSelectedWorkerId(selected.id || '');
                    setIsWorkerDropdownOpen(false);
                }
                break;
            case 'Escape':
                setIsWorkerDropdownOpen(false);
                break;
            case 'Tab':
                setIsWorkerDropdownOpen(false);
                break;
        }
    };

    // Text Highlighter Utility
    const HighlightText = ({ text, highlight }: { text: string; highlight: string }) => {
        const sourceText = String(text ?? '');
        const trimmedHighlight = highlight.trim();
        if (!trimmedHighlight) return <span>{sourceText}</span>;

        const parts = sourceText.split(new RegExp(`(${escapeRegExp(trimmedHighlight)})`, 'gi'));
        return (
            <span>
                {parts.map((part, i) =>
                    part.toLowerCase() === trimmedHighlight.toLowerCase() ? (
                        <span key={i} className="bg-yellow-200 text-slate-900 rounded-sm px-0.5">{part}</span>
                    ) : (
                        <span key={i}>{part}</span>
                    )
                )}
            </span>
        );
    };

    useEffect(() => {
        const selectableTeamIds = new Set(
            teamOptions
                .map((team) => String(team.id ?? '').trim())
                .filter((id) => Boolean(id))
        );

        if (selectedTeamId && !selectableTeamIds.has(selectedTeamId)) {
            setSelectedTeamId('');
            setSelectedWorkerId('');
            setWorkerSearchTerm('');
            return;
        }
        if (selectedWorkerId && !workerOptions.some((w) => w.id === selectedWorkerId)) {
            setSelectedWorkerId('');
        }
    }, [selectedTeamId, selectedWorkerId, teamOptions, workerOptions]);

    const validateDateRange = (nextStartDate: string, nextEndDate: string): string => {
        if (nextStartDate > nextEndDate) {
            return '시작일은 종료일보다 늦을 수 없습니다.';
        }
        return '';
    };

    const commitDateDrafts = (): { startDate: string; endDate: string } | null => {
        if (dateMode === 'monthly') {
            const nextRange = getCalendarMonthRange(selectedMonth);
            setStartDate(nextRange.startDate);
            setEndDate(nextRange.endDate);
            setStartDateInput(nextRange.startDate);
            setEndDateInput(nextRange.endDate);
            setErrorMessage('');
            return nextRange;
        }

        const nextStartDate = normalizeTypedDateInput(startDateInput);
        const nextEndDate = normalizeTypedDateInput(endDateInput);

        if (!nextStartDate || !nextEndDate) {
            setErrorMessage('날짜는 YYYY-MM-DD 형식으로 입력해주세요.');
            setHistoryData([]);
            return null;
        }

        const dateRangeError = validateDateRange(nextStartDate, nextEndDate);
        if (dateRangeError) {
            setErrorMessage(dateRangeError);
            setHistoryData([]);
            return null;
        }

        setStartDateInput(nextStartDate);
        setEndDateInput(nextEndDate);
        setErrorMessage('');

        if (nextStartDate !== startDate) setStartDate(nextStartDate);
        if (nextEndDate !== endDate) setEndDate(nextEndDate);

        return {
            startDate: nextStartDate,
            endDate: nextEndDate,
        };
    };

    const handleDateInputChange = (field: 'start' | 'end', value: string) => {
        const sanitized = sanitizeTypedDateInput(value);
        const normalized = normalizeTypedDateInput(sanitized);

        if (field === 'start') {
            setStartDateInput(sanitized);
            if (normalized && normalized !== startDate) {
                setStartDate(normalized);
            }
            return;
        }

        setEndDateInput(sanitized);
        if (normalized && normalized !== endDate) {
            setEndDate(normalized);
        }
    };

    const fetchData = async (dateOverride?: { startDate: string; endDate: string }) => {
        const effectiveStartDate = dateOverride?.startDate ?? startDate;
        const effectiveEndDate = dateOverride?.endDate ?? endDate;
        const dateRangeError = validateDateRange(effectiveStartDate, effectiveEndDate);
        if (dateRangeError) {
            setErrorMessage(dateRangeError);
            setHistoryData([]);
            return;
        }

        setLoading(true);
        setErrorMessage('');
        setHasSearched(true);
        try {
            const [workers, reportRows] = await Promise.all([
                manpowerService.getWorkers(),
                dailyReportService.getReportWorkerRowsByRange({ startDate: effectiveStartDate, endDate: effectiveEndDate })
            ]);
            setAllWorkers(workers);
            const workerById = new Map<string, Worker>();
            workers.forEach((w) => {
                const id = String(w.id ?? '').trim();
                const legacyId = String((w as any).legacyId ?? '').trim();
                if (id) workerById.set(id, w);
                if (legacyId) workerById.set(legacyId, w);
            });

            const normalizeTeamId = (value?: string | null): string => {
                const raw = String(value ?? '').trim();
                if (!raw) return '';
                return String(teamById.get(raw)?.id ?? raw).trim();
            };

            const normalizeWorkerId = (value?: string | null): string => {
                const raw = String(value ?? '').trim();
                if (!raw) return '';
                return String(workerById.get(raw)?.id ?? raw).trim();
            };

            const selectedNormalizedTeamId = normalizeTeamId(selectedTeamId);
            const selectedWorkerIds = new Set<string>();
            if (selectedWorkerId) {
                const normalizedSelectedWorkerId = normalizeWorkerId(selectedWorkerId);
                if (normalizedSelectedWorkerId) selectedWorkerIds.add(normalizedSelectedWorkerId);

                const selectedWorker =
                    workerById.get(String(selectedWorkerId).trim())
                    ?? allWorkers.find((worker) => String(worker.id ?? '').trim() === String(selectedWorkerId).trim());
                const selectedLegacyId = String((selectedWorker as any)?.legacyId ?? '').trim();
                const normalizedLegacyId = normalizeWorkerId(selectedLegacyId);
                if (normalizedLegacyId) selectedWorkerIds.add(normalizedLegacyId);
            }

            const search = workerSearchTerm.trim();

            const statsByWorkerTeam = new Map<string, {
                workerId: string;
                name: string;
                idNumber: string;
                salaryModel: SalaryModelFilter;
                teamId: string;
                teamName: string;
                laborManDay: number;
                invoiceManDay: number;
                laborAmount: number;
                invoiceAmount: number;
                unitPriceBreakdown: Map<number, { manDay: number; amount: number }>;
            }>();
            const salaryByWorkerTeam = new Map<string, SalaryModelFilter>();
            const siteById = new Map<string, { siteType?: unknown; paymentMethod?: unknown }>();

            reportRows.forEach((row) => {
                const rawWorkerId = String(row.workerId ?? '').trim();
                if (!rawWorkerId) return;

                const normalizedWorkerId = normalizeWorkerId(rawWorkerId);
                if (!normalizedWorkerId) return;
                if (selectedWorkerIds.size > 0 && !selectedWorkerIds.has(normalizedWorkerId)) return;

                const worker = workerById.get(rawWorkerId) ?? workerById.get(normalizedWorkerId);
                const workerName = String(row.workerName ?? worker?.name ?? '').trim();
                const idNumber = String(worker?.idNumber ?? '').trim();
                if (search && selectedWorkerIds.size === 0) {
                    const matchesName = workerName.includes(search);
                    const matchesIdNumber = idNumber.includes(search);
                    if (!matchesName && !matchesIdNumber) return;
                }

                // A daily report is the historical source of truth. A worker's master-team
                // assignment can change later, so it must only be used for legacy rows
                // that do not have a saved team snapshot.
                const snapshotTeamName = String(row.workerTeamName ?? '').trim();
                const snapshotTeamId =
                    normalizeTeamId(row.workerTeamId)
                    || String(teamByName.get(snapshotTeamName.replace(/\s+/g, ''))?.id ?? '').trim();
                const workerTeamId = snapshotTeamId || normalizeTeamId(worker?.teamId);
                if (!workerTeamId) return;
                if (!allowedTeamIds.has(workerTeamId)) return;
                if (selectedNormalizedTeamId && workerTeamId !== selectedNormalizedTeamId) return;
                const workerTeamName = String(
                    (snapshotTeamId && snapshotTeamName ? snapshotTeamName : undefined)
                    ??
                    teamById.get(workerTeamId)?.name ??
                    worker?.teamName ??
                    row.workerTeamName ??
                    ''
                ).trim();

                const workerId = normalizedWorkerId;
                const statsKey = `${workerId}::${workerTeamId}`;
                const rw = row;
                const report = row as any;

                const model = resolveSnapshotSalaryModel({
                    worker: worker ?? ({
                        name: row.name ?? '',
                        salaryModel: row.salaryModel ?? '',
                        payType: row.payType ?? '',
                    }),
                    reportSalaryModel: row.salaryModel,
                    reportPayType: row.payType
                });

                if (!matchesSalaryModelFilter(model, salaryModel)) return;

                const prevModel = salaryByWorkerTeam.get(statsKey);
                if (!prevModel) salaryByWorkerTeam.set(statsKey, model);

                const manDay = typeof rw.manDay === 'number' ? rw.manDay : 0;
                const snapshotUnitPrice = typeof rw.unitPrice === 'number' ? rw.unitPrice : null;
                const fallbackUnitPrice = typeof worker?.unitPrice === 'number' ? worker.unitPrice : 0;
                const unitPrice = snapshotUnitPrice ?? fallbackUnitPrice;
                const amount = typeof rw.amount === 'number' ? rw.amount : (manDay * unitPrice);

                const current = statsByWorkerTeam.get(statsKey) ?? {
                    workerId,
                    name: workerName,
                    idNumber,
                    salaryModel: model,
                    teamId: workerTeamId,
                    teamName: workerTeamName,
                    laborManDay: 0,
                    invoiceManDay: 0,
                    laborAmount: 0,
                    invoiceAmount: 0,
                    unitPriceBreakdown: new Map<number, { manDay: number; amount: number }>()
                };
                if (!current.name && workerName) current.name = workerName;
                if (!current.idNumber && idNumber) current.idNumber = idNumber;
                if (!current.teamId && workerTeamId) current.teamId = workerTeamId;
                if (!current.teamName) {
                    current.teamName = workerTeamName;
                }
                // 2024-05-22 Separate Labor/Invoice based on siteType & paymentType
                const site = siteById.get(String(report.siteId ?? '').trim());
                const siteType = rw.siteType ?? report.siteType ?? site?.siteType;
                const paymentType = rw.paymentType ?? report.paymentType ?? site?.paymentMethod;
                const isInvoice = classifyInvoiceBySiteContext({
                    paymentType,
                    siteType,
                    salaryModel: model
                });

                if (isInvoice) {
                    current.invoiceManDay += manDay;
                    current.invoiceAmount += amount;
                } else {
                    current.laborManDay += manDay;
                    current.laborAmount += amount;
                }

                const unitPriceStats = current.unitPriceBreakdown.get(unitPrice) ?? { manDay: 0, amount: 0 };
                unitPriceStats.manDay += manDay;
                unitPriceStats.amount += amount;
                current.unitPriceBreakdown.set(unitPrice, unitPriceStats);

                statsByWorkerTeam.set(statsKey, current);
            });

            const result: PersonnelHistoryRow[] = [];
            statsByWorkerTeam.forEach((stats) => {
                const workerId = stats.workerId;
                const worker = workerById.get(workerId);
                const teamId = stats.teamId || String(worker?.teamId ?? '').trim();
                const teamName = stats.teamName || teamById.get(teamId)?.name || String(worker?.teamName ?? '');
                const model = salaryByWorkerTeam.get(`${workerId}::${stats.teamId}`)
                    ?? stats.salaryModel
                    ?? resolveWorkerSalaryModel(worker ?? ({ name: stats.name } as Worker));
                const fallbackUnitPrice = typeof worker?.unitPrice === 'number' ? worker.unitPrice : 0;

                const totalManDay = stats.laborManDay + stats.invoiceManDay;
                const totalAmount = stats.laborAmount + stats.invoiceAmount;
                const computedUnitPrice = totalManDay > 0 ? Math.round(totalAmount / totalManDay) : fallbackUnitPrice;
                const unitPriceBreakdown = Array.from(stats.unitPriceBreakdown.entries())
                    .map(([unitPrice, priceStats]) => ({
                        unitPrice,
                        manDay: priceStats.manDay,
                        amount: priceStats.amount
                    }))
                    .sort((a, b) => a.unitPrice - b.unitPrice);

                result.push({
                    workerId,
                    name: stats.name || String(worker?.name ?? ''),
                    idNumber: stats.idNumber || String(worker?.idNumber ?? ''),
                    salaryModel: model,
                    teamId,
                    teamName,
                    laborManDay: stats.laborManDay,
                    invoiceManDay: stats.invoiceManDay,
                    totalManDay,
                    unitPrice: computedUnitPrice,
                    unitPriceBreakdown,
                    laborAmount: stats.laborAmount,
                    invoiceAmount: stats.invoiceAmount,
                    totalAmount
                });
            });

            result.sort((a, b) => {
                const cmp = String(a.name ?? '').localeCompare(String(b.name ?? ''), 'ko');
                if (cmp !== 0) return sortOrder === 'asc' ? cmp : -cmp;
                return String(a.teamName ?? '').localeCompare(String(b.teamName ?? ''), 'ko');
            });

            setHistoryData(result);
        } catch (error) {
            console.error('Error fetching history data:', error);
            setHistoryData([]);
            setErrorMessage('데이터 조회 중 오류가 발생했습니다. 잠시 후 다시 조회해주세요.');
        } finally {
            setLoading(false);
        }
    };

    const applyMonthlyRange = (nextMonth: string, refreshAfterChange: boolean) => {
        const normalizedMonth = normalizeYearMonth(nextMonth);
        if (!normalizedMonth) return;

        const nextRange = getCalendarMonthRange(normalizedMonth);
        setSelectedMonth(normalizedMonth);
        setStartDate(nextRange.startDate);
        setEndDate(nextRange.endDate);
        setStartDateInput(nextRange.startDate);
        setEndDateInput(nextRange.endDate);
        setErrorMessage('');

        if (refreshAfterChange && !initialLoading) {
            void fetchData(nextRange);
        }
    };

    const handleDateModeChange = (nextMode: DateMode) => {
        if (nextMode === dateMode) return;
        setDateMode(nextMode);

        if (nextMode === 'monthly') {
            const nextMonth = normalizeYearMonth(startDate.slice(0, 7)) ?? formatDate(new Date()).slice(0, 7);
            applyMonthlyRange(nextMonth, hasSearched);
        }
    };

    const handleMonthChange = (nextMonth: string) => {
        applyMonthlyRange(nextMonth, hasSearched);
    };

    useEffect(() => {
        if (didAutoSearchFromUrlRef.current) return;
        if (!initialUrlSearchRef.current) return;
        if (initialLoading) return;

        didAutoSearchFromUrlRef.current = true;
        void fetchData({ startDate, endDate });
        // Direct-link reproduction should run once after master data is ready.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [endDate, initialLoading, startDate]);

    const sortedHistoryData = useMemo(() => {
        return historyData
            .slice()
            .sort((a, b) => {
                const cmp = String(a.name ?? '').localeCompare(String(b.name ?? ''), 'ko');
                return sortOrder === 'asc' ? cmp : -cmp;
            });
    }, [historyData, sortOrder]);

    const handleDownloadExcel = () => {
        if (sortedHistoryData.length === 0) {
            alert('다운로드할 데이터가 없습니다. 먼저 조회해주세요.');
            return;
        }

        const headers = ['No', '이름', '주민번호', '본봉'] as const;
        const wsData: Array<Array<string | number>> = [headers.slice() as unknown as Array<string | number>];

        sortedHistoryData.forEach((row, index) => {
            wsData.push([
                index + 1,
                row.name,
                formatResidentNumberForDisplay(row.idNumber),
                row.invoiceAmount
            ]);
        });

        const ws = XLSX.utils.aoa_to_sheet(wsData);

        // Column widths
        ws['!cols'] = [
            { wch: 6 },
            { wch: 12 },
            { wch: 20 },
            { wch: 16 }
        ];

        // Number formats (xlsx-js-style)
        const setCellNumFmt = (rowIndex: number, colIndex: number, numFmt: string) => {
            const addr = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
            const cell = ws[addr] as { t?: string; v?: unknown; s?: Record<string, unknown> } | undefined;
            if (!cell) return;
            cell.s = { ...(cell.s ?? {}), numFmt };
        };

        // Data rows start at r=1 (r=0 is header)
        for (let r = 1; r < wsData.length; r += 1) {
            setCellNumFmt(r, 3, '#,##0');   // 본봉
        }

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, '인원전체내역');
        XLSX.writeFile(wb, `인원전체내역_${startDate}_${endDate}.xlsx`);
    };


    const handleSyncReports = async () => {
        if (!window.confirm('기존 일보의 작업자별 급여방식을 일괄 동기화합니다. 시간이 걸릴 수 있습니다. 계속하시겠습니까?')) return;
        try {
            const result = await dailyReportService.syncReportsSalaryModel();
            if (result.updated > 0) {
                alert(`${result.updated}개의 일보가 동기화되었습니다.`);
            } else if (result.errors.length > 0) {
                alert(`동기화 실패: ${result.errors.join(', ')}`);
            } else {
                alert('동기화할 일보가 없습니다. (이미 모두 동기화됨)');
            }
        } catch (error) {
            alert('동기화 중 오류가 발생했습니다.');
            console.error(error);
        }
    };

    return (
        <div className="flex-1 flex flex-col min-h-0 bg-slate-50 overflow-hidden">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-shrink-0">
                <div className="flex flex-col">
                    <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <FontAwesomeIcon icon={faFileInvoiceDollar} className="text-blue-600" />
                        인원 전체내역 조회
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        기간별 또는 월별로 전체 인원의 공수 및 급여 내역을 조회하고 엑셀로 다운로드합니다.
                    </p>
                </div>
                {/* Header Buttons Row */}
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={handleDownloadExcel}
                        className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all shadow-sm font-medium text-sm"
                    >
                        <FontAwesomeIcon icon={faDownload} />
                        세무용 Excel
                    </button>
                    <button
                        onClick={handleSyncReports}
                        className="flex items-center gap-2 px-3 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-all shadow-sm font-medium text-sm"
                    >
                        <FontAwesomeIcon icon={faSync} />
                        일보
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col p-4 overflow-hidden gap-3">
                {/* Filter Bar */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col gap-3 flex-shrink-0">
                    <div className="flex flex-wrap items-stretch sm:items-end gap-3">
                        <div className="flex flex-col gap-1">
                            <span className="text-xs font-medium text-slate-500">조회 방식</span>
                            <div className="inline-flex h-9 rounded-lg bg-slate-100 p-1" role="tablist" aria-label="조회 방식">
                                <button
                                    type="button"
                                    role="tab"
                                    aria-selected={dateMode === 'period'}
                                    onClick={() => handleDateModeChange('period')}
                                    className={`rounded-md px-3 text-xs font-bold transition-all ${dateMode === 'period' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    기간별
                                </button>
                                <button
                                    type="button"
                                    role="tab"
                                    aria-selected={dateMode === 'monthly'}
                                    onClick={() => handleDateModeChange('monthly')}
                                    className={`rounded-md px-3 text-xs font-bold transition-all ${dateMode === 'monthly' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    월별
                                </button>
                            </div>
                        </div>

                        {dateMode === 'period' ? (
                            <>
                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-1">
                                        <label className="text-xs font-medium text-slate-500">시작일</label>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const t = new Date();
                                                const nextStartDate = formatDate(new Date(t.getFullYear(), t.getMonth() - 1, 1));
                                                const nextEndDate = formatDate(new Date(t.getFullYear(), t.getMonth(), 0));
                                                setStartDate(nextStartDate);
                                                setEndDate(nextEndDate);
                                                setStartDateInput(nextStartDate);
                                                setEndDateInput(nextEndDate);
                                            }}
                                            className="px-1.5 py-0.5 text-[10px] bg-slate-100 hover:bg-slate-200 rounded"
                                        >
                                            전달
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const t = new Date();
                                                const nextStartDate = formatDate(new Date(t.getFullYear(), t.getMonth(), 1));
                                                const nextEndDate = formatDate(t);
                                                setStartDate(nextStartDate);
                                                setEndDate(nextEndDate);
                                                setStartDateInput(nextStartDate);
                                                setEndDateInput(nextEndDate);
                                            }}
                                            className="px-1.5 py-0.5 text-[10px] bg-slate-100 hover:bg-slate-200 rounded"
                                        >
                                            이달
                                        </button>
                                    </div>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        aria-label="조회 시작일"
                                        value={startDateInput}
                                        onChange={(e) => handleDateInputChange('start', e.target.value)}
                                        onBlur={() => {
                                            const nextStartDate = normalizeTypedDateInput(startDateInput) ?? startDate;
                                            setStartDateInput(nextStartDate);
                                            if (nextStartDate !== startDate) {
                                                setStartDate(nextStartDate);
                                            }
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.currentTarget.blur();
                                            }
                                        }}
                                        placeholder="YYYY-MM-DD"
                                        className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm w-36"
                                    />
                                </div>

                                <div className="flex flex-col gap-1">
                                    <label className="text-xs font-medium text-slate-500">종료일</label>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        aria-label="조회 종료일"
                                        value={endDateInput}
                                        onChange={(e) => handleDateInputChange('end', e.target.value)}
                                        onBlur={() => {
                                            const nextEndDate = normalizeTypedDateInput(endDateInput) ?? endDate;
                                            setEndDateInput(nextEndDate);
                                            if (nextEndDate !== endDate) {
                                                setEndDate(nextEndDate);
                                            }
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.currentTarget.blur();
                                            }
                                        }}
                                        placeholder="YYYY-MM-DD"
                                        className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm w-36"
                                    />
                                </div>
                            </>
                        ) : (
                            <div className="flex w-full flex-col gap-1 sm:w-52">
                                <span className="text-xs font-medium text-slate-500">조회월</span>
                                <MonthNavigator
                                    value={selectedMonth}
                                    onChange={handleMonthChange}
                                    disabled={loading || initialLoading}
                                    ariaLabel="인원 전체내역 조회월"
                                />
                            </div>
                        )}

                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-slate-500">구분</label>
                            <select
                                value={companyType}
                                onChange={(e) => setCompanyType(e.target.value as CompanyTypeFilter)}
                                className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm min-w-32"
                            >
                                <option value="construction">청연이엔지</option>
                                <option value="partner">외부팀</option>
                            </select>
                        </div>

                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-slate-500">급여방식</label>
                            <select
                                value={salaryModel}
                                onChange={(e) => setSalaryModel(e.target.value as SalaryModelFilter)}
                                className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm min-w-32"
                            >
                                <option value="전체">전체</option>
                                <option value="일급제">일급제</option>
                                <option value="월급제">월급제</option>
                                <option value="지원팀">지원팀</option>
                                <option value="용역팀">용역팀</option>
                            </select>
                        </div>

                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-slate-500">팀</label>
                            <select
                                value={selectedTeamId}
                                onChange={(e) => setSelectedTeamId(e.target.value)}
                                className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm min-w-40"
                            >
                                <option value="">전체 팀</option>
                                {teamOptions.map((team) => (
                                    <option key={team.id} value={team.id}>
                                        {team.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="flex flex-col gap-1 relative w-full sm:w-auto">
                            <label className="text-xs font-medium text-slate-500">작업자 검색 및 선택</label>
                            <div className="relative">
                                <div
                                    onClick={() => setIsWorkerDropdownOpen(!isWorkerDropdownOpen)}
                                    className={`flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm w-full sm:w-72 h-[38px] cursor-pointer hover:border-blue-400 transition-all ${isWorkerDropdownOpen ? 'ring-2 ring-blue-500 border-blue-500' : ''}`}
                                >
                                    <FontAwesomeIcon icon={faSearch} className="text-slate-400 text-xs" />
                                    <input
                                        type="text"
                                        value={selectedWorkerId ? (allWorkers.find(w => w.id === selectedWorkerId)?.name || '') : workerSearchTerm}
                                        onChange={(e) => {
                                            if (selectedWorkerId) {
                                                setSelectedWorkerId('');
                                            }
                                            setWorkerSearchTerm(e.target.value);
                                            setIsWorkerDropdownOpen(true);
                                        }}
                                        onKeyDown={handleWorkerKeyDown}
                                        placeholder="이름 또는 주민번호 입력"
                                        aria-label="작업자 검색어"
                                        className="bg-transparent border-none outline-none text-sm w-full"
                                        onFocus={() => setIsWorkerDropdownOpen(true)}
                                    />
                                    {(selectedWorkerId || workerSearchTerm) && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedWorkerId('');
                                                setWorkerSearchTerm('');
                                            }}
                                            aria-label="작업자 검색 초기화"
                                            className="ml-auto text-slate-400 hover:text-slate-600 p-1"
                                        >
                                            <FontAwesomeIcon icon={faTimes} className="text-[10px]" />
                                        </button>
                                    )}
                                    <FontAwesomeIcon icon={faChevronDown} className={`text-slate-300 text-[10px] transition-transform duration-200 ${isWorkerDropdownOpen ? 'rotate-180' : ''}`} />
                                </div>

                                <AnimatePresence>
                                    {isWorkerDropdownOpen && (
                                        <>
                                            <div
                                                className="fixed inset-0 z-40"
                                                onClick={() => setIsWorkerDropdownOpen(false)}
                                            />
                                            <motion.div
                                                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                                                transition={{ duration: 0.15, ease: 'easeOut' }}
                                                className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 overflow-hidden min-w-full sm:min-w-[320px]"
                                            >
                                                <div className="max-h-[300px] overflow-y-auto p-2 space-y-1 custom-scrollbar">
                                                    {workerOptions.length > 0 ? (
                                                        <>
                                                            <div className="px-3 py-2 text-[11px] font-bold text-slate-400 flex items-center justify-between">
                                                                <span>검색 결과: {workerOptions.length}명</span>
                                                                {workerSearchTerm && !selectedWorkerId && (
                                                                    <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">검색 모드</span>
                                                                )}
                                                            </div>
                                                            {workerOptions.map((worker, index) => (
                                                                <button
                                                                    key={worker.id}
                                                                    onClick={() => {
                                                                        setSelectedWorkerId(worker.id || '');
                                                                        setIsWorkerDropdownOpen(false);
                                                                    }}
                                                                    onMouseEnter={() => setActiveIndex(index)}
                                                                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all group ${selectedWorkerId === worker.id || activeIndex === index
                                                                        ? (selectedWorkerId === worker.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-900')
                                                                        : 'hover:bg-slate-50 text-slate-700'
                                                                        }`}
                                                                >
                                                                    <div className="flex items-center gap-3">
                                                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs ${selectedWorkerId === worker.id ? 'bg-blue-500' : activeIndex === index ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 group-hover:bg-blue-50 group-hover:text-blue-600'}`}>
                                                                            <FontAwesomeIcon icon={faUser} />
                                                                        </div>
                                                                        <div className="text-left">
                                                                            <p className="font-bold">
                                                                                <HighlightText text={worker.name} highlight={workerSearchTerm} />
                                                                            </p>
                                                                            <p className={`text-[11px] ${selectedWorkerId === worker.id ? 'text-blue-100' : 'text-slate-400'}`}>
                                                                                {worker.teamName || '팀 미지정'} • <HighlightText text={formatResidentNumberForDisplay(worker.idNumber || '').slice(0, 8)} highlight={workerSearchTerm} />******
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                    {selectedWorkerId === worker.id && (
                                                                        <div className="w-2 h-2 rounded-full bg-white shadow-sm" />
                                                                    )}
                                                                </button>
                                                            ))}
                                                        </>
                                                    ) : (
                                                        <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-3">
                                                            <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center">
                                                                <FontAwesomeIcon icon={faSearch} className="text-lg opacity-20" />
                                                            </div>
                                                            <p className="text-xs">검색 결과가 없습니다.</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </motion.div>
                                        </>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${sortOrder === 'asc' ? 'bg-indigo-500 text-white' : 'bg-amber-500 text-white'}`}
                        >
                            {sortOrder === 'asc' ? '이름 ㄱ→ㅎ' : '이름 ㅎ→ㄱ'}
                        </button>

                        <button
                            onClick={() => {
                                const nextRange = commitDateDrafts();
                                if (nextRange) {
                                    void fetchData(nextRange);
                                }
                            }}
                            disabled={loading || initialLoading}
                            className={`px-4 py-1.5 rounded-lg transition-all shadow-md font-bold flex items-center justify-center gap-2 text-sm ${loading || initialLoading ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                        >
                            <FontAwesomeIcon icon={faSearch} />
                            조회
                        </button>
                    </div>
                </div>

                {errorMessage && (
                    <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm flex items-center justify-between gap-3">
                        <span>{errorMessage}</span>
                        <button
                            type="button"
                            onClick={() => setErrorMessage('')}
                            className="text-red-500 hover:text-red-700 font-bold text-xs"
                        >
                            닫기
                        </button>
                    </div>
                )}

                {/* Table Area */}
                <div className="flex-1 min-h-0 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
                    <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-white">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                            <span className="w-1.5 h-5 bg-blue-600 rounded-sm"></span>
                            조회 결과
                            <span className="text-slate-400 font-normal text-sm">({historyData.length.toLocaleString()}건)</span>
                        </h3>
                    </div>

                    <div className="flex-1 min-h-0 overflow-auto overscroll-contain">
                        <table className="w-full min-w-[980px] text-sm text-left border-separate border-spacing-0">
                            <thead className="bg-slate-50 text-slate-500 font-semibold sticky top-0 z-40">
                                <tr className="text-xs uppercase tracking-wider">
                                    <th rowSpan={2} className={`px-4 py-2 text-center w-12 border-b border-r border-slate-200 ${isFixed ? 'sticky left-0 z-50 bg-slate-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]' : ''}`}>No</th>
                                    <th rowSpan={2} className={`px-4 py-2 border-b border-r border-slate-200 ${isFixed ? 'sticky left-[48px] z-50 bg-slate-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]' : ''}`} style={{ width: isFixed ? '100px' : 'auto', minWidth: isFixed ? '100px' : 'auto' }}>이름</th>
                                    <th rowSpan={2} className={`px-4 py-2 border-b border-r border-slate-200 ${isFixed ? 'sticky left-[148px] z-50 bg-slate-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]' : ''}`} style={{ width: isFixed ? '140px' : 'auto', minWidth: isFixed ? '140px' : 'auto' }}>팀명</th>
                                    <th rowSpan={2} className="px-4 py-2 border-b border-r border-slate-200">주민번호</th>
                                    <th rowSpan={2} className="px-4 py-2 border-b border-r border-slate-200">급여방식</th>
                                    <th colSpan={3} className="px-4 py-1 text-center border-b border-r border-slate-200 bg-slate-100/50">공수 (Man-Days)</th>
                                    <th rowSpan={2} className="px-4 py-2 text-right border-b border-r border-slate-200">적용 단가</th>
                                    <th colSpan={3} className="px-4 py-1 text-center border-b border-slate-200 bg-blue-50/50 text-blue-700">본봉 (Total Amount)</th>
                                </tr>
                                <tr>
                                    <th className="px-3 py-1 text-right border-b border-r border-slate-200 text-[10px] bg-slate-50">노무</th>
                                    <th className="px-3 py-1 text-right border-b border-r border-slate-200 text-[10px] bg-slate-50">계산서</th>
                                    <th className="px-3 py-1 text-right border-b border-r border-slate-200 text-[11px] bg-slate-100 font-bold">합계</th>
                                    <th className="px-3 py-1 text-right border-b border-r border-slate-200 text-[10px] bg-blue-50/30">노무</th>
                                    <th className="px-3 py-1 text-right border-b border-r border-slate-200 text-[10px] bg-blue-50/30">계산서</th>
                                    <th className="px-3 py-1 text-right border-b border-slate-200 text-[11px] bg-blue-600 text-white font-bold">합계</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading || initialLoading ? (
                                    <tr>
                                        <td colSpan={TABLE_COLUMN_COUNT} className="px-4 py-12 text-center text-slate-500">
                                            <div className="flex flex-col items-center gap-2">
                                                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                                <span>{initialLoading ? '기초 데이터 불러오는 중...' : '데이터 분석 중...'}</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : sortedHistoryData.length === 0 ? (
                                    <tr>
                                        <td colSpan={TABLE_COLUMN_COUNT} className="px-4 py-12 text-center text-slate-500 bg-slate-50/50">
                                            <FontAwesomeIcon icon={faSearch} className="text-2xl text-slate-300 mb-2" />
                                            <p className="font-medium">{hasSearched ? '조회된 데이터가 없습니다.' : '조회 대기 중입니다.'}</p>
                                            <p className="text-xs text-slate-400">{hasSearched ? '검색 조건을 변경하여 다시 조회해보세요.' : '기간과 조건을 확인한 뒤 조회를 눌러주세요.'}</p>
                                        </td>
                                    </tr>
                                ) : (
                                    sortedHistoryData.map((item, index) => (
                                        <tr key={`${item.workerId}-${item.teamId}`} className="hover:bg-blue-50/50 transition-colors">
                                            <td className={`px-4 py-3 text-center text-slate-400 text-xs border-b border-slate-100 ${isFixed ? 'sticky left-0 z-10 bg-white shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]' : ''}`}>{index + 1}</td>
                                            <td className={`px-4 py-3 font-bold text-slate-800 border-b border-slate-100 ${isFixed ? 'sticky left-[48px] z-10 bg-white shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]' : ''}`}>{item.name}</td>
                                            <td className={`px-4 py-3 text-slate-600 border-b border-slate-100 ${isFixed ? 'sticky left-[148px] z-10 bg-white shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]' : ''}`}>{item.teamName || '-'}</td>
                                            <td className="px-4 py-3 text-slate-500 font-mono text-xs border-b border-slate-100">{maskResidentNumberForDisplay(item.idNumber)}</td>
                                            <td className="px-4 py-3 border-b border-slate-100">
                                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${item.salaryModel === '일급제' ? 'bg-blue-50 text-blue-600' :
                                                    item.salaryModel === '월급제' ? 'bg-indigo-50 text-indigo-600' :
                                                        item.salaryModel === '지원팀' ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-600'
                                                    }`}>{item.salaryModel}</span>
                                            </td>
                                            <td className="px-3 py-3 text-right font-mono text-slate-500 bg-slate-50/30 border-b border-r border-slate-100">{item.laborManDay > 0 ? formatManDay(item.laborManDay) : '-'}</td>
                                            <td className="px-3 py-3 text-right font-mono text-slate-500 bg-slate-50/30 border-b border-r border-slate-100">{item.invoiceManDay > 0 ? formatManDay(item.invoiceManDay) : '-'}</td>
                                            <td className="px-3 py-3 text-right font-mono text-slate-800 font-bold bg-slate-100/30 border-b border-r border-slate-100 tracking-tighter">{formatManDay(item.totalManDay)}</td>
                                            <td
                                                className="px-4 py-3 text-right font-mono text-xs border-b border-r border-slate-100"
                                                title={item.unitPriceBreakdown.length > 1
                                                    ? `기간 가중 평균: ${item.unitPrice.toLocaleString()}원\n${item.unitPriceBreakdown
                                                        .map((price) => `${price.unitPrice.toLocaleString()}원 × ${formatManDay(price.manDay)}일 = ${price.amount.toLocaleString()}원`)
                                                        .join('\n')}`
                                                    : undefined}
                                            >
                                                {item.unitPriceBreakdown.length > 1 ? (
                                                    <div className="flex flex-col items-end gap-0.5 whitespace-nowrap">
                                                        <span className="font-bold text-amber-700">단가 변동</span>
                                                        {item.unitPriceBreakdown.map((price) => (
                                                            <span key={price.unitPrice} className="text-[10px] leading-4 text-slate-500">
                                                                {price.unitPrice.toLocaleString()}원 × {formatManDay(price.manDay)}일 = {price.amount.toLocaleString()}원
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-500">{item.unitPrice.toLocaleString()}원</span>
                                                )}
                                            </td>
                                            <td className="px-3 py-3 text-right font-mono text-slate-600 border-b border-r border-slate-100">{item.laborAmount > 0 ? item.laborAmount.toLocaleString() : '-'}</td>
                                            <td className="px-3 py-3 text-right font-mono text-slate-600 border-b border-r border-slate-100">{item.invoiceAmount > 0 ? item.invoiceAmount.toLocaleString() : '-'}</td>
                                            <td className="px-4 py-3 text-right border-b border-slate-100 bg-blue-50/10">
                                                <span className="font-bold text-blue-700 font-mono tracking-tighter">{item.totalAmount.toLocaleString()}</span>
                                                <span className="text-[10px] text-slate-400 ml-0.5">원</span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                            {!loading && !initialLoading && sortedHistoryData.length > 0 && (
                                <tfoot className="bg-slate-50 font-bold border-t border-slate-200 sticky bottom-0 z-40">
                                    <tr>
                                        <td colSpan={5} className="px-4 py-3 text-center text-slate-600 border-r border-slate-200">전체 합계</td>
                                        <td className="px-3 py-3 text-right text-slate-500 font-mono text-xs border-r border-slate-200">
                                            {formatManDay(sortedHistoryData.reduce((sum, item) => sum + item.laborManDay, 0))}
                                        </td>
                                        <td className="px-3 py-3 text-right text-slate-500 font-mono text-xs border-r border-slate-200">
                                            {formatManDay(sortedHistoryData.reduce((sum, item) => sum + item.invoiceManDay, 0))}
                                        </td>
                                        <td className="px-3 py-3 text-right text-slate-900 font-mono border-r border-slate-200">
                                            {formatManDay(sortedHistoryData.reduce((sum, item) => sum + item.totalManDay, 0))}
                                        </td>
                                        <td className="px-4 py-3 border-r border-slate-200"></td>
                                        <td className="px-3 py-3 text-right text-slate-600 font-mono text-xs border-r border-slate-200">
                                            {sortedHistoryData.reduce((sum, item) => sum + item.laborAmount, 0).toLocaleString()}
                                        </td>
                                        <td className="px-3 py-3 text-right text-slate-600 font-mono text-xs border-r border-slate-200">
                                            {sortedHistoryData.reduce((sum, item) => sum + item.invoiceAmount, 0).toLocaleString()}
                                        </td>
                                        <td className="px-4 py-3 text-right text-blue-800 font-mono font-black text-base">
                                            {sortedHistoryData.reduce((sum, item) => sum + item.totalAmount, 0).toLocaleString()} <span className="text-[10px] font-normal">원</span>
                                        </td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TotalPersonnelHistoryPage;
