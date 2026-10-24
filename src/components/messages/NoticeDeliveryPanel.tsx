import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { notificationCenterService } from '../../services/notificationCenterService';
import type { NoticeDeliveryJob, NoticeDeliveryRecipient } from '../../types/notificationCenter';
import { formatNotificationTime } from '../../utils/notificationCenter';
import './NotificationInbox.css';
import './NotificationCenterDetails.css';

const labels: Record<NoticeDeliveryJob['status'], string> = { pending: '발송 대기', sent: '전달 완료', failed: '재시도 필요', disabled: '발송 안 함', no_recipients: '수신 대상 없음', cancelled: '발송 취소' };
const reasons: Record<string, string> = { author_disabled: '작성자가 발송을 선택하지 않았습니다.', settings_disabled: '공지 자동 알림이 꺼져 있습니다.', empty_audience: '대상 직책과 수신 설정에 맞는 활성 사용자가 없습니다.', inactive_audience: '예약 후 수신자 계정이 비활성화되었습니다.', notice_changed_or_expired: '공지가 수정·삭제·만료되어 이전 발송을 취소했습니다.' };
export default function NoticeDeliveryPanel() {
    const [jobs, setJobs] = useState<NoticeDeliveryJob[]>([]);
    const [busy, setBusy] = useState(false);
    const [more, setMore] = useState(false);
    const [error, setError] = useState('');
    const [selected, setSelected] = useState('');
    const [recipients, setRecipients] = useState<NoticeDeliveryRecipient[]>([]);
    const [recipientFilter, setRecipientFilter] = useState('all');
    const [detailLoading, setDetailLoading] = useState(false);
    const generation = useRef(0);
    const locked = useRef(false);
    const load = useCallback(async (last?: NoticeDeliveryJob) => {
        if (locked.current) return;
        locked.current = true; setBusy(true); setError('');
        try {
            const result = await notificationCenterService.deliveryJobs(last?.createdAt, last?.id);
            setJobs(items => last ? [...items, ...result.jobs.filter(job => !items.some(item => item.id === job.id))] : result.jobs);
            setMore(result.hasMore);
        } catch { setError('전달 현황을 불러오지 못했습니다. 관리자 권한과 연결 상태를 확인하고 다시 시도해 주세요.'); }
        finally { locked.current = false; setBusy(false); }
    }, []);
    useEffect(() => { void load(); return () => { generation.current++; }; }, [load]);
    const detail = async (job: NoticeDeliveryJob) => {
        const version = ++generation.current;
        setSelected(job.id); setRecipients([]); setDetailLoading(true); setRecipientFilter('all'); setError('');
        try {
            const result = await notificationCenterService.deliveryRecipients(job.id);
            if (generation.current === version) setRecipients(result.recipients);
        } catch { if (generation.current === version) setError('수신자 상태를 불러오지 못했습니다. 해당 전달 현황을 다시 열어 주세요.'); }
        finally { if (generation.current === version) setDetailLoading(false); }
    };
    const retry = async (job: NoticeDeliveryJob) => {
        if (locked.current) return;
        locked.current = true; setBusy(true); setError('');
        let succeeded = false;
        try { await notificationCenterService.retryDelivery(job.id); succeeded = true; }
        catch { setError('발송 재시도에 실패했습니다. 잠시 후 다시 시도해 주세요.'); }
        finally { locked.current = false; setBusy(false); }
        if (succeeded) { await load(); if (selected === job.id) await detail(job); }
    };
    const selectedJob = jobs.find(job => job.id === selected);
    return <section className="notification-inbox" aria-label="관리자 전달 현황">
        <div className="notification-toolbar"><div><h2>공지 전달 현황</h2><p>이 기능 적용 후 저장한 공지의 앱 내 전달·읽음·확인 완료 상태입니다.</p></div>
            <button className="notification-secondary" disabled={busy} onClick={() => { void load(); if (selectedJob) void detail(selectedJob); }}>새로고침</button></div>
        {error && <p role="alert" className="notification-error">{error}</p>}
        {busy && <p role="status">전달 상태를 확인하는 중입니다.</p>}
        {!busy && !jobs.length && !error && <div className="notification-empty">아직 발송 기록이 없습니다.</div>}
        <ul className="notification-deliveries">{jobs.map(job => <li key={job.id}>
            <div className="notification-item-meta"><span className={'notification-delivery-status status-' + job.status}>{labels[job.status]}</span><time>{formatNotificationTime(job.createdAt)}</time></div>
            <h3><Link to={'/notices?noticeId=' + encodeURIComponent(job.noticeId)}>{job.title}</Link></h3>
            <p>대상 {job.recipientCount}명 · 전달 {job.deliveredCount}명 · 시도 {job.attempts}회{job.requiresConfirmation ? ' · 확인 완료 요청' : ''}</p>
            {job.dueAt && <p>확인 기한 {formatNotificationTime(job.dueAt)}{job.dueAt < Date.now() ? ' · 기한 지남' : ''}</p>}
            {reasons[job.reason] && <p>{reasons[job.reason]}</p>}
            {job.status === 'pending' && <p>다음 시도 {job.nextAttemptAt ? formatNotificationTime(job.nextAttemptAt) : '곧'} · 실패 시 간격을 늘려 최대 8회 자동 재시도합니다.</p>}
            <div className="notification-item-actions"><button onClick={() => { if (selected === job.id) { generation.current++; setSelected(''); setDetailLoading(false); } else void detail(job); }} aria-expanded={selected === job.id}>수신자 상태 보기</button>
                {['pending', 'failed'].includes(job.status) && <button disabled={busy} onClick={() => void retry(job)}>지금 발송 재시도</button>}</div>
            {selected === job.id && <div className="notification-recipient-panel">
                {detailLoading ? <p role="status">수신자 상태를 불러오는 중입니다.</p> : <>
                    <p>읽음 {recipients.filter(r => r.read).length}명 · 확인 완료 {recipients.filter(r => r.confirmedAt).length}명
                        {job.requiresConfirmation && (' · 미완료 ' + recipients.filter(r => r.delivered && !r.confirmedAt).length + '명')}</p>
                    <label>수신자 필터 <select value={recipientFilter} onChange={e => setRecipientFilter(e.target.value)}><option value="all">전체</option><option value="unread">읽지 않음</option><option value="failed">미전달</option>{job.requiresConfirmation && <option value="unconfirmed">확인 미완료</option>}</select></label>
                    <ul>{recipients.filter(r => recipientFilter === 'all' || (recipientFilter === 'unread' && r.delivered && !r.read) || (recipientFilter === 'failed' && !r.delivered) || (recipientFilter === 'unconfirmed' && r.delivered && !r.confirmedAt)).map(r => <li key={r.uid}>
                        <strong>{r.name}</strong><span>{!r.delivered ? '미전달' : r.read ? '읽음' : '읽지 않음'}</span>
                        {job.requiresConfirmation && <span>{r.confirmedAt ? '확인 완료 · ' + formatNotificationTime(r.confirmedAt) : r.delivered ? '확인 미완료' : '–'}</span>}
                    </li>)}</ul>
                    {!recipients.length && <p>해당 수신자가 없습니다.</p>}
                </>}
            </div>}
        </li>)}</ul>
        {more && <button className="notification-load-more" disabled={busy} onClick={() => void load(jobs[jobs.length - 1])}>이전 발송 기록 더 보기</button>}
    </section>;
}
