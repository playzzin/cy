import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useReactToPrint } from 'react-to-print';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faChevronRight, faPrint, faRotateRight, faTable } from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../../contexts/AuthContext';
import { advancePaymentService, type AdvancePayment } from '../../services/advancePaymentService';
import { advancePaymentMemoService, type AdvancePaymentMemoChange } from '../../services/advancePaymentMemoService';
import { teamService } from '../../services/teamService';
import { companyService } from '../../services/companyService';
import { manpowerService } from '../../services/manpowerService';
import { userService } from '../../services/userService';
import { ADVANCE_ITEM_LABEL_KEYS, DEFAULT_ADVANCE_ITEM_LABELS, payrollConfigService, type AdvanceItemLabelsConfig } from '../../services/payrollConfigService';
import { UserRole } from '../../types/roles';
import { shiftYearMonth } from '../../components/common/MonthNavigator';
import { getKoreanDateKey } from '../../utils/koreanBusinessDate';
import { getContrastingTextColor, normalizeHexColor } from '../../utils/color';
import { buildAdvanceSummary, isAdvanceSummaryFilter, isAdvanceSummaryMonth, type AdvanceSummaryTeam, type AdvanceSummaryRow } from './utils/advanceSummary';
import AdvanceSummaryMemoDialog from './components/AdvanceSummaryMemoDialog';
import './AdvanceSummaryPage.css';

type LoadResult = {
    uid: string;
    month: string;
    status: 'loading' | 'ready' | 'denied' | 'error';
    payments: AdvancePayment[];
    teams: AdvanceSummaryTeam[];
    labels: AdvanceItemLabelsConfig;
};
const emptyResult = { payments: [], teams: [], labels: DEFAULT_ADVANCE_ITEM_LABELS };
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
    const [refresh, setRefresh] = useState(0);
    const [result, setResult] = useState<LoadResult>({ ...emptyResult, uid: '', month: '', status: 'loading' });
    const [memoEditor, setMemoEditor] = useState<{ uid: string; month: string; teamName: string; row: AdvanceSummaryRow } | null>(null);
    const [saveMessage, setSaveMessage] = useState('');
    const reportRef = useRef<HTMLDivElement>(null);

    const updateFilter = (key: string, value: string) => setParams(previous => {
        const next = new URLSearchParams(previous);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
    }, { replace: true });

    useEffect(() => { setMemoEditor(null); setSaveMessage(''); }, [uid, yearMonth]);

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
                const [year, month] = yearMonth.split('-').map(Number);
                const [teams, companies, payments, config] = await Promise.all([
                    teamService.getTeams(), companyService.getCompaniesByType('시공사'),
                    advancePaymentService.getAdvancePaymentsByYearMonth(year, month),
                    payrollConfigService.getConfigReadOnly(),
                ]);
                const companyIds = new Set(companies.map(company => company.id).filter(Boolean));
                const companyNames = new Set(companies.map(company => companyKey(company.name)).filter(Boolean));
                const allowedTeams = teams.filter(team => team.id && (team.companyId
                    ? companyIds.has(team.companyId) : companyNames.has(companyKey(team.companyName))))
                    .map(team => ({ id: team.id!, legacyId: team.legacyId, name: team.name, color: team.color }))
                    .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
                commit({ status: 'ready', payments, teams: allowedTeams, labels: config.advanceItemLabels });
            } catch {
                commit({ status: 'error' });
            }
        };
        void load();
        return () => { cancelled = true; };
    }, [uid, yearMonth, refresh]);

    const status = result.uid === uid && result.month === yearMonth ? result.status : 'loading';
    const summary = useMemo(() => buildAdvanceSummary(status === 'ready' ? result.payments : [], result.teams,
        { yearMonth, teamId, item, query }), [status, result.payments, result.teams, yearMonth, teamId, item, query]);
    const selectedTeam = result.teams.find(team => team.id === teamId || team.legacyId === teamId);
    const itemLabel = item === 'all' ? '전체 가불' : item === 'corporate' ? '법인가불' : item === 'labor' ? '노무가불' : result.labels[item];
    const monthLabel = `${Number(yearMonth.slice(0, 4))}년 ${Number(yearMonth.slice(5))}월`;
    const printReport = useReactToPrint({ contentRef: reportRef, documentTitle: `팀별 가불내역_${yearMonth}`,
        pageStyle: '@page { size: A4 landscape; margin: 10mm; }' });
    const entryParams = new URLSearchParams({ yearMonth, teamId: selectedTeam?.id || '__ALL_TEAMS__' });

    const saveMemos = async (changes: AdvancePaymentMemoChange[]) => {
        const editor = memoEditor;
        if (!editor || editor.uid !== uid || editor.month !== yearMonth || status !== 'ready') return;
        await advancePaymentMemoService.save(changes);
        const savedById = new Map(changes.map(change => [change.id, change.memo]));
        setResult(current => current.uid !== editor.uid || current.month !== editor.month ? current : {
            ...current,
            payments: current.payments.map(payment => payment.id && savedById.has(payment.id)
                ? { ...payment, memo: savedById.get(payment.id)! } : payment),
        });
        setMemoEditor(current => current === editor ? null : current);
        setSaveMessage('비고를 저장했습니다.');
    };

    return (
        <div className="advance-summary-page">
            <header className="as-header">
                <div>
                    <p className="as-eyebrow">가불 및 공제내역</p>
                    <h1><FontAwesomeIcon icon={faTable} /> 팀별 가불내역</h1>
                    <p className="as-description">팀별 가불 금액과 비고를 한눈에 확인하세요.</p>
                </div>
                <div className="as-actions">
                    <Link to={`/payroll/advance-payment?${entryParams}`}>가불·공제 입력</Link>
                    <button type="button" onClick={() => setRefresh(value => value + 1)} disabled={status === 'loading'}>
                        <FontAwesomeIcon icon={faRotateRight} /> 새로고침
                    </button>
                    <button type="button" className="as-primary" onClick={() => printReport()} disabled={status !== 'ready' || !summary.groups.length}>
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
                <label>가불 구분
                    <select aria-label="가불 구분" value={item} onChange={event => updateFilter('item', event.target.value)}>
                        <option value="all">전체 가불</option><option value="corporate">법인가불</option><option value="labor">노무가불</option>
                        <optgroup label="항목별 조회">
                            {ADVANCE_ITEM_LABEL_KEYS.map(key => <option key={key} value={key}>{result.labels[key]}</option>)}
                        </optgroup>
                    </select>
                </label>
                <label className="as-search">이름·팀·비고 검색
                    <input type="search" value={query} placeholder="검색어를 입력하세요" onChange={event => setQuery(event.target.value)} />
                </label>
            </section>
            <p className="as-note">가불·공제 입력에서 저장한 월별 가불을 표시합니다. 숙소비·공과금·이월 등 기타 공제는 합계에 포함하지 않습니다.</p>
            {saveMessage && <p className="as-save-message" role="status">{saveMessage}</p>}

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
                    <div><dt>법인가불</dt><dd>{won(summary.corporate)}<small>원</small></dd></div>
                    <div><dt>노무가불</dt><dd>{won(summary.labor)}<small>원</small></dd></div>
                    <div><dt>조회 인원 / 팀</dt><dd>{summary.workerCount}<small>명</small><span> / </span>{summary.groups.length}<small>팀</small></dd></div>
                </dl>
                {summary.groups.length === 0 ? <div className="as-empty" role="status">
                    <strong>조회 조건에 맞는 가불내역이 없습니다.</strong><p>다른 월·팀·가불 항목을 선택하거나 검색어를 확인해 주세요.</p>
                </div> : <div className="as-team-grid">
                    {summary.groups.map(group => {
                        const color = normalizeHexColor(group.team.color, '#2563eb');
                        return <section key={group.team.id} className="as-team" aria-label={`${group.team.name} 가불내역`} style={{ '--as-team-color': color } as React.CSSProperties}>
                            <div className="as-team-heading" style={{ backgroundColor: color, color: getContrastingTextColor(color) }}>
                                <h3>{group.team.name}</h3><span>{group.rows.length}명</span>
                            </div>
                            <table>
                                <caption className="sr-only">{group.team.name} 가불내역, 단위 원</caption>
                                <colgroup><col className="as-col-no" /><col className="as-col-name" /><col className="as-col-amount" /><col /></colgroup>
                                <thead><tr><th scope="col">번호</th><th scope="col">이름</th><th scope="col">금액</th><th scope="col">비고</th></tr></thead>
                                <tbody>{group.rows.map((row, index) => <tr key={row.key}>
                                    <td className="as-number">{index + 1}</td>
                                    <th scope="row">{row.workerName}</th>
                                    <td className={`as-money${row.amount < 0 ? ' as-negative' : ''}`}>
                                        <span>{won(row.amount)}</span>
                                        <details><summary aria-label={`${row.workerName} 항목별 금액`}>상세</summary>
                                            <dl>{ADVANCE_ITEM_LABEL_KEYS.filter(key => row.items[key]).map(key => <div key={key}>
                                                <dt>{result.labels[key]}</dt><dd>{won(row.items[key]!)}</dd>
                                            </div>)}</dl>
                                        </details>
                                    </td>
                                    <td className="as-memo">
                                        <span>{row.memos.join('\n') || '—'}</span>
                                        <button type="button" className="as-memo-edit" aria-haspopup="dialog" aria-label={`${group.team.name} ${row.workerName} 비고 수정`}
                                            disabled={row.memoSources.some(source => !source.id)}
                                            onClick={() => { setSaveMessage(''); setMemoEditor({ uid, month: yearMonth, teamName: group.team.name, row }); }}>
                                            {row.memos.length ? '비고 수정' : '비고 추가'}
                                        </button>
                                    </td>
                                </tr>)}</tbody>
                                <tfoot><tr><th scope="row" colSpan={2}>팀 소계</th><td className="as-money">{won(group.total)}</td><td>{group.rows.length}명</td></tr></tfoot>
                            </table>
                        </section>;
                    })}
                </div>}
                {summary.groups.length > 0 && <p className="as-report-footnote">현재 조회 조건 기준 · 동일 작업자의 여러 급여 구분은 팀별로 합산됩니다.</p>}
            </div>}
            {memoEditor && memoEditor.uid === uid && memoEditor.month === yearMonth && <AdvanceSummaryMemoDialog
                workerName={memoEditor.row.workerName} context={`${monthLabel} · ${memoEditor.teamName}`}
                sources={memoEditor.row.memoSources} onSave={saveMemos} onClose={() => setMemoEditor(null)} />}
        </div>
    );
};

export default AdvanceSummaryPage;
