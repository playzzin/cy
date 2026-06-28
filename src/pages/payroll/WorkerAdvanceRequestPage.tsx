import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    AlertCircle,
    Banknote,
    CalendarDays,
    CheckCircle2,
    ClipboardList,
    RefreshCw,
    Search,
    Send,
    UserRound,
    WalletCards,
    XCircle,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { manpowerService, Worker } from '../../services/manpowerService';
import { userService, UserData } from '../../services/userService';
import { dailyReportService, DailyReportWorkerRow } from '../../services/dailyReportService';
import { advancePaymentService, AdvancePayment } from '../../services/advancePaymentService';
import {
    advanceRequestService,
    AdvanceRequest,
    AdvanceRequestStatus,
} from '../../services/advanceRequestService';
import { ADVANCE_ITEM_LABEL_KEYS } from '../../services/payrollConfigService';

type EarnedSummary = {
    currentMonthEarned: number;
    previousMonthEarned: number;
    earnedAmount: number;
    existingAdvanceAmount: number;
    activeRequestAmount: number;
    availableAmount: number;
    workRows: DailyReportWorkerRow[];
};

const statusLabels: Record<AdvanceRequestStatus, string> = {
    requested: '신청',
    approved: '승인',
    rejected: '반려',
    paid: '지급완료',
    cancelled: '취소',
};

const statusClassNames: Record<AdvanceRequestStatus, string> = {
    requested: 'border-blue-100 bg-blue-50 text-blue-700',
    approved: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    rejected: 'border-rose-100 bg-rose-50 text-rose-700',
    paid: 'border-slate-200 bg-slate-100 text-slate-700',
    cancelled: 'border-slate-200 bg-white text-slate-400',
};

const currencyFormatter = new Intl.NumberFormat('ko-KR');

const normalizeText = (value: unknown): string => String(value ?? '').trim();
const normalizeKey = (value: unknown): string => normalizeText(value).toLowerCase().replace(/\s+/g, '');

const parseAmountInput = (value: unknown): number => {
    const cleaned = normalizeText(value).replace(/[^0-9]/g, '');
    if (!cleaned) return 0;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
};

const formatAmountInput = (value: number): string => {
    if (!Number.isFinite(value) || value <= 0) return '';
    return currencyFormatter.format(Math.floor(value));
};

const formatCurrency = (value: number): string => `${currencyFormatter.format(Math.round(value || 0))}원`;

const toInputDateValue = (date: Date): string => {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
};

const getTodayInputValue = (): string => toInputDateValue(new Date());

const getYearMonth = (date = getTodayInputValue()): string => date.slice(0, 7);

const isValidYearMonth = (value: string): boolean => /^\d{4}-\d{2}$/.test(value);

const shiftYearMonth = (yearMonth: string, monthOffset: number): string => {
    if (!isValidYearMonth(yearMonth)) return getYearMonth();
    const [year, month] = yearMonth.split('-').map(Number);
    const date = new Date(year, month - 1 + monthOffset, 1);
    return toInputDateValue(date).slice(0, 7);
};

const getMonthStart = (yearMonth: string): string => `${yearMonth}-01`;

const getMonthEnd = (yearMonth: string): string => {
    if (!isValidYearMonth(yearMonth)) return '';
    const [year, month] = yearMonth.split('-').map(Number);
    return toInputDateValue(new Date(year, month, 0));
};

const formatDate = (value?: unknown): string => {
    const text = normalizeText(value);
    if (!text) return '-';
    const date = new Date(text.length <= 10 ? `${text}T00:00:00` : text);
    if (Number.isNaN(date.getTime())) return text;
    return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
};

const toDateMillis = (value: unknown): number => {
    if (!value) return 0;
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'string') {
        const parsed = new Date(value).getTime();
        return Number.isFinite(parsed) ? parsed : 0;
    }
    if (typeof value === 'object') {
        const record = value as { toMillis?: () => number; seconds?: unknown; _seconds?: unknown };
        if (typeof record.toMillis === 'function') return record.toMillis();
        const seconds = typeof record.seconds === 'number' ? record.seconds : record._seconds;
        return typeof seconds === 'number' && Number.isFinite(seconds) ? seconds * 1000 : 0;
    }
    return 0;
};

const parseLinkedIds = (raw: unknown): string[] => {
    if (Array.isArray(raw)) return raw.map(normalizeText).filter(Boolean);
    const text = normalizeText(raw);
    if (!text) return [];
    try {
        const parsed = JSON.parse(text);
        return Array.isArray(parsed) ? parsed.map(normalizeText).filter(Boolean) : [text];
    } catch {
        return [text];
    }
};

const getWorkerKeys = (worker?: Worker | null): string[] => {
    if (!worker) return [];
    return Array.from(new Set([worker.id, worker.legacyId].map(normalizeText).filter(Boolean)));
};

const isInactiveWorker = (worker: Worker): boolean =>
    worker.isActive === false || normalizeText(worker.status).includes('퇴사');

const sameText = (left?: unknown, right?: unknown): boolean => normalizeKey(left) === normalizeKey(right);

const getLinkedWorkerCandidates = (
    workers: Worker[],
    currentUserUid?: string,
    currentUserEmail?: string | null,
    currentUserDisplayName?: string | null,
    profile?: UserData | null
): Worker[] => {
    const uid = normalizeText(currentUserUid);
    const email = normalizeText(currentUserEmail || profile?.email);
    const displayName = normalizeText(currentUserDisplayName || profile?.displayName);
    const linkedIds = parseLinkedIds(profile?.linkedWorkerIds);

    const directMatches = workers.filter((worker) => {
        const workerKeys = getWorkerKeys(worker);
        return (
            Boolean(uid && normalizeText(worker.uid) === uid) ||
            Boolean(email && sameText(worker.email, email)) ||
            linkedIds.some((linkedId) => workerKeys.includes(linkedId))
        );
    });

    if (directMatches.length > 0) return directMatches;
    if (!displayName) return [];
    return workers.filter((worker) => sameText(worker.name, displayName));
};

const matchesWorker = (worker: Worker, row: { workerId?: unknown; workerName?: unknown; name?: unknown }): boolean => {
    const keys = new Set(getWorkerKeys(worker));
    const rowWorkerId = normalizeText(row.workerId);
    if (rowWorkerId && keys.has(rowWorkerId)) return true;
    return Boolean(row.workerName && sameText(row.workerName, worker.name)) || Boolean(row.name && sameText(row.name, worker.name));
};

const getAdvanceCashAmount = (advance: AdvancePayment): number => {
    const itemAmounts = ADVANCE_ITEM_LABEL_KEYS.reduce((sum, key) => {
        const amount = Number(advance.items?.[key] ?? 0);
        return sum + (Number.isFinite(amount) ? amount : 0);
    }, 0);

    return Math.max(0, Math.round(itemAmounts));
};

const isRequestActiveForLimit = (request: AdvanceRequest): boolean =>
    request.status === 'requested' || request.status === 'approved' || request.status === 'paid';

const requestOverlapsPeriod = (request: AdvanceRequest, periodStart: string, periodEnd: string): boolean => {
    const requestYearMonth = normalizeText(request.yearMonth);
    const start = normalizeText(request.periodStart) || (isValidYearMonth(requestYearMonth) ? `${requestYearMonth}-01` : '');
    const end = normalizeText(request.periodEnd) || getMonthEnd(requestYearMonth);
    if (!start || !end) return false;
    return end >= periodStart && start <= periodEnd;
};

const formatCreatedAt = (request: AdvanceRequest): string => {
    const createdAtMillis = toDateMillis(request.createdAt);
    return createdAtMillis ? formatDate(new Date(createdAtMillis)) : '-';
};

const emptySummary: EarnedSummary = {
    currentMonthEarned: 0,
    previousMonthEarned: 0,
    earnedAmount: 0,
    existingAdvanceAmount: 0,
    activeRequestAmount: 0,
    availableAmount: 0,
    workRows: [],
};

export default function WorkerAdvanceRequestPage() {
    const { currentUser } = useAuth();
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [profile, setProfile] = useState<UserData | null>(null);
    const [selectedWorkerId, setSelectedWorkerId] = useState('');
    const [selectedYearMonth, setSelectedYearMonth] = useState(() => getYearMonth());
    const [workerSearch, setWorkerSearch] = useState('');
    const [requests, setRequests] = useState<AdvanceRequest[]>([]);
    const [summary, setSummary] = useState<EarnedSummary>(emptySummary);
    const [loading, setLoading] = useState(true);
    const [summaryLoading, setSummaryLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [amountInput, setAmountInput] = useState('');
    const [memo, setMemo] = useState('');
    const [message, setMessage] = useState('');

    const previousYearMonth = useMemo(() => shiftYearMonth(selectedYearMonth, -1), [selectedYearMonth]);
    const periodStart = useMemo(() => getMonthStart(previousYearMonth), [previousYearMonth]);
    const periodEnd = useMemo(() => getMonthEnd(selectedYearMonth), [selectedYearMonth]);

    const activeWorkers = useMemo(
        () =>
            workers
                .filter((worker) => worker.id && !isInactiveWorker(worker))
                .sort((left, right) => {
                    const teamDiff = normalizeText(left.teamName).localeCompare(normalizeText(right.teamName), 'ko');
                    return teamDiff || normalizeText(left.name).localeCompare(normalizeText(right.name), 'ko');
                }),
        [workers]
    );

    const linkedWorkerCandidates = useMemo(
        () => getLinkedWorkerCandidates(
            activeWorkers,
            currentUser?.uid,
            currentUser?.email,
            currentUser?.displayName,
            profile
        ),
        [activeWorkers, currentUser?.displayName, currentUser?.email, currentUser?.uid, profile]
    );

    const workerPool = linkedWorkerCandidates.length > 0 ? linkedWorkerCandidates : activeWorkers;

    const filteredWorkers = useMemo(() => {
        const term = normalizeKey(workerSearch);
        return workerPool
            .filter((worker) => {
                if (!term) return true;
                return normalizeKey(`${worker.name} ${worker.teamName || ''} ${worker.role || ''}`).includes(term);
            })
            .slice(0, 80);
    }, [workerPool, workerSearch]);

    const selectedWorker = useMemo(
        () => activeWorkers.find((worker) => worker.id === selectedWorkerId) || null,
        [activeWorkers, selectedWorkerId]
    );

    const selectedWorkerRequests = useMemo(() => {
        if (!selectedWorker) return [];
        return requests
            .filter((request) => matchesWorker(selectedWorker, request))
            .sort((left, right) => toDateMillis(right.createdAt) - toDateMillis(left.createdAt));
    }, [requests, selectedWorker]);

    const requestedAmount = useMemo(() => parseAmountInput(amountInput), [amountInput]);
    const canSubmit = Boolean(selectedWorker?.id && requestedAmount > 0 && requestedAmount <= summary.availableAmount && !saving && !summaryLoading);

    const loadBaseData = useCallback(async () => {
        setLoading(true);
        setMessage('');
        try {
            const [workerRows, profileRow] = await Promise.all([
                manpowerService.getWorkers(true),
                currentUser?.uid ? userService.getUser(currentUser.uid) : Promise.resolve(null),
            ]);
            setWorkers(workerRows);
            setProfile(profileRow);
        } catch (error) {
            console.error('[WorkerAdvanceRequestPage] Failed to load base data', error);
            setMessage('작업자 정보를 불러오지 못했습니다.');
        } finally {
            setLoading(false);
        }
    }, [currentUser?.uid]);

    useEffect(() => {
        loadBaseData();
    }, [loadBaseData]);

    useEffect(() => {
        if (selectedWorkerId) return;
        const firstLinked = linkedWorkerCandidates.find((worker) => worker.id);
        if (firstLinked?.id) {
            setSelectedWorkerId(firstLinked.id);
        }
    }, [linkedWorkerCandidates, selectedWorkerId]);

    const loadWorkerSummary = useCallback(async () => {
        if (!selectedWorker?.id) {
            setSummary(emptySummary);
            setRequests([]);
            return;
        }

        setSummaryLoading(true);
        setMessage('');
        try {
            const workerKeys = getWorkerKeys(selectedWorker);
            const [workRows, currentAdvancePayments, previousAdvancePayments, requestRows] = await Promise.all([
                dailyReportService.getWorkerRows({ startDate: periodStart, endDate: periodEnd }),
                advancePaymentService.getAdvancePaymentsByYearMonth(
                    Number(selectedYearMonth.slice(0, 4)),
                    Number(selectedYearMonth.slice(5, 7))
                ),
                advancePaymentService.getAdvancePaymentsByYearMonth(
                    Number(previousYearMonth.slice(0, 4)),
                    Number(previousYearMonth.slice(5, 7))
                ),
                advanceRequestService.listForWorkerIds(workerKeys, currentUser?.uid),
            ]);

            const matchedWorkRows = workRows.filter((row) => matchesWorker(selectedWorker, row));
            const currentMonthEarned = matchedWorkRows
                .filter((row) => normalizeText(row.date).startsWith(selectedYearMonth))
                .reduce((sum, row) => sum + Math.max(0, Number(row.amount) || 0), 0);
            const previousMonthEarned = matchedWorkRows
                .filter((row) => normalizeText(row.date).startsWith(previousYearMonth))
                .reduce((sum, row) => sum + Math.max(0, Number(row.amount) || 0), 0);

            const matchedAdvancePayments = [...currentAdvancePayments, ...previousAdvancePayments]
                .filter((advance) => matchesWorker(selectedWorker, advance));
            const existingAdvanceAmount = matchedAdvancePayments.reduce(
                (sum, advance) => sum + getAdvanceCashAmount(advance),
                0
            );

            const activeRequestAmount = requestRows
                .filter((request) => matchesWorker(selectedWorker, request))
                .filter(isRequestActiveForLimit)
                .filter((request) => requestOverlapsPeriod(request, periodStart, periodEnd))
                .reduce((sum, request) => sum + Math.max(0, Number(request.requestedAmount) || 0), 0);

            const earnedAmount = currentMonthEarned + previousMonthEarned;
            const availableAmount = Math.max(0, earnedAmount - existingAdvanceAmount - activeRequestAmount);

            setRequests(requestRows);
            setSummary({
                currentMonthEarned,
                previousMonthEarned,
                earnedAmount,
                existingAdvanceAmount,
                activeRequestAmount,
                availableAmount,
                workRows: matchedWorkRows,
            });
            setAmountInput((prev) => {
                const currentAmount = parseAmountInput(prev);
                return currentAmount > availableAmount ? formatAmountInput(availableAmount) : prev;
            });
        } catch (error) {
            console.error('[WorkerAdvanceRequestPage] Failed to load summary', error);
            setSummary(emptySummary);
            setMessage('근무 금액과 신청 내역을 계산하지 못했습니다.');
        } finally {
            setSummaryLoading(false);
        }
    }, [currentUser?.uid, periodEnd, periodStart, previousYearMonth, selectedWorker, selectedYearMonth]);

    useEffect(() => {
        loadWorkerSummary();
    }, [loadWorkerSummary]);

    const handleAmountChange = (value: string) => {
        const nextAmount = parseAmountInput(value);
        setAmountInput(nextAmount > 0 ? formatAmountInput(nextAmount) : '');
    };

    const setQuickAmount = (amount: number) => {
        const nextAmount = Math.min(Math.max(0, Math.round(amount)), summary.availableAmount);
        setAmountInput(formatAmountInput(nextAmount));
    };

    const handleSubmit = async () => {
        if (!selectedWorker?.id) {
            setMessage('작업자를 선택해주세요.');
            return;
        }
        if (requestedAmount <= 0) {
            setMessage('신청 금액을 입력해주세요.');
            return;
        }
        if (requestedAmount > summary.availableAmount) {
            setMessage('신청 가능액을 초과했습니다.');
            return;
        }

        setSaving(true);
        setMessage('');
        try {
            const requesterName =
                profile?.displayName ||
                currentUser?.displayName ||
                currentUser?.email ||
                selectedWorker.name;

            await advanceRequestService.createRequest({
                workerId: selectedWorker.id,
                workerName: selectedWorker.name,
                teamId: normalizeText(selectedWorker.teamId),
                teamName: normalizeText(selectedWorker.teamName),
                requesterUid: currentUser?.uid || '',
                requesterName,
                requesterEmail: currentUser?.email || profile?.email || '',
                yearMonth: selectedYearMonth,
                periodStart,
                periodEnd,
                currentMonthEarned: summary.currentMonthEarned,
                previousMonthEarned: summary.previousMonthEarned,
                earnedAmountSnapshot: summary.earnedAmount,
                existingAdvanceAmountSnapshot: summary.existingAdvanceAmount,
                activeRequestAmountSnapshot: summary.activeRequestAmount,
                availableAmountSnapshot: summary.availableAmount,
                requestedAmount,
                bankName: normalizeText(selectedWorker.bankName),
                accountNumber: normalizeText(selectedWorker.accountNumber),
                accountHolder: normalizeText(selectedWorker.accountHolder || selectedWorker.name),
                memo,
            });

            setAmountInput('');
            setMemo('');
            setMessage('가불 신청을 등록했습니다.');
            await loadWorkerSummary();
        } catch (error) {
            console.error('[WorkerAdvanceRequestPage] Failed to submit request', error);
            setMessage(error instanceof Error && error.message === 'requested-amount-exceeds-available'
                ? '신청 가능액을 초과했습니다.'
                : '가불 신청 저장에 실패했습니다.');
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = async (request: AdvanceRequest) => {
        if (!request.id) return;
        const ok = window.confirm(`${formatCurrency(request.requestedAmount)} 신청을 취소할까요?`);
        if (!ok) return;

        setSaving(true);
        setMessage('');
        try {
            await advanceRequestService.cancelRequest(request.id, currentUser?.uid);
            setMessage('신청을 취소했습니다.');
            await loadWorkerSummary();
        } catch (error) {
            console.error('[WorkerAdvanceRequestPage] Failed to cancel request', error);
            setMessage('신청 취소에 실패했습니다.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="min-h-full bg-slate-100 text-slate-900">
            <header className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div>
                        <div className="flex items-center gap-2 text-xs font-bold uppercase text-slate-500">
                            <WalletCards size={14} />
                            급여관리
                        </div>
                        <h1 className="mt-1 text-2xl font-black text-slate-950">가불 신청</h1>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <label className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3">
                            <CalendarDays size={16} className="text-slate-500" />
                            <input
                                type="month"
                                value={selectedYearMonth}
                                onChange={(event) => setSelectedYearMonth(event.target.value || getYearMonth())}
                                className="bg-transparent text-sm font-bold text-slate-800 outline-none"
                            />
                        </label>
                        <button
                            type="button"
                            onClick={() => {
                                loadBaseData();
                                loadWorkerSummary();
                            }}
                            disabled={loading || summaryLoading}
                            className="flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-950 px-3 text-sm font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                        >
                            <RefreshCw size={16} />
                            새로고침
                        </button>
                    </div>
                </div>
            </header>

            <main className="grid min-h-[calc(100vh-73px)] grid-cols-1 gap-4 p-4 xl:grid-cols-[380px_minmax(0,1fr)]">
                <aside className="min-h-0 rounded-lg border border-slate-200 bg-white">
                    <div className="border-b border-slate-200 p-4">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <div className="text-xs font-black text-slate-500">작업자</div>
                                <div className="mt-1 text-lg font-black text-slate-950">
                                    {selectedWorker?.name || '미선택'}
                                </div>
                            </div>
                            {linkedWorkerCandidates.length > 0 ? (
                                <span className="rounded-md border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700">
                                    계정 연결
                                </span>
                            ) : (
                                <span className="rounded-md border border-amber-100 bg-amber-50 px-2.5 py-1 text-xs font-black text-amber-700">
                                    직접 선택
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="p-4">
                        {workerPool.length > 1 || linkedWorkerCandidates.length === 0 ? (
                            <>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                    <input
                                        value={workerSearch}
                                        onChange={(event) => setWorkerSearch(event.target.value)}
                                        placeholder="이름, 팀, 직무 검색"
                                        className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm font-semibold outline-none focus:border-blue-400 focus:bg-white"
                                    />
                                </div>

                                <div className="mt-3 max-h-[52vh] overflow-y-auto rounded-lg border border-slate-200">
                                    {loading ? (
                                        <div className="p-6 text-center text-sm font-bold text-slate-400">불러오는 중</div>
                                    ) : filteredWorkers.length === 0 ? (
                                        <div className="p-6 text-center text-sm font-bold text-slate-400">작업자 없음</div>
                                    ) : (
                                        filteredWorkers.map((worker) => (
                                            <button
                                                key={worker.id}
                                                type="button"
                                                onClick={() => setSelectedWorkerId(worker.id || '')}
                                                className={`flex w-full items-center gap-3 border-b border-slate-100 px-3 py-3 text-left last:border-b-0 hover:bg-slate-50 ${
                                                    selectedWorkerId === worker.id ? 'bg-blue-50' : 'bg-white'
                                                }`}
                                            >
                                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                                                    <UserRound size={17} />
                                                </span>
                                                <span className="min-w-0 flex-1">
                                                    <span className="block truncate text-sm font-black text-slate-900">{worker.name}</span>
                                                    <span className="block truncate text-xs font-bold text-slate-500">
                                                        {worker.teamName || '팀 미배정'} · {worker.role || '직무 미입력'}
                                                    </span>
                                                </span>
                                            </button>
                                        ))
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-bold text-slate-600">
                                연결된 작업자 정보로 신청합니다.
                            </div>
                        )}

                        {message ? (
                            <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-800">
                                {message}
                            </div>
                        ) : null}
                    </div>
                </aside>

                <div className="grid min-h-0 grid-cols-1 gap-4 2xl:grid-cols-[minmax(0,1fr)_420px]">
                    <section className="min-h-0 rounded-lg border border-slate-200 bg-white">
                        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <div className="flex items-center gap-2 text-xs font-black text-slate-500">
                                    <CalendarDays size={14} />
                                    {previousYearMonth} + {selectedYearMonth}
                                </div>
                                <h2 className="mt-1 text-lg font-black text-slate-950">신청 가능액</h2>
                            </div>
                            <div className="flex h-10 items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-3 text-sm font-black text-emerald-700">
                                <CheckCircle2 size={16} />
                                {summaryLoading ? '계산 중' : formatCurrency(summary.availableAmount)}
                            </div>
                        </div>

                        <div className="p-4">
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                                <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                                    <div className="flex items-center gap-2 text-xs font-black text-slate-500">
                                        <CalendarDays size={14} />
                                        전달 근무금액
                                    </div>
                                    <div className="mt-2 text-xl font-black text-slate-950">{formatCurrency(summary.previousMonthEarned)}</div>
                                </div>
                                <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                                    <div className="flex items-center gap-2 text-xs font-black text-slate-500">
                                        <CalendarDays size={14} />
                                        이달 근무금액
                                    </div>
                                    <div className="mt-2 text-xl font-black text-slate-950">{formatCurrency(summary.currentMonthEarned)}</div>
                                </div>
                                <div className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-3">
                                    <div className="flex items-center gap-2 text-xs font-black text-amber-700">
                                        <Banknote size={14} />
                                        기존 가불/신청
                                    </div>
                                    <div className="mt-2 text-xl font-black text-amber-800">
                                        {formatCurrency(summary.existingAdvanceAmount + summary.activeRequestAmount)}
                                    </div>
                                </div>
                                <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3">
                                    <div className="flex items-center gap-2 text-xs font-black text-emerald-700">
                                        <WalletCards size={14} />
                                        신청 가능액
                                    </div>
                                    <div className="mt-2 text-xl font-black text-emerald-800">{formatCurrency(summary.availableAmount)}</div>
                                </div>
                            </div>

                            <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
                                <div className="rounded-lg border border-slate-200">
                                    <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                                        <div className="flex items-center gap-2 text-sm font-black text-slate-800">
                                            <ClipboardList size={16} />
                                            근무 내역
                                        </div>
                                        <span className="text-xs font-bold text-slate-500">{summary.workRows.length}건</span>
                                    </div>
                                    <div className="max-h-[360px] overflow-auto">
                                        <table className="w-full min-w-[720px] text-sm">
                                            <thead className="sticky top-0 bg-slate-50 text-xs font-black text-slate-500">
                                                <tr>
                                                    <th className="px-4 py-2 text-left">일자</th>
                                                    <th className="px-4 py-2 text-left">현장</th>
                                                    <th className="px-4 py-2 text-right">공수</th>
                                                    <th className="px-4 py-2 text-right">단가</th>
                                                    <th className="px-4 py-2 text-right">금액</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {summaryLoading ? (
                                                    <tr>
                                                        <td colSpan={5} className="px-4 py-10 text-center text-sm font-bold text-slate-400">
                                                            계산 중
                                                        </td>
                                                    </tr>
                                                ) : summary.workRows.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={5} className="px-4 py-10 text-center text-sm font-bold text-slate-400">
                                                            근무 내역 없음
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    summary.workRows.map((row) => (
                                                        <tr key={`${row.reportId}-${row.workerIndex ?? row.workerId}`} className="hover:bg-slate-50">
                                                            <td className="px-4 py-2 font-bold text-slate-700">{formatDate(row.date)}</td>
                                                            <td className="px-4 py-2 text-slate-600">{row.siteName || '-'}</td>
                                                            <td className="px-4 py-2 text-right font-mono text-slate-700">{Number(row.manDay || 0).toFixed(1)}</td>
                                                            <td className="px-4 py-2 text-right font-mono text-slate-700">{formatCurrency(Number(row.unitPrice || 0))}</td>
                                                            <td className="px-4 py-2 text-right font-mono font-black text-slate-900">{formatCurrency(Number(row.amount || 0))}</td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                <div className="rounded-lg border border-slate-200 p-4">
                                    <div className="flex items-center gap-2 text-sm font-black text-slate-800">
                                        <Send size={16} />
                                        신청 입력
                                    </div>

                                    <label className="mt-4 block">
                                        <span className="mb-2 block text-xs font-black text-slate-500">신청 금액</span>
                                        <div className="flex h-12 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 focus-within:border-blue-400 focus-within:bg-white">
                                            <input
                                                value={amountInput}
                                                onChange={(event) => handleAmountChange(event.target.value)}
                                                inputMode="numeric"
                                                placeholder="0"
                                                className="min-w-0 flex-1 bg-transparent text-right text-xl font-black text-slate-950 outline-none"
                                            />
                                            <span className="ml-2 text-sm font-black text-slate-500">원</span>
                                        </div>
                                    </label>

                                    <div className="mt-2 grid grid-cols-4 gap-2">
                                        {[100000, 300000, 500000].map((amount) => (
                                            <button
                                                key={amount}
                                                type="button"
                                                onClick={() => setQuickAmount(amount)}
                                                disabled={summary.availableAmount <= 0}
                                                className="h-9 rounded-md border border-slate-200 bg-white text-xs font-black text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                                            >
                                                {currencyFormatter.format(amount / 10000)}만
                                            </button>
                                        ))}
                                        <button
                                            type="button"
                                            onClick={() => setQuickAmount(summary.availableAmount)}
                                            disabled={summary.availableAmount <= 0}
                                            className="h-9 rounded-md border border-slate-900 bg-slate-950 text-xs font-black text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-300"
                                        >
                                            최대
                                        </button>
                                    </div>

                                    <label className="mt-4 block">
                                        <span className="mb-2 block text-xs font-black text-slate-500">입금 계좌</span>
                                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700">
                                            {selectedWorker?.bankName || '-'} · {selectedWorker?.accountNumber || '계좌 미입력'}
                                            <div className="mt-1 text-xs font-bold text-slate-500">
                                                예금주 {selectedWorker?.accountHolder || selectedWorker?.name || '-'}
                                            </div>
                                        </div>
                                    </label>

                                    <label className="mt-4 block">
                                        <span className="mb-2 block text-xs font-black text-slate-500">메모</span>
                                        <textarea
                                            value={memo}
                                            onChange={(event) => setMemo(event.target.value)}
                                            placeholder="필요 시 입력"
                                            className="min-h-[88px] w-full resize-y rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold outline-none focus:border-blue-400 focus:bg-white"
                                        />
                                    </label>

                                    {requestedAmount > summary.availableAmount ? (
                                        <div className="mt-3 flex items-start gap-2 rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
                                            <AlertCircle size={14} className="mt-0.5 shrink-0" />
                                            신청 가능액을 초과했습니다.
                                        </div>
                                    ) : null}

                                    <button
                                        type="button"
                                        onClick={handleSubmit}
                                        disabled={!canSubmit}
                                        className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-black text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                                    >
                                        <Send size={16} />
                                        {saving ? '저장 중' : '가불 신청'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="min-h-0 rounded-lg border border-slate-200 bg-white">
                        <div className="flex items-center justify-between border-b border-slate-200 p-4">
                            <div>
                                <div className="flex items-center gap-2 text-xs font-black text-slate-500">
                                    <ClipboardList size={14} />
                                    신청 내역
                                </div>
                                <h2 className="mt-1 text-lg font-black text-slate-950">{selectedWorker?.name || '작업자'}</h2>
                            </div>
                            <span className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-black text-slate-600">
                                {selectedWorkerRequests.length}건
                            </span>
                        </div>

                        <div className="max-h-[calc(100vh-170px)] overflow-y-auto p-4">
                            {summaryLoading ? (
                                <div className="grid min-h-[240px] place-items-center text-sm font-bold text-slate-400">
                                    불러오는 중
                                </div>
                            ) : selectedWorkerRequests.length === 0 ? (
                                <div className="grid min-h-[240px] place-items-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-sm font-bold text-slate-400">
                                    신청 내역 없음
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {selectedWorkerRequests.map((request) => (
                                        <article key={request.id} className="rounded-lg border border-slate-200 bg-white p-4">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <div className="text-lg font-black text-slate-950">{formatCurrency(request.requestedAmount)}</div>
                                                    <div className="mt-1 text-xs font-bold text-slate-500">
                                                        {request.periodStart} ~ {request.periodEnd}
                                                    </div>
                                                </div>
                                                <span className={`shrink-0 rounded-md border px-2.5 py-1 text-xs font-black ${statusClassNames[request.status]}`}>
                                                    {statusLabels[request.status]}
                                                </span>
                                            </div>

                                            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                                                <div className="rounded-md bg-slate-50 px-2 py-2">
                                                    <div className="font-black text-slate-500">신청일</div>
                                                    <div className="mt-1 font-bold text-slate-800">
                                                        {formatCreatedAt(request)}
                                                    </div>
                                                </div>
                                                <div className="rounded-md bg-slate-50 px-2 py-2">
                                                    <div className="font-black text-slate-500">당시 가능액</div>
                                                    <div className="mt-1 font-bold text-slate-800">{formatCurrency(request.availableAmountSnapshot)}</div>
                                                </div>
                                            </div>

                                            {request.memo ? (
                                                <div className="mt-3 whitespace-pre-line rounded-md bg-slate-50 px-3 py-2 text-xs font-semibold leading-5 text-slate-700">
                                                    {request.memo}
                                                </div>
                                            ) : null}

                                            {request.status === 'requested' ? (
                                                <div className="mt-4 flex justify-end border-t border-slate-100 pt-3">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleCancel(request)}
                                                        disabled={saving}
                                                        className="flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-black text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:text-slate-300"
                                                    >
                                                        <XCircle size={14} />
                                                        신청 취소
                                                    </button>
                                                </div>
                                            ) : null}
                                        </article>
                                    ))}
                                </div>
                            )}
                        </div>
                    </section>
                </div>
            </main>
        </div>
    );
}
