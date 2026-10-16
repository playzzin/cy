import SecureSignature from '../../components/SecureSignature';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMobileDetailNavigation } from '../../hooks/useMobileScroll';
import {
    AlertCircle,
    BadgeCheck,
    Banknote,
    BriefcaseBusiness,
    Building2,
    CalendarDays,
    ChevronDown,
    CheckCircle2,
    Copy,
    Download,
    Eye,
    EyeOff,
    FileText,
    IdCard,
    Image as ImageIcon,
    List,
    MapPin,
    PenLine,
    Phone,
    Printer,
    RefreshCw,
    Search,
    Send,
    ShieldCheck,
    SlidersHorizontal,
    UserRound,
    Users,
    X,
} from 'lucide-react';
import { getDownloadURL, ref } from 'firebase/storage';

import SignatureGeneratorModal from '../../components/signatures/SignatureGeneratorModal';
import MonthNavigator from '../../components/common/MonthNavigator';
import { storage } from '../../config/firebase';
import { PayslipTemplate } from '../payroll/components/PayslipTemplate';
import type { PaymentData } from '../payroll/components/PayslipTemplate';
import PayslipImageActions from './PayslipImageActions';
import WorkerWorkHistory from '../../components/manpower/WorkerWorkHistory';
import ImageFileActions from '../../components/common/ImageFileActions';
import { dailyReportService, DailyReportWorkerRow } from '../../services/dailyReportService';
import { manpowerService, Worker } from '../../services/manpowerService';
import { teamService, Team } from '../../services/teamService';
import {
    useWorkerAccessScope,
    workerAccessMatchesReportRow,
    workerAccessMatchesTeam,
    workerAccessMatchesWorker,
} from '../../hooks/useWorkerAccessScope';
import { resolveReportPayType } from '../../utils/payType';
import { toast } from '../../utils/swal';
import './TeamWorkerDetailPage.css';

type StatusFilter = 'all' | 'active' | 'retired' | 'inactive';
type DetailView = 'profile' | 'payslip' | 'dailyReport';

const VIEW_TITLES: Record<DetailView, string> = {
    profile: '작업자정보',
    payslip: '급여명세서',
    dailyReport: '출력일보',
};
type MobileView = 'list' | 'detail';
type DailyReportDisplayMode = 'calendar' | 'list';

const EMPTY_TEXT = '-';

const getCurrentMonth = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const getMonthRange = (month: string) => {
    const [yearText, monthText] = month.split('-');
    const year = Number(yearText);
    const monthNumber = Number(monthText);
    if (!year || !monthNumber) {
        const fallback = getCurrentMonth();
        return getMonthRange(fallback);
    }

    const lastDay = new Date(year, monthNumber, 0).getDate();
    return {
        startDate: `${yearText}-${monthText}-01`,
        endDate: `${yearText}-${monthText}-${String(lastDay).padStart(2, '0')}`,
    };
};

const CALENDAR_WEEKDAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'];

const formatDateKey = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const getMonthlyCalendarWeeks = (month: string): Date[][] => {
    const [yearText, monthText] = month.split('-');
    const year = Number(yearText);
    const monthIndex = Number(monthText) - 1;
    if (!year || monthIndex < 0 || monthIndex > 11) return getMonthlyCalendarWeeks(getCurrentMonth());

    const firstDay = new Date(year, monthIndex, 1);
    const lastDay = new Date(year, monthIndex + 1, 0);
    const start = new Date(firstDay);
    start.setDate(firstDay.getDate() - ((firstDay.getDay() + 6) % 7));
    const end = new Date(lastDay);
    end.setDate(lastDay.getDate() + (6 - ((lastDay.getDay() + 6) % 7)));

    const weeks: Date[][] = [];
    const cursor = new Date(start);
    while (cursor <= end) {
        const week: Date[] = [];
        for (let index = 0; index < 7; index += 1) {
            week.push(new Date(cursor));
            cursor.setDate(cursor.getDate() + 1);
        }
        weeks.push(week);
    }
    return weeks;
};

const normalizeText = (value?: string | null) =>
    String(value ?? '').replace(/\s+/g, '').trim().toLowerCase();

const isCheongyeonCompanyName = (value?: string | null) => {
    const normalized = normalizeText(value);
    return normalized.includes('청연이엔지') || normalized.includes('청연eng') || normalized.includes('청연');
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

const formatManDay = (value?: number | null) => {
    const numeric = asNumber(value);
    return Number.isInteger(numeric) ? numeric.toFixed(0) : numeric.toFixed(1);
};

const getReportRowAmount = (row: Pick<DailyReportWorkerRow, 'amount' | 'manDay' | 'unitPrice'>) => {
    const calculatedAmount = asNumber(row.manDay) * asNumber(row.unitPrice);
    return calculatedAmount > 0 ? calculatedAmount : asNumber(row.amount);
};

const getResponsibleTeamLabel = (row: DailyReportWorkerRow) =>
    row.responsibleTeamName || row.teamName || EMPTY_TEXT;

const maskResidentNumber = (value?: string | null, visible = false) => {
    const raw = String(value ?? '').trim();
    if (!raw) return EMPTY_TEXT;
    if (visible) return raw;

    const [front, back] = raw.split('-');
    if (front && back) return `${front}-${back.slice(0, 1)}******`;
    if (raw.length <= 6) return raw;
    return `${raw.slice(0, 6)}-${'*'.repeat(Math.max(1, raw.length - 6))}`;
};

const maskAccountNumber = (value?: string | null, visible = false) => {
    const raw = String(value ?? '').trim();
    if (!raw) return EMPTY_TEXT;
    if (visible || raw.length <= 4) return raw;
    return `${'*'.repeat(Math.max(4, raw.length - 4))}${raw.slice(-4)}`;
};

const isInactiveWorker = (worker: Worker) => {
    const status = normalizeText(worker.status);
    return worker.isActive === false || status.includes('퇴사') || status.includes('inactive') || status.includes('출입금지');
};

const buildTeamTokens = (team?: Team | null) => {
    const values = [team?.id, team?.legacyId, team?.name].map(value => String(value ?? '').trim()).filter(Boolean);
    return new Set(values);
};

const getTeamLabel = (worker: Worker, teamById: Map<string, Team>) => {
    const teamId = String(worker.teamId ?? '').trim();
    return worker.teamName || (teamId ? teamById.get(teamId)?.name : '') || '미배정';
};

const getMeaningfulText = (value?: string | number | null) => {
    const text = String(value ?? '').trim();
    return text && text !== '0' ? text : '';
};

const getWorkerRoleLabel = (worker: Worker) =>
    getMeaningfulText(worker.role) ||
    getMeaningfulText(worker.payType) ||
    getMeaningfulText(worker.salaryModel) ||
    '직무 미등록';

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

const getWorkerTeamColor = (worker: Worker, teamById: Map<string, Team>, fallbackTeam?: Team | null) => {
    const workerColor = String(worker.color ?? '').trim();
    if (workerColor) return workerColor;

    const keys = [worker.teamId, worker.teamName]
        .map(value => String(value ?? '').trim())
        .filter(Boolean);

    for (const key of keys) {
        const teamColor = String(teamById.get(key)?.color ?? '').trim();
        if (teamColor) return teamColor;
    }

    if (fallbackTeam && workerMatchesTeam(worker, fallbackTeam)) {
        const fallbackColor = String(fallbackTeam.color ?? '').trim();
        if (fallbackColor) return fallbackColor;
    }

    return '#2563eb';
};

const getResponsibleTeamColor = (row: DailyReportWorkerRow, teamById: Map<string, Team>) => {
    const teamKeys = [
        row.responsibleTeamId,
        row.responsibleTeamName,
        row.teamId,
        row.teamName,
    ].map(value => String(value ?? '').trim()).filter(Boolean);

    for (const key of teamKeys) {
        const color = String(teamById.get(key)?.color ?? '').trim();
        if (color) return color;
    }

    return '#64748b';
};

const isCheongyeonTeam = (team: Team, workers: Worker[]) => {
    if (isCheongyeonCompanyName(team.companyName)) return true;
    return workers.some(worker => workerMatchesTeam(worker, team) && isCheongyeonCompanyName(worker.companyName));
};

const rowMatchesTeam = (
    row: DailyReportWorkerRow,
    team: Team | null,
    teamWorkerIds: Set<string>,
    teamWorkerNames: Set<string>,
) => {
    if (!team) return true;

    const tokens = buildTeamTokens(team);
    const rowValues = [
        row.teamId,
        row.teamName,
        row.responsibleTeamId,
        row.responsibleTeamName,
        row.workerTeamId,
        row.workerTeamName,
    ].map(value => String(value ?? '').trim());

    if (rowValues.some(value => value && tokens.has(value))) return true;
    if (row.workerId && teamWorkerIds.has(String(row.workerId))) return true;
    if (row.workerName && teamWorkerNames.has(normalizeText(row.workerName))) return true;
    return false;
};

const getWorkerSearchText = (worker: Worker, teamLabel: string) =>
    normalizeText([
        worker.name,
        worker.contact,
        worker.idNumber,
        worker.role,
        teamLabel,
        worker.siteName,
        worker.companyName,
        worker.bankName,
        worker.accountNumber,
    ].join(' '));

const downloadCsv = (filename: string, rows: Array<Record<string, string | number>>) => {
    if (rows.length === 0) {
        toast.warning('내보낼 출력 내역이 없습니다.');
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

const DetailField: React.FC<{ label: string; value?: React.ReactNode; wide?: boolean }> = ({ label, value, wide }) => (
    <div className={wide ? 'tw-detail-field tw-detail-field--wide' : 'tw-detail-field'}>
        <span>{label}</span>
        <strong>{value ?? EMPTY_TEXT}</strong>
    </div>
);

const TeamWorkerDetailPage: React.FC<{ view?: DetailView }> = ({ view: detailView = 'profile' }) => {
    const isDocumentView = detailView !== 'profile';
    const payslipRef = useRef<HTMLDivElement>(null);
    const [teams, setTeams] = useState<Team[]>([]);
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [outputRows, setOutputRows] = useState<DailyReportWorkerRow[]>([]);
    const [selectedTeamId, setSelectedTeamId] = useState<string>('');
    const [isTeamPickerOpen, setIsTeamPickerOpen] = useState(false);
    const [selectedWorkerId, setSelectedWorkerId] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
    const [dailyReportDisplayMode, setDailyReportDisplayMode] = useState<DailyReportDisplayMode>('calendar');
    const [profileSection, setProfileSection] = useState<'info' | 'work'>(() => new URLSearchParams(window.location.search).get('section') === 'work' ? 'work' : 'info');
    const [mobileView, setMobileView, workspaceRef] = useMobileDetailNavigation<MobileView>('list');
    const [showSensitive, setShowSensitive] = useState(true);
    const [loadingMaster, setLoadingMaster] = useState(true);
    const [loadingOutput, setLoadingOutput] = useState(false);
    const [masterError, setMasterError] = useState('');
    const [outputError, setOutputError] = useState('');
    const [idCardImage, setIdCardImage] = useState({ workerId: '', url: '' });
    const idCardUrl = idCardImage.workerId === selectedWorkerId ? idCardImage.url : '';
    const [idCardLoading, setIdCardLoading] = useState(false);
    const [idCardError, setIdCardError] = useState('');
    const [isSignatureOpen, setIsSignatureOpen] = useState(false);
    const setIdCardUrl = (url: string) => setIdCardImage({ workerId: selectedWorkerId, url });

    const { startDate, endDate } = useMemo(() => getMonthRange(selectedMonth), [selectedMonth]);
    const accessScope = useWorkerAccessScope(workers, teams);

    useEffect(() => {
        let mounted = true;

        const loadMaster = async () => {
            setLoadingMaster(true);
            setMasterError('');
            try {
                const [nextTeams, nextWorkers] = await Promise.all([
                    teamService.getTeams(),
                    manpowerService.getWorkers(true),
                ]);

                if (!mounted) return;

                const sortedTeams = nextTeams
                    .filter(team => isCheongyeonTeam(team, nextWorkers))
                    .sort((left, right) =>
                        String(left.name ?? '').localeCompare(String(right.name ?? ''), 'ko-KR')
                    );
                setTeams(sortedTeams);
                setWorkers(nextWorkers);
                setSelectedTeamId(current =>
                    sortedTeams.some(team => String(team.id ?? '') === current)
                        ? current
                        : String(sortedTeams[0]?.id ?? '')
                );
            } catch (error) {
                console.error(error);
                if (mounted) setMasterError('팀/작업자 데이터를 불러오지 못했습니다.');
                toast.error('팀/작업자 데이터를 불러오지 못했습니다.');
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
            setOutputError('');
            try {
                const rows = await dailyReportService.getWorkerRows({ startDate, endDate });
                if (mounted) {
                    setOutputRows(rows);
                    setOutputError('');
                }
            } catch (error) {
                console.error(error);
                toast.error('출력 상세 데이터를 불러오지 못했습니다.');
                if (mounted) {
                    setOutputRows([]);
                    setOutputError('출력 상세 데이터를 불러오지 못했습니다.');
                }
            } finally {
                if (mounted) setLoadingOutput(false);
            }
        };

        loadOutputRows();
        return () => {
            mounted = false;
        };
    }, [startDate, endDate]);

    const teamById = useMemo(() => {
        const map = new Map<string, Team>();
        teams.forEach(team => {
            const id = String(team.id ?? '').trim();
            const legacyId = String(team.legacyId ?? '').trim();
            const name = String(team.name ?? '').trim();
            if (id) map.set(id, team);
            if (legacyId) map.set(legacyId, team);
            if (name) map.set(name, team);
        });
        return map;
    }, [teams]);

    const visibleTeams = useMemo(
        () => accessScope.loading ? [] : teams.filter(team => workerAccessMatchesTeam(accessScope, team)),
        [accessScope, teams]
    );

    useEffect(() => {
        if (accessScope.loading) return;

        if (visibleTeams.length === 0) {
            setSelectedTeamId('');
            return;
        }

        setSelectedTeamId(current =>
            visibleTeams.some(team => [team.id, team.legacyId, team.name].map(value => String(value ?? '')).includes(current))
                ? current
                : String(visibleTeams[0]?.id ?? visibleTeams[0]?.legacyId ?? visibleTeams[0]?.name ?? '')
        );
    }, [accessScope.loading, visibleTeams]);

    const selectedTeam = useMemo(() => {
        if (!selectedTeamId) return null;
        return visibleTeams.find(team =>
            [team.id, team.legacyId, team.name].map(value => String(value ?? '')).includes(selectedTeamId)
        ) ?? null;
    }, [selectedTeamId, visibleTeams]);

    const scopedOutputRows = useMemo(
        () => outputRows.filter(row => workerAccessMatchesReportRow(accessScope, row)),
        [accessScope, outputRows]
    );

    const allTeamWorkers = useMemo(
        () => {
            const scopedWorkers = workers.filter(worker => workerAccessMatchesWorker(accessScope, worker));
            return selectedTeam ? scopedWorkers.filter(worker => workerMatchesTeam(worker, selectedTeam)) : scopedWorkers;
        },
        [accessScope, selectedTeam, workers]
    );

    const filteredWorkers = useMemo(() => {
        const query = normalizeText(searchQuery);

        return allTeamWorkers
            .filter(worker => {
                if (statusFilter === 'active' && isInactiveWorker(worker)) return false;
                const retired = normalizeText(worker.status).includes('퇴사');
                if (statusFilter === 'retired' && !retired) return false;
                if (statusFilter === 'inactive' && (!isInactiveWorker(worker) || retired)) return false;

                if (!query) return true;
                return getWorkerSearchText(worker, getTeamLabel(worker, teamById)).includes(query);
            })
            .sort((left, right) => {
                const statusCompare = Number(isInactiveWorker(left)) - Number(isInactiveWorker(right));
                if (statusCompare !== 0) return statusCompare;
                return String(left.name ?? '').localeCompare(String(right.name ?? ''), 'ko-KR');
            });
    }, [allTeamWorkers, searchQuery, statusFilter, teamById]);

    useEffect(() => {
        if (filteredWorkers.length === 0) {
            setSelectedWorkerId('');
            setMobileView('list');
            return;
        }

        const hasSelectedWorker = filteredWorkers.some(worker => String(worker.id ?? '') === selectedWorkerId);
        if (!hasSelectedWorker) {
            setSelectedWorkerId(isDocumentView ? '' : String(filteredWorkers[0].id ?? ''));
            setMobileView('list');
        }
    }, [filteredWorkers, isDocumentView, selectedWorkerId]);

    const selectedWorker = useMemo(
        () => filteredWorkers.find(worker => String(worker.id ?? '') === selectedWorkerId) ?? null,
        [filteredWorkers, selectedWorkerId]
    );

    const selectedTeamWorkerIds = useMemo(
        () => new Set(allTeamWorkers.map(worker => String(worker.id ?? '')).filter(Boolean)),
        [allTeamWorkers]
    );

    const selectedTeamWorkerNames = useMemo(
        () => new Set(allTeamWorkers.map(worker => normalizeText(worker.name)).filter(Boolean)),
        [allTeamWorkers]
    );

    const teamOutputRows = useMemo(() => (
        selectedTeam
            ? scopedOutputRows.filter(row => rowMatchesTeam(row, selectedTeam, selectedTeamWorkerIds, selectedTeamWorkerNames))
            : []
    ), [scopedOutputRows, selectedTeam, selectedTeamWorkerIds, selectedTeamWorkerNames]);

    const workerOutputRows = useMemo(() => {
        if (!selectedWorker) return [];

        const workerId = String(selectedWorker.id ?? '').trim();
        const workerName = normalizeText(selectedWorker.name);
        return scopedOutputRows
            .filter(row => {
                const rowWorkerId = String(row.workerId ?? '').trim();
                if (rowWorkerId) return [workerId, String(selectedWorker.legacyId ?? '').trim()].includes(rowWorkerId);
                return workerName.length > 0 && normalizeText(row.workerName) === workerName;
            })
            .sort((left, right) => String(right.date ?? '').localeCompare(String(left.date ?? '')));
    }, [scopedOutputRows, selectedWorker]);

    const workerOutputRowsByDate = useMemo(() => {
        const rowsByDate = new Map<string, DailyReportWorkerRow[]>();
        workerOutputRows.forEach(row => {
            const date = String(row.date ?? '').slice(0, 10);
            if (!date) return;
            const rows = rowsByDate.get(date) ?? [];
            rows.push(row);
            rowsByDate.set(date, rows);
        });

        rowsByDate.forEach(rows => rows.sort((left, right) =>
            String(left.siteName ?? '').localeCompare(String(right.siteName ?? ''), 'ko-KR')
        ));
        return rowsByDate;
    }, [workerOutputRows]);

    const workerCalendarWeeks = useMemo(
        () => getMonthlyCalendarWeeks(selectedMonth),
        [selectedMonth]
    );

    const workerOutputDayCount = workerOutputRowsByDate.size;

    const selectedRowsForExport = selectedWorker ? workerOutputRows : teamOutputRows;

    const teamStats = useMemo(() => {
        const totalManDay = teamOutputRows.reduce((sum, row) => sum + asNumber(row.manDay), 0);
        const totalAmount = teamOutputRows.reduce((sum, row) => sum + getReportRowAmount(row), 0);
        const activeWorkers = allTeamWorkers.filter(worker => !isInactiveWorker(worker)).length;
        const idCardCount = allTeamWorkers.filter(worker => String(worker.fileNameSaved ?? '').trim()).length;
        const signatureCount = allTeamWorkers.filter(worker => String(worker.signatureUrl ?? '').trim()).length;

        return {
            totalWorkers: allTeamWorkers.length,
            activeWorkers,
            totalManDay,
            totalAmount,
            idCardCount,
            signatureCount,
        };
    }, [allTeamWorkers, teamOutputRows]);

    const teamFocusWorker = useMemo(() => {
        const candidates = allTeamWorkers.filter(worker => {
            if (statusFilter === 'active') return !isInactiveWorker(worker);
            if (statusFilter === 'inactive') return isInactiveWorker(worker);
            return true;
        });

        return candidates.reduce<{ worker: Worker; manDay: number } | null>((topWorker, worker) => {
            const workerId = String(worker.id ?? '').trim();
            const workerName = normalizeText(worker.name);
            const manDay = teamOutputRows
                .filter(row => (workerId && String(row.workerId ?? '').trim() === workerId) || (workerName && normalizeText(row.workerName) === workerName))
                .reduce((sum, row) => sum + asNumber(row.manDay), 0);

            if (!topWorker || manDay > topWorker.manDay) {
                return { worker, manDay };
            }
            return topWorker;
        }, null);
    }, [allTeamWorkers, statusFilter, teamOutputRows]);

    const workerStats = useMemo(() => {
        const totalManDay = workerOutputRows.reduce((sum, row) => sum + asNumber(row.manDay), 0);
        const totalAmount = workerOutputRows.reduce((sum, row) => sum + getReportRowAmount(row), 0);
        const siteCount = new Set(workerOutputRows.map(row => String(row.siteName ?? row.siteId ?? '').trim()).filter(Boolean)).size;
        const latestDate = workerOutputRows[0]?.date ?? '';

        return { totalManDay, totalAmount, siteCount, latestDate };
    }, [workerOutputRows]);

    const payrollSummary = useMemo(() => {
        const grossPay = workerStats.totalAmount;
        const incomeTax = Math.floor(grossPay * 0.03);
        const localTax = Math.floor(incomeTax * 0.1);
        const totalTax = incomeTax + localTax;
        const deductions = 0;
        const netPay = grossPay - totalTax - deductions;
        const workDays = new Set(workerOutputRows.map(row => row.date).filter(Boolean)).size;

        return {
            grossPay,
            incomeTax,
            localTax,
            totalTax,
            deductions,
            netPay,
            workDays,
        };
    }, [workerOutputRows, workerStats.totalAmount]);

    const payslipData = useMemo<PaymentData | null>(() => {
        if (!selectedWorker) return null;

        const teamName = getTeamLabel(selectedWorker, teamById);
        const sortedWorkRows = [...workerOutputRows].sort((left, right) =>
            String(left.date ?? '').localeCompare(String(right.date ?? ''))
        );
        const workEntries = sortedWorkRows.map(row => {
            const resolvedPayType = resolveReportPayType(row);
            return {
                date: row.date || '',
                siteId: row.siteId || undefined,
                siteName: row.siteName || EMPTY_TEXT,
                manDay: asNumber(row.manDay),
                unitPrice: asNumber(row.unitPrice) || asNumber(selectedWorker.unitPrice),
                description: row.workContent || undefined,
                paymentMethod: resolvedPayType || row.paymentType || undefined,
                amount: getReportRowAmount(row),
            };
        });

        const taxLines = [
            payrollSummary.incomeTax > 0
                ? { label: '[3.0%] 사업소득세', amount: payrollSummary.incomeTax }
                : null,
            payrollSummary.localTax > 0
                ? { label: '[0.3%] 지방소득세', amount: payrollSummary.localTax }
                : null,
        ].filter((line): line is { label: string; amount: number } => Boolean(line));

        const businessSiteSummary = new Map<string, {
            siteId: string;
            siteName: string;
            manDay: number;
            amount: number;
        }>();

        workEntries.forEach(entry => {
            const key = entry.siteId || entry.siteName || 'unknown-site';
            const current = businessSiteSummary.get(key) ?? {
                siteId: entry.siteId || key,
                siteName: entry.siteName || EMPTY_TEXT,
                manDay: 0,
                amount: 0,
            };
            current.manDay += entry.manDay;
            current.amount += entry.amount;
            businessSiteSummary.set(key, current);
        });

        return {
            workerId: String(selectedWorker.id ?? ''),
            workerName: selectedWorker.name ?? '',
            idNumber: maskResidentNumber(selectedWorker.idNumber, showSensitive),
            companyId: selectedWorker.companyId || selectedTeam?.companyId || undefined,
            companyName: selectedWorker.companyName || selectedTeam?.companyName || '청연이엔지',
            teamId: String(selectedWorker.teamId ?? selectedTeam?.id ?? '') || undefined,
            teamName,
            month: selectedMonth,
            totalManDay: workerStats.totalManDay,
            unitPrice: asNumber(selectedWorker.unitPrice) || workEntries.find(entry => entry.unitPrice > 0)?.unitPrice || 0,
            grossAmount: payrollSummary.grossPay,
            totalDeduction: payrollSummary.totalTax + payrollSummary.deductions,
            totalAmount: payrollSummary.netPay,
            bankName: selectedWorker.bankName || undefined,
            accountNumber: maskAccountNumber(selectedWorker.accountNumber, showSensitive),
            accountHolder: selectedWorker.accountHolder || selectedWorker.name || undefined,
            displayContent: `${selectedMonth} 노임명세서`,
            workEntries,
            deductionBreakdown: {
                standardLines: [],
                additionalLines: [],
                totalStandard: 0,
                totalAdditional: payrollSummary.deductions,
                total: payrollSummary.deductions,
                hasData: payrollSummary.deductions > 0,
            },
            taxBreakdown: {
                standardLines: taxLines,
                additionalLines: [],
                totalStandard: payrollSummary.totalTax,
                totalAdditional: 0,
                total: payrollSummary.totalTax,
                hasData: taxLines.length > 0,
            },
            taxRateSnapshot: {
                pensionRate: 0,
                healthRate: 0,
                careRateOfHealth: 0,
                employmentRate: 0,
                incomeTaxRate: 0,
                residentTaxRate: 0,
                businessIncomeTaxRate: 0.03,
                businessResidentTaxRate: 0.003,
            },
            businessIncomeAppliedSummary: {
                appliedManDay: workerStats.totalManDay,
                appliedAmount: payrollSummary.grossPay,
                appliedSites: Array.from(businessSiteSummary.values()),
            },
            isValid: true,
            errors: {},
        };
    }, [
        payrollSummary,
        selectedMonth,
        selectedTeam?.companyId,
        selectedTeam?.companyName,
        selectedTeam?.id,
        selectedWorker,
        showSensitive,
        teamById,
        workerOutputRows,
        workerStats.totalManDay,
    ]);

    const selectedWorkerTeamColor = useMemo(
        () => selectedWorker ? getWorkerTeamColor(selectedWorker, teamById, selectedTeam) : '#2563eb',
        [selectedWorker, selectedTeam, teamById]
    );

    useEffect(() => {
        let mounted = true;

        const loadIdCard = async () => {
            setIdCardUrl('');
            setIdCardError('');
            if (isDocumentView) return;

            const rawPath = String(selectedWorker?.fileNameSaved ?? '').trim();
            if (!rawPath) return;

            if (/^https?:\/\//i.test(rawPath)) {
                setIdCardUrl(rawPath);
                return;
            }

            setIdCardLoading(true);
            const candidates = Array.from(new Set([
                rawPath,
                rawPath.startsWith('workers/') ? rawPath : `workers/${rawPath}`,
            ]));

            for (const candidate of candidates) {
                try {
                    const url = await getDownloadURL(ref(storage, candidate));
                    if (mounted) {
                        setIdCardUrl(url);
                        setIdCardError('');
                    }
                    setIdCardLoading(false);
                    return;
                } catch {
                    // Try next compatible storage path.
                }
            }

            if (mounted) {
                setIdCardError('저장된 경로의 파일을 찾지 못했습니다.');
                setIdCardLoading(false);
            }
        };

        loadIdCard();
        return () => {
            mounted = false;
        };
    }, [isDocumentView, selectedWorker?.fileNameSaved, selectedWorkerId]);

    const handleRefresh = async () => {
        setLoadingMaster(true);
        setLoadingOutput(true);
        setMasterError('');
        setOutputError('');
        let hasError = false;

        const refreshMaster = Promise.all([
            teamService.getTeams(),
            manpowerService.getWorkers(true),
        ]).then(([nextTeams, nextWorkers]) => {
            const cheongyeonTeams = nextTeams
                .filter(team => isCheongyeonTeam(team, nextWorkers))
                .sort((left, right) =>
                    String(left.name ?? '').localeCompare(String(right.name ?? ''), 'ko-KR')
                );
            setTeams(cheongyeonTeams);
            setSelectedTeamId(current =>
                cheongyeonTeams.some(team => String(team.id ?? '') === current)
                    ? current
                    : String(cheongyeonTeams[0]?.id ?? '')
            );
            setWorkers(nextWorkers);
            setMasterError('');
        }).catch((error) => {
            console.error(error);
            hasError = true;
            setMasterError('팀/작업자 데이터를 새로고침하지 못했습니다.');
        });

        const refreshOutput = dailyReportService.getWorkerRows({ startDate, endDate })
            .then((rows) => {
                setOutputRows(rows);
                setOutputError('');
            })
            .catch((error) => {
                console.error(error);
                hasError = true;
                setOutputRows([]);
                setOutputError('출력 상세 데이터를 새로고침하지 못했습니다.');
            });

        try {
            await Promise.all([refreshMaster, refreshOutput]);
            if (!hasError) {
                toast.success('최신 데이터로 새로고침했습니다.');
            } else {
                toast.error('새로고침 중 일부 데이터를 불러오지 못했습니다.');
            }
        } catch (error) {
            console.error(error);
            toast.error('새로고침 중 오류가 발생했습니다.');
        } finally {
            setLoadingMaster(false);
            setLoadingOutput(false);
        }
    };

    const handleSignatureSaved = (downloadUrl: string) => {
        const workerId = String(selectedWorker?.id ?? '').trim();
        setWorkers(prev => prev.map(worker =>
            String(worker.id ?? '') === workerId ? { ...worker, signatureUrl: downloadUrl } : worker
        ));
        setIsSignatureOpen(false);
    };

    const handleTeamSelect = (teamId: string) => {
        setSelectedTeamId(teamId);
        setIsTeamPickerOpen(false);
        setMobileView('list');
    };

    const handleWorkerSelect = (workerId: string) => {
        setSelectedWorkerId(workerId);
        setMobileView('detail');
    };

    const handleCsvDownload = () => {
        const suffix = selectedWorker ? selectedWorker.name : selectedTeam?.name ?? '전체';
        downloadCsv(`작업자_출력상세_${suffix}_${selectedMonth}.csv`, selectedRowsForExport.map(row => ({
            날짜: row.date,
            작업자: row.workerName,
            현장: row.siteName || '',
            출력팀: row.teamName || '',
            소속팀: row.workerTeamName || '',
            직무: row.role || '',
            공수: row.manDay,
            단가: row.unitPrice || 0,
            금액: getReportRowAmount(row),
            작업내용: row.workContent || '',
        })));
    };

    const renderTeamItem = (team: Team) => {
        const teamWorkers = workers
            .filter(worker => workerAccessMatchesWorker(accessScope, worker))
            .filter(worker => workerMatchesTeam(worker, team));
        const workerIds = new Set(teamWorkers.map(worker => String(worker.id ?? '')).filter(Boolean));
        const workerNames = new Set(teamWorkers.map(worker => normalizeText(worker.name)).filter(Boolean));
        const rows = scopedOutputRows.filter(row => rowMatchesTeam(row, team, workerIds, workerNames));
        const totalManDay = rows.reduce((sum, row) => sum + asNumber(row.manDay), 0);
        const isSelected = String(team.id ?? '') === selectedTeamId;

        return (
            <button
                key={String(team.id ?? team.name)}
                type="button"
                className={isSelected ? 'tw-team-item tw-team-item--active' : 'tw-team-item'}
                onClick={() => handleTeamSelect(String(team.id ?? ''))}
            >
                <span className="tw-team-item__color" style={{ background: team.color || '#2563eb' }} />
                <span className="tw-team-item__body">
                    <strong>{team.name}</strong>
                    <small>{team.companyName || team.type || '팀 정보 없음'}</small>
                </span>
                <span className="tw-team-item__meta">
                    <strong>{teamWorkers.length}</strong>
                    <small>{formatManDay(totalManDay)}공수</small>
                </span>
            </button>
        );
    };

    const selectedWorkerPhone = String(selectedWorker?.contact ?? '').replace(/[^0-9+]/g, '');

    return (
        <div className="tw-page">
            <header className="tw-page__header">
                <div>
                    <div className="tw-page__eyebrow">
                        <Users size={16} />
                        인원관리
                    </div>
                    <h1>{VIEW_TITLES[detailView]}</h1>
                </div>

                <div className="tw-header-actions">
                    <button type="button" className="tw-icon-button" onClick={() => setShowSensitive(prev => !prev)} title={showSensitive ? '민감정보 숨기기' : '민감정보 표시'} aria-label={showSensitive ? '민감정보 숨기기' : '민감정보 표시'}>
                        {showSensitive ? <EyeOff size={18} /> : <Eye size={18} />}
                        <span>{showSensitive ? '숨김' : '표시'}</span>
                    </button>
                    <button type="button" className="tw-icon-button" onClick={handleCsvDownload} title="CSV 내보내기" aria-label="CSV 내보내기" disabled={isDocumentView && (!selectedWorker || loadingOutput || !!outputError)}>
                        <Download size={18} />
                        <span>CSV</span>
                    </button>
                    <button type="button" className="tw-icon-button" onClick={() => window.print()} title="인쇄" aria-label="인쇄" disabled={isDocumentView && (!selectedWorker || loadingOutput || !!outputError)}>
                        <Printer size={18} />
                        <span>인쇄</span>
                    </button>
                    <button type="button" className="tw-primary-button" onClick={handleRefresh} disabled={loadingMaster || loadingOutput || accessScope.loading}>
                        <RefreshCw size={18} className={loadingMaster || loadingOutput || accessScope.loading ? 'tw-spin' : ''} />
                        새로고침
                    </button>
                </div>
            </header>

            <section className="tw-mobile-filter-bar" aria-label="작업자 빠른 검색">
                <label className="tw-mobile-search">
                    <Search size={19} />
                    <input
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder={isDocumentView ? '작업자 이름 검색' : '이름 · 연락처 · 팀으로 검색'}
                        aria-label="작업자 빠른 검색"
                    />
                    {searchQuery && (
                        <button type="button" onClick={() => setSearchQuery('')} aria-label="검색어 지우기">
                            <X size={17} />
                        </button>
                    )}
                </label>
            </section>

            <section id="team-worker-filter-controls" className="tw-toolbar tw-toolbar--always-visible">
                <div className="tw-control tw-control--month">
                    <span>조회월</span>
                    <MonthNavigator
                        value={selectedMonth}
                        onChange={setSelectedMonth}
                    />
                </div>

                <label className="tw-control tw-control--search">
                    <span>작업자 검색</span>
                    <div className="tw-search">
                        <Search size={18} />
                        <input
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            placeholder={isDocumentView ? '작업자 이름 검색' : '이름, 연락처, 팀, 계좌'}
                            aria-label="작업자 검색"
                        />
                    </div>
                </label>

                <div className="tw-control tw-control--status">
                    <span>상태</span>
                    <div className="tw-status-options" role="group" aria-label="작업자 상태">
                        {([{ value: 'all', label: '전체' }, { value: 'active', label: '재직' }, { value: 'retired', label: '퇴사' },
                            ...(allTeamWorkers.some(worker => isInactiveWorker(worker) && !normalizeText(worker.status).includes('퇴사')) ? [{ value: 'inactive', label: '기타' }] : [])]
                        ).map(option => <button type="button" key={option.value} aria-pressed={statusFilter === option.value}
                            onClick={() => setStatusFilter(option.value as StatusFilter)}>{option.label}</button>)}
                    </div>
                </div>
            </section>

            {(masterError || outputError) && (
                <section className="tw-alert-stack" aria-live="polite">
                    {masterError && (
                        <div className="tw-alert tw-alert--error">
                            <AlertCircle size={18} />
                            <div>
                                <strong>팀/작업자 로드 실패</strong>
                                <span>{masterError}</span>
                            </div>
                            <button type="button" onClick={handleRefresh} disabled={loadingMaster || loadingOutput}>
                                다시 시도
                            </button>
                        </div>
                    )}
                    {outputError && (
                        <div className="tw-alert tw-alert--warning">
                            <AlertCircle size={18} />
                            <div>
                                <strong>출력 상세 로드 실패</strong>
                                <span>{outputError}</span>
                            </div>
                            <button type="button" onClick={handleRefresh} disabled={loadingMaster || loadingOutput}>
                                다시 시도
                            </button>
                        </div>
                    )}
                </section>
            )}

            <section className="tw-kpi-grid" aria-label="팀 요약">
                <div className="tw-kpi">
                    <Users size={20} />
                    <span>작업자</span>
                    <strong>{teamStats.activeWorkers}/{teamStats.totalWorkers}</strong>
                </div>
                <div className="tw-kpi">
                    <CalendarDays size={20} />
                    <span>{selectedMonth} 공수</span>
                    <strong>{formatManDay(teamStats.totalManDay)}</strong>
                </div>
                <div className="tw-kpi">
                    <Banknote size={20} />
                    <span>출력 금액</span>
                    <strong>{formatCurrency(teamStats.totalAmount)}</strong>
                </div>
                <div className="tw-kpi">
                    <ShieldCheck size={20} />
                    <span>증빙</span>
                    <strong>{teamStats.idCardCount}/{teamStats.signatureCount}</strong>
                </div>
            </section>

            <div className="tw-mobile-switch" role="tablist" aria-label="모바일 보기 전환">
                <button
                    type="button"
                    className={mobileView === 'list' ? 'tw-mobile-switch__button tw-mobile-switch__button--active' : 'tw-mobile-switch__button'}
                    onClick={() => setMobileView('list')}
                    role="tab"
                    aria-selected={mobileView === 'list'}
                >
                    <Users size={16} />
                    작업자 목록
                </button>
                <button
                    type="button"
                    className={mobileView === 'detail' ? 'tw-mobile-switch__button tw-mobile-switch__button--active' : 'tw-mobile-switch__button'}
                    onClick={() => setMobileView('detail')}
                    disabled={!selectedWorker}
                    role="tab"
                    aria-selected={mobileView === 'detail'}
                >
                    <UserRound size={16} />
                    {selectedWorker ? `${selectedWorker.name} 상세` : '상세 보기'}
                </button>
            </div>

            <main ref={workspaceRef} className={`tw-workspace tw-workspace--${mobileView}`}>
                <section className="tw-worker-panel">
                    <div className="tw-panel-heading">
                        <div className="tw-panel-heading__title">
                            <span>선택한 팀</span>
                            <strong>{selectedTeam?.name || '청연이엔지 소속팀'}</strong>
                        </div>
                        <div className="tw-panel-heading__count">
                            <strong>{filteredWorkers.length.toLocaleString('ko-KR')}명</strong>
                            <small>현재 목록</small>
                        </div>
                    </div>

                    <div className="tw-worker-list">
                        <div className={isTeamPickerOpen ? 'tw-merged-team-list tw-merged-team-list--open' : 'tw-merged-team-list'} aria-label="청연이엔지 소속팀 선택">
                            <button
                                type="button"
                                className="tw-team-picker-button"
                                onClick={() => setIsTeamPickerOpen(prev => !prev)}
                                aria-expanded={isTeamPickerOpen}
                                disabled={loadingMaster || accessScope.loading || visibleTeams.length === 0}
                            >
                                <span className="tw-team-item__color" style={{ background: selectedTeam?.color || '#2563eb' }} />
                                <span className="tw-team-picker-button__body">
                                    <small>팀 선택</small>
                                    <strong>{selectedTeam?.name || '청연이엔지 소속팀 선택'}</strong>
                                </span>
                                <span className="tw-team-picker-button__meta">
                                    {teamStats.activeWorkers}/{teamStats.totalWorkers}명
                                </span>
                                <ChevronDown size={18} className={isTeamPickerOpen ? 'tw-team-picker-button__chevron tw-team-picker-button__chevron--open' : 'tw-team-picker-button__chevron'} />
                            </button>
                            {loadingMaster || accessScope.loading ? (
                                <div className="tw-empty-state">팀 데이터를 불러오는 중입니다.</div>
                            ) : masterError ? (
                                <div className="tw-empty-state tw-empty-state--error">{masterError}</div>
                            ) : visibleTeams.length === 0 ? (
                                <div className="tw-empty-state">청연이엔지 소속팀이 없습니다.</div>
                            ) : isTeamPickerOpen && (
                                <div className="tw-team-picker-menu">
                                    {visibleTeams.map(renderTeamItem)}
                                </div>
                            )}
                        </div>

                        <div className="tw-mobile-team-context" aria-label="선택한 팀의 이번 달 현황">
                            <div>
                                <span>이번 달 팀 실적</span>
                                <strong>{formatManDay(teamStats.totalManDay)}공수 · {formatCurrency(teamStats.totalAmount)}</strong>
                            </div>
                            {teamFocusWorker && (
                                <div>
                                    <span>공수 상위 작업자</span>
                                    <strong><UserRound size={14} />{teamFocusWorker.worker.name || EMPTY_TEXT} · {formatManDay(teamFocusWorker.manDay)}공수</strong>
                                </div>
                            )}
                        </div>

                        <div className="tw-list-block-title tw-list-block-title--workers">작업자 목록</div>
                        {loadingMaster || accessScope.loading ? (
                            <div className="tw-empty-state">작업자 데이터를 불러오는 중입니다.</div>
                        ) : masterError ? (
                            <div className="tw-empty-state tw-empty-state--error">작업자 목록을 표시할 수 없습니다.</div>
                        ) : filteredWorkers.length === 0 ? (
                            <div className="tw-empty-state">조건에 맞는 작업자가 없습니다.</div>
                        ) : (
                            filteredWorkers.map(worker => {
                                const workerId = String(worker.id ?? '');
                                const selected = workerId === selectedWorkerId;
                                const teamLabel = getTeamLabel(worker, teamById);
                                const workerTeamColor = getWorkerTeamColor(worker, teamById, selectedTeam);
                                const workerRows = scopedOutputRows.filter(row => {
                                    if (workerId && String(row.workerId ?? '') === workerId) return true;
                                    return normalizeText(row.workerName) === normalizeText(worker.name);
                                });
                                const periodManDay = workerRows.reduce((sum, row) => sum + asNumber(row.manDay), 0);

                                return (
                                    <button
                                        key={workerId || worker.name}
                                        type="button"
                                        className={selected ? 'tw-worker-item tw-worker-item--active' : 'tw-worker-item'}
                                        onClick={() => handleWorkerSelect(workerId)}
                                    >
                                        <span className="tw-avatar" style={{ background: workerTeamColor }}>{String(worker.name ?? '?').slice(0, 1)}</span>
                                        <span className="tw-worker-item__main">
                                            <strong>{worker.name}</strong>
                                            <small>{teamLabel} · {getWorkerRoleLabel(worker)}</small>
                                        </span>
                                        <span className="tw-worker-item__badges">
                                            {worker.fileNameSaved ? <IdCard size={15} /> : <AlertCircle size={15} />}
                                            {worker.signatureUrl ? <PenLine size={15} /> : null}
                                            <small>{formatManDay(periodManDay)}공수</small>
                                        </span>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </section>

                <section className="tw-detail-panel">
                    {!selectedWorker ? (
                        <div className="tw-empty-detail">
                            <UserRound size={44} />
                            <strong>작업자를 선택하세요.</strong>
                            {isDocumentView && <p>이름을 검색하고 작업자를 선택하면 {VIEW_TITLES[detailView]}를 확인할 수 있습니다.</p>}
                        </div>
                    ) : (
                        <>
                            <button
                                type="button"
                                className="tw-mobile-back"
                                onClick={() => setMobileView('list')}
                            >
                                작업자 목록으로
                            </button>

                            <div className="tw-worker-hero">
                                <div className="tw-worker-hero__avatar" style={{ background: selectedWorkerTeamColor }}>{String(selectedWorker.name ?? '?').slice(0, 1)}</div>
                                <div className="tw-worker-hero__content">
                                    <div className="tw-worker-hero__title">
                                        <h2>{selectedWorker.name}</h2>
                                        <span className={isInactiveWorker(selectedWorker) ? 'tw-status tw-status--inactive' : 'tw-status'}>
                                            {isInactiveWorker(selectedWorker) ? '비활성' : '재직'}
                                        </span>
                                    </div>
                                    <div className="tw-worker-hero__meta">
                                        <span><Building2 size={15} />{getTeamLabel(selectedWorker, teamById)}</span>
                                        <span><BriefcaseBusiness size={15} />{getWorkerRoleLabel(selectedWorker)}</span>
                                        <span><CalendarDays size={15} />최근 {workerStats.latestDate || '-'}</span>
                                    </div>
                                </div>
                                {!isDocumentView && <div className="tw-worker-hero__actions">
                                    <button
                                        type="button"
                                        className="tw-secondary-button tw-worker-hero__action"
                                        onClick={() => {
                                            if (selectedWorkerPhone) window.location.href = `tel:${selectedWorkerPhone}`;
                                        }}
                                        disabled={!selectedWorkerPhone}
                                    >
                                        <Phone size={17} />
                                        전화
                                    </button>
                                    <button
                                        type="button"
                                        className="tw-secondary-button tw-worker-hero__action"
                                        onClick={() => setIsSignatureOpen(true)}
                                        disabled={!selectedWorker.id}
                                    >
                                        <PenLine size={17} />
                                        {selectedWorker.signatureUrl ? '서명 수정' : '서명 등록'}
                                    </button>
                                </div>}
                            </div>

                            {detailView === 'profile' && <div className="tw-profile-sections" role="tablist" aria-label="작업자 상세 영역">
                                <button type="button" role="tab" aria-selected={profileSection === 'info'} onClick={() => setProfileSection('info')}>기본정보</button>
                                <button type="button" role="tab" aria-selected={profileSection === 'work'} onClick={() => setProfileSection('work')}>근무내역</button>
                            </div>}
                            <div className="tw-worker-stat-grid">
                                <div>
                                    <span>월 공수</span>
                                    <strong>{formatManDay(workerStats.totalManDay)}</strong>
                                </div>
                                <div>
                                    <span>월 금액</span>
                                    <strong>{formatCurrency(workerStats.totalAmount)}</strong>
                                </div>
                                <div>
                                    <span>현장</span>
                                    <strong>{workerStats.siteCount.toLocaleString('ko-KR')}</strong>
                                </div>
                            </div>

                            {detailView === 'profile' && profileSection === 'info' && (
                            <div
                                className="tw-section-grid tw-section-grid--team-accent"
                                style={{ '--team-color': selectedWorkerTeamColor } as React.CSSProperties}
                            >
                                <section className="tw-detail-section">
                                    <h3><UserRound size={18} />작업자 정보</h3>
                                    <div className="tw-detail-grid">
                                        <DetailField label="이름" value={asText(selectedWorker.name)} />
                                        <DetailField label="직무" value={getWorkerRoleLabel(selectedWorker)} />
                                        <DetailField label="팀" value={getTeamLabel(selectedWorker, teamById)} />
                                        <DetailField label="소속회사" value={asText(selectedWorker.companyName)} />
                                        <DetailField label="현장" value={asText(selectedWorker.siteName)} />
                                        <DetailField label="고용구분" value={asText(selectedWorker.employmentType)} />
                                    </div>
                                </section>

                                <section className="tw-detail-section">
                                    <h3><FileText size={18} />인적 정보</h3>
                                    <div className="tw-detail-grid">
                                        <DetailField label="주민번호" value={maskResidentNumber(selectedWorker.idNumber, showSensitive)} />
                                        <DetailField label="연락처" value={<span className="tw-inline-icon"><Phone size={15} />{asText(selectedWorker.contact)}</span>} />
                                        <DetailField label="이메일" value={asText(selectedWorker.email)} />
                                        <DetailField label="혈액형" value={asText(selectedWorker.bloodType)} />
                                        <DetailField label="주소" value={<span className="tw-inline-icon"><MapPin size={15} />{asText(selectedWorker.address)}</span>} wide />
                                    </div>
                                </section>

                                <section className="tw-detail-section">
                                    <h3><Banknote size={18} />계좌 정보</h3>
                                    <div className="tw-detail-grid">
                                        <DetailField label="은행" value={asText(selectedWorker.bankName)} />
                                        <DetailField label="예금주" value={asText(selectedWorker.accountHolder || selectedWorker.name)} />
                                        <DetailField label="계좌번호" value={maskAccountNumber(selectedWorker.accountNumber, showSensitive)} wide />
                                        <DetailField label="단가" value={formatCurrency(selectedWorker.unitPrice)} />
                                        <DetailField label="급여유형" value={asText(selectedWorker.salaryModel || selectedWorker.payType)} />
                                    </div>
                                </section>

                                <section className="tw-detail-section tw-detail-section--documents">
                                    <h3><IdCard size={18} />신분증과 서명</h3>
                                    <div className="tw-doc-grid">
                                        <div className="tw-doc-preview">
                                            <div className="tw-doc-preview__header">
                                                <span>신분증</span>
                                                {selectedWorker.fileNameSaved ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                                            </div>
                                            <div className="tw-doc-preview__canvas">
                                                {idCardLoading ? (
                                                    <span>불러오는 중</span>
                                                ) : idCardUrl ? (
                                                    <img src={idCardUrl} alt={`${selectedWorker.name} 신분증`} />
                                                ) : (
                                                    <div>
                                                        <ImageIcon size={28} />
                                                        <span>{idCardError || '등록된 신분증 없음'}</span>
                                                    </div>
                                                )}
                                            </div>
                                            {idCardUrl && <ImageFileActions key={`${selectedWorkerId}:${idCardUrl}`} imageUrl={idCardUrl} name={`${selectedWorker.name} 신분증`} />}
                                        </div>

                                        <div className="tw-doc-preview">
                                            <div className="tw-doc-preview__header">
                                                <span>서명</span>
                                                {selectedWorker.signatureUrl ? <BadgeCheck size={16} /> : <AlertCircle size={16} />}
                                            </div>
                                            <div className="tw-doc-preview__canvas tw-doc-preview__canvas--signature">
                                                {selectedWorker.signatureUrl ? (
                                                    <SecureSignature src={selectedWorker.signatureUrl} alt={`${selectedWorker.name} 서명`} />
                                                ) : (
                                                    <div>
                                                        <PenLine size={28} />
                                                        <span>등록된 서명 없음</span>
                                                    </div>
                                                )}
                                            </div>
                                            <button type="button" onClick={() => setIsSignatureOpen(true)}>
                                                {selectedWorker.signatureUrl ? '서명 수정' : '서명 등록'}
                                            </button>
                                        </div>
                                    </div>
                                </section>
                            </div>
                            )}

                            {detailView === 'payslip' && (
                            <section className="tw-payslip-template-wrap" aria-label="월별 노임명세서">
                                {loadingOutput ? (
                                    <div className="tw-empty-state">급여명세서를 불러오는 중입니다.</div>
                                ) : outputError ? (
                                    <div className="tw-empty-state tw-empty-state--error">급여명세서를 표시할 수 없습니다. 새로고침해 주세요.</div>
                                ) : payslipData && !loadingMaster && !accessScope.loading && !masterError && (
                                    <>
                                    <PayslipImageActions
                                        key={`${selectedWorkerId}:${selectedMonth}:${showSensitive}`}
                                        targetRef={payslipRef}
                                        data={payslipData}
                                        month={selectedMonth}
                                    />
                                    <PayslipTemplate
                                        ref={payslipRef}
                                        data={payslipData}
                                        month={selectedMonth}
                                    />
                                    </>
                                )}
                            </section>
                            )}

                            {(detailView === 'dailyReport' || (detailView === 'profile' && profileSection === 'work')) && (
                                <WorkerWorkHistory key={`${selectedWorkerId}:${selectedMonth}`} rows={workerOutputRows}
                                    month={selectedMonth} workerName={selectedWorker.name} loading={loadingOutput} error={outputError} />
                            )}
                        </>
                    )}
                </section>
            </main>

            {selectedWorker?.id && (
                <SignatureGeneratorModal
                    isOpen={isSignatureOpen}
                    onClose={() => setIsSignatureOpen(false)}
                    workerId={String(selectedWorker.id)}
                    workerName={selectedWorker.name}
                    onSaveComplete={handleSignatureSaved}
                />
            )}
        </div>
    );
};

export default TeamWorkerDetailPage;
