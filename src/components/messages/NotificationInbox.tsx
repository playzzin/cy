import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Dialog from '@radix-ui/react-dialog';
import { ArrowUpRight, Bell, CheckCheck, Inbox, Search, SlidersHorizontal, X } from 'lucide-react';
import type { ErpMessage } from '../../types/erpMessage';
import type { NotificationSource } from '../../types/notificationCenter';
import { messageService } from '../../services/messageService';
import { notificationCenterService } from '../../services/notificationCenterService';
import { useNotificationCenter } from '../../hooks/useNotificationCenter';
import { messageDestination } from '../../utils/messageNavigation';
import { formatNotificationTime, isDeferred, isDueToday, needsConfirmation, notificationEnabled, notificationSource, notificationSourceLabels, notificationTimeInput, parseNotificationTime } from '../../utils/notificationCenter';
import './NotificationInbox.css';
import './NotificationCenterDetails.css';

type Filter = 'focus' | 'all' | 'unread' | 'important' | 'importantUnread' | 'due' | 'confirmation' | 'deferred';
const filterLabels: Partial<Record<Filter, string>> = { focus: '확인할 일', all: '전체', unread: '미확인', important: '중요·긴급', confirmation: '확인 필요', deferred: '미뤄둠' };
interface Props { uid?: string; messages: ErpMessage[]; loading: boolean; error: Error | null; onRetry: () => void }

export default function NotificationInbox({ uid, messages, loading, error, onRetry }: Props) {
    const navigate = useNavigate();
    const profile = useNotificationCenter(uid);
    const { states, now } = profile;
    const [filter, setFilter] = useState<Filter>('focus');
    const [source, setSource] = useState<NotificationSource | 'all'>('all');
    const [search, setSearch] = useState('');
    const [pageSize, setPageSize] = useState(20);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [detailId, setDetailId] = useState<string | null>(null);
    const [remindTime, setRemindTime] = useState('');
    const [busy, setBusy] = useState(false);
    const inFlight = useRef(false);
    const sectionRef = useRef<HTMLElement | null>(null);
    const detailTrigger = useRef<HTMLElement | null>(null);
    const [actionError, setActionError] = useState('');
    const [status, setStatus] = useState('');
    const identity = useRef(uid);
    identity.current = uid;
    const activeMessages = useMemo(() => messages.filter(m => !m.expiresAt || m.expiresAt.toMillis() > now), [messages, now]);
    const unread = activeMessages.filter(m => uid && !messageService.isReadBy(m, uid));
    const visibleUnread = unread.filter(m => notificationEnabled(m, profile.preferences) && !isDeferred(states[m.id], now));
    const important = visibleUnread.filter(m => ['high', 'urgent'].includes(m.priority));
    const pending = activeMessages.filter(m => needsConfirmation(m, states[m.id]));
    const due = activeMessages.filter(m => notificationEnabled(m, profile.preferences) && isDueToday(m, now) && !states[m.id]?.confirmedAt && !isDeferred(states[m.id], now));
    const deferred = activeMessages.filter(m => isDeferred(states[m.id], now));
    const filtered = useMemo(() => activeMessages.filter(message => {
        const unread = !!uid && !messageService.isReadBy(message, uid);
        const snoozed = isDeferred(states[message.id], now);
        if (!['all', 'deferred', 'confirmation'].includes(filter) && !notificationEnabled(message, profile.preferences)) return false;
        if (filter === 'focus' && (snoozed || (!unread && !needsConfirmation(message, states[message.id]) && (!isDueToday(message, now) || !!states[message.id]?.confirmedAt)))) return false;
        if (filter === 'deferred' && !snoozed) return false;
        if (filter === 'due' && (!isDueToday(message, now) || states[message.id]?.confirmedAt || snoozed)) return false;
        if (filter === 'confirmation' && !needsConfirmation(message, states[message.id])) return false;
        if ((filter === 'unread' || filter === 'importantUnread') && (!unread || snoozed)) return false;
        if ((filter === 'important' || filter === 'importantUnread') && !['high', 'urgent'].includes(message.priority)) return false;
        if (source !== 'all' && notificationSource(message) !== source) return false;
        const query = search.trim().toLocaleLowerCase();
        return !query || [message.title, message.body, message.senderName, message.category].join(' ').toLocaleLowerCase().includes(query);
    }).sort((a, b) => {
        const weight = (m: ErpMessage) => (m.priority === 'urgent' ? 10 : m.priority === 'high' ? 5 : 0)
            + (needsConfirmation(m, states[m.id]) ? 3 : 0) + (m.dueAt && m.dueAt.toMillis() <= now ? 4 : 0);
        return (filter === 'focus' ? weight(b) - weight(a) : 0) || b.createdAt.toMillis() - a.createdAt.toMillis();
    }), [activeMessages, filter, source, search, uid, states, now, profile.preferences]);
    const shown = filtered.slice(0, pageSize);
    const unreadFiltered = filtered.filter(m => uid && !messageService.isReadBy(m, uid));
    const selectedMessages = filtered.filter(m => selected.has(m.id));
    const detail = activeMessages.find(m => m.id === detailId);
    useEffect(() => { setPageSize(20); setStatus(''); setSelected(new Set()); }, [filter, source, search]);
    useEffect(() => { setActionError(''); setStatus(''); setSelected(new Set()); setDetailId(null); }, [uid]);
    useEffect(() => { if (detailId && !detail) setDetailId(null); }, [detailId, detail]);

    const run = async (operation: () => Promise<unknown>, success: string) => {
        if (!uid || inFlight.current) return;
        const actor = uid;
        inFlight.current = true; setBusy(true); setActionError(''); setStatus('');
        try { await operation(); if (identity.current === actor) setStatus(success); }
        catch (error) {
            if (identity.current === actor) setActionError(error instanceof Error && /functions\/(invalid-argument|failed-precondition|permission-denied)/.test(String((error as { code?: string }).code))
                ? error.message : '처리하지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요.');
        } finally { inFlight.current = false; setBusy(false); }
    };
    const acknowledge = (items: ErpMessage[]) => run(() => messageService.markAllAsRead(items, uid!), items.length + '건을 읽음 처리했습니다.');
    const openOriginal = (message: ErpMessage) => {
        // Content access must not depend on receipt writes succeeding.
        if (uid && !messageService.isReadBy(message, uid)) void messageService.markAllAsRead([message], uid).catch(() => undefined);
        navigate(messageDestination(message));
    };
    const openDetail = (message: ErpMessage, trigger: HTMLElement) => {
        detailTrigger.current = trigger; setDetailId(message.id); setActionError(''); setStatus('');
        setRemindTime(notificationTimeInput(now + 3600000));
        if (uid && !messageService.isReadBy(message, uid)) void acknowledge([message]);
    };
    const personalDisabled = busy || profile.loading || !!profile.error;
    const snooze = (until: number) => {
        if (!detail || !Number.isFinite(until) || until <= Date.now()) { setActionError('다시 알림 시간을 현재 이후로 지정해 주세요.'); return; }
        void run(() => notificationCenterService.snooze(detail.id, until), formatNotificationTime(until) + '에 다시 알려드립니다.');
    };
    const errorContent = <>{actionError && <div className="notification-error" role="alert">{actionError}
        {detail && uid && !messageService.isReadBy(detail, uid) && <button disabled={busy} onClick={() => void acknowledge([detail])}>읽음 처리 다시 시도</button>}</div>}
        {status && <p role="status" className="notification-success">{status}</p>}</>;
    return <section ref={sectionRef} tabIndex={-1} className="notification-inbox" aria-label="내 알림함" aria-busy={loading}>
        <div className="notification-overview"><div className="notification-overview-copy">
            <span className="notification-eyebrow">오늘의 알림</span>
            <h2>{loading ? '알림을 확인하고 있어요' : error ? '알림을 확인할 수 없어요' : pending.length ? '완료 확인을 기다리는 공지가 있어요' : visibleUnread.length ? '확인할 알림이 ' + visibleUnread.length + '건 있어요' : '새로운 소식을 모두 확인했어요'}</h2>
            <p>급한 일부터 확인하고, 나중에 할 일은 다시 알림을 설정하세요.</p>
        </div><div className="notification-metrics">
            <button onClick={() => setFilter('importantUnread')}><span>중요 미확인</span><strong>{loading || error ? '–' : important.length}</strong></button>
            <button onClick={() => setFilter('due')}><span>오늘 기한</span><strong>{loading || error ? '–' : due.length}</strong></button>
            <button onClick={() => setFilter('confirmation')}><span>확인 필요</span><strong>{loading || error || profile.loading || profile.error ? '–' : pending.length}</strong></button>
            <button onClick={() => setFilter('deferred')}><span>미뤄둠</span><strong>{profile.loading || profile.error ? '–' : deferred.length}</strong></button>
        </div></div>
        <div className="notification-toolbar"><div className="notification-filters" role="group" aria-label="알림 상태">
            {(Object.keys(filterLabels) as Filter[]).map(value => <button key={value} aria-pressed={filter === value || (filter === 'importantUnread' && value === 'important')} onClick={() => setFilter(value)}>
                {filterLabels[value]}{value === 'unread' && visibleUnread.length > 0 && <span>{visibleUnread.length}</span>}
            </button>)}</div>
            <button className="notification-secondary" disabled={busy || loading || !!error || !unreadFiltered.length} onClick={() => void acknowledge(unreadFiltered)}><CheckCheck size={16} />조회된 알림 읽음 처리{unreadFiltered.length ? ' (' + unreadFiltered.length + ')' : ''}</button>
        </div>
        {filter === 'importantUnread' && <p className="notification-list-heading">중요·긴급 알림 중 미확인 항목만 표시합니다.</p>}
        {filter === 'due' && <p className="notification-list-heading">오늘 기한인 공지 확인 요청과 할일 알림입니다. 할일의 현재 상태는 원문에서 확인하세요.</p>}
        <div className="notification-searchbar"><label className="notification-search"><Search size={18} /><input aria-label="알림 검색" placeholder="제목, 내용, 보낸 사람 검색" value={search} onChange={e => setSearch(e.target.value)} />{search && <button onClick={() => setSearch('')} aria-label="알림 검색 지우기">×</button>}</label>
            <label className="notification-source"><SlidersHorizontal size={16} /><select aria-label="알림 종류" value={source} onChange={e => setSource(e.target.value as typeof source)}>
                <option value="all">모든 종류</option>{Object.entries(notificationSourceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select></label>
        </div>
        {profile.error && <div role="alert" className="notification-error">개인 처리 상태를 불러오지 못했습니다. 확인 완료·다시 알림은 연결 복구 후 사용할 수 있습니다. <button onClick={profile.retry}>개인 상태 다시 불러오기</button></div>}
        {error && <div className="notification-error" role="alert">알림을 불러오지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요.<button onClick={onRetry}>다시 불러오기</button></div>}
        {!detail && errorContent}
        {loading ? <div className="notification-empty" role="status"><Bell size={28} /><p>알림을 불러오는 중입니다.</p></div>
            : !error && !filtered.length ? <div className="notification-empty"><Inbox size={36} /><h3>{activeMessages.length ? filter === 'focus' ? '지금 확인할 일이 없습니다' : '조건에 맞는 알림이 없습니다' : '아직 도착한 알림이 없습니다'}</h3><p>{activeMessages.length ? '전체 알림을 보거나 검색 조건을 바꿔보세요.' : '새로운 알림이 도착하면 이곳에 표시됩니다.'}</p>
                {activeMessages.length > 0 && <button className="notification-secondary" onClick={() => { setSearch(''); setFilter('all'); setSource('all'); }}>전체 알림 보기</button>}</div>
                : !error && <>
                    <div className="notification-selection"><label><input type="checkbox" aria-label="현재 표시된 알림 선택" checked={shown.length > 0 && shown.every(m => selected.has(m.id))} onChange={e => setSelected(previous => {
                        const next = new Set(previous); shown.forEach(m => e.target.checked ? next.add(m.id) : next.delete(m.id)); return next;
                    })} />표시된 {shown.length}건 선택</label><button className="notification-secondary" disabled={busy || !selectedMessages.length} onClick={() => void acknowledge(selectedMessages.filter(m => uid && !messageService.isReadBy(m, uid)))}>선택 읽음 처리 ({selectedMessages.length})</button>
                        {selectedMessages.length > 0 && <button onClick={() => setSelected(new Set())}>선택 해제</button>}</div>
                    <div className="notification-list-heading"><span>알림 {filtered.length}건</span><span>{filter === 'focus' ? '중요도순' : '최신순'} · 한국 시간</span></div>
                    <ul className="notification-list">{shown.map(message => {
                        const isUnread = !!uid && !messageService.isReadBy(message, uid), state = states[message.id];
                        return <li key={message.id} className={isUnread ? 'is-unread' : ''}>
                            <label className="notification-select-item"><input type="checkbox" aria-label={message.title + ' 선택'} checked={selected.has(message.id)} onChange={e => setSelected(previous => { const next = new Set(previous); e.target.checked ? next.add(message.id) : next.delete(message.id); return next; })} /></label>
                            <div className="notification-item-content"><div className="notification-item-meta"><span>{notificationSourceLabels[notificationSource(message)]}</span>
                                {isUnread && <span className="notification-unread-label">미확인</span>}
                                {['high', 'urgent'].includes(message.priority) && <span className="notification-priority">{message.priority === 'urgent' ? '긴급' : '중요'}</span>}
                                {message.requiresConfirmation && <span className={state?.confirmedAt ? 'notification-complete' : 'notification-priority'}>{state?.confirmedAt ? '확인 완료' : '확인 필요'}</span>}
                                <time dateTime={message.createdAt.toDate().toISOString()}>{formatNotificationTime(message.createdAt.toMillis())}</time></div>
                                <button className="notification-title" onClick={e => openDetail(message, e.currentTarget)}>{message.title || '제목 없는 알림'}</button>
                                <p className="notification-body">{message.body}</p>
                                {message.dueAt && <p className={message.dueAt.toMillis() < now && !state?.confirmedAt ? 'notification-overdue' : 'notification-sender'}>기한 {formatNotificationTime(message.dueAt.toMillis())}{message.dueAt.toMillis() < now && !state?.confirmedAt ? ' · 기한 지남' : ''}</p>}
                                {isDeferred(state, now) && <p className="notification-sender">다시 알림 {formatNotificationTime(state.snoozedUntil!.toMillis())}</p>}
                                <div className="notification-item-actions"><button onClick={() => openOriginal(message)}>{messageDestination(message).startsWith('/messages?') ? '메시지 열기' : '원문 바로가기'}<ArrowUpRight size={14} /></button>
                                    {isUnread && <button disabled={busy} onClick={() => void acknowledge([message])} aria-label={message.title + ' 읽음 처리'}><CheckCheck size={14} />읽음 처리</button>}
                                    <button onClick={e => openDetail(message, e.currentTarget)}>상세·처리</button></div>
                            </div>
                        </li>;
                    })}</ul>
                    {filtered.length > pageSize && <button className="notification-load-more" onClick={() => setPageSize(size => size + 20)}>알림 더 보기 ({filtered.length - pageSize}건 남음)</button>}
                </>}
        <Dialog.Root open={!!detail} onOpenChange={open => { if (!open) setDetailId(null); }}>
            <Dialog.Portal><Dialog.Overlay className="notification-sheet-overlay" /><Dialog.Content className="notification-sheet" onCloseAutoFocus={event => { event.preventDefault(); (detailTrigger.current?.isConnected ? detailTrigger.current : sectionRef.current)?.focus(); }}>
                {detail && <><div className="notification-sheet-header"><span>{notificationSourceLabels[notificationSource(detail)]} 알림</span><Dialog.Close aria-label="알림 상세 닫기"><X size={22} /></Dialog.Close></div>
                    <Dialog.Title>{detail.title}</Dialog.Title><Dialog.Description>{detail.senderName} · {formatNotificationTime(detail.createdAt.toMillis())}</Dialog.Description>
                    <div className="notification-detail-body">{detail.body}</div>
                    {detail.dueAt && <p>기한: {formatNotificationTime(detail.dueAt.toMillis())}</p>}
                    {errorContent}
                    <button className="notification-primary" onClick={() => openOriginal(detail)}>원문 열기<ArrowUpRight size={16} /></button>
                    {detail.requiresConfirmation && <div className="notification-detail-section"><h3>내용 확인</h3><p>읽음과 별도로, 안내 내용을 확인했다는 기록을 남깁니다.</p>
                        {states[detail.id]?.confirmedAt ? <p className="notification-complete">확인 완료 · {formatNotificationTime(states[detail.id].confirmedAt!.toMillis())}</p>
                            : <button disabled={personalDisabled} className="notification-primary" onClick={() => void run(() => notificationCenterService.confirm(detail.id), '확인 완료를 기록했습니다.')}>내용 확인 완료</button>}</div>}
                    {!states[detail.id]?.confirmedAt && <div className="notification-detail-section"><h3>나중에 다시 알림</h3><p>선택한 시간까지 확인할 일에서 숨기고, 시간이 되면 다시 미확인으로 표시합니다. 최대 30일 후까지 설정할 수 있습니다.</p>
                        {isDeferred(states[detail.id], now) && <p>예약: {formatNotificationTime(states[detail.id].snoozedUntil!.toMillis())} <button disabled={personalDisabled} onClick={() => void run(() => notificationCenterService.resume(detail.id), '미루기를 해제했습니다.')}>미루기 해제</button></p>}
                        <div className="notification-item-actions"><button disabled={personalDisabled} onClick={() => snooze(Date.now() + 3600000)}>1시간 후</button><button disabled={personalDisabled} onClick={() => snooze(parseNotificationTime(notificationTimeInput(Date.now() + 86400000).slice(0, 10) + 'T09:00'))}>내일 오전 9시</button></div>
                        <label className="notification-field">다시 알림 시간 (한국 시간)<input type="datetime-local" value={remindTime} min={notificationTimeInput(now + 60000)} onChange={e => setRemindTime(e.target.value)} /></label>
                        <button className="notification-secondary" disabled={personalDisabled} onClick={() => snooze(parseNotificationTime(remindTime))}>지정한 시간에 알림</button>
                    </div>}
                </>}
            </Dialog.Content></Dialog.Portal>
        </Dialog.Root>
    </section>;
}
