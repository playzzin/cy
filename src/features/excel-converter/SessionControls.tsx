import React, { useEffect, useRef } from 'react';
import { SessionSummary } from './chatStorage';

interface Props {
  name:string;onName:(name:string)=>void;keep:boolean;onKeep:(keep:boolean)=>void;
  retention:number;onRetention:(days:number)=>void;status:string;failed:boolean;onRetry:()=>void;
  works:SessionSummary[];busy:boolean;hasSavedCopy:boolean;onOpen:(id:string)=>void;onDelete:()=>void;
}

export default function SessionControls(props:Props) {
  const settings=useRef<HTMLDetailsElement>(null);
  useEffect(()=>{
    const dismiss=(event:PointerEvent)=>{if(settings.current&&!settings.current.contains(event.target as Node))settings.current.open=false;};
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&settings.current?.open){settings.current.open=false;settings.current.querySelector('summary')?.focus();}};
    document.addEventListener('pointerdown',dismiss);document.addEventListener('keydown',escape);
    return()=>{document.removeEventListener('pointerdown',dismiss);document.removeEventListener('keydown',escape);};
  },[]);
  return <div className="ecc-session-bar">
    <label className="ecc-work-title">작업명<input aria-label="작업명" value={props.name} disabled={props.busy} maxLength={120} onChange={e=>props.onName(e.target.value)}/></label>
    <label className="ecc-keep-work"><input type="checkbox" checked={props.keep} onChange={e=>props.onKeep(e.target.checked)}/>이 기기에 작업 보관</label>
    <span role="status" className={props.failed?'ecc-save-error':''}>{props.keep||props.failed?props.status:'자동 보관 꺼짐'}</span>
    {props.failed&&props.keep&&<button onClick={props.onRetry}>저장 다시 시도</button>}
    <details ref={settings} className="ecc-storage-settings"><summary>보관함·설정{props.works.length>0&&<span>{props.works.length}</span>}</summary>
      <div className="ecc-storage-options">
        <label>보관한 작업<select aria-label="보관한 작업 열기" value="" disabled={props.busy} onChange={e=>{if(e.target.value){props.onOpen(e.target.value);if(settings.current)settings.current.open=false;}}}><option value="">보관한 작업 {props.works.length}개</option>{props.works.map(work=><option key={work.id} value={work.id}>{work.name} · {new Date(work.updatedAt).toLocaleDateString('ko-KR')}</option>)}</select></label>
        <label>보관 기간<select aria-label="작업 보관 기간" value={props.retention} onChange={e=>props.onRetention(Number(e.target.value))}><option value={1}>1일</option><option value={7}>7일</option><option value={30}>30일</option></select></label>
        <p>첨부 파일·대화·결과를 이 브라우저에 보관합니다. 다른 기기에는 동기화되지 않으며, 자동 보관을 꺼도 기존 보관본은 유지됩니다.</p>
        {props.hasSavedCopy&&<button disabled={props.busy} onClick={props.onDelete}>현재 보관본 지우기</button>}
      </div>
    </details>
  </div>;
}
