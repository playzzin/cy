import React, { useCallback, useEffect, useRef, useState } from 'react';
import ResponsiveDetailDialog from '../../components/common/ResponsiveDetailDialog';
import { teamAccountApprovalEnabled } from '../../utils/teamAccountApprovalFeature';
import { teamAccountApprovalService, TeamAccountRow, TeamApprovalResult } from '../../services/teamAccountApprovalService';
import './TeamAccountApprovalPage.css';

export default function TeamAccountApprovalPage() {
    const enabled = teamAccountApprovalEnabled();
    const [rows, setRows] = useState<TeamAccountRow[]>([]);
    const [cursor, setCursor] = useState<string | null>(null);
    const [query, setQuery] = useState('');
    const [status, setStatus] = useState('pending');
    const [selected, setSelected] = useState<string[]>([]);
    const [confirming, setConfirming] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [results, setResults] = useState<TeamApprovalResult[]>([]);
    const generation = useRef(0);
    const running = useRef(false);
    const load = useCallback(async (next?: string) => {
        const current = ++generation.current;
        setBusy(true); setError(''); setSelected([]); setConfirming(false);
        if (!next) setRows([]);
        try {
            const page = await teamAccountApprovalService.list(next);
            if (current !== generation.current) return;
            setRows(previous => next ? [...new Map([...previous, ...page.rows].map(row => [row.linkId, row])).values()] : page.rows);
            setCursor(page.nextCursor);
        } catch {
            if (current !== generation.current) return;
            setRows([]); setCursor(null); setError('목록을 불러오지 못했습니다. 현재 팀 소속과 승인 권한을 확인한 뒤 다시 시도해 주세요.');
        } finally { if (current === generation.current) setBusy(false); }
    }, []);
    useEffect(() => {
        if (enabled) void load();
        return () => { generation.current += 1; };
    }, [enabled, load]);
    useEffect(() => {
        const refresh = () => { if (enabled && !running.current) { setResults([]); void load(); } };
        window.addEventListener('focus', refresh);
        const timer = window.setInterval(refresh, 60000);
        return () => { window.removeEventListener('focus', refresh); window.clearInterval(timer); };
    }, [enabled, load]);
    const visible = rows.filter(row => (status === 'all' || row.status === status) && `${row.name} ${row.teamName}`.includes(query.trim()));
    const chosen = rows.filter(row => selected.includes(row.linkId));
    const approve = async () => {
        if (running.current || !chosen.length) return;
        running.current = true; setBusy(true); setError('');
        const current = ++generation.current;
        try {
            const response = await teamAccountApprovalService.approve(chosen.map(row => row.linkId));
            if (current !== generation.current) return;
            setResults(response.results);
            const succeeded = new Set(response.results.filter(result => result.status === 'active').map(result => result.linkId));
            setRows(previous => previous.map(row => succeeded.has(row.linkId) ? { ...row, status: 'active' } : row));
            setSelected(response.results.filter(result => result.status === 'failed').map(result => result.linkId));
            setConfirming(false);
        } catch {
            if (current === generation.current) setError('결과를 확인하지 못했습니다. 다시 시도해도 이미 승인한 계정은 중복 승인하지 않습니다.');
        } finally { if (current === generation.current) setBusy(false); running.current = false; }
    };
    if (!enabled) return <section className="team-account-page"><h1>팀원 계정 승인</h1><p>승인 기능을 준비 중입니다. 기존 사무실 계정 승인 창구를 이용해 주세요.</p></section>;
    return <section className="team-account-page">
        <header><div><h1>팀원 계정 승인</h1><p>내 팀에 등록된 일반 작업자의 로그인 계정 연결을 승인합니다.</p></div><button disabled={busy} onClick={() => { setResults([]); void load(); }}>새로고침</button></header>
        <div className="team-account-filters">
            <label>불러온 목록 검색<input value={query} placeholder="이름 또는 팀 이름" onChange={event => { setQuery(event.target.value); setSelected([]); }} /></label>
            <label>상태<select value={status} onChange={event => { setStatus(event.target.value); setSelected([]); }}><option value="pending">승인 대기</option><option value="active">승인 완료·권한 갱신</option><option value="all">전체</option></select></label>
        </div>
        <div className="team-account-selection"><button disabled={busy || !visible.length} onClick={() => setSelected(visible.slice(0, 20).map(row => row.linkId))}>표시된 목록 선택 (최대 20건)</button><button disabled={busy || !selected.length} onClick={() => setSelected([])}>선택 해제</button><button className="primary" disabled={busy || !selected.length} onClick={() => setConfirming(true)}>선택 {selected.length}건 승인·갱신</button></div>
        {error && <p role="alert">{error}</p>}
        {busy && <p role="status">처리 중입니다…</p>}
        {!busy && !error && !visible.length && <p>현재 불러온 범위에 해당 계정이 없습니다.</p>}
        <ul className="team-account-list">{visible.map(row => <li key={row.linkId}><label><input type="checkbox" checked={selected.includes(row.linkId)} disabled={busy || (!selected.includes(row.linkId) && selected.length >= 20)} onChange={event => setSelected(previous => event.target.checked ? [...previous, row.linkId] : previous.filter(value => value !== row.linkId))} /><span><strong>{row.name}</strong><small>{row.teamName || '소속 팀'} · 작업자 {row.workerId}</small></span></label><span className={`account-status ${row.status}`}>{row.status === 'active' ? '승인 완료' : '승인 대기'}</span></li>)}</ul>
        {cursor && <button disabled={busy} onClick={() => void load(cursor)}>다음 팀원 50명 조회</button>}
        <p className="team-account-help">검색·선택은 불러온 목록에 적용됩니다. 다음 팀원이 있으면 추가로 조회해 주세요. 신규 작업자 등록과 특수 권한 계정은 사무실에서 확인합니다.</p>
        {!!results.length && <div aria-live="polite"><h2>처리 결과</h2>{results.map(result => <p key={result.linkId}>{rows.find(row => row.linkId === result.linkId)?.name || '선택 계정'}: {result.status === 'failed' ? result.message : result.claimsPending ? '승인 완료 · 권한 갱신 대기. 승인 완료 목록에서 다시 선택해 갱신할 수 있습니다.' : result.reused ? '기존 승인 유지 · 권한 갱신 완료' : '승인 완료'}</p>)}</div>}
        <ResponsiveDetailDialog open={confirming} onOpenChange={value => { if (!busy) setConfirming(value); }} title={`선택한 ${chosen.length}건 승인·갱신`} description="선택한 작업자와 소속을 확인해 주세요. 현재 소속은 처리 직전에 다시 검사합니다.">
            <ul>{chosen.map(row => <li key={row.linkId}>{row.name} · {row.teamName} · {row.workerId}</li>)}</ul>
            {error && <p role="alert">{error}</p>}<button disabled={busy} onClick={() => void approve()}>{busy ? '처리 중' : '확인 후 승인·갱신'}</button>
        </ResponsiveDetailDialog>
    </section>;
}
