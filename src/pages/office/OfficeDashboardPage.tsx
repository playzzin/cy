import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Bell,
    CalendarCheck,
    ClipboardCheck,
    FileText,
    Inbox,
    MessageSquare,
    RefreshCw,
    WalletCards,
} from 'lucide-react';
import {
    officeRequestCenterService,
    type OfficeRequestItem,
    type OfficeRequestSummary,
} from '../../services/officeRequestCenterService';
import { noticeService } from '../../services/noticeService';
import { messageService } from '../../services/messageService';
import type { Notice } from '../../types/notice';
import type { ErpMessage } from '../../types/erpMessage';

const emptySummary: OfficeRequestSummary = {
    total: 0,
    pending: 0,
    advancePending: 0,
    offDutyPending: 0,
    fieldSchedulePending: 0,
    expenseDraft: 0,
};

const formatAmount = (value?: number) =>
    typeof value === 'number' && Number.isFinite(value) ? `${Math.round(value).toLocaleString()}원` : '';

const timestampText = (value: unknown) => {
    if (!value) return '';
    try {
        const date = typeof (value as any).toDate === 'function'
            ? (value as any).toDate()
            : new Date(value as any);
        if (Number.isNaN(date.getTime())) return '';
        return date.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' });
    } catch {
        return '';
    }
};

export default function OfficeDashboardPage() {
    const navigate = useNavigate();
    const [summary, setSummary] = useState<OfficeRequestSummary>(emptySummary);
    const [recentRequests, setRecentRequests] = useState<OfficeRequestItem[]>([]);
    const [notices, setNotices] = useState<Notice[]>([]);
    const [messages, setMessages] = useState<ErpMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState('');

    const loadData = useCallback(async () => {
        setLoading(true);
        setErrorMessage('');
        try {
            const [requestRows, requestSummary, recentMessages] = await Promise.all([
                officeRequestCenterService.listRequests({ limit: 8 }),
                officeRequestCenterService.getSummary(),
                messageService.getRecentMessages(5).catch(() => []),
            ]);
            setRecentRequests(requestRows);
            setSummary(requestSummary);
            setMessages(recentMessages);
        } catch (error) {
            console.error('[OfficeDashboardPage] failed to load dashboard', error);
            setErrorMessage('운영 대시보드를 불러오지 못했습니다.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    useEffect(() => {
        const unsubscribe = noticeService.subscribeNotices(
            (rows) => setNotices(rows.slice(0, 5)),
            () => setNotices([])
        );
        return () => unsubscribe();
    }, []);

    const statCards = useMemo(() => [
        {
            label: '미처리 요청',
            value: summary.pending,
            icon: Inbox,
            path: '/office/request-center?status=pending',
            tone: 'cyan',
        },
        {
            label: '가불 접수',
            value: summary.advancePending,
            icon: WalletCards,
            path: '/office/request-center?type=advance&status=requested',
            tone: 'emerald',
        },
        {
            label: '휴무 접수',
            value: summary.offDutyPending,
            icon: CalendarCheck,
            path: '/office/request-center?type=offDuty&status=requested',
            tone: 'amber',
        },
        {
            label: '경비 작성중',
            value: summary.expenseDraft,
            icon: FileText,
            path: '/office/request-center?type=expense&status=draft',
            tone: 'slate',
        },
    ], [summary]);

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-6">
            <div className="mx-auto flex max-w-7xl flex-col gap-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <div>
                        <div className="flex items-center gap-2 text-sm font-bold text-cyan-700">
                            <ClipboardCheck className="h-4 w-4" />
                            사무실 운영
                        </div>
                        <h1 className="mt-1 text-2xl font-black text-slate-900">운영 대시보드</h1>
                    </div>
                    <button
                        type="button"
                        onClick={loadData}
                        className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-100"
                    >
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        새로고침
                    </button>
                </div>

                {errorMessage && (
                    <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
                        {errorMessage}
                    </div>
                )}

                <div className="grid gap-3 md:grid-cols-4">
                    {statCards.map((card) => {
                        const Icon = card.icon;
                        return (
                            <button
                                key={card.label}
                                type="button"
                                onClick={() => navigate(card.path)}
                                className="rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="text-xs font-bold text-slate-500">{card.label}</div>
                                    <Icon className="h-4 w-4 text-cyan-600" />
                                </div>
                                <div className="mt-2 text-3xl font-black text-slate-900">{card.value.toLocaleString()}</div>
                            </button>
                        );
                    })}
                </div>

                <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
                    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
                        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                            <h2 className="text-sm font-black text-slate-900">최근 신청</h2>
                            <button
                                type="button"
                                onClick={() => navigate('/office/request-center')}
                                className="text-xs font-black text-cyan-700 hover:text-cyan-900"
                            >
                                전체 보기
                            </button>
                        </div>
                        <div className="divide-y divide-slate-100">
                            {loading ? (
                                <div className="flex items-center gap-2 px-4 py-8 text-sm font-bold text-slate-500">
                                    <RefreshCw className="h-4 w-4 animate-spin" />
                                    불러오는 중
                                </div>
                            ) : recentRequests.length === 0 ? (
                                <div className="px-4 py-8 text-sm font-bold text-slate-500">최근 신청이 없습니다.</div>
                            ) : recentRequests.map((item) => (
                                <button
                                    key={`${item.type}-${item.requestId}`}
                                    type="button"
                                    onClick={() => navigate('/office/request-center')}
                                    className="grid w-full gap-2 px-4 py-3 text-left md:grid-cols-[100px_1fr_120px]"
                                >
                                    <span className="w-fit rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-black text-slate-700">
                                        {item.typeLabel}
                                    </span>
                                    <span className="min-w-0">
                                        <span className="block truncate text-sm font-black text-slate-900">{item.title}</span>
                                        <span className="block truncate text-xs font-semibold text-slate-500">
                                            {item.requester} {item.teamName ? `· ${item.teamName}` : ''}
                                        </span>
                                    </span>
                                    <span className="text-sm font-black text-slate-800">
                                        {formatAmount(item.amount) || item.statusLabel}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </section>

                    <div className="grid gap-4">
                        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
                            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
                                <Bell className="h-4 w-4 text-cyan-600" />
                                <h2 className="text-sm font-black text-slate-900">최근 공지</h2>
                            </div>
                            <div className="divide-y divide-slate-100">
                                {notices.length === 0 ? (
                                    <div className="px-4 py-6 text-sm font-bold text-slate-500">공지 없음</div>
                                ) : notices.map((notice) => (
                                    <button
                                        key={notice.id}
                                        type="button"
                                        onClick={() => navigate('/notices')}
                                        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                                    >
                                        <span className="truncate text-sm font-bold text-slate-800">{notice.title}</span>
                                        <span className="shrink-0 text-xs font-bold text-slate-400">{timestampText(notice.publishedAt || notice.updatedAt)}</span>
                                    </button>
                                ))}
                            </div>
                        </section>

                        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
                            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
                                <MessageSquare className="h-4 w-4 text-cyan-600" />
                                <h2 className="text-sm font-black text-slate-900">최근 메시지</h2>
                            </div>
                            <div className="divide-y divide-slate-100">
                                {messages.length === 0 ? (
                                    <div className="px-4 py-6 text-sm font-bold text-slate-500">메시지 없음</div>
                                ) : messages.map((message) => (
                                    <button
                                        key={message.id}
                                        type="button"
                                        onClick={() => navigate('/messages')}
                                        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                                    >
                                        <span className="truncate text-sm font-bold text-slate-800">{message.title}</span>
                                        <span className="shrink-0 text-xs font-bold text-slate-400">{timestampText(message.createdAt)}</span>
                                    </button>
                                ))}
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
}
