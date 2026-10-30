import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useReactToPrint } from 'react-to-print';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faChevronRight, faPrint, faRotateRight, faTable } from '@fortawesome/free-solid-svg-icons';
import { FileSpreadsheet, List, StickyNote } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { advanceRequestService, type AdvanceRequest } from '../../services/advanceRequestService';
import { advancePaymentMemoService, type AdvancePaymentMemoChange } from '../../services/advancePaymentMemoService';
import { teamService } from '../../services/teamService';
import { companyService } from '../../services/companyService';
import { manpowerService } from '../../services/manpowerService';
import { userService } from '../../services/userService';
import { ADVANCE_REQUEST_CATEGORIES, ADVANCE_REQUEST_ROUNDS, ADVANCE_REQUEST_CATEGORY_LABELS, getAdvanceRequestCategory } from '../../types/advanceRequestCategory';
import { ADVANCE_DEPOSIT_ACCOUNTS } from '../../types/advancePaymentDepositAccount';
import { UserRole } from '../../types/roles';
import { shiftYearMonth } from '../../components/common/MonthNavigator';
import { getKoreanDateKey } from '../../utils/koreanBusinessDate';
import { normalizeHexColor } from '../../utils/color';
import { buildAdvanceSummary, isAdvanceSummaryFilter, isAdvanceSummaryMonth, type AdvanceSummaryTeam, type AdvanceSummaryRow, type AdvanceSummaryWorker } from './utils/advanceSummary';
import AdvanceSummaryMemoDialog from './components/AdvanceSummaryMemoDialog';
import AdvanceSummaryDepositAccountSelect from './components/AdvanceSummaryDepositAccountSelect';
import AdvanceSummaryTeamLayout, { type AdvanceSummaryLayout } from './components/AdvanceSummaryTeamLayout';
import AdvanceSummaryFitTable from './components/AdvanceSummaryFitTable';
import AdvancePrepaymentDialog from './components/AdvancePrepaymentDialog';
import AdvanceKBExportDialog from './components/AdvanceKBExportDialog';
import type { AdvanceKBExportSource } from './utils/advanceSummaryKBExport';
import { advancePaymentDepositAccountService, type AdvancePaymentDepositAccountChange } from '../../services/advancePaymentDepositAccountService';
import './AdvanceSummaryPage.css';

type LoadResult = {
    uid: string;
    month: string;
    status: 'loading' | 'ready' | 'denied' | 'error';
    requests: AdvanceRequest[];
    teams: AdvanceSummaryTeam[];
    workers: AdvanceSummaryWorker[];
};
const emptyResult = { requests: [], teams: [], workers: [] };
const won = (amount: number) => amount.toLocaleString('ko-KR');
const companyKey = (value?: string | null) => String(value ?? '').replace(/\s*소속팀\s*$/, '').replace(/\s+/g, '').toLowerCase();

const AdvanceSummaryPage: React.FC = () => {
    const { currentUser } = useAuth();
    const uid = currentUser?.uid ?? '';
    const [params, setParams] = useSearchParams();
    const rawMonth = params.get('yearMonth') || '';
    const yearMonth = isAdvanceSummaryMonth(rawMonth) ? rawMonth : getKoreanDateKey().slice(0, 7);
    const teamId = params.get('teamId') || '';
    const rawItem = params.get('item') || 'all';
    const item = isAdvanceSummaryFilter(rawItem) ? rawItem : 'all';
    const [query, setQuery] = useState('');
    const [layout, setLayout] = useState<AdvanceSummaryLayout>('compact');
    const [refresh, setRefresh] = useState(0);
    const [result, setResult] = useState<LoadResult>({ ...emptyResult, uid: '', month: '', status: 'loading' });
    const [memoEditor, setMemoEditor] = useState<{ uid: string; month: string; teamName: string; row: AdvanceSummaryRow } | null>(null);
    const [saveMessage, setSaveMessage] = useState('');
    const [savingDepositAccount, setSavingDepositAccount] = useState(false);
    const [prepaymentWorker, setPrepaymentWorker] = useState<string | null>(null);
    const [savingCategory, setSavingCategory] = useState(false);
    const [kbExport, setKbExport] = useState<{ contextKey: string; result: LoadResult; source: AdvanceKBExportSource } | null>(null);
    const kbContextKey = JSON.stringify([uid, yearMonth, teamId, item, query]);
    const categoryPending = useRef(false);
    const depositAccountPending = useRef(false);
    const reportRef = useRef<HTMLDivElement>(null);
    const pageRef = useRef<HTMLDivElement>(null);
    const teamNavRef = useRef<HTMLDivElement>(null);
    const teamRefs = useRef(new Map<string, HTMLElement>());

    const updateFilter = (key: string, value: string) => setParams(previous => {
        const next = new URLSearchParams(previous);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
    }, { replace: true });

    const resetFilters = () => {
        setQuery('');
        setParams(previous => {
            const next = new URLSearchParams(previous);
            next.delete('teamId');
            next.delete('item');
            return next;
        }, { replace: true });
    };

    const goToTeam = (id: string) => {
        const target = teamRefs.current.get(id);
        const page = pageRef.current;
        if (!target || !page) return;
        target.focus({ preventScroll: true });
        const top = page.scrollTop + target.getBoundingClientRect().top - page.getBoundingClientRect().top
            - (teamNavRef.current?.getBoundingClientRect().height || 0) - 12;
        const behavior = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
        page.scrollTo({ top: Math.max(0, top), behavior });
        const viewport = target.closest<HTMLElement>('.as-team-viewport');
        if (viewport) {
            const card = target.getBoundingClientRect();
            const bounds = viewport.getBoundingClientRect();
            if (card.left < bounds.left || card.right > bounds.right) {
                viewport.scrollTo({ left: Math.max(0, viewport.scrollLeft + card.left - bounds.left - 8), behavior });
            }
        }
    };

    useEffect(() => { setMemoEditor(null); setPrepaymentWorker(null); setSaveMessage(''); }, [uid, yearMonth]);
    useEffect(() => { setKbExport(null); }, [kbContextKey, result]);

    useEffect(() => {
        let cancelled = false;
        const commit = (data: Partial<LoadResult>) => {
            if (!cancelled) setResult({ ...emptyResult, uid, month: yearMonth, status: 'loading', ...data });
        };
        commit({});
        const load = async () => {
            if (!uid) { commit({ status: 'denied' }); return; }
            try {
                // Match access to the existing advance/deduction entry page before reading financial records.
                const user = await userService.getUser(uid);
                if (cancelled) return;
                if (user?.role !== 'admin' && user?.role !== UserRole.ADMIN) {
                    const worker = await manpowerService.getWorkerByUid(uid);
                    const company = worker?.companyId ? await companyService.getCompanyById(worker.companyId) : null;
                    if (cancelled) return;
                    if (company?.type !== '시공사') { commit({ status: 'denied' }); return; }
                }
                const [teams, companies, requests, workers] = await Promise.all([
                    teamService.getTeams(), companyService.getCompaniesByType('시공사'),
                    advanceRequestService.listByYearMonth(yearMonth),
                    manpowerService.getWorkers(refresh > 0),
                ]);
                const companyIds = new Set(companies.map(company => company.id).filter(Boolean));
                const companyNames = new Set(companies.map(company => companyKey(company.name)).filter(Boolean));
                const allowedTeams = teams.filter(team => team.id && (team.companyId
                    ? companyIds.has(team.companyId) : companyNames.has(companyKey(team.companyName))))
                    .map(team => ({ id: team.id!, legacyId: team.legacyId, name: team.name, color: team.color }))
                    .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
                commit({ status: 'ready', requests, teams: allowedTeams,
                    workers: workers.map(({ id, legacyId, bankName, accountNumber, accountHolder, name, teamId, teamName }) => ({ id, legacyId, bankName, accountNumber, accountHolder, name, teamId, teamName })) });
            } catch {
                commit({ status: 'error' });
            }
        };
        void load();
        return () => { cancelled = true; };
    }, [uid, yearMonth, refresh]);

    const status = result.uid === uid && result.month === yearMonth ? result.status : 'loading';
    const summary = useMemo(() => buildAdvanceSummary(status === 'ready' ? result.requests : [], result.teams,
        { yearMonth, teamId, item, query }, result.workers), [status, result.requests, result.teams, result.workers, yearMonth, teamId, item, query]);
    const selectedTeam = result.teams.find(team => team.id === teamId || team.legacyId === teamId);
    const unclassified = useMemo(() => buildAdvanceSummary(status === 'ready' ? result.requests : [], result.teams,
        { yearMonth, teamId, item: 'unclassified', query }, result.workers), [status, result.requests, result.teams, result.workers, yearMonth, teamId, query]);
    const unclassifiedIds = new Set(unclassified.groups.flatMap(group => group.rows.flatMap(row => row.memoSources.map(source => source.id))));
    const manualWorkers = result.workers.filter(worker => worker.id && worker.teamId && result.teams.some(team => team.id === worker.teamId || team.legacyId === worker.teamId));
    const prepaymentAmounts = new Map(result.requests.filter(request => request.source === 'manual-prepayment' && request.yearMonth === yearMonth)
        .map(request => [request.workerId, request.requestedAmount]));
    const itemLabel = item === 'all' ? '전체 신청' : ADVANCE_REQUEST_CATEGORY_LABELS[item];
    const visibleCategories = item === 'all' ? ADVANCE_REQUEST_CATEGORIES : [item];
    const monthLabel = `${Number(yearMonth.slice(0, 4))}년 ${Number(yearMonth.slice(5))}월`;
    const printReport = useReactToPrint({ contentRef: reportRef, documentTitle: `팀별 가불내역_${yearMonth}`,
        pageStyle: '@page { size: A4 landscape; margin: 10mm; }' });

    const saveMemos = async (changes: AdvancePaymentMemoChange[]) => {
        const editor = memoEditor;
        if (!editor || editor.uid !== uid || editor.month !== yearMonth || status !== 'ready') return;
        await advancePaymentMemoService.save(changes, 'advance_requests');
        const savedById = new Map(changes.map(change => [change.id, change.memo]));
        setResult(current => current.uid !== editor.uid || current.month !== editor.month ? current : {
            ...current,
            requests: current.requests.map(request => request.id && savedById.has(request.id)
                ? { ...request, memo: savedById.get(request.id)! } : request),
        });
        setMemoEditor(current => current === editor ? null : current);
        setSaveMessage('비고를 저장했습니다.');
    };

    const savePrepayment = async (workerId: string, amount: number, expectedAmount: number) => {
        await advanceRequestService.setPrepayment(workerId, yearMonth, amount, expectedAmount);
        setPrepaymentWorker(null);
        setRefresh(value => value + 1);
        setSaveMessage('선입금을 저장했습니다.');
    };
    const fixCategory = async (request: AdvanceRequest, category: 'first' | 'second') => {
        if (!request.id || categoryPending.current) return;
        categoryPending.current = true; setSavingCategory(true); setSaveMessage('');
        try {
            await advanceRequestService.setCategory(request.id, category, getAdvanceRequestCategory(request));
            setResult(current => current.uid !== uid || current.month !== yearMonth ? current : {
                ...current, requests: current.requests.map(row => row.id === request.id ? { ...row, category } : row),
            });
            setSaveMessage('신청 회차를 수정했습니다.');
        } catch { setSaveMessage('회차를 수정하지 못했습니다. 새로고침 후 다시 선택해 주세요.'); }
        finally { categoryPending.current = false; setSavingCategory(false); }
    };

    const saveDepositAccounts = async (changes: AdvancePaymentDepositAccountChange[]) => {
        if (depositAccountPending.current || status !== 'ready') throw new Error('가불내역을 불러온 뒤 다시 선택해 주세요.');
        depositAccountPending.current = true;
        setSavingDepositAccount(true);
        try {
            await advancePaymentDepositAccountService.save(changes, 'advance_requests');
            const savedById = new Map(changes.map(change => [change.id, change.depositAccount]));
            setResult(current => current.uid !== uid || current.month !== yearMonth ? current : {
                ...current,
                requests: current.requests.map(request => request.id && savedById.has(request.id)
                    ? { ...request, depositAccount: savedById.get(request.id)! } : request),
            });
        } finally {
            depositAccountPending.current = false;
            setSavingDepositAccount(false);
        }
    };

    return (
        <div ref={pageRef} className="advance-summary-page">
            <header className="as-header">
                <div>
                    <h1><FontAwesomeIcon icon={faTable} /> 팀별 가불내역</h1>
                </div>
                <div className="as-actions">
                    <Link to="/payroll/advance-request">가불 신청</Link>
                    <button type="button" className="as-kb-trigger" disabled={status !== 'ready' || !summary.groups.length || savingDepositAccount || savingCategory}
                        onClick={() => setKbExport({ contextKey: kbContextKey, result, source: {
                            groups: summary.groups, yearMonth, teamLabel: selectedTeam?.name || '전체 팀',
                            categoryLabel: itemLabel, query, createdAtIso: new Date().toISOString(),
                        } })}><FileSpreadsheet size={15} />국민은행용 엑셀</button>
                    <button type="button" onClick={() => setRefresh(value => value + 1)} disabled={status === 'loading' || savingDepositAccount}>
                        <FontAwesomeIcon icon={faRotateRight} /> 새로고침
                    </button>
                    <button type="button" className="as-primary" onClick={() => printReport()} disabled={status !== 'ready' || !summary.groups.length || savingDepositAccount}>
                        <FontAwesomeIcon icon={faPrint} /> 인쇄 / PDF
                    </button>
                </div>
            </header>

            <section className="as-controls" aria-label="가불내역 조회 조건">
                <div className="as-month-control">
                    <span className="as-label">조회 월</span>
                    <div>
                        <button type="button" aria-label="이전 달" onClick={() => updateFilter('yearMonth', shiftYearMonth(yearMonth, -1))}><FontAwesomeIcon icon={faChevronLeft} /></button>
                        <input aria-label="조회 월" type="month" value={yearMonth} onChange={event => {
                            if (isAdvanceSummaryMonth(event.target.value)) updateFilter('yearMonth', event.target.value);
                        }} />
                        <button type="button" aria-label="다음 달" onClick={() => updateFilter('yearMonth', shiftYearMonth(yearMonth, 1))}><FontAwesomeIcon icon={faChevronRight} /></button>
                    </div>
                </div>
                <label>팀 선택
                    <select aria-label="팀 선택" value={selectedTeam?.id || teamId} onChange={event => updateFilter('teamId', event.target.value)}>
                        <option value="">전체 팀</option>
                        {teamId && !selectedTeam && <option value={teamId}>선택한 팀 (조회 불가)</option>}
                        {result.teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
                    </select>
                </label>
                <label className="as-search">이름·팀·비고 검색
                    <input type="search" value={query} placeholder="검색어를 입력하세요" onChange={event => setQuery(event.target.value)} />
                </label>
                {(teamId || item !== 'all' || query) && <button type="button" className="as-reset" onClick={resetFilters}>검색·필터 초기화</button>}
            </section>
            {saveMessage && <p className="as-save-message" role="status">{saveMessage}</p>}
            {status === 'ready' && unclassifiedIds.size > 0 && <details className="as-unclassified" open>
                <summary>회차 미지정 {unclassifiedIds.size}건 · {won(unclassified.total)}원 — 1회차 또는 2회차를 선택해 주세요.</summary>
                {result.requests.filter(request => request.id && unclassifiedIds.has(request.id)).map(request => <div key={request.id}>
                    <span>{request.workerName} · {won(request.requestedAmount)}원</span>
                    {ADVANCE_REQUEST_ROUNDS.map(round => <button key={round} type="button" disabled={savingCategory}
                        aria-label={`${request.workerName} ${won(request.requestedAmount)}원 ${ADVANCE_REQUEST_CATEGORY_LABELS[round]}로 지정`}
                        onClick={() => void fixCategory(request, round)}>{ADVANCE_REQUEST_CATEGORY_LABELS[round]}</button>)}
                </div>)}
            </details>}

            {status === 'loading' && <div className="as-empty" role="status">가불내역을 불러오고 있습니다.</div>}
            {status === 'denied' && <div className="as-empty" role="alert">시공사 계정과 관리자만 가불내역을 조회할 수 있습니다.</div>}
            {status === 'error' && <div className="as-empty as-error" role="alert">
                <strong>가불내역을 불러오지 못했습니다.</strong><p>연결 상태와 조회 권한을 확인한 뒤 다시 시도해 주세요.</p>
                <button type="button" onClick={() => setRefresh(value => value + 1)}>다시 시도</button>
            </div>}
            {status === 'ready' && <div ref={reportRef} className="as-report">
                <div className="as-report-title"><h2>{monthLabel} 가불내역</h2><p>
                    {selectedTeam?.name || (teamId ? '조회할 수 없는 팀' : '전체 팀')} · {itemLabel}{query.trim() ? ` · 검색: ${query.trim()}` : ''}<span>단위: 원</span>
                </p></div>
                <dl className="as-totals" aria-label="조회 결과 합계">
                    <div className="as-total-main"><dt>가불 합계</dt><dd>{won(summary.total)}<small>원</small></dd></div>
                    {ADVANCE_REQUEST_CATEGORIES.map(category => <div key={category}><dt>{ADVANCE_REQUEST_CATEGORY_LABELS[category]}</dt><dd>{won(summary[category])}<small>원</small></dd></div>)}
                    <div><dt>조회 인원 / 팀</dt><dd>{summary.workerCount}<small>명</small><span> / </span>{summary.groups.length}<small>팀</small></dd></div>
                </dl>
                <dl className="as-deposit-totals" aria-label="입금계좌별 합계">
                    {ADVANCE_DEPOSIT_ACCOUNTS.map(account => <div key={account.value} className={`as-deposit-${account.value}`} role="group" aria-label={`${account.label} 총액`}>
                        <dt>{account.label} 총액</dt><dd>{won(summary.depositTotals[account.value])}<small>원</small></dd>
                    </div>)}
                    {summary.depositTotals.unclassified > 0 && <div className="as-deposit-none" role="group" aria-label="미선택·기존 구분"><dt>미선택·기존 구분</dt><dd>{won(summary.depositTotals.unclassified)}<small>원</small></dd></div>}
                </dl>
                <div ref={teamNavRef} className="as-team-tools">
                    <div className="as-toolbar-row">
                        <div className="as-category-actions">
                            <div className="as-category-filter" role="group" aria-label="목록 신청 분류">
                                <span>신청 분류</span>
                                <button type="button" aria-pressed={item === 'all'} onClick={() => updateFilter('item', 'all')}>전체</button>
                                {ADVANCE_REQUEST_CATEGORIES.map(category => <button key={category} type="button"
                                    aria-pressed={item === category} onClick={() => updateFilter('item', category)}>{ADVANCE_REQUEST_CATEGORY_LABELS[category]}</button>)}
                            </div>
                            <button type="button" className="as-manual-entry" onClick={() => setPrepaymentWorker('')}>선입금 수기 입력</button>
                        </div>
                        <div className="as-view-switch" role="group" aria-label="팀 목록 보기 방식">
                            <button type="button" aria-pressed={layout === 'wide'} onClick={() => setLayout('wide')}><List size={16} />한 팀씩 넓게</button>
                            <button type="button" aria-pressed={layout === 'compact'} onClick={() => setLayout('compact')}><FileSpreadsheet size={16} />엑셀형 · 4개씩</button>
                        </div>
                    </div>
                    <nav className="as-team-jumps" aria-label="팀 바로가기">
                        <strong className="as-team-count">{summary.groups.length}개 팀 가불내역</strong>
                        {summary.groups.map(group => <button type="button" key={group.team.id} onClick={() => goToTeam(group.team.id)}
                            aria-label={`${group.team.name} 가불내역으로 이동`}>
                            <span className="as-team-dot" style={{ backgroundColor: normalizeHexColor(group.team.color, '#2563eb') }} />
                            <strong>{group.team.name}</strong><span>{group.rows.length}명</span><b>{won(group.total)}원</b>
                        </button>)}
                    </nav>
                </div>
                {summary.groups.length === 0 ? <div className="as-empty" role="status">
                    <strong>조회 조건에 맞는 가불내역이 없습니다.</strong><p>다른 월·팀·가불 항목을 선택하거나 검색어를 확인해 주세요.</p>
                </div> : <AdvanceSummaryTeamLayout mode={layout}>
                    {summary.groups.map(group => {
                        const color = normalizeHexColor(group.team.color, '#2563eb');
                        return <section key={group.team.id} className="as-team" tabIndex={-1}
                            ref={element => { if (element) teamRefs.current.set(group.team.id, element); else teamRefs.current.delete(group.team.id); }}
                            aria-label={`${group.team.name} 가불내역`} style={{ '--as-team-color': color } as React.CSSProperties}>
                            <div className="as-team-heading">
                                <div className="as-team-title"><h3>{group.team.name}</h3><span>{group.rows.length}명</span></div>
                                <div className="as-team-heading-total"><small>팀 합계</small><strong>{won(group.total)}원</strong></div>
                            </div>
                            <AdvanceSummaryFitTable label={`${group.team.name} 가불내역 표`}>
                            <table>
                                <caption className="sr-only">{group.team.name} 가불내역, 단위 원</caption>
                                <colgroup><col className="as-col-no" /><col className="as-col-name" />
                                    {visibleCategories.map(category => <col key={category} className="as-col-category" />)}
                                    <col className="as-col-amount" /><col className="as-col-deposit" /><col className="as-col-memo" /></colgroup>
                                <thead><tr><th scope="col">번호</th><th scope="col">이름</th>
                                    {visibleCategories.map(category => <th key={category} scope="col">{ADVANCE_REQUEST_CATEGORY_LABELS[category]}</th>)}
                                    <th scope="col">총금액</th><th scope="col">입금구분</th><th scope="col">비고</th></tr></thead>
                                <tbody>{group.rows.map((row, index) => <React.Fragment key={row.key}><tr>
                                    <td className="as-number">{index + 1}</td>
                                    <th scope="row"><span className="as-worker-name" title={row.workerName}>{row.workerName}</span></th>
                                    {visibleCategories.map(category => <td key={category} className="as-money as-category-money" data-label={ADVANCE_REQUEST_CATEGORY_LABELS[category]}>
                                        {category === 'other' ? <button type="button" className="as-prepayment-edit" aria-label={`${row.workerName} 선입금 수기 입력`} onClick={() => setPrepaymentWorker(row.workerId)}>{won(row.items.other || 0)}</button> : won(row.items[category] || 0)}
                                    </td>)}
                                    <td className="as-money as-total-money" data-label="총금액">{won(row.amount)}</td>
                                    <td className="as-deposit" data-label="입금계좌">
                                        <AdvanceSummaryDepositAccountSelect key={`${uid}/${yearMonth}/${group.team.id}/${row.key}`}
                                            label={`${group.team.name} ${row.workerName} 입금계좌`} sources={row.depositAccountSources}
                                            disabled={savingDepositAccount} onSave={saveDepositAccounts} />
                                    </td>
                                    <td className="as-memo">
                                        <span className="as-memo-print">{row.memos.join('\n')}</span>
                                        <button type="button" className={`as-memo-edit${row.memos.length ? ' as-memo-filled' : ''}`} aria-haspopup="dialog" aria-label={`${group.team.name} ${row.workerName} 비고 수정`}
                                            title={row.memos.length ? '메모 있음 · 보기 / 수정' : '새 메모 작성'}
                                            disabled={row.memoSources.some(source => !source.id)}
                                            onClick={() => { setSaveMessage(''); setMemoEditor({ uid, month: yearMonth, teamName: group.team.name, row }); }}>
                                            <StickyNote size={18} aria-hidden="true" />{row.memos.length > 0 && <span className="as-memo-indicator" aria-hidden="true" />}
                                        </button>
                                    </td>
                                </tr><tr className="as-account-row" aria-label={`${index + 1}번 계좌정보`}>
                                    <td className="as-account" colSpan={visibleCategories.length + 5}>
                                        <small>계좌</small>{row.bankName && <small>{row.bankName}</small>}
                                        <span>{row.accountNumber || '미등록'}</span>
                                        <span className="as-account-holder"><small>예금주</small><span>{row.accountHolder || '미등록'}</span></span>
                                        {!!row.items.unclassified && <small className="as-unclassified-amount">회차 미지정 {won(row.items.unclassified)}원</small>}
                                    </td>
                                </tr></React.Fragment>)}</tbody>
                                <tfoot><tr><th scope="row" colSpan={2}>팀 소계</th>
                                    {visibleCategories.map(category => <td key={category} className="as-money as-category-money" data-label={ADVANCE_REQUEST_CATEGORY_LABELS[category]}>{won(group.rows.reduce((total, row) => total + (row.items[category] || 0), 0))}</td>)}
                                    <td className="as-money as-total-money" data-label="총금액">{won(group.total)}</td><td className="as-team-count" colSpan={2}>{group.rows.length}명</td></tr></tfoot>
                            </table>
                            </AdvanceSummaryFitTable>
                        </section>;
                    })}
                </AdvanceSummaryTeamLayout>}
                {summary.groups.length > 0 && <p className="as-report-footnote">현재 조회 조건 기준 · 동일 작업자의 신청은 팀별로 합산됩니다. · 계좌번호·예금주는 현재 작업자 등록 정보 기준입니다. · 입금계좌 선택과 비고는 현재 조회 중인 신청 원본에 저장됩니다.</p>}
            </div>}
            {memoEditor && memoEditor.uid === uid && memoEditor.month === yearMonth && <AdvanceSummaryMemoDialog
                workerName={memoEditor.row.workerName} context={`${monthLabel} · ${memoEditor.teamName}`}
                sources={memoEditor.row.memoSources} onSave={saveMemos} onClose={() => setMemoEditor(null)} />}
            {prepaymentWorker !== null && status === 'ready' && <AdvancePrepaymentDialog key={`${uid}/${yearMonth}/${prepaymentWorker}`}
                workers={manualWorkers} teams={result.teams} initialWorkerId={prepaymentWorker} initialTeamId={teamId} amounts={prepaymentAmounts} month={monthLabel}
                onSave={savePrepayment} onClose={() => setPrepaymentWorker(null)} />}
            {kbExport && status === 'ready' && kbExport.contextKey === kbContextKey && kbExport.result === result
                && <AdvanceKBExportDialog source={kbExport.source} onClose={() => setKbExport(null)} />}
        </div>
    );
};

export default AdvanceSummaryPage;
