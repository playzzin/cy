import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    ArrowLeft,
    CalendarDays,
    Check,
    ChevronLeft,
    ChevronRight,
    ClipboardList,
    RefreshCw,
    Save,
    Search,
    UserCheck,
    UserX,
    XCircle,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
    fieldScheduleRequestService,
    FieldScheduleRequest,
    isOffDutyOnlyFieldScheduleRequest,
} from '../../services/fieldScheduleRequestService';
import { manpowerService, Worker } from '../../services/manpowerService';
import { userService, UserData } from '../../services/userService';

const REQUEST_RANGE_DAYS = 30;
const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
type RequestPageTab = 'register' | 'month-list';

const getTodayInputValue = () => {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
};

const shiftDate = (date: string, amount: number) => {
    const next = new Date(`${date}T00:00:00`);
    next.setDate(next.getDate() + amount);
    const local = new Date(next.getTime() - next.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
};

const getWeekday = (date: string) => new Date(`${date}T00:00:00`).getDay();

const formatDate = (date: string) =>
    new Date(`${date}T00:00:00`).toLocaleDateString('ko-KR', {
        month: '2-digit',
        day: '2-digit',
        weekday: 'short',
    });

const formatFullDate = (date: string) =>
    new Date(`${date}T00:00:00`).toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        weekday: 'short',
    });

const getMonthStart = (date: string) => `${date.slice(0, 7)}-01`;

const toInputDateValue = (date: Date) => {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
};

const shiftMonth = (monthStart: string, amount: number) => {
    const next = new Date(`${monthStart}T00:00:00`);
    next.setDate(1);
    next.setMonth(next.getMonth() + amount);
    return toInputDateValue(next);
};

const getMonthEnd = (monthStart: string) => {
    const date = new Date(`${monthStart}T00:00:00`);
    return toInputDateValue(new Date(date.getFullYear(), date.getMonth() + 1, 0));
};

const getCalendarDates = (monthStart: string) => {
    const start = new Date(`${monthStart}T00:00:00`);
    const firstWeekday = start.getDay();
    const gridStart = new Date(start);
    gridStart.setDate(1 - firstWeekday);

    return Array.from({ length: 42 }, (_, index) => {
        const date = new Date(gridStart);
        date.setDate(gridStart.getDate() + index);
        return toInputDateValue(date);
    });
};

const formatMonthTitle = (monthStart: string) =>
    new Date(`${monthStart}T00:00:00`).toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
    });

const normalizeText = (value: unknown) => String(value ?? '').trim();
const normalizeKey = (value: unknown) => normalizeText(value).toLowerCase().replace(/\s+/g, '');

const cleanList = (values: unknown[]) =>
    Array.from(new Set(values.map(normalizeText).filter(Boolean)));

const parseLinkedIds = (raw: unknown): string[] => {
    if (Array.isArray(raw)) return cleanList(raw);
    const text = normalizeText(raw);
    if (!text) return [];
    try {
        const parsed = JSON.parse(text);
        return Array.isArray(parsed) ? cleanList(parsed) : [text];
    } catch {
        return [text];
    }
};

const isInactiveWorker = (worker: Worker) => {
    const status = normalizeText(worker.status);
    return worker.isActive === false || status.includes('퇴사');
};

const sameText = (left?: unknown, right?: unknown) =>
    normalizeKey(left) === normalizeKey(right);

const getWorkerKeys = (worker: Worker) => cleanList([worker.id, worker.legacyId]);

const getLinkedWorkerCandidates = (
    workers: Worker[],
    currentUserUid?: string,
    currentUserEmail?: string | null,
    currentUserDisplayName?: string | null,
    profile?: UserData | null
) => {
    const uid = normalizeText(currentUserUid);
    const email = normalizeText(currentUserEmail || profile?.email);
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

    const displayName = normalizeText(currentUserDisplayName || profile?.displayName);
    if (!displayName) return [];
    return workers.filter((worker) => sameText(worker.name, displayName));
};

const sortDates = (dates: string[]) =>
    cleanList(dates).sort((left, right) => left.localeCompare(right));

export default function WorkerOffDutyRequestPage() {
    const { currentUser } = useAuth();
    const [baseDate] = useState(getTodayInputValue);
    const minDate = useMemo(() => shiftDate(baseDate, 1), [baseDate]);
    const maxDate = useMemo(() => shiftDate(baseDate, REQUEST_RANGE_DAYS), [baseDate]);

    const [workers, setWorkers] = useState<Worker[]>([]);
    const [requests, setRequests] = useState<FieldScheduleRequest[]>([]);
    const [profile, setProfile] = useState<UserData | null>(null);
    const [selectedWorkerId, setSelectedWorkerId] = useState('');
    const [selectedDates, setSelectedDates] = useState<string[]>([minDate]);
    const [calendarMonth, setCalendarMonth] = useState(() => getMonthStart(minDate));
    const [workerSearch, setWorkerSearch] = useState('');
    const [reason, setReason] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [activeTab, setActiveTab] = useState<RequestPageTab>('register');

    const loadRequests = useCallback(async () => {
        const rows = await fieldScheduleRequestService.listByDateRange(minDate, maxDate);
        setRequests(rows);
    }, [maxDate, minDate]);

    const loadData = useCallback(async () => {
        setLoading(true);
        setMessage('');
        try {
            const [workerRows, profileRow, requestRows] = await Promise.all([
                manpowerService.getWorkers(true),
                currentUser?.uid ? userService.getUser(currentUser.uid) : Promise.resolve(null),
                fieldScheduleRequestService.listByDateRange(minDate, maxDate),
            ]);
            setWorkers(workerRows);
            setProfile(profileRow);
            setRequests(requestRows);
        } catch (error) {
            console.error('[WorkerOffDutyRequestPage] Failed to load data', error);
            setMessage('데이터를 불러오지 못했습니다.');
        } finally {
            setLoading(false);
        }
    }, [currentUser?.uid, maxDate, minDate]);

    useEffect(() => {
        loadData();
    }, [loadData]);

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

    useEffect(() => {
        if (selectedWorkerId) return;
        const firstLinked = linkedWorkerCandidates.find((worker) => worker.id);
        if (firstLinked?.id) {
            setSelectedWorkerId(firstLinked.id);
        }
    }, [linkedWorkerCandidates, selectedWorkerId]);

    const selectedWorker = useMemo(
        () => activeWorkers.find((worker) => worker.id === selectedWorkerId),
        [activeWorkers, selectedWorkerId]
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

    const offDutyRequests = useMemo(
        () => requests.filter((request) => request.status !== 'cancelled' && isOffDutyOnlyFieldScheduleRequest(request)),
        [requests]
    );

    const myRequestRows = useMemo(() => {
        if (!selectedWorkerId) return [];
        return offDutyRequests
            .filter((request) => request.offDutyWorkerIds.includes(selectedWorkerId))
            .sort((left, right) => left.date.localeCompare(right.date));
    }, [offDutyRequests, selectedWorkerId]);

    const myRequestDateSet = useMemo(
        () => new Set(myRequestRows.map((request) => request.date)),
        [myRequestRows]
    );
    const myRequestByDate = useMemo(
        () => new Map(myRequestRows.map((request) => [request.date, request])),
        [myRequestRows]
    );

    const selectedDateSet = useMemo(() => new Set(selectedDates), [selectedDates]);
    const calendarDates = useMemo(() => getCalendarDates(calendarMonth), [calendarMonth]);
    const canMovePrevMonth = useMemo(() => getMonthEnd(shiftMonth(calendarMonth, -1)) >= minDate, [calendarMonth, minDate]);
    const canMoveNextMonth = useMemo(() => shiftMonth(calendarMonth, 1) <= maxDate, [calendarMonth, maxDate]);
    const canSave = Boolean(selectedWorker?.id && selectedDates.length > 0 && !saving && !loading);

    const toggleDate = (date: string) => {
        setSelectedDates((prev) => {
            const next = prev.includes(date)
                ? prev.filter((item) => item !== date)
                : [...prev, date];
            return sortDates(next);
        });
    };

    const handleSave = async () => {
        if (!selectedWorker?.id) {
            setMessage('작업자를 선택해주세요.');
            return;
        }

        const datesToSave = selectedDates.filter((date) => date >= minDate);
        if (datesToSave.length === 0) {
            setMessage('신청할 날짜를 선택해주세요.');
            return;
        }

        setSaving(true);
        setMessage('');
        try {
            const requestedByName =
                currentUser?.displayName ||
                currentUser?.email ||
                profile?.displayName ||
                selectedWorker.name;

            await Promise.all(datesToSave.map((date) =>
                fieldScheduleRequestService.addOffDutyWorkers({
                    date,
                    workers: [{ id: selectedWorker.id!, name: selectedWorker.name }],
                    requestedById: currentUser?.uid || '',
                    requestedByName,
                    memo: reason,
                })
            ));

            await loadRequests();
            setSelectedDates([]);
            setReason('');
            setMessage(`휴무 신청 ${datesToSave.length}건을 등록했습니다.`);
        } catch (error) {
            console.error('[WorkerOffDutyRequestPage] Failed to save off-duty request', error);
            setMessage('휴무 신청 저장에 실패했습니다.');
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = async (request: FieldScheduleRequest) => {
        if (!selectedWorker?.id) return;
        const ok = window.confirm(`${formatFullDate(request.date)} 휴무 신청을 취소할까요?`);
        if (!ok) return;

        setSaving(true);
        setMessage('');
        try {
            await fieldScheduleRequestService.removeOffDutyWorker({
                date: request.date,
                workerId: selectedWorker.id,
                workerName: selectedWorker.name,
            });
            await loadRequests();
            setMessage(`${formatDate(request.date)} 휴무 신청을 취소했습니다.`);
        } catch (error) {
            console.error('[WorkerOffDutyRequestPage] Failed to cancel off-duty request', error);
            setMessage('휴무 신청 취소에 실패했습니다.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="min-h-full bg-slate-100 text-slate-900">
            <header className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div>
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                            <UserX size={14} />
                            작업자 휴무
                        </div>
                        <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950">휴무신청</h1>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <Link
                            to="/assignment/field-request"
                            className="flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
                        >
                            <ArrowLeft size={16} />
                            인원 요청
                        </Link>
                        <button
                            type="button"
                            onClick={loadData}
                            disabled={loading}
                            className="flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-950 px-3 text-sm font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                        >
                            <RefreshCw size={16} />
                            새로고침
                        </button>
                    </div>
                </div>
            </header>

            <div className="border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={() => setActiveTab('register')}
                        className={`flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-black transition ${
                            activeTab === 'register'
                                ? 'bg-slate-950 text-white shadow-sm'
                                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                    >
                        <Save size={16} />
                        등록
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('month-list')}
                        className={`flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-black transition ${
                            activeTab === 'month-list'
                                ? 'bg-slate-950 text-white shadow-sm'
                                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                    >
                        <ClipboardList size={16} />
                        한달 요청목록
                    </button>
                </div>
            </div>

            {activeTab === 'register' ? (
            <main className="grid min-h-[calc(100vh-202px)] grid-cols-1 gap-4 p-4 lg:grid-cols-[420px_minmax(0,1fr)]">
                <aside className="flex min-h-0 flex-col rounded-lg border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-200 p-4">
                        <div className="grid grid-cols-3 gap-2">
                            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                <div className="text-[11px] font-black text-slate-500">작업자</div>
                                <div className="mt-1 truncate text-sm font-black text-slate-950">{selectedWorker?.name || '미선택'}</div>
                            </div>
                            <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
                                <div className="text-[11px] font-black text-blue-600">선택</div>
                                <div className="mt-1 text-xl font-black text-blue-800">{selectedDates.length}</div>
                            </div>
                            <div className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2">
                                <div className="text-[11px] font-black text-rose-600">등록</div>
                                <div className="mt-1 text-xl font-black text-rose-800">{myRequestRows.length}</div>
                            </div>
                        </div>

                        {message ? (
                            <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-800">
                                {message}
                            </div>
                        ) : null}
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto p-4">
                        <div className="space-y-4">
                            <section>
                                <div className="mb-2 flex items-center justify-between gap-2">
                                    <div className="text-xs font-black text-slate-500">신청 작업자</div>
                                    {linkedWorkerCandidates.length > 0 ? (
                                        <span className="rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-black text-emerald-700">
                                            계정 연결됨
                                        </span>
                                    ) : null}
                                </div>

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
                                        <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-slate-200">
                                            {filteredWorkers.map((worker) => {
                                                const selected = worker.id === selectedWorkerId;
                                                return (
                                                    <button
                                                        key={worker.id || worker.name}
                                                        type="button"
                                                        onClick={() => worker.id && setSelectedWorkerId(worker.id)}
                                                        className={`flex w-full items-center gap-2 border-b border-slate-100 px-3 py-2 text-left last:border-b-0 hover:bg-blue-50 ${
                                                            selected ? 'bg-blue-50' : 'bg-white'
                                                        }`}
                                                    >
                                                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                                                            <UserCheck size={16} />
                                                        </span>
                                                        <span className="min-w-0 flex-1">
                                                            <span className="block truncate text-sm font-black text-slate-900">{worker.name}</span>
                                                            <span className="block truncate text-xs font-semibold text-slate-500">
                                                                {worker.teamName || '팀 미지정'} · {worker.role || '직무 없음'}
                                                            </span>
                                                        </span>
                                                        {selected ? <Check size={16} className="text-blue-600" /> : null}
                                                    </button>
                                                );
                                            })}
                                            {filteredWorkers.length === 0 ? (
                                                <div className="px-3 py-6 text-center text-xs font-bold text-slate-400">작업자 없음</div>
                                            ) : null}
                                        </div>
                                    </>
                                ) : (
                                    <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-3">
                                        <div className="text-sm font-black text-slate-950">{selectedWorker?.name || linkedWorkerCandidates[0]?.name}</div>
                                        <div className="mt-1 text-xs font-bold text-emerald-700">
                                            {selectedWorker?.teamName || linkedWorkerCandidates[0]?.teamName || '팀 미지정'}
                                        </div>
                                    </div>
                                )}
                            </section>

                            <section>
                                <div className="mb-2 flex items-center justify-between">
                                    <div className="text-xs font-black text-slate-500">신청 날짜</div>
                                    {selectedDates.length > 0 ? (
                                        <button
                                            type="button"
                                            onClick={() => setSelectedDates([])}
                                            className="text-xs font-black text-slate-400 hover:text-slate-700"
                                        >
                                            전체 해제
                                        </button>
                                    ) : null}
                                </div>

                                <div className="rounded-lg border border-slate-200 bg-white p-3">
                                    <div className="mb-3 flex items-center justify-between gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setCalendarMonth((prev) => shiftMonth(prev, -1))}
                                            disabled={!canMovePrevMonth}
                                            aria-label="이전 달"
                                            className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                                        >
                                            <ChevronLeft size={16} />
                                        </button>
                                        <div className="text-sm font-black text-slate-900">{formatMonthTitle(calendarMonth)}</div>
                                        <button
                                            type="button"
                                            onClick={() => setCalendarMonth((prev) => shiftMonth(prev, 1))}
                                            disabled={!canMoveNextMonth}
                                            aria-label="다음 달"
                                            className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                                        >
                                            <ChevronRight size={16} />
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-7 gap-1 text-center">
                                        {WEEKDAY_LABELS.map((weekday, index) => (
                                            <div
                                                key={weekday}
                                                className={`py-1 text-[11px] font-black ${
                                                    index === 0 ? 'text-rose-500' : index === 6 ? 'text-blue-500' : 'text-slate-400'
                                                }`}
                                            >
                                                {weekday}
                                            </div>
                                        ))}
                                        {calendarDates.map((date) => {
                                            const selected = selectedDateSet.has(date);
                                            const alreadyRequested = myRequestDateSet.has(date);
                                            const weekday = getWeekday(date);
                                            const inCurrentMonth = date.startsWith(calendarMonth.slice(0, 7));
                                            const disabledDate = date < minDate || date > maxDate;
                                            const dateToneClass = selected
                                                ? 'bg-slate-900 text-white shadow-sm'
                                                : disabledDate
                                                    ? 'bg-slate-50 text-slate-300'
                                                    : alreadyRequested
                                                        ? 'bg-rose-50 text-rose-700 ring-1 ring-rose-100'
                                                        : weekday === 0
                                                            ? 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                                                            : weekday === 6
                                                                ? 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                                                                : 'bg-white text-slate-700 hover:bg-slate-100';

                                            return (
                                                <button
                                                    key={date}
                                                    type="button"
                                                    onClick={() => toggleDate(date)}
                                                    disabled={disabledDate}
                                                    aria-pressed={selected}
                                                    aria-label={`${formatFullDate(date)}${alreadyRequested ? ' 등록됨' : ''}`}
                                                    className={`relative flex aspect-square min-h-10 flex-col items-center justify-center rounded-md border text-xs font-black transition ${dateToneClass} ${
                                                        selected ? 'border-slate-900' : 'border-slate-100'
                                                    } ${inCurrentMonth ? '' : 'opacity-60'}`}
                                                >
                                                    <span>{Number(date.slice(8, 10))}</span>
                                                    {alreadyRequested ? (
                                                        <span className={`mt-0.5 h-1.5 w-1.5 rounded-full ${selected ? 'bg-white' : 'bg-rose-500'}`} />
                                                    ) : null}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-bold text-slate-500">
                                        <span className="inline-flex items-center gap-1">
                                            <span className="h-2 w-2 rounded-full bg-slate-900" />
                                            선택
                                        </span>
                                        <span className="inline-flex items-center gap-1">
                                            <span className="h-2 w-2 rounded-full bg-rose-500" />
                                            등록됨
                                        </span>
                                        <span>{formatDate(minDate)}부터 {formatDate(maxDate)}까지 신청 가능</span>
                                    </div>
                                </div>

                                {selectedDates.length > 0 ? (
                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                        {selectedDates.map((date) => (
                                            <button
                                                key={date}
                                                type="button"
                                                onClick={() => toggleDate(date)}
                                                className="rounded-md border border-blue-100 bg-blue-50 px-2 py-1 text-[11px] font-black text-blue-700 hover:bg-blue-100"
                                                title="선택 해제"
                                            >
                                                {formatDate(date)}
                                            </button>
                                        ))}
                                    </div>
                                ) : null}
                            </section>

                            <section>
                                <label>
                                    <span className="mb-2 block text-xs font-black text-slate-500">사유</span>
                                    <textarea
                                        value={reason}
                                        onChange={(event) => setReason(event.target.value)}
                                        placeholder="개인사유, 병원, 예비군 등"
                                        className="min-h-[92px] w-full resize-y rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-blue-400 focus:bg-white"
                                    />
                                </label>
                                <button
                                    type="button"
                                    onClick={handleSave}
                                    disabled={!canSave}
                                    className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 text-sm font-black text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                                >
                                    <Save size={16} />
                                    {saving ? '저장 중' : '휴무 신청 저장'}
                                </button>
                            </section>
                        </div>
                    </div>
                </aside>

                <section className="flex min-h-0 flex-col rounded-lg border border-slate-200 bg-white shadow-sm">
                    <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <div className="flex items-center gap-2 text-xs font-black text-slate-500">
                                <CalendarDays size={14} />
                                {formatDate(minDate)}부터 {REQUEST_RANGE_DAYS}일
                            </div>
                            <h2 className="mt-1 text-lg font-black text-slate-950">신청 현황</h2>
                        </div>
                        <div className="flex h-10 items-center gap-2 rounded-lg border border-rose-100 bg-rose-50 px-3 text-sm font-black text-rose-700">
                            <ClipboardList size={16} />
                            {myRequestRows.length}건
                        </div>
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto p-4">
                        {loading ? (
                            <div className="grid h-full min-h-[300px] place-items-center text-sm font-bold text-slate-400">
                                불러오는 중
                            </div>
                        ) : !selectedWorker ? (
                            <div className="grid h-full min-h-[300px] place-items-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-sm font-bold text-slate-400">
                                작업자를 선택해주세요
                            </div>
                        ) : myRequestRows.length === 0 ? (
                            <div className="grid h-full min-h-[300px] place-items-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-sm font-bold text-slate-400">
                                등록된 휴무 신청 없음
                            </div>
                        ) : (
                            <div className="grid gap-3 xl:grid-cols-2 2xl:grid-cols-3">
                                {myRequestRows.map((request) => (
                                    <article
                                        key={request.id || request.date}
                                        className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="mb-1 flex items-center gap-1.5 text-xs font-black text-rose-700">
                                                    <UserX size={14} />
                                                    휴무 등록
                                                </div>
                                                <h3 className="truncate text-base font-black text-slate-950">{formatFullDate(request.date)}</h3>
                                                <div className="mt-1 truncate text-xs font-bold text-slate-500">
                                                    {selectedWorker.teamName || '팀 미지정'} · {selectedWorker.name}
                                                </div>
                                            </div>
                                            <span className="shrink-0 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700">
                                                반영됨
                                            </span>
                                        </div>

                                        {request.memo ? (
                                            <div className="mt-3 whitespace-pre-line rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold leading-5 text-slate-700">
                                                {request.memo}
                                            </div>
                                        ) : null}

                                        <div className="mt-4 flex justify-end border-t border-slate-100 pt-3">
                                            <button
                                                type="button"
                                                onClick={() => handleCancel(request)}
                                                disabled={saving}
                                                className="flex h-8 items-center gap-1 rounded-md px-2 text-xs font-black text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:text-slate-300"
                                            >
                                                <XCircle size={14} />
                                                신청 취소
                                            </button>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        )}
                    </div>
                </section>
            </main>
            ) : (
                <main className="min-h-[calc(100vh-202px)] p-4">
                    <section className="flex min-h-[calc(100vh-234px)] flex-col rounded-lg border border-slate-200 bg-white shadow-sm">
                        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <div className="flex items-center gap-2 text-xs font-black text-slate-500">
                                    <CalendarDays size={14} />
                                    {formatDate(minDate)}부터 {formatDate(maxDate)}까지
                                </div>
                                <h2 className="mt-1 text-lg font-black text-slate-950">한달 요청목록</h2>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <div className="flex h-10 items-center gap-2 rounded-lg border border-rose-100 bg-rose-50 px-3 text-sm font-black text-rose-700">
                                    <ClipboardList size={16} />
                                    {myRequestRows.length}건
                                </div>
                                <button
                                    type="button"
                                    onClick={loadData}
                                    disabled={loading}
                                    className="flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-black text-slate-700 hover:bg-slate-50 disabled:text-slate-300"
                                >
                                    <RefreshCw size={16} />
                                    새로고침
                                </button>
                            </div>
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto p-4">
                            {loading ? (
                                <div className="grid h-full min-h-[300px] place-items-center text-sm font-bold text-slate-400">
                                    불러오는 중
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <div className="min-w-[980px]">
                                        <div className="mb-3 flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-2">
                                            <button
                                                type="button"
                                                onClick={() => setCalendarMonth((prev) => shiftMonth(prev, -1))}
                                                disabled={!canMovePrevMonth}
                                                aria-label="이전 달"
                                                className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                                            >
                                                <ChevronLeft size={16} />
                                            </button>
                                            <div className="text-sm font-black text-slate-950">{formatMonthTitle(calendarMonth)}</div>
                                            <button
                                                type="button"
                                                onClick={() => setCalendarMonth((prev) => shiftMonth(prev, 1))}
                                                disabled={!canMoveNextMonth}
                                                aria-label="다음 달"
                                                className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                                            >
                                                <ChevronRight size={16} />
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-7 gap-1 text-center">
                                            {WEEKDAY_LABELS.map((weekday, index) => (
                                                <div
                                                    key={weekday}
                                                    className={`rounded-md bg-slate-100 py-2 text-[11px] font-black ${
                                                        index === 0 ? 'text-rose-500' : index === 6 ? 'text-blue-500' : 'text-slate-500'
                                                    }`}
                                                >
                                                    {weekday}
                                                </div>
                                            ))}
                                        </div>

                                        <div className="mt-1 grid grid-cols-7 gap-1">
                                            {calendarDates.map((date) => {
                                                const request = selectedWorker ? myRequestByDate.get(date) : undefined;
                                                const selected = selectedDateSet.has(date);
                                                const inCurrentMonth = date.startsWith(calendarMonth.slice(0, 7));
                                                const disabledDate = date < minDate || date > maxDate;
                                                const weekday = getWeekday(date);
                                                return (
                                                    <div
                                                        key={date}
                                                        className={`min-h-[148px] rounded-lg border p-2 ${
                                                            disabledDate
                                                                ? 'border-slate-100 bg-slate-50 text-slate-300'
                                                                : request
                                                                    ? 'border-rose-100 bg-rose-50'
                                                                    : selected
                                                                        ? 'border-blue-100 bg-blue-50'
                                                                        : 'border-slate-100 bg-white'
                                                        } ${inCurrentMonth ? '' : 'opacity-60'}`}
                                                    >
                                                        <div className="mb-2 flex items-center justify-between">
                                                            <button
                                                                type="button"
                                                                onClick={() => !disabledDate && toggleDate(date)}
                                                                disabled={disabledDate}
                                                                className={`flex h-7 w-7 items-center justify-center rounded-md text-xs font-black ${
                                                                    selected
                                                                        ? 'bg-slate-900 text-white'
                                                                        : weekday === 0
                                                                            ? 'text-rose-600 hover:bg-rose-100'
                                                                            : weekday === 6
                                                                                ? 'text-blue-600 hover:bg-blue-100'
                                                                                : 'text-slate-700 hover:bg-slate-100'
                                                                } disabled:text-slate-300`}
                                                            >
                                                                {Number(date.slice(8, 10))}
                                                            </button>
                                                            {request ? (
                                                                <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-black text-rose-600 ring-1 ring-rose-100">
                                                                    휴무
                                                                </span>
                                                            ) : null}
                                                        </div>

                                                        {disabledDate ? null : !selectedWorker ? (
                                                            <div className="mt-8 text-center text-[11px] font-bold text-slate-300">작업자 선택 필요</div>
                                                        ) : request ? (
                                                            <div className="rounded-md border border-rose-100 bg-white px-2 py-2">
                                                                <div className="mb-1 flex items-center gap-1 text-[11px] font-black text-rose-700">
                                                                    <UserX size={12} />
                                                                    휴무 등록
                                                                </div>
                                                                <div className="truncate text-[11px] font-bold text-slate-600">
                                                                    {selectedWorker?.teamName || '팀 미지정'} · {selectedWorker?.name || ''}
                                                                </div>
                                                                {request.memo ? (
                                                                    <div className="mt-2 line-clamp-3 whitespace-pre-line rounded bg-slate-50 px-2 py-1 text-[10px] font-semibold leading-4 text-slate-600">
                                                                        {request.memo}
                                                                    </div>
                                                                ) : null}
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleCancel(request)}
                                                                    disabled={saving}
                                                                    className="mt-2 flex h-7 w-full items-center justify-center gap-1 rounded-md bg-rose-50 px-2 text-[11px] font-black text-rose-600 hover:bg-rose-100 disabled:cursor-not-allowed disabled:text-slate-300"
                                                                >
                                                                    <XCircle size={12} />
                                                                    신청 취소
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div className="mt-8 text-center text-[11px] font-bold text-slate-300">신청 없음</div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>
                </main>
            )}
        </div>
    );
}
