import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CellLocation, CellSelection, compareVersions, explainSelection, ResultVersion, selectedTrace, showValue, sourceLocation } from './review';
import { DataTable, Scalar, WorkbookFile } from './types';
import { strictDate } from './transform';

interface Props { version: ResultVersion; previous?: ResultVersion; table: DataTable; source: WorkbookFile; selection?: CellSelection; busy: boolean; accepted?:boolean; onAccept?:(accepted:boolean)=>void; issueRequest?:number; onSelect: (selection?: CellSelection) => void; onJump: (location: CellLocation, versionId?: string) => void; onEdit: (value: Scalar, kind: 'text' | 'number' | 'date' | 'blank') => void }
export default function ResultReview({ version, previous, table, source, selection, busy, accepted, onAccept, issueRequest, onSelect, onJump, onEdit }: Props) {
  const [tab, setTab] = useState<'changes' | 'source' | 'issues'>('changes');
  const [open,setOpen]=useState(false);
  const review=useRef<HTMLDetailsElement>(null);
  const [limit, setLimit] = useState(50);
  useEffect(()=>{if(selection){setTab('source');setOpen(true);}},[selection]);
  useEffect(()=>{if(issueRequest){setTab('issues');setOpen(true);review.current?.scrollIntoView?.({block:'nearest'});}},[issueRequest]);
  const changes = useMemo(() => compareVersions(version, previous), [version, previous]);
  const trace = selectedTrace(version, selection);
  const origin = trace && sourceLocation(trace, source, table, version.plan);
  const warnings = version.result.issues;
  const counts = [{kind:'changed',label:'칸 변경'},{kind:'moved',label:'행 이동'},{kind:'added',label:'칸 추가'},{kind:'removed',label:'칸 제외'},{kind:'formatted',label:'개 시트 서식'},{kind:'formula',label:'개 수식'},{kind:'macro',label:'개 매크로'}].map(({kind,label})=>({count:changes.filter(c=>c.kind===kind).length,label})).filter(c=>c.count);
  return <details ref={review} className="ecc-review" open={open}>
    <summary onClick={event=>{event.preventDefault();setOpen(!open);}}>변경·근거·검사 확인 <span>{counts.length ? counts.map(c=>`${c.count}${c.label}`).join(' · ') : '변경 내역과 원본 근거'}</span></summary>
    <div className="ecc-review-tabs" aria-label="결과 검토 종류">{([['changes', '변경 내역'], ['source', '원본 근거'], ['issues', `확인할 문제 ${warnings.length}`]] as const).map(([id, label]) => <button key={id} onClick={() => setTab(id)} aria-pressed={tab === id}>{label}</button>)}</div>
    {selection && <div className="ecc-selection-tools"><strong>{selection.sheet}!{selection.address} 선택</strong><button onClick={() => { setTab('source'); onSelect({ ...selection, scope: selection.scope === 'cell' ? 'row' : 'cell' }); }}>{selection.scope === 'cell' ? '이 행 선택' : '셀만 선택'}</button><button aria-label="선택 해제" onClick={() => onSelect(undefined)}>해제</button></div>}
    <div className="ecc-review-body">
      {!!(version.plan.formulaEdits.length||version.plan.macroEdits.length)&&<details className="ecc-code-review"><summary>수식·매크로 코드 보기</summary>{version.plan.formulaEdits.map((f,i)=><div key={`formula:${i}`}><b>{f.range}</b><pre>{'='+f.formula.replace(/^=/,'')}</pre></div>)}{version.plan.macroEdits.map(m=><div key={m.module}><b>{m.module} · VBA</b><pre>{m.code}</pre></div>)}</details>}
      {tab === 'changes' && <>{!previous ? <p>첫 결과입니다. 셀을 선택한 뒤 ‘원본 근거’에서 값을 확인하세요.</p> : !changes.length ? <p>기준 결과와 작성 값·행 위치가 같습니다.</p> : <><p>결과 {previous.number}과 비교 · 이동과 값 변경을 구분합니다.</p>{changes.slice(0, limit).map(change => <button className="ecc-change" key={change.id} onClick={() => onJump(change.location, change.kind === 'removed' ? previous.id : version.id)}><b>{{ changed:'값 변경', moved:'행 이동', added:'추가', removed:'제외', formatted:'서식 변경',formula:'수식 변경',macro:'매크로 변경' }[change.kind]} · {change.label}</b><span>{showValue(change.before)} → {showValue(change.after)}</span><small>{(change.kind==='removed'?previous:version).result.outputs[change.location.outputIndex]?.name} · {change.location.sheet}!{change.location.address}</small></button>)}{changes.length > limit && <button onClick={() => setLimit(limit + 50)}>다음 변경 50개 보기</button>}</>}
        {!!version.result.excluded.length && <p>데이터 조건 제외 {version.result.excluded.filter(e => !table.skipped.some(s => s.origin === e.origin && s.reason === e.reason)).length}건 · 빈 줄·합계 등 원본 구조 제외 {table.skipped.length}줄</p>}</>}
      {tab === 'source' && <><p className="ecc-evidence">{explainSelection(version, table, selection)}</p>{origin && <button onClick={() => onJump(origin)}>원본 위치 보기</button>}{selection && <CellEdit key={`${selection.revision}:${selection.outputIndex}:${selection.sheet}:${selection.address}`} selection={selection} version={version} busy={busy} onEdit={onEdit}/>}</>}
      {tab === 'issues' && <>{!warnings.length ? <p>검사에서 발견한 문제가 없습니다.</p> : warnings.map((issue, i) => {
        const match = issue.location?.match(/^(?:(.+)!)?([A-Z]{1,3}\d+)$/);
        const hasIssue=version.result.outputs.some(o=>o.issues.some(i=>i.code===issue.code&&i.location===issue.location&&i.message===issue.message));
        const locations = match ? version.result.outputs.flatMap((o,outputIndex)=>hasIssue&&!o.issues.some(i=>i.code===issue.code&&i.location===issue.location&&i.message===issue.message)?[]:o.sheets.filter(s=>(!match[1]||s.name===match[1])&&s.cells.some(c=>c.address===match[2])).map(s=>({outputIndex,sheet:s.name,address:match[2]}))) : [];
        return <div className="ecc-review-issue" key={i}><p>{issue.message}</p>{locations.map(location=><button key={`${location.outputIndex}:${location.sheet}`} onClick={()=>onJump(location)}>{locations.length>1?`${location.outputIndex+1}번 문서 · `:''}문제 위치 보기</button>)}</div>;
      })}{warnings.some(i=>i.level==='warning')&&onAccept&&<label className="ecc-warning-accept"><input type="checkbox" checked={!!accepted} onChange={e=>onAccept(e.target.checked)}/>위 내용을 확인했습니다. 결과를 다운로드할 수 있습니다.</label>}</>}
    </div>
  </details>;
}

function CellEdit({ selection, version, busy, onEdit }: Pick<Props, 'version' | 'busy' | 'onEdit'> & { selection: CellSelection }) {
  const cell = version.result.outputs[selection.outputIndex]?.sheets.find(s => s.name === selection.sheet)?.cells.find(c => c.address === selection.address);
  const trace = selectedTrace(version, selection);
  const [value, setValue] = useState(String(cell?.value ?? ''));
  const [kind, setKind] = useState<'text' | 'number' | 'date' | 'blank'>(cell?.kind === 'number' ? 'number' : cell?.kind === 'date' ? 'date' : 'text');
  const [error, setError] = useState('');
  const nextValue=kind==='blank'?null:kind==='number'?Number(value.replace(/,/g,'')):value;
  const unchanged=(nextValue===(cell?.value??null)&&kind===(cell?.kind||'blank')) || (cell?.value==null&&!value&&(kind==='blank'||kind==='text'));
  if (cell?.formula || !trace?.mappingKey || (trace.mappingKey.startsWith('fixed:') && version.result.outputs[selection.outputIndex]?.outputCount !== 1)) return <p className="ecc-edit-note">{cell?.formula ? '이 수식도 대화로 바꿀 수 있어요. 예: “이 금액에서 세금 3.3%를 빼줘”.' : '이 칸의 문구나 서식도 대화로 바꿀 수 있어요. 예: “이 제목을 크게 해줘”.'}</p>;
  return <form className="ecc-cell-edit" onSubmit={event => {
    event.preventDefault(); setError('');
    if (kind === 'number' && (!value.trim() || !Number.isFinite(Number(value.replace(/,/g, ''))))) { setError('유효한 숫자를 입력해 주세요.'); return; }
    if (kind === 'date' && !strictDate(value)) {setError('유효한 날짜를 연-월-일 형식으로 입력해 주세요.');return;}
    onEdit(kind === 'blank' ? null : kind === 'number' ? Number(value.replace(/,/g, '')) : value, kind);
  }}><label>값 직접 수정<input aria-label="선택한 셀의 새 값" disabled={busy || kind === 'blank'} value={value} maxLength={2000} onChange={event => {setValue(event.target.value);setError('');}}/></label><select aria-label="수정 값 형식" disabled={busy} value={kind} onChange={e => {setKind(e.target.value as typeof kind);setError('');}}><option value="text">문자 (앞자리 0 유지)</option><option value="number">숫자</option><option value="date">날짜 (연-월-일)</option><option value="blank">빈칸</option></select><button disabled={busy||unchanged} type="submit">이 셀 수정 적용</button><small className="ecc-edit-hint">{unchanged?'새 값을 입력하면 이 칸만 수정할 수 있어요.':'아직 적용 전입니다. 적용하면 새 결과에 반영됩니다.'}</small>{error && <p role="alert">{error}</p>}</form>;
}
