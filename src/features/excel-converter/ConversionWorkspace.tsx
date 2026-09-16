import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, BookOpen, CheckCircle2, ChevronRight, Download, FileSpreadsheet, Files, FolderOpen, History, Loader2, Plus, Save, Settings2, ShieldCheck, Sparkles, X } from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { CellTrace, ConversionPlan, ConversionResult, DataTable, JoinSpec, planSchema, WorkbookFile, blankMapping } from './types';
import { workbookMime, columnName, describeTemplateChanges, extractTable, readWorkbook, templateSignature } from './workbook';
import { applyJoins, createPlan, describeRules, validatePlanReferences } from './planning';
import { convertWorkbook } from './writer';
import { numberValue, strictDate } from './transform';
import { deleteWork, Library, listWorks, loadLibrary, SavedWork, saveLibrary, saveWork, saveVersion, listVersions, WorkVersion } from './storage';
import SheetPreview from './SheetPreview';
import { MappingEditor, RulesEditor } from './MappingEditor';
import './conversion.css';
export interface WorkspaceProps {
    ownerId: string;
    analyze: (prompt: string, plan: ConversionPlan, table: DataTable, target: WorkbookFile, example?: WorkbookFile) => Promise<{
        plan: ConversionPlan;
        model: string;
        inputTokens: number;
        outputTokens: number;
        elapsedMs: number;
    }>;
}
const EXAMPLES = ['01_우리회사_원본.xlsx', '02_A사_양식.xlsx', '03_A사_변경양식.xlsx', '04_변경양식_정답예시.xlsx', '05_상품코드_보조자료.xlsx'];
const DEFAULT_PROMPT = '취소 주문을 제외해 주세요. 상품코드와 납기, 납품처가 같은 행의 수량과 공급가액을 합산해 주세요. 납기 순으로 정렬하고 상품코드 앞자리 0을 유지해 주세요. 배송지는 주소와 상세주소를 공백으로 합쳐 주세요.';
const initialWork = (): SavedWork => ({ id: crypto.randomUUID(), name: '새 양식 변환', updatedAt: Date.now(), expiresAt: Date.now() + 30 * 86400000, sources: [], targets: [], primarySheet: '', headerRow: 1, joins: [], plans: [], prompt: '', results: [], revision: 0, resultRevision: -1, status: 'draft', reviewNote: '' });
const initialLibrary: Library = { rules: [], dictionary: {}, retentionDays: 30, templates: [] };
const message = (error: unknown) => error instanceof Error ? error.message : '작업을 처리하지 못했습니다.';
const blob = (bytes: ArrayBuffer, name: string) => new Blob([bytes], { type: workbookMime(name) });
export default function ConversionWorkspace({ ownerId, analyze }: WorkspaceProps) {
    const [work, setWork] = useState<SavedWork>(initialWork);
    const [library, setLibrary] = useState<Library>(initialLibrary);
    const [history, setHistory] = useState<SavedWork[]>([]);
    const [versions, setVersions] = useState<WorkVersion[]>([]);
    const [versionWorkId, setVersionWorkId] = useState('');
    const [nav, setNav] = useState('convert');
    const [targetIndex, setTargetIndex] = useState(0);
    const [tab, setTab] = useState('template');
    const [previewSheet, setPreviewSheet] = useState('');
    const [outputIndex, setOutputIndex] = useState(0);
    const [busy, setBusy] = useState('');
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [saved, setSaved] = useState('');
    const [ready, setReady] = useState(false);
    const [example, setExample] = useState<WorkbookFile>();
    const [trace, setTrace] = useState<CellTrace>();
    const [proposal, setProposal] = useState<ConversionPlan>();
    const [usage, setUsage] = useState('');
    const [warningsAccepted, setWarningsAccepted] = useState<Record<string, boolean>>({});
    const [dictionaryFrom, setDictionaryFrom] = useState('');
    const [dictionaryTo, setDictionaryTo] = useState('');
    const [ruleName, setRuleName] = useState('');
    const [mappingSearch, setMappingSearch] = useState('');
    const [overrideText, setOverrideText] = useState('');
    const controller = useRef<AbortController>();
    const generation = useRef(0);
    const target = work.targets[targetIndex];
    const plan = work.plans.find(p => p.targetId === target?.id);
    const source = work.sources[0];
    const tableState = useMemo(() => { try {
        if (!source || !work.primarySheet)
            return { table: { fields: [], rows: [], warnings: [], skipped: [] } as DataTable, error: '' };
        return { table: applyJoins(extractTable(source, work.primarySheet, work.headerRow, plan?.rules.includeHidden ?? true), work.sources.slice(1), work.joins), error: '' };
    }
    catch (e) {
        return { table: { fields: [], rows: [], warnings: [], skipped: [] } as DataTable, error: message(e) };
    } }, [source, work.primarySheet, work.headerRow, work.sources, work.joins, plan?.rules.includeHidden]);
    const table = tableState.table;
    const currentEntry = work.results.find(r => r.targetId === target?.id);
    const currentResult = currentEntry?.result;
    const output = currentResult?.outputs[outputIndex] || currentResult?.outputs[0];
    const stale = currentEntry?.revision !== work.revision;
    const pendingPrompt = !!work.prompt.trim() && work.appliedPrompts?.[target?.id || ''] !== work.prompt;
    const planErrors = plan ? [...validatePlanReferences(plan, table.fields), ...(pendingPrompt ? ['작성 지시를 분석하거나 빠른 설정에 반영한 뒤 확인해 주세요.'] : [])] : [];
    const issues = currentResult?.issues || [];
    const mutate = useCallback((patch: Partial<SavedWork>) => { generation.current++; setProposal(undefined); setWarningsAccepted({}); setWork(current => ({ ...current, ...patch, appliedPrompts: patch.appliedPrompts ?? (patch.plans?.length === 0 ? {} : current.appliedPrompts), revision: current.revision + 1, status: 'draft', updatedAt: Date.now() })); }, []);
    const editPlan = (next: ConversionPlan) => mutate({ plans: work.plans.map(p => p.targetId === next.targetId ? next : p) });
    const persistLibrary = async (next: Library) => { try {
        await saveLibrary(ownerId, next);
        setLibrary(next);
        setNotice('저장했습니다.');
    }
    catch (e) {
        setError(message(e));
    } };
    useEffect(() => { let active = true; setReady(false); Promise.all([loadLibrary(ownerId), listWorks(ownerId)]).then(([lib, entries]) => { if (active) {
        setLibrary(lib);
        setHistory(entries);
        setReady(true);
    } }).catch(e => { if (active) {
        setError(message(e));
        setReady(true);
    } }); return () => { active = false; controller.current?.abort(); }; }, [ownerId]);
    useEffect(() => { if (!ready || (!work.sources.length && !work.targets.length && !work.prompt))
        return; setSaved('저장 중'); const id = window.setTimeout(() => { const snapshot = { ...work, expiresAt: Date.now() + library.retentionDays * 86400000 }; saveWork(ownerId, snapshot).then(() => { setSaved('이 브라우저에 저장됨'); return listWorks(ownerId); }).then(setHistory).catch(e => { setSaved('저장 실패'); setError(message(e)); }); }, 650); return () => window.clearTimeout(id); }, [ownerId, work, ready, library.retentionDays]);
    useEffect(() => { setTrace(undefined); setOutputIndex(0); setPreviewSheet(''); }, [targetIndex]);
    useEffect(() => { if (!busy)
        return; const guard = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; }; window.addEventListener('beforeunload', guard); return () => window.removeEventListener('beforeunload', guard); }, [busy]);
    const upload = async (files: FileList | File[] | null, role: 'source' | 'target' | 'example') => {
        if (!files?.length || busy)
            return;
        setBusy('엑셀 파일 읽는 중');
        setError('');
        try {
            if ((role === 'source' ? work.sources.length : work.targets.length) + files.length > 10)
                throw new Error('원본·양식은 각각 최대 10개까지 선택할 수 있습니다.');
            const parsed: WorkbookFile[] = [];
            for (const file of Array.from(files))
                parsed.push(await readWorkbook(await file.arrayBuffer(), file.name));
            if (role === 'example') {
                setExample(parsed[0]);
                setNotice('작성 예시의 머리글과 값 형식을 Gemini 분석에 참고합니다.');
            }
            else if (role === 'source') {
                const first = work.sources[0] || parsed[0];
                mutate({ sources: [...work.sources, ...parsed], primarySheet: work.primarySheet || first.sheets[0].name, headerRow: work.sources.length ? work.headerRow : first.sheets[0].headerRow, plans: [] });
            }
            else {
                mutate({ targets: [...work.targets, ...parsed] });
                if (!work.targets.length)
                    setTargetIndex(0);
            }
        }
        catch (e) {
            setError(message(e));
        }
        finally {
            setBusy('');
        }
    };
    const demo = async () => {
        if (busy)
            return;
        setBusy('예시 파일 준비 중');
        setError('');
        try {
            const files: WorkbookFile[] = [];
            for (const name of EXAMPLES.slice(0, 3)) {
                const res = await fetch(`/excel-converter/examples/${encodeURIComponent(name)}`);
                if (!res.ok)
                    throw new Error('예시 파일을 불러오지 못했습니다.');
                files.push(await readWorkbook(await res.arrayBuffer(), name));
            }
            const data = extractTable(files[0], files[0].sheets[0].name, 4);
            const plans = files.slice(1).map(file => {
                const p = createPlan(file, file.sheets[0].name, data.fields);
                p.rules = { filters: [{ key: 'c8', op: 'neq', value: '취소' }], groupBy: ['c1', 'c7', 'c9'], sums: ['c4', 'c6'], sort: [{ key: 'c7', direction: 'asc' }], splitBy: '', includeHidden: true };
                p.mappings = p.mappings.map(m => m.label === '배송지' ? { ...m, mode: 'concat', sourceKeys: ['c10', 'c11'], confirmed: true, reason: '예시 규칙: 주소와 상세주소 결합' } : m);
                p.summary = ['예시용 규칙을 적용했습니다. Gemini 호출 없이 동일한 변환 엔진으로 검증할 수 있습니다.'];
                return p;
            });
            generation.current++;
            const next = initialWork();
            setWork({ ...next, name: 'A사 납품명세서 · 양식 변경 테스트', sources: [files[0]], targets: files.slice(1), primarySheet: files[0].sheets[0].name, headerRow: 4, plans, prompt: DEFAULT_PROMPT, appliedPrompts: Object.fromEntries(files.slice(1).map(f => [f.id, DEFAULT_PROMPT])), revision: 1 });
            setTargetIndex(0);
            setTab('template');
            setNav('convert');
            setNotice('원본 6행 → 취소 1행 제외 → 합산 후 4행. 예상 수량 46, 공급가액 156,000원입니다.');
        }
        catch (e) {
            setError(message(e));
        }
        finally {
            setBusy('');
        }
    };
    const autoConnect = () => {
        if (!target || !table.fields.length)
            return;
        const p = createPlan(target, target.sheets[0].name, table.fields, library.dictionary);
        mutate({ plans: [...work.plans.filter(item => item.targetId !== target.id), p], appliedPrompts: { ...work.appliedPrompts, [target.id]: '' } });
        setTab('mapping');
        setNotice('항목을 자동 연결했습니다. 자유 입력 지시는 Gemini 분석으로 반영하거나 빠른 설정에서 직접 지정해 주세요.');
    };
    const askAi = async () => {
        if (!target || !plan || !work.prompt.trim() || busy)
            return;
        setError('');
        setBusy('Gemini가 작성 규칙을 분석하고 있습니다');
        const version = generation.current;
        try {
            const result = await analyze(work.prompt, plan, table, target, example);
            if (generation.current !== version)
                return;
            const checked = planSchema.parse(result.plan);
            if (checked.targetId !== target.id || checked.sheetName !== plan.sheetName)
                throw new Error('분석한 양식이 현재 양식과 다릅니다. 다시 분석해 주세요.');
            setProposal(checked);
            setUsage(`${result.model} · 입력 ${result.inputTokens.toLocaleString()} / 출력 ${result.outputTokens.toLocaleString()} 토큰 · ${(result.elapsedMs / 1000).toFixed(1)}초`);
            setTab('mapping');
        }
        catch (e) {
            setError(message(e));
        }
        finally {
            setBusy('');
        }
    };
    const convert = async (all = false) => {
        if (busy || !source)
            return;
        setBusy('변환 준비 중');
        setError('');
        setWarningsAccepted({});
        controller.current = new AbortController();
        const version = generation.current;
        const snapshot = work;
        const selected = all ? snapshot.targets : target ? [target] : [];
        const results = [...snapshot.results];
        let failure = '';
        try {
            for (const file of selected) {
                if (controller.current.signal.aborted)
                    throw new Error('변환을 중단했습니다.');
                const p = snapshot.plans.find(item => item.targetId === file.id);
                if (!p) {
                    failure += `${file.name}: 항목을 먼저 연결해 주세요.\n`;
                    continue;
                }
                try {
                    if (snapshot.prompt.trim() && snapshot.appliedPrompts?.[file.id] !== snapshot.prompt)
                        throw new Error('작성 지시가 아직 반영되지 않았습니다.');
                    const validated = planSchema.parse(p);
                    const sourceData = applyJoins(extractTable(source, snapshot.primarySheet, snapshot.headerRow, p.rules.includeHidden), snapshot.sources.slice(1), snapshot.joins);
                    const result = await convertWorkbook(file, validated, sourceData, setBusy, controller.current.signal);
                    const index = results.findIndex(r => r.targetId === file.id);
                    if (index >= 0)
                        results[index] = { targetId: file.id, result, revision: snapshot.revision };
                    else
                        results.push({ targetId: file.id, result, revision: snapshot.revision });
                }
                catch (e) {
                    failure += `${file.name}: ${message(e)}\n`;
                    const index = results.findIndex(r => r.targetId === file.id);
                    if (index >= 0)
                        results.splice(index, 1);
                }
            }
            if (generation.current === version) {
                setWork(current => ({ ...current, results, resultRevision: current.revision, updatedAt: Date.now(), status: 'review' }));
                setTab('result');
                setPreviewSheet('');
                setOutputIndex(0);
                if (failure)
                    setError(failure);
                else
                    setNotice('생성한 엑셀을 다시 열어 입력값을 대조했습니다. 검증 결과를 확인해 주세요.');
            }
        }
        catch (e) {
            setError(message(e));
        }
        finally {
            setBusy('');
        }
    };
    const canDownload = !stale && !busy && !!output && !issues.some(i => i.level === 'error') && (!issues.some(i => i.level === 'warning') || warningsAccepted[target?.id || '']);
    const zipEntries = work.results.filter(r => r.revision === work.revision && r.result.outputs.length > 0 && !r.result.issues.some(i => i.level === 'error'));
    const canZip = !busy && zipEntries.length > 0 && zipEntries.every(r => !r.result.issues.some(i => i.level === 'warning') || warningsAccepted[r.targetId]);
    const downloadZip = async () => { try {
        if (!canZip)
            throw new Error('각 양식의 최신 결과와 주의사항을 확인해 주세요.');
        const zip = new JSZip();
        let count = 0;
        for (const [i, item] of work.results.entries()) {
            if (item.revision !== work.revision || item.result.issues.some(issue => issue.level === 'error'))
                continue;
            for (const out of item.result.outputs) {
                zip.file(`${i + 1}_${out.name}`, out.bytes);
                count++;
            }
        }
        if (!count)
            throw new Error('다운로드할 최신 정상 결과가 없습니다.');
        saveAs(await zip.generateAsync({ type: 'blob' }), '양식변환_결과.zip');
    }
    catch (e) {
        setError(message(e));
    } };
    const saveRule = () => { if (!plan || !target)
        return; const name = ruleName.trim() || work.name; persistLibrary({ ...library, rules: [{ id: crypto.randomUUID(), name, plan, prompt: work.prompt, updatedAt: Date.now(), signature: templateSignature(target.sheets.find(s => s.name === plan.sheetName)!, plan.headerRow) }, ...library.rules] }); setRuleName(''); };
    const changeSheet = (sheetName: string) => { if (!target)
        return; const p = createPlan(target, sheetName, table.fields, library.dictionary); mutate({ plans: [...work.plans.filter(item => item.targetId !== target.id), p], appliedPrompts: { ...work.appliedPrompts, [target.id]: '' } }); setPreviewSheet(''); };
    const preview = tab === 'source' ? source?.sheets.find(s => s.name === work.primarySheet) : tab === 'result' ? output?.sheets.find(s => s.name === previewSheet) || output?.sheets[0] : target?.sheets.find(s => s.name === plan?.sheetName) || target?.sheets[0];
    const step = !source || !target ? 0 : !plan ? 1 : planErrors.length ? 2 : !currentResult || stale ? 3 : 4;
    return <div className="xc-app">
    <header className="xc-header"><div className="xc-brand-icon"><FileSpreadsheet size={25}/></div><div><div className="xc-eyebrow">DOCUMENT WORKSPACE</div><h1>엑셀 양식 변환</h1><p>데이터는 그대로, 양식은 원하는 대로.</p></div><div className="xc-header-actions"><button className="xc-secondary" onClick={demo} disabled={!!busy}><Sparkles size={15}/>예시로 체험</button><button className="xc-primary" onClick={() => { generation.current++; setWork(initialWork()); setTargetIndex(0); setProposal(undefined); setExample(undefined); setNotice(''); setError(''); setNav('convert'); }} disabled={!!busy}><Plus size={16}/>새 변환</button></div></header>
    <nav aria-busy={!!busy} className="xc-nav" aria-label="양식 변환 메뉴">{[{ id: 'convert', label: '변환 작업', icon: FileSpreadsheet }, { id: 'history', label: '작업 이력', icon: History }, { id: 'templates', label: '양식 보관함', icon: FolderOpen }, { id: 'rules', label: '작성 규칙', icon: Settings2 }, { id: 'dictionary', label: '업무 사전', icon: BookOpen }].map(item => <button key={item.id} className={nav === item.id ? 'active' : ''} disabled={!!busy} onClick={() => setNav(item.id)}><item.icon size={16}/>{item.label}</button>)}<span className="xc-local-badge">내 브라우저 작업 공간</span></nav>
    {error && <div role="alert" className="xc-banner error"><span>{error}</span><button aria-label="오류 닫기" onClick={() => setError('')}><X size={16}/></button></div>}
    {notice && <div role="status" className="xc-banner info"><span>{notice}</span><button aria-label="안내 닫기" onClick={() => setNotice('')}><X size={16}/></button></div>}
    {nav === 'convert' ? <>
      <div className="xc-work-title"><input aria-label="작업명" value={work.name} disabled={!!busy} onChange={e => mutate({ name: e.target.value })}/><span><Save size={13}/>{saved || '파일을 추가하면 자동 저장됩니다'}</span><button disabled={!!busy || !source} onClick={async () => { try {
            await saveVersion(ownerId, work);
            setNotice('현재 파일·규칙·결과를 버전으로 보관했습니다. 작업 이력에서 복원할 수 있습니다.');
        }
        catch (e) {
            setError(message(e));
        } }}>이 버전 보관</button></div>
      <ol className="xc-steps">{['파일 준비', '양식 분석', '연결 확인', '변환·검증', '다운로드'].map((name, i) => <li key={name} className={i === step ? 'current' : i < step ? 'done' : ''}><span>{i < step ? <CheckCircle2 size={15}/> : i + 1}</span>{name}{i < 4 && <ChevronRight size={14}/>}</li>)}</ol>
      <div className="xc-workspace"><aside className="xc-input-panel"><section className="xc-card"><div className="xc-section-title"><h2>01 <span>파일 준비</span></h2><Files size={17}/></div>
        <UploadBox title="우리 회사 원본" description="데이터가 들어 있는 .xlsx · .xlsm" disabled={!!busy} onFiles={files => upload(files, 'source')}/>
        {work.sources.map((file, i) => <div className="xc-file" key={file.id}><FileSpreadsheet size={16}/><span>{file.name}<small>{i === 0 ? '원본 데이터' : '보조 자료'}</small></span><button aria-label={`${file.name} 제거`} disabled={!!busy} onClick={() => mutate({ sources: work.sources.filter(f => f.id !== file.id), plans: [], joins: [], primarySheet: i === 0 ? work.sources[1]?.sheets[0].name || '' : work.primarySheet, headerRow: i === 0 ? work.sources[1]?.sheets[0].headerRow || 1 : work.headerRow })}><X size={14}/></button></div>)}
        {source && <div className="xc-inline"><label>원본 시트<select disabled={!!busy} value={work.primarySheet} onChange={e => mutate({ primarySheet: e.target.value, headerRow: source.sheets.find(s => s.name === e.target.value)!.headerRow, plans: [] })}>{source.sheets.map(s => <option key={s.name}>{s.name}</option>)}</select></label><label>제목 행<input type="number" min="1" max="30000" value={work.headerRow} disabled={!!busy} onChange={e => mutate({ headerRow: Number(e.target.value), plans: [] })}/></label></div>}
        <div className="xc-file-arrow"><ArrowRight size={17}/></div><UploadBox title="상대 회사 양식" description="매번 다른 양식 · 여러 파일 가능" disabled={!!busy} onFiles={files => upload(files, 'target')}/>
        {work.targets.map((file, i) => <div className={`xc-file ${targetIndex === i ? 'selected' : ''}`} key={file.id}><FileSpreadsheet size={16}/><button className="xc-file-select" disabled={!!busy} onClick={() => setTargetIndex(i)}>{file.name}<small>{work.results.find(r => r.targetId === file.id)?.result.issues.some(issue => issue.level === 'error') ? '검증 오류' : work.results.some(r => r.targetId === file.id) ? work.results.find(r => r.targetId === file.id)?.revision !== work.revision ? '다시 변환 필요' : '결과 있음' : '대상 양식'}</small></button><button aria-label={`${file.name} 제거`} disabled={!!busy} onClick={() => { mutate({ targets: work.targets.filter(f => f.id !== file.id), plans: work.plans.filter(p => p.targetId !== file.id), results: work.results.filter(r => r.targetId !== file.id) }); setTargetIndex(0); }}><X size={14}/></button></div>)}
        <details><summary>작성 완료 예시 추가</summary><UploadBox title={example?.name || '작성 예시 선택'} description="항목 이름·값 형식 참고용" disabled={!!busy} onFiles={files => upload(files, 'example')}/></details>
        <details><summary>보조 자료 연결 {work.joins.length ? `(${work.joins.length})` : ''}</summary>{work.sources.length < 2 ? <p className="xc-help">원본 영역에 상품코드표 등 보조 엑셀을 추가하세요.</p> : <><button disabled={!!busy} onClick={() => { const file = work.sources[1]; mutate({ joins: [...work.joins, { fileId: file.id, sheetName: file.sheets[0].name, headerRow: file.sheets[0].headerRow, leftKey: table.fields[0]?.key || '', rightColumn: 1, prefix: `lookup${work.joins.length}_` }], plans: [] }); }}>+ 연결 추가</button>{work.joins.map((join, i) => <JoinEditor key={i} join={join} files={work.sources.slice(1)} fields={table.fields} onChange={next => mutate({ joins: work.joins.map((j, n) => n === i ? next : j), plans: [] })} onRemove={() => mutate({ joins: work.joins.filter((_, n) => i !== n), plans: [] })}/>)}</>}</details>
      </section>
      <section className="xc-card"><div className="xc-section-title"><h2>02 <span>작성 지시</span></h2><Sparkles size={17}/></div><textarea aria-label="작성 지시 프롬프트" placeholder="예: 취소 주문은 제외하고, 같은 상품과 납기끼리 수량을 합산해 주세요." rows={7} maxLength={6000} value={work.prompt} disabled={!!busy} onChange={e => mutate({ prompt: e.target.value })}/><div className="xc-prompt-footer"><span>{work.prompt.length.toLocaleString()} / 6,000</span><button className="xc-link" onClick={() => mutate({ prompt: DEFAULT_PROMPT })} disabled={!!busy}>예시 지시 넣기</button></div>
        {library.rules.length > 0 && <label>저장된 규칙<select defaultValue="" disabled={!!busy} onChange={e => { const rule = library.rules.find(r => r.id === e.target.value); if (!rule || !plan || !target)
            return; const signature = templateSignature(target.sheets.find(s => s.name === plan.sheetName)!, plan.headerRow); if (rule.signature !== signature) {
            mutate({ prompt: rule.prompt });
            setNotice('양식 구조가 달라 지시만 불러왔습니다. Gemini 분석 또는 연결 확인이 필요합니다.');
        }
        else {
            mutate({ prompt: rule.prompt, appliedPrompts: { ...work.appliedPrompts, [target.id]: rule.prompt }, plans: work.plans.map(p => p.targetId === target.id ? { ...rule.plan, targetId: target.id, sheetName: plan.sheetName, origin: 'saved', overrides: [], mappings: rule.plan.mappings.map(m => ({ ...m, confirmed: false })) } : p) });
            setNotice('저장된 규칙을 불러왔습니다. 원본 항목 연결을 다시 확인해 주세요.');
        } }}><option value="">작성 규칙 선택</option>{library.rules.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>}
        <button className="xc-ai-button" disabled={!plan || !work.prompt.trim() || !!busy} onClick={askAi}><Sparkles size={16}/>Gemini로 지시 분석</button><p className="xc-help">항목명·양식 설명·작성 지시를 서버 AI로 분석합니다. 원본 전체 데이터 행은 전송하지 않습니다.</p>{usage && <small className="xc-help">{usage}</small>}
        {plan && <details><summary>빠른 설정으로 직접 지정</summary><RulesEditor rules={plan.rules} fields={table.fields} onChange={rules => editPlan({ ...plan, rules })}/>{pendingPrompt && <button className="xc-link" onClick={() => mutate({ appliedPrompts: { ...work.appliedPrompts, [plan.targetId]: work.prompt } })}>작성 지시를 위 설정에 직접 반영했습니다</button>}</details>}
      </section></aside>
      <main className="xc-center-panel"><section className="xc-card xc-canvas-card"><div className="xc-canvas-top"><div><h2>{target ? target.name : '양식 미리보기'}</h2><p>{table.rows.length ? `원본 ${table.rows.length.toLocaleString()}행 · ${table.fields.length}개 항목` : '원본과 양식을 업로드하거나 예시로 시작하세요.'}</p></div><button className="xc-secondary" disabled={!source || !target || !!busy || !!tableState.error} onClick={autoConnect}><Settings2 size={15}/>항목 자동 연결</button></div>
        <div className="xc-tabs">{[{ key: 'template', label: '상대 회사 양식' }, { key: 'source', label: '원본 데이터' }, { key: 'mapping', label: '항목 연결' }, { key: 'result', label: '변환 결과' }, { key: 'validation', label: '검증 결과' }].map(t => <button className={tab === t.key ? 'active' : ''} key={t.key} onClick={() => setTab(t.key)}>{t.label}{t.key === 'validation' && issues.length ? <b>{issues.length}</b> : null}</button>)}</div>
        {proposal && <div className="xc-proposal"><h3><Sparkles size={18}/>적용할 작성 규칙</h3><ul>{proposal.summary.map((line, i) => <li key={i}>{line}</li>)}</ul>{proposal.questions.length > 0 && <p>추가 확인 {proposal.questions.length}건이 있습니다.</p>}<div><button className="xc-primary" onClick={() => { mutate({ plans: work.plans.map(p => p.targetId === proposal.targetId ? proposal : p), appliedPrompts: { ...work.appliedPrompts, [proposal.targetId]: work.prompt } }); setProposal(undefined); setNotice('AI 제안을 반영했습니다. 확인할 항목을 해결한 뒤 변환하세요.'); }}>이 규칙 적용</button><button onClick={() => setProposal(undefined)}>기존 규칙 유지</button></div></div>}
        {tableState.error && <div className="xc-banner error">{tableState.error}</div>}
        {tab === 'mapping' ? plan ? <div className="xc-mapping-list"><div className="xc-section-title"><h3>어떤 값을 어디에 넣을까요?</h3><span>{plan.mappings.filter(m => !m.confirmed).length}개 확인 필요</span></div><input placeholder="대상 항목 검색" aria-label="대상 항목 검색" value={mappingSearch} onChange={e => setMappingSearch(e.target.value)}/>{plan.mappings.map((m, i) => ({ m, i })).filter(({ m }) => m.label.includes(mappingSearch)).map(({ m, i }) => <MappingEditor key={`${m.targetColumn}-${i}`} mapping={m} fields={table.fields} onChange={next => editPlan({ ...plan, mappings: plan.mappings.map((item, n) => n === i ? next : item) })}/>)}<details><summary>상단 정보 등 한 번만 입력하는 셀 ({plan.fixedCells.length})</summary>{plan.fixedCells.map((fixed, i) => <div key={i}><div className="xc-inline"><label>셀 주소<input value={fixed.address} onChange={e => editPlan({ ...plan, fixedCells: plan.fixedCells.map((f, n) => n === i ? { ...f, address: e.target.value.toUpperCase() } : f) })}/></label><label>항목 이름<input value={fixed.mapping.label} onChange={e => editPlan({ ...plan, fixedCells: plan.fixedCells.map((f, n) => n === i ? { ...f, mapping: { ...f.mapping, label: e.target.value } } : f) })}/></label><button onClick={() => editPlan({ ...plan, fixedCells: plan.fixedCells.filter((_, n) => n !== i) })}>삭제</button></div><MappingEditor mapping={fixed.mapping} fields={table.fields} onChange={mapping => editPlan({ ...plan, fixedCells: plan.fixedCells.map((f, n) => n === i ? { ...f, mapping } : f) })}/></div>)}<button onClick={() => editPlan({ ...plan, fixedCells: [...plan.fixedCells, { address: 'B4', mapping: blankMapping('단일 입력', 2) }] })}>+ 단일 입력 칸</button></details></div> : <div className="xc-empty"><Settings2 size={30}/><strong>항목 자동 연결을 먼저 실행하세요.</strong><span>대상 열에 넣을 원본 항목과 처리 방법을 확인할 수 있습니다.</span></div>
                : tab === 'validation' ? <div className="xc-validation"><h3>검증 결과</h3>{!currentResult ? <p>변환 후 값과 파일 검증 결과가 표시됩니다.</p> : <><div className="xc-stats"><Stat label="원본 행" value={currentResult.inputCount}/><Stat label="출력 행" value={currentResult.outputCount}/><Stat label="생성 파일" value={currentResult.outputs.length}/></div>{issues.length ? issues.map((issue, i) => <div key={i} className={`xc-issue ${issue.level}`}><strong>{issue.level === 'error' ? '수정 필요' : '주의'}</strong><p>{issue.message}</p>{issue.location && <small>{issue.location}</small>}</div>) : <div className="xc-validated"><ShieldCheck size={25}/><div><strong>입력값·파일 재열기 검증 통과</strong><p>작성한 값이 생성 파일과 일치합니다. 항목의 업무 의미와 인쇄 결과는 최종 확인하세요.</p></div></div>}<details><summary>제외 내역 {currentResult.excluded.length}건</summary>{currentResult.excluded.map((r, i) => <p key={i}>{r.origin}<small>{r.reason}</small></p>)}</details><button onClick={() => saveAs(new Blob([JSON.stringify({ task: work.name, engineVersion: '1.0.0', issues, excluded: currentResult.excluded, inputCount: currentResult.inputCount, outputCount: currentResult.outputCount }, null, 2)], { type: 'application/json' }), '양식변환_검증보고서.json')}>검증 보고서 다운로드</button><label className="xc-review-note">검토 메모<textarea value={work.reviewNote} onChange={e => setWork(current => ({ ...current, reviewNote: e.target.value, updatedAt: Date.now() }))} placeholder="확인한 내용이나 전달할 주의사항"/></label><button disabled={!currentResult.outputs.length || stale || issues.some(i => i.level === "error")} onClick={() => { setWork(current => ({ ...current, status: "approved", updatedAt: Date.now() })); setNotice("현재 결과를 검토 완료로 기록했습니다."); }}>{work.status === "approved" ? "검토 완료됨" : "검토 완료 기록"}</button><button onClick={() => saveAs(new Blob([JSON.stringify(plan, null, 2)], { type: 'application/json' }), '양식변환_연결규칙.json')}>항목 연결표 다운로드</button></>}</div>
                    : <>{tab === 'result' && <>{stale && currentResult && <div className="xc-banner warning">설정이 바뀌었습니다. 다시 변환하면 최신 결과를 다운로드할 수 있습니다.</div>}{currentResult && <div className="xc-result-select"><label>결과 파일<select value={outputIndex} onChange={e => { setOutputIndex(Number(e.target.value)); setPreviewSheet(''); }}>{currentResult.outputs.map((o, i) => <option key={o.name} value={i}>{o.name}</option>)}</select></label><label>시트<select value={previewSheet || output?.sheets[0]?.name || ''} onChange={e => setPreviewSheet(e.target.value)}>{output?.sheets.map(s => <option key={s.name}>{s.name}</option>)}</select></label></div>}</>}<SheetPreview sheet={preview} traces={tab === 'result' ? output?.traces : undefined} onSelect={value => { setTrace(value); setOverrideText(String(value.value ?? "")); }}/></>}
        {!target && <div className="xc-example-strip"><FileSpreadsheet size={21}/><div><strong>파일 없이 먼저 확인해 보세요.</strong><p>원본, 다른 두 양식, 정답 예시를 준비했습니다.</p></div><button className="xc-primary" onClick={demo} disabled={!!busy}>예시 불러오기</button></div>}
      </section>
      {target && work.targets.length > 1 && <details className="xc-card xc-diff"><summary>업로드한 양식 비교</summary>{describeTemplateChanges(work.targets[0].sheets[0], work.targets[1].sheets[0]).map((line, i) => <p key={i}>{line}</p>)}</details>}
      {trace && <section className="xc-card xc-trace"><div className="xc-section-title"><h3>{trace.sheet}!{trace.address} · {trace.label}</h3><button aria-label="원본 추적 닫기" onClick={() => setTrace(undefined)}><X size={15}/></button></div><strong>{String(trace.value ?? '빈칸')}</strong><p>처리: {trace.rule}</p>{plan && trace.origins[0] !== "사용자 고정값" && trace.kind !== 'boolean' && !plan.fixedCells.some(f => f.address === trace.address) && <div className="xc-inline"><label>이 값 직접 수정<input aria-label="선택한 결과값 수정" value={overrideText} onChange={e => setOverrideText(e.target.value)}/></label><button disabled={!!busy || stale} onClick={() => { const value = !overrideText ? null : trace.kind === "number" ? numberValue(overrideText) : trace.kind === "date" ? strictDate(overrideText) : overrideText; if (overrideText && value === null) {
            setError("숫자 또는 날짜 형식을 확인해 주세요.");
            return;
        } const mapping = plan.mappings.find(m => columnName(m.targetColumn) === trace.address.replace(/\d/g, '') && m.label === trace.label); if (!mapping)
            return; const { targetColumn, rowOffset } = mapping; const originsKey = trace.origins.join("\n"); editPlan({ ...plan, overrides: [...(plan.overrides || []).filter(o => o.originsKey !== originsKey || o.targetColumn !== targetColumn || (o.rowOffset || 0) !== (rowOffset || 0)), { originsKey, targetColumn, rowOffset, value, kind: trace.kind }] }); setNotice("직접 수정 내용을 저장했습니다. 다시 변환하면 검증 후 다운로드할 수 있습니다."); }}>수정 반영</button></div>}<ul>{trace.origins.map((origin, i) => <li key={i}>{origin}</li>)}</ul><button className="xc-link" onClick={() => { setMappingSearch(trace.label); setTab('mapping'); }}>이 항목의 규칙 수정</button></section>}
      </main>
      <aside className="xc-review-panel"><section className="xc-card"><div className="xc-section-title"><h2>03 <span>작성 범위</span></h2><Settings2 size={17}/></div>{plan && target ? <><label>대상 시트<select value={plan.sheetName} disabled={!!busy} onChange={e => changeSheet(e.target.value)}>{target.sheets.map(s => <option key={s.name}>{s.name}</option>)}</select></label><div className="xc-inline"><label>제목 행<input aria-label="대상 제목 행" type="number" min="1" max="30000" value={plan.headerRow} disabled={!!busy} onChange={e => { const p = createPlan(target, plan.sheetName, table.fields, library.dictionary, Number(e.target.value)); editPlan({ ...p, rules: plan.rules }); }}/></label><label>입력 시작 행<input aria-label="입력 시작 행" type="number" value={plan.startRow} disabled={!!busy} onChange={e => editPlan({ ...plan, startRow: Number(e.target.value) })}/></label><label>마지막 행<input aria-label="입력 마지막 행" type="number" value={plan.endRow} disabled={!!busy} onChange={e => editPlan({ ...plan, endRow: Number(e.target.value) })}/></label></div><label>입력 칸이 부족하면<select value={plan.overflow} disabled={!!busy} onChange={e => editPlan({ ...plan, overflow: e.target.value as ConversionPlan['overflow'] })}><option value="sheets">같은 양식의 시트 추가</option><option value="files">여러 파일로 나누기</option><option value="stop">중단하고 확인</option></select></label><p className="xc-help">{plan.endRow - plan.startRow + 1}행씩 작성 · 기존 수식과 양식 구성 보존</p><details><summary>양식 보관함에 저장</summary><button disabled={!!busy} onClick={() => persistLibrary({ ...library, templates: [target, ...library.templates.filter(t => t.fingerprint !== target.fingerprint)] })}>이 양식 저장</button></details></> : <p className="xc-help">원본과 양식을 준비한 후 항목 자동 연결을 실행하세요.</p>}</section>
      <section className="xc-card"><div className="xc-section-title"><h2>적용할 규칙</h2><ShieldCheck size={17}/></div>{plan ? <>{describeRules(plan.rules, table.fields).length ? <ol className="xc-rule-summary">{describeRules(plan.rules, table.fields).map((line, i) => <li key={i}>{line}</li>)}</ol> : <p className="xc-help">현재는 원본 순서대로 입력합니다.</p>}{plan.questions.map((q, i) => <div className="xc-question" key={i}><p>{q}</p><button className="xc-link" onClick={() => editPlan({ ...plan, questions: plan.questions.filter((_, n) => i !== n) })}>직접 규칙을 수정하고 해결함</button></div>)}<details><summary>직접 수정 내역 ({plan.overrides?.length || 0})</summary><p className="xc-help">직접 수정은 원본 행 구성에 연결됩니다. 합산 기준이 바뀌면 다시 확인해야 합니다.</p><button disabled={!plan.overrides?.length} onClick={() => editPlan({ ...plan, overrides: [] })}>직접 수정 모두 해제</button></details><details><summary>현재 규칙 저장</summary><input placeholder="규칙 이름" value={ruleName} onChange={e => setRuleName(e.target.value)}/><button onClick={saveRule}>작성 규칙 저장</button></details></> : <p className="xc-help">분석한 작성 규칙이 여기에 표시됩니다.</p>}</section>
      <section className="xc-card xc-check-card"><h2>확인할 항목</h2><strong className="xc-check-count">{planErrors.length}<small>건</small></strong>{planErrors.length ? <ul>{planErrors.slice(0, 6).map((item, i) => <li key={i}>{item}</li>)}</ul> : <p>{plan ? '연결 확인을 마쳤습니다. 변환 후 결과를 검토하세요.' : '양식 분석을 시작해 주세요.'}</p>}<button className="xc-link" onClick={() => setTab('mapping')}>항목 연결 확인 <ChevronRight size={14}/></button></section>
      <section className="xc-card xc-help-card"><h3>원본은 안전하게 보관됩니다</h3><p>원본을 덮어쓰지 않고 새 파일을 만듭니다. 파일과 작업 이력은 현재 계정의 이 브라우저에 저장됩니다.</p><a href="/settings/ai">서버 Gemini 설정</a></section></aside></div>
      <footer className="xc-bottom"><div>{busy ? <span className="xc-progress"><Loader2 size={18} className="xc-spin"/>{busy}</span> : currentResult && !stale ? <span><CheckCircle2 size={18}/>{currentResult.outputs.length}개 파일 · {currentResult.outputCount}행 · {(currentResult.elapsedMs / 1000).toFixed(1)}초</span> : <span><ShieldCheck size={17}/>작성 규칙을 확인한 뒤 변환하세요.</span>}{issues.some(i => i.level === 'warning') && !stale && <label className="xc-check"><input type="checkbox" checked={!!warningsAccepted[target?.id || '']} onChange={e => setWarningsAccepted({ ...warningsAccepted, [target.id]: e.target.checked })}/>주의사항 확인</label>}</div><div className="xc-bottom-actions">{busy && <button onClick={() => controller.current?.abort()} disabled={busy.includes('Gemini')}>변환 중단</button>}<button className="xc-secondary" disabled={!plan || !!busy || !!tableState.error || planErrors.length > 0} onClick={() => convert(false)}>현재 양식 변환</button>{work.targets.length > 1 && <button className="xc-secondary" disabled={!!busy || !work.plans.length || !!tableState.error} onClick={() => convert(true)}>전체 양식 변환</button>}<button className="xc-primary" disabled={!canDownload} onClick={() => output && saveAs(blob(output.bytes, output.name), output.name)}><Download size={16}/>엑셀 다운로드</button>{work.results.length > 0 && <button title="검증을 통과한 결과 파일 묶음" disabled={!canZip} onClick={downloadZip}>ZIP</button>}</div></footer>
    </> : <section className="xc-library-page">
      {nav === 'history' && <><div className="xc-section-title"><div><h2>작업 이력</h2><p>파일과 결과를 불러와 이어서 작업하세요.</p></div><label>작업 보관 기간<select value={library.retentionDays} onChange={e => persistLibrary({ ...library, retentionDays: Number(e.target.value) })}><option value="7">7일</option><option value="30">30일</option><option value="90">90일</option></select></label></div>{!history.length && <p className="xc-empty">저장된 작업이 없습니다.</p>}{history.map(entry => <div className="xc-library-row" key={entry.id}><History size={20}/><div><strong>{entry.name}</strong><p>{new Date(entry.updatedAt).toLocaleString('ko-KR')} · 양식 {entry.targets.length}개 · 버전 {entry.revision} · {entry.status === 'approved' ? '검토 완료' : entry.status === 'review' ? '검토 중' : '작성 중'}</p></div><button onClick={async () => { try {
            setVersions(await listVersions(ownerId, entry.id));
            setVersionWorkId(entry.id);
        }
        catch (e) {
            setError(message(e));
        } }}>보관 버전</button><button onClick={() => { generation.current++; setWarningsAccepted({}); setExample(undefined); setWork(entry); setTargetIndex(0); setNav('convert'); setTab('result'); setProposal(undefined); }}>작업 열기</button><button onClick={async () => { try {
            await deleteWork(ownerId, entry.id);
            setHistory(await listWorks(ownerId));
            if (entry.id === work.id)
                setWork(initialWork());
        }
        catch (e) {
            setError(message(e));
        } }}>삭제</button></div>)}<section className="xc-version-list">{versionWorkId && <><h3>보관한 버전 · 최근 10개</h3>{!versions.length && <p>변환 화면에서 ‘이 버전 보관’을 눌러 저장할 수 있습니다.</p>}{versions.map(v => <div className="xc-library-row" key={v.id}><div><strong>{v.work.name} · 버전 {v.work.revision}</strong><p>{new Date(v.createdAt).toLocaleString("ko-KR")}</p></div><button onClick={() => { generation.current++; setWork({ ...v.work, id: crypto.randomUUID(), name: `${v.work.name} (복원)`, updatedAt: Date.now() }); setTargetIndex(0); setWarningsAccepted({}); setProposal(undefined); setExample(undefined); setNav("convert"); setTab("result"); setNotice("보관 버전을 새 작업으로 복원했습니다."); }}>새 작업으로 복원</button></div>)}</>}</section><p className="xc-help">새 보관 기간은 이후 저장하는 작업에 적용됩니다. 만료된 작업은 이 화면을 열 때 정리합니다. 다른 브라우저·기기와 자동 동기화하지 않습니다.</p></>}
      {nav === 'templates' && <><h2>양식 보관함</h2><p>예시 파일을 내려받거나 저장한 양식을 새 작업에 추가하세요.</p><div className="xc-sample-grid">{EXAMPLES.map((name, i) => <a key={name} href={`/excel-converter/examples/${encodeURIComponent(name)}`} download={name}><FileSpreadsheet size={26}/><strong>{['우리 회사 원본', '상대 회사 양식', '변경된 상대 회사 양식', '작성 완료 정답 예시', '보조 상품코드표'][i]}</strong><small>{name}</small><span><Download size={14}/>다운로드</span></a>)}</div>{library.templates.map(file => <div className="xc-library-row" key={file.fingerprint}><FileSpreadsheet size={20}/><div><strong>{file.name}</strong><p>{file.sheets.length}개 시트</p></div><button onClick={() => { mutate({ targets: [...work.targets, { ...file, id: crypto.randomUUID() }] }); setNav('convert'); }}>작업에 추가</button><button onClick={() => persistLibrary({ ...library, templates: library.templates.filter(f => f.fingerprint !== file.fingerprint) })}>삭제</button></div>)}</>}
      {nav === 'rules' && <><h2>작성 규칙</h2><p>같은 양식에는 저장한 규칙을 불러오고, 달라진 양식은 다시 확인합니다.</p>{!library.rules.length && <p className="xc-empty">변환 화면의 ‘현재 규칙 저장’으로 추가하세요.</p>}{library.rules.map(rule => <div className="xc-library-row" key={rule.id}><Settings2 size={20}/><div><strong>{rule.name}</strong><p>{rule.prompt || rule.plan.summary.join(' ')}</p></div><button onClick={() => { mutate({ prompt: rule.prompt }); setNav('convert'); setNotice('작성 지시를 불러왔습니다. 현재 양식에 맞춰 분석해 주세요.'); }}>지시 불러오기</button><button onClick={() => saveAs(new Blob([JSON.stringify(rule, null, 2)], { type: 'application/json' }), `${rule.name.replace(/[<>:"/\\|?*]/g, '_')}_작성규칙.json`)}>내보내기</button><button onClick={() => persistLibrary({ ...library, rules: library.rules.filter(r => r.id !== rule.id) })}>삭제</button></div>)}<label className="xc-upload-rule">규칙 파일 가져오기<input type="file" accept=".json" onChange={async (e) => { try {
            const file = e.target.files?.[0];
            if (!file || file.size > 200000)
                throw new Error('200KB 이하의 규칙 JSON을 선택해 주세요.');
            const parsed = JSON.parse(await file.text());
            const checked = planSchema.parse(parsed.plan);
            await persistLibrary({ ...library, rules: [{ id: crypto.randomUUID(), name: String(parsed.name || '가져온 규칙').slice(0, 100), plan: checked, prompt: String(parsed.prompt || '').slice(0, 6000), signature: String(parsed.signature || ''), updatedAt: Date.now() }, ...library.rules] });
        }
        catch (err) {
            setError(message(err));
        } }}/></label></>}
      {nav === 'dictionary' && <><h2>업무 사전</h2><p>거래처 항목명을 우리 회사 원본 항목과 연결합니다. 코드값의 변환은 보조 자료 연결을 사용하세요.</p><div className="xc-inline"><label>상대 회사 항목<input value={dictionaryFrom} onChange={e => setDictionaryFrom(e.target.value)} placeholder="예: 납품예정일"/></label><label>우리 회사 항목<input value={dictionaryTo} onChange={e => setDictionaryTo(e.target.value)} placeholder="예: 납기"/></label><button className="xc-primary" disabled={!dictionaryFrom.trim() || !dictionaryTo.trim()} onClick={() => { persistLibrary({ ...library, dictionary: { ...library.dictionary, [dictionaryFrom.trim()]: dictionaryTo.trim() } }); setDictionaryFrom(''); setDictionaryTo(''); }}>연결 저장</button></div>{Object.entries(library.dictionary).map(([from, to]) => <div className="xc-library-row" key={from}><strong>{from}</strong><ArrowRight size={16}/><span>{to}</span><button onClick={() => { const next = { ...library.dictionary }; delete next[from]; persistLibrary({ ...library, dictionary: next }); }}>삭제</button></div>)}</>}
    </section>}
  </div>;
}
function UploadBox({ title, description, disabled, onFiles }: {
    title: string;
    description: string;
    disabled: boolean;
    onFiles: (files: FileList | File[]) => void;
}) { const [over, setOver] = useState(false); return <label className={`xc-upload ${over ? 'over' : ''} ${disabled ? 'disabled' : ''}`} onDragOver={e => { e.preventDefault(); if (!disabled)
    setOver(true); }} onDragLeave={() => setOver(false)} onDrop={e => { e.preventDefault(); setOver(false); if (!disabled)
    onFiles(e.dataTransfer.files); }}><span className="xc-upload-icon"><FileSpreadsheet size={21}/></span><strong>{title}</strong><small>{description}</small><span className="xc-upload-action">파일 선택 또는 끌어 놓기</span><input aria-label={title} type="file" accept=".xlsx,.xlsm" multiple disabled={disabled} onChange={e => { if (e.target.files)
    onFiles(e.target.files); e.target.value = ''; }}/></label>; }
function Stat({ label, value }: {
    label: string;
    value: number;
}) { return <div><span>{label}</span><strong>{value.toLocaleString()}</strong></div>; }
function JoinEditor({ join, files, fields, onChange, onRemove }: {
    join: JoinSpec;
    files: WorkbookFile[];
    fields: DataTable['fields'];
    onChange: (join: JoinSpec) => void;
    onRemove: () => void;
}) { const file = files.find(f => f.id === join.fileId); return <div className="xc-join"><label>보조 파일<select value={join.fileId} onChange={e => { const next = files.find(f => f.id === e.target.value)!; onChange({ ...join, fileId: next.id, sheetName: next.sheets[0].name, headerRow: next.sheets[0].headerRow }); }}>{files.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label><label>보조 시트<select value={join.sheetName} onChange={e => onChange({ ...join, sheetName: e.target.value, headerRow: file!.sheets.find(s => s.name === e.target.value)!.headerRow })}>{file?.sheets.map(s => <option key={s.name}>{s.name}</option>)}</select></label><div className="xc-inline"><label>제목 행<input type="number" min="1" value={join.headerRow} onChange={e => onChange({ ...join, headerRow: Number(e.target.value) })}/></label><label>보조 기준 열<input type="number" min="1" value={join.rightColumn} onChange={e => onChange({ ...join, rightColumn: Number(e.target.value) })}/></label></div><label>원본 기준 열<input list="xc-source-fields" value={join.leftKey} onChange={e => onChange({ ...join, leftKey: e.target.value })}/><datalist id="xc-source-fields">{fields.filter(f => !f.key.startsWith('lookup')).map(f => <option key={f.key} value={f.key}>{f.label}</option>)}</datalist></label><button onClick={onRemove}>연결 삭제</button></div>; }
