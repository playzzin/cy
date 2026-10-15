import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Download, FileSpreadsheet, GripVertical, Landmark, MousePointer2, Pause, Play, RotateCcw, Save, Search, ShieldCheck, X } from 'lucide-react';
import { SOURCE_LABELS, validateTransferRow } from './transferModel';
import type { TransferSource } from './types';
import { DEMO_SCRIPTS, DemoAction, DemoRow, DemoStage, DemoState, ResultColumn, demoAtStep, demoCandidates, demoDirty, demoErrors, demoGoals, demoTotal, initialDemo, reduceDemo } from './transferGuideSimulation';
import useTransferGuidePlayback, { guideResultTarget } from './useTransferGuidePlayback';
import './TransferGuideSimulator.css';

// @guide-sync 실제 UI 변경은 transferGuideContent.ts의 단계별 원본 파일에서 확인하고 이 재현 화면도 갱신한다.
// 버튼/필드의 data-demo-target은 DEMO_SCRIPTS.target 및 guideResultTarget과 연결된다.
// 위치를 바꾸거나 결과 영역을 없앨 때는 세 곳과 TransferGuideSimulator.test.tsx의 전체 장면 검증을 함께 확인한다.
// 실제 서비스/저장/다운로드 핸들러를 연결하지 않는다. 연습은 reduceDemo의 가상 상태만 변경한다.
type Send = (action: DemoAction) => void;
type ScreenProps = { state: DemoState; send: Send; practice: boolean; active: string };
const won = (amount: number) => `${amount.toLocaleString('ko-KR')}원`;
const target = (id: string, active: string) => ({ 'data-demo-target': id, className: active === id ? 'bt-sim-target is-coached' : 'bt-sim-target' });
function Action({ id, active, practice, send, action, children, disabled = false }: { id: string; action: DemoAction; children: React.ReactNode; disabled?: boolean } & Pick<ScreenProps, 'send' | 'active' | 'practice'>) {
    return <button type="button" {...target(id, active)} disabled={!practice || disabled} data-locked={disabled || undefined} onClick={() => send(action)}>{children}</button>;
}

function Detail({ row }: { row: DemoRow }) {
    const lines = row.source === 'payroll' ? [['근무', '1공수 × 120,000원'], ['지급총액', '120,000원'], ['공제·선지급 등 차감액', won(120000 - (row.originalAmount ?? 100000))], ['선택 기준 금액', won(row.originalAmount ?? 100000)]]
        : row.source === 'support' ? [['현장', '연습 현장 · 10월 5일'], ['작업비', '1.5공수 × 200,000원'], ['경비', '식비 10,000원'], ['지원비 합계', '310,000원']]
            : [['숙소', '연습 숙소 101호'], ['정산월', '2026-10'], ['월 임대료', '500,000원'], ['월세 지급액', '500,000원']];
    return <div className="bt-sim-detail" data-demo-target={`detail-content-${row.id}`} aria-label={`${row.name} 연습 상세내역`}><strong>{SOURCE_LABELS[row.source]} 상세내역 · 가상 자료</strong><dl>{lines.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><p>현재 송금액 {won(row.amount)} · 상세와 다른 금액을 지급할 때는 사유를 확인하세요.</p></div>;
}

function Picker(props: ScreenProps) {
    const { state, send, practice, active } = props;
    const candidates = demoCandidates(state);
    return <section className="bt-sim-picker" aria-label="연습 대상 찾기"><h5>대상 불러오기 <span>01</span></h5>
        <div className="bt-sim-source-tabs">{(['account', 'payroll', 'rent', 'support'] as TransferSource[]).map(source => <Action {...props} key={source} id={`source-${source}`} action={{ type: 'source', value: source }}><span aria-current={state.source === source ? 'true' : undefined}>{SOURCE_LABELS[source]}</span></Action>)}</div>
        <div className="bt-sim-fields"><label {...target('period', active)}>조회월<input aria-label="연습 조회월" type="month" value={state.period} onChange={event => send({ type: 'period', value: event.target.value })} disabled={!practice} /></label>
            <label {...target('team', active)}>소속 팀<select aria-label="연습 소속 팀" value={state.team} disabled={!practice} onChange={event => send({ type: 'team', value: event.target.value })}><option value="all">전체 팀</option><option>연습 A팀</option><option>연습 B팀</option></select></label></div>
        {state.source === 'payroll' && <div className="bt-sim-payroll-load"><span>급여 구분 <b>전체</b></span><label {...target('amount-basis', active)}>이체금액 기준<select aria-label="연습 급여 금액 기준" disabled={!practice} value={state.amountBasis} onChange={event => send({ type: 'amountBasis', value: event.target.value })}><option value="net">현재 화면 실지급액</option><option value="advance">가불 예시</option></select></label><Action {...props} id="payroll-load" action={{ type: 'loadPayroll' }}>급여 불러오기</Action></div>}
        <label {...target('query', active)}><span className="bt-sim-search"><Search size={13} /><input aria-label="연습 대상 검색" placeholder="이름, 팀, 계좌 검색" value={state.query} disabled={!practice} onChange={event => send({ type: 'query', value: event.target.value })} /></span></label>
        {(state.source === 'account' || state.source === 'payroll') && <label className="bt-sim-check-label"><input type="checkbox" aria-label="연습 퇴사자 숨김" checked={state.hideRetired} disabled={!practice} onChange={event => send({ type: 'hideRetired', value: event.target.checked })} />퇴사자 숨김<small>이미 담은 건 유지</small></label>}
        <div className="bt-sim-pick-tools"><span>검색 결과 {candidates.length}건</span><Action {...props} id="add-selected" action={{ type: 'addSelected' }} disabled={!state.candidateSelection.length}>선택 {state.candidateSelection.length}건 담기</Action></div>
        {!candidates.length && <p className="bt-sim-empty">{state.source === 'payroll' && !state.payrollLoaded ? '급여 불러오기를 눌러 주세요.' : '검색 조건에 맞는 대상이 없습니다.'}</p>}
        <div data-demo-target="candidates">{candidates.map(row => { const added = state.rows.some(item => item.id === row.id); return <article className="bt-sim-candidate" key={row.id} draggable={practice && !added} onDragStart={event => { event.dataTransfer.setData('application/x-cy-guide', row.id); event.dataTransfer.effectAllowed = 'copy'; }}>
            <label {...target(`candidate-${row.id}`, active)}><input type="checkbox" aria-label={`연습 ${row.name} 대상 선택`} disabled={!practice || added} checked={state.candidateSelection.includes(row.id)} onChange={() => send({ type: 'candidateSelect', id: row.id })} /><span><strong>{row.name}</strong><small>{row.groupName} {row.category === 'worker' && <em className={row.retired ? 'is-retired' : ''}>{row.retired ? '퇴사자' : '재직중'}</em>}</small><small>국민은행 · {row.accountNumber}</small>{row.source !== 'account' && <b>{won(row.amount)}</b>}</span></label>
            <Action {...props} id={`add-${row.id}`} action={{ type: 'add', id: row.id }} disabled={added}>{added ? <Check size={13} /> : '담기'}</Action><GripVertical size={12} aria-hidden="true" />
        </article>; })}</div>
        {state.source === 'account' && <p className="bt-sim-help">등록 계좌는 금액을 직접 입력합니다.</p>}
    </section>;
}

function Basket(props: ScreenProps & { chapter: number }) {
    const { state, send, practice, active, chapter } = props;
    const visibleRows = state.rows.filter(row => `${row.name}${row.groupName}`.replace(/\s/g, '').includes(state.basketQuery.replace(/\s/g, '')));
    const selected = state.rows.filter(row => state.rowSelection.includes(row.id));
    return <section className="bt-sim-basket" aria-label="연습 송금 목록" data-demo-target="basket" onDragOver={event => { if (practice && event.dataTransfer.types.includes('application/x-cy-guide')) event.preventDefault(); }} onDrop={event => { if (!practice) return; event.preventDefault(); const id = event.dataTransfer.getData('application/x-cy-guide'); if (id) send({ type: 'add', id }); }}>
        <h5>송금 목록 <b>{state.rows.length}</b><span>02</span></h5>
        {state.rows.length > 0 && <><div className="bt-sim-totals"><span>전체 <b>{state.rows.length}건 · {won(demoTotal(state.rows))}</b></span><span>선택 <b>{selected.length}건 · {won(demoTotal(selected))}</b></span></div>
            {state.stage === 'review' && <div className="bt-sim-review-tools"><input aria-label="연습 송금 목록 검색" placeholder="목록 내 이름 검색" disabled={!practice} value={state.basketQuery} onChange={event => send({ type: 'basketQuery', value: event.target.value })} /><Action {...props} id="compare" action={{ type: 'compare' }}>원본과 비교</Action></div>}
            {chapter === 3 && <div className="bt-sim-memo-settings"><strong>통장 표시·메모 일괄 설정</strong><div className="bt-sim-fields"><label {...target('receiver', active)}>받는분통장표시<input aria-label="연습 받는분통장표시" value={state.receiver} disabled={!practice} onChange={event => send({ type: 'receiver', value: event.target.value })} /></label><label {...target('memo-rule', active)}>내통장메모 규칙<input aria-label="연습 내통장메모 규칙" value={state.memoRule} disabled={!practice} onChange={event => send({ type: 'memoRule', value: event.target.value })} /></label></div><Action {...props} id="apply-memo" action={{ type: 'applyMemo' }} disabled={!state.rowSelection.length}>선택 {state.rowSelection.length}건에 적용</Action><small>검색에서 가려진 선택 항목도 적용됩니다.</small></div>}
        </>}
        {!state.rows.length && <div className="bt-sim-empty"><MousePointer2 size={25} /><strong>송금할 계좌를 여기에 담으세요</strong><span>왼쪽의 담기 또는 끌어 놓기를 사용하세요.</span></div>}
        {!!state.rows.length && !visibleRows.length && <p className="bt-sim-empty">조건에 맞는 항목이 없습니다. 검색어를 지우면 전체 목록이 보입니다.</p>}
        {visibleRows.map(row => { const errors = validateTransferRow(row); return <article className={`bt-sim-row ${errors.length ? 'has-error' : ''}`} key={row.id} data-demo-target={`row-${row.id}`}>
            <div className="bt-sim-row-heading"><label {...target(`select-${row.id}`, active)}><input type="checkbox" aria-label={`연습 ${row.name} 송금 선택`} checked={state.rowSelection.includes(row.id)} disabled={!practice} onChange={() => send({ type: 'rowSelect', id: row.id })} /><strong>{row.name}</strong></label><span className="bt-sim-source-label">{SOURCE_LABELS[row.source]}</span>{row.retired && <em className="is-retired">퇴사자</em>}<Action {...props} id={`remove-${row.id}`} action={{ type: 'remove', id: row.id }}><X size={12} /><span className="bt-sim-sr">{row.name} </span>제외</Action></div>
            <div className="bt-sim-row-fields"><div><small>{row.groupName} · {row.period || '등록 계좌'}</small><strong>{row.bankName} {row.accountNumber}</strong><small>예금주 {row.accountHolder}</small><Action {...props} id={`account-${row.id}`} action={{ type: 'correctAccount', id: row.id }}>계좌 변경 <small>가상 대체계좌</small></Action></div><label {...target(`amount-${row.id}`, active)}>이체금액<input aria-label={`연습 ${row.name} 이체금액`} type="number" min={1} step={1} value={row.amount} disabled={!practice} onChange={event => send({ type: 'editAmount', id: row.id, value: Number(event.target.value) })} /></label></div>
            {chapter === 3 && <div className="bt-sim-memo-values"><span>D <b>{row.receiverDisplay}</b></span><span>E <b>{row.senderMemo}</b></span></div>}
            {row.originalAmount !== undefined && row.amount !== row.originalAmount && <label {...target(`reason-${row.id}`, active)}><span className="bt-sim-reason">금액 변경 사유<input aria-label={`연습 ${row.name} 변경 사유`} placeholder="예: 선지급분 제외" value={row.adjustmentReason ?? ''} disabled={!practice} onChange={event => send({ type: 'editReason', id: row.id, value: event.target.value })} /></span></label>}
            {!!errors.length && <p className="bt-sim-error-text">{errors.join(' ')}</p>}
            {row.retryContext && <p className="bt-sim-diff">재처리 · 실패 사유: {row.retryContext.failureReason}</p>}
            {state.compared && <p className="bt-sim-diff">원본 {won(row.originalAmount ?? 0)} → 현재 {won(row.amount)} · 차이 {won(row.amount - (row.originalAmount ?? 0))}</p>}
            {row.source !== 'account' && <><Action {...props} id={`detail-${row.id}`} action={{ type: 'detail', id: row.id }}>{SOURCE_LABELS[row.source]} 상세보기 {state.detailId === row.id ? '▴' : '▾'}</Action>{state.detailId === row.id && <Detail row={row} />}</>}
        </article>; })}
    </section>;
}

function Preview(props: ScreenProps) {
    const { state } = props;
    const invalid = demoErrors(state).length;
    return <section className="bt-sim-preview" data-demo-target="preview" aria-label="연습 엑셀 미리보기"><h5>국민은행용 엑셀 미리보기 <FileSpreadsheet size={15} /></h5><div className="bt-sim-totals"><span>이체 대상 <b>{state.rows.length}건</b></span><span>총 이체금액 <b>{won(demoTotal(state.rows))}</b></span><span>파일 오류 <b>{invalid}건</b></span></div>
        <p className="bt-sim-help">체크한 행이나 검색 결과가 아닌 송금 목록 전체가 출력됩니다.</p>
        <div className="bt-sim-table-scroll" role="region" aria-label="연습 A~E열 출력 표" tabIndex={0}><table><thead><tr>{['송금 대상', 'A. 은행코드', 'B. 계좌번호', 'C. 이체금액', 'D. 받는분통장표시', 'E. 내통장메모'].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{state.rows.map(row => <tr key={row.id}><td>{row.name}</td><td>{row.bankCode}</td><td>{row.accountNumber}</td><td>{won(row.amount)}</td><td>{row.receiverDisplay}</td><td>{row.senderMemo}</td></tr>)}</tbody></table></div>
        <p className="bt-sim-help">파일 형식 확인은 실제 예금주 조회가 아닙니다. 은행에서 최종 확인하세요.</p><div className="bt-sim-export-actions"><Action {...props} id="review" action={{ type: 'review' }} disabled={!state.rows.length || !!invalid || state.reviewed}>{state.reviewed ? '검토 완료됨' : '내용 확인 후 검토 완료'}</Action><Action {...props} id="export" action={{ type: 'export' }} disabled={!state.rows.length || !!invalid || !state.reviewed}><Download size={14} />국민은행용 엑셀 다운로드</Action></div>
        <small className="bt-sim-file-note">연습에서는 생성 이력만 화면에 표시하며 실제 파일을 내려받지 않습니다.</small>
    </section>;
}

const COLUMN_LABELS: Record<ResultColumn, string> = { bank: '은행코드', account: '계좌번호', amount: '이체금액', status: '처리결과' };
function Results(props: ScreenProps) {
    const { state, practice, send, active } = props;
    return <section className="bt-sim-results" aria-label="연습 이체 결과"><h5>파일 생성 이력 · 이체 결과 확인</h5><p>국민은행_연습.xlsx · 2건 · 190,000원</p><small>실제 은행 화면이 아닌, 이 페이지의 결과 기록 절차를 재현합니다.</small>
        <Action {...props} id="load-results" action={{ type: 'loadResults' }}>예시 은행 결과 파일 불러오기</Action>
        {state.resultLoaded && <><div className="bt-sim-result-mapping" data-demo-target="result-mapping">{(Object.keys(COLUMN_LABELS) as ResultColumn[]).map(key => <label key={key} {...target(`column-${key}`, active)}>{COLUMN_LABELS[key]} 열<select aria-label={`연습 ${COLUMN_LABELS[key]} 결과 열`} disabled={!practice} value={state.columns[key]} onChange={event => send({ type: 'resultColumn', key, value: event.target.value })}><option value="">선택하세요</option>{Object.entries(COLUMN_LABELS).map(([value, label], index) => <option value={value} key={value}>{index + 1}열 · {label}</option>)}</select></label>)}</div><Action {...props} id="match-results" action={{ type: 'matchResults' }}>연결 결과 미리보기</Action></>}
        {state.matched && <div className="bt-sim-result-table" data-demo-target="result-table"><label {...target('select-results', active)}><input type="checkbox" aria-label="연습 연결 가능한 결과 전체 선택" checked={state.resultsSelected} disabled={!practice} onChange={() => send({ type: 'selectResults' })} /> 연결 가능한 결과 전체 선택</label><div><strong>가상 작업자 A</strong><span>100,000원</span><em>성공</em></div><div><strong>가상 작업자 B</strong><span>90,000원</span><em className="is-retired">실패 · 계좌 확인 필요</em></div><Action {...props} id="apply-results" action={{ type: 'applyResults' }} disabled={!state.resultsSelected}>선택 {state.resultsSelected ? 2 : 0}건 결과 반영</Action></div>}
        {state.resultsApplied && <p className="bt-sim-success">기록 완료 · 성공 1 / 실패 1 / 미확인 0</p>}<Action {...props} id="retry" action={{ type: 'retry' }} disabled={!state.resultsApplied}>실패 {state.resultsApplied ? 1 : 0}건으로 새 송금 목록 만들기</Action><p className="bt-sim-help">원본 급여의 지급 상태는 자동으로 바뀌지 않습니다.</p>
    </section>;
}

function Storage(props: ScreenProps & { chapter: number }) {
    const { state, send, practice, active, chapter } = props;
    return <div className="bt-sim-storage"><div><label {...target('title', active)}>목록 이름<input aria-label="연습 목록 이름" value={state.title} disabled={!practice} onChange={event => send({ type: 'title', value: event.target.value })} /></label><span className={demoDirty(state) ? 'is-dirty' : ''}>{demoDirty(state) ? '저장하지 않은 변경' : '저장 완료'}</span><Action {...props} id="save" action={{ type: 'save' }}><Save size={12} />목록 저장</Action></div>
        {chapter === 4 && <><div className="bt-sim-storage-tools"><Action {...props} id="restore" action={{ type: 'restore' }} disabled={!state.saved}>저장한 목록 불러오기</Action><Action {...props} id="backup" action={{ type: 'backup' }}>현재 목록 백업</Action><Action {...props} id="restore-backup" action={{ type: 'restoreBackup' }} disabled={!state.backup}>연습 백업 복원</Action></div><small>이 연습을 닫으면 사라집니다. 실제 목록은 같은 브라우저·계정·접속 주소에서 저장됩니다.</small></>}
        {state.pendingRestore && <div className="bt-sim-confirm" data-demo-target="restore-confirmation" role="group" aria-label="연습 저장본 불러오기 확인"><strong>저장하지 않은 변경을 버리고 저장본을 불러올까요?</strong><span>현재 수정 금액 대신 저장 당시 금액으로 돌아갑니다.</span><div><Action {...props} id="cancel-restore" action={{ type: 'cancelRestore' }}>계속 편집</Action><Action {...props} id="confirm-restore" action={{ type: 'confirmRestore' }}>저장본 불러오기</Action></div></div>}
    </div>;
}

export default function TransferGuideSimulator({ chapter, onNext }: { chapter: number; onNext?: () => void }) {
    const [mode, setMode] = useState<'watch' | 'practice'>('watch');
    const [practiceState, setPracticeState] = useState(() => initialDemo(chapter));
    const [follow, setFollow] = useState(true);
    const [reveal, setReveal] = useState(0);
    const board = useRef<HTMLDivElement>(null);
    const dock = useRef<HTMLDivElement>(null);
    const revealed = useRef(0);
    const [focusBox, setFocusBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
    const script = DEMO_SCRIPTS[chapter];
    const playback = useTransferGuidePlayback(script);
    const { index, phase, playing, running, reduced, speed, pause } = playback;
    const watched = useMemo(() => demoAtStep(chapter, phase === 'result' ? index : index - 1), [chapter, index, phase]);
    const practice = mode === 'practice';
    const state = practice ? practiceState : watched;
    const active = practice ? '' : phase === 'result' ? guideResultTarget(script[index]) : script[index].target;
    const goals = demoGoals(chapter, state);
    const complete = goals.every(goal => goal.done);
    const send: Send = action => { if (practice) setPracticeState(previous => reduceDemo(previous, action)); };
    const props: ScreenProps = { state, send, practice, active };
    // A person's scroll takes priority over the guided camera. Programmatic scrolling
    // never emits wheel/touch/key input, so it cannot pause its own playback.
    useEffect(() => {
        const pane = board.current?.closest<HTMLElement>('.bt-guide-reading');
        if (!pane || !running || practice) return;
        const stop = () => { pause(true); pane.scrollTo?.({ top: pane.scrollTop, behavior: 'auto' }); };
        const key = (event: KeyboardEvent) => {
            if ((event.target as HTMLElement).closest('input,select,textarea,button')) return;
            if (['PageUp', 'PageDown', 'Home', 'End', 'ArrowUp', 'ArrowDown', ' '].includes(event.key)) stop();
        };
        pane.addEventListener('wheel', stop, { passive: true });
        pane.addEventListener('touchmove', stop, { passive: true });
        pane.addEventListener('keydown', key);
        return () => { pane.removeEventListener('wheel', stop); pane.removeEventListener('touchmove', stop); pane.removeEventListener('keydown', key); };
    }, [running, practice, pause]);
    useLayoutEffect(() => {
        const container = board.current;
        const element = container?.querySelector<HTMLElement>(`[data-demo-target="${active}"]`);
        const measure = () => {
            if (!container || !element || practice) { setFocusBox(null); return; }
            const bounds = container.getBoundingClientRect(), point = element.getBoundingClientRect();
            setFocusBox(point.width ? { x: point.left - bounds.left, y: point.top - bounds.top, width: point.width, height: point.height } : null);
        };
        measure();
        const pane = container?.closest<HTMLElement>('.bt-guide-reading');
        const requested = reveal !== revealed.current;
        revealed.current = reveal;
        let cameraFrame: number | undefined;
        if (element && pane && !practice && ((running && follow) || requested)) {
            // Let native selects close and the new layout settle before moving the reader.
            cameraFrame = window.requestAnimationFrame(() => {
                measure();
                const viewport = pane.getBoundingClientRect(), rect = element.getBoundingClientRect();
                const top = viewport.top + (dock.current?.offsetHeight ?? 0) + 16;
                const bottom = viewport.bottom - 20;
                const available = Math.max(40, bottom - top);
                if (rect.top < top || rect.bottom > bottom) {
                    const desiredTop = top + Math.max(0, (available - rect.height) * .3);
                    pane.scrollTo?.({ top: Math.max(0, pane.scrollTop + rect.top - desiredTop), behavior: reduced ? 'auto' : 'smooth' });
                }
            });
        }
        const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : undefined;
        if (container) observer?.observe(container);
        window.addEventListener('resize', measure);
        return () => { if (cameraFrame !== undefined) window.cancelAnimationFrame(cameraFrame); observer?.disconnect(); window.removeEventListener('resize', measure); };
    }, [active, practice, reduced, state, running, follow, reveal]);
    const changeMode = (next: 'watch' | 'practice') => { setMode(next); pause(); };
    const restart = () => { playback.reset(); setPracticeState(initialDemo(chapter)); };
    const move = (next: number) => { playback.seek(next); if (follow) setReveal(value => value + 1); };
    const practiceScene = () => { setPracticeState(demoAtStep(chapter, index - 1)); changeMode('practice'); };
    return <section className={`bt-simulator ${practice ? 'is-practice' : 'is-watching'} ${running ? 'is-playing' : 'is-paused'} phase-${phase} ${script[index].action.type !== 'noop' ? 'has-action' : ''}`} style={{ '--sim-speed': speed } as React.CSSProperties} aria-label="실제 화면 재현 연습">
        <div className="bt-sim-toolbar"><div className="bt-sim-mode" role="group" aria-label="설명서 사용 방식"><button type="button" aria-pressed={!practice} onClick={() => changeMode('watch')}><Play size={13} />시연 보기</button><button type="button" aria-pressed={practice} onClick={() => changeMode('practice')}><MousePointer2 size={13} />직접 해보기</button></div><button type="button" onClick={restart} aria-label="연습 처음부터"><RotateCcw size={13} />초기화</button></div>
        <div className="bt-sim-safety"><ShieldCheck size={13} /><span><strong>가상 자료로 재현한 연습 화면</strong> · 실제 목록·계좌·저장본에 영향이 없습니다.</span></div>
        <div className="bt-sim-dock" ref={dock}>
        {!practice && <>
            <div className="bt-sim-playback"><button type="button" className="bt-sim-play-button" aria-label={playing ? '시연 일시정지' : '시연 재생'} onClick={playback.toggle}>{playing ? <Pause size={14} /> : <Play size={14} />}{playing ? '일시정지' : playback.finished ? '다시 보기' : '재생'}</button><button type="button" aria-label="이전 시연 장면" disabled={index === 0} onClick={() => move(index - 1)}><ArrowLeft size={13} /></button><label><span>장면</span><select aria-label="시연 장면 선택" value={index} onChange={event => move(Number(event.target.value))}>{script.map((item, i) => <option key={i} value={i}>{i + 1}. {item.label}</option>)}</select></label><button type="button" aria-label="다음 시연 장면" disabled={index === script.length - 1} onClick={() => move(index + 1)}><ArrowRight size={13} /></button><select aria-label="시연 재생 속도" value={speed} onChange={event => playback.setSpeed(Number(event.target.value))}><option value={.75}>0.75× 천천히</option><option value={1}>1× 보통</option><option value={1.5}>1.5× 빠르게</option></select></div>
            <div className="bt-sim-scene-track" aria-label="시연 장면 바로가기">{script.map((item, i) => <button type="button" key={item.target + i} title={item.label} aria-label={`${i + 1}번 시연 장면: ${item.label}`} aria-current={i === index ? 'step' : undefined} className={i < index ? 'is-complete' : ''} onClick={() => move(i)}><span /></button>)}</div>
        </>}
        <div className="bt-sim-coach" aria-live={practice ? 'polite' : 'off'}><span>{practice ? complete ? '미션 완료' : '직접 눌러 보세요' : `${index + 1} / ${script.length} 장면`}</span><p>{practice ? complete ? '이 단계의 연습을 마쳤습니다. 다음 단계로 이동하거나 다른 값을 입력해 볼 수 있습니다.' : goals.find(goal => !goal.done)?.label + '. 아래 화면의 버튼과 입력란을 직접 사용하세요.' : script[index].label}</p></div>
        {!practice && <div className="bt-sim-guidance-tools"><div className="bt-sim-phases" aria-label="시연 동작 순서">{(['focus', 'act', 'result'] as const).map((value, i) => <span key={value} aria-current={phase === value ? 'step' : undefined}>{i + 1}<b>{['위치 안내', '조작', '결과 확인'][i]}</b></span>)}</div><label><input type="checkbox" checked={follow} onChange={event => setFollow(event.target.checked)} />화면 따라가기</label><button type="button" onClick={() => setReveal(value => value + 1)}>위치 찾기</button></div>}
        {!practice && <p className="bt-sim-paused-note">{playback.scrollPaused ? '직접 스크롤하여 잠시 멈췄어요. 준비되면 재생을 누르세요.' : playing ? '시연 중 · 직접 스크롤하면 잠시 멈춥니다.' : playback.finished ? '시연 완료 · 다시 보거나 아래에서 직접 연습하세요.' : '재생을 누르면 순서대로 안내합니다. 장면을 골라 하나씩 볼 수도 있어요.'}</p>}
        </div>
        {reduced && <p className="bt-sim-help">모션 줄이기 설정을 적용했습니다. 장면 선택으로 화면 변화를 확인하세요.</p>}
        <div className="bt-sim-board" ref={board}>
            <header className="bt-sim-app-header"><Landmark size={15} /><strong>국민은행 송금</strong><span>연습 전용</span></header>
            <nav className="bt-sim-stage" aria-label="연습 송금 준비 단계">{([['pick', '① 대상 가져오기'], ['review', '② 금액·계좌 검토'], ['preview', '③ 엑셀 미리보기']] as [DemoStage, string][]).map(([value, label]) => <Action {...props} key={value} id={`stage-${value}`} action={{ type: 'stage', value }} disabled={value === 'preview' && !state.rows.length}><span aria-current={state.stage === value ? 'step' : undefined}>{label}</span></Action>)}</nav>
            {state.stage !== 'results' && <Storage {...props} chapter={chapter} />}
            {state.pendingRestore ? null : state.stage === 'preview' ? <Preview {...props} /> : state.stage === 'results' ? <Results {...props} /> : <div className={`bt-sim-workspace ${state.stage === 'pick' ? '' : 'is-review'}`}>{state.stage === 'pick' && <Picker {...props} />}<Basket {...props} chapter={chapter} /></div>}
            {(chapter === 5 || chapter === 6) && state.stage !== 'results' && !!state.history.length && <div className="bt-sim-history"><strong>파일 생성 이력 {state.history.length}건 · 연습</strong>{state.history.map((record, i) => <span key={i}>생성 #{state.history.length - i} · {record.rows.length}건 · {won(demoTotal(record.rows))}</span>)}</div>}
            {state.error && <div className="bt-sim-feedback is-error" role={practice ? 'alert' : undefined}>{state.error}</div>}
            {state.notice && <div className="bt-sim-feedback" data-demo-target="feedback" role={practice ? 'status' : undefined}>{state.notice}</div>}
            {focusBox && <><span className="bt-sim-spotlight" aria-hidden="true" style={{ transform: `translate(${focusBox.x}px,${focusBox.y}px)`, width: focusBox.width, height: focusBox.height }} />{!reduced && <span className="bt-sim-cursor" aria-hidden="true" style={{ transform: `translate(${focusBox.x + Math.min(focusBox.width * .7, focusBox.width - 8)}px,${focusBox.y + Math.min(focusBox.height * .6, 25)}px)` }}><MousePointer2 size={22} fill="#fbbf24" />{phase === 'act' && script[index].action.type !== 'noop' && <i key={`${index}:${playback.revision}`} />}</span>}</>}
        </div>
        {!practice && <div className={`bt-sim-scene-actions ${playback.finished ? 'is-finished' : ''}`}>
            <div><strong>{playback.finished ? '이 단계의 시연을 모두 봤어요' : '방금 본 장면을 직접 해보세요'}</strong><p>{playback.finished ? '가상 자료로 연습하거나 다음 단계로 이어가세요.' : '조작 직전 화면에서 시작합니다. 실제 자료는 바뀌지 않습니다.'}</p></div>
            <button type="button" onClick={playback.replayScene}><RotateCcw size={13} />이 장면 다시 보기</button><button type="button" onClick={practiceScene}><MousePointer2 size={13} />이 장면부터 연습</button>{playback.finished && onNext && <button type="button" className="bt-guide-primary" onClick={onNext}>다음 안내로 <ArrowRight size={13} /></button>}
        </div>}
        <div className="bt-sim-missions" aria-label="연습 확인 항목">{goals.map(goal => <span key={goal.label} className={goal.done ? 'is-done' : ''}>{goal.done ? <Check size={13} /> : <span className="bt-sim-mission-dot" />}{goal.label}</span>)}</div>
        <p className="bt-sim-footnote">실제 화면의 주요 조작을 재현했습니다. 예시 계좌·정산 금액만 사용하며, 저장·파일 생성·결과 반영도 이 설명서 안에서만 동작합니다.</p>
    </section>;
}
