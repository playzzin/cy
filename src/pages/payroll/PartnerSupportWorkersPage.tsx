import React, { useEffect, useMemo, useState } from 'react';
import {
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
    Users,
    WalletCards,
} from 'lucide-react';

import { companyService, Company } from '../../services/companyService';
import { dailyReportService, DailyReportWorkerRow } from '../../services/dailyReportService';
import { manpowerService, Worker } from '../../services/manpowerService';
import { siteService, Site } from '../../services/siteService';
import { teamService, Team } from '../../services/teamService';
import {
    useWorkerAccessScope,
    workerAccessMatchesReportRow,
} from '../../hooks/useWorkerAccessScope';
import { resolveReportPayType } from '../../utils/payType';
import { toast } from '../../utils/swal';
import {
    DAY_LABELS_FIRST,
    DAY_LABELS_SECOND,
    MAX_DAY_COLUMNS,
} from '../../utils/excel/SupportPaymentExcelGenerator';

type SupportDirection = '외부지원간곳' | '외부지원온곳' | '내부지원간곳' | '내부지원온곳';
type DirectionFilter = 'focus' | 'all' | SupportDirection;
type DetailTab = 'workers' | 'statement';

interface SupportPersonRow {
    key: string;
    direction: SupportDirection;
    date: string;
    reportId: string;
    workerId: string;
    workerName: string;
    role: string;
    contact: string;
    idNumber: string;
    address: string;
    bankName: string;
    accountNumber: string;
    accountHolder: string;
    payType: string;
    manDay: number;
    unitPrice: number;
    amount: number;
    siteId: string;
    siteName: string;
    siteAddress: string;
    sourceTeamId: string;
    sourceTeamName: string;
    targetTeamId: string;
    targetTeamName: string;
    partnerKey: string;
    partnerName: string;
    partnerCompanyName: string;
    counterpartyName: string;
}

interface SiteGroup {
    key: string;
    siteId: string;
    siteName: string;
    siteAddress: string;
    directions: SupportDirection[];
    sourceTeamNames: string[];
    targetTeamNames: string[];
    dates: string[];
    workerCount: number;
    totalManDay: number;
    totalAmount: number;
    rows: SupportPersonRow[];
}

interface PartnerGroup {
    key: string;
    partnerName: string;
    partnerCompanyName: string;
    directions: SupportDirection[];
    siteCount: number;
    workerCount: number;
    totalManDay: number;
    totalAmount: number;
    rows: SupportPersonRow[];
    sites: SiteGroup[];
}

interface LaborStatementRow {
    key: string;
    workerName: string;
    idNumber: string;
    contact: string;
    address: string;
    teamName: string;
    bankName: string;
    accountHolder: string;
    accountNumber: string;
    days: number[];
    totalManDay: number;
    unitPrice: number;
    amount: number;
}

const FOCUS_DIRECTIONS: SupportDirection[] = ['외부지원간곳', '내부지원온곳'];
const SUPPORT_DIRECTION_ORDER: SupportDirection[] = ['외부지원간곳', '외부지원온곳', '내부지원간곳', '내부지원온곳'];
const EMPTY_TEXT = '-';
const DEFAULT_STATEMENT_LOGO_URL = '/icons/icon-192.png';

const DIRECTION_META: Record<SupportDirection, { label: string; badgeClass: string; panelClass: string }> = {
    외부지원간곳: {
        label: '외부지원간곳',
        badgeClass: 'border-yellow-300 bg-yellow-100 text-yellow-900',
        panelClass: 'bg-yellow-50 text-yellow-950 border-yellow-200',
    },
    외부지원온곳: {
        label: '외부지원온곳',
        badgeClass: 'border-orange-300 bg-orange-100 text-orange-900',
        panelClass: 'bg-orange-50 text-orange-950 border-orange-200',
    },
    내부지원간곳: {
        label: '내부지원간곳',
        badgeClass: 'border-sky-300 bg-sky-100 text-sky-900',
        panelClass: 'bg-sky-50 text-sky-950 border-sky-200',
    },
    내부지원온곳: {
        label: '내부지원온곳',
        badgeClass: 'border-lime-300 bg-lime-100 text-lime-900',
        panelClass: 'bg-lime-50 text-lime-950 border-lime-200',
    },
};

const DIRECTION_FILTERS: Array<{ value: DirectionFilter; label: string }> = [
    { value: 'focus', label: '외부지원간 + 내부지원온' },
    { value: 'all', label: '전체 지원구분' },
    ...SUPPORT_DIRECTION_ORDER.map((direction) => ({ value: direction, label: direction })),
];

const getCurrentMonth = (): string => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const getMonthRange = (yearMonth: string): { startDate: string; endDate: string } => {
    const [yearText, monthText] = yearMonth.split('-');
    const year = Number(yearText);
    const month = Number(monthText);
    if (!year || !month) return getMonthRange(getCurrentMonth());

    const lastDay = new Date(year, month, 0).getDate();
    return {
        startDate: `${yearText}-${monthText}-01`,
        endDate: `${yearText}-${monthText}-${String(lastDay).padStart(2, '0')}`,
    };
};

const getMonthLastDay = (yearMonth: string): number => {
    const [yearText, monthText] = yearMonth.split('-');
    const year = Number(yearText);
    const month = Number(monthText);
    if (!year || !month) return 31;
    return new Date(year, month, 0).getDate();
};

const normalize = (value: unknown): string => String(value ?? '').replace(/\s+/g, '').trim();
const normalizeName = (value: unknown): string =>
    String(value ?? '').replace(/\(.*?\)/g, '').replace(/\s+/g, '').trim();
const normalizeSearchText = (value: unknown): string => normalizeName(value).toLowerCase();

const asNumber = (value: unknown): number => {
    const numeric = Number(value ?? 0);
    return Number.isFinite(numeric) ? numeric : 0;
};

const formatCurrency = (value: unknown): string =>
    `${Math.round(asNumber(value)).toLocaleString('ko-KR')}원`;

const formatPlainNumber = (value: unknown): string =>
    Math.round(asNumber(value)).toLocaleString('ko-KR');

const formatManDay = (value: unknown): string => {
    const numeric = asNumber(value);
    const fixed = Number(numeric.toFixed(1));
    return Number.isInteger(fixed) ? fixed.toFixed(0) : fixed.toFixed(1);
};

const formatStatementDayManDay = (value: number): string => {
    const rounded = Number((value || 0).toFixed(1));
    return rounded === 0 ? '' : formatManDay(value);
};

const formatFullIdNumber = (value?: string | null): string => {
    const raw = String(value ?? '').trim();
    if (!raw) return '';
    const digits = raw.replace(/[^0-9]/g, '');
    if (digits.length === 13) return `${digits.slice(0, 6)}-${digits.slice(6)}`;
    return raw;
};

const getWorkerAmount = (row: Pick<DailyReportWorkerRow, 'amount' | 'manDay' | 'unitPrice'>): number => {
    const calculated = asNumber(row.manDay) * asNumber(row.unitPrice);
    return calculated > 0 ? calculated : asNumber(row.amount);
};

const extractDayOfMonth = (dateValue?: string | null): number | null => {
    const match = String(dateValue ?? '').match(/^\d{4}-\d{2}-(\d{2})/);
    if (!match) return null;
    const day = Number(match[1]);
    return Number.isFinite(day) ? day : null;
};

const uniqueValues = (values: Array<string | undefined | null>): string[] => {
    const seen = new Set<string>();
    values.forEach((value) => {
        const text = String(value ?? '').trim();
        if (text) seen.add(text);
    });
    return Array.from(seen);
};

const uniqueCount = (rows: SupportPersonRow[], pick: (row: SupportPersonRow) => string): number =>
    new Set(rows.map(pick).filter(Boolean)).size;

const buildIdentityMap = <T extends { id?: string | null; legacyId?: string | null; name?: string | null }>(items: T[]) => {
    const map = new Map<string, T>();
    items.forEach((item) => {
        [item.id, item.legacyId, item.name]
            .map((value) => String(value ?? '').trim())
            .filter(Boolean)
            .forEach((key) => {
                map.set(key, item);
                map.set(normalizeName(key), item);
            });
    });
    return map;
};

const findByIdentity = <T extends { id?: string | null; legacyId?: string | null; name?: string | null }>(
    map: Map<string, T>,
    id?: unknown,
    name?: unknown
): T | undefined => {
    const idKey = String(id ?? '').trim();
    if (idKey && map.has(idKey)) return map.get(idKey);
    const nameKey = normalizeName(name);
    return nameKey ? map.get(nameKey) : undefined;
};

const isCheongyeonCompanyName = (value?: unknown): boolean => {
    const normalized = normalizeSearchText(value);
    return normalized.includes('청연이엔지') || normalized.includes('청연eng') || normalized.includes('청연');
};

const isSameTeamIdentity = (
    leftId?: unknown,
    leftName?: unknown,
    rightId?: unknown,
    rightName?: unknown
): boolean => {
    const leftKeys = [normalize(leftId), normalizeName(leftName)].filter(Boolean);
    const rightKeys = [normalize(rightId), normalizeName(rightName)].filter(Boolean);
    return leftKeys.length > 0 && rightKeys.length > 0 && leftKeys.some((key) => rightKeys.includes(key));
};

const getPartnerKey = (direction: SupportDirection, params: {
    sourceTeamId: string;
    sourceTeamName: string;
    sourceCompanyId: string;
    sourceCompanyName: string;
    targetTeamId: string;
    targetTeamName: string;
    targetCompanyId: string;
    targetCompanyName: string;
}): { key: string; name: string; companyName: string; counterpartyName: string } => {
    if (direction === '외부지원간곳') {
        const id = params.targetTeamId || params.targetCompanyId || normalizeName(params.targetTeamName || params.targetCompanyName);
        const name = params.targetTeamName || params.targetCompanyName || '외부 현장';
        return {
            key: `${direction}:${id || name}`,
            name,
            companyName: params.targetCompanyName || name,
            counterpartyName: params.targetCompanyName || name,
        };
    }

    if (direction === '외부지원온곳') {
        const id = params.sourceTeamId || params.sourceCompanyId || normalizeName(params.sourceTeamName || params.sourceCompanyName);
        const name = params.sourceTeamName || params.sourceCompanyName || '외부 지원팀';
        return {
            key: `${direction}:${id || name}`,
            name,
            companyName: params.sourceCompanyName || name,
            counterpartyName: name,
        };
    }

    if (direction === '내부지원간곳') {
        const id = params.sourceTeamId || normalizeName(params.sourceTeamName);
        return {
            key: `${direction}:${id || params.sourceTeamName || 'source'}`,
            name: params.sourceTeamName || '지원팀 미지정',
            companyName: params.sourceCompanyName || '청연이엔지',
            counterpartyName: params.targetTeamName || '수신팀 미지정',
        };
    }

    const id = params.targetTeamId || normalizeName(params.targetTeamName);
    return {
        key: `${direction}:${id || params.targetTeamName || 'target'}`,
        name: params.targetTeamName || '현장담당팀 미지정',
        companyName: params.targetCompanyName || '청연이엔지',
        counterpartyName: params.sourceTeamName || '지원팀 미지정',
    };
};

const directionMatchesFilter = (direction: SupportDirection, filter: DirectionFilter): boolean => {
    if (filter === 'all') return true;
    if (filter === 'focus') return FOCUS_DIRECTIONS.includes(direction);
    return direction === filter;
};

const sanitizeFileNamePart = (value: string): string =>
    (value || '미지정').replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim();

const downloadCsv = (filename: string, rows: Array<Record<string, string | number>>) => {
    if (rows.length === 0) {
        toast.warning('내보낼 데이터가 없습니다.');
        return;
    }

    const headers = Object.keys(rows[0]);
    const escape = (value: string | number) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const csv = [
        headers.map(escape).join(','),
        ...rows.map((row) => headers.map((header) => escape(row[header])).join(',')),
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

const DirectionBadge: React.FC<{ direction: SupportDirection }> = ({ direction }) => (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-black ${DIRECTION_META[direction].badgeClass}`}>
        {DIRECTION_META[direction].label}
    </span>
);

const SummaryCard: React.FC<{ label: string; value: React.ReactNode; icon: React.ReactNode; note?: string }> = ({
    label,
    value,
    icon,
    note,
}) => (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
            {icon}
        </div>
        <div className="text-xs font-bold text-slate-500">{label}</div>
        <div className="mt-1 text-2xl font-black text-slate-900">{value}</div>
        {note && <div className="mt-1 text-xs text-slate-500">{note}</div>}
    </div>
);

const StatementBrand: React.FC = () => {
    const [imageSrc, setImageSrc] = useState(DEFAULT_STATEMENT_LOGO_URL);

    return (
        <div className="flex items-center gap-2 text-slate-900">
            <img
                src={imageSrc}
                alt="ERP logo"
                className="h-9 w-9 rounded-md object-contain"
                onError={() => setImageSrc(DEFAULT_STATEMENT_LOGO_URL)}
            />
            <span className="text-sm font-black">(주) 청연이엔지</span>
        </div>
    );
};

const PartnerLaborStatementPreview: React.FC<{
    siteName: string;
    rows: LaborStatementRow[];
    yearMonth: string;
}> = ({ siteName, rows, yearMonth }) => {
    const month = parseInt(yearMonth.split('-')[1] ?? '0', 10);
    const dayTotals = Array.from({ length: MAX_DAY_COLUMNS }, () => 0);
    rows.forEach((row) => {
        row.days.forEach((value, index) => {
            dayTotals[index] += value;
        });
    });

    const totalManDay = rows.reduce((sum, row) => sum + row.totalManDay, 0);
    const totalAmount = rows.reduce((sum, row) => sum + row.amount, 0);
    const avgUnitPrice = totalManDay > 0 ? Math.round(totalAmount / totalManDay) : 0;

    return (
        <div className="inline-block min-w-full border border-slate-200 bg-white p-10 shadow-2xl">
            <h2 className="mb-8 text-center text-3xl font-black tracking-widest text-slate-800 underline decoration-4 underline-offset-8 decoration-amber-500">
                노 무 비 지 급 명 세 서 ({month}월분)
            </h2>
            <div className="mb-4 flex items-end justify-between gap-4 px-2">
                <div className="space-y-1">
                    <p className="text-sm font-bold text-slate-600">
                        현장명: <span className="border-b-2 border-slate-300 px-2 text-slate-900">{siteName}</span>
                    </p>
                </div>
                <StatementBrand />
            </div>
            <table className="w-full border-collapse border-2 border-slate-800 text-[10px]">
                <thead>
                    <tr className="bg-slate-100 font-black text-slate-800">
                        <th className="w-10 border-2 border-slate-800 p-1.5" rowSpan={2}>NO</th>
                        <th className="min-w-[80px] border-2 border-slate-800 p-1.5" rowSpan={2}>성명</th>
                        <th className="min-w-[110px] border-2 border-slate-800 p-1.5">주민번호</th>
                        <th className="min-w-[150px] border-2 border-slate-800 p-1.5" rowSpan={2}>주 소</th>
                        {DAY_LABELS_FIRST.map((day) => (
                            <th key={day} className="w-6 border-2 border-slate-800 bg-sky-50 text-sky-700">
                                {String(day).padStart(2, '0')}
                            </th>
                        ))}
                        <th className="w-6 border-2 border-slate-800 bg-slate-50">X</th>
                        <th className="w-16 border-2 border-slate-800 p-1.5" rowSpan={2}>출역</th>
                        <th className="w-24 border-2 border-slate-800 p-1.5">청구단가</th>
                    </tr>
                    <tr className="bg-slate-100 font-black text-slate-800">
                        <th className="border-2 border-slate-800 p-1.5">전화번호</th>
                        {DAY_LABELS_SECOND.map((day) => (
                            <th key={day} className="w-6 border-2 border-slate-800 bg-rose-50 text-rose-700">{day}</th>
                        ))}
                        <th className="border-2 border-slate-800 p-1.5">공급가액</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, index) => (
                        <React.Fragment key={row.key}>
                            <tr className="font-bold">
                                <td rowSpan={2} className="border-2 border-slate-800 bg-slate-50 text-center">{index + 1}</td>
                                <td rowSpan={2} className="border-2 border-slate-800 text-center text-xs">
                                    <div>{row.workerName}</div>
                                    {row.teamName && <div className="mt-1 text-[9px] font-semibold text-slate-500">{row.teamName}</div>}
                                </td>
                                <td className="border-2 border-slate-800 text-center font-mono">{formatFullIdNumber(row.idNumber)}</td>
                                <td rowSpan={2} className="border-2 border-slate-800 px-2 text-[9px] leading-tight">
                                    {row.address || EMPTY_TEXT}
                                </td>
                                {DAY_LABELS_FIRST.map((day) => (
                                    <td key={day} className="border-2 border-slate-800 bg-sky-50/30 text-center">
                                        {formatStatementDayManDay(row.days[day - 1])}
                                    </td>
                                ))}
                                <td className="border-2 border-slate-800 bg-slate-50"></td>
                                <td rowSpan={2} className="border-2 border-slate-800 bg-slate-50 text-center font-mono text-xs">
                                    {row.totalManDay.toFixed(1)}
                                </td>
                                <td className="border-2 border-slate-800 px-2 text-right font-mono text-amber-700">
                                    {formatPlainNumber(row.unitPrice)}
                                </td>
                            </tr>
                            <tr className="font-bold">
                                <td className="border-2 border-slate-800 text-center font-mono text-slate-500">{row.contact || EMPTY_TEXT}</td>
                                {DAY_LABELS_SECOND.map((day) => (
                                    <td key={day} className="border-2 border-slate-800 bg-rose-50/30 text-center">
                                        {formatStatementDayManDay(row.days[day - 1])}
                                    </td>
                                ))}
                                <td className="border-2 border-slate-800 bg-amber-50 px-2 text-right font-mono text-amber-700">
                                    {formatPlainNumber(row.amount)}
                                </td>
                            </tr>
                        </React.Fragment>
                    ))}
                    <tr className="bg-slate-200 text-xs font-black">
                        <td colSpan={4} className="border-2 border-slate-800 py-2 text-center">합 계</td>
                        {DAY_LABELS_FIRST.map((day) => (
                            <td key={day} className="border-2 border-slate-800 text-center">
                                {formatStatementDayManDay(dayTotals[day - 1])}
                            </td>
                        ))}
                        <td className="border-2 border-slate-800"></td>
                        <td rowSpan={2} className="border-2 border-slate-800 text-center font-mono">
                            {totalManDay.toFixed(1)}
                        </td>
                        <td className="border-2 border-slate-800 px-2 text-right font-mono text-amber-700">
                            {formatPlainNumber(avgUnitPrice)}
                        </td>
                    </tr>
                    <tr className="bg-slate-200 text-xs font-black">
                        <td colSpan={4} className="border-2 border-slate-800 py-2 text-center">공급가액</td>
                        {DAY_LABELS_SECOND.map((day) => (
                            <td key={day} className="border-2 border-slate-800 text-center">
                                {formatStatementDayManDay(dayTotals[day - 1])}
                            </td>
                        ))}
                        <td className="border-2 border-slate-800 bg-amber-100 px-2 text-right font-mono text-amber-800">
                            {formatPlainNumber(totalAmount)}
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
};

const PartnerSupportWorkersPage: React.FC = () => {
    const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
    const [directionFilter, setDirectionFilter] = useState<DirectionFilter>('focus');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedPartnerKey, setSelectedPartnerKey] = useState('');
    const [selectedSiteKey, setSelectedSiteKey] = useState('all');
    const [detailTab, setDetailTab] = useState<DetailTab>('workers');
    const [companies, setCompanies] = useState<Company[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [sites, setSites] = useState<Site[]>([]);
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [outputRows, setOutputRows] = useState<DailyReportWorkerRow[]>([]);
    const [loadingMaster, setLoadingMaster] = useState(true);
    const [loadingRows, setLoadingRows] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    const { startDate, endDate } = useMemo(() => getMonthRange(selectedMonth), [selectedMonth]);
    const monthLastDay = useMemo(() => getMonthLastDay(selectedMonth), [selectedMonth]);
    const accessScope = useWorkerAccessScope(workers, teams);

    const loadMaster = async () => {
        setLoadingMaster(true);
        setErrorMessage('');
        try {
            const [nextCompanies, nextTeams, nextSites, nextWorkers] = await Promise.all([
                companyService.getCompanies(),
                teamService.getTeams(),
                siteService.getSites(),
                manpowerService.getWorkers(true),
            ]);
            setCompanies(nextCompanies);
            setTeams(nextTeams);
            setSites(nextSites);
            setWorkers(nextWorkers);
        } catch (error) {
            console.error(error);
            setErrorMessage('협력사/팀/현장/작업자 정보를 불러오지 못했습니다.');
            toast.error('협력사/팀/현장/작업자 정보를 불러오지 못했습니다.');
        } finally {
            setLoadingMaster(false);
        }
    };

    const loadRows = async () => {
        setLoadingRows(true);
        setErrorMessage('');
        try {
            const rows = await dailyReportService.getWorkerRows({ startDate, endDate });
            setOutputRows(rows);
        } catch (error) {
            console.error(error);
            setOutputRows([]);
            setErrorMessage('출력일보 데이터를 불러오지 못했습니다.');
            toast.error('출력일보 데이터를 불러오지 못했습니다.');
        } finally {
            setLoadingRows(false);
        }
    };

    useEffect(() => {
        void loadMaster();
    }, []);

    useEffect(() => {
        void loadRows();
    }, [startDate, endDate]);

    const companyByKey = useMemo(() => buildIdentityMap(companies), [companies]);
    const teamByKey = useMemo(() => buildIdentityMap(teams), [teams]);
    const siteByKey = useMemo(() => buildIdentityMap(sites), [sites]);
    const workerByKey = useMemo(() => buildIdentityMap(workers), [workers]);

    const supportRows = useMemo<SupportPersonRow[]>(() => {
        if (accessScope.loading) return [];

        const isCheongyeonCompany = (companyId?: unknown, companyName?: unknown): boolean => {
            const company = findByIdentity(companyByKey, companyId, companyName);
            if (company?.isMyCompany) return true;
            if (company?.name && isCheongyeonCompanyName(company.name)) return true;
            return isCheongyeonCompanyName(companyName);
        };

        const isCheongyeonTeam = (team?: Team, teamId?: unknown, teamName?: unknown, companyId?: unknown, companyName?: unknown): boolean => {
            const resolved = team ?? findByIdentity(teamByKey, teamId, teamName);
            if (resolved) {
                return isCheongyeonCompany(resolved.companyId, resolved.companyName);
            }
            return isCheongyeonCompany(companyId, companyName);
        };

        return outputRows
            .filter((row) => !row.isEmptyReport && asNumber(row.manDay) > 0)
            .filter((row) => workerAccessMatchesReportRow(accessScope, row))
            .flatMap((row) => {
                const worker = findByIdentity(workerByKey, row.workerId, row.workerName);
                const site = findByIdentity(siteByKey, row.siteId, row.siteName);
                const sourceTeam = findByIdentity(
                    teamByKey,
                    row.workerTeamId || row.teamId,
                    row.workerTeamName || row.teamName
                );
                const targetTeam = findByIdentity(
                    teamByKey,
                    row.responsibleTeamId || row.teamId,
                    row.responsibleTeamName || row.teamName
                );

                const sourceTeamId = String(sourceTeam?.id || row.workerTeamId || row.teamId || '').trim();
                const sourceTeamName = String(sourceTeam?.name || row.workerTeamName || row.teamName || '작업팀 미지정').trim();
                const sourceCompanyId = String(sourceTeam?.companyId || worker?.companyId || '').trim();
                const sourceCompanyName = String(
                    sourceTeam?.companyName ||
                    worker?.companyName ||
                    (sourceCompanyId ? findByIdentity(companyByKey, sourceCompanyId)?.name : '') ||
                    ''
                ).trim();

                const targetTeamId = String(targetTeam?.id || row.responsibleTeamId || row.teamId || '').trim();
                const targetTeamName = String(targetTeam?.name || row.responsibleTeamName || row.teamName || '현장담당팀 미지정').trim();
                const targetCompanyId = String(
                    targetTeam?.companyId ||
                    site?.constructorCompanyId ||
                    site?.companyId ||
                    row.constructorCompanyId ||
                    row.companyId ||
                    ''
                ).trim();
                const targetCompanyName = String(
                    targetTeam?.companyName ||
                    site?.constructorCompanyName ||
                    site?.companyName ||
                    row.constructorCompanyName ||
                    row.companyName ||
                    (targetCompanyId ? findByIdentity(companyByKey, targetCompanyId)?.name : '') ||
                    ''
                ).trim();

                const siteConstructorCompanyId = String(site?.constructorCompanyId || site?.companyId || row.constructorCompanyId || row.companyId || '').trim();
                const siteConstructorCompanyName = String(site?.constructorCompanyName || site?.companyName || row.constructorCompanyName || row.companyName || '').trim();
                const siteIsCheongyeon = isCheongyeonCompany(siteConstructorCompanyId, siteConstructorCompanyName);
                const workerIsCheongyeon = isCheongyeonTeam(sourceTeam, sourceTeamId, sourceTeamName, sourceCompanyId, sourceCompanyName);
                const targetIsCheongyeon = isCheongyeonTeam(targetTeam, targetTeamId, targetTeamName, targetCompanyId, targetCompanyName);
                const isSameFieldAndWorkerTeam = isSameTeamIdentity(sourceTeamId, sourceTeamName, targetTeamId, targetTeamName);
                const isSupportTeam = normalizeName(sourceTeam?.type).includes('지원');
                const payTypeLabel = resolveReportPayType(row, worker) || row.payType || row.salaryModel || '';
                const isSupportPayType = normalizeName(payTypeLabel).includes('지원');

                const directions: SupportDirection[] = [];
                if (workerIsCheongyeon && targetIsCheongyeon && isSameFieldAndWorkerTeam) {
                    return [];
                }
                if (workerIsCheongyeon && targetIsCheongyeon && sourceTeamId && targetTeamId) {
                    directions.push('내부지원간곳', '내부지원온곳');
                } else if (!siteIsCheongyeon && workerIsCheongyeon) {
                    directions.push('외부지원간곳');
                } else if (siteIsCheongyeon && targetIsCheongyeon && !workerIsCheongyeon) {
                    directions.push('외부지원온곳');
                } else if (siteIsCheongyeon && targetIsCheongyeon && (isSupportPayType || isSupportTeam)) {
                    directions.push('외부지원온곳');
                }

                const rowAmount = getWorkerAmount(row);
                return directions.map((direction, index) => {
                    const partner = getPartnerKey(direction, {
                        sourceTeamId,
                        sourceTeamName,
                        sourceCompanyId,
                        sourceCompanyName,
                        targetTeamId,
                        targetTeamName,
                        targetCompanyId,
                        targetCompanyName,
                    });

                    return {
                        key: `${row.reportId}:${row.workerIndex ?? row.workerId}:${direction}:${index}`,
                        direction,
                        date: row.date,
                        reportId: row.reportId,
                        workerId: String(row.workerId || worker?.id || '').trim(),
                        workerName: String(row.workerName || worker?.name || '이름 미상').trim(),
                        role: String(row.role || worker?.role || '').trim(),
                        contact: String(worker?.contact || '').trim(),
                        idNumber: String(worker?.idNumber || '').trim(),
                        address: String(worker?.address || '').trim(),
                        bankName: String(worker?.bankName || '').trim(),
                        accountNumber: String(worker?.accountNumber || '').trim(),
                        accountHolder: String(worker?.accountHolder || worker?.name || row.workerName || '').trim(),
                        payType: payTypeLabel,
                        manDay: asNumber(row.manDay),
                        unitPrice: asNumber(row.unitPrice),
                        amount: rowAmount,
                        siteId: String(row.siteId || site?.id || '').trim(),
                        siteName: String(row.siteName || site?.name || '현장 미지정').trim(),
                        siteAddress: String(site?.address || '').trim(),
                        sourceTeamId,
                        sourceTeamName,
                        targetTeamId,
                        targetTeamName,
                        partnerKey: partner.key,
                        partnerName: partner.name,
                        partnerCompanyName: partner.companyName,
                        counterpartyName: partner.counterpartyName,
                    };
                });
            })
            .sort((a, b) =>
                SUPPORT_DIRECTION_ORDER.indexOf(a.direction) - SUPPORT_DIRECTION_ORDER.indexOf(b.direction) ||
                a.partnerName.localeCompare(b.partnerName, 'ko-KR') ||
                a.siteName.localeCompare(b.siteName, 'ko-KR') ||
                a.date.localeCompare(b.date)
            );
    }, [accessScope, companyByKey, outputRows, siteByKey, teamByKey, workerByKey]);

    const filteredRows = useMemo(() => {
        const query = normalizeSearchText(searchQuery);
        return supportRows.filter((row) => {
            if (!directionMatchesFilter(row.direction, directionFilter)) return false;
            if (!query) return true;
            return normalizeSearchText([
                row.partnerName,
                row.partnerCompanyName,
                row.siteName,
                row.workerName,
                row.contact,
                row.sourceTeamName,
                row.targetTeamName,
                row.direction,
            ].join(' ')).includes(query);
        });
    }, [directionFilter, searchQuery, supportRows]);

    const partnerGroups = useMemo<PartnerGroup[]>(() => {
        const groupMap = new Map<string, SupportPersonRow[]>();
        filteredRows.forEach((row) => {
            const current = groupMap.get(row.partnerKey) ?? [];
            current.push(row);
            groupMap.set(row.partnerKey, current);
        });

        return Array.from(groupMap.entries())
            .map(([key, rows]) => {
                const siteMap = new Map<string, SupportPersonRow[]>();
                rows.forEach((row) => {
                    const siteKey = row.siteId || normalizeName(row.siteName) || 'unknown-site';
                    const current = siteMap.get(siteKey) ?? [];
                    current.push(row);
                    siteMap.set(siteKey, current);
                });

                const sitesList = Array.from(siteMap.entries())
                    .map(([siteKey, siteRows]) => ({
                        key: siteKey,
                        siteId: siteRows[0]?.siteId || '',
                        siteName: siteRows[0]?.siteName || '현장 미지정',
                        siteAddress: siteRows[0]?.siteAddress || '',
                        directions: uniqueValues(siteRows.map((row) => row.direction)) as SupportDirection[],
                        sourceTeamNames: uniqueValues(siteRows.map((row) => row.sourceTeamName)),
                        targetTeamNames: uniqueValues(siteRows.map((row) => row.targetTeamName)),
                        dates: uniqueValues(siteRows.map((row) => row.date)).sort(),
                        workerCount: uniqueCount(siteRows, (row) => row.workerId || row.workerName),
                        totalManDay: siteRows.reduce((sum, row) => sum + row.manDay, 0),
                        totalAmount: siteRows.reduce((sum, row) => sum + row.amount, 0),
                        rows: siteRows.sort((a, b) => a.date.localeCompare(b.date) || a.workerName.localeCompare(b.workerName, 'ko-KR')),
                    }))
                    .sort((a, b) => b.totalManDay - a.totalManDay || a.siteName.localeCompare(b.siteName, 'ko-KR'));

                return {
                    key,
                    partnerName: rows[0]?.partnerName || '협력사 미지정',
                    partnerCompanyName: rows[0]?.partnerCompanyName || '',
                    directions: uniqueValues(rows.map((row) => row.direction)) as SupportDirection[],
                    siteCount: sitesList.length,
                    workerCount: uniqueCount(rows, (row) => row.workerId || row.workerName),
                    totalManDay: rows.reduce((sum, row) => sum + row.manDay, 0),
                    totalAmount: rows.reduce((sum, row) => sum + row.amount, 0),
                    rows,
                    sites: sitesList,
                };
            })
            .sort((a, b) => b.totalManDay - a.totalManDay || a.partnerName.localeCompare(b.partnerName, 'ko-KR'));
    }, [filteredRows]);

    useEffect(() => {
        setSelectedPartnerKey((current) =>
            partnerGroups.some((group) => group.key === current)
                ? current
                : partnerGroups[0]?.key || ''
        );
    }, [partnerGroups]);

    const selectedPartner = useMemo(
        () => partnerGroups.find((group) => group.key === selectedPartnerKey) ?? null,
        [partnerGroups, selectedPartnerKey]
    );

    useEffect(() => {
        setSelectedSiteKey((current) => {
            if (!selectedPartner) return 'all';
            if (current === 'all' || selectedPartner.sites.some((site) => site.key === current)) return current;
            return 'all';
        });
    }, [selectedPartner]);

    const selectedSiteRows = useMemo(() => {
        if (!selectedPartner) return [];
        if (selectedSiteKey === 'all') return selectedPartner.rows;
        return selectedPartner.sites.find((site) => site.key === selectedSiteKey)?.rows ?? [];
    }, [selectedPartner, selectedSiteKey]);

    const selectedStatementLabel = useMemo(() => {
        if (!selectedPartner) return '노임명세서';
        if (selectedSiteKey === 'all') return `${selectedPartner.partnerName} 전체 현장`;
        return selectedPartner.sites.find((site) => site.key === selectedSiteKey)?.siteName ?? selectedPartner.partnerName;
    }, [selectedPartner, selectedSiteKey]);

    const statementRows = useMemo<LaborStatementRow[]>(() => {
        const rowMap = new Map<string, LaborStatementRow>();
        selectedSiteRows.forEach((row) => {
            const workerKey = row.workerId || normalizeName(row.workerName);
            if (!workerKey) return;
            if (!rowMap.has(workerKey)) {
                rowMap.set(workerKey, {
                    key: workerKey,
                    workerName: row.workerName,
                    idNumber: row.idNumber,
                    contact: row.contact,
                    address: row.address || row.siteAddress,
                    teamName: row.sourceTeamName,
                    bankName: row.bankName,
                    accountHolder: row.accountHolder,
                    accountNumber: row.accountNumber,
                    days: Array.from({ length: MAX_DAY_COLUMNS }, () => 0),
                    totalManDay: 0,
                    unitPrice: 0,
                    amount: 0,
                });
            }

            const statementRow = rowMap.get(workerKey)!;
            const day = extractDayOfMonth(row.date);
            if (day && day >= 1 && day <= MAX_DAY_COLUMNS) {
                statementRow.days[day - 1] += row.manDay;
            }
            statementRow.totalManDay += row.manDay;
            statementRow.amount += row.amount;
            statementRow.unitPrice = statementRow.totalManDay > 0
                ? Math.round(statementRow.amount / statementRow.totalManDay)
                : row.unitPrice;
        });

        return Array.from(rowMap.values()).sort((a, b) => a.workerName.localeCompare(b.workerName, 'ko-KR'));
    }, [selectedSiteRows]);

    const totalSummary = useMemo(() => ({
        partnerCount: partnerGroups.length,
        siteCount: uniqueCount(filteredRows, (row) => row.siteId || row.siteName),
        workerCount: uniqueCount(filteredRows, (row) => row.workerId || row.workerName),
        totalManDay: filteredRows.reduce((sum, row) => sum + row.manDay, 0),
        totalAmount: filteredRows.reduce((sum, row) => sum + row.amount, 0),
    }), [filteredRows, partnerGroups.length]);

    const handleRefresh = async () => {
        await Promise.all([loadMaster(), loadRows()]);
    };

    const handleDownloadWorkers = () => {
        const rows = (selectedPartner?.rows ?? filteredRows).map((row) => ({
            구분: row.direction,
            날짜: row.date,
            협력사: row.partnerName,
            현장: row.siteName,
            성명: row.workerName,
            연락처: row.contact,
            주민번호: row.idNumber,
            주소: row.address,
            작업팀: row.sourceTeamName,
            현장담당팀: row.targetTeamName,
            급여방식: row.payType,
            공수: formatManDay(row.manDay),
            단가: Math.round(row.unitPrice),
            금액: Math.round(row.amount),
            은행: row.bankName,
            예금주: row.accountHolder,
            계좌번호: row.accountNumber,
        }));
        const target = selectedPartner?.partnerName || '전체';
        downloadCsv(`협력사별_지원출력인원_${selectedMonth}_${sanitizeFileNamePart(target)}.csv`, rows);
    };

    const handleDownloadStatement = () => {
        const rows = statementRows.map((row) => {
            const dayColumns = Object.fromEntries(
                row.days.slice(0, monthLastDay).map((value, index) => [`${index + 1}일`, value > 0 ? formatManDay(value) : ''])
            );
            return {
                성명: row.workerName,
                소속팀: row.teamName,
                주민번호: row.idNumber,
                연락처: row.contact,
                주소: row.address,
                ...dayColumns,
                총공수: formatManDay(row.totalManDay),
                단가: Math.round(row.unitPrice),
                금액: Math.round(row.amount),
                은행: row.bankName,
                예금주: row.accountHolder,
                계좌번호: row.accountNumber,
            };
        });
        downloadCsv(`노임명세서_${selectedMonth}_${sanitizeFileNamePart(selectedStatementLabel)}.csv`, rows);
    };

    const loading = loadingMaster || loadingRows || accessScope.loading;

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900">
            <header className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <div className="flex items-center gap-2 text-sm font-bold text-slate-500">
                            <WalletCards size={16} />
                            급여관리
                        </div>
                        <h1 className="mt-1 text-2xl font-black text-slate-950">협력사별 지원 출력 인원</h1>
                        <p className="mt-1 text-sm text-slate-500">
                            협력사별 외부지원간 현장과 내부지원온 현장의 출력 인원 정보와 노임명세서를 월별로 확인합니다.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={handleDownloadWorkers}
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                        >
                            <Download size={16} />
                            인원 CSV
                        </button>
                        <button
                            type="button"
                            onClick={() => window.print()}
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                        >
                            <Printer size={16} />
                            인쇄
                        </button>
                        <button
                            type="button"
                            onClick={handleRefresh}
                            disabled={loading}
                            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-bold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                            새로고침
                        </button>
                    </div>
                </div>
            </header>

            <main className="space-y-5 p-4 sm:p-6">
                <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-[180px_220px_minmax(220px,1fr)]">
                    <label className="block">
                        <span className="mb-1 flex items-center gap-1.5 text-xs font-bold text-slate-500">
                            <CalendarDays size={14} />
                            조회월
                        </span>
                        <input
                            type="month"
                            value={selectedMonth}
                            onChange={(event) => setSelectedMonth(event.target.value || getCurrentMonth())}
                            className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm font-bold text-slate-800 outline-none focus:border-slate-900"
                        />
                    </label>
                    <label className="block">
                        <span className="mb-1 text-xs font-bold text-slate-500">지원구분</span>
                        <select
                            value={directionFilter}
                            onChange={(event) => setDirectionFilter(event.target.value as DirectionFilter)}
                            className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm font-bold text-slate-800 outline-none focus:border-slate-900"
                        >
                            {DIRECTION_FILTERS.map((filter) => (
                                <option key={filter.value} value={filter.value}>{filter.label}</option>
                            ))}
                        </select>
                    </label>
                    <label className="block">
                        <span className="mb-1 flex items-center gap-1.5 text-xs font-bold text-slate-500">
                            <Search size={14} />
                            검색
                        </span>
                        <input
                            type="search"
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            placeholder="협력사, 현장, 인원, 팀명 검색"
                            className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-800 outline-none focus:border-slate-900"
                        />
                    </label>
                </section>

                <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                    <SummaryCard label="협력사/팀" value={`${formatPlainNumber(totalSummary.partnerCount)}곳`} icon={<Building2 size={18} />} />
                    <SummaryCard label="현장" value={`${formatPlainNumber(totalSummary.siteCount)}곳`} icon={<MapPin size={18} />} />
                    <SummaryCard label="출력 인원" value={`${formatPlainNumber(totalSummary.workerCount)}명`} icon={<Users size={18} />} />
                    <SummaryCard label="총 공수" value={`${formatManDay(totalSummary.totalManDay)}공수`} icon={<ClipboardList size={18} />} />
                    <SummaryCard label="노임 합계" value={formatCurrency(totalSummary.totalAmount)} icon={<FileText size={18} />} />
                </section>

                {errorMessage && (
                    <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
                        {errorMessage}
                    </div>
                )}

                <section className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
                    <aside className="rounded-lg border border-slate-200 bg-white shadow-sm">
                        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                            <h2 className="text-sm font-black text-slate-900">협력사 목록</h2>
                            <span className="text-xs font-bold text-slate-500">{formatPlainNumber(partnerGroups.length)}건</span>
                        </div>
                        <div className="max-h-[680px] overflow-y-auto p-2">
                            {loading ? (
                                <div className="p-8 text-center text-sm font-bold text-slate-500">데이터를 불러오는 중입니다.</div>
                            ) : partnerGroups.length === 0 ? (
                                <div className="p-8 text-center text-sm font-bold text-slate-500">조건에 맞는 지원 출력 내역이 없습니다.</div>
                            ) : (
                                partnerGroups.map((group) => {
                                    const selected = group.key === selectedPartnerKey;
                                    return (
                                        <button
                                            key={group.key}
                                            type="button"
                                            onClick={() => setSelectedPartnerKey(group.key)}
                                            className={`mb-2 w-full rounded-lg border p-3 text-left transition-colors ${
                                                selected
                                                    ? 'border-slate-900 bg-slate-900 text-white'
                                                    : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50'
                                            }`}
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <div className="truncate text-sm font-black">{group.partnerName}</div>
                                                    <div className={`mt-0.5 truncate text-xs ${selected ? 'text-slate-300' : 'text-slate-500'}`}>
                                                        {group.partnerCompanyName || '회사 정보 미지정'}
                                                    </div>
                                                </div>
                                                <ChevronDown size={16} className={selected ? 'text-white' : 'text-slate-400'} />
                                            </div>
                                            <div className="mt-3 flex flex-wrap gap-1">
                                                {group.directions.map((direction) => (
                                                    <span
                                                        key={direction}
                                                        className={`rounded-full px-2 py-0.5 text-[11px] font-black ${
                                                            selected ? 'bg-white/15 text-white' : DIRECTION_META[direction].panelClass
                                                        }`}
                                                    >
                                                        {direction}
                                                    </span>
                                                ))}
                                            </div>
                                            <div className={`mt-3 grid grid-cols-3 gap-2 text-xs font-bold ${selected ? 'text-slate-200' : 'text-slate-600'}`}>
                                                <span>{group.siteCount}현장</span>
                                                <span>{group.workerCount}명</span>
                                                <span>{formatManDay(group.totalManDay)}공수</span>
                                            </div>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </aside>

                    <section className="min-w-0 rounded-lg border border-slate-200 bg-white shadow-sm">
                        {!selectedPartner ? (
                            <div className="p-10 text-center text-sm font-bold text-slate-500">협력사를 선택하면 상세 내역이 표시됩니다.</div>
                        ) : (
                            <>
                                <div className="border-b border-slate-200 p-4">
                                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                {selectedPartner.directions.map((direction) => (
                                                    <DirectionBadge key={direction} direction={direction} />
                                                ))}
                                            </div>
                                            <h2 className="mt-2 truncate text-xl font-black text-slate-950">{selectedPartner.partnerName}</h2>
                                            <p className="mt-1 text-sm text-slate-500">
                                                {selectedPartner.partnerCompanyName || '회사 정보 미지정'} · {selectedPartner.siteCount}개 현장 · {formatManDay(selectedPartner.totalManDay)}공수
                                            </p>
                                        </div>
                                        <div className="grid min-w-[260px] grid-cols-3 gap-2 text-center">
                                            <div className="rounded-lg bg-slate-100 px-3 py-2">
                                                <div className="text-[11px] font-bold text-slate-500">인원</div>
                                                <div className="text-sm font-black">{selectedPartner.workerCount}명</div>
                                            </div>
                                            <div className="rounded-lg bg-slate-100 px-3 py-2">
                                                <div className="text-[11px] font-bold text-slate-500">공수</div>
                                                <div className="text-sm font-black">{formatManDay(selectedPartner.totalManDay)}</div>
                                            </div>
                                            <div className="rounded-lg bg-slate-100 px-3 py-2">
                                                <div className="text-[11px] font-bold text-slate-500">노임</div>
                                                <div className="text-sm font-black">{formatCurrency(selectedPartner.totalAmount)}</div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                        <div className="flex rounded-lg border border-slate-300 bg-slate-50 p-1">
                                            <button
                                                type="button"
                                                onClick={() => setDetailTab('workers')}
                                                className={`rounded-md px-3 py-1.5 text-sm font-black ${detailTab === 'workers' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'}`}
                                            >
                                                출력 인원
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setDetailTab('statement')}
                                                className={`rounded-md px-3 py-1.5 text-sm font-black ${detailTab === 'statement' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'}`}
                                            >
                                                노임명세서
                                            </button>
                                        </div>
                                        <label className="flex min-w-[260px] items-center gap-2">
                                            <span className="shrink-0 text-xs font-bold text-slate-500">현장</span>
                                            <select
                                                value={selectedSiteKey}
                                                onChange={(event) => setSelectedSiteKey(event.target.value)}
                                                className="h-9 w-full rounded-lg border border-slate-300 px-3 text-sm font-bold text-slate-800 outline-none focus:border-slate-900"
                                            >
                                                <option value="all">전체 현장</option>
                                                {selectedPartner.sites.map((site) => (
                                                    <option key={site.key} value={site.key}>
                                                        {site.siteName} ({formatManDay(site.totalManDay)}공수)
                                                    </option>
                                                ))}
                                            </select>
                                        </label>
                                    </div>
                                </div>

                                <div className="border-b border-slate-200 p-4">
                                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                        {selectedPartner.sites.map((site) => (
                                            <button
                                                key={site.key}
                                                type="button"
                                                onClick={() => setSelectedSiteKey(site.key)}
                                                className={`rounded-lg border p-3 text-left ${
                                                    selectedSiteKey === site.key
                                                        ? 'border-slate-900 bg-slate-900 text-white'
                                                        : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                                                }`}
                                            >
                                                <div className="flex flex-wrap gap-1">
                                                    {site.directions.map((direction) => (
                                                        <span
                                                            key={direction}
                                                            className={`rounded-full px-2 py-0.5 text-[11px] font-black ${
                                                                selectedSiteKey === site.key ? 'bg-white/15 text-white' : DIRECTION_META[direction].panelClass
                                                            }`}
                                                        >
                                                            {direction}
                                                        </span>
                                                    ))}
                                                </div>
                                                <div className="mt-2 truncate text-sm font-black">{site.siteName}</div>
                                                <div className={`mt-1 truncate text-xs ${selectedSiteKey === site.key ? 'text-slate-300' : 'text-slate-500'}`}>
                                                    작업팀 {site.sourceTeamNames.join(', ') || EMPTY_TEXT}
                                                </div>
                                                <div className={`mt-2 flex gap-3 text-xs font-bold ${selectedSiteKey === site.key ? 'text-slate-200' : 'text-slate-600'}`}>
                                                    <span>{site.workerCount}명</span>
                                                    <span>{formatManDay(site.totalManDay)}공수</span>
                                                    <span>{formatCurrency(site.totalAmount)}</span>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {detailTab === 'workers' ? (
                                    <div className="overflow-x-auto p-4">
                                        <table className="min-w-[1180px] w-full border-collapse text-sm">
                                            <thead>
                                                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-black text-slate-500">
                                                    <th className="px-3 py-3">날짜</th>
                                                    <th className="px-3 py-3">구분</th>
                                                    <th className="px-3 py-3">현장</th>
                                                    <th className="px-3 py-3">성명</th>
                                                    <th className="px-3 py-3">연락처</th>
                                                    <th className="px-3 py-3">작업팀</th>
                                                    <th className="px-3 py-3">현장담당팀</th>
                                                    <th className="px-3 py-3 text-right">공수</th>
                                                    <th className="px-3 py-3 text-right">단가</th>
                                                    <th className="px-3 py-3 text-right">금액</th>
                                                    <th className="px-3 py-3">계좌</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {selectedSiteRows.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={11} className="px-3 py-12 text-center text-sm font-bold text-slate-500">
                                                            선택된 조건의 출력 인원이 없습니다.
                                                        </td>
                                                    </tr>
                                                ) : selectedSiteRows.map((row) => (
                                                    <tr key={row.key} className="border-b border-slate-100 hover:bg-slate-50">
                                                        <td className="px-3 py-3 font-mono text-xs text-slate-600">{row.date}</td>
                                                        <td className="px-3 py-3"><DirectionBadge direction={row.direction} /></td>
                                                        <td className="px-3 py-3 font-bold text-slate-800">{row.siteName}</td>
                                                        <td className="px-3 py-3">
                                                            <div className="font-black text-slate-900">{row.workerName}</div>
                                                            <div className="text-xs text-slate-500">{row.role || row.payType || EMPTY_TEXT}</div>
                                                        </td>
                                                        <td className="px-3 py-3 text-slate-600">{row.contact || EMPTY_TEXT}</td>
                                                        <td className="px-3 py-3 text-slate-700">{row.sourceTeamName || EMPTY_TEXT}</td>
                                                        <td className="px-3 py-3 text-slate-700">{row.targetTeamName || EMPTY_TEXT}</td>
                                                        <td className="px-3 py-3 text-right font-mono font-black">{formatManDay(row.manDay)}</td>
                                                        <td className="px-3 py-3 text-right font-mono">{formatCurrency(row.unitPrice)}</td>
                                                        <td className="px-3 py-3 text-right font-mono font-black text-slate-900">{formatCurrency(row.amount)}</td>
                                                        <td className="px-3 py-3 text-xs text-slate-600">
                                                            {[row.bankName, row.accountHolder, row.accountNumber].filter(Boolean).join(' / ') || EMPTY_TEXT}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="p-4">
                                        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                            <div>
                                                <h3 className="text-lg font-black text-slate-950">{selectedMonth} 노임명세서</h3>
                                                <p className="text-sm text-slate-500">{selectedStatementLabel}</p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={handleDownloadStatement}
                                                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                                            >
                                                <Download size={16} />
                                                명세서 CSV
                                            </button>
                                        </div>
                                        {statementRows.length === 0 ? (
                                            <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm font-bold text-slate-500">
                                                노임명세서로 표시할 출력 내역이 없습니다.
                                            </div>
                                        ) : (
                                            <div className="max-h-[58vh] overflow-auto rounded-2xl border border-slate-200 bg-slate-100 p-4">
                                                <div className="inline-block min-w-[1180px] bg-white">
                                                    <PartnerLaborStatementPreview
                                                        siteName={selectedStatementLabel}
                                                        rows={statementRows}
                                                        yearMonth={selectedMonth}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </section>
                </section>
            </main>
        </div>
    );
};

export default PartnerSupportWorkersPage;
