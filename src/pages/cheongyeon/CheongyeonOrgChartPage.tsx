import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRight, faBuilding, faChevronDown, faChevronRight, faCircleExclamation, faList, faLocationDot, faMagnifyingGlass, faPrint, faRotateRight, faSitemap, faUserGroup, faUserTie, faXmark } from '@fortawesome/free-solid-svg-icons';
import type { Worker } from '../../services/manpowerService';
import { useOrganizationTree } from './hooks/useOrganizationTree';
import { buildOrganization, defaultCompany, matchesOrganizationQuery, OrganizationTeam, siteStatus, teamStatus, text, UNASSIGNED_COMPANY, visibleOrganizationTeams, workerRole } from './organizationModel';
import './CheongyeonOrgChartPage.css';

const number = (value: number) => value.toLocaleString('ko-KR');
const Avatar: React.FC<{ worker: Worker }> = ({ worker }) => {
    const [failed, setFailed] = useState(false);
    useEffect(() => setFailed(false), [worker.profileImageUrl]);
    return worker.profileImageUrl && !failed
        ? <img className="cy-org-avatar" src={worker.profileImageUrl} alt="" loading="lazy" onError={() => setFailed(true)} />
        : <span className="cy-org-avatar" aria-hidden="true">{worker.name.slice(0, 1)}</span>;
};

const CheongyeonOrgChartPage: React.FC = () => {
    const { data, loading, error, siteError, updatedAt, refresh } = useOrganizationTree();
    const groups = useMemo(() => data ? buildOrganization(data, !siteError) : [], [data, siteError]);
    const [companyId, setCompanyId] = useState('');
    const [query, setQuery] = useState('');
    const [status, setStatus] = useState('all');
    const [attention, setAttention] = useState(false);
    const [view, setView] = useState<'chart' | 'list'>('chart');
    const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [detailTab, setDetailTab] = useState<'people' | 'sites'>('people');
    const [memberQuery, setMemberQuery] = useState('');
    const [memberLimit, setMemberLimit] = useState(30);
    const [workerId, setWorkerId] = useState<string | null>(null);
    const detailRef = useRef<HTMLElement>(null);
    const detailHeading = useRef<HTMLHeadingElement>(null);
    const openerRef = useRef<HTMLButtonElement | null>(null);
    const company = groups.find(group => group.id === companyId) || groups.find(group => group.id === defaultCompany(groups));
    const teams = company?.teams || [];
    const filtered = useMemo(() => visibleOrganizationTeams(company?.teams || [], query, status, attention), [company, query, status, attention]);
    const selected = teams.find(team => team.id === selectedId && filtered.visibleIds.has(team.id));
    const filtering = Boolean(query.trim() || status !== 'all' || attention);
    const related = useMemo(() => {
        const children = new Map<string | null, OrganizationTeam[]>();
        for (const team of company?.teams || []) {
            if (!filtered.visibleIds.has(team.id)) continue;
            children.set(team.parentId, [...(children.get(team.parentId) || []), team]);
        }
        return children;
    }, [company, filtered]);
    const members = selected?.members.filter(worker => matchesOrganizationQuery(worker.name + ' ' + workerRole(worker), memberQuery)) || [];
    const focusedWorker = members.find(worker => worker.id === workerId);
    const memberCount = teams.reduce((sum, team) => sum + team.members.length, 0) + (company?.unassigned.length || 0);
    const siteCount = new Set(teams.flatMap(team => team.sites.filter(site => site.site).map(site => site.key))).size;
    const attentionCount = teams.filter(team => team.issues.length).length;

    useEffect(() => {
        document.body.classList.add('cy-organization-theme');
        return () => document.body.classList.remove('cy-organization-theme');
    }, []);
    useEffect(() => {
        if (selectedId && !selected) setSelectedId(null);
    }, [selectedId, selected]);
    useEffect(() => {
        if (!selectedId) return;
        detailHeading.current?.focus({ preventScroll: true });
        detailRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
    }, [selectedId]);

    const resetFilters = () => { setQuery(''); setStatus('all'); setAttention(false); };
    const changeCompany = (id: string) => { setCompanyId(id); setSelectedId(null); setCollapsed(new Set()); resetFilters(); };
    const selectTeam = (team: OrganizationTeam, button: HTMLButtonElement) => {
        openerRef.current = button;
        setSelectedId(team.id);
        setDetailTab('people');
        setWorkerId(null);
        setMemberLimit(30);
        setMemberQuery(query.trim() && team.members.some(worker => matchesOrganizationQuery(worker.name + ' ' + workerRole(worker), query)) ? query : '');
    };
    const closeDetails = () => { setSelectedId(null); openerRef.current?.focus(); };
    const toggle = (id: string) => setCollapsed(previous => {
        const next = new Set(previous);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
    });
    const print = () => {
        setCollapsed(new Set());
        window.requestAnimationFrame(() => window.requestAnimationFrame(() => window.print()));
    };

    const teamCard = (team: OrganizationTeam) => (
        <button type="button" className={'cy-org-team ' + (selected?.id === team.id ? 'is-selected ' : '') + (!filtered.matchedIds.has(team.id) ? 'is-context' : '')}
            onClick={event => selectTeam(team, event.currentTarget)} aria-pressed={selected?.id === team.id} aria-label={team.name + ' 팀 상세 보기'}>
            <span className="cy-org-team-top"><span className={'cy-org-status status-' + text(team.source.status)}>{teamStatus(team.source.status)}</span>
                {!filtered.matchedIds.has(team.id) && <span className="cy-org-context">상위 팀</span>}
                {team.issues.length > 0 && <span className="cy-org-alert-dot" title={team.issues.join(' · ')}><FontAwesomeIcon icon={faCircleExclamation} /><span className="cy-org-sr">정보 확인 필요</span></span>}
            </span>
            <strong className="cy-org-team-name">{team.name}</strong>
            <span className="cy-org-leader"><FontAwesomeIcon icon={faUserTie} />{team.leaderLabel}</span>
            <span className="cy-org-team-sites"><FontAwesomeIcon icon={faLocationDot} />
                {siteError ? '현장 정보 확인 불가' : team.sites.length ? team.sites.map(site => site.name).join(' · ') : '담당 현장 미등록'}</span>
            <span className="cy-org-team-bottom"><span><FontAwesomeIcon icon={faUserGroup} /> 구성원 <b>{number(team.members.length)}</b>명</span>
                <span className="cy-org-team-open">상세 보기 <FontAwesomeIcon icon={faArrowRight} /></span></span>
        </button>
    );
    const branch = (team: OrganizationTeam): React.ReactNode => {
        const children = related.get(team.id) || [];
        const isCollapsed = !filtering && collapsed.has(team.id);
        return <li className="cy-org-branch" key={team.id}>
            {teamCard(team)}
            {children.length > 0 && <>
                <button type="button" className="cy-org-branch-toggle" onClick={() => toggle(team.id)}
                    aria-expanded={!isCollapsed} aria-controls={'org-children-' + team.id} disabled={filtering}>
                    <FontAwesomeIcon icon={isCollapsed ? faChevronRight : faChevronDown} /> 하위 팀 {children.length}개 {isCollapsed ? '펼치기' : '접기'}
                </button>
                {!isCollapsed && <ul id={'org-children-' + team.id} className="cy-org-children">{children.map(branch)}</ul>}
            </>}
        </li>;
    };

    if (!data && loading) return <div className="cy-org cy-org-loading" role="status"><FontAwesomeIcon icon={faSitemap} /><h1>조직도를 불러오고 있습니다</h1><p>회사·팀·구성원·현장 정보를 연결하는 중입니다.</p></div>;
    if (!data && error) return <div className="cy-org cy-org-loading"><FontAwesomeIcon icon={faCircleExclamation} /><h1>조직도를 불러오지 못했습니다</h1><p role="alert">{error}</p><button className="cy-org-button is-primary" onClick={refresh}>다시 불러오기</button></div>;

    return <div className="cy-org">
        <div className="cy-org-shell">
            <header className="cy-org-header">
                <div><p className="cy-org-eyebrow"><span /> CHEONGYEON ENG · ORGANIZATION</p><h1>사람과 현장을 잇는 <em>조직도</em></h1>
                    <p className="cy-org-description">회사의 팀 구성부터 함께 일하는 동료, 담당 현장까지 살펴보세요.</p></div>
                <div className="cy-org-header-actions">
                    <button className="cy-org-button" onClick={refresh} disabled={loading}><FontAwesomeIcon icon={faRotateRight} spin={loading} />{loading ? '갱신 중' : '새로고침'}</button>
                    <button className="cy-org-button" onClick={print} disabled={!company}><FontAwesomeIcon icon={faPrint} /> 인쇄</button>
                </div>
            </header>
            {error && <div role="alert" className="cy-org-notice is-error">{error}</div>}
            {siteError && <div role="alert" className="cy-org-notice">{siteError}<button onClick={refresh} disabled={loading}>다시 조회</button></div>}
            <section className="cy-org-company-bar" aria-label="회사 선택">
                <div className="cy-org-brand-mark" aria-hidden="true">CY<span>ENG</span></div>
                <div className="cy-org-company-field"><label htmlFor="org-company">조회할 회사</label>
                    <select id="org-company" value={company?.id || ''} onChange={event => changeCompany(event.target.value)} disabled={!groups.length}>
                        {!groups.length && <option value="">등록된 회사 없음</option>}
                        {groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}
                    </select>
                    <span>{company?.type || '조직 정보'}<i /> 회사 → 상위 팀 → 하위 팀</span>
                </div>
                <div className="cy-org-updated"><span className={'cy-org-sync-dot ' + (error ? 'is-stale' : '')} />{updatedAt ? '조회 ' + updatedAt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '조회 정보 없음'}<small>새로고침으로 최신 정보를 확인하세요.</small></div>
            </section>
            <section className="cy-org-stats" aria-label="선택한 회사 전체 조직 현황">
                <div><span>등록 팀</span><strong>{number(teams.length)}<small>개</small></strong><p>운영 중 {number(teams.filter(team => team.source.status === 'active').length)}개</p></div>
                <div><span>재직 구성원</span><strong>{number(memberCount)}<small>명</small></strong><p>휴직 포함 · 퇴사·비활성 제외</p></div>
                <div><span>확인된 담당 현장</span><strong>{siteError ? '—' : number(siteCount)}<small>곳</small></strong><p>중복 없이 집계 · 완료 현장 포함</p></div>
                <button className={attention ? 'is-active' : ''} onClick={() => setAttention(previous => !previous)} aria-pressed={attention}>
                    <span>정보 확인이 필요한 팀 <FontAwesomeIcon icon={faArrowRight} /></span><strong>{number(attentionCount)}<small>개</small></strong><p>팀장 지정 · 조직·현장 연결</p>
                </button>
            </section>
            {company?.id === UNASSIGNED_COMPANY && <div className="cy-org-notice">회사가 연결되지 않았거나 기존 연결을 찾을 수 없는 조직입니다. 특정 회사의 인원으로 합산하지 않습니다.</div>}
            {company && company.unassigned.length > 0 && <details className="cy-org-unassigned"><summary><FontAwesomeIcon icon={faCircleExclamation} /> 팀 미배정 구성원 {company.unassigned.length}명 <span>구성원 확인</span></summary>
                <p>{company.id === UNASSIGNED_COMPANY ? '회사와 팀의 소속 관계를 확인할 수 없는 구성원입니다.' : '이 회사에 등록되어 있지만 소속 팀을 확인할 수 없는 구성원입니다.'}</p>
                <div>{company.unassigned.map(worker => <span key={worker.id}>{worker.name}<small>{workerRole(worker)}</small></span>)}</div>
            </details>}
            <section className="cy-org-workspace" aria-labelledby="org-chart-title">
                <div className="cy-org-workspace-heading"><div><p className="cy-org-eyebrow">ORGANIZATION EXPLORER</p><h2 id="org-chart-title">{company?.name || '회사'} 팀 구성</h2></div>
                    <div className="cy-org-view-switch" role="group" aria-label="조직도 보기 방식">
                        <button aria-pressed={view === 'chart'} onClick={() => setView('chart')}><FontAwesomeIcon icon={faSitemap} /> 조직도</button>
                        <button aria-pressed={view === 'list'} onClick={() => setView('list')}><FontAwesomeIcon icon={faList} /> 목록</button>
                    </div>
                </div>
                <div className="cy-org-toolbar">
                    <label className="cy-org-search"><FontAwesomeIcon icon={faMagnifyingGlass} /><input type="search" value={query} onChange={event => setQuery(event.target.value)}
                        placeholder="팀·이름·직무·현장 검색 (초성 가능)" aria-label="팀, 구성원, 직무 또는 현장 검색" />{query && <button onClick={() => setQuery('')} aria-label="검색어 지우기"><FontAwesomeIcon icon={faXmark} /></button>}</label>
                    <label className="cy-org-status-select"><span>팀 상태</span><select aria-label="팀 상태" value={status} onChange={event => setStatus(event.target.value)}>
                        <option value="all">모든 상태</option><option value="active">운영 중</option><option value="waiting">대기</option><option value="closed">종료</option>
                    </select></label>
                </div>
                <div className="cy-org-results-bar"><p role="status">{filtering ? '검색 결과 ' : '전체 '}<strong>{filtered.matched.length}개 팀</strong>{filtering && ' / 전체 ' + teams.length + '개'}{attention && <span className="cy-org-filter-tag">정보 확인 필요</span>}</p>
                    <div>{filtering && <button onClick={resetFilters}>필터 초기화</button>}{view === 'chart' && teams.some(team => team.parentId) && <>
                        <button onClick={() => setCollapsed(new Set())} disabled={filtering}>모두 펼치기</button><button onClick={() => setCollapsed(new Set(teams.map(team => team.id)))} disabled={filtering}>모두 접기</button>
                    </>}</div>
                </div>
                <div className={'cy-org-explorer ' + (selected ? 'has-details' : '')}>
                    <div className="cy-org-map">
                        {!filtered.matched.length ? <div className="cy-org-empty"><FontAwesomeIcon icon={faSitemap} /><h3>{teams.length ? '조건에 맞는 팀이 없습니다' : '아직 연결된 팀이 없습니다'}</h3>
                            <p>{teams.length ? '다른 검색어나 팀 상태로 다시 찾아보세요.' : '회사와 팀의 소속 관계가 등록되면 여기에 표시됩니다.'}</p>{filtering && <button className="cy-org-button" onClick={resetFilters}>필터 초기화</button>}</div>
                            : view === 'chart' ? <>
                                <div className="cy-org-root"><FontAwesomeIcon icon={faBuilding} /><div><small>{company?.type}</small><strong>{company?.name}</strong></div><span>{teams.length}개 팀</span></div>
                                <ul className="cy-org-forest" aria-label="회사별 팀 관계">{(related.get(null) || []).map(branch)}</ul>
                            </> : <div className="cy-org-table-scroll"><table className="cy-org-table"><caption className="cy-org-sr">검색 조건에 맞는 팀 목록</caption><thead><tr><th scope="col">팀 / 팀장</th><th scope="col">상위 팀</th><th scope="col">상태</th><th scope="col">구성원</th><th scope="col">담당 현장</th><th scope="col"><span className="cy-org-sr">정보 상태</span></th></tr></thead>
                                <tbody>{filtered.matched.map(team => <tr key={team.id} className={selected?.id === team.id ? 'is-selected' : ''}>
                                    <th scope="row"><button onClick={event => selectTeam(team, event.currentTarget)} aria-label={team.name + ' 팀 상세 보기'}>{team.name}<small>{team.leaderLabel}</small></button></th>
                                    <td>{teams.find(parent => parent.id === team.parentId)?.name || '회사 직속'}</td><td><span className={'cy-org-status status-' + text(team.source.status)}>{teamStatus(team.source.status)}</span></td>
                                    <td>{team.members.length}명</td><td>{siteError ? '확인 불가' : team.sites.length + '곳'}</td><td>{team.issues.length > 0 && <span className="cy-org-table-issue">확인 필요</span>}</td>
                                </tr>)}</tbody></table></div>}
                        <p className="cy-org-map-note">연결선은 등록된 상·하위 팀 관계입니다. 팀을 선택하면 구성원과 현장을 확인할 수 있습니다.</p>
                    </div>
                    {selected && <aside ref={detailRef} className="cy-org-detail" aria-labelledby="org-detail-title" onKeyDown={event => { if (event.key === 'Escape') closeDetails(); }}>
                        <header><div><p className="cy-org-eyebrow">TEAM DETAIL</p><h3 ref={detailHeading} tabIndex={-1} id="org-detail-title">{selected.name}</h3></div><button onClick={closeDetails} aria-label="팀 상세 닫기"><FontAwesomeIcon icon={faXmark} /></button></header>
                        <div className="cy-org-detail-meta"><span className={'cy-org-status status-' + text(selected.source.status)}>{teamStatus(selected.source.status)}</span><span><FontAwesomeIcon icon={faUserTie} /> {selected.leaderLabel}</span></div>
                        {selected.parentId && <p className="cy-org-parent-label">상위 팀 · {teams.find(team => team.id === selected.parentId)?.name}</p>}
                        {selected.issues.length > 0 && <ul className="cy-org-detail-issues">{selected.issues.map(issue => <li key={issue}><FontAwesomeIcon icon={faCircleExclamation} /> {issue}</li>)}</ul>}
                        <div className="cy-org-detail-tabs" role="group" aria-label="팀 상세 정보">
                            <button aria-pressed={detailTab === 'people'} onClick={() => setDetailTab('people')}>구성원 <b>{selected.members.length}</b></button>
                            <button aria-pressed={detailTab === 'sites'} onClick={() => setDetailTab('sites')}>담당 현장 <b>{siteError ? '—' : selected.sites.length}</b></button>
                        </div>
                        {detailTab === 'people' ? <div className="cy-org-detail-body">
                            <label className="cy-org-member-search"><FontAwesomeIcon icon={faMagnifyingGlass} /><input type="search" aria-label="선택한 팀 구성원 검색" placeholder="이름·직무 검색" value={memberQuery}
                                onChange={event => { setMemberQuery(event.target.value); setMemberLimit(30); setWorkerId(null); }} /></label>
                            <p className="cy-org-count-note">{members.length}명 표시 · 구성원을 선택해 배정 정보를 확인하세요.</p>
                            <div className="cy-org-member-list">{members.slice(0, memberLimit).map(worker => <button key={worker.id} className={workerId === worker.id ? 'is-selected' : ''}
                                onClick={() => setWorkerId(worker.id!)} aria-pressed={workerId === worker.id}>
                                <Avatar worker={worker} /><span><strong>{worker.name}{selected.leader?.id === worker.id && <i>팀장</i>}</strong><small>{workerRole(worker)}</small></span><em>{text(worker.status) || '상태 미등록'}</em>
                            </button>)}</div>
                            {!members.length && <p className="cy-org-detail-empty">{memberQuery ? '검색된 구성원이 없습니다.' : '등록된 재직 구성원이 없습니다.'}</p>}
                            {members.length > memberLimit && <button className="cy-org-more" onClick={() => setMemberLimit(limit => limit + 30)}>구성원 더 보기 ({members.length - memberLimit}명)</button>}
                            {focusedWorker && <section className="cy-org-person-detail" aria-label="선택한 구성원 정보"><strong>{focusedWorker.name}</strong><dl><div><dt>소속 팀</dt><dd>{selected.name}</dd></div><div><dt>직무</dt><dd>{workerRole(focusedWorker)}</dd></div>
                                <div><dt>등록 현장</dt><dd>{siteError ? '현장 정보 확인 불가' : focusedWorker.siteId ? data?.sites.find(site => site.id === focusedWorker.siteId)?.name || '현장 연결 확인 필요' : text(focusedWorker.siteName) || '현장 미배정'}</dd></div></dl></section>}
                        </div> : <div className="cy-org-detail-body">
                            {siteError ? <p role="status" className="cy-org-detail-empty">현장 정보를 다시 조회한 뒤 확인해 주세요.</p> : selected.sites.length ? <>
                                <p className="cy-org-count-note">배정 인원은 현장 연결이 확인된 구성원만 집계합니다.</p>
                                {selected.sites.map(entry => <article className="cy-org-site-card" key={entry.key}><div><FontAwesomeIcon icon={faLocationDot} /><h4>{entry.name}</h4></div>
                                    {entry.site ? <><p>{text(entry.site.address) || '주소 미등록'}</p><dl><div><dt>현장 상태</dt><dd>{siteStatus(entry.site.status)}</dd></div><div><dt>이 팀의 확인된 배정 인원</dt><dd>{entry.members.length}명</dd></div></dl>
                                        {entry.site.code && <small>현장 코드 · {entry.site.code}</small>}</> : <p className="cy-org-unresolved">연결 확인 필요 · 등록된 현장을 찾을 수 없거나 같은 이름의 현장이 여러 곳입니다.</p>}
                                </article>)}
                            </> : <p className="cy-org-detail-empty">등록된 담당 현장이 없습니다.</p>}
                        </div>}
                    </aside>}
                </div>
            </section>
            <footer className="cy-org-footer"><span><FontAwesomeIcon icon={faSitemap} /> 조직을 읽는 방법</span><p>회사별 소속 팀과 재직 구성원을 기준으로 표시합니다. 현장 배정 인원은 출근 인원과 다르며, 누락된 정보는 임의로 채우지 않습니다.</p><small>CHEONGYEON ENG · 함께 일하는 조직을 더 가깝게</small></footer>
        </div>
    </div>;
};
export default CheongyeonOrgChartPage;
