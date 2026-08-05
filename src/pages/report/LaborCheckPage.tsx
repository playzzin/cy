import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faChevronRight, faRotateRight, faSpinner } from '@fortawesome/free-solid-svg-icons';
import OutputManagementTabs from '../../components/common/OutputManagementTabs';
import { DailyReportWorkerRow, dailyReportService } from '../../services/dailyReportService';
import { dailyWorkerReportSiteService, DailyWorkerReportSite } from '../../services/dailyWorkerReportSiteService';
import { companyService, Company } from '../../services/companyService';
import { manpowerService, Worker } from '../../services/manpowerService';
import { siteService, Site } from '../../services/siteService';
import { teamService, Team } from '../../services/teamService';
import { resolvePayType, resolveWorkerPayType } from '../../utils/payType';

// Keep the check grid deliberately spreadsheet-like: color and site name are the primary signals.
type CellStatus = 'labor' | 'invoice' | 'unknown' | 'empty';
type SaveFeedback = 'editing' | 'saved' | 'deleted' | 'error';
type WorkerPayStatus = 'direct' | 'delegate' | 'unconfirmed';

const WORKER_COLUMN_WIDTH = 118;
const DATE_COLUMN_WIDTH = 64;

type CheckWorker = {
    workerKey: string;
    workerId: string;
    workerName: string;
    teamId: string;
    teamName: string;
    teamColor: string;
    payStatus: WorkerPayStatus;
    workType: string;
    retired: boolean;
};

type ReplacementPicker = {
    worker: CheckWorker;
    date: string;
};

const text = (value: unknown): string => String(value ?? '').trim();
const normalizeKey = (value: unknown): string => text(value).replace(/\s+/g, '').toLowerCase();
const compareKoreanText = (first: unknown, second: unknown): number => {
    const firstText = text(first);
    const secondText = text(second);
    if (!firstText && secondText) return 1;
    if (firstText && !secondText) return -1;
    return firstText.localeCompare(secondText, 'ko', { numeric: true, sensitivity: 'base' });
};

const isConstructionCompanyType = (value: unknown): boolean => (
    ['시공사', '건설사'].some((type) => normalizeKey(value) === normalizeKey(type))
);

const isConstructionTeamType = (value: unknown): boolean => {
    const type = normalizeKey(value);
    return ['시공팀', '시공사업', '시공사', '건설팀', '건설사업'].some((candidate) => type === normalizeKey(candidate))
        || type.includes(normalizeKey('시공'));
};

const hasHexColor = (value: unknown): boolean => /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(text(value));

const isLightColor = (value: unknown): boolean => {
    const raw = text(value).replace('#', '');
    const hex = raw.length === 3
        ? raw.split('').map((character) => `${character}${character}`).join('')
        : raw;
    if (!/^[0-9a-f]{6}$/i.test(hex)) return false;
    const red = Number.parseInt(hex.slice(0, 2), 16);
    const green = Number.parseInt(hex.slice(2, 4), 16);
    const blue = Number.parseInt(hex.slice(4, 6), 16);
    return red * 0.299 + green * 0.587 + blue * 0.114 > 165;
};

const formatYmd = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const formatMonth = (date: Date): string => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

const getMonthDates = (month: string): Date[] => {
    const [yearText, monthText] = month.split('-');
    const year = Number(yearText);
    const monthIndex = Number(monthText) - 1;
    const endDay = new Date(year, monthIndex + 1, 0).getDate();
    return Array.from({ length: endDay }, (_, index) => new Date(year, monthIndex, index + 1));
};

const getMonthRange = (month: string): { startDate: string; endDate: string } => {
    const dates = getMonthDates(month);
    return { startDate: formatYmd(dates[0]), endDate: formatYmd(dates[dates.length - 1]) };
};

const addMonths = (month: string, offset: number): string => {
    const [yearText, monthText] = month.split('-');
    return formatMonth(new Date(Number(yearText), Number(monthText) - 1 + offset, 1));
};

const getWorkerKey = (workerId?: string | null, workerName?: string | null, teamName?: string | null): string => {
    const id = text(workerId);
    if (id && !id.startsWith('unknown')) return id;
    return `${normalizeKey(workerName)}:${normalizeKey(teamName)}`;
};

const isRetired = (worker?: Worker): boolean => {
    const status = normalizeKey(worker?.status);
    return worker?.isActive === false || ['퇴사', 'inactive', 'resigned', 'retired'].includes(status);
};

const getPayStatus = (worker?: Worker): WorkerPayStatus => {
    if (!worker) return 'unconfirmed';
    const payType = normalizeKey(worker?.laborStatementPayType);
    if (payType === 'delegate' || payType.includes('위임')) return 'delegate';
    // 통합 DB의 직불여부는 위임이 명시된 경우만 위임으로 저장하고, 빈 값은 직불로 표시합니다.
    return 'direct';
};

const payStatusLabel: Record<WorkerPayStatus, string> = {
    direct: '직불',
    delegate: '위임',
    unconfirmed: '미확인',
};

const payStatusClass: Record<WorkerPayStatus, string> = {
    direct: 'bg-emerald-100 text-emerald-800',
    delegate: 'bg-violet-100 text-violet-800',
    unconfirmed: 'bg-slate-100 text-slate-500',
};

const getWorkTypeClass = (workType: string): string => {
    const normalized = normalizeKey(workType);
    if (normalized.includes('일급')) return 'bg-amber-100 text-amber-800';
    if (normalized.includes('월급')) return 'bg-sky-100 text-sky-800';
    if (normalized.includes('용역')) return 'bg-rose-100 text-rose-800';
    if (normalized.includes('지원')) return 'bg-cyan-100 text-cyan-800';
    return 'bg-slate-100 text-slate-600';
};

const isLaborPayment = (value: unknown): boolean => {
    const paymentType = normalizeKey(value);
    return paymentType.includes('노무') || paymentType.includes('노임') || paymentType.includes('labor');
};

const isInvoicePayment = (value: unknown): boolean => {
    const paymentType = normalizeKey(value);
    return paymentType.includes('계산서') || paymentType.includes('invoice');
};

const buildRecordKey = (workerKey: string, date: string): string => `${workerKey}::${date}`;

const weekdayLabels = ['일', '월', '화', '수', '목', '금', '토'];

const LaborCheckPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const initialMonth = /^\d{4}-\d{2}$/.test(searchParams.get('month') || '')
        ? String(searchParams.get('month'))
        : formatMonth(new Date());
    const [selectedMonth, setSelectedMonth] = useState(initialMonth);
    const [selectedTeamId, setSelectedTeamId] = useState(searchParams.get('teamId') || '');
    const [showRetired, setShowRetired] = useState(false);
    const [isTwoLineView, setIsTwoLineView] = useState(false);
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [sites, setSites] = useState<Site[]>([]);
    const [reportRows, setReportRows] = useState<DailyReportWorkerRow[]>([]);
    const [reportedSites, setReportedSites] = useState<DailyWorkerReportSite[]>([]);
    const [reportSiteDrafts, setReportSiteDrafts] = useState<Record<string, string>>({});
    const [replacementPicker, setReplacementPicker] = useState<ReplacementPicker | null>(null);
    const [replacementSearch, setReplacementSearch] = useState('');
    const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set());
    const [saveFeedbackByKey, setSaveFeedbackByKey] = useState<Record<string, SaveFeedback>>({});
    const savingKeyRef = useRef<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState('');

    const dates = useMemo(() => getMonthDates(selectedMonth), [selectedMonth]);
    const dateRows = useMemo(() => (
        isTwoLineView ? [dates.slice(0, 16), dates.slice(16)] : [dates]
    ), [dates, isTwoLineView]);
    const dateColumnCount = useMemo(
        () => Math.max(...dateRows.map((row) => row.length)),
        [dateRows]
    );
    const { startDate, endDate } = useMemo(() => getMonthRange(selectedMonth), [selectedMonth]);
    const constructionCompanyKeys = useMemo(() => new Set(
        companies
            .filter((company) => isConstructionCompanyType(company.type))
            .flatMap((company) => [text(company.id), text(company.legacyId), normalizeKey(company.name)])
            .filter(Boolean)
    ), [companies]);
    const constructionTeams = useMemo(() => teams
        .filter((team) => (
            isConstructionTeamType(team.type)
            || constructionCompanyKeys.has(text(team.companyId))
            || constructionCompanyKeys.has(normalizeKey(team.companyName))
        ))
        .sort((first, second) => (
            compareKoreanText(first.name, second.name)
            || compareKoreanText(first.id || first.legacyId, second.id || second.legacyId)
        )), [constructionCompanyKeys, teams]);
    const constructionTeamIds = useMemo(() => new Set(
        constructionTeams.flatMap((team) => [text(team.id), text(team.legacyId)]).filter(Boolean)
    ), [constructionTeams]);
    const constructionTeamNames = useMemo(() => new Set(
        constructionTeams.map((team) => normalizeKey(team.name)).filter(Boolean)
    ), [constructionTeams]);
    const teamColorByKey = useMemo(() => {
        const colors = new Map<string, string>();
        constructionTeams.forEach((team) => {
            const color = text(team.color);
            if (!hasHexColor(color)) return;
            [text(team.id), text(team.legacyId)].filter(Boolean).forEach((id) => colors.set(`id:${id}`, color));
            if (text(team.name)) colors.set(`name:${normalizeKey(team.name)}`, color);
        });
        return colors;
    }, [constructionTeams]);
    const selectedTeam = useMemo(() => constructionTeams.find((team) => (
        text(team.id) === selectedTeamId || text(team.legacyId) === selectedTeamId
    )), [constructionTeams, selectedTeamId]);
    const selectedTeamName = text(selectedTeam?.name);
    const selectedTeamIdSet = useMemo(() => new Set([
        selectedTeamId,
        text(selectedTeam?.id),
        text(selectedTeam?.legacyId),
    ].filter(Boolean)), [selectedTeam?.id, selectedTeam?.legacyId, selectedTeamId]);

    const loadData = useCallback(async () => {
        setIsLoading(true);
        setErrorMessage('');
        try {
            const [workersData, teamsData, companiesData, sitesData, reportData, reportedSiteData] = await Promise.all([
                manpowerService.getWorkers(),
                teamService.getTeams(),
                companyService.getCompanies(),
                siteService.getSites(),
                dailyReportService.getReportWorkerRowsByRange({ startDate, endDate }),
                dailyWorkerReportSiteService.getByDateRange(startDate, endDate),
            ]);
            setWorkers(workersData);
            setTeams(teamsData);
            setCompanies(companiesData);
            setSites(sitesData);
            setReportRows(reportData.filter((row) => !row.isEmptyReport));
            setReportedSites(reportedSiteData);
        } catch (error) {
            console.error('[LaborCheckPage] Failed to load data', error);
            setErrorMessage('인원체크 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
        } finally {
            setIsLoading(false);
        }
    }, [endDate, startDate]);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    useEffect(() => {
        setReportSiteDrafts({});
        setSaveFeedbackByKey({});
    }, [selectedMonth, selectedTeamId]);

    useEffect(() => {
        if (selectedTeamId && !constructionTeamIds.has(selectedTeamId)) {
            setSelectedTeamId('');
        }
    }, [constructionTeamIds, selectedTeamId]);

    const teamMatches = useCallback((teamId?: string | null, teamName?: string | null): boolean => {
        if (!selectedTeamId) {
            return constructionTeamIds.has(text(teamId)) || constructionTeamNames.has(normalizeKey(teamName));
        }
        if (selectedTeamIdSet.has(text(teamId))) return true;
        return Boolean(selectedTeamName && normalizeKey(teamName) === normalizeKey(selectedTeamName));
    }, [constructionTeamIds, constructionTeamNames, selectedTeamId, selectedTeamIdSet, selectedTeamName]);

    const getTeamColor = useCallback((teamId?: string | null, teamName?: string | null): string => (
        teamColorByKey.get(`id:${text(teamId)}`)
        || teamColorByKey.get(`name:${normalizeKey(teamName)}`)
        || (hasHexColor(selectedTeam?.color) ? text(selectedTeam?.color) : '')
    ), [selectedTeam?.color, teamColorByKey]);

    const checkWorkers = useMemo<CheckWorker[]>(() => {
        const byKey = new Map<string, CheckWorker>();

        workers.filter((worker) => teamMatches(worker.teamId, worker.teamName)).forEach((worker) => {
            const teamName = text(worker.teamName);
            const workerKey = getWorkerKey(worker.id, worker.name, teamName);
            byKey.set(workerKey, {
                workerKey,
                workerId: text(worker.id),
                workerName: text(worker.name) || '성명 미확인',
                teamId: text(worker.teamId),
                teamName,
                teamColor: getTeamColor(worker.teamId, teamName),
                payStatus: getPayStatus(worker),
                workType: resolveWorkerPayType(worker),
                retired: isRetired(worker),
            });
        });

        reportRows.filter((row) => teamMatches(row.workerTeamId, row.workerTeamName)).forEach((row) => {
            const teamName = text(row.workerTeamName);
            const workerKey = getWorkerKey(row.workerId, row.workerName, teamName);
            if (byKey.has(workerKey)) return;
            byKey.set(workerKey, {
                workerKey,
                workerId: text(row.workerId),
                workerName: text(row.workerName) || '성명 미확인',
                teamId: text(row.workerTeamId),
                teamName,
                teamColor: getTeamColor(row.workerTeamId, teamName),
                payStatus: 'unconfirmed',
                workType: resolvePayType(row.payType, row.salaryModel),
                retired: false,
            });
        });

        return Array.from(byKey.values()).sort((first, second) => {
            const teamOrder = compareKoreanText(first.teamName, second.teamName);
            if (teamOrder !== 0) return teamOrder;

            const workerOrder = compareKoreanText(first.workerName, second.workerName);
            if (workerOrder !== 0) return workerOrder;

            if (first.retired !== second.retired) return first.retired ? 1 : -1;
            return compareKoreanText(first.workerKey, second.workerKey);
        });
    }, [getTeamColor, reportRows, teamMatches, workers]);

    const workerKeysWithOutput = useMemo(() => new Set(
        reportRows
            .filter((row) => teamMatches(row.workerTeamId, row.workerTeamName))
            .map((row) => getWorkerKey(row.workerId, row.workerName, row.workerTeamName))
    ), [reportRows, teamMatches]);

    const visibleWorkers = useMemo(
        () => checkWorkers.filter((worker) => !worker.retired || (showRetired && workerKeysWithOutput.has(worker.workerKey))),
        [checkWorkers, showRetired, workerKeysWithOutput]
    );

    const rowsByWorkerDate = useMemo(() => {
        const grouped = new Map<string, DailyReportWorkerRow[]>();
        reportRows.filter((row) => teamMatches(row.workerTeamId, row.workerTeamName)).forEach((row) => {
            const workerKey = getWorkerKey(row.workerId, row.workerName, row.workerTeamName);
            const key = buildRecordKey(workerKey, row.date);
            grouped.set(key, [...(grouped.get(key) || []), row]);
        });
        return grouped;
    }, [reportRows, teamMatches]);

    const reportedSiteByWorkerDate = useMemo(() => new Map(
        reportedSites.map((record) => [buildRecordKey(record.workerKey, record.date), record])
    ), [reportedSites]);

    const laborSiteNames = useMemo(() => Array.from(new Set(
        reportRows
            .filter((row) => isLaborPayment(row.paymentType))
            .map((row) => text(row.siteName))
            .filter(Boolean)
    )).sort((first, second) => first.localeCompare(second, 'ko')), [reportRows]);

    const filteredLaborSiteNames = useMemo(() => {
        const query = normalizeKey(replacementSearch);
        return query
            ? laborSiteNames.filter((siteName) => normalizeKey(siteName).includes(query))
            : laborSiteNames;
    }, [laborSiteNames, replacementSearch]);

    const getCell = useCallback((worker: CheckWorker, date: string): { status: CellStatus; siteNames: string[]; hasInvoice: boolean } => {
        const rows = rowsByWorkerDate.get(buildRecordKey(worker.workerKey, date)) || [];
        const laborRows = rows.filter((row) => isLaborPayment(row.paymentType));
        const invoiceRows = rows.filter((row) => isInvoicePayment(row.paymentType));
        const getSiteNames = (sourceRows: DailyReportWorkerRow[]) => Array.from(new Set(
            sourceRows.map((row) => text(row.siteName)).filter(Boolean)
        ));
        const hasInvoice = invoiceRows.length > 0;
        if (laborRows.length > 0) {
            return { status: 'labor', siteNames: hasInvoice ? getSiteNames(invoiceRows) : [], hasInvoice };
        }
        if (hasInvoice) return { status: 'invoice', siteNames: getSiteNames(invoiceRows), hasInvoice };
        if (rows.length > 0) return { status: 'unknown', siteNames: getSiteNames(rows), hasInvoice };
        return { status: 'empty', siteNames: [], hasInvoice };
    }, [rowsByWorkerDate]);

    const saveReportedSite = useCallback(async (worker: CheckWorker, date: string, selectedSiteName?: string): Promise<boolean> => {
        const { status, hasInvoice } = getCell(worker, date);
        if (worker.retired || (!hasInvoice && status !== 'empty')) return false;

        const recordKey = buildRecordKey(worker.workerKey, date);
        if (savingKeyRef.current.has(recordKey)) return false;

        const savedRecord = reportedSiteByWorkerDate.get(recordKey);
        const hasDraft = Object.prototype.hasOwnProperty.call(reportSiteDrafts, recordKey);
        const reportedSiteName = text(selectedSiteName !== undefined
            ? selectedSiteName
            : hasDraft ? reportSiteDrafts[recordKey] : savedRecord?.reportedSiteName);

        savingKeyRef.current.add(recordKey);
        setSavingKeys((previous) => new Set(previous).add(recordKey));
        setErrorMessage('');

        try {
            if (!reportedSiteName) {
                if (savedRecord) {
                    await dailyWorkerReportSiteService.delete(worker.workerKey, date);
                    setReportedSites((previous) => previous.filter((record) => record.id !== savedRecord.id));
                    setSaveFeedbackByKey((previous) => ({ ...previous, [recordKey]: 'deleted' }));
                }
                setReportSiteDrafts((previous) => ({ ...previous, [recordKey]: '' }));
                return true;
            }

            const matchingSite = sites.find((site) => normalizeKey(site.name) === normalizeKey(reportedSiteName));
            const saved = await dailyWorkerReportSiteService.save({
                date,
                workerKey: worker.workerKey,
                workerId: worker.workerId,
                workerName: worker.workerName,
                workerTeamId: worker.teamId || undefined,
                workerTeamName: worker.teamName || undefined,
                reportedSiteId: text(matchingSite?.id) || undefined,
                reportedSiteName,
            });
            setReportedSites((previous) => [...previous.filter((record) => record.id !== saved.id), saved]);
            setReportSiteDrafts((previous) => ({ ...previous, [recordKey]: saved.reportedSiteName }));
            setSaveFeedbackByKey((previous) => ({ ...previous, [recordKey]: 'saved' }));
            return true;
        } catch (error) {
            console.error('[LaborCheckPage] Failed to save replacement site', error);
            setErrorMessage('대체 현장명을 저장하지 못했습니다. 입력 내용을 확인한 뒤 다시 시도해 주세요.');
            setSaveFeedbackByKey((previous) => ({ ...previous, [recordKey]: 'error' }));
            return false;
        } finally {
            savingKeyRef.current.delete(recordKey);
            setSavingKeys((previous) => {
                const next = new Set(previous);
                next.delete(recordKey);
                return next;
            });
        }
    }, [getCell, reportedSiteByWorkerDate, reportSiteDrafts, sites]);

    const openReplacementPicker = useCallback((worker: CheckWorker, date: string) => {
        setReplacementSearch('');
        setReplacementPicker({ worker, date });
    }, []);

    const selectReplacementSite = useCallback(async (siteName: string) => {
        if (!replacementPicker) return;
        const saved = await saveReportedSite(replacementPicker.worker, replacementPicker.date, siteName);
        if (saved) setReplacementPicker(null);
    }, [replacementPicker, saveReportedSite]);

    const renderCell = (worker: CheckWorker, date: Date) => {
        const ymd = formatYmd(date);
        const { status, siteNames: cellSiteNames, hasInvoice } = getCell(worker, ymd);
        const recordKey = buildRecordKey(worker.workerKey, ymd);
        const savedRecord = reportedSiteByWorkerDate.get(recordKey);
        const replacementSiteName = Object.prototype.hasOwnProperty.call(reportSiteDrafts, recordKey)
            ? reportSiteDrafts[recordKey]
            : savedRecord?.reportedSiteName || '';
        const canEditReplacement = !worker.retired && (hasInvoice || status === 'empty');
        const isSaving = savingKeys.has(recordKey);

        const cellClass = hasInvoice
            ? 'bg-sky-200'
            : status === 'empty'
                ? 'bg-yellow-200'
                : 'bg-white';

        return (
            <td key={ymd} className={`h-[58px] border border-slate-900/80 p-0 align-middle ${cellClass}`}>
                <div className="flex h-full min-h-[57px] flex-col justify-center px-1">
                    {cellSiteNames.length > 0 && !hasInvoice && (
                        <span className={`line-clamp-2 break-keep text-center text-[10px] font-bold leading-3 ${
                            status === 'unknown' ? 'text-amber-700' : 'text-red-600'
                        }`} title={cellSiteNames.join(', ')}>
                            {cellSiteNames.join(', ')}
                        </span>
                    )}
                    {canEditReplacement && (
                        <button
                            type="button"
                            disabled={isSaving}
                            aria-label={`${worker.workerName} ${ymd} 대체 현장명`}
                            onClick={() => openReplacementPicker(worker, ymd)}
                            className={`min-h-6 w-full rounded border px-1 py-0.5 text-center text-[10px] font-bold leading-3 outline-none transition focus:ring-2 focus:ring-slate-700 disabled:cursor-wait ${
                                replacementSiteName
                                    ? 'border-white/80 bg-white/70 text-slate-800 hover:bg-white'
                                    : 'border-dashed border-slate-500/60 bg-white/35 text-slate-600 hover:bg-white/70'
                            }`}
                            title={replacementSiteName || '대체 현장 선택'}
                        >
                            <span className="block whitespace-normal break-words">{isSaving ? '저장 중' : replacementSiteName}</span>
                        </button>
                    )}
                </div>
            </td>
        );
    };

    return (
        <div
            className="flex min-h-0 flex-col bg-slate-100 font-['Pretendard']"
            style={{ height: 'calc(100dvh - var(--header-height))' }}
        >
            <OutputManagementTabs activeTab="labor-check" title="인원체크" />
            <main className="flex min-h-0 flex-1 flex-col gap-3 p-3 md:p-4">
                <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setSelectedMonth((month) => addMonths(month, -1))}
                            className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                            aria-label="이전 달"
                        >
                            <FontAwesomeIcon icon={faChevronLeft} />
                        </button>
                        <label className="flex h-8 items-center rounded-md border border-slate-300 bg-white px-2 text-sm font-bold text-slate-800">
                            <span className="sr-only">조회 월</span>
                            <input
                                type="month"
                                value={selectedMonth}
                                onChange={(event) => setSelectedMonth(event.target.value)}
                                className="bg-transparent outline-none"
                            />
                        </label>
                        <button
                            type="button"
                            onClick={() => setSelectedMonth((month) => addMonths(month, 1))}
                            className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                            aria-label="다음 달"
                        >
                            <FontAwesomeIcon icon={faChevronRight} />
                        </button>
                        <button
                            type="button"
                            onClick={() => void loadData()}
                            disabled={isLoading}
                            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:cursor-wait"
                        >
                            <FontAwesomeIcon icon={isLoading ? faSpinner : faRotateRight} spin={isLoading} />
                            새로고침
                        </button>
                    </div>
                    <div role="group" aria-label="팀 선택" className="flex max-w-full flex-wrap items-center justify-end gap-1.5">
                        <button
                            type="button"
                            onClick={() => setSelectedTeamId('')}
                            aria-pressed={!selectedTeamId}
                            className={`h-7 rounded-md border px-2 text-[11px] font-bold ${
                                !selectedTeamId ? 'border-slate-800 bg-slate-800 text-white' : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                            }`}
                        >
                            전체 시공팀
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowRetired((previous) => !previous)}
                            aria-pressed={showRetired}
                            className={`h-7 rounded-md border px-2 text-[11px] font-bold ${
                                showRetired
                                    ? 'border-rose-500 bg-rose-500 text-white'
                                    : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                            }`}
                        >
                            {showRetired ? '퇴사자 숨기기' : '출역 퇴사자 보기'}
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsTwoLineView((previous) => !previous)}
                            aria-pressed={isTwoLineView}
                            className={`h-7 rounded-md border px-2 text-[11px] font-bold ${
                                isTwoLineView
                                    ? 'border-indigo-600 bg-indigo-600 text-white'
                                    : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                            }`}
                        >
                            두줄 보기
                        </button>
                        {constructionTeams.map((team) => {
                            const teamId = text(team.id) || text(team.legacyId);
                            if (!teamId) return null;
                            const isSelected = teamId === selectedTeamId;
                            const color = text(team.color);
                            const hasColor = /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(color);
                            return (
                                <button
                                    key={teamId}
                                    type="button"
                                    onClick={() => setSelectedTeamId(teamId)}
                                    aria-pressed={isSelected}
                            style={hasColor ? { borderColor: color, backgroundColor: color } : undefined}
                            className={`h-7 rounded-md border px-2 text-[11px] font-bold ${
                                        hasColor
                                            ? isLightColor(color) ? 'text-slate-900 hover:brightness-95' : 'text-white hover:brightness-110'
                                            : 'bg-white text-slate-600 hover:bg-slate-50'
                                    } ${
                                        isSelected ? 'ring-2 ring-slate-700 ring-offset-1' : ''
                                    }`}
                                >
                                    {team.name}
                                </button>
                            );
                        })}
                    </div>
                </section>

                {errorMessage && (
                    <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">
                        {errorMessage}
                    </div>
                )}

                <section className="min-h-0 flex-1 overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm">
                    {isLoading ? (
                        <div className="flex h-64 flex-col items-center justify-center gap-3 text-slate-500">
                            <FontAwesomeIcon icon={faSpinner} spin className="text-2xl text-emerald-600" />
                            <span className="text-sm font-bold">인원체크 현황을 불러오는 중입니다.</span>
                        </div>
                    ) : visibleWorkers.length === 0 ? (
                        <div className="flex h-64 items-center justify-center px-4 text-center text-sm font-bold text-slate-500">
                            표시할 작업자가 없습니다.
                        </div>
                    ) : (
                        <div
                            data-testid="labor-check-grid-scroll"
                            className="h-full min-h-0 overflow-auto overscroll-contain [scrollbar-gutter:stable]"
                        >
                            <table
                                className="relative border-collapse text-left"
                                aria-label="인원체크 표"
                                style={{ minWidth: WORKER_COLUMN_WIDTH + DATE_COLUMN_WIDTH * dateColumnCount }}
                            >
                                <colgroup>
                                    <col style={{ width: WORKER_COLUMN_WIDTH }} />
                                    {Array.from({ length: dateColumnCount }, (_, index) => (
                                        <col key={`date-column-${index}`} style={{ width: DATE_COLUMN_WIDTH }} />
                                    ))}
                                </colgroup>
                                <thead className="z-20">
                                    <tr>
                                        <th rowSpan={isTwoLineView ? 3 : 2} className="sticky left-0 top-0 z-50 border border-slate-900 bg-[#fffccd] px-3 text-center text-xs font-bold text-slate-900">
                                            성명
                                        </th>
                                        <th colSpan={dateColumnCount} className="sticky top-0 z-40 h-[34px] border border-slate-900 bg-[#fffccd] py-1 text-center shadow-[0_2px_4px_rgba(15,23,42,0.14)]">
                                            <span className="text-lg font-medium tracking-[0.18em] text-slate-900">인원체크</span>
                                            <span className="ml-4 text-xs font-semibold text-slate-700">{startDate} ~ {endDate}</span>
                                        </th>
                                    </tr>
                                    <tr>
                                        {dateRows[0].map((date) => {
                                            const weekday = date.getDay();
                                            return (
                                                <th
                                                    key={formatYmd(date)}
                                                    className={`sticky top-[34px] z-40 h-[36px] border border-slate-900 bg-[#fffccd] py-1 text-center text-[11px] font-medium shadow-[0_2px_4px_rgba(15,23,42,0.14)] ${
                                                        weekday === 0 ? 'text-red-600' : weekday === 6 ? 'text-sky-600' : 'text-slate-800'
                                                    }`}
                                                >
                                                    <span className="block">{String(date.getDate()).padStart(2, '0')}</span>
                                                    <span className="block text-[10px] font-normal">{weekdayLabels[weekday]}</span>
                                                </th>
                                            );
                                        })}
                                    </tr>
                                    {isTwoLineView && (
                                        <tr>
                                            {dateRows[1].map((date) => {
                                                const weekday = date.getDay();
                                                return (
                                                    <th
                                                        key={formatYmd(date)}
                                                        className={`sticky top-[70px] z-40 h-[36px] border border-slate-900 bg-[#fffccd] py-1 text-center text-[11px] font-medium shadow-[0_2px_4px_rgba(15,23,42,0.14)] ${
                                                            weekday === 0 ? 'text-red-600' : weekday === 6 ? 'text-sky-600' : 'text-slate-800'
                                                        }`}
                                                    >
                                                        <span className="block">{String(date.getDate()).padStart(2, '0')}</span>
                                                        <span className="block text-[10px] font-normal">{weekdayLabels[weekday]}</span>
                                                    </th>
                                                );
                                            })}
                                            {Array.from({ length: dateColumnCount - dateRows[1].length }, (_, index) => (
                                                <th key={`empty-header-${index}`} className="sticky top-[70px] z-40 h-[36px] border border-slate-900 bg-[#fffccd] shadow-[0_2px_4px_rgba(15,23,42,0.14)]" />
                                            ))}
                                        </tr>
                                    )}
                                </thead>
                                <tbody>
                                    {visibleWorkers.map((worker) => (
                                        <React.Fragment key={worker.workerKey}>
                                        <tr>
                                            <th
                                                scope="row"
                                                rowSpan={isTwoLineView ? 2 : 1}
                                                style={hasHexColor(worker.teamColor) ? { borderLeftWidth: 7, borderLeftColor: worker.teamColor } : undefined}
                                                className="sticky left-0 z-10 border border-slate-900 bg-white px-3 text-left"
                                            >
                                                <span className="flex items-center gap-1 text-sm font-semibold text-slate-900">
                                                    <span className="min-w-0 truncate">
                                                        {worker.workerName}{worker.retired ? ' (퇴사)' : ''}
                                                    </span>
                                                    <span className={`shrink-0 rounded px-1 py-0.5 text-[9px] font-black ${payStatusClass[worker.payStatus]}`}>
                                                        {payStatusLabel[worker.payStatus]}
                                                    </span>
                                                </span>
                                                <span className="mt-0.5 flex flex-wrap items-center gap-1 text-[10px] font-bold text-slate-500">
                                                    {worker.teamName && (
                                                        <>
                                                            <span
                                                                aria-hidden="true"
                                                                className="h-2 w-2 rounded-full"
                                                                style={hasHexColor(worker.teamColor) ? { backgroundColor: worker.teamColor } : undefined}
                                                            />
                                                            <span>{worker.teamName}</span>
                                                        </>
                                                    )}
                                                    {worker.workType && (
                                                        <span className={`rounded px-1 py-0.5 text-[9px] font-black ${getWorkTypeClass(worker.workType)}`}>
                                                            {worker.workType}
                                                        </span>
                                                    )}
                                                </span>
                                            </th>
                                            {dateRows[0].map((date) => renderCell(worker, date))}
                                        </tr>
                                        {isTwoLineView && (
                                            <tr>
                                                {dateRows[1].map((date) => renderCell(worker, date))}
                                                {Array.from({ length: dateColumnCount - dateRows[1].length }, (_, index) => (
                                                    <td key={`empty-cell-${worker.workerKey}-${index}`} className="h-[58px] border border-slate-900/80 bg-white" />
                                                ))}
                                            </tr>
                                        )}
                                        </React.Fragment>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            </main>
            {replacementPicker && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/35 p-3 sm:items-center" role="presentation">
                    <section role="dialog" aria-modal="true" aria-labelledby="replacement-site-picker-title" className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
                        <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
                            <div>
                                <h2 id="replacement-site-picker-title" className="text-sm font-black text-slate-900">대체 현장 선택</h2>
                                <p className="mt-0.5 text-[11px] font-medium text-slate-500">{replacementPicker.worker.workerName} · {replacementPicker.date}</p>
                            </div>
                            <button type="button" onClick={() => setReplacementPicker(null)} className="rounded-md px-2 py-1 text-xs font-bold text-slate-500 hover:bg-slate-100" aria-label="대체 현장 선택 닫기">닫기</button>
                        </header>
                        <div className="border-b border-slate-100 p-3">
                            <input
                                autoFocus
                                type="search"
                                value={replacementSearch}
                                onChange={(event) => setReplacementSearch(event.target.value)}
                                placeholder="노무 출역 현장 검색"
                                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm font-medium outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                            />
                        </div>
                        <div className="max-h-72 overflow-y-auto p-2">
                            {filteredLaborSiteNames.map((siteName) => (
                                <button
                                    key={siteName}
                                    type="button"
                                    onClick={() => void selectReplacementSite(siteName)}
                                    className="flex min-h-10 w-full items-center rounded-lg px-3 py-2 text-left text-sm font-bold leading-5 text-slate-700 hover:bg-sky-50 hover:text-sky-800"
                                >
                                    <span className="whitespace-normal break-words">{siteName}</span>
                                </button>
                            ))}
                            {filteredLaborSiteNames.length === 0 && <p className="px-3 py-8 text-center text-sm font-medium text-slate-400">이번 달 노무 출역 현장이 없습니다.</p>}
                        </div>
                        <footer className="border-t border-slate-100 p-3">
                            <button
                                type="button"
                                onClick={() => void selectReplacementSite('')}
                                className="h-9 w-full rounded-lg border border-slate-300 text-xs font-bold text-slate-600 hover:bg-slate-50"
                            >
                                선택 해제
                            </button>
                        </footer>
                    </section>
                </div>
            )}
        </div>
    );
};

export default LaborCheckPage;
