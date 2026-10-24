import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { userService } from '../../services/userService';
import { isDevAdminSessionEnabled } from '../../utils/devAdminSession';
import { activitySourceForPath, availableActivitySources, type ActivitySource } from './activitySources';
import { activityRange, initialActivityDates, koreanDay, type ActivityRecord } from './activityModel';
import { activityErrorMessage, fetchActivityPage, type ActivityCursor, type ActivityFilter, type ActivityPage } from './activityQuery';
import './activityCenter.css';

const GeminiUsageLogPage = React.lazy(() => import('../../pages/admin/GeminiUsageLogPage'));
const time = (millis: number) => millis ? new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
}).format(millis) : '시간 정보 없음';

function ActivityDetail({ record, close }: { record: ActivityRecord; close: () => void }) {
  return <section className="activity-detail" aria-label="활동 상세">
    <div className="activity-heading"><div><span className="activity-eyebrow">선택한 활동</span><h2>{record.action}</h2></div><button type="button" onClick={close}>상세 닫기</button></div>
    <p>{record.actorName} · {time(record.time)} (한국 시간)</p>
    <strong>{record.target}</strong>
    {record.summary.length > 0 && <ul>{record.summary.map((line, index) => <li key={index}>{line}</li>)}</ul>}
    {record.facts.length > 0 && <dl>{record.facts.map((fact, index) => <div key={index}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl>}
    {record.changes.length > 0 && <div className="activity-table-wrap"><table><caption>변경 전후</caption><thead><tr><th>항목</th><th>변경 전</th><th>변경 후</th></tr></thead>
      <tbody>{record.changes.map((change, index) => <tr key={index}><th>{change.label}</th><td>{change.before}</td><td>{change.after}</td></tr>)}</tbody></table></div>}
    {!record.summary.length && !record.facts.length && !record.changes.length && <p>추가로 기록된 상세 내용이 없습니다.</p>}
  </section>;
}

export function ActivityBrowser({ source }: { source: ActivitySource }) {
  const [filter, setFilter] = useState<ActivityFilter>(() => ({ ...initialActivityDates(), actorId: '' }));
  const [draft, setDraft] = useState(filter);
  const [actorName, setActorName] = useState('');
  const [pages, setPages] = useState<ActivityPage[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [validation, setValidation] = useState('');
  const [keyword, setKeyword] = useState('');
  const [outcome, setOutcome] = useState('');
  const [selected, setSelected] = useState<ActivityRecord | null>(null);
  const serial = useRef(0);
  const pending = useRef(new Map<string, Promise<ActivityPage>>());
  const busy = useRef(false);

  const load = useCallback(async (cursor: ActivityCursor | null = null) => {
    const request = ++serial.current;
    busy.current = true; setLoading(true); setError(''); setSelected(null);
    if (!cursor) { setPages([]); setIndex(0); }
    const key = JSON.stringify([source.id, filter, cursor?.id]);
    let promise = pending.current.get(key);
    if (!promise) {
      promise = fetchActivityPage(source, filter, cursor);
      pending.current.set(key, promise);
    }
    try {
      const page = await promise;
      if (serial.current !== request) return;
      setPages(previous => cursor ? [...previous, page] : [page]);
      if (cursor) setIndex(previous => previous + 1);
    } catch (caught) {
      if (serial.current === request) setError(activityErrorMessage(caught));
    } finally {
      if (pending.current.get(key) === promise) pending.current.delete(key);
      if (serial.current === request) { busy.current = false; setLoading(false); }
    }
  }, [source, filter]);

  useEffect(() => { void load(); return () => { serial.current++; }; }, [load]);
  const page = pages[index];
  const visible = useMemo(() => (page?.records || []).filter(record => (!outcome || record.outcome === outcome)
    && [record.actorName, record.action, record.target, ...record.summary].join(' ').toLowerCase().includes(keyword.trim().toLowerCase())), [page, keyword, outcome]);
  const actors = useMemo(() => [...new Map(pages.flatMap(item => item.records).filter(record => record.actorId)
    .map(record => [record.actorId, record.actorName])).entries()], [pages]);

  const apply = (event: React.FormEvent) => {
    event.preventDefault();
    try { activityRange(draft.from, draft.to); } catch (caught) { setValidation((caught as Error).message); return; }
    setValidation(''); setKeyword(''); setOutcome('');
    if (JSON.stringify(draft) === JSON.stringify(filter)) { if (!busy.current) void load(); }
    else setFilter({ ...draft });
  };
  const filterActor = (record: ActivityRecord) => {
    setActorName(record.actorName); setDraft(value => ({ ...value, actorId: record.actorId }));
    setFilter(value => ({ ...value, actorId: record.actorId })); setKeyword('');
  };
  const next = () => {
    if (busy.current) return;
    setSelected(null); setError('');
    if (index + 1 < pages.length) setIndex(index + 1);
    else if (page?.hasMore && page.cursor) void load(page.cursor);
  };

  return <>
    <form className="activity-filters" onSubmit={apply}>
      <label>시작일<input aria-label="시작일" type="date" value={draft.from} onChange={event => setDraft({ ...draft, from: event.target.value })} /></label>
      <label>종료일<input aria-label="종료일" type="date" value={draft.to} onChange={event => setDraft({ ...draft, to: event.target.value })} /></label>
      <label>사용자<select aria-label="사용자" value={draft.actorId} onChange={event => { setDraft({ ...draft, actorId: event.target.value }); setActorName(actors.find(([id]) => id === event.target.value)?.[1] || actorName); }}>
        <option value="">전체 사용자</option>
        {draft.actorId && !actors.some(([id]) => id === draft.actorId) && <option value={draft.actorId}>{actorName || '선택한 사용자'}</option>}
        {actors.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
      </select></label>
      <button className="activity-primary" type="submit" disabled={loading}>조회</button>
      <button type="button" onClick={() => setDraft({ ...draft, from: koreanDay(), to: koreanDay() })}>오늘</button>
      <button type="button" onClick={() => setDraft({ ...draft, ...initialActivityDates() })}>최근 7일</button>
      {validation && <p role="alert" className="activity-error">{validation}</p>}
    </form>
    <p className="activity-hint">사용자 목록은 불러온 기록에서 표시합니다. 사용자 이름을 누르면 해당 사용자의 선택 기간 전체를 조회합니다.</p>
    <div className="activity-results-toolbar">
      <div><h2>{source.label} 내역</h2><p>{filter.from} ~ {filter.to} · 한국 시간{filter.actorId ? ` · ${actorName || '선택한 사용자'}` : ''}</p></div>
      <div className="activity-local-filters">
        <label><span className="activity-sr-only">현재 페이지 검색</span><input aria-label="현재 페이지 검색" placeholder="현재 페이지에서 검색" value={keyword} onChange={event => setKeyword(event.target.value)} /></label>
        <label><span className="activity-sr-only">처리 결과</span><select aria-label="처리 결과" value={outcome} onChange={event => setOutcome(event.target.value)}><option value="">모든 결과</option><option value="failed">실패</option><option value="success">성공</option><option value="info">기타 활동</option></select></label>
        <button type="button" disabled={loading} onClick={() => void load()}>새로고침</button>
      </div>
    </div>
    {error && <div className="activity-error" role="alert">{error} <button type="button" disabled={loading} onClick={() => void load(page?.hasMore ? page.cursor : null)}>다시 시도</button></div>}
    <div className="activity-table-wrap" aria-busy={loading}>
      <table className="activity-table"><caption className="activity-sr-only">{source.label} 활동 기록</caption><thead><tr><th>일시</th><th>사용자</th><th>활동</th><th>대상·내용</th><th>상세</th></tr></thead>
        <tbody>{visible.map(record => <tr key={record.id} className={selected?.id === record.id ? 'activity-selected' : ''}>
          <td className="activity-time">{time(record.time)}</td>
          <td>{record.actorId ? <button className="activity-actor" type="button" onClick={() => filterActor(record)} disabled={loading} title="이 사용자 기록 조회">{record.actorName}</button> : record.actorName}</td>
          <td><span className={`activity-badge activity-${record.outcome}`}>{record.action}</span></td>
          <td><strong>{record.target}</strong>{record.summary[0] && <small>{record.summary[0]}</small>}</td>
          <td><button type="button" aria-label={`${record.action} 상세 보기`} onClick={() => setSelected(selected?.id === record.id ? null : record)}>보기</button></td>
        </tr>)}</tbody></table>
      {loading && <p className="activity-empty" role="status">활동 내역을 불러오는 중입니다…</p>}
      {!loading && !error && !visible.length && <p className="activity-empty" role="status">{page?.records.length ? '현재 페이지에서 검색 조건에 맞는 기록이 없습니다. 다음 페이지도 확인해 주세요.' : '선택한 조건에 기록이 없습니다.'}</p>}
    </div>
    <div className="activity-pagination">
      <span>{index + 1}페이지 · {visible.length}건 표시 <small>(페이지당 최대 50건)</small></span>
      <div><button type="button" disabled={loading || index === 0} onClick={() => { setSelected(null); setError(''); setIndex(index - 1); }}>이전</button><button type="button" disabled={loading || !(index + 1 < pages.length || page?.hasMore)} onClick={next}>다음</button></div>
    </div>
    {selected && <ActivityDetail record={selected} close={() => setSelected(null)} />}
  </>;
}

export default function ActivityCenterPage() {
  const { currentUser } = useAuth();
  const location = useLocation(), navigate = useNavigate();
  const [access, setAccess] = useState<{ uid: string; sources: ActivitySource[]; error?: string } | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    if (!currentUser) { setAccess(null); return; }
    const uid = currentUser.uid;
    if (isDevAdminSessionEnabled()) { setAccess({ uid, sources: availableActivitySources({ role: 'admin', status: 'active' }) }); return; }
    void userService.getUser(uid).then(profile => {
      if (active) setAccess({ uid, sources: availableActivitySources(profile as unknown as Record<string, unknown> | null) });
    }).catch(() => { if (active) setAccess({ uid, sources: [], error: '조회 권한을 확인하지 못했습니다.' }); });
    return () => { active = false; };
  }, [currentUser, retry]);
  const sources = access?.uid === currentUser?.uid ? access?.sources || [] : [];
  const requested = activitySourceForPath(location.pathname + location.search);
  const selected = requested ? sources.find(item => item.id === requested.id) : sources[0];
  return <main className="activity-center">
    <header className="activity-heading"><div><span className="activity-eyebrow">업무 기록</span><h1>활동 내역</h1><p>접속부터 업무 변경까지, 필요한 기록을 한곳에서 확인하세요.</p></div>
      <span className="activity-mode">필요할 때 조회</span></header>
    {access?.uid !== currentUser?.uid ? <p role="status">조회 권한을 확인하는 중입니다…</p> : access?.error ? <p role="alert">{access.error} <button onClick={() => setRetry(value => value + 1)}>권한 다시 확인</button></p> : <>
      <section className="activity-source-bar" aria-label="기록 종류 선택"><label>기록 종류<select aria-label="기록 종류" value={selected?.id || ''} onChange={event => navigate(`/activity?source=${event.target.value}`)}>
        {!selected && <option value="">조회할 기록을 선택하세요</option>}
        {sources.map(source => <option key={source.id} value={source.id}>{source.label}</option>)}
      </select></label><p>선택한 종류만 조회합니다. 새 기록은 새로고침하면 반영됩니다.</p></section>
      {!selected ? <p role="alert">이 기록을 조회할 권한이 없습니다.</p>
        : selected.id === 'ai' ? <React.Suspense fallback={<p role="status">AI 사용량 화면을 준비하고 있습니다…</p>}><GeminiUsageLogPage embedded /></React.Suspense>
          : <ActivityBrowser key={`${currentUser?.uid}:${selected.id}`} source={selected} />}
    </>}
  </main>;
}
