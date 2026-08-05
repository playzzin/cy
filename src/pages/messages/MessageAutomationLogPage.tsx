import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
    faBullhorn,
    faCircleCheck,
    faCircleExclamation,
    faClockRotateLeft,
    faFilter,
    faMagnifyingGlass,
    faRotate,
    faUserGroup,
} from '@fortawesome/free-solid-svg-icons';
import { format } from 'date-fns';
import { AuditLog, auditService } from '../../services/auditService';
import MessagePageTabs from '../../components/messages/MessagePageTabs';

type ResultFilter = 'all' | 'sent' | 'failed' | 'skipped';

interface AutomationLogDetails {
    event?: string;
    eventLabel?: string;
    result?: 'sent' | 'failed' | 'skipped';
    messageId?: string | null;
    messageTitle?: string;
    priority?: string;
    actionUrl?: string | null;
    recipientScope?: string | null;
    recipientIds?: string[];
    recipientNames?: string[];
    recipientCount?: number | null;
    recipientDescription?: string;
    teamId?: string | null;
    teamName?: string | null;
    reason?: string | null;
    errorMessage?: string | null;
}

const RESULT_META = {
    sent: { label: '발송 완료', icon: faCircleCheck, badge: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
    failed: { label: '발송 실패', icon: faCircleExclamation, badge: 'border-rose-200 bg-rose-50 text-rose-700' },
    skipped: { label: '발송 제외', icon: faClockRotateLeft, badge: 'border-amber-200 bg-amber-50 text-amber-700' },
} as const;

const detailsOf = (log: AuditLog): AutomationLogDetails => (
    log.details && typeof log.details === 'object' ? log.details as AutomationLogDetails : {}
);

const namesOf = (value: unknown): string[] => (
    Array.isArray(value)
        ? value.map((name) => typeof name === 'string' ? name.trim() : '').filter(Boolean)
        : []
);

const dateTimeOf = (log: AuditLog): string => {
    try {
        return format(log.timestamp.toDate(), 'yyyy-MM-dd HH:mm:ss');
    } catch {
        return '-';
    }
};

const resultOf = (details: AutomationLogDetails): 'sent' | 'failed' | 'skipped' => (
    details.result === 'failed' || details.result === 'skipped' ? details.result : 'sent'
);

const MessageAutomationLogPage: React.FC = () => {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [keyword, setKeyword] = useState('');
    const [result, setResult] = useState<ResultFilter>('all');
    const [event, setEvent] = useState('all');
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const loadLogs = useCallback(async () => {
        setLoading(true);
        try {
            setLogs(await auditService.getLogs(1000, 'MESSAGE_AUTOMATION'));
            setError(null);
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : '자동 메시지 발송 로그를 불러오지 못했습니다.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadLogs();
    }, [loadLogs]);

    const eventOptions = useMemo(() => Array.from(new Map(
        logs.map<[string, string]>((log) => {
            const details = detailsOf(log);
            return [details.event || '', details.eventLabel || details.event || '알 수 없는 이벤트'];
        }).filter(([eventKey]) => Boolean(eventKey))
    ).entries()), [logs]);

    const filteredLogs = useMemo(() => {
        const query = keyword.trim().toLowerCase();
        return logs.filter((log) => {
            const details = detailsOf(log);
            if (result !== 'all' && resultOf(details) !== result) return false;
            if (event !== 'all' && details.event !== event) return false;
            if (!query) return true;
            return [
                details.event,
                details.eventLabel,
                details.messageTitle,
                details.teamName,
                details.recipientDescription,
                ...namesOf(details.recipientNames),
                details.errorMessage,
            ].filter(Boolean).join(' ').toLowerCase().includes(query);
        });
    }, [event, keyword, logs, result]);

    const stats = useMemo(() => ({
        total: logs.length,
        sent: logs.filter((log) => resultOf(detailsOf(log)) === 'sent').length,
        failed: logs.filter((log) => resultOf(detailsOf(log)) === 'failed').length,
        skipped: logs.filter((log) => resultOf(detailsOf(log)) === 'skipped').length,
    }), [logs]);

    return (
        <div className="erp-message-shell">
            <header className="erp-message-page-header">
                <div>
                    <h1 className="erp-message-page-title">자동 메시지 발송 로그</h1>
                    <p className="erp-message-page-description">자동 발송 이벤트별 수신 대상, 발송 결과, 제외·실패 사유를 확인합니다.</p>
                </div>
                <div className="erp-message-page-header-actions">
                    <MessagePageTabs active="logs" />
                    <button type="button" className="erp-message-secondary-button" onClick={loadLogs}><FontAwesomeIcon icon={faRotate} spin={loading} /> 새로고침</button>
                </div>
            </header>

            <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                {([
                    ['전체 로그', stats.total, faBullhorn, 'bg-slate-100 text-slate-700'],
                    ['발송 완료', stats.sent, faCircleCheck, 'bg-emerald-50 text-emerald-700'],
                    ['발송 실패', stats.failed, faCircleExclamation, 'bg-rose-50 text-rose-700'],
                    ['수신자 없음', stats.skipped, faUserGroup, 'bg-amber-50 text-amber-700'],
                ] as Array<[string, number, IconDefinition, string]>).map(([label, value, icon, tone]) => <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center gap-3"><span className={`flex h-10 w-10 items-center justify-center rounded-lg ${tone}`}><FontAwesomeIcon icon={icon} /></span><div><div className="text-xs font-bold text-slate-400">{label}</div><div className="mt-1 text-2xl font-black text-slate-900">{value.toLocaleString('ko-KR')}</div></div></div></div>)}
            </div>

            <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center gap-2 text-sm font-black text-slate-700"><FontAwesomeIcon icon={faFilter} /> 로그 필터</div>
                <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_220px_260px]">
                    <label className="relative"><FontAwesomeIcon icon={faMagnifyingGlass} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={keyword} onChange={(change) => setKeyword(change.target.value)} placeholder="이벤트, 제목, 팀, 수신자 검색" className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15" /></label>
                    <select value={result} onChange={(change) => setResult(change.target.value as ResultFilter)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500"><option value="all">전체 결과</option><option value="sent">발송 완료</option><option value="failed">발송 실패</option><option value="skipped">수신자 없음</option></select>
                    <select value={event} onChange={(change) => setEvent(change.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500"><option value="all">전체 이벤트</option>{eventOptions.map(([eventKey, eventLabel]) => <option key={eventKey} value={eventKey}>{eventLabel}</option>)}</select>
                </div>
            </section>

            {error && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>}

            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-4"><div className="font-black text-slate-900">발송 이력</div><div className="text-sm font-semibold text-slate-500">{filteredLogs.length.toLocaleString('ko-KR')}건 표시</div></div>
                <div className="overflow-x-auto"><table className="w-full min-w-[1040px] text-left text-sm"><thead className="bg-white text-xs font-black uppercase tracking-wide text-slate-400"><tr><th className="px-5 py-3">결과</th><th className="px-5 py-3">이벤트</th><th className="px-5 py-3">메시지 제목</th><th className="px-5 py-3">수신 대상</th><th className="px-5 py-3">발송 일시</th><th className="px-5 py-3">상세</th></tr></thead><tbody className="divide-y divide-slate-100">
                    {filteredLogs.map((log) => {
                        const details = detailsOf(log);
                        const state = resultOf(details);
                        const resultMeta = RESULT_META[state];
                        const names = namesOf(details.recipientNames);
                        const isExpanded = expandedId === log.id;
                        return <React.Fragment key={log.id}><tr className="hover:bg-slate-50"><td className="px-5 py-4"><span className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-black ${resultMeta.badge}`}><FontAwesomeIcon icon={resultMeta.icon} />{resultMeta.label}</span></td><td className="px-5 py-4 font-bold text-slate-800">{details.eventLabel || details.event || '-'}</td><td className="px-5 py-4"><div className="max-w-[260px] truncate font-semibold text-slate-800">{details.messageTitle || '-'}</div><div className="mt-1 text-xs text-slate-400">{details.priority || 'normal'}</div></td><td className="px-5 py-4"><div className="font-semibold text-slate-800">{details.recipientScope === 'all' ? '전체 사용자' : `${typeof details.recipientCount === 'number' ? details.recipientCount : names.length}명`}</div><div className="mt-1 max-w-[220px] truncate text-xs text-slate-400">{details.recipientDescription || names.join(', ') || '-'}</div></td><td className="whitespace-nowrap px-5 py-4 font-mono text-xs text-slate-600">{dateTimeOf(log)}</td><td className="px-5 py-4"><button type="button" onClick={() => setExpandedId(isExpanded ? null : (log.id || null))} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">{isExpanded ? '닫기' : '보기'}</button></td></tr>{isExpanded && <tr className="bg-slate-50"><td colSpan={6} className="px-5 py-5"><div className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-3"><div><div className="text-xs font-bold text-slate-400">수신자</div><div className="mt-1 break-words font-semibold text-slate-800">{details.recipientScope === 'all' ? '전체 사용자' : (names.join(', ') || '-')}</div></div><div><div className="text-xs font-bold text-slate-400">연관 팀</div><div className="mt-1 font-semibold text-slate-800">{details.teamName || details.teamId || '-'}</div></div><div><div className="text-xs font-bold text-slate-400">메시지 ID</div><div className="mt-1 break-all font-mono text-xs text-slate-700">{details.messageId || '-'}</div></div></div>{state === 'failed' && <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">{details.errorMessage || '발송 처리 중 오류가 발생했습니다.'}</div>}{state === 'skipped' && <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-700">{details.reason === 'recipient-empty' ? '수신 대상이 없어 메시지를 발송하지 않았습니다.' : '발송 조건이 충족되지 않았습니다.'}</div>}</td></tr>}</React.Fragment>;
                    })}
                    {!loading && filteredLogs.length === 0 && <tr><td colSpan={6} className="px-6 py-16 text-center text-slate-500">조건에 맞는 자동 메시지 발송 로그가 없습니다.</td></tr>}
                    {loading && <tr><td colSpan={6} className="px-6 py-16 text-center text-slate-500">자동 메시지 발송 로그를 불러오는 중입니다.</td></tr>}
                </tbody></table></div>
            </section>
        </div>
    );
};

export default MessageAutomationLogPage;
