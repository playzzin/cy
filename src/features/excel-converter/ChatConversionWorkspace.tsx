import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowLeftRight, ArrowRight, Check, ChevronDown, ChevronRight, CircleHelp, Eye, FileCheck2, FileSpreadsheet, FolderOpen, LayoutTemplate, Loader2, MessageSquare, Paperclip, Plus, ShieldCheck, Sparkles, Upload, X } from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import type { WorkspaceProps } from './ConversionWorkspace';
import { ConversionPlan, ConversionResult, planSchema, WorkbookFile } from './types';
import { readWorkbook, workbookMime } from './workbook';
import { createDocumentPlan, documentTotals, readSourceDocument } from './businessDocuments';
import { convertWorkbook } from './writer';
import { ConversationMessage, conversationPrompt, conversationQuestions, DEFAULT_CONVERSION_MESSAGE } from './conversation';
import WorkbookPreview from './WorkbookPreview';
import { PrepareConversion, PreparedConversion, workbookAtlas } from './structure';
import { editWorkbookLayout, moveEditingVersion, rebaseLayoutPlan } from './layoutEditing';
import { clearStructureMemory, rememberStructure, StructureQuestions } from './preparation';
import { planProblems, repairPrompt, VerificationSummary, verifyConversion } from './verification';
import { PlannerResult } from './plannerRequest';
import { activeConditions, CellLocation, CellSelection, ChatMessage, clonePlan, compareVersions, editSelectedCell, removeCondition, ResultVersion } from './review';
import { conditionContext, explainRequest, isExplanationRequest, preserveUnrequestedRules, selectedRequest } from './chatActions';
import ResultReview from './ResultReview';
import SessionControls from './SessionControls';
import { ChatSession, listChatSessions, loadChatSession, removeChatSession, saveChatSession, SessionSummary } from './chatStorage';
import './chatConversion.css';
import { AnalyzeEdit, applyEditDecision } from './editRequest';
import { createRequestScope } from './requestScope';

type AiStatus = { configured: boolean; model: string; thinkingLevel?: string };
export interface ChatWorkspaceProps extends WorkspaceProps { edit?:AnalyzeEdit; checkAi?: () => Promise<AiStatus>; prepare?:PrepareConversion; analyzePrepared?:(prompt:string,plan:ConversionPlan,prepared:PreparedConversion,target:WorkbookFile)=>Promise<PlannerResult>; }
type Pair = [WorkbookFile | undefined, WorkbookFile | undefined];
const errorText = (error: unknown) => error instanceof Error ? error.message : '처리하지 못했습니다. 같은 요청을 다시 보내 주세요.';
const message = (role: ConversationMessage['role'], text: string): ConversationMessage => ({ id: crypto.randomUUID(), role, text });

export default function ChatConversionWorkspace(props: ChatWorkspaceProps) {
  // A changed account gets a fresh workspace before any persistence effect runs.
  return <ChatWorkspace key={props.ownerId} {...props}/>;
}
function ChatWorkspace({ ownerId, analyze, checkAi, prepare, analyzePrepared, edit }: ChatWorkspaceProps) {
  const [sessionId, setSessionId] = useState<string>(() => crypto.randomUUID());
  const [workName, setWorkName] = useState('새 엑셀 작업');
  const [keepWork, setKeepWork] = useState(false);
  const [retentionDays, setRetentionDays] = useState(7);
  const [savedWorks, setSavedWorks] = useState<SessionSummary[]>([]);
  const [saveState, setSaveState] = useState('이 기기에 보관 안 함');
  const [savedSnapshot, setSavedSnapshot] = useState<ChatSession>();
  const [pendingReset, setPendingReset] = useState<{kind:'discard'|'delete';action:()=>void}>();
  const [savingReset, setSavingReset] = useState(false);
  const [saveFailure, setSaveFailure] = useState(false);
  const [saveRetry, setSaveRetry] = useState(0);
  const [reviewRequest, setReviewRequest] = useState<{versionId:string;nonce:number}>();
  const [resultNotice, setResultNotice] = useState('');
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const saveEpoch = useRef(0);
  const resetDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (pendingReset) resetDialog.current?.showModal?.();
    else resetDialog.current?.close?.();
  }, [pendingReset]);
  const [mobilePane, setMobilePane] = useState<'chat' | 'preview'>('chat');
  const [paneWidth, setPaneWidth] = useState(34);
  const [files, setFiles] = useState<Pair>([undefined, undefined]);
  const [sheets, setSheets] = useState<[string, string]>(['', '']);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeHistory, setActiveHistory] = useState<ConversationMessage[]>([]);
  const [plan, setPlan] = useState<ConversionPlan>();
  const [prepared, setPrepared] = useState<PreparedConversion>();
  const [versions, setVersions] = useState<ResultVersion[]>([]);
  const [previewId, setPreviewId] = useState('');
  const [baseId, setBaseId] = useState('');
  const [selection, setSelection] = useState<CellSelection>();
  const [focusLocation, setFocusLocation] = useState<CellLocation & { nonce: number }>();
  const followConversation = useRef(true);
  const [showFiles, setShowFiles] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [ai, setAi] = useState<AiStatus>();
  const [aiError, setAiError] = useState('');
  const [accepted, setAccepted] = useState<string[]>([]);
  const attachment = useRef<HTMLInputElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const conversation = useRef<HTMLDivElement>(null);
  const locked = useRef(false);
  const operation = useRef(0);
  const controller = useRef<AbortController>();
  const pendingRequest = useRef('');
  const [slowRequest, setSlowRequest] = useState(false);
  const isBusy = !!busy;
  useEffect(() => {
    setSlowRequest(false);
    if (!isBusy) return;
    const timer = setTimeout(() => setSlowRequest(true), 30000);
    return () => clearTimeout(timer);
  }, [isBusy]);
  const [source, target] = files;
  const snapshot = useMemo<ChatSession>(() => ({id:sessionId,ownerId,name:workName,updatedAt:Date.now(),expiresAt:Date.now()+retentionDays*86400000,files,sheets,messages,activeHistory,versions,plan,prepared,previewId,baseId,draft,accepted}), [sessionId,ownerId,workName,retentionDays,files,sheets,messages,activeHistory,versions,plan,prepared,previewId,baseId,draft,accepted]);
  const hasWork = files.some(Boolean) || !!draft.trim() || !!messages.length;
  const dirty = hasWork && savedSnapshot !== snapshot;
  const persistSnapshot = useCallback(async(current:ChatSession,epoch:number) => {
    setSaveState('저장 중');setSaveFailure(false);
    try {
      await saveChatSession(current);
      if(saveEpoch.current===epoch){setSavedSnapshot(current);setSaveState('이 기기에 저장됨');}
      try {const items=await listChatSessions(ownerId);if(saveEpoch.current===epoch)setSavedWorks(items);}catch{/* A saved file remains saved even if refreshing the list fails. */}
      return true;
    } catch(e) {if(saveEpoch.current===epoch){setSaveState(errorText(e));setSaveFailure(true);}return false;}
  },[ownerId]);
  useEffect(() => { let active=true; listChatSessions(ownerId).then(items=>{if(active)setSavedWorks(items);}).catch(()=>{}); return()=>{active=false;}; },[ownerId]);
  useEffect(() => {
    const epoch=++saveEpoch.current;
    if(!keepWork || !hasWork) {setSaveState(keepWork?'작업을 시작하면 자동 보관됩니다':'자동 보관 꺼짐');return;}
    setSaveState('저장 대기 중');
    const timer=setTimeout(()=>{
      saveQueue.current=saveQueue.current.catch(()=>{}).then(async()=>{
        if(saveEpoch.current!==epoch)return;
        await persistSnapshot(snapshot,epoch);
      });
    },600);
    return()=>{clearTimeout(timer);saveEpoch.current++;};
  },[snapshot,keepWork,hasWork,persistSnapshot,saveRetry]);
  const guardReset = (action:()=>void) => { if (dirty) setPendingReset({kind:'discard',action}); else action(); };
  const saveThenContinue = async() => {
    if(!pendingReset || savingReset)return;
    const next=pendingReset.action,epoch=++saveEpoch.current;setSavingReset(true);
    const task=saveQueue.current.catch(()=>{}).then(()=>persistSnapshot(snapshot,epoch));
    saveQueue.current=task.then(()=>{});
    const saved=await task;setSavingReset(false);
    if(saved){setPendingReset(undefined);next();}
  };
  const restore = async(id:string) => {
    if(locked.current)return;
    locked.current=true;setBusy('보관한 작업을 복원하고 있어요');const run=++operation.current;
    try {const saved=await loadChatSession(ownerId,id);if(operation.current!==run)return;
      setSessionId(saved.id);setWorkName(saved.name);setRetentionDays(Math.max(1,Math.min(30,Math.round((saved.expiresAt-saved.updatedAt)/86400000))));setFiles(saved.files);setSheets(saved.sheets);setMessages(saved.messages);setActiveHistory(saved.activeHistory);setVersions(saved.versions);setPlan(saved.plan);setPrepared(saved.prepared);setPreviewId(saved.previewId);setBaseId(saved.baseId);setDraft(saved.draft);setAccepted(saved.accepted);setSelection(undefined);setFocusLocation(undefined);setShowFiles(false);setError('');setKeepWork(true);
    }catch(e){if(operation.current===run)setError(errorText(e));}finally{if(operation.current===run){locked.current=false;setBusy('');}}
  };
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
  useEffect(() => {
    const element = conversation.current;
    if (element && followConversation.current) element.scrollTop = element.scrollHeight;
  }, [messages.length, versions.length, busy, error]);
  useEffect(() => {
    if (!busy && !dirty) return;
    const guard = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', guard); return () => window.removeEventListener('beforeunload', guard);
  }, [busy, dirty]);

  const clearConversation = (keepDraft = true) => { setPlan(undefined); setPrepared(undefined); setMessages([]); setActiveHistory([]); setVersions([]); setPreviewId(''); setBaseId(''); setSelection(undefined); setFocusLocation(undefined); setResultNotice(''); setReviewRequest(undefined); setAccepted([]); setError(''); if (!keepDraft) setDraft(''); };
  const install = (next: Pair, keepDraft = true) => { clearConversation(keepDraft); setSessionId(crypto.randomUUID()); setSavedSnapshot(undefined); setSaveFailure(false); setWorkName(next[1]?.name.replace(/\.xls[xm]$/i,'') || '새 엑셀 작업'); setFiles(next); setSheets([next[0]?.sheets[0]?.name || '', next[1]?.sheets[0]?.name || '']); setShowFiles(true); };
  const upload = async (selected: FileList | File[] | null, slot?: 0 | 1) => {
    if (!selected?.length || locked.current) return;
    locked.current = true; setBusy('첨부파일을 읽고 있어요'); setError('');
    const run = ++operation.current;
    try {
      if (selected.length > (slot === undefined ? 2 : 1)) throw new Error(slot === undefined ? '원본과 받을 양식, 두 개의 엑셀 파일을 선택해 주세요.' : '이 영역에는 파일 한 개만 넣어 주세요. 원본과 완성할 양식을 각각 첨부할 수 있어요.');
      const read = await Promise.all(Array.from(selected).map(async (file, index) => {
        const destination = slot ?? (selected.length === 2 ? index : files[0] ? 1 : 0);
        try { return await readWorkbook(await file.arrayBuffer(), file.name, undefined, { allowExternalLinks: destination === 0 }); }
        catch (e) { throw new Error(`${destination === 0 ? '데이터 원본' : '완성할 양식'} (${file.name}): ${errorText(e)}`); }
      }));
      if (operation.current !== run) return;
      const next: Pair = [...files];
      if (slot !== undefined) next[slot] = read[0];
      else if (read.length === 2) { next[0] = read[0]; next[1] = read[1]; }
      else if (!next[0]) next[0] = read[0];
      else if (!next[1]) next[1] = read[0];
      else throw new Error('파일을 바꾸려면 첨부된 파일의 “바꾸기”를 눌러 주세요.');
      // Adding the missing file retains existing attachments and the draft.
      const replacesFile=files.some((file,index)=>file&&file!==next[index]);
      if(replacesFile || versions.length || messages.length)guardReset(() => install(next,true));else install(next,true);
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
      if (operation.current === run) install([example[0], example[1]], true);
    } catch (e) { if (operation.current === run) setError(errorText(e)); }
    finally { if (operation.current === run) { locked.current = false; setBusy(''); } }
  };
  const send = async (localPlan?: ConversionPlan, explicitRequest?: string, fromVersion?: ResultVersion) => {
    if (locked.current || !source || !target || (messages.length > 0 && !draft.trim() && !explicitRequest)) return;
    const request = explicitRequest || draft.trim() || DEFAULT_CONVERSION_MESSAGE;
    const baseVersion = versions.find(v => v.id === baseId) || versions[versions.length - 1];
    const viewed = versions.find(v => v.id === previewId);
    const selectedVersion = selection && viewed?.id === selection.revision ? viewed : undefined;
    const parent = fromVersion || selectedVersion || baseVersion;
    if (isExplanationRequest(request)) {
      setMessages(previous => [...previous, message('user', request), message('assistant', viewed && sourceState.document ? explainRequest(request,viewed,sourceState.document.table,selection,versions.find(v=>v.id===viewed.parentId)) : '먼저 변환 결과를 만든 뒤 궁금한 셀을 선택해 질문해 주세요.')]); setDraft(''); return;
    }
    if (!edit && !localPlan && selection && !/전체/.test(request)) {
      try { if (!selectedVersion) throw new Error('수정할 결과를 다시 선택해 주세요.'); localPlan = selectedRequest(selectedVersion, selection, request); }
      catch (e) { setMessages(previous => [...previous, message('user', request), message('assistant', errorText(e))]); setDraft(''); return; }
    }
    if (!localPlan && !selection && /(이 칸|이 부분|여기만|선택한)/.test(request)) { setMessages(previous => [...previous, message('user', request), message('assistant', '미리보기에서 수정할 셀이나 행을 먼저 선택해 주세요.')]); return; }
    followConversation.current = true;
    locked.current = true; const run = ++operation.current;
    setBusy(localPlan?'선택한 변경을 적용하고 있어요':'Gemini가 두 파일과 요청을 확인하고 있어요'); setError(''); setResultNotice('');
    setMessages(previous => [...previous, message('user', request)]); setDraft(''); setShowFiles(false);
    const task = createRequestScope();
    controller.current = task.controller; pendingRequest.current = request;
    try {
      const history = parent && parent.id !== baseVersion?.id ? parent.history : activeHistory;
      let prompt=conversationPrompt(request,history);
      let workingTarget=parent?.template||target;
      let editingParent:ResultVersion|undefined=parent;
      let editingSelection=selection;
      const progress=(text:string)=>{if(operation.current===run&&!task.controller.signal.aborted)setBusy(text);};
      let context=prepared||(prepare?await task.run(()=>prepare(source,workingTarget,sheets[0],sheets[1],edit?DEFAULT_CONVERSION_MESSAGE:prompt,progress,task.controller.signal)):undefined);
      if(operation.current!==run)return;
      if(context)setPrepared(context);
      const document=context?.document||sourceState.document;
      if(!document)throw new Error(sourceState.error||'원본에서 옮길 데이터를 찾지 못했습니다. 원본 시트를 확인해 주세요.');
      if(!document.table.rows.length)throw new Error('원본 시트에 옮길 데이터가 없습니다.');
      let base=(parent && parent.id !== baseVersion?.id ? parent.plan : plan)||parent?.plan||context?.plan||createDocumentPlan(workingTarget,document,sheets[1]);
      if(context)context={...context,plan:base,targetAtlas:workbookAtlas(workingTarget,sheets[1])};
      let decision:import('./editingTypes').EditDecision|undefined;
      let dataRequest=request;
      if(edit&&!localPlan&&request!==DEFAULT_CONVERSION_MESSAGE){
        setBusy('Gemini가 원하는 내용과 서식 변경을 정리하고 있어요');
        decision=await task.run(()=>edit({request,plan:base,table:document.table,target:workingTarget,version:parent,selection,history,signal:task.controller.signal}));
        if(operation.current!==run)return;
        if(decision.questions.length)throw new StructureQuestions(decision.questions);
        if(decision.layout?.length){
          setBusy('요청한 구조로 양식 사본을 편집하고 입력 위치를 다시 확인하고 있어요');
          const layout=decision.layout;
          workingTarget=await task.run(()=>editWorkbookLayout(workingTarget,sheets[1],layout));
          if(operation.current!==run)return;
          const revised=prepare?await task.run(()=>prepare(source,workingTarget,sheets[0],sheets[1],prompt,progress,task.controller.signal)):undefined;
          if(operation.current!==run)return;
          base=rebaseLayoutPlan(base,revised?.plan||createDocumentPlan(workingTarget,document,sheets[1]),layout);
          if(revised)context={...revised,plan:base};
          else if(context)context={...context,plan:base,targetAtlas:workbookAtlas(workingTarget,sheets[1])};
          const moved=await task.run(()=>moveEditingVersion(parent,selection,base,layout));
          editingParent=moved.version;editingSelection=moved.selection;
          if(operation.current!==run)return;
        }
        dataRequest=decision.dataRequest;
        if(!dataRequest&&parent&&!decision.layout?.length){localPlan=applyEditDecision(base,decision,editingParent,editingSelection);decision=undefined;}
        else {dataRequest=dataRequest||DEFAULT_CONVERSION_MESSAGE;prompt=conversationPrompt(dataRequest,history);}
      }
      prompt = (prompt + conditionContext(base, document.table)).slice(0, 5700);
      let current=base,feedback='';
      for(let attempt=0;attempt<=2;attempt++){
        setBusy(localPlan?'변경한 값으로 엑셀을 다시 작성하고 있어요':attempt?`검사에서 발견한 항목을 Gemini가 수정하고 있어요 (${attempt}/2)`:'Gemini가 요청에 맞는 작성 규칙을 정하고 있어요');
        const attemptPrompt=prompt+feedback,attemptPlan=current;
        const response=localPlan ? {plan: localPlan} : await task.run(()=>context&&analyzePrepared?analyzePrepared(attemptPrompt,attemptPlan,context,workingTarget):analyze(attemptPrompt,attemptPlan,document.table,workingTarget));
        if(operation.current!==run)return;
        const parsed=planSchema.parse(response.plan);
        let next=localPlan ? parsed : parent ? preserveUnrequestedRules(parsed,base,dataRequest) : parsed;
        next.edits=localPlan?next.edits:base.edits; next.formulaEdits=localPlan?next.formulaEdits:base.formulaEdits; next.macroEdits=localPlan?next.macroEdits:base.macroEdits;
        if(next.targetId!==target.id||next.sheetName!==sheets[1])throw new Error('다른 양식으로 분석되었습니다. 다시 요청해 주세요.');
        const questions=conversationQuestions(next,document.table);
        if(questions.length){if(workingTarget===(parent?.template||target))setPlan(next);throw new StructureQuestions(questions);}
        let problems=localPlan ? [] : planProblems(next,document.table,base,request+'\n'+dataRequest);
        if(!problems.length&&decision){
          // Resolve first-request value edits against the actual mapped records too.
          if(!editingParent&&decision.values.length){
            const preview=await task.run(()=>convertWorkbook(workingTarget,next,document.table,progress,task.controller.signal));
            if(operation.current!==run)return;
            editingParent={id:'pending',number:0,createdAt:Date.now(),plan:next,history:[],result:preview,request,reused:false,verification:{records:0,cells:0,identityChecked:false,daysChecked:0,preservationChecked:false,unverifiedFormulas:true,missingInputs:0,repairs:0}};
          }
          next=applyEditDecision(next,decision,editingParent,editingSelection);
        }
        let result:ConversionResult|undefined,verification:VerificationSummary|undefined;
        if(!problems.length){
          setBusy('엑셀을 작성하고 사람별 값과 양식 보존 상태를 검사하고 있어요');
          try{
            result=await task.run(()=>convertWorkbook(workingTarget,next,document.table,progress,task.controller.signal));
            if(operation.current!==run)return;
            problems=result.issues.filter(issue=>issue.level==='error');
            if(!problems.length&&result.outputs.length){const written=result;const checked=await task.run(()=>verifyConversion(workingTarget,next,document.table,written));result.issues.push(...checked.issues);problems=checked.issues.filter(issue=>issue.level==='error');verification={...checked.summary,repairs:attempt};}
            if(!result.outputs.length&&!problems.length)problems=[{level:'error',code:'empty-output',message:'완성 파일을 만들지 못했습니다.'}];
          }catch(e){if(operation.current!==run)return;if(task.controller.signal.aborted)throw e;problems=[{level:'error',code:'layout-or-value',message:errorText(e)}];}
        }
        if(operation.current!==run)return;
        if(problems.length){if(localPlan||attempt===2)throw new Error(problems.slice(0,3).map(p=>p.message).join('\n'));current=next;feedback=('\n'+repairPrompt(problems,attempt+1)).slice(0,Math.max(0,6000-prompt.length));continue;}
        if(!result||!verification)throw new Error('결과 검사를 완료하지 못했습니다.');
        setPlan(next);
        if(context)setPrepared({...context,plan:next});
        const version:ResultVersion={id:crypto.randomUUID(),number:versions.length+1,parentId:parent?.id,createdAt:Date.now(),plan:clonePlan(next),history:[...history,message('user',request)],result,request,verification,reused:!!context?.reused,...(workingTarget!==target?{template:workingTarget}:{})};
        setVersions(previous=>[...previous,version]);setPreviewId(version.id);setBaseId(version.id);setActiveHistory(version.history);setSelection(undefined);setFocusLocation(undefined);setResultNotice(`결과 ${version.number} 준비 완료`);
        if(context)rememberStructure(ownerId,context,edit?context.plan:next);
        setMessages(previous=>[...previous,{...message('assistant',`미리보기에 결과 ${version.number}을 반영했어요. 원하는 내용이나 서식을 이어서 말씀해 주세요.\n${next.summary.slice(0,3).join('\n')}`),versionId:version.id}]);
        break;
      }
    }catch(e){if(operation.current===run){if(e instanceof StructureQuestions){setActiveHistory(previous=>[...previous,message('user',request),message('assistant',e.questions.join('\n'))]);setMessages(previous=>[...previous,message('assistant',`이 내용만 알려주시면 이어서 만들게요.\n${e.questions.slice(0,6).map(q=>`• ${q}`).join('\n')}`)]);composer.current?.focus();}else{setError(errorText(e));setDraft(request);}}}
    finally {task.dispose();if(operation.current===run){locked.current=false;setBusy('');pendingRequest.current='';controller.current=undefined;}}
  };
  const stop = () => { operation.current++; controller.current?.abort(); controller.current=undefined; locked.current = false; setBusy(''); if(pendingRequest.current)setDraft(pendingRequest.current);pendingRequest.current='';setMessages(previous => [...previous, message('assistant', '요청 처리를 중단했습니다. 작성한 요청과 이전 결과는 유지됩니다. 내용을 고쳐 다시 요청할 수 있어요.')]);composer.current?.focus(); };
  const download = async (version: ResultVersion) => {
    if (version.result.issues.some(issue => issue.level === 'warning') && !accepted.includes(version.id)) return;
    try {
      if (version.result.outputs.length === 1) { const out = version.result.outputs[0]; saveAs(new Blob([out.bytes], { type: workbookMime(out.name) }), out.name); }
      else { const zip = new JSZip(); version.result.outputs.forEach(out => zip.file(out.name, out.bytes)); saveAs(await zip.generateAsync({ type: 'blob' }), `변환결과_${version.number}.zip`); }
    } catch { setError('다운로드를 시작하지 못했습니다. 다운로드 버튼을 다시 눌러 주세요.'); }
  };
  const preview = versions.find(version => version.id === previewId);
  const latest = versions[versions.length - 1];
  const baseVersion = versions.find(version => version.id === baseId) || latest;
  const requestVersion = selection && selection.revision === preview?.id ? preview : baseVersion;
  const warningCount = preview?.result.issues.filter(i=>i.level==='warning').length || 0;
  const openIssues = (version:ResultVersion) => {setPreviewId(version.id);setSelection(undefined);setFocusLocation(undefined);setReviewRequest({versionId:version.id,nonce:Date.now()});setMobilePane('preview');};
  const parentVersion = versions.find(version => version.id === preview?.parentId);
  const changes = useMemo(() => preview ? compareVersions(preview, parentVersion) : [], [preview, parentVersion]);
  const jump = (location: CellLocation, versionId?: string) => { if (versionId) setPreviewId(versionId); setSelection(undefined); setFocusLocation({ ...location, nonce: Date.now() }); };
  const branch = (version: ResultVersion) => { setBaseId(version.id); setPlan(clonePlan(version.plan)); setActiveHistory(version.history); setSelection(undefined); setFocusLocation(undefined); setMessages(previous => [...previous, message('assistant', `결과 ${version.number}을 기준으로 수정을 이어갑니다. 이후 결과도 보관되어 있어요.`)]); };
  const applyEdit = (value: import('./types').Scalar, kind: 'text' | 'number' | 'date' | 'blank') => { if (!preview || !selection) return; try { void send(editSelectedCell(preview, selection, value, kind), `선택한 ${selection.sheet}!${selection.address} 직접 수정`,preview); } catch(e) { setError(errorText(e)); } };
  const ready = !!source && !!target;
  const fileCount = files.filter(Boolean).length;
  const currentStep = versions.length ? 2 : ready ? 1 : 0;
  const starters = [
    { title: '양식에 맞게 옮기기', text: DEFAULT_CONVERSION_MESSAGE },
    { title: '이름순으로 정렬하기', text: '원본 내용은 그대로 옮기고, 이름순으로 정렬해줘.' },
    { title: '서명란 비워두기', text: '첫 번째 파일을 두 번째 양식으로 바꾸고 서명란은 비워줘.' },
  ];
  const renderResult = (version: ResultVersion) => {
        const warnings = version.result.issues.filter(issue => issue.level === 'warning');
        const excluded = version.result.excluded.filter(e=>!sourceState.document?.table.skipped.some(s=>s.origin===e.origin&&s.reason===e.reason)).length;
        const downloadable = !warnings.length || accepted.includes(version.id);
        return <article className="ecc-result" key={version.id}><div className="ecc-result-heading"><span className="ecc-result-icon"><FileSpreadsheet size={24}/></span><div><strong>결과 {version.number} <span>{version.number === versions.length ? '최신' : ''}</span></strong><p>{version.result.outputs.length === 1 ? version.result.outputs[0].name : `엑셀 ${version.result.outputs.length}개 · ZIP으로 다운로드`}</p><small>{version.result.inputCount}건 중 {version.result.outputCount}건 작성{excluded ? ` · ${excluded}건 제외` : ''}</small></div></div><p className="ecc-result-request">{version.request}</p><div className="ecc-verification" aria-label="결과 검사"><span>{version.verification.identityChecked ? `인원 ${version.verification.records}건 개별 대조` : `작성 ${version.verification.records}건`}</span><span>입력 값 {version.verification.cells}칸 대조</span><span>{version.verification.preservationChecked ? '병합·양식 보존 확인' : '양식 확인 필요'}</span>{version.verification.daysChecked > 0 && <span>일별 공수 {version.verification.daysChecked}칸 대조</span>}{version.result.outputs.some(o => o.formulaCalculation?.calculated) && <span>수식 {version.result.outputs.reduce((n, o) => n + (o.formulaCalculation?.calculated || 0), 0).toLocaleString()}개 계산</span>}{version.verification.unverifiedFormulas && <span>일부 수식은 Excel 재계산 필요</span>}{version.verification.repairs > 0 && <span>자동 보정 {version.verification.repairs}회</span>}{version.reused && <span>검증한 양식 재사용</span>}</div><div className="ecc-result-actions"><button onClick={() => {setPreviewId(version.id);setSelection(undefined);setFocusLocation(undefined);setMobilePane('preview');setResultNotice('');}} aria-pressed={previewId === version.id}><Eye size={16}/>미리보기</button><button className="ecc-download" disabled={!downloadable} onClick={() => void download(version)}><ArrowDownToLine size={17}/>{version.result.outputs.length === 1 ? '엑셀 다운로드' : '엑셀 모두 다운로드'}</button></div>{!!warnings.length && <button className="ecc-warning-summary" onClick={()=>openIssues(version)}><CircleHelp size={14}/>{downloadable?'확인한 내용':'다운로드 전 확인할 내용'} {warnings.length}개<ChevronRight size={14}/></button>}</article>;
  };
  return <div className="ecc-page">
    <header className="ecc-topbar">
      <div className="ecc-brand"><span className="ecc-app-icon"><FileSpreadsheet size={21}/></span><strong>엑셀 양식 변환</strong><span className="ecc-beta">AI 도구</span></div>
      <div className="ecc-topbar-actions"><span className={`ecc-model ${ai?.configured ? 'connected' : ''}`}><i/>{ai?.configured ? 'AI 설정됨' : aiError ? 'AI 연결 확인 필요' : ai ? 'AI 설정 필요' : 'AI 연결 확인 중'}</span><button disabled={!!busy} onClick={() => guardReset(() => install([undefined, undefined], false))}><Plus size={16}/>새 대화</button></div>
    </header>
    <div className="ecc-content">
      <SessionControls name={workName} onName={setWorkName} keep={keepWork} onKeep={setKeepWork} retention={retentionDays} onRetention={setRetentionDays} status={saveState} failed={saveFailure} onRetry={()=>setSaveRetry(n=>n+1)} works={savedWorks} busy={!!busy} hasSavedCopy={savedWorks.some(w=>w.id===sessionId)} onOpen={id=>guardReset(()=>void restore(id))} onDelete={()=>setPendingReset({kind:'delete',action:()=>{setKeepWork(false);saveEpoch.current++;void saveQueue.current.catch(()=>{}).then(()=>removeChatSession(ownerId,sessionId)).then(()=>listChatSessions(ownerId)).then(items=>{setSavedWorks(items);setSavedSnapshot(undefined);setSaveFailure(false);}).catch(e=>setError(errorText(e)));}})}/>
      {pendingReset && <dialog ref={resetDialog} open={typeof HTMLDialogElement.prototype.showModal !== 'function' || undefined} className="ecc-reset-dialog" onCancel={event=>{if(savingReset)event.preventDefault();else setPendingReset(undefined);}} aria-label="작업 변경 확인"><strong>{pendingReset.kind==='delete'?'이 작업의 보관본을 지울까요?':'현재 작업을 보관하고 이동할까요?'}</strong><p>{pendingReset.kind==='delete'?'이 브라우저에 저장한 사본만 지웁니다. 지금 열어 둔 작업과 다운로드한 파일은 유지됩니다.':'아직 보관하지 않은 첨부 파일·대화·작성 중인 요청이 있습니다. 보관하면 나중에 이어갈 수 있어요.'}</p>{saveFailure&&pendingReset.kind==='discard'&&<p role="alert">{saveState}</p>}<div className="ecc-reset-actions"><button autoFocus disabled={savingReset} onClick={()=>setPendingReset(undefined)}>계속 작업하기</button><button disabled={savingReset} onClick={()=>{const action=pendingReset.action;setPendingReset(undefined);action();}}>{pendingReset.kind==='delete'?'보관본 지우기':'보관하지 않고 계속'}</button>{pendingReset.kind==='discard'&&<button className="ecc-primary" disabled={savingReset} onClick={()=>void saveThenContinue()}>{savingReset?'보관 중…':'보관하고 계속'}</button>}</div></dialog>}
      <div className="ecc-view-controls"><div className="ecc-mobile-tabs"><button aria-pressed={mobilePane==='chat'} onClick={()=>setMobilePane('chat')}>대화</button><button aria-pressed={mobilePane==='preview'} onClick={()=>{setMobilePane('preview');setResultNotice('');}}>미리보기</button></div><label>대화 영역 너비<input aria-label="대화 영역 너비" type="range" min={28} max={48} value={paneWidth} onChange={event=>setPaneWidth(Number(event.target.value))}/></label></div>
      <section className={`ecc-intro ${messages.length ? 'compact' : ''}`}>
        <div><span className="ecc-kicker"><Sparkles size={14}/>대화로 완성하는 엑셀</span><h1>대화하며 수정하고,<br className="ecc-mobile-break"/> <em>결과는 바로 확인하세요.</em></h1><p>원본과 양식을 올린 뒤, 미리보기를 보며 원하는 내용을 이어서 요청하세요.</p></div>
        <span className="ecc-intro-note"><ShieldCheck size={17}/>원본 파일은 안전하게 유지돼요</span>
      </section>
      <ol className="ecc-steps" aria-label="변환 진행 단계">{['파일 준비', '변환 요청', '결과 확인'].map((label, index) => <li key={label} className={index < currentStep ? 'complete' : index === currentStep ? 'active' : ''} aria-current={index === currentStep ? 'step' : undefined}><span>{index < currentStep ? <Check size={14}/> : `0${index + 1}`}</span><strong>{label}</strong><small>{index === 0 ? `${fileCount}/2 첨부` : index === 1 ? '말로 간편하게' : '미리보기 · 다운로드'}</small>{index < 2 && <ChevronRight size={16} className="ecc-step-arrow"/>}</li>)}</ol>
      <div className="ecc-layout ecc-studio" data-mobile-pane={mobilePane} style={{'--ecc-chat-width': paneWidth+'%'} as React.CSSProperties}><div className="ecc-workspace">
      <div className="ecc-pane-heading"><div><MessageSquare size={18}/><h2>AI와 함께 편집</h2></div><span>요청을 이어서 반영해요</span></div>
      <div className="ecc-chat-scroll" ref={conversation} onScroll={event => { const el = event.currentTarget; followConversation.current = el.scrollHeight - el.scrollTop - el.clientHeight < 90; }}>
      <section className="ecc-attachments" aria-label="첨부파일">
        <div className="ecc-section-label"><div><h2><Paperclip size={15}/>{ready ? '원본과 양식 준비 완료' : '변환할 파일을 준비해 주세요'}</h2>{(!ready || showFiles) && <p>데이터 원본과 내용을 채울 양식을 첨부하세요.</p>}</div>{ready ? <button className="ecc-files-toggle" onClick={() => setShowFiles(!showFiles)} aria-expanded={showFiles} aria-controls="ecc-attached-files">파일 {showFiles ? '접기' : '보기'}<ChevronDown size={14}/></button> : <span className="ecc-count">{fileCount}/2 첨부</span>}</div>
        <div id="ecc-attached-files" hidden={ready && !showFiles}>
        <div className="ecc-files">{([0, 1] as const).map(slot => <Attachment key={slot} file={files[slot]} slot={slot} busy={!!busy} sheet={sheets[slot]} onSheet={name => guardReset(() => { clearConversation(); setSheets(previous => slot === 0 ? [name, previous[1]] : [previous[0], name]); })} onUpload={selected => upload(selected, slot)} onRemove={() => { const next: Pair = [...files]; next[slot] = undefined; guardReset(() => install(next)); }}/>)}</div>
        <input ref={attachment} className="ecc-hidden-input" aria-label="엑셀 파일 두 개 선택" type="file" accept=".xlsx,.xlsm" multiple disabled={!!busy} onChange={event => { void upload(event.target.files); event.target.value = ''; }}/>
        <div className="ecc-attachment-hint"><span>.xlsx · .xlsm · 최대 20MB</span><div>{ready ? <button disabled={!!busy} onClick={() => { if (source?.hasExternalLinks) { setError('외부 연결이 있는 데이터 원본은 완성할 양식으로 바꿀 수 없습니다. Excel에서 외부 연결을 제거한 사본을 양식으로 첨부해 주세요.'); return; } guardReset(() => install([target, source])); }}><ArrowLeftRight size={14}/>순서 바꾸기</button> : <button disabled={!!busy} onClick={() => attachment.current?.click()}><Paperclip size={14}/>두 파일 한 번에 선택</button>}</div></div>
        {source?.hasExternalLinks && <p className="ecc-composer-description">외부 연결은 실행하지 않고 원본 파일에 저장된 값만 읽어요. 최신 값이 필요하면 Excel에서 갱신한 뒤 저장해 주세요.</p>}
        </div>
      </section>
      {sourceState.totals && (!prepare || prepared) && <p className="ecc-source-summary"><Check size={15}/>원본 {sourceState.totals.people}건{sourceState.totals.manDays !== undefined && ` · ${sourceState.totals.manDays}공수`}{sourceState.totals.amount !== undefined && ` · ${sourceState.totals.amount.toLocaleString()}원`}</p>}
      {!messages.length && <div className="ecc-chat-welcome"><span><Sparkles size={18}/></span><div><strong>원하는 결과를 함께 만들어 볼까요?</strong><p>먼저 양식에 맞춰 옮긴 뒤, “이름순으로 정렬해줘”처럼 수정을 이어갈 수 있어요.</p></div></div>}
      <section className="ecc-conversation" aria-label="변환 대화" aria-live="polite">{messages.map(turn => {
        const resultVersion = turn.versionId ? versions.find(version => version.id === turn.versionId) : undefined;
        return <React.Fragment key={turn.id}><div className={`ecc-message ${turn.role}`}><span className="ecc-speaker">{turn.role === 'user' ? '나' : <><Sparkles size={14}/>엑셀 도우미</>}</span><p>{turn.text}</p></div>{resultVersion && renderResult(resultVersion)}</React.Fragment>;
      })}</section>

      {error && <div className="ecc-error" role="alert"><strong>요청을 완료하지 못했어요</strong><p>{error}</p><span>마지막 완성 결과는 유지됩니다. 내용을 고쳐 다시 요청할 수 있어요.</span>{ready&&draft.trim()&&<button className="ecc-retry" disabled={!!busy} onClick={()=>void send()}>요청 다시 시도</button>}<button aria-label="오류 안내 닫기" onClick={() => setError('')}><X size={16}/></button></div>}
      {busy && <div className="ecc-progress" role="status"><Loader2 size={18}/><span>{busy}{slowRequest&&<small className="ecc-progress-detail">평소보다 오래 걸리고 있어요. 중단해도 작성한 요청과 이전 결과는 유지됩니다.</small>}</span><button onClick={stop}>중단</button></div>}
      </div>
      {resultNotice&&<div className="ecc-mobile-result" role="status"><span><Check size={15}/>{resultNotice}</span><button onClick={()=>{setMobilePane('preview');setResultNotice('');requestAnimationFrame(()=>document.getElementById('ecc-preview')?.scrollIntoView({block:'start'}));}}>결과 보기<ArrowRight size={14}/></button></div>}
      <form className="ecc-composer" onSubmit={event => { event.preventDefault(); void send(); }}>
        <div className="ecc-composer-heading"><label htmlFor="excel-chat-request">{messages.length ? '이어서 요청하기' : '어떻게 바꿔드릴까요?'}</label>{!messages.length && <span className="ecc-optional">선택 입력</span>}</div>
        <p className="ecc-composer-description">{requestVersion ? `수정 기준: 결과 ${requestVersion.number}${selection ? " · 선택한 "+selection.address+(selection.scope==="row"?" 행":" 셀") : ""}. 이전 결과도 유지됩니다.` : messages.length ? '추가로 바꿀 내용이나 질문에 대한 답을 알려주세요.' : '비워 두면 원본 내용을 양식에 맞춰 옮겨요.'}</p>
        {baseVersion && <div className="ecc-conditions" aria-label="적용 중인 조건">{activeConditions(requestVersion!.plan, sourceState.document?.table).map(condition => <span key={condition.id}>{condition.label}{condition.removable && <button type="button" disabled={!!busy} aria-label={condition.label+' 조건 해제'} onClick={() => { setSelection(undefined); void send(removeCondition(requestVersion!.plan,condition.id), condition.label+' 조건 해제',requestVersion); }}>×</button>}</span>)}</div>}
        {selection && <div className="ecc-selection-chip">선택: {selection.sheet}!{selection.address}{selection.scope === 'row' ? ' 행' : ''}<button type="button" onClick={() => setSelection(undefined)}>전체에 요청</button></div>}
        {!messages.length && <div className="ecc-starters" aria-label="추천 요청">{starters.map(({ title, text }) => <button type="button" key={title} disabled={!!busy} aria-pressed={draft === text} title={text} onClick={() => { setDraft(text); composer.current?.focus(); }}><Sparkles size={12}/>{title}</button>)}</div>}
        {edit&&!!versions.length&&<div className="ecc-edit-suggestions" aria-label="편집 요청 예시">{['제목을 더 크게','표를 깔끔한 파란색으로','금액에 천 단위 쉼표와 원 표시','금액 수식을 원 단위 반올림으로 바꿔줘',...(target?.hasMacros?['정산 금액을 다시 계산하는 매크로를 추가해줘']:[])].map(text=><button type="button" key={text} disabled={!!busy} onClick={()=>{setDraft(text);composer.current?.focus();}}>{text}</button>)}</div>}
        <div className="ecc-input-wrap"><textarea id="excel-chat-request" ref={composer} maxLength={2000} rows={3} value={draft} disabled={!!busy} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); } }} placeholder={messages.length ? selection ? '예: 이 칸을 연노란색으로 강조해줘. 내용을 서울로 바꿔줘.' : '예: 제목을 크게 하고 표를 깔끔하게. 이름은 가나다순으로.' : '예: 원본을 새 양식에 옮기고 제목과 표를 보기 좋게 정리해줘.'}/><div className="ecc-input-meta"><span>Ctrl / ⌘ + Enter로 요청</span><span>{draft.length.toLocaleString()} / 2,000</span></div></div>
        <div className="ecc-composer-bottom"><span id="ecc-send-hint" className={ready ? 'ready' : ''}>{ready ? <><Check size={15}/>{latest ? '완성되면 미리보기에 반영돼요' : '파일 준비 완료! 이제 변환할 수 있어요.'}</> : <><Paperclip size={15}/>{source ? '완성할 양식을 첨부하면 시작할 수 있어요.' : target ? '데이터 원본을 첨부하면 시작할 수 있어요.' : '원본과 완성할 양식을 먼저 첨부해 주세요.'}</>}</span><button className="ecc-send" type="submit" aria-describedby="ecc-send-hint" disabled={!ready || !!busy || (messages.length > 0 && !draft.trim())}>{busy ? <Loader2 size={17}/> : <Sparkles size={17}/>} {versions.length ? '수정 요청' : '변환 요청'}<ArrowRight size={16}/></button></div>
      </form>
      </div>
      <aside id="ecc-preview" className="ecc-preview-pane" aria-label="엑셀 실시간 미리보기">
        <div className="ecc-pane-heading"><div><Eye size={18}/><h2>{preview ? `결과 ${preview.number} 미리보기` : '엑셀 미리보기'}</h2></div>{versions.length > 0 ? <select aria-label="미리볼 결과 버전" value={previewId} onChange={event => { setPreviewId(event.target.value); setSelection(undefined); setFocusLocation(undefined); }}>{versions.map(version => <option key={version.id} value={version.id}>결과 {version.number}{version.id === latest?.id ? ' · 최신' : ''}</option>)}</select> : <span>원본 · 양식 · 결과</span>}</div>
        <div className="ecc-preview-status" aria-live="polite"><span className={busy ? 'working' : ''}/>{busy ? preview ? '수정 중이에요. 완성될 때까지 이전 결과를 보여드려요.' : '작업 중이에요. 완성되면 결과를 여기에 보여드려요.' : preview ? '검사를 마친 결과예요. 대화로 수정을 이어가세요.' : fileCount ? '첨부한 파일을 먼저 살펴보고 변환을 요청하세요.' : '파일을 첨부하면 이곳에 미리보기가 나타나요.'}</div>
        {preview && <div className={'ecc-result-toolbar '+(preview.id!==requestVersion?.id?'reviewing':'')}><div className="ecc-result-context"><strong>{preview.id===requestVersion?.id?selection?'선택한 부분은 이 결과를 기준으로 수정합니다':'이 결과를 기준으로 수정합니다':`결과 ${preview.number} 검토 중`}</strong>{preview.id!==requestVersion?.id&&<span>수정 요청은 {requestVersion?.id===latest?.id?'최신 ':''}결과 {requestVersion?.number}에 적용됩니다.</span>}{preview.parentId&&<small>결과 {parentVersion?.number}에서 이어서 작성</small>}</div><div className="ecc-result-toolbar-actions">{preview.id!==baseVersion?.id&&<button disabled={!!busy} onClick={()=>branch(preview)}>이 결과부터 수정</button>}{latest&&preview.id!==latest.id&&<button onClick={()=>{setPreviewId(latest.id);setSelection(undefined);setFocusLocation(undefined);}}>최신 결과 보기</button>}<button className="ecc-download" disabled={!!warningCount&&!accepted.includes(preview.id)} onClick={()=>void download(preview)}><ArrowDownToLine size={14}/>보고 있는 결과 다운로드</button></div></div>}
        {preview&&<button className="ecc-back-to-chat" onClick={()=>{setMobilePane('chat');requestAnimationFrame(()=>composer.current?.focus());}}><MessageSquare size={14}/>대화로 수정하기<ArrowRight size={14}/></button>}
        {preview&&warningCount>0&&<button className="ecc-warning-summary" onClick={()=>openIssues(preview)}><CircleHelp size={15}/>{accepted.includes(preview.id)?'확인 완료':'다운로드 전 확인'} · {warningCount}개 내용 살펴보기<ChevronRight size={14}/></button>}
        {fileCount > 0 ? <WorkbookPreview source={source} target={target} outputs={preview?.result.outputs} revision={preview?.id} initialZoom="fit" selection={selection} onSelect={setSelection} focusLocation={focusLocation} highlights={changes.filter(c => c.kind === 'changed' || c.kind === 'added').map(c => c.location)}/> : <div className="ecc-preview-empty"><div className="ecc-empty-illustration" aria-hidden="true"><FileSpreadsheet size={38}/><MessageSquare size={20}/></div><h3>미리보면서, 한 번 더 다듬으세요</h3><p>대화와 엑셀을 한 화면에서.<br/>추가 요청이 완성될 때마다 새 결과로 업데이트돼요.</p></div>}
        {preview && source && sourceState.document && <ResultReview key={preview.id} version={preview} previous={parentVersion} table={sourceState.document.table} source={source} selection={selection} busy={!!busy} accepted={accepted.includes(preview.id)} onAccept={checked=>setAccepted(previous=>checked?[...new Set([...previous,preview.id])]:previous.filter(id=>id!==preview.id))} issueRequest={reviewRequest?.versionId===preview.id?reviewRequest.nonce:undefined} onSelect={setSelection} onJump={jump} onEdit={applyEdit}/>}
        <details className="ecc-preview-examples" open={!fileCount}><summary><FolderOpen size={15}/>예시 파일로 시작하기<ChevronDown size={14}/></summary>
        <section className="ecc-example-card"><div className="ecc-aside-heading"><FolderOpen size={17}/><h2>파일 없이 먼저 체험하기</h2></div><p>가상 데이터가 담긴 예시를 준비했어요.</p>{([{ kind: 'labor', title: '노임명세서', detail: '인원 · 공수 · 금액 옮기기', icon: FileSpreadsheet }, { kind: 'delegation', title: '위임장', detail: '개인별 양식으로 나누기', icon: FileCheck2 }, { kind: 'variant', title: '서로 다른 구조의 양식', detail: '열 순서와 줄 수가 달라도', icon: LayoutTemplate }] as const).map(({ kind, title, detail, icon: Icon }) => <button key={kind} disabled={!!busy || !!fileCount || !!messages.length} onClick={() => void loadExample(kind)} aria-label={`${title} 예시 불러오기`}><span className="ecc-example-icon"><Icon size={18}/></span><span><strong>{title}</strong><small>{detail}</small></span><ChevronRight size={15}/></button>)}{!!fileCount && <small className="ecc-example-note">새 대화를 시작하면 다른 예시를 체험할 수 있어요.</small>}</section>
        </details>
      </aside></div>
      <footer className="ecc-footer"><span className={`ecc-model ${ai?.configured ? 'connected' : ''}`}><i/>{ai?.configured ? ai.model.replace(/^gemini-/, 'Gemini ') : aiError ? 'Gemini 연결 확인 필요' : ai ? 'Gemini 설정 필요' : 'Gemini 연결 확인 중'}</span><a href="/settings/ai#excel-conversion-ai">AI 설정<ChevronRight size={12}/></a><span>이 기기에 작업 보관을 켜면 다시 이어갈 수 있어요. 제출할 파일은 다운로드해 주세요.</span></footer>
      <details className="ecc-help"><summary><CircleHelp size={15}/>처음 사용하시나요?<ChevronDown size={14}/></summary><div className="ecc-help-content"><p>원본과 받을 양식을 각각 첨부한 뒤 변환을 요청하세요. 한 번에 두 파일을 선택하면 첫 번째는 원본, 두 번째는 완성할 양식으로 들어갑니다. 순서가 반대라면 “순서 바꾸기”를 누르세요. 여러 시트가 있으면 사용할 시트를 선택할 수 있습니다.</p><p>결과를 미리 보고 엑셀로 내려받으세요. 수정할 내용은 같은 대화에 이어서 입력하면 됩니다. 검증한 양식 규칙은 이 브라우저에 30일간 기억합니다.</p><button disabled={!!busy} onClick={() => { clearStructureMemory(ownerId); setMessages(previous => [...previous, message('assistant', '이 브라우저에 기억한 양식 규칙을 지웠습니다.')]); }}>기억한 양식 지우기</button></div></details>
    </div>
  </div>;
}

function Attachment({ file, slot, busy, sheet, onSheet, onUpload, onRemove }: { file?: WorkbookFile; slot: 0 | 1; busy: boolean; sheet: string; onSheet: (name: string) => void; onUpload: (files: FileList | File[] | null) => void; onRemove: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const title = slot === 0 ? '데이터 원본' : '완성할 양식';
  return <div className={`ecc-file ${slot === 1 ? 'target' : 'source'} ${file ? 'attached' : ''} ${dragging && !busy ? 'dragging' : ''}`} role="group" aria-label={title} onDragOver={event => { event.preventDefault(); if (!busy) setDragging(true); }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }} onDrop={event => { event.preventDefault(); setDragging(false); if (!busy) onUpload(Array.from(event.dataTransfer.files)); }}>
    <div className="ecc-file-role"><b>{slot === 0 ? 'A' : 'B'}</b><strong>{title}</strong>{file ? <button disabled={busy} onClick={onRemove} aria-label={`${title} 제거`}><X size={15}/></button> : <span>{slot === 0 ? '가져올 내용' : '받을 형식'}</span>}</div>
    <button className="ecc-file-name" disabled={busy} onClick={() => input.current?.click()} aria-label={`${title} ${file ? '바꾸기' : '첨부'}`}><span className="ecc-file-icon">{file ? <FileCheck2 size={25}/> : slot === 0 ? <FileSpreadsheet size={25}/> : <LayoutTemplate size={25}/>}</span><strong title={file?.name}>{file?.name || (slot === 0 ? '데이터가 담긴 엑셀' : '완성하고 싶은 엑셀 양식')}</strong>{!file && <><span className="ecc-file-description">여기로 파일을 끌어 놓거나</span><span className="ecc-upload-label"><Upload size={13}/>파일 선택</span></>}{file && <span className="ecc-file-loaded"><Check size={12}/>첨부 완료 · 클릭해서 바꾸기</span>}</button>
    <input className="ecc-hidden-input" ref={input} type="file" aria-label={`${title} 파일 선택`} accept=".xlsx,.xlsm" disabled={busy} onChange={event => { onUpload(event.target.files); event.target.value = ''; }}/>
    {file && <div className="ecc-file-meta"><span>{Math.max(1, Math.round(file.bytes.byteLength / 1024))} KB</span><span>{file.sheets.length}개 시트</span></div>}
    {file && file.sheets.length > 1 && <label className="ecc-sheet">사용할 시트<select disabled={busy} aria-label={`${title} 시트`} value={sheet} onChange={event => onSheet(event.target.value)}>{file.sheets.map(value => <option key={value.name}>{value.name}</option>)}</select></label>}
  </div>;
}
