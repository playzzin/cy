import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    CheckCircle2,
    CircleDollarSign,
    ExternalLink,
    FileText,
    Inbox,
    RefreshCw,
    Search,
    XCircle,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
    officeRequestCenterService,
    type OfficeRequestItem,
    type OfficeRequestType,
} from '../../services/officeRequestCenterService';

type TypeFilter = OfficeRequestType | 'all';

const typeOptions: Array<{ value: TypeFilter; label: string }> = [
    { value: 'all', label: '전체' },
    { value: 'advance', label: '가불' },
    { value: 'offDuty', label: '휴무' },
    { value: 'fieldSchedule', label: '인원 요청' },
    { value: 'expense', label: '경비' },
];

const statusOptions = [
    { value: 'all', label: '전체 상태' },
    { value: 'pending', label: '미처리' },
    { value: 'requested', label: '접수' },
    { value: 'approved', label: '승인' },
    { value: 'rejected', label: '반려' },
    { value: 'paid', label: '지급완료' },
    { value: 'draft', label: '작성중' },
    { value: 'charged', label: '청구반영' },
    { value: 'settled', label: '정산완료' },
    { value: 'assigning', label: '배정중' },
    { value: 'assigned', label: '배정완료' },
    { value: 'confirmed', label: '확정' },
    { value: 'cancelled', label: '반려/취소' },
];

const statusClassName = (status: string) => {
    if (status === 'requested' || status === 'draft') return 'border-amber-200 bg-amber-50 text-amber-700';
    if (status === 'approved' || status === 'assigned' || status === 'confirmed') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    if (status === 'rejected' || status === 'cancelled') return 'border-rose-200 bg-rose-50 text-rose-700';
    if (status === 'paid' || status === 'settled' || status === 'charged') return 'border-slate-200 bg-slate-100 text-slate-700';
    return 'border-slate-200 bg-white text-slate-600';
};

const formatAmount = (value?: number) =>
    typeof value === 'number' && Number.isFinite(value) ? `${Math.round(value).toLocaleString()}원` : '-';

const getRequestMemo = (item: OfficeRequestItem): string => {
    const raw = item.raw as any;
    return String(raw.reviewMemo || raw.handleMemo || raw.memo || '').trim();
};

export default function OfficeRequestCenterPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { currentUser } = useAuth();
    const [items, setItems] = useState<OfficeRequestItem[]>([]);
    const [typeFilter, setTypeFilter] = useState<TypeFilter>(() => {
        const value = searchParams.get('type') as TypeFilter | null;
        return value && typeOptions.some((option) => option.value === value) ? value : 'all';
    });
    const [statusFilter, setStatusFilter] = useState(() => searchParams.get('status') || 'all');
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [actionId, setActionId] = useState('');
    const [message, setMessage] = useState('');

    const actor = useMemo(() => ({
        uid: currentUser?.uid,
        name: currentUser?.displayName || currentUser?.email || '사무실',
    }), [currentUser?.displayName, currentUser?.email, currentUser?.uid]);

    const loadRequests = useCallback(async () => {
        setLoading(true);
        setMessage('');
        try {
            const rows = await officeRequestCenterService.listRequests({
                type: typeFilter,
                status: statusFilter,
                search,
            });
            setItems(rows);
        } catch (error) {
            console.error('[OfficeRequestCenterPage] failed to load requests', error);
            setMessage('신청 목록을 불러오지 못했습니다.');
        } finally {
            setLoading(false);
        }
    }, [search, statusFilter, typeFilter]);

    useEffect(() => {
        void loadRequests();
    }, [loadRequests]);

    const runAdvanceAction = async (
        item: OfficeRequestItem,
        action: 'approve' | 'reject' | 'paid'
    ) => {
        const promptLabel = action === 'approve' ? '승인 메모' : action === 'reject' ? '반려 사유' : '지급 메모';
        const memo = window.prompt(`${item.title} ${promptLabel}를 입력하세요.`, '');
        if (memo === null) return;

        setActionId(`${action}:${item.requestId}`);
        setMessage('');
        try {
            if (action === 'approve') {
                await officeRequestCenterService.approveAdvanceRequest(item.requestId, { ...actor, memo });
                setMessage('가불 신청을 승인했습니다.');
            } else if (action === 'reject') {
                await officeRequestCenterService.rejectAdvanceRequest(item.requestId, { ...actor, memo });
                setMessage('가불 신청을 반려했습니다.');
            } else {
                await officeRequestCenterService.markAdvancePaid(item.requestId, { ...actor, memo });
                setMessage('가불 신청을 지급완료 처리했습니다.');
            }
            await loadRequests();
        } catch (error) {
            console.error('[OfficeRequestCenterPage] advance action failed', error);
            const errorMessage = error instanceof Error ? error.message : '처리 중 오류가 발생했습니다.';
            setMessage(errorMessage);
        } finally {
            setActionId('');
        }
    };

    const runFieldAction = async (
        item: OfficeRequestItem,
        action: 'confirm' | 'cancel'
    ) => {
        const promptLabel = action === 'confirm' ? '확정 메모' : '반려 사유';
        const memo = window.prompt(`${item.title} ${promptLabel}를 입력하세요.`, '');
        if (memo === null) return;

        setActionId(`${action}:${item.requestId}`);
        setMessage('');
        try {
            if (action === 'confirm') {
                await officeRequestCenterService.confirmFieldRequest(item.requestId, { ...actor, memo });
                setMessage('휴무/인원 요청을 확정했습니다.');
            } else {
                await officeRequestCenterService.cancelFieldRequest(item.requestId, { ...actor, memo });
                setMessage('휴무/인원 요청을 반려했습니다.');
            }
            await loadRequests();
        } catch (error) {
            console.error('[OfficeRequestCenterPage] field request action failed', error);
            const errorMessage = error instanceof Error ? error.message : '처리 중 오류가 발생했습니다.';
            setMessage(errorMessage);
        } finally {
            setActionId('');
        }
    };

    const runExpenseAction = async (
        item: OfficeRequestItem,
        action: 'charge' | 'settle'
    ) => {
        const promptLabel = action === 'charge' ? '청구반영 메모' : '정산완료 메모';
        const memo = window.prompt(`${item.title} ${promptLabel}를 입력하세요.`, '');
        if (memo === null) return;

        setActionId(`${action}:${item.requestId}`);
        setMessage('');
        try {
            if (action === 'charge') {
                await officeRequestCenterService.chargeExpenseClaim(item.requestId, { ...actor, memo });
                setMessage('경비 청구를 반영했습니다.');
            } else {
                await officeRequestCenterService.settleExpenseClaim(item.requestId, { ...actor, memo });
                setMessage('경비 청구를 정산완료 처리했습니다.');
            }
            await loadRequests();
        } catch (error) {
            console.error('[OfficeRequestCenterPage] expense action failed', error);
            const errorMessage = error instanceof Error ? error.message : '처리 중 오류가 발생했습니다.';
            setMessage(errorMessage);
        } finally {
            setActionId('');
        }
    };

    const counts = useMemo(() => ({
        total: items.length,
        pending: items.filter((item) => item.status === 'requested' || item.status === 'draft').length,
        advance: items.filter((item) => item.type === 'advance').length,
        offDuty: items.filter((item) => item.type === 'offDuty').length,
        expense: items.filter((item) => item.type === 'expense').length,
    }), [items]);

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-6">
            <div className="mx-auto flex max-w-7xl flex-col gap-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <div>
                        <div className="flex items-center gap-2 text-sm font-bold text-cyan-700">
                            <Inbox className="h-4 w-4" />
                            사무실 운영
                        </div>
                        <h1 className="mt-1 text-2xl font-black text-slate-900">신청 승인센터</h1>
                    </div>
                    <button
                        type="button"
                        onClick={loadRequests}
                        className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-100"
                    >
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        새로고침
                    </button>
                </div>

                <div className="grid gap-3 md:grid-cols-5">
                    {[
                        { label: '전체', value: counts.total },
                        { label: '미처리', value: counts.pending },
                        { label: '가불', value: counts.advance },
                        { label: '휴무', value: counts.offDuty },
                        { label: '경비', value: counts.expense },
                    ].map((card) => (
                        <div key={card.label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                            <div className="text-xs font-bold text-slate-500">{card.label}</div>
                            <div className="mt-1 text-2xl font-black text-slate-900">{card.value.toLocaleString()}</div>
                        </div>
                    ))}
                </div>

                <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm lg:flex-row lg:items-center">
                    <div className="relative flex-1">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="요청자, 팀, 제목, 상태 검색"
                            className="h-10 w-full rounded-md border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                        />
                    </div>
                    <select
                        value={typeFilter}
                        onChange={(event) => setTypeFilter(event.target.value as TypeFilter)}
                        className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-cyan-500"
                    >
                        {typeOptions.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </select>
                    <select
                        value={statusFilter}
                        onChange={(event) => setStatusFilter(event.target.value)}
                        className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-cyan-500"
                    >
                        {statusOptions.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </select>
                </div>

                {message && (
                    <div className="rounded-md border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-bold text-cyan-800">
                        {message}
                    </div>
                )}

                <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                    <div className="hidden grid-cols-[120px_1fr_150px_130px_120px_190px] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-black text-slate-500 lg:grid">
                        <div>분류</div>
                        <div>요청</div>
                        <div>요청자</div>
                        <div>금액/인원</div>
                        <div>상태</div>
                        <div>처리</div>
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center gap-2 px-4 py-12 text-sm font-bold text-slate-500">
                            <RefreshCw className="h-4 w-4 animate-spin" />
                            신청 목록을 불러오는 중
                        </div>
                    ) : items.length === 0 ? (
                        <div className="px-4 py-12 text-center text-sm font-bold text-slate-500">
                            표시할 신청이 없습니다.
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {items.map((item) => {
                                const memo = getRequestMemo(item);
                                const isBusy = actionId.endsWith(`:${item.requestId}`);
                                return (
                                    <div key={`${item.type}-${item.requestId}`} className="grid gap-3 px-4 py-4 lg:grid-cols-[120px_1fr_150px_130px_120px_190px] lg:items-center">
                                        <div>
                                            <span className="inline-flex rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-black text-slate-700">
                                                {item.typeLabel}
                                            </span>
                                        </div>
                                        <div className="min-w-0">
                                            <div className="truncate text-sm font-black text-slate-900">{item.title}</div>
                                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
                                                {item.date && <span>{item.date}</span>}
                                                {item.teamName && <span>{item.teamName}</span>}
                                                {memo && <span className="truncate">메모: {memo}</span>}
                                            </div>
                                        </div>
                                        <div className="text-sm font-bold text-slate-700">{item.requester}</div>
                                        <div className="text-sm font-black text-slate-800">
                                            {item.amount !== undefined ? formatAmount(item.amount) : item.headcount ? `${item.headcount}명` : '-'}
                                        </div>
                                        <div>
                                            <span className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-black ${statusClassName(item.status)}`}>
                                                {item.statusLabel}
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {item.type === 'advance' && item.status === 'requested' && (
                                                <>
                                                    <button
                                                        type="button"
                                                        disabled={isBusy}
                                                        onClick={() => runAdvanceAction(item, 'approve')}
                                                        className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1.5 text-xs font-black text-white hover:bg-emerald-700 disabled:opacity-50"
                                                    >
                                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                                        승인
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={isBusy}
                                                        onClick={() => runAdvanceAction(item, 'reject')}
                                                        className="inline-flex items-center gap-1 rounded-md bg-rose-600 px-2.5 py-1.5 text-xs font-black text-white hover:bg-rose-700 disabled:opacity-50"
                                                    >
                                                        <XCircle className="h-3.5 w-3.5" />
                                                        반려
                                                    </button>
                                                </>
                                            )}
                                            {item.type === 'advance' && item.status === 'approved' && (
                                                <button
                                                    type="button"
                                                    disabled={isBusy}
                                                    onClick={() => runAdvanceAction(item, 'paid')}
                                                    className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-2.5 py-1.5 text-xs font-black text-white hover:bg-slate-900 disabled:opacity-50"
                                                >
                                                    <CircleDollarSign className="h-3.5 w-3.5" />
                                                    지급완료
                                                </button>
                                            )}
                                            {(item.type === 'offDuty' || item.type === 'fieldSchedule') && ['requested', 'assigning', 'assigned'].includes(item.status) && (
                                                <>
                                                    <button
                                                        type="button"
                                                        disabled={isBusy}
                                                        onClick={() => runFieldAction(item, 'confirm')}
                                                        className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1.5 text-xs font-black text-white hover:bg-emerald-700 disabled:opacity-50"
                                                    >
                                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                                        확정
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={isBusy}
                                                        onClick={() => runFieldAction(item, 'cancel')}
                                                        className="inline-flex items-center gap-1 rounded-md bg-rose-600 px-2.5 py-1.5 text-xs font-black text-white hover:bg-rose-700 disabled:opacity-50"
                                                    >
                                                        <XCircle className="h-3.5 w-3.5" />
                                                        반려
                                                    </button>
                                                </>
                                            )}
                                            {item.type === 'expense' && item.status === 'draft' && (
                                                <button
                                                    type="button"
                                                    disabled={isBusy}
                                                    onClick={() => runExpenseAction(item, 'charge')}
                                                    className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1.5 text-xs font-black text-white hover:bg-emerald-700 disabled:opacity-50"
                                                >
                                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                                    청구반영
                                                </button>
                                            )}
                                            {item.type === 'expense' && item.status === 'charged' && (
                                                <button
                                                    type="button"
                                                    disabled={isBusy}
                                                    onClick={() => runExpenseAction(item, 'settle')}
                                                    className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-2.5 py-1.5 text-xs font-black text-white hover:bg-slate-900 disabled:opacity-50"
                                                >
                                                    <CircleDollarSign className="h-3.5 w-3.5" />
                                                    정산완료
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => navigate(item.sourcePath)}
                                                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-black text-slate-700 hover:bg-slate-50"
                                            >
                                                <ExternalLink className="h-3.5 w-3.5" />
                                                원본
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white p-4 text-xs font-semibold text-slate-500">
                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                    이 화면에서 가불 승인/반려/지급완료, 휴무·인원 요청 확정/반려, 경비 청구반영/정산완료를 처리할 수 있습니다. 상세 수정이 필요한 건은 원본 화면에서 이어서 관리합니다.
                </div>
            </div>
        </div>
    );
}
