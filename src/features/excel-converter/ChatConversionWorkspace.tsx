import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowLeftRight, ArrowUp, Check, ChevronDown, Eye, FileSpreadsheet, Loader2, Paperclip, Plus, Sparkles, X } from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import type { WorkspaceProps } from './ConversionWorkspace';
import { ConversionPlan, ConversionResult, planSchema, WorkbookFile } from './types';
import { readWorkbook, workbookMime } from './workbook';
import { createDocumentPlan, documentTotals, readSourceDocument } from './businessDocuments';
import { convertWorkbook } from './writer';
import { ConversationMessage, conversationPrompt, conversationQuestions, DEFAULT_CONVERSION_MESSAGE } from './conversation';
import WorkbookPreview from './WorkbookPreview';
import { PrepareConversion, PreparedConversion } from './structure';
import { clearStructureMemory, rememberStructure, StructureQuestions } from './preparation';
import { planProblems, repairPrompt, VerificationSummary, verifyConversion } from './verification';
import { PlannerResult } from './plannerRequest';
import './chatConversion.css';

type AiStatus = { configured: boolean; model: string; thinkingLevel?: string };
export interface ChatWorkspaceProps extends WorkspaceProps { checkAi?: () => Promise<AiStatus>; prepare?:PrepareConversion; analyzePrepared?:(prompt:string,plan:ConversionPlan,prepared:PreparedConversion,target:WorkbookFile)=>Promise<PlannerResult>; }
type Pair = [WorkbookFile | undefined, WorkbookFile | undefined];
interface ResultVersion { id: string; number: number; result: ConversionResult; request: string; verification:VerificationSummary; reused:boolean; }
const errorText = (error: unknown) => error instanceof Error ? error.message : '처리하지 못했습니다. 같은 요청을 다시 보내 주세요.';
const message = (role: ConversationMessage['role'], text: string): ConversationMessage => ({ id: crypto.randomUUID(), role, text });

export default function ChatConversionWorkspace({ ownerId, analyze, checkAi, prepare, analyzePrepared }: ChatWorkspaceProps) {
  const [files, setFiles] = useState<Pair>([undefined, undefined]);
  const [sheets, setSheets] = useState<[string, string]>(['', '']);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [plan, setPlan] = useState<ConversionPlan>();
  const [prepared, setPrepared] = useState<PreparedConversion>();
  const [versions, setVersions] = useState<ResultVersion[]>([]);
  const [previewId, setPreviewId] = useState('');
  const [showFiles, setShowFiles] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [ai, setAi] = useState<AiStatus>();
  const [aiError, setAiError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [accepted, setAccepted] = useState<string[]>([]);
  const attachment = useRef<HTMLInputElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const locked = useRef(false);
  const operation = useRef(0);
  const controller = useRef<AbortController>();
  const [source, target] = files;
  const sourceState = useMemo(() => {
    if (!source) return {};
    try { const document = prepared?.document || readSourceDocument(source, sheets[0]); return { document, totals: documentTotals(document.table) }; }
    catch (e) { return { error: errorText(e) }; }
  }, [source, sheets, prepared]);
  useEffect(() => {
    let active = true;
    if (checkAi) checkAi().then(value => { if (active) setAi(value); }).catch(e => { if (active) setAiError(errorText(e)); });
    return () => { active = false; operation.current++; controller.current?.abort(); };
  }, [checkAi]);
  useEffect(() => { if (messages.length || versions.length) end.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }); }, [messages.length, versions.length]);
  useEffect(() => {
    if (!busy) return;
    const guard = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', guard); return () => window.removeEventListener('beforeunload', guard);
  }, [busy]);

  const clearConversation = (keepDraft = true) => { setPlan(undefined); setPrepared(undefined); setMessages([]); setVersions([]); setPreviewId(''); setAccepted([]); setError(''); if (!keepDraft) setDraft(''); };
  const install = (next: Pair, keepDraft = true) => { clearConversation(keepDraft); setFiles(next); setSheets([next[0]?.sheets[0]?.name || '', next[1]?.sheets[0]?.name || '']); setShowFiles(false); };
  const upload = async (selected: FileList | File[] | null, slot?: 0 | 1) => {
    if (!selected?.length || locked.current) return;
    locked.current = true; setBusy('첨부파일을 읽고 있어요'); setError('');
    const run = ++operation.current;
    try {
      if (selected.length > (slot === undefined ? 2 : 1)) throw new Error('원본과 받을 양식, 두 개의 엑셀 파일을 선택해 주세요.');
      const read = await Promise.all(Array.from(selected).map(async file => readWorkbook(await file.arrayBuffer(), file.name)));
      if (operation.current !== run) return;
      const next: Pair = [...files];
      if (slot !== undefined) next[slot] = read[0];
      else if (read.length === 2) { next[0] = read[0]; next[1] = read[1]; }
      else if (!next[0]) next[0] = read[0];
      else if (!next[1]) next[1] = read[0];
      else throw new Error('파일을 바꾸려면 첨부된 파일의 “바꾸기”를 눌러 주세요.');
      install(next, true);
    } catch (e) { if (operation.current === run) setError(errorText(e)); }
    finally { if (operation.current === run) { locked.current = false; setBusy(''); } }
  };
  const loadExample = async (kind: 'labor' | 'delegation' | 'variant' = 'labor') => {
    if (locked.current) return;
    locked.current = true; setBusy('예시 파일을 준비하고 있어요'); setError('');
    const run = ++operation.current;
    try {
      const names = kind === 'delegation' ? ['10_현재위임장_가상원본.xlsx', '11_타회사위임장_개인별양식.xlsx'] : kind === 'variant' ? ['40_새로운세줄원본_가상.xlsx', '41_타회사세줄_열순서변경.xlsx'] : ['20_현재노임명세서_2026-09_가상원본.xlsx', '30_병합셀_타회사노임양식.xlsx'];
      const example = await Promise.all(names.map(async name => {
        const response = await fetch(`/excel-converter/examples/${encodeURIComponent(name)}`);
        if (!response.ok) throw new Error('예시 파일을 불러오지 못했습니다. 다시 시도해 주세요.');
        return readWorkbook(await response.arrayBuffer(), name);
      }));
      if (operation.current === run) install([example[0], example[1]], false);
    } catch (e) { if (operation.current === run) setError(errorText(e)); }
    finally { if (operation.current === run) { locked.current = false; setBusy(''); } }
  };
  const send = async () => {
    if (locked.current || !source || !target) return;
    const request = draft.trim() || DEFAULT_CONVERSION_MESSAGE;
    locked.current = true; const run = ++operation.current;
    setBusy('Gemini가 두 파일과 요청을 확인하고 있어요'); setError('');
    setMessages(previous => [...previous, message('user', request)]); setDraft('');
    controller.current = new AbortController();
    try {
      const prompt=conversationPrompt(request,messages);
      const context=prepared||(prepare?await prepare(source,target,sheets[0],sheets[1],prompt,text=>{if(operation.current===run)setBusy(text);},controller.current.signal):undefined);
      if(operation.current!==run)return;
      if(context)setPrepared(context);
      const document=context?.document||sourceState.document;
      if(!document)throw new Error(sourceState.error||'원본에서 옮길 데이터를 찾지 못했습니다. 원본 시트를 확인해 주세요.');
      if(!document.table.rows.length)throw new Error('원본 시트에 옮길 데이터가 없습니다.');
      const base=plan||context?.plan||createDocumentPlan(target,document,sheets[1]);
      let current=base,feedback='';
      for(let attempt=0;attempt<=2;attempt++){
        setBusy(attempt?`검사에서 발견한 항목을 Gemini가 수정하고 있어요 (${attempt}/2)`:'Gemini가 요청에 맞는 작성 규칙을 정하고 있어요');
        const response=context&&analyzePrepared?await analyzePrepared(prompt+feedback,current,context,target):await analyze(prompt+feedback,current,document.table,target);
        if(operation.current!==run)return;
        const next=planSchema.parse(response.plan);
        if(next.targetId!==target.id||next.sheetName!==sheets[1])throw new Error('다른 양식으로 분석되었습니다. 다시 요청해 주세요.');
        const questions=conversationQuestions(next,document.table);
        if(questions.length){setPlan(next);throw new StructureQuestions(questions);}
        let problems=planProblems(next,document.table,base,[...messages.filter(m=>m.role==='user').map(m=>m.text),request].join('\n'));
        let result:ConversionResult|undefined,verification:VerificationSummary|undefined;
        if(!problems.length){
          setBusy('엑셀을 작성하고 사람별 값과 양식 보존 상태를 검사하고 있어요');
          try{
            result=await convertWorkbook(target,next,document.table,text=>{if(operation.current===run)setBusy(text);},controller.current.signal);
            if(operation.current!==run)return;
            problems=result.issues.filter(issue=>issue.level==='error');
            if(!problems.length&&result.outputs.length){const checked=await verifyConversion(target,next,document.table,result);result.issues.push(...checked.issues);problems=checked.issues.filter(issue=>issue.level==='error');verification={...checked.summary,repairs:attempt};}
            if(!result.outputs.length&&!problems.length)problems=[{level:'error',code:'empty-output',message:'완성 파일을 만들지 못했습니다.'}];
          }catch(e){if(operation.current!==run)return;problems=[{level:'error',code:'layout-or-value',message:errorText(e)}];}
        }
        if(operation.current!==run)return;
        if(problems.length){if(attempt===2)throw new Error(problems.slice(0,3).map(p=>p.message).join('\n'));current=next;feedback=('\n'+repairPrompt(problems,attempt+1)).slice(0,Math.max(0,6000-prompt.length));continue;}
        if(!result||!verification)throw new Error('결과 검사를 완료하지 못했습니다.');
        setPlan(next);
        const version:ResultVersion={id:crypto.randomUUID(),number:versions.length+1,result,request,verification,reused:!!context?.reused};
        setVersions(previous=>[...previous,version]);setPreviewId(version.id);
        if(context)rememberStructure(ownerId,context,next);
        setMessages(previous=>[...previous,message('assistant',`완성했어요. 결과 ${version.number}에서 엑셀을 내려받을 수 있습니다.\n${next.summary.slice(0,3).join('\n')}`)]);
        break;
      }
    }catch(e){if(operation.current===run){if(e instanceof StructureQuestions){setMessages(previous=>[...previous,message('assistant',`이 내용만 알려주시면 이어서 만들게요.\n${e.questions.slice(0,6).map(q=>`• ${q}`).join('\n')}`)]);composer.current?.focus();}else{setError(errorText(e));setDraft(request);}}}
    finally {if(operation.current===run){locked.current=false;setBusy('');}}
  };
  const stop = () => { operation.current++; controller.current?.abort(); locked.current = false; setBusy(''); setMessages(previous => [...previous, message('assistant', '요청 처리를 중단했습니다. 이전에 완성한 결과는 그대로 내려받을 수 있어요.')]); };
  const download = async (version: ResultVersion) => {
    if (version.result.issues.some(issue => issue.level === 'warning') && !accepted.includes(version.id)) return;
    try {
      if (version.result.outputs.length === 1) { const out = version.result.outputs[0]; saveAs(new Blob([out.bytes], { type: workbookMime(out.name) }), out.name); }
      else { const zip = new JSZip(); version.result.outputs.forEach(out => zip.file(out.name, out.bytes)); saveAs(await zip.generateAsync({ type: 'blob' }), `변환결과_${version.number}.zip`); }
    } catch { setError('다운로드를 시작하지 못했습니다. 다운로드 버튼을 다시 눌러 주세요.'); }
  };
  const preview = versions.find(version => version.id === previewId);
  const ready = !!source && !!target;
  return <main className="ecc-page">
    <header className="ecc-topbar"><div><span className="ecc-app-icon"><FileSpreadsheet size={21}/></span><strong>엑셀 양식 변환</strong><span className="ecc-beta">Gemini</span></div><button disabled={!!busy} onClick={() => install([undefined, undefined], false)}><Plus size={16}/>새 대화</button></header>
    <div className="ecc-content">
      <section className={`ecc-intro ${messages.length ? 'compact' : ''}`}><span className="ecc-kicker"><Sparkles size={15}/>말로 부탁하는 엑셀 작업</span><h1>파일 두 개 올리고,<br/>원하는 대로 말해 주세요.</h1><p>첫 번째 파일의 데이터를 두 번째 양식으로.<br className="ecc-mobile-break"/> 완성된 엑셀까지 만들어 드려요.</p></section>
      <section className={`ecc-attachments ${dragging ? 'dragging' : ''}`} aria-label="첨부파일" onDragOver={event => { event.preventDefault(); if (!busy) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); void upload(Array.from(event.dataTransfer.files)); }}>
        <div className="ecc-section-label"><span>첨부파일 <b>{files.filter(Boolean).length}/2</b></span>{ready && <button disabled={!!busy} onClick={() => install([target, source])}><ArrowLeftRight size={14}/>순서 바꾸기</button>}</div>
        {!source && !target ? <button className="ecc-drop" disabled={!!busy} onClick={() => attachment.current?.click()}><span className="ecc-drop-icon"><Paperclip size={26}/></span><strong>엑셀 파일 두 개 첨부</strong><span>여기로 끌어 놓거나 클릭해서 선택하세요</span><small>.xlsx · .xlsm · 파일당 20MB까지</small></button> : <div className="ecc-files">{([0, 1] as const).map(slot => <Attachment key={slot} file={files[slot]} slot={slot} busy={!!busy} sheet={sheets[slot]} onSheet={name => { clearConversation(); setSheets(previous => slot === 0 ? [name, previous[1]] : [previous[0], name]); }} onUpload={selected => upload(selected, slot)} onRemove={() => { const next: Pair = [...files]; next[slot] = undefined; install(next); }}/>)}</div>}
        <input ref={attachment} className="ecc-hidden-input" aria-label="엑셀 파일 두 개 선택" type="file" accept=".xlsx,.xlsm" multiple disabled={!!busy} onChange={event => { void upload(event.target.files); event.target.value = ''; }}/>
        <p className="ecc-attachment-hint"><span><b>1</b> 데이터가 있는 원본</span><span><b>2</b> 완성할 양식</span>{ready && <button onClick={() => setShowFiles(!showFiles)} aria-expanded={showFiles}><Eye size={14}/>첨부 미리보기</button>}</p>
      </section>
      {showFiles && <WorkbookPreview source={source} target={target}/>}
      {sourceState.totals && (!prepare || prepared) && <p className="ecc-source-summary"><Check size={15}/>원본 {sourceState.totals.people}건{sourceState.totals.manDays !== undefined && ` · ${sourceState.totals.manDays}공수`}{sourceState.totals.amount !== undefined && ` · ${sourceState.totals.amount.toLocaleString()}원`}</p>}
      {!messages.length && <div className="ecc-starters"><p>이렇게 부탁해 보세요</p>{[DEFAULT_CONVERSION_MESSAGE, '원본 내용은 그대로 옮기고, 이름순으로 정렬해줘.', '첫 번째 파일을 두 번째 양식으로 바꾸고 서명란은 비워줘.'].map(text => <button key={text} disabled={!!busy} onClick={() => { setDraft(text); composer.current?.focus(); }}>{text}<ArrowUp size={14}/></button>)}</div>}
      <section className="ecc-conversation" aria-label="변환 대화" aria-live="polite">{messages.map(turn => <div key={turn.id} className={`ecc-message ${turn.role}`}><span className="ecc-speaker">{turn.role === 'user' ? '나' : <><Sparkles size={14}/>Gemini</>}</span><p>{turn.text}</p></div>)}</section>
      {!!versions.length && <section className="ecc-results" aria-label="완성된 엑셀"><div className="ecc-section-label"><span>완성된 결과 <b>{versions.length}</b></span><small>추가 요청을 해도 이전 결과는 유지됩니다</small></div>{versions.map(version => {
        const warnings = version.result.issues.filter(issue => issue.level === 'warning');
        const downloadable = !warnings.length || accepted.includes(version.id);
        return <article className="ecc-result" key={version.id}><div className="ecc-result-heading"><span className="ecc-result-icon"><FileSpreadsheet size={24}/></span><div><strong>결과 {version.number} <span>{version.number === versions.length ? '최신' : ''}</span></strong><p>{version.result.outputs.length === 1 ? version.result.outputs[0].name : `엑셀 ${version.result.outputs.length}개 · ZIP으로 다운로드`}</p><small>{version.result.inputCount}건 중 {version.result.outputCount}건 작성{version.result.excluded.length ? ` · ${version.result.excluded.length}건 제외` : ''}</small></div></div><p className="ecc-result-request">{version.request}</p><div className="ecc-verification" aria-label="결과 검사"><span>{version.verification.identityChecked ? `인원 ${version.verification.records}건 개별 대조` : `작성 ${version.verification.records}건`}</span><span>입력 값 {version.verification.cells}칸 대조</span><span>{version.verification.preservationChecked ? '병합·양식 보존 확인' : '양식 확인 필요'}</span>{version.verification.daysChecked > 0 && <span>일별 공수 {version.verification.daysChecked}칸 대조</span>}{version.verification.unverifiedFormulas && <span>일부 수식은 Excel 재계산 필요</span>}{version.verification.repairs > 0 && <span>자동 보정 {version.verification.repairs}회</span>}{version.reused && <span>검증한 양식 재사용</span>}</div><div className="ecc-result-actions"><button onClick={() => setPreviewId(previewId === version.id ? '' : version.id)} aria-expanded={previewId === version.id}><Eye size={16}/>미리보기</button><button className="ecc-download" disabled={!downloadable} onClick={() => void download(version)}><ArrowDownToLine size={17}/>{version.result.outputs.length === 1 ? '엑셀 다운로드' : '엑셀 모두 다운로드'}</button></div>{!!warnings.length && <details className="ecc-warnings" open={!downloadable}><summary>다운로드 전 확인할 내용 {warnings.length}개</summary>{warnings.map((warning, index) => <p key={index}>{warning.message}</p>)}<label><input type="checkbox" checked={accepted.includes(version.id)} onChange={event => setAccepted(previous => event.target.checked ? [...previous, version.id] : previous.filter(id => id !== version.id))}/>내용을 확인했습니다</label></details>}</article>;
      })}</section>}
      {preview && <div className="ecc-result-preview"><div className="ecc-preview-title"><strong>결과 {preview.number} 미리보기</strong><button onClick={() => setPreviewId('')} aria-label="결과 미리보기 닫기"><X size={17}/></button></div><WorkbookPreview key={preview.id} outputs={preview.result.outputs}/></div>}
      <div ref={end}/>
      {error && <div className="ecc-error" role="alert"><strong>요청을 완료하지 못했어요</strong><p>{error}</p><span>요청을 수정하거나 같은 내용으로 다시 보내 주세요.</span><button aria-label="오류 안내 닫기" onClick={() => setError('')}><X size={16}/></button></div>}
      {busy && <div className="ecc-progress" role="status"><Loader2 size={18}/><span>{busy}</span><button onClick={stop}>중단</button></div>}
      <form className="ecc-composer" onSubmit={event => { event.preventDefault(); void send(); }}><label htmlFor="excel-chat-request">{messages.length ? '이어서 요청하기' : '어떻게 바꿔드릴까요?'}</label><textarea id="excel-chat-request" ref={composer} maxLength={2000} rows={3} value={draft} disabled={!!busy} onChange={event => setDraft(event.target.value)} placeholder={messages.length ? '예: 회사명을 청연ENG로 바꿔줘. 이름순으로 다시 정렬해줘.' : DEFAULT_CONVERSION_MESSAGE}/><div className="ecc-composer-bottom"><span>{ready ? '원하는 내용을 적고 보내세요. 비워 두면 양식에 맞춰 변환합니다.' : '원본과 완성할 양식을 먼저 첨부해 주세요.'}</span><button className="ecc-send" type="submit" disabled={!ready || !!busy}><ArrowUp size={18}/>{versions.length ? '수정 요청' : '변환 요청'}</button></div></form>
      <footer className="ecc-footer"><span className={`ecc-model ${ai?.configured ? 'connected' : ''}`}><i/>{ai?.configured ? ai.model.replace(/^gemini-/, 'Gemini ') : aiError ? 'Gemini 연결 확인 필요' : ai ? 'Gemini 설정 필요' : 'Gemini'}</span><a href="/settings/ai#excel-conversion-ai">AI 설정</a><span>원본 파일은 바뀌지 않습니다. 대화와 결과는 이 화면을 닫으면 사라집니다. 검증한 양식 규칙은 이 브라우저에 30일간 기억합니다.</span></footer>
      <details className="ecc-help"><summary><ChevronDown size={14}/>처음 사용하시나요?</summary><p>원본과 받을 양식을 첨부한 뒤 원하는 내용을 보내세요. 순서가 반대라면 “순서 바꾸기”를 누르세요. 여러 시트가 있으면 사용할 시트를 선택할 수 있습니다. 추가 요청은 같은 대화에 이어서 입력하세요.</p><p>Gemini가 항목·서식과 요청을 분석하고, 프로그램이 실제 데이터를 옮겨 엑셀을 만듭니다. 원본의 개인정보 행은 AI에 보내지 않습니다.</p><button disabled={!!busy} onClick={() => void loadExample()}>가상 노임명세서 두 파일로 체험하기</button><button disabled={!!busy} onClick={() => void loadExample('delegation')}>가상 위임장으로 체험하기</button><button disabled={!!busy} onClick={() => void loadExample('variant')}>새로운 세 줄 양식으로 체험하기</button><button disabled={!!busy} onClick={() => { clearStructureMemory(ownerId); setMessages(previous => [...previous, message('assistant', '이 브라우저에 기억한 양식 규칙을 지웠습니다.')]); }}>기억한 양식 지우기</button></details>
    </div>
  </main>;
}

function Attachment({ file, slot, busy, sheet, onSheet, onUpload, onRemove }: { file?: WorkbookFile; slot: 0 | 1; busy: boolean; sheet: string; onSheet: (name: string) => void; onUpload: (files: FileList | null) => void; onRemove: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const title = slot === 0 ? '데이터 원본' : '완성할 양식';
  return <div className={`ecc-file ${file ? 'attached' : ''}`}><div className="ecc-file-role"><b>{slot + 1}</b><strong>{title}</strong>{file && <button disabled={busy} onClick={onRemove} aria-label={`${title} 제거`}><X size={14}/></button>}</div><button className="ecc-file-name" disabled={busy} onClick={() => input.current?.click()} aria-label={`${title} ${file ? '바꾸기' : '첨부'}`}><FileSpreadsheet size={24}/><span>{file?.name || `${title} 첨부`}</span></button><input className="ecc-hidden-input" ref={input} type="file" aria-label={`${title} 파일 선택`} accept=".xlsx,.xlsm" disabled={busy} onChange={event => { onUpload(event.target.files); event.target.value = ''; }}/>{file && <div className="ecc-file-meta"><span>{Math.max(1, Math.round(file.bytes.byteLength / 1024))} KB · {file.sheets.length}개 시트</span><button disabled={busy} onClick={() => input.current?.click()}>바꾸기</button></div>}{file && file.sheets.length > 1 && <label className="ecc-sheet">사용할 시트<select disabled={busy} aria-label={`${title} 시트`} value={sheet} onChange={event => onSheet(event.target.value)}>{file.sheets.map(value => <option key={value.name}>{value.name}</option>)}</select></label>}</div>;
}
